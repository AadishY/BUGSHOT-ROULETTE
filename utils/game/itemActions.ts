import React from 'react';
import { GameState, PlayerState, TurnOwner, ShellType, ItemType, LogEntry, AnimationState } from '../../types';
import { wait } from '../gameUtils';
import { audioManager } from '../audioManager';
import { getContractLoot } from './inventory';
import { MAX_ITEMS } from '../../constants';

// Helper to update state safely
type StateSetter<T> = React.Dispatch<React.SetStateAction<T>>;
export const handleContract = async (
    user: TurnOwner,
    player: PlayerState,
    dealer: PlayerState,
    setPlayer: StateSetter<PlayerState>,
    setDealer: StateSetter<PlayerState>,
    setGameState: StateSetter<GameState>,
    setAnim: (update: any) => void,
    setTriggerContract: StateSetter<number>,
    addLog: (text: string, type: LogEntry['type']) => void,
    setOverlayText?: StateSetter<string | null>,
    setOverlayColor?: StateSetter<'none' | 'red' | 'green' | 'scan'>,
    isHardMode?: boolean,
    isMultiplayer?: boolean,
    handleHardModeRoundEnd?: (winner: TurnOwner) => void,
    handleMPRoundEnd?: (winner: TurnOwner) => void,
    handleNormalModeRoundEnd?: (winner: TurnOwner) => void
) => {
    setTriggerContract(p => p + 1);
    await wait(2500); // Wait for contract sign/burn animation

    if (setOverlayColor) setOverlayColor('red'); // Blood effect

    // 1. Pay Handling Cost (1 HP)
    if (user === 'PLAYER') {
        const hasJackpot = player.jackpotImmunityShots !== undefined && player.jackpotImmunityShots > 0;

        if (hasJackpot) {
            const nextImmunity = Math.max(0, player.jackpotImmunityShots - 1);
            setPlayer(p => ({ ...p, jackpotImmunityShots: nextImmunity }));
            if (nextImmunity <= 0) {
                audioManager.stopJackpotMusic();
            }

            // RCT Sequence for Contract Sacrifice
            const originalHp = player.hp;
            const tempHp = Math.max(0, originalHp - 1);

            setPlayer(p => ({ ...p, hp: tempHp }));
            if (setOverlayColor) setOverlayColor('red');
            if (setOverlayText) setOverlayText('✨ REVERSE CURSED TECHNIQUE ✨');
            setAnim((prev: any) => ({ ...prev, playerHit: true, playerRecovering: false }));

            await wait(1800);

            setPlayer(p => ({ ...p, hp: originalHp }));
            if (setOverlayText) setOverlayText('✨ RCT: HEALED! ✨');
            if (setOverlayColor) setOverlayColor('green');

            setAnim((prev: any) => ({ ...prev, playerHit: false, playerRecovering: true }));
            await wait(1500);

            if (setOverlayColor) setOverlayColor('none');
            if (setOverlayText) setOverlayText(null);
        } else {
            const newHp = player.hp - 1;
            const hasTotem = player.items.includes('TOTEM');

            if (newHp <= 0) {
                if (hasTotem) {
                    setPlayer(p => {
                        const idx = p.items.indexOf('TOTEM');
                        const newItems = [...p.items];
                        if (idx !== -1) newItems.splice(idx, 1);
                        return { ...p, hp: 1, items: newItems };
                    });

                    if (setOverlayText) setOverlayText('✨ TOTEM ACTIVATED ✨\nSurvives at 1 HP!');
                    setAnim((prev: any) => ({
                        ...prev,
                        triggerTotem: (prev.triggerTotem || 0) + 1,
                        totemTarget: 'PLAYER'
                    }));
                    audioManager.playSound('totem');
                    addLog("PLAYER'S TOTEM ACTIVATED: Survived lethal blood contract sacrifice at 1 HP!", 'safe');
                    await wait(3000);
                    if (setOverlayText) setOverlayText(null);
                } else {
                    setPlayer(p => ({ ...p, hp: 0 }));
                    // Immediate Death
                    if (isHardMode && handleHardModeRoundEnd) {
                        addLog('YOU DIED (BLOOD CONTRACT).', 'danger');
                        handleHardModeRoundEnd('DEALER');
                        return;
                    }
                    if (isMultiplayer && handleMPRoundEnd) {
                        addLog('YOU DIED (BLOOD CONTRACT).', 'danger');
                        handleMPRoundEnd('DEALER');
                        return;
                    }
                    if (!isMultiplayer && !isHardMode && handleNormalModeRoundEnd) {
                        addLog('YOU DIED (BLOOD CONTRACT).', 'danger');
                        handleNormalModeRoundEnd('DEALER');
                        return;
                    }
                    setGameState(prev => ({ ...prev, winner: 'DEALER', phase: 'GAME_OVER' }));
                    addLog('YOU DIED (BLOOD CONTRACT).', 'danger');
                    await wait(1500);
                    if (setOverlayColor) setOverlayColor('none');
                    return; // End execution
                }
            } else {
                setPlayer(p => ({ ...p, hp: newHp }));
            }
        }
    } else {
            const newHp = dealer.hp - 1;
            const hasTotem = dealer.items.includes('TOTEM');

            if (newHp <= 0) {
                if (hasTotem) {
                    setDealer(d => {
                        const idx = d.items.indexOf('TOTEM');
                        const newItems = [...d.items];
                        if (idx !== -1) newItems.splice(idx, 1);
                        return { ...d, hp: 1, items: newItems };
                    });

                    if (setOverlayText) setOverlayText('✨ TOTEM ACTIVATED ✨\nDealer survives at 1 HP!');
                    setAnim(prev => ({
                        ...prev,
                        triggerTotem: (prev.triggerTotem || 0) + 1,
                        totemTarget: 'DEALER'
                    }));
                    audioManager.playSound('totem');
                    addLog("DEALER'S TOTEM ACTIVATED: Survived lethal blood contract sacrifice at 1 HP!", 'safe');
                    await wait(3000);
                    if (setOverlayText) setOverlayText(null);
                } else {
                    setDealer(d => ({ ...d, hp: 0 }));
                    // Immediate Death
                    if (isHardMode && handleHardModeRoundEnd) {
                        addLog('DEALER DIED (BLOOD CONTRACT).', 'safe');
                        handleHardModeRoundEnd('PLAYER');
                        return;
                    }
                    if (isMultiplayer && handleMPRoundEnd) {
                        addLog('DEALER DIED (BLOOD CONTRACT).', 'safe');
                        handleMPRoundEnd('PLAYER');
                        return;
                    }
                    if (!isMultiplayer && !isHardMode && handleNormalModeRoundEnd) {
                        addLog('DEALER DIED (BLOOD CONTRACT).', 'safe');
                        handleNormalModeRoundEnd('PLAYER');
                        return;
                    }
                    setGameState(prev => ({ ...prev, winner: 'PLAYER', phase: 'GAME_OVER' }));
                    addLog('DEALER DIED (BLOOD CONTRACT).', 'safe');
                    await wait(1500);
                    if (setOverlayColor) setOverlayColor('none');
                    return; // End execution
                }
            } else {
                setDealer(d => ({ ...d, hp: newHp }));
            }
        }

        await wait(800); // Wait for pain

    // 2. Grant Loot
    const activeCharmsCount = user === 'PLAYER' ? (player.luckycharmsUsed || 0) : (dealer.luckycharmsUsed || 0);
    const newItems = getContractLoot(activeCharmsCount);
    const itemNames = newItems.join(' & ');

    if (user === 'PLAYER') {
        setPlayer(p => {
            const current = p.items;
            const combined = [...current, ...newItems].slice(0, MAX_ITEMS);
            return { ...p, items: combined, luckycharmsUsed: 0 };
        });
        if (setOverlayText) {
            setOverlayText('🩸 BLOOD ACCEPTED 🩸');
            setTimeout(() => {
                if (setOverlayText) {
                    setOverlayText('OFFERING RECEIVED...');
                    setTimeout(() => setOverlayText?.(null), 2000);
                }
            }, 2500);
        }
    } else {
        setDealer(d => {
            const combined = [...d.items, ...newItems].slice(0, MAX_ITEMS);
            return { ...d, items: combined, luckycharmsUsed: 0 };
        });
    }

    addLog(`${user} SACRIFICED HP FOR: ${itemNames}`, 'danger');
    await wait(1000);
};

