import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bot,
  Box,
  Leaf,
  MessageCircle,
  Mic,
  Mountain,
  Pause,
  Play,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";
import "./styles.css";

type AgentId = "johnny" | "mira" | "sol";

type TerrainKind = "meadow" | "rock" | "snow" | "dirt" | "water";
type GeneratedKind =
  | "tree"
  | "flower"
  | "stone"
  | "animal"
  | "path"
  | "shrine"
  | "seed";

type ToolName = "generate" | "interact";

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface TellusAgent {
  id: AgentId;
  name: string;
  epithet: string;
  color: number;
  goal: string;
  position: Vec3;
  target: Vec3;
  nextActionAt: number;
}

interface GeneratedThing {
  id: string;
  kind: GeneratedKind;
  prompt: string;
  creatorId: AgentId | "visitor";
  position: Vec3;
  scale: number;
  color: number;
}

interface TellusLog {
  id: string;
  tick: number;
  agentId: AgentId | "visitor" | "world";
  agentName: string;
  tool: ToolName;
  text: string;
}

interface GenerateRequest {
  prompt: string;
  location: Vec3 | "near-agent" | "near-mountain" | "near-pond";
  scale?: number;
  creatorId: AgentId | "visitor";
}

interface InteractRequest {
  targetId: string;
  intent: string;
  actorId: AgentId | "visitor";
}

interface TellusSnapshot {
  agents: TellusAgent[];
  generated: GeneratedThing[];
  logs: TellusLog[];
  paused: boolean;
}

