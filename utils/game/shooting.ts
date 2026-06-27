import React from 'react';
import { GameState, PlayerState, TurnOwner, ShellType, LogEntry, AnimationState, AimTarget, CameraView } from '../../types';
import { wait } from '../gameUtils';
import { audioManager } from '../audioManager';
import { MatchStats } from '../../utils/statsManager';

type StateSetter<T> = React.Dispatch<React.SetStateAction<T>>;

interface ShootingContext {
    gameState: GameState;
    setGameState: StateSetter<GameState>;
    player: PlayerState;
    setPlayer: StateSetter<PlayerState>;
    dealer: PlayerState;
    setDealer: StateSetter<PlayerState>;
    setAnim: (update: Partial<AnimationState> | ((prev: AnimationState) => Partial<AnimationState>)) => void;
    setKnownShell: StateSetter<ShellType | null>;
    setAimTarget: StateSetter<AimTarget>;
    setCameraView: StateSetter<CameraView>;
    setOverlayText: StateSetter<string | null>;
    setOverlayColor: StateSetter<'none' | 'red' | 'green' | 'scan'>;
    setShowFlash: StateSetter<boolean>;
    setShowBlood: StateSetter<boolean>;
    addLog: (text: string, type: LogEntry['type']) => void;
    playerName: string;
    startRound: (resetItems?: boolean) => void;
    setIsProcessing: StateSetter<boolean>;
    matchStats?: React.MutableRefObject<MatchStats>; // Added
    handleHardModeRoundEnd?: (winner: TurnOwner) => void;
    handleMPRoundEnd?: (winner: TurnOwner) => void;
    handleNormalModeRoundEnd?: (winner: TurnOwner) => void;
    opponentName: string;
    onBatchEnd?: () => void;
}

