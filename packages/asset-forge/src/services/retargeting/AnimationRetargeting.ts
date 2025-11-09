/**
 * AnimationRetargeting.ts - Browser-compatible Animation Retargeting
 *
 * Adapted from Hyperscape's createEmoteFactory for use in Asset Forge.
 * Retargets Mixamo animations to VRM skeletons.
 */

import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";

const q1 = new THREE.Quaternion();
const restRotationInverse = new THREE.Quaternion();
const parentRestWorldRotation = new THREE.Quaternion();
const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();

/**
 * Retarget Mixamo animation to VRM skeleton
 *
 * @param animationGLTF - Loaded Mixamo animation GLB
 * @param vrm - Target VRM avatar
 * @param rootToHips - Distance from root to hips (calculated once when VRM loads)
 * @returns Retargeted AnimationClip ready to use with VRM
 */
export function retargetAnimation(
  animationGLTF: { scene: THREE.Group; animations: THREE.AnimationClip[] },
  vrm: VRM,
  rootToHips: number = 1,
): THREE.AnimationClip | null {
  console.log("[AnimationRetargeting] Starting retargeting...");
  console.log("[AnimationRetargeting] Animation GLTF:", animationGLTF);
  console.log("[AnimationRetargeting] VRM:", vrm);
  console.log("[AnimationRetargeting] rootToHips (provided):", rootToHips);

  if (!animationGLTF.animations || animationGLTF.animations.length === 0) {
    console.error("[AnimationRetargeting] No animations found in GLB");
    return null;
  }

  const clip = animationGLTF.animations[0].clone();
  console.log("[AnimationRetargeting] Original clip:", clip);
  console.log("[AnimationRetargeting] Original tracks:", clip.tracks.length);

  // Get scale from armature
  const scale = animationGLTF.scene.children[0]?.scale.x || 1;
  console.log("[AnimationRetargeting] Animation scale:", scale);

  // Y-offset hack to prevent levitation
  const yOffset = -0.05 / scale;

  // Use provided rootToHips (DON'T recalculate from VRM - it changes after animations apply!)
  const humanoid = vrm.humanoid;
  console.log(
    "[AnimationRetargeting] Using rootToHips for scaling:",
    rootToHips,
  );

  // Get VRM version
  const version = vrm.meta?.metaVersion || "1.0";
  console.log("[AnimationRetargeting] VRM version:", version);

  // NO VRM-side compensation needed!
  // The Mixamo-side transformation (lines 128-138 below) already handles bind pose differences
  // This matches CharacterStudio and official @pixiv/three-vrm approach
  console.log(
    "[AnimationRetargeting] Using Mixamo-side transformation only (no double compensation)",
  );

  // Filter tracks - keep only root position and quaternions
  let haveRoot = false;
  clip.tracks = clip.tracks.filter((track) => {
    if (track instanceof THREE.VectorKeyframeTrack) {
      const [name, type] = track.name.split(".");
      if (type !== "position") return false;
      if (name === "Root") {
        haveRoot = true;
        return true;
      }
      if (name === "mixamorigHips") {
        return true;
      }
      return false;
    }
    return true;
  });

  console.log("[AnimationRetargeting] Filtered tracks:", clip.tracks.length);

  // Fix normalized bones (from pixiv/three-vrm PR #1032)
  clip.tracks.forEach((track) => {
    const trackSplitted = track.name.split(".");
    const mixamoRigName = trackSplitted[0];
    const mixamoRigNode = animationGLTF.scene.getObjectByName(mixamoRigName);

    if (!mixamoRigNode || !mixamoRigNode.parent) {
      console.warn(
        `[AnimationRetargeting] Mixamo rig node not found: ${mixamoRigName}`,
      );
      return;
    }

    mixamoRigNode.getWorldQuaternion(restRotationInverse).invert();
    mixamoRigNode.parent.getWorldQuaternion(parentRestWorldRotation);

    if (track instanceof THREE.QuaternionKeyframeTrack) {
      // Retarget rotation of mixamoRig to NormalizedBone
      for (let i = 0; i < track.values.length; i += 4) {
        const flatQuaternion = track.values.slice(i, i + 4);
        q1.fromArray(flatQuaternion);
        q1.premultiply(parentRestWorldRotation).multiply(restRotationInverse);
        q1.toArray(flatQuaternion);
        flatQuaternion.forEach((v, index) => {
          track.values[index + i] = v;
        });
      }
    } else if (track instanceof THREE.VectorKeyframeTrack) {
      if (yOffset) {
        track.values = track.values.map((v, i) => {
          // Apply Y-offset to prevent levitation
          if (i % 3 === 1) {
            return v + yOffset;
          }
          return v;
        });
      }
    }
  });

  clip.optimize();

  // Get bone name mapping function
  // Use normalized bone node names for animation tracks (matches three-avatar implementation)
  // The AnimationMixer on vrm.scene will automatically handle the normalized bone abstraction
  const getBoneName = (vrmBoneName: string): string | undefined => {
    const normalizedNode = humanoid?.getNormalizedBoneNode(vrmBoneName as any);
    return normalizedNode?.name;
  };

  // Retarget tracks to actual skeleton bone names
  // NOTE: We DON'T apply bind pose compensation here - the skeleton's inverse bind matrices
  // naturally handle the bind pose transformation during skinning (matches online VRM viewers)
  const height = rootToHips;
  const scaler = height * scale;

  const retargetedTracks: THREE.KeyframeTrack[] = [];

  clip.tracks.forEach((track) => {
    const trackSplitted = track.name.split(".");
    const ogBoneName = trackSplitted[0];
    const vrmBoneName = normalizedBoneNames[ogBoneName];
    const vrmNodeName = getBoneName(vrmBoneName); // Get actual skeleton bone name

    console.log(
      `[AnimationRetargeting] Retargeting: ${ogBoneName} -> ${vrmBoneName} -> ${vrmNodeName}`,
    );

    if (vrmNodeName !== undefined) {
      const propertyName = trackSplitted[1];

      if (track instanceof THREE.QuaternionKeyframeTrack) {
        let transformedValues = track.values;

        // Apply VRM 0.0 coordinate transformations
        if (version === "0") {
          transformedValues = track.values.map((v, i) =>
            i % 2 === 0 ? -v : v,
          );
        }

        retargetedTracks.push(
          new THREE.QuaternionKeyframeTrack(
            `${vrmNodeName}.${propertyName}`,
            track.times,
            transformedValues,
          ),
        );
      } else if (track instanceof THREE.VectorKeyframeTrack) {
        retargetedTracks.push(
          new THREE.VectorKeyframeTrack(
            `${vrmNodeName}.${propertyName}`,
            track.times,
            track.values.map((v, i) => {
              return (version === "0" && i % 3 !== 1 ? -v : v) * scaler;
            }),
          ),
        );
      }
    }
  });

  console.log(
    "[AnimationRetargeting] Retargeted tracks:",
    retargetedTracks.length,
  );
  console.log(
    "[AnimationRetargeting] Retargeted track names:",
    retargetedTracks.map((t) => t.name),
  );

  // Debug: Log sample values from first quaternion track
  const firstQuatTrack = retargetedTracks.find(
    (t) => t instanceof THREE.QuaternionKeyframeTrack,
  );
  if (
    firstQuatTrack &&
    firstQuatTrack instanceof THREE.QuaternionKeyframeTrack
  ) {
    const firstValues = firstQuatTrack.values.slice(0, 4);
    console.log(
      "[AnimationRetargeting] Sample quaternion values (first keyframe):",
    );
    console.log(`  Track: ${firstQuatTrack.name}`);
    console.log(
      `  Values: [${firstValues.map((v) => v.toFixed(3)).join(", ")}]`,
    );
  }

  const retargetedClip = new THREE.AnimationClip(
    clip.name,
    clip.duration,
    retargetedTracks,
  );

  console.log("[AnimationRetargeting] Final retargeted clip:", retargetedClip);

  return retargetedClip;
}

