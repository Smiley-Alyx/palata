import type { Difficulty } from './rayc';

export type GameConfig = {
  difficulty: Difficulty;
  audio: {
    musicEnabled: boolean;
    sfxEnabled: boolean;
    musicVolume: number;
    sfxVolume: number;
  };
  ui: {
    showFps: boolean;
  };
};

export type ControlHint = {
  key: string;
  action: string;
};

export const DEFAULT_GAME_CONFIG: GameConfig = {
  difficulty: 'lost',
  audio: {
    musicEnabled: true,
    sfxEnabled: true,
    musicVolume: 0.5,
    sfxVolume: 0.7,
  },
  ui: {
    showFps: true,
  },
};

export const CONTROL_HINTS: ControlHint[] = [
  { key: 'W/S', action: 'вперёд / назад' },
  { key: 'A/D', action: 'стрейф' },
  { key: 'Mouse / ←/→', action: 'поворот' },
  { key: 'Shift', action: 'спринт' },
  { key: 'E', action: 'открыть дверь' },
  { key: 'LMB / Space', action: 'выстрел / удар' },
  { key: '1/2/3', action: 'труба / пистолет / дробовик' },
  { key: 'Q', action: 'циклически переключать оружие' },
  { key: 'V', action: 'рывок (predator)' },
  { key: 'M', action: 'карта' },
  { key: 'F', action: 'fullscreen' },
  { key: 'Esc', action: 'меню' },
];

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

function isDifficulty(value: unknown): value is Difficulty {
  return value === 'lost' || value === 'trapped' || value === 'consumed';
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
      ui: {
        showFps:
          typeof parsed.ui?.showFps === 'boolean'
            ? parsed.ui.showFps
            : DEFAULT_GAME_CONFIG.ui.showFps,
      },
    };
  } catch {
    return structuredClone(DEFAULT_GAME_CONFIG);
  }
}

export function saveGameConfig(config: GameConfig) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
