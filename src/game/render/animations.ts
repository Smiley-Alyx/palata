export type AnimationDescriptor = {
  fps: number;
  loop: boolean;
  frames: HTMLImageElement[];
};

const animations = new Map<string, AnimationDescriptor>();
let timeSec = 0;

function resolveFrameUrl(src: string): string {
  const baseUrl =
    typeof window !== 'undefined' && typeof window.location !== 'undefined'
      ? new URL(import.meta.env.BASE_URL ?? '/', window.location.origin).toString()
      : '/';
  const cleaned = src.startsWith('/') ? src.slice(1) : src;
  // Frame URLs reference public assets relative to `assets/`.
  const withPrefix = cleaned.startsWith('assets/') ? cleaned : `assets/${cleaned}`;
  return new URL(withPrefix, baseUrl).toString();
}

function loadFrame(src: string): HTMLImageElement {
  const img = new Image();
  img.decoding = 'async';
  img.src = resolveFrameUrl(src);
  return img;
}

// Mapping from in-world material id to its animation descriptor file under
// `public/assets/animations/`. Only materials with multi-frame anims need to
// be listed here; single-frame materials gain nothing from registration and
// are kept on the static-texture path.
const MATERIAL_TO_ANIMATION: Readonly<Record<string, string>> = Object.freeze({
  // Add multi-frame descriptors here as art lands. Keys are material ids
  // used in entity/material lookups (see render/materials.ts).
  //
  // Example, once an actual sheet is authored:
  //   flesh_eye: 'animations/enemies/flesh_eye.json',
});

export async function loadAnimationRegistry(
  fetchJson: (url: string) => Promise<unknown> = defaultFetchJson,
): Promise<void> {
  const entries = Object.entries(MATERIAL_TO_ANIMATION);
  await Promise.all(
    entries.map(async ([material, jsonPath]) => {
      try {
        const data = await fetchJson(jsonPath);
        const desc = parseDescriptor(data);
        if (!desc) return;
        animations.set(material, desc);
      } catch (err) {
        console.warn('[animations] failed to load', material, jsonPath, err);
      }
    }),
  );
}

function defaultFetchJson(jsonPath: string): Promise<unknown> {
  const baseUrl = new URL(import.meta.env.BASE_URL ?? '/', window.location.origin).toString();
  const url = new URL(`assets/${jsonPath.replace(/^\/?(assets\/)?/, '')}`, baseUrl).toString();
  return fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  });
}

function parseDescriptor(data: unknown): AnimationDescriptor | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { fps?: unknown; loop?: unknown; frames?: unknown };
  const fps = typeof d.fps === 'number' && d.fps > 0 ? d.fps : 8;
  const loop = typeof d.loop === 'boolean' ? d.loop : true;
  const framesArr = Array.isArray(d.frames) ? d.frames : [];
  const urls = framesArr.filter((f): f is string => typeof f === 'string');
  if (urls.length === 0) return null;
  return { fps, loop, frames: urls.map(loadFrame) };
}

export function tickAnimations(dt: number) {
  timeSec += Math.max(0, dt);
}

export function getAnimatedFrame(material: string): HTMLImageElement | null {
  const desc = animations.get(material);
  if (!desc || desc.frames.length === 0) return null;
  if (desc.frames.length === 1) {
    return desc.frames[0].naturalWidth > 0 ? desc.frames[0] : null;
  }
  const frameDur = 1 / desc.fps;
  const totalDur = frameDur * desc.frames.length;
  let t = timeSec;
  if (desc.loop) {
    t = t % totalDur;
  } else if (t > totalDur) {
    t = totalDur - 0.0001;
  }
  let idx = Math.floor(t / frameDur);
  if (idx < 0) idx = 0;
  if (idx >= desc.frames.length) idx = desc.frames.length - 1;
  const img = desc.frames[idx];
  return img.naturalWidth > 0 ? img : null;
}

export function hasAnimation(material: string): boolean {
  return animations.has(material);
}
