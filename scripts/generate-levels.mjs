/* eslint-env node */
// Generates large liminal/maze levels (~100x100) for level1..level6.
// Does NOT touch level0.json. Run: node scripts/generate-levels.mjs

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEVELS_DIR = join(__dirname, '..', 'public', 'levels');

// Deterministic PRNG so re-runs produce identical files.
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generate({ seed, width, height, roomCount, loopiness, doorRate, windowRate, standRate }) {
  // Force odd dimensions so the maze lattice fits perfectly.
  const W = width % 2 === 0 ? width + 1 : width;
  const H = height % 2 === 0 ? height + 1 : height;
  const rand = mulberry32(seed);

  // 1=wall everywhere, then carve.
  const grid = Array.from({ length: H }, () => new Array(W).fill(1));

  // --- Recursive backtracker on odd lattice (cells at (1,1),(3,1),...) ---
  const stack = [[1, 1]];
  grid[1][1] = 0;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const dirs = shuffle(
      [
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
      ],
      rand,
    );
    let moved = false;
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx > 0 && nx < W - 1 && ny > 0 && ny < H - 1 && grid[ny][nx] === 1) {
        grid[ny][nx] = 0;
        grid[y + dy / 2][x + dx / 2] = 0;
        stack.push([nx, ny]);
        moved = true;
        break;
      }
    }
    if (!moved) stack.pop();
  }

  // --- Carve rectangular rooms (liminal halls) ---
  for (let i = 0; i < roomCount; i++) {
    const rw = 4 + Math.floor(rand() * 9);
    const rh = 4 + Math.floor(rand() * 9);
    const rx = 2 + Math.floor(rand() * Math.max(1, W - rw - 3));
    const ry = 2 + Math.floor(rand() * Math.max(1, H - rh - 3));
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        grid[y][x] = 0;
      }
    }
  }

  // --- Add loops by knocking down walls that join two corridors ---
  const loops = Math.floor(W * H * loopiness);
  for (let i = 0; i < loops; i++) {
    const x = 1 + Math.floor(rand() * (W - 2));
    const y = 1 + Math.floor(rand() * (H - 2));
    if (grid[y][x] !== 1) continue;
    const opens =
      (grid[y - 1][x] === 0 ? 1 : 0) +
      (grid[y + 1][x] === 0 ? 1 : 0) +
      (grid[y][x - 1] === 0 ? 1 : 0) +
      (grid[y][x + 1] === 0 ? 1 : 0);
    if (opens >= 2) grid[y][x] = 0;
  }

  // --- Place doors in single-cell wall slots between two corridor cells ---
  const targetDoors = Math.floor(W * H * doorRate);
  let placedDoors = 0;
  for (let attempt = 0; attempt < targetDoors * 60 && placedDoors < targetDoors; attempt++) {
    const x = 2 + Math.floor(rand() * (W - 4));
    const y = 2 + Math.floor(rand() * (H - 4));
    if (grid[y][x] !== 1) continue;
    const horiz =
      grid[y][x - 1] === 0 && grid[y][x + 1] === 0 && grid[y - 1][x] === 1 && grid[y + 1][x] === 1;
    const vert =
      grid[y - 1][x] === 0 && grid[y + 1][x] === 0 && grid[y][x - 1] === 1 && grid[y][x + 1] === 1;
    if (horiz || vert) {
      grid[y][x] = 6;
      placedDoors++;
    }
  }

  // --- Place windows: wall cells with exactly one corridor neighbor (so it
  // looks out from a corridor onto a sealed area). Avoid spawning right next
  // to doors so they read clearly. ---
  const targetWindows = Math.floor(W * H * windowRate);
  let placedWindows = 0;
  for (let attempt = 0; attempt < targetWindows * 80 && placedWindows < targetWindows; attempt++) {
    const x = 2 + Math.floor(rand() * (W - 4));
    const y = 2 + Math.floor(rand() * (H - 4));
    if (grid[y][x] !== 1) continue;
    const n = [grid[y - 1][x], grid[y + 1][x], grid[y][x - 1], grid[y][x + 1]];
    const corridorNeighbors = n.filter((v) => v === 0).length;
    const doorNeighbors = n.filter((v) => v === 6).length;
    if (corridorNeighbors === 1 && doorNeighbors === 0) {
      grid[y][x] = 3;
      placedWindows++;
    }
  }

  // --- Sprinkle stands (props) in open floor cells ---
  const targetStands = Math.floor(W * H * standRate);
  let placedStands = 0;
  for (let attempt = 0; attempt < targetStands * 40 && placedStands < targetStands; attempt++) {
    const x = 2 + Math.floor(rand() * (W - 4));
    const y = 2 + Math.floor(rand() * (H - 4));
    if (grid[y][x] !== 0) continue;
    // Don't block tight corridors (need at least 3 open neighbors so it's an open area).
    const open =
      (grid[y - 1][x] === 0 ? 1 : 0) +
      (grid[y + 1][x] === 0 ? 1 : 0) +
      (grid[y][x - 1] === 0 ? 1 : 0) +
      (grid[y][x + 1] === 0 ? 1 : 0);
    if (open < 3) continue;
    grid[y][x] = 4;
    placedStands++;
  }

  // --- Cleanup: revert "dangling" doors (fewer than 2 empty neighbors) back to walls ---
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (grid[y][x] !== 6) continue;
      const empties =
        (grid[y - 1][x] === 0 ? 1 : 0) +
        (grid[y + 1][x] === 0 ? 1 : 0) +
        (grid[y][x - 1] === 0 ? 1 : 0) +
        (grid[y][x + 1] === 0 ? 1 : 0);
      if (empties < 2) grid[y][x] = 1;
    }
  }

  // --- Pick spawn: first open floor cell from top-left, prefer empty surroundings ---
  let spawn = { x: 1.5, y: 1.5, rot: 0 };
  outer: for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (grid[y][x] !== 0) continue;
      const open =
        (grid[y - 1][x] === 0 ? 1 : 0) +
        (grid[y + 1][x] === 0 ? 1 : 0) +
        (grid[y][x - 1] === 0 ? 1 : 0) +
        (grid[y][x + 1] === 0 ? 1 : 0);
      if (open >= 2) {
        spawn = { x: x + 0.5, y: y + 0.5, rot: 0 };
        break outer;
      }
    }
  }

  // Convert grid to row strings.
  const rows = grid.map((row) => row.join(''));
  return { rows, spawn, width: W, height: H };
}

