import { describe, expect, it, vi } from "vitest";

import THREE from "../../../extras/three/three";
import { ClientGraphics } from "../ClientGraphics";

describe("ClientGraphics object precompile", () => {
  it("serializes compilation and restores visibility and frustum state before awaiting", async () => {
    let finishFirst: (() => void) | undefined;
    const firstBarrier = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const observations: Array<{
      rootVisible: boolean;
      childFrustumCulled: boolean;
      targetScene: THREE.Object3D | null | undefined;
    }> = [];
    const compileAsync = vi
      .fn()
      .mockImplementationOnce(
        (
          root: THREE.Object3D,
          _camera: THREE.Camera,
          targetScene?: THREE.Object3D | null,
        ) => {
          const child = root.children[0] as THREE.Mesh;
          observations.push({
            rootVisible: root.visible,
            childFrustumCulled: child.frustumCulled,
            targetScene,
          });
          return firstBarrier;
        },
      )
      .mockResolvedValueOnce(undefined);
    const graphics = Object.create(ClientGraphics.prototype) as ClientGraphics;
    Object.assign(graphics, {
      renderer: { compileAsync },
      world: { camera, stage: { scene } },
      precompileQueue: Promise.resolve(),
      pendingPrecompileCount: 0,
    });

    const first = new THREE.Group();
    first.visible = false;
    const firstMesh = new THREE.Mesh(new THREE.BufferGeometry());
    firstMesh.frustumCulled = true;
    first.add(firstMesh);
    const second = new THREE.Group();
    second.add(new THREE.Mesh(new THREE.BufferGeometry()));

    const firstCompile = graphics.precompileObject(first);
    const secondCompile = graphics.precompileObject(second);
    expect(graphics.isPrecompileIdle()).toBe(false);
    await vi.waitFor(() => expect(compileAsync).toHaveBeenCalledOnce());
    expect(observations[0]).toEqual({
      rootVisible: true,
      childFrustumCulled: false,
      targetScene: scene,
    });
    expect(first.visible).toBe(false);
    expect(firstMesh.frustumCulled).toBe(true);

    finishFirst?.();
    await firstCompile;
    await secondCompile;

    expect(compileAsync).toHaveBeenCalledTimes(2);
    expect(graphics.isPrecompileIdle()).toBe(true);
  });
});