export const handleBeer = async (
    gameState: GameState,
    setGameState: StateSetter<GameState>,
    setTriggerRack: StateSetter<number>,
    setEjectedShellColor: StateSetter<AnimationState['ejectedShellColor']>,
    setTriggerDrink: StateSetter<number>,
    setOverlayText: StateSetter<string | null>,
    addLog: (text: string, type: LogEntry['type']) => void,
    startRound: () => void,
    onBatchEnd?: () => void
): Promise<boolean> => {
    setTriggerDrink(p => p + 1); // Visual cue
    await wait(1500); // Wait for drinking animation

    const shell = gameState.chamber[gameState.currentShellIndex];
    setEjectedShellColor(shell === 'LIVE' ? 'red' : 'blue');
    setTriggerRack(p => p + 1);
    addLog(`RACKED: ${shell}`, shell === 'LIVE' ? 'danger' : 'safe');

    // Note: Beer does NOT consume Choke status (it remains active for the actual shot)
    // This is intended behavior.

    // Show overlay text for Beer result
    setOverlayText(`WAS ${shell}`);

    await wait(2000); // Wait for rack animation and message
    setOverlayText(null);

    const isLive = shell === 'LIVE';
    let roundEnded = false;

    setGameState(prev => {
        const next = prev.currentShellIndex + 1;
        return {
            ...prev,
            currentShellIndex: next,
            liveCount: isLive ? prev.liveCount - 1 : prev.liveCount,
            blankCount: !isLive ? prev.blankCount - 1 : prev.blankCount
        };
    });

    if (gameState.currentShellIndex + 1 >= gameState.chamber.length) {
        if (gameState.isMultiplayer) {
            if (onBatchEnd) {
                onBatchEnd();
            } else {
                setOverlayText("WAITING FOR HOST...");
            }
        } else {
            setTimeout(startRound, 1000);
        }
        roundEnded = true;
    }

    await wait(300); // Final sync
    return roundEnded;
};

