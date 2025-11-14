/**
 * SkySystem.ts - Advanced Dynamic Sky, Sun/Moon, Clouds and Lens Flare
 *
 * Creates a dynamic skydome with day/night cycle, sun/moon visuals,
 * simple lens flare, and layered billboard clouds using InstancedMesh.
 *
 * This system mirrors the structure of WaterSystem/GrassSystem: client-only
 * texture loading in init(), scene graph construction in start(), and
 * per-frame updates in update()/lateUpdate().
 */

import THREE from "../extras/three";
import { System } from "./System";
import type { World, WorldOptions } from "../types";
import { Lensflare, LensflareElement } from "three/addons/objects/Lensflare.js";

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
// Cloud data (subset from reference; enough for layered sky feel)
// -----------------------------
type CloudItem = {
  textureNumber: number;
  cloudNumber: number;
  positionIndex: number;
  posY: number;
  width: number;
  height: number;
  distortionSpeed: number;
  distortionRange: number;
};

const cloudData: CloudItem[] = [
  {
    textureNumber: 2,
    cloudNumber: 0,
    positionIndex: 4,
    posY: 350,
    width: 300,
    height: 200,
    distortionSpeed: 0.12,
    distortionRange: 0.1,
  },
  {
    textureNumber: 2,
    cloudNumber: 6,
    positionIndex: 0,
    posY: 350,
    width: 300,
    height: 200,
    distortionSpeed: 0.11,
    distortionRange: 0.05,
  },
  {
    textureNumber: 2,
    cloudNumber: 1,
    positionIndex: 14,
    posY: 350,
    width: 300,
    height: 180,
    distortionSpeed: 0.12,
    distortionRange: 0.1,
  },
  {
    textureNumber: 2,
    cloudNumber: 6,
    positionIndex: 8,
    posY: 350,
    width: 300,
    height: 180,
    distortionSpeed: 0.1,
    distortionRange: 0.0,
  },
  {
    textureNumber: 2,
    cloudNumber: 2,
    positionIndex: 28,
    posY: 350,
    width: 400,
    height: 200,
    distortionSpeed: 0.12,
    distortionRange: 0.1,
  },
  {
    textureNumber: 2,
    cloudNumber: 6,
    positionIndex: 30,
    posY: 350,
    width: 400,
    height: 200,
    distortionSpeed: 0.12,
    distortionRange: 0.05,
  },
  {
    textureNumber: 2,
    cloudNumber: 3,
    positionIndex: 45,
    posY: 350,
    width: 400,
    height: 200,
    distortionSpeed: 0.12,
    distortionRange: 0.1,
  },
  {
    textureNumber: 2,
    cloudNumber: 7,
    positionIndex: 50,
    posY: 350,
    width: 400,
    height: 200,
    distortionSpeed: 0.1,
    distortionRange: 0.1,
  },
  {
    textureNumber: 2,
    cloudNumber: 4,
    positionIndex: 69,
    posY: 350,
    width: 350,
    height: 175,
    distortionSpeed: 0.12,
    distortionRange: 0.1,
  },
  {
    textureNumber: 2,
    cloudNumber: 6,
    positionIndex: 75,
    posY: 350,
    width: 350,
    height: 175,
    distortionSpeed: 0.12,
    distortionRange: 0.0,
  },
  {
    textureNumber: 2,
    cloudNumber: 5,
    positionIndex: 80,
    posY: 350,
    width: 350,
    height: 175,
    distortionSpeed: 0.12,
    distortionRange: 0.1,
  },
  {
    textureNumber: 2,
    cloudNumber: 7,
    positionIndex: 85,
    posY: 350,
    width: 500,
    height: 200,
    distortionSpeed: 0.1,
    distortionRange: 0.05,
  },
  {
    textureNumber: 0,
    cloudNumber: 0,
    positionIndex: 0,
    posY: 450,
    width: 230,
    height: 115,
    distortionSpeed: 0.1,
    distortionRange: 0.5,
  },
  {
    textureNumber: 0,
    cloudNumber: 1,
    positionIndex: 15,
    posY: 550,
    width: 180,
    height: 90,
    distortionSpeed: 0.12,
    distortionRange: 0.4,
  },
  {
    textureNumber: 0,
    cloudNumber: 2,
    positionIndex: 23,
    posY: 650,
    width: 210,
    height: 105,
    distortionSpeed: 0.13,
    distortionRange: 0.35,
  },
  {
    textureNumber: 0,
    cloudNumber: 3,
    positionIndex: 34,
    posY: 400,
    width: 250,
    height: 125,
    distortionSpeed: 0.15,
    distortionRange: 0.4,
  },
  {
    textureNumber: 0,
    cloudNumber: 4,
    positionIndex: 46,
    posY: 450,
    width: 230,
    height: 115,
    distortionSpeed: 0.16,
    distortionRange: 0.35,
  },
  {
    textureNumber: 0,
    cloudNumber: 5,
    positionIndex: 58,
    posY: 550,
    width: 290,
    height: 145,
    distortionSpeed: 0.12,
    distortionRange: 0.4,
  },
  {
    textureNumber: 0,
    cloudNumber: 6,
    positionIndex: 75,
    posY: 475,
    width: 150,
    height: 75,
    distortionSpeed: 0.2,
    distortionRange: 0.45,
  },
  {
    textureNumber: 0,
    cloudNumber: 7,
    positionIndex: 90,
    posY: 450,
    width: 240,
    height: 120,
    distortionSpeed: 0.17,
    distortionRange: 0.5,
  },
  {
    textureNumber: 3,
    cloudNumber: 7,
    positionIndex: 60,
    posY: 375,
    width: 300,
    height: 150,
    distortionSpeed: 0.1,
    distortionRange: 0.5,
  },
  {
    textureNumber: 3,
    cloudNumber: 6,
    positionIndex: 20,
    posY: 375,
    width: 200,
    height: 100,
    distortionSpeed: 0.12,
    distortionRange: 0.4,
  },
  {
    textureNumber: 3,
    cloudNumber: 5,
    positionIndex: 36,
    posY: 550,
    width: 250,
    height: 120,
    distortionSpeed: 0.13,
    distortionRange: 0.35,
  },
  {
    textureNumber: 3,
    cloudNumber: 4,
    positionIndex: 50,
    posY: 625,
    width: 280,
    height: 170,
    distortionSpeed: 0.15,
    distortionRange: 0.4,
  },
  {
    textureNumber: 3,
    cloudNumber: 3,
    positionIndex: 69,
    posY: 550,
    width: 350,
    height: 200,
    distortionSpeed: 0.16,
    distortionRange: 0.35,
  },
  {
    textureNumber: 3,
    cloudNumber: 2,
    positionIndex: 79,
    posY: 700,
    width: 390,
    height: 200,
    distortionSpeed: 0.12,
    distortionRange: 0.4,
  },
  {
    textureNumber: 3,
    cloudNumber: 1,
    positionIndex: 85,
    posY: 525,
    width: 380,
    height: 190,
    distortionSpeed: 0.2,
    distortionRange: 0.45,
  },
  {
    textureNumber: 3,
    cloudNumber: 0,
    positionIndex: 95,
    posY: 675,
    width: 150,
    height: 100,
    distortionSpeed: 0.17,
    distortionRange: 0.5,
  },
];

