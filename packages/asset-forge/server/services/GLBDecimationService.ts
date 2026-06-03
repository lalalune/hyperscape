/**
 * GLB Decimation Service
 *
 * TypeScript-based mesh decimation service that uses @hyperforge/decimation
 * for seam-aware mesh simplification directly on GLB files.
 *
 * Features:
 * - In-process decimation (no external tools required)
 * - Seam-aware UV preservation
 * - Preserves materials, textures, animations
 * - Vertex color preservation
 */

import {
  decimate,
  decimateOptimized,
  OptimizedMeshData,
  MeshData,
  type DecimationResult,
  type OptimizedDecimationResult,
  type Vec2,
  type Vec3,
} from "@hyperforge/decimation";

// GLB constants
const GLB_MAGIC = 0x46546c67; // 'glTF'
const GLB_VERSION = 2;
const CHUNK_TYPE_JSON = 0x4e4f534a; // 'JSON'
const CHUNK_TYPE_BIN = 0x004e4942; // 'BIN\0'

// glTF accessor component types
const COMPONENT_TYPES = {
  BYTE: 5120,
  UNSIGNED_BYTE: 5121,
  SHORT: 5122,
  UNSIGNED_SHORT: 5123,
  UNSIGNED_INT: 5125,
  FLOAT: 5126,
} as const;

// glTF accessor types
const ACCESSOR_TYPES = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
} as const;

type ComponentType = (typeof COMPONENT_TYPES)[keyof typeof COMPONENT_TYPES];
type AccessorType = keyof typeof ACCESSOR_TYPES;

interface GLTFAccessor {
  bufferView?: number;
  byteOffset?: number;
  componentType: ComponentType;
  count: number;
  type: AccessorType;
  max?: number[];
  min?: number[];
  normalized?: boolean;
}

interface GLTFBufferView {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
  target?: number;
}

interface GLTFPrimitive {
  attributes: Record<string, number>;
  indices?: number;
  material?: number;
  mode?: number;
}

interface GLTFMesh {
  name?: string;
  primitives: GLTFPrimitive[];
}

/**
 * glTF Skin - defines a skeleton for skinned mesh animation.
 * The inverseBindMatrices accessor contains one MAT4 per joint.
 */
interface GLTFSkin {
  /** Accessor index for inverse bind matrices (MAT4 × numJoints) */
  inverseBindMatrices?: number;
  /** Node indices that form the skeleton joints */
  joints: number[];
  /** Optional skeleton root node index */
  skeleton?: number;
  /** Optional name for debugging */
  name?: string;
}

/**
 * glTF Animation Sampler - defines keyframe data for an animated property.
 * References two accessors: timestamps (input) and values (output).
 */
interface GLTFAnimationSampler {
  /** Accessor index for keyframe timestamps (SCALAR floats, strictly increasing) */
  input: number;
  /** Accessor index for animated values (VEC3/VEC4/SCALAR depending on path) */
  output: number;
  /** Interpolation mode (default: LINEAR) */
  interpolation?: "LINEAR" | "STEP" | "CUBICSPLINE";
}

/**
 * glTF Animation Channel - connects a sampler to a node property.
 */
interface GLTFAnimationChannel {
  /** Index into animation.samplers array */
  sampler: number;
  /** Target node and property to animate */
  target: {
    /** Node index to animate (undefined for morph weights on mesh) */
    node?: number;
    /** Property path: translation, rotation, scale, or weights */
    path: "translation" | "rotation" | "scale" | "weights";
  };
}

/**
 * glTF Animation - a named collection of samplers and channels.
 */
interface GLTFAnimation {
  /** Optional name for debugging */
  name?: string;
  /** Keyframe data definitions */
  samplers: GLTFAnimationSampler[];
  /** Connections from samplers to node properties */
  channels: GLTFAnimationChannel[];
}

/**
 * glTF Node - scene graph node that can reference mesh, skin, camera, etc.
 */
interface GLTFNode {
  /** Optional name */
  name?: string;
  /** Child node indices */
  children?: number[];
  /** Mesh index */
  mesh?: number;
  /** Skin index (requires mesh to be defined) */
  skin?: number;
  /** Camera index */
  camera?: number;
  /** Translation vector [x, y, z] */
  translation?: [number, number, number];
  /** Rotation quaternion [x, y, z, w] */
  rotation?: [number, number, number, number];
  /** Scale vector [x, y, z] */
  scale?: [number, number, number];
  /** 4x4 transformation matrix (column-major, mutually exclusive with TRS) */
  matrix?: number[];
  /** Morph target weights */
  weights?: number[];
}

interface GLTF {
  accessors?: GLTFAccessor[];
  bufferViews?: GLTFBufferView[];
  buffers?: Array<{ byteLength: number; uri?: string }>;
  meshes?: GLTFMesh[];
  materials?: unknown[];
  textures?: unknown[];
  images?: unknown[];
  samplers?: unknown[];
  nodes?: GLTFNode[];
  scenes?: unknown[];
  scene?: number;
  animations?: GLTFAnimation[];
  skins?: GLTFSkin[];
  asset: { version: string; generator?: string };
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  extensions?: Record<string, unknown>;
}

export interface DecimationOptions {
  /** Target percentage of vertices to keep (0-100) */
  targetPercent: number;
  /** Strictness level: 0=fast, 1=balanced, 2=seam-aware (default) */
  strictness?: 0 | 1 | 2;
  /** Minimum vertices to preserve */
  minVertices?: number;
  /**
   * Strip skeleton and skinning data (JOINTS_0, WEIGHTS_0).
   * Creates a static mesh suitable for vertex-color-only LOD rendering.
   * Use this for LOD1 meshes where animation is frozen.
   */
  stripSkeleton?: boolean;
}

export interface GLBDecimationResult {
  /** Whether decimation succeeded */
  success: boolean;
  /** Output GLB buffer */
  outputBuffer?: Buffer;
  /** Original vertex count */
  originalVertices: number;
  /** Final vertex count */
  finalVertices: number;
  /** Original face count */
  originalFaces: number;
  /** Final face count */
  finalFaces: number;
  /** Reduction percentage achieved */
  reductionPercent: number;
  /** Error message if failed */
  error?: string;
  /** Processing time in ms */
  processingTime: number;
}

