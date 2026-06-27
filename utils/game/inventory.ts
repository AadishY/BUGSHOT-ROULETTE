import React from 'react';
import { GameState, PlayerState, ItemType, RoomSettings } from '../../types';
import { wait, randomInt } from '../gameUtils';
import { MAX_ITEMS } from '../../constants';

export const getCustomWeightedItem = (weights: Record<string, number>): ItemType => {
    const items = Object.keys(weights) as ItemType[];
    const totalWeight = items.reduce((sum, item) => sum + (weights[item] || 0), 0);
    if (totalWeight <= 0) return 'BEER'; // fallback
    
    let roll = Math.random() * totalWeight;
    for (const item of items) {
        const weight = weights[item] || 0;
        if (roll < weight) {
            return item;
        }
        roll -= weight;
    }
    return 'BEER';
};

type StateSetter<T> = React.Dispatch<React.SetStateAction<T>>;

// From useGameLogic
// Adjusted for Hard Mode support
export const getRandomItem = (isHardMode: boolean = false, isDealer: boolean = false): ItemType => {
    const r = Math.random() * 100;

    if (isHardMode) {
        if (!isDealer) {
            // Player Hard Mode: CONTRACT (7%), BEER (15%), CIGS (4%), GLASS (8%), CUFFS (8%), PHONE (8%), SAW (5%), INVERTER (8%), ADRENALINE (7%), CHOKE (5%), BIG_INVERTER (4%), LUCKYCHARM (4%), FLASHBANG (5%), CRUSHER (3%), MIRROR (4%), DECK_CARD (4%), TOTEM (1%), JACKPOT (1%)
            if (r < 7) return 'CONTRACT';
            if (r < 22) return 'BEER';
            if (r < 26) return 'CIGS';
            if (r < 34) return 'GLASS';
            if (r < 42) return 'CUFFS';
            if (r < 50) return 'PHONE';
            if (r < 55) return 'SAW';
            if (r < 63) return 'INVERTER';
            if (r < 70) return 'ADRENALINE';
            if (r < 75) return 'CHOKE';
            if (r < 79) return 'BIG_INVERTER';
            if (r < 83) return 'LUCKYCHARM';
            if (r < 88) return 'FLASHBANG';
            if (r < 91) return 'CRUSHER';
            if (r < 95) return 'MIRROR';
            if (r < 99) return 'DECK_CARD';
            if (r < 100) {
                // equal rarity
                if (Math.random() < 0.5) return 'TOTEM';
                return 'JACKPOT';
            }
            return 'JACKPOT'; // fallback
        } else {
            // Dealer Hard Mode (no contract, higher totem, no jackpot): BEER (15%), CIGS (4%), GLASS (8%), CUFFS (8%), PHONE (8%), SAW (5%), INVERTER (8%), ADRENALINE (7%), CHOKE (5%), BIG_INVERTER (4%), LUCKYCHARM (4%), FLASHBANG (5%), CRUSHER (3%), MIRROR (3%), DECK_CARD (3%), TOTEM (10%)
            if (r < 15) return 'BEER';
            if (r < 19) return 'CIGS';
            if (r < 27) return 'GLASS';
            if (r < 35) return 'CUFFS';
            if (r < 43) return 'PHONE';
            if (r < 48) return 'SAW';
            if (r < 56) return 'INVERTER';
            if (r < 63) return 'ADRENALINE';
            if (r < 68) return 'CHOKE';
            if (r < 72) return 'BIG_INVERTER';
            if (r < 76) return 'LUCKYCHARM';
            if (r < 81) return 'FLASHBANG';
            if (r < 84) return 'CRUSHER';
            if (r < 87) return 'MIRROR';
            if (r < 90) return 'DECK_CARD';
            return 'TOTEM';
        }
    } else {
        if (!isDealer) {
            // Player Normal Mode: CONTRACT (9%), BEER (10%), CIGS (9%), GLASS (7%), CUFFS (7%), PHONE (8%), SAW (5%), INVERTER (7%), ADRENALINE (7%), CHOKE (5%), BIG_INVERTER (4%), LUCKYCHARM (4%), FLASHBANG (5%), CRUSHER (3%), MIRROR (4%), DECK_CARD (3%), TOTEM (1%), JACKPOT (2%)
            if (r < 9) return 'CONTRACT';
            if (r < 19) return 'BEER';
            if (r < 28) return 'CIGS';
            if (r < 35) return 'GLASS';
            if (r < 42) return 'CUFFS';
            if (r < 50) return 'PHONE';
            if (r < 55) return 'SAW';
            if (r < 62) return 'INVERTER';
            if (r < 69) return 'ADRENALINE';
            if (r < 74) return 'CHOKE';
            if (r < 78) return 'BIG_INVERTER';
            if (r < 82) return 'LUCKYCHARM';
            if (r < 87) return 'FLASHBANG';
            if (r < 90) return 'CRUSHER';
            if (r < 94) return 'MIRROR';
            if (r < 97) return 'DECK_CARD';
            if (r < 98) return 'TOTEM';
            return 'JACKPOT';
        } else {
            // Dealer Normal Mode (no jackpot): BEER (15%), CIGS (14%), GLASS (7%), CUFFS (7%), PHONE (8%), SAW (5%), INVERTER (7%), ADRENALINE (7%), CHOKE (5%), BIG_INVERTER (4%), LUCKYCHARM (4%), FLASHBANG (5%), CRUSHER (3%), MIRROR (4%), DECK_CARD (4%), TOTEM (1%)
            if (r < 15) return 'BEER';
            if (r < 29) return 'CIGS';
            if (r < 36) return 'GLASS';
            if (r < 43) return 'CUFFS';
            if (r < 51) return 'PHONE';
            if (r < 56) return 'SAW';
            if (r < 63) return 'INVERTER';
            if (r < 70) return 'ADRENALINE';
            if (r < 75) return 'CHOKE';
            if (r < 79) return 'BIG_INVERTER';
            if (r < 83) return 'LUCKYCHARM';
            if (r < 88) return 'FLASHBANG';
            if (r < 91) return 'CRUSHER';
            if (r < 95) return 'MIRROR';
            if (r < 99) return 'DECK_CARD';
            return 'TOTEM';
        }
    }
};

