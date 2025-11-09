/**
 * GrassSystem.ts - Instanced Grass Rendering
 *
 * Manages procedural grass generation and rendering using InstancedMesh with custom shaders.
 * Based on reference implementation with wind animation, player interaction, and noise-based variation.
 */

import THREE from "../extras/three";
import type { World } from "../types";
import type { TerrainTile } from "../types/terrain";

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
    // Only load textures on client (server has no DOM/document)
    if (this.world.isServer) {
      console.log("[GrassSystem] Skipping texture load on server");
      return;
    }

    // Load grass texture from local assets
    console.log("[GrassSystem] Loading grass texture...");
    const grassUrl = "/textures/terrain-grass.png";
    const loader = new THREE.TextureLoader();
    const loadedGrassTex = loader.load(
      grassUrl,
      (tex) => {
        console.log(
          "[GrassSystem] Grass texture loaded! Size:",
          tex.image?.width,
          "x",
          tex.image?.height,
        );
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        if (this.grassUniforms) {
          this.grassUniforms.grassTexture.value = tex;
          console.log("[GrassSystem] Texture assigned to uniform");
        }
      },
      undefined,
      (err) => {
        console.error("[GrassSystem] Grass texture error:", err);
      },
    );

    // Create placeholder noise textures
    const createWhiteTexture = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 1, 1);
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      return tex;
    };

    // Grass uniforms matching reference
    this.grassUniforms = {
      uTime: { value: 0 },
      fadePosition: { value: 0 },
      playerPosition: { value: new THREE.Vector3() },
      eye: { value: new THREE.Vector3() },
      noiseTexture: { value: createWhiteTexture() },
      waveNoiseTexture: { value: createWhiteTexture() },
      grassTexture: { value: loadedGrassTex },
    };

    // Create grass material with reference shader
    this.grassMaterial = new THREE.ShaderMaterial({
      uniforms: this.grassUniforms,
      vertexShader: `
        attribute vec3 positions;
        attribute vec3 slopes;
        uniform float uTime;
        uniform float fadePosition;
        uniform sampler2D noiseTexture;
        uniform sampler2D waveNoiseTexture;
        uniform vec3 playerPosition;
        varying vec2 vUv;
        varying float vWave;
        
        #define PI 3.14159265359
        
        void main() {
          vUv = uv;
          
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
          pos.y *= 1.2;
          
          pos += positions;
          pos.y -= fadePosition;
          pos.y -= 0.15;
          
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
      fragmentShader: `
        uniform sampler2D grassTexture;
        varying vec2 vUv;
        varying float vWave;
        
        void main() {
          // Sample texture
          vec4 tex = texture2D(grassTexture, vUv);
          
          // Alpha cutout (inverted for this texture)
          if (tex.a > 0.5) discard;
          
          // Apply color gradient (darker, richer greens)
          float colorLerp = smoothstep(0.2, 1.8, 1.0 - vUv.y);
          vec3 grassColor = mix(vec3(0.25, 0.45, 0.02), vec3(0.45, 0.65, 0.08), colorLerp);
          
          // Modulate by texture for detail
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

    console.log("[GrassSystem] Grass material created");
  }

  /**
   * Generate grass for a terrain tile
   */
  generateGrassForTile(
    tile: TerrainTile,
    getHeightAt: (x: number, z: number) => number,
    getNormalAt: (x: number, z: number) => THREE.Vector3,
    calculateSlope: (x: number, z: number) => number,
    waterThreshold: number,
    tileSize: number,
    createTileRng: (x: number, z: number, salt: string) => () => number,
  ): THREE.InstancedMesh | null {
    if (!this.grassMaterial) return null;

    const biomeName = tile.biome as string;
    const baseDensity = 0.3;
    const densityMul =
      biomeName === "plains" ? 1.2 : biomeName === "forest" ? 0.8 : 1.0;
    const density = baseDensity * densityMul;

    const area = tileSize * tileSize;
    const targetCount = Math.min(3000, Math.floor(area * density));
    const rng = createTileRng(tile.x, tile.z, "grass");

    const positions: number[] = [];
    const slopes: number[] = [];

    for (let i = 0; i < targetCount; i++) {
      const localX = (rng() - 0.5) * (tileSize * 0.95);
      const localZ = (rng() - 0.5) * (tileSize * 0.95);
      const worldX = tile.x * tileSize + localX;
      const worldZ = tile.z * tileSize + localZ;
      const height = getHeightAt(worldX, worldZ);

      if (height < waterThreshold) continue;
      const slope = calculateSlope(worldX, worldZ);
      if (slope > 0.6) continue;

      positions.push(worldX, height + 0.02, worldZ);
      const normal = getNormalAt(worldX, worldZ);
      slopes.push(normal.x, normal.y, normal.z);
    }

    const actualCount = positions.length / 3;
    if (actualCount === 0) return null;

    console.log(
      `[GrassSystem] Creating grass mesh with ${actualCount} blades for tile ${tile.key}`,
    );

    // Create instanced geometry with positions/slopes attributes
    const grassBaseGeom = new THREE.PlaneGeometry(0.6, 1.5, 1, 1);
    grassBaseGeom.translate(0, 0.75, 0);

    const grassGeom = new THREE.BufferGeometry();
    grassGeom.setAttribute("position", grassBaseGeom.attributes.position);
    grassGeom.setAttribute("normal", grassBaseGeom.attributes.normal);
    grassGeom.setAttribute("uv", grassBaseGeom.attributes.uv);
    grassGeom.setIndex(grassBaseGeom.index);
    grassGeom.setAttribute(
      "positions",
      new THREE.InstancedBufferAttribute(new Float32Array(positions), 3),
    );
    grassGeom.setAttribute(
      "slopes",
      new THREE.InstancedBufferAttribute(new Float32Array(slopes), 3),
    );

    const grassMesh = new THREE.InstancedMesh(
      grassGeom,
      this.grassMaterial,
      actualCount,
    );
    grassMesh.frustumCulled = false;
    grassMesh.receiveShadow = true;
    grassMesh.castShadow = false;
    grassMesh.count = actualCount;
    grassMesh.name = `Grass_${tile.key}`;
    grassMesh.visible = true;

    const mat = grassMesh.material as THREE.ShaderMaterial;
    const texUniform = mat.uniforms.grassTexture;
    console.log(
      `[GrassSystem] Created: ${grassMesh.name}, count=${grassMesh.count}, texture=${texUniform?.value?.image ? "LOADED" : "NULL"}`,
    );

    return grassMesh;
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
