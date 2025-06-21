import { WebSocket } from 'ws';

export interface User {
  id: string;
  username: string;
  preferredLanguage: string;
  ws: WebSocket | null;
  disconnectTimer?: NodeJS.Timeout;
}

export interface Room {
  id: string;
  adminId?: string;
  offerMode: string;
  roomCode: string;
  joinToken: string;
  users: Map<string, User>;
}