import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { SocketGateway } from './socket.gateway';

const CHAT_EVENTS = {
  MESSAGE_CREATED: 'chat.message.created',
  MESSAGE_REVOKED: 'chat.message.revoked',
  MESSAGE_RESTORED: 'chat.message.restored',
  MESSAGE_EDITED: 'chat.message.edited',
  MESSAGE_PINNED: 'chat.message.pinned',
  MESSAGE_UNPINNED: 'chat.message.unpinned',
  CONVERSATION_UPDATED: 'chat.conversation.updated',
  CONVERSATION_SETTINGS_UPDATED: 'chat.conversation.settings_updated',
  REACTION_TOGGLED: 'chat.reaction.toggled',
  MEMBER_BANNED: 'chat.member.banned',
  MEMBER_UNBANNED: 'chat.member.unbanned',
  REMINDER_FIRED: 'chat.reminder.fired',
  REMINDER_UPDATED: 'chat.reminder.updated',
  REMINDER_DELETED: 'chat.reminder.deleted',
  NOTE_CREATED: 'chat.note.created',
  NOTE_UPDATED: 'chat.note.updated',
  NOTE_DELETED: 'chat.note.deleted',
  POLL_CREATED: 'chat.poll.created',
  POLL_VOTED: 'chat.poll.voted',
  POLL_OPTION_ADDED: 'chat.poll.option_added',
  POLL_UPDATED: 'chat.poll.updated',
  POLL_CLOSED: 'chat.poll.closed',
  POLL_DELETED: 'chat.poll.deleted',
  TASK_CREATED: 'chat.task.created',
  TASK_UPDATED: 'chat.task.updated',
  TASK_COMPLETED: 'chat.task.completed',
  TASK_DELETED: 'chat.task.deleted',
  TASK_ASSIGNED: 'chat.task.assigned',
};

@Controller()
export class ChatEventsConsumer {
  private readonly logger = new Logger(ChatEventsConsumer.name);

  constructor(private readonly socketGateway: SocketGateway) {}

