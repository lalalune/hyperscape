/**
 * GrassSystem.ts - Instanced Grass Rendering
 *
 * Manages procedural grass generation and rendering using InstancedMesh with custom shaders.
 * Based on reference implementation with wind animation, player interaction, and noise-based variation.
 */

import THREE from "../extras/three";
import type { World } from "../types";
import type { Heightfield, TerrainTile } from "../types/terrain";
import type { NoiseGenerator } from "../utils/NoiseGenerator";
import type { TerrainConfig } from "../types/settings";

interface GrassInstance {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  materials: number[];
  materialsWeights: number[];
  hash: number;
  normal: { x: number; y: number; z: number };
}

interface TerrainContext {
  CONFIG: TerrainConfig;
  noise: NoiseGenerator;
  seedRngFromFloat: (seed: number) => () => number;
  getHeightfieldAt: (
    worldX: number,
    worldZ: number,
    tile: TerrainTile,
    heightfields: Heightfield[],
  ) => Heightfield | null;
}

export class GrassSystem {
  private world: World;
  private grassMaterial?: THREE.ShaderMaterial;
  private grassTexture?: THREE.Texture;
  private grassUniforms?: {
    uTime: { value: number };
    fadePosition: { value: number };
    playerPosition: { value: THREE.Vector3 };
    eye: { value: THREE.Vector3 };
    noiseTexture: { value: THREE.Texture };
    waveNoiseTexture: { value: THREE.Texture };
    grassTexture: { value: THREE.Texture | null };
  };

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Initialize grass material and textures
   */
  async init(): Promise<void> {
    if (this.world.isServer) return;

    const cdnUrl =
      typeof window !== "undefined"
        ? (window as any).__CDN_URL || "http://localhost:8088"
        : "http://localhost:8088";

    const loader = new THREE.TextureLoader();
    const noiseTexture = await loader.loadAsync(
      `${cdnUrl}/noise/simplex-noise.png`,
    );
    noiseTexture.wrapS = THREE.RepeatWrapping;
    noiseTexture.wrapT = THREE.RepeatWrapping;

    const waveNoiseTexture = await loader.loadAsync(
      `${cdnUrl}/noise/simplex-noise.png`,
    );
    waveNoiseTexture.wrapS = THREE.RepeatWrapping;
    waveNoiseTexture.wrapT = THREE.RepeatWrapping;

    const grassTexture = await loader.loadAsync("/textures/terrain-grass.png");
    grassTexture.wrapS = THREE.ClampToEdgeWrapping;
    grassTexture.wrapT = THREE.ClampToEdgeWrapping;

    this.grassMaterial = this.createGrassMaterial(
      noiseTexture,
      waveNoiseTexture,
      grassTexture,
    );
  }

