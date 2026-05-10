import { isDoorCell, setCell } from '../../state/map-state';

export type KeyId = 'gold' | 'silver' | 'blood';

type DoorAction = 'closed' | 'opening' | 'open' | 'closing';

type DoorState = {
  x: number;
  y: number;
  action: DoorAction;
  open01: number;
  openHoldMs: number;
  lock: KeyId | null;
};

export function createDoorsSystem({
  playDoorOpenSfx,
  playDoorDeniedSfx,
  onDoorOpened,
}: {
  playDoorOpenSfx: () => void;
  playDoorDeniedSfx?: () => void;
  onDoorOpened?: (xMap: number, yMap: number) => void;
}) {
  const doors: DoorState[] = [];

  function keyForCell(xMap: number, yMap: number): KeyId | null {
    void xMap;
    void yMap;
    return null;
  }

  function getDoor(xMap: number, yMap: number): DoorState | null {
    for (const d of doors) {
      if (d.x === xMap && d.y === yMap) return d;
    }
    return null;
  }

  function ensureDoor(xMap: number, yMap: number): DoorState {
    let d = getDoor(xMap, yMap);
    if (d) return d;
    d = {
      x: xMap,
      y: yMap,
      action: 'closed',
      open01: 0,
      openHoldMs: 0,
      lock: keyForCell(xMap, yMap),
    };
    doors.push(d);
    return d;
  }

  function onMapChanged() {
    doors.length = 0;
  }

  function canInteractDoor(xMap: number, yMap: number) {
    return isDoorCell(xMap, yMap);
  }

  function requestOpenDoor(xMap: number, yMap: number, keys: Partial<Record<KeyId, boolean>> = {}) {
    if (!canInteractDoor(xMap, yMap)) return;
    const d = ensureDoor(xMap, yMap);

    if (d.lock && !keys[d.lock]) {
      playDoorDeniedSfx?.();
      return;
    }

    if (d.action === 'open' || d.action === 'opening') {
      d.openHoldMs = 0;
      return;
    }

    d.action = 'opening';
    d.openHoldMs = 0;
  }

  function interactWorld(x: number, y: number, keys: Partial<Record<KeyId, boolean>> = {}) {
    const xMap = Math.floor(x);
    const yMap = Math.floor(y);
    requestOpenDoor(xMap, yMap, keys);
  }

  function isDoorBlocking(x: number, y: number): boolean {
    const xMap = Math.floor(x);
    const yMap = Math.floor(y);
    if (!isDoorCell(xMap, yMap)) return false;
    const d = getDoor(xMap, yMap);
    if (!d) return true;
    return d.open01 < 0.98;
  }

  function tick(dt: number, isBlocked?: (xMap: number, yMap: number) => boolean) {
    if (!doors.length) return;

    const stepMs = dt * 1000;
    const openSpeedPerMs = 1 / 320;
    const closeSpeedPerMs = 1 / 320;
    const autoCloseMs = 2200;

    for (let i = doors.length - 1; i >= 0; i--) {
      const d = doors[i];

      if (!isDoorCell(d.x, d.y)) {
        doors.splice(i, 1);
        continue;
      }

      if (d.action === 'opening') {
        const prev = d.open01;
        d.open01 = Math.min(1, d.open01 + stepMs * openSpeedPerMs);
        if (prev < 0.98 && d.open01 >= 0.98) {
          setCell(d.x, d.y, 0);
          playDoorOpenSfx();
          onDoorOpened?.(d.x, d.y);
        }
        if (d.open01 >= 1) {
          d.action = 'open';
          d.openHoldMs = 0;
        }
        continue;
      }

      if (d.action === 'open') {
        d.openHoldMs += stepMs;
        if (d.openHoldMs >= autoCloseMs) {
          d.action = 'closing';
        }
        continue;
      }

      if (d.action === 'closing') {
        if (typeof isBlocked === 'function' && isBlocked(d.x, d.y)) {
          d.action = 'open';
          d.openHoldMs = 0;
          continue;
        }

        d.open01 = Math.max(0, d.open01 - stepMs * closeSpeedPerMs);
        if (d.open01 <= 0.02) {
          d.open01 = 0;
          d.action = 'closed';
          d.openHoldMs = 0;
        }
        continue;
      }
    }
  }

  return {
    requestOpenDoor,
    interactWorld,
    isDoorBlocking,
    onMapChanged,
    tick,
  };
}
