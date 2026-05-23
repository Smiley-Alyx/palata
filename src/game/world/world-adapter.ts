import { getCellMaterial, hitWall, isDoorCell } from '../../state/map-state';
import type { World } from '../../engine/engine';
import type { RayHit } from '../../raycast/raycaster';

export function createWorldAdapter({
  isSolid,
  interact,
  getWallTextureId,
  getWallTextureOffset,
  isDoorBlocking,
  isDoorRayBlockingAt,
  getLightAt,
}: {
  isSolid: (x: number, y: number) => boolean;
  interact: (x: number, y: number) => void;
  getWallTextureId: (hit: RayHit<string | number>) => string | number;
  getWallTextureOffset?: (hit: RayHit<string | number>) => number;
  isDoorBlocking?: (x: number, y: number) => boolean;
  isDoorRayBlockingAt?: (xMap: number, yMap: number, offset: number) => boolean;
  getLightAt?: (x: number, y: number) => number;
}): World<string | number> {
  return {
    isSolid,
    isRaySolid: (x: number, y: number) => {
      // Door cells have non-zero legend ids (so `hitWall` would always say
      // solid). Delegate their ray-solidness entirely to the doors system so
      // an opened door becomes transparent and the ray hits the wall behind.
      const xMap = Math.floor(x);
      const yMap = Math.floor(y);
      if (isDoorCell(xMap, yMap)) {
        return typeof isDoorBlocking === 'function' ? isDoorBlocking(x, y) : true;
      }
      return hitWall(x, y);
    },
    isRaySolidAt: (xMap: number, yMap: number, offset: number) => {
      if (isDoorCell(xMap, yMap)) {
        return typeof isDoorRayBlockingAt === 'function'
          ? isDoorRayBlockingAt(xMap, yMap, offset)
          : true;
      }
      return hitWall(xMap + 0.5, yMap + 0.5);
    },
    getMaterial: (x: number, y: number) => {
      return getCellMaterial(Math.floor(x), Math.floor(y));
    },
    interact,
    getWallTextureId,
    getWallTextureOffset,
    getLightAt,
  };
}
