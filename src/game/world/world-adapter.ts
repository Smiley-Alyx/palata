import { getCellMaterial, hitWall } from '../../state/map-state';
import type { World } from '../../engine/engine';
import type { RayHit } from '../../raycast/raycaster';

export function createWorldAdapter({
  isSolid,
  interact,
  getWallTextureId,
  isDoorBlocking,
  getLightAt,
}: {
  isSolid: (x: number, y: number) => boolean;
  interact: (x: number, y: number) => void;
  getWallTextureId: (hit: RayHit<string | number>) => string | number;
  isDoorBlocking?: (x: number, y: number) => boolean;
  getLightAt?: (x: number, y: number) => number;
}): World<string | number> {
  return {
    isSolid,
    isRaySolid: (x: number, y: number) => {
      if (typeof isDoorBlocking === 'function' && isDoorBlocking(x, y)) return true;
      return hitWall(x, y);
    },
    getMaterial: (x: number, y: number) => {
      return getCellMaterial(Math.floor(x), Math.floor(y));
    },
    interact,
    getWallTextureId,
    getLightAt,
  };
}
