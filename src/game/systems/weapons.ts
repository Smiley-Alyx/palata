import type { Inventory, InventoryItemId } from './inventory';
import { SFX } from '../audio/sfx-config';

/**
 * Player weapon system.
 *
 * Tracks which weapon is currently equipped and routes the engine's
 * `onShoot` event to the right SFX + gameplay effect:
 *
 *  - `pipe`     melee, no ammo, short range (handled by `tryMeleeHitNearest`).
 *  - `pistol`   ranged, consumes `pistol_ammo` from inventory.
 *  - `shotgun`  ranged, consumes `shotgun_ammo` from inventory.
 *
 * Weapon switching is exposed via `setWeapon(id)`; the engine input layer
 * binds digit keys 1/2/3 to it (see `rayc.ts`).
 */

export type WeaponId = 'pipe' | 'pistol' | 'shotgun';

export const WEAPON_IDS: readonly WeaponId[] = ['pipe', 'pistol', 'shotgun'];

export type WeaponDef = {
  id: WeaponId;
  label: string;
  /** Inventory ammo bucket, or `null` for melee weapons. */
  ammoId: InventoryItemId | null;
  range: number;
  fireSfx: string;
  emptySfx: string | null;
  /** Hit-flesh SFX (melee only). */
  hitFleshSfx: string | null;
  /** Hit-wall SFX (melee only). */
  hitWallSfx: string | null;
  /** Cooldown between shots / swings (ms). */
  cooldownMs: number;
  /** Damage per hit. */
  damage: number;
  /** Whether the weapon plays a muzzle/screen flash. */
  flash: boolean;
  /** Noise radius alerting nearby enemies. */
  noiseRadius: number;
};

const DEFS: Record<WeaponId, WeaponDef> = {
  pipe: {
    id: 'pipe',
    label: 'PIPE',
    ammoId: null,
    range: 1.4,
    fireSfx: SFX.weapons.pipe.swing,
    emptySfx: null,
    hitFleshSfx: SFX.weapons.pipe.hitFlesh,
    hitWallSfx: SFX.weapons.pipe.hitWall,
    cooldownMs: 380,
    damage: 1,
    flash: false,
    noiseRadius: 4,
  },
  pistol: {
    id: 'pistol',
    label: 'PISTOL',
    ammoId: 'pistol_ammo',
    range: 10,
    fireSfx: SFX.weapons.pistol.fire,
    emptySfx: SFX.weapons.pistol.empty,
    hitFleshSfx: null,
    hitWallSfx: null,
    cooldownMs: 280,
    damage: 1,
    flash: true,
    noiseRadius: 9,
  },
  shotgun: {
    id: 'shotgun',
    label: 'SHOTGUN',
    ammoId: 'shotgun_ammo',
    range: 8,
    fireSfx: SFX.weapons.shotgun.fire,
    emptySfx: SFX.weapons.pistol.empty,
    hitFleshSfx: null,
    hitWallSfx: null,
    cooldownMs: 720,
    damage: 2,
    flash: true,
    noiseRadius: 12,
  },
};

export function getWeaponDef(id: WeaponId): WeaponDef {
  return DEFS[id];
}

export type WeaponShotKind = 'melee' | 'ranged';

export type WeaponShotResult = {
  weapon: WeaponDef;
  kind: WeaponShotKind;
  fired: boolean;
  /** True when the trigger was pulled but no ammo was available. */
  outOfAmmo: boolean;
};

export function createWeaponsSystem({ inventory }: { inventory: Inventory }) {
  let current: WeaponId = 'pipe';
  let onChanged: (() => void) | null = null;

  /** Default starting ammo on level start: handed out via `reset()`. */
  function reset(opts?: { pistolAmmo?: number; shotgunAmmo?: number }) {
    const want = {
      pistol_ammo: opts?.pistolAmmo ?? 0,
      shotgun_ammo: opts?.shotgunAmmo ?? 0,
    };
    if (want.pistol_ammo > 0) inventory.add('pistol_ammo', want.pistol_ammo);
    if (want.shotgun_ammo > 0) inventory.add('shotgun_ammo', want.shotgun_ammo);
    current = 'pipe';
    onChanged?.();
  }

  function getCurrent(): WeaponId {
    return current;
  }

  function getCurrentDef(): WeaponDef {
    return DEFS[current];
  }

  function getAmmo(id: WeaponId = current): number | null {
    const def = DEFS[id];
    if (!def.ammoId) return null;
    return inventory.get(def.ammoId);
  }

  function setWeapon(id: WeaponId) {
    if (current === id) return;
    current = id;
    onChanged?.();
  }

  function cycleWeapon(direction: 1 | -1) {
    const i = WEAPON_IDS.indexOf(current);
    const n = WEAPON_IDS.length;
    const next = WEAPON_IDS[(i + direction + n) % n];
    setWeapon(next);
  }

  function tryFire(): WeaponShotResult {
    const weapon = DEFS[current];
    const kind: WeaponShotKind = weapon.ammoId ? 'ranged' : 'melee';

    if (weapon.ammoId) {
      const has = inventory.consume(weapon.ammoId, 1);
      if (!has) return { weapon, kind, fired: false, outOfAmmo: true };
      onChanged?.();
    }
    return { weapon, kind, fired: true, outOfAmmo: false };
  }

  function setOnChanged(cb: (() => void) | null) {
    onChanged = cb;
  }

  return {
    reset,
    getCurrent,
    getCurrentDef,
    getAmmo,
    setWeapon,
    cycleWeapon,
    tryFire,
    setOnChanged,
  };
}

export type WeaponsSystem = ReturnType<typeof createWeaponsSystem>;
