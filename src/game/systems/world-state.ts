export type WorldStateSnapshot = {
  states: Set<string>;
  flags: Record<string, boolean>;
};

export type WorldStateConfig = {
  initialStates?: string[];
  flags?: Record<string, boolean>;
};

/**
 * Canonical narrative "perception states" — the player's lens on reality.
 * These gate hallucination entities, hidden geometry, light moods, music etc.
 *
 * - `medicated`  : haloperidol active; hallucinations suppressed, world stable.
 * - `withdrawal` : off meds; hallucinations on, hidden geometry visible.
 * - `infected`   : first contact with the entity; predator senses appear.
 * - `nightmare`  : reality unstable; surreal layouts, looping geometry.
 * - `predator`   : GG fully transformed; hunter mode.
 *
 * `medicated` and `withdrawal` are mutually exclusive (use `setMedication`).
 * The other three are independent progression stages that can layer.
 */
export const PERCEPTION_STATES = [
  'medicated',
  'withdrawal',
  'infected',
  'nightmare',
  'predator',
] as const;
export type PerceptionState = (typeof PERCEPTION_STATES)[number];

export function isPerceptionState(s: string): s is PerceptionState {
  return (PERCEPTION_STATES as readonly string[]).includes(s);
}

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
    states = new Set(
      Array.isArray(cfg?.initialStates)
        ? cfg!.initialStates!.filter((s) => typeof s === 'string')
        : [],
    );
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

  /**
   * Mutually exclusive medication flip:
   *   on  -> `medicated` set, `withdrawal` cleared
   *   off -> `withdrawal` set, `medicated` cleared
   *
   * Other perception stages (`infected`/`nightmare`/`predator`) are not
   * touched here; they progress independently via `setState`.
   */
  function setMedication(on: boolean) {
    const wantMed = on;
    const wantWith = !on;
    const hadMed = states.has('medicated');
    const hadWith = states.has('withdrawal');
    if (wantMed) states.add('medicated');
    else states.delete('medicated');
    if (wantWith) states.add('withdrawal');
    else states.delete('withdrawal');
    if (hadMed !== wantMed || hadWith !== wantWith) onChanged?.();
  }

  /** Returns the perception stages currently active, in canonical order. */
  function getPerceptionStages(): PerceptionState[] {
    const out: PerceptionState[] = [];
    for (const ps of PERCEPTION_STATES) {
      if (states.has(ps)) out.push(ps);
    }
    return out;
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
    setMedication,
    getPerceptionStages,
    getSnapshot,
    isEnabled,
  };
}
