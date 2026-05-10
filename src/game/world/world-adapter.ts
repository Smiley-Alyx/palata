import { getCellMaterial, hitWall } from '../../state/map-state';
import type { World } from '../../engine/engine';
import type { RayHit } from '../../raycast/raycaster';

export function createWorldAdapter({
  isSolid,
  interact,
  getWallTextureId,
}: {
  isSolid: (x: number, y: number) => boolean;
  interact: (x: number, y: number) => void;
  getWallTextureId: (hit: RayHit<string | number>) => string | number;
}): World<string | number> {
  return {
    isSolid,
    isRaySolid: (x: number, y: number) => {
      return hitWall(x, y);
    },
    getMaterial: (x: number, y: number) => {
      return getCellMaterial(Math.floor(x), Math.floor(y));
    },
    interact,
    getWallTextureId,
  };
}
