/**
 * SkySystem.ts - Advanced Dynamic Sky, Sun/Moon and Clouds
 *
 * Creates a dynamic skydome with day/night cycle, sun/moon visuals,
 * and layered billboard clouds using InstancedMesh.
 *
 * Fully WebGPU-compatible using TSL (Three Shading Language) Node Materials.
 * All materials use MeshBasicNodeMaterial with TSL color nodes.
 * No WebGL-specific extensions or shaders are used.
 */

import { System } from "../infrastructure/System";
import * as THREE from "../../../extras/three/three";
import {
  abs,
  add,
  clamp,
  cos,
  dot,
  float,
  Fn,
  length,
  MeshBasicNodeMaterial,
  mix,
  mul,
  normalize,
  positionLocal,
  pow,
  smoothstep,
  sub,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
  type ShaderNode,
} from "../../../extras/three/three";
import type { World, WorldOptions } from "../../../types";

// -----------------------------
// Utility: Procedural noise textures (avoids external deps)
// -----------------------------
function createNoiseTexture(size = 128): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = Math.floor(Math.random() * 255);
    const o = i * 4;
    data[o] = v;
    data[o + 1] = Math.floor(Math.random() * 255);
    data[o + 2] = Math.floor(Math.random() * 255);
    data[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

// -----------------------------
// Cloud configuration with texture atlas sampling
// The cloud textures are 2x4 sprite sheets (8 clouds per texture)
// UV offset selects which cloud sprite to use
// PERFORMANCE: Reduced from 6 to 4 clouds (barely noticeable, saves draw calls + GPU)
// -----------------------------
type CloudDef = {
  az: number; // azimuth in degrees
  el: number; // elevation in degrees
  tex: number; // which texture (1-4)
  sprite: number; // which sprite in atlas (0-7)
  scale: number; // size multiplier
};

const CLOUD_DEFS: CloudDef[] = [
  { az: 30, el: 25, tex: 1, sprite: 0, scale: 1.3 },
  { az: 120, el: 32, tex: 2, sprite: 2, scale: 1.1 },
  { az: 210, el: 28, tex: 1, sprite: 4, scale: 1.4 },
  { az: 300, el: 35, tex: 2, sprite: 5, scale: 1.0 },
];

// -----------------------------
// Sky System Uniforms Type
// -----------------------------
export type SkyUniforms = {
  time: { value: number };
  sunPosition: { value: THREE.Vector3 };
  dayCycleProgress: { value: number };
};

// TSL uniform reference type (for runtime updates)
type TSLUniformFloat = { value: number };
type TSLUniformVec3 = { value: THREE.Vector3 };

// Material uniform storage types
type SkyMaterialUniforms = {
  uTime: TSLUniformFloat;
  uSunPosition: TSLUniformVec3;
  uDayCycleProgress: TSLUniformFloat;
  uDayIntensity: TSLUniformFloat; // Pre-calculated sharp transition value
};

type CloudMaterialUniforms = {
  uTime: TSLUniformFloat;
  uSunPosition: TSLUniformVec3;
  uDayIntensity: TSLUniformFloat;
};

type SunMaterialUniforms = {
  uOpacity: TSLUniformFloat;
};

type MoonMaterialUniforms = {
  uOpacity: TSLUniformFloat;
};

// -----------------------------
// SkySystem
// -----------------------------
export class SkySystem extends System {
  private scene: THREE.Scene | null = null;
  private group: THREE.Group | null = null;
  private skyMesh: THREE.Mesh | null = null;
  private clouds: THREE.InstancedMesh | null = null;
  private moon: THREE.Mesh | null = null;
  private moonGlow: THREE.Mesh | null = null;
  private sun: THREE.Mesh | null = null;
  private sunGlow: THREE.Mesh | null = null;

  private galaxyTex: THREE.Texture | null = null;
  private cloud1: THREE.Texture | null = null;
  private cloud2: THREE.Texture | null = null;
  private cloud3: THREE.Texture | null = null;
  private cloud4: THREE.Texture | null = null;
  private moonTex: THREE.Texture | null = null;
  private starTex: THREE.Texture | null = null;
  private noiseA!: THREE.Texture;
  private noiseB!: THREE.Texture;

  // Legacy uniforms (for compatibility)
  private skyUniforms: SkyUniforms;

  // TSL material uniforms for runtime updates - stored at class level like WaterSystem
  private sunMaterialUniforms: SunMaterialUniforms | null = null;
  private moonMaterialUniforms: MoonMaterialUniforms | null = null;
  private skyTSLUniforms: SkyMaterialUniforms | null = null;
  private cloudMaterialUniforms: CloudMaterialUniforms | null = null;

  // Texture uniform for stars - must be stored at class level for proper updates
  private galaxyTextureUniform: { value: THREE.Texture | null } | null = null;

  private elapsed = 0;
  private dayDurationSec = 240; // full day cycle in seconds
  // Pre-allocated vector for sun direction to avoid per-frame allocation
  private _sunDir = new THREE.Vector3();
  private _dayPhase = 0;
  private _dayIntensity = 1;

  constructor(world: World) {
    super(world);
    this.skyUniforms = {
      time: { value: 0 },
      sunPosition: { value: new THREE.Vector3(0, 1, 0) },
      dayCycleProgress: { value: 0 },
    };
  }

  // =====================
  // Public getters for lighting synchronization
  // =====================

  /** Current sun direction vector (normalized) */
  get sunDirection(): THREE.Vector3 {
    return this._sunDir;
  }

  /** Day phase 0-1 (0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset) */
  get dayPhase(): number {
    return this._dayPhase;
  }

  /** Day intensity 0-1 (0 = full night, 1 = full day) - smooth cosine curve */
  get dayIntensity(): number {
    return this._dayIntensity;
  }

  /** Whether it's currently daytime (sun above horizon) */
  get isDay(): boolean {
    // Sun is above horizon from dayPhase 0.25 (sunrise) to 0.75 (sunset)
    return this._dayPhase >= 0.25 && this._dayPhase < 0.75;
  }

  /** Moon direction vector (opposite of sun) */
  get moonDirection(): THREE.Vector3 {
    return this._sunDir.clone().negate();
  }

  override getDependencies() {
    return { required: ["stage"] };
  }

  async init(_options?: WorldOptions): Promise<void> {
    // Client-only texture loading
    if (!this.world.isClient || typeof window === "undefined") {
      return;
    }

    this.noiseA = createNoiseTexture(128);
    this.noiseB = createNoiseTexture(128);

    const loadTex = (url: string): Promise<THREE.Texture> => {
      return new Promise((resolve, reject) => {
        const loader = new THREE.TextureLoader();
        loader.load(
          url,
          (t) => {
            const shouldRepeat = /noise|star|galaxy/.test(url);
            t.wrapS = shouldRepeat
              ? THREE.RepeatWrapping
              : THREE.ClampToEdgeWrapping;
            t.wrapT = shouldRepeat
              ? THREE.RepeatWrapping
              : THREE.ClampToEdgeWrapping;
            t.colorSpace = THREE.SRGBColorSpace;
            resolve(t);
          },
          undefined,
          (e) => reject(e),
        );
      });
    };

    const results = await Promise.allSettled([
      loadTex("/textures/cloud1.png"),
      loadTex("/textures/cloud2.png"),
      loadTex("/textures/cloud3.png"),
      loadTex("/textures/cloud4.png"),
      loadTex("/textures/galaxy.png"),
      loadTex("/textures/moon2.png"),
      loadTex("/textures/star3.png"),
      loadTex("/textures/noise.png"),
      loadTex("/textures/noise2.png"),
    ]);

    // Extract successful loads
    const getResult = (index: number): THREE.Texture | null => {
      const result = results[index];
      return result.status === "fulfilled" ? result.value : null;
    };

    this.cloud1 = getResult(0);
    this.cloud2 = getResult(1);
    this.cloud3 = getResult(2);
    this.cloud4 = getResult(3);
    this.galaxyTex = getResult(4);
    this.moonTex = getResult(5);
    this.starTex = getResult(6);
    const n1 = getResult(7);
    const n2 = getResult(8);
    if (n1) this.noiseA = n1;
    if (n2) this.noiseB = n2;
  }

  start(): void {
    if (!this.world.isClient || typeof window === "undefined") return;
    if (!this.world.stage?.scene) return;
    this.scene = this.world.stage.scene as THREE.Scene;

    // Root group
    this.group = new THREE.Group();
    this.group.name = "SkySystemGroup";

    // PERFORMANCE: Set sky group to layer 1 (main camera only, not minimap)
    // Minimap only renders terrain - sky dome, sun, moon, clouds are excluded
    this.group.layers.set(1);

    this.scene.add(this.group);

    // Create sky dome with TSL Node Material
    this.createSkyDome();

    // Create sun with TSL Node Material
    this.createSun();

    // Create moon with TSL Node Material
    this.createMoon();

    // Clouds (instanced billboards)
    this.createClouds();
  }

  /**
   * Create sun mesh with TSL Node Material (WebGPU-compatible)
   * HDR-style intense sun with multi-layer glow for bloom-like effect
   */
  private createSun(): void {
    if (!this.group) return;

    // Sun disc geometry - bright core (scaled for 600 far plane)
    // Sun disc sized to fit within 600 far plane
    const sunGeom = new THREE.CircleGeometry(15, 32);

    // TSL uniform for opacity control
    const uOpacity = uniform(float(1.0));

    // TSL sun color node - HDR bright sun (values > 1 for bloom effect)
    const sunColorNode = Fn(() => {
      const uvCoord = uv();
      // Distance from center for gradient
      const center = vec3(0.5, 0.5, 0.0);
      const uvPos = vec3(uvCoord.x, uvCoord.y, float(0.0));
      const dist = length(sub(uvPos, center));
      const normalizedDist = mul(dist, float(2.0));

      // Bright core with soft edge
      const coreFalloff = clamp(
        sub(float(1.0), normalizedDist),
        float(0.0),
        float(1.0),
      );
      const coreStrength = pow(coreFalloff, float(0.3)); // Very soft falloff

      // HDR sun color - values > 1 for bloom
      const sunColor = vec3(3.0, 2.4, 1.8); // HDR bright warm white
      return vec4(mul(sunColor, coreStrength), mul(coreStrength, uOpacity));
    })();

    // Create Node Material for sun
    const sunMat = new MeshBasicNodeMaterial();
    sunMat.colorNode = sunColorNode;
    sunMat.blending = THREE.AdditiveBlending;
    sunMat.depthWrite = false;
    sunMat.depthTest = true; // Terrain occludes sun (renders behind terrain)
    sunMat.transparent = true;
    sunMat.fog = false;

    // Store uniform for runtime updates
    this.sunMaterialUniforms = { uOpacity };

    this.sun = new THREE.Mesh(sunGeom, sunMat);
    this.sun.name = "SkySun";
    this.sun.frustumCulled = false;
    this.sun.renderOrder = 1000; // Render AFTER terrain so depth test works
    this.sun.layers.set(1); // Main camera only, not minimap
    this.group.add(this.sun);

    // Inner glow - medium sized, intense (scaled for 600 far plane)
    // Inner glow sized to fit within 600 far plane
    const innerGlowGeom = new THREE.CircleGeometry(50, 32);
    const innerGlowColorNode = Fn(() => {
      const uvCoord = uv();
      const center = vec3(0.5, 0.5, 0.0);
      const uvPos = vec3(uvCoord.x, uvCoord.y, float(0.0));
      const dist = length(sub(uvPos, center));
      const normalizedDist = mul(dist, float(2.0));
      const falloff = clamp(
        sub(float(1.0), normalizedDist),
        float(0.0),
        float(1.0),
      );
      const glowStrength = pow(falloff, float(2.5)); // Tighter falloff
      // HDR warm glow
      const glowColor = vec3(2.0, 1.5, 0.8);
      return vec4(mul(glowColor, glowStrength), mul(glowStrength, uOpacity));
    })();

    const innerGlowMat = new MeshBasicNodeMaterial();
    innerGlowMat.colorNode = innerGlowColorNode;
    innerGlowMat.blending = THREE.AdditiveBlending;
    innerGlowMat.depthWrite = false;
    innerGlowMat.depthTest = true; // Terrain occludes glow
    innerGlowMat.transparent = true;
    innerGlowMat.side = THREE.DoubleSide;
    innerGlowMat.fog = false;

    const innerGlow = new THREE.Mesh(innerGlowGeom, innerGlowMat);
    innerGlow.name = "SkySunInnerGlow";
    innerGlow.frustumCulled = false;
    innerGlow.renderOrder = 999; // Render after terrain, before sun
    innerGlow.layers.set(1); // Main camera only, not minimap
    this.group.add(innerGlow);
    // Store for position updates
    (this.group as THREE.Group & { sunInnerGlow?: THREE.Mesh }).sunInnerGlow =
      innerGlow;

    // Outer glow - large, soft halo for atmosphere effect (scaled for 600 far plane)
    // Outer glow sized to fit within 600 far plane
    const outerGlowGeom = new THREE.CircleGeometry(100, 32);
    const outerGlowColorNode = Fn(() => {
      const uvCoord = uv();
      const center = vec3(0.5, 0.5, 0.0);
      const uvPos = vec3(uvCoord.x, uvCoord.y, float(0.0));
      const dist = length(sub(uvPos, center));
      const normalizedDist = mul(dist, float(2.0));
      const falloff = clamp(
        sub(float(1.0), normalizedDist),
        float(0.0),
        float(1.0),
      );
      // Very soft outer glow
      const glowStrength = pow(falloff, float(1.2));
      // Warm orange tint for atmospheric scattering
      const glowColor = vec3(1.0, 0.7, 0.4);
      return vec4(
        mul(glowColor, glowStrength),
        mul(mul(glowStrength, uOpacity), float(0.6)),
      );
    })();

    const outerGlowMat = new MeshBasicNodeMaterial();
    outerGlowMat.colorNode = outerGlowColorNode;
    outerGlowMat.blending = THREE.AdditiveBlending;
    outerGlowMat.depthWrite = false;
    outerGlowMat.depthTest = true; // Terrain occludes glow
    outerGlowMat.transparent = true;
    outerGlowMat.side = THREE.DoubleSide;
    outerGlowMat.fog = false;

    this.sunGlow = new THREE.Mesh(outerGlowGeom, outerGlowMat);
    this.sunGlow.name = "SkySunGlow";
    this.sunGlow.frustumCulled = false;
    this.sunGlow.renderOrder = 998; // Render after terrain, before inner glow
    this.sunGlow.layers.set(1); // Main camera only, not minimap
    this.group.add(this.sunGlow);
  }

  /**
   * Create moon mesh with TSL Node Material (WebGPU-compatible)
   */
  private createMoon(): void {
    if (!this.group) return;

    // Moon sized for 600 far plane
    const moonGeom = new THREE.PlaneGeometry(35, 35);

    // TSL uniform for opacity control
    const uOpacity = uniform(float(1.0));

    // TSL moon color node
    const moonColorNode = Fn(() => {
      const uvCoord = uv();
      // Sample moon texture if available
      const texColor = this.moonTex
        ? texture(this.moonTex, uvCoord)
        : vec4(0.9, 0.9, 0.95, 1.0);
      return vec4(texColor.rgb, mul(texColor.a, uOpacity));
    })();

    const moonMat = new MeshBasicNodeMaterial();
    moonMat.colorNode = moonColorNode;
    moonMat.blending = THREE.AdditiveBlending;
    moonMat.depthWrite = false;
    moonMat.depthTest = true; // Terrain occludes moon
    moonMat.transparent = true;
    moonMat.side = THREE.DoubleSide;
    moonMat.fog = false;

    // Store uniform for runtime updates
    this.moonMaterialUniforms = { uOpacity };

    this.moon = new THREE.Mesh(moonGeom, moonMat);
    this.moon.name = "SkyMoon";
    this.moon.frustumCulled = false;
    this.moon.renderOrder = 1000; // Render AFTER terrain so depth test works
    this.moon.layers.set(1); // Main camera only, not minimap
    this.group.add(this.moon);

    // Moon glow effect - soft halo around moon (scaled for 600 far plane)
    const moonGlowGeom = new THREE.CircleGeometry(50, 32);

    const moonGlowColorNode = Fn(() => {
      const uvCoord = uv();
      const center = vec3(0.5, 0.5, 0.0);
      const uvPos = vec3(uvCoord.x, uvCoord.y, float(0.0));
      const dist = length(sub(uvPos, center));
      const normalizedDist = mul(dist, float(2.0));
      const falloff = clamp(
        sub(float(1.0), normalizedDist),
        float(0.0),
        float(1.0),
      );
      // Soft glow falloff
      const glowStrength = pow(falloff, float(1.5));
      // Cool blue-white glow for moon
      const glowColor = vec3(0.7, 0.8, 1.0);
      return vec4(mul(glowColor, glowStrength), mul(glowStrength, uOpacity));
    })();

    const moonGlowMat = new MeshBasicNodeMaterial();
    moonGlowMat.colorNode = moonGlowColorNode;
    moonGlowMat.blending = THREE.AdditiveBlending;
    moonGlowMat.depthWrite = false;
    moonGlowMat.depthTest = true; // Terrain occludes glow
    moonGlowMat.transparent = true;
    moonGlowMat.side = THREE.DoubleSide;
    moonGlowMat.fog = false;

    this.moonGlow = new THREE.Mesh(moonGlowGeom, moonGlowMat);
    this.moonGlow.name = "SkyMoonGlow";
    this.moonGlow.frustumCulled = false;
    this.moonGlow.renderOrder = 999; // Render after terrain, before moon
    this.moonGlow.layers.set(1); // Main camera only, not minimap
    this.group.add(this.moonGlow);
  }

  /**
   * Create sky dome with TSL Node Material
   * Production-grade day/night cycle with smooth transitions, stars, and proper atmosphere
   */
  private createSkyDome(): void {
    if (!this.group) return;

    // Use high segment count to prevent color banding
    // Sky sphere sized to fit within camera far plane (600)
    // Sky follows camera so this creates infinite sky illusion
    // Sky sphere must fit inside camera far plane (600) - use 500
    const skyGeom = new THREE.SphereGeometry(500, 128, 64);

    // Create TSL uniforms
    const uTime = uniform(float(0));
    const uSunPosition = uniform(vec3(0, 1, 0));
    const uDayCycleProgress = uniform(float(0));
    const uDayIntensity = uniform(float(0)); // Sharp transition day intensity from update()

    // Create texture uniform for galaxy/stars - this allows runtime texture updates
    // Must be a uniform so it can be updated after async texture load
    this.galaxyTextureUniform = { value: this.galaxyTex };
    const uGalaxyTex = this.galaxyTex ? texture(this.galaxyTex) : null;

    // Create the sky color node - comprehensive day/night with stars
    const skyColorNode = Fn(() => {
      const localPos = normalize(positionLocal);

      // Elevation: 0 at horizon, 1 at zenith
      // Use abs() to make sky symmetric - lower hemisphere mirrors upper
      // This is essential for correct planar water reflections
      const elevation = abs(localPos.y);

      // =====================
      // DAY/NIGHT CYCLE - Uses pre-calculated sharp transition
      // =====================
      // dayIntensity comes from uniform - sharp transitions at sunrise/sunset
      // Night stays dark until sunrise, then rapid transition
      const dayIntensity = uDayIntensity;

      // Night intensity is inverse of day
      const nightIntensity = sub(float(1.0), dayIntensity);

      // =====================
      // SKY COLORS - Darker night sky
      // =====================
      // Day sky gradient: deep blue at zenith, lighter at horizon
      const dayZenith = vec3(0.25, 0.55, 0.95); // Rich blue
      const dayHorizon = vec3(0.7, 0.85, 1.0); // Light blue/white
      const dayGradient = pow(sub(float(1.0), elevation), float(1.5));
      const daySkyColor = mix(dayZenith, dayHorizon, dayGradient);

      // Night sky gradient: MUCH darker for proper night feel
      const nightZenith = vec3(0.005, 0.008, 0.025); // Almost black with blue tint
      const nightHorizon = vec3(0.02, 0.03, 0.06); // Very dark blue-gray
      const nightGradient = pow(sub(float(1.0), elevation), float(2.0));
      const nightSkyColor = mix(nightZenith, nightHorizon, nightGradient);

      // Blend day/night sky
      let skyColor: ShaderNode = mix(nightSkyColor, daySkyColor, dayIntensity);

      // =====================
      // SUNRISE/SUNSET GLOW
      // =====================
      // Detect when sun is near horizon (sunrise/sunset)
      const sunY = uSunPosition.y;
      // Dawn/dusk factor: peaks when sun is at horizon (-0.1 to 0.3)
      const dawnDuskFactor = smoothstep(float(-0.2), float(0.0), sunY);
      const dawnDuskFade = smoothstep(float(0.4), float(0.15), sunY);
      const sunriseSunsetIntensity = mul(dawnDuskFactor, dawnDuskFade);

      // Direction to sun for glow positioning
      const sunDir = normalize(uSunPosition);
      const angleToSun = dot(localPos, sunDir);

      // Sunrise/sunset colors near sun
      const sunriseColor = vec3(1.0, 0.5, 0.2); // Orange
      const sunsetPinkColor = vec3(1.0, 0.4, 0.5); // Pink/red

      // Glow strongest near sun, with gradual falloff across radius
      // Use power function for smooth natural falloff instead of smoothstep
      const sunGlowRaw = clamp(angleToSun, float(0.0), float(1.0));
      const sunGlowAngle = pow(sunGlowRaw, float(4.0)); // Higher power = tighter, more gradual falloff
      // Also affect horizon area more
      const horizonGlow = pow(
        clamp(
          sub(float(1.0), mul(elevation, float(2.0))),
          float(0.0),
          float(1.0),
        ),
        float(2.0),
      );

      const glowIntensity = mul(
        mul(sunGlowAngle, horizonGlow),
        mul(sunriseSunsetIntensity, float(0.6)),
      );

      // Blend sunrise color with slight pink variation based on time
      const dawnOrDusk = smoothstep(float(0.2), float(0.3), uDayCycleProgress);
      const glowColor = mix(sunriseColor, sunsetPinkColor, dawnOrDusk);
      skyColor = add(skyColor, mul(glowColor, glowIntensity));

      // =====================
      // STARS (Night only) - Procedural starfield with stable noise
      // =====================
      // Stars visible at night - stronger visibility curve for more stars
      const starVisibility = mul(
        pow(nightIntensity, float(0.5)), // Square root for earlier star visibility
        smoothstep(float(0.05), float(0.3), elevation),
      );

      // Use UV coordinates from the sphere geometry - these are stable
      // and don't change with camera rotation (sphere doesn't rotate)
      const sphereUV = uv();

      // Scale UVs for star density - lower frequencies = more stable
      const starScale1 = float(120.0); // Reduced from 150
      const starScale2 = float(160.0); // Reduced from 300
      const starScale3 = float(200.0); // Reduced from 600

      // Use UV-based coordinates for stability
      const starCoord1 = mul(sphereUV, starScale1);
      const starCoord2 = mul(sphereUV, starScale2);
      const starCoord3 = mul(sphereUV, starScale3);

      // Stable pseudo-random using UV coordinates
      // Lower frequency coefficients for less precision sensitivity
      const starNoise1 = mul(
        mul(
          add(float(1.0), cos(mul(starCoord1.x, float(6.28)))),
          add(float(1.0), cos(mul(starCoord1.y, float(7.35)))),
        ),
        add(float(1.0), cos(mul(add(starCoord1.x, starCoord1.y), float(4.12)))),
      );
      const starNoise2 = mul(
        mul(
          add(float(1.0), cos(mul(starCoord2.x, float(5.89)))),
          add(float(1.0), cos(mul(starCoord2.y, float(8.12)))),
        ),
        add(float(1.0), cos(mul(add(starCoord2.x, starCoord2.y), float(3.78)))),
      );
      const starNoise3 = mul(
        mul(
          add(float(1.0), cos(mul(starCoord3.x, float(7.23)))),
          add(float(1.0), cos(mul(starCoord3.y, float(6.54)))),
        ),
        add(float(1.0), cos(mul(add(starCoord3.x, starCoord3.y), float(5.01)))),
      );

      // Threshold noise to create sparse bright stars
      const starThreshold1 = pow(
        smoothstep(float(7.8), float(8.0), starNoise1),
        float(2.0),
      );
      const starThreshold2 = mul(
        pow(smoothstep(float(7.9), float(8.0), starNoise2), float(2.0)),
        float(0.7),
      );
      const starThreshold3 = mul(
        pow(smoothstep(float(7.95), float(8.0), starNoise3), float(2.0)),
        float(0.4),
      );

      // Combine star layers
      const proceduralStars = clamp(
        add(add(starThreshold1, starThreshold2), starThreshold3),
        float(0.0),
        float(1.0),
      );

      // Galaxy texture for additional nebula glow
      const galaxyUV = mul(sphereUV, float(2.0));
      const galaxySample = uGalaxyTex
        ? texture(this.galaxyTex!, galaxyUV)
        : vec4(0.0, 0.0, 0.0, 0.0);

      // Combine procedural stars with galaxy nebula glow
      const starIntensity = add(
        mul(proceduralStars, float(1.5)), // Bright procedural stars
        mul(galaxySample.r, float(0.12)), // Subtle galaxy glow
      );

      // Star colors vary slightly - warmer for some, cooler for others
      const starColorVar = mix(
        vec3(1.0, 0.95, 0.85), // Warm white
        vec3(0.85, 0.92, 1.0), // Cool blue-white
        proceduralStars,
      );
      const finalStarColor = mul(
        starColorVar,
        mul(starIntensity, starVisibility),
      );
      skyColor = add(skyColor, finalStarColor);

      // =====================
      // MOON GLOW (Night atmospheric glow)
      // =====================
      const moonPos = mul(sunDir, float(-1.0));
      const angleToMoon = dot(localPos, moonPos);
      // Use power function for gradual falloff instead of smoothstep
      const moonGlowRaw = clamp(angleToMoon, float(0.0), float(1.0));
      const moonGlowAngle = pow(moonGlowRaw, float(6.0)); // Softer glow
      const moonGlowColor = vec3(0.5, 0.6, 0.8); // Cool blue glow
      const moonGlowIntensity = mul(
        mul(moonGlowAngle, nightIntensity),
        float(0.4), // Stronger moon glow
      );
      skyColor = add(skyColor, mul(moonGlowColor, moonGlowIntensity));

      // =====================
      // HORIZON HAZE (subtle atmosphere)
      // =====================
      const hazeColor = vec3(0.83, 0.78, 0.72); // Warm beige
      // Haze strongest near horizon (low elevation), fades as you go higher
      // Use elevation (which is now abs(localPos.y)) for symmetric reflections
      const hazeStrength = smoothstep(float(0.15), float(0.0), elevation);
      // Haze stronger during day, minimal at night
      const hazeAmount = mul(
        hazeStrength,
        mul(float(0.3), mul(dayIntensity, float(0.9))), // Much less haze at night
      );
      skyColor = mix(skyColor, hazeColor, hazeAmount);

      return vec4(skyColor, float(1.0));
    })();

    // Create the Node Material
    const skyMat = new MeshBasicNodeMaterial();
    skyMat.colorNode = skyColorNode;
    skyMat.side = THREE.BackSide;
    skyMat.depthWrite = false;
    skyMat.depthTest = false; // Ignore camera far plane - sky always renders
    skyMat.transparent = false;
    skyMat.toneMapped = true;
    skyMat.fog = false; // Sky should never be affected by scene fog

    // Store TSL uniforms at class level for reliable updates (like WaterSystem)
    // Store directly without casting - the uniform() function returns objects with .value
    this.skyTSLUniforms = {
      uTime: uTime,
      uSunPosition: uSunPosition as unknown as TSLUniformVec3,
      uDayCycleProgress: uDayCycleProgress,
      uDayIntensity: uDayIntensity,
    } as SkyMaterialUniforms;

    this.skyMesh = new THREE.Mesh(skyGeom, skyMat);
    this.skyMesh.frustumCulled = false;
    this.skyMesh.renderOrder = -1000; // Render first, behind everything
    this.skyMesh.name = "AdvancedSkydome";
    this.skyMesh.layers.set(1); // Main camera only, not minimap
    this.group.add(this.skyMesh);
  }

  // Store cloud group for rotation animation
  private cloudGroup: THREE.Group | null = null;

  /**
   * Create cloud billboards using cloud textures
   * Each cloud samples from a sprite atlas (2 columns x 4 rows = 8 sprites per texture)
   * Clouds dissolve at night using noise-based alpha erosion
   */
  private createClouds(): void {
    if (!this.group) return;

    // Cloud distances scaled for 600 far plane
    // Sky must fit inside camera far plane (600) - use 500 to leave some margin
    const SKY_RADIUS = 500;
    const BASE_SIZE = 160;

    // Create a group to hold all cloud meshes (for rotation)
    this.cloudGroup = new THREE.Group();
    this.cloudGroup.name = "CloudGroup";
    this.cloudGroup.layers.set(1); // Main camera only, not minimap

    // Get textures array for easy lookup
    const textures = [this.cloud1, this.cloud2, this.cloud3, this.cloud4];

    // Reference noise texture for dissolve effect
    const noiseRef = this.noiseA;

    // Shared uniforms for all clouds
    const uTime = uniform(float(0));
    const uSunDir = uniform(vec3(0, 1, 0));
    const uDayIntensity = uniform(float(1.0)); // For dissolve effect at night

    // Store uniforms at class level for updates
    this.cloudMaterialUniforms = {
      uTime,
      uSunPosition: uSunDir,
      uDayIntensity,
    } as CloudMaterialUniforms;

    for (let i = 0; i < CLOUD_DEFS.length; i++) {
      const def = CLOUD_DEFS[i];
      const tex = textures[def.tex - 1]; // tex is 1-indexed

      if (!tex) continue;

      // Calculate UV offset for sprite in atlas (2 cols x 4 rows)
      const col = def.sprite % 2;
      const row = Math.floor(def.sprite / 2);
      const uOffset = col * 0.5;
      const vOffset = 0.75 - row * 0.25; // rows go from top

      // Create geometry with adjusted UVs for this sprite
      const geom = new THREE.PlaneGeometry(1, 1);
      const uvAttr = geom.attributes.uv;
      for (let j = 0; j < uvAttr.count; j++) {
        const u = uvAttr.getX(j) * 0.5 + uOffset;
        const v = uvAttr.getY(j) * 0.25 + vOffset;
        uvAttr.setXY(j, u, v);
      }
      uvAttr.needsUpdate = true;

      // Create material with perlin noise dissolve fade in/out
      // Each cloud gets a unique phase offset based on its index
      const cloudIndex = float(i);

      // PERFORMANCE: Simplified cloud shader - removed UV swirl animation
      // Keeps day/night fade and simple dissolve, removes expensive per-fragment cos/sin
      const cloudColorNode = Fn(() => {
        const uvCoord = uv();
        const cloudTex = texture(tex, uvCoord);

        // Day/night color - clouds are bright during day
        const dayColor = vec3(1.0, 1.0, 1.0);
        const nightColor = vec3(0.3, 0.35, 0.45);
        const cloudColor = mix(nightColor, dayColor, uDayIntensity);

        // Simple drifting noise UVs (no swirl rotation)
        const noiseUV = add(
          mul(uvCoord, float(2.0)),
          mul(vec2(uTime, mul(uTime, float(0.6))), float(0.03)),
        );
        const noiseSample = noiseRef
          ? texture(noiseRef, noiseUV)
          : vec4(0.5, 0.5, 0.5, 1.0);
        const noiseValue = noiseSample.r;

        // Simple fade cycle (uses cos but only once per cloud, not per-pixel)
        const fadeSpeed = float(0.025);
        const cloudPhase = mul(cloudIndex, float(2.5));
        const fadeCycle = add(mul(uTime, fadeSpeed), cloudPhase);
        const fadeProgress = mul(add(cos(fadeCycle), float(1.0)), float(0.5));

        // Combined dissolve (day/night and cycle in one pass)
        const nightFade = mul(sub(float(1.0), uDayIntensity), float(0.7));
        const dissolveThreshold = add(sub(float(1.0), fadeProgress), nightFade);
        const dissolveMask = smoothstep(
          dissolveThreshold,
          add(dissolveThreshold, float(0.2)),
          noiseValue,
        );

        const finalAlpha = mul(cloudTex.a, dissolveMask);
        return vec4(cloudColor, finalAlpha);
      })();

      const mat = new MeshBasicNodeMaterial();
      mat.colorNode = cloudColorNode;
      mat.side = THREE.DoubleSide;
      mat.transparent = true;
      mat.depthWrite = false;
      mat.depthTest = true; // Check depth buffer - don't render over closer objects
      mat.toneMapped = false;
      mat.fog = false; // Don't let scene fog affect clouds

      // Create mesh
      const mesh = new THREE.Mesh(geom, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = -995; // Render after sky dome but before scene objects

      // Position on sky dome
      const azRad = (def.az * Math.PI) / 180;
      const elRad = (def.el * Math.PI) / 180;

      const x = SKY_RADIUS * Math.cos(elRad) * Math.sin(azRad);
      const y = SKY_RADIUS * Math.sin(elRad);
      const z = SKY_RADIUS * Math.cos(elRad) * Math.cos(azRad);

      mesh.position.set(x, y, z);

      // Rotate to face center (billboard)
      mesh.rotation.y = azRad + Math.PI;

      // Scale
      const w = BASE_SIZE * def.scale * 1.5;
      const h = BASE_SIZE * def.scale * 0.7;
      mesh.scale.set(w, h, 1);

      // Store base scale for animation
      mesh.userData.baseScale = new THREE.Vector3(w, h, 1);

      // Main camera only, not minimap
      mesh.layers.set(1);

      this.cloudGroup.add(mesh);
    }

    // Store reference (use first mesh for uniform updates)
    this.clouds = this.cloudGroup.children[0] as THREE.InstancedMesh;
    this.group.add(this.cloudGroup);
  }

  override update(delta: number): void {
    if (!this.group || !this.skyMesh) return;
    this.elapsed += delta;

    // Time-of-day (0..1) - use synced world time from server for multiplayer sync
    // On client: use network.getSyncedWorldTime() if available, otherwise local time
    // On server: use local world time (server is authoritative)
    const network = this.world.network as
      | { getSyncedWorldTime?: () => number }
      | undefined;
    const worldTime = network?.getSyncedWorldTime
      ? network.getSyncedWorldTime()
      : this.world.getTime();
    const dayPhase = (worldTime % this.dayDurationSec) / this.dayDurationSec;

    // Store for public getters
    this._dayPhase = dayPhase;

    // Sun is above horizon from dayPhase 0.25 (sunrise) to 0.75 (sunset)
    const isDay = this.isDay;

    // Calculate day intensity with SHARP transitions at sunrise/sunset
    // Night stays truly dark until sunrise, then rapid transition
    // This creates the feeling of "darkest before dawn" then sudden light
    const DAWN_START = 0.22; // Start brightening just before sunrise
    const DAWN_END = 0.28; // Full brightness shortly after sunrise
    const DUSK_START = 0.72; // Start darkening just before sunset
    const DUSK_END = 0.78; // Full darkness shortly after sunset

    // Smoothstep helper for smooth but sharp transitions
    const smoothstep = (edge0: number, edge1: number, x: number) => {
      const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
      return t * t * (3 - 2 * t);
    };

    let dayIntensity: number;
    if (dayPhase < DAWN_START || dayPhase >= DUSK_END) {
      // Deep night - completely dark
      dayIntensity = 0;
    } else if (dayPhase < DAWN_END) {
      // Dawn transition - rapid brightening
      dayIntensity = smoothstep(DAWN_START, DAWN_END, dayPhase);
    } else if (dayPhase < DUSK_START) {
      // Full day - slight variation with noon being brightest
      const noonFactor = 1 - Math.abs(dayPhase - 0.5) * 2; // 0 at edges, 1 at noon
      dayIntensity = 0.85 + noonFactor * 0.15; // 0.85 to 1.0
    } else {
      // Dusk transition - rapid darkening
      dayIntensity = 1 - smoothstep(DUSK_START, DUSK_END, dayPhase);
    }

    this._dayIntensity = dayIntensity;

    // Sun direction - traces arc across sky from east to west
    // dayPhase: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset, 1 = midnight
    //
    // The sun arc angle: -π/2 at midnight, 0 at sunrise, π/2 at noon, π at sunset
    const sunArcAngle = (dayPhase - 0.25) * Math.PI * 2;

    // Sun position in sky:
    // - X: East-West position (positive = east, negative = west)
    // - Y: Height above horizon (positive = above, negative = below)
    // - Z: North-South offset (slight tilt for more natural path)
    const sunElevation = Math.sin(sunArcAngle); // -1 to 1, peaks at noon
    const sunAzimuth = Math.cos(sunArcAngle); // 1 at sunrise, -1 at sunset

    // Add slight Z offset for sun path tilt (makes shadows more interesting)
    const sunTilt = 0.3; // 30% tilt toward/away from camera

    this._sunDir
      .set(
        sunAzimuth * Math.max(0.1, 1 - Math.abs(sunElevation)), // X: E-W, compressed when high
        sunElevation, // Y: height
        sunTilt * sunAzimuth, // Z: slight tilt
      )
      .normalize();

    // Update uniforms
    this.skyUniforms.time.value = this.elapsed;
    this.skyUniforms.sunPosition.value.copy(this._sunDir);
    this.skyUniforms.dayCycleProgress.value = dayPhase;

    // Position sun/moon (scaled for 600 far plane)
    // Position celestial bodies inside sky dome (must fit in camera far plane)
    const radius = 450;
    if (this.sun) {
      this.sun.position.set(
        this._sunDir.x * radius,
        this._sunDir.y * radius,
        this._sunDir.z * radius,
      );
      this.sun.visible = isDay;
      this.sun.quaternion.copy(this.world.camera.quaternion);

      // Update sun opacity via TSL uniform
      if (this.sunMaterialUniforms) {
        this.sunMaterialUniforms.uOpacity.value = isDay ? 0.9 : 0.0;
      }
    }

    // Position sun glow layers (WebGPU-compatible lensflare replacement)
    if (this.sunGlow) {
      this.sunGlow.position.set(
        this._sunDir.x * radius,
        this._sunDir.y * radius,
        this._sunDir.z * radius,
      );
      this.sunGlow.visible = isDay;
      this.sunGlow.quaternion.copy(this.world.camera.quaternion);
    }

    // Position inner sun glow
    const groupWithGlow = this.group as THREE.Group & {
      sunInnerGlow?: THREE.Mesh;
    };
    if (groupWithGlow.sunInnerGlow) {
      groupWithGlow.sunInnerGlow.position.set(
        this._sunDir.x * radius,
        this._sunDir.y * radius,
        this._sunDir.z * radius,
      );
      groupWithGlow.sunInnerGlow.visible = isDay;
      groupWithGlow.sunInnerGlow.quaternion.copy(this.world.camera.quaternion);
    }

    if (this.moon) {
      this.moon.position.set(
        -this._sunDir.x * radius,
        -this._sunDir.y * radius,
        -this._sunDir.z * radius,
      );
      this.moon.quaternion.copy(this.world.camera.quaternion);
      this.moon.visible = true;

      // Update moon opacity via TSL uniform
      if (this.moonMaterialUniforms) {
        this.moonMaterialUniforms.uOpacity.value = isDay ? 0.0 : 1.0;
      }
    }

    // Position moon glow (halo behind moon)
    if (this.moonGlow) {
      this.moonGlow.position.set(
        -this._sunDir.x * radius,
        -this._sunDir.y * radius,
        -this._sunDir.z * radius,
      );
      this.moonGlow.visible = !isDay;
      this.moonGlow.quaternion.copy(this.world.camera.quaternion);
    }

    // Update sky TSL uniforms (stored at class level for reliable updates)
    if (this.skyTSLUniforms) {
      this.skyTSLUniforms.uTime.value = this.elapsed;
      this.skyTSLUniforms.uSunPosition.value.copy(this._sunDir);
      this.skyTSLUniforms.uDayCycleProgress.value = dayPhase;
      this.skyTSLUniforms.uDayIntensity.value = this._dayIntensity; // Sharp transition value
    }

    // Update cloud material uniforms via class-level reference
    if (this.cloudMaterialUniforms) {
      this.cloudMaterialUniforms.uTime.value = this.elapsed;
      this.cloudMaterialUniforms.uSunPosition.value.copy(this._sunDir);
      this.cloudMaterialUniforms.uDayIntensity.value = this._dayIntensity;
    }

    // Ensure render order - render AFTER terrain so depth test works (terrain occludes celestials)
    if (this.sun) this.sun.renderOrder = 1000;
    if (this.moon) this.moon.renderOrder = 1000;

    // Gently rotate cloud cover and animate scale
    if (this.cloudGroup) {
      // ~1 full rotation per 20 minutes (0.005 radians/sec) - subtle movement
      this.cloudGroup.rotation.y += delta * 0.005;

      // Animate each cloud's scale for gentle breathing effect
      this.cloudGroup.children.forEach((mesh, i) => {
        if (mesh instanceof THREE.Mesh) {
          const baseScale = mesh.userData.baseScale as
            | THREE.Vector3
            | undefined;
          if (baseScale) {
            // Each cloud has different phase
            const phase = this.elapsed * 0.3 + i * 1.5;
            // Scale oscillates between 95% and 105%
            const scaleMod = 1.0 + Math.sin(phase) * 0.05;
            mesh.scale.set(
              baseScale.x * scaleMod,
              baseScale.y * scaleMod,
              baseScale.z,
            );
          }
        }
      });
    }
  }

  override lateUpdate(_delta: number): void {
    if (!this.group) return;

    // Keep sky centered on camera for infinite effect - follow all 3 axes
    // This ensures sky never clips against draw distance regardless of camera position
    // Use camera position directly (most reliable) with rig fallback
    if (this.world.camera) {
      this.group.position.copy(this.world.camera.position);
    } else if (this.world.rig) {
      this.group.position.copy(this.world.rig.position);
    }
  }

  override destroy(): void {
    if (this.group && this.group.parent) {
      this.group.parent.remove(this.group);
    }
    if (this.skyMesh) {
      this.skyMesh.geometry.dispose();
      (this.skyMesh.material as THREE.Material).dispose();
      this.skyMesh = null;
    }
    if (this.clouds) {
      this.clouds.geometry.dispose();
      (this.clouds.material as THREE.Material).dispose();
      this.clouds = null;
    }
    if (this.sun) {
      this.sun.geometry.dispose();
      (this.sun.material as THREE.Material).dispose();
      this.sun = null;
    }
    if (this.sunGlow) {
      this.sunGlow.geometry.dispose();
      (this.sunGlow.material as THREE.Material).dispose();
      this.sunGlow = null;
    }
    // Clean up inner sun glow
    const groupWithGlow = this.group as
      | (THREE.Group & { sunInnerGlow?: THREE.Mesh })
      | null;
    if (groupWithGlow?.sunInnerGlow) {
      groupWithGlow.sunInnerGlow.geometry.dispose();
      (groupWithGlow.sunInnerGlow.material as THREE.Material).dispose();
      groupWithGlow.sunInnerGlow = undefined;
    }
    if (this.moon) {
      this.moon.geometry.dispose();
      (this.moon.material as THREE.Material).dispose();
      this.moon = null;
    }
    if (this.moonGlow) {
      this.moonGlow.geometry.dispose();
      (this.moonGlow.material as THREE.Material).dispose();
      this.moonGlow = null;
    }
    this.sunMaterialUniforms = null;
    this.moonMaterialUniforms = null;
    this.cloudMaterialUniforms = null;
    this.galaxyTextureUniform = null;
    this.group = null;
  }
}

export default SkySystem;
