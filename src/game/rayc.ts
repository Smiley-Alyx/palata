import type { Legend, Player, Spawn } from '../types/game';
import { createEngine } from '../engine/engine';
import { getCanvas, getCanvasCssHeight, getCanvasCssWidth, getCtx } from '../canvas-init';
import { createInput } from '../input/input';
import { createRenderer } from './render/renderer';
import { AudioManager } from './audio/audio-manager';
import { DEFAULT_SFX, SFX } from './audio/sfx-config';
import {
  getCellMaterial,
  getMap,
  setLegend as setLegendState,
  setMap as setMapState,
  setMaterialsWall as setMaterialsWallState,
  getMaterialsWall as getMaterialsWallState,
} from '../state/map-state';
import { createDoorsSystem, type KeyId } from './systems/doors';
import { createEnemiesSystem } from './systems/enemies';
import { createPickupsSystem } from './systems/pickups';
import { createTriggersSystem } from './systems/triggers';
import { createLightsSystem } from './systems/lights';
import { createWorldStateSystem } from './systems/world-state';
import { createWorldAdapter } from './world/world-adapter';
import type { Difficulty, EnemyKind } from './game-types';
import type { RayHit } from '../raycast/raycaster';
import type { LevelTriggerJson } from './levels/level-loader';
import type { LevelLightJson } from './levels/level-loader';
import type { LevelWorldStatesJson } from './levels/level-loader';
import type { LevelEntityJson } from './levels/level-loader';
import type { LevelTriggerActionJson } from './levels/level-loader';
import { showNoteOverlay } from './ui/note-overlay';

type EngineInstance = ReturnType<typeof createEngine>;

type RendererInstance = ReturnType<typeof createRenderer>;

type PlayerInstance = Player;

export type { Difficulty, EnemyKind };

let engine: EngineInstance | null = null;
let renderer: RendererInstance | null = null;

let doorsSystem: ReturnType<typeof createDoorsSystem> | null = null;
let enemiesSystem: ReturnType<typeof createEnemiesSystem> | null = null;
let pickupsSystem: ReturnType<typeof createPickupsSystem> | null = null;
let triggersSystem: ReturnType<typeof createTriggersSystem> | null = null;
let lightsSystem: ReturnType<typeof createLightsSystem> | null = null;
let worldStateSystem: ReturnType<typeof createWorldStateSystem> | null = null;

let rawTriggers: LevelTriggerJson[] = [];
let rawLights: LevelLightJson[] = [];
let rawEntities: LevelEntityJson[] = [];
let entityIdSeq = 1;

let activeInteractables: Array<{
  id?: string;
  type: string;
  x: number;
  y: number;
  [k: string]: unknown;
}> = [];

function applyEntityAction(a: LevelTriggerActionJson) {
  if (a.type === 'play_sound') {
    const key = a.sound as Parameters<AudioManager['playSfx']>[0];
    audio.playSfx(key, typeof a.volume === 'number' ? a.volume : 0.7);
    return;
  }

  if (a.type === 'change_wall_material') {
    const grid = getMaterialsWallState();
    if (!grid || !grid.length || !grid[0]?.length) return;
    const x = Math.floor(a.x);
    const y = Math.floor(a.y);
    if (y < 0 || y >= grid.length) return;
    if (x < 0 || x >= (grid[0]?.length ?? 0)) return;

    const next = grid.map((row) => row.slice());
    next[y][x] = a.material;
    setMaterialsWallState(next);
    return;
  }

  if (a.type === 'spawn_entity') {
    spawnEntityRuntime(a.entity);
    return;
  }

  if (a.type === 'despawn_entity') {
    despawnEntityRuntime(a.id);
    return;
  }

  if (a.type === 'set_state') {
    worldStateSystem?.setState(a.state, a.value);
    return;
  }

  if (a.type === 'toggle_state') {
    worldStateSystem?.toggleState(a.state);
    return;
  }

  if (a.type === 'set_flag') {
    worldStateSystem?.setFlag(a.flag, a.value);
    return;
  }

  if (a.type === 'toggle_flag') {
    worldStateSystem?.toggleFlag(a.flag);
    return;
  }
}

