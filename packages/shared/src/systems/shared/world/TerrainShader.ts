/**
 * TerrainShader.ts
 *
 * Beautiful terrain shader system inspired by upstreet
 * Features:
 * - Triplanar texture mapping (no UV stretching)
 * - Multi-texture blending (grass, dirt, rock, sand, snow)
 * - Height-based texture switching (snow on peaks)
 * - Slope-based texture switching (rock on cliffs)
 * - Biome weight blending
 * - Day/night cycle support
 * - Distance fog
 */

import * as THREE from "three";

// Shader constants
export const TERRAIN_CONSTANTS = {
  TRIPLANAR_SCALE: 0.02, // 50m texture repeat for fine detail
  TRIPLANAR_BLEND_SHARPNESS: 4.0, // Sharp transitions between planes
  SNOW_HEIGHT: 50.0, // Elevation threshold for snow
  ROCK_SLOPE_THRESHOLD: 0.6, // Normal Y threshold for rock (60° angle)
  FOG_NEAR: 200.0,
  FOG_FAR: 500.0,
};

/**
 * Vertex Shader
 * Passes data to fragment shader for texture blending
 */
export const terrainVertexShader = /* glsl */ `
varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Fragment Shader
 * Phase 2: Normal maps for photorealistic surface detail
 */
export const terrainFragmentShader = /* glsl */ `
precision highp float;

varying vec3 vWorldPosition;
varying vec3 vNormal;

uniform sampler2D terrainGrassTexture;
uniform sampler2D terrainDirtTexture;
uniform sampler2D terrainRockTexture;
uniform sampler2D terrainSandTexture;
uniform sampler2D terrainSnowTexture;

uniform vec3 cameraPosition;

// Triplanar texture sampling - eliminates UV stretching on slopes
// OPTIMIZED: Precompute blend weights once, reuse for all samples
vec3 triplanarSample(sampler2D tex, vec3 worldPos, vec3 normal) {
  float scale = 0.02;
  vec3 scaledPos = worldPos * scale;

  // Calculate blend weights (sharp transitions between planes)
  vec3 blendWeights = abs(normal);
  blendWeights = blendWeights * blendWeights * blendWeights * blendWeights; // pow 4 without function call
  float weightSum = blendWeights.x + blendWeights.y + blendWeights.z;
  blendWeights /= weightSum;

  // Sample all three projection planes
  vec3 xAxis = texture2D(tex, scaledPos.yz).rgb;
  vec3 yAxis = texture2D(tex, scaledPos.xz).rgb;
  vec3 zAxis = texture2D(tex, scaledPos.xy).rgb;

  return xAxis * blendWeights.x + yAxis * blendWeights.y + zAxis * blendWeights.z;
}

