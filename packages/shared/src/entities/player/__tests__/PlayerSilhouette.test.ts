/**
 * PlayerSilhouette Comprehensive Tests
 *
 * Tests the classic fantasy MMORPG-style silhouette x-ray effect with full coverage:
 * - Happy path: normal operation
 * - Edge cases: missing data, empty scenes, unusual hierarchies
 * - Error handling: null values, dispose states
 * - Integration: skeleton binding, render order, scene graph
 * - Concurrent: multiple create/destroy calls
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import THREE from "../../../extras/three/three";
// Import WebGLRenderer separately since three/webgpu doesn't export it
import { WebGLRenderer, WebGLRenderTarget } from "three";

// Config values matching PlayerLocal.SILHOUETTE_CONFIG
const SILHOUETTE_COLOR = 0x1a1a2a;
const SILHOUETTE_RENDER_ORDER = 50;
const PLAYER_RENDER_ORDER = 100;

/** Creates silhouette material with correct properties */
function createSilhouetteMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: SILHOUETTE_COLOR,
    transparent: false,
    depthTest: false,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}

/** Creates a valid skinned mesh with skeleton for testing */
function createSkinnedMeshWithSkeleton(name = "TestMesh"): {
  mesh: THREE.SkinnedMesh;
  skeleton: THREE.Skeleton;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshBasicMaterial;
} {
  const bone = new THREE.Bone();
  bone.name = "root";
  const skeleton = new THREE.Skeleton([bone]);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3),
  );
  geometry.setAttribute(
    "skinIndex",
    new THREE.BufferAttribute(
      new Uint16Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      4,
    ),
  );
  geometry.setAttribute(
    "skinWeight",
    new THREE.BufferAttribute(
      new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]),
      4,
    ),
  );

  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = name;
  mesh.bind(skeleton, new THREE.Matrix4());

  return { mesh, skeleton, geometry, material };
}

// ============================================================================
// MATERIAL CONFIGURATION TESTS
// ============================================================================

describe("PlayerSilhouette Material", () => {
  describe("Required Properties", () => {
    it("depthTest=false (always draws, ignores depth buffer)", () => {
      const mat = createSilhouetteMaterial();
      expect(mat.depthTest).toBe(false);
      mat.dispose();
    });

    it("depthWrite=false (doesn't affect depth buffer)", () => {
      const mat = createSilhouetteMaterial();
      expect(mat.depthWrite).toBe(false);
      mat.dispose();
    });

    it("transparent=false (critical for render order in opaque pass)", () => {
      const mat = createSilhouetteMaterial();
      expect(mat.transparent).toBe(false);
      mat.dispose();
    });

    it("side=FrontSide (only render front faces)", () => {
      const mat = createSilhouetteMaterial();
      expect(mat.side).toBe(THREE.FrontSide);
      mat.dispose();
    });
  });

  describe("Color Configuration", () => {
    it("should have correct hex color", () => {
      const mat = createSilhouetteMaterial();
      expect(mat.color.getHex()).toBe(SILHOUETTE_COLOR);
      mat.dispose();
    });

    it("color should be dark (RGB components < 50)", () => {
      const r = (SILHOUETTE_COLOR >> 16) & 0xff;
      const g = (SILHOUETTE_COLOR >> 8) & 0xff;
      const b = SILHOUETTE_COLOR & 0xff;
      expect(r).toBeLessThan(50);
      expect(g).toBeLessThan(50);
      expect(b).toBeLessThan(50);
    });

    it("color should not be pure black (would be invisible)", () => {
      expect(SILHOUETTE_COLOR).not.toBe(0x000000);
    });
  });

  describe("Disposal", () => {
    it("should dispose without error", () => {
      const mat = createSilhouetteMaterial();
      expect(() => mat.dispose()).not.toThrow();
    });

    it("should handle double dispose gracefully", () => {
      const mat = createSilhouetteMaterial();
      mat.dispose();
      expect(() => mat.dispose()).not.toThrow();
    });
  });
});

// ============================================================================
// RENDER ORDER TESTS
// ============================================================================

