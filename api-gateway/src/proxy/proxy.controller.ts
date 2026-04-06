import { All, Controller, Req, Res, Get, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller()
export class ProxyController {
  constructor(private proxyService: ProxyService) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'API Gateway',
      timestamp: new Date().toISOString(),
    };
  }

  // Public routes - Auth service
  @All('auth/*')
  async proxyAuth(@Req() req: Request, @Res() res: Response) {
    const path = req.url;
    return this.forwardToService('auth', path, req, res);
  }

  // User service (protected)
  @UseGuards(JwtAuthGuard)
  @All('users/*')
  async proxyUser(@Req() req: Request, @Res() res: Response) {
    const path = req.url;
    return this.forwardToService('user', path, req, res);
  }

  // Friend service (protected) - exact match for GET /api/friends
  @UseGuards(JwtAuthGuard)
  @All('friends')
  async proxyFriendBase(@Req() req: Request, @Res() res: Response) {
    return this.forwardToService('friend', req.url, req, res);
  }

  // Friend service (protected) - sub-paths like /friends/requests/received
  @UseGuards(JwtAuthGuard)
  @All('friends/*')
  async proxyFriend(@Req() req: Request, @Res() res: Response) {
    return this.forwardToService('friend', req.url, req, res);
  }

  // Upload service — presign and finalize (protected)
  @UseGuards(JwtAuthGuard)
  @All('uploads')
  async proxyUploadBase(@Req() req: Request, @Res() res: Response) {
    return this.forwardToService('upload', req.url, req, res);
  }

  @UseGuards(JwtAuthGuard)
  @All('uploads/*')
  async proxyUpload(@Req() req: Request, @Res() res: Response) {
    return this.forwardToService('upload', req.url, req, res);
  }

  // Chat service (protected)
  @UseGuards(JwtAuthGuard)
  @All('chat')
  async proxyChatBase(@Req() req: Request, @Res() res: Response) {
    return this.forwardToService('chat', req.url, req, res);
  }

  @UseGuards(JwtAuthGuard)
  @All('chat/*')
  async proxyChat(@Req() req: Request, @Res() res: Response) {
    return this.forwardToService('chat', req.url, req, res);
  }

  //   private async forwardToService(
  //   service: string,    // Tên service cần gọi
  //   path: string,       // Đường dẫn API
  //   req: Request,       // Request object từ client
  //   res: Response       // Response object để trả về client
  // )
  // Hàm này sẽ sử dụng ProxyService để chuyển tiếp yêu cầu từ client đến microservice tương ứng
  private async forwardToService(service: string, path: string, req: Request, res: Response) {
    try {
      const result = await this.proxyService.forwardRequest(
        service,
        path,
        req.method,
        req.headers,
        req.body,
        req.query
      );

      // Set response headers (bao gồm cookies)
      Object.keys(result.headers).forEach((key) => {
        const lowerKey = key.toLowerCase();
        // Forward Set-Cookie headers để client nhận được cookies
        if (lowerKey === 'set-cookie') {
          const cookies = result.headers[key];
          if (Array.isArray(cookies)) {
            cookies.forEach((cookie) => res.append('Set-Cookie', cookie));
          } else {
            res.setHeader('Set-Cookie', cookies);
          }
        }
        // Skip encoding headers
        else if (!['content-encoding', 'transfer-encoding'].includes(lowerKey)) {
          res.setHeader(key, result.headers[key]);
        }
      });

      return res.status(result.status).json(result.data);
    } catch (error) {
      console.error(`Error forwarding to ${service}:`, error.message);
      return res.status(503).json({
        statusCode: 503,
        message: `Service ${service} không khả dụng`,
        error: 'Service Unavailable',
      });
    }
  }
}
