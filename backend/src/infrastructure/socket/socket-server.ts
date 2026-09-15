import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer, type Socket } from 'socket.io';

export interface SocketNotificationPayload {
  recipient: string;
  notification: {
    id: string;
    userId: string;
    channel: 'in-app';
    recipient: string;
    subject: string;
    body: string;
  };
}

export class SocketNotificationServer {
  private readonly io: SocketIOServer;

  public constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
      },
      transports: ['websocket', 'polling'],
    });

    this.registerConnectionHandlers();
  }

  private registerConnectionHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Socket.io client connected: ${socket.id}`);

      socket.on('register-user', (userId: string) => {
        if (userId.trim().length === 0) {
          return;
        }

        void socket.join(`user:${userId}`);
        socket.data.userId = userId;

        console.log(
          `Socket.io client ${socket.id} registered for user ${userId}`,
        );
      });

      socket.on('disconnect', (reason: string) => {
        console.log(
          `Socket.io client disconnected: ${socket.id}. Reason: ${reason}`,
        );
      });
    });
  }

  public sendToUser(userId: string, payload: SocketNotificationPayload): void {
    this.io.to(`user:${userId}`).emit('notification', payload);
  }

  public broadcast(payload: SocketNotificationPayload): void {
    this.io.emit('notification', payload);
  }

  public close(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close(() => {
        resolve();
      });
    });
  }
}
