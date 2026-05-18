export type Difficulty = 'lost' | 'trapped' | 'consumed';

// `zombie` and `ghost` are legacy aliases for `skeleton_husk` / `medical_orderly`.
export type EnemyKind =
  | 'zombie'
  | 'ghost'
  | 'skeleton_husk'
  | 'medical_orderly'
  | 'deformed_patient'
  | 'flesh_watcher'
  | 'doppelganger';
