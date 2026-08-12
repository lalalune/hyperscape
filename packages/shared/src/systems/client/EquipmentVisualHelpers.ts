import { getItem } from "../../data/items";
import { getArrowVisual } from "../../data/spell-visuals";
import type { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";
import * as THREE from "three";
import {
  createArrowVisualInstance,
  disposeArrowVisualInstance,
  updateArrowVisualColors,
} from "./ArrowVisualHelpers";

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
  duelFit?: DuelEquipmentFitData;
  bowString?: DynamicBowStringData;
  stableHeldPose?: StableHeldPoseData;
}

export interface DynamicBowStringData {
  schemaVersion: 1;
  contentNodeName: string;
  upperTip: number[];
  lowerTip: number[];
  restNock: number[];
}

export interface StableHeldPoseData {
  schemaVersion: 1;
  wrapperNodeName: string;
  /** Fixed orientation relative to the avatar root, independent of wrist roll. */
  avatarLocalEulerDegrees: number[];
}

/**
 * Immutable approval metadata written by the offline fitting pipeline.
 * Runtime loading alone cannot prove that a generated mesh fits a particular
 * avatar, so competitive equipment must name the exact approved avatar set.
 */
export interface DuelEquipmentFitData {
  schemaVersion: 1;
  itemId: string;
  slot: string;
  compatibleAvatarIds: string[];
  /** Required for deforming equipment; derived from the canonical rest rig. */
  rigFingerprint?: string;
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

export interface HeldEquipmentVisualState {
  emote?: unknown;
  abbreviatedEmote?: unknown;
  deathState?: unknown;
}

/**
 * Held rigid equipment is intentionally hidden while the death and two-hand
 * victory poses play. Those clips put the wrist in the ground or above the
 * face, so keeping long weapons attached produces obvious penetration. Armor
 * remains visible; only hand-held visuals use this policy.
 */
export function shouldRenderHeldEquipmentVisual(
  state: HeldEquipmentVisualState,
): boolean {
  return !(
    state.deathState === "dying" ||
    state.deathState === "dead" ||
    state.emote === "death" ||
    state.abbreviatedEmote === "death" ||
    state.emote === "victory" ||
    state.abbreviatedEmote === "victory"
  );
}

export type StreamingEquipmentVisualValidationReason =
  | "missing_skinned_mesh"
  | "invalid_skinned_mesh"
  | "incompatible_skeleton"
  | "missing_fitted_attachment"
  | "invalid_fitted_attachment"
  | "invalid_attachment_bone"
  | "missing_fit_metadata"
  | "invalid_fit_metadata"
  | "fit_item_mismatch"
  | "fit_slot_mismatch"
  | "incompatible_avatar"
  | "invalid_dynamic_bow_string"
  | "invalid_stable_held_pose"
  | "unsupported_visible_slot";

export type StreamingEquipmentVisualValidation =
  | { valid: true; reason: null }
  | { valid: false; reason: StreamingEquipmentVisualValidationReason };

const COMPETITIVE_ASSET_ID_PATTERN = /^[a-zA-Z0-9_-]+$/u;
const RIG_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;

function finiteVector3(value: unknown): value is [number, number, number] {
  return Boolean(
    Array.isArray(value) &&
    value.length === 3 &&
    value.every(
      (component) =>
        typeof component === "number" && Number.isFinite(component),
    ),
  );
}

export function hasValidDynamicBowString(
  root: THREE.Object3D,
  attachmentData: EquipmentAttachmentData | undefined,
): boolean {
  const bowString = attachmentData?.bowString;
  return Boolean(
    bowString?.schemaVersion === 1 &&
    typeof bowString.contentNodeName === "string" &&
    bowString.contentNodeName.length > 0 &&
    finiteVector3(bowString.upperTip) &&
    finiteVector3(bowString.lowerTip) &&
    finiteVector3(bowString.restNock) &&
    root.getObjectByName(bowString.contentNodeName),
  );
}

export function hasValidStableHeldPose(
  root: THREE.Object3D,
  attachmentData: EquipmentAttachmentData | undefined,
): boolean {
  const stablePose = attachmentData?.stableHeldPose;
  return Boolean(
    stablePose?.schemaVersion === 1 &&
    typeof stablePose.wrapperNodeName === "string" &&
    stablePose.wrapperNodeName.length > 0 &&
    finiteVector3(stablePose.avatarLocalEulerDegrees) &&
    stablePose.avatarLocalEulerDegrees.every(
      (degrees) => Math.abs(degrees) <= 180,
    ) &&
    root.getObjectByName(stablePose.wrapperNodeName),
  );
}

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
  const rootAttachment = root.userData.hyperia as
    EquipmentAttachmentData | undefined;

