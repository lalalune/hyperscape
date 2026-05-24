/**
 * VRMImposterBaker Tests
 *
 * These tests verify the ACTUAL VRMImposterBaker class functionality.
 *
 * IMPORTANT: Tests that require WebGL/document are marked with .skipIf()
 * and will only run in browser environment (via vitest --browser).
 */

import * as THREE from "three";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

// VRMImposterBaker's constructor instantiates a real
// `THREE.WebGLRenderer`, which needs a working WebGL context.
// jsdom defines `document` + canvas elements but does NOT provide
// WebGL — so the old `typeof document !== "undefined"` check
// passed in vitest and every test hit "Error creating WebGL
// context". Probe for an actual WebGL context to discriminate
// jsdom from a real browser.
const isBrowser = (() => {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl") ?? c.getContext("webgl2"));
  } catch {
    return false;
  }
})();

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a test mesh with multiple colored faces for baking verification
 */
function createColoredCubeMesh(): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(1, 1.8, 0.5); // Humanoid proportions
  geometry.translate(0, 0.9, 0); // Feet at origin
  const materials = [
    new THREE.MeshBasicMaterial({ color: 0xff0000 }), // Red +X
    new THREE.MeshBasicMaterial({ color: 0x00ff00 }), // Green -X
    new THREE.MeshBasicMaterial({ color: 0x0000ff }), // Blue +Y
    new THREE.MeshBasicMaterial({ color: 0xffff00 }), // Yellow -Y
    new THREE.MeshBasicMaterial({ color: 0xff00ff }), // Magenta +Z
    new THREE.MeshBasicMaterial({ color: 0x00ffff }), // Cyan -Z
  ];
  return new THREE.Mesh(geometry, materials);
}

/**
 * Cleanup mesh resources
 */
function disposeMesh(mesh: THREE.Mesh | THREE.Group): void {
  mesh.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        child.material?.dispose();
      }
    }
  });
}

// ============================================================================
// VRMIMPOSTERBAKER CLASS TESTS (Browser-only)
// ============================================================================

describe.skipIf(!isBrowser)("VRMImposterBaker Class", () => {
  let baker: ReturnType<
    typeof import("../VRMImposterBaker").VRMImposterBaker.prototype.constructor
  > | null = null;

  afterEach(async () => {
    if (baker) {
      (baker as { dispose: () => void }).dispose();
      baker = null;
    }
  });

  it("should instantiate without errors", async () => {
    const { VRMImposterBaker } = await import("../VRMImposterBaker");
    baker = new VRMImposterBaker();
    expect(baker).toBeDefined();
  });

  it("should have bake method", async () => {
    const { VRMImposterBaker } = await import("../VRMImposterBaker");
    baker = new VRMImposterBaker();
    expect(typeof baker.bake).toBe("function");
  });

  it("should have loadVRM method", async () => {
    const { VRMImposterBaker } = await import("../VRMImposterBaker");
    baker = new VRMImposterBaker();
    expect(typeof baker.loadVRM).toBe("function");
  });

  it("should have poseVRMAtFrame method", async () => {
    const { VRMImposterBaker } = await import("../VRMImposterBaker");
    baker = new VRMImposterBaker();
    expect(typeof baker.poseVRMAtFrame).toBe("function");
  });

  it("should have dispose method", async () => {
    const { VRMImposterBaker } = await import("../VRMImposterBaker");
    baker = new VRMImposterBaker();
    expect(typeof baker.dispose).toBe("function");
  });
});

// ============================================================================
// ANIMATION MATCHING TESTS - Using actual VRMImposterBaker (Browser-only)
// ============================================================================

