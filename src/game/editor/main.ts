const editorRoot = document.getElementById('editorRoot');
if (!editorRoot) {
  throw new Error('Missing #editorRoot element');
}

function cellAtClient(clientX: number, clientY: number) {
  const rect = root.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  const cell = Math.max(6, Math.floor(Math.min(w / mapW, h / mapH)));
  const gridW = cell * mapW;
  const gridH = cell * mapH;
  const offsetX = Math.floor((w - gridW) / 2);
  const offsetY = Math.floor((h - gridH) / 2);

  const x = Math.floor((clientX - rect.left - offsetX) / cell);
  const y = Math.floor((clientY - rect.top - offsetY) / cell);
  if (x < 0 || y < 0 || x >= mapW || y >= mapH) return null;
  return { x, y };
}

function setGridFromRows(rows: string[]) {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  if (w <= 0 || h <= 0) return;

  const next = makeGrid(w, h, 0);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < Math.min(w, row.length); x++) {
      const digit = Number(row[x]);
      next[y][x] = Number.isFinite(digit) ? digit : 0;
    }
  }

  grid = next;
  mapW = w;
  mapH = h;
  setIntInput(mapWidthInput as HTMLElement | null, w);
  setIntInput(mapHeightInput as HTMLElement | null, h);
}

const root = editorRoot;

const canvas = document.createElement('canvas');
canvas.id = 'editorCanvas';
root.appendChild(canvas);

const ctx = canvas.getContext('2d');
if (!ctx) {
  throw new Error('Failed to get 2d context');
}

const ctx2d = ctx;
ctx2d.imageSmoothingEnabled = false;

const mapWidthInput = document.getElementById('mapWidthInput');
const mapHeightInput = document.getElementById('mapHeightInput');
const resizeMapBtn = document.getElementById('resizeMapBtn');
const loadLevel1Btn = document.getElementById('loadLevel1Btn');
const tileSelect = document.getElementById('tileSelect');
const clearMapBtn = document.getElementById('clearMapBtn');
const exportBtn = document.getElementById('exportBtn');
const downloadBtn = document.getElementById('downloadBtn');
const applyJsonBtn = document.getElementById('applyJsonBtn');
const playBtn = document.getElementById('playBtn');
const loadCustomFileInput = document.getElementById('loadCustomFileInput');
const exportOutput = document.getElementById('exportOutput');
const spawnReadout = document.getElementById('spawnReadout');
const backBtn = document.getElementById('backToGameBtn');

const CUSTOM_LEVEL_STORAGE_KEY = 'rayc.customLevel';

let legend: Record<number, string> = {
  0: 'empty',
  1: 'wall',
  6: 'door',
};

let colors: { ceiling: string; floor: string } = {
  ceiling: '#E3E3E1',
  floor: '#858585',
};

function updatePalette() {
  if (!(tileSelect instanceof HTMLSelectElement)) return;
  const prev = tileSelect.value;
  tileSelect.innerHTML = '';

  const keys = Object.keys(legend)
    .map((k) => Number(k))
    .filter((k) => Number.isFinite(k))
    .sort((a, b) => a - b);

  for (const k of keys) {
    const opt = document.createElement('option');
    opt.value = String(k);
    opt.textContent = `${k} — ${legend[k] ?? ''}`;
    tileSelect.appendChild(opt);
  }

  if (keys.length === 0) {
    const opt = document.createElement('option');
    opt.value = '0';
    opt.textContent = '0 — empty';
    tileSelect.appendChild(opt);
  }

  tileSelect.value = prev && tileSelect.querySelector(`option[value="${prev}"]`) ? prev : '1';
  if (!tileSelect.value) tileSelect.value = '0';
}

function readInt(el: HTMLElement | null, fallback: number) {
  if (!(el instanceof HTMLInputElement)) return fallback;
  const v = Number(el.value);
  return Number.isFinite(v) ? Math.floor(v) : fallback;
}

