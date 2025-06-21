"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const uuid_1 = require("uuid");
const server_1 = require("../server");
const router = express_1.default.Router();
router.post('/join', (req, res) => {
    const { username, preferredLanguage } = req.body;
    if (!username || !preferredLanguage || typeof preferredLanguage !== 'string') {
        return res.status(400).json({ error: 'Valid username and preferredLanguage required' });
    }
    let roomId = [...server_1.rooms.keys()].find(id => server_1.rooms.get(id).users.size < server_1.MAX_USERS_PER_ROOM);
    if (!roomId) {
        roomId = (0, uuid_1.v4)();
        server_1.rooms.set(roomId, { id: roomId, users: new Map() });
    }
    const userId = (0, uuid_1.v4)();
    const room = server_1.rooms.get(roomId);
    room.users.set(userId, { id: userId, username, preferredLanguage, ws: null });
    res.json({ roomId, userId, wsUrl: `ws://localhost:3000` });
});
router.post('/leave', (req, res) => {
    const { roomId, userId } = req.body;
    if (!roomId || !userId) {
        return res.status(400).json({ error: 'roomId and userId required' });
    }
    const room = server_1.rooms.get(roomId);
    if (room) {
        room.users.delete(userId);
        if (room.users.size === 0) {
            server_1.rooms.delete(roomId);
        }
    }
    res.json({ success: true });
});
router.get('/room/:roomId', (req, res) => {
    const room = server_1.rooms.get(req.params.roomId);
    if (!room)
        return res.status(404).json({ error: 'Room not found' });
    res.json({
        roomId: room.id,
        users: Array.from(room.users.values()).map(u => ({ id: u.id, username: u.username, preferredLanguage: u.preferredLanguage }))
    });
});
router.post('/transcribe', (req, res) => {
    res.status(501).json({ error: 'Transcription not implemented yet' });
});
router.post('/translate', (req, res) => {
    res.status(501).json({ error: 'Translation not implemented yet' });
});
exports.default = router;
