import { getItem } from "../../data/items";
import type { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";
import * as THREE from "three";

export interface EquipmentAttachmentData {
  vrmBoneName: string;
  originalSlot?: string;
  weaponType?: string;
  usage?: string;
  note?: string;
  version?: number;
  relativeMatrix?: number[];
  avatarId?: string;
  avatarHeight?: number;
}

export interface EquipmentVisualModelData {
  equippedModelPath?: string | null;
  modelPath?: string | null;
}

export interface EquipmentVisualUrlResolution {
  primaryUrl: string;
  fallbackUrl: string | null;
}

export interface EquipmentVisualStore {
  [slot: string]: THREE.Object3D | undefined;
}

const EQUIPMENT_MODEL_FALLBACKS: Readonly<Record<string, string>> =
  Object.freeze({
    iron_arrow: "asset://models/arrows/arrows-bronze/arrows-bronze.glb",
    steel_arrow: "asset://models/arrows/arrows-bronze/arrows-bronze.glb",
    mithril_arrow: "asset://models/arrows/arrows-bronze/arrows-bronze.glb",
    adamant_arrow: "asset://models/arrows/arrows-bronze/arrows-bronze.glb",
    rune_arrow: "asset://models/arrows/arrows-bronze/arrows-bronze.glb",
  });

export function removeEquipmentVisual(
  store: EquipmentVisualStore,
  slot: string,
): void {
  const slotKey = slot.toLowerCase();
  const existingVisual = store[slotKey];

  if (existingVisual?.parent) {
    existingVisual.parent.remove(existingVisual);
  }

  store[slotKey] = undefined;
}

export function extractEquipmentAttachmentData(
  root: THREE.Object3D,
): EquipmentAttachmentData | undefined {
  const rootAttachment = root.userData.hyperscape as
    | EquipmentAttachmentData
    | undefined;

  if (rootAttachment) {
    return rootAttachment;
  }

  return root.children[0]?.userData?.hyperscape as
    | EquipmentAttachmentData
    | undefined;
}

export function resolveEquipmentVisualUrls(options: {
  assetsUrl: string;
  itemId: string;
  slot: string;
  itemData?: EquipmentVisualModelData | null;
  fallbackItemData?: EquipmentVisualModelData | null;
}): EquipmentVisualUrlResolution | null {
  const { assetsUrl, itemId, slot, itemData, fallbackItemData } = options;

  let equippedModelPath = itemData?.equippedModelPath;
  let modelPath = itemData?.modelPath;
  const explicitlyModelLess =
    itemData?.equippedModelPath === null ||
    itemData?.modelPath === null ||
    fallbackItemData?.equippedModelPath === null ||
    fallbackItemData?.modelPath === null;

  if (equippedModelPath === null) {
    return null;
  }

  if (!equippedModelPath) {
    if (fallbackItemData?.equippedModelPath) {
      equippedModelPath = fallbackItemData.equippedModelPath;
    }
    if (!modelPath && fallbackItemData?.modelPath) {
      modelPath = fallbackItemData.modelPath;
    }
  }

  if (equippedModelPath) {
    return {
      primaryUrl: equippedModelPath.replace("asset://", `${assetsUrl}/`),
      fallbackUrl: null,
    };
  }

  if (modelPath && typeof modelPath === "string") {
    return {
      primaryUrl: modelPath.replace("asset://", `${assetsUrl}/`),
      fallbackUrl: null,
    };
  }

  if (explicitlyModelLess) {
    const fallbackAssetPath = EQUIPMENT_MODEL_FALLBACKS[itemId];
    if (!fallbackAssetPath) {
      return null;
    }
    return {
      primaryUrl: fallbackAssetPath.replace("asset://", `${assetsUrl}/`),
      fallbackUrl: null,
    };
  }

  const parts = itemId.split("_");
  let assetId = itemId.replace(/_/g, "-");
  let category = "";

  const materials = [
    "bronze",
    "steel",
    "mithril",
    "iron",
    "rune",
    "dragon",
    "wood",
    "oak",
    "willow",
    "yew",
  ];

  const categoryMap: Record<string, string> = {
    sword: "swords-old",
    longsword: "swords/long-swords",
    scimitar: "swords/scimitars",
    "2h_sword": "swords/2h-swords",
    "2h": "swords/2h-swords",
    shortsword: "swords/shortswords",
    dagger: "swords/daggers",
    hatchet: "hatchets",
    pickaxe: "pickaxes",
    arrow: "arrows",
    bow: "bows",
    staff: "magic-staffs",
    shield: "shields",
  };

  if (parts.length >= 2 && materials.includes(parts[0])) {
    const material = parts[0];
    const itemParts = parts.slice(1);
    const itemKey = itemParts.join("_");
    assetId = `${itemParts.join("-")}-${material}`;
    category = categoryMap[itemKey] || categoryMap[itemParts[0]] || "";
  }

  if (!category) {
    return null;
  }

  const prefix = `${category}/`;
  return {
    primaryUrl: `${assetsUrl}/models/${prefix}${assetId}-aligned.glb`,
    fallbackUrl: `${assetsUrl}/models/${prefix}${assetId}/${assetId}-aligned.glb`,
  };
}

export function resolveEquipmentVisualData(options: {
  itemId: string;
  fallbackItemData?: EquipmentVisualModelData | null;
}): EquipmentVisualModelData | null {
  const itemData = getItem(options.itemId);

  if (itemData) {
    return {
      equippedModelPath: itemData.equippedModelPath,
      modelPath: itemData.modelPath,
    };
  }

  return options.fallbackItemData ?? null;
}

/**
 * Zero metalness on all materials of a mesh.
 *
 * WORKAROUND: The game has no environment map (scene.environment = null), so
 * metallic PBR materials appear black — they derive color from reflections,
 * not diffuse light. Zero metalness to show base color.
 * TODO: Revert this when an environment map / IBL probe is added to the scene.
 */
function zeroMetalness(mesh: THREE.Mesh): void {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of mats) {
    if ("metalness" in mat) {
      (mat as THREE.MeshStandardMaterial).metalness = 0;
    }
  }
}

