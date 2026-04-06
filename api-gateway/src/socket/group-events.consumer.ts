import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { SocketGateway } from './socket.gateway';

const GROUP_EVENTS = {
  MEMBERS_ADDED: 'chat.group.members_added',
  MEMBER_REMOVED: 'chat.group.member_removed',
  MEMBER_LEFT: 'chat.group.member_left',
  UPDATED: 'chat.group.updated',
  ROLE_CHANGED: 'chat.group.role_changed',
  DISSOLVED: 'chat.group.dissolved',
  OWNER_TRANSFERRED: 'chat.group.owner_transferred',
};

@Controller()
export class GroupEventsConsumer {
  private readonly logger = new Logger(GroupEventsConsumer.name);

  constructor(private readonly socketGateway: SocketGateway) {}

  @EventPattern(GROUP_EVENTS.MEMBERS_ADDED)
  handleMembersAdded(@Payload() event: any) {
    this.logger.log(
      `[group.members_added] conv=${event.conversationId} added=${event.addedUserIds?.length}`,
    );
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'group:members_added', event);
    }
  }

  @EventPattern(GROUP_EVENTS.MEMBER_REMOVED)
  handleMemberRemoved(@Payload() event: any) {
    this.logger.log(
      `[group.member_removed] conv=${event.conversationId} removed=${event.removedUserId}`,
    );
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'group:member_removed', event);
    }
    // Also notify the removed user
    if (!event.participants.includes(event.removedUserId)) {
      this.socketGateway.emitToUser(event.removedUserId, 'group:member_removed', event);
    }
  }

  @EventPattern(GROUP_EVENTS.MEMBER_LEFT)
  handleMemberLeft(@Payload() event: any) {
    this.logger.log(
      `[group.member_left] conv=${event.conversationId} user=${event.userId}`,
    );
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'group:member_left', event);
    }
  }

  @EventPattern(GROUP_EVENTS.UPDATED)
  handleGroupUpdated(@Payload() event: any) {
    this.logger.log(`[group.updated] conv=${event.conversationId}`);
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'group:updated', event);
    }
  }

  @EventPattern(GROUP_EVENTS.ROLE_CHANGED)
  handleRoleChanged(@Payload() event: any) {
    this.logger.log(
      `[group.role_changed] conv=${event.conversationId} target=${event.targetUserId} role=${event.newRole}`,
    );
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'group:role_changed', event);
    }
  }

  @EventPattern(GROUP_EVENTS.DISSOLVED)
  handleGroupDissolved(@Payload() event: any) {
    this.logger.log(`[group.dissolved] conv=${event.conversationId}`);
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'group:dissolved', event);
    }
  }

  @EventPattern(GROUP_EVENTS.OWNER_TRANSFERRED)
  handleOwnerTransferred(@Payload() event: any) {
    this.logger.log(
      `[group.owner_transferred] conv=${event.conversationId} new_owner=${event.newOwnerId}`,
    );
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'group:owner_transferred', event);
    }
  }
}
