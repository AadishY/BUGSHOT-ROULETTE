import React from 'react';
import { PlayerState, GameState, GameSettings } from '../../types';
import { Icons } from './Icons';

interface StatusDisplayProps {
    player: PlayerState;
    dealer: PlayerState;
    playerName: string;
    gameState: GameState;
    settings?: GameSettings;
}

const StatusDisplayComponent: React.FC<StatusDisplayProps> = ({ player, dealer, playerName, gameState, settings }) => {
    const isBalanced = !!settings?.balancedPerformance || !!settings?.ultraPerformance;
    const isPotato = !!settings?.ultraPerformance;

    return (
        <div className="flex justify-between items-start w-full pointer-events-none px-1 md:px-2 py-2 md:py-4">
            {/* Player Side */}
            <div className="flex flex-col items-start min-w-[80px] md:w-1/3 animate-in slide-in-from-left duration-700">
                <div className="flex flex-col mb-4">
                    <span className="text-[10px] md:text-sm font-black tracking-[0.2em] md:tracking-[0.4em] text-stone-500 mb-1 uppercase truncate max-w-[80px] md:max-w-full flex items-center gap-1">
                        {playerName || 'OPERATOR'}
                        {player.isFlashbanged && <span className="text-red-500 animate-pulse text-[8px] md:text-xs font-black">⚡ BLINDED</span>}
                    </span>
                    <div className="flex items-center gap-1.5 md:gap-3">
                        {[...Array(player.maxHp)].map((_, i) => {
                            const isActive = i < player.hp;
                            const isLowHp = player.hp <= 1;
                            
                            let hpClass = '';
                            if (isActive) {
                                if (isPotato) {
                                    hpClass = 'bg-green-600 border-green-700';
                                } else {
                                    hpClass = `bg-gradient-to-t from-green-950 via-green-600/40 to-green-400/20 border-green-500/50 ${isBalanced ? '' : 'shadow-[0_0_20px_rgba(34,197,94,0.2)]'} ${isLowHp && !isBalanced ? 'animate-pulse' : ''}`;
                                }
                            } else {
                                if (isPotato) {
                                    hpClass = 'bg-neutral-900 border-neutral-850 opacity-20';
                                } else {
                                    hpClass = 'bg-stone-950 border-stone-800/40 opacity-10';
                                }
                            }

                            return (
                                <div key={i} className={`relative group w-2 h-6 md:w-6 md:h-20 border rounded-sm transition-all duration-1000 ${hpClass}`}>
                                    {isActive && !isPotato && (
                                        <>
                                            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(255,255,255,0.05)_50%,transparent_100%)] animate-[scanline_3s_linear_infinite]" />
                                            {isLowHp && !isBalanced && <div className="absolute inset-0 bg-red-600/20 blur-sm animate-pulse" />}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {player.jackpotImmunityShots !== undefined && player.jackpotImmunityShots > 0 && (
                        <div className="mt-2.5 flex items-center gap-1.5 bg-yellow-950/50 border border-yellow-500/30 px-2.5 py-1 rounded-lg text-[9px] md:text-[11px] font-black text-yellow-400 tracking-wider uppercase animate-pulse shadow-[0_0_15px_rgba(234,179,8,0.25)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-ping" />
                            <span>JACKPOT: {player.jackpotImmunityShots} SHOTS LEFT</span>
                        </div>
                    )}
                </div>

                {gameState.isHardMode && gameState.hardModeState && (
                    <div className="flex items-center gap-1 md:gap-2 bg-red-950/20 px-2 md:px-3 py-1 rounded-full border border-red-900/30">
                        <span className="text-[8px] md:text-xs font-black text-red-700 tracking-[0.2em] uppercase">PH</span>
                        <span className="text-xs md:text-lg text-red-500 font-black tracking-widest leading-none">
                            {gameState.hardModeState.round}<span className="text-[10px] text-red-900 mx-1">/</span>3
                        </span>
                    </div>
                )}

                {!gameState.isMultiplayer && !gameState.isHardMode && gameState.normalModeState && (
                    <div className="flex items-center gap-1 md:gap-2 bg-stone-900/40 px-2 md:px-3 py-1 rounded-full border border-stone-800/40">
                        <span className="text-[8px] md:text-xs font-black text-stone-500 tracking-[0.2em] uppercase">RD</span>
                        <span className="text-xs md:text-lg text-stone-350 font-black tracking-widest leading-none">
                            {gameState.normalModeState.round}<span className="text-[10px] text-stone-750 mx-1">/</span>2
                        </span>
                    </div>
                )}
            </div>

            {/* Center Protocol Display */}
            <div className="flex-1 flex flex-col items-center justify-start pt-1 md:pt-2 animate-in fade-in duration-1000">
                <div className={`relative px-2 md:px-6 py-1 md:py-2 rounded-xl overflow-hidden transition-all duration-500 border ${gameState.turnOwner === 'PLAYER'
                    ? 'bg-green-950/10 border-green-500/20'
                    : 'bg-red-950/10 border-red-500/20'
                    }`}>
                    {/* Pulsing light behind turn indicator */}
                    {!isBalanced && (
                        <div className={`absolute inset-0 blur-2xl opacity-20 -z-10 animate-pulse ${gameState.turnOwner === 'PLAYER' ? 'bg-green-500' : 'bg-red-600'
                            }`} />
                    )}

                    <div className={`text-[9px] md:text-3xl font-black tracking-[0.1em] md:tracking-[0.4em] transition-all duration-500 whitespace-nowrap uppercase italic ${gameState.turnOwner === 'PLAYER'
                        ? `text-green-500 ${isBalanced ? '' : 'drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]'}`
                        : `text-red-600 ${isBalanced ? '' : 'drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]'}`
                        } ${gameState.isHardMode && gameState.turnOwner === 'DEALER' && !isPotato ? 'animate-[chromatic_0.2s_infinite]' : ''}`}>
                        {gameState.turnOwner === 'PLAYER' ? 'YOUR TURN' : (gameState.opponentName?.toUpperCase() || "DEALER") + "'S TURN"}
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-4 mt-2 md:mt-4">
                    <div className="h-[1px] w-4 md:w-16 bg-gradient-to-r from-transparent via-stone-800 to-stone-800" />
                    <div className="flex items-center gap-1 md:gap-2 bg-stone-900/40 px-2 md:px-4 py-1 rounded-lg border border-white/5">
                        <Icons.Shell size={12} className="text-stone-400 md:hidden" />
                        <Icons.Shell size={16} className="text-stone-400 hidden md:block" />
                        <span className="text-stone-100 font-black text-[10px] md:text-xl tracking-[0.2em] tabular-nums leading-none">
                            {gameState.liveCount + gameState.blankCount}
                        </span>
                    </div>
                    <div className="h-[1px] w-4 md:w-16 bg-gradient-to-l from-transparent via-stone-800 to-stone-800" />
                </div>
            </div>

            {/* Dealer Side */}
            <div className="flex flex-col items-end min-w-[80px] md:w-1/3 animate-in slide-in-from-right duration-700">
                <div className="flex flex-col items-end">
                    <span className="text-[10px] md:text-sm font-black tracking-[0.2em] md:tracking-[0.4em] text-stone-500 mb-1 uppercase flex items-center gap-1">
                        {gameState.isMultiplayer ? (gameState.opponentName || 'OPPONENT') : 'DEALER'}
                        {dealer.isFlashbanged && <span className="text-red-500 animate-pulse text-[8px] md:text-xs font-black">⚡ BLINDED</span>}
                    </span>
                    <div className="flex gap-1 md:gap-2">
                        {[...Array(dealer.maxHp)].map((_, i) => {
                            const isActive = i < dealer.hp;
                            
                            let hpClass = '';
                            if (isActive) {
                                if (isPotato) {
                                    hpClass = 'bg-red-650 border-red-750';
                                } else {
                                    hpClass = `bg-gradient-to-t from-red-950/80 via-red-600/60 to-red-500/40 border-red-500/50 ${isBalanced ? '' : 'shadow-[0_0_25px_rgba(239,68,68,0.3)]'}`;
                                }
                            } else {
                                if (isPotato) {
                                    hpClass = 'bg-neutral-900 border-neutral-850 opacity-20';
                                } else {
                                    hpClass = 'bg-stone-950 border-stone-800/40 opacity-10';
                                }
                            }

                            return (
                                <div key={i} className={`relative group w-2 h-6 md:w-6 md:h-20 border rounded-sm transition-all duration-1000 ${hpClass}`}>
                                    {isActive && !isPotato && (
                                        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(255,255,255,0.1)_50%,transparent_100%)] animate-[scanline_3s_linear_infinite]" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Dealer Items Quick-View */}
                <div className="flex gap-1.5 flex-wrap justify-end max-w-[200px]">
                    {dealer.items.map((item, i) => (
                        <div key={i} className="w-4 h-4 md:w-9 md:h-9 bg-stone-900/60 backdrop-blur-sm border border-stone-800 group hover:border-white/20 transition-all rounded-lg flex items-center justify-center p-1 shadow-inner overflow-hidden">
                            <div className="transform transition-transform group-hover:scale-110">
                                {item === 'BEER' && <Icons.Beer size={20} className="w-2.5 h-2.5 md:w-5 md:h-5 text-amber-500/80" />}
                                {item === 'CIGS' && <Icons.Cigs size={20} className="w-2.5 h-2.5 md:w-5 md:h-5 text-red-500/80" />}
                                {item === 'GLASS' && <Icons.Glass size={20} className="w-2.5 h-2.5 md:w-5 md:h-5 text-cyan-500/80" />}
                                {item === 'CUFFS' && <Icons.Cuffs size={20} className="w-2.5 h-2.5 md:w-5 md:h-5 text-stone-400" />}
                                {item === 'SAW' && <Icons.Saw size={20} className="w-2.5 h-2.5 md:w-5 md:h-5 text-orange-600/80" />}
                                {item === 'PHONE' && <Icons.Phone size={20} className="w-2.5 h-2.5 md:w-5 md:h-5 text-blue-300/80" />}
                                {item === 'INVERTER' && <Icons.Inverter size={20} className="w-2.5 h-2.5 md:w-5 md:h-5 text-green-400/80" />}
                                {item === 'ADRENALINE' && <Icons.Adrenaline size={20} className="w-2.5 h-2.5 md:w-5 md:h-5 text-pink-500/80" />}
                                {item === 'CHOKE' && <Icons.Choke size={20} className="w-2.5 h-2.5 md:w-5 md:h-5 text-stone-300" />}
                                {item === 'REMOTE' && <Icons.Remote size={20} className="w-2.5 h-2.5 md:w-5 md:h-5 text-red-500/80" />}
                                {item === 'BIG_INVERTER' && <Icons.BigInverter size={20} className="w-2.5 h-2.5 md:w-5 md:h-5 text-orange-500/80" />}
                                {item === 'CONTRACT' && <Icons.Contract size={20} className="w-2.5 h-2.5 md:w-5 md:h-5 text-red-750/80" />}
                                {item === 'LUCKYCHARM' && <Icons.Luckycharm size={20} className="w-2.5 h-2.5 md:w-5 md:h-5 text-emerald-500/80" />}
                                {item === 'FLASHBANG' && <Icons.Flashbang size={20} className="w-2.5 h-2.5 md:w-5 md:h-5 text-zinc-300" />}
                                {item === 'CRUSHER' && <Icons.Crusher size={20} className="w-2.5 h-2.5 md:w-5 md:h-5 text-amber-600/80" />}
                                {item === 'TOTEM' && <Icons.Totem size={20} className="w-2.5 h-2.5 md:w-5 md:h-5 text-amber-500/80 animate-pulse" />}
                                {item === 'MIRROR' && <Icons.Mirror size={20} className="w-2.5 h-2.5 md:w-5 md:h-5 text-indigo-400" />}
                                {item === 'DECK_CARD' && <Icons.DeckCard size={20} className="w-2.5 h-2.5 md:w-5 md:h-5 text-purple-400" />}
                                {item === 'JACKPOT' && <Icons.Jackpot size={20} className="w-2.5 h-2.5 md:w-5 md:h-5 text-yellow-500/80" />}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
export const StatusDisplay = React.memo(StatusDisplayComponent);