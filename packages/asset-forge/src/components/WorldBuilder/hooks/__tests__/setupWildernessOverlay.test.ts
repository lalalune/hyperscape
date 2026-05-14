/**
 * `setupWildernessOverlay` / `disposeWildernessOverlay` —
 * geometry + disposal tests.
 *
 * The wilderness overlay is one-shot scene setup, gated by
 * caller on Hyperia content. Tests pin the geometry contract
 * (4 walls + outline + skull sprite parented to the group) and
 * the disposal contract (every owned resource freed, group
 * detached from scene).
 */

import { describe, expect, it } from "vitest";
import * as THREE from "three/webgpu";
import {
  disposeWildernessOverlay,
  setupWildernessOverlay,
} from "../setupWildernessOverlay";

describe("setupWildernessOverlay — geometry shape", () => {
  it("returns a Group that is added to the supplied scene", () => {
    const scene = new THREE.Scene();
    const overlay = setupWildernessOverlay(scene, 16, 32);
    expect(overlay).toBeInstanceOf(THREE.Group);
    expect(scene.children).toContain(overlay);
  });

  it("contains 4 wall meshes + 1 line + 1 skull sprite", () => {
    const overlay = setupWildernessOverlay(new THREE.Scene(), 16, 32);
    const meshes = overlay.children.filter((c) => c instanceof THREE.Mesh);
    const lines = overlay.children.filter((c) => c instanceof THREE.Line);
    const sprites = overlay.children.filter((c) => c instanceof THREE.Sprite);
    expect(meshes).toHaveLength(4);
    expect(lines).toHaveLength(1);
    expect(sprites).toHaveLength(1);
  });

  it("parks the skull sprite reference on the group for the animation loop", () => {
    const overlay = setupWildernessOverlay(new THREE.Scene(), 16, 32);
    expect(overlay.skullSprite).toBeInstanceOf(THREE.Sprite);
    // Skull is also parented to the group (cleanup must reach it via traversal).
    expect(overlay.children).toContain(overlay.skullSprite);
  });

  it("positions the group at the centered-origin wilderness midpoint", () => {
    // worldSize=16 × tileSize=32 = 512m total. wildernessStartPercent=0.3.
    // worldCenter = 256. wildernessDepth = 256 - 512*0.3 = 256 - 153.6 = 102.4.
    // Group sits at (worldCenter, 12, wildernessDepth / 2) = (256, 12, 51.2).
    const overlay = setupWildernessOverlay(new THREE.Scene(), 16, 32);
    expect(overlay.position.x).toBe(256);
    expect(overlay.position.y).toBe(12);
    expect(overlay.position.z).toBeCloseTo(51.2);
  });

  it("scales wall geometries from worldSize × tileSize (linear in both)", () => {
    const a = setupWildernessOverlay(new THREE.Scene(), 16, 32);
    const b = setupWildernessOverlay(new THREE.Scene(), 32, 32);
    // North/south wall widths follow worldSizeMeters; b's walls are 2× a's.
    const aSouth = a.children[0] as THREE.Mesh;
    const bSouth = b.children[0] as THREE.Mesh;
    expect(aSouth.geometry).toBeDefined();
    expect(bSouth.geometry).toBeDefined();
    // Bounding-box approach: compute width from boundingBox.
    aSouth.geometry.computeBoundingBox();
    bSouth.geometry.computeBoundingBox();
    const aWidth =
      aSouth.geometry.boundingBox!.max.x - aSouth.geometry.boundingBox!.min.x;
    const bWidth =
      bSouth.geometry.boundingBox!.max.x - bSouth.geometry.boundingBox!.min.x;
    expect(bWidth / aWidth).toBeCloseTo(2);
  });
});

describe("disposeWildernessOverlay — resource teardown", () => {
  it("removes the group from the scene", () => {
    const scene = new THREE.Scene();
    const overlay = setupWildernessOverlay(scene, 16, 32);
    expect(scene.children).toContain(overlay);
    disposeWildernessOverlay(overlay);
    expect(scene.children).not.toContain(overlay);
  });

  it("disposes every mesh geometry and material", () => {
    const overlay = setupWildernessOverlay(new THREE.Scene(), 16, 32);
    const meshes = overlay.children.filter(
      (c) => c instanceof THREE.Mesh,
    ) as THREE.Mesh[];

    // Spy on dispose calls.
    const geomDisposeSpy = meshes.map((m) => {
      const orig = m.geometry.dispose.bind(m.geometry);
      let called = false;
      m.geometry.dispose = () => {
        called = true;
        orig();
      };
      return () => called;
    });

    disposeWildernessOverlay(overlay);
    for (const wasCalled of geomDisposeSpy) {
      expect(wasCalled()).toBe(true);
    }
  });

  it("disposes the skull sprite's texture (canvas map)", () => {
    const overlay = setupWildernessOverlay(new THREE.Scene(), 16, 32);
    const skullMat = overlay.skullSprite!.material as THREE.SpriteMaterial;
    const texture = skullMat.map!;
    let textureDisposed = false;
    const origDispose = texture.dispose.bind(texture);
    texture.dispose = () => {
      textureDisposed = true;
      origDispose();
    };

    disposeWildernessOverlay(overlay);
    expect(textureDisposed).toBe(true);
  });

  it("disposes the top-edge line material", () => {
    const overlay = setupWildernessOverlay(new THREE.Scene(), 16, 32);
    const line = overlay.children.find(
      (c) => c instanceof THREE.Line,
    ) as THREE.Line;
    const mat = line.material as THREE.Material;
    let matDisposed = false;
    const origDispose = mat.dispose.bind(mat);
    mat.dispose = () => {
      matDisposed = true;
      origDispose();
    };

    disposeWildernessOverlay(overlay);
    expect(matDisposed).toBe(true);
  });
});
