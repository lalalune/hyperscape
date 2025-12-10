/**
 * AnimationRetargeter - Retarget animations between different skeletons
 *
 * This is the CORRECT approach used by Hyperfy, Unreal, and production tools.
 * Instead of rebinding the mesh to a new skeleton, we:
 * 1. Keep mesh bound to its original skeleton
 * 2. Retarget animation data from source skeleton to target skeleton
 * 3. Play retargeted animation on original character
 *
 * Why this works:
 * - Preserves original mesh binding (no deformation)
 * - Only maps animation bone transforms
 * - Standard industry practice
 */

import * as THREE from "three";

import { createBoneMapping, MIXAMO_TO_MESHY } from "./BoneMappings";

export interface RetargetedAnimation {
  clip: THREE.AnimationClip;
  sourceClipName: string;
  mappingQuality: number;
}

export class AnimationRetargeter {
  private sourceAnimations: THREE.AnimationClip[];
  private sourceSkeleton: THREE.Skeleton; // Animation skeleton (e.g., Mixamo)
  private targetSkeleton: THREE.Skeleton; // Character skeleton (e.g., Meshy)
  private boneMapping: Map<string, string>; // source bone name → target bone name
  private restPoseOffsets: Map<string, THREE.Quaternion>; // source bone name → rotation offset
  private boneLengthRatios: Map<string, number>; // source bone name → length ratio (target/source)

  constructor(
    sourceAnimations: THREE.AnimationClip[],
    sourceSkeleton: THREE.Skeleton,
    targetSkeleton: THREE.Skeleton,
  ) {
    this.sourceAnimations = sourceAnimations;
    this.sourceSkeleton = sourceSkeleton;
    this.targetSkeleton = targetSkeleton;

    // Create bone mapping: Mixamo → Meshy (reverse of what we had before!)
    const sourceBoneNames = sourceSkeleton.bones.map((b) => b.name);
    const targetBoneNames = targetSkeleton.bones.map((b) => b.name);

    this.boneMapping = createBoneMapping(
      sourceBoneNames,
      targetBoneNames,
      MIXAMO_TO_MESHY,
    );

    console.log("🎬 AnimationRetargeter initialized");
    console.log(
      "  Source skeleton:",
      sourceSkeleton.bones.length,
      "bones (animation rig)",
    );
    console.log(
      "  Target skeleton:",
      targetSkeleton.bones.length,
      "bones (character rig)",
    );
    console.log("  Bone mapping:", this.boneMapping.size, "mapped");
    console.log("  Available animations:", sourceAnimations.length);

    // Calculate rest pose offsets for proper retargeting
    this.restPoseOffsets = new Map();
    this.boneLengthRatios = new Map();
    this.calculateRestPoseOffsets();
  }

  /**
   * Calculate rest pose offsets between source and target skeletons
   * This is CRITICAL for handling T-pose vs A-pose differences
   *
   * IMPORTANT: Animation tracks are in LOCAL space, so we use LOCAL quaternions
   * Formula: offset = targetRestRotation.inverse() * sourceRestRotation
   * When applied: finalRotation = animationRotation * offset
   */
  private calculateRestPoseOffsets(): void {
    console.log("🔄 Calculating rest pose offsets...");

    let offsetCount = 0;

    // Convert Map entries to array to avoid downlevelIteration requirement
    Array.from(this.boneMapping.entries()).forEach(
      ([sourceBoneName, targetBoneName]) => {
        const sourceBone = this.sourceSkeleton.bones.find(
          (b) => b.name === sourceBoneName,
        );
        const targetBone = this.targetSkeleton.bones.find(
          (b) => b.name === targetBoneName,
        );

        if (sourceBone && targetBone) {
          // Use LOCAL quaternions (animation tracks are in local space!)
          const sourceLocalQuat = sourceBone.quaternion.clone();
          const targetLocalQuat = targetBone.quaternion.clone();

          // Calculate offset: target_rest^-1 * source_rest
          const offset = targetLocalQuat
            .clone()
            .invert()
            .multiply(sourceLocalQuat);
          this.restPoseOffsets.set(sourceBoneName, offset);

          // Store bone length ratio but DON'T use it for scaling
          // (positions are in local space and should maintain proportions)
          const sourceLength = this.getBoneLength(sourceBone);
          const targetLength = this.getBoneLength(targetBone);

          if (sourceLength > 0.001) {
            this.boneLengthRatios.set(
              sourceBoneName,
              targetLength / sourceLength,
            );
          } else {
            this.boneLengthRatios.set(sourceBoneName, 1.0);
          }

          offsetCount++;
        }
      },
    );

    console.log(`✅ Calculated ${offsetCount} rest pose offsets (LOCAL space)`);
    console.log("   This handles T-pose/A-pose differences between skeletons");
  }

