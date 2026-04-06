import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { FriendEventsConsumer } from './friend-events.consumer';
import { ChatEventsConsumer } from './chat-events.consumer';
import { GroupEventsConsumer } from './group-events.consumer';
import { SocketGateway } from './socket.gateway';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_CLIENT',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'api-gateway-consumer',
              brokers: [config.get('KAFKA_BROKER', 'redpanda:9092')],
            },
            consumer: {
              groupId: 'api-gateway-events',
            },
          },
        }),
      },
    ]),
  ],
  providers: [SocketGateway, FriendEventsConsumer, ChatEventsConsumer, GroupEventsConsumer],
  controllers: [FriendEventsConsumer, ChatEventsConsumer, GroupEventsConsumer],
})
export class SocketModule {}
