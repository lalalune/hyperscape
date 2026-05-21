/**
 * GameWorldEntitySync — Places ALL manifest entities from world-areas.json
 * into the World Studio scene for exact game parity.
 *
 * Creates visual markers for:
 * - NPCs (capsule shapes, color-coded by type with floating name labels)
 * - Stations (box shapes, color-coded by type)
 * - Resources: Mining rocks (colored dodecahedrons), Trees (procgen species), Fishing spots (blue spheres)
 * - Mob spawns (transparent red cylinders showing spawn radius + markers)
 * - Area boundary outlines
 *
 * Fetches world-areas.json from the manifest API and converts game coordinates
 * to render coordinates using the worldCenterOffset.
 */

import * as THREE from "three/webgpu";
import {
  MeshStandardNodeMaterial,
  MeshBasicNodeMaterial,
  SpriteNodeMaterial,
} from "three/webgpu";

import {
  getTreeSpeciesInstance,
  getStationModel,
  getOreModel,
  getNpcModel,
  initEntityModels,
  clearEntityModelCache,
} from "./GameWorldAssets";

// ============== TYPES ==============

interface ManifestPosition {
  x: number;
  y: number;
  z: number;
}

interface ManifestNPC {
  id: string;
  type: string;
  name?: string;
  position: ManifestPosition;
  storeId?: string;
  dialogue?: Record<string, string>;
}

interface ManifestResource {
  type: "tree" | "ore";
  position: ManifestPosition;
  resourceId: string;
}

interface ManifestMobSpawn {
  mobId: string;
  position: ManifestPosition;
  spawnRadius: number;
  maxCount: number;
}

interface ManifestStation {
  id: string;
  type: string;
  position: ManifestPosition;
  bankId?: string;
  runeType?: string;
}

interface ManifestFishing {
  enabled: boolean;
  spotCount: number;
  spotTypes: string[];
}

interface WorldArea {
  id: string;
  name: string;
  description: string;
  difficultyLevel: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  biomeType: string;
  safeZone: boolean;
  pvpEnabled?: boolean;
  npcs: ManifestNPC[];
  resources: ManifestResource[];
  mobSpawns: ManifestMobSpawn[];
  stations?: ManifestStation[];
  fishing?: ManifestFishing;
}

interface WorldAreasManifest {
  starterTowns: Record<string, WorldArea>;
  level1Areas: Record<string, WorldArea>;
  level2Areas: Record<string, WorldArea>;
  level3Areas: Record<string, WorldArea>;
  specialAreas: Record<string, WorldArea>;
}

// ============== NPC COLOR MAP ==============

const NPC_COLORS: Record<string, number> = {
  bank: 0xffd700, // Gold
  quest_giver: 0xffe066, // Yellow
  general_store: 0x4caf50, // Green
  magic_store: 0x9c27b0, // Purple
  range_store: 0x795548, // Brown
  armor_store: 0x607d8b, // Steel
  crafting_store: 0xff9800, // Orange
  tanner: 0x8b4513, // Saddle brown
  healer: 0xffffff, // White
  guide: 0x00bcd4, // Cyan
  scoreboard: 0x03a9f4, // Light blue
  guard: 0x2196f3, // Blue
};
const NPC_DEFAULT_COLOR = 0xcccccc;

// ============== STATION COLOR MAP ==============

const STATION_COLORS: Record<string, number> = {
  bank: 0xffd700, // Gold
  furnace: 0xff5722, // Deep orange
  anvil: 0x616161, // Dark gray
  altar: 0xce93d8, // Light purple
  range: 0xef5350, // Red
  runecrafting_altar: 0x42a5f5, // Blue
};
const STATION_DEFAULT_COLOR = 0x9e9e9e;

// ============== ORE COLOR MAP ==============

const ORE_COLORS: Record<string, number> = {
  ore_copper: 0xb87333,
  ore_tin: 0xc0c0c0,
  ore_iron: 0x4a4a4a,
  ore_gold: 0xffd700,
  ore_coal: 0x2c2c2c,
  ore_mithril: 0x4169e1,
  ore_adamant: 0x2e8b57,
  ore_runite: 0x00ced1,
  ore_essence: 0xe6e6fa,
};
const ORE_DEFAULT_COLOR = 0x808080;

