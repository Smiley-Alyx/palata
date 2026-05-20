import { loadJson } from '../content/content';

export type AnimationDescriptor = {
  fps: number;
  loop: boolean;
  frames: Array<HTMLImageElement | HTMLCanvasElement>;
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

type SheetRect = { x: number; y: number; w: number; h: number };

function loadSheetImage(src: string): HTMLImageElement {
  return loadFrame(src);
}

// Carve a sheet into per-frame off-screen canvases. The canvas list is built
// up-front but each canvas is painted lazily once the source image decodes.
function sliceSheet(src: string, rects: SheetRect[]): HTMLCanvasElement[] {
  const img = loadSheetImage(src);
  const canvases: HTMLCanvasElement[] = rects.map((r) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.floor(r.w));
    c.height = Math.max(1, Math.floor(r.h));
    return c;
  });

  const paint = () => {
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      const c = canvases[i];
      const ctx = c.getContext('2d');
      if (!ctx) continue;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
    }
  };

  if (img.complete && img.naturalWidth > 0) {
    paint();
  } else {
    img.addEventListener('load', paint, { once: true });
  }

  return canvases;
}

// Mapping from in-world material id to its animation descriptor file under
// `public/assets/animations/`. Only materials with multi-frame anims need to
// be listed here; single-frame materials gain nothing from registration and
// are kept on the static-texture path.
const MATERIAL_TO_ANIMATION: Readonly<Record<string, string>> = Object.freeze({
  // Material id -> path under `public/assets/animations/`.
  flesh_eye: 'animations/enemies/flesh_eye.json',
  flesh_machine: 'animations/enemies/flesh_machine.json',

  // Door textures are 724x2172 sprite-sheets (3 stacked frames).
  // The runtime slices out only the top "closed" frame so the wall slice
  // doesn't get a 3-door stack stretched into it. Opening/closing is handled
  // by the raycaster (cell becomes ray-transparent at `open01 >= 0.98`).
  medical_door: 'animations/world/door_medical_door.json',
  blast_door: 'animations/world/door_blast_door.json',

  // Pickup sprites — 1536x1024 horizontal triptychs (idle / damaged / glitched).
  // Slice the idle frame, cropping the label band at the bottom of each cell.
  health: 'animations/pickups/aid_kit.json',
  haloperidol: 'animations/pickups/haloperidol.json',
  injector: 'animations/pickups/injector.json',
  goldKey: 'animations/pickups/gold_key.json',
  silverKey: 'animations/pickups/silver_key.json',
  bloodKey: 'animations/pickups/blood_key.json',
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
  const cleaned = jsonPath.replace(/^\/?(assets\/)?/, '');
  return loadJson<unknown>(`assets/${cleaned}`);
}

function parseDescriptor(data: unknown): AnimationDescriptor | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { fps?: unknown; loop?: unknown; frames?: unknown; sheet?: unknown };
  const fps = typeof d.fps === 'number' && d.fps > 0 ? d.fps : 8;
  const loop = typeof d.loop === 'boolean' ? d.loop : true;

  // Sheet form: `{ src, frames: [{x,y,w,h}, ...] }` — slices a single image
  // into per-frame canvases. Preferred for tightly packed sprite sheets where
  // frame regions are not uniform across rows.
  if (d.sheet && typeof d.sheet === 'object') {
    const s = d.sheet as { src?: unknown; frames?: unknown };
    if (typeof s.src === 'string' && Array.isArray(s.frames)) {
      const rects: SheetRect[] = [];
      for (const f of s.frames) {
        if (!f || typeof f !== 'object') continue;
        const fr = f as { x?: unknown; y?: unknown; w?: unknown; h?: unknown };
        if (
          typeof fr.x !== 'number' ||
          typeof fr.y !== 'number' ||
          typeof fr.w !== 'number' ||
          typeof fr.h !== 'number'
        )
          continue;
        rects.push({ x: fr.x, y: fr.y, w: fr.w, h: fr.h });
      }
      if (rects.length === 0) return null;
      return { fps, loop, frames: sliceSheet(s.src, rects) };
    }
  }

  // Multi-image form: `{ frames: [url1, url2, ...] }` — one file per frame.
  const framesArr = Array.isArray(d.frames) ? d.frames : [];
  const urls = framesArr.filter((f): f is string => typeof f === 'string');
  if (urls.length === 0) return null;
  return { fps, loop, frames: urls.map(loadFrame) };
}

export function tickAnimations(dt: number) {
  timeSec += Math.max(0, dt);
}

function isReady(frame: HTMLImageElement | HTMLCanvasElement): boolean {
  if (frame instanceof HTMLImageElement) return frame.naturalWidth > 0;
  // Canvas frames are valid as soon as they have non-zero size; the lazy
  // paint inside `sliceSheet` keeps them blank until the source image loads.
  return frame.width > 0 && frame.height > 0;
}

export function getAnimatedFrame(material: string): CanvasImageSource | null {
  const desc = animations.get(material);
  if (!desc || desc.frames.length === 0) return null;
  if (desc.frames.length === 1) {
    return isReady(desc.frames[0]) ? desc.frames[0] : null;
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
  const frame = desc.frames[idx];
  return isReady(frame) ? frame : null;
}

export function hasAnimation(material: string): boolean {
  return animations.has(material);
}
