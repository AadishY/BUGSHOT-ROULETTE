import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Target, Beer, Cigarette, Scale, Link, Scissors, Phone, RefreshCw, Zap, Settings, Code, Github, Instagram, Gamepad2, HelpCircle, Shield, Heart, Crosshair, CircleDot, Smartphone, Monitor, Volume2, Maximize, Eye } from 'lucide-react';
import { GAME_VERSION } from '../constants';
import { Icons } from './ui/Icons';

interface TutorialGuideProps {
    onClose: () => void;
}

interface GuidePage {
    title: string;
    icon: React.ReactNode;
    content: React.ReactNode;
}

const ItemCard: React.FC<{
    icon: React.ReactNode;
    name: string;
    description: string;
    color: string;
    effect?: string;
}> = ({ icon, name, description, color, effect }) => (
    <div className="bg-gradient-to-r from-stone-900/90 to-stone-800/50 border border-stone-700/50 p-1.5 md:p-2 flex gap-2 md:gap-2.5 items-start hover:border-stone-500 transition-all hover:shadow-lg hover:shadow-black/20 rounded-sm">
        <div className={`w-6 h-6 md:w-8 md:h-8 flex items-center justify-center bg-stone-900 border border-stone-600 shrink-0 ${color} rounded-sm shadow-inner`}>
            {React.cloneElement(icon as React.ReactElement, { size: 14 })}
        </div>
        <div className="flex-1 min-w-0">
            <h4 className="font-black text-stone-100 tracking-wider mb-0.5 text-[10px] md:text-xs">{name}</h4>
            <p className="text-stone-400 text-[9px] md:text-[10px] leading-tight">{description}</p>
            {effect && (
                <div className="mt-1 text-[8px] font-bold text-amber-500 bg-amber-950/30 px-1.5 py-0.5 inline-block rounded-sm">
                    {effect}
                </div>
            )}
        </div>
    </div>
);

const InfoCard: React.FC<{
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
    color: string;
}> = ({ icon, title, children, color }) => (
    <div className={`bg-stone-900/60 border-l-4 ${color} p-2 md:p-2.5 rounded-r-sm`}>
        <h3 className={`font-black mb-1 flex items-center gap-1.5 text-xs md:text-sm ${color.replace('border-', 'text-').replace('-500', '-400').replace('-600', '-500')}`}>
            {React.cloneElement(icon as React.ReactElement, { size: 14 })} {title}
        </h3>
        <div className="text-stone-300 text-[10px] md:text-xs leading-relaxed">
            {children}
        </div>
    </div>
);

