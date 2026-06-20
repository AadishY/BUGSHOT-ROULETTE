import React, { useEffect, useState } from 'react';
import { ItemType } from '../../types';
import { Icons } from './Icons';

interface LootOverlayProps {
    receivedItems: ItemType[];
}

const ITEM_NAMES: Record<ItemType, string> = {
    'BEER': 'BEER',
    'CIGS': 'CIGARETTES',
    'GLASS': 'MAGNIFIER',
    'CUFFS': 'HANDCUFFS',
    'SAW': 'HAND SAW',
    'PHONE': 'BURNER PHONE',
    'INVERTER': 'INVERTER',
    'ADRENALINE': 'ADRENALINE',
    'CHOKE': 'CHOKE MOD',
    'REMOTE': 'REMOTE',
    'BIG_INVERTER': 'BIG INVERTER',
    'CONTRACT': 'BLOOD CONTRACT',
    'LUCKYCHARM': 'LUCKY CHARM',
    'FLASHBANG': 'FLASHBANG',
    'CRUSHER': 'CRUSHER',
    'TOTEM': 'TOTEM OF UNDYING',
    'MIRROR': 'MIRROR',
    'DECK_CARD': 'TAROT CARD DECK'
};

const ITEM_COLORS: Record<ItemType, string> = {
    'BEER': 'text-amber-500 border-amber-500/50 bg-amber-950/30',
    'CIGS': 'text-red-500 border-red-500/50 bg-red-950/30',
    'GLASS': 'text-cyan-500 border-cyan-500/50 bg-cyan-950/30',
    'CUFFS': 'text-stone-400 border-stone-400/50 bg-stone-900/50',
    'SAW': 'text-orange-600 border-orange-600/50 bg-orange-950/30',
    'PHONE': 'text-blue-300 border-blue-300/50 bg-blue-950/30',
    'INVERTER': 'text-green-400 border-green-500/50 bg-green-950/30',
    'ADRENALINE': 'text-pink-500 border-pink-500/50 bg-pink-950/30',
    'CHOKE': 'text-yellow-700 border-yellow-700/50 bg-yellow-950/30',
    'REMOTE': 'text-red-600 border-red-600/50 bg-red-950/30',
    'BIG_INVERTER': 'text-orange-500 border-orange-500/50 bg-orange-950/30',
    'CONTRACT': 'text-red-700 border-red-700/50 bg-red-950/30',
    'LUCKYCHARM': 'text-emerald-500 border-emerald-500/50 bg-emerald-950/30',
    'FLASHBANG': 'text-zinc-300 border-zinc-300/50 bg-zinc-900/30',
    'CRUSHER': 'text-amber-600 border-amber-500/55 bg-amber-950/35',
    'TOTEM': 'text-amber-400 border-amber-400/50 bg-amber-950/30',
    'MIRROR': 'text-indigo-400 border-indigo-400/50 bg-indigo-950/30',
    'DECK_CARD': 'text-purple-400 border-purple-400/50 bg-purple-950/30'
};

