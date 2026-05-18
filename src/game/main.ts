import '../canvas-init';
import {
  disposeRayc,
  getAudioState,
  getPlayer,
  getKeys,
  getInventorySnapshot,
  getCurrentWeaponDef,
  getCurrentWeaponAmmo,
  getPerceptionStages,
  playMusic,
  resetKeys,
  setDifficulty,
  setAudioConfig,
  setBackgroundColors,
  setBackgroundMaterials,
  setDoorLocks,
  setEnemies,
  setHealthPickups,
  setKeyPickups,
  setLegend,
  setMap,
  setMaterialsWall,
  setLights,
  setEntities,
  setWorldStates,
  setMusicEnabled,
  setMusicVolume,
  setSfxEnabled,
  setSfxVolume,
  setSpawn,
  setTriggers,
  startRayc,
  stopRayc,
  type Difficulty,
  unlockAudio,
} from './rayc';
import { bindNoteOverlayControls } from './ui/note-overlay';
import { loadLevel, loadLevelsIndex } from './levels/level-loader';
import { DEFAULT_SFX } from './audio/sfx-config';

const CUSTOM_LEVEL_STORAGE_KEY = 'rayc.customLevel';

function getDefaultMusicForLevelId(levelId: string) {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  const m = /^level(\d+)$/.exec(levelId);
  const src = m ? `/assets/music/level_${m[1]}/level_${m[1]}.wav` : '/assets/music/menu/main.wav';
  return {
    src: new URL(src.startsWith('/') ? src.slice(1) : src, base).toString(),
    loop: true,
    volume: 0.5,
  };
}

function placeRandomHealthPickups({
  grid,
  player,
  difficulty,
}: {
  grid: number[][];
  player: ReturnType<typeof getPlayer>;
  difficulty: Difficulty;
}) {
  const visible = computeInitialVisibleCells({
    grid,
    x: player.x,
    y: player.y,
    rot: player.rot,
    fov: player.fov,
  });

  const w = grid[0]?.length ?? 0;
  const h = grid.length;

  const reachable = new Set<string>();
  const q: Array<{ x: number; y: number }> = [];
  const sx = Math.floor(player.x);
  const sy = Math.floor(player.y);
  if (sx >= 0 && sx < w && sy >= 0 && sy < h && grid[sy][sx] === 0) {
    q.push({ x: sx, y: sy });
    reachable.add(`${sx},${sy}`);
  }
  while (q.length) {
    const { x, y } = q.shift()!;
    const n = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ];
    for (const p of n) {
      if (p.x < 0 || p.x >= w || p.y < 0 || p.y >= h) continue;
      if (grid[p.y][p.x] !== 0) continue;
      const key = `${p.x},${p.y}`;
      if (reachable.has(key)) continue;
      reachable.add(key);
      q.push(p);
    }
  }

  let divisor = 120;
  let minCount = 3;
  let maxCount = 10;
  let minSpawnDist = 2.1;
  if (difficulty === 'trapped') {
    divisor = 150;
    minCount = 2;
    maxCount = 7;
    minSpawnDist = 2.35;
  }
  if (difficulty === 'consumed') {
    divisor = 200;
    minCount = 1;
    maxCount = 5;
    minSpawnDist = 2.55;
  }

  const approxCount = Math.floor((w * h) / divisor);
  const count = Math.max(minCount, Math.min(maxCount, approxCount));

  const result: Array<{ x: number; y: number }> = [];
  const used = new Set<string>();
  let placed = 0;
  let attempts = 0;

  while (placed < count && attempts < 5000) {
    attempts++;
    const x = 1 + Math.floor(Math.random() * Math.max(1, w - 2));
    const y = 1 + Math.floor(Math.random() * Math.max(1, h - 2));
    if (grid[y][x] !== 0) continue;
    const k = `${x},${y}`;
    if (!reachable.has(k)) continue;
    if (visible.has(k)) continue;
    if (used.has(k)) continue;
    const dist = Math.hypot(player.x - (x + 0.5), player.y - (y + 0.5));
    if (dist < minSpawnDist) continue;
    used.add(k);
    result.push({ x: x + 0.5, y: y + 0.5 });
    placed++;
  }

  return result;
}

function applyMenuAudio() {
  setAudioConfig({
    music: getDefaultMusicForLevelId('menu'),
    sfx: DEFAULT_SFX,
  });
  playMusic();
}

