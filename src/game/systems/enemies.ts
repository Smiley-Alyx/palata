import type { Player } from '../../types/game';
import type { Difficulty, EnemyKind } from '../game-types';
import { getMap, hitWall, isDoorCell } from '../../state/map-state';
import { SFX } from '../audio/sfx-config';

export type Enemy = {
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

export function createEnemiesSystem({
  player,
  getDifficulty,
  playSfx,
  playLoopingSfx,
  stopLoopingSfx,
  onRequestOpenDoor,
  isDoorBlocking,
  onEnemyKilled,
  onDamagePulse,
  onKillFill,
}: {
  player: Player;
  getDifficulty: () => Difficulty;
  playSfx: (key: string) => void;
  playLoopingSfx: (key: string, volume?: number) => void;
  stopLoopingSfx: (key: string) => void;
  onRequestOpenDoor: (xMap: number, yMap: number) => void;
  isDoorBlocking?: (xMap: number, yMap: number) => boolean;
  onEnemyKilled?: () => void;
  onDamagePulse?: () => void;
  onKillFill?: () => void;
}) {
  let enemies: Enemy[] = [];

  let enemyGridW = 0;
  let enemyGridH = 0;
  let enemyAt: Int32Array | null = null;

  let enemyDamageCooldownMs = 0;
  let enemySightLoopKey: string | null = null;

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

  function rollEnemyKind(): EnemyKind {
    return rollEnemyKindFromDifficulty(getDifficulty());
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

  function spawnEnemyAtWorld(
    x: number,
    y: number,
    opts?: { kind?: EnemyKind; alerted?: boolean; attackFlashMs?: number },
  ) {
    const enemy = createEnemyAtWorld(x, y, opts);
    enemies.push(enemy);
    rebuildEnemyGridFromEnemies();
    return enemy;
  }

  function hitWallCircle(x: number, y: number, r: number): boolean {
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

  function alertFromNoise(x: number, y: number, radius: number) {
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
    if (map[yMap][xMap] !== 0) {
      if (isDoorCell(xMap, yMap) && typeof isDoorBlocking === 'function') {
        return isDoorBlocking(xMap, yMap);
      }
      return true;
    }

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
        onRequestOpenDoor(nextX, nextY);
        e.decisionCooldownMs = 180;
      }

      if (
        isDoorCell(nextX, nextY) &&
        typeof isDoorBlocking === 'function' &&
        !isDoorBlocking(nextX, nextY)
      ) {
        // Door tile is present but currently not blocking: allow stepping through.
      } else {
        return false;
      }
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

  function updateEnemySightLoop(inSightNow: boolean, sawZombieInSight: boolean) {
    const desiredLoopKey: string | null = inSightNow
      ? sawZombieInSight
        ? SFX.enemies.husk.idle
        : SFX.enemies.orderly.idle
      : null;
    if (desiredLoopKey !== enemySightLoopKey) {
      if (enemySightLoopKey) stopLoopingSfx(enemySightLoopKey);
      if (desiredLoopKey) playLoopingSfx(desiredLoopKey, 0.35);
      enemySightLoopKey = desiredLoopKey;
    }
  }

  function updateDoorsWaitState(selfIndex: number, atCenter: boolean) {
    const e = enemies[selfIndex];
    if (e.mode !== 'wait') return;

    if (e.moveRemain <= 0 && atCenter && e.decisionCooldownMs <= 0) {
      const ok = tryStepEnemy(selfIndex, e.waitDirX, e.waitDirY);
      if (ok) {
        e.mode = e.alerted ? 'chase' : 'patrol';
        e.decisionCooldownMs = e.alerted ? 60 : 220;
      } else {
        if (isDoorCell(e.waitTileX, e.waitTileY)) onRequestOpenDoor(e.waitTileX, e.waitTileY);
        e.decisionCooldownMs = 140;
      }
    }
  }

  function updateEnemies(dt: number) {
    enemyDamageCooldownMs = Math.max(0, enemyDamageCooldownMs - dt * 1000);

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

      const tileCenterX = e.tileX + 0.5;
      const tileCenterY = e.tileY + 0.5;
      const atCenter = Math.hypot(e.x - tileCenterX, e.y - tileCenterY) < 0.05;
      if (atCenter) {
        e.x = tileCenterX;
        e.y = tileCenterY;
      }

      updateDoorsWaitState(selfIndex, atCenter);

      if (e.mode !== 'idle') {
        const stopRange = 1.05;
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
              const step =
                e.mode === 'chase' ? pickChaseStep(selfIndex) : pickPatrolStep(selfIndex);
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
          const dmg = rollEnemyDamage(e.kind, getDifficulty());
          player.hp = Math.max(0, player.hp - dmg);
          playSfx(e.kind === 'zombie' ? SFX.enemies.husk.attack : SFX.enemies.orderly.attack);
          playSfx(SFX.player.hurtMedium);
          e.attackFlashMs = 220;
          onDamagePulse?.();
          enemyDamageCooldownMs = 650;
          if (player.hp <= 0) {
            onKillFill?.();
          }
        }
      }
    }

    updateEnemySightLoop(inSightNow, sawZombieInSight);
  }

  function setEnemies(next: Array<{ x: number; y: number; kind?: EnemyKind }>) {
    enemies = next.map((e) =>
      createEnemyAtWorld(e.x, e.y, {
        kind: e.kind ?? rollEnemyKindFromDifficulty(getDifficulty()),
      }),
    );
    rebuildEnemyGridFromEnemies();
  }

  function getEnemies() {
    return enemies;
  }

  function onMapChanged() {
    ensureEnemyGridForCurrentMap();
    rebuildEnemyGridFromEnemies();
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
        onKillFill?.();
        onEnemyKilled?.();
      }
    }
  }

  return {
    setEnemies,
    getEnemies,
    onMapChanged,
    tick: updateEnemies,
    alertFromNoise,
    tryShootEnemies,
    hitEnemyCircle,
    hitWallCircle,
    createEnemyAtWorld,
    spawnEnemyAtWorld,
    rollEnemyKind,
    rebuildEnemyGridFromEnemies,
  };
}