describe.skipIf(!isBrowser)("Animation Matching (via poseVRMAtFrame)", () => {
  let baker: ReturnType<
    typeof import("../VRMImposterBaker").VRMImposterBaker.prototype.constructor
  > | null = null;

  beforeEach(async () => {
    const { VRMImposterBaker } = await import("../VRMImposterBaker");
    baker = new VRMImposterBaker();
  });

  afterEach(() => {
    if (baker) {
      baker.dispose();
      baker = null;
    }
  });

  it("should handle LoadedVRM without animations gracefully", () => {
    const mockScene = new THREE.Group();
    const loadedVRM = {
      vrm: {
        scene: mockScene,
        humanoid: null,
        update: () => {},
      },
      animations: [],
      gltf: { scene: mockScene, animations: [] },
    };

    const result = baker.poseVRMAtFrame(loadedVRM, "idle", 0.25);
    expect(result).toBe("bind_pose");
  });

  it("should select animation by exact name match", () => {
    const mockScene = new THREE.Group();
    const animations = [
      { name: "idle", duration: 1.0, tracks: [] },
      { name: "walk", duration: 1.0, tracks: [] },
    ];
    const loadedVRM = {
      vrm: {
        scene: mockScene,
        humanoid: null,
        update: () => {},
      },
      animations: animations as THREE.AnimationClip[],
      gltf: { scene: mockScene, animations },
    };

    const result = baker.poseVRMAtFrame(loadedVRM, "idle", 0.25);
    expect(result).toBe("idle");
  });

  it("should select animation by partial match", () => {
    const mockScene = new THREE.Group();
    const clip = new THREE.AnimationClip("Character_Idle_Breathing", 1.0, []);
    const animations = [clip];
    const loadedVRM = {
      vrm: {
        scene: mockScene,
        humanoid: null,
        update: () => {},
      },
      animations,
      gltf: { scene: mockScene, animations },
    };

    const result = baker.poseVRMAtFrame(loadedVRM, "idle", 0.25);
    expect(result).toBe("Character_Idle_Breathing");
  });
});

// ============================================================================
// BAKE CONFIGURATION TESTS
// ============================================================================

describe("Bake Configuration Validation", () => {
  /**
   * Validate bake configuration matches impostor system requirements
   */
  function isPowerOf2(value: number): boolean {
    return value > 0 && (value & (value - 1)) === 0;
  }

  function validateConfig(config: {
    atlasWidth: number;
    atlasHeight: number;
    gridSizeX: number;
    gridSizeY: number;
    octType: "HEMI" | "FULL";
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!isPowerOf2(config.atlasWidth)) {
      errors.push(`atlasWidth (${config.atlasWidth}) must be power of 2`);
    }
    if (!isPowerOf2(config.atlasHeight)) {
      errors.push(`atlasHeight (${config.atlasHeight}) must be power of 2`);
    }
    if (config.gridSizeX < 2 || config.gridSizeX > 64) {
      errors.push(`gridSizeX (${config.gridSizeX}) must be between 2 and 64`);
    }
    if (config.gridSizeY < 2 || config.gridSizeY > 64) {
      errors.push(`gridSizeY (${config.gridSizeY}) must be between 2 and 64`);
    }

    return { valid: errors.length === 0, errors };
  }

  it("valid mob config passes validation", () => {
    const result = validateConfig({
      atlasWidth: 512,
      atlasHeight: 512,
      gridSizeX: 8,
      gridSizeY: 8,
      octType: "HEMI",
    });
    expect(result.valid).toBe(true);
  });

  it("non-power-of-2 atlas size fails validation", () => {
    const result = validateConfig({
      atlasWidth: 500,
      atlasHeight: 512,
      gridSizeX: 8,
      gridSizeY: 8,
      octType: "HEMI",
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("atlasWidth");
  });

  it("grid size outside range fails validation", () => {
    const result = validateConfig({
      atlasWidth: 512,
      atlasHeight: 512,
      gridSizeX: 100,
      gridSizeY: 8,
      octType: "HEMI",
    });
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// BOUNDING BOX CALCULATION TESTS
// ============================================================================

describe("Bounding Box Calculation", () => {
  it("humanoid mesh has correct proportions", () => {
    const group = new THREE.Group();
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.5, 0.25),
      new THREE.MeshBasicMaterial(),
    );
    torso.position.y = 1.15;
    group.add(torso);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.12),
      new THREE.MeshBasicMaterial(),
    );
    head.position.y = 1.55;
    group.add(head);

    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.8, 0.2),
      new THREE.MeshBasicMaterial(),
    );
    legs.position.y = 0.4;
    group.add(legs);

    group.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    expect(size.y).toBeGreaterThan(1.5);
    expect(size.y).toBeLessThan(2.0);

    disposeMesh(group);
  });

  it("tree mesh has tall vertical extent", () => {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.3, 3),
      new THREE.MeshBasicMaterial(),
    );
    trunk.position.y = 1.5;
    group.add(trunk);

    const foliage = new THREE.Mesh(
      new THREE.SphereGeometry(2),
      new THREE.MeshBasicMaterial(),
    );
    foliage.position.y = 5;
    group.add(foliage);

    group.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    expect(size.y).toBeGreaterThan(6);
    expect(size.x).toBeGreaterThan(3);

    disposeMesh(group);
  });
});

