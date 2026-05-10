import type { SfxKey } from './audio-manager';

const base = new URL(import.meta.env.BASE_URL, window.location.origin);

function url(path: string) {
  return path.startsWith('/') ? new URL(path.slice(1), base).toString() : new URL(path, base).toString();
}

export const DEFAULT_SFX: Partial<Record<SfxKey, string>> = {
  doorOpen: url('/assets/sounds/sfx/door.wav'),
  footstep: url('/assets/sounds/sfx/step.wav'),
  shoot: url('/assets/sounds/sfx/shoot.wav'),
  damage: url('/assets/sounds/sfx/damage.wav'),
  enemy: url('/assets/sounds/sfx/enemy.wav'),
  zombie: url('/assets/sounds/sfx/zombie.wav'),
  health: url('/assets/sounds/sfx/health.wav'),
} as const;
