
export interface TarotCard {
  name: 'The Magician' | 'The Hanged Man' | 'The Hermit' | 'The Moon' | 'Judgment' | 'Wheel of Fortune' | 'The Sun' | 'Death' | 'The Tower' | 'The Fool' | 'Justice' | 'Temperance';
  power: string;
}

export type ItemType = 'GLASS' | 'BEER' | 'CIGS' | 'CUFFS' | 'SAW' | 'PHONE' | 'INVERTER' | 'ADRENALINE' | 'CHOKE' | 'REMOTE' | 'BIG_INVERTER' | 'CONTRACT' | 'LUCKYCHARM' | 'FLASHBANG' | 'CRUSHER' | 'TOTEM' | 'MIRROR' | 'DECK_CARD' | 'JACKPOT';
export type ShellType = 'LIVE' | 'BLANK';
export type TurnOwner = 'PLAYER' | 'DEALER' | 'PLAYER3' | 'PLAYER4';
export type CameraView = 'PLAYER' | 'DEALER' | 'GUN' | 'TABLE' | 'STEAL_UI' | 'DEALER_GUN' | 'PLAYER3_GUN' | 'PLAYER4_GUN';
export type AimTarget = 'OPPONENT' | 'SELF' | 'IDLE' | 'CHOOSING' | 'LEFT' | 'RIGHT';
export type PlayerModelKey = 'DEFAULT' | 'YASH' | 'YUVRAJ' | 'ASP' | 'AADISH';

export interface GameState {
  phase: 'BOOT' | 'INTRO' | 'LOAD' | 'PLAYER_TURN' | 'DEALER_TURN' | 'PLAYER3_TURN' | 'PLAYER4_TURN' | 'RESOLVING' | 'GAME_OVER' | 'LOOTING' | 'STEALING' | 'CARD_SELECT';

  turnOwner: TurnOwner;
  winner: TurnOwner | null;
  chamber: ShellType[];
  currentShellIndex: number;
  liveCount: number;
  blankCount: number;
  lastTurnWasSkipped?: boolean;
  roundCount: number;
  isHardMode: boolean;
  isMultiplayer?: boolean;
  isThreePlayer?: boolean;
  isFourPlayer?: boolean;
  opponentName?: string;
  localPlayerId?: string;
  multiplayerState?: MultiplayerGameState;
  hardModeState?: {
    round: number;
    playerWins: number;
    dealerWins: number;
  };
  normalModeState?: {
    round: number;
    playerWins: number;
    dealerWins: number;
  };
  roomSettings?: RoomSettings;
  multiModeState?: {
    playerWins: number;
    opponentWins: number;
  };
  isDebugUsed?: boolean; // Added
  deckCards?: TarotCard[]; // Selected 6 cards
  selectedCardIndex?: number | null; // Chosen card index
  adrenalineTargetOwner?: TurnOwner;
  winnerId?: string;
  threePlayerWins?: number[];
  fourPlayerWins?: number[];
}

export interface MultiplayerGameState {
  players: MultiplayerPlayer[];
  hostId: string;
  roomId: string;
  settings: RoomSettings;
  turnIndex: number; // For 4-player scalability
  debugPlayerModels?: Record<string, PlayerModelKey>;
}

export interface MultiplayerPlayer extends PlayerState {
  id: string;
  name: string;
  color: string;
  ready: boolean;
  model?: PlayerModelKey;
}

export interface RoomSettings {
  rounds: number;
  hp: number;
  itemsPerShipment: number;
  isAdvanced?: boolean;
  itemWeights?: Record<string, number>;
  isPrivate?: boolean;
}

export interface ChatMessage {
  sender: string;
  color: string;
  text: string;
  timestamp: number;
}

export type AppState = 'MENU' | 'LOADING_SP' | 'LOADING_MP' | 'LOADING_GAME' | 'LOBBY' | 'GAME';

export interface PlayerState {
  hp: number;
  maxHp: number;
  items: ItemType[];
  isHandcuffed: boolean;
  isSawedActive: boolean;
  isAdrenalineActive?: boolean; // Added
  isChokeActive?: boolean; // Added for Choke
  luckycharmsUsed?: number; // Added
  isFlashbanged?: boolean; // Added
  lastTurnItemsUsed?: ItemType[];
  currentTurnItemsUsed?: ItemType[];
  jackpotImmunityShots?: number;
  hasJackpotWinActive?: boolean;
}

export interface LogEntry {
  id: number;
  text: string;
  type: 'neutral' | 'danger' | 'safe' | 'info' | 'dealer';
}

