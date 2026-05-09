import type { Grid, Legend, Player, Spawn } from '../types/game';
import { createEngine } from '../engine/engine';
import { getCanvas, getCanvasCssHeight, getCanvasCssWidth, getCtx } from '../canvas-init';
import { createInput } from '../input/input';
import { createRenderer } from './render/renderer';
import { AudioManager } from './audio/audio-manager';
import { DEFAULT_SFX } from './audio/sfx-config';
import {
  getCellMaterial,
  getMap,
  hitWall,
  isDoorCell,
  setCell,
  setLegend as setLegendState,
  setMap as setMapState,
} from '../state/map-state';
import type { RayHit } from '../raycast/raycaster';

type EngineInstance = ReturnType<typeof createEngine>;

type RendererInstance = ReturnType<typeof createRenderer>;

type PlayerInstance = Player;

export type Difficulty = 'lost' | 'trapped' | 'consumed';

export type EnemyKind = 'zombie' | 'ghost';

let engine: EngineInstance | null = null;
let renderer: RendererInstance | null = null;

type Enemy = {
  x: number;
  y: number;
  kind: EnemyKind;
  hp: number;
  tileX: number;
  tileY: number;
  targetTileX: number;
  targetTileY: number;
  moveRemain: number;
  moveDirX: number;
  moveDirY: number;
  mode: 'idle' | 'patrol' | 'chase' | 'wait';
  decisionCooldownMs: number;
  waitTileX: number;
  waitTileY: number;
  waitDirX: number;
  waitDirY: number;
  queuedDirX: number;
  queuedDirY: number;
  alive: boolean;
  alerted: boolean;
  attackFlashMs: number;
};

let enemies: Enemy[] = [];

type HealthPickup = {
  x: number;
  y: number;
  alive: boolean;
};

let healthPickups: HealthPickup[] = [];

let healthFloorCandidates: Array<{ x: number; y: number }> = [];
let healthSpawnCooldownMs = 0;

let enemySightLoopKey: 'enemy' | 'zombie' | null = null;

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

let enemyGridW = 0;
let enemyGridH = 0;
let enemyAt: Int32Array | null = null;

function ensureEnemyGridForCurrentMap() {
  const map = getMap();
  if (!map || !map.length || !map[0]?.length) {
    enemyGridW = 0;
    enemyGridH = 0;
    enemyAt = null;
    return;
  }

  const w = map[0].length;
  const h = map.length;
  if (w === enemyGridW && h === enemyGridH && enemyAt) return;

  enemyGridW = w;
  enemyGridH = h;
  enemyAt = new Int32Array(w * h);
  enemyAt.fill(-1);
}

function enemyIndex(x: number, y: number) {
  return y * enemyGridW + x;
}

function clearEnemyGrid() {
  if (!enemyAt) return;
  enemyAt.fill(-1);
}

function rebuildEnemyGridFromEnemies() {
  ensureEnemyGridForCurrentMap();
  if (!enemyAt) return;
  clearEnemyGrid();

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.alive) continue;
    if (e.tileX < 0 || e.tileX >= enemyGridW || e.tileY < 0 || e.tileY >= enemyGridH) continue;
    enemyAt[enemyIndex(e.tileX, e.tileY)] = i;
  }
}

function placeEnemyInGrid(i: number, x: number, y: number) {
  if (!enemyAt) return;
  if (x < 0 || x >= enemyGridW || y < 0 || y >= enemyGridH) return;
  enemyAt[enemyIndex(x, y)] = i;
}

function clearEnemyFromGrid(i: number, x: number, y: number) {
  if (!enemyAt) return;
  if (x < 0 || x >= enemyGridW || y < 0 || y >= enemyGridH) return;
  const idx = enemyIndex(x, y);
  if (enemyAt[idx] === i) enemyAt[idx] = -1;
}

