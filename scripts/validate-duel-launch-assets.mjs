#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, "..");
const assetsRoot = path.resolve(
  process.env.ASSETS_DIR ||
    path.join(workspaceRoot, "packages/server/world/assets"),
);
const manifestsRoot = path.join(assetsRoot, "manifests");
const failures = [];

function fail(message) {
  failures.push(message);
}

function readJson(relativePath) {
  const absolutePath = path.join(manifestsRoot, relativePath);
  try {
    return JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch (error) {
    fail(
      `${relativePath} is missing or invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertAssetUrl(location, value) {
  if (typeof value !== "string" || !value.startsWith("asset://")) {
    fail(`${location} must contain an asset:// URL`);
    return;
  }

  const relativePath = value.slice("asset://".length);
  const absolutePath = path.resolve(assetsRoot, relativePath);
  if (
    absolutePath === assetsRoot ||
    !absolutePath.startsWith(`${assetsRoot}${path.sep}`)
  ) {
    fail(`${location} escapes the asset root: ${value}`);
    return;
  }

  if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
    fail(`${location} references a missing asset: ${value}`);
  }
}

const buildings = readJson("buildings.json");
if (
  !isRecord(buildings) ||
  typeof buildings.version !== "number" ||
  !Array.isArray(buildings.towns) ||
  !isRecord(buildings.buildingTypes) ||
  !isRecord(buildings.sizeDefinitions)
) {
  fail("buildings.json does not match the BuildingsManifest shape");
}

const worldConfig = readJson("world-config.json");
if (
  !isRecord(worldConfig) ||
  worldConfig.version !== 1 ||
  !isRecord(worldConfig.terrain) ||
  !isRecord(worldConfig.towns) ||
  !isRecord(worldConfig.roads)
) {
  fail("world-config.json does not contain the required launch sections");
} else {
  const terrainWater = worldConfig.terrain.waterThreshold;
  const townWater = worldConfig.towns.waterThreshold;
  if (terrainWater !== 16 || townWater !== terrainWater) {
    fail(
      `world-config water thresholds must match the authoritative terrain level (16); received terrain=${String(terrainWater)}, towns=${String(townWater)}`,
    );
  }
  if (worldConfig.roads.roadWidth !== 6) {
    fail(
      `world-config roads.roadWidth must match the authoritative terrain road width (6); received ${String(worldConfig.roads.roadWidth)}`,
    );
  }
}

const npcs = readJson("npcs.json");
const stationsDocument = readJson("stations.json");
const woodcutting = readJson("gathering/woodcutting.json");
const mining = readJson("gathering/mining.json");
const fishing = readJson("gathering/fishing.json");
const stores = readJson("stores.json");
const worldAreas = readJson("world-areas.json");

const npcIds = new Set(
  Array.isArray(npcs) ? npcs.map((npc) => npc?.id).filter(Boolean) : [],
);
const stationTypes = new Set(
  Array.isArray(stationsDocument?.stations)
    ? stationsDocument.stations.map((station) => station?.type).filter(Boolean)
    : [],
);
const resourceIds = new Set(
  [
    ...(Array.isArray(woodcutting?.trees) ? woodcutting.trees : []),
    ...(Array.isArray(mining?.rocks) ? mining.rocks : []),
    ...(Array.isArray(fishing?.spots) ? fishing.spots : []),
  ]
    .map((resource) => resource?.id)
    .filter(Boolean),
);
const storeIds = new Set(
  (Array.isArray(stores) ? stores : [])
    .map((store) => store?.id)
    .filter(Boolean),
);
if (!Array.isArray(stores)) {
  fail("stores.json must contain an array of store definitions");
}
if (Array.isArray(stores) && storeIds.size !== stores.length) {
  fail("stores.json must assign every store a unique, non-empty ID");
}
const storesById = new Map(
  (Array.isArray(stores) ? stores : [])
    .filter((store) => typeof store?.id === "string")
    .map((store) => [store.id, store]),
);

const areaGroups = [
  "starterTowns",
  "level1Areas",
  "level2Areas",
  "level3Areas",
  "specialAreas",
];
const areas = [];
for (const groupName of areaGroups) {
  const group = worldAreas?.[groupName];
  if (!isRecord(group)) {
    fail(`world-areas.json.${groupName} must be an object`);
    continue;
  }
  areas.push(...Object.values(group));
}

const waterBodyIds = new Set();
for (const area of areas) {
  const areaId = area?.id || "unknown-area";
  const bounds = area?.bounds;
  const boundValues = [bounds?.minX, bounds?.maxX, bounds?.minZ, bounds?.maxZ];
  const validBounds =
    isRecord(bounds) &&
    boundValues.every((value) => Number.isFinite(value)) &&
    bounds.minX < bounds.maxX &&
    bounds.minZ < bounds.maxZ;
  if (!validBounds) {
    fail(`${areaId} must define finite, ordered X/Z bounds`);
  }

  const assertInsideArea = (location, position, radius = 0) => {
    if (
      !isRecord(position) ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.z)
    ) {
      fail(`${location} must define a finite X/Z position`);
      return;
    }
    if (
      validBounds &&
      (position.x - radius < bounds.minX ||
        position.x + radius > bounds.maxX ||
        position.z - radius < bounds.minZ ||
        position.z + radius > bounds.maxZ)
    ) {
      fail(
        `${location} at (${position.x}, ${position.z}) with radius ${radius} falls outside ${areaId} bounds`,
      );
    }
  };

  for (const npc of Array.isArray(area?.npcs) ? area.npcs : []) {
    if (!npcIds.has(npc?.id)) {
      fail(`${areaId} references unknown NPC ${String(npc?.id)}`);
    }
    assertInsideArea(`${areaId} NPC ${String(npc?.id)}`, npc?.position);
    if (npc?.storeId && !storeIds.has(npc.storeId)) {
      fail(
        `${areaId} NPC ${String(npc?.id)} references unknown store ${String(npc.storeId)}`,
      );
    }
  }
  for (const resource of Array.isArray(area?.resources) ? area.resources : []) {
    if (!resourceIds.has(resource?.resourceId)) {
      fail(
        `${areaId} references unknown resource ${String(resource?.resourceId)}`,
      );
    }
    assertInsideArea(
      `${areaId} resource ${String(resource?.resourceId)}`,
      resource?.position,
    );
  }
  for (const station of Array.isArray(area?.stations) ? area.stations : []) {
    if (!stationTypes.has(station?.type)) {
      fail(
        `${areaId} references unknown station type ${String(station?.type)}`,
      );
    }
    assertInsideArea(
      `${areaId} station ${String(station?.id)}`,
      station?.position,
    );
  }
  for (const spawn of Array.isArray(area?.mobSpawns) ? area.mobSpawns : []) {
    const radius = Number.isFinite(spawn?.spawnRadius) ? spawn.spawnRadius : 0;
    assertInsideArea(
      `${areaId} mob spawn ${String(spawn?.mobId)}`,
      spawn?.position,
      radius,
    );
  }
  for (const zone of Array.isArray(area?.flatZones) ? area.flatZones : []) {
    if (
      typeof zone?.id !== "string" ||
      zone.id.length === 0 ||
      !Number.isFinite(zone?.centerX) ||
      !Number.isFinite(zone?.centerZ) ||
      !Number.isFinite(zone?.width) ||
      !Number.isFinite(zone?.depth) ||
      !Number.isFinite(zone?.blendRadius) ||
      zone.width <= 0 ||
      zone.depth <= 0 ||
      zone.blendRadius < 0
    ) {
      fail(`${areaId} contains an invalid flat zone ${String(zone?.id)}`);
      continue;
    }
    assertInsideArea(
      `${areaId} flat zone ${zone.id}`,
      { x: zone.centerX, z: zone.centerZ },
      Math.max(zone.width, zone.depth) / 2,
    );
  }
  for (const body of Array.isArray(area?.waterBodies) ? area.waterBodies : []) {
    if (
      typeof body?.id !== "string" ||
      body.id.length === 0 ||
      !Number.isFinite(body?.centerX) ||
      !Number.isFinite(body?.centerZ) ||
      !Number.isFinite(body?.radius) ||
      !Number.isFinite(body?.surfaceY) ||
      body.radius <= 0
    ) {
      fail(`${areaId} contains an invalid water body ${String(body?.id)}`);
      continue;
    }
    if (waterBodyIds.has(body.id)) {
      fail(`world-areas.json contains duplicate water body ID ${body.id}`);
    }
    waterBodyIds.add(body.id);
    assertInsideArea(
      `${areaId} water body ${body.id}`,
      { x: body.centerX, z: body.centerZ },
      body.radius,
    );
  }
  if (area?.fishing?.enabled) {
    if (
      !Number.isSafeInteger(area.fishing.spotCount) ||
      area.fishing.spotCount <= 0 ||
      !Array.isArray(area.fishing.spotTypes) ||
      area.fishing.spotTypes.length === 0
    ) {
      fail(`${areaId} has an invalid dynamic fishing configuration`);
    }
    for (const spotType of area.fishing.spotTypes ?? []) {
      if (!resourceIds.has(spotType)) {
        fail(`${areaId} references unknown fishing spot ${String(spotType)}`);
      }
    }
  }
}