function cloneGrid(grid: number[][]) {
  return grid.map((row) => row.slice());
}

function initDeathUi() {
  const restartBtn = document.getElementById('deathRestartBtn');
  if (restartBtn instanceof HTMLButtonElement) {
    restartBtn.addEventListener('click', () => {
      // Simplest robust restart: reload page.
      window.location.href = '/';
      window.location.reload();
    });
  }
}

function computeInitialVisibleCells({
  grid,
  x,
  y,
  rot,
  fov,
}: {
  grid: number[][];
  x: number;
  y: number;
  rot: number;
  fov: number;
}) {
  const visible = new Set<string>();
  const rays = 64;
  const maxDist = 14;
  const step = 0.12;

  for (let i = 0; i < rays; i++) {
    const a = rot - fov / 2 + (i / (rays - 1)) * fov;
    for (let d = 0; d < maxDist; d += step) {
      const px = x + d * Math.cos(a);
      const py = y - d * Math.sin(a);
      const cx = Math.floor(px);
      const cy = Math.floor(py);
      if (cy < 0 || cy >= grid.length) break;
      if (cx < 0 || cx >= grid[0].length) break;
      visible.add(`${cx},${cy}`);
      if (grid[cy][cx] !== 0) break;
    }
  }

  return visible;
}

function placeRandomEnemies({
  grid,
  player,
  difficulty,
}: {
  grid: number[][];
  player: ReturnType<typeof getPlayer>;
  difficulty: Difficulty;
}) {
  const visible = computeInitialVisibleCells({
    grid,
    x: player.x,
    y: player.y,
    rot: player.rot,
    fov: player.fov,
  });

  const w = grid[0]?.length ?? 0;
  const h = grid.length;

  const reachable = new Set<string>();
  const q: Array<{ x: number; y: number }> = [];
  const sx = Math.floor(player.x);
  const sy = Math.floor(player.y);
  if (sx >= 0 && sx < w && sy >= 0 && sy < h && grid[sy][sx] === 0) {
    q.push({ x: sx, y: sy });
    reachable.add(`${sx},${sy}`);
  }
  while (q.length) {
    const { x, y } = q.shift()!;
    const n = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ];
    for (const p of n) {
      if (p.x < 0 || p.x >= w || p.y < 0 || p.y >= h) continue;
      if (grid[p.y][p.x] !== 0) continue;
      const key = `${p.x},${p.y}`;
      if (reachable.has(key)) continue;
      reachable.add(key);
      q.push(p);
    }
  }
  let divisor = 34;
  let minCount = 18;
  let maxCount = 46;
  let minSpawnDist = 2.55;

  if (difficulty === 'trapped') {
    divisor = 24;
    minCount = 28;
    maxCount = 70;
    minSpawnDist = 2.25;
  }
  if (difficulty === 'consumed') {
    divisor = 14;
    minCount = 70;
    maxCount = 180;
    minSpawnDist = 1.75;
  }

  const approxCount = Math.floor((w * h) / divisor);
  const count = Math.max(minCount, Math.min(maxCount, approxCount));
  let placed = 0;
  let attempts = 0;

  const orderlyW = difficulty === 'lost' ? 1 : difficulty === 'trapped' ? 2 : 4;
  const result: Array<{ x: number; y: number; kind: 'skeleton_husk' | 'medical_orderly' }> = [];

  while (placed < count && attempts < 5000) {
    attempts++;
    const x = 1 + Math.floor(Math.random() * Math.max(1, w - 2));
    const y = 1 + Math.floor(Math.random() * Math.max(1, h - 2));
    if (grid[y][x] !== 0) continue;
    if (!reachable.has(`${x},${y}`)) continue;
    if (visible.has(`${x},${y}`)) continue;
    const dist = Math.hypot(player.x - (x + 0.5), player.y - (y + 0.5));
    if (dist < minSpawnDist) continue;
    const total = 10 + orderlyW;
    const kind = Math.random() * total < orderlyW ? 'medical_orderly' : 'skeleton_husk';
    result.push({ x: x + 0.5, y: y + 0.5, kind });
    placed++;
  }

  return result;
}

