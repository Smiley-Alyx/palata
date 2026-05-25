import { castRays, type RayHit } from '../raycast/raycaster';
import type { Player, Spawn } from '../types/game';

type Input = {
  bind: () => void;
  unbind: () => void;
  isDown: (code: string) => boolean;
  isMouseDown: (button: number) => boolean;
  isAnyBindingDown: (bindings: readonly string[]) => boolean;
  consumeMouseDeltaX: () => number;
};

type Controls = {
  moveForward: string[];
  moveBackward: string[];
  strafeLeft: string[];
  strafeRight: string[];
  turnLeft: string[];
  turnRight: string[];
  sneak: string[];
  use: string[];
  shoot: string[];
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
  getControls,
}: {
  getViewWidth: () => number;
  getViewHeight: () => number;
  player: Player;
  input: Input;
  renderer: Renderer;
  world: World;
  events?: EngineEvents;
  getControls?: () => Controls;
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
  const defaultControls: Controls = {
    moveForward: ['KeyW', 'ArrowUp'],
    moveBackward: ['KeyS', 'ArrowDown'],
    strafeLeft: ['KeyA'],
    strafeRight: ['KeyD'],
    turnLeft: ['ArrowLeft'],
    turnRight: ['ArrowRight'],
    sneak: ['ControlLeft', 'ControlRight'],
    use: ['KeyE'],
    shoot: ['Mouse0', 'Space'],
  };

  function setSpawn(spawn: Spawn | null) {
    if (!spawn || typeof spawn !== 'object') return;
    if (typeof spawn.x === 'number') player.x = spawn.x;
    if (typeof spawn.y === 'number') player.y = spawn.y;
    if (typeof spawn.rot === 'number') player.rot = spawn.rot;
  }

  function processInput(dt: number) {
    const controls = getControls?.() ?? defaultControls;
    const useDown = input.isAnyBindingDown(controls.use);
    if (useDown && !prevUseDown) {
      tryInteractInFront();
    }
    prevUseDown = useDown;

    const shootDown = input.isAnyBindingDown(controls.shoot);
    if (shootDown && !prevShootDown && shootCooldownMs <= 0) {
      events?.onShoot?.();
      shootCooldownMs = 220;
    }
    prevShootDown = shootDown;

    const forward = input.isAnyBindingDown(controls.moveForward)
      ? 1
      : input.isAnyBindingDown(controls.moveBackward)
        ? -1
        : 0;
    const strafe = input.isAnyBindingDown(controls.strafeRight)
      ? 1
      : input.isAnyBindingDown(controls.strafeLeft)
        ? -1
        : 0;
    player.mov = forward;
    player.dir = input.isAnyBindingDown(controls.turnLeft)
      ? 1
      : input.isAnyBindingDown(controls.turnRight)
        ? -1
        : 0;
    player.sneaking = input.isAnyBindingDown(controls.sneak);

    const timeScale = dt * 60;

    const speed = player.speed * (player.sneaking ? player.sneakFactor : 1) * timeScale;
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
      const walkIntervalMs = 360;
      if (!player.sneaking) events?.onFootstep?.();
      footstepCooldownMs = player.sneaking ? walkIntervalMs * 2 : walkIntervalMs;
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
