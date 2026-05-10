import { isDoorCell, setCell } from '../../state/map-state';

type PendingDoor = {
  x: number;
  y: number;
  openRemainingMs: number;
};

export function createDoorsSystem({
  playDoorOpenSfx,
  onDoorOpened,
}: {
  playDoorOpenSfx: () => void;
  onDoorOpened?: (xMap: number, yMap: number) => void;
}) {
  const pendingDoors: PendingDoor[] = [];

  function requestOpenDoor(xMap: number, yMap: number) {
    if (!isDoorCell(xMap, yMap)) return;
    if (pendingDoors.some((d) => d.x === xMap && d.y === yMap)) return;
    pendingDoors.push({ x: xMap, y: yMap, openRemainingMs: 320 });
  }

  function interactWorld(x: number, y: number) {
    const xMap = Math.floor(x);
    const yMap = Math.floor(y);
    if (isDoorCell(xMap, yMap)) requestOpenDoor(xMap, yMap);
  }

  function tick(dt: number) {
    if (!pendingDoors.length) return;
    const stepMs = dt * 1000;
    for (let i = pendingDoors.length - 1; i >= 0; i--) {
      const d = pendingDoors[i];
      d.openRemainingMs -= stepMs;
      if (d.openRemainingMs > 0) continue;

      setCell(d.x, d.y, 0);
      playDoorOpenSfx();
      onDoorOpened?.(d.x, d.y);
      pendingDoors.splice(i, 1);
    }
  }

  return {
    requestOpenDoor,
    interactWorld,
    tick,
  };
}
