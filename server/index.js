import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : "*";

app.use(cors({
    origin: allowedOrigins
}));

// Health check for deployment platforms
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"]
    },
    // PERFORMANCE BOOSTER: Tune Socket.IO for low-latency gaming
    pingTimeout: 10000,   // Disconnect faster if heartbeats fail
    pingInterval: 5000,    // More frequent heartbeats to keep connection alive
    connectTimeout: 10000,
    cookie: false,         // Disable cookies to save headers
    transports: ['websocket', 'polling'] // Prefer websocket
});

// Room data structure
// roomId -> { hostId, players: [{id, name, color, ready, hp, items, isHandcuffed, isSawedActive}], settings: {rounds, hp, itemsPerShipment}, gameState: {...} }
const rooms = new Map();

// PRODUCTION OPTIMIZATION: Periodic cleanup of empty or stale rooms
setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
        // Only if room is empty or last activity was too long ago (e.g., 2 hours)
        if (room.players.length === 0 || (room.lastActivity && now - room.lastActivity > 7200000)) {
            rooms.delete(roomId);
            console.log(`[CLEANUP] Pruned room ${roomId}`);
        }
    }
}, 300000); // Run every 5 minutes

const PLAYER_COLORS = [
    '#ff4444', // Red
    '#44ff44', // Green
    '#4444ff', // Blue
    '#ffff44', // Yellow
    '#ff44ff', // Magenta
    '#44ffff', // Cyan
];

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinRoom', ({ roomId, playerName }) => {
        let room = rooms.get(roomId);

        if (!room) {
            // Create new room
            room = {
                id: roomId,
                hostId: socket.id,
                players: [],
                settings: {
                    rounds: 3,
                    hp: 4,
                    itemsPerShipment: 4
                },
                gameState: null,
                messages: []
            };
            rooms.set(roomId, room);
        }

        if (room.players.length >= 4) {
            socket.emit('error', 'Room is full');
            return;
        }

        const playerColor = PLAYER_COLORS[room.players.length % PLAYER_COLORS.length];
        const newPlayer = {
            id: socket.id,
            name: playerName || `Player ${room.players.length + 1}`,
            color: playerColor,
            ready: false,
            hp: room.settings.hp,
            maxHp: room.settings.hp,
            items: [],
            isHandcuffed: false,
            isSawedActive: false
        };

        room.players.push(newPlayer);
        socket.join(roomId);

        console.log(`[JOIN] ${playerName} joined room ${roomId} (${room.players.length}/4)`);

        io.to(roomId).emit('roomUpdated', room);
        socket.emit('joinedRoom', { room, playerId: socket.id });

        // System message for Join
        io.to(roomId).emit('chatMessageReceived', {
            sender: 'SYSTEM',
            color: '#aaaaaa',
            text: `${playerName} has joined the lobby.`,
            timestamp: Date.now()
        });
    });

    socket.on('updateSettings', ({ roomId, settings }) => {
        const room = rooms.get(roomId);
        if (room && room.hostId === socket.id) {
            room.settings = { ...room.settings, ...settings };
            console.log(`[SETTINGS] Room ${roomId} updated:`, room.settings);
            io.to(roomId).emit('roomUpdated', room);
        }
    });

    socket.on('readyUp', ({ roomId, ready }) => {
        const room = rooms.get(roomId);
        if (room) {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.ready = ready;
                console.log(`[READY] ${player.name} is now ${ready ? 'READY' : 'NOT READY'}`);
                io.to(roomId).emit('roomUpdated', room);
            }
        }
    });

    socket.on('startGame', ({ roomId, gameData }) => {
        const room = rooms.get(roomId);
        if (room && room.hostId === socket.id) {
            if (room.players.length < 2) {
                socket.emit('error', 'Need at least 2 players to start');
                return;
            }
            // Allow start if everyone is ready, including host
            if (!room.players.every(p => p.ready)) {
                socket.emit('error', 'All players must be ready');
                return;
            }

            console.log(`[GAME START] Room ${roomId} starting with:`, gameData.chamber);
            // Broadcast game start and initial sync data
            room.gameState = gameData;
            io.to(roomId).emit('gameStarted', { room, gameData });

            // System message for Game Start
            const lives = gameData.chamber.filter(s => s === 'LIVE').length;
            const blanks = gameData.chamber.length - lives;
            io.to(roomId).emit('chatMessageReceived', {
                sender: 'SYSTEM',
                color: '#ff4444',
                text: `MATCH STARTED: ${lives} LIVE, ${blanks} BLANK.`,
                timestamp: Date.now()
            });
        }
    });

    socket.on('gameAction', ({ roomId, action }) => {
        const room = rooms.get(roomId);
        if (room) room.lastActivity = Date.now();

        // Log interesting actions
        if (action.type === 'SYNC_ROUND') {
            console.log(`[SYNC ROUND] Room ${roomId}: Chamber=${action.chamber}, HostItems=${action.hostItems}, ClientItems=${action.clientItems}`);
            const lives = action.chamber.filter(s => s === 'LIVE').length;
            const blanks = action.chamber.length - lives;

            io.to(roomId).emit('chatMessageReceived', {
                sender: 'SYSTEM',
                color: '#ff4444',
                text: `NEW BATCH: ${lives} LIVE, ${blanks} BLANK.`,
                timestamp: Date.now()
            });
        } else if (action.type === 'SHOOT') {
            const player = rooms.get(roomId)?.players.find(p => p.id === socket.id);
            const targetId = action.targetId;
            const targetPlayer = targetId ? rooms.get(roomId)?.players.find(p => p.id === targetId) : null;
            const targetName = targetPlayer ? targetPlayer.name : action.target; // action.target is 'PLAYER' or 'DEALER'

            console.log(`[SHOT] Room ${roomId} | ${player?.name || socket.id} fired at ${targetName}. Result: ${action.result || 'UNKNOWN'}`);

            // System message for impact
            if (action.result === 'LIVE') {
                io.to(roomId).emit('chatMessageReceived', {
                    sender: 'SYSTEM',
                    color: '#ff0000',
                    text: `${player?.name || 'Player'} landed a LIVE shot on ${targetName}!`,
                    timestamp: Date.now()
                });
            } else if (action.result === 'BLANK') {
                io.to(roomId).emit('chatMessageReceived', {
                    sender: 'SYSTEM',
                    color: '#0088ff',
                    text: `${player?.name || 'Player'} fired a BLANK at ${targetName}.`,
                    timestamp: Date.now()
                });
            }
        } else if (action.type === 'USE_ITEM') {
            const player = rooms.get(roomId)?.players.find(p => p.id === socket.id);
            console.log(`[ITEM] Room ${roomId} | ${player?.name || socket.id} used ${action.item} (Index: ${action.index})`);

            io.to(roomId).emit('chatMessageReceived', {
                sender: 'SYSTEM',
                color: '#ffff44',
                text: `${player?.name || 'Player'} used ${action.item.replace('_', ' ')}.`,
                timestamp: Date.now()
            });
        }

        // Broadcast action to all other players in the room
        socket.to(roomId).emit('gameActionReceived', { playerId: socket.id, action });
    });

    socket.on('chatMessage', ({ roomId, message }) => {
        const room = rooms.get(roomId);
        if (room) {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                if (typeof message !== 'string') return;

                const trimmedMessage = message.trim();
                if (trimmedMessage.length === 0) return;

                // Truncate to 200 chars
                const sanitizedMessage = trimmedMessage.slice(0, 200);

                const chatEntry = {
                    sender: player.name,
                    color: player.color,
                    text: sanitizedMessage,
                    timestamp: Date.now()
                };
                room.messages.push(chatEntry);
                room.lastActivity = Date.now();
                if (room.messages.length > 50) room.messages.shift();
                console.log(`[CHAT] Room ${roomId} | ${player.name}: ${sanitizedMessage}`);
                io.to(roomId).emit('chatMessageReceived', chatEntry);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        rooms.forEach((room, roomId) => {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const playerName = room.players[playerIndex].name;
                room.players.splice(playerIndex, 1);
                console.log(`[LEAVE] ${playerName} left room ${roomId} (${room.players.length}/4)`);

                if (room.players.length === 0) {
                    rooms.delete(roomId);
                    console.log(`[ROOM DELETED] Room ${roomId} empty.`);
                } else {
                    if (room.hostId === socket.id) {
                        room.hostId = room.players[0].id;
                        console.log(`[NEW HOST] ${room.players[0].name} is now host of ${roomId}`);
                    }
                    io.to(roomId).emit('roomUpdated', room);
                    io.to(roomId).emit('chatMessageReceived', {
                        sender: 'SYSTEM',
                        color: '#aaaaaa',
                        text: 'A player has disconnected.',
                        timestamp: Date.now()
                    });
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
