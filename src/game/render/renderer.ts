import type { Player } from '../../types/game';
import type { EnemyKind } from '../game-types';
import type { WeaponId } from '../systems/weapons';
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
  getPerceptionStages,
  getNearestEnemyDistance,
}: {
  ctx: CanvasRenderingContext2D;
  getViewWidth: () => number;
  getViewHeight: () => number;
  player: Player;
  getEnemies?: () => Array<{ x: number; y: number; alive: boolean; attackFlashMs?: number }>;
  getSprites?: () => Array<{ x: number; y: number; material: string; alive: boolean; scale?: number }>;
  getWeapon?: () => WeaponId;
  getPerceptionStages?: () => ReadonlyArray<PerceptionState>;
  getNearestEnemyDistance?: () => number | null;
}) {
  let ceilingColor = '#E3E3E1';
  let floorColor = '#858585';

  let floorMaterial: string | number | null = null;

  let ambientLight01 = 1;

  let flash = 0;
  let damagePulse = 0;
  let killFill = 0;
  let killFillTarget = 0;
  let weaponActionStartedAtMs = -Infinity;
  let floorPlaneCache:
    | {
        w: number;
        h: number;
        canvas: HTMLCanvasElement;
        ctx: CanvasRenderingContext2D;
      }
    | null = null;
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

  function setBackgroundMaterials(materials: { ceiling?: string | number | null; floor?: string | number | null }) {
    // Ceiling materials are intentionally ignored; the flat shaded ceiling preserves depth better.
    if ('floor' in materials) floorMaterial = materials.floor ?? null;
  }

  function setAmbientLight01(light01: number) {
    ambientLight01 = Math.max(0, Math.min(1, light01));
  }

  function drawTexturedFloor(
    output: ImageData,
    texture: ImageData,
    screenRow: number,
    outputRow: number,
    screenH: number,
  ) {
    const w = output.width;
    const horizon = screenH / 2;
    const rowDelta = screenRow - horizon;
    if (rowDelta <= 0) return;

    const rowDistance = (screenH * 0.5) / rowDelta;
    const leftAngle = player.rot + player.fov / 2;
    const rightAngle = player.rot - player.fov / 2;
    const leftX = Math.cos(leftAngle);
    const leftY = -Math.sin(leftAngle);
    const rightX = Math.cos(rightAngle);
    const rightY = -Math.sin(rightAngle);
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

  function getFloorPlaneCanvas(w: number, h: number) {
    if (floorPlaneCache && floorPlaneCache.w === w && floorPlaneCache.h === h) {
      return floorPlaneCache;
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const cctx = canvas.getContext('2d');
    if (!cctx) return null;
    cctx.imageSmoothingEnabled = false;

    floorPlaneCache = { w, h, canvas, ctx: cctx };
    return floorPlaneCache;
  }

  function drawBackground() {
    const w = getViewWidth();
    const h = getViewHeight();

    ctx.clearRect(0, 0, w, h);
    const floorTexture = floorMaterial != null ? getTextureForMaterial(floorMaterial) : null;
    const floorData = floorTexture ? getTextureData(floorTexture) : null;

    ctx.fillStyle = ceilingColor;
    ctx.fillRect(0, 0, w, h / 2);

    ctx.fillStyle = floorColor;
    ctx.fillRect(0, h / 2, w, h / 2);

    if (floorData) {
      const floorScale = w > 480 ? 2 : 1;
      const floorW = Math.ceil(w / floorScale);
      const floorH = Math.ceil((h / 2) / floorScale);
      const floorPlane = getFloorPlaneCanvas(floorW, floorH);
      if (floorPlane) {
        const planes = floorPlane.ctx.createImageData(floorW, floorH);
        const horizon = Math.floor(h / 2);
        for (let y = 0; y < floorH; y++) {
          drawTexturedFloor(planes, floorData, horizon + y * floorScale, y, h);
        }
        floorPlane.ctx.putImageData(planes, 0, 0);
        ctx.drawImage(floorPlane.canvas, 0, 0, floorW, floorH, 0, h / 2, w, h / 2);
      }
    }

    // Distance shading for ceiling/floor: darker at the horizon (far),
    // brighter near the camera.
    ctx.save();
    const ceilingShade = ctx.createLinearGradient(0, 0, 0, h / 2);
    // Near top of screen = horizon (far away) → fully black.
    ceilingShade.addColorStop(0, 'rgba(0,0,0,0.72)');
    ceilingShade.addColorStop(0.55, 'rgba(0,0,0,0.32)');
    ceilingShade.addColorStop(1, 'rgba(0,0,0,0)');
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
    const l = Math.max(0, Math.min(1, light01));
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
      const profile = kind ? getEnemyProfile(kind) : null;
      const mat = profile ? profile.material : 'enemy';
      const scale = profile && typeof profile.scale === 'number' ? profile.scale : 1;
      return { x: e.x, y: e.y, alive: e.alive, material: mat, attackFlashMs: e.attackFlashMs, scale };
    });
    drawSpriteList(zBuffer, enemies);

    const spritesRaw = typeof getSprites === 'function' ? getSprites() : [];
    const sprites = spritesRaw.map((s) => ({ x: s.x, y: s.y, alive: s.alive, material: s.material, scale: s.scale }));
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
