import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RotateCw } from 'lucide-react';
import { ThreeScene } from './components/ThreeScene';
import { GameUI } from './components/GameUI';
import { useGameLogic } from './hooks/useGameLogic';
import { useDealerAI } from './hooks/useDealerAI';
import { SettingsMenu } from './components/SettingsMenu';
import { GameSettings } from './types';
import { DEFAULT_SETTINGS } from './constants';
import { DiscordSDK } from '@discord/embedded-app-sdk';

import { LoadingScreen } from './components/LoadingScreen';
import { DebugOverlay } from './components/ui/DebugOverlay';
import { TutorialGuide } from './components/TutorialGuide';
import { Scoreboard } from './components/ui/Scoreboard';
import { audioManager } from './utils/audioManager';
import { useMultiplayer } from './hooks/useMultiplayer';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { ChatBox } from './components/ChatBox';
import { MultiplayerSelection } from './components/MultiplayerSelection';
import { generateLootBatch, resolveJackpotOutcome } from './utils/game/inventory';
import { randomInt } from './utils/gameUtils';
import { ShellType, ItemType, TurnOwner, AimTarget } from './types';

const urlParams = new URLSearchParams(window.location.search);

declare global {
  interface Window {
    updateDiscordActivity?: (details: string, state?: string) => void;
  }
}
const isDiscordPlatform = urlParams.has('frame_id') || urlParams.has('instance_id') || window.location.search.includes('platform=') || window.location.hostname.includes('discordsays.com');
const SERVER_URL = isDiscordPlatform
    ? window.location.origin + '/server'
    : (import.meta.env.VITE_SERVER_URL || 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? 'http://localhost:3001'
          : window.location.origin + '/server'));

type AppState = 'MENU' | 'LOADING_SP' | 'LOADING_GAME' | 'GAME' | 'LOADING_MP' | 'MP_SELECTION' | 'LOBBY';

