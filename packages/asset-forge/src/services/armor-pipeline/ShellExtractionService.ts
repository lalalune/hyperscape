import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

import type {
  EquipmentSlotName,
  BulkClass,
  BodyRegion,
  ShellMesh,
  ShellExtractionResult,
  ShellExtractionProgress,
} from "./types";
import { SLOT_BONE_MAP, SLOT_PARTIAL_BONES, BULK_OFFSETS } from "./types";

type ProgressCallback = (progress: ShellExtractionProgress) => void;

/** Per-bulk-class smoothing parameters. Thicker shells get more smoothing. */
const SMOOTH_PARAMS: Record<BulkClass, { iterations: number; factor: number }> =
  {
    skin: { iterations: 4, factor: 0.2 },
    cloth: { iterations: 6, factor: 0.25 },
    leather: { iterations: 8, factor: 0.3 },
    plate: { iterations: 12, factor: 0.35 },
  };

/**
 * ShellExtractionService — POC-1 implementation
 *
 * Extracts body regions from a VRM avatar by bone weight analysis,
 * then offsets them along vertex normals to create "shell" meshes
 * at various bulk classes (skin, cloth, leather, plate).
 *
 * Features:
 * - Curvature-adaptive offset clamping (prevents self-intersection at concavities)
 * - Body-constrained Laplacian smooth (enforces minimum distance from body surface)
 * - Boundary edge tapering (smooth falloff at shell edges)
 * - Per-bulk-class smooth parameters (thicker shells get more smoothing)
 */
export class ShellExtractionService {
  private loader: GLTFLoader;

  constructor() {
    this.loader = new GLTFLoader();
    this.loader.register((parser) => new VRMLoaderPlugin(parser));
  }

  /**
   * Load a VRM avatar and extract shell meshes for all slots and bulk classes.
   */
  async extractShells(
    vrmUrl: string,
    slots: EquipmentSlotName[] = ["helmet", "body", "legs", "boots", "gloves"],
    bulkClasses: BulkClass[] = ["skin", "cloth", "leather", "plate"],
    onProgress?: ProgressCallback,
    /** Optional custom offset in metres. Generates extra shells keyed `${slot}_custom`. */
    customOffsetM?: number,
  ): Promise<ShellExtractionResult> {
    onProgress?.({
      stage: "loading",
      progress: 0,
      message: "Loading VRM avatar...",
    });

    const {
      skinnedMesh,
      skeleton,
      vrm,
      scene: vrmScene,
    } = await this.loadVRM(vrmUrl);
    const geometry = skinnedMesh.geometry;

    vrmScene.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(vrmScene);
    const avatarHeight = bbox.max.y - bbox.min.y;

    onProgress?.({
      stage: "loading",
      progress: 1,
      message: `VRM loaded. ${geometry.attributes.position.count} vertices, height ${avatarHeight.toFixed(3)}m`,
    });

    // Extract body regions by bone weight
    onProgress?.({
      stage: "regions",
      progress: 0,
      message: "Extracting body regions by bone weight...",
    });

    const boneNameToIndex = this.buildBoneNameMap(skeleton, vrm);

    const { regions, interSlotBoundaryVerts, processedGeometry } =
      this.extractExclusiveRegions(geometry, boneNameToIndex, slots);

    for (const slot of slots) {
      const region = regions.get(slot)!;
      onProgress?.({
        stage: "regions",
        slotName: slot,
        progress: 1,
        message: `Region "${slot}": ${region.vertexIndices.length} verts, ${region.triangleIndices.length / 3} tris`,
      });
    }

    // Generate offset shells using the preprocessed geometry
    // (has extra vertices from isoline triangle splitting for smooth boundaries)
    const shells = new Map<string, ShellMesh>();
    const hasCustom = customOffsetM != null && customOffsetM > 0;
    const totalShells =
      slots.length * (bulkClasses.length + (hasCustom ? 1 : 0));
    let shellIndex = 0;

    for (const slot of slots) {
      const region = regions.get(slot)!;
      for (const bulk of bulkClasses) {
        const key = `${slot}_${bulk}`;

        onProgress?.({
          stage: "offsetting",
          slotName: slot,
          bulkClass: bulk,
          progress: shellIndex / totalShells,
          message: `Shell: ${slot}/${bulk} (${BULK_OFFSETS[bulk] * 1000}mm)...`,
        });

        const shell = this.createShell(
          processedGeometry,
          skeleton,
          region,
          slot,
          bulk,
          interSlotBoundaryVerts,
        );
        shells.set(key, shell);
        shellIndex++;
      }

      // Generate custom-offset shell if requested
      if (hasCustom) {
        const key = `${slot}_custom`;
        const mmLabel = (customOffsetM! * 1000).toFixed(0);

        onProgress?.({
          stage: "offsetting",
          slotName: slot,
          progress: shellIndex / totalShells,
          message: `Shell: ${slot}/custom (${mmLabel}mm)...`,
        });

        const shell = this.createShell(
          processedGeometry,
          skeleton,
          region,
          slot,
          "plate",
          interSlotBoundaryVerts,
          customOffsetM,
        );
        shells.set(key, shell);
        shellIndex++;
      }
    }

    onProgress?.({
      stage: "complete",
      progress: 1,
      message: `Done. ${shells.size} shells across ${slots.length} slots.`,
    });

    return {
      regions,
      shells,
      avatarSkeleton: skeleton,
      avatarHeight,
      skinnedMesh,
      vrmScene,
      vrm,
      processedGeometry,
    };
  }

  /**
   * Load VRM and find the primary SkinnedMesh.
   */
  async loadVRM(url: string): Promise<{
    skinnedMesh: THREE.SkinnedMesh;
    skeleton: THREE.Skeleton;
    vrm: Record<string, unknown>;
    scene: THREE.Scene;
  }> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          const vrm = gltf.userData.vrm;
          if (!vrm) {
            reject(new Error("Not a valid VRM file — no VRM data found"));
            return;
          }

          // Handle VRM 0.0 rotation synchronously (VRMUtils is statically imported)
          const meta = (vrm as Record<string, Record<string, string>>).meta;
          const vrmVersion =
            meta?.metaVersion ||
            (meta?.specVersion?.startsWith("0.") ? "0" : "1");
          if (vrmVersion === "0") {
            VRMUtils.rotateVRM0(vrm);
          }

          const vrmScene = (vrm as Record<string, THREE.Scene>).scene;
          const sceneToUse = vrmScene || gltf.scene;

          // Find the primary SkinnedMesh (usually "Body" or the largest one)
          let primaryMesh: THREE.SkinnedMesh | null = null;
          let maxVertices = 0;

          sceneToUse.traverse((child) => {
            if (child instanceof THREE.SkinnedMesh) {
              const count = child.geometry.attributes.position?.count ?? 0;
              if (count > maxVertices) {
                maxVertices = count;
                primaryMesh = child;
              }
            }
          });

          if (!primaryMesh) {
            reject(new Error("No SkinnedMesh found in VRM"));
            return;
          }

          sceneToUse.updateMatrixWorld(true);

