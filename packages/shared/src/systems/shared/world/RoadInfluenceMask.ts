import THREE, { texture, uniform } from "../../../extras/three/three";
import type { UniformNode } from "three/webgpu";

// Road influence texture (shared across terrain/grass/flowers)
// Initialized with dummy 1x1 texture so shaders compile before real data loads
const dummyRoadData = new Float32Array([0]);
const roadInfluenceTexture: THREE.DataTexture = new THREE.DataTexture(
  dummyRoadData,
  1,
  1,
  THREE.RedFormat,
  THREE.FloatType,
);
roadInfluenceTexture.wrapS = THREE.ClampToEdgeWrapping;
roadInfluenceTexture.wrapT = THREE.ClampToEdgeWrapping;
roadInfluenceTexture.minFilter = THREE.LinearFilter;
roadInfluenceTexture.magFilter = THREE.LinearFilter;
roadInfluenceTexture.needsUpdate = true;

const roadInfluenceTextureNode: ReturnType<typeof texture> =
  texture(roadInfluenceTexture);
const uRoadInfluenceWorldSize = uniform(1); // World size covered by road texture
const uRoadInfluenceCenterX = uniform(0); // World center X
const uRoadInfluenceCenterZ = uniform(0); // World center Z
const uRoadInfluenceThreshold = uniform(0.15); // Cull threshold

export type RoadInfluenceTextureState = {
  textureNode: ReturnType<typeof texture>;
  uWorldSize: UniformNode<"float", number>;
  uCenterX: UniformNode<"float", number>;
  uCenterZ: UniformNode<"float", number>;
  uThreshold: UniformNode<"float", number>;
};

export function getRoadInfluenceTextureState(): RoadInfluenceTextureState {
  return {
    textureNode: roadInfluenceTextureNode,
    uWorldSize: uRoadInfluenceWorldSize,
    uCenterX: uRoadInfluenceCenterX,
    uCenterZ: uRoadInfluenceCenterZ,
    uThreshold: uRoadInfluenceThreshold,
  };
}

export function getRoadInfluenceTexture(): THREE.DataTexture {
  return roadInfluenceTexture;
}

export function setRoadInfluenceTextureData(
  data: Float32Array,
  width: number,
  height: number,
  worldSize: number,
  centerX = 0,
  centerZ = 0,
): void {
  roadInfluenceTexture.image = { data, width, height };
  roadInfluenceTexture.needsUpdate = true;
  uRoadInfluenceWorldSize.value = worldSize;
  uRoadInfluenceCenterX.value = centerX;
  uRoadInfluenceCenterZ.value = centerZ;
}

export function clearRoadInfluenceTexture(): void {
  const emptyData = new Float32Array([0]);
  roadInfluenceTexture.image = { data: emptyData, width: 1, height: 1 };
  roadInfluenceTexture.needsUpdate = true;
  uRoadInfluenceWorldSize.value = 1;
  uRoadInfluenceCenterX.value = 0;
  uRoadInfluenceCenterZ.value = 0;
}

export function setRoadInfluenceThreshold(threshold: number): void {
  uRoadInfluenceThreshold.value = Math.max(0, Math.min(1, threshold));
}

export function getRoadInfluenceThreshold(): number {
  return uRoadInfluenceThreshold.value;
}
