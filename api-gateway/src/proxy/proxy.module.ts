import { Module } from '@nestjs/common';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';
import { AdminGuard } from '../auth/admin.guard';

@Module({
  controllers: [ProxyController],
  providers: [ProxyService, AdminGuard],
})
export class ProxyModule {}
