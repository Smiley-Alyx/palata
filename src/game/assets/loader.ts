import { ASSET_MANIFEST } from './manifest';

const images = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement>>();

function resolveUrl(src: string): string {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  return new URL(src.startsWith('/') ? src.slice(1) : src, base).toString();
}

export function startAssetPreload(): void {
  if (images.size) return;
  for (const id of Object.keys(ASSET_MANIFEST)) {
    const img = new Image();
    img.decoding = 'async';
    img.src = resolveUrl(ASSET_MANIFEST[id as keyof typeof ASSET_MANIFEST]);
    images.set(id, img);
    pending.set(
      id,
      new Promise<HTMLImageElement>((resolve) => {
        if (img.complete && img.naturalWidth > 0) {
          resolve(img);
          return;
        }
        img.addEventListener('load', () => resolve(img), { once: true });
        // Resolve on error too so a single missing texture doesn't block boot.
        img.addEventListener(
          'error',
          () => {
            console.warn('[assets] failed to load', id, img.src);
            resolve(img);
          },
          { once: true },
        );
      }),
    );
  }
}

export function getImage(id: string): HTMLImageElement | null {
  return images.get(id) ?? null;
}

export function getAssetUrl(id: string): string | null {
  const src = ASSET_MANIFEST[id as keyof typeof ASSET_MANIFEST];
  return src ? resolveUrl(src) : null;
}

export function whenAssetsReady(): Promise<void> {
  return Promise.all(Array.from(pending.values())).then(() => undefined);
}
