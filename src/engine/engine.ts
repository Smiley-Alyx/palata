import { castRays, type RayHit } from '../raycast/raycaster';
import type { Player, Spawn } from '../types/game';

type Input = {
  bind: () => void;
  unbind: () => void;
  isDown: (code: string) => boolean;
};

type Renderer = {
  drawBackground: () => void;
  drawRay: (
    dist: number,
    x: number,
    offset: number,
    img: string | number,
    light01?: number,
  ) => void;
  drawMap: () => void;
  drawSprites: (zBuffer: Float64Array) => void;
  drawSenseRings?: () => void;
  drawWeapon?: () => void;
};

type EngineEvents = {
  onFootstep?: () => void;
  onShoot?: () => void;
  onEnemyKilled?: (xMap: number, yMap: number) => void;
  onPlayerDamaged?: (amount: number) => void;
  onPlayerDied?: () => void;
  onTick?: (dt: number) => void;
};

export type World<MaterialId = string | number> = {
  isSolid: (x: number, y: number) => boolean;
  isRaySolid: (x: number, y: number) => boolean;
  isRaySolidAt?: (xMap: number, yMap: number, offset: number) => boolean;
  getMaterial: (x: number, y: number) => MaterialId;
  interact?: (x: number, y: number) => void;
  getWallTextureId?: (hit: RayHit<MaterialId>) => MaterialId;
  getWallTextureOffset?: (hit: RayHit<MaterialId>) => number;
  getLightAt?: (x: number, y: number) => number;
};

export function createEngine({
  getViewWidth,
  getViewHeight,
  player,
  input,
  renderer,
  world,
  events,
}: {
  getViewWidth: () => number;
  getViewHeight: () => number;
  player: Player;
  input: Input;
  renderer: Renderer;
  world: World;
  events?: EngineEvents;
}) {
  let started = false;
  let rafId: number | null = null;

  const solidAt = world.isSolid;

  let previousTime = Date.now();
  let lag = 0.0;
  const MS_PER_UPDATE = 1000 / 60;

  let prevUseDown = false;
  let prevShootDown = false;

  let footstepCooldownMs = 0;
  let shootCooldownMs = 0;

  function setSpawn(spawn: Spawn | null) {
    if (!spawn || typeof spawn !== 'object') return;
    if (typeof spawn.x === 'number') player.x = spawn.x;
    if (typeof spawn.y === 'number') player.y = spawn.y;
    if (typeof spawn.rot === 'number') player.rot = spawn.rot;
  }

  function processInput(dt: number) {
    const useDown = input.isDown('KeyE');
    if (useDown && !prevUseDown) {
      tryInteractInFront();
    }
    prevUseDown = useDown;

    const shootDown = input.isDown('Space');
    if (shootDown && !prevShootDown && shootCooldownMs <= 0) {
      events?.onShoot?.();
      shootCooldownMs = 220;
    }
    prevShootDown = shootDown;

    player.mov =
      input.isDown('KeyW') || input.isDown('ArrowUp')
        ? 1
        : input.isDown('KeyS') || input.isDown('ArrowDown')
          ? -1
          : 0;
    player.dir =
      input.isDown('KeyA') || input.isDown('ArrowLeft')
        ? 1
        : input.isDown('KeyD') || input.isDown('ArrowRight')
          ? -1
          : 0;
    player.sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight') ? 1 : 0;

    const timeScale = dt * 60;

    const step = player.mov * player.speed * (player.sprint + 1) * player.sprintFactor * timeScale;
    const rotStep = player.dir * player.rotSpeed * timeScale;

    player.rot = addRotToAngle(rotStep, player.rot);

    const oldX = player.x;
    const oldY = player.y;

    const xNew = player.x + step * Math.cos(player.rot);
    const yNew = player.y - step * Math.sin(player.rot);
    const dx = xNew - player.x;
    const dy = yNew - player.y;

    // Sliding movement: try full move, then allow axis moves if diagonal is blocked.
    let moved = false;
    if (!solidAt(xNew, yNew)) {
      player.x = xNew;
      player.y = yNew;
      moved = true;
    } else {
      const tryMoveX = () => {
        const tx = player.x + dx;
        if (!solidAt(tx, player.y)) {
          player.x = tx;
          moved = true;
        }
      };
      const tryMoveY = () => {
        const ty = player.y + dy;
        if (!solidAt(player.x, ty)) {
          player.y = ty;
          moved = true;
        }
      };

      // Preserve the intended motion direction: try the dominant axis first.
      if (Math.abs(dx) >= Math.abs(dy)) {
        tryMoveX();
        tryMoveY();
      } else {
        tryMoveY();
        tryMoveX();
      }
    }

    const moving = player.mov !== 0;
    const actuallyMoved = moved && (oldX !== player.x || oldY !== player.y);

    footstepCooldownMs = Math.max(0, footstepCooldownMs - dt * 1000);
    shootCooldownMs = Math.max(0, shootCooldownMs - dt * 1000);
    if (moving && actuallyMoved && footstepCooldownMs <= 0) {
      events?.onFootstep?.();
      const walkIntervalMs = 360;
      footstepCooldownMs = player.sprint ? walkIntervalMs / 4 : walkIntervalMs;
    }
  }

  function tryInteractInFront() {
    const reach = 0.8;
    const xProbe = player.x + reach * Math.cos(player.rot);
    const yProbe = player.y - reach * Math.sin(player.rot);

    world.interact?.(xProbe, yProbe);
  }

  function addRotToAngle(rot: number, angle: number) {
    const newAngle = angle + rot;
    if (newAngle < 0) {
      return newAngle + (360 * Math.PI) / 180;
    }
    if (newAngle > (360 * Math.PI) / 180) {
      return newAngle - (360 * Math.PI) / 180;
    }
    return newAngle;
  }

  function render() {
    renderer.drawBackground();
    const { zBuffer } = castRays({
      player,
      world,
      getViewWidth,
      addRotToAngle,
      drawRay: renderer.drawRay,
    });
    renderer.drawSprites(zBuffer);
    renderer.drawSenseRings?.();
    renderer.drawWeapon?.();
    if (player.flatmap) renderer.drawMap();
  }

  function update() {}

  function tick() {
    const currentTime = Date.now();
    const elapsedTime = currentTime - previousTime;
    previousTime = currentTime;
    lag += elapsedTime;

    const dt = elapsedTime / 1000;

    processInput(dt);

    events?.onTick?.(dt);

    while (lag >= MS_PER_UPDATE) {
      update();
      lag -= MS_PER_UPDATE;
    }

    render();

    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (started) return;
    started = true;
    input.bind();
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    started = false;
  }

  function dispose() {
    stop();
    input.unbind();
  }

  return {
    start,
    stop,
    dispose,
    setSpawn,
    player,
  };
}
