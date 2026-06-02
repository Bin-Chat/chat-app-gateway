import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDurationSeconds: Histogram<string>;

  constructor() {
    this.registry.setDefaultLabels({
      app: 'binchat',
      service: 'api-gateway',
    });

    collectDefaultMetrics({
      register: this.registry,
      prefix: 'binchat_gateway_',
    });

    this.httpRequestsTotal = new Counter({
      name: 'binchat_http_requests_total',
      help: 'Tong so HTTP request di qua API Gateway',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDurationSeconds = new Histogram({
      name: 'binchat_http_request_duration_seconds',
      help: 'Thoi gian xu ly HTTP request tai API Gateway tinh bang giay',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });
  }

  getContentType() {
    return this.registry.contentType;
  }

  async getMetrics() {
    return this.registry.metrics();
  }

  recordHttpRequest(method: string, route: string, statusCode: number, durationSeconds: number) {
    const labels = {
      method,
      route: this.normalizeRoute(route),
      status_code: String(statusCode),
    };

    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, durationSeconds);
  }

  private normalizeRoute(route: string) {
    return route
      .split('?')[0]
      .replace(/\/[0-9a-fA-F]{24}(?=\/|$)/g, '/:objectId')
      .replace(
        /\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?=\/|$)/g,
        '/:uuid'
      )
      .replace(/\/\d+(?=\/|$)/g, '/:id');
  }
}