function interactWithEntities(xWorld: number, yWorld: number): boolean {
  if (!activeInteractables.length) return false;

  const xMap = Math.floor(xWorld);
  const yMap = Math.floor(yWorld);

  for (const e of activeInteractables) {
    if (Math.floor(e.x) !== xMap || Math.floor(e.y) !== yMap) continue;

    if (e.type === 'note') {
      const title = typeof (e as any).title === 'string' ? ((e as any).title as string) : 'Note';
      const text = typeof (e as any).text === 'string' ? ((e as any).text as string) : '';
      showNoteOverlay(title, text);
      return true;
    }

    if (e.type === 'button' || e.type === 'switch') {
      const actions = (e as any).actions;
      if (Array.isArray(actions)) {
        for (const a of actions) {
          if (!a || typeof a !== 'object') continue;
          if (typeof (a as any).type !== 'string') continue;
          applyEntityAction(a as LevelTriggerActionJson);
        }
      }
      return true;
    }

    if (e.type === 'door') {
      doorsSystem?.requestOpenDoor(xMap, yMap, ownedKeys);
      return true;
    }
  }

  return false;
}

function reapplyEntities() {
  const ws = worldStateSystem;
  if (!ws) return;
  const enabled = rawEntities.filter((e) => ws.isEnabled(e));

  activeInteractables = enabled.filter(
    (e) => e.type === 'note' || e.type === 'button' || e.type === 'switch' || e.type === 'door',
  );

  const keyPickupsFromEntities: Array<{ x: number; y: number; id: KeyId }> = [];
  const doorLocksFromEntities: Array<{ x: number; y: number; id: KeyId }> = [];
  const healthPickupsFromEntities: Array<{ x: number; y: number }> = [];
  const enemiesFromEntities: Array<{ x: number; y: number; kind?: EnemyKind }> = [];

  for (const e of enabled) {
    if (!e || typeof e !== 'object') continue;
    if (e.type === 'key') {
      const keyId = (e.subtype ?? '') as string;
      if (keyId === 'gold' || keyId === 'silver' || keyId === 'blood') {
        keyPickupsFromEntities.push({ x: e.x, y: e.y, id: keyId });
      }
    }
    if (e.type === 'door_lock') {
      const keyId = (e as { keyId?: unknown }).keyId;
      if (keyId === 'gold' || keyId === 'silver' || keyId === 'blood') {
        doorLocksFromEntities.push({ x: Math.floor(e.x), y: Math.floor(e.y), id: keyId });
      }
    }

    if (e.type === 'health_pickup' || e.type === 'health') {
      healthPickupsFromEntities.push({ x: e.x, y: e.y });
    }

    if (e.type === 'enemy_spawn') {
      const kind = (e as { kind?: unknown }).kind;
      enemiesFromEntities.push({
        x: e.x,
        y: e.y,
        kind: kind === 'ghost' || kind === 'zombie' ? kind : undefined,
      });
    }
  }

  pickupsSystem?.setKeyPickups(keyPickupsFromEntities);
  pickupsSystem?.setHealthPickups(healthPickupsFromEntities);
  doorsSystem?.setDoorLocks(doorLocksFromEntities);
  if (enemiesFromEntities.length) {
    enemiesSystem?.setEnemies(enemiesFromEntities);
  }
}

function spawnEntityRuntime(entity: unknown) {
  if (!entity || typeof entity !== 'object') return;
  const e = entity as Partial<LevelEntityJson>;
  if (typeof e.type !== 'string') return;
  if (typeof e.x !== 'number' || typeof e.y !== 'number') return;

  const id = typeof e.id === 'string' && e.id.length ? e.id : `e_${entityIdSeq++}`;
  rawEntities = rawEntities.concat([{ ...(e as LevelEntityJson), id }]);
  reapplyEntities();
}

function despawnEntityRuntime(id: string) {
  if (typeof id !== 'string' || !id) return;
  const before = rawEntities.length;
  rawEntities = rawEntities.filter((e) => e.id !== id);
  if (rawEntities.length !== before) reapplyEntities();
}