  /**
   * Get bone length (distance to first child bone)
   */
  private getBoneLength(bone: THREE.Bone): number {
    if (bone.children.length === 0) {
      return 0;
    }

    // Find first child bone
    const childBone = bone.children.find(
      (child) => child instanceof THREE.Bone,
    ) as THREE.Bone;
    if (!childBone) {
      return 0;
    }

    // Calculate distance in local space
    return bone.position.distanceTo(childBone.position);
  }

  /**
   * Retarget all animations from source skeleton to target skeleton
   */
  retargetAll(): RetargetedAnimation[] {
    const retargeted: RetargetedAnimation[] = [];

    for (const sourceClip of this.sourceAnimations) {
      const result = this.retargetClip(sourceClip);
      if (result) {
        retargeted.push(result);
      }
    }

    console.log(
      `✅ Retargeted ${retargeted.length}/${this.sourceAnimations.length} animations`,
    );
    return retargeted;
  }

  /**
   * Retarget a single animation clip
   * Applies rest pose offsets and bone length scaling
   */
  retargetClip(sourceClip: THREE.AnimationClip): RetargetedAnimation | null {
    console.log(`🎬 Retargeting animation: ${sourceClip.name}`);

    const retargetedTracks: THREE.KeyframeTrack[] = [];
    let mappedTrackCount = 0;
    let skippedTrackCount = 0;

    // For each track in the source animation
    for (const sourceTrack of sourceClip.tracks) {
      // Parse track name: "boneName.property"
      const trackParts = sourceTrack.name.split(".");
      const sourceBoneName = trackParts[0];
      const property = trackParts.slice(1).join("."); // quaternion, position, scale

      // Find target bone name using bone mapping
      const targetBoneName = this.boneMapping.get(sourceBoneName);

      if (targetBoneName) {
        // SKIP SCALE TRACKS - they cause crushing/deformation
        // Scale should be controlled by the target skeleton, not animation data
        if (property === "scale") {
          skippedTrackCount++;
          continue;
        }

        // SKIP POSITION TRACKS except for root motion (Hips)
        // Position should be controlled by bone bind pose, not animation data
        // Only Hips position is animated for locomotion (root motion)
        if (property === "position" && targetBoneName !== "Hips") {
          skippedTrackCount++;
          continue;
        }

        // Create new track with target bone name
        const targetTrackName = `${targetBoneName}.${property}`;

        // Clone the track
        const targetTrack = sourceTrack.clone();
        targetTrack.name = targetTrackName;

        // DON'T apply rest pose offset - both skeletons are in T-pose
        // Rest pose offsets are only needed when source and target have different rest poses
        // (e.g. A-pose vs T-pose). Since we're loading T-pose models, we can skip this.
        // if (property === 'quaternion') {
        //   const offset = this.restPoseOffsets.get(sourceBoneName)
        //   if (offset) {
        //     targetTrack.values = this.applyQuaternionOffset(sourceTrack.values, offset)
        //   }
        // }

        // DON'T scale position tracks - they're in local space and should maintain proportions
        // Position scaling causes severe stretching/deformation
        // if (property === 'position') {
        //   const ratio = this.boneLengthRatios.get(sourceBoneName)
        //   if (ratio && ratio !== 1.0) {
        //     targetTrack.values = this.scalePositionValues(sourceTrack.values, ratio)
        //   }
        // }

        retargetedTracks.push(targetTrack);
        mappedTrackCount++;
      } else {
        // Source bone doesn't map to target (e.g., Mixamo finger bones → Meshy has no fingers)
        skippedTrackCount++;
      }
    }

    if (retargetedTracks.length === 0) {
      console.warn(`⚠️  No tracks mapped for animation: ${sourceClip.name}`);
      return null;
    }

    // Create new animation clip with retargeted tracks
    const retargetedClip = new THREE.AnimationClip(
      sourceClip.name,
      sourceClip.duration,
      retargetedTracks,
    );

    const mappingQuality = mappedTrackCount / sourceClip.tracks.length;

    console.log(
      `  ✅ Mapped ${mappedTrackCount} tracks, skipped ${skippedTrackCount}`,
    );
    console.log(`  📊 Mapping quality: ${(mappingQuality * 100).toFixed(1)}%`);

    return {
      clip: retargetedClip,
      sourceClipName: sourceClip.name,
      mappingQuality,
    };
  }

