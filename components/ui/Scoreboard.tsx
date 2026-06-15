import React, { useEffect, useState } from 'react';
import { X, Trophy, Activity, Target, Zap, Skull, Swords } from 'lucide-react';
import { GameStats, getStoredStats } from '../../utils/statsManager';
import { audioManager } from '../../utils/audioManager';

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

interface ScoreboardProps {
    onClose: () => void;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ onClose }) => {
    const [stats, setStats] = useState<GameStats | null>(null);

    useEffect(() => {
        setStats(getStoredStats());
    }, []);

    if (!stats) return null;

    const totalGames = stats.wins + stats.losses;
    const winRate = totalGames > 0 ? Math.round((stats.wins / totalGames) * 100) : 0;
    const accuracy = stats.shotsFired > 0 ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 0;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md pointer-events-auto p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-xl max-h-[85vh] bg-stone-950/40 backdrop-blur-2xl border border-stone-800/50 shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col relative overflow-hidden rounded-2xl ring-1 ring-white/5">

                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-yellow-500/20 to-transparent" />
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-yellow-500/5 blur-[80px] rounded-full" />

                {/* Header */}
                <div className="p-6 border-b border-stone-800/50 flex justify-between items-center bg-stone-950/20 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                            <Trophy className="text-yellow-500" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white tracking-[0.2em] uppercase leading-tight">CAREER LOG</h2>
                            <p className="text-[10px] text-stone-500 font-bold tracking-[0.4em] uppercase">Tactical Performance Data</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            audioManager.playSound('click');
                            onClose();
                        }}
                        className="p-2 text-stone-500 hover:text-white hover:bg-white/5 rounded-full transition-all active:scale-95"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide custom-scrollbar">

                    {/* Main Stats - Wins/Losses/WinRate */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-stone-900/40 p-5 border border-white/5 rounded-2xl flex flex-col items-center justify-center group hover:bg-stone-900/60 transition-colors">
                            <div className="text-stone-500 text-[9px] font-black tracking-[0.2em] uppercase mb-2 group-hover:text-green-500/70 transition-colors">WINS</div>
                            <div className="text-4xl font-black text-white px-2 relative">
                                {stats.wins}
                                <div className="absolute -inset-1 blur-lg bg-green-500/10 -z-10 group-hover:bg-green-500/20 transition-all" />
                            </div>
                        </div>
                        <div className="bg-stone-900/40 p-5 border border-white/5 rounded-2xl flex flex-col items-center justify-center group hover:bg-stone-900/60 transition-colors">
                            <div className="text-stone-500 text-[9px] font-black tracking-[0.2em] uppercase mb-2 group-hover:text-red-500/70 transition-colors">LOSSES</div>
                            <div className="text-4xl font-black text-white px-2 relative">
                                {stats.losses}
                                <div className="absolute -inset-1 blur-lg bg-red-500/10 -z-10 group-hover:bg-red-500/20 transition-all" />
                            </div>
                        </div>
                        <div className="bg-stone-900/40 p-5 border border-white/5 rounded-2xl flex flex-col items-center justify-center group hover:bg-stone-900/60 transition-colors">
                            <div className="text-stone-500 text-[9px] font-black tracking-[0.2em] uppercase mb-2 group-hover:text-yellow-500/70 transition-colors">SUCCESS</div>
                            <div className="text-4xl font-black text-white">
                                {winRate}<span className="text-base text-stone-600 align-top opacity-50 ml-0.5">%</span>
                            </div>
                        </div>
                    </div>

                    {/* Performance Grid */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-[1px] flex-1 bg-stone-800/50" />
                            <h3 className="text-stone-500 font-black tracking-[0.3em] uppercase text-[9px]">Combat Analysis</h3>
                            <div className="h-[1px] flex-1 bg-stone-800/50" />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-black/40 p-4 border border-white/5 rounded-xl flex flex-col items-center justify-center group hover:border-blue-900/30 transition-all">
                                <Activity className="text-blue-500/80 mb-2 group-hover:scale-110 transition-transform" size={18} />
                                <div className="text-2xl font-black text-white leading-none">{stats.totalRounds}</div>
                                <div className="text-[8px] text-stone-600 font-bold uppercase tracking-wider mt-2">Rounds</div>
                            </div>
                            <div className="bg-black/40 p-4 border border-white/5 rounded-xl flex flex-col items-center justify-center group hover:border-red-900/30 transition-all">
                                <Target className="text-red-500/80 mb-2 group-hover:scale-110 transition-transform" size={18} />
                                <div className="text-2xl font-black text-white leading-none">{accuracy}%</div>
                                <div className="text-[8px] text-stone-600 font-bold uppercase tracking-wider mt-2">Precision</div>
                            </div>
                            <div className="bg-black/40 p-4 border border-white/5 rounded-xl flex flex-col items-center justify-center group hover:border-orange-900/30 transition-all">
                                <Swords className="text-orange-500/80 mb-2 group-hover:scale-110 transition-transform" size={18} />
                                <div className="text-2xl font-black text-white leading-none">{stats.damageDealt}</div>
                                <div className="text-[8px] text-stone-600 font-bold uppercase tracking-wider mt-2">Lethality</div>
                            </div>
                            <div className="bg-black/40 p-4 border border-white/5 rounded-xl flex flex-col items-center justify-center group hover:border-purple-900/30 transition-all">
                                <Skull className="text-purple-500/80 mb-2 group-hover:scale-110 transition-transform" size={18} />
                                <div className="text-2xl font-black text-white leading-none">{stats.highestRound}</div>
                                <div className="text-[8px] text-stone-600 font-bold uppercase tracking-wider mt-2">Tier</div>
                            </div>
                        </div>
                    </div>

                    {/* Match History */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <h3 className="text-stone-500 font-black tracking-[0.3em] uppercase text-[9px]">Recent Operations</h3>
                            <div className="h-[1px] flex-1 bg-stone-800/50" />
                        </div>
                        <div className="space-y-2">
                            {stats.matchHistory && stats.matchHistory.length > 0 ? (
                                stats.matchHistory.slice(0, 6).map((match, i) => (
                                    <div key={i} className="bg-stone-900/20 hover:bg-white/5 p-3 px-4 border border-white/5 rounded-xl flex justify-between items-center transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm border ${match.result === 'WIN' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                                {match.result === 'WIN' ? 'W' : 'L'}
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black text-stone-300 tracking-wider">
                                                        {match.isHardMode ? `DIR. ${getMatchCodename(i, true)}` : `OP. ${getMatchCodename(i, false)}`} #{i + 1}
                                                    </span>
                                                    {match.isHardMode && (
                                                        <span className="text-[7px] bg-red-950/50 text-red-500 border border-red-900/30 px-1.5 py-0.5 rounded font-black tracking-widest uppercase">Elite</span>
                                                    )}
                                                </div>
                                                <span className="text-[9px] text-stone-600 font-mono tracking-tighter uppercase">
                                                    {match.timestamp ? new Date(match.timestamp).toLocaleDateString() : 'Unknown Date'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-6 items-center">
                                            <div className="hidden sm:flex flex-col items-end">
                                                <span className="text-[8px] text-stone-600 font-bold uppercase tracking-widest">Score</span>
                                                <span className="text-sm font-black text-yellow-500/80">{match.totalScore?.toLocaleString() || 0}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[8px] text-stone-600 font-bold uppercase tracking-widest">Rounds</span>
                                                <span className="text-sm font-black text-stone-200">{match.roundsSurvived}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-stone-700 italic text-center text-[10px] py-10 bg-black/20 rounded-2xl border border-dashed border-stone-800">No operational history found in databanks.</div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-stone-800/50 bg-stone-950/40 backdrop-blur-xl flex justify-center">
                    <button
                        onClick={() => {
                            audioManager.playSound('click');
                            onClose();
                        }}
                        className="w-full py-4 bg-white text-black font-black text-xs tracking-[0.4em] active:scale-[0.98] transition-all shadow-xl hover:bg-stone-200 uppercase rounded-xl"
                    >
                        Return to Hub
                    </button>
                </div>
            </div>
        </div>
    );
};
