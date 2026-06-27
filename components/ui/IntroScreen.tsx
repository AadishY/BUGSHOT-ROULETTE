import React, { useEffect, useRef } from 'react';
import { Scoreboard } from './Scoreboard';
import { Settings as SettingsIcon, HelpCircle, Trophy, ShieldAlert, Lock, User, Terminal, BookOpen, Crown, Shield, Skull, X, Crosshair, Swords, Activity, Award } from 'lucide-react';
import { audioManager } from '../../utils/audioManager';
import { loginUser, registerUser, getLeaderboard } from '../../utils/redisService';
import { GAME_VERSION } from '../../constants';

const AUTH_QUOTES = [
    "The odds are equal, the consequences are not.",
    "A deal signed in shadow binds the soul.",
    "The cylinder spins, but destiny has already chosen.",
    "In the game of fate, there are no spectators.",
    "Your luck is a borrowed resource; the dealer is calling in the debt.",
    "Fear the blank, respect the live.",
    "Every chamber is a question. What is your answer?",
    "A loaded chamber has no room for regret.",
    "The shotgun is a neutral judge; the dealer is not.",
    "Bargain with flesh, pay in blood.",
    "The dealer knows your name. The machine knows your future."
];

// Thematic codename pools for match history display
const NORMAL_CODENAMES = [
    'VIPER', 'BLACKOUT', 'WRAITH', 'KINGPIN', 'PHANTOM',
    'SHADOW OPS', 'NIGHTFALL', 'DEADLOCK', 'SERPENT', 'CRIMSON TIDE',
    'IRON WOLF', 'GHOST WIRE', 'COLD FRONT', 'REAPER', 'OBSIDIAN',
    'THUNDERCLAP', 'DARK PULSE', 'STEEL RAIN', 'VOID WALKER', 'ECLIPSE'
];

const HARD_CODENAMES = [
    'IRON FANG', 'DARK HARVEST', 'SCORCHED EARTH', 'BLOOD MERIDIAN',
    'DEAD RECKONING', 'HELLFIRE', 'OMEGA PURGE', 'SKULL CIRCUIT',
    'DEATH WARRANT', 'BLACK HORIZON', 'ENDGAME', 'FINAL PROTOCOL',
    'LAST RITES', 'EXTINCTION', 'DOOMSDAY ARC', 'VOID COLLAPSE',
    'INFERNO GATE', 'CARNAGE PRIME', 'ANNIHILATION', 'TERMINUS'
];

const getMatchCodename = (index: number, isHardMode: boolean): string => {
    const pool = isHardMode ? HARD_CODENAMES : NORMAL_CODENAMES;
    return pool[index % pool.length];
};

interface IntroScreenProps {
    playerName: string;
    inputName: string;
    setInputName: (name: string) => void;
    onStartGame: (hardMode?: boolean) => void;
    onOpenSettings: () => void;
    onOpenGuide: () => void;
    onOpenScoreboard: () => void;
    onStartMultiplayer: (name: string) => void;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({
    inputName,
    setInputName,
    onStartGame,
    onOpenSettings,
    onOpenGuide,
    onOpenScoreboard,
    onStartMultiplayer
}) => {
    const nameInputRef = useRef<HTMLInputElement>(null);
    const [scale, setScale] = React.useState(1);
    const [showHardModeWarning, setShowHardModeWarning] = React.useState(false);
    const [hasBoundSoul, setHasBoundSoul] = React.useState(false);

    // Dialog & UI state
    const [showChangelog, setShowChangelog] = React.useState(false);
    const [showLoginModal, setShowLoginModal] = React.useState(false);
    const [showLeaderboard, setShowLeaderboard] = React.useState(false);
    const [loginTab, setLoginTab] = React.useState<'signin' | 'register'>('signin');
    const [loginUsername, setLoginUsername] = React.useState('');
    const [loginPassword, setLoginPassword] = React.useState('');
    const [loginError, setLoginError] = React.useState('');
    const [loginSuccess, setLoginSuccess] = React.useState('');
    const [isLoadingRedis, setIsLoadingRedis] = React.useState(false);

    const [loggedInUser, setLoggedInUser] = React.useState<{ username: string } | null>(() => {
        const saved = localStorage.getItem('aadish_roulette_logged_in_user');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {}
        }
        return null;
    });

    // Leaderboard & Detailed Profile states
    const [leaderboard, setLeaderboard] = React.useState<any[]>([]);
    const [isLoadingLeaderboard, setIsLoadingLeaderboard] = React.useState(false);
    const [selectedMPMatch, setSelectedMPMatch] = React.useState<any>(null);
    const [selectedCareerUser, setSelectedCareerUser] = React.useState<any | null>(null);

    const loadLeaderboardData = async () => {
        setIsLoadingLeaderboard(true);
        try {
            const data = await getLeaderboard();
            setLeaderboard(data);
        } catch (e) {
            console.error("Failed to load leaderboard:", e);
        } finally {
            setIsLoadingLeaderboard(false);
        }
    };

    // PWA Install State
    const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
    const [isInstallable, setIsInstallable] = React.useState(false);

    // Login Quote Randomizer State
    const [loginQuote, setLoginQuote] = React.useState(AUTH_QUOTES[0]);

    useEffect(() => {
        if (showLoginModal) {
            const randomQuote = AUTH_QUOTES[Math.floor(Math.random() * AUTH_QUOTES.length)];
            setLoginQuote(randomQuote);
        }
    }, [showLoginModal]);

    const [isIOS, setIsIOS] = React.useState(false);
    const [isMobile, setIsMobile] = React.useState(false);
    const [isStandalone, setIsStandalone] = React.useState(false);

    // Auto-populate name from saved login session
    useEffect(() => {
        if (loggedInUser && !inputName) {
            setInputName(loggedInUser.username.toUpperCase());
        }
    }, []); // Only on mount

    useEffect(() => {
        if (hasBoundSoul) {
            const lastSeen = localStorage.getItem('aadish_roulette_changelog_seen');
            const currentVersion = GAME_VERSION;
            if (lastSeen !== currentVersion) {
                setTimeout(() => {
                    setShowChangelog(true);
                    localStorage.setItem('aadish_roulette_changelog_seen', currentVersion);
                }, 800);
            }
        }
    }, [hasBoundSoul]);

