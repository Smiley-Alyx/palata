import type { Player } from '../../types/game';
import type { PerceptionState } from './world-state';

type TierStats = {
  speedMul: number;
  damageMul: number;
  hpPerSecond: number;
  noiseMul: number;
  dash: { distance: number; cooldownMs: number } | null;
};

export type PredatorTuning = {
  predator: TierStats;
  infected: TierStats;
};

const DEFAULT_TUNING: PredatorTuning = {
  predator: {
    speedMul: 1.35,
    damageMul: 2,
    hpPerSecond: 1.5,
    noiseMul: 0.5,
    dash: { distance: 1.6, cooldownMs: 1400 },
  },
  infected: {
    speedMul: 1.1,
    damageMul: 1.25,
    hpPerSecond: 0,
    noiseMul: 0.85,
    dash: null,
  },
};

export function createPredatorSystem({
  player,
  getPerceptionStages,
  tuning = DEFAULT_TUNING,
}: {
  player: Player;
  getPerceptionStages: () => PerceptionState[];
  tuning?: PredatorTuning;
}) {
  let baseSpeed: number | null = null;
  let lastTier: 'none' | 'infected' | 'predator' = 'none';
  let hpAccumulator = 0;
  let dashCooldownMs = 0;

  function currentTier(): 'none' | 'infected' | 'predator' {
    const stages = getPerceptionStages();
    if (stages.includes('predator')) return 'predator';
    if (stages.includes('infected')) return 'infected';
    return 'none';
  }

  function applyTier(tier: 'none' | 'infected' | 'predator') {
    if (tier === lastTier) return;
    if (baseSpeed === null) baseSpeed = player.speed;

    const cfg = tier === 'none' ? null : tuning[tier];
    if (!cfg) {
      player.speed = baseSpeed;
    } else {
      player.speed = baseSpeed * cfg.speedMul;
    }
    lastTier = tier;
  }

  function tick(dt: number) {
    const tier = currentTier();
    applyTier(tier);

    if (tier === 'none') {
      hpAccumulator = 0;
      return;
    }

    const regen = tuning[tier].hpPerSecond;
    if (regen > 0 && player.hp < player.maxHp) {
      hpAccumulator += regen * dt;
      if (hpAccumulator >= 1) {
        const add = Math.floor(hpAccumulator);
        hpAccumulator -= add;
        player.hp = Math.min(player.maxHp, player.hp + add);
      }
    } else {
      hpAccumulator = 0;
    }

    if (dashCooldownMs > 0) dashCooldownMs = Math.max(0, dashCooldownMs - dt * 1000);
  }

  function getDamageMultiplier(): number {
    const tier = currentTier();
    if (tier === 'none') return 1;
    return tuning[tier].damageMul;
  }

  function getNoiseMultiplier(): number {
    const tier = currentTier();
    if (tier === 'none') return 1;
    return tuning[tier].noiseMul;
  }

  function getDashCooldownRatio(): number {
    const tier = currentTier();
    const cfg = tier === 'none' ? null : tuning[tier].dash;
    if (!cfg) return 0;
    return dashCooldownMs > 0 ? dashCooldownMs / cfg.cooldownMs : 0;
  }

  function tryDash(canMoveTo: (x: number, y: number) => boolean): boolean {
    const tier = currentTier();
    const cfg = tier === 'none' ? null : tuning[tier].dash;
    if (!cfg) return false;
    if (dashCooldownMs > 0) return false;

    const dx = Math.cos(player.rot);
    const dy = -Math.sin(player.rot);
    const steps = 8;
    const stepDist = cfg.distance / steps;
    let traveled = 0;
    for (let i = 1; i <= steps; i++) {
      const nx = player.x + dx * stepDist;
      const ny = player.y + dy * stepDist;
      if (!canMoveTo(nx, ny)) break;
      player.x = nx;
      player.y = ny;
      traveled += stepDist;
    }
    if (traveled <= 0) return false;
    dashCooldownMs = cfg.cooldownMs;
    return true;
  }

  function onMapChanged() {
    if (baseSpeed !== null) player.speed = baseSpeed;
    baseSpeed = null;
    lastTier = 'none';
    hpAccumulator = 0;
    dashCooldownMs = 0;
  }

  return {
    tick,
    getDamageMultiplier,
    getNoiseMultiplier,
    getDashCooldownRatio,
    tryDash,
    onMapChanged,
  };
}

export type PredatorSystem = ReturnType<typeof createPredatorSystem>;