export const LootOverlay: React.FC<LootOverlayProps> = ({ receivedItems }) => {
    // Staggered reveal effect
    const [visibleCount, setVisibleCount] = useState(0);

    useEffect(() => {
        setVisibleCount(0);
        const interval = setInterval(() => {
            setVisibleCount(prev => {
                if (prev < receivedItems.length) return prev + 1;
                clearInterval(interval);
                return prev;
            });
        }, 300); // Reveal one every 300ms
        return () => clearInterval(interval);
    }, [receivedItems]);

    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-2xl p-4 animate-in fade-in duration-1000">
            {/* Background Grid/Scanlines */}
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                <div className="absolute inset-0 bg-[linear-gradient(transparent_0%,rgba(255,255,255,0.05)_50%,transparent_100%)] bg-[length:100%_4px] animate-[scanline_8s_linear_infinite]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(50,50,50,0.5)_0%,transparent_100%)]" />
            </div>

            <div className="relative z-10 w-full max-w-6xl flex flex-col items-center">
                {/* Header Section */}
                <div className="mb-14 text-center animate-in slide-in-from-top-10 duration-1000">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="h-[1px] w-20 lg:w-40 bg-gradient-to-r from-transparent to-red-600" />
                        <span className="text-red-600 font-black tracking-[0.5em] text-[10px] lg:text-sm uppercase animate-pulse">Incoming Shipment Verified</span>
                        <div className="h-[1px] w-20 lg:w-40 bg-gradient-to-l from-transparent to-red-600" />
                    </div>
                    <h2 className="text-5xl lg:text-8xl font-black italic tracking-tighter text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.3)]">
                        RESOURCE <span className="text-stone-500">PACK</span>
                    </h2>
                </div>

                {/* Grid */}
                <div className="flex flex-wrap gap-6 lg:gap-10 justify-center items-center w-full">
                    {receivedItems.map((item, i) => {
                        const isVisible = i < visibleCount;
                        return (
                            <div
                                key={`${item}-${i}`}
                                className={`
                                    flex flex-col items-center justify-center
                                    transition-all duration-1000 transform
                                    ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-16 scale-75 rotate-3'}
                                `}
                                style={{ transitionDelay: `${i * 150}ms` }}
                            >
                                <div className={`
                                    relative group
                                    w-28 lg:w-44 aspect-[4/5] shrink-0
                                    flex flex-col items-center justify-center
                                    border border-white/10 rounded-2xl
                                    shadow-2xl overflow-hidden
                                    bg-gradient-to-b from-stone-900/60 to-black/80
                                    backdrop-blur-xl
                                `}>
                                    {/* Item Glow */}
                                    <div className={`absolute inset-0 opacity-10 blur-2xl group-hover:opacity-30 transition-opacity bg-current ${ITEM_COLORS[item].split(' ')[0]}`} />

                                    {/* Scanline Effect */}
                                    <div className="absolute inset-0 bg-[linear-gradient(transparent_0%,rgba(255,255,255,0.02)_50%,transparent_100%)] bg-[length:100%_4px] pointer-events-none" />

                                    {/* Icon Container */}
                                    <div className={`relative z-10 p-6 rounded-3xl bg-black/40 border border-white/5 mb-4 group-hover:scale-110 group-hover:drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all duration-500 ${ITEM_COLORS[item].split(' ')[0]}`}>
                                        {item === 'BEER' && <Icons.Beer size={56} />}
                                        {item === 'CIGS' && <Icons.Cigs size={56} />}
                                        {item === 'GLASS' && <Icons.Glass size={56} />}
                                        {item === 'CUFFS' && <Icons.Cuffs size={56} />}
                                        {item === 'SAW' && <Icons.Saw size={56} />}
                                        {item === 'PHONE' && <Icons.Phone size={56} />}
                                        {item === 'INVERTER' && <Icons.Inverter size={56} />}
                                        {item === 'ADRENALINE' && <Icons.Adrenaline size={56} />}
                                        {item === 'CHOKE' && <Icons.Choke size={56} />}
                                        {item === 'REMOTE' && <Icons.Remote size={56} />}
                                        {item === 'BIG_INVERTER' && <Icons.BigInverter size={56} />}
                                        {item === 'CONTRACT' && <Icons.Contract size={56} />}
                                        {item === 'LUCKYCHARM' && <Icons.Luckycharm size={56} />}
                                        {item === 'FLASHBANG' && <Icons.Flashbang size={56} />}
                                        {item === 'CRUSHER' && <Icons.Crusher size={56} />}
                                        {item === 'TOTEM' && <Icons.Totem size={56} />}
                                    </div>

                                    {/* Text Label */}
                                    <div className="relative z-10 text-center px-4">
                                        <span className={`text-[9px] lg:text-xs font-black tracking-[0.4em] uppercase ${ITEM_COLORS[item].split(' ')[0]}`}>
                                            {ITEM_NAMES[item]}
                                        </span>
                                    </div>

                                    {/* Decorative Indices */}
                                    <div className="absolute top-4 left-4 text-[8px] font-black text-white/10 tracking-widest">{`0${i + 1}`}</div>
                                    <div className="absolute bottom-4 right-4 text-[8px] font-black text-white/10 tracking-widest">ACT_LOG_SYS</div>

                                    {/* Corner Bars */}
                                    <div className="absolute top-0 left-0 w-8 h-[1px] bg-white/20" />
                                    <div className="absolute top-0 left-0 w-[1px] h-8 bg-white/20" />
                                    <div className="absolute bottom-0 right-0 w-8 h-[1px] bg-white/20" />
                                    <div className="absolute bottom-0 right-0 w-[1px] h-8 bg-white/20" />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer deco */}
                <div className="mt-20 flex flex-col items-center gap-4 animate-pulse">
                    <span className="text-stone-600 font-bold tracking-[0.8em] text-[9px] uppercase">Awaiting Protocol Acknowledgement</span>
                    <div className="h-[2px] w-48 bg-gradient-to-r from-transparent via-stone-800 to-transparent" />
                </div>
            </div>
        </div>
    );
};
