import type { Player } from '../../types/game';
import type { Inventory, InventoryItemId } from './inventory';
import { SFX } from '../audio/sfx-config';
import { addPlayerArmor } from './player-stats';

/**
 * Discrete, hand-placed items (medication, documents, ammo, weapons).
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

export type AmmoSubtype = 'pistol' | 'shotgun';

export type AmmoSpec = {
  id?: string;
  x: number;
  y: number;
  subtype?: AmmoSubtype | string;
  amount?: number;
};

type AmmoPickup = {
  id?: string;
  x: number;
  y: number;
  subtype: AmmoSubtype;
  amount: number;
  alive: boolean;
};

const AMMO_SPRITE: Record<AmmoSubtype, string> = {
  pistol: 'ammo_pistol',
  shotgun: 'ammo_shotgun',
};

const AMMO_INVENTORY_ID: Record<AmmoSubtype, InventoryItemId> = {
  pistol: 'pistol_ammo',
  shotgun: 'shotgun_ammo',
};

const AMMO_PICKUP_AMOUNT: Record<AmmoSubtype, number> = {
  pistol: 12,
  shotgun: 4,
};

export type WeaponSubtype = 'skalpel' | 'pipe' | 'pistol' | 'shotgun';

export type WeaponSpec = {
  id?: string;
  x: number;
  y: number;
  subtype?: WeaponSubtype | string;
};

type WeaponPickup = {
  id?: string;
  x: number;
  y: number;
  subtype: WeaponSubtype;
  alive: boolean;
};

const WEAPON_SPRITE: Record<WeaponSubtype, string> = {
  skalpel: 'skalpel',
  pipe: 'pipe',
  pistol: 'pistol',
  shotgun: 'shotgun',
};

const WEAPON_PICKUP_AMMO: Partial<Record<WeaponSubtype, { id: InventoryItemId; amount: number }>> =
  {
    pistol: { id: 'pistol_ammo', amount: 10 },
    shotgun: { id: 'shotgun_ammo', amount: 4 },
  };

export type ArmorSubtype = 'blue' | 'green' | 'red';

export type ArmorSpec = {
  id?: string;
  x: number;
  y: number;
  subtype?: ArmorSubtype | string;
};

type ArmorPickup = {
  id?: string;
  x: number;
  y: number;
  subtype: ArmorSubtype;
  alive: boolean;
};

const ARMOR_SPRITE: Record<ArmorSubtype, string> = {
  blue: 'armor_blue',
  green: 'armor_green',
  red: 'armor_red',
};

const ARMOR_VALUE: Record<ArmorSubtype, number> = {
  blue: 10,
  green: 30,
  red: 50,
};

export function createItemsSystem({
  player,
  inventory,
  playSfx,
  onPickup,
  onWeaponPickup,
  setMedication,
  getPerceptionStages,
  setWorldState,
}: {
  player: Player;
  inventory: Inventory;
  playSfx: (key: string) => void;
  onPickup?: (id: string) => void;
  onWeaponPickup: (id: WeaponSubtype) => void;
  setMedication: (on: boolean) => void;
  getPerceptionStages: () => ReadonlyArray<string>;
  setWorldState: (state: string, value: boolean) => void;
}) {
  let medications: MedicationPickup[] = [];
  let artifacts: ArtifactPickup[] = [];
  let ammo: AmmoPickup[] = [];
  let weapons: WeaponPickup[] = [];
  let armor: ArmorPickup[] = [];

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

  function setAmmoPickups(next: AmmoSpec[]) {
    ammo = Array.isArray(next)
      ? next
          .filter((a) => a && typeof a.x === 'number' && typeof a.y === 'number')
          .map((a) => {
            const subtype: AmmoSubtype = a.subtype === 'shotgun' ? 'shotgun' : 'pistol';
            const amount =
              typeof a.amount === 'number' && a.amount > 0
                ? Math.floor(a.amount)
                : AMMO_PICKUP_AMOUNT[subtype];
            return {
              id: a.id,
              x: a.x,
              y: a.y,
              subtype,
              amount,
              alive: true,
            };
          })
      : [];
  }

  function setWeaponPickups(next: WeaponSpec[]) {
    weapons = Array.isArray(next)
      ? next
          .filter((w) => w && typeof w.x === 'number' && typeof w.y === 'number')
          .map((w) => {
            const subtype: WeaponSubtype =
              w.subtype === 'skalpel'
                ? 'skalpel'
                : w.subtype === 'pipe'
                  ? 'pipe'
                  : w.subtype === 'shotgun'
                    ? 'shotgun'
                    : 'pistol';
            return {
              id: w.id,
              x: w.x,
              y: w.y,
              subtype,
              alive: true,
            };
          })
      : [];
  }

  function setArmorPickups(next: ArmorSpec[]) {
    armor = Array.isArray(next)
      ? next
          .filter((a) => a && typeof a.x === 'number' && typeof a.y === 'number')
          .map((a) => {
            const subtype: ArmorSubtype =
              a.subtype === 'red' ? 'red' : a.subtype === 'green' ? 'green' : 'blue';
            return {
              id: a.id,
              x: a.x,
              y: a.y,
              subtype,
              alive: true,
            };
          })
      : [];
  }

  function onMapChanged() {
    medications = [];
    artifacts = [];
    ammo = [];
    weapons = [];
    armor = [];
  }

  function tick() {
    if (
      !medications.length &&
      !artifacts.length &&
      !ammo.length &&
      !weapons.length &&
      !armor.length
    )
      return;
    const pickupR = 0.42;
    for (const m of medications) {
      if (!m.alive) continue;
      if (Math.hypot(player.x - m.x, player.y - m.y) > pickupR) continue;

      m.alive = false;
      if (m.id) onPickup?.(m.id);
      inventory.add(MEDICATION_INVENTORY_ID[m.subtype], 1);

      if (m.subtype === 'haloperidol') {
        // Discrete dose: immediately stabilize perception.
        setMedication(true);
      }
      if (m.subtype === 'injector') {
        // Experimental injector: forcibly destabilize (withdrawal) and advance
        // perception progression stages.
        setMedication(false);

        const stages = getPerceptionStages();
        if (!stages.includes('infected')) {
          setWorldState('infected', true);
        } else if (!stages.includes('nightmare')) {
          setWorldState('nightmare', true);
        } else if (!stages.includes('predator')) {
          setWorldState('predator', true);
        }
      }

      playSfx(SFX.ui.pickupMedkit);
    }

    for (const a of artifacts) {
      if (!a.alive) continue;
      if (Math.hypot(player.x - a.x, player.y - a.y) > pickupR) continue;
      a.alive = false;
      if (a.id) onPickup?.(a.id);
      inventory.add('artifact', 1);
      playSfx(SFX.ui.secretFound);
    }

    for (const a of ammo) {
      if (!a.alive) continue;
      if (Math.hypot(player.x - a.x, player.y - a.y) > pickupR) continue;
      a.alive = false;
      if (a.id) onPickup?.(a.id);
      inventory.add(AMMO_INVENTORY_ID[a.subtype], a.amount);
      playSfx(SFX.ui.pickupAmmo);
    }

    for (const w of weapons) {
      if (!w.alive) continue;
      if (Math.hypot(player.x - w.x, player.y - w.y) > pickupR) continue;
      w.alive = false;
      if (w.id) onPickup?.(w.id);
      onWeaponPickup(w.subtype);
      const ammo = WEAPON_PICKUP_AMMO[w.subtype];
      if (ammo) inventory.add(ammo.id, ammo.amount);
      playSfx(SFX.ui.pickupAmmo);
    }

    for (const a of armor) {
      if (!a.alive) continue;
      if (Math.hypot(player.x - a.x, player.y - a.y) > pickupR) continue;
      a.alive = false;
      if (a.id) onPickup?.(a.id);
      addPlayerArmor(player, ARMOR_VALUE[a.subtype]);
      playSfx(SFX.ui.pickupAmmo);
    }
  }

  function getSprites() {
    const out: Array<{ x: number; y: number; material: string; alive: boolean; scale: number }> =
      [];
    if (
      !medications.length &&
      !artifacts.length &&
      !ammo.length &&
      !weapons.length &&
      !armor.length
    )
      return out;
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
    for (const a of ammo) {
      if (!a.alive) continue;
      out.push({
        x: a.x,
        y: a.y,
        material: AMMO_SPRITE[a.subtype],
        alive: true,
        scale: 0.33,
      });
    }
    for (const w of weapons) {
      if (!w.alive) continue;
      out.push({
        x: w.x,
        y: w.y,
        material: WEAPON_SPRITE[w.subtype],
        alive: true,
        scale: 0.33,
      });
    }
    for (const a of armor) {
      if (!a.alive) continue;
      out.push({
        x: a.x,
        y: a.y,
        material: ARMOR_SPRITE[a.subtype],
        alive: true,
        scale: 0.33,
      });
    }
    return out;
  }

  return {
    setMedicationPickups,
    setArtifactPickups,
    setAmmoPickups,
    setWeaponPickups,
    setArmorPickups,
    onMapChanged,
    tick,
    getSprites,
  };
}
