/**
 * glbToNodes.ts - GLB to Hyperscape Node Converter
 *
 * Converts GLTF/GLB scene graphs into Hyperscape's custom Node system.
 * This enables GLB files exported from Blender to work with Hyperscape's physics,
 * networking, and lifecycle systems.
 *
 * Conversion Process:
 * 1. Parse GLB scene hierarchy (THREE.Scene/Group/Mesh objects)
 * 2. Convert each THREE object to appropriate Node type
 * 3. Preserve hierarchy, transforms, and custom properties
 * 4. Set up physics for rigidbody/collider nodes
 * 5. Configure LOD levels if specified
 *
 * Supported Node Types:
 * - Scene/Group/Object3D → 'group' node (container)
 * - Mesh → 'mesh' node (renderable geometry)
 * - SkinnedMesh → 'skinnedmesh' node (animated character)
 * - Custom: node="rigidbody" → Physics-enabled object
 * - Custom: node="collider" → Collision shape
 * - Custom: node="lod" → Level-of-detail container
 *
 * Custom Properties (set in Blender via Custom Properties panel):
 * - node: 'rigidbody' | 'collider' | 'lod' (type override)
 * - type: 'static' | 'dynamic' | 'kinematic' (rigidbody type)
 * - mass: number (rigidbody mass)
 * - convex: boolean (collider convexity)
 * - trigger: boolean (collider is trigger)
 * - maxDistance: number (LOD distance threshold)
 * - scaleAware: boolean (LOD uses scale for distance)
 * - exp_splatmap: boolean (terrain splatmap shader)
 *
 * Usage:
 * ```ts
 * const glb = await loader.load('model', 'asset://models/building.glb');
 * const root = glbToNodes(glb, world);
 * root.activate(world);
 * ```
 *
 * Referenced by: ClientLoader, asset loading pipeline
 */

import { createNode } from "./createNode";
import THREE from "./three";
import CustomShaderMaterial from "../../libs/three-custom-shader-material";
import { World } from "../../core/World";
import type { Node } from "../../nodes/Node";
import type { NodeData, GLBData } from "../../types";
import type {
  MeshData,
  SkinnedMeshData,
  LODData,
} from "../../types/rendering/nodes";

/** THREE.js object types that map to Group nodes */
const groupTypes = ["Scene", "Group", "Object3D"];

/** Union type for all possible node data configurations during GLB parsing */
type GLBNodeData =
  | NodeData
  | MeshData
  | SkinnedMeshData
  | LODData
  | (NodeData & {
      object3d?: THREE.Object3D;
      animations?: unknown[];
      mass?: number;
      maxDistance?: number;
      convex?: boolean;
      trigger?: boolean;
      geometry?: THREE.BufferGeometry;
    });

/**
 * Convert GLB Scene Graph to Hyperscape Nodes
 *
 * Recursively processes a GLB's THREE.js scene graph and converts it to Nodes.
 *
 * @param glb - Loaded GLB data (scene, animations, userData)
 * @param world - World instance for context
 * @returns Root group node containing entire hierarchy
 */