// ============== TREE RESOURCE ID → GAME TREE ID ==============

/** Maps world-areas.json resource IDs → woodcutting manifest tree IDs */
const RESOURCE_TREE_TO_GAME_ID: Record<string, string> = {
  tree_normal: "tree_fir", // Basic tree → fir (level 1)
  tree_oak: "tree_oak",
  tree_willow: "tree_willow",
  tree_teak: "tree_teak",
  tree_maple: "tree_maple",
  tree_mahogany: "tree_mahogany",
  tree_yew: "tree_yew",
  tree_magic: "tree_magic",
  tree_fir: "tree_fir",
  tree_pine: "tree_pine",
  tree_birch: "tree_birch",
};

// ============== SHARED GEOMETRY ==============

/** Reusable geometry created once */
/** Title-case a snake_case/space-separated name: "copper_ore" → "Copper Ore" */
function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

let _npcBodyGeom: THREE.CylinderGeometry | null = null;
let _npcHeadGeom: THREE.SphereGeometry | null = null;
let _stationGeom: THREE.BoxGeometry | null = null;
let _oreGeom: THREE.DodecahedronGeometry | null = null;
let _fishingGeom: THREE.SphereGeometry | null = null;
let _mobMarkerGeom: THREE.ConeGeometry | null = null;

function getNpcBodyGeom(): THREE.CylinderGeometry {
  if (!_npcBodyGeom)
    _npcBodyGeom = new THREE.CylinderGeometry(0.35, 0.35, 1.4, 8);
  return _npcBodyGeom;
}
function getNpcHeadGeom(): THREE.SphereGeometry {
  if (!_npcHeadGeom) _npcHeadGeom = new THREE.SphereGeometry(0.3, 8, 6);
  return _npcHeadGeom;
}
function getStationGeom(): THREE.BoxGeometry {
  if (!_stationGeom) _stationGeom = new THREE.BoxGeometry(1.5, 1.2, 1.5);
  return _stationGeom;
}
function getOreGeom(): THREE.DodecahedronGeometry {
  if (!_oreGeom) {
    _oreGeom = new THREE.DodecahedronGeometry(0.7, 0);
    _oreGeom.translate(0, 0.4, 0);
  }
  return _oreGeom;
}
function getFishingGeom(): THREE.SphereGeometry {
  if (!_fishingGeom) _fishingGeom = new THREE.SphereGeometry(0.5, 8, 6);
  return _fishingGeom;
}
function getMobMarkerGeom(): THREE.ConeGeometry {
  if (!_mobMarkerGeom) _mobMarkerGeom = new THREE.ConeGeometry(0.4, 1.0, 6);
  return _mobMarkerGeom;
}

// ============== SHARED MATERIALS ==============

/** Cache materials by color hex to avoid creating hundreds of duplicate materials.
 * Shared materials = fewer draw calls = massive GPU perf win. */
const _standardMatCache = new Map<number, MeshStandardNodeMaterial>();
const _basicMatCache = new Map<string, MeshBasicNodeMaterial>();

function getStandardMat(
  colorHex: number,
  opts?: { roughness?: number; metalness?: number; flatShading?: boolean },
): MeshStandardNodeMaterial {
  // Use a compound key if we need different roughness/metalness combos
  const key =
    colorHex +
    (((opts?.roughness ?? 0.7) * 100) | 0) * 0x1000000 +
    (((opts?.metalness ?? 0) * 100) | 0) * 0x100000000;
  let mat = _standardMatCache.get(key);
  if (!mat) {
    mat = new MeshStandardNodeMaterial();
    mat.color = new THREE.Color(colorHex);
    mat.roughness = opts?.roughness ?? 0.7;
    mat.metalness = opts?.metalness ?? 0;
    if (opts?.flatShading) mat.flatShading = true;
    _standardMatCache.set(key, mat);
  }
  return mat;
}

function getBasicMat(
  colorHex: number,
  opacity: number,
  side?: THREE.Side,
): MeshBasicNodeMaterial {
  const key = `${colorHex}-${opacity}-${side ?? 0}`;
  let mat = _basicMatCache.get(key);
  if (!mat) {
    mat = new MeshBasicNodeMaterial();
    mat.color = new THREE.Color(colorHex);
    mat.transparent = true;
    mat.opacity = opacity;
    if (side !== undefined) mat.side = side;
    _basicMatCache.set(key, mat);
  }
  return mat;
}

