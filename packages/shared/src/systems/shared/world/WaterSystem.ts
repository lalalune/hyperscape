/**
 * WaterSystem.ts - Water Rendering
 *
 * Manages water plane rendering with animated normals, fresnel tint, and wave effects.
 * Based on reference implementation with depth-based effects and reflections.
 */

import THREE from "../../../extras/three/three";
import type { World } from "../../../types";
import type { TerrainTile } from "../../../types/world/terrain";

export class WaterSystem {
  private world: World;
  private waterNormal?: THREE.Texture;
  private waterNormalRepeat = 16;
  private waterTime = 0;
  private sharedMaterial?: THREE.MeshStandardMaterial;
  private waterUniforms = {
    uTime: { value: 0 },
    uWaveScale: { value: 0.08 },
    uWaveSpeed: { value: 0.6 },
    uDistortion: { value: 0.06 },
    uFresnelPower: { value: 4.0 },
    uShallowColor: { value: new THREE.Color(0x4ec5d4) },
    uDeepColor: { value: new THREE.Color(0x0a3050) },
    uOpacity: { value: 0.75 },
    // Shore foam
    uFoamColor: { value: new THREE.Color(0xffffff) },
    uFoamScale: { value: 15.0 },
    uFoamIntensity: { value: 0.6 },
    // Caustics
    uCausticsScale: { value: 8.0 },
    uCausticsSpeed: { value: 0.8 },
    uCausticsIntensity: { value: 0.15 },
    // Specular
    uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
    uSpecularPower: { value: 64.0 },
    uSpecularIntensity: { value: 0.8 },
  };

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Initialize water textures and shared material
   */
  async init(): Promise<void> {
    // Only load textures on client (server has no DOM/document)
    if (this.world.isServer) {
      return;
    }

    // Load water normal texture from local assets
    if (!this.waterNormal) {
      const url = "/textures/waterNormal.png";
      const loader = new THREE.TextureLoader();

      this.waterNormal = await loader.loadAsync(url);
      this.waterNormal.wrapS = THREE.RepeatWrapping;
      this.waterNormal.wrapT = THREE.RepeatWrapping;
      this.waterNormal.repeat.set(
        this.waterNormalRepeat,
        this.waterNormalRepeat,
      );
    }

    // Create shared material once
    this.sharedMaterial = this.createWaterMaterial();
  }

