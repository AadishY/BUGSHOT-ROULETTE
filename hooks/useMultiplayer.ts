import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { MultiplayerGameState, RoomSettings, ChatMessage, MultiplayerPlayer } from '../types';
import { SocketBatcher } from '../utils/socketOptimizer';

const params = new URLSearchParams(window.location.search);
const isDiscord = params.has('frame_id') || params.has('instance_id') || window.location.search.includes('platform=') || window.location.hostname.includes('discordsays.com');
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const HF_BACKEND = import.meta.env.VITE_HF_BACKEND_URL || 'https://yoakatsuki-buckshot.hf.space';

// REST API goes through proxy; Socket.io connects directly to HF in production for native WebSocket
const REST_SERVER_URL = isDiscord
    ? window.location.origin + '/server'
    : (import.meta.env.VITE_SERVER_URL ||
        (isLocal ? 'http://localhost:3001' : window.location.origin + '/server'));

const getSocketConfig = () => {
    if (isLocal) {
        return { socketUrl: 'http://localhost:3001', socketPath: '/socket.io' };
    }
    if (isDiscord) {
        return { socketUrl: window.location.origin, socketPath: '/server/socket.io' };
    }
    // Production: bypass Cloudflare HTTP proxy for WebSocket — avoids long-polling fallback latency
    return {
        socketUrl: import.meta.env.VITE_SOCKET_URL || HF_BACKEND,
        socketPath: '/socket.io'
    };
};

const loadSavedSettings = () => {
    let savedSettings = { rounds: 3, hp: 9, itemsPerShipment: 9, isPrivate: false, isAdvanced: false };
    try {
        const saved = localStorage.getItem('aadish_roulette_last_lobby_settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
                savedSettings = {
                    rounds: parsed.rounds !== undefined ? parsed.rounds : 3,
                    hp: parsed.hp !== undefined ? parsed.hp : 9,
                    itemsPerShipment: parsed.itemsPerShipment !== undefined ? parsed.itemsPerShipment : 9,
                    isPrivate: parsed.isPrivate !== undefined ? parsed.isPrivate : false,
                    isAdvanced: false
                };
            }
        }
    } catch (e) {
        console.error("Failed to load saved settings:", e);
    }
    return savedSettings;
};

const getAuthId = (): string | null => {
    try {
        const saved = localStorage.getItem('aadish_roulette_logged_in_user');
        if (saved) {
            const parsed = JSON.parse(saved);
            return parsed?.username?.trim().toLowerCase() || null;
        }
    } catch (e) {}
    return null;
};

const IMMEDIATE_ACTION_TYPES = new Set([
    'SHOOT', 'USE_ITEM', 'SELECT_CARD', 'PICKUP_GUN', 'STEAL_ITEM',
    'SYNC_STATE', 'SYNC_THREE_PLAYER_STATE', 'SYNC_ROUND', 'SYNC_THREE_PLAYER_ROUND',
    'DEBUG_SYNC_PLAYER', 'DEBUG_SYNC_DEALER', 'DEBUG_SYNC_GAMESTATE',
    'DEBUG_SYNC_THREE_PLAYER', 'DEBUG_SYNC_PLAYER_MODEL'
]);

