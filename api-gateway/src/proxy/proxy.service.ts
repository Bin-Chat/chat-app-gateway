import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosRequestConfig } from 'axios';

interface ProxyResponse {
  status: number;
  data: any;
  headers: Record<string, any>;
}

@Injectable()
export class ProxyService {
  private readonly serviceUrls: Map<string, string>;

  constructor(private configService: ConfigService) {
    this.serviceUrls = new Map([['auth', this.configService.get('AUTH_SERVICE_URL')]]);
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

    const url = `${serviceUrl}${path}`;

    // Remove host header to avoid conflicts
    const requestHeaders = { ...headers };
    delete requestHeaders.host;
    delete requestHeaders['content-length'];

    const config: AxiosRequestConfig = {
      method: method as any,
      url,
      headers: requestHeaders,
      params: query,
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      config.data = body;
    }

    try {
      const response = await axios(config);
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
}