function disposeSharedMaterials(): void {
  for (const mat of _standardMatCache.values()) mat.dispose();
  _standardMatCache.clear();
  for (const mat of _basicMatCache.values()) mat.dispose();
  _basicMatCache.clear();
}

// ============== LABEL SPRITE ==============

const labelCache = new Map<string, THREE.Texture>();

function createLabelTexture(
  text: string,
  color: string = "#F5F5F5",
): THREE.Texture {
  const key = `${text}|${color}`;
  if (labelCache.has(key)) return labelCache.get(key)!;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const fontSize = 28;
  ctx.font = `bold ${fontSize}px sans-serif`;
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const padding = 8;

  canvas.width = Math.ceil(textWidth + padding * 2);
  canvas.height = fontSize + padding * 2;

  // Background
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  const radius = 4;
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, radius);
  ctx.fill();

  // Text
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  labelCache.set(key, texture);
  return texture;
}

function createLabelSprite(
  text: string,
  position: THREE.Vector3,
  color: string = "#F5F5F5",
  yOffset: number = 2.5,
): THREE.Sprite {
  const texture = createLabelTexture(text, color);
  const mat = new SpriteNodeMaterial();
  mat.map = texture;
  mat.transparent = true;
  mat.depthWrite = false;

  const sprite = new THREE.Sprite(mat);
  const img = texture.image as HTMLCanvasElement;
  const aspect = img.width / img.height;
  const scale = 1.0; // Compact label — UE5-style, readable but not dominant
  sprite.scale.set(scale * aspect, scale, 1);
  sprite.position.copy(position);
  sprite.position.y += yOffset;
  // UE5 style: labels hidden by default, shown on hover/selection
  sprite.visible = false;
  sprite.userData.isLabel = true;
  sprite.userData.labelAspect = aspect; // cached for screen-space sizing
  return sprite;
}

// ============== ENTITY CREATORS ==============

function createNPCMarker(
  npc: ManifestNPC,
  worldCenterOffset: number,
  getHeight: (wx: number, wz: number) => number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `npc_${npc.id}`;

  const h = getHeight(npc.position.x, npc.position.z);
  const rx = npc.position.x + worldCenterOffset;
  const rz = npc.position.z + worldCenterOffset;
  const colorHex = NPC_COLORS[npc.type] ?? NPC_DEFAULT_COLOR;
  const displayName = npc.name ?? npc.id.replace(/_/g, " ");

  // Try real GLB/VRM model first
  const modelData = getNpcModel(npc.id);
  if (modelData && modelData.parts.length > 0) {
    for (const part of modelData.parts) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.position.set(rx, h, rz);
      mesh.scale.setScalar(modelData.scale);
      mesh.castShadow = true;
      mesh.userData._cachedModel = true; // Don't dispose — owned by model cache
      group.add(mesh);
    }
  } else {
    // Fallback: colored capsule placeholder (shared materials)
    const body = new THREE.Mesh(getNpcBodyGeom(), getStandardMat(colorHex));
    body.position.set(rx, h + 0.7, rz);
    body.castShadow = true;
    group.add(body);

    // Head uses a brighter variant
    const headColor = new THREE.Color(colorHex).multiplyScalar(1.2).getHex();
    const head = new THREE.Mesh(
      getNpcHeadGeom(),
      getStandardMat(headColor, { roughness: 0.6 }),
    );
    head.position.set(rx, h + 1.7, rz);
    head.castShadow = true;
    group.add(head);
  }

  // Name label
  const label = createLabelSprite(
    displayName,
    new THREE.Vector3(rx, h, rz),
    `#${colorHex.toString(16).padStart(6, "0")}`,
    2.8,
  );
  group.add(label);

  // Store selectable data
  group.userData = {
    selectable: true,
    selectableType: "entity",
    selectableId: group.name,
    entityType: "npc",
    entityId: npc.id,
    npcType: npc.type,
    displayName,
  };

  return group;
}

