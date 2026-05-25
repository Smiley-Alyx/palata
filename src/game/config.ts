import type { Difficulty } from './rayc';

export type GameConfig = {
  difficulty: Difficulty;
  audio: {
    musicEnabled: boolean;
    sfxEnabled: boolean;
    musicVolume: number;
    sfxVolume: number;
  };
  video: {
    lighting: number;
  };
  ui: {
    showFps: boolean;
  };
  controls: ControlBindings;
};

export type ControlHint = {
  key: string;
  action: string;
};

export type ControlAction =
  | 'moveForward'
  | 'moveBackward'
  | 'strafeLeft'
  | 'strafeRight'
  | 'turnLeft'
  | 'turnRight'
  | 'sneak'
  | 'use'
  | 'shoot'
  | 'weapon1'
  | 'weapon2'
  | 'weapon3'
  | 'weapon4'
  | 'cycleWeapon'
  | 'predatorDash'
  | 'toggleMap'
  | 'fullscreen'
  | 'menu';

export type ControlBindings = Record<ControlAction, string[]>;

export type ControlActionMeta = {
  id: ControlAction;
  action: string;
};

export const CONTROL_ACTIONS: ControlActionMeta[] = [
  { id: 'moveForward', action: 'вперёд' },
  { id: 'moveBackward', action: 'назад' },
  { id: 'strafeLeft', action: 'стрейф влево' },
  { id: 'strafeRight', action: 'стрейф вправо' },
  { id: 'turnLeft', action: 'поворот влево' },
  { id: 'turnRight', action: 'поворот вправо' },
  { id: 'sneak', action: 'подкрадываться' },
  { id: 'use', action: 'открыть дверь / взаимодействие' },
  { id: 'shoot', action: 'выстрел / удар' },
  { id: 'weapon1', action: 'скальпель' },
  { id: 'weapon2', action: 'труба' },
  { id: 'weapon3', action: 'пистолет' },
  { id: 'weapon4', action: 'дробовик' },
  { id: 'cycleWeapon', action: 'циклически переключать оружие' },
  { id: 'predatorDash', action: 'рывок (predator)' },
  { id: 'toggleMap', action: 'карта' },
  { id: 'fullscreen', action: 'fullscreen' },
  { id: 'menu', action: 'меню' },
];

export const DEFAULT_CONTROL_BINDINGS: ControlBindings = {
  moveForward: ['KeyW', 'ArrowUp'],
  moveBackward: ['KeyS', 'ArrowDown'],
  strafeLeft: ['KeyA'],
  strafeRight: ['KeyD'],
  turnLeft: ['ArrowLeft'],
  turnRight: ['ArrowRight'],
  sneak: ['ControlLeft', 'ControlRight'],
  use: ['KeyE'],
  shoot: ['Mouse0', 'Space'],
  weapon1: ['Digit1'],
  weapon2: ['Digit2'],
  weapon3: ['Digit3'],
  weapon4: ['Digit4'],
  cycleWeapon: ['KeyQ'],
  predatorDash: ['KeyV'],
  toggleMap: ['KeyM'],
  fullscreen: ['KeyF'],
  menu: ['Escape'],
};

export const DEFAULT_GAME_CONFIG: GameConfig = {
  difficulty: 'lost',
  audio: {
    musicEnabled: true,
    sfxEnabled: true,
    musicVolume: 0.5,
    sfxVolume: 0.7,
  },
  video: {
    lighting: 1.12,
  },
  ui: {
    showFps: true,
  },
  controls: structuredClone(DEFAULT_CONTROL_BINDINGS),
};

export const CONTROL_HINTS: ControlHint[] = getControlHints(DEFAULT_CONTROL_BINDINGS);

export const CREDITS = [
  'Game design, code, levels: Alya Zanoza',
  'Engine: custom TypeScript raycasting renderer',
  'Inspired by Wolfenstein 3D, DOOM, Blood',
];

const STORAGE_KEY = 'palata.config.v1';

function clamp01(value: unknown, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function clampRange(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function isDifficulty(value: unknown): value is Difficulty {
  return value === 'lost' || value === 'trapped' || value === 'consumed';
}

function normalizeControls(value: unknown): ControlBindings {
  const source = value && typeof value === 'object' ? (value as Partial<ControlBindings>) : {};
  const result = structuredClone(DEFAULT_CONTROL_BINDINGS);

  for (const action of CONTROL_ACTIONS) {
    const bindings = source[action.id];
    if (!Array.isArray(bindings)) continue;
    const normalized = bindings.filter((binding): binding is string => {
      return typeof binding === 'string' && binding.length > 0;
    });
    result[action.id] = normalized.length ? normalized : [...DEFAULT_CONTROL_BINDINGS[action.id]];
  }

  return result;
}

export function formatControlBinding(binding: string): string {
  if (binding === 'Mouse0') return 'LMB';
  if (binding === 'Mouse1') return 'MMB';
  if (binding === 'Mouse2') return 'RMB';

  const aliases: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Escape: 'Esc',
    Space: 'Space',
    ControlLeft: 'Left Ctrl',
    ControlRight: 'Right Ctrl',
  };

  if (aliases[binding]) return aliases[binding];
  if (/^Key[A-Z]$/.test(binding)) return binding.slice(3);
  if (/^Digit\d$/.test(binding)) return binding.slice(5);
  return binding;
}

export function getControlHints(controls: ControlBindings): ControlHint[] {
  return CONTROL_ACTIONS.map((meta) => ({
    key: controls[meta.id].map(formatControlBinding).join(' / '),
    action: meta.action,
  }));
}

export function loadGameConfig(): GameConfig {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_GAME_CONFIG);
    const parsed = JSON.parse(raw) as Partial<GameConfig>;

    return {
      difficulty: isDifficulty(parsed.difficulty)
        ? parsed.difficulty
        : DEFAULT_GAME_CONFIG.difficulty,
      audio: {
        musicEnabled:
          typeof parsed.audio?.musicEnabled === 'boolean'
            ? parsed.audio.musicEnabled
            : DEFAULT_GAME_CONFIG.audio.musicEnabled,
        sfxEnabled:
          typeof parsed.audio?.sfxEnabled === 'boolean'
            ? parsed.audio.sfxEnabled
            : DEFAULT_GAME_CONFIG.audio.sfxEnabled,
        musicVolume: clamp01(parsed.audio?.musicVolume, DEFAULT_GAME_CONFIG.audio.musicVolume),
        sfxVolume: clamp01(parsed.audio?.sfxVolume, DEFAULT_GAME_CONFIG.audio.sfxVolume),
      },
      video: {
        lighting: clampRange(parsed.video?.lighting, DEFAULT_GAME_CONFIG.video.lighting, 0.7, 1.4),
      },
      ui: {
        showFps:
          typeof parsed.ui?.showFps === 'boolean'
            ? parsed.ui.showFps
            : DEFAULT_GAME_CONFIG.ui.showFps,
      },
      controls: normalizeControls(parsed.controls),
    };
  } catch {
    return structuredClone(DEFAULT_GAME_CONFIG);
  }
}

export function saveGameConfig(config: GameConfig) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
