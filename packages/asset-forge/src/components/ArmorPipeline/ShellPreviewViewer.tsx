import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { VRM } from "@pixiv/three-vrm";
import React, {
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";

import { retargetAnimation } from "../../services/retargeting/AnimationRetargeting";
import type {
  ShellMesh,
  BodyRegion,
  EquipmentSlotName,
} from "../../services/armor-pipeline/types";

/** Colors for each equipment slot region */
const SLOT_COLORS: Record<EquipmentSlotName, number> = {
  helmet: 0xff4444, // Red
  body: 0x4488ff, // Blue
  legs: 0x44ff44, // Green
  boots: 0xffaa44, // Orange
  gloves: 0xff44ff, // Purple
};

export interface ShellPreviewViewerRef {
  setAvatarScene: (vrmScene: THREE.Object3D) => void;
  /** Show a textured result — preserves original materials (no ghost replacement) */
  showTexturedResult: (scene: THREE.Object3D) => void;
  showRegions: (
    skinnedMesh: THREE.SkinnedMesh,
    regions: Map<EquipmentSlotName, BodyRegion>,
    processedGeometry?: THREE.BufferGeometry,
  ) => void;
  showShell: (shell: ShellMesh) => void;
  showShells: (shells: Map<string, ShellMesh>) => void;
  clearOverlays: () => void;
  clear: () => void;
  setWireframe: (enabled: boolean) => void;
  setOverlayOpacity: (opacity: number) => void;
  /** Show rigged armor on animated avatar (POC-3) — single piece (legacy) */
  showRiggedArmor: (
    riggedMesh: THREE.SkinnedMesh,
    vrmScene: THREE.Object3D,
    vrm: VRM,
  ) => void;
  /** Set up ghost avatar + animation mixer (call once, then add pieces) */
  setupAvatar: (vrmScene: THREE.Object3D, vrm: VRM) => void;
  /** Add a rigged armor piece to the scene (call after setupAvatar) */
  addArmorPiece: (key: string, mesh: THREE.SkinnedMesh) => void;
  /** Toggle visibility of an armor piece by key */
  setArmorPieceVisible: (key: string, visible: boolean) => void;
  /** Remove all armor pieces (keeps avatar) */
  clearArmorPieces: () => void;
  /** Add a rigid mesh parented to a specific VRM bone (for 3D attachments) */
  addBoneAttachment: (
    key: string,
    object: THREE.Object3D,
    boneName: string,
    offset?: THREE.Vector3,
    rotation?: THREE.Euler,
    scale?: number,
  ) => void;
  /** Update position/rotation/scale of a bone attachment */
  updateAttachmentTransform: (
    key: string,
    offset: THREE.Vector3,
    rotation: THREE.Euler,
    scale: number,
  ) => void;
  /** Remove a bone attachment */
  removeBoneAttachment: (key: string) => void;
  /** Remove all bone attachments */
  clearBoneAttachments: () => void;
  /** Load and play a Mixamo animation GLB, retargeted to the VRM */
  playAnimation: (animUrl: string) => Promise<void>;
  /** Stop all playing animations */
  stopAnimation: () => void;
}

interface ShellPreviewViewerProps {
  className?: string;
}

export const ShellPreviewViewer = forwardRef<
  ShellPreviewViewerRef,
  ShellPreviewViewerProps
>(({ className }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene>(new THREE.Scene());
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationIdRef = useRef<number>(0);

  const avatarGroupRef = useRef<THREE.Group>(new THREE.Group());
  const overlayGroupRef = useRef<THREE.Group>(new THREE.Group());
  const wireframeRef = useRef(false);
  const opacityRef = useRef(0.85);

  // Animation refs (POC-3)
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const vrmRef = useRef<VRM | null>(null);
  const rootToHipsRef = useRef<number>(1);
  const gltfLoaderRef = useRef<GLTFLoader>(new GLTFLoader());
  const vrmSceneRef = useRef<THREE.Object3D | null>(null);
  /** Armor pieces added to the VRM scene, keyed by slot (e.g. "body_plate") */
  const armorPiecesRef = useRef<Map<string, THREE.SkinnedMesh>>(new Map());
  /** Bone-parented attachments (rigid pieces attached to specific bones) */
  const boneAttachmentsRef = useRef<
    Map<string, { object: THREE.Object3D; boneName: string }>
  >(new Map());

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let mounted = true;

    const scene = sceneRef.current;
    scene.background = new THREE.Color(0x1a1a2e);

    // Use container dimensions (not canvas — canvas has no intrinsic layout size)
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 100);
    camera.position.set(0, 1.0, 2.5);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 0.8, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.update();
    controlsRef.current = controls;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(2, 3, 2);
    scene.add(dirLight);
    const backLight = new THREE.DirectionalLight(0x4488ff, 0.4);
    backLight.position.set(-2, 1, -2);
    scene.add(backLight);

    // Grid
    scene.add(new THREE.GridHelper(4, 20, 0x333355, 0x222244));

    // Groups
    avatarGroupRef.current.name = "__avatar_group";
    overlayGroupRef.current.name = "__overlay_group";
    scene.add(avatarGroupRef.current);
    scene.add(overlayGroupRef.current);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    // Render loop with animation support
    const clock = clockRef.current;
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      const delta = clock.getDelta();

      // Update animation mixer (drives keyframes)
      if (mixerRef.current) {
        mixerRef.current.update(delta);
      }

      // Update VRM normalized bones — REQUIRED for animation to propagate
      if (vrmRef.current) {
        vrmRef.current.update(delta);
      }

      controls.update();
      if (mounted && rendererRef.current) {
        rendererRef.current.render(scene, camera);
      }
    };
    animate();

    // Resize — watch the container div, not the canvas
    const handleResize = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw === 0 || ch === 0) return;
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      if (rendererRef.current) {
        rendererRef.current.setSize(cw, ch);
      }
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Capture ref values for cleanup (avoids stale ref.current in cleanup)
    const currentScene = sceneRef.current;
    const currentArmorPieces = armorPiecesRef.current;
    const currentBoneAttachments = boneAttachmentsRef.current;

    return () => {
      mounted = false;
      cancelAnimationFrame(animationIdRef.current);
      resizeObserver.disconnect();

      // Dispose OrbitControls
      controlsRef.current?.dispose();
      controlsRef.current = null;

      // Stop animation mixer
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }

      // Dispose all objects in the scene (geometries, materials, textures)
      currentScene?.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.SkinnedMesh) {
          obj.geometry?.dispose();
          const materials = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];
          for (const mat of materials) {
            if (!mat) continue;
            // Dispose any textures on the material
            for (const value of Object.values(mat)) {
              if (value instanceof THREE.Texture) {
                value.dispose();
              }
            }
            mat.dispose();
          }
        }
      });

      // Clear scene children
      if (currentScene) {
        currentScene.clear();
      }

      // Clear group refs (children already removed via scene.clear())
      avatarGroupRef.current = new THREE.Group();
      overlayGroupRef.current = new THREE.Group();

      // Clear other refs
      currentArmorPieces.clear();
      currentBoneAttachments.clear();
      vrmRef.current = null;
      vrmSceneRef.current = null;
      cameraRef.current = null;

      // Dispose renderer last (after scene traversal that may need GL state)
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, []);

  /** Remove all children from a group and dispose their geometry + materials.
   *  Use for overlays/shells we create ourselves (fresh materials, no shared textures). */
  const disposeGroup = useCallback((group: THREE.Group) => {
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      child.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.SkinnedMesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else if (obj.material) {
            obj.material.dispose();
          }
        }
      });
    }
  }, []);

  /** Remove all children from a group WITHOUT disposing their resources.
   *  Use for VRM scenes and loaded GLTFs whose textures/materials are managed
   *  by the loader — disposing them corrupts the renderer's internal texture
   *  reference counters (usedTimes) and causes crashes. */
  const detachGroup = useCallback((group: THREE.Group) => {
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
  }, []);

  /** Helper: frame camera on a scene object */
  const frameCamera = useCallback((target: THREE.Object3D) => {
    const box = new THREE.Box3().setFromObject(target);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    if (controlsRef.current) {
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    }
    if (cameraRef.current) {
      const maxDim = Math.max(size.x, size.y, size.z);
      const distance = maxDim * 1.8;
      cameraRef.current.position.set(
        center.x + distance * 0.5,
        center.y,
        center.z + distance,
      );
    }
  }, []);

  /** Internal: set up the ghost avatar + animation mixer */
  const doSetupAvatar = useCallback(
    (vrmScene: THREE.Object3D, vrm: VRM) => {
      // Detach previous VRM (don't dispose loader-managed textures)
      detachGroup(avatarGroupRef.current);
      disposeGroup(overlayGroupRef.current);
      armorPiecesRef.current.clear();

      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
      }

      vrmRef.current = vrm;
      vrmSceneRef.current = vrmScene;

      const humanoid = vrm.humanoid;
      const humanoidRec = humanoid as unknown as Record<
        string,
        Record<string, Record<string, number[]>>
      >;
      if (humanoid && humanoidRec.normalizedRestPose?.hips) {
        rootToHipsRef.current = humanoidRec.normalizedRestPose.hips.position[1];
      } else {
        const hipsNode = humanoid?.getNormalizedBoneNode("hips");
        if (hipsNode) {
          const v = new THREE.Vector3();
          hipsNode.getWorldPosition(v);
          rootToHipsRef.current = v.y;
        }
      }

      avatarGroupRef.current.add(vrmScene);
      // Keep original VRM materials — just ensure double-sided rendering
      vrmScene.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => {
              m.side = THREE.DoubleSide;
            });
          } else if (child.material) {
            child.material.side = THREE.DoubleSide;
          }
        }
      });

      mixerRef.current = new THREE.AnimationMixer(vrm.scene);
      clockRef.current = new THREE.Clock();

      frameCamera(vrmScene);
    },
    [detachGroup, disposeGroup, frameCamera],
  );

  /** Internal: add an armor piece to the VRM scene */
  const doAddArmorPiece = useCallback(
    (key: string, mesh: THREE.SkinnedMesh) => {
      const existing = armorPiecesRef.current.get(key);
      if (existing && vrmSceneRef.current) {
        vrmSceneRef.current.remove(existing);
        existing.geometry?.dispose();
        if (Array.isArray(existing.material)) {
          existing.material.forEach((m) => m.dispose());
        } else {
          existing.material?.dispose();
        }
      }

      mesh.name = `armor_${key}`;
      armorPiecesRef.current.set(key, mesh);

      if (vrmSceneRef.current) {
        vrmSceneRef.current.add(mesh);
      }
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      showTexturedResult(scene: THREE.Object3D) {
        // Detach VRM/loaded scenes (don't dispose their shared textures)
        detachGroup(avatarGroupRef.current);
        disposeGroup(overlayGroupRef.current);

        avatarGroupRef.current.add(scene);
        frameCamera(scene);
      },

      setAvatarScene(vrmScene: THREE.Object3D) {
        // Detach previous scene without disposing (textures are loader-managed)
        detachGroup(avatarGroupRef.current);

        avatarGroupRef.current.add(vrmScene);

        // Keep original VRM materials — just ensure double-sided rendering
        vrmScene.traverse((child) => {
          if (
            child instanceof THREE.Mesh ||
            child instanceof THREE.SkinnedMesh
          ) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => {
                m.side = THREE.DoubleSide;
              });
            } else if (child.material) {
              child.material.side = THREE.DoubleSide;
            }
          }
        });

        frameCamera(vrmScene);
      },

      showRegions(skinnedMesh, regions, processedGeometry) {
        disposeGroup(overlayGroupRef.current);
        // Use processedGeometry when available — region indices reference it
        // (marching triangles adds extra isoline vertices beyond the original mesh)
        const srcGeo = processedGeometry ?? skinnedMesh.geometry;
        const srcPos = srcGeo.attributes.position as THREE.BufferAttribute;
        const srcNorm = srcGeo.attributes.normal as THREE.BufferAttribute;
        const REGION_OFFSET = 0.002; // 2mm outward to prevent Z-fighting
        const COINCIDENT_PRECISION = 10000; // 0.1mm

        for (const [slotName, region] of regions) {
          if (region.triangleIndices.length === 0) continue;

          const usedVerts = new Set<number>();
          for (const idx of region.triangleIndices) usedVerts.add(idx);
          const sortedVerts = Array.from(usedVerts).sort((a, b) => a - b);

          const oldToNew = new Map<number, number>();
          sortedVerts.forEach((v, i) => oldToNew.set(v, i));

          // Copy body normals first
          const normals = new Float32Array(sortedVerts.length * 3);
          for (let i = 0; i < sortedVerts.length; i++) {
            const vi = sortedVerts[i];
            normals[i * 3] = srcNorm.getX(vi);
            normals[i * 3 + 1] = srcNorm.getY(vi);
            normals[i * 3 + 2] = srcNorm.getZ(vi);
          }

          // Find & average coincident vertex normals (fixes UV seam cracks)
          const posMap = new Map<string, number[]>();
          for (let i = 0; i < sortedVerts.length; i++) {
            const vi = sortedVerts[i];
            const x = Math.round(srcPos.getX(vi) * COINCIDENT_PRECISION);
            const y = Math.round(srcPos.getY(vi) * COINCIDENT_PRECISION);
            const z = Math.round(srcPos.getZ(vi) * COINCIDENT_PRECISION);
            const key = `${x},${y},${z}`;
            let group = posMap.get(key);
            if (!group) {
              group = [];
              posMap.set(key, group);
            }
            group.push(i);
          }
          for (const group of posMap.values()) {
            if (group.length < 2) continue;
            let ax = 0,
              ay = 0,
              az = 0;
            for (const vi of group) {
              ax += normals[vi * 3];
              ay += normals[vi * 3 + 1];
              az += normals[vi * 3 + 2];
            }
            const len = Math.sqrt(ax * ax + ay * ay + az * az);
            if (len < 1e-8) continue;
            ax /= len;
            ay /= len;
            az /= len;
            for (const vi of group) {
              normals[vi * 3] = ax;
              normals[vi * 3 + 1] = ay;
              normals[vi * 3 + 2] = az;
            }
          }

          // Apply positions with offset along averaged normals
          const positions = new Float32Array(sortedVerts.length * 3);
          for (let i = 0; i < sortedVerts.length; i++) {
            const vi = sortedVerts[i];
            positions[i * 3] = srcPos.getX(vi) + normals[i * 3] * REGION_OFFSET;
            positions[i * 3 + 1] =
              srcPos.getY(vi) + normals[i * 3 + 1] * REGION_OFFSET;
            positions[i * 3 + 2] =
              srcPos.getZ(vi) + normals[i * 3 + 2] * REGION_OFFSET;
          }

          // Snap coincident groups to average position
          for (const group of posMap.values()) {
            if (group.length < 2) continue;
            let cx = 0,
              cy = 0,
              cz = 0;
            for (const vi of group) {
              cx += positions[vi * 3];
              cy += positions[vi * 3 + 1];
              cz += positions[vi * 3 + 2];
            }
            cx /= group.length;
            cy /= group.length;
            cz /= group.length;
            for (const vi of group) {
              positions[vi * 3] = cx;
              positions[vi * 3 + 1] = cy;
              positions[vi * 3 + 2] = cz;
            }
          }

          const indices = new Uint32Array(region.triangleIndices.length);
          for (let i = 0; i < region.triangleIndices.length; i++) {
            indices[i] = oldToNew.get(region.triangleIndices[i])!;
          }

          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
          geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
          geo.setIndex(new THREE.BufferAttribute(indices, 1));

          const mat = new THREE.MeshStandardMaterial({
            color: SLOT_COLORS[slotName] ?? 0xffffff,
            transparent: true,
            opacity: opacityRef.current,
            side: THREE.DoubleSide,
            wireframe: wireframeRef.current,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
          });

          const mesh = new THREE.Mesh(geo, mat);
          mesh.name = `region_${slotName}`;
          overlayGroupRef.current.add(mesh);
        }
      },

      showShell(shell) {
        const mat = new THREE.MeshStandardMaterial({
          color: SLOT_COLORS[shell.slotName] ?? 0x4488ff,
          transparent: true,
          opacity: opacityRef.current,
          side: THREE.DoubleSide,
          wireframe: wireframeRef.current,
          metalness: 0.3,
          roughness: 0.5,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        });

        // Clone geometry to avoid disposing the original ShellMesh data
        const mesh = new THREE.Mesh(shell.geometry.clone(), mat);
        mesh.name = `shell_${shell.slotName}_${shell.bulkClass}`;
        overlayGroupRef.current.add(mesh);
      },

      showShells(shells) {
        disposeGroup(overlayGroupRef.current);
        for (const [_key, shell] of shells) {
          const mat = new THREE.MeshStandardMaterial({
            color: SLOT_COLORS[shell.slotName] ?? 0x4488ff,
            transparent: true,
            opacity: Math.max(0.1, opacityRef.current - 0.1),
            side: THREE.DoubleSide,
            wireframe: wireframeRef.current,
            metalness: 0.2,
            roughness: 0.6,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
          });
          // Clone geometry to avoid disposing the original ShellMesh data
          const mesh = new THREE.Mesh(shell.geometry.clone(), mat);
          mesh.name = `shell_${shell.slotName}_${shell.bulkClass}`;
          overlayGroupRef.current.add(mesh);
        }
      },

      clearOverlays() {
        disposeGroup(overlayGroupRef.current);
      },

      clear() {
        // Stop animation
        if (mixerRef.current) {
          mixerRef.current.stopAllAction();
          mixerRef.current = null;
        }
        // Clear bone attachments before removing VRM (bones go away with VRM)
        boneAttachmentsRef.current.clear();
        vrmRef.current = null;
        vrmSceneRef.current = null;
        armorPiecesRef.current.clear();

        // Detach loaded scenes (VRM/GLTF) — don't dispose their shared textures
        detachGroup(avatarGroupRef.current);
        // Overlays are ours to dispose (fresh materials, no shared textures)
        disposeGroup(overlayGroupRef.current);
      },

      setWireframe(enabled) {
        wireframeRef.current = enabled;
        overlayGroupRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            (child.material as THREE.MeshStandardMaterial).wireframe = enabled;
          }
        });
      },

      setOverlayOpacity(opacity) {
        opacityRef.current = opacity;
        overlayGroupRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            (child.material as THREE.MeshStandardMaterial).opacity = opacity;
          }
        });
      },

      // ── Bone Attachments (rigid meshes parented to bones) ──────────────

      addBoneAttachment(
        key: string,
        object: THREE.Object3D,
        boneName: string,
        offset?: THREE.Vector3,
        rotation?: THREE.Euler,
        scale?: number,
      ) {
        const vrm = vrmRef.current;
        if (!vrm) {
          console.warn(
            "[ShellPreviewViewer] Cannot add bone attachment — no VRM loaded. Call setupAvatar first.",
          );
          return;
        }

        // Remove existing attachment with same key
        const existing = boneAttachmentsRef.current.get(key);
        if (existing) {
          existing.object.parent?.remove(existing.object);
          existing.object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry?.dispose();
              if (Array.isArray(child.material))
                child.material.forEach((m) => m.dispose());
              else child.material?.dispose();
            }
          });
        }

        // Try to find the bone: first try raw bone (actual scene node),
        // then fall back to normalized bone node.
        // Raw bones work better for attachments because they're in world space.
        let bone: THREE.Object3D | null = null;

        // Search the VRM scene for a bone node matching the name
        const vrmScene = vrmSceneRef.current;
        if (vrmScene) {
          vrmScene.traverse((child) => {
            if (bone) return;
            const childName = child.name.toLowerCase();
            const target = boneName.toLowerCase();
            // Match common bone naming patterns:
            // "leftShoulder" → "leftshoulder", "Left_Shoulder", "J_Bip_L_Shoulder", etc.
            if (
              childName === target ||
              childName.includes(target) ||
              childName.replace(/[_\-\s]/g, "") === target
            ) {
              bone = child;
            }
          });
        }

        // Fallback to normalized bone node
        if (!bone) {
          bone =
            vrm.humanoid?.getNormalizedBoneNode(
              boneName as Parameters<
                typeof vrm.humanoid.getNormalizedBoneNode
              >[0],
            ) ?? null;
        }

        if (!bone) {
          console.warn(
            `[ShellPreviewViewer] Bone "${boneName}" not found in scene or VRM humanoid`,
          );
          return;
        }

        // Log bone world position for debugging
        const boneWorldPos = new THREE.Vector3();
        bone.getWorldPosition(boneWorldPos);
        console.log(
          `[ShellPreviewViewer] Attaching "${key}" to bone "${bone.name}" at world pos`,
          boneWorldPos.toArray().map((v) => v.toFixed(3)),
        );

        // Apply transform
        if (offset) object.position.copy(offset);
        if (rotation) object.rotation.copy(rotation);
        if (scale !== undefined) object.scale.setScalar(scale);

        // Ensure double-sided materials and visible rendering
        object.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => {
                m.side = THREE.DoubleSide;
                m.depthWrite = true;
                m.depthTest = true;
              });
            } else {
              child.material.side = THREE.DoubleSide;
              child.material.depthWrite = true;
              child.material.depthTest = true;
            }
          }
        });

        object.name = `attachment_${key}`;
        bone.add(object);
        boneAttachmentsRef.current.set(key, { object, boneName: bone.name });
      },

      updateAttachmentTransform(
        key: string,
        offset: THREE.Vector3,
        rotation: THREE.Euler,
        scale: number,
      ) {
        const entry = boneAttachmentsRef.current.get(key);
        if (!entry) return;
        entry.object.position.copy(offset);
        entry.object.rotation.copy(rotation);
        entry.object.scale.setScalar(scale);
      },

      removeBoneAttachment(key: string) {
        const entry = boneAttachmentsRef.current.get(key);
        if (!entry) return;

        entry.object.parent?.remove(entry.object);
        entry.object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            if (Array.isArray(child.material))
              child.material.forEach((m) => m.dispose());
            else child.material?.dispose();
          }
        });

        boneAttachmentsRef.current.delete(key);
      },

      clearBoneAttachments() {
        for (const [_key, entry] of boneAttachmentsRef.current) {
          entry.object.parent?.remove(entry.object);
          entry.object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry?.dispose();
              if (Array.isArray(child.material))
                child.material.forEach((m) => m.dispose());
              else child.material?.dispose();
            }
          });
        }
        boneAttachmentsRef.current.clear();
      },

      // ── POC-3: Animation methods ───────────────────────────────────────

      setupAvatar: doSetupAvatar,

      addArmorPiece: doAddArmorPiece,

      setArmorPieceVisible(key: string, visible: boolean) {
        const mesh = armorPiecesRef.current.get(key);
        if (mesh) {
          mesh.visible = visible;
        }
      },

      clearArmorPieces() {
        for (const [_key, mesh] of armorPiecesRef.current) {
          if (vrmSceneRef.current) {
            vrmSceneRef.current.remove(mesh);
          }
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        }
        armorPiecesRef.current.clear();
      },

      showRiggedArmor(
        riggedMesh: THREE.SkinnedMesh,
        vrmScene: THREE.Object3D,
        vrm: VRM,
      ) {
        doSetupAvatar(vrmScene, vrm);
        doAddArmorPiece("default", riggedMesh);
      },

      async playAnimation(animUrl: string) {
        const vrm = vrmRef.current;
        const mixer = mixerRef.current;
        if (!vrm || !mixer) {
          console.warn(
            "[ShellPreviewViewer] Cannot play animation — no VRM or mixer",
          );
          return;
        }

        // Load Mixamo animation GLB
        const gltf = await gltfLoaderRef.current.loadAsync(animUrl);

        if (!gltf.animations || gltf.animations.length === 0) {
          console.warn("[ShellPreviewViewer] No animations found in", animUrl);
          return;
        }

        // Retarget Mixamo animation to VRM skeleton
        const retargetedClip = retargetAnimation(
          gltf,
          vrm,
          rootToHipsRef.current,
        );
        if (!retargetedClip) {
          console.error(
            "[ShellPreviewViewer] Animation retargeting failed for",
            animUrl,
          );
          return;
        }

        // Stop any existing animation and play the new one
        mixer.stopAllAction();
        const action = mixer.clipAction(retargetedClip);
        action.reset().fadeIn(0.2).play();
      },

      stopAnimation() {
        if (mixerRef.current) {
          mixerRef.current.stopAllAction();
        }
      },
    }),
    [detachGroup, disposeGroup, doAddArmorPiece, doSetupAvatar, frameCamera],
  );

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full ${className ?? ""}`}
      style={{ minHeight: "400px" }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
});

ShellPreviewViewer.displayName = "ShellPreviewViewer";
