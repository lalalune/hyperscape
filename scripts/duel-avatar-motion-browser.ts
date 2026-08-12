import { VRMLoaderPlugin, type VRMHumanBoneName } from "@pixiv/three-vrm";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { createEmoteFactory } from "../packages/shared/src/extras/three/createEmoteFactory";
import { PlayerHitReactionController } from "../packages/shared/src/extras/three/PlayerHitReactionController";
import {
  attachEquipmentVisualToVRM,
  createDynamicBowStringController,
  createStableHeldEquipmentPoseController,
  extractEquipmentAttachmentData,
  shouldRenderHeldEquipmentVisual,
  validateStreamingEquipmentVisualModel,
} from "../packages/shared/src/systems/client/EquipmentVisualHelpers";

export interface DuelAvatarMotionDefinition {
  id: string;
  name: string;
  asset: string;
  sampleRatio: number;
  hitReaction?: {
    intensity: number;
    side: -1 | 1;
    elapsedSeconds: number;
  };
}

export interface DuelAvatarMotionAuditConfig {
  avatarAsset: string;
  avatarSha256: string;
  motions: DuelAvatarMotionDefinition[];
  equipment?: {
    asset: string;
    sha256: string;
    itemId: string;
    avatarId: string;
    slot: "weapon" | "shield";
    grip: "one-hand" | "two-hand";
  } | null;
}

interface EquipmentMotionResult {
  itemId: string;
  asset: string;
  metadataValid: boolean;
  metadataReason: string | null;
  attached: boolean;
  visible: boolean;
  weaponType: string | null;
  dynamicBowStringActive: boolean;
  stableHeldPoseActive: boolean;
  stablePoseDeviationDegrees: number | null;
  nockedArrowVisible: boolean;
  nockedArrowNockDistance: number | null;
  nockedArrowAimDeviationDegrees: number | null;
  attachmentBone: string | null;
  bounds: {
    width: number;
    height: number;
    depth: number;
    minimumY: number;
    maximumY: number;
  };
  rightHandNearestVertexDistance: number;
  leftHandNearestVertexDistance: number;
  headNearestVertexDistance: number;
  torsoNearestVertexDistance: number;
}

interface MotionResult {
  id: string;
  name: string;
  asset: string;
  durationSeconds: number;
  sampleSeconds: number;
  trackCount: number;
  targetBoneCount: number;
  changedBoneCount: number;
  maximumBoneDeltaDegrees: number;
  bounds: {
    width: number;
    height: number;
    depth: number;
    minimumY: number;
    maximumY: number;
  };
  rootDrift: number;
  equipment?: EquipmentMotionResult;
  failures: string[];
}

export interface DuelAvatarMotionBrowserReport {
  avatarAsset: string;
  avatarSha256: string;
  userAgent: string;
  renderer: string;
  motions: MotionResult[];
  failures: string[];
}

const REQUIRED_BODY_BONES: VRMHumanBoneName[] = [
  "hips",
  "spine",
  "head",
  "leftUpperArm",
  "leftLowerArm",
  "leftHand",
  "rightUpperArm",
  "rightLowerArm",
  "rightHand",
  "leftUpperLeg",
  "leftLowerLeg",
  "leftFoot",
  "rightUpperLeg",
  "rightLowerLeg",
  "rightFoot",
];

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function rounded(value: number): number {
  return Number(value.toFixed(6));
}

function vectorDistance(a: THREE.Vector3, b: THREE.Vector3): number {
  return a.distanceTo(b);
}

function nearestVertexDistance(
  root: THREE.Object3D,
  point: THREE.Vector3,
): number {
  let nearest = Number.POSITIVE_INFINITY;
  const vertex = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    const position = mesh.geometry?.getAttribute?.("position");
    if (!position) return;
    for (let index = 0; index < position.count; index += 1) {
      vertex
        .fromBufferAttribute(position, index)
        .applyMatrix4(object.matrixWorld);
      nearest = Math.min(nearest, vertex.distanceTo(point));
    }
  });
  return nearest;
}