  @EventPattern(CHAT_EVENTS.MESSAGE_CREATED)
  handleMessageCreated(@Payload() event: any) {
    this.logger.log(`[chat.message.created] conv=${event.conversationId} sender=${event.senderId}`);
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'message:new', event);
    }
  }

  @EventPattern(CHAT_EVENTS.MESSAGE_REVOKED)
  handleMessageRevoked(@Payload() event: any) {
    this.logger.log(`[chat.message.revoked] msg=${event.messageId} conv=${event.conversationId}`);
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'message:revoked', event);
    }
  }

  @EventPattern(CHAT_EVENTS.MESSAGE_RESTORED)
  handleMessageRestored(@Payload() event: any) {
    this.logger.log(`[chat.message.restored] msg=${event.messageId} conv=${event.conversationId}`);
    for (const userId of event.participants) {
      this.socketGateway.emitToUser(userId, 'message:restored', event);
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

  @EventPattern(CHAT_EVENTS.REMINDER_FIRED)
  handleReminderFired(@Payload() event: any) {
    this.logger.log(
      `[chat.reminder.fired] reminder=${event.reminderId} conv=${event.conversationId}`
    );
    for (const userId of event.participantIds) {
      this.socketGateway.emitToUser(userId, 'reminder:fire', {
        reminderId: event.reminderId,
        conversationId: event.conversationId,
        content: event.content,
        remindAt: event.remindAt,
        repeat: event.repeat,
        createdBy: event.createdBy,
      });
    }
  }

  @EventPattern(CHAT_EVENTS.REMINDER_UPDATED)
  handleReminderUpdated(@Payload() event: any) {
    this.logger.log(
      `[chat.reminder.updated] reminder=${event.reminderId} conv=${event.conversationId}`
    );
    for (const userId of event.participantIds) {
      this.socketGateway.emitToUser(userId, 'reminder:updated', {
        reminderId: event.reminderId,
        conversationId: event.conversationId,
        reminder: event.reminder,
      });
    }
  }

  @EventPattern(CHAT_EVENTS.REMINDER_DELETED)
  handleReminderDeleted(@Payload() event: any) {
    this.logger.log(
      `[chat.reminder.deleted] reminder=${event.reminderId} conv=${event.conversationId}`
    );
    for (const userId of event.participantIds) {
      this.socketGateway.emitToUser(userId, 'reminder:deleted', {
        reminderId: event.reminderId,
        conversationId: event.conversationId,
      });
    }
  }

  @EventPattern(CHAT_EVENTS.NOTE_CREATED)
  handleNoteCreated(@Payload() event: any) {
    this.logger.log(`[chat.note.created] note=${event.noteId} conv=${event.conversationId}`);
    for (const userId of event.participantIds ?? []) {
      this.socketGateway.emitToUser(userId, 'note:created', {
        noteId: event.noteId,
        conversationId: event.conversationId,
        note: event.note,
      });
    }
  }

  @EventPattern(CHAT_EVENTS.NOTE_UPDATED)
  handleNoteUpdated(@Payload() event: any) {
    this.logger.log(`[chat.note.updated] note=${event.noteId} conv=${event.conversationId}`);
    for (const userId of event.participantIds ?? []) {
      this.socketGateway.emitToUser(userId, 'note:updated', {
        noteId: event.noteId,
        conversationId: event.conversationId,
        note: event.note,
      });
    }
  }

  @EventPattern(CHAT_EVENTS.NOTE_DELETED)
  handleNoteDeleted(@Payload() event: any) {
    this.logger.log(`[chat.note.deleted] note=${event.noteId} conv=${event.conversationId}`);
    for (const userId of event.participantIds ?? []) {
      this.socketGateway.emitToUser(userId, 'note:deleted', {
        noteId: event.noteId,
        conversationId: event.conversationId,
      });
    }
  }

  @EventPattern(CHAT_EVENTS.POLL_CREATED)
  handlePollCreated(@Payload() event: any) {
    this.logger.log(`[chat.poll.created] poll=${event.pollId} conv=${event.conversationId}`);
    for (const userId of event.participantIds ?? []) {
      this.socketGateway.emitToUser(userId, 'poll:created', {
        pollId: event.pollId,
        messageId: event.messageId,
        conversationId: event.conversationId,
        poll: event.poll,
      });
    }
  }

  @EventPattern(CHAT_EVENTS.POLL_VOTED)
  handlePollVoted(@Payload() event: any) {
    this.logger.log(`[chat.poll.voted] poll=${event.pollId} conv=${event.conversationId}`);
    for (const userId of event.participantIds ?? []) {
      this.socketGateway.emitToUser(userId, 'poll:voted', {
        pollId: event.pollId,
        messageId: event.messageId,
        conversationId: event.conversationId,
        poll: event.poll,
      });
    }
  }

  @EventPattern(CHAT_EVENTS.POLL_OPTION_ADDED)
  handlePollOptionAdded(@Payload() event: any) {
    this.logger.log(`[chat.poll.option_added] poll=${event.pollId} conv=${event.conversationId}`);
    for (const userId of event.participantIds ?? []) {
      this.socketGateway.emitToUser(userId, 'poll:option_added', {
        pollId: event.pollId,
        messageId: event.messageId,
        conversationId: event.conversationId,
        poll: event.poll,
      });
    }
  }

  @EventPattern(CHAT_EVENTS.POLL_UPDATED)
  handlePollUpdated(@Payload() event: any) {
    this.logger.log(`[chat.poll.updated] poll=${event.pollId} conv=${event.conversationId}`);
    for (const userId of event.participantIds ?? []) {
      this.socketGateway.emitToUser(userId, 'poll:updated', {
        pollId: event.pollId,
        messageId: event.messageId,
        conversationId: event.conversationId,
        poll: event.poll,
      });
    }
  }

  @EventPattern(CHAT_EVENTS.POLL_CLOSED)
  handlePollClosed(@Payload() event: any) {
    this.logger.log(`[chat.poll.closed] poll=${event.pollId} conv=${event.conversationId}`);
    for (const userId of event.participantIds ?? []) {
      this.socketGateway.emitToUser(userId, 'poll:closed', {
        pollId: event.pollId,
        messageId: event.messageId,
        conversationId: event.conversationId,
        poll: event.poll,
      });
    }
  }

  @EventPattern(CHAT_EVENTS.POLL_DELETED)
  handlePollDeleted(@Payload() event: any) {
    this.logger.log(`[chat.poll.deleted] poll=${event.pollId} conv=${event.conversationId}`);
    for (const userId of event.participantIds ?? []) {
      this.socketGateway.emitToUser(userId, 'poll:deleted', {
        pollId: event.pollId,
        messageId: event.messageId,
        conversationId: event.conversationId,
      });
    }
  }

  @EventPattern(CHAT_EVENTS.TASK_CREATED)
  handleTaskCreated(@Payload() event: any) {
    this.logger.log(`[chat.task.created] conv=${event.conversationId}`);
    for (const userId of event.participantIds ?? []) {
      this.socketGateway.emitToUser(userId, 'task:created', {
        conversationId: event.conversationId,
        batchId: event.batchId,
        task: event.task,
        tasks: event.tasks,
      });
    }
  }

  @EventPattern(CHAT_EVENTS.TASK_UPDATED)
  handleTaskUpdated(@Payload() event: any) {
    this.logger.log(`[chat.task.updated] conv=${event.conversationId}`);
    for (const userId of event.participantIds ?? []) {
      this.socketGateway.emitToUser(userId, 'task:updated', {
        conversationId: event.conversationId,
        task: event.task,
      });
    }
  }

  @EventPattern(CHAT_EVENTS.TASK_COMPLETED)
  handleTaskCompleted(@Payload() event: any) {
    this.logger.log(`[chat.task.completed] conv=${event.conversationId}`);
    for (const userId of event.participantIds ?? []) {
      this.socketGateway.emitToUser(userId, 'task:completed', {
        conversationId: event.conversationId,
        task: event.task,
      });
    }
  }

  @EventPattern(CHAT_EVENTS.TASK_DELETED)
  handleTaskDeleted(@Payload() event: any) {
    this.logger.log(`[chat.task.deleted] conv=${event.conversationId}`);
    for (const userId of event.participantIds ?? []) {
      this.socketGateway.emitToUser(userId, 'task:deleted', {
        conversationId: event.conversationId,
        taskId: event.taskId,
      });
    }
  }

  @EventPattern(CHAT_EVENTS.TASK_ASSIGNED)
  handleTaskAssigned(@Payload() event: any) {
    this.logger.log(`[chat.task.assigned] conv=${event.conversationId} -> ${event.assigneeId}`);
    if (event.assigneeId) {
      this.socketGateway.emitToUser(event.assigneeId, 'task:assigned', {
        conversationId: event.conversationId,
        taskId: event.taskId,
        title: event.title,
        assigneeId: event.assigneeId,
        assignedBy: event.assignedBy,
      });
    }
  }
}