export function glbToNodes(glb: GLBData, world: World) {
  function registerNode(name: string, data: GLBNodeData) {
    const node = createNode(name, data);
    return node;
  }
  interface ParentNode {
    name: string;
    add: (node: Node) => void;
    insert: (node: Node, distance: number) => void;
  }

  function wrapNodeAsParent(node: Node): ParentNode {
    return {
      name: node.name,
      add: (childNode: Node) => node.add(childNode),
      insert: (childNode: Node, distance: number) => {
        // Only LOD nodes have insert method
        if ("insert" in node) {
          // Assume insert method exists on LOD nodes
          (
            node as Node & { insert: (child: Node, distance: number) => void }
          ).insert(childNode, distance);
        } else {
          node.add(childNode);
        }
      },
    };
  }

  function parse(object3ds: THREE.Object3D[], parentNode: ParentNode) {
    for (const object3d of object3ds) {
      const props = object3d.userData || {};
      const isSkinnedMeshRoot = !!object3d.children.find(
        (c) =>
          (c as THREE.Object3D & { isSkinnedMesh?: boolean }).isSkinnedMesh,
      );
      // SkinnedMesh (root)
      if (isSkinnedMeshRoot) {
        const node = registerNode("skinnedmesh", {
          id: object3d.name,
          object3d,
          animations: glb.animations || [],
          castShadow: props.castShadow,
          receiveShadow: props.receiveShadow,
          active: props.active,
          position: object3d.position.toArray() as [number, number, number],
          quaternion: [
            object3d.quaternion.x,
            object3d.quaternion.y,
            object3d.quaternion.z,
            object3d.quaternion.w,
          ] as [number, number, number, number],
          scale: object3d.scale.toArray() as [number, number, number],
        });
        if (parentNode.name === "lod" && props.maxDistance) {
          parentNode.insert(node, props.maxDistance);
        } else {
          parentNode.add(node);
        }
        // parse(object3d.children, node)
      }
      // LOD (custom node)
      else if (props.node === "lod") {
        const node = registerNode("lod", {
          id: object3d.name,
          position: object3d.position.toArray() as [number, number, number],
          quaternion: [
            object3d.quaternion.x,
            object3d.quaternion.y,
            object3d.quaternion.z,
            object3d.quaternion.w,
          ] as [number, number, number, number],
          scale: object3d.scale.toArray() as [number, number, number],
          scaleAware: props.scaleAware,
        });
        parentNode.add(node);
        // object3d.children is already typed as THREE.Object3D[]
        parse(object3d.children as THREE.Object3D[], wrapNodeAsParent(node));
      }
      // RigidBody (custom node)
      else if (props.node === "rigidbody") {
        const node = registerNode("rigidbody", {
          id: object3d.name,
          type: props.type,
          mass: props.mass,
          position: object3d.position.toArray() as [number, number, number],
          quaternion: [
            object3d.quaternion.x,
            object3d.quaternion.y,
            object3d.quaternion.z,
            object3d.quaternion.w,
          ] as [number, number, number, number],
          scale: object3d.scale.toArray() as [number, number, number],
        });
        parentNode.add(node);
        // object3d.children is already typed as THREE.Object3D[]
        parse(object3d.children as THREE.Object3D[], wrapNodeAsParent(node));
      }
      // Collider (custom node)
      else if (props.node === "collider" && object3d instanceof THREE.Mesh) {
        // NOTE: in blender if you export a single object with node:collider but it has multiple materials, it converts this into a Group with one Mesh for each material.
        // but since the Group is the one that has the collider custom property, it won't work as expected. we could hack to fix this, but i think it adds a layer of indirection.
        // colliders should not have materials on them.
        const mesh = object3d;
        const node = registerNode("collider", {
          id: mesh.name,
          type: "geometry",
          geometry: mesh.geometry,
          convex: props.convex,
          trigger: props.trigger,
          position: mesh.position.toArray() as [number, number, number],
          quaternion: [
            mesh.quaternion.x,
            mesh.quaternion.y,
            mesh.quaternion.z,
            mesh.quaternion.w,
          ] as [number, number, number, number],
          scale: mesh.scale.toArray() as [number, number, number],
        });
        parentNode.add(node);
        // mesh.children is already typed as THREE.Object3D[]
        parse(mesh.children as THREE.Object3D[], wrapNodeAsParent(node));
      }
      // Mesh
      else if (object3d.type === "Mesh") {
        if (!(object3d instanceof THREE.Mesh)) {
          // Not a mesh instance, skip
          continue;
        }
        const mesh = object3d;
        // experimental splatmaps
        if (props.exp_splatmap && !world.network.isServer) {
          setupSplatmap(mesh);
        }
        // wind effect
        // else if ((mesh.material as THREE.Material & { userData: { wind?: boolean } }).userData.wind) {
        //   addWind(mesh, world)
        // }
        const hasMorphTargets =
          (
            mesh as THREE.Mesh & {
              morphTargetDictionary?: unknown;
              morphTargetInfluences?: unknown[];
            }
          ).morphTargetDictionary ||
          ((mesh as THREE.Mesh & { morphTargetInfluences?: unknown[] })
            .morphTargetInfluences?.length ?? 0) > 0;
        const node = registerNode("mesh", {
          id: mesh.name,
          type: "geometry",
          geometry: mesh.geometry,
          material: mesh.material,
          linked: !hasMorphTargets,
          castShadow: props.castShadow,
          receiveShadow: props.receiveShadow,
          visible: props.visible, // DEPRECATED: use Node.active
          active: props.active,
          position: mesh.position.toArray() as [number, number, number],
          quaternion: [
            mesh.quaternion.x,
            mesh.quaternion.y,
            mesh.quaternion.z,
            mesh.quaternion.w,
          ] as [number, number, number, number],
          scale: mesh.scale.toArray() as [number, number, number],
        });
        if (parentNode.name === "lod" && props.maxDistance) {
          parentNode.insert(node, props.maxDistance);
        } else {
          parentNode.add(node);
        }
        // mesh.children is already typed as THREE.Object3D[]
        parse(mesh.children as THREE.Object3D[], wrapNodeAsParent(node));
      }
      // SkinnedMesh
      else if (object3d.type === "SkinnedMesh") {
        // ...
      }
      // Object3D / Group / Scene
      else if (groupTypes.includes(object3d.type)) {
        const node = registerNode("group", {
          id: object3d.name,
          position: object3d.position.toArray() as [number, number, number],
          quaternion: [
            object3d.quaternion.x,
            object3d.quaternion.y,
            object3d.quaternion.z,
            object3d.quaternion.w,
          ] as [number, number, number, number],
          scale: object3d.scale.toArray() as [number, number, number],
        });
        parentNode.add(node);
        // object3d.children is already typed as THREE.Object3D[]
        parse(object3d.children as THREE.Object3D[], wrapNodeAsParent(node));
      }
    }
  }
  const root = registerNode("group", {
    id: "$root",
  });
  // glb.scene.children is already typed as THREE.Object3D[]
  parse(glb.scene.children as THREE.Object3D[], wrapNodeAsParent(root));
  return root;
}

