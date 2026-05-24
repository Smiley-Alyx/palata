import '../styles/main.styl';
import { initCanvas } from '../canvas-init';
import { mountAppDom } from './ui/dom';
import { startAssetPreload, getImage } from './assets/loader';
import { loadAnimationRegistry } from './render/animations';
import {
  disposeRayc,
  getAudioState,
  getPlayer,
  getKeys,
  getInventorySnapshot,
  getCurrentWeaponDef,
  getCurrentWeaponAmmo,
  getPerceptionStages,
  getNearestEnemyDistance,
  playMusic,
  resetKeys,
  resetPlayerState,
  setDifficulty,
  setAudioConfig,
  setBackgroundColors,
  setBackgroundMaterials,
  setControlBindings,
  setDoorLocks,
  setEnemies,
  setHealthPickups,
  setKeyPickups,
  setLegend,
  setLightingMultiplier,
  setMap,
  setMaterialsWall,
  setLights,
  setGeometryOverrides,
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
import { bindNoteOverlayControls, isNoteOverlayVisible } from './ui/note-overlay';
import { loadLevel, loadLevelsIndex } from './levels/level-loader';
import { DEFAULT_SFX } from './audio/sfx-config';
import { applyPlayerDamage } from './systems/player-stats';
import {
  CONTROL_ACTIONS,
  CREDITS,
  DEFAULT_CONTROL_BINDINGS,
  formatControlBinding,
  loadGameConfig,
  saveGameConfig,
  type ControlAction,
  type GameConfig,
} from './config';

function getDefaultMusicForLevelId(levelId: string) {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  const musicOverrides: Readonly<Record<string, string>> = {
    menu: '/assets/music/menu/main_chrevo.wav',
    level0: '/assets/music/menu/main_chrevo.wav',
    level1: '/assets/music/level_1/level_1_palata.wav',
    level2: '/assets/music/level_2/level_2_legacy.wav',
    level3: '/assets/music/level_3/level_3_legacy.wav',
    level4: '/assets/music/level_4/level_4_legacy.wav',
  };
  const m = /^level(\d+)$/.exec(levelId);
  const src =
    musicOverrides[levelId] ??
    (m ? `/assets/music/level_${m[1]}/level_${m[1]}.wav` : musicOverrides.menu);
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

  let divisor = 150;
  let minCount = 2;
  let maxCount = 8;
  let minSpawnDist = 2.35;
  if (difficulty === 'trapped') {
    divisor = 230;
    minCount = 1;
    maxCount = 4;
    minSpawnDist = 2.9;
  }
  if (difficulty === 'consumed') {
    divisor = 320;
    minCount = 0;
    maxCount = 3;
    minSpawnDist = 3.25;
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
      hideDeathScreen();
      hideBloodOverlay();
      dead = false;
      if (deathTimer !== null) {
        window.clearTimeout(deathTimer);
        deathTimer = null;
      }
      showMenu();
    });
  }

  const endingBtn = document.getElementById('endingContinueBtn');
  if (endingBtn instanceof HTMLButtonElement) {
    endingBtn.addEventListener('click', () => {
      hideEndingScreen();
      showMenu();
    });
  }

  window.addEventListener('rayc:ending', (e) => {
    const stage = (e as CustomEvent<{ stage?: string }>).detail?.stage;
    showEndingScreen(stage);
  });

  window.addEventListener('rayc:next-level', (e) => {
    const detail = (e as CustomEvent<{ levelId?: string; message?: string }>).detail;
    void transitionToNextLevel(detail?.levelId, detail?.message);
  });
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
  let divisor = 30;
  let minCount = 22;
  let maxCount = 54;
  let minSpawnDist = 2.35;

  if (difficulty === 'trapped') {
    divisor = 20;
    minCount = 36;
    maxCount = 88;
    minSpawnDist = 2.05;
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
  const lightingEl = document.getElementById('lightingLevel');
  const fpsToggleBtn = document.getElementById('fpsToggleBtn');

  if (!(musicToggleBtn instanceof HTMLButtonElement)) return;
  if (!(sfxToggleBtn instanceof HTMLButtonElement)) return;
  if (!(musicVolumeEl instanceof HTMLInputElement)) return;
  if (!(sfxVolumeEl instanceof HTMLInputElement)) return;
  if (!(lightingEl instanceof HTMLInputElement)) return;
  if (!(fpsToggleBtn instanceof HTMLButtonElement)) return;

  const syncUi = () => {
    const state = getAudioState();
    musicToggleBtn.textContent = state.musicEnabled ? 'Music: on' : 'Music: off';
    sfxToggleBtn.textContent = state.sfxEnabled ? 'SFX: on' : 'SFX: off';
    musicVolumeEl.value = String(state.musicVolume);
    sfxVolumeEl.value = String(state.sfxVolume);
    lightingEl.value = String(gameConfig.video.lighting);
    fpsToggleBtn.textContent = gameConfig.ui.showFps ? 'FPS: on' : 'FPS: off';
    syncFpsVisibility();
  };

  musicToggleBtn.addEventListener('click', () => {
    const state = getAudioState();
    setMusicEnabled(!state.musicEnabled);
    gameConfig.audio.musicEnabled = !state.musicEnabled;
    persistGameConfig();
    syncUi();
  });

  sfxToggleBtn.addEventListener('click', () => {
    const state = getAudioState();
    setSfxEnabled(!state.sfxEnabled);
    gameConfig.audio.sfxEnabled = !state.sfxEnabled;
    persistGameConfig();
    syncUi();
  });

  musicVolumeEl.addEventListener('input', () => {
    const v = Number(musicVolumeEl.value);
    if (!Number.isFinite(v)) return;
    setMusicVolume(v);
    gameConfig.audio.musicVolume = Math.max(0, Math.min(1, v));
    persistGameConfig();
    syncUi();
  });

  sfxVolumeEl.addEventListener('input', () => {
    const v = Number(sfxVolumeEl.value);
    if (!Number.isFinite(v)) return;
    setSfxVolume(v);
    gameConfig.audio.sfxVolume = Math.max(0, Math.min(1, v));
    persistGameConfig();
    syncUi();
  });

  lightingEl.addEventListener('input', () => {
    const v = Number(lightingEl.value);
    if (!Number.isFinite(v)) return;
    gameConfig.video.lighting = Math.max(0.7, Math.min(1.4, v));
    setLightingMultiplier(gameConfig.video.lighting);
    persistGameConfig();
    syncUi();
  });

  fpsToggleBtn.addEventListener('click', () => {
    gameConfig.ui.showFps = !gameConfig.ui.showFps;
    persistGameConfig();
    syncUi();
  });

  syncUi();
}