// -----------------------------
// Shaders
// -----------------------------
const skyVertexShader = `
  #define M_PI 3.1415926535897932384626433832795

  uniform vec3 uSunPosition;
  uniform float uAtmosphereElevation;
  uniform float uAtmospherePower;
  uniform vec3 uColorDayCycleLow;
  uniform vec3 uColorDayCycleHigh;
  uniform vec3 uColorNightLow;
  uniform vec3 uColorNightHigh;
  uniform float uDawnAngleAmplitude;
  uniform float uDawnElevationAmplitude;
  uniform vec3 uColorDawn;
  uniform float uSunAmplitude;
  uniform float uSunMultiplier;
  uniform vec3 uColorSun;
  uniform float uDayCycleProgress;

  varying vec3 vColor;
  varying vec2 vUv;
  varying vec3 vPos;

  vec3 blendAdd(vec3 base, vec3 blend) {
    return min(base + blend, vec3(1.0));
  }

  vec3 blendAdd(vec3 base, vec3 blend, float opacity) {
    return (blendAdd(base, blend) * opacity + base * (1.0 - opacity));
  }

  void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * modelPosition;

    vec3 normalizedPosition = normalize(position);
    vUv = uv;
    vPos = position;

    //################################################## Sky ##################################################
    float horizonIntensity = (uv.y - 0.5) / uAtmosphereElevation;
    horizonIntensity = pow(1.0 - horizonIntensity, uAtmospherePower);

    vec3 colorDayCycle = mix(uColorDayCycleHigh, uColorDayCycleLow, horizonIntensity);
    
    vec3 colorNight = mix(uColorNightHigh, uColorNightLow, horizonIntensity);
    
    float dayIntensity = uDayCycleProgress < 0.5 ? (0.25 - abs(uDayCycleProgress - 0.25)) * 4. : 0.;
    vec3 color = mix(colorNight, colorDayCycle, dayIntensity);


    //################################################## Dawn ##################################################   
    float dawnAngleIntensity = dot(normalize(uSunPosition.xyz), normalize(normalizedPosition.xyz));
    dawnAngleIntensity = smoothstep(0.0, 1.0, (dawnAngleIntensity - (1.0 - uDawnAngleAmplitude)) / uDawnAngleAmplitude);

  
    float dawnElevationIntensity = 1.0 - min(1.0, (uv.y - 0.5) / uDawnElevationAmplitude);

    float dawnDayCycleIntensity = uDayCycleProgress < 0.5 ? (abs(uDayCycleProgress - 0.25)) * 4. : 0.;
    dawnDayCycleIntensity = clamp(dawnDayCycleIntensity * 4.0 * M_PI + M_PI, 0.0, 1.0) * 0.5 + 0.5;
    
    
    float dawnIntensity = clamp(dawnAngleIntensity * dawnElevationIntensity * dawnDayCycleIntensity, 0.0, 1.0);
    color = blendAdd(color, uColorDawn, dawnIntensity);

    
    //################################################## Sun light color ################################################## 
    float distanceToSun = distance(normalizedPosition, uSunPosition);

    float sunIntensity = smoothstep(0.0, 1.0, clamp(1.0 - distanceToSun / uSunAmplitude, 0.0, 1.0)) * uSunMultiplier;
    color = blendAdd(color, uColorSun, sunIntensity);

    float sunGlowStrength = pow(max(0.0, 1.0 + 0.05 - distanceToSun * 2.5), 2.0);
    color = blendAdd(color, uColorSun, sunGlowStrength);

    vColor = vec3(color);
  }
`;

