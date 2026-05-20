import { getImage } from '../assets/loader';
import { getAnimatedFrame, hasAnimation } from './animations';

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
  ['skeleton_husk', 'skeleton_husk'],
  ['medical_orderly', 'medical_orderly'],
  ['deformed_patient', 'deformed_patient'],
  ['flesh_watcher', 'flesh_watcher'],
  ['flesh_eye', 'flesh_eye'],
  ['flesh_machine', 'flesh_machine'],
  ['doppelganger', 'doppelganger'],
  ['boss_chief_doctor', 'boss_chief_doctor'],
  ['boss_choir', 'boss_choir'],
  ['boss_dade_keeper', 'boss_dade_keeper'],
  ['boss_heart_hospital', 'boss_heart_hospital'],
  ['boss_shepherd', 'boss_shepherd'],
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
  ['ammo_pistol', 'ammo_pistol'],
  ['ammo_shotgun', 'ammo_shotgun'],

  // --- Artifact pickups ---
  ['artifact_hallucination', 'artifact_hallucination'],
  ['artifact_vhs', 'artifact_vhs'],
]);

const cache = new Map<string, CanvasImageSource | null>();

function lookupAsset(assetId: string): CanvasImageSource | null {
  const cached = cache.get(assetId);
  if (cached !== undefined) return cached;

  const img = getImage(assetId);

  // Don't cache while the image hasn't decoded yet: a follow-up call after
  // `naturalWidth` becomes non-zero must resolve to the real texture.
  if (img && img.naturalWidth <= 0) {
    return null;
  }

  cache.set(assetId, img);
  return img;
}

export function getTextureForMaterial(materialOrId: string | number): CanvasImageSource | null {
  if (typeof materialOrId !== 'string') return null;

  // Animation runtime takes precedence. Check by raw material name first
  // (e.g. "medical_door") and then by the mapped asset id (e.g. legend's
  // "door" -> "medical_door") so registrations work regardless of which key
  // a level uses. Single-frame anims and missing entries fall through to the
  // static manifest lookup below.
  if (hasAnimation(materialOrId)) {
    const frame = getAnimatedFrame(materialOrId);
    if (frame) return frame;
  }

  const assetId = materialToDomId.get(materialOrId);
  if (assetId && assetId !== materialOrId && hasAnimation(assetId)) {
    const frame = getAnimatedFrame(assetId);
    if (frame) return frame;
  }

  if (!assetId) return null;
  return lookupAsset(assetId);
}
