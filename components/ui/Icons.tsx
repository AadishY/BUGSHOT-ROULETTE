import React from 'react';
import { Beer, Link, Cigarette, Search, Zap, Crosshair, ShieldAlert, Heart, RefreshCcw, Smartphone, Syringe, Hammer } from 'lucide-react';

export const ChainsawIcon = ({ className, size = 24 }: { className?: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Handle */}
    <path d="M4 7c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h2v-8H4z" />
    <path d="M6 9v4" />
    {/* Blade Spine */}
    <path d="M6 7l14-2v4" />
    {/* Teeth */}
    <path d="M6 15l2 2 2-2 2 2 2-2 2 2 2-2 2 2" />
    {/* Blade Tip Connection */}
    <path d="M20 9v8l-2-2" />
  </svg>
);

export const ChokeIcon = ({ className, size = 24 }: { className?: string; size?: number }) => (
  // Looks like a barrel extension / muzzle brake
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="8" y="2" width="8" height="20" rx="1" />
    <line x1="8" y1="6" x2="16" y2="6" />
    <line x1="8" y1="10" x2="16" y2="10" />
    <line x1="8" y1="14" x2="16" y2="14" />
    <line x1="8" y1="18" x2="16" y2="18" />
    <path d="M4 12h4" />
    <path d="M16 12h4" />
  </svg>
);

// Or better, create a custom stylized one
export const RemoteIcon = ({ className, size = 24 }: { className?: string; size?: number }) => (
  // Simple Remote Control Shape
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="7" y="2" width="10" height="20" rx="2" />
    <circle cx="12" cy="6" r="1.5" />
    <rect x="10" y="10" width="4" height="2" />
    <rect x="10" y="14" width="4" height="2" />
    <path d="M12 18v.01" />
  </svg>
);

export const BigInverterIcon = ({ className, size = 24 }: { className?: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M12 2v20" />
    <path d="M8 10l-2 4h4l-2 4" /> {/* Lightning left */}
    <path d="M18 10l-2 4h4l-2 4" /> {/* Lightning right */}
  </svg>
);

export const ContractIcon = ({ className, size = 24 }: { className?: string; size?: number }) => (
  // Visual: A blood-stained document / pact
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    {/* Blood drop */}
    <path d="M12 6c0 0-2 2.5-2 4a2 2 0 0 0 4 0c0-1.5-2-4-2-4z" fill="currentColor" stroke="none" />
  </svg>
);

export const ShotgunShellIcon = ({ className, size = 24 }: { className?: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Brass base */}
    <path d="M8 17h8v3a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-3z" fill="currentColor" fillOpacity="0.25" />
    {/* Body */}
    <rect x="8" y="3" width="8" height="14" rx="1" />
    {/* Ridges on body */}
    <line x1="10" y1="7" x2="14" y2="7" />
    <line x1="10" y1="11" x2="14" y2="11" />
    {/* Connection rim line */}
    <line x1="8" y1="17" x2="16" y2="17" />
  </svg>
);

export const CloverIcon = ({ className, size = 24 }: { className?: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Stem */}
    <path d="M12 17c0 2 1 4 3 5" />
    {/* Four leaves */}
    <path d="M12 12c-2-2-4-2-4 0 0 1.5 2 2 4 0z" fill="currentColor" fillOpacity="0.2" />
    <path d="M12 12c2-2 4-2 4 0 0 1.5-2 2-4 0z" fill="currentColor" fillOpacity="0.2" />
    <path d="M12 12c-2 2-2 4 0 4 1.5 0 2-2 0-4z" fill="currentColor" fillOpacity="0.2" />
    <path d="M12 12c2 2 2 4 0 4-1.5 0-2-2 0-4z" fill="currentColor" fillOpacity="0.2" />
  </svg>
);

export const FlashbangIcon = ({ className, size = 24 }: { className?: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="8" y="7" width="8" height="14" rx="2" fill="currentColor" fillOpacity="0.2" />
    <rect x="10" y="3" width="4" height="4" rx="0.5" />
    <circle cx="7" cy="4" r="2" />
    <path d="M14 5h2v6" />
    <circle cx="10" cy="11" r="0.5" fill="currentColor" />
    <circle cx="14" cy="11" r="0.5" fill="currentColor" />
    <circle cx="10" cy="15" r="0.5" fill="currentColor" />
    <circle cx="14" cy="15" r="0.5" fill="currentColor" />
  </svg>
);

export const TotemIcon = ({ className, size = 24 }: { className?: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Totem of Undying boxy shape */}
    {/* Head */}
    <rect x="8" y="2" width="8" height="6" rx="1" fill="currentColor" fillOpacity="0.35" />
    {/* Nose */}
    <rect x="11" y="5" width="2" height="3" rx="0.5" fill="currentColor" />
    {/* Eyes (Green emeralds) */}
    <rect x="9.5" y="4" width="1.5" height="1" fill="#00ff66" stroke="none" />
    <rect x="13" y="4" width="1.5" height="1" fill="#00ff66" stroke="none" />
    {/* Body */}
    <rect x="9" y="8" width="6" height="8" rx="1" fill="currentColor" fillOpacity="0.25" />
    {/* Wings / Arms */}
    <path d="M9 10H5v2l4 1" fill="currentColor" fillOpacity="0.45" />
    <path d="M15 10h4v2l-4 1" fill="currentColor" fillOpacity="0.45" />
    {/* Bottom Base */}
    <rect x="7" y="16" width="10" height="2" rx="0.5" fill="currentColor" />
  </svg>
);

export const MirrorIcon = ({ className, size = 24 }: { className?: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <ellipse cx="12" cy="9" rx="6" ry="7" fill="currentColor" fillOpacity="0.2" />
    <path d="M10 5.5c2.5-1 4.5 1 5 3.5" strokeWidth="1.5" strokeOpacity="0.6" />
    <path d="M12 16v6" strokeWidth="2.5" />
    <path d="M10 22h4" />
    <path d="M9 16c1.5.5 4.5.5 6 0" />
  </svg>
);

export const DeckCardIcon = ({ className, size = 24 }: { className?: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="6" width="11" height="15" rx="1.5" transform="rotate(-10 3 6)" fill="currentColor" fillOpacity="0.1" />
    <rect x="6" y="4" width="11" height="15" rx="1.5" transform="rotate(-5 6 4)" fill="currentColor" fillOpacity="0.15" />
    <rect x="9" y="3" width="11" height="15" rx="1.5" fill="currentColor" fillOpacity="0.2" />
    <path d="M14.5 7.5l.8 1.8 1.9.3-1.4 1.3.3 1.9-1.6-1-1.6 1 .3-1.9-1.4-1.3 1.9-.3z" strokeWidth="1" />
  </svg>
);

export const Icons = {
  Beer,
  Cuffs: Link,
  Cigs: Cigarette,
  Glass: Search,
  Saw: ChainsawIcon,
  Zap,
  Crosshair,
  ShieldAlert,
  Heart,
  RefreshCcw,
  Phone: Smartphone,
  Inverter: Zap,
  Adrenaline: Syringe,
  Choke: ChokeIcon,
  Remote: RemoteIcon,
  BigInverter: BigInverterIcon,
  Contract: ContractIcon,
  Luckycharm: CloverIcon,
  Flashbang: FlashbangIcon,
  Crusher: Hammer,
  Totem: TotemIcon,
  Mirror: MirrorIcon,
  DeckCard: DeckCardIcon,
  Shell: ShotgunShellIcon
};

