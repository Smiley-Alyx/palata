import type { Difficulty, EnemyKind } from '../game-types';
import { SFX } from '../audio/sfx-config';

export type EnemyProfile = {
  material: string;
  hp: number;
  speedPatrol: number;
  speedChase: number;
  // Render scale relative to a 1-tile-tall sprite. Bosses use >1 for presence.
  scale?: number;
  pull?: {
    range: number;
    strength: number;
    minDistance: number;
  };
  sightLoop: string | null;
  attack: string;
  hurt: string | null;
  death: string | null;
  damage: Record<Difficulty, { min: number; max: number }>;
};

const HUSK: EnemyProfile = {
  material: 'skeleton_husk',
  hp: 1,
  speedPatrol: 0.8,
  speedChase: 1.2,
  sightLoop: SFX.enemies.husk.idle,
  attack: SFX.enemies.husk.attack,
  hurt: SFX.enemies.orderly.hurt,
  death: SFX.enemies.husk.death,
  damage: {
    lost: { min: 5, max: 8 },
    trapped: { min: 6, max: 11 },
    consumed: { min: 7, max: 15 },
  },
};

const ORDERLY: EnemyProfile = {
  material: 'medical_orderly',
  hp: 2,
  speedPatrol: 0.7,
  speedChase: 1.0,
  sightLoop: SFX.enemies.orderly.idle,
  attack: SFX.enemies.orderly.attack,
  hurt: SFX.enemies.orderly.hurt,
  death: SFX.enemies.orderly.death,
  damage: {
    lost: { min: 18, max: 27 },
    trapped: { min: 20, max: 32 },
    consumed: { min: 22, max: 42 },
  },
};

const DEFORMED: EnemyProfile = {
  material: 'deformed_patient',
  hp: 3,
  speedPatrol: 0.55,
  speedChase: 0.8,
  sightLoop: SFX.enemies.husk.idle,
  attack: SFX.enemies.husk.attack,
  hurt: SFX.enemies.orderly.hurt,
  death: SFX.enemies.husk.death,
  damage: {
    lost: { min: 12, max: 18 },
    trapped: { min: 14, max: 24 },
    consumed: { min: 18, max: 32 },
  },
};

const FLESH_WATCHER: EnemyProfile = {
  material: 'flesh_watcher',
  hp: 2,
  speedPatrol: 0.5,
  speedChase: 0.85,
  sightLoop: SFX.hallucinations.whisperLoop,
  attack: SFX.hallucinations.burst,
  hurt: SFX.hallucinations.burst,
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
  hurt: SFX.hallucinations.burst,
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
  hurt: SFX.enemies.orderly.hurt,
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
  hurt: SFX.enemies.orderly.hurt,
  death: SFX.enemies.orderly.death,
  damage: {
    lost: { min: 20, max: 30 },
    trapped: { min: 22, max: 34 },
    consumed: { min: 26, max: 42 },
  },
};

const BOSS_CHIEF_DOCTOR: EnemyProfile = {
  material: 'boss_chief_doctor',
  hp: 18,
  scale: 1.5,
  pull: {
    range: 5.5,
    strength: 0.7,
    minDistance: 1.1,
  },
  speedPatrol: 0.6,
  speedChase: 1.0,
  sightLoop: SFX.bosses.chiefDoctor.intro,
  attack: SFX.bosses.chiefDoctor.attack,
  hurt: SFX.enemies.orderly.hurt,
  death: SFX.bosses.chiefDoctor.death,
  damage: {
    lost: { min: 22, max: 30 },
    trapped: { min: 26, max: 38 },
    consumed: { min: 32, max: 48 },
  },
};

const BOSS_CHOIR: EnemyProfile = {
  // Cluster-of-mouths choir. Slow but devastating in melee.
  material: 'boss_choir',
  hp: 22,
  scale: 1.6,
  speedPatrol: 0.35,
  speedChase: 0.6,
  sightLoop: SFX.hallucinations.whisperLoop,
  attack: SFX.hallucinations.burst,
  hurt: SFX.hallucinations.burst,
  death: SFX.hallucinations.insanityRing,
  damage: {
    lost: { min: 24, max: 32 },
    trapped: { min: 30, max: 42 },
    consumed: { min: 36, max: 54 },
  },
};

const BOSS_DADE_KEEPER: EnemyProfile = {
  // The keeper of the dead. Carries a key-thematic role.
  material: 'boss_dade_keeper',
  hp: 24,
  scale: 1.5,
  speedPatrol: 0.5,
  speedChase: 0.9,
  sightLoop: SFX.enemies.orderly.idle,
  attack: SFX.enemies.orderly.attack,
  hurt: SFX.enemies.orderly.hurt,
  death: SFX.enemies.orderly.death,
  damage: {
    lost: { min: 26, max: 36 },
    trapped: { min: 32, max: 44 },
    consumed: { min: 38, max: 56 },
  },
};

const BOSS_HEART_HOSPITAL: EnemyProfile = {
  // Hospital-as-organism core. Stationary in lore; uses ambient as sightLoop.
  material: 'boss_heart_hospital',
  hp: 32,
  scale: 2.2,
  speedPatrol: 0.15,
  speedChase: 0.3,
  sightLoop: SFX.bosses.heartHospital.ambient,
  attack: SFX.bosses.heartHospital.attack,
  hurt: SFX.hallucinations.burst,
  death: SFX.bosses.heartHospital.death,
  damage: {
    lost: { min: 30, max: 42 },
    trapped: { min: 38, max: 52 },
    consumed: { min: 46, max: 64 },
  },
};

const BOSS_SHEPHERD: EnemyProfile = {
  // The predator-shepherd. Final-act mirror to the player.
  material: 'boss_shepherd',
  hp: 26,
  scale: 1.5,
  speedPatrol: 0.9,
  speedChase: 1.3,
  sightLoop: SFX.transitions.predatorGrowl,
  attack: SFX.transitions.predatorHunt,
  hurt: SFX.enemies.orderly.hurt,
  death: SFX.enemies.orderly.death,
  damage: {
    lost: { min: 26, max: 38 },
    trapped: { min: 32, max: 46 },
    consumed: { min: 40, max: 58 },
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
  boss_chief_doctor: BOSS_CHIEF_DOCTOR,
  boss_choir: BOSS_CHOIR,
  boss_dade_keeper: BOSS_DADE_KEEPER,
  boss_heart_hospital: BOSS_HEART_HOSPITAL,
  boss_shepherd: BOSS_SHEPHERD,
};

export function getEnemyProfile(kind: EnemyKind): EnemyProfile {
  return PROFILES[kind] ?? HUSK;
}

export function rollEnemyDamage(kind: EnemyKind, difficulty: Difficulty): number {
  const bracket = getEnemyProfile(kind).damage[difficulty];
  const raw = bracket.min + Math.floor(Math.random() * (bracket.max - bracket.min + 1));
  return Math.max(1, raw);
}
