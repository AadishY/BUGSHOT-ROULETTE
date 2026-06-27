import React, { useState, useEffect, useCallback } from 'react';
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
import { generateLootBatch } from './utils/game/inventory';
import { randomInt } from './utils/gameUtils';
import { ShellType, ItemType } from './types';

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
        mp.connect();
      }
    }
  }, []);

  // --- ORIENTATION CHECK ---
  const [showRotateWarning, setShowRotateWarning] = useState(false);

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
    mp.connect();
  };

  // Broadcast local actions to server
  const handleFireShot = async (target: 'PLAYER' | 'DEALER') => {
    if (spGame.gameState.phase !== 'PLAYER_TURN' && spGame.gameState.phase !== 'DEALER_TURN' && spGame.gameState.phase !== 'RESOLVING') return;
    if (spGame.gameState.turnOwner !== 'PLAYER') return;
    if (spGame.isProcessing) return;

    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    const intendedAim = target === 'DEALER' ? 'OPPONENT' : 'SELF';

    // On mobile, the first tap only aims (points) the gun, and the second tap fires
    if (isMobile && spGame.aimTarget === 'CHOOSING') {
      spGame.setAimTarget(intendedAim);
      spGame.setCameraView('GUN');
      
      if (appState === 'GAME' && spGame.gameState.isMultiplayer) {
        mp.sendAction(mp.room.id, { type: 'HOVER_TARGET', target: intendedAim });
      }
      return;
    }

    if (appState === 'GAME' && spGame.gameState.isMultiplayer) {
      mp.sendAction(mp.room.id, { type: 'SHOOT', shooter: 'PLAYER', target });
    }
    await spGame.fireShot('PLAYER', target);
  };

  const handleUseItem = async (index: number) => {
    if (appState === 'GAME' && spGame.gameState.isMultiplayer) {
      if (spGame.gameState.turnOwner !== 'PLAYER') return;
      const item = spGame.player.items[index];
      
      let deckCards: string[] | undefined;
      let jackpotOutcome: 'JACKPOT' | 'NORMAL' | 'LOSE' | undefined;
      let crushIndex: number | undefined;
      let contractLoot: string[] | undefined;

      if (item === 'DECK_CARD') {
        const allTarotNames = [
          'The Magician', 'The Hanged Man', 'The Hermit', 'The Moon', 'Judgment',
          'Wheel of Fortune', 'The Sun', 'Death', 'The Tower', 'The Fool', 'Justice', 'Temperance'
        ];
        const shuffled = [...allTarotNames].sort(() => Math.random() - 0.5);
        deckCards = shuffled.slice(0, 6);
      } else if (item === 'JACKPOT') {
        const rand = Math.random();
        if (rand < 0.20) jackpotOutcome = 'JACKPOT';
        else if (rand < 0.50) jackpotOutcome = 'NORMAL';
        else jackpotOutcome = 'LOSE';
      } else if (item === 'CRUSHER') {
        if (spGame.dealer.items.length > 0) {
          crushIndex = Math.floor(Math.random() * spGame.dealer.items.length);
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
      }

      mp.sendAction(mp.room.id, {
        type: 'USE_ITEM',
        item,
        index,
        deckCards,
        jackpotOutcome,
        crushIndex,
        contractLoot
      });
      await spGame.usePlayerItem(index, deckCards, jackpotOutcome, crushIndex, contractLoot as any);
    } else {
      await spGame.usePlayerItem(index);
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
          cardRandoms.magicianItem = ITEMS[Math.floor(Math.random() * ITEMS.length)];
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

      mp.sendAction(mp.room.id, { type: 'SELECT_CARD', index, cardRandoms });
      await spGame.selectTarotCard(index, cardRandoms);
    } else {
      await spGame.selectTarotCard(index);
    }
  };

  const handlePickupGun = () => {
    if (appState === 'GAME' && spGame.gameState.isMultiplayer) {
      if (spGame.gameState.turnOwner !== 'PLAYER') return;
      mp.sendAction(mp.room.id, { type: 'PICKUP_GUN' });
    }
    spGame.pickupGun('PLAYER');
  };

  const handleStealItem = (index: number) => {
    if (appState === 'GAME' && spGame.gameState.isMultiplayer) {
      if (spGame.gameState.turnOwner !== 'PLAYER') return;
      mp.sendAction(mp.room.id, { type: 'STEAL_ITEM', index });
    }
    spGame.stealItem(index, 'PLAYER');
  };

  const handleHoverTarget = (target: any) => {
    if (appState === 'GAME' && spGame.gameState.isMultiplayer) {
      if (spGame.gameState.turnOwner === 'PLAYER') {
        mp.sendAction(mp.room.id, { type: 'HOVER_TARGET', target });
      }
    }
    spGame.setAimTarget(target);
  };

  // Listen for remote actions
  useEffect(() => {
    if (appState === 'GAME' && spGame.gameState.isMultiplayer) {
      mp.setOnAction(async ({ playerId, action }) => {
        // Only process actions from OTHER players
        if (playerId !== mp.playerId) {
          console.log('Received remote action:', action);

          switch (action.type) {
            case 'SHOOT':
              spGame.fireShot('DEALER', action.target === 'PLAYER' ? 'DEALER' : 'PLAYER');
              break;
            case 'USE_ITEM':
              spGame.setDealer(d => {
                const newItems = [...d.items];
                const idx = action.index !== undefined ? action.index : newItems.indexOf(action.item);
                if (idx !== -1) {
                  newItems.splice(idx, 1);
                }
                return { ...d, items: newItems };
              });
              await spGame.processItemEffect('DEALER', action.item, action.deckCards, action.jackpotOutcome, action.crushIndex, action.contractLoot);
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
            case 'HOVER_TARGET':
              spGame.setAimTarget(action.target);
              break;
            case 'SYNC_ROUND':
              const iAmHost = mp.playerId === (mp.room?.hostId || '');
              spGame.setOverlayText('RELOADING NEW BATCH...');
              const pItems = iAmHost ? action.hostItems : action.clientItems;
              const dItems = iAmHost ? action.clientItems : action.hostItems;
              const clientNextTurn = action.nextTurnOwner === 'PLAYER' ? 'DEALER' : 'PLAYER';
              // @ts-ignore
              spGame.startRound(false, false, undefined, action.chamber, pItems, dItems, clientNextTurn);
              break;
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
                player: action.dealerState, // Remote's dealer is our player
                dealer: action.playerState, // Remote's player is our dealer
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

        const opponent = room.players.find((p: any) => p.id !== mp.playerId);
        const opponentName = opponent ? opponent.name : 'OPPONENT';
        const iAmHost = mp.playerId === room.hostId;

        const chamberOverride = gameData.chamber;
        const pItemsOverride = iAmHost ? gameData.hostItems : gameData.clientItems;
        const dItemsOverride = iAmHost ? gameData.clientItems : gameData.hostItems;

        let initialTurnOwner: import('./types').TurnOwner = 'PLAYER';
        if (gameData.hostStarts) {
          initialTurnOwner = iAmHost ? 'PLAYER' : 'DEALER';
        } else {
          initialTurnOwner = iAmHost ? 'DEALER' : 'PLAYER';
        }

        // 1. Transition state FIRST to mount components
        setAppState('GAME');

        // 2. Delay game logic slightly to ensure UI is ready for messages/animations
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

    const itemsCount = settings.itemsPerShipment === 9 ? randomInt(1, 8) : settings.itemsPerShipment;
    const hostItems = generateLootBatch(itemsCount, false, false, 4, [], hostCharms, 4, 4, settings, playerCount);
    const clientItems = generateLootBatch(itemsCount, false, false, 4, [], clientCharms, 4, 4, settings, playerCount);

    return { chamber, hostItems, clientItems, lives, blanks };
  }, []);

  const handleStartMPGame = () => {
    if (mp.room && mp.playerId === mp.room.hostId) {
      const settings = mp.room.settings || { rounds: 3, hp: 2, itemsPerShipment: 2 };
      const playerCount = mp.room?.players?.length || 2;
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

      mp.startGame(mp.room.id, gameData);
    }
  };

  // Sync subsequent rounds
  useEffect(() => {
    if (spGame.gameState.isMultiplayer && mp.room) {
      spGame.setOnBatchEnd(() => {
        if (mp.playerId === mp.room.hostId) {
          console.log("Batch end detected (HOST) - Generating new batch...");
          const settings = mp.room.settings || { rounds: 3, hp: 2, itemsPerShipment: 2 };
          const playerCount = mp.room?.players?.length || 2;
          const hostCharms = spGame.player.luckycharmsUsed || 0;
          const clientCharms = spGame.dealer.luckycharmsUsed || 0;
          const { chamber, hostItems, clientItems, lives, blanks } = generateMPBatch(settings, playerCount, hostCharms, clientCharms);

          const lastWasHost = spGame.gameState.turnOwner === 'PLAYER';
          const nextStarts = !lastWasHost;
          const syncAction = {
            type: 'SYNC_ROUND',
            chamber,
            hostItems,
            clientItems,
            nextTurnOwner: nextStarts ? 'PLAYER' : 'DEALER'
          };

          mp.sendAction(mp.room.id, syncAction);
          mp.sendMessage(mp.room.id, `SYSTEM: NEW BATCH REPLENISHED - ${lives} LIVE, ${blanks} BLANK`);
          spGame.setOverlayText('RELOADING NEW BATCH...');
          spGame.startRound(false, false, undefined, chamber, hostItems, clientItems, nextStarts ? 'PLAYER' : 'DEALER');
        } else {
          console.log("Batch end detected (CLIENT) - Waiting for host sync...");
          spGame.setOverlayText('WAITING FOR HOST...');
        }
      });
    }
  }, [spGame.gameState.isMultiplayer, mp.room, mp.playerId, spGame, generateMPBatch]);

  const onLoadingComplete = () => {
    if (appState === 'LOADING_SP') {
      spGame.startGame(spGame.playerName, isHardModeSelected);
      setAppState('GAME');
    }
    if (appState === 'LOADING_GAME') {
      setAppState('GAME');
    }
  };

  const handleBackToMenu = () => {
    setAppState('GAME');
    spGame.resetGame(true);
  };

  // Sync state broadcast from host to stay in sync
  useEffect(() => {
    if (appState === 'GAME' && spGame.gameState.isMultiplayer && mp.room?.hostId === mp.playerId) {
      // Throttle/Condition: Only sync when not in the middle of a vital animation and not in GAME_OVER phase
      if (!spGame.isProcessing && spGame.gameState.phase !== 'RESOLVING' && spGame.gameState.phase !== 'GAME_OVER') {
        mp.sendAction(mp.room.id, {
          type: 'SYNC_STATE',
          playerState: spGame.player,
          dealerState: spGame.dealer,
          gameState: spGame.gameState
        });
      }
    }
  }, [spGame.player.hp, spGame.dealer.hp, spGame.gameState.phase, spGame.isProcessing, spGame.player.items.length, spGame.dealer.items.length]);

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
        isPaused={appState === 'MP_SELECTION' || appState === 'LOBBY' || appState === 'LOADING_MP'}
        onUpdateNameTags={setNameTags}
      />

      {/* UI Overlay */}
      <GameUI
        playerName={spGame.playerName}
        gameState={spGame.gameState}
        player={spGame.player}
        dealer={spGame.dealer}
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
          onExitToMenu={() => {
            setIsSettingsOpen(false);
            if (appState === 'GAME' && spGame.gameState.phase !== 'INTRO' && spGame.gameState.phase !== 'BOOT') {
              // @ts-ignore
              setAppState('LOADING_GAME');
              spGame.resetGame(true);
            }
          }}
          showExitToMenu={appState === 'GAME' && spGame.gameState.phase !== 'INTRO' && spGame.gameState.phase !== 'BOOT'}
        />
      )}

      {isGuideOpen && (
        <TutorialGuide
          onClose={() => setIsGuideOpen(false)}
        />
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
          setPlayer={spGame.setPlayer}
          setDealer={spGame.setDealer}
          setGameState={spGame.setGameState}
          selectTarotCard={spGame.selectTarotCard}
          setCameraView={spGame.setCameraView}
          processItemEffect={spGame.processItemEffect}
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

      {appState === 'GAME' && spGame.gameState.isMultiplayer && !mp.isConnected && (
        <div className="fixed inset-0 z-[400] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-stone-950 border border-stone-900 shadow-2xl rounded-2xl p-6 text-center space-y-6">
            <div className="inline-flex items-center justify-center p-3 bg-stone-900 border border-stone-800 rounded-full text-stone-400">
              <RotateCw className="animate-spin text-cyan-500" size={24} />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-black text-white tracking-[0.25em] uppercase">CONNECTION INTERRUPTED</h3>
              <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">
                Attempting to restore tunnel connection to server...
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Crisp HTML Player Name Tags (Multiplayer only) */}
      {appState === 'GAME' && spGame.gameState.isMultiplayer && nameTags.map((tag, i) => (
        tag.visible && (
          <div
            key={i}
            className="absolute z-[40] pointer-events-none -translate-x-1/2 -translate-y-1/2 bg-black/80 border border-stone-800/80 px-2.5 py-1 text-[8px] sm:text-[9px] font-black tracking-[0.25em] text-stone-200 uppercase rounded-lg shadow-2xl select-none transition-opacity duration-150"
            style={{ left: `${tag.x}%`, top: `${tag.y}%` }}
          >
            {tag.name}
          </div>
        )
      ))}
    </div>
  );
}