import { WebSocket, RawData } from 'ws';
import { Room, User } from './types';

interface SignalingMessage {
  roomId: string;
  userId: string;
  type: 'join' | 'reconnect' | 'new-user' | 'manual-offer' | 'manual-accept' | 'offer' | 'answer' | 'ice-candidate' | 'user-left' | 'join-approved' | 'set-offer-mode' | 'offer-mode-updated' | 'initiate-offer';
  payload: any;
  to?: string;
  from?: string;
}

export function handleSignaling(ws: WebSocket, rooms: Map<string, Room>): void {
  ws.on('message', (data: RawData) => {
    let message: SignalingMessage;
    try {
      const dataString: string = data instanceof Buffer ? data.toString('utf8') : data.toString();
      message = JSON.parse(dataString) as SignalingMessage;
      if (!message.roomId || !message.userId || !message.type) {
        ws.send(JSON.stringify({ error: 'Invalid message format' }));
        return;
      }
      console.log(`Received ${message.type} from ${message.userId}${message.to ? ` to ${message.to}` : ''} in room ${message.roomId}`);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      ws.send(JSON.stringify({ error: 'Invalid message format' }));
      return;
    }

    const { roomId, userId, type, payload, to } = message;
    const room: Room | undefined = rooms.get(roomId);
    if (!room) {
      ws.send(JSON.stringify({ error: 'Room not found' }));
      return;
    }

    if (type === 'join') {
      if (!payload.joinToken || payload.joinToken !== room.joinToken) {
        ws.send(JSON.stringify({ error: 'Invalid join token' }));
        return;
      }

      const user: User = { id: userId, username: payload.username, preferredLanguage: payload.preferredLanguage, ws };
      room.users.set(userId, user);
      if (user.disconnectTimer) {
        clearTimeout(user.disconnectTimer);
        user.disconnectTimer = undefined;
      }

      if (userId === room.adminId) {
        console.log(`Admin ${userId} joined room ${roomId}`);
        ws.send(JSON.stringify({
          type: 'join-approved',
          payload: { adminId: room.adminId, offerMode: room.offerMode },
          roomId
        }));
      } else {
        if (room.offerMode === 'manual') {
          const admin: User | undefined = room.users.get(room.adminId!);
          if (admin && admin.ws) {
            admin.ws.send(JSON.stringify({
              type: 'new-user',
              payload: { newUserId: userId, username: user.username },
              from: userId,
              roomId
            }));
          } else {
            ws.send(JSON.stringify({ error: 'Admin not connected' }));
          }
        } else {
          ws.send(JSON.stringify({
            type: 'join-approved',
            payload: { adminId: room.adminId, offerMode: room.offerMode },
            roomId
          }));
        }
      }
    }
    else {
      const user: User | undefined = room.users.get(userId);
      if (!user) {
        ws.send(JSON.stringify({ error: 'User not found' }));
        return;
      }
      user.ws = ws;

      if (type === 'reconnect') {
        if (user.disconnectTimer) {
          clearTimeout(user.disconnectTimer);
          user.disconnectTimer = undefined;
          console.log(`User ${userId} reconnected to room ${roomId}`);
        }
        if (room.offerMode === 'manual' && room.adminId && room.adminId !== userId) {
          const admin = room.users.get(room.adminId);
          if (admin && admin.ws) {
            admin.ws.send(JSON.stringify({
              type: 'initiate-offer',
              payload: { newUserId: userId },
              to: room.adminId,
              roomId
            }));
          }
        } else if (room.offerMode === 'auto') {
          for (const [otherUserId, otherUser] of room.users) {
            if (userId === otherUserId || !otherUser.ws) continue;
            otherUser.ws.send(JSON.stringify({
              type: 'create-offer',
              payload: { newUserId: userId },
              roomId
            }));
          }
        }
      } else if (type === 'set-offer-mode') {
        if (userId !== room.adminId) {
          ws.send(JSON.stringify({ error: 'Only admin can set offer mode' }));
          return;
        }
        const newMode = payload.offerMode;
        if (!['auto', 'manual'].includes(newMode)) {
          ws.send(JSON.stringify({ error: 'Invalid offer mode' }));
          return;
        }
        room.offerMode = newMode;
        console.log(`Room ${roomId} offer mode set to ${newMode} by admin ${userId}`);
        for (const [, otherUser] of room.users) {
          if (otherUser.ws) {
            otherUser.ws.send(JSON.stringify({
              type: 'offer-mode-updated',
              payload: { offerMode: newMode },
              roomId
            }));
          }
        }
      } else if (['manual-offer', 'offer', 'answer', 'ice-candidate', 'manual-accept', 'initiate-offer'].includes(type)) {
        if (!to || typeof to !== 'string' || !room.users.has(to)) {
          ws.send(JSON.stringify({ error: `Invalid or missing target user: ${to}` }));
          return;
        }
        const targetUser: User | undefined = room.users.get(to);
        if (targetUser && targetUser.ws) {
          targetUser.ws.send(JSON.stringify({ type, payload, from: userId, roomId }));
        } else {
          ws.send(JSON.stringify({ error: 'Target user not connected' }));
        }
        if (type === 'manual-accept' && userId === room.adminId && to) {
          const newUser: User | undefined = room.users.get(to);
          if (newUser && newUser.ws) {
            newUser.ws.send(JSON.stringify({
              type: 'join-approved',
              payload: { adminId: room.adminId, offerMode: room.offerMode },
              roomId
            }));
          }
        }
      }
    }
  });

  ws.on('close', () => {
    for (const [roomId, room] of rooms) {
      for (const [userId, user] of room.users) {
        if (user.ws === ws) {
          user.ws = null; // Mark as disconnected
          console.log(`User ${userId} connection closed for room ${roomId}. Starting disconnect timer.`);

          user.disconnectTimer = setTimeout(() => {
            if (user.ws) return; // User has reconnected, do nothing.

            room.users.delete(userId);
            console.log(`User ${userId} permanently disconnected from room ${roomId} after timeout.`);

            if (userId === room.adminId && room.users.size > 0) {
              room.adminId = room.users.keys().next().value;
              console.log(`Reassigned adminId ${room.adminId} to room ${roomId}`);
            }

            for (const [, otherUser] of room.users) {
              if (otherUser.ws) {
                otherUser.ws.send(JSON.stringify({
                  type: 'user-left',
                  payload: { userId },
                  roomId
                }));
              }
            }
          }, 5000); // 5-second grace period
          break;
        }
      }
    }
  });

  ws.on('error', (error: Error) => {
    console.error('WebSocket error:', error);
    ws.send(JSON.stringify({ error: 'WebSocket error occurred' }));
  });
}