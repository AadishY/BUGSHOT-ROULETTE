import React, { useEffect, useState } from 'react';
import { X, Bell } from 'lucide-react';

interface AnnouncementModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({ isOpen, onClose }) => {
    const [isFrameLoaded, setIsFrameLoaded] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setIsFrameLoaded(false);
            return;
        }

        const timer = window.setTimeout(() => setIsFrameLoaded(true), 180);
        return () => window.clearTimeout(timer);
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-300">
            <div className="relative w-full max-w-3xl max-h-[95vh] bg-stone-950/95 border-2 border-stone-800/80 p-4 sm:p-6 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] font-mono flex flex-col overflow-hidden">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 text-stone-300 hover:text-red-400 bg-stone-900/60 hover:bg-red-955/30 border border-stone-850 hover:border-red-500/45 p-1.5 sm:p-2 rounded-xl z-50 cursor-pointer flex items-center justify-center shadow-lg hover:shadow-[0_0_15px_rgba(239,68,68,0.25)] transition-all"
                    title="Close Announcement"
                >
                    <X size={14} className="sm:w-[18px] sm:h-[18px]" />
                </button>

                <div className="absolute top-0 left-0 w-full h-[2px] bg-amber-500/30 animate-[scan-line-move_4s_linear_infinite]" />

                <div className="flex items-center justify-between gap-4 pb-3 border-b border-stone-900 mb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-amber-500/10 text-amber-300 rounded-2xl">
                            <Bell size={18} />
                        </div>
                        <div>
                            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.35em] text-amber-400 font-black">System Announcement</p>
                            <h2 className="text-sm sm:text-base md:text-lg font-black text-stone-100 tracking-widest">Live Broadcast Panel</h2>
                        </div>
                    </div>
                    <span className="px-2.5 py-1 text-[9px] sm:text-[10px] uppercase tracking-[0.35em] font-black bg-stone-900 border border-amber-500/30 text-amber-300 rounded-full">
                        Active
                    </span>
                </div>

                <div className="flex flex-col gap-4 overflow-y-auto pr-1.5 text-stone-300 custom-scrollbar">
                    <div className="bg-stone-900/80 border border-stone-800 p-4 rounded-3xl min-h-[180px] flex flex-col justify-center items-start gap-3">
                        <div className="text-left space-y-2">
                            <p className="text-amber-300 uppercase tracking-[0.35em] text-[10px] sm:text-[11px] font-black">NEW PLAYER MODELS</p>
                            <h3 className="text-stone-100 text-lg sm:text-xl font-black tracking-wider">Fresh character visuals are now live.</h3>
                            <p className="text-stone-400 text-sm sm:text-base leading-relaxed">
                                Dive into the updated player model lineup with enhanced animation detail, sharper textures, and a more expressive lobby presence. Watch the preview to see the new rigs in action.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <div className="relative overflow-hidden rounded-[1.5rem] border border-stone-800/90 bg-stone-950/90 shadow-[0_16px_50px_rgba(0,0,0,0.85)]">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.18),transparent_55%)] pointer-events-none" />
                            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/70 pointer-events-none" />
                            <div className="relative aspect-video w-full overflow-hidden rounded-[1.5rem] bg-stone-950">
                                {!isFrameLoaded && (
                                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-stone-950/95">
                                        <div className="flex flex-col items-center gap-3 text-center">
                                            <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-400/40 border-t-amber-300" />
                                            <p className="text-[10px] uppercase tracking-[0.35em] text-stone-400">Loading preview…</p>
                                        </div>
                                    </div>
                                )}
                                <iframe
                                    className={`absolute inset-0 h-full w-full rounded-[1.5rem] border-0 transition-opacity duration-300 ${isFrameLoaded ? 'opacity-100' : 'opacity-0'}`}
                                    src="https://www.youtube.com/embed/nwWeNF0ljNQ?si=VZKOk7WieMm5P6iK&rel=0&modestbranding=1&playsinline=1&controls=1&showinfo=0"
                                    title="New Player Models Preview"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                    loading="eager"
                                    referrerPolicy="strict-origin-when-cross-origin"
                                    onLoad={() => setIsFrameLoaded(true)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
