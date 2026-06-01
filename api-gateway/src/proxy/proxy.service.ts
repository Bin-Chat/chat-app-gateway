import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosRequestConfig } from 'axios';

const DEFAULT_PROXY_TIMEOUT_MS = 5000;
const DEFAULT_AI_PROXY_TIMEOUT_MS = 120000;
const DEFAULT_PROXY_RETRY_DELAY_MS = 3000;
const DEFAULT_PROXY_RETRY_ATTEMPTS = 1;

interface ProxyResponse {
  status: number;
  data: any;
  headers: Record<string, any>;
}

@Injectable()
export class ProxyService {
  private readonly serviceUrls: Map<string, string>;
  private readonly proxyTimeoutMs: number;
  private readonly aiProxyTimeoutMs: number;
  private readonly retryDelayMs: number;
  private readonly retryAttempts: number;

  constructor(private configService: ConfigService) {
    this.serviceUrls = new Map([
      ['auth', this.configService.get('AUTH_SERVICE_URL')],
      ['user', this.configService.get('USER_SERVICE_URL')],
      ['friend', this.configService.get('FRIEND_SERVICE_URL')],
      ['upload', this.configService.get('UPLOAD_SERVICE_URL')],
      ['chat', this.configService.get('CHAT_SERVICE_URL')],
      ['ai', this.configService.get('AI_SERVICE_URL')],
    ]);
    this.proxyTimeoutMs = Number(this.configService.get('PROXY_TIMEOUT_MS') ?? DEFAULT_PROXY_TIMEOUT_MS);
    this.aiProxyTimeoutMs = Number(
      this.configService.get('AI_PROXY_TIMEOUT_MS') ?? DEFAULT_AI_PROXY_TIMEOUT_MS
    );
    this.retryDelayMs = Number(this.configService.get('PROXY_RETRY_DELAY_MS') ?? DEFAULT_PROXY_RETRY_DELAY_MS);
    this.retryAttempts = Number(this.configService.get('PROXY_RETRY_ATTEMPTS') ?? DEFAULT_PROXY_RETRY_ATTEMPTS);
  }

  // Mục đích để chuyển tiếp yêu cầu đến các microservice tương ứng
  // forwardRequest sẽ nhận các tham số như tên service, đường dẫn, phương thức, headers, body và query
  // Sau đó nó sẽ xây dựng yêu cầu HTTP và gửi đến microservice tương ứng
  // Cuối cùng nó trả về phản hồi nhận được từ microservice cho controller để trả về cho client
  // Ví dụ: forwardRequest('auth', '/login', 'POST', headers, body, query)
  // sẽ gửi yêu cầu POST đến http://auth-service/login với headers, body và query tương ứng
  // và trả về phản hồi từ auth-service cho client thông qua API Gateway
  // Đây là phần quan trọng để API Gateway hoạt động như một proxy trung gian giữa client và các microservice
  // Nó giúp tách biệt client khỏi các microservice cụ thể và cung cấp một điểm truy cập duy nhất cho tất cả các dịch vụ
  // Ngoài ra nó cũng có thể xử lý các logic chung như xác thực, logging, rate limiting, v.v. nếu cần thiết
  async forwardRequest(
    service: string,
    path: string,
    method: string,
    headers: any,
    body?: any,
    query?: any
  ): Promise<ProxyResponse> {
    const serviceUrl = this.serviceUrls.get(service);
    if (!serviceUrl) {
      throw new Error(`Service ${service} không tồn tại`);
    }

    // Strip query string from path to avoid duplicate params (path already has ?cursor=... etc.)
    // Params are passed via `params` so axios handles encoding correctly.
    const [pathname] = path.split('?');
    const url = `${serviceUrl}${pathname}`;

    // Remove host header to avoid conflicts
    const requestHeaders = { ...headers };
    delete requestHeaders.host;
    delete requestHeaders['content-length'];

    const config: AxiosRequestConfig = {
      method: method as any,
      url,
      headers: requestHeaders,
      params: query,
      timeout: service === 'ai' ? this.aiProxyTimeoutMs : this.proxyTimeoutMs,
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      config.data = body;
    }

    try {
      const response = await this.requestWithRetry(config);
      return {
        status: response.status,
        data: response.data,
        headers: response.headers as Record<string, any>,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers as Record<string, any>,
        };
      }
      throw error;
    }
  }

  /**
   * Retry co kiem soat cho request tu API Gateway sang microservice noi bo.
   *
   * Luong xu ly:
   * 1. Gateway goi service dich voi timeout cau hinh. AI dung
   *    AI_PROXY_TIMEOUT_MS vi RAG co them buoc embedding va LLM generation.
   * 2. Neu request thanh cong thi tra ve ngay.
   * 3. Neu request loi tam thoi, Gateway cho PROXY_RETRY_DELAY_MS roi thu lai.
   * 4. Neu het so lan retry ma van loi, loi duoc nem ra de controller tra 503.
   *
   * Mac dinh production:
   * - timeout: 5000ms
   * - AI timeout: 120000ms
   * - retry delay: 3000ms
   * - retry attempts: 1
   */
  private async requestWithRetry(config: AxiosRequestConfig) {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.retryAttempts; attempt += 1) {
      try {
        return await axios(config);
      } catch (error) {
        lastError = error;
        if (!this.shouldRetry(config, error, attempt)) {
          throw error;
        }

        // Chi retry khi loi co kha nang la tam thoi.
        // Vi du: service noi bo dang restart, network loi ngan, timeout, hoac HTTP 5xx.
        // Delay 3 giay giup service co thoi gian khoi phuc truoc khi Gateway thu lai.
        await this.sleep(this.retryDelayMs);
      }
    }

    throw lastError;
  }

  /**
   * Dieu kien retry:
   * - Chi retry GET/HEAD vi day la request doc du lieu, it gay side effect.
   * - Khong retry POST/PUT/PATCH/DELETE de tranh tao duplicate data
   *   nhu gui trung tin nhan, upload trung file, tao trung ban ghi.
   * - Chi retry khi gap timeout, network error, hoac response 5xx.
   */
  private shouldRetry(config: AxiosRequestConfig, error: unknown, attempt: number) {
    if (attempt >= this.retryAttempts || !axios.isAxiosError(error)) return false;

    const method = String(config.method ?? 'GET').toUpperCase();
    const isSafeMethod = method === 'GET' || method === 'HEAD';
    if (!isSafeMethod) return false;

    const status = error.response?.status;
    const isTimeoutOrNetworkError = error.code === 'ECONNABORTED' || !error.response;
    const isServerError = typeof status === 'number' && status >= 500;

    return isTimeoutOrNetworkError || isServerError;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