export class GLBDecimationService {
  /**
   * Decimate a GLB file
   *
   * @param inputBuffer - Input GLB file buffer
   * @param options - Decimation options
   * @returns Decimation result with output buffer
   */
  async decimateGLB(
    inputBuffer: Buffer,
    options: DecimationOptions,
  ): Promise<GLBDecimationResult> {
    const startTime = performance.now();

    // Parse GLB
    const parsed = this.parseGLB(inputBuffer);
    if (!parsed) {
      return {
        success: false,
        originalVertices: 0,
        finalVertices: 0,
        originalFaces: 0,
        finalFaces: 0,
        reductionPercent: 0,
        error: "Failed to parse GLB file",
        processingTime: performance.now() - startTime,
      };
    }

    const { gltf, binaryChunk } = parsed;

    if (!gltf.meshes || gltf.meshes.length === 0) {
      return {
        success: false,
        originalVertices: 0,
        finalVertices: 0,
        originalFaces: 0,
        finalFaces: 0,
        reductionPercent: 0,
        error: "No meshes found in GLB",
        processingTime: performance.now() - startTime,
      };
    }

    let totalOriginalVertices = 0;
    let totalFinalVertices = 0;
    let totalOriginalFaces = 0;
    let totalFinalFaces = 0;

    // Process each mesh
    const newBufferParts: Buffer[] = [];
    const newAccessors: GLTFAccessor[] = [];
    const newBufferViews: GLTFBufferView[] = [];
    const accessorMapping = new Map<number, number>();

    // CRITICAL: Preserve non-mesh data FIRST (inverse bind matrices, animations)
    // This data must come before mesh data in the buffer, and references must be updated
    const preserved = this.preserveNonMeshData(
      gltf,
      binaryChunk,
      newAccessors,
      newBufferViews,
    );
    let currentOffset = 0;

    if (preserved.bufferData.length > 0) {
      newBufferParts.push(preserved.bufferData);
      currentOffset = preserved.bufferData.length;

      // Update skin references to point to new accessor indices
      if (gltf.skins) {
        for (const skin of gltf.skins) {
          if (skin.inverseBindMatrices !== undefined) {
            const newIdx = preserved.accessorMapping.get(
              skin.inverseBindMatrices,
            );
            if (newIdx !== undefined) {
              skin.inverseBindMatrices = newIdx;
            }
          }
        }
      }

      // Update animation references to point to new accessor indices
      if (gltf.animations) {
        for (const animation of gltf.animations) {
          for (const sampler of animation.samplers) {
            const newInputIdx = preserved.accessorMapping.get(sampler.input);
            const newOutputIdx = preserved.accessorMapping.get(sampler.output);
            if (newInputIdx !== undefined) {
              sampler.input = newInputIdx;
            }
            if (newOutputIdx !== undefined) {
              sampler.output = newOutputIdx;
            }
          }
        }
      }
    }

    for (let meshIdx = 0; meshIdx < gltf.meshes.length; meshIdx++) {
      const mesh = gltf.meshes[meshIdx];

      for (let primIdx = 0; primIdx < mesh.primitives.length; primIdx++) {
        const primitive = mesh.primitives[primIdx];

        // Extract mesh data
        const extracted = this.extractMeshData(
          gltf,
          binaryChunk,
          primitive,
          accessorMapping,
          newAccessors,
        );

        if (!extracted) {
          continue;
        }

        totalOriginalVertices += extracted.vertices.length;
        totalOriginalFaces += extracted.faces.length;

        // Calculate target based on minVertices
        let effectiveTargetPercent = options.targetPercent;
        if (options.minVertices && extracted.vertices.length > 0) {
          const minPercent =
            (options.minVertices / extracted.vertices.length) * 100;
          effectiveTargetPercent = Math.max(effectiveTargetPercent, minPercent);
        }

        // Use optimized decimation with typed arrays for better performance
        const optimizedMesh = this.toOptimizedMeshData(extracted);
        const optimizedResult = decimateOptimized(optimizedMesh, {
          targetPercent: effectiveTargetPercent,
          strictness: options.strictness ?? 2,
        });

        // Convert result back to legacy format for compatibility
        const result = this.fromOptimizedResult(optimizedResult, extracted);

        totalFinalVertices += result.finalVertices;
        totalFinalFaces += result.finalFaces;

        // Write decimated geometry to buffer
        // stripSkeleton: Remove bone data for static LOD meshes (vertex-color-only rendering)
        const stripSkeleton = options.stripSkeleton ?? false;
        const { bufferData, accessors, accessorObjects, bufferViews } =
          this.writeDecimatedGeometry(
            result,
            extracted,
            currentOffset,
            newAccessors.length,
            newBufferViews.length,
            stripSkeleton,
          );

        // Update primitive accessors with new indices
        primitive.attributes.POSITION = accessors.position;
        if (accessors.normal !== undefined) {
          primitive.attributes.NORMAL = accessors.normal;
        }
        if (accessors.texcoord !== undefined) {
          primitive.attributes.TEXCOORD_0 = accessors.texcoord;
        }
        if (accessors.color !== undefined) {
          primitive.attributes.COLOR_0 = accessors.color;
        }
        if (accessors.indices !== undefined) {
          primitive.indices = accessors.indices;
        }
        // Preserve skinning data for animated meshes (unless stripSkeleton is true)
        if (!stripSkeleton && accessors.joints !== undefined) {
          primitive.attributes.JOINTS_0 = accessors.joints;
        }
        if (!stripSkeleton && accessors.weights !== undefined) {
          primitive.attributes.WEIGHTS_0 = accessors.weights;
        }
        // Remove skinning attributes if stripping skeleton
        if (stripSkeleton) {
          delete primitive.attributes.JOINTS_0;
          delete primitive.attributes.WEIGHTS_0;
        }

        // Add accessor objects and buffer views to the new arrays
        newAccessors.push(...accessorObjects);
        newBufferViews.push(...bufferViews);
        newBufferParts.push(bufferData);
        currentOffset += bufferData.length;
      }
    }

    // Rebuild GLB
    const newBinary = Buffer.concat(newBufferParts);

    // Update gltf with new accessors and buffer views
    gltf.accessors = this.rebuildAccessors(gltf, accessorMapping, newAccessors);
    gltf.bufferViews = this.rebuildBufferViews(gltf, newBufferViews);
    if (gltf.buffers && gltf.buffers.length > 0) {
      gltf.buffers[0].byteLength = newBinary.length;
    }

    // Strip skeleton data if requested (for static LOD meshes)
    if (options.stripSkeleton) {
      // Remove skins array
      delete gltf.skins;
      // Remove skin references from nodes
      if (gltf.nodes) {
        for (const node of gltf.nodes) {
          delete node.skin;
        }
      }
      // Remove animations (static meshes don't animate)
      delete gltf.animations;
      console.log(
        `[GLBDecimationService] Stripped skeleton: skins, animations, node.skin references removed`,
      );
    }

    // Update asset info
    gltf.asset.generator = options.stripSkeleton
      ? "Hyperia GLB Decimation Service (Static LOD)"
      : "Hyperia GLB Decimation Service";

    const outputBuffer = this.buildGLB(gltf, newBinary);

    const reductionPercent =
      totalOriginalVertices > 0
        ? ((totalOriginalVertices - totalFinalVertices) /
            totalOriginalVertices) *
          100
        : 0;

    return {
      success: true,
      outputBuffer,
      originalVertices: totalOriginalVertices,
      finalVertices: totalFinalVertices,
      originalFaces: totalOriginalFaces,
      finalFaces: totalFinalFaces,
      reductionPercent,
      processingTime: performance.now() - startTime,
    };
  }

  /**
   * Parse a GLB file into its components
   */
  private parseGLB(buffer: Buffer): { gltf: GLTF; binaryChunk: Buffer } | null {
    if (buffer.length < 12) return null;

    // Check magic and version
    const magic = buffer.readUInt32LE(0);
    if (magic !== GLB_MAGIC) return null;

    const version = buffer.readUInt32LE(4);
    if (version !== GLB_VERSION) return null;

    const length = buffer.readUInt32LE(8);
    if (buffer.length < length) return null;

    // Read JSON chunk
    if (buffer.length < 20) return null;
    const jsonChunkLength = buffer.readUInt32LE(12);
    const jsonChunkType = buffer.readUInt32LE(16);
    if (jsonChunkType !== CHUNK_TYPE_JSON) return null;

    const jsonData = buffer.subarray(20, 20 + jsonChunkLength).toString("utf8");
    const gltf = JSON.parse(jsonData) as GLTF;

    // Read binary chunk
    let binaryChunk: Buffer = Buffer.alloc(0);
    const binaryChunkOffset = 20 + jsonChunkLength;
    if (buffer.length > binaryChunkOffset + 8) {
      const binChunkLength = buffer.readUInt32LE(binaryChunkOffset);
      const binChunkType = buffer.readUInt32LE(binaryChunkOffset + 4);
      if (binChunkType === CHUNK_TYPE_BIN) {
        // Use Buffer.from to ensure proper Buffer type
        binaryChunk = Buffer.from(
          buffer.subarray(
            binaryChunkOffset + 8,
            binaryChunkOffset + 8 + binChunkLength,
          ),
        );
      }
    }

    return { gltf, binaryChunk };
  }

