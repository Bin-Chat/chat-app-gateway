import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { SocketGateway } from './socket.gateway';

const FRIEND_EVENTS = {
  REQUEST_SENT: 'friend.request.sent',
  REQUEST_ACCEPTED: 'friend.request.accepted',
  REQUEST_DECLINED: 'friend.request.declined',
  REQUEST_CANCELLED: 'friend.request.cancelled',
  UNFRIENDED: 'friend.unfriended',
};

interface FriendRequestSentEvent {
  friendshipId: string;
  requesterId: string;
  addresseeId: string;
  sentAt: Date;
}

interface FriendRequestAcceptedEvent {
  friendshipId: string;
  requesterId: string;
  addresseeId: string;
  acceptedAt: Date;
}

interface FriendRequestDeclinedEvent {
  friendshipId: string;
  requesterId: string;
  addresseeId: string;
}

interface FriendRequestCancelledEvent {
  friendshipId: string;
  requesterId: string;
  addresseeId: string;
}

interface FriendUnfriendedEvent {
  userId: string;
  formerFriendId: string;
}

@Controller()
export class FriendEventsConsumer {
  private readonly logger = new Logger(FriendEventsConsumer.name);

  constructor(private readonly socketGateway: SocketGateway) {}

  @EventPattern(FRIEND_EVENTS.REQUEST_SENT)
  handleRequestSent(@Payload() event: FriendRequestSentEvent) {
    this.logger.log(`[friend.request.sent] ${event.requesterId} → ${event.addresseeId}`);
    // Notify the addressee that they received a new friend request
    this.socketGateway.emitToUser(event.addresseeId, 'friend:request_received', event);
  }

  @EventPattern(FRIEND_EVENTS.REQUEST_ACCEPTED)
  handleRequestAccepted(@Payload() event: FriendRequestAcceptedEvent) {
    this.logger.log(`[friend.request.accepted] friendship=${event.friendshipId}`);
    // Notify the requester that their request was accepted
    this.socketGateway.emitToUser(event.requesterId, 'friend:request_accepted', event);
    // Also notify the acceptor (addressee) to refresh their friends list
    this.socketGateway.emitToUser(event.addresseeId, 'friend:request_accepted', event);
  }

  @EventPattern(FRIEND_EVENTS.REQUEST_DECLINED)
  handleRequestDeclined(@Payload() event: FriendRequestDeclinedEvent) {
    this.logger.log(`[friend.request.declined] friendship=${event.friendshipId}`);
    // Notify the requester that their request was declined
    this.socketGateway.emitToUser(event.requesterId, 'friend:request_declined', event);
  }

  @EventPattern(FRIEND_EVENTS.REQUEST_CANCELLED)
  handleRequestCancelled(@Payload() event: FriendRequestCancelledEvent) {
    this.logger.log(`[friend.request.cancelled] friendship=${event.friendshipId}`);
    // Notify the addressee that the pending request was cancelled
    this.socketGateway.emitToUser(event.addresseeId, 'friend:request_cancelled', event);
  }

  @EventPattern(FRIEND_EVENTS.UNFRIENDED)
  handleUnfriended(@Payload() event: FriendUnfriendedEvent) {
    this.logger.log(`[friend.unfriended] ${event.userId} unfriended ${event.formerFriendId}`);
    // Notify both parties
    this.socketGateway.emitToUser(event.userId, 'friend:unfriended', event);
    this.socketGateway.emitToUser(event.formerFriendId, 'friend:unfriended', event);
  }
}
