import React, { useState } from 'react';
import { GameSettings, GameState, PlayerState, ItemType, ShellType, TurnOwner, PlayerModelKey } from '../../types';
import { ITEMS } from '../../constants';
import { Bug, X, Plus, Trash2, Heart, Shield, Award, RefreshCw, Zap } from 'lucide-react';

interface DebugOverlayProps {
    gameState: GameState;
    player: PlayerState;
    dealer: PlayerState;
    player3?: PlayerState;
    player4?: PlayerState;
    settings: GameSettings;
    setSettings: React.Dispatch<React.SetStateAction<GameSettings>>;
    setPlayer: React.Dispatch<React.SetStateAction<PlayerState>>;
    setDealer: React.Dispatch<React.SetStateAction<PlayerState>>;
    setPlayer3?: React.Dispatch<React.SetStateAction<PlayerState>>;
    setPlayer4?: React.Dispatch<React.SetStateAction<PlayerState>>;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    selectTarotCard?: (index: number) => Promise<void>;
    setCameraView?: (view: any) => void;
    onClose?: () => void;
    processItemEffect?: (user: TurnOwner, item: ItemType) => Promise<boolean>;
    onSyncDebugState?: (type: 'PLAYER' | 'DEALER' | 'PLAYER3' | 'PLAYER4' | 'GAMESTATE' | 'MULTIPLAYER_MODEL', state: any) => void;
}