function createEnemyAtWorld(
  x: number,
  y: number,
  opts?: { kind?: EnemyKind; alerted?: boolean; attackFlashMs?: number },
): Enemy {
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  const cx = tileX + 0.5;
  const cy = tileY + 0.5;
  const alerted = opts?.alerted ?? false;
  const kind = opts?.kind ?? 'ghost';
  const hp = kind === 'zombie' ? 1 : 2;
  return {
    x: cx,
    y: cy,
    kind,
    hp,
    tileX,
    tileY,
    targetTileX: tileX,
    targetTileY: tileY,
    moveRemain: 0,
    moveDirX: 0,
    moveDirY: 0,
    mode: alerted ? 'chase' : 'patrol',
    decisionCooldownMs: 0,
    waitTileX: tileX,
    waitTileY: tileY,
    waitDirX: 0,
    waitDirY: 0,
    queuedDirX: 0,
    queuedDirY: 0,
    alive: true,
    alerted,
    attackFlashMs: opts?.attackFlashMs ?? 0,
  };
}

type PendingDoor = {
  x: number;
  y: number;
  openRemainingMs: number;
};

const pendingDoors: PendingDoor[] = [];

function requestOpenDoor(xMap: number, yMap: number) {
  if (!isDoorCell(xMap, yMap)) return;
  if (pendingDoors.some((d) => d.x === xMap && d.y === yMap)) return;
  pendingDoors.push({ x: xMap, y: yMap, openRemainingMs: 320 });
}

function updateDoors(dt: number) {
  if (!pendingDoors.length) return;
  const stepMs = dt * 1000;
  for (let i = pendingDoors.length - 1; i >= 0; i--) {
    const d = pendingDoors[i];
    d.openRemainingMs -= stepMs;
    if (d.openRemainingMs > 0) continue;

    setCell(d.x, d.y, 0);
    audio.playSfx('doorOpen');
    trySpawnEnemyAfterDoorOpen(d.x, d.y);
    pendingDoors.splice(i, 1);
  }
}

let doorEnemySpawnChance = 1 / 3;
let doorEnemyAggro = false;

let currentDifficulty: Difficulty = 'lost';

function ghostWeightForDifficulty(difficulty: Difficulty): number {
  if (difficulty === 'lost') return 1;
  if (difficulty === 'trapped') return 2;
  return 4;
}

function rollEnemyKindFromDifficulty(difficulty: Difficulty): EnemyKind {
  const ghostW = ghostWeightForDifficulty(difficulty);
  const total = 10 + ghostW;
  const r = Math.random() * total;
  return r < ghostW ? 'ghost' : 'zombie';
}

function damageScaleForDifficulty(difficulty: Difficulty): number {
  if (difficulty === 'lost') return 1.0;
  if (difficulty === 'trapped') return 1.2;
  return 1.55;
}

function rollEnemyDamage(kind: EnemyKind, difficulty: Difficulty): number {
  const scale = damageScaleForDifficulty(difficulty);
  if (kind === 'zombie') {
    const baseMin = 4;
    const baseMax = difficulty === 'lost' ? 7 : difficulty === 'trapped' ? 9 : 12;
    const raw = baseMin + Math.floor(Math.random() * (baseMax - baseMin + 1));
    return Math.max(1, Math.round(raw * scale));
  }

  const baseMin = 16;
  const baseMax = difficulty === 'lost' ? 24 : difficulty === 'trapped' ? 28 : 36;
  const raw = baseMin + Math.floor(Math.random() * (baseMax - baseMin + 1));
  return Math.max(1, Math.round(raw * scale));
}

export function setDifficulty(difficulty: Difficulty) {
  currentDifficulty = difficulty;
  if (difficulty === 'lost') {
    doorEnemySpawnChance = 1 / 2;
    doorEnemyAggro = true;
  } else if (difficulty === 'trapped') {
    doorEnemySpawnChance = 3 / 4;
    doorEnemyAggro = true;
  } else {
    doorEnemySpawnChance = 0.95;
    doorEnemyAggro = true;
  }
}

export function setEnemies(next: Array<{ x: number; y: number; kind?: EnemyKind }>) {
  enemies = next.map((e) =>
    createEnemyAtWorld(e.x, e.y, {
      kind: e.kind ?? rollEnemyKindFromDifficulty(currentDifficulty),
    }),
  );
  rebuildEnemyGridFromEnemies();
}