  if (rootAttachment) {
    return rootAttachment;
  }

  return root.children[0]?.userData?.hyperia as
    EquipmentAttachmentData | undefined;
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

function getSkinnedMeshes(root: THREE.Object3D): THREE.SkinnedMesh[] {
  const meshes: THREE.SkinnedMesh[] = [];
  root.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh) meshes.push(child);
  });
  return meshes;
}

function hasUsableSkinningData(mesh: THREE.SkinnedMesh): boolean {
  const position = mesh.geometry.getAttribute("position");
  const skinIndex = mesh.geometry.getAttribute("skinIndex");
  const skinWeight = mesh.geometry.getAttribute("skinWeight");
  return Boolean(
    position?.count &&
    skinIndex?.count === position.count &&
    skinWeight?.count === position.count &&
    mesh.skeleton.bones.length > 0 &&
    mesh.skeleton.boneInverses.length === mesh.skeleton.bones.length,
  );
}

function boneParentName(bone: THREE.Bone): string | null {
  return bone.parent instanceof THREE.Bone ? bone.parent.name : null;
}

function matricesApproximatelyEqual(
  left: THREE.Matrix4,
  right: THREE.Matrix4,
  tolerance = 0.001,
): boolean {
  return left.elements.every(
    (value, index) => Math.abs(value - right.elements[index]) <= tolerance,
  );
}

/**
 * A skinned armor export is reusable only when it was bound to the same
 * ordered skeleton and inverse bind pose as the live avatar. Replacing its
 * skeleton without this check can load successfully while deforming or
 * exploding as soon as an animation begins.
 */
export function isSkinnedEquipmentSkeletonCompatible(
  root: THREE.Object3D,
  vrm: VRM,
): boolean {
  const playerSkeleton = getPlayerSkeleton(vrm);
  if (!playerSkeleton) return false;

  return getSkinnedMeshes(root).every((mesh) => {
    const sourceSkeleton = mesh.skeleton;
    if (
      sourceSkeleton.bones.length !== playerSkeleton.bones.length ||
      sourceSkeleton.boneInverses.length !== playerSkeleton.boneInverses.length
    ) {
      return false;
    }

    return sourceSkeleton.bones.every((bone, index) => {
      const targetBone = playerSkeleton.bones[index];
      return (
        bone.name === targetBone.name &&
        boneParentName(bone) === boneParentName(targetBone) &&
        matricesApproximatelyEqual(
          sourceSkeleton.boneInverses[index],
          playerSkeleton.boneInverses[index],
        )
      );
    });
  });
}

function hasValidAttachmentMatrix(
  attachmentData: EquipmentAttachmentData | undefined,
): attachmentData is EquipmentAttachmentData & {
  version: 2;
  relativeMatrix: number[];
} {
  return Boolean(
    attachmentData?.version === 2 &&
    Array.isArray(attachmentData.relativeMatrix) &&
    attachmentData.relativeMatrix.length === 16 &&
    attachmentData.relativeMatrix.every(
      (value) => typeof value === "number" && Number.isFinite(value),
    ),
  );
}

/**
 * Validate the structural contract needed for a truthful competitive avatar.
 * Loading an arbitrary GLB is insufficient: deforming equipment needs skin
 * weights, while rigid equipment needs an authored v2 bone attachment.
 */