  /**
   * Convert extracted mesh data to OptimizedMeshData format
   */
  private toOptimizedMeshData(extracted: {
    vertices: Vec3[];
    faces: [number, number, number][];
    uvs: Vec2[];
    faceUVs: [number, number, number][];
  }): OptimizedMeshData {
    const positions = new Float32Array(extracted.vertices.length * 3);
    for (let i = 0; i < extracted.vertices.length; i++) {
      positions[i * 3] = extracted.vertices[i][0];
      positions[i * 3 + 1] = extracted.vertices[i][1];
      positions[i * 3 + 2] = extracted.vertices[i][2];
    }

    const uvs = new Float32Array(extracted.uvs.length * 2);
    for (let i = 0; i < extracted.uvs.length; i++) {
      uvs[i * 2] = extracted.uvs[i][0];
      uvs[i * 2 + 1] = extracted.uvs[i][1];
    }

    const faceVertices = new Uint32Array(extracted.faces.length * 3);
    for (let i = 0; i < extracted.faces.length; i++) {
      faceVertices[i * 3] = extracted.faces[i][0];
      faceVertices[i * 3 + 1] = extracted.faces[i][1];
      faceVertices[i * 3 + 2] = extracted.faces[i][2];
    }

    const faceTexCoords = new Uint32Array(extracted.faceUVs.length * 3);
    for (let i = 0; i < extracted.faceUVs.length; i++) {
      faceTexCoords[i * 3] = extracted.faceUVs[i][0];
      faceTexCoords[i * 3 + 1] = extracted.faceUVs[i][1];
      faceTexCoords[i * 3 + 2] = extracted.faceUVs[i][2];
    }

    return new OptimizedMeshData(positions, uvs, faceVertices, faceTexCoords);
  }

  /**
   * Convert OptimizedDecimationResult back to legacy DecimationResult format
   */
  private fromOptimizedResult(
    result: OptimizedDecimationResult,
    _original: {
      vertices: Vec3[];
      faces: [number, number, number][];
      uvs: Vec2[];
      faceUVs: [number, number, number][];
    },
  ): DecimationResult {
    const mesh = result.mesh;

    // Convert typed arrays back to Vec3/Vec2 arrays
    const V: Vec3[] = [];
    for (let i = 0; i < mesh.vertexCount; i++) {
      V.push([
        mesh.positions[i * 3],
        mesh.positions[i * 3 + 1],
        mesh.positions[i * 3 + 2],
      ]);
    }

    const TC: Vec2[] = [];
    // OptimizedMeshData uses 'uvs' property, not 'texCoords'
    const texCoords = mesh.uvs;
    const texCoordCount = texCoords.length / 2;
    for (let i = 0; i < texCoordCount; i++) {
      TC.push([texCoords[i * 2], texCoords[i * 2 + 1]]);
    }

    const F: [number, number, number][] = [];
    const FT: [number, number, number][] = [];
    for (let i = 0; i < mesh.faceCount; i++) {
      F.push([
        mesh.faceVertices[i * 3],
        mesh.faceVertices[i * 3 + 1],
        mesh.faceVertices[i * 3 + 2],
      ]);
      FT.push([
        mesh.faceTexCoords[i * 3],
        mesh.faceTexCoords[i * 3 + 1],
        mesh.faceTexCoords[i * 3 + 2],
      ]);
    }

    return {
      mesh: new MeshData(V, F, TC, FT),
      originalVertices: result.originalVertices,
      finalVertices: result.finalVertices,
      originalFaces: result.originalFaces,
      finalFaces: result.finalFaces,
      collapses: result.collapses,
      stopReason: result.stopReason,
    };
  }

  /**
   * Extract mesh data from a primitive
   * Preserves skinning data (JOINTS_0, WEIGHTS_0) for animated meshes
   */
  private extractMeshData(
    gltf: GLTF,
    binaryChunk: Buffer,
    primitive: GLTFPrimitive,
    _accessorMapping: Map<number, number>,
    _newAccessors: GLTFAccessor[],
  ): {
    vertices: Vec3[];
    faces: [number, number, number][];
    uvs: Vec2[];
    faceUVs: [number, number, number][];
    normals?: Vec3[];
    colors?: [number, number, number, number][];
    /** Bone indices for skinned meshes (JOINTS_0) */
    joints?: [number, number, number, number][];
    /** Bone weights for skinned meshes (WEIGHTS_0) */
    weights?: [number, number, number, number][];
  } | null {
    if (!gltf.accessors || !gltf.bufferViews) return null;

    const positionAccessorIdx = primitive.attributes.POSITION;
    if (positionAccessorIdx === undefined) return null;

    const positionAccessor = gltf.accessors[positionAccessorIdx];
    const vertices = this.readAccessorData<Vec3>(
      gltf,
      binaryChunk,
      positionAccessor,
      "VEC3",
    );

    if (!vertices || vertices.length === 0) return null;

    // Read indices
    let faces: [number, number, number][] = [];
    if (primitive.indices !== undefined) {
      const indicesAccessor = gltf.accessors[primitive.indices];
      const indices = this.readAccessorData<number>(
        gltf,
        binaryChunk,
        indicesAccessor,
        "SCALAR",
      );
      if (indices) {
        // Filter out primitive restart indices (0xFFFFFFFF = 4294967295)
        // and invalid indices that reference non-existent vertices
        const maxValidIndex = vertices.length - 1;
        const PRIMITIVE_RESTART = 0xffffffff;

        for (let i = 0; i < indices.length; i += 3) {
          const i0 = indices[i];
          const i1 = indices[i + 1];
          const i2 = indices[i + 2];

          // Skip triangles with primitive restart indices or negative values (unsigned overflow)
          if (
            i0 === PRIMITIVE_RESTART ||
            i1 === PRIMITIVE_RESTART ||
            i2 === PRIMITIVE_RESTART ||
            i0 < 0 ||
            i1 < 0 ||
            i2 < 0
          ) {
            continue;
          }

          // Skip triangles with out-of-range indices
          if (i0 > maxValidIndex || i1 > maxValidIndex || i2 > maxValidIndex) {
            continue;
          }

          // Skip degenerate triangles (two or more identical indices)
          if (i0 === i1 || i1 === i2 || i0 === i2) {
            continue;
          }

          faces.push([i0, i1, i2]);
        }

        // Only warn if ALL triangles were filtered (indicates a problem)
        if (faces.length === 0 && indices.length > 0) {
          console.warn(
            `[GLBDecimationService] All ${indices.length / 3} triangles filtered out - check for primitive restart or invalid indices`,
          );
        }
      }
    } else {
      // Non-indexed geometry
      for (let i = 0; i < vertices.length; i += 3) {
        faces.push([i, i + 1, i + 2]);
      }
    }

    // Read UVs
    let uvs: Vec2[] = [];
    let faceUVs: [number, number, number][] = [];

    const texcoordIdx = primitive.attributes.TEXCOORD_0;
    if (texcoordIdx !== undefined) {
      const texcoordAccessor = gltf.accessors[texcoordIdx];
      const texcoords = this.readAccessorData<Vec2>(
        gltf,
        binaryChunk,
        texcoordAccessor,
        "VEC2",
      );
      if (texcoords) {
        uvs = texcoords;
        // Same face indices for UVs (1:1 mapping with vertices)
        faceUVs = faces.map((f) => [...f] as [number, number, number]);
      }
    }

    // If no UVs, create default
    if (uvs.length === 0) {
      uvs = vertices.map(() => [0, 0] as Vec2);
      faceUVs = faces.map((f) => [...f] as [number, number, number]);
    }

    // Read normals (optional, for preservation)
    let normals: Vec3[] | undefined;
    const normalIdx = primitive.attributes.NORMAL;
    if (normalIdx !== undefined) {
      const normalAccessor = gltf.accessors[normalIdx];
      normals =
        this.readAccessorData<Vec3>(
          gltf,
          binaryChunk,
          normalAccessor,
          "VEC3",
        ) ?? undefined;
    }

    // Read vertex colors (optional, for preservation)
    let colors: [number, number, number, number][] | undefined;
    const colorIdx = primitive.attributes.COLOR_0;
    if (colorIdx !== undefined) {
      const colorAccessor = gltf.accessors[colorIdx];
      if (colorAccessor.type === "VEC4") {
        colors =
          this.readAccessorData<[number, number, number, number]>(
            gltf,
            binaryChunk,
            colorAccessor,
            "VEC4",
          ) ?? undefined;
      } else if (colorAccessor.type === "VEC3") {
        const rgb = this.readAccessorData<[number, number, number]>(
          gltf,
          binaryChunk,
          colorAccessor,
          "VEC3",
        );
        if (rgb) {
          colors = rgb.map((c) => [c[0], c[1], c[2], 1.0]);
        }
      }
    }

    // Read skinning data (JOINTS_0, WEIGHTS_0) for animated meshes
    // This is critical for preserving bone deformation in LOD meshes
    let joints: [number, number, number, number][] | undefined;
    let weights: [number, number, number, number][] | undefined;

    const jointsIdx = primitive.attributes.JOINTS_0;
    if (jointsIdx !== undefined) {
      const jointsAccessor = gltf.accessors[jointsIdx];
      if (jointsAccessor.type === "VEC4") {
        joints =
          this.readAccessorData<[number, number, number, number]>(
            gltf,
            binaryChunk,
            jointsAccessor,
            "VEC4",
          ) ?? undefined;
      }
    }

    const weightsIdx = primitive.attributes.WEIGHTS_0;
    if (weightsIdx !== undefined) {
      const weightsAccessor = gltf.accessors[weightsIdx];
      if (weightsAccessor.type === "VEC4") {
        weights =
          this.readAccessorData<[number, number, number, number]>(
            gltf,
            binaryChunk,
            weightsAccessor,
            "VEC4",
          ) ?? undefined;
      }
    }

    return { vertices, faces, uvs, faceUVs, normals, colors, joints, weights };
  }