const skyFragmentShader = `
  varying vec3 vColor;
  varying vec2 vUv;
  varying vec3 vPos;

  uniform float uTime;
  uniform vec3 uSunPosition;
  uniform sampler2D galaxyTexture;
  uniform sampler2D noiseTexture2;
  uniform sampler2D noiseTexture;
  uniform sampler2D starTexture;

  void main() {

    //################################################## Moon light color ################################################## 
    float moonSize = 1.;
    float moonInnerBound = 0.1;
    float moonOuterBound = 2.0;
    vec4 moonColor = vec4(0.1, 0.7, 0.9, 1.0);
    vec3 moonPosition = vec3(-uSunPosition.x, -uSunPosition.y, -uSunPosition.z);
    float moonDist = distance(normalize(vPos), moonPosition);
    float moonArea = 1. - moonDist / moonSize;
    moonArea = smoothstep(moonInnerBound, moonOuterBound, moonArea);
    vec3 fallmoonColor = moonColor.rgb * 0.4;
    vec3 finalmoonColor = mix(fallmoonColor, moonColor.rgb, smoothstep(-0.03, 0.03, moonPosition.y)) * moonArea;

    //################################################## Galaxy color (add noise texture 2 times) ################################################## 
    vec4 galaxyColor1 = vec4(0.11, 0.38, 0.98, 1.0);
    vec4 galaxyColor = vec4(0.62, 0.11, 0.74, 1.0);
    vec4 galaxyNoiseTex = texture2D(
      noiseTexture2,
      vUv * 2.5 + uTime * 0.001
    );
    vec4 galaxy = texture2D(
      galaxyTexture,
      vec2(
        vPos.x * 0.00006 + (galaxyNoiseTex.r - 0.5) * 0.3,
        vPos.y * 0.00007 + (galaxyNoiseTex.g - 0.5) * 0.3
      )
    );
    vec4 finalGalaxyColor =  (galaxyColor * (-galaxy.r + galaxy.g) + galaxyColor1 * galaxy.r) * smoothstep(0., 0.2, 1. - galaxy.g);
    galaxyNoiseTex = texture2D(
      noiseTexture2,
      vec2(
        vUv.x * 2. + uTime * 0.002,
        vUv.y * 2. + uTime * 0.003
      )
    );
    galaxy = texture2D(
      galaxyTexture,
      vec2(
        vPos.x * 0.00006 + (galaxyNoiseTex.r - 0.5) * 0.3,
        vPos.y * 0.00007 + (galaxyNoiseTex.g - 0.5) * 0.3
      )
    );
    finalGalaxyColor += (galaxyColor * (-galaxy.r + galaxy.g) + galaxyColor1 * galaxy.r) * smoothstep(0., 0.3, 1. - galaxy.g);
    finalGalaxyColor *= 0.1;

    //################################################## Star color ################################################## 
    vec4 starTex = texture2D(
      starTexture, 
      vPos.xz * 0.00025
    );
    vec4 starNoiseTex = texture2D(
      noiseTexture,
      vec2(
        vUv.x * 5. + uTime * 0.01,
        vUv.y * 5. + uTime * 0.02
      )
    );
    
    float starPos = smoothstep(0.21, 0.31, starTex.r);
    float starBright = smoothstep(0.513, 0.9, starNoiseTex.a);
    // Stars cover whole sky - only fade near very bottom horizon
    starPos = vUv.y > 0.2 ? starPos : starPos * smoothstep(0.0, 0.2, vUv.y);
    float finalStarColor = starPos * starBright;
    finalStarColor = finalStarColor * finalGalaxyColor.b * 5. + finalStarColor * (1. - finalGalaxyColor.b) * 0.7;

    float sunNightStep = smoothstep(-0.3, 0.25, uSunPosition.y);
    float starMask = 1. - sunNightStep * (1. - step(0.2, finalmoonColor.b));

    
    gl_FragColor = vec4(vColor + (vec3(finalStarColor) + finalGalaxyColor.rgb) * starMask + finalmoonColor.rgb, 1.0);
  }
`;

