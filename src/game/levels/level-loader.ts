import type { Legend, Spawn } from '../../types/game';
import { assetUrl, loadJson } from '../content/content';

type LevelAudioConfig = {
  music?: {
    src: string;
    loop?: boolean;
    volume?: number;
  };
  sfx?: {
    doorOpen?: string;
    footstep?: string;
    shoot?: string;
  };
};

type LevelColorsConfig = {
  ceiling: string;
  floor: string;
};

type LevelJson = {
  id?: string;
  name?: string;
  legend?: Legend;
  audio?: unknown;
  colors?: unknown;
  rows: string[];
  spawn?: unknown;
};

type LevelsIndexJson = {
  levels: Array<{ id: string; file: string; name?: string; hidden?: boolean }>;
  default: string;
};

export async function loadLevel(levelUrl: string) {
  const data = await loadJson<LevelJson>(levelUrl);

  if (!data || !Array.isArray(data.rows) || data.rows.length === 0) {
    throw new Error('Invalid level format: missing rows');
  }

  let width = 0;
  for (let y = 0; y < data.rows.length; y++) {
    if (typeof data.rows[y] !== 'string') {
      throw new Error('Invalid level format: each row must be a string');
    }
    width = Math.max(width, data.rows[y].length);
  }
  const normalizedRows = data.rows.map((row: string) => row.padEnd(width, '0'));

  const grid = normalizedRows.map((row: string) => {
    const arr = new Array(row.length);
    for (let i = 0; i < row.length; i++) {
      const code = row.charCodeAt(i) - 48;
      if (code < 0 || code > 9) {
        throw new Error('Invalid cell value at row: only 0-9 supported for now');
      }
      arr[i] = code;
    }
    return arr;
  });

  let spawn: Spawn | null = null;
  if (data.spawn && typeof data.spawn === 'object') {
    const maybe = data.spawn as { x?: unknown; y?: unknown; rot?: unknown };
    if (typeof maybe.x === 'number' && typeof maybe.y === 'number') {
      spawn = {
        x: maybe.x,
        y: maybe.y,
        rot: typeof maybe.rot === 'number' ? maybe.rot : undefined,
      };
    }
  }

  let audio: LevelAudioConfig | undefined;
  if (data.audio && typeof data.audio === 'object') {
    const a = data.audio as {
      music?: unknown;
      sfx?: unknown;
    };

    const cfg: LevelAudioConfig = {};

    if (a.music && typeof a.music === 'object') {
      const m = a.music as { src?: unknown; loop?: unknown; volume?: unknown };
      if (typeof m.src === 'string') {
        cfg.music = {
          src: assetUrl(m.src),
          loop: typeof m.loop === 'boolean' ? m.loop : undefined,
          volume: typeof m.volume === 'number' ? m.volume : undefined,
        };
      }
    }

    if (a.sfx && typeof a.sfx === 'object') {
      const s = a.sfx as { doorOpen?: unknown; footstep?: unknown; shoot?: unknown };
      cfg.sfx = {
        doorOpen: typeof s.doorOpen === 'string' ? assetUrl(s.doorOpen) : undefined,
        footstep: typeof s.footstep === 'string' ? assetUrl(s.footstep) : undefined,
        shoot: typeof s.shoot === 'string' ? assetUrl(s.shoot) : undefined,
      };
    }

    if (cfg.music || cfg.sfx) audio = cfg;
  }

  const defaultColors: LevelColorsConfig = {
    ceiling: '#E3E3E1',
    floor: '#858585',
  };

  let colors: LevelColorsConfig = defaultColors;
  if (data.colors && typeof data.colors === 'object') {
    const c = data.colors as { ceiling?: unknown; floor?: unknown };
    colors = {
      ceiling: typeof c.ceiling === 'string' ? c.ceiling : defaultColors.ceiling,
      floor: typeof c.floor === 'string' ? c.floor : defaultColors.floor,
    };
  }

  return {
    id: data.id,
    name: data.name,
    legend: data.legend ?? {},
    grid,
    spawn,
    audio,
    colors,
  };
}

export async function loadLevelsIndex(indexUrl: string) {
  const data = await loadJson<LevelsIndexJson>(indexUrl);
  if (!data || !Array.isArray(data.levels) || typeof data.default !== 'string') {
    throw new Error('Invalid levels index format');
  }

  return data;
}
