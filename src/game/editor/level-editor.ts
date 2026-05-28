import { assetUrl } from '../content/content';

type LevelJson = Record<string, unknown> & {
  geometry?: unknown;
  rows?: unknown;
  spawn?: unknown;
};

type EditorTool = 'cell' | 'spawn';

type TileTool = {
  value: number;
  label: string;
  hint: string;
  key: string;
};

const TILE_TOOLS: TileTool[] = [
  { value: 0, label: '0 Empty', hint: 'Empty floor', key: 'Digit0' },
  { value: 1, label: '1 Wall', hint: 'Solid wall', key: 'Digit1' },
  { value: 3, label: '3 Window', hint: 'Window cell', key: 'Digit3' },
  { value: 6, label: '6 Door', hint: 'Door cell', key: 'Digit6' },
  { value: 7, label: '7 Exit', hint: 'Exit trigger cell', key: 'Digit7' },
];

const DEFAULT_LEVEL: LevelJson = {
  id: 'edited-level',
  name: 'Edited level',
  legend: {
    '0': 'empty',
    '1': 'wall',
    '3': 'window',
    '6': 'door',
    '7': 'exit',
  },
  spawn: { x: 1.5, y: 1.5, rot: 0 },
  rows: ['11111111', '10000001', '10000001', '10000001', '11111111'],
};

function normalizeLevelPath(levelFile: string | number) {
  const value = String(levelFile).trim();
  if (!value) throw new Error('Level file is required');
  if (/^\d+$/.test(value)) return `/assets/data/levels/level${value}.json`;
  if (/^level\d+$/.test(value)) return `/assets/data/levels/${value}.json`;
  if (value.endsWith('.json')) return value;
  return `/assets/data/levels/${value}.json`;
}

async function loadLevelJson(levelFile: string | number) {
  const path = normalizeLevelPath(levelFile);
  const res = await fetch(assetUrl(path));
  if (!res.ok) {
    throw new Error(`Failed to load level: ${path} (${res.status})`);
  }
  return { path, data: (await res.json()) as LevelJson };
}

function readRows(level: LevelJson) {
  const hasGeometry = Array.isArray(level.geometry);
  const raw = hasGeometry ? level.geometry : level.rows;
  const rows = Array.isArray(raw) && raw.every((row) => typeof row === 'string') ? raw : null;
  const sourceKey: 'geometry' | 'rows' = hasGeometry ? 'geometry' : 'rows';
  if (!rows || rows.length === 0) {
    return { sourceKey, rows: [...(DEFAULT_LEVEL.rows as string[])] };
  }

  const width = Math.max(1, ...rows.map((row) => row.length));
  return {
    sourceKey,
    rows: rows.map((row) => row.padEnd(width, '0').replace(/[^0-9]/g, '0')),
  };
}

function rowsToGrid(rows: string[]) {
  return rows.map((row) =>
    Array.from(row, (ch) => {
      const value = ch.charCodeAt(0) - 48;
      return value >= 0 && value <= 9 ? value : 0;
    }),
  );
}

function gridToRows(grid: number[][]) {
  return grid.map((row) =>
    row.map((value) => String(Math.max(0, Math.min(9, value | 0)))).join(''),
  );
}

function readSpawn(level: LevelJson) {
  if (!level.spawn || typeof level.spawn !== 'object') return { x: 1.5, y: 1.5, rot: 0 };
  const spawn = level.spawn as { x?: unknown; y?: unknown; rot?: unknown };
  return {
    x: typeof spawn.x === 'number' ? spawn.x : 1.5,
    y: typeof spawn.y === 'number' ? spawn.y : 1.5,
    rot: typeof spawn.rot === 'number' ? spawn.rot : 0,
  };
}

function makeButton(label: string, className = 'level-editor__button') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function filenameFromPath(path: string) {
  return path.split('/').pop() || 'level.json';
}

function showStatus(el: HTMLElement, message: string) {
  el.textContent = message;
  window.setTimeout(() => {
    if (el.textContent === message) el.textContent = '';
  }, 2400);
}