function assertFiniteScene(root: THREE.Object3D, failures: string[]): void {
  root.traverse((object) => {
    if (
      !object.matrix.elements.every(finite) ||
      !object.matrixWorld.elements.every(finite)
    ) {
      failures.push(`non-finite transform on ${object.name || object.type}`);
    }
    const mesh = object as THREE.Mesh;
    const position = mesh.geometry?.getAttribute?.("position");
    if (
      position &&
      Array.from(position.array as ArrayLike<number>).some(
        (component) => !finite(component),
      )
    ) {
      failures.push(`non-finite vertex on ${object.name || object.type}`);
    }
  });
}

function disposeScene(root: THREE.Object3D): void {
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture && !textures.has(value)) {
          textures.add(value);
          value.dispose();
        }
      }
      material.dispose();
    }
  });
}

function createCard(motion: DuelAvatarMotionDefinition): {
  card: HTMLElement;
  canvas: HTMLCanvasElement;
} {
  const card = document.createElement("article");
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 440;
  card.append(canvas);
  const metadata = document.createElement("div");
  metadata.className = "meta";
  metadata.innerHTML =
    '<div class="name"></div><div class="asset"></div><div class="stats"></div>';
  metadata.querySelector(".name")!.textContent = motion.name;
  metadata.querySelector(".asset")!.textContent = motion.asset;
  card.append(metadata);
  document.querySelector("main")!.append(card);
  return { card, canvas };
}