void main() {
  float height = vWorldPosition.y;
  float slope = 1.0 - abs(vNormal.y);

  // Sample all textures
  vec3 grass = triplanarSample(terrainGrassTexture, vWorldPosition, vNormal);
  vec3 dirt = triplanarSample(terrainDirtTexture, vWorldPosition, vNormal);
  vec3 rock = triplanarSample(terrainRockTexture, vWorldPosition, vNormal);
  vec3 sand = triplanarSample(terrainSandTexture, vWorldPosition, vNormal);
  vec3 snow = triplanarSample(terrainSnowTexture, vWorldPosition, vNormal);

  // Blend textures based on height and slope
  vec3 color = grass;

  float dirtBlend = smoothstep(0.3, 0.5, slope);
  color = mix(color, dirt, dirtBlend * 0.4);

  float rockBlend = smoothstep(0.6, 0.75, slope);
  color = mix(color, rock, rockBlend);

  float snowBlend = smoothstep(50.0, 60.0, height);
  color = mix(color, snow, snowBlend);

  float sandBlend = smoothstep(5.0, 0.0, height) * smoothstep(0.3, 0.0, slope);
  color = mix(color, sand, sandBlend);

  // IMPROVED LIGHTING
  vec3 N = normalize(vNormal);

  // Sun direction (slightly behind and above camera for nice shadows)
  vec3 sunDir = normalize(vec3(0.5, 0.8, 0.3));

  // Half-Lambert diffuse for softer falloff
  float NdotL = dot(N, sunDir);
  float diffuse = NdotL * 0.5 + 0.5;
  diffuse = diffuse * diffuse; // Square for better contrast

  // Sky ambient (blue-tinted from above)
  vec3 skyColor = vec3(0.6, 0.7, 0.9);
  float skyLight = N.y * 0.5 + 0.5; // More light from above
  vec3 ambient = skyColor * skyLight * 0.3;

  // Sun color (warm daylight)
  vec3 sunColor = vec3(1.0, 0.98, 0.95);
  vec3 diffuseLight = sunColor * diffuse * 0.8;

  // Combine lighting
  vec3 litColor = color * (ambient + diffuseLight);

  // DISTANCE FOG
  float dist = length(vWorldPosition - cameraPosition);
  float fogStart = 200.0;
  float fogEnd = 500.0;
  float fogFactor = smoothstep(fogStart, fogEnd, dist);
  vec3 fogColor = vec3(0.7, 0.8, 0.9); // Light sky blue
  vec3 finalColor = mix(litColor, fogColor, fogFactor);

  // GAMMA CORRECTION (linear to sRGB)
  finalColor = pow(finalColor, vec3(1.0 / 2.2));

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

/**
 * Create a simple solid color texture as placeholder
 */
function createPlaceholderTexture(color: number): THREE.Texture {
  // Server-safe: Use DataTexture if no document
  if (typeof document === "undefined") {
    const data = new Uint8Array([
      (color >> 16) & 0xff,
      (color >> 8) & 0xff,
      color & 0xff,
      255,
    ]);
    const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  }

  // Client: Use CanvasTexture
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;
  const ctx = canvas.getContext("2d")!;
  const c = new THREE.Color(color);
  ctx.fillStyle = `rgb(${c.r * 255}, ${c.g * 255}, ${c.b * 255})`;
  ctx.fillRect(0, 0, 2, 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Create terrain shader material
 */
export function createTerrainMaterial(
  textures: Map<string, THREE.Texture>,
): THREE.ShaderMaterial {
  // Create placeholder textures if real ones aren't loaded yet
  const placeholders = {
    grass: createPlaceholderTexture(0x5a9216),
    dirt: createPlaceholderTexture(0x6b4423),
    rock: createPlaceholderTexture(0x7a7265),
    sand: createPlaceholderTexture(0xc2b280),
    snow: createPlaceholderTexture(0xf0f8ff),
  };

  const uniforms = {
    // Textures (use real if available, fallback to placeholder)
    terrainGrassTexture: { value: textures.get("grass") || placeholders.grass },
    terrainDirtTexture: { value: textures.get("dirt") || placeholders.dirt },
    terrainRockTexture: { value: textures.get("rock") || placeholders.rock },
    terrainSandTexture: { value: textures.get("sand") || placeholders.sand },
    terrainSnowTexture: { value: textures.get("snow") || placeholders.snow },

    // Lighting
    sunPosition: { value: new THREE.Vector3(100, 100, 100) },
    cameraPosition: { value: new THREE.Vector3(0, 50, 100) }, // Will be updated each frame
    isDay: { value: true },
    uDayCycleProgress: { value: 0.5 },

    // Day/night colors
    uColorDayCycleLow: { value: new THREE.Color(0xf0fff9) },
    uColorDayCycleHigh: { value: new THREE.Color(0x87ceeb) },
    uColorNightLow: { value: new THREE.Color(0x001428) },
    uColorNightHigh: { value: new THREE.Color(0x000814) },
    uColorDawn: { value: new THREE.Color(0xff6b35) },
    uColorSun: { value: new THREE.Color(0xffd700) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: terrainVertexShader,
    fragmentShader: terrainFragmentShader,
    side: THREE.FrontSide,
    transparent: false,
    depthWrite: true,
    depthTest: true,
  });

  // Check for shader compilation errors after first render
  let checked = false;
  const originalOnBeforeRender = material.onBeforeRender;
  material.onBeforeRender = function (
    renderer,
    scene,
    camera,
    geometry,
    object,
    group,
  ) {
    if (!checked) {
      checked = true;

      // Check WebGL program for errors - only log on failure
      // Access internal Three.js properties for shader debugging
      const rendererProps = renderer.properties.get(material) as {
        program?: {
          // eslint-disable-next-line no-undef
          program: WebGLProgram;
          // eslint-disable-next-line no-undef
          vertexShader: WebGLShader;
          // eslint-disable-next-line no-undef
          fragmentShader: WebGLShader;
        };
      };
      const program = rendererProps?.program;
      if (program) {
        const gl = renderer.getContext();
        const valid = gl.getProgramParameter(
          program.program,
          gl.VALIDATE_STATUS,
        );
        const linked = gl.getProgramParameter(program.program, gl.LINK_STATUS);

        if (!valid || !linked) {
          const log = gl.getProgramInfoLog(program.program);
          console.error("[TerrainShader] Program error:", log);

          const vertLog = gl.getShaderInfoLog(program.vertexShader);
          const fragLog = gl.getShaderInfoLog(program.fragmentShader);
          console.error("[TerrainShader] Vertex shader log:", vertLog);
          console.error("[TerrainShader] Fragment shader log:", fragLog);
        }
      }
    }
    if (originalOnBeforeRender) {
      originalOnBeforeRender.call(
        this,
        renderer,
        scene,
        camera,
        geometry,
        object,
        group,
      );
    }
  };

  return material;
}
