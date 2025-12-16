/**
 * GrassSystem.ts - Instanced Grass Rendering
 *
 * Manages procedural grass generation and rendering using InstancedMesh with custom shaders.
 * Based on reference implementation with wind animation, player interaction, and noise-based variation.
 */

import THREE from "../../../extras/three/three";
import type { World } from "../../../types";
import type { Heightfield, TerrainTile } from "../../../types/world/terrain";
import type { NoiseGenerator } from "../../../utils/NoiseGenerator";
import type { TerrainConfig } from "../../../types/core/settings";

interface GrassInstance {
  posX: number;
  posY: number;
  posZ: number;
  rotY: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  materials: number[];
  materialsWeights: number[];
  hash: number;
  normalX: number;
  normalY: number;
  normalZ: number;
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
    uFadeStart: { value: number };
    uFadeEnd: { value: number };
    uWindStrength: { value: number };
    uGustFrequency: { value: number };
    uGustStrength: { value: number };
  };

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Initialize grass material and textures
   */
  async init(): Promise<void> {
    if (this.world.isServer) {
      return;
    }

    const cdnUrl =
      typeof window !== "undefined"
        ? ((window as { __CDN_URL?: string }).__CDN_URL ??
          "http://localhost:8080")
        : "http://localhost:8080";

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

    const grassTexture = await loader.loadAsync(
      `${cdnUrl}/textures/terrain-grass.png`,
    );
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
      // LOD and quality uniforms
      uFadeStart: { value: 40.0 }, // Start fading at 40m
      uFadeEnd: { value: 60.0 }, // Fully faded at 60m
      uWindStrength: { value: 1.0 }, // Global wind multiplier
      uGustFrequency: { value: 0.3 }, // Gust wave frequency
      uGustStrength: { value: 0.4 }, // Gust intensity
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
        uniform vec3 eye;
        uniform sampler2D noiseTexture;
        uniform sampler2D waveNoiseTexture;
        uniform float uFadeStart;
        uniform float uFadeEnd;
        uniform float uWindStrength;
        uniform float uGustFrequency;
        uniform float uGustStrength;
        
        varying vec2 vUv;
        varying float vWave;
        varying vec4 vMaterialsWeights;
        varying vec4 vMaterials;
        varying float vFade;
        
        #define PI 3.14159265359
        
        void main() {
          vUv = uv;
          vMaterials = materials;
          vMaterialsWeights = materialsWeights;
          
          // Distance-based LOD fade
          float distToCamera = distance(eye, positions);
          vFade = 1.0 - smoothstep(uFadeStart, uFadeEnd, distToCamera);
          
          // Early out for fully faded grass (move behind camera)
          if (vFade < 0.01) {
            gl_Position = vec4(0.0, 0.0, -1000.0, 1.0);
            return;
          }
          
          // OPTIMIZED: Single noise sample for both rotation and scale
          float noiseUvScale = 0.1;
          vec2 noiseUv = vec2(positions.x * noiseUvScale, positions.z * noiseUvScale);
          float combinedNoise = texture2D(noiseTexture, noiseUv).r;
          
          // Y-axis rotation from noise
          float rotDegree = combinedNoise * PI;
          float cosRot = cos(rotDegree);
          float sinRot = sin(rotDegree);
          mat3 rotY = mat3(
            cosRot, 0.0, -sinRot,
            0.0, 1.0, 0.0,
            sinRot, 0.0, cosRot
          );
          
          vec3 rotatedPosition = rotY * position;
          vec3 pos = rotatedPosition;
          
          // Scale with distance-based LOD (shrink distant grass)
          vec2 textureUv = vec2(mod(positions.x, 100.0), mod(positions.z, 100.0));
          float scaleNoise = fract(combinedNoise * 7.3);
          float baseScale = (0.5 + scaleNoise * 2.0) * 0.24;
          float lodScale = mix(0.7, 1.0, vFade); // Shrink distant grass
          pos *= baseScale * lodScale;
          
          // Apply custom height scale
          float heightScale = grassProps.w;
          pos.y *= heightScale;
          
          pos += positions;
          
          // Player push (stronger effect)
          float dis = distance(playerPosition, pos);
          float pushRadius = 0.7;
          float pushStrength = 0.8;
          float pushDown = clamp((1.0 - dis + pushRadius) * pushStrength, 0.0, 1.0);
          vec3 direction = normalize(positions - playerPosition);
          pos.xyz += direction * (1.0 - uv.y) * pushDown;
          
          // Base height for animation strength
          float movingLerp = smoothstep(0.1, 2.0, 1.0 - uv.y);
          
          // IMPROVED WIND with gusts
          float windNoiseUvScale = 0.1;
          float windNoiseUvSpeed = 0.03;
          vec2 windNoiseUv = vec2(
            textureUv.x * windNoiseUvScale + uTime * windNoiseUvSpeed,
            textureUv.y * windNoiseUvScale + uTime * windNoiseUvSpeed
          );
          float windNoise = texture2D(noiseTexture, windNoiseUv).r - 0.5;
          
          // Add gust pattern (large-scale wind variations)
          float gustPhase = sin(positions.x * 0.02 + positions.z * 0.015 + uTime * uGustFrequency);
          float gustIntensity = gustPhase * 0.5 + 0.5; // 0 to 1
          float gustMultiplier = 1.0 + gustIntensity * uGustStrength;
          
          float windNoiseScale = 1.4 * uWindStrength * gustMultiplier;
          pos += sin(windNoise * vec3(windNoiseScale, 0.0, windNoiseScale)) * movingLerp;
          
          // Wave pattern
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
        varying float vFade;
        
        vec3 getGrassColor(float materialIndex) {
          int matIdx = int(materialIndex);
          // Rich, natural grass colors
          vec3 grassColorGrass = vec3(0.18, 0.55, 0.22); // Forest green
          vec3 grassColorDirt = vec3(0.45, 0.55, 0.15);  // Olive-yellow
          vec3 grassColorRock = vec3(0.35, 0.45, 0.25);  // Sage green
          vec3 grassColorSnow = vec3(0.50, 0.60, 0.40);  // Pale green
          
          if(matIdx == 0) return grassColorGrass;
          if(matIdx == 1) return grassColorDirt;
          if(matIdx == 2) return grassColorRock;
          if(matIdx == 3) return grassColorSnow;
          return grassColorGrass;
        }
        
        void main() {
          // Early discard for fully faded grass
          if (vFade < 0.01) discard;
          
          // Sample texture
          vec4 tex = texture2D(grassTexture, vUv);
          
          // Alpha cutout with distance-based threshold
          // Distant grass fades out gradually
          float alphaThreshold = mix(0.3, 0.5, vFade);
          if (tex.a < alphaThreshold) discard;
          
          // Material blending
          vec3 grassColor = vec3(0.0);
          float totalWeight = 0.0;
          
          if (vMaterialsWeights.x > 0.01) {
            grassColor += getGrassColor(vMaterials.x) * vMaterialsWeights.x;
            totalWeight += vMaterialsWeights.x;
          }
          if (vMaterialsWeights.y > 0.01) {
            grassColor += getGrassColor(vMaterials.y) * vMaterialsWeights.y;
            totalWeight += vMaterialsWeights.y;
          }
          if (vMaterialsWeights.z > 0.01) {
            grassColor += getGrassColor(vMaterials.z) * vMaterialsWeights.z;
            totalWeight += vMaterialsWeights.z;
          }
          if (vMaterialsWeights.w > 0.01) {
            grassColor += getGrassColor(vMaterials.w) * vMaterialsWeights.w;
            totalWeight += vMaterialsWeights.w;
          }
          
          if (totalWeight > 0.0) {
            grassColor /= totalWeight;
          }
          
          // Height-based color gradient (darker at base, lighter tips)
          float heightGradient = smoothstep(0.0, 0.8, 1.0 - vUv.y);
          vec3 baseColor = grassColor * 0.4;  // Dark base
          vec3 tipColor = grassColor * 1.2;    // Bright tips
          grassColor = mix(baseColor, tipColor, heightGradient);
          
          // Subsurface scattering approximation (backlit grass glows)
          float sss = heightGradient * 0.15;
          grassColor += vec3(0.2, 0.35, 0.1) * sss;
          
          // Modulate by texture
          grassColor *= tex.rgb * 1.3;
          
          // Wave/wind brightness variation
          float waveColorScale = 0.25;
          grassColor += vec3(clamp(vWave - 0.3, 0.0, 1.0) * waveColorScale) * heightGradient;
          
          // Apply distance fade to alpha
          float finalAlpha = tex.a * vFade;
          
          // Gamma correction
          grassColor = pow(grassColor, vec3(1.0 / 2.2));
          
          gl_FragColor = vec4(grassColor, finalAlpha);
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
    biomeData: { [key: string]: unknown },
    context: TerrainContext,
  ): void {
    const grassInstances: GrassInstance[] = [];
    const MAX_GRASS_PER_CHUNK = 3000; // Increased for denser grass
    const CHUNK_SIZE = 16;
    const tileSize = Number(context.CONFIG.TILE_SIZE);
    const chunksPerSide = Math.floor(tileSize / CHUNK_SIZE);
    
    // Biome-based grass density and thresholds
    const biomeId = (biomeData.id as string) || tile.biome || "plains";
    const grassSettings = this.getGrassSettingsForBiome(biomeId);

    for (let cz = 0; cz < chunksPerSide; cz++) {
      for (let cx = 0; cx < chunksPerSide; cx++) {
        const chunkWorldX = tile.x * tileSize + cx * CHUNK_SIZE;
        const chunkWorldZ = tile.z * tileSize + cz * CHUNK_SIZE;

        const chunkSeed = context.noise.hashNoise(chunkWorldX, chunkWorldZ);
        const chunkRng = context.seedRngFromFloat(chunkSeed);

        // Adjust iterations based on biome density
        const grassIterations = Math.floor(MAX_GRASS_PER_CHUNK * grassSettings.density);

        for (let i = 0; i < grassIterations; i++) {
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

          // More permissive grass placement with biome-specific thresholds
          const effectiveGrassVisibility = heightfield.grassVisibility + grassSettings.visibilityBoost;
          
          if (effectiveGrassVisibility > grassSettings.threshold) {
            if (
              heightfield.liquidType === "none" &&
              heightfield.slope < grassSettings.maxSlope &&
              heightfield.rockVisibility < 0.85
            ) {
              const simplexm10 = context.noise.simplex2D(
                worldX * 10,
                worldZ * 10,
              );
              
              // Biome-specific height scaling
              const baseHeight = grassSettings.baseHeight + simplexm10 * 0.4;
              const heightScale = baseHeight * (0.8 + chunkRng() * 0.4);
              
              const rotation = context.noise.rotationNoise(worldX, worldZ);
              const scaleNoise = context.noise.scaleNoise(worldX, worldZ);
              const scale = (0.7 + scaleNoise * 0.3) * grassSettings.scaleMultiplier;

              grassInstances.push({
                posX: worldX,
                posY: heightfield.height,
                posZ: worldZ,
                rotY: rotation.y * Math.PI * 2,
                scaleX: scale,
                scaleY: heightScale,
                scaleZ: scale,
                materials: heightfield.materials,
                materialsWeights: heightfield.materialsWeights,
                hash: heightfield.hash,
                normalX: heightfield.normal.x,
                normalY: heightfield.normal.y,
                normalZ: heightfield.normal.z,
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

  /**
   * Get grass rendering settings based on biome type
   */
  private getGrassSettingsForBiome(biomeId: string): {
    density: number;
    threshold: number;
    visibilityBoost: number;
    maxSlope: number;
    baseHeight: number;
    scaleMultiplier: number;
  } {
    const settings: Record<string, {
      density: number;
      threshold: number;
      visibilityBoost: number;
      maxSlope: number;
      baseHeight: number;
      scaleMultiplier: number;
    }> = {
      plains: {
        density: 1.0,
        threshold: 0.02,
        visibilityBoost: 0.3,
        maxSlope: 0.35,
        baseHeight: 1.2,
        scaleMultiplier: 1.0,
      },
      forest: {
        density: 0.8,
        threshold: 0.02,
        visibilityBoost: 0.25,
        maxSlope: 0.30,
        baseHeight: 1.0,
        scaleMultiplier: 0.9,
      },
      valley: {
        density: 1.2,
        threshold: 0.01,
        visibilityBoost: 0.35,
        maxSlope: 0.40,
        baseHeight: 1.4,
        scaleMultiplier: 1.1,
      },
      mountains: {
        density: 0.3,
        threshold: 0.15,
        visibilityBoost: 0.1,
        maxSlope: 0.20,
        baseHeight: 0.6,
        scaleMultiplier: 0.7,
      },
      tundra: {
        density: 0.2,
        threshold: 0.20,
        visibilityBoost: 0.05,
        maxSlope: 0.25,
        baseHeight: 0.4,
        scaleMultiplier: 0.6,
      },
      desert: {
        density: 0.05,
        threshold: 0.40,
        visibilityBoost: 0.0,
        maxSlope: 0.15,
        baseHeight: 0.3,
        scaleMultiplier: 0.5,
      },
      lakes: {
        density: 0.6,
        threshold: 0.05,
        visibilityBoost: 0.2,
        maxSlope: 0.30,
        baseHeight: 1.0,
        scaleMultiplier: 0.9,
      },
      swamp: {
        density: 0.5,
        threshold: 0.08,
        visibilityBoost: 0.15,
        maxSlope: 0.25,
        baseHeight: 0.8,
        scaleMultiplier: 0.8,
      },
    };

    return settings[biomeId] || settings.plains;
  }

  /**
   * Create optimized grass geometry with cross-billboard for better volume
   */
  private createGrassGeometry(): THREE.BufferGeometry {
    // Create cross-billboard geometry (two intersecting planes)
    // This gives grass more volume from all viewing angles
    const width = 0.6;
    const height = 1.5;
    const halfWidth = width / 2;

    // Vertices for two crossed planes (8 vertices total, sharing some)
    const positions = new Float32Array([
      // Plane 1 (XY)
      -halfWidth,
      0,
      0,
      halfWidth,
      0,
      0,
      halfWidth,
      height,
      0,
      -halfWidth,
      height,
      0,
      // Plane 2 (rotated 90°)
      0,
      0,
      -halfWidth,
      0,
      0,
      halfWidth,
      0,
      height,
      halfWidth,
      0,
      height,
      -halfWidth,
    ]);

    // UVs
    const uvs = new Float32Array([
      0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0,
    ]);

    // Indices for two quads (front and back for each)
    const indices = new Uint16Array([
      0,
      1,
      2,
      0,
      2,
      3, // Plane 1 front
      0,
      2,
      1,
      0,
      3,
      2, // Plane 1 back
      4,
      5,
      6,
      4,
      6,
      7, // Plane 2 front
      4,
      6,
      5,
      4,
      7,
      6, // Plane 2 back
    ]);

    // Normals pointing up for lighting
    const normals = new Float32Array([
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    ]);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    return geometry;
  }

  createGrassMesh(instances: GrassInstance[]): THREE.InstancedMesh {
    const baseGeometry = this.createGrassGeometry();

    const positions = new Float32Array(instances.length * 3);
    const slopes = new Float32Array(instances.length * 3);
    const materials = new Float32Array(instances.length * 4);
    const materialsWeights = new Float32Array(instances.length * 4);
    const grassProps = new Float32Array(instances.length * 4);

    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];
      // Use primitive values directly - no Vector3/Euler allocations
      positions[i * 3 + 0] = inst.posX;
      positions[i * 3 + 1] = inst.posY;
      positions[i * 3 + 2] = inst.posZ;

      slopes[i * 3 + 0] = inst.normalX;
      slopes[i * 3 + 1] = inst.normalY;
      slopes[i * 3 + 2] = inst.normalZ;

      for (let j = 0; j < 4; j++) {
        materials[i * 4 + j] = inst.materials[j];
        materialsWeights[i * 4 + j] = inst.materialsWeights[j];
      }

      grassProps[i * 4 + 0] = inst.hash;
      grassProps[i * 4 + 1] = inst.hash;
      grassProps[i * 4 + 2] = inst.hash;
      grassProps[i * 4 + 3] = inst.scaleY;
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

  /**
   * Clean up grass resources
   */
  dispose(): void {
    if (this.grassMaterial) {
      this.grassMaterial.dispose();
      this.grassMaterial = undefined;
    }
    if (this.grassTexture) {
      this.grassTexture.dispose();
      this.grassTexture = undefined;
    }
    this.grassUniforms = undefined;
  }
}
