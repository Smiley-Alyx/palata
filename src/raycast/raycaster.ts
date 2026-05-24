import type { Player } from '../types/game';

type AddRotToAngle = (rot: number, angle: number) => number;
type DrawRay = (
  dist: number,
  x: number,
  offset: number,
  img: string | number,
  light01?: number,
  columnWidth?: number,
) => void;

type WallFace = 'N' | 'S' | 'E' | 'W';

export type RayHit<MaterialId = string | number> = {
  xMap: number;
  yMap: number;
  face: WallFace;
  isVerticalHit: boolean;
  material: MaterialId;
  dist: number;
  offset: number;
};

type World<MaterialId = string | number> = {
  isRaySolid: (x: number, y: number) => boolean;
  isRaySolidAt?: (xMap: number, yMap: number, offset: number) => boolean;
  getMaterial: (x: number, y: number) => MaterialId;
  getWallTextureId?: (hit: RayHit<MaterialId>) => MaterialId;
  getWallTextureOffset?: (hit: RayHit<MaterialId>) => number;
  getLightAt?: (x: number, y: number) => number;
};

export function castRays({
  player,
  world,
  getViewWidth,
  addRotToAngle,
  drawRay,
}: {
  player: Player;
  world: World;
  getViewWidth: () => number;
  addRotToAngle: AddRotToAngle;
  drawRay: DrawRay;
}): { zBuffer: Float64Array } {
  const viewWidth = getViewWidth();
  const zBuffer = new Float64Array(viewWidth);
  const columnWidth = viewWidth > 480 ? 2 : 1;
  const rayCount = Math.ceil(viewWidth / columnWidth);
  const angleBetweenRays = player.fov / rayCount;

  let angle = addRotToAngle(player.fov / 2, player.rot);
  for (let i = 0, x = 0; x < viewWidth; i++, x += columnWidth) {
    const width = Math.min(columnWidth, viewWidth - x);
    const dist = castSingleRay({ player, world, angle, row: x, columnWidth: width, drawRay });
    for (let j = 0; j < width; j++) {
      zBuffer[x + j] = dist;
    }
    angle = addRotToAngle(-angleBetweenRays, angle);
  }

  return { zBuffer };
}

function castSingleRay({
  player,
  world,
  angle,
  row,
  columnWidth,
  drawRay,
}: {
  player: Player;
  world: World;
  angle: number;
  row: number;
  columnWidth: number;
  drawRay: DrawRay;
}) {
  const dirX = Math.cos(angle);
  const dirY = -Math.sin(angle);
  let xMap = Math.floor(player.x);
  let yMap = Math.floor(player.y);

  const deltaDistX = Math.abs(dirX) < 0.000001 ? Infinity : Math.abs(1 / dirX);
  const deltaDistY = Math.abs(dirY) < 0.000001 ? Infinity : Math.abs(1 / dirY);

  const stepX = dirX < 0 ? -1 : 1;
  const stepY = dirY < 0 ? -1 : 1;
  let sideDistX = dirX < 0 ? (player.x - xMap) * deltaDistX : (xMap + 1 - player.x) * deltaDistX;
  let sideDistY = dirY < 0 ? (player.y - yMap) * deltaDistY : (yMap + 1 - player.y) * deltaDistY;

  let hit: RayHit | null = null;

  for (let steps = 0; steps < 4096; steps++) {
    const isVerticalHit = sideDistX < sideDistY;
    if (isVerticalHit) {
      xMap += stepX;
      sideDistX += deltaDistX;
    } else {
      yMap += stepY;
      sideDistY += deltaDistY;
    }

    const rayDist = isVerticalHit
      ? (xMap - player.x + (1 - stepX) / 2) / dirX
      : (yMap - player.y + (1 - stepY) / 2) / dirY;
    const hitX = player.x + rayDist * dirX;
    const hitY = player.y + rayDist * dirY;
    const offset = isVerticalHit ? ((hitY % 1) + 1) % 1 : ((hitX % 1) + 1) % 1;
    const probeX = xMap + 0.5;
    const probeY = yMap + 0.5;
    const solid =
      typeof world.isRaySolidAt === 'function'
        ? world.isRaySolidAt(xMap, yMap, offset)
        : world.isRaySolid(probeX, probeY);

    if (!solid) continue;

    const material = world.getMaterial(probeX, probeY);
    hit = {
      xMap,
      yMap,
      face: isVerticalHit ? (stepX > 0 ? 'W' : 'E') : stepY > 0 ? 'N' : 'S',
      isVerticalHit,
      material,
      dist: rayDist,
      offset,
    };
    break;
  }

  if (!hit) return 0;

  const rawMaterial = hit ? hit.material : 0;
  const imgOut =
    hit && typeof world.getWallTextureId === 'function' ? world.getWallTextureId(hit) : rawMaterial;

  const light01 =
    hit && typeof world.getLightAt === 'function'
      ? world.getLightAt(hit.xMap + 0.5, hit.yMap + 0.5)
      : 1;

  const dist = hit.dist * Math.cos(player.rot - angle);
  const textureOffset =
    hit && typeof world.getWallTextureOffset === 'function'
      ? world.getWallTextureOffset(hit)
      : hit.offset;
  drawRay(dist, row, textureOffset, imgOut, light01, columnWidth);

  return dist;
}
