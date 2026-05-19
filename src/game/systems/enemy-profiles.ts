import type { Difficulty, EnemyKind } from '../game-types';
import { SFX } from '../audio/sfx-config';

export type EnemyProfile = {
  material: string;
  hp: number;
  speedPatrol: number;
  speedChase: number;
  sightLoop: string | null;
  attack: string;
  death: string | null;
  damage: Record<Difficulty, { min: number; max: number }>;
};

const HUSK: EnemyProfile = {
  material: 'skeleton_husk',
  hp: 1,
  speedPatrol: 0.65,
  speedChase: 0.95,
  sightLoop: SFX.enemies.husk.idle,
  attack: SFX.enemies.husk.attack,
  death: SFX.enemies.husk.death,
  damage: {
    lost: { min: 4, max: 7 },
    trapped: { min: 4, max: 9 },
    consumed: { min: 4, max: 12 },
  },
};

const ORDERLY: EnemyProfile = {
  material: 'medical_orderly',
  hp: 2,
  speedPatrol: 0.7,
  speedChase: 1.0,
  sightLoop: SFX.enemies.orderly.idle,
  attack: SFX.enemies.orderly.attack,
  death: SFX.enemies.orderly.death,
  damage: {
    lost: { min: 16, max: 24 },
    trapped: { min: 16, max: 28 },
    consumed: { min: 16, max: 36 },
  },
};

const DEFORMED: EnemyProfile = {
  material: 'deformed_patient',
  hp: 3,
  speedPatrol: 0.55,
  speedChase: 0.8,
  sightLoop: SFX.enemies.husk.idle,
  attack: SFX.enemies.husk.attack,
  death: SFX.enemies.husk.death,
  damage: {
    lost: { min: 10, max: 16 },
    trapped: { min: 12, max: 20 },
    consumed: { min: 14, max: 26 },
  },
};

const FLESH_WATCHER: EnemyProfile = {
  material: 'flesh_watcher',
  hp: 2,
  speedPatrol: 0.5,
  speedChase: 0.85,
  sightLoop: SFX.hallucinations.whisperLoop,
  attack: SFX.hallucinations.burst,
  death: SFX.hallucinations.insanityRing,
  damage: {
    lost: { min: 8, max: 14 },
    trapped: { min: 10, max: 18 },
    consumed: { min: 12, max: 22 },
  },
};

const FLESH_EYE: EnemyProfile = {
  material: 'flesh_eye',
  hp: 2,
  speedPatrol: 0.0,
  speedChase: 0.0,
  sightLoop: SFX.hallucinations.whisperLoop,
  attack: SFX.hallucinations.burst,
  death: SFX.hallucinations.insanityRing,
  damage: {
    lost: { min: 6, max: 10 },
    trapped: { min: 8, max: 14 },
    consumed: { min: 10, max: 18 },
  },
};

const FLESH_MACHINE: EnemyProfile = {
  material: 'flesh_machine',
  hp: 8,
  speedPatrol: 0.4,
  speedChase: 0.7,
  sightLoop: SFX.transitions.predatorGrowl,
  attack: SFX.weapons.shotgun.fire,
  death: SFX.enemies.orderly.death,
  damage: {
    lost: { min: 18, max: 28 },
    trapped: { min: 22, max: 34 },
    consumed: { min: 28, max: 44 },
  },
};

const DOPPELGANGER: EnemyProfile = {
  material: 'doppelganger',
  hp: 4,
  speedPatrol: 0.75,
  speedChase: 1.1,
  sightLoop: SFX.transitions.predatorGrowl,
  attack: SFX.transitions.predatorHunt,
  death: SFX.enemies.orderly.death,
  damage: {
    lost: { min: 20, max: 30 },
    trapped: { min: 22, max: 34 },
    consumed: { min: 26, max: 42 },
  },
};

const PROFILES: Record<EnemyKind, EnemyProfile> = {
  skeleton_husk: HUSK,
  medical_orderly: ORDERLY,
  deformed_patient: DEFORMED,
  flesh_watcher: FLESH_WATCHER,
  flesh_eye: FLESH_EYE,
  flesh_machine: FLESH_MACHINE,
  doppelganger: DOPPELGANGER,
};

export function getEnemyProfile(kind: EnemyKind): EnemyProfile {
  return PROFILES[kind] ?? HUSK;
}

export function rollEnemyDamage(kind: EnemyKind, difficulty: Difficulty): number {
  const bracket = getEnemyProfile(kind).damage[difficulty];
  const raw = bracket.min + Math.floor(Math.random() * (bracket.max - bracket.min + 1));
  return Math.max(1, raw);
}
