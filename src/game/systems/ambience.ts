import type { PerceptionState } from './world-state';
import { SFX } from '../audio/sfx-config';

/**
 * Atmospheric layer.
 *
 * Drives two long-running looping audio beds:
 *  - **Breath**  : one of the four player breathing loops, picked from the
 *                  current perception stage (`medicated` -> calm,
 *                  `withdrawal` -> stress, `infected`/`nightmare` -> panic,
 *                  `predator` -> predator).
 *  - **Ambient** : a low whisper / heartbeat / machine bed that mirrors the
 *                  same perception, layered under whatever music is playing.
 *
 * Both are smoothly switched: when the desired loop differs from the active
 * one we stop the previous and start the new (audio-manager handles the
 * underlying `<audio>` lifecycle).
 *
 * Plus distance-attenuated **machinery emitters** placed by levels through
 * `ambient_loop` entities. World-state filtering happens upstream in
 * `rayc.ts/reapplyEntities` (so a `flesh_door` machine can be gated by
 * `infected`).
 */

export type AmbientEmitterSubtype =
  | 'fluorescent_buzz'
  | 'machine_hum'
  | 'pipe_steam'
  | 'whisper_loop'
  | 'heartbeat_wall';

export type AmbientEmitterSpec = {
  id?: string;
  x: number;
  y: number;
  subtype?: AmbientEmitterSubtype | string;
  /** Falloff radius — sound is silent beyond this distance. */
  radius?: number;
  /** Max volume at zero distance. */
  volume?: number;
};

const EMITTER_SFX: Record<AmbientEmitterSubtype, string> = {
  fluorescent_buzz: SFX.machinery.fluorescentBuzz,
  machine_hum: SFX.machinery.machineHum,
  pipe_steam: SFX.machinery.pipeSteam,
  whisper_loop: SFX.hallucinations.whisperLoop,
  heartbeat_wall: SFX.ambient.heartbeatWall,
};

type Emitter = {
  id?: string;
  x: number;
  y: number;
  subtype: AmbientEmitterSubtype;
  radius: number;
  volume: number;
  /** Stable loop key used when starting/updating the looping SFX. */
  loopKey: string;
};

function pickBreathLoop(stages: ReadonlyArray<PerceptionState>): string {
  if (stages.includes('predator')) return SFX.player.breathPredator;
  if (stages.includes('nightmare') || stages.includes('infected')) return SFX.player.breathPanic;
  if (stages.includes('withdrawal')) return SFX.player.breathStress;
  return SFX.player.breathCalm;
}

function pickAmbientBed(stages: ReadonlyArray<PerceptionState>): string | null {
  if (stages.includes('predator')) return SFX.transitions.predatorHunt;
  if (stages.includes('nightmare')) return SFX.ambient.heartbeatWall;
  if (stages.includes('infected')) return SFX.ambient.distantScream;
  if (stages.includes('withdrawal')) return SFX.hallucinations.whisperLoop;
  return null; // medicated / clean: no ambient bed (let the music carry).
}

export function createAmbienceSystem({
  player,
  getPerceptionStages,
  playLoopingSfx,
  stopLoopingSfx,
  resolveSfxSrc,
}: {
  player: { x: number; y: number };
  getPerceptionStages: () => ReadonlyArray<PerceptionState>;
  playLoopingSfx: (key: string, volume?: number, srcOverride?: string) => void;
  stopLoopingSfx: (key: string) => void;
  resolveSfxSrc: (key: string) => string | undefined;
}) {
  let activeBreath: string | null = null;
  let activeBed: string | null = null;

  let emitters: Emitter[] = [];
  // Per-emitter loop key currently playing (for distance-based attenuation).
  // We give each emitter a unique loop key derived from its index so several
  // emitters of the same subtype can co-exist without fighting over one
  // <audio> element in the audio manager.
  let activeEmitterKeys: string[] = [];

  function setEmitters(next: AmbientEmitterSpec[]) {
    // Stop everything that was running.
    for (const k of activeEmitterKeys) stopLoopingSfx(k);
    activeEmitterKeys = [];

    emitters = Array.isArray(next)
      ? next
          .filter((e) => e && typeof e.x === 'number' && typeof e.y === 'number')
          .map((e, i) => {
            const subtypeRaw = e.subtype ?? 'machine_hum';
            const subtype = (
              (Object.keys(EMITTER_SFX) as AmbientEmitterSubtype[]).includes(
                subtypeRaw as AmbientEmitterSubtype,
              )
                ? subtypeRaw
                : 'machine_hum'
            ) as AmbientEmitterSubtype;
            return {
              id: e.id,
              x: e.x,
              y: e.y,
              subtype,
              radius: typeof e.radius === 'number' && e.radius > 0 ? e.radius : 6,
              volume: typeof e.volume === 'number' ? Math.max(0, Math.min(1, e.volume)) : 0.6,
              loopKey: `${EMITTER_SFX[subtype]}#${i}`,
            } as Emitter;
          })
      : [];
  }

  function onMapChanged() {
    for (const k of activeEmitterKeys) stopLoopingSfx(k);
    if (activeBreath) stopLoopingSfx(activeBreath);
    if (activeBed) stopLoopingSfx(activeBed);
    activeBreath = null;
    activeBed = null;
    activeEmitterKeys = [];
    emitters = [];
  }

  function tick(_dt: number) {
    const stages = getPerceptionStages();

    // --- Breath loop ---
    const wantBreath = pickBreathLoop(stages);
    if (wantBreath !== activeBreath) {
      if (activeBreath) stopLoopingSfx(activeBreath);
      playLoopingSfx(wantBreath, 0.45);
      activeBreath = wantBreath;
    }

    // --- Ambient bed ---
    const wantBed = pickAmbientBed(stages);
    if (wantBed !== activeBed) {
      if (activeBed) stopLoopingSfx(activeBed);
      if (wantBed) playLoopingSfx(wantBed, 0.35);
      activeBed = wantBed;
    }

    // --- Distance-attenuated emitters ---
    const stillActive = new Set<string>();
    for (const e of emitters) {
      const d = Math.hypot(player.x - e.x, player.y - e.y);
      if (d >= e.radius) {
        // Out of range: silence by stopping the looping element if active.
        // (We rely on the audio manager keying by string to dedupe.)
        if (activeEmitterKeys.includes(e.loopKey)) {
          stopLoopingSfx(e.loopKey);
        }
        continue;
      }
      const fall = 1 - d / e.radius;
      const vol = Math.max(0, Math.min(1, e.volume * fall));
      // Re-issue play call: the audio manager updates volume in-place
      // when the same key is already running. Override the src so multiple
      // emitters with the same subtype don't fight over a single channel.
      const src = resolveSfxSrc(EMITTER_SFX[e.subtype]);
      playLoopingSfx(e.loopKey, vol, src);
      stillActive.add(e.loopKey);
    }
    // Clean up emitters that fell out of range so re-entering retriggers play.
    activeEmitterKeys = Array.from(stillActive);
  }

  return {
    setEmitters,
    onMapChanged,
    tick,
  };
}

export type AmbienceSystem = ReturnType<typeof createAmbienceSystem>;