export function validateStreamingEquipmentVisualModel(
  root: THREE.Object3D,
  slot: string,
  options: {
    itemId?: string;
    avatarId?: string;
    vrm?: VRM;
  } = {},
): StreamingEquipmentVisualValidation {
  const slotKey = slot.toLowerCase();
  const attachmentData = extractEquipmentAttachmentData(root);
  const fit = attachmentData?.duelFit;
  if (!fit) {
    return { valid: false, reason: "missing_fit_metadata" };
  }
  if (
    fit.schemaVersion !== 1 ||
    typeof fit.itemId !== "string" ||
    fit.itemId !== fit.itemId.trim() ||
    !COMPETITIVE_ASSET_ID_PATTERN.test(fit.itemId) ||
    typeof fit.slot !== "string" ||
    fit.slot !== slotKey ||
    !COMPETITIVE_ASSET_ID_PATTERN.test(fit.slot) ||
    !Array.isArray(fit.compatibleAvatarIds) ||
    fit.compatibleAvatarIds.length === 0 ||
    fit.compatibleAvatarIds.some(
      (avatarId) =>
        typeof avatarId !== "string" ||
        avatarId !== avatarId.trim() ||
        !COMPETITIVE_ASSET_ID_PATTERN.test(avatarId),
    ) ||
    new Set(fit.compatibleAvatarIds).size !== fit.compatibleAvatarIds.length
  ) {
    return { valid: false, reason: "invalid_fit_metadata" };
  }
  if (options.itemId && fit.itemId !== options.itemId) {
    return { valid: false, reason: "fit_item_mismatch" };
  }
  if (fit.slot.toLowerCase() !== slotKey) {
    return { valid: false, reason: "fit_slot_mismatch" };
  }
  if (options.avatarId && !fit.compatibleAvatarIds.includes(options.avatarId)) {
    return { valid: false, reason: "incompatible_avatar" };
  }

  const usesDeformingSkin =
    ["body", "legs", "boots", "gloves", "cape"].includes(slotKey) ||
    (slotKey === "helmet" && hasSkinnedMesh(root));
  if (usesDeformingSkin) {
    if (!hasSkinnedMesh(root)) {
      return { valid: false, reason: "missing_skinned_mesh" };
    }
    if (
      typeof fit.rigFingerprint !== "string" ||
      !RIG_FINGERPRINT_PATTERN.test(fit.rigFingerprint) ||
      !getSkinnedMeshes(root).every(hasUsableSkinningData)
    ) {
      return { valid: false, reason: "invalid_skinned_mesh" };
    }
    if (
      options.vrm &&
      !isSkinnedEquipmentSkeletonCompatible(root, options.vrm)
    ) {
      return { valid: false, reason: "incompatible_skeleton" };
    }
    return { valid: true, reason: null };
  }

  const allowedBones =
    slotKey === "weapon"
      ? new Set(["leftHand", "rightHand"])
      : slotKey === "shield"
        ? new Set(["leftHand"])
        : slotKey === "helmet"
          ? new Set(["head"])
          : null;
  if (!allowedBones) {
    return { valid: false, reason: "unsupported_visible_slot" };
  }

  if (!attachmentData) {
    return { valid: false, reason: "missing_fitted_attachment" };
  }
  if (!hasValidAttachmentMatrix(attachmentData)) {
    return { valid: false, reason: "invalid_fitted_attachment" };
  }
  if (!allowedBones.has(attachmentData.vrmBoneName)) {
    return { valid: false, reason: "invalid_attachment_bone" };
  }
  if (
    attachmentData.weaponType?.toLowerCase() === "bow" &&
    !hasValidDynamicBowString(root, attachmentData)
  ) {
    return { valid: false, reason: "invalid_dynamic_bow_string" };
  }
  if (
    attachmentData.weaponType?.toLowerCase() === "staff" &&
    !hasValidStableHeldPose(root, attachmentData)
  ) {
    return { valid: false, reason: "invalid_stable_held_pose" };
  }
  return { valid: true, reason: null };
}

