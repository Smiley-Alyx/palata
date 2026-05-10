export function assetUrl(path: string): string {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  const cleaned = String(path || '').replace(/^\/+/, '');
  return new URL(cleaned, base).toString();
}

export async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(assetUrl(path));
  if (!res.ok) {
    throw new Error(`Failed to load JSON: ${path} (${res.status})`);
  }
  return (await res.json()) as T;
}