function stripEnemyCellsFromGrid(grid: number[][], legend: Record<string, string>) {
  if (!grid.length || !grid[0]?.length) return;
  const enemyIds = new Set<number>();
  for (const [k, v] of Object.entries(legend)) {
    if (v === 'enemy' || v === 'skeleton_husk' || v === 'medical_orderly') {
      const id = Number(k);
      if (Number.isFinite(id)) enemyIds.add(id);
    }
  }
  if (!enemyIds.size) return;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (enemyIds.has(grid[y][x])) grid[y][x] = 0;
    }
  }
}

function initAudioUi() {
  const musicToggleBtn = document.getElementById('musicToggleBtn');
  const sfxToggleBtn = document.getElementById('sfxToggleBtn');
  const musicVolumeEl = document.getElementById('musicVolume');
  const sfxVolumeEl = document.getElementById('sfxVolume');

  if (!(musicToggleBtn instanceof HTMLButtonElement)) return;
  if (!(sfxToggleBtn instanceof HTMLButtonElement)) return;
  if (!(musicVolumeEl instanceof HTMLInputElement)) return;
  if (!(sfxVolumeEl instanceof HTMLInputElement)) return;

  const syncUi = () => {
    const state = getAudioState();
    musicToggleBtn.textContent = state.musicEnabled ? 'Music: on' : 'Music: off';
    sfxToggleBtn.textContent = state.sfxEnabled ? 'SFX: on' : 'SFX: off';
    musicVolumeEl.value = String(state.musicVolume);
    sfxVolumeEl.value = String(state.sfxVolume);
  };

  musicToggleBtn.addEventListener('click', () => {
    const state = getAudioState();
    setMusicEnabled(!state.musicEnabled);
    syncUi();
  });

  sfxToggleBtn.addEventListener('click', () => {
    const state = getAudioState();
    setSfxEnabled(!state.sfxEnabled);
    syncUi();
  });

  musicVolumeEl.addEventListener('input', () => {
    const v = Number(musicVolumeEl.value);
    if (!Number.isFinite(v)) return;
    setMusicVolume(v);
    syncUi();
  });

  sfxVolumeEl.addEventListener('input', () => {
    const v = Number(sfxVolumeEl.value);
    if (!Number.isFinite(v)) return;
    setSfxVolume(v);
    syncUi();
  });

  syncUi();
}