interface TellusWorldApi {
  generate(request: GenerateRequest): GeneratedThing;
  interact(request: InteractRequest): TellusLog;
  setPaused(paused: boolean): void;
  submitVisitorPrompt(prompt: string): void;
  snapshot(): TellusSnapshot;
  destroy(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const WORLD_RADIUS = 42;
const TERRAIN_SEGMENTS = 96;
const AGENT_SPEED = 5.2;
const PLAYER_SPEED = 13;
const TOOL_INTERVAL_MS = 3200;
const POND_CENTER: Vec3 = { x: 18, y: 0, z: -12 };
const POND_RADIUS = 7.4;

const terrainColors: Record<TerrainKind, THREE.Color> = {
  meadow: new THREE.Color(0x5f8f3d),
  rock: new THREE.Color(0x8f938a),
  snow: new THREE.Color(0xdfe8e5),
  dirt: new THREE.Color(0x8b6b43),
  water: new THREE.Color(0x4d88a8),
};

const agentSeeds: TellusAgent[] = [
  {
    id: "johnny",
    name: "Johnny",
    epithet: "orchard-maker",
    color: 0x7ec850,
    goal: "Plant orchards, seed groves, and make the disc feel generous.",
    position: { x: -15, y: 0, z: 11 },
    target: { x: -11, y: 0, z: 9 },
    nextActionAt: 0,
  },
  {
    id: "mira",
    name: "Mira",
    epithet: "naturalist",
    color: 0xe8b86d,
    goal: "Add animals, flowers, and small habitats around interesting places.",
    position: { x: 18, y: 0, z: 6 },
    target: { x: 13, y: 0, z: 4 },
    nextActionAt: 800,
  },
  {
    id: "sol",
    name: "Sol",
    epithet: "stone-dreamer",
    color: 0x98a7ff,
    goal: "Shape paths, shrines, stones, and mountain rituals.",
    position: { x: -5, y: 0, z: -21 },
    target: { x: -3, y: 0, z: -17 },
    nextActionAt: 1600,
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rand(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function distance2D(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function normalizedDiscPosition(x: number, z: number): Vec3 {
  const radius = Math.hypot(x, z);
  if (radius <= WORLD_RADIUS - 2) {
    return { x, y: terrainHeight(x, z), z };
  }
  const scale = (WORLD_RADIUS - 2) / radius;
  const nx = x * scale;
  const nz = z * scale;
  return { x: nx, y: terrainHeight(nx, nz), z: nz };
}

function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const mountain = Math.max(0, 1 - r / 18);
  const mound = Math.pow(mountain, 2.45) * 19;
  const ridge =
    Math.sin(x * 0.23 + z * 0.08) * 0.85 + Math.cos(z * 0.19 - x * 0.06) * 0.55;
  const rimDrop = Math.max(0, (r - 34) / 9) * 3.2;
  const pond = Math.exp(-((x - 18) ** 2 + (z + 12) ** 2) / 65) * 2.5;
  return mound + ridge - rimDrop - pond;
}

function terrainKind(x: number, z: number, y: number): TerrainKind {
  const pondDistance = Math.hypot(x - 18, z + 12);
  if (pondDistance < 7 && y < 1.9) return "water";
  if (y > 14) return "snow";
  if (y > 7.5) return "rock";
  const pathBand = Math.abs(Math.sin(Math.atan2(z, x) * 3 + 0.5)) < 0.13;
  if (pathBand && Math.hypot(x, z) > 8) return "dirt";
  return "meadow";
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function createTerrainGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let z = 0; z <= TERRAIN_SEGMENTS; z++) {
    const vz = (z / TERRAIN_SEGMENTS - 0.5) * WORLD_RADIUS * 2;
    for (let x = 0; x <= TERRAIN_SEGMENTS; x++) {
      const vx = (x / TERRAIN_SEGMENTS - 0.5) * WORLD_RADIUS * 2;
      const r = Math.hypot(vx, vz);
      const inside = r <= WORLD_RADIUS;
      const edgeScale = inside ? 1 : WORLD_RADIUS / r;
      const px = vx * edgeScale;
      const pz = vz * edgeScale;
      const py = inside ? terrainHeight(px, pz) : -4.5;
      const kind = inside ? terrainKind(px, pz, py) : "rock";
      const color = terrainColors[kind].clone();
      const noise = 0.9 + rand(x * 1009 + z * 9176) * 0.18;
      color.multiplyScalar(noise);
      positions.push(px, py, pz);
      colors.push(color.r, color.g, color.b);
    }
  }

  const row = TERRAIN_SEGMENTS + 1;
  for (let z = 0; z < TERRAIN_SEGMENTS; z++) {
    for (let x = 0; x < TERRAIN_SEGMENTS; x++) {
      const a = z * row + x;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createFloatingRim(): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(
    WORLD_RADIUS,
    WORLD_RADIUS * 0.82,
    9,
    128,
    1,
    true,
  );
  geometry.translate(0, -6.5, 0);
  const material = new THREE.MeshStandardMaterial({
    color: 0x6a5b48,
    roughness: 0.9,
    metalness: 0,
  });
  return new THREE.Mesh(geometry, material);
}

function createSkyDome(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(220, 48, 24);
  const material = new THREE.MeshBasicMaterial({
    color: 0x9fc9ee,
    side: THREE.BackSide,
  });
  return new THREE.Mesh(geometry, material);
}

function createPondWater(): THREE.Group {
  const group = new THREE.Group();
  group.name = "tellus-pond-water";
  group.userData = { waterSurface: true };

  const waterLevel = terrainHeight(POND_CENTER.x, POND_CENTER.z) + 0.55;
  const waterMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x5da7c6,
    roughness: 0.18,
    metalness: 0,
    transparent: true,
    opacity: 0.68,
    transmission: 0.18,
    thickness: 0.35,
    ior: 1.333,
  });
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(POND_RADIUS, 96),
    waterMaterial,
  );
  water.name = "tellus-pond-surface";
  water.rotation.x = -Math.PI / 2;
  water.position.set(POND_CENTER.x, waterLevel, POND_CENTER.z);
  water.renderOrder = 2;

  const rippleMaterial = new THREE.MeshBasicMaterial({
    color: 0xd3f2ff,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const rippleGeometry = new THREE.RingGeometry(0.88, 0.93, 96);
  const ripples = new THREE.Group();
  ripples.name = "tellus-pond-ripples";
  ripples.position.set(POND_CENTER.x, waterLevel + 0.035, POND_CENTER.z);
  ripples.rotation.x = -Math.PI / 2;

  for (let i = 0; i < 4; i++) {
    const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial.clone());
    const scale = POND_RADIUS * (0.28 + i * 0.18);
    ripple.scale.setScalar(scale);
    ripple.userData = { rippleIndex: i };
    ripples.add(ripple);
  }

  const shore = new THREE.Mesh(
    new THREE.RingGeometry(POND_RADIUS * 0.96, POND_RADIUS * 1.08, 128),
    new THREE.MeshStandardMaterial({
      color: 0x7b6b48,
      roughness: 0.95,
      metalness: 0,
    }),
  );
  shore.name = "tellus-pond-shore";
  shore.rotation.x = -Math.PI / 2;
  shore.position.set(POND_CENTER.x, waterLevel - 0.035, POND_CENTER.z);

  group.add(shore, water, ripples);
  return group;
}

function createCloud(seed: number): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    transparent: true,
    opacity: 0.55,
  });
  const count = 4 + Math.floor(rand(seed) * 4);
  for (let i = 0; i < count; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(2.5 + rand(seed + i) * 2, 12, 8),
      material,
    );
    puff.scale.y = 0.35;
    puff.position.set(
      (i - count / 2) * 2.5,
      rand(seed + i * 7) * 1.3,
      rand(seed + i * 13) * 2,
    );
    group.add(puff);
  }
  const angle = rand(seed * 2) * Math.PI * 2;
  const radius = 55 + rand(seed * 3) * 55;
  group.position.set(
    Math.cos(angle) * radius,
    34 + rand(seed * 4) * 18,
    Math.sin(angle) * radius,
  );
  return group;
}

