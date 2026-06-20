import React from 'react';
import { GameState, PlayerState, ItemType } from '../../types';
import { wait, randomInt } from '../gameUtils';
import { MAX_ITEMS } from '../../constants';

type StateSetter<T> = React.Dispatch<React.SetStateAction<T>>;

// From useGameLogic
// Adjusted for Hard Mode support
export const getRandomItem = (isHardMode: boolean = false, isDealer: boolean = false): ItemType => {
    // PLAYER SPECIFIC CONTRACT LOGIC
    // Normal: 9%, Hard: 7%
    if (!isDealer) {
        if (isHardMode && Math.random() < 0.07) return 'CONTRACT';
        if (!isHardMode && Math.random() < 0.09) return 'CONTRACT';
    }

    // Standard Items - exact flat probability distributions
    const r = Math.random() * 100;

    if (isHardMode) {
        // Hard Mode Distribution (total = 93% since CONTRACT is 7% for player)
        // Values normalized to 100% for non-contract pool
        if (r < 15) return 'BEER';           // 15%
        if (r < 19) return 'CIGS';            // 4%
        if (r < 27) return 'GLASS';           // 8%
        if (r < 35) return 'CUFFS';           // 8%
        if (r < 43) return 'PHONE';           // 8%
        if (r < 48) return 'SAW';             // 5%
        if (r < 56) return 'INVERTER';        // 8%
        if (r < 63) return 'ADRENALINE';      // 7%
        if (r < 68) return 'CHOKE';           // 5%
        if (r < 72) return 'BIG_INVERTER';    // 4%
        if (r < 76) return 'LUCKYCHARM';      // 4%
        if (r < 81) return 'FLASHBANG';       // 5%
        if (r < 84) return 'CRUSHER';         // 3%
        if (r < 88) return 'MIRROR';          // 4%
        if (r < 92) return 'DECK_CARD';       // 4%
        return 'TOTEM';                       // 1% (+ remainder)
    } else {
        // Normal Mode Distribution (total = 91% since CONTRACT is 9% for player)
        if (r < 10) return 'BEER';            // 10%
        if (r < 20) return 'CIGS';            // 10%
        if (r < 27) return 'GLASS';           // 7%
        if (r < 34) return 'CUFFS';           // 7%
        if (r < 42) return 'PHONE';           // 8%
        if (r < 47) return 'SAW';             // 5%
        if (r < 54) return 'INVERTER';        // 7%
        if (r < 61) return 'ADRENALINE';      // 7%
        if (r < 66) return 'CHOKE';           // 5%
        if (r < 70) return 'BIG_INVERTER';    // 4%
        if (r < 74) return 'LUCKYCHARM';      // 4%
        if (r < 79) return 'FLASHBANG';       // 5%
        if (r < 82) return 'CRUSHER';         // 3%
        if (r < 86) return 'MIRROR';          // 4%
        if (r < 90) return 'DECK_CARD';       // 4%
        return 'TOTEM';                       // 1% (+ remainder)
    }
};

// ... (getDealerCheatingItem kept same)

const getDealerCheatingItem = (hp: number): ItemType => {
    const r = Math.random();

    // LOW HEALTH PANIC MODE (<= 2 HP)
    // He wants to SURVIVE.
    // Contract is suicide here, avoid it.
    if (hp <= 2) {
        if (r < 0.30) return 'CIGS';        // 30% Heal
        if (r < 0.45) return 'BEER';        // 15% Skip current shell
        if (r < 0.60) return 'TOTEM';       // 15% Survive lethal
        if (r < 0.70) return 'ADRENALINE';  // 10% Steal Cigs
        if (r < 0.80) return 'CUFFS';       // 10% Stop player
        if (r < 0.90) return 'SAW';         // 10% Desperation Damage
        return 'CHOKE';                     // 10% Desperation Damage
    }

    // AGGRESSIVE MODE (> 2 HP)
    // He wants to KILL.
    if (r < 0.25) return 'SAW';         // 25% double damage
    if (r < 0.50) return 'CHOKE';       // 25% huge damage/skip
    if (r < 0.65) return 'GLASS';       // 15% intel
    if (r < 0.75) return 'CUFFS';       // 10% control
    if (r < 0.85) return 'INVERTER';    // 10% manipulation
    if (r < 0.90) return 'BIG_INVERTER';// 5% chaos
    // CONTRACT REMOVED FOR DEALER
    return 'ADRENALINE';                // 10% steal
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

export const generateLootBatch = (
    amount: number, 
    isHardMode: boolean, 
    forDealer: boolean, 
    dealerHp: number,
    existingItems: ItemType[] = [],
    luckycharmsUsed: number = 0,
    userHp: number = 4,
    userMaxHp: number = 4
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

            if (isCharmed) {
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
        const roundNum = forceClear ? 1 : gameState.roundCount + 1;
        if (roundNum >= 10) amount = 4;
        else if (roundNum >= 4) amount = 3;
        else amount = 2;
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
