import { GameStats } from './statsManager';

const DEFAULT_URL = "https://enormous-mackerel-87613.upstash.io";
const DEFAULT_TOKEN = "gQAAAAAAAVY9AAIncDFhZDhkNGNjODM5M2I0NmY5YTg5YzQwYWFhOGU3NzI2NnAxODc2MTM";

const getRedisConfig = () => {
    const url = import.meta.env.VITE_UPSTASH_REDIS_REST_URL || DEFAULT_URL;
    const token = import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN || DEFAULT_TOKEN;
    return { url, token };
};

const getBackendUrl = () => {
    if (import.meta.env.VITE_SERVER_URL) {
        return import.meta.env.VITE_SERVER_URL;
    }
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3001';
    }
    return 'https://yoakatsuki-buckshot.hf.space';
};

const checkIfDiscord = () => {
    const params = new URLSearchParams(window.location.search);
    return params.has('frame_id') || params.has('instance_id') || window.location.search.includes('platform=') || window.location.hostname.includes('discordsays.com');
};

const executeRedisCommand = async (command: any[]) => {
    const isDiscord = checkIfDiscord();
    let res;

    if (isDiscord) {
        const backendUrl = getBackendUrl();
        res = await fetch(`${backendUrl}/api/redis`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(command)
        });
    } else {
        const { url, token } = getRedisConfig();
        res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(command)
        });
    }

    if (!res.ok) {
        throw new Error(`Upstash Redis error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data.result;
};

const executeRedisPipeline = async (commands: any[][]) => {
    const isDiscord = checkIfDiscord();
    let res;

    if (isDiscord) {
        const backendUrl = getBackendUrl();
        res = await fetch(`${backendUrl}/api/redis/pipeline`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(commands)
        });
    } else {
        const { url, token } = getRedisConfig();
        res = await fetch(`${url}/pipeline`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(commands)
        });
    }

    if (!res.ok) {
        throw new Error(`Upstash Redis pipeline error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data; // returns array of response objects: [ { result: ... } ]
};

export interface UserData {
    username: string;
    passwordHash: string; // Storing plain/simple pass as requested
    stats: GameStats;
    isDeveloper?: boolean;
}

export interface LeaderboardEntry {
    username: string;
    wins: number;
    losses: number;
    hardModeWins: number;
    isDeveloper?: boolean;
    stats: GameStats;
}

export const registerUser = async (username: string, passwordHash: string): Promise<{ success: boolean; error?: string; user?: { username: string; stats: GameStats; isDeveloper?: boolean } }> => {
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || !passwordHash) {
        return { success: false, error: 'Username and password required' };
    }

    // Dev username is reserved
    const devUser = (import.meta.env.VITE_DEV_USERNAME || 'aadish').toLowerCase();
    if (cleanUsername === devUser) {
        return { success: false, error: 'Reserved developer account' };
    }

    const key = `aadishroulette:${cleanUsername}`;

    try {
        // Check if user exists
        const existingDataStr = await executeRedisCommand(['GET', key]);
        if (existingDataStr) {
            return { success: false, error: 'Username already exists' };
        }

        // Initialize new stats
        const initialStats: GameStats = {
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
        };

        const userData: UserData = {
            username: cleanUsername,
            passwordHash,
            stats: initialStats,
            isDeveloper: false
        };

        await executeRedisCommand(['SET', key, JSON.stringify(userData)]);
        return { success: true, user: { username: cleanUsername, stats: initialStats, isDeveloper: false } };
    } catch (err: any) {
        console.error("Register Redis error:", err);
        return { success: false, error: err.message || 'Connection failure' };
    }
};