function readBrush() {
  if (!(tileSelect instanceof HTMLSelectElement)) return 1;
  const v = Number(tileSelect.value);
  return Number.isFinite(v) ? v : 1;
}

function setBrush(tile: number) {
  if (!(tileSelect instanceof HTMLSelectElement)) return;
  const value = String(tile);
  if (tileSelect.querySelector(`option[value="${value}"]`)) {
    tileSelect.value = value;
  }
}

function setIntInput(el: HTMLElement | null, value: number) {
  if (!(el instanceof HTMLInputElement)) return;
  el.value = String(value);
}

let mapW = readInt(mapWidthInput as HTMLElement | null, 32);
let mapH = readInt(mapHeightInput as HTMLElement | null, 24);

let spawn: { x: number; y: number; rot: number } = { x: 2.5, y: 2.5, rot: 0 };

function updateSpawnReadout() {
  if (!(spawnReadout instanceof HTMLElement)) return;
  spawnReadout.textContent = `Spawn: x=${spawn.x.toFixed(2)} y=${spawn.y.toFixed(2)} rot=${spawn.rot.toFixed(2)}`;
}

let grid: number[][] = [];

function makeGrid(w: number, h: number, fill = 0) {
  const g: number[][] = [];
  for (let y = 0; y < h; y++) {
    const row: number[] = [];
    for (let x = 0; x < w; x++) row.push(fill);
    g.push(row);
  }
  return g;
}

function resizeGrid(w: number, h: number) {
  const next = makeGrid(w, h, 0);
  for (let y = 0; y < Math.min(h, grid.length); y++) {
    for (let x = 0; x < Math.min(w, grid[y]?.length ?? 0); x++) {
      next[y][x] = grid[y][x];
    }
  }
  grid = next;
  mapW = w;
  mapH = h;
}

grid = makeGrid(mapW, mapH, 0);

function resizeCanvas() {
  const rect = root.getBoundingClientRect();
  const cssWidth = Math.max(1, Math.floor(rect.width));
  const cssHeight = Math.max(1, Math.floor(rect.height));
  const dpr = window.devicePixelRatio || 1;

  canvas.style.width = cssWidth + 'px';
  canvas.style.height = cssHeight + 'px';
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx2d.imageSmoothingEnabled = false;
}

function tileToColor(tile: number) {
  if (tile === 0) return '#0b0c10';
  const hue = (tile * 47) % 360;
  return `hsl(${hue} 45% 35%)`;
}

function draw() {
  const rect = root.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));

  ctx2d.clearRect(0, 0, w, h);

  const cell = Math.max(6, Math.floor(Math.min(w / mapW, h / mapH)));
  const gridW = cell * mapW;
  const gridH = cell * mapH;
  const offsetX = Math.floor((w - gridW) / 2);
  const offsetY = Math.floor((h - gridH) / 2);

  ctx2d.fillStyle = '#000';
  ctx2d.fillRect(0, 0, w, h);

  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      ctx2d.fillStyle = tileToColor(grid[y][x]);
      ctx2d.fillRect(offsetX + x * cell, offsetY + y * cell, cell, cell);
    }
  }

  ctx2d.strokeStyle = 'rgba(243, 210, 122, 0.18)';
  ctx2d.lineWidth = 1;
  ctx2d.beginPath();
  for (let x = 0; x <= mapW; x++) {
    const px = offsetX + x * cell;
    ctx2d.moveTo(px, offsetY);
    ctx2d.lineTo(px, offsetY + gridH);
  }
  for (let y = 0; y <= mapH; y++) {
    const py = offsetY + y * cell;
    ctx2d.moveTo(offsetX, py);
    ctx2d.lineTo(offsetX + gridW, py);
  }
  ctx2d.stroke();

  const spawnX = offsetX + (spawn.x - 0.5) * cell;
  const spawnY = offsetY + (spawn.y - 0.5) * cell;
  ctx2d.fillStyle = '#f3d27a';
  ctx2d.beginPath();
  ctx2d.arc(spawnX + cell / 2, spawnY + cell / 2, Math.max(3, cell * 0.18), 0, Math.PI * 2);
  ctx2d.fill();
}