export interface StableHeldEquipmentPoseController {
  wrapper: THREE.Object3D;
  update(): void;
  dispose(): void;
}

/**
 * Keep a long rigid weapon at an authored avatar-local orientation while its
 * fitted grip continues to follow the animated hand. This cancels wrist roll
 * without changing the certified attachment position or the avatar animation.
 */
export function createStableHeldEquipmentPoseController(options: {
  modelRoot: THREE.Object3D;
  vrm: VRM;
  avatarRoot?: THREE.Object3D;
}): StableHeldEquipmentPoseController | null {
  const attachmentData = extractEquipmentAttachmentData(options.modelRoot);
  const stablePose = attachmentData?.stableHeldPose;
  if (
    !stablePose ||
    !hasValidStableHeldPose(options.modelRoot, attachmentData)
  ) {
    return null;
  }
  const wrapper = options.modelRoot.getObjectByName(
    stablePose.wrapperNodeName,
  )!;
  const avatarRoot = options.avatarRoot ?? options.vrm.scene;
  const originalQuaternion = wrapper.quaternion.clone();
  const desiredAvatarQuaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      ...(stablePose.avatarLocalEulerDegrees.map(THREE.MathUtils.degToRad) as [
        number,
        number,
        number,
      ]),
      "XYZ",
    ),
  );
  const avatarWorldQuaternion = new THREE.Quaternion();
  const parentWorldQuaternion = new THREE.Quaternion();
  const desiredWorldQuaternion = new THREE.Quaternion();

  const update = () => {
    const parent = wrapper.parent;
    if (!parent) return;
    avatarRoot.updateWorldMatrix(true, false);
    parent.updateWorldMatrix(true, false);
    avatarRoot.getWorldQuaternion(avatarWorldQuaternion);
    parent.getWorldQuaternion(parentWorldQuaternion);
    desiredWorldQuaternion
      .copy(avatarWorldQuaternion)
      .multiply(desiredAvatarQuaternion);
    wrapper.quaternion
      .copy(parentWorldQuaternion)
      .invert()
      .multiply(desiredWorldQuaternion)
      .normalize();
    wrapper.updateWorldMatrix(false, true);
  };

  const renderHookTargets: THREE.Mesh[] = [];
  options.modelRoot.traverse((object) => {
    if (renderHookTargets.length === 0 && object instanceof THREE.Mesh) {
      renderHookTargets.push(object);
    }
  });
  const renderHookTarget = renderHookTargets[0];
  const originalOnBeforeRender = renderHookTarget?.onBeforeRender;
  const renderHook: THREE.Object3D["onBeforeRender"] = function (
    this: THREE.Object3D,
    ...args
  ) {
    update();
    originalOnBeforeRender?.apply(this, args);
  };
  if (renderHookTarget) renderHookTarget.onBeforeRender = renderHook;
  update();

  return {
    wrapper,
    update,
    dispose: () => {
      if (renderHookTarget?.onBeforeRender === renderHook) {
        renderHookTarget.onBeforeRender = originalOnBeforeRender ?? (() => {});
      }
      wrapper.quaternion.copy(originalQuaternion);
      wrapper.updateWorldMatrix(false, true);
    },
  };
}

export interface DynamicBowStringController {
  line: THREE.Line;
  nockedArrow: THREE.Group;
  scheduleRelease(delayMs: number, arrowId?: string): boolean;
  cancelRelease(): void;
  update(): void;
  dispose(): void;
}

export type DynamicBowStringTransition =
  | {
      kind: "scheduled";
      performanceTimeMs: number;
      releaseAtPerformanceTimeMs: number;
    }
  | {
      kind: "released";
      performanceTimeMs: number;
      lastVisibleNockWorldPosition: [number, number, number] | null;
      drawHandWorldPosition: [number, number, number];
    }
  | {
      kind: "cancelled";
      performanceTimeMs: number;
    };

