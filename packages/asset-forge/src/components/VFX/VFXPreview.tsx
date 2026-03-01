import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type {
  ArrowEffect,
  FishingEffect,
  GlowEffect,
  SpellEffect,
  TeleportEffect,
  VFXEffect,
} from "../../data/vfx-catalog";

// ---------------------------------------------------------------------------
// Procedural texture generation (matches engine's DataTexture approach)
// ---------------------------------------------------------------------------

const textureCache = new Map<string, THREE.DataTexture>();

function createGlowTexture(
  color: number,
  size = 64,
  sharpness = 3.0,
): THREE.DataTexture {
  const key = `glow-${color}-${size}-${sharpness}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const r = ((color >> 16) & 0xff) / 255;
  const g = ((color >> 8) & 0xff) / 255;
  const b = (color & 0xff) / 255;
  const data = new Uint8Array(size * size * 4);
  const half = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - half + 0.5) / half;
      const dy = (y - half + 0.5) / half;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const falloff = Math.max(0, 1 - dist);
      const strength = Math.pow(falloff, sharpness);
      const idx = (y * size + x) * 4;
      data[idx] = (r * strength * 255) | 0;
      data[idx + 1] = (g * strength * 255) | 0;
      data[idx + 2] = (b * strength * 255) | 0;
      data[idx + 3] = (strength * 255) | 0;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}

function createRingTexture(
  color: number,
  size = 64,
  ringRadius = 0.65,
  ringWidth = 0.22,
): THREE.DataTexture {
  const key = `ring-${color}-${size}-${ringRadius}-${ringWidth}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const r = ((color >> 16) & 0xff) / 255;
  const g = ((color >> 8) & 0xff) / 255;
  const b = (color & 0xff) / 255;
  const data = new Uint8Array(size * size * 4);
  const half = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - half + 0.5) / half;
      const dy = (y - half + 0.5) / half;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ringDist = Math.abs(dist - ringRadius) / ringWidth;
      const strength = Math.exp(-ringDist * ringDist * 4);
      const edgeFade = Math.min(Math.max((1 - dist) * 5, 0), 1);
      const alpha = strength * edgeFade;
      const idx = (y * size + x) * 4;
      data[idx] = (r * alpha * 255) | 0;
      data[idx + 1] = (g * alpha * 255) | 0;
      data[idx + 2] = (b * alpha * 255) | 0;
      data[idx + 3] = (alpha * 255) | 0;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}

// ---------------------------------------------------------------------------
// Additive billboard material factory
// ---------------------------------------------------------------------------

function makeGlowMaterial(tex: THREE.DataTexture): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    fog: false,
  });
}

// ---------------------------------------------------------------------------
// Billboard helper — faces mesh toward camera each frame
// ---------------------------------------------------------------------------

const Billboard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (ref.current) {
      ref.current.quaternion.copy(camera.quaternion);
    }
  });
  return <group ref={ref}>{children}</group>;
};

// ---------------------------------------------------------------------------
// SpellOrbPreview — billboarded glow layers + trail + orbiting sparks
// ---------------------------------------------------------------------------

const TRAIL_COUNT = 6;

const SpellOrb: React.FC<{ effect: SpellEffect }> = ({ effect }) => {
  const groupRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.Group>(null);

  const outerTex = useMemo(
    () => createGlowTexture(effect.color, 64, 2.0),
    [effect.color],
  );
  const coreTex = useMemo(
    () => createGlowTexture(effect.coreColor, 64, 3.0),
    [effect.coreColor],
  );

  const outerMat = useMemo(() => makeGlowMaterial(outerTex), [outerTex]);
  const coreMat = useMemo(() => makeGlowMaterial(coreTex), [coreTex]);

  const planeGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  // Trail history ring buffer
  const trailPositions = useRef<THREE.Vector3[]>(
    Array.from({ length: TRAIL_COUNT }, () => new THREE.Vector3()),
  );
  const trailIdx = useRef(0);

  // Orbit the orb around the scene center in a gentle circle
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();

    // Orbit path
    const orbX = Math.sin(t * 0.8) * 0.6;
    const orbZ = Math.cos(t * 0.8) * 0.6;
    const orbY = Math.sin(t * 1.2) * 0.15;
    groupRef.current.position.set(orbX, orbY, orbZ);

    // Pulse (bolts only)
    if (effect.pulseSpeed > 0) {
      const pulse = 1 + Math.sin(t * effect.pulseSpeed) * effect.pulseAmount;
      groupRef.current.scale.setScalar(pulse);
    }

    // Update trail ring buffer
    trailPositions.current[trailIdx.current % TRAIL_COUNT].copy(
      groupRef.current.position,
    );
    trailIdx.current++;

    // Position trail sprites
    if (trailRef.current) {
      const children = trailRef.current.children as THREE.Mesh[];
      for (let i = 0; i < TRAIL_COUNT; i++) {
        const age =
          (trailIdx.current - 1 - i + TRAIL_COUNT * 100) % TRAIL_COUNT;
        const pos =
          trailPositions.current[
            (trailIdx.current - 1 - i + TRAIL_COUNT * 100) % TRAIL_COUNT
          ];
        const mesh = children[i];
        if (mesh && pos) {
          mesh.position.copy(pos);
          const fade = 1 - age / TRAIL_COUNT;
          const sc = effect.size * 0.8 * fade * effect.trailFade;
          mesh.scale.setScalar(sc);
          if (mesh.material instanceof THREE.MeshBasicMaterial) {
            mesh.material.opacity = fade * 0.6;
          }
        }
      }
    }
  });

  const baseSize = effect.size * 2.5;

  return (
    <>
      {/* Trail particles (behind the orb) */}
      <group ref={trailRef}>
        {Array.from({ length: TRAIL_COUNT }, (_, i) => (
          <Billboard key={`trail-${i}`}>
            <mesh geometry={planeGeo}>
              <meshBasicMaterial
                map={outerTex}
                transparent
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                side={THREE.DoubleSide}
                fog={false}
                opacity={0.4}
              />
            </mesh>
          </Billboard>
        ))}
      </group>

      {/* Main orb */}
      <group ref={groupRef}>
        {/* Outer glow layer */}
        <Billboard>
          <mesh
            geometry={planeGeo}
            material={outerMat}
            scale={baseSize * 1.8}
          />
        </Billboard>

        {/* Core glow layer */}
        <Billboard>
          <mesh geometry={planeGeo} material={coreMat} scale={baseSize} />
        </Billboard>

        {/* Orbiting sparks (bolt-tier) */}
        {effect.pulseSpeed > 0 &&
          [0, 1, 2, 3].map((i) => (
            <SparkOrbit
              key={i}
              index={i}
              radius={baseSize * 0.7}
              tex={coreTex}
            />
          ))}

        {/* Point light for scene illumination */}
        <pointLight
          color={effect.color}
          intensity={effect.glowIntensity * 3}
          distance={4}
        />
      </group>
    </>
  );
};

