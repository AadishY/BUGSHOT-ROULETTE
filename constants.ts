import { ItemType, GameSettings } from './types';

export const MAX_HP = 4;
export const MAX_ITEMS = 8;

export const ITEMS: ItemType[] = ['GLASS', 'BEER', 'CIGS', 'CUFFS', 'SAW', 'PHONE', 'INVERTER', 'ADRENALINE', 'CHOKE', 'REMOTE', 'BIG_INVERTER', 'CONTRACT', 'LUCKYCHARM', 'FLASHBANG', 'CRUSHER', 'TOTEM', 'MIRROR', 'DECK_CARD', 'JACKPOT'];

export const ITEM_DESCRIPTIONS: Record<ItemType, string> = {
  'GLASS': 'BREAK TO REVEAL CURRENT SHELL',
  'BEER': 'RACK THE SHOTGUN (EJECT SHELL)',
  'CIGS': 'RECOVER 1 HEALTH POINT',
  'CUFFS': 'SKIP DEALERS NEXT TURN',
  'SAW': 'DOUBLE DAMAGE (CURRENT TURN)',
  'PHONE': 'REVEAL A FUTURE SHELL',
  'INVERTER': 'SWITCH CURRENT SHELL (LIVE <-> BLANK)',
  'ADRENALINE': 'STEAL AND USE OPPONENT ITEM',
  'CHOKE': 'FIRE 2 SHELLS AT ONCE',
  'REMOTE': 'CYCLE CHAMBER (SWAP CURRENT & NEXT)',
  'BIG_INVERTER': 'INVERT POLARITY OF ALL SHELLS',
  'CONTRACT': 'SACRIFICE 1HP FOR 2 ITEMS',
  'LUCKYCHARM': 'BOOSTS NEXT SHIPMENT ITEMS LUCK',
  'FLASHBANG': 'PREVENTS OPPONENT ITEM USAGE ON NEXT TURN',
  'CRUSHER': 'DESTROY 1 RANDOM ITEM FROM OPPONENTS INVENTORY',
  'TOTEM': '[PASSIVE] SURVIVE AT 1 HP ON LETHAL DAMAGE',
  'MIRROR': 'COPY ALL ITEM EFFECTS USED BY OPPONENT ON PREVIOUS TURN',
  'DECK_CARD': 'DRAW 1 OF 6 TAROT CARDS FOR ACTIVE & PASSIVE EFFECTS',
  'JACKPOT': 'SPIN THE SLOT MACHINE FOR BULLET IMMUNITY (UP TO 3 SHOTS)'
};

const getInitialSettings = (): GameSettings => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
  const isAndroid = ua.includes('android');
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
  
  if (isAndroid || isMobile) {
    return {
      pixelScale: 3.5,
      brightness: 1.0,
      uiScale: 0.60,
      fov: 60,
      musicVolume: 0.5,
      sfxVolume: 0.5,
      debugMode: false,
      ultraPerformance: false,
      balancedPerformance: true
    };
  } else {
    // PC
    return {
      pixelScale: 3.0,
      brightness: 1.0,
      uiScale: 0.8,
      fov: 60,
      musicVolume: 0.5,
      sfxVolume: 1.0,
      debugMode: false,
      ultraPerformance: false,
      balancedPerformance: false
    };
  }
};

export const DEFAULT_SETTINGS: GameSettings = getInitialSettings();

export const GAME_VERSION = '1.2.0';

