import React, { useEffect, useRef } from 'react';
import { Settings as SettingsIcon, HelpCircle, Trophy, ShieldAlert, Lock, User, Terminal, BookOpen, Crown, Shield, Skull, X, Crosshair, Swords, Activity, Award } from 'lucide-react';
import { audioManager } from '../../utils/audioManager';
import { loginUser, registerUser, getLeaderboard } from '../../utils/redisService';

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
            const hScale = Math.min(1, (window.innerHeight - 20) / 650);
            const wScale = Math.min(1, (window.innerWidth - 20) / 850);
            let newScale = Math.min(hScale, wScale);
            if (window.innerWidth < 500) {
                newScale = Math.max(newScale, 0.55);
            } else {
                newScale = Math.max(newScale, 0.4);
            }
            if (newScale > 1.2) newScale = 1.2;
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

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden pointer-events-auto bg-black/40 backdrop-blur-[2px]">
            
            {/* Top Right User Profile Badge Section */}
            <div className="absolute top-6 right-6 z-[60] flex items-center gap-3">
                {loggedInUser ? (
                    <div className="flex items-center gap-3 bg-stone-950/80 border border-green-900/40 p-2 px-4 rounded-xl backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                        <div className="flex flex-col text-left">
                            <span className="text-[7px] text-stone-500 font-bold uppercase tracking-widest leading-none mb-0.5">Agent Signed In</span>
                            <span className="text-[11px] text-green-400 font-mono font-black uppercase tracking-wider leading-none">{loggedInUser.username}</span>
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
                        className="group/signin px-5 py-2.5 bg-gradient-to-r from-red-950/60 to-stone-950/80 border border-red-700/50 text-red-400 hover:text-white hover:border-red-500 font-mono font-black text-[10px] tracking-[0.2em] rounded-xl backdrop-blur-md transition-all shadow-[0_0_25px_rgba(220,38,38,0.15)] hover:shadow-[0_0_40px_rgba(220,38,38,0.3)] hover:scale-105 active:scale-95 uppercase flex items-center gap-2.5 cursor-pointer"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                        </span>
                        Sign In / Register
                    </button>
                )}
            </div>

            {/* Bottom Right Floating Changelog Button */}
            <div className="absolute bottom-6 right-6 z-[60]">
                <button
                    onClick={() => {
                        audioManager.playSound('click');
                        setShowChangelog(true);
                    }}
                    className="group/cl p-4 bg-gradient-to-br from-stone-900/90 to-stone-950/90 border border-stone-700/50 text-stone-400 hover:text-amber-400 hover:border-amber-600/50 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-md transition-all hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]"
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

            {/* Login / Register Modal */}
            {showLoginModal && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <form
                        onSubmit={handleLoginSubmit}
                        className="relative w-full max-w-sm bg-stone-950/90 border-2 border-stone-800/80 p-6 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] font-mono text-center"
                    >
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-red-600/30 animate-[scan-line-move_4s_linear_infinite]" />
                        <div className="flex border-b border-stone-900 mb-6 bg-stone-900/10 rounded-t-lg overflow-hidden">
                            <button
                                type="button"
                                onClick={() => {
                                    audioManager.playSound('click');
                                    setLoginTab('signin');
                                    setLoginError('');
                                    setLoginSuccess('');
                                }}
                                className={`flex-1 py-3 text-[10px] font-black tracking-widest uppercase transition-all cursor-pointer ${loginTab === 'signin' ? 'text-red-500 bg-red-950/10 border-b-2 border-red-600' : 'text-stone-500 border-b-2 border-transparent hover:text-stone-300'}`}
                            >
                                Sign In
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    audioManager.playSound('click');
                                    setLoginTab('register');
                                    setLoginError('');
                                    setLoginSuccess('');
                                }}
                                className={`flex-1 py-3 text-[10px] font-black tracking-widest uppercase transition-all cursor-pointer ${loginTab === 'register' ? 'text-red-500 bg-red-950/10 border-b-2 border-red-600' : 'text-stone-500 border-b-2 border-transparent hover:text-stone-300'}`}
                            >
                                Register
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="relative">
                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-600" size={16} />
                                <input
                                    type="text"
                                    value={loginUsername}
                                    onChange={(e) => setLoginUsername(e.target.value)}
                                    placeholder="Username"
                                    maxLength={12}
                                    className="w-full bg-stone-950/60 border border-stone-800 p-3.5 pl-11 text-xs font-bold text-white outline-none focus:border-red-600/50 transition-all tracking-widest uppercase rounded-xl placeholder-stone-700"
                                    required
                                />
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-600" size={16} />
                                <input
                                    type="password"
                                    value={loginPassword}
                                    onChange={(e) => setLoginPassword(e.target.value)}
                                    placeholder="Password"
                                    className="w-full bg-stone-950/60 border border-stone-800 p-3.5 pl-11 text-xs font-bold text-white outline-none focus:border-red-600/50 transition-all tracking-widest uppercase rounded-xl placeholder-stone-700"
                                    required
                                />
                            </div>
                        </div>

                        {loginError && (
                            <div className="mt-4 text-[10px] text-red-500 font-bold tracking-wider uppercase animate-[shake_0.5s_ease-in-out]">
                                [ERROR: {loginError}]
                            </div>
                        )}

                        {loginSuccess && (
                            <div className="mt-4 text-[10px] text-green-500 font-bold tracking-wider uppercase animate-pulse">
                                [{loginSuccess}]
                            </div>
                        )}

                        <div className="mt-6 flex flex-col gap-3">
                            <button
                                type="submit"
                                disabled={isLoadingRedis}
                                className="w-full py-4 bg-red-900/20 hover:bg-red-750 text-white font-black text-sm tracking-[0.2em] border border-red-700/50 hover:border-red-500 transition-all active:scale-[0.98] disabled:opacity-50 uppercase rounded-xl cursor-pointer"
                            >
                                {isLoadingRedis ? 'CONNECTING NETWORK...' : (loginTab === 'signin' ? 'AUTHORIZE SESSION' : 'ESTABLISH IDENTITY')}
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
                                className="w-full py-2 bg-transparent text-stone-600 hover:text-stone-400 font-bold text-[10px] tracking-[0.3em] uppercase transition-colors cursor-pointer"
                            >
                                — ABORT CONSOLE —
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Changelog Modal */}
            {showChangelog && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="relative w-full max-w-md bg-stone-950/90 border-2 border-stone-800/80 p-6 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] font-mono">
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-red-600/30 animate-[scan-line-move_4s_linear_infinite]" />
                        <div className="text-stone-300 font-black border-b border-stone-900 pb-3 mb-4 flex items-center justify-between uppercase tracking-wider text-sm">
                            <span className="flex items-center gap-2">
                                <Terminal size={16} className="text-red-500" />
                                System Changelog
                            </span>
                            <span className="text-red-500/80 animate-pulse flex items-center gap-1.5 text-xs">
                                <span className="w-1.5 h-1.5 bg-red-600 rounded-full" />
                                active
                            </span>
                        </div>
                        
                        <div className="space-y-4 text-left max-h-72 overflow-y-auto pr-1 select-text scrollbar-thin text-xs text-stone-400">
                            <div className="space-y-2">
                                <span className="text-stone-300 font-bold block border-b border-stone-900 pb-1">[June 14, 2026]</span>
                                <ul className="list-none space-y-1.5 pl-1">
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-500 font-bold">+</span>
                                        <span>Added developer debug overlay menu</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-500 font-bold">*</span>
                                        <span>Fixed dealer-turn shell editor overrides</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-500 font-bold">*</span>
                                        <span>Resolved transitional camera clipping &amp; grey screen bugs</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                audioManager.playSound('click');
                                setShowChangelog(false);
                            }}
                            className="mt-6 w-full py-3 bg-stone-900 border border-stone-800 hover:border-stone-600 hover:text-white text-stone-400 font-bold text-xs tracking-[0.4em] uppercase transition-all rounded-xl cursor-pointer"
                        >
                            Close Console
                        </button>
                    </div>
                </div>
            )}

            {/* Global Leaderboard Modal */}
            {showLeaderboard && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="relative w-full max-w-lg bg-stone-950/90 border-2 border-stone-800/80 p-6 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] font-mono">
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-amber-600/30 animate-[scan-line-move_4s_linear_infinite]" />
                        <div className="text-stone-300 font-black border-b border-stone-900 pb-3 mb-4 flex items-center justify-between uppercase tracking-wider text-sm">
                            <span className="flex items-center gap-2">
                                <Crown size={16} className="text-amber-500" />
                                Global Leaderboard
                            </span>
                            <span className="text-amber-500/80 flex items-center gap-1.5 text-xs">
                                <span className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-pulse" />
                                {leaderboard.length} agents
                            </span>
                        </div>

                        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
                            {isLoadingLeaderboard ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3">
                                    <div className="w-6 h-6 border-2 border-amber-600/40 border-t-amber-500 rounded-full animate-spin" />
                                    <span className="text-stone-600 text-[10px] font-bold tracking-widest uppercase">Fetching Intel...</span>
                                </div>
                            ) : leaderboard.length === 0 ? (
                                <div className="text-center py-12 text-stone-600 text-xs font-bold tracking-widest uppercase">
                                    No agents registered
                                </div>
                            ) : (
                                leaderboard.map((entry, idx) => {
                                    const rankColors = idx === 0 ? 'text-amber-400 bg-amber-500/10 border-amber-600/30' : idx === 1 ? 'text-stone-300 bg-stone-500/5 border-stone-600/20' : idx === 2 ? 'text-orange-400 bg-orange-500/5 border-orange-600/20' : 'text-stone-500 bg-stone-900/20 border-stone-800/30';
                                    const rankIcon = idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                                    return (
                                        <div key={entry.username} className={`border rounded-xl overflow-hidden transition-all duration-300 ${rankColors}`}>
                                            <button
                                                onClick={() => {
                                                    audioManager.playSound('click');
                                                    setSelectedCareerUser(entry);
                                                }}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 cursor-pointer"
                                            >
                                                <span className="w-8 text-center font-black text-sm shrink-0">{rankIcon}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-xs uppercase tracking-wider truncate">{entry.username}</span>
                                                        {entry.isDeveloper && (
                                                            <span className="px-1.5 py-0.5 bg-purple-600/30 border border-purple-500/40 text-purple-400 text-[7px] font-black tracking-widest rounded-md uppercase shrink-0">DEV</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 text-[10px] font-bold tracking-wider shrink-0">
                                                    <span className="text-green-500">{entry.wins}W</span>
                                                    <span className="text-red-600">{entry.losses}L</span>
                                                    {entry.hardModeWins > 0 && (
                                                        <span className="text-amber-500 flex items-center gap-0.5">
                                                            <Skull size={10} />{entry.hardModeWins}
                                                        </span>
                                                    )}
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
                            className="mt-5 w-full py-3 bg-stone-900 border border-stone-800 hover:border-stone-600 hover:text-white text-stone-400 font-bold text-xs tracking-[0.4em] uppercase transition-all rounded-xl cursor-pointer"
                        >
                            Close Terminal
                        </button>
                    </div>
                </div>
            )}

            {/* TACTICAL PROFILE POPUP MODAL (CAREER LOG) */}
            {selectedCareerUser && (
                <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="relative w-full max-w-xl bg-stone-950/95 border border-stone-850 p-6 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] font-mono text-left max-h-[85vh] overflow-y-auto scrollbar-thin">
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
                                            <span className="px-1.5 py-0.5 bg-purple-600/30 border border-purple-500/40 text-purple-400 text-[7px] font-black tracking-widest rounded-md uppercase shrink-0">DEV</span>
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
                                className="text-stone-500 hover:text-stone-200 transition-colors p-1 bg-stone-900/40 rounded-lg hover:bg-stone-900 cursor-pointer"
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
                className="relative z-10 text-center max-w-xl w-full p-8 flex flex-col justify-center origin-center transition-all duration-300"
                style={{ transform: `scale(${scale})` }}
            >
                <div className="mb-10 relative">
                    <h1 className="text-7xl sm:text-8xl font-black mb-0 text-white tracking-tighter leading-[0.85] drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                        AADISH<br />
                        <span className="text-red-700/90 tracking-[-0.05em] relative">
                            ROULETTE
                            <span className="absolute -inset-1 blur-2xl bg-red-950/20 -z-10" />
                        </span>
                    </h1>
                    <div className="mt-4 flex items-center justify-center gap-4">
                        <div className="h-[1px] w-12 bg-stone-800" />
                        <p className="text-stone-500 font-bold tracking-[0.6em] text-[10px] uppercase">Simulation 1.0.6</p>
                        <div className="h-[1px] w-12 bg-stone-800" />
                    </div>
                </div>

                <div className="flex flex-col gap-4 max-w-sm mx-auto w-full">
                    {/* Identity Section */}
                    <div className="text-center mb-2">
                        <p className="text-[10px] text-red-900/40 font-black tracking-[0.5em] uppercase mb-2 animate-pulse">Click to bind soul</p>
                        <div className="relative group">
                            <input
                                ref={nameInputRef}
                                type="text"
                                value={inputName}
                                onChange={(e) => setInputName(e.target.value)}
                                placeholder="IDENTITY"
                                maxLength={12}
                                className="w-full bg-stone-950/40 border-2 border-stone-800/80 p-5 text-2xl font-black text-white outline-none focus:border-red-600/50 focus:bg-stone-900/20 transition-all duration-500 tracking-[0.2em] uppercase text-center placeholder-stone-800/50 backdrop-blur-xl rounded-xl"
                            />
                            <div className="absolute inset-x-0 -bottom-1 h-[2px] bg-gradient-to-r from-transparent via-red-600/50 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-700" />
                        </div>
                    </div>

                    <div className="grid grid-cols-12 gap-3">
                        <button onClick={() => {
                            audioManager.playSound('click');
                            onStartGame(false);
                        }} disabled={!inputName.trim()} className="col-span-8 px-4 py-5 bg-white text-black font-black text-xl hover:bg-stone-200 active:scale-[0.98] transition-all duration-300 disabled:opacity-20 disabled:grayscale tracking-[0.4em] rounded-xl shadow-[0_20px_50px_rgba(255,255,255,0.1)] relative overflow-hidden group/btn uppercase leading-none cursor-pointer">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
                            <span>START GAME</span>
                        </button>

                        <button onClick={() => {
                            audioManager.playSound('click');
                            onStartMultiplayer(inputName.trim());
                        }} disabled={!inputName.trim()} className="col-span-4 py-5 bg-stone-950/60 border border-stone-800 text-stone-200 font-black text-[10px] md:text-sm hover:text-white hover:border-white active:scale-[0.98] transition-all duration-300 disabled:opacity-20 flex flex-col items-center justify-center gap-1 group rounded-xl hover:bg-stone-900/40 shadow-[0_10px_30px_rgba(255,255,255,0.02)] uppercase tracking-widest leading-none cursor-pointer">
                            MULTIPLAYER
                        </button>

                        <button onClick={() => {
                            audioManager.playSound('click');
                            setShowHardModeWarning(true);
                        }} disabled={!inputName.trim()} className="col-span-12 py-3 bg-stone-950/60 border border-red-900/40 text-red-600 font-black text-[9px] md:text-xs hover:text-red-500 hover:border-red-600 active:scale-[0.98] transition-all duration-300 disabled:opacity-20 flex flex-col items-center justify-center gap-1 group rounded-xl hover:bg-red-950/20 shadow-[0_10px_30px_rgba(220,38,38,0.05)] uppercase tracking-widest leading-none cursor-pointer">
                            HARD MODE
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mt-2">
                        <button onClick={() => {
                            audioManager.playSound('click');
                            onOpenGuide();
                        }} className="px-4 py-4 bg-stone-900/20 border border-stone-800/40 text-stone-500 font-black text-[9px] flex flex-col items-center justify-center gap-2 tracking-[0.3em] hover:text-cyan-400 hover:border-cyan-900/50 hover:bg-cyan-950/10 active:scale-95 transition-all duration-300 uppercase rounded-xl cursor-pointer">
                            <HelpCircle size={18} className="text-stone-600" />
                            Guide
                        </button>
                        <button onClick={() => {
                            audioManager.playSound('click');
                            if (!loggedInUser) {
                                setShowLoginModal(true);
                                return;
                            }
                            onOpenScoreboard();
                        }} className="px-4 py-4 bg-stone-900/20 border border-stone-800/40 text-stone-500 font-black text-[9px] flex flex-col items-center justify-center gap-2 tracking-[0.3em] hover:text-amber-500 hover:border-amber-900/50 hover:bg-amber-950/10 active:scale-95 transition-all duration-300 uppercase rounded-xl cursor-pointer relative">
                            <Trophy size={18} className="text-stone-600" />
                            Stats
                            {!loggedInUser && <Lock size={10} className="absolute top-2 right-2 text-red-600/60" />}
                        </button>
                        <button onClick={() => {
                            audioManager.playSound('click');
                            onOpenSettings();
                        }} className="px-4 py-4 bg-stone-900/20 border border-stone-800/40 text-stone-500 font-black text-[9px] flex flex-col items-center justify-center gap-2 tracking-[0.3em] hover:text-stone-100 hover:border-stone-600 hover:bg-stone-800/40 active:scale-95 transition-all duration-300 uppercase rounded-xl cursor-pointer">
                            <SettingsIcon size={18} className="text-stone-600" />
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
                        className="mt-2 w-full py-4 bg-gradient-to-r from-amber-950/20 via-stone-900/20 to-amber-950/20 border border-amber-900/30 text-amber-600/80 font-black text-[10px] md:text-xs flex items-center justify-center gap-3 tracking-[0.3em] hover:text-amber-400 hover:border-amber-600/50 hover:bg-amber-950/20 active:scale-[0.98] transition-all duration-300 uppercase rounded-xl cursor-pointer hover:shadow-[0_0_20px_rgba(245,158,11,0.1)] group/lb"
                    >
                        <Crown size={16} className="text-amber-700 group-hover/lb:text-amber-400 transition-colors group-hover/lb:rotate-[-10deg] transition-transform duration-300" />
                        Global Leaderboard
                        <Crown size={16} className="text-amber-700 group-hover/lb:text-amber-400 transition-colors group-hover/lb:rotate-[10deg] transition-transform duration-300" />
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
                        <div className="text-stone-800 text-[9px] font-black tracking-[0.8em] uppercase">Web Instance • 1.0.6</div>
                    )}
                </div>
            </div>
        </div>
    );
};