import { ASSET_MANIFEST } from '../assets/manifest';
import { assetUrl } from '../content/content';

const LEVEL_SAVE_ROUTE = '/__palata/level-editor/save';

type LevelJson = Record<string, unknown> & {
  geometry?: unknown;
  rows?: unknown;
  spawn?: unknown;
  materialsWall?: unknown;
  entities?: unknown;
  lights?: unknown;
  triggers?: unknown;
};

type EditorTool =
  | 'cell'
  | 'spawn'
  | 'material'
  | 'entity'
  | 'light'
  | 'trigger'
  | 'erase'
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
  preview?: string;
  create: (x: number, y: number) => Record<string, unknown>;
};

type LightMode = 'steady' | 'flicker' | 'emergency' | 'pulse' | 'organic';

type LightDraft = {
  radius: number;
  intensity: number;
  color: string;
  mode: LightMode;
};

type TriggerDraft = {
  sound: string;
  volume: number;
  once: boolean;
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

function makeLockTool(keyId: 'gold' | 'silver' | 'blood'): PaletteItem {
  return {
    id: `lock_${keyId}`,
    label: `${keyId} lock`,
    group: 'Keys',
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
    preview,
    create: (x, y) => ({ id: makeEntityId(subtype, x, y), type: 'weapon', subtype, x, y }),
  };
}

function makeEnemyTool(kind: string, label: string, preview: string): PaletteItem {
  return {
    id: `enemy_${kind}`,
    label,
    group: 'Enemies',
    preview,
    create: (x, y) => ({ id: makeEntityId(kind, x, y), type: 'enemy_spawn', kind, x, y }),
  };
}

function makePropTool(sprite: string, label: string, scale = 0.55): PaletteItem {
  return {
    id: sprite,
    label,
    group: 'Props',
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
    preview: 'keyGold',
    create: (x, y) => ({ id: makeEntityId('gold_key', x, y), type: 'key', subtype: 'gold', x, y }),
  },
  {
    id: 'key_silver',
    label: 'Silver key',
    group: 'Keys',
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
  const res = await fetch(assetUrl(path));
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

export async function openLevelEditor(levelFile: string | number) {
  const existing = document.getElementById('levelEditorRoot');
  if (existing) existing.remove();

  const { path, data } = await loadLevelJson(levelFile);
  const closeEditor = mountLevelEditor(path, data);

  return {
    path,
    close: closeEditor,
  };
}

export function openBlankLevelEditor() {
  const existing = document.getElementById('levelEditorRoot');
  if (existing) existing.remove();
  return mountLevelEditor('/assets/data/levels/level.json', structuredClone(DEFAULT_LEVEL));
}

function mountLevelEditor(path: string, level: LevelJson) {
  const host = document.getElementById('canvas1') ?? document.body;
  const { sourceKey, rows } = readRows(level);
  const grid = rowsToGrid(rows);
  const materials = readMaterials(level, grid);
  const entities = readObjects<Record<string, unknown>>(level.entities);
  const lights = readObjects<Record<string, unknown>>(level.lights);
  const triggers = readObjects<Record<string, unknown>>(level.triggers);
  const spawn = readSpawn(level);
  const hadMaterials = Array.isArray(level.materialsWall);
  const hadEntities = Array.isArray(level.entities);
  const hadLights = Array.isArray(level.lights);
  const hadTriggers = Array.isArray(level.triggers);

  let selectedTool: EditorTool = 'cell';
  let selectedValue = 1;
  let selectedMaterial: string = MATERIAL_TOOLS[0];
  let selectedEntity = ENTITY_TOOLS[0];
  let painting = false;
  let cellSize = 16;
  let selectedCell: { x: number; y: number } | null = null;
  const lightDraft: LightDraft = { radius: 5, intensity: 0.8, color: '#ffffff', mode: 'steady' };
  const triggerDraft: TriggerDraft = { sound: TRIGGER_SOUNDS[0], volume: 0.55, once: true };

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

  const saveButton = makeButton('Save level');
  const closeButton = makeButton('Close');
  headerActions.append(saveButton, closeButton);
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

  const toolList = document.createElement('div');
  toolList.className = 'level-editor__tools';
  sidebar.appendChild(toolList);

  const spawnButton = makeButton('S Spawn', 'level-editor__tool');
  const materialButton = makeButton('M Material', 'level-editor__tool');
  const entityButton = makeButton('E Entity', 'level-editor__tool');
  const lightButton = makeButton('L Light', 'level-editor__tool');
  const triggerButton = makeButton('T Sound zone', 'level-editor__tool');
  const eraseButton = makeButton('X Erase object', 'level-editor__tool');
  const inspectButton = makeButton('I Inspect', 'level-editor__tool');
  spawnButton.title = 'Move player spawn';
  materialButton.title = 'Paint wall material overrides';
  entityButton.title = 'Place selected entity';
  lightButton.title = 'Place light source';
  triggerButton.title = 'Place one-tile enter_zone sound trigger';
  eraseButton.title = 'Remove objects/materials from a cell';
  inspectButton.title = 'Select a map element and view its properties';
  toolList.append(
    spawnButton,
    materialButton,
    entityButton,
    lightButton,
    triggerButton,
    eraseButton,
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
    'Paint cells with mouse. Use digits for geometry, S/M/E/L/T/X/I for modes. Use +/- to zoom. Save writes into the level file.';
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

  const cells: HTMLElement[][] = [];
  const paletteButtons: HTMLButtonElement[] = [];

  const syncToolButtons = () => {
    spawnButton.classList.toggle('is-selected', selectedTool === 'spawn');
    materialButton.classList.toggle('is-selected', selectedTool === 'material');
    entityButton.classList.toggle('is-selected', selectedTool === 'entity');
    lightButton.classList.toggle('is-selected', selectedTool === 'light');
    triggerButton.classList.toggle('is-selected', selectedTool === 'trigger');
    eraseButton.classList.toggle('is-selected', selectedTool === 'erase');
    inspectButton.classList.toggle('is-selected', selectedTool === 'inspect');
    for (const { tool, button } of tileButtons) {
      button.classList.toggle(
        'is-selected',
        selectedTool === 'cell' && tool.value === selectedValue,
      );
    }
  };

  const syncSpawnInfo = () => {
    spawnInfo.textContent = `${spawn.x.toFixed(1)}, ${spawn.y.toFixed(1)}, rot ${spawn.rot.toFixed(2)}`;
  };

  const syncCounts = () => {
    const materialCount = compactMaterials(materials).length;
    countsInfo.textContent = `${entities.length} ent / ${lights.length} light / ${triggers.length} trig / ${materialCount} mat`;
  };

  const setZoom = (next: number) => {
    cellSize = Math.max(10, Math.min(40, Math.round(next / 2) * 2));
    gridEl.style.setProperty('--level-editor-cell', `${cellSize}px`);
    zoomRange.value = String(cellSize);
    zoomValue.textContent = `${cellSize}px`;
  };

  const objectsAt = (x: number, y: number) => {
    const ent = entities.filter((e) => objectCell(e.x) === x && objectCell(e.y) === y);
    const light = lights.filter((l) => objectCell(l.x) === x && objectCell(l.y) === y);
    const trigger = triggers.filter((t) => {
      const zone = t.trigger as { x?: unknown; y?: unknown } | undefined;
      return objectCell(zone?.x) === x && objectCell(zone?.y) === y;
    });
    return { ent, light, trigger };
  };

  const cellTitle = (x: number, y: number) => {
    const objects = objectsAt(x, y);
    const parts = [`${x},${y}: ${grid[y][x]}`];
    if (materials[y][x]) parts.push(`mat ${materials[y][x]}`);
    if (objects.ent.length) parts.push(`${objects.ent.length} entities`);
    if (objects.light.length) parts.push(`${objects.light.length} lights`);
    if (objects.trigger.length) parts.push(`${objects.trigger.length} triggers`);
    return parts.join(' | ');
  };

  const syncCell = (x: number, y: number) => {
    const cell = cells[y]?.[x];
    if (!cell) return;
    const objects = objectsAt(x, y);
    cell.dataset.value = String(grid[y][x]);
    cell.dataset.material = materials[y][x] ? '1' : '0';
    cell.classList.toggle('has-spawn', Math.floor(spawn.x) === x && Math.floor(spawn.y) === y);
    cell.classList.toggle('has-entity', objects.ent.length > 0);
    cell.classList.toggle('has-light', objects.light.length > 0);
    cell.classList.toggle('has-trigger', objects.trigger.length > 0);
    cell.classList.toggle('is-selected', selectedCell?.x === x && selectedCell.y === y);
    cell.title = cellTitle(x, y);
    cell.replaceChildren();
    if (materials[y][x]) {
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
    if (objects.light.length) {
      const marker = document.createElement('span');
      marker.className = 'level-editor__marker level-editor__marker--light';
      marker.textContent = 'L';
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
      return;
    }
    if (selectedTool === 'material') {
      materials[y][x] = selectedMaterial;
      syncCell(x, y);
      syncCounts();
      return;
    }
    if (selectedTool === 'entity') {
      entities.push(selectedEntity.create(center.x, center.y));
      syncCell(x, y);
      syncCounts();
      return;
    }
    if (selectedTool === 'light') {
      lights.push({
        x: center.x,
        y: center.y,
        radius: lightDraft.radius,
        intensity: lightDraft.intensity,
        color: lightDraft.color,
        mode: lightDraft.mode,
      });
      syncCell(x, y);
      syncCounts();
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
      return;
    }
    if (selectedTool === 'erase') {
      removeAt(x, y);
      return;
    }
    grid[y][x] = selectedValue;
    syncCell(x, y);
  };

  const selectCell = (x: number, y: number) => {
    if (!grid[y] || grid[y][x] === undefined) return;
    const prev = selectedCell;
    selectedCell = { x, y };
    if (prev) syncCell(prev.x, prev.y);
    syncCell(x, y);
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
  };

  for (let y = 0; y < grid.length; y++) {
    cells[y] = [];
    for (let x = 0; x < grid[y].length; x++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'level-editor__cell';
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      cell.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        painting = true;
        selectCell(x, y);
        if (selectedTool === 'inspect') return;
        applyAt(x, y);
      });
      cell.addEventListener('pointerenter', () => {
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

  const selectTile = (value: number) => {
    selectedTool = 'cell';
    selectedValue = value;
    syncToolButtons();
  };

  const setTool = (tool: EditorTool) => {
    selectedTool = tool;
    syncToolButtons();
  };

  spawnButton.addEventListener('click', () => setTool('spawn'));
  materialButton.addEventListener('click', () => setTool('material'));
  entityButton.addEventListener('click', () => setTool('entity'));
  lightButton.addEventListener('click', () => setTool('light'));
  triggerButton.addEventListener('click', () => setTool('trigger'));
  eraseButton.addEventListener('click', () => setTool('erase'));
  inspectButton.addEventListener('click', () => setTool('inspect'));

  for (const { tool, button } of tileButtons) {
    button.addEventListener('click', () => selectTile(tool.value));
  }

  zoomOutButton.addEventListener('click', () => setZoom(cellSize - 2));
  zoomInButton.addEventListener('click', () => setZoom(cellSize + 2));
  zoomRange.addEventListener('input', () => setZoom(Number(zoomRange.value)));

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
    } else {
      const { x, y } = selectedCell;
      const objects = objectsAt(x, y);
      const entries: Array<{ title: string; value: unknown }> = [
        { title: 'Cell', value: { x, y, value: grid[y][x] } },
      ];
      if (materials[y][x]) entries.push({ title: 'Material', value: materials[y][x] });
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

    const materialTitle = document.createElement('div');
    materialTitle.className = 'level-editor__section-title level-editor__section-title--spaced';
    materialTitle.textContent = 'Materials';
    inspector.appendChild(materialTitle);

    const materialList = document.createElement('div');
    materialList.className = 'level-editor__palette';
    inspector.appendChild(materialList);
    for (const material of MATERIAL_TOOLS) {
      const button = makeButton(material, 'level-editor__palette-button') as HTMLButtonElement;
      button.classList.toggle('is-selected', selectedMaterial === material);
      const previewUrl = assetPreviewUrl(material);
      if (previewUrl) button.style.setProperty('--preview-image', `url("${previewUrl}")`);
      button.addEventListener('click', () => {
        selectedMaterial = material;
        selectedTool = 'material';
        buildInspector();
        syncToolButtons();
      });
      materialList.appendChild(button);
    }

    const entityTitle = document.createElement('div');
    entityTitle.className = 'level-editor__section-title level-editor__section-title--spaced';
    entityTitle.textContent = 'Entities';
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
        entityList.appendChild(group);
        lastGroup = item.group;
      }
      const button = makeButton(item.label, 'level-editor__palette-button') as HTMLButtonElement;
      button.classList.toggle('is-selected', selectedEntity.id === item.id);
      const previewUrl = assetPreviewUrl(item.preview);
      if (previewUrl) button.style.setProperty('--preview-image', `url("${previewUrl}")`);
      button.addEventListener('click', () => {
        selectedEntity = item;
        selectedTool = 'entity';
        buildInspector();
        syncToolButtons();
      });
      entityList.appendChild(button);
      paletteButtons.push(button);
    }

    const lightTitle = document.createElement('div');
    lightTitle.className = 'level-editor__section-title level-editor__section-title--spaced';
    lightTitle.textContent = 'Light';
    inspector.appendChild(lightTitle);

    const lightForm = document.createElement('div');
    lightForm.className = 'level-editor__form';
    inspector.appendChild(lightForm);
    addNumberInput(lightForm, 'Radius', lightDraft.radius, 1, 16, 0.5, (value) => {
      lightDraft.radius = value;
      selectedTool = 'light';
      syncToolButtons();
    });
    addNumberInput(lightForm, 'Intensity', lightDraft.intensity, 0.05, 2, 0.05, (value) => {
      lightDraft.intensity = value;
      selectedTool = 'light';
      syncToolButtons();
    });
    addColorInput(lightForm, 'Color', lightDraft.color, (value) => {
      lightDraft.color = value;
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

  const onKeyDown = (e: KeyboardEvent) => {
    if (!root.isConnected) {
      window.removeEventListener('keydown', onKeyDown, true);
      return;
    }
    if (e.code === 'Escape') {
      e.preventDefault();
      closeEditor();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
      e.preventDefault();
      void saveLevel()
        .then(() => showStatus(status, 'Saved'))
        .catch((err) => showStatus(status, err instanceof Error ? err.message : 'Save failed'));
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

  sizeInfo.textContent = `${grid[0]?.length ?? 0} x ${grid.length}`;
  setZoom(cellSize);
  buildInspector();
  syncToolButtons();
  syncAllCells();

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