function setupSplatmap(mesh: THREE.Mesh) {
  /**
   * Splatmap shader for terrain texturing
   *
   * Future enhancements:
   * - vertex colors for terrain shading
   * - alpha channel for 4th texture layer
   *
   * Note: Blender GLTF export doesn't support complex triplanar splatmap shaders,
   * so textures are placed in material slots and reconstructed here.
   */
  interface MaterialWithTextures extends THREE.Material {
    map?: THREE.Texture;
    specularIntensityMap?: THREE.Texture;
    transmissionMap?: THREE.Texture;
    emissiveMap?: THREE.Texture;
    normalMap?: THREE.Texture;
  }

  const original = mesh.material as MaterialWithTextures;
  if (original.specularIntensityMap)
    original.specularIntensityMap.colorSpace = THREE.SRGBColorSpace;
  if (original.transmissionMap)
    original.transmissionMap.colorSpace = THREE.SRGBColorSpace;
  if (original.emissiveMap)
    original.emissiveMap.colorSpace = THREE.SRGBColorSpace;
  if (original.normalMap) original.normalMap.colorSpace = THREE.SRGBColorSpace;
  const uniforms = {
    splatTex: { value: original.map },
    rTex: { value: original.specularIntensityMap },
    gTex: { value: original.emissiveMap },
    bTex: { value: original.normalMap },
    aTex: { value: original.transmissionMap },
    rScale: { value: mesh.userData.red_scale || 1 },
    gScale: { value: mesh.userData.green_scale || 1 },
    bScale: { value: mesh.userData.blue_scale || 1 },
    aScale: { value: mesh.userData.alpha_scale || 1 },
  };
  // if (mesh.geometry.hasAttribute('_color')) {
  //   terrain.geometry.setAttribute('color', terrain.geometry.attributes._color)
  //   terrain.geometry.deleteAttribute('_color')
  //   hasVertexColors = true
  // }
  type CustomShaderMaterialOptions = {
    baseMaterial: typeof THREE.MeshStandardMaterial;
    roughness: number;
    metalness: number;
    uniforms: Record<string, { value: unknown }>;
    vertexShader: string;
    fragmentShader: string;
  };

  mesh.material = new (CustomShaderMaterial as unknown as new (
    opts: CustomShaderMaterialOptions,
  ) => THREE.Material)({
    baseMaterial: THREE.MeshStandardMaterial,
    roughness: 1,
    metalness: 0,
    // vertexColors: true,
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNorm;
      varying vec3 vPos;
      void main() {
        vUv = uv;
        vNorm = normalize(normal);
        vPos = position;
      }
    `,
    fragmentShader: `
      uniform sampler2D splatTex;
      uniform sampler2D rTex;
      uniform sampler2D gTex;
      uniform sampler2D bTex;
      uniform sampler2D aTex;
      uniform float rScale;
      uniform float gScale;
      uniform float bScale;
      uniform float aScale;
      varying vec2 vUv;
      varying vec3 vNorm;
      varying vec3 vPos;

      vec4 textureTriplanar(sampler2D tex, float scale, vec3 normal, vec3 position) {
          vec2 uv_x = position.yz * scale;
          vec2 uv_y = position.xz * scale;
          vec2 uv_z = position.xy * scale;
          vec4 xProjection = texture2D(tex, uv_x);
          vec4 yProjection = texture2D(tex, uv_y);
          vec4 zProjection = texture2D(tex, uv_z);
          vec3 weight = abs(normal);
          weight = pow(weight, vec3(4.0)); // bias towards the major axis
          weight = weight / (weight.x + weight.y + weight.z);
          return xProjection * weight.x + yProjection * weight.y + zProjection * weight.z;
      }

      vec3 tri(sampler2D t, float s) {
        return textureTriplanar(t, s, vNorm, vPos).rgb;
      }

      void main() {
          vec4 splat = texture2D(splatTex, vUv);
          vec4 result = vec4(0, 0, 0, 1.0);
          result += splat.r * textureTriplanar(rTex, rScale, vNorm, vPos);
          result += splat.g * textureTriplanar(gTex, gScale, vNorm, vPos);
          result += splat.b * textureTriplanar(bTex, bScale, vNorm, vPos);
          // result += splat.a * textureTriplanar(aTex, aScale, vNorm, vPos);
          // result += (1.0 - splat.a) * textureTriplanar(aTex, aScale, vNorm, vPos);
          // result *= vColor;
          csm_DiffuseColor *= result;
      }
    `,
  });
}
