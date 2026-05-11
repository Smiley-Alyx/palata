import type { AudioManager } from '../audio/audio-manager';
import type { LevelTriggerJson } from '../levels/level-loader';

export function createTriggersSystem({
  audio,
  getPlayerPos,
  getMaterialsWall,
  setMaterialsWall,
  isEnabledByWorldState,
  setWorldState,
  toggleWorldState,
  setWorldFlag,
  toggleWorldFlag,
}: {
  audio: AudioManager;
  getPlayerPos: () => { x: number; y: number };
  getMaterialsWall: () => string[][] | null;
  setMaterialsWall: (rows: string[][] | null) => void;
  isEnabledByWorldState: (opts: {
    enabledInStates?: string[];
    disabledInStates?: string[];
    enabledIfFlags?: Record<string, boolean>;
  }) => boolean;
  setWorldState: (state: string, value: boolean) => void;
  toggleWorldState: (state: string) => void;
  setWorldFlag: (flag: string, value: boolean) => void;
  toggleWorldFlag: (flag: string) => void;
}) {
  type TriggerRuntime = {
    id: string;
    trigger: LevelTriggerJson['trigger'];
    actions: LevelTriggerJson['actions'];
    enabledInStates?: string[];
    disabledInStates?: string[];
    enabledIfFlags?: Record<string, boolean>;
    fired: boolean;
  };

  let triggers: TriggerRuntime[] = [];

  function setTriggers(next: LevelTriggerJson[]) {
    triggers = Array.isArray(next)
      ? next.map((t) => ({
          id: t.id,
          trigger: t.trigger,
          actions: t.actions,
          enabledInStates: t.enabledInStates,
          disabledInStates: t.disabledInStates,
          enabledIfFlags: t.enabledIfFlags,
          fired: false,
        }))
      : [];
  }

  function onMapChanged() {
    triggers = [];
  }

  function isInsideZone(z: { x: number; y: number; w: number; h: number }, p: { x: number; y: number }) {
    return p.x >= z.x && p.y >= z.y && p.x < z.x + z.w && p.y < z.y + z.h;
  }

  function applyAction(a: LevelTriggerJson['actions'][number]) {
    if (a.type === 'play_sound') {
      // For now, reuse the existing SfxKey keys; arbitrary src mapping can come later.
      // We accept any string but only play if it matches a known key.
      const key = a.sound as Parameters<AudioManager['playSfx']>[0];
      audio.playSfx(key, typeof a.volume === 'number' ? a.volume : 0.7);
      return;
    }

    if (a.type === 'change_wall_material') {
      const grid = getMaterialsWall();
      if (!grid || !grid.length || !grid[0]?.length) return;
      const x = Math.floor(a.x);
      const y = Math.floor(a.y);
      if (y < 0 || y >= grid.length) return;
      if (x < 0 || x >= (grid[0]?.length ?? 0)) return;

      const next = grid.map((row) => row.slice());
      next[y][x] = a.material;
      setMaterialsWall(next);
      return;
    }

    if (a.type === 'set_state') {
      setWorldState(a.state, a.value);
      return;
    }

    if (a.type === 'toggle_state') {
      toggleWorldState(a.state);
      return;
    }

    if (a.type === 'set_flag') {
      setWorldFlag(a.flag, a.value);
      return;
    }

    if (a.type === 'toggle_flag') {
      toggleWorldFlag(a.flag);
      return;
    }
  }

  function tick() {
    if (!triggers.length) return;

    const p = getPlayerPos();
    for (const t of triggers) {
      if (
        !isEnabledByWorldState({
          enabledInStates: t.enabledInStates,
          disabledInStates: t.disabledInStates,
          enabledIfFlags: t.enabledIfFlags,
        })
      ) {
        continue;
      }
      if (t.fired && t.trigger.once) continue;
      if (t.trigger.type !== 'enter_zone') continue;

      if (isInsideZone(t.trigger, p)) {
        for (const a of t.actions) {
          applyAction(a);
        }
        t.fired = true;
      } else {
        // Only allow re-fire when leaving and re-entering.
        if (!t.trigger.once) t.fired = false;
      }
    }
  }

  return {
    setTriggers,
    onMapChanged,
    tick,
  };
}
