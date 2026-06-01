import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { SocketGateway } from './socket.gateway';

const SESSION_KICKED = 'auth.session.kicked';

interface SessionKickedEvent {
  userId: string;
  deviceType: 'mobile' | 'web';
  reasonCode?: 'account_locked' | 'role_changed' | 'device_replaced' | 'remote_logout';
  reason?: string;
}

@Controller()
export class AuthEventsConsumer {
  private readonly logger = new Logger(AuthEventsConsumer.name);

  constructor(private readonly socketGateway: SocketGateway) {}

  @EventPattern(SESSION_KICKED)
  handleSessionKicked(@Payload() event: SessionKickedEvent) {
    this.logger.log(`[auth.session.kicked] userId=${event.userId} deviceType=${event.deviceType}`);
    this.socketGateway.emitToUser(event.userId, 'session:kicked', {
      deviceType: event.deviceType,
      reasonCode: event.reasonCode ?? 'device_replaced',
      reason:
        event.reason ??
        'Tài khoản vừa đăng nhập ở thiết bị khác cùng loại. Phiên đăng nhập hiện tại đã hết hiệu lực.',
    });
  }
}