export function setEntities(next: LevelEntityJson[]) {
  ensureEngine();
  rawEntities = Array.isArray(next) ? next : [];
  reapplyEntities();
}

let currentDifficulty: Difficulty = 'lost';

const ownedKeys: Record<KeyId, boolean> = {
  gold: false,
  silver: false,
  blood: false,
};

export function resetKeys() {
  ownedKeys.gold = false;
  ownedKeys.silver = false;
  ownedKeys.blood = false;
}

export function getKeys() {
  return ownedKeys;
}

type WallFace = 'N' | 'S' | 'E' | 'W';

type AtlasKind = 'wall' | 'door' | 'stand';

function getAtlasKind(m: string | number): AtlasKind | null {
  if (m === 'wall' || m === 'brick' || m === 1) return 'wall';
  if (m === 'door' || m === 6 || m === 3) return 'door';
  if (m === 'stand' || m === 4) return 'stand';
  return null;
}

function encodeAtlasTextureId(kind: AtlasKind, tile: number): number {
  const t = ((tile % 16) + 16) % 16;
  if (kind === 'wall') return 100 + t;
  if (kind === 'door') return 200 + t;
  return 300 + t;
}

function getAtlasVariantTextureId({
  map,
  xMap,
  yMap,
  face,
  isVerticalHit,
  kind,
}: {
  map: number[][];
  xMap: number;
  yMap: number;
  face: WallFace;
  isVerticalHit: boolean;
  kind: AtlasKind;
}): number {
  const w = map[0]?.length ?? 0;
  const h = map.length;

  const isSameKind = (x: number, y: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    const m = getCellMaterial(x, y);
    return getAtlasKind(m) === kind;
  };

  let segStart = 0;
  if (isVerticalHit) {
    segStart = yMap;
    while (segStart > 0 && isSameKind(xMap, segStart - 1)) segStart--;

    const parity = Math.abs(xMap) % 2;
    const salt = kind === 'door' ? 101 : kind === 'stand' ? 203 : 307;
    const base = Math.abs(segStart * 7 + (face === 'W' ? 13 : 29) + salt) % 16;
    const tile = parity === 0 ? base : (base + 1) % 16;
    return encodeAtlasTextureId(kind, tile);
  }

  segStart = xMap;
  while (segStart > 0 && isSameKind(segStart - 1, yMap)) segStart--;

  const parity = Math.abs(yMap) % 2;
  const salt = kind === 'door' ? 101 : kind === 'stand' ? 203 : 307;
  const base = Math.abs(segStart * 7 + (face === 'S' ? 17 : 31) + salt) % 16;
  const tile = parity === 0 ? base : (base + 1) % 16;
  return encodeAtlasTextureId(kind, tile);
}

function getWallTextureId(hit: RayHit<string | number>): string | number {
  const map = getMap();
  if (!map) return hit.material;
  const kind = getAtlasKind(hit.material);
  if (!kind) return hit.material;
  const face = hit.face as WallFace;
  return getAtlasVariantTextureId({
    map,
    xMap: hit.xMap,
    yMap: hit.yMap,
    face,
    isVerticalHit: hit.isVerticalHit,
    kind,
  });
}

export function setDifficulty(difficulty: Difficulty) {
  currentDifficulty = difficulty;
}

export function setEnemies(next: Array<{ x: number; y: number; kind?: EnemyKind }>) {
  ensureEngine();
  enemiesSystem?.setEnemies(next);
}

export function getEnemies() {
  ensureEngine();
  return enemiesSystem?.getEnemies() ?? [];
}

export function setHealthPickups(next: Array<{ x: number; y: number }>) {
  ensureEngine();
  pickupsSystem?.setHealthPickups(next);
}

export function setKeyPickups(next: Array<{ x: number; y: number; id: KeyId }>) {
  ensureEngine();
  pickupsSystem?.setKeyPickups(next);
}

export function setDoorLocks(next: Array<{ x: number; y: number; id: KeyId }>) {
  ensureEngine();
  doorsSystem?.setDoorLocks(next);
}

export function setTriggers(next: LevelTriggerJson[]) {
  ensureEngine();
  rawTriggers = Array.isArray(next) ? next : [];
  const enabled = rawTriggers.filter((t) => worldStateSystem?.isEnabled(t) ?? true);
  triggersSystem?.setTriggers(enabled);
}

