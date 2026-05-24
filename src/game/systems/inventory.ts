export type InventoryItemId =
  | 'haloperidol'
  | 'injector'
  | 'document'
  | 'artifact';

export type InventorySnapshot = Readonly<Record<InventoryItemId, number>>;

const ITEM_IDS: readonly InventoryItemId[] = [
  'haloperidol',
  'injector',
  'document',
  'artifact',
];

export function createInventory() {
  const counts: Record<InventoryItemId, number> = {
    haloperidol: 0,
    injector: 0,
    document: 0,
    artifact: 0,
  };

  let onChanged: (() => void) | null = null;

  function setOnChanged(cb: (() => void) | null) {
    onChanged = cb;
  }

  function get(id: InventoryItemId): number {
    return counts[id] ?? 0;
  }

  function add(id: InventoryItemId, amount = 1): number {
    if (amount === 0) return counts[id];
    counts[id] = Math.max(0, (counts[id] ?? 0) + amount);
    onChanged?.();
    return counts[id];
  }

  function consume(id: InventoryItemId, amount = 1): boolean {
    if (amount <= 0) return true;
    if ((counts[id] ?? 0) < amount) return false;
    counts[id] -= amount;
    onChanged?.();
    return true;
  }

  function reset() {
    let changed = false;
    for (const id of ITEM_IDS) {
      if (counts[id] !== 0) {
        counts[id] = 0;
        changed = true;
      }
    }
    if (changed) onChanged?.();
  }

  function snapshot(): InventorySnapshot {
    return { ...counts };
  }

  return {
    setOnChanged,
    get,
    add,
    consume,
    reset,
    snapshot,
  };
}

export type Inventory = ReturnType<typeof createInventory>;