const cloudVertexShader = `
  attribute float textureNumber;
  attribute float distortionSpeed;
  attribute float distortionRange;
  attribute vec2 offset;
  attribute vec2 scales;
  attribute vec3 positions;
  attribute float rotationY;

  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec2 vOffset;
  varying float vDistortionSpeed;
  varying float vDistortionRange;
  varying float vTextureNumber;

  uniform float uTime;
  uniform vec3 playerPos;

  void main() { 
    
    // varying
    vTextureNumber = textureNumber;
    vDistortionSpeed = distortionSpeed;
    vDistortionRange = distortionRange;
    vOffset = offset;
    vUv = uv;

    mat3 rotY = mat3(
      cos(rotationY), 0.0, -sin(rotationY), 
      0.0, 1.0, 0.0, 
      sin(rotationY), 0.0, cos(rotationY)
    );
    vec3 pos = position;
    pos.x *= scales.x;
    pos.y *= scales.y;
    pos *= rotY;
    pos += positions;
    vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vWorldPosition = modelPosition.xyz;
    vec4 projectionPosition = projectionMatrix * viewPosition;
    gl_Position = projectionPosition;
  }
`;
const cloudFragmentShader = `\
  #include <common>
  uniform sampler2D cloudTexture1;
  uniform sampler2D cloudTexture2;
  uniform sampler2D cloudTexture3;
  uniform sampler2D cloudTexture4;
  uniform sampler2D noiseTexture2;
  uniform float uTime;
  uniform vec3 sunPosition;
  uniform float cloudRadius;


  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec2 vOffset;
  varying float vDistortionSpeed;
  varying float vDistortionRange;
  varying float vTextureNumber;

  float getCloudAlpha(vec4 lerpTex, vec4 cloudTex, float lerpCtrl) { // distort the cloud
    float cloudStep = 1. - lerpCtrl;
    float cloudLerp = smoothstep(0.95, 1., lerpCtrl);
    float alpha = smoothstep(clamp(cloudStep - 0.1, 0.0, 1.0), cloudStep, lerpTex.b);  
    alpha = mix(alpha, cloudTex.a, cloudLerp);
    alpha = clamp(alpha, 0., cloudTex.a);

    return alpha;
  }

  vec4 getCloudTex(float number) { // choose the cloud texture from the 4 cloud textures based on the cloud data
    vec4 noise = texture2D(
      noiseTexture2, 
      vec2(
        vUv.x + uTime * vDistortionSpeed * 0.1,
        vUv.y + uTime * vDistortionSpeed * 0.2
      )
    );
    vec2 uv = vec2(
      vUv.x / 2. + vOffset.x,
      vUv.y / 4. + vOffset.y
    ) + noise.rb * 0.01;

    vec4 tex;
    if (number < 0.5) {
      tex = texture2D(cloudTexture1, uv);
    }
    else if (number < 1.5) {
      tex = texture2D(cloudTexture2, uv);
    }
    else if (number < 2.5) {
      tex = texture2D(cloudTexture3, uv);
    }
    else if (number < 3.5) {
      tex = texture2D(cloudTexture4, uv);
    }
    return tex;
  }

  void main() {
    vec4 cloud = getCloudTex(vTextureNumber);

    float lerpCtrl = 0.1;
    
    float alphaLerp = mix((sin((uTime) * vDistortionSpeed) * 0.78 + 0.78 * vDistortionRange), 1.0, lerpCtrl);
    float cloudAlpha = getCloudAlpha(cloud, cloud, alphaLerp);
    
    float sunNightStep = smoothstep(-0.3, 0.25, sunPosition.y / cloudRadius);
    vec3 cloudBrightColor = mix(vec3(0.141, 0.607, 0.940), vec3(1.0, 1.0, 1.0), sunNightStep);
    vec3 cloudDarkColor = mix(vec3(0.0236, 0.320, 0.590), vec3(0.141, 0.807, 0.940), sunNightStep);


    float brightLerpSize = cloudRadius * 1.0;
    float sunDist = distance(vWorldPosition, sunPosition);
    float brightLerp = smoothstep(0., brightLerpSize, sunDist);
    float bright = mix(2.0, 1.0, brightLerp);
    float cloudColorLerp = cloud.r;
    vec3 cloudColor = mix(cloudDarkColor, cloudBrightColor, cloudColorLerp) * bright
                    + cloud.g * (1. - brightLerp);

    // float horizon = 400.;
    // float fadeOutY = (vWorldPosition.y + horizon)/ (cloudRadius * 0.4) * 2.;
    // fadeOutY = clamp(fadeOutY, 0.0, 1.0);
    
    if (cloudAlpha < 0.01) discard;
    gl_FragColor.rgb = cloudColor; 
    // gl_FragColor.a = cloudAlpha * fadeOutY;
    gl_FragColor.a = cloudAlpha;
  }
`;

