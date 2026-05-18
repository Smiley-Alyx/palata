export type Difficulty = 'lost' | 'trapped' | 'consumed';

/**
 * Enemy roster.
 *
 * Narrative-aligned kinds:
 *  - `skeleton_husk`     — fast, low-HP melee shamblers (act like the old `zombie`).
 *  - `medical_orderly`   — patrolling humanoids with louder alert/attack profile.
 *  - `deformed_patient`  — tankier, slower; appear in mid-game blocks.
 *  - `flesh_watcher`     — perception-gated; only visible during `withdrawal`.
 *  - `doppelganger`      — predator-trigger; gated by `predator` state.
 *
 * Legacy aliases kept for back-compat with existing levels / random spawners:
 *  - `zombie` -> behaves as `skeleton_husk`
 *  - `ghost`  -> behaves as `medical_orderly`
 */
export type EnemyKind =
  | 'zombie'
  | 'ghost'
  | 'skeleton_husk'
  | 'medical_orderly'
  | 'deformed_patient'
  | 'flesh_watcher'
  | 'doppelganger';
