/**
 * WaterSystem.ts - Water Rendering
 *
 * Manages water plane rendering with animated normals, fresnel tint, and wave effects.
 * Based on reference implementation with depth-based effects and reflections.
 */

import THREE from "../extras/three";
import type { World } from "../types";
import type { TerrainTile } from "../types/terrain";

export class WaterSystem {
  private world: World;
  private waterNormal?: THREE.Texture;
  private waterNormalRepeat = 16;
  private waterTime = 0;

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Initialize water textures
   */
  async init(): Promise<void> {
    // Only load textures on client (server has no DOM/document)
    if (this.world.isServer) {
      return;
    }

    // Load water normal texture from local assets (async, non-blocking)
    if (!this.waterNormal) {
      const url = "/textures/waterNormal.png";
      const loader = new THREE.TextureLoader();

      // Load asynchronously to avoid blocking
      try {
        this.waterNormal = await new Promise<THREE.Texture>(
          (resolve, reject) => {
            loader.load(
              url,
              (texture) => resolve(texture),
              undefined,
              (error) => reject(error),
            );
          },
        );

        this.waterNormal.wrapS = THREE.RepeatWrapping;
        this.waterNormal.wrapT = THREE.RepeatWrapping;
        this.waterNormal.repeat.set(
          this.waterNormalRepeat,
          this.waterNormalRepeat,
        );
      } catch (error) {
        console.warn(
          "[WaterSystem] Failed to load water normal texture:",
          error,
        );
        // Continue without normal map - water will still work
      }
    }
  }

  /**
   * Generate water mesh for a tile
   */
  generateWaterMesh(
    tile: TerrainTile,
    waterThreshold: number,
    tileSize: number,
  ): THREE.Mesh {
    const waterGeometry = new THREE.PlaneGeometry(tileSize, tileSize);
    waterGeometry.rotateX(-Math.PI / 2);

    // Upgraded water material with fresnel tint and animated ripples
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e6ba8,
      metalness: 0.02,
      roughness: 0.2,
      transparent: true,
      opacity: 0.65,
    }) as THREE.MeshStandardMaterial & { userData: Record<string, unknown> };

    waterMaterial.depthWrite = false;
    waterMaterial.side = THREE.FrontSide;
    waterMaterial.envMapIntensity = 1.2;

    if (this.waterNormal) {
      waterMaterial.normalMap = this.waterNormal;
      waterMaterial.normalScale = new THREE.Vector2(0.8, 0.8);
    }

    // Water animation uniforms
    const waterUniforms = {
      uTime: { value: 0 },
      uWaveScale: { value: 0.08 },
      uWaveSpeed: { value: 0.6 },
      uDistortion: { value: 0.06 },
      uFresnelPower: { value: 5.0 },
      uShallowColor: { value: new THREE.Color(0x40b8d4) },
      uDeepColor: { value: new THREE.Color(0x0f3c5a) },
      uOpacity: { value: 0.65 },
    };
    waterMaterial.userData = waterMaterial.userData || {};
    (waterMaterial.userData as { _waterUniforms?: unknown })._waterUniforms =
      waterUniforms;

    // Inject animated ripple and fresnel shader
    waterMaterial.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, waterUniforms);

      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `#include <common>\nvarying vec3 vWorldPos;`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>\n  vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>
        uniform float uTime;
        uniform float uWaveScale;
        uniform float uWaveSpeed;
        uniform float uDistortion;
        uniform float uFresnelPower;
        uniform vec3 uShallowColor;
        uniform vec3 uDeepColor;
        uniform float uOpacity;
        varying vec3 vWorldPos;

        vec2 waveTilt(vec2 xz) {
          float t = uTime * uWaveSpeed;
          float sx = sin(xz.x * 6.2831 * uWaveScale + t);
          float cz = cos(xz.y * 6.2831 * uWaveScale * 1.3 - t * 0.85);
          return vec2(sx, cz) * uDistortion;
        }
        `,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec2 tilt = waveTilt(vWorldPos.xz);
        vec3 n = normalize(vec3(tilt.x, 1.0, tilt.y));
        float F = pow(1.0 - max(dot(n, V), 0.0), uFresnelPower);
        vec3 waterTint = mix(uDeepColor, uShallowColor, F);
        diffuseColor.rgb = mix(diffuseColor.rgb, waterTint, 0.85);
        diffuseColor.a = uOpacity;
        `,
      );
    };

    const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    waterMesh.position.y = waterThreshold;
    waterMesh.name = `Water_${tile.key}`;
    waterMesh.userData = {
      type: "water",
      walkable: false,
      clickable: false,
    };

    return waterMesh;
  }

  /**
   * Update water animation each frame
   */
  update(deltaTime: number, waterMeshes: THREE.Mesh[]): void {
    const dt =
      typeof deltaTime === "number" && isFinite(deltaTime) ? deltaTime : 1 / 60;
    this.waterTime += dt;

    // Scroll normal map
    if (this.waterNormal) {
      this.waterNormal.offset.x += 0.02 * dt;
      this.waterNormal.offset.y += 0.013 * dt;
    }

    // Update water material uniforms
    for (const waterMesh of waterMeshes) {
      const mat = waterMesh.material as THREE.Material & {
        userData?: Record<string, unknown>;
      };
      const uniforms =
        mat?.userData &&
        (
          mat.userData as {
            _waterUniforms?: Record<string, { value: unknown }>;
          }
        )._waterUniforms;
      if (uniforms && (uniforms as { uTime?: { value: number } }).uTime) {
        (uniforms as { uTime: { value: number } }).uTime.value = this.waterTime;
      }
    }
  }
}