// -----------------------------
// SkySystem
// -----------------------------
export class SkySystem extends System {
  private scene: THREE.Scene | null = null;
  private group: THREE.Group | null = null;
  private skyMesh: THREE.Mesh | null = null;
  private clouds: THREE.InstancedMesh | null = null;
  private moon: THREE.Mesh | null = null;
  private sun: THREE.Mesh | null = null;
  private lensflare: Lensflare | null = null;

  private galaxyTex: THREE.Texture | null = null; // reserved for future use
  private cloud1: THREE.Texture | null = null;
  private cloud2: THREE.Texture | null = null;
  private cloud3: THREE.Texture | null = null;
  private cloud4: THREE.Texture | null = null;
  private moonTex: THREE.Texture | null = null;
  private starTex: THREE.Texture | null = null; // reserved for future use
  private flare32Tex: THREE.Texture | null = null;
  private lensflare3Tex: THREE.Texture | null = null;
  private noiseA!: THREE.Texture;
  private noiseB!: THREE.Texture;

  private elapsed = 0;
  private dayDurationSec = 240; // full day cycle in seconds

  constructor(world: World) {
    super(world);
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
            // Repeat for procedural lookup textures
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

    try {
      const [c1, c2, c3, c4, galaxy, moon, star, n1, n2, flare32, lensflare3] =
        await Promise.all([
          loadTex("/textures/cloud1.png"),
          loadTex("/textures/cloud2.png"),
          loadTex("/textures/cloud3.png"),
          loadTex("/textures/cloud4.png"),
          loadTex("/textures/galaxy.png"),
          loadTex("/textures/moon2.png"),
          loadTex("/textures/star3.png"),
          loadTex("/textures/noise.png"),
          loadTex("/textures/noise2.png"),
          loadTex("/textures/Flare32.png"),
          loadTex("/textures/lensflare3.png"),
        ]);
      this.cloud1 = c1;
      this.cloud2 = c2;
      this.cloud3 = c3;
      this.cloud4 = c4;
      this.galaxyTex = galaxy;
      this.moonTex = moon;
      this.starTex = star;
      this.noiseA = n1;
      this.noiseB = n2;
      this.flare32Tex = flare32;
      this.lensflare3Tex = lensflare3;
    } catch (err) {
      console.warn("[SkySystem] Failed to load one or more sky textures:", err);
    }
  }

