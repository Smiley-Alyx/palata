import type { Player } from '../../types/game';
import type { Difficulty } from '../game-types';
import type { KeyId } from './doors';

const HEALTH_PICKUP_TUNING: Record<
  Difficulty,
  {
    healAmount: number;
    baseDesired: number;
    missingFactor: number;
    spawnCooldownMs: number;
    minPlayerDist: number;
    minMissingRatioToSpawn: number;
  }
> = {
  lost: {
    healAmount: 20,
    baseDesired: 8,
    missingFactor: 0.9,
    spawnCooldownMs: 2800,
    minPlayerDist: 2.35,
    minMissingRatioToSpawn: 0,
  },
  trapped: {
    healAmount: 16,
    baseDesired: 4,
    missingFactor: 1.1,
    spawnCooldownMs: 5600,
    minPlayerDist: 2.9,
    minMissingRatioToSpawn: 0.2,
  },
  consumed: {
    healAmount: 12,
    baseDesired: 0,
    missingFactor: 3.2,
    spawnCooldownMs: 11000,
    minPlayerDist: 3.25,
    minMissingRatioToSpawn: 0.45,
  },
};

export function createPickupsSystem({
  player,
  playHealthSfx,
  playKeySfx,
  isBlocked,
  getDifficulty,
  onKeyPickup,
  onEntityPickup,
}: {
  player: Player;
  playHealthSfx: () => void;
  playKeySfx?: () => void;
  isBlocked: (x: number, y: number, r: number) => boolean;
  getDifficulty: () => Difficulty;
  onKeyPickup?: (id: KeyId) => void;
  onEntityPickup?: (entityId: string) => void;
}) {
  type HealthPickup = {
    id?: string;
    x: number;
    y: number;
    alive: boolean;
  };

  let healthPickups: HealthPickup[] = [];

  type KeyPickup = {
    entityId?: string;
    x: number;
    y: number;
    id: KeyId;
    alive: boolean;
  };

  let keyPickups: KeyPickup[] = [];
  let healthFloorCandidates: Array<{ x: number; y: number }> = [];
  let healthSpawnCooldownMs = 0;

  function setHealthPickups(next: Array<{ id?: string; x: number; y: number }>) {
    healthPickups = next.map((p) => ({ id: p.id, x: p.x, y: p.y, alive: true }));
    healthSpawnCooldownMs = 0;
  }

  function setKeyPickups(next: Array<{ entityId?: string; x: number; y: number; id: KeyId }>) {
    keyPickups = next.map((p) => ({
      entityId: p.entityId,
      x: p.x,
      y: p.y,
      id: p.id,
      alive: true,
    }));
  }

  function getSprites() {
    const sprites: Array<{
      x: number;
      y: number;
      material: string;
      alive: boolean;
      scale?: number;
    }> = [];
    for (const p of healthPickups) {
      sprites.push({ x: p.x, y: p.y, material: 'health', alive: p.alive, scale: 0.33 });
    }
    for (const k of keyPickups) {
      const mat = k.id === 'gold' ? 'keyGold' : k.id === 'silver' ? 'keySilver' : 'keyBlood';
      sprites.push({ x: k.x, y: k.y, material: mat, alive: k.alive, scale: 0.33 });
    }
    return sprites;
  }

  function onMapChanged(grid: number[][]) {
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

  function updatePickups() {
    const pickupR = 0.42;
    for (const p of healthPickups) {
      if (!p.alive) continue;
      if (Math.hypot(player.x - p.x, player.y - p.y) > pickupR) continue;
      if (player.hp >= player.maxHp) continue;
      const tuning = HEALTH_PICKUP_TUNING[getDifficulty()];
      player.hp = Math.min(player.maxHp, player.hp + tuning.healAmount);
      p.alive = false;
      if (p.id) onEntityPickup?.(p.id);
      playHealthSfx();
    }

    for (const k of keyPickups) {
      if (!k.alive) continue;
      if (Math.hypot(player.x - k.x, player.y - k.y) > pickupR) continue;
      k.alive = false;
      if (k.entityId) onEntityPickup?.(k.entityId);
      onKeyPickup?.(k.id);
      playKeySfx?.();
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

    const tuning = HEALTH_PICKUP_TUNING[getDifficulty()];
    if (missingRatio < tuning.minMissingRatioToSpawn) return 0;

    const desired = tuning.baseDesired + Math.floor(missingRatio * tuning.missingFactor);
    return Math.max(0, desired);
  }

  function updateHealthSpawning(dt: number) {
    if (!healthFloorCandidates.length) return;
    if (player.hp <= 0) return;

    healthSpawnCooldownMs = Math.max(0, healthSpawnCooldownMs - dt);
    if (healthSpawnCooldownMs > 0) return;

    const desired = desiredHealthPickupCount();
    const alive = countAliveHealthPickups();
    if (alive >= desired) return;

    const tuning = HEALTH_PICKUP_TUNING[getDifficulty()];
    const tries = 18;
    const pickupR = 0.25;

    for (let i = 0; i < tries; i++) {
      const c = healthFloorCandidates[Math.floor(Math.random() * healthFloorCandidates.length)];
      const x = c.x + 0.5;
      const y = c.y + 0.5;
      if (Math.hypot(x - player.x, y - player.y) < tuning.minPlayerDist) continue;
      if (isBlocked(x, y, pickupR)) continue;
      if (hitHealthPickupCircle(x, y, pickupR * 4.0)) continue;
      healthPickups.push({ x, y, alive: true });
      break;
    }

    healthSpawnCooldownMs = tuning.spawnCooldownMs;
  }

  function tick(dt: number) {
    updatePickups();
    updateHealthSpawning(dt);
  }

  return {
    setHealthPickups,
    setKeyPickups,
    getSprites,
    onMapChanged,
    tick,
  };
}
