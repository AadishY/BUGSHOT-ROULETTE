  import { useState, useEffect, useRef } from 'react';
import { GameState, PlayerState, ShellType, ItemType, LogEntry, TurnOwner, CameraView, AimTarget, AnimationState, RoomSettings, TarotCard, PlayerModelKey } from '../types';
import { MAX_HP, MAX_ITEMS, ITEMS } from '../constants';
import { randomInt, wait } from '../utils/gameUtils';
import * as ItemActions from '../utils/game/itemActions';
import { audioManager } from '../utils/audioManager';
import { performShot } from '../utils/game/shooting';
import { distributeItems as distributeItemsAction, getRandomItem, resolveJackpotOutcome } from '../utils/game/inventory';
import { MatchStats } from '../utils/statsManager';

export const useGameLogic = () => {
  // --- State ---
  const [playerName, setPlayerName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const onBatchEndRef = useRef<((keepTurn: boolean) => void) | null>(null);
  const onMPRoundEndRef = useRef<((winner: TurnOwner, pWin?: number, oWin?: number) => void | Promise<void>) | null>(null);
  const [dealerModel, setDealerModel] = useState<PlayerModelKey>('DEFAULT');


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

  const [player3, setPlayer3] = useState<PlayerState>({
    hp: MAX_HP,
    maxHp: MAX_HP,
    items: [],
    isHandcuffed: false,
    isSawedActive: false,
    luckycharmsUsed: 0,
    lastTurnItemsUsed: [],
    currentTurnItemsUsed: [],
  });

  const [player4, setPlayer4] = useState<PlayerState>({
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
  const player3Ref = useRef(player3);
  const player4Ref = useRef(player4);
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
    player3Ref.current = player3;
  }, [player3]);

  useEffect(() => {
    player4Ref.current = player4;
  }, [player4]);

  useEffect(() => {
    if (gameState.phase === 'LOAD' || gameState.phase === 'LOOTING' || gameState.phase === 'GAME_OVER') {
      setPlayer(p => ({ ...p, lastTurnItemsUsed: [], currentTurnItemsUsed: [] }));
      setDealer(d => ({ ...d, lastTurnItemsUsed: [], currentTurnItemsUsed: [] }));
      setPlayer3(p3 => ({ ...p3, lastTurnItemsUsed: [], currentTurnItemsUsed: [] }));
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
      } else if (prevOwner === 'DEALER') {
        setDealer(d => ({
          ...d,
          lastTurnItemsUsed: d.currentTurnItemsUsed || [],
          currentTurnItemsUsed: []
        }));
      } else if (prevOwner === 'PLAYER3') {
        setPlayer3(p3 => ({
          ...p3,
          lastTurnItemsUsed: p3.currentTurnItemsUsed || [],
          currentTurnItemsUsed: []
        }));
      }
      prevTurnOwnerRef.current = gameState.turnOwner;
    }
  }, [gameState.turnOwner, gameState.phase]);

  // Reset lastTurnWasSkipped flag when phase changes to a turn phase
  useEffect(() => {
    if (gameState.phase === 'PLAYER_TURN' || gameState.phase === 'DEALER_TURN' || gameState.phase === 'PLAYER3_TURN' || gameState.phase === 'PLAYER4_TURN') {
      if (gameState.lastTurnWasSkipped) {
        setGameState(prev => ({ ...prev, lastTurnWasSkipped: false }));
      }
    }
  }, [gameState.phase]);

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
  const [overlayText, setOverlayTextState] = useState<string | null>(null);
  const [overlayTextUpdatedAt, setOverlayTextUpdatedAt] = useState<number>(0);
  const [showBlood, setShowBlood] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [showFlashbang, setShowFlashbang] = useState(false);

  const [receivedItems, setReceivedItems] = useState<ItemType[]>([]);
  const [showLootOverlay, setShowLootOverlay] = useState(false);

  const setOverlayText = (nextValue: React.SetStateAction<string | null>) => {
    const resolvedValue = typeof nextValue === 'function'
      ? (nextValue as (prevState: string | null) => string | null)(overlayText)
      : nextValue;

    if (overlayHideTimeoutRef.current) {
      clearTimeout(overlayHideTimeoutRef.current);
      overlayHideTimeoutRef.current = null;
    }
    setOverlayTextUpdatedAt(Date.now());
    setOverlayTextState(resolvedValue);
  };

  const getOpponentName = () => {
    return gameState.isMultiplayer ? (gameState.opponentName || 'OPPONENT') : 'DEALER';
  };

  const getPlayerNameHelper = (owner: TurnOwner) => {
    if (owner === 'PLAYER') return playerName || 'YOU';
    if (owner === 'DEALER') return getOpponentName();
    if (gameStateRef.current.multiplayerState?.players) {
      const players = gameStateRef.current.multiplayerState.players;
      const myId = gameStateRef.current.localPlayerId || '';
      const myIndex = players.findIndex((p: any) => p.id === myId);
      if (myIndex !== -1) {
        const sideOpponent = players[(myIndex + 1) % 3];
        if (sideOpponent) return sideOpponent.name;
      }
    }
    return 'OPPONENT 2';
  };

  const addLog = (text: string, type: LogEntry['type'] = 'neutral') => {
    setLogs(prev => [...prev, { id: Date.now() + Math.random(), text, type }]);
  };

  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const overlayHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!gameState.isMultiplayer) {
      if (overlayHideTimeoutRef.current) {
        clearTimeout(overlayHideTimeoutRef.current);
        overlayHideTimeoutRef.current = null;
      }
      return;
    }

    if (overlayText) {
      if (overlayHideTimeoutRef.current) {
        clearTimeout(overlayHideTimeoutRef.current);
      }
      overlayHideTimeoutRef.current = setTimeout(() => {
        setOverlayText(null);
        overlayHideTimeoutRef.current = null;
      }, 30000);
    } else if (overlayHideTimeoutRef.current) {
      clearTimeout(overlayHideTimeoutRef.current);
      overlayHideTimeoutRef.current = null;
    }

    return () => {
      if (overlayHideTimeoutRef.current) {
        clearTimeout(overlayHideTimeoutRef.current);
        overlayHideTimeoutRef.current = null;
      }
    };
  }, [overlayText, overlayTextUpdatedAt, gameState.isMultiplayer]);

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
    setDealerModel('DEFAULT');

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
    setPlayer({ hp: MAX_HP, maxHp: MAX_HP, items: [], isHandcuffed: false, isSawedActive: false, luckycharmsUsed: 0, isFlashbanged: false, jackpotImmunityShots: 0, hasJackpotWinActive: false });
    setDealer({ hp: MAX_HP, maxHp: MAX_HP, items: [], isHandcuffed: false, isSawedActive: false, luckycharmsUsed: 0, isFlashbanged: false, jackpotImmunityShots: 0, hasJackpotWinActive: false });
    setPlayer3({ hp: MAX_HP, maxHp: MAX_HP, items: [], isHandcuffed: false, isSawedActive: false, luckycharmsUsed: 0, isFlashbanged: false, jackpotImmunityShots: 0, hasJackpotWinActive: false });
    setPlayer4({ hp: MAX_HP, maxHp: MAX_HP, items: [], isHandcuffed: false, isSawedActive: false, luckycharmsUsed: 0, isFlashbanged: false, jackpotImmunityShots: 0, hasJackpotWinActive: false });
    setLogs([]);
    setKnownShell(null);
    setAnim({
      triggerRecoil: 0, triggerRack: 0, triggerSparks: 0, triggerHeal: 0, triggerDrink: 0, triggerCuff: 0,
      isSawing: false, ejectedShellColor: 'red', muzzleFlashIntensity: 0, isLiveShot: false,
      dealerHit: false, dealerDropping: false, playerHit: false, playerRecovering: false, dealerRecovering: false,
      player3Hit: false, player3Dropping: false, player3Recovering: false,
      player4Hit: false, player4Dropping: false, player4Recovering: false,
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
    mpSettings?: RoomSettings,
    p3ItemsOverride?: ItemType[],
    p4ItemsOverride?: ItemType[]
  ) => {
    // Clear any pending resets from previous actions
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }


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
      isThreePlayer: isMultiplayer && p3ItemsOverride !== undefined,
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
      startRound(true, hardMode, initialHardModeState, chamberOverride, pItemsOverride, dItemsOverride, turnOwner, hpOverride, undefined, p3ItemsOverride, p4ItemsOverride);
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
    multiWinsOverride?: { playerWins: number, opponentWins: number },
    p3ItemsOverride?: ItemType[],
    p4ItemsOverride?: ItemType[]
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
      const isNormalRound1 = !isHM && !gameStateRef.current.isMultiplayer && (gameStateRef.current.normalModeState?.round || 1) === 1;
      const total = isNormalRound1 ? randomInt(2, 4) : randomInt(2, 8);
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
    setAnim({
      dealerDropping: false,
      dealerHit: false,
      dealerRecovering: false,
      playerHit: false,
      playerRecovering: false,
      player3Hit: false,
      player3Dropping: false,
      player3Recovering: false,
      player4Hit: false,
      player4Dropping: false,
      player4Recovering: false
    });
    let startCamView: CameraView = 'PLAYER';
    if (turnOwnerOverride === 'DEALER') startCamView = 'DEALER';
    else if (turnOwnerOverride === 'PLAYER3') startCamView = 'PLAYER3_GUN';
    else if (turnOwnerOverride === 'PLAYER4') startCamView = 'PLAYER';
    setCameraView(startCamView);

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
    if (resetItems || hpOverride !== undefined) {
      const targetHp = hpOverride || startingHp;
      setPlayer(p => ({ 
        ...p, 
        isHandcuffed: false, 
        isSawedActive: false, 
        isChokeActive: false,
        isFlashbanged: false, 
        luckycharmsUsed: 0, 
        jackpotImmunityShots: 0,
        hasJackpotWinActive: false,
        hp: targetHp, 
        maxHp: targetHp,
        ...(resetItems ? { items: [] } : {})
      }));
      setDealer(d => ({ 
        ...d, 
        isHandcuffed: false, 
        isSawedActive: false, 
        isChokeActive: false,
        isFlashbanged: false, 
        luckycharmsUsed: 0, 
        jackpotImmunityShots: 0,
        hasJackpotWinActive: false,
        hp: targetHp, 
        maxHp: targetHp,
        ...(resetItems ? { items: [] } : {})
      }));
      setPlayer3(p3 => ({ 
        ...p3, 
        isHandcuffed: false, 
        isSawedActive: false, 
        isChokeActive: false,
        isFlashbanged: false, 
        luckycharmsUsed: 0, 
        jackpotImmunityShots: 0,
        hasJackpotWinActive: false,
        hp: targetHp, 
        maxHp: targetHp,
        items: p3ItemsOverride || (resetItems ? [] : p3.items)
      }));
      setPlayer4(p4 => ({ 
        ...p4, 
        isHandcuffed: false, 
        isSawedActive: false, 
        isChokeActive: false,
        isFlashbanged: false, 
        luckycharmsUsed: 0, 
        jackpotImmunityShots: 0,
        hasJackpotWinActive: false,
        hp: targetHp, 
        maxHp: targetHp,
        items: p4ItemsOverride || (resetItems ? [] : p4.items)
      }));
    } else {
      // Just reset status effects
      setPlayer(p => ({ ...p, isHandcuffed: false, isSawedActive: false, isChokeActive: false, isFlashbanged: false }));
      setDealer(d => ({ ...d, isHandcuffed: false, isSawedActive: false, isChokeActive: false, isFlashbanged: false }));
      setPlayer3(p3 => ({ ...p3, isHandcuffed: false, isSawedActive: false, isChokeActive: false, isFlashbanged: false }));
      setPlayer4(p4 => ({ ...p4, isHandcuffed: false, isSawedActive: false, isChokeActive: false, isFlashbanged: false }));
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
    await wait(4100);
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
      playerRef.current.items, dealerRef.current.items,
      playerRef.current.luckycharmsUsed || 0,
      dealerRef.current.luckycharmsUsed || 0,
      playerRef.current.hp,
      playerRef.current.maxHp,
      dealerRef.current.maxHp
    );

    const nextTurn = turnOwnerOverride || 'PLAYER';
    let nextPhase: GameState['phase'] = 'PLAYER_TURN';
    if (nextTurn === 'DEALER') nextPhase = 'DEALER_TURN';
    else if (nextTurn === 'PLAYER3') nextPhase = 'PLAYER3_TURN';

    setGameState(prev => ({ ...prev, phase: nextPhase, turnOwner: nextTurn }));
    if (nextTurn === 'PLAYER') {
      setCameraView('PLAYER');
      addLog('YOUR MOVE.');
    } else {
      setCameraView(nextTurn === 'PLAYER3' ? 'PLAYER3_GUN' : 'DEALER');
      addLog(`${getPlayerNameHelper(nextTurn).toUpperCase()}'S TURN.`);
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

    // Track stats
    if (winner === 'PLAYER') {
      matchStatsRef.current.roundsSurvived++;
    }
    if (!matchStatsRef.current.roundResults) matchStatsRef.current.roundResults = [];
    matchStatsRef.current.roundResults.push(winner === 'PLAYER' ? 'WIN' : 'LOSS');

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
      matchStatsRef.current.result = winner === 'PLAYER' ? 'WIN' : 'LOSS';
      setIsProcessing(false);
      return;
    }

    if (onMPRoundEndRef.current) {
      await onMPRoundEndRef.current(winner, pWin, oWin);
      setIsProcessing(false);
      return;
    }

    // Next Round (Singleplayer)
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
      playerRef.current.items, dealerRef.current.items,
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
      animState.dealerDropping || animState.dealerRecovering ||
      animState.player3Hit || animState.player3Recovering ||
      animState.player4Hit || animState.player4Recovering) {
      addLog('WAIT FOR RECOVERY...', 'info');
      return;
    }
    // New Logic: Don't move camera yet. Just show target choices.
    setAimTarget('CHOOSING');
    setCameraView('GUN'); // Set camera to gun view immediately
  };

  const getPlayerState = (owner: TurnOwner) => {
    if (owner === 'PLAYER') return playerRef.current;
    if (owner === 'PLAYER3') return player3Ref.current;
    if (owner === 'PLAYER4') return player4Ref.current;
    return dealerRef.current;
  };

  const getPlayerSetter = (owner: TurnOwner) => {
    if (owner === 'PLAYER') return setPlayer;
    if (owner === 'PLAYER3') return setPlayer3;
    if (owner === 'PLAYER4') return setPlayer4;
    return setDealer;
  };

  const getPlayerNameByOwner = (owner: TurnOwner) => {
    if (owner === 'PLAYER') return playerName || 'PLAYER';
    const players = gameStateRef.current.multiplayerState?.players || [];
    const myId = gameStateRef.current.localPlayerId || '';
    const myIndex = players.findIndex(p => p.id === myId);
    if (myIndex !== -1 && players.length >= 3) {
      const size = players.length;
      const frontOpponent = players[(myIndex + 2) % size];
      const sideOpponent = players[(myIndex + 1) % size];
      const rightOpponent = size >= 4 ? players[(myIndex + 3) % size] : null;
      if (owner === 'DEALER') return frontOpponent?.name || 'OPPONENT 1';
      if (owner === 'PLAYER3') return sideOpponent?.name || 'OPPONENT 2';
      if (owner === 'PLAYER4') return rightOpponent?.name || 'OPPONENT 3';
    }
    return owner === 'DEALER' ? (gameStateRef.current.opponentName || 'OPPONENT') : 'OPPONENT 2';
  };

  const resolveTargetOwner = (targetPlayerId: string, localPlayerId: string, players: any[]): TurnOwner => {
    if (!targetPlayerId) return 'DEALER';
    if (targetPlayerId === localPlayerId) return 'PLAYER';

    const size = players?.length || 0;
    const myIndex = players ? players.findIndex(p => p.id === localPlayerId) : -1;
    if (myIndex === -1 || size < 2) return 'DEALER';

    let absoluteId = targetPlayerId;
    if (['PLAYER', 'PLAYER3', 'PLAYER4', 'DEALER'].includes(targetPlayerId)) {
      if (targetPlayerId === 'PLAYER') {
        absoluteId = localPlayerId;
      } else if (targetPlayerId === 'DEALER') {
        absoluteId = players[(myIndex + 2) % size]?.id || localPlayerId;
      } else if (targetPlayerId === 'PLAYER3') {
        absoluteId = players[(myIndex + 1) % size]?.id || localPlayerId;
      } else if (targetPlayerId === 'PLAYER4') {
        absoluteId = players[(myIndex + (size === 4 ? 3 : 1)) % size]?.id || localPlayerId;
      }
    }

    if (absoluteId === localPlayerId) return 'PLAYER';
    const targetIndex = players.findIndex(p => p.id === absoluteId);
    if (targetIndex === -1) return 'DEALER';

    if (size === 2) {
      return 'DEALER';
    }

    if (size === 3) {
      if (targetIndex === (myIndex + 2) % 3) return 'DEALER';
      if (targetIndex === (myIndex + 1) % 3) return 'PLAYER3';
      return 'DEALER';
    }

    if (size >= 4) {
      if (targetIndex === (myIndex + 2) % size) return 'DEALER';
      if (targetIndex === (myIndex + 1) % size) return 'PLAYER3';
      if (targetIndex === (myIndex + 3) % size) return 'PLAYER4';
      return 'DEALER';
    }

    return 'DEALER';
  };

  const fireShot = async (shooter: TurnOwner, target: TurnOwner) => {
    // Basic phase check
    const isMP = gameStateRef.current.isMultiplayer;
    if (!isMP) {
      if (gameStateRef.current.phase !== 'PLAYER_TURN' && gameStateRef.current.phase !== 'DEALER_TURN' && gameStateRef.current.phase !== 'PLAYER3_TURN' && gameStateRef.current.phase !== 'RESOLVING') return;
    }

    // Strict turn check for local player
    if (shooter === 'PLAYER' && gameStateRef.current.turnOwner !== 'PLAYER') {
      console.warn("Attempted to fire out of turn.");
      return;
    }

    if (shooter === 'PLAYER' && isProcessing) return;

    const isThreePlayer = gameStateRef.current.isThreePlayer;
    let intendedAim: AimTarget = 'OPPONENT';
    if (isThreePlayer) {
      if (target === shooter) {
        intendedAim = 'SELF';
      } else {
        const sidePos = gameStateRef.current.roomSettings?.hp === 3 ? 'left' : 'left'; // default
        if (target === 'PLAYER3') {
          intendedAim = 'LEFT'; // Handled via camera view
        } else {
          intendedAim = 'OPPONENT';
        }
      }
    } else {
      intendedAim = target === (shooter === 'PLAYER' ? 'PLAYER' : 'DEALER') ? 'SELF' : 'OPPONENT';
    }

    if (shooter === 'PLAYER') {
      setCameraView('GUN');
    }

    setIsProcessing(true);

    if (isThreePlayer) {
      setAimTarget(target === shooter ? 'SELF' : (target === 'PLAYER3' ? 'LEFT' : 'OPPONENT'));
      await wait(500);

      const currentChamberIdx = gameStateRef.current.currentShellIndex;
      const currentShell = gameStateRef.current.chamber[currentChamberIdx];
      const isLive = currentShell === 'LIVE';

      if (isLive) {
        audioManager.playSound('liveshellshoot');
      } else {
        audioManager.playSound('blankshell');
      }

      setAnim(p => ({
        ...p,
        triggerRecoil: p.triggerRecoil + 1,
        muzzleFlashIntensity: isLive ? 100 : 0,
        isLiveShot: isLive
      }));
      setTimeout(() => {
        setAnim(p => ({ ...p, muzzleFlashIntensity: 0 }));
      }, 150);

      const players = gameStateRef.current.multiplayerState?.players || [];
      const myId = gameStateRef.current.localPlayerId || '';
      
      const resolvedTargetOwner = target;
      const targetState = getPlayerState(resolvedTargetOwner);
      const targetSetter = getPlayerSetter(resolvedTargetOwner);
      const targetName = getPlayerNameByOwner(resolvedTargetOwner);
      const shooterName = getPlayerNameByOwner(shooter);

      let damage = 0;
      let isDead = false;

      if (isLive) {
        const isSawed = getPlayerState(shooter).isSawedActive;
        const targetImmune = targetState.jackpotImmunityShots !== undefined && targetState.jackpotImmunityShots > 0;
        
        if (targetImmune) {
          targetSetter(p => {
            const nextImmunity = Math.max(0, (p.jackpotImmunityShots || 0) - 1);
            return {
              ...p,
              jackpotImmunityShots: nextImmunity,
              hasJackpotWinActive: nextImmunity > 0 ? p.hasJackpotWinActive : false
            };
          });
          addLog(`${targetName.toUpperCase()}'S JACKPOT SHIELD BLOCKED SHOT!`, 'safe');
        } else {
          damage = isSawed ? 2 : 1;
          const newHp = Math.max(0, targetState.hp - damage);
          
          const hasTotem = targetState.items.includes('TOTEM');
          if (newHp <= 0 && hasTotem) {
            targetSetter(p => {
              const items = [...p.items];
              const tIdx = items.indexOf('TOTEM');
              if (tIdx !== -1) items.splice(tIdx, 1);
              return { ...p, hp: 1, items };
            });
            setAnim(p => ({ ...p, triggerTotem: p.triggerTotem + 1, totemTarget: resolvedTargetOwner }));
            addLog(`${targetName.toUpperCase()}'S TOTEM OF UNDYING SAVED THEM!`, 'safe');
            setOverlayText(`✨ ${targetName.toUpperCase()} SAVED BY TOTEM ✨`);
            audioManager.playSound('totem');
            await wait(3000);
            setOverlayText(null);
          } else {
            targetSetter(p => ({ ...p, hp: newHp }));
            if (newHp <= 0) {
              isDead = true;
            }
          }
        }

        if (resolvedTargetOwner === 'PLAYER') {
          setAnim(p => ({ ...p, playerHit: true }));
          await wait(1800);
          setAnim(p => ({ ...p, playerHit: false, playerRecovering: true }));
          await wait(1500);
          setAnim(p => ({ ...p, playerRecovering: false }));
        } else if (resolvedTargetOwner === 'DEALER') {
          setAnim(p => ({ ...p, dealerHit: true, dealerDropping: true }));
          await wait(1800);
          setAnim(p => ({ ...p, dealerHit: false, dealerDropping: false, dealerRecovering: true }));
          await wait(1500);
          setAnim(p => ({ ...p, dealerRecovering: false }));
        } else if (resolvedTargetOwner === 'PLAYER3') {
          setAnim(p => ({ ...p, player3Hit: true }));
          await wait(1800);
          setAnim(p => ({ ...p, player3Hit: false, player3Recovering: true }));
          await wait(1500);
          setAnim(p => ({ ...p, player3Recovering: false }));
        } else if (resolvedTargetOwner === 'PLAYER4') {
          setAnim(p => ({ ...p, player4Hit: true }));
          await wait(1800);
          setAnim(p => ({ ...p, player4Hit: false, player4Recovering: true }));
          await wait(1500);
          setAnim(p => ({ ...p, player4Recovering: false }));
        }
      } else {
        addLog("...CLICK. IT'S A BLANK.", 'safe');
        setOverlayText("...CLICK. BLANK.");
        await wait(1500);
        setOverlayText(null);
      }

      // Calculate final target HP after this shot to check if the round ended
      let finalTargetHp = targetState.hp;
      if (isLive) {
        const isSawed = getPlayerState(shooter).isSawedActive;
        const targetImmune = targetState.jackpotImmunityShots !== undefined && targetState.jackpotImmunityShots > 0;
        
        if (!targetImmune) {
          const dmg = isSawed ? 2 : 1;
          const newHp = Math.max(0, targetState.hp - dmg);
          const hasTotem = targetState.items.includes('TOTEM');
          if (newHp <= 0 && hasTotem) {
            finalTargetHp = 1;
          } else {
            finalTargetHp = newHp;
          }
        }
      }

      const postPlayerHp = target === 'PLAYER' ? finalTargetHp : playerRef.current.hp;
      const postDealerHp = target === 'DEALER' ? finalTargetHp : dealerRef.current.hp;
      const postPlayer3Hp = target === 'PLAYER3' ? finalTargetHp : player3Ref.current.hp;
      const postPlayer4Hp = target === 'PLAYER4' ? finalTargetHp : player4Ref.current.hp;

      const aliveCount = (postPlayerHp > 0 ? 1 : 0) + (postDealerHp > 0 ? 1 : 0) + (postPlayer3Hp > 0 ? 1 : 0) + (postPlayer4Hp > 0 ? 1 : 0);

      const shooterSetter = getPlayerSetter(shooter);
      shooterSetter(p => ({ ...p, isSawedActive: false, isFlashbanged: false }));

      if (aliveCount <= 1) {
        setIsProcessing(true);
        setGameState(prev => ({ ...prev, phase: 'RESOLVING' }));

        let roundWinner: TurnOwner = 'PLAYER';
        if (postPlayerHp > 0) roundWinner = 'PLAYER';
        else if (postPlayer3Hp > 0) roundWinner = 'PLAYER3';
        else if (postPlayer4Hp > 0) roundWinner = 'PLAYER4';
        else roundWinner = 'DEALER';

        const winnerName = getPlayerNameByOwner(roundWinner);
        setOverlayColor(roundWinner === 'PLAYER' ? 'green' : 'red');
        setOverlayText(`${winnerName.toUpperCase()} WON THE ROUND!`);
        audioManager.playSound('insert');
        await wait(3000);
        setOverlayColor('none');
        setOverlayText(null);

        if (onMPRoundEndRef.current) {
          await onMPRoundEndRef.current(roundWinner);
        }
        setIsProcessing(false);
        return;
      }

      const nextShellIndex = currentChamberIdx + 1;
      const remaining = gameStateRef.current.chamber.length - nextShellIndex;
      const liveCount = gameStateRef.current.chamber.slice(nextShellIndex).filter(s => s === 'LIVE').length;
      const blankCount = gameStateRef.current.chamber.slice(nextShellIndex).filter(s => s === 'BLANK').length;

      if (remaining === 0) {
        setGameState(prev => ({ ...prev, currentShellIndex: nextShellIndex, liveCount, blankCount, phase: 'RESOLVING' }));
        const lastShotKeepsTurn = target === shooter && !isLive;
        if (onBatchEndRef.current) {
          onBatchEndRef.current(lastShotKeepsTurn);
        }
        return;
      }

      const keepTurn = target === shooter && !isLive;
      let absoluteTurnOwnerId = '';

      if (gameStateRef.current.multiplayerState?.players) {
        const mPlayers = gameStateRef.current.multiplayerState.players;
        const myIndex = mPlayers.findIndex(p => p.id === myId);
        const size = mPlayers.length;
        let shooterId = myId;
        if (shooter === 'DEALER') shooterId = mPlayers[(myIndex + 2) % size].id;
        else if (shooter === 'PLAYER3') shooterId = mPlayers[(myIndex + 1) % size].id;
        else if (shooter === 'PLAYER4') shooterId = mPlayers[(myIndex + 3) % size].id;

        if (keepTurn) {
          absoluteTurnOwnerId = shooterId;
        } else {
          const shooterIdx = mPlayers.findIndex(p => p.id === shooterId);
          let nextIdx = (shooterIdx + 1) % size;
          
          const getNewHp = (id: string) => {
            const relativeOwner = resolveTargetOwner(id, myId, mPlayers);
            if (relativeOwner === 'PLAYER') return playerRef.current.hp - (resolvedTargetOwner === 'PLAYER' && isLive && !targetState.items.includes('TOTEM') && (targetState.jackpotImmunityShots || 0) <= 0 ? damage : 0);
            if (relativeOwner === 'PLAYER3') return player3Ref.current.hp - (resolvedTargetOwner === 'PLAYER3' && isLive && !targetState.items.includes('TOTEM') && (targetState.jackpotImmunityShots || 0) <= 0 ? damage : 0);
            if (relativeOwner === 'PLAYER4') return player4Ref.current.hp - (resolvedTargetOwner === 'PLAYER4' && isLive && !targetState.items.includes('TOTEM') && (targetState.jackpotImmunityShots || 0) <= 0 ? damage : 0);
            return dealerRef.current.hp - (resolvedTargetOwner === 'DEALER' && isLive && !targetState.items.includes('TOTEM') && (targetState.jackpotImmunityShots || 0) <= 0 ? damage : 0);
          };

          while (getNewHp(mPlayers[nextIdx].id) <= 0) {
            nextIdx = (nextIdx + 1) % size;
          }

          const nextPlayer = mPlayers[nextIdx];
          const nextRelOwner = resolveTargetOwner(nextPlayer.id, myId, mPlayers);
          const nextState = getPlayerState(nextRelOwner);
          
          if (nextState.isHandcuffed) {
            const nextSetter = getPlayerSetter(nextRelOwner);
            nextSetter(p => ({ ...p, isHandcuffed: false }));
            addLog(`${nextPlayer.name.toUpperCase()} WAS CUFFED. SKIPPING.`, 'info');
            setOverlayText(`${nextPlayer.name.toUpperCase()} CUFFED`);
            audioManager.playSound('checkhandcuffs');
            await wait(2500);
            setOverlayText(null);

            let nextNextIdx = (nextIdx + 1) % size;
            while (getNewHp(mPlayers[nextNextIdx].id) <= 0) {
              nextNextIdx = (nextNextIdx + 1) % size;
            }
            absoluteTurnOwnerId = mPlayers[nextNextIdx].id;
          } else {
            absoluteTurnOwnerId = nextPlayer.id;
          }
        }
      }

      const mPlayers = gameStateRef.current.multiplayerState?.players || [];
      const nextRelTurnOwner = resolveTargetOwner(absoluteTurnOwnerId, myId, mPlayers);
      const nextPhase = nextRelTurnOwner === 'PLAYER' ? 'PLAYER_TURN' : (nextRelTurnOwner === 'PLAYER3' ? 'PLAYER3_TURN' : (nextRelTurnOwner === 'PLAYER4' ? 'PLAYER4_TURN' : 'DEALER_TURN'));

      setGameState(prev => ({
        ...prev,
        currentShellIndex: nextShellIndex,
        liveCount,
        blankCount,
        turnOwner: nextRelTurnOwner,
        phase: nextPhase
      }));

      setCameraView(nextRelTurnOwner === 'PLAYER' ? 'PLAYER' : (nextRelTurnOwner === 'PLAYER3' ? 'PLAYER' : (nextRelTurnOwner === 'PLAYER4' ? 'PLAYER' : 'DEALER')));
      setAimTarget('IDLE');
      setIsProcessing(false);
      return;
    }

    setAimTarget(intendedAim);
    await wait(500);

    matchStatsRef.current.shotsFired++;
    if (target === shooter) matchStatsRef.current.selfShots++;

    await performShot(shooter, target, {
      gameState: gameStateRef.current, setGameState, player: playerRef.current, setPlayer, dealer: dealerRef.current, setDealer,
      setAnim, setKnownShell, setAimTarget, setCameraView, setOverlayText,
      setOverlayColor, setShowFlash, setShowBlood, addLog, playerName,
      startRound, setIsProcessing,
      onBatchEnd: onBatchEndRef.current || undefined,
      matchStats: matchStatsRef,
      handleHardModeRoundEnd,
      handleMPRoundEnd,
      handleNormalModeRoundEnd,
      opponentName: getOpponentName()
    });
  };

  const processItemEffect = async (
    user: TurnOwner,
    item: ItemType,
    deckCardsOverride?: string[],
    jackpotOutcomeOverride?: 'JACKPOT' | 'NORMAL' | 'LOSE',
    crushIndexOverride?: number,
    contractLootOverride?: ItemType[],
    phoneFutureIndexOverride?: number,
    targetPlayerId?: string,
    isLocalAction: boolean = true
  ): Promise<boolean> => {
    const isThreePlayer = gameStateRef.current.isThreePlayer;
    const shouldDimMusic = isLocalAction;
    if (isThreePlayer) {
        const players = gameStateRef.current.multiplayerState?.players || [];
        const myId = gameStateRef.current.localPlayerId || '';
        const userName = getPlayerNameByOwner(user);

        setOverlayText(`${userName.toUpperCase()} USED ${item}`);
        addLog(`${userName.toUpperCase()} USED ${item}`, 'info');
        await wait(1500);
        setOverlayText(null);

        if (user === 'PLAYER') {
          matchStatsRef.current.itemsUsed[item] = (matchStatsRef.current.itemsUsed[item] || 0) + 1;
        }
        
        const userSetter = getPlayerSetter(user);
        userSetter(p => ({
            ...p,
            currentTurnItemsUsed: [...(p.currentTurnItemsUsed || []), item]
        }));

        let resolvedTargetOwner: TurnOwner = 'DEALER';
        if (targetPlayerId) {
            resolvedTargetOwner = resolveTargetOwner(targetPlayerId, myId, players);
        }

        const targetState = getPlayerState(resolvedTargetOwner);
        const targetSetter = getPlayerSetter(resolvedTargetOwner);
        const targetName = getPlayerNameByOwner(resolvedTargetOwner);

        switch (item) {
            case 'CIGS':
                userSetter(p => ({ ...p, hp: Math.min(p.maxHp, p.hp + 1) }));
                setAnim(p => ({ ...p, triggerHeal: p.triggerHeal + 1 }));
                addLog(`${userName.toUpperCase()} HEALED 1 HP`, 'safe');
                setOverlayText(`☀️ HEALED 1 HP!`);
                await wait(1500);
                setOverlayText(null);
                break;

            case 'BEER':
                const idx = gameStateRef.current.currentShellIndex;
                const chamber = gameStateRef.current.chamber;
                if (idx < chamber.length) {
                    const ejected = chamber[idx];
                    addLog(`BEER EJECTED A ${ejected} SHELL`, 'info');
                    setOverlayText(`🍺 BEER EJECTED: ${ejected}!`);
                    
                    setAnim(p => ({ ...p, triggerDrink: p.triggerDrink + 1, triggerRack: p.triggerRack + 1 }));
                    await wait(2000);
                    setOverlayText(null);

                    setGameState(prev => {
                        const nextIdx = prev.currentShellIndex + 1;
                        const remaining = prev.chamber.length - nextIdx;
                        const liveCount = prev.chamber.slice(nextIdx).filter(s => s === 'LIVE').length;
                        const blankCount = prev.chamber.slice(nextIdx).filter(s => s === 'BLANK').length;
                        return {
                            ...prev,
                            currentShellIndex: nextIdx,
                            liveCount,
                            blankCount,
                            phase: remaining === 0 ? 'RESOLVING' : prev.phase
                        };
                    });

                    if (idx + 1 === chamber.length) {
                        if (onBatchEndRef.current) {
                            onBatchEndRef.current(false);
                        }
                    }
                }
                break;

            case 'SAW':
                userSetter(p => ({ ...p, isSawedActive: true }));
                setAnim(p => ({ ...p, triggerSparks: p.triggerSparks + 1, isSawing: true }));
                addLog(`${userName.toUpperCase()} SAWED SHOTGUN (DOUBLE DAMAGE ACTIVE)`, 'danger');
                setOverlayText(`🪓 SAWED SHOTGUN!`);
                await wait(2000);
                setAnim(p => ({ ...p, isSawing: false }));
                setOverlayText(null);
                break;

            case 'CUFFS':
                targetSetter(p => ({ ...p, isHandcuffed: true }));
                setAnim(p => ({ ...p, triggerCuff: p.triggerCuff + 1 }));
                addLog(`${userName.toUpperCase()} CUFFED ${targetName.toUpperCase()}`, 'info');
                setOverlayText(`⛓️ ${targetName.toUpperCase()} CUFFED!`);
                await wait(2000);
                setOverlayText(null);
                break;

            case 'GLASS':
                const curIdx = gameStateRef.current.currentShellIndex;
                const shell = gameStateRef.current.chamber[curIdx];
                if (shell) {
                    if (user === 'PLAYER') {
                        setKnownShell(shell);
                        addLog(`GLASS REVEALED NEXT SHELL IS ${shell}`, 'safe');
                        setOverlayText(`🔍 NEXT SHELL IS ${shell}`);
                    } else {
                        addLog(`${userName.toUpperCase()} PEEKED WITH GLASS`, 'info');
                    }
                    setAnim(p => ({ ...p, triggerGlass: p.triggerGlass + 1 }));
                    await wait(2000);
                    setOverlayText(null);
                }
                break;

            case 'PHONE':
                const limit = gameStateRef.current.chamber.length;
                const currentShell = gameStateRef.current.currentShellIndex;
                const available = [];
                for (let i = currentShell + 2; i < limit; i++) {
                    available.push(i);
                }
                const futIdx = phoneFutureIndexOverride !== undefined ? phoneFutureIndexOverride : (available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null);
                if (futIdx !== null) {
                    const futShell = gameStateRef.current.chamber[futIdx];
                    const offset = futIdx - currentShell;
                    if (user === 'PLAYER') {
                        addLog(`PHONE REVEALED SHELL ${offset + 1} IS ${futShell}`, 'safe');
                        setOverlayText(`📞 SHELL ${offset + 1} IS ${futShell}`);
                    } else {
                        addLog(`${userName.toUpperCase()} USED BURNER PHONE`, 'info');
                    }
                    setAnim(p => ({ ...p, triggerPhone: p.triggerPhone + 1 }));
                    await wait(2000);
                    setOverlayText(null);
                } else {
                    setOverlayText(`📞 PHONE: NO FUTURE SHELLS`);
                    await wait(1500);
                    setOverlayText(null);
                }
                break;

            case 'INVERTER':
                const invIdx = gameStateRef.current.currentShellIndex;
                const invShell = gameStateRef.current.chamber[invIdx];
                if (invShell) {
                    setGameState(prev => {
                        const chamber = [...prev.chamber];
                        chamber[invIdx] = invShell === 'LIVE' ? 'BLANK' : 'LIVE';
                        const liveCount = chamber.slice(invIdx).filter(s => s === 'LIVE').length;
                        const blankCount = chamber.slice(invIdx).filter(s => s === 'BLANK').length;
                        return { ...prev, chamber, liveCount, blankCount };
                    });
                    setKnownShell(null);
                    setAnim(p => ({ ...p, triggerInverter: p.triggerInverter + 1 }));
                    addLog(`${userName.toUpperCase()} INVERTED NEXT SHELL`, 'info');
                    setOverlayText(`🔄 POLARITY INVERTED!`);
                    await wait(2000);
                    setOverlayText(null);
                }
                break;

            case 'BIG_INVERTER':
                setGameState(prev => {
                    const start = prev.currentShellIndex;
                    const chamber = prev.chamber.map((s, i) => i >= start ? (s === 'LIVE' ? 'BLANK' : 'LIVE') : s);
                    const liveCount = chamber.slice(start).filter(s => s === 'LIVE').length;
                    const blankCount = chamber.slice(start).filter(s => s === 'BLANK').length;
                    return { ...prev, chamber, liveCount, blankCount };
                });
                setKnownShell(null);
                setAnim(p => ({ ...p, triggerBigInverter: p.triggerBigInverter + 1 }));
                addLog(`${userName.toUpperCase()} INVERTED ALL REMAINING AMMO`, 'info');
                setOverlayText(`🔄 ALL SHELLS INVERTED!`);
                await wait(2000);
                setOverlayText(null);
                break;

            case 'ADRENALINE':
                break;

            case 'CRUSHER':
                if (targetState.items.length > 0) {
                    const cIdx = crushIndexOverride !== undefined ? crushIndexOverride : Math.floor(Math.random() * targetState.items.length);
                    const destroyedItem = targetState.items[cIdx];
                    targetSetter(p => {
                        const items = [...p.items];
                        items.splice(cIdx, 1);
                        return { ...p, items };
                    });
                    setAnim(p => ({ ...p, triggerCrusher: p.triggerCrusher + 1 }));
                    addLog(`${userName.toUpperCase()} DESTROYED ${targetName.toUpperCase()}'S ${destroyedItem}`, 'danger');
                    setOverlayText(`🔨 CRUSHED ${targetName.toUpperCase()}'S ${destroyedItem}!`);
                    await wait(2000);
                    setOverlayText(null);
                }
                break;

            case 'FLASHBANG':
                targetSetter(p => ({ ...p, isFlashbanged: true }));
                setAnim(p => ({ ...p, triggerFlashbang: p.triggerFlashbang + 1 }));
                if (resolvedTargetOwner === 'PLAYER') {
                    setShowFlashbang(true);
                }
                addLog(`${userName.toUpperCase()} FLASHBANGED ${targetName.toUpperCase()}`, 'info');
                setOverlayText(`⚡ ${targetName.toUpperCase()} BLINDED!`);
                await wait(2000);
                setOverlayText(null);
                if (resolvedTargetOwner === 'PLAYER') {
                    setShowFlashbang(false);
                }
                break;

            case 'JACKPOT':
                const spinOutcome = jackpotOutcomeOverride ?? resolveJackpotOutcome();
                audioManager.playSound('slotmachine', { dimMusic: shouldDimMusic });
                setAnim(p => ({ ...p, triggerJackpot: p.triggerJackpot + 1, jackpotResult: spinOutcome }));
                addLog(`${userName.toUpperCase()} SPUN THE JACKPOT MACHINE`, 'info');
                await wait(4200);

                if (spinOutcome === 'JACKPOT') {
                    addLog("JACKPOT WIN! IMMUNE TO NEXT 3 SHOTS", 'safe');
                    setOverlayText(`✨ JACKPOT WIN! ✨\n3 SHOT IMMUNITY FOR ${userName.toUpperCase()}`);
                    userSetter(p => ({ ...p, jackpotImmunityShots: 3, hasJackpotWinActive: true }));
                    audioManager.playJackpotIntro({ dimMusic: shouldDimMusic });
                } else if (spinOutcome === 'NORMAL') {
                    addLog("NORMAL WIN! IMMUNE TO NEXT 1 SHOT", 'safe');
                    setOverlayText(`👍 NORMAL WIN! 👍\n1 SHOT IMMUNITY FOR ${userName.toUpperCase()}`);
                    userSetter(p => ({ ...p, jackpotImmunityShots: (p.jackpotImmunityShots || 0) + 1, hasJackpotWinActive: false }));
                } else {
                    addLog("NO WIN. TRY AGAIN", 'neutral');
                    setOverlayText("❌ LOSE ❌\nBETTER LUCK NEXT TIME");
                }
                await wait(1500);
                setOverlayText(null);
                break;

            case 'CONTRACT':
                userSetter(p => {
                    const curHp = p.hp;
                    const hasTotem = p.items.includes('TOTEM');
                    let nextHp = curHp - 1;
                    let items = [...p.items];

                    if (nextHp <= 0) {
                        if (hasTotem) {
                            nextHp = 1;
                            const tIdx = items.indexOf('TOTEM');
                            if (tIdx !== -1) items.splice(tIdx, 1);
                        } else {
                            nextHp = 0;
                        }
                    }

                    return { ...p, hp: nextHp, items };
                });

                setAnim(p => ({ ...p, triggerContract: p.triggerContract + 1 }));
                addLog(`${userName.toUpperCase()} SIGNED BLOOD CONTRACT`, 'danger');
                await wait(2500);

                const postState = getPlayerState(user);
                if (postState.hp > 0) {
                    const loot = contractLootOverride || [
                        getRandomItem(gameStateRef.current.isHardMode, user === 'DEALER'),
                        getRandomItem(gameStateRef.current.isHardMode, user === 'DEALER')
                    ];
                    userSetter(p => {
                        const items = [...p.items];
                        loot.forEach(l => {
                            if (items.length < MAX_ITEMS) items.push(l);
                        });
                        return { ...p, items };
                    });
                    addLog(`${userName.toUpperCase()} GAINED: ${loot.join(', ')}`, 'safe');
                    setOverlayText(`🩸 BLOOD CONTRACT SIGNED!\nGAINED: ${loot.join(', ')}`);
                } else {
                    addLog(`${userName.toUpperCase()} SACRIFICED THEIR LETHAL SHOT FOR THE CONTRACT`, 'danger');
                    setOverlayText(`💀 SACRIFICED LETHAL SHOT!`);
                }
                await wait(2200);
                setOverlayText(null);
                break;
        }

        return false;
    }

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
        audioManager.playSound('blankshell', { dimMusic: shouldDimMusic });
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
          setOverlayText,
          phoneFutureIndexOverride
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
          handleHardModeRoundEnd, handleMPRoundEnd, handleNormalModeRoundEnd,
          contractLootOverride
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
          addLog, setOverlayText,
          crushIndexOverride
        );
        break;

      case 'JACKPOT': {
        // Roll the jackpot outcome
        let outcome: 'JACKPOT' | 'NORMAL' | 'LOSE';
        
        if ((window as any).__debugJackpotForcedOutcome) {
          outcome = (window as any).__debugJackpotForcedOutcome;
        } else if (jackpotOutcomeOverride) {
          outcome = jackpotOutcomeOverride;
        } else {
          outcome = resolveJackpotOutcome();
        }

        // Trigger animation
        audioManager.playSound('slotmachine', { dimMusic: shouldDimMusic });
        setAnim(p => ({
          ...p,
          triggerJackpot: p.triggerJackpot + 1,
          jackpotResult: outcome
        }));

        addLog(`${userName} SPUN THE JACKPOT MACHINE`, 'info');

        // Let the spin happen
        await wait(4200);

        const setOwner = user === 'PLAYER' ? setPlayer : setDealer;

        if (outcome === 'JACKPOT') {
          addLog("JACKPOT WIN! IMMUNE TO NEXT 3 SHOTS", 'safe');
          setOverlayText(`✨ JACKPOT WIN! ✨\n3 SHOT IMMUNITY FOR ${userName.toUpperCase()}`);
          setOwner(p => ({ ...p, jackpotImmunityShots: 3, hasJackpotWinActive: true }));
          audioManager.playJackpotIntro({ dimMusic: shouldDimMusic });
        } else if (outcome === 'NORMAL') {
          addLog("NORMAL WIN! IMMUNE TO NEXT 1 SHOT", 'safe');
          setOverlayText(`👍 NORMAL WIN! 👍\n1 SHOT IMMUNITY FOR ${userName.toUpperCase()}`);
          setOwner(p => ({ ...p, jackpotImmunityShots: (p.jackpotImmunityShots || 0) + 1, hasJackpotWinActive: false }));
        } else {
          addLog("NO WIN. TRY AGAIN", 'neutral');
          setOverlayText("❌ LOSE ❌\nBETTER LUCK NEXT TIME");
        }

        await wait(1500);
        setOverlayText(null);
        break;
      }

      case 'MIRROR': {
        audioManager.playSound('mirror', { dimMusic: shouldDimMusic });
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
              // Wait 2.8 seconds between each item's animation so the current one completes first
              await wait(2800);
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
        
        let selectedNames: TarotCard['name'][];
        if (deckCardsOverride) {
          selectedNames = deckCardsOverride as TarotCard['name'][];
        } else {
          const shuffled = [...allTarotNames].sort(() => Math.random() - 0.5);
          selectedNames = shuffled.slice(0, 6);
        }
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

  const usePlayerItem = async (
    index: number,
    deckCardsOverride?: string[],
    jackpotOutcomeOverride?: 'JACKPOT' | 'NORMAL' | 'LOSE',
    crushIndexOverride?: number,
    contractLootOverride?: ItemType[],
    phoneFutureIndexOverride?: number,
    targetPlayerId?: string
  ) => {
    if (gameStateRef.current.phase !== 'PLAYER_TURN') return;
    if (gameStateRef.current.turnOwner !== 'PLAYER') return; // Strict turn check
    if (isProcessing) return;

    if (cameraView === 'GUN' || aimTarget !== 'IDLE') {
      addLog("CAN'T USE ITEMS WHILE HOLDING GUN", 'info');
      return;
    }

    const item = playerRef.current.items[index];
    if (!item) return;

    if (item === 'ADRENALINE') {
      if (gameStateRef.current.isThreePlayer) {
        const targetOwner = targetPlayerId ? resolveTargetOwner(targetPlayerId, gameStateRef.current.localPlayerId || '', gameStateRef.current.multiplayerState?.players || []) : 'DEALER';
        const targetState = getPlayerState(targetOwner);
        const stealableItems = targetState.items.filter(i => i !== 'ADRENALINE' && i !== 'JACKPOT' && i !== null);
        if (stealableItems.length === 0) {
          addLog(`NOTHING TO STEAL FROM ${getPlayerNameByOwner(targetOwner).toUpperCase()}`, 'info');
          return;
        }
        setGameState(prev => ({ ...prev, adrenalineTargetOwner: targetOwner }));
      } else {
        const stealableItems = dealerRef.current.items.filter(i => i !== 'ADRENALINE' && i !== 'JACKPOT' && i !== null);
        if (stealableItems.length === 0) {
          addLog("NOTHING TO STEAL", 'info');
          return;
        }
      }
    }

    setIsProcessing(true);

    const itemsMap = matchStatsRef.current.itemsUsed || {};
    itemsMap[item] = (itemsMap[item] || 0) + 1;
    matchStatsRef.current.itemsUsed = itemsMap;

    const newItems = [...playerRef.current.items];
    newItems.splice(index, 1);
    setPlayer(p => ({ ...p, items: newItems }));

    await processItemEffect('PLAYER', item, deckCardsOverride, jackpotOutcomeOverride, crushIndexOverride, contractLootOverride, phoneFutureIndexOverride, targetPlayerId);

    setIsProcessing(false);
  };

  // Helper to directly set game phase (useful for multiplayer)
  const setGamePhase = (phase: GameState['phase']) => {
    setGameState(prev => ({ ...prev, phase }));
  };

  const stealItem = async (index: number, stealer: TurnOwner = 'PLAYER') => {
    if (isProcessing) return;

    const isThreePlayer = gameStateRef.current.isThreePlayer;
    let target = stealer === 'PLAYER' ? dealerRef.current : playerRef.current;
    let user = stealer === 'PLAYER' ? playerRef.current : dealerRef.current;
    let setUser = stealer === 'PLAYER' ? setPlayer : setDealer;
    let setTarget = stealer === 'PLAYER' ? setDealer : setPlayer;

    if (isThreePlayer) {
      if (stealer === 'PLAYER') {
        const targetOwner = gameStateRef.current.adrenalineTargetOwner || 'DEALER';
        target = getPlayerState(targetOwner);
        setTarget = getPlayerSetter(targetOwner);
      } else {
        target = playerRef.current;
        setTarget = setPlayer;
        user = getPlayerState(stealer);
        setUser = getPlayerSetter(stealer);
      }
    }

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

  const selectTarotCard = async (index: number, cardRandomsOverride?: any) => {
    if (gameStateRef.current.selectedCardIndex !== null && gameStateRef.current.selectedCardIndex !== undefined) return;
    
    setIsProcessing(true);
    
    setGameState(prev => ({
      ...prev,
      selectedCardIndex: index
    }));

    audioManager.playSound('cards', { dimMusic: true });

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
    const wasCuffedBeforeHermit = getPlayerState(turnOwner).isHandcuffed;
    
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
        const item = (cardRandomsOverride && cardRandomsOverride.magicianItem)
          ? cardRandomsOverride.magicianItem
          : getRandomItem(gameStateRef.current.isHardMode, turnOwner === 'DEALER');
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
        const nextOpponent: TurnOwner = turnOwner === 'PLAYER' ? 'DEALER' : 'PLAYER';
        let resolvedNextOwner: TurnOwner = nextOpponent;
        if (gameStateRef.current.isMultiplayer && (gameStateRef.current.isThreePlayer || gameStateRef.current.isFourPlayer)) {
          const mPlayers = gameStateRef.current.multiplayerState?.players || [];
          const size = mPlayers.length;
          const myId = gameStateRef.current.localPlayerId || '';
          const myIndex = mPlayers.findIndex(p => p.id === myId);

          let currentId = myId;
          if (turnOwner === 'DEALER') currentId = mPlayers[(myIndex + 2) % size]?.id;
          else if (turnOwner === 'PLAYER3') currentId = mPlayers[(myIndex + 1) % size]?.id;
          else if (turnOwner === 'PLAYER4') currentId = mPlayers[(myIndex + 3) % size]?.id;

          const currentIdx = mPlayers.findIndex(p => p.id === currentId);
          if (currentIdx !== -1) {
            let nextIdx = (currentIdx + 1) % size;
            const getHp = (playerObj: any) => {
              const relOwner = resolveTargetOwner(playerObj.id, myId, mPlayers);
              return getPlayerState(relOwner).hp;
            };
            while (getHp(mPlayers[nextIdx]) <= 0) {
              nextIdx = (nextIdx + 1) % size;
            }
            resolvedNextOwner = resolveTargetOwner(mPlayers[nextIdx].id, myId, mPlayers);
          }
        }

        const drawerState = getPlayerState(turnOwner);
        const receiverState = getPlayerState(resolvedNextOwner);

        if (drawerState.isHandcuffed) {
          const setOwner = getPlayerSetter(turnOwner);
          setOwner(p => ({ ...p, isHandcuffed: false }));
          addLog(`${userName} broke cuffs with The Hermit.`, 'safe');
          setOverlayText(`⛓️ THE HERMIT: CUFFS BROKEN! TURN RETAINED.`);
        } else if (receiverState.isHandcuffed) {
          const setReceiver = getPlayerSetter(resolvedNextOwner);
          setReceiver(p => ({ ...p, isHandcuffed: false }));
          const receiverName = getPlayerNameByOwner(resolvedNextOwner);
          addLog(`${receiverName} broke cuffs with The Hermit.`, 'safe');
          setOverlayText(`⛓️ THE HERMIT: ${receiverName.toUpperCase()}'S CUFFS BROKEN! TURN TRANSFERRED.`);
        } else {
          addLog(`${userName} ends turn instantly with The Hermit.`, 'danger');
          const opponentNameText = getPlayerNameByOwner(resolvedNextOwner);
          setOverlayText(`⛓️ THE HERMIT: TURN TRANSFERRED TO ${opponentNameText.toUpperCase()}!`);
        }
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
          const randIdx = (cardRandomsOverride && cardRandomsOverride.moonIndex !== undefined)
            ? cardRandomsOverride.moonIndex
            : stealableIndices[Math.floor(Math.random() * stealableIndices.length)];
          const stolenItem = opponent.items[randIdx];
          
          setOpponent(p => {
            const items = [...p.items];
            // Remove exactly at the index to prevent duplicate issues
            items.splice(randIdx, 1);
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
            const success = (cardRandomsOverride && cardRandomsOverride.hasOwnProperty('judgmentSuccess'))
              ? cardRandomsOverride.judgmentSuccess
              : (Math.random() < 0.5);
            if (success) {
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
          if (cardRandomsOverride && cardRandomsOverride.wheelChamber) {
            setGameState(prev => {
              const liveCount = cardRandomsOverride.wheelChamber.slice(idx).filter((s: string) => s === 'LIVE').length;
              const blankCount = cardRandomsOverride.wheelChamber.slice(idx).filter((s: string) => s === 'BLANK').length;
              return {
                ...prev,
                chamber: cardRandomsOverride.wheelChamber,
                liveCount,
                blankCount
              };
            });
          } else {
            const shuffledRemaining = remaining.sort(() => Math.random() - 0.5);
            for (let i = 0; i < shuffledRemaining.length; i++) {
              chamber[idx + i] = shuffledRemaining[i];
            }
            const liveCount = chamber.slice(idx).filter(s => s === 'LIVE').length;
            const blankCount = chamber.slice(idx).filter(s => s === 'BLANK').length;
            setGameState(prev => ({ ...prev, chamber, liveCount, blankCount }));
          }
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
          const randIdx = (cardRandomsOverride && cardRandomsOverride.deathIndex !== undefined)
            ? cardRandomsOverride.deathIndex
            : Math.floor(Math.random() * ownerState.items.length);
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
          const randIdx = (cardRandomsOverride && cardRandomsOverride.towerIndex !== undefined)
            ? cardRandomsOverride.towerIndex
            : Math.floor(Math.random() * destroyableItems.length);
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

        if (turnOwner === 'PLAYER') {
          setOverlayText(displayText);
        } else {
          setOverlayText(`🃏 THE FOOL: ${userName.toUpperCase()} IS SEEING THE FUTURE...`);
        }
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
        const nextOpponent: TurnOwner = turnOwner === 'PLAYER' ? 'DEALER' : 'PLAYER';
        let resolvedNextOwner: TurnOwner = nextOpponent;
        if (gameStateRef.current.isMultiplayer && (gameStateRef.current.isThreePlayer || gameStateRef.current.isFourPlayer)) {
          const mPlayers = gameStateRef.current.multiplayerState?.players || [];
          const size = mPlayers.length;
          const myId = gameStateRef.current.localPlayerId || '';
          const myIndex = mPlayers.findIndex(p => p.id === myId);

          let currentId = myId;
          if (turnOwner === 'DEALER') currentId = mPlayers[(myIndex + 2) % size]?.id;
          else if (turnOwner === 'PLAYER3') currentId = mPlayers[(myIndex + 1) % size]?.id;
          else if (turnOwner === 'PLAYER4') currentId = mPlayers[(myIndex + 3) % size]?.id;

          const currentIdx = mPlayers.findIndex(p => p.id === currentId);
          if (currentIdx !== -1) {
            let nextIdx = (currentIdx + 1) % size;
            const getHp = (playerObj: any) => {
              const relOwner = resolveTargetOwner(playerObj.id, myId, mPlayers);
              return getPlayerState(relOwner).hp;
            };
            while (getHp(mPlayers[nextIdx]) <= 0) {
              nextIdx = (nextIdx + 1) % size;
            }
            resolvedNextOwner = resolveTargetOwner(mPlayers[nextIdx].id, myId, mPlayers);
          }
        }

        const receiverWasCuffed = getPlayerState(resolvedNextOwner).isHandcuffed;

        if (wasCuffedBeforeHermit) {
          nextOwner = turnOwner;
        } else {
          nextOwner = resolvedNextOwner;
        }
      }
      const nextPhase = nextOwner === 'PLAYER' ? 'PLAYER_TURN' : (nextOwner === 'PLAYER3' ? 'PLAYER3_TURN' : (nextOwner === 'PLAYER4' ? 'PLAYER4_TURN' : 'DEALER_TURN'));
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
    player3,
    setPlayer3,
    player4,
    setPlayer4,
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
      const isMP = gameStateRef.current.isMultiplayer;
      if (!isMP) {
        if (gameStateRef.current.phase !== 'PLAYER_TURN' && gameStateRef.current.phase !== 'DEALER_TURN' && gameStateRef.current.phase !== 'PLAYER3_TURN' && gameStateRef.current.phase !== 'PLAYER4_TURN' && gameStateRef.current.phase !== 'RESOLVING') return;
      }

      // Strict turn check
      if (picker === 'PLAYER' && gameStateRef.current.turnOwner !== 'PLAYER') return;
      if (picker === 'DEALER' && gameStateRef.current.turnOwner !== 'DEALER' && !isMP) return;
      if (picker === 'PLAYER3' && gameStateRef.current.turnOwner !== 'PLAYER3' && !isMP) return;
      if (picker === 'PLAYER4' && gameStateRef.current.turnOwner !== 'PLAYER4' && !isMP) return;

      if (picker === 'PLAYER') {
        setCameraView('GUN');
        setAimTarget('CHOOSING');
      } else if (picker === 'PLAYER3') {
        setCameraView('PLAYER3_GUN');
        setAimTarget('IDLE');
      } else if (picker === 'PLAYER4') {
        setCameraView('PLAYER4_GUN');
        setAimTarget('IDLE');
      } else {
        setCameraView('DEALER_GUN');
        setAimTarget('IDLE');
      }
    },
    syncState: (data: { player: PlayerState, dealer: PlayerState, player3?: PlayerState, player4?: PlayerState, gameState: Partial<GameState> }) => {
      if (data.player) setPlayer(p => ({ ...p, ...data.player }));
      if (data.dealer) setDealer(d => ({ ...d, ...data.dealer }));
      if (data.player3) setPlayer3(p3 => ({ ...p3, ...data.player3 }));
      if (data.player4) setPlayer4(p4 => ({ ...p4, ...data.player4 }));
      if (data.gameState) setGameState(s => {
        const nextState = { ...s, ...data.gameState };
        if (s.phase === 'STEALING' && s.turnOwner === 'PLAYER') {
          nextState.phase = 'STEALING';
        }
        return nextState;
      });
    },
    setGamePhase,
    setOverlayText,
    matchStats: matchStatsRef.current,
    setOnBatchEnd: (cb: (keepTurn: boolean) => void) => { onBatchEndRef.current = cb; },
    setOnMPRoundEnd: (cb: (winner: TurnOwner, pWin?: number, oWin?: number) => void | Promise<void>) => { onMPRoundEndRef.current = cb; },
    startRound,
    handleHardModeRoundEnd,
    handleMPRoundEnd,
    handleNormalModeRoundEnd,
    dealerModel,
    setDealerModel
  };
};