let painting = false;
let paintTile: number | null = null;

function paintAtClient(clientX: number, clientY: number) {
  const rect = root.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  const cell = Math.max(6, Math.floor(Math.min(w / mapW, h / mapH)));
  const gridW = cell * mapW;
  const gridH = cell * mapH;
  const offsetX = Math.floor((w - gridW) / 2);
  const offsetY = Math.floor((h - gridH) / 2);

  const x = Math.floor((clientX - rect.left - offsetX) / cell);
  const y = Math.floor((clientY - rect.top - offsetY) / cell);
  if (x < 0 || y < 0 || x >= mapW || y >= mapH) return;

  grid[y][x] = readBrush();
}

canvas.addEventListener('pointerdown', (e: PointerEvent) => {
  if (e.shiftKey) {
    const cell = cellAtClient(e.clientX, e.clientY);
    if (cell) {
      spawn = { x: cell.x + 0.5, y: cell.y + 0.5, rot: 0 };
      updateSpawnReadout();
    }
    painting = false;
    return;
  }

  if (e.altKey) {
    const cell = cellAtClient(e.clientX, e.clientY);
    if (cell) {
      const tile = grid[cell.y]?.[cell.x] ?? 0;
      setBrush(tile);
    }
    painting = false;
    return;
  }

  painting = true;
  paintTile = e.button === 2 ? 0 : readBrush();
  canvas.setPointerCapture(e.pointerId);
  const cell = cellAtClient(e.clientX, e.clientY);
  if (cell) {
    grid[cell.y][cell.x] = paintTile;
  }
});

canvas.addEventListener('pointermove', (e: PointerEvent) => {
  if (!painting) return;
  const cell = cellAtClient(e.clientX, e.clientY);
  if (!cell) return;
  if (paintTile === null) return;
  grid[cell.y][cell.x] = paintTile;
});

canvas.addEventListener('pointerup', () => {
  painting = false;
  paintTile = null;
});

canvas.addEventListener('pointercancel', () => {
  painting = false;
  paintTile = null;
});

canvas.addEventListener('contextmenu', (e: MouseEvent) => {
  e.preventDefault();
});

if (resizeMapBtn instanceof HTMLButtonElement) {
  resizeMapBtn.addEventListener('click', () => {
    const w = Math.max(4, Math.min(128, readInt(mapWidthInput as HTMLElement | null, mapW)));
    const h = Math.max(4, Math.min(128, readInt(mapHeightInput as HTMLElement | null, mapH)));
    resizeGrid(w, h);
  });
}

type LevelJson = {
  id?: string;
  rows: string[];
  legend?: Record<string, string>;
  spawn?: { x: number; y: number; rot: number };
  colors?: { ceiling?: string; floor?: string };
};

function isLevelJson(value: unknown): value is LevelJson {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { rows?: unknown };
  return Array.isArray(v.rows) && v.rows.every((r) => typeof r === 'string');
}

function applyLevelJson(level: LevelJson) {
  if (level.legend) {
    const nextLegend: Record<number, string> = {};
    for (const [k, v] of Object.entries(level.legend)) {
      const n = Number(k);
      if (Number.isFinite(n) && typeof v === 'string') nextLegend[n] = v;
    }
    legend = nextLegend;
    updatePalette();
  }

  if (level.spawn) {
    spawn = level.spawn;
    updateSpawnReadout();
  }

  if (level.colors && typeof level.colors === 'object') {
    colors = {
      ceiling: typeof level.colors.ceiling === 'string' ? level.colors.ceiling : colors.ceiling,
      floor: typeof level.colors.floor === 'string' ? level.colors.floor : colors.floor,
    };
  }

  setGridFromRows(level.rows);
}

function isCustomLevelJson(level: LevelJson) {
  return (level.id ?? 'custom') === 'custom';
}