function initHpUi() {
  const hpEl = document.getElementById('hpText');
  const hudHpEl = document.getElementById('hudHealthValue');
  const hudAmmoEl = document.getElementById('hudAmmoValue');
  const hudWeaponEl = document.getElementById('hudWeaponValue');
  const hudArmorEl = document.getElementById('hudArmorValue');
  const hudMedsEl = document.getElementById('hudMedsValue');
  const hudDocsEl = document.getElementById('hudDocsValue');
  const perceptionOverlayEl = document.getElementById('perceptionOverlay');

  const keyGoldEl = document.getElementById('hudKeyGold');
  const keySilverEl = document.getElementById('hudKeySilver');
  const keyBloodEl = document.getElementById('hudKeyBlood');

  const hudCanvasEl = document.getElementById('hudPortrait');
  const hudCanvas = hudCanvasEl instanceof HTMLCanvasElement ? hudCanvasEl : null;
  const hudCtx = hudCanvas ? hudCanvas.getContext('2d') : null;

  const spriteEl = document.getElementById('playerSprite');
  const spriteImg = spriteEl instanceof HTMLImageElement ? spriteEl : null;

  if (!(hpEl instanceof HTMLElement) && !(hudHpEl instanceof HTMLElement)) return;
  const sidebarEl = hpEl instanceof HTMLElement ? hpEl : null;
  const hudEl = hudHpEl instanceof HTMLElement ? hudHpEl : null;
  const ammoEl = hudAmmoEl instanceof HTMLElement ? hudAmmoEl : null;
  const weaponEl = hudWeaponEl instanceof HTMLElement ? hudWeaponEl : null;
  const armorEl = hudArmorEl instanceof HTMLElement ? hudArmorEl : null;
  const medsEl = hudMedsEl instanceof HTMLElement ? hudMedsEl : null;
  const docsEl = hudDocsEl instanceof HTMLElement ? hudDocsEl : null;
  const overlayEl = perceptionOverlayEl instanceof HTMLElement ? perceptionOverlayEl : null;

  const syncKeys = () => {
    const ownedKeys = getKeys();
    if (keyGoldEl instanceof HTMLImageElement)
      keyGoldEl.classList.toggle('is-owned', ownedKeys.gold);
    if (keySilverEl instanceof HTMLImageElement)
      keySilverEl.classList.toggle('is-owned', ownedKeys.silver);
    if (keyBloodEl instanceof HTMLImageElement)
      keyBloodEl.classList.toggle('is-owned', ownedKeys.blood);
  };
  syncKeys();

  function renderPortrait(hpRatio: number) {
    if (!hudCtx || !hudCanvas) return;
    if (!spriteImg || spriteImg.naturalWidth <= 0 || spriteImg.naturalHeight <= 0) return;

    const frames = 4;
    const frameW = Math.floor(spriteImg.naturalWidth / frames);
    const frameH = spriteImg.naturalHeight;

    let idx = 0;
    if (hpRatio <= 0.25) idx = 3;
    else if (hpRatio <= 0.5) idx = 2;
    else if (hpRatio <= 0.75) idx = 1;
    else idx = 0;

    const sx = idx * frameW;
    const sy = 0;

    const dw = hudCanvas.width;
    const dh = hudCanvas.height;

    hudCtx.clearRect(0, 0, dw, dh);
    hudCtx.imageSmoothingEnabled = false;

    // Letterbox to avoid squishing the face.
    const srcAspect = frameW / frameH;
    const dstAspect = dw / dh;
    let drawW = dw;
    let drawH = dh;
    if (dstAspect > srcAspect) {
      drawW = Math.floor(dh * srcAspect);
      drawH = dh;
    } else {
      drawW = dw;
      drawH = Math.floor(dw / srcAspect);
    }
    const dx = Math.floor((dw - drawW) / 2);
    const dy = Math.floor((dh - drawH) / 2);
    hudCtx.drawImage(spriteImg, sx, sy, frameW, frameH, dx, dy, drawW, drawH);
  }

  function update() {
    const p = getPlayer();
    const hp = Math.max(0, Math.floor(p.hp));
    const maxHp = Math.max(1, Math.floor(p.maxHp));
    const text = `HP: ${hp}/${maxHp}`;
    const pct = Math.max(0, Math.min(999, Math.round((hp / maxHp) * 100)));

    if (sidebarEl) sidebarEl.textContent = text;
    if (hudEl) hudEl.textContent = `${pct}%`;

    if (weaponEl) weaponEl.textContent = getCurrentWeaponDef().label;
    if (ammoEl) {
      const ammo = getCurrentWeaponAmmo();
      ammoEl.textContent = ammo === null ? '--' : String(ammo);
    }
    if (armorEl) armorEl.textContent = '0%';
    const inv = getInventorySnapshot();
    if (medsEl) {
      medsEl.textContent = String(inv.haloperidol + inv.injector);
    }
    if (docsEl) {
      docsEl.textContent = String(inv.document);
    }
    if (overlayEl) {
      const stages = getPerceptionStages();
      const next = stages.includes('predator')
        ? 'predator'
        : stages.includes('nightmare')
          ? 'nightmare'
          : stages.includes('infected')
            ? 'infected'
            : stages.includes('withdrawal')
              ? 'withdrawal'
              : stages.includes('medicated')
                ? 'medicated'
                : 'clean';
      if (overlayEl.dataset.state !== next) overlayEl.dataset.state = next;
    }
    syncKeys();
    renderPortrait(hp / maxHp);
    requestAnimationFrame(update);
  }

  update();
}

window.addEventListener(
  'pointerdown',
  () => {
    unlockAudio();
    playMusic();
  },
  { once: true },
);

function hideMenu() {
  const el = document.getElementById('menuRoot');
  if (!(el instanceof HTMLElement)) return;
  el.style.display = 'none';
}

function showMenu() {
  const el = document.getElementById('menuRoot');
  if (!(el instanceof HTMLElement)) return;
  el.style.display = '';
  applyMenuAudio();
}

let running = false;
let dead = false;
let deathTimer: number | null = null;

function showBloodOverlay() {
  const el = document.getElementById('bloodOverlay');
  if (!(el instanceof HTMLElement)) return;
  el.style.display = '';
  // Force layout so transition triggers reliably.
  void el.offsetWidth;
  el.classList.add('is-active');
}