const duelArena = worldAreas?.specialAreas?.duel_arena;
if (!isRecord(duelArena)) {
  fail("world-areas.json is missing specialAreas.duel_arena");
} else {
  for (const field of ["npcs", "resources", "mobSpawns", "stations"]) {
    if (!Array.isArray(duelArena[field]) || duelArena[field].length !== 0) {
      fail(
        `duel_arena must not publish ${field}; launch preparation and banking are scheduler-owned`,
      );
    }
  }
}

const preparationHub = worldAreas?.starterTowns?.central_haven;
const preparationPond = worldAreas?.level1Areas?.haven_pond;
const preparationTraining =
  worldAreas?.level1Areas?.preparation_training_grounds;
if (!isRecord(preparationHub)) {
  fail("world-areas.json is missing starterTowns.central_haven");
} else {
  const bounds = preparationHub.bounds;
  const boundValues = [bounds?.minX, bounds?.maxX, bounds?.minZ, bounds?.maxZ];
  if (
    !isRecord(bounds) ||
    !boundValues.every((value) => Number.isFinite(value)) ||
    bounds.minX >= bounds.maxX ||
    bounds.minZ >= bounds.maxZ
  ) {
    fail("central_haven must define finite, ordered X/Z bounds");
  } else {
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxZ - bounds.minZ;
    if (width > 48 || depth > 48) {
      fail(
        `central_haven must remain a compact service plaza (maximum 48x48); received ${width}x${depth}`,
      );
    }

    const assertPositionInsideHub = (location, position, radius = 0) => {
      if (
        !isRecord(position) ||
        !Number.isFinite(position.x) ||
        !Number.isFinite(position.z)
      ) {
        fail(`${location} must define a finite X/Z position`);
        return;
      }
      if (
        position.x - radius < bounds.minX ||
        position.x + radius > bounds.maxX ||
        position.z - radius < bounds.minZ ||
        position.z + radius > bounds.maxZ
      ) {
        fail(
          `${location} at (${position.x}, ${position.z}) with radius ${radius} falls outside central_haven bounds`,
        );
      }
    };

    for (const npc of Array.isArray(preparationHub.npcs)
      ? preparationHub.npcs
      : []) {
      assertPositionInsideHub(
        `central_haven NPC ${String(npc?.id)}`,
        npc?.position,
      );
    }
    for (const resource of Array.isArray(preparationHub.resources)
      ? preparationHub.resources
      : []) {
      assertPositionInsideHub(
        `central_haven resource ${String(resource?.resourceId)}`,
        resource?.position,
      );
    }
    for (const station of Array.isArray(preparationHub.stations)
      ? preparationHub.stations
      : []) {
      assertPositionInsideHub(
        `central_haven station ${String(station?.id)}`,
        station?.position,
      );
    }
    for (const spawn of Array.isArray(preparationHub.mobSpawns)
      ? preparationHub.mobSpawns
      : []) {
      const radius = Number.isFinite(spawn?.spawnRadius)
        ? spawn.spawnRadius
        : 0;
      assertPositionInsideHub(
        `central_haven mob spawn ${String(spawn?.mobId)}`,
        spawn?.position,
        radius,
      );
    }
  }

  if (preparationHub.safeZone !== true) {
    fail("central_haven must remain a safe preparation hub");
  }
  if (
    !Array.isArray(preparationHub.mobSpawns) ||
    preparationHub.mobSpawns.length !== 0
  ) {
    fail("central_haven cannot declare training mobs inside its safe zone");
  }

  const preparationAreas = [
    preparationHub,
    preparationPond,
    preparationTraining,
  ].filter(isRecord);
  const hubStationTypes = new Set(
    preparationAreas
      .flatMap((area) => (Array.isArray(area.stations) ? area.stations : []))
      .map((station) => station?.type)
      .filter(Boolean),
  );
  for (const requiredStationType of [
    "bank",
    "furnace",
    "anvil",
    "altar",
    "range",
    "runecrafting_altar",
  ]) {
    if (!hubStationTypes.has(requiredStationType)) {
      fail(
        `central_haven is missing required preparation station type ${requiredStationType}`,
      );
    }
  }

  const hubStoreIds = new Set(
    (Array.isArray(preparationHub.npcs) ? preparationHub.npcs : [])
      .map((npc) => npc?.storeId)
      .filter(Boolean),
  );
  for (const requiredStoreId of [
    "general_store",
    "fishing_store",
    "sword_store",
    "magic_store",
    "range_store",
    "armor_store",
    "crafting_store",
  ]) {
    if (!hubStoreIds.has(requiredStoreId)) {
      fail(`central_haven is missing required store ${requiredStoreId}`);
    }
  }

  const spawnX = (bounds.minX + bounds.maxX) / 2;
  const spawnZ = (bounds.minZ + bounds.maxZ) / 2;
  const routeTargets = preparationAreas.flatMap((area) => [
    ...(Array.isArray(area.npcs) ? area.npcs : []).map((entry) => ({
      id: `NPC ${String(entry?.id)}`,
      position: entry?.position,
    })),
    ...(Array.isArray(area.resources) ? area.resources : []).map((entry) => ({
      id: `resource ${String(entry?.resourceId)}`,
      position: entry?.position,
    })),
    ...(Array.isArray(area.stations) ? area.stations : []).map((entry) => ({
      id: `station ${String(entry?.id)}`,
      position: entry?.position,
    })),
    ...(Array.isArray(area.mobSpawns) ? area.mobSpawns : []).map((entry) => ({
      id: `mob ${String(entry?.mobId)}`,
      position: entry?.position,
    })),
  ]);
  for (const target of routeTargets) {
    if (!isRecord(target.position)) continue;
    const distance = Math.max(
      Math.abs(target.position.x - spawnX),
      Math.abs(target.position.z - spawnZ),
    );
    if (distance > 32) {
      fail(
        `preparation ${target.id} is ${distance} tiles from spawn; launch targets must stay within the 32-tile open-grid route envelope`,
      );
    }
  }

  const requiredProvisioningInventory = {
    sword_store: ["bronze_shortsword"],
    general_store: ["bronze_hatchet", "bronze_pickaxe", "tinderbox"],
    fishing_store: ["small_fishing_net"],
    crafting_store: ["leather", "needle", "thread"],
  };
  for (const [storeId, requiredItems] of Object.entries(
    requiredProvisioningInventory,
  )) {
    const store = storesById.get(storeId);
    const inventoryIds = new Set(
      (Array.isArray(store?.items) ? store.items : [])
        .map((item) => item?.itemId ?? item?.id)
        .filter(Boolean),
    );
    for (const itemId of requiredItems) {
      if (!inventoryIds.has(itemId)) {
        fail(`${storeId} is missing agent provisioning item ${itemId}`);
      }
    }
  }
}

