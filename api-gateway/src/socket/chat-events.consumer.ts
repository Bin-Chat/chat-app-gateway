import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { SocketGateway } from './socket.gateway';

const CHAT_EVENTS = {
  MESSAGE_CREATED: 'chat.message.created',
  MESSAGE_REVOKED: 'chat.message.revoked',
  MESSAGE_EDITED: 'chat.message.edited',
  MESSAGE_PINNED: 'chat.message.pinned',
  MESSAGE_UNPINNED: 'chat.message.unpinned',
  CONVERSATION_UPDATED: 'chat.conversation.updated',
  CONVERSATION_SETTINGS_UPDATED: 'chat.conversation.settings_updated',
  REACTION_TOGGLED: 'chat.reaction.toggled',
  MEMBER_BANNED: 'chat.member.banned',
  MEMBER_UNBANNED: 'chat.member.unbanned',
};

@Controller()
export class ChatEventsConsumer {
  private readonly logger = new Logger(ChatEventsConsumer.name);

  constructor(private readonly socketGateway: SocketGateway) {}

  @EventPattern(CHAT_EVENTS.MESSAGE_CREATED)
  handleMessageCreated(@Payload() event: any) {
    this.logger.log(
      `[chat.message.created] conv=${event.conversationId} sender=${event.senderId}`,
    );
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'message:new', event);
    }
  }

  @EventPattern(CHAT_EVENTS.MESSAGE_REVOKED)
  handleMessageRevoked(@Payload() event: any) {
    this.logger.log(
      `[chat.message.revoked] msg=${event.messageId} conv=${event.conversationId}`,
    );
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'message:revoked', event);
    }
  }

  @EventPattern(CHAT_EVENTS.MESSAGE_EDITED)
  handleMessageEdited(@Payload() event: any) {
    this.logger.log(`[chat.message.edited] msg=${event.messageId}`);
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'message:edited', event);
    }
  }

  @EventPattern(CHAT_EVENTS.MESSAGE_PINNED)
  handleMessagePinned(@Payload() event: any) {
    this.logger.log(`[chat.message.pinned] msg=${event.messageId}`);
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'message:pinned', event);
    }
  }

  @EventPattern(CHAT_EVENTS.MESSAGE_UNPINNED)
  handleMessageUnpinned(@Payload() event: any) {
    this.logger.log(`[chat.message.unpinned] msg=${event.messageId}`);
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'message:unpinned', event);
    }
  }

  @EventPattern(CHAT_EVENTS.CONVERSATION_UPDATED)
  handleConversationUpdated(@Payload() event: any) {
    this.logger.log(`[chat.conversation.updated] conv=${event.conversationId}`);
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'conversation:updated', event);
    }
  }

  @EventPattern(CHAT_EVENTS.CONVERSATION_SETTINGS_UPDATED)
  handleSettingsUpdated(@Payload() event: any) {
    this.logger.log(`[chat.conversation.settings_updated] conv=${event.conversationId}`);
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'conversation:settings', event);
    }
  }

  @EventPattern(CHAT_EVENTS.REACTION_TOGGLED)
  handleReactionToggled(@Payload() event: any) {
    this.logger.log(`[chat.reaction.toggled] msg=${event.messageId} ${event.action}`);
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'message:reaction', event);
    }
  }

  @EventPattern(CHAT_EVENTS.MEMBER_BANNED)
  handleMemberBanned(@Payload() event: any) {
    this.logger.log(`[chat.member.banned] conv=${event.conversationId} member=${event.memberId}`);
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'member:banned', event);
    }
  }

  @EventPattern(CHAT_EVENTS.MEMBER_UNBANNED)
  handleMemberUnbanned(@Payload() event: any) {
    this.logger.log(`[chat.member.unbanned] conv=${event.conversationId} member=${event.memberId}`);
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'member:unbanned', event);
    }
  }
}