async function loadLevelJson(path: string): Promise<LevelJson> {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  const url = path.startsWith('/') ? new URL(path.slice(1), base).toString() : new URL(path, base).toString();
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to load level: ' + path);
  }
  return (await res.json()) as LevelJson;
}

if (loadLevel1Btn instanceof HTMLButtonElement) {
  loadLevel1Btn.addEventListener('click', () => {
    void (async () => {
      const level = await loadLevelJson('/assets/data/levels/level0.json');
      applyLevelJson(level);
    })();
  });
}

if (clearMapBtn instanceof HTMLButtonElement) {
  clearMapBtn.addEventListener('click', () => {
    grid = makeGrid(mapW, mapH, 0);
  });
}

function exportLevelJson() {
  const rows = grid.map((row) => row.map((v) => String(v)).join(''));
  const levelJson = {
    id: 'custom',
    name: 'Custom',
    legend,
    colors,
    audio: {
      music: null,
    },
    spawn,
    rows,
  };
  return JSON.stringify(levelJson, null, 2);
}

if (exportBtn instanceof HTMLButtonElement) {
  exportBtn.addEventListener('click', () => {
    if (exportOutput instanceof HTMLTextAreaElement) {
      exportOutput.value = exportLevelJson();
      exportOutput.focus();
      exportOutput.select();
    }
  });
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

if (downloadBtn instanceof HTMLButtonElement) {
  downloadBtn.addEventListener('click', () => {
    const json = exportLevelJson();
    if (exportOutput instanceof HTMLTextAreaElement) {
      exportOutput.value = json;
    }
    downloadTextFile('custom-level.json', json);
  });
}

if (applyJsonBtn instanceof HTMLButtonElement) {
  applyJsonBtn.addEventListener('click', () => {
    if (!(exportOutput instanceof HTMLTextAreaElement)) return;
    try {
      const raw = exportOutput.value.trim();
      if (!raw) {
        alert('Textarea is empty. Click "Export JSON" first or paste level JSON, then click "Apply JSON".');
        return;
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!isLevelJson(parsed)) {
        throw new Error('Invalid JSON: expected { rows: string[] }');
      }

      if (!isCustomLevelJson(parsed)) {
        throw new Error('Only custom levels can be loaded/applied. Expected id: "custom"');
      }

      applyLevelJson(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert('Apply JSON failed: ' + msg);
    }
  });
}

async function readTextFile(file: File): Promise<string> {
  return await file.text();
}

if (loadCustomFileInput instanceof HTMLInputElement) {
  loadCustomFileInput.addEventListener('change', () => {
    const file = loadCustomFileInput.files?.[0];
    if (!file) return;
    void (async () => {
      try {
        const raw = (await readTextFile(file)).trim();
        const parsed = JSON.parse(raw) as unknown;
        if (!isLevelJson(parsed)) {
          throw new Error('Invalid JSON file: expected { rows: string[] }');
        }
        if (!isCustomLevelJson(parsed)) {
          throw new Error('Only custom levels can be loaded from file. Expected id: "custom"');
        }
        applyLevelJson(parsed);
        if (exportOutput instanceof HTMLTextAreaElement) {
          exportOutput.value = JSON.stringify(parsed, null, 2);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        alert('Load file failed: ' + msg);
      } finally {
        loadCustomFileInput.value = '';
      }
    })();
  });
}

if (playBtn instanceof HTMLButtonElement) {
  playBtn.addEventListener('click', () => {
    const json = exportLevelJson();
    localStorage.setItem(CUSTOM_LEVEL_STORAGE_KEY, json);
    const base = new URL(import.meta.env.BASE_URL, window.location.origin);
    window.location.href = new URL('?play=custom', base).toString();
  });
}

if (backBtn instanceof HTMLButtonElement) {
  backBtn.addEventListener('click', () => {
    window.location.href = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
  });
}

resizeCanvas();
updatePalette();
updateSpawnReadout();
window.addEventListener('resize', () => {
  resizeCanvas();
});

function loop() {
  draw();
  requestAnimationFrame(loop);
}

loop();