// Liminal palette per level — ceilings/floors tinted to match the wall/door textures.
const LEVELS = [
  {
    file: 'level1.json',
    id: 'level1',
    name: 'Level 1 — Beige Halls',
    seed: 1011,
    rot: 0,
    colors: { ceiling: '#c7b27a', floor: '#6e5a3c' }, // pale yellow ceiling, carpet
    music: '/assets/music/level_1/level_1_palata.mp3',
  },
  {
    file: 'level2.json',
    id: 'level2',
    name: 'Level 2 — Pool Rooms',
    seed: 2022,
    rot: 1.2,
    colors: { ceiling: '#bcd4d8', floor: '#3f6c84' }, // damp tile / water
    music: '/assets/music/level_2/level_2_legacy.mp3',
  },
  {
    file: 'level3.json',
    id: 'level3',
    name: 'Level 3 — Office After Hours',
    seed: 3033,
    rot: -0.6,
    colors: { ceiling: '#d8d2a8', floor: '#5a4630' }, // fluorescent / wood
    music: '/assets/music/level_3/level_3_legacy.mp3',
  },
  {
    file: 'level4.json',
    id: 'level4',
    name: 'Level 4 — Concrete',
    seed: 4044,
    rot: 2.4,
    colors: { ceiling: '#3a4350', floor: '#2f2f33' }, // cold cement
    music: '/assets/music/level_4/level_4_legacy.mp3',
  },
  {
    file: 'level5.json',
    id: 'level5',
    name: 'Level 5 — Crimson Wing',
    seed: 5055,
    rot: 0.4,
    colors: { ceiling: '#4a1818', floor: '#1a0a0a' }, // blood red
    music: '/assets/music/level_5/level_5.mp3',
  },
  {
    file: 'level6.json',
    id: 'level6',
    name: 'Level 6 — The Void',
    seed: 6066,
    rot: -1.5,
    colors: { ceiling: '#0c0c12', floor: '#1a1a1c' }, // near-black
    music: '/assets/music/level_6/level_6.mp3',
  },
];

const COMMON_GEN = {
  width: 101,
  height: 101,
  roomCount: 18,
  loopiness: 0.012, // ~ percentage of wall cells removed to add loops
  doorRate: 0.006, // ~60 doors per 100x100
  windowRate: 0.0035, // ~35 windows per 100x100
  standRate: 0.001, // ~10 stands per 100x100
};

if (!existsSync(LEVELS_DIR)) mkdirSync(LEVELS_DIR, { recursive: true });

for (const lvl of LEVELS) {
  const { rows, spawn } = generate({ seed: lvl.seed, ...COMMON_GEN });
  const json = {
    id: lvl.id,
    name: lvl.name,
    legend: {
      0: 'empty',
      1: 'wall',
      3: 'window',
      4: 'stand',
      6: 'door',
    },
    audio: {
      music: { src: lvl.music, loop: true, volume: 0.5 },
    },
    colors: lvl.colors,
    spawn: { x: spawn.x, y: spawn.y, rot: lvl.rot },
    rows,
  };
  const out = join(LEVELS_DIR, lvl.file);
  writeFileSync(out, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`wrote ${lvl.file}  ${rows[0].length}x${rows.length}`);
}
