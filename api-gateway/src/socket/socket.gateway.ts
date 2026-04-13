import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

// Hàm này mục đích để giúp NestJS nhận diện và tạo instance của SocketGateway
// đồng thời cung cấp các tính năng WebSocket như quản lý kết nối, gửi/nhận tin nhắn, v.v.
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'],
    credentials: true,
  },
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SocketGateway.name);
  // userId → Set of socketId
  private readonly userSockets = new Map<string, Set<string>>();
  // userId → last seen timestamp (set when user goes offline)
  private readonly lastSeen = new Map<string, string>();
  // conversationId → Map<userId, timeout handle> for cleanup
  private readonly typingUsers = new Map<string, Map<string, ReturnType<typeof setTimeout>>>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Clean up user room mapping
    const userId = client.data?.userId as string | undefined;
    if (userId) {
      // Stop any active typing indicators
      this.typingUsers.forEach((users, convId) => {
        if (users.has(userId)) {
          clearTimeout(users.get(userId)!);
          users.delete(userId);
          this.broadcastTyping(convId);
        }
      });

      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
          // User went fully offline — record last seen
          const now = new Date().toISOString();
          this.lastSeen.set(userId, now);
          // Broadcast offline status to user's room (other tabs will hear it too)
          this.server.to(`user:${userId}`).emit('user:offline', { userId, lastSeen: now });
        }
      }
    }
  }

  @SubscribeMessage('join')
  handleJoin(@MessageBody() data: { userId: string }, @ConnectedSocket() client: Socket) {
    const { userId } = data;
    client.data.userId = userId;
    client.join(`user:${userId}`);

    const wasOffline = !this.userSockets.has(userId) || this.userSockets.get(userId)!.size === 0;

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(client.id);
    this.logger.log(`User ${userId} joined room user:${userId}`);

    if (wasOffline) {
      // User came online — broadcast
      this.server.to(`user:${userId}`).emit('user:online', { userId });
    }
  }

  @SubscribeMessage('presence:check')
  handlePresenceCheck(
    @MessageBody() data: { userIds: string[] },
    @ConnectedSocket() client: Socket
  ) {
    const results: Record<string, { online: boolean; lastSeen?: string }> = {};
    for (const uid of data.userIds ?? []) {
      const online = this.userSockets.has(uid) && this.userSockets.get(uid)!.size > 0;
      results[uid] = { online, lastSeen: online ? undefined : this.lastSeen.get(uid) };
    }
    client.emit('presence:result', results);
  }

  /** Emit a friend event to a specific user room */
  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  /** Check if a user is currently online */
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  // ── Typing Indicator ────────────────────────────────────────────────────

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @MessageBody() data: { conversationId: string; userId: string; userName: string }
  ) {
    const { conversationId, userId } = data;
    if (!conversationId || !userId) return;

    if (!this.typingUsers.has(conversationId)) {
      this.typingUsers.set(conversationId, new Map());
    }
    const users = this.typingUsers.get(conversationId)!;

    // Clear existing auto-stop timeout
    if (users.has(userId)) clearTimeout(users.get(userId)!);

    // Auto-stop typing after 5 seconds of no new events
    const timeout = setTimeout(() => {
      users.delete(userId);
      this.broadcastTyping(conversationId);
    }, 5000);

    users.set(userId, timeout);
    this.broadcastTyping(conversationId);
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @MessageBody() data: { conversationId: string; userId: string }
  ) {
    const { conversationId, userId } = data;
    if (!conversationId || !userId) return;

    const users = this.typingUsers.get(conversationId);
    if (users?.has(userId)) {
      clearTimeout(users.get(userId)!);
      users.delete(userId);
      this.broadcastTyping(conversationId);
    }
  }

  private broadcastTyping(conversationId: string) {
    const users = this.typingUsers.get(conversationId);
    const typingUserIds = users ? Array.from(users.keys()) : [];
    // Emit to conversation room (everyone who joined the room)
    this.server.to(`conversation:${conversationId}`).emit('typing:update', {
      conversationId,
      typingUserIds,
    });
  }

  @SubscribeMessage('conversation:join')
  handleConversationJoin(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket
  ) {
    if (data.conversationId) {
      client.join(`conversation:${data.conversationId}`);
    }
  }

  @SubscribeMessage('conversation:leave')
  handleConversationLeave(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket
  ) {
    if (data.conversationId) {
      client.leave(`conversation:${data.conversationId}`);
    }
  }
}