/**
 * Bone name mapping from Mixamo to VRM standard
 * Supports mixamorig prefix, capitalized names, and lowercase names
 */
const normalizedBoneNames: Record<string, string> = {
  // VRM standard (lowercase)
  hips: "hips",
  spine: "spine",
  chest: "chest",
  upperChest: "upperChest",
  neck: "neck",
  head: "head",
  leftShoulder: "leftShoulder",
  leftUpperArm: "leftUpperArm",
  leftLowerArm: "leftLowerArm",
  leftHand: "leftHand",
  leftThumbProximal: "leftThumbProximal",
  leftThumbIntermediate: "leftThumbIntermediate",
  leftThumbDistal: "leftThumbDistal",
  leftIndexProximal: "leftIndexProximal",
  leftIndexIntermediate: "leftIndexIntermediate",
  leftIndexDistal: "leftIndexDistal",
  leftMiddleProximal: "leftMiddleProximal",
  leftMiddleIntermediate: "leftMiddleIntermediate",
  leftMiddleDistal: "leftMiddleDistal",
  leftRingProximal: "leftRingProximal",
  leftRingIntermediate: "leftRingIntermediate",
  leftRingDistal: "leftRingDistal",
  leftLittleProximal: "leftLittleProximal",
  leftLittleIntermediate: "leftLittleIntermediate",
  leftLittleDistal: "leftLittleDistal",
  rightShoulder: "rightShoulder",
  rightUpperArm: "rightUpperArm",
  rightLowerArm: "rightLowerArm",
  rightHand: "rightHand",
  rightLittleProximal: "rightLittleProximal",
  rightLittleIntermediate: "rightLittleIntermediate",
  rightLittleDistal: "rightLittleDistal",
  rightRingProximal: "rightRingProximal",
  rightRingIntermediate: "rightRingIntermediate",
  rightRingDistal: "rightRingDistal",
  rightMiddleProximal: "rightMiddleProximal",
  rightMiddleIntermediate: "rightMiddleIntermediate",
  rightMiddleDistal: "rightMiddleDistal",
  rightIndexProximal: "rightIndexProximal",
  rightIndexIntermediate: "rightIndexIntermediate",
  rightIndexDistal: "rightIndexDistal",
  rightThumbProximal: "rightThumbProximal",
  rightThumbIntermediate: "rightThumbIntermediate",
  rightThumbDistal: "rightThumbDistal",
  leftUpperLeg: "leftUpperLeg",
  leftLowerLeg: "leftLowerLeg",
  leftFoot: "leftFoot",
  leftToes: "leftToes",
  rightUpperLeg: "rightUpperLeg",
  rightLowerLeg: "rightLowerLeg",
  rightFoot: "rightFoot",
  rightToes: "rightToes",

  // VRM uploaded to Mixamo (capitalized)
  Hips: "hips",
  Spine: "spine",
  Spine1: "chest",
  Spine2: "upperChest",
  Neck: "neck",
  Head: "head",
  LeftShoulder: "leftShoulder",
  LeftArm: "leftUpperArm",
  LeftForeArm: "leftLowerArm",
  LeftHand: "leftHand",
  LeftHandThumb1: "leftThumbProximal",
  LeftHandThumb2: "leftThumbIntermediate",
  LeftHandThumb3: "leftThumbDistal",
  LeftHandIndex1: "leftIndexProximal",
  LeftHandIndex2: "leftIndexIntermediate",
  LeftHandIndex3: "leftIndexDistal",
  LeftHandMiddle1: "leftMiddleProximal",
  LeftHandMiddle2: "leftMiddleIntermediate",
  LeftHandMiddle3: "leftMiddleDistal",
  LeftHandRing1: "leftRingProximal",
  LeftHandRing2: "leftRingIntermediate",
  LeftHandRing3: "leftRingDistal",
  LeftHandPinky1: "leftLittleProximal",
  LeftHandPinky2: "leftLittleIntermediate",
  LeftHandPinky3: "leftLittleDistal",
  RightShoulder: "rightShoulder",
  RightArm: "rightUpperArm",
  RightForeArm: "rightLowerArm",
  RightHand: "rightHand",
  RightHandPinky1: "rightLittleProximal",
  RightHandPinky2: "rightLittleIntermediate",
  RightHandPinky3: "rightLittleDistal",
  RightHandRing1: "rightRingProximal",
  RightHandRing2: "rightRingIntermediate",
  RightHandRing3: "rightRingDistal",
  RightHandMiddle1: "rightMiddleProximal",
  RightHandMiddle2: "rightMiddleIntermediate",
  RightHandMiddle3: "rightMiddleDistal",
  RightHandIndex1: "rightIndexProximal",
  RightHandIndex2: "rightIndexIntermediate",
  RightHandIndex3: "rightIndexDistal",
  RightHandThumb1: "rightThumbProximal",
  RightHandThumb2: "rightThumbIntermediate",
  RightHandThumb3: "rightThumbDistal",
  LeftUpLeg: "leftUpperLeg",
  LeftLeg: "leftLowerLeg",
  LeftFoot: "leftFoot",
  LeftToeBase: "leftToes",
  RightUpLeg: "rightUpperLeg",
  RightLeg: "rightLowerLeg",
  RightFoot: "rightFoot",
  RightToeBase: "rightToes",

  // Mixamo with mixamorig prefix
  mixamorigHips: "hips",
  mixamorigSpine: "spine",
  mixamorigSpine1: "chest",
  mixamorigSpine2: "upperChest",
  mixamorigNeck: "neck",
  mixamorigHead: "head",
  mixamorigLeftShoulder: "leftShoulder",
  mixamorigLeftArm: "leftUpperArm",
  mixamorigLeftForeArm: "leftLowerArm",
  mixamorigLeftHand: "leftHand",
  mixamorigLeftHandThumb1: "leftThumbProximal",
  mixamorigLeftHandThumb2: "leftThumbIntermediate",
  mixamorigLeftHandThumb3: "leftThumbDistal",
  mixamorigLeftHandIndex1: "leftIndexProximal",
  mixamorigLeftHandIndex2: "leftIndexIntermediate",
  mixamorigLeftHandIndex3: "leftIndexDistal",
  mixamorigLeftHandMiddle1: "leftMiddleProximal",
  mixamorigLeftHandMiddle2: "leftMiddleIntermediate",
  mixamorigLeftHandMiddle3: "leftMiddleDistal",
  mixamorigLeftHandRing1: "leftRingProximal",
  mixamorigLeftHandRing2: "leftRingIntermediate",
  mixamorigLeftHandRing3: "leftRingDistal",
  mixamorigLeftHandPinky1: "leftLittleProximal",
  mixamorigLeftHandPinky2: "leftLittleIntermediate",
  mixamorigLeftHandPinky3: "leftLittleDistal",
  mixamorigRightShoulder: "rightShoulder",
  mixamorigRightArm: "rightUpperArm",
  mixamorigRightForeArm: "rightLowerArm",
  mixamorigRightHand: "rightHand",
  mixamorigRightHandPinky1: "rightLittleProximal",
  mixamorigRightHandPinky2: "rightLittleIntermediate",
  mixamorigRightHandPinky3: "rightLittleDistal",
  mixamorigRightHandRing1: "rightRingProximal",
  mixamorigRightHandRing2: "rightRingIntermediate",
  mixamorigRightHandRing3: "rightRingDistal",
  mixamorigRightHandMiddle1: "rightMiddleProximal",
  mixamorigRightHandMiddle2: "rightMiddleIntermediate",
  mixamorigRightHandMiddle3: "rightMiddleDistal",
  mixamorigRightHandIndex1: "rightIndexProximal",
  mixamorigRightHandIndex2: "rightIndexIntermediate",
  mixamorigRightHandIndex3: "rightIndexDistal",
  mixamorigRightHandThumb1: "rightThumbProximal",
  mixamorigRightHandThumb2: "rightThumbIntermediate",
  mixamorigRightHandThumb3: "rightThumbDistal",
  mixamorigLeftUpLeg: "leftUpperLeg",
  mixamorigLeftLeg: "leftLowerLeg",
  mixamorigLeftFoot: "leftFoot",
  mixamorigLeftToeBase: "leftToes",
  mixamorigRightUpLeg: "rightUpperLeg",
  mixamorigRightLeg: "rightLowerLeg",
  mixamorigRightFoot: "rightFoot",
  mixamorigRightToeBase: "rightToes",
};
