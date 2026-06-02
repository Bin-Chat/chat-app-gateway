import { All, Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import axios from 'axios';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { ProxyService } from './proxy.service';

const RATE_LIMIT = {
  health: { default: { ttl: 60_000, limit: 300 } },
  authSensitive: { default: { ttl: 60_000, limit: 10 } }, // này là cho các endpoint auth dễ bị brute force như login, OTP, register, forgot-password, reset-password, v.v.
  authGeneral: { default: { ttl: 60_000, limit: 60 } }, // này là cho các endpoint auth còn lại như refresh token, verify OTP, resend verification, v.v. có thể thoáng hơn login/OTP nhưng vẫn cần limit để tránh spam.
  userSearch: { default: { ttl: 60_000, limit: 60 } },
  friend: { default: { ttl: 60_000, limit: 120 } },
  upload: { default: { ttl: 60_000, limit: 240 } },
  chat: { default: { ttl: 60_000, limit: 240 } },
  ai: { default: { ttl: 60_000, limit: 20 } },
};

@Controller()
export class ProxyController {
  constructor(private proxyService: ProxyService) {}

  @Throttle(RATE_LIMIT.health)
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'API Gateway',
      timestamp: new Date().toISOString(),
    };
  }

  // Auth endpoints de bi brute force/spam email nen limit chat hon global limit.
  @Throttle(RATE_LIMIT.authSensitive)
  @All([
    'auth/login',
    'auth/register',
    'auth/refresh',
    'auth/forgot-password',
    'auth/reset-password',
    'auth/send-otp',
    'auth/verify-otp',
    'auth/resend-verification',
  ])
  async proxySensitiveAuth(@Req() req: Request, @Res() res: Response) {
    return this.forwardToService('auth', req.url, req, res);
  }

  // Cac auth endpoint con lai van co limit rieng, nhung thoang hon login/OTP.
  @Throttle(RATE_LIMIT.authGeneral)
  @All('auth/*')
  async proxyAuth(@Req() req: Request, @Res() res: Response) {
    return this.forwardToService('auth', req.url, req, res);
  }

  // Search user de bi spam khi go ten lien tuc, nen tach limit rieng.
  @Throttle(RATE_LIMIT.userSearch)
  @UseGuards(JwtAuthGuard)
  @All('users/search')
  async proxyUserSearch(@Req() req: Request, @Res() res: Response) {
    return this.forwardToService('user', req.url, req, res);
  }

  @UseGuards(JwtAuthGuard)
  @All('users/*')
  async proxyUser(@Req() req: Request, @Res() res: Response) {
    return this.forwardToService('user', req.url, req, res);
  }

  @Throttle(RATE_LIMIT.friend)
  @UseGuards(JwtAuthGuard)
  @All('friends')
  async proxyFriendBase(@Req() req: Request, @Res() res: Response) {
    return this.forwardToService('friend', req.url, req, res);
  }

  @Throttle(RATE_LIMIT.friend)
  @UseGuards(JwtAuthGuard)
  @All('friends/*')
  async proxyFriend(@Req() req: Request, @Res() res: Response) {
    return this.forwardToService('friend', req.url, req, res);
  }

  @Throttle(RATE_LIMIT.upload)
  @UseGuards(JwtAuthGuard)
  @All('uploads')
  async proxyUploadBase(@Req() req: Request, @Res() res: Response) {
    return this.forwardToService('upload', req.url, req, res);
  }

  @Throttle(RATE_LIMIT.upload)
  @UseGuards(JwtAuthGuard)
  @All('uploads/*')
  async proxyUpload(@Req() req: Request, @Res() res: Response) {
    return this.forwardToService('upload', req.url, req, res);
  }

  @Throttle(RATE_LIMIT.chat)
  @UseGuards(JwtAuthGuard)
  @All('chat')
  async proxyChatBase(@Req() req: Request, @Res() res: Response) {
    return this.forwardToService('chat', req.url, req, res);
  }

  @Throttle(RATE_LIMIT.chat)
  @UseGuards(JwtAuthGuard)
  @All('chat/*')
  async proxyChat(@Req() req: Request, @Res() res: Response) {
    return this.forwardToService('chat', req.url, req, res);
  }

  @Throttle(RATE_LIMIT.ai)
  @UseGuards(JwtAuthGuard, AdminGuard)
  @All('ai/documents')
  async proxyAiAdminDocumentsBase(@Req() req: Request, @Res() res: Response) {
    return this.forwardToService('ai', req.url, req, res);
  }

  @Throttle(RATE_LIMIT.ai)
  @UseGuards(JwtAuthGuard, AdminGuard)
  @All('ai/documents/*')
  async proxyAiAdminDocuments(@Req() req: Request, @Res() res: Response) {
    return this.forwardToService('ai', req.url, req, res);
  }

  @Throttle(RATE_LIMIT.ai)
  @UseGuards(JwtAuthGuard)
  @All('ai')
  async proxyAiBase(@Req() req: Request, @Res() res: Response) {
    return this.forwardToService('ai', req.url, req, res);
  }

  @Throttle(RATE_LIMIT.ai)
  @UseGuards(JwtAuthGuard)
  @All('ai/*')
  async proxyAi(@Req() req: Request, @Res() res: Response) {
    return this.forwardToService('ai', req.url, req, res);
  }

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

      Object.keys(result.headers).forEach((key) => {
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'set-cookie') {
          const cookies = result.headers[key];
          if (Array.isArray(cookies)) {
            cookies.forEach((cookie) => res.append('Set-Cookie', cookie));
          } else {
            res.setHeader('Set-Cookie', cookies);
          }
        } else if (!['content-encoding', 'transfer-encoding'].includes(lowerKey)) {
          res.setHeader(key, result.headers[key]);
        }
      });

      return res.status(result.status).json(result.data);
    } catch (error) {
      console.error(`Error forwarding to ${service}:`, error.message);
      const timedOut = axios.isAxiosError(error) && error.code === 'ECONNABORTED';
      const statusCode = timedOut ? 504 : 503;
      return res.status(statusCode).json({
        statusCode,
        message: timedOut
          ? `Service ${service} dang xu ly lau hon du kien. Vui long thu lai.`
          : `Service ${service} khong kha dung`,
        error: timedOut ? 'Gateway Timeout' : 'Service Unavailable',
      });
    }
  }
}