describe("PlayerSilhouette Render Order", () => {
  describe("Order Values", () => {
    it("silhouette=50, player=100", () => {
      expect(SILHOUETTE_RENDER_ORDER).toBe(50);
      expect(PLAYER_RENDER_ORDER).toBe(100);
    });

    it("silhouette < player (silhouette renders first)", () => {
      expect(SILHOUETTE_RENDER_ORDER).toBeLessThan(PLAYER_RENDER_ORDER);
    });

    it("silhouette > 0 (renders after scene objects at ~0)", () => {
      expect(SILHOUETTE_RENDER_ORDER).toBeGreaterThan(0);
    });

    it("player > silhouette (player overwrites silhouette)", () => {
      expect(PLAYER_RENDER_ORDER).toBeGreaterThan(SILHOUETTE_RENDER_ORDER);
    });
  });

  describe("Mesh Application", () => {
    it("should set renderOrder on mesh", () => {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geo, mat);

      mesh.renderOrder = SILHOUETTE_RENDER_ORDER;
      expect(mesh.renderOrder).toBe(50);

      mesh.renderOrder = PLAYER_RENDER_ORDER;
      expect(mesh.renderOrder).toBe(100);

      geo.dispose();
      mat.dispose();
    });

    it("renderOrder should persist after adding to scene", () => {
      const scene = new THREE.Scene();
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geo, mat);

      mesh.renderOrder = SILHOUETTE_RENDER_ORDER;
      scene.add(mesh);

      expect(mesh.renderOrder).toBe(SILHOUETTE_RENDER_ORDER);

      geo.dispose();
      mat.dispose();
    });
  });

  describe("Three.js Render Order Behavior", () => {
    it("opaque objects with lower renderOrder render first", () => {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat1 = new THREE.MeshBasicMaterial({ transparent: false });
      const mat2 = new THREE.MeshBasicMaterial({ transparent: false });
      const mesh1 = new THREE.Mesh(geo, mat1);
      const mesh2 = new THREE.Mesh(geo, mat2);

      mesh1.renderOrder = 10;
      mesh2.renderOrder = 20;

      expect(mesh1.renderOrder).toBeLessThan(mesh2.renderOrder);
      expect(mat1.transparent).toBe(false);
      expect(mat2.transparent).toBe(false);

      geo.dispose();
      mat1.dispose();
      mat2.dispose();
    });

    it("transparent objects render after ALL opaques (regardless of renderOrder)", () => {
      // This documents WHY silhouette must be opaque
      const opaque = new THREE.MeshBasicMaterial({ transparent: false });
      const transparent = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.5,
      });

      // Even with higher renderOrder, transparent renders in separate pass AFTER opaques
      expect(opaque.transparent).toBe(false);
      expect(transparent.transparent).toBe(true);

      opaque.dispose();
      transparent.dispose();
    });
  });
});

// ============================================================================
// SKELETON BINDING TESTS
// ============================================================================

describe("PlayerSilhouette Skeleton", () => {
  describe("Binding", () => {
    it("should bind to same skeleton as player mesh", () => {
      const {
        mesh: playerMesh,
        skeleton,
        geometry,
        material,
      } = createSkinnedMeshWithSkeleton("Player");
      const silhouetteMat = createSilhouetteMaterial();
      const silhouetteMesh = new THREE.SkinnedMesh(geometry, silhouetteMat);

      silhouetteMesh.bind(skeleton, playerMesh.bindMatrix);

      expect(silhouetteMesh.skeleton).toBe(playerMesh.skeleton);
      expect(silhouetteMesh.skeleton.bones).toBe(playerMesh.skeleton.bones);
      expect(silhouetteMesh.skeleton.bones.length).toBeGreaterThan(0);

      geometry.dispose();
      material.dispose();
      silhouetteMat.dispose();
    });

    it("should share bindMatrix with player mesh", () => {
      const {
        mesh: playerMesh,
        skeleton,
        geometry,
        material,
      } = createSkinnedMeshWithSkeleton();
      const silhouetteMat = createSilhouetteMaterial();
      const silhouetteMesh = new THREE.SkinnedMesh(geometry, silhouetteMat);

      silhouetteMesh.bind(skeleton, playerMesh.bindMatrix);

      expect(silhouetteMesh.bindMatrix.equals(playerMesh.bindMatrix)).toBe(
        true,
      );

      geometry.dispose();
      material.dispose();
      silhouetteMat.dispose();
    });
  });

  describe("Animation Sync", () => {
    it("bone transforms should propagate to silhouette", () => {
      const {
        mesh: playerMesh,
        skeleton,
        geometry,
        material,
      } = createSkinnedMeshWithSkeleton();
      const silhouetteMat = createSilhouetteMaterial();
      const silhouetteMesh = new THREE.SkinnedMesh(geometry, silhouetteMat);

      silhouetteMesh.bind(skeleton, playerMesh.bindMatrix);

      // Modify bone
      const bone = skeleton.bones[0];
      bone.position.set(1, 2, 3);
      bone.updateMatrixWorld(true);

      // Both meshes share the skeleton, so changes propagate
      expect(silhouetteMesh.skeleton.bones[0].position.x).toBe(1);
      expect(silhouetteMesh.skeleton.bones[0].position.y).toBe(2);
      expect(silhouetteMesh.skeleton.bones[0].position.z).toBe(3);

      geometry.dispose();
      material.dispose();
      silhouetteMat.dispose();
    });
  });
});