export interface AnimationState {
  triggerRecoil: number;
  triggerRack: number;
  triggerSparks: number; // Saw
  triggerHeal: number; // Cigs
  triggerDrink: number; // Beer
  triggerCuff: number; // Cuffs
  triggerGlass: number; // Glass
  triggerPhone: number; // Phone
  triggerInverter: number; // Inverter
  triggerAdrenaline: number; // Adrenaline
  triggerChoke: number; // Choke
  triggerRemote: number; // Remote
  triggerBigInverter: number; // Big Inverter
  triggerContract: number; // Blood Contract
  triggerLuckycharm: number; // Luckycharm
  triggerFlashbang: number; // Flashbang
  triggerCrusher: number; // Crusher
  triggerTotem: number; // Totem
  triggerMirror: number; // Mirror
  triggerDeckCard: number; // DeckCard
  triggerJackpot: number; // Jackpot
  jackpotResult?: 'JACKPOT' | 'NORMAL' | 'LOSE' | null;
  totemTarget?: TurnOwner | null; // Totem target
  isSawing: boolean; // Continuous saw state
  ejectedShellColor: 'red' | 'blue' | 'red+red' | 'red+blue' | 'blue+red' | 'blue+blue';
  muzzleFlashIntensity: number;
  isLiveShot: boolean;
  dealerHit: boolean;
  dealerDropping: boolean;
  playerHit: boolean;
  playerRecovering: boolean; // Player is standing back up after being knocked
  dealerRecovering: boolean; // Dealer is standing back up after being knocked
  player3Hit?: boolean;
  player3Dropping?: boolean;
  player3Recovering?: boolean;
  player4Hit?: boolean;
  player4Dropping?: boolean;
  player4Recovering?: boolean;
}

export interface GameSettings {
  pixelScale: number;
  brightness: number;
  uiScale: number;
  fov: number;
  musicVolume: number;
  sfxVolume: number;
  debugMode?: boolean;
  debugHeadModel?: PlayerModelKey;
  debugPlayerModels?: {
    DEALER?: PlayerModelKey;
    PLAYER3?: PlayerModelKey;
    PLAYER4?: PlayerModelKey;
  };
  ultraPerformance?: boolean;
  balancedPerformance?: boolean;
}

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  gunGroup: THREE.Group;
  muzzleFlash: THREE.Group;
  muzzleLight: THREE.PointLight;
  roomRedLight: THREE.PointLight;
  bulbLight: THREE.PointLight;
  gunLight: THREE.PointLight;
  bulletMesh: THREE.Mesh;
  dealerGroup: THREE.Group;
  shellCasing: THREE.Mesh;
  shellCasings?: THREE.Mesh[];
  shellVelocities?: THREE.Vector3[];
  nextShellIndex?: number;
  mouse: THREE.Vector2;
  raycaster: THREE.Raycaster;
  barrelMesh: THREE.Mesh;
  shortBarrelMesh?: THREE.Mesh;
  sawCut?: THREE.Mesh | THREE.Group;
  pumpMesh: THREE.Mesh | THREE.Group;
  magTube: THREE.Mesh | THREE.Group;
  shortMagTube?: THREE.Mesh | THREE.Group;
  sight?: THREE.Mesh | THREE.Group;
  sSight?: THREE.Mesh | THREE.Group;
  chokeMesh?: THREE.Mesh | THREE.Group;
  bloodParticles: THREE.Points;
  sparkParticles: THREE.Points;
  dustParticles: THREE.Points | null;
  baseLights: { light: THREE.Light, baseIntensity: number }[];
  underLight?: THREE.PointLight;
  ejectedShells?: THREE.Group[]; // Pool of ejected shells on table
  itemsGroup?: {
    itemBeer: THREE.Group;
    itemCigs: THREE.Group;
    itemSaw: THREE.Group;
    itemCuffs: THREE.Group;
    itemGlass: THREE.Group;
    itemPhone: THREE.Group;
    itemInverter: THREE.Group;
    itemAdrenaline: THREE.Group;
    itemRemote: THREE.Group;
    itemBigInverter: THREE.Group;
    itemContract: THREE.Group;
    itemLuckycharm: THREE.Group;
    itemFlashbang: THREE.Group;
    itemCrusher: THREE.Group;
    itemTotem: THREE.Group;
    itemMirror: THREE.Group;
    itemJackpot: THREE.Group;
    itemLight: THREE.PointLight; // Light for illuminating items during animations
  };
  itemDeckCards?: THREE.Group[]; // Tarot card 3D models fanned on table
}

export interface SceneProps {
  isSawed: boolean;
  isChokeActive?: boolean; // Added
  aimTarget: AimTarget;
  cameraView: CameraView;
  animState: AnimationState;
  turnOwner: TurnOwner;
  isPlayerCuffed?: boolean;
  settings: GameSettings;
  knownShell: ShellType | null;
  isHardMode?: boolean;
  targetPlayerId?: string;
  gameState: GameState;
  player: PlayerState;
  dealer: PlayerState;
}

export interface ChokeResult {
  triggered: boolean;
  shell1: ShellType;
  shell2: ShellType;
  damage: number;
}