const SparkOrbit: React.FC<{
  index: number;
  radius: number;
  tex: THREE.DataTexture;
}> = ({ index, radius, tex }) => {
  const ref = useRef<THREE.Group>(null);
  const sparkMat = useMemo(() => makeGlowMaterial(tex), [tex]);
  const planeGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  useFrame(({ clock, camera }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const angle = t * 3 + (index / 4) * Math.PI * 2;
    ref.current.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle * 1.5) * radius * 0.3,
      Math.sin(angle) * radius,
    );
    ref.current.quaternion.copy(camera.quaternion);
    const pulse = 0.7 + Math.sin(t * 5 + index) * 0.3;
    ref.current.scale.setScalar(0.15 * pulse);
  });

  return (
    <group ref={ref}>
      <mesh geometry={planeGeo} material={sparkMat} />
    </group>
  );
};

// ---------------------------------------------------------------------------
// ArrowPreview — shaft cylinder + cone head with metallic finish
// ---------------------------------------------------------------------------

const ArrowMesh: React.FC<{ effect: ArrowEffect }> = ({ effect }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.5;
    }
  });

  const len = effect.length * 4;
  const w = effect.width * 4;

  return (
    <group ref={groupRef} rotation={[0, 0, Math.PI / 6]}>
      {/* Shaft */}
      <mesh>
        <cylinderGeometry args={[w * 0.4, w * 0.4, len * 0.7, 8]} />
        <meshStandardMaterial color={effect.shaftColor} roughness={0.7} />
      </mesh>

      {/* Head (cone) */}
      <mesh position={[0, len * 0.45, 0]}>
        <coneGeometry args={[w * 1.4, len * 0.22, 8]} />
        <meshStandardMaterial
          color={effect.headColor}
          metalness={0.7}
          roughness={0.2}
        />
      </mesh>

      {/* Fletching fins */}
      {[0, 1, 2].map((i) => {
        const angle = (i / 3) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * w * 0.7,
              -len * 0.35,
              Math.sin(angle) * w * 0.7,
            ]}
            rotation={[0, -angle, Math.PI * 0.12]}
          >
            <planeGeometry args={[w * 1.8, len * 0.15]} />
            <meshStandardMaterial
              color={effect.fletchingColor}
              side={THREE.DoubleSide}
              transparent
              opacity={0.85}
            />
          </mesh>
        );
      })}
    </group>
  );
};

// ---------------------------------------------------------------------------
// GlowPreview — faithful instanced billboard particles with glow textures
// ---------------------------------------------------------------------------

interface GlowSeed {
  type: "pillar" | "wisp" | "spark" | "base" | "riseSpread";
  color: number;
  phase: number;
  lifetime: number;
  // pillar
  swayPhase?: number;
  bobSpeed?: number;
  // wisp
  orbitAngle?: number;
  orbitR?: number;
  height?: number;
  // spark
  angle?: number;
  driftR?: number;
  // base
  baseAngle?: number;
  orbitSpeed?: number;
  // riseSpread
  offsetX?: number;
  offsetZ?: number;
  speed?: number;
  baseScale?: number;
}

function buildGlowSeeds(effect: GlowEffect): GlowSeed[] {
  const seeds: GlowSeed[] = [];
  const palette = effect.palette.map((p) =>
    parseInt(p.hex.replace("#", ""), 16),
  );

  if (effect.id === "altar_glow") {
    // Pillar × 2
    for (let i = 0; i < 2; i++) {
      seeds.push({
        type: "pillar",
        color: palette[0] ?? 0xc4b5fd,
        phase: Math.random() * 10,
        lifetime: 4 + Math.random() * 2,
        swayPhase: Math.random() * Math.PI * 2,
        bobSpeed: 0.8 + Math.random() * 0.4,
      });
    }
    // Wisp × 10
    for (let i = 0; i < 10; i++) {
      seeds.push({
        type: "wisp",
        color: palette[1] ?? 0x8b5cf6,
        phase: Math.random() * 10,
        lifetime: 3 + Math.random() * 3,
        orbitAngle: Math.random() * Math.PI * 2,
        orbitR: 0.4 + Math.random() * 0.2,
        height: 0.2 + Math.random() * 0.5,
      });
    }
    // Spark × 14
    for (let i = 0; i < 14; i++) {
      seeds.push({
        type: "spark",
        color: palette[0] ?? 0xc4b5fd,
        phase: Math.random() * 10,
        lifetime: 1.2 + Math.random() * 1.5,
        angle: Math.random() * Math.PI * 2,
        driftR: 0.15 + Math.random() * 0.15,
      });
    }
    // Base × 4
    for (let i = 0; i < 4; i++) {
      seeds.push({
        type: "base",
        color: palette[1] ?? 0x8b5cf6,
        phase: Math.random() * 10,
        lifetime: 5 + Math.random() * 3,
        baseAngle: (i / 4) * Math.PI * 2,
        orbitSpeed: 0.3 + Math.random() * 0.2,
        orbitR: 0.35 + Math.random() * 0.15,
      });
    }
  } else {
    // Fire or torch — riseSpread particles
    const count = effect.id === "fire_glow" ? 18 : 6;
    for (let i = 0; i < count; i++) {
      const cidx = Math.floor(Math.random() * palette.length);
      seeds.push({
        type: "riseSpread",
        color: palette[cidx] ?? 0xff6600,
        phase: Math.random() * 10,
        lifetime:
          effect.id === "fire_glow"
            ? 0.5 + Math.random() * 0.7
            : 0.4 + Math.random() * 0.5,
        offsetX:
          (Math.random() - 0.5) * (effect.id === "fire_glow" ? 0.25 : 0.08),
        offsetZ:
          (Math.random() - 0.5) * (effect.id === "fire_glow" ? 0.25 : 0.08),
        speed:
          effect.id === "fire_glow"
            ? 0.6 + Math.random() * 0.8
            : 0.8 + Math.random() * 0.9,
        baseScale:
          effect.id === "fire_glow"
            ? 0.18 + Math.random() * 0.22
            : 0.1 + Math.random() * 0.12,
      });
    }
  }

  return seeds;
}

