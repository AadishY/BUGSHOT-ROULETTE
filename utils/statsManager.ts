export interface GameStats {
    wins: number;
    losses: number;
    totalRounds: number;
    shotsFired: number;
    shotsHit: number;
    selfShots: number;
    damageDealt: number;
    itemsUsed: number;
    highestRound: number;
    matchHistory: MatchStats[];
}

export interface MatchStats {
    result: 'WIN' | 'LOSS';
    roundsSurvived: number;
    shotsFired: number;
    shotsHit: number;
    selfShots: number;
    itemsUsed: Record<string, number>;
    damageDealt: number;
    damageTaken: number;
    totalScore: number;
    timestamp?: number;
    isHardMode?: boolean;
    roundResults?: string[]; // e.g. ['WIN', 'LOSS', 'WIN']
    isMultiplayer?: boolean;
    mpPlayers?: any[];
}

const STORAGE_KEY = 'aadish_roulette_stats_v1';

const emptyStats = (): GameStats => ({
    wins: 0,
    losses: 0,
    totalRounds: 0,
    shotsFired: 0,
    shotsHit: 0,
    selfShots: 0,
    damageDealt: 0,
    itemsUsed: 0,
    highestRound: 0,
    matchHistory: []
});

const createMatchHistorySignature = (entry: any): string => {
    const normalizedItems = Object.entries(entry?.itemsUsed || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([item, count]) => `${item}:${count}`)
        .join('|');

    const mpPlayers = Array.isArray(entry?.mpPlayers)
        ? entry.mpPlayers.map((player: any) => `${player?.id || ''}:${player?.name || ''}:${player?.result || ''}`).join('~')
        : '';

    return [
        entry?.timestamp ?? '',
        entry?.result ?? '',
        entry?.roundsSurvived ?? '',
        entry?.shotsFired ?? '',
        entry?.shotsHit ?? '',
        entry?.damageDealt ?? '',
        entry?.totalScore ?? '',
        entry?.isHardMode ? 'hard' : 'normal',
        entry?.isMultiplayer ? 'mp' : 'sp',
        mpPlayers,
        normalizedItems
    ].join('|');
};


export const getStoredStats = (): GameStats => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved) || {};
            const matchHistory = Array.isArray(parsed.matchHistory) ? parsed.matchHistory : [];
            return {
                ...emptyStats(),
                ...parsed,
                matchHistory,
                shotsHit: parsed.shotsHit ?? 0
            };
        }
    } catch (e) {
        console.error("Failed to load stats", e);
    }
    return emptyStats();
};

export const calculateMatchScore = (stats: MatchStats): number => {
    let score = 0;

    // Base Score
    if (stats.result === 'WIN') {
        score += 1000;
    }
    score += stats.roundsSurvived * 100;

    // Performance
    score += stats.damageDealt * 50;
    score += stats.shotsHit * 20;

    // Item Points
    Object.values(stats.itemsUsed).forEach(count => {
        score += count * 15;
    });

    // Penalty for mistakes
    score -= stats.selfShots * 50;

    score = Math.max(0, Math.floor(score));

    // Hard Mode Multiplier
    if (stats.isHardMode) {
        score *= 2;
    }

    return score;
};

import { saveUserStatsToRedis } from './redisService';

export const mergeGameStats = (localStats?: GameStats | null, remoteStats?: GameStats | null): GameStats => {
    const base = localStats ? { ...emptyStats(), ...localStats } : emptyStats();
    const incoming = remoteStats ? { ...emptyStats(), ...remoteStats } : emptyStats();

    const mergedMatchHistory = [
        ...(base.matchHistory || []),
        ...(incoming.matchHistory || [])
    ]
        .filter((entry: any) => entry && typeof entry === 'object')
        .reduce((acc: { seen: Set<string>; entries: any[] }, entry: any) => {
            const signature = createMatchHistorySignature(entry);
            if (!signature || acc.seen.has(signature)) {
                return acc;
            }
            acc.seen.add(signature);
            acc.entries.push(entry);
            return acc;
        }, { seen: new Set<string>(), entries: [] as any[] })
        .entries.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 20);

    const totals = mergedMatchHistory.reduce((acc: GameStats, entry: any) => {
        if (entry.result === 'WIN') acc.wins += 1;
        else if (entry.result === 'LOSS') acc.losses += 1;

        acc.totalRounds += entry.roundsSurvived || 0;
        acc.shotsFired += entry.shotsFired || 0;
        acc.shotsHit += entry.shotsHit || 0;
        acc.selfShots += entry.selfShots || 0;
        acc.damageDealt += entry.damageDealt || 0;

        const itemCount = Object.values(entry.itemsUsed || {})
            .reduce((sum: number, count: any) => sum + (Number(count) || 0), 0);
        acc.itemsUsed += itemCount;
        acc.highestRound = Math.max(acc.highestRound, entry.roundsSurvived || 0);
        return acc;
    }, emptyStats());

    return {
        ...totals,
        matchHistory: mergedMatchHistory
    };
};

export const saveGameStats = async (matchStats: MatchStats): Promise<GameStats> => {
    const current = getStoredStats();

    // Update Totals
    if (matchStats.result === 'WIN') current.wins++;
    else current.losses++;

    current.totalRounds += matchStats.roundsSurvived;
    current.shotsFired += matchStats.shotsFired;
    current.shotsHit = (current.shotsHit || 0) + matchStats.shotsHit;
    current.selfShots += matchStats.selfShots;
    current.damageDealt += matchStats.damageDealt;

    // Update Item Stats
    let totalItemsMatch = 0;
    Object.entries(matchStats.itemsUsed).forEach(([item, count]) => {
        totalItemsMatch += count;
    });
    current.itemsUsed += totalItemsMatch;
    current.highestRound = Math.max(current.highestRound, matchStats.roundsSurvived);
    // itemsUsed is maintained; itemPoints and mostUsedItem removed

    // Add History
    if (!current.matchHistory) current.matchHistory = [];
    const historyEntry: MatchStats = {
        ...matchStats,
        totalScore: calculateMatchScore(matchStats), // Ensure score is set with multiplier
        timestamp: Date.now(),
        isMultiplayer: Boolean(matchStats.isMultiplayer),
        mpPlayers: matchStats.mpPlayers || []
    };
    current.matchHistory = [historyEntry, ...current.matchHistory].slice(0, 20);
    // mostUsedItem removed

    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));

    // Sync to Upstash Redis if user session is active
    const loggedInUser = localStorage.getItem('aadish_roulette_logged_in_user');
    if (loggedInUser) {
        try {
            const userObj = JSON.parse(loggedInUser);
            if (userObj && userObj.username) {
                await saveUserStatsToRedis(userObj.username, current);
            }
        } catch (e) {
            console.error("Error parsing logged-in user for Redis sync:", e);
        }
    }

    return current;
};
