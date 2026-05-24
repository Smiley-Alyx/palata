import type { PerceptionState } from './world-state';
import { SFX } from '../audio/sfx-config';

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
  radius?: number;
  volume?: number;
};

const EMITTER_SFX: Record<AmbientEmitterSubtype, string> = {
  fluorescent_buzz: SFX.machinery.fluorescentBuzz,
  machine_hum: SFX.machinery.machineHum,
  pipe_steam: SFX.machinery.pipeSteam,
  whisper_loop: SFX.hallucinations.nearby,
  heartbeat_wall: SFX.ambient.heartbeatWall,
};

type Emitter = {
  id?: string;
  x: number;
  y: number;
  subtype: AmbientEmitterSubtype;
  radius: number;
  volume: number;
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
  if (stages.includes('withdrawal')) return SFX.hallucinations.nearby;
  return null;
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
  let activeEmitterKeys: string[] = [];

  function setEmitters(next: AmbientEmitterSpec[]) {
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

    const wantBreath = pickBreathLoop(stages);
    if (wantBreath !== activeBreath) {
      if (activeBreath) stopLoopingSfx(activeBreath);
      playLoopingSfx(wantBreath, 0.45);
      activeBreath = wantBreath;
    }

    const wantBed = pickAmbientBed(stages);
    if (wantBed !== activeBed) {
      if (activeBed) stopLoopingSfx(activeBed);
      if (wantBed) playLoopingSfx(wantBed, 0.35);
      activeBed = wantBed;
    }

    const stillActive = new Set<string>();
    for (const e of emitters) {
      const d = Math.hypot(player.x - e.x, player.y - e.y);
      if (d >= e.radius) {
        if (activeEmitterKeys.includes(e.loopKey)) stopLoopingSfx(e.loopKey);
        continue;
      }
      const fall = 1 - d / e.radius;
      const vol = Math.max(0, Math.min(1, e.volume * fall));
      const src = resolveSfxSrc(EMITTER_SFX[e.subtype]);
      playLoopingSfx(e.loopKey, vol, src);
      stillActive.add(e.loopKey);
    }
    activeEmitterKeys = Array.from(stillActive);
  }

  return {
    setEmitters,
    onMapChanged,
    tick,
  };
}

export type AmbienceSystem = ReturnType<typeof createAmbienceSystem>;