  /**
   * Generate water mesh for a tile - only covers underwater areas
   * Water geometry is shaped to match actual underwater terrain, not a full rectangle
   *
   * @param tile - The terrain tile
   * @param waterThreshold - Height below which is considered underwater
   * @param tileSize - Size of the tile in world units
   * @param getHeightAt - Function to get terrain height at world coordinates
   */
  generateWaterMesh(
    tile: TerrainTile,
    waterThreshold: number,
    tileSize: number,
    getHeightAt?: (worldX: number, worldZ: number) => number,
  ): THREE.Mesh | null {
    // If no height function provided, fall back to full plane (legacy behavior)
    if (!getHeightAt) {
      const waterGeometry = new THREE.PlaneGeometry(tileSize, tileSize);
      waterGeometry.rotateX(-Math.PI / 2);
      return this.createWaterMeshWithMaterial(
        waterGeometry,
        tile,
        waterThreshold,
      );
    }

    // Create shaped water geometry that only covers underwater areas
    const resolution = 32; // Grid resolution for water mesh
    const _cellSize = tileSize / resolution;
    const tileOriginX = tile.x * tileSize;
    const tileOriginZ = tile.z * tileSize;

    // Sample terrain heights across the tile
    const heightGrid: number[][] = [];
    for (let i = 0; i <= resolution; i++) {
      heightGrid[i] = [];
      for (let j = 0; j <= resolution; j++) {
        const localX = (i / resolution - 0.5) * tileSize;
        const localZ = (j / resolution - 0.5) * tileSize;
        const worldX = tileOriginX + localX;
        const worldZ = tileOriginZ + localZ;
        heightGrid[i][j] = getHeightAt(worldX, worldZ);
      }
    }

    // Build geometry - only include quads where at least one corner is underwater
    // This provides natural "wiggle room" at shorelines
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const vertexMap = new Map<string, number>();
    let vertexIndex = 0;

    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        // Check all 4 corners of this quad
        const h00 = heightGrid[i][j];
        const h10 = heightGrid[i + 1][j];
        const h01 = heightGrid[i][j + 1];
        const h11 = heightGrid[i + 1][j + 1];

        // Include this quad if ANY corner is underwater (provides shoreline wiggle room)
        const anyUnderwater =
          h00 < waterThreshold ||
          h10 < waterThreshold ||
          h01 < waterThreshold ||
          h11 < waterThreshold;

        if (!anyUnderwater) continue;

        // Add vertices for this quad's corners (if not already added)
        const corners = [
          [i, j],
          [i + 1, j],
          [i, j + 1],
          [i + 1, j + 1],
        ];
        const quadIndices: number[] = [];

        for (const [ci, cj] of corners) {
          const key = `${ci},${cj}`;
          if (!vertexMap.has(key)) {
            const localX = (ci / resolution - 0.5) * tileSize;
            const localZ = (cj / resolution - 0.5) * tileSize;

            // Water surface is flat at waterThreshold height
            vertices.push(localX, 0, localZ); // Y will be set by mesh position
            uvs.push(ci / resolution, cj / resolution);
            vertexMap.set(key, vertexIndex++);
          }
          quadIndices.push(vertexMap.get(key)!);
        }

        // Add two triangles for this quad (0,1,2) and (1,3,2)
        indices.push(quadIndices[0], quadIndices[2], quadIndices[1]);
        indices.push(quadIndices[1], quadIndices[2], quadIndices[3]);
      }
    }

    // No underwater areas found
    if (vertices.length === 0) {
      return null;
    }

    // Create buffer geometry
    const waterGeometry = new THREE.BufferGeometry();
    waterGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    waterGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    waterGeometry.setIndex(indices);
    waterGeometry.computeVertexNormals();

    return this.createWaterMeshWithMaterial(
      waterGeometry,
      tile,
      waterThreshold,
    );
  }

  /**
   * Create shared water material with shader (only created once)
   */
  private createWaterMaterial(): THREE.MeshStandardMaterial {
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e6ba8,
      metalness: 0.02,
      roughness: 0.2,
      transparent: true,
      opacity: 0.65,
    });

    waterMaterial.depthWrite = false;
    waterMaterial.side = THREE.FrontSide;
    waterMaterial.envMapIntensity = 1.2;

    if (this.waterNormal) {
      waterMaterial.normalMap = this.waterNormal;
      waterMaterial.normalScale = new THREE.Vector2(0.8, 0.8);
    }

    // Store reference to shared uniforms
    waterMaterial.userData = { _waterUniforms: this.waterUniforms };

    // Inject animated ripple, fresnel, foam, and caustics shader
    waterMaterial.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.waterUniforms);

      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `#include <common>
        varying vec3 vWorldPos;
        varying vec2 vScreenUV;`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
        vScreenUV = clipPos.xy / clipPos.w * 0.5 + 0.5;`,
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
        uniform vec3 uFoamColor;
        uniform float uFoamScale;
        uniform float uFoamIntensity;
        uniform float uCausticsScale;
        uniform float uCausticsSpeed;
        uniform float uCausticsIntensity;
        uniform vec3 uSunDirection;
        uniform float uSpecularPower;
        uniform float uSpecularIntensity;
        
        varying vec3 vWorldPos;
        varying vec2 vScreenUV;

        // Gerstner wave for more realistic motion
        vec2 waveTilt(vec2 xz) {
          float t = uTime * uWaveSpeed;
          
          // Multiple wave frequencies for natural look
          float w1 = sin(xz.x * 6.2831 * uWaveScale + t);
          float w2 = sin(xz.y * 6.2831 * uWaveScale * 1.3 - t * 0.85);
          float w3 = sin((xz.x + xz.y) * 4.0 * uWaveScale + t * 1.2) * 0.5;
          float w4 = cos((xz.x - xz.y) * 3.0 * uWaveScale - t * 0.7) * 0.3;
          
          return vec2(w1 + w3, w2 + w4) * uDistortion;
        }
        
        // Shore foam pattern
        float foamPattern(vec2 uv, float time) {
          vec2 fuv = uv * uFoamScale;
          
          // Animated noise-like pattern
          float foam1 = sin(fuv.x * 3.0 + time * 2.0) * sin(fuv.y * 2.5 - time * 1.5);
          float foam2 = sin(fuv.x * 5.0 - time * 1.8) * sin(fuv.y * 4.0 + time * 2.2);
          float foam3 = sin((fuv.x + fuv.y) * 2.0 + time * 1.2) * 0.5;
          
          float foam = (foam1 + foam2 + foam3) * 0.33 + 0.5;
          return smoothstep(0.4, 0.8, foam);
        }
        
        // Underwater caustics
        float caustics(vec2 uv, float time) {
          vec2 cuv = uv * uCausticsScale;
          float t = time * uCausticsSpeed;
          
          float c1 = sin(cuv.x * 3.0 + t) * sin(cuv.y * 3.0 + t * 0.7);
          float c2 = sin(cuv.x * 4.0 - t * 0.8) * sin(cuv.y * 4.0 - t * 1.1);
          float c3 = sin((cuv.x + cuv.y) * 2.5 + t * 0.5);
          
          return (c1 + c2 + c3) * 0.33 * 0.5 + 0.5;
        }
        `,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec2 tilt = waveTilt(vWorldPos.xz);
        vec3 n = normalize(vec3(tilt.x, 1.0, tilt.y));
        
        // Fresnel reflection
        float NdotV = max(dot(n, V), 0.0);
        float F = pow(1.0 - NdotV, uFresnelPower);
        
        // Base water color with fresnel
        vec3 waterTint = mix(uDeepColor, uShallowColor, F);
        
        // Add caustics (subtle underwater light patterns)
        float causticsValue = caustics(vWorldPos.xz, uTime);
        waterTint += vec3(causticsValue) * uCausticsIntensity;
        
        // Shore foam (based on screen position and wave height)
        float foamValue = foamPattern(vWorldPos.xz, uTime);
        float foamMask = smoothstep(0.3, 0.7, foamValue);
        waterTint = mix(waterTint, uFoamColor, foamMask * uFoamIntensity * (1.0 - NdotV));
        
        // Specular highlight (sun reflection)
        vec3 H = normalize(uSunDirection + V);
        float spec = pow(max(dot(n, H), 0.0), uSpecularPower);
        waterTint += vec3(1.0, 0.95, 0.85) * spec * uSpecularIntensity;
        
        diffuseColor.rgb = mix(diffuseColor.rgb, waterTint, 0.9);
        diffuseColor.a = uOpacity + F * 0.2; // More opaque at grazing angles
        `,
      );
    };

    return waterMaterial;
  }

  /**
   * Create the water mesh using shared material
   */
  private createWaterMeshWithMaterial(
    waterGeometry: THREE.BufferGeometry,
    tile: TerrainTile,
    waterThreshold: number,
  ): THREE.Mesh {
    // Use shared material - only create if not yet initialized
    if (!this.sharedMaterial) {
      this.sharedMaterial = this.createWaterMaterial();
    }

    const waterMesh = new THREE.Mesh(waterGeometry, this.sharedMaterial);
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
   * Since we use a shared material, we only need to update the uniforms once
   */
  update(deltaTime: number, _waterMeshes: THREE.Mesh[]): void {
    const dt =
      typeof deltaTime === "number" && isFinite(deltaTime) ? deltaTime : 1 / 60;
    this.waterTime += dt;

    // Update shared uniforms (affects all water meshes using this material)
    this.waterUniforms.uTime.value = this.waterTime;

    // Scroll normal map
    if (this.waterNormal) {
      this.waterNormal.offset.x += 0.02 * dt;
      this.waterNormal.offset.y += 0.013 * dt;
    }
  }

  /**
   * Clean up water resources
   */
  dispose(): void {
    if (this.waterNormal) {
      this.waterNormal.dispose();
      this.waterNormal = undefined;
    }
    if (this.sharedMaterial) {
      this.sharedMaterial.dispose();
      this.sharedMaterial = undefined;
    }
    this.waterTime = 0;
  }
}