export function setLights(next: LevelLightJson[]) {
  ensureEngine();
  rawLights = Array.isArray(next) ? next : [];
  const enabled = rawLights.filter((l) => worldStateSystem?.isEnabled(l) ?? true);
  lightsSystem?.setLights(enabled);
}

export function setWorldStates(config: LevelWorldStatesJson | null) {
  ensureEngine();
  worldStateSystem?.setConfig(config ?? null);
}

export function getSprites() {
  ensureEngine();
  return pickupsSystem?.getSprites() ?? [];
}

const audio = new AudioManager();
audio.setSfxSources(DEFAULT_SFX);

const player: PlayerInstance = {
  x: 46,
  y: 7,
  mov: 0,
  dir: 0,
  rot: -1.5,
  hp: 100,
  maxHp: 100,
  speed: 0.05,
  sprint: 0,
  sprintFactor: 2,
  rotSpeed: (2 * Math.PI) / 180,
  fov: (60 * Math.PI) / 180,
  flatmap: 0,
};

const input = createInput({
  onToggleMap: function () {
    player.flatmap = player.flatmap ? 0 : 1;
  },
});

function getViewWidth() {
  const cssWidth = getCanvasCssWidth();
  if (typeof cssWidth === 'number') return cssWidth;
  const canvas = getCanvas();
  return canvas ? canvas.width : 0;
}

function getViewHeight() {
  const cssHeight = getCanvasCssHeight();
  if (typeof cssHeight === 'number') return cssHeight;
  const canvas = getCanvas();
  return canvas ? canvas.height : 0;
}