function createAgentMesh(agent: TellusAgent): THREE.Group {
  const group = new THREE.Group();
  group.name = `agent-${agent.id}`;
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: agent.color,
    roughness: 0.72,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x182018,
    roughness: 0.8,
  });
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.55, 1.25, 6, 12),
    bodyMaterial,
  );
  body.position.y = 1.15;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.48, 16, 12),
    bodyMaterial,
  );
  head.position.y = 2.25;
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.7, 0.035, 8, 32),
    darkMaterial,
  );
  halo.position.y = 2.8;
  halo.rotation.x = Math.PI / 2;
  group.add(body, head, halo);
  return group;
}

function createVisitorMesh(): THREE.Group {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xf0d39a,
    roughness: 0.68,
  });
  const robeMaterial = new THREE.MeshStandardMaterial({
    color: 0x2f5947,
    roughness: 0.8,
  });
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.5, 1.2, 6, 12),
    robeMaterial,
  );
  body.position.y = 1.1;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.43, 16, 12),
    bodyMaterial,
  );
  head.position.y = 2.15;
  const marker = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.5, 16),
    bodyMaterial,
  );
  marker.position.set(0, 2.72, 0);
  group.add(body, head, marker);
  return group;
}

function inferGeneratedKind(
  prompt: string,
  agentId: AgentId | "visitor",
): GeneratedKind {
  const lower = prompt.toLowerCase();
  if (
    lower.includes("animal") ||
    lower.includes("fox") ||
    lower.includes("bird")
  )
    return "animal";
  if (lower.includes("flower") || lower.includes("moss")) return "flower";
  if (
    lower.includes("stone") ||
    lower.includes("rock") ||
    lower.includes("cairn")
  )
    return "stone";
  if (lower.includes("path") || lower.includes("trail")) return "path";
  if (lower.includes("shrine") || lower.includes("altar")) return "shrine";
  if (lower.includes("seed")) return "seed";
  if (agentId === "sol") return rand(Date.now()) > 0.55 ? "stone" : "shrine";
  if (agentId === "mira") return rand(Date.now()) > 0.5 ? "animal" : "flower";
  return "tree";
}

function kindColor(kind: GeneratedKind, prompt: string): number {
  if (kind === "tree")
    return prompt.toLowerCase().includes("apple") ? 0x68a845 : 0x4f8f3a;
  if (kind === "flower") return 0xe7a0cf;
  if (kind === "stone") return 0x9b9b90;
  if (kind === "animal") return 0xb9824b;
  if (kind === "path") return 0x9a7447;
  if (kind === "shrine") return 0x7d83b5;
  return 0xd3c17a;
}

