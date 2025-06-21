import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { rooms, roomCodes, MAX_USERS_PER_ROOM } from '../server';
import { User, Room } from '../types';

const router: express.Router = express.Router();

router.post('/create-room', (req: express.Request, res: express.Response) => {
  const { username, preferredLanguage } = req.body;
  if (!username || !preferredLanguage || typeof preferredLanguage !== 'string') {
    return res.status(400).json({ error: 'Valid username and preferredLanguage required' });
  }

  const supportedLanguages: string[] = ['en', 'fr', 'kin', 'es'];
  if (!supportedLanguages.includes(preferredLanguage)) {
    console.warn(`Unsupported language: ${preferredLanguage}`);
  }

  const roomId: string = uuidv4();
  const userId: string = uuidv4();
  const roomCode: string = crypto.randomBytes(5).toString('hex'); // 10-char code
  const joinToken: string = crypto.randomBytes(16).toString('hex'); // Secure token

  rooms.set(roomId, {
    id: roomId,
    adminId: userId,
    offerMode: 'auto',
    roomCode,
    joinToken,
    users: new Map()
  });
  roomCodes.set(roomCode, roomId);
  const room: Room = rooms.get(roomId)!;
  room.users.set(userId, { id: userId, username, preferredLanguage, ws: null });

  console.log(`Created room ${roomId} with code ${roomCode} and admin ${userId}`);
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const roomLink = `${baseUrl}/join.html?roomCode=${roomCode}`;

  res.json({
    roomId,
    userId,
    wsUrl: req.app.get('wsUrl'),
    adminId: userId,
    offerMode: room.offerMode,
    roomLink
  });
});

router.post('/join-room', (req: express.Request, res: express.Response) => {
  const { username, preferredLanguage, roomCode } = req.body;
  if (!username || !preferredLanguage || !roomCode || typeof preferredLanguage !== 'string') {
    return res.status(400).json({ error: 'Valid username, preferredLanguage, and roomCode required' });
  }

  const supportedLanguages: string[] = ['en', 'fr', 'kin', 'es'];
  if (!supportedLanguages.includes(preferredLanguage)) {
    console.warn(`Unsupported language: ${preferredLanguage}`);
  }

  const roomId: string | undefined = roomCodes.get(roomCode);
  if (!roomId) {
    return res.status(404).json({ error: 'Invalid room code' });
  }

  const room: Room | undefined = rooms.get(roomId);
  if (!room || room.users.size >= MAX_USERS_PER_ROOM) {
    return res.status(400).json({ error: 'Room not found or full' });
  }

  const userId: string = uuidv4();
  console.log(`User ${userId} attempting to join room ${roomId} with code ${roomCode}`);
  res.json({
    roomId,
    userId,
    wsUrl: req.app.get('wsUrl'),
    adminId: room.adminId,
    offerMode: room.offerMode,
    joinToken: room.joinToken
  });
});

router.post('/leave', (req: express.Request, res: express.Response) => {
  const { roomId, userId } = req.body;
  if (!roomId || !userId) {
    return res.status(400).json({ error: 'roomId and userId required' });
  }
  const room: Room | undefined = rooms.get(roomId);
  if (room) {
    room.users.delete(userId);
  }
  res.json({ success: true });
});

router.get('/room/:roomId', (req: express.Request, res: express.Response) => {
  const room: Room | undefined = rooms.get(req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({
    roomId: room.id,
    adminId: room.adminId,
    offerMode: room.offerMode,
    users: Array.from(room.users.values()).map((u: User) => ({ id: u.id, username: u.username, preferredLanguage: u.preferredLanguage }))
  });
});

router.post('/transcribe', (_req: express.Request, res: express.Response) => {
  res.status(501).json({ error: 'Transcription not implemented yet' });
});

router.post('/translate', (_req: express.Request, res: express.Response) => {
  res.status(501).json({ error: 'Translation not implemented yet' });
});

export default router;