function ensureEngine() {
  if (engine) return engine;
  const ctx = getCtx();
  if (!ctx) {
    throw new Error('Canvas context is not initialized. Did you import canvas-init first?');
  }

  worldStateSystem = createWorldStateSystem();
  worldStateSystem.setOnChanged(() => {
    const enabledTriggers = rawTriggers.filter((t) => worldStateSystem?.isEnabled(t) ?? true);
    triggersSystem?.setTriggers(enabledTriggers);
    const enabledLights = rawLights.filter((l) => worldStateSystem?.isEnabled(l) ?? true);
    lightsSystem?.setLights(enabledLights);
    reapplyEntities();
  });

  doorsSystem = createDoorsSystem({
    playDoorOpenSfx: () => audio.playSfx(SFX.transitions.hospitalDoorOpen),
    playDoorDeniedSfx: () => audio.playSfx(SFX.ui.menuError),
    onDoorOpened: (xMap, yMap) => {
      handleDoorOpened(xMap, yMap);
    },
  });

  triggersSystem = createTriggersSystem({
    audio,
    getPlayerPos: () => ({ x: player.x, y: player.y }),
    getMaterialsWall: () => getMaterialsWallState(),
    setMaterialsWall: (rows) => setMaterialsWallState(rows),
    isEnabledByWorldState: (opts) => (worldStateSystem ? worldStateSystem.isEnabled(opts) : true),
    setWorldState: (state, value) => worldStateSystem?.setState(state, value),
    toggleWorldState: (state) => worldStateSystem?.toggleState(state),
    setWorldFlag: (flag, value) => worldStateSystem?.setFlag(flag, value),
    toggleWorldFlag: (flag) => worldStateSystem?.toggleFlag(flag),
    spawnEntity: (entity) => spawnEntityRuntime(entity),
    despawnEntity: (id) => despawnEntityRuntime(id),
  });

  enemiesSystem = createEnemiesSystem({
    player,
    getDifficulty: () => currentDifficulty,
    playSfx: (key) => audio.playSfx(key),
    playLoopingSfx: (key, volume) => audio.playLoopingSfx(key, volume),
    stopLoopingSfx: (key) => audio.stopLoopingSfx(key),
    onRequestOpenDoor: (xMap, yMap) => doorsSystem?.requestOpenDoor(xMap, yMap),
    isDoorBlocking: (xMap, yMap) => {
      return !!doorsSystem && doorsSystem.isDoorBlocking(xMap + 0.5, yMap + 0.5);
    },
    onDamagePulse: () => renderer?.triggerDamagePulse(),
    onKillFill: () => renderer?.triggerKillFill(),
  });

  pickupsSystem = createPickupsSystem({
    player,
    playHealthSfx: () => audio.playSfx(SFX.ui.pickupMedkit),
    playKeySfx: () => audio.playSfx(SFX.ui.pickupKey),
    isBlocked: (x, y, r) => {
      return (
        !!enemiesSystem &&
        (enemiesSystem.hitWallCircle(x, y, r) || enemiesSystem.hitEnemyCircle(x, y, r * 3.0))
      );
    },
    getDifficulty: () => currentDifficulty,
    onKeyPickup: (id) => {
      ownedKeys[id] = true;
    },
  });

  function handleDoorOpened(xMap: number, yMap: number) {
    const map = getMap();
    if (!map) return;

    let doorEnemySpawnChance = 1 / 3;
    let doorEnemyAggro = false;
    if (currentDifficulty === 'lost') {
      doorEnemySpawnChance = 1 / 2;
      doorEnemyAggro = true;
    } else if (currentDifficulty === 'trapped') {
      doorEnemySpawnChance = 3 / 4;
      doorEnemyAggro = true;
    } else {
      doorEnemySpawnChance = 0.95;
      doorEnemyAggro = true;
    }

    if (Math.random() >= doorEnemySpawnChance) return;

    const w = map[0]?.length ?? 0;
    const h = map.length;
    if (w <= 0 || h <= 0) return;

    const doorCx = xMap + 0.5;
    const doorCy = yMap + 0.5;
    const dx = doorCx - player.x;
    const dy = doorCy - player.y;

    let stepX = 0;
    let stepY = 0;
    if (Math.abs(dx) >= Math.abs(dy)) stepX = Math.sign(dx);
    else stepY = Math.sign(dy);

    const candidates: Array<{ x: number; y: number }> = [];
    candidates.push({ x: xMap + stepX, y: yMap + stepY });
    candidates.push({ x: xMap, y: yMap });
    candidates.push({ x: xMap + stepY, y: yMap - stepX });
    candidates.push({ x: xMap - stepY, y: yMap + stepX });

    const enemyR = 0.24;
    const minPlayerDist = 0.9;

    for (const c of candidates) {
      if (c.x < 0 || c.x >= w || c.y < 0 || c.y >= h) continue;
      if (map[c.y][c.x] !== 0) continue;

      const ex = c.x + 0.5;
      const ey = c.y + 0.5;
      if (Math.hypot(ex - player.x, ey - player.y) < minPlayerDist) continue;
      if (!enemiesSystem) continue;
      if (enemiesSystem.hitWallCircle(ex, ey, enemyR)) continue;
      if (enemiesSystem.hitEnemyCircle(ex, ey, enemyR * 2.2)) continue;

      enemiesSystem.spawnEnemyAtWorld(ex, ey, {
        kind: enemiesSystem.rollEnemyKind(),
        alerted: true,
        attackFlashMs: doorEnemyAggro ? 220 : 0,
      });
      return;
    }
  }

  renderer = createRenderer({
    ctx,
    getViewWidth,
    getViewHeight,
    player,
    getEnemies: () => enemiesSystem?.getEnemies() ?? [],
    getSprites: () => pickupsSystem?.getSprites() ?? [],
  });

  lightsSystem = createLightsSystem();

  engine = createEngine({
    getViewWidth,
    getViewHeight,
    player,
    input,
    renderer,
    world: createWorldAdapter({
      isSolid: (x: number, y: number) => {
        const playerRadius = 0.22;
        return (
          (!!enemiesSystem && enemiesSystem.hitWallCircle(x, y, playerRadius)) ||
          (!!enemiesSystem && enemiesSystem.hitEnemyCircle(x, y, playerRadius + 0.22))
        );
      },
      interact: (x: number, y: number) => {
        if (interactWithEntities(x, y)) return;
        doorsSystem?.interactWorld(x, y, ownedKeys);
      },
      getWallTextureId,
      getLightAt: (x: number, y: number) => (lightsSystem ? lightsSystem.getLightAt(x, y) : 1),
      isDoorBlocking: (x: number, y: number) => {
        return !!doorsSystem && doorsSystem.isDoorBlocking(x, y);
      },
    }),
    events: {
      onFootstep: () => {
        audio.playSfx(SFX.footsteps.concrete);
      },
      onShoot: () => {
        audio.playSfx(SFX.weapons.pistol.fire);
        renderer?.triggerFlash();
        enemiesSystem?.alertFromNoise(player.x, player.y, 9);
        enemiesSystem?.tryShootEnemies();
      },
      onTick: (dt: number) => {
        lightsSystem?.tick(dt);
        renderer?.setAmbientLight01(lightsSystem ? lightsSystem.getLightAt(player.x, player.y) : 1);
        doorsSystem?.tick(dt, (xMap, yMap) => {
          // Block auto-close if player or an enemy is in / very close to the door cell.
          const cx = xMap + 0.5;
          const cy = yMap + 0.5;
          if (Math.hypot(player.x - cx, player.y - cy) < 0.75) return true;
          const enemyR = 0.35;
          return !!enemiesSystem && enemiesSystem.hitEnemyCircle(cx, cy, enemyR);
        });
        enemiesSystem?.tick(dt);
        pickupsSystem?.tick(dt);
        triggersSystem?.tick();
      },
    },
  });
  return engine;
}

