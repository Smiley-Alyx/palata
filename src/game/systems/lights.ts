export type Light = {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  flicker: boolean;
};

export function createLightsSystem() {
  let timeSec = 0;
  let lights: Light[] = [];

  function setLights(next: Array<{ x: number; y: number; radius: number; intensity?: number; flicker?: boolean }>) {
    lights = Array.isArray(next)
      ? next
          .filter((l) => l && typeof l.x === 'number' && typeof l.y === 'number' && typeof l.radius === 'number')
          .map((l) => ({
            x: l.x,
            y: l.y,
            radius: Math.max(0.001, l.radius),
            intensity: typeof l.intensity === 'number' ? l.intensity : 1,
            flicker: !!l.flicker,
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
      let inten = l.intensity;
      if (l.flicker) {
        // Gentle pseudo-random flicker, stable per-light index.
        const phase = i * 13.37;
        const f = 0.72 + 0.28 * Math.sin(timeSec * 18 + phase) + 0.12 * Math.sin(timeSec * 7.3 + phase * 0.7);
        inten *= Math.max(0, f);
      }
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
