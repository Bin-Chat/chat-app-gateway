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
  JOIN_REQUESTED: 'chat.group.join_requested',
  JOIN_APPROVED: 'chat.group.join_approved',
  JOIN_DECLINED: 'chat.group.join_declined',
};

@Controller()
export class GroupEventsConsumer {
  private readonly logger = new Logger(GroupEventsConsumer.name);

  constructor(private readonly socketGateway: SocketGateway) {}

  @EventPattern(GROUP_EVENTS.MEMBERS_ADDED)
  handleMembersAdded(@Payload() event: any) {
    this.logger.log(
      `[group.members_added] conv=${event.conversationId} added=${event.addedUserIds?.length}`
    );
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'group:members_added', event);
    }
  }

  @EventPattern(GROUP_EVENTS.MEMBER_REMOVED)
  handleMemberRemoved(@Payload() event: any) {
    const removedUserId = event.removedUserId || event.removedMemberId;
    this.logger.log(`[group.member_removed] conv=${event.conversationId} removed=${removedUserId}`);
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'group:member_removed', event);
    }
    // Also notify the removed user
    if (!event.participants.includes(removedUserId)) {
      this.socketGateway.emitToUser(removedUserId, 'group:member_removed', event);
    }
  }

  @EventPattern(GROUP_EVENTS.MEMBER_LEFT)
  handleMemberLeft(@Payload() event: any) {
    this.logger.log(`[group.member_left] conv=${event.conversationId} user=${event.userId}`);
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
      `[group.role_changed] conv=${event.conversationId} target=${event.targetUserId} role=${event.newRole}`
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
      `[group.owner_transferred] conv=${event.conversationId} new_owner=${event.newOwnerId}`
    );
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'group:owner_transferred', event);
    }
  }

  @EventPattern(GROUP_EVENTS.JOIN_REQUESTED)
  handleJoinRequested(@Payload() event: any) {
    this.logger.log(
      `[group.join_requested] conv=${event.conversationId} requester=${event.requesterId}`
    );
    // Notify each admin/owner so they can see the pending request
    for (const adminId of event.adminIds ?? []) {
      this.socketGateway.emitToUser(adminId, 'group:join_requested', event);
    }
  }

  @EventPattern(GROUP_EVENTS.JOIN_APPROVED)
  handleJoinApproved(@Payload() event: any) {
    this.logger.log(
      `[group.join_approved] conv=${event.conversationId} requester=${event.requesterId}`
    );
    // Notify the approved user
    this.socketGateway.emitToUser(event.requesterId, 'group:join_approved', event);
    // Also refresh group membership for all existing participants (triggers members_added logic)
    for (const userId of event.allParticipantIds ?? []) {
      this.socketGateway.emitToUser(userId, 'group:members_added', {
        conversationId: event.conversationId,
        addedBy: event.approvedBy,
        newMemberIds: [event.requesterId],
        participants: event.allParticipantIds,
      });
    }
  }

  @EventPattern(GROUP_EVENTS.JOIN_DECLINED)
  handleJoinDeclined(@Payload() event: any) {
    this.logger.log(
      `[group.join_declined] conv=${event.conversationId} requester=${event.requesterId}`
    );
    // Notify only the declined user
    this.socketGateway.emitToUser(event.requesterId, 'group:join_declined', event);
  }
}
