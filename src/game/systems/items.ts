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

export type ArtifactSubtype = 'hallucination' | 'vhs';

export type ArtifactSpec = {
  id?: string;
  x: number;
  y: number;
  subtype?: ArtifactSubtype | string;
};

type ArtifactPickup = {
  id?: string;
  x: number;
  y: number;
  subtype: ArtifactSubtype;
  alive: boolean;
};

const ARTIFACT_SPRITE: Record<ArtifactSubtype, string> = {
  hallucination: 'artifact_hallucination',
  vhs: 'artifact_vhs',
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
  let artifacts: ArtifactPickup[] = [];

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

  function setArtifactPickups(next: ArtifactSpec[]) {
    artifacts = Array.isArray(next)
      ? next
          .filter((a) => a && typeof a.x === 'number' && typeof a.y === 'number')
          .map((a) => ({
            id: a.id,
            x: a.x,
            y: a.y,
            subtype: a.subtype === 'vhs' ? 'vhs' : 'hallucination',
            alive: true,
          }))
      : [];
  }

  function onMapChanged() {
    medications = [];
    artifacts = [];
  }

  function tick() {
    if (!medications.length && !artifacts.length) return;
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

    for (const a of artifacts) {
      if (!a.alive) continue;
      if (Math.hypot(player.x - a.x, player.y - a.y) > pickupR) continue;
      a.alive = false;
      inventory.add('artifact', 1);
      playSfx(SFX.ui.secretFound);
    }
  }

  function getSprites() {
    const out: Array<{ x: number; y: number; material: string; alive: boolean; scale: number }> =
      [];
    if (!medications.length && !artifacts.length) return out;
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
    for (const a of artifacts) {
      if (!a.alive) continue;
      out.push({
        x: a.x,
        y: a.y,
        material: ARTIFACT_SPRITE[a.subtype],
        alive: true,
        scale: 0.45,
      });
    }
    return out;
  }

  return {
    setMedicationPickups,
    setArtifactPickups,
    onMapChanged,
    tick,
    getSprites,
  };
}
