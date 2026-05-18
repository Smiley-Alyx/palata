import type { Player } from '../../types/game';
import type { Inventory, InventoryItemId } from './inventory';
import { SFX } from '../audio/sfx-config';

/**
 * Discrete, hand-placed items (medication, documents, ammo).
 *
 * Distinct from `pickups.ts` because items are entity-driven, don't respawn,
 * and have side effects beyond a simple HP refill (medication flips world
 * state, documents open the note overlay, etc.).
 */

export type MedicationSubtype = 'haloperidol' | 'injector';

export type MedicationSpec = {
  id?: string;
  x: number;
  y: number;
  subtype?: MedicationSubtype | string;
};

type MedicationPickup = {
  id?: string;
  x: number;
  y: number;
  subtype: MedicationSubtype;
  alive: boolean;
};

const MEDICATION_SPRITE: Record<MedicationSubtype, string> = {
  haloperidol: 'haloperidol',
  injector: 'injector',
};

const MEDICATION_INVENTORY_ID: Record<MedicationSubtype, InventoryItemId> = {
  haloperidol: 'haloperidol',
  injector: 'injector',
};

export function createItemsSystem({
  player,
  inventory,
  playSfx,
  setMedication,
}: {
  player: Player;
  inventory: Inventory;
  playSfx: (key: string) => void;
  setMedication: (on: boolean) => void;
}) {
  let medications: MedicationPickup[] = [];

  function setMedicationPickups(next: MedicationSpec[]) {
    medications = Array.isArray(next)
      ? next
          .filter((m) => m && typeof m.x === 'number' && typeof m.y === 'number')
          .map((m) => ({
            id: m.id,
            x: m.x,
            y: m.y,
            subtype: m.subtype === 'injector' ? 'injector' : 'haloperidol',
            alive: true,
          }))
      : [];
  }

  function onMapChanged() {
    medications = [];
  }

  function tick() {
    if (!medications.length) return;
    const pickupR = 0.42;
    for (const m of medications) {
      if (!m.alive) continue;
      if (Math.hypot(player.x - m.x, player.y - m.y) > pickupR) continue;

      m.alive = false;
      inventory.add(MEDICATION_INVENTORY_ID[m.subtype], 1);

      if (m.subtype === 'haloperidol') {
        // Discrete dose: immediately stabilize perception.
        setMedication(true);
      }
      // Injector handling (perception progression) will be wired in a later
      // phase together with infection mechanics. For now we only stockpile it.

      playSfx(SFX.ui.pickupMedkit);
    }
  }

  function getSprites() {
    if (!medications.length) {
      return [] as Array<{ x: number; y: number; material: string; alive: boolean; scale: number }>;
    }
    const out: Array<{ x: number; y: number; material: string; alive: boolean; scale: number }> =
      [];
    for (const m of medications) {
      if (!m.alive) continue;
      out.push({
        x: m.x,
        y: m.y,
        material: MEDICATION_SPRITE[m.subtype],
        alive: true,
        scale: 0.33,
      });
    }
    return out;
  }

  return {
    setMedicationPickups,
    onMapChanged,
    tick,
    getSprites,
  };
}
