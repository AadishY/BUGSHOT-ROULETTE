import React, { useEffect, useState, useRef } from 'react';
import { GameState, PlayerState, LogEntry, TurnOwner, ItemType, AimTarget, ShellType, CameraView, GameSettings, ChatMessage } from '../types';
import { Settings as SettingsIcon, Skull, Send, Smile, Minimize2 } from 'lucide-react';
import { audioManager } from '../utils/audioManager';
import { StatusDisplay } from './ui/StatusDisplay';
import { Inventory } from './ui/Inventory';
import { Controls } from './ui/Controls';
import { BootScreen } from './ui/BootScreen';
import { IntroScreen } from './ui/IntroScreen';
import ShellBackground from './ui/ShellBackground';
import { LinkPreviewCard } from './ui/LinkPreviewCard';

import { GameOverScreen } from './ui/GameOverScreen';
import { LootOverlay } from './ui/LootOverlay';
import { Icons } from './ui/Icons';
import { ITEM_DESCRIPTIONS } from '../constants';

interface GameUIProps {
    gameState: GameState;
    player: PlayerState;
    dealer: PlayerState;
    player3?: PlayerState;
    player4?: PlayerState;
    logs: LogEntry[];
    overlayText: string | null;
    overlayColor: 'none' | 'red' | 'green' | 'scan';
    showBlood: boolean;
    showFlash: boolean;
    showFlashbang?: boolean; // Added for flashbang white-out
    showLootOverlay: boolean;
    triggerHeal: number;
    triggerDrink: number;
    knownShell: ShellType | null;
    receivedItems: ItemType[];
    playerName: string;
    cameraView: CameraView;
    aimTarget?: AimTarget; // Added for controls logic
    isProcessing: boolean;
    isRecovering?: boolean; // Added for blocking gun pickup during recovery
    settings: GameSettings;
    onStartGame: (name: string, hardMode?: boolean) => void;
    onResetGame: (toMenu: boolean) => void;
    onFireShot: (target: TurnOwner, targetId?: string) => void;
    onUseItem: (index: number, targetPlayerId?: string) => void;
    onHoverTarget: (target: AimTarget, targetId?: string) => void;
    onPickupGun: () => void;
    onOpenSettings: () => void;
    onOpenGuide: () => void;
    onOpenScoreboard: () => void;
    onUpdateName?: (name: string) => void;
    onStealItem?: (index: number) => void;
    onBootComplete?: () => void;
    onStartMultiplayer?: (name: string) => void;
    matchData?: any;
    isMultiplayer?: boolean;
    messages?: ChatMessage[];
    onSendMessage?: (text: string) => void;
    mpGameState?: any;
    mpMyPlayerId?: string | null;
    stickers?: string[];
}

const RenderColoredText = ({ text }: { text: string }) => {
    if (!text) return null;
    const parts = text.split(/(LIVE|BLANK)/g);
    return (
        <>
            {parts.map((part, i) => {
                if (part === 'LIVE') return <span key={i} className="text-red-600 animate-pulse font-black">{part}</span>;
                if (part === 'BLANK') return <span key={i} className="text-blue-500 font-black">{part}</span>;
                return <span key={i}>{part}</span>;
            })}
        </>
    );
};

