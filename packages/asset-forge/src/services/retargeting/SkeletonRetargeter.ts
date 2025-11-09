/**
 * SkeletonRetargeter - Replaces a mesh's skeleton with a new one
 * Transfers geometry and recalculates skin weights
 */

import * as THREE from "three";
import { DistanceSolver } from "./DistanceSolver";
import { DistanceChildTargetingSolver } from "./DistanceChildTargetingSolver";

export type SolverType = "distance" | "distance-child" | "distance-targeting";

export class SkeletonRetargeter {
  /**
   * Find a bone by normalized name pattern
   */
  private static findBoneByPattern(
    bones: THREE.Bone[],
    patterns: string[],
  ): THREE.Bone | null {
    const normalize = (name: string) =>
      name.toLowerCase().replace(/[-_:.]/g, "");
    for (const bone of bones) {
      const normName = normalize(bone.name);
      for (const pattern of patterns) {
        if (normName.includes(normalize(pattern))) {
          return bone;
        }
      }
    }
    return null;
  }
  /**
   * Retarget a SkinnedMesh to a new skeleton
   * CRITICAL: Everything must be in the SAME coordinate space
   * We work in geometry-local space and ignore world transforms until final binding
   */
  static retargetMesh(
    sourceMesh: THREE.SkinnedMesh,
    targetSkeleton: THREE.Skeleton,
    solverType: SolverType = "distance",
    useKeypointAlignment: boolean = true,
  ): THREE.SkinnedMesh {
    console.log(
      `🔄 Retargeting mesh "${sourceMesh.name}" to new skeleton with ${targetSkeleton.bones.length} bones`,
    );
    console.log("=== RETARGET DEBUG ===");

    // Clone geometry (vertices are in LOCAL/geometry space, centered at origin)
    const geometry = sourceMesh.geometry.clone();
    const material = Array.isArray(sourceMesh.material)
      ? sourceMesh.material.map((m) => m.clone())
      : sourceMesh.material.clone();

    // CRITICAL: Get geometry bounds WITHOUT any mesh transforms
    // We need the actual vertex positions in buffer space (not affected by mesh scale)
    geometry.computeBoundingBox();
    const geomBBox =
      geometry.boundingBox ||
      new THREE.Box3().setFromBufferAttribute(
        geometry.attributes.position as THREE.BufferAttribute,
      );
    const geomSize = geomBBox.getSize(new THREE.Vector3());
    console.log(
      "Geometry bounds (local buffer space):",
      geomBBox.min.toArray(),
      "to",
      geomBBox.max.toArray(),
    );
    console.log("Geometry size:", geomSize.toArray());
    console.log(
      "⚠️  If this size seems wrong, the source mesh was pre-scaled by ThreeViewer",
    );

    // CRITICAL: Deep clone the target skeleton to avoid modifying the original
    const clonedSkeleton = targetSkeleton.clone();
    const rootBone = clonedSkeleton.bones[0];

    // Find the actual armature parent (if exists) and detach skeleton from it
    if (rootBone.parent && rootBone.parent.type !== "Scene") {
      rootBone.parent.remove(rootBone);
    }

    // Reset root bone completely - this ensures we start from a clean state
    rootBone.position.set(0, 0, 0);
    rootBone.rotation.set(0, 0, 0);
    rootBone.scale.set(1, 1, 1);
    rootBone.matrix.identity();
    rootBone.matrixWorld.identity();
    rootBone.updateMatrix();
    rootBone.updateMatrixWorld(true);

    console.log(
      "After reset - root bone position:",
      rootBone.position.toArray(),
    );
    console.log("After reset - root bone scale:", rootBone.scale.toArray());

    // CRITICAL: Convert Z-up rig to Y-up (rotate -90° around X-axis)
    // Mesh2Motion rigs are exported Z-up, but Three.js/Meshy use Y-up
    rootBone.rotation.x = -Math.PI / 2;
    rootBone.updateMatrix();
    rootBone.updateMatrixWorld(true);
    console.log("Applied Z-up to Y-up rotation (-90° X)");

    // Get skeleton bounds in WORLD space after reset
    clonedSkeleton.bones.forEach((b) => {
      b.updateMatrix();
      b.updateMatrixWorld(true);
    });

    const skelBBox = new THREE.Box3();
    clonedSkeleton.bones.forEach((bone) => {
      const pos = new THREE.Vector3();
      bone.getWorldPosition(pos);
      skelBBox.expandByPoint(pos);
    });
    const skelSize = skelBBox.getSize(new THREE.Vector3());
    console.log("=== SKELETON INFO ===");
    console.log("Skeleton bone count:", clonedSkeleton.bones.length);
    console.log(
      "Skeleton bounds (world after reset):",
      skelBBox.min.toArray(),
      "to",
      skelBBox.max.toArray(),
    );
    console.log("Skeleton size:", skelSize.toArray());
    console.log("=== GEOMETRY INFO ===");
    console.log(
      "Geometry bounds:",
      geomBBox.min.toArray(),
      "to",
      geomBBox.max.toArray(),
    );
    console.log("Geometry size:", geomSize.toArray());
    console.log("=== SCALE CALCULATION ===");

    // Calculate scale factor using average of all dimensions for better proportions
    const scaleX = geomSize.x / skelSize.x;
    const scaleY = geomSize.y / skelSize.y;
    const scaleZ = geomSize.z / skelSize.z;
    let scaleFactor = (scaleX + scaleY + scaleZ) / 3; // Average for uniform scale
    console.log(
      `Scaling skeleton by ${scaleFactor.toFixed(3)} (x:${scaleX.toFixed(2)}, y:${scaleY.toFixed(2)}, z:${scaleZ.toFixed(2)})`,
    );

    // SANITY CHECK: If scale factor is extreme (>100 or <0.01), something is wrong
    // This usually means the skeleton and geometry are in vastly different units
    if (scaleFactor > 100 || scaleFactor < 0.01) {
      console.warn(
        `⚠️  Extreme scale factor detected (${scaleFactor.toFixed(3)}). Using Y-height only to prevent distortion.`,
      );
      // Fall back to Y-height scaling (most reliable for characters)
      scaleFactor = geomSize.y / skelSize.y;
      console.log(
        `   Adjusted scale factor to ${scaleFactor.toFixed(3)} based on height`,
      );
    }

    rootBone.scale.set(scaleFactor, scaleFactor, scaleFactor);
    rootBone.updateMatrix();
    rootBone.updateMatrixWorld(true);
    clonedSkeleton.bones.forEach((b) => b.updateMatrixWorld(true));

    // Recalculate skeleton bounds after scaling
    const scaledSkelBBox = new THREE.Box3();
    clonedSkeleton.bones.forEach((bone) => {
      const pos = new THREE.Vector3();
      bone.getWorldPosition(pos);
      scaledSkelBBox.expandByPoint(pos);
    });
    console.log(
      "Skeleton bounds (after scale):",
      scaledSkelBBox.min.toArray(),
      "to",
      scaledSkelBBox.max.toArray(),
    );

    // Align skeleton to geometry CENTER (not just bottom) for better fit
    const geomCenter = geomBBox.getCenter(new THREE.Vector3());
    const skelCenter = scaledSkelBBox.getCenter(new THREE.Vector3());
    const offset = geomCenter.clone().sub(skelCenter);

    rootBone.position.x += offset.x;
    rootBone.position.y += offset.y;
    rootBone.position.z += offset.z;
    rootBone.updateMatrix();
    rootBone.updateMatrixWorld(true);
    clonedSkeleton.bones.forEach((b) => b.updateMatrixWorld(true));

    console.log(
      `Center alignment offset: (${offset.x.toFixed(3)}, ${offset.y.toFixed(3)}, ${offset.z.toFixed(3)})`,
    );
    console.log("Final root bone position:", rootBone.position.toArray());

    // Final verification
    const finalSkelBBox = new THREE.Box3();
    clonedSkeleton.bones.forEach((bone) => {
      const pos = new THREE.Vector3();
      bone.getWorldPosition(pos);
      finalSkelBBox.expandByPoint(pos);
    });
    const finalSkelSize = finalSkelBBox.getSize(new THREE.Vector3());
    console.log(
      "Final skeleton bounds:",
      finalSkelBBox.min.toArray(),
      "to",
      finalSkelBBox.max.toArray(),
    );
    console.log("Final skeleton size:", finalSkelSize.toArray());
    console.log("Expected size:", geomSize.toArray());
    console.log("=== END DEBUG ===");

    // Calculate skin weights using the positioned skeleton
    const solver = this.createSolver(
      solverType,
      geometry,
      clonedSkeleton.bones,
    );
    const { skinIndices, skinWeights } = solver.calculateWeights();

    // Apply skin attributes
    geometry.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute(skinIndices, 4),
    );
    geometry.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute(skinWeights, 4),
    );

    // Create new SkinnedMesh
    const newMesh = new THREE.SkinnedMesh(geometry, material);
    newMesh.name = sourceMesh.name + "_retargeted";
    newMesh.castShadow = sourceMesh.castShadow;
    newMesh.receiveShadow = sourceMesh.receiveShadow;

    // DON'T copy transforms - new mesh should be at origin
    newMesh.position.set(0, 0, 0);
    newMesh.rotation.set(0, 0, 0);
    newMesh.scale.set(1, 1, 1);

    // Bind to cloned skeleton
    newMesh.add(rootBone);
    newMesh.bind(clonedSkeleton);

    console.log(`✅ Mesh retargeted and bound to new skeleton`);
    return newMesh;
  }

  /**
   * Extract skeleton from a rigged model
   */
  static extractSkeleton(model: THREE.Object3D): THREE.Skeleton | null {
    let skeleton: THREE.Skeleton | null = null;
    model.traverse((child) => {
      if (!skeleton && child instanceof THREE.SkinnedMesh && child.skeleton) {
        skeleton = child.skeleton;
      }
    });
    return skeleton;
  }

  /**
   * Extract all SkinnedMesh objects from a model
   */
  static extractSkinnedMeshes(model: THREE.Object3D): THREE.SkinnedMesh[] {
    const meshes: THREE.SkinnedMesh[] = [];
    model.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh) {
        meshes.push(child);
      }
    });
    return meshes;
  }

  /**
   * Calculate offset to align key anatomical bones (hips) between source and target
   * This ensures shoulders/hips/hands line up correctly despite proportion differences
   */
  private static calculateKeypointAlignment(
    sourceSkeleton: THREE.Skeleton,
    targetSkeleton: THREE.Skeleton,
  ): THREE.Vector3 | null {
    // Find hips bone in both skeletons (most stable reference point)
    const sourceHips = this.findBoneByPattern(sourceSkeleton.bones, [
      "hips",
      "pelvis",
      "spine",
    ]);
    const targetHips = this.findBoneByPattern(targetSkeleton.bones, [
      "hips",
      "pelvis",
      "spine",
    ]);

    if (!sourceHips || !targetHips) {
      console.warn("Could not find hips bones for keypoint alignment");
      return null;
    }

    // Get world positions
    const sourcePosWorld = new THREE.Vector3();
    sourceHips.getWorldPosition(sourcePosWorld);

    const targetPosWorld = new THREE.Vector3();
    targetHips.getWorldPosition(targetPosWorld);

    // Calculate offset needed to align target hips to source hips
    const offset = sourcePosWorld.clone().sub(targetPosWorld);

    console.log("Keypoint alignment (hips):");
    console.log(`  Source hips: ${sourcePosWorld.toArray()}`);
    console.log(`  Target hips: ${targetPosWorld.toArray()}`);
    console.log(`  Offset: ${offset.toArray()}`);

    return offset;
  }

  /**
   * Create a weight solver for calculating skin weights
   * PUBLIC: Used by ThreeViewer for manual retargeting workflow
   */
  static createSolver(
    type: SolverType,
    geometry: THREE.BufferGeometry,
    bones: THREE.Bone[],
  ) {
    switch (type) {
      case "distance":
        return new DistanceSolver(geometry, bones);
      case "distance-child":
      case "distance-targeting":
        return new DistanceChildTargetingSolver(geometry, bones);
      default:
        return new DistanceChildTargetingSolver(geometry, bones); // Use smart solver by default
    }
  }

  /**
   * Apply T-Pose animation to skeleton for proper binding
   * PUBLIC: Used by ThreeViewer for manual retargeting workflow
   */
  static async applyTPoseToSkeleton(skeleton: THREE.Skeleton): Promise<void> {
    const { GLTFLoader } = await import(
      "three/examples/jsm/loaders/GLTFLoader.js"
    );
    const loader = new GLTFLoader();

    try {
      const gltf = await loader.loadAsync(
        "/rigs/animations/human-base-animations.glb",
      );
      const tPoseAnim = gltf.animations.find(
        (anim) => anim.name === "T-Pose" || anim.name === "TPose",
      );

      if (!tPoseAnim) {
        console.warn("T-Pose animation not found in human-base-animations.glb");
        return;
      }

      // Build bone map for faster lookup
      const boneMap = new Map<string, THREE.Bone>();
      skeleton.bones.forEach((bone) => {
        boneMap.set(bone.name, bone);
      });

      // Apply first frame of T-Pose animation to each bone
      tPoseAnim.tracks.forEach((track) => {
        const boneName = track.name.split(".")[0];
        const property = track.name.split(".").pop();
        const bone = boneMap.get(boneName);

        if (bone && property === "quaternion" && track.values.length >= 4) {
          const values = track.values;
          bone.quaternion.set(values[0], values[1], values[2], values[3]);
        } else if (
          bone &&
          property === "position" &&
          track.values.length >= 3
        ) {
          const values = track.values;
          bone.position.set(values[0], values[1], values[2]);
        }
      });

      // Update matrices after applying T-pose
      skeleton.bones.forEach((bone) => bone.updateMatrixWorld(true));

      console.log("✓ T-pose applied to skeleton");
    } catch (error) {
      console.error("Failed to apply T-pose:", error);
    }
  }
}
