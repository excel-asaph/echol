import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { handleSignaling } from './signaling';
import { Room } from './types';
import routes from './routes';
import logger from './middleware/logger';

const app: express.Application = express();
const server: http.Server = http.createServer(app);
const wss: WebSocketServer = new WebSocketServer({ server });

export const rooms: Map<string, Room> = new Map();
export const roomCodes: Map<string, string> = new Map(); // roomCode -> roomId
export const MAX_USERS_PER_ROOM: number = 10;

app.use(express.json());
app.use(logger);
app.use(express.static('public'));
app.use('/api', routes);

wss.on('connection', (ws: WebSocket) => {
  handleSignaling(ws, rooms);
});

// Periodic cleanup of empty rooms
setInterval(() => {
  for (const [roomId, room] of rooms) {
    if (room.users.size === 0) {
      rooms.delete(roomId);
      for (const [code, id] of roomCodes) {
        if (id === roomId) {
          roomCodes.delete(code);
          console.log(`Deleted empty room ${roomId} with code ${code}`);
          break;
        }
      }
    }
  }
}, 3600 * 1000); // Every hour

const PORT: number = parseInt(process.env.PORT || '3000', 10);
const WS_URL: string = process.env.WS_URL || `ws://localhost:${PORT}`;
app.set('wsUrl', WS_URL);
app.set('baseUrl', process.env.BASE_URL || `http://localhost:${PORT}`);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});