export const handleCigs = async (
    user: TurnOwner,
    setPlayer: StateSetter<PlayerState>,
    setDealer: StateSetter<PlayerState>,
    setTriggerHeal: StateSetter<number>
) => {
    setTriggerHeal(p => p + 1);
    // audioManager.playSound('grab', { playbackRate: 1.5 }); // Lighter sound
    await wait(2500); // Wait for smoking animation to complete
    if (user === 'PLAYER') setPlayer(p => ({ ...p, hp: Math.min(p.maxHp, p.hp + 1) }));
    else setDealer(d => ({ ...d, hp: Math.min(d.maxHp, d.hp + 1) }));
    await wait(500); // Brief pause after
};

export const handleSaw = async (
    user: TurnOwner,
    setPlayer: StateSetter<PlayerState>,
    setDealer: StateSetter<PlayerState>,
    setTriggerSparks: StateSetter<number>,
    setIsSawing: StateSetter<boolean>
) => {
    setIsSawing(true);
    setTriggerSparks(p => p + 1);
    await wait(1500); // Wait for saw animation
    setIsSawing(false);

    if (user === 'PLAYER') setPlayer(p => ({ ...p, isSawedActive: true }));
    else setDealer(d => ({ ...d, isSawedActive: true }));
    await wait(500); // Brief pause after
};

export const handleCuffs = async (
    user: TurnOwner,
    setPlayer: StateSetter<PlayerState>,
    setDealer: StateSetter<PlayerState>,
    setTriggerCuff: StateSetter<number>
) => {
    setTriggerCuff(p => p + 1);
    // audioManager.playSound('blankshell', { playbackRate: 2.0 }); // High click
    await wait(1500); // Wait for cuff animation to complete
    if (user === 'PLAYER') setDealer(d => ({ ...d, isHandcuffed: true }));
    else setPlayer(p => ({ ...p, isHandcuffed: true }));
    await wait(300); // Final sync
};

