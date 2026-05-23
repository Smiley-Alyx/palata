// Asset manifest: logical id -> URL (relative to the public base URL).
// `id` must stay stable because the rest of the codebase (materials, HUD,
// renderer) looks images up by these ids.

export const ASSET_MANIFEST: Readonly<Record<string, string>> = Object.freeze({
  // Wall textures
  hospital_wall_stripe: 'assets/textures/walls/hospital_wall_stripe.png',
  medical_tiles: 'assets/textures/walls/medical_tiles.png',
  concrete_tunnel: 'assets/textures/walls/concrete_tunnel.png',
  metal_panels: 'assets/textures/walls/metal_panels.png',
  metal_emergency: 'assets/textures/walls/metal_emergency.png',
  organic_wall: 'assets/textures/walls/organic_wall.png',
  ventilation_shaft: 'assets/textures/walls/ventilation_shaft.png',
  flesh_wall: 'assets/textures/flesh/flesh_wall.png',
  industrial_flesh: 'assets/textures/flesh/flesh_wall.png',

  // Doors / windows
  medical_door: 'assets/textures/doors/medical_door.png',
  archive_door: 'assets/textures/doors/archive_door.png',
  ward_door: 'assets/textures/doors/ward_door.png',
  shower_door: 'assets/textures/doors/shower_door.png',
  blast_door: 'assets/textures/doors/blast_door.png',
  reinforced_window: 'assets/textures/walls/reinforced_window.svg',
  ward_window: 'assets/textures/windows/ward_window.png',
  false_window: 'assets/textures/windows/false_window.png',
  exit: 'assets/textures/doors/blast_door.png',
  keyDoor: 'assets/textures/doors/medical_door.png',

  // Floors / ceilings
  seamless_floor: 'assets/textures/floors/seamless_floor.png',
  organic_floor: 'assets/textures/floors/organic_floor.png',
  seamless_ceiling: 'assets/textures/ceilings/seamless_ceiling.png',

  // Enemies
  skeleton_husk: 'assets/sprites/enemies/skeleton_husk.png',
  medical_orderly: 'assets/sprites/enemies/medical_orderly.png',
  deformed_patient: 'assets/sprites/enemies/deformed_patient.png',
  flesh_watcher: 'assets/sprites/enemies/flesh_watcher.png',
  flesh_eye: 'assets/sprites/enemies/flesh_eye.png',
  flesh_machine: 'assets/sprites/enemies/flesh_machine.png',
  doppelganger: 'assets/sprites/enemies/doppelganger.png',

  // Bosses
  boss_chief_doctor: 'assets/sprites/bosses/boss_cheif_doctor.png',
  boss_choir: 'assets/sprites/bosses/boss_choir.png',
  boss_dade_keeper: 'assets/sprites/bosses/boss_dade_keepeer.png',
  boss_heart_hospital: 'assets/sprites/bosses/boss_heart_hospital.png',
  boss_shepherd: 'assets/sprites/bosses/boss_shepherd.png',

  // Player portrait
  playerSprite: 'assets/sprites/hud/portrait_sheet.png',

  // Pickups
  goldKey: 'assets/sprites/pickups/keys/gold_key_hd.png',
  silverKey: 'assets/sprites/pickups/keys/silver_key_hd.png',
  bloodKey: 'assets/sprites/pickups/keys/blood_key.png',
  health: 'assets/sprites/pickups/health/aid_kit.png',

  // Items / medication
  haloperidol: 'assets/sprites/pickups/medication/haloperidol.png',
  injector: 'assets/sprites/pickups/medication/injector.png',

  // Ammo
  ammo_pistol: 'assets/sprites/pickups/ammo/pistol_normal.png',
  ammo_shotgun: 'assets/sprites/pickups/ammo/shotgun_normal.png',

  // Hallucinations
  hallucination_entity: 'assets/sprites/enemies/hallucination_entity.png',
  hallucination_white_observer: 'assets/sprites/enemies/white_observer.png',

  // Artifact / overlay sprites
  artifact_hallucination: 'assets/overlays/overlay_hallucination.png',
  artifact_vhs: 'assets/overlays/overlay_vhs.png',

  // UI
  logo: 'assets/ui/menus/logo.png',
});

export type AssetId = keyof typeof ASSET_MANIFEST;
