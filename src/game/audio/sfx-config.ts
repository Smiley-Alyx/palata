import type { SfxKey } from './audio-manager';

const base = new URL(import.meta.env.BASE_URL, window.location.origin);

function url(path: string) {
  return path.startsWith('/')
    ? new URL(path.slice(1), base).toString()
    : new URL(path, base).toString();
}

/**
 * Namespaced SFX catalog.
 *
 * String values double as the audio-manager key. Use `SFX.weapons.pipe.swing`
 * etc. in callers instead of stringly-typed magic.
 */
export const SFX = {
  ui: {
    menuMove: 'ui.menu.move',
    menuSelect: 'ui.menu.select',
    menuError: 'ui.menu.error',
    secretFound: 'ui.secret.found',
    pickupAmmo: 'ui.pickup.ammo',
    pickupKey: 'ui.pickup.key',
    pickupMedkit: 'ui.pickup.medkit',
  },
  weapons: {
    pipe: {
      swing: 'weapon.pipe.swing',
      hitWall: 'weapon.pipe.hit.wall',
      hitFlesh: 'weapon.pipe.hit.flesh',
    },
    pistol: {
      fire: 'weapon.pistol.fire',
      empty: 'weapon.pistol.empty',
      reload: 'weapon.pistol.reload',
    },
    shotgun: {
      fire: 'weapon.shotgun.fire',
      reload: 'weapon.shotgun.reload',
    },
  },
  footsteps: {
    concrete: 'footstep.concrete',
    tile: 'footstep.tile',
    metal: 'footstep.metal',
    flesh: 'footstep.flesh',
  },
  enemies: {
    husk: {
      idle: 'enemy.husk.idle',
      attack: 'enemy.husk.attack',
      death: 'enemy.husk.death',
    },
    orderly: {
      idle: 'enemy.orderly.idle',
      alert: 'enemy.orderly.alert',
      attack: 'enemy.orderly.attack',
      hurt: 'enemy.orderly.hurt',
      death: 'enemy.orderly.death',
    },
  },
  hallucinations: {
    burst: 'hallucination.burst',
    whisperLoop: 'hallucination.whisper.loop',
    vhsGlitch: 'hallucination.vhs.glitch',
    insanityRing: 'hallucination.insanity.ring',
    whiteFigure: {
      idle: 'hallucination.white_figure.idle',
      attack: 'hallucination.white_figure.attack',
      death: 'hallucination.white_figure.death',
      manifest: 'hallucination.white_figure.manifest',
    },
  },
  bosses: {
    chiefDoctor: {
      intro: 'boss.chief_doctor.intro',
      attack: 'boss.chief_doctor.attack',
      death: 'boss.chief_doctor.death',
    },
    heartHospital: {
      ambient: 'boss.heart_hospital.ambient',
      attack: 'boss.heart_hospital.attack',
      death: 'boss.heart_hospital.death',
    },
  },
  machinery: {
    fluorescentBuzz: 'machinery.fluorescent.buzz',
    machineHum: 'machinery.machine.hum',
    pipeSteam: 'machinery.pipe.steam',
  },
  transitions: {
    hospitalDoorOpen: 'transition.door.hospital.open',
    hospitalDoorClose: 'transition.door.hospital.close',
    industrialDoorOpen: 'transition.door.industrial.open',
    fleshDoorOpen: 'transition.door.flesh.open',
    predatorGrowl: 'transition.predator.growl',
    predatorHunt: 'transition.predator.hunt',
    predatorTransform: 'transition.predator.transform',
  },
  player: {
    breathCalm: 'player.breath.calm',
    breathStress: 'player.breath.stress',
    breathPanic: 'player.breath.panic',
    breathPredator: 'player.breath.predator',
    hurtLight: 'player.hurt.light',
    hurtMedium: 'player.hurt.medium',
    hurtHeavy: 'player.hurt.heavy',
  },
  ambient: {
    distantScream: 'ambient.distant.scream',
    heartbeatWall: 'ambient.heartbeat.wall',
  },
} as const;