export const handleGlass = async (
    user: TurnOwner,
    gameState: GameState,
    setKnownShell: StateSetter<ShellType | null>,
    setTriggerGlass: StateSetter<number>,
    addLog: (text: string, type: LogEntry['type']) => void
) => {
    // 1. Instant Animation Trigger
    setTriggerGlass(p => p + 1);
    // audioManager.playSound('grab', { playbackRate: 1.2 }); // Glass click


    // 2. Delay for lift up animation
    await wait(1200);

    const nextShell = gameState.chamber[gameState.currentShellIndex];

    if (user === 'PLAYER') {
        setKnownShell(nextShell);
        addLog(`IT IS ${nextShell}`, 'info');
        // Clear after 2.5 seconds
        setTimeout(() => setKnownShell(null), 2500);
        await wait(1200); // Wait for player to see result
    } else {
        // Dealer uses it: AI logic knows the shell, but we DO NOT show it to player
        addLog(`DEALER INSPECTS CHAMBER`, 'dealer');
        await wait(1500);
    }
    await wait(300); // Final sync
};

export const handlePhone = async (
    user: TurnOwner,
    gameState: GameState,
    setTriggerPhone: StateSetter<number>,
    addLog: (text: string, type: LogEntry['type']) => void,
    setOverlayText?: StateSetter<string | null>
) => {
    setTriggerPhone(p => p + 1);
    // audioManager.playSound('grab', { playbackRate: 0.8 }); // Heavy plastic
    await wait(2500); // Wait for phone animation

    const checkLimit = gameState.chamber.length;
    const current = gameState.currentShellIndex;

    // Logic: Reveal a random shell from future rounds.
    const available = [];
    for (let i = current + 2; i < checkLimit; i++) {
        available.push(i);
    }

    if (available.length === 0 || gameState.chamber.length === 3) {
        if (user === 'PLAYER') {
            const msg = "YOU ARE ON YOUR OWN BUD";
            addLog("📞 NO INTEL AVAILABLE", 'neutral');
            if (setOverlayText) {
                setOverlayText(msg);
                setTimeout(() => setOverlayText?.(null), 2500);
            }
        } else {
            addLog("DEALER CHECKS PHONE", 'dealer');
        }
    } else {
        const randomIndex = available[Math.floor(Math.random() * available.length)];
        const actualShell = gameState.chamber[randomIndex];
        const offset = randomIndex - current;

        // 5% chance to LIE about the shell type
        const isLying = Math.random() < 0.05;
        const displayedShell = isLying ? (actualShell === 'LIVE' ? 'BLANK' : 'LIVE') : actualShell;

        let positionText = "";
        if (offset === 2) positionText = "3RD SHELL";
        else if (offset === 3) positionText = "4TH SHELL";
        else if (offset === 4) positionText = "5TH SHELL";
        else positionText = `${offset + 1}TH SHELL`;

        if (user === 'PLAYER') {
            const displayText = `📞 ${positionText} IS ${displayedShell}`;
            addLog(`${positionText} IS ${displayedShell}`, 'info');
            if (setOverlayText) {
                setOverlayText(displayText);
                setTimeout(() => setOverlayText?.(null), 3000);
            }
        } else {
            // Dealer gets the REAL info (AI knows truth)
            addLog(`DEALER USES PHONE`, 'dealer');
        }
    }
    await wait(2500); // Wait for full phone animation and result display
};