    useEffect(() => {
        // Detect Standalone Mode
        const checkStandalone = () => {
            const isS = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone ||
                document.referrer.includes('android-app://');
            setIsStandalone(!!isS);
        };
        checkStandalone();

        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Detect Mobile & iOS
        const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(ios);
        setIsMobile(isMobileUA);

        if (isMobileUA || ios) setIsInstallable(true);

        const handleResize = () => {
            const hScale = Math.min(1, (window.innerHeight - 10) / 650);
            const wScale = Math.min(1, (window.innerWidth - 10) / 450);
            let newScale = Math.min(hScale, wScale);
            
            const isDesktop = window.innerWidth >= 1024;
            
            if (window.innerWidth < 500) {
                const heightScale = Math.max(0.48, (window.innerHeight - 10) / 650);
                newScale = Math.min(heightScale, Math.max(0.48, Math.min(0.95, window.innerWidth / 450)));
            } else if (isDesktop) {
                // Scale to a clean, balanced size (approx 1.0x - 1.20x on PC/Desktop monitors)
                newScale = Math.max(1.0, Math.min(1.22, window.innerHeight / 900));
            } else {
                newScale = Math.max(newScale, 0.48);
            }
            
            if (isDesktop) {
                if (newScale > 1.22) newScale = 1.22;
            } else {
                if (newScale > 1.1) newScale = 1.1;
            }
            setScale(newScale);
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        if ((window as any).deferredPWAPrompt) {
            setDeferredPrompt((window as any).deferredPWAPrompt);
            setIsInstallable(true);
        }

        const pwaHandler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsInstallable(true);
            (window as any).deferredPWAPrompt = e;
        };

        const globalPwaHandler = (e: any) => {
            if (e.detail) {
                setDeferredPrompt(e.detail);
                setIsInstallable(true);
            }
        };

        const appInstalledHandler = () => {
            setIsStandalone(true);
            setIsInstallable(false);
            setDeferredPrompt(null);
            (window as any).deferredPWAPrompt = null;
        };

        window.addEventListener('beforeinstallprompt', pwaHandler);
        window.addEventListener('pwa-prompt-available' as any, globalPwaHandler);
        window.addEventListener('appinstalled', appInstalledHandler);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('beforeinstallprompt', pwaHandler);
            window.removeEventListener('pwa-prompt-available' as any, globalPwaHandler);
            window.removeEventListener('appinstalled', appInstalledHandler);
        };
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
                setIsInstallable(false);
            }
        } else {
            if (isIOS) {
                alert("📲 INSTALL ON iOS:\n\n1. Tap the Share button (square with arrow)\n2. Scroll down and tap 'Add to Home Screen'");
            } else {
                alert("📲 INSTALL MANUALLY:\n\n1. Tap the Browser Menu (three dots ⋮ or arrow)\n2. Select 'Add to Home Screen' or 'Install App'");
            }
        }
    };

    const handleLogout = () => {
        audioManager.playSound('click');
        localStorage.removeItem('aadish_roulette_logged_in_user');
        setLoggedInUser(null);
        window.location.reload();
    };

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        setLoginSuccess('');
        setIsLoadingRedis(true);
        audioManager.playSound('click');

        const u = loginUsername.trim().toLowerCase();
        const p = loginPassword.trim();

        if (!u || !p) {
            setLoginError('ALL FIELDS REQUIRED');
            setIsLoadingRedis(false);
            return;
        }

        if (p.length < 6) {
            setLoginError('PASSWORD MUST BE AT LEAST 6 CHARACTERS');
            setIsLoadingRedis(false);
            return;
        }
        if (p.length > 20) {
            setLoginError('PASSWORD MUST BE AT MOST 20 CHARACTERS');
            setIsLoadingRedis(false);
            return;
        }

        try {
            if (loginTab === 'signin') {
                const res = await loginUser(u, p);
                if (res.success && res.user) {
                    setLoginSuccess('IDENTITY VERIFIED');
                    localStorage.setItem('aadish_roulette_logged_in_user', JSON.stringify({ username: res.user.username }));
                    localStorage.setItem('aadish_roulette_stats_v1', JSON.stringify(res.user.stats));
                    setLoggedInUser({ username: res.user.username });
                    setInputName(res.user.username.toUpperCase());
                    setTimeout(() => {
                        setShowLoginModal(false);
                        setLoginPassword('');
                        setLoginUsername('');
                        setLoginSuccess('');
                    }, 1200);
                } else {
                    setLoginError(res.error || 'ACCESS DENIED');
                }
            } else {
                const res = await registerUser(u, p);
                if (res.success && res.user) {
                    setLoginSuccess('CREDENTIALS SAVED');
                    localStorage.setItem('aadish_roulette_logged_in_user', JSON.stringify({ username: res.user.username }));
                    localStorage.setItem('aadish_roulette_stats_v1', JSON.stringify(res.user.stats));
                    setLoggedInUser({ username: res.user.username });
                    setInputName(res.user.username.toUpperCase());
                    setTimeout(() => {
                        setShowLoginModal(false);
                        setLoginPassword('');
                        setLoginUsername('');
                        setLoginSuccess('');
                    }, 1200);
                } else {
                    setLoginError(res.error || 'REGISTRATION FAILED');
                }
            }
        } catch (err) {
            setLoginError('LINK FAULT');
        } finally {
            setIsLoadingRedis(false);
        }
    };

    // Derived values for the Career Modal popup
    const winRate = selectedCareerUser ? Math.round((selectedCareerUser.wins / Math.max(1, selectedCareerUser.wins + selectedCareerUser.losses)) * 100) : 0;
    const precisionRate = selectedCareerUser && selectedCareerUser.stats.shotsFired > 0 ? Math.round((selectedCareerUser.stats.shotsHit / selectedCareerUser.stats.shotsFired) * 100) : 0;

    if (!hasBoundSoul) {
        return (
            <div 
                className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden pointer-events-auto bg-black/45 backdrop-blur-[2px] font-mono cursor-pointer animate-in fade-in duration-1000 select-none"
                onClick={async () => {
                    await audioManager.initialize();
                    audioManager.playSound('click');
                    setHasBoundSoul(true);
                }}
            >
                {/* Background ambient light */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.05)_0%,transparent_70%)] animate-pulse pointer-events-none" />

                <div className="text-center relative z-10 p-4">
                    <h1 className="text-4xl sm:text-6xl md:text-8xl font-black text-stone-100 mb-6 sm:mb-8 tracking-tighter leading-none drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                        <span className="block animate-in slide-in-from-top duration-700">AADISH</span>
                        <span className="block text-red-700 animate-[text-pop_0.5s_ease-out] relative">
                            ROULETTE
                            {!isMobile && (
                                <span className="absolute -inset-1 text-red-400 opacity-20 blur-sm animate-glitch pointer-events-none">ROULETTE</span>
                            )}
                        </span>
                    </h1>
                    <div className="text-stone-500 text-xs sm:text-sm md:text-xl tracking-[0.5em] font-bold uppercase transition-all duration-300 group hover:text-stone-100">
                        <div className="animate-pulse mb-2">[ CLICK TO BIND SOUL ]</div>
                        <div className="text-[9px] sm:text-[10px] text-stone-750 group-hover:text-red-900 transition-colors">By entering, you waive all rights to physical continuity</div>
                    </div>
                </div>

                {/* Scanline overlay */}
                {!isMobile && <div className="scan-line !opacity-20 pointer-events-none" />}
            </div>
        );
    }
     return (
         <div className="absolute inset-0 z-50 flex flex-col items-center justify-start sm:justify-center overflow-y-auto pointer-events-auto bg-black/40 backdrop-blur-[2px] p-2 sm:p-4 select-none custom-scrollbar">
                  {/* Top Right User Profile Badge Section (Hidden on mobile) */}
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-[60] hidden sm:flex items-center gap-3">
                {loggedInUser ? (
                    <div className="flex items-center gap-3 bg-stone-950/80 border border-green-950/40 p-2 px-3 sm:px-4 rounded-xl backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                        <div className="flex flex-col text-left">
                            <span className="text-[7px] text-stone-500 font-bold uppercase tracking-widest leading-none mb-0.5">Agent Signed In</span>
                            <span className="text-[10px] sm:text-[11px] text-green-400 font-mono font-black uppercase tracking-wider leading-none">{loggedInUser.username}</span>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="ml-2 px-2.5 py-1.5 bg-red-955/40 hover:bg-red-900 text-red-500 hover:text-white font-mono font-bold text-[8px] tracking-widest rounded-lg border border-red-900/30 uppercase transition-all cursor-pointer small-btn"
                        >
                            Disconnect
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => {
                            audioManager.playSound('click');
                            setShowLoginModal(true);
                        }}
                        className="group/signin px-4 py-2 sm:px-5 sm:py-2.5 bg-gradient-to-r from-red-955/60 to-stone-950/80 border border-red-700/50 text-red-400 hover:text-white hover:border-red-500 font-mono font-black text-[9px] sm:text-[10px] tracking-[0.2em] rounded-xl backdrop-blur-md transition-all shadow-[0_0_25px_rgba(220,38,38,0.15)] hover:shadow-[0_0_40px_rgba(220,38,38,0.3)] hover:scale-105 active:scale-95 uppercase flex items-center gap-2 cursor-pointer small-btn"
                    >
                        <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-red-650"></span>
                        </span>
                        Sign In / Register
                    </button>
                )}
            </div>
            {/* Bottom Right Floating Changelog Button (Hidden on mobile) */}
            <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-[60] hidden sm:block">
                <button
                    onClick={() => {
                        audioManager.playSound('click');
                        setShowChangelog(true);
                    }}
                    className="group/cl p-3.5 sm:p-4 bg-gradient-to-br from-stone-900/90 to-stone-950/90 border border-stone-700/50 text-stone-400 hover:text-amber-455 hover:border-amber-600/50 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-md transition-all hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer hover:shadow-[0_0_30px_rgba(245,158,11,0.15)] small-btn"
                    title="System Changelog"
                >
                    <BookOpen size={20} className="group-hover/cl:rotate-[-8deg] transition-transform duration-300" />
                </button>
            </div>

            {/* Hard Mode Warning Modal */}
            {showHardModeWarning && (
                <div className="absolute inset-0 z-[100] flex flex-col items-center justify-start sm:justify-center bg-black/95 animate-in fade-in zoom-in duration-500 p-3 sm:p-4 overflow-y-auto custom-scrollbar">
                    <div className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-screen bg-[url('https://media.giphy.com/media/oEI9uWU0WMrQmInJWC/giphy.gif')] bg-repeat" />
                    <div
                        className="relative bg-stone-950/80 backdrop-blur-xl border border-red-900/50 p-4 sm:p-8 md:p-12 max-w-xl text-center shadow-[0_0_100px_rgba(220,38,38,0.2)] rounded-2xl group origin-center transition-transform duration-200 my-4 sm:my-auto"
                        style={{ transform: `scale(${scale})` }}
                    >
                        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[repeating-linear-gradient(45deg,transparent,transparent_15px,rgba(220,38,38,0.05)_15px,rgba(220,38,38,0.05)_30px)]" />
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="text-red-700 mb-4 sm:mb-6 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">
                                <ShieldAlert size={isMobile ? 50 : 80} />
                            </div>
                            <h2 className="text-3xl sm:text-5xl md:text-7xl font-black text-red-600 mb-1.5 sm:mb-2 tracking-tighter uppercase drop-shadow-[0_0_20px_rgba(220,38,38,0.3)]">WARNING</h2>
                            <p className="text-stone-400 text-xs sm:text-lg md:text-xl font-bold mb-4 sm:mb-8 tracking-[0.4em] uppercase">High Stakes Protocol</p>

                            <div className="bg-black/60 p-4 sm:p-6 border border-red-900/30 mb-6 sm:mb-10 w-full backdrop-blur-md relative overflow-hidden group-hover:border-red-600/30 transition-colors rounded-xl">
                                <div className="absolute top-0 left-0 w-full h-[1px] bg-red-600/50 animate-[scan-line-move_3s_linear_infinite]" />
                                <div className="space-y-2 sm:space-y-4">
                                    <p className="text-red-500/80 font-mono text-xs sm:text-sm md:text-base font-bold tracking-[0.2em] flex items-center justify-center gap-2.5 sm:gap-4">
                                        <span className="w-1.5 h-1.5 bg-red-800 rounded-full" /> DEALER IS RUTHLESS
                                    </p>
                                    <p className="text-red-500/80 font-mono text-xs sm:text-sm md:text-base font-bold tracking-[0.2em] flex items-center justify-center gap-2.5 sm:gap-4">
                                        <span className="w-1.5 h-1.5 bg-red-800 rounded-full" /> DOUBLE OR NOTHING
                                    </p>
                                    <p className="text-red-500/80 font-mono text-xs sm:text-sm md:text-base font-bold tracking-[0.2em] flex items-center justify-center gap-2.5 sm:gap-4">
                                        <span className="w-1.5 h-1.5 bg-red-800 rounded-full" /> NO SECOND CHANCES
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 sm:gap-5 w-full">
                                <button
                                    onClick={() => {
                                        audioManager.playSound('insert');
                                        onStartGame(true);
                                    }}
                                    className="w-full py-3 sm:py-5 bg-red-900/20 hover:bg-red-750 text-white font-black text-lg sm:text-2xl tracking-[0.3em] border-2 border-red-700/50 hover:border-red-500 transition-all hover:scale-[1.02] hover:shadow-[0_0_50px_rgba(220,38,38,0.4)] active:scale-95 group relative overflow-hidden cursor-pointer rounded-xl"
                                >
                                    <span className="relative z-10">ACCEPT FATE</span>
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                                </button>
                                <button
                                    onClick={() => {
                                        audioManager.playSound('click');
                                        setShowHardModeWarning(false);
                                    }}
                                    className="w-full py-2.5 sm:py-3 bg-stone-900/40 hover:bg-stone-900 border border-stone-800 hover:border-stone-650 text-stone-400 hover:text-white transition-all tracking-[0.4em] text-[10px] sm:text-xs uppercase cursor-pointer rounded-xl active:scale-98 shadow-sm"
                                >
                                    — ABORT MISSION —
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
                  {/* Redesigned Cyberpunk Login / Register Modal */}
            {showLoginModal && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-2 sm:p-4 animate-in fade-in duration-300 overflow-y-auto">
                    {/* Glowing background circles for ambient depth */}
                    <div className="absolute w-[450px] h-[450px] bg-red-950/15 rounded-full blur-[120px] pointer-events-none -translate-x-1/4 -translate-y-1/4" />
                    <div className="absolute w-[400px] h-[400px] bg-red-900/10 rounded-full blur-[100px] pointer-events-none translate-x-1/4 translate-y-1/4" />
                    
                    <div
                        className="relative w-full max-w-md max-h-[95vh] bg-stone-950 border-2 border-red-500/20 rounded-xl shadow-[0_0_80px_rgba(0,0,0,0.95),0_0_40px_rgba(239,68,68,0.15)] font-mono text-stone-300 p-3.5 sm:p-5 flex flex-col justify-center overflow-y-auto hover:border-red-500/40 transition-all duration-700 my-auto"
                    >
                        {/* CRT Scanline Overlay Effect */}
                        {!isMobile && (
                            <div className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%]" />
                        )}
                        
                        {/* Tech ticks */}
                        <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-red-650/40 pointer-events-none" />
                        <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-red-650/40 pointer-events-none" />
                        <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-red-650/40 pointer-events-none" />
                        <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-red-650/40 pointer-events-none" />

                        {/* Close button in top-right - Redesigned for high visibility */}
                        <button
                            type="button"
                            onClick={() => {
                                audioManager.playSound('click');
                                setShowLoginModal(false);
                                setLoginError('');
                                setLoginSuccess('');
                                setLoginPassword('');
                                setLoginUsername('');
                            }}
                            className="absolute top-3 right-3 sm:top-4 sm:right-4 text-stone-300 hover:text-red-400 bg-stone-900/60 hover:bg-red-955/30 border border-stone-800 hover:border-red-500/45 p-1.5 rounded-xl z-50 cursor-pointer flex items-center justify-center shadow-lg hover:shadow-[0_0_15px_rgba(239,68,68,0.25)] transition-all small-btn"
                            title="Close Portal"
                        >
                            <X size={12} />
                        </button>

                        {/* Quote & Header details */}
                        <div className="text-center mb-3 mt-0.5 border-b border-stone-900 pb-2.5">
                            <div className="text-[8px] sm:text-[9px] text-stone-500 tracking-[0.45em] uppercase mb-1 flex items-center justify-center gap-1.5">
                                <Terminal size={10} className="text-red-650 animate-pulse" />
                                <span>CON_SECURITY_PORTAL</span>
                            </div>
                            <h3 className="text-base sm:text-lg md:text-xl font-black text-stone-100 tracking-wider uppercase mb-1.5">AGENT AUTHENTICATION</h3>
                            <p className="text-red-500/80 italic text-[9px] sm:text-[10px] tracking-wider max-w-sm mx-auto animate-pulse font-medium">
                                "{loginQuote}"
                            </p>
                        </div>

                        {/* Tabs Switcher */}
                        <div className="grid grid-cols-2 gap-2 mb-3 bg-stone-950 border border-stone-900 p-1 rounded-xl">
                            <button
                                type="button"
                                onClick={() => {
                                    audioManager.playSound('click');
                                    setLoginTab('signin');
                                    setLoginError('');
                                    setLoginSuccess('');
                                }}
                                className={`py-1.5 sm:py-2 text-[9px] sm:text-[10px] font-black tracking-widest uppercase transition-all duration-300 cursor-pointer rounded-lg border ${loginTab === 'signin' ? 'text-green-400 bg-green-950/15 border-green-800/45 shadow-[0_0_15px_rgba(34,197,94,0.08)]' : 'text-stone-550 border-transparent hover:text-stone-300 hover:bg-stone-900/40'}`}
                            >
                                [ SIGN_IN ]
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    audioManager.playSound('click');
                                    setLoginTab('register');
                                    setLoginError('');
                                    setLoginSuccess('');
                                }}
                                className={`py-1.5 sm:py-2 text-[9px] sm:text-[10px] font-black tracking-widest uppercase transition-all duration-300 cursor-pointer rounded-lg border ${loginTab === 'register' ? 'text-red-400 bg-red-955/15 border-red-800/45 shadow-[0_0_15px_rgba(220,38,38,0.08)]' : 'text-stone-550 border-transparent hover:text-stone-300 hover:bg-stone-900/40'}`}
                            >
                                [ REGISTER ]
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleLoginSubmit} className="space-y-3 sm:space-y-4">
                            {/* Username Input */}
                            <div>
                                <div className="flex justify-between items-center mb-1 px-1">
                                    <span className="text-[8px] sm:text-[9px] text-stone-550 font-bold tracking-widest uppercase flex items-center gap-1.5">
                                        <User size={10} className="text-red-650" />
                                        Username
                                    </span>
                                    <span className="text-[8px] text-stone-600 font-mono tracking-widest uppercase">REQ: 1-12 CHARS</span>
                                </div>
                                <div className="relative flex items-center group/input">
                                    <span className="absolute left-2.5 text-stone-650 group-focus-within/input:text-red-500 transition-colors font-bold text-xs pointer-events-none">[</span>
                                    <input
                                        type="text"
                                        value={loginUsername}
                                        onChange={(e) => setLoginUsername(e.target.value)}
                                        placeholder="ENTER AGENT IDENTITY"
                                        maxLength={12}
                                        className="w-full bg-stone-950 border-2 border-stone-850 hover:border-stone-750 focus:border-red-500/50 px-5 py-2 sm:py-2.5 text-[10px] sm:text-xs font-mono font-bold text-stone-200 outline-none transition-all tracking-[0.15em] uppercase rounded-xl placeholder-stone-850 focus:shadow-[0_0_20px_rgba(220,38,38,0.06)]"
                                        required
                                    />
                                    <span className="absolute right-2.5 text-stone-650 group-focus-within/input:text-red-500 transition-colors font-bold text-xs pointer-events-none">]</span>
                                </div>
                            </div>

                            {/* Password Input */}
                            <div>
                                <div className="flex justify-between items-center mb-1 px-1">
                                    <span className="text-[8px] sm:text-[9px] text-stone-550 font-bold tracking-widest uppercase flex items-center gap-1.5">
                                        <Lock size={10} className="text-red-655" />
                                        Password
                                    </span>
                                    <span className="text-[8px] text-stone-600 font-mono tracking-widest uppercase">REQ: 6-20 CHARS</span>
                                </div>
                                <div className="relative flex items-center group/input">
                                    <span className="absolute left-2.5 text-stone-655 group-focus-within/input:text-red-500 transition-colors font-bold text-xs pointer-events-none">[</span>
                                    <input
                                        type="password"
                                        value={loginPassword}
                                        onChange={(e) => setLoginPassword(e.target.value)}
                                        placeholder="••••••••••••••"
                                        minLength={6}
                                        maxLength={20}
                                        className="w-full bg-stone-950 border-2 border-stone-855 hover:border-stone-750 focus:border-red-500/50 px-5 py-2 sm:py-2.5 text-[10px] sm:text-xs font-mono font-bold text-stone-200 outline-none transition-all tracking-[0.15em] uppercase rounded-xl placeholder-stone-855 focus:shadow-[0_0_20px_rgba(220,38,38,0.06)]"
                                        required
                                    />
                                    <span className="absolute right-2.5 text-stone-655 group-focus-within/input:text-red-500 transition-colors font-bold text-xs pointer-events-none">]</span>
                                </div>
                            </div>

                            {/* Error Readout */}
                            {loginError && (
                                <div className="text-[8px] sm:text-[9px] text-red-550 font-bold tracking-wider uppercase border border-red-900/40 bg-red-955/20 p-2 sm:p-2.5 rounded-lg animate-[shake_0.5s_ease-in-out] flex items-center gap-2">
                                    <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
                                    <span>[CRITICAL FAULT: {loginError}]</span>
                                </div>
                            )}

                            {/* Success Readout */}
                            {loginSuccess && (
                                <div className="text-[8px] sm:text-[9px] text-green-500 font-bold tracking-wider uppercase border border-green-900/40 bg-green-955/20 p-2 sm:p-2.5 rounded-lg animate-pulse flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                                    <span>[SYNC COMPLETE: {loginSuccess}]</span>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="pt-0.5 space-y-2.5 sm:space-y-3.5">
                                <button
                                    type="submit"
                                    disabled={isLoadingRedis}
                                    className="w-full py-2.5 sm:py-3.5 bg-gradient-to-r from-red-950/80 to-red-900/60 hover:from-red-900 hover:to-red-750 text-red-400 hover:text-white font-black text-[9px] sm:text-[10px] tracking-[0.3em] border-2 border-red-900/60 hover:border-red-500 transition-all rounded-xl cursor-pointer shadow-lg active:scale-[0.98] disabled:opacity-50 uppercase flex items-center justify-center gap-2 hover:shadow-[0_0_35px_rgba(220,38,38,0.4)]"
                                >
                                    {isLoadingRedis && <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin sm:w-4 sm:h-4" />}
                                    <span>
                                        {isLoadingRedis 
                                            ? 'ESTABLISHING SECURE NET_LINK...' 
                                            : (loginTab === 'signin' ? 'EXECUTE AUTHENTICATION' : 'ENROLL CODENAME PROTOCOL')
                                        }
                                    </span>
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={() => {
                                        audioManager.playSound('click');
                                        setShowLoginModal(false);
                                        setLoginError('');
                                        setLoginSuccess('');
                                        setLoginPassword('');
                                        setLoginUsername('');
                                    }}
                                    className="w-full py-1.5 sm:py-2 bg-transparent text-stone-600 hover:text-stone-400 font-bold text-[8px] sm:text-[9px] tracking-[0.3em] uppercase transition-colors cursor-pointer text-center"
                                >
                                    — SHUTDOWN PORTAL —
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Redesigned, Scaled-Up System Changelog Modal */}
            {showChangelog && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-300">
                    <div className="relative w-full max-w-3xl max-h-[95vh] bg-stone-950/95 border-2 border-stone-800/80 p-3.5 sm:p-6 md:p-8 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] font-mono flex flex-col overflow-hidden">
                        {/* Top-right close button */}
                        <button
                            onClick={() => {
                                audioManager.playSound('click');
                                setShowChangelog(false);
                            }}
                            className="absolute top-3 right-3 sm:top-5 sm:right-5 text-stone-300 hover:text-red-400 bg-stone-900/60 hover:bg-red-955/30 border border-stone-850 hover:border-red-500/45 p-1.5 sm:p-2 rounded-xl z-50 cursor-pointer flex items-center justify-center shadow-lg hover:shadow-[0_0_15px_rgba(239,68,68,0.25)] transition-all small-btn"
                            title="Close Console"
                        >
                            <X size={14} className="sm:w-[18px] sm:h-[18px]" />
                        </button>

                        <div className="absolute top-0 left-0 w-full h-[2px] bg-red-650/40 animate-[scan-line-move_4s_linear_infinite]" />
                        <div className="text-stone-350 font-black border-b border-stone-900 pb-2.5 mb-3.5 sm:pb-4 sm:mb-5 flex items-center justify-between uppercase tracking-wider text-xs sm:text-base">
                            <span className="flex items-center gap-2">
                                <Terminal size={14} className="text-red-500 sm:w-[18px] sm:h-[18px]" />
                                System Changelog
                            </span>
                            <span className="text-red-500/80 animate-pulse flex items-center gap-1.5 text-[10px] sm:text-xs bg-red-950/20 border border-red-900/35 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-lg mr-8 sm:mr-10">
                                <span className="w-1.5 h-1.5 bg-red-600 rounded-full" />
                                active
                            </span>
                        </div>
                        
                        <div className="space-y-3.5 sm:space-y-4.5 text-left flex-1 min-h-0 overflow-y-auto pr-1.5 select-text scrollbar-thin text-[10px] sm:text-xs md:text-sm text-stone-400 custom-scrollbar">
                            <div className="space-y-2.5 bg-stone-950 border border-stone-900/60 p-3.5 sm:p-5 rounded-lg animate-pulse-slow">
                                <span className="text-stone-200 font-black block border-b border-stone-900 pb-1 text-[11px] sm:text-xs md:text-sm tracking-wider">[June 22, 2026 - Server Performance & Memory Leaks Cleanups (v1.4.2)]</span>
                                <ul className="list-none space-y-2 pl-0.5">
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">OPTIMIZED</span>
                                        <span className="leading-relaxed">Stateless Throttling Engine: Replaced per-connection background intervals with high-frequency timestamp differential calculations, reducing server memory allocation loads.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">OPTIMIZED</span>
                                        <span className="leading-relaxed">Allocation Pools: Moved join logic handlers outside the connection events closure scope to minimize dynamic javascript stack overheads.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-cyan-950/50 border border-cyan-800/40 text-cyan-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">RECONNECTED</span>
                                        <span className="leading-relaxed">Seamless Link Recovery: Reconnecting players using duplicate identities overwrite obsolete socket descriptors cleanly, avoiding ghost nodes in active rooms.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-amber-950/50 border border-amber-800/40 text-amber-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">CLEANED</span>
                                        <span className="leading-relaxed">Resource GC Safeguard: Room memory collector ejects lingering socket connections upon purging inactive rooms, and React layout hooks clear initial check timers to prevent leak states.</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="space-y-2.5 bg-stone-950 border border-stone-900/60 p-3.5 sm:p-5 rounded-lg opacity-90 hover:opacity-100 transition-opacity">
                                <span className="text-stone-200 font-black block border-b border-stone-900 pb-1 text-[11px] sm:text-xs md:text-sm tracking-wider">[June 22, 2026 - Crash Prevention & Connection Stability (v1.4.1)]</span>
                                <ul className="list-none space-y-2 pl-0.5">
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">ADDED</span>
                                        <span className="leading-relaxed">Crash & Freeze Protection: Listens for mid-game opponent disconnect alerts to instantly clear variables and cleanly redirect survivors back to the room lobby.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">ADDED</span>
                                        <span className="leading-relaxed">Fallback Long-Polling Transport: Socket connections now seamlessly fall back to polling transport when WebSockets are blocked by proxies.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-cyan-950/50 border border-cyan-800/40 text-cyan-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">REFACTORED</span>
                                        <span className="leading-relaxed">Code Deduplication: Extracted room configuration builders on the server and cache configuration loading hooks on the client.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-amber-950/50 border border-amber-800/40 text-amber-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">UPDATED</span>
                                        <span className="leading-relaxed">Server Spec Diagnostic Labels: Diagnostics screen correctly formats RANDOM attribute markers to "RNDM" instead of absolute sentinel integers.</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="space-y-2.5 bg-stone-950 border border-stone-900/60 p-3.5 sm:p-5 rounded-lg opacity-90 hover:opacity-100 transition-opacity">
                                <span className="text-stone-200 font-black block border-b border-stone-900 pb-1 text-[11px] sm:text-xs md:text-sm tracking-wider">[June 21, 2026 - Final Polish & Multiplayer Optimizations (v1.4.0)]</span>
                                <ul className="list-none space-y-2 pl-0.5">
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">ADDED</span>
                                        <span className="leading-relaxed">Multiplayer Manual Section: Reorganized the Tactical Manual and added a Multiplayer overview section with item page pagination adjustments.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">ADDED</span>
                                        <span className="leading-relaxed">Visual Performance Optimizations: Auto-disables GPU-heavy CRT and scanline overlay animations during active multiplayer window configurations to boost FPS.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-amber-950/50 border border-amber-800/40 text-amber-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">UPDATED</span>
                                        <span className="leading-relaxed">Chatarea Status Indicator: In-game chat boxes now present an informative label identifying system-wide messaging nodes and join notices.</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="space-y-2.5 bg-stone-950 border border-stone-900/60 p-3.5 sm:p-5 rounded-lg opacity-90 hover:opacity-100 transition-opacity">
                                <span className="text-stone-200 font-black block border-b border-stone-900 pb-1 text-[11px] sm:text-xs md:text-sm tracking-wider">[June 21, 2026 - Multiplayer settings & performance update (v1.3.0)]</span>
                                <ul className="list-none space-y-2 pl-0.5">
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">ADDED</span>
                                        <span className="leading-relaxed">RANDOM Lobby Settings: Default starting health and items per shipment are set to RANDOM (value 9) on lobby entrance.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">ADDED</span>
                                        <span className="leading-relaxed">Advanced Settings Auto-Disable: Keeps Advanced Configuration toggled off initially when creating or joining rooms.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-amber-950/50 border border-amber-800/40 text-amber-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">UPDATED</span>
                                        <span className="leading-relaxed">Full Selection Layout Scaling: Locks stable horizontal three-column layout deck on mobile viewports with no cards wrapping.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-amber-950/50 border border-amber-800/40 text-amber-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">OPTIMIZED</span>
                                        <span className="leading-relaxed">Background WebGL Rendering: Pauses animation tick loops and hides container element completely when selection/lobby screens are active.</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="space-y-2.5 bg-stone-950 border border-stone-900/60 p-3.5 sm:p-5 rounded-lg opacity-90 hover:opacity-100 transition-opacity">
                                <span className="text-stone-200 font-black block border-b border-stone-900 pb-1 text-[11px] sm:text-xs md:text-sm tracking-wider">[June 20, 2026 - Calibration & Smart AI Update (v1.2.1)]</span>
                                <ul className="list-none space-y-2 pl-0.5">
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">ADDED</span>
                                        <span className="leading-relaxed">Smart Dealer AI Jackpot counters: Hard Mode Dealer avoids wasting Saw (90% chance) and uses Inverter (85% chance) on known live shells to flip them to blank and keep turn. Normal Mode has 70% chance to avoid wasting Saw.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">ADDED</span>
                                        <span className="leading-relaxed">Tactile Potato Mode inventory: slots slide up by -8px on hover/select and show distinct solid amber border outlines.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-amber-950/50 border border-amber-800/40 text-amber-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">UPDATED</span>
                                        <span className="leading-relaxed">Increased Hard Mode Dealer peeking rates to 70% supernatural intuition and 90% optimal Tarot card selection.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-amber-950/50 border border-amber-800/40 text-amber-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">OPTIMIZED</span>
                                        <span className="leading-relaxed">Dynamic Quality Profile Syncing: quality changes automatically re-compile WebGL materials and update shadow maps.</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="space-y-2.5 bg-stone-950 border border-stone-900/60 p-3.5 sm:p-5 rounded-lg opacity-90 hover:opacity-100 transition-opacity">
                                <span className="text-stone-200 font-black block border-b border-stone-900 pb-1 text-[11px] sm:text-xs md:text-sm tracking-wider">[June 20, 2026 - Tarot Deck & Items Update (v1.2.0)]</span>
                                <ul className="list-none space-y-2 pl-0.5">
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">ADDED</span>
                                        <span className="leading-relaxed">Tarot Card Deck (DECK_CARD) for drawing 1 of 6 active/passive Tarot cards.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">ADDED</span>
                                        <span className="leading-relaxed">New items: Lucky Charm, Flashbang, Crusher, Totem, Mirror and Tarot Cards.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-amber-950/50 border border-amber-800/40 text-amber-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">UPDATED</span>
                                        <span className="leading-relaxed">Redesigned the Mirror model to be a handle-free gold ornate oval hand-mirror.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-amber-950/50 border border-amber-800/40 text-amber-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">UPDATED</span>
                                        <span className="leading-relaxed">Hermit card ends turn instantly; Judgment converted shell probability adjusted to 50%.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-red-950/50 border border-red-800/40 text-red-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">FIXED</span>
                                        <span className="leading-relaxed">Tarot Card cheats in debug panel now correctly trigger fanning and flip-reveal animations.</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="space-y-2.5 bg-stone-950 border border-stone-900/60 p-3.5 sm:p-5 rounded-lg opacity-90 hover:opacity-100 transition-opacity">
                                <span className="text-stone-200 font-black block border-b border-stone-900 pb-1 text-[11px] sm:text-xs md:text-sm tracking-wider">[June 15, 2026 - Mobile & Stats Polish (v1.1.3)]</span>
                                <ul className="list-none space-y-2 pl-0.5">
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">ADDED</span>
                                        <span className="leading-relaxed">Debug Mode with cheat options (ignores stats/leaderboard).</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-red-950/50 border border-red-800/40 text-red-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">FIXED</span>
                                        <span className="leading-relaxed">Responsive mobile layout scaling for career & login views.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-red-950/50 border border-red-800/40 text-red-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">FIXED</span>
                                        <span className="leading-relaxed">Menu clipping fixes and manual guide scroll tuning on mobile.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-amber-950/50 border border-amber-800/40 text-amber-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">OPTIMIZED</span>
                                        <span className="leading-relaxed">Career matches now display accurate historical local dates.</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="space-y-2.5 bg-stone-950 border border-stone-900/60 p-3.5 sm:p-5 rounded-lg opacity-90 hover:opacity-100 transition-opacity">
                                <span className="text-stone-200 font-black block border-b border-stone-900 pb-1 text-[11px] sm:text-xs md:text-sm tracking-wider">[June 15, 2026 - Calibration & Polish (v1.1.1)]</span>
                                <ul className="list-none space-y-2 pl-0.5">
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">ADDED</span>
                                        <span className="leading-relaxed">Ultra Performance mode profile (no shadows, flat UI, 60FPS).</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">ADDED</span>
                                        <span className="leading-relaxed">Redesigned glassmorphic Live/Blank count start panels.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">ADDED</span>
                                        <span className="leading-relaxed">Dynamic High-fidelity shell icons in main HUD indicators.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-red-950/50 border border-red-800/40 text-red-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">FIXED</span>
                                        <span className="leading-relaxed">Eliminated stutters by cleaning up setups at round starts.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-amber-950/50 border border-amber-800/40 text-amber-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">OPTIMIZED</span>
                                        <span className="leading-relaxed">Lighting performance adjustments and menu box scalability.</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="space-y-2.5 bg-stone-950 border border-stone-900/60 p-3.5 sm:p-5 rounded-lg opacity-80 hover:opacity-100 transition-opacity">
                                <span className="text-stone-300 font-black block border-b border-stone-900 pb-1 text-[11px] sm:text-xs md:text-sm tracking-wider">[June 14, 2026 - System Calibration & Redesign (v1.1.0)]</span>
                                <ul className="list-none space-y-2 pl-0.5">
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">ADDED</span>
                                        <span className="leading-relaxed">Redesigned cyber-themed login console & quote header.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">ADDED</span>
                                        <span className="leading-relaxed">Smart default presets mapped out for PC versus Mobile.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">ADDED</span>
                                        <span className="leading-relaxed">Fixed items overflow grids on mobile landscape layouts.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-amber-950/50 border border-amber-800/40 text-amber-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">OPTIMIZED</span>
                                        <span className="leading-relaxed">Detailed player rank indicators on podium leaderboard.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-amber-950/50 border border-amber-800/40 text-amber-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">OPTIMIZED</span>
                                        <span className="leading-relaxed">Neon hover borders and smooth button click transitions.</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="space-y-2.5 bg-stone-950 border border-stone-900/60 p-3.5 sm:p-5 rounded-lg opacity-75 hover:opacity-100 transition-opacity">
                                <span className="text-stone-400 font-black block border-b border-stone-900 pb-1 text-[10px] sm:text-xs tracking-wider">[Previous Deployments]</span>
                                <ul className="list-none space-y-2 pl-0.5">
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">ADDED</span>
                                        <span className="leading-relaxed">Implemented device-aware graphics profiles (Mobile, Tablet, PC).</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-red-950/50 border border-red-800/40 text-red-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">FIXED</span>
                                        <span className="leading-relaxed">Disabled shadows on mobile/tablet to secure stable 60FPS.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-blue-950/50 border border-blue-800/40 text-blue-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">SYSTEM</span>
                                        <span className="leading-relaxed">Added reroll penalty for duplicate item drops.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                audioManager.playSound('click');
                                setShowChangelog(false);
                            }}
                            className="mt-4 sm:mt-6 w-full py-2.5 sm:py-4 bg-stone-900 border border-stone-850 hover:border-stone-600 hover:text-white text-stone-400 font-bold text-[10px] sm:text-xs tracking-[0.4em] uppercase transition-all rounded-xl cursor-pointer active:scale-98 shadow-md"
                        >
                            Close Console
                        </button>
                    </div>
                </div>
            )}

            {/* Redesigned, Scaled-Up Global Leaderboard Modal */}
            {showLeaderboard && (
                <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-300 overflow-hidden">
                    <div className="relative w-[85vw] h-[85vh] max-w-[85vw] max-h-[85vh] bg-stone-950/95 border-2 border-stone-850 p-3 sm:p-4 md:p-6 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] font-mono flex flex-col overflow-hidden my-auto">
                        {/* Top-right close button */}
                        <button
                            onClick={() => {
                                audioManager.playSound('click');
                                setShowLeaderboard(false);
                            }}
                            className="absolute top-4 right-4 text-stone-355 hover:text-amber-455 bg-stone-900/60 hover:bg-amber-955/30 border border-stone-800 hover:border-amber-500/45 p-1.5 rounded-xl z-50 cursor-pointer flex items-center justify-center shadow-lg hover:shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all small-btn"
                            title="Close Leaderboard"
                        >
                            <X size={16} />
                        </button>

                        <div className="absolute top-0 left-0 w-full h-[2px] bg-amber-650/40 animate-[scan-line-move_4s_linear_infinite]" />
                        
                        {/* Header Box */}
                        <div className="text-stone-300 font-black border-b border-stone-900 pb-2 sm:pb-3 mb-3 sm:mb-4 flex items-center justify-between uppercase tracking-wider text-xs sm:text-sm shrink-0">
                            <span className="flex items-center gap-1.5">
                                <Crown size={16} className="text-amber-500 animate-pulse animate-duration-1000 shrink-0" />
                                <span className="text-sm sm:text-base tracking-widest">Global Leaderboard Matrix</span>
                            </span>
                            <span className="text-amber-500/80 flex items-center gap-1 text-[9px] sm:text-xs bg-amber-950/20 border border-amber-900/35 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg mr-8 sm:mr-10 shrink-0">
                                <span className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-ping" />
                                {leaderboard.length} verified agents
                            </span>
                        </div>

                        {/* Column Table Header */}
                        {leaderboard.length > 0 && !isLoadingLeaderboard && (
                            <div className="flex items-center px-3 py-2 text-[8px] sm:text-[10px] font-black text-stone-500 uppercase tracking-widest border-b border-stone-900/60 mb-1.5 sm:mb-2 shrink-0">
                                <span className="w-10 sm:w-14 text-center shrink-0">Rank</span>
                                <span className="flex-1 pl-2 sm:pl-4 text-left">Agent Codename</span>
                                <span className="w-24 sm:w-32 text-center shrink-0">Victory Feed</span>
                                <span className="w-16 sm:w-24 text-center shrink-0 font-bold">Win Ratio</span>
                            </div>
                        )}

                        <div className="space-y-1.5 sm:space-y-2 flex-1 overflow-y-auto pr-1 select-none scrollbar-thin custom-scrollbar">
                            {isLoadingLeaderboard ? (
                                <div className="flex flex-col items-center justify-center py-12 sm:py-24 gap-2 sm:gap-3">
                                    <div className="w-7 h-7 sm:w-9 sm:h-9 border-2 border-amber-650/30 border-t-amber-500 rounded-full animate-spin" />
                                    <span className="text-stone-600 text-[8px] sm:text-xs font-bold tracking-widest uppercase">Fetching Classified Intel...</span>
                                </div>
                            ) : leaderboard.length === 0 ? (
                                <div className="text-center py-12 sm:py-24 text-stone-600 text-[10px] sm:text-xs font-bold tracking-widest uppercase">
                                    No records filed in database
                                </div>
                            ) : (
                                leaderboard.map((entry, idx) => {
                                    const winPercentage = Math.round((entry.wins / Math.max(1, entry.wins + entry.losses)) * 100);
                                    
                                    // Golden theme for rank 1, Silver for 2, Bronze for 3, Dark for rest
                                    const cardTheme = idx === 0 
                                        ? 'border-amber-500/40 bg-amber-950/15 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.08)] hover:bg-amber-950/25' 
                                        : idx === 1 
                                            ? 'border-stone-400/35 bg-stone-900/30 text-stone-200 hover:bg-stone-900/45' 
                                            : idx === 2 
                                                ? 'border-orange-750/35 bg-orange-950/10 text-orange-300 hover:bg-orange-950/20' 
                                                : 'border-stone-900 bg-stone-950/50 hover:border-stone-800 text-stone-450 hover:bg-stone-900/20';
                                    
                                    const rankBadge = idx === 0 
                                        ? '🥇' 
                                        : idx === 1 
                                            ? '🥈' 
                                            : idx === 2 
                                                ? '🥉' 
                                                : `#${idx + 1}`;

                                    return (
                                        <div key={entry.username} className={`border rounded-lg sm:rounded-xl overflow-hidden transition-all duration-300 transform hover:scale-[1.005] ${cardTheme}`}>
                                            <button
                                                onClick={() => {
                                                    audioManager.playSound('click');
                                                    setSelectedCareerUser(entry);
                                                }}
                                                className="w-full flex items-center px-3 py-2 sm:px-4 sm:py-2.5 text-left transition-colors cursor-pointer"
                                            >
                                                {/* Rank Symbol */}
                                                <span className="w-10 sm:w-14 text-center font-black text-xs sm:text-sm shrink-0">{rankBadge}</span>
                                                
                                                {/* Agent Username */}
                                                <div className="flex-1 min-w-0 pl-2 sm:pl-4">
                                                    <div className="flex items-center gap-1.5 sm:gap-2">
                                                        <span className={`font-black text-[10px] sm:text-xs md:text-sm uppercase tracking-wider truncate ${idx === 0 ? 'text-amber-400' : 'text-stone-200'}`}>{entry.username}</span>
                                                        {entry.isDeveloper && (
                                                            <span className="px-1 py-0.5 bg-purple-650/35 border border-purple-500/40 text-purple-400 text-[5.5px] sm:text-[6.5px] font-black tracking-widest rounded-md uppercase shrink-0">DEV</span>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {/* Win/Loss Stats */}
                                                <div className="flex items-center gap-1.5 sm:gap-3 w-24 sm:w-32 justify-center text-[10px] sm:text-xs font-black shrink-0">
                                                    <span className="text-green-500">{entry.wins}W</span>
                                                    <span className="text-red-500">{entry.losses}L</span>
                                                    {entry.hardModeWins > 0 && (
                                                        <span className="text-amber-400 flex items-center gap-0.5 shrink-0" title="Hard Mode Wins">
                                                            <Skull size={10} className="text-red-500 animate-pulse animate-duration-1000 sm:w-[13px] sm:h-[13px]" />{entry.hardModeWins}
                                                        </span>
                                                    )}
                                                </div>
                                                
                                                {/* Win Rate */}
                                                <div className="w-16 sm:w-24 text-center font-black text-[10px] sm:text-xs md:text-sm text-stone-300 shrink-0">
                                                    {winPercentage}%
                                                </div>
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <button
                            onClick={() => {
                                audioManager.playSound('click');
                                setShowLeaderboard(false);
                            }}
                            className="mt-3 sm:mt-4 w-full py-2 sm:py-3 bg-stone-900 border border-stone-850 hover:border-stone-600 hover:text-white text-stone-400 font-bold text-[10px] sm:text-xs tracking-[0.4em] uppercase transition-all rounded-lg sm:rounded-xl cursor-pointer active:scale-98 shadow-md shrink-0"
                        >
                            Close Terminal
                        </button>
                             {/* TACTICAL PROFILE POPUP MODAL (CAREER LOG) */}
            {selectedCareerUser && (() => {
                const statsToDisplay = {
                    ...selectedCareerUser.stats,
                    wins: selectedCareerUser.wins || 0,
                    losses: selectedCareerUser.losses || 0,
                    highestRound: selectedCareerUser.stats?.highestRound || 0,
                    itemPoints: selectedCareerUser.stats?.itemPoints || 0,
                    shotsFired: selectedCareerUser.stats?.shotsFired || 0,
                    shotsHit: selectedCareerUser.stats?.shotsHit || 0,
                    damageDealt: selectedCareerUser.stats?.damageDealt || 0,
                    damageTaken: selectedCareerUser.stats?.damageTaken || 0,
                    itemsUsed: typeof selectedCareerUser.stats?.itemsUsed === 'number' ? selectedCareerUser.stats.itemsUsed : 0,
                    matchHistory: selectedCareerUser.stats?.matchHistory || []
                };
                return (
                    <Scoreboard
                        stats={statsToDisplay}
                        onClose={() => setSelectedCareerUser(null)}
                    />
                );
            })()}       </div>
                </div>
            )}

            {/* Menu Center Frame Area */}
            <div
                className="relative z-10 text-center max-w-xl w-full p-3 sm:p-5 flex flex-col justify-center origin-center transition-all duration-300 my-auto animate-in fade-in-50"
                style={{ transform: `scale(${scale})` }}
            >
                <div className="mb-2 sm:mb-3 relative">
                    <h1 className="text-2xl sm:text-4xl md:text-5xl font-black mb-0 text-white tracking-tighter leading-[0.85] drop-shadow-[0_0_30px_rgba(255,255,255,0.15)]">
                        AADISH<br />
                        <span className="text-red-700/95 tracking-[-0.05em] relative">
                            ROULETTE
                            <span className="absolute -inset-1 blur-2xl bg-red-950/20 -z-10" />
                        </span>
                    </h1>
                    <div className="mt-1 sm:mt-2 flex items-center justify-center gap-3">
                        <div className="h-[1px] w-8 sm:w-12 bg-stone-850" />
                        <p className="text-stone-500 font-black tracking-[0.5em] text-[8.5px] sm:text-[9.5px] uppercase">Version {GAME_VERSION}</p>
                        <div className="h-[1px] w-8 sm:w-12 bg-stone-850" />
                    </div>
                </div>

                {/* Mobile-only User Profile Badge (Flowed inline to prevent viewport overlap) */}
                <div className="sm:hidden mb-3.5 flex justify-center shrink-0">
                    {loggedInUser ? (
                        <div className="flex items-center gap-3 bg-stone-950 border border-green-950/40 p-2 px-3.5 rounded-xl shadow-md">
                            <div className="flex flex-col text-left">
                                <span className="text-[6.5px] text-stone-550 font-bold uppercase tracking-widest leading-none mb-0.5">Agent Signed In</span>
                                <span className="text-[10px] text-green-400 font-mono font-black uppercase tracking-wider leading-none">{loggedInUser.username}</span>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="ml-2 px-2.5 py-1.5 bg-red-955/40 hover:bg-red-900 text-red-500 hover:text-white font-mono font-bold text-[8px] tracking-widest rounded-lg border border-red-900/30 uppercase transition-all cursor-pointer small-btn"
                            >
                                Disconnect
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => {
                                audioManager.playSound('click');
                                setShowLoginModal(true);
                            }}
                            className="group/signin px-4 py-2 bg-gradient-to-r from-red-955/60 to-stone-950/80 border border-red-700/50 text-red-400 hover:text-white font-mono font-black text-[9px] tracking-[0.2em] rounded-xl backdrop-blur-md transition-all shadow-[0_0_25px_rgba(220,38,38,0.15)] hover:shadow-[0_0_40px_rgba(220,38,38,0.3)] hover:scale-105 active:scale-95 uppercase flex items-center gap-2 cursor-pointer small-btn"
                        >
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-650"></span>
                            </span>
                            Sign In / Register
                        </button>
                    )}
                </div>

                <div className="flex flex-col gap-1.5 sm:gap-2 max-w-sm mx-auto w-full">
                    {/* Identity Section */}
                    <div className="text-center mb-0.5">
                        <p className="text-[8px] sm:text-[9px] text-red-700/60 font-black tracking-[0.45em] uppercase mb-1 animate-pulse flex items-center justify-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-red-650 rounded-full animate-ping shrink-0" />
                            <span>BINDING_SOUL_PROTOCOL</span>
                        </p>
                        <div className="relative group max-w-[260px] mx-auto w-full">
                            <input
                                ref={nameInputRef}
                                type="text"
                                value={inputName}
                                onChange={(e) => setInputName(e.target.value)}
                                placeholder="IDENTITY"
                                maxLength={12}
                                className="w-full bg-stone-950/65 border-2 border-stone-850 py-2 px-3 sm:py-2.5 text-xs sm:text-sm font-black text-white outline-none focus:border-red-650/45 focus:bg-stone-900/10 transition-all duration-500 tracking-[0.25em] uppercase text-center placeholder-stone-855/60 backdrop-blur-xl rounded-xl"
                            />
                            <div className="absolute inset-x-0 -bottom-1 h-[2px] bg-gradient-to-r from-transparent via-red-600/50 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-700" />
                        </div>
                    </div>

                    <div className="grid grid-cols-12 gap-1.5">
                        {/* Start Game Button */}
                        <button 
                            onClick={() => {
                                audioManager.playSound('click');
                                onStartGame(false);
                            }} 
                            disabled={!inputName.trim()} 
                            className="col-span-6 px-2.5 py-2 sm:py-2.5 bg-white text-black font-black text-[9px] sm:text-xs hover:bg-stone-200 active:scale-[0.98] transition-all duration-305 disabled:opacity-20 disabled:grayscale tracking-[0.2em] rounded-xl shadow-[0_10px_35px_rgba(255,255,255,0.06)] hover:shadow-[0_0_30px_rgba(255,255,255,0.25)] hover:scale-[1.015] active:scale-[0.985] relative overflow-hidden group/btn uppercase leading-none cursor-pointer border-2 border-white"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
                            <span>START GAME</span>
                        </button>

                        {/* Multiplayer Button — Requires Login */}
                        <button 
                            onClick={() => {
                                audioManager.playSound('click');
                                if (!loggedInUser) {
                                    setLoginError('');
                                    setLoginSuccess('');
                                    setShowLoginModal(true);
                                    return;
                                }
                                onStartMultiplayer(inputName.trim());
                            }} 
                            disabled={!inputName.trim()} 
                            className="col-span-6 px-2.5 py-2 sm:py-2.5 bg-stone-950/60 border-2 border-cyan-850/60 text-cyan-400 font-black text-[9px] sm:text-xs hover:text-white hover:border-cyan-500 hover:bg-cyan-950/20 hover:shadow-[0_0_30px_rgba(6,182,212,0.35)] hover:scale-[1.015] active:scale-[0.985] transition-all duration-300 disabled:opacity-20 flex items-center justify-center gap-1.5 group rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.3)] uppercase tracking-[0.2em] leading-none cursor-pointer relative"
                        >
                            <Swords size={12} className="text-cyan-500 group-hover:rotate-12 transition-transform duration-300 shrink-0" />
                            <span>MULTIPLAYER</span>
                            {!loggedInUser && <Lock size={8} className="absolute top-1.5 right-1.5 text-red-650/70" />}
                        </button>

                        {/* Hard Mode Button */}
                        <button 
                            onClick={() => {
                                audioManager.playSound('click');
                                setShowHardModeWarning(true);
                            }} 
                            disabled={!inputName.trim()} 
                            className="col-span-12 py-2 sm:py-2.5 bg-stone-950/70 border-2 border-red-950 hover:border-red-650 text-red-500 font-black text-[9px] sm:text-xs hover:text-white hover:bg-red-950/30 hover:shadow-[0_0_35px_rgba(220,38,38,0.4)] hover:scale-[1.015] active:scale-[0.985] transition-all duration-300 disabled:opacity-20 flex items-center justify-center gap-2 group rounded-xl shadow-[0_10px_30px_rgba(220,38,38,0.05)] uppercase tracking-[0.25em] leading-none cursor-pointer animate-[border-glow-red_3s_ease-in-out_infinite]"
                        >
                            <Skull size={12} className="text-red-700 group-hover:text-red-400 group-hover:scale-110 transition-all duration-300 animate-pulse shrink-0" />
                            <span>HARD MODE PROTOCOL</span>
                            <Skull size={12} className="text-red-700 group-hover:text-red-400 group-hover:scale-110 transition-all duration-300 animate-pulse shrink-0" />
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 mt-0.5">
                        {/* Guide Button */}
                        <button 
                            onClick={() => {
                                audioManager.playSound('click');
                                onOpenGuide();
                            }} 
                            className="px-2 py-1.5 sm:py-2 bg-stone-900/20 border border-stone-850 text-stone-500 font-black text-[8.5px] sm:text-[9px] flex flex-col items-center justify-center gap-1 tracking-[0.3em] hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-950/15 active:scale-95 hover:scale-105 transition-all duration-300 uppercase rounded-xl cursor-pointer"
                        >
                            <HelpCircle size={14} className="text-stone-600 group-hover:text-cyan-455 transition-colors" />
                            Guide
                        </button>
                        {/* Stats Button */}
                        <button 
                            onClick={() => {
                                audioManager.playSound('click');
                                if (!loggedInUser) {
                                    setShowLoginModal(true);
                                    return;
                                }
                                onOpenScoreboard();
                            }} 
                            className="px-2 py-1.5 sm:py-2 bg-stone-900/20 border border-stone-850 text-stone-500 font-black text-[8.5px] sm:text-[9px] flex flex-col items-center justify-center gap-1 tracking-[0.3em] hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-950/15 active:scale-95 hover:scale-105 transition-all duration-300 uppercase rounded-xl cursor-pointer relative"
                        >
                            <Trophy size={14} className="text-stone-600" />
                            Stats
                            {!loggedInUser && <Lock size={8} className="absolute top-1.5 right-1.5 text-red-650/70" />}
                        </button>
                        {/* Config Button */}
                        <button 
                            onClick={() => {
                                audioManager.playSound('click');
                                onOpenSettings();
                            }} 
                            className="px-2 py-1.5 sm:py-2 bg-stone-900/20 border border-stone-855 text-stone-500 font-black text-[8.5px] sm:text-[9px] flex flex-col items-center justify-center gap-1 tracking-[0.3em] hover:text-stone-100 hover:border-stone-550 hover:bg-stone-800/40 active:scale-95 hover:scale-105 transition-all duration-300 uppercase rounded-xl cursor-pointer"
                        >
                            <SettingsIcon size={14} className="text-stone-600" />
                            Config
                        </button>
                    </div>

                    <div className="mt-1">
                        {/* Leaderboard Trigger Button */}
                        <button
                            onClick={() => {
                                audioManager.playSound('click');
                                loadLeaderboardData();
                                setShowLeaderboard(true);
                            }}
                            className="w-full py-2 sm:py-2.5 bg-gradient-to-r from-amber-955/20 via-stone-900/20 to-amber-955/20 border border-amber-900/40 text-amber-600/90 font-black text-[9px] sm:text-xs flex items-center justify-center gap-1.5 tracking-[0.15em] sm:tracking-[0.3em] hover:text-amber-455 hover:border-amber-500 hover:bg-amber-955/25 hover:shadow-[0_0_25px_rgba(245,158,11,0.2)] hover:scale-[1.015] active:scale-[0.985] transition-all duration-300 uppercase rounded-xl cursor-pointer group/lb"
                        >
                            <Crown size={12} className="text-amber-750 group-hover/lb:text-amber-400 transition-colors group-hover/lb:rotate-[-10deg] transition-transform duration-300 shrink-0" />
                            <span>Leaderboard</span>
                        </button>
                    </div>
                </div>

                {/* Multiplayer Match Summary Popup */}
                {selectedMPMatch && (
                    <>
                        <div className="fixed inset-0 bg-black/80 z-[120] cursor-default" onClick={() => setSelectedMPMatch(null)} />
                        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-stone-950 border border-cyan-900/40 p-6 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)] z-[130] font-mono text-stone-300">
                            {/* Header */}
                            <div className="flex justify-between items-center border-b border-stone-900 pb-3 mb-4">
                                <div className="flex items-center gap-2">
                                    <Swords className="text-cyan-400" size={14} />
                                    <span className="font-black text-xs tracking-wider uppercase text-white">MULTIPLAYER SUMMARY</span>
                                </div>
                                <button onClick={() => setSelectedMPMatch(null)} className="text-stone-500 hover:text-white transition-colors cursor-pointer">
                                    <X size={14} />
                                </button>
                            </div>

                            {/* Details */}
                            <div className="space-y-4 text-left font-mono">
                                <div className="flex justify-between text-[8px] text-stone-500 border-b border-stone-900/50 pb-2">
                                    <span>DATE: {selectedMPMatch.timestamp ? new Date(selectedMPMatch.timestamp).toLocaleString() : 'UNKNOWN'}</span>
                                    <span className="text-cyan-400 font-bold">SCORE: {selectedMPMatch.totalScore?.toLocaleString() || 0}</span>
                                </div>

                                {/* Deployed list */}
                                <div className="space-y-1.5">
                                    <span className="text-[8px] text-stone-500 uppercase tracking-widest font-black block">DEPLOYED AGENTS</span>
                                    <div className="space-y-1">
                                        {selectedMPMatch.mpPlayers && selectedMPMatch.mpPlayers.map((player: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center p-2 bg-stone-900/20 border border-stone-900/40 rounded-lg text-[10px]">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-bold text-stone-200">{player.name}</span>
                                                    {player.isHost && (
                                                        <span className="text-[6px] bg-red-955/20 text-red-400 px-1 py-0.5 rounded border border-red-900/30 font-bold">HOST</span>
                                                    )}
                                                    {player.isMe && (
                                                        <span className="text-[6px] bg-cyan-950/20 text-cyan-400 px-1 py-0.5 rounded border border-cyan-900/30 font-bold">YOU</span>
                                                    )}
                                                </div>
                                                <span className={`font-black tracking-widest uppercase text-[9px] ${
                                                    player.result === 'WIN' ? 'text-green-400' :
                                                    player.result === 'LOSS' ? 'text-red-455' : 'text-stone-500'
                                                }`}>
                                                    {player.result}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Player stats */}
                                <div className="space-y-1.5 pt-2 border-t border-stone-900/60">
                                    <span className="text-[8px] text-stone-500 uppercase tracking-widest font-black block">PERFORMANCE REPORT</span>
                                    <div className="grid grid-cols-2 gap-2 text-[9px]">
                                        <div className="p-2 bg-stone-950 border border-stone-900/50 rounded flex justify-between">
                                            <span className="text-stone-500">RDS SURVIVED</span>
                                            <span className="text-stone-200 font-bold">{selectedMPMatch.roundsSurvived}</span>
                                        </div>
                                        <div className="p-2 bg-stone-950 border border-stone-900/50 rounded flex justify-between">
                                            <span className="text-stone-500">PRECISION</span>
                                            <span className="text-stone-200 font-bold">
                                                {selectedMPMatch.shotsFired > 0 ? Math.round((selectedMPMatch.shotsHit / selectedMPMatch.shotsFired) * 100) : 0}%
                                            </span>
                                        </div>
                                        <div className="p-2 bg-stone-950 border border-stone-900/50 rounded flex justify-between">
                                            <span className="text-stone-500">DMG DEALT</span>
                                            <span className="text-stone-200 font-bold">{selectedMPMatch.damageDealt}</span>
                                        </div>
                                        <div className="p-2 bg-stone-950 border border-stone-900/50 rounded flex justify-between">
                                            <span className="text-stone-500">DMG TAKEN</span>
                                            <span className="text-stone-200 font-bold">{selectedMPMatch.damageTaken}</span>
                                        </div>
                                        <div className="p-2 bg-stone-950 border border-stone-900/50 rounded flex justify-between col-span-2">
                                            <span className="text-stone-500">SELF SHOTS</span>
                                            <span className={`${selectedMPMatch.selfShots > 0 ? 'text-red-400' : 'text-stone-400'} font-bold`}>{selectedMPMatch.selfShots}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button onClick={() => setSelectedMPMatch(null)} className="w-full mt-4 py-2 bg-cyan-950/20 border border-cyan-850 hover:bg-cyan-900/20 text-cyan-400 font-black text-[9px] tracking-wider uppercase rounded-xl transition-all cursor-pointer">
                                DISMISS LOG
                            </button>
                        </div>
                    </>
                )}
                <div className="mt-2.5 sm:mt-4 flex flex-col items-center gap-2">
                    {!isStandalone && (isInstallable || isMobile || isIOS) && (
                        <button
                            onClick={handleInstallClick}
                            className="px-4 py-1.5 rounded-full border border-blue-900/30 bg-blue-950/20 text-blue-500 text-[9px] font-black tracking-[0.5em] hover:bg-blue-900/30 hover:text-blue-400 transition-all animate-pulse uppercase cursor-pointer"
                        >
                            Download the App
                        </button>
                    )}
                    {isStandalone ? (
                        <div className="text-stone-700 text-[8px] font-black tracking-[0.8em] uppercase opacity-40">System Link: Established</div>
                    ) : (
                        <div className="text-stone-855 text-[8px] font-black tracking-[0.8em] uppercase">Web Instance • {GAME_VERSION}</div>
                    )}
                </div>
            </div>
        </div>
    );
};