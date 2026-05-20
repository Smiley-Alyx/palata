import type { Player } from '../../types/game';
import type { PerceptionState } from './world-state';

export type PredatorTuning = {
  predator: {
    speedMul: number;
    sprintMul: number;
    damageMul: number;
    hpPerSecond: number;
  };
  infected: {
    speedMul: number;
    sprintMul: number;
    damageMul: number;
    hpPerSecond: number;
  };
};

const DEFAULT_TUNING: PredatorTuning = {
  predator: {
    speedMul: 1.35,
    sprintMul: 1.15,
    damageMul: 2,
    hpPerSecond: 1.5,
  },
  infected: {
    speedMul: 1.1,
    sprintMul: 1.0,
    damageMul: 1.25,
    hpPerSecond: 0,
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
  let baseSprintFactor: number | null = null;
  let lastTier: 'none' | 'infected' | 'predator' = 'none';
  let hpAccumulator = 0;

  function currentTier(): 'none' | 'infected' | 'predator' {
    const stages = getPerceptionStages();
    if (stages.includes('predator')) return 'predator';
    if (stages.includes('infected')) return 'infected';
    return 'none';
  }

  function applyTier(tier: 'none' | 'infected' | 'predator') {
    if (tier === lastTier) return;
    if (baseSpeed === null) baseSpeed = player.speed;
    if (baseSprintFactor === null) baseSprintFactor = player.sprintFactor;

    const cfg = tier === 'none' ? null : tuning[tier];
    if (!cfg) {
      player.speed = baseSpeed;
      player.sprintFactor = baseSprintFactor;
    } else {
      player.speed = baseSpeed * cfg.speedMul;
      player.sprintFactor = baseSprintFactor * cfg.sprintMul;
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
  }

  function getDamageMultiplier(): number {
    const tier = currentTier();
    if (tier === 'none') return 1;
    return tuning[tier].damageMul;
  }

  function onMapChanged() {
    if (baseSpeed !== null) player.speed = baseSpeed;
    if (baseSprintFactor !== null) player.sprintFactor = baseSprintFactor;
    baseSpeed = null;
    baseSprintFactor = null;
    lastTier = 'none';
    hpAccumulator = 0;
  }

  return {
    tick,
    getDamageMultiplier,
    onMapChanged,
  };
}

export type PredatorSystem = ReturnType<typeof createPredatorSystem>;
