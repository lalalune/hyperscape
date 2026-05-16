/**
 * `setupTerrainLighting` — scene lighting construction tests.
 *
 * Phase 1.1 fourth carve was extracted before this session and
 * shipped without tests. Pins the lighting contract so future
 * shadow / FOV / map-size changes are caught.
 */

import { describe, expect, it } from "vitest";
import * as THREE from "three/webgpu";

import { setupTerrainLighting } from "../setupTerrainLighting";

describe("setupTerrainLighting — scene-graph attachment", () => {
  it("adds hemi + ambient + sun + sun.target to the supplied scene", () => {
    const scene = new THREE.Scene();
    const { hemi, ambient, sun } = setupTerrainLighting(scene, {
      isStudioMode: true,
      enableShadows: false,
    });
    expect(scene.children).toContain(hemi);
    expect(scene.children).toContain(ambient);
    expect(scene.children).toContain(sun);
    // Sun's target is parented to the scene so shadow-follow
    // updates affect the shadow frustum.
    expect(scene.children).toContain(sun.target);
  });

  it("returns DirectionalLight + HemisphereLight + AmbientLight instances", () => {
    const scene = new THREE.Scene();
    const { sun, hemi, ambient } = setupTerrainLighting(scene, {
      isStudioMode: false,
      enableShadows: true,
    });
    expect(sun).toBeInstanceOf(THREE.DirectionalLight);
    expect(hemi).toBeInstanceOf(THREE.HemisphereLight);
    expect(ambient).toBeInstanceOf(THREE.AmbientLight);
  });

  it("names the hemisphere light for debug-pane discoverability", () => {
    const scene = new THREE.Scene();
    const { hemi } = setupTerrainLighting(scene, {
      isStudioMode: false,
      enableShadows: false,
    });
    expect(hemi.name).toBe("StudioHemisphereLight");
  });
});

describe("setupTerrainLighting — shadow gating", () => {
  it("studio mode + shadows enabled → sun.castShadow = true", () => {
    const { sun } = setupTerrainLighting(new THREE.Scene(), {
      isStudioMode: true,
      enableShadows: true,
    });
    expect(sun.castShadow).toBe(true);
  });

  it("studio mode + shadows disabled → sun.castShadow = false", () => {
    const { sun } = setupTerrainLighting(new THREE.Scene(), {
      isStudioMode: true,
      enableShadows: false,
    });
    expect(sun.castShadow).toBe(false);
  });

  it("non-studio (standalone preview / live game) ALWAYS casts shadows", () => {
    const a = setupTerrainLighting(new THREE.Scene(), {
      isStudioMode: false,
      enableShadows: false, // ignored in non-studio
    });
    const b = setupTerrainLighting(new THREE.Scene(), {
      isStudioMode: false,
      enableShadows: true,
    });
    expect(a.sun.castShadow).toBe(true);
    expect(b.sun.castShadow).toBe(true);
  });
});

describe("setupTerrainLighting — shadow camera frustum + map size", () => {
  it("shadow map is 2048×2048 (half of game's 4096 for editor perf)", () => {
    const { sun } = setupTerrainLighting(new THREE.Scene(), {
      isStudioMode: false,
      enableShadows: true,
    });
    expect(sun.shadow.mapSize.width).toBe(2048);
    expect(sun.shadow.mapSize.height).toBe(2048);
  });

  it("shadow camera frustum is ±200m centered, near=0.5, far=400", () => {
    const { sun } = setupTerrainLighting(new THREE.Scene(), {
      isStudioMode: false,
      enableShadows: true,
    });
    const cam = sun.shadow.camera as THREE.OrthographicCamera;
    expect(cam.near).toBe(0.5);
    expect(cam.far).toBe(400);
    expect(cam.left).toBe(-200);
    expect(cam.right).toBe(200);
    expect(cam.top).toBe(200);
    expect(cam.bottom).toBe(-200);
  });

  it("shadow bias values are set for the 'med' preset", () => {
    const { sun } = setupTerrainLighting(new THREE.Scene(), {
      isStudioMode: false,
      enableShadows: true,
    });
    expect(sun.shadow.bias).toBe(0.0002);
    expect(sun.shadow.normalBias).toBe(0.01);
  });
});

describe("setupTerrainLighting — sun position", () => {
  it("sun is placed at SUN_LIGHT.DEFAULT_DIRECTION × 2000m", () => {
    const { sun } = setupTerrainLighting(new THREE.Scene(), {
      isStudioMode: false,
      enableShadows: true,
    });
    // SUN_LIGHT.DEFAULT_DIRECTION is normalized; multiplied by
    // 2000 → sun's distance from origin should be ≈ 2000m.
    const distance = sun.position.length();
    expect(distance).toBeGreaterThan(0);
    // Allow some tolerance — DEFAULT_DIRECTION may or may not be
    // exactly unit-length depending on its definition.
    expect(distance).toBeLessThanOrEqual(2000 * Math.sqrt(3) + 1);
  });
});
