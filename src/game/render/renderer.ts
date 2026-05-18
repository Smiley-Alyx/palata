import type { Player } from '../../types/game';
import type { EnemyKind } from '../game-types';
import { getMap } from '../../state/map-state';
import { getTextureForMaterial } from './materials';
import { getEnemyProfile } from '../systems/enemy-profiles';

export function createRenderer({
  ctx,
  getViewWidth,
  getViewHeight,
  player,
  getEnemies,
  getSprites,
}: {
  ctx: CanvasRenderingContext2D;
  getViewWidth: () => number;
  getViewHeight: () => number;
  player: Player;
  getEnemies?: () => Array<{ x: number; y: number; alive: boolean; attackFlashMs?: number }>;
  getSprites?: () => Array<{ x: number; y: number; material: string; alive: boolean; scale?: number }>;
}) {
  let ceilingColor = '#E3E3E1';
  let floorColor = '#858585';

  let ceilingMaterial: string | number | null = null;
  let floorMaterial: string | number | null = null;

  let ambientLight01 = 1;

  let flash = 0;
  let damagePulse = 0;
  let killFill = 0;
  let killFillTarget = 0;

  function getSourceSize(src: CanvasImageSource): { w: number; h: number } {
    if (src instanceof HTMLImageElement) {
      return {
        w: src.naturalWidth || src.width || 1,
        h: src.naturalHeight || src.height || 1,
      };
    }
    if (src instanceof HTMLCanvasElement) {
      return { w: src.width || 1, h: src.height || 1 };
    }
    return { w: 1, h: 1 };
  }

  function setBackgroundColors(colors: { ceiling?: string; floor?: string }) {
    if (typeof colors.ceiling === 'string') ceilingColor = colors.ceiling;
    if (typeof colors.floor === 'string') floorColor = colors.floor;
  }

  function setBackgroundMaterials(materials: { ceiling?: string | number | null; floor?: string | number | null }) {
    if ('ceiling' in materials) ceilingMaterial = materials.ceiling ?? null;
    if ('floor' in materials) floorMaterial = materials.floor ?? null;
  }

  function setAmbientLight01(light01: number) {
    ambientLight01 = Math.max(0, Math.min(1, light01));
  }

  function drawBackground() {
    const w = getViewWidth();
    const h = getViewHeight();

    ctx.clearRect(0, 0, w, h);
    const ceilingTexture = ceilingMaterial != null ? getTextureForMaterial(ceilingMaterial) : null;
    const floorTexture = floorMaterial != null ? getTextureForMaterial(floorMaterial) : null;

    if (ceilingTexture) {
      const pat = ctx.createPattern(ceilingTexture, 'repeat');
      if (pat) {
        ctx.fillStyle = pat;
      } else {
        ctx.fillStyle = ceilingColor;
      }
    } else {
      ctx.fillStyle = ceilingColor;
    }
    ctx.fillRect(0, 0, w, h / 2);

    if (floorTexture) {
      const pat = ctx.createPattern(floorTexture, 'repeat');
      if (pat) {
        ctx.fillStyle = pat;
      } else {
        ctx.fillStyle = floorColor;
      }
    } else {
      ctx.fillStyle = floorColor;
    }
    ctx.fillRect(0, h / 2, w, h / 2);

    // Subtle vertical shading to avoid a flat look.
    ctx.save();
    const topShade = ctx.createLinearGradient(0, 0, 0, h / 2);
    topShade.addColorStop(0, 'rgba(0,0,0,0.22)');
    topShade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topShade;
    ctx.fillRect(0, 0, w, h / 2);

    const bottomShade = ctx.createLinearGradient(0, h / 2, 0, h);
    bottomShade.addColorStop(0, 'rgba(0,0,0,0)');
    bottomShade.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = bottomShade;
    ctx.fillRect(0, h / 2, w, h / 2);

    // Light vignette.
    const vignette = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.25,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.75,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    // Screen-space darkness driven by world lighting.
    const darkness = (1 - ambientLight01) * 0.55;
    if (darkness > 0.001) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.8, darkness)})`;
      ctx.fillRect(0, 0, w, h);
    }

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.18, flash)})`;
      ctx.fillRect(0, 0, w, h);
      flash = Math.max(0, flash - 0.06);
    }

    if (damagePulse > 0) {
      ctx.fillStyle = `rgba(120,0,0,${Math.min(0.35, damagePulse)})`;
      ctx.fillRect(0, 0, w, h);
      damagePulse = Math.max(0, damagePulse - 0.03);
    }

    // Slow red fill after enemy kill.
    if (killFillTarget > 0) {
      killFillTarget = Math.max(0, killFillTarget - 0.004);
    }
    if (killFill < killFillTarget) {
      killFill = Math.min(killFillTarget, killFill + 0.01);
    } else if (killFill > killFillTarget) {
      killFill = Math.max(killFillTarget, killFill - 0.006);
    }
    if (killFill > 0) {
      ctx.fillStyle = `rgba(120,0,0,${Math.min(0.6, killFill)})`;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  function triggerFlash() {
    flash = 0.22;
  }

  function triggerDamagePulse() {
    damagePulse = Math.max(damagePulse, 0.28);
  }

  function triggerKillFill() {
    killFillTarget = Math.min(0.55, killFillTarget + 0.35);
  }

  function drawRay(dist: number, x: number, offset: number, img: string | number, light01: number = 1) {
    const viewWidth = getViewWidth();
    const viewHeight = getViewHeight();
    const distanceProjectionPlane = viewWidth / 2 / Math.tan(player.fov / 2);
    const sliceHeight = (1 / dist) * distanceProjectionPlane;

    const texture = getTextureForMaterial(img);
    if (!texture) return;

    const { w: texW, h: texH } = getSourceSize(texture);

    let texX = Math.floor(offset * texW);
    if (texX < 0) texX = 0;
    if (texX > texW - 1) texX = texW - 1;

    const y0 = viewHeight / 2 - sliceHeight / 2;
    ctx.drawImage(texture, texX, 0, 1, texH, x, y0, 1, sliceHeight);

    // Apply lighting as a dark overlay (cheap and stable for retro look).
    const l = Math.max(0, Math.min(1, light01));
    const shade = 1 - l;
    if (shade > 0.001) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.92, shade)})`;
      ctx.fillRect(x, y0, 1, sliceHeight);
    }
  }

  function drawSpriteList(
    zBuffer: Float64Array,
    listIn: Array<{ x: number; y: number; alive: boolean; material: string; attackFlashMs?: number; scale?: number }>,
  ) {
    if (!listIn.length) return;

    const w = getViewWidth();
    const h = getViewHeight();

    const distanceProjectionPlane = w / 2 / Math.tan(player.fov / 2);

    const list = listIn
      .filter((s) => s.alive)
      .map((s) => {
        const dx = s.x - player.x;
        const dy = s.y - player.y;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(player.y - s.y, s.x - player.x);
        let rel = angle - player.rot;
        rel = Math.atan2(Math.sin(rel), Math.cos(rel));
        const distPerp = dist * Math.cos(rel);

        const texture = getTextureForMaterial(s.material);
        return { s, dist, distPerp, rel, texture };
      })
      // back-to-front
      .sort((a, b) => b.dist - a.dist);

    for (const item of list) {
      if (item.distPerp <= 0.001) continue;
      if (Math.abs(item.rel) > player.fov / 2 + 0.2) continue;
      if (!item.texture) continue;

      const { w: texW, h: texH } = getSourceSize(item.texture);
      const texAspect = texW / Math.max(1, texH);

      const wallHeight = (1 / item.distPerp) * distanceProjectionPlane;
      const scale = item.s.scale ?? 1;
      let spriteHeight = wallHeight * scale;

      // Prevent very tall sprites from being cropped in shorter viewports.
      const maxSpriteH = h * 0.92;
      if (spriteHeight > maxSpriteH) spriteHeight = maxSpriteH;

      const spriteWidth = spriteHeight * texAspect;
      // Match wall ray columns: walls are cast with linear angle step across screen,
      // so sprites must use the same mapping to stay consistent with zBuffer.
      const screenX = (0.5 - item.rel / player.fov) * w;
      const x0 = Math.floor(screenX - spriteWidth / 2);
      const x1 = Math.floor(screenX + spriteWidth / 2);
      // Anchor sprite to the floor (bottom of the wall slice at same depth).
      const y0 = Math.floor(h / 2 + wallHeight / 2 - spriteHeight);

      for (let x = x0; x <= x1; x++) {
        if (x < 0 || x >= w) continue;
        const z = zBuffer[x];
        if (z !== 0 && item.distPerp > z) continue;

        const u = (x - x0) / Math.max(1, x1 - x0);
        const sx = Math.floor(u * texW);
        ctx.drawImage(item.texture, sx, 0, 1, texH, x, y0, 1, spriteHeight);
      }

      const flashMs = item.s.attackFlashMs ?? 0;
      if (flashMs > 0) {
        const t = Math.max(0, Math.min(1, flashMs / 220));
        ctx.save();
        ctx.strokeStyle = `rgba(255, 50, 50, ${0.25 + 0.6 * t})`;
        ctx.lineWidth = Math.max(1, Math.floor(spriteWidth * 0.02));
        ctx.shadowColor = `rgba(255, 0, 0, ${0.35 + 0.5 * t})`;
        ctx.shadowBlur = Math.max(2, Math.floor(spriteWidth * 0.18));
        ctx.strokeRect(x0 + 0.5, y0 + 0.5, Math.max(1, x1 - x0), Math.max(1, spriteHeight));
        ctx.restore();
      }
    }
  }

  function drawSprites(zBuffer: Float64Array) {
    const enemiesRaw = typeof getEnemies === 'function' ? getEnemies() : [];
    const enemies = enemiesRaw.map((e) => {
      const kind = (e as { kind?: EnemyKind }).kind;
      const mat = kind ? getEnemyProfile(kind).material : 'enemy';
      return { x: e.x, y: e.y, alive: e.alive, material: mat, attackFlashMs: e.attackFlashMs, scale: 1 };
    });
    drawSpriteList(zBuffer, enemies);

    const spritesRaw = typeof getSprites === 'function' ? getSprites() : [];
    const sprites = spritesRaw.map((s) => ({ x: s.x, y: s.y, alive: s.alive, material: s.material, scale: s.scale }));
    drawSpriteList(zBuffer, sprites);
  }

  function drawMap() {
    const map = getMap();
    if (!map) return;

    ctx.fillStyle = 'rgb(255, 255, 255)';
    ctx.fillRect(0, 0, map[0].length * 5, map.length * 5);
    ctx.fillStyle = 'rgb(255, 0, 0)';
    ctx.fillRect(player.x * 5 - 1, player.y * 5 - 1, 2, 2);

    const enemies = typeof getEnemies === 'function' ? getEnemies() : [];
    if (enemies.length) {
      ctx.fillStyle = 'rgb(0, 0, 255)';
      for (const e of enemies) {
        if (!e.alive) continue;
        ctx.fillRect(e.x * 5 - 1, e.y * 5 - 1, 2, 2);
      }
    }

    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        if (map[y][x] > 0) {
          ctx.fillStyle = 'rgb(0, 0, 0)';
          ctx.fillRect(x * 5, y * 5, 5, 5);
        }
      }
    }
  }

  return {
    drawBackground,
    drawRay,
    drawMap,
    drawSprites,
    setBackgroundColors,
    setBackgroundMaterials,
    setAmbientLight01,
    triggerFlash,
    triggerDamagePulse,
    triggerKillFill,
  };
}