function hasSkinnedMesh(root: THREE.Object3D): boolean {
  let found = false;
  root.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh) {
      found = true;
    }
  });
  return found;
}

function getPlayerSkeleton(vrm: VRM): THREE.Skeleton | undefined {
  let playerSkeleton: THREE.Skeleton | undefined;

  vrm.scene.traverse((child) => {
    if (
      !playerSkeleton &&
      child instanceof THREE.SkinnedMesh &&
      child.skeleton
    ) {
      playerSkeleton = child.skeleton;
    }
  });

  return playerSkeleton;
}

function findTargetBone(
  vrm: VRM,
  avatarRoot: THREE.Object3D,
  boneName: string,
): THREE.Object3D | null {
  const prefabBone = vrm.humanoid?.getRawBoneNode(boneName as VRMHumanBoneName);
  if (!prefabBone) {
    return null;
  }

  const targetBoneName = prefabBone.name;
  let targetBone: THREE.Object3D | null = null;

  avatarRoot.traverse((child) => {
    if (!targetBone && child.name === targetBoneName) {
      targetBone = child;
    }
  });

  return targetBone;
}

export function attachEquipmentVisualToVRM(options: {
  slot: string;
  modelRoot: THREE.Object3D;
  visuals: EquipmentVisualStore;
  vrm: VRM;
  avatarRoot?: THREE.Object3D;
}): boolean {
  const { slot, modelRoot, visuals, vrm } = options;
  const slotKey = slot.toLowerCase();
  const avatarRoot = options.avatarRoot ?? vrm.scene;
  const attachmentData = extractEquipmentAttachmentData(modelRoot);
  const boneName = attachmentData?.vrmBoneName || "rightHand";

  const skinnedSlots = ["body", "legs", "boots", "gloves", "cape"];
  const isSkinnedSlot = skinnedSlots.includes(slotKey);

  if (isSkinnedSlot && hasSkinnedMesh(modelRoot)) {
    const playerSkeleton = getPlayerSkeleton(vrm);
    if (!playerSkeleton) {
      return false;
    }

    modelRoot.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh) {
        child.skeleton = playerSkeleton;
        child.bind(playerSkeleton, child.bindMatrix);
        // Must match player body renderOrder (100) so equipment renders
        // on top of the silhouette (renderOrder 50), not underneath it.
        child.renderOrder = 100;
        zeroMetalness(child);
      }
    });

    removeEquipmentVisual(visuals, slot);
    visuals[slotKey] = modelRoot;
    vrm.scene.add(modelRoot);
    return true;
  }

  const targetBone = findTargetBone(vrm, avatarRoot, boneName);
  if (!targetBone) {
    return false;
  }

  removeEquipmentVisual(visuals, slot);

  // Set renderOrder on all meshes so equipment renders on top of the
  // player silhouette (renderOrder 50), matching player body (100).
  modelRoot.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.renderOrder = 100;
      zeroMetalness(child);
    }
  });

  const hasValidMatrix =
    attachmentData?.version === 2 &&
    Array.isArray(attachmentData.relativeMatrix) &&
    attachmentData.relativeMatrix.length === 16 &&
    attachmentData.relativeMatrix.every(
      (value) => typeof value === "number" && !Number.isNaN(value),
    );

  if (hasValidMatrix) {
    const equipmentWrapper = modelRoot.children.find(
      (child) => child.name === "EquipmentWrapper",
    );

    if (equipmentWrapper) {
      visuals[slotKey] = modelRoot;
      targetBone.add(modelRoot);
      return true;
    }

    const relativeMatrix = new THREE.Matrix4();
    // attachmentData and relativeMatrix are guaranteed non-null by hasValidMatrix guard above
    relativeMatrix.fromArray(attachmentData.relativeMatrix as number[]);

    const wrapperGroup = new THREE.Group();
    wrapperGroup.name = "EquipmentWrapper";

    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    relativeMatrix.decompose(position, quaternion, scale);

    wrapperGroup.position.copy(position);
    wrapperGroup.quaternion.copy(quaternion);
    wrapperGroup.scale.copy(scale);
    wrapperGroup.add(modelRoot);

    visuals[slotKey] = wrapperGroup;
    targetBone.add(wrapperGroup);
    return true;
  }

  const equipmentWrapper = modelRoot.children.find(
    (child) => child.name === "EquipmentWrapper",
  );

  if (equipmentWrapper) {
    const weaponScaleMultiplier = 1.75;
    modelRoot.scale.multiplyScalar(weaponScaleMultiplier);
  } else if (!attachmentData) {
    modelRoot.scale.set(0.01, 0.01, 0.01);
  }

  visuals[slotKey] = modelRoot;
  targetBone.add(modelRoot);
  return true;
}
