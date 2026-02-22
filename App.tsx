import React, { useState, useEffect, useCallback } from 'react';
import { RotateCw } from 'lucide-react';
import { ThreeScene } from './components/ThreeScene';
import { GameUI } from './components/GameUI';
import { useGameLogic } from './hooks/useGameLogic';
import { useDealerAI } from './hooks/useDealerAI';
import { SettingsMenu } from './components/SettingsMenu';
import { GameSettings } from './types';
import { DEFAULT_SETTINGS } from './constants';

import { LoadingScreen } from './components/LoadingScreen';
import { TutorialGuide } from './components/TutorialGuide';
import { Scoreboard } from './components/ui/Scoreboard';
import { audioManager } from './utils/audioManager';
import { useMultiplayer } from './hooks/useMultiplayer';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { ChatBox } from './components/ChatBox';
import { generateLootBatch } from './utils/game/inventory';
import { randomInt, throttle } from './utils/gameUtils';
import { ShellType, ItemType } from './types';

type AppState = 'MENU' | 'LOADING_SP' | 'LOADING_GAME' | 'GAME';

export default function App() {
  const spGame = useGameLogic();
  const mp = useMultiplayer();
  const [appState, setAppState] = useState<AppState>('MENU');

  // Try to initialize audio ASAP (will only succeed if browser allows)
  useEffect(() => {
    audioManager.initialize().then(() => {
      // If successful, ensure menu music starts immediately without waiting for state update cycle
      audioManager.playMusic('menu');
    }).catch(() => { });
  }, []);

  // --- ORIENTATION CHECK ---
  const [showRotateWarning, setShowRotateWarning] = useState(false);

  useEffect(() => {
    const checkOrientation = throttle(() => {
      let isPortrait = false;
      if (window.matchMedia) {
        isPortrait = window.matchMedia("(orientation: portrait)").matches;
      } else {
        isPortrait = window.innerHeight > window.innerWidth;
      }
      const isMobile = window.innerWidth < 950;
      setShowRotateWarning(isPortrait && isMobile);
    }, 200);

    setTimeout(checkOrientation, 100);

    window.addEventListener('resize', checkOrientation);
    if (window.matchMedia) {
      window.matchMedia("(orientation: portrait)").addEventListener("change", checkOrientation);
    }

    return () => {
      window.removeEventListener('resize', checkOrientation);
      if (window.matchMedia) {
        window.matchMedia("(orientation: portrait)").removeEventListener("change", checkOrientation);
      }
    };
  }, []);

  // For loot overlay
  const effectiveShowLootOverlay = spGame.showLootOverlay;
  const effectiveReceivedItems = spGame.receivedItems as import('./types').ItemType[];

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isScoreboardOpen, setIsScoreboardOpen] = useState(false);

  const [settings, setSettings] = useState<GameSettings>(() => {
    const saved = localStorage.getItem('aadish_roulette_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
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
    setIsProcessing: spGame.setIsProcessing
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
    // @ts-ignore
    setAppState('LOADING_MP');
    mp.connect();
  };

  // Broadcast local actions to server
  const handleFireShot = async (target: 'PLAYER' | 'DEALER') => {
    if (appState === 'GAME' && spGame.gameState.isMultiplayer) {
      if (spGame.gameState.turnOwner !== 'PLAYER') return;
      mp.sendAction(mp.room.id, { type: 'SHOOT', shooter: 'PLAYER', target });
    }
    await spGame.fireShot('PLAYER', target);
  };

  const handleUseItem = async (index: number) => {
    if (appState === 'GAME' && spGame.gameState.isMultiplayer) {
      if (spGame.gameState.turnOwner !== 'PLAYER') return;
      const item = spGame.player.items[index];
      mp.sendAction(mp.room.id, { type: 'USE_ITEM', item, index });
    }
    await spGame.usePlayerItem(index);
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

  const nextHoverRef = React.useRef(0);
  const handleHoverTarget = (target: any) => {
    const now = Date.now();
    if (appState === 'GAME' && spGame.gameState.isMultiplayer) {
      if (now > nextHoverRef.current) {
        mp.sendAction(mp.room.id, { type: 'HOVER_TARGET', target });
        nextHoverRef.current = now + 100; // 10hz throttle
      }
    }
    spGame.setAimTarget(target);
  };

  // Listen for remote actions
  useEffect(() => {
    if (appState === 'GAME' && spGame.gameState.isMultiplayer) {
      mp.setOnAction(({ playerId, action }) => {
        // Only process actions from OTHER players
        if (playerId !== mp.playerId) {
          console.log('Received remote action:', action);

          switch (action.type) {
            case 'SHOOT':
              spGame.fireShot('DEALER', action.target === 'PLAYER' ? 'DEALER' : 'PLAYER');
              break;
            case 'USE_ITEM':
              spGame.processItemEffect('DEALER', action.item);
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
              // @ts-ignore
              spGame.startRound(false, false, undefined, action.chamber, pItems, dItems);
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
    // @ts-ignore
    if (appState === 'LOADING_MP' || appState === 'LOBBY') {
      if (mp.isConnected) {
        if (appState === 'LOADING_MP') {
          mp.joinRoom('DEFAULT_ROOM', spGame.playerName);
          // @ts-ignore
          setAppState('LOBBY');
        }

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
          // @ts-ignore
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

        return () => {
          mp.socket?.off('gameStarted');
        };
      }
    }
  }, [mp.isConnected, appState, mp.joinRoom, spGame.playerName, mp.socket]);

  const handleStartMPGame = () => {
    if (mp.room && mp.playerId === mp.room.hostId) {
      const settings = mp.room.settings || { rounds: 3, hp: 2, itemsPerShipment: 2 };

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

      const hostItems = generateLootBatch(settings.itemsPerShipment, false, false, 4);
      const clientItems = generateLootBatch(settings.itemsPerShipment, false, false, 4);

      const gameData = {
        chamber,
        hostItems,
        clientItems,
        hostStarts: true,
        hpOverride: settings.hp
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

          const hostItems = generateLootBatch(settings.itemsPerShipment, false, false, 4);
          const clientItems = generateLootBatch(settings.itemsPerShipment, false, false, 4);

          const syncAction = {
            type: 'SYNC_ROUND',
            chamber,
            hostItems,
            clientItems
          };

          mp.sendAction(mp.room.id, syncAction);
          // System message for chat
          mp.sendMessage(mp.room.id, `SYSTEM: NEW BATCH REPLENISHED - ${lives} LIVE, ${blanks} BLANK`);
          // Host also applies it locally
          spGame.setOverlayText('RELOADING NEW BATCH...');
          spGame.startRound(false, false, undefined, chamber, hostItems, clientItems, 'PLAYER');
        } else {
          console.log("Batch end detected (CLIENT) - Waiting for host sync...");
          spGame.setOverlayText('WAITING FOR HOST...');
        }
      });
    }
  }, [spGame.gameState.isMultiplayer, mp.room, mp.playerId, spGame]);

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
      // Throttle/Condition: Only sync when not in the middle of a vital animation
      if (!spGame.isProcessing && spGame.gameState.phase !== 'RESOLVING') {
        mp.sendAction(mp.room.id, {
          type: 'SYNC_STATE',
          playerState: spGame.player,
          dealerState: spGame.dealer,
          gameState: spGame.gameState
        });
      }
    }
  }, [spGame.player.hp, spGame.dealer.hp, spGame.gameState.phase, spGame.isProcessing, spGame.player.items.length, spGame.dealer.items.length]);

  const handleMainMenu = () => {
    setAppState('GAME');
    spGame.resetGame(true);
  };

  const handleRestartSP = () => {
    setAppState('LOADING_SP');
    spGame.resetGame(false);
  };

  return (
    <div
      className={`relative w-full h-screen bg-black overflow-hidden select-none crt text-stone-200 cursor-crosshair animate-in fade-in duration-1000 ${spGame.gameState.isHardMode ? 'hardmode-scanline' : ''}`}
      onClick={() => audioManager.initialize()}
      onKeyDown={() => audioManager.initialize()}
    >
      <div className="crt-overlay opacity-[0.15] pointer-events-none" />
      <div className="vhs-static" />

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
          if (toMenu) {
            // @ts-ignore
            setAppState('LOADING_GAME');
            setTimeout(() => {
              handleMainMenu();
            }, 100);
          } else {
            // @ts-ignore
            setAppState('LOADING_SP');
            spGame.resetGame(false);
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
        matchData={spGame.matchStats}
        onStartMultiplayer={handleStartMP}
        isMultiplayer={spGame.gameState.isMultiplayer}
        messages={mp.messages}
        onSendMessage={(t) => mp.sendMessage(mp.room?.id || '', t)}
      />

      {/* @ts-ignore */}
      {appState === 'LOBBY' && mp.room && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/80 p-10">
          <div className="w-full max-w-5xl h-[80vh] flex gap-4">
            <div className="flex-1">
              <MultiplayerLobby
                room={mp.room}
                playerId={mp.playerId!}
                onUpdateSettings={(s) => mp.updateSettings(mp.room.id, s)}
                onReadyUp={(r) => mp.readyUp(mp.room.id, r)}
                onStartGame={handleStartMPGame}
                onBack={() => {
                  mp.disconnect();
                  setAppState('MENU');
                }}
              />
            </div>
            <div className="w-80">
              <ChatBox
                messages={mp.messages}
                onSendMessage={(t) => mp.sendMessage(mp.room.id, t)}
                playerName={spGame.playerName}
              />
            </div>
          </div>
        </div>
      )}

      {/* @ts-ignore */}
      {(appState === 'LOADING_SP' || appState === 'LOADING_GAME' || appState === 'LOADING_MP') && (
        <div className="absolute inset-0 z-[100]">
          <LoadingScreen
            onComplete={onLoadingComplete}
            // @ts-ignore
            text={appState === 'LOADING_GAME' ? "INITIALIZING TABLE..." : appState === 'LOADING_MP' ? "CONNECTING TO SERVER..." : "LOADING..."}
            // @ts-ignore
            duration={appState === 'LOADING_GAME' ? 1200 : 800}
            onBack={handleBackToMenu}
            // @ts-ignore
            error={appState === 'LOADING_MP' ? mp.error : null}
            onRetry={() => {
              // @ts-ignore
              if (appState === 'LOADING_MP') mp.connect();
            }}
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
        />
      )}

      {isGuideOpen && (
        <TutorialGuide
          onClose={() => setIsGuideOpen(false)}
        />
      )}
    </div>
  );
}