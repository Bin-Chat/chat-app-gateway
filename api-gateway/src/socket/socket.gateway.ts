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
  // callId → active call session
  private readonly activeCalls = new Map<
    string,
    {
      callId: string;
      conversationId: string;
      callType: 'audio' | 'video';
      callerId: string;
      participantIds: string[]; // all invited participants
      acceptedIds: string[]; // participants who accepted
      status: 'ringing' | 'connected' | 'ended';
      startedAt: Date;
      connectedAt?: Date; // set on first accept
      ringingTimeout?: ReturnType<typeof setTimeout>; // 45s auto-cancel
    }
  >();

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

      // Clean up any active calls this user was in
      for (const [callId, session] of this.activeCalls) {
        if (session.acceptedIds.includes(userId) && session.status !== 'ended') {
          session.acceptedIds = session.acceptedIds.filter((id) => id !== userId);
          if (session.ringingTimeout) {
            clearTimeout(session.ringingTimeout);
            delete session.ringingTimeout;
          }
          if (session.acceptedIds.length === 0) {
            // Last person left — also dismiss pending incoming modals for non-accepted participants
            for (const uid of session.participantIds) {
              if (uid !== userId && !session.acceptedIds.includes(uid)) {
                this.emitToUser(uid, 'call:cancelled', { callId });
              }
            }
            this.activeCalls.delete(callId);
          } else {
            const isConnected = !!session.connectedAt;
            const duration = isConnected
              ? Math.floor((Date.now() - session.connectedAt!.getTime()) / 1000)
              : 0;
            for (const uid of session.acceptedIds) {
              this.emitToUser(uid, 'call:ended', {
                callId,
                endedBy: userId,
                outcome: isConnected ? 'completed' : 'cancelled',
                duration,
                conversationId: session.conversationId,
                callType: session.callType,
              });
            }
          }
        }
      }

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
  handleTypingStop(@MessageBody() data: { conversationId: string; userId: string }) {
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

  // ── Call Signaling ──────────────────────────────────────────────────────────

  /**
   * Caller initiates a call. Notifies all participant IDs with call:incoming.
   * Data: { callId, conversationId, callType, participantIds, callerName, callerAvatar? }
   */
  @SubscribeMessage('call:initiate')
  handleCallInitiate(
    @MessageBody()
    data: {
      callId: string;
      conversationId: string;
      callType: 'audio' | 'video';
      participantIds: string[];
      callerName: string;
      callerAvatar?: string;
    },
    @ConnectedSocket() client: Socket
  ) {
    const callerId = client.data?.userId as string;
    if (!callerId) return;

    const { callId, conversationId, callType, participantIds, callerName, callerAvatar } = data;

    // Reject if caller already in a call
    const alreadyInCall = [...this.activeCalls.values()].some(
      (s) => s.status !== 'ended' && s.acceptedIds.includes(callerId)
    );
    if (alreadyInCall) {
      client.emit('call:error', { callId, reason: 'already_in_call' });
      return;
    }

    this.activeCalls.set(callId, {
      callId,
      conversationId,
      callType,
      callerId,
      participantIds: [...participantIds, callerId],
      acceptedIds: [callerId],
      status: 'ringing',
      startedAt: new Date(),
    });

    // Auto-cancel after 45 seconds if nobody answers
    const ringingTimeout = setTimeout(() => {
      const s = this.activeCalls.get(callId);
      if (s && s.status === 'ringing') {
        s.status = 'ended';
        this.activeCalls.delete(callId);
        this.emitToUser(callerId, 'call:ended', {
          callId,
          conversationId,
          callType,
          outcome: 'missed',
          duration: 0,
        });
        for (const uid of s.participantIds) {
          if (uid !== callerId) {
            this.emitToUser(uid, 'call:cancelled', { callId });
          }
        }
      }
    }, 45_000);
    this.activeCalls.get(callId)!.ringingTimeout = ringingTimeout;

    for (const uid of participantIds) {
      if (uid !== callerId) {
        this.emitToUser(uid, 'call:incoming', {
          callId,
          conversationId,
          callType,
          callerId,
          callerName,
          callerAvatar,
        });
      }
    }
  }

  /**
   * Recipient accepts the call. Notifies existing participants so they can initiate WebRTC offers.
   * Data: { callId }
   */
  @SubscribeMessage('call:accept')
  handleCallAccept(@MessageBody() data: { callId: string }, @ConnectedSocket() client: Socket) {
    const userId = client.data?.userId as string;
    if (!userId) return;

    const session = this.activeCalls.get(data.callId);
    if (!session || session.status === 'ended') return;

    if (!session.acceptedIds.includes(userId)) {
      session.acceptedIds.push(userId);
    }
    session.status = 'connected';
    // Track when first person accepted (for duration calculation)
    if (!session.connectedAt) {
      session.connectedAt = new Date();
    }
    // Clear the ringing timeout — someone answered
    if (session.ringingTimeout) {
      clearTimeout(session.ringingTimeout);
      delete session.ringingTimeout;
    }

    // Notify existing participants of the new joiner so they can initiate offers
    for (const uid of session.acceptedIds) {
      if (uid !== userId) {
        this.emitToUser(uid, 'call:accepted', {
          callId: data.callId,
          userId, // who just joined
        });
      }
    }
  }

  /**
   * Recipient rejects the call. Notifies the caller.
   * Data: { callId }
   */
  @SubscribeMessage('call:reject')
  handleCallReject(@MessageBody() data: { callId: string }, @ConnectedSocket() client: Socket) {
    const userId = client.data?.userId as string;
    if (!userId) return;

    const session = this.activeCalls.get(data.callId);
    if (!session) return;

    this.emitToUser(session.callerId, 'call:rejected', {
      callId: data.callId,
      userId,
      conversationId: session.conversationId,
      callType: session.callType,
    });

    // For direct (1-on-1) calls, clean up session when callee rejects
    if (session.participantIds.length === 2) {
      if (session.ringingTimeout) clearTimeout(session.ringingTimeout);
      session.status = 'ended';
      this.activeCalls.delete(data.callId);
    }
  }

  /**
   * A participant ends/leaves the call. Notifies all other participants with outcome & duration.
   * Data: { callId }
   */
  @SubscribeMessage('call:end')
  handleCallEnd(@MessageBody() data: { callId: string }, @ConnectedSocket() client: Socket) {
    const userId = client.data?.userId as string;
    if (!userId) return;

    const session = this.activeCalls.get(data.callId);
    if (!session) return;

    // Clear ringing timeout if still pending
    if (session.ringingTimeout) {
      clearTimeout(session.ringingTimeout);
      delete session.ringingTimeout;
    }

    const isConnected = !!session.connectedAt;
    const duration = isConnected
      ? Math.floor((Date.now() - session.connectedAt!.getTime()) / 1000)
      : 0;
    const outcome: 'completed' | 'cancelled' | 'declined' = isConnected
      ? 'completed'
      : userId === session.callerId
        ? 'cancelled'
        : 'declined';

    // Remove the leaving participant from accepted list
    session.acceptedIds = session.acceptedIds.filter((id) => id !== userId);

    const isOneOnOne = session.participantIds.length === 2;

    // Always notify the person leaving so they can clean up their UI
    this.emitToUser(userId, 'call:ended', {
      callId: data.callId,
      conversationId: session.conversationId,
      callType: session.callType,
      endedBy: userId,
      outcome,
      duration,
    });

    if (isOneOnOne || session.acceptedIds.length <= 1) {
      // 1-on-1 call OR only 1 person left — no point staying in call alone
      session.status = 'ended';

      for (const uid of session.acceptedIds) {
        this.emitToUser(uid, 'call:ended', {
          callId: data.callId,
          conversationId: session.conversationId,
          callType: session.callType,
          endedBy: userId,
          outcome,
          duration,
        });
      }

      // Dismiss incoming modals for participants who never accepted
      for (const uid of session.participantIds) {
        if (uid !== userId && !session.acceptedIds.includes(uid)) {
          this.emitToUser(uid, 'call:cancelled', { callId: data.callId });
        }
      }

      this.activeCalls.delete(data.callId);
    } else {
      // Group call — someone left but others remain; notify them so they can update the UI
      for (const uid of session.acceptedIds) {
        this.emitToUser(uid, 'call:participant_left', {
          callId: data.callId,
          userId,
        });
      }
      // The call session continues for remaining participants
    }
  }

  /**
   * Relay WebRTC signaling (offer / answer / ICE candidate) to a specific user.
   * Data: { callId, targetUserId, signal }
   */
  @SubscribeMessage('call:signal')
  handleCallSignal(
    @MessageBody() data: { callId: string; targetUserId: string; signal: unknown },
    @ConnectedSocket() client: Socket
  ) {
    const senderId = client.data?.userId as string;
    if (!senderId || !data.targetUserId) return;

    this.emitToUser(data.targetUserId, 'call:signal', {
      callId: data.callId,
      senderId,
      signal: data.signal,
    });
  }

  /**
   * User is busy (already in another call). Notifies the caller.
   * Data: { callId, callerId }
   */
  @SubscribeMessage('call:busy')
  handleCallBusy(
    @MessageBody() data: { callId: string; callerId: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data?.userId as string;
    if (!userId || !data.callerId) return;

    this.emitToUser(data.callerId, 'call:busy', {
      callId: data.callId,
      userId,
    });
  }
}
