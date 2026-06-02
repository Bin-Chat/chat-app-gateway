import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async metrics(@Res() res: Response) {
    res.setHeader('Content-Type', this.metricsService.getContentType());
    return res.send(await this.metricsService.getMetrics());
  }
}