async function auditMotion(
  config: DuelAvatarMotionAuditConfig,
  motion: DuelAvatarMotionDefinition,
  renderer: THREE.WebGLRenderer,
  renderCanvas: HTMLCanvasElement,
): Promise<MotionResult> {
  const { card, canvas } = createCard(motion);
  const failures: string[] = [];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x172139);
  scene.add(new THREE.HemisphereLight(0xc9dcff, 0x202025, 2.3));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x73a6ff, 1.4);
  rim.position.set(-4, 3, -3);
  scene.add(rim);

  const avatarLoader = new GLTFLoader();
  avatarLoader.register((parser) => new VRMLoaderPlugin(parser));
  const avatarGlb = await avatarLoader.loadAsync(
    `/asset/${config.avatarAsset}`,
  );
  const vrm = avatarGlb.userData.vrm;
  if (!vrm?.humanoid) {
    throw new Error(`${config.avatarAsset} did not load as a humanoid VRM`);
  }
  scene.add(vrm.scene);
  vrm.scene.updateMatrixWorld(true);
  vrm.humanoid.update(0);

  const missingRequiredBones = REQUIRED_BODY_BONES.filter(
    (bone) => !vrm.humanoid.getNormalizedBoneNode(bone),
  );
  if (missingRequiredBones.length > 0) {
    failures.push(
      `missing normalized bones: ${missingRequiredBones.join(", ")}`,
    );
  }

  const initialBounds = new THREE.Box3().setFromObject(vrm.scene, true);
  const initialSize = initialBounds.getSize(new THREE.Vector3());
  const scale = 1.6 / Math.max(initialSize.y, 0.001);
  vrm.scene.scale.setScalar(scale);
  vrm.scene.updateMatrixWorld(true);

  let equipmentRoot: THREE.Object3D | null = null;
  let equipmentValidation:
    ReturnType<typeof validateStreamingEquipmentVisualModel> | undefined;
  let equipmentAttached = false;
  let dynamicBowString: ReturnType<
    typeof createDynamicBowStringController
  > | null = null;
  let stableHeldPose: ReturnType<
    typeof createStableHeldEquipmentPoseController
  > | null = null;
  if (config.equipment) {
    const equipmentLoader = new GLTFLoader();
    const equipmentGlb = await equipmentLoader.loadAsync(
      `/asset/${config.equipment.asset}`,
    );
    equipmentRoot = equipmentGlb.scene;
    equipmentValidation = validateStreamingEquipmentVisualModel(
      equipmentRoot,
      config.equipment.slot,
      {
        itemId: config.equipment.itemId,
        avatarId: config.equipment.avatarId,
        vrm,
      },
    );
    if (!equipmentValidation.valid) {
      failures.push(`equipment metadata: ${equipmentValidation.reason}`);
    }
    equipmentAttached = attachEquipmentVisualToVRM({
      slot: config.equipment.slot,
      modelRoot: equipmentRoot,
      visuals: {},
      vrm,
    });
    if (!equipmentAttached) {
      failures.push("equipment attachment failed");
    } else {
      dynamicBowString = createDynamicBowStringController({
        modelRoot: equipmentRoot,
        vrm,
        getState: () => ({
          emote: motion.id === "ranged" ? "range" : motion.id,
        }),
      });
      stableHeldPose = createStableHeldEquipmentPoseController({
        modelRoot: equipmentRoot,
        vrm,
      });
    }
  }

  const rawHips = vrm.humanoid.getRawBoneNode("hips");
  const rootToHips = rawHips?.getWorldPosition(new THREE.Vector3()).y ?? 1;
  const version = vrm.meta?.metaVersion ?? "1";
  const getBoneName = (boneName: string): string | undefined =>
    vrm.humanoid.getNormalizedBoneNode(boneName as VRMHumanBoneName)?.name;

  const animationLoader = new GLTFLoader();
  const animationGlb = await animationLoader.loadAsync(
    `/asset/${motion.asset}`,
  );
  const emote = createEmoteFactory(animationGlb, motion.asset);
  const clip = emote.toClip({ rootToHips, version, getBoneName });
  if (!finite(clip.duration) || clip.duration <= 0) {
    failures.push(`invalid clip duration ${clip.duration}`);
  }
  if (clip.tracks.length < 8) {
    failures.push(`only ${clip.tracks.length} retargeted tracks`);
  }
  if (
    clip.tracks.some(
      (track) =>
        !Array.from(track.times).every(finite) ||
        !Array.from(track.values).every(finite),
    )
  ) {
    failures.push("retargeted clip contains a non-finite keyframe");
  }

  const targetNames = new Set(
    clip.tracks.map((track) =>
      track.name.slice(0, track.name.lastIndexOf(".")),
    ),
  );
  const targetNodes = [...targetNames]
    .map((name) => vrm.scene.getObjectByName(name))
    .filter((node): node is THREE.Object3D => Boolean(node));
  if (targetNodes.length !== targetNames.size) {
    failures.push(
      `${targetNames.size - targetNodes.length} animation targets are missing from the loaded avatar`,
    );
  }

  const mixer = new THREE.AnimationMixer(vrm.scene);
  const hitReaction = new PlayerHitReactionController(vrm.humanoid);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  mixer.setTime(0);
  vrm.humanoid.update(0);
  vrm.scene.updateMatrixWorld(true);
  const rootStart = vrm.scene.getWorldPosition(new THREE.Vector3());
  const startRotations = new Map(
    targetNodes.map((node) => [node, node.quaternion.clone()]),
  );

  const sampleSeconds = Math.min(
    Math.max(clip.duration * motion.sampleRatio, 0),
    Math.max(clip.duration - 0.001, 0),
  );
  hitReaction.beforeMixerUpdate();
  mixer.setTime(sampleSeconds);
  if (motion.hitReaction) {
    if (
      !hitReaction.trigger(
        motion.hitReaction.intensity,
        motion.hitReaction.side,
      )
    ) {
      failures.push("hit-reaction controller rejected the duel avatar");
    } else if (
      hitReaction.afterMixerUpdate(motion.hitReaction.elapsedSeconds) <= 0
    ) {
      failures.push("hit-reaction controller produced no visible pose weight");
    }
  }
  vrm.humanoid.update(0);
  vrm.scene.updateMatrixWorld(true);
  dynamicBowString?.update();
  stableHeldPose?.update();
  const rootEnd = vrm.scene.getWorldPosition(new THREE.Vector3());
  const deltas = targetNodes.map((node) =>
    THREE.MathUtils.radToDeg(
      startRotations.get(node)!.angleTo(node.quaternion),
    ),
  );
  const changedBoneCount = deltas.filter((delta) => delta > 0.5).length;
  const maximumBoneDeltaDegrees = Math.max(0, ...deltas);
  if (changedBoneCount < 2 || maximumBoneDeltaDegrees < 1) {
    failures.push(
      `pose is effectively static (${changedBoneCount} changed bones, ${maximumBoneDeltaDegrees.toFixed(3)}° maximum)`,
    );
  }

  const equipmentVisible = shouldRenderHeldEquipmentVisual({
    emote: motion.id === "death" ? "death" : motion.id,
  });
  if (equipmentRoot) equipmentRoot.visible = equipmentVisible;
  const hiddenEquipmentParent =
    equipmentRoot && !equipmentVisible ? equipmentRoot.parent : null;
  if (hiddenEquipmentParent && equipmentRoot) {
    hiddenEquipmentParent.remove(equipmentRoot);
  }
  const bounds = new THREE.Box3().setFromObject(vrm.scene, true);
  if (hiddenEquipmentParent && equipmentRoot) {
    hiddenEquipmentParent.add(equipmentRoot);
    equipmentRoot.updateMatrixWorld(true);
  }
  const size = bounds.getSize(new THREE.Vector3());
  if (
    ![size.x, size.y, size.z, bounds.min.y, bounds.max.y].every(finite) ||
    size.x <= 0.05 ||
    size.y <= 0.25 ||
    size.z <= 0.02 ||
    size.x > 3 ||
    size.y > 3 ||
    size.z > 3
  ) {
    failures.push(
      `implausible posed bounds ${size.x.toFixed(3)}×${size.y.toFixed(3)}×${size.z.toFixed(3)}`,
    );
  }
  const rootDrift = vectorDistance(rootStart, rootEnd);
  if (rootDrift > 0.000001) {
    failures.push(`scene root drifted ${rootDrift.toFixed(6)} metres`);
  }
  if (motion.id === "death" && bounds.min.y > 0.2) {
    failures.push(
      `death pose remains ${bounds.min.y.toFixed(3)} metres above ground`,
    );
  }
  if (motion.id === "death" && bounds.min.y < -0.25) {
    failures.push(
      `death pose penetrates ${Math.abs(bounds.min.y).toFixed(3)} metres below ground`,
    );
  }
  if (motion.id !== "death" && bounds.min.y > 0.35) {
    failures.push(
      `standing pose remains ${bounds.min.y.toFixed(3)} metres above ground`,
    );
  }
  let equipmentResult: EquipmentMotionResult | undefined;
  if (config.equipment && equipmentRoot && equipmentAttached) {
    const equipmentBounds = new THREE.Box3().setFromObject(equipmentRoot, true);
    const equipmentSize = equipmentBounds.getSize(new THREE.Vector3());
    const rightHand = vrm.humanoid
      .getRawBoneNode("rightHand")
      ?.getWorldPosition(new THREE.Vector3());
    const leftHand = vrm.humanoid
      .getRawBoneNode("leftHand")
      ?.getWorldPosition(new THREE.Vector3());
    const head = vrm.humanoid
      .getRawBoneNode("head")
      ?.getWorldPosition(new THREE.Vector3());
    const torso = (
      vrm.humanoid.getRawBoneNode("chest") ??
      vrm.humanoid.getRawBoneNode("spine")
    )?.getWorldPosition(new THREE.Vector3());
    const rightDistance = rightHand
      ? nearestVertexDistance(equipmentRoot, rightHand)
      : Number.POSITIVE_INFINITY;
    const leftDistance = leftHand
      ? nearestVertexDistance(equipmentRoot, leftHand)
      : Number.POSITIVE_INFINITY;
    const headDistance = head
      ? nearestVertexDistance(equipmentRoot, head)
      : Number.POSITIVE_INFINITY;
    const torsoDistance = torso
      ? nearestVertexDistance(equipmentRoot, torso)
      : Number.POSITIVE_INFINITY;
    const equipmentMetrics = [
      equipmentSize.x,
      equipmentSize.y,
      equipmentSize.z,
      equipmentBounds.min.y,
      equipmentBounds.max.y,
      rightDistance,
      leftDistance,
      headDistance,
      torsoDistance,
    ];
    const attachmentData = extractEquipmentAttachmentData(equipmentRoot);
    const attachmentBone = attachmentData?.vrmBoneName ?? null;
    const weaponType = attachmentData?.weaponType?.toLowerCase() ?? null;
    let stablePoseDeviationDegrees: number | null = null;
    if (stableHeldPose && attachmentData?.stableHeldPose) {
      const stablePoseData = attachmentData.stableHeldPose;
      const wrapper = equipmentRoot.getObjectByName(
        stablePoseData.wrapperNodeName,
      );
      if (wrapper) {
        const desiredAvatarQuaternion = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            ...(stablePoseData.avatarLocalEulerDegrees.map(
              THREE.MathUtils.degToRad,
            ) as [number, number, number]),
            "XYZ",
          ),
        );
        const desiredWorldQuaternion = vrm.scene
          .getWorldQuaternion(new THREE.Quaternion())
          .multiply(desiredAvatarQuaternion);
        stablePoseDeviationDegrees = THREE.MathUtils.radToDeg(
          wrapper
            .getWorldQuaternion(new THREE.Quaternion())
            .angleTo(desiredWorldQuaternion),
        );
      }
    }
    let nockedArrowVisible = false;
    let nockedArrowNockDistance: number | null = null;
    let nockedArrowAimDeviationDegrees: number | null = null;
    if (dynamicBowString) {
      vrm.scene.updateMatrixWorld(true);
      nockedArrowVisible = dynamicBowString.nockedArrow.visible;
      if (rightHand && nockedArrowVisible) {
        const arrowOrigin = dynamicBowString.nockedArrow.getWorldPosition(
          new THREE.Vector3(),
        );
        nockedArrowNockDistance = arrowOrigin.distanceTo(rightHand);
        const bowString = attachmentData?.bowString;
        const content = bowString
          ? equipmentRoot.getObjectByName(bowString.contentNodeName)
          : null;
        if (bowString && content) {
          const restNock = new THREE.Vector3(
            ...(bowString.restNock as [number, number, number]),
          );
          content.localToWorld(restNock);
          const desiredDirection = restNock.sub(rightHand);
          const arrowForward = new THREE.Vector3(0, 0, 1).applyQuaternion(
            dynamicBowString.nockedArrow.getWorldQuaternion(
              new THREE.Quaternion(),
            ),
          );
          if (
            desiredDirection.lengthSq() > 1e-8 &&
            arrowForward.lengthSq() > 1e-8
          ) {
            nockedArrowAimDeviationDegrees = THREE.MathUtils.radToDeg(
              desiredDirection.normalize().angleTo(arrowForward.normalize()),
            );
          }
        }
      }
    }
    if (!equipmentMetrics.every(finite)) {
      failures.push("equipment produced non-finite geometry metrics");
    }
    const longestAxis = Math.max(
      equipmentSize.x,
      equipmentSize.y,
      equipmentSize.z,
    );
    if (longestAxis < 0.35 || longestAxis > 2.4) {
      failures.push(
        `equipment length ${longestAxis.toFixed(3)}m is outside the duel-weapon envelope`,
      );
    }
    const primaryDistance =
      attachmentBone === "leftHand" ? leftDistance : rightDistance;
    if (primaryDistance > 0.22) {
      failures.push(
        `${attachmentBone ?? "attachment"} is ${primaryDistance.toFixed(3)}m from the nearest equipment vertex`,
      );
    }
    if (
      config.equipment.grip === "two-hand" &&
      (motion.id === "two-hand-idle" || motion.id === "two-hand-slash") &&
      (attachmentBone === "leftHand" ? rightDistance : leftDistance) > 0.32
    ) {
      const secondaryDistance =
        attachmentBone === "leftHand" ? rightDistance : leftDistance;
      failures.push(
        `secondary hand is ${secondaryDistance.toFixed(3)}m from the two-handed weapon`,
      );
    }
    if (
      weaponType === "bow" &&
      motion.id === "ranged" &&
      (attachmentBone === "leftHand" ? rightDistance : leftDistance) > 0.12
    ) {
      const drawDistance =
        attachmentBone === "leftHand" ? rightDistance : leftDistance;
      failures.push(
        `draw hand is ${drawDistance.toFixed(3)}m from the dynamic bowstring`,
      );
    }
    if (weaponType === "bow" && motion.id === "ranged") {
      if (!nockedArrowVisible) {
        failures.push("nocked arrow is not visible during ranged draw");
      }
      if (
        nockedArrowNockDistance === null ||
        nockedArrowNockDistance > 0.0001
      ) {
        failures.push(
          `nocked arrow is ${(nockedArrowNockDistance ?? Number.POSITIVE_INFINITY).toFixed(6)}m from the draw hand`,
        );
      }
      if (
        nockedArrowAimDeviationDegrees === null ||
        nockedArrowAimDeviationDegrees > 0.1
      ) {
        failures.push(
          `nocked arrow aim deviates ${(nockedArrowAimDeviationDegrees ?? Number.POSITIVE_INFINITY).toFixed(3)}° from the bow rest`,
        );
      }
    } else if (nockedArrowVisible) {
      failures.push("nocked arrow remains visible outside ranged draw");
    }
    if (weaponType === "staff" && !stableHeldPose) {
      failures.push("staff stable held pose is not active");
    }
    if (
      weaponType === "staff" &&
      (stablePoseDeviationDegrees === null || stablePoseDeviationDegrees > 0.1)
    ) {
      failures.push(
        `staff pose deviates ${(stablePoseDeviationDegrees ?? Number.POSITIVE_INFINITY).toFixed(3)}° from its avatar-local authority`,
      );
    }
    const staffClearanceMotion = new Set([
      "idle",
      "walk",
      "run",
      "unarmed",
      "magic",
      "hit-reaction",
    ]).has(motion.id);
    if (weaponType === "staff" && staffClearanceMotion && headDistance < 0.25) {
      failures.push(
        `staff is only ${headDistance.toFixed(3)}m from the head anchor`,
      );
    }
    if (weaponType === "staff" && staffClearanceMotion && torsoDistance < 0.2) {
      failures.push(
        `staff is only ${torsoDistance.toFixed(3)}m from the torso anchor`,
      );
    }
    equipmentResult = {
      itemId: config.equipment.itemId,
      asset: config.equipment.asset,
      metadataValid: equipmentValidation?.valid === true,
      metadataReason: equipmentValidation?.reason ?? null,
      attached: equipmentAttached,
      visible: equipmentVisible,
      weaponType,
      dynamicBowStringActive: Boolean(dynamicBowString),
      stableHeldPoseActive: Boolean(stableHeldPose),
      stablePoseDeviationDegrees:
        stablePoseDeviationDegrees === null
          ? null
          : rounded(stablePoseDeviationDegrees),
      nockedArrowVisible,
      nockedArrowNockDistance:
        nockedArrowNockDistance === null
          ? null
          : rounded(nockedArrowNockDistance),
      nockedArrowAimDeviationDegrees:
        nockedArrowAimDeviationDegrees === null
          ? null
          : rounded(nockedArrowAimDeviationDegrees),
      attachmentBone,
      bounds: {
        width: rounded(equipmentSize.x),
        height: rounded(equipmentSize.y),
        depth: rounded(equipmentSize.z),
        minimumY: rounded(equipmentBounds.min.y),
        maximumY: rounded(equipmentBounds.max.y),
      },
      rightHandNearestVertexDistance: rounded(rightDistance),
      leftHandNearestVertexDistance: rounded(leftDistance),
      headNearestVertexDistance: rounded(headDistance),
      torsoNearestVertexDistance: rounded(torsoDistance),
    };
  }
  assertFiniteScene(vrm.scene, failures);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 64),
    new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.94,
      metalness: 0.02,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);
  const camera = new THREE.PerspectiveCamera(28, 480 / 440, 0.01, 20);
  camera.position.set(0, 0.86, 3.7);
  camera.lookAt(0, 0.82, 0);
  renderer.render(scene, camera);
  canvas.getContext("2d", { alpha: false })!.drawImage(renderCanvas, 0, 0);

  const result: MotionResult = {
    id: motion.id,
    name: motion.name,
    asset: motion.asset,
    durationSeconds: rounded(clip.duration),
    sampleSeconds: rounded(sampleSeconds),
    trackCount: clip.tracks.length,
    targetBoneCount: targetNodes.length,
    changedBoneCount,
    maximumBoneDeltaDegrees: rounded(maximumBoneDeltaDegrees),
    bounds: {
      width: rounded(size.x),
      height: rounded(size.y),
      depth: rounded(size.z),
      minimumY: rounded(bounds.min.y),
      maximumY: rounded(bounds.max.y),
    },
    rootDrift: rounded(rootDrift),
    ...(equipmentResult ? { equipment: equipmentResult } : {}),
    failures: [...new Set(failures)],
  };
  card.querySelector(".stats")!.textContent = result.failures.length
    ? `FAIL · ${result.failures.join(" · ")}`
    : `${result.trackCount} tracks · ${result.changedBoneCount} moving bones · ${result.maximumBoneDeltaDegrees.toFixed(1)}° max`;
  card.dataset.status = result.failures.length ? "fail" : "pass";

  mixer.stopAllAction();
  mixer.uncacheRoot(vrm.scene);
  dynamicBowString?.dispose();
  disposeScene(scene);
  scene.clear();
  return result;
}