function initHpUi() {
  const fpsEl = document.getElementById('fpsText');
  const hudHpEl = document.getElementById('hudHealthValue');
  const hudAmmoEl = document.getElementById('hudAmmoValue');
  const hudWeaponEl = document.getElementById('hudWeaponValue');
  const hudArmorEl = document.getElementById('hudArmorValue');
  const hudMedsEl = document.getElementById('hudMedsValue');
  const hudDocsEl = document.getElementById('hudDocsValue');
  const hudArtifactsEl = document.getElementById('hudArtifactsValue');
  const perceptionOverlayEl = document.getElementById('perceptionOverlay');
  const vhsOverlayEl = document.getElementById('vhsOverlay');
  const bloodSenseEl = document.getElementById('bloodSenseOverlay');

  const keyGoldEl = document.getElementById('hudKeyGold');
  const keySilverEl = document.getElementById('hudKeySilver');
  const keyBloodEl = document.getElementById('hudKeyBlood');

  const hudCanvasEl = document.getElementById('hudPortrait');
  const hudCanvas = hudCanvasEl instanceof HTMLCanvasElement ? hudCanvasEl : null;
  const hudCtx = hudCanvas ? hudCanvas.getContext('2d') : null;

  const spriteImg = getImage('playerSprite');

  if (!(fpsEl instanceof HTMLElement) && !(hudHpEl instanceof HTMLElement)) return;
  const sidebarEl = fpsEl instanceof HTMLElement ? fpsEl : null;
  const hudEl = hudHpEl instanceof HTMLElement ? hudHpEl : null;
  const ammoEl = hudAmmoEl instanceof HTMLElement ? hudAmmoEl : null;
  const weaponEl = hudWeaponEl instanceof HTMLElement ? hudWeaponEl : null;
  const armorEl = hudArmorEl instanceof HTMLElement ? hudArmorEl : null;
  const medsEl = hudMedsEl instanceof HTMLElement ? hudMedsEl : null;
  const docsEl = hudDocsEl instanceof HTMLElement ? hudDocsEl : null;
  const artifactsEl = hudArtifactsEl instanceof HTMLElement ? hudArtifactsEl : null;
  const overlayEl = perceptionOverlayEl instanceof HTMLElement ? perceptionOverlayEl : null;
  const vhsEl = vhsOverlayEl instanceof HTMLElement ? vhsOverlayEl : null;
  const bloodEl = bloodSenseEl instanceof HTMLElement ? bloodSenseEl : null;

  const syncKeys = () => {
    const ownedKeys = getKeys();
    if (keyGoldEl instanceof HTMLElement)
      keyGoldEl.classList.toggle('is-owned', ownedKeys.gold);
    if (keySilverEl instanceof HTMLElement)
      keySilverEl.classList.toggle('is-owned', ownedKeys.silver);
    if (keyBloodEl instanceof HTMLElement)
      keyBloodEl.classList.toggle('is-owned', ownedKeys.blood);
  };
  syncKeys();

  function renderPortrait(hpRatio: number) {
    if (!hudCtx || !hudCanvas) return;
    if (!spriteImg || spriteImg.naturalWidth <= 0 || spriteImg.naturalHeight <= 0) return;

    const cols = 3;
    const rows = 5;
    const frameW = spriteImg.naturalWidth / cols;
    const frameH = spriteImg.naturalHeight / rows;

    let frame = 0;
    if (hpRatio <= 0) frame = 14;
    else if (hpRatio <= 0.25) frame = 5;
    else if (hpRatio <= 0.5) frame = 4;
    else if (hpRatio <= 0.75) frame = 3;

    const sx = (frame % cols) * frameW;
    const sy = Math.floor(frame / cols) * frameH;
    const faceH = frameH * 0.78;

    const dw = hudCanvas.width;
    const dh = hudCanvas.height;

    hudCtx.clearRect(0, 0, dw, dh);
    hudCtx.imageSmoothingEnabled = false;

    // Letterbox to avoid squishing the face.
    const srcAspect = frameW / faceH;
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
    hudCtx.drawImage(spriteImg, sx, sy, frameW, faceH, dx, dy, drawW, drawH);
  }

  let fpsFrames = 0;
  let fpsLastAt = performance.now();
  let fpsValue = 0;

  function update(now = performance.now()) {
    const p = getPlayer();
    const hp = Math.max(0, Math.floor(p.hp));
    const maxHp = Math.max(1, Math.floor(p.maxHp));
    const pct = Math.max(0, Math.min(999, Math.round((hp / maxHp) * 100)));
    const armor = Math.max(0, Math.floor(p.armor));
    const maxArmor = Math.max(1, Math.floor(p.maxArmor));
    const armorPct = Math.max(0, Math.min(999, Math.round((armor / maxArmor) * 100)));

    fpsFrames += 1;
    const fpsElapsed = now - fpsLastAt;
    if (fpsElapsed >= 500) {
      fpsValue = Math.round((fpsFrames * 1000) / fpsElapsed);
      fpsFrames = 0;
      fpsLastAt = now;
    }

    if (sidebarEl) sidebarEl.textContent = `FPS: ${fpsValue}`;
    if (hudEl) hudEl.textContent = `${pct}%`;

    if (weaponEl) weaponEl.textContent = getCurrentWeaponDef()?.label ?? '-';
    if (ammoEl) {
      const ammo = getCurrentWeaponAmmo();
      ammoEl.textContent = ammo === null ? '--' : String(ammo);
    }
    if (armorEl) armorEl.textContent = `${armorPct}%`;
    const inv = getInventorySnapshot();
    if (medsEl) {
      medsEl.textContent = String(inv.haloperidol + inv.injector);
    }
    if (docsEl) {
      docsEl.textContent = String(inv.document);
    }
    if (artifactsEl) {
      artifactsEl.textContent = String(inv.artifact);
    }
    if (overlayEl || vhsEl) {
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
      if (overlayEl && overlayEl.dataset.state !== next) overlayEl.dataset.state = next;
      if (vhsEl && vhsEl.dataset.state !== next) vhsEl.dataset.state = next;
      if (document.body.dataset.perception !== next) {
        document.body.dataset.perception = next;
      }

      if (bloodEl) {
        const isPredator = stages.includes('predator');
        if (!isPredator) {
          bloodEl.style.opacity = '0';
        } else {
          const d = getNearestEnemyDistance();
          // Blood sense: vignette intensifies as nearest enemy approaches.
          const senseRange = 8;
          const ratio = d === null ? 0 : Math.max(0, Math.min(1, 1 - d / senseRange));
          bloodEl.style.opacity = String(ratio * 0.8);
        }
      }
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
  menuMode = 'main';
  setHudVisible(false);
  el.style.display = '';
  showMenuPanel('menuMainPanel');
  applyMenuAudio();
}

function showPauseMenu() {
  const el = document.getElementById('menuRoot');
  if (!(el instanceof HTMLElement)) return;
  menuMode = 'pause';
  setHudVisible(true);
  el.style.display = '';
  showMenuPanel('menuPausePanel');
}

function getMenuRootPanelId() {
  return menuMode === 'pause' ? 'menuPausePanel' : 'menuMainPanel';
}

let running = false;
let paused = false;
let dead = false;
let deathTimer: number | null = null;
let transitioningLevel = false;
let currentLevelId: string | null = null;
const gameConfig: GameConfig = loadGameConfig();
let currentDifficulty: Difficulty = gameConfig.difficulty;
let menuMode: 'main' | 'pause' = 'main';
let hudVisible = false;

function persistGameConfig() {
  gameConfig.difficulty = currentDifficulty;
  saveGameConfig(gameConfig);
}

function syncFpsVisibility() {
  const fpsEl = document.getElementById('fpsText');
  if (!(fpsEl instanceof HTMLElement)) return;
  fpsEl.style.display = gameConfig.ui.showFps && hudVisible ? '' : 'none';
}

function setHudVisible(visible: boolean) {
  hudVisible = visible;
  const hudEl = document.getElementById('hudRoot');
  const frameEl = document.getElementById('frame');
  if (hudEl instanceof HTMLElement) hudEl.style.display = visible ? '' : 'none';
  if (frameEl instanceof HTMLElement) frameEl.classList.toggle('has-hud', visible);
  syncFpsVisibility();
}

function applyStoredConfig() {
  setMusicEnabled(gameConfig.audio.musicEnabled);
  setSfxEnabled(gameConfig.audio.sfxEnabled);
  setMusicVolume(gameConfig.audio.musicVolume);
  setSfxVolume(gameConfig.audio.sfxVolume);
  setLightingMultiplier(gameConfig.video.lighting);
  setControlBindings(gameConfig.controls);
  setDifficulty(currentDifficulty);
  syncFpsVisibility();
}

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

const DEATH_EPITAPHS: Record<string, string[]> = {
  clean: [
    'They will note the time of death in chalk\nand wash the floor before morning rounds.',
    'No one comes when the bell rings here.',
  ],
  medicated: [
    'The dose was correct. The patient was not.',
    'You drift below the ward, soft and quiet.',
  ],
  withdrawal: [
    'The pills wore off a corridor too late.',
    'Your hands shook. The ward did not.',
  ],
  infected: [
    'Something inside you finished first.',
    'The walls were never the wet thing.',
  ],
  nightmare: [
    'You woke up. You were still here.',
    'The dream kept your body for itself.',
  ],
  predator: [
    'The hunter became meat again.',
    'Even teeth grow tired in this place.',
  ],
};

function pickEpitaph(stage: string) {
  const list = DEATH_EPITAPHS[stage] ?? DEATH_EPITAPHS.clean;
  return list[Math.floor(Math.random() * list.length)];
}

function currentPerceptionStage(): string {
  const stages = getPerceptionStages();
  if (stages.includes('predator')) return 'predator';
  if (stages.includes('nightmare')) return 'nightmare';
  if (stages.includes('infected')) return 'infected';
  if (stages.includes('withdrawal')) return 'withdrawal';
  if (stages.includes('medicated')) return 'medicated';
  return 'clean';
}

function showDeathScreen() {
  const el = document.getElementById('deathRoot');
  if (!(el instanceof HTMLElement)) return;
  setHudVisible(false);
  const epitaphEl = document.getElementById('deathEpitaph');
  if (epitaphEl instanceof HTMLElement) {
    epitaphEl.textContent = pickEpitaph(currentPerceptionStage());
  }
  el.style.display = '';
}

function hideDeathScreen() {
  const el = document.getElementById('deathRoot');
  if (!(el instanceof HTMLElement)) return;
  el.style.display = 'none';
}

// Endings. Не дают однозначного ответа — каждый зависит от состояния восприятия
// игрока в момент финального триггера.
const ENDINGS: Record<string, { title: string; body: string; subtitle: string }> = {
  clean: {
    title: 'You walk out',
    body:
      'The exit was always there.\n' +
      'You stand under a dead grey sky and try to remember\n' +
      'who walked in.',
    subtitle: 'Nothing followed you. You think.',
  },
  medicated: {
    title: 'Discharge',
    body:
      'A nurse signs a form.\n' +
      'A doctor nods at a chart that does not have your name on it.\n' +
      'They tell you the treatment was a success.',
    subtitle: 'You believe them.',
  },
  withdrawal: {
    title: 'No more pills',
    body:
      'Your hands have stopped shaking.\n' +
      'The corridors stopped breathing as soon as you stopped looking.\n' +
      'Or you stopped looking as soon as they stopped breathing.',
    subtitle: 'You do not know which came first.',
  },
  infected: {
    title: 'Carrier',
    body:
      'Something is moving under your skin.\n' +
      'It is patient. It will introduce itself when the time is right.\n' +
      'You walk back out into the city with it.',
    subtitle: 'The city was always its first.',
  },
  nightmare: {
    title: 'There is no door',
    body:
      'The corridor loops once more and ends at the cell you started in.\n' +
      'You sit on the cot.\n' +
      'You wait for the door to open again.',
    subtitle: 'It will. It always does.',
  },
  predator: {
    title: 'New ward',
    body:
      'The complex is quiet.\n' +
      'You walk between rooms and decide which one to use next,\n' +
      'and which body to leave in it.',
    subtitle: 'The hunt has a new owner.',
  },
};

function showEndingScreen(stage?: string) {
  const root = document.getElementById('endingRoot');
  if (!(root instanceof HTMLElement)) return;
  const key = stage && stage in ENDINGS ? stage : currentPerceptionStage();
  const ending = ENDINGS[key] ?? ENDINGS.clean;
  setHudVisible(false);

  const titleEl = document.getElementById('endingTitle');
  const bodyEl = document.getElementById('endingBody');
  const subEl = document.getElementById('endingSubtitle');
  if (titleEl instanceof HTMLElement) titleEl.textContent = ending.title;
  if (bodyEl instanceof HTMLElement) bodyEl.textContent = ending.body;
  if (subEl instanceof HTMLElement) subEl.textContent = ending.subtitle;

  stopRayc();
  running = false;
  root.style.display = '';
}

function hideEndingScreen() {
  const el = document.getElementById('endingRoot');
  if (!(el instanceof HTMLElement)) return;
  el.style.display = 'none';
}

function showMenuPanel(panelId: string) {
  const panels = document.querySelectorAll<HTMLElement>('#menuRoot .menu-panel');
  for (const panel of Array.from(panels)) {
    panel.style.display = panel.id === panelId ? '' : 'none';
  }
}

function showLevelTransitionMessage(message?: string) {
  return new Promise<void>((resolve) => {
    const root = document.getElementById('levelTransitionRoot');
    if (!(root instanceof HTMLElement)) {
      resolve();
      return;
    }

    const bodyEl = document.getElementById('levelTransitionBody');
    if (bodyEl instanceof HTMLElement) {
      bodyEl.textContent = message || 'The lock gives way. The next ward opens.';
    }

    root.style.display = '';
    window.setTimeout(() => {
      root.style.display = 'none';
      resolve();
    }, 1500);
  });
}

const LOADING_SUBTITLES = [
  'Lights dim along the corridor',
  'The orderlies take their positions',
  'The walls remember you',
  'Stand by',
  'Inhale, hold, exhale',
];

function showLoadingScreen({ levelName, title }: { levelName: string; title?: string }) {
  return new Promise<void>((resolve) => {
    const root = document.getElementById('loadingRoot');
    const titleEl = document.getElementById('loadingTitle');
    const subEl = document.getElementById('loadingSubtitle');
    const fillEl = document.getElementById('loadingBarFill');
    if (!(root instanceof HTMLElement)) {
      resolve();
      return;
    }
    if (titleEl instanceof HTMLElement) titleEl.textContent = title ?? `Entering ${levelName}`;
    if (subEl instanceof HTMLElement) {
      subEl.textContent = LOADING_SUBTITLES[Math.floor(Math.random() * LOADING_SUBTITLES.length)];
    }
    if (fillEl instanceof HTMLElement) fillEl.style.width = '0%';
    root.style.display = '';

    const totalMs = 1400;
    const startedAt = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - startedAt) / totalMs);
      if (fillEl instanceof HTMLElement) fillEl.style.width = `${Math.round(t * 100)}%`;
      if (t >= 1) {
        root.style.display = 'none';
        resolve();
      } else {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });
}

function enterDeathState() {
  if (dead) return;
  dead = true;

  stopRayc();
  running = false;
  paused = false;
  setHudVisible(false);

  applyMenuAudio();

  showBloodOverlay();

  // Ensure strong red overlay (renderer already triggers it from engine event).
  if (deathTimer !== null) window.clearTimeout(deathTimer);
  deathTimer = window.setTimeout(() => {
    showDeathScreen();
  }, 2000);
}

async function findNextLevelId(levelId: string) {
  const levelsIndex = await loadLevelsIndex('/assets/data/levels/index.json');
  const currentIndex = levelsIndex.levels.findIndex((l) => l.id === levelId);
  if (currentIndex < 0) return null;

  for (let i = currentIndex + 1; i < levelsIndex.levels.length; i++) {
    const level = levelsIndex.levels[i];
    if (!level.hidden) return level.id;
  }

  return null;
}

async function transitionToNextLevel(levelId?: string, message?: string) {
  if (transitioningLevel) return;
  transitioningLevel = true;

  stopRayc();
  running = false;
  paused = false;
  setHudVisible(false);

  const nextLevelId = levelId ?? (currentLevelId ? await findNextLevelId(currentLevelId) : null);
  if (!nextLevelId) {
    transitioningLevel = false;
    showEndingScreen();
    return;
  }

  await showLevelTransitionMessage(message);
  await startLevelById(nextLevelId, currentDifficulty, { resetPlayer: false });
  transitioningLevel = false;
}

async function startLevelById(
  levelId: string,
  difficulty: Difficulty,
  opts: { resetPlayer?: boolean } = {},
) {
  unlockAudio();

  dead = false;
  paused = false;
  setHudVisible(false);
  if (deathTimer !== null) window.clearTimeout(deathTimer);
  hideDeathScreen();
  hideBloodOverlay();
  transitioningLevel = false;

  const levelsIndex = await loadLevelsIndex('/assets/data/levels/index.json');
  const levelEntry = levelsIndex.levels.find((l: { id: string; file: string }) => l.id === levelId);
  if (!levelEntry) {
    throw new Error('Level not found in levels index: ' + levelId);
  }

  hideMenu();
  const loadingDone = showLoadingScreen({ levelName: levelEntry.name ?? levelEntry.id });

  const level = await loadLevel(levelEntry.file);
  stripEnemyCellsFromGrid(level.grid, level.legend);
  setLegend(level.legend);
  setMap(level.grid);
  if (opts.resetPlayer !== false) resetPlayerState();
  setMaterialsWall(level.materialsWall ?? null);
  setSpawn(level.spawn);
  setBackgroundColors(level.colors);
  setBackgroundMaterials(level.backgroundMaterials ?? {});
  setWorldStates(level.worldStates ?? null);
  setTriggers(level.triggers ?? []);
  setLights(level.lights ?? []);
  setGeometryOverrides(level.geometryOverrides ?? []);

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

  await loadingDone;
  hideMenu();
  setHudVisible(true);
  startRayc();
  running = true;
  currentLevelId = levelEntry.id;
}

function pauseGame() {
  if (!running || dead || transitioningLevel) return;
  stopRayc();
  running = false;
  paused = true;
  showPauseMenu();
}

function resumeGame() {
  if (!paused || dead || transitioningLevel || !currentLevelId) return;
  hideMenu();
  playMusic();
  startRayc();
  running = true;
  paused = false;
}

function normalizeConsoleLevelId(level: string | number) {
  if (typeof level === 'number' && Number.isFinite(level)) return `level${Math.floor(level)}`;
  const value = String(level).trim();
  if (/^\d+$/.test(value)) return `level${value}`;
  return value;
}

async function listConsoleLevels() {
  const levelsIndex = await loadLevelsIndex('/assets/data/levels/index.json');
  return levelsIndex.levels.map((level) => ({
    id: level.id,
    name: level.name ?? level.id,
    hidden: Boolean(level.hidden),
  }));
}

async function switchLevelFromConsole(level: string | number) {
  const levelId = normalizeConsoleLevelId(level);
  const levelsIndex = await loadLevelsIndex('/assets/data/levels/index.json');
  const levelEntry = levelsIndex.levels.find((entry) => entry.id === levelId);
  if (!levelEntry) {
    throw new Error(`Unknown level: ${levelId}`);
  }
  setDifficulty(currentDifficulty);
  await startLevelById(levelEntry.id, currentDifficulty);
  return {
    id: levelEntry.id,
    name: levelEntry.name ?? levelEntry.id,
  };
}

function installConsoleCommands() {
  const api = {
    help() {
      return [
        'palata.level("level3") - load level by id',
        'palata.level(3) - load level by number',
        'palata.loadLevel("level3") - alias for palata.level',
        'palata.levels() - list available levels',
      ];
    },
    levels: listConsoleLevels,
    level: switchLevelFromConsole,
    loadLevel: switchLevelFromConsole,
  };

  (window as Window & { palata?: typeof api }).palata = api;
}

function initMenu() {
  setHudVisible(false);
  hideMenu();
  hideDeathScreen();
  hideEndingScreen();

  const newGameBtn = document.getElementById('menuNewGameBtn');
  const resumeBtn = document.getElementById('menuResumeBtn');
  const pauseSettingsBtn = document.getElementById('menuPauseSettingsBtn');
  const pauseMainBtn = document.getElementById('menuPauseMainBtn');
  const savesBtn = document.getElementById('menuSavesBtn');
  const settingsBtn = document.getElementById('menuSettingsBtn');
  const creditsBtn = document.getElementById('menuCreditsBtn');
  const startBtn = document.getElementById('menuStartBtn');
  const difficultyRoot = document.getElementById('menuDifficulty');
  const controlsRoot = document.getElementById('menuControls');
  const controlsResetBtn = document.getElementById('controlsResetBtn');
  const creditsRoot = document.getElementById('menuCredits');
  let listeningControl: ControlAction | null = null;
  let renderControls = () => {};

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
        persistGameConfig();
        const all = difficultyRoot.querySelectorAll('button');
        for (const b of Array.from(all)) b.classList.remove('is-selected');
        btn.classList.add('is-selected');
      });
      difficultyRoot.appendChild(btn);
    }
  }

  if (controlsRoot instanceof HTMLElement) {
    renderControls = () => {
      controlsRoot.innerHTML = '';
      for (const control of CONTROL_ACTIONS) {
        const item = document.createElement('li');
        item.className = 'control-bind-row';

        const label = document.createElement('span');
        label.className = 'control-bind-action';
        label.textContent = control.action;
        item.appendChild(label);

        const btn = document.createElement('button');
        btn.className = 'btn control-bind-btn';
        btn.type = 'button';
        btn.textContent =
          listeningControl === control.id
            ? 'Press key...'
            : gameConfig.controls[control.id].map(formatControlBinding).join(' / ');
        btn.addEventListener('click', () => {
          listeningControl = control.id;
          renderControls();
        });
        item.appendChild(btn);
        controlsRoot.appendChild(item);
      }
    };

    const applyControlBinding = (binding: string) => {
      if (!listeningControl) return;
      gameConfig.controls[listeningControl] = [binding];
      listeningControl = null;
      setControlBindings(gameConfig.controls);
      persistGameConfig();
      renderControls();
    };

    window.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (!listeningControl) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat) return;
        applyControlBinding(e.code);
      },
      true,
    );

    window.addEventListener(
      'mousedown',
      (e: MouseEvent) => {
        if (!listeningControl) return;
        e.preventDefault();
        e.stopPropagation();
        applyControlBinding(`Mouse${e.button}`);
      },
      true,
    );

    renderControls();
  }

  if (controlsResetBtn instanceof HTMLButtonElement) {
    controlsResetBtn.addEventListener('click', () => {
      gameConfig.controls = structuredClone(DEFAULT_CONTROL_BINDINGS);
      listeningControl = null;
      setControlBindings(gameConfig.controls);
      persistGameConfig();
      renderControls();
    });
  }

  if (creditsRoot instanceof HTMLElement) {
    creditsRoot.innerHTML = '';
    for (const line of CREDITS) {
      const item = document.createElement('li');
      item.textContent = line;
      creditsRoot.appendChild(item);
    }
  }

  if (newGameBtn instanceof HTMLButtonElement) {
    newGameBtn.addEventListener('click', () => showMenuPanel('menuNewGamePanel'));
  }
  if (resumeBtn instanceof HTMLButtonElement) {
    resumeBtn.addEventListener('click', () => resumeGame());
  }
  if (pauseSettingsBtn instanceof HTMLButtonElement) {
    pauseSettingsBtn.addEventListener('click', () => showMenuPanel('menuSettingsPanel'));
  }
  if (pauseMainBtn instanceof HTMLButtonElement) {
    pauseMainBtn.addEventListener('click', () => {
      paused = false;
      currentLevelId = null;
      showMenu();
    });
  }
  if (savesBtn instanceof HTMLButtonElement) {
    savesBtn.addEventListener('click', () => showMenuPanel('menuSavesPanel'));
  }
  if (settingsBtn instanceof HTMLButtonElement) {
    settingsBtn.addEventListener('click', () => showMenuPanel('menuSettingsPanel'));
  }
  if (creditsBtn instanceof HTMLButtonElement) {
    creditsBtn.addEventListener('click', () => showMenuPanel('menuCreditsPanel'));
  }

  for (const btn of Array.from(document.querySelectorAll<HTMLButtonElement>('.menu-back'))) {
    btn.addEventListener('click', () => {
      const target = btn.dataset.menuTarget || 'menuMainPanel';
      showMenuPanel(target === 'contextRoot' ? getMenuRootPanelId() : target);
    });
  }

  if (startBtn instanceof HTMLButtonElement) {
    startBtn.addEventListener('click', () => {
      void (async () => {
        try {
          const levelsIndex = await loadLevelsIndex('/assets/data/levels/index.json');
          setDifficulty(currentDifficulty);
          await startLevelById(levelsIndex.default, currentDifficulty);
        } catch (err) {
          console.error('Failed to start default level', err);
          setDifficulty(currentDifficulty);
          await startLevelById('level1', currentDifficulty);
        }
      })();
    });
  }
}

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (!gameConfig.controls.menu.includes(e.code) || e.repeat) return;
  if (isNoteOverlayVisible()) return;
  if (dead) return;
  if (running) {
    pauseGame();
    return;
  }
  if (paused) {
    resumeGame();
  }
});

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.code !== 'KeyH' || e.repeat) return;
  if (!running) return;
  const p = getPlayer();
  applyPlayerDamage(p, 10);
});
function bootstrap() {
  const appRoot = document.getElementById('app');
  if (!(appRoot instanceof HTMLElement)) {
    throw new Error('Missing #app root element');
  }
  mountAppDom(appRoot);
  startAssetPreload();
  // Fire-and-forget: animations load asynchronously alongside other assets.
  // Missing descriptors fail soft and the static material fallback keeps the
  // game playable.
  void loadAnimationRegistry();
  installConsoleCommands();
  initCanvas({
    getFullscreenBindings: () => gameConfig.controls.fullscreen,
  });
  applyStoredConfig();

  initAudioUi();
  initHpUi();
  initDeathUi();
  initMenu();
  bindNoteOverlayControls({
    getCloseBindings: () => [...gameConfig.controls.menu, ...gameConfig.controls.use],
  });
  void showStartupSequence();
}

async function showStartupSequence() {
  await showLoadingScreen({ levelName: 'PALATA', title: 'Loading PALATA' });
  if (running || paused || dead) return;
  showMenu();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}

// Watch HP and enter death state.
requestAnimationFrame(function watchDeath() {
  const p = getPlayer();
  if (!dead && running && p.hp <= 0) {
    enterDeathState();
  }
  requestAnimationFrame(watchDeath);
});
