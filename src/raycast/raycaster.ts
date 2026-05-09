import type { Player } from '../types/game';

type AddRotToAngle = (rot: number, angle: number) => number;
type DrawRay = (dist: number, x: number, offset: number, img: string | number) => void;

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
  getMaterial: (x: number, y: number) => MaterialId;
  getWallTextureId?: (hit: RayHit<MaterialId>) => MaterialId;
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
  const angleBetweenRays = ((player.fov * 180) / Math.PI / viewWidth) * (Math.PI / 180);

  let angle = addRotToAngle(player.fov / 2, player.rot);
  for (let i = 0; i < viewWidth; i++) {
    zBuffer[i] = castSingleRay({ player, world, angle, row: i, drawRay });
    angle = addRotToAngle(-angleBetweenRays, angle);
  }

  return { zBuffer };
}

function castSingleRay({
  player,
  world,
  angle,
  row,
  drawRay,
}: {
  player: Player;
  world: World;
  angle: number;
  row: number;
  drawRay: DrawRay;
}) {
  const facingRight = angle < (90 * Math.PI) / 180 || angle > (270 * Math.PI) / 180;
  const facingUp = angle < (180 * Math.PI) / 180;

  let x = 0;
  let y = 0;
  let dX = 0;
  let dY = 0;
  let xMap = 0;
  let yMap = 0;

  let hitXMapH = 0;
  let hitYMapH = 0;
  let hitXMapV = 0;
  let hitYMapV = 0;

  // По горизонтали
  let slope = 1 / (Math.sin(-angle) / Math.cos(-angle));
  y = facingUp ? Math.floor(player.y) : Math.ceil(player.y);
  x = player.x + (y - player.y) * slope;

  dY = facingUp ? -1 : 1;
  dX = dY * slope;

  let distH = Infinity;
  let xHitH = 0;
  let yHitH = 0;
  let hitH: RayHit | null = null;
  let offsetH = 0;

  for (let steps = 0; steps < 4096; steps++) {
    yMap = Math.floor(y + (facingUp ? -1 : 0));
    xMap = Math.floor(x);

    const probeX = xMap + 0.5;
    const probeY = yMap + 0.5;
    if (world.isRaySolid(probeX, probeY)) {
      distH = Math.abs((player.x - x) / Math.cos(angle));
      xHitH = x;
      yHitH = y;
      offsetH = x % 1;
      const material = world.getMaterial(probeX, probeY);
      hitXMapH = xMap;
      hitYMapH = yMap;
      hitH = {
        xMap,
        yMap,
        face: facingUp ? 'S' : 'N',
        isVerticalHit: false,
        material,
        dist: distH,
        offset: offsetH,
      };
      break;
    }

    x += dX;
    y += dY;
  }

  // По вертикали
  slope = Math.sin(-angle) / Math.cos(-angle);
  x = facingRight ? Math.ceil(player.x) : Math.floor(player.x);
  y = player.y + (x - player.x) * slope;
  dX = facingRight ? 1 : -1;
  dY = dX * slope;

  let distV = Infinity;
  let xHitV = 0;
  let yHitV = 0;
  let hitV: RayHit | null = null;
  let offsetV = 0;

  for (let steps = 0; steps < 4096; steps++) {
    xMap = Math.floor(x + (facingRight ? 0 : -1));
    yMap = Math.floor(y);

    const probeX = xMap + 0.5;
    const probeY = yMap + 0.5;
    if (world.isRaySolid(probeX, probeY)) {
      distV = Math.abs((player.y - y) / Math.sin(angle));
      xHitV = x;
      yHitV = y;
      offsetV = y % 1;
      const material = world.getMaterial(probeX, probeY);
      hitXMapV = xMap;
      hitYMapV = yMap;
      hitV = {
        xMap,
        yMap,
        face: facingRight ? 'W' : 'E',
        isVerticalHit: true,
        material,
        dist: distV,
        offset: offsetV,
      };
      break;
    }

    x += dX;
    y += dY;
  }

  let dist = 0;
  let offset = 0;
  let hit: RayHit | null = null;

  if (distV < distH) {
    x = xHitV;
    y = yHitV;
    dist = distV;
    offset = offsetV;
    hit = hitV;
  } else {
    x = xHitH;
    y = yHitH;
    dist = distH;
    offset = offsetH;
    hit = hitH;
  }

  const rawMaterial = hit ? hit.material : 0;
  const imgOut = hit && typeof world.getWallTextureId === 'function' ? world.getWallTextureId(hit) : rawMaterial;

  dist = dist * Math.cos(player.rot - angle);
  drawRay(dist, row, offset, imgOut);

  return dist;
}
