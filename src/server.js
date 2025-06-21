"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_USERS_PER_ROOM = exports.rooms = void 0;
const express_1 = __importDefault(require("express"));
const ws_1 = require("ws");
const http_1 = __importDefault(require("http"));
const signaling_1 = require("./signaling");
const routes_1 = __importDefault(require("./routes"));
const logger_1 = __importDefault(require("./middleware/logger"));
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const wss = new ws_1.WebSocketServer({ server });
exports.rooms = new Map();
exports.MAX_USERS_PER_ROOM = 10;
app.use(express_1.default.json());
app.use(logger_1.default);
app.use(express_1.default.static('public'));
app.use('/api', routes_1.default);
wss.on('connection', (ws) => {
    (0, signaling_1.handleSignaling)(ws, exports.rooms);
});
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