const GlowParticles: React.FC<{ effect: GlowEffect }> = ({ effect }) => {
  const seeds = useMemo(() => buildGlowSeeds(effect), [effect]);
  const count = seeds.length;

  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Build a combined glow texture using the first palette color
  const primaryColor = useMemo(
    () => parseInt(effect.palette[0]?.hex.replace("#", "") ?? "ffffff", 16),
    [effect.palette],
  );
  const glowTex = useMemo(() => createGlowTexture(0xffffff, 64, 2.5), []);
  const glowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: glowTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      }),
    [glowTex],
  );

  // Per-instance color attribute
  const colorArray = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const c = new THREE.Color(seeds[i].color);
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, [seeds, count]);

  useEffect(() => {
    if (!meshRef.current) return;
    const geo = meshRef.current.geometry;
    geo.setAttribute(
      "color",
      new THREE.InstancedBufferAttribute(colorArray, 3),
    );
    (meshRef.current.material as THREE.MeshBasicMaterial).vertexColors = true;
  }, [colorArray]);

  useFrame(({ clock, camera }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();

    for (let i = 0; i < count; i++) {
      const s = seeds[i];
      const cycleT = ((t + s.phase) % s.lifetime) / s.lifetime; // 0..1

      let x = 0,
        y = 0,
        z = 0,
        scale = 0.15,
        opacity = 1;

      switch (s.type) {
        case "pillar": {
          const bob = Math.sin(t * (s.bobSpeed ?? 1) + s.phase) * 0.12;
          const sway = Math.sin(t * 0.5 + (s.swayPhase ?? 0)) * 0.06;
          x = sway;
          y = 0.5 + bob;
          z = Math.cos(t * 0.3 + s.phase) * 0.04;
          scale = 0.5 + Math.sin(t * 0.7 + s.phase) * 0.08;
          opacity = 0.3 + Math.sin(t * 0.5 + s.phase) * 0.1;
          break;
        }
        case "wisp": {
          const angle = (s.orbitAngle ?? 0) + cycleT * Math.PI * 2;
          const r =
            (s.orbitR ?? 0.5) * (0.8 + Math.sin(cycleT * Math.PI * 2) * 0.2);
          x = Math.cos(angle) * r;
          y = (s.height ?? 0.3) + Math.sin(cycleT * Math.PI * 2.5) * 0.3;
          z = Math.sin(angle) * r;
          scale = 0.12 + Math.sin(cycleT * Math.PI * 3) * 0.03;
          const fadeIn = Math.min(cycleT * 3, 1);
          const fadeOut = Math.min((1 - cycleT) * 3, 1);
          opacity = 0.5 * fadeIn * fadeOut;
          break;
        }
        case "spark": {
          const drift =
            Math.sin((s.angle ?? 0) + cycleT * 2) * (s.driftR ?? 0.15);
          x = drift;
          y = -0.2 + cycleT * 1.8;
          z = Math.cos((s.angle ?? 0) + cycleT * 1.5) * (s.driftR ?? 0.15);
          scale = 0.06 * (1 - cycleT * 0.5);
          const sIn = Math.min(cycleT * 8, 1);
          const sOut = Math.pow(1 - cycleT, 1.5);
          opacity = 0.85 * sIn * sOut;
          break;
        }
        case "base": {
          const bAngle = (s.baseAngle ?? 0) + t * (s.orbitSpeed ?? 0.3);
          const bR = s.orbitR ?? 0.4;
          x = Math.cos(bAngle) * bR;
          y = -0.35;
          z = Math.sin(bAngle) * bR;
          scale = 0.3 + Math.sin(t * 0.8 + s.phase) * 0.04;
          opacity = 0.15 + Math.sin(t * 0.8) * 0.06;
          break;
        }
        case "riseSpread": {
          x = (s.offsetX ?? 0) * (1 + cycleT * 0.5);
          y = -0.2 + cycleT * (s.speed ?? 1);
          z = (s.offsetZ ?? 0) * (1 + cycleT * 0.5);
          scale = (s.baseScale ?? 0.2) * (1 - cycleT * 0.7);
          const fIn = Math.min(cycleT * 10, 1);
          const fOut = Math.pow(1 - cycleT, 1.2);
          opacity = 0.9 * fIn * fOut;
          break;
        }
      }

      // Billboard: face camera
      dummy.position.set(x, y, z);
      dummy.quaternion.copy(camera.quaternion);
      // Scale with Y stretch for fire
      if (s.type === "riseSpread") {
        dummy.scale.set(scale, scale * 1.3, scale);
      } else {
        dummy.scale.setScalar(scale);
      }
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[new THREE.PlaneGeometry(1, 1), glowMat, count]}
    />
  );
};