export const handleInverter = async (
    user: TurnOwner,
    gameState: GameState,
    setGameState: StateSetter<GameState>,
    setTriggerInverter: StateSetter<number>,
    addLog: (text: string, type: LogEntry['type']) => void,
    setOverlayText?: StateSetter<string | null>
) => {
    setTriggerInverter(p => p + 1);
    // audioManager.playSound('blankshell', { playbackRate: 1.8 }); // Electronic click
    await wait(1500); // Wait for animation to play

    const currentShell = gameState.chamber[gameState.currentShellIndex];
    const newType = currentShell === 'LIVE' ? 'BLANK' : 'LIVE';

    setGameState(prev => {
        const newChamber = [...prev.chamber];
        newChamber[prev.currentShellIndex] = newType;

        // Update counts
        const isLiveNow = newType === 'LIVE';
        return {
            ...prev,
            chamber: newChamber,
            liveCount: isLiveNow ? prev.liveCount + 1 : prev.liveCount - 1,
            blankCount: !isLiveNow ? prev.blankCount + 1 : prev.blankCount - 1
        };
    });

    addLog(`${user} INVERTED POLARITY`, 'info');

    // Display POLARITY CHANGED message on screen
    if (setOverlayText) {
        setOverlayText('⚡ POLARITY CHANGED ⚡');
        setTimeout(() => setOverlayText(null), 2000);
    }

    await wait(800); // Final sync
};

export const handleBigInverter = async (
    user: TurnOwner,
    gameState: GameState,
    setGameState: StateSetter<GameState>,
    setTriggerBigInverter: StateSetter<number>,
    addLog: (text: string, type: LogEntry['type']) => void,
    setOverlayText?: StateSetter<string | null>
) => {
    setTriggerBigInverter(p => p + 1);
    await wait(2800); // Wait for animation (longer for BIG effect)

    setGameState(prev => {
        const newChamber = [...prev.chamber];
        let newLive = 0;
        let newBlank = 0;

        // Invert ALL remaining shells
        for (let i = prev.currentShellIndex; i < newChamber.length; i++) {
            newChamber[i] = newChamber[i] === 'LIVE' ? 'BLANK' : 'LIVE';
        }

        // Recalculate counts properly based on remaining shells and inverted status
        // Note: liveCount/blankCount usually track remaining, so we recalculate from current index
        for (let i = prev.currentShellIndex; i < newChamber.length; i++) {
            if (newChamber[i] === 'LIVE') newLive++;
            else newBlank++;
        }

        return {
            ...prev,
            chamber: newChamber,
            liveCount: newLive,
            blankCount: newBlank
        };
    });

    addLog(`${user} INVERTED THE ENTIRE CHAMBER!`, 'danger');

    if (setOverlayText) {
        setOverlayText('⚡ TOTAL POLARITY REVERSAL ⚡');
        setTimeout(() => setOverlayText(null), 2500);
    }

    await wait(800);
};

export const handleAdrenaline = async (
    user: TurnOwner,
    setTriggerAdrenaline: StateSetter<number>,
    setGameState: StateSetter<GameState>,
    addLog: (text: string, type: LogEntry['type']) => void,
    setOverlayText?: StateSetter<string | null>,
    setOverlayColor?: StateSetter<'none' | 'red' | 'green' | 'scan'>
) => {
    setTriggerAdrenaline(p => p + 1);
    // audioManager.playSound('grab', { playbackRate: 1.0 }); // Normal grab

    await wait(500);
    // Heartbeat / Rush effect
    if (setOverlayColor) setOverlayColor('red');

    await wait(1300); // Wait for injection animation completion

    if (setOverlayColor) setOverlayColor('none');

    // Show message AFTER animation plays
    if (setOverlayText) {
        setOverlayText(user === 'PLAYER' ? '⚡ ADRENALINE RUSH ⚡' : '💉 DEALER SURGE');
        setTimeout(() => setOverlayText?.(null), 2000);
    }

    await wait(500); // Pause before phase change

    if (user === 'PLAYER') {
        addLog("TIME SLOWS DOWN... PICK AN ITEM TO STEAL", 'danger');
        setGameState(prev => ({ ...prev, phase: 'STEALING' }));
    } else {
        addLog("DEALER MOVING WITH UNNATURAL SPEED", 'dealer');
        // Dealer logic handles its own stealing flow in useDealerAI
    }
    await wait(300); // Final sync
};

