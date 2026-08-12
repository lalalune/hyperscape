import { describe, expect, it } from "vitest";

import type { World } from "../../../../types";
import THREE from "../../../../extras/three/three";
import { WaterSystem, type WaterUniforms } from "../WaterSystem";

type WaterMaterialHarness = {
  normalTex?: THREE.Texture;
  flowTex?: THREE.Texture;
  foamTex?: THREE.Texture;
  oceanMaterial?: THREE.MeshStandardNodeMaterial;
  oceanUniforms: WaterUniforms | null;
  createOceanMaterial(): THREE.MeshStandardNodeMaterial;
};

function createTexture(): THREE.DataTexture {
  const texture = new THREE.DataTexture(
    new Uint8Array([128, 128, 255, 255]),
    1,
    1,
    THREE.RGBAFormat,
  );
  texture.needsUpdate = true;
  return texture;
}

describe("WaterSystem material graph", () => {
  it("constructs the ocean graph with updateable runtime uniform values", () => {
    const world = {
      isServer: false,
      camera: null,
      getSystem: () => null,
    } as unknown as World;
    const system = new WaterSystem(world);
    const harness = system as unknown as WaterMaterialHarness;
    harness.normalTex = createTexture();
    harness.flowTex = createTexture();
    harness.foamTex = createTexture();

    const material = harness.createOceanMaterial();
    harness.oceanMaterial = material;

    expect(material.positionNode).toBeTruthy();
    expect(material.opacityNode).toBeTruthy();
    expect(material.outputNode).toBeTruthy();
    expect(harness.oceanUniforms?.time.value).toBe(0);
    expect(harness.oceanUniforms?.windStrength.value).toBe(1.2);
    expect(harness.oceanUniforms?.sunDirection.value).toBeInstanceOf(
      THREE.Vector3,
    );

    system.update(0.25);
    expect(harness.oceanUniforms?.time.value).toBe(0.25);
    expect(typeof harness.oceanUniforms?.windStrength.value).toBe("number");

    system.destroy();
  });
});
