import { SFX } from '../audio/sfx-config';

/**
 * Hallucination layer.
 *
 * Ghost entities that exist in the world only when the player's perception is
 * altered. They are spawned via level entities of type `'hallucination'`
 * and gated by `enabledInStates` (e.g. `['withdrawal']`) — the standard
 * world-state filtering in `rayc.ts/reapplyEntities` decides which ones are
 * currently active.
 *
 * Behavior implemented here:
 *  - Each hallucination has an "appear" and "vanish" distance with hysteresis.
 *    When the player gets closer than `vanishDistance` it disappears and a
 *    short burst SFX plays. It re-appears once the player moves back beyond
 *    `appearDistance`.
 *  - `getSprites()` returns a renderer-compatible sprite list so the renderer
 *    can draw them alongside regular pickups/enemies.
 */

export type HallucinationSubtype = 'entity' | 'white_observer';

export type HallucinationSpec = {
  id?: string;
  x: number;
  y: number;
  subtype?: HallucinationSubtype | string;
  appearDistance?: number;
  vanishDistance?: number;
  scale?: number;
};

type Hallucination = {
  id?: string;
  x: number;
  y: number;
  subtype: HallucinationSubtype;
  appearDistance: number;
  vanishDistance: number;
  scale: number;
  visible: boolean;
};

const SPRITE_MATERIAL: Record<HallucinationSubtype, string> = {
  entity: 'hallucination_entity',
  white_observer: 'hallucination_white_observer',
};

export function createHallucinationsSystem({
  player,
  playSfx,
}: {
  player: { x: number; y: number };
  playSfx: (key: string) => void;
}) {
  let halls: Hallucination[] = [];

  function setHallucinations(next: HallucinationSpec[]) {
    halls = Array.isArray(next)
      ? next
          .filter((h) => h && typeof h.x === 'number' && typeof h.y === 'number')
          .map((h) => {
            const subtype: HallucinationSubtype =
              h.subtype === 'white_observer' ? 'white_observer' : 'entity';
            const vanish = typeof h.vanishDistance === 'number' ? h.vanishDistance : 1.6;
            const appear = typeof h.appearDistance === 'number' ? h.appearDistance : vanish + 1.4;
            return {
              id: h.id,
              x: h.x,
              y: h.y,
              subtype,
              appearDistance: Math.max(appear, vanish + 0.1),
              vanishDistance: vanish,
              scale: typeof h.scale === 'number' ? h.scale : 1,
              visible: true,
            };
          })
      : [];
  }

  function onMapChanged() {
    halls = [];
  }

  function tick(_dt: number) {
    if (!halls.length) return;
    for (const h of halls) {
      const d = Math.hypot(player.x - h.x, player.y - h.y);
      if (h.visible && d <= h.vanishDistance) {
        h.visible = false;
        playSfx(SFX.hallucinations.burst);
      } else if (!h.visible && d >= h.appearDistance) {
        h.visible = true;
        playSfx(SFX.hallucinations.insanityRing);
      }
    }
  }

  function getSprites() {
    if (!halls.length)
      return [] as Array<{ x: number; y: number; material: string; alive: boolean; scale: number }>;
    const out: Array<{ x: number; y: number; material: string; alive: boolean; scale: number }> =
      [];
    for (const h of halls) {
      if (!h.visible) continue;
      out.push({
        x: h.x,
        y: h.y,
        material: SPRITE_MATERIAL[h.subtype],
        alive: true,
        scale: h.scale,
      });
    }
    return out;
  }

  return {
    setHallucinations,
    onMapChanged,
    tick,
    getSprites,
  };
}
