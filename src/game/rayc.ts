import type { Legend, Player, Spawn } from '../types/game';
import { createEngine } from '../engine/engine';
import { getCanvas, getCanvasCssHeight, getCanvasCssWidth, getCtx } from '../canvas-init';
import { createInput } from '../input/input';
import { createRenderer } from './render/renderer';
import { AudioManager } from './audio/audio-manager';
import { DEFAULT_SFX, SFX } from './audio/sfx-config';
import {
  getMap,
  isDoorCell,
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
import { loadAnimationRegistry, tickAnimations } from './render/animations';
import { createHallucinationsSystem, type HallucinationSpec } from './systems/hallucinations';
import { createInventory, type InventorySnapshot } from './systems/inventory';
import {
  createItemsSystem,
  type MedicationSpec,
  type ArtifactSpec,
  type AmmoSpec,
  type WeaponSpec,
  type ArmorSpec,
} from './systems/items';
import { createWeaponsSystem, WEAPON_IDS, type WeaponId } from './systems/weapons';
import { createAmbienceSystem, type AmbientEmitterSpec } from './systems/ambience';
import { createWorldStateSystem, type PerceptionState } from './systems/world-state';
import { createPortalsSystem, type PortalSpec } from './systems/portals';
import { createPredatorSystem } from './systems/predator';
import { createWorldAdapter } from './world/world-adapter';
import type { Difficulty, EnemyKind } from './game-types';
import type { RayHit } from '../raycast/raycaster';
import type { LevelTriggerJson } from './levels/level-loader';
import type { LevelLightJson } from './levels/level-loader';
import type { LevelGeometryOverrideJson } from './levels/level-loader';
import type { LevelWorldStatesJson } from './levels/level-loader';
import type { LevelEntityJson } from './levels/level-loader';
import type { LevelTriggerActionJson } from './levels/level-loader';
import { showNoteOverlay } from './ui/note-overlay';
import { DEFAULT_CONTROL_BINDINGS, type ControlBindings } from './config';

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
let hallucinationsSystem: ReturnType<typeof createHallucinationsSystem> | null = null;
let itemsSystem: ReturnType<typeof createItemsSystem> | null = null;
let ambienceSystem: ReturnType<typeof createAmbienceSystem> | null = null;
let worldStateSystem: ReturnType<typeof createWorldStateSystem> | null = null;
let portalsSystem: ReturnType<typeof createPortalsSystem> | null = null;
let predatorSystem: ReturnType<typeof createPredatorSystem> | null = null;
let controls: ControlBindings = structuredClone(DEFAULT_CONTROL_BINDINGS);
const inventory = createInventory();
const weaponsSystem = createWeaponsSystem({ inventory });

let rawTriggers: LevelTriggerJson[] = [];
let rawLights: LevelLightJson[] = [];
let rawEntities: LevelEntityJson[] = [];
let baseGrid: number[][] | null = null;
let rawGeometryOverrides: LevelGeometryOverrideJson[] = [];
let entityIdSeq = 1;
let entityDrivenEnemies = false;
const consumedEntityIds = new Set<string>();

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

  if (a.type === 'set_medication') {
    worldStateSystem?.setMedication(a.on);
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
      const isDocument = !!(e as any).isDocument;
      showNoteOverlay(title, text, { document: isDocument });
      if (isDocument) inventory.add('document', 1);
      if (typeof e.id === 'string' && e.id) {
        consumeEntity(e.id);
      }
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
  const enabled = rawEntities.filter(
    (e) => (!e.id || !consumedEntityIds.has(e.id)) && ws.isEnabled(e),
  );

  activeInteractables = enabled.filter(
    (e) => e.type === 'note' || e.type === 'button' || e.type === 'switch' || e.type === 'door',
  );

  const keyPickupsFromEntities: Array<{
    entityId?: string;
    x: number;
    y: number;
    id: KeyId;
  }> = [];
  const doorLocksFromEntities: Array<{ x: number; y: number; id: KeyId }> = [];
  const healthPickupsFromEntities: Array<{ id?: string; x: number; y: number }> = [];
  const enemiesFromEntities: Array<{ id?: string; x: number; y: number; kind?: EnemyKind }> = [];
  const hallucinationsFromEntities: HallucinationSpec[] = [];
  const medicationsFromEntities: MedicationSpec[] = [];
  const artifactsFromEntities: ArtifactSpec[] = [];
  const ammoFromEntities: AmmoSpec[] = [];
  const weaponsFromEntities: WeaponSpec[] = [];
  const armorFromEntities: ArmorSpec[] = [];
  const portalsFromEntities: PortalSpec[] = [];
  const emittersFromEntities: AmbientEmitterSpec[] = [];

  for (const e of enabled) {
    if (!e || typeof e !== 'object') continue;
    if (e.type === 'key') {
      const keyId = (e.subtype ?? '') as string;
      if (keyId === 'gold' || keyId === 'silver' || keyId === 'blood') {
        keyPickupsFromEntities.push({ entityId: e.id, x: e.x, y: e.y, id: keyId });
      }
    }
    if (e.type === 'door_lock') {
      const keyId = (e as { keyId?: unknown }).keyId;
      if (keyId === 'gold' || keyId === 'silver' || keyId === 'blood') {
        doorLocksFromEntities.push({ x: Math.floor(e.x), y: Math.floor(e.y), id: keyId });
      }
    }

    if (e.type === 'health_pickup' || e.type === 'health') {
      healthPickupsFromEntities.push({ id: e.id, x: e.x, y: e.y });
    }

    if (e.type === 'enemy_spawn') {
      const kindRaw = (e as { kind?: unknown }).kind;
      const allowed: ReadonlyArray<EnemyKind> = [
        'skeleton_husk',
        'medical_orderly',
        'deformed_patient',
        'boss_chief_doctor',
        'boss_choir',
        'boss_dade_keeper',
        'boss_heart_hospital',
        'boss_shepherd',
        'flesh_watcher',
        'flesh_eye',
        'flesh_machine',
        'doppelganger',
      ];
      const kind =
        typeof kindRaw === 'string' && (allowed as readonly string[]).includes(kindRaw)
          ? (kindRaw as EnemyKind)
          : undefined;
      enemiesFromEntities.push({ id: e.id, x: e.x, y: e.y, kind });
    }

    if (e.type === 'medication') {
      const raw = e as unknown as { id?: string; x: number; y: number; subtype?: string };
      medicationsFromEntities.push({
        id: raw.id,
        x: raw.x,
        y: raw.y,
        subtype: raw.subtype,
      });
    }

    if (e.type === 'artifact') {
      const raw = e as unknown as { id?: string; x: number; y: number; subtype?: string };
      artifactsFromEntities.push({
        id: raw.id,
        x: raw.x,
        y: raw.y,
        subtype: raw.subtype,
      });
    }

    if (e.type === 'ammo') {
      const raw = e as unknown as {
        id?: string;
        x: number;
        y: number;
        subtype?: string;
        amount?: number;
      };
      ammoFromEntities.push({
        id: raw.id,
        x: raw.x,
        y: raw.y,
        subtype: raw.subtype,
        amount: raw.amount,
      });
    }

    if (e.type === 'weapon') {
      const raw = e as unknown as { id?: string; x: number; y: number; subtype?: string };
      weaponsFromEntities.push({
        id: raw.id,
        x: raw.x,
        y: raw.y,
        subtype: raw.subtype,
      });
    }

    if (e.type === 'armor') {
      const raw = e as unknown as { id?: string; x: number; y: number; subtype?: string };
      armorFromEntities.push({
        id: raw.id,
        x: raw.x,
        y: raw.y,
        subtype: raw.subtype,
      });
    }

    if (e.type === 'ambient_loop') {
      const raw = e as unknown as {
        id?: string;
        x: number;
        y: number;
        subtype?: string;
        radius?: number;
        volume?: number;
      };
      emittersFromEntities.push({
        id: raw.id,
        x: raw.x,
        y: raw.y,
        subtype: raw.subtype,
        radius: raw.radius,
        volume: raw.volume,
      });
    }

    if (e.type === 'hallucination') {
      const raw = e as unknown as {
        id?: string;
        x: number;
        y: number;
        subtype?: string;
        appearDistance?: number;
        vanishDistance?: number;
        scale?: number;
      };
      hallucinationsFromEntities.push({
        id: raw.id,
        x: raw.x,
        y: raw.y,
        subtype: raw.subtype,
        appearDistance: raw.appearDistance,
        vanishDistance: raw.vanishDistance,
        scale: raw.scale,
      });
    }

    if (e.type === 'portal') {
      const raw = e as unknown as {
        id?: string;
        x: number;
        y: number;
        toX?: number;
        toY?: number;
        toRot?: number;
        radius?: number;
        once?: boolean;
        cooldownMs?: number;
      };
      if (typeof raw.toX === 'number' && typeof raw.toY === 'number') {
        portalsFromEntities.push({
          id: raw.id,
          x: raw.x,
          y: raw.y,
          toX: raw.toX,
          toY: raw.toY,
          toRot: raw.toRot,
          radius: raw.radius,
          once: raw.once,
          cooldownMs: raw.cooldownMs,
        });
      }
    }
  }

  pickupsSystem?.setKeyPickups(keyPickupsFromEntities);
  pickupsSystem?.setHealthPickups(healthPickupsFromEntities);
  doorsSystem?.setDoorLocks(doorLocksFromEntities);
  hallucinationsSystem?.setHallucinations(hallucinationsFromEntities);
  itemsSystem?.setMedicationPickups(medicationsFromEntities);
  itemsSystem?.setArtifactPickups(artifactsFromEntities);
  itemsSystem?.setAmmoPickups(ammoFromEntities);
  itemsSystem?.setWeaponPickups(weaponsFromEntities);
  itemsSystem?.setArmorPickups(armorFromEntities);
  portalsSystem?.setPortals(portalsFromEntities);
  ambienceSystem?.setEmitters(emittersFromEntities);
  if (rawEntities.some((e) => e?.type === 'enemy_spawn')) {
    entityDrivenEnemies = true;
  }
  if (entityDrivenEnemies) {
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

function consumeEntity(id: string) {
  if (!id) return;
  consumedEntityIds.add(id);
  activeInteractables = activeInteractables.filter((e) => e.id !== id);
}

function getNoteSprites() {
  return activeInteractables
    .filter((e) => e.type === 'note')
    .map((e) => ({
      x: e.x,
      y: e.y,
      material: typeof e.sprite === 'string' ? e.sprite : 'document_archive',
      alive: true,
      scale: 0.16,
    }));
}

export function setEntities(next: LevelEntityJson[]) {
  ensureEngine();
  entityIdSeq = 1;
  rawEntities = Array.isArray(next)
    ? next.map((e) => ({
        ...e,
        id: typeof e.id === 'string' && e.id.length ? e.id : `e_${entityIdSeq++}`,
      }))
    : [];
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

function getWallTextureId(hit: RayHit<string | number>): string | number {
  const lock = doorsSystem?.getDoorLock(hit.xMap, hit.yMap);
  if (lock && typeof hit.material === 'string') return `locked_door:${hit.material}:${lock}`;

  return hit.material;
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

function applyGeometryOverrides() {
  if (!baseGrid) return;
  const ws = worldStateSystem;
  // Clone base grid (per-row arrays).
  const next: number[][] = baseGrid.map((row) => row.slice());
  if (rawGeometryOverrides.length) {
    for (const ov of rawGeometryOverrides) {
      const enabled = ws ? ws.isEnabled(ov) : true;
      if (!enabled) continue;
      for (const c of ov.cells) {
        if (c.y < 0 || c.y >= next.length) continue;
        const row = next[c.y];
        if (c.x < 0 || c.x >= row.length) continue;
        row[c.x] = c.value;
      }
    }
  }
  setMapState(next);
}

export function setGeometryOverrides(next: LevelGeometryOverrideJson[]) {
  ensureEngine();
  rawGeometryOverrides = Array.isArray(next) ? next : [];
  applyGeometryOverrides();
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

export function setMedication(on: boolean) {
  ensureEngine();
  worldStateSystem?.setMedication(on);
}

export function getPerceptionStages(): PerceptionState[] {
  return worldStateSystem?.getPerceptionStages() ?? [];
}

export function getInventorySnapshot(): InventorySnapshot {
  return inventory.snapshot();
}

export function setInventoryOnChanged(cb: (() => void) | null) {
  inventory.setOnChanged(cb);
}

export function getCurrentWeapon(): WeaponId | null {
  return weaponsSystem.getCurrent();
}

export function getCurrentWeaponDef() {
  return weaponsSystem.getCurrentDef();
}

export function setCurrentWeapon(id: WeaponId) {
  weaponsSystem.setWeapon(id);
}

export function getCurrentWeaponAmmo(): number | null {
  return weaponsSystem.getAmmo();
}

export function setWeaponOnChanged(cb: (() => void) | null) {
  weaponsSystem.setOnChanged(cb);
}

export function setControlBindings(next: ControlBindings) {
  controls = structuredClone(next);
}

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.repeat) return;
  if (controls.weapon1.includes(e.code)) weaponsSystem.setWeapon(WEAPON_IDS[0]);
  else if (controls.weapon2.includes(e.code)) weaponsSystem.setWeapon(WEAPON_IDS[1]);
  else if (controls.weapon3.includes(e.code)) weaponsSystem.setWeapon(WEAPON_IDS[2]);
  else if (controls.cycleWeapon.includes(e.code)) weaponsSystem.cycleWeapon(1);
  else if (controls.predatorDash.includes(e.code)) tryPredatorDash();
});

function tryPredatorDash() {
  if (!predatorSystem) return;
  predatorSystem.tryDash((x, y) => {
    const r = 0.22;
    const wallBlocked = !!enemiesSystem && enemiesSystem.hitWallCircle(x, y, r);
    const enemyBlocked = !!enemiesSystem && enemiesSystem.hitEnemyCircle(x, y, r + 0.18);
    return !wallBlocked && !enemyBlocked;
  });
}

export function getNearestEnemyDistance(): number | null {
  if (!enemiesSystem) return null;
  const list = enemiesSystem.getEnemies();
  let best: number | null = null;
  for (const e of list) {
    if (!e.alive) continue;
    const d = Math.hypot(player.x - e.x, player.y - e.y);
    if (best === null || d < best) best = d;
  }
  return best;
}

export function getPredatorDashCooldownRatio(): number {
  return predatorSystem?.getDashCooldownRatio() ?? 0;
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
  armor: 0,
  maxArmor: 100,
  speed: 0.05,
  sprint: 0,
  sprintFactor: 2,
  rotSpeed: (2 * Math.PI) / 180,
  fov: (60 * Math.PI) / 180,
  flatmap: 0,
};

const input = createInput({
  getPointerTarget: getCanvas,
  getToggleMapBindings: () => controls.toggleMap,
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
    applyGeometryOverrides();
    reapplyEntities();
  });

  doorsSystem = createDoorsSystem({
    playDoorOpenSfx: () => audio.playSfx(SFX.transitions.hospitalDoorOpen),
    playDoorCloseSfx: () => audio.playSfx(SFX.transitions.hospitalDoorClose),
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
    setMedication: (on) => worldStateSystem?.setMedication(on),
    spawnEntity: (entity) => spawnEntityRuntime(entity),
    despawnEntity: (id) => despawnEntityRuntime(id),
    onEnding: (stage) => {
      window.dispatchEvent(new CustomEvent('rayc:ending', { detail: { stage } }));
    },
    onNextLevel: (levelId, message) => {
      window.dispatchEvent(new CustomEvent('rayc:next-level', { detail: { levelId, message } }));
    },
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
    onEnemyKilled: (id) => {
      if (id) consumeEntity(id);
    },
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
    onEntityPickup: (id) => consumeEntity(id),
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
      const isOpenDoor = isDoorCell(c.x, c.y) && !doorsSystem?.isDoorBlocking(c.x + 0.5, c.y + 0.5);
      if (map[c.y][c.x] !== 0 && !isOpenDoor) continue;

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
    getSprites: () => [
      ...(pickupsSystem?.getSprites() ?? []),
      ...(itemsSystem?.getSprites() ?? []),
      ...(hallucinationsSystem?.getSprites() ?? []),
      ...getNoteSprites(),
    ],
    getWeapon: () => weaponsSystem.getCurrent(),
    getWeaponDef: () => weaponsSystem.getCurrentDef(),
    getPerceptionStages: () => worldStateSystem?.getPerceptionStages() ?? [],
    getNearestEnemyDistance,
  });

  lightsSystem = createLightsSystem();
  hallucinationsSystem = createHallucinationsSystem({
    player,
    playSfx: (key) => audio.playSfx(key),
  });
  itemsSystem = createItemsSystem({
    player,
    inventory,
    playSfx: (key) => audio.playSfx(key),
    onPickup: (id) => consumeEntity(id),
    onWeaponPickup: (id) => weaponsSystem.acquire(id),
    setMedication: (on) => worldStateSystem?.setMedication(on),
    getPerceptionStages: () => worldStateSystem?.getPerceptionStages() ?? [],
    setWorldState: (state, value) => worldStateSystem?.setState(state, value),
  });
  portalsSystem = createPortalsSystem({
    player,
  });
  predatorSystem = createPredatorSystem({
    player,
    getPerceptionStages: () => worldStateSystem?.getPerceptionStages() ?? [],
  });
  ambienceSystem = createAmbienceSystem({
    player,
    getPerceptionStages: () => worldStateSystem?.getPerceptionStages() ?? [],
    playLoopingSfx: (key, volume, srcOverride) => audio.playLoopingSfx(key, volume, srcOverride),
    stopLoopingSfx: (key) => audio.stopLoopingSfx(key),
    resolveSfxSrc: (key) => audio.getSfxSrc(key),
  });

  engine = createEngine({
    getViewWidth,
    getViewHeight,
    player,
    input,
    renderer,
    getControls: () => controls,
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
      getWallTextureOffset: (hit) => {
        return doorsSystem?.getDoorTextureOffset(hit.xMap, hit.yMap, hit.offset) ?? hit.offset;
      },
      getLightAt: (x: number, y: number) => (lightsSystem ? lightsSystem.getLightAt(x, y) : 1),
      isDoorBlocking: (x: number, y: number) => {
        return !!doorsSystem && doorsSystem.isDoorBlocking(x, y);
      },
      isDoorRayBlockingAt: (xMap: number, yMap: number, offset: number) => {
        return !doorsSystem || doorsSystem.isDoorRayBlockingAt(xMap, yMap, offset);
      },
    }),
    events: {
      onFootstep: () => {
        audio.playSfx(SFX.footsteps.concrete);
      },
      onShoot: () => {
        const result = weaponsSystem.tryFire();
        if (!result) return;
        const def = result.weapon;
        if (!result.fired) {
          if (def.emptySfx) audio.playSfx(def.emptySfx);
          return;
        }
        audio.playSfx(def.fireSfx);
        renderer?.triggerWeaponAction();
        if (def.flash) renderer?.triggerFlash();
        const noiseMul = predatorSystem?.getNoiseMultiplier() ?? 1;
        enemiesSystem?.alertFromNoise(player.x, player.y, def.noiseRadius * noiseMul);
        const dmgMul = predatorSystem?.getDamageMultiplier() ?? 1;
        const scaledDamage = def.damage * dmgMul;
        if (result.kind === 'melee') {
          const hit = enemiesSystem?.tryMeleeHitNearest({
            range: def.range,
            damage: scaledDamage,
          });
          if (hit && def.hitFleshSfx) audio.playSfx(def.hitFleshSfx);
          else if (!hit && def.hitWallSfx) audio.playSfx(def.hitWallSfx);
        } else {
          enemiesSystem?.tryShootEnemies({
            range: def.range,
            damage: scaledDamage,
            spreadRad: def.spreadRad,
            hitHalfAngleRad: def.hitHalfAngleRad,
          });
        }
      },
      onTick: (dt: number) => {
        tickAnimations(dt);
        lightsSystem?.tick(dt);
        hallucinationsSystem?.tick(dt);
        itemsSystem?.tick();
        portalsSystem?.tick(dt);
        predatorSystem?.tick(dt);
        ambienceSystem?.tick(dt);
        renderer?.setAmbientLight01(lightsSystem ? lightsSystem.getLightAt(player.x, player.y) : 1);
        doorsSystem?.tick(dt, (xMap, yMap) => {
          // Block auto-close if player or an enemy is in / very close to the door cell.
          const cx = xMap + 0.5;
          const cy = yMap + 0.5;
          if (Math.hypot(player.x - cx, player.y - cy) < 0.75) return true;
          return !!enemiesSystem && enemiesSystem.isEnemyOverlappingCell(xMap, yMap);
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

export function setLightingMultiplier(multiplier: number) {
  ensureEngine();
  renderer?.setLightingMultiplier(multiplier);
}

export function triggerDeathOverlay() {
  ensureEngine();
  renderer?.triggerKillFill();
}

export function setMap(grid: number[][]) {
  ensureEngine();
  // Snapshot the incoming grid as the authoritative base. Subsequent
  // `geometryOverrides` mutations are recomputed from this snapshot every
  // time world state changes.
  baseGrid = grid.map((row) => row.slice());
  setMapState(grid);
  setMaterialsWallState(null);
  doorsSystem?.onMapChanged();
  enemiesSystem?.onMapChanged();
  pickupsSystem?.onMapChanged(grid);
  triggersSystem?.onMapChanged();
  lightsSystem?.onMapChanged();
  hallucinationsSystem?.onMapChanged();
  itemsSystem?.onMapChanged();
  ambienceSystem?.onMapChanged();
  worldStateSystem?.onMapChanged();
  predatorSystem?.onMapChanged();
  inventory.reset();
  rawTriggers = [];
  rawLights = [];
  rawEntities = [];
  rawGeometryOverrides = [];
  entityIdSeq = 1;
  entityDrivenEnemies = false;
  consumedEntityIds.clear();
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

export function resetPlayerState() {
  player.mov = 0;
  player.dir = 0;
  player.sprint = 0;
  player.flatmap = 0;
  player.hp = player.maxHp;
  player.armor = 0;
  weaponsSystem.reset();
}

export function disposeRayc() {
  if (!engine) return;
  engine.dispose();
  engine = null;
}

export function getPlayer() {
  return player;
}
