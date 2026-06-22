import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface LoadingScreenProps {
    onComplete: () => void;
    onBack?: () => void;
    text?: string;
    duration?: number;
    error?: string | null;
    onRetry?: () => void;
    showClose?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
    onComplete,
    onBack,
    text: initialText = "INITIALIZING SYSTEM...",
    duration = 3000,
    error,
    onRetry,
    showClose = false
}) => {
    const [progress, setProgress] = useState(0);
    const [terminalLines, setTerminalLines] = useState<string[]>([]);
    const [warningText, setWarningText] = useState("UNAUTHORIZED ACCESS IS PUNISHABLE BY DEATH");

    useEffect(() => {
        const warnings = [
            "UNAUTHORIZED ACCESS IS PUNISHABLE BY DEATH",
            "THE SHELL DOES NOT DISCRIMINATE",
            "TRUST IS A DECREASING RESOURCE",
            "THE DEALER IS ALWAYS WATCHING",
            "DOUBLE OR NOTHING IS YOUR ONLY WAY OUT",
            "LIVE OR BLANK: DECIDE",
            "MIND THE SAW. IT BITES.",
            "NO QUANTUM IMMORTALITY ALLOWED",
            "LIABILITY WAIVER: SIGNED AND SIGNED AGAIN",
            "YOUR BRAINWAVES ARE BEING MONITORED",
            "DEVIATION FROM PROTOCOL RESULTS IN IMMEDIATE TERMINATION",
            "SURRENDER IS NOT AN OPTION IN THIS BUNKER",
            "THE CONTRACT IS BINDING. SOULS ARE NON-REFUNDABLE.",
            "KEEP YOUR FINGERS CLEAR OF THE RECEIVER",
            "THE ODDS ARE EQUAL, THE CONSEQUENCES ARE NOT"
        ];
        const randomWarning = warnings[Math.floor(Math.random() * warnings.length)];
        setWarningText(randomWarning);
    }, []);

    // Progress Timer Effect
    useEffect(() => {
        if (error) return; 
        const startTime = Date.now();
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const prog = Math.min((elapsed / duration) * 100, 100);
            setProgress(prog);

            if (prog >= 100) {
                clearInterval(interval);
                setTimeout(onComplete, 500);
            }
        }, 30);

        return () => clearInterval(interval);
    }, [duration, onComplete, error]);

    // Terminal Lines Effect
    useEffect(() => {
        const lines = [
            "BOOT_SEQ: 0x4F229A",
            "SCANNING_CORE_MEMORY...",
            "ALLOCATING_NEURAL_NET_BUFFERS...",
            "ESTABLISHING_TABLE_HYDRAULICS...",
            "CHECKING_AMMUNITION_INTEGRITY...",
            "VERIFYING_DEALER_HANDSHAKE_v4...",
            "INITIALIZING_PHYSICS_ENGINE...",
            "CALIBRATING_RNG_SEED_STREAM...",
            "SYNCING_AUDIO_DRIVERS...",
            "ENABLING_LIFELINE_MONITOR...",
            "CORE_BOOT_COMPLETE. READY TO INJECT."
        ];

        let current = 0;
        const lineInterval = setInterval(() => {
            if (current < lines.length) {
                setTerminalLines(prev => [...prev, `> ${lines[current]}`].slice(-18));
                current++;
            }
        }, duration / lines.length);

        return () => clearInterval(lineInterval);
    }, [duration]);

    return (
        <div className="flex flex-col items-center justify-center w-full h-full bg-black text-green-500 z-[300] absolute inset-0 font-mono crt overflow-hidden select-none">
            {showClose && onBack && !error && (
                <button
                    onClick={onBack}
                    className="absolute top-6 right-6 z-[320] bg-black/60 hover:bg-stone-900 border border-green-900/60 hover:border-green-500 text-green-500 hover:text-green-300 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 active:scale-95 cursor-pointer shadow-[0_0_15px_rgba(34,197,94,0.1)] group"
                    title="Go Back"
                >
                    <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                </button>
            )}

            {/* Ambient Background Grid Tech */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#052e16_1px,transparent_1px),linear-gradient(to_bottom,#052e16_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-25 pointer-events-none" />

            {/* Background Terminal Feed */}
            <div className="absolute inset-0 opacity-15 pointer-events-none p-4 font-mono text-[9px] sm:text-xs leading-relaxed max-w-2xl mx-auto hidden sm:flex flex-col justify-start h-2/3 mt-6">
                {terminalLines.map((line, i) => (
                    <div key={i} className="mb-1 tracking-wider font-semibold animate-in fade-in slide-in-from-left duration-200">
                        {line}
                    </div>
                ))}
            </div>

            {/* Scanline Overlay Grid */}
            <div className="scan-line !opacity-[0.12] pointer-events-none" />

            {/* Main Center Console Loading UI */}
            <div className={`relative z-10 flex flex-col items-center w-[90vw] max-w-md p-5 sm:p-8 rounded-2xl border border-green-950/40 bg-black/70 backdrop-blur-md transition-all duration-500 transform translate3d(0,0,0) will-change-transform ${error ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 scale-100'}`}>
                {/* Visual Accent Ticks */}
                <div className="absolute top-4 left-4 w-3 h-3 border-t-2 border-l-2 border-green-700/40" />
                <div className="absolute top-4 right-4 w-3 h-3 border-t-2 border-r-2 border-green-700/40" />
                <div className="absolute bottom-4 left-4 w-3 h-3 border-b-2 border-l-2 border-green-700/40" />
                <div className="absolute bottom-4 right-4 w-3 h-3 border-b-2 border-r-2 border-green-700/40" />

                <div className="text-lg sm:text-3xl font-black tracking-[0.25em] mb-6 sm:mb-8 text-center uppercase text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]">
                    {initialText}
                </div>

                {/* Progress Bar Frame */}
                <div className="w-full max-w-xs sm:max-w-md h-5 sm:h-6 border-2 border-green-800 bg-stone-950 p-0.5 relative rounded-sm overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)]">
                    <div
                        className="h-full bg-gradient-to-r from-green-600 to-green-400 shadow-[0_0_20px_rgba(34,197,94,0.7)] transition-all duration-75 ease-out rounded-sm relative will-change-[width]"
                        style={{ width: `${progress}%`, transform: 'translate3d(0,0,0)' }}
                    >
                        {/* Segment Stripes for Premium Feel */}
                        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_50%,rgba(0,0,0,0.4)_50%)] bg-[size:8px_100%]" />
                    </div>
                    {/* Glass sheen reflection */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent pointer-events-none" />
                </div>

                {/* Performance Matrix Readout */}
                <div className="mt-4 sm:mt-6 flex items-baseline gap-1.5 font-black text-lg sm:text-2xl tracking-[0.1em]">
                    <span className="text-green-600 text-xs font-bold">SYS_LOAD:</span>
                    <span>{Math.round(progress)}</span>
                    <span className="text-xs text-green-600 font-bold">%</span>
                </div>

                <div className="mt-6 sm:mt-8 text-[9px] sm:text-xs text-green-700/90 font-black tracking-[0.2em] uppercase text-center max-w-xs leading-relaxed animate-pulse border-t border-green-950/60 pt-3 w-full">
                    {warningText}
                </div>
            </div>

            {/* High-Fidelity Error UI Overlay */}
            {error && (
                <div className="absolute inset-0 z-[310] flex flex-col items-center justify-center bg-black/95 p-6 animate-in fade-in duration-500">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.1)_0%,transparent_65%)] pointer-events-none" />
                    
                    <div className="max-w-md w-full border border-red-900/60 bg-stone-950/80 p-8 rounded-2xl shadow-[0_0_80px_rgba(220,38,38,0.15)] flex flex-col items-center text-center relative font-mono">
                        <div className="absolute top-4 left-4 w-3 h-3 border-t border-l border-red-500/40" />
                        <div className="absolute top-4 right-4 w-3 h-3 border-t border-r border-red-500/40" />
                        
                        <div className="text-red-500 mb-6 flex flex-col items-center gap-2">
                            <div className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic drop-shadow-[0_0_15px_rgba(220,38,38,0.6)] animate-pulse">
                                LINK_FAULT
                            </div>
                            <div className="text-[10px] text-stone-500 font-bold uppercase tracking-[0.4em] mt-1">
                                Critical Protocol Aborted
                            </div>
                        </div>

                        <div className="w-full text-xs text-red-400 border border-red-950 bg-red-950/20 px-4 py-3.5 rounded-xl uppercase tracking-widest leading-relaxed mb-8 break-all max-h-32 overflow-y-auto font-bold select-text scrollbar-thin">
                            {error}
                        </div>

                        <div className="flex flex-col gap-3 w-full">
                            <button
                                onClick={onRetry}
                                className="h-13 bg-gradient-to-r from-green-950/60 to-green-900/40 hover:from-green-900 hover:to-green-700 text-green-400 hover:text-white border border-green-800/60 hover:border-green-500 font-bold uppercase tracking-[0.25em] text-xs transition-all rounded-xl active:scale-98 cursor-pointer shadow-lg hover:shadow-[0_0_20px_rgba(34,197,94,0.2)] flex items-center justify-center"
                            >
                                RETRY_CONNECTION
                            </button>
                            <button
                                onClick={onBack}
                                className="h-11 bg-transparent hover:bg-stone-900/50 border border-stone-800 hover:border-stone-600 text-stone-500 hover:text-stone-300 font-bold uppercase tracking-[0.25em] text-[10px] transition-all rounded-xl active:scale-98 cursor-pointer"
                            >
                                TERMINATE_INSTANCE
                            </button>
                        </div>

                        <div className="mt-8 text-[8px] text-stone-600 font-mono text-center max-w-xs uppercase leading-normal border-t border-stone-900 pt-4 w-full">
                            Emergency hard separation engaged. Check hardware configuration parameters or contact server proxy.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};