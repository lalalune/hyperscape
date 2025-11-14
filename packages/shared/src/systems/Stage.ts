/**
 * Stage.ts - Three.js Scene Management System
 *
 * Manages the Three.js scene graph, including mesh rendering, material management,
 * and spatial indexing via octree for efficient raycasting.
 *
 * **Core Responsibilities:**
 * - Scene graph management (add/remove objects)
 * - Instanced mesh rendering for performance
 * - Material creation and management
 * - Octree spatial indexing for raycasting
 * - Pointer raycasting for UI interactions
 * - Environment (skybox, fog, background) management
 *
 * **Instanced Rendering:**
 * Multiple objects with the same geometry/material are batched into InstancedMesh
 * for single-draw-call rendering (massive performance gain for many identical objects).
 *
 * **Octree:**
 * Uses LooseOctree for spatial partitioning to accelerate raycasts.
 * Automatically grows/shrinks as objects are added/removed.
 *
 * **Material Proxies:**
 * Materials are wrapped in proxies to provide reactive property updates
 * (e.g., changing proxy.color automatically updates the Three.js material).
 *
 * **Usage:**
 * ```ts
 * // Insert a mesh into the scene
 * const handle = world.stage.insert({
 *   geometry: boxGeometry,
 *   material: material,
 *   matrix: transformMatrix,
 *   node: someNode,
 *   linked: true  // Use instancing
 * });
 *
 * // Move the object
 * handle.move(newMatrix);
 *
 * // Raycast for pointer interaction
 * const hits = world.stage.raycastPointer({ x: 0.5, y: 0.5 });
 * ```
 *
 * **Referenced by:** All rendering code, Entity.ts, Node system, ClientGraphics
 */

import { isNumber } from "lodash-es";

import { LooseOctree } from "../extras/LooseOctree";
import THREE from "../extras/three";
import { SystemBase } from "./SystemBase";
import { World } from "../World";

import type { SkyHandle } from "../types";
import type {
  MaterialWithColor,
  MaterialWithEmissive,
  MaterialWithFog,
  MaterialWithTexture,
  MaterialOptions,
  MaterialProxy,
  MaterialWrapper,
  InsertOptions,
  StageHandle,
  StageItem,
} from "../types/materials";
export type {
  MaterialOptions,
  MaterialWrapper,
  InsertOptions,
  StageHandle,
} from "../types/materials";

/** Type guard: Check if material has color property */
function hasColorProperty(
  material: THREE.Material,
): material is MaterialWithColor {
  return (material as MaterialWithColor).color !== undefined;
}

/** Type guard: Check if material has emissiveIntensity property */
function hasEmissiveProperty(
  material: THREE.Material,
): material is MaterialWithEmissive {
  return (material as MaterialWithEmissive).emissiveIntensity !== undefined;
}

/** Type guard: Check if material has fog property */
function hasFogProperty(material: THREE.Material): material is MaterialWithFog {
  return (material as MaterialWithFog).fog !== undefined;
}

/**
 * Stage System - Three.js Scene Graph Manager
 *
 * Central system for managing the 3D scene, meshes, materials, and raycasting.
 */
export class Stage extends SystemBase {
  scene: THREE.Scene;
  environment: unknown;
  private models: Map<string, Model>;
  octree: LooseOctree; // Made public for Model access
  private defaultMaterial: MaterialWrapper | null = null;
  private raycaster: THREE.Raycaster;
  private raycastHits: unknown[] = [];
  private maskNone: THREE.Layers;
  private dirtyNodes: Set<unknown> = new Set();
  private _tempVec2 = new THREE.Vector2();
  private _tempVec3 = new THREE.Vector3();

  THREE?: typeof THREE;

  // Public methods for managing dirty nodes
  addDirtyNode(node: unknown): void {
    this.dirtyNodes.add(node);
  }

  deleteDirtyNode(node: unknown): void {
    this.dirtyNodes.delete(node);
  }
  private viewport?: HTMLElement;

  constructor(world: World) {
    super(world, {
      name: "stage",
      dependencies: { required: [], optional: [] },
      autoCleanup: true,
    });
    this.scene = new THREE.Scene();
    this.models = new Map();
    this.octree = new LooseOctree({
      scene: this.scene,
      center: new THREE.Vector3(0, 0, 0),
      size: 10,
    });
    this.raycaster = new THREE.Raycaster();
    this.maskNone = new THREE.Layers();
    this.maskNone.enableAll();
  }

