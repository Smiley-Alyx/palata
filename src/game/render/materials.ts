type AtlasSlice = { domId: string; tile: number };

const textureById = new Map<number, string | AtlasSlice>([
  [1, { domId: 'wallAtlas', tile: 0 }],
  [100, { domId: 'wallAtlas', tile: 0 }],
  [101, { domId: 'wallAtlas', tile: 1 }],
  [102, { domId: 'wallAtlas', tile: 2 }],
  [103, { domId: 'wallAtlas', tile: 3 }],
  [104, { domId: 'wallAtlas', tile: 4 }],
  [105, { domId: 'wallAtlas', tile: 5 }],
  [106, { domId: 'wallAtlas', tile: 6 }],
  [107, { domId: 'wallAtlas', tile: 7 }],
  [108, { domId: 'wallAtlas', tile: 8 }],
  [109, { domId: 'wallAtlas', tile: 9 }],
  [110, { domId: 'wallAtlas', tile: 10 }],
  [111, { domId: 'wallAtlas', tile: 11 }],
  [112, { domId: 'wallAtlas', tile: 12 }],
  [113, { domId: 'wallAtlas', tile: 13 }],
  [114, { domId: 'wallAtlas', tile: 14 }],
  [115, { domId: 'wallAtlas', tile: 15 }],
  [2, { domId: 'windowAtlas', tile: 0 }],
  [3, { domId: 'doorAtlas', tile: 0 }],
  [200, { domId: 'doorAtlas', tile: 0 }],
  [201, { domId: 'doorAtlas', tile: 1 }],
  [202, { domId: 'doorAtlas', tile: 2 }],
  [203, { domId: 'doorAtlas', tile: 3 }],
  [204, { domId: 'doorAtlas', tile: 4 }],
  [205, { domId: 'doorAtlas', tile: 5 }],
  [206, { domId: 'doorAtlas', tile: 6 }],
  [207, { domId: 'doorAtlas', tile: 7 }],
  [208, { domId: 'doorAtlas', tile: 8 }],
  [209, { domId: 'doorAtlas', tile: 9 }],
  [210, { domId: 'doorAtlas', tile: 10 }],
  [211, { domId: 'doorAtlas', tile: 11 }],
  [212, { domId: 'doorAtlas', tile: 12 }],
  [213, { domId: 'doorAtlas', tile: 13 }],
  [214, { domId: 'doorAtlas', tile: 14 }],
  [215, { domId: 'doorAtlas', tile: 15 }],
  [4, { domId: 'standAtlas', tile: 0 }],
  [300, { domId: 'standAtlas', tile: 0 }],
  [301, { domId: 'standAtlas', tile: 1 }],
  [302, { domId: 'standAtlas', tile: 2 }],
  [303, { domId: 'standAtlas', tile: 3 }],
  [304, { domId: 'standAtlas', tile: 4 }],
  [305, { domId: 'standAtlas', tile: 5 }],
  [306, { domId: 'standAtlas', tile: 6 }],
  [307, { domId: 'standAtlas', tile: 7 }],
  [308, { domId: 'standAtlas', tile: 8 }],
  [309, { domId: 'standAtlas', tile: 9 }],
  [310, { domId: 'standAtlas', tile: 10 }],
  [311, { domId: 'standAtlas', tile: 11 }],
  [312, { domId: 'standAtlas', tile: 12 }],
  [313, { domId: 'standAtlas', tile: 13 }],
  [314, { domId: 'standAtlas', tile: 14 }],
  [315, { domId: 'standAtlas', tile: 15 }],
  [10, 'enemy'],
  [11, 'zombie'],
  [12, 'health'],
  [13, 'goldKey'],
  [14, 'silverKey'],
  [15, 'bloodKey'],
]);

const materialToTextureId: Map<string, number> = new Map([
  ['wall', 1],
  ['window', 2],
  ['door', 3],
  ['stand', 4],
  ['enemy', 10],
  ['zombie', 11],
  ['health', 12],
  ['keyGold', 13],
  ['keySilver', 14],
  ['keyBlood', 15],
]);

const cache: Map<string, CanvasImageSource | null> = new Map();

function getDomTextureByNumericId(id: number): CanvasImageSource | null {
  const entry = textureById.get(id);
  if (!entry) return null;

  const key = typeof entry === 'string' ? entry : `${entry.domId}#${entry.tile}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  if (typeof entry === 'string') {
    const el = document.getElementById(entry);
    const img = el instanceof HTMLImageElement ? el : null;
    cache.set(key, img);
    return img;
  }

  const baseEl = document.getElementById(entry.domId);
  const baseImg = baseEl instanceof HTMLImageElement ? baseEl : null;
  if (!baseImg || baseImg.naturalWidth <= 0 || baseImg.naturalHeight <= 0) {
    cache.set(key, null);
    return null;
  }

  const cols = 4;
  const rows = 4;
  const tileW = Math.floor(baseImg.naturalWidth / cols);
  const tileH = Math.floor(baseImg.naturalHeight / rows);
  const tx = entry.tile % cols;
  const ty = Math.floor(entry.tile / cols);

  const canvas = document.createElement('canvas');
  canvas.width = tileW;
  canvas.height = tileH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    cache.set(key, null);
    return null;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(baseImg, tx * tileW, ty * tileH, tileW, tileH, 0, 0, tileW, tileH);

  cache.set(key, canvas);
  return canvas;
}

export function getTextureForMaterial(
  materialOrId: string | number,
): CanvasImageSource | null {
  if (typeof materialOrId === 'number') {
    return getDomTextureByNumericId(materialOrId);
  }

  if (typeof materialOrId === 'string') {
    const textureId = materialToTextureId.get(materialOrId);
    if (!textureId) return null;
    return getDomTextureByNumericId(textureId);
  }

  return null;
}