export const handleChoke = async (
    user: TurnOwner,
    setPlayer: StateSetter<PlayerState>,
    setDealer: StateSetter<PlayerState>,
    setTriggerChoke: StateSetter<number>,
    addLog: (text: string, type: LogEntry['type']) => void
) => {
    setTriggerChoke(p => p + 1);
    // Audio handled in animations.ts
    await wait(1800); // Wait for animation (sound is ~1.5s)

    if (user === 'PLAYER') setPlayer(p => ({ ...p, isChokeActive: true }));
    else setDealer(d => ({ ...d, isChokeActive: true }));

    addLog(`${user === 'PLAYER' ? 'YOU' : 'DEALER'} ATTACHED CHOKE MOD`, 'danger');
    await wait(500);
};

export const handleRemote = async (
    user: TurnOwner,
    gameState: GameState,
    setGameState: StateSetter<GameState>,
    setTriggerRemote: StateSetter<number>,
    addLog: (text: string, type: LogEntry['type']) => void,
    setOverlayText?: StateSetter<string | null>
) => {
    setTriggerRemote(p => p + 1);
    await wait(2500); // Wait for animation

    const currentIdx = gameState.currentShellIndex;
    if (currentIdx + 1 < gameState.chamber.length) {
        // Swap Current with Next
        setGameState(prev => {
            const newChamber = [...prev.chamber];
            const s1 = newChamber[currentIdx];
            const s2 = newChamber[currentIdx + 1];
            newChamber[currentIdx] = s2;
            newChamber[currentIdx + 1] = s1;
            return { ...prev, chamber: newChamber };
        });

        addLog(`${user} SWAPPED SHELL ORDER`, 'info');
        if (setOverlayText) {
            setOverlayText('↻ CHAMBER CYCLED ↻');
            setTimeout(() => setOverlayText(null), 2000);
        }
    } else {
        addLog(`${user} TRIED REMOTE (FAILED)`, 'neutral');
    }

    await wait(800);
};

export const handleLuckycharm = async (
    user: TurnOwner,
    setPlayer: StateSetter<PlayerState>,
    setDealer: StateSetter<PlayerState>,
    setTriggerLuckycharm: StateSetter<number>,
    addLog: (text: string, type: LogEntry['type']) => void,
    setOverlayText?: StateSetter<string | null>
) => {
    setTriggerLuckycharm(p => p + 1);
    await wait(2500); // Wait for animation

    if (user === 'PLAYER') {
        setPlayer(p => ({ ...p, luckycharmsUsed: (p.luckycharmsUsed || 0) + 1 }));
        if (setOverlayText) {
            setOverlayText('🍀 LUCK CHARMED 🍀\nHope you will get better items');
            setTimeout(() => setOverlayText(null), 2500);
        }
        addLog("YOU ACTIVATED LUCKY CHARM: Next shipment improved", 'safe');
    } else {
        setDealer(d => ({ ...d, luckycharmsUsed: (d.luckycharmsUsed || 0) + 1 }));
        addLog("DEALER ACTIVATED LUCKY CHARM: Next shipment improved", 'dealer');
    }

    await wait(800);
};

export const handleFlashbang = async (
    user: TurnOwner,
    setPlayer: StateSetter<PlayerState>,
    setDealer: StateSetter<PlayerState>,
    setTriggerFlashbang: StateSetter<number>,
    addLog: (text: string, type: LogEntry['type']) => void,
    setOverlayText?: StateSetter<string | null>,
    setShowFlashbang?: StateSetter<boolean>
) => {
    setTriggerFlashbang(p => p + 1);
    await wait(1500); // Wait for animation fuse cooking

    // Detonate!
    if (setShowFlashbang) setShowFlashbang(true);

    await wait(400); // White screen peak

    if (user === 'PLAYER') {
        setDealer(d => ({ ...d, isFlashbanged: true }));
        if (setOverlayText) {
            setOverlayText('💥 FLASHBANGED 💥\nOpponent cannot use items next turn');
            setTimeout(() => setOverlayText(null), 2500);
        }
        addLog("YOU FLASHBANGED THE DEALER: Items blocked on their next turn", 'safe');
    } else {
        setPlayer(p => ({ ...p, isFlashbanged: true }));
        if (setOverlayText) {
            setOverlayText('💥 BLINDED! 💥\nYou cannot use items next turn');
            setTimeout(() => setOverlayText(null), 2500);
        }
        addLog("DEALER FLASHBANGED YOU: Items blocked on your next turn", 'danger');
    }

    await wait(1800); // Let the screen blind fade out
    if (setShowFlashbang) setShowFlashbang(false);
};

