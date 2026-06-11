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
  colorInfluence: number;
  // Internal phase offset so simultaneous lights don't beat in lockstep.
  phase: number;
};

type LightSample = {
  light01: number;
  color: string | null;
  colorInfluence: number;
};

type IsLightBlockingAt = (xMap: number, yMap: number, offset: number) => boolean;

function parseHexColor(color: string | null): { r: number; g: number; b: number } | null {
  if (!color) return null;
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function normalizeMode(raw: unknown, flicker: boolean | undefined): LightMode {
  if (typeof raw === 'string') {
    if (
      raw === 'steady' ||
      raw === 'flicker' ||
      raw === 'emergency' ||
      raw === 'pulse' ||
      raw === 'organic'
    ) {
      return raw;
    }
  }
  return flicker ? 'flicker' : 'steady';
}

export function createLightsSystem({
  isLightBlockingAt,
}: {
  isLightBlockingAt?: IsLightBlockingAt;
} = {}) {
  let timeSec = 0;
  let lights: Light[] = [];
  const tileLightCache = new Map<string, LightSample>();

  function setLights(
    next: Array<{
      x: number;
      y: number;
      radius: number;
      intensity?: number;
      flicker?: boolean;
      mode?: string;
      color?: string;
      colorInfluence?: number;
    }>,
  ) {
    tileLightCache.clear();
    lights = Array.isArray(next)
      ? next
          .filter(
            (l) =>
              l &&
              typeof l.x === 'number' &&
              typeof l.y === 'number' &&
              typeof l.radius === 'number',
          )
          .map((l, i) => ({
            x: l.x,
            y: l.y,
            radius: Math.max(0.001, l.radius),
            intensity: typeof l.intensity === 'number' ? l.intensity : 1,
            mode: normalizeMode(l.mode, l.flicker),
            color: typeof l.color === 'string' ? l.color : null,
            colorInfluence:
              typeof l.colorInfluence === 'number' ? Math.max(0, Math.min(2, l.colorInfluence)) : 1,
            phase: i * 13.37,
          }))
      : [];
  }

  function onMapChanged() {
    lights = [];
    timeSec = 0;
    tileLightCache.clear();
  }

  function tick(dt: number) {
    const clamped = Math.max(0, dt);
    if (clamped <= 0) return;
    timeSec += clamped;
    tileLightCache.clear();
  }

  function modulate(mode: LightMode, phase: number): number {
    switch (mode) {
      case 'steady':
        return 1;
      case 'flicker': {
        // Broken fluorescent: mostly on, with rapid dropouts.
        const f =
          0.72 +
          0.28 * Math.sin(timeSec * 18 + phase) +
          0.12 * Math.sin(timeSec * 7.3 + phase * 0.7);
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

  function hasLineOfSight(fromX: number, fromY: number, toX: number, toY: number): boolean {
    if (typeof isLightBlockingAt !== 'function') return true;

    let xMap = Math.floor(fromX);
    let yMap = Math.floor(fromY);
    const targetXMap = Math.floor(toX);
    const targetYMap = Math.floor(toY);
    if (xMap === targetXMap && yMap === targetYMap) return true;

    const dx = toX - fromX;
    const dy = toY - fromY;
    const stepX = dx < 0 ? -1 : 1;
    const stepY = dy < 0 ? -1 : 1;
    const deltaDistX = Math.abs(dx) < 0.000001 ? Infinity : Math.abs(1 / dx);
    const deltaDistY = Math.abs(dy) < 0.000001 ? Infinity : Math.abs(1 / dy);
    let sideDistX = dx < 0 ? (fromX - xMap) * deltaDistX : (xMap + 1 - fromX) * deltaDistX;
    let sideDistY = dy < 0 ? (fromY - yMap) * deltaDistY : (yMap + 1 - fromY) * deltaDistY;

    for (let steps = 0; steps < 4096; steps++) {
      const isVerticalHit = sideDistX < sideDistY;
      const rayDist = isVerticalHit ? sideDistX : sideDistY;
      if (isVerticalHit) {
        xMap += stepX;
        sideDistX += deltaDistX;
      } else {
        yMap += stepY;
        sideDistY += deltaDistY;
      }

      if (xMap === targetXMap && yMap === targetYMap) return true;

      const hitX = fromX + rayDist * dx;
      const hitY = fromY + rayDist * dy;
      const offset = isVerticalHit ? ((hitY % 1) + 1) % 1 : ((hitX % 1) + 1) % 1;
      if (isLightBlockingAt(xMap, yMap, offset)) return false;
    }

    return false;
  }

  function computeLightSampleAt(x: number, y: number): LightSample {
    if (!lights.length) return { light01: 1, color: null, colorInfluence: 0 };

    let acc = 0;
    let colorWeight = 0;
    let red = 0;
    let green = 0;
    let blue = 0;
    for (let i = 0; i < lights.length; i++) {
      const l = lights[i];
      const dx = x - l.x;
      const dy = y - l.y;
      const distSq = dx * dx + dy * dy;
      const radiusSq = l.radius * l.radius;
      if (distSq > radiusSq) continue;
      if (!hasLineOfSight(l.x, l.y, x, y)) continue;

      const falloff = 1 - Math.sqrt(distSq) / l.radius;
      const inten = l.intensity * modulate(l.mode, l.phase);
      const contribution = inten * falloff * falloff;
      acc += contribution;
      const color = parseHexColor(l.color);
      if (color) {
        const coloredContribution = contribution * l.colorInfluence;
        colorWeight += coloredContribution;
        red += color.r * coloredContribution;
        green += color.g * coloredContribution;
        blue += color.b * coloredContribution;
      }
    }

    // Base ambient to avoid fully black walls.
    const ambient = 0.22;
    const normalized = 1 - Math.exp(-Math.max(0, acc) * 0.85);
    const out = ambient + normalized * (1 - ambient);
    let color: string | null = null;
    if (colorWeight > 0.001) {
      const r = Math.round(red / colorWeight);
      const g = Math.round(green / colorWeight);
      const b = Math.round(blue / colorWeight);
      if (Math.max(r, g, b) - Math.min(r, g, b) > 12) color = `rgb(${r}, ${g}, ${b})`;
    }
    return {
      light01: Math.max(0, Math.min(1, out)),
      color,
      colorInfluence: Math.max(0, Math.min(2, colorWeight / Math.max(0.001, acc))),
    };
  }

  function getTileLightCacheKey(x: number, y: number): string | null {
    const xMap = x - 0.5;
    const yMap = y - 0.5;
    if (!Number.isInteger(xMap) || !Number.isInteger(yMap)) return null;
    return `${xMap},${yMap}`;
  }

  function getLightSampleAt(x: number, y: number): LightSample {
    const key = getTileLightCacheKey(x, y);
    if (!key) return computeLightSampleAt(x, y);

    const cached = tileLightCache.get(key);
    if (cached !== undefined) return cached;

    const sample = computeLightSampleAt(x, y);
    tileLightCache.set(key, sample);
    return sample;
  }

  function getLightAt(x: number, y: number): number {
    return getLightSampleAt(x, y).light01;
  }

  function getLightColorAt(x: number, y: number): string | null {
    return getLightSampleAt(x, y).color;
  }

  function getLightColorInfluenceAt(x: number, y: number): number {
    return getLightSampleAt(x, y).colorInfluence;
  }

  return {
    setLights,
    onMapChanged,
    tick,
    getLightAt,
    getLightColorAt,
    getLightColorInfluenceAt,
  };
}