export function setBackgroundColors(colors: { ceiling?: string; floor?: string }) {
  ensureEngine();
  renderer?.setBackgroundColors(colors);
}

export function setBackgroundMaterials(materials: {
  ceiling?: string | number | null;
  floor?: string | number | null;
}) {
  ensureEngine();
  renderer?.setBackgroundMaterials(materials);
}

export function triggerDeathOverlay() {
  ensureEngine();
  renderer?.triggerKillFill();
}

export function setMap(grid: number[][]) {
  ensureEngine();
  setMapState(grid);
  setMaterialsWallState(null);
  doorsSystem?.onMapChanged();
  enemiesSystem?.onMapChanged();
  pickupsSystem?.onMapChanged(grid);
  triggersSystem?.onMapChanged();
  lightsSystem?.onMapChanged();
  worldStateSystem?.onMapChanged();
  rawTriggers = [];
  rawLights = [];
  rawEntities = [];
  entityIdSeq = 1;
  activeInteractables = [];
}

export function setMaterialsWall(rows: string[][] | null) {
  ensureEngine();
  setMaterialsWallState(rows);
}

export function setSpawn(spawn: Spawn | null) {
  if (!spawn || typeof spawn !== 'object') return;
  ensureEngine().setSpawn(spawn);
}

export function setLegend(newLegend: Legend) {
  setLegendState(newLegend);
}

export function setAudioConfig({
  music,
  sfx,
}: {
  music: Parameters<AudioManager['setMusic']>[0];
  sfx: Parameters<AudioManager['setSfxSources']>[0];
}) {
  audio.setMusic(music);
  audio.setSfxSources(sfx ?? DEFAULT_SFX);
}

export function unlockAudio() {
  audio.unlock();
}

export function playMusic() {
  audio.playMusic();
}

export function setMusicEnabled(enabled: boolean) {
  audio.setMusicEnabled(enabled);
}

export function setSfxEnabled(enabled: boolean) {
  audio.setSfxEnabled(enabled);
}

export function setMusicVolume(volume: number) {
  audio.setMusicVolume(volume);
}

export function setSfxVolume(volume: number) {
  audio.setSfxVolume(volume);
}

export function getAudioState() {
  return {
    musicEnabled: audio.getMusicEnabled(),
    sfxEnabled: audio.getSfxEnabled(),
    musicVolume: audio.getMusicVolume(),
    sfxVolume: audio.getSfxVolume(),
  };
}

export function startRayc() {
  ensureEngine().start();
}

export function stopRayc() {
  if (!engine) return;
  engine.stop();
}

export function disposeRayc() {
  if (!engine) return;
  engine.dispose();
  engine = null;
}

export function getPlayer() {
  return player;
}