const getDealerCheatingItem = (hp: number): ItemType => {
    const r = Math.random();

    // LOW HEALTH PANIC MODE (<= 2 HP)
    // He wants to SURVIVE.
    if (hp <= 2) {
        if (r < 0.35) return 'CIGS';       // 35% Cigs
        if (r < 0.60) return 'TOTEM';      // 25% Totem
        if (r < 0.70) return 'ADRENALINE';  // 10% Steal Cigs
        if (r < 0.85) return 'CUFFS';       // 15% Cuffs
        return 'INVERTER';                  // 15% Inverter
    }

    // AGGRESSIVE MODE (hp > 2)
    // He wants to KILL.
    if (r < 0.25) return 'SAW';         // 25% Saw
    if (r < 0.45) return 'INVERTER';    // 20% Inverter
    if (r < 0.60) return 'CHOKE';       // 15% Choke
    if (r < 0.70) return 'CUFFS';       // 10% Cuffs
    if (r < 0.80) return 'REMOTE';      // 10% Remote
    if (r < 0.90) return 'BIG_INVERTER'; // 10% Big Inverter
    if (r < 0.92) return 'ADRENALINE';  // 2% steal
    if (r < 0.96) return 'LUCKYCHARM';  // 4% luck
    return 'GLASS';                     // 4% glass
};

export const getContractLoot = (luckycharmsUsed: number = 0): ItemType[] => {
    // Weighted Pool based on Request: High Tier (50%) vs Others (10%)
    // High Tier (Weight 5): CHOKE, CIGS, SAW, GLASS, ADRENALINE
    // Low Tier (Weight 1): BEER, PHONE, INVERTER, BIG_INVERTER, CUFFS
    // Lucky Charm boost: high-tier weight = 5 + 10 * luckycharmsUsed

    const highTier: ItemType[] = ['CHOKE', 'CIGS', 'SAW', 'GLASS', 'ADRENALINE'];
    const lowTier: ItemType[] = ['BEER', 'PHONE', 'INVERTER', 'BIG_INVERTER', 'CUFFS'];

    const highTierWeight = 5 + (10 * luckycharmsUsed);
    const weightedPool: ItemType[] = [];

    // Add High Tier (boosted weight)
    highTier.forEach(item => {
        for (let i = 0; i < highTierWeight; i++) weightedPool.push(item);
    });

    // Add Low Tier (1x weight)
    lowTier.forEach(item => {
        weightedPool.push(item);
    });

    // Pick 2 random items from weighted pool
    const item1 = weightedPool[Math.floor(Math.random() * weightedPool.length)];
    const item2 = weightedPool[Math.floor(Math.random() * weightedPool.length)];

    return [item1, item2];
};