// ---------------------------------------------------------------------------
// WaterPreview — splash arcs, bubble rise, shimmer twinkle, ripple rings
// ---------------------------------------------------------------------------

interface WaterSeed {
  type: "splash" | "bubble" | "shimmer" | "ripple";
  angle: number;
  radius: number;
  phase: number;
  lifetime: number;
  peakHeight?: number;
  wobbleFreq?: number;
}

function buildWaterSeeds(effect: FishingEffect): WaterSeed[] {
  const seeds: WaterSeed[] = [];
  const splashCount =
    (effect.params.find((p) => p.label === "Splash Count")?.value as number) ??
    5;
  const bubbleCount =
    (effect.params.find((p) => p.label === "Bubble Count")?.value as number) ??
    4;
  const shimmerCount =
    (effect.params.find((p) => p.label === "Shimmer Count")?.value as number) ??
    4;

  for (let i = 0; i < splashCount; i++) {
    seeds.push({
      type: "splash",
      angle: Math.random() * Math.PI * 2,
      radius: 0.05 + Math.random() * 0.3,
      phase: Math.random() * 10,
      lifetime: 0.6 + Math.random() * 0.6,
      peakHeight: 0.12 + Math.random() * 0.2,
    });
  }
  for (let i = 0; i < bubbleCount; i++) {
    seeds.push({
      type: "bubble",
      angle: Math.random() * Math.PI * 2,
      radius: 0.04 + Math.random() * 0.2,
      phase: Math.random() * 10,
      lifetime: 1.2 + Math.random() * 1.3,
      peakHeight: 0.3 + Math.random() * 0.25,
      wobbleFreq: 3 + Math.random() * 4,
    });
  }
  for (let i = 0; i < shimmerCount; i++) {
    seeds.push({
      type: "shimmer",
      angle: Math.random() * Math.PI * 2,
      radius: 0.15 + Math.random() * 0.45,
      phase: Math.random() * 10,
      lifetime: 1.5 + Math.random() * 1.5,
    });
  }
  // 2 ripple rings
  for (let i = 0; i < 2; i++) {
    seeds.push({
      type: "ripple",
      angle: 0,
      radius: 0,
      phase: i * 0.5,
      lifetime: 2,
    });
  }

  return seeds;
}