export const loginUser = async (username: string, passwordHash: string): Promise<{ success: boolean; error?: string; user?: { username: string; stats: GameStats; isDeveloper?: boolean } }> => {
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || !passwordHash) {
        return { success: false, error: 'Username and password required' };
    }

    const key = `aadishroulette:${cleanUsername}`;
    const devUser = (import.meta.env.VITE_DEV_USERNAME || 'aadish').toLowerCase();
    const devPass = import.meta.env.VITE_DEV_PASSWORD || 'Aadish20m';

    // Handle Predefined Developer Account
    if (cleanUsername === devUser) {
        if (passwordHash === devPass) {
            let stats: GameStats = {
                wins: 0, losses: 0, totalRounds: 0, shotsFired: 0, shotsHit: 0,
                selfShots: 0, damageDealt: 0, itemsUsed: 0, mostUsedItem: 'NONE',
                highestRound: 0, itemPoints: 0, matchHistory: []
            };
            try {
                const existingDataStr = await executeRedisCommand(['GET', key]);
                if (existingDataStr) {
                    const userData: UserData = JSON.parse(existingDataStr);
                    stats = userData.stats || stats;
                }
                const userData: UserData = {
                    username: cleanUsername,
                    passwordHash,
                    stats,
                    isDeveloper: true
                };
                await executeRedisCommand(['SET', key, JSON.stringify(userData)]);
            } catch (e) {
                console.error("Failed to seed developer in Redis:", e);
            }
            return { success: true, user: { username: 'Aadish', stats, isDeveloper: true } };
        } else {
            return { success: false, error: 'Invalid password' };
        }
    }

    try {
        const existingDataStr = await executeRedisCommand(['GET', key]);
        if (!existingDataStr) {
            return { success: false, error: 'Username not found' };
        }

        const userData: UserData = JSON.parse(existingDataStr);
        if (userData.passwordHash !== passwordHash) {
            return { success: false, error: 'Invalid password' };
        }

        return { success: true, user: { username: cleanUsername, stats: userData.stats, isDeveloper: userData.isDeveloper } };
    } catch (err: any) {
        console.error("Login Redis error:", err);
        return { success: false, error: err.message || 'Connection failure' };
    }
};

export const saveUserStatsToRedis = async (username: string, stats: GameStats): Promise<boolean> => {
    const cleanUsername = username.trim().toLowerCase();
    const key = `aadishroulette:${cleanUsername}`;

    try {
        const existingDataStr = await executeRedisCommand(['GET', key]);
        if (!existingDataStr) {
            console.error(`User record for ${cleanUsername} not found on Redis during stats sync`);
            return false;
        }

        const userData: UserData = JSON.parse(existingDataStr);
        userData.stats = stats;

        await executeRedisCommand(['SET', key, JSON.stringify(userData)]);
        return true;
    } catch (err) {
        console.error(`Failed to sync stats to Redis for ${cleanUsername}:`, err);
        return false;
    }
};

export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
    try {
        const keys: string[] = await executeRedisCommand(['KEYS', 'aadishroulette:*']);
        if (!keys || keys.length === 0) return [];

        const pipelineCmds = keys.map(k => ['GET', k]);
        const pipelineResults = await executeRedisPipeline(pipelineCmds);

        const leaderboard: LeaderboardEntry[] = [];
        // FIX: Extracting the fallback environment variable config for consistent developer verification
        const devUser = (import.meta.env.VITE_DEV_USERNAME || 'aadish').toLowerCase();

        for (let i = 0; i < keys.length; i++) {
            const resObj = pipelineResults[i];
            if (resObj && resObj.result) {
                try {
                    const userData: UserData = JSON.parse(resObj.result);
                    const stats: GameStats = userData.stats || { wins: 0, losses: 0, totalRounds: 0, shotsFired: 0, shotsHit: 0, selfShots: 0, damageDealt: 0, itemsUsed: 0, mostUsedItem: 'NONE', highestRound: 0, itemPoints: 0, matchHistory: [] };
                    const matchHistory = stats.matchHistory || [];
                    
                    const hardModeWins = matchHistory.filter((m: any) => m.result === 'WIN' && m.isHardMode).length;
                    
                    leaderboard.push({
                        username: userData.username,
                        wins: stats.wins || 0,
                        losses: stats.losses || 0,
                        hardModeWins,
                        // FIX: Checks flag configuration alongside matching environment fallback name matches
                        isDeveloper: userData.isDeveloper || userData.username.toLowerCase() === devUser,
                        stats: stats as GameStats
                    });
                } catch (e) {
                    console.error("Error parsing user data in leaderboard:", e);
                }
            }
        }

        // Sorting priority: Hard mode wins desc, Normal wins desc, Losses asc
        leaderboard.sort((a, b) => {
            if (b.hardModeWins !== a.hardModeWins) {
                return b.hardModeWins - a.hardModeWins;
            }
            if (b.wins !== a.wins) {
                return b.wins - a.wins;
            }
            return a.losses - b.losses;
        });

        return leaderboard;
    } catch (err) {
        console.error("Failed to load leaderboard:", err);
        return [];
    }
};