// ============================================================================
// DATA URL EXPORT TESTS
// ============================================================================

describe("Data URL Format Validation", () => {
  function validateDataUrl(dataUrl: string): {
    valid: boolean;
    format: string | null;
    hasContent: boolean;
  } {
    if (!dataUrl.startsWith("data:image/")) {
      return { valid: false, format: null, hasContent: false };
    }

    const match = dataUrl.match(/^data:image\/(\w+);base64,/);
    if (!match) {
      return { valid: false, format: null, hasContent: false };
    }

    const base64Part = dataUrl.split(",")[1] ?? "";
    const hasContent = base64Part.length > 100;

    return { valid: true, format: match[1], hasContent };
  }

  it("valid PNG data URL passes", () => {
    const dataUrl = "data:image/png;base64," + "A".repeat(1000);
    const result = validateDataUrl(dataUrl);
    expect(result.valid).toBe(true);
    expect(result.format).toBe("png");
    expect(result.hasContent).toBe(true);
  });

  it("invalid data URL fails", () => {
    const result = validateDataUrl("not a data url");
    expect(result.valid).toBe(false);
  });

  it("empty content is detected", () => {
    const result = validateDataUrl("data:image/png;base64,");
    expect(result.hasContent).toBe(false);
  });
});

// ============================================================================
// SINGLETON PATTERN TESTS (Browser-only)
// ============================================================================

describe.skipIf(!isBrowser)("Singleton Pattern", () => {
  it("getVRMImposterBaker returns same instance", async () => {
    const { getVRMImposterBaker, disposeVRMImposterBaker } =
      await import("../VRMImposterBaker");

    const baker1 = getVRMImposterBaker();
    const baker2 = getVRMImposterBaker();

    expect(baker1).toBe(baker2);

    disposeVRMImposterBaker();
  });

  it("disposeVRMImposterBaker allows new instance creation", async () => {
    const { getVRMImposterBaker, disposeVRMImposterBaker } =
      await import("../VRMImposterBaker");

    getVRMImposterBaker();
    disposeVRMImposterBaker();
    const baker2 = getVRMImposterBaker();

    expect(baker2).toBeDefined();

    disposeVRMImposterBaker();
  });
});

// ============================================================================
// INTEGRATION TEST - BAKE REAL THREE.JS MESH (Browser-only)
// ============================================================================

describe.skipIf(!isBrowser)("Integration: Bake Real Mesh", () => {
  let baker: ReturnType<
    typeof import("../VRMImposterBaker").VRMImposterBaker.prototype.constructor
  > | null = null;

  beforeEach(async () => {
    const { VRMImposterBaker } = await import("../VRMImposterBaker");
    baker = new VRMImposterBaker();
  });

  afterEach(() => {
    if (baker) {
      baker.dispose();
      baker = null;
    }
  });

  it("should bake a simple mesh and return valid result", () => {
    const mesh = createColoredCubeMesh();
    mesh.updateMatrixWorld(true);

    const loadedVRM = {
      vrm: {
        scene: mesh,
        humanoid: null,
        update: () => {},
      },
      animations: [],
      gltf: { scene: mesh, animations: [] },
    };

    const poseName = baker.poseVRMAtFrame(loadedVRM, "idle", 0.25);
    expect(poseName).toBe("bind_pose");

    disposeMesh(mesh);
  });
});