export const DebugOverlay: React.FC<DebugOverlayProps> = ({
    gameState,
    player,
    dealer,
    player3,
    player4,
    setPlayer,
    setDealer,
    setPlayer3,
    setPlayer4,
    settings,
    setSettings,
    setGameState,
    selectTarotCard,
    setCameraView,
    onClose,
    processItemEffect,
    onSyncDebugState
}) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState<'chamber' | 'items' | 'status' | 'tarot'>('chamber');

    // Resolve player names / User IDs for developer debug menu
    let playerDisplayName = 'PLAYER';
    let dealerDisplayName = 'DEALER';
    let player3DisplayName = 'PLAYER3';
    let player4DisplayName = 'PLAYER4';

    try {
        const loggedInUser = localStorage.getItem('aadish_roulette_logged_in_user');
        if (loggedInUser) {
            const u = JSON.parse(loggedInUser);
            if (u.username) {
                playerDisplayName = u.username.toUpperCase();
            }
        }
    } catch (e) {}

    if (gameState.isMultiplayer) {
        const size = gameState.isFourPlayer ? 4 : (gameState.isThreePlayer ? 3 : 2);
        dealerDisplayName = (gameState.opponentName || 'OPPONENT').toUpperCase();

        const players = gameState.multiplayerState?.players || [];
        const myId = gameState.localPlayerId || '';
        const myIndex = players.findIndex((p: any) => p.id === myId);
        if (myIndex !== -1 && size >= 3) {
            const sideOpponent = players[(myIndex + 1) % size];
            if (sideOpponent) player3DisplayName = sideOpponent.name.toUpperCase();
            if (size >= 4) {
                const rightOpponent = players[(myIndex + 3) % size];
                if (rightOpponent) player4DisplayName = rightOpponent.name.toUpperCase();
            }
        }
    }

    // Mark the game as using debug features
    React.useEffect(() => {
        setGameState(prev => {
            if (prev.isDebugUsed) return prev;
            return { ...prev, isDebugUsed: true };
        });
    }, [setGameState]);

    // --- Avatar Model Options ---
    const modelOptions: { value: PlayerModelKey; label: string }[] = [
        { value: 'DEFAULT', label: 'Default' },
        { value: 'AADISH',  label: 'Aadish'  },
        { value: 'ASP',     label: 'Asp'     },
        { value: 'YASH',    label: 'Yash'    },
        { value: 'YUVRAJ',  label: 'Yuvraj'  },
    ];

    const playerList = gameState.multiplayerState?.players || [];

    const getPlayerDebugModel = (playerId: string, index: number) => {
        const debugModels = gameState.multiplayerState?.debugPlayerModels || {};
        if (Object.prototype.hasOwnProperty.call(debugModels, playerId)) {
            return debugModels[playerId] as PlayerModelKey;
        }
        if (Object.prototype.hasOwnProperty.call(debugModels, index)) {
            return debugModels[index] as PlayerModelKey;
        }
        if (gameState.multiplayerState?.players) {
            const playerInRoom = gameState.multiplayerState.players.find((p: any) => p.id === playerId);
            if (playerInRoom && playerInRoom.model) {
                return playerInRoom.model as PlayerModelKey;
            }
        }
        return 'DEFAULT';
    };

    const handleMultiplayerModelChange = (playerId: string, playerIndex: number, modelKey: PlayerModelKey) => {
        setGameState(prev => ({
            ...prev,
            multiplayerState: prev.multiplayerState
                ? {
                    ...prev.multiplayerState,
                    debugPlayerModels: {
                        ...(prev.multiplayerState.debugPlayerModels || {}),
                        [playerId]: modelKey,
                    },
                }
                : prev.multiplayerState,
        }));
        if (onSyncDebugState) onSyncDebugState('MULTIPLAYER_MODEL', { playerId, playerIndex, modelKey });
    };

    // --- Chamber Cheats ---

    const toggleShell = (index: number) => {
        setGameState(prev => {
            const newChamber = [...prev.chamber];
            newChamber[index] = newChamber[index] === 'LIVE' ? 'BLANK' : 'LIVE';
            const liveCount = newChamber.filter(s => s === 'LIVE').length;
            const blankCount = newChamber.filter(s => s === 'BLANK').length;
            const next = {
                ...prev,
                chamber: newChamber,
                liveCount,
                blankCount
            };
            if (onSyncDebugState) onSyncDebugState('GAMESTATE', next);
            return next;
        });
    };

    const makeAllShells = (type: ShellType) => {
        setGameState(prev => {
            const newChamber = prev.chamber.map(() => type);
            const liveCount = type === 'LIVE' ? prev.chamber.length : 0;
            const blankCount = type === 'BLANK' ? prev.chamber.length : 0;
            const next = {
                ...prev,
                chamber: newChamber,
                liveCount,
                blankCount
            };
            if (onSyncDebugState) onSyncDebugState('GAMESTATE', next);
            return next;
        });
    };

    const randomizeChamber = () => {
        setGameState(prev => {
            const newChamber = prev.chamber.map(() => Math.random() > 0.5 ? 'LIVE' : 'BLANK');
            const liveCount = newChamber.filter(s => s === 'LIVE').length;
            const blankCount = newChamber.filter(s => s === 'BLANK').length;
            const next = {
                ...prev,
                chamber: newChamber,
                liveCount,
                blankCount
            };
            if (onSyncDebugState) onSyncDebugState('GAMESTATE', next);
            return next;
        });
    };

    // --- Item Cheats ---
    const addItem = (target: 'player' | 'dealer' | 'player3' | 'player4', item: ItemType) => {
        const setter = target === 'player' ? setPlayer : (target === 'player3' && setPlayer3 ? setPlayer3 : (target === 'player4' && setPlayer4 ? setPlayer4 : setDealer));
        setter(prev => {
            if (prev.items.length >= 8) return prev;
            const next = {
                ...prev,
                items: [...prev.items, item]
            };
            if (onSyncDebugState) onSyncDebugState(target === 'player' ? 'PLAYER' : (target === 'player3' ? 'PLAYER3' : (target === 'player4' ? 'PLAYER4' : 'DEALER')), next);
            return next;
        });
    };

    const removeItem = (target: 'player' | 'dealer' | 'player3' | 'player4', index: number) => {
        const setter = target === 'player' ? setPlayer : (target === 'player3' && setPlayer3 ? setPlayer3 : (target === 'player4' && setPlayer4 ? setPlayer4 : setDealer));
        setter(prev => {
            const newItems = [...prev.items];
            newItems.splice(index, 1);
            const next = {
                ...prev,
                items: newItems
            };
            if (onSyncDebugState) onSyncDebugState(target === 'player' ? 'PLAYER' : (target === 'player3' ? 'PLAYER3' : (target === 'player4' ? 'PLAYER4' : 'DEALER')), next);
            return next;
        });
    };

    const clearItems = (target: 'player' | 'dealer' | 'player3' | 'player4') => {
        const setter = target === 'player' ? setPlayer : (target === 'player3' && setPlayer3 ? setPlayer3 : (target === 'player4' && setPlayer4 ? setPlayer4 : setDealer));
        setter(prev => {
            const next = { ...prev, items: [] };
            if (onSyncDebugState) onSyncDebugState(target === 'player' ? 'PLAYER' : (target === 'player3' ? 'PLAYER3' : (target === 'player4' ? 'PLAYER4' : 'DEALER')), next);
            return next;
        });
    };

    // --- Health Cheats ---
    const adjustHp = (target: 'player' | 'dealer' | 'player3' | 'player4', amount: number) => {
        const setter = target === 'player' ? setPlayer : (target === 'player3' && setPlayer3 ? setPlayer3 : (target === 'player4' && setPlayer4 ? setPlayer4 : setDealer));
        setter(prev => {
            const newHp = Math.min(prev.maxHp, Math.max(0, prev.hp + amount));
            if (newHp === 0 && !gameState.isThreePlayer && !gameState.isFourPlayer) {
                setGameState(g => {
                    const nextG = {
                        ...g,
                        phase: 'GAME_OVER' as any,
                        winner: (target === 'player' ? 'DEALER' : 'PLAYER') as any
                    };
                    if (onSyncDebugState) onSyncDebugState('GAMESTATE', nextG);
                    return nextG;
                });
            }
            const next = {
                ...prev,
                hp: newHp
            };
            if (onSyncDebugState) onSyncDebugState(target === 'player' ? 'PLAYER' : (target === 'player3' ? 'PLAYER3' : (target === 'player4' ? 'PLAYER4' : 'DEALER')), next);
            return next;
        });
    };

    const setMaxHp = (target: 'player' | 'dealer' | 'player3' | 'player4', amount: number) => {
        const setter = target === 'player' ? setPlayer : (target === 'player3' && setPlayer3 ? setPlayer3 : (target === 'player4' && setPlayer4 ? setPlayer4 : setDealer));
        setter(prev => {
            const newMax = Math.max(1, prev.maxHp + amount);
            const newHp = Math.min(newMax, prev.hp);
            const next = {
                ...prev,
                maxHp: newMax,
                hp: newHp
            };
            if (onSyncDebugState) onSyncDebugState(target === 'player' ? 'PLAYER' : (target === 'player3' ? 'PLAYER3' : (target === 'player4' ? 'PLAYER4' : 'DEALER')), next);
            return next;
        });
    };

    // --- Game flow cheats ---
    const setWinnerInstantly = (winner: TurnOwner) => {
        setGameState(prev => {
            const next = {
                ...prev,
                phase: 'GAME_OVER' as any,
                winner
            };
            if (onSyncDebugState) onSyncDebugState('GAMESTATE', next);
            return next;
        });
    };

    const togglePhase = () => {
        setGameState(prev => {
            const next = {
                ...prev,
                phase: (prev.phase === 'PLAYER_TURN' ? 'DEALER_TURN' : 'PLAYER_TURN') as any,
                turnOwner: (prev.phase === 'PLAYER_TURN' ? 'DEALER' : 'PLAYER') as any
            };
            if (onSyncDebugState) onSyncDebugState('GAMESTATE', next);
            return next;
        });
    };

    const triggerTarotCardPower = async (cardName: string) => {
        if (setCameraView) {
            setCameraView('TABLE');
        }
        setGameState(prev => ({
            ...prev,
            phase: 'CARD_SELECT' as any,
            deckCards: [{ name: cardName as any, power: 'Debug power' }],
            selectedCardIndex: null
        }));
        
        setTimeout(() => {
            if (selectTarotCard) {
                selectTarotCard(0);
            }
        }, 400);
    };




    if (isCollapsed) {
        return (
            <button
                onClick={() => setIsCollapsed(false)}
                className="fixed bottom-2 right-2 md:bottom-4 md:right-4 z-[999] p-1 md:p-1.5 bg-red-950/80 border border-red-700/50 text-red-500 rounded-full hover:bg-red-900 shadow-lg shadow-black/80 hover:scale-110 active:scale-95 transition-all flex items-center justify-center cursor-pointer animate-pulse"
                title="Open Debug Panel"
            >
                <Bug size={12} className="md:w-4 md:h-4" />
            </button>
        );
    }

    return (
        <div className="fixed bottom-2 right-2 md:bottom-4 md:right-4 z-[999] w-[88vw] sm:w-[44vw] md:w-[32vw] max-h-[70vh] sm:max-h-[78vh] md:max-h-[85vh] bg-stone-950/90 backdrop-blur-md border border-red-900/40 rounded-xl md:rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col font-mono text-[5px] sm:text-[6px] md:text-[10px] select-none">
            {/* Header */}
            <div className="p-1 bg-red-950/30 border-b border-red-900/30 flex justify-between items-center">
                <div className="flex items-center gap-1 text-red-500 font-extrabold tracking-widest text-[5px] sm:text-[6px] md:text-[8.5px] uppercase">
                    <Bug size={9} className="md:w-3 md:h-3 animate-pulse" />
                    <span>Debug Panel</span>
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={() => setIsCollapsed(true)}
                        className="text-stone-500 hover:text-white px-1 py-0.5 md:px-1.5 border border-stone-800 hover:border-stone-600 rounded bg-stone-900 cursor-pointer text-[6px] sm:text-[7px] md:text-[9px] uppercase font-bold"
                    >
                        Minimize
                    </button>
                    {onClose && (
                        <button onClick={onClose} className="text-stone-500 hover:text-white cursor-pointer">
                            <X size={10} className="md:w-3 md:h-3" />
                        </button>
                    )}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-stone-800 bg-stone-900/40">
                <button
                    onClick={() => setActiveTab('chamber')}
                    className={`flex-1 py-0.5 text-center font-bold tracking-wider text-[5.5px] sm:text-[6.5px] md:text-[8.5px] uppercase cursor-pointer transition-all border-b-2 ${activeTab === 'chamber' ? 'text-red-500 border-red-600 bg-red-950/10' : 'text-stone-500 border-transparent hover:text-stone-300'}`}
                >
                    Chamber
                </button>
                <button
                    onClick={() => setActiveTab('items')}
                    className={`flex-1 py-0.5 text-center font-bold tracking-wider text-[5px] sm:text-[6px] md:text-[8px] uppercase cursor-pointer transition-all border-b-2 ${activeTab === 'items' ? 'text-red-500 border-red-600 bg-red-950/10' : 'text-stone-500 border-transparent hover:text-stone-300'}`}
                >
                    Items
                </button>
                <button
                    onClick={() => setActiveTab('status')}
                    className={`flex-1 py-0.5 text-center font-bold tracking-wider text-[5px] sm:text-[6px] md:text-[8px] uppercase cursor-pointer transition-all border-b-2 ${activeTab === 'status' ? 'text-red-500 border-red-600 bg-red-950/10' : 'text-stone-500 border-transparent hover:text-stone-300'}`}
                >
                    Status
                </button>
                <button
                    onClick={() => setActiveTab('tarot')}
                    className={`flex-1 py-0.5 text-center font-bold tracking-wider text-[5px] sm:text-[6px] md:text-[8px] uppercase cursor-pointer transition-all border-b-2 ${activeTab === 'tarot' ? 'text-red-500 border-red-600 bg-red-950/10' : 'text-stone-500 border-transparent hover:text-stone-300'}`}
                >
                    Item Power
                </button>
            </div>

            {/* Content Area */}
            <div className="p-1 md:p-2 flex-1 overflow-y-auto max-h-[44vh] sm:max-h-[50vh] md:max-h-96 space-y-1.5 md:space-y-2 custom-scrollbar text-stone-300">
                
                {/* TAB 1: CHAMBER */}
                {activeTab === 'chamber' && (
                    <div className="space-y-3 md:space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="font-extrabold tracking-widest text-stone-500 uppercase text-[5.5px] md:text-[7px]">Chamber State</span>
                            <span className="text-[6px] md:text-[7px] text-white bg-stone-900 border border-white/5 px-1 py-0.5 rounded">
                                {gameState.liveCount}L | {gameState.blankCount}B
                            </span>
                        </div>

                        {/* Chamber Shell Grid */}
                        {gameState.chamber.length === 0 ? (
                            <div className="text-center py-3 text-stone-600 uppercase tracking-widest text-[7px] md:text-[8px]">
                                Chamber is Empty
                            </div>
                        ) : (
                            <div className="grid grid-cols-4 gap-0.5">
                                {gameState.chamber.map((shell, idx) => {
                                    const isCurrent = gameState.currentShellIndex === idx;
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => toggleShell(idx)}
                                            className={`p-0.5 md:p-1 border rounded-md md:rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer select-none active:scale-95 ${isCurrent ? 'ring-2 ring-red-500 border-red-600' : 'border-stone-800 hover:border-stone-600'} ${shell === 'LIVE' ? 'bg-red-950/20 text-red-400 border-red-900/30' : 'bg-blue-950/20 text-blue-400 border-blue-900/30'}`}
                                        >
                                            <span className="text-[7px] md:text-[8px] font-bold text-stone-500 uppercase">#{idx + 1}</span>
                                            <span className="font-black text-[7px] md:text-[8px]">{shell}</span>
                                            {isCurrent && <span className="text-[5.5px] md:text-[6.5px] bg-red-500 text-white font-extrabold px-0.5 rounded uppercase animate-pulse">Current</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Quick Chamber Controls */}
                        <div className="grid grid-cols-3 gap-0.5 pt-1 border-t border-stone-900">
                            <button
                                onClick={() => makeAllShells('LIVE')}
                                className="py-0.5 bg-red-950/40 border border-red-900/40 text-red-400 rounded hover:bg-red-900/40 cursor-pointer font-bold uppercase text-[6px] md:text-[7px]"
                            >
                                All Live
                            </button>
                            <button
                                onClick={() => makeAllShells('BLANK')}
                                className="py-0.5 md:py-1 bg-blue-950/40 border border-blue-900/40 text-blue-400 rounded hover:bg-blue-900/40 cursor-pointer font-bold uppercase text-[7px] md:text-[8px]"
                            >
                                All Blank
                            </button>
                            <button
                                onClick={randomizeChamber}
                                className="py-0.5 md:py-1 bg-stone-900 border border-stone-800 text-stone-300 rounded hover:bg-stone-850 cursor-pointer font-bold uppercase text-[7px] md:text-[8px] flex items-center justify-center gap-0.5"
                            >
                                <RefreshCw size={8} className="md:w-[10px] md:h-[10px]" /> Rand
                            </button>
                        </div>
                    </div>
                )}

                {/* TAB 2: ITEMS */}
                {activeTab === 'items' && (
                    <div className="space-y-3 md:space-y-4">
                        {/* Target selection */}
                        {['player', 'dealer', ...(gameState.isThreePlayer && player3 ? ['player3'] : [])].map((target) => {
                            const state = target === 'player' ? player : (target === 'player3' ? player3! : dealer);
                            const targetName = target === 'player' ? playerDisplayName : (target === 'player3' ? player3DisplayName : dealerDisplayName);
                            return (
                                <div key={target} className="space-y-1.5 md:space-y-2 border-b border-stone-900 pb-2.5 md:pb-3 last:border-0 last:pb-0">
                                    <div className="flex justify-between items-center">
                                        <span className="font-extrabold tracking-widest text-stone-500 uppercase text-[6px] md:text-[8px]">{targetName} Inventory</span>
                                        <button
                                            onClick={() => clearItems(target as any)}
                                            className="text-[6px] md:text-[7.5px] text-red-500 hover:text-red-400 font-bold uppercase tracking-wider cursor-pointer"
                                        >
                                            Clear All
                                        </button>
                                    </div>

                                    {/* Inventory Items List */}
                                    <div className="flex flex-wrap gap-0.5 min-h-4 md:min-h-6">
                                        {state.items.length === 0 ? (
                                            <span className="text-[6px] md:text-[7.5px] text-stone-600 uppercase tracking-widest">No Items</span>
                                        ) : (
                                            state.items.map((item, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-center gap-0.5 bg-stone-900 border border-stone-800 px-0.5 py-0.5 rounded-md text-[6.5px] md:text-[8px]"
                                                >
                                                    <span className="text-white font-extrabold">{item}</span>
                                                    <button
                                                        onClick={() => removeItem(target as any, idx)}
                                                        className="text-red-500 hover:text-red-400 ml-0.5 cursor-pointer"
                                                    >
                                                        <Trash2 size={8} className="md:w-[10px] md:h-[10px]" />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Quick Add Items Palette */}
                                    <div className="pt-1 md:pt-1.5">
                                        <span className="text-[6.5px] md:text-[7.5px] text-stone-600 uppercase font-bold tracking-widest block mb-1 md:mb-1.5">Add Item:</span>
                                        <div className="flex flex-wrap gap-0.5 max-h-16 md:max-h-24 overflow-y-auto pr-0.5 custom-scrollbar">
                                            {ITEMS.map((item) => (
                                                <button
                                                    key={item}
                                                    onClick={() => addItem(target as any, item)}
                                                    className="px-0.5 py-0.5 md:px-1 bg-stone-900 hover:bg-stone-800 text-[6px] md:text-[7px] text-stone-400 hover:text-white font-extrabold rounded border border-stone-800 cursor-pointer uppercase tracking-wider"
                                                >
                                                    +{item}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* TAB 3: STATUS / FLOW */}
                {activeTab === 'status' && (
                    <div className="space-y-3 md:space-y-4">
                        {/* Players in session */}
                        <div className="space-y-2 md:space-y-3">
                            <span className="font-extrabold tracking-widest text-stone-500 uppercase text-[7.5px] md:text-[9px] block">Players</span>
                            <div className="space-y-1">
                                <div className="flex justify-between items-center bg-stone-900/50 px-1.5 py-0.75 rounded border border-stone-800">
                                    <span className="text-[6px] md:text-[7.5px] text-stone-500 uppercase tracking-widest">You</span>
                                    <span className="font-black text-white text-[7px] md:text-[8.5px] uppercase tracking-wide">{playerDisplayName}</span>
                                </div>
                                <div className="flex justify-between items-center bg-stone-900/50 px-2 py-1 rounded border border-stone-800">
                                    <span className="text-[6.5px] md:text-[8px] text-stone-500 uppercase tracking-widest">Front</span>
                                    <span className="font-black text-white text-[7px] md:text-[8.5px] uppercase tracking-wide">{dealerDisplayName}</span>
                                </div>
                                {(gameState.isThreePlayer || gameState.isFourPlayer) && (
                                    <div className="flex justify-between items-center bg-stone-900/50 px-2 py-1 rounded border border-stone-800">
                                        <span className="text-[6.5px] md:text-[8px] text-stone-500 uppercase tracking-widest">Left</span>
                                        <span className="font-black text-white text-[7px] md:text-[8.5px] uppercase tracking-wide">{player3DisplayName}</span>
                                    </div>
                                )}
                                {gameState.isFourPlayer && (
                                    <div className="flex justify-between items-center bg-stone-900/50 px-2 py-1 rounded border border-stone-800">
                                        <span className="text-[6.5px] md:text-[8px] text-stone-500 uppercase tracking-widest">Right</span>
                                        <span className="font-black text-white text-[7px] md:text-[8.5px] uppercase tracking-wide">{player4DisplayName}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {gameState.isMultiplayer && (
                            <div className="space-y-2 md:space-y-3 pt-1.5 md:pt-2 border-t border-stone-900">
                                <span className="font-extrabold tracking-widest text-stone-500 uppercase text-[7.5px] md:text-[9px] block">Multiplayer Avatar Models</span>
                                <div className="space-y-1.5">
                                    {playerList.map((entry: any, index: number) => (
                                        <div key={entry.id} className="flex items-center justify-between gap-1 bg-stone-900/50 px-1 py-0.75 rounded border border-stone-800">
                                            <span className="font-bold text-[6px] md:text-[7.5px] uppercase text-stone-300">
                                                {entry.id === gameState.localPlayerId ? 'YOU' : entry.name}
                                            </span>
                                            <select
                                                value={getPlayerDebugModel(entry.id, index)}
                                                onChange={(e) => handleMultiplayerModelChange(entry.id, index, e.target.value as PlayerModelKey)}
                                                className="bg-stone-950 border border-stone-700 text-[5.5px] md:text-[6.5px] text-stone-200 rounded px-1 py-0.5 font-bold uppercase cursor-pointer"
                                            >
                                                {modelOptions.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="space-y-2 md:space-y-3 pt-1 border-t border-stone-900">
                            <span className="font-extrabold tracking-widest text-stone-500 uppercase text-[6.5px] md:text-[8px] block">Local Head Model</span>
                            <div className="flex items-center justify-between gap-1 bg-stone-900/50 px-1 py-1 rounded border border-stone-800">
                                <span className="font-bold text-[7px] md:text-[8px] uppercase text-stone-300">Dealer Head</span>
                                <select
                                    value={settings.debugHeadModel || 'DEFAULT'}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        debugHeadModel: e.target.value as PlayerModelKey
                                    })}
                                    className="bg-stone-950 border border-stone-700 text-[6.5px] md:text-[7.5px] text-stone-200 rounded px-1 py-0.5 font-bold uppercase cursor-pointer"
                                >
                                    {modelOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Health settings */}
                        <div className="space-y-2 md:space-y-3">
                            <span className="font-extrabold tracking-widest text-stone-500 uppercase text-[6px] md:text-[7.5px] block">Health Editor</span>
                            {['player', 'dealer', ...(gameState.isThreePlayer && player3 ? ['player3'] : [])].map((target) => {
                                const state = target === 'player' ? player : (target === 'player3' ? player3! : dealer);
                                const targetName = target === 'player' ? playerDisplayName : (target === 'player3' ? player3DisplayName : dealerDisplayName);
                                return (
                                    <div key={target} className="flex justify-between items-center bg-stone-900/50 p-1 border border-stone-900 rounded-lg">
                                        <span className="font-bold text-[6.5px] md:text-[8px] uppercase text-stone-400">{targetName} HP:</span>
                                        
                                        <div className="flex items-center gap-1 md:gap-1.5">
                                            {/* HP indicator */}
                                            <div className="flex items-center gap-0.5 md:gap-1">
                                                <Heart size={7} className="md:w-[9px] md:h-[9px] text-red-500 fill-red-500" />
                                                <span className="font-black text-white tabular-nums text-[6px] md:text-[7.5px]">{state.hp}/{state.maxHp}</span>
                                            </div>

                                            {/* Modifiers */}
                                            <div className="flex gap-0.5 md:gap-1">
                                                <button
                                                    onClick={() => adjustHp(target as any, -1)}
                                                    className="w-4 h-4 md:w-5 md:h-5 bg-stone-950 border border-stone-800 text-stone-400 hover:text-white font-black rounded flex items-center justify-center cursor-pointer active:scale-90 text-[7px] md:text-[8px]"
                                                >
                                                    -
                                                </button>
                                                <button
                                                    onClick={() => adjustHp(target as any, 1)}
                                                    className="w-4 h-4 md:w-5 md:h-5 bg-stone-950 border border-stone-800 text-stone-400 hover:text-white font-black rounded flex items-center justify-center cursor-pointer active:scale-90 text-[7px] md:text-[8px]"
                                                >
                                                    +
                                                </button>
                                                <button
                                                    onClick={() => setMaxHp(target as any, 1)}
                                                    className="px-0.5 md:px-1 bg-stone-950 border border-stone-800 text-[5.5px] md:text-[7px] text-stone-500 hover:text-white font-black rounded flex items-center justify-center cursor-pointer active:scale-90 uppercase tracking-widest"
                                                    title="Increase Max HP"
                                                >
                                                    +Max
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Phase & Winner Controls */}
                        <div className="space-y-2 md:space-y-3 pt-1 md:pt-1.5 border-t border-stone-900">
                            <span className="font-extrabold tracking-widest text-stone-500 uppercase text-[6.5px] md:text-[8px] block">Flow Commands</span>
                            
                            <div className="grid grid-cols-2 gap-0.5 md:gap-1">
                                <button
                                    onClick={togglePhase}
                                    className="py-0.5 md:py-1 bg-stone-900 border border-stone-800 hover:border-stone-700 text-stone-300 rounded hover:bg-stone-850 cursor-pointer font-bold uppercase text-[6px] md:text-[7px] flex items-center justify-center gap-1"
                                >
                                    <Zap size={8} className="md:w-[10px] md:h-[10px] text-yellow-500" /> Switch Turn
                                </button>
                                <button
                                    onClick={() => setWinnerInstantly('PLAYER')}
                                    className="py-0.5 md:py-1 bg-green-950/40 border border-green-900/40 text-green-400 rounded hover:bg-green-900/30 cursor-pointer font-bold uppercase text-[6px] md:text-[7px] flex items-center justify-center gap-1"
                                >
                                    <Award size={8} className="md:w-[10px] md:h-[10px]" /> Win {playerDisplayName}
                                </button>
                                <button
                                    onClick={() => setWinnerInstantly('DEALER')}
                                    className="py-0.5 md:py-1 bg-red-950/40 border border-red-900/40 text-red-400 rounded hover:bg-red-900/30 cursor-pointer font-bold uppercase text-[6px] md:text-[7px] flex items-center justify-center gap-1"
                                    style={{ gridColumn: 'span 2' }}
                                >
                                    <Award size={8} className="md:w-[10px] md:h-[10px]" /> Win {dealerDisplayName}
                                </button>
                            </div>


                        </div>

                        <div className="text-[7px] md:text-[8px] text-stone-600 uppercase font-bold tracking-widest pt-1.5 md:pt-2 border-t border-stone-900 text-center">
                            Phase: {gameState.phase} | Owner: {gameState.turnOwner}
                        </div>
                    </div>
                )}

                {/* TAB 4: ITEM POWER */}
                {activeTab === 'tarot' && (
                    <div className="space-y-2 md:space-y-3">
                        {/* Jackpot Cheats */}
                        <div className="space-y-1.5 md:space-y-2 pb-2 border-b border-stone-900">
                            <span className="font-extrabold tracking-widest text-stone-500 uppercase text-[6px] md:text-[7.5px] block">Jackpot Cheats</span>
                            <div className="grid grid-cols-3 gap-0.5 mb-1">
                                <button
                                    onClick={() => {
                                        (window as any).__debugJackpotForcedOutcome = 'JACKPOT';
                                    }}
                                    className="py-0.5 bg-yellow-950/40 border border-yellow-800/40 text-yellow-400 rounded hover:bg-yellow-900/30 cursor-pointer font-bold uppercase text-[6px] md:text-[7px]"
                                >
                                    Force Win
                                </button>
                                <button
                                    onClick={() => {
                                        (window as any).__debugJackpotForcedOutcome = 'NORMAL';
                                    }}
                                    className="py-0.5 bg-blue-950/40 border border-blue-800/40 text-blue-400 rounded hover:bg-blue-900/30 cursor-pointer font-bold uppercase text-[6px] md:text-[7px]"
                                >
                                    Force Normal
                                </button>
                                <button
                                    onClick={() => {
                                        (window as any).__debugJackpotForcedOutcome = 'LOSE';
                                    }}
                                    className="py-0.5 bg-red-950/40 border border-red-800/40 text-red-400 rounded hover:bg-red-900/30 cursor-pointer font-bold uppercase text-[6px] md:text-[7px]"
                                >
                                    Force Lose
                                </button>
                            </div>
                            {processItemEffect && (
                                <button
                                    onClick={() => {
                                        processItemEffect('PLAYER', 'JACKPOT');
                                    }}
                                    className="w-full py-0.5 bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/30 cursor-pointer font-bold uppercase text-[6px] md:text-[7px] text-center"
                                >
                                    🎰 Trigger Jackpot Power
                                </button>
                            )}
                        </div>

                        <span className="font-extrabold tracking-widest text-stone-500 uppercase text-[6px] md:text-[7.5px] block">Trigger Tarot Power</span>
                        
                        <div className="grid grid-cols-2 gap-0.5 md:gap-1 max-h-[18vh] md:max-h-60 overflow-y-auto pr-0.5 custom-scrollbar p-0.5">
                            {[
                                'The Magician', 'The Hanged Man', 'The Hermit', 'The Moon', 
                                'Judgment', 'Wheel of Fortune', 'The Sun', 'Death', 
                                'The Tower', 'The Fool', 'Justice', 'Temperance'
                            ].map((cardName) => (
                                <button
                                    key={cardName}
                                    onClick={() => triggerTarotCardPower(cardName)}
                                    disabled={gameState.phase === 'CARD_SELECT' && gameState.selectedCardIndex !== null}
                                    className="py-0.5 bg-purple-950/20 hover:bg-purple-900/35 border border-purple-900/40 hover:border-purple-600 text-purple-400 hover:text-purple-300 rounded cursor-pointer font-bold uppercase text-[5.5px] md:text-[7px] disabled:opacity-40 disabled:pointer-events-none transition-all active:scale-95 text-center"
                                >
                                    {cardName}
                                </button>
                            ))}
                        </div>
                        <div className="text-[6.5px] md:text-[7.5px] text-stone-600 uppercase font-bold tracking-wider text-center mt-1 border-t border-stone-900 pt-1">
                            Sets 1-card deck & auto-reveals
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