export const performShot = async (
    shooter: TurnOwner,
    target: TurnOwner,
    ctx: ShootingContext
) => {
    const {
        gameState, setGameState, player, setPlayer, dealer, setDealer,
        setAnim, setKnownShell, setAimTarget, setCameraView, setOverlayText, setOverlayColor,
        setShowFlash, setShowBlood, addLog, playerName, startRound, setIsProcessing, matchStats,
        handleHardModeRoundEnd, handleMPRoundEnd, handleNormalModeRoundEnd, opponentName, onBatchEnd
    } = ctx;

    setIsProcessing(true);
    // Align gun before firing
    await wait(450);

    const { chamber, currentShellIndex } = gameState;

    if (currentShellIndex >= chamber.length) {
        setGameState(prev => ({ ...prev, phase: 'RESOLVING' })); // Mark as resolving while waiting
        console.log("CHAMBER EMPTY - SYNCING...");
        if (gameState.isMultiplayer) {
            if (onBatchEnd) {
                onBatchEnd();
            } else {
                addLog("WAITING FOR REPLENISHMENT...", 'info');
                setOverlayText("WAITING FOR HOST...");
            }
        } else {
            startRound();
        }
        // Don't setIsProcessing(false) yet, we are waiting for the next round
        return;
    }

    setGameState(prev => ({ ...prev, phase: 'RESOLVING' }));

    const shell = chamber[currentShellIndex];
    const isLive = shell === 'LIVE';

    const isSawed = shooter === 'PLAYER' ? player.isSawedActive : dealer.isSawedActive;
    const isChoked = shooter === 'PLAYER' ? player.isChokeActive : dealer.isChokeActive;

    // Pre-calculate if this shot will "HIT" (important for animations)
    let willHit = isLive;
    let anyLive = isLive;
    if (isChoked && currentShellIndex + 1 < chamber.length) {
        anyLive = chamber[currentShellIndex] === 'LIVE' || chamber[currentShellIndex + 1] === 'LIVE';
        willHit = anyLive;
    }

    // Pre-calculate damage and totem save to prevent double falling animation
    let damage = isLive ? 1 : 0;
    if (isChoked && currentShellIndex + 1 < chamber.length) {
        const shell1 = chamber[currentShellIndex];
        const shell2 = chamber[currentShellIndex + 1];
        const live1 = shell1 === 'LIVE';
        const live2 = shell2 === 'LIVE';
        let chokeDamage = (live1 && live2) ? 2 : ((live1 || live2) ? 1 : 0);
        if (isSawed && chokeDamage > 0) chokeDamage *= 2;
        damage = chokeDamage;
    } else {
        if (isLive && isSawed) damage = 2;
    }

    const isLethal = willHit && damage >= (target === 'PLAYER' ? player.hp : dealer.hp);
    const targetIsFlashbanged = target === 'PLAYER' ? player.isFlashbanged : dealer.isFlashbanged;
    const targetHasTotem = (target === 'PLAYER' ? player.items.includes('TOTEM') : dealer.items.includes('TOTEM')) && !targetIsFlashbanged;
    const isSavedByTotem = isLethal && targetHasTotem;

    setTimeout(() => {
        if (anyLive) audioManager.playSound('liveshell');
        else audioManager.playSound('blankshell');
    }, 50);

    setAnim(prev => ({
        ...prev,
        isLiveShot: anyLive,
        triggerRecoil: prev.triggerRecoil + 1,
        muzzleFlashIntensity: anyLive ? 120 : 0
    }));

    if (willHit && target === 'DEALER') {
        // INSTANT HIT
        setAnim(prev => ({ ...prev, dealerHit: true, dealerDropping: true }));
        setTimeout(() => setAnim(prev => ({ ...prev, dealerHit: false })), 200);
    }

    if (willHit && target === 'PLAYER') {
        // INSTANT HIT - Player knocked down
        if (isSavedByTotem) {
            setAnim(prev => ({ ...prev, playerHit: true, playerRecovering: false }));
            setOverlayColor('red');
            setShowBlood(true);
            setTimeout(() => {
                setShowBlood(false);
                setOverlayColor('none');
            }, 2500);
        } else {
            setAnim(prev => ({ ...prev, playerHit: true, playerRecovering: true }));
            setOverlayColor('red');
            setShowBlood(true);
            setTimeout(() => {
                setAnim(prev => ({ ...prev, playerHit: false }));
                setShowBlood(false);
                setOverlayColor('none');
                setTimeout(() => {
                    setAnim(prev => ({ ...prev, playerRecovering: false }));
                }, 2000);
            }, 2500);
        }
    }

    if (anyLive) {
        setShowFlash(true);
        setTimeout(() => {
            setShowFlash(false);
            setAnim({ muzzleFlashIntensity: 0 });
        }, 100);
    }

    setOverlayText(shell);

    damage = isLive ? 1 : 0;
    // (Variables isSawed/isChoked already declared above)

    // --- CHOKE LOGIC ---
    let processedShells = 1;

    if (isChoked && currentShellIndex + 1 < chamber.length) {
        // We have at least 2 shells to fire
        processedShells = 2;
        const shell1 = chamber[currentShellIndex];
        const shell2 = chamber[currentShellIndex + 1];

        let chokeDamage = 0;
        const live1 = shell1 === 'LIVE';
        const live2 = shell2 === 'LIVE';

        // Calculate Damage
        if (live1 && live2) {
            chokeDamage = 2; // Double Base
            addLog('DOUBLE BARREL HIT! (2 LIVE)', 'danger');
        } else if (live1 || live2) {
            chokeDamage = 1; // Normal Base
            addLog('SPLIT SHOT (1 LIVE)', 'danger');
        } else {
            chokeDamage = 0;
            addLog('DOUBLE CLICK (2 BLANK)', 'safe');
        }

        // Apply Saw Multiplier to the result
        if (isSawed && chokeDamage > 0) {
            chokeDamage *= 2; // Multiplies the result (so 2->4, 1->2)
            addLog('CRITICAL MASS! (SAWED+CHOKE)', 'danger');
        }

        damage = chokeDamage;

        // Sounds / Flash
        if (live1 || live2) {
            setAnim(prev => ({ ...prev, muzzleFlashIntensity: 150, triggerRecoil: prev.triggerRecoil + 1 })); // Bigger kick
            if (live1 && live2) audioManager.playSound('liveshell', { playbackRate: 0.8 }); // Lower boom
            else audioManager.playSound('liveshell');
        } else {
            audioManager.playSound('blankshell');
            setTimeout(() => audioManager.playSound('blankshell'), 150);
        }

        setOverlayText(`${shell1} + ${shell2}`);

    } else {
        // --- NORMAL SHOT LOGIC ---
        // (Includes Fallback if Choke active but only 1 shell left -> Acts normal)
        if (isChoked) addLog("(CHOKE FAILED - 1 SHELL LEFT)", 'neutral');

        damage = isLive ? 1 : 0;
        if (isLive && isSawed) {
            damage = 2;
            addLog('CRITICAL HIT! (SAWED-OFF)', 'danger');
        }
        addLog(isLive ? `BANG! ${damage} DMG` : 'CLICK.', isLive ? 'danger' : 'safe');
    }

    // Update Match Stats
    if (matchStats && matchStats.current) {
        if (damage > 0) {
            if (target === 'PLAYER') matchStats.current.damageTaken += damage;
            else if (target === 'DEALER' && shooter === 'PLAYER') {
                matchStats.current.damageDealt += damage;
                matchStats.current.shotsHit++;
            }
        }
    }

    // --- INSTANT SHELL COUNT UPDATE ---
    let consumedLives = 0;
    let consumedBlanks = 0;
    for (let i = 0; i < processedShells; i++) {
        if (chamber[currentShellIndex + i] === 'LIVE') consumedLives++;
        else consumedBlanks++;
    }
    const nextIndex = currentShellIndex + processedShells;

    setGameState(prev => {
        let finalLivesDecrement = consumedLives;
        let finalBlanksDecrement = consumedBlanks;
        if (consumedLives > prev.liveCount) {
            const excess = consumedLives - prev.liveCount;
            finalLivesDecrement = prev.liveCount;
            finalBlanksDecrement = consumedBlanks + excess;
        }
        return {
            ...prev,
            currentShellIndex: nextIndex,
            liveCount: Math.max(0, prev.liveCount - finalLivesDecrement),
            blankCount: Math.max(0, prev.blankCount - finalBlanksDecrement)
        };
    });

    // Rack Sequence
    await wait(500);

    let shellColorStr: 'red' | 'blue' | 'red+red' | 'red+blue' | 'blue+red' | 'blue+blue' = isLive ? 'red' : 'blue';

    if (processedShells === 2) {
        const s1 = chamber[currentShellIndex] === 'LIVE' ? 'red' : 'blue';
        const s2 = chamber[currentShellIndex + 1] === 'LIVE' ? 'red' : 'blue';
        shellColorStr = `${s1}+${s2}` as any;
    }

    setAnim(prev => ({
        ...prev,
        ejectedShellColor: shellColorStr,
        triggerRack: prev.triggerRack + 1
    }));

    await wait(800); // Shorter
    setOverlayText(null);
    setAimTarget('IDLE');

    // Reset Saw and Choke
    if (shooter === 'PLAYER') setPlayer(p => ({ ...p, isSawedActive: false, isChokeActive: false }));
    else setDealer(d => ({ ...d, isSawedActive: false, isChokeActive: false }));

    // Handle Damage & Win Check
    let gameOver = false;



    if (damage > 0) {
        if (target === 'PLAYER') {
            const hasJackpot = player.jackpotImmunityShots !== undefined && player.jackpotImmunityShots > 0;
            const nextImmunity = Math.max(0, (player.jackpotImmunityShots || 0) - processedShells);

            if (hasJackpot) {
                // Decrement jackpot shots
                setPlayer(p => ({ ...p, jackpotImmunityShots: nextImmunity }));
                if (nextImmunity <= 0) {
                    audioManager.stopJackpotMusic();
                }

                // RCT Sequence
                const originalHp = player.hp;
                const tempHp = Math.max(0, originalHp - damage);

                setPlayer(p => ({ ...p, hp: tempHp }));
                setOverlayColor('red');
                setOverlayText('✨ REVERSE CURSED TECHNIQUE ✨');
                setAnim(prev => ({ ...prev, playerHit: true, playerRecovering: false }));

                await wait(1800);

                setPlayer(p => ({ ...p, hp: originalHp }));
                setOverlayText('✨ RCT: HEALED! ✨');
                setOverlayColor('green');

                setAnim(prev => ({ ...prev, playerHit: false, playerRecovering: true }));
                await wait(1500);
                setAnim(prev => ({ ...prev, playerRecovering: false }));
                setOverlayColor('none');
                setOverlayText(null);
            } else {
                let newHp = Math.max(0, player.hp - damage);
                const hasTotem = player.items.includes('TOTEM') && !player.isFlashbanged;

                if (newHp <= 0 && hasTotem) {
                    newHp = 1;
                    setPlayer(p => {
                        const idx = p.items.indexOf('TOTEM');
                        const newItems = [...p.items];
                        if (idx !== -1) newItems.splice(idx, 1);
                        return { ...p, hp: 1, items: newItems };
                    });

                    // Trigger Totem VFX & SFX
                    setOverlayText('✨ TOTEM ACTIVATED ✨\nSurvives at 1 HP!');
                    setAnim(prev => ({
                        ...prev,
                        triggerTotem: (prev.triggerTotem || 0) + 1,
                        totemTarget: 'PLAYER'
                    }));
                    audioManager.playSound('totem');
                    addLog("PLAYER'S TOTEM ACTIVATED: Survived lethal damage at 1 HP!", 'safe');

                    // Wait for Totem animation to play out
                    await wait(3000);
                    setOverlayText(null);

                    // Hurt and recovery animation
                    setOverlayColor('red');
                    setAnim(prev => ({ ...prev, playerHit: false, playerRecovering: true }));
                    await wait(2200);
                    setAnim(prev => ({ ...prev, playerRecovering: false }));
                    setOverlayColor('none');
                } else {
                    setPlayer(p => ({ ...p, hp: newHp }));

                    if (newHp <= 0) {
                        if (gameState.isHardMode && handleHardModeRoundEnd) {
                            addLog('ROUND LOST', 'danger');
                            handleHardModeRoundEnd('DEALER');
                            setIsProcessing(false);
                            return;
                        }
                        if (gameState.isMultiplayer && handleMPRoundEnd) {
                            addLog('ROUND LOST', 'danger');
                            handleMPRoundEnd('DEALER');
                            setIsProcessing(false);
                            return;
                        }
                        if (!gameState.isMultiplayer && !gameState.isHardMode && handleNormalModeRoundEnd) {
                            addLog('ROUND LOST', 'danger');
                            handleNormalModeRoundEnd('DEALER');
                            setIsProcessing(false);
                            return;
                        }
                        setGameState(prev => ({ ...prev, winner: 'DEALER', phase: 'GAME_OVER' }));
                        if (matchStats?.current) matchStats.current.result = 'LOSS';
                        gameOver = true;
                        addLog('YOU DIED.', 'danger');
                    } else {
                        setOverlayColor('red');
                        setAnim(prev => ({ ...prev, playerHit: true }));
                        await wait(1800);
                        setAnim(prev => ({ ...prev, playerHit: false, playerRecovering: true }));
                        await wait(1500);
                        setAnim(prev => ({ ...prev, playerRecovering: false }));
                        setOverlayColor('none');
                    }
                }
            }
        } else {
            let newHp = Math.max(0, dealer.hp - damage);
            const hasTotem = dealer.items.includes('TOTEM') && !dealer.isFlashbanged;

            if (newHp <= 0 && hasTotem) {
                newHp = 1;
                setDealer(d => {
                    const idx = d.items.indexOf('TOTEM');
                    const newItems = [...d.items];
                    if (idx !== -1) newItems.splice(idx, 1);
                    return { ...d, hp: 1, items: newItems };
                });

                // Trigger Totem VFX & SFX
                setOverlayText('✨ TOTEM ACTIVATED ✨\nDealer survives at 1 HP!');
                setAnim(prev => ({
                    ...prev,
                    triggerTotem: (prev.triggerTotem || 0) + 1,
                    totemTarget: 'DEALER'
                }));
                audioManager.playSound('totem');
                addLog("DEALER'S TOTEM ACTIVATED: Survived lethal damage at 1 HP!", 'safe');

                // Wait for Totem animation
                await wait(3000);
                setOverlayText(null);

                // Hurt and recovery
                setOverlayColor('green');
                setAnim(prev => ({ ...prev, dealerHit: false, dealerRecovering: true, dealerDropping: false }));
                await wait(2200);
                setAnim(prev => ({ ...prev, dealerRecovering: false }));
                setOverlayColor('none');
            } else {
                setDealer(d => ({ ...d, hp: newHp }));

                if (newHp <= 0) {
                    if (gameState.isHardMode && handleHardModeRoundEnd) {
                        addLog('ROUND WON', 'safe');
                        handleHardModeRoundEnd('PLAYER');
                        setIsProcessing(false);
                        return;
                    }
                    if (gameState.isMultiplayer && handleMPRoundEnd) {
                        addLog('ROUND WON', 'safe');
                        handleMPRoundEnd('PLAYER');
                        setIsProcessing(false);
                        return;
                    }
                    if (!gameState.isMultiplayer && !gameState.isHardMode && handleNormalModeRoundEnd) {
                        addLog('ROUND WON', 'safe');
                        handleNormalModeRoundEnd('PLAYER');
                        setIsProcessing(false);
                        return;
                    }
                    setGameState(prev => ({ ...prev, winner: 'PLAYER', phase: 'GAME_OVER' }));
                    if (matchStats?.current) matchStats.current.result = 'WIN';
                    gameOver = true;
                    addLog(`${opponentName.toUpperCase()} ELIMINATED.`, 'safe');
                } else {
                    setOverlayColor('green');
                    setAnim(prev => ({ ...prev, dealerHit: true, dealerDropping: true }));
                    await wait(1200);
                    setAnim(prev => ({ ...prev, dealerHit: false, dealerRecovering: true }));
                    await wait(1200);
                    setAnim(prev => ({ ...prev, dealerDropping: false }));
                    await wait(1000);
                    setAnim(prev => ({ ...prev, dealerRecovering: false }));
                    setOverlayColor('none');
                }
            }
        }
    }

    if (gameOver) {
        setIsProcessing(false);
        return;
    }

    setKnownShell(null);
    await wait(400); // Shorter pause

    const remaining = chamber.length - nextIndex;

    if (remaining === 0) {
        setGameState(prev => ({ ...prev, phase: 'RESOLVING' })); // Mark as resolving while waiting
        console.log("NO SHELLS REMAINING - SYNCING...");
        if (gameState.isMultiplayer) {
            if (onBatchEnd) {
                onBatchEnd();
            } else {
                addLog("WAITING FOR REPLENISHMENT...", 'info');
                setOverlayText("WAITING FOR HOST...");
            }
        } else {
            startRound();
        }
        // Don't setIsProcessing(false) yet
        return;
    }

    // Pass Turn Logic
    // - Shoot self (Blank) -> Go again (Keep Turn).
    // - Any other case -> Pass Turn.
    // Pass Turn Logic
    // - Shoot self (Blank) -> Go again (Keep Turn).
    // - BUT Choke Special Rule: If you shoot 2 Blanks at self... do you go again? 
    //   Usually "Blank allows go again". IF BOTH are blank, logic implies "Nothing happens" = Go again?
    //   Prompt says "If both blank, nothing happens." -> Assume Turn Retained on full blank volley if target self.
    //   Mixed (Live+Blank) deals damage -> Turn Lost.

    const isSuccessSelf = target === shooter && damage === 0;
    const keepTurn = isSuccessSelf;
    let nextOwner = keepTurn ? shooter : (shooter === 'PLAYER' ? 'DEALER' : 'PLAYER');
    let turnChanged = !keepTurn;

    const shooterName = shooter === 'PLAYER' ? playerName.toUpperCase() : opponentName.toUpperCase();
    if (keepTurn) {
        addLog(`${shooterName} GOES AGAIN`, 'neutral');
    }

    // Handle Handcuffs Logic
    let skipped = false;
    if (turnChanged) {
        const nextPersonState = nextOwner === 'PLAYER' ? player : dealer;
        const nextPersonName = nextOwner === 'PLAYER' ? playerName.toUpperCase() : opponentName.toUpperCase();
        if (nextPersonState.isHandcuffed) {
            const message = `${nextPersonName} CUFFED. SKIPPING.`;
            addLog(message, 'info');
            setOverlayText(`${nextOwner} CUFFED`);
            audioManager.playSound('checkhandcuffs');

            await wait(2800); // Slower
            setOverlayText(null);

            if (nextOwner === 'PLAYER') setPlayer(p => ({ ...p, isHandcuffed: false }));
            else setDealer(d => ({ ...d, isHandcuffed: false }));

            nextOwner = shooter;
            skipped = true;
        }
    }

    const ownerPhase = nextOwner === 'PLAYER' ? 'PLAYER_TURN' : 'DEALER_TURN';
    setGameState(prev => ({ ...prev, turnOwner: nextOwner, phase: ownerPhase, lastTurnWasSkipped: skipped }));
    setCameraView(nextOwner === 'PLAYER' ? 'PLAYER' : 'DEALER');
    // Originally setCameraView(nextOwner === 'PLAYER' ? 'PLAYER' : 'PLAYER'); // Wait, why both PLAYER?
    // Original code: setCameraView(nextOwner === 'PLAYER' ? 'PLAYER' : 'PLAYER'); 
    // Yes, originally it forced PLAYER view even if dealer turn, maybe because DealerAI handles view switching? 
    // Or maybe it's a bug/feature. I'll keep it as is.

    if (turnChanged) {
        if (shooter === 'PLAYER') setPlayer(p => ({ ...p, isFlashbanged: false }));
        else setDealer(d => ({ ...d, isFlashbanged: false }));
    }

    setIsProcessing(false);
};