export const GameUI: React.FC<GameUIProps> = ({
    gameState,
    player,
    dealer,
    logs,
    overlayText,
    overlayColor,
    showFlash,
    showBlood,
    showFlashbang = false,
    showLootOverlay,
    triggerHeal,
    triggerDrink,
    knownShell,
    receivedItems,
    playerName,
    cameraView,
    aimTarget = 'IDLE',
    isProcessing,
    settings,
    onStartGame,
    onResetGame,
    onFireShot,
    onUseItem,
    onHoverTarget,
    onPickupGun,
    onOpenSettings,
    onOpenGuide,
    onOpenScoreboard,
    onUpdateName,
    onStealItem,
    onBootComplete,
    isRecovering = false,
    matchData,
    onStartMultiplayer,
    isMultiplayer = false,
    messages = [],
    onSendMessage,
    mpGameState,
    mpMyPlayerId,
    stickers = [],
    player3,
    player4
}) => {
    const [inputName, setInputName] = useState(playerName || '');
    const [isChatMinimized, setIsChatMinimized] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const [pendingItemIndex, setPendingItemIndex] = useState<number | null>(null);
    const [showChatPreview, setShowChatPreview] = useState(false);
    const [chatPreviewMessages, setChatPreviewMessages] = useState<ChatMessage[]>([]);
    const [chatDraft, setChatDraft] = useState('');
    const prevMsgLength = useRef(messages.length);
    const fullscreenRequestedRef = useRef(false);
    const chatPreviewTimeoutRef = useRef<number | null>(null);

    const [isStickersOpen, setIsStickersOpen] = useState(false);
    const [activeStickers, setActiveStickers] = useState<{ id: string; sender: string; color: string; filename: string }[]>([]);
    const lastStickerMsgIndex = useRef(-1);
    const stickerTimeoutsRef = useRef<Record<string, number>>({});

    const getOpponentName = () => {
        if (!mpGameState) return 'DEALER';
        const opp = mpGameState.players.find((p: any) => p.id !== mpMyPlayerId);
        return opp ? opp.name : 'DEALER';
    };

    // Cleanup active timer references on unmount
    useEffect(() => {
        return () => {
            if (chatPreviewTimeoutRef.current) {
                window.clearTimeout(chatPreviewTimeoutRef.current);
                chatPreviewTimeoutRef.current = null;
            }
        };
    }, []);

    // Sticker message listeners (displays transparently on left side, fades after 8s, max 3 limit)
    useEffect(() => {
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            if (msg.text && msg.text.startsWith('[STICKER]:') && i > lastStickerMsgIndex.current) {
                lastStickerMsgIndex.current = i;
                const filename = msg.text.split(':')[1];
                const id = `${msg.timestamp || Date.now()}-${i}-${Math.random()}`;
                setActiveStickers(prev => {
                    const merged = [...prev, { id, sender: msg.sender, color: msg.color || '#fff', filename }];
                    return merged.slice(-3);
                });

                stickerTimeoutsRef.current[id] = window.setTimeout(() => {
                    setActiveStickers(prev => prev.filter(s => s.id !== id));
                    delete stickerTimeoutsRef.current[id];
                }, 8000);
            }
        }
    }, [messages]);

    useEffect(() => {
        return () => {
            Object.values(stickerTimeoutsRef.current).forEach(window.clearTimeout);
            stickerTimeoutsRef.current = {};
        };
    }, []);

    const resetChatPreviewTimer = (previewMessages: ChatMessage[]) => {
        setChatPreviewMessages(previewMessages.slice(-5));
        setShowChatPreview(true);
        if (chatPreviewTimeoutRef.current) {
            window.clearTimeout(chatPreviewTimeoutRef.current);
        }
        chatPreviewTimeoutRef.current = window.setTimeout(() => {
            setShowChatPreview(false);
            chatPreviewTimeoutRef.current = null;
        }, 30000);
    };

    useEffect(() => {
        if (!isChatMinimized) {
            prevMsgLength.current = messages.length;
            return;
        }

        const newMsgs = messages.slice(prevMsgLength.current).filter(m => m.sender !== 'SYSTEM' && m.text && !m.text.startsWith('SYSTEM:') && !m.text.startsWith('[STICKER]:'));
        if (newMsgs.length > 0) {
            setUnreadCount(prev => prev + newMsgs.length);
            resetChatPreviewTimer(newMsgs);
        }
        prevMsgLength.current = messages.length;
    }, [messages, isChatMinimized]);

    useEffect(() => {
        if (isChatMinimized && messages.length > 0) {
            const recent = messages.filter(m => m.sender !== 'SYSTEM' && m.text && !m.text.startsWith('SYSTEM:') && !m.text.startsWith('[STICKER]:')).slice(-5);
            if (recent.length > 0) {
                resetChatPreviewTimer(recent);
            }
        }
    }, [isChatMinimized]);

    useEffect(() => {
        if (!isChatMinimized) {
            setUnreadCount(0);
            setShowChatPreview(false);
            if (chatPreviewTimeoutRef.current) {
                window.clearTimeout(chatPreviewTimeoutRef.current);
                chatPreviewTimeoutRef.current = null;
            }
        }
    }, [isChatMinimized]);

    useEffect(() => {
        return () => {
            if (chatPreviewTimeoutRef.current) {
                clearTimeout(chatPreviewTimeoutRef.current);
                chatPreviewTimeoutRef.current = null;
            }
        };
    }, []);

    useEffect(() => { if (playerName) setInputName(playerName); }, [playerName]);

    const chatScrollRef = React.useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!isChatMinimized && chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [messages, isChatMinimized]);

    const handleStartGame = (hardMode?: boolean) => {
        if (inputName.trim()) {
            if (onUpdateName) onUpdateName(inputName.trim());

            if (!fullscreenRequestedRef.current && document.documentElement?.requestFullscreen) {
                fullscreenRequestedRef.current = true;
                const requestFullscreen = () => {
                    try {
                        if (!document.fullscreenElement) {
                            void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
                        }
                    } catch (e) {}
                };

                if (typeof window !== 'undefined') {
                    window.setTimeout(requestFullscreen, 80);
                } else {
                    requestFullscreen();
                }
            }

            onStartGame(inputName.trim(), hardMode);
        }
    };


    const [smokeActive, setSmokeActive] = useState(false);
    useEffect(() => {
        if (triggerHeal > 0) {
            setSmokeActive(true);
            setTimeout(() => setSmokeActive(false), 2000);
        }
    }, [triggerHeal]);

    const [drinkActive, setDrinkActive] = useState(false);
    useEffect(() => {
        if (triggerDrink > 0) {
            setDrinkActive(true);
            setTimeout(() => setDrinkActive(false), 1500);
        }
    }, [triggerDrink]);

    const isGunHeld = cameraView === 'GUN' || cameraView === 'PLAYER3_GUN' || cameraView === 'DEALER_GUN' || aimTarget === 'CHOOSING' || aimTarget === 'OPPONENT' || aimTarget === 'SELF' || aimTarget === 'LEFT' || aimTarget === 'RIGHT';
    const isMyTurn = (gameState.turnOwner === 'PLAYER' && (gameState.phase === 'PLAYER_TURN' || gameState.phase === 'LOOTING'));

    // Robust UI Scaling: Scale the UI container while keeping it centered and contained
    const [screenSize, setScreenSize] = useState({ w: window.innerWidth, h: window.innerHeight });
    useEffect(() => {
        const handleResize = () => setScreenSize({ w: window.innerWidth, h: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isVeryNarrow = screenSize.w < 400;
    const isMobileViewport = screenSize.w < 768;

    // Auto-adjust scale for small screens if needed, otherwise use user setting
    const baseScale = isMobileViewport ? Math.min(settings.uiScale, 0.75) : settings.uiScale;
    const finalScale = isVeryNarrow ? baseScale * 0.85 : baseScale;
    const showExternalSettingsButton = finalScale < 0.45;
    const isHudHidden = finalScale <= 0;

    const uiStyle = isHudHidden ? {
        opacity: 0,
        pointerEvents: 'none' as const,
    } : {
        transform: `scale(${finalScale})`,
        transformOrigin: 'center center',
        width: `${100 / finalScale}%`,
        height: `${100 / finalScale}%`,
        left: `${(100 - (100 / finalScale)) / 2}%`,
        top: `${(100 - (100 / finalScale)) / 2}%`,
    };

    return (
        <>
            {/* Falling Shells Background - Pauses drawing when inactive to free GPU and improve performance, while keeping context alive to avoid context recreation lag/errors */}
            <div className={`absolute inset-0 bg-black transition-opacity ${gameState.phase === 'BOOT' || gameState.phase === 'INTRO' ? 'opacity-100 duration-1000' : 'opacity-0 duration-0 pointer-events-none'}`}>
                {!settings.ultraPerformance && (
                    <ShellBackground active={gameState.phase === 'INTRO' || gameState.phase === 'BOOT'} />
                )}
            </div>

            {gameState.phase === 'BOOT' && <BootScreen onContinue={onBootComplete} />}

            {/* FX Layers */}
            <div className={`absolute inset-0 pointer-events-none transition-colors duration-300 z-10 ${overlayColor === 'red' ? 'bg-red-900/40' : overlayColor === 'green' ? 'bg-green-900/20' : overlayColor === 'scan' ? 'bg-fuchsia-900/30 mix-blend-overlay' : ''}`} />

            {/* Cinematic Framing */}
            <div className={`fixed inset-0 pointer-events-none z-[100] ${(gameState.phase === 'RESOLVING' || gameState.phase === 'STEALING' || gameState.phase === 'LOOTING' || gameState.phase === 'GAME_OVER') ? 'letterbox-active' : ''}`}>
                <div className="letterbox-top" />
                <div className="letterbox-bottom" />
            </div>

            {/* Cinematic Vignette */}
            <div className="absolute inset-0 pointer-events-none z-10 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.6)_100%)] mix-blend-multiply" />

            {showFlash && <div className="absolute inset-0 z-50 flash-screen" />}
            {showFlashbang && <div className="absolute inset-0 z-50 flashbang-screen" />}
            {smokeActive && (
                <div
                    className="absolute inset-x-0 bottom-0 z-30 pointer-events-none animate-[pulse_2s_ease-out]"
                    style={{
                        height: '72%',
                        clipPath: 'polygon(0 18%, 100% 18%, 100% 100%, 0 100%)',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.0) 0%, rgba(148,163,184,0.14) 40%, rgba(30,30,30,0.42) 70%, rgba(15,23,42,0.62) 100%)',
                        mixBlendMode: 'hard-light',
                        backdropFilter: 'blur(2px)'
                    }}
                />
            )}
            {drinkActive && <div className="absolute inset-0 z-30 pointer-events-none bg-yellow-600/10 backdrop-blur-[3px]" />}
            {showBlood && (
                <div className="absolute inset-0 pointer-events-none z-40 blood-overlay blood-active">
                    <div className="absolute inset-0 opacity-40 bg-[url('https://www.transparenttextures.com/patterns/black-linen-2.png')] mix-blend-multiply" />
                </div>
            )}

            {/* Intro Screen - Kept outside of scaled HUD so HUD scale setting does not affect main menu */}
            {gameState.phase === 'INTRO' && (
                <IntroScreen
                    playerName={playerName}
                    inputName={inputName}
                    setInputName={setInputName}
                    onStartGame={handleStartGame}
                    onOpenSettings={onOpenSettings}
                    onOpenGuide={onOpenGuide}
                    onOpenScoreboard={onOpenScoreboard}
                    onStartMultiplayer={onStartMultiplayer ?? (() => {})}
                />
            )}

            {/* Scaled UI */}
            <div className={`absolute z-20 pointer-events-none ${gameState.isHardMode ? 'vhs-flicker' : ''}`} style={uiStyle}>
                {/* Dynamic Scanline for Hard Mode */}
                {gameState.isHardMode && <div className="scan-line" />}

                {/* Known Shell - Mobile Optimized */}
                {knownShell && (
                    <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center px-4">
                        <div className="text-2xl md:text-7xl font-black tracking-widest bg-black/80 px-3 py-2 md:px-8 md:py-4 border-y-2 md:border-y-4 border-stone-100 animate-[text-pop_0.3s_ease-out] text-center">
                            CHAMBER: <RenderColoredText text={knownShell} />
                        </div>
                    </div>
                )}

                {/* Cuffs Indicators */}
                {(player.isHandcuffed || dealer.isHandcuffed) && (
                    <div className={`absolute ${player.isHandcuffed ? 'bottom-[30%] left-4 md:left-[20%]' : 'top-[20%] right-4 md:right-[20%]'} z-20 animate-pulse pointer-events-none`}>
                        <div className="text-sm md:text-2xl font-black text-stone-100 bg-red-600 px-2 py-0.5 md:px-4 md:py-1 rotate-12 shadow-lg border border-white">CUFFED</div>
                    </div>
                )}

                {/* Cinematic Letterbox for Round Announcements */}
                {overlayText?.startsWith('ROUND') && !showLootOverlay && (
                    <>
                        <div className="fixed top-0 left-0 w-full h-[12vh] bg-black z-[40] animate-in slide-in-from-top duration-1000 border-b border-white/5" />
                        <div className="fixed bottom-0 left-0 w-full h-[12vh] bg-black z-[40] animate-in slide-in-from-bottom duration-1000 border-t border-white/5" />
                    </>
                )}

                {/* Overlay Text - Centered Announcements */}
                {overlayText && !showLootOverlay && (
                    <div className={`absolute inset-0 z-50 flex justify-center pointer-events-none px-4 ${
                        gameState.phase === 'CARD_SELECT' ? 'items-start pt-12 md:pt-16' : 'items-center'
                    }`}>
                        {overlayText.startsWith('ROUND') || (overlayText.includes('LIVE') && overlayText.includes('|')) ? (
                            <div className="flex flex-col items-center">
                                {overlayText.startsWith('ROUND') ? (
                                    <div className="flex flex-col items-center gap-6 animate-in zoom-in-95 duration-1000">
                                        <div className="h-[2px] w-[300px] lg:w-[800px] bg-gradient-to-r from-transparent via-white/60 to-transparent shadow-[0_0_20px_rgba(255,255,255,0.3)]" />
                                        <div className="relative group">
                                            <div className="absolute inset-0 blur-[100px] bg-white/20 animate-pulse" />
                                            <h1 className="text-6xl lg:text-9xl font-black tracking-[0.6em] lg:tracking-[1.2em] text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.5)] transition-all uppercase italic text-center select-none">
                                                {overlayText}
                                            </h1>
                                        </div>
                                        <div className="h-[2px] w-[300px] lg:w-[800px] bg-gradient-to-r from-transparent via-white/60 to-transparent shadow-[0_0_20px_rgba(255,255,255,0.3)]" />
                                        <div className="flex flex-col items-center mt-2">
                                            <span className="text-[12px] lg:text-sm font-black tracking-[0.6em] text-white/60 uppercase animate-pulse">Synchronizing Protocol</span>
                                            <div className="flex gap-1 mt-4">
                                                {[...Array(3)].map((_, i) => (
                                                    <div key={i} className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-5 bg-gradient-to-b from-stone-950/92 to-black/98 backdrop-blur-3xl px-12 sm:px-20 py-8 sm:py-12 rounded-[2.5rem] border border-stone-850 shadow-[0_0_100px_rgba(0,0,0,0.95)] ring-1 ring-white/5 animate-in zoom-in-95 duration-1000">
                                        <div className="flex items-center gap-10 sm:gap-20">
                                            <div className="flex flex-col items-center group">
                                                <div className="flex items-center gap-3 sm:gap-5">
                                                    {/* Red Shell SVG */}
                                                    <svg className="w-8 h-12 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M8 17h8v3a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-3z" fill="currentColor" fillOpacity="0.45" />
                                                        <rect x="8" y="3" width="8" height="14" rx="1" fill="currentColor" fillOpacity="0.15" />
                                                        <line x1="10" y1="7" x2="14" y2="7" />
                                                        <line x1="10" y1="11" x2="14" y2="11" />
                                                        <line x1="8" y1="17" x2="16" y2="17" />
                                                    </svg>
                                                    <div className="relative">
                                                        <div className="absolute inset-0 blur-3xl bg-red-600/30 group-hover:bg-red-600/50 transition-colors" />
                                                        <span className="relative text-red-500 text-6xl sm:text-8xl font-black drop-shadow-[0_0_25px_rgba(239,68,68,0.75)] italic tracking-tighter transition-transform group-hover:scale-110 leading-none">
                                                            {overlayText.split('|')[0].trim().split(' ')[0]}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] sm:text-xs font-black tracking-[0.45em] text-red-400/90 uppercase mt-4">Live Shells</span>
                                            </div>
                                            
                                            <div className="w-[1px] h-24 bg-gradient-to-b from-transparent via-stone-800 to-transparent" />
                                            
                                            <div className="flex flex-col items-center group">
                                                <div className="flex items-center gap-3 sm:gap-5">
                                                    {/* Blue Shell SVG */}
                                                    <svg className="w-8 h-12 text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)] animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M8 17h8v3a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-3z" fill="currentColor" fillOpacity="0.45" />
                                                        <rect x="8" y="3" width="8" height="14" rx="1" fill="currentColor" fillOpacity="0.15" />
                                                        <line x1="10" y1="7" x2="14" y2="7" />
                                                        <line x1="10" y1="11" x2="14" y2="11" />
                                                        <line x1="8" y1="17" x2="16" y2="17" />
                                                    </svg>
                                                    <div className="relative">
                                                        <div className="absolute inset-0 blur-3xl bg-cyan-600/20 group-hover:bg-cyan-600/40 transition-colors" />
                                                        <span className="relative text-cyan-400 text-6xl sm:text-8xl font-black drop-shadow-[0_0_25px_rgba(34,211,238,0.75)] italic tracking-tighter transition-transform group-hover:scale-110 leading-none">
                                                            {overlayText.split('|')[1].trim().split(' ')[0]}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] sm:text-xs font-black tracking-[0.45em] text-cyan-400/80 uppercase mt-4">Blanks</span>
                                            </div>
                                        </div>
                                        <div className="mt-2 flex flex-col items-center gap-4 w-full">
                                            <div className="h-[1px] w-64 bg-gradient-to-r from-transparent via-stone-800 to-transparent" />
                                            <span className="text-[9.5px] font-black tracking-[0.8em] text-stone-400 uppercase flex items-center justify-center gap-2 mt-1 select-none">
                                                <span className="w-1.5 h-1.5 bg-red-650 rounded-full animate-ping shrink-0" />
                                                <span>CHAMBER_SYNCHRONIZED</span>
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : overlayText.startsWith('DESTROYED_ITEM::') ? (
                            (() => {
                                const [_, itemType, ownerName, friendlyName] = overlayText.split('::');
                                const IconComponent = Icons[itemType as keyof typeof Icons] || Icons.Crusher;
                                return (
                                    <div className="flex flex-col items-center text-center bg-black/95 px-10 py-6 border-y-2 border-red-500/35 backdrop-blur-md rounded-xl pop-in max-w-lg shadow-[0_0_50px_rgba(239,68,68,0.25)] border-red-650">
                                        <div className="text-red-500 animate-pulse mb-3 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                                            <IconComponent size={64} />
                                        </div>
                                        <div className="text-lg md:text-4xl font-black tracking-[0.15em] text-stone-100 drop-shadow-[0_0_20px_rgba(255,255,255,0.4)] uppercase italic leading-none">
                                            🔨 CRUSHED 🔨
                                        </div>
                                        <div className="text-xs md:text-lg font-bold tracking-[0.1em] text-stone-300 mt-3 uppercase not-italic">
                                            Destroyed {ownerName} <span className="text-red-400 font-extrabold">{friendlyName}</span>!
                                        </div>
                                    </div>
                                );
                            })()
                        ) : (
                            <div className="relative -top-16 flex flex-col items-center text-center bg-black/90 px-8 py-4 border-y-2 border-stone-100/20 backdrop-blur-md rounded-sm pop-in md:-top-20">
                                {overlayText.includes('\n') ? (
                                    <>
                                        <div className="text-lg md:text-5xl font-black tracking-[0.2em] text-stone-100 drop-shadow-[0_0_20px_rgba(255,255,255,0.4)] uppercase italic">
                                            <RenderColoredText text={overlayText.split('\n')[0]} />
                                        </div>
                                        <div className="text-xs md:text-lg font-bold tracking-[0.15em] text-stone-400 mt-2 uppercase not-italic">
                                            <RenderColoredText text={overlayText.split('\n')[1]} />
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-lg md:text-5xl font-black tracking-[0.2em] text-stone-100 drop-shadow-[0_0_20px_rgba(255,255,255,0.4)] uppercase italic">
                                        <RenderColoredText text={overlayText} />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Extraction / Looting logic remains inside scaled UI for alignment with depth */}
                {/* Stealing Screen Overlay */}
                {gameState.phase === 'STEALING' && gameState.turnOwner === 'PLAYER' && (
                    <div className="absolute inset-0 z-[110] flex flex-col items-center justify-center bg-red-950/20 backdrop-blur-[16px] px-6 pointer-events-auto animate-in fade-in duration-700 overflow-hidden">
                        {/* Atmospheric Overlays */}
                        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.3),transparent_70%)]" />
                        <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/black-linen-2.png')] animate-[pulse_4s_infinite]" />
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent animate-[scanline_3s_linear_infinite] shadow-[0_0_20px_rgba(220,38,38,0.5)]" />

                        <div className="relative z-10 flex flex-col items-center max-w-5xl w-full">
                            <div className="mb-14 text-center">
                                <h2 className="text-5xl md:text-8xl font-black text-white tracking-[-0.05em] mb-4 uppercase drop-shadow-[0_0_40px_rgba(255,0,0,0.4)] italic">
                                    Adrenaline <span className="text-red-700 animate-pulse">Extraction</span>
                                </h2>
                                <div className="flex flex-col items-center gap-2">
                                    <p className="text-stone-400 font-bold tracking-[0.6em] text-[9px] md:text-xs uppercase bg-black/40 px-6 py-1.5 rounded-full border border-red-900/30">
                                        Neural Link Active • Seize Repository
                                    </p>
                                    <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-red-900/50 to-transparent mt-2" />
                                </div>
                            </div>

                            {/* Extraction Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 md:gap-8 w-full max-w-6xl mx-auto">
                                {(() => {
                                    const targetItems = (gameState.isThreePlayer && gameState.adrenalineTargetOwner === 'PLAYER3' && player3)
                                        ? player3.items
                                        : dealer.items;

                                    if (targetItems.length === 0) {
                                        return (
                                            <div className="col-span-full py-32 text-center bg-black/40 rounded-3xl border border-white/5 backdrop-blur-xl">
                                                <div className="mb-4 inline-block p-4 rounded-full bg-stone-900/60 border border-white/10">
                                                    <Icons.Adrenaline size={48} className="text-stone-700 opacity-50" />
                                                </div>
                                                <p className="text-stone-500 font-black tracking-[0.4em] uppercase italic text-2xl">Vault Empty</p>
                                                <p className="text-stone-700 text-sm mt-2 font-bold tracking-widest uppercase truncate px-4">Subject Has No Extractable Assets</p>
                                            </div>
                                        );
                                    }
                                    return targetItems.map((item, idx) => {
                                        const isAdrenaline = item === 'ADRENALINE';
                                        const isTotemLocked = item === 'TOTEM';
                                        const isStealLocked = isAdrenaline || isTotemLocked;
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => !isStealLocked && onStealItem && onStealItem(idx)}
                                                disabled={isStealLocked}
                                                className={`group relative flex flex-col items-center justify-center aspect-[5/7] rounded-2xl border transition-all duration-700 overflow-hidden ${isStealLocked
                                                    ? 'bg-black/80 border-white/5 cursor-not-allowed grayscale-[0.8] opacity-60'
                                                    : 'bg-stone-900/60 border-white/10 hover:border-red-500 hover:bg-red-500/10 hover:shadow-[0_0_40px_rgba(239,68,68,0.2)] hover:-translate-y-2 active:scale-95 active:translate-y-0'
                                                    }`}
                                            >
                                                {/* Scanline effect for grid items */}
                                                <div className="absolute inset-0 bg-[linear-gradient(transparent_0%,rgba(255,255,255,0.03)_50%,transparent_100%)] bg-[length:100%_4px] animate-[scanline_4s_linear_infinite] pointer-events-none" />

                                                {/* Card BG Deco */}
                                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(circle_at_center,rgba(255,100,100,0.1),transparent_70%)]" />

                                                {isStealLocked ? (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-20">
                                                        {item === 'ADRENALINE' ? (
                                                            <Icons.Adrenaline size={48} className="text-stone-700 mb-2 opacity-30" />
                                                        ) : (
                                                            <Icons.Totem size={48} className="text-stone-700 mb-2 opacity-30" />
                                                        )}
                                                        <span className="text-[10px] font-black tracking-widest text-red-900 border border-red-900/40 px-2 py-1 rounded bg-black/80 rotate-12">LOCKED</span>
                                                    </div>
                                                ) : (
                                                    <div className="relative z-10 flex flex-col items-center">
                                                        <div className={`mb-4 transition-all duration-500 group-hover:scale-125 group-hover:drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] ${item === 'BEER' ? 'text-amber-500' :
                                                            item === 'CIGS' ? 'text-red-500' :
                                                                item === 'GLASS' ? 'text-cyan-400' :
                                                                    item === 'CUFFS' ? 'text-stone-300' :
                                                                        item === 'SAW' ? 'text-orange-600' :
                                                                            item === 'PHONE' ? 'text-blue-300' :
                                                                                item === 'INVERTER' ? 'text-green-400' :
                                                                                    item === 'CHOKE' ? 'text-stone-300' :
                                                                                        item === 'REMOTE' ? 'text-red-500' :
                                                                                            item === 'BIG_INVERTER' ? 'text-orange-500' :
                                                                                                item === 'CONTRACT' ? 'text-red-700' :
                                                                                                    item === 'LUCKYCHARM' ? 'text-emerald-500' :
                                                                                                        item === 'FLASHBANG' ? 'text-zinc-300' :
                                                                                                            item === 'CRUSHER' ? 'text-amber-600' :
                                                                                                                (item as ItemType) === 'TOTEM' ? 'text-amber-400' :
                                                                                                                    item === 'MIRROR' ? 'text-indigo-400' :
                                                                                                                        item === 'DECK_CARD' ? 'text-purple-400' : 'text-stone-300'
                                                            }`}>
                                                            {item === 'BEER' && <Icons.Beer size={56} />}
                                                            {item === 'CIGS' && <Icons.Cigs size={56} />}
                                                            {item === 'GLASS' && <Icons.Glass size={56} />}
                                                            {item === 'CUFFS' && <Icons.Cuffs size={56} />}
                                                            {item === 'SAW' && <Icons.Saw size={56} />}
                                                            {item === 'PHONE' && <Icons.Phone size={56} />}
                                                            {item === 'INVERTER' && <Icons.Inverter size={56} />}
                                                            {item === 'CHOKE' && <Icons.Choke size={56} />}
                                                            {item === 'REMOTE' && <Icons.Remote size={56} />}
                                                            {item === 'BIG_INVERTER' && <Icons.BigInverter size={56} />}
                                                            {item === 'CONTRACT' && <Icons.Contract size={56} />}
                                                            {item === 'LUCKYCHARM' && <Icons.Luckycharm size={56} />}
                                                            {item === 'FLASHBANG' && <Icons.Flashbang size={56} />}
                                                            {item === 'CRUSHER' && <Icons.Crusher size={56} />}
                                                            {(item as ItemType) === 'TOTEM' && <Icons.Totem size={56} />}
                                                            {item === 'MIRROR' && <Icons.Mirror size={56} />}
                                                            {item === 'DECK_CARD' && <Icons.DeckCard size={56} />}
                                                        </div>
                                                        <span className="text-[10px] md:text-sm font-black text-stone-200 tracking-[0.2em] uppercase group-hover:text-white transition-colors">
                                                            {item.replace('_', ' ')}
                                                        </span>
                                                        <span className="text-[7.5px] md:text-[9.5px] text-stone-400 font-bold uppercase tracking-widest text-center mt-1 px-2 group-hover:text-white/85 transition-colors leading-tight select-none">
                                                            {ITEM_DESCRIPTIONS[item]}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Hover Overlay info */}
                                                {!isAdrenaline && (
                                                    <div className="absolute bottom-0 left-0 w-full h-1/4 bg-red-600 flex items-center justify-center translate-y-full group-hover:translate-y-0 transition-all duration-300">
                                                        <span className="text-[10px] font-black text-white tracking-[0.4em] uppercase">EXTRACT</span>
                                                    </div>
                                                )}

                                                {/* Active pulse dot */}
                                                {!isAdrenaline && (
                                                    <div className="absolute top-3 right-3 opacity-20 group-hover:opacity-100 transition-opacity">
                                                        <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    });
                                })()}
                            </div>

                            <div className="mt-16 text-stone-600 text-[10px] font-bold tracking-[0.5em] uppercase flex items-center gap-6">
                                <div className="h-[1px] w-12 bg-stone-800" />
                                Operation Immediate Extraction
                                <div className="h-[1px] w-12 bg-stone-800" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Loot Overlay will be moved outside scaled div below */}



                {/* Game Over Screen */}
                {gameState.phase === 'GAME_OVER' && (
                    <GameOverScreen
                        winner={gameState.winner}
                        onResetGame={onResetGame}
                        matchData={matchData}
                        isDebugUsed={gameState.isDebugUsed}
                        isMultiplayer={isMultiplayer}
                    />
                )}

                {/* Main HUD */}
                {gameState.phase !== 'INTRO' && gameState.phase !== 'BOOT' && gameState.phase !== 'GAME_OVER' && !showLootOverlay && (
                    <div className="absolute inset-0 z-20 p-2 pb-0 md:p-8 md:pb-0 flex flex-col justify-between pointer-events-none">
                        
                        {gameState.phase === 'CARD_SELECT' && (
                            <div className="absolute top-[20%] left-1/2 transform -translate-x-1/2 z-30 flex flex-col items-center animate-in fade-in zoom-in duration-500 pointer-events-none">
                                <div className="px-6 py-2 bg-black/85 border border-purple-500/35 rounded-full shadow-[0_0_30px_rgba(168,85,247,0.2)] backdrop-blur-md">
                                    <span className="text-xs md:text-xl font-black tracking-[0.3em] uppercase text-purple-400 animate-pulse">
                                        {gameState.turnOwner === 'PLAYER' ? '🔮 SELECT A TAROT CARD 🔮' : `🔮 ${gameState.opponentName?.toUpperCase() || 'DEALER'} CHOOSING CARD... 🔮`}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Top Bar */}
                        <div className="flex justify-between items-start gap-2">
                            <StatusDisplay player={player} dealer={dealer} player3={player3} player4={player4} playerName={playerName} gameState={gameState} settings={settings} />
                            {!showExternalSettingsButton && (
                                <button onClick={() => {
                                    audioManager.playSound('click');
                                    onOpenSettings();
                                }} className="pointer-events-auto p-1 md:p-2 text-stone-600 hover:text-white transition-colors shrink-0">
                                    <SettingsIcon size={18} className="md:w-5 md:h-5" />
                                </button>
                            )}
                        </div>

                        {/* Bottom UI Area - Vertically stacked Controls & Inventory */}
                        <div className="mt-auto w-full flex flex-col items-center gap-2 md:gap-4 pointer-events-none pb-0 md:pb-0 z-30">
                            {/* Controls */}
                            {gameState.phase !== 'STEALING' && gameState.phase !== 'CARD_SELECT' && isMyTurn && !showLootOverlay && (
                                <div className="pointer-events-auto">
                                    <Controls
                                        isGunHeld={isGunHeld}
                                        isProcessing={isProcessing}
                                        isRecovering={isRecovering}
                                        onPickupGun={onPickupGun}
                                        onFireShot={onFireShot}
                                        onHoverTarget={onHoverTarget}
                                        currentAimTarget={aimTarget}
                                        isMultiplayer={isMultiplayer}
                                        isThreePlayer={gameState.isThreePlayer}
                                        isFourPlayer={gameState.isFourPlayer}
                                        mpGameState={mpGameState}
                                        mpMyPlayerId={mpMyPlayerId}
                                        settings={settings}
                                    />
                                </div>
                            )}

                            {/* Inventory */}
                            <div className="pointer-events-auto">
                                {gameState.phase === 'STEALING' && gameState.turnOwner === 'PLAYER' ? (
                                    <Inventory
                                        player={dealer} // Show DEALER items to steal
                                        dealer={player} // (Swap context)
                                        gameState={gameState}
                                        cameraView={cameraView}
                                        isProcessing={false}
                                        onUseItem={(idx) => {
                                            audioManager.playSound('grab');
                                            if (onStealItem) onStealItem(idx);
                                        }}
                                        disabled={false}
                                        settings={settings}
                                    />
                                ) : (
                                    <Inventory
                                        player={player}
                                        dealer={dealer}
                                        gameState={gameState}
                                        cameraView={cameraView}
                                        isProcessing={isProcessing}
                                        onUseItem={(idx) => {
                                            audioManager.playSound('grab');
                                            const item = player.items[idx];
                                            const targetedItems = ['CUFFS', 'ADRENALINE', 'CRUSHER', 'FLASHBANG'];
                                            if (gameState.isThreePlayer && targetedItems.includes(item)) {
                                                setPendingItemIndex(idx);
                                            } else {
                                                onUseItem(idx);
                                            }
                                        }}
                                        disabled={false}
                                        isGunHeld={isGunHeld}
                                        settings={settings}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {showExternalSettingsButton && gameState.phase !== 'INTRO' && gameState.phase !== 'BOOT' && gameState.phase !== 'GAME_OVER' && (
                <button
                    onClick={() => {
                        audioManager.playSound('click');
                        onOpenSettings();
                    }}
                    className="fixed top-4 right-4 z-[220] pointer-events-auto p-2 md:p-3 text-stone-600 hover:text-white bg-black/60 hover:bg-black/80 rounded-full transition-colors shadow-xl"
                    aria-label="Open settings"
                >
                    <SettingsIcon size={18} className="md:w-5 md:h-5" />
                </button>
            )}

            {/* Global Loot Overlay - Priority Layer Outside UI Scale */}
            {showLootOverlay && (
                <div className="fixed inset-0 z-[200]">
                    <LootOverlay receivedItems={receivedItems} />
                </div>
            )}

            {/* Global Chat Overlay - Visible whenever game is active (Multiplayer only) */}
            {isMultiplayer && gameState.phase !== 'INTRO' && gameState.phase !== 'BOOT' && (
                <>
                    {/* Render ChatBox & Stickers toggle buttons when both are minimized */}
                    {isChatMinimized && !isStickersOpen && (
                        <div className="absolute bottom-4 left-4 z-[100] pointer-events-auto select-none flex flex-col items-start gap-2">
                            {/* Stickers Toggle Button (Stacked above ChatBox toggle button) */}
                            <button
                                onClick={() => {
                                    audioManager.playSound('click');
                                    setIsStickersOpen(true);
                                    setIsChatMinimized(true);
                                }}
                                className="bg-stone-950/90 border border-cyan-500/30 hover:border-cyan-400 rounded-xl p-2.5 sm:p-3 text-cyan-500 hover:text-cyan-400 backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.15)] hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center group"
                                title="Stickers"
                            >
                                <Smile size={14} className="animate-pulse text-cyan-500 sm:w-[16px] sm:h-[16px]" />
                            </button>

                            {/* ChatBox Toggle Button */}
                            <button
                                onClick={() => {
                                    audioManager.playSound('click');
                                    setIsChatMinimized(false);
                                    setIsStickersOpen(false);
                                }}
                                className="relative bg-stone-950/90 border border-cyan-500/30 hover:border-cyan-400 rounded-xl px-4 py-2.5 text-[9px] sm:text-[10px] font-black tracking-[0.2em] uppercase text-cyan-500 hover:text-cyan-400 backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.15)] hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all duration-300 active:scale-95 cursor-pointer flex items-center gap-2 group"
                            >
                                <span className="absolute inset-0 rounded-xl border border-cyan-500/20 animate-ping opacity-75 pointer-events-none group-hover:animate-none" />
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                                </svg>
                                <span>ChatBox</span>

                                {unreadCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[8px] font-black text-white items-center justify-center leading-none">
                                            {unreadCount}
                                        </span>
                                    </span>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Chat Overlay Active (Hides stickers button) */}
                    {!isChatMinimized && (
                        <div className="absolute bottom-4 left-4 z-[100] w-[260px] sm:w-[320px] md:w-[360px] h-[180px] sm:h-[240px] md:h-[300px] pointer-events-auto transition-all duration-300 animate-in fade-in duration-200">
                            <div className="h-full flex flex-col justify-end">
                                <div className="bg-gradient-to-t from-black/90 to-black/50 backdrop-blur-3xl border border-white/[0.06] rounded-3xl overflow-hidden flex flex-col h-full shadow-[0_24px_80px_rgba(0,0,0,0.65)] group/chat transition-all hover:border-cyan-400/30">
                                    <div className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white/5 border-b border-white/[0.02] flex justify-between items-center select-none">
                                        <span className="text-[9px] sm:text-[10px] font-black tracking-[0.3em] text-stone-550 uppercase">ChatBox</span>
                                        <div className="flex items-center gap-3">
                                            <button 
                                                onClick={() => {
                                                    audioManager.playSound('click');
                                                    setIsChatMinimized(true);
                                                }}
                                                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.22em] text-stone-100 transition-all duration-200 hover:bg-cyan-500/15 hover:border-cyan-400/40 hover:text-cyan-300 shadow-sm shadow-cyan-500/10"
                                            >
                                                <Minimize2 size={12} className="text-cyan-300" />
                                                Minimize
                                            </button>
                                        </div>
                                    </div>
                                    <div
                                        ref={chatScrollRef}
                                        className="flex-1 overflow-y-auto p-2.5 sm:p-4 space-y-2 sm:space-y-3 text-[10px] sm:text-[11px] md:text-xs scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20"
                                    >
                                        {messages
                                            .filter(m => m.sender !== 'SYSTEM' && m.text && !m.text.startsWith('SYSTEM:') && !m.text.startsWith('[STICKER]:'))
                                            .map((msg, i) => (
                                                <div key={i} className="animate-in fade-in slide-in-from-left-1 duration-300 group">
                                                    <div className="flex items-baseline gap-2">
                                                        <span style={{ color: msg.color }} className="font-black text-[9px] sm:text-[10px] md:text-[11px] uppercase tracking-widest opacity-80 group-hover:opacity-100 transition-opacity whitespace-nowrap">{msg.sender}</span>
                                                        <span className="text-white font-medium break-words leading-relaxed drop-shadow-sm">{msg.text}</span>
                                                    </div>
                                                    {(() => {
                                                        const url = msg.text.match(/https?:\/\/[^\s]+/)?.[0];
                                                        return url ? <LinkPreviewCard url={url} /> : null;
                                                    })()}
                                                </div>
                                            ))}
                                    </div>
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            if (chatDraft.trim() && onSendMessage) {
                                                onSendMessage(chatDraft.trim());
                                                setChatDraft('');
                                            }
                                        }}
                                        className="p-2 sm:p-3 bg-white/5 border-t border-white/5 flex gap-2"
                                    >
                                        <input
                                            name="chat-input"
                                            type="text"
                                            value={chatDraft}
                                            onChange={(e) => setChatDraft(e.target.value)}
                                            autoComplete="off"
                                            placeholder="TYPE A MESSAGE..."
                                            className="flex-1 bg-black/40 border border-white/[0.04] rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-[9px] sm:text-[10px] md:text-xs text-stone-100 placeholder:text-stone-755 focus:outline-none focus:border-white/15 transition-all focus:bg-black/50 shadow-inner"
                                            onKeyDown={(e) => e.stopPropagation()}
                                        />
                                        <button
                                            type="submit"
                                            className="inline-flex items-center justify-center rounded-lg border border-white/[0.08] bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 px-3 py-1.5 text-[9px] sm:text-[10px] md:text-xs font-black uppercase tracking-[0.2em] transition-all duration-200 hover:text-white"
                                        >
                                            <Send size={14} />
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sticker Selection Overlay (Hides Chat overlay, shows Chat button next to it) */}
                    {isStickersOpen && (
                        <>
                            {/* Sticker Panel overlay container */}
                            <div className="absolute bottom-4 left-4 z-[100] w-[260px] sm:w-[320px] md:w-[360px] h-[180px] sm:h-[240px] md:h-[300px] pointer-events-auto transition-all duration-300 animate-in fade-in duration-200">
                                <div className="h-full flex flex-col justify-end">
                                    <div className="bg-gradient-to-t from-black/80 to-black/40 backdrop-blur-2xl border border-white/5 rounded-xl overflow-hidden flex flex-col h-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all hover:border-white/10">
                                        <div className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white/5 border-b border-white/5 flex justify-between items-center select-none">
                                            <span className="text-[9px] sm:text-[10px] font-black tracking-[0.3em] text-stone-500 uppercase">Stickers</span>
                                            <div className="flex items-center gap-3">
                                                <button 
                                                    onClick={() => {
                                                        audioManager.playSound('click');
                                                        setIsStickersOpen(false);
                                                    }}
                                                    className="text-stone-550 hover:text-white transition-colors text-[8px] sm:text-[9px] uppercase tracking-widest font-black cursor-pointer bg-transparent border-none outline-none"
                                                >
                                                    Minimize
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                            <div className="grid grid-cols-4 gap-2">
                                                {stickers.map((stk) => (
                                                    <button
                                                        key={stk}
                                                        onClick={() => {
                                                            audioManager.playSound('click');
                                                            if (onSendMessage) onSendMessage('[STICKER]:' + stk);
                                                            setIsStickersOpen(false);
                                                        }}
                                                        className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center rounded border border-white/10 bg-black/40 hover:bg-white/5 hover:border-cyan-500/50 p-1.5 transition-all active:scale-95 cursor-pointer"
                                                        title={stk}
                                                    >
                                                        <img src={`/sticker/${stk}`} alt={stk} className="w-full h-full object-contain rounded" />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ChatBox Toggle Button shown next to Sticker overlay so user can switch back */}
                            <div className="absolute bottom-4 left-[280px] sm:left-[340px] md:left-[380px] z-[100] pointer-events-auto select-none">
                                <button
                                    onClick={() => {
                                        audioManager.playSound('click');
                                        setIsChatMinimized(false);
                                        setIsStickersOpen(false);
                                    }}
                                    className="bg-stone-950/90 border border-cyan-500/30 hover:border-cyan-400 rounded-xl px-4 py-2.5 text-[9px] sm:text-[10px] font-black tracking-[0.2em] uppercase text-cyan-500 hover:text-cyan-400 backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.15)] active:scale-95 transition-all duration-300 cursor-pointer flex items-center gap-2 group"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                                    </svg>
                                    <span>ChatBox</span>
                                </button>
                            </div>
                        </>
                    )}
                </>
            )}

            {/* Minimized Chat Overlay - Visible in-game at above left corner when minimized (Filters out sticker logs) */}
            {isMultiplayer && gameState.phase !== 'INTRO' && gameState.phase !== 'BOOT' && isChatMinimized && showChatPreview && (
                <div className="absolute top-28 left-4 z-[100] pointer-events-none max-w-xs md:max-w-sm space-y-2 select-none">
                    {chatPreviewMessages.map((msg, i) => (
                        <div key={`${msg.timestamp}-${i}`} className="text-white text-xs font-semibold drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] animate-in fade-in slide-in-from-left-2 duration-300 flex items-baseline gap-1.5">
                            <span style={{ color: msg.color }} className="font-extrabold uppercase text-[10px] tracking-widest shrink-0">{msg.sender}:</span>
                            <span className="break-words">{msg.text}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Transparent Active Stickers Overlay - rendered on left side, auto fades after 8s, max 3 limit */}
            {isMultiplayer && gameState.phase !== 'INTRO' && gameState.phase !== 'BOOT' && activeStickers.length > 0 && (
                <div className="absolute bottom-[90px] sm:bottom-[120px] left-4 z-[100] pointer-events-none space-y-3 select-none flex flex-col-reverse items-start bg-transparent">
                    {activeStickers.map((stk) => (
                        <div key={stk.id} className="animate-in fade-in slide-in-from-left-3 duration-300 flex flex-col items-start bg-transparent">
                            <span style={{ color: stk.color }} className="font-extrabold uppercase text-[8px] tracking-widest drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)]">
                                {stk.sender}
                            </span>
                            <div className="w-[28px] h-[28px] sm:w-[100px] sm:h-[100px] object-contain drop-shadow-[0_3px_6px_rgba(0,0,0,0.85)] mt-0.5 bg-transparent">
                                <img src={`/sticker/${stk.filename}`} alt="Sticker" className="w-full h-full object-contain bg-transparent" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pinned Jackpot Sticker (Immunity Active) - shown in both singleplayer & multiplayer */}
            {gameState.phase !== 'INTRO' && gameState.phase !== 'BOOT' && (
                <>
                    {(player.jackpotImmunityShots || 0) > 0 && (
                        <div className="absolute top-[200px] left-4 z-[100] pointer-events-none flex flex-col items-start bg-transparent animate-pulse select-none">
                            <span className="font-extrabold uppercase text-[7px] tracking-widest text-amber-400 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)]">
                                {playerName} IMMUNITY ({player.jackpotImmunityShots})
                            </span>
                            <div className="w-[40px] h-[40px] sm:w-[90px] sm:h-[90px] object-contain drop-shadow-[0_3px_6px_rgba(0,0,0,0.85)] mt-0.5 bg-transparent border border-amber-500/40 rounded-lg p-1 bg-amber-950/20">
                                <img src="/sticker/sticker9.gif" alt="Jackpot Pinned" className="w-full h-full object-contain bg-transparent" />
                            </div>
                        </div>
                    )}
                    {(dealer.jackpotImmunityShots || 0) > 0 && (
                        <div className="absolute top-[200px] left-28 sm:left-32 z-[100] pointer-events-none flex flex-col items-start bg-transparent animate-pulse select-none">
                            <span className="font-extrabold uppercase text-[7px] tracking-widest text-stone-400 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)]">
                                {isMultiplayer ? getOpponentName() : 'DEALER'} IMMUNITY ({dealer.jackpotImmunityShots})
                            </span>
                            <div className="w-[40px] h-[40px] sm:w-[90px] sm:h-[90px] object-contain drop-shadow-[0_3px_6px_rgba(0,0,0,0.85)] mt-0.5 bg-transparent border border-stone-500/40 rounded-lg p-1 bg-stone-950/20">
                                <img src="/sticker/sticker9.gif" alt="Jackpot Pinned" className="w-full h-full object-contain bg-transparent" />
                            </div>
                        </div>
                    )}
                </>
            )}
            {pendingItemIndex !== null && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[250] flex flex-col items-center justify-center pointer-events-auto animate-in fade-in duration-300">
                    <div className="bg-stone-900 border-2 border-stone-800 p-6 md:p-10 rounded-2xl max-w-md w-full mx-4 shadow-[0_0_50px_rgba(0,0,0,0.8)] border-y-white/10 text-center">
                        <h2 className="text-2xl md:text-3xl font-black text-white tracking-widest uppercase mb-2">SELECT TARGET</h2>
                        <p className="text-stone-400 text-xs md:text-sm font-bold tracking-wider uppercase mb-8">
                            Select who to target with {player.items[pendingItemIndex].replace('_', ' ')}
                        </p>
                        <div className="flex flex-col gap-4">
                            {gameState.multiplayerState?.players
                                .filter((p: any) => p.id !== gameState.localPlayerId)
                                .map((targetPlayer: any) => {
                                    // Target relative owner check to determine HP
                                    const playersList = gameState.multiplayerState?.players || [];
                                    const myId = gameState.localPlayerId || '';
                                    const myIndex = playersList.findIndex((p: any) => p.id === myId);
                                    let targetHp = 1;
                                    if (myIndex !== -1) {
                                        const frontOpponent = playersList[(myIndex + 2) % 3];
                                        const sideOpponent = playersList[(myIndex + 1) % 3];
                                        if (frontOpponent && targetPlayer.id === frontOpponent.id) targetHp = dealer.hp;
                                        else if (sideOpponent && targetPlayer.id === sideOpponent.id && player3) targetHp = player3.hp;
                                        else targetHp = player.hp;
                                    }
                                    const isTargetDead = targetHp <= 0;
                                    
                                    return (
                                        <button
                                            key={targetPlayer.id}
                                            disabled={isTargetDead}
                                            onClick={() => {
                                                audioManager.playSound('click');
                                                onUseItem(pendingItemIndex, targetPlayer.id);
                                                setPendingItemIndex(null);
                                            }}
                                            className={`w-full py-4 px-6 border-2 font-black tracking-widest text-lg uppercase rounded-xl transition-all duration-300 ${
                                                isTargetDead
                                                    ? 'bg-stone-950/50 border-stone-900/60 text-stone-600 cursor-not-allowed italic'
                                                    : 'bg-stone-950 border-stone-800 text-stone-200 hover:border-white hover:bg-stone-100 hover:text-stone-950 active:scale-95'
                                            }`}
                                        >
                                            {targetPlayer.name} {isTargetDead && '(KNOCKED OUT)'}
                                        </button>
                                    );
                                })}
                        </div>
                        <button
                            onClick={() => {
                                audioManager.playSound('click');
                                setPendingItemIndex(null);
                            }}
                            className="mt-8 text-xs font-black tracking-widest text-stone-500 hover:text-white uppercase transition-colors"
                        >
                            [ CANCEL ]
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