export default function App() {
  const spGame = useGameLogic();
  const mp = useMultiplayer();
  const [appState, setAppState] = useState<AppState>('MENU');
  const [initialRoomId, setInitialRoomId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room');
  });
  const [mobileActiveTab, setMobileActiveTab] = useState<'LOBBY' | 'CHAT'>('LOBBY');
  const lastTotalWins = useRef(0);
  const lastHoverRef = useRef<{ target: AimTarget; targetId?: string; time: number }>({ target: 'OPPONENT', time: 0 });
  const lastSyncBroadcastRef = useRef(0);

  // Ping the server to wake it up in case it's asleep on Hugging Face
  useEffect(() => {
    fetch(`${SERVER_URL}/health`).then((res) => {
      console.log("[Wakeup] Server response:", res.status);
    }).catch((err) => {
      console.log("[Wakeup] Server wake-up ping attempted:", err.message);
    });
  }, []);

  // Enable VirtualKeyboard overlaysContent if available
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'virtualKeyboard' in navigator) {
      // @ts-ignore
      navigator.virtualKeyboard.overlaysContent = true;
    }
  }, []);

  // Try to initialize audio ASAP (will only succeed if browser allows)
  useEffect(() => {
    audioManager.initialize().then(() => {
      // If successful, ensure menu music starts immediately without waiting for state update cycle
      audioManager.playMusic('menu');
    }).catch(() => { });
  }, []);

  // Handle direct url invite link joining if name is already cached AND user is logged in
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room');
    if (roomId && /^[0-9]{4}$/.test(roomId)) {
      const loggedInUser = localStorage.getItem('aadish_roulette_logged_in_user');
      const cachedName = localStorage.getItem('aadish_roulette_name');
      if (loggedInUser && cachedName && cachedName.trim().length > 0) {
        spGame.setPlayerName(cachedName.trim());
        setAppState('LOADING_MP');
        mp.connect(cachedName.trim());
      }
    }
  }, []);

  // --- ORIENTATION CHECK ---
  const [showRotateWarning, setShowRotateWarning] = useState(false);
  const [isMobileNameTag, setIsMobileNameTag] = useState(false);

  useEffect(() => {
    const updateMobileTagState = () => {
      if (typeof window === 'undefined') return;
      const isMobile = window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : window.innerWidth < 950;
      setIsMobileNameTag(isMobile || window.innerWidth < 950);
    };

    updateMobileTagState();
    window.addEventListener('resize', updateMobileTagState);
    return () => window.removeEventListener('resize', updateMobileTagState);
  }, []);

  // --- DISCORD SDK HANDSHAKE ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isDiscord = params.has('frame_id') || params.has('instance_id') || window.location.search.includes('platform=') || window.location.hostname.includes('discordsays.com');

    if (isDiscord && params.has('frame_id')) {
      const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID || '1517863650998882406';
      console.log(`[Discord] Initializing SDK with client ID: ${clientId}`);
      try {
        const discordSdk = new DiscordSDK(clientId);
        let isAuthenticated = false;
        const sessionStartTime = Date.now();

      const initDiscord = async () => {
        try {
          await discordSdk.ready();
          console.log("[Discord] SDK is ready!");

          // 1. Authorize with scope permissions
          const { code } = await discordSdk.commands.authorize({
            client_id: clientId,
            response_type: "code",
            state: "",
            prompt: "none",
            scope: ["identify", "rpc.activities.write"],
          });

          // 2. Exchange code on backend server
          const tokenRes = await fetch(`${SERVER_URL}/api/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code })
          });

          if (!tokenRes.ok) {
            throw new Error(`Token exchange failed: ${tokenRes.status} ${tokenRes.statusText}`);
          }

          const { access_token } = await tokenRes.json();

          // 3. Authenticate
          await discordSdk.commands.authenticate({
            access_token,
          });

          isAuthenticated = true;
          console.log("[Discord] SDK authenticated successfully!");

          // Register global updater function
          window.updateDiscordActivity = async (details: string, state?: string) => {
            if (!isAuthenticated) return;
            try {
              await discordSdk.commands.setActivity({
                activity: {
                  type: 0, // Playing
                  details: details.substring(0, 127),
                  state: state ? state.substring(0, 127) : "",
                  assets: {
                    large_image: "banner",
                    large_text: "Aadish Roulette",
                    small_image: "favicon",
                    small_text: "A Deadly Game of Chance"
                  },
                  timestamps: {
                    start: sessionStartTime
                  }
                }
              });
            } catch (err) {
              console.error("[Discord] Failed to update setActivity:", err);
            }
          };

          // Set initial menu status
          window.updateDiscordActivity("In Main Menu", "Preparing to bind soul...");

        } catch (err) {
          console.error("[Discord] SDK authorization/authentication failed:", err);
        }
      };

      initDiscord();
      } catch (err) {
        console.error("[Discord] SDK constructor initialization failed:", err);
      }
    }
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const checkOrientation = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const params = new URLSearchParams(window.location.search);
        const isDiscord = params.has('frame_id') || params.has('instance_id') || window.location.search.includes('platform=') || window.location.hostname.includes('discordsays.com');
        if (isDiscord) {
          setShowRotateWarning(false);
          return;
        }

        let isPortrait = false;
        if (window.matchMedia) {
          isPortrait = window.matchMedia("(orientation: portrait)").matches;
        } else {
          isPortrait = window.innerHeight > window.innerWidth;
        }
        const isMobile = window.innerWidth < 950;
        setShowRotateWarning(isPortrait && isMobile);
      }, 200);
    };

    const initTimeout = setTimeout(checkOrientation, 100);

    window.addEventListener('resize', checkOrientation);
    if (window.matchMedia) {
      window.matchMedia("(orientation: portrait)").addEventListener("change", checkOrientation);
    }

    return () => {
      window.removeEventListener('resize', checkOrientation);
      if (window.matchMedia) {
        window.matchMedia("(orientation: portrait)").removeEventListener("change", checkOrientation);
      }
      clearTimeout(timeoutId);
      clearTimeout(initTimeout);
    };
  }, []);

  // For loot overlay
  const effectiveShowLootOverlay = spGame.showLootOverlay;
  const effectiveReceivedItems = spGame.receivedItems as import('./types').ItemType[];

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [abortedByName, setAbortedByName] = useState<string | null>(null);
  const [nameTags, setNameTags] = useState<{ name: string, x: number, y: number, visible: boolean }[]>([]);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isScoreboardOpen, setIsScoreboardOpen] = useState(false);
  const [showPerformancePopup, setShowPerformancePopup] = useState(false);
  const [detectedLowFps, setDetectedLowFps] = useState(0);

  const [settings, setSettings] = useState<GameSettings>(() => {
    const saved = localStorage.getItem('aadish_roulette_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Always reset debug mode on fresh session
        parsed.debugMode = false;
        return parsed;
      } catch (e) { }
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('aadish_roulette_settings', JSON.stringify(settings));
    audioManager.updateVolumes(settings);

  }, [settings]);

  // Handle Music Logic
  useEffect(() => {
    if (appState === 'MENU') {
      audioManager.playMusic('menu');
    } else if (appState === 'GAME') {
      const phase = spGame.gameState.phase;
      if (phase === 'GAME_OVER') {
        audioManager.playMusic('endscreen');
      } else if (phase === 'INTRO' || phase === 'BOOT') {
        audioManager.playMusic('menu');
      } else {
        audioManager.playMusic('gameplay');
      }
    }
  }, [appState, spGame.gameState.phase]);

  const [isHardModeSelected, setIsHardModeSelected] = useState(false);

  // Global dynamic stickers list preloaded on multiplayer selection entry
  const [stickersList, setStickersList] = useState<string[]>([]);
  useEffect(() => {
    if (appState !== 'LOADING_MP') return;

    const preloadStickers = async () => {
      const found: string[] = [];
      let i = 1;
      let consecutiveFails = 0;
      while (consecutiveFails < 3 && i < 100) {
        const webpName = `sticker${i}.webp`;
        const gifName = `sticker${i}.gif`;
        try {
          // Probe webp with strict Content-Type header checking (prevents Vite redirect fallbacks)
          const resWebp = await fetch(`/sticker/${webpName}`, { method: 'HEAD' });
          const ctWebp = resWebp.headers.get('content-type') || '';
          if (resWebp.ok && ctWebp.startsWith('image/')) {
            found.push(webpName);
            const img = new Image();
            img.src = `/sticker/${webpName}`;
            consecutiveFails = 0;
          } else {
            // Probe gif with strict Content-Type header checking
            const resGif = await fetch(`/sticker/${gifName}`, { method: 'HEAD' });
            const ctGif = resGif.headers.get('content-type') || '';
            if (resGif.ok && ctGif.startsWith('image/')) {
              found.push(gifName);
              const img = new Image();
              img.src = `/sticker/${gifName}`;
              consecutiveFails = 0;
            } else {
              consecutiveFails++;
            }
          }
        } catch (e) {
          consecutiveFails++;
        }
        i++;
      }
      console.log('Preloaded stickers:', found);
      setStickersList(found);
    };
    preloadStickers();
  }, [appState]);

  // Dealer AI only for singleplayer
  useDealerAI({
    gameState: spGame.gameState,
    dealer: spGame.dealer,
    player: spGame.player,
    knownShell: spGame.knownShell,
    animState: spGame.animState,
    fireShot: spGame.fireShot,
    processItemEffect: spGame.processItemEffect,
    setDealer: spGame.setDealer,
    setPlayer: spGame.setPlayer,
    setTargetAim: spGame.setAimTarget,
    setCameraView: spGame.setCameraView,
    setOverlayText: spGame.setOverlayText,
    isMultiplayer: spGame.gameState.isMultiplayer,
    isProcessing: spGame.isProcessing,
    setIsProcessing: spGame.setIsProcessing,
    selectTarotCard: spGame.selectTarotCard
  });

  const handleResetSettings = () => setSettings(DEFAULT_SETTINGS);

  const handleBootComplete = useCallback(() => {
    spGame.setGamePhase('INTRO');
    audioManager.playMusic('menu');
  }, [spGame]);

  const handleStartSP = (name: string, hardMode: boolean = false) => {
    setIsHardModeSelected(hardMode);
    if (name) spGame.setPlayerName(name);

    audioManager.stopMusic();
    setAppState('LOADING_SP');
  };

  const handleStartMP = (name: string) => {
    spGame.setPlayerName(name);
    setAppState('LOADING_MP');
    mp.connect(name);
  };

  // Broadcast local actions to server
  const handleFireShot = async (target: TurnOwner) => {
    if (spGame.gameState.phase !== 'PLAYER_TURN' && spGame.gameState.phase !== 'DEALER_TURN' && spGame.gameState.phase !== 'PLAYER3_TURN' && spGame.gameState.phase !== 'RESOLVING') return;
    if (spGame.gameState.turnOwner !== 'PLAYER') return;
    if (spGame.isProcessing) return;

    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    const isMultiPlayerGame = spGame.gameState.isThreePlayer || spGame.gameState.isFourPlayer;
    const playersList = mp.room?.players || [];
    const myId = mp.playerId || '';
    const opponentId = playersList.find((p: any) => p.id !== myId)?.id;

    if (isMultiPlayerGame) {
      const myIndex = playersList.findIndex((p: any) => p.id === myId);
      const playerCount = playersList.length;

      let targetPlayerId = myId;
      if (target === 'DEALER') targetPlayerId = playersList[(myIndex + 2) % playerCount]?.id || myId;
      else if (target === 'PLAYER3') targetPlayerId = playersList[(myIndex + 1) % playerCount]?.id || myId;
      else if (target === 'PLAYER4') targetPlayerId = playersList[(myIndex + 3) % playerCount]?.id || myId;

      const intendedAim: AimTarget = target === 'PLAYER'
        ? 'SELF'
        : (target === 'PLAYER3' ? 'LEFT' : (target === 'PLAYER4' ? 'RIGHT' : 'OPPONENT'));
      if (isMobile && spGame.aimTarget !== intendedAim) {
        spGame.setAimTarget(intendedAim);
        spGame.setCameraView('GUN');
        if (mp.room) {
          mp.sendImmediateAction(mp.room.id, { type: 'HOVER_TARGET', target: intendedAim, targetId: targetPlayerId });
        }
        return;
      }

      if (mp.room) {
        mp.sendImmediateAction(mp.room.id, { type: 'SHOOT', shooterId: myId, targetId: targetPlayerId, target });
      }
      await spGame.fireShot('PLAYER', target);
      return;
    }

    const intendedAim = target === 'DEALER' ? 'OPPONENT' : 'SELF';
    const hoverTargetId = target === 'PLAYER' ? myId : opponentId;

    if (isMobile && spGame.aimTarget !== intendedAim) {
      spGame.setAimTarget(intendedAim);
      spGame.setCameraView('GUN');
      
      if (appState === 'GAME' && spGame.gameState.isMultiplayer && mp.room) {
        mp.sendImmediateAction(mp.room.id, { type: 'HOVER_TARGET', target: intendedAim, targetId: hoverTargetId });
      }
      return;
    }

    if (appState === 'GAME' && spGame.gameState.isMultiplayer && mp.room) {
      mp.sendImmediateAction(mp.room.id, { type: 'SHOOT', shooter: 'PLAYER', target, targetId: hoverTargetId });
    }
    await spGame.fireShot('PLAYER', target);
  };

  const handleUseItem = async (index: number, targetPlayerId?: string) => {
    if (appState === 'GAME' && spGame.gameState.isMultiplayer) {
      if (spGame.gameState.turnOwner !== 'PLAYER') return;
      const item = spGame.player.items[index];
      
      let deckCards: string[] | undefined;
      let jackpotOutcome: 'JACKPOT' | 'NORMAL' | 'LOSE' | undefined;
      let crushIndex: number | undefined;
      let contractLoot: string[] | undefined;
      let phoneFutureIndex: number | undefined;

      const isThreePlayer = spGame.gameState.isThreePlayer;

      if (item === 'DECK_CARD') {
        const allTarotNames = [
          'The Magician', 'The Hanged Man', 'The Hermit', 'The Moon', 'Judgment',
          'Wheel of Fortune', 'The Sun', 'Death', 'The Tower', 'The Fool', 'Justice', 'Temperance'
        ];
        const shuffled = [...allTarotNames].sort(() => Math.random() - 0.5);
        deckCards = shuffled.slice(0, 6);
      } else if (item === 'JACKPOT') {
        jackpotOutcome = resolveJackpotOutcome();
        if (jackpotOutcome === 'JACKPOT' && mp.room) {
          mp.sendMessage(mp.room.id, '[STICKER]:sticker9.gif');
        }
      } else if (item === 'CRUSHER') {
        if (isThreePlayer) {
          const playersList = mp.room?.players || [];
          const myId = mp.playerId || '';
          
          const resolveTargetOwner = (targetPlayerId: string, localPlayerId: string, players: any[]): TurnOwner => {
            if (targetPlayerId === localPlayerId) return 'PLAYER';
            const myIndex = players.findIndex(p => p.id === localPlayerId);
            const size = players.length;
            if (myIndex === -1) return 'DEALER';
            const frontOpponent = players[(myIndex + 2) % size];
            const leftOpponent = players[(myIndex + 1) % size];
            const rightOpponent = size >= 4 ? players[(myIndex + 3) % size] : null;
            
            if (frontOpponent && targetPlayerId === frontOpponent.id) return 'DEALER';
            if (leftOpponent && targetPlayerId === leftOpponent.id) return 'PLAYER3';
            if (rightOpponent && targetPlayerId === rightOpponent.id) return 'PLAYER4';
            return 'DEALER';
          };

          const targetOwner = targetPlayerId ? resolveTargetOwner(targetPlayerId, myId, playersList) : 'DEALER';
          const targetState = targetOwner === 'PLAYER3' ? spGame.player3 : (targetOwner === 'PLAYER4' ? spGame.player4 : spGame.dealer);
          if (targetState && targetState.items.length > 0) {
            crushIndex = Math.floor(Math.random() * targetState.items.length);
          }
        } else {
          if (spGame.dealer.items.length > 0) {
            crushIndex = Math.floor(Math.random() * spGame.dealer.items.length);
          }
        }
      } else if (item === 'CONTRACT') {
        const activeCharms = spGame.player.luckycharmsUsed || 0;
        const highTier = ['CHOKE', 'CIGS', 'SAW', 'GLASS', 'ADRENALINE'];
        const lowTier = ['BEER', 'PHONE', 'INVERTER', 'BIG_INVERTER', 'CUFFS'];
        const highWeight = 5 + (10 * activeCharms);
        const pool: string[] = [];
        highTier.forEach(i => {
          for (let w = 0; w < highWeight; w++) pool.push(i);
        });
        lowTier.forEach(i => pool.push(i));
        const item1 = pool[Math.floor(Math.random() * pool.length)];
        const item2 = pool[Math.floor(Math.random() * pool.length)];
        contractLoot = [item1, item2];
      } else if (item === 'PHONE') {
        const checkLimit = spGame.gameState.chamber.length;
        const current = spGame.gameState.currentShellIndex;
        const available = [];
        for (let i = current + 2; i < checkLimit; i++) {
          available.push(i);
        }
        if (available.length > 0) {
          phoneFutureIndex = available[Math.floor(Math.random() * available.length)];
        }
      }

      if (mp.room) {
        mp.sendAction(mp.room.id, {
          type: 'USE_ITEM',
          item,
          index,
          deckCards,
          jackpotOutcome,
          crushIndex,
          contractLoot,
          phoneFutureIndex,
          targetPlayerId
        });
      }
      await spGame.usePlayerItem(index, deckCards, jackpotOutcome, crushIndex, contractLoot as any, phoneFutureIndex, targetPlayerId);
    } else {
      await spGame.usePlayerItem(index, undefined, undefined, undefined, undefined, undefined, targetPlayerId);
    }
  };

  const handleCardClick = async (index: number) => {
    if (appState === 'GAME' && spGame.gameState.isMultiplayer) {
      if (spGame.gameState.turnOwner !== 'PLAYER') return;
      
      const cards = spGame.gameState.deckCards;
      const chosenCard = cards ? cards[index] : null;
      const cardRandoms: any = {};

      if (chosenCard) {
        if (chosenCard.name === 'The Magician') {
          const ITEMS: import('./types').ItemType[] = [
            'BEER', 'CIGS', 'SAW', 'GLASS', 'CUFFS', 'PHONE', 'INVERTER', 'ADRENALINE',
            'CHOKE', 'REMOTE', 'BIG_INVERTER', 'CONTRACT', 'LUCKYCHARM', 'FLASHBANG',
            'CRUSHER', 'TOTEM', 'MIRROR', 'DECK_CARD', 'JACKPOT'
          ];
          const playerCount = mp.room?.players?.length || 2;
          const filteredItems = playerCount <= 2 ? ITEMS.filter(item => item !== 'REMOTE') : ITEMS;
          cardRandoms.magicianItem = filteredItems[Math.floor(Math.random() * filteredItems.length)];
        } else if (chosenCard.name === 'Judgment') {
          cardRandoms.judgmentSuccess = Math.random() < 0.5;
        } else if (chosenCard.name === 'The Moon') {
          const oppItems = spGame.dealer.items;
          const stealableIndices = [];
          for (let i = 0; i < oppItems.length; i++) {
            if (oppItems[i] !== null && oppItems[i] !== 'TOTEM' && oppItems[i] !== 'JACKPOT') {
              stealableIndices.push(i);
            }
          }
          if (stealableIndices.length > 0) {
            cardRandoms.moonIndex = stealableIndices[Math.floor(Math.random() * stealableIndices.length)];
          }
        } else if (chosenCard.name === 'Death') {
          const myItems = spGame.player.items;
          const destructibleIndices = [];
          for (let i = 0; i < myItems.length; i++) {
            if (myItems[i] !== null) {
              destructibleIndices.push(i);
            }
          }
          if (destructibleIndices.length > 0) {
            cardRandoms.deathIndex = destructibleIndices[Math.floor(Math.random() * destructibleIndices.length)];
          }
        } else if (chosenCard.name === 'The Tower') {
          const oppItems = spGame.dealer.items;
          const destructibleIndices = [];
          for (let i = 0; i < oppItems.length; i++) {
            if (oppItems[i] !== null && oppItems[i] !== 'TOTEM') {
              destructibleIndices.push(i);
            }
          }
          if (destructibleIndices.length > 0) {
            cardRandoms.towerIndex = destructibleIndices[Math.floor(Math.random() * destructibleIndices.length)];
          }
        } else if (chosenCard.name === 'Wheel of Fortune') {
          const chamber = [...spGame.gameState.chamber];
          const idx = spGame.gameState.currentShellIndex;
          const remaining = chamber.slice(idx);
          if (remaining.length > 0) {
            const shuffledRemaining = [...remaining].sort(() => Math.random() - 0.5);
            for (let i = 0; i < shuffledRemaining.length; i++) {
              chamber[idx + i] = shuffledRemaining[i];
            }
            cardRandoms.wheelChamber = chamber;
          }
        }
      }

      if (mp.room) {
        mp.sendAction(mp.room.id, { type: 'SELECT_CARD', index, cardRandoms });
      }
      await spGame.selectTarotCard(index, cardRandoms);
    } else {
      await spGame.selectTarotCard(index);
    }
  };

  const handlePickupGun = () => {
    if (appState === 'GAME' && spGame.gameState.isMultiplayer && mp.room) {
      if (spGame.gameState.turnOwner !== 'PLAYER') return;
      mp.sendAction(mp.room.id, { type: 'PICKUP_GUN' });
    }
    spGame.pickupGun('PLAYER');
  };

  const handleStealItem = (index: number) => {
    if (spGame.isProcessing) return;
    if (spGame.gameState.phase !== 'STEALING') return;

    if (appState === 'GAME' && spGame.gameState.isMultiplayer && mp.room) {
      if (spGame.gameState.turnOwner !== 'PLAYER') return;
      mp.sendAction(mp.room.id, { type: 'STEAL_ITEM', index });
    }
    spGame.stealItem(index, 'PLAYER');
  };

  const handleHoverTarget = (target: AimTarget, targetId?: string) => {
    spGame.setAimTarget(target);
    if (appState === 'GAME' && spGame.gameState.isMultiplayer && mp.room) {
      if (spGame.gameState.turnOwner === 'PLAYER') {
        const now = Date.now();
        const last = lastHoverRef.current;
        if (last.target === target && last.targetId === targetId && now - last.time < 50) return;
        lastHoverRef.current = { target, targetId, time: now };
        mp.sendImmediateAction(mp.room.id, { type: 'HOVER_TARGET', target, targetId });
      }
    }
  };

  // Listen for remote actions
  useEffect(() => {
    if (appState === 'GAME' && spGame.gameState.isMultiplayer) {
      mp.setOnAction(async ({ playerId, action }) => {
        if (playerId !== mp.playerId) {
          console.log('Received remote action:', action);

          const isMultiplayerSeat = spGame.gameState.isThreePlayer || spGame.gameState.isFourPlayer;
          const playersList = mp.room?.players || [];
          const myId = mp.playerId || '';

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
              if (targetIndex === (myIndex + 2) % 4) return 'DEALER';
              if (targetIndex === (myIndex + 1) % 4) return 'PLAYER3';
              if (targetIndex === (myIndex + 3) % 4) return 'PLAYER4';
              return 'DEALER';
            }

            return 'DEALER';
          };

          const getPlayerSetter = (owner: TurnOwner) => {
            if (owner === 'PLAYER') return spGame.setPlayer;
            if (owner === 'PLAYER3') return spGame.setPlayer3;
            return spGame.setDealer;
          };

          if (isMultiplayerSeat) {
            const relSender = resolveTargetOwner(playerId, myId, playersList);
            switch (action.type) {
              case 'SHOOT': {
                const relTarget = resolveTargetOwner(action.targetId, myId, playersList);
                spGame.fireShot(relSender, relTarget);
                break;
              }
              case 'USE_ITEM': {
                const senderSetter = getPlayerSetter(relSender);
                senderSetter(d => {
                  const newItems = [...d.items];
                  const idx = action.index !== undefined ? action.index : newItems.indexOf(action.item);
                  if (idx !== -1) {
                    newItems.splice(idx, 1);
                  }
                  return { ...d, items: newItems };
                });
                await spGame.processItemEffect(relSender, action.item, action.deckCards, action.jackpotOutcome, action.crushIndex, action.contractLoot, action.phoneFutureIndex, action.targetPlayerId, false);
                break;
              }
              case 'PICKUP_GUN':
                spGame.pickupGun(relSender);
                break;
              case 'STEAL_ITEM':
                spGame.stealItem(action.index, relSender);
                break;
              case 'HOVER_TARGET': {
                let aim: AimTarget = action.target;
                const relTarget = action.targetId ? resolveTargetOwner(action.targetId, myId, playersList) : null;

                if (relSender === 'PLAYER3') {
                  if (relTarget === 'PLAYER3') aim = 'LEFT';
                  else if (relTarget === 'PLAYER') aim = 'SELF';
                  else if (relTarget === 'DEALER') aim = 'OPPONENT';
                  else if (relTarget === 'PLAYER4') aim = 'RIGHT';
                  else if (action.target === 'SELF') aim = 'LEFT';
                  else if (action.target === 'LEFT') aim = 'SELF';
                  else aim = 'OPPONENT';
                } else if (relSender === 'PLAYER4') {
                  if (relTarget === 'PLAYER4') aim = 'RIGHT';
                  else if (relTarget === 'PLAYER') aim = 'SELF';
                  else if (relTarget === 'DEALER') aim = 'OPPONENT';
                  else if (relTarget === 'PLAYER3') aim = 'LEFT';
                  else if (action.target === 'SELF') aim = 'RIGHT';
                  else aim = 'OPPONENT';
                } else if (relSender === 'DEALER') {
                  if (relTarget === 'DEALER') aim = 'SELF';
                  else if (relTarget === 'PLAYER') aim = 'OPPONENT';
                  else if (relTarget === 'PLAYER3') aim = 'LEFT';
                  else if (relTarget === 'PLAYER4') aim = 'RIGHT';
                  else if (action.target === 'SELF') aim = 'OPPONENT';
                  else if (action.target === 'OPPONENT') aim = 'SELF';
                }
                spGame.setAimTarget(aim);
                break;
              }
              case 'DEBUG_SYNC_THREE_PLAYER':
              case 'SYNC_THREE_PLAYER_STATE': {
                const senderIndex = playersList.findIndex((p: any) => p.id === playerId);
                if (senderIndex !== -1) {
                  const size = playersList.length;
                  const absoluteStates: any[] = [];
                  absoluteStates[senderIndex] = action.playerState;

                  if (size >= 4) {
                    absoluteStates[(senderIndex + 1) % 4] = action.player3State;
                    absoluteStates[(senderIndex + 2) % 4] = action.dealerState;
                    absoluteStates[(senderIndex + 3) % 4] = action.player4State;
                  } else {
                    absoluteStates[(senderIndex + 1) % 3] = action.player3State;
                    absoluteStates[(senderIndex + 2) % 3] = action.dealerState;
                  }
                  
                  const myIndex = playersList.findIndex((p: any) => p.id === myId);
                  if (myIndex !== -1) {
                    const myState = absoluteStates[myIndex];
                    let frontState = null;
                    let leftState = null;
                    let rightState = null;

                    if (size >= 4) {
                      frontState = absoluteStates[(myIndex + 2) % 4];
                      leftState = absoluteStates[(myIndex + 1) % 4];
                      rightState = absoluteStates[(myIndex + 3) % 4];
                    } else {
                      frontState = absoluteStates[(myIndex + 2) % 3];
                      leftState = absoluteStates[(myIndex + 1) % 3];
                    }
                    
                    if (myState) spGame.setPlayer(myState);
                    if (frontState) spGame.setDealer(frontState);
                    if (leftState) spGame.setPlayer3(leftState);
                    if (rightState) spGame.setPlayer4(rightState);

                    if (action.gameState) {
                      const relTurnOwner = resolveTargetOwner(action.gameState.turnOwnerId || action.gameState.turnOwner, myId, playersList);
                      const relWinner = action.gameState.winnerId ? resolveTargetOwner(action.gameState.winnerId, myId, playersList) : action.gameState.winner;
                      let nextPhase = action.gameState.phase;
                      if (action.gameState.phase === 'PLAYER_TURN' || action.gameState.phase === 'DEALER_TURN' || action.gameState.phase === 'PLAYER3_TURN' || action.gameState.phase === 'PLAYER4_TURN') {
                        nextPhase = relTurnOwner === 'PLAYER' ? 'PLAYER_TURN' : (relTurnOwner === 'PLAYER3' ? 'PLAYER3_TURN' : (relTurnOwner === 'PLAYER4' ? 'PLAYER4_TURN' : 'DEALER_TURN'));
                      }
                      spGame.setGameState(prev => ({
                        ...prev,
                        ...action.gameState,
                        localPlayerId: prev.localPlayerId,
                        opponentName: prev.opponentName,
                        multiplayerState: prev.multiplayerState,
                        turnOwner: relTurnOwner,
                        phase: nextPhase,
                        winner: relWinner
                      }));
                    }
                  }
                }
                break;
              }
              case 'SYNC_THREE_PLAYER_ROUND': {
                const myIndex = playersList.findIndex((p: any) => p.id === myId);
                if (myIndex !== -1) {
                  const size = playersList.length;
                  const myItems = action[`items${myIndex}`] || [];
                  let frontItems = [];
                  let leftItems = [];
                  let rightItems = [];

                  if (size >= 4) {
                    frontItems = action[`items${(myIndex + 2) % 4}`] || [];
                    leftItems = action[`items${(myIndex + 1) % 4}`] || [];
                    rightItems = action[`items${(myIndex + 3) % 4}`] || [];
                  } else {
                    frontItems = action[`items${(myIndex + 2) % 3}`] || [];
                    leftItems = action[`items${(myIndex + 1) % 3}`] || [];
                  }

                  const nextHp = action.hp;

                  if (action.resetItems) {
                    spGame.setPlayer(p => ({ ...p, hp: nextHp, maxHp: nextHp, items: myItems }));
                    spGame.setDealer(d => ({ ...d, hp: nextHp, maxHp: nextHp, items: frontItems }));
                    spGame.setPlayer3(p3 => ({ ...p3, hp: nextHp, maxHp: nextHp, items: leftItems }));
                    if (size >= 4) {
                      spGame.setPlayer4(p4 => ({ ...p4, hp: nextHp, maxHp: nextHp, items: rightItems }));
                    }
                  } else {
                    spGame.setPlayer3(p3 => ({ ...p3, items: [...p3.items, ...leftItems].slice(0, 8) }));
                    if (size >= 4) {
                      spGame.setPlayer4(p4 => ({ ...p4, items: [...p4.items, ...rightItems].slice(0, 8) }));
                    }
                  }

                  if (action.threePlayerWins) {
                    spGame.setGameState(prev => ({ ...prev, threePlayerWins: action.threePlayerWins }));
                  }
                  if (action.fourPlayerWins) {
                    spGame.setGameState(prev => ({ ...prev, fourPlayerWins: action.fourPlayerWins }));
                  }

                  const relTurnOwner = resolveTargetOwner(action.nextTurnOwnerId, myId, playersList);
                  spGame.setOverlayText(action.resetItems ? `ROUND ${action.roundNum || 1}` : 'RELOADING NEW BATCH...');

                  spGame.startRound(
                      action.resetItems || false,
                      false,
                      undefined,
                      action.chamber,
                      action.resetItems ? myItems : [...spGame.player.items, ...myItems].slice(0, 8),
                      action.resetItems ? frontItems : [...spGame.dealer.items, ...frontItems].slice(0, 8),
                      relTurnOwner,
                      action.hp,
                      undefined,
                      action.resetItems ? leftItems : [...spGame.player3.items, ...leftItems].slice(0, 8),
                      action.resetItems ? rightItems : [...spGame.player4.items, ...rightItems].slice(0, 8)
                  );
                }
                break;
              }
            }
            return;
          }

          switch (action.type) {
            case 'SHOOT': {
              const targetOwner = action.targetId && mp.room?.players
                ? resolveTargetOwner(action.targetId, myId, mp.room.players)
                : (action.target === 'PLAYER' ? 'PLAYER' : 'DEALER');
              spGame.setAimTarget(targetOwner === 'PLAYER' ? 'SELF' : 'OPPONENT');
              spGame.fireShot('DEALER', targetOwner);
              break;
            }
            case 'USE_ITEM':
              spGame.setDealer(d => {
                const newItems = [...d.items];
                const idx = action.index !== undefined ? action.index : newItems.indexOf(action.item);
                if (idx !== -1) {
                  newItems.splice(idx, 1);
                }
                return { ...d, items: newItems };
              });
              await spGame.processItemEffect('DEALER', action.item, action.deckCards, action.jackpotOutcome, action.crushIndex, action.contractLoot, action.phoneFutureIndex);
              break;
            case 'SELECT_CARD':
              spGame.selectTarotCard(action.index, action.cardRandoms);
              break;
            case 'PICKUP_GUN':
              spGame.pickupGun('DEALER');
              break;
            case 'STEAL_ITEM':
              spGame.stealItem(action.index, 'DEALER');
              break;
            case 'HOVER_TARGET': {
              let remoteAim: AimTarget = action.target;
              if (action.targetId && mp.room?.players) {
                const relTarget = resolveTargetOwner(action.targetId, myId, mp.room.players);
                remoteAim = relTarget === 'DEALER' ? 'SELF' : 'OPPONENT';
              }
              spGame.setAimTarget(remoteAim);
              break;
            }
            case 'SYNC_ROUND':
              const iAmHost = mp.playerId === (mp.room?.hostId || '');
              spGame.setOverlayText(action.resetItems ? `ROUND ${(action.roundNum || 1)}` : 'RELOADING NEW BATCH...');
              const pItems = iAmHost ? action.hostItems : action.clientItems;
              const dItems = iAmHost ? action.clientItems : action.hostItems;
              const clientNextTurn = action.nextTurnOwner === 'PLAYER' ? 'DEALER' : 'PLAYER';
              // @ts-ignore
              await spGame.startRound(action.resetItems || false, false, undefined, action.chamber, pItems, dItems, clientNextTurn, action.hp);
              break;
            case 'DEBUG_SYNC_PLAYER':
              spGame.setDealer(action.player);
              break;
            case 'DEBUG_SYNC_PLAYER_MODEL': {
              // Transient model override from a remote dev client — do not persist
              spGame.setGameState(prev => {
                const mpState = (prev.multiplayerState as any) || {};
                const nextMpState = {
                  ...mpState,
                  debugPlayerModels: {
                    ...((mpState as any).debugPlayerModels || {}),
                    [action.playerId]: action.modelKey
                  }
                };
                return { ...prev, multiplayerState: nextMpState } as any;
              });
              break;
            }
            case 'DEBUG_SYNC_DEALER':
              spGame.setPlayer(action.dealer);
              break;
            case 'DEBUG_SYNC_GAMESTATE': {
              const invGameState = { ...action.gameState };
              if (action.gameState.turnOwner) {
                invGameState.turnOwner = action.gameState.turnOwner === 'PLAYER' ? 'DEALER' : 'PLAYER';
              }
              if (action.gameState.phase) {
                if (action.gameState.phase === 'PLAYER_TURN') invGameState.phase = 'DEALER_TURN';
                else if (action.gameState.phase === 'DEALER_TURN') invGameState.phase = 'PLAYER_TURN';
              }
              if (action.gameState.winner) {
                invGameState.winner = action.gameState.winner === 'PLAYER' ? 'DEALER' : 'PLAYER';
              }
              spGame.setGameState(prev => ({
                ...prev,
                ...invGameState,
                localPlayerId: prev.localPlayerId,
                multiplayerState: prev.multiplayerState,
                opponentName: prev.opponentName,
                isMultiplayer: prev.isMultiplayer,
                isThreePlayer: prev.isThreePlayer,
                isFourPlayer: prev.isFourPlayer,
                roomSettings: prev.roomSettings
              }));
              break;
            }
            case 'SYNC_STATE':
              // Deep sync if host tells us the ground truth
              // CRITICAL: We must invert the perspective for the remote player
              const invertedGameState = { ...action.gameState };
              if (action.gameState.turnOwner) {
                invertedGameState.turnOwner = action.gameState.turnOwner === 'PLAYER' ? 'DEALER' : 'PLAYER';
              }
              if (action.gameState.phase) {
                if (action.gameState.phase === 'PLAYER_TURN') invertedGameState.phase = 'DEALER_TURN';
                else if (action.gameState.phase === 'DEALER_TURN') invertedGameState.phase = 'PLAYER_TURN';
              }
              if (action.gameState.winner) {
                invertedGameState.winner = action.gameState.winner === 'PLAYER' ? 'DEALER' : 'PLAYER';
              }

              // Correct opponentName sync: opponent for client is host
              const host = mp.room?.players?.find((p: any) => p.id === mp.room.hostId);
              invertedGameState.opponentName = host ? host.name : 'OPPONENT';

              spGame.syncState({
                player: action.player2State, // Remote's player 2 (our local player)
                dealer: action.player1State, // Remote's player 1 (host / our dealer)
                gameState: invertedGameState
              });
              break;
          }
        }
      });
    }
  }, [appState, spGame.gameState.isMultiplayer, mp.playerId, mp.setOnAction, mp.room, spGame]);

  useEffect(() => {
    if (mp.isConnected && appState === 'LOADING_MP') {
      if (initialRoomId && /^[0-9]{4}$/.test(initialRoomId)) {
        mp.joinRoom(initialRoomId, spGame.playerName);
        window.history.replaceState({}, document.title, window.location.pathname);
        setInitialRoomId(null);
      } else {
        setAppState('MP_SELECTION');
      }
    }
  }, [mp.isConnected, appState, initialRoomId, spGame.playerName]);

  useEffect(() => {
    if (mp.room && (appState === 'MP_SELECTION' || appState === 'LOADING_MP')) {
      setAppState('LOBBY');
    } else if (appState === 'LOBBY' && !mp.room) {
      setAppState('MP_SELECTION');
    }
  }, [mp.room, appState]);

  useEffect(() => {
    if (mp.isConnected) {
      // Handle Game Start from Server
      mp.socket?.on('gameStarted', ({ room, gameData }: { room: any, gameData: any }) => {
        console.log('Multiplayer game starting...', room, gameData);

        const playerCount = room.players?.length || 2;
        const isMulti = playerCount >= 3;
        const iAmHost = mp.playerId === room.hostId;

        const resolveTargetOwner = (targetPlayerId: string, localPlayerId: string, players: any[]): TurnOwner => {
          if (targetPlayerId === localPlayerId) return 'PLAYER';
          const myIndex = players.findIndex(p => p.id === localPlayerId);
          const size = players.length;
          if (myIndex === -1) return 'DEALER';
          const frontOpponent = players[(myIndex + 2) % size];
          const leftOpponent = players[(myIndex + 1) % size];
          const rightOpponent = size >= 4 ? players[(myIndex + 3) % size] : null;
          
          if (frontOpponent && targetPlayerId === frontOpponent.id) return 'DEALER';
          if (leftOpponent && targetPlayerId === leftOpponent.id) return 'PLAYER3';
          if (rightOpponent && targetPlayerId === rightOpponent.id) return 'PLAYER4';
          return 'DEALER';
        };

        if (isMulti) {
          const myIndex = room.players.findIndex((p: any) => p.id === mp.playerId);
          const myItems = gameData[`items${myIndex}`] || [];
          const frontItems = gameData[`items${(myIndex + 2) % playerCount}`] || [];
          const leftItems = gameData[`items${(myIndex + 1) % playerCount}`] || [];
          const rightItems = playerCount >= 4 ? gameData[`items${(myIndex + 3) % playerCount}`] : [];

          const frontOpponent = room.players[(myIndex + 2) % playerCount];
          const opponentName = frontOpponent ? frontOpponent.name : 'OPPONENT';

          let initialTurnOwnerId = room.players[0].id;
          const initialTurnOwner = resolveTargetOwner(initialTurnOwnerId, mp.playerId || '', room.players);

          setAppState('LOADING_GAME');

          setTimeout(() => {
            spGame.setPlayer3({ hp: gameData.hpOverride, maxHp: gameData.hpOverride, items: leftItems, isHandcuffed: false, isSawedActive: false });
            if (playerCount >= 4) {
              spGame.setPlayer4({ hp: gameData.hpOverride, maxHp: gameData.hpOverride, items: rightItems, isHandcuffed: false, isSawedActive: false });
            }
            spGame.startGame(
              spGame.playerName,
              false,
              true,
              opponentName,
              initialTurnOwner,
              gameData.chamber,
              myItems,
              frontItems,
              gameData.hpOverride,
              room.settings,
              leftItems,
              rightItems
            );

            spGame.setGameState(prev => ({
                ...prev,
                isThreePlayer: playerCount === 3,
                isFourPlayer: playerCount === 4,
                localPlayerId: mp.playerId || '',
                turnOwner: initialTurnOwner,
                multiplayerState: room
              }));
            }, 100);
          return;
        }

        const opponent = room.players.find((p: any) => p.id !== mp.playerId);
        const opponentName = opponent ? opponent.name : 'OPPONENT';

        const chamberOverride = gameData.chamber;
        const pItemsOverride = iAmHost ? gameData.hostItems : gameData.clientItems;
        const dItemsOverride = iAmHost ? gameData.clientItems : gameData.hostItems;

        let initialTurnOwner: import('./types').TurnOwner = 'PLAYER';
        if (gameData.hostStarts) {
          initialTurnOwner = iAmHost ? 'PLAYER' : 'DEALER';
        } else {
          initialTurnOwner = iAmHost ? 'DEALER' : 'PLAYER';
        }

        setAppState('LOADING_GAME');

        setTimeout(() => {
          spGame.startGame(
            spGame.playerName,
            false, // hardMode
            true, // isMultiplayer
            opponentName,
            initialTurnOwner,
            chamberOverride,
            pItemsOverride,
            dItemsOverride,
            gameData.hpOverride, // Apply HP from settings
            room.settings
          );
        }, 100);
      });

      // Handle Game Reset/Play Again from Server
      mp.socket?.on('matchReset', () => {
        console.log('Multiplayer match reset by host, returning to lobby...');
        lastTotalWins.current = 0;
        spGame.resetGame(true); // Reset game states cleanly
        setAppState('LOBBY');   // Route back to lobby view
      });

      // Handle kicked event routing
      mp.socket?.on('kicked', () => {
        setAppState('MP_SELECTION');
      });

      // Handle opponent disconnection mid-game
      mp.socket?.on('matchAborted', ({ abortedBy }: { abortedBy: string }) => {
        console.log(`Multiplayer match aborted: ${abortedBy} disconnected.`);
        setAbortedByName(abortedBy);
      });

      return () => {
        mp.socket?.off('gameStarted');
        mp.socket?.off('matchReset');
        mp.socket?.off('kicked');
        mp.socket?.off('matchAborted');
      };
    }
  }, [mp.isConnected, mp.socket, mp.playerId, spGame]);

  // Shared utility: Generate a randomized chamber and item batches for multiplayer rounds
  const generateMPBatch = useCallback((settings: any, playerCount: number, hostCharms: number = 0, clientCharms: number = 0) => {
    const total = randomInt(2, 8);
    const maxLives = Math.floor(total / 2);
    let lives = randomInt(1, maxLives);
    if (lives < maxLives && Math.random() > 0.4) lives = maxLives;
    const blanks = total - lives;

    const chamber = [...Array(lives).fill('LIVE'), ...Array(blanks).fill('BLANK')] as ShellType[];
    for (let i = chamber.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chamber[i], chamber[j]] = [chamber[j], chamber[i]];
    }

    let itemsCount = settings.itemsPerShipment;
    if (settings.itemsPerShipment === 9) {
      // Weighted roll: 1 (5%), 2 (25%), 3 (25%), 4 (20%), 5 (15%), 6 (7%), 7 (2.5%), 8 (0.5%)
      const r = Math.random();
      if (r < 0.05) itemsCount = 1;
      else if (r < 0.30) itemsCount = 2;
      else if (r < 0.55) itemsCount = 3;
      else if (r < 0.75) itemsCount = 4;
      else if (r < 0.90) itemsCount = 5;
      else if (r < 0.97) itemsCount = 6;
      else if (r < 0.995) itemsCount = 7;
      else itemsCount = 8;
    }
    const hostItems = generateLootBatch(itemsCount, false, false, 4, [], hostCharms, 4, 4, settings, playerCount);
    const clientItems = generateLootBatch(itemsCount, false, false, 4, [], clientCharms, 4, 4, settings, playerCount);

    return { chamber, hostItems, clientItems, lives, blanks };
  }, []);

  const generateMultiPlayerBatch = useCallback((settings: any, playerCharms: number[], playerCount: number) => {
      const total = randomInt(2, 8);
      const maxLives = Math.floor(total / 2);
      let lives = randomInt(1, maxLives);
      if (lives < maxLives && Math.random() > 0.4) lives = maxLives;
      const blanks = total - lives;

      const chamber: ShellType[] = [];
      for (let i = 0; i < lives; i++) chamber.push('LIVE');
      for (let i = 0; i < blanks; i++) chamber.push('BLANK');
      for (let i = chamber.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chamber[i], chamber[j]] = [chamber[j], chamber[i]];
      }

      const itemsCount = settings.itemsPerShipment || 2;
      const lootBatches: any[] = [];
      for (let i = 0; i < playerCount; i++) {
        lootBatches.push(generateLootBatch(itemsCount, false, false, 4, [], playerCharms[i] || 0, 4, 4, settings, playerCount));
      }

      return { chamber, lootBatches, lives, blanks };
  }, []);

  const handleStartMPGame = () => {
    if (mp.room && mp.playerId === mp.room.hostId) {
      const settings = mp.room.settings || { rounds: 3, hp: 2, itemsPerShipment: 2 };
      const playerCount = mp.room?.players?.length || 2;
      const isMulti = playerCount >= 3;

      if (isMulti) {
        const { chamber, lootBatches } = generateMultiPlayerBatch(settings, Array(playerCount).fill(0), playerCount);
        const hpVal = settings.hp === 9 ? randomInt(2, 8) : settings.hp;
        const gameData: any = {
          isThreePlayer: playerCount === 3,
          isFourPlayer: playerCount === 4,
          chamber,
          hpOverride: hpVal
        };
        for (let i = 0; i < playerCount; i++) {
          gameData[`items${i}`] = lootBatches[i];
        }
        lastTotalWins.current = 0;
        mp.startGame(mp.room.id, gameData);
      } else {
        const { chamber, hostItems, clientItems } = generateMPBatch(settings, playerCount, 0, 0);
        const hpVal = settings.hp === 9 ? randomInt(2, 8) : settings.hp;
        const hostStarts = Math.random() < 0.5;
        const gameData = {
          chamber,
          hostItems,
          clientItems,
          hostStarts,
          hpOverride: hpVal
        };
        lastTotalWins.current = 0;
        mp.startGame(mp.room.id, gameData);
      }
    }
  };

  // Sync subsequent rounds
  useEffect(() => {
    if (spGame.gameState.isMultiplayer && mp.room) {
      spGame.setOnBatchEnd((keepTurn: boolean) => {
        if (mp.playerId === mp.room.hostId) {
          const settings = mp.room.settings || { rounds: 3, hp: 2, itemsPerShipment: 2 };
          const playerCount = mp.room?.players?.length || 2;
          const isMulti = playerCount >= 3;

          const resolveTargetOwner = (targetPlayerId: string, localPlayerId: string, players: any[]): TurnOwner => {
            if (targetPlayerId === localPlayerId) return 'PLAYER';
            const myIndex = players.findIndex(p => p.id === localPlayerId);
            const size = players.length;
            if (myIndex === -1) return 'DEALER';
            const frontOpponent = players[(myIndex + 2) % size];
            const leftOpponent = players[(myIndex + 1) % size];
            const rightOpponent = size >= 4 ? players[(myIndex + 3) % size] : null;
            
            if (frontOpponent && targetPlayerId === frontOpponent.id) return 'DEALER';
            if (leftOpponent && targetPlayerId === leftOpponent.id) return 'PLAYER3';
            if (rightOpponent && targetPlayerId === rightOpponent.id) return 'PLAYER4';
            return 'DEALER';
          };

          if (isMulti) {
            console.log(`Batch end detected (HOST, ${playerCount}-Player) - Generating new batch... keepTurn:`, keepTurn);
            const p0Charms = spGame.player.luckycharmsUsed || 0;
            const p1Charms = spGame.dealer.luckycharmsUsed || 0;
            const p2Charms = spGame.player3?.luckycharmsUsed || 0;
            const p3Charms = spGame.player4?.luckycharmsUsed || 0;

            const { chamber, lootBatches, lives, blanks } = generateMultiPlayerBatch(settings, [p0Charms, p1Charms, p2Charms, p3Charms], playerCount);
            
            const myId = mp.playerId || '';
            const mPlayers = mp.room.players;
            const myIndex = mPlayers.findIndex((p: any) => p.id === myId);

            let currentTurnOwnerId = myId;
            if (spGame.gameState.turnOwner === 'DEALER') currentTurnOwnerId = mPlayers[(myIndex + 2) % playerCount].id;
            else if (spGame.gameState.turnOwner === 'PLAYER3') currentTurnOwnerId = mPlayers[(myIndex + 1) % playerCount].id;
            else if (spGame.gameState.turnOwner === 'PLAYER4') currentTurnOwnerId = mPlayers[(myIndex + 3) % playerCount].id;

            const nextStartsId = currentTurnOwnerId;

            const syncAction: any = {
              type: 'SYNC_THREE_PLAYER_ROUND',
              chamber,
              nextTurnOwnerId: nextStartsId,
              resetItems: false,
              hp: undefined
            };
            for (let i = 0; i < playerCount; i++) {
              syncAction[`items${i}`] = lootBatches[i];
            }

            mp.sendImmediateAction(mp.room.id, syncAction);
            mp.sendMessage(mp.room.id, `SYSTEM: NEW BATCH REPLENISHED - ${lives} LIVE, ${blanks} BLANK`);
            spGame.setOverlayText('RELOADING NEW BATCH...');

            const myItems = syncAction[`items${myIndex}`] || [];
            const frontItems = syncAction[`items${(myIndex + 2) % playerCount}`] || [];
            const leftItems = syncAction[`items${(myIndex + 1) % playerCount}`] || [];
            const rightItems = playerCount >= 4 ? syncAction[`items${(myIndex + 3) % playerCount}`] : [];

            spGame.setPlayer3(p3 => ({ ...p3, items: [...p3.items, ...leftItems].slice(0, 8) }));
            if (playerCount >= 4) {
              spGame.setPlayer4(p4 => ({ ...p4, items: [...p4.items, ...rightItems].slice(0, 8) }));
            }
            spGame.startRound(
              false,
              false,
              undefined,
              chamber,
              [...spGame.player.items, ...myItems].slice(0, 8),
              [...spGame.dealer.items, ...frontItems].slice(0, 8),
              spGame.gameState.turnOwner,
              undefined,
              undefined,
              leftItems,
              rightItems
            );
            return;
          }

          console.log("Batch end detected (HOST) - Generating new batch... keepTurn:", keepTurn);
          const hostCharms = spGame.player.luckycharmsUsed || 0;
          const clientCharms = spGame.dealer.luckycharmsUsed || 0;
          const { chamber, hostItems, clientItems, lives, blanks } = generateMPBatch(settings, playerCount, hostCharms, clientCharms);

          const lastWasHost = spGame.gameState.turnOwner === 'PLAYER';
          const nextStarts = keepTurn ? lastWasHost : !lastWasHost;

          const currentTotalWins = (spGame.gameState.multiModeState?.playerWins || 0) + (spGame.gameState.multiModeState?.opponentWins || 0);
          const isNewRound = currentTotalWins > lastTotalWins.current;
          lastTotalWins.current = currentTotalWins;

          const hpVal = isNewRound ? (settings.hp === 9 ? randomInt(2, 8) : settings.hp) : undefined;

          const syncAction = {
            type: 'SYNC_ROUND',
            chamber,
            hostItems,
            clientItems,
            nextTurnOwner: nextStarts ? 'PLAYER' : 'DEALER',
            resetItems: isNewRound,
            hp: hpVal,
            roundNum: currentTotalWins + 1
          };

          mp.sendImmediateAction(mp.room.id, syncAction);
          mp.sendMessage(mp.room.id, isNewRound ? `SYSTEM: ROUND ${currentTotalWins + 1} STARTED!` : `SYSTEM: NEW BATCH REPLENISHED - ${lives} LIVE, ${blanks} BLANK`);
          spGame.setOverlayText(isNewRound ? `ROUND ${currentTotalWins + 1}` : 'RELOADING NEW BATCH...');
          spGame.startRound(isNewRound, false, undefined, chamber, hostItems, clientItems, nextStarts ? 'PLAYER' : 'DEALER', hpVal);
        } else {
          console.log("Batch end detected (CLIENT) - Waiting for host sync...");
          spGame.setOverlayText('WAITING FOR HOST...');
        }
      });

      spGame.setOnMPRoundEnd(async (winner: TurnOwner, pWinArg?: number, oWinArg?: number) => {
        const isHost = mp.playerId === mp.room.hostId;
        const playerCount = mp.room?.players?.length || 2;
        const isMulti = playerCount >= 3;

        if (isMulti) {
          const room = mp.room;
          const myIndex = room.players.findIndex((p: any) => p.id === mp.playerId);
          let winnerIndex = myIndex;
          if (winner === 'DEALER') winnerIndex = (myIndex + 2) % playerCount;
          else if (winner === 'PLAYER3') winnerIndex = (myIndex + 1) % playerCount;
          else if (winner === 'PLAYER4') winnerIndex = (myIndex + 3) % playerCount;

          const winnerPlayerId = room.players[winnerIndex].id;
          const currentWins = (playerCount === 4 ? spGame.gameState.fourPlayerWins : spGame.gameState.threePlayerWins) || Array(playerCount).fill(0);
          const nextWins = [...currentWins];
          nextWins[winnerIndex] = (nextWins[winnerIndex] || 0) + 1;

          const settings = room.settings || { rounds: 3, hp: 4 };
          const winsNeeded = Math.ceil(settings.rounds / 2) || 1;

          if (nextWins[winnerIndex] >= winsNeeded) {
            if (isHost) {
              mp.sendImmediateAction(room.id, {
                type: 'SYNC_THREE_PLAYER_STATE',
                playerState: spGame.player,
                dealerState: spGame.dealer,
                player3State: spGame.player3,
                player4State: spGame.player4,
                gameState: {
                  ...spGame.gameState,
                  winnerId: winnerPlayerId,
                  threePlayerWins: playerCount === 3 ? nextWins : undefined,
                  fourPlayerWins: playerCount === 4 ? nextWins : undefined,
                  phase: 'GAME_OVER'
                }
              });
            }
            spGame.setGameState(prev => ({
              ...prev,
              winnerId: winnerPlayerId,
              winner,
              threePlayerWins: playerCount === 3 ? nextWins : undefined,
              fourPlayerWins: playerCount === 4 ? nextWins : undefined,
              phase: 'GAME_OVER'
            }));
            return;
          }

          if (isHost) {
            const { chamber, lootBatches, lives, blanks } = generateMultiPlayerBatch(settings, Array(playerCount).fill(0), playerCount);
            const hpVal = settings.hp === 9 ? randomInt(2, 8) : settings.hp;
            const nextRoundNum = nextWins.reduce((a, b) => a + b, 0) + 1;

            const syncAction: any = {
              type: 'SYNC_THREE_PLAYER_ROUND',
              chamber,
              nextTurnOwnerId: winnerPlayerId,
              resetItems: true,
              hp: hpVal,
              roundNum: nextRoundNum,
              threePlayerWins: playerCount === 3 ? nextWins : undefined,
              fourPlayerWins: playerCount === 4 ? nextWins : undefined
            };
            for (let i = 0; i < playerCount; i++) {
              syncAction[`items${i}`] = lootBatches[i];
            }

            mp.sendImmediateAction(room.id, syncAction);
            mp.sendMessage(room.id, `SYSTEM: ROUND ${nextRoundNum} STARTED!`);

            const myItems = syncAction[`items${myIndex}`];
            const frontItems = syncAction[`items${(myIndex + 2) % playerCount}`];
            const leftItems = syncAction[`items${(myIndex + 1) % playerCount}`];
            const rightItems = playerCount >= 4 ? syncAction[`items${(myIndex + 3) % playerCount}`] : [];

            spGame.setPlayer({ hp: hpVal, maxHp: hpVal, items: myItems, isHandcuffed: false, isSawedActive: false });
            spGame.setDealer({ hp: hpVal, maxHp: hpVal, items: frontItems, isHandcuffed: false, isSawedActive: false });
            spGame.setPlayer3({ hp: hpVal, maxHp: hpVal, items: leftItems, isHandcuffed: false, isSawedActive: false });
            if (playerCount >= 4) {
              spGame.setPlayer4({ hp: hpVal, maxHp: hpVal, items: rightItems, isHandcuffed: false, isSawedActive: false });
            }

            spGame.setGameState(prev => ({
              ...prev,
              threePlayerWins: playerCount === 3 ? nextWins : undefined,
              fourPlayerWins: playerCount === 4 ? nextWins : undefined
            }));

            spGame.setOverlayText(`ROUND ${nextRoundNum}`);
            await spGame.startRound(
              true,
              false,
              undefined,
              chamber,
              myItems,
              frontItems,
              winner,
              hpVal,
              undefined,
              leftItems,
              rightItems
            );
          } else {
            console.log("Client waiting for next round host sync...");
            spGame.setOverlayText('WAITING FOR HOST...');
          }
          return;
        }

        const pWin = pWinArg !== undefined ? pWinArg : ((spGame.gameState.multiModeState?.playerWins || 0) + (winner === 'PLAYER' ? 1 : 0));
        const oWin = oWinArg !== undefined ? oWinArg : ((spGame.gameState.multiModeState?.opponentWins || 0) + (winner === 'PLAYER' ? 0 : 1));
        const currentTotalWins = pWin + oWin;
        const nextRoundNum = currentTotalWins + 1;

        const mSettings = mp.room.settings || { rounds: 3, hp: 2, itemsPerShipment: 2 };
        const winsNeeded = Math.ceil(mSettings.rounds / 2) || 1;

        // If match is over, don't start a new round
        if (pWin >= winsNeeded || oWin >= winsNeeded) {
          return;
        }

        if (isHost) {
          const settings = mp.room.settings || { rounds: 3, hp: 2, itemsPerShipment: 2 };
          const { chamber, hostItems, clientItems, lives, blanks } = generateMPBatch(settings, playerCount, 0, 0);

          const hpVal = settings.hp === 9 ? randomInt(2, 8) : settings.hp;
          // Alternate starting turn for the next round
          const lastTurnOwner = spGame.gameState.turnOwner;
          const nextStarts = lastTurnOwner === 'PLAYER' ? 'DEALER' : 'PLAYER';

          lastTotalWins.current = currentTotalWins;

          const syncAction = {
            type: 'SYNC_ROUND',
            chamber,
            hostItems,
            clientItems,
            nextTurnOwner: nextStarts,
            resetItems: true,
            hp: hpVal,
            roundNum: nextRoundNum
          };

          mp.sendImmediateAction(mp.room.id, syncAction);
          mp.sendMessage(mp.room.id, `SYSTEM: ROUND ${nextRoundNum} STARTED!`);

          spGame.setOverlayText(`ROUND ${nextRoundNum}`);
          await spGame.startRound(true, false, undefined, chamber, hostItems, clientItems, nextStarts, hpVal, { playerWins: pWin, opponentWins: oWin });
        } else {
          console.log("Client waiting for next round host sync...");
          spGame.setOverlayText('WAITING FOR HOST...');
        }
      });
    }
  }, [spGame.gameState.isMultiplayer, mp.room, mp.playerId, spGame, generateMPBatch, generateMultiPlayerBatch]);

  const onLoadingComplete = () => {
    if (appState === 'LOADING_SP') {
      // For singleplayer, force-reset any debug model overrides from the previous session.
      setSettings(prev => ({ ...prev, debugHeadModel: 'DEFAULT' }));
      spGame.startGame(spGame.playerName, isHardModeSelected);
      setAppState('GAME');
    }
    if (appState === 'LOADING_GAME') {
      setAppState('GAME');
    }
  };

  const handleBackToMenu = () => {
    mp.disconnect();
    mp.clearError();
    setAppState('MENU');
    spGame.resetGame(true);
  };

  useEffect(() => {
    if (appState === 'MENU') {
      mp.clearError();
    }
  }, [appState, mp.clearError]);

  // Sync multiplayerState in gameState with mp.room dynamically
  useEffect(() => {
    if (appState === 'GAME' && mp.room) {
      spGame.setGameState(prev => {
        if (prev.multiplayerState === mp.room) return prev;
        return {
          ...prev,
          multiplayerState: mp.room
        };
      });
    }
  }, [mp.room, appState, spGame.setGameState]);

  // Sync state broadcast from host to keep clients in sync
  // Throttled to at most once per 350ms to prevent spam during rapid item-use chains
  const broadcastHostSync = useCallback((force = false) => {
    if (appState !== 'GAME' || !spGame.gameState.isMultiplayer || !mp.room || mp.room.hostId !== mp.playerId) return;
    if (spGame.isProcessing || spGame.gameState.phase === 'RESOLVING' || spGame.gameState.phase === 'GAME_OVER') return;

    const now = Date.now();
    if (!force && now - lastSyncBroadcastRef.current < 350) return;
    lastSyncBroadcastRef.current = now;

    const playerCount = mp.room?.players?.length || 2;
    const isMulti = playerCount >= 3;
    if (isMulti) {
      const room = mp.room;
      const myIndex = room?.players ? room.players.findIndex((p: any) => p.id === mp.playerId) : -1;
      let turnOwnerIndex = myIndex;
      if (myIndex !== -1 && room?.players) {
        if (spGame.gameState.turnOwner === 'DEALER') turnOwnerIndex = (myIndex + 2) % playerCount;
        else if (spGame.gameState.turnOwner === 'PLAYER3') turnOwnerIndex = (myIndex + 1) % playerCount;
        else if (spGame.gameState.turnOwner === 'PLAYER4') turnOwnerIndex = (myIndex + 3) % playerCount;
      }
      const turnOwnerId = room?.players && turnOwnerIndex !== -1 ? room.players[turnOwnerIndex]?.id : '';

      mp.sendImmediateAction(mp.room.id, {
        type: 'SYNC_THREE_PLAYER_STATE',
        playerState: spGame.player,
        dealerState: spGame.dealer,
        player3State: spGame.player3,
        player4State: spGame.player4,
        gameState: {
          ...spGame.gameState,
          turnOwnerId
        }
      });
    } else {
      mp.sendImmediateAction(mp.room.id, {
        type: 'SYNC_STATE',
        player1State: spGame.player,
        player2State: spGame.dealer,
        gameState: spGame.gameState
      });
    }
  }, [appState, mp.room, mp.playerId, mp.sendImmediateAction, spGame]);

  useEffect(() => {
    broadcastHostSync();
  // Include item content (joined) so debug item changes trigger a broadcast immediately
  }, [spGame.player.hp, spGame.dealer.hp, spGame.player3?.hp, spGame.player4?.hp, spGame.gameState.phase, spGame.gameState.turnOwner, spGame.gameState.winner, spGame.isProcessing, spGame.player.items.join(','), spGame.dealer.items.join(','), spGame.player3?.items?.join(','), spGame.player4?.items?.join(','), broadcastHostSync]);

  useEffect(() => {
    mp.setOnFullSyncRequest(() => broadcastHostSync(true));
  }, [mp.setOnFullSyncRequest, broadcastHostSync]);

  // --- DISCORD RICH PRESENCE UPDATER ---
  useEffect(() => {
    if (!window.updateDiscordActivity) return;

    try {
      if (appState === 'MENU') {
        window.updateDiscordActivity("In Main Menu", "Awaiting the next challenger...");
      } else if (appState === 'MP_SELECTION') {
        window.updateDiscordActivity("Browsing Multiplayer", "Hunting for a worthy opponent...");
      } else if (appState === 'LOBBY') {
        const roomObj = mp.room as any;
        const roomName = roomObj?.name || "Room";
        const isHost = roomObj?.hostId === mp.playerId;
        const playerCount = roomObj?.players?.length || 1;
        const allReady = roomObj?.players?.every((p: any) => p.ready);
        window.updateDiscordActivity(
          `Lobby: ${roomName}`,
          isHost
            ? `Host // ${playerCount}/2 Players ${allReady ? '// All Ready!' : ''}`
            : `Waiting // ${playerCount}/2 Players`
        );
      } else if (appState === 'GAME') {
        const phase = spGame.gameState.phase;

        if (phase === 'GAME_OVER') {
          // Show win/loss result
          const playerWon = spGame.gameState.winner === 'PLAYER';
          if (spGame.gameState.isMultiplayer && mp.room) {
            const roomObj = mp.room as any;
            const opponent = roomObj.players?.find((p: any) => p.id !== mp.playerId);
            const opponentName = opponent?.name || "Opponent";
            window.updateDiscordActivity(
              playerWon ? "🏆 Victory!" : "💀 Defeated",
              `VS ${opponentName} // ${playerWon ? 'Survived the game' : 'Fell in battle'}`
            );
          } else {
            const round = spGame.gameState.isHardMode
              ? (spGame.gameState.hardModeState?.round || 1)
              : (spGame.gameState.normalModeState?.round || 1);
            const modeText = spGame.gameState.isHardMode ? "Hard Mode" : "Normal";
            window.updateDiscordActivity(
              playerWon ? "🏆 Defeated the Dealer" : "💀 The Dealer Won",
              `${modeText} // Round ${round}`
            );
          }
        } else if (spGame.gameState.isMultiplayer && mp.room) {
          // Multiplayer in-game
          const roomObj = mp.room as any;
          const opponent = roomObj.players?.find((p: any) => p.id !== mp.playerId);
          const opponentName = opponent?.name || "Opponent";
          const hp = spGame.player.hp;
          const maxHp = spGame.player.maxHp;
          const isMyTurn = spGame.gameState.turnOwner === 'PLAYER';
          const shellsLeft = spGame.gameState.chamber.length - spGame.gameState.currentShellIndex;
          const roundState = spGame.gameState.multiModeState;
          const scoreText = roundState ? `${roundState.playerWins}-${roundState.opponentWins}` : '';

          window.updateDiscordActivity(
            `VS ${opponentName} ${scoreText ? `(${scoreText})` : ''}`,
            `${isMyTurn ? '🔫 My Turn' : '⏳ Opponent\'s Turn'} // HP: ${hp}/${maxHp} // ${shellsLeft} shells left`
          );
        } else {
          // Singleplayer in-game
          const round = spGame.gameState.isHardMode
            ? (spGame.gameState.hardModeState?.round || 1)
            : (spGame.gameState.normalModeState?.round || 1);
          const hp = spGame.player.hp;
          const maxHp = spGame.player.maxHp;
          const modeText = spGame.gameState.isHardMode ? "Hard Mode" : "Normal";
          const isMyTurn = spGame.gameState.turnOwner === 'PLAYER';
          const shellsLeft = spGame.gameState.chamber.length - spGame.gameState.currentShellIndex;
          const hardState = spGame.gameState.hardModeState;
          const normalState = spGame.gameState.normalModeState;
          const scoreText = hardState 
            ? ` (${hardState.playerWins}-${hardState.dealerWins})` 
            : (normalState ? ` (${normalState.playerWins}-${normalState.dealerWins})` : '');

          window.updateDiscordActivity(
            `${modeText} — Round ${round}${scoreText}`,
            `${isMyTurn ? '🔫 My Turn' : '⏳ Dealer\'s Turn'} // HP: ${hp}/${maxHp} // ${shellsLeft} shells`
          );
        }
      } else if (appState === 'LOADING_MP') {
        window.updateDiscordActivity("Connecting...", "Establishing multiplayer link...");
      } else if (appState === 'LOADING_SP' || appState === 'LOADING_GAME') {
        window.updateDiscordActivity("Loading Match", "Preparing the chamber...");
      }
    } catch (err) {
      console.error("[Discord RPC] Error updating status:", err);
    }
  }, [
    appState,
    mp.room,
    mp.playerId,
    spGame.gameState.roundCount,
    spGame.gameState.hardModeState?.round,
    spGame.gameState.hardModeState?.playerWins,
    spGame.gameState.hardModeState?.dealerWins,
    spGame.gameState.multiModeState?.playerWins,
    spGame.gameState.multiModeState?.opponentWins,
    spGame.player.hp,
    spGame.player.maxHp,
    spGame.gameState.isHardMode,
    spGame.gameState.isMultiplayer,
    spGame.gameState.phase,
    spGame.gameState.turnOwner,
    spGame.gameState.winner,
    spGame.gameState.currentShellIndex
  ]);

  // handleMainMenu is aliased to handleBackToMenu for consistency
  const handleMainMenu = handleBackToMenu;

  const handleRestartSP = () => {
    setAppState('LOADING_SP');
    spGame.resetGame(false, false);
  };

  return (
    <div
      className={`relative w-full h-[100dvh] bg-black overflow-hidden select-none crt text-stone-200 cursor-crosshair animate-in fade-in duration-1000 ${spGame.gameState.isHardMode ? 'hardmode-scanline' : ''} ${settings.ultraPerformance ? 'ultra-perf' : ''}`}
      style={{ height: '100dvh' }}
      onClick={() => audioManager.initialize()}
      onKeyDown={() => audioManager.initialize()}
    >
      {!settings.ultraPerformance && appState !== 'MP_SELECTION' && appState !== 'LOBBY' && appState !== 'LOADING_MP' && (
        <>
          <div className="crt-overlay opacity-[0.15] pointer-events-none" />
          <div className="vhs-static" />
        </>
      )}

      {spGame.gameState.isHardMode && (
        <div className="absolute inset-0 z-[60] pointer-events-none bg-red-900/[0.02] mix-blend-color-burn animate-pulse" />
      )}

      <div id="rotate-warning" className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center transition-opacity duration-500 ${showRotateWarning ? 'opacity-100 pointer-events-auto flex' : 'opacity-0 pointer-events-none'}`}>
        <div className="warning-card">
          <div className="relative">
            <RotateCw size={48} className="text-red-500 animate-[spin_3s_linear_infinite]" />
            <div className="absolute inset-0 blur-xl bg-red-500/20 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h1>ROTATE</h1>
            <p>ORIENTATION ERROR</p>
          </div>
          <div className="w-16 h-1 bg-gradient-to-r from-transparent via-red-900/50 to-transparent" />
        </div>
      </div>

      {(appState === 'GAME' || appState === 'LOADING_SP' || appState === 'LOADING_GAME') && (
        <ThreeScene
          isSawed={spGame.player.isSawedActive || spGame.dealer.isSawedActive}
          isChokeActive={spGame.player.isChokeActive || spGame.dealer.isChokeActive}
          isPlayerCuffed={spGame.player.isHandcuffed}
          knownShell={spGame.knownShell}
          onGunClick={() => { }}
          aimTarget={spGame.aimTarget}
          cameraView={spGame.cameraView}
          animState={spGame.animState}
          turnOwner={spGame.gameState.turnOwner}
          settings={settings}
          isHardMode={spGame.gameState.isHardMode}
          player={spGame.player}
          dealer={spGame.dealer}
          player3={spGame.player3}
          player4={spGame.player4}
          gameState={spGame.gameState}
          onCardClick={handleCardClick}
          onLowPerformance={(fps) => {
            if (sessionStorage.getItem('aadish_roulette_perf_warning_shown') === 'true') return;
            try {
              sessionStorage.setItem('aadish_roulette_perf_warning_shown', 'true');
            } catch (e) {
              console.warn("sessionStorage failed:", e);
            }
            setDetectedLowFps(Math.round(fps));
            setShowPerformancePopup(true);
          }}
          isPaused={false}
          onUpdateNameTags={setNameTags}
        />
      )}

      {/* UI Overlay */}
      <GameUI
        playerName={spGame.playerName}
        gameState={spGame.gameState}
        player={spGame.player}
        dealer={spGame.dealer}
        player3={spGame.player3}
        player4={spGame.player4}
        logs={spGame.logs}
        overlayText={spGame.overlayText}
        overlayColor={spGame.overlayColor}
        showBlood={spGame.showBlood}
        showFlash={spGame.showFlash}
        showFlashbang={spGame.showFlashbang}
        showLootOverlay={spGame.showLootOverlay}
        receivedItems={spGame.receivedItems as any}
        triggerHeal={spGame.animState.triggerHeal}
        triggerDrink={spGame.animState.triggerDrink}
        knownShell={spGame.knownShell}
        cameraView={spGame.cameraView}
        aimTarget={spGame.aimTarget}
        isProcessing={spGame.isProcessing}
        isRecovering={spGame.animState.playerHit || spGame.animState.playerRecovering || spGame.animState.dealerDropping || spGame.animState.dealerRecovering}
        settings={settings}
        onStartGame={handleStartSP}
        onResetGame={(toMenu) => {
          if (spGame.gameState.isMultiplayer) {
            if (toMenu) {
              mp.disconnect();
              spGame.resetGame(true);
              setAppState('MENU');
            } else {
              if (mp.room && mp.playerId === mp.room.hostId) {
                mp.resetRoomState(mp.room.id);
              }
            }
          } else {
            if (toMenu) {
              // @ts-ignore
              setAppState('LOADING_GAME');
              spGame.resetGame(true);
            } else {
              // @ts-ignore
              setAppState('LOADING_SP');
              spGame.resetGame(false, false);
            }
          }
        }}
        onFireShot={handleFireShot}
        onUseItem={handleUseItem}
        onHoverTarget={handleHoverTarget}
        onPickupGun={handlePickupGun}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenScoreboard={() => setIsScoreboardOpen(true)}
        onUpdateName={spGame.setPlayerName}
        onStealItem={handleStealItem}
        onBootComplete={handleBootComplete}
        matchData={
          spGame.gameState.isMultiplayer && mp.room
            ? {
                ...spGame.matchStats,
                isMultiplayer: true,
                mpPlayers: mp.room.players.map((p: any) => {
                  const isMe = p.id === mp.playerId;
                  const isHost = p.id === mp.room.hostId;
                  const activeOpponentId = mp.playerId === mp.room.hostId
                    ? (mp.room.players.find((pl: any) => pl.id !== mp.room.hostId)?.id || '')
                    : mp.room.hostId;
                  
                  let playerResult: 'WIN' | 'LOSS' | 'SPECTATED' = 'SPECTATED';
                  if (isMe) {
                    playerResult = spGame.gameState.winner === 'PLAYER' ? 'WIN' : 'LOSS';
                  } else if (p.id === activeOpponentId) {
                    playerResult = spGame.gameState.winner === 'PLAYER' ? 'LOSS' : 'WIN';
                  }
                  
                  return {
                    name: p.name,
                    id: p.id,
                    isHost,
                    isMe,
                    result: playerResult
                  };
                })
              }
            : spGame.matchStats
        }
        onStartMultiplayer={handleStartMP}
        isMultiplayer={spGame.gameState.isMultiplayer}
        messages={mp.messages}
        onSendMessage={(t) => mp.sendMessage(mp.room?.id || '', t)}
        mpGameState={mp.room}
        mpMyPlayerId={mp.playerId}
        stickers={stickersList}
      />

      {appState === 'LOBBY' && mp.room && (
        <div className="absolute inset-0 z-[110] flex flex-col bg-stone-950 overflow-hidden lobby-three-cols-container">
          <div className="w-full flex-1 flex flex-row gap-0 min-h-0 overflow-hidden">
            {/* Lobby View */}
            <div className="h-full min-h-0 flex lobby-main-view">
              <MultiplayerLobby
                room={mp.room}
                playerId={mp.playerId!}
                onUpdateSettings={(s) => mp.updateSettings(mp.room.id, s)}
                onReadyUp={(r) => mp.readyUp(mp.room.id, r)}
                onStartGame={handleStartMPGame}
                onKick={(targetPlayerId) => mp.kickPlayer(mp.room.id, targetPlayerId)}
                onBack={() => {
                  mp.disconnect();
                  setAppState('GAME');
                  spGame.resetGame(true);
                }}
              />
            </div>
            
            {/* Chat View */}
            <div className="h-full min-h-0 flex border-l border-stone-900 lobby-chat-view">
              <ChatBox
                messages={mp.messages}
                onSendMessage={(t) => mp.sendMessage(mp.room.id, t)}
                playerName={spGame.playerName}
                stickers={stickersList}
              />
            </div>
          </div>
        </div>
      )}

      {appState === 'MP_SELECTION' && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 md:p-10 animate-in fade-in duration-300 overflow-hidden">
          <MultiplayerSelection
            playerName={spGame.playerName}
            getActiveRooms={mp.getActiveRooms}
            onQuickJoin={() => mp.quickJoin(spGame.playerName)}
            onCreateRoom={() => mp.createRoom(spGame.playerName)}
            onJoinRoom={(code) => mp.joinRoom(code, spGame.playerName)}
            onBack={() => {
              mp.disconnect();
              setAppState('MENU');
            }}
            error={mp.error}
            clearError={mp.clearError}
            isConnecting={mp.isConnecting}
          />
        </div>
      )}

      {(appState === 'LOADING_SP' || appState === 'LOADING_GAME' || appState === 'LOADING_MP') && (
        <div className="absolute inset-0 z-[100]">
          <LoadingScreen
            onComplete={onLoadingComplete}
            text={appState === 'LOADING_GAME' ? "INITIALIZING TABLE..." : appState === 'LOADING_MP' ? (mp.connectionStatus || "CONNECTING TO SERVER...") : "LOADING..."}
            duration={appState === 'LOADING_GAME' ? 800 : appState === 'LOADING_MP' ? 800 : 1200}
            onBack={handleBackToMenu}
            error={appState === 'LOADING_MP' ? mp.error : null}
            onRetry={() => {
              if (appState === 'LOADING_MP') mp.connect();
            }}
            showClose={appState === 'LOADING_MP'}
            progress={appState === 'LOADING_GAME' ? audioManager.getAudioLoadingProgress() : undefined}
          />
        </div>
      )}

      {isScoreboardOpen && (
        <Scoreboard
          onClose={() => setIsScoreboardOpen(false)}
        />
      )}

      {isSettingsOpen && (
        <SettingsMenu
          settings={settings}
          onUpdateSettings={setSettings}
          onClose={() => setIsSettingsOpen(false)}
          onResetDefaults={handleResetSettings}
          isMultiplayer={spGame.gameState.isMultiplayer}
          showExitToMenu={true}
          onExitToMenu={() => {
            setIsSettingsOpen(false);
            if (!spGame.gameState.isMultiplayer && appState === 'GAME' && spGame.gameState.phase !== 'INTRO' && spGame.gameState.phase !== 'BOOT') {
              spGame.resetGame(true);
              setAppState('MENU');
            }
          }}
        />
      )}

      {/* Server Offline / Disconnected during match overlay */}
      {appState === 'GAME' && spGame.gameState.isMultiplayer && !mp.isConnected && (
        <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-stone-950 border-2 border-red-600/50 shadow-[0_0_50px_rgba(239,68,68,0.15)] rounded-2xl p-6 text-center space-y-6 relative overflow-hidden">
            {/* CRT scanlines effect */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-stone-950/20 via-transparent to-stone-950/20" />
            
            <div className="space-y-2">
              <div className="inline-flex items-center justify-center p-3 bg-red-950/30 border border-red-500/30 rounded-full text-red-500 animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-wifi-off">
                  <line x1="1" y1="1" x2="23" y2="23"/>
                  <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.5"/>
                  <path d="M5 12.5a10.94 10.94 0 0 1 5.83-2.84"/>
                  <path d="M12 5a18.9 18.9 0 0 1 7.72 2.22"/>
                  <path d="M4.28 7.22A18.95 18.95 0 0 1 12 5"/>
                </svg>
              </div>
              <h2 className="text-lg font-black text-red-500 tracking-[0.2em] uppercase">LINK DISCONNECTED</h2>
              <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest leading-relaxed">
                THE CORRIDOR CONNECTION WAS TERMINATED. SERVER IS OFFLINE OR YOUR CONNECTION FAILED.
              </p>
            </div>

            <button
              onClick={() => {
                audioManager.playSound('click');
                mp.disconnect();
                setAppState('MENU');
                spGame.resetGame(true);
              }}
              className="w-full bg-stone-900 hover:bg-stone-850 border border-stone-800 hover:border-red-500/50 rounded-xl py-3 text-[10px] font-black tracking-[0.25em] text-stone-400 hover:text-red-400 uppercase active:scale-95 transition-all duration-150 cursor-pointer shadow-lg"
            >
              RETURN TO DECK
            </button>
          </div>
        </div>
      )}

      {showPerformancePopup && (
        <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-stone-950 border-2 border-amber-600/50 shadow-[0_0_50px_rgba(245,158,11,0.15)] rounded-2xl p-6 text-center space-y-6 relative overflow-hidden">
            {/* CRT scanlines effect */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-stone-950/20 via-transparent to-stone-950/20" />
            
            <div className="space-y-2">
              <div className="inline-flex items-center justify-center p-3 bg-amber-950/30 border border-amber-500/30 rounded-full text-amber-500 animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-gauge">
                  <path d="m12 14 4-4"/>
                  <path d="M3.34 19a10 10 0 1 1 17.32 0"/>
                </svg>
              </div>
              <h2 className="text-lg font-black text-amber-500 tracking-[0.2em] uppercase">PERFORMANCE WARNING</h2>
              <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest leading-relaxed">
                {settings.ultraPerformance ? (
                  `SYSTEM DETECTED LOW FRAME RATE (${detectedLowFps} FPS) EVEN IN POTATO MODE. CONSIDER CLOSING OTHER APPS.`
                ) : settings.balancedPerformance ? (
                  `SYSTEM DETECTED LOW FRAME RATE (${detectedLowFps} FPS) WHILE IN BALANCED MODE. PLEASE SWITCH TO POTATO PROFILE TO OPTIMIZE.`
                ) : (
                  `SYSTEM DETECTED LOW FRAME RATE (${detectedLowFps} FPS). ADJUST GRAPHICS PROFILE TO IMPROVE GAMEPLAY FLUIDITY.`
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {!settings.balancedPerformance && !settings.ultraPerformance && (
                <button
                  type="button"
                  onClick={() => {
                    setSettings((prev) => ({
                      ...prev,
                      ultraPerformance: false,
                      balancedPerformance: true,
                    }));
                    setShowPerformancePopup(false);
                  }}
                  className="w-full py-3 bg-amber-950/25 border border-amber-700/50 hover:bg-amber-900/40 text-amber-400 font-black text-[10px] sm:text-xs tracking-[0.2em] uppercase rounded-xl transition-all active:scale-[0.98] cursor-pointer"
                >
                  SWITCH TO BALANCED PROFILE
                </button>
              )}
              
              {!settings.ultraPerformance && (
                <button
                  type="button"
                  onClick={() => {
                    setSettings((prev) => ({
                      ...prev,
                      ultraPerformance: true,
                      balancedPerformance: false,
                    }));
                    setShowPerformancePopup(false);
                  }}
                  className="w-full py-3 bg-orange-950/25 border border-orange-700/50 hover:bg-orange-900/40 text-orange-400 font-black text-[10px] sm:text-xs tracking-[0.2em] uppercase rounded-xl transition-all active:scale-[0.98] cursor-pointer"
                >
                  SWITCH TO POTATO PROFILE
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowPerformancePopup(false)}
              className="px-6 py-2 border border-stone-800 text-stone-500 hover:text-white hover:bg-stone-900 font-black text-[9px] tracking-[0.2em] uppercase rounded-lg transition-all active:scale-95 cursor-pointer block mx-auto"
            >
              DISMISS
            </button>
          </div>
        </div>
      )}

      {settings.debugMode && appState === 'GAME' && spGame.gameState.phase !== 'BOOT' && spGame.gameState.phase !== 'INTRO' && (() => {
        if (!spGame.gameState.isMultiplayer) return true;
        try {
          const loggedInUser = localStorage.getItem('aadish_roulette_logged_in_user');
          if (loggedInUser) {
            const u = JSON.parse(loggedInUser);
            if (u.username?.toLowerCase() === (import.meta.env.VITE_DEV_USERNAME || 'aadish').toLowerCase()) {
              return true;
            }
          }
        } catch (e) {}
        return spGame.playerName.toLowerCase() === 'aadish';
      })() && (
        <DebugOverlay
          gameState={spGame.gameState}
          player={spGame.player}
          dealer={spGame.dealer}
          player3={spGame.player3}
          player4={spGame.player4}
          setPlayer={spGame.setPlayer}
          setDealer={spGame.setDealer}
          setPlayer3={spGame.setPlayer3}
          setPlayer4={spGame.setPlayer4}
          setGameState={spGame.setGameState}
          settings={settings}
          setSettings={setSettings}
          selectTarotCard={spGame.selectTarotCard}
          setCameraView={spGame.setCameraView}
          processItemEffect={spGame.processItemEffect}
          onSyncDebugState={(type, state) => {
            if (appState === 'GAME' && spGame.gameState.isMultiplayer) {
              if (type === 'MULTIPLAYER_MODEL') {
                // Use a non-persistent debug sync action so model overrides
                // do not become permanent room state after the match ends.
                mp.sendImmediateAction(mp.room.id, { type: 'DEBUG_SYNC_PLAYER_MODEL', playerId: state.playerId, modelKey: state.modelKey });
                return;
              }

              const playerCount = mp.room?.players?.length || 2;
              const isMulti = playerCount >= 3;
              if (isMulti) {
                // Key names match the receiver: playerState/dealerState/player3State/player4State
                mp.sendImmediateAction(mp.room.id, {
                  type: 'DEBUG_SYNC_THREE_PLAYER',
                  senderId: mp.playerId,
                  playerState: type === 'PLAYER' ? state : spGame.player,
                  dealerState: type === 'DEALER' ? state : spGame.dealer,
                  player3State: type === 'PLAYER3' ? state : spGame.player3,
                  player4State: type === 'PLAYER4' ? state : spGame.player4,
                  gameState: type === 'GAMESTATE' ? state : spGame.gameState
                });
              } else {
                if (type === 'PLAYER') {
                  mp.sendImmediateAction(mp.room.id, { type: 'DEBUG_SYNC_PLAYER', player: state });
                } else if (type === 'DEALER') {
                  mp.sendImmediateAction(mp.room.id, { type: 'DEBUG_SYNC_DEALER', dealer: state });
                } else if (type === 'GAMESTATE') {
                  mp.sendImmediateAction(mp.room.id, { type: 'DEBUG_SYNC_GAMESTATE', gameState: state });
                }
              }
            }
          }}
        />
      )}

      {abortedByName && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-stone-950 border-2 border-red-800/80 shadow-[0_0_50px_rgba(239,68,68,0.25)] rounded-2xl p-6 text-center space-y-6 relative overflow-hidden">
            {/* Scanlines visual */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-stone-950/20 via-transparent to-stone-950/20" />
            
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center p-3 bg-red-950/30 border border-red-500/30 rounded-full text-red-500 animate-bounce">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user-x">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <line x1="17" x2="22" y1="8" y2="13"/>
                  <line x1="22" x2="17" y1="8" y2="13"/>
                </svg>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-red-500 tracking-[0.2em] uppercase">CONNECTION TERMINATED</h2>
              <p className="text-xs sm:text-sm text-stone-400 font-bold uppercase tracking-wider leading-relaxed">
                {abortedByName.toUpperCase()} has left the bunker. The current match has been aborted.
              </p>
            </div>
            
            <button
              onClick={() => {
                audioManager.playSound('click');
                setAbortedByName(null);
                spGame.resetGame(true);
                setAppState('LOBBY');
              }}
              className="w-full py-3 bg-red-900/20 hover:bg-red-900 border border-red-800 text-red-500 hover:text-white font-black text-xs sm:text-sm tracking-[0.35em] uppercase rounded-xl transition-all active:scale-95 cursor-pointer shadow-lg shadow-red-950/50"
            >
              Return to Lobby
            </button>
          </div>
        </div>
      )}

      {/* Tutorial Guide Modal */}
      {isGuideOpen && (
        <TutorialGuide onClose={() => setIsGuideOpen(false)} />
      )}

      {/* Crisp HTML Player Name Tags (Multiplayer only) */}
      {appState === 'GAME' && spGame.gameState.isMultiplayer && nameTags.map((tag, i) => (
        tag.visible && (
          <div
            key={i}
            className={`absolute z-[40] pointer-events-none -translate-x-1/2 -translate-y-1/2 bg-black/80 border border-stone-800/80 ${isMobileNameTag ? 'px-2 py-0.5 text-[7px] sm:text-[8px]' : 'px-2.5 py-1 text-[8px] sm:text-[9px]'} font-black tracking-[0.25em] text-stone-200 uppercase rounded-lg shadow-2xl select-none transition-opacity duration-150`}
            style={{ left: `${tag.x}%`, top: `${tag.y}%` }}
          >
            {tag.name}
          </div>
        )
      ))}
    </div>
  );
}
