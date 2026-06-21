import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { MultiplayerGameState, RoomSettings, ChatMessage, MultiplayerPlayer } from '../types';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://yoakatsuki-buckshot.hf.space';

export function useMultiplayer() {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [room, setRoom] = useState<any>(null);
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    // Callback for incoming actions
    const onActionRef = useRef<((data: { playerId: string, action: any }) => void) | null>(null);
    const setOnAction = useCallback((callback: (data: { playerId: string, action: any }) => void) => {
        onActionRef.current = callback;
    }, []);

    const connect = useCallback(() => {
        setIsConnecting(true);
        setError(null);

        const newSocket = io(SERVER_URL, {
            reconnectionAttempts: 3,
            timeout: 5000
        });

        newSocket.on('connect', () => {
            setIsConnected(true);
            setIsConnecting(false);
            setSocket(newSocket);
        });

        newSocket.on('connect_error', () => {
            setError('Server is offline');
            setIsConnecting(false);
        });

        newSocket.on('joinedRoom', ({ room, playerId }) => {
            setRoom(room);
            setPlayerId(playerId);
            setMessages(room.messages || []);
        });

        newSocket.on('roomUpdated', (updatedRoom) => {
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

        newSocket.on('error', (err: string) => {
            setError(err);
        });

        return newSocket;
    }, []);

    const disconnect = useCallback(() => {
        if (socket) {
            socket.disconnect();
            setSocket(null);
            setIsConnected(false);
            setRoom(null);
        }
    }, [socket]);

    const joinRoom = (roomId: string, playerName: string) => {
        socket?.emit('joinRoom', { roomId, playerName });
    };

    const updateSettings = (roomId: string, settings: RoomSettings) => {
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
        socket?.emit('gameAction', { roomId, action });
    };

    return {
        socket,
        room,
        playerId,
        error,
        isConnected,
        isConnecting,
        messages,
        connect,
        disconnect,
        joinRoom,
        updateSettings,
        readyUp,
        startGame,
        sendMessage,
        sendAction,
        setOnAction
    };
}