  /**
   * Read accessor data from the binary chunk
   */
  private readAccessorData<T>(
    gltf: GLTF,
    binaryChunk: Buffer,
    accessor: GLTFAccessor,
    expectedType: AccessorType,
  ): T[] | null {
    if (accessor.type !== expectedType) return null;
    if (accessor.bufferView === undefined) return null;
    if (!gltf.bufferViews) return null;

    const bufferView = gltf.bufferViews[accessor.bufferView];
    const byteOffset =
      (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const componentCount = ACCESSOR_TYPES[accessor.type];

    const result: T[] = [];
    const stride =
      bufferView.byteStride ??
      componentCount * this.getComponentSize(accessor.componentType);

    for (let i = 0; i < accessor.count; i++) {
      const offset = byteOffset + i * stride;
      const components: number[] = [];

      for (let c = 0; c < componentCount; c++) {
        const componentOffset =
          offset + c * this.getComponentSize(accessor.componentType);
        const value = this.readComponent(
          binaryChunk,
          componentOffset,
          accessor.componentType,
          accessor.normalized,
        );
        components.push(value);
      }

      if (componentCount === 1) {
        result.push(components[0] as T);
      } else {
        result.push(components as T);
      }
    }

    return result;
  }

  /**
   * Get byte size of a component type
   */
  private getComponentSize(componentType: ComponentType): number {
    switch (componentType) {
      case COMPONENT_TYPES.BYTE:
      case COMPONENT_TYPES.UNSIGNED_BYTE:
        return 1;
      case COMPONENT_TYPES.SHORT:
      case COMPONENT_TYPES.UNSIGNED_SHORT:
        return 2;
      case COMPONENT_TYPES.UNSIGNED_INT:
      case COMPONENT_TYPES.FLOAT:
        return 4;
      default:
        return 4;
    }
  }

  /**
   * Read a single component value
   */
  private readComponent(
    buffer: Buffer,
    offset: number,
    componentType: ComponentType,
    normalized?: boolean,
  ): number {
    let value: number;
    switch (componentType) {
      case COMPONENT_TYPES.BYTE:
        value = buffer.readInt8(offset);
        if (normalized) value /= 127;
        break;
      case COMPONENT_TYPES.UNSIGNED_BYTE:
        value = buffer.readUInt8(offset);
        if (normalized) value /= 255;
        break;
      case COMPONENT_TYPES.SHORT:
        value = buffer.readInt16LE(offset);
        if (normalized) value /= 32767;
        break;
      case COMPONENT_TYPES.UNSIGNED_SHORT:
        value = buffer.readUInt16LE(offset);
        if (normalized) value /= 65535;
        break;
      case COMPONENT_TYPES.UNSIGNED_INT:
        value = buffer.readUInt32LE(offset);
        break;
      case COMPONENT_TYPES.FLOAT:
        value = buffer.readFloatLE(offset);
        break;
      default:
        value = 0;
    }
    return value;
  }

  /**
   * Write decimated geometry to buffer
   * Preserves skinning data (JOINTS_0, WEIGHTS_0) for animated meshes unless stripSkeleton is true.
   *
   * @param result - Decimation result with new mesh data
   * @param original - Original mesh data including skinning
   * @param baseOffset - Starting byte offset in buffer
   * @param baseAccessorIdx - Starting accessor index
   * @param baseBufferViewIdx - Starting buffer view index
   * @param stripSkeleton - If true, omits JOINTS_0 and WEIGHTS_0 (for static LOD meshes)
   */
  private writeDecimatedGeometry(
    result: DecimationResult,
    original: {
      vertices: Vec3[];
      faces: [number, number, number][];
      uvs: Vec2[];
      normals?: Vec3[];
      colors?: [number, number, number, number][];
      joints?: [number, number, number, number][];
      weights?: [number, number, number, number][];
    },
    baseOffset: number,
    baseAccessorIdx: number,
    baseBufferViewIdx: number,
    stripSkeleton: boolean = false,
  ): {
    bufferData: Buffer;
    accessors: Record<string, number>;
    accessorObjects: GLTFAccessor[];
    bufferViews: GLTFBufferView[];
  } {
    const mesh = result.mesh;
    const bufferParts: Buffer[] = [];
    const bufferViews: GLTFBufferView[] = [];
    const accessorObjects: GLTFAccessor[] = [];
    const accessorIndices: Record<string, number> = {};
    let currentOffset = baseOffset;
    let accessorIdx = baseAccessorIdx;
    let bufferViewIdx = baseBufferViewIdx;

    // Build vertex mapping from old indices to new indices
    // This is needed to remap skinning data after decimation
    const vertexMapping = this.buildVertexMapping(original.vertices, mesh.V);

    // Write positions
    const positionBuffer = Buffer.alloc(mesh.V.length * 3 * 4);
    let minPos = [Infinity, Infinity, Infinity];
    let maxPos = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < mesh.V.length; i++) {
      const v = mesh.V[i];
      positionBuffer.writeFloatLE(v[0], i * 12);
      positionBuffer.writeFloatLE(v[1], i * 12 + 4);
      positionBuffer.writeFloatLE(v[2], i * 12 + 8);
      minPos = [
        Math.min(minPos[0], v[0]),
        Math.min(minPos[1], v[1]),
        Math.min(minPos[2], v[2]),
      ];
      maxPos = [
        Math.max(maxPos[0], v[0]),
        Math.max(maxPos[1], v[1]),
        Math.max(maxPos[2], v[2]),
      ];
    }
    bufferParts.push(positionBuffer);
    bufferViews.push({
      buffer: 0,
      byteOffset: currentOffset,
      byteLength: positionBuffer.length,
    });
    accessorObjects.push({
      bufferView: bufferViewIdx,
      componentType: COMPONENT_TYPES.FLOAT,
      count: mesh.V.length,
      type: "VEC3",
      min: minPos,
      max: maxPos,
    });
    accessorIndices.position = accessorIdx++;
    currentOffset += positionBuffer.length;
    bufferViewIdx++;

    // Write indices
    const useUint32 = mesh.V.length > 65535;
    const indexCount = mesh.F.length * 3;
    const indexBuffer = Buffer.alloc(indexCount * (useUint32 ? 4 : 2));
    for (let i = 0; i < mesh.F.length; i++) {
      if (useUint32) {
        indexBuffer.writeUInt32LE(mesh.F[i][0], i * 12);
        indexBuffer.writeUInt32LE(mesh.F[i][1], i * 12 + 4);
        indexBuffer.writeUInt32LE(mesh.F[i][2], i * 12 + 8);
      } else {
        indexBuffer.writeUInt16LE(mesh.F[i][0], i * 6);
        indexBuffer.writeUInt16LE(mesh.F[i][1], i * 6 + 2);
        indexBuffer.writeUInt16LE(mesh.F[i][2], i * 6 + 4);
      }
    }
    bufferParts.push(indexBuffer);
    bufferViews.push({
      buffer: 0,
      byteOffset: currentOffset,
      byteLength: indexBuffer.length,
      target: 34963, // ELEMENT_ARRAY_BUFFER
    });
    accessorObjects.push({
      bufferView: bufferViewIdx,
      componentType: useUint32
        ? COMPONENT_TYPES.UNSIGNED_INT
        : COMPONENT_TYPES.UNSIGNED_SHORT,
      count: indexCount,
      type: "SCALAR",
    });
    accessorIndices.indices = accessorIdx++;
    currentOffset += indexBuffer.length;
    bufferViewIdx++;

    // Write UVs
    if (mesh.TC.length > 0) {
      const uvBuffer = Buffer.alloc(mesh.TC.length * 2 * 4);
      for (let i = 0; i < mesh.TC.length; i++) {
        uvBuffer.writeFloatLE(mesh.TC[i][0], i * 8);
        uvBuffer.writeFloatLE(mesh.TC[i][1], i * 8 + 4);
      }
      bufferParts.push(uvBuffer);
      bufferViews.push({
        buffer: 0,
        byteOffset: currentOffset,
        byteLength: uvBuffer.length,
      });
      accessorObjects.push({
        bufferView: bufferViewIdx,
        componentType: COMPONENT_TYPES.FLOAT,
        count: mesh.TC.length,
        type: "VEC2",
      });
      accessorIndices.texcoord = accessorIdx++;
      currentOffset += uvBuffer.length;
      bufferViewIdx++;
    }

    // Write normals (remapped from original vertices)
    if (original.normals && original.normals.length > 0) {
      const remappedNormals = this.remapVec3Attribute(
        original.normals,
        vertexMapping,
        mesh.V.length,
        mesh.V,
        original.vertices,
      );

      const normalBuffer = Buffer.alloc(remappedNormals.length * 3 * 4);
      for (let i = 0; i < remappedNormals.length; i++) {
        normalBuffer.writeFloatLE(remappedNormals[i][0], i * 12);
        normalBuffer.writeFloatLE(remappedNormals[i][1], i * 12 + 4);
        normalBuffer.writeFloatLE(remappedNormals[i][2], i * 12 + 8);
      }
      bufferParts.push(normalBuffer);
      bufferViews.push({
        buffer: 0,
        byteOffset: currentOffset,
        byteLength: normalBuffer.length,
      });
      accessorObjects.push({
        bufferView: bufferViewIdx,
        componentType: COMPONENT_TYPES.FLOAT,
        count: remappedNormals.length,
        type: "VEC3",
      });
      accessorIndices.normal = accessorIdx++;
      currentOffset += normalBuffer.length;
      bufferViewIdx++;
    }

    // Write vertex colors (remapped from original vertices)
    if (original.colors && original.colors.length > 0) {
      const remappedColors = this.remapVec4Attribute(
        original.colors,
        vertexMapping,
        mesh.V.length,
        mesh.V,
        original.vertices,
      );

      const colorBuffer = Buffer.alloc(remappedColors.length * 4 * 4);
      for (let i = 0; i < remappedColors.length; i++) {
        colorBuffer.writeFloatLE(remappedColors[i][0], i * 16);
        colorBuffer.writeFloatLE(remappedColors[i][1], i * 16 + 4);
        colorBuffer.writeFloatLE(remappedColors[i][2], i * 16 + 8);
        colorBuffer.writeFloatLE(remappedColors[i][3], i * 16 + 12);
      }
      bufferParts.push(colorBuffer);
      bufferViews.push({
        buffer: 0,
        byteOffset: currentOffset,
        byteLength: colorBuffer.length,
      });
      accessorObjects.push({
        bufferView: bufferViewIdx,
        componentType: COMPONENT_TYPES.FLOAT,
        count: remappedColors.length,
        type: "VEC4",
      });
      accessorIndices.color = accessorIdx++;
      currentOffset += colorBuffer.length;
      bufferViewIdx++;
    }

    // Write skinning data (JOINTS_0) - critical for animated meshes!
    // For collapsed vertices, we pick the joints from the vertex with highest total weight
    // Skip if stripSkeleton is true (for static LOD meshes that don't need animation)
    if (
      !stripSkeleton &&
      original.joints &&
      original.joints.length > 0 &&
      original.weights
    ) {
      const remappedJoints = this.remapSkinningData(
        original.joints,
        original.weights,
        vertexMapping,
        mesh.V.length,
        mesh.V, // New vertex positions (for nearest-neighbor fallback)
        original.vertices, // Original vertex positions
      );

      // Write as UNSIGNED_BYTE (most common) or UNSIGNED_SHORT
      const maxJoint = Math.max(...remappedJoints.joints.flatMap((j) => j));
      const useShort = maxJoint > 255;

      if (useShort) {
        const jointsBuffer = Buffer.alloc(remappedJoints.joints.length * 4 * 2);
        for (let i = 0; i < remappedJoints.joints.length; i++) {
          jointsBuffer.writeUInt16LE(
            Math.round(remappedJoints.joints[i][0]),
            i * 8,
          );
          jointsBuffer.writeUInt16LE(
            Math.round(remappedJoints.joints[i][1]),
            i * 8 + 2,
          );
          jointsBuffer.writeUInt16LE(
            Math.round(remappedJoints.joints[i][2]),
            i * 8 + 4,
          );
          jointsBuffer.writeUInt16LE(
            Math.round(remappedJoints.joints[i][3]),
            i * 8 + 6,
          );
        }
        bufferParts.push(jointsBuffer);
        bufferViews.push({
          buffer: 0,
          byteOffset: currentOffset,
          byteLength: jointsBuffer.length,
        });
        accessorObjects.push({
          bufferView: bufferViewIdx,
          componentType: COMPONENT_TYPES.UNSIGNED_SHORT,
          count: remappedJoints.joints.length,
          type: "VEC4",
        });
        currentOffset += jointsBuffer.length;
      } else {
        const jointsBuffer = Buffer.alloc(remappedJoints.joints.length * 4);
        for (let i = 0; i < remappedJoints.joints.length; i++) {
          jointsBuffer.writeUInt8(
            Math.round(remappedJoints.joints[i][0]),
            i * 4,
          );
          jointsBuffer.writeUInt8(
            Math.round(remappedJoints.joints[i][1]),
            i * 4 + 1,
          );
          jointsBuffer.writeUInt8(
            Math.round(remappedJoints.joints[i][2]),
            i * 4 + 2,
          );
          jointsBuffer.writeUInt8(
            Math.round(remappedJoints.joints[i][3]),
            i * 4 + 3,
          );
        }
        bufferParts.push(jointsBuffer);
        bufferViews.push({
          buffer: 0,
          byteOffset: currentOffset,
          byteLength: jointsBuffer.length,
        });
        accessorObjects.push({
          bufferView: bufferViewIdx,
          componentType: COMPONENT_TYPES.UNSIGNED_BYTE,
          count: remappedJoints.joints.length,
          type: "VEC4",
        });
        currentOffset += jointsBuffer.length;
      }
      accessorIndices.joints = accessorIdx++;
      bufferViewIdx++;

      // Write WEIGHTS_0 (paired with joints)
      const weightsBuffer = Buffer.alloc(remappedJoints.weights.length * 4 * 4);
      for (let i = 0; i < remappedJoints.weights.length; i++) {
        weightsBuffer.writeFloatLE(remappedJoints.weights[i][0], i * 16);
        weightsBuffer.writeFloatLE(remappedJoints.weights[i][1], i * 16 + 4);
        weightsBuffer.writeFloatLE(remappedJoints.weights[i][2], i * 16 + 8);
        weightsBuffer.writeFloatLE(remappedJoints.weights[i][3], i * 16 + 12);
      }
      bufferParts.push(weightsBuffer);
      bufferViews.push({
        buffer: 0,
        byteOffset: currentOffset,
        byteLength: weightsBuffer.length,
      });
      accessorObjects.push({
        bufferView: bufferViewIdx,
        componentType: COMPONENT_TYPES.FLOAT,
        count: remappedJoints.weights.length,
        type: "VEC4",
      });
      accessorIndices.weights = accessorIdx++;
      currentOffset += weightsBuffer.length;
      bufferViewIdx++;
    }

    return {
      bufferData: Buffer.concat(bufferParts),
      accessors: accessorIndices,
      accessorObjects,
      bufferViews,
    };
  }

