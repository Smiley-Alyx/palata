import type { Player } from '../../types/game';

export function addPlayerArmor(player: Player, amount: number): void {
  const maxArmor = Math.max(0, player.maxArmor);
  const currentArmor = Math.max(0, player.armor);
  const add = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  player.armor = Math.min(maxArmor, currentArmor + add);
}

export function applyPlayerDamage(player: Player, amount: number): void {
  const damage = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const armorAbsorb = Math.min(Math.max(0, player.armor), damage);
  player.armor = Math.max(0, player.armor - armorAbsorb);

  const hpDamage = damage - armorAbsorb;
  if (hpDamage > 0) {
    player.hp = Math.max(0, player.hp - hpDamage);
  }
}