  override async init(options: unknown): Promise<void> {
    const stageOptions = options as { viewport?: HTMLElement };
    this.viewport = stageOptions.viewport;
    if (this.world.rig) {
      this.scene.add(this.world.rig);
    }
  }

  start(): void {
    // Add a grid for visual reference
    const gridHelper = new THREE.GridHelper(1000, 100, 0x444444, 0x222222);
    gridHelper.position.y = 0.01; // Slightly above ground
    // Ensure helper is ignored by click-to-move raycasts
    gridHelper.name = "stage-grid-helper";
    gridHelper.userData.ignoreClickMove = true;
    this.scene.add(gridHelper);

    this.logger.info("Created visible ground plane");
  }

  private cloneMaterialTexture(
    material: THREE.Material,
    property: string,
  ): THREE.Texture | null {
    if (!hasFogProperty(material)) return null;

    const textureMap = material as MaterialWithTexture;
    let texture: THREE.Texture | null | undefined = null;

    switch (property) {
      case "map":
        texture = textureMap.map;
        break;
      case "emissiveMap":
        texture = textureMap.emissiveMap;
        break;
      case "normalMap":
        texture = textureMap.normalMap;
        break;
      case "bumpMap":
        texture = textureMap.bumpMap;
        break;
      case "roughnessMap":
        texture = textureMap.roughnessMap;
        break;
      case "metalnessMap":
        texture = textureMap.metalnessMap;
        break;
      default:
        return null;
    }

    return texture?.clone() || null;
  }

  override update(_delta: number): void {
    this.models.forEach((model) => model.clean());
  }

  override postUpdate(): void {
    this.clean(); // after update all matrices should be up to date for next step
  }

  override postLateUpdate(): void {
    this.clean(); // after lateUpdate all matrices should be up to date for next step
  }

  getDefaultMaterial(): MaterialWrapper {
    if (!this.defaultMaterial) {
      this.defaultMaterial = this.createMaterial();
    }
    return this.defaultMaterial;
  }

  clean(): void {
    for (const node of this.dirtyNodes) {
      if (node && typeof node === "object" && "clean" in node) {
        const nodeWithClean = node as { clean: () => void };
        nodeWithClean.clean();
      }
    }
    this.dirtyNodes.clear();
  }

  insert(options: InsertOptions): StageHandle {
    if (options.linked) {
      return this.insertLinked(options);
    } else {
      return this.insertSingle(options);
    }
  }

  private insertLinked(options: InsertOptions): StageHandle {
    const {
      geometry,
      material,
      castShadow = false,
      receiveShadow = false,
      node,
      matrix,
    } = options;
    const id = `${geometry.uuid}/${material.uuid}/${castShadow}/${receiveShadow}`;

    if (!this.models.has(id)) {
      const model = new Model(
        this,
        geometry,
        material,
        castShadow,
        receiveShadow,
      );
      this.models.set(id, model);
    }

    return this.models.get(id)!.create(node, matrix);
  }

  private insertSingle(options: InsertOptions): StageHandle {
    const {
      geometry,
      material,
      castShadow = false,
      receiveShadow = false,
      node,
      matrix,
    } = options;
    const materialWrapper = this.createMaterial({ raw: material });
    const mesh = new THREE.Mesh(geometry, materialWrapper.raw);

    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.matrixWorld.copy(matrix);
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldAutoUpdate = false;

    const sItem: StageItem = {
      matrix,
      geometry,
      material: materialWrapper.raw,
      getEntity: () => {
        const nodeWithCtx = node as { ctx?: { entity?: unknown } };
        return nodeWithCtx?.ctx?.entity;
      },
      node,
    };

    this.scene.add(mesh);
    this.octree.insert(sItem);

    return {
      material: materialWrapper.proxy,
      move: (newMatrix: THREE.Matrix4) => {
        mesh.matrixWorld.copy(newMatrix);
        this.octree.move(sItem);
      },
      destroy: () => {
        this.scene.remove(mesh);
        this.octree.remove(sItem);
      },
    };
  }

