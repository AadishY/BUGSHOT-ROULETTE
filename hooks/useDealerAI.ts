import React, { useEffect, useRef, useState } from 'react';
import { GameState, PlayerState, ShellType, ItemType, TurnOwner, AimTarget, CameraView, AnimationState, TarotCard } from '../types';
import { wait } from '../utils/gameUtils';
import { MAX_ITEMS } from '../constants';

// Utility scoring for Dealer's smart Tarot card selection (Hard Mode)
const evaluateCardForDealer = (
    cardName: TarotCard['name'],
    dealer: PlayerState,
    player: PlayerState,
    gameState: GameState
): number => {
    const dealerHp = dealer.hp;
    const dealerMaxHp = dealer.maxHp;
    const playerHp = player.hp;
    const remainingShells = gameState.chamber.length - gameState.currentShellIndex;

    switch (cardName) {
        case 'The Magician':
            // Gain a random item — good if inventory has space
            return dealer.items.length < MAX_ITEMS ? 6 : 1;

        case 'The Hanged Man':
            // Lose 1 HP — very bad at low HP, mildly bad otherwise
            if (dealerHp <= 1) return -10;
            if (dealerHp <= 2) return 0;
            return 2;

        case 'The Hermit':
            // Transfers turn to player — bad for dealer (loses control)
            return -3;

        case 'The Moon':
            // Steal a random item from opponent — great if player has good items
            if (player.items.length === 0) return 0;
            const highValueItems = player.items.filter(i => ['SAW', 'CUFFS', 'INVERTER', 'CHOKE', 'TOTEM', 'CONTRACT'].includes(i));
            return highValueItems.length > 0 ? 9 : 5;

        case 'Judgment':
            // 50% chance to convert blank to live — useful for dealer's next shot on player
            return 5;

        case 'Wheel of Fortune':
            // Reshuffles chamber — useful if current shell position is bad
            return 3;

        case 'The Sun':
            // Heal 1 HP — excellent at low HP, diminishing returns at full
            if (dealerHp >= dealerMaxHp) return 0;
            if (dealerHp <= 2) return 9;
            return 5;

        case 'Death':
            // Destroy own random item — bad unless inventory is mostly junk
            return dealer.items.length <= 1 ? -5 : -2;

        case 'The Tower':
            // Destroy opponent's random item — very good if player has items
            if (player.items.length === 0) return 0;
            return 7;

        case 'The Fool':
            // Reveals shell info — moderately useful
            return remainingShells > 1 ? 4 : 2;

        case 'Justice':
            // Swap HP — excellent if dealer HP < player HP, terrible otherwise
            if (dealerHp < playerHp) return 10;
            if (dealerHp > playerHp) return -8;
            return 0;

        default:
            return 0;
    }
};

interface DealerAIProps {
    gameState: GameState;
    dealer: PlayerState;
    player: PlayerState;
    knownShell: ShellType | null;
    animState: AnimationState;
    fireShot: (shooter: TurnOwner, target: TurnOwner) => Promise<void>;
    processItemEffect: (user: TurnOwner, item: ItemType) => Promise<boolean>;
    setDealer: React.Dispatch<React.SetStateAction<PlayerState>>;
    setPlayer: React.Dispatch<React.SetStateAction<PlayerState>>;
    setTargetAim: (aim: AimTarget) => void;
    setCameraView: (view: CameraView) => void;
    setOverlayText?: React.Dispatch<React.SetStateAction<string | null>>;
    isMultiplayer?: boolean;
    isProcessing: boolean;
    setIsProcessing: (val: boolean) => void;
    selectTarotCard?: (index: number) => Promise<void>;
}