function trySpawnEnemyAfterDoorOpen(xMap: number, yMap: number) {
  // Spawn chance configured by difficulty.
  if (Math.random() >= doorEnemySpawnChance) return;

  const map = getMap();
  if (!map) return;
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
  // Primary: cell behind the door (further from player).
  candidates.push({ x: xMap + stepX, y: yMap + stepY });
  // Fallback: the door cell itself.
  candidates.push({ x: xMap, y: yMap });
  // Side cells around the door.
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
    if (hitWallCircle(ex, ey, enemyR)) continue;
    if (hitEnemyCircle(ex, ey, enemyR * 2.2)) continue;

    const enemy = createEnemyAtWorld(ex, ey, {
      kind: rollEnemyKindFromDifficulty(currentDifficulty),
      alerted: true,
      attackFlashMs: doorEnemyAggro ? 220 : 0,
    });
    enemies.push(enemy);
    rebuildEnemyGridFromEnemies();
    return;
  }
}

function hitWallCircle(x: number, y: number, r: number): boolean {
  // 8 samples around the circle + center. Prevents corner clipping better than 4 samples.
  if (hitWall(x, y)) return true;
  const s = r * 0.95;
  return (
    hitWall(x - s, y) ||
    hitWall(x + s, y) ||
    hitWall(x, y - s) ||
    hitWall(x, y + s) ||
    hitWall(x - s, y - s) ||
    hitWall(x + s, y - s) ||
    hitWall(x - s, y + s) ||
    hitWall(x + s, y + s)
  );
}

function hitEnemyCircle(x: number, y: number, r: number): boolean {
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(x - e.x, y - e.y);
    if (d < r) return true;
  }
  return false;
}

export function getEnemies() {
  return enemies;
}

export function setHealthPickups(next: Array<{ x: number; y: number }>) {
  healthPickups = next.map((p) => ({ x: p.x, y: p.y, alive: true }));
  healthSpawnCooldownMs = 0;
}

export function getSprites() {
  const sprites: Array<{ x: number; y: number; material: string; alive: boolean; scale?: number }> = [];
  for (const p of healthPickups) {
    sprites.push({ x: p.x, y: p.y, material: 'health', alive: p.alive, scale: 0.33 });
  }
  return sprites;
}

function updatePickups() {
  if (!healthPickups.length) return;
  const pickupR = 0.42;
  for (const p of healthPickups) {
    if (!p.alive) continue;
    if (Math.hypot(player.x - p.x, player.y - p.y) > pickupR) continue;
    player.hp = Math.min(player.maxHp, player.hp + 20);
    p.alive = false;
    audio.playSfx('health');
  }
}

function countAliveHealthPickups() {
  let n = 0;
  for (const p of healthPickups) if (p.alive) n++;
  return n;
}

function hitHealthPickupCircle(x: number, y: number, r: number): boolean {
  for (const p of healthPickups) {
    if (!p.alive) continue;
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < r) return true;
  }
  return false;
}

function desiredHealthPickupCount(): number {
  const missing = Math.max(0, player.maxHp - player.hp);
  const missingRatio = player.maxHp > 0 ? missing / player.maxHp : 0;

  const base = currentDifficulty === 'lost' ? 12 : currentDifficulty === 'trapped' ? 8 : 5;
  const factor = currentDifficulty === 'lost' ? 1.1 : currentDifficulty === 'trapped' ? 1.45 : 1.85;
  return Math.max(0, Math.round(base * (1 + missingRatio * factor)));
}

