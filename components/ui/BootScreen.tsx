import React, { useEffect, useState } from 'react';
import { audioManager } from '../../utils/audioManager';
import { getDeviceType } from '../../utils/gameUtils';

interface BootScreenProps {
    onContinue?: () => void;
}

export const BootScreen: React.FC<BootScreenProps> = ({ onContinue }) => {
    const [bootLines, setBootLines] = useState<string[]>([]);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingComplete, setLoadingComplete] = useState(false);
    const device = getDeviceType();
    const isMobileOrTablet = device === 'mobile' || device === 'tablet';

    // Run boot sequence immediately
    useEffect(() => {
        setBootLines([]);
        setLoadingProgress(0);
        const mult = isMobileOrTablet ? 0.35 : 1.0;
        const sequence = [
            { text: "BIOS CHECK...", delay: 50 * mult },
            { text: "CPU: QUANTUM CORE... OK", delay: 100 * mult },
            { text: "MEMORY: 64TB... OK", delay: 150 * mult },
            { text: "LOADING KERNEL...", delay: 200 * mult },
            { text: "MOUNTING VOLUMES...", delay: 250 * mult },
            { text: "INITIALIZING AI DEALER...", delay: 300 * mult },
            { text: "SYSTEM READY.", delay: 350 * mult }
        ];
        let timeouts: ReturnType<typeof setTimeout>[] = [];
        sequence.forEach(({ text, delay }) => {
            timeouts.push(setTimeout(() => {
                setBootLines(prev => [...prev, text]);
            }, delay));
        });

        // Mark loading as complete after progress bar fills
        const tickRate = isMobileOrTablet ? 25 : 50;
        const interval = setInterval(() => {
            setLoadingProgress(p => {
                if (p >= 100) {
                    clearInterval(interval);
                    setTimeout(() => {
                        if (onContinue) onContinue();
                    }, isMobileOrTablet ? 150 : 300);
                    return 100;
                }
                return p + 10;
            });
        }, tickRate);

        return () => {
            timeouts.forEach(clearTimeout);
            clearInterval(interval);
        };
    }, [isMobileOrTablet]);

    // Boot sequence screen
    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col justify-between p-4 md:p-12 font-mono select-none transform translate3d(0,0,0)">
            <div className="flex justify-between items-start text-stone-600 text-[9px] sm:text-xs">
                <span>AADISH_OS v1.0.0</span>
                <span>MEM: 65536KB OK</span>
            </div>
            <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full gap-2 sm:gap-4 my-auto">
                <div className="text-green-500 text-[9px] sm:text-xs md:text-sm space-y-1.5 h-[35vh] max-h-[10rem] sm:max-h-[12rem] overflow-hidden flex flex-col justify-end">
                    {bootLines.map((line, i) => (
                        <div key={i} className="typewriter truncate text-green-400 drop-shadow-[0_0_4px_rgba(74,222,128,0.4)] shrink-0 leading-normal tracking-wider">
                            {`> ${line}`}
                        </div>
                    ))}
                    <div className="text-green-400 animate-pulse drop-shadow-[0_0_4px_rgba(74,222,128,0.4)] shrink-0 leading-normal tracking-wider">_</div>
                </div>
                <div className="w-full h-2 bg-stone-900 border border-stone-850 p-0.5 relative rounded-sm overflow-hidden shadow-inner">
                    <div 
                        className="h-full bg-green-700 relative overflow-hidden transition-all duration-100 ease-out will-change-[width] rounded-sm" 
                        style={{ width: `${Math.min(100, loadingProgress)}%`, transform: 'translate3d(0,0,0)' }} 
                    />
                </div>
            </div>
        </div>
    );
};
