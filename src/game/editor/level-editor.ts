import { ASSET_MANIFEST } from '../assets/manifest';
import { assetUrl } from '../content/content';
import { getAnimationDescriptorPath } from '../render/animations';

const LEVEL_SAVE_ROUTE = '/__palata/level-editor/save';

type LevelJson = Record<string, unknown> & {
  geometry?: unknown;
  rows?: unknown;
  spawn?: unknown;
  materialsWall?: unknown;
  entities?: unknown;
  lights?: unknown;
  triggers?: unknown;
  messagePools?: unknown;
};

type EditorTool =
  | 'cell'
  | 'spawn'
  | 'material'
  | 'entity'
  | 'light'
  | 'trigger'
  | 'erase'
  | 'fill'
  | 'inspect';

type TileTool = {
  value: number;
  label: string;
  hint: string;
  key: string;
};

type PaletteItem = {
  id: string;
  label: string;
  group: string;
  description?: string;
  preview?: string;
  create: (x: number, y: number) => Record<string, unknown>;
};

type LightMode = 'steady' | 'flicker' | 'emergency' | 'pulse' | 'organic';

type LightDraft = {
  radius: number;
  intensity: number;
  color: string;
  colorInfluence: number;
  mode: LightMode;
};

type TriggerDraft = {
  sound: string;
  volume: number;
  once: boolean;
};

type NoteDraft = {
  title: string;
  text: string;
};

type EditorMessage = {
  title: string;
  text: string;
  isDocument?: boolean;
};

type EditorMessagePools = Record<string, EditorMessage[]>;

type EditorSnapshot = {
  grid: number[][];
  materials: string[][];
  spawn: { x: number; y: number; rot: number };
  entities: Record<string, unknown>[];
  lights: Record<string, unknown>[];
  triggers: Record<string, unknown>[];
  messagePools: EditorMessagePools;
};

type LevelEditorOptions = {
  onPlaytest?: (path: string) => Promise<void> | void;
};

type AssetFrame = {
  src: string;
  label: string;
  rect?: { x: number; y: number; w: number; h: number };
};

const TILE_TOOLS: TileTool[] = [
  { value: 0, label: '0 Empty', hint: 'Empty floor', key: 'Digit0' },
  { value: 1, label: '1 Wall', hint: 'Solid wall', key: 'Digit1' },
  { value: 2, label: '2 Alt wall', hint: 'Alternative wall', key: 'Digit2' },
  { value: 3, label: '3 Window', hint: 'Window cell', key: 'Digit3' },
  { value: 4, label: '4 Stand A', hint: 'Legend slot 4', key: 'Digit4' },
  { value: 5, label: '5 Stand B', hint: 'Legend slot 5', key: 'Digit5' },
  { value: 6, label: '6 Door', hint: 'Door cell', key: 'Digit6' },
  { value: 7, label: '7 Exit / gate', hint: 'Exit or legend slot 7', key: 'Digit7' },
  { value: 8, label: '8 Stand C', hint: 'Legend slot 8', key: 'Digit8' },
  { value: 9, label: '9 Stand D', hint: 'Legend slot 9', key: 'Digit9' },
];

const MATERIAL_TOOLS = [
  'hospital_wall_stripe',
  'medical_tiles',
  'concrete_tunnel',
  'metal_panels',
  'metal_emergency',
  'organic_wall',
  'ventilation_shaft',
  'flesh_wall',
  'medical_door',
  'archive_door',
  'ward_door',
  'shower_door',
  'blast_door',
  'reinforced_window',
  'ward_window',
  'false_window',
] as const;

const LEGEND_MATERIALS: Readonly<Record<string, string>> = {
  wall: 'medical_tiles',
  window: 'reinforced_window',
  door: 'medical_door',
  exit: 'blast_door',
  stand: 'hospital_wall_stripe',
  stand1: 'hospital_wall_stripe',
  stand2: 'hospital_wall_stripe',
  stand3: 'hospital_wall_stripe',
  gstand1: 'metal_panels',
  gstand2: 'metal_panels',
  brick: 'concrete_tunnel',
};

const PALETTE_GROUP_HINTS: Record<string, string> = {
  Documents: 'Collectible narrative items. Their text comes from the matching message pool.',
  Keys: 'Collectible keys and locks that restrict matching doors.',
  Pickups: 'Collectible items that change player health, state, ammunition or armor.',
  Weapons: 'Collectible weapons that add or switch the player weapon.',
  Enemies: 'Enemy spawn points used when the level starts.',
  Audio: 'Positional ambient sounds that loop around the placed cell.',
  Props: 'Decorative world objects placed at the center of a cell.',
};

const ENTITY_HINTS: Record<string, string> = {
  health: 'Places a collectible aid kit that restores player health.',
  haloperidol: 'Places collectible medication that changes the player perception state.',
  injector: 'Places a collectible injector used by the medication system.',
  ammo_pistol: 'Places collectible pistol ammunition.',
  ammo_shotgun: 'Places collectible shotgun ammunition.',
  artifact_hallucination: 'Places an artifact that activates the hallucination overlay.',
  artifact_vhs: 'Places an artifact that activates the VHS overlay.',
  armor_blue: 'Places collectible blue armor.',
  armor_green: 'Places collectible green armor.',
  armor_red: 'Places collectible red armor.',
  hallucination: 'Places a hallucination entity rather than a physical enemy.',
  amb_buzz: 'Places a looping positional fluorescent-light buzz.',
  amb_heart: 'Places a looping positional heartbeat sound.',
  amb_machine: 'Places a looping positional machine hum.',
};

function paletteItemHint(item: PaletteItem) {
  return (
    item.description ??
    ENTITY_HINTS[item.id] ??
    `${PALETTE_GROUP_HINTS[item.group] ?? 'Place this entity on the map'}`
  );
}

function makeLockTool(keyId: 'gold' | 'silver' | 'blood'): PaletteItem {
  return {
    id: `lock_${keyId}`,
    label: `${keyId} lock`,
    group: 'Keys',
    description: `Locks a door cell until the player collects the ${keyId} key.`,
    create: (x, y) => ({
      id: makeEntityId(`${keyId}_lock`, x, y),
      type: 'door_lock',
      keyId,
      x: Math.floor(x),
      y: Math.floor(y),
    }),
  };
}

function makeWeaponTool(subtype: string, label: string, preview: string): PaletteItem {
  return {
    id: `weapon_${subtype}`,
    label,
    group: 'Weapons',
    description: `Places a collectible ${label.toLowerCase()} weapon.`,
    preview,
    create: (x, y) => ({ id: makeEntityId(subtype, x, y), type: 'weapon', subtype, x, y }),
  };
}

function makeEnemyTool(kind: string, label: string, preview: string): PaletteItem {
  return {
    id: `enemy_${kind}`,
    label,
    group: 'Enemies',
    description: `Places a spawn point for the ${label.toLowerCase()} enemy.`,
    preview,
    create: (x, y) => ({ id: makeEntityId(kind, x, y), type: 'enemy_spawn', kind, x, y }),
  };
}

function makePropTool(sprite: string, label: string, scale = 0.55): PaletteItem {
  return {
    id: sprite,
    label,
    group: 'Props',
    description: `Places the decorative ${label.toLowerCase()} prop.`,
    preview: sprite,
    create: (x, y) => ({
      id: makeEntityId(sprite, x, y),
      type: 'prop',
      sprite,
      x,
      y,
      scale,
    }),
  };
}

