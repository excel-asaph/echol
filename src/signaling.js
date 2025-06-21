"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSignaling = handleSignaling;
function handleSignaling(ws, rooms) {
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            const { roomId, userId, type, payload, to } = message;
            console.log(`Received ${type} from ${userId}${to ? ` to ${to}` : ''} in room ${roomId}`);
            const room = rooms.get(roomId);
            if (!room) {
                ws.send(JSON.stringify({ error: 'Room not found' }));
                return;
            }
            const user = room.users.get(userId);
            if (user) {
                user.ws = ws;
            }
            else {
                ws.send(JSON.stringify({ error: 'User not found' }));
                return;
            }
            if (type === 'join') {
                for (const [otherUserId, otherUser] of room.users) {
                    if (otherUserId !== userId && otherUser.ws) {
                        otherUser.ws.send(JSON.stringify({
                            type: 'create-offer',
                            payload: { newUserId: userId },
                            from: userId,
                            roomId
                        }));
                    }
                }
            }
            else if (type === 'offer' || type === 'answer' || type === 'ice-candidate') {
                if (!to || !room.users.has(to)) {
                    ws.send(JSON.stringify({ error: `Target user ${to} not found` }));
                    return;
                }
                const targetUser = room.users.get(to);
                if (targetUser && targetUser.ws) {
                    targetUser.ws.send(JSON.stringify({ type, payload, from: userId, roomId }));
                }
                else {
                    ws.send(JSON.stringify({ error: 'Target user not connected' }));
                }
            }
        }
        catch (error) {
            console.error('Signaling error:', error);
            ws.send(JSON.stringify({ error: 'Invalid message' }));
        }
    });
    ws.on('close', () => {
        for (const [roomId, room] of rooms) {
            for (const [userId, user] of room.users) {
                if (user.ws === ws) {
                    room.users.delete(userId);
                    for (const [, otherUser] of room.users) {
                        if (otherUser.ws) {
                            otherUser.ws.send(JSON.stringify({
                                type: 'user-left',
                                payload: { userId },
                                roomId
                            }));
                        }
                    }
                    if (room.users.size === 0) {
                        rooms.delete(roomId);
                    }
                    console.log(`User ${userId} disconnected from room ${roomId}`);
                    break;
                }
            }
        }
    });
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
}