export const getMultiplayerDefaultWeights = (playerCount: number): Record<string, number> => {
    return {
        CONTRACT: 9,
        BEER: 10,
        CIGS: 9,
        GLASS: 7,
        CUFFS: 7,
        PHONE: 8,
        SAW: 5,
        INVERTER: 7,
        ADRENALINE: 7,
        CHOKE: 5,
        REMOTE: playerCount > 2 ? 3 : 0,
        BIG_INVERTER: 4,
        LUCKYCHARM: 4,
        FLASHBANG: 5,
        CRUSHER: 3,
        MIRROR: 4,
        DECK_CARD: 3,
        TOTEM: 1,
        JACKPOT: 2
    };
};

export const generateLootBatch = (
    amount: number, 
    isHardMode: boolean, 
    forDealer: boolean, 
    dealerHp: number,
    existingItems: ItemType[] = [],
    luckycharmsUsed: number = 0,
    userHp: number = 4,
    userMaxHp: number = 4,
    roomSettings?: RoomSettings,
    playerCount?: number
): ItemType[] => {
    const UNIQUE_ITEMS: ItemType[] = ['CONTRACT', 'LUCKYCHARM', 'TOTEM'];
    const batch: ItemType[] = [];
    const counts: Record<string, number> = {};

    for (let i = 0; i < amount; i++) {
        let item: ItemType | null = null;
        let tries = 0;

        do {
            let candidate: ItemType;

            const isCharmed = luckycharmsUsed > 0 && Math.random() < (1 - Math.pow(0.4, luckycharmsUsed));

            if (roomSettings) {
                const defaultWeights = getMultiplayerDefaultWeights(playerCount || 2);
                let weights = roomSettings.isAdvanced && roomSettings.itemWeights
                    ? roomSettings.itemWeights
                    : defaultWeights;
                
                if (playerCount !== undefined && playerCount <= 2) {
                    weights = { ...weights, REMOTE: 0 };
                }
                candidate = getCustomWeightedItem(weights);
            } else if (isCharmed) {
                // Determine curated needed items pool based on HP
                if (userHp <= 2) {
                    // Critical health: Cigs (45% weight), Cuffs (25%), Glass (15%), Inverter (15%)
                    const roll = Math.random() * 100;
                    if (roll < 45) candidate = 'CIGS';
                    else if (roll < 70) candidate = 'CUFFS';
                    else if (roll < 85) candidate = 'GLASS';
                    else candidate = 'INVERTER';
                } else {
                    // High health: Saw (35% weight), Choke (25%), Contract (15%), Inverter (15%), Glass (10%)
                    const roll = Math.random() * 100;
                    if (roll < 35) candidate = 'SAW';
                    else if (roll < 60) candidate = 'CHOKE';
                    else if (roll < 75) {
                        // Prevent dealer from getting Contract
                        candidate = forDealer ? 'SAW' : 'CONTRACT';
                    }
                    else if (roll < 90) candidate = 'INVERTER';
                    else candidate = 'GLASS';
                }
            } else if (forDealer && isHardMode) {
                // CHEATING LOGIC FOR DEALER IN HARD MODE
                candidate = getDealerCheatingItem(dealerHp);
            } else {
                // Standard Logic
                candidate = getRandomItem(isHardMode, forDealer);
            }

            // Only restrict duplicates for unique items (CONTRACT, LUCKYCHARM, TOTEM)
            if (UNIQUE_ITEMS.includes(candidate)) {
                const currentCount = counts[candidate] || 0;
                const inventoryCount = existingItems.filter(x => x === candidate).length;
                if (currentCount >= 1 || inventoryCount >= 1) {
                    tries++;
                    continue; // Max 1 of these unique items per batch + inventory
                }
            }

            item = candidate;
            tries++;
        } while (!item && tries < 25);

        // Fallback if random keeps giving same unique item
        if (!item) {
            let fbTries = 0;
            do {
                if (forDealer && isHardMode) item = getDealerCheatingItem(dealerHp);
                else item = getRandomItem(isHardMode, forDealer);
                fbTries++;
            } while (UNIQUE_ITEMS.includes(item!) && (existingItems.includes(item!) || batch.includes(item!)) && fbTries < 20);
            if (!item || (UNIQUE_ITEMS.includes(item) && (existingItems.includes(item) || batch.includes(item)))) {
                item = 'BEER'; // absolute fallback
            }
        }

        batch.push(item);
        counts[item] = (counts[item] || 0) + 1;
    }
    return batch;
};

