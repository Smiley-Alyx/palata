import type { Inventory, InventoryItemId } from './inventory';
import { SFX } from '../audio/sfx-config';

export type WeaponId = 'pipe' | 'pistol' | 'shotgun';

export const WEAPON_IDS: readonly WeaponId[] = ['pipe', 'pistol', 'shotgun'];

export type WeaponShotKind = 'melee' | 'ranged';

export type WeaponDef = {
  id: WeaponId;
  label: string;
  kind: WeaponShotKind;
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
    kind: 'melee',
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
    kind: 'ranged',
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
    kind: 'ranged',
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

export type WeaponShotResult = {
  weapon: WeaponDef;
  kind: WeaponShotKind;
  fired: boolean;
};

export function createWeaponsSystem({ inventory }: { inventory: Inventory }) {
  let current: WeaponId | null = null;
  const owned = new Set<WeaponId>();
  let onChanged: (() => void) | null = null;

  function reset() {
    current = null;
    owned.clear();
    onChanged?.();
  }

  function getCurrent(): WeaponId | null {
    return current;
  }

  function getCurrentDef(): WeaponDef | null {
    return current ? DEFS[current] : null;
  }

  function getAmmo(): number | null {
    const weapon = getCurrentDef();
    if (!weapon?.ammoId) return null;
    return inventory.get(weapon.ammoId);
  }

  function setWeapon(id: WeaponId) {
    if (!owned.has(id)) return;
    if (current === id) return;
    current = id;
    onChanged?.();
  }

  function acquire(id: WeaponId) {
    owned.add(id);
    setWeapon(id);
  }

  function cycleWeapon(direction: 1 | -1) {
    const available = WEAPON_IDS.filter((id) => owned.has(id));
    if (!available.length) return;
    const i = current ? available.indexOf(current) : -1;
    const n = available.length;
    setWeapon(available[(i + direction + n) % n]);
  }

  function tryFire(): WeaponShotResult | null {
    if (!current) return null;
    const weapon = DEFS[current];
    if (weapon.ammoId && !inventory.consume(weapon.ammoId, 1)) {
      return { weapon, kind: weapon.kind, fired: false };
    }
    return { weapon, kind: weapon.kind, fired: true };
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
    acquire,
    cycleWeapon,
    tryFire,
    setOnChanged,
  };
}

export type WeaponsSystem = ReturnType<typeof createWeaponsSystem>;