export const useDealerAI = ({
    gameState,
    dealer,
    player,
    knownShell,
    animState,
    fireShot,
    processItemEffect,
    setDealer,
    setPlayer,
    setTargetAim,
    setCameraView,
    setOverlayText,
    isMultiplayer = false,
    isProcessing,
    setIsProcessing,
    selectTarotCard
}: DealerAIProps) => {
    const isAITurnInProgress = useRef(false);
    // AI Memory: Map<shellIndex, type> - Tracks specifically known shells
    const aiMemory = useRef<Map<number, ShellType>>(new Map());
    const [aiTick, setAiTick] = useState(0);

    // Tab visibility handling
    const [isTabVisible, setIsTabVisible] = useState(!document.hidden);
    useEffect(() => {
        const handleVisibility = () => {
            setIsTabVisible(!document.hidden);
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, []);

    // Create refs for hook inputs to avoid stale closures in the async runAITurn loop
    const gameStateRef = useRef(gameState);
    const dealerRef = useRef(dealer);
    const playerRef = useRef(player);
    const knownShellRef = useRef(knownShell);
    const fireShotRef = useRef(fireShot);
    const processItemEffectRef = useRef(processItemEffect);

    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
    useEffect(() => { dealerRef.current = dealer; }, [dealer]);
    useEffect(() => { playerRef.current = player; }, [player]);
    useEffect(() => { knownShellRef.current = knownShell; }, [knownShell]);
    useEffect(() => { fireShotRef.current = fireShot; }, [fireShot]);
    useEffect(() => { processItemEffectRef.current = processItemEffect; }, [processItemEffect]);

    // Reset memory on new round load
    useEffect(() => {
        if (gameState.phase === 'LOAD') {
            aiMemory.current.clear();
        }
    }, [gameState.phase]);

    // Use a ref to track current animState so the async loop sees the latest values
    const animStateRef = useRef(animState);
    useEffect(() => {
        animStateRef.current = animState;
    }, [animState]);

    useEffect(() => {
        if (isMultiplayer) return;
        if (isProcessing) return;

        const isDealerCardSelect = gameState.phase === 'CARD_SELECT' && gameState.turnOwner === 'DEALER' && gameState.selectedCardIndex === null;
        if ((gameState.phase === 'DEALER_TURN' || isDealerCardSelect) && !isAITurnInProgress.current && isTabVisible) {
            isAITurnInProgress.current = true;
            setIsProcessing(true); // Lock input while dealer thinks
            if (gameState.phase === 'DEALER_TURN') {
                setCameraView('PLAYER');
            }

            const runAITurn = async () => {
                try {
                    // Small human-like delay
                    await wait(800 + Math.random() * 800);

                    if (document.hidden || !isTabVisible) {
                        setIsProcessing(false);
                        isAITurnInProgress.current = false;
                        return;
                    }
                    // Re-check validity after delay
                    const currentPhase = gameStateRef.current.phase;
                    const isDealerCardSelectVal = currentPhase === 'CARD_SELECT' && gameStateRef.current.turnOwner === 'DEALER' && gameStateRef.current.selectedCardIndex === null;
                    if ((currentPhase !== 'DEALER_TURN' && !isDealerCardSelectVal) || gameStateRef.current.winner || document.hidden || !isTabVisible) {
                        setIsProcessing(false);
                        isAITurnInProgress.current = false;
                        return;
                    }

                    if (currentPhase === 'CARD_SELECT') {
                        await wait(1500);
                        if (gameStateRef.current.phase === 'CARD_SELECT' && gameStateRef.current.turnOwner === 'DEALER') {
                            const cards = gameStateRef.current.deckCards;
                            let chosenIdx = Math.floor(Math.random() * 6);

                            // Hard Mode: 50% chance to peek and choose best card
                            if (gameStateRef.current.isHardMode && cards && cards.length > 0 && Math.random() < 0.50) {
                                let bestScore = -Infinity;
                                let bestIdx = 0;
                                for (let ci = 0; ci < cards.length; ci++) {
                                    const score = evaluateCardForDealer(
                                        cards[ci].name,
                                        dealerRef.current,
                                        playerRef.current,
                                        gameStateRef.current
                                    );
                                    if (score > bestScore) {
                                        bestScore = score;
                                        bestIdx = ci;
                                    }
                                }
                                chosenIdx = bestIdx;
                            }

                            if (selectTarotCard) {
                                await selectTarotCard(chosenIdx);
                            }
                        }
                        isAITurnInProgress.current = false;
                        setIsProcessing(false);
                        return;
                    }

                    const chamber = gameStateRef.current.chamber;
                    const currentIdx = gameStateRef.current.currentShellIndex;
                    const remainingShells = chamber.slice(currentIdx);
                    const totalRemaining = remainingShells.length;

                    // --- ANALYSIS ---
                    const liveCountReal = remainingShells.filter(s => s === 'LIVE').length;

                    // Check Global Known (Glass)
                    if (knownShellRef.current) {
                        aiMemory.current.set(currentIdx, knownShellRef.current);
                    }

                    let currentKnown = aiMemory.current.get(currentIdx);

                    // Count what IS known in memory ahead
                    let knownLiveDelta = 0;
                    let knownSafeCnt = 0;

                    const visibleLive = gameStateRef.current.liveCount;
                    const visibleBlank = gameStateRef.current.blankCount;

                    const unknownLiveProb = (visibleLive / (visibleLive + visibleBlank)) || 0;

                    const isFlashbanged = dealerRef.current.isFlashbanged;
                    let itemToUse: ItemType | null = null;

                    if (!isFlashbanged) {
                        // --- HARD MODE LOGIC (GOD TIER) ---
                        if (gameStateRef.current.isHardMode) {
                        // 0. SUPERNATURAL INTUITION (The Dealer can smell the gunpowder)
                        if (!currentKnown && Math.random() < 0.60) {
                            const actual = chamber[currentIdx];
                            aiMemory.current.set(currentIdx, actual);
                            currentKnown = actual;
                        }

                        // 1. SURVIVAL HEAL (Highest Priority)
                        if (dealerRef.current.hp < dealerRef.current.maxHp && dealerRef.current.items.includes('CIGS')) {
                            const shouldHeal = dealerRef.current.hp <= 2 || (dealerRef.current.hp < dealerRef.current.maxHp && Math.random() < 0.85);
                            if (shouldHeal) itemToUse = 'CIGS';
                        }

                        // 2. SACRIFICE FOR POWER (CONTRACT)
                        else if (dealerRef.current.hp >= 2 && dealerRef.current.items.length <= 6 && dealerRef.current.items.includes('CONTRACT')) {
                            itemToUse = 'CONTRACT';
                        }

                        // 3. KILL CONFIRMATION / BOOSTED DAMAGE (Priority 3)
                        else if (currentKnown === 'LIVE' && !itemToUse) {
                            if (dealerRef.current.items.includes('SAW') && !dealerRef.current.isSawedActive) itemToUse = 'SAW';
                            else if (dealerRef.current.items.includes('CUFFS') && !playerRef.current.isHandcuffed && totalRemaining > 1) itemToUse = 'CUFFS';
                        }
                        // Use Cuffs even if shell type is unknown but live probability is decent (>= 50%)
                        else if (!itemToUse && !currentKnown && unknownLiveProb >= 0.5 && dealerRef.current.items.includes('CUFFS') && !playerRef.current.isHandcuffed && totalRemaining > 1) {
                            itemToUse = 'CUFFS';
                        }

                        // 4. CONVERSION (Priority 4)
                        else if (currentKnown === 'BLANK' && dealerRef.current.items.includes('INVERTER') && !itemToUse) {
                            itemToUse = 'INVERTER';
                        }
                        else if (dealerRef.current.items.includes('BIG_INVERTER') && !itemToUse) {
                            const remaining = remainingShells.length;
                            const knownBlanks = remainingShells.filter(s => s === 'BLANK').length;
                            if (knownBlanks / remaining > 0.5 || (currentKnown === 'BLANK' && remaining >= 2)) {
                                itemToUse = 'BIG_INVERTER';
                            }
                        }

                        // 5. CHAMBER MANIPULATION (Priority 5) - REMOTE
                        else if (dealerRef.current.items.includes('REMOTE') && totalRemaining >= 2 && !itemToUse) {
                            const nextKnown = aiMemory.current.get(currentIdx + 1);
                            if (currentKnown === 'BLANK' && nextKnown === 'LIVE') {
                                itemToUse = 'REMOTE';
                            }
                        }

                        // 6. CHOKE LOGIC
                        else if (dealerRef.current.items.includes('CHOKE') && !dealerRef.current.isChokeActive && !itemToUse && totalRemaining >= 2) {
                            const nextKnown = aiMemory.current.get(currentIdx + 1);
                            const actualNext = chamber[currentIdx + 1];

                            // Supernatural peek for second shell
                            let shell2 = nextKnown;
                            if (!shell2 && Math.random() < 0.60) {
                                  shell2 = actualNext;
                                  aiMemory.current.set(currentIdx + 1, actualNext);
                            }

                            const shell1 = currentKnown;
                            if (shell1 === 'LIVE' && shell2 === 'LIVE') itemToUse = 'CHOKE';
                            else if (shell1 === 'BLANK' && shell2 === 'BLANK' && (dealerRef.current.items.includes('INVERTER') || dealerRef.current.items.includes('BIG_INVERTER'))) itemToUse = 'CHOKE';
                            else if ((shell1 === 'LIVE' || shell2 === 'LIVE') && dealerRef.current.hp > 1) itemToUse = 'CHOKE';
                        }

                        else if (!currentKnown && dealerRef.current.items.includes('GLASS') && !itemToUse) itemToUse = 'GLASS';
                        else if (dealerRef.current.items.includes('PHONE') && totalRemaining > 1 && !itemToUse) itemToUse = 'PHONE';
                        else if (dealerRef.current.items.includes('DECK_CARD') && !itemToUse) {
                            if (dealerRef.current.items.length >= 6 || Math.random() < 0.6) {
                                itemToUse = 'DECK_CARD';
                            }
                        }

                        // 8. MIRROR LOGIC
                        else if (dealerRef.current.items.includes('MIRROR') && !itemToUse) {
                            const playerUsedItems = (playerRef.current.lastTurnItemsUsed || []).filter(i => i !== 'MIRROR');
                            if (playerUsedItems.length > 0) {
                                let isSmart = false;
                                for (const pItem of playerUsedItems) {
                                    if (pItem === 'CIGS' && dealerRef.current.hp < dealerRef.current.maxHp) isSmart = true;
                                    if (pItem === 'SAW' && currentKnown === 'LIVE') isSmart = true;
                                    if (pItem === 'CUFFS' && !playerRef.current.isHandcuffed) isSmart = true;
                                    if (pItem === 'GLASS' && !currentKnown) isSmart = true;
                                    if (pItem === 'INVERTER' && currentKnown === 'BLANK') isSmart = true;
                                    if (pItem === 'BIG_INVERTER' && totalRemaining >= 3) isSmart = true;
                                    if (pItem === 'PHONE' && totalRemaining > 1) isSmart = true;
                                    if (pItem === 'REMOTE' && totalRemaining >= 2) isSmart = true;
                                    if (pItem === 'CHOKE' && totalRemaining >= 2) isSmart = true;
                                    if (pItem === 'CONTRACT' && dealerRef.current.hp >= 2 && dealerRef.current.items.length <= 6) isSmart = true;
                                    if (pItem === 'FLASHBANG' && !playerRef.current.isFlashbanged) isSmart = true;
                                    if (pItem === 'CRUSHER' && playerRef.current.items.length > 0) isSmart = true;
                                    if (pItem === 'LUCKYCHARM' || pItem === 'BEER') isSmart = true;
                                }
                                if (isSmart) {
                                    itemToUse = 'MIRROR';
                                }
                            }
                        }

                        // 9. THEFT (Adrenaline)
                        else if (dealerRef.current.items.includes('ADRENALINE') && playerRef.current.items.length > 0 && !itemToUse) {
                            const targets = ['SAW', 'INVERTER', 'CUFFS', 'MIRROR', 'CHOKE', 'REMOTE', 'CIGS', 'DECK_CARD'];
                            if (playerRef.current.items.some(i => targets.includes(i))) itemToUse = 'ADRENALINE';
                        }

                        // 9. BEER / CYCLE
                        else if (dealerRef.current.items.includes('BEER') && !itemToUse) {
                            if (currentKnown === 'BLANK' || unknownLiveProb < 0.4) itemToUse = 'BEER';
                        }

                        // 10. LUCKY CHARM
                        else if (dealerRef.current.items.includes('LUCKYCHARM') && !itemToUse) {
                            itemToUse = 'LUCKYCHARM';
                        }
                        // 11. FLASHBANG (Hard Mode Strategy)
                        else if (dealerRef.current.items.includes('FLASHBANG') && !playerRef.current.isFlashbanged && !itemToUse) {
                            const playerHasThreat = playerRef.current.items.some(i => ['SAW', 'CUFFS', 'CHOKE', 'ADRENALINE', 'CONTRACT', 'TOTEM'].includes(i));
                            if (playerHasThreat || Math.random() < 0.4) {
                                itemToUse = 'FLASHBANG';
                            }
                        }
                        // 12. CRUSHER (Hard Mode Strategy)
                        else if (dealerRef.current.items.includes('CRUSHER') && playerRef.current.items.length > 0 && !itemToUse) {
                            const playerHasThreat = playerRef.current.items.some(i => ['SAW', 'CUFFS', 'CHOKE', 'ADRENALINE', 'CONTRACT', 'BIG_INVERTER', 'FLASHBANG', 'TOTEM'].includes(i));
                            if (playerHasThreat || Math.random() < 0.6) {
                                itemToUse = 'CRUSHER';
                            }
                        }
                    }
                    else {
                        // --- NORMAL LOGIC ---
                        if (dealerRef.current.hp < dealerRef.current.maxHp && dealerRef.current.items.includes('CIGS') && !itemToUse) {
                            if (dealerRef.current.hp <= 2 || Math.random() > 0.4) itemToUse = 'CIGS';
                        }
                        else if (dealerRef.current.hp >= 3 && dealerRef.current.items.length <= 5 && dealerRef.current.items.includes('CONTRACT') && !itemToUse && Math.random() > 0.5) {
                            itemToUse = 'CONTRACT';
                        }
                        else if (dealerRef.current.items.includes('ADRENALINE') && playerRef.current.items.length > 0 && !itemToUse && Math.random() > 0.2) {
                            const threats = ['SAW', 'CUFFS', 'INVERTER', 'CHOKE', 'CIGS', 'MIRROR', 'DECK_CARD'];
                            if (playerRef.current.items.some(i => threats.includes(i))) itemToUse = 'ADRENALINE';
                        }
                        else if (dealerRef.current.items.includes('MIRROR') && !itemToUse && Math.random() > 0.3) {
                            const playerUsedItems = (playerRef.current.lastTurnItemsUsed || []).filter(i => i !== 'MIRROR');
                            if (playerUsedItems.length > 0) {
                                itemToUse = 'MIRROR';
                            }
                        }
                        else if (dealerRef.current.items.includes('INVERTER') && !itemToUse && currentKnown === 'BLANK') {
                            itemToUse = 'INVERTER';
                        }
                        else if (dealerRef.current.items.includes('BIG_INVERTER') && !itemToUse && currentKnown === 'BLANK' && totalRemaining >= 3) {
                            itemToUse = 'BIG_INVERTER';
                        }
                        else if (dealerRef.current.items.includes('SAW') && !dealerRef.current.isSawedActive && !itemToUse && currentKnown === 'LIVE' && playerRef.current.hp > 1) {
                            itemToUse = 'SAW';
                        }
                        else if (dealerRef.current.items.includes('CUFFS') && !playerRef.current.isHandcuffed && !itemToUse && totalRemaining > 1) {
                            itemToUse = 'CUFFS';
                        }
                        else if (dealerRef.current.items.includes('REMOTE') && totalRemaining >= 2 && !itemToUse && Math.random() > 0.4) {
                            const nextKnown = aiMemory.current.get(currentIdx + 1);
                            if (currentKnown === 'BLANK' && nextKnown === 'LIVE') {
                                itemToUse = 'REMOTE';
                            }
                        }
                        else if (!currentKnown && dealerRef.current.items.includes('GLASS') && totalRemaining >= 2 && !itemToUse) {
                            itemToUse = 'GLASS';
                        }
                        else if (dealerRef.current.items.includes('PHONE') && totalRemaining > 2 && !itemToUse) {
                            itemToUse = 'PHONE';
                        }
                        else if (dealerRef.current.items.includes('DECK_CARD') && !itemToUse && Math.random() < 0.5) {
                            itemToUse = 'DECK_CARD';
                        }
                        else if (dealerRef.current.items.includes('BEER') && !itemToUse) {
                            if (currentKnown === 'BLANK' || (!currentKnown && totalRemaining > 2 && Math.random() > 0.3)) itemToUse = 'BEER';
                        }
                        else if (dealerRef.current.items.includes('CHOKE') && !dealerRef.current.isChokeActive && !itemToUse && totalRemaining >= 2) {
                            if (Math.random() < 0.5) itemToUse = 'CHOKE';
                        }
                        else if (dealerRef.current.items.includes('LUCKYCHARM') && !itemToUse) {
                            itemToUse = 'LUCKYCHARM';
                        }
                        // 11. FLASHBANG (Normal Mode Strategy)
                        else if (dealerRef.current.items.includes('FLASHBANG') && !playerRef.current.isFlashbanged && !itemToUse && Math.random() > 0.3) {
                            itemToUse = 'FLASHBANG';
                        }
                        // 12. CRUSHER (Normal Mode Strategy)
                        else if (dealerRef.current.items.includes('CRUSHER') && playerRef.current.items.length > 0 && !itemToUse && Math.random() > 0.4) {
                            itemToUse = 'CRUSHER';
                        }
                    }
                    } // End of if (!isFlashbanged)

                    // --- EXECUTION ---
                    if (itemToUse) {
                        const idx = dealerRef.current.items.indexOf(itemToUse);
                        if (idx !== -1) {
                            await wait(500);
                            setTargetAim('IDLE');
                            await wait(500);

                            // Helper to trigger item use
                            const triggerItemUse = async (index: number) => {
                                const item = dealerRef.current.items[index];
                                setDealer(d => {
                                    const ni = [...d.items];
                                    ni.splice(index, 1);
                                    return { ...d, items: ni };
                                });
                                await processItemEffectRef.current('DEALER', item);
                            };

                            if (itemToUse === 'ADRENALINE') {
                                // Remove Adrenaline
                                setDealer(d => {
                                    const ni = [...d.items];
                                    ni.splice(idx, 1);
                                    return { ...d, items: ni };
                                });
                                await processItemEffectRef.current('DEALER', 'ADRENALINE');
                                await wait(1500);

                                 // Simulate Steal
                                 let stealIdx = -1;
                                 const priorities: ItemType[] = gameStateRef.current.isHardMode
                                     ? ['SAW', 'INVERTER', 'CUFFS', 'MIRROR', 'CHOKE', 'REMOTE', 'CIGS', 'PHONE', 'GLASS', 'BEER', 'CONTRACT', 'DECK_CARD']
                                     : ['SAW', 'INVERTER', 'CUFFS', 'MIRROR', 'CHOKE', 'CIGS', 'PHONE', 'GLASS', 'BEER', 'REMOTE', 'CONTRACT', 'DECK_CARD'];

                                 const activePriorities = (dealerRef.current.hp < 2 
                                     ? ['CIGS', ...priorities] 
                                     : priorities
                                 ).filter(i => i !== 'TOTEM' && i !== 'ADRENALINE');

                                 for (const pItem of activePriorities) {
                                     if (pItem === 'MIRROR') {
                                         const playerLastItems = (playerRef.current.lastTurnItemsUsed || []).filter(i => i !== 'MIRROR');
                                         if (playerLastItems.length === 0) continue;
                                     }
                                     const pIdx = playerRef.current.items.indexOf(pItem as ItemType);
                                     if (pIdx !== -1) {
                                         stealIdx = pIdx;
                                         break;
                                     }
                                 }
                                 if (stealIdx === -1 && playerRef.current.items.length > 0) {
                                     stealIdx = playerRef.current.items.findIndex(i => i !== 'TOTEM' && i !== 'ADRENALINE');
                                 }

                                 if (stealIdx !== -1) {
                                     const stolen = playerRef.current.items[stealIdx];
                                     setPlayer(p => {
                                         const ni = [...p.items];
                                         ni.splice(stealIdx, 1);
                                         return { ...p, items: ni };
                                     });
                                     if (setOverlayText) {
                                         setOverlayText(`DEALER STOLE ${stolen}`);
                                         setTimeout(() => setOverlayText?.(null), 1500);
                                     }
                                     await wait(1000);

                                     if (stolen === 'ADRENALINE') {
                                         setDealer(d => ({ ...d, items: [...d.items, 'ADRENALINE'] }));
                                     } else if (stolen === 'TOTEM') {
                                         setDealer(d => ({ ...d, items: [...d.items, 'TOTEM'].slice(0, MAX_ITEMS) as ItemType[] }));
                                         if (setOverlayText) {
                                             setOverlayText("DEALER STOLE TOTEM (STASHED)");
                                             setTimeout(() => setOverlayText?.(null), 1500);
                                         }
                                     } else if (stolen === 'CONTRACT' && dealerRef.current.hp <= 1) {
                                         // Safety check: Stash stolen CONTRACT instead of using it and self-eliminating
                                         setDealer(d => ({ ...d, items: [...d.items, 'CONTRACT'] }));
                                         if (setOverlayText) {
                                             setOverlayText("DEALER STOLE CONTRACT (STASHED)");
                                             setTimeout(() => setOverlayText?.(null), 1500);
                                         }
                                     } else {
                                         if (stolen === 'GLASS') aiMemory.current.set(currentIdx, chamber[currentIdx]);
                                         if (stolen === 'INVERTER') {
                                             const actual = chamber[currentIdx];
                                             aiMemory.current.set(currentIdx, actual === 'LIVE' ? 'BLANK' : 'LIVE');
                                         }
                                         await processItemEffectRef.current('DEALER', stolen);
                                     }}
                                else {
                                    if (setOverlayText) {
                                        setOverlayText("NOTHING TO STEAL");
                                        setTimeout(() => setOverlayText?.(null), 1000);
                                    }
                                }
                                setAiTick(t => t + 1);
                                isAITurnInProgress.current = false;
                                return;
                            }
                            // Non-stealing items
                            else {
                                await triggerItemUse(idx);

                                // UPDATE MEMORY BASED ON ACTION
                                if (itemToUse === 'GLASS') {
                                    aiMemory.current.set(currentIdx, chamber[currentIdx]);
                                }
                                else if (itemToUse === 'INVERTER') {
                                    const actual = chamber[currentIdx];
                                    aiMemory.current.set(currentIdx, actual === 'LIVE' ? 'BLANK' : 'LIVE');
                                }
                                else if (itemToUse === 'BIG_INVERTER') {
                                    // Invert MEMORY for all remaining shells
                                    for (let i = currentIdx; i < chamber.length; i++) {
                                        if (aiMemory.current.has(i)) {
                                            const m = aiMemory.current.get(i);
                                            aiMemory.current.set(i, m === 'LIVE' ? 'BLANK' : 'LIVE');
                                        }
                                    }
                                }
                                else if (itemToUse === 'PHONE') {
                                    // Dealer used phone: Memorize a random future shell
                                    const available = [];
                                    const limit = chamber.length;
                                    for (let i = currentIdx + 1; i < limit; i++) {
                                        if (!aiMemory.current.has(i)) available.push(i);
                                    }
                                    if (available.length > 0) {
                                        const r = available[Math.floor(Math.random() * available.length)];
                                        aiMemory.current.set(r, chamber[r]);
                                    }
                                }

                                await wait(500);
                                setAiTick(t => t + 1);
                                isAITurnInProgress.current = false;
                                return;
                            }
                        }
                    }

                    // --- SHOOTING DECISION ---
                    await wait(500);
                    setTargetAim('IDLE');
                    await wait(600);

                    // Re-evaluate known after item usage
                    currentKnown = aiMemory.current.get(currentIdx);

                    const finalLiveProb = currentKnown ? (currentKnown === 'LIVE' ? 1.0 : 0.0) : unknownLiveProb;

                    let target: TurnOwner = 'PLAYER';

                    // DECISION LOGIC
                    if (finalLiveProb === 1.0) target = 'PLAYER';
                    else if (finalLiveProb === 0.0) target = 'DEALER';
                    else {
                        if (dealerRef.current.isSawedActive) {
                            // If sawed, almost always shoot player unless we are sure it's blank
                            target = finalLiveProb > 0.1 ? 'PLAYER' : 'DEALER'; // Risk it
                        } else {
                            if (gameStateRef.current.isHardMode) {
                                // Smart Logic:
                                // 1. If HP is 1, NEVER risk shooting self unless we are 100% sure it's blank (Prob=0).
                                // 2. If we know next is blank (peeked), shoot self to keep turn.
                                // 3. Otherwise use threshold.
                                if (dealerRef.current.hp === 1) {
                                    target = 'PLAYER';
                                } else {
                                    // In Hard Mode, be more likely to shoot self if blank count is high
                                    const threshold = 0.5 - (visibleBlank * 0.05); // More lenient if many blanks
                                    target = finalLiveProb >= Math.max(0.3, threshold) ? 'PLAYER' : 'DEALER';
                                }
                            } else {
                                // Normal Mode: Aggressive/Loose
                                target = finalLiveProb >= 0.4 ? 'PLAYER' : 'DEALER';
                            }
                        }

                        // Normal Mode Personality override: Sometimes dumb
                        if (!gameStateRef.current.isHardMode && Math.random() < 0.1) {
                            target = target === 'PLAYER' ? 'DEALER' : 'PLAYER'; // 10% chance to be an idiot
                        }
                    }

                    setTargetAim(target === 'PLAYER' ? 'OPPONENT' : 'SELF');
                    await wait(1000);
                    aiMemory.current.delete(currentIdx); // Clear memory of this shell once used
                    await fireShotRef.current('DEALER', target);

                } catch (e) {
                    console.error("Dealer AI Error:", e);
                } finally {
                    isAITurnInProgress.current = false;
                    setIsProcessing(false); // Always unlock after turn logic finishes
                }
            };
            runAITurn();
        }
    }, [gameState.phase, aiTick, gameState.turnOwner, isProcessing, dealer, isTabVisible]);
};