function updateHealthSpawning(dt: number) {
  if (!healthFloorCandidates.length) return;
  if (player.hp <= 0) return;

  healthSpawnCooldownMs = Math.max(0, healthSpawnCooldownMs - dt);
  if (healthSpawnCooldownMs > 0) return;

  const desired = desiredHealthPickupCount();
  const alive = countAliveHealthPickups();
  if (alive >= desired) return;

  const tries = 18;
  const pickupR = 0.25;
  const minPlayerDist = currentDifficulty === 'lost' ? 2.1 : currentDifficulty === 'trapped' ? 2.35 : 2.55;

  for (let i = 0; i < tries; i++) {
    const c = healthFloorCandidates[Math.floor(Math.random() * healthFloorCandidates.length)];
    const x = c.x + 0.5;
    const y = c.y + 0.5;
    if (Math.hypot(x - player.x, y - player.y) < minPlayerDist) continue;
    if (hitWallCircle(x, y, pickupR)) continue;
    if (hitEnemyCircle(x, y, pickupR * 3.0)) continue;
    if (hitHealthPickupCircle(x, y, pickupR * 4.0)) continue;
    healthPickups.push({ x, y, alive: true });
    break;
  }

  healthSpawnCooldownMs = currentDifficulty === 'lost' ? 1800 : currentDifficulty === 'trapped' ? 2400 : 3100;
}

function hasLineOfSight(xFrom: number, yFrom: number, xTo: number, yTo: number): boolean {
  const dx = xTo - xFrom;
  const dy = yTo - yFrom;
  const dist = Math.hypot(dx, dy);
  if (dist <= 0.0001) return true;
  const step = 0.12;
  const nx = dx / dist;
  const ny = dy / dist;
  for (let d = 0.25; d < dist; d += step) {
    const x = xFrom + nx * d;
    const y = yFrom + ny * d;
    if (hitWall(x, y)) return false;
  }
  return true;
}

let enemyDamageCooldownMs = 0;
const enemyInSight = false;

function alertEnemiesFromNoise(x: number, y: number, radius: number) {
  const r2 = radius * radius;
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.alerted) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    if (dx * dx + dy * dy > r2) continue;
    e.alerted = true;
    e.mode = 'chase';
    e.decisionCooldownMs = 0;
    e.queuedDirX = 0;
    e.queuedDirY = 0;
  }
}

function isCellBlockedForEnemy(xMap: number, yMap: number, selfIndex: number): boolean {
  const map = getMap();
  if (!map || !map.length || !map[0]?.length) return true;
  const w = map[0].length;
  const h = map.length;
  if (xMap < 0 || xMap >= w || yMap < 0 || yMap >= h) return true;
  if (map[yMap][xMap] !== 0) return true;

  ensureEnemyGridForCurrentMap();
  if (!enemyAt) return false;
  const idx = enemyAt[enemyIndex(xMap, yMap)];
  return idx !== -1 && idx !== selfIndex;
}

function tryStepEnemy(selfIndex: number, dirX: number, dirY: number): boolean {
  const e = enemies[selfIndex];
  if (!e || !e.alive) return false;
  if (dirX === 0 && dirY === 0) return false;

  const nextX = e.tileX + dirX;
  const nextY = e.tileY + dirY;
  const map = getMap();
  const cellId = map?.[nextY]?.[nextX];
  if (cellId !== 0) {
    if (isDoorCell(nextX, nextY)) {
      e.mode = 'wait';
      e.waitTileX = nextX;
      e.waitTileY = nextY;
      e.waitDirX = dirX;
      e.waitDirY = dirY;
      requestOpenDoor(nextX, nextY);
      e.decisionCooldownMs = 180;
    }
    return false;
  }

  ensureEnemyGridForCurrentMap();
  if (enemyAt) {
    const occ = enemyAt[enemyIndex(nextX, nextY)];
    if (occ !== -1 && occ !== selfIndex) {
      e.mode = 'wait';
      e.waitTileX = nextX;
      e.waitTileY = nextY;
      e.waitDirX = dirX;
      e.waitDirY = dirY;
      e.decisionCooldownMs = 140;
      return false;
    }
  }

  if (enemyAt) {
    clearEnemyFromGrid(selfIndex, e.tileX, e.tileY);
    placeEnemyInGrid(selfIndex, nextX, nextY);
  }

  e.tileX = nextX;
  e.tileY = nextY;
  e.targetTileX = nextX;
  e.targetTileY = nextY;
  e.moveDirX = dirX;
  e.moveDirY = dirY;
  e.moveRemain = 1;
  return true;
}

