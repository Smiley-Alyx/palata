/* eslint-env node */
// Validates generated levels for playability.
// Run: node scripts/validate-levels.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');
const LEVEL_INDEX_PATH = join(PUBLIC_DIR, 'assets', 'data', 'levels', 'index.json');
const LEVEL_INDEX = JSON.parse(readFileSync(LEVEL_INDEX_PATH, 'utf8'));
const FILES = LEVEL_INDEX.levels
  .filter((level) => !level.hidden && typeof level.file === 'string')
  .map((level) => ({
    id: level.id,
    path: join(PUBLIC_DIR, level.file.replace(/^\//, '')),
  }));

// Game treats anything != 0 as a wall (see src/state/map-state.ts hitWall).
// Doors (6) are technically walls until opened by the door-opening mechanic,
// but for connectivity we treat doors as TRAVERSABLE (the player can open them).
// Windows (3) and stands (4) and walls (1) block movement.
const PASSABLE = new Set([0, 6]); // empty + door
const SOLID = new Set([1, 3, 4]); // wall, window, stand

function loadGrid(json) {
  const W = json.rows[0].length;
  const H = json.rows.length;
  const g = new Array(H);
  for (let y = 0; y < H; y++) {
    if (json.rows[y].length !== W) {
      throw new Error(`row ${y} has length ${json.rows[y].length}, expected ${W}`);
    }
    const row = new Array(W);
    for (let x = 0; x < W; x++) {
      const code = json.rows[y].charCodeAt(x) - 48;
      if (code < 0 || code > 9) throw new Error(`bad char at ${x},${y}: ${json.rows[y][x]}`);
      row[x] = code;
    }
    g[y] = row;
  }
  return { g, W, H };
}

function bfsReachable(g, W, H, sx, sy) {
  const seen = Array.from({ length: H }, () => new Uint8Array(W));
  const q = [[sx, sy]];
  seen[sy][sx] = 1;
  let count = 0;
  while (q.length) {
    const [x, y] = q.pop();
    count++;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      if (seen[ny][nx]) continue;
      if (!PASSABLE.has(g[ny][nx])) continue;
      seen[ny][nx] = 1;
      q.push([nx, ny]);
    }
  }
  return { count, seen };
}

let totalIssues = 0;

for (const { id, path } of FILES) {
  const json = JSON.parse(readFileSync(path, 'utf8'));
  const issues = [];
  const warnings = [];

  const { g, W, H } = loadGrid(json);

  // 1. Outer border must be solid.
  for (let x = 0; x < W; x++) {
    if (PASSABLE.has(g[0][x])) issues.push(`open border at top x=${x}`);
    if (PASSABLE.has(g[H - 1][x])) issues.push(`open border at bottom x=${x}`);
  }
  for (let y = 0; y < H; y++) {
    if (PASSABLE.has(g[y][0])) issues.push(`open border at left y=${y}`);
    if (PASSABLE.has(g[y][W - 1])) issues.push(`open border at right y=${y}`);
  }

  // 2. Spawn validity.
  const sx = Math.floor(json.spawn.x);
  const sy = Math.floor(json.spawn.y);
  if (sx < 0 || sx >= W || sy < 0 || sy >= H) {
    issues.push(`spawn out of bounds: (${sx},${sy})`);
  } else {
    const cell = g[sy][sx];
    if (cell !== 0) issues.push(`spawn cell not empty: (${sx},${sy})=${cell}`);
    // Spawn shouldn't be hugged on 3+ sides (player can move but feels claustrophobic).
    const blocked =
      (SOLID.has(g[sy - 1]?.[sx]) ? 1 : 0) +
      (SOLID.has(g[sy + 1]?.[sx]) ? 1 : 0) +
      (SOLID.has(g[sy]?.[sx - 1]) ? 1 : 0) +
      (SOLID.has(g[sy]?.[sx + 1]) ? 1 : 0);
    if (blocked >= 4) issues.push(`spawn fully boxed in by solids`);
    else if (blocked === 3) warnings.push(`spawn is in a dead-end (3 solid neighbors)`);
  }

  // 3. Connectivity from spawn.
  let totalEmpty = 0;
  let totalDoors = 0;
  let totalWindows = 0;
  let totalStands = 0;
  let totalWalls = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = g[y][x];
      if (v === 0) totalEmpty++;
      else if (v === 6) totalDoors++;
      else if (v === 3) totalWindows++;
      else if (v === 4) totalStands++;
      else if (v === 1) totalWalls++;
    }
  }

  const { count: reachable } = bfsReachable(g, W, H, sx, sy);
  const reachablePct = ((reachable / (totalEmpty + totalDoors)) * 100).toFixed(1);

  if (reachable < (totalEmpty + totalDoors) * 0.6) {
    issues.push(
      `low reachability: ${reachable}/${totalEmpty + totalDoors} (${reachablePct}%) of passable cells`,
    );
  } else if (reachable < (totalEmpty + totalDoors) * 0.85) {
    warnings.push(`reachability ${reachablePct}% — some isolated pockets`);
  }

  // 4. Doors must connect two passable areas (otherwise opening leads nowhere).
  let danglingDoors = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (g[y][x] !== 6) continue;
      const ns = [g[y - 1][x], g[y + 1][x], g[y][x - 1], g[y][x + 1]];
      const passNeighbors = ns.filter((v) => v === 0).length;
      if (passNeighbors < 2) danglingDoors++;
    }
  }
  if (danglingDoors > 0) warnings.push(`${danglingDoors} doors with <2 empty neighbors`);

  // 5. Windows should sit in walls (have at least 2 solid neighbors), otherwise
  // they're floating obstacles.
  let danglingWindows = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (g[y][x] !== 3) continue;
      const ns = [g[y - 1][x], g[y + 1][x], g[y][x - 1], g[y][x + 1]];
      const solidNeighbors = ns.filter((v) => v === 1 || v === 3).length;
      if (solidNeighbors < 2) danglingWindows++;
    }
  }
  if (danglingWindows > 0) warnings.push(`${danglingWindows} windows not embedded in walls`);

  // 6. Disconnected pockets size histogram (helps see how bad fragmentation is).
  const pockets = [];
  const visited = Array.from({ length: H }, () => new Uint8Array(W));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (visited[y][x]) continue;
      if (!PASSABLE.has(g[y][x])) continue;
      // Flood
      const stack = [[x, y]];
      visited[y][x] = 1;
      let size = 0;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        size++;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          if (visited[ny][nx]) continue;
          if (!PASSABLE.has(g[ny][nx])) continue;
          visited[ny][nx] = 1;
          stack.push([nx, ny]);
        }
      }
      pockets.push(size);
    }
  }
  pockets.sort((a, b) => b - a);
  const isolatedSmall = pockets.filter((s) => s < 5).length;

  console.log(`\n=== ${id} (${W}x${H}) ===`);
  console.log(
    `  cells: walls=${totalWalls} doors=${totalDoors} windows=${totalWindows} stands=${totalStands} empty=${totalEmpty}`,
  );
  console.log(
    `  spawn: (${json.spawn.x}, ${json.spawn.y}) rot=${json.spawn.rot}  cell=${g[sy]?.[sx]}`,
  );
  console.log(
    `  reachable from spawn: ${reachable} / ${totalEmpty + totalDoors} (${reachablePct}%)`,
  );
  console.log(
    `  pockets (passable components): ${pockets.length}; largest=${pockets[0]}; isolated <5 cells: ${isolatedSmall}`,
  );

  if (issues.length) {
    totalIssues += issues.length;
    console.log(`  ISSUES:`);
    for (const i of issues) console.log(`    - ${i}`);
  }
  if (warnings.length) {
    console.log(`  warnings:`);
    for (const w of warnings) console.log(`    - ${w}`);
  }
  if (!issues.length && !warnings.length) console.log(`  OK`);
}

console.log(`\n${totalIssues === 0 ? 'ALL LEVELS VALID' : 'TOTAL ISSUES: ' + totalIssues}`);
process.exit(totalIssues === 0 ? 0 : 1);
