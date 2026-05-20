/**
 * setupStudioWorldWater — studio-mode water plane construction tests.
 *
 * Phase 1.1 carve. Pins the world-water geometry sizing, plane
 * orientation, position, container attachment, and uniforms/
 * textures bundle the caller stores for animation + disposal.
 */

import { describe, expect, it } from "vitest";
import * as THREE from "three/webgpu";

import { setupStudioWorldWater } from "../setupStudioWorldWater";

describe("setupStudioWorldWater — scene-graph attachment", () => {
  it("adds the mesh to the supplied container", () => {
    const container = new THREE.Group();
    const { mesh } = setupStudioWorldWater(container, {
      worldSize: 50,
      tileSize: 100,
      waterThreshold: 5.4,
    });
    expect(container.children).toContain(mesh);
  });

  it("returns a Mesh with a PlaneGeometry", () => {
    const container = new THREE.Group();
    const { mesh } = setupStudioWorldWater(container, {
      worldSize: 50,
      tileSize: 100,
      waterThreshold: 5.4,
    });
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.PlaneGeometry);
  });
});

describe("setupStudioWorldWater — geometry shape", () => {
  it("sizes the plane to worldSize × tileSize meters on each axis", () => {
    const container = new THREE.Group();
    const { mesh } = setupStudioWorldWater(container, {
      worldSize: 50,
      tileSize: 100,
      waterThreshold: 0,
    });
    const geom = mesh.geometry as THREE.PlaneGeometry;
    expect(geom.parameters.width).toBe(5000);
    expect(geom.parameters.height).toBe(5000);
  });

  it("uses 128×128 subdivisions for wave detail", () => {
    const container = new THREE.Group();
    const { mesh } = setupStudioWorldWater(container, {
      worldSize: 10,
      tileSize: 100,
      waterThreshold: 0,
    });
    const geom = mesh.geometry as THREE.PlaneGeometry;
    expect(geom.parameters.widthSegments).toBe(128);
    expect(geom.parameters.heightSegments).toBe(128);
  });

  it("scales geometry to a smaller world correctly", () => {
    const container = new THREE.Group();
    const { mesh } = setupStudioWorldWater(container, {
      worldSize: 10,
      tileSize: 100,
      waterThreshold: 0,
    });
    const geom = mesh.geometry as THREE.PlaneGeometry;
    expect(geom.parameters.width).toBe(1000);
    expect(geom.parameters.height).toBe(1000);
  });
});

describe("setupStudioWorldWater — positioning", () => {
  it("centers the plane horizontally at (worldSize*tileSize)/2 on x and z", () => {
    const container = new THREE.Group();
    const { mesh } = setupStudioWorldWater(container, {
      worldSize: 50,
      tileSize: 100,
      waterThreshold: 5.4,
    });
    expect(mesh.position.x).toBe(2500);
    expect(mesh.position.z).toBe(2500);
  });

  it("places y at the waterThreshold", () => {
    const container = new THREE.Group();
    const { mesh } = setupStudioWorldWater(container, {
      worldSize: 50,
      tileSize: 100,
      waterThreshold: 7.2,
    });
    expect(mesh.position.y).toBe(7.2);
  });
});

describe("setupStudioWorldWater — returned bundle", () => {
  it("returns uniforms + textures alongside the mesh", () => {
    const container = new THREE.Group();
    const result = setupStudioWorldWater(container, {
      worldSize: 10,
      tileSize: 100,
      waterThreshold: 0,
    });
    expect(result.uniforms).toBeDefined();
    expect(result.textures).toBeDefined();
    expect(result.mesh).toBeDefined();
  });

  it("each call returns a distinct mesh + uniforms (no shared state)", () => {
    const containerA = new THREE.Group();
    const containerB = new THREE.Group();
    const a = setupStudioWorldWater(containerA, {
      worldSize: 10,
      tileSize: 100,
      waterThreshold: 0,
    });
    const b = setupStudioWorldWater(containerB, {
      worldSize: 10,
      tileSize: 100,
      waterThreshold: 0,
    });
    expect(a.mesh).not.toBe(b.mesh);
    expect(a.uniforms).not.toBe(b.uniforms);
  });
});