const getFriendlyItemName = (item: ItemType): string => {
    const names: Record<ItemType, string> = {
        'BEER': 'Beer',
        'CIGS': 'Cigarettes',
        'GLASS': 'Magnifying Glass',
        'CUFFS': 'Handcuffs',
        'SAW': 'Hand Saw',
        'PHONE': 'Burner Phone',
        'INVERTER': 'Polarity Inverter',
        'ADRENALINE': 'Adrenaline',
        'CHOKE': 'Choke Mod',
        'REMOTE': 'Remote Control',
        'BIG_INVERTER': 'Big Inverter',
        'CONTRACT': 'Blood Contract',
        'LUCKYCHARM': 'Lucky Charm',
        'FLASHBANG': 'Flashbang',
        'CRUSHER': 'Item Crusher',
        'TOTEM': 'Totem of Undying',
        'MIRROR': 'Mirror',
        'DECK_CARD': 'Tarot Card',
        'JACKPOT': 'Jackpot Slot Machine'
    };
    return names[item] || item;
};

export const handleCrusher = async (
    user: TurnOwner,
    player: PlayerState,
    dealer: PlayerState,
    setPlayer: StateSetter<PlayerState>,
    setDealer: StateSetter<PlayerState>,
    setTriggerCrusher: StateSetter<number>,
    addLog: (text: string, type: LogEntry['type']) => void,
    setOverlayText?: StateSetter<string | null>
) => {
    // 1. Trigger animation
    setTriggerCrusher(p => p + 1);

    // 2. Wait for impact (1.3s in animation)
    await wait(1300);

    const target = user === 'PLAYER' ? dealer : player;
    const targetSetter = user === 'PLAYER' ? setDealer : setPlayer;

    if (target.items.length === 0) {
        if (setOverlayText) {
            setOverlayText(user === 'PLAYER' ? "Dealer's inventory is empty!" : "Your inventory is empty!");
            setTimeout(() => setOverlayText(null), 2000);
        }
        addLog(user === 'PLAYER' ? "YOU USED CRUSHER: Opponent has no items to destroy!" : "DEALER USED CRUSHER: You have no items to destroy!", 'safe');
        await wait(900); // Wait for remainder of 2.2s animation
        return;
    }

    // Determine the item to destroy based on the fresh copy of target items
    const randomIndex = Math.floor(Math.random() * target.items.length);
    const itemToDestroy = target.items[randomIndex];
    const friendlyName = getFriendlyItemName(itemToDestroy);

    // Remove the item from the state safely by value-matching (find the first index of this item)
    targetSetter(prev => {
        const idx = prev.items.indexOf(itemToDestroy);
        if (idx === -1) return prev; // If not found, fallback safely
        const newItems = [...prev.items];
        newItems.splice(idx, 1);
        return { ...prev, items: newItems };
    });

    if (setOverlayText) {
        const ownerName = user === 'PLAYER' ? "Dealer's" : "Player's";
        setOverlayText(`DESTROYED_ITEM::${itemToDestroy}::${ownerName}::${friendlyName}`);
        setTimeout(() => setOverlayText(null), 4000);
    }

    if (user === 'PLAYER') {
        addLog(`YOU CRUSHED DEALER'S ITEM: Destroyed 1 ${friendlyName}`, 'safe');
    } else {
        addLog(`DEALER CRUSHED YOUR ITEM: Destroyed 1 ${friendlyName}`, 'danger');
    }

    await wait(900); // Wait for remainder of 2.2s animation
};