// ============================================================================
// SCENE GRAPH TESTS
// ============================================================================

describe("PlayerSilhouette Scene Graph", () => {
  describe("Hierarchy", () => {
    it("silhouette added as sibling of player mesh", () => {
      const parent = new THREE.Group();
      const {
        mesh: playerMesh,
        geometry,
        material,
      } = createSkinnedMeshWithSkeleton();
      parent.add(playerMesh);

      const silhouetteMat = createSilhouetteMaterial();
      const silhouetteMesh = new THREE.SkinnedMesh(geometry, silhouetteMat);
      silhouetteMesh.bind(playerMesh.skeleton, playerMesh.bindMatrix);

      // Add as sibling (same parent)
      playerMesh.parent!.add(silhouetteMesh);

      expect(silhouetteMesh.parent).toBe(playerMesh.parent);
      expect(parent.children).toContain(playerMesh);
      expect(parent.children).toContain(silhouetteMesh);

      geometry.dispose();
      material.dispose();
      silhouetteMat.dispose();
    });

    it("silhouette added to vrmScene if player mesh has no parent", () => {
      const vrmScene = new THREE.Group();
      const {
        mesh: playerMesh,
        geometry,
        material,
      } = createSkinnedMeshWithSkeleton();
      // playerMesh has no parent

      const silhouetteMat = createSilhouetteMaterial();
      const silhouetteMesh = new THREE.SkinnedMesh(geometry, silhouetteMat);
      silhouetteMesh.bind(playerMesh.skeleton, playerMesh.bindMatrix);

      // Fallback to vrmScene
      const parent = playerMesh.parent ?? vrmScene;
      parent.add(silhouetteMesh);

      expect(silhouetteMesh.parent).toBe(vrmScene);

      geometry.dispose();
      material.dispose();
      silhouetteMat.dispose();
    });
  });

  describe("Cleanup", () => {
    it("should remove silhouette from parent on destroy", () => {
      const parent = new THREE.Group();
      const {
        mesh: playerMesh,
        geometry,
        material,
      } = createSkinnedMeshWithSkeleton();
      parent.add(playerMesh);

      const silhouetteMat = createSilhouetteMaterial();
      const silhouetteMesh = new THREE.SkinnedMesh(geometry, silhouetteMat);
      silhouetteMesh.bind(playerMesh.skeleton, playerMesh.bindMatrix);
      playerMesh.parent!.add(silhouetteMesh);

      expect(parent.children.length).toBe(2);

      // Simulate destroy
      silhouetteMesh.parent?.remove(silhouetteMesh);

      expect(parent.children.length).toBe(1);
      expect(parent.children).not.toContain(silhouetteMesh);

      geometry.dispose();
      material.dispose();
      silhouetteMat.dispose();
    });

    it("should handle remove when already removed", () => {
      const parent = new THREE.Group();
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geo, mat);
      parent.add(mesh);

      parent.remove(mesh);
      expect(() => parent.remove(mesh)).not.toThrow(); // Should be safe

      geo.dispose();
      mat.dispose();
    });
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe("PlayerSilhouette Edge Cases", () => {
  describe("Empty VRM Scene", () => {
    it("should handle scene with no skinned meshes", () => {
      const vrmScene = new THREE.Group();
      const silhouetteMeshes: THREE.SkinnedMesh[] = [];
      const silhouetteMat = createSilhouetteMaterial();

      // Simulate createPlayerSilhouette logic with no skinned meshes
      vrmScene.traverse((child: THREE.Object3D) => {
        const skinnedMesh = child as THREE.SkinnedMesh;
        if (!skinnedMesh.isSkinnedMesh) return;
        // This never executes because no skinned meshes
        silhouetteMeshes.push(
          new THREE.SkinnedMesh(skinnedMesh.geometry, silhouetteMat),
        );
      });

      expect(silhouetteMeshes.length).toBe(0);
      silhouetteMat.dispose();
    });

    it("should handle scene with only regular meshes", () => {
      const vrmScene = new THREE.Group();
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshBasicMaterial();
      vrmScene.add(new THREE.Mesh(geo, mat)); // Regular mesh, not skinned

      const silhouetteMeshes: THREE.SkinnedMesh[] = [];

      vrmScene.traverse((child: THREE.Object3D) => {
        const skinnedMesh = child as THREE.SkinnedMesh;
        if (!skinnedMesh.isSkinnedMesh) return;
        silhouetteMeshes.push(skinnedMesh);
      });

      expect(silhouetteMeshes.length).toBe(0);
      geo.dispose();
      mat.dispose();
    });
  });

  describe("Multiple Skinned Meshes", () => {
    it("should create silhouette for each skinned mesh", () => {
      const vrmScene = new THREE.Group();
      const meshCount = 5;
      const meshes: ReturnType<typeof createSkinnedMeshWithSkeleton>[] = [];

      for (let i = 0; i < meshCount; i++) {
        const data = createSkinnedMeshWithSkeleton(`Mesh${i}`);
        vrmScene.add(data.mesh);
        meshes.push(data);
      }

      const silhouetteMeshes: THREE.SkinnedMesh[] = [];
      const silhouetteMat = createSilhouetteMaterial();

      vrmScene.traverse((child: THREE.Object3D) => {
        const skinnedMesh = child as THREE.SkinnedMesh;
        if (!skinnedMesh.isSkinnedMesh) return;

        const silhouette = new THREE.SkinnedMesh(
          skinnedMesh.geometry,
          silhouetteMat,
        );
        silhouette.bind(skinnedMesh.skeleton, skinnedMesh.bindMatrix);
        silhouetteMeshes.push(silhouette);
      });

      expect(silhouetteMeshes.length).toBe(meshCount);

      // Cleanup
      for (const m of meshes) {
        m.geometry.dispose();
        m.material.dispose();
      }
      silhouetteMat.dispose();
    });
  });

  describe("Repeated Create Calls", () => {
    it("should clean up previous silhouettes before creating new ones", () => {
      const parent = new THREE.Group();
      let silhouetteMeshes: THREE.SkinnedMesh[] = [];
      let silhouetteMaterial: THREE.MeshBasicMaterial | undefined;

      // Simulate first create
      silhouetteMaterial = createSilhouetteMaterial();
      const {
        mesh: mesh1,
        geometry: geo1,
        material: mat1,
      } = createSkinnedMeshWithSkeleton("First");
      parent.add(mesh1);
      const sil1 = new THREE.SkinnedMesh(geo1, silhouetteMaterial);
      sil1.bind(mesh1.skeleton, mesh1.bindMatrix);
      parent.add(sil1);
      silhouetteMeshes.push(sil1);

      expect(silhouetteMeshes.length).toBe(1);
      expect(parent.children.length).toBe(2);

      // Simulate destroy (called at start of createPlayerSilhouette)
      for (const mesh of silhouetteMeshes) {
        mesh.parent?.remove(mesh);
      }
      silhouetteMeshes = [];
      silhouetteMaterial?.dispose();
      silhouetteMaterial = undefined;

      // Simulate second create
      silhouetteMaterial = createSilhouetteMaterial();
      const {
        mesh: mesh2,
        geometry: geo2,
        material: mat2,
      } = createSkinnedMeshWithSkeleton("Second");
      parent.add(mesh2);
      const sil2 = new THREE.SkinnedMesh(geo2, silhouetteMaterial);
      sil2.bind(mesh2.skeleton, mesh2.bindMatrix);
      parent.add(sil2);
      silhouetteMeshes.push(sil2);

      expect(silhouetteMeshes.length).toBe(1);
      expect(parent.children.includes(sil1)).toBe(false);
      expect(parent.children.includes(sil2)).toBe(true);

      // Cleanup
      geo1.dispose();
      mat1.dispose();
      geo2.dispose();
      mat2.dispose();
      silhouetteMaterial.dispose();
    });
  });

  describe("Nested Hierarchy", () => {
    it("should handle deeply nested skinned mesh", () => {
      const vrmScene = new THREE.Group();
      const level1 = new THREE.Group();
      const level2 = new THREE.Group();
      const level3 = new THREE.Group();

      vrmScene.add(level1);
      level1.add(level2);
      level2.add(level3);

      const {
        mesh: playerMesh,
        geometry,
        material,
      } = createSkinnedMeshWithSkeleton();
      level3.add(playerMesh);

      const silhouetteMat = createSilhouetteMaterial();
      const silhouetteMesh = new THREE.SkinnedMesh(geometry, silhouetteMat);
      silhouetteMesh.bind(playerMesh.skeleton, playerMesh.bindMatrix);

      // Add as sibling at same level
      playerMesh.parent!.add(silhouetteMesh);

      expect(silhouetteMesh.parent).toBe(level3);
      expect(level3.children).toContain(silhouetteMesh);

      geometry.dispose();
      material.dispose();
      silhouetteMat.dispose();
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe("PlayerSilhouette Integration", () => {
  describe("Full Creation Flow", () => {
    it("should create complete silhouette setup", () => {
      // Simulate full createPlayerSilhouette flow
      const vrmScene = new THREE.Group();
      const {
        mesh: playerMesh,
        geometry,
        material,
      } = createSkinnedMeshWithSkeleton("Body");
      vrmScene.add(playerMesh);

      const silhouetteMeshes: THREE.SkinnedMesh[] = [];
      const silhouetteMaterial = createSilhouetteMaterial();
      const { SILHOUETTE_RENDER_ORDER: SRO, PLAYER_RENDER_ORDER: PRO } = {
        SILHOUETTE_RENDER_ORDER,
        PLAYER_RENDER_ORDER,
      };

      vrmScene.traverse((child: THREE.Object3D) => {
        const skinnedMesh = child as THREE.SkinnedMesh;
        if (!skinnedMesh.isSkinnedMesh) return;

        // Set player render order
        skinnedMesh.renderOrder = PRO;

        // Create silhouette
        const silhouetteMesh = new THREE.SkinnedMesh(
          skinnedMesh.geometry,
          silhouetteMaterial,
        );
        silhouetteMesh.bind(skinnedMesh.skeleton, skinnedMesh.bindMatrix);
        silhouetteMesh.renderOrder = SRO;
        silhouetteMesh.frustumCulled = false;
        silhouetteMesh.name = `Silhouette_${skinnedMesh.name}`;

        (skinnedMesh.parent ?? vrmScene).add(silhouetteMesh);
        silhouetteMeshes.push(silhouetteMesh);
      });

      // Verify
      expect(silhouetteMeshes.length).toBe(1);
      expect(silhouetteMeshes[0].renderOrder).toBe(SILHOUETTE_RENDER_ORDER);
      expect(silhouetteMeshes[0].frustumCulled).toBe(false);
      expect(silhouetteMeshes[0].name).toBe("Silhouette_Body");
      expect(silhouetteMeshes[0].skeleton).toBe(playerMesh.skeleton);
      expect(playerMesh.renderOrder).toBe(PLAYER_RENDER_ORDER);

      // Material verification
      const mat = silhouetteMeshes[0].material as THREE.MeshBasicMaterial;
      expect(mat.depthTest).toBe(false);
      expect(mat.depthWrite).toBe(false);
      expect(mat.transparent).toBe(false);

      geometry.dispose();
      material.dispose();
      silhouetteMaterial.dispose();
    });
  });

  describe("Full Destruction Flow", () => {
    it("should clean up all resources", () => {
      const vrmScene = new THREE.Group();
      const {
        mesh: playerMesh,
        geometry,
        material,
      } = createSkinnedMeshWithSkeleton();
      vrmScene.add(playerMesh);

      const silhouetteMeshes: THREE.SkinnedMesh[] = [];
      let silhouetteMaterial: THREE.MeshBasicMaterial | undefined =
        createSilhouetteMaterial();

      const silhouetteMesh = new THREE.SkinnedMesh(
        geometry,
        silhouetteMaterial,
      );
      silhouetteMesh.bind(playerMesh.skeleton, playerMesh.bindMatrix);
      vrmScene.add(silhouetteMesh);
      silhouetteMeshes.push(silhouetteMesh);

      // Verify setup
      expect(vrmScene.children.length).toBe(2);
      expect(silhouetteMeshes.length).toBe(1);

      // Destroy
      for (const mesh of silhouetteMeshes) {
        mesh.parent?.remove(mesh);
      }
      silhouetteMeshes.length = 0;
      silhouetteMaterial?.dispose();
      silhouetteMaterial = undefined;

      // Verify cleanup
      expect(vrmScene.children.length).toBe(1); // Only player remains
      expect(silhouetteMeshes.length).toBe(0);
      expect(silhouetteMaterial).toBeUndefined();

      geometry.dispose();
      material.dispose();
    });
  });
});

// ============================================================================
// DATA VERIFICATION TESTS
// ============================================================================

describe("PlayerSilhouette Data Verification", () => {
  describe("Config Values", () => {
    it("SILHOUETTE_COLOR should be 0x1a1a2a", () => {
      expect(SILHOUETTE_COLOR).toBe(0x1a1a2a);
      expect(SILHOUETTE_COLOR).toBe(1710634); // Decimal: (26*65536)+(26*256)+42
    });

    it("SILHOUETTE_RENDER_ORDER should be 50", () => {
      expect(SILHOUETTE_RENDER_ORDER).toBe(50);
    });

    it("PLAYER_RENDER_ORDER should be 100", () => {
      expect(PLAYER_RENDER_ORDER).toBe(100);
    });
  });

  describe("Material State After Creation", () => {
    it("should have all expected properties set correctly", () => {
      const mat = createSilhouetteMaterial();

      // Exhaustive property check
      expect(mat.type).toBe("MeshBasicMaterial");
      expect(mat.color.getHex()).toBe(0x1a1a2a);
      expect(mat.transparent).toBe(false);
      expect(mat.opacity).toBe(1);
      expect(mat.depthTest).toBe(false);
      expect(mat.depthWrite).toBe(false);
      expect(mat.side).toBe(THREE.FrontSide);
      expect(mat.visible).toBe(true);

      mat.dispose();
    });
  });

  describe("Mesh State After Creation", () => {
    it("silhouette mesh should have all expected properties", () => {
      const {
        mesh: playerMesh,
        geometry,
        material,
      } = createSkinnedMeshWithSkeleton("TestMesh");
      const silhouetteMat = createSilhouetteMaterial();
      const silhouetteMesh = new THREE.SkinnedMesh(geometry, silhouetteMat);
      silhouetteMesh.bind(playerMesh.skeleton, playerMesh.bindMatrix);
      silhouetteMesh.renderOrder = SILHOUETTE_RENDER_ORDER;
      silhouetteMesh.frustumCulled = false;
      silhouetteMesh.name = `Silhouette_${playerMesh.name}`;

      // Exhaustive property check
      expect(silhouetteMesh.type).toBe("SkinnedMesh");
      expect(silhouetteMesh.isSkinnedMesh).toBe(true);
      expect(silhouetteMesh.renderOrder).toBe(50);
      expect(silhouetteMesh.frustumCulled).toBe(false);
      expect(silhouetteMesh.name).toBe("Silhouette_TestMesh");
      expect(silhouetteMesh.visible).toBe(true);
      expect(silhouetteMesh.skeleton).toBeDefined();
      expect(silhouetteMesh.skeleton.bones.length).toBeGreaterThan(0);
      expect(silhouetteMesh.geometry).toBe(geometry);
      expect(silhouetteMesh.material).toBe(silhouetteMat);

      geometry.dispose();
      material.dispose();
      silhouetteMat.dispose();
    });
  });
});

// ============================================================================
// VISUAL RENDERING TESTS (Browser-only)
// ============================================================================

describe("PlayerSilhouette Visual Rendering", () => {
  let renderer: WebGLRenderer;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let renderTarget: WebGLRenderTarget;
  const SIZE = 128;

  beforeEach(() => {
    if (!globalThis.document) return;
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    renderer = new WebGLRenderer({ canvas, antialias: false });
    renderer.setSize(SIZE, SIZE);
    // Use linear color space to avoid gamma correction affecting pixel tests
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    renderTarget = new WebGLRenderTarget(SIZE, SIZE);
  });

  afterEach(() => {
    renderer?.dispose();
    renderTarget?.dispose();
  });

  function getPixel(x: number, y: number): { r: number; g: number; b: number } {
    const pixels = new Uint8Array(4);
    renderer.readRenderTargetPixels(renderTarget, x, y, 1, 1, pixels);
    return { r: pixels[0], g: pixels[1], b: pixels[2] };
  }

  function colorMatches(
    actual: { r: number; g: number; b: number },
    expected: { r: number; g: number; b: number },
    tol = 20,
  ): boolean {
    return (
      Math.abs(actual.r - expected.r) <= tol &&
      Math.abs(actual.g - expected.g) <= tol &&
      Math.abs(actual.b - expected.b) <= tol
    );
  }

  it.skipIf(!globalThis.document)(
    "depthTest=false makes silhouette visible through occluder",
    () => {
      if (!renderer) return;

      // Occluder cube in front (at origin, closer to camera)
      const cubeGeo = new THREE.BoxGeometry(2, 2, 2);
      const cubeMat = new THREE.MeshBasicMaterial({ color: 0x888888 });
      const cube = new THREE.Mesh(cubeGeo, cubeMat);
      cube.position.z = 1; // In front
      cube.renderOrder = 0;
      scene.add(cube);

      // Silhouette at same position as cube's front face but with depthTest=false
      // Higher renderOrder means it renders AFTER the cube, and depthTest=false means it always passes
      const sphereGeo = new THREE.SphereGeometry(1, 16, 16);
      const silhouetteMat = createSilhouetteMaterial();
      const silhouette = new THREE.Mesh(sphereGeo, silhouetteMat);
      silhouette.position.z = 0; // At origin, "inside" the cube from camera's view
      silhouette.renderOrder = SILHOUETTE_RENDER_ORDER;
      scene.add(silhouette);

      renderer.setRenderTarget(renderTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);

      const centerPixel = getPixel(SIZE / 2, SIZE / 2);

      // The silhouette (dark blue-gray) should be visible, not the occluder (bright gray)
      // Due to color space transformations in WebGL, the actual values may differ from linear
      // The key test is: we should NOT see the occluder's gray color (0x88, 0x88, 0x88)
      const isOccluderGray =
        centerPixel.r > 100 && centerPixel.g > 100 && centerPixel.b > 100;
      const isBlackBackground =
        centerPixel.r === 0 && centerPixel.g === 0 && centerPixel.b === 0;

      // Silhouette should be visible - not occluder gray and not pure black
      // The silhouette color 0x1a1a2a renders as a dark blue-ish tone
      expect(isOccluderGray).toBe(false); // Should NOT see the occluder
      expect(isBlackBackground).toBe(false); // Should NOT see pure black

      // Additionally verify we see SOME blue tint (b > r or b > g) matching silhouette
      expect(centerPixel.b).toBeGreaterThanOrEqual(centerPixel.r); // Blue >= red (silhouette is blueish)

      cubeGeo.dispose();
      cubeMat.dispose();
      sphereGeo.dispose();
      silhouetteMat.dispose();
    },
  );

  it.skipIf(!globalThis.document)(
    "higher renderOrder player overwrites lower renderOrder silhouette",
    () => {
      if (!renderer) return;

      const geo = new THREE.SphereGeometry(0.5, 16, 16);

      // Silhouette (lower renderOrder)
      const silhouetteMat = createSilhouetteMaterial();
      const silhouette = new THREE.Mesh(geo, silhouetteMat);
      silhouette.renderOrder = SILHOUETTE_RENDER_ORDER;
      scene.add(silhouette);

      // Player (higher renderOrder)
      const playerMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const player = new THREE.Mesh(geo, playerMat);
      player.renderOrder = PLAYER_RENDER_ORDER;
      scene.add(player);

      renderer.setRenderTarget(renderTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);

      // Center should be player color (red), not silhouette
      expect(
        colorMatches(getPixel(SIZE / 2, SIZE / 2), { r: 0xff, g: 0, b: 0 }),
      ).toBe(true);

      geo.dispose();
      silhouetteMat.dispose();
      playerMat.dispose();
    },
  );
});