function createStationMarker(
  station: ManifestStation,
  worldCenterOffset: number,
  getHeight: (wx: number, wz: number) => number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `station_${station.id}`;

  const h = getHeight(station.position.x, station.position.z);
  const rx = station.position.x + worldCenterOffset;
  const rz = station.position.z + worldCenterOffset;
  const colorHex = STATION_COLORS[station.type] ?? STATION_DEFAULT_COLOR;
  const displayName = station.runeType
    ? `${station.runeType} ${station.type}`.replace(/_/g, " ")
    : station.type.replace(/_/g, " ");

  // Try real GLB model first
  const modelData = getStationModel(station.type);
  if (modelData && modelData.parts.length > 0) {
    for (const part of modelData.parts) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.position.set(rx, h + modelData.yOffset, rz);
      mesh.scale.setScalar(modelData.scale);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData._cachedModel = true;
      group.add(mesh);
    }
  } else {
    // Fallback: colored box placeholder (shared material)
    const mesh = new THREE.Mesh(
      getStationGeom(),
      getStandardMat(colorHex, { roughness: 0.8, metalness: 0.2 }),
    );
    mesh.position.set(rx, h + 0.6, rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Label
  const label = createLabelSprite(
    displayName,
    new THREE.Vector3(rx, h, rz),
    `#${colorHex.toString(16).padStart(6, "0")}`,
    2.2,
  );
  group.add(label);

  group.userData = {
    selectable: true,
    selectableType: "entity",
    selectableId: group.name,
    entityType: "station",
    entityId: station.id,
    stationType: station.type,
    displayName,
  };

  return group;
}

function createOreMarker(
  resource: ManifestResource,
  worldCenterOffset: number,
  getHeight: (wx: number, wz: number) => number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `ore_${resource.resourceId}_${Math.round(resource.position.x)}_${Math.round(resource.position.z)}`;

  const h = getHeight(resource.position.x, resource.position.z);
  const rx = resource.position.x + worldCenterOffset;
  const rz = resource.position.z + worldCenterOffset;
  const colorHex = ORE_COLORS[resource.resourceId] ?? ORE_DEFAULT_COLOR;
  const displayName = resource.resourceId.replace(/_/g, " ");

  // Slight random rotation for variety
  const seed = resource.position.x * 13 + resource.position.z * 7;
  const rotation = ((seed % 100) / 100) * Math.PI * 2;

  // Try real GLB model first
  const modelData = getOreModel(resource.resourceId);
  if (modelData && modelData.parts.length > 0) {
    for (const part of modelData.parts) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.position.set(rx, h, rz);
      mesh.scale.setScalar(modelData.scale);
      mesh.rotation.y = rotation;
      mesh.castShadow = true;
      mesh.userData._cachedModel = true;
      group.add(mesh);
    }
  } else {
    // Fallback: colored dodecahedron placeholder (shared material)
    const mesh = new THREE.Mesh(
      getOreGeom(),
      getStandardMat(colorHex, { roughness: 0.85, flatShading: true }),
    );
    mesh.position.set(rx, h, rz);
    mesh.castShadow = true;
    mesh.rotation.y = rotation;
    group.add(mesh);
  }

  // Label
  const label = createLabelSprite(
    displayName,
    new THREE.Vector3(rx, h, rz),
    `#${colorHex.toString(16).padStart(6, "0")}`,
    1.8,
  );
  group.add(label);

  group.userData = {
    selectable: true,
    selectableType: "entity",
    selectableId: group.name,
    entityType: "ore",
    entityId: resource.resourceId,
    displayName,
  };

  return group;
}

