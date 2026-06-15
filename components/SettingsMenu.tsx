import React, { useState, useEffect } from 'react';
import { GameSettings } from '../types';
import { X, Monitor, Scaling, Eye, RotateCcw, LogOut } from 'lucide-react';

interface SettingsMenuProps {
    settings: GameSettings;
    onUpdateSettings: (newSettings: GameSettings) => void;
    onClose: () => void;
    onResetDefaults: () => void;
    onExitToMenu?: () => void;
    showExitToMenu?: boolean;
}

// Custom Slider Component to prevent accidental clicks
const CustomSlider: React.FC<{
    min: number;
    max: number;
    step: number;
    value: number;
    onChange: (val: number) => void;
}> = ({ min, max, step, value, onChange }) => {
    const trackRef = React.useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);

    const updateValue = (clientX: number) => {
        if (!trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        const percent = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        const rawValue = min + percent * (max - min);
        // Stick to step
        const steppedValue = Math.round(rawValue / step) * step;
        const clampedValue = Math.min(max, Math.max(min, steppedValue));
        onChange(clampedValue);
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        // Only allow dragging if clicking the thumb area
        e.preventDefault(); // Prevent scrolling while dragging
        setIsDragging(true);
        const target = e.target as HTMLElement;
        target.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        updateValue(e.clientX);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        const target = e.target as HTMLElement;
        target.releasePointerCapture(e.pointerId);
    };

    // Calculate percent for visual rendering
    const percent = ((value - min) / (max - min)) * 100;

    return (
        <div
            className="relative w-full h-6 flex items-center touch-none select-none"
            ref={trackRef}
        >
            {/* Track Background */}
            <div className="absolute w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
                {/* Fill */}
                <div
                    className="h-full bg-stone-600"
                    style={{ width: `${percent}%` }}
                />
            </div>

            {/* Thumb - The Red Dot */}
            <div
                className="absolute w-5 h-5 bg-red-600 rounded-full border-2 border-stone-200 cursor-grab active:cursor-grabbing shadow-lg shadow-black/50 z-10 hover:scale-110 transition-transform"
                style={{ left: `calc(${percent}% - 10px)` }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
            // touch-action none is important for the thumb to prevent browser scrolling while dragging
            />
        </div>
    );
};

export const SettingsMenu: React.FC<SettingsMenuProps> = ({ settings, onUpdateSettings, onClose, onResetDefaults, onExitToMenu, showExitToMenu }) => {
    const handleChange = (key: keyof GameSettings, value: number | boolean) => {
        onUpdateSettings({ ...settings, [key]: value });
    };

    return (
        <div className="fixed inset-0 z-[250] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md p-2 sm:p-4 overflow-y-auto custom-scrollbar">
            <div
                className="w-[85vw] h-[85vh] max-w-[85vw] max-h-[85vh] bg-stone-950/45 backdrop-blur-2xl border border-stone-850 shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative flex flex-col overflow-hidden rounded-2xl ring-1 ring-white/5 my-auto"
            >
                {/* Decorative */}
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-stone-500/20 to-transparent" />

                {/* Header */}
                <div className="p-3 sm:p-4 border-b border-stone-800/50 flex justify-between items-center bg-stone-950/20">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-stone-900/60 rounded-xl border border-stone-800 flex items-center justify-center text-stone-400">
                            <Monitor size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm sm:text-base font-black text-white tracking-[0.2em] uppercase leading-tight">SETTINGS</h2>
                            <p className="text-[8px] sm:text-[9px] text-stone-500 font-bold tracking-[0.4em] uppercase">Display & Audio</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-stone-500 hover:text-white hover:bg-white/5 rounded-full transition-all active:scale-95 cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-5 custom-scrollbar">

                    {/* Visuals Group */}
                    <div className="space-y-3 sm:space-y-4">
                        <div className="flex items-center gap-2">
                            <h3 className="text-stone-500 font-extrabold tracking-[0.2em] uppercase text-[9px] sm:text-[10px]">Graphics</h3>
                            <div className="h-[1px] flex-1 bg-stone-800/30" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 sm:gap-y-4">
                            {/* Pixelation */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-end">
                                    <span className="text-stone-300 font-bold tracking-widest text-[9px] sm:text-[10px] uppercase">Resolution</span>
                                    <span className="text-white font-black text-[10px] tabular-nums bg-stone-900 px-1.5 py-0.5 rounded border border-white/5">{settings.pixelScale.toFixed(1)}x</span>
                                </div>
                                <CustomSlider
                                    min={1} max={6} step={0.5}
                                    value={settings.pixelScale}
                                    onChange={(val) => handleChange('pixelScale', val)}
                                />
                            </div>

                            {/* Brightness */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-end">
                                    <span className="text-stone-300 font-bold tracking-widest text-[9px] sm:text-[10px] uppercase">Brightness</span>
                                    <span className="text-white font-black text-[10px] tabular-nums bg-stone-900 px-1.5 py-0.5 rounded border border-white/5">{(settings.brightness * 100).toFixed(0)}%</span>
                                </div>
                                <CustomSlider
                                    min={0.1} max={2.0} step={0.1}
                                    value={settings.brightness}
                                    onChange={(val) => handleChange('brightness', val)}
                                />
                            </div>

                            {/* HUD Scale */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-end">
                                    <span className="text-stone-300 font-bold tracking-widest text-[9px] sm:text-[10px] uppercase">HUD Scale</span>
                                    <span className="text-white font-black text-[10px] tabular-nums bg-stone-900 px-1.5 py-0.5 rounded border border-white/5">{settings.uiScale.toFixed(2)}x</span>
                                </div>
                                <CustomSlider
                                    min={0.6} max={1.4} step={0.1}
                                    value={settings.uiScale}
                                    onChange={(val) => handleChange('uiScale', val)}
                                />
                            </div>

                            {/* FOV */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-end">
                                    <span className="text-stone-300 font-bold tracking-widest text-[9px] sm:text-[10px] uppercase">Field of View</span>
                                    <span className="text-white font-black text-[10px] tabular-nums bg-stone-900 px-1.5 py-0.5 rounded border border-white/5">{settings.fov || 85}°</span>
                                </div>
                                <CustomSlider
                                    min={60} max={110} step={1}
                                    value={settings.fov || 85}
                                    onChange={(val) => handleChange('fov', val)}
                                />
                            </div>
                        </div>

                        {/* Graphics Quality Profile Selector */}
                        <div className="p-3 bg-stone-950/65 border border-stone-850 rounded-xl space-y-2">
                            <div>
                                <span className="text-stone-300 font-bold tracking-widest text-[9px] sm:text-[10px] uppercase block">Graphics Quality Profile</span>
                                <span className="text-[8px] sm:text-[9px] text-stone-500 font-bold uppercase tracking-wider block mt-0.5">Select performance layout optimized for your device hardware.</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onUpdateSettings({
                                            ...settings,
                                            ultraPerformance: false,
                                            balancedPerformance: false
                                        });
                                    }}
                                    className={`py-2 text-[9px] sm:text-[10px] font-black tracking-widest uppercase transition-all rounded-lg border active:scale-95 cursor-pointer ${(!settings.ultraPerformance && !settings.balancedPerformance) ? 'bg-red-950/20 text-red-400 border-red-800/50 shadow-[0_0_12px_rgba(220,38,38,0.2)]' : 'bg-transparent text-stone-400 border-stone-850 hover:bg-stone-900/60'}`}
                                >
                                    High Quality
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onUpdateSettings({
                                            ...settings,
                                            ultraPerformance: false,
                                            balancedPerformance: true
                                        });
                                    }}
                                    className={`py-2 text-[9px] sm:text-[10px] font-black tracking-widest uppercase transition-all rounded-lg border active:scale-95 cursor-pointer ${(settings.balancedPerformance) ? 'bg-amber-955/20 text-amber-400 border-amber-800/50 shadow-[0_0_12px_rgba(245,158,11,0.2)]' : 'bg-transparent text-stone-400 border-stone-850 hover:bg-stone-900/60'}`}
                                >
                                    Balanced
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onUpdateSettings({
                                            ...settings,
                                            ultraPerformance: true,
                                            balancedPerformance: false
                                        });
                                    }}
                                    className={`py-2 text-[9px] sm:text-[10px] font-black tracking-widest uppercase transition-all rounded-lg border active:scale-95 cursor-pointer ${(settings.ultraPerformance) ? 'bg-orange-955/20 text-orange-400 border-orange-800/50 shadow-[0_0_12px_rgba(249,115,22,0.2)]' : 'bg-transparent text-stone-400 border-stone-850 hover:bg-stone-900/60'}`}
                                >
                                    Potato (Ultra)
                                </button>
                            </div>
                            <p className="text-[7.5px] sm:text-[8px] text-stone-500 uppercase tracking-widest leading-relaxed">
                                {(!settings.ultraPerformance && !settings.balancedPerformance) && "• High Quality: Full dynamic PBR shaders, detailed texture maps, soft shadows, volumetric lighting."}
                                {(settings.balancedPerformance) && "• Balanced: Medium pixelation, textures active, no shadow rendering overhead. Optimized for most mid-range systems."}
                                {(settings.ultraPerformance) && "• Potato (Ultra): Low-poly unshaded flat materials, disabled post-processing, low resolution. Built for 60FPS on low-end hardware."}
                            </p>
                        </div>
                    </div>

                    {/* Audio Group */}
                    <div className="space-y-3 sm:space-y-4">
                        <div className="flex items-center gap-2">
                            <h3 className="text-stone-500 font-extrabold tracking-[0.2em] uppercase text-[9px] sm:text-[10px]">Sound</h3>
                            <div className="h-[1px] flex-1 bg-stone-800/30" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 sm:gap-y-4">
                            {/* Music Volume */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-end">
                                    <span className="text-stone-300 font-bold tracking-widest text-[9px] sm:text-[10px] uppercase">Music</span>
                                    <span className="text-white font-black text-[10px] tabular-nums bg-stone-900 px-1.5 py-0.5 rounded border border-white/5">{Math.round((settings.musicVolume ?? 0.5) * 100)}%</span>
                                </div>
                                <CustomSlider
                                    min={0} max={1} step={0.1}
                                    value={settings.musicVolume ?? 0.5}
                                    onChange={(val) => handleChange('musicVolume', val)}
                                />
                            </div>

                            {/* SFX Volume */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-end">
                                    <span className="text-stone-300 font-bold tracking-widest text-[9px] sm:text-[10px] uppercase">Effects</span>
                                    <span className="text-white font-black text-[10px] tabular-nums bg-stone-900 px-1.5 py-0.5 rounded border border-white/5">{Math.round((settings.sfxVolume ?? 0.7) * 100)}%</span>
                                </div>
                                <CustomSlider
                                    min={0} max={1} step={0.1}
                                    value={settings.sfxVolume ?? 0.7}
                                    onChange={(val) => handleChange('sfxVolume', val)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Debug Group */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <h3 className="text-red-500 font-extrabold tracking-[0.2em] uppercase text-[9px] sm:text-[10px]">Developer</h3>
                            <div className="h-[1px] flex-1 bg-red-950/30" />
                        </div>

                        <div className="flex items-center justify-between p-3 bg-red-950/10 border border-red-900/30 rounded-xl">
                            <div>
                                <span className="text-stone-300 font-bold tracking-widest text-[9px] sm:text-[10px] uppercase block">Debug Overlay</span>
                                <span className="text-[8px] sm:text-[9px] text-stone-500 font-bold uppercase tracking-wider block mt-0.5">Enables cheats, item management, and chamber editor</span>
                                {(() => {
                                    const loggedInUser = localStorage.getItem('aadish_roulette_logged_in_user');
                                    let isDev = false;
                                    if (loggedInUser) {
                                        try {
                                            const u = JSON.parse(loggedInUser);
                                            isDev = u.username?.toLowerCase() === (import.meta.env.VITE_DEV_USERNAME || 'aadish').toLowerCase();
                                        } catch(e) {}
                                    }
                                    return isDev ? (
                                        <span className="text-[8px] text-green-500 font-extrabold uppercase tracking-wider block mt-1">
                                            ✓ DEVELOPER: STATS WILL BE SAVED
                                        </span>
                                    ) : (
                                        <span className="text-[8px] text-red-500 font-extrabold uppercase tracking-wider block mt-1 animate-pulse">
                                            ⚠ WARNING: STATS WILL NOT BE SAVED IN THIS MATCH
                                        </span>
                                    );
                                })()}
                            </div>
                            <button
                                onClick={() => handleChange('debugMode', !settings.debugMode)}
                                className={`px-3 py-1.5 text-[9px] sm:text-[10px] font-black tracking-widest uppercase transition-all rounded-lg border active:scale-95 cursor-pointer ${settings.debugMode ? 'bg-red-600 hover:bg-red-500 text-white border-red-500' : 'bg-transparent hover:bg-stone-900 text-stone-400 border-stone-800'}`}
                            >
                                {settings.debugMode ? 'Enabled' : 'Disabled'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-3 sm:p-4 border-t border-stone-800/50 bg-stone-950/40 backdrop-blur-xl flex flex-row gap-2.5 sm:gap-3 shrink-0">
                    <button onClick={onResetDefaults} className="flex-1 h-10 border border-stone-800 text-stone-500 hover:text-white hover:bg-white/5 px-3 font-black tracking-[0.2em] flex items-center justify-center gap-1.5 transition-all rounded-xl text-[9px] sm:text-[10px] uppercase cursor-pointer">
                        <RotateCcw size={12} /> Reset
                    </button>
                    {showExitToMenu && onExitToMenu && (
                        <button onClick={onExitToMenu} className="flex-1 h-10 border border-red-900/50 bg-red-950/20 text-red-500 hover:text-red-400 hover:bg-red-950/40 hover:border-red-770/50 px-3 font-black tracking-[0.2em] flex items-center justify-center gap-1.5 transition-all rounded-xl text-[9px] sm:text-[10px] uppercase cursor-pointer">
                            <LogOut size={12} /> Exit
                        </button>
                    )}
                    <button onClick={onClose} className="flex-[1.5] h-10 bg-white text-black font-black px-4 hover:bg-stone-200 transition-all tracking-[0.25em] rounded-xl text-[10px] sm:text-xs uppercase shadow-xl cursor-pointer">
                        Return to Game
                    </button>
                </div>
            </div>
        </div>
    );
};