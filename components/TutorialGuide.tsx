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
                            description="Reveals the current shell type (LIVE/BLANK) in the chamber. Dealer uses glass silently — you won't see the result."
                            color="text-cyan-400"
                            effect="→ REVEALS LIVE/BLANK"
                        />

                        <ItemCard
                            icon={<Beer size={20} />}
                            name="BEER"
                            description="Racks the shotgun to eject the current shell without firing. The ejected shell type is shown. Does NOT consume Choke Mod status."
                            color="text-amber-500"
                            effect="→ EJECTS SHELL (CHOKE PRESERVED)"
                        />

                        <ItemCard
                            icon={<Cigarette size={20} />}
                            name="CIGARETTES"
                            description="Light up to restore 1 HP (capped at max HP). Cannot overheal. Most common survival item."
                            color="text-red-400"
                            effect="→ +1 HP (CAPPED)"
                        />

                        <ItemCard
                            icon={<Link size={20} />}
                            name="HANDCUFFS"
                            description="Restrains opponent, forcing them to skip their next turn. Cannot stack — if already cuffed, effect is wasted."
                            color="text-stone-400"
                            effect="→ SKIP ENEMY TURN"
                        />

                        <ItemCard
                            icon={<Scissors size={20} />}
                            name="HAND SAW"
                            description="Saws off the shotgun barrel, DOUBLING the next shot's damage to 2 HP. Stacks with Choke Mod for massive damage."
                            color="text-orange-500"
                            effect="→ 2X DAMAGE (STACKS W/ CHOKE)"
                        />

                        <ItemCard
                            icon={<Smartphone size={20} />}
                            name="BURNER PHONE"
                            description="A mysterious caller reveals a random future shell position (3rd+). Hidden: Has a secret 5% chance to LIE about the shell type. Useless if < 3 shells remain."
                            color="text-blue-300"
                            effect="→ FUTURE SHELL (5% LIE RISK)"
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
                            description="Swaps the current shell: LIVE ↔ BLANK. Only affects the next shell to be fired. Does not reveal the shell type."
                            color="text-green-400"
                            effect="→ INVERTS CURRENT SHELL"
                        />

                        <ItemCard
                            icon={<Zap size={20} />}
                            name="ADRENALINE"
                            description="Steals one item from opponent's inventory and uses it immediately. Hidden: Cannot steal Totem of Undying or another Adrenaline. If stolen Contract kills you at 1 HP, dealer stashes it instead."
                            color="text-pink-500"
                            effect="→ STEAL & USE (NO TOTEM/ADRENALINE)"
                        />

                        <ItemCard
                            icon={<Icons.Choke size={20} />}
                            name="CHOKE MOD"
                            description="Attaches barrel mod to fire 2 shells simultaneously (current + next). Both LIVE = 2 DMG, one LIVE = 1 DMG, both BLANK = 0 DMG. Saw doubles total damage."
                            color="text-yellow-700"
                            effect="→ DOUBLE FIRE (SAW STACKS)"
                        />

                        <ItemCard
                            icon={<Icons.BigInverter size={20} />}
                            name="BIG INVERTER"
                            description="Inverts polarity of ALL remaining shells in the magazine. Extremely powerful when most remaining shells are blank."
                            color="text-orange-500"
                            effect="→ INVERTS ALL SHELLS"
                        />

                        <ItemCard
                            icon={<Icons.Remote size={20} />}
                            name="REMOTE"
                            description="Swaps current shell position with the next shell. Fails silently if only 1 shell remains in chamber."
                            color="text-red-600"
                            effect="→ SWAP SHELL ORDER"
                        />

                        <ItemCard
                            icon={<Icons.Contract size={20} />}
                            name="BLOOD CONTRACT"
                            description="Sacrifice 1 HP to obtain 2 high-tier items (Choke, Saw, Glass, Cigs, Adrenaline weighted 5x). If Lucky Charm is active, high-tier weight boosted to 15x+. Using at 1 HP = instant death. Player only. Max 1 per inventory."
                            color="text-red-700"
                            effect="→ -1 HP, +2 HIGH-TIER ITEMS"
                        />

                        <ItemCard
                            icon={<Icons.Luckycharm size={20} />}
                            name="LUCKY CHARM"
                            description="Boosts next item shipment quality. Stacks multiplicatively on multiple uses. Also massively boosts Blood Contract loot quality. Consumed after next shipment or contract use. Max 1 per inventory."
                            color="text-emerald-500"
                            effect="→ BOOST LOOT + CONTRACT QUALITY"
                        />

                        <ItemCard
                            icon={<Icons.Flashbang size={20} />}
                            name="FLASHBANG"
                            description="Blinds the opponent, completely preventing them from using ANY items on their next turn. They can still pick up the gun and shoot."
                            color="text-zinc-300"
                            effect="→ BLOCK ALL OPPONENT ITEMS"
                        />

                        <ItemCard
                            icon={<Icons.Crusher size={20} />}
                            name="ITEM CRUSHER"
                            description="Slams a giant hammer to destroy 1 random item from your opponent's inventory. Can destroy any item including Totem. Fails if opponent has empty inventory."
                            color="text-amber-600"
                            effect="→ DESTROY 1 RANDOM ENEMY ITEM"
                        />

                        <ItemCard
                            icon={<Icons.Totem size={20} />}
                            name="TOTEM OF UNDYING"
                            description="[PASSIVE] Auto-activates when HP drops to 0, saving you at 1 HP. Cannot be stolen via Adrenaline. Can be destroyed by Crusher. Max 1 per inventory."
                            color="text-amber-400"
                            effect="→ AUTO-SURVIVE AT 1 HP (UNSTEALABLE)"
                        />

                        <ItemCard
                            icon={<Icons.Mirror size={20} />}
                            name="MIRROR"
                            description="Copies and replays ALL items your opponent used on their last turn, in sequence. Excludes Mirror itself to prevent infinite loops. Useless if opponent used no items."
                            color="text-indigo-400"
                            effect="→ REPLAY OPPONENT'S LAST TURN ITEMS"
                        />
                    </div>
                </div>
            )
        },

        // Page 4: Tarot Cards
        {
            title: "TAROT CARDS",
            icon: <Icons.DeckCard size={20} className="text-purple-400" />,
            content: (
                <div className="space-y-3">
                    <p className="text-stone-400 text-center text-xs md:text-sm mb-4">
                        🃏 Draw one of 6 randomly presented cards for active or passive effects.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-2.5 max-h-[48vh] overflow-y-auto pr-1 custom-scrollbar">
                        <ItemCard
                            icon={<Icons.DeckCard />}
                            name="THE MAGICIAN"
                            description="Gain 1 random item. Uses standard drop table. Fails (discards) if inventory is full."
                            color="text-purple-450"
                            effect="→ +1 RANDOM ITEM"
                        />
                        <ItemCard
                            icon={<Icons.DeckCard />}
                            name="THE HANGED MAN"
                            description="Lose 1 HP. If this kills you, Totem of Undying auto-triggers (if owned). Lethal without Totem = instant death."
                            color="text-red-500"
                            effect="→ -1 HP (TOTEM CAN SAVE)"
                        />
                        <ItemCard
                            icon={<Icons.DeckCard />}
                            name="THE HERMIT"
                            description="Instantly transfers the current turn to your opponent. You do NOT get to shoot this turn."
                            color="text-stone-500"
                            effect="→ GIVE TURN TO OPPONENT"
                        />
                        <ItemCard
                            icon={<Icons.DeckCard />}
                            name="THE MOON"
                            description="Steal 1 random item from opponent (excluding Totem). Discarded if opponent has no items or your inventory is full."
                            color="text-blue-300"
                            effect="→ STEAL 1 ITEM (NO TOTEM)"
                        />
                        <ItemCard
                            icon={<Icons.DeckCard />}
                            name="JUDGMENT"
                            description="If the current shell is BLANK, there is a 50% chance it secretly converts to LIVE. Has no effect on already-LIVE shells. Neither player is told the result."
                            color="text-yellow-600"
                            effect="→ 50% BLANK→LIVE (SECRET)"
                        />
                        <ItemCard
                            icon={<Icons.DeckCard />}
                            name="WHEEL OF FORTUNE"
                            description="Randomly reshuffles the order of ALL remaining shells. Invalidates any Glass/Phone intel you had."
                            color="text-orange-400"
                            effect="→ SHUFFLE ALL REMAINING"
                        />
                        <ItemCard
                            icon={<Icons.DeckCard />}
                            name="THE SUN"
                            description="Heal 1 HP (capped at max HP). No effect if already at full health."
                            color="text-yellow-400"
                            effect="→ +1 HP (CAPPED)"
                        />
                        <ItemCard
                            icon={<Icons.DeckCard />}
                            name="DEATH"
                            description="Destroy 1 random item from YOUR OWN inventory. Harmful card — can destroy your Totem. No effect if you have no items."
                            color="text-zinc-600"
                            effect="→ LOSE 1 OWN ITEM"
                        />
                        <ItemCard
                            icon={<Icons.DeckCard />}
                            name="THE TOWER"
                            description="Destroy 1 random item from your OPPONENT's inventory (excluding Totem). No effect if opponent has no items."
                            color="text-amber-700"
                            effect="→ DESTROY 1 ENEMY ITEM"
                        />
                        <ItemCard
                            icon={<Icons.DeckCard />}
                            name="THE FOOL"
                            description="Reveals a shell's type, but may LIE. Lie probability: 0% if 3+ shells remain, 10% if 2 shells remain, 25% if only 1 shell left."
                            color="text-pink-400"
                            effect="→ REVEAL (0/10/25% LIE RATE)"
                        />
                        <ItemCard
                            icon={<Icons.DeckCard />}
                            name="JUSTICE"
                            description="Instantly swap your HP with your opponent's HP. Extremely powerful when you're low and they're high."
                            color="text-emerald-400"
                            effect="→ SWAP HP TOTALS"
                        />
                    </div>
                </div>
            )
        },

        // Page 5: Probability Matrix
        {
            title: "PROBABILITY MATRIX",
            icon: <Crosshair size={20} className="text-amber-500" />,
            content: (
                <div className="space-y-4">
                    <p className="text-stone-400 text-center text-xs md:text-sm mb-3">
                        📊 Item load probabilities per shipment slot for Player and Dealer.
                    </p>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Player Probabilities */}
                        <div className="space-y-2">
                            <h4 className="text-[10px] md:text-xs font-black text-red-500 tracking-wider uppercase border-b border-red-950/30 pb-1">
                                Player Drop Rates
                            </h4>
                            <div className="overflow-x-auto border border-stone-850 rounded-lg bg-stone-900/20">
                                <table className="w-full text-left border-collapse text-[9px] md:text-[10px]">
                                    <thead>
                                        <tr className="border-b border-stone-850 bg-stone-950/85 text-stone-400 uppercase font-black text-[8px] md:text-[9px]">
                                            <th className="p-1.5 pl-2">Item Type</th>
                                            <th className="p-1.5 text-center">Normal Mode</th>
                                            <th className="p-1.5 text-center">Hard Mode</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-850 text-stone-300 font-mono">
                                        <tr>
                                            <td className="p-1.5 pl-2 font-sans">Blood Contract (Loot)</td>
                                            <td className="p-1.5 text-center">9.0%</td>
                                            <td className="p-1.5 text-center text-red-400">7.0%</td>
                                        </tr>
                                        <tr>
                                            <td className="p-1.5 pl-2 font-sans">Beer (Rack Shell)</td>
                                            <td className="p-1.5 text-center">10.0%</td>
                                            <td className="p-1.5 text-center text-green-450">15.0%</td>
                                        </tr>
                                        <tr>
                                            <td className="p-1.5 pl-2 font-sans">Cigarettes (Heal)</td>
                                            <td className="p-1.5 text-center">10.0%</td>
                                            <td className="p-1.5 text-center text-red-400">4.0%</td>
                                        </tr>
                                        <tr>
                                            <td className="p-1.5 pl-2 font-sans">Magnifying Glass (Reveal)</td>
                                            <td className="p-1.5 text-center">7.0%</td>
                                            <td className="p-1.5 text-center">8.0%</td>
                                        </tr>
                                        <tr>
                                            <td className="p-1.5 pl-2 font-sans">Handcuffs (Skip Turn)</td>
                                            <td className="p-1.5 text-center">7.0%</td>
                                            <td className="p-1.5 text-center">8.0%</td>
                                        </tr>
                                        <tr>
                                            <td className="p-1.5 pl-2 font-sans">Burner Phone (Future peek)</td>
                                            <td className="p-1.5 text-center">8.0%</td>
                                            <td className="p-1.5 text-center">8.0%</td>
                                        </tr>
                                        <tr>
                                            <td className="p-1.5 pl-2 font-sans">Hand Saw (2x DMG)</td>
                                            <td className="p-1.5 text-center">5.0%</td>
                                            <td className="p-1.5 text-center">5.0%</td>
                                        </tr>
                                        <tr>
                                            <td className="p-1.5 pl-2 font-sans">Polarity Inverter (Swap)</td>
                                            <td className="p-1.5 text-center">7.0%</td>
                                            <td className="p-1.5 text-center">8.0%</td>
                                        </tr>
                                        <tr>
                                            <td className="p-1.5 pl-2 font-sans">Adrenaline (Steal)</td>
                                            <td className="p-1.5 text-center">7.0%</td>
                                            <td className="p-1.5 text-center">7.0%</td>
                                        </tr>
                                        <tr>
                                            <td className="p-1.5 pl-2 font-sans">Choke Mod (Double shot)</td>
                                            <td className="p-1.5 text-center">5.0%</td>
                                            <td className="p-1.5 text-center">5.0%</td>
                                        </tr>
                                        <tr>
                                            <td className="p-1.5 pl-2 font-sans">Big Inverter (All invert)</td>
                                            <td className="p-1.5 text-center">4.0%</td>
                                            <td className="p-1.5 text-center">4.0%</td>
                                        </tr>
                                        <tr>
                                            <td className="p-1.5 pl-2 font-sans">Lucky Charm (Luck boost)</td>
                                            <td className="p-1.5 text-center">4.0%</td>
                                            <td className="p-1.5 text-center">4.0%</td>
                                        </tr>
                                        <tr>
                                            <td className="p-1.5 pl-2 font-sans">Flashbang (Blind opponent)</td>
                                            <td className="p-1.5 text-center">5.0%</td>
                                            <td className="p-1.5 text-center">5.0%</td>
                                        </tr>
                                        <tr>
                                            <td className="p-1.5 pl-2 font-sans text-amber-500 font-bold">Item Crusher (Destroy)</td>
                                            <td className="p-1.5 text-center text-amber-500 font-bold">3.0%</td>
                                            <td className="p-1.5 text-center text-amber-500 font-bold">3.0%</td>
                                        </tr>
                                        <tr>
                                            <td className="p-1.5 pl-2 font-sans text-indigo-400 font-bold">Mirror (Duplicate Turn)</td>
                                            <td className="p-1.5 text-center text-indigo-400 font-bold">4.0%</td>
                                            <td className="p-1.5 text-center text-indigo-400 font-bold">4.0%</td>
                                        </tr>
                                        <tr>
                                            <td className="p-1.5 pl-2 font-sans text-purple-400 font-bold">Tarot Deck Card</td>
                                            <td className="p-1.5 text-center text-purple-400 font-bold">4.0%</td>
                                            <td className="p-1.5 text-center text-purple-400 font-bold">4.0%</td>
                                        </tr>
                                        <tr>
                                            <td className="p-1.5 pl-2 font-sans text-amber-400 font-bold">Totem of Undying (Passive)</td>
                                            <td className="p-1.5 text-center text-amber-400 font-bold">1.0%</td>
                                            <td className="p-1.5 text-center text-amber-400 font-bold">1.0%</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Dealer Probabilities */}
                        <div className="space-y-2">
                            <h4 className="text-[10px] md:text-xs font-black text-purple-400 tracking-wider uppercase border-b border-purple-950/30 pb-1">
                                Dealer Drop Rates
                            </h4>
                            <div className="overflow-x-auto border border-stone-850 rounded-lg bg-stone-900/20 p-2 space-y-2.5">
                                <div className="p-1.5 bg-stone-950 border border-stone-900 text-[8.5px] md:text-[9.5px] leading-relaxed rounded-md">
                                    <span className="font-black text-white block uppercase mb-1">Normal Mode</span>
                                    Follows Player probabilities exactly, except **Blood Contract** is disabled (0%), redistributing its weight to standard items.
                                </div>
                                <div className="p-1.5 bg-stone-950 border border-purple-900/30 text-[8.5px] md:text-[9.5px] leading-relaxed rounded-md">
                                    <span className="font-black text-purple-400 block uppercase mb-1">Hard Mode (Cheating AI)</span>
                                    Item slots are actively manipulated by the Dealer depending on his current health:
                                    <div className="mt-1.5 space-y-1.5 border-t border-stone-850 pt-1.5">
                                        <div>
                                            <span className="font-bold text-red-400 text-[9px] md:text-[10px]">AGGRESSIVE (HP &gt; 2):</span>
                                            <br />• Hand Saw / Choke Mod: **25.0%** each
                                            <br />• Magnifying Glass: **15.0%**
                                            <br />• Adrenaline / Cuffs / Inverter: **10.0%** each
                                            <br />• Big Inverter: **5.0%**
                                        </div>
                                        <div>
                                            <span className="font-bold text-green-400 text-[9px] md:text-[10px]">PANIC/SURVIVAL (HP &le; 2):</span>
                                            <br />• Cigarettes (Heal): **40.0%**
                                            <br />• Beer: **20.0%**
                                            <br />• Adrenaline / Cuffs / Saw / Choke: **10.0%** each
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },

        // Page 5: Dealer Protocol (Normal + Hard Mode)
        {
            title: "DEALER PROTOCOL",
            icon: <Shield size={20} className="text-purple-400" />,
            content: (
                <div className="space-y-4">
                    <div className="text-center mb-4">
                        <div className="w-14 h-14 md:w-16 md:h-16 mx-auto mb-3 bg-gradient-to-br from-purple-700 to-purple-900 rounded-full flex items-center justify-center border border-purple-500/30">
                            <Shield size={24} className="text-white" />
                        </div>
                        <p className="text-sm md:text-base text-stone-300">Dealer AI Behavior Specifications</p>
                        <p className="text-xs md:text-sm text-stone-500 mt-1">Normal Mode vs Hard Mode breakdown</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Normal Mode Section */}
                        <div className="md:col-span-2">
                            <InfoCard icon={<Gamepad2 size={16} />} title="NORMAL MODE — CASUAL AI" color="border-green-500">
                                • Uses standard drop probabilities (same as player, minus Blood Contract).<br />
                                • Has a <span className="text-yellow-400 font-bold">10% chance to make a targeting mistake</span> — sometimes shoots self when should shoot player and vice versa.<br />
                                • Uses items in a basic priority order: Heal → Contract → Adrenaline → Mirror → Inverter → Saw → Cuffs → Glass → Phone → Tarot → Beer → Choke → Lucky Charm → Flashbang → Crusher.<br />
                                • <span className="text-yellow-400 font-bold">Random Tarot selection</span> — picks any card blindly when using Tarot Deck Card.<br />
                                • No supernatural peeking at shells — relies only on Glass and Phone intel.
                            </InfoCard>
                        </div>

                        {/* Hard Mode Section */}
                        <InfoCard icon={<Eye size={16} />} title="SUPERNATURAL INTUITION" color="border-purple-500">
                            The Dealer has a <span className="text-red-400 font-bold">60% chance</span> at the start of every turn to secretly sense the current shell type WITHOUT using any items. This also extends to the next shell for Choke Mod planning.
                        </InfoCard>

                        <InfoCard icon={<Target size={16} />} title="TACTICAL HANDCUFFS" color="border-purple-500">
                            Unlike normal mode, if live shell probability is <span className="text-red-400 font-bold">≥50%</span>, the Dealer will preemptively use Handcuffs even without shell knowledge. In normal mode, he only cuffs reactively.
                        </InfoCard>

                        <InfoCard icon={<Icons.DeckCard size={16} />} title="SMART TAROT SELECTION" color="border-purple-500">
                            In Hard Mode, the Dealer has a <span className="text-red-400 font-bold">50% chance</span> to peek at all 6 fanned Tarot cards and select the highest-scoring one using a utility function. Scores are based on current HP, opponent HP, inventory state, and chamber info. In Normal Mode, always random.
                        </InfoCard>

                        <InfoCard icon={<Zap size={16} />} title="SMART ADRENALINE STEALS" color="border-purple-500">
                            The Dealer dynamically targets high-threat items:
                            <br />• Steals <span className="text-red-400 font-bold">Saws, Inverters, Cuffs, Mirrors, Chokes, Remotes</span> for offense.
                            <br />• Steals <span className="text-green-400 font-bold">Cigarettes</span> for healing when low HP.
                            <br />• Will NOT steal Totem or Adrenaline.
                        </InfoCard>

                        <InfoCard icon={<Heart size={16} />} title="SELF-PRESERVATION MATRIX" color="border-purple-500">
                            At <span className="text-red-400 font-bold">1 HP</span>, the Dealer:
                            <br />• Will NEVER fire at himself (unless 100% certain it's blank).
                            <br />• Stashes stolen <span className="text-red-400 font-bold">Blood Contract</span> instead of using it to avoid suicide.
                            <br />• Prioritizes healing items above all else.
                        </InfoCard>

                        <InfoCard icon={<Scale size={16} />} title="CHEATING ITEM DISTRIBUTION" color="border-purple-500">
                            In Hard Mode, the Dealer's shipment items are NOT random — they are manipulated based on his HP:
                            <br />• <span className="text-red-400 font-bold">Aggressive (HP &gt; 2)</span>: 25% Saw, 25% Choke, 15% Glass.
                            <br />• <span className="text-green-400 font-bold">Panic (HP ≤ 2)</span>: 30% Cigs, 15% Beer, 15% Totem.
                        </InfoCard>
                    </div>
                </div>
            )
        },

        // Page 6: Settings Menu
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
                        <div className="bg-stone-900/60 border border-stone-700 p-2 md:p-3 rounded-sm flex gap-3 items-start">
                            <Monitor size={20} className="text-stone-400 shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-black text-stone-200 text-[10px] md:text-xs mb-1 uppercase">Graphics Profile</h3>
                                <p className="text-stone-400 text-[9px] md:text-[10px] leading-tight">
                                    Choose **High Quality** (PBR rendering), **Balanced** (reduced shaders), or **Potato** (flat unshaded UI) to match device capabilities.
                                </p>
                            </div>
                        </div>

                        <div className="bg-stone-900/60 border border-stone-700 p-2 md:p-3 rounded-sm flex gap-3 items-start">
                            <Monitor size={20} className="text-stone-400 shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-black text-stone-200 text-[10px] md:text-xs mb-1 uppercase">RENDER RESOLUTION</h3>
                                <p className="text-stone-400 text-[9px] md:text-[10px] leading-tight">
                                    Adjust 3D rendering canvas scale. Lower values reduce pixel density to optimize performance on mobile GPUs.
                                </p>
                            </div>
                        </div>

                        <div className="bg-stone-900/60 border border-stone-700 p-2 md:p-3 rounded-sm flex gap-3 items-start">
                            <Maximize size={20} className="text-stone-400 shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-black text-stone-200 text-[10px] md:text-xs mb-1 uppercase">HUD SCALE</h3>
                                <p className="text-stone-400 text-[9px] md:text-[10px] leading-tight">
                                    Rescale items grids, HP gauges, and control triggers to fit landscape/portrait screens.
                                </p>
                            </div>
                        </div>

                        <div className="bg-stone-900/60 border border-stone-700 p-2 md:p-3 rounded-sm flex gap-3 items-start">
                            <Eye size={20} className="text-stone-400 shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-black text-stone-200 text-[10px] md:text-xs mb-1 uppercase">FIELD OF VIEW (FOV)</h3>
                                <p className="text-stone-400 text-[9px] md:text-[10px] leading-tight">
                                    Scale visual view camera field from narrow 60° up to wide-angle 110°.
                                </p>
                            </div>
                        </div>

                        <div className="bg-stone-900/60 border border-stone-700 p-2 md:p-3 rounded-sm flex gap-3 items-start">
                            <Volume2 size={20} className="text-stone-400 shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-black text-stone-200 text-[10px] md:text-xs mb-1 uppercase">INDEPENDENT AUDIO</h3>
                                <p className="text-stone-400 text-[9px] md:text-[10px] leading-tight">
                                    Separately balance the synthesizer background music loop and game sound effects.
                                </p>
                            </div>
                        </div>

                        <div className="bg-stone-900/60 border border-red-900/40 p-2 md:p-3 rounded-sm flex gap-3 items-start bg-red-950/5">
                            <Code size={20} className="text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-black text-red-400 text-[10px] md:text-xs mb-1 uppercase">DEVELOPER CONSOLE</h3>
                                <p className="text-stone-400 text-[9px] md:text-[10px] leading-tight">
                                    Toggle Developer overlay overlay cheats. Ignores statistics and scoreboards if active.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-amber-950/30 to-transparent border border-amber-900/30 p-2.5 md:p-3.5 rounded-sm mt-3">
                        <p className="text-amber-400 text-[10px] md:text-xs font-bold flex items-center gap-2">
                            <Smartphone size={15} /> TIP: Play in FULLSCREEN + LANDSCAPE mode for best immersion!
                        </p>
                    </div>
                </div>
            )
        },

        // Page 7: System Logistics
        {
            title: "SYSTEM LOGISTICS",
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

                        <InfoCard icon={<Scale size={16} />} title="INVENTORY PROTOCOL (DUPES)" color="border-blue-500">
                            • **Unique items** (Blood Contract, Lucky Charm, Totem): Max 1 copy per inventory. Duplicates are blocked.<br />
                            • **Standard items** (Beer, Cigs, Saw, etc.): Can appear multiple times in the same shipment with no cap.
                        </InfoCard>

                        <InfoCard icon={<Zap size={16} />} title="HEALTH & SHOTGUN DMG" color="border-green-500">
                            • **Starting HP**: Varies from 2 to 4 depending on match tier settings.<br />
                            • **Standard Discharge**: Deals 1 damage to player or opponent if LIVE shell.<br />
                            • **Sawed-off Discharge**: Hand Saw doubles standard discharge damage to 2 HP.
                        </InfoCard>

                        <InfoCard icon={<Heart size={16} />} title="MATCH PROGRESSION" color="border-purple-500">
                            • **Normal Mode**: Standard progression with ascending item count shipment slots per round.<br />
                            • **Hard Mode**: Multi-round progression series (Best of 3 matches) against cheating Dealer AI.
                        </InfoCard>

                        <div className="md:col-span-2">
                            <div className="bg-gradient-to-r from-purple-950/40 to-stone-900/40 border border-purple-900/30 p-3 md:p-4 rounded-sm">
                                <h4 className="font-black text-purple-400 text-xs md:text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                                    🧪 EXPERIMENTAL GEAR (IN PIPELINE)
                                </h4>
                                <div className="space-y-2 text-stone-400 text-xs">
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
