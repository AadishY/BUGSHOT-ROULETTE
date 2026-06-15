import React, { useEffect, useRef } from 'react';
import { Settings as SettingsIcon, HelpCircle, Trophy, ShieldAlert, Lock, User, Terminal, BookOpen, Crown, Shield, Skull, X, Crosshair, Swords, Activity, Award } from 'lucide-react';
import { audioManager } from '../../utils/audioManager';
import { loginUser, registerUser, getLeaderboard } from '../../utils/redisService';
import { GAME_VERSION } from '../../constants';

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
            if (window.innerWidth < 500) {
                newScale = Math.max(0.7, Math.min(0.95, window.innerWidth / 450));
            } else {
                newScale = Math.max(newScale, 0.6);
            }
            if (newScale > 1.1) newScale = 1.1;
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
                    <h1 className="text-5xl sm:text-7xl md:text-9xl font-black text-stone-100 mb-8 tracking-tighter leading-none drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
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
        <div className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden pointer-events-auto bg-black/40 backdrop-blur-[2px] p-4 select-none">
            
            {/* Top Right User Profile Badge Section */}
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-[60] flex items-center gap-3">
                {loggedInUser ? (
                    <div className="flex items-center gap-3 bg-stone-950/80 border border-green-950/40 p-2 px-3 sm:px-4 rounded-xl backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                        <div className="flex flex-col text-left">
                            <span className="text-[7px] text-stone-500 font-bold uppercase tracking-widest leading-none mb-0.5">Agent Signed In</span>
                            <span className="text-[10px] sm:text-[11px] text-green-400 font-mono font-black uppercase tracking-wider leading-none">{loggedInUser.username}</span>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="ml-2 px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900 text-red-500 hover:text-white font-mono font-bold text-[8px] tracking-widest rounded-lg border border-red-900/30 uppercase transition-all cursor-pointer"
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
                        className="group/signin px-4 py-2 sm:px-5 sm:py-2.5 bg-gradient-to-r from-red-950/60 to-stone-950/80 border border-red-700/50 text-red-400 hover:text-white hover:border-red-500 font-mono font-black text-[9px] sm:text-[10px] tracking-[0.2em] rounded-xl backdrop-blur-md transition-all shadow-[0_0_25px_rgba(220,38,38,0.15)] hover:shadow-[0_0_40px_rgba(220,38,38,0.3)] hover:scale-105 active:scale-95 uppercase flex items-center gap-2 cursor-pointer"
                    >
                        <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-red-600"></span>
                        </span>
                        Sign In / Register
                    </button>
                )}
            </div>

            {/* Bottom Right Floating Changelog Button */}
            <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-[60]">
                <button
                    onClick={() => {
                        audioManager.playSound('click');
                        setShowChangelog(true);
                    }}
                    className="group/cl p-3.5 sm:p-4 bg-gradient-to-br from-stone-900/90 to-stone-950/90 border border-stone-700/50 text-stone-400 hover:text-amber-450 hover:border-amber-600/50 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-md transition-all hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]"
                    title="System Changelog"
                >
                    <BookOpen size={20} className="group-hover/cl:rotate-[-8deg] transition-transform duration-300" />
                </button>
            </div>

            {/* Hard Mode Warning Modal */}
            {showHardModeWarning && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/95 animate-in fade-in zoom-in duration-500 p-4">
                    <div className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-screen bg-[url('https://media.giphy.com/media/oEI9uWU0WMrQmInJWC/giphy.gif')] bg-repeat" />
                    <div
                        className="relative bg-stone-950/80 backdrop-blur-xl border border-red-900/50 p-6 md:p-12 max-w-xl text-center shadow-[0_0_100px_rgba(220,38,38,0.2)] overflow-hidden group origin-center transition-transform duration-200"
                        style={{ transform: `scale(${scale})` }}
                    >
                        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[repeating-linear-gradient(45deg,transparent,transparent_15px,rgba(220,38,38,0.05)_15px,rgba(220,38,38,0.05)_30px)]" />
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="text-red-700 mb-6 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]"><ShieldAlert size={80} /></div>
                            <h2 className="text-5xl md:text-7xl font-black text-red-600 mb-2 tracking-tighter uppercase drop-shadow-[0_0_20px_rgba(220,38,38,0.3)]">WARNING</h2>
                            <p className="text-stone-400 text-lg md:text-xl font-bold mb-8 tracking-[0.4em] uppercase">High Stakes Protocol</p>

                            <div className="bg-black/60 p-6 border border-red-900/30 mb-10 w-full backdrop-blur-md relative overflow-hidden group-hover:border-red-600/30 transition-colors">
                                <div className="absolute top-0 left-0 w-full h-[1px] bg-red-600/50 animate-[scan-line-move_3s_linear_infinite]" />
                                <div className="space-y-4">
                                    <p className="text-red-500/80 font-mono text-sm md:text-base font-bold tracking-[0.2em] flex items-center justify-center gap-4">
                                        <span className="w-1.5 h-1.5 bg-red-800 rounded-full" /> DEALER IS RUTHLESS
                                    </p>
                                    <p className="text-red-500/80 font-mono text-sm md:text-base font-bold tracking-[0.2em] flex items-center justify-center gap-4">
                                        <span className="w-1.5 h-1.5 bg-red-800 rounded-full" /> DOUBLE OR NOTHING
                                    </p>
                                    <p className="text-red-500/80 font-mono text-sm md:text-base font-bold tracking-[0.2em] flex items-center justify-center gap-4">
                                        <span className="w-1.5 h-1.5 bg-red-800 rounded-full" /> NO SECOND CHANCES
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-5 w-full">
                                <button
                                    onClick={() => {
                                        audioManager.playSound('insert');
                                        onStartGame(true);
                                    }}
                                    className="w-full py-5 bg-red-900/20 hover:bg-red-750 text-white font-black text-2xl tracking-[0.3em] border-2 border-red-700/50 hover:border-red-500 transition-all hover:scale-[1.02] hover:shadow-[0_0_50px_rgba(220,38,38,0.4)] active:scale-95 group relative overflow-hidden cursor-pointer"
                                >
                                    <span className="relative z-10">ACCEPT FATE</span>
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                                </button>
                                <button
                                    onClick={() => setShowHardModeWarning(false)}
                                    className="w-full py-3 bg-transparent text-stone-600 font-bold hover:text-stone-400 transition-colors tracking-[0.4em] text-xs uppercase cursor-pointer"
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
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-4 animate-in fade-in duration-300 overflow-y-auto">
                    {/* Glowing background circles for ambient depth */}
                    <div className="absolute w-[450px] h-[450px] bg-red-950/15 rounded-full blur-[120px] pointer-events-none -translate-x-1/4 -translate-y-1/4" />
                    <div className="absolute w-[400px] h-[400px] bg-red-900/10 rounded-full blur-[100px] pointer-events-none translate-x-1/4 translate-y-1/4" />
                    
                    <div
                        className="relative w-full max-w-xl bg-stone-950 border-2 border-red-500/20 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.95),0_0_40px_rgba(239,68,68,0.15)] font-mono text-stone-300 p-8 sm:p-12 flex flex-col justify-center overflow-hidden hover:border-red-500/40 transition-all duration-700"
                    >
                        {/* CRT Scanline Overlay Effect */}
                        {!isMobile && (
                            <div className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%]" />
                        )}
                        
                        {/* Tech ticks */}
                        <div className="absolute top-4 left-4 w-3 h-3 border-t-2 border-l-2 border-red-650/40 pointer-events-none" />
                        <div className="absolute top-4 right-4 w-3 h-3 border-t-2 border-r-2 border-red-650/40 pointer-events-none" />
                        <div className="absolute bottom-4 left-4 w-3 h-3 border-b-2 border-l-2 border-red-650/40 pointer-events-none" />
                        <div className="absolute bottom-4 right-4 w-3 h-3 border-b-2 border-r-2 border-red-650/40 pointer-events-none" />

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
                            className="absolute top-5 right-5 text-stone-300 hover:text-red-400 bg-stone-900/60 hover:bg-red-950/30 border border-stone-800 hover:border-red-500/45 p-2 rounded-xl z-50 cursor-pointer flex items-center justify-center shadow-lg hover:shadow-[0_0_15px_rgba(239,68,68,0.25)] transition-all"
                            title="Close Portal"
                        >
                            <X size={18} />
                        </button>

                        {/* Quote & Header details */}
                        <div className="text-center mb-6 mt-2 border-b border-stone-900 pb-5">
                            <div className="text-[10px] text-stone-500 tracking-[0.45em] uppercase mb-2.5 flex items-center justify-center gap-1.5">
                                <Terminal size={12} className="text-red-600 animate-pulse" />
                                <span>CON_SECURITY_PORTAL</span>
                            </div>
                            <h3 className="text-2xl sm:text-3xl font-black text-stone-100 tracking-wider uppercase mb-3.5">AGENT AUTHENTICATION</h3>
                            <p className="text-red-500/80 italic text-xs sm:text-sm tracking-wider max-w-sm mx-auto animate-pulse font-medium">
                                "The odds are equal, the consequences are not."
                            </p>
                        </div>

                        {/* Tabs Switcher */}
                        <div className="grid grid-cols-2 gap-3 mb-8 bg-stone-950 border border-stone-900 p-1.5 rounded-xl">
                            <button
                                type="button"
                                onClick={() => {
                                    audioManager.playSound('click');
                                    setLoginTab('signin');
                                    setLoginError('');
                                    setLoginSuccess('');
                                }}
                                className={`py-3 text-[11px] font-black tracking-widest uppercase transition-all duration-300 cursor-pointer rounded-lg border ${loginTab === 'signin' ? 'text-green-400 bg-green-950/15 border-green-800/45 shadow-[0_0_15px_rgba(34,197,94,0.08)]' : 'text-stone-550 border-transparent hover:text-stone-300 hover:bg-stone-900/40'}`}
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
                                className={`py-3 text-[11px] font-black tracking-widest uppercase transition-all duration-300 cursor-pointer rounded-lg border ${loginTab === 'register' ? 'text-red-400 bg-red-950/15 border-red-800/45 shadow-[0_0_15px_rgba(220,38,38,0.08)]' : 'text-stone-550 border-transparent hover:text-stone-300 hover:bg-stone-900/40'}`}
                            >
                                [ REGISTER ]
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleLoginSubmit} className="space-y-6">
                            {/* Username Input */}
                            <div>
                                <div className="flex justify-between items-center mb-2 px-1">
                                    <span className="text-[10px] text-stone-550 font-bold tracking-widest uppercase flex items-center gap-1.5">
                                        <User size={12} className="text-red-650" />
                                        CODENAME_INPUT
                                    </span>
                                    <span className="text-[8px] text-stone-600 font-mono tracking-widest uppercase">REQ: 1-12 CHARS</span>
                                </div>
                                <div className="relative flex items-center group/input">
                                    <span className="absolute left-4 text-stone-600 group-focus-within/input:text-red-500 transition-colors font-bold text-sm pointer-events-none">[</span>
                                    <input
                                        type="text"
                                        value={loginUsername}
                                        onChange={(e) => setLoginUsername(e.target.value)}
                                        placeholder="ENTER AGENT IDENTITY"
                                        maxLength={12}
                                        className="w-full bg-stone-950 border-2 border-stone-850 hover:border-stone-750 focus:border-red-500/50 px-8 py-4 text-sm font-mono font-bold text-stone-200 outline-none transition-all tracking-[0.15em] uppercase rounded-xl placeholder-stone-850 focus:shadow-[0_0_20px_rgba(220,38,38,0.06)]"
                                        required
                                    />
                                    <span className="absolute right-4 text-stone-650 group-focus-within/input:text-red-500 transition-colors font-bold text-sm pointer-events-none">]</span>
                                </div>
                            </div>

                            {/* Password Input */}
                            <div>
                                <div className="flex justify-between items-center mb-2 px-1">
                                    <span className="text-[10px] text-stone-550 font-bold tracking-widest uppercase flex items-center gap-1.5">
                                        <Lock size={12} className="text-red-650" />
                                        ENCRYPTED_KEY_PASS
                                    </span>
                                    <span className="text-[8px] text-stone-600 font-mono tracking-widest uppercase">SECURE VAULT</span>
                                </div>
                                <div className="relative flex items-center group/input">
                                    <span className="absolute left-4 text-stone-655 group-focus-within/input:text-red-500 transition-colors font-bold text-sm pointer-events-none">[</span>
                                    <input
                                        type="password"
                                        value={loginPassword}
                                        onChange={(e) => setLoginPassword(e.target.value)}
                                        placeholder="••••••••••••••"
                                        className="w-full bg-stone-950 border-2 border-stone-855 hover:border-stone-750 focus:border-red-500/50 px-8 py-4 text-sm font-mono font-bold text-stone-200 outline-none transition-all tracking-[0.15em] uppercase rounded-xl placeholder-stone-855 focus:shadow-[0_0_20px_rgba(220,38,38,0.06)]"
                                        required
                                    />
                                    <span className="absolute right-4 text-stone-655 group-focus-within/input:text-red-500 transition-colors font-bold text-sm pointer-events-none">]</span>
                                </div>
                            </div>

                            {/* Error Readout */}
                            {loginError && (
                                <div className="text-[10px] text-red-550 font-bold tracking-wider uppercase border border-red-900/40 bg-red-950/20 p-3.5 rounded-lg animate-[shake_0.5s_ease-in-out] flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                    <span>[CRITICAL FAULT: {loginError}]</span>
                                </div>
                            )}

                            {/* Success Readout */}
                            {loginSuccess && (
                                <div className="text-[10px] text-green-500 font-bold tracking-wider uppercase border border-green-900/40 bg-green-950/20 p-3.5 rounded-lg animate-pulse flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                                    <span>[SYNC COMPLETE: {loginSuccess}]</span>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="pt-2 space-y-4.5">
                                <button
                                    type="submit"
                                    disabled={isLoadingRedis}
                                    className="w-full py-5 bg-gradient-to-r from-red-950/80 to-red-900/60 hover:from-red-900 hover:to-red-750 text-red-400 hover:text-white font-black text-xs tracking-[0.3em] border-2 border-red-900/60 hover:border-red-500 transition-all rounded-xl cursor-pointer shadow-lg active:scale-[0.98] disabled:opacity-50 uppercase flex items-center justify-center gap-2 hover:shadow-[0_0_35px_rgba(220,38,38,0.4)]"
                                >
                                    {isLoadingRedis && <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />}
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
                                    className="w-full py-2 bg-transparent text-stone-600 hover:text-stone-400 font-bold text-[9px] tracking-[0.3em] uppercase transition-colors cursor-pointer text-center"
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
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="relative w-full max-w-3xl bg-stone-950/95 border-2 border-stone-800/80 p-8 sm:p-10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] font-mono">
                        {/* Top-right close button */}
                        <button
                            onClick={() => {
                                audioManager.playSound('click');
                                setShowChangelog(false);
                            }}
                            className="absolute top-5 right-5 text-stone-300 hover:text-red-400 bg-stone-900/60 hover:bg-red-950/30 border border-stone-800 hover:border-red-500/45 p-2 rounded-xl z-50 cursor-pointer flex items-center justify-center shadow-lg hover:shadow-[0_0_15px_rgba(239,68,68,0.25)] transition-all"
                            title="Close Console"
                        >
                            <X size={18} />
                        </button>

                        <div className="absolute top-0 left-0 w-full h-[2px] bg-red-650/40 animate-[scan-line-move_4s_linear_infinite]" />
                        <div className="text-stone-350 font-black border-b border-stone-900 pb-4 mb-5 flex items-center justify-between uppercase tracking-wider text-sm sm:text-base">
                            <span className="flex items-center gap-2">
                                <Terminal size={18} className="text-red-500" />
                                System Changelog
                            </span>
                            <span className="text-red-500/80 animate-pulse flex items-center gap-1.5 text-xs bg-red-950/20 border border-red-900/35 px-3 py-1 rounded-lg mr-10">
                                <span className="w-1.5 h-1.5 bg-red-600 rounded-full" />
                                active
                            </span>
                        </div>
                        
                        <div className="space-y-4.5 text-left max-h-96 overflow-y-auto pr-1.5 select-text scrollbar-thin text-xs sm:text-sm text-stone-400 custom-scrollbar">
                            <div className="space-y-3 bg-stone-950 border border-stone-900/60 p-5 rounded-xl">
                                <span className="text-stone-200 font-black block border-b border-stone-900 pb-1.5 text-xs sm:text-sm tracking-wider">[June 15, 2026 - System Calibration & Redesign (v1.1.0)]</span>
                                <ul className="list-none space-y-3 pl-0.5">
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">ADDED</span>
                                        <span className="leading-relaxed">Redesigned credentials portal: scaled single-pane interface, clean cyber typography, and philosophical fate quote banner.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">ADDED</span>
                                        <span className="leading-relaxed">Dynamically calibrated default configs on startup/reset (PC resolution 3.0, mobile HUD size 0.60, specific music levels).</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">ADDED</span>
                                        <span className="leading-relaxed">Responsive vertical viewport scroll wrappers preventing item cutoff on mobile portrait and landscape viewports.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-amber-950/50 border border-amber-800/40 text-amber-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">OPTIMIZED</span>
                                        <span className="leading-relaxed">Expanded Global Leaderboard into detailed grid layouts featuring agent ranks, operational statistics, and podium finishers.</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-amber-950/50 border border-amber-800/40 text-amber-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">OPTIMIZED</span>
                                        <span className="leading-relaxed">Re-engineered menu buttons: sleek neon glowing borders, smooth hover animations, and modern clean aesthetics.</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="space-y-3 bg-stone-950 border border-stone-900/60 p-5 rounded-xl opacity-75 hover:opacity-100 transition-opacity">
                                <span className="text-stone-400 font-black block border-b border-stone-900 pb-1.5 text-[11px] sm:text-xs tracking-wider">[Previous Deployments]</span>
                                <ul className="list-none space-y-3 pl-0.5">
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-green-950/50 border border-green-800/40 text-green-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">ADDED</span>
                                        <span className="leading-relaxed">Implemented device-aware graphics profiles (Mobile, Tablet, PC)</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-red-950/50 border border-red-800/40 text-red-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">FIXED</span>
                                        <span className="leading-relaxed">Disabled shadows and heavy lighting routines on Mobile and Tablet to secure smooth 60FPS</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="px-1.5 py-0.5 bg-blue-950/50 border border-blue-800/40 text-blue-400 text-[8px] font-black rounded-md uppercase tracking-widest shrink-0 select-none">SYSTEM</span>
                                        <span className="leading-relaxed">Implemented duplicate item drop reroll penalty (80% chance to reroll)</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                audioManager.playSound('click');
                                setShowChangelog(false);
                            }}
                            className="mt-6 w-full py-4 bg-stone-900 border border-stone-850 hover:border-stone-600 hover:text-white text-stone-400 font-bold text-xs tracking-[0.4em] uppercase transition-all rounded-xl cursor-pointer active:scale-98 shadow-md"
                        >
                            Close Console
                        </button>
                    </div>
                </div>
            )}

            {/* Redesigned, Scaled-Up Global Leaderboard Modal */}
            {showLeaderboard && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="relative w-full max-w-4xl bg-stone-950/95 border-2 border-stone-850 p-6 sm:p-8 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] font-mono">
                        {/* Top-right close button */}
                        <button
                            onClick={() => {
                                audioManager.playSound('click');
                                setShowLeaderboard(false);
                            }}
                            className="absolute top-5 right-5 text-stone-350 hover:text-amber-450 bg-stone-900/60 hover:bg-amber-950/30 border border-stone-800 hover:border-amber-500/45 p-2 rounded-xl z-50 cursor-pointer flex items-center justify-center shadow-lg hover:shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all"
                            title="Close Leaderboard"
                        >
                            <X size={18} />
                        </button>

                        <div className="absolute top-0 left-0 w-full h-[2px] bg-amber-650/40 animate-[scan-line-move_4s_linear_infinite]" />
                        
                        {/* Header Box */}
                        <div className="text-stone-300 font-black border-b border-stone-900 pb-4 mb-5 flex items-center justify-between uppercase tracking-wider text-sm sm:text-base">
                            <span className="flex items-center gap-2">
                                <Crown size={20} className="text-amber-500 animate-pulse animate-duration-1000" />
                                <span className="text-base sm:text-lg tracking-widest">Global Leaderboard Matrix</span>
                            </span>
                            <span className="text-amber-500/80 flex items-center gap-1.5 text-xs bg-amber-950/20 border border-amber-900/35 px-3 py-1.5 rounded-lg mr-10">
                                <span className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-ping" />
                                {leaderboard.length} verified agents
                            </span>
                        </div>

                        {/* Column Table Header */}
                        {leaderboard.length > 0 && !isLoadingLeaderboard && (
                            <div className="flex items-center px-5 py-3 text-[10px] sm:text-xs font-black text-stone-500 uppercase tracking-widest border-b border-stone-900/60 mb-2.5">
                                <span className="w-14 text-center shrink-0">Rank</span>
                                <span className="flex-1 pl-4 text-left">Agent Codename</span>
                                <span className="w-32 text-center shrink-0">Victory Feed</span>
                                <span className="w-24 text-center shrink-0 font-bold">Win Ratio</span>
                            </div>
                        )}

                        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1 select-none scrollbar-thin custom-scrollbar">
                            {isLoadingLeaderboard ? (
                                <div className="flex flex-col items-center justify-center py-24 gap-3">
                                    <div className="w-9 h-9 border-2 border-amber-650/30 border-t-amber-500 rounded-full animate-spin" />
                                    <span className="text-stone-600 text-[10px] sm:text-xs font-bold tracking-widest uppercase">Fetching Classified Intel...</span>
                                </div>
                            ) : leaderboard.length === 0 ? (
                                <div className="text-center py-24 text-stone-600 text-xs font-bold tracking-widest uppercase">
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
                                        <div key={entry.username} className={`border rounded-xl overflow-hidden transition-all duration-300 transform hover:scale-[1.005] ${cardTheme}`}>
                                            <button
                                                onClick={() => {
                                                    audioManager.playSound('click');
                                                    setSelectedCareerUser(entry);
                                                }}
                                                className="w-full flex items-center px-5 py-4 text-left transition-colors cursor-pointer"
                                            >
                                                {/* Rank Symbol */}
                                                <span className="w-14 text-center font-black text-sm sm:text-base shrink-0">{rankBadge}</span>
                                                
                                                {/* Agent Username */}
                                                <div className="flex-1 min-w-0 pl-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-black text-xs sm:text-sm uppercase tracking-wider truncate ${idx === 0 ? 'text-amber-400' : 'text-stone-200'}`}>{entry.username}</span>
                                                        {entry.isDeveloper && (
                                                            <span className="px-1.5 py-0.5 bg-purple-650/35 border border-purple-500/40 text-purple-400 text-[6.5px] font-black tracking-widest rounded-md uppercase shrink-0">DEV</span>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {/* Win/Loss Stats */}
                                                <div className="flex items-center gap-3 w-32 justify-center text-xs font-black shrink-0">
                                                    <span className="text-green-500">{entry.wins}W</span>
                                                    <span className="text-red-500">{entry.losses}L</span>
                                                    {entry.hardModeWins > 0 && (
                                                        <span className="text-amber-400 flex items-center gap-0.5 shrink-0" title="Elite Hard Mode Wins">
                                                            <Skull size={13} className="text-red-500 animate-pulse animate-duration-1000" />{entry.hardModeWins}
                                                        </span>
                                                    )}
                                                </div>
                                                
                                                {/* Win Rate */}
                                                <div className="w-24 text-center font-black text-xs sm:text-sm text-stone-300 shrink-0">
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
                            className="mt-6 w-full py-4 bg-stone-900 border border-stone-850 hover:border-stone-600 hover:text-white text-stone-400 font-bold text-xs tracking-[0.4em] uppercase transition-all rounded-xl cursor-pointer active:scale-98 shadow-md"
                        >
                            Close Terminal
                        </button>
                    </div>
                </div>
            )}

            {/* TACTICAL PROFILE POPUP MODAL (CAREER LOG) */}
            {selectedCareerUser && (
                <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="relative w-full max-w-2xl bg-stone-950/95 border-2 border-stone-850 p-8 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] font-mono text-left max-h-[85vh] overflow-y-auto scrollbar-thin">
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-amber-600/30" />
                        
                        {/* Header Box */}
                        <div className="flex items-start justify-between border-b border-stone-900 pb-4 mb-6">
                            <div className="flex items-center gap-3.5">
                                <div className="p-3 bg-amber-500/10 border border-amber-600/30 text-amber-500 rounded-xl">
                                    <Trophy size={22} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-stone-200 uppercase tracking-widest flex items-center gap-2">
                                        Career Log: {selectedCareerUser.username}
                                        {selectedCareerUser.isDeveloper && (
                                            <span className="px-1.5 py-0.5 bg-purple-650/35 border border-purple-500/40 text-purple-400 text-[7px] font-black tracking-widest rounded-md uppercase shrink-0">DEV</span>
                                        )}
                                    </h2>
                                    <p className="text-[9px] text-stone-500 font-bold tracking-widest uppercase mt-0.5">Tactical Performance Data</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    audioManager.playSound('click');
                                    setSelectedCareerUser(null);
                                }}
                                className="text-stone-300 hover:text-red-400 bg-stone-900/60 hover:bg-red-950/30 border border-stone-800 hover:border-red-500/45 p-2 rounded-xl cursor-pointer flex items-center justify-center transition-all"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Top Summary Blocks */}
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            <div className="bg-stone-900/30 border border-stone-900 rounded-xl p-4 text-center">
                                <div className="text-[8px] text-stone-500 font-bold tracking-widest uppercase mb-1">Wins</div>
                                <div className="text-2xl font-black text-stone-200">{selectedCareerUser.wins}</div>
                            </div>
                            <div className="bg-stone-900/30 border border-stone-900 rounded-xl p-4 text-center">
                                <div className="text-[8px] text-stone-500 font-bold tracking-widest uppercase mb-1">Losses</div>
                                <div className="text-2xl font-black text-stone-200">{selectedCareerUser.losses}</div>
                            </div>
                            <div className="bg-stone-900/30 border border-stone-900 rounded-xl p-4 text-center">
                                <div className="text-[8px] text-stone-500 font-bold tracking-widest uppercase mb-1">Success</div>
                                <div className="text-2xl font-black text-stone-200">{winRate}<span className="text-xs text-stone-500 ml-0.5">%</span></div>
                            </div>
                        </div>

                        {/* Combat Analysis Block Divider */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-[1px] w-8 bg-stone-900" />
                            <span className="text-[8px] text-stone-500 font-bold tracking-[0.3em] uppercase whitespace-nowrap">Combat Analysis</span>
                            <div className="h-[1px] flex-1 bg-stone-900" />
                        </div>

                        {/* Core Stats Details Container */}
                        <div className="grid grid-cols-4 gap-2.5 mb-6">
                            <div className="bg-stone-900/10 border border-stone-900/40 rounded-xl p-3 text-center">
                                <Activity size={14} className="text-blue-500 mx-auto mb-1.5" />
                                <div className="text-base font-black text-stone-200">{selectedCareerUser.stats.totalRounds || 0}</div>
                                <div className="text-[7px] text-stone-500 font-bold uppercase tracking-widest mt-0.5">Rounds</div>
                            </div>
                            <div className="bg-stone-900/10 border border-stone-900/40 rounded-xl p-3 text-center">
                                <Crosshair size={14} className="text-red-500 mx-auto mb-1.5" />
                                <div className="text-base font-black text-stone-200">{precisionRate}%</div>
                                <div className="text-[7px] text-stone-500 font-bold uppercase tracking-widest mt-0.5">Precision</div>
                            </div>
                            <div className="bg-stone-900/10 border border-stone-900/40 rounded-xl p-3 text-center">
                                <Swords size={14} className="text-amber-500 mx-auto mb-1.5" />
                                <div className="text-base font-black text-stone-200">{selectedCareerUser.stats.damageDealt || 0}</div>
                                <div className="text-[7px] text-stone-500 font-bold uppercase tracking-widest mt-0.5">Lethality</div>
                            </div>
                            <div className="bg-stone-900/10 border border-stone-900/40 rounded-xl p-3 text-center">
                                <Skull size={14} className="text-purple-500 mx-auto mb-1.5" />
                                <div className="text-base font-black text-stone-200">{selectedCareerUser.stats.highestRound || 0}</div>
                                <div className="text-[7px] text-stone-500 font-bold uppercase tracking-widest mt-0.5">Tier</div>
                            </div>
                        </div>

                        {/* Match Feed Header Block */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-[1px] w-8 bg-stone-900" />
                            <span className="text-[8px] text-stone-500 font-bold tracking-[0.3em] uppercase whitespace-nowrap">Recent Operations</span>
                            <div className="h-[1px] flex-1 bg-stone-900" />
                        </div>

                        {/* Recent History Feed Loop */}
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                            {(!selectedCareerUser.stats.matchHistory || selectedCareerUser.stats.matchHistory.length === 0) ? (
                                <div className="text-center py-6 text-stone-600 text-[10px] font-bold uppercase tracking-wider">
                                    No records filed in operations matrix
                                </div>
                            ) : (
                                [...selectedCareerUser.stats.matchHistory].reverse().map((match: any, mIdx: number) => {
                                    const isWin = match.result === 'WIN';
                                    return (
                                        <div key={mIdx} className="bg-stone-950 border border-stone-900 p-3 rounded-xl flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${isWin ? 'bg-green-950/40 text-green-400 border border-green-900/30' : 'bg-red-950/40 text-red-500 border border-red-900/20'}`}>
                                                    {isWin ? 'W' : 'L'}
                                                </div>
                                                <div>
                                                    <div className="text-xs font-black text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
                                                        {match.isHardMode ? 'STRIKE FORCE 1' : `MISSION ${selectedCareerUser.stats.matchHistory.length - mIdx}`}
                                                        {match.isHardMode && (
                                                            <span className="px-1.5 py-0.5 bg-red-950/60 border border-red-900/40 text-red-500 text-[6px] font-black tracking-widest rounded uppercase">ELITE</span>
                                                        )}
                                                    </div>
                                                    <div className="text-[8px] text-stone-600 font-bold mt-0.5">6/14/2026</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-4 text-right">
                                                <div>
                                                    <div className="text-[6px] text-stone-600 font-bold uppercase tracking-widest">Score</div>
                                                    <div className="text-xs font-black text-amber-500">{(match.score || match.itemPoints || 0).toLocaleString()}</div>
                                                </div>
                                                <div className="min-w-8">
                                                    <div className="text-[6px] text-stone-600 font-bold uppercase tracking-widest">Rounds</div>
                                                    <div className="text-xs font-black text-stone-300">{match.highestRound || match.rounds || 1}</div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Menu Center Frame Area */}
            <div
                className="relative z-10 text-center max-w-xl w-full p-4 sm:p-6 flex flex-col justify-center origin-center transition-all duration-300 my-auto max-h-screen overflow-hidden"
                style={{ transform: `scale(${scale})` }}
            >
                <div className="mb-4 sm:mb-5 relative">
                    <h1 className="text-3xl sm:text-5xl md:text-6xl font-black mb-0 text-white tracking-tighter leading-[0.85] drop-shadow-[0_0_30px_rgba(255,255,255,0.15)]">
                        AADISH<br />
                        <span className="text-red-700/95 tracking-[-0.05em] relative">
                            ROULETTE
                            <span className="absolute -inset-1 blur-2xl bg-red-950/20 -z-10" />
                        </span>
                    </h1>
                    <div className="mt-2.5 sm:mt-3 flex items-center justify-center gap-3">
                        <div className="h-[1px] w-8 sm:w-12 bg-stone-850" />
                        <p className="text-stone-500 font-black tracking-[0.5em] text-[9px] sm:text-[10px] uppercase">Version {GAME_VERSION}</p>
                        <div className="h-[1px] w-8 sm:w-12 bg-stone-850" />
                    </div>
                </div>

                <div className="flex flex-col gap-3.5 max-w-sm mx-auto w-full">
                    {/* Identity Section */}
                    <div className="text-center mb-1.5">
                        <p className="text-[9px] text-red-900/50 font-black tracking-[0.4em] uppercase mb-1.5 animate-pulse">Click to bind soul</p>
                        <div className="relative group max-w-[260px] mx-auto w-full">
                            <input
                                ref={nameInputRef}
                                type="text"
                                value={inputName}
                                onChange={(e) => setInputName(e.target.value)}
                                placeholder="IDENTITY"
                                maxLength={12}
                                className="w-full bg-stone-950/65 border-2 border-stone-850 py-2.5 px-4 sm:py-3 text-xs sm:text-sm font-black text-white outline-none focus:border-red-650/45 focus:bg-stone-900/10 transition-all duration-500 tracking-[0.25em] uppercase text-center placeholder-stone-850/60 backdrop-blur-xl rounded-xl"
                            />
                            <div className="absolute inset-x-0 -bottom-1 h-[2px] bg-gradient-to-r from-transparent via-red-600/50 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-700" />
                        </div>
                    </div>

                    <div className="grid grid-cols-12 gap-2.5">
                        {/* Start Game Button */}
                        <button 
                            onClick={() => {
                                audioManager.playSound('click');
                                onStartGame(false);
                            }} 
                            disabled={!inputName.trim()} 
                            className="col-span-6 px-3 py-3.5 sm:py-4 bg-white text-black font-black text-[10px] sm:text-xs hover:bg-stone-200 active:scale-[0.98] transition-all duration-305 disabled:opacity-20 disabled:grayscale tracking-[0.2em] rounded-xl shadow-[0_10px_35px_rgba(255,255,255,0.06)] hover:shadow-[0_0_30px_rgba(255,255,255,0.25)] hover:scale-[1.015] active:scale-[0.985] relative overflow-hidden group/btn uppercase leading-none cursor-pointer border-2 border-white"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
                            <span>START GAME</span>
                        </button>

                        {/* Multiplayer Button */}
                        <button 
                            onClick={() => {
                                audioManager.playSound('click');
                                onStartMultiplayer(inputName.trim());
                            }} 
                            disabled={!inputName.trim()} 
                            className="col-span-6 px-3 py-3.5 sm:py-4 bg-stone-950/60 border-2 border-cyan-850/60 text-cyan-400 font-black text-[10px] sm:text-xs hover:text-white hover:border-cyan-500 hover:bg-cyan-950/20 hover:shadow-[0_0_30px_rgba(6,182,212,0.35)] hover:scale-[1.015] active:scale-[0.985] transition-all duration-300 disabled:opacity-20 flex items-center justify-center gap-2 group rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.3)] uppercase tracking-[0.2em] leading-none cursor-pointer"
                        >
                            <Swords size={13} className="text-cyan-500 group-hover:rotate-12 transition-transform duration-300 shrink-0" />
                            <span>MULTIPLAYER</span>
                        </button>

                        {/* Hard Mode Button */}
                        <button 
                            onClick={() => {
                                audioManager.playSound('click');
                                setShowHardModeWarning(true);
                            }} 
                            disabled={!inputName.trim()} 
                            className="col-span-12 py-3.5 bg-stone-950/70 border-2 border-red-950 hover:border-red-650 text-red-500 font-black text-[10px] sm:text-xs hover:text-white hover:bg-red-950/30 hover:shadow-[0_0_35px_rgba(220,38,38,0.4)] hover:scale-[1.015] active:scale-[0.985] transition-all duration-300 disabled:opacity-20 flex items-center justify-center gap-2 group rounded-xl shadow-[0_10px_30px_rgba(220,38,38,0.05)] uppercase tracking-[0.25em] leading-none cursor-pointer animate-[border-glow-red_3s_ease-in-out_infinite]"
                        >
                            <Skull size={13} className="text-red-700 group-hover:text-red-400 group-hover:scale-110 transition-all duration-300 animate-pulse shrink-0" />
                            <span>HARD MODE PROTOCOL</span>
                            <Skull size={13} className="text-red-700 group-hover:text-red-400 group-hover:scale-110 transition-all duration-300 animate-pulse shrink-0" />
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 mt-1.5">
                        {/* Guide Button */}
                        <button 
                            onClick={() => {
                                audioManager.playSound('click');
                                onOpenGuide();
                            }} 
                            className="px-3 py-2.5 sm:py-3 bg-stone-900/20 border border-stone-850 text-stone-500 font-black text-[9px] flex flex-col items-center justify-center gap-1.5 tracking-[0.3em] hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-950/15 active:scale-95 hover:scale-105 transition-all duration-300 uppercase rounded-xl cursor-pointer"
                        >
                            <HelpCircle size={16} className="text-stone-600 group-hover:text-cyan-455 transition-colors" />
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
                            className="px-3 py-2.5 sm:py-3 bg-stone-900/20 border border-stone-850 text-stone-500 font-black text-[9px] flex flex-col items-center justify-center gap-1.5 tracking-[0.3em] hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-950/15 active:scale-95 hover:scale-105 transition-all duration-300 uppercase rounded-xl cursor-pointer relative"
                        >
                            <Trophy size={16} className="text-stone-600" />
                            Stats
                            {!loggedInUser && <Lock size={9} className="absolute top-2 right-2 text-red-650/70" />}
                        </button>
                        {/* Config Button */}
                        <button 
                            onClick={() => {
                                audioManager.playSound('click');
                                onOpenSettings();
                            }} 
                            className="px-3 py-2.5 sm:py-3 bg-stone-900/20 border border-stone-850 text-stone-500 font-black text-[9px] flex flex-col items-center justify-center gap-1.5 tracking-[0.3em] hover:text-stone-100 hover:border-stone-550 hover:bg-stone-800/40 active:scale-95 hover:scale-105 transition-all duration-300 uppercase rounded-xl cursor-pointer"
                        >
                            <SettingsIcon size={16} className="text-stone-600" />
                            Config
                        </button>
                    </div>

                    {/* Leaderboard Trigger Button */}
                    <button
                        onClick={() => {
                            audioManager.playSound('click');
                            loadLeaderboardData();
                            setShowLeaderboard(true);
                        }}
                        className="mt-1.5 w-full py-3.5 bg-gradient-to-r from-amber-950/20 via-stone-900/20 to-amber-950/20 border border-amber-900/40 text-amber-600/90 font-black text-[10px] sm:text-xs flex items-center justify-center gap-3 tracking-[0.3em] hover:text-amber-455 hover:border-amber-500 hover:bg-amber-950/25 hover:shadow-[0_0_25px_rgba(245,158,11,0.2)] hover:scale-[1.015] active:scale-[0.985] transition-all duration-300 uppercase rounded-xl cursor-pointer group/lb"
                    >
                        <Crown size={16} className="text-amber-750 group-hover/lb:text-amber-400 transition-colors group-hover/lb:rotate-[-10deg] transition-transform duration-300" />
                        Global Leaderboard
                        <Crown size={16} className="text-amber-750 group-hover/lb:text-amber-400 transition-colors group-hover/lb:rotate-[10deg] transition-transform duration-300" />
                    </button>
                </div>

                <div className="mt-8 flex flex-col items-center gap-4">
                    {!isStandalone && (isInstallable || isMobile || isIOS) && (
                        <button
                            onClick={handleInstallClick}
                            className="px-6 py-2 rounded-full border border-blue-900/30 bg-blue-950/20 text-blue-500 text-[10px] font-black tracking-[0.5em] hover:bg-blue-900/30 hover:text-blue-400 transition-all animate-pulse uppercase cursor-pointer"
                        >
                            Download the App
                        </button>
                    )}
                    {isStandalone ? (
                        <div className="text-stone-700 text-[9px] font-black tracking-[0.8em] uppercase opacity-40">System Link: Established</div>
                    ) : (
                        <div className="text-stone-850 text-[9px] font-black tracking-[0.8em] uppercase">Web Instance • {GAME_VERSION}</div>
                    )}
                </div>
            </div>
        </div>
    );
};