function createGeneratedMesh(thing: GeneratedThing): THREE.Object3D {
  const material = new THREE.MeshStandardMaterial({
    color: thing.color,
    roughness: 0.85,
    metalness: 0,
  });
  const group = new THREE.Group();
  group.name = thing.id;
  group.userData = { tellusId: thing.id, kind: thing.kind };

  if (thing.kind === "tree") {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.22, 1.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x6d4a2d }),
    );
    trunk.position.y = 0.8 * thing.scale;
    trunk.scale.multiplyScalar(thing.scale);
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 14, 10),
      material,
    );
    crown.position.y = 1.95 * thing.scale;
    crown.scale.setScalar(thing.scale);
    const fruit = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xb9352d }),
    );
    fruit.position.set(
      0.35 * thing.scale,
      2.1 * thing.scale,
      0.32 * thing.scale,
    );
    group.add(trunk, crown, fruit);
  } else if (thing.kind === "flower") {
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.035, 0.55, 6),
      new THREE.MeshStandardMaterial({ color: 0x407a35 }),
    );
    stem.position.y = 0.28;
    const bloom = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 * thing.scale, 10, 8),
      material,
    );
    bloom.position.y = 0.62;
    group.add(stem, bloom);
  } else if (thing.kind === "animal") {
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 12, 8),
      material,
    );
    body.scale.set(1.5, 0.75, 0.8);
    body.position.y = 0.5;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 10, 8),
      material,
    );
    head.position.set(0.62, 0.58, 0);
    group.add(body, head);
  } else if (thing.kind === "path") {
    const path = new THREE.Mesh(
      new THREE.CylinderGeometry(
        1.2 * thing.scale,
        1.2 * thing.scale,
        0.05,
        18,
      ),
      material,
    );
    path.scale.z = 0.45;
    path.position.y = 0.03;
    group.add(path);
  } else if (thing.kind === "shrine") {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.9, 0.35, 6),
      material,
    );
    base.position.y = 0.18;
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 6), material);
    top.position.y = 0.9;
    group.add(base, top);
  } else {
    const seed = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.35 * thing.scale, 1),
      material,
    );
    seed.position.y = 0.32;
    group.add(seed);
  }

  group.position.set(thing.position.x, thing.position.y, thing.position.z);
  return group;
}

function chooseAgentPrompt(
  agent: TellusAgent,
  generated: GeneratedThing[],
): string {
  if (agent.id === "johnny") {
    const count = generated.filter(
      (thing) => thing.creatorId === "johnny" && thing.kind === "tree",
    ).length;
    return count % 3 === 0
      ? "a crooked apple tree with golden moss at its roots"
      : "a small ring of young apple trees facing the mountain";
  }
  if (agent.id === "mira") {
    return generated.length % 2 === 0
      ? "a curious amber fox nosing around the meadow"
      : "a patch of blue flowers where animals can rest";
  }
  return generated.length % 2 === 0
    ? "a hand-placed stone cairn that points toward the summit"
    : "a narrow dirt path spiraling gently toward the mountain";
}

