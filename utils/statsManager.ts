export interface GameStats {
    wins: number;
    losses: number;
    totalRounds: number;
    shotsFired: number;
    shotsHit: number;
    selfShots: number;
    damageDealt: number;
    itemsUsed: number;
    mostUsedItem: string;
    highestRound: number;
    itemPoints: number; // Calculated score based on effective item use
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
    mostUsedItem: 'NONE',
    highestRound: 0,
    itemPoints: 0,
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
            return {
                ...emptyStats(),
                ...parsed,
                matchHistory: Array.isArray(parsed.matchHistory) ? parsed.matchHistory : [],
                shotsHit: parsed.shotsHit ?? 0,
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

    const usageTotals = new Map<string, number>();
    mergedMatchHistory.forEach((entry: any) => {
        Object.entries(entry.itemsUsed || {}).forEach(([item, count]) => {
            const parsedCount = Number(count) || 0;
            if (parsedCount > 0) {
                usageTotals.set(item, (usageTotals.get(item) || 0) + parsedCount);
            }
        });
    });

    const mostUsedItem = [...usageTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || base.mostUsedItem || incoming.mostUsedItem || 'NONE';

    return {
        wins: (base.wins || 0) + (incoming.wins || 0),
        losses: (base.losses || 0) + (incoming.losses || 0),
        totalRounds: (base.totalRounds || 0) + (incoming.totalRounds || 0),
        shotsFired: (base.shotsFired || 0) + (incoming.shotsFired || 0),
        shotsHit: (base.shotsHit || 0) + (incoming.shotsHit || 0),
        selfShots: (base.selfShots || 0) + (incoming.selfShots || 0),
        damageDealt: (base.damageDealt || 0) + (incoming.damageDealt || 0),
        itemsUsed: (base.itemsUsed || 0) + (incoming.itemsUsed || 0),
        mostUsedItem,
        highestRound: Math.max(base.highestRound || 0, incoming.highestRound || 0),
        itemPoints: (base.itemPoints || 0) + (incoming.itemPoints || 0),
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
    current.itemPoints += totalItemsMatch * 15;

    const topItem = Object.entries(matchStats.itemsUsed).reduce(
        (best, [item, count]) => count > best.count ? { item, count } : best,
        { item: current.mostUsedItem || 'NONE', count: 0 }
    );
    if (topItem.count > 0) {
        current.mostUsedItem = topItem.item;
    }

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
