/**
 * Material name -> DOM image id resolver.
 *
 * Levels declare cell semantics through their `legend` (e.g. `"1": "wall"`).
 * The engine then asks `getTextureForMaterial(<material name>)` to draw a
 * wall slice, sprite or floor/ceiling pattern. We map every supported
 * material name to a concrete DOM `<img>` id loaded by `index.html`.
 *
 * For the narrative-aligned content we use individual textures (no atlas
 * slicing). Numeric material ids are not used by current levels and are
 * therefore not supported anymore.
 */

const materialToDomId = new Map<string, string>([
  // --- Generic legend names used by the existing levels ---
  // (level1..level6 hospital theme uses these as defaults)
  ['wall', 'medical_tiles'],
  ['window', 'reinforced_window'],
  ['door', 'medical_door'],
  ['stand', 'hospital_wall_stripe'],

  // --- level0 (historical) extra names ---
  ['brick', 'concrete_tunnel'],
  ['stand1', 'hospital_wall_stripe'],
  ['stand2', 'hospital_wall_stripe'],
  ['stand3', 'hospital_wall_stripe'],
  ['gstand1', 'metal_panels'],
  ['gstand2', 'metal_panels'],

  // --- Direct narrative texture names (for materialsWall / change_wall_material) ---
  ['hospital_wall_stripe', 'hospital_wall_stripe'],
  ['medical_tiles', 'medical_tiles'],
  ['concrete_tunnel', 'concrete_tunnel'],
  ['metal_panels', 'metal_panels'],
  ['metal_emergency', 'metal_emergency'],
  ['organic_wall', 'organic_wall'],
  ['ventilation_shaft', 'ventilation_shaft'],
  ['flesh_wall', 'flesh_wall'],
  ['industrial_flesh', 'industrial_flesh'],
  ['medical_door', 'medical_door'],
  ['blast_door', 'blast_door'],
  ['reinforced_window', 'reinforced_window'],
  ['exit', 'exit'],
  ['key_door', 'keyDoor'],

  // --- Floor / ceiling materials (used by setBackgroundMaterials) ---
  ['seamless_floor', 'seamless_floor'],
  ['organic_floor', 'organic_floor'],
  ['seamless_ceiling', 'seamless_ceiling'],

  // --- Sprite materials (used by entities/pickups) ---
  ['enemy', 'enemy'],
  ['zombie', 'zombie'],
  ['skeleton_husk', 'skeleton_husk'],
  ['medical_orderly', 'medical_orderly'],
  ['deformed_patient', 'deformed_patient'],
  ['flesh_watcher', 'flesh_watcher'],
  ['doppelganger', 'doppelganger'],
  ['health', 'health'],
  ['keyGold', 'goldKey'],
  ['keySilver', 'silverKey'],
  ['keyBlood', 'bloodKey'],

  // --- Hallucination sprites (perception-gated by hallucinations system) ---
  ['hallucination_entity', 'hallucination_entity'],
  ['hallucination_white_observer', 'hallucination_white_observer'],

  // --- Item sprites (medication, ammo, documents) ---
  ['haloperidol', 'haloperidol'],
  ['injector', 'injector'],
]);

const cache = new Map<string, CanvasImageSource | null>();

function lookupByDomId(domId: string): CanvasImageSource | null {
  const cached = cache.get(domId);
  if (cached !== undefined) return cached;

  const el = document.getElementById(domId);
  const img = el instanceof HTMLImageElement ? el : null;

  // Don't cache `null` while the image is still loading: a follow-up call
  // after `naturalWidth` becomes non-zero must resolve to the real texture.
  if (img && img.naturalWidth <= 0) {
    return null;
  }

  cache.set(domId, img);
  return img;
}

export function getTextureForMaterial(materialOrId: string | number): CanvasImageSource | null {
  if (typeof materialOrId !== 'string') return null;

  const domId = materialToDomId.get(materialOrId);
  if (!domId) return null;

  return lookupByDomId(domId);
}