function pickChaseStep(selfIndex: number): { x: number; y: number } {
  const e = enemies[selfIndex];
  const px = Math.floor(player.x);
  const py = Math.floor(player.y);
  const dx = px - e.tileX;
  const dy = py - e.tileY;

  const sx = Math.sign(dx);
  const sy = Math.sign(dy);

  const primaryIsX = Math.abs(dx) >= Math.abs(dy);
  const primary = primaryIsX ? { x: sx, y: 0 } : { x: 0, y: sy };
  const secondary = primaryIsX ? { x: 0, y: sy } : { x: sx, y: 0 };
  const perpA = primaryIsX ? { x: 0, y: 1 } : { x: 1, y: 0 };
  const perpB = primaryIsX ? { x: 0, y: -1 } : { x: -1, y: 0 };

  const candidates = [primary, secondary, perpA, perpB, { x: -primary.x, y: -primary.y }];
  for (const c of candidates) {
    if (c.x === 0 && c.y === 0) continue;
    const tx = e.tileX + c.x;
    const ty = e.tileY + c.y;
    if (!isCellBlockedForEnemy(tx, ty, selfIndex)) return c;
  }
  return { x: 0, y: 0 };
}

function pickPatrolStep(selfIndex: number): { x: number; y: number } {
  const e = enemies[selfIndex];
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  const reverse = { x: -e.moveDirX, y: -e.moveDirY };
  const preferred: Array<{ x: number; y: number }> = [];

  if (e.moveDirX !== 0 || e.moveDirY !== 0) {
    preferred.push({ x: e.moveDirX, y: e.moveDirY });
  }

  for (let i = dirs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = dirs[i];
    dirs[i] = dirs[j];
    dirs[j] = tmp;
  }

  for (const d of dirs) {
    if (d.x === reverse.x && d.y === reverse.y) continue;
    preferred.push(d);
  }

  preferred.push(reverse);

  for (const c of preferred) {
    if (c.x === 0 && c.y === 0) continue;
    const tx = e.tileX + c.x;
    const ty = e.tileY + c.y;
    if (!isCellBlockedForEnemy(tx, ty, selfIndex)) return c;
  }

  return { x: 0, y: 0 };
}

