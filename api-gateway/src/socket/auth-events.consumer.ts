import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { SocketGateway } from './socket.gateway';

const SESSION_KICKED = 'auth.session.kicked';

interface SessionKickedEvent {
  userId: string;
  deviceType: 'mobile' | 'web';
}

@Controller()
export class AuthEventsConsumer {
  private readonly logger = new Logger(AuthEventsConsumer.name);

  constructor(private readonly socketGateway: SocketGateway) {}

  @EventPattern(SESSION_KICKED)
  handleSessionKicked(@Payload() event: SessionKickedEvent) {
    this.logger.log(`[auth.session.kicked] userId=${event.userId} deviceType=${event.deviceType}`);
    // Gửi event kèm deviceType — frontend chỉ logout nếu deviceType khớp
    this.socketGateway.emitToUser(event.userId, 'session:kicked', {
      deviceType: event.deviceType,
      reason:
        'Tài khoản vừa đăng nhập ở thiết bị khác cùng loại. Phiên đăng nhập hiện tại đã hết hiệu lực.',
    });
  }
}