  private createGrassMaterial(
    noiseTexture: THREE.Texture,
    waveNoiseTexture: THREE.Texture,
    grassTexture: THREE.Texture,
  ): THREE.ShaderMaterial {
    this.grassUniforms = {
      uTime: { value: 0 },
      fadePosition: { value: 0 },
      playerPosition: { value: new THREE.Vector3() },
      eye: { value: new THREE.Vector3() },
      noiseTexture: { value: noiseTexture },
      waveNoiseTexture: { value: waveNoiseTexture },
      grassTexture: { value: grassTexture },
    };

    return new THREE.ShaderMaterial({
      uniforms: this.grassUniforms,
      vertexShader: /* glsl */ `
        // Per-instance attributes
        attribute vec3 positions;      // World position
        attribute vec3 slopes;         // Surface normal
        attribute vec4 materials;      // Material indices (as float for WebGPU)
        attribute vec4 materialsWeights; // Material weights
        attribute vec4 grassProps;     // (hash, hash, hash, heightScale)
        
        uniform float uTime;
        uniform vec3 playerPosition;
        uniform sampler2D noiseTexture;
        uniform sampler2D waveNoiseTexture;
        
        varying vec2 vUv;
        varying float vWave;
        varying vec4 vMaterialsWeights;
        varying vec4 vMaterials;
        
        #define PI 3.14159265359
        
        void main() {
          vUv = uv;
          vMaterials = materials;
          vMaterialsWeights = materialsWeights;
          
          // Y-axis rotation from noise
          float rotNoiseUvScale = 0.1;
          vec2 rotNoiseUv = vec2(positions.x * rotNoiseUvScale, positions.z * rotNoiseUvScale);
          float rotNoise = texture2D(noiseTexture, rotNoiseUv).r;
          float rotDegree = rotNoise * PI;
          mat3 rotY = mat3(
            cos(rotDegree), 0.0, -sin(rotDegree),
            0.0, 1.0, 0.0,
            sin(rotDegree), 0.0, cos(rotDegree)
          );
          
          vec3 rotatedPosition = rotY * position;
          vec3 pos = rotatedPosition;
          
          // Scale from noise
          vec2 textureUv = vec2(mod(positions.x, 100.0), mod(positions.z, 100.0));
          float scaleNoiseUvScale = 0.1;
          vec2 scaleNoiseUv = vec2(textureUv.x * scaleNoiseUvScale, textureUv.y * scaleNoiseUvScale);
          float scaleNoise = texture2D(noiseTexture, scaleNoiseUv).r;
          scaleNoise = (0.5 + scaleNoise * 2.0) * 0.24;
          pos *= scaleNoise;
          
          // Apply custom height scale
          float heightScale = grassProps.w;
          pos.y *= heightScale;
          
          pos += positions;
          
          // Player push
          float dis = distance(playerPosition, pos);
          float pushRadius = 0.5;
          float pushStrength = 0.6;
          float pushDown = clamp((1.0 - dis + pushRadius) * pushStrength, 0.0, 1.0);
          vec3 direction = normalize(positions - playerPosition);
          pos.xyz += direction * (1.0 - uv.y) * pushDown;
          
          // Wind
          float movingLerp = smoothstep(0.1, 2.0, 1.0 - uv.y);
          float windNoiseUvScale = 0.1;
          float windNoiseUvSpeed = 0.03;
          vec2 windNoiseUv = vec2(
            textureUv.x * windNoiseUvScale + uTime * windNoiseUvSpeed,
            textureUv.y * windNoiseUvScale + uTime * windNoiseUvSpeed
          );
          float windNoise = texture2D(noiseTexture, windNoiseUv).r - 0.5;
          float windNoiseScale = 1.4;
          pos += sin(windNoise * vec3(windNoiseScale, 0.0, windNoiseScale)) * movingLerp;
          
          // Wave
          float waveNoiseUvScale = 10.0;
          float waveNoiseUvSpeed = 0.05;
          vec2 waveNoiseUv = vec2(
            textureUv.x * waveNoiseUvScale + (uTime + positions.x * 0.1) * waveNoiseUvSpeed,
            textureUv.y * waveNoiseUvScale
          );
          float waveNoise = texture2D(waveNoiseTexture, waveNoiseUv).r;
          float waveNoiseScale = 2.0;
          pos.xz -= sin(waveNoise * waveNoiseScale) * movingLerp;
          vWave = waveNoise;
          
          gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        
        uniform sampler2D grassTexture;
        
        varying vec2 vUv;
        varying float vWave;
        varying vec4 vMaterialsWeights;
        varying vec4 vMaterials;
        
        vec3 getGrassColor(float materialIndex) {
          int matIdx = int(materialIndex);
          vec3 grassColorGrass = vec3(0.0, 0.94, 0.44); // Bright grass green
          vec3 grassColorDirt = vec3(0.6, 1.0, 0.0);    // Yellow-green for dirt
          
          if(matIdx == 0) return grassColorGrass; // Grass on grass
          if(matIdx == 1) return grassColorDirt;  // Grass on dirt
          if(matIdx == 2) return grassColorDirt;  // Grass on rock
          if(matIdx == 3) return grassColorDirt;  // Grass on snow
          return grassColorGrass;
        }
        
        void main() {
          // Sample texture
          vec4 tex = texture2D(grassTexture, vUv);
          
          // Alpha cutout
          if (tex.a < 0.5) discard;
          
          // Blend material colors
          vec3 grassColor = vec3(0.0);
          float totalWeight = 0.0;
          for (int i = 0; i < 4; i++) {
            if (vMaterialsWeights[i] > 0.01) {
              grassColor += getGrassColor(vMaterials[i]) * vMaterialsWeights[i];
              totalWeight += vMaterialsWeights[i];
            }
          }
          if (totalWeight > 0.0) {
            grassColor /= totalWeight;
          }
          
          // Apply color gradient (darker at base)
          float colorLerp = smoothstep(0.2, 1.8, 1.0 - vUv.y);
          grassColor = mix(grassColor * 0.5, grassColor, colorLerp);
          
          // Modulate by texture
          grassColor *= tex.rgb * 1.4;
          
          // Add wave brightness
          float waveColorScale = 0.3;
          grassColor.rgb += vec3(clamp(vWave - 0.3, 0.0, 1.0) * waveColorScale) * colorLerp;
          
          gl_FragColor = vec4(grassColor, 1.0);
        }
      `,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
    });
  }

