import React, { useRef, useState, useEffect } from 'react';
import { LogEntry } from '../../types';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface LogsDisplayProps {
    logs: LogEntry[];
}

export const LogsDisplay: React.FC<LogsDisplayProps> = ({ logs }) => {
    const [isLogsOpen, setIsLogsOpen] = useState(false);
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isLogsOpen && logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [logs, isLogsOpen]);

    return (
        <div className={`w-1/3 md:w-1/3 transition-all duration-300 flex flex-col pointer-events-auto shadow-lg backdrop-blur-md border border-stone-800 bg-black/80 ${isLogsOpen ? 'h-full' : 'h-5 md:h-10'}`}>
            <div onClick={() => setIsLogsOpen(!isLogsOpen)} className="flex items-center justify-between p-1 md:p-2 cursor-pointer bg-stone-900 border-b border-stone-800 hover:bg-stone-800 transition-colors">
                <span className="text-[8px] md:text-xs font-bold tracking-widest text-stone-400">LOG</span>
                {isLogsOpen ? <ChevronDown size={8} /> : <ChevronUp size={8} />}
            </div>
            {isLogsOpen && (
                <div className="flex-1 overflow-y-auto font-mono text-[8px] md:text-sm p-1 md:p-4 flex flex-col justify-end">
                    <div>
                        {logs.map(log => (
                            <div key={log.id} className={`mb-0.5 md:mb-1 ${log.type === 'danger' ? 'text-red-500' : log.type === 'safe' ? 'text-green-500' : log.type === 'info' ? 'text-cyan-400' : log.type === 'dealer' ? 'text-amber-400 font-extrabold' : 'text-stone-500'}`}>{`> ${log.text}`}</div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            )}
        </div>
    );
};