if (!isRecord(preparationPond)) {
  fail("world-areas.json is missing the compact haven_pond preparation area");
} else {
  if (preparationPond.safeZone !== true) {
    fail("haven_pond must remain safe while agents acquire food");
  }
  if (preparationPond.fishing?.enabled !== true) {
    fail("haven_pond must enable dynamic fishing");
  }
  if (
    !Array.isArray(preparationPond.waterBodies) ||
    preparationPond.waterBodies.length === 0
  ) {
    fail("haven_pond must define explicit water geometry for reliable fishing");
  }
  const pondFloor = (preparationPond.flatZones ?? []).find(
    (zone) => zone?.id === "haven_pond_floor",
  );
  const pondWater = (preparationPond.waterBodies ?? []).find(
    (body) => body?.id === "haven_pond_water",
  );
  if (
    !pondFloor ||
    !pondWater ||
    !Number.isFinite(pondFloor.height) ||
    pondFloor.height >= pondWater.surfaceY
  ) {
    fail("haven_pond floor must remain below its explicit water surface");
  }
}

if (!isRecord(preparationTraining)) {
  fail("world-areas.json is missing level1Areas.preparation_training_grounds");
} else {
  const width =
    preparationTraining.bounds.maxX - preparationTraining.bounds.minX;
  const depth =
    preparationTraining.bounds.maxZ - preparationTraining.bounds.minZ;
  if (width > 80 || depth > 80) {
    fail(
      `preparation_training_grounds must remain compact (maximum 80x80); received ${width}x${depth}`,
    );
  }
  if (
    preparationTraining.safeZone !== false ||
    preparationTraining.difficultyLevel <= 0
  ) {
    fail("preparation_training_grounds must permit real combat training");
  }
  if (
    !Array.isArray(preparationTraining.mobSpawns) ||
    preparationTraining.mobSpawns.length === 0
  ) {
    fail("preparation_training_grounds must declare training mobs");
  }
  let trainingMobCount = 0;
  for (const spawn of preparationTraining.mobSpawns ?? []) {
    trainingMobCount += Number.isSafeInteger(spawn?.maxCount)
      ? spawn.maxCount
      : 0;
    const closestToSpawn =
      Math.hypot(spawn.position.x, spawn.position.z) - spawn.spawnRadius;
    if (closestToSpawn <= 25) {
      fail(
        `training mob ${String(spawn.mobId)} intersects the 25-tile town safety radius and can be suppressed at runtime`,
      );
    }
  }
  if (trainingMobCount > 20) {
    fail(
      `preparation_training_grounds declares ${trainingMobCount} simultaneous mobs; launch cap is 20`,
    );
  }
}