/**
 * Resolved registry: SFX key -> URL.
 * Built from the namespaced `SFX` catalog so adding new sounds is one-stop.
 */
export const DEFAULT_SFX: Record<SfxKey, string> = {
  // --- UI ---
  [SFX.ui.menuMove]: url('/assets/sounds/ui/menu_move.wav'),
  [SFX.ui.menuSelect]: url('/assets/sounds/ui/menu_select.wav'),
  [SFX.ui.menuError]: url('/assets/sounds/ui/menu_error.wav'),
  [SFX.ui.secretFound]: url('/assets/sounds/ui/secret_found.wav'),
  [SFX.ui.pickupAmmo]: url('/assets/sounds/ui/pickup_ammo.wav'),
  [SFX.ui.pickupKey]: url('/assets/sounds/ui/pickup_key.wav'),
  [SFX.ui.pickupMedkit]: url('/assets/sounds/ui/pickup_medkit.wav'),

  // --- Weapons ---
  [SFX.weapons.pipe.swing]: url('/assets/sounds/weapons/pipe/pipe_swing.wav'),
  [SFX.weapons.pipe.hitWall]: url('/assets/sounds/weapons/pipe/pipe_hit_wall.wav'),
  [SFX.weapons.pipe.hitFlesh]: url('/assets/sounds/weapons/pipe/pipe_hit_flesh.wav'),
  [SFX.weapons.pistol.fire]: url('/assets/sounds/weapons/pistol/pistol_fire.wav'),
  [SFX.weapons.pistol.empty]: url('/assets/sounds/weapons/pistol/pistol_empty.wav'),
  [SFX.weapons.pistol.reload]: url('/assets/sounds/weapons/pistol/pistol_reload.wav'),
  [SFX.weapons.shotgun.fire]: url('/assets/sounds/weapons/shotgun/shotgun_fire.wav'),
  [SFX.weapons.shotgun.reload]: url('/assets/sounds/weapons/shotgun/shotgun_reload.wav'),

  // --- Footsteps ---
  [SFX.footsteps.concrete]: url('/assets/sounds/footsteps/footstep_concrete_01.wav'),
  [SFX.footsteps.tile]: url('/assets/sounds/footsteps/footstep_tile_01.wav'),
  [SFX.footsteps.metal]: url('/assets/sounds/footsteps/footstep_metal_01.wav'),
  [SFX.footsteps.flesh]: url('/assets/sounds/footsteps/footstep_flesh_01.wav'),

  // --- Enemies ---
  [SFX.enemies.husk.idle]: url('/assets/sounds/enemies/husk/husk_idle.wav'),
  [SFX.enemies.husk.attack]: url('/assets/sounds/enemies/husk/husk_attack.wav'),
  [SFX.enemies.husk.death]: url('/assets/sounds/enemies/husk/husk_death.wav'),
  [SFX.enemies.orderly.idle]: url('/assets/sounds/enemies/orderly/orderly_idle.wav'),
  [SFX.enemies.orderly.alert]: url('/assets/sounds/enemies/orderly/orderly_alert.wav'),
  [SFX.enemies.orderly.attack]: url('/assets/sounds/enemies/orderly/orderly_attack.wav'),
  [SFX.enemies.orderly.hurt]: url('/assets/sounds/enemies/orderly/orderly_hurt.wav'),
  [SFX.enemies.orderly.death]: url('/assets/sounds/enemies/orderly/orderly_death.wav'),

  // --- Hallucinations ---
  [SFX.hallucinations.burst]: url('/assets/sounds/hallucinations/hallucination_burst.wav'),
  [SFX.hallucinations.whisperLoop]: url('/assets/sounds/hallucinations/whisper_loop.wav'),
  [SFX.hallucinations.vhsGlitch]: url('/assets/sounds/hallucinations/vhs_glitch.wav'),
  [SFX.hallucinations.insanityRing]: url('/assets/sounds/hallucinations/insanity_ring.wav'),
  [SFX.hallucinations.whiteFigure.idle]: url(
    '/assets/sounds/hallucinations/white_figure/white_figure_idle.wav',
  ),
  [SFX.hallucinations.whiteFigure.attack]: url(
    '/assets/sounds/hallucinations/white_figure/white_figure_attack.wav',
  ),
  [SFX.hallucinations.whiteFigure.death]: url(
    '/assets/sounds/hallucinations/white_figure/white_figure_death.wav',
  ),
  [SFX.hallucinations.whiteFigure.manifest]: url(
    '/assets/sounds/hallucinations/white_figure/white_figure_manifest.wav',
  ),

  // --- Bosses ---
  [SFX.bosses.chiefDoctor.intro]: url('/assets/sounds/bosses/chief_doctor/chief_doctor_intro.wav'),
  [SFX.bosses.chiefDoctor.attack]: url(
    '/assets/sounds/bosses/chief_doctor/chief_doctor_attack.wav',
  ),
  [SFX.bosses.chiefDoctor.death]: url('/assets/sounds/bosses/chief_doctor/chief_doctor_death.wav'),
  [SFX.bosses.heartHospital.ambient]: url('/assets/sounds/bosses/heart_hospital/heart_ambient.wav'),
  [SFX.bosses.heartHospital.attack]: url('/assets/sounds/bosses/heart_hospital/heart_attack.wav'),
  [SFX.bosses.heartHospital.death]: url('/assets/sounds/bosses/heart_hospital/heart_death.wav'),

  // --- Machinery ---
  [SFX.machinery.fluorescentBuzz]: url('/assets/sounds/machinery/fluorescent_buzz.wav'),
  [SFX.machinery.machineHum]: url('/assets/sounds/machinery/machine_hum.wav'),
  [SFX.machinery.pipeSteam]: url('/assets/sounds/machinery/pipe_steam.wav'),

  // --- Transitions ---
  [SFX.transitions.hospitalDoorOpen]: url('/assets/sounds/transitions/hospital_door_open.wav'),
  [SFX.transitions.hospitalDoorClose]: url('/assets/sounds/transitions/hospital_door_close.wav'),
  [SFX.transitions.industrialDoorOpen]: url('/assets/sounds/transitions/industrial_door_open.wav'),
  [SFX.transitions.fleshDoorOpen]: url('/assets/sounds/transitions/flesh_door_open.wav'),
  [SFX.transitions.predatorGrowl]: url('/assets/sounds/transitions/predator_growl.wav'),
  [SFX.transitions.predatorHunt]: url('/assets/sounds/transitions/predator_hunt.wav'),
  [SFX.transitions.predatorTransform]: url('/assets/sounds/transitions/predator_transform.wav'),

  // --- Player ---
  [SFX.player.breathCalm]: url('/assets/sounds/player/player_breath_calm.wav'),
  [SFX.player.breathStress]: url('/assets/sounds/player/player_breath_stress.wav'),
  [SFX.player.breathPanic]: url('/assets/sounds/player/player_breath_panic.wav'),
  [SFX.player.breathPredator]: url('/assets/sounds/player/player_breath_predator.wav'),
  [SFX.player.hurtLight]: url('/assets/sounds/player/player_hurt_light.wav'),
  [SFX.player.hurtMedium]: url('/assets/sounds/player/player_hurt_medium.wav'),
  [SFX.player.hurtHeavy]: url('/assets/sounds/player/player_hurt_heavy.wav'),

  // --- Ambient ---
  [SFX.ambient.distantScream]: url('/assets/sounds/ambient/distant_scream.wav'),
  [SFX.ambient.heartbeatWall]: url('/assets/sounds/ambient/heartbeat_wall.wav'),
};