const WaterParticles: React.FC<{ effect: FishingEffect }> = ({ effect }) => {
  const seeds = useMemo(() => buildWaterSeeds(effect), [effect]);

  // Separate out ripple seeds (rendered differently)
  const particleSeeds = useMemo(
    () => seeds.filter((s) => s.type !== "ripple"),
    [seeds],
  );
  const rippleSeeds = useMemo(
    () => seeds.filter((s) => s.type === "ripple"),
    [seeds],
  );

  const pCount = particleSeeds.length;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const rippleRefs = useRef<(THREE.Mesh | null)[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const splashColor = useMemo(
    () => new THREE.Color(effect.splashColor),
    [effect.splashColor],
  );
  const bubbleColor = useMemo(
    () => new THREE.Color(effect.bubbleColor),
    [effect.bubbleColor],
  );
  const shimmerColor = useMemo(
    () => new THREE.Color(effect.shimmerColor),
    [effect.shimmerColor],
  );
  const baseColor = useMemo(
    () => new THREE.Color(effect.baseColor),
    [effect.baseColor],
  );

  const glowTex = useMemo(() => createGlowTexture(0xffffff, 64, 2.0), []);
  const ringTex = useMemo(
    () => createRingTexture(0xffffff, 64, 0.65, 0.22),
    [],
  );

  const particleMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: glowTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
        vertexColors: true,
      }),
    [glowTex],
  );

  const ringMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: ringTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
        color: baseColor,
      }),
    [ringTex, baseColor],
  );

  // Per-instance colors
  const colorArray = useMemo(() => {
    const arr = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const s = particleSeeds[i];
      const c =
        s.type === "splash"
          ? splashColor
          : s.type === "bubble"
            ? bubbleColor
            : shimmerColor;
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, [pCount, particleSeeds, splashColor, bubbleColor, shimmerColor]);

  useEffect(() => {
    if (!meshRef.current) return;
    meshRef.current.geometry.setAttribute(
      "color",
      new THREE.InstancedBufferAttribute(colorArray, 3),
    );
  }, [colorArray]);

  const rippleSpeed =
    (effect.params.find((p) => p.label === "Ripple Speed")?.value as number) ??
    1;

  useFrame(({ clock, camera }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();

    for (let i = 0; i < pCount; i++) {
      const s = particleSeeds[i];
      const cycleT = ((t + s.phase) % s.lifetime) / s.lifetime;

      let x = 0,
        y = 0,
        z = 0,
        scale = 0.055;

      switch (s.type) {
        case "splash": {
          x = Math.cos(s.angle) * s.radius;
          z = Math.sin(s.angle) * s.radius;
          y = 4 * (s.peakHeight ?? 0.2) * cycleT * (1 - cycleT) + 0.08;
          const fadeIn = Math.min(cycleT * 12, 1);
          const fadeOut = Math.pow(1 - cycleT, 1.2);
          scale = 0.055 * fadeIn * fadeOut;
          break;
        }
        case "bubble": {
          const wobble =
            Math.sin(s.angle + cycleT * (s.wobbleFreq ?? 5)) * s.radius;
          x = wobble;
          y = 0.03 + cycleT * (s.peakHeight ?? 0.4);
          z = Math.cos(s.angle + cycleT * 2.5) * s.radius * 0.6;
          const bIn = Math.min(cycleT * 5, 1);
          const bOut = Math.pow(1 - cycleT, 1.5);
          scale = 0.09 * bIn * bOut;
          break;
        }
        case "shimmer": {
          x = Math.cos(s.angle + cycleT * 2) * s.radius;
          z = Math.sin(s.angle + cycleT * 2) * s.radius;
          y = 0.06;
          // Double sine twinkle
          const twinkle =
            Math.sin(cycleT * Math.PI * 4 + s.phase) *
            Math.sin(cycleT * Math.PI * 6 + s.phase * 1.7);
          const envelope =
            Math.min(cycleT * 3, 1) * Math.min((1 - cycleT) * 3, 1);
          scale = 0.055 * Math.abs(twinkle) * envelope;
          break;
        }
      }

      dummy.position.set(x, y, z);
      dummy.quaternion.copy(camera.quaternion);
      dummy.scale.setScalar(Math.max(scale, 0.001));
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;

    // Update ripple rings
    for (let i = 0; i < rippleSeeds.length; i++) {
      const mesh = rippleRefs.current[i];
      if (!mesh) continue;
      const s = rippleSeeds[i];
      const phase = ((t * rippleSpeed * 0.5 + s.phase) % 2) / 2;
      const sc = 0.15 + phase * 1.3;
      mesh.scale.setScalar(sc);
      const earlyFade = Math.min(phase / 0.15, 1);
      const lateFade = phase > 0.15 ? Math.pow((phase - 0.15) / 0.85, 1.5) : 0;
      const opacity = phase < 0.15 ? earlyFade * 0.5 : (1 - lateFade) * 0.5;
      if (mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.opacity = Math.max(opacity, 0);
      }
    }
  });

  return (
    <>
      {/* Water surface disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[0.7, 32]} />
        <meshBasicMaterial
          color={baseColor}
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Particle instances */}
      <instancedMesh
        ref={meshRef}
        args={[new THREE.PlaneGeometry(1, 1), particleMat, pCount]}
      />

      {/* Ripple rings */}
      {rippleSeeds.map((_, i) => (
        <mesh
          key={`ripple-${i}`}
          ref={(el) => {
            rippleRefs.current[i] = el;
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.01, 0]}
        >
          <circleGeometry args={[0.5, 24]} />
          <meshBasicMaterial
            map={ringTex}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
            color={baseColor}
            opacity={0.5}
          />
        </mesh>
      ))}
    </>
  );
};

// ---------------------------------------------------------------------------
// TeleportPreview — animated sequence: rune circle, beams, shockwaves,
//                   helix particles, burst particles
// ---------------------------------------------------------------------------

const TELEPORT_DURATION = 2.5;
const GATHER_END = 0.2;
const ERUPT_END = 0.34;
const SUSTAIN_END = 0.68;

function easeOutQuad(t: number) {
  return 1 - (1 - t) * (1 - t);
}
function easeInQuad(t: number) {
  return t * t;
}
function easeOutExpo(t: number) {
  return 1 - Math.pow(2, -10 * t);
}
function hermite(t: number): number {
  // Beam elastic curve: overshoot to 1.3 at 0.35, settle to 1.0
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < 0.35) {
    const p = t / 0.35;
    return p * p * (3 - 2 * p) * 1.3;
  }
  if (t < 0.65) {
    const p = (t - 0.35) / 0.3;
    return 1.3 - p * 0.35;
  }
  const p = (t - 0.65) / 0.35;
  return 0.95 + p * 0.05;
}

