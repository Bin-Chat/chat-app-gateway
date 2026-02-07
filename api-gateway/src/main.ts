import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // CORS with credentials (để gửi/nhận cookies)
  const corsOrigins = configService.get('CORS_ORIGIN')?.split(',') || ['http://localhost:5173'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Cookie parser middleware
  app.use(cookieParser());

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Global prefix
  app.setGlobalPrefix('api');

  const port = configService.get('PORT') || 3000;
  await app.listen(port);
  console.log(`🚀 API Gateway running on port ${port}`);
  console.log(`📡 Routes:`);
  console.log(`   - /api/auth/*    → Auth Service`);
  console.log(`   - /api/chat/*    → Chat Service`);
  console.log(`   - /api/presence/* → Presence Service`);
  console.log(`   - /api/realtime/* → Realtime Gateway`);
  console.log(`   - /api/media/*   → Media Processor`);
}
bootstrap();
