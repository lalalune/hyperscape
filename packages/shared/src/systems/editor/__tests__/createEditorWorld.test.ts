/**
 * createEditorWorld Tests
 *
 * Comprehensive tests for the editor world factory including:
 * - World creation with default options
 * - Conditional system registration
 * - Camera position/target initialization
 * - EditorWorld class properties
 * - Integration between systems
 *
 * NOTE: These tests require a DOM environment (jsdom/happy-dom).
 * They are skipped when running in Bun's test runner without DOM support.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from "vitest";

// Skip tests if DOM is not available (Bun test runner without jsdom)
const hasDom = typeof document !== "undefined";
const describeWithDom = hasDom ? describe : describe.skip;
import * as THREE from "three";
import {
  createEditorWorld,
  initEditorWorld,
  EditorWorld,
  type EditorWorldOptions,
} from "../../../runtime/createEditorWorld";

const globalWithPointerEvent = globalThis as typeof globalThis & {
  PointerEvent?: typeof PointerEvent;
};

if (
  typeof globalWithPointerEvent.PointerEvent === "undefined" &&
  typeof MouseEvent !== "undefined"
) {
  globalWithPointerEvent.PointerEvent = MouseEvent as typeof PointerEvent;
}

describeWithDom("createEditorWorld", () => {
  // ============================================================================
  // BASIC CREATION TESTS
  // ============================================================================
  describe("basic creation", () => {
    it("should create an EditorWorld instance", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport });

      expect(world).toBeInstanceOf(EditorWorld);
      expect(world.isEditor).toBe(true);
    });

    it("should store viewport reference", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport });

      expect(world.editorViewport).toBe(viewport);
    });

    it("should store options", () => {
      const viewport = document.createElement("div");
      const options: EditorWorldOptions = {
        viewport,
        enableTerrain: true,
        enableGrass: false,
      };
      const world = createEditorWorld(options);

      expect(world.editorOptions).toBeDefined();
      expect(world.editorOptions?.enableGrass).toBe(false);
    });

    it("should set initial camera position from options", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({
        viewport,
        cameraPosition: { x: 200, y: 100, z: 200 },
      });

      expect(world.camera.position.x).toBe(200);
      expect(world.camera.position.y).toBe(100);
      expect(world.camera.position.z).toBe(200);
    });

    it("should use default camera position when not specified", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport });

      // Default is (100, 100, 100)
      expect(world.camera.position.x).toBe(100);
      expect(world.camera.position.y).toBe(100);
      expect(world.camera.position.z).toBe(100);
    });

    it("should store initial camera target for later application", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({
        viewport,
        cameraTarget: { x: 50, y: 0, z: 50 },
      });

      expect(world._initialCameraTarget).toBeDefined();
      expect(world._initialCameraTarget?.x).toBe(50);
      expect(world._initialCameraTarget?.z).toBe(50);
    });
  });

  // ============================================================================
  // SYSTEM REGISTRATION TESTS
  // ============================================================================
  describe("system registration", () => {
    it("should register core systems by default", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport });

      // Check core systems are registered
      expect(world.getSystem("settings")).toBeDefined();
      expect(world.getSystem("stage")).toBeDefined();
      expect(world.getSystem("graphics")).toBeDefined();
      expect(world.getSystem("environment")).toBeDefined();
      expect(world.getSystem("wind")).toBeDefined();
      expect(world.getSystem("lods")).toBeDefined();
    });

    it("should register editor systems", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport });

      expect(world.getSystem("editor-camera")).toBeDefined();
      expect(world.getSystem("editor-selection")).toBeDefined();
      expect(world.getSystem("editor-gizmo")).toBeDefined();
    });

    it("should register terrain when enableTerrain is true (default)", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport });

      expect(world.getSystem("terrain")).toBeDefined();
    });

    it("should not register terrain when enableTerrain is false", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport, enableTerrain: false });

      expect(world.getSystem("terrain")).toBeUndefined();
    });

    it("editor world no longer registers vegetation by default", () => {
      // Vegetation registration was migrated to @hyperforge/hyperscape
      // (see comments in createEditorWorld.ts lines 33-45). The
      // `enableVegetation` flag is preserved for callers that
      // manually register the system afterwards, but the editor
      // world itself ships without it.
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport });

      expect(world.getSystem("vegetation")).toBeUndefined();
    });

    it("should not register vegetation when enableVegetation is false", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport, enableVegetation: false });

      expect(world.getSystem("vegetation")).toBeUndefined();
    });

    it("editor world no longer registers grass by default", () => {
      // Migrated to @hyperforge/hyperscape per createEditorWorld.ts.
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport });

      expect(world.getSystem("grass")).toBeUndefined();
    });

    it("should not register grass when enableGrass is false", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport, enableGrass: false });

      expect(world.getSystem("grass")).toBeUndefined();
    });

    it("editor world no longer registers flowers by default", () => {
      // Migrated to @hyperforge/hyperscape per createEditorWorld.ts.
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport });

      expect(world.getSystem("flowers")).toBeUndefined();
    });

    it("should not register flowers when enableFlowers is false", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport, enableFlowers: false });

      expect(world.getSystem("flowers")).toBeUndefined();
    });

    it("editor world no longer registers towns / pois by default", () => {
      // Migrated to @hyperforge/hyperscape per createEditorWorld.ts.
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport });

      expect(world.getSystem("towns")).toBeUndefined();
      expect(world.getSystem("pois")).toBeUndefined();
    });

    it("should not register towns when enableTowns is false", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport, enableTowns: false });

      expect(world.getSystem("towns")).toBeUndefined();
      expect(world.getSystem("pois")).toBeUndefined();
    });

    it("editor world no longer registers roads by default", () => {
      // Migrated to @hyperforge/hyperscape per createEditorWorld.ts.
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport });

      expect(world.getSystem("roads")).toBeUndefined();
    });

    it("should not register roads when enableRoads is false", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport, enableRoads: false });

      expect(world.getSystem("roads")).toBeUndefined();
    });

    it("editor world no longer registers building-rendering by default", () => {
      // Migrated to @hyperforge/hyperscape per createEditorWorld.ts.
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport });

      expect(world.getSystem("building-rendering")).toBeUndefined();
    });

    it("should not register buildings when enableBuildings is false", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport, enableBuildings: false });

      expect(world.getSystem("building-rendering")).toBeUndefined();
    });

    it("should create minimal world with all optional systems disabled", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({
        viewport,
        enableTerrain: false,
        enableVegetation: false,
        enableGrass: false,
        enableFlowers: false,
        enableTowns: false,
        enableRoads: false,
        enableBuildings: false,
        enableWater: false,
      });

      // Core systems should still be present
      expect(world.getSystem("settings")).toBeDefined();
      expect(world.getSystem("stage")).toBeDefined();
      expect(world.getSystem("graphics")).toBeDefined();

      // Editor systems should still be present
      expect(world.getSystem("editor-camera")).toBeDefined();
      expect(world.getSystem("editor-selection")).toBeDefined();
      expect(world.getSystem("editor-gizmo")).toBeDefined();

      // Optional systems should be absent
      expect(world.getSystem("terrain")).toBeUndefined();
      expect(world.getSystem("vegetation")).toBeUndefined();
      expect(world.getSystem("grass")).toBeUndefined();
    });
  });

  // ============================================================================
  // EDITORWORLD CLASS TESTS
  // ============================================================================
  describe("EditorWorld class", () => {
    it("should have isEditor flag set to true", () => {
      const world = new EditorWorld();
      expect(world.isEditor).toBe(true);
    });

    it("should start with null editor system references", () => {
      const world = new EditorWorld();
      expect(world.editorCamera).toBeNull();
      expect(world.editorSelection).toBeNull();
      expect(world.editorGizmo).toBeNull();
    });

    it("should start with null editorViewport", () => {
      const world = new EditorWorld();
      expect(world.editorViewport).toBeNull();
    });

    it("should start with null editorOptions", () => {
      const world = new EditorWorld();
      expect(world.editorOptions).toBeNull();
    });

    it("should start with undefined _initialCameraTarget", () => {
      const world = new EditorWorld();
      expect(world._initialCameraTarget).toBeUndefined();
    });
  });

  // ============================================================================
  // OPTION DEFAULT TESTS
  // ============================================================================
  describe("option defaults", () => {
    it("should default enableTerrain to true", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport });
      expect(world.getSystem("terrain")).toBeDefined();
    });

    // These tests originally asserted that vegetation/grass/flowers/
    // towns/roads/buildings defaulted on. The systems were
    // migrated to @hyperforge/hyperscape per createEditorWorld.ts
    // comments (lines 33-45) — the flags are preserved on the
    // options interface for callers that opt in via manual
    // registration, but the editor world no longer ships them.
    // Updated assertions to .toBeUndefined() to pin the new
    // contract.

    it("vegetation system is no longer auto-registered (migrated to plugin)", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport });
      expect(world.getSystem("vegetation")).toBeUndefined();
    });

    it("grass system is no longer auto-registered (migrated to plugin)", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport });
      expect(world.getSystem("grass")).toBeUndefined();
    });

    it("flowers system is no longer auto-registered (migrated to plugin)", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport });
      expect(world.getSystem("flowers")).toBeUndefined();
    });

    it("towns system is no longer auto-registered (migrated to plugin)", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport });
      expect(world.getSystem("towns")).toBeUndefined();
    });

    it("roads system is no longer auto-registered (migrated to plugin)", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport });
      expect(world.getSystem("roads")).toBeUndefined();
    });

    it("building-rendering system is no longer auto-registered (migrated to plugin)", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport });
      expect(world.getSystem("building-rendering")).toBeUndefined();
    });

    it("should default enableWater to false", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({ viewport });
      // Water system would be under "water" key if enabled
      // Since default is false, it shouldn't be registered
      expect(world.getSystem("water")).toBeUndefined();
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================
  describe("edge cases", () => {
    it("should handle empty viewport gracefully", () => {
      const viewport = document.createElement("div");
      // Empty viewport (no size)
      expect(() => createEditorWorld({ viewport })).not.toThrow();
    });

    it("should handle camera position with negative values", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({
        viewport,
        cameraPosition: { x: -100, y: -50, z: -100 },
      });

      expect(world.camera.position.x).toBe(-100);
      expect(world.camera.position.y).toBe(-50);
      expect(world.camera.position.z).toBe(-100);
    });

    it("should handle zero camera position", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({
        viewport,
        cameraPosition: { x: 0, y: 0, z: 0 },
      });

      expect(world.camera.position.x).toBe(0);
      expect(world.camera.position.y).toBe(0);
      expect(world.camera.position.z).toBe(0);
    });

    it("should handle very large camera position", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({
        viewport,
        cameraPosition: { x: 10000, y: 5000, z: 10000 },
      });

      expect(world.camera.position.x).toBe(10000);
      expect(world.camera.position.y).toBe(5000);
      expect(world.camera.position.z).toBe(10000);
    });

    it("should handle partial camera target", () => {
      const viewport = document.createElement("div");
      const world = createEditorWorld({
        viewport,
        cameraTarget: { x: 100, y: 0, z: 100 },
      });

      expect(world._initialCameraTarget).toBeDefined();
      expect(world._initialCameraTarget?.y).toBe(0);
    });
  });

  // ============================================================================
  // MULTIPLE WORLDS
  // ============================================================================
  describe("multiple worlds", () => {
    it("should create independent world instances", () => {
      const viewport1 = document.createElement("div");
      const viewport2 = document.createElement("div");

      const world1 = createEditorWorld({
        viewport: viewport1,
        cameraPosition: { x: 100, y: 100, z: 100 },
      });
      const world2 = createEditorWorld({
        viewport: viewport2,
        cameraPosition: { x: 200, y: 200, z: 200 },
      });

      expect(world1.camera.position.x).toBe(100);
      expect(world2.camera.position.x).toBe(200);
      expect(world1).not.toBe(world2);
    });

    it("should have independent system registrations", () => {
      const viewport1 = document.createElement("div");
      const viewport2 = document.createElement("div");

      const world1 = createEditorWorld({
        viewport: viewport1,
        enableTerrain: true,
      });
      const world2 = createEditorWorld({
        viewport: viewport2,
        enableTerrain: false,
      });

      expect(world1.getSystem("terrain")).toBeDefined();
      expect(world2.getSystem("terrain")).toBeUndefined();
    });
  });
});

describeWithDom("initEditorWorld", () => {
  // Note: Full integration tests require WebGPU which isn't available in jsdom.
  // These tests mock World.init to test the initEditorWorld function logic.

  it("should be a function", () => {
    expect(typeof initEditorWorld).toBe("function");
  });

  it("should return a Promise", () => {
    const viewport = document.createElement("div");

    // Mock init to resolve immediately (avoids WebGPU requirement)
    const initSpy = vi
      .spyOn(EditorWorld.prototype, "init")
      .mockResolvedValue(undefined);
    const getSystemSpy = vi
      .spyOn(EditorWorld.prototype, "getSystem")
      .mockReturnValue(undefined);

    const result = initEditorWorld({ viewport });
    expect(result).toBeInstanceOf(Promise);

    // Clean up
    result.then((world) => world.destroy()).catch(() => {});
    initSpy.mockRestore();
    getSystemSpy.mockRestore();
  });

  it("should call world.init with merged options", async () => {
    const viewport = document.createElement("div");

    const initSpy = vi
      .spyOn(EditorWorld.prototype, "init")
      .mockResolvedValue(undefined);
    const getSystemSpy = vi
      .spyOn(EditorWorld.prototype, "getSystem")
      .mockReturnValue(undefined);

    const world = await initEditorWorld(
      { viewport, cameraPosition: { x: 50, y: 50, z: 50 } },
      { assetsUrl: "/custom-assets/" },
    );

    expect(initSpy).toHaveBeenCalled();
    const initCall = initSpy.mock.calls[0][0];
    expect(initCall.viewport).toBe(viewport);
    expect(initCall.assetsUrl).toBe("/custom-assets/");

    initSpy.mockRestore();
    getSystemSpy.mockRestore();
    world.destroy();
  });

  it("should query editor systems after init", async () => {
    const viewport = document.createElement("div");

    const initSpy = vi
      .spyOn(EditorWorld.prototype, "init")
      .mockResolvedValue(undefined);
    const getSystemSpy = vi
      .spyOn(EditorWorld.prototype, "getSystem")
      .mockReturnValue(undefined);

    const world = await initEditorWorld({ viewport });

    // Should have queried for editor systems
    expect(getSystemSpy).toHaveBeenCalledWith("editor-camera");
    expect(getSystemSpy).toHaveBeenCalledWith("editor-selection");
    expect(getSystemSpy).toHaveBeenCalledWith("editor-gizmo");

    initSpy.mockRestore();
    getSystemSpy.mockRestore();
    world.destroy();
  });

  it("should apply initial camera target if editorCamera available", async () => {
    const viewport = document.createElement("div");

    const mockCameraSystem = {
      setTarget: vi.fn(),
    };

    const initSpy = vi
      .spyOn(EditorWorld.prototype, "init")
      .mockResolvedValue(undefined);
    const getSystemSpy = vi
      .spyOn(EditorWorld.prototype, "getSystem")
      .mockImplementation((key: string) => {
        if (key === "editor-camera") return mockCameraSystem;
        return undefined;
      });

    const world = await initEditorWorld({
      viewport,
      cameraTarget: { x: 25, y: 10, z: 25 },
    });

    // setTarget should have been called with the target
    expect(mockCameraSystem.setTarget).toHaveBeenCalled();
    const targetArg = mockCameraSystem.setTarget.mock.calls[0][0];
    expect(targetArg.x).toBe(25);
    expect(targetArg.y).toBe(10);
    expect(targetArg.z).toBe(25);

    // Target should be cleared after application
    expect(world._initialCameraTarget).toBeUndefined();

    initSpy.mockRestore();
    getSystemSpy.mockRestore();
    world.destroy();
  });

  it("should use provided assetsUrl from initOptions", async () => {
    const viewport = document.createElement("div");

    const initSpy = vi
      .spyOn(EditorWorld.prototype, "init")
      .mockResolvedValue(undefined);
    const getSystemSpy = vi
      .spyOn(EditorWorld.prototype, "getSystem")
      .mockReturnValue(undefined);

    await initEditorWorld({ viewport }, { assetsUrl: "/test-assets/" });

    const initCall = initSpy.mock.calls[0][0];
    expect(initCall.assetsUrl).toBe("/test-assets/");

    initSpy.mockRestore();
    getSystemSpy.mockRestore();
  });

  it("should propagate errors from world.init", async () => {
    const viewport = document.createElement("div");

    const initSpy = vi
      .spyOn(EditorWorld.prototype, "init")
      .mockRejectedValue(new Error("Init failed"));

    await expect(initEditorWorld({ viewport })).rejects.toThrow("Init failed");

    initSpy.mockRestore();
  });

  it("should store editor system references on world object", async () => {
    const viewport = document.createElement("div");

    const mockCameraSystem = { isReady: true };
    const mockSelectionSystem = { isReady: true };
    const mockGizmoSystem = { isReady: true };

    const initSpy = vi
      .spyOn(EditorWorld.prototype, "init")
      .mockResolvedValue(undefined);
    const getSystemSpy = vi
      .spyOn(EditorWorld.prototype, "getSystem")
      .mockImplementation((key: string) => {
        if (key === "editor-camera") return mockCameraSystem;
        if (key === "editor-selection") return mockSelectionSystem;
        if (key === "editor-gizmo") return mockGizmoSystem;
        return undefined;
      });

    const world = await initEditorWorld({ viewport });

    expect(world.editorCamera).toBe(mockCameraSystem);
    expect(world.editorSelection).toBe(mockSelectionSystem);
    expect(world.editorGizmo).toBe(mockGizmoSystem);

    initSpy.mockRestore();
    getSystemSpy.mockRestore();
    world.destroy();
  });
});
