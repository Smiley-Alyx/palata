import type { Player } from '../../types/game';
import type { EnemyKind } from '../game-types';
import type { WeaponDef, WeaponId } from '../systems/weapons';
import type { PerceptionState } from '../systems/world-state';
import { getMap } from '../../state/map-state';
import { getTextureForMaterial } from './materials';
import { getEnemyProfile } from '../systems/enemy-profiles';
import { getAnimatedFrameAt } from './animations';

export function createRenderer({
  ctx,
  getViewWidth,
  getViewHeight,
  player,
  getEnemies,
  getSprites,
  getWeapon,
  getWeaponDef,
  getPerceptionStages,
  getNearestEnemyDistance,
}: {
  ctx: CanvasRenderingContext2D;
  getViewWidth: () => number;
  getViewHeight: () => number;
  player: Player;
  getEnemies?: () => Array<{ x: number; y: number; alive: boolean; attackFlashMs?: number }>;
  getSprites?: () => Array<{
    x: number;
    y: number;
    material: string;
    alive: boolean;
    scale?: number;
  }>;
  getWeapon?: () => WeaponId;
  getWeaponDef?: () => WeaponDef;
  getPerceptionStages?: () => ReadonlyArray<PerceptionState>;
  getNearestEnemyDistance?: () => number | null;
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
  let weaponActionStartedAtMs = -Infinity;
  let backgroundPlaneCache: {
    w: number;
    h: number;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
  } | null = null;
  const shadedTextureCache = new WeakMap<object, Map<number, HTMLCanvasElement>>();
  const textureDataCache = new WeakMap<object, ImageData>();

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

  function getVisibleViewHeight(): number {
    const h = getViewHeight();
    const canvasRect = ctx.canvas.getBoundingClientRect();
    const frameRect = ctx.canvas.closest('.frame')?.getBoundingClientRect();
    if (!frameRect) return h;
    const clipped = frameRect.bottom - canvasRect.top;
    if (!Number.isFinite(clipped) || clipped <= 0) return h;
    return Math.min(h, clipped);
  }

  function getShadedTexture(texture: CanvasImageSource, shade: number): CanvasImageSource {
    const key = Math.max(1, Math.min(64, Math.round(shade * 64)));
    const cachedByShade = shadedTextureCache.get(texture as object);
    const cached = cachedByShade?.get(key);
    if (cached) return cached;

    const { w, h } = getSourceSize(texture);
    const shaded = document.createElement('canvas');
    shaded.width = w;
    shaded.height = h;

    const cctx = shaded.getContext('2d');
    if (!cctx) return texture;

    const quantizedShade = key / 64;
    cctx.imageSmoothingEnabled = false;
    cctx.drawImage(texture, 0, 0, w, h);
    cctx.globalCompositeOperation = 'source-atop';
    cctx.fillStyle = `rgba(0,0,0,${Math.min(0.92, quantizedShade)})`;
    cctx.fillRect(0, 0, w, h);
    cctx.globalCompositeOperation = 'source-over';

    let byShade = cachedByShade;
    if (!byShade) {
      byShade = new Map();
      shadedTextureCache.set(texture as object, byShade);
    }
    byShade.set(key, shaded);
    return shaded;
  }

  function getDistanceLight01(dist: number): number {
    if (!Number.isFinite(dist) || dist <= 0) return 1;
    const start = 2.5;
    const end = 13;
    const t = Math.max(0, Math.min(1, (dist - start) / (end - start)));
    return 1 - t * 0.74;
  }

  function getTextureData(texture: CanvasImageSource): ImageData | null {
    const cached = textureDataCache.get(texture as object);
    if (cached) return cached;

    const { w, h } = getSourceSize(texture);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;

    const cctx = canvas.getContext('2d');
    if (!cctx) return null;

    cctx.imageSmoothingEnabled = false;
    cctx.drawImage(texture, 0, 0, w, h);

    try {
      const data = cctx.getImageData(0, 0, w, h);
      textureDataCache.set(texture as object, data);
      return data;
    } catch {
      return null;
    }
  }

  function setBackgroundColors(colors: { ceiling?: string; floor?: string }) {
    if (typeof colors.ceiling === 'string') {
      ceilingColor = colors.ceiling;
    }
    if (typeof colors.floor === 'string') floorColor = colors.floor;
  }

  function setBackgroundMaterials(materials: {
    ceiling?: string | number | null;
    floor?: string | number | null;
  }) {
    if ('ceiling' in materials) ceilingMaterial = materials.ceiling ?? null;
    if ('floor' in materials) floorMaterial = materials.floor ?? null;
  }

  function setAmbientLight01(light01: number) {
    ambientLight01 = Math.max(0, Math.min(1, light01));
  }

  function drawTexturedPlane(
    output: ImageData,
    texture: ImageData,
    screenRow: number,
    outputRow: number,
    screenH: number,
    screenW: number,
    ceiling: boolean,
  ) {
    const w = output.width;
    const horizon = screenH / 2;
    const rowDelta = ceiling ? horizon - screenRow : screenRow - horizon;
    if (rowDelta <= 0) return;

    const projectionPlane = screenW / 2 / Math.tan(player.fov / 2);
    const rowDistance = (projectionPlane * 0.5) / rowDelta;
    const dirX = Math.cos(player.rot);
    const dirY = -Math.sin(player.rot);
    const planeSize = Math.tan(player.fov / 2);
    const planeX = -Math.sin(player.rot) * planeSize;
    const planeY = -Math.cos(player.rot) * planeSize;
    const leftX = dirX + planeX;
    const leftY = dirY + planeY;
    const rightX = dirX - planeX;
    const rightY = dirY - planeY;
    const stepX = (rowDistance * (rightX - leftX)) / w;
    const stepY = (rowDistance * (rightY - leftY)) / w;

    let worldX = player.x + rowDistance * leftX;
    let worldY = player.y + rowDistance * leftY;
    const outData = output.data;
    const texData = texture.data;
    const texW = texture.width;
    const texH = texture.height;
    let out = outputRow * w * 4;

    for (let x = 0; x < w; x++) {
      const tx = Math.floor((worldX - Math.floor(worldX)) * texW) % texW;
      const ty = Math.floor((worldY - Math.floor(worldY)) * texH) % texH;
      const src = (ty * texW + tx) * 4;
      outData[out] = texData[src];
      outData[out + 1] = texData[src + 1];
      outData[out + 2] = texData[src + 2];
      outData[out + 3] = 255;
      out += 4;
      worldX += stepX;
      worldY += stepY;
    }
  }

  function getBackgroundPlaneCanvas(w: number, h: number) {
    if (backgroundPlaneCache && backgroundPlaneCache.w === w && backgroundPlaneCache.h === h) {
      return backgroundPlaneCache;
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const cctx = canvas.getContext('2d');
    if (!cctx) return null;
    cctx.imageSmoothingEnabled = false;

    backgroundPlaneCache = { w, h, canvas, ctx: cctx };
    return backgroundPlaneCache;
  }

  function drawBackgroundPlane(
    texture: ImageData | null,
    y: number,
    height: number,
    ceiling: boolean,
    scale: number,
  ) {
    if (!texture) return;

    const planeW = Math.ceil(getViewWidth() / scale);
    const planeH = Math.ceil(height / scale);
    const plane = getBackgroundPlaneCanvas(planeW, planeH);
    if (!plane) return;

    const pixels = plane.ctx.createImageData(planeW, planeH);
    const horizon = Math.floor(getViewHeight() / 2);
    for (let row = 0; row < planeH; row++) {
      const screenRow = ceiling ? row * scale : horizon + row * scale;
      drawTexturedPlane(pixels, texture, screenRow, row, getViewHeight(), getViewWidth(), ceiling);
    }
    plane.ctx.putImageData(pixels, 0, 0);

    ctx.save();
    ctx.globalAlpha = 0.68;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(plane.canvas, 0, 0, planeW, planeH, 0, y, getViewWidth(), height);
    ctx.restore();
  }

  function drawBackground() {
    const w = getViewWidth();
    const h = getViewHeight();

    ctx.clearRect(0, 0, w, h);
    const ceilingTexture = ceilingMaterial != null ? getTextureForMaterial(ceilingMaterial) : null;
    const ceilingData = ceilingTexture ? getTextureData(ceilingTexture) : null;
    const floorTexture = floorMaterial != null ? getTextureForMaterial(floorMaterial) : null;
    const floorData = floorTexture ? getTextureData(floorTexture) : null;

    ctx.fillStyle = ceilingColor;
    ctx.fillRect(0, 0, w, h / 2);

    ctx.fillStyle = floorColor;
    ctx.fillRect(0, h / 2, w, h / 2);

    const planeScale = w > 480 ? 4 : 2;
    drawBackgroundPlane(ceilingData, 0, h / 2, true, planeScale);
    drawBackgroundPlane(floorData, h / 2, h / 2, false, planeScale);

    // Distance shading for ceiling/floor: darker at the horizon (far),
    // brighter near the camera.
    ctx.save();
    const ceilingShade = ctx.createLinearGradient(0, 0, 0, h / 2);
    ceilingShade.addColorStop(0, 'rgba(0,0,0,0)');
    ceilingShade.addColorStop(0.45, 'rgba(0,0,0,0.32)');
    ceilingShade.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = ceilingShade;
    ctx.fillRect(0, 0, w, h / 2);

    const floorShade = ctx.createLinearGradient(0, h / 2, 0, h);
    // Near horizon = far away → dark; near bottom = close → bright.
    floorShade.addColorStop(0, 'rgba(0,0,0,0.72)');
    floorShade.addColorStop(0.45, 'rgba(0,0,0,0.32)');
    floorShade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = floorShade;
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
    vignette.addColorStop(0.68, 'rgba(0,0,0,0.22)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.48)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    // Screen-space darkness driven by world lighting.
    const darkness = 0.08 + (1 - ambientLight01) * 0.66;
    if (darkness > 0.001) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.86, darkness)})`;
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

  function triggerWeaponAction() {
    weaponActionStartedAtMs = performance.now();
  }

  function drawCrosshair() {
    const def = typeof getWeaponDef === 'function' ? getWeaponDef() : null;
    if (!def) return;

    const w = getViewWidth();
    const h = getVisibleViewHeight();
    const cx = Math.floor(w * 0.5);
    const cy = Math.floor(h * 0.48);
    const angularRatio = Math.tan(def.spreadRad) / Math.tan(player.fov / 2);
    const actionElapsedSec = (performance.now() - weaponActionStartedAtMs) / 1000;
    const recoil =
      actionElapsedSec >= 0 && actionElapsedSec < 0.18 ? 1 - actionElapsedSec / 0.18 : 0;
    const radius = Math.max(6, Math.min(w * 0.18, angularRatio * (w / 2) + 5 + recoil * 10));
    const arm = Math.max(5, Math.min(14, radius * 0.42));
    const gap = radius;
    const alpha = def.ammoId ? 0.78 : 0.52;

    ctx.save();
    ctx.lineWidth = 2;
    ctx.lineCap = 'square';
    ctx.strokeStyle = `rgba(235, 235, 220, ${alpha})`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 3;

    ctx.beginPath();
    ctx.moveTo(cx - gap - arm, cy);
    ctx.lineTo(cx - gap, cy);
    ctx.moveTo(cx + gap, cy);
    ctx.lineTo(cx + gap + arm, cy);
    ctx.moveTo(cx, cy - gap - arm);
    ctx.lineTo(cx, cy - gap);
    ctx.moveTo(cx, cy + gap);
    ctx.lineTo(cx, cy + gap + arm);
    ctx.stroke();

    ctx.globalAlpha = alpha * 0.78;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1.5, Math.min(3, radius * 0.12)), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(235, 235, 220, 0.86)';
    ctx.fill();
    ctx.restore();
  }

  function drawRay(
    dist: number,
    x: number,
    offset: number,
    img: string | number,
    light01: number = 1,
    columnWidth: number = 1,
  ) {
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

    // Apply lighting as a dark overlay (cheap and stable for retro look).
    const l = Math.max(0, Math.min(1, light01 * getDistanceLight01(dist)));
    const shade = 1 - l;
    if (shade > 0.001) {
      const shaded = getShadedTexture(texture, shade);
      ctx.drawImage(shaded, texX, 0, 1, texH, x, y0, columnWidth, sliceHeight);
    } else {
      ctx.drawImage(texture, texX, 0, 1, texH, x, y0, columnWidth, sliceHeight);
    }
  }

  function drawSpriteList(
    zBuffer: Float64Array,
    listIn: Array<{
      x: number;
      y: number;
      alive: boolean;
      material: string;
      attackFlashMs?: number;
      scale?: number;
      anchor?: 'center' | 'floor';
    }>,
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
      const anchor = item.s.anchor ?? 'floor';
      const y0 =
        anchor === 'center'
          ? Math.floor(h / 2 - spriteHeight / 2)
          : Math.floor(h / 2 + wallHeight / 2 - spriteHeight);

      for (let x = x0; x <= x1; x++) {
        if (x < 0 || x >= w) continue;
        const z = zBuffer[x];
        if (z !== 0 && item.distPerp > z) continue;

        const u = (x - x0) / Math.max(1, x1 - x0);
        const sx = Math.floor(u * texW);
        ctx.drawImage(item.texture, sx, 0, 1, texH, x, y0, 1, spriteHeight);
      }
    }
  }

  function drawSprites(zBuffer: Float64Array) {
    const enemiesRaw = typeof getEnemies === 'function' ? getEnemies() : [];
    const enemies = enemiesRaw.map((e) => {
      const kind = (e as { kind?: EnemyKind }).kind;
      const profile = kind ? getEnemyProfile(kind) : null;
      const mat = profile ? profile.material : 'enemy';
      const scale = profile && typeof profile.scale === 'number' ? profile.scale : 1;
      return {
        x: e.x,
        y: e.y,
        alive: e.alive,
        material: mat,
        attackFlashMs: e.attackFlashMs,
        scale,
        anchor: 'center' as const,
      };
    });
    drawSpriteList(zBuffer, enemies);

    const spritesRaw = typeof getSprites === 'function' ? getSprites() : [];
    const sprites = spritesRaw.map((s) => ({
      x: s.x,
      y: s.y,
      alive: s.alive,
      material: s.material,
      scale: s.scale,
    }));
    drawSpriteList(zBuffer, sprites);
  }

  function drawSenseRings() {
    const stages = typeof getPerceptionStages === 'function' ? getPerceptionStages() : [];
    const active =
      stages.includes('predator') || stages.includes('nightmare') || stages.includes('infected');
    if (!active) return;

    const enemyDistance =
      typeof getNearestEnemyDistance === 'function' ? getNearestEnemyDistance() : null;
    const range = stages.includes('predator') ? 10 : stages.includes('nightmare') ? 7 : 5;
    const distanceRatio =
      enemyDistance === null ? 0.12 : Math.max(0, Math.min(1, 1 - enemyDistance / range));
    const stateBoost = stages.includes('predator') ? 1 : stages.includes('nightmare') ? 0.74 : 0.48;
    const strength = distanceRatio * stateBoost;
    if (strength <= 0.02) return;

    const w = getViewWidth();
    const h = getVisibleViewHeight();
    const cx = w * 0.5;
    const cy = h * 0.43;
    const t = performance.now() / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(t * 4.8);
    const wobble = Math.sin(t * 2.7) * 4 * strength;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';
    ctx.shadowColor = `rgba(180, 20, 20, ${0.18 + strength * 0.26})`;
    ctx.shadowBlur = 14 + strength * 18;

    for (let i = 0; i < 4; i++) {
      const phase = (i + pulse) / 4;
      const rx = (w * (0.06 + phase * 0.14) + wobble) * (1 + strength * 0.2);
      const ry = rx * (0.28 + i * 0.035);
      const alpha = Math.max(0, (1 - phase) * strength * 0.34);
      ctx.strokeStyle = `rgba(210, 40, 36, ${alpha})`;
      ctx.lineWidth = Math.max(1, Math.floor(1 + strength * 3 - i * 0.35));
      ctx.beginPath();
      ctx.ellipse(cx, cy + i * 2, rx, ry, 0, Math.PI * 1.04, Math.PI * 1.96);
      ctx.stroke();
    }

    const veil = ctx.createRadialGradient(cx, cy, w * 0.02, cx, cy, w * 0.24);
    veil.addColorStop(0, `rgba(240, 40, 35, ${strength * 0.09})`);
    veil.addColorStop(0.55, `rgba(120, 0, 0, ${strength * 0.045})`);
    veil.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function drawWeapon() {
    const weapon = typeof getWeapon === 'function' ? getWeapon() : null;
    if (!weapon) return;

    const actionElapsedSec = (performance.now() - weaponActionStartedAtMs) / 1000;
    const actionActive = actionElapsedSec >= 0 && actionElapsedSec < 0.34;
    const frame = actionActive
      ? getAnimatedFrameAt(weapon, actionElapsedSec, 1)
      : getAnimatedFrameAt(weapon, 0, 0);
    if (!frame) return;

    const w = getViewWidth();
    const h = getVisibleViewHeight();
    const { w: texW, h: texH } = getSourceSize(frame);
    const aspect = texW / Math.max(1, texH);
    let drawH = h * 0.88;
    let drawW = drawH * aspect;
    const maxW = w * 0.72;
    if (drawW > maxW) {
      drawW = maxW;
      drawH = drawW / Math.max(0.01, aspect);
    }

    const x = Math.floor((w - drawW) / 2);
    const y = Math.floor(h * 1.04 - drawH);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(frame, x, y, drawW, drawH);
    ctx.restore();
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
    drawSenseRings,
    drawCrosshair,
    setBackgroundColors,
    setBackgroundMaterials,
    setAmbientLight01,
    triggerFlash,
    triggerDamagePulse,
    triggerKillFill,
    triggerWeaponAction,
    drawWeapon,
  };
}