export function useMultiplayer() {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [room, setRoom] = useState<any>(null);
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [latencyMs, setLatencyMs] = useState<number | null>(null);

    const connectionAttemptsRef = useRef(0);
    const socketRef = useRef<Socket | null>(null);
    const socketBatcherRef = useRef<SocketBatcher | null>(null);
    const lastJoinRef = useRef<{ roomId: string; playerName: string } | null>(null);
    const playerNameRef = useRef<string>('');

    // Callback for incoming actions
    const onActionRef = useRef<((data: { playerId: string, action: any }) => void) | null>(null);
    const setOnAction = useCallback((callback: (data: { playerId: string, action: any }) => void) => {
        onActionRef.current = callback;
    }, []);

    const onFullSyncRequestRef = useRef<(() => void) | null>(null);
    const setOnFullSyncRequest = useCallback((callback: () => void) => {
        onFullSyncRequestRef.current = callback;
    }, []);

    const connect = useCallback((playerName?: string) => {
        if (playerName) playerNameRef.current = playerName;

        // Prevent socket leaks if connect is called while already connected
        if (socketRef.current) {
            socketBatcherRef.current?.flush();
            socketRef.current.disconnect();
        }
        setIsConnecting(true);
        setError(null);
        setConnectionStatus('ESTABLISHING LINK...');
        connectionAttemptsRef.current = 0;

        const { socketUrl, socketPath } = getSocketConfig();

        const newSocket = io(socketUrl, {
            reconnectionAttempts: 20,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            randomizationFactor: 0.3,
            timeout: 10000,
            path: socketPath,
            transports: ['websocket', 'polling'],
            upgrade: true,
            rememberUpgrade: true
        });

        newSocket.on('connect', () => {
            setIsConnected(true);
            setIsConnecting(false);
            setSocket(newSocket);
            socketRef.current = newSocket;
            setError(null);
            setConnectionStatus('');
            connectionAttemptsRef.current = 0;

            // Auto-rejoin room after reconnect (lobby or mid-game grace window)
            const pending = lastJoinRef.current;
            if (pending && playerNameRef.current) {
                newSocket.emit('joinRoom', {
                    roomId: pending.roomId,
                    playerName: playerNameRef.current,
                    authId: getAuthId()
                });
            }

            // Initialize socket batcher for non-critical game actions (2 actions or 50ms)
            socketBatcherRef.current = new SocketBatcher(2, 50, (actions) => {
                if (actions.length === 1) {
                    const action = actions[0];
                    newSocket.emit('gameAction', action.data);
                } else {
                    newSocket.emit('gameActionBatch', { actions });
                }
            });
        });

        (newSocket.io as any).on('ping', () => {
            (newSocket as any)._pingSentAt = Date.now();
        });
        (newSocket.io as any).on('pong', () => {
            const sent = (newSocket as any)._pingSentAt;
            if (sent) setLatencyMs(Date.now() - sent);
        });

        newSocket.on('connect_error', () => {
            connectionAttemptsRef.current += 1;
            if (connectionAttemptsRef.current >= 5) {
                setError('Server is offline. Waking up server, please refresh after 1 min.');
                setIsConnecting(false);
                setConnectionStatus('');
                newSocket.disconnect();
            } else {
                setConnectionStatus(`WAKING UP SERVER... (ATTEMPT ${connectionAttemptsRef.current}/5)`);
            }
        });

        newSocket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            setIsConnected(false);
            socketBatcherRef.current?.flush();
            if (reason === 'io server disconnect') {
                newSocket.connect();
            }
        });

        newSocket.on('joinedRoom', ({ room, playerId, reconnected }) => {
            if (room?.debugPlayerModels) {
                room.multiplayerState = {
                    ...(room.multiplayerState || {}),
                    debugPlayerModels: room.debugPlayerModels
                };
            }
            setRoom(room);
            setPlayerId(playerId);
            setMessages(room.messages || []);
            lastJoinRef.current = { roomId: room.id, playerName: playerNameRef.current };
            if (reconnected) {
                setConnectionStatus('RECONNECTED');
                setTimeout(() => setConnectionStatus(''), 2000);
            }
        });

        newSocket.on('roomUpdated', (updatedRoom) => {
            if (updatedRoom?.debugPlayerModels) {
                updatedRoom.multiplayerState = {
                    ...(updatedRoom.multiplayerState || {}),
                    debugPlayerModels: updatedRoom.debugPlayerModels
                };
            }
            setRoom(updatedRoom);
        });

        newSocket.on('chatMessageReceived', (msg: ChatMessage) => {
            setMessages(prev => [...prev, msg].slice(-50));
        });

        newSocket.on('gameActionReceived', (data: { playerId: string, action: any }) => {
            if (onActionRef.current) {
                onActionRef.current(data);
            }
        });

        newSocket.on('requestFullSync', () => {
            if (onFullSyncRequestRef.current) {
                onFullSyncRequestRef.current();
            }
        });

        newSocket.on('matchAborted', () => {
            // Match abort state is handled by App state and room updates.
        });

        newSocket.on('kicked', () => {
            setError('You were kicked from the room.');
            setRoom(null);
            setPlayerId(null);
            lastJoinRef.current = null;
            newSocket.disconnect();
        });

        newSocket.on('error', (err: string) => {
            setError(err);
        });

        return newSocket;
    }, []);

    const disconnect = useCallback(() => {
        const activeSocket = socketRef.current || socket;
        if (activeSocket) {
            socketBatcherRef.current?.flush();
            activeSocket.disconnect();
            socketRef.current = null;
            setSocket(null);
            setIsConnected(false);
            setConnectionStatus('');
            connectionAttemptsRef.current = 0;
            setRoom(null);
            setPlayerId(null);
            setError(null);
            lastJoinRef.current = null;
        }
    }, [socket]);

    useEffect(() => {
        return () => {
            if (socketRef.current) {
                socketBatcherRef.current?.flush();
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, []);

    const joinRoom = (roomId: string, playerName: string) => {
        playerNameRef.current = playerName;
        lastJoinRef.current = { roomId, playerName };
        socket?.emit('joinRoom', { roomId, playerName, authId: getAuthId() });
    };

    const createRoom = (playerName: string) => {
        playerNameRef.current = playerName;
        const savedSettings = loadSavedSettings();
        socket?.emit('createRoom', { playerName, settings: savedSettings, authId: getAuthId() });
    };

    const quickJoin = (playerName: string) => {
        playerNameRef.current = playerName;
        const savedSettings = loadSavedSettings();
        socket?.emit('quickJoin', { playerName, settings: savedSettings, authId: getAuthId() });
    };

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const updateSettings = (roomId: string, settings: RoomSettings) => {
        try {
            const settingsToSave = { ...settings, isAdvanced: false };
            localStorage.setItem('aadish_roulette_last_lobby_settings', JSON.stringify(settingsToSave));
        } catch (e) {
            console.error("Failed to save settings:", e);
        }
        socket?.emit('updateSettings', { roomId, settings });
    };

    const readyUp = (roomId: string, ready: boolean) => {
        socket?.emit('readyUp', { roomId, ready });
    };

    const startGame = (roomId: string, gameData: any) => {
        socket?.emit('startGame', { roomId, gameData });
    };

    const sendMessage = (roomId: string, message: string) => {
        socket?.emit('chatMessage', { roomId, message });
    };

    const sendAction = (roomId: string, action: any) => {
        const activeSocket = socketRef.current || socket;
        if (IMMEDIATE_ACTION_TYPES.has(action?.type)) {
            socketBatcherRef.current?.flush();
            activeSocket?.emit('gameAction', { roomId, action });
            return;
        }

        if (socketBatcherRef.current && activeSocket?.connected) {
            socketBatcherRef.current.queue('gameAction', { roomId, action });
        } else {
            activeSocket?.emit('gameAction', { roomId, action });
        }
    };

    // Bypass batcher for latency-sensitive events (aim, shoot, state sync)
    const sendImmediateAction = (roomId: string, action: any) => {
        const activeSocket = socketRef.current || socket;
        socketBatcherRef.current?.flush();
        activeSocket?.emit('gameAction', { roomId, action });
    };

    const kickPlayer = (roomId: string, targetPlayerId: string) => {
        socket?.emit('kickPlayer', { roomId, targetPlayerId });
    };

    const resetRoomState = (roomId: string) => {
        socket?.emit('resetRoomState', { roomId });
    };

    const getActiveRooms = useCallback(async () => {
        try {
            const res = await fetch(`${REST_SERVER_URL}/active-rooms`);
            if (!res.ok) throw new Error('Failed to fetch active rooms');
            return await res.json();
        } catch (err) {
            console.error("Error fetching active rooms:", err);
            return [];
        }
    }, []);

    return {
        socket,
        room,
        playerId,
        error,
        isConnected,
        isConnecting,
        connectionStatus,
        messages,
        latencyMs,
        connect,
        disconnect,
        joinRoom,
        createRoom,
        quickJoin,
        clearError,
        kickPlayer,
        resetRoomState,
        getActiveRooms,
        updateSettings,
        readyUp,
        startGame,
        sendMessage,
        sendAction,
        sendImmediateAction,
        setOnAction,
        setOnFullSyncRequest
    };
}