function createTellusWorld(
  container: HTMLElement,
  onSnapshot: (snapshot: TellusSnapshot) => void,
): TellusWorldApi {
  let destroyed = false;
  let paused = false;
  let animationId = 0;
  let lastTime = performance.now();
  let tick = 0;
  let renderer: WebGPURenderer | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let renderIssueLogged = false;

  const agents = agentSeeds.map((agent) => ({
    ...agent,
    position: { ...agent.position },
    target: { ...agent.target },
  }));
  const generated: GeneratedThing[] = [];
  const logs: TellusLog[] = [];
  const generatedMeshes = new Map<string, THREE.Object3D>();
  const agentMeshes = new Map<AgentId, THREE.Group>();
  const keys = new Set<string>();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fc9ee);
  scene.fog = new THREE.Fog(0x9fc9ee, 90, 210);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 600);
  const terrain = new THREE.Mesh(
    createTerrainGeometry(),
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0,
    }),
  );
  terrain.receiveShadow = true;
  const pondWater = createPondWater();
  scene.add(createSkyDome(), terrain, pondWater, createFloatingRim());

  const sun = new THREE.DirectionalLight(0xfff4dc, 3.2);
  sun.position.set(-35, 70, 35);
  sun.castShadow = true;
  scene.add(sun, new THREE.HemisphereLight(0xaed7ff, 0x637347, 1.8));

  for (let i = 0; i < 14; i++) {
    scene.add(createCloud(100 + i * 19));
  }

  for (const agent of agents) {
    const mesh = createAgentMesh(agent);
    agentMeshes.set(agent.id, mesh);
    scene.add(mesh);
  }

  const visitor = createVisitorMesh();
  let visitorPosition = normalizedDiscPosition(0, 0);
  scene.add(visitor);

  let yaw = 0.76;
  let pitch = -0.55;
  let zoom = 18;
  let isDragging = false;
  let pointerX = 0;
  let pointerY = 0;

  const snapshot = (): TellusSnapshot => ({
    agents: agents.map((agent) => ({
      ...agent,
      position: { ...agent.position },
      target: { ...agent.target },
    })),
    generated: generated.map((thing) => ({
      ...thing,
      position: { ...thing.position },
    })),
    logs: logs.slice(-80),
    paused,
  });

  const publish = () => onSnapshot(snapshot());

  const addLog = (entry: Omit<TellusLog, "id" | "tick">): TellusLog => {
    const log: TellusLog = {
      id: makeId("log"),
      tick,
      ...entry,
    };
    logs.push(log);
    if (logs.length > 120) logs.shift();
    publish();
    return log;
  };

  const chooseLocation = (request: GenerateRequest): Vec3 => {
    if (typeof request.location === "object")
      return normalizedDiscPosition(request.location.x, request.location.z);
    if (request.location === "near-mountain") {
      const angle = rand(tick + generated.length) * Math.PI * 2;
      const radius = 8 + rand(tick + 3) * 13;
      return normalizedDiscPosition(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
      );
    }
    if (request.location === "near-pond")
      return normalizedDiscPosition(
        15 + rand(tick) * 8,
        -15 + rand(tick + 1) * 7,
      );
    const agent = agents.find((item) => item.id === request.creatorId);
    const origin = agent?.position ?? visitorPosition;
    const angle = rand(tick + generated.length * 17) * Math.PI * 2;
    const radius = 3 + rand(tick + 33) * 7;
    return normalizedDiscPosition(
      origin.x + Math.cos(angle) * radius,
      origin.z + Math.sin(angle) * radius,
    );
  };

  const generate = (request: GenerateRequest): GeneratedThing => {
    const kind = inferGeneratedKind(request.prompt, request.creatorId);
    const position = chooseLocation(request);
    const thing: GeneratedThing = {
      id: makeId(kind),
      kind,
      prompt: request.prompt,
      creatorId: request.creatorId,
      position,
      scale: request.scale ?? 0.75 + rand(tick + generated.length) * 0.8,
      color: kindColor(kind, request.prompt),
    };
    generated.push(thing);
    const mesh = createGeneratedMesh(thing);
    generatedMeshes.set(thing.id, mesh);
    scene.add(mesh);

    const actor = agents.find((agent) => agent.id === request.creatorId);
    addLog({
      agentId: request.creatorId,
      agentName: actor?.name ?? "Visitor",
      tool: "generate",
      text: `${actor?.name ?? "Visitor"} generated ${thing.kind}: ${request.prompt}`,
    });
    return thing;
  };

  const interact = (request: InteractRequest): TellusLog => {
    const actor = agents.find((agent) => agent.id === request.actorId);
    const target = generated.find((thing) => thing.id === request.targetId);
    return addLog({
      agentId: request.actorId,
      agentName: actor?.name ?? "Visitor",
      tool: "interact",
      text: `${actor?.name ?? "Visitor"} interacts with ${target?.kind ?? "the world"}: ${request.intent}`,
    });
  };

  const submitVisitorPrompt = (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    if (trimmed.toLowerCase().startsWith("ask ") && generated.length > 0) {
      interact({
        targetId: generated[generated.length - 1].id,
        intent: trimmed,
        actorId: "visitor",
      });
      return;
    }
    generate({
      prompt: trimmed,
      location: {
        x: visitorPosition.x + Math.sin(yaw) * 4,
        y: 0,
        z: visitorPosition.z + Math.cos(yaw) * 4,
      },
      creatorId: "visitor",
    });
  };

  const setPaused = (nextPaused: boolean) => {
    paused = nextPaused;
    publish();
  };

  const resize = () => {
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer?.setSize(width, height, false);
  };

  const moveVisitor = (delta: number) => {
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const movement = new THREE.Vector3();
    if (keys.has("w")) movement.add(forward);
    if (keys.has("s")) movement.sub(forward);
    if (keys.has("d")) movement.add(right);
    if (keys.has("a")) movement.sub(right);
    if (movement.lengthSq() === 0) return;
    movement.normalize().multiplyScalar(PLAYER_SPEED * delta);
    visitorPosition = normalizedDiscPosition(
      visitorPosition.x + movement.x,
      visitorPosition.z + movement.z,
    );
  };

  const moveAgents = (now: number, delta: number) => {
    for (const agent of agents) {
      if (distance2D(agent.position, agent.target) < 1.2) {
        const angle = rand(now * 0.001 + agent.position.x) * Math.PI * 2;
        const radius = 7 + rand(now * 0.002 + agent.position.z) * 22;
        agent.target = normalizedDiscPosition(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
        );
      }
      const direction = new THREE.Vector3(
        agent.target.x - agent.position.x,
        0,
        agent.target.z - agent.position.z,
      );
      if (direction.lengthSq() > 0.001) {
        direction.normalize().multiplyScalar(AGENT_SPEED * delta);
        agent.position = normalizedDiscPosition(
          agent.position.x + direction.x,
          agent.position.z + direction.z,
        );
      }

      if (!paused && now >= agent.nextActionAt) {
        const shouldInteract =
          generated.length > 3 && rand(now + agent.color) > 0.68;
        if (shouldInteract) {
          const target =
            generated[
              Math.floor(rand(now + agent.position.x) * generated.length)
            ];
          interact({
            targetId: target.id,
            actorId: agent.id,
            intent:
              agent.id === "johnny"
                ? "check whether it needs shade, water, or a nearby sapling"
                : agent.id === "mira"
                  ? "study how it changes the local habitat"
                  : "decide whether it belongs in the mountain pattern",
          });
        } else {
          generate({
            prompt: chooseAgentPrompt(agent, generated),
            location:
              agent.id === "sol"
                ? "near-mountain"
                : agent.id === "mira"
                  ? "near-pond"
                  : "near-agent",
            creatorId: agent.id,
          });
        }
        agent.nextActionAt =
          now + TOOL_INTERVAL_MS + rand(now + agent.color) * 2400;
      }
    }
  };

  const syncMeshes = (now: number) => {
    visitor.position.set(
      visitorPosition.x,
      visitorPosition.y,
      visitorPosition.z,
    );
    visitor.rotation.y = yaw;

    const pondSurface = pondWater.getObjectByName("tellus-pond-surface");
    if (pondSurface) {
      pondSurface.position.y =
        terrainHeight(POND_CENTER.x, POND_CENTER.z) +
        0.55 +
        Math.sin(now * 0.0018) * 0.045;
      pondSurface.rotation.z = Math.sin(now * 0.0004) * 0.08;
    }

    const ripples = pondWater.getObjectByName("tellus-pond-ripples");
    if (ripples) {
      ripples.children.forEach((child, index) => {
        const phase = (now * 0.00028 + index * 0.23) % 1;
        const scale = POND_RADIUS * (0.22 + phase * 0.72);
        child.scale.setScalar(scale);
        const material = (child as THREE.Mesh).material;
        if (material instanceof THREE.MeshBasicMaterial) {
          material.opacity = Math.max(0, 0.32 * (1 - phase));
        }
      });
    }

    for (const agent of agents) {
      const mesh = agentMeshes.get(agent.id);
      if (!mesh) continue;
      mesh.position.set(agent.position.x, agent.position.y, agent.position.z);
      mesh.lookAt(agent.target.x, agent.position.y, agent.target.z);
      mesh.position.y += Math.sin(now * 0.004 + agent.color) * 0.08;
    }

    let index = 0;
    for (const mesh of generatedMeshes.values()) {
      mesh.rotation.y += 0.02 * Math.sin(now * 0.0007 + index);
      index++;
    }
  };

  const updateCamera = () => {
    const target = new THREE.Vector3(
      visitorPosition.x,
      visitorPosition.y + 1.8,
      visitorPosition.z,
    );
    const offset = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch) * -zoom,
      Math.sin(-pitch) * zoom + 4,
      Math.cos(yaw) * Math.cos(pitch) * -zoom,
    );
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
  };

  const animate = async () => {
    if (destroyed || !renderer) return;
    const now = performance.now();
    const delta = clamp((now - lastTime) / 1000, 0, 0.05);
    lastTime = now;
    tick++;
    moveVisitor(delta);
    moveAgents(now, delta);
    syncMeshes(now);
    updateCamera();
    try {
      await renderer.renderAsync(scene, camera);
    } catch (error) {
      if (!renderIssueLogged) {
        renderIssueLogged = true;
        addLog({
          agentId: "world",
          agentName: "Tellus",
          tool: "interact",
          text: `WebGPU render failed: ${error instanceof Error ? error.message : "unknown renderer error"}`,
        });
      }
    }
    if (!destroyed) {
      animationId = requestAnimationFrame(() => void animate());
    }
  };

  const handleKeyDown = (event: KeyboardEvent) =>
    keys.add(event.key.toLowerCase());
  const handleKeyUp = (event: KeyboardEvent) =>
    keys.delete(event.key.toLowerCase());
  const handlePointerDown = (event: PointerEvent) => {
    isDragging = true;
    pointerX = event.clientX;
    pointerY = event.clientY;
  };
  const handlePointerMove = (event: PointerEvent) => {
    if (!isDragging) return;
    const dx = event.clientX - pointerX;
    const dy = event.clientY - pointerY;
    pointerX = event.clientX;
    pointerY = event.clientY;
    yaw -= dx * 0.006;
    pitch = clamp(pitch - dy * 0.003, -0.95, -0.18);
  };
  const handlePointerUp = () => {
    isDragging = false;
  };
  const handleWheel = (event: WheelEvent) => {
    zoom = clamp(zoom + event.deltaY * 0.01, 9, 34);
  };

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  container.addEventListener("pointerdown", handlePointerDown);
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);
  container.addEventListener("wheel", handleWheel, { passive: true });

  const init = async () => {
    if (!("gpu" in navigator)) {
      addLog({
        agentId: "world",
        agentName: "Tellus",
        tool: "interact",
        text: "WebGPU is not available in this browser. Tellus needs WebGPU.",
      });
      return;
    }

    try {
      renderer = new WebGPURenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      await renderer.init();
      container.appendChild(renderer.domElement);
      resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(container);
      resize();
      requestAnimationFrame(resize);
      publish();
      for (const agent of agents) {
        addLog({
          agentId: agent.id,
          agentName: agent.name,
          tool: "interact",
          text: `${agent.name} arrives: ${agent.goal}`,
        });
      }
      void animate();
    } catch (error) {
      addLog({
        agentId: "world",
        agentName: "Tellus",
        tool: "interact",
        text: `WebGPU initialization failed: ${error instanceof Error ? error.message : "unknown initialization error"}`,
      });
    }
  };

  void init();

  return {
    generate,
    interact,
    setPaused,
    submitVisitorPrompt,
    snapshot,
    destroy: () => {
      destroyed = true;
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      container.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      container.removeEventListener("wheel", handleWheel);
      resizeObserver?.disconnect();
      renderer?.dispose();
      if (renderer?.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}

function useSpeechInput(onText: (text: string) => void): {
  listening: boolean;
  supported: boolean;
  start: () => void;
} {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const supported =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const start = () => {
    const Recognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition || listening) return;

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const result = event.results[0]?.[0]?.transcript;
      if (result) onText(result);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  return { listening, supported, start };
}

function App(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<TellusWorldApi | null>(null);
  const [snapshot, setSnapshot] = useState<TellusSnapshot>({
    agents: agentSeeds,
    generated: [],
    logs: [],
    paused: false,
  });
  const [prompt, setPrompt] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<AgentId>("johnny");
  const { listening, supported, start } = useSpeechInput((text) =>
    setPrompt(text),
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const world = createTellusWorld(container, setSnapshot);
    worldRef.current = world;
    return () => {
      world.destroy();
      worldRef.current = null;
    };
  }, []);

  const selected = useMemo(
    () =>
      snapshot.agents.find((agent) => agent.id === selectedAgent) ??
      snapshot.agents[0],
    [selectedAgent, snapshot.agents],
  );

  const submitPrompt = () => {
    worldRef.current?.submitVisitorPrompt(prompt);
    setPrompt("");
  };

  const askSelectedAgent = () => {
    if (!prompt.trim() || !selected) return;
    worldRef.current?.interact({
      actorId: "visitor",
      targetId:
        snapshot.generated[snapshot.generated.length - 1]?.id ?? selected.id,
      intent: `ask ${selected.name}: ${prompt.trim()}`,
    });
    setPrompt("");
  };

  const recentLogs = snapshot.logs.slice(-10).reverse();

  return (
    <main className="tellus-shell">
      <section className="world-panel" aria-label="Tellus world">
        <div ref={containerRef} className="world-canvas" />
        <div className="brand-mark">
          <span>Tellus</span>
          <small>AI terrarium</small>
        </div>
        <div className="world-help">
          <span>WASD</span>
          <span>drag to look</span>
          <span>scroll to zoom</span>
        </div>
      </section>

      <aside className="control-panel">
        <header className="panel-header">
          <div>
            <p>Living World MVP</p>
            <h1>Tellus</h1>
          </div>
          <button
            type="button"
            className="icon-button"
            title={snapshot.paused ? "Resume agents" : "Pause agents"}
            onClick={() => worldRef.current?.setPaused(!snapshot.paused)}
          >
            {snapshot.paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
        </header>

        <div className="stat-grid">
          <div>
            <Box size={16} />
            <strong>{snapshot.generated.length}</strong>
            <span>generated</span>
          </div>
          <div>
            <Bot size={16} />
            <strong>{snapshot.agents.length}</strong>
            <span>agents</span>
          </div>
          <div>
            <Mountain size={16} />
            <strong>1</strong>
            <span>disc</span>
          </div>
        </div>

        <section className="tool-card">
          <div className="tool-title">
            <Wand2 size={16} />
            <span>Two tools</span>
          </div>
          <div className="tool-list">
            <code>generate(request)</code>
            <code>interact(target, intent)</code>
          </div>
        </section>

        <section className="prompt-card">
          <label htmlFor="tellus-prompt">Speak or type a world request</label>
          <textarea
            id="tellus-prompt"
            value={prompt}
            rows={4}
            placeholder="make a crooked apple tree with golden moss..."
            onChange={(event) => setPrompt(event.target.value)}
          />
          <div className="prompt-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={!supported || listening}
              onClick={start}
            >
              <Mic size={16} />
              <span>{listening ? "Listening" : "Voice"}</span>
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={askSelectedAgent}
            >
              <MessageCircle size={16} />
              <span>Discuss</span>
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={submitPrompt}
            >
              <Send size={16} />
              <span>Generate</span>
            </button>
          </div>
        </section>

        <section className="agents-card">
          <div className="section-heading">
            <Sparkles size={16} />
            <span>Nemotrons</span>
          </div>
          <div className="agent-list">
            {snapshot.agents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                className={
                  agent.id === selectedAgent ? "agent-row active" : "agent-row"
                }
                onClick={() => setSelectedAgent(agent.id)}
              >
                <span
                  className="agent-dot"
                  style={{
                    backgroundColor: `#${agent.color.toString(16).padStart(6, "0")}`,
                  }}
                />
                <span>
                  <strong>{agent.name}</strong>
                  <small>{agent.epithet}</small>
                </span>
              </button>
            ))}
          </div>
          {selected && <p className="agent-goal">{selected.goal}</p>}
        </section>

        <section className="log-card">
          <div className="section-heading">
            <Leaf size={16} />
            <span>World log</span>
          </div>
          <div className="log-list">
            {recentLogs.map((log) => (
              <article key={log.id} className={`log-entry ${log.tool}`}>
                <strong>{log.tool}</strong>
                <p>{log.text}</p>
              </article>
            ))}
          </div>
        </section>
      </aside>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("Tellus root element was not found");
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