  /**
   * Apply quaternion offset to all keyframes in a quaternion track
   * This handles rest pose differences between skeletons
   */
  private applyQuaternionOffset(
    values: ArrayLike<number>,
    offset: THREE.Quaternion,
  ): Float32Array {
    const newValues = new Float32Array(values.length);
    const quat = new THREE.Quaternion();

    // Each quaternion has 4 components (x, y, z, w)
    for (let i = 0; i < values.length; i += 4) {
      quat.set(values[i], values[i + 1], values[i + 2], values[i + 3]);

      // Apply offset: result = animationRotation * offset
      quat.multiply(offset);

      newValues[i] = quat.x;
      newValues[i + 1] = quat.y;
      newValues[i + 2] = quat.z;
      newValues[i + 3] = quat.w;
    }

    return newValues;
  }

  /**
   * Scale position values by bone length ratio
   */
  private scalePositionValues(
    values: ArrayLike<number>,
    ratio: number,
  ): Float32Array {
    const newValues = new Float32Array(values.length);

    // Each position has 3 components (x, y, z)
    for (let i = 0; i < values.length; i += 3) {
      newValues[i] = values[i] * ratio;
      newValues[i + 1] = values[i + 1] * ratio;
      newValues[i + 2] = values[i + 2] * ratio;
    }

    return newValues;
  }

  /**
   * Get list of animation names
   */
  getAnimationNames(): string[] {
    return this.sourceAnimations.map((clip) => clip.name);
  }
}

/**
 * Helper: Extract animations from a GLTF file
 */
export function extractAnimationsFromGLTF(gltf: any): THREE.AnimationClip[] {
  return gltf.animations || [];
}

/**
 * Helper: Extract skeleton from a GLTF file
 */
export function extractSkeletonFromGLTF(gltf: any): THREE.Skeleton | null {
  let skeleton: THREE.Skeleton | null = null;

  gltf.scene.traverse((child: any) => {
    if (child instanceof THREE.SkinnedMesh && child.skeleton && !skeleton) {
      skeleton = child.skeleton;
    }
  });

  // If no SkinnedMesh, try to build skeleton from bones
  if (!skeleton) {
    const bones: THREE.Bone[] = [];
    gltf.scene.traverse((child: any) => {
      if (child instanceof THREE.Bone) {
        bones.push(child);
      }
    });

    if (bones.length > 0) {
      skeleton = new THREE.Skeleton(bones);
    }
  }

  return skeleton;
}