function updateEnemies(dt: number) {
  enemyDamageCooldownMs = Math.max(0, enemyDamageCooldownMs - dt * 1000);
  updateDoors(dt);

  let inSightNow = false;
  let sawZombieInSight = false;

  for (let selfIndex = 0; selfIndex < enemies.length; selfIndex++) {
    const e = enemies[selfIndex];
    if (!e.alive) continue;
    e.attackFlashMs = Math.max(0, e.attackFlashMs - dt * 1000);
    e.decisionCooldownMs = Math.max(0, e.decisionCooldownMs - dt * 1000);
    const dist = Math.hypot(player.x - e.x, player.y - e.y);

    if (!e.alerted) {
      if (dist > 12) {
        e.mode = 'idle';
      } else if (e.mode === 'idle') {
        e.mode = 'patrol';
      }
    }

    // Check if enemy is in your view (used for looping SFX).
    if (!inSightNow || !sawZombieInSight) {
      const maxDist = 9;
      const halfAngle = (10 * Math.PI) / 180;
      if (dist <= maxDist) {
        const angle = Math.atan2(player.y - e.y, e.x - player.x);
        let rel = angle - player.rot;
        rel = Math.atan2(Math.sin(rel), Math.cos(rel));
        if (Math.abs(rel) <= halfAngle && hasLineOfSight(player.x, player.y, e.x, e.y)) {
          inSightNow = true;
          if (e.kind === 'zombie') sawZombieInSight = true;
        }
      }
    }

    if (!e.alerted) {
      if (dist < 8 && hasLineOfSight(e.x, e.y, player.x, player.y)) {
        e.alerted = true;
        e.mode = 'chase';
        e.decisionCooldownMs = 0;
      }
    }

    if (e.mode === 'wait') {
      const tileCenterX = e.tileX + 0.5;
      const tileCenterY = e.tileY + 0.5;
      const atCenter = Math.hypot(e.x - tileCenterX, e.y - tileCenterY) < 0.05;
      if (atCenter) {
        e.x = tileCenterX;
        e.y = tileCenterY;
      }

      if (e.moveRemain <= 0 && atCenter && e.decisionCooldownMs <= 0) {
        const ok = tryStepEnemy(selfIndex, e.waitDirX, e.waitDirY);
        if (ok) {
          e.mode = e.alerted ? 'chase' : 'patrol';
          e.decisionCooldownMs = e.alerted ? 60 : 220;
        } else {
          if (isDoorCell(e.waitTileX, e.waitTileY)) requestOpenDoor(e.waitTileX, e.waitTileY);
          e.decisionCooldownMs = 140;
        }
      }
    }

    if (e.mode !== 'idle') {
      const stopRange = 1.05;
      const tileCenterX = e.tileX + 0.5;
      const tileCenterY = e.tileY + 0.5;
      const atCenter = Math.hypot(e.x - tileCenterX, e.y - tileCenterY) < 0.05;
      if (atCenter) {
        e.x = tileCenterX;
        e.y = tileCenterY;
      }

      const wantsMove = e.mode === 'wait' ? false : e.mode === 'chase' ? dist > stopRange : true;

      if (wantsMove) {
        if (e.moveRemain <= 0 && atCenter && e.decisionCooldownMs <= 0) {
          if (e.queuedDirX !== 0 || e.queuedDirY !== 0) {
            const qx = e.queuedDirX;
            const qy = e.queuedDirY;
            e.queuedDirX = 0;
            e.queuedDirY = 0;
            const ok = tryStepEnemy(selfIndex, qx, qy);
            if (!ok) {
              e.mode = 'wait';
              e.waitTileX = e.tileX + qx;
              e.waitTileY = e.tileY + qy;
              e.waitDirX = qx;
              e.waitDirY = qy;
              e.decisionCooldownMs = 120;
            } else {
              e.decisionCooldownMs = e.mode === 'chase' ? 60 : 220;
            }
          } else {
            const step = e.mode === 'chase' ? pickChaseStep(selfIndex) : pickPatrolStep(selfIndex);
            if (step.x !== 0 || step.y !== 0) {
              const changing = step.x !== e.moveDirX || step.y !== e.moveDirY;
              if (changing && (e.moveDirX !== 0 || e.moveDirY !== 0)) {
                e.queuedDirX = step.x;
                e.queuedDirY = step.y;
                e.decisionCooldownMs = e.mode === 'chase' ? 90 : 140;
              } else {
                const ok = tryStepEnemy(selfIndex, step.x, step.y);
                if (!ok) {
                  e.mode = 'wait';
                  e.waitTileX = e.tileX + step.x;
                  e.waitTileY = e.tileY + step.y;
                  e.waitDirX = step.x;
                  e.waitDirY = step.y;
                  e.decisionCooldownMs = 120;
                } else {
                  e.decisionCooldownMs = e.mode === 'chase' ? 60 : 220;
                }
              }
            } else {
              e.decisionCooldownMs = 250;
            }
          }
        }

        const speed = e.mode === 'chase' ? 0.95 : 0.65;
        const move = Math.min(e.moveRemain, speed * dt);
        if (move > 0) {
          const targetX = e.targetTileX + 0.5;
          const targetY = e.targetTileY + 0.5;
          const dx = targetX - e.x;
          const dy = targetY - e.y;
          const len = Math.hypot(dx, dy) || 1;
          e.x += (dx / len) * move;
          e.y += (dy / len) * move;
          e.moveRemain = Math.max(0, e.moveRemain - move);
        }
      }

      if (
        e.mode === 'chase' &&
        enemyDamageCooldownMs <= 0 &&
        dist < 1.35 &&
        hasLineOfSight(e.x, e.y, player.x, player.y)
      ) {
        const dmg = rollEnemyDamage(e.kind, currentDifficulty);
        player.hp = Math.max(0, player.hp - dmg);
        audio.playSfx(e.kind === 'zombie' ? 'zombie' : 'enemy');
        audio.playSfx('damage');
        e.attackFlashMs = 220;
        renderer?.triggerDamagePulse();
        enemyDamageCooldownMs = 650;
        if (player.hp <= 0) {
          renderer?.triggerKillFill();
        }
      }
    }
  }

  const desiredLoopKey: 'enemy' | 'zombie' | null = inSightNow ? (sawZombieInSight ? 'zombie' : 'enemy') : null;
  if (desiredLoopKey !== enemySightLoopKey) {
    if (enemySightLoopKey) audio.stopLoopingSfx(enemySightLoopKey);
    if (desiredLoopKey) audio.playLoopingSfx(desiredLoopKey, 0.35);
    enemySightLoopKey = desiredLoopKey;
  }
}

