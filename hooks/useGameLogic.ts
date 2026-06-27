  import { useState, useEffect, useRef } from 'react';
import { GameState, PlayerState, ShellType, ItemType, LogEntry, TurnOwner, CameraView, AimTarget, AnimationState, RoomSettings, TarotCard } from '../types';
import { MAX_HP, MAX_ITEMS, ITEMS } from '../constants';
import { randomInt, wait } from '../utils/gameUtils';
import * as ItemActions from '../utils/game/itemActions';
import { audioManager } from '../utils/audioManager';
import { performShot } from '../utils/game/shooting';
import { distributeItems as distributeItemsAction, getRandomItem } from '../utils/game/inventory';
import { MatchStats } from '../utils/statsManager';

export const useGameLogic = () => {
  // --- State ---
  const [playerName, setPlayerName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const onBatchEndRef = useRef<(() => void) | null>(null);

  const [gameState, setGameState] = useState<GameState>({
    phase: 'BOOT',
    turnOwner: 'PLAYER',
    winner: null,
    chamber: [],
    currentShellIndex: 0,
    liveCount: 0,
    blankCount: 0,
    roundCount: 0,
    isHardMode: false,
    roomSettings: { rounds: 1, hp: 2, itemsPerShipment: 4 },
    multiModeState: { playerWins: 0, opponentWins: 0 }
  });

  const [player, setPlayer] = useState<PlayerState>({
    hp: MAX_HP,
    maxHp: MAX_HP,
    items: [],
    isHandcuffed: false,
    isSawedActive: false,
    luckycharmsUsed: 0,
    lastTurnItemsUsed: [],
    currentTurnItemsUsed: [],
  });

  const [dealer, setDealer] = useState<PlayerState>({
    hp: MAX_HP,
    maxHp: MAX_HP,
    items: [],
    isHandcuffed: false,
    isSawedActive: false,
    luckycharmsUsed: 0,
    lastTurnItemsUsed: [],
    currentTurnItemsUsed: [],
  });

  const gameStateRef = useRef(gameState);
  const playerRef = useRef(player);
  const dealerRef = useRef(dealer);
  const prevTurnOwnerRef = useRef<TurnOwner>(gameState.turnOwner);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    dealerRef.current = dealer;
  }, [dealer]);

  useEffect(() => {
    if (gameState.phase === 'LOAD' || gameState.phase === 'LOOTING' || gameState.phase === 'GAME_OVER') {
      setPlayer(p => ({ ...p, lastTurnItemsUsed: [], currentTurnItemsUsed: [] }));
      setDealer(d => ({ ...d, lastTurnItemsUsed: [], currentTurnItemsUsed: [] }));
      prevTurnOwnerRef.current = gameState.turnOwner;
      return;
    }

    if (gameState.turnOwner !== prevTurnOwnerRef.current) {
      const prevOwner = prevTurnOwnerRef.current;
      if (prevOwner === 'PLAYER') {
        setPlayer(p => ({
          ...p,
          lastTurnItemsUsed: p.currentTurnItemsUsed || [],
          currentTurnItemsUsed: []
        }));
      } else {
        setDealer(d => ({
          ...d,
          lastTurnItemsUsed: d.currentTurnItemsUsed || [],
          currentTurnItemsUsed: []
        }));
      }
      prevTurnOwnerRef.current = gameState.turnOwner;
    }
  }, [gameState.turnOwner, gameState.phase]);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [knownShell, setKnownShell] = useState<ShellType | null>(null);

  // Stats Ref to track current match performance
  const matchStatsRef = useRef<MatchStats>({
    result: 'LOSS',
    roundsSurvived: 1,
    shotsFired: 0,
    shotsHit: 0,
    selfShots: 0,
    itemsUsed: {},
    damageDealt: 0,
    damageTaken: 0,
    totalScore: 0
  });

  // Animation State Group
  const [animState, setAnimState] = useState<AnimationState>({
    triggerRecoil: 0,
    triggerRack: 0,
    triggerSparks: 0,
    triggerHeal: 0,
    triggerDrink: 0,
    triggerCuff: 0,
    triggerGlass: 0,
    triggerPhone: 0,
    triggerInverter: 0,
    triggerAdrenaline: 0,
    triggerChoke: 0,
    triggerRemote: 0,
    triggerBigInverter: 0,
    triggerContract: 0,
    triggerLuckycharm: 0,
    triggerFlashbang: 0,
    triggerCrusher: 0,
    triggerTotem: 0,
    triggerMirror: 0,
    triggerDeckCard: 0,
    triggerJackpot: 0,
    jackpotResult: null,
    totemTarget: null,
    isSawing: false,
    ejectedShellColor: 'red',
    muzzleFlashIntensity: 0,
    isLiveShot: false,
    dealerHit: false,
    dealerDropping: false,
    playerHit: false,
    playerRecovering: false,
    dealerRecovering: false
  });

  // Load name on mount
  useEffect(() => {
    const saved = localStorage.getItem('aadish_roulette_name');
    if (saved) setPlayerName(saved);
  }, []);

  const setAnim = (update: Partial<AnimationState> | ((prev: AnimationState) => Partial<AnimationState>)) => {
    setAnimState(prev => ({ ...prev, ...(typeof update === 'function' ? update(prev) : update) }));
  };

  const [aimTarget, setAimTarget] = useState<AimTarget>('IDLE');
  const [cameraView, setCameraView] = useState<CameraView>('PLAYER');
  const [overlayColor, setOverlayColor] = useState<'none' | 'red' | 'green' | 'scan'>('none');
  const [overlayText, setOverlayText] = useState<string | null>(null);
  const [showBlood, setShowBlood] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [showFlashbang, setShowFlashbang] = useState(false);

  const [receivedItems, setReceivedItems] = useState<ItemType[]>([]);
  const [showLootOverlay, setShowLootOverlay] = useState(false);

  const getOpponentName = () => {
    return gameState.isMultiplayer ? (gameState.opponentName || 'OPPONENT') : 'DEALER';
  };

  const addLog = (text: string, type: LogEntry['type'] = 'neutral') => {
    setLogs(prev => [...prev, { id: Date.now() + Math.random(), text, type }]);
  };

  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetStats = () => {
    matchStatsRef.current = {
      result: 'LOSS',
      roundsSurvived: 1,
      shotsFired: 0,
      shotsHit: 0,
      selfShots: 0,
      itemsUsed: {},
      damageDealt: 0,
      damageTaken: 0,
      totalScore: 0
    };
  };

  const resetGame = (toMenu: boolean = false, startRoundAfterReset: boolean = true) => {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }

    setReceivedItems([]);
    setShowLootOverlay(false);
    setOverlayText(null);
    resetStats();

    setGameState({
      phase: toMenu ? 'INTRO' : 'LOAD',
      turnOwner: 'PLAYER',
      winner: null,
      chamber: [],
      currentShellIndex: 0,
      liveCount: 0,
      blankCount: 0,
      roundCount: 0,
      isHardMode: false, // Reset to normal on full reset
      hardModeState: undefined,
      normalModeState: undefined
    });
    audioManager.stopJackpotMusic();
    setPlayer({ hp: MAX_HP, maxHp: MAX_HP, items: [], isHandcuffed: false, isSawedActive: false, luckycharmsUsed: 0, isFlashbanged: false, jackpotImmunityShots: 0 });
    setDealer({ hp: MAX_HP, maxHp: MAX_HP, items: [], isHandcuffed: false, isSawedActive: false, luckycharmsUsed: 0, isFlashbanged: false, jackpotImmunityShots: 0 });
    setLogs([]);
    setKnownShell(null);
    setAnim({
      triggerRecoil: 0, triggerRack: 0, triggerSparks: 0, triggerHeal: 0, triggerDrink: 0, triggerCuff: 0,
      isSawing: false, ejectedShellColor: 'red', muzzleFlashIntensity: 0, isLiveShot: false,
      dealerHit: false, dealerDropping: false, playerHit: false, playerRecovering: false, dealerRecovering: false,
      triggerAdrenaline: 0, triggerChoke: 0, triggerPhone: 0, triggerInverter: 0, triggerRemote: 0, triggerBigInverter: 0, triggerContract: 0, triggerLuckycharm: 0, triggerTotem: 0, triggerMirror: 0, triggerDeckCard: 0, totemTarget: null,
      triggerFlashbang: 0, triggerCrusher: 0, triggerJackpot: 0, jackpotResult: null
    });
    setCameraView('PLAYER');
    setShowBlood(false);
    setIsProcessing(false);

    if (!toMenu && startRoundAfterReset) {
      resetTimeoutRef.current = setTimeout(() => {
        startRound(true);
        resetTimeoutRef.current = null;
      }, 200);
    }
  };

  const startGame = (
    name: string,
    hardMode: boolean = false,
    isMultiplayer: boolean = false,
    opponentName: string = 'OPPONENT',
    turnOwner: TurnOwner = 'PLAYER',
    chamberOverride?: ShellType[],
    pItemsOverride?: ItemType[],
    dItemsOverride?: ItemType[],
    hpOverride?: number,
    mpSettings?: RoomSettings
  ) => {
    // Clear any pending resets from previous actions
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }

    localStorage.setItem('aadish_roulette_name', name);
    setPlayerName(name);

    setIsProcessing(true); // Lock input during initialization

    // HP from override or settings
    const initialHp = hpOverride || (mpSettings?.hp) || 2;

    setPlayer({ hp: initialHp, maxHp: initialHp, items: [], isHandcuffed: false, isSawedActive: false, luckycharmsUsed: 0, isFlashbanged: false, jackpotImmunityShots: 0 });
    setDealer({ hp: initialHp, maxHp: initialHp, items: [], isHandcuffed: false, isSawedActive: false, luckycharmsUsed: 0, isFlashbanged: false, jackpotImmunityShots: 0 });
    setLogs([]);
    setKnownShell(null);
    setAnim({
      triggerRecoil: 0, triggerRack: 0, triggerSparks: 0, triggerHeal: 0, triggerDrink: 0, triggerCuff: 0,
      isSawing: false, ejectedShellColor: 'red', muzzleFlashIntensity: 0, isLiveShot: false,
      dealerHit: false, dealerDropping: false, playerHit: false, playerRecovering: false, dealerRecovering: false,
      triggerAdrenaline: 0, triggerChoke: 0, triggerPhone: 0, triggerInverter: 0, triggerRemote: 0, triggerBigInverter: 0, triggerContract: 0, triggerLuckycharm: 0, triggerTotem: 0, triggerMirror: 0, triggerDeckCard: 0, totemTarget: null,
      triggerFlashbang: 0, triggerCrusher: 0, triggerJackpot: 0, jackpotResult: null
    });
    setCameraView('PLAYER');
    setShowBlood(false);

    matchStatsRef.current = {
      result: 'LOSS',
      roundsSurvived: 0,
      shotsFired: 0,
      shotsHit: 0,
      selfShots: 0,
      itemsUsed: {},
      damageDealt: 0,
      damageTaken: 0,
      totalScore: 0,
      isHardMode: hardMode,
      roundResults: []
    };

    const initialHardModeState = hardMode ? { round: 1, playerWins: 0, dealerWins: 0 } : undefined;
    const initialNormalModeState = !hardMode && !isMultiplayer ? { round: 1, playerWins: 0, dealerWins: 0 } : undefined;

    setGameState({
      phase: 'LOAD',
      turnOwner: turnOwner,
      winner: null,
      chamber: [],
      currentShellIndex: 0,
      liveCount: 0,
      blankCount: 0,
      roundCount: 0,
      isHardMode: hardMode,
      isMultiplayer: isMultiplayer,
      opponentName: opponentName,
      hardModeState: initialHardModeState,
      normalModeState: initialNormalModeState,
      roomSettings: mpSettings || { rounds: 1, hp: 4, itemsPerShipment: 4 },
      multiModeState: { playerWins: 0, opponentWins: 0 }
    });

    matchStatsRef.current.isHardMode = hardMode;

    // Show ROUND 1 overlay explicitly for EVERY mode
    // setOverlayText('ROUND 1'); // Removed - Redundant with startRound
    // setOverlayColor('none');

    // Start with a delay to let player see the message
    setTimeout(() => {
      // setOverlayText(null);
      startRound(true, hardMode, initialHardModeState, chamberOverride, pItemsOverride, dItemsOverride, turnOwner, hpOverride);
    }, 100); // Reduced delay since startRound has its own delay
  };

  const startRound = async (
    resetItems: boolean = false,
    hardModeOverride?: boolean,
    hardModeStateOverride?: any,
    chamberOverride?: ShellType[],
    pItemsOverride?: ItemType[],
    dItemsOverride?: ItemType[],
    turnOwnerOverride?: TurnOwner,
    hpOverride?: number,
    multiWinsOverride?: { playerWins: number, opponentWins: number }
  ) => {
    // Resolve Hard Mode State
    // Prioritize override, then current state
    const isHM = hardModeOverride !== undefined ? hardModeOverride : gameStateRef.current.isHardMode;
    const hmState = hardModeStateOverride !== undefined ? hardModeStateOverride : gameStateRef.current.hardModeState;

    let chamber: ShellType[];
    let lives: number;
    let blanks: number;

    if (chamberOverride) {
      chamber = chamberOverride;
      lives = chamber.filter(s => s === 'LIVE').length;
      blanks = chamber.filter(s => s === 'BLANK').length;
    } else {
      const total = randomInt(2, 8);
      const maxLives = Math.floor(total / 2);
      lives = randomInt(1, maxLives);
      if (lives < maxLives && Math.random() > 0.4) {
        lives = maxLives;
      }
      blanks = total - lives;

      chamber = [...Array(lives).fill('LIVE'), ...Array(blanks).fill('BLANK')] as ShellType[];

      for (let i = chamber.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chamber[i], chamber[j]] = [chamber[j], chamber[i]];
      }
    }

    setGameState(prev => ({
      ...prev,
      chamber,
      currentShellIndex: 0,
      liveCount: lives,
      blankCount: blanks,
      roundCount: resetItems ? 1 : prev.roundCount + 1,
      phase: 'LOAD',
      isHardMode: isHM, // Ensure synced
      hardModeState: hmState
    }));

    if (!resetItems && !isHM) {
      matchStatsRef.current.roundsSurvived = (gameStateRef.current.roundCount || 0) + 1;
    } else {
      if (!isHM) matchStatsRef.current.roundsSurvived = 1;
      // In HM, roundsSurvived could track match rounds
    }

    if (resetItems || !playerRef.current.jackpotImmunityShots || playerRef.current.jackpotImmunityShots <= 0) {
      audioManager.stopJackpotMusic();
    }
    setKnownShell(null);
    setAnim({ dealerDropping: false, playerHit: false });
    setCameraView(turnOwnerOverride || 'PLAYER');

    // HP Setup
    let startingHp = hpOverride || MAX_HP;
    if (isHM && !hpOverride) {
      const stage = hmState?.round || 1;
      if (stage === 1) startingHp = 2;
      else if (stage === 2) startingHp = 3;
      else startingHp = 4;
    } else if (!gameStateRef.current.isMultiplayer && !isHM && !hpOverride) {
      const stage = gameStateRef.current.normalModeState?.round || 1;
      if (stage === 1) startingHp = 2;
      else startingHp = 4;
    }

    // Reset HP only if it's a NEW Stage (resetItems=true usually implies new stage in this logic flow)
    if (resetItems) {
      setPlayer(p => ({ ...p, isHandcuffed: false, isSawedActive: false, items: [], hp: startingHp, maxHp: startingHp, luckycharmsUsed: 0, isFlashbanged: false, jackpotImmunityShots: 0 }));
      setDealer(d => ({ ...d, isHandcuffed: false, isSawedActive: false, items: [], hp: startingHp, maxHp: startingHp, luckycharmsUsed: 0, isFlashbanged: false, jackpotImmunityShots: 0 }));
    } else {
      // Just reset status effects
      setPlayer(p => ({ ...p, isHandcuffed: false, isSawedActive: false, isChokeActive: false, isFlashbanged: false }));
      setDealer(d => ({ ...d, isHandcuffed: false, isSawedActive: false, isChokeActive: false, isFlashbanged: false }));
    }

    setIsProcessing(true);

    // 1. Show ROUND X announcement
    let displayRound = gameStateRef.current.roundCount + 1;
    if (isHM) {
      displayRound = hmState?.round || 1;
    } else if (gameStateRef.current.isMultiplayer) {
      const wins = multiWinsOverride || gameStateRef.current.multiModeState;
      displayRound = (wins?.playerWins || 0) + (wins?.opponentWins || 0) + 1;
    }

    setOverlayText(`ROUND ${displayRound}`);
    setOverlayColor(isHM ? 'red' : 'none');
    audioManager.playSound('rack');
    await wait(3000);
    setOverlayText(null);
    setOverlayColor('none');

    // 2. Show LIVE/BLANK announcement
    addLog('--- NEW BATCH ---');
    addLog(`${lives} LIVE, ${blanks} BLANK`);
    setOverlayText(`${lives} LIVE  |  ${blanks} BLANK`);
    audioManager.playSound('insert');
    await wait(3500);
    setOverlayText(null);

    // Pass overrides to distributeItems if needed, or rely on setGameState above having propagated?
    // React state might not be ready. distributeItems uses the `gameState` passed to it IF we passed it.
    // Use the `isHM` flag in a modified distributeItems or rely on the state update.
    // Best to pass updated gameState structure to distributeItemsAction if possible, but it takes setter.
    // Workaround: We will rely on React State being "fast enough" or update distributeItems to take a partial override.
    // Actually, `distributeItemsAction` reads `gameState.isHardMode`. 
    // Since we called `setGameState` above, but this is async, we might read old state.
    // Fix: Pass an "effective game state" object.

    // Construct effective state for distribution
    const effectiveState = {
      ...gameStateRef.current,
      isHardMode: isHM,
      hardModeState: hmState,
      normalModeState: gameStateRef.current.normalModeState,
      roundCount: resetItems ? 1 : gameStateRef.current.roundCount + 1
    };

    await distributeItemsAction(
      resetItems, effectiveState, setPlayer, setDealer, setGameState,
      setReceivedItems, setShowLootOverlay, dealerRef.current.hp,
      pItemsOverride, dItemsOverride,
      player.items, dealer.items,
      playerRef.current.luckycharmsUsed || 0,
      dealerRef.current.luckycharmsUsed || 0,
      playerRef.current.hp,
      playerRef.current.maxHp,
      dealerRef.current.maxHp
    );

    const nextTurn = turnOwnerOverride || 'PLAYER';
    setGameState(prev => ({ ...prev, phase: nextTurn === 'PLAYER' ? 'PLAYER_TURN' : 'DEALER_TURN', turnOwner: nextTurn }));
    if (nextTurn === 'PLAYER') {
      setCameraView('PLAYER');
      addLog('YOUR MOVE.');
    } else {
      setCameraView('DEALER');
      addLog(`${getOpponentName().toUpperCase()}'S TURN.`);
    }

    setIsProcessing(false);
  };

  /* Fixed Hard Mode logic */
  const handleHardModeRoundEnd = async (winner: TurnOwner) => {
    setIsProcessing(true);

    const currentState = gameStateRef.current.hardModeState || { round: 1, playerWins: 0, dealerWins: 0 };
    const currentRound = currentState.round;

    let nextState = { ...currentState };
    if (winner === 'PLAYER') {
      nextState.playerWins++;
      matchStatsRef.current.roundsSurvived++;
    } else {
      nextState.dealerWins++;
    }

    // Track Round Result
    if (!matchStatsRef.current.roundResults) matchStatsRef.current.roundResults = [];
    matchStatsRef.current.roundResults.push(winner === 'PLAYER' ? 'WIN' : 'LOSS');

    // 1. Show Winner of Round Visuals
    const winMsg = winner === 'PLAYER' ? `${playerName} WON ROUND ${currentRound}` : `${getOpponentName().toUpperCase()} WON ROUND ${currentRound}`;
    const color = winner === 'PLAYER' ? 'green' : 'red';

    setOverlayColor(color);
    setOverlayText(winMsg);

    // Sound Effect
    if (winner === 'PLAYER') audioManager.playSound('insert');
    else audioManager.playSound('rack');

    // Wait for reading
    await wait(3000);

    // Check Match Over
    if (nextState.playerWins >= 2 || nextState.dealerWins >= 2) {
      setGameState(prev => ({ ...prev, winner, phase: 'GAME_OVER', hardModeState: nextState }));
      matchStatsRef.current.result = winner === 'PLAYER' ? 'WIN' : 'LOSS';
      matchStatsRef.current.totalScore = matchStatsRef.current.totalScore * 2;
      setIsProcessing(false);
      setOverlayColor('none');
      setOverlayText(null);
      return;
    }

    // Next Round Setup
    nextState.round++;
    setOverlayColor('none');
    setOverlayText(`ROUND ${nextState.round}`);

    // Validating Round Start
    addLog(`ROUND ${nextState.round} STARTING...`);

    // Wait for "Round X" text
    await wait(2000);

    setOverlayText(null);

    // Trigger Next Round
    setGameState(prev => ({ ...prev, hardModeState: nextState, phase: 'LOAD' }));
    // Trigger Next Round
    await startRound(true, true, nextState);
    setIsProcessing(false);
  };

  const handleNormalModeRoundEnd = async (winner: TurnOwner) => {
    setIsProcessing(true);

    const currentState = gameStateRef.current.normalModeState || { round: 1, playerWins: 0, dealerWins: 0 };
    const currentRound = currentState.round;

    let nextState = { ...currentState };
    if (winner === 'PLAYER') {
      nextState.playerWins++;
      matchStatsRef.current.roundsSurvived++;
    } else {
      nextState.dealerWins++;
    }

    // Track Round Result
    if (!matchStatsRef.current.roundResults) matchStatsRef.current.roundResults = [];
    matchStatsRef.current.roundResults.push(winner === 'PLAYER' ? 'WIN' : 'LOSS');

    if (winner === 'DEALER') {
      const winMsg = `${getOpponentName().toUpperCase()} WON THE GAME`;
      setOverlayColor('red');
      setOverlayText(winMsg);
      audioManager.playSound('rack');
      await wait(3000);
      setGameState(prev => ({ ...prev, winner: 'DEALER', phase: 'GAME_OVER', normalModeState: nextState }));
      matchStatsRef.current.result = 'LOSS';
      setIsProcessing(false);
      setOverlayColor('none');
      setOverlayText(null);
      return;
    }

    // Player won round
    if (currentRound === 1) {
      const winMsg = `${playerName} WON ROUND 1`;
      setOverlayColor('green');
      setOverlayText(winMsg);
      audioManager.playSound('insert');
      await wait(3000);

      // Transition to Round 2:
      // First display text as dealer subtitles "LET'S MAKE THIS A LITTLE MORE INTERESTING"
      setOverlayColor('none');
      setOverlayText("LET'S MAKE THIS A LITTLE MORE INTERESTING");
      addLog("DEALER: LET'S MAKE THIS A LITTLE MORE INTERESTING", 'dealer');
      // Wait to let player read
      await wait(3000);
      setOverlayText(null);

      nextState.round = 2;
      setGameState(prev => ({ ...prev, normalModeState: nextState, phase: 'LOAD' }));

      // start the round with 4 health and items with same randomness in number and shell randomness
      await startRound(true, false, undefined, undefined, undefined, undefined, undefined, 4);
      setIsProcessing(false);
    } else {
      // If player won round 2, they win the game!
      const winMsg = `${playerName} WON THE GAME`;
      setOverlayColor('green');
      setOverlayText(winMsg);
      audioManager.playSound('insert');
      await wait(3000);

      setGameState(prev => ({ ...prev, winner: 'PLAYER', phase: 'GAME_OVER', normalModeState: nextState }));
      matchStatsRef.current.result = 'WIN';
      setIsProcessing(false);
      setOverlayColor('none');
      setOverlayText(null);
    }
  };

  const handleMPRoundEnd = async (winner: TurnOwner) => {
    setIsProcessing(true);

    const mSettings = gameStateRef.current.roomSettings || { rounds: 1, hp: 4 };
    const winsNeeded = Math.ceil(mSettings.rounds / 2) || 1;

    // Increment wins locally first
    let pWin = (gameStateRef.current.multiModeState?.playerWins || 0) + (winner === 'PLAYER' ? 1 : 0);
    let oWin = (gameStateRef.current.multiModeState?.opponentWins || 0) + (winner === 'PLAYER' ? 0 : 1);

    setGameState(prev => ({
      ...prev,
      multiModeState: { playerWins: pWin, opponentWins: oWin }
    }));

    const winMsg = winner === 'PLAYER' ? `${playerName.toUpperCase()} WON THE MATCH!` : `${getOpponentName().toUpperCase()} WON THE MATCH!`;
    const color = winner === 'PLAYER' ? 'green' : 'red';

    setOverlayColor(color);
    setOverlayText(winMsg);
    await wait(3000);

    if (pWin >= winsNeeded || oWin >= winsNeeded) {
      setGameState(prev => ({ ...prev, winner, phase: 'GAME_OVER' }));
      setIsProcessing(false);
      return;
    }

    // Next Round
    const nextRoundNum = pWin + oWin + 1;
    setOverlayColor('none');
    setOverlayText(`ROUND ${nextRoundNum}`);
    await wait(2200);
    setOverlayText(null);

    // Reset HP but keep going
    const initialPlayerHp = playerRef.current.maxHp;
    const initialDealerHp = dealerRef.current.maxHp;
    setPlayer(p => ({ ...p, hp: initialPlayerHp }));
    setDealer(d => ({ ...d, hp: initialDealerHp }));

    // Start a new batch
    startRound(true, false, undefined, undefined, undefined, undefined, undefined, undefined, { playerWins: pWin, opponentWins: oWin });
    setIsProcessing(false);
  };

  const distributeItems = async (forceClear: boolean = false) => {
    await distributeItemsAction(
      forceClear, gameStateRef.current, setPlayer, setDealer, setGameState,
      setReceivedItems, setShowLootOverlay, dealerRef.current.hp,
      undefined, undefined,
      player.items, dealer.items,
      playerRef.current.luckycharmsUsed || 0,
      dealerRef.current.luckycharmsUsed || 0,
      playerRef.current.hp,
      playerRef.current.maxHp,
      dealerRef.current.maxHp
    );
  };

  const pickupGun = () => {
    if (isProcessing) return;
    if (gameStateRef.current.turnOwner !== 'PLAYER') {
      addLog("NOT YOUR TURN TO PICK UP THE GUN", 'info');
      return;
    }
    // PREVENT GUN PICKUP WHILE ANYONE IS KNOCKED DOWN OR RECOVERING
    if (animState.playerHit || animState.playerRecovering ||
      animState.dealerDropping || animState.dealerRecovering) {
      addLog('WAIT FOR RECOVERY...', 'info');
      return;
    }
    // New Logic: Don't move camera yet. Just show target choices.
    setAimTarget('CHOOSING');
    setCameraView('GUN'); // Set camera to gun view immediately
  };

  const fireShot = async (shooter: TurnOwner, target: TurnOwner) => {
    // Basic phase check
    if (gameStateRef.current.phase !== 'PLAYER_TURN' && gameStateRef.current.phase !== 'DEALER_TURN' && gameStateRef.current.phase !== 'RESOLVING') return;

    // Strict turn check for local player
    if (shooter === 'PLAYER' && gameStateRef.current.turnOwner !== 'PLAYER') {
      console.warn("Attempted to fire out of turn.");
      return;
    }

    if (shooter === 'PLAYER' && isProcessing) return;
    // setIsProcessing(true); // Lock input immediately to prevent mobile touch interference - moved below

    // Trigger Gun Animation for BOTH Player and Dealer
    if (shooter === 'PLAYER') {
      setCameraView('GUN');
    }

    // Determine intended aim target
    const intendedAim = target === (shooter === 'PLAYER' ? 'PLAYER' : 'DEALER') ? 'SELF' : 'OPPONENT';

    // --- DOUBLE TAP / SAFETY CHECK ---
    // If gun is not already pointing at the intended target, JUST AIM first.
    // This solves mobile tap issues (Tap 1 = Aim, Tap 2 = Shoot).
    // On Desktop, hover events handle the "Aim" part, so click immediately shoots.
    // NOTE: Only applies to PLAYER. Dealer AI should not be blocked.
    if (shooter === 'PLAYER' && aimTarget !== intendedAim) {
      setAimTarget(intendedAim);
      // No need to setIsProcessing(true) if we're just aiming and returning
      return;
    }

    // If we reach here, it means aimTarget === intendedAim OR shooter is DEALER
    // Lock input now that we're committing to the shot.
    setIsProcessing(true);

    // Proceed to Fire
    setAimTarget(intendedAim); // Ensure it's set, though it should already be
    // Tiny delay to ensure visual sync - extended to match animation speed
    await wait(300);

    // Update Stats - Shots Fired
    matchStatsRef.current.shotsFired++;
    if (target === shooter) matchStatsRef.current.selfShots++;

    await performShot(shooter, target, {
      gameState: gameStateRef.current, setGameState, player: playerRef.current, setPlayer, dealer: dealerRef.current, setDealer,
      setAnim, setKnownShell, setAimTarget, setCameraView, setOverlayText,
      setOverlayColor, setShowFlash, setShowBlood, addLog, playerName,
      startRound, setIsProcessing,
      onBatchEnd: onBatchEndRef.current || undefined,
      // Pass stats ref to update hits/damage inside shooting logic
      matchStats: matchStatsRef,
      handleHardModeRoundEnd,
      handleMPRoundEnd,
      handleNormalModeRoundEnd,
      opponentName: getOpponentName()
    });
  };

  const processItemEffect = async (user: TurnOwner, item: ItemType): Promise<boolean> => {
    if (item === 'CUFFS') {
      const opponent = user === 'PLAYER' ? dealerRef.current : playerRef.current;
      // Check if opponent is already cuffed OR if we just skipped their turn via cuffs
      if (opponent.isHandcuffed || gameStateRef.current.lastTurnWasSkipped) {
        addLog(`${user === 'PLAYER' ? getOpponentName().toUpperCase() : 'YOU'} CAN'T BE CUFFED AGAIN!`, 'info');
        if (user === 'PLAYER') {
          setPlayer(p => ({ ...p, items: [...p.items, 'CUFFS'] }));
        }
        return false;
      }
    }

    const userName = user === 'PLAYER' ? playerName.toUpperCase() : getOpponentName().toUpperCase();
    setOverlayText(`${userName} USED ${item}`);

    addLog(`${userName} USED ${item}`, 'info');
    await wait(1500); // Brief display before animation starts
    setOverlayText(null);

    // Track Item Usage
    if (user === 'PLAYER') {
      matchStatsRef.current.itemsUsed[item] = (matchStatsRef.current.itemsUsed[item] || 0) + 1;
      setPlayer(p => ({
        ...p,
        currentTurnItemsUsed: [...(p.currentTurnItemsUsed || []), item]
      }));
    } else {
      setDealer(d => ({
        ...d,
        currentTurnItemsUsed: [...(d.currentTurnItemsUsed || []), item]
      }));
    }

    let roundEnded = false;

    switch (item) {
      case 'BEER':
        audioManager.playSound('blankshell');
        roundEnded = await ItemActions.handleBeer(
          gameStateRef.current, setGameState,
          (v) => setAnim(p => ({ ...p, triggerRack: typeof v === 'function' ? v(p.triggerRack) : v })),
          (v) => setAnim(p => ({ ...p, ejectedShellColor: typeof v === 'function' ? v(p.ejectedShellColor) : v })),
          (v) => setAnim(p => ({ ...p, triggerDrink: typeof v === 'function' ? v(p.triggerDrink) : v })),
          setOverlayText,
          addLog, startRound,
          onBatchEndRef.current || undefined
        );
        break;

      case 'CIGS':
        await ItemActions.handleCigs(user, setPlayer, setDealer,
          (v) => setAnim(p => ({ ...p, triggerHeal: typeof v === 'function' ? v(p.triggerHeal) : v }))
        );
        break;

      case 'SAW':
        await ItemActions.handleSaw(user, setPlayer, setDealer,
          (v) => setAnim(p => ({ ...p, triggerSparks: typeof v === 'function' ? v(p.triggerSparks) : v })),
          (v) => setAnim(p => ({ ...p, isSawing: typeof v === 'function' ? v(p.isSawing) : v }))
        );
        break;

      case 'CUFFS':
        await ItemActions.handleCuffs(user, setPlayer, setDealer, (v) => setAnim(p => ({ ...p, triggerCuff: typeof v === 'function' ? v(p.triggerCuff) : v })));
        await wait(500); // Pause after cuffs animation
        break;

      case 'GLASS':
        await ItemActions.handleGlass(user, gameStateRef.current, setKnownShell,
          (v) => setAnim(p => ({ ...p, triggerGlass: typeof v === 'function' ? v(p.triggerGlass) : v })),
          addLog
        );
        break;

      case 'PHONE':
        await ItemActions.handlePhone(user, gameStateRef.current,
          (v) => setAnim(p => ({ ...p, triggerPhone: typeof v === 'function' ? v(p.triggerPhone) : v })),
          addLog,
          setOverlayText
        );
        break;

      case 'INVERTER':
        await ItemActions.handleInverter(user, gameStateRef.current, setGameState,
          (v) => setAnim(p => ({ ...p, triggerInverter: typeof v === 'function' ? v(p.triggerInverter) : v })),
          addLog,
          setOverlayText
        );
        break;

      case 'BIG_INVERTER':
        await ItemActions.handleBigInverter(user, gameStateRef.current, setGameState,
          (v) => setAnim(p => ({ ...p, triggerBigInverter: typeof v === 'function' ? v(p.triggerBigInverter) : v })),
          addLog,
          setOverlayText
        );
        break;

      case 'ADRENALINE':
        await ItemActions.handleAdrenaline(user,
          (v) => setAnim(p => ({ ...p, triggerAdrenaline: typeof v === 'function' ? v(p.triggerAdrenaline) : v })),
          setGameState, addLog, setOverlayText, setOverlayColor
        );
        await wait(500); // Pause before next action
        await wait(500); // Pause before next action
        break;

      case 'CHOKE':
        await ItemActions.handleChoke(user, setPlayer, setDealer,
          (v) => setAnim(p => ({ ...p, triggerChoke: typeof v === 'function' ? v(p.triggerChoke) : v })),
          addLog
        );
        break;

      case 'REMOTE':
        await ItemActions.handleRemote(user, gameStateRef.current, setGameState,
          (v) => setAnim(p => ({ ...p, triggerRemote: typeof v === 'function' ? v(p.triggerRemote) : v })),
          addLog,
          setOverlayText
        );
        break;

      case 'CONTRACT':
        await ItemActions.handleContract(
          user, player, dealer, setPlayer, setDealer, setGameState, setAnim,
          (v) => setAnim(p => ({ ...p, triggerContract: typeof v === 'function' ? v(p.triggerContract) : v })),
          addLog, setOverlayText, setOverlayColor,
          gameState.isHardMode, gameState.isMultiplayer,
          handleHardModeRoundEnd, handleMPRoundEnd
        );
        break;

      case 'LUCKYCHARM':
        await ItemActions.handleLuckycharm(
          user, setPlayer, setDealer,
          (v) => setAnim(p => ({ ...p, triggerLuckycharm: typeof v === 'function' ? v(p.triggerLuckycharm) : v })),
          addLog, setOverlayText
        );
        break;

      case 'FLASHBANG':
        await ItemActions.handleFlashbang(
          user, setPlayer, setDealer,
          (v) => setAnim(p => ({ ...p, triggerFlashbang: typeof v === 'function' ? v(p.triggerFlashbang) : v })),
          addLog, setOverlayText, setShowFlashbang
        );
        break;

      case 'CRUSHER':
        await ItemActions.handleCrusher(
          user, player, dealer, setPlayer, setDealer,
          (v) => setAnim(p => ({ ...p, triggerCrusher: typeof v === 'function' ? v(p.triggerCrusher) : v })),
          addLog, setOverlayText
        );
        break;

      case 'JACKPOT': {
        // Roll the jackpot outcome
        const rand = Math.random();
        let outcome: 'JACKPOT' | 'NORMAL' | 'LOSE';
        
        // Allow forcing outcomes for debugging
        if ((window as any).__debugJackpotForcedOutcome) {
          outcome = (window as any).__debugJackpotForcedOutcome;
        } else {
          if (rand < 0.20) {
            outcome = 'JACKPOT';
          } else if (rand < 0.50) {
            outcome = 'NORMAL';
          } else {
            outcome = 'LOSE';
          }
        }

        // Trigger animation
        audioManager.playSound('slotmachine');
        setAnim(p => ({
          ...p,
          triggerJackpot: p.triggerJackpot + 1,
          jackpotResult: outcome
        }));

        addLog(`${userName} SPUN THE JACKPOT MACHINE`, 'info');

        // Let the spin happen
        await wait(3500);

        if (outcome === 'JACKPOT') {
          addLog("JACKPOT WIN! IMMUNE TO NEXT 3 SHOTS", 'safe');
          setOverlayText("✨ JACKPOT WIN! ✨\n3 SHOT IMMUNITY");
          setPlayer(p => ({ ...p, jackpotImmunityShots: 3 }));
          audioManager.playJackpotIntro();
        } else if (outcome === 'NORMAL') {
          addLog("NORMAL WIN! IMMUNE TO NEXT 1 SHOT", 'safe');
          setOverlayText("👍 NORMAL WIN! 👍\n1 SHOT IMMUNITY");
          setPlayer(p => ({ ...p, jackpotImmunityShots: (p.jackpotImmunityShots || 0) + 1 }));
        } else {
          addLog("NO WIN. TRY AGAIN", 'neutral');
          setOverlayText("❌ LOSE ❌\nBETTER LUCK NEXT TIME");
        }

        await wait(1500);
        setOverlayText(null);
        break;
      }

      case 'MIRROR': {
        audioManager.playSound('mirror');
        setAnim(p => ({ ...p, triggerMirror: p.triggerMirror + 1 }));
        await wait(2200); // Let Mirror animation run first

        const opponentState = user === 'PLAYER' ? dealerRef.current : playerRef.current;
        const copiedItems = (opponentState.lastTurnItemsUsed || []).filter(i => i !== 'MIRROR' && i !== 'ADRENALINE' && (user !== 'DEALER' || i !== 'JACKPOT'));
        
        if (copiedItems.length === 0) {
          addLog(`${userName} COPIED NO EFFECTS WITH MIRROR`, 'info');
          setOverlayText("🪞 MIRROR: NO EFFECTS TO COPY");
          await wait(2000);
          setOverlayText(null);
        } else {
          const getFriendlyName = (i: ItemType): string => {
            const names: Record<ItemType, string> = {
              'BEER': 'Beer', 'CIGS': 'Cigarettes', 'GLASS': 'Magnifying Glass', 'CUFFS': 'Handcuffs',
              'SAW': 'Hand Saw', 'PHONE': 'Burner Phone', 'INVERTER': 'Polarity Inverter',
              'ADRENALINE': 'Adrenaline', 'CHOKE': 'Choke Mod', 'REMOTE': 'Remote Control',
              'BIG_INVERTER': 'Big Inverter', 'CONTRACT': 'Blood Contract', 'LUCKYCHARM': 'Lucky Charm',
              'FLASHBANG': 'Flashbang', 'CRUSHER': 'Item Crusher', 'TOTEM': 'Totem of Undying',
              'MIRROR': 'Mirror', 'DECK_CARD': 'Tarot Card', 'JACKPOT': 'Jackpot Slot Machine'
            };
            return names[i] || i;
          };
          const friendlyNames = copiedItems.map(getFriendlyName).join(' & ');
          addLog(`${userName} MIRROR COPIED: ${friendlyNames}`, 'safe');
          setOverlayText(`🪞 MIRROR DUPLICATED: ${friendlyNames}!`);
          await wait(2200);
          setOverlayText(null);

          for (const copiedItem of copiedItems) {
            if (gameStateRef.current.phase === 'GAME_OVER' || roundEnded) break;
            const itemEndedRound = await processItemEffect(user, copiedItem);
            if (itemEndedRound) {
              roundEnded = true;
            }
            if (!roundEnded) {
              await wait(1000);
            }
          }
        }
        break;
      }
      case 'DECK_CARD': {
        const allTarotNames: TarotCard['name'][] = [
          'The Magician', 'The Hanged Man', 'The Hermit', 'The Moon', 'Judgment',
          'Wheel of Fortune', 'The Sun', 'Death', 'The Tower', 'The Fool', 'Justice', 'Temperance'
        ];
        
        const shuffled = [...allTarotNames].sort(() => Math.random() - 0.5);
        const selectedNames = shuffled.slice(0, 6);
        const cardPowers: Record<TarotCard['name'], string> = {
          'The Magician': 'Gain a random item',
          'The Hanged Man': 'Lose 1 HP',
          'The Hermit': 'Ends turn instantly',
          'The Moon': 'Grab opponent item',
          'Judgment': '50% chance invert blank to live',
          'Wheel of Fortune': 'Reshuffle ammo',
          'The Sun': 'Gain 1 HP',
          'Death': 'Destroy own item',
          'The Tower': 'Destroy opponent item',
          'The Fool': 'Chamber bullet reveal',
          'Justice': 'Swap HP totals',
          'Temperance': 'Swap items with opponent'
        };
        const deckCards: TarotCard[] = selectedNames.map(name => ({
          name,
          power: cardPowers[name]
        }));

        setGameState(prev => ({
          ...prev,
          deckCards,
          selectedCardIndex: null,
          phase: 'CARD_SELECT'
        }));
        
        setCameraView('TABLE');
        
        addLog(`${userName} SHUFFLED TAROT CARDS`, 'info');
        setOverlayText("🃏 SELECT A TAROT CARD...");
        await wait(1800);
        setOverlayText(null);
        break;
      }
    }

    // Final synchronization wait - ensures animation is visually complete before proceeding
    await wait(300);

    return roundEnded;
  };

  const usePlayerItem = async (index: number) => {
    if (gameStateRef.current.phase !== 'PLAYER_TURN') return;
    if (gameStateRef.current.turnOwner !== 'PLAYER') return; // Strict turn check
    if (isProcessing) return;

    // Check if gun is held - blocking all item usage
    if (cameraView === 'GUN' || aimTarget !== 'IDLE') {
      addLog("CAN'T USE ITEMS WHILE HOLDING GUN", 'info');
      // Force UI update to ensure button text or blocked state is visible
      return;
    }

    const item = playerRef.current.items[index];
    if (!item) return;

    // Logic for ADRENALINE (Must have something to steal)
    if (item === 'ADRENALINE') {
      const stealableItems = dealerRef.current.items.filter(i => i !== 'ADRENALINE' && i !== 'JACKPOT' && i !== null);
      if (stealableItems.length === 0) {
        addLog("NOTHING TO STEAL", 'info');
        return;
      }
    }

    setIsProcessing(true);

    const newItems = [...playerRef.current.items];
    newItems.splice(index, 1);
    setPlayer(p => ({ ...p, items: newItems }));

    await processItemEffect('PLAYER', item);

    setIsProcessing(false);
  };

  // Helper to directly set game phase (useful for multiplayer)
  const setGamePhase = (phase: GameState['phase']) => {
    setGameState(prev => ({ ...prev, phase }));
  };

  const stealItem = async (index: number, stealer: TurnOwner = 'PLAYER') => {
    // Prevent actions during steal
    if (isProcessing) return;

    const target = stealer === 'PLAYER' ? dealerRef.current : playerRef.current;
    const user = stealer === 'PLAYER' ? playerRef.current : dealerRef.current;
    const setUser = stealer === 'PLAYER' ? setPlayer : setDealer;
    const setTarget = stealer === 'PLAYER' ? setDealer : setPlayer;

    const itemToSteal = target.items[index];
    if (!itemToSteal) return;

    if (itemToSteal === 'ADRENALINE') {
      if (stealer === 'PLAYER') {
        addLog("CAN'T STEAL ADRENALINE!", 'danger');
        setOverlayText("❌ CAN'T STEAL ADRENALINE! PICK ANOTHER");
        await wait(2000);
        setOverlayText(null);
      }
      return;
    }

    if (itemToSteal === 'TOTEM') {
      if (stealer === 'PLAYER') {
        addLog("CAN'T STEAL TOTEM!", 'danger');
        setOverlayText("❌ CAN'T STEAL TOTEM! PICK ANOTHER");
        await wait(2000);
        setOverlayText(null);
      }
      return;
    }

    if (itemToSteal === 'JACKPOT') {
      if (stealer === 'PLAYER') {
        addLog("CAN'T STEAL JACKPOT!", 'danger');
        setOverlayText("❌ CAN'T STEAL JACKPOT! PICK ANOTHER");
        await wait(2000);
        setOverlayText(null);
      }
      return;
    }

    setIsProcessing(true);

    const newTargetItems = [...target.items];
    newTargetItems.splice(index, 1);
    setTarget(prev => ({ ...prev, items: newTargetItems }));

    const stealerName = stealer === 'PLAYER' ? (playerName || 'PLAYER') : (gameStateRef.current.opponentName || 'OPPONENT');
    addLog(`${stealerName.toUpperCase()} STOLE ${itemToSteal}`, 'info');
    setOverlayText(`🎯 ${stealerName.toUpperCase()} STOLE ${itemToSteal}!`);
    await wait(800);
    setOverlayText(null);

    if (stealer === 'PLAYER') {
      setGameState(p => ({ ...p, phase: 'PLAYER_TURN' }));
    } else {
      setGameState(p => ({ ...p, phase: 'DEALER_TURN' }));
    }

    await wait(100);
    await processItemEffect(stealer, itemToSteal);

    await wait(300);
    setIsProcessing(false);
  };

  const selectTarotCard = async (index: number) => {
    if (gameStateRef.current.selectedCardIndex !== null && gameStateRef.current.selectedCardIndex !== undefined) return;
    
    setIsProcessing(true);
    
    setGameState(prev => ({
      ...prev,
      selectedCardIndex: index
    }));

    audioManager.playSound('cards');

    const cards = gameStateRef.current.deckCards;
    if (!cards || !cards[index]) {
      setIsProcessing(false);
      const nextPhase = gameStateRef.current.turnOwner === 'PLAYER' ? 'PLAYER_TURN' : 'DEALER_TURN';
      setGameState(prev => ({ ...prev, phase: nextPhase, deckCards: undefined, selectedCardIndex: null }));
      setCameraView('PLAYER');
      return;
    }

    const chosenCard = cards[index];
    const turnOwner = gameStateRef.current.turnOwner;
    const userName = turnOwner === 'PLAYER' ? (playerName || 'PLAYER') : (gameStateRef.current.opponentName || 'OPPONENT');
    
    setOverlayText(`🃏 ${userName.toUpperCase()} REVEALED: ${chosenCard.name.toUpperCase()}...`);

    await wait(1800);
    setCameraView('PLAYER');
    await wait(1700);

    let deathTriggered = false;

    const dealDamage = async (target: TurnOwner, amount: number) => {
      const isPlayerTarget = target === 'PLAYER';
      const currentHp = isPlayerTarget ? playerRef.current.hp : dealerRef.current.hp;
      const currentItems = isPlayerTarget ? playerRef.current.items : dealerRef.current.items;
      const hasTotem = currentItems.includes('TOTEM');
      const newHp = currentHp - amount;
      
      if (newHp <= 0) {
        if (hasTotem) {
          const setTarget = isPlayerTarget ? setPlayer : setDealer;
          setTarget(p => {
            const idx = p.items.indexOf('TOTEM');
            const newItems = [...p.items];
            if (idx !== -1) newItems.splice(idx, 1);
            return { ...p, hp: 1, items: newItems };
          });
          
          setOverlayText(`✨ ${isPlayerTarget ? 'PLAYER' : 'DEALER'} SAVED BY TOTEM ✨`);
          setAnim(prev => ({
            ...prev,
            triggerTotem: (prev.triggerTotem || 0) + 1,
            totemTarget: target
          }));
          audioManager.playSound('totem');
          addLog(`${isPlayerTarget ? 'PLAYER' : 'DEALER'}'S TOTEM OF UNDYING SAVED THEM!`, 'safe');
          await wait(3000);
          setOverlayText(null);
        } else {
          const setTarget = isPlayerTarget ? setPlayer : setDealer;
          setTarget(p => ({ ...p, hp: 0 }));
          addLog(`${isPlayerTarget ? 'PLAYER' : 'DEALER'} DIED TO HANGED MAN EFFECT.`, 'danger');
          
          const isHardMode = gameStateRef.current.isHardMode;
          const isMultiplayer = gameStateRef.current.isMultiplayer;
          
          if (isPlayerTarget) {
            if (isHardMode) {
              handleHardModeRoundEnd('DEALER');
              return true;
            }
            if (isMultiplayer && handleMPRoundEnd) {
              handleMPRoundEnd('DEALER');
              return true;
            }
            if (!isMultiplayer && !isHardMode && handleNormalModeRoundEnd) {
              handleNormalModeRoundEnd('DEALER');
              return true;
            }
            setGameState(prev => ({ ...prev, winner: 'DEALER', phase: 'GAME_OVER' }));
          } else {
            if (isHardMode) {
              handleHardModeRoundEnd('PLAYER');
              return true;
            }
            if (isMultiplayer && handleMPRoundEnd) {
              handleMPRoundEnd('PLAYER');
              return true;
            }
            if (!isMultiplayer && !isHardMode && handleNormalModeRoundEnd) {
              handleNormalModeRoundEnd('PLAYER');
              return true;
            }
            setGameState(prev => ({ ...prev, winner: 'PLAYER', phase: 'GAME_OVER' }));
          }
          return true;
        }
      } else {
        const setTarget = isPlayerTarget ? setPlayer : setDealer;
        setTarget(p => ({ ...p, hp: newHp }));
        addLog(`${isPlayerTarget ? 'PLAYER' : 'DEALER'} lost ${amount} HP from Hanged Man card.`, 'danger');
      }
      return false;
    };

    switch (chosenCard.name) {
      case 'The Magician': {
        const item = getRandomItem(gameStateRef.current.isHardMode, turnOwner === 'DEALER');
        const setOwner = turnOwner === 'PLAYER' ? setPlayer : setDealer;
        const ownerItems = turnOwner === 'PLAYER' ? playerRef.current.items : dealerRef.current.items;
        
        if (ownerItems.length < MAX_ITEMS) {
          setOwner(p => ({ ...p, items: [...p.items, item] }));
          addLog(`${userName} gained a random item: ${item}`, 'safe');
          setOverlayText(`🔮 THE MAGICIAN: GAINED ${item}!`);
        } else {
          addLog(`${userName}'s inventory is full. Magic item was discarded.`, 'info');
          setOverlayText("🔮 THE MAGICIAN: INVENTORY FULL!");
        }
        break;
      }
      
      case 'The Hanged Man': {
        deathTriggered = await dealDamage(turnOwner, 1);
        setOverlayText(`🩸 THE HANGED MAN: ${userName} LOST 1 HP!`);
        break;
      }
      
      case 'The Hermit': {
        addLog(`${userName} ends turn instantly with The Hermit.`, 'danger');
        setOverlayText(`⛓️ THE HERMIT: TURN TRANSFERRED TO ${turnOwner === 'PLAYER' ? 'DEALER' : 'PLAYER'}!`);
        break;
      }
      
      case 'The Moon': {
        const opponent = turnOwner === 'PLAYER' ? dealerRef.current : playerRef.current;
        const setOpponent = turnOwner === 'PLAYER' ? setDealer : setPlayer;
        const setOwner = turnOwner === 'PLAYER' ? setPlayer : setDealer;
        const owner = turnOwner === 'PLAYER' ? playerRef.current : dealerRef.current;
        
        const stealableIndices = opponent.items
          .map((item, idx) => ({ item, idx }))
          .filter(x => x.item !== null && x.item !== 'TOTEM' && x.item !== 'JACKPOT')
          .map(x => x.idx);
        
        if (stealableIndices.length > 0) {
          const randIdx = stealableIndices[Math.floor(Math.random() * stealableIndices.length)];
          const stolenItem = opponent.items[randIdx];
          
          setOpponent(p => {
            const items = [...p.items];
            const idxInItems = items.indexOf(stolenItem);
            if (idxInItems !== -1) items.splice(idxInItems, 1);
            return { ...p, items };
          });
          
          if (owner.items.length < MAX_ITEMS) {
            setOwner(p => ({ ...p, items: [...p.items, stolenItem] }));
            addLog(`${userName} stole opponent's ${stolenItem}!`, 'safe');
            setOverlayText(`🌙 THE MOON: STOLE ${stolenItem}!`);
          } else {
            addLog(`${userName} stole ${stolenItem} but inventory was full (discarded)!`, 'info');
            setOverlayText(`🌙 THE MOON: STOLE ${stolenItem} (DISCARDED)`);
          }
        } else {
          addLog("Opponent has no items to steal.", 'info');
          setOverlayText("🌙 THE MOON: OPPONENT HAS NO ITEMS");
        }
        break;
      }
      
      case 'Judgment': {
        const chamber = [...gameStateRef.current.chamber];
        const idx = gameStateRef.current.currentShellIndex;
        if (idx < chamber.length) {
          if (chamber[idx] === 'BLANK') {
            if (Math.random() < 0.5) {
              chamber[idx] = 'LIVE';
              setGameState(prev => ({ ...prev, chamber }));
            }
          }
          addLog("Current shell was judged by Judgment.", 'info');
          setOverlayText("⚖️ JUDGMENT: CURRENT SHELL JUDGED!");
        } else {
          setOverlayText("⚖️ JUDGMENT: CHAMBER EMPTY");
        }
        break;
      }
      
      case 'Wheel of Fortune': {
        const chamber = [...gameStateRef.current.chamber];
        const idx = gameStateRef.current.currentShellIndex;
        const remaining = chamber.slice(idx);
        if (remaining.length > 0) {
          const shuffledRemaining = remaining.sort(() => Math.random() - 0.5);
          for (let i = 0; i < shuffledRemaining.length; i++) {
            chamber[idx + i] = shuffledRemaining[i];
          }
          const liveCount = chamber.slice(idx).filter(s => s === 'LIVE').length;
          const blankCount = chamber.slice(idx).filter(s => s === 'BLANK').length;
          setGameState(prev => ({ ...prev, chamber, liveCount, blankCount }));
          setKnownShell(null);
          addLog("Ammo chamber reshuffled!", 'info');
          setOverlayText("🎡 WHEEL OF FORTUNE: SHUFFLED CHAMBER!");
        } else {
          setOverlayText("🎡 WHEEL OF FORTUNE: CHAMBER EMPTY");
        }
        break;
      }
      
      case 'The Sun': {
        const setOwner = turnOwner === 'PLAYER' ? setPlayer : setDealer;
        const ownerState = turnOwner === 'PLAYER' ? playerRef.current : dealerRef.current;
        const newHp = Math.min(ownerState.maxHp, ownerState.hp + 1);
        setOwner(p => ({ ...p, hp: newHp }));
        addLog(`${userName} healed 1 HP.`, 'safe');
        setOverlayText("☀️ THE SUN: HEALED 1 HP!");
        break;
      }
      
      case 'Death': {
        const setOwner = turnOwner === 'PLAYER' ? setPlayer : setDealer;
        const ownerState = turnOwner === 'PLAYER' ? playerRef.current : dealerRef.current;
        if (ownerState.items.length > 0) {
          const randIdx = Math.floor(Math.random() * ownerState.items.length);
          const destroyedItem = ownerState.items[randIdx];
          setOwner(p => {
            const items = [...p.items];
            items.splice(randIdx, 1);
            return { ...p, items };
          });
          addLog(`${userName} destroyed own item: ${destroyedItem}`, 'danger');
          setOverlayText(`💀 DEATH: DESTROYED OWN ${destroyedItem}!`);
        } else {
          addLog(`${userName} has no items to destroy.`, 'info');
          setOverlayText("💀 DEATH: NO ITEMS TO DESTROY");
        }
        break;
      }
      
      case 'The Tower': {
        const setOpponent = turnOwner === 'PLAYER' ? setDealer : setPlayer;
        const opponentState = turnOwner === 'PLAYER' ? dealerRef.current : playerRef.current;
        const destroyableItems = opponentState.items.filter(i => i !== null && i !== 'TOTEM');
        
        if (destroyableItems.length > 0) {
          const randIdx = Math.floor(Math.random() * destroyableItems.length);
          const destroyedItem = destroyableItems[randIdx];
          setOpponent(p => {
            const items = [...p.items];
            const idx = items.indexOf(destroyedItem);
            if (idx !== -1) items.splice(idx, 1);
            return { ...p, items };
          });
          addLog(`${userName} destroyed opponent's item: ${destroyedItem}`, 'safe');
          setOverlayText(`🏰 THE TOWER: DESTROYED OPPONENT'S ${destroyedItem}!`);
        } else {
          addLog("Opponent has no items to destroy.", 'info');
          setOverlayText("🏰 THE TOWER: OPPONENT HAS NO ITEMS");
        }
        break;
      }
      
      case 'The Fool': {
        const checkLimit = gameStateRef.current.chamber.length;
        const current = gameStateRef.current.currentShellIndex;
        const remaining = checkLimit - current;
        
        let randomIndex = current;
        let positionText = "CURRENT SHELL";
        
        if (remaining > 2) {
          const offset = 1 + Math.floor(Math.random() * (remaining - 1));
          randomIndex = current + offset;
          positionText = `${offset + 1}TH SHELL`;
        } else if (remaining === 2) {
          randomIndex = current + 1;
          positionText = "2ND SHELL";
        } else {
          randomIndex = current;
          positionText = "CURRENT SHELL";
        }
        
        const actualShell = gameStateRef.current.chamber[randomIndex];
        const lieProb = remaining > 2 ? 0.0 : (remaining === 2 ? 0.10 : 0.25);
        const isLying = Math.random() < lieProb;
        const displayedShell = isLying ? (actualShell === 'LIVE' ? 'BLANK' : 'LIVE') : actualShell;
        
        const displayText = `🃏 THE FOOL: ${positionText} IS ${displayedShell}`;
        addLog(`Tarot reveal: ${positionText} is ${displayedShell}`, 'info');
        setOverlayText(displayText);
        break;
      }
      
      case 'Justice': {
        const playerHp = playerRef.current.hp;
        const dealerHp = dealerRef.current.hp;
        setPlayer(p => ({ ...p, hp: dealerHp }));
        setDealer(d => ({ ...d, hp: playerHp }));
        addLog(`HP Swapped! Player HP: ${dealerHp}, Dealer HP: ${playerHp}`, 'safe');
        setOverlayText("⚖️ JUSTICE: HP SWAPPED!");
        break;
      }
      
      case 'Temperance': {
        const playerItems = [...playerRef.current.items];
        const dealerItems = [...dealerRef.current.items];
        setPlayer(p => ({ ...p, items: dealerItems }));
        setDealer(d => ({ ...d, items: playerItems }));
        addLog(`Items Swapped! Player gained ${dealerItems.length} items, Dealer gained ${playerItems.length} items.`, 'safe');
        setOverlayText("🔀 TEMPERANCE: ITEMS SWAPPED!");
        break;
      }
    }

    await wait(3000);
    setOverlayText(null);

    if (!deathTriggered && gameStateRef.current.phase !== 'GAME_OVER') {
      let nextOwner = turnOwner;
      if (chosenCard.name === 'The Hermit') {
        nextOwner = turnOwner === 'PLAYER' ? 'DEALER' : 'PLAYER';
      }
      const nextPhase = nextOwner === 'PLAYER' ? 'PLAYER_TURN' : 'DEALER_TURN';
      setGameState(prev => ({
        ...prev,
        phase: nextPhase,
        turnOwner: nextOwner,
        deckCards: undefined,
        selectedCardIndex: null
      }));
    }
    
    setCameraView('PLAYER');
    setIsProcessing(false);
  };




  return {
    gameState,
    player,
    dealer,
    logs,
    animState,
    knownShell,
    playerName,
    aimTarget,
    cameraView,
    overlayColor,
    overlayText,
    showBlood,
    showFlash,
    showFlashbang,
    receivedItems,
    showLootOverlay,
    isProcessing,
    setIsProcessing,
    startGame,
    fireShot,
    usePlayerItem,
    stealItem, // Exported
    selectTarotCard,
    setAimTarget,
    setCameraView,
    setDealer,
    setPlayer,
    setGameState,
    processItemEffect,
    resetGame,
    setPlayerName,
    pickupGun: (picker: TurnOwner = 'PLAYER') => {
      if (gameStateRef.current.phase !== 'PLAYER_TURN' && gameStateRef.current.phase !== 'DEALER_TURN' && gameStateRef.current.phase !== 'RESOLVING') return;

      // Strict turn check
      if (picker === 'PLAYER' && gameStateRef.current.turnOwner !== 'PLAYER') return;
      if (picker === 'DEALER' && gameStateRef.current.turnOwner !== 'DEALER') return;

      if (picker === 'PLAYER') {
        setCameraView('GUN');
        setAimTarget('CHOOSING');
      } else {
        setCameraView('DEALER_GUN');
        setAimTarget('IDLE');
      }
    },
    syncState: (data: { player: PlayerState, dealer: PlayerState, gameState: Partial<GameState> }) => {
      if (data.player) setPlayer(p => ({ ...p, ...data.player }));
      if (data.dealer) setDealer(d => ({ ...d, ...data.dealer }));
      if (data.gameState) setGameState(s => ({ ...s, ...data.gameState }));
    },
    setGamePhase,
    setOverlayText,
    matchStats: matchStatsRef.current,
    setOnBatchEnd: (cb: () => void) => { onBatchEndRef.current = cb; },
    startRound,
    handleHardModeRoundEnd,
    handleMPRoundEnd,
    handleNormalModeRoundEnd
  };
};