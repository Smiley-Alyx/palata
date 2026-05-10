import type { Player } from '../../types/game';

export function createPickupsSystem({
  player,
  playHealthSfx,
  isBlocked,
  getDifficulty,
}: {
  player: Player;
  playHealthSfx: () => void;
  isBlocked: (x: number, y: number, r: number) => boolean;
  getDifficulty: () => 'lost' | 'trapped' | 'consumed';
}) {
  type HealthPickup = {
    x: number;
    y: number;
    alive: boolean;
  };

  let healthPickups: HealthPickup[] = [];
  let healthFloorCandidates: Array<{ x: number; y: number }> = [];
  let healthSpawnCooldownMs = 0;

  function setHealthPickups(next: Array<{ x: number; y: number }>) {
    healthPickups = next.map((p) => ({ x: p.x, y: p.y, alive: true }));
    healthSpawnCooldownMs = 0;
  }

  function getSprites() {
    const sprites: Array<{ x: number; y: number; material: string; alive: boolean; scale?: number }> = [];
    for (const p of healthPickups) {
      sprites.push({ x: p.x, y: p.y, material: 'health', alive: p.alive, scale: 0.33 });
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
    if (!healthPickups.length) return;
    const pickupR = 0.42;
    for (const p of healthPickups) {
      if (!p.alive) continue;
      if (Math.hypot(player.x - p.x, player.y - p.y) > pickupR) continue;
      player.hp = Math.min(player.maxHp, player.hp + 20);
      p.alive = false;
      playHealthSfx();
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

    const difficulty = getDifficulty();
    const base = difficulty === 'lost' ? 12 : difficulty === 'trapped' ? 8 : 5;
    const factor = difficulty === 'lost' ? 1.1 : difficulty === 'trapped' ? 1.45 : 1.85;
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

    const difficulty = getDifficulty();
    const tries = 18;
    const pickupR = 0.25;
    const minPlayerDist = difficulty === 'lost' ? 2.1 : difficulty === 'trapped' ? 2.35 : 2.55;

    for (let i = 0; i < tries; i++) {
      const c = healthFloorCandidates[Math.floor(Math.random() * healthFloorCandidates.length)];
      const x = c.x + 0.5;
      const y = c.y + 0.5;
      if (Math.hypot(x - player.x, y - player.y) < minPlayerDist) continue;
      if (isBlocked(x, y, pickupR)) continue;
      if (hitHealthPickupCircle(x, y, pickupR * 4.0)) continue;
      healthPickups.push({ x, y, alive: true });
      break;
    }

    healthSpawnCooldownMs = difficulty === 'lost' ? 1800 : difficulty === 'trapped' ? 2400 : 3100;
  }

  function tick(dt: number) {
    updatePickups();
    updateHealthSpawning(dt);
  }

  return {
    setHealthPickups,
    getSprites,
    onMapChanged,
    tick,
  };
}