/**
 * Rebuild a bowstring from the frozen fitted tip points and move only its nock
 * to the authoritative draw hand. `onBeforeRender` keeps it synchronized after
 * the avatar mixer updates, without adding a frame of visible lag.
 */
export function createDynamicBowStringController(options: {
  modelRoot: THREE.Object3D;
  vrm: VRM;
  getState: () => HeldEquipmentVisualState;
  now?: () => number;
  onTransition?: (transition: DynamicBowStringTransition) => void;
}): DynamicBowStringController | null {
  const attachmentData = extractEquipmentAttachmentData(options.modelRoot);
  const bowString = attachmentData?.bowString;
  if (
    !bowString ||
    !hasValidDynamicBowString(options.modelRoot, attachmentData)
  ) {
    return null;
  }
  const content = options.modelRoot.getObjectByName(bowString.contentNodeName)!;
  const drawHand = options.vrm.humanoid?.getRawBoneNode("rightHand");
  if (!drawHand) return null;

  const positions = new Float32Array(9);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0x3a271d,
    toneMapped: true,
  });
  const line = new THREE.Line(geometry, material);
  line.name = "DynamicBowString";
  line.frustumCulled = false;
  line.renderOrder = 102;

  const arrowVisual = createArrowVisualInstance(getArrowVisual("default"));
  const nockedArrow = arrowVisual.group;
  nockedArrow.name = "NockedArrow";
  nockedArrow.visible = false;
  const arrowParent = options.vrm.scene ?? options.modelRoot;
  arrowParent.add(nockedArrow);

  const upper = new THREE.Vector3(
    ...(bowString.upperTip as [number, number, number]),
  );
  const lower = new THREE.Vector3(
    ...(bowString.lowerTip as [number, number, number]),
  );
  const rest = new THREE.Vector3(
    ...(bowString.restNock as [number, number, number]),
  );
  const drawWorld = new THREE.Vector3();
  const nock = new THREE.Vector3();
  const restWorld = new THREE.Vector3();
  const drawInAvatar = new THREE.Vector3();
  const restInAvatar = new THREE.Vector3();
  const arrowDirection = new THREE.Vector3();
  const arrowForward = new THREE.Vector3(0, 0, 1);
  const lastVisibleNockWorld = new THREE.Vector3();
  const releaseHandWorld = new THREE.Vector3();
  const now = options.now ?? (() => performance.now());
  let scheduledReleaseAt: number | null = null;
  let forceReleased = false;
  let wasDrawing = false;
  let hasVisibleNockSample = false;
  let releaseReported = false;

  const emitTransition = (transition: DynamicBowStringTransition): void => {
    try {
      options.onTransition?.(transition);
    } catch {
      // Diagnostics must never interrupt the render-synchronized bow path.
    }
  };

  const isWeaponVisible = (): boolean => {
    let current: THREE.Object3D | null = options.modelRoot;
    while (current && current !== arrowParent) {
      if (!current.visible) return false;
      current = current.parent;
    }
    return true;
  };

  const update = () => {
    const state = options.getState();
    const rawDrawing =
      state.emote === "range" || state.abbreviatedEmote === "range";
    const nowMs = now();
    if (!rawDrawing && wasDrawing) {
      scheduledReleaseAt = null;
      forceReleased = false;
    } else if (
      rawDrawing &&
      !wasDrawing &&
      scheduledReleaseAt !== null &&
      scheduledReleaseAt < nowMs
    ) {
      // A stale delayed event from a preceding animation cannot suppress the
      // first frame of a new draw.
      scheduledReleaseAt = null;
      forceReleased = false;
    }
    const released =
      forceReleased ||
      (scheduledReleaseAt !== null && nowMs >= scheduledReleaseAt);
    if (released && scheduledReleaseAt !== null && !releaseReported) {
      drawHand.getWorldPosition(releaseHandWorld);
      emitTransition({
        kind: "released",
        performanceTimeMs: nowMs,
        lastVisibleNockWorldPosition: hasVisibleNockSample
          ? [
              lastVisibleNockWorld.x,
              lastVisibleNockWorld.y,
              lastVisibleNockWorld.z,
            ]
          : null,
        drawHandWorldPosition: [
          releaseHandWorld.x,
          releaseHandWorld.y,
          releaseHandWorld.z,
        ],
      });
      releaseReported = true;
    }
    const drawing =
      rawDrawing &&
      !released &&
      shouldRenderHeldEquipmentVisual(state) &&
      isWeaponVisible();

    if (drawing) {
      drawHand.getWorldPosition(drawWorld);
      content.updateWorldMatrix(true, false);
      nock.copy(drawWorld);
      content.worldToLocal(nock);
    } else {
      nock.copy(rest);
    }
    positions.set(upper.toArray(), 0);
    positions.set(nock.toArray(), 3);
    positions.set(lower.toArray(), 6);
    geometry.getAttribute("position").needsUpdate = true;
    geometry.computeBoundingSphere();

    nockedArrow.visible = false;
    if (drawing) {
      arrowParent.updateWorldMatrix(true, false);
      content.updateWorldMatrix(true, false);
      drawInAvatar.copy(drawWorld);
      arrowParent.worldToLocal(drawInAvatar);
      restWorld.copy(rest);
      content.localToWorld(restWorld);
      restInAvatar.copy(restWorld);
      arrowParent.worldToLocal(restInAvatar);
      arrowDirection.copy(restInAvatar).sub(drawInAvatar);
      if (arrowDirection.lengthSq() > 1e-8) {
        arrowDirection.normalize();
        nockedArrow.position.copy(drawInAvatar);
        nockedArrow.quaternion.setFromUnitVectors(arrowForward, arrowDirection);
        nockedArrow.visible = true;
        nockedArrow.getWorldPosition(lastVisibleNockWorld);
        hasVisibleNockSample = true;
      }
    }
    wasDrawing = rawDrawing;
  };
  const scheduleRelease = (delayMs: number, arrowId?: string): boolean => {
    if (
      !Number.isFinite(delayMs) ||
      delayMs < 0 ||
      delayMs > 5_000 ||
      (arrowId !== undefined &&
        (typeof arrowId !== "string" || arrowId.length > 128))
    ) {
      return false;
    }
    if (arrowId) {
      updateArrowVisualColors(arrowVisual, getArrowVisual(arrowId));
    }
    const scheduledAt = now();
    scheduledReleaseAt = scheduledAt + delayMs;
    forceReleased = false;
    releaseReported = false;
    emitTransition({
      kind: "scheduled",
      performanceTimeMs: scheduledAt,
      releaseAtPerformanceTimeMs: scheduledReleaseAt,
    });
    update();
    return true;
  };
  const cancelRelease = () => {
    if (scheduledReleaseAt !== null && !releaseReported) {
      emitTransition({ kind: "cancelled", performanceTimeMs: now() });
    }
    scheduledReleaseAt = null;
    forceReleased = true;
    releaseReported = false;
    update();
  };
  const dispose = () => {
    line.removeFromParent();
    line.onBeforeRender = () => undefined;
    nockedArrow.onBeforeRender = () => undefined;
    geometry.dispose();
    material.dispose();
    disposeArrowVisualInstance(arrowVisual);
  };
  line.onBeforeRender = () => update();
  content.add(line);
  update();
  return {
    line,
    nockedArrow,
    scheduleRelease,
    cancelRelease,
    update,
    dispose,
  };
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

  const skinnedSlots = ["helmet", "body", "legs", "boots", "gloves", "cape"];
  const isSkinnedSlot = skinnedSlots.includes(slotKey);

  if (isSkinnedSlot && hasSkinnedMesh(modelRoot)) {
    const playerSkeleton = getPlayerSkeleton(vrm);
    if (
      !playerSkeleton ||
      !isSkinnedEquipmentSkeletonCompatible(modelRoot, vrm)
    ) {
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

  const hasValidMatrix = hasValidAttachmentMatrix(attachmentData);

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