function createTreeMarker(
  resource: ManifestResource,
  worldCenterOffset: number,
  getHeight: (wx: number, wz: number) => number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `tree_${resource.resourceId}_${Math.round(resource.position.x)}_${Math.round(resource.position.z)}`;

  const h = getHeight(resource.position.x, resource.position.z);
  const rx = resource.position.x + worldCenterOffset;
  const rz = resource.position.z + worldCenterOffset;

  // Map resource tree ID to game tree ID and get GLB species instance
  const gameTreeId =
    RESOURCE_TREE_TO_GAME_ID[resource.resourceId] ?? resource.resourceId;
  const speciesData = getTreeSpeciesInstance(gameTreeId);
  const seed = resource.position.x * 13 + resource.position.z * 7;
  const rotation = ((seed % 100) / 100) * Math.PI * 2;

  if (speciesData && speciesData.parts.length > 0) {
    // Use actual GLB game tree model parts
    for (const part of speciesData.parts) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.position.set(rx, h, rz);
      mesh.scale.setScalar(speciesData.manifestScale);
      mesh.rotation.y = rotation;
      mesh.castShadow = true;
      mesh.userData._cachedModel = true;
      group.add(mesh);
    }
  } else {
    // Fallback: simple cone tree (shared materials + geometry)
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.3, 2, 6),
      getStandardMat(0x8b4513),
    );
    trunk.position.set(rx, h + 1, rz);
    group.add(trunk);

    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(1.5, 3, 8),
      getStandardMat(0x228b22),
    );
    canopy.position.set(rx, h + 3.5, rz);
    canopy.castShadow = true;
    group.add(canopy);
  }

  // Label
  const displayName = resource.resourceId.replace(/_/g, " ");
  const label = createLabelSprite(
    displayName,
    new THREE.Vector3(rx, h, rz),
    "#8BC34A",
    5.5,
  );
  group.add(label);

  group.userData = {
    selectable: true,
    selectableType: "entity",
    selectableId: group.name,
    entityType: "tree",
    entityId: resource.resourceId,
    displayName,
  };

  return group;
}

function createMobSpawnZone(
  spawn: ManifestMobSpawn,
  worldCenterOffset: number,
  getHeight: (wx: number, wz: number) => number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `mob_spawn_${spawn.mobId}_${Math.round(spawn.position.x)}_${Math.round(spawn.position.z)}`;

  const h = getHeight(spawn.position.x, spawn.position.z);
  const rx = spawn.position.x + worldCenterOffset;
  const rz = spawn.position.z + worldCenterOffset;

  // Ring outline showing spawn radius
  const ringGeom = new THREE.RingGeometry(
    spawn.spawnRadius - 0.15,
    spawn.spawnRadius + 0.15,
    16,
  );
  ringGeom.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringGeom, getBasicMat(0xff4444, 0.3));
  ring.position.set(rx, h + 0.05, rz);
  group.add(ring);

  // Mob figure at spawn center — try real GLB model first, fallback to capsule
  const mobModel = getNpcModel(spawn.mobId);
  if (mobModel && mobModel.parts.length > 0) {
    for (const part of mobModel.parts) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.position.set(rx, h, rz);
      mesh.scale.setScalar(mobModel.scale);
      mesh.castShadow = true;
      mesh.userData._cachedModel = true;
      group.add(mesh);
    }
  } else {
    // Fallback: red-tinted capsule (body + head) like NPC markers
    const body = new THREE.Mesh(getNpcBodyGeom(), getStandardMat(0xcc2222));
    body.position.set(rx, h + 0.7, rz);
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(
      getNpcHeadGeom(),
      getStandardMat(0xff3333, { roughness: 0.6 }),
    );
    head.position.set(rx, h + 1.7, rz);
    head.castShadow = true;
    group.add(head);
  }

  // Label
  const displayName = `${spawn.mobId.replace(/_/g, " ")} (×${spawn.maxCount})`;
  const label = createLabelSprite(
    displayName,
    new THREE.Vector3(rx, h, rz),
    "#FF5252",
    2.5,
  );
  group.add(label);

  group.userData = {
    selectable: true,
    selectableType: "entity",
    selectableId: group.name,
    entityType: "mob_spawn",
    entityId: spawn.mobId,
    spawnRadius: spawn.spawnRadius,
    maxCount: spawn.maxCount,
    displayName,
  };

  return group;
}

