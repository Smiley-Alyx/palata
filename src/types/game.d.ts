export type Grid = number[][];

export type Legend = Record<string, string>;

export interface Spawn {
  x: number;
  y: number;
  rot?: number;
}

export interface Player {
  x: number;
  y: number;
  mov: number;
  dir: number;
  rot: number;
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  speed: number;
  moving: boolean;
  sneaking: boolean;
  sneakFactor: number;
  rotSpeed: number;
  fov: number;
  flatmap: number;
}