const TeleportScene: React.FC<{ effect: TeleportEffect }> = ({ effect }) => {
  const runeRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const innerBeamRef = useRef<THREE.Mesh>(null);
  const outerBeamRef = useRef<THREE.Mesh>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const shockwave1Ref = useRef<THREE.Mesh>(null);
  const shockwave2Ref = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const helixGroupRef = useRef<THREE.Group>(null);
  const burstGroupRef = useRef<THREE.Group>(null);

  // Create rune circle texture (canvas-based, matching engine)
  const runeTexture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const cx = size / 2;
    const cy = size / 2;

    // Radial gradient background
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
    grad.addColorStop(0, "rgba(102, 204, 255, 0.4)");
    grad.addColorStop(0.6, "rgba(102, 204, 255, 0.15)");
    grad.addColorStop(1, "rgba(102, 204, 255, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Concentric circles
    ctx.strokeStyle = "rgba(102, 204, 255, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 100, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 72, 0, Math.PI * 2);
    ctx.stroke();

    // Radial spokes
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(102, 204, 255, 0.5)";
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * 30, cy + Math.sin(angle) * 30);
      ctx.lineTo(cx + Math.cos(angle) * 100, cy + Math.sin(angle) * 100);
      ctx.stroke();
    }

    // Small circles at intersections
    ctx.fillStyle = "rgba(204, 255, 255, 0.7)";
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      for (const r of [72, 100]) {
        ctx.beginPath();
        ctx.arc(
          cx + Math.cos(angle) * r,
          cy + Math.sin(angle) * r,
          2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }

    // Triangular rune glyphs at mid-points
    ctx.fillStyle = "rgba(102, 204, 255, 0.6)";
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const mx = cx + Math.cos(angle) * 86;
      const my = cy + Math.sin(angle) * 86;
      ctx.beginPath();
      ctx.moveTo(mx, my - 6);
      ctx.lineTo(mx - 5, my + 4);
      ctx.lineTo(mx + 5, my + 4);
      ctx.closePath();
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  // Glow textures for various components
  const cyanGlow = useMemo(() => createGlowTexture(0x66ccff, 64, 2.0), []);
  const whiteGlow = useMemo(() => createGlowTexture(0xffffff, 64, 2.5), []);

  // Helix particle seeds
  const helixSeeds = useMemo(() => {
    const arr: {
      strand: number;
      idx: number;
      delay: number;
      riseSpeed: number;
      angularVel: number;
      color: number;
    }[] = [];
    for (let strand = 0; strand < 2; strand++) {
      for (let idx = 0; idx < 4; idx++) {
        arr.push({
          strand,
          idx,
          delay: idx * 0.04 + strand * 0.02,
          riseSpeed: 2.5 + idx * 0.25,
          angularVel: 3.0 + idx * 0.3,
          color: strand === 0 ? 0x66ccff : 0xccffff,
        });
      }
    }
    return arr;
  }, []);

  // Burst particle seeds
  const burstSeeds = useMemo(() => {
    const arr: {
      angle: number;
      upSpeed: number;
      hSpread: number;
      color: number;
    }[] = [];
    const colors = [0xffffff, 0xffffff, 0xffffff, 0x66ccff, 0x66ccff, 0xffdd66];
    for (let i = 0; i < 6; i++) {
      arr.push({
        angle: Math.random() * Math.PI * 2,
        upSpeed: 4 + Math.random() * 5,
        hSpread: 1 + Math.random() * 2,
        color: colors[i],
      });
    }
    return arr;
  }, []);

  useFrame(({ clock, camera }) => {
    // Loop the effect
    const rawT = clock.getElapsedTime();
    const loopT = rawT % (TELEPORT_DURATION + 0.8); // small pause between loops
    const progress = Math.min(loopT / TELEPORT_DURATION, 1);
    const life = loopT;

    // Phase progress values
    const gatherP = progress < GATHER_END ? progress / GATHER_END : 1;
    const eruptP =
      progress >= GATHER_END && progress < ERUPT_END
        ? (progress - GATHER_END) / (ERUPT_END - GATHER_END)
        : progress >= ERUPT_END
          ? 1
          : 0;
    const fadeP =
      progress >= SUSTAIN_END
        ? (progress - SUSTAIN_END) / (1 - SUSTAIN_END)
        : 0;

    // --- Rune circle ---
    if (runeRef.current) {
      const mat = runeRef.current.material as THREE.MeshBasicMaterial;
      if (progress < GATHER_END) {
        mat.opacity = easeOutQuad(gatherP) * 0.7;
        const sc = 0.5 + gatherP * 1.5;
        runeRef.current.scale.set(sc, sc, sc);
      } else if (progress < SUSTAIN_END) {
        mat.opacity = 0.7;
        runeRef.current.scale.setScalar(2);
      } else {
        mat.opacity = 0.7 * (1 - easeInQuad(fadeP));
      }
      runeRef.current.rotation.z +=
        0.02 * (progress < GATHER_END ? gatherP : 1);
    }

    // --- Base glow ---
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      const pulse = 1.5 + Math.sin(life * 6) * 0.2;
      glowRef.current.scale.setScalar(pulse);
      if (progress < GATHER_END) {
        mat.opacity = 0.8 * easeOutQuad(gatherP);
      } else if (progress < SUSTAIN_END) {
        mat.opacity = 0.8;
      } else {
        mat.opacity = 0.8 * (1 - easeInQuad(fadeP));
      }
    }

    // --- Beams ---
    const beamVisible = progress >= GATHER_END && progress <= 1;
    if (innerBeamRef.current) {
      innerBeamRef.current.visible = beamVisible;
      if (beamVisible) {
        const beamP = (progress - GATHER_END) / (1 - GATHER_END);
        const h = hermite(beamP);
        innerBeamRef.current.scale.set(1, h, 1);
        const mat = innerBeamRef.current.material as THREE.MeshBasicMaterial;
        if (progress < SUSTAIN_END) {
          mat.opacity = 0.85;
        } else {
          mat.opacity = 0.85 * (1 - easeInQuad(fadeP));
          const w = 1 - fadeP * 0.7;
          innerBeamRef.current.scale.x = w;
          innerBeamRef.current.scale.z = w;
        }
      }
    }
    if (outerBeamRef.current) {
      outerBeamRef.current.visible = beamVisible;
      if (beamVisible) {
        const beamP = Math.max(
          0,
          (progress - GATHER_END - 0.012) / (1 - GATHER_END),
        );
        const h = hermite(beamP);
        outerBeamRef.current.scale.set(1, h, 1);
        const mat = outerBeamRef.current.material as THREE.MeshBasicMaterial;
        if (progress < SUSTAIN_END) {
          mat.opacity = 0.5;
        } else {
          mat.opacity = 0.5 * (1 - easeInQuad(fadeP));
          const w = 1 - fadeP * 0.6;
          outerBeamRef.current.scale.x = w;
          outerBeamRef.current.scale.z = w;
        }
      }
    }

    // --- Core flash ---
    if (flashRef.current) {
      const flashStart = GATHER_END;
      const flashEnd = GATHER_END + 0.05;
      if (progress >= flashStart && progress <= flashEnd + 0.04) {
        flashRef.current.visible = true;
        const fp = (progress - flashStart) / 0.05;
        if (fp < 1) {
          flashRef.current.scale.setScalar(fp * 2.5);
        } else {
          const shrink = (progress - flashEnd) / 0.04;
          flashRef.current.scale.setScalar(2.5 * (1 - shrink));
        }
        (flashRef.current.material as THREE.MeshBasicMaterial).opacity =
          progress <= flashEnd ? 1 : 1 - (progress - flashEnd) / 0.04;
      } else {
        flashRef.current.visible = false;
      }
    }

    // --- Shockwaves ---
    const updateShockwave = (
      ref: React.RefObject<THREE.Mesh | null>,
      startT: number,
      duration: number,
      maxScale: number,
    ) => {
      const mesh = ref.current;
      if (!mesh) return;
      if (progress >= startT && progress <= startT + duration) {
        mesh.visible = true;
        const sp = (progress - startT) / duration;
        const eased = easeOutExpo(sp);
        mesh.scale.setScalar(1 + eased * (maxScale - 1));
        (mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - eased);
      } else {
        mesh.visible = false;
      }
    };
    updateShockwave(shockwave1Ref, GATHER_END, 0.08, 13);
    updateShockwave(shockwave2Ref, GATHER_END + 0.01, 0.09, 11);

    // --- Point light ---
    if (lightRef.current) {
      let intensity = 0;
      if (progress < GATHER_END) {
        intensity = 1.5 * gatherP;
      } else if (progress < ERUPT_END) {
        intensity = 1.5 + eruptP * 3.5;
      } else if (progress < SUSTAIN_END) {
        intensity = 3;
      } else {
        intensity = 3 * (1 - fadeP);
      }
      lightRef.current.intensity = intensity;
    }

    // --- Helix particles ---
    if (helixGroupRef.current) {
      const children = helixGroupRef.current.children as THREE.Mesh[];
      for (let i = 0; i < helixSeeds.length; i++) {
        const mesh = children[i];
        const s = helixSeeds[i];
        if (!mesh || progress < GATHER_END) {
          if (mesh) mesh.visible = false;
          continue;
        }
        mesh.visible = true;
        const pLife = life - GATHER_END * TELEPORT_DURATION - s.delay;
        if (pLife < 0) {
          mesh.visible = false;
          continue;
        }
        const cycleLife = pLife % 2;
        const height = cycleLife * s.riseSpeed;
        const radius = Math.max(0.1, 0.8 - cycleLife * 0.15);
        const angle = cycleLife * s.angularVel + s.strand * Math.PI;
        mesh.position.set(
          Math.cos(angle) * radius,
          height,
          Math.sin(angle) * radius,
        );
        mesh.quaternion.copy(camera.quaternion);
        const sc = (0.3 + s.idx * 0.05) * Math.max(0, 1 - height / 5);
        mesh.scale.setScalar(sc);
        if (progress > SUSTAIN_END) {
          const mat = mesh.material as THREE.MeshBasicMaterial;
          mat.opacity = 0.8 * (1 - easeInQuad(fadeP));
        }
      }
    }

    // --- Burst particles ---
    if (burstGroupRef.current) {
      const children = burstGroupRef.current.children as THREE.Mesh[];
      for (let i = 0; i < burstSeeds.length; i++) {
        const mesh = children[i];
        const s = burstSeeds[i];
        if (!mesh) continue;
        if (progress < GATHER_END) {
          mesh.visible = false;
          continue;
        }
        mesh.visible = true;
        const pLife = life - GATHER_END * TELEPORT_DURATION;
        if (pLife < 0) {
          mesh.visible = false;
          continue;
        }
        const bl = pLife % 1.8;
        const bx = Math.cos(s.angle) * s.hSpread * bl;
        const bz = Math.sin(s.angle) * s.hSpread * bl;
        const by = 0.5 + s.upSpeed * bl - 6 * bl * bl;
        if (by < -0.5) {
          mesh.visible = false;
          continue;
        }
        mesh.position.set(bx, by, bz);
        mesh.quaternion.copy(camera.quaternion);
        const sc = (0.25 + Math.random() * 0.1) * Math.max(0, 1 - bl / 1.8);
        mesh.scale.setScalar(sc);
      }
    }
  });

  return (
    <group>
      {/* Rune circle */}
      <mesh
        ref={runeRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
      >
        <circleGeometry args={[1.5, 32]} />
        <meshBasicMaterial
          map={runeTexture}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          opacity={0}
        />
      </mesh>

      {/* Base glow disc */}
      <Billboard>
        <mesh ref={glowRef} position={[0, 0.05, 0]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={cyanGlow}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
            opacity={0}
          />
        </mesh>
      </Billboard>

      {/* Inner beam */}
      <mesh ref={innerBeamRef} visible={false}>
        <cylinderGeometry args={[0.06, 0.12, 3, 12, 1, true]} />
        <meshBasicMaterial
          color={0xffffff}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          opacity={0.85}
        />
      </mesh>

      {/* Outer beam */}
      <mesh ref={outerBeamRef} visible={false}>
        <cylinderGeometry args={[0.03, 0.25, 2.6, 10, 1, true]} />
        <meshBasicMaterial
          color={0xaaddff}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          opacity={0.5}
        />
      </mesh>

      {/* Core flash */}
      <mesh ref={flashRef} visible={false}>
        <sphereGeometry args={[0.2, 8, 6]} />
        <meshBasicMaterial
          color={0xffffff}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          opacity={1}
        />
      </mesh>

      {/* Shockwave rings */}
      <mesh
        ref={shockwave1Ref}
        visible={false}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.05, 0]}
      >
        <ringGeometry args={[0.15, 0.4, 24]} />
        <meshBasicMaterial
          color={0xccffff}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          opacity={0.8}
        />
      </mesh>
      <mesh
        ref={shockwave2Ref}
        visible={false}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.05, 0]}
      >
        <ringGeometry args={[0.12, 0.35, 24]} />
        <meshBasicMaterial
          color={0x66ccff}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          opacity={0.8}
        />
      </mesh>

      {/* Helix particles */}
      <group ref={helixGroupRef}>
        {helixSeeds.map((s, i) => {
          const tex = createGlowTexture(s.color, 64, 3.0);
          return (
            <mesh key={`helix-${i}`} visible={false}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial
                map={tex}
                transparent
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                side={THREE.DoubleSide}
                opacity={0.8}
              />
            </mesh>
          );
        })}
      </group>

      {/* Burst particles */}
      <group ref={burstGroupRef}>
        {burstSeeds.map((s, i) => {
          const tex = createGlowTexture(s.color, 64, 3.0);
          return (
            <mesh key={`burst-${i}`} visible={false}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial
                map={tex}
                transparent
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                side={THREE.DoubleSide}
                opacity={0.8}
              />
            </mesh>
          );
        })}
      </group>

      {/* Point light */}
      <pointLight ref={lightRef} color={0x66ccff} intensity={0} distance={8} />
    </group>
  );
};

// ---------------------------------------------------------------------------
// DamageSplat canvas preview
// ---------------------------------------------------------------------------

const DamageSplatCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Draw hit splat (left)
    drawSplat(ctx, w * 0.25, h * 0.4, "#8b0000", "17");
    // Draw miss splat (right)
    drawSplat(ctx, w * 0.75, h * 0.4, "#000080", "0");

    // Labels
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "#999";
    ctx.fillText("Hit", w * 0.25, h * 0.78);
    ctx.fillText("Miss", w * 0.75, h * 0.78);

    // Animation description
    ctx.font = "10px Arial";
    ctx.fillStyle = "#666";
    ctx.fillText("Float up 1.5u over 1.5s, linear fade", w * 0.5, h * 0.92);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={160}
      className="w-full rounded border border-border-primary bg-black/30"
    />
  );
};

function drawSplat(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  bg: string,
  text: string,
) {
  const size = 50;
  const half = size / 2;
  const x = cx - half;
  const y = cy - half;
  const r = 12;

  // Rounded rect
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + size - r, y);
  ctx.quadraticCurveTo(x + size, y, x + size, y + r);
  ctx.lineTo(x + size, y + size - r);
  ctx.quadraticCurveTo(x + size, y + size, x + size - r, y + size);
  ctx.lineTo(x + r, y + size);
  ctx.quadraticCurveTo(x, y + size, x, y + size - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Text
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText(text, cx, cy);
}

// ---------------------------------------------------------------------------
// XP Drop canvas preview
// ---------------------------------------------------------------------------

const XPDropCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Draw XP drop examples
    drawXPDrop(ctx, w * 0.25, h * 0.35, "+35 XP");
    drawXPDrop(ctx, w * 0.5, h * 0.45, "+120 XP");
    drawXPDrop(ctx, w * 0.75, h * 0.35, "+8 XP");

    // Animation description
    ctx.font = "10px Arial";
    ctx.fillStyle = "#666";
    ctx.textAlign = "center";
    ctx.fillText(
      "Rise 2.5u with cubic ease-out, fade last 30%",
      w * 0.5,
      h * 0.88,
    );
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={160}
      className="w-full rounded border border-border-primary bg-black/30"
    />
  );
};

function drawXPDrop(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  text: string,
) {
  ctx.font = "bold 16px Arial";
  const tm = ctx.measureText(text);
  const pw = tm.width + 20;
  const ph = 26;
  const x = cx - pw / 2;
  const y = cy - ph / 2;
  const r = 8;

  // Background rounded rect
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + pw - r, y);
  ctx.quadraticCurveTo(x + pw, y, x + pw, y + r);
  ctx.lineTo(x + pw, y + ph - r);
  ctx.quadraticCurveTo(x + pw, y + ph, x + pw - r, y + ph);
  ctx.lineTo(x + r, y + ph);
  ctx.quadraticCurveTo(x, y + ph, x, y + ph - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fill();
  ctx.strokeStyle = "#c9a54a";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Text
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f2d08a";
  ctx.fillText(text, cx, cy);
}

// ---------------------------------------------------------------------------
// Scene wrapper
// ---------------------------------------------------------------------------

const PreviewScene: React.FC<{
  children: React.ReactNode;
  dark?: boolean;
}> = ({ children, dark }) => (
  <>
    <ambientLight intensity={dark ? 0.08 : 0.2} />
    <directionalLight position={[3, 4, 2]} intensity={dark ? 0.3 : 0.6} />
    <OrbitControls enableZoom enablePan={false} />
    {children}
  </>
);

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

function isSpell(e: VFXEffect): e is SpellEffect {
  return e.previewType === "spell";
}
function isArrow(e: VFXEffect): e is ArrowEffect {
  return e.previewType === "arrow";
}
function isGlow(e: VFXEffect): e is GlowEffect {
  return e.previewType === "glow";
}
function isWater(e: VFXEffect): e is FishingEffect {
  return e.previewType === "water";
}
function isTeleport(e: VFXEffect): e is TeleportEffect {
  return e.category === "teleport";
}

export const VFXPreview: React.FC<{ effect: VFXEffect }> = ({ effect }) => {
  // R3F live previews
  if (
    isSpell(effect) ||
    isArrow(effect) ||
    isGlow(effect) ||
    isWater(effect) ||
    isTeleport(effect)
  ) {
    const isDark = isSpell(effect) || isGlow(effect) || isTeleport(effect);
    return (
      <div className="w-full h-[320px] rounded-lg overflow-hidden border border-border-primary bg-black/60">
        <Canvas
          camera={{
            position: isTeleport(effect) ? [2.5, 2, 2.5] : [0, 0.5, 2.5],
            fov: 45,
          }}
          gl={{ antialias: true, alpha: true }}
        >
          <PreviewScene dark={isDark}>
            {isSpell(effect) && <SpellOrb effect={effect} />}
            {isArrow(effect) && <ArrowMesh effect={effect} />}
            {isGlow(effect) && <GlowParticles effect={effect} />}
            {isWater(effect) && <WaterParticles effect={effect} />}
            {isTeleport(effect) && <TeleportScene effect={effect} />}
          </PreviewScene>
        </Canvas>
      </div>
    );
  }

  // Canvas previews for combat HUD
  if (effect.category === "combatHud") {
    return (
      <div className="w-full rounded-lg overflow-hidden">
        {effect.id === "damage_splats" ? (
          <DamageSplatCanvas />
        ) : (
          <XPDropCanvas />
        )}
      </div>
    );
  }

  return null;
};