function createFishingSpotMarkers(
  area: WorldArea,
  worldCenterOffset: number,
  getHeight: (wx: number, wz: number) => number,
  waterThreshold: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `fishing_${area.id}`;

  if (!area.fishing?.enabled || area.fishing.spotCount === 0) return group;

  // Generate fishing spot positions along water edges within area bounds
  const { bounds } = area;
  const spotCount = area.fishing.spotCount;
  const spotTypes = area.fishing.spotTypes;

  // Scan for water edge positions within area bounds
  const waterEdgePositions: Array<{ x: number; z: number }> = [];
  const scanStep = 4;

  for (let x = bounds.minX; x <= bounds.maxX; x += scanStep) {
    for (let z = bounds.minZ; z <= bounds.maxZ; z += scanStep) {
      const h = getHeight(x, z);
      if (h < waterThreshold && h > waterThreshold - 3) {
        // Check if adjacent to land
        const hN = getHeight(x, z + scanStep);
        const hS = getHeight(x, z - scanStep);
        const hE = getHeight(x + scanStep, z);
        const hW = getHeight(x - scanStep, z);
        if (
          hN >= waterThreshold ||
          hS >= waterThreshold ||
          hE >= waterThreshold ||
          hW >= waterThreshold
        ) {
          waterEdgePositions.push({ x, z });
        }
      }
    }
  }

  // Pick evenly spaced spots (shared materials)
  const spacing = Math.max(
    1,
    Math.floor(waterEdgePositions.length / spotCount),
  );
  const fishMat = getStandardMat(0x2196f3, { roughness: 0.3 });
  const rippleMat = getBasicMat(0x64b5f6, 0.25);

  let placed = 0;
  for (
    let i = 0;
    i < waterEdgePositions.length && placed < spotCount;
    i += spacing
  ) {
    const pos = waterEdgePositions[i];
    const rx = pos.x + worldCenterOffset;
    const rz = pos.z + worldCenterOffset;
    const spotType = spotTypes[placed % spotTypes.length];

    const mesh = new THREE.Mesh(getFishingGeom(), fishMat);
    mesh.position.set(rx, waterThreshold + 0.3, rz);
    group.add(mesh);

    // Ripple ring
    const ripple = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.2, 16),
      rippleMat,
    );
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.set(rx, waterThreshold + 0.05, rz);
    group.add(ripple);

    // Label
    const label = createLabelSprite(
      spotType.replace(/_/g, " "),
      new THREE.Vector3(rx, waterThreshold, rz),
      "#64B5F6",
      1.5,
    );
    group.add(label);

    placed++;
  }

  if (placed > 0) {
    console.log(`[EntitySync] Placed ${placed} fishing spots in ${area.name}`);
  }

  return group;
}

function createAreaBoundary(
  area: WorldArea,
  worldCenterOffset: number,
  getHeight: (wx: number, wz: number) => number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `area_boundary_${area.id}`;

  const { bounds } = area;
  const borderColor = area.safeZone
    ? 0x4caf50
    : area.pvpEnabled
      ? 0xff1744
      : 0xff9800;

  // Use a line loop instead of transparent wall planes — much cheaper (1 draw call vs 4)
  const cornerH = getHeight(
    (bounds.minX + bounds.maxX) / 2,
    (bounds.minZ + bounds.maxZ) / 2,
  );
  const wallHeight = 3;
  const y = cornerH + wallHeight / 2;
  const ox = worldCenterOffset;
  const oz = worldCenterOffset;

  // Bottom + top rectangle as a single line loop
  const pts = [
    new THREE.Vector3(bounds.minX + ox, y, bounds.minZ + oz),
    new THREE.Vector3(bounds.maxX + ox, y, bounds.minZ + oz),
    new THREE.Vector3(bounds.maxX + ox, y, bounds.maxZ + oz),
    new THREE.Vector3(bounds.minX + ox, y, bounds.maxZ + oz),
    new THREE.Vector3(bounds.minX + ox, y, bounds.minZ + oz), // close loop
  ];
  const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
  const lineMat = new THREE.LineBasicMaterial({
    color: borderColor,
    transparent: true,
    opacity: 0.6,
  });
  const line = new THREE.Line(lineGeom, lineMat);
  group.add(line);

  // Area name label at center
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const label = createLabelSprite(
    area.name,
    new THREE.Vector3(centerX + ox, cornerH, centerZ + oz),
    area.safeZone ? "#81C784" : "#FF8A80",
    8,
  );
  group.add(label);

  return group;
}

// ============== MAIN EXPORT ==============

/** Minimal info about a game manifest entity for the outliner */
export interface GameEntityInfo {
  /** selectableId used in the 3D scene (e.g., "npc_cook") */
  selectableId: string;
  /** Entity ID (e.g., "cook") */
  entityId: string;
  /** Display name */
  name: string;
  /** World position (game coords, not render coords) */
  position: { x: number; z: number };
  // Grouping metadata for manifest-aware outliner hierarchy:
  /** NPC category from manifest ("mob"|"boss"|"neutral"|"quest") */
  category?: string;
  /** NPC placement type ("bank", "quest_giver", "general_store", etc.) */
  npcType?: string;
  /** Linked store ID (for shopkeeper NPCs) */
  storeId?: string;
  /** Station type ("anvil"|"furnace"|"bank"|"altar"|etc.) */
  stationType?: string;
  /** Resource type ("ore"|"tree") */
  resourceType?: string;
  /** Mob spawn radius */
  spawnRadius?: number;
  /** Mob spawn max count */
  maxCount?: number;
}

