import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';
import compression from 'compression';

const app = express();

// Enable GZIP compression to reduce packet sizes across web hosting infrastructure
app.use(compression());

// --- HUGGING FACE & REVERSE PROXY LAYER CONFIGURATION ---
// Hugging Face Spaces route dynamic client traffic through layered reverse proxies.
// Trusting proxies allows the Express core engine to correctly read downstream headers (IPs, proto upgrades).
app.set('trust proxy', true);

const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
const allowedOrigins = allowedOriginsEnv ? allowedOriginsEnv.split(',') : [];

const corsOptions = {
    origin: (origin, callback) => {
        // Broad capture to allow local servers, matching environment origins, Hugging Face iframe deployments, or Discord Activity client
        if (!origin || allowedOrigins.includes(origin) || allowedOriginsEnv === "*" || origin.includes('.hf.space') || origin.includes('localhost:') || origin.includes('127.0.0.1:') || origin.includes('.discordsays.com') || origin.includes('.pages.dev')) {
            callback(null, true);
        } else {
            callback(new Error('Blocked by Security Framework: Unauthorized Origin Connection'));
        }
    },
    methods: ["GET", "POST"],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// --- SECURE UPSTASH REDIS TUNNEL PROXY ---
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || "https://enormous-mackerel-87613.upstash.io";
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "gQAAAAAAAVY9AAIncDFhZDhkNGNjODM5M2I0NmY5YTg5YzQwYWFhOGU3NzI2NnAxODc2MTM";

app.post('/redis', async (req, res) => {
    try {
        const response = await fetch(REDIS_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${REDIS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (err) {
        console.error("Redis proxy error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/redis/pipeline', async (req, res) => {
    try {
        const response = await fetch(`${REDIS_URL}/pipeline`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${REDIS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (err) {
        console.error("Redis pipeline proxy error:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- DISCORD EMBEDDED ACTIVITY OAUTH TOKEN EXCHANGE ---
app.post('/api/token', async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: 'Authorization code is required' });
        }

        const clientId = process.env.DISCORD_CLIENT_ID || '1517863650998882406';
        const clientSecret = process.env.DISCORD_CLIENT_SECRET;

        if (!clientSecret) {
            console.error("DISCORD_CLIENT_SECRET environment variable is missing!");
            return res.status(500).json({ error: 'Server configuration error: client secret missing' });
        }

        const response = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'authorization_code',
                code: code
            }).toString()
        });

        const data = await response.json();
        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json({ access_token: data.access_token });
    } catch (err) {
        console.error("Discord token exchange error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Analytics Metric Storage Vitals
const serverStartTime = Date.now();
let globalMatchesPlayed = 0;
let unauthorizedInterventionsBlocked = 0;
let activeConnectionsCount = 0;

// Central State Repository Memory Pool
// Room Context Map: roomId -> { id, hostId, players: [...], settings: {...}, gameState: {...}, lastActivity: timestamp }
const rooms = new Map();

const PLAYER_COLORS = [
    '#06b6d4', // Cyan
    '#f59e0b', // Amber/Yellow
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#3b82f6', // Cobalt/Electric Blue
    '#f97316'  // Orange
];

const httpServer = createServer(app);

// --- LOW-LATENCY SOCKET.IO NETWORK ENGINE ---
const io = new Server(httpServer, {
    cors: {
        origin: allowedOriginsEnv === "*" ? true : (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin) || origin.includes('.hf.space') || origin.includes('localhost:') || origin.includes('.discordsays.com') || origin.includes('.pages.dev')) {
                callback(null, true);
            } else {
                callback(null, false);
            }
        },
        methods: ["GET", "POST"],
        credentials: true
    },
    pingTimeout: 10000,        // Speed up the disconnection of dead/stale sockets
    pingInterval: 4000,        // High-frequency heartbeats maintain strict game tunnel synchronization
    connectTimeout: 10000,
    cookie: false,             // Avoid parsing session cookies to preserve packet header bandwidth
    transports: ['websocket', 'polling'], // Prefer native ultra-speed WebSockets
    allowEIO3: true,           // Backwards compatibility layer support fallback
    maxHttpBufferSize: 1e6     // Hard ceiling packet capacity threshold at 1MB to protect against buffer exploits
});

// --- ENGINE RADAR TERMINAL PAGE ---
// Accessing the root server URL parses a high-contrast industrial diagnostic dark dashboard
app.get('/', (req, res) => {
    const uptimeMS = Date.now() - serverStartTime;
    const days = Math.floor(uptimeMS / (24 * 60 * 60 * 1000));
    const hours = Math.floor((uptimeMS % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((uptimeMS % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((uptimeMS % (60 * 1000)) / 1000);
    
    let activePlayersTotal = 0;
    let liveMatchesTotal = 0;
    rooms.forEach(r => {
        activePlayersTotal += r.players.length;
        if (r.gameState) liveMatchesTotal++;
    });

    const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const systemPlatform = `${os.platform()} (${os.arch()})`;
    const loadAverage = os.loadavg().map(v => v.toFixed(2)).join(', ');

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AADISH ROULETTE // ENGINE CORE</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap');
            body { font-family: 'JetBrains Mono', monospace; background-color: #0c0a09; }
            .scanline {
                background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.3));
                background-size: 100% 4px;
            }
        </style>
    </head>
    <body class="text-stone-300 min-h-screen p-4 md:p-8 relative overflow-x-hidden scanline">
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(28,25,23,0.4)_0%,#0c0a09_100%)] pointer-events-none z-0"></div>
        
        <main class="max-w-6xl mx-auto relative z-10 space-y-6">
            <header class="border border-stone-850 bg-stone-950/80 backdrop-blur-md p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-2xl">
                <div>
                    <div class="flex items-center gap-3">
                        <span class="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
                        <h1 class="text-xl md:text-2xl font-black text-white tracking-wider uppercase">AADISH-ROULETTE CORE</h1>
                    </div>
                    <p class="text-[10px] text-stone-500 mt-1 uppercase tracking-widest">Network Architecture Protocol V2.5 // Live Processing Diagnostics</p>
                </div>
                <div class="bg-stone-900 border border-stone-800 px-4 py-2 rounded-lg text-right w-full md:w-auto">
                    <span class="text-[10px] block text-stone-500 uppercase font-bold tracking-widest">Core Integrity</span>
                    <span class="text-emerald-400 font-black tracking-widest text-sm uppercase">ONLINE // SECURE</span>
                </div>
            </header>

            <section class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-stone-950/60 backdrop-blur-md border border-stone-850 p-5 rounded-xl">
                    <span class="text-[10px] font-black text-stone-500 tracking-wider block uppercase">Active Lobbies</span>
                    <span class="text-3xl font-black text-white block mt-2">${rooms.size}</span>
                    <span class="text-[10px] text-stone-400 block mt-1 uppercase">${liveMatchesTotal} Active Match Threads</span>
                </div>
                <div class="bg-stone-950/60 backdrop-blur-md border border-stone-850 p-5 rounded-xl">
                    <span class="text-[10px] font-black text-stone-500 tracking-wider block uppercase">Connected Nodes</span>
                    <span class="text-3xl font-black text-white block mt-2">${activePlayersTotal}</span>
                    <span class="text-[10px] text-stone-500 block mt-1 uppercase">Global Sockets: ${activeConnectionsCount}</span>
                </div>
                <div class="bg-stone-950/60 backdrop-blur-md border border-stone-850 p-5 rounded-xl">
                    <span class="text-[10px] font-black text-stone-500 tracking-wider block uppercase">Continuous Uptime</span>
                    <span class="text-xl font-black text-red-500 block mt-3 uppercase tracking-tighter">${days}d : ${hours}h : ${minutes}m : ${seconds}s</span>
                    <span class="text-[10px] text-stone-600 block mt-1 uppercase">Engine Lifetime Tracking</span>
                </div>
                <div class="bg-stone-950/60 backdrop-blur-md border border-stone-850 p-5 rounded-xl">
                    <span class="text-[10px] font-black text-stone-500 tracking-wider block uppercase">Matches Handled</span>
                    <span class="text-3xl font-black text-white block mt-2">${globalMatchesPlayed}</span>
                    <span class="text-[10px] text-yellow-600 block mt-1 uppercase font-bold">${unauthorizedInterventionsBlocked} Sec. Violations Blocked</span>
                </div>
            </section>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="bg-stone-950/40 backdrop-blur-md border border-stone-850 p-6 rounded-xl space-y-4">
                    <h2 class="text-xs font-black text-white tracking-widest uppercase border-b border-stone-850 pb-2">Hardware Vital Specs</h2>
                    <div class="space-y-3 text-xs font-mono">
                        <div class="flex justify-between"><span class="text-stone-500 uppercase">Heap Memory Load</span><span class="text-stone-200 font-bold">${memoryUsage} MB</span></div>
                        <div class="flex justify-between"><span class="text-stone-500 uppercase">Platform Target</span><span class="text-stone-200 font-bold">${systemPlatform}</span></div>
                        <div class="flex justify-between"><span class="text-stone-500 uppercase">OS CPU Load Avg</span><span class="text-stone-200 font-bold">${loadAverage}</span></div>
                        <div class="flex justify-between"><span class="text-stone-500 uppercase">Process ID</span><span class="text-stone-200 font-bold">#${process.pid}</span></div>
                        <div class="flex justify-between"><span class="text-stone-500 uppercase">Runtime Context</span><span class="text-stone-200 font-bold">Node ${process.version}</span></div>
                    </div>
                </div>

                <div class="lg:col-span-2 bg-stone-950/40 backdrop-blur-md border border-stone-850 p-6 rounded-xl flex flex-col">
                    <h2 class="text-xs font-black text-white tracking-widest uppercase border-b border-stone-850 pb-2 mb-4">Live Allocated Pipelines</h2>
                    <div class="space-y-3 flex-1 overflow-y-auto max-h-[240px] text-xs">
                        ${rooms.size === 0 ? `
                            <div class="text-center py-12 text-stone-600 uppercase tracking-wider font-bold">
                                // No active communication channels currently deployed.
                            </div>
                        ` : Array.from(rooms.values()).map(room => `
                            <div class="border border-stone-850 bg-stone-900/30 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div class="space-y-1">
                                    <div class="flex items-center gap-2">
                                        <span class="font-bold text-stone-200 uppercase">Room Matrix ID: ${room.id}</span>
                                        <span class="px-1.5 py-0.5 text-[9px] font-black rounded ${room.gameState ? 'bg-red-950 text-red-400 border border-red-900/40' : 'bg-stone-800 text-stone-400'} uppercase">${room.gameState ? 'MATCH_IN_PROGRESS' : 'LOBBY_STAGE'}</span>
                                    </div>
                                    <div class="text-stone-500 text-[10px] uppercase">Registered Sockets: <span class="text-stone-400">${room.players.map(p => p.name).join(', ')}</span></div>
                                </div>
                                <div class="text-right shrink-0">
                                    <span class="text-[9px] block text-stone-500 uppercase">Attributes Context</span>
                                    <span class="text-stone-400 font-medium font-mono">${room.settings.hp === 9 ? 'RNDM' : room.settings.hp}HP | ${room.settings.rounds}R | ${room.settings.itemsPerShipment === 9 ? 'RNDM' : room.settings.itemsPerShipment}I</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </main>
    </body>
    </html>
    `;
    res.status(200).send(htmlContent);
});

// Deployment Health Vector mapping check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'HEALTHY', timestamp: Date.now(), roomCount: rooms.size });
});

// Active rooms query vector
app.get('/active-rooms', (req, res) => {
    const activeRooms = [];
    rooms.forEach((room) => {
        if (!room.settings?.isPrivate) {
            activeRooms.push({
                id: room.id,
                name: room.name || `${room.players[0]?.name || 'Unknown'}'s Bunker`,
                playerCount: room.players.length,
                maxPlayers: 4,
                settings: room.settings,
                isPlaying: !!room.gameState
            });
        }
    });
    res.status(200).json(activeRooms);
});

// Link preview parser vector for chat rich embeds
app.get('/api/link-preview', async (req, res) => {
    const urlStr = req.query.url;
    if (!urlStr) {
        return res.status(400).json({ error: 'URL parameter required' });
    }

    // Static override for mockup matching and offline developer test integrity
    if (urlStr.includes('gameslists.pages.dev')) {
        return res.json({
            title: 'Steam Backlog Tracker — Organise Your Games in Style',
            description: 'A premium, gaming-themed backlog tracker for Steam users. Track your collection with neon aesthetics and snapping interactions.',
            image: 'https://gameslists.pages.dev/preview.png',
            siteName: 'gameslists.pages.dev'
        });
    }

    try {
        const url = new URL(urlStr);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(url.toString(), {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const html = await response.text();

        const getMetaTag = (text, propertyOrName) => {
            const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${propertyOrName}["'][^>]*content=["']([^"']+)["']`, 'i');
            const match = text.match(regex);
            if (match) return match[1];

            const regexAlt = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${propertyOrName}["']`, 'i');
            const matchAlt = text.match(regexAlt);
            return matchAlt ? matchAlt[1] : null;
        };

        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        const title = getMetaTag(html, 'og:title') || (titleMatch ? titleMatch[1] : url.hostname);
        const description = getMetaTag(html, 'og:description') || getMetaTag(html, 'description') || '';
        let image = getMetaTag(html, 'og:image') || '';

        if (image && !image.startsWith('http')) {
            image = new URL(image, url.origin).toString();
        }

        res.json({
            title: (title || '').trim(),
            description: (description || '').trim(),
            image: image,
            siteName: url.hostname
        });
    } catch (err) {
        console.error("Link preview extraction failure:", err.message);
        try {
            const url = new URL(urlStr);
            res.json({
                title: url.hostname,
                description: 'External link target',
                image: '',
                siteName: url.hostname
            });
        } catch (e) {
            res.status(400).json({ error: 'Invalid destination URL format' });
        }
    }
});


// Periodic Automatic Stale Registry Memory Garbage Collector
setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
        if (room.players.length === 0 || (room.lastActivity && now - room.lastActivity > 7200000)) {
            // Eject and notify any lingering players in the room
            room.players.forEach(p => {
                const s = io.sockets.sockets.get(p.id);
                if (s) {
                    s.emit('error', 'Lobby closed due to inactivity.');
                    s.leave(roomId);
                }
            });
            rooms.delete(roomId);
            console.log(`[GARBAGE COLLECTION] Pruned inactive room data stack: ${roomId}`);
        }
    }
}, 180000); // 3-minute check interval

// --- REAL-TIME SERVER TRANSACTION HANDLERS ---
const parseHpSetting = (val) => {
    const parsed = parseInt(val);
    if (isNaN(parsed)) return 9; // Default to 9 (Random)
    return Math.min(Math.max(parsed, 2), 9); // Allow 2 to 9
};

const parseItemsSetting = (val) => {
    const parsed = parseInt(val);
    if (isNaN(parsed)) return 9; // Default to 9 (Random)
    return Math.min(Math.max(parsed, 0), 9); // Allow 0 to 9
};

const createRoomObject = (roomId, hostId, hostName, settings) => {
    const defaultSettings = { rounds: 3, hp: 9, itemsPerShipment: 9, isPrivate: false, isAdvanced: false, itemWeights: null };
    const finalSettings = settings ? {
        rounds: Math.min(Math.max(parseInt(settings.rounds) || 3, 1), 7),
        hp: parseHpSetting(settings.hp),
        itemsPerShipment: parseItemsSetting(settings.itemsPerShipment),
        isPrivate: !!settings.isPrivate,
        isAdvanced: false, // Always force false when initially entering a new room
        itemWeights: settings.itemWeights || null
    } : defaultSettings;

    return {
        id: roomId,
        name: `${hostName}'s Bunker`,
        hostId,
        players: [],
        settings: finalSettings,
        gameState: null,
        messages: [],
        lastActivity: Date.now()
    };
};

const joinSocketToRoom = (socket, room, playerName) => {
    if (room.players.length >= 4) {
        socket.emit('error', 'Lobby is full (Max 4 players allowed).');
        return;
    }
    if (room.gameState) {
        socket.emit('error', 'Match is already in progress in this room.');
        return;
    }

    const newPlayerName = playerName ? playerName.trim().substring(0, 14) : `Player ${room.players.length + 1}`;

    // Check if player with same name already in room (for reconnection resume state)
    const existingPlayerIndex = room.players.findIndex(p => p.name.toLowerCase() === newPlayerName.toLowerCase());
    if (existingPlayerIndex !== -1) {
        const oldPlayer = room.players[existingPlayerIndex];
        console.log(`[RECONNECT] Player ${oldPlayer.name} reconnected. Updating socket ID from ${oldPlayer.id} to ${socket.id}`);
        
        // If the old socket is still connected (ghost connection), leave and emit warning
        const oldSocket = io.sockets.sockets.get(oldPlayer.id);
        if (oldSocket) {
            oldSocket.emit('error', 'Linked connection active elsewhere. Dropping tunnel.');
            oldSocket.leave(room.id);
        }
        
        // Re-assign socket ID and reset state
        oldPlayer.id = socket.id;
        oldPlayer.ready = false; // reset ready status on reconnecting
        
        socket.join(room.id);
        
        const reconnectMessage = {
            sender: 'SYSTEM',
            color: '#737373',
            text: `${oldPlayer.name} reconnected to the bunker.`,
            timestamp: Date.now()
        };
        room.messages.push(reconnectMessage);
        if (room.messages.length > 50) room.messages.shift();
        
        io.to(room.id).emit('roomUpdated', room);
        socket.emit('joinedRoom', { room, playerId: socket.id });
        io.to(room.id).emit('chatMessageReceived', reconnectMessage);
        return;
    }

    const playerColor = PLAYER_COLORS[room.players.length % PLAYER_COLORS.length];
    const newPlayer = {
        id: socket.id,
        name: newPlayerName,
        color: playerColor,
        ready: false,
        hp: room.settings.hp,
        maxHp: room.settings.hp,
        items: [],
        isHandcuffed: false,
        isSawedActive: false
    };

    room.players.push(newPlayer);
    room.lastActivity = Date.now();
    socket.join(room.id);

    console.log(`[JOINED] ${newPlayer.name} hooked to room cluster: ${room.id}`);
    
    const joinMessage = {
        sender: 'SYSTEM',
        color: '#737373',
        text: `${newPlayer.name} entered the bunker.`,
        timestamp: Date.now()
    };
    room.messages.push(joinMessage);
    if (room.messages.length > 50) room.messages.shift();
    
    io.to(room.id).emit('roomUpdated', room);
    socket.emit('joinedRoom', { room, playerId: socket.id });
    socket.to(room.id).emit('chatMessageReceived', joinMessage);
};

io.on('connection', (socket) => {
    activeConnectionsCount++;
    let requestPacketCounter = 0;
    let lastThrottleReset = Date.now();
    
    // Antiflood state packet counter validation
    const throttleCheck = () => {
        const now = Date.now();
        if (now - lastThrottleReset > 1000) {
            requestPacketCounter = 0;
            lastThrottleReset = now;
        }
        requestPacketCounter++;
        return requestPacketCounter > 50;
    };

    socket.on('createRoom', ({ playerName, settings }) => {
        if (throttleCheck()) return;
        
        let roomId;
        let attempts = 0;
        do {
            roomId = Math.floor(1000 + Math.random() * 9000).toString();
            attempts++;
        } while (rooms.has(roomId) && attempts < 100);

        if (rooms.has(roomId)) {
            socket.emit('error', 'Failed to generate a unique room code. Try again.');
            return;
        }

        const hostName = playerName ? playerName.trim().substring(0, 14) : 'Host';
        const room = createRoomObject(roomId, socket.id, hostName, settings);
        rooms.set(roomId, room);

        joinSocketToRoom(socket, room, playerName);
    });

    socket.on('joinRoom', ({ roomId, playerName }) => {
        if (throttleCheck()) return;
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('error', 'Room not found.');
            return;
        }

        joinSocketToRoom(socket, room, playerName);
    });

    socket.on('quickJoin', ({ playerName, settings }) => {
        if (throttleCheck()) return;
        
        let availableRoom = null;
        for (const room of rooms.values()) {
            if (room.players.length < 4 && !room.gameState && !room.settings?.isPrivate) {
                availableRoom = room;
                break;
            }
        }

        if (availableRoom) {
            joinSocketToRoom(socket, availableRoom, playerName);
        } else {
            let roomId;
            let attempts = 0;
            do {
                roomId = Math.floor(1000 + Math.random() * 9000).toString();
                attempts++;
            } while (rooms.has(roomId) && attempts < 100);

            const hostName = playerName ? playerName.trim().substring(0, 14) : 'Host';
            const room = createRoomObject(roomId, socket.id, hostName, settings);
            rooms.set(roomId, room);

            joinSocketToRoom(socket, room, playerName);
        }
    });

    socket.on('updateSettings', ({ roomId, settings }) => {
        if (throttleCheck()) return;
        const room = rooms.get(roomId);
        if (room && room.hostId === socket.id && !room.gameState) {
            room.settings = {
                rounds: Math.min(Math.max(parseInt(settings.rounds) || 3, 1), 7),
                hp: parseHpSetting(settings.hp),
                itemsPerShipment: parseItemsSetting(settings.itemsPerShipment),
                isPrivate: !!settings.isPrivate,
                isAdvanced: !!settings.isAdvanced,
                itemWeights: settings.itemWeights || null
            };
            room.lastActivity = Date.now();
            io.to(roomId).emit('roomUpdated', room);
        }
    });

    socket.on('readyUp', ({ roomId, ready }) => {
        if (throttleCheck()) return;
        const room = rooms.get(roomId);
        if (room) {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.ready = !!ready;
                room.lastActivity = Date.now();
                io.to(roomId).emit('roomUpdated', room);
            }
        }
    });

    socket.on('startGame', ({ roomId, gameData }) => {
        if (throttleCheck()) return;
        const room = rooms.get(roomId);
        if (room && room.hostId === socket.id) {
            if (room.players.length < 2) {
                socket.emit('error', 'Need at least 2 players to start.');
                return;
            }
            if (!room.players.every(p => p.ready)) {
                socket.emit('error', 'All players must be ready.');
                return;
            }

            room.gameState = gameData;
            room.lastActivity = Date.now();
            globalMatchesPlayed++;
            
            // System message arrays removed to prevent structural layout pollution
            io.to(roomId).emit('gameStarted', { room, gameData });
        }
    });

    socket.on('gameAction', ({ roomId, action }) => {
        if (throttleCheck()) return;
        const room = rooms.get(roomId);
        if (!room) return;
        room.lastActivity = Date.now();

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        // --- DEVELOPMENT HARDENED REINFORCED SECURITY BOUNDARY ---
        // Completely limits multi-client multiplayer injection vectors to developer configuration profiles
        const containsDebugFlags = action.type?.toUpperCase().includes('DEBUG') || action.isDebug;
        if (containsDebugFlags) {
            if (player.name.toLowerCase() !== 'aadish') {
                unauthorizedInterventionsBlocked++;
                console.warn(`[SECURITY WARNING] Intercepted unauthorized debug runtime execution try by player: ${player.name} inside room: ${roomId}`);
                socket.emit('error', 'Access Denied: Debug tools are strictly restricted to the developer account.');
                return;
            }
            console.log(`[DEVELOPER SYSTEM CALL] Authorized account 'aadish' deployed debugging hook element: ${action.type}`);
        }

        if (action.type === 'USE_ITEM') {
            action.playerName = player.name; // Attaches item action trigger origin context directly to payload frame
        }

        // Relays the state mutation update cleanly to room endpoints without chatting system logs
        socket.to(roomId).emit('gameActionReceived', { playerId: socket.id, action });
    });

    socket.on('chatMessage', ({ roomId, message }) => {
        if (throttleCheck()) return;
        const room = rooms.get(roomId);
        if (room) {
            const player = room.players.find(p => p.id === socket.id);
            if (player && message && message.trim().length > 0) {
                const chatEntry = {
                    sender: player.name,
                    color: player.color,
                    text: message.trim().substring(0, 140), // Hard character cap boundary limits
                    timestamp: Date.now()
                };
                room.messages.push(chatEntry);
                room.lastActivity = Date.now();
                if (room.messages.length > 50) room.messages.shift();
                io.to(roomId).emit('chatMessageReceived', chatEntry);
            }
        }
    });

    socket.on('kickPlayer', ({ roomId, targetPlayerId }) => {
        if (throttleCheck()) return;
        const room = rooms.get(roomId);
        if (room && room.hostId === socket.id) {
            const playerIndex = room.players.findIndex(p => p.id === targetPlayerId);
            if (playerIndex !== -1) {
                const kickedPlayer = room.players[playerIndex];
                room.players.splice(playerIndex, 1);
                
                const targetSocket = io.sockets.sockets.get(targetPlayerId);
                if (targetSocket) {
                    targetSocket.leave(roomId);
                    targetSocket.emit('kicked');
                }

                const kickMessage = {
                    sender: 'SYSTEM',
                    color: '#737373',
                    text: `${kickedPlayer.name} was expelled from the bunker.`,
                    timestamp: Date.now()
                };
                room.messages.push(kickMessage);
                if (room.messages.length > 50) room.messages.shift();
                io.to(roomId).emit('chatMessageReceived', kickMessage);

                io.to(roomId).emit('roomUpdated', room);
                console.log(`[KICK] Host ${socket.id} kicked player ${kickedPlayer.name} (${targetPlayerId}) from room ${roomId}`);
            }
        }
    });

    socket.on('resetRoomState', ({ roomId }) => {
        if (throttleCheck()) return;
        const room = rooms.get(roomId);
        if (room && room.hostId === socket.id) {
            room.gameState = null;
            room.players.forEach(p => {
                p.ready = false;
                p.items = [];
                p.isHandcuffed = false;
                p.isSawedActive = false;
            });
            room.lastActivity = Date.now();
            io.to(roomId).emit('roomUpdated', room);
            io.to(roomId).emit('matchReset');
            console.log(`[RESET] Host ${socket.id} reset room ${roomId} back to lobby.`);
        }
    });

    socket.on('disconnect', () => {
        activeConnectionsCount--;
        
        rooms.forEach((room, roomId) => {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const disconnectedPlayer = room.players[playerIndex];
                room.players.splice(playerIndex, 1);
                console.log(`[DISCONNECT LOOP] User ${disconnectedPlayer.name} abandoned pipeline link lane: ${roomId}`);

                if (room.players.length === 0) {
                    rooms.delete(roomId);
                    console.log(`[GARBAGE COLLECTION] Purged zero-node inactive room cache memory tree: ${roomId}`);
                } else {
                    const leaveMessage = {
                        sender: 'SYSTEM',
                        color: '#737373',
                        text: `${disconnectedPlayer.name} has left the bunker.`,
                        timestamp: Date.now()
                    };
                    room.messages.push(leaveMessage);
                    if (room.messages.length > 50) room.messages.shift();
                    io.to(roomId).emit('chatMessageReceived', leaveMessage);

                    // --- AUTOMATED MID-GAME TRANSITION CRASH PROTECTION MATRIX ---
                    // Instantly catches mid-game runtime failures/quits. Resets remaining players back to the
                    // lobby safely with zeroed items/states, preventing frozen interfaces.
                    if (room.gameState) {
                        console.log(`[STATE SAFEGUARD INTERVENTION] Thread client disconnected mid-match within room ${roomId}. Dropping active game instance safely.`);
                        room.gameState = null;
                        
                        // Force structural refresh vectors down to surviving connection handles
                        room.players.forEach(p => { 
                            p.ready = false; 
                            p.items = []; 
                            p.isHandcuffed = false; 
                            p.isSawedActive = false; 
                        });
                        
                        // Broadcast client recovery crash override hook down to room lanes
                        io.to(roomId).emit('matchAborted', { abortedBy: disconnectedPlayer.name });
                    }

                    if (room.hostId === socket.id) {
                        room.hostId = room.players[0].id;
                        console.log(`[AUTHORITY ESCALATION SUCCESS] Allocated room context token to node ${room.players[0].name} for lane ${roomId}`);
                    }
                    io.to(roomId).emit('roomUpdated', room);
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
    console.log(`[CORE ROUTING PROTOCOLS READY] Core engine operational. Active interface port target: ${PORT}`);
});