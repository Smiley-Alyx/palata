export function createInput({
  onToggleMap,
  getPointerTarget,
  getToggleMapBindings,
}: {
  onToggleMap?: (() => void) | null;
  getPointerTarget?: (() => HTMLElement | null) | null;
  getToggleMapBindings?: (() => string[]) | null;
} = {}) {
  const keysDown: Record<string, boolean> = Object.create(null);
  const mouseDown: Record<number, boolean> = Object.create(null);

  let bound = false;
  let mouseDeltaX = 0;
  let onKeyDown: ((e: KeyboardEvent) => void) | null = null;
  let onKeyUp: ((e: KeyboardEvent) => void) | null = null;
  let onMouseDown: ((e: MouseEvent) => void) | null = null;
  let onMouseUp: ((e: MouseEvent) => void) | null = null;
  let onMouseMove: ((e: MouseEvent) => void) | null = null;
  let onContextMenu: ((e: MouseEvent) => void) | null = null;

  function bind() {
    if (bound) return;
    bound = true;

    onKeyDown = function (e: KeyboardEvent) {
      if (
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault();
      }

      if (!e.repeat) {
        const mapBindings = getToggleMapBindings?.() ?? ['KeyM'];
        if (mapBindings.includes(e.code) && typeof onToggleMap === 'function') {
          onToggleMap();
        }
      }

      keysDown[e.code] = true;
    };

    onKeyUp = function (e: KeyboardEvent) {
      if (
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault();
      }

      keysDown[e.code] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    onMouseDown = function (e: MouseEvent) {
      const target = getPointerTarget?.() ?? null;
      const isGameMouseEvent =
        !target || e.target === target || document.pointerLockElement === target;
      if (!isGameMouseEvent) return;

      if (
        target &&
        e.target === target &&
        e.button === 0 &&
        document.pointerLockElement !== target
      ) {
        target.requestPointerLock();
      }

      mouseDown[e.button] = true;
    };

    onMouseUp = function (e: MouseEvent) {
      mouseDown[e.button] = false;
    };

    onMouseMove = function (e: MouseEvent) {
      const target = getPointerTarget?.() ?? null;
      if (!target || document.pointerLockElement !== target) return;
      mouseDeltaX += e.movementX;
    };

    onContextMenu = function (e: MouseEvent) {
      const target = getPointerTarget?.() ?? null;
      if (target && e.target === target) {
        e.preventDefault();
      }
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('contextmenu', onContextMenu);
  }

  function unbind() {
    if (!bound) return;
    bound = false;

    if (onKeyDown) window.removeEventListener('keydown', onKeyDown);
    if (onKeyUp) window.removeEventListener('keyup', onKeyUp);
    if (onMouseDown) window.removeEventListener('mousedown', onMouseDown);
    if (onMouseUp) window.removeEventListener('mouseup', onMouseUp);
    if (onMouseMove) window.removeEventListener('mousemove', onMouseMove);
    if (onContextMenu) window.removeEventListener('contextmenu', onContextMenu);

    onKeyDown = null;
    onKeyUp = null;
    onMouseDown = null;
    onMouseUp = null;
    onMouseMove = null;
    onContextMenu = null;
  }

  function isDown(code: string): boolean {
    return !!keysDown[code];
  }

  function isMouseDown(button: number): boolean {
    return !!mouseDown[button];
  }

  function isBindingDown(binding: string): boolean {
    if (binding.startsWith('Mouse')) {
      const button = Number(binding.slice(5));
      return Number.isFinite(button) && isMouseDown(button);
    }
    return isDown(binding);
  }

  function isAnyBindingDown(bindings: readonly string[]): boolean {
    return bindings.some(isBindingDown);
  }

  function consumeMouseDeltaX(): number {
    const value = mouseDeltaX;
    mouseDeltaX = 0;
    return value;
  }

  return {
    bind,
    unbind,
    isDown,
    isMouseDown,
    isBindingDown,
    isAnyBindingDown,
    consumeMouseDeltaX,
  };
}