          const mesh = primaryMesh as THREE.SkinnedMesh;
          resolve({
            skinnedMesh: mesh,
            skeleton: mesh.skeleton,
            vrm: vrm as Record<string, unknown>,
            scene: sceneToUse as THREE.Scene,
          });
        },
        undefined,
        (error) => reject(error),
      );
    });
  }

  /**
   * Build a map from VRM humanoid bone names to skeleton bone indices.
   *
   * Tries multiple bone sources (public API, raw, normalized) and picks
   * whichever maps the most bones. This is critical because normalized
   * bone nodes are often different objects from skeleton bones, causing
   * indexOf() to silently fail for limb bones.
   */
  /**
   * Common bone name aliases used by different VRM creators.
   * Key = VRM standard name, values = common alternative names (lowercase).
   */
  private static readonly BONE_ALIASES: Record<string, string[]> = {
    spine: ["spine"],
    chest: ["spine01", "spine1", "chest"],
    upperChest: ["spine02", "spine2", "upperchest", "upper_chest"],
    leftUpperArm: ["leftarm", "left_upperarm", "l_upperarm"],
    leftLowerArm: ["leftforearm", "left_lowerarm", "l_lowerarm"],
    rightUpperArm: ["rightarm", "right_upperarm", "r_upperarm"],
    rightLowerArm: ["rightforearm", "right_lowerarm", "r_lowerarm"],
    leftUpperLeg: ["leftupleg", "left_upperleg", "l_upperleg", "lefthighleg"],
    leftLowerLeg: ["leftleg", "left_lowerleg", "l_lowerleg", "leftshinleg"],
    rightUpperLeg: [
      "rightupleg",
      "right_upperleg",
      "r_upperleg",
      "righthighleg",
    ],
    rightLowerLeg: ["rightleg", "right_lowerleg", "r_lowerleg", "rightshinleg"],
    leftToes: ["lefttoebase", "lefttoe", "left_toes"],
    rightToes: ["righttoebase", "righttoe", "right_toes"],
  };

  private buildBoneNameMap(
    skeleton: THREE.Skeleton,
    vrm: Record<string, unknown>,
  ): Map<string, number> {
    const allBoneNames = [
      "hips",
      "spine",
      "chest",
      "upperChest",
      "neck",
      "head",
      "leftShoulder",
      "leftUpperArm",
      "leftLowerArm",
      "leftHand",
      "rightShoulder",
      "rightUpperArm",
      "rightLowerArm",
      "rightHand",
      "leftUpperLeg",
      "leftLowerLeg",
      "leftFoot",
      "leftToes",
      "rightUpperLeg",
      "rightLowerLeg",
      "rightFoot",
      "rightToes",
    ];

    const humanoid = (vrm as Record<string, Record<string, unknown>>).humanoid;
    if (humanoid) {
      // Collect all possible bone dictionaries to try
      const boneSources: { name: string; bones: Record<string, unknown> }[] =
        [];

      // 1. Public humanBones property (returns raw bones — most reliable)
      const publicBones = (humanoid as Record<string, unknown>).humanBones;
      if (publicBones && typeof publicBones === "object") {
        boneSources.push({
          name: "public",
          bones: publicBones as Record<string, unknown>,
        });
      }

      // 2. Raw human bones (internal, should match skeleton)
      const rawSrc = (humanoid as Record<string, Record<string, unknown>>)
        ._rawHumanBones;
      if (rawSrc?.humanBones && typeof rawSrc.humanBones === "object") {
        boneSources.push({
          name: "raw",
          bones: rawSrc.humanBones as Record<string, unknown>,
        });
      }

      // 3. Normalized human bones (internal, may NOT match skeleton)
      const normSrc = (humanoid as Record<string, Record<string, unknown>>)
        ._normalizedHumanBones;
      if (normSrc?.humanBones && typeof normSrc.humanBones === "object") {
        boneSources.push({
          name: "normalized",
          bones: normSrc.humanBones as Record<string, unknown>,
        });
      }

      // Try each source, keep whichever maps the most bones
      let bestMap = new Map<string, number>();
      let bestSource = "none";

      for (const { name, bones: source } of boneSources) {
        const candidate = new Map<string, number>();
        for (const boneName of allBoneNames) {
          const boneData = source[boneName] as
            | Record<string, unknown>
            | undefined;
          const node = boneData?.node as THREE.Object3D | undefined;
          if (node) {
            const idx = skeleton.bones.indexOf(node as THREE.Bone);
            if (idx >= 0) {
              candidate.set(boneName, idx);
            }
          }
        }
        if (candidate.size > bestMap.size) {
          bestMap = candidate;
          bestSource = name;
        }
      }

      if (bestMap.size > 0) {
        console.log(
          `[ShellExtraction] Bone mapping via VRM humanoid (${bestSource}): ${bestMap.size}/${allBoneNames.length} bones`,
        );
        if (bestMap.size < allBoneNames.length) {
          const missing = allBoneNames.filter((b) => !bestMap.has(b));
          console.warn(
            `[ShellExtraction] Missing bones: ${missing.join(", ")}`,
          );
        }
        return bestMap;
      }
    }

    // Fallback: match skeleton bone names by string (with alias support)
    console.warn(
      "[ShellExtraction] VRM humanoid metadata failed — using fallback bone name matching",
    );
    const map = new Map<string, number>();
    // Pre-build lowercase bone name lookup
    const boneNameLower = skeleton.bones.map((b) => b.name.toLowerCase());

    for (const vrmName of allBoneNames) {
      const lowerName = vrmName.toLowerCase();

      // Try exact match first
      let idx = boneNameLower.indexOf(lowerName);

      // Try aliases (common non-standard names used by VRM creators)
      if (idx < 0) {
        const aliases = ShellExtractionService.BONE_ALIASES[vrmName] ?? [];
        for (const alias of aliases) {
          idx = boneNameLower.indexOf(alias);
          if (idx >= 0) break;
        }
      }

      if (idx >= 0) {
        map.set(vrmName, idx);
      }
    }

    console.log(
      `[ShellExtraction] Fallback bone mapping: ${map.size}/${allBoneNames.length} bones`,
    );
    if (map.size < allBoneNames.length) {
      const missing = allBoneNames.filter((b) => !map.has(b));
      console.warn(`[ShellExtraction] Missing bones: ${missing.join(", ")}`);
    }
    return map;
  }

  /**
   * Extract exclusive body regions — each vertex belongs to exactly one slot
   * (whichever has the highest bone weight). This eliminates overlap at
   * boundaries, producing clean color transitions instead of Z-fighting mix.
   *
   * Triangles are assigned by majority vote (2-of-3 vertices), so boundary
   * triangles go to the dominant side rather than being duplicated or dropped.
   */
  private extractExclusiveRegions(
    geometry: THREE.BufferGeometry,
    boneNameToIndex: Map<string, number>,
    slots: EquipmentSlotName[],
  ): {
    regions: Map<EquipmentSlotName, BodyRegion>;
    interSlotBoundaryVerts: Set<number>;
    /** Preprocessed geometry with extra vertices from isoline triangle splitting */
    processedGeometry: THREE.BufferGeometry;
  } {
    const position = geometry.attributes.position as THREE.BufferAttribute;
    const normal = geometry.attributes.normal as THREE.BufferAttribute;
    const skinIndex = geometry.attributes.skinIndex as THREE.BufferAttribute;
    const skinWeight = geometry.attributes.skinWeight as THREE.BufferAttribute;
    const srcUV = geometry.attributes.uv as THREE.BufferAttribute | undefined;
    const index = geometry.index;
    const origVertCount = position.count;

    // ── Phase 1: Compute per-vertex weight score for each slot ──
    const slotConfigs = new Map<
      EquipmentSlotName,
      { bones: Set<number>; partialCaps: Map<number, number> }
    >();

    for (const slot of slots) {
      const bones = new Set<number>();
      const partialCaps = new Map<number, number>();
      for (const boneName of SLOT_BONE_MAP[slot]) {
        const idx = boneNameToIndex.get(boneName);
        if (idx !== undefined) bones.add(idx);
      }
      const partials = SLOT_PARTIAL_BONES[slot];
      if (partials) {
        for (const { boneName, maxWeight } of partials) {
          const idx = boneNameToIndex.get(boneName);
          if (idx !== undefined) {
            bones.add(idx);
            partialCaps.set(idx, maxWeight);
          }
        }
      }
      slotConfigs.set(slot, { bones, partialCaps });
    }

    // Per-vertex weight for each slot (used as the isoline scalar field)
    const slotWeightArrays = new Map<EquipmentSlotName, Float32Array>();
    for (const slot of slots) {
      slotWeightArrays.set(slot, new Float32Array(origVertCount));
    }

    for (let i = 0; i < origVertCount; i++) {
      for (const slot of slots) {
        const { bones, partialCaps } = slotConfigs.get(slot)!;
        let w = 0;
        for (let j = 0; j < 4; j++) {
          const boneIdx = skinIndex.getComponent(i, j);
          const weight = skinWeight.getComponent(i, j);
          if (bones.has(boneIdx)) {
            const cap = partialCaps.get(boneIdx);
            w += cap !== undefined ? Math.min(weight, cap) : weight;
          }
        }
        slotWeightArrays.get(slot)![i] = w;
      }
    }

    // ── Phase 2: Laplacian-smooth slot weights for smooth isolines ──
    // Critical: GLTF splits vertices at UV seams. These split vertices are NOT
    // connected in the mesh adjacency, creating invisible barriers in the weight
    // field. We bridge UV seams by finding coincident vertex groups (same position,
    // different normals/UVs) and merging their adjacency neighborhoods.
    if (index) {
      // Find coincident vertex groups (UV-seam splits share positions)
      const QUANT = 10000; // 0.1mm precision
      const posToGroup = new Map<string, number[]>();
      for (let i = 0; i < origVertCount; i++) {
        const key = `${Math.round(position.getX(i) * QUANT)},${Math.round(position.getY(i) * QUANT)},${Math.round(position.getZ(i) * QUANT)}`;
        let group = posToGroup.get(key);
        if (!group) {
          group = [];
          posToGroup.set(key, group);
        }
        group.push(i);
      }
      const weightCoincidentGroups = Array.from(posToGroup.values()).filter(
        (g) => g.length > 1,
      );

      // Build adjacency with UV-seam bridging
      const adjSets: Set<number>[] = new Array(origVertCount);
      for (let i = 0; i < origVertCount; i++) adjSets[i] = new Set();

      // Standard mesh-edge adjacency
      for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i),
          b = index.getX(i + 1),
          c = index.getX(i + 2);
        adjSets[a].add(b);
        adjSets[a].add(c);
        adjSets[b].add(a);
        adjSets[b].add(c);
        adjSets[c].add(a);
        adjSets[c].add(b);
      }

      // Bridge UV seams: each coincident vertex shares all neighbors + group members
      for (const group of weightCoincidentGroups) {
        const merged = new Set<number>();
        for (const vi of group) {
          for (const n of adjSets[vi]) merged.add(n);
          for (const vj of group) {
            if (vi !== vj) merged.add(vj);
          }
        }
        for (const vi of group) {
          for (const n of merged) {
            if (n !== vi) adjSets[vi].add(n);
          }
        }
      }

      const adj: number[][] = new Array(origVertCount);
      for (let i = 0; i < origVertCount; i++) adj[i] = Array.from(adjSets[i]);

      console.log(
        `[ShellExtraction] Weight smoothing: ${weightCoincidentGroups.length} coincident groups bridged across UV seams`,
      );

      // Smooth with enough iterations for ~7-ring diffusion radius (sqrt(50) ≈ 7)
      const WEIGHT_SMOOTH_ITERS = 50;
      for (const slot of slots) {
        const weights = slotWeightArrays.get(slot)!;
        const temp = new Float32Array(origVertCount);
        for (let iter = 0; iter < WEIGHT_SMOOTH_ITERS; iter++) {
          temp.set(weights); // Jacobi: read from snapshot
          for (let i = 0; i < origVertCount; i++) {
            const neighbors = adj[i];
            if (neighbors.length === 0) continue;
            let sum = temp[i];
            for (const n of neighbors) sum += temp[n];
            weights[i] = sum / (neighbors.length + 1);
          }
          // Enforce coincident consistency — UV-seam-split vertices must
          // have identical weights so the scalar field is continuous across seams
          for (const group of weightCoincidentGroups) {
            let avg = 0;
            for (const vi of group) avg += weights[vi];
            avg /= group.length;
            for (const vi of group) weights[vi] = avg;
          }
        }
      }
    }

    // ── Phase 3: Assign vertices to best slot using smoothed weights ──
    const vertexSlot = new Array<EquipmentSlotName | null>(origVertCount).fill(
      null,
    );
    const MIN_WEIGHT = 0.05;

    for (let i = 0; i < origVertCount; i++) {
      let bestSlot: EquipmentSlotName | null = null;
      let bestWeight = MIN_WEIGHT;
      for (const slot of slots) {
        const w = slotWeightArrays.get(slot)![i];
        if (w > bestWeight) {
          bestWeight = w;
          bestSlot = slot;
        }
      }
      vertexSlot[i] = bestSlot;
    }

    // ── Phase 4: Marching Triangles — split boundary triangles at isoline ──
    // Instead of assigning whole triangles by majority vote (jagged boundaries),
    // we split triangles that straddle a slot boundary. New vertices are created
    // at the exact point where the bone-weight isoline crosses each edge,
    // producing a smooth boundary curve.

    if (!index) {
      throw new Error(
        "ShellExtractionService requires indexed geometry. The loaded VRM mesh has no index buffer.",
      );
    }

    // Extended vertex data: original vertices + new isoline boundary vertices
    const extPos: number[] = [];
    const extNorm: number[] = [];
    const extUV: number[] = [];
    const extSkinIdx: number[] = [];
    const extSkinWt: number[] = [];
    const extSlot: (EquipmentSlotName | null)[] = [];

    // Copy original vertex data into growable arrays
    for (let i = 0; i < origVertCount; i++) {
      extPos.push(position.getX(i), position.getY(i), position.getZ(i));
      extNorm.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      if (srcUV) extUV.push(srcUV.getX(i), srcUV.getY(i));
      for (let j = 0; j < 4; j++) {
        extSkinIdx.push(skinIndex.getComponent(i, j));
        extSkinWt.push(skinWeight.getComponent(i, j));
      }
      extSlot.push(vertexSlot[i]);
    }

    // Edge → new vertex index cache (shared edges only split once)
    const edgeCache = new Map<string, number>();
    const edgeKey = (a: number, b: number) =>
      a < b ? `${a}_${b}` : `${b}_${a}`;

    /** Safe read from number[] — returns fallback for out-of-bounds / undefined */
    const safeRead = (arr: number[], idx: number, fallback: number): number => {
      const v = arr[idx];
      return v !== undefined && Number.isFinite(v) ? v : fallback;
    };

    /** Create a new vertex by interpolating between two existing vertices at parameter t */
    const createSplitVertex = (
      idxA: number,
      idxB: number,
      t: number,
    ): number => {
      const key = edgeKey(idxA, idxB);
      const cached = edgeCache.get(key);
      if (cached !== undefined) return cached;

      // Clamp t to safe range — NaN/Inf becomes midpoint
      const safeT = Number.isFinite(t) && t >= 0 && t <= 1 ? t : 0.5;
      const newIdx = extPos.length / 3;
      const s = 1 - safeT;

      // Read source positions with safety (undefined from OOB → 0)
      const ax = safeRead(extPos, idxA * 3, 0),
        ay = safeRead(extPos, idxA * 3 + 1, 0),
        az = safeRead(extPos, idxA * 3 + 2, 0);
      const bx = safeRead(extPos, idxB * 3, 0),
        by = safeRead(extPos, idxB * 3 + 1, 0),
        bz = safeRead(extPos, idxB * 3 + 2, 0);

      extPos.push(
        ax * s + bx * safeT,
        ay * s + by * safeT,
        az * s + bz * safeT,
      );

      // Normal (interpolate + renormalize, fallback to up vector)
      const anx = safeRead(extNorm, idxA * 3, 0),
        any_ = safeRead(extNorm, idxA * 3 + 1, 1),
        anz = safeRead(extNorm, idxA * 3 + 2, 0);
      const bnx = safeRead(extNorm, idxB * 3, 0),
        bny = safeRead(extNorm, idxB * 3 + 1, 1),
        bnz = safeRead(extNorm, idxB * 3 + 2, 0);
      let nx = anx * s + bnx * safeT;
      let ny = any_ * s + bny * safeT;
      let nz = anz * s + bnz * safeT;
      const lenSq = nx * nx + ny * ny + nz * nz;
      if (lenSq > 1e-16) {
        const invLen = 1 / Math.sqrt(lenSq);
        nx *= invLen;
        ny *= invLen;
        nz *= invLen;
      } else {
        // Degenerate: fall back to up vector
        nx = 0;
        ny = 1;
        nz = 0;
      }
      extNorm.push(nx, ny, nz);

      // UV
      if (srcUV) {
        const au = safeRead(extUV, idxA * 2, 0),
          av = safeRead(extUV, idxA * 2 + 1, 0);
        const bu = safeRead(extUV, idxB * 2, 0),
          bv = safeRead(extUV, idxB * 2 + 1, 0);
        extUV.push(au * s + bu * safeT, av * s + bv * safeT);
      }

      // Skin: use bone indices from the closer endpoint, interpolate weights
      const srcSkin = safeT < 0.5 ? idxA : idxB;
      for (let j = 0; j < 4; j++) {
        extSkinIdx.push(safeRead(extSkinIdx, srcSkin * 4 + j, 0));
        const wa = safeRead(extSkinWt, idxA * 4 + j, 0);
        const wb = safeRead(extSkinWt, idxB * 4 + j, 0);
        extSkinWt.push(wa * s + wb * safeT);
      }

      extSlot.push(null); // boundary vertex — slot determined by triangle
      edgeCache.set(key, newIdx);
      return newIdx;
    };

    // Process each triangle: keep uniform ones, split boundary ones
    const slotVertexSets = new Map<EquipmentSlotName, Set<number>>();
    const slotTriangles = new Map<EquipmentSlotName, number[]>();
    for (const slot of slots) {
      slotVertexSets.set(slot, new Set());
      slotTriangles.set(slot, []);
    }

    const addTriToSlot = (
      slot: EquipmentSlotName,
      a: number,
      b: number,
      c: number,
    ) => {
      slotTriangles.get(slot)!.push(a, b, c);
      slotVertexSets.get(slot)!.add(a);
      slotVertexSets.get(slot)!.add(b);
      slotVertexSets.get(slot)!.add(c);
    };

    let splitCount = 0;

    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i);
      const b = index.getX(i + 1);
      const c = index.getX(i + 2);
      const sa = vertexSlot[a],
        sb = vertexSlot[b],
        sc = vertexSlot[c];

      // All same slot → keep as-is
      if (sa === sb && sb === sc) {
        if (sa) addTriToSlot(sa, a, b, c);
        continue;
      }

      // Find which 2 slots are involved
      const present = new Set<EquipmentSlotName>();
      if (sa) present.add(sa);
      if (sb) present.add(sb);
      if (sc) present.add(sc);

      if (present.size !== 2) {
        // Edge case (0, 1, or 3 slots) — assign to first available
        const fallback = sa ?? sb ?? sc;
        if (fallback) addTriToSlot(fallback, a, b, c);
        continue;
      }

      const [slotX, slotY] = Array.from(present);
      const wxArr = slotWeightArrays.get(slotX)!;
      const wyArr = slotWeightArrays.get(slotY)!;

      // Scalar field: positive = slotX territory, negative = slotY territory
      const fA = (wxArr[a] ?? 0) - (wyArr[a] ?? 0);
      const fB = (wxArr[b] ?? 0) - (wyArr[b] ?? 0);
      const fC = (wxArr[c] ?? 0) - (wyArr[c] ?? 0);

      const sideA = fA >= 0; // true = slotX side
      const sideB = fB >= 0;
      const sideC = fC >= 0;

      // All on same side (field disagrees with slot assignment) → keep as-is
      if (sideA === sideB && sideB === sideC) {
        const fallback = sideA ? slotX : slotY;
        addTriToSlot(fallback, a, b, c);
        continue;
      }

      // Find the lone vertex (odd one out)
      let lone: number, pair1: number, pair2: number;
      let fLone: number, fPair1: number, fPair2: number;
      let loneSide: boolean;

      if (sideA !== sideB && sideA !== sideC) {
        lone = a;
        pair1 = b;
        pair2 = c;
        fLone = fA;
        fPair1 = fB;
        fPair2 = fC;
        loneSide = sideA;
      } else if (sideB !== sideA && sideB !== sideC) {
        lone = b;
        pair1 = a;
        pair2 = c;
        fLone = fB;
        fPair1 = fA;
        fPair2 = fC;
        loneSide = sideB;
      } else {
        lone = c;
        pair1 = a;
        pair2 = b;
        fLone = fC;
        fPair1 = fA;
        fPair2 = fB;
        loneSide = sideC;
      }

      // Interpolation params (clamped to avoid degenerate slivers)
      // Guard: when smoothed weights are equal, denominator is 0 → NaN
      const denom1 = fLone - fPair1;
      const t1 =
        Math.abs(denom1) < 1e-10
          ? 0.5
          : Math.max(0.02, Math.min(0.98, fLone / denom1));
      const denom2 = fLone - fPair2;
      const t2 =
        Math.abs(denom2) < 1e-10
          ? 0.5
          : Math.max(0.02, Math.min(0.98, fLone / denom2));

      // Create new vertices at the isoline crossing points
      const nv1 = createSplitVertex(lone, pair1, t1);
      const nv2 = createSplitVertex(lone, pair2, t2);

      // Split into 3 sub-triangles
      const loneSlot = loneSide ? slotX : slotY;
      const pairSlot = loneSide ? slotY : slotX;

      // Lone side: 1 triangle
      addTriToSlot(loneSlot, lone, nv1, nv2);
      // Pair side: 2 triangles (quad)
      addTriToSlot(pairSlot, nv1, pair1, pair2);
      addTriToSlot(pairSlot, nv1, pair2, nv2);

      splitCount++;
    }

    const totalVertCount = extPos.length / 3;
    console.log(
      `[ShellExtraction] Marching Triangles: ${splitCount} boundary tris split, ${totalVertCount - origVertCount} new vertices created`,
    );

    // ── Phase 5: Build preprocessed geometry with new vertices ──
    // Validate extended arrays before building typed arrays (JS number[] can have undefined → NaN)
    const posF32 = new Float32Array(extPos);
    const normF32 = new Float32Array(extNorm);
    this.sanitizeFloatArray(posF32, 3, null, 0, "procGeo.position");
    this.sanitizeFloatArray(normF32, 3, null, 0, "procGeo.normal");

    const procGeo = new THREE.BufferGeometry();
    procGeo.setAttribute("position", new THREE.BufferAttribute(posF32, 3));
    procGeo.setAttribute("normal", new THREE.BufferAttribute(normF32, 3));
    if (srcUV && extUV.length > 0) {
      procGeo.setAttribute(
        "uv",
        new THREE.BufferAttribute(new Float32Array(extUV), 2),
      );
    }
    procGeo.setAttribute(
      "skinIndex",
      new THREE.BufferAttribute(new Float32Array(extSkinIdx), 4),
    );
    procGeo.setAttribute(
      "skinWeight",
      new THREE.BufferAttribute(new Float32Array(extSkinWt), 4),
    );

    // ── Phase 6: Build BodyRegion for each slot ──
    const regions = new Map<EquipmentSlotName, BodyRegion>();
    const tempVec = new THREE.Vector3();
    const procPosition = procGeo.attributes.position as THREE.BufferAttribute;

    for (const slot of slots) {
      const vertexSet = slotVertexSets.get(slot)!;
      const triangleIndices = slotTriangles.get(slot)!;
      const vertexIndices = Array.from(vertexSet);

      const boundingBox = new THREE.Box3();
      const center = new THREE.Vector3();

      for (const vi of vertexIndices) {
        tempVec.fromBufferAttribute(procPosition, vi);
        boundingBox.expandByPoint(tempVec);
        center.add(tempVec);
      }

      if (vertexIndices.length > 0) {
        center.divideScalar(vertexIndices.length);
      }

      const boneIndices = new Set<number>();
      const { bones } = slotConfigs.get(slot)!;
      for (const boneIdx of bones) boneIndices.add(boneIdx);

      regions.set(slot, {
        slotName: slot,
        vertexIndices,
        triangleIndices,
        boundingBox,
        center,
        boneIndices,
      });
    }

    // ── Phase 7: Compute inter-slot boundary vertices ──
    const interSlotBoundaryVerts = new Set<number>();
    // New isoline vertices are always at slot boundaries
    for (let i = origVertCount; i < totalVertCount; i++) {
      interSlotBoundaryVerts.add(i);
    }
    // Also find original vertices adjacent to a different slot
    {
      const slotSet = new Set(slots);
      const srcAdj: Set<number>[] = new Array(origVertCount);
      for (let i = 0; i < origVertCount; i++) srcAdj[i] = new Set();
      for (let i = 0; i < index.count; i += 3) {
        const va = index.getX(i),
          vb = index.getX(i + 1),
          vc = index.getX(i + 2);
        srcAdj[va].add(vb);
        srcAdj[va].add(vc);
        srcAdj[vb].add(va);
        srcAdj[vb].add(vc);
        srcAdj[vc].add(va);
        srcAdj[vc].add(vb);
      }
      for (let i = 0; i < origVertCount; i++) {
        const mySlot = vertexSlot[i];
        if (!mySlot || !slotSet.has(mySlot)) continue;
        for (const n of srcAdj[i]) {
          const nSlot = vertexSlot[n];
          if (nSlot && nSlot !== mySlot && slotSet.has(nSlot)) {
            interSlotBoundaryVerts.add(i);
            break;
          }
        }
      }
    }

    console.log(
      `[ShellExtraction] Inter-slot boundary: ${interSlotBoundaryVerts.size} vertices (no taper at seams)`,
    );

    // ── Phase 8: Global consensus normal smoothing ──
    // Smooth normals of boundary vertices on the processedGeometry BEFORE any shell
    // is created. This ensures ALL shells read identical normals at shared boundary
    // vertices, eliminating the primary source of seam spikes.
    {
      const procNorm = procGeo.attributes.normal as THREE.BufferAttribute;
      const normArr = procNorm.array as Float32Array;

      // Build coincident groups for ALL processedGeometry vertices
      const QUANT = 10000;
      const procPos = procGeo.attributes.position as THREE.BufferAttribute;
      const allCoinc = new Map<string, number[]>();
      for (let i = 0; i < totalVertCount; i++) {
        const key = `${Math.round(procPos.getX(i) * QUANT)},${Math.round(procPos.getY(i) * QUANT)},${Math.round(procPos.getZ(i) * QUANT)}`;
        let g = allCoinc.get(key);
        if (!g) {
          g = [];
          allCoinc.set(key, g);
        }
        g.push(i);
      }
      const coincGroups = Array.from(allCoinc.values()).filter(
        (g) => g.length > 1,
      );

      // Average normals at coincident positions (UV seam bridging)
      this.averageCoincidentNormals(normArr, coincGroups);

      // Build global boundary chain adjacency from ALL slot triangles combined.
      // Collect all triangles to find boundary edges (edges appearing in exactly
      // one slot's triangle set — i.e., edges at the slot boundary).
      const allTriangles: number[] = [];
      for (const slot of slots) {
        const tris = slotTriangles.get(slot)!;
        for (const t of tris) allTriangles.push(t);
      }

      // Find edges that are at the slot boundary: edges where the two adjacent
      // triangles belong to DIFFERENT slots. Build a map of edge→slot ownership.
      const boundaryEdgeKey = (a: number, b: number) =>
        a < b ? `${a}_${b}` : `${b}_${a}`;
      const edgeSlots = new Map<string, Set<EquipmentSlotName>>();
      for (const slot of slots) {
        const tris = slotTriangles.get(slot)!;
        for (let t = 0; t < tris.length; t += 3) {
          const tri = [tris[t], tris[t + 1], tris[t + 2]];
          for (let j = 0; j < 3; j++) {
            const a = tri[j],
              b = tri[(j + 1) % 3];
            const ek = boundaryEdgeKey(a, b);
            let s = edgeSlots.get(ek);
            if (!s) {
              s = new Set();
              edgeSlots.set(ek, s);
            }
            s.add(slot);
          }
        }
      }

      // Boundary chain: edges shared by exactly 2 different slots
      const chainAdj = new Map<number, Set<number>>();
      for (const bv of interSlotBoundaryVerts) {
        chainAdj.set(bv, new Set());
      }
      for (const [ek, slotSet] of edgeSlots) {
        if (slotSet.size < 2) continue; // internal edge, not at slot boundary
        const parts = ek.split("_");
        const a = parseInt(parts[0], 10);
        const b = parseInt(parts[1], 10);
        if (interSlotBoundaryVerts.has(a) && interSlotBoundaryVerts.has(b)) {
          chainAdj.get(a)!.add(b);
          chainAdj.get(b)!.add(a);
        }
      }

      // Bridge UV seam splits in boundary chain:
      // If coincident vertices are both in the boundary, merge their chain neighbors
      for (const group of coincGroups) {
        const boundaryMembers = group.filter((v) => chainAdj.has(v));
        if (boundaryMembers.length <= 1) continue;
        // Merge all chain neighbors across the group
        const merged = new Set<number>();
        for (const v of boundaryMembers) {
          for (const n of chainAdj.get(v)!) merged.add(n);
          for (const other of boundaryMembers) {
            if (other !== v) merged.add(other);
          }
        }
        for (const v of boundaryMembers) {
          const adj = chainAdj.get(v)!;
          for (const n of merged) {
            if (n !== v) adj.add(n);
          }
        }
      }

      // Smooth boundary normals along the chain (8 iterations)
      const chainAdjArr = new Map<number, number[]>();
      for (const [v, s] of chainAdj) chainAdjArr.set(v, Array.from(s));

      const snapshot = new Float32Array(normArr.length);
      for (let iter = 0; iter < 8; iter++) {
        snapshot.set(normArr);
        for (const bv of interSlotBoundaryVerts) {
          const neighbors = chainAdjArr.get(bv);
          if (!neighbors || neighbors.length === 0) continue;
          let sx = snapshot[bv * 3],
            sy = snapshot[bv * 3 + 1],
            sz = snapshot[bv * 3 + 2];
          let cnt = 1;
          for (const ni of neighbors) {
            const nx = snapshot[ni * 3],
              ny = snapshot[ni * 3 + 1],
              nz = snapshot[ni * 3 + 2];
            if (Number.isFinite(nx)) {
              sx += nx;
              sy += ny;
              sz += nz;
              cnt++;
            }
          }
          sx /= cnt;
          sy /= cnt;
          sz /= cnt;
          const len = Math.sqrt(sx * sx + sy * sy + sz * sz);
          if (len > 1e-8) {
            normArr[bv * 3] = sx / len;
            normArr[bv * 3 + 1] = sy / len;
            normArr[bv * 3 + 2] = sz / len;
          }
        }
        // Re-enforce coincident normal consistency after each iteration
        this.averageCoincidentNormals(normArr, coincGroups);
      }

      procNorm.needsUpdate = true;
      console.log(
        `[ShellExtraction] Phase 8: Consensus normals smoothed for ${interSlotBoundaryVerts.size} boundary vertices`,
      );
    }

    return { regions, interSlotBoundaryVerts, processedGeometry: procGeo };
  }

  // ─── Geometry helpers ────────────────────────────────────────────────

  /**
   * Scan a Float32Array for NaN/Inf values and replace them with a fallback.
   * Returns the count of sanitized values.
   */
  private sanitizeFloatArray(
    arr: Float32Array,
    componentsPerVertex: number,
    fallback: Float32Array | null,
    defaultValue: number,
    label: string,
  ): number {
    let fixed = 0;
    for (let i = 0; i < arr.length; i++) {
      if (!Number.isFinite(arr[i])) {
        arr[i] = fallback ? (fallback[i] ?? defaultValue) : defaultValue;
        fixed++;
      }
    }
    if (fixed > 0) {
      console.warn(
        `[ShellExtraction] Sanitized ${fixed} NaN/Inf values in ${label} (${fixed / componentsPerVertex} vertices affected)`,
      );
    }
    return fixed;
  }

  /**
   * Build adjacency list from index buffer using Set-based dedup (O(1) per edge).
   */
  private buildAdjacency(vertCount: number, indices: Uint32Array): number[][] {
    const adjSets: Set<number>[] = new Array(vertCount);
    for (let i = 0; i < vertCount; i++) adjSets[i] = new Set();

    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i],
        b = indices[i + 1],
        c = indices[i + 2];
      adjSets[a].add(b);
      adjSets[a].add(c);
      adjSets[b].add(a);
      adjSets[b].add(c);
      adjSets[c].add(a);
      adjSets[c].add(b);
    }

    const adj: number[][] = new Array(vertCount);
    for (let i = 0; i < vertCount; i++) adj[i] = Array.from(adjSets[i]);
    return adj;
  }

  /**
   * Estimate per-vertex mean curvature using discrete Laplacian.
   *
   * L(v) = (1/|N|) * sum(n_i - v) for neighbors n_i
   * |L(v)| approximates 2 * mean_curvature
   *
   * High curvature at concavities (armpits, groin) signals where offset
   * must be clamped to prevent self-intersection.
   */
  private estimateCurvature(
    srcPosition: THREE.BufferAttribute,
    sortedVertices: number[],
    adjacency: number[][],
  ): Float32Array {
    const count = sortedVertices.length;
    const curvatures = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const neighbors = adjacency[i];
      if (neighbors.length === 0) continue;

      const oldIdx = sortedVertices[i];
      const px = srcPosition.getX(oldIdx);
      const py = srcPosition.getY(oldIdx);
      const pz = srcPosition.getZ(oldIdx);

      let lx = 0,
        ly = 0,
        lz = 0;
      for (const n of neighbors) {
        const nOldIdx = sortedVertices[n];
        lx += srcPosition.getX(nOldIdx) - px;
        ly += srcPosition.getY(nOldIdx) - py;
        lz += srcPosition.getZ(nOldIdx) - pz;
      }
      lx /= neighbors.length;
      ly /= neighbors.length;
      lz /= neighbors.length;

      curvatures[i] = Math.sqrt(lx * lx + ly * ly + lz * lz) * 2;
    }

    return curvatures;
  }

  /**
   * Find groups of coincident vertices — vertices at the same position that were
   * split by GLTF at UV seams or sharp edges. Each group member has a different
   * normal, so when offset along normals they diverge → visible cracks.
   *
   * Returns array of groups (each group is array of NEW vertex indices).
   * Only groups with 2+ members are returned.
   */
  private findCoincidentGroups(
    srcPosition: THREE.BufferAttribute,
    sortedVertices: number[],
  ): number[][] {
    const PRECISION = 10000; // 0.1mm quantization
    const posMap = new Map<string, number[]>();

    for (let i = 0; i < sortedVertices.length; i++) {
      const oldIdx = sortedVertices[i];
      const x = Math.round(srcPosition.getX(oldIdx) * PRECISION);
      const y = Math.round(srcPosition.getY(oldIdx) * PRECISION);
      const z = Math.round(srcPosition.getZ(oldIdx) * PRECISION);
      const key = `${x},${y},${z}`;

      let group = posMap.get(key);
      if (!group) {
        group = [];
        posMap.set(key, group);
      }
      group.push(i);
    }

    return Array.from(posMap.values()).filter((g) => g.length > 1);
  }

  /**
   * Average normals within each coincident group so all split vertices
   * at a UV seam offset in the same direction. This prevents them from
   * diverging and creating visible cracks.
   */
  private averageCoincidentNormals(
    normals: Float32Array,
    groups: number[][],
  ): void {
    for (const group of groups) {
      // Compute average normal, skipping NaN members to prevent amplification
      let ax = 0,
        ay = 0,
        az = 0;
      let validCount = 0;
      for (const vi of group) {
        const nx = normals[vi * 3],
          ny = normals[vi * 3 + 1],
          nz = normals[vi * 3 + 2];
        if (Number.isFinite(nx) && Number.isFinite(ny) && Number.isFinite(nz)) {
          ax += nx;
          ay += ny;
          az += nz;
          validCount++;
        }
      }
      if (validCount === 0) continue;
      // Normalize
      const len = Math.sqrt(ax * ax + ay * ay + az * az);
      if (len < 1e-8) continue;
      ax /= len;
      ay /= len;
      az /= len;

      // Assign averaged normal to all group members (fixes NaN members too)
      for (const vi of group) {
        normals[vi * 3] = ax;
        normals[vi * 3 + 1] = ay;
        normals[vi * 3 + 2] = az;
      }
    }
  }

  /**
   * Enforce position coherence for coincident vertex groups.
   * Snaps all members of each group to their average position.
   * Must be called after each smooth iteration to prevent divergence.
   */
  private enforceCoincidentPositions(
    posArray: Float32Array,
    groups: number[][],
  ): void {
    for (const group of groups) {
      // Average only finite positions to prevent NaN amplification
      let ax = 0,
        ay = 0,
        az = 0;
      let validCount = 0;
      for (const vi of group) {
        const px = posArray[vi * 3],
          py = posArray[vi * 3 + 1],
          pz = posArray[vi * 3 + 2];
        if (Number.isFinite(px) && Number.isFinite(py) && Number.isFinite(pz)) {
          ax += px;
          ay += py;
          az += pz;
          validCount++;
        }
      }
      if (validCount === 0) continue;
      ax /= validCount;
      ay /= validCount;
      az /= validCount;

      for (const vi of group) {
        posArray[vi * 3] = ax;
        posArray[vi * 3 + 1] = ay;
        posArray[vi * 3 + 2] = az;
      }
    }
  }

  /**
   * Find boundary vertices — vertices on edges that belong to only one triangle.
   * These are at the open edges of the shell where it meets adjacent slots.
   */
  private findBoundaryVertices(indices: Uint32Array): Set<number> {
    const edgeCount = new Map<string, number>();

    for (let i = 0; i < indices.length; i += 3) {
      const tri = [indices[i], indices[i + 1], indices[i + 2]];
      for (let j = 0; j < 3; j++) {
        const a = tri[j],
          b = tri[(j + 1) % 3];
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
      }
    }

    const boundary = new Set<number>();
    for (const [key, count] of edgeCount) {
      if (count === 1) {
        const parts = key.split("_");
        boundary.add(parseInt(parts[0], 10));
        boundary.add(parseInt(parts[1], 10));
      }
    }

    return boundary;
  }

  /**
   * BFS from boundary vertices to compute per-vertex ring distance.
   * Returns a taper multiplier: 0.5 at boundary, ramping to 1.0 over maxRings edges inward.
   */
  private computeBoundaryTaper(
    vertCount: number,
    adjacency: number[][],
    boundaryVerts: Set<number>,
    maxRings: number = 3,
  ): Float32Array {
    const taper = new Float32Array(vertCount);

    // BFS from all boundary vertices simultaneously
    const queue: number[] = [];
    const ringOf: number[] = new Array(vertCount).fill(maxRings);

    for (const v of boundaryVerts) {
      ringOf[v] = 0;
      queue.push(v);
    }

    let head = 0;
    while (head < queue.length) {
      const v = queue[head++];
      const ring = ringOf[v];
      if (ring >= maxRings) continue;

      for (const n of adjacency[v]) {
        if (ringOf[n] > ring + 1) {
          ringOf[n] = ring + 1;
          queue.push(n);
        }
      }
    }

    // Convert ring distance to smooth taper: 0.5 at boundary → 1.0 at maxRings
    for (let i = 0; i < vertCount; i++) {
      const r = Math.min(ringOf[i], maxRings);
      taper[i] = 0.5 + 0.5 * (r / maxRings); // linear: 0.5 → 1.0
    }

    return taper;
  }

  /**
   * Smooth a Float32Array by averaging each value with its neighbors.
   * Prevents sharp transitions in offset or curvature values.
   */
  private smoothFloatArray(
    values: Float32Array,
    adjacency: number[][],
    passes: number = 2,
  ): void {
    const temp = new Float32Array(values.length);
    for (let pass = 0; pass < passes; pass++) {
      temp.set(values);
      for (let i = 0; i < values.length; i++) {
        const neighbors = adjacency[i];
        if (neighbors.length === 0) continue;
        const selfVal = temp[i];
        if (!Number.isFinite(selfVal)) continue;
        let sum = selfVal;
        let count = 1;
        for (const n of neighbors) {
          const nv = temp[n];
          if (Number.isFinite(nv)) {
            sum += nv;
            count++;
          }
        }
        values[i] = sum / count;
      }
    }
  }

  // ─── Boundary-chain smoothing (AAA "consensus normals" technique) ────

  /**
   * Build adjacency restricted to the boundary chain.
   * For each boundary vertex, find its neighbors that are ALSO boundary vertices
   * AND share a boundary edge (edge with only one triangle in the shell).
   * This gives the 1D chain topology of the boundary loop.
   */
  private buildBoundaryChainAdjacency(
    indices: Uint32Array,
    boundaryVerts: Set<number>,
  ): Map<number, number[]> {
    // Find boundary edges (edges appearing in exactly one triangle)
    const edgeCount = new Map<string, number>();
    for (let i = 0; i < indices.length; i += 3) {
      const tri = [indices[i], indices[i + 1], indices[i + 2]];
      for (let j = 0; j < 3; j++) {
        const a = tri[j],
          b = tri[(j + 1) % 3];
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
      }
    }

    const chainAdj = new Map<number, number[]>();
    for (const bv of boundaryVerts) {
      chainAdj.set(bv, []);
    }

    for (const [key, count] of edgeCount) {
      if (count !== 1) continue; // only boundary edges
      const parts = key.split("_");
      const a = parseInt(parts[0], 10);
      const b = parseInt(parts[1], 10);
      // Both endpoints must be inter-slot boundary vertices
      if (boundaryVerts.has(a) && boundaryVerts.has(b)) {
        chainAdj.get(a)!.push(b);
        chainAdj.get(b)!.push(a);
      }
    }

    return chainAdj;
  }

  /**
   * Smooth positions of boundary vertices along the boundary chain.
   * Removes waviness from marching-triangles vertex placement.
   * Jacobi-style: reads from snapshot, writes new.
   */
  private smoothBoundaryPositions(
    positions: Float32Array,
    chainAdj: Map<number, number[]>,
    boundaryVerts: Set<number>,
    iterations: number,
    factor: number,
  ): void {
    const snapshot = new Float32Array(positions.length);
    for (let iter = 0; iter < iterations; iter++) {
      snapshot.set(positions);
      for (const vi of boundaryVerts) {
        const neighbors = chainAdj.get(vi);
        if (!neighbors || neighbors.length === 0) continue;

        // Laplacian: average of chain neighbors
        let ax = 0,
          ay = 0,
          az = 0;
        let cnt = 0;
        for (const ni of neighbors) {
          const px = snapshot[ni * 3],
            py = snapshot[ni * 3 + 1],
            pz = snapshot[ni * 3 + 2];
          if (Number.isFinite(px)) {
            ax += px;
            ay += py;
            az += pz;
            cnt++;
          }
        }
        if (cnt === 0) continue;
        ax /= cnt;
        ay /= cnt;
        az /= cnt;

        // Lerp toward neighbor average
        const cx = snapshot[vi * 3],
          cy = snapshot[vi * 3 + 1],
          cz = snapshot[vi * 3 + 2];
        positions[vi * 3] = cx + (ax - cx) * factor;
        positions[vi * 3 + 1] = cy + (ay - cy) * factor;
        positions[vi * 3 + 2] = cz + (az - cz) * factor;
      }
    }
  }

  // ─── Shell generation ────────────────────────────────────────────────

  /**
   * Create a shell mesh with curvature-adaptive offset, boundary tapering,
   * and body-constrained Laplacian smooth.
   */
  private createShell(
    sourceGeometry: THREE.BufferGeometry,
    skeleton: THREE.Skeleton,
    region: BodyRegion,
    slotName: EquipmentSlotName,
    bulkClass: BulkClass,
    interSlotBoundaryVerts?: Set<number>,
    /** Override offset in metres — used for custom thickness shells */
    offsetOverride?: number,
  ): ShellMesh {
    const srcPosition = sourceGeometry.attributes
      .position as THREE.BufferAttribute;
    const srcNormal = sourceGeometry.attributes.normal as THREE.BufferAttribute;
    const srcSkinIndex = sourceGeometry.attributes
      .skinIndex as THREE.BufferAttribute;
    const srcSkinWeight = sourceGeometry.attributes
      .skinWeight as THREE.BufferAttribute;
    const srcUV = sourceGeometry.attributes.uv as
      | THREE.BufferAttribute
      | undefined;

    const baseOffset = offsetOverride ?? BULK_OFFSETS[bulkClass];

    // Build vertex mapping (old source index → new shell index)
    const usedVertices = new Set<number>();
    for (const idx of region.triangleIndices) usedVertices.add(idx);
    const sortedVertices = Array.from(usedVertices).sort((a, b) => a - b);
    const oldToNew = new Map<number, number>();
    sortedVertices.forEach((v, i) => oldToNew.set(v, i));
    const vertCount = sortedVertices.length;

    // Build remapped index buffer first (needed for adjacency + curvature)
    const triCount = region.triangleIndices.length;
    const indices = new Uint32Array(triCount);
    for (let i = 0; i < triCount; i++) {
      indices[i] = oldToNew.get(region.triangleIndices[i])!;
    }

    // Find coincident vertex groups (GLTF splits at UV seams/sharp edges)
    const coincidentGroups = this.findCoincidentGroups(
      srcPosition,
      sortedVertices,
    );

    // Pre-compute topology analysis
    const adjacency = this.buildAdjacency(vertCount, indices);
    const curvatures = this.estimateCurvature(
      srcPosition,
      sortedVertices,
      adjacency,
    );
    const boundaryVerts = this.findBoundaryVertices(indices);

    // Smooth curvature estimates to reduce noise (1 pass)
    this.smoothFloatArray(curvatures, adjacency, 1);

    // Split boundary verts into "true open" (taper) vs "inter-slot seam" (no taper).
    // Only taper at true open edges (neck hole, wrist openings, etc.).
    // Inter-slot seam edges meet an adjacent generated shell and must stay at full offset.
    let trueOpenBoundary: Set<number>;
    if (interSlotBoundaryVerts && interSlotBoundaryVerts.size > 0) {
      trueOpenBoundary = new Set<number>();
      let seamCount = 0;
      for (const bv of boundaryVerts) {
        const srcIdx = sortedVertices[bv];
        if (interSlotBoundaryVerts.has(srcIdx)) {
          seamCount++;
          // Don't add to trueOpenBoundary — no taper here
        } else {
          trueOpenBoundary.add(bv);
        }
      }
      console.log(
        `[ShellExtraction] ${slotName}/${bulkClass}: ${boundaryVerts.size} boundary verts — ${seamCount} inter-slot (full offset), ${trueOpenBoundary.size} true-open (tapered)`,
      );
    } else {
      trueOpenBoundary = boundaryVerts;
    }

    // Compute multi-ring boundary taper only from true open edges
    // (gradual falloff: 0.5 → 1.0 over 3 rings — NOT at inter-slot seams)
    const boundaryTaper = this.computeBoundaryTaper(
      vertCount,
      adjacency,
      trueOpenBoundary,
      3,
    );

    // Build per-vertex seam blend factor: 0.0 at inter-slot boundary (fully pinned)
    // ramping to 1.0 over SEAM_BLEND_RINGS edges inward (fully free).
    // This prevents the hard pinned→free step that causes spikes at seam transitions.
    const SEAM_BLEND_RINGS = 4;
    const seamBlend = new Float32Array(vertCount).fill(1.0);
    const pinnedVerts = new Set<number>();
    if (interSlotBoundaryVerts && interSlotBoundaryVerts.size > 0) {
      // Mark boundary vertices
      for (let i = 0; i < vertCount; i++) {
        if (interSlotBoundaryVerts.has(sortedVertices[i])) {
          pinnedVerts.add(i);
          seamBlend[i] = 0;
        }
      }
      // Issue 8 fix: if ANY member of a coincident group is pinned, ALL must be.
      // Otherwise coincident enforcement averages pinned+unpinned → undoes pinning.
      for (const group of coincidentGroups) {
        const hasPinned = group.some((v) => pinnedVerts.has(v));
        if (hasPinned) {
          for (const v of group) {
            pinnedVerts.add(v);
            seamBlend[v] = 0;
          }
        }
      }
      // BFS outward to compute ring distance, then convert to blend factor
      const ringOf = new Int32Array(vertCount).fill(SEAM_BLEND_RINGS);
      const queue: number[] = [];
      for (const pv of pinnedVerts) {
        ringOf[pv] = 0;
        queue.push(pv);
      }
      let head = 0;
      while (head < queue.length) {
        const v = queue[head++];
        const ring = ringOf[v];
        if (ring >= SEAM_BLEND_RINGS) continue;
        for (const n of adjacency[v]) {
          if (ringOf[n] > ring + 1) {
            ringOf[n] = ring + 1;
            queue.push(n);
          }
        }
      }
      for (let i = 0; i < vertCount; i++) {
        const r = Math.min(ringOf[i], SEAM_BLEND_RINGS);
        // Smooth hermite blend: 0 at boundary → 1 at SEAM_BLEND_RINGS
        const t = r / SEAM_BLEND_RINGS;
        seamBlend[i] = t * t * (3 - 2 * t); // smoothstep
      }
    }

    // Allocate output arrays
    const positions = new Float32Array(vertCount * 3);
    const normals = new Float32Array(vertCount * 3);
    const bodyPositions = new Float32Array(vertCount * 3);
    const bodyNormals = new Float32Array(vertCount * 3);
    const effectiveOffsets = new Float32Array(vertCount);
    const skinIndices = new Float32Array(vertCount * 4);
    const skinWeights = new Float32Array(vertCount * 4);
    const uvs = srcUV ? new Float32Array(vertCount * 2) : null;

    // Minimum offset floor: curvature clamping can never reduce below 50% of base
    const minOffsetFloor = baseOffset * 0.5;

    for (let i = 0; i < vertCount; i++) {
      const oldIdx = sortedVertices[i];

      // BufferAttribute.getX returns undefined for OOB → coerces to NaN in Float32Array
      // Guard with fallback to 0 (position) or up vector (normal)
      let px = srcPosition.getX(oldIdx);
      let py = srcPosition.getY(oldIdx);
      let pz = srcPosition.getZ(oldIdx);
      if (!Number.isFinite(px)) {
        px = 0;
        py = 0;
        pz = 0;
      }

      let nx = srcNormal.getX(oldIdx);
      let ny = srcNormal.getY(oldIdx);
      let nz = srcNormal.getZ(oldIdx);
      if (!Number.isFinite(nx)) {
        nx = 0;
        ny = 1;
        nz = 0;
      }

      // Store body surface reference (for constrained smooth)
      bodyPositions[i * 3] = px;
      bodyPositions[i * 3 + 1] = py;
      bodyPositions[i * 3 + 2] = pz;
      bodyNormals[i * 3] = nx;
      bodyNormals[i * 3 + 1] = ny;
      bodyNormals[i * 3 + 2] = nz;

      // Curvature-adaptive offset with floor
      const kappa = curvatures[i];
      // NaN kappa: comparison returns false, takes safe path
      const maxSafe = kappa > 0.01 ? 0.5 / kappa : baseOffset * 100;
      let freeEff = Math.max(minOffsetFloor, Math.min(baseOffset, maxSafe));

      // Apply multi-ring boundary taper (gradual falloff at shell edges)
      freeEff *= boundaryTaper[i];
      // Final guard
      if (!Number.isFinite(freeEff)) freeEff = baseOffset;

      // Blend between pinned (baseOffset) at seam and free (curvature-adapted) in interior
      // seamBlend: 0 at inter-slot boundary → 1 at interior
      const eff = baseOffset + (freeEff - baseOffset) * seamBlend[i];

      effectiveOffsets[i] = eff;

      // Copy normals from body (NOT recomputed — partial mesh normals are wrong at boundaries)
      normals[i * 3] = nx;
      normals[i * 3 + 1] = ny;
      normals[i * 3 + 2] = nz;

      // Copy skin data (inherits rigging from body)
      for (let j = 0; j < 4; j++) {
        skinIndices[i * 4 + j] = srcSkinIndex.getComponent(oldIdx, j) ?? 0;
        skinWeights[i * 4 + j] = srcSkinWeight.getComponent(oldIdx, j) ?? 0;
      }

      // Copy UVs
      if (srcUV && uvs) {
        uvs[i * 2] = srcUV.getX(oldIdx) ?? 0;
        uvs[i * 2 + 1] = srcUV.getY(oldIdx) ?? 0;
      }
    }

    // Average normals for coincident vertex groups so UV-seam-split vertices
    // offset in the same direction (prevents cracks/fractures at seams)
    // NOTE: Boundary normals are already smoothed globally in Phase 8 (extractShells).
    // This per-shell pass handles interior coincident groups.
    this.averageCoincidentNormals(normals, coincidentGroups);
    this.averageCoincidentNormals(bodyNormals, coincidentGroups);

    // Smooth effective offsets — exclude pinned verts to prevent contamination
    // (Issue 7: full-mesh smoothing was pulling pinned offset values away from baseOffset)
    this.smoothFloatArray(effectiveOffsets, adjacency, 2);

    // Re-blend offsets toward baseOffset at seam zone after smoothing
    for (let i = 0; i < vertCount; i++) {
      if (seamBlend[i] < 1.0) {
        effectiveOffsets[i] =
          baseOffset + (effectiveOffsets[i] - baseOffset) * seamBlend[i];
      }
    }

    // Now apply offsets to positions (after smoothing offsets for uniformity)
    for (let i = 0; i < vertCount; i++) {
      const eff = effectiveOffsets[i];
      positions[i * 3] = bodyPositions[i * 3] + normals[i * 3] * eff;
      positions[i * 3 + 1] =
        bodyPositions[i * 3 + 1] + normals[i * 3 + 1] * eff;
      positions[i * 3 + 2] =
        bodyPositions[i * 3 + 2] + normals[i * 3 + 2] * eff;
    }

    // ── Boundary-chain position smoothing ──
    // After offset, smooth boundary positions along the loop to remove
    // residual waviness from marching-triangles vertex placement.
    // UV-seam bridging ensures coincident boundary verts are connected.
    if (pinnedVerts.size > 0) {
      const boundaryChainAdj = this.buildBoundaryChainAdjacency(
        indices,
        pinnedVerts,
      );
      // Bridge UV seam splits in boundary chain for position smoothing
      for (const group of coincidentGroups) {
        const bMembers = group.filter((v) => pinnedVerts.has(v));
        if (bMembers.length <= 1) continue;
        const merged = new Set<number>();
        for (const v of bMembers) {
          const adj = boundaryChainAdj.get(v);
          if (adj) for (const n of adj) merged.add(n);
          for (const other of bMembers) if (other !== v) merged.add(other);
        }
        for (const v of bMembers) {
          let adj = boundaryChainAdj.get(v);
          if (!adj) {
            adj = [];
            boundaryChainAdj.set(v, adj);
          }
          const adjSet = new Set(adj);
          for (const n of merged) {
            if (n !== v && !adjSet.has(n)) adj.push(n);
          }
        }
      }
      this.smoothBoundaryPositions(
        positions,
        boundaryChainAdj,
        pinnedVerts,
        6,
        0.5,
      );
    }

    // Enforce position coherence for coincident groups after initial offset
    this.enforceCoincidentPositions(positions, coincidentGroups);

    // Build BufferGeometry
    const shellGeometry = new THREE.BufferGeometry();
    shellGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
    shellGeometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    shellGeometry.setAttribute(
      "skinIndex",
      new THREE.BufferAttribute(new Uint16Array(skinIndices), 4),
    );
    shellGeometry.setAttribute(
      "skinWeight",
      new THREE.BufferAttribute(skinWeights, 4),
    );
    if (uvs) {
      shellGeometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    }
    shellGeometry.setIndex(new THREE.BufferAttribute(indices, 1));

    // Body-constrained Laplacian smooth (with coincident position enforcement)
    // For custom offsets, scale smooth params proportionally to thickness
    const smoothParams = offsetOverride
      ? {
          iterations: Math.max(4, Math.round(12 * (offsetOverride / 0.03))),
          factor: Math.min(0.5, 0.35 * (offsetOverride / 0.03)),
        }
      : SMOOTH_PARAMS[bulkClass];
    const { iterations, factor } = smoothParams;
    this.constrainedSmooth(
      shellGeometry,
      bodyPositions,
      bodyNormals,
      effectiveOffsets,
      adjacency,
      boundaryTaper,
      coincidentGroups,
      iterations,
      factor,
      seamBlend,
    );

    // Keep body normals — do NOT call computeVertexNormals() on partial mesh
    // (partial mesh normals are wrong at boundaries where adjacent slot faces are missing)

    // Final NaN safety net: sanitize any remaining bad values after all processing.
    // Use bodyPositions as fallback (vertex stays on body surface rather than disappearing)
    const finalPositions = shellGeometry.attributes.position
      .array as Float32Array;
    const finalNormals = shellGeometry.attributes.normal.array as Float32Array;
    this.sanitizeFloatArray(
      finalPositions,
      3,
      bodyPositions,
      0,
      `shell[${slotName}/${bulkClass}].position`,
    );
    this.sanitizeFloatArray(
      finalNormals,
      3,
      bodyNormals,
      0,
      `shell[${slotName}/${bulkClass}].normal`,
    );

    // Explicitly compute both bounding volumes (prevents lazy NaN errors during rendering)
    shellGeometry.computeBoundingBox();
    shellGeometry.computeBoundingSphere();

    return {
      slotName,
      bulkClass,
      geometry: shellGeometry,
      skeleton,
      boundingBox: shellGeometry.boundingBox ?? new THREE.Box3(),
      vertexCount: vertCount,
      triangleCount: triCount / 3,
    };
  }

  /**
   * Body-constrained Laplacian smooth.
   *
   * Each iteration:
   *   1. Lerp each vertex toward neighbor average (factor scaled by boundary taper)
   *   2. Enforce minimum distance from body surface along normal direction
   *
   * Near-boundary vertices get reduced smooth factor (not pinned), creating
   * a gradual transition instead of an abrupt step at shell edges.
   * Jacobi-style: reads from old positions, writes to new.
   */
  private constrainedSmooth(
    geometry: THREE.BufferGeometry,
    bodyPositions: Float32Array,
    bodyNormals: Float32Array,
    effectiveOffsets: Float32Array,
    adjacency: number[][],
    boundaryTaper: Float32Array,
    coincidentGroups: number[][],
    iterations: number,
    factor: number,
    /** Per-vertex seam blend: 0 at inter-slot seam (no smoothing) → 1 interior (full) */
    seamBlend?: Float32Array,
  ): void {
    const position = geometry.attributes.position as THREE.BufferAttribute;
    const count = position.count;
    const posArray = position.array as Float32Array;
    const oldPositions = new Float32Array(count * 3);

    for (let iter = 0; iter < iterations; iter++) {
      oldPositions.set(posArray);

      for (let i = 0; i < count; i++) {
        const neighbors = adjacency[i];
        if (neighbors.length === 0) continue;

        // Seam blend (0 at seam → 1 interior) scales smoothing so seam verts
        // stay pinned while transition zone gets gradually more smoothing
        const sb = seamBlend ? seamBlend[i] : 1.0;
        if (sb < 0.001) continue; // fully pinned at seam

        // Scale smooth factor by boundary taper (0.5 at edge → 1.0 interior)
        // AND by seam blend (0 at seam → 1 interior)
        const localFactor = factor * boundaryTaper[i] * sb;

        // Step 1: Laplacian smooth — lerp toward neighbor average
        // Skip NaN neighbors to prevent one bad vertex from poisoning the mesh
        let avgX = 0,
          avgY = 0,
          avgZ = 0;
        let validNeighbors = 0;
        for (const n of neighbors) {
          const npx = oldPositions[n * 3],
            npy = oldPositions[n * 3 + 1],
            npz = oldPositions[n * 3 + 2];
          if (
            Number.isFinite(npx) &&
            Number.isFinite(npy) &&
            Number.isFinite(npz)
          ) {
            avgX += npx;
            avgY += npy;
            avgZ += npz;
            validNeighbors++;
          }
        }

        // If no valid neighbors or current position is NaN, skip this vertex
        const curX = oldPositions[i * 3],
          curY = oldPositions[i * 3 + 1],
          curZ = oldPositions[i * 3 + 2];
        if (validNeighbors === 0 || !Number.isFinite(curX)) continue;

        avgX /= validNeighbors;
        avgY /= validNeighbors;
        avgZ /= validNeighbors;

        let newX = curX + (avgX - curX) * localFactor;
        let newY = curY + (avgY - curY) * localFactor;
        let newZ = curZ + (avgZ - curZ) * localFactor;

        // Step 2: Enforce minimum distance from body surface
        const bx = bodyPositions[i * 3];
        const by = bodyPositions[i * 3 + 1];
        const bz = bodyPositions[i * 3 + 2];
        const nx = bodyNormals[i * 3];
        const ny = bodyNormals[i * 3 + 1];
        const nz = bodyNormals[i * 3 + 2];

        // Guard: if body position or normal is NaN, skip enforcement
        if (Number.isFinite(bx) && Number.isFinite(nx)) {
          const minOffset = effectiveOffsets[i];
          const dx = newX - bx;
          const dy = newY - by;
          const dz = newZ - bz;
          const normalDist = dx * nx + dy * ny + dz * nz;

          if (normalDist < minOffset) {
            const correction = minOffset - normalDist;
            newX += nx * correction;
            newY += ny * correction;
            newZ += nz * correction;
          }
        }

        posArray[i * 3] = newX;
        posArray[i * 3 + 1] = newY;
        posArray[i * 3 + 2] = newZ;
      }

      // Step 3: Snap coincident vertex groups to average position
      // Prevents UV-seam-split vertices from diverging during smooth
      this.enforceCoincidentPositions(posArray, coincidentGroups);
    }

    position.needsUpdate = true;
  }

  /**
   * Export a shell as a standalone GLB file.
   * @param baseColor Optional hex color to pre-paint the shell (e.g. "#D4AF37" for bronze).
   *   Pre-painting with the target color dramatically improves Meshy retexture accuracy
   *   because the AI sees "bronze metallic object" instead of "grey body shape".
   * @param baseMetalness Metalness for the export material (default 0.85 when color is set).
   */
  async exportShellAsGLB(
    shell: ShellMesh,
    baseColor?: string,
    baseMetalness?: number,
  ): Promise<Blob> {
    const { GLTFExporter } =
      await import("three/addons/exporters/GLTFExporter.js");

    const exporter = new GLTFExporter();

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(baseColor || "#7A7A82"),
      roughness: baseColor ? 0.35 : 0.7,
      metalness: baseMetalness ?? (baseColor ? 0.85 : 0.1),
    });

    // Export as plain Mesh (not SkinnedMesh) — retexture APIs only need
    // static geometry, and skinned meshes can cause failures.
    const geo = shell.geometry.clone();
    geo.deleteAttribute("skinIndex");
    geo.deleteAttribute("skinWeight");
    // Keep UVs — enable_original_uv=false tells Meshy to regenerate UV layout,
    // but having UVs in the model gives Meshy a better starting quality baseline.
    // The shape-override prompts + pre-painting handle the skin-texture bias.
    if (geo.hasAttribute("uv2")) geo.deleteAttribute("uv2");
    const mesh = new THREE.Mesh(geo, material);

    return new Promise((resolve, reject) => {
      exporter.parse(
        mesh,
        (result) => {
          if (result instanceof ArrayBuffer) {
            resolve(new Blob([result], { type: "model/gltf-binary" }));
          } else {
            resolve(
              new Blob([JSON.stringify(result)], { type: "model/gltf+json" }),
            );
          }
        },
        reject,
        { binary: true },
      );
    });
  }
}
