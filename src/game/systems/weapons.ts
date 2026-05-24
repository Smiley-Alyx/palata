import type { Inventory, InventoryItemId } from './inventory';
import { SFX } from '../audio/sfx-config';

export type WeaponId = 'pipe' | 'pistol' | 'shotgun';

export const WEAPON_IDS: readonly WeaponId[] = ['pipe', 'pistol', 'shotgun'];

export type WeaponDef = {
  id: WeaponId;
  label: string;
  ammoId: InventoryItemId | null;
  range: number;
  fireSfx: string;
  emptySfx: string | null;
  hitFleshSfx: string | null;
  hitWallSfx: string | null;
  cooldownMs: number;
  damage: number;
  flash: boolean;
  noiseRadius: number;
  spreadRad: number;
  hitHalfAngleRad: number;
};

const degToRad = (deg: number) => (deg * Math.PI) / 180;

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
    spreadRad: degToRad(12),
    hitHalfAngleRad: degToRad(35),
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
    spreadRad: degToRad(2.6),
    hitHalfAngleRad: degToRad(0.25),
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
    spreadRad: degToRad(8),
    hitHalfAngleRad: degToRad(0.35),
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
  outOfAmmo: boolean;
};

export function createWeaponsSystem({ inventory }: { inventory: Inventory }) {
  let current: WeaponId = 'pipe';
  let onChanged: (() => void) | null = null;

  function reset(opts?: { pistolAmmo?: number; shotgunAmmo?: number }) {
    const pistolAmmo = opts?.pistolAmmo ?? 0;
    const shotgunAmmo = opts?.shotgunAmmo ?? 0;
    if (pistolAmmo > 0) inventory.add('pistol_ammo', pistolAmmo);
    if (shotgunAmmo > 0) inventory.add('shotgun_ammo', shotgunAmmo);
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
    setWeapon(WEAPON_IDS[(i + direction + n) % n]);
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
