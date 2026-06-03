import { THREE } from "@hyperforge/shared";

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
  _rootToHips: number = 1,
  allowHipsTranslationY: boolean = false,
  allowHipsTranslationXYZ: boolean = false,
  allowBoneTranslations: boolean = false,
): THREE.AnimationClip | null {
  if (!animationGLTF.animations || animationGLTF.animations.length === 0) {
    return null;
  }

  const clip = animationGLTF.animations[0].clone();
  const scale = animationGLTF.scene.children[0]?.scale.x || 1;
  const yOffset = allowHipsTranslationY ? 0 : -0.05 / scale;

  // Filter tracks - keep only root/hips position (or all bone positions)
  clip.tracks = clip.tracks.filter((track: THREE.KeyframeTrack) => {
    if (track instanceof THREE.VectorKeyframeTrack) {
      const [name, type] = track.name.split(".");
      if (type !== "position") return false;
      if (allowBoneTranslations) return true;
      if (name === "Root") return true;
      if (name === "mixamorigHips") return true;
      return false;
    }
    return true;
  });

  // Fix normalized bones (from pixiv/three-vrm PR #1032)
  clip.tracks.forEach((track: THREE.KeyframeTrack) => {
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
        flatQuaternion.forEach((v: number, index: number) => {
          track.values[index + i] = v;
        });
      }
    } else if (track instanceof THREE.VectorKeyframeTrack) {
      if (yOffset) {
        track.values = Float32Array.from(
          track.values,
          (v: number, i: number) => {
            if (i % 3 === 1) return v + yOffset;
            return v;
          },
        );
      }
    }
  });

  clip.optimize();

  // Retarget tracks to VRM skeleton
  const retargetedTracks: THREE.KeyframeTrack[] = [];
  const _scaler = _rootToHips * scale;

  clip.tracks.forEach((track: THREE.KeyframeTrack) => {
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
      } else if (track instanceof THREE.VectorKeyframeTrack) {
        if (!allowHipsTranslationY && !allowBoneTranslations) {
          return;
        }
        if (!vrmBoneName) {
          return;
        }
        if (vrmBoneName !== "hips" && !allowBoneTranslations) {
          return;
        }
        const scaledValues = new Float32Array(track.values.length);
        for (let i = 0; i < track.values.length; i += 3) {
          const x = track.values[i] * _scaler;
          const y = track.values[i + 1] * _scaler;
          const z = track.values[i + 2] * _scaler;
          if (vrmBoneName === "hips") {
            scaledValues[i] = allowHipsTranslationXYZ ? x : 0;
            scaledValues[i + 1] = y;
            scaledValues[i + 2] = allowHipsTranslationXYZ ? z : 0;
          } else {
            scaledValues[i] = x;
            scaledValues[i + 1] = y;
            scaledValues[i + 2] = z;
          }
        }
        retargetedTracks.push(
          new THREE.VectorKeyframeTrack(
            `${vrmNodeName}.${propertyName}`,
            track.times,
            scaledValues,
          ),
        );
      }
      // Skip position tracks to prevent root motion
    }
  });

  return new THREE.AnimationClip(clip.name, clip.duration, retargetedTracks);
}
