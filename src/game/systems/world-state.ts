export type WorldStateSnapshot = {
  states: Set<string>;
  flags: Record<string, boolean>;
};

export type WorldStateConfig = {
  initialStates?: string[];
  flags?: Record<string, boolean>;
};

export function createWorldStateSystem() {
  let states = new Set<string>();
  let flags: Record<string, boolean> = {};

  let onChanged: (() => void) | null = null;

  function setOnChanged(cb: (() => void) | null) {
    onChanged = cb;
  }

  function onMapChanged() {
    states = new Set();
    flags = {};
    onChanged?.();
  }

  function setConfig(cfg: WorldStateConfig | null | undefined) {
    states = new Set(Array.isArray(cfg?.initialStates) ? cfg!.initialStates!.filter((s) => typeof s === 'string') : []);
    flags = { ...(cfg?.flags ?? {}) };
    onChanged?.();
  }

  function hasState(state: string): boolean {
    return states.has(state);
  }

  function setState(state: string, value: boolean) {
    const before = states.has(state);
    if (value) states.add(state);
    else states.delete(state);
    if (before !== value) onChanged?.();
  }

  function toggleState(state: string) {
    setState(state, !states.has(state));
  }

  function getFlag(flag: string): boolean {
    return !!flags[flag];
  }

  function setFlag(flag: string, value: boolean) {
    const before = !!flags[flag];
    flags[flag] = value;
    if (before !== value) onChanged?.();
  }

  function toggleFlag(flag: string) {
    setFlag(flag, !getFlag(flag));
  }

  function getSnapshot(): WorldStateSnapshot {
    return { states: new Set(states), flags: { ...flags } };
  }

  function isEnabled(opts?: {
    enabledInStates?: string[];
    disabledInStates?: string[];
    enabledIfFlags?: Record<string, boolean>;
  }): boolean {
    if (!opts) return true;

    const enabledInStates = opts.enabledInStates;
    if (Array.isArray(enabledInStates) && enabledInStates.length) {
      for (const s of enabledInStates) {
        if (!states.has(s)) return false;
      }
    }

    const disabledInStates = opts.disabledInStates;
    if (Array.isArray(disabledInStates) && disabledInStates.length) {
      for (const s of disabledInStates) {
        if (states.has(s)) return false;
      }
    }

    const enabledIfFlags = opts.enabledIfFlags;
    if (enabledIfFlags && typeof enabledIfFlags === 'object') {
      for (const [k, v] of Object.entries(enabledIfFlags)) {
        if (!!flags[k] !== v) return false;
      }
    }

    return true;
  }

  return {
    setOnChanged,
    onMapChanged,
    setConfig,
    hasState,
    setState,
    toggleState,
    getFlag,
    setFlag,
    toggleFlag,
    getSnapshot,
    isEnabled,
  };
}