const ENTITY_TOOLS: PaletteItem[] = [
  {
    id: 'note_archive',
    label: 'Note',
    group: 'Documents',
    description:
      'Places a collectible narrative note. Its text is drawn from the level messagePools.note list.',
    preview: 'document_archive',
    create: (x, y) => ({
      id: makeEntityId('note', x, y),
      type: 'note',
      messageType: 'note',
      sprite: 'document_archive',
      x,
      y,
    }),
  },
  {
    id: 'note_card',
    label: 'Medical card',
    group: 'Documents',
    description:
      'Places a collectible medical card. Its text is drawn from the level messagePools.card list.',
    preview: 'document_medical_card',
    create: (x, y) => ({
      id: makeEntityId('card', x, y),
      type: 'note',
      messageType: 'card',
      sprite: 'document_medical_card',
      x,
      y,
    }),
  },
  {
    id: 'key_gold',
    label: 'Gold key',
    group: 'Keys',
    description: 'Places a collectible gold key that opens matching gold locks.',
    preview: 'keyGold',
    create: (x, y) => ({ id: makeEntityId('gold_key', x, y), type: 'key', subtype: 'gold', x, y }),
  },
  {
    id: 'key_silver',
    label: 'Silver key',
    group: 'Keys',
    description: 'Places a collectible silver key that opens matching silver locks.',
    preview: 'keySilver',
    create: (x, y) => ({
      id: makeEntityId('silver_key', x, y),
      type: 'key',
      subtype: 'silver',
      x,
      y,
    }),
  },
  {
    id: 'key_blood',
    label: 'Blood key',
    group: 'Keys',
    description: 'Places a collectible blood key that opens matching blood locks.',
    preview: 'keyBlood',
    create: (x, y) => ({
      id: makeEntityId('blood_key', x, y),
      type: 'key',
      subtype: 'blood',
      x,
      y,
    }),
  },
  makeLockTool('gold'),
  makeLockTool('silver'),
  makeLockTool('blood'),
  {
    id: 'health',
    label: 'Health',
    group: 'Pickups',
    preview: 'health',
    create: (x, y) => ({ id: makeEntityId('health', x, y), type: 'health_pickup', x, y }),
  },
  {
    id: 'haloperidol',
    label: 'Haloperidol',
    group: 'Pickups',
    preview: 'haloperidol',
    create: (x, y) => ({
      id: makeEntityId('haloperidol', x, y),
      type: 'medication',
      subtype: 'haloperidol',
      x,
      y,
    }),
  },
  {
    id: 'injector',
    label: 'Injector',
    group: 'Pickups',
    preview: 'injector',
    create: (x, y) => ({
      id: makeEntityId('injector', x, y),
      type: 'medication',
      subtype: 'injector',
      x,
      y,
    }),
  },
  {
    id: 'ammo_pistol',
    label: 'Pistol ammo',
    group: 'Pickups',
    preview: 'ammo_pistol',
    create: (x, y) => ({
      id: makeEntityId('ammo_pistol', x, y),
      type: 'ammo',
      subtype: 'pistol',
      x,
      y,
    }),
  },
  {
    id: 'ammo_shotgun',
    label: 'Shotgun ammo',
    group: 'Pickups',
    preview: 'ammo_shotgun',
    create: (x, y) => ({
      id: makeEntityId('ammo_shotgun', x, y),
      type: 'ammo',
      subtype: 'shotgun',
      x,
      y,
    }),
  },
  {
    id: 'artifact_hallucination',
    label: 'Hallucination artifact',
    group: 'Pickups',
    preview: 'artifact_hallucination',
    create: (x, y) => ({
      id: makeEntityId('artifact_hallucination', x, y),
      type: 'artifact',
      subtype: 'hallucination',
      x,
      y,
    }),
  },
  {
    id: 'artifact_vhs',
    label: 'VHS artifact',
    group: 'Pickups',
    preview: 'artifact_vhs',
    create: (x, y) => ({
      id: makeEntityId('artifact_vhs', x, y),
      type: 'artifact',
      subtype: 'vhs',
      x,
      y,
    }),
  },
  {
    id: 'armor_blue',
    label: 'Blue armor',
    group: 'Pickups',
    preview: 'armor_blue',
    create: (x, y) => ({
      id: makeEntityId('armor_blue', x, y),
      type: 'armor',
      subtype: 'blue',
      x,
      y,
    }),
  },
  {
    id: 'armor_green',
    label: 'Green armor',
    group: 'Pickups',
    preview: 'armor_green',
    create: (x, y) => ({
      id: makeEntityId('armor', x, y),
      type: 'armor',
      subtype: 'green',
      x,
      y,
    }),
  },
  {
    id: 'armor_red',
    label: 'Red armor',
    group: 'Pickups',
    preview: 'armor_red',
    create: (x, y) => ({
      id: makeEntityId('armor_red', x, y),
      type: 'armor',
      subtype: 'red',
      x,
      y,
    }),
  },
  makeWeaponTool('skalpel', 'Skalpel', 'weapon_pickup_skalpel'),
  makeWeaponTool('pipe', 'Pipe', 'weapon_pickup_pipe'),
  makeWeaponTool('pistol', 'Pistol', 'weapon_pickup_pistol'),
  makeWeaponTool('revolver', 'Revolver', 'weapon_pickup_revolver'),
  makeWeaponTool('shotgun', 'Shotgun', 'weapon_pickup_shotgun'),
  makeEnemyTool('skeleton_husk', 'Husk', 'skeleton_husk'),
  makeEnemyTool('medical_orderly', 'Orderly', 'medical_orderly'),
  makeEnemyTool('deformed_patient', 'Patient', 'deformed_patient'),
  makeEnemyTool('flesh_watcher', 'Flesh watcher', 'flesh_watcher'),
  makeEnemyTool('flesh_eye', 'Flesh eye', 'flesh_eye'),
  makeEnemyTool('flesh_machine', 'Flesh machine', 'flesh_machine'),
  makeEnemyTool('doppelganger', 'Doppelganger', 'doppelganger'),
  {
    id: 'hallucination',
    label: 'Hallucination',
    group: 'Enemies',
    preview: 'hallucination_entity',
    create: (x, y) => ({
      id: makeEntityId('hallucination', x, y),
      type: 'hallucination',
      subtype: 'hallucination_entity',
      x,
      y,
    }),
  },
  {
    id: 'amb_buzz',
    label: 'Fluorescent buzz',
    group: 'Audio',
    create: (x, y) => ({
      id: makeEntityId('amb_buzz', x, y),
      type: 'ambient_loop',
      subtype: 'fluorescent_buzz',
      x,
      y,
      radius: 8,
      volume: 0.38,
    }),
  },
  {
    id: 'amb_heart',
    label: 'Heartbeat',
    group: 'Audio',
    create: (x, y) => ({
      id: makeEntityId('amb_heart', x, y),
      type: 'ambient_loop',
      subtype: 'heartbeat_wall',
      x,
      y,
      radius: 7,
      volume: 0.42,
    }),
  },
  {
    id: 'amb_machine',
    label: 'Machine hum',
    group: 'Audio',
    create: (x, y) => ({
      id: makeEntityId('amb_machine', x, y),
      type: 'ambient_loop',
      subtype: 'machine_hum',
      x,
      y,
      radius: 8,
      volume: 0.42,
    }),
  },
  makePropTool('prop_medical_iv', 'IV stand'),
  makePropTool('prop_medical_cabinet', 'Cabinet'),
  makePropTool('prop_body_bag', 'Body bag', 0.6),
  makePropTool('prop_wheel_chair', 'Wheel chair'),
  makePropTool('prop_organic_flesh', 'Organic flesh', 0.62),
  makePropTool('prop_ceiling_light', 'Ceiling light', 0.42),
  makePropTool('prop_treatment_chair', 'Treatment chair'),
  makePropTool('prop_terminal', 'Terminal', 0.54),
  makePropTool('prop_child', 'Child sprite', 0.5),
  makePropTool('prop_camera', 'Camera', 0.38),
  makePropTool('prop_ceiling_valve', 'Ceiling valve', 0.44),
  makePropTool('prop_tv', 'TV prop', 0.52),
  makePropTool('prop_medical_gurney', 'Gurney', 0.6),
  makePropTool('prop_patient_corpse', 'Corpse prop', 0.58),
  makePropTool('prop_windowman', 'Window man', 0.55),
];

const TRIGGER_SOUNDS = [
  'ambient.distant.scream',
  'ambient.heartbeat.wall',
  'hallucination.burst',
  'hallucination.vhs.glitch',
  'transition.predator.growl',
  'machinery.pipe.steam',
] as const;

const DEFAULT_LEVEL: LevelJson = {
  id: 'edited-level',
  name: 'Edited level',
  legend: {
    '0': 'empty',
    '1': 'wall',
    '3': 'window',
    '6': 'door',
    '7': 'exit',
  },
  spawn: { x: 1.5, y: 1.5, rot: 0 },
  rows: ['11111111', '10000001', '10000001', '10000001', '11111111'],
  entities: [],
  lights: [],
  triggers: [],
};

function normalizeLevelPath(levelFile: string | number) {
  const value = String(levelFile).trim();
  if (!value) throw new Error('Level file is required');
  if (/^\d+$/.test(value)) return `/assets/data/levels/level${value}.json`;
  if (/^level\d+$/.test(value)) return `/assets/data/levels/${value}.json`;
  if (value.endsWith('.json')) return value;
  return `/assets/data/levels/${value}.json`;
}