export const distributeItems = async (
    forceClear: boolean,
    gameState: GameState,
    setPlayer: StateSetter<PlayerState>,
    setDealer: StateSetter<PlayerState>,
    setGameState: StateSetter<GameState>,
    setReceivedItems: StateSetter<ItemType[]>,
    setShowLootOverlay: StateSetter<boolean>,
    dealerHp: number = 2,
    pItemsOverride?: ItemType[],
    dItemsOverride?: ItemType[],
    playerItems: ItemType[] = [],
    dealerItems: ItemType[] = [],
    playerLuckycharms: number = 0,
    dealerLuckycharms: number = 0,
    playerHp: number = 4,
    playerMaxHp: number = 4,
    dealerMaxHp: number = 4
) => {
    // If forceClear, ensure items are cleared FIRST before anything else
    if (forceClear) {
        setPlayer(p => ({ ...p, items: [] }));
        setDealer(d => ({ ...d, items: [] }));
        await wait(50); // Small delay to ensure state is flushed
    }

    // Generate items based on round count
    let amount = 2;

    if (gameState.isMultiplayer && gameState.roomSettings) {
        amount = gameState.roomSettings.itemsPerShipment || 4;
    } else if (gameState.isHardMode) {
        // HARD MODE LOGIC
        const currentStage = gameState.hardModeState?.round || 1;
        if (currentStage === 1) amount = 2;
        else if (currentStage === 2) amount = 2;
        else if (currentStage === 3) amount = randomInt(1, 4);
        else amount = 4;
    } else {
        // NORMAL MODE LOGIC
        if (!gameState.isMultiplayer) {
            const currentRound = gameState.normalModeState?.round || 1;
            if (currentRound === 1) {
                amount = 0; // No shipment
            } else {
                amount = randomInt(2, 4); // Items with same randomness in number
            }
        } else {
            const roundNum = forceClear ? 1 : gameState.roundCount + 1;
            if (roundNum >= 10) amount = 4;
            else if (roundNum >= 4) amount = 3;
            else amount = 2;
        }
    }

    const generateLoot = (forDealer: boolean, currentItems: ItemType[]) => {
        if (forDealer) {
            return generateLootBatch(amount, gameState.isHardMode, true, dealerHp, currentItems, dealerLuckycharms, dealerHp, dealerMaxHp);
        } else {
            return generateLootBatch(amount, gameState.isHardMode, false, dealerHp, currentItems, playerLuckycharms, playerHp, playerMaxHp);
        }
    };

    // Generate loot pools separately
    const pNew = pItemsOverride || generateLoot(false, forceClear ? [] : playerItems);
    const dNew = dItemsOverride || generateLoot(true, forceClear ? [] : dealerItems);

    if (amount === 0) {
        setPlayer(p => {
            const baseItems = forceClear ? [] : p.items;
            return { ...p, items: baseItems, luckycharmsUsed: 0 };
        });
        setDealer(d => {
            const baseItems = forceClear ? [] : d.items;
            return { ...d, items: baseItems, luckycharmsUsed: 0 };
        });
        return;
    }

    // SAFETY: Clear any previous overlay state explicitely before showing new
    setShowLootOverlay(false);
    setReceivedItems([]);
    await wait(200); // Increased wait to ensure UI unmounts completely

    // Show NEW items in overlay - ONLY SHOW PLAYER ITEMS
    setGameState(prev => ({ ...prev, phase: 'LOOTING' }));
    setReceivedItems([...pNew]); // Use spread to ensure new array reference

    // Tiny delay to allow React to render the items in state before showing overlay
    // preventing "empty" or "old" flash
    await wait(50);

    setShowLootOverlay(true);
    await wait(4000); // Allow time to see items (increased for better pacing)

    // Apply items to inventories - player gets pNew, dealer gets dNew
    setPlayer(p => {
        const baseItems = forceClear ? [] : p.items;
        return { ...p, items: [...baseItems, ...pNew].slice(0, MAX_ITEMS), luckycharmsUsed: 0 };
    });
    setDealer(d => {
        const baseItems = forceClear ? [] : d.items;
        return { ...d, items: [...baseItems, ...dNew].slice(0, MAX_ITEMS), luckycharmsUsed: 0 };
    });

    // Clean up overlay
    setShowLootOverlay(false);
    setReceivedItems([]);
};