/** Entity data from the game manifest (world-areas.json) */
export interface GameEntityData {
  npcs: GameEntityInfo[];
  stations: GameEntityInfo[];
  resources: GameEntityInfo[];
  mobSpawns: GameEntityInfo[];
  fishingSpots: number;
  areas: number;
}

export interface GameWorldEntitiesResult {
  group: THREE.Group;
  entities: GameEntityData;
}

/**
 * Fetch world-areas.json and create all entity markers for the game world.
 *
 * @param worldCenterOffset — half of world size in meters (game coords are centered)
 * @param getHeight — terrain height query in game (centered) coordinates
 * @param waterThreshold — water level for fishing spot placement
 * @returns THREE.Group containing all entity markers + counts, or empty on fetch failure
 */
export async function createGameWorldEntities(
  worldCenterOffset: number,
  getHeight: (wx: number, wz: number) => number,
  waterThreshold: number,
): Promise<GameWorldEntitiesResult> {
  // Load real GLB models for stations, ores, and NPCs (parallel with manifest fetch)
  await initEntityModels();

  const root = new THREE.Group();
  root.name = "game_world_entities";

  // Sub-groups for organization
  const npcsGroup = new THREE.Group();
  npcsGroup.name = "npcs";
  const stationsGroup = new THREE.Group();
  stationsGroup.name = "stations";
  const resourcesGroup = new THREE.Group();
  resourcesGroup.name = "resources";
  const mobSpawnsGroup = new THREE.Group();
  mobSpawnsGroup.name = "mob_spawns";
  const fishingGroup = new THREE.Group();
  fishingGroup.name = "fishing_spots";
  const boundariesGroup = new THREE.Group();
  boundariesGroup.name = "area_boundaries";

  root.add(
    npcsGroup,
    stationsGroup,
    resourcesGroup,
    mobSpawnsGroup,
    fishingGroup,
    boundariesGroup,
  );

  // Fetch manifest
  let manifest: WorldAreasManifest;
  try {
    const res = await fetch("/api/manifests/world-areas");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    manifest = (json.content ?? json) as WorldAreasManifest;
  } catch (err) {
    console.warn("[EntitySync] Failed to fetch world-areas.json:", err);
    return {
      group: root,
      entities: {
        npcs: [],
        stations: [],
        resources: [],
        mobSpawns: [],
        fishingSpots: 0,
        areas: 0,
      },
    };
  }

  // Collect all areas from every tier
  const allAreas: WorldArea[] = [];
  for (const tier of [
    manifest.starterTowns,
    manifest.level1Areas,
    manifest.level2Areas,
    manifest.level3Areas,
    manifest.specialAreas,
  ]) {
    if (tier) {
      for (const area of Object.values(tier)) {
        allAreas.push(area as WorldArea);
      }
    }
  }

  const npcInfos: GameEntityInfo[] = [];
  const stationInfos: GameEntityInfo[] = [];
  const resourceInfos: GameEntityInfo[] = [];
  const mobSpawnInfos: GameEntityInfo[] = [];
  let totalFishingSpots = 0;

  for (const area of allAreas) {
    // Area boundary
    boundariesGroup.add(createAreaBoundary(area, worldCenterOffset, getHeight));

    // NPCs
    for (const npc of area.npcs) {
      const group = createNPCMarker(npc, worldCenterOffset, getHeight);
      npcsGroup.add(group);
      npcInfos.push({
        selectableId: group.name,
        entityId: npc.id,
        name: npc.name ?? titleCase(npc.id),
        position: { x: npc.position.x, z: npc.position.z },
        npcType: npc.type,
        storeId: npc.storeId,
      });
    }

    // Stations
    if (area.stations) {
      for (const station of area.stations) {
        const group = createStationMarker(
          station,
          worldCenterOffset,
          getHeight,
        );
        stationsGroup.add(group);
        stationInfos.push({
          selectableId: group.name,
          entityId: station.id,
          name: station.runeType
            ? titleCase(`${station.runeType} ${station.type}`)
            : titleCase(station.type),
          position: { x: station.position.x, z: station.position.z },
          stationType: station.type,
        });
      }
    }

    // Resources
    for (const resource of area.resources) {
      let group: THREE.Group;
      if (resource.type === "ore") {
        group = createOreMarker(resource, worldCenterOffset, getHeight);
      } else {
        group = createTreeMarker(resource, worldCenterOffset, getHeight);
      }
      resourcesGroup.add(group);
      resourceInfos.push({
        selectableId: group.name,
        entityId: resource.resourceId,
        name: titleCase(resource.resourceId),
        position: { x: resource.position.x, z: resource.position.z },
        resourceType: resource.type,
      });
    }

    // Mob spawns
    for (const spawn of area.mobSpawns) {
      const group = createMobSpawnZone(spawn, worldCenterOffset, getHeight);
      mobSpawnsGroup.add(group);
      mobSpawnInfos.push({
        selectableId: group.name,
        entityId: spawn.mobId,
        name: `${titleCase(spawn.mobId)} (×${spawn.maxCount})`,
        position: { x: spawn.position.x, z: spawn.position.z },
        spawnRadius: spawn.spawnRadius,
        maxCount: spawn.maxCount,
      });
    }

    // Fishing spots
    if (area.fishing?.enabled && area.fishing.spotCount > 0) {
      totalFishingSpots += area.fishing.spotCount;
    }
    fishingGroup.add(
      createFishingSpotMarkers(
        area,
        worldCenterOffset,
        getHeight,
        waterThreshold,
      ),
    );
  }

  console.log(
    `[EntitySync] Placed ${npcInfos.length} NPCs, ${stationInfos.length} stations, ` +
      `${resourceInfos.length} resources, ${mobSpawnInfos.length} mob spawns across ${allAreas.length} areas`,
  );

  return {
    group: root,
    entities: {
      npcs: npcInfos,
      stations: stationInfos,
      resources: resourceInfos,
      mobSpawns: mobSpawnInfos,
      fishingSpots: totalFishingSpots,
      areas: allAreas.length,
    },
  };
}