  /**
   * Generate grass for a terrain tile
   */
  generateGrassForTile(
    tile: TerrainTile,
    heightfields: Heightfield[],
    _biomeData: { [key: string]: unknown },
    context: TerrainContext,
  ): void {
    const grassInstances: GrassInstance[] = [];
    const MAX_GRASS_PER_CHUNK = 2048;
    const CHUNK_SIZE = 16;
    const tileSize = Number(context.CONFIG.TILE_SIZE);
    const chunksPerSide = Math.floor(tileSize / CHUNK_SIZE);
    const GRASS_THRESHOLD = 0.05;

    for (let cz = 0; cz < chunksPerSide; cz++) {
      for (let cx = 0; cx < chunksPerSide; cx++) {
        const chunkWorldX = tile.x * tileSize + cx * CHUNK_SIZE;
        const chunkWorldZ = tile.z * tileSize + cz * CHUNK_SIZE;

        const chunkSeed = context.noise.hashNoise(chunkWorldX, chunkWorldZ);
        const chunkRng = context.seedRngFromFloat(chunkSeed);

        for (let i = 0; i < MAX_GRASS_PER_CHUNK; i++) {
          const offsetX = chunkRng() * CHUNK_SIZE;
          const offsetZ = chunkRng() * CHUNK_SIZE;
          const worldX = chunkWorldX + offsetX;
          const worldZ = chunkWorldZ + offsetZ;

          const heightfield = context.getHeightfieldAt(
            worldX,
            worldZ,
            tile,
            heightfields,
          );
          if (!heightfield) continue;

          if (heightfield.grassVisibility > GRASS_THRESHOLD) {
            if (
              heightfield.liquidType === "none" &&
              heightfield.slope < 0.13 &&
              heightfield.rockVisibility < 0.95
            ) {
              const simplexm10 = context.noise.simplex2D(
                worldX * 10,
                worldZ * 10,
              );
              const heightScale = 1.4 + simplexm10 * 0.5;
              const rotation = context.noise.rotationNoise(worldX, worldZ);
              const scaleNoise = context.noise.scaleNoise(worldX, worldZ);
              const scale = 0.8 + scaleNoise * 0.2;

              grassInstances.push({
                position: new THREE.Vector3(worldX, heightfield.height, worldZ),
                rotation: new THREE.Euler(0, rotation.y * Math.PI * 2, 0),
                scale: new THREE.Vector3(scale, heightScale, scale),
                materials: heightfield.materials,
                materialsWeights: heightfield.materialsWeights,
                hash: heightfield.hash,
                normal: heightfield.normal,
              });
            }
          }
        }
      }
    }

    if (grassInstances.length > 0) {
      const grassMesh = this.createGrassMesh(grassInstances);
      (tile as TerrainTile & { grassMeshes?: THREE.Mesh[] }).grassMeshes = [
        grassMesh,
      ];
      const stage = this.world.stage as { scene: THREE.Scene };
      if (stage?.scene) {
        stage.scene.add(grassMesh);
      }
    }
  }

  createGrassMesh(instances: GrassInstance[]): THREE.InstancedMesh {
    const baseGeometry = new THREE.PlaneGeometry(0.6, 1.5, 1, 1);
    baseGeometry.translate(0, 0.75, 0);

    const positions = new Float32Array(instances.length * 3);
    const slopes = new Float32Array(instances.length * 3);
    const materials = new Float32Array(instances.length * 4);
    const materialsWeights = new Float32Array(instances.length * 4);
    const grassProps = new Float32Array(instances.length * 4);

    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];
      positions[i * 3 + 0] = inst.position.x;
      positions[i * 3 + 1] = inst.position.y;
      positions[i * 3 + 2] = inst.position.z;

      slopes[i * 3 + 0] = inst.normal.x;
      slopes[i * 3 + 1] = inst.normal.y;
      slopes[i * 3 + 2] = inst.normal.z;

      for (let j = 0; j < 4; j++) {
        materials[i * 4 + j] = inst.materials[j];
        materialsWeights[i * 4 + j] = inst.materialsWeights[j];
      }

      grassProps[i * 4 + 0] = inst.hash;
      grassProps[i * 4 + 1] = inst.hash;
      grassProps[i * 4 + 2] = inst.hash;
      grassProps[i * 4 + 3] = inst.scale.y;
    }

    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = baseGeometry.index;
    geometry.attributes.position = baseGeometry.attributes.position;
    geometry.attributes.normal = baseGeometry.attributes.normal;
    geometry.attributes.uv = baseGeometry.attributes.uv;

    geometry.setAttribute(
      "positions",
      new THREE.InstancedBufferAttribute(positions, 3),
    );
    geometry.setAttribute(
      "slopes",
      new THREE.InstancedBufferAttribute(slopes, 3),
    );
    geometry.setAttribute(
      "materials",
      new THREE.InstancedBufferAttribute(materials, 4),
    );
    geometry.setAttribute(
      "materialsWeights",
      new THREE.InstancedBufferAttribute(materialsWeights, 4),
    );
    geometry.setAttribute(
      "grassProps",
      new THREE.InstancedBufferAttribute(grassProps, 4),
    );

    const mesh = new THREE.InstancedMesh(
      geometry,
      this.grassMaterial!,
      instances.length,
    );

    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.castShadow = false;

    return mesh;
  }

  /**
   * Update grass uniforms each frame
   */
  update(deltaTime: number): void {
    if (!this.grassUniforms) return;

    const dt =
      typeof deltaTime === "number" && isFinite(deltaTime) ? deltaTime : 1 / 60;
    this.grassUniforms.uTime.value += dt;

    const players = this.world.getPlayers && this.world.getPlayers();
    const p = players && players[0];
    if (p?.node?.position) {
      this.grassUniforms.playerPosition.value.copy(
        p.node.position as THREE.Vector3,
      );
    }
    if (this.world.camera?.position) {
      this.grassUniforms.eye.value.copy(
        this.world.camera.position as THREE.Vector3,
      );
    }
  }
}