function hideBloodOverlay() {
  const el = document.getElementById('bloodOverlay');
  if (!(el instanceof HTMLElement)) return;
  el.classList.remove('is-active');
  el.style.display = 'none';
}

function showDeathScreen() {
  const el = document.getElementById('deathRoot');
  if (!(el instanceof HTMLElement)) return;
  el.style.display = '';
}

function hideDeathScreen() {
  const el = document.getElementById('deathRoot');
  if (!(el instanceof HTMLElement)) return;
  el.style.display = 'none';
}

function enterDeathState() {
  if (dead) return;
  dead = true;

  stopRayc();
  running = false;

  applyMenuAudio();

  showBloodOverlay();

  // Ensure strong red overlay (renderer already triggers it from engine event).
  if (deathTimer !== null) window.clearTimeout(deathTimer);
  deathTimer = window.setTimeout(() => {
    showDeathScreen();
  }, 2000);
}

async function startLevelById(levelId: string, difficulty: Difficulty) {
  unlockAudio();

  dead = false;
  if (deathTimer !== null) window.clearTimeout(deathTimer);
  hideDeathScreen();
  hideBloodOverlay();

  const levelsIndex = await loadLevelsIndex('/assets/data/levels/index.json');
  const levelEntry = levelsIndex.levels.find((l: { id: string; file: string }) => l.id === levelId);
  if (!levelEntry) {
    throw new Error('Level not found in levels index: ' + levelId);
  }

  const level = await loadLevel(levelEntry.file);
  stripEnemyCellsFromGrid(level.grid, level.legend);
  setLegend(level.legend);
  setMap(level.grid);
  setMaterialsWall(level.materialsWall ?? null);
  setSpawn(level.spawn);
  setBackgroundColors(level.colors);
  setBackgroundMaterials(level.backgroundMaterials ?? {});
  setWorldStates(level.worldStates ?? null);
  setTriggers(level.triggers ?? []);
  setLights(level.lights ?? []);

  resetKeys();

  const entities = level.entities ?? [];
  const hasEntities = Array.isArray(entities) && entities.length > 0;

  if (hasEntities) {
    setEntities(entities);
  } else {
    setKeyPickups(level.keyPickups ?? []);
    setDoorLocks(level.doorLocks ?? []);
  }

  const p = getPlayer();
  const hasEntityEnemySpawns =
    hasEntities &&
    entities.some((e) => e && typeof e === 'object' && (e as any).type === 'enemy_spawn');
  if (!hasEntityEnemySpawns) {
    setEnemies(placeRandomEnemies({ grid: level.grid, player: p, difficulty }));
  }
  setHealthPickups(placeRandomHealthPickups({ grid: level.grid, player: p, difficulty }));

  setAudioConfig({
    music: level.audio?.music ?? getDefaultMusicForLevelId(levelEntry.id),
    sfx: DEFAULT_SFX,
  });
  playMusic();

  hideMenu();
  startRayc();
  running = true;
}

type CustomLevelJson = {
  id?: string;
  legend: Record<string, string>;
  rows: string[];
  spawn: { x: number; y: number; rot: number };
  colors?: { ceiling?: string; floor?: string };
  audio?: { music?: Parameters<typeof setAudioConfig>[0]['music'] };
};

function parseCustomLevelJson(raw: string): CustomLevelJson {
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid custom level JSON');
  }
  const p = parsed as Partial<CustomLevelJson>;
  if ((p.id ?? 'custom') !== 'custom') {
    throw new Error('Custom level must have id="custom"');
  }
  if (!p.legend || typeof p.legend !== 'object') {
    throw new Error('Custom level must have legend');
  }
  if (!Array.isArray(p.rows) || !p.rows.every((r) => typeof r === 'string')) {
    throw new Error('Custom level must have rows: string[]');
  }
  if (
    !p.spawn ||
    typeof p.spawn.x !== 'number' ||
    typeof p.spawn.y !== 'number' ||
    typeof p.spawn.rot !== 'number'
  ) {
    throw new Error('Custom level must have spawn');
  }
  return p as CustomLevelJson;
}

