import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProxyModule } from './proxy/proxy.module';
import { AuthModule } from './auth/auth.module';
import { SocketModule } from './socket/socket.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, ProxyModule, SocketModule],
})
export class AppModule {}