function tryShootEnemies() {
  const maxDist = 10;
  const halfAngle = (3 * Math.PI) / 180;

  let best: { e: Enemy; dist: number } | null = null;

  for (const e of enemies) {
    if (!e.alive) continue;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > maxDist) continue;

    const angle = Math.atan2(player.y - e.y, e.x - player.x);
    let rel = angle - player.rot;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    if (Math.abs(rel) > halfAngle) continue;
    if (!hasLineOfSight(player.x, player.y, e.x, e.y)) continue;

    if (!best || dist < best.dist) best = { e, dist };
  }

  if (best) {
    best.e.hp = Math.max(0, best.e.hp - 1);
    if (best.e.hp <= 0) {
      best.e.alive = false;
      const i = enemies.indexOf(best.e);
      if (i >= 0) {
        ensureEnemyGridForCurrentMap();
        if (enemyAt) {
          clearEnemyFromGrid(i, best.e.tileX, best.e.tileY);
        }
      }
      renderer?.triggerKillFill();
    }
  }
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

  renderer = createRenderer({
    ctx,
    getViewWidth,
    getViewHeight,
    player,
    getEnemies: () => enemies,
    getSprites: () => getSprites(),
  });
  engine = createEngine({
    getViewWidth,
    getViewHeight,
    player,
    input,
    renderer,
    world: {
      isSolid: (x: number, y: number) => {
        const playerRadius = 0.22;
        return hitWallCircle(x, y, playerRadius) || hitEnemyCircle(x, y, playerRadius + 0.22);
      },
      isRaySolid: (x: number, y: number) => {
        return hitWall(x, y);
      },
      getMaterial: (x: number, y: number) => {
        return getCellMaterial(Math.floor(x), Math.floor(y));
      },
      interact: (x: number, y: number) => {
        const xMap = Math.floor(x);
        const yMap = Math.floor(y);
        if (isDoorCell(xMap, yMap)) requestOpenDoor(xMap, yMap);
      },
      getWallTextureId,
    },
    events: {
      onFootstep: () => {
        audio.playSfx('footstep');
      },
      onShoot: () => {
        audio.playSfx('shoot');
        renderer?.triggerFlash();
        alertEnemiesFromNoise(player.x, player.y, 9);
        tryShootEnemies();
      },
      onTick: (dt: number) => {
        updateEnemies(dt);
        updatePickups();
        updateHealthSpawning(dt);
      },
    },
  });
  return engine;
}

export function setBackgroundColors(colors: { ceiling?: string; floor?: string }) {
  ensureEngine();
  renderer?.setBackgroundColors(colors);
}

export function triggerDeathOverlay() {
  ensureEngine();
  renderer?.triggerKillFill();
}

export function setMap(grid: number[][]) {
  ensureEngine();
  setMapState(grid);
  ensureEnemyGridForCurrentMap();
  rebuildEnemyGridFromEnemies();

  healthFloorCandidates = [];
  const w = grid[0]?.length ?? 0;
  const h = grid.length;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x] !== 0) continue;
      healthFloorCandidates.push({ x, y });
    }
  }
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