/**
 * Dispose all entity markers and clear the label texture cache.
 */
export function disposeEntitySync(group: THREE.Group): void {
  // Collect shared material refs to skip during traversal
  const sharedMats = new Set<THREE.Material>();
  for (const mat of _standardMatCache.values()) sharedMats.add(mat);
  for (const mat of _basicMatCache.values()) sharedMats.add(mat);

  group.traverse((child) => {
    // Skip meshes from cached GLB models — their geometry/materials
    // are owned by GameWorldAssets caches, not this group
    if (child.userData?._cachedModel) return;

    if ((child as THREE.Mesh).geometry) {
      // Don't dispose shared geometry (getXxxGeom singletons)
      const geom = (child as THREE.Mesh).geometry;
      if (
        geom !== _npcBodyGeom &&
        geom !== _npcHeadGeom &&
        geom !== _stationGeom &&
        geom !== _oreGeom &&
        geom !== _fishingGeom &&
        geom !== _mobMarkerGeom
      ) {
        geom.dispose();
      }
    }
    if ((child as THREE.Mesh).material) {
      const mat = (child as THREE.Mesh).material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => {
          if (!sharedMats.has(m)) m.dispose();
        });
      } else if (!sharedMats.has(mat)) {
        mat.dispose();
      }
    }
  });

  // Clear label textures
  for (const texture of labelCache.values()) {
    texture.dispose();
  }
  labelCache.clear();
}

/**
 * Dispose shared singleton geometry. Call on full cleanup only.
 */
export function disposeEntitySyncGeometry(): void {
  _npcBodyGeom?.dispose();
  _npcBodyGeom = null;
  _npcHeadGeom?.dispose();
  _npcHeadGeom = null;
  _stationGeom?.dispose();
  _stationGeom = null;
  _oreGeom?.dispose();
  _oreGeom = null;
  _fishingGeom?.dispose();
  _fishingGeom = null;
  _mobMarkerGeom?.dispose();
  _mobMarkerGeom = null;
  disposeSharedMaterials();
}