  /**
   * Remap a Vec3 attribute (like normals) from original vertices to new vertices.
   * Uses same nearest-neighbor fallback for unmapped vertices.
   */
  private remapVec3Attribute(
    originalData: Vec3[],
    vertexMapping: Map<number, number>,
    newVertexCount: number,
    newVertices: Vec3[],
    originalVertices: Vec3[],
  ): Vec3[] {
    const result: Vec3[] = [];
    const assigned: boolean[] = new Array(newVertexCount).fill(false);

    // Initialize with defaults
    for (let i = 0; i < newVertexCount; i++) {
      result.push([0, 0, 1]); // Default normal: up
    }

    // Map original vertices to new vertices
    for (let oldIdx = 0; oldIdx < originalData.length; oldIdx++) {
      const newIdx = vertexMapping.get(oldIdx);
      if (newIdx !== undefined && newIdx < newVertexCount) {
        result[newIdx] = [...originalData[oldIdx]] as Vec3;
        assigned[newIdx] = true;
      }
    }

    // Fallback for unmapped vertices: find nearest original
    for (let newIdx = 0; newIdx < newVertexCount; newIdx++) {
      if (!assigned[newIdx]) {
        const nearestOldIdx = this.findNearestVertex(
          newVertices[newIdx],
          originalVertices,
        );
        if (nearestOldIdx < originalData.length) {
          result[newIdx] = [...originalData[nearestOldIdx]] as Vec3;
        }
      }
    }

    return result;
  }