  createMaterial(options: MaterialOptions = {}): MaterialWrapper {
    const self = this;
    let raw: THREE.Material;

    if (options.raw) {
      raw = options.raw.clone();
    } else if (options.unlit) {
      raw = new THREE.MeshBasicMaterial({
        color: options.color || "white",
      });
    } else {
      raw = new THREE.MeshStandardMaterial({
        color: options.color || "white",
        metalness: isNumber(options.metalness) ? options.metalness : 0,
        roughness: isNumber(options.roughness) ? options.roughness : 1,
      });
    }

    // Set shadow side property with type checking
    if (hasFogProperty(raw)) {
      raw.fog = true; // fix csm shadow banding
    }
    const textures: THREE.Texture[] = [];

    const mapTexture = this.cloneMaterialTexture(raw, "map");
    if (mapTexture) {
      raw.map = mapTexture;
      textures.push(mapTexture);
    }
    const emissiveMapTexture = this.cloneMaterialTexture(raw, "emissiveMap");
    if (emissiveMapTexture) {
      raw.emissiveMap = emissiveMapTexture;
      textures.push(emissiveMapTexture);
    }
    const normalMapTexture = this.cloneMaterialTexture(raw, "normalMap");
    if (normalMapTexture) {
      raw.normalMap = normalMapTexture;
      textures.push(normalMapTexture);
    }
    const bumpMapTexture = this.cloneMaterialTexture(raw, "bumpMap");
    if (bumpMapTexture) {
      raw.bumpMap = bumpMapTexture;
      textures.push(bumpMapTexture);
    }
    const roughnessMapTexture = this.cloneMaterialTexture(raw, "roughnessMap");
    if (roughnessMapTexture) {
      raw.roughnessMap = roughnessMapTexture;
      textures.push(roughnessMapTexture);
    }
    const metalnessMapTexture = this.cloneMaterialTexture(raw, "metalnessMap");
    if (metalnessMapTexture) {
      raw.metalnessMap = metalnessMapTexture;
      textures.push(metalnessMapTexture);
    }

    this.world.setupMaterial(raw);

    const proxy: MaterialProxy = {
      get id() {
        return raw.uuid;
      },
      get textureX() {
        return textures[0]?.offset.x || 0;
      },
      set textureX(val: number) {
        for (const tex of textures) {
          tex.offset.x = val;
        }
        raw.needsUpdate = true;
      },
      get textureY() {
        return textures[0]?.offset.y || 0;
      },
      set textureY(val: number) {
        for (const tex of textures) {
          tex.offset.y = val;
        }
        raw.needsUpdate = true;
      },
      get color() {
        return hasColorProperty(raw) ? raw.color.getHexString() : "ffffff";
      },
      set color(val: string) {
        if (typeof val !== "string") {
          throw new Error(
            '[material] color must be a string (e.g. "red", "#ff0000", "rgb(255,0,0)")',
          );
        }
        if (hasColorProperty(raw)) {
          raw.color.set(val);
          raw.needsUpdate = true;
        }
      },
      get emissiveIntensity() {
        return hasEmissiveProperty(raw) ? raw.emissiveIntensity : 0;
      },
      set emissiveIntensity(value: number) {
        if (!isNumber(value)) {
          throw new Error("[material] emissiveIntensity not a number");
        }
        if (hasEmissiveProperty(raw)) {
          raw.emissiveIntensity = value;
          raw.needsUpdate = true;
        }
      },
      get fog() {
        return hasFogProperty(raw) ? raw.fog : true;
      },
      set fog(value: boolean) {
        if (hasFogProperty(raw)) {
          raw.fog = value;
          raw.needsUpdate = true;
        }
      },
      get _ref() {
        // Check if material access is allowed on world
        if (self.world._allowMaterial) return materialWrapper;
        return undefined;
      },
    };

    const materialWrapper: MaterialWrapper = {
      raw,
      proxy,
    };
    return materialWrapper;
  }