async function maybeStartCustomFromEditor() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('play') !== 'custom') return;
  const raw = localStorage.getItem(CUSTOM_LEVEL_STORAGE_KEY);
  if (!raw) return;

  dead = false;
  if (deathTimer !== null) window.clearTimeout(deathTimer);
  hideDeathScreen();
  hideBloodOverlay();

  const level = parseCustomLevelJson(raw);

  const baseLegend = level.legend as unknown as Record<string, string>;
  setLegend(baseLegend as unknown as Record<number, string>);
  const grid = level.rows.map((row) => row.split('').map((c) => Number(c) || 0));
  stripEnemyCellsFromGrid(grid, baseLegend);
  setMap(grid);
  setSpawn(level.spawn);
  setBackgroundColors(level.colors ?? {});

  resetKeys();
  setKeyPickups([]);
  setDoorLocks([]);

  const p = getPlayer();
  setEnemies(placeRandomEnemies({ grid, player: p, difficulty: 'lost' }));
  setHealthPickups(placeRandomHealthPickups({ grid, player: p, difficulty: 'lost' }));

  setAudioConfig({
    music: level.audio?.music ?? getDefaultMusicForLevelId('custom'),
    sfx: DEFAULT_SFX,
  });
  playMusic();

  hideMenu();
  startRayc();
  running = true;
}

function initMenu() {
  showMenu();
  hideDeathScreen();

  const levelsRoot = document.getElementById('menuLevels');
  const difficultyRoot = document.getElementById('menuDifficulty');
  const editorBtn = document.getElementById('menuEditorBtn');

  let currentDifficulty: Difficulty = 'lost';

  if (difficultyRoot instanceof HTMLElement) {
    const opts: Array<{ id: Difficulty; label: string }> = [
      { id: 'lost', label: 'Lost — easy' },
      { id: 'trapped', label: 'Trapped — medium' },
      { id: 'consumed', label: 'Consumed — hard' },
    ];
    difficultyRoot.innerHTML = '';

    for (const o of opts) {
      const btn = document.createElement('button');
      btn.className = 'btn' + (o.id === currentDifficulty ? ' is-selected' : '');
      btn.type = 'button';
      btn.textContent = o.label;
      btn.addEventListener('click', () => {
        currentDifficulty = o.id;
        const all = difficultyRoot.querySelectorAll('button');
        for (const b of Array.from(all)) b.classList.remove('is-selected');
        btn.classList.add('is-selected');
      });
      difficultyRoot.appendChild(btn);
    }
  }

  if (levelsRoot instanceof HTMLElement) {
    void (async () => {
      try {
        const levelsIndex = await loadLevelsIndex('/assets/data/levels/index.json');
        levelsRoot.innerHTML = '';

        const visibleLevels = levelsIndex.levels.filter((l) => !l.hidden);
        for (const level of visibleLevels) {
          const btn = document.createElement('button');
          btn.className = 'btn';
          btn.type = 'button';
          btn.textContent = level.name ?? level.id;
          btn.addEventListener('click', () => {
            setDifficulty(currentDifficulty);
            void startLevelById(level.id, currentDifficulty);
          });
          levelsRoot.appendChild(btn);
        }
      } catch (err) {
        console.error('Failed to load levels index', err);
        levelsRoot.innerHTML = '';

        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.type = 'button';
        btn.textContent = 'Start';
        btn.addEventListener('click', () => {
          setDifficulty(currentDifficulty);
          void startLevelById('level1', currentDifficulty);
        });
        levelsRoot.appendChild(btn);
      }
    })();
  }

  if (editorBtn instanceof HTMLButtonElement) {
    editorBtn.addEventListener('click', () => {
      const base = new URL(import.meta.env.BASE_URL, window.location.origin);
      window.location.href = new URL('editor.html', base).toString();
    });
  }
}

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.code !== 'Escape' || e.repeat) return;
  if (!running) return;
  if (dead) return;
  stopRayc();
  showMenu();
  running = false;
});

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.code !== 'KeyH' || e.repeat) return;
  if (!running) return;
  const p = getPlayer();
  p.hp = Math.max(0, p.hp - 10);
});
initAudioUi();
initHpUi();
initDeathUi();
initMenu();
bindNoteOverlayControls();
void maybeStartCustomFromEditor();

// Watch HP and enter death state.
requestAnimationFrame(function watchDeath() {
  const p = getPlayer();
  if (!dead && running && p.hp <= 0) {
    enterDeathState();
  }
  requestAnimationFrame(watchDeath);
});
