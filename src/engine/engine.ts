import { castRays, type RayHit } from '../raycast/raycaster';
import type { Player, Spawn } from '../types/game';

type Input = {
  bind: () => void;
  unbind: () => void;
  isDown: (code: string) => boolean;
  isMouseDown: (button: number) => boolean;
  consumeMouseDeltaX: () => number;
};

type Renderer = {
  drawBackground: () => void;
  drawRay: (
    dist: number,
    x: number,
    offset: number,
    img: string | number,
    light01?: number,
    columnWidth?: number,
  ) => void;
  drawMap: () => void;
  drawSprites: (zBuffer: Float64Array) => void;
  drawSenseRings?: () => void;
  drawCrosshair?: () => void;
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
  const mouseSensitivity = 0.0025;

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

    const shootDown = input.isDown('Space') || input.isMouseDown(0);
    if (shootDown && !prevShootDown && shootCooldownMs <= 0) {
      events?.onShoot?.();
      shootCooldownMs = 220;
    }
    prevShootDown = shootDown;

    const forward =
      input.isDown('KeyW') || input.isDown('ArrowUp')
        ? 1
        : input.isDown('KeyS') || input.isDown('ArrowDown')
          ? -1
          : 0;
    const strafe =
      input.isDown('KeyD')
        ? 1
        : input.isDown('KeyA')
          ? -1
          : 0;
    player.mov = forward;
    player.dir =
      input.isDown('ArrowLeft')
        ? 1
        : input.isDown('ArrowRight')
          ? -1
          : 0;
    player.sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight') ? 1 : 0;

    const timeScale = dt * 60;

    const speed = player.speed * (player.sprint + 1) * player.sprintFactor * timeScale;
    const movementLength = Math.hypot(forward, strafe) || 1;
    const forwardStep = (forward / movementLength) * speed;
    const strafeStep = (strafe / movementLength) * speed;
    const keyboardRotStep = player.dir * player.rotSpeed * timeScale;
    const mouseRotStep = -input.consumeMouseDeltaX() * mouseSensitivity;
    const rotStep = keyboardRotStep + mouseRotStep;

    player.rot = addRotToAngle(rotStep, player.rot);

    const oldX = player.x;
    const oldY = player.y;

    const xNew = player.x + forwardStep * Math.cos(player.rot) + strafeStep * Math.sin(player.rot);
    const yNew = player.y - forwardStep * Math.sin(player.rot) + strafeStep * Math.cos(player.rot);
    const dx = xNew - player.x;
    const dy = yNew - player.y;

    let moved = false;
    const moveSteps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.04));
    const stepX = dx / moveSteps;
    const stepY = dy / moveSteps;

    for (let i = 0; i < moveSteps; i++) {
      const txFull = player.x + stepX;
      const tyFull = player.y + stepY;
      if (!solidAt(txFull, tyFull)) {
        player.x = txFull;
        player.y = tyFull;
        moved = true;
        continue;
      }

      const tryMoveX = () => {
        const tx = player.x + stepX;
        if (!solidAt(tx, player.y)) {
          player.x = tx;
          moved = true;
        }
      };
      const tryMoveY = () => {
        const ty = player.y + stepY;
        if (!solidAt(player.x, ty)) {
          player.y = ty;
          moved = true;
        }
      };

      // Preserve the intended motion direction: try the dominant axis first.
      if (Math.abs(stepX) >= Math.abs(stepY)) {
        tryMoveX();
        tryMoveY();
      } else {
        tryMoveY();
        tryMoveX();
      }
    }

    const moving = forward !== 0 || strafe !== 0;
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
    renderer.drawCrosshair?.();
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