  raycastPointer(
    position: { x: number; y: number },
    layers: THREE.Layers = this.maskNone,
    min = 0,
    max = Infinity,
  ): unknown[] {
    if (!this.viewport) throw new Error("no viewport");

    const rect = this.viewport.getBoundingClientRect();
    const vec2 = this._tempVec2;
    vec2.x = ((position.x - rect.left) / rect.width) * 2 - 1;
    vec2.y = -((position.y - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(vec2, this.world.camera);
    this.raycaster.layers = layers;
    this.raycaster.near = min;
    this.raycaster.far = max;
    this.raycastHits.length = 0;
    const raycastHits = this.raycastHits as THREE.Intersection[];
    this.octree.raycast(this.raycaster, raycastHits);

    return this.raycastHits;
  }

  override destroy(): void {
    this.models.clear();
  }

  // IStage interface methods
  add(object: unknown): void {
    // Check if the object is a Hyperscape Node
    if (
      object &&
      typeof object === "object" &&
      "id" in object &&
      "type" in object &&
      "children" in object
    ) {
      // This appears to be a Hyperscape Node, not a THREE.Object3D
      console.warn(
        "[Stage] Attempted to add a Hyperscape Node to the scene. Nodes should be converted to THREE.Object3D first.",
      );

      // If it's a Node with a mesh property, add the mesh instead
      if ("mesh" in object) {
        const objectWithMesh = object as { mesh: THREE.Object3D };
        // Strong type assumption - mesh is THREE.Object3D
        if (objectWithMesh.mesh) {
          this.scene.add(objectWithMesh.mesh);
          return;
        }
      }

      // Otherwise, skip adding it
      console.warn("[Stage] Skipping Node object:", object);
      return;
    }

    // Strong type assumption - object is THREE.Object3D
    const obj3d = object as THREE.Object3D;
    if (obj3d) {
      this.scene.add(obj3d);
    } else {
      console.warn("[Stage] Object is null or undefined:", object);
    }
  }

  remove(object: unknown): void {
    // Check if the object is a Hyperscape Node
    if (
      object &&
      typeof object === "object" &&
      "id" in object &&
      "type" in object &&
      "children" in object
    ) {
      // If it's a Node with a mesh property, remove the mesh instead
      if ("mesh" in object) {
        const objectWithMesh = object as { mesh: THREE.Object3D };
        // Strong type assumption - mesh is THREE.Object3D
        if (objectWithMesh.mesh) {
          this.scene.remove(objectWithMesh.mesh);
          return;
        }
      }

      console.warn(
        "[Stage] Attempted to remove a Hyperscape Node from the scene.",
      );
      return;
    }

    // Strong type assumption - object is THREE.Object3D
    const obj3d = object as THREE.Object3D;
    if (obj3d) {
      this.scene.remove(obj3d);
    } else {
      console.warn("[Stage] Object is null or undefined:", object);
    }
  }

  setEnvironment(texture: unknown): void {
    const threeTexture = texture as THREE.Texture;
    this.scene.environment = threeTexture;
  }

  setBackground(background: unknown): void {
    const threeBackground = background as
      | THREE.Color
      | THREE.Texture
      | THREE.CubeTexture;
    this.scene.background = threeBackground;
  }

  setFog(fog: unknown): void {
    const threeFog = fog as THREE.Fog | THREE.FogExp2;
    this.scene.fog = threeFog;
  }

  setSky(skyData: {
    bg?: string | null;
    hdr?: string | null;
    sunDirection?: [number, number, number] | null;
    sunIntensity?: number | null;
    sunColor?: string | null;
    fogNear?: number | null;
    fogFar?: number | null;
    fogColor?: string | null;
  }): SkyHandle {
    // Delegate to the environment system
    const environment = this.world.getSystem(
      "environment",
    ) as import("./Environment").Environment;
    if (!environment) {
      throw new Error("ClientEnvironment system not found");
    }

    // Create a sky node compatible with ClientEnvironment.addSky
    // Convert null values to undefined to match SkyNode interface
    const skyNode = {
      _bg: skyData.bg ?? undefined,
      _hdr: skyData.hdr ?? undefined,
      _sunDirection: skyData.sunDirection
        ? this._tempVec3
            .set(
              skyData.sunDirection[0],
              skyData.sunDirection[1],
              skyData.sunDirection[2],
            )
            .clone()
        : undefined,
      _sunIntensity: skyData.sunIntensity ?? undefined,
      _sunColor: skyData.sunColor ?? undefined,
      _fogNear: skyData.fogNear ?? undefined,
      _fogFar: skyData.fogFar ?? undefined,
      _fogColor: skyData.fogColor ?? undefined,
    };

    return environment.addSky(skyNode) as unknown as SkyHandle;
  }
}

// Internal Model class for instanced rendering
class Model {
  private stage: Stage;
  private geometry: THREE.BufferGeometry;
  private material: MaterialWrapper;
  private castShadow: boolean;
  private receiveShadow: boolean;
  private iMesh: THREE.InstancedMesh;
  private items: Array<{ idx: number; node: unknown; matrix: THREE.Matrix4 }> =
    [];
  private dirty = true;

  constructor(
    stage: Stage,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    castShadow: boolean,
    receiveShadow: boolean,
  ) {
    this.stage = stage;
    this.geometry = geometry;
    this.material = stage.createMaterial({ raw: material });
    this.castShadow = castShadow;
    this.receiveShadow = receiveShadow;

    // Check for boundsTree extension (three-mesh-bvh)
    const geometryWithBounds = this.geometry as THREE.BufferGeometry & {
      boundsTree?: unknown;
      computeBoundsTree?: () => void;
    };
    if (
      !geometryWithBounds.boundsTree &&
      geometryWithBounds.computeBoundsTree
    ) {
      geometryWithBounds.computeBoundsTree();
    }

    this.iMesh = new THREE.InstancedMesh(this.geometry, this.material.raw, 10);
    this.iMesh.castShadow = this.castShadow;
    this.iMesh.receiveShadow = this.receiveShadow;
    this.iMesh.matrixAutoUpdate = false;
    this.iMesh.matrixWorldAutoUpdate = false;
    this.iMesh.frustumCulled = false;
    // Attach getEntity method to instanced mesh for entity queries
    const meshWithEntity = this.iMesh as THREE.InstancedMesh & {
      getEntity?: (instanceId: number) => unknown;
    };
    meshWithEntity.getEntity = this.getEntity.bind(this);
  }

  create(node: unknown, matrix: THREE.Matrix4): StageHandle {
    const item = {
      idx: this.items.length,
      node,
      matrix,
    };

    this.items.push(item);
    this.iMesh.setMatrixAt(item.idx, item.matrix);
    this.dirty = true;

    const sItem: StageItem = {
      matrix,
      geometry: this.geometry,
      material: this.material.raw,
      getEntity: () => {
        const nodeWithCtx = this.items[item.idx]?.node as {
          ctx?: { entity?: unknown };
        };
        return nodeWithCtx?.ctx?.entity;
      },
      node,
    };

    this.stage.octree.insert(sItem);

    return {
      material: this.material.proxy,
      move: (newMatrix: THREE.Matrix4) => {
        this.move(item, newMatrix);
        this.stage.octree.move(sItem);
      },
      destroy: () => {
        this.destroy(item);
        this.stage.octree.remove(sItem);
      },
    };
  }

  private move(
    item: { idx: number; node: unknown; matrix: THREE.Matrix4 },
    matrix: THREE.Matrix4,
  ): void {
    item.matrix.copy(matrix);
    this.iMesh.setMatrixAt(item.idx, matrix);
    this.dirty = true;
  }

  private destroy(item: {
    idx: number;
    node: unknown;
    matrix: THREE.Matrix4;
  }): void {
    const last = this.items[this.items.length - 1];
    const isOnly = this.items.length === 1;
    const isLast = item === last;

    if (isOnly) {
      this.items = [];
      this.dirty = true;
    } else if (isLast) {
      this.items.pop();
      this.dirty = true;
    } else if (last) {
      this.iMesh.setMatrixAt(item.idx, last.matrix);
      last.idx = item.idx;
      this.items[item.idx] = last;
      this.items.pop();
      this.dirty = true;
    }
  }

  clean(): void {
    if (!this.dirty) return;

    const size = this.iMesh.instanceMatrix.array.length / 16;
    const count = this.items.length;

    if (size < this.items.length) {
      const newSize = count + 100;
      // Resize instanced mesh if resize method exists
      const meshWithResize = this.iMesh as THREE.InstancedMesh & {
        resize?: (size: number) => void;
      };
      if (meshWithResize.resize) {
        meshWithResize.resize(newSize);
      }
      for (let i = size; i < count; i++) {
        const item = this.items[i];
        if (item) {
          this.iMesh.setMatrixAt(i, item.matrix);
        }
      }
    }

    this.iMesh.count = count;

    if (this.iMesh.parent && !count) {
      this.stage.scene.remove(this.iMesh);
      this.dirty = false;
      return;
    }

    if (!this.iMesh.parent && count) {
      this.stage.scene.add(this.iMesh);
    }

    this.iMesh.instanceMatrix.needsUpdate = true;
    this.dirty = false;
  }

  private getEntity(instanceId: number): unknown {
    const nodeWithCtx = this.items[instanceId]?.node as {
      ctx?: { entity?: unknown };
    };
    return nodeWithCtx?.ctx?.entity;
  }

  getTriangles(): number {
    const geometry = this.geometry;
    if (geometry.index !== null) {
      return geometry.index.count / 3;
    } else {
      const position = geometry.attributes["position"];
      return position ? position.count / 3 : 0;
    }
  }
}