const ammunition = readJson("items/ammunition.json");
const weapons = readJson("items/weapons.json");
const ironArrow = Array.isArray(ammunition)
  ? ammunition.find((item) => item?.id === "iron_arrow")
  : null;
const runeArrow = Array.isArray(ammunition)
  ? ammunition.find((item) => item?.id === "rune_arrow")
  : null;
if (!ironArrow) {
  fail("items/ammunition.json is missing iron_arrow");
} else {
  assertAssetUrl("iron_arrow.modelPath", ironArrow.modelPath);
  assertAssetUrl("iron_arrow.equippedModelPath", ironArrow.equippedModelPath);
  assertAssetUrl("iron_arrow.iconPath", ironArrow.iconPath);
}
if (!runeArrow) {
  fail("items/ammunition.json is missing rune_arrow");
} else {
  if (runeArrow.modelPath !== null || runeArrow.equippedModelPath !== null) {
    fail(
      "rune_arrow must explicitly disable inferred equipped models; ProjectileRenderer owns its in-flight geometry",
    );
  }
  assertAssetUrl("rune_arrow.iconPath", runeArrow.iconPath);
}

for (const weaponId of [
  "bronze_longsword",
  "shortbow",
  "magic_shortbow",
  "staff_of_air",
]) {
  const weapon = Array.isArray(weapons)
    ? weapons.find((item) => item?.id === weaponId)
    : null;
  if (!weapon) {
    fail(`items/weapons.json is missing ${weaponId}`);
    continue;
  }
  assertAssetUrl(`${weaponId}.modelPath`, weapon.modelPath);
  assertAssetUrl(`${weaponId}.equippedModelPath`, weapon.equippedModelPath);
  assertAssetUrl(`${weaponId}.iconPath`, weapon.iconPath);
}

for (const impactFile of [
  "sword-clash-001.mp3",
  "sword-clash-002.mp3",
  "sword-clash-003.mp3",
  "sword-clash-004.mp3",
  "sword-clash-005.mp3",
  "sword-clash-006.mp3",
]) {
  assertAssetUrl(
    `melee impact ${impactFile}`,
    `asset://audio/soundeffects/${impactFile}`,
  );
}

if (failures.length > 0) {
  console.error("Duel launch asset validation failed:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Duel launch asset validation passed: ${areas.length} areas, ${resourceIds.size} resources, ${npcIds.size} NPC definitions, ${stationTypes.size} station types.`,
  );
}
