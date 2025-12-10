import THREE from "../extras/three/three";

/**
 * TriplanarTerrainMaterial - Blended terrain material with normal mapping
 *
 * Features:
 * - 4-way material blending (grass, dirt, rock, snow)
 * - Tiling-free texture sampling to avoid repeating patterns
 * - Normal map support for surface detail
 * - Basic directional lighting
 * - Planar XZ projection (optimized for terrain)
 */
export class TriplanarTerrainMaterial extends THREE.ShaderMaterial {
  constructor(
    diffuseAtlas: THREE.Texture,
    normalAtlas: THREE.Texture,
    noiseTexture: THREE.Texture,
    textureScales: number[],
  ) {
    super({
      uniforms: {
        uDiffMap: { value: diffuseAtlas },
        uNormalMap: { value: normalAtlas },
        uNoiseTexture: { value: noiseTexture },
        uTextureScales: { value: textureScales },
        // Lighting uniforms
        uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
        uSunColor: { value: new THREE.Color(1.0, 0.98, 0.9) },
        uAmbientColor: { value: new THREE.Color(0.15, 0.18, 0.25) },
        uNormalStrength: { value: 0.8 },
      },
      vertexShader: /* glsl */ `
        attribute ivec4 materials;
        attribute vec4 materialsWeights;
        
        flat varying ivec4 vMaterials;
        varying vec4 vMaterialsWeights;
        varying vec3 vPosition;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec3 vWorldNormal;
        
        void main() {
          vMaterials = materials;
          vMaterialsWeights = materialsWeights;
          vPosition = position;
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          vNormal = normal;
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        precision highp int;
        
        uniform sampler2D uDiffMap;
        uniform sampler2D uNormalMap;
        uniform sampler2D uNoiseTexture;
        uniform float uTextureScales[4];
        uniform vec3 uSunDirection;
        uniform vec3 uSunColor;
        uniform vec3 uAmbientColor;
        uniform float uNormalStrength;
        
        flat varying ivec4 vMaterials;
        varying vec4 vMaterialsWeights;
        varying vec3 vPosition;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec3 vWorldNormal;
        
        const float TEXTURE_SCALE = 40.0;
        const float TEXTURE_PER_ROW = 2.0;
        const float TEXTURE_SIZE = 0.5;
        
        vec2 getSubTextureOffset(int textureIndex) {
          float ax = mod(float(textureIndex), TEXTURE_PER_ROW);
          float ay = floor(float(textureIndex) / TEXTURE_PER_ROW);
          return vec2(ax, ay) * TEXTURE_SIZE;
        }
        
        vec4 subTexture2D(sampler2D tex, vec2 tileUv, vec2 textureOffset) {
          vec2 subUv = fract(tileUv) * TEXTURE_SIZE + textureOffset;
          return texture2D(tex, subUv);
        }
        
        // OPTIMIZED: Simplified stochastic sampling - single sample with noise offset
        // Reduces texture samples by 50% vs original dual-sample blend
        vec4 textureNoTile(sampler2D tex, int textureIndex, vec2 inputUv, float noiseVal) {
          float UV_SCALE = uTextureScales[textureIndex];
          vec2 uv = inputUv * (1.0 / UV_SCALE);
          
          // Use pre-sampled noise for offset (avoids per-material noise lookup)
          float l = noiseVal * 8.0;
          float ia = floor(l + 0.5);
          vec2 offset = fract(sin(vec2(ia * 30.0, ia * 7.0)) * 103.0);
          
          vec2 textureOffset = getSubTextureOffset(textureIndex);
          return subTexture2D(tex, uv + offset, textureOffset);
        }
        
        // OPTIMIZED: Skip zero-weight materials to reduce texture samples
        // Most fragments only use 1-2 materials, saving 50-75% samples
        vec4 blendMaterials(sampler2D tex, vec2 uv, float noiseVal) {
          vec4 result = vec4(0.0);
          float weightSum = 0.0;
          
          // Only sample materials with significant weight (>1%)
          if(vMaterialsWeights.x > 0.01) {
            result += textureNoTile(tex, vMaterials.x, uv, noiseVal) * vMaterialsWeights.x;
            weightSum += vMaterialsWeights.x;
          }
          if(vMaterialsWeights.y > 0.01) {
            result += textureNoTile(tex, vMaterials.y, uv, noiseVal) * vMaterialsWeights.y;
            weightSum += vMaterialsWeights.y;
          }
          if(vMaterialsWeights.z > 0.01) {
            result += textureNoTile(tex, vMaterials.z, uv, noiseVal) * vMaterialsWeights.z;
            weightSum += vMaterialsWeights.z;
          }
          if(vMaterialsWeights.w > 0.01) {
            result += textureNoTile(tex, vMaterials.w, uv, noiseVal) * vMaterialsWeights.w;
            weightSum += vMaterialsWeights.w;
          }
          
          return weightSum > 0.001 ? result / weightSum : result;
        }
        
        // Convert normal map sample to world-space normal
        vec3 perturbNormal(vec3 normalMapSample, vec3 surfaceNormal) {
          // Unpack from [0,1] to [-1,1]
          vec3 mapNormal = normalMapSample * 2.0 - 1.0;
          mapNormal.xy *= uNormalStrength;
          
          // Build TBN matrix from surface normal (terrain is roughly Y-up)
          vec3 up = abs(surfaceNormal.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
          vec3 tangent = normalize(cross(up, surfaceNormal));
          vec3 bitangent = cross(surfaceNormal, tangent);
          
          mat3 TBN = mat3(tangent, bitangent, surfaceNormal);
          return normalize(TBN * mapNormal);
        }
        
        void main() {
          vec2 textureUv = vPosition.xz * (1.0 / TEXTURE_SCALE);
          
          // OPTIMIZED: Sample noise once and reuse for all materials
          float noiseVal = texture2D(uNoiseTexture, 0.0025 * textureUv).x;
          
          // Sample diffuse and normal maps with shared noise
          vec4 diffMapColor = blendMaterials(uDiffMap, textureUv, noiseVal);
          vec4 normalMapSample = blendMaterials(uNormalMap, textureUv, noiseVal);
          
          // Calculate perturbed normal
          vec3 normal = perturbNormal(normalMapSample.rgb, normalize(vWorldNormal));
          
          // Simple directional lighting
          float NdotL = max(dot(normal, uSunDirection), 0.0);
          vec3 diffuse = diffMapColor.rgb * uSunColor * NdotL;
          vec3 ambient = diffMapColor.rgb * uAmbientColor;
          
          // Final color with basic lighting
          vec3 finalColor = ambient + diffuse;
          
          // Apply gamma correction
          finalColor = pow(finalColor, vec3(1.0 / 2.2));
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      side: THREE.FrontSide,
      transparent: false,
      depthWrite: true,
      depthTest: true,
    });
  }

  /**
   * Update sun direction for lighting
   */
  setSunDirection(direction: THREE.Vector3): void {
    (this.uniforms.uSunDirection as { value: THREE.Vector3 }).value.copy(
      direction.normalize()
    );
  }

  /**
   * Update sun color
   */
  setSunColor(color: THREE.Color): void {
    (this.uniforms.uSunColor as { value: THREE.Color }).value.copy(color);
  }

  /**
   * Update ambient light color
   */
  setAmbientColor(color: THREE.Color): void {
    (this.uniforms.uAmbientColor as { value: THREE.Color }).value.copy(color);
  }

  /**
   * Set normal map strength (0-1)
   */
  setNormalStrength(strength: number): void {
    (this.uniforms.uNormalStrength as { value: number }).value = Math.max(
      0,
      Math.min(1, strength)
    );
  }
}