export async function runDuelAvatarMotionAudit(
  config: DuelAvatarMotionAuditConfig,
): Promise<DuelAvatarMotionBrowserReport> {
  const renderCanvas = document.createElement("canvas");
  renderCanvas.width = 480;
  renderCanvas.height = 440;
  const renderer = new THREE.WebGLRenderer({
    canvas: renderCanvas,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.setSize(480, 440, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const gl = renderer.getContext();
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const rendererName = debug
    ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
    : String(gl.getParameter(gl.RENDERER));

  const results: MotionResult[] = [];
  for (const motion of config.motions) {
    try {
      results.push(await auditMotion(config, motion, renderer, renderCanvas));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const { card } = createCard(motion);
      card.dataset.status = "fail";
      card.querySelector(".stats")!.textContent = `FAIL · ${message}`;
      results.push({
        id: motion.id,
        name: motion.name,
        asset: motion.asset,
        durationSeconds: 0,
        sampleSeconds: 0,
        trackCount: 0,
        targetBoneCount: 0,
        changedBoneCount: 0,
        maximumBoneDeltaDegrees: 0,
        bounds: {
          width: 0,
          height: 0,
          depth: 0,
          minimumY: 0,
          maximumY: 0,
        },
        rootDrift: 0,
        ...(config.equipment
          ? {
              equipment: {
                itemId: config.equipment.itemId,
                asset: config.equipment.asset,
                metadataValid: false,
                metadataReason: "audit_failed",
                attached: false,
                visible: false,
                weaponType: null,
                dynamicBowStringActive: false,
                stableHeldPoseActive: false,
                stablePoseDeviationDegrees: null,
                nockedArrowVisible: false,
                nockedArrowNockDistance: null,
                nockedArrowAimDeviationDegrees: null,
                attachmentBone: null,
                bounds: {
                  width: 0,
                  height: 0,
                  depth: 0,
                  minimumY: 0,
                  maximumY: 0,
                },
                rightHandNearestVertexDistance: 0,
                leftHandNearestVertexDistance: 0,
                headNearestVertexDistance: 0,
                torsoNearestVertexDistance: 0,
              },
            }
          : {}),
        failures: [message],
      });
    }
  }
  renderer.dispose();
  renderer.forceContextLoss();
  const failures = results.flatMap((result) =>
    result.failures.map((failure) => `${result.id}: ${failure}`),
  );
  return {
    avatarAsset: config.avatarAsset,
    avatarSha256: config.avatarSha256,
    userAgent: navigator.userAgent,
    renderer: rendererName,
    motions: results,
    failures,
  };
}
