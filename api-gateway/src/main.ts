import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // CORS with credentials (để gửi/nhận cookies)
  const corsOrigins = configService.get('CORS_ORIGIN')?.split(',') || ['http://localhost:5173'];
  app.enableCors({
    origin: (origin, callback) => {
      // Native mobile apps (Expo Go / bare RN) send no Origin header
      if (!origin) return callback(null, true);
      // Listed origins (web app, Expo web, etc.)
      if (corsOrigins.includes(origin)) return callback(null, true);
      // Any localhost port — safe for local development
      if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  });

  // Kafka microservice for consuming friend events
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'api-gateway',
        brokers: [configService.get('KAFKA_BROKER', 'redpanda:9092')],
      },
      consumer: {
        groupId: 'api-gateway-friend-events',
      },
    },
  });

  // Cookie parser middleware
  app.use(cookieParser());

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Global prefix
  app.setGlobalPrefix('api');

  await app.startAllMicroservices();

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
