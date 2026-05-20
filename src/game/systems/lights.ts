// Light mode dictates the temporal behaviour applied to a light source.
// Visual narrative intent (see narrative.txt §4, §11):
//   - steady:    stable industrial/medical lighting (default).
//   - flicker:   broken fluorescent buzz, classic horror beat.
//   - emergency: red alert; slow, hard square pulse.
//   - pulse:     smooth organic breathing (lab / heart / chrysalis zones).
//   - organic:   wet biological throb with shimmer (flesh chambers, finale).
export type LightMode = 'steady' | 'flicker' | 'emergency' | 'pulse' | 'organic';

export type Light = {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  mode: LightMode;
  color: string | null;
  // Internal phase offset so simultaneous lights don't beat in lockstep.
  phase: number;
};

function normalizeMode(raw: unknown, flicker: boolean | undefined): LightMode {
  if (typeof raw === 'string') {
    if (raw === 'steady' || raw === 'flicker' || raw === 'emergency' || raw === 'pulse' || raw === 'organic') {
      return raw;
    }
  }
  return flicker ? 'flicker' : 'steady';
}

export function createLightsSystem() {
  let timeSec = 0;
  let lights: Light[] = [];

  function setLights(
    next: Array<{
      x: number;
      y: number;
      radius: number;
      intensity?: number;
      flicker?: boolean;
      mode?: string;
      color?: string;
    }>,
  ) {
    lights = Array.isArray(next)
      ? next
          .filter(
            (l) =>
              l && typeof l.x === 'number' && typeof l.y === 'number' && typeof l.radius === 'number',
          )
          .map((l, i) => ({
            x: l.x,
            y: l.y,
            radius: Math.max(0.001, l.radius),
            intensity: typeof l.intensity === 'number' ? l.intensity : 1,
            mode: normalizeMode(l.mode, l.flicker),
            color: typeof l.color === 'string' ? l.color : null,
            phase: i * 13.37,
          }))
      : [];
  }

  function onMapChanged() {
    lights = [];
    timeSec = 0;
  }

  function tick(dt: number) {
    timeSec += Math.max(0, dt);
  }

  function modulate(mode: LightMode, phase: number): number {
    switch (mode) {
      case 'steady':
        return 1;
      case 'flicker': {
        // Broken fluorescent: mostly on, with rapid dropouts.
        const f =
          0.72 + 0.28 * Math.sin(timeSec * 18 + phase) + 0.12 * Math.sin(timeSec * 7.3 + phase * 0.7);
        return Math.max(0, f);
      }
      case 'emergency': {
        // Square-ish slow pulse around 0.8 Hz, deep dip.
        const wave = Math.sin(timeSec * 5 + phase);
        const square = wave > 0 ? 1 : -1;
        return 0.45 + 0.55 * (0.5 + 0.5 * square);
      }
      case 'pulse': {
        // Smooth breathing ~0.5 Hz.
        const f = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(timeSec * 3.14 + phase));
        return f;
      }
      case 'organic': {
        // Wet biological throb: base low, intermittent surges.
        const base = 0.4 + 0.25 * Math.sin(timeSec * 1.7 + phase);
        const surge = 0.35 * Math.pow(Math.max(0, Math.sin(timeSec * 0.9 + phase * 0.3)), 3);
        const shimmer = 0.05 * Math.sin(timeSec * 12 + phase * 1.7);
        return Math.max(0, base + surge + shimmer);
      }
    }
  }

  function getLightAt(x: number, y: number): number {
    if (!lights.length) return 1;

    let acc = 0;
    for (let i = 0; i < lights.length; i++) {
      const l = lights[i];
      const dx = x - l.x;
      const dy = y - l.y;
      const d = Math.hypot(dx, dy);
      if (d > l.radius) continue;

      const falloff = 1 - d / l.radius;
      const inten = l.intensity * modulate(l.mode, l.phase);
      acc += inten * falloff * falloff;
    }

    // Base ambient to avoid fully black walls.
    const ambient = 0.22;
    const out = ambient + acc;
    return Math.max(0, Math.min(1, out));
  }

  return {
    setLights,
    onMapChanged,
    tick,
    getLightAt,
  };
}
