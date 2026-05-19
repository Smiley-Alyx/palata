import type { Player } from '../../types/game';

export type PortalSpec = {
  id?: string;
  x: number;
  y: number;
  toX: number;
  toY: number;
  toRot?: number;
  radius?: number;
  once?: boolean;
  cooldownMs?: number;
};

type Portal = {
  id?: string;
  x: number;
  y: number;
  toX: number;
  toY: number;
  toRot?: number;
  radius: number;
  once: boolean;
  cooldownMs: number;
  alive: boolean;
  remainingCooldownMs: number;
};

export function createPortalsSystem({
  player,
  playSfx: _playSfx,
}: {
  player: Player;
  playSfx?: (key: string) => void;
}) {
  let portals: Portal[] = [];

  function setPortals(next: PortalSpec[]) {
    portals = Array.isArray(next)
      ? next
          .filter(
            (p) =>
              p &&
              typeof p.x === 'number' &&
              typeof p.y === 'number' &&
              typeof p.toX === 'number' &&
              typeof p.toY === 'number',
          )
          .map((p) => ({
            id: p.id,
            x: p.x,
            y: p.y,
            toX: p.toX,
            toY: p.toY,
            toRot: typeof p.toRot === 'number' ? p.toRot : undefined,
            radius: typeof p.radius === 'number' && p.radius > 0 ? p.radius : 0.45,
            once: typeof p.once === 'boolean' ? p.once : false,
            cooldownMs:
              typeof p.cooldownMs === 'number' && p.cooldownMs > 0 ? Math.floor(p.cooldownMs) : 650,
            alive: true,
            remainingCooldownMs: 0,
          }))
      : [];
  }

  function onMapChanged() {
    portals = [];
  }

  function tick(dt: number) {
    if (!portals.length) return;
    const stepMs = dt * 1000;

    for (const p of portals) {
      if (!p.alive) continue;
      p.remainingCooldownMs = Math.max(0, p.remainingCooldownMs - stepMs);
      if (p.remainingCooldownMs > 0) continue;

      const d = Math.hypot(player.x - p.x, player.y - p.y);
      if (d > p.radius) continue;

      player.x = p.toX;
      player.y = p.toY;
      if (typeof p.toRot === 'number') player.rot = p.toRot;

      p.remainingCooldownMs = p.cooldownMs;
      if (p.once) p.alive = false;
      return;
    }
  }

  return {
    setPortals,
    onMapChanged,
    tick,
  };
}

export type PortalsSystem = ReturnType<typeof createPortalsSystem>;