  start(): void {
    if (!this.world.isClient || typeof window === "undefined") return;
    if (!this.world.stage?.scene) return;
    this.scene = this.world.stage.scene as THREE.Scene;

    // Root group
    this.group = new THREE.Group();
    this.group.name = "SkySystemGroup";
    this.scene.add(this.group);

    // Skydome (must be larger than sun/moon radius of 4000)
    const skyGeom = new THREE.SphereGeometry(8000, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSunPosition: { value: new THREE.Vector3(0, 1, 0) },
        uDayCycleProgress: { value: 0 },
        // Reference naming for day/night colors
        uColorDayCycleHigh: { value: new THREE.Color("#8cc8ff") },
        uColorDayCycleLow: { value: new THREE.Color("#e0f2ff") },
        uColorNightHigh: { value: new THREE.Color("#0a0d1a") },
        uColorNightLow: { value: new THREE.Color("#1a2033") },
        uColorDawn: { value: new THREE.Color("#ff7a3a") },
        uColorSun: { value: new THREE.Color("#ffffee") },
        // Atmosphere parameters for smooth gradients
        uAtmosphereElevation: { value: 0.4 },
        uAtmospherePower: { value: 2.5 },
        uDawnAngleAmplitude: { value: 0.35 },
        uDawnElevationAmplitude: { value: 0.25 },
        uSunAmplitude: { value: 0.05 },
        uSunMultiplier: { value: 0.8 },
        galaxyTexture: { value: this.galaxyTex },
        noiseTexture: { value: this.noiseA },
        noiseTexture2: { value: this.noiseB },
        starTexture: { value: this.starTex },
      },
      side: THREE.BackSide,
      depthWrite: false,
      transparent: false,
    });
    skyMat.toneMapped = true;
    this.skyMesh = new THREE.Mesh(skyGeom, skyMat);
    this.skyMesh.frustumCulled = false;
    this.skyMesh.name = "AdvancedSkydome";
    this.group.add(this.skyMesh);

    // Sun mesh (bright center, matches reference size and color)
    const sunGeom = new THREE.CircleGeometry(150, 32);
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xf2c88a, // Warm sun color like reference
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.6, // Reduce brightness to prevent washout
    });
    this.sun = new THREE.Mesh(sunGeom, sunMat);
    this.sun.name = "SkySun";
    this.sun.renderOrder = 2;
    this.group.add(this.sun);

    // Lensflare attached to sun (matches reference exactly)
    this.lensflare = new Lensflare();
    if (this.flare32Tex && this.lensflare3Tex) {
      const mainFlareColor = new THREE.Color(0xffffff);
      mainFlareColor.multiplyScalar(0.2); // Match reference opacity
      this.lensflare.addElement(
        new LensflareElement(this.flare32Tex, 800, 0, mainFlareColor),
      );
      this.lensflare.addElement(
        new LensflareElement(this.lensflare3Tex, 60, 0.6),
      );
      this.lensflare.addElement(
        new LensflareElement(this.lensflare3Tex, 70, 0.7),
      );
      this.lensflare.addElement(
        new LensflareElement(this.lensflare3Tex, 120, 0.9),
      );
      this.lensflare.addElement(
        new LensflareElement(this.lensflare3Tex, 70, 1),
      );
    }
    this.sun.add(this.lensflare);

    // Moon (billboard)
    const moonGeom = new THREE.PlaneGeometry(420, 420);
    const moonMat = new THREE.MeshBasicMaterial({
      map: this.moonTex || null,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      transparent: true,
    });
    this.moon = new THREE.Mesh(moonGeom, moonMat);
    this.moon.name = "SkyMoon";
    this.moon.renderOrder = 2;
    this.group.add(this.moon);

    // Clouds (instanced billboards)
    this.createClouds();
  }

  private createClouds(): void {
    if (!this.group) return;
    const count = cloudData.length;
    const base = new THREE.PlaneGeometry(1, 1);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", base.attributes.position);
    geom.setAttribute("normal", base.attributes.normal);
    geom.setAttribute("uv", base.attributes.uv);
    geom.setIndex(base.index!);

    const positions = new Float32Array(count * 3);
    const textureNumber = new Float32Array(count);
    const distortionSpeed = new Float32Array(count);
    const distortionRange = new Float32Array(count);
    const scales = new Float32Array(count * 2);
    const offsets = new Float32Array(count * 2);
    const rotationY = new Float32Array(count);

    const CLOUD_RADIUS = 600;

    for (let i = 0; i < count; i++) {
      const c = cloudData[i];
      const theta = 2 * Math.PI * (c.positionIndex / 100);
      const x = Math.sin(theta) * CLOUD_RADIUS;
      const z = Math.cos(theta) * CLOUD_RADIUS;
      positions[i * 3 + 0] = x;
      positions[i * 3 + 1] = c.posY;
      positions[i * 3 + 2] = z;
      textureNumber[i] = c.textureNumber;
      distortionSpeed[i] = c.distortionSpeed;
      distortionRange[i] = (1 - c.distortionRange) * 2;
      scales[i * 2 + 0] = c.width;
      scales[i * 2 + 1] = c.height;
      rotationY[i] =
        -Math.sin(theta) * (Math.PI * 0.5) * (Math.cos(theta) > 0 ? 1 : -1);
      const cloudNum = c.cloudNumber;
      offsets[i * 2 + 0] = (cloudNum % 2) * 0.5;
      offsets[i * 2 + 1] = 0.75 - Math.floor(cloudNum / 2) * 0.25;
    }

    geom.setAttribute(
      "positions",
      new THREE.InstancedBufferAttribute(positions, 3),
    );
    geom.setAttribute(
      "textureNumber",
      new THREE.InstancedBufferAttribute(textureNumber, 1),
    );
    geom.setAttribute(
      "distortionSpeed",
      new THREE.InstancedBufferAttribute(distortionSpeed, 1),
    );
    geom.setAttribute(
      "distortionRange",
      new THREE.InstancedBufferAttribute(distortionRange, 1),
    );
    geom.setAttribute("scales", new THREE.InstancedBufferAttribute(scales, 2));
    geom.setAttribute("offset", new THREE.InstancedBufferAttribute(offsets, 2));
    geom.setAttribute(
      "rotationY",
      new THREE.InstancedBufferAttribute(rotationY, 1),
    );

    const mat = new THREE.ShaderMaterial({
      vertexShader: cloudVertexShader,
      fragmentShader: cloudFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        cloudRadius: { value: 850 },
        playerPos: { value: new THREE.Vector3() },
        sunPosition: { value: new THREE.Vector3() },
        noiseTexture2: { value: this.noiseB },
        cloudTexture1: { value: this.cloud1 },
        cloudTexture2: { value: this.cloud2 },
        cloudTexture3: { value: this.cloud3 },
        cloudTexture4: { value: this.cloud4 },
      },
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: true,
    });
    mat.toneMapped = false;

    this.clouds = new THREE.InstancedMesh(geom, mat, cloudData.length);
    this.clouds.count = cloudData.length;
    this.clouds.frustumCulled = false;
    this.clouds.name = "SkyClouds";
    this.group.add(this.clouds);
  }

  override update(delta: number): void {
    if (!this.group || !this.skyMesh) return;
    this.elapsed += delta;

    // Time-of-day (0..1) - continuous progression for smooth transitions
    const worldTime = this.world.getTime(); // seconds
    const dayPhase = (worldTime % this.dayDurationSec) / this.dayDurationSec;
    const isDay = dayPhase < 0.5;
    const isAfterNoon = dayPhase > 0.03 && dayPhase < 0.47;

    // Sun direction on unit circle around scene
    const inc = 0.01; // small elevation to reduce horizon flicker
    const theta = Math.PI * (inc - 0.5);
    const phi = 2 * Math.PI * (dayPhase - 0.5);
    const sun = new THREE.Vector3(
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta),
      Math.sin(phi) * Math.cos(theta),
    );

    // Position sun/moon far away (match reference radius of 4000)
    const radius = 4000;
    if (this.sun) {
      this.sun.position.set(sun.x * radius, sun.y * radius, sun.z * radius);
      this.sun.visible = isDay;
      // Billboard to camera (like reference)
      this.sun.quaternion.copy(this.world.camera.quaternion);
      // Only show lens flare during afternoon (like reference code)
      if (this.lensflare) {
        this.lensflare.visible = isAfterNoon;
      }
    }

    if (this.moon) {
      this.moon.position.set(-sun.x * radius, -sun.y * radius, -sun.z * radius);
      // billboard to camera
      this.moon.quaternion.copy(this.world.camera.quaternion);
      this.moon.visible = true;
      // fade moon in at night, out at day
      const moonMat = this.moon.material as THREE.MeshBasicMaterial;
      moonMat.opacity = isDay ? 0.0 : 1.0;
    }

    // Skydome uniforms - pass continuous day cycle progress
    const mat = this.skyMesh.material as THREE.ShaderMaterial;
    mat.uniforms.uTime.value = this.elapsed;
    mat.uniforms.uSunPosition.value.copy(sun);
    mat.uniforms.uDayCycleProgress.value = dayPhase;

    // Cloud uniforms
    if (this.clouds) {
      const cmat = this.clouds.material as THREE.ShaderMaterial;
      cmat.uniforms.uTime.value = this.elapsed;
      // player position for potential effects
      if (this.world.rig) {
        const p = this.world.rig.position;
        cmat.uniforms.playerPos.value.set(p.x, p.y, p.z);
      }
      // sun position for cloud shading
      cmat.uniforms.sunPosition.value.set(
        sun.x * 850 + this.world.rig.position.x,
        sun.y * 850,
        sun.z * 850 + this.world.rig.position.z,
      );
      // clouds depth ordering: ensure clouds sit behind moon/sun slightly
      if (this.sun) this.sun.renderOrder = 2;
      if (this.moon) this.moon.renderOrder = 2;
    }
  }

  override lateUpdate(_delta: number): void {
    if (!this.group) return;
    // Keep sky centered on rig for infinite effect
    this.group.position.x = this.world.rig.position.x;
    this.group.position.z = this.world.rig.position.z;
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
      if (this.lensflare) {
        this.lensflare.dispose();
        this.lensflare = null;
      }
      this.sun.geometry.dispose();
      (this.sun.material as THREE.Material).dispose();
      this.sun = null;
    }
    if (this.moon) {
      this.moon.geometry.dispose();
      (this.moon.material as THREE.Material).dispose();
      this.moon = null;
    }
    this.group = null;
  }
}

export default SkySystem;