export async function openLevelEditor(levelFile: string | number) {
  const existing = document.getElementById('levelEditorRoot');
  if (existing) existing.remove();

  const { path, data } = await loadLevelJson(levelFile);
  const closeEditor = mountLevelEditor(path, data);

  return {
    path,
    close: closeEditor,
  };
}

export function openBlankLevelEditor() {
  const existing = document.getElementById('levelEditorRoot');
  if (existing) existing.remove();
  return mountLevelEditor('level.json', structuredClone(DEFAULT_LEVEL));
}

function mountLevelEditor(path: string, level: LevelJson) {
  const host = document.getElementById('canvas1') ?? document.body;
  const { sourceKey, rows } = readRows(level);
  const grid = rowsToGrid(rows);
  const spawn = readSpawn(level);
  let selectedTool: EditorTool = 'cell';
  let selectedValue = 1;
  let painting = false;

  const root = document.createElement('section');
  root.id = 'levelEditorRoot';
  root.className = 'level-editor';
  root.setAttribute('aria-label', 'Level editor');
  const controller = new AbortController();
  const closeEditor = () => {
    controller.abort();
    root.remove();
  };

  const header = document.createElement('header');
  header.className = 'level-editor__header';

  const title = document.createElement('div');
  title.className = 'level-editor__title';
  title.textContent = `Level editor: ${path}`;
  header.appendChild(title);

  const headerActions = document.createElement('div');
  headerActions.className = 'level-editor__actions';
  const status = document.createElement('span');
  status.className = 'level-editor__status';
  headerActions.appendChild(status);

  const copyButton = makeButton('Copy JSON');
  const downloadButton = makeButton('Download JSON');
  const closeButton = makeButton('Close');
  headerActions.append(copyButton, downloadButton, closeButton);
  header.appendChild(headerActions);

  const layout = document.createElement('div');
  layout.className = 'level-editor__layout';

  const sidebar = document.createElement('aside');
  sidebar.className = 'level-editor__sidebar';

  const toolsTitle = document.createElement('div');
  toolsTitle.className = 'level-editor__section-title';
  toolsTitle.textContent = 'Tools';
  sidebar.appendChild(toolsTitle);

  const toolList = document.createElement('div');
  toolList.className = 'level-editor__tools';
  sidebar.appendChild(toolList);

  const spawnButton = makeButton('S Spawn', 'level-editor__tool');
  spawnButton.title = 'Move player spawn';
  toolList.appendChild(spawnButton);

  const tileButtons = TILE_TOOLS.map((tool) => {
    const button = makeButton(tool.label, 'level-editor__tool');
    button.title = tool.hint;
    button.dataset.value = String(tool.value);
    toolList.appendChild(button);
    return { tool, button };
  });

  const info = document.createElement('dl');
  info.className = 'level-editor__info';
  sidebar.appendChild(info);

  const addInfo = (label: string, value: string) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    info.append(dt, dd);
    return dd;
  };

  const sizeInfo = addInfo('Size', `${grid[0]?.length ?? 0} x ${grid.length}`);
  const spawnInfo = addInfo('Spawn', '');
  const sourceInfo = addInfo('Source', sourceKey);
  sourceInfo.title = sourceKey === 'geometry' ? 'Editing geometry array' : 'Editing rows array';

  const hint = document.createElement('p');
  hint.className = 'level-editor__hint';
  hint.textContent =
    'Paint cells with the mouse. Use 0/1/3/6/7 and S shortcuts. Export writes a full level JSON.';
  sidebar.appendChild(hint);

  const stage = document.createElement('div');
  stage.className = 'level-editor__stage';
  const gridEl = document.createElement('div');
  gridEl.className = 'level-editor__grid';
  gridEl.style.setProperty('--level-editor-cols', String(grid[0]?.length ?? 1));
  stage.appendChild(gridEl);

  layout.append(sidebar, stage);
  root.append(header, layout);
  host.appendChild(root);

  const cells: HTMLElement[][] = [];

  const syncToolButtons = () => {
    spawnButton.classList.toggle('is-selected', selectedTool === 'spawn');
    for (const { tool, button } of tileButtons) {
      button.classList.toggle(
        'is-selected',
        selectedTool === 'cell' && tool.value === selectedValue,
      );
    }
  };

  const syncSpawnInfo = () => {
    spawnInfo.textContent = `${spawn.x.toFixed(1)}, ${spawn.y.toFixed(1)}, rot ${spawn.rot.toFixed(2)}`;
  };

  const cellTitle = (x: number, y: number) => `${x},${y}: ${grid[y][x]}`;

  const syncCell = (x: number, y: number) => {
    const cell = cells[y]?.[x];
    if (!cell) return;
    cell.dataset.value = String(grid[y][x]);
    cell.classList.toggle('has-spawn', Math.floor(spawn.x) === x && Math.floor(spawn.y) === y);
    cell.title = cellTitle(x, y);
  };

  const syncAllCells = () => {
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) syncCell(x, y);
    }
    syncSpawnInfo();
  };

  const applyAt = (x: number, y: number) => {
    if (!grid[y] || grid[y][x] === undefined) return;
    if (selectedTool === 'spawn') {
      const oldX = Math.floor(spawn.x);
      const oldY = Math.floor(spawn.y);
      spawn.x = x + 0.5;
      spawn.y = y + 0.5;
      syncCell(oldX, oldY);
      syncCell(x, y);
      syncSpawnInfo();
      return;
    }
    grid[y][x] = selectedValue;
    syncCell(x, y);
  };

  const serializeLevel = () => {
    const next = structuredClone(level) as LevelJson;
    next[sourceKey] = gridToRows(grid);
    next.spawn = {
      ...((next.spawn && typeof next.spawn === 'object' ? next.spawn : {}) as Record<
        string,
        unknown
      >),
      x: spawn.x,
      y: spawn.y,
      rot: spawn.rot,
    };
    return `${JSON.stringify(next, null, 2)}\n`;
  };

  for (let y = 0; y < grid.length; y++) {
    cells[y] = [];
    for (let x = 0; x < grid[y].length; x++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'level-editor__cell';
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      cell.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        painting = true;
        applyAt(x, y);
      });
      cell.addEventListener('pointerenter', () => {
        if (painting) applyAt(x, y);
      });
      cell.addEventListener('pointerup', () => {
        painting = false;
      });
      cell.addEventListener('pointercancel', () => {
        painting = false;
      });
      cells[y][x] = cell;
      gridEl.appendChild(cell);
    }
  }

  const selectTile = (value: number) => {
    selectedTool = 'cell';
    selectedValue = value;
    syncToolButtons();
  };

  spawnButton.addEventListener('click', () => {
    selectedTool = 'spawn';
    syncToolButtons();
  });

  for (const { tool, button } of tileButtons) {
    button.addEventListener('click', () => selectTile(tool.value));
  }

  closeButton.addEventListener('click', closeEditor, { signal: controller.signal });
  downloadButton.addEventListener('click', () => {
    downloadText(filenameFromPath(path), serializeLevel());
    showStatus(status, 'Downloaded');
  });
  copyButton.addEventListener('click', () => {
    void navigator.clipboard
      .writeText(serializeLevel())
      .then(() => showStatus(status, 'Copied'))
      .catch(() => showStatus(status, 'Clipboard unavailable'));
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (!root.isConnected) {
      window.removeEventListener('keydown', onKeyDown, true);
      return;
    }
    if (e.code === 'Escape') {
      e.preventDefault();
      closeEditor();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
      e.preventDefault();
      void navigator.clipboard
        .writeText(serializeLevel())
        .then(() => showStatus(status, 'Copied'))
        .catch(() => showStatus(status, 'Clipboard unavailable'));
      return;
    }
    if (e.code === 'KeyS') {
      e.preventDefault();
      selectedTool = 'spawn';
      syncToolButtons();
      return;
    }
    const found = TILE_TOOLS.find((tool) => tool.key === e.code || e.key === String(tool.value));
    if (found) {
      e.preventDefault();
      selectTile(found.value);
    }
  };

  window.addEventListener('keydown', onKeyDown, { capture: true, signal: controller.signal });
  window.addEventListener(
    'pointerup',
    () => {
      painting = false;
    },
    { capture: true, signal: controller.signal },
  );

  sizeInfo.textContent = `${grid[0]?.length ?? 0} x ${grid.length}`;
  syncToolButtons();
  syncAllCells();

  return closeEditor;
}
