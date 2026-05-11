import type { Grid, Legend } from '../types/game';

let map: Grid | null = null;
let cellLegend: Legend = {};
let materialsWall: string[][] | null = null;

export function setMap(newMap: Grid) {
  map = newMap;
}

export function setMaterialsWall(rows: string[][] | null) {
  materialsWall = rows;
}

export function getMaterialsWall(): string[][] | null {
  return materialsWall;
}

export function getMap(): Grid | null {
  return map;
}

export function setCell(x: number, y: number, value: number): boolean {
  if (!map || !map.length || !map[0] || !map[0].length) return false;
  if (x < 0 || x >= map[0].length || y < 0 || y >= map.length) return false;
  map[y][x] = value;
  return true;
}

export function setLegend(newLegend: Legend) {
  if (!newLegend || typeof newLegend !== 'object') {
    cellLegend = {};
    return;
  }

  const cleaned: Legend = {};
  for (const [k, v] of Object.entries(newLegend)) {
    if (typeof k !== 'string') continue;
    if (typeof v !== 'string') continue;
    cleaned[k] = v;
  }
  cellLegend = cleaned;
}

export function getLegend(): Legend {
  return cellLegend;
}

export function hitWall(x: number, y: number): boolean {
  if (!map || !map.length || !map[0] || !map[0].length) return true;
  if (x < 0 || x >= map[0].length || y < 0 || y >= map.length) {
    return true;
  }
  return map[Math.floor(y)][Math.floor(x)] != 0;
}

export function isDoorCell(xMap: number, yMap: number): boolean {
  if (!map) return false;
  const cellId = map[yMap]?.[xMap];
  if (typeof cellId !== 'number') return false;
  return cellLegend[String(cellId)] === 'door';
}

export function getCellMaterial(xMap: number, yMap: number): string | number {
  if (!map) return 0;

  const materialRow = materialsWall?.[yMap];
  const materialCell = materialRow?.[xMap];
  if (typeof materialCell === 'string' && materialCell.length > 0) return materialCell;

  const row = map[yMap];
  if (!row) return 0;
  const cellId = row[xMap];
  if (typeof cellId !== 'number') return 0;
  return cellLegend[String(cellId)] || cellId;
}