export const TutorialGuide: React.FC<TutorialGuideProps> = ({ onClose }) => {
    const [currentPage, setCurrentPage] = useState(0);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const [scale, setScale] = useState(1);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            const mob = window.innerWidth < 768;
            setIsMobile(mob);

            if (mob) {
                // On mobile, skip CSS scale entirely — use natural responsive layout
                setScale(1);
                return;
            }

            const targetWidth = 1000;
            const targetHeight = 420;

            const wScale = Math.min(1, (window.innerWidth - 20) / targetWidth);
            const hScale = Math.min(1, (window.innerHeight - 20) / targetHeight);

            let newScale = Math.min(wScale, hScale);
            if (newScale < 0.6) newScale = 0.6;

            setScale(newScale);
        };

        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Swipe detection for mobile
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe && currentPage < pages.length - 1) {
            setCurrentPage(currentPage + 1);
        }
        if (isRightSwipe && currentPage > 0) {
            setCurrentPage(currentPage - 1);
        }
    };

    const pages: GuidePage[] = [
        // Page 1: Game Logic - How to Play
        {
            title: "HOW TO PLAY",
            icon: <Gamepad2 size={20} className="text-red-500" />,
            content: (
                <div className="space-y-4">
                    <div className="text-center mb-4 md:mb-6">
                        <div className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-3 bg-gradient-to-br from-red-600 to-red-900 rounded-full flex items-center justify-center shadow-lg shadow-red-900/50">
                            <Gamepad2 size={32} className="text-white" />
                        </div>
                        <p className="text-sm md:text-lg text-stone-300">Welcome to <span className="text-red-500 font-black">AADISH ROULETTE</span></p>
                        <p className="text-xs md:text-sm text-stone-500 mt-1">A deadly game of chance and strategy</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2">
                            <InfoCard icon={<Target size={16} />} title="OBJECTIVE" color="border-red-600">
                                Survive by depleting your opponent's health to zero before they do the same to you. Simple, brutal, deadly.
                            </InfoCard>
                        </div>

                        <InfoCard icon={<CircleDot size={16} />} title="THE SHOTGUN" color="border-amber-500">
                            The shotgun is loaded with <span className="text-red-500 font-bold">LIVE</span> and <span className="text-blue-400 font-bold">BLANK</span> shells. You'll see the count of each before your turn.
                        </InfoCard>

                        <InfoCard icon={<Crosshair size={16} />} title="YOUR TURN" color="border-blue-500">
                            Pick up the gun and choose:<br />
                            • <span className="text-red-400 font-bold">SHOOT OPPONENT</span> - 1 damage if LIVE<br />
                            • <span className="text-yellow-400 font-bold">SHOOT SELF</span> - BLANK = extra turn!
                        </InfoCard>

                        <InfoCard icon={<Shield size={16} />} title="ITEMS" color="border-green-500">
                            Use items before shooting to gain an advantage! Items can reveal shells, heal you, skip turns, and more.
                        </InfoCard>

                        <InfoCard icon={<Heart size={16} />} title="WINNING" color="border-purple-500">
                            Reduce opponent's health to zero to win. Sawed shotgun deals 2 damage. Strategy is everything!
                        </InfoCard>
                    </div>
                </div>
            )
        },

        // Page 2: Items - Part 1
        {
            title: "ITEMS (1/2)",
            icon: <Scale size={20} className="text-cyan-400" />,
            content: (
                <div className="space-y-3">
                    <p className="text-stone-400 text-center text-xs md:text-sm mb-4">
                        🎯 Use items <span className="text-amber-400 font-bold">before shooting</span> for strategic advantage!
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <ItemCard
                            icon={<Eye size={20} />}
                            name="MAGNIFYING GLASS"
                            description="Reveals the current shell type in the chamber."
                            color="text-cyan-400"
                            effect="→ REVEALS LIVE/BLANK"
                        />

                        <ItemCard
                            icon={<Beer size={20} />}
                            name="BEER"
                            description="Racks the shotgun to eject the current shell without firing."
                            color="text-amber-500"
                            effect="→ EJECTS SHELL"
                        />

                        <ItemCard
                            icon={<Cigarette size={20} />}
                            name="CIGARETTES"
                            description="Light up to restore 1 health point (up to maximum)."
                            color="text-red-400"
                            effect="→ +1 HP"
                        />

                        <ItemCard
                            icon={<Link size={20} />}
                            name="HANDCUFFS"
                            description="Restrains your opponent, forcing them to skip their next turn."
                            color="text-stone-400"
                            effect="→ SKIP ENEMY TURN"
                        />

                        <ItemCard
                            icon={<Scissors size={20} />}
                            name="HAND SAW"
                            description="Saws off the shotgun barrel, DOUBLING damage."
                            color="text-orange-500"
                            effect="→ 2X DAMAGE"
                        />

                        <ItemCard
                            icon={<Smartphone size={20} />}
                            name="BURNER PHONE"
                            description="Mysterious caller reveals a random future shell position."
                            color="text-blue-300"
                            effect="→ REVEALS FUTURE SHELL"
                        />
                    </div>
                </div>
            )
        },

        // Page 3: Items - Part 2
        {
            title: "ITEMS (2/2)",
            icon: <Zap size={20} className="text-pink-500" />,
            content: (
                <div className="space-y-3">
                    <p className="text-stone-400 text-center text-xs md:text-sm mb-4">
                        ⚡ Advanced items that can <span className="text-red-400 font-bold">turn the tide</span> of battle!
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <ItemCard
                            icon={<RefreshCw size={20} />}
                            name="POLARITY INVERTER"
                            description="Swaps the current shell: LIVE becomes BLANK and vice-versa."
                            color="text-green-400"
                            effect="→ INVERTS CURRENT"
                        />

                        <ItemCard
                            icon={<Zap size={20} />}
                            name="ADRENALINE"
                            description="Steals an item from your opponent's inventory and uses it immediately."
                            color="text-pink-500"
                            effect="→ STEAL & USE"
                        />

                        <ItemCard
                            icon={<Icons.Choke size={20} />}
                            name="CHOKE MOD"
                            description="Fires 2 shots at once (current + next). Both LIVE = 2 DMG. One LIVE = 1 DMG. Both BLANK = 0 DMG."
                            color="text-yellow-700"
                            effect="→ DOUBLE FIRE"
                        />

                        <ItemCard
                            icon={<Icons.BigInverter size={20} />}
                            name="BIG INVERTER"
                            description="Inverts the polarity of ALL remaining shells in the magazine."
                            color="text-orange-500"
                            effect="→ INVERTS ALL"
                        />

                        <ItemCard
                            icon={<Icons.Remote size={20} />}
                            name="REMOTE"
                            description="Swaps the current shell with the next shell in the chamber."
                            color="text-red-600"
                            effect="→ SWAP NEXT SHELL"
                        />

                        <ItemCard
                            icon={<Icons.Contract size={20} />}
                            name="BLOOD CONTRACT"
                            description="Sacrifice 1 HP to obtain 2 random items from a unique high-tier pool. If used at 1 HP, you DIE. (Player Only)."
                            color="text-red-700"
                            effect="→ SACRIFICE HP FOR LOOT"
                        />
                    </div>
                </div>
            )
        },

        // Page 4: Settings Menu
        {
            title: "SETTINGS",
            icon: <Settings size={20} className="text-stone-400" />,
            content: (
                <div className="space-y-4">
                    <div className="text-center mb-4">
                        <div className="w-14 h-14 md:w-16 md:h-16 mx-auto mb-3 bg-gradient-to-br from-stone-700 to-stone-900 rounded-full flex items-center justify-center border border-stone-600">
                            <Settings size={24} className="text-stone-300" />
                        </div>
                        <p className="text-sm md:text-base text-stone-300">Customize your experience</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-stone-900/60 border border-stone-700 p-3 md:p-4 rounded-sm flex gap-3 items-start">
                            <Monitor size={20} className="text-stone-400 shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-black text-stone-200 text-sm md:text-base mb-1">RENDER RESOLUTION</h3>
                                <p className="text-stone-400 text-xs md:text-sm">
                                    Adjust 3D rendering quality. Lower = better performance on weak devices.
                                </p>
                            </div>
                        </div>

                        <div className="bg-stone-900/60 border border-stone-700 p-3 md:p-4 rounded-sm flex gap-3 items-start">
                            <Maximize size={20} className="text-stone-400 shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-black text-stone-200 text-sm md:text-base mb-1">HUD SCALE</h3>
                                <p className="text-stone-400 text-xs md:text-sm">
                                    Scale UI elements. Increase for small screens, decrease for immersion.
                                </p>
                            </div>
                        </div>

                        <div className="bg-stone-900/60 border border-stone-700 p-3 md:p-4 rounded-sm flex gap-3 items-start">
                            <Eye size={20} className="text-stone-400 shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-black text-stone-200 text-sm md:text-base mb-1">FIELD OF VIEW (FOV)</h3>
                                <p className="text-stone-400 text-xs md:text-sm">
                                    Wide/narrow view angle. Higher = more visible area, may stretch edges.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-amber-950/30 to-transparent border border-amber-900/30 p-3 md:p-4 rounded-sm">
                        <p className="text-amber-400 text-xs md:text-sm font-bold flex items-center gap-2">
                            <Smartphone size={16} /> TIP: Play in FULLSCREEN + LANDSCAPE for best experience!
                        </p>
                    </div>
                </div>
            )
        },
        // Page 5: System Profiles & Probabilities
        {
            title: "SYSTEM & PROBABILITIES",
            icon: <Shield size={20} className="text-amber-500" />,
            content: (
                <div className="space-y-4">
                    <p className="text-stone-400 text-center text-xs md:text-sm mb-4">
                        📊 Technical configuration specifications and cargo load rates.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <InfoCard icon={<Crosshair size={16} />} title="AMMUNITION LOGISTICS" color="border-red-600">
                            • **Magazine capacity**: Randomly loads between 2 and 8 shells per round.<br />
                            • **Charge ratio**: Randomized distribution of LIVE and BLANK shells (at least 1 of each guaranteed).
                        </InfoCard>

                        <InfoCard icon={<Scale size={16} />} title="INVENTORY PROTOCOL (DUPES CAP)" color="border-blue-500">
                            • **Cargo Shipment cap**: Maximum of 1 duplicate item allowed per loot phase.<br />
                            • **Storage cap**: Maximum of 2 of any single item type total in your inventory. This prevents hoarding and forces tactical adaptivity.
                        </InfoCard>

                        <InfoCard icon={<Zap size={16} />} title="NORMAL MODE PROBABILITIES" color="border-green-500">
                            • Cigarette: 13% | Beer: 15% | Cuffs: 10% | Saw: 10%<br />
                            • Glass: 10% | Phone: 12% | Inverter: 10% | Adrenaline: 8%<br />
                            • Choke Mod: 6% | Big Inverter: 6% | Contract: 10% *(Player Only)*
                        </InfoCard>

                        <InfoCard icon={<Shield size={16} />} title="HARD MODE PROBABILITIES" color="border-purple-500">
                            • Cigarette: 5% | Beer: 18% | Cuffs: 10% | Saw: 10%<br />
                            • Glass: 10% | Phone: 16% | Inverter: 9% | Adrenaline: 9%<br />
                            • Choke Mod: 4% | Big Inverter: 4% | Contract: 7% *(Player Only)*<br />
                            • *Note: Dealer operates cheating and survival item algorithms.*
                        </InfoCard>

                        <div className="md:col-span-2">
                            <div className="bg-gradient-to-r from-purple-950/40 to-stone-900/40 border border-purple-900/30 p-3 md:p-4 rounded-sm">
                                <h4 className="font-black text-purple-400 text-xs md:text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                                    🧪 EXPERIMENTAL GEAR (IN PIPELINE)
                                </h4>
                                <div className="space-y-2 text-stone-400 text-xs">
                                    <div>
                                        <span className="font-bold text-stone-200">🍀 LUCKY CHARM:</span> Improves the probability of receiving highly needed items in the next shipment.
                                    </div>
                                    <div>
                                        <span className="font-bold text-stone-200">🎰 JACKPOT:</span> Grants temporary absolute immunity from the next 3 shell discharges (self-inflicted or enemy fired).
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },

        // Page 6: Developer Info
        {
            title: "DEVELOPER",
            icon: <Code size={20} className="text-red-500" />,
            content: (
                <div className="space-y-4">
                    <div className="text-center mb-4">
                        <div className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-3 bg-gradient-to-br from-red-600 via-red-700 to-red-900 rounded-full flex items-center justify-center shadow-xl shadow-red-900/50 border-2 border-red-500/30">
                            <Code size={36} className="text-white" />
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-stone-100 mb-1">AADISH</h2>
                        <p className="text-stone-500 text-xs md:text-sm">Creator & Developer</p>
                    </div>

                    <div className="bg-gradient-to-br from-stone-900/80 to-stone-950 border border-stone-700/50 p-4 md:p-5 rounded-sm">
                        <p className="text-stone-300 text-center text-xs md:text-sm mb-5 leading-relaxed">
                            Thanks for playing <span className="text-red-500 font-bold">AADISH ROULETTE</span>!
                            <br />Built with ❤️ as a web-based reimagining of the deadly shotgun game.
                        </p>

                        <div className="space-y-3">
                            <a
                                href="https://github.com/AadishY"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 md:gap-4 bg-stone-800/80 border border-stone-600 p-3 md:p-4 hover:bg-stone-700 hover:border-stone-400 transition-all group rounded-sm"
                            >
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-[#24292e] border border-stone-500 flex items-center justify-center group-hover:border-white transition-colors rounded-sm">
                                    <Github size={20} className="text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-black text-white tracking-wider text-sm md:text-base">GITHUB</h4>
                                    <p className="text-stone-400 text-xs md:text-sm truncate">github.com/AadishY</p>
                                </div>
                                <ChevronRight size={18} className="text-stone-500 group-hover:text-white transition-colors shrink-0" />
                            </a>

                            <a
                                href="https://www.instagram.com/yo.akatsuki/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 md:gap-4 bg-stone-800/80 border border-stone-600 p-3 md:p-4 hover:bg-gradient-to-r hover:from-purple-900/40 hover:to-pink-900/40 hover:border-pink-500 transition-all group rounded-sm"
                            >
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center rounded-sm">
                                    <Instagram size={20} className="text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-black text-white tracking-wider text-sm md:text-base">INSTAGRAM</h4>
                                    <p className="text-stone-400 text-xs md:text-sm truncate">@yo.akatsuki</p>
                                </div>
                                <ChevronRight size={18} className="text-stone-500 group-hover:text-pink-400 transition-colors shrink-0" />
                            </a>
                        </div>

                        <div className="mt-5 pt-4 border-t border-stone-800 text-center">
                            <p className="text-stone-600 text-[10px] md:text-xs font-mono">
                                AADISH ROULETTE v{GAME_VERSION} • REACT + THREE.JS
                            </p>
                            <p className="text-stone-700 text-[10px] md:text-xs font-mono mt-1">
                                © 2024 AADISH NETWORKS
                            </p>
                        </div>
                    </div>
                </div>
            )
        }
    ];

    const nextPage = () => {
        if (currentPage < pages.length - 1) {
            setCurrentPage(currentPage + 1);
        }
    };

    const prevPage = () => {
        if (currentPage > 0) {
            setCurrentPage(currentPage - 1);
        }
    };

    const goToPage = (index: number) => {
        setCurrentPage(index);
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') nextPage();
            if (e.key === 'ArrowLeft') prevPage();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentPage]);

    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto custom-scrollbar">
            <div
                className="w-[85vw] h-[85vh] max-w-[85vw] max-h-[85vh] bg-stone-950/45 backdrop-blur-2xl border border-stone-850 shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative flex flex-col overflow-hidden rounded-2xl ring-1 ring-white/5 my-auto"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {/* Decorative */}
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-500/10 to-transparent" />

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-stone-800/50 bg-stone-950/20 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-stone-900/60 rounded-xl border border-stone-800 flex items-center justify-center text-red-500">
                            {pages[currentPage].icon}
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-black text-white tracking-[0.2em] uppercase leading-tight">
                                {pages[currentPage].title}
                            </h2>
                            <p className="text-[8px] sm:text-[9px] text-stone-500 font-bold tracking-[0.4em] uppercase">Tactical Manual 1.0</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-stone-500 hover:text-white hover:bg-white/5 rounded-full transition-all active:scale-95 cursor-pointer"
                        aria-label="Close guide"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 overscroll-contain custom-scrollbar">
                    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {pages[currentPage].content}
                    </div>
                </div>

                {/* Footer - Navigation */}
                <div className="shrink-0 p-3 border-t border-stone-800/50 bg-stone-950/40 backdrop-blur-xl">
                    <div className="max-w-4xl mx-auto flex items-center justify-between">
                        <button
                            onClick={prevPage}
                            disabled={currentPage === 0}
                            className={`flex items-center gap-1.5 px-4 py-2 font-black tracking-[0.2em] transition-all text-[8px] sm:text-[9px] rounded-xl border ${currentPage === 0
                                ? 'border-transparent text-transparent pointer-events-none'
                                : 'border-stone-800 text-stone-400 hover:text-white hover:bg-white/5 hover:border-stone-600'
                                }`}
                        >
                            <ChevronLeft size={14} />
                            BACK
                        </button>

                        <div className="flex items-center gap-2">
                            {pages.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => goToPage(index)}
                                    className={`h-1 rounded-full transition-all ${index === currentPage
                                        ? 'w-6 bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]'
                                        : 'w-1.5 bg-stone-800 hover:bg-stone-700'
                                        }`}
                                />
                            ))}
                        </div>

                        <button
                            onClick={nextPage}
                            disabled={currentPage === pages.length - 1}
                            className={`flex items-center gap-1.5 px-4 py-2 font-black tracking-[0.2em] transition-all text-[8px] sm:text-[9px] rounded-xl border ${currentPage === pages.length - 1
                                ? 'border-transparent text-transparent pointer-events-none'
                                : 'bg-white text-black hover:bg-stone-200 border-white'
                                }`}
                        >
                            NEXT
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
