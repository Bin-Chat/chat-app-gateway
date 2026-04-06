import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { SocketGateway } from './socket.gateway';

const CHAT_EVENTS = {
  MESSAGE_CREATED: 'chat.message.created',
  MESSAGE_REVOKED: 'chat.message.revoked',
  CONVERSATION_UPDATED: 'chat.conversation.updated',
  REACTION_TOGGLED: 'chat.reaction.toggled',
};

interface MessageCreatedEvent {
  messageId: string;
  conversationId: string;
  senderId: string;
  participants: string[];
  content: string;
  type: string;
  attachments: any[];
  replyTo?: {
    messageId: string;
    senderId: string;
    content: string;
    attachmentType?: string;
  } | null;
  createdAt: Date;
}

interface MessageRevokedEvent {
  messageId: string;
  conversationId: string;
  senderId: string;
  participants: string[];
  revokedAt: Date;
}

interface ConversationUpdatedEvent {
  conversationId: string;
  participants: string[];
  lastMessage: {
    senderId: string;
    content: string;
    type: string;
    sentAt: Date;
  };
}

interface ReactionToggledEvent {
  messageId: string;
  conversationId: string;
  participants: string[];
  userId: string;
  emoji: string;
  action: 'added' | 'removed';
}

@Controller()
export class ChatEventsConsumer {
  private readonly logger = new Logger(ChatEventsConsumer.name);

  constructor(private readonly socketGateway: SocketGateway) {}

  @EventPattern(CHAT_EVENTS.MESSAGE_CREATED)
  handleMessageCreated(@Payload() event: MessageCreatedEvent) {
    this.logger.log(
      `[chat.message.created] conv=${event.conversationId} sender=${event.senderId}`,
    );
    // Notify all participants
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'message:new', event);
    }
  }

  @EventPattern(CHAT_EVENTS.MESSAGE_REVOKED)
  handleMessageRevoked(@Payload() event: MessageRevokedEvent) {
    this.logger.log(
      `[chat.message.revoked] msg=${event.messageId} conv=${event.conversationId}`,
    );
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'message:revoked', event);
    }
  }

  @EventPattern(CHAT_EVENTS.CONVERSATION_UPDATED)
  handleConversationUpdated(@Payload() event: ConversationUpdatedEvent) {
    this.logger.log(`[chat.conversation.updated] conv=${event.conversationId}`);
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'conversation:updated', event);
    }
  }

  @EventPattern(CHAT_EVENTS.REACTION_TOGGLED)
  handleReactionToggled(@Payload() event: ReactionToggledEvent) {
    this.logger.log(`[chat.reaction.toggled] msg=${event.messageId} ${event.action}`);
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'message:reaction', event);
    }
  }
}
