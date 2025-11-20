import * as THREE from "three";

/**
 * Create Emote Factory - Animation Retargeting for VRM
 *
 * Simplified version from shared package for client-side use.
 * Converts Mixamo animations to VRM-compatible animation clips.
 */

const normalizedBoneNames: Record<string, string> = {
  // Mixamo bone names -> VRM bone names
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

const q1 = new THREE.Quaternion();
const restRotationInverse = new THREE.Quaternion();
const parentRestWorldRotation = new THREE.Quaternion();

export function retargetAnimationToVRM(
  animationGLTF: { scene: THREE.Group; animations: THREE.AnimationClip[] },
  getBoneName: (vrmBoneName: string) => string | undefined,
  rootToHips: number = 1,
): THREE.AnimationClip | null {
  if (!animationGLTF.animations || animationGLTF.animations.length === 0) {
    return null;
  }

  const clip = animationGLTF.animations[0].clone();
  const scale = animationGLTF.scene.children[0]?.scale.x || 1;
  const yOffset = -0.05 / scale;

  // Filter tracks - keep only root position and quaternions
  clip.tracks = clip.tracks.filter((track) => {
    if (track instanceof THREE.VectorKeyframeTrack) {
      const [name, type] = track.name.split(".");
      if (type !== "position") return false;
      if (name === "Root") return true;
      if (name === "mixamorigHips") return true;
      return false;
    }
    return true;
  });

  // Fix normalized bones (from pixiv/three-vrm PR #1032)
  clip.tracks.forEach((track) => {
    const trackSplitted = track.name.split(".");
    const mixamoRigName = trackSplitted[0];
    const mixamoRigNode = animationGLTF.scene.getObjectByName(mixamoRigName);

    if (!mixamoRigNode || !mixamoRigNode.parent) {
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
          if (i % 3 === 1) return v + yOffset;
          return v;
        });
      }
    }
  });

  clip.optimize();

  // Retarget tracks to VRM skeleton
  const height = rootToHips;
  const scaler = height * scale;
  const retargetedTracks: THREE.KeyframeTrack[] = [];

  clip.tracks.forEach((track) => {
    const trackSplitted = track.name.split(".");
    const ogBoneName = trackSplitted[0];
    const vrmBoneName = normalizedBoneNames[ogBoneName];
    const vrmNodeName = getBoneName(vrmBoneName);

    if (vrmNodeName !== undefined) {
      const propertyName = trackSplitted[1];

      if (track instanceof THREE.QuaternionKeyframeTrack) {
        retargetedTracks.push(
          new THREE.QuaternionKeyframeTrack(
            `${vrmNodeName}.${propertyName}`,
            track.times,
            track.values,
          ),
        );
      }
      // Skip position tracks to prevent root motion
    }
  });

  return new THREE.AnimationClip(clip.name, clip.duration, retargetedTracks);
}