  /**
   * Remap a Vec4 attribute (like colors) from original vertices to new vertices.
   * Uses same nearest-neighbor fallback for unmapped vertices.
   */
  private remapVec4Attribute(
    originalData: [number, number, number, number][],
    vertexMapping: Map<number, number>,
    newVertexCount: number,
    newVertices: Vec3[],
    originalVertices: Vec3[],
  ): [number, number, number, number][] {
    const result: [number, number, number, number][] = [];
    const assigned: boolean[] = new Array(newVertexCount).fill(false);

    // Initialize with defaults (white, full alpha)
    for (let i = 0; i < newVertexCount; i++) {
      result.push([1, 1, 1, 1]);
    }

    // Map original vertices to new vertices
    for (let oldIdx = 0; oldIdx < originalData.length; oldIdx++) {
      const newIdx = vertexMapping.get(oldIdx);
      if (newIdx !== undefined && newIdx < newVertexCount) {
        result[newIdx] = [...originalData[oldIdx]] as [
          number,
          number,
          number,
          number,
        ];
        assigned[newIdx] = true;
      }
    }

    // Fallback for unmapped vertices: find nearest original
    for (let newIdx = 0; newIdx < newVertexCount; newIdx++) {
      if (!assigned[newIdx]) {
        const nearestOldIdx = this.findNearestVertex(
          newVertices[newIdx],
          originalVertices,
        );
        if (nearestOldIdx < originalData.length) {
          result[newIdx] = [...originalData[nearestOldIdx]] as [
            number,
            number,
            number,
            number,
          ];
        }
      }
    }

    return result;
  }