async function loadLevelJson(levelFile: string | number) {
  const path = normalizeLevelPath(levelFile);
  const res = await fetch(assetUrl(path), { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to load level: ${path} (${res.status})`);
  }
  return { path, data: (await res.json()) as LevelJson };
}

function readRows(level: LevelJson) {
  const hasGeometry = Array.isArray(level.geometry);
  const raw = hasGeometry ? level.geometry : level.rows;
  const rows = Array.isArray(raw) && raw.every((row) => typeof row === 'string') ? raw : null;
  const sourceKey: 'geometry' | 'rows' = hasGeometry ? 'geometry' : 'rows';
  if (!rows || rows.length === 0) {
    return { sourceKey, rows: [...(DEFAULT_LEVEL.rows as string[])] };
  }

  const width = Math.max(1, ...rows.map((row) => row.length));
  return {
    sourceKey,
    rows: rows.map((row) => row.padEnd(width, '0').replace(/[^0-9]/g, '0')),
  };
}

function rowsToGrid(rows: string[]) {
  return rows.map((row) =>
    Array.from(row, (ch) => {
      const value = ch.charCodeAt(0) - 48;
      return value >= 0 && value <= 9 ? value : 0;
    }),
  );
}

function gridToRows(grid: number[][]) {
  return grid.map((row) =>
    row.map((value) => String(Math.max(0, Math.min(9, value | 0)))).join(''),
  );
}

function readSpawn(level: LevelJson) {
  if (!level.spawn || typeof level.spawn !== 'object') return { x: 1.5, y: 1.5, rot: 0 };
  const spawn = level.spawn as { x?: unknown; y?: unknown; rot?: unknown };
  return {
    x: typeof spawn.x === 'number' ? spawn.x : 1.5,
    y: typeof spawn.y === 'number' ? spawn.y : 1.5,
    rot: typeof spawn.rot === 'number' ? spawn.rot : 0,
  };
}

function readMaterials(level: LevelJson, grid: number[][]) {
  const width = grid[0]?.length ?? 0;
  const materials = Array.from({ length: grid.length }, () =>
    Array.from({ length: width }, () => ''),
  );
  const raw = level.materialsWall;
  if (!Array.isArray(raw)) return materials;

  if (raw.every((row) => typeof row === 'string')) {
    for (let y = 0; y < materials.length; y++) {
      const row = raw[y] as string | undefined;
      for (let x = 0; x < width; x++) materials[y][x] = row?.[x] ?? '';
    }
    return materials;
  }

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as {
      x?: unknown;
      y?: unknown;
      w?: unknown;
      h?: unknown;
      material?: unknown;
    };
    if (typeof item.x !== 'number' || typeof item.y !== 'number') continue;
    if (typeof item.material !== 'string') continue;
    const x = Math.floor(item.x);
    const y = Math.floor(item.y);
    const w = typeof item.w === 'number' ? Math.max(1, Math.floor(item.w)) : 1;
    const h = typeof item.h === 'number' ? Math.max(1, Math.floor(item.h)) : 1;
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (materials[yy]?.[xx] !== undefined) materials[yy][xx] = item.material;
      }
    }
  }
  return materials;
}

function readObjects<T extends Record<string, unknown>>(raw: unknown) {
  return Array.isArray(raw)
    ? raw
        .filter((item): item is T => !!item && typeof item === 'object')
        .map((item) => ({ ...item }))
    : [];
}

function readMessagePools(raw: unknown): EditorMessagePools {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const pools: EditorMessagePools = {};
  for (const [messageType, messages] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(messages)) continue;
    pools[messageType] = messages.flatMap((message): EditorMessage[] => {
      if (!message || typeof message !== 'object') return [];
      const item = message as { title?: unknown; text?: unknown; isDocument?: unknown };
      if (typeof item.title !== 'string' || typeof item.text !== 'string') return [];
      return [
        {
          title: item.title,
          text: item.text,
          isDocument: typeof item.isDocument === 'boolean' ? item.isDocument : undefined,
        },
      ];
    });
  }
  return pools;
}

function makeButton(label: string, className = 'level-editor__button') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
}

function showStatus(el: HTMLElement, message: string) {
  el.textContent = message;
  window.setTimeout(() => {
    if (el.textContent === message) el.textContent = '';
  }, 2400);
}

function makeEntityId(prefix: string, x: number, y: number) {
  return `${prefix}_${Math.floor(x)}_${Math.floor(y)}_${Date.now().toString(36).slice(-4)}`;
}

function assetPreviewUrl(assetId: string | undefined) {
  if (!assetId) return '';
  const path = ASSET_MANIFEST[assetId as keyof typeof ASSET_MANIFEST];
  return path ? assetUrl(`/${path}`) : '';
}

function entityPreviewId(entity: Record<string, unknown>) {
  const candidates: unknown[] = [entity.sprite, entity.kind];
  if (entity.type === 'key' && typeof entity.subtype === 'string') {
    candidates.push(`${entity.subtype}Key`);
  }
  if (entity.type === 'health_pickup') candidates.push('health');
  if (entity.type === 'medication' && typeof entity.subtype === 'string') {
    candidates.push(entity.subtype);
  }
  if (entity.type === 'ammo' && typeof entity.subtype === 'string') {
    candidates.push(`ammo_${entity.subtype}`);
  }
  if (entity.type === 'armor' && typeof entity.subtype === 'string') {
    candidates.push(`armor_${entity.subtype}`);
  }
  if (entity.type === 'artifact' && typeof entity.subtype === 'string') {
    candidates.push(`artifact_${entity.subtype}`);
  }
  if (entity.type === 'weapon' && typeof entity.subtype === 'string') {
    candidates.push(`weapon_pickup_${entity.subtype}`);
  }
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && assetPreviewUrl(candidate)) return candidate;
  }
  return '';
}

function paletteItemForEntity(entity: Record<string, unknown>) {
  const comparedKeys = ['type', 'subtype', 'kind', 'sprite', 'keyId', 'messageType'] as const;
  return ENTITY_TOOLS.find((item) => {
    const sample = item.create(0.5, 0.5);
    return comparedKeys.every((key) => sample[key] === undefined || sample[key] === entity[key]);
  });
}

async function loadAssetFrames(assetId: string): Promise<AssetFrame[]> {
  const fallback = assetPreviewUrl(assetId);
  if (!fallback) return [];
  const sourcePath = ASSET_MANIFEST[assetId];
  const relatedAssets = Object.entries(ASSET_MANIFEST)
    .filter(([, path]) => path === sourcePath)
    .sort(([id]) => (id === assetId ? -1 : 1));
  const frames = (
    await Promise.all(
      relatedAssets.map(async ([relatedId]) => {
        const descriptorPath = getAnimationDescriptorPath(relatedId);
        if (!descriptorPath) return [];
        const res = await fetch(assetUrl(`/assets/${descriptorPath}`), { cache: 'no-store' });
        if (!res.ok) return [];
        const data = (await res.json()) as { frames?: unknown; sheet?: unknown };
        if (data.sheet && typeof data.sheet === 'object') {
          const sheet = data.sheet as { src?: unknown; frames?: unknown };
          if (typeof sheet.src === 'string' && Array.isArray(sheet.frames)) {
            const src = assetUrl(`/assets/${sheet.src}`);
            return sheet.frames.flatMap((value, index): AssetFrame[] => {
              if (!value || typeof value !== 'object') return [];
              const frame = value as { x?: unknown; y?: unknown; w?: unknown; h?: unknown };
              if (
                typeof frame.x !== 'number' ||
                typeof frame.y !== 'number' ||
                typeof frame.w !== 'number' ||
                typeof frame.h !== 'number'
              ) {
                return [];
              }
              return [
                {
                  src,
                  label: `${relatedId} · frame ${index + 1}`,
                  rect: { x: frame.x, y: frame.y, w: frame.w, h: frame.h },
                },
              ];
            });
          }
        }
        if (Array.isArray(data.frames)) {
          return data.frames.flatMap((value, index): AssetFrame[] =>
            typeof value === 'string'
              ? [{ src: assetUrl(`/assets/${value}`), label: `${relatedId} · frame ${index + 1}` }]
              : [],
          );
        }
        return [];
      }),
    )
  ).flat();
  const uniqueFrames = frames.filter(
    (frame, index) =>
      frames.findIndex(
        (candidate) =>
          candidate.src === frame.src &&
          JSON.stringify(candidate.rect) === JSON.stringify(frame.rect),
      ) === index,
  );
  return uniqueFrames.length ? uniqueFrames : [{ src: fallback, label: 'Full image' }];
}

function cellCenter(x: number, y: number) {
  return { x: x + 0.5, y: y + 0.5 };
}

function objectCell(value: unknown) {
  return typeof value === 'number' ? Math.floor(value) : null;
}

function compactMaterials(materials: string[][]) {
  const out: Array<{ x: number; y: number; material: string }> = [];
  for (let y = 0; y < materials.length; y++) {
    for (let x = 0; x < (materials[y]?.length ?? 0); x++) {
      const material = materials[y][x];
      if (material) out.push({ x, y, material });
    }
  }
  return out;
}

export async function openLevelEditor(
  levelFile: string | number,
  options: LevelEditorOptions = {},
) {
  const existing = document.getElementById('levelEditorRoot');
  if (existing) existing.remove();

  const { path, data } = await loadLevelJson(levelFile);
  const closeEditor = mountLevelEditor(path, data, options);

  return {
    path,
    close: closeEditor,
  };
}

export function openBlankLevelEditor(options: LevelEditorOptions = {}) {
  const existing = document.getElementById('levelEditorRoot');
  if (existing) existing.remove();
  return mountLevelEditor(
    '/assets/data/levels/level.json',
    structuredClone(DEFAULT_LEVEL),
    options,
  );
}

function mountLevelEditor(path: string, level: LevelJson, options: LevelEditorOptions) {
  const host = document.getElementById('canvas1') ?? document.body;
  const { sourceKey, rows } = readRows(level);
  const grid = rowsToGrid(rows);
  const materials = readMaterials(level, grid);
  const entities = readObjects<Record<string, unknown>>(level.entities);
  const lights = readObjects<Record<string, unknown>>(level.lights);
  const triggers = readObjects<Record<string, unknown>>(level.triggers);
  const messagePools = readMessagePools(level.messagePools);
  const spawn = readSpawn(level);
  const hadMaterials = Array.isArray(level.materialsWall);
  const hadEntities = Array.isArray(level.entities);
  const hadLights = Array.isArray(level.lights);
  const hadTriggers = Array.isArray(level.triggers);
  const hadMessagePools =
    !!level.messagePools &&
    typeof level.messagePools === 'object' &&
    !Array.isArray(level.messagePools);
  const legend =
    level.legend && typeof level.legend === 'object'
      ? (level.legend as Record<string, unknown>)
      : {};

  let selectedTool: EditorTool = 'cell';
  let selectedValue = 1;
  let selectedMaterial: string = MATERIAL_TOOLS[0];
  let selectedEntity = ENTITY_TOOLS[0];
  let painting = false;
  let cellSize = 16;
  let selectedCell: { x: number; y: number } | null = null;
  const selectedCells = new Set<string>();
  let previewAsset: { id: string; label: string } | null = null;
  let viewerFrames: AssetFrame[] = [];
  let viewerFrameIndex = 0;
  let historyIndex = 0;
  let savedHistoryIndex = 0;
  const lightDraft: LightDraft = {
    radius: 5,
    intensity: 0.8,
    color: '#ffffff',
    colorInfluence: 1,
    mode: 'steady',
  };
  const triggerDraft: TriggerDraft = { sound: TRIGGER_SOUNDS[0], volume: 0.55, once: true };
  const noteDraft: NoteDraft = { title: '', text: '' };
  const history: EditorSnapshot[] = [];

  const root = document.createElement('section');
  root.id = 'levelEditorRoot';
  root.className = 'level-editor';
  root.setAttribute('aria-label', 'Level editor');
  const controller = new AbortController();
  const closeEditor = () => {
    controller.abort();
    root.remove();
  };

  const header = document.createElement('header');
  header.className = 'level-editor__header';

  const title = document.createElement('div');
  title.className = 'level-editor__title';
  title.textContent = `Level editor: ${path}`;
  header.appendChild(title);

  const headerActions = document.createElement('div');
  headerActions.className = 'level-editor__actions';
  const status = document.createElement('span');
  status.className = 'level-editor__status';
  headerActions.appendChild(status);

  const undoButton = makeButton('Undo');
  const redoButton = makeButton('Redo');
  const selectAllButton = makeButton('Select all cells');
  const viewButton = makeButton('View');
  const playtestButton = makeButton('Playtest');
  const saveButton = makeButton('Save level');
  const closeButton = makeButton('Close');
  undoButton.title = 'Undo the last map change (Ctrl/Cmd+Z)';
  redoButton.title = 'Repeat the last undone map change (Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y)';
  selectAllButton.title = 'Select every map cell (Ctrl/Cmd+A)';
  viewButton.title = 'Select a material, entity or occupied cell to preview its asset';
  viewButton.disabled = true;
  saveButton.title = 'Write the current map to its JSON file (Ctrl/Cmd+S)';
  closeButton.title = 'Close the editor without additional saving';
  playtestButton.disabled = !options.onPlaytest;
  playtestButton.title = options.onPlaytest
    ? 'Save changes and play the level'
    : 'Playtest is unavailable';
  headerActions.append(
    undoButton,
    redoButton,
    selectAllButton,
    viewButton,
    playtestButton,
    saveButton,
    closeButton,
  );
  header.appendChild(headerActions);

  const layout = document.createElement('div');
  layout.className = 'level-editor__layout';

  const sidebar = document.createElement('aside');
  sidebar.className = 'level-editor__sidebar';
  const inspector = document.createElement('aside');
  inspector.className = 'level-editor__inspector';

  const toolsTitle = document.createElement('div');
  toolsTitle.className = 'level-editor__section-title';
  toolsTitle.textContent = 'Tools';
  sidebar.appendChild(toolsTitle);

  const currentTool = document.createElement('section');
  currentTool.className = 'level-editor__current-tool';
  const currentToolLabel = document.createElement('div');
  currentToolLabel.className = 'level-editor__current-tool-label';
  currentToolLabel.textContent = 'Current tool';
  const currentToolMode = document.createElement('strong');
  currentToolMode.className = 'level-editor__current-tool-mode';
  const currentToolBrush = document.createElement('span');
  currentToolBrush.className = 'level-editor__current-tool-brush';
  const currentToolAction = document.createElement('span');
  currentToolAction.className = 'level-editor__current-tool-action';
  currentTool.append(currentToolLabel, currentToolMode, currentToolBrush, currentToolAction);
  sidebar.appendChild(currentTool);

  const toolList = document.createElement('div');
  toolList.className = 'level-editor__tools';
  sidebar.appendChild(toolList);

  const spawnButton = makeButton('S Spawn', 'level-editor__tool');
  const materialButton = makeButton('M Material', 'level-editor__tool');
  const entityButton = makeButton('E Entity', 'level-editor__tool');
  const lightButton = makeButton('L Light', 'level-editor__tool');
  const triggerButton = makeButton('T Sound zone', 'level-editor__tool');
  const eraseButton = makeButton('X Erase object', 'level-editor__tool');
  const fillButton = makeButton('F Fill area', 'level-editor__tool');
  const inspectButton = makeButton('I Inspect', 'level-editor__tool');
  spawnButton.title = 'Move player spawn';
  materialButton.title = 'Paint wall material overrides';
  entityButton.title = 'Place selected entity';
  lightButton.title = 'Place light source';
  triggerButton.title = 'Place one-tile enter_zone sound trigger';
  eraseButton.title = 'Remove objects/materials from a cell';
  fillButton.title = 'Fill connected geometry area with selected cell value';
  inspectButton.title = 'Select a map element and view its properties';
  toolList.append(
    spawnButton,
    materialButton,
    entityButton,
    lightButton,
    triggerButton,
    eraseButton,
    fillButton,
    inspectButton,
  );

  const tileButtons = TILE_TOOLS.map((tool) => {
    const button = makeButton(tool.label, 'level-editor__tool');
    button.title = tool.hint;
    button.dataset.value = String(tool.value);
    toolList.appendChild(button);
    return { tool, button };
  });

  const info = document.createElement('dl');
  info.className = 'level-editor__info';
  sidebar.appendChild(info);

  const addInfo = (label: string, value: string) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    info.append(dt, dd);
    return dd;
  };

  const sizeInfo = addInfo('Size', `${grid[0]?.length ?? 0} x ${grid.length}`);
  const spawnInfo = addInfo('Spawn', '');
  const countsInfo = addInfo('Objects', '');
  const sourceInfo = addInfo('Source', sourceKey);
  sourceInfo.title = sourceKey === 'geometry' ? 'Editing geometry array' : 'Editing rows array';

  const sizeTitle = document.createElement('div');
  sizeTitle.className = 'level-editor__section-title level-editor__section-title--spaced';
  sizeTitle.textContent = 'Map size';
  sidebar.appendChild(sizeTitle);

  const sizeForm = document.createElement('div');
  sizeForm.className = 'level-editor__resize';
  const widthInput = document.createElement('input');
  widthInput.type = 'number';
  widthInput.min = '3';
  widthInput.max = '128';
  widthInput.value = String(grid[0]?.length ?? 3);
  widthInput.title = 'Map width';
  const heightInput = document.createElement('input');
  heightInput.type = 'number';
  heightInput.min = '3';
  heightInput.max = '128';
  heightInput.value = String(grid.length);
  heightInput.title = 'Map height';
  const resizeButton = makeButton('Resize');
  resizeButton.title =
    'Resize from the bottom and right edges. Objects outside the new bounds are removed.';
  sizeForm.append(widthInput, heightInput, resizeButton);
  sidebar.appendChild(sizeForm);

  const zoomTitle = document.createElement('div');
  zoomTitle.className = 'level-editor__section-title level-editor__section-title--spaced';
  zoomTitle.textContent = 'Zoom';
  sidebar.appendChild(zoomTitle);

  const zoomControls = document.createElement('div');
  zoomControls.className = 'level-editor__zoom';
  const zoomOutButton = makeButton('-', 'level-editor__zoom-button');
  const zoomValue = document.createElement('span');
  zoomValue.className = 'level-editor__zoom-value';
  const zoomInButton = makeButton('+', 'level-editor__zoom-button');
  const zoomRange = document.createElement('input');
  zoomRange.type = 'range';
  zoomRange.min = '10';
  zoomRange.max = '40';
  zoomRange.step = '2';
  zoomRange.value = String(cellSize);
  zoomControls.append(zoomOutButton, zoomValue, zoomInButton, zoomRange);
  sidebar.appendChild(zoomControls);

  const hint = document.createElement('p');
  hint.className = 'level-editor__hint';
  hint.textContent =
    'Paint cells with mouse. Use digits for geometry, S/M/E/L/T/X/F/I for modes. Use +/- to zoom. Save writes into the level file.';
  sidebar.appendChild(hint);

  const stage = document.createElement('div');
  stage.className = 'level-editor__stage';
  const gridEl = document.createElement('div');
  gridEl.className = 'level-editor__grid';
  gridEl.style.setProperty('--level-editor-cols', String(grid[0]?.length ?? 1));
  gridEl.style.setProperty('--level-editor-cell', `${cellSize}px`);
  stage.appendChild(gridEl);

  layout.append(sidebar, stage, inspector);
  root.append(header, layout);
  host.appendChild(root);

  const assetViewer = document.createElement('section');
  assetViewer.className = 'level-editor__asset-viewer';
  assetViewer.hidden = true;
  const assetViewerHeader = document.createElement('header');
  assetViewerHeader.className = 'level-editor__asset-viewer-header';
  const assetViewerTitle = document.createElement('strong');
  assetViewerTitle.className = 'level-editor__asset-viewer-title';
  const assetViewerClose = makeButton('Close');
  assetViewerClose.title = 'Close asset preview (Escape)';
  assetViewerHeader.append(assetViewerTitle, assetViewerClose);
  const assetViewerImage = document.createElement('img');
  assetViewerImage.className = 'level-editor__asset-viewer-image';
  assetViewerImage.alt = '';
  const assetViewerCanvas = document.createElement('canvas');
  assetViewerCanvas.className = 'level-editor__asset-viewer-image';
  assetViewerCanvas.hidden = true;
  const assetViewerControls = document.createElement('div');
  assetViewerControls.className = 'level-editor__asset-viewer-controls';
  assetViewerControls.hidden = true;
  const assetViewerPrevious = makeButton('Previous');
  const assetViewerFrame = document.createElement('select');
  assetViewerFrame.className = 'level-editor__asset-viewer-select';
  const assetViewerNext = makeButton('Next');
  assetViewerControls.append(assetViewerPrevious, assetViewerFrame, assetViewerNext);
  const assetViewerPath = document.createElement('code');
  assetViewerPath.className = 'level-editor__asset-viewer-path';
  const assetViewerMedia = document.createElement('div');
  assetViewerMedia.className = 'level-editor__asset-viewer-media';
  assetViewerMedia.append(assetViewerImage, assetViewerCanvas);
  assetViewer.append(assetViewerHeader, assetViewerMedia, assetViewerControls, assetViewerPath);
  root.appendChild(assetViewer);

  const setPreviewAsset = (id: string, label: string) => {
    const url = assetPreviewUrl(id);
    previewAsset = url ? { id, label } : null;
    viewButton.disabled = !previewAsset;
    viewButton.title = previewAsset
      ? `View ${previewAsset.label} (${previewAsset.id})`
      : 'Select a material, entity or occupied cell to preview its asset';
  };

  const closeAssetViewer = () => {
    assetViewer.hidden = true;
    assetViewerImage.removeAttribute('src');
    viewerFrames = [];
    viewerFrameIndex = 0;
  };

  const renderAssetFrame = async (index: number) => {
    const frame = viewerFrames[index];
    if (!frame || !previewAsset) return;
    viewerFrameIndex = index;
    assetViewerFrame.value = String(index);
    assetViewerPrevious.disabled = index === 0;
    assetViewerNext.disabled = index === viewerFrames.length - 1;
    assetViewerPath.textContent = `${frame.label} · ${ASSET_MANIFEST[previewAsset.id]} · ${index + 1}/${viewerFrames.length}`;
    if (!frame.rect) {
      assetViewerCanvas.hidden = true;
      assetViewerImage.hidden = false;
      assetViewerImage.src = frame.src;
      return;
    }

    const image = new Image();
    image.src = frame.src;
    await image.decode();
    if (viewerFrames[viewerFrameIndex] !== frame) return;
    assetViewerImage.hidden = true;
    assetViewerCanvas.hidden = false;
    assetViewerCanvas.width = frame.rect.w;
    assetViewerCanvas.height = frame.rect.h;
    const context = assetViewerCanvas.getContext('2d');
    context?.clearRect(0, 0, frame.rect.w, frame.rect.h);
    context?.drawImage(
      image,
      frame.rect.x,
      frame.rect.y,
      frame.rect.w,
      frame.rect.h,
      0,
      0,
      frame.rect.w,
      frame.rect.h,
    );
  };

  const openAssetViewer = async () => {
    if (!previewAsset) return;
    assetViewerTitle.textContent = previewAsset.label;
    assetViewerImage.alt = previewAsset.label;
    assetViewer.hidden = false;
    viewerFrames = await loadAssetFrames(previewAsset.id);
    assetViewerFrame.replaceChildren();
    for (let index = 0; index < viewerFrames.length; index++) {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = viewerFrames[index].label;
      assetViewerFrame.appendChild(option);
    }
    assetViewerControls.hidden = viewerFrames.length <= 1;
    await renderAssetFrame(0);
  };

  let cells: HTMLElement[][] = [];
  const paletteButtons: HTMLButtonElement[] = [];

  const syncCurrentTool = () => {
    const tile = TILE_TOOLS.find((tool) => tool.value === selectedValue) ?? TILE_TOOLS[0];
    if (selectedTool === 'cell') {
      currentToolMode.textContent = 'Paint geometry';
      currentToolBrush.textContent = tile.label;
      currentToolAction.textContent = tile.hint;
      return;
    }
    if (selectedTool === 'material') {
      currentToolMode.textContent = 'Paint material';
      currentToolBrush.textContent = selectedMaterial;
      currentToolAction.textContent =
        'Click or drag over cells to apply the selected wall material.';
      return;
    }
    if (selectedTool === 'entity') {
      currentToolMode.textContent = 'Place entity';
      currentToolBrush.textContent = `${selectedEntity.group} / ${selectedEntity.label}`;
      currentToolAction.textContent = 'Click a cell to place one copy of the selected entity.';
      return;
    }
    if (selectedTool === 'light') {
      currentToolMode.textContent = 'Place light';
      currentToolBrush.textContent = `${lightDraft.mode}, ${lightDraft.color}, radius ${lightDraft.radius}, color influence ${lightDraft.colorInfluence}`;
      currentToolAction.textContent = 'Click a cell to place a light source.';
      return;
    }
    if (selectedTool === 'trigger') {
      currentToolMode.textContent = 'Place sound zone';
      currentToolBrush.textContent = triggerDraft.sound;
      currentToolAction.textContent = 'Click a cell to place a one-tile sound trigger.';
      return;
    }
    if (selectedTool === 'erase') {
      currentToolMode.textContent = 'Erase objects';
      currentToolBrush.textContent = 'Everything in one cell';
      currentToolAction.textContent =
        'Click or drag to remove materials, entities, lights and triggers.';
      return;
    }
    if (selectedTool === 'fill') {
      currentToolMode.textContent = 'Fill geometry area';
      currentToolBrush.textContent = tile.label;
      currentToolAction.textContent = 'Click a cell to replace its connected area.';
      return;
    }
    currentToolMode.textContent = 'Inspect cell';
    currentToolBrush.textContent =
      selectedCells.size > 1
        ? `${selectedCells.size} cells selected`
        : selectedCell
          ? `Cell ${selectedCell.x}, ${selectedCell.y}`
          : 'No cell selected';
    currentToolAction.textContent = 'Click a cell to show its contents in the inspector.';
  };

  const syncToolButtons = () => {
    spawnButton.classList.toggle('is-selected', selectedTool === 'spawn');
    materialButton.classList.toggle('is-selected', selectedTool === 'material');
    entityButton.classList.toggle('is-selected', selectedTool === 'entity');
    lightButton.classList.toggle('is-selected', selectedTool === 'light');
    triggerButton.classList.toggle('is-selected', selectedTool === 'trigger');
    eraseButton.classList.toggle('is-selected', selectedTool === 'erase');
    fillButton.classList.toggle('is-selected', selectedTool === 'fill');
    inspectButton.classList.toggle('is-selected', selectedTool === 'inspect');
    for (const { tool, button } of tileButtons) {
      button.classList.toggle(
        'is-selected',
        selectedTool === 'cell' && tool.value === selectedValue,
      );
    }
    syncCurrentTool();
  };

  const syncSpawnInfo = () => {
    spawnInfo.textContent = `${spawn.x.toFixed(1)}, ${spawn.y.toFixed(1)}, rot ${spawn.rot.toFixed(2)}`;
  };

  const syncCounts = () => {
    const materialCount = compactMaterials(materials).length;
    const messageCount = Object.values(messagePools).reduce(
      (sum, messages) => sum + messages.length,
      0,
    );
    countsInfo.textContent = `${entities.length} ent / ${lights.length} light / ${triggers.length} trig / ${materialCount} mat / ${messageCount} msg`;
  };

  const captureSnapshot = (): EditorSnapshot => ({
    grid: structuredClone(grid),
    materials: structuredClone(materials),
    spawn: { ...spawn },
    entities: structuredClone(entities),
    lights: structuredClone(lights),
    triggers: structuredClone(triggers),
    messagePools: structuredClone(messagePools),
  });

  const syncHistory = () => {
    undoButton.disabled = historyIndex === 0;
    redoButton.disabled = historyIndex === history.length - 1;
    const dirty = historyIndex !== savedHistoryIndex;
    title.textContent = `${dirty ? '* ' : ''}Level editor: ${path}`;
  };

  const recordHistory = () => {
    const snapshot = captureSnapshot();
    if (JSON.stringify(snapshot) === JSON.stringify(history[historyIndex])) return;
    if (savedHistoryIndex > historyIndex) savedHistoryIndex = -1;
    history.splice(historyIndex + 1);
    history.push(snapshot);
    if (history.length > 100) {
      history.shift();
      savedHistoryIndex--;
    } else {
      historyIndex++;
    }
    syncHistory();
  };

  const replaceArray = <T>(target: T[], source: T[]) => {
    target.splice(0, target.length, ...structuredClone(source));
  };

  const restoreSnapshot = (snapshot: EditorSnapshot) => {
    replaceArray(grid, snapshot.grid);
    replaceArray(materials, snapshot.materials);
    Object.assign(spawn, snapshot.spawn);
    replaceArray(entities, snapshot.entities);
    replaceArray(lights, snapshot.lights);
    replaceArray(triggers, snapshot.triggers);
    for (const key of Object.keys(messagePools)) delete messagePools[key];
    Object.assign(messagePools, structuredClone(snapshot.messagePools));
    rebuildGrid();
    syncAllCells();
    buildInspector();
  };

  const stepHistory = (offset: -1 | 1) => {
    const next = historyIndex + offset;
    if (!history[next]) return;
    historyIndex = next;
    restoreSnapshot(history[historyIndex]);
    syncHistory();
  };

  const setZoom = (next: number) => {
    cellSize = Math.max(10, Math.min(40, Math.round(next / 2) * 2));
    gridEl.style.setProperty('--level-editor-cell', `${cellSize}px`);
    zoomRange.value = String(cellSize);
    zoomValue.textContent = `${cellSize}px`;
  };

  const objectsAt = (x: number, y: number) => {
    const ent = entities.filter((e) => objectCell(e.x) === x && objectCell(e.y) === y);
    const enemy = ent.filter((e) => e.type === 'enemy_spawn');
    const health = ent.filter((e) => e.type === 'health_pickup' || e.type === 'health');
    const light = lights.filter((l) => objectCell(l.x) === x && objectCell(l.y) === y);
    const trigger = triggers.filter((t) => {
      const zone = t.trigger as { x?: unknown; y?: unknown } | undefined;
      return objectCell(zone?.x) === x && objectCell(zone?.y) === y;
    });
    return { ent, enemy, health, light, trigger };
  };

  const legendMaterialAt = (x: number, y: number) => {
    const legendValue = legend[String(grid[y]?.[x])];
    if (typeof legendValue !== 'string') return '';
    return assetPreviewUrl(legendValue) ? legendValue : (LEGEND_MATERIALS[legendValue] ?? '');
  };

  const effectiveMaterialAt = (x: number, y: number) => {
    if (grid[y]?.[x] === 0) return '';
    return materials[y]?.[x] || legendMaterialAt(x, y);
  };

  const cellTitle = (x: number, y: number) => {
    const objects = objectsAt(x, y);
    const parts = [`${x},${y}: ${grid[y][x]}`];
    const material = effectiveMaterialAt(x, y);
    if (material) parts.push(`mat ${material}`);
    if (objects.ent.length) parts.push(`${objects.ent.length} entities`);
    if (objects.enemy.length) {
      const kinds = objects.enemy.map((enemy) => String(enemy.kind ?? 'enemy')).join(', ');
      parts.push(`enemies: ${kinds}`);
    }
    if (objects.health.length) parts.push(`${objects.health.length} health pickups`);
    if (objects.light.length) {
      const colors = objects.light.map((light) => String(light.color ?? '#ffffff')).join(', ');
      parts.push(`${objects.light.length} lights: ${colors}`);
    }
    if (objects.trigger.length) parts.push(`${objects.trigger.length} triggers`);
    return parts.join(' | ');
  };

  const syncCell = (x: number, y: number) => {
    const cell = cells[y]?.[x];
    if (!cell) return;
    const objects = objectsAt(x, y);
    cell.dataset.value = String(grid[y][x]);
    cell.dataset.material = grid[y][x] !== 0 && materials[y][x] ? '1' : '0';
    cell.classList.toggle('has-spawn', Math.floor(spawn.x) === x && Math.floor(spawn.y) === y);
    cell.classList.toggle('has-entity', objects.ent.length > 0);
    cell.classList.toggle('has-light', objects.light.length > 0);
    cell.classList.toggle('has-trigger', objects.trigger.length > 0);
    cell.classList.toggle('is-selected', selectedCells.has(`${x},${y}`));
    cell.title = cellTitle(x, y);
    cell.replaceChildren();
    if (grid[y][x] !== 0 && materials[y][x]) {
      const marker = document.createElement('span');
      marker.className = 'level-editor__marker level-editor__marker--material';
      marker.textContent = 'M';
      cell.appendChild(marker);
    }
    if (objects.ent.length) {
      const marker = document.createElement('span');
      marker.className = 'level-editor__marker level-editor__marker--entity';
      marker.textContent = String(objects.ent.length);
      cell.appendChild(marker);
    }
    if (objects.enemy.length) {
      const marker = document.createElement('span');
      marker.className = 'level-editor__marker level-editor__marker--enemy';
      marker.textContent = objects.enemy.length > 1 ? `E${objects.enemy.length}` : 'E';
      cell.appendChild(marker);
    }
    if (objects.health.length) {
      const marker = document.createElement('span');
      marker.className = 'level-editor__marker level-editor__marker--health';
      marker.textContent = objects.health.length > 1 ? `H${objects.health.length}` : 'H';
      cell.appendChild(marker);
    }
    if (objects.light.length) {
      const marker = document.createElement('span');
      marker.className = 'level-editor__marker level-editor__marker--light';
      marker.textContent = 'L';
      const color = objects.light[0].color;
      if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) {
        marker.style.backgroundColor = color;
      }
      cell.appendChild(marker);
    }
    if (objects.trigger.length) {
      const marker = document.createElement('span');
      marker.className = 'level-editor__marker level-editor__marker--trigger';
      marker.textContent = 'T';
      cell.appendChild(marker);
    }
  };

  const syncAllCells = () => {
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) syncCell(x, y);
    }
    syncSpawnInfo();
    syncCounts();
  };

  const removeAt = (x: number, y: number) => {
    materials[y][x] = '';
    for (let i = entities.length - 1; i >= 0; i--) {
      if (objectCell(entities[i].x) === x && objectCell(entities[i].y) === y) entities.splice(i, 1);
    }
    for (let i = lights.length - 1; i >= 0; i--) {
      if (objectCell(lights[i].x) === x && objectCell(lights[i].y) === y) lights.splice(i, 1);
    }
    for (let i = triggers.length - 1; i >= 0; i--) {
      const zone = triggers[i].trigger as { x?: unknown; y?: unknown } | undefined;
      if (objectCell(zone?.x) === x && objectCell(zone?.y) === y) triggers.splice(i, 1);
    }
    syncCell(x, y);
    syncCounts();
  };

  const applyAt = (x: number, y: number) => {
    if (!grid[y] || grid[y][x] === undefined) return;
    const center = cellCenter(x, y);
    if (selectedTool === 'spawn') {
      const oldX = Math.floor(spawn.x);
      const oldY = Math.floor(spawn.y);
      spawn.x = center.x;
      spawn.y = center.y;
      syncCell(oldX, oldY);
      syncCell(x, y);
      syncSpawnInfo();
      recordHistory();
      return;
    }
    if (selectedTool === 'material') {
      materials[y][x] = selectedMaterial;
      syncCell(x, y);
      syncCounts();
      recordHistory();
      return;
    }
    if (selectedTool === 'entity') {
      const entity = selectedEntity.create(center.x, center.y);
      if (entity.type === 'note') {
        if (noteDraft.title) entity.title = noteDraft.title;
        if (noteDraft.text) entity.text = noteDraft.text;
      }
      entities.push(entity);
      syncCell(x, y);
      syncCounts();
      recordHistory();
      return;
    }
    if (selectedTool === 'light') {
      lights.push({
        x: center.x,
        y: center.y,
        radius: lightDraft.radius,
        intensity: lightDraft.intensity,
        color: lightDraft.color,
        colorInfluence: lightDraft.colorInfluence,
        mode: lightDraft.mode,
      });
      syncCell(x, y);
      syncCounts();
      recordHistory();
      return;
    }
    if (selectedTool === 'trigger') {
      triggers.push({
        id: makeEntityId('sound_trigger', x, y),
        trigger: { type: 'enter_zone', x, y, w: 1, h: 1, once: triggerDraft.once },
        actions: [{ type: 'play_sound', sound: triggerDraft.sound, volume: triggerDraft.volume }],
      });
      syncCell(x, y);
      syncCounts();
      recordHistory();
      return;
    }
    if (selectedTool === 'erase') {
      removeAt(x, y);
      recordHistory();
      return;
    }
    if (selectedTool === 'fill') {
      const replacedValue = grid[y][x];
      if (replacedValue === selectedValue) return;
      const pending = [{ x, y }];
      while (pending.length) {
        const next = pending.pop()!;
        if (grid[next.y]?.[next.x] !== replacedValue) continue;
        grid[next.y][next.x] = selectedValue;
        if (selectedValue === 0) materials[next.y][next.x] = '';
        syncCell(next.x, next.y);
        pending.push(
          { x: next.x + 1, y: next.y },
          { x: next.x - 1, y: next.y },
          { x: next.x, y: next.y + 1 },
          { x: next.x, y: next.y - 1 },
        );
      }
      syncCounts();
      recordHistory();
      return;
    }
    grid[y][x] = selectedValue;
    if (selectedValue === 0) materials[y][x] = '';
    syncCell(x, y);
    syncCounts();
    recordHistory();
  };

  const selectCell = (x: number, y: number) => {
    if (!grid[y] || grid[y][x] === undefined) return;
    const previousCells = [...selectedCells];
    selectedCells.clear();
    selectedCells.add(`${x},${y}`);
    selectedCell = { x, y };
    const objects = objectsAt(x, y);
    const entity = objects.ent.find((item) => entityPreviewId(item));
    const entityAsset = entity ? entityPreviewId(entity) : '';
    const entityTool = entity ? paletteItemForEntity(entity) : undefined;
    const material = effectiveMaterialAt(x, y);
    if (selectedTool === 'inspect') {
      if (entityTool) selectedEntity = entityTool;
      selectedMaterial =
        material && MATERIAL_TOOLS.some((item) => item === material) ? material : '';
      if (entity && entityAsset) {
        const label =
          typeof entity.id === 'string'
            ? `Entity ${entity.id}`
            : `Entity ${String(entity.type ?? entityAsset)}`;
        setPreviewAsset(entityAsset, label);
      } else if (material) {
        setPreviewAsset(material, `Material ${material}`);
      } else {
        setPreviewAsset('', '');
      }
    }
    for (const key of previousCells) {
      const [prevX, prevY] = key.split(',').map(Number);
      syncCell(prevX, prevY);
    }
    syncCell(x, y);
    syncCurrentTool();
    buildInspector();
  };

  const selectAllCells = () => {
    selectedCells.clear();
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) selectedCells.add(`${x},${y}`);
    }
    selectedCell = grid[0]?.length ? { x: 0, y: 0 } : null;
    setPreviewAsset('', '');
    syncAllCells();
    syncCurrentTool();
    buildInspector();
  };

  const serializeLevel = () => {
    const next = structuredClone(level) as LevelJson;
    next[sourceKey] = gridToRows(grid);
    next.spawn = {
      ...((next.spawn && typeof next.spawn === 'object' ? next.spawn : {}) as Record<
        string,
        unknown
      >),
      x: spawn.x,
      y: spawn.y,
      rot: spawn.rot,
    };

    const compactedMaterials = compactMaterials(materials);
    if (compactedMaterials.length || hadMaterials) next.materialsWall = compactedMaterials;
    else delete next.materialsWall;

    if (entities.length || hadEntities) next.entities = entities;
    else delete next.entities;

    if (lights.length || hadLights) next.lights = lights;
    else delete next.lights;

    if (triggers.length || hadTriggers) next.triggers = triggers;
    else delete next.triggers;

    if (Object.keys(messagePools).length || hadMessagePools) next.messagePools = messagePools;
    else delete next.messagePools;

    return `${JSON.stringify(next, null, 2)}\n`;
  };

  const saveLevel = async () => {
    const res = await fetch(LEVEL_SAVE_ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path, json: serializeLevel() }),
    });
    if (!res.ok) {
      const message = await res.text().catch(() => '');
      throw new Error(message || `Failed to save level (${res.status})`);
    }
    savedHistoryIndex = historyIndex;
    syncHistory();
  };

  const rebuildGrid = () => {
    cells = [];
    gridEl.replaceChildren();
    gridEl.style.setProperty('--level-editor-cols', String(grid[0]?.length ?? 1));
    for (let y = 0; y < grid.length; y++) {
      cells[y] = [];
      for (let x = 0; x < grid[y].length; x++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'level-editor__cell';
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        cell.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          painting = true;
          selectCell(x, y);
          if (selectedTool === 'inspect') return;
          applyAt(x, y);
        });
        cell.addEventListener('pointerenter', (e) => {
          if (!(e.buttons & 1)) {
            painting = false;
            return;
          }
          if (
            painting &&
            (selectedTool === 'cell' || selectedTool === 'material' || selectedTool === 'erase')
          ) {
            applyAt(x, y);
          }
        });
        cell.addEventListener('pointerup', () => {
          painting = false;
        });
        cell.addEventListener('pointercancel', () => {
          painting = false;
        });
        cells[y][x] = cell;
        gridEl.appendChild(cell);
      }
    }
    const width = grid[0]?.length ?? 0;
    sizeInfo.textContent = `${width} x ${grid.length}`;
    widthInput.value = String(width);
    heightInput.value = String(grid.length);
  };

  const resizeMap = (width: number, height: number) => {
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      showStatus(status, 'Width and height are required');
      return;
    }
    const nextWidth = Math.max(3, Math.min(128, Math.floor(width)));
    const nextHeight = Math.max(3, Math.min(128, Math.floor(height)));
    if (nextWidth === grid[0]?.length && nextHeight === grid.length) return;

    const nextGrid = Array.from({ length: nextHeight }, (_, y) =>
      Array.from({ length: nextWidth }, (_, x) => grid[y]?.[x] ?? 0),
    );
    const nextMaterials = Array.from({ length: nextHeight }, (_, y) =>
      Array.from({ length: nextWidth }, (_, x) => materials[y]?.[x] ?? ''),
    );
    const inside = (x: unknown, y: unknown) => {
      const cellX = objectCell(x);
      const cellY = objectCell(y);
      return (
        cellX !== null &&
        cellY !== null &&
        cellX >= 0 &&
        cellX < nextWidth &&
        cellY >= 0 &&
        cellY < nextHeight
      );
    };

    replaceArray(grid, nextGrid);
    replaceArray(materials, nextMaterials);
    replaceArray(
      entities,
      entities.filter((entity) => inside(entity.x, entity.y)),
    );
    replaceArray(
      lights,
      lights.filter((light) => inside(light.x, light.y)),
    );
    replaceArray(
      triggers,
      triggers.filter((trigger) => {
        const zone = trigger.trigger as { x?: unknown; y?: unknown } | undefined;
        return inside(zone?.x, zone?.y);
      }),
    );
    spawn.x = Math.min(nextWidth - 0.5, Math.max(0.5, spawn.x));
    spawn.y = Math.min(nextHeight - 0.5, Math.max(0.5, spawn.y));
    if (selectedCell && (selectedCell.x >= nextWidth || selectedCell.y >= nextHeight)) {
      selectedCell = null;
    }
    selectedCells.clear();
    if (selectedCell) selectedCells.add(`${selectedCell.x},${selectedCell.y}`);
    rebuildGrid();
    syncAllCells();
    buildInspector();
    recordHistory();
  };

  rebuildGrid();

  const selectTile = (value: number) => {
    selectedTool = 'cell';
    selectedValue = value;
    setPreviewAsset('', '');
    syncToolButtons();
  };

  const setTool = (tool: EditorTool) => {
    selectedTool = tool;
    if (tool === 'material') {
      selectedMaterial ||= MATERIAL_TOOLS[0];
      setPreviewAsset(selectedMaterial, `Material ${selectedMaterial}`);
    } else if (tool === 'entity') {
      setPreviewAsset(
        selectedEntity.preview ?? '',
        `${selectedEntity.group} / ${selectedEntity.label}`,
      );
    } else if (tool !== 'inspect') setPreviewAsset('', '');
    syncToolButtons();
  };

  spawnButton.addEventListener('click', () => setTool('spawn'));
  materialButton.addEventListener('click', () => setTool('material'));
  entityButton.addEventListener('click', () => setTool('entity'));
  lightButton.addEventListener('click', () => setTool('light'));
  triggerButton.addEventListener('click', () => setTool('trigger'));
  eraseButton.addEventListener('click', () => setTool('erase'));
  fillButton.addEventListener('click', () => setTool('fill'));
  inspectButton.addEventListener('click', () => setTool('inspect'));

  for (const { tool, button } of tileButtons) {
    button.addEventListener('click', () => selectTile(tool.value));
  }

  zoomOutButton.addEventListener('click', () => setZoom(cellSize - 2));
  zoomInButton.addEventListener('click', () => setZoom(cellSize + 2));
  zoomRange.addEventListener('input', () => setZoom(Number(zoomRange.value)));
  resizeButton.addEventListener('click', () =>
    resizeMap(Number(widthInput.value), Number(heightInput.value)),
  );
  undoButton.addEventListener('click', () => stepHistory(-1));
  redoButton.addEventListener('click', () => stepHistory(1));
  selectAllButton.addEventListener('click', selectAllCells);
  viewButton.addEventListener('click', openAssetViewer);
  assetViewerClose.addEventListener('click', closeAssetViewer);
  assetViewerPrevious.addEventListener('click', () => {
    void renderAssetFrame(Math.max(0, viewerFrameIndex - 1));
  });
  assetViewerNext.addEventListener('click', () => {
    void renderAssetFrame(Math.min(viewerFrames.length - 1, viewerFrameIndex + 1));
  });
  assetViewerFrame.addEventListener('input', () => {
    void renderAssetFrame(Number(assetViewerFrame.value));
  });
  assetViewer.addEventListener('click', (e) => {
    if (e.target === assetViewer) closeAssetViewer();
  });

  const buildInspector = () => {
    inspector.replaceChildren();

    const selectionTitle = document.createElement('div');
    selectionTitle.className = 'level-editor__section-title';
    selectionTitle.textContent = 'Selection';
    inspector.appendChild(selectionTitle);

    const selectionPanel = document.createElement('div');
    selectionPanel.className = 'level-editor__selection';
    inspector.appendChild(selectionPanel);

    if (!selectedCell) {
      selectionPanel.textContent = 'No cell selected';
    } else if (selectedCells.size > 1) {
      const selected = [...selectedCells].map((key) => {
        const [x, y] = key.split(',').map(Number);
        return { x, y };
      });
      const editTitle = document.createElement('div');
      editTitle.className = 'level-editor__selection-subtitle';
      editTitle.textContent = `Edit ${selected.length} selected cells`;
      selectionPanel.appendChild(editTitle);
      const editForm = document.createElement('div');
      editForm.className = 'level-editor__form level-editor__selection-form';
      selectionPanel.appendChild(editForm);

      const deleteCellsButton = makeButton(
        'Delete everything from selected cells',
        'level-editor__button level-editor__button--danger',
      );
      deleteCellsButton.addEventListener('click', () => {
        for (const { x, y } of selected) {
          grid[y][x] = 0;
          materials[y][x] = '';
        }
        const isSelectedObject = (x: unknown, y: unknown) =>
          selectedCells.has(`${objectCell(x)},${objectCell(y)}`);
        replaceArray(
          entities,
          entities.filter((entity) => !isSelectedObject(entity.x, entity.y)),
        );
        replaceArray(
          lights,
          lights.filter((light) => !isSelectedObject(light.x, light.y)),
        );
        replaceArray(
          triggers,
          triggers.filter((trigger) => {
            const zone = trigger.trigger as { x?: unknown; y?: unknown } | undefined;
            return !isSelectedObject(zone?.x, zone?.y);
          }),
        );
        selectedValue = 0;
        selectedMaterial = '';
        setPreviewAsset('', '');
        syncAllCells();
        recordHistory();
        buildInspector();
        syncToolButtons();
        showStatus(status, `${selected.length} cells cleared`);
      });
      editForm.appendChild(deleteCellsButton);

      const geometryValues = new Set(selected.map(({ x, y }) => grid[y][x]));
      addChoiceInput(
        editForm,
        'Geometry',
        [
          ...(geometryValues.size > 1 ? [{ value: '', label: 'Mixed' }] : []),
          ...TILE_TOOLS.map((tool) => ({ value: String(tool.value), label: tool.label })),
        ],
        geometryValues.size === 1 ? String(grid[selected[0].y][selected[0].x]) : '',
        (value) => {
          if (!value) return;
          selectedValue = Number(value);
          for (const { x, y } of selected) {
            grid[y][x] = selectedValue;
            if (selectedValue === 0) materials[y][x] = '';
          }
          syncAllCells();
          recordHistory();
          buildInspector();
          syncToolButtons();
        },
      );

      const materialValues = new Set(selected.map(({ x, y }) => materials[y][x]));
      addChoiceInput(
        editForm,
        'Material',
        [
          ...(materialValues.size > 1 ? [{ value: '__mixed__', label: 'Mixed' }] : []),
          { value: '', label: 'Default' },
          ...MATERIAL_TOOLS.map((material) => ({ value: material, label: material })),
        ],
        materialValues.size === 1 ? materials[selected[0].y][selected[0].x] : '__mixed__',
        (value) => {
          if (value === '__mixed__') return;
          selectedMaterial = value;
          for (const { x, y } of selected) materials[y][x] = value;
          setPreviewAsset(value, value ? `Material ${value}` : '');
          syncAllCells();
          recordHistory();
          buildInspector();
          syncToolButtons();
        },
      );
    } else {
      const { x, y } = selectedCell;
      const objects = objectsAt(x, y);
      const editTitle = document.createElement('div');
      editTitle.className = 'level-editor__selection-subtitle';
      editTitle.textContent = 'Edit selected cell';
      selectionPanel.appendChild(editTitle);
      const editForm = document.createElement('div');
      editForm.className = 'level-editor__form level-editor__selection-form';
      selectionPanel.appendChild(editForm);
      const deleteCellButton = makeButton(
        'Delete everything from cell',
        'level-editor__button level-editor__button--danger',
      );
      deleteCellButton.title =
        'Set geometry to Empty and remove the material, entities, lights and triggers';
      deleteCellButton.addEventListener('click', () => {
        const hadSpawn = Math.floor(spawn.x) === x && Math.floor(spawn.y) === y;
        grid[y][x] = 0;
        removeAt(x, y);
        let spawnMoved = false;
        if (hadSpawn) {
          for (let yy = 0; yy < grid.length && !spawnMoved; yy++) {
            for (let xx = 0; xx < grid[yy].length; xx++) {
              if (grid[yy][xx] !== 0 || (xx === x && yy === y)) continue;
              Object.assign(spawn, cellCenter(xx, yy));
              spawnMoved = true;
              break;
            }
          }
        }
        selectedValue = 0;
        selectedMaterial = '';
        setPreviewAsset('', '');
        syncAllCells();
        recordHistory();
        buildInspector();
        syncToolButtons();
        showStatus(status, spawnMoved ? 'Cell cleared; spawn moved' : 'Cell cleared');
      });
      editForm.appendChild(deleteCellButton);

      addChoiceInput(
        editForm,
        'Geometry',
        TILE_TOOLS.map((tool) => ({ value: String(tool.value), label: tool.label })),
        String(grid[y][x]),
        (value) => {
          grid[y][x] = Number(value);
          if (grid[y][x] === 0) materials[y][x] = '';
          selectedValue = grid[y][x];
          const material = effectiveMaterialAt(x, y);
          selectedMaterial =
            material && MATERIAL_TOOLS.some((item) => item === material) ? material : '';
          setPreviewAsset(material, material ? `Material ${material}` : '');
          syncCell(x, y);
          syncCounts();
          recordHistory();
          buildInspector();
          syncToolButtons();
        },
      );

      const legendMaterial = legendMaterialAt(x, y);
      addChoiceInput(
        editForm,
        'Material',
        [
          {
            value: '',
            label: legendMaterial ? `Default (${legendMaterial})` : 'Default (none)',
          },
          ...MATERIAL_TOOLS.map((material) => ({ value: material, label: material })),
        ],
        materials[y][x],
        (value) => {
          materials[y][x] = value;
          const material = effectiveMaterialAt(x, y);
          selectedMaterial =
            material && MATERIAL_TOOLS.some((item) => item === material) ? material : '';
          setPreviewAsset(material, material ? `Material ${material}` : '');
          syncCell(x, y);
          syncCounts();
          recordHistory();
          buildInspector();
          syncToolButtons();
        },
      );

      objects.ent.forEach((entity, entityIndex) => {
        const matchedTool = paletteItemForEntity(entity);
        const entityOptions = ENTITY_TOOLS.map((item) => ({
          value: item.id,
          label: `${item.group} / ${item.label}`,
        }));
        if (!matchedTool) {
          entityOptions.unshift({
            value: '',
            label: `Current (${String(entity.type ?? 'unknown')})`,
          });
        }
        addChoiceInput(
          editForm,
          `Entity ${entityIndex + 1}`,
          entityOptions,
          matchedTool?.id ?? '',
          (value) => {
            const tool = ENTITY_TOOLS.find((item) => item.id === value);
            const index = entities.indexOf(entity);
            if (!tool || index < 0) return;
            const center = cellCenter(x, y);
            const replacement = tool.create(
              typeof entity.x === 'number' ? entity.x : center.x,
              typeof entity.y === 'number' ? entity.y : center.y,
            );
            for (const key of ['enabledInStates', 'disabledInStates', 'enabledIfFlags']) {
              if (entity[key] !== undefined) replacement[key] = structuredClone(entity[key]);
            }
            replacement.id = entity.id ?? replacement.id;
            entities[index] = replacement;
            selectedEntity = tool;
            setPreviewAsset(tool.preview ?? '', `${tool.group} / ${tool.label}`);
            syncCell(x, y);
            syncCounts();
            recordHistory();
            buildInspector();
            syncToolButtons();
          },
        );

        if (typeof entity.sprite === 'string') {
          const spriteOptions = Object.entries(ASSET_MANIFEST)
            .filter(([, assetPath]) => assetPath.includes('/sprites/'))
            .map(([id]) => ({ value: id, label: id }));
          if (!spriteOptions.some((option) => option.value === entity.sprite)) {
            spriteOptions.unshift({ value: entity.sprite, label: entity.sprite });
          }
          addChoiceInput(
            editForm,
            `Sprite ${entityIndex + 1}`,
            spriteOptions,
            entity.sprite,
            (value) => {
              entity.sprite = value;
              setPreviewAsset(value, `Entity sprite ${value}`);
              syncCell(x, y);
              recordHistory();
              buildInspector();
            },
          );
        }

        if (entity.type === 'note' || entity.type === 'message') {
          addTextInput(
            editForm,
            `Title ${entityIndex + 1}`,
            String(entity.title ?? ''),
            false,
            (value) => {
              if (value) entity.title = value;
              else delete entity.title;
              recordHistory();
              buildInspector();
            },
          );
          addTextInput(
            editForm,
            `Text ${entityIndex + 1}`,
            String(entity.text ?? ''),
            true,
            (value) => {
              if (value) entity.text = value;
              else delete entity.text;
              recordHistory();
              buildInspector();
            },
          );
        }
      });

      objects.light.forEach((light, lightIndex) => {
        addNumberInput(
          editForm,
          `Light radius ${lightIndex + 1}`,
          typeof light.radius === 'number' ? light.radius : 5,
          1,
          16,
          0.5,
          (value) => {
            light.radius = value;
            recordHistory();
          },
        );
        addNumberInput(
          editForm,
          `Light intensity ${lightIndex + 1}`,
          typeof light.intensity === 'number' ? light.intensity : 1,
          0,
          2,
          0.05,
          (value) => {
            light.intensity = value;
            recordHistory();
          },
        );
        addColorInput(
          editForm,
          `Light color ${lightIndex + 1}`,
          typeof light.color === 'string' && /^#[0-9a-f]{6}$/i.test(light.color)
            ? light.color
            : '#ffffff',
          (value) => {
            light.color = value;
            syncCell(x, y);
            recordHistory();
          },
        );
        addNumberInput(
          editForm,
          `Color influence ${lightIndex + 1}`,
          typeof light.colorInfluence === 'number' ? light.colorInfluence : 1,
          0,
          2,
          0.05,
          (value) => {
            light.colorInfluence = value;
            recordHistory();
          },
        );
        addChoiceInput(
          editForm,
          `Light mode ${lightIndex + 1}`,
          ['steady', 'flicker', 'emergency', 'pulse', 'organic'].map((mode) => ({
            value: mode,
            label: mode,
          })),
          typeof light.mode === 'string' ? light.mode : 'steady',
          (value) => {
            light.mode = value;
            recordHistory();
          },
        );
      });

      const entries: Array<{ title: string; value: unknown }> = [
        { title: 'Cell', value: { x, y, value: grid[y][x] } },
      ];
      const material = effectiveMaterialAt(x, y);
      if (material) {
        entries.push({
          title: 'Material',
          value: {
            effective: material,
            override: materials[y][x] || null,
            legend: legend[String(grid[y][x])] ?? null,
          },
        });
      }
      if (Math.floor(spawn.x) === x && Math.floor(spawn.y) === y) {
        entries.push({ title: 'Spawn', value: spawn });
      }
      for (const entity of objects.ent) entries.push({ title: 'Entity', value: entity });
      for (const light of objects.light) entries.push({ title: 'Light', value: light });
      for (const trigger of objects.trigger) entries.push({ title: 'Trigger', value: trigger });

      for (const entry of entries) {
        const item = document.createElement('section');
        item.className = 'level-editor__selection-item';
        const title = document.createElement('div');
        title.className = 'level-editor__selection-title';
        title.textContent = entry.title;
        const value = document.createElement('pre');
        value.className = 'level-editor__selection-value';
        value.textContent =
          typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value, null, 2);
        item.append(title, value);
        selectionPanel.appendChild(item);
      }
    }

    const textsTitle = document.createElement('div');
    textsTitle.className = 'level-editor__section-title level-editor__section-title--spaced';
    textsTitle.textContent = 'Texts';
    textsTitle.title = 'Edit messagePools used by notes, cards, inscriptions and other messages.';
    inspector.appendChild(textsTitle);

    const textsPanel = document.createElement('div');
    textsPanel.className = 'level-editor__selection';
    inspector.appendChild(textsPanel);

    const addCategoryForm = document.createElement('div');
    addCategoryForm.className = 'level-editor__form level-editor__selection-form';
    const categoryInput = document.createElement('input');
    categoryInput.type = 'text';
    categoryInput.className = 'level-editor__text-input';
    categoryInput.placeholder = 'New message type';
    const addCategoryButton = makeButton('Add text category');
    const addCategory = () => {
      const messageType = categoryInput.value.trim();
      if (!messageType) {
        showStatus(status, 'Message type is required');
        return;
      }
      if (messagePools[messageType]) {
        showStatus(status, `Message type ${messageType} already exists`);
        return;
      }
      messagePools[messageType] = [];
      recordHistory();
      syncCounts();
      buildInspector();
    };
    addCategoryButton.addEventListener('click', addCategory);
    categoryInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      addCategory();
    });
    addCategoryForm.append(categoryInput, addCategoryButton);
    textsPanel.appendChild(addCategoryForm);

    for (const messageType of Object.keys(messagePools).sort()) {
      const messages = messagePools[messageType];
      const categoryPanel = document.createElement('section');
      categoryPanel.className = 'level-editor__selection-item';
      const categoryTitle = document.createElement('div');
      categoryTitle.className = 'level-editor__selection-title';
      categoryTitle.textContent = `${messageType} (${messages.length})`;
      categoryPanel.appendChild(categoryTitle);

      const categoryActions = document.createElement('div');
      categoryActions.className = 'level-editor__form level-editor__selection-form';
      const addMessageButton = makeButton('Add message');
      addMessageButton.addEventListener('click', () => {
        messages.push({ title: 'New message', text: '', isDocument: true });
        recordHistory();
        syncCounts();
        buildInspector();
      });
      const deleteCategoryButton = makeButton(
        'Delete category',
        'level-editor__button level-editor__button--danger',
      );
      deleteCategoryButton.addEventListener('click', () => {
        delete messagePools[messageType];
        recordHistory();
        syncCounts();
        buildInspector();
      });
      categoryActions.append(addMessageButton, deleteCategoryButton);
      categoryPanel.appendChild(categoryActions);

      messages.forEach((message, messageIndex) => {
        const messageForm = document.createElement('div');
        messageForm.className = 'level-editor__form level-editor__selection-form';
        const messageTitle = document.createElement('div');
        messageTitle.className = 'level-editor__selection-subtitle';
        messageTitle.textContent = `Message ${messageIndex + 1}`;
        messageForm.appendChild(messageTitle);
        addTextInput(messageForm, 'Title', message.title, false, (value) => {
          message.title = value;
          recordHistory();
        });
        addTextInput(messageForm, 'Text', message.text, true, (value) => {
          message.text = value;
          recordHistory();
        });
        addCheckboxInput(messageForm, 'Document', !!message.isDocument, (value) => {
          message.isDocument = value;
          recordHistory();
        });
        const deleteMessageButton = makeButton(
          'Delete message',
          'level-editor__button level-editor__button--danger',
        );
        deleteMessageButton.addEventListener('click', () => {
          messages.splice(messageIndex, 1);
          recordHistory();
          syncCounts();
          buildInspector();
        });
        messageForm.appendChild(deleteMessageButton);
        categoryPanel.appendChild(messageForm);
      });
      textsPanel.appendChild(categoryPanel);
    }

    const materialTitle = document.createElement('div');
    materialTitle.className = 'level-editor__section-title level-editor__section-title--spaced';
    materialTitle.textContent = 'Materials';
    materialTitle.title = 'Wall textures painted as per-cell material overrides.';
    inspector.appendChild(materialTitle);

    const materialList = document.createElement('div');
    materialList.className = 'level-editor__palette';
    inspector.appendChild(materialList);
    for (const material of MATERIAL_TOOLS) {
      const button = makeButton(material, 'level-editor__palette-button') as HTMLButtonElement;
      button.classList.toggle('is-selected', selectedMaterial === material);
      button.title = `Paint the ${material} wall texture on clicked cells.`;
      const previewUrl = assetPreviewUrl(material);
      if (previewUrl) button.style.setProperty('--preview-image', `url("${previewUrl}")`);
      button.addEventListener('click', () => {
        selectedMaterial = material;
        selectedTool = 'material';
        setPreviewAsset(material, `Material ${material}`);
        buildInspector();
        syncToolButtons();
      });
      materialList.appendChild(button);
    }

    const entityTitle = document.createElement('div');
    entityTitle.className = 'level-editor__section-title level-editor__section-title--spaced';
    entityTitle.textContent = 'Entities';
    entityTitle.title = 'Objects placed into the level entities list.';
    inspector.appendChild(entityTitle);

    const entityList = document.createElement('div');
    entityList.className = 'level-editor__palette';
    inspector.appendChild(entityList);
    let lastGroup = '';
    for (const item of ENTITY_TOOLS) {
      if (item.group !== lastGroup) {
        const group = document.createElement('div');
        group.className = 'level-editor__palette-group';
        group.textContent = item.group;
        group.title = PALETTE_GROUP_HINTS[item.group] ?? '';
        entityList.appendChild(group);
        lastGroup = item.group;
      }
      const button = makeButton(item.label, 'level-editor__palette-button') as HTMLButtonElement;
      button.classList.toggle('is-selected', selectedEntity.id === item.id);
      button.title = `${item.group} / ${item.label}\n${paletteItemHint(item)}`;
      const previewUrl = assetPreviewUrl(item.preview);
      if (previewUrl) button.style.setProperty('--preview-image', `url("${previewUrl}")`);
      button.addEventListener('click', () => {
        selectedEntity = item;
        selectedTool = 'entity';
        setPreviewAsset(item.preview ?? '', `${item.group} / ${item.label}`);
        buildInspector();
        syncToolButtons();
      });
      entityList.appendChild(button);
      paletteButtons.push(button);
    }

    const selectedEntitySample = selectedEntity.create(0.5, 0.5);
    if (selectedEntitySample.type === 'note') {
      const noteTitle = document.createElement('div');
      noteTitle.className = 'level-editor__section-title level-editor__section-title--spaced';
      noteTitle.textContent = 'New note text';
      noteTitle.title = 'Optional text stored directly on newly placed notes.';
      inspector.appendChild(noteTitle);

      const noteForm = document.createElement('div');
      noteForm.className = 'level-editor__form';
      inspector.appendChild(noteForm);
      addTextInput(noteForm, 'Title', noteDraft.title, false, (value) => {
        noteDraft.title = value;
      });
      addTextInput(noteForm, 'Text', noteDraft.text, true, (value) => {
        noteDraft.text = value;
      });
    }

    const lightTitle = document.createElement('div');
    lightTitle.className = 'level-editor__section-title level-editor__section-title--spaced';
    lightTitle.textContent = 'Light';
    lightTitle.title = 'Configure a light source, then click a map cell to place it.';
    inspector.appendChild(lightTitle);

    const lightForm = document.createElement('div');
    lightForm.className = 'level-editor__form';
    inspector.appendChild(lightForm);
    addNumberInput(lightForm, 'Radius', lightDraft.radius, 1, 16, 0.5, (value) => {
      lightDraft.radius = value;
      selectedTool = 'light';
      syncToolButtons();
    });
    addNumberInput(lightForm, 'Intensity', lightDraft.intensity, 0, 2, 0.05, (value) => {
      lightDraft.intensity = value;
      selectedTool = 'light';
      syncToolButtons();
    });
    addColorInput(lightForm, 'Color', lightDraft.color, (value) => {
      lightDraft.color = value;
      selectedTool = 'light';
      syncToolButtons();
    });
    addNumberInput(lightForm, 'Color influence', lightDraft.colorInfluence, 0, 2, 0.05, (value) => {
      lightDraft.colorInfluence = value;
      selectedTool = 'light';
      syncToolButtons();
    });
    addSelectInput(
      lightForm,
      'Mode',
      ['steady', 'flicker', 'emergency', 'pulse', 'organic'],
      lightDraft.mode,
      (value) => {
        lightDraft.mode = value as LightMode;
        selectedTool = 'light';
        syncToolButtons();
      },
    );

    const triggerTitle = document.createElement('div');
    triggerTitle.className = 'level-editor__section-title level-editor__section-title--spaced';
    triggerTitle.textContent = 'Sound Trigger';
    triggerTitle.title = 'Configure a sound, then click a cell to create an enter-zone trigger.';
    inspector.appendChild(triggerTitle);

    const triggerForm = document.createElement('div');
    triggerForm.className = 'level-editor__form';
    inspector.appendChild(triggerForm);
    addSelectInput(triggerForm, 'Sound', [...TRIGGER_SOUNDS], triggerDraft.sound, (value) => {
      triggerDraft.sound = value;
      selectedTool = 'trigger';
      syncToolButtons();
    });
    addNumberInput(triggerForm, 'Volume', triggerDraft.volume, 0, 1, 0.05, (value) => {
      triggerDraft.volume = value;
      selectedTool = 'trigger';
      syncToolButtons();
    });
    addCheckboxInput(triggerForm, 'Once', triggerDraft.once, (value) => {
      triggerDraft.once = value;
      selectedTool = 'trigger';
      syncToolButtons();
    });
  };

  closeButton.addEventListener('click', closeEditor, { signal: controller.signal });
  saveButton.addEventListener('click', () => {
    void saveLevel()
      .then(() => showStatus(status, 'Saved'))
      .catch((err) => showStatus(status, err instanceof Error ? err.message : 'Save failed'));
  });
  playtestButton.addEventListener('click', () => {
    if (!options.onPlaytest) return;
    playtestButton.disabled = true;
    showStatus(status, 'Saving level...');
    void saveLevel()
      .then(() => options.onPlaytest?.(path))
      .then(() => closeEditor())
      .catch((err) => {
        playtestButton.disabled = false;
        showStatus(status, err instanceof Error ? err.message : 'Playtest failed');
      });
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (!root.isConnected) {
      window.removeEventListener('keydown', onKeyDown, true);
      return;
    }
    if (e.code === 'Escape') {
      e.preventDefault();
      if (!assetViewer.hidden) {
        closeAssetViewer();
        return;
      }
      closeEditor();
      return;
    }
    if (!assetViewer.hidden && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
      e.preventDefault();
      const offset = e.code === 'ArrowLeft' ? -1 : 1;
      void renderAssetFrame(
        Math.max(0, Math.min(viewerFrames.length - 1, viewerFrameIndex + offset)),
      );
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
      e.preventDefault();
      void saveLevel()
        .then(() => showStatus(status, 'Saved'))
        .catch((err) => showStatus(status, err instanceof Error ? err.message : 'Save failed'));
      return;
    }
    const target = e.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
      e.preventDefault();
      selectAllCells();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
      e.preventDefault();
      stepHistory(e.shiftKey ? 1 : -1);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
      e.preventDefault();
      stepHistory(1);
      return;
    }
    if (e.code === 'KeyS') {
      e.preventDefault();
      setTool('spawn');
      return;
    }
    if (e.code === 'KeyM') {
      e.preventDefault();
      setTool('material');
      return;
    }
    if (e.code === 'KeyE') {
      e.preventDefault();
      setTool('entity');
      return;
    }
    if (e.code === 'KeyL') {
      e.preventDefault();
      setTool('light');
      return;
    }
    if (e.code === 'KeyT') {
      e.preventDefault();
      setTool('trigger');
      return;
    }
    if (e.code === 'KeyX') {
      e.preventDefault();
      setTool('erase');
      return;
    }
    if (e.code === 'KeyF') {
      e.preventDefault();
      setTool('fill');
      return;
    }
    if (e.code === 'KeyI') {
      e.preventDefault();
      setTool('inspect');
      return;
    }
    if (e.key === '+' || e.code === 'Equal') {
      e.preventDefault();
      setZoom(cellSize + 2);
      return;
    }
    if (e.key === '-' || e.code === 'Minus') {
      e.preventDefault();
      setZoom(cellSize - 2);
      return;
    }
    const found = TILE_TOOLS.find((tool) => tool.key === e.code || e.key === String(tool.value));
    if (found) {
      e.preventDefault();
      selectTile(found.value);
    }
  };

  window.addEventListener('keydown', onKeyDown, { capture: true, signal: controller.signal });
  window.addEventListener(
    'pointerup',
    () => {
      painting = false;
    },
    { capture: true, signal: controller.signal },
  );

  history.push(captureSnapshot());
  setZoom(cellSize);
  buildInspector();
  syncToolButtons();
  syncAllCells();
  syncHistory();

  return closeEditor;
}

function addNumberInput(
  parent: HTMLElement,
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  onInput: (value: number) => void,
) {
  const row = document.createElement('label');
  row.className = 'level-editor__field';
  const caption = document.createElement('span');
  caption.textContent = label;
  const input = document.createElement('input');
  input.type = 'number';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.addEventListener('input', () => {
    const next = Number(input.value);
    if (Number.isFinite(next)) onInput(Math.max(min, Math.min(max, next)));
  });
  row.append(caption, input);
  parent.appendChild(row);
}

function addColorInput(
  parent: HTMLElement,
  label: string,
  value: string,
  onInput: (value: string) => void,
) {
  const row = document.createElement('label');
  row.className = 'level-editor__field';
  const caption = document.createElement('span');
  caption.textContent = label;
  const input = document.createElement('input');
  input.type = 'color';
  input.value = value;
  input.addEventListener('input', () => onInput(input.value));
  row.append(caption, input);
  parent.appendChild(row);
}

function addTextInput(
  parent: HTMLElement,
  label: string,
  value: string,
  multiline: boolean,
  onChange: (value: string) => void,
) {
  const row = document.createElement('label');
  row.className = 'level-editor__field';
  const caption = document.createElement('span');
  caption.textContent = label;
  const input = multiline ? document.createElement('textarea') : document.createElement('input');
  if (input instanceof HTMLTextAreaElement) input.rows = 4;
  else input.type = 'text';
  input.value = value;
  input.addEventListener('change', () => onChange(input.value));
  row.append(caption, input);
  parent.appendChild(row);
}

function addSelectInput(
  parent: HTMLElement,
  label: string,
  options: string[],
  value: string,
  onInput: (value: string) => void,
) {
  const row = document.createElement('label');
  row.className = 'level-editor__field';
  const caption = document.createElement('span');
  caption.textContent = label;
  const input = document.createElement('select');
  for (const option of options) {
    const el = document.createElement('option');
    el.value = option;
    el.textContent = option;
    input.appendChild(el);
  }
  input.value = value;
  input.addEventListener('input', () => onInput(input.value));
  row.append(caption, input);
  parent.appendChild(row);
}

function addChoiceInput(
  parent: HTMLElement,
  label: string,
  options: Array<{ value: string; label: string }>,
  value: string,
  onInput: (value: string) => void,
) {
  const row = document.createElement('label');
  row.className = 'level-editor__field';
  const caption = document.createElement('span');
  caption.textContent = label;
  const input = document.createElement('select');
  for (const option of options) {
    const el = document.createElement('option');
    el.value = option.value;
    el.textContent = option.label;
    input.appendChild(el);
  }
  input.value = value;
  input.addEventListener('input', () => onInput(input.value));
  row.append(caption, input);
  parent.appendChild(row);
}

function addCheckboxInput(
  parent: HTMLElement,
  label: string,
  value: boolean,
  onInput: (value: boolean) => void,
) {
  const row = document.createElement('label');
  row.className = 'level-editor__field level-editor__field--checkbox';
  const caption = document.createElement('span');
  caption.textContent = label;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = value;
  input.addEventListener('input', () => onInput(input.checked));
  row.append(caption, input);
  parent.appendChild(row);
}