  /**
   * Find the index of the nearest vertex in a list of vertices.
   */
  private findNearestVertex(target: Vec3, vertices: Vec3[]): number {
    let nearestIdx = 0;
    let nearestDistSq = Infinity;

    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];
      const dx = target[0] - v[0];
      const dy = target[1] - v[1];
      const dz = target[2] - v[2];
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearestIdx = i;
      }
    }

    return nearestIdx;
  }

  /**
   * Build a mapping from old vertex indices to new vertex indices.
   * Used for remapping per-vertex attributes (joints, weights) after decimation.
   *
   * IMPORTANT: QEM decimation creates NEW vertices at optimized positions that may not
   * match any original vertex exactly. We use a two-phase approach:
   * 1. Exact position matching (for vertices that survived unchanged)
   * 2. Nearest-neighbor matching is handled separately in remapSkinningData
   *
   * The mapping returned here is: oldVertexIndex -> newVertexIndex
   * Only vertices with exact position matches are included.
   */
  private buildVertexMapping(
    originalVertices: Vec3[],
    newVertices: Vec3[],
  ): Map<number, number> {
    const mapping = new Map<number, number>();
    const epsilon = 0.0001; // Position matching tolerance

    // Build spatial hash for new vertices for O(1) lookup
    const newVertexMap = new Map<string, number>();
    for (let i = 0; i < newVertices.length; i++) {
      const key = this.positionKey(newVertices[i], epsilon);
      newVertexMap.set(key, i);
    }

    // Map each original vertex to its new index (if position matches exactly)
    for (let oldIdx = 0; oldIdx < originalVertices.length; oldIdx++) {
      const key = this.positionKey(originalVertices[oldIdx], epsilon);
      const newIdx = newVertexMap.get(key);
      if (newIdx !== undefined) {
        mapping.set(oldIdx, newIdx);
      }
    }

    return mapping;
  }

  /**
   * Create a hash key for a 3D position (for spatial hashing)
   */
  private positionKey(pos: Vec3, epsilon: number): string {
    // Quantize to epsilon grid
    const x = Math.round(pos[0] / epsilon);
    const y = Math.round(pos[1] / epsilon);
    const z = Math.round(pos[2] / epsilon);
    return `${x},${y},${z}`;
  }

  /**
   * Remap skinning data (joints + weights) from old vertices to new vertices.
   * For collapsed vertices, picks the data from the vertex with highest total weight
   * (joint indices are discrete and cannot be averaged).
   *
   * @param originalJoints - Original JOINTS_0 data (one per original vertex)
   * @param originalWeights - Original WEIGHTS_0 data (one per original vertex)
   * @param vertexMapping - Maps old vertex index -> new vertex index (from buildVertexMapping)
   * @param newVertexCount - Number of vertices in decimated mesh
   * @param newVertices - New vertex positions (for nearest-neighbor fallback)
   * @param originalVertices - Original vertex positions (for nearest-neighbor fallback)
   */
  private remapSkinningData(
    originalJoints: [number, number, number, number][],
    originalWeights: [number, number, number, number][],
    vertexMapping: Map<number, number>,
    newVertexCount: number,
    newVertices: Vec3[],
    originalVertices: Vec3[],
  ): {
    joints: [number, number, number, number][];
    weights: [number, number, number, number][];
  } {
    // For each new vertex, track the best candidate (highest weight sum)
    const bestJoints: [number, number, number, number][] = [];
    const bestWeights: [number, number, number, number][] = [];
    const bestWeightSum: number[] = [];

    // Initialize with invalid markers
    for (let i = 0; i < newVertexCount; i++) {
      bestJoints.push([0, 0, 0, 0]);
      bestWeights.push([0, 0, 0, 0]); // Start with zeros to detect unmapped vertices
      bestWeightSum.push(-1); // -1 indicates no data yet
    }

    // For each original vertex, check if it maps to a new vertex
    // and if its weight sum is higher than current best
    for (let oldIdx = 0; oldIdx < originalJoints.length; oldIdx++) {
      const newIdx = vertexMapping.get(oldIdx);
      if (newIdx !== undefined && newIdx < newVertexCount) {
        const joints = originalJoints[oldIdx];
        const weights = originalWeights[oldIdx];
        const weightSum = weights[0] + weights[1] + weights[2] + weights[3];

        // Pick this vertex's data if it has higher weight sum
        // (or if this is the first vertex mapping to this new index)
        if (weightSum > bestWeightSum[newIdx]) {
          bestJoints[newIdx] = [...joints] as [number, number, number, number];
          bestWeights[newIdx] = [...weights] as [
            number,
            number,
            number,
            number,
          ];
          bestWeightSum[newIdx] = weightSum;
        }
      }
    }

    // CRITICAL: Check for unmapped new vertices and find nearest neighbor
    // This handles vertices created by edge collapse at optimized positions
    let unmappedCount = 0;
    for (let newIdx = 0; newIdx < newVertexCount; newIdx++) {
      if (bestWeightSum[newIdx] < 0) {
        // This new vertex has no mapping - find nearest original vertex
        unmappedCount++;
        const newPos = newVertices[newIdx];
        let nearestOldIdx = 0;
        let nearestDistSq = Infinity;

        for (let oldIdx = 0; oldIdx < originalVertices.length; oldIdx++) {
          const oldPos = originalVertices[oldIdx];
          const dx = newPos[0] - oldPos[0];
          const dy = newPos[1] - oldPos[1];
          const dz = newPos[2] - oldPos[2];
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq < nearestDistSq) {
            nearestDistSq = distSq;
            nearestOldIdx = oldIdx;
          }
        }

        // Use the nearest original vertex's skinning data
        if (nearestOldIdx < originalJoints.length) {
          bestJoints[newIdx] = [...originalJoints[nearestOldIdx]] as [
            number,
            number,
            number,
            number,
          ];
          bestWeights[newIdx] = [...originalWeights[nearestOldIdx]] as [
            number,
            number,
            number,
            number,
          ];
          bestWeightSum[newIdx] = bestWeights[newIdx].reduce(
            (a, b) => a + b,
            0,
          );
        }
      }
    }

    if (unmappedCount > 0) {
      console.log(
        `[GLBDecimationService] Remapped skinning: ${unmappedCount}/${newVertexCount} vertices used nearest-neighbor fallback`,
      );
    }

    // Validate and normalize weights
    let validationIssues = 0;
    for (let i = 0; i < newVertexCount; i++) {
      const w = bestWeights[i];
      const j = bestJoints[i];

      // Validate joint indices are non-negative integers
      for (let k = 0; k < 4; k++) {
        if (j[k] < 0 || !Number.isFinite(j[k])) {
          j[k] = 0;
          validationIssues++;
        }
        // Ensure joint indices are integers
        j[k] = Math.round(j[k]);
      }

      // Validate weights are non-negative
      for (let k = 0; k < 4; k++) {
        if (w[k] < 0 || !Number.isFinite(w[k])) {
          w[k] = 0;
          validationIssues++;
        }
      }

      // Normalize weights to sum to 1.0
      const sum = w[0] + w[1] + w[2] + w[3];
      if (sum > 0.001) {
        w[0] /= sum;
        w[1] /= sum;
        w[2] /= sum;
        w[3] /= sum;
      } else {
        // Fallback: 100% weight to bone 0 (should rarely happen)
        validationIssues++;
        bestWeights[i] = [1, 0, 0, 0];
      }
    }

    if (validationIssues > 0) {
      console.warn(
        `[GLBDecimationService] Skinning validation: ${validationIssues} issues fixed ` +
          `(${newVertexCount} vertices)`,
      );
    }

    return { joints: bestJoints, weights: bestWeights };
  }

  /**
   * Preserve non-mesh data from the original GLB (inverse bind matrices, animations).
   * This data is copied to the new buffer FIRST, before any mesh data.
   * Returns the buffer data and mappings for updating references.
   */
  private preserveNonMeshData(
    gltf: GLTF,
    binaryChunk: Buffer,
    newAccessors: GLTFAccessor[],
    newBufferViews: GLTFBufferView[],
  ): {
    bufferData: Buffer;
    accessorMapping: Map<number, number>;
  } {
    const accessorMapping = new Map<number, number>();
    const bufferParts: Buffer[] = [];
    let currentOffset = 0;

    // Collect all accessor indices that need to be preserved
    const accessorsToPreserve = new Set<number>();

    // Add inverse bind matrices accessors from skins
    if (gltf.skins) {
      for (const skin of gltf.skins) {
        if (skin.inverseBindMatrices !== undefined) {
          accessorsToPreserve.add(skin.inverseBindMatrices);
        }
      }
    }

    // Add animation sampler accessors (input timestamps and output values)
    if (gltf.animations) {
      for (const animation of gltf.animations) {
        for (const sampler of animation.samplers) {
          accessorsToPreserve.add(sampler.input);
          accessorsToPreserve.add(sampler.output);
        }
      }
    }

    // If nothing to preserve, return empty
    if (accessorsToPreserve.size === 0) {
      return {
        bufferData: Buffer.alloc(0),
        accessorMapping,
      };
    }

    // Track which buffer views we've already copied (accessors can share buffer views)
    const bufferViewMapping = new Map<number, number>();
    const copiedBufferViews = new Map<
      number,
      { newIndex: number; newByteOffset: number }
    >();
    const errors: string[] = [];

    // Process each accessor that needs preservation
    for (const accessorIdx of accessorsToPreserve) {
      if (!gltf.accessors || accessorIdx >= gltf.accessors.length) {
        const msg = `Accessor ${accessorIdx} not found (total: ${gltf.accessors?.length ?? 0})`;
        errors.push(msg);
        console.error(`[GLBDecimationService] ERROR: ${msg}`);
        continue;
      }

      const accessor = gltf.accessors[accessorIdx];
      if (accessor.bufferView === undefined) {
        // Accessor without bufferView (all zeros) - create a new accessor referencing nothing
        const newAccessorIdx = newAccessors.length;
        newAccessors.push({
          componentType: accessor.componentType,
          count: accessor.count,
          type: accessor.type,
          min: accessor.min,
          max: accessor.max,
          normalized: accessor.normalized,
        });
        accessorMapping.set(accessorIdx, newAccessorIdx);
        continue;
      }

      // Check if we've already copied this buffer view
      const existingCopy = copiedBufferViews.get(accessor.bufferView);
      if (existingCopy) {
        // Reuse the existing buffer view, just create new accessor pointing to it
        const newAccessorIdx = newAccessors.length;
        newAccessors.push({
          bufferView: existingCopy.newIndex,
          byteOffset: accessor.byteOffset,
          componentType: accessor.componentType,
          count: accessor.count,
          type: accessor.type,
          min: accessor.min,
          max: accessor.max,
          normalized: accessor.normalized,
        });
        accessorMapping.set(accessorIdx, newAccessorIdx);
        continue;
      }

      // Copy the buffer view data
      if (!gltf.bufferViews || accessor.bufferView >= gltf.bufferViews.length) {
        const msg = `BufferView ${accessor.bufferView} not found for accessor ${accessorIdx}`;
        errors.push(msg);
        console.error(`[GLBDecimationService] ERROR: ${msg}`);
        continue;
      }

      const bufferView = gltf.bufferViews[accessor.bufferView];
      const byteOffset = bufferView.byteOffset ?? 0;
      const byteLength = bufferView.byteLength;

      // Extract the raw data from the binary chunk
      const data = Buffer.from(
        binaryChunk.subarray(byteOffset, byteOffset + byteLength),
      );

      // Pad to 4-byte alignment if needed
      const padding = (4 - (data.length % 4)) % 4;
      const paddedData =
        padding > 0 ? Buffer.concat([data, Buffer.alloc(padding)]) : data;

      bufferParts.push(paddedData);

      // Create new buffer view
      const newBufferViewIdx = newBufferViews.length;
      newBufferViews.push({
        buffer: 0,
        byteOffset: currentOffset,
        byteLength: data.length, // Use original length, not padded
        byteStride: bufferView.byteStride,
        target: bufferView.target,
      });

      // Track the copy for potential reuse
      copiedBufferViews.set(accessor.bufferView, {
        newIndex: newBufferViewIdx,
        newByteOffset: currentOffset,
      });
      bufferViewMapping.set(accessor.bufferView, newBufferViewIdx);

      // Create new accessor pointing to the new buffer view
      const newAccessorIdx = newAccessors.length;
      newAccessors.push({
        bufferView: newBufferViewIdx,
        byteOffset: accessor.byteOffset,
        componentType: accessor.componentType,
        count: accessor.count,
        type: accessor.type,
        min: accessor.min,
        max: accessor.max,
        normalized: accessor.normalized,
      });
      accessorMapping.set(accessorIdx, newAccessorIdx);

      currentOffset += paddedData.length;
    }

    // Log what we preserved (including any errors)
    const skinCount = gltf.skins?.length ?? 0;
    const animCount = gltf.animations?.length ?? 0;
    if (skinCount > 0 || animCount > 0 || errors.length > 0) {
      const errorSuffix = errors.length > 0 ? ` (${errors.length} errors)` : "";
      console.log(
        `[GLBDecimationService] Preserved non-mesh data: ${skinCount} skin(s), ${animCount} animation(s), ` +
          `${accessorsToPreserve.size} accessor(s), ${bufferParts.length} buffer view(s), ${currentOffset} bytes${errorSuffix}`,
      );
      if (errors.length > 0) {
        console.error(
          `[GLBDecimationService] Preservation errors:\n  - ${errors.join("\n  - ")}`,
        );
      }
    }

    return {
      bufferData:
        bufferParts.length > 0 ? Buffer.concat(bufferParts) : Buffer.alloc(0),
      accessorMapping,
    };
  }

  /**
   * Rebuild accessors array.
   * Non-mesh accessors are already added by preserveNonMeshData, so we just return newAccessors.
   */
  private rebuildAccessors(
    gltf: GLTF,
    _mapping: Map<number, number>,
    newAccessors: GLTFAccessor[],
  ): GLTFAccessor[] {
    if (newAccessors.length === 0) {
      return gltf.accessors ?? [];
    }
    // All accessors (preserved + mesh) are now in newAccessors
    return newAccessors;
  }

  /**
   * Rebuild buffer views array
   */
  private rebuildBufferViews(
    gltf: GLTF,
    newBufferViews: GLTFBufferView[],
  ): GLTFBufferView[] {
    return newBufferViews.length > 0
      ? newBufferViews
      : (gltf.bufferViews ?? []);
  }

  /**
   * Build a GLB from glTF and binary data
   */
  private buildGLB(gltf: GLTF, binaryData: Buffer): Buffer {
    // Serialize JSON
    const jsonString = JSON.stringify(gltf);
    let jsonBuffer = Buffer.from(jsonString, "utf8");

    // Pad JSON to 4-byte alignment
    const jsonPadding = (4 - (jsonBuffer.length % 4)) % 4;
    if (jsonPadding > 0) {
      jsonBuffer = Buffer.concat([jsonBuffer, Buffer.alloc(jsonPadding, 0x20)]);
    }

    // Pad binary to 4-byte alignment
    const binPadding = (4 - (binaryData.length % 4)) % 4;
    const paddedBinary =
      binPadding > 0
        ? Buffer.concat([binaryData, Buffer.alloc(binPadding)])
        : binaryData;

    // Calculate total length
    const totalLength = 12 + 8 + jsonBuffer.length + 8 + paddedBinary.length;

    // Build GLB
    const header = Buffer.alloc(12);
    header.writeUInt32LE(GLB_MAGIC, 0);
    header.writeUInt32LE(GLB_VERSION, 4);
    header.writeUInt32LE(totalLength, 8);

    const jsonChunkHeader = Buffer.alloc(8);
    jsonChunkHeader.writeUInt32LE(jsonBuffer.length, 0);
    jsonChunkHeader.writeUInt32LE(CHUNK_TYPE_JSON, 4);

    const binChunkHeader = Buffer.alloc(8);
    binChunkHeader.writeUInt32LE(paddedBinary.length, 0);
    binChunkHeader.writeUInt32LE(CHUNK_TYPE_BIN, 4);

    return Buffer.concat([
      header,
      jsonChunkHeader,
      jsonBuffer,
      binChunkHeader,
      paddedBinary,
    ]);
  }

  /**
   * Decimate a GLB file from path
   */
  async decimateGLBFile(
    inputPath: string,
    outputPath: string,
    options: DecimationOptions,
  ): Promise<GLBDecimationResult> {
    const inputBuffer = Buffer.from(await Bun.file(inputPath).arrayBuffer());
    const result = await this.decimateGLB(inputBuffer, options);

    if (result.success && result.outputBuffer) {
      await Bun.write(outputPath, result.outputBuffer);
    }

    return result;
  }
}
