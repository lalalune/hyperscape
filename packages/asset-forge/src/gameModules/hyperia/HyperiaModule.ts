/**
 * HyperiaModule — Game module definition for the Hyperia MMORPG.
 *
 * Declares all entity types, palette categories, outliner layers, and terrain
 * config for the Hyperia game. Field definitions match the existing
 * Placed* interfaces from WorldStudio types.ts exactly.
 *
 * All entity types set `customEditor` to delegate to existing bespoke editors.
 * Remove `customEditor` on any type to switch it to the generic SchemaPropertyEditor.
 */

import type { GameModule } from "../GameModule";

export const HyperiaModule: GameModule = {
  id: "hyperia",
  name: "Hyperia",
  version: "0.2.0",
  // AP6 — palette / content browser unlock when these packs are
  // installed. We require trees as the minimum signal that the
  // user wants Hyperia content (it's the largest, most-visible
  // pack); from there they can install rocks / weapons / npcs /
  // etc. à la carte. Gating on ALL ten would force users to
  // install everything to see anything.
  requiredAssetPacks: ["@hyperforge/asset-pack-hyperia-trees-v1"],

  // ============== PALETTE CATEGORIES ==============

  paletteCategories: [
    {
      id: "npcs",
      label: "NPCs",
      icon: "Users",
      description: "Non-player characters, merchants, and quest givers",
    },
    {
      id: "world-features",
      label: "World Features",
      icon: "Globe",
      description: "Spawn points, teleports, and other world infrastructure",
    },
    {
      id: "creatures",
      label: "Creatures",
      icon: "Skull",
      description: "Mob spawns and boss encounters",
    },
    {
      id: "resources",
      label: "Resources",
      icon: "Gem",
      description: "Gathering nodes, mining spots, and resource areas",
    },
    {
      id: "structures",
      label: "Structures",
      icon: "Building2",
      description: "Stations, banks, altars, and crafting facilities",
    },
    {
      id: "pois",
      label: "Points of Interest",
      icon: "Landmark",
      description: "Dungeons, shrines, landmarks, and notable locations",
    },
    {
      id: "zones",
      label: "Zones & Regions",
      icon: "Map",
      description: "Danger sources, regions, and area boundaries",
    },
    {
      id: "water",
      label: "Water Bodies",
      icon: "Waves",
      description: "Rivers, lakes, and ponds",
    },
    {
      id: "audio",
      label: "Audio",
      icon: "Music",
      description: "Music zones, ambient sounds, and SFX triggers",
    },
    {
      id: "custom-assets",
      label: "Custom Assets",
      icon: "Package",
      description: "Imported or AI-generated 3D assets",
    },
  ],

  // ============== OUTLINER LAYERS ==============

  outlinerLayers: [
    {
      id: "npcs",
      label: "NPCs",
      icon: "Users",
      entityTypes: ["npc"],
    },
    {
      id: "world-features",
      label: "World Features",
      icon: "Globe",
      entityTypes: ["spawnPoint", "teleport"],
    },
    {
      id: "creatures",
      label: "Creatures",
      icon: "Skull",
      entityTypes: ["mobSpawn"],
    },
    {
      id: "resources",
      label: "Resources",
      icon: "Gem",
      entityTypes: ["resource", "mine"],
    },
    {
      id: "structures",
      label: "Structures",
      icon: "Building2",
      entityTypes: ["station"],
    },
    {
      id: "pois",
      label: "Points of Interest",
      icon: "Landmark",
      entityTypes: ["poi"],
    },
    {
      id: "zones",
      label: "Zones",
      icon: "Map",
      entityTypes: ["dangerSource", "region", "wilderness"],
    },
    {
      id: "water",
      label: "Water",
      icon: "Waves",
      entityTypes: ["waterBody"],
    },
    {
      id: "audio",
      label: "Audio",
      icon: "Music",
      entityTypes: ["musicZone", "ambientZone", "sfxTrigger"],
    },
    {
      id: "custom-assets",
      label: "Custom Assets",
      icon: "Package",
      entityTypes: ["customAsset"],
    },
  ],

  // ============== TERRAIN CONFIG ==============

  terrain: {
    enabled: true,
    tileSize: 4,
    biomes: [
      "plains",
      "forest",
      "desert",
      "snow",
      "swamp",
      "mountain",
      "beach",
      "canyon",
    ],
    procgen: true,
  },

  // ============== ENTITY TYPES ==============

  entityTypes: [
    // ───────── NPC ─────────
    // Matches PlacedNPC from WorldBuilder/types.ts
    {
      id: "npc",
      name: "NPC",
      icon: "User",
      color: "#2D8CFF",
      paletteCategory: "npcs",
      outlinerLayer: "npcs",
      selectionType: "npc",
      storage: { stateKey: "npcs", type: "array" },
      spatial: true,
      fields: [
        {
          key: "name",
          label: "Name",
          type: "string",
          section: "General",
          required: true,
          default: "NPC",
        },
        {
          key: "npcTypeId",
          label: "NPC Type",
          type: "manifest-ref",
          section: "General",
          required: true,
          description: "NPC template ID from npcs.json",
          config: { manifestRef: "npcs" },
        },
        {
          key: "storeId",
          label: "Store ID",
          type: "manifest-ref",
          section: "Merchant",
          description: "Store ID for merchant NPCs",
          config: { manifestRef: "stores" },
        },
        {
          key: "dialogId",
          label: "Dialog ID",
          type: "string",
          section: "Dialog",
          description: "Dialog tree ID",
        },
        {
          key: "rotation",
          label: "Rotation",
          type: "rotation",
          section: "Transform",
          default: 0,
        },
        {
          key: "position",
          label: "Position",
          type: "position",
          section: "Transform",
          default: { x: 0, y: 0, z: 0 },
        },
        {
          key: "behaviorGraph",
          label: "Behavior Script",
          type: "scriptGraph",
          section: "Behavior Script",
          description: "Optional node graph that drives custom NPC behavior.",
        },
      ],
      defaults: {
        name: "NPC",
        npcTypeId: "",
        parentContext: { type: "world" },
        rotation: 0,
        position: { x: 0, y: 0, z: 0 },
        properties: {},
      },
      marker: { shape: "capsule", scale: 1, yOffset: 0.5 },
      customSections: [
        { title: "Identity", widgetId: "NPCIdentity", defaultOpen: true },
        { title: "Stats", widgetId: "NPCStats", defaultOpen: false },
        { title: "Combat", widgetId: "NPCCombat", defaultOpen: false },
        { title: "Drops", widgetId: "NPCDrops", defaultOpen: false },
        { title: "Dialogue", widgetId: "NPCDialogue", defaultOpen: false },
        {
          title: "Linked Store",
          widgetId: "NPCLinkedStore",
          defaultOpen: false,
        },
        {
          title: "AI Generation",
          widgetId: "NPCAIGeneration",
          defaultOpen: false,
        },
        {
          title: "Manifest",
          widgetId: "NPCManifestMissing",
          defaultOpen: true,
        },
      ],
    },

    // ───────── Spawn Point ─────────
    // Matches PlacedSpawnPoint
    {
      id: "spawnPoint",
      name: "Spawn Point",
      icon: "MapPin",
      color: "#28D47A",
      paletteCategory: "world-features",
      outlinerLayer: "world-features",
      selectionType: "spawnPoint",
      storage: { stateKey: "spawnPoints", type: "array" },
      spatial: true,
      fields: [
        {
          key: "name",
          label: "Name",
          type: "string",
          section: "Spawn Point",
          required: true,
          default: "Spawn Point",
        },
        {
          key: "spawnType",
          label: "Spawn Type",
          type: "select",
          section: "Spawn Point",
          required: true,
          default: "initial",
          config: {
            options: [
              { value: "initial", label: "Initial Spawn" },
              { value: "death-respawn", label: "Death Respawn" },
              { value: "teleport-arrival", label: "Teleport Arrival" },
            ],
          },
        },
        {
          key: "capacity",
          label: "Capacity",
          type: "number",
          section: "Spawn Point",
          default: 1,
          config: { min: 1, max: 50, step: 1 },
        },
        {
          key: "position",
          label: "Position",
          type: "position",
          section: "Transform",
          default: { x: 0, y: 0, z: 0 },
        },
        {
          key: "rotation",
          label: "Rotation",
          type: "rotation",
          section: "Transform",
          default: 0,
          config: { step: 15, unit: "°" },
        },
        {
          key: "linkedAreaId",
          label: "Linked Area ID",
          type: "string",
          section: "Links",
          description: "Linked town or region ID",
          visibleWhen: { field: "linkedAreaId", notEquals: "" },
        },
      ],
      defaults: {
        name: "Spawn Point",
        spawnType: "initial",
        capacity: 1,
        rotation: 0,
        position: { x: 0, y: 0, z: 0 },
        linkedAreaId: "",
        properties: {},
      },
      marker: { shape: "capsule", scale: 1, yOffset: 0.5 },
      templates: [
        {
          id: "initial-spawn",
          name: "Initial Spawn",
          description: "Default player spawn point at world start",
          defaults: { spawnType: "initial", capacity: 10 },
        },
        {
          id: "respawn",
          name: "Death Respawn",
          description: "Respawn point after player death",
          defaults: { spawnType: "death-respawn", capacity: 5 },
        },
        {
          id: "teleport-arrival",
          name: "Teleport Arrival",
          description: "Arrival point for teleport network",
          defaults: { spawnType: "teleport-arrival", capacity: 3 },
        },
      ],
    },

    // ───────── Teleport ─────────
    // Matches PlacedTeleport
    {
      id: "teleport",
      name: "Teleport",
      icon: "Zap",
      color: "#a855f7",
      paletteCategory: "world-features",
      outlinerLayer: "world-features",
      selectionType: "teleport",
      storage: { stateKey: "teleports", type: "array" },
      spatial: true,
      fields: [
        {
          key: "name",
          label: "Name",
          type: "string",
          section: "General",
          required: true,
          default: "Teleport",
        },
        {
          key: "cost",
          label: "Gold Cost",
          type: "number",
          section: "General",
          default: 0,
          description: "Gold cost to use this teleport",
          config: { min: 0, max: 100000, step: 1 },
        },
        {
          key: "position",
          label: "Position",
          type: "position",
          section: "Transform",
          default: { x: 0, y: 0, z: 0 },
        },
        {
          key: "behaviorGraph",
          label: "Behavior Script",
          type: "scriptGraph",
          section: "Behavior Script",
          description:
            "Optional node graph that drives custom teleport behavior.",
        },
      ],
      defaults: {
        name: "Teleport",
        connections: [],
        requirements: {},
        cost: 0,
        position: { x: 0, y: 0, z: 0 },
        properties: {},
      },
      marker: { shape: "cylinder", scale: 1.2, yOffset: 0 },
      templates: [
        {
          id: "free-teleport",
          name: "Free Teleport",
          description: "No-cost teleport node",
          defaults: { cost: 0 },
        },
        {
          id: "paid-teleport",
          name: "Paid Teleport",
          description: "Teleport requiring gold payment",
          defaults: { cost: 100 },
        },
      ],
      customSections: [
        {
          title: "Requirements",
          widgetId: "TeleportRequirements",
          defaultOpen: true,
        },
        {
          title: "Connections",
          widgetId: "TeleportConnections",
          defaultOpen: true,
        },
      ],
    },

    // ───────── Mob Spawn ─────────
    // Matches PlacedMobSpawn
    {
      id: "mobSpawn",
      name: "Mob Spawn",
      icon: "Skull",
      color: "#FF7A00",
      paletteCategory: "creatures",
      outlinerLayer: "creatures",
      selectionType: "mobSpawn",
      storage: { stateKey: "mobSpawns", type: "array" },
      spatial: true,
      tracksSource: true,
      fields: [
        {
          key: "name",
          label: "Name",
          type: "string",
          section: "General",
          required: true,
          default: "Mob Spawn",
        },
        {
          key: "mobId",
          label: "Mob ID",
          type: "manifest-ref",
          section: "General",
          required: true,
          description: "Mob template ID from npcs.json",
          config: { manifestRef: "npcs" },
        },
        {
          key: "maxCount",
          label: "Max Count",
          type: "number",
          section: "Spawning",
          default: 3,
          description: "Maximum simultaneous instances",
          config: { min: 1, max: 50, step: 1 },
        },
        {
          key: "spawnRadius",
          label: "Spawn Radius",
          type: "slider",
          section: "Spawning",
          default: 5,
          description: "Radius from center where mobs can spawn",
          config: { min: 1, max: 30, step: 1, unit: "m" },
        },
        {
          key: "respawnTicks",
          label: "Respawn Ticks",
          type: "number",
          section: "Spawning",
          default: 100,
          description: "Respawn delay in game ticks",
          config: { min: 10, max: 1000, step: 10 },
        },
        {
          key: "position",
          label: "Position",
          type: "position",
          section: "Transform",
          default: { x: 0, y: 0, z: 0 },
        },
        {
          key: "behaviorGraph",
          label: "Behavior Script",
          type: "scriptGraph",
          section: "Behavior Script",
          description: "Visual event graph for spawn behavior triggers.",
        },
      ],
      defaults: {
        name: "Mob Spawn",
        mobId: "",
        maxCount: 3,
        spawnRadius: 5,
        respawnTicks: 100,
        position: { x: 0, y: 0, z: 0 },
        properties: {},
      },
      marker: {
        shape: "sphere",
        scale: 0.8,
        yOffset: 1,
        showRadius: true,
        radiusField: "spawnRadius",
      },
      customSections: [
        {
          title: "Identity",
          widgetId: "MobSpawnIdentity",
          defaultOpen: true,
        },
        { title: "Mob Stats", widgetId: "MobSpawnStats", defaultOpen: false },
        { title: "Combat", widgetId: "MobSpawnCombat", defaultOpen: false },
        { title: "Drops", widgetId: "MobSpawnDrops", defaultOpen: false },
        {
          title: "Manifest",
          widgetId: "MobSpawnManifestMissing",
          defaultOpen: true,
        },
      ],
    },

    // ───────── Resource ─────────
    // Matches PlacedResource
    {
      id: "resource",
      name: "Resource",
      icon: "Gem",
      color: "#D4AF37",
      paletteCategory: "resources",
      outlinerLayer: "resources",
      selectionType: "resource",
      storage: { stateKey: "resources", type: "array" },
      spatial: true,
      tracksSource: true,
      fields: [
        {
          key: "name",
          label: "Name",
          type: "string",
          section: "General",
          required: true,
          default: "Resource",
        },
        {
          key: "resourceId",
          label: "Resource ID",
          type: "string",
          section: "General",
          required: true,
          description: "Gathering manifest ID (e.g., ore_copper, tree_oak)",
        },
        {
          key: "resourceType",
          label: "Type",
          type: "select",
          section: "General",
          required: true,
          default: "mining",
          config: {
            options: [
              { value: "mining", label: "Mining" },
              { value: "woodcutting", label: "Woodcutting" },
              { value: "fishing", label: "Fishing" },
              { value: "farming", label: "Farming" },
            ],
          },
        },
        {
          key: "modelVariant",
          label: "Model Variant",
          type: "number",
          section: "Visual",
          default: 0,
          config: { min: 0, max: 10, step: 1 },
        },
        {
          key: "rotation",
          label: "Rotation",
          type: "rotation",
          section: "Transform",
          default: 0,
        },
        {
          key: "position",
          label: "Position",
          type: "position",
          section: "Transform",
          default: { x: 0, y: 0, z: 0 },
        },
        {
          key: "behaviorGraph",
          label: "Behavior Script",
          type: "scriptGraph",
          section: "Behavior Script",
          description:
            "Optional node graph that drives custom resource behavior.",
        },
      ],
      defaults: {
        name: "Resource",
        resourceId: "",
        resourceType: "mining",
        modelVariant: 0,
        rotation: 0,
        position: { x: 0, y: 0, z: 0 },
        properties: {},
      },
      marker: { shape: "cube", scale: 0.6, yOffset: 0.3 },
      customSections: [
        {
          title: "Manifest Data",
          widgetId: "ResourceManifestInfo",
          defaultOpen: false,
        },
      ],
    },

    // ───────── Station ─────────
    // Matches PlacedStation
    {
      id: "station",
      name: "Station",
      icon: "Building2",
      color: "#6D3AFF",
      paletteCategory: "structures",
      outlinerLayer: "structures",
      selectionType: "station",
      storage: { stateKey: "stations", type: "array" },
      spatial: true,
      tracksSource: true,
      fields: [
        {
          key: "name",
          label: "Name",
          type: "string",
          section: "General",
          required: true,
          default: "Station",
        },
        {
          key: "stationType",
          label: "Station Type",
          type: "manifest-ref",
          section: "General",
          required: true,
          description: "Type from stations.json",
          config: { manifestRef: "stations" },
        },
        {
          key: "bankId",
          label: "Bank ID",
          type: "string",
          section: "Station",
          description: "Bank ID (for bank stations)",
        },
        {
          key: "runeType",
          label: "Rune Type",
          type: "string",
          section: "Station",
          description: "Rune type (for runecrafting altars)",
        },
        {
          key: "rotation",
          label: "Rotation",
          type: "rotation",
          section: "Transform",
          default: 0,
        },
        {
          key: "position",
          label: "Position",
          type: "position",
          section: "Transform",
          default: { x: 0, y: 0, z: 0 },
        },
        {
          key: "behaviorGraph",
          label: "Behavior Script",
          type: "scriptGraph",
          section: "Behavior Script",
          description:
            "Optional node graph that drives custom station behavior.",
        },
      ],
      defaults: {
        name: "Station",
        stationType: "",
        rotation: 0,
        position: { x: 0, y: 0, z: 0 },
        properties: {},
      },
      marker: { shape: "cube", scale: 1, yOffset: 0.5 },
      customSections: [
        {
          title: "Manifest Data",
          widgetId: "StationManifestInfo",
          defaultOpen: false,
        },
        {
          title: "Recipes",
          widgetId: "StationRecipes",
          defaultOpen: false,
        },
      ],
    },

    // ───────── POI ─────────
    // Matches PlacedPOI
    {
      id: "poi",
      name: "Point of Interest",
      icon: "Landmark",
      color: "#06b6d4",
      paletteCategory: "pois",
      outlinerLayer: "pois",
      selectionType: "poi",
      storage: { stateKey: "pois", type: "array" },
      spatial: true,
      fields: [
        {
          key: "name",
          label: "Name",
          type: "string",
          section: "Point of Interest",
          required: true,
          default: "POI",
        },
        {
          key: "category",
          label: "Category",
          type: "select",
          section: "Point of Interest",
          required: true,
          default: "landmark",
          config: {
            options: [
              { value: "dungeon", label: "Dungeon" },
              { value: "shrine", label: "Shrine" },
              { value: "landmark", label: "Landmark" },
              { value: "resource_area", label: "Resource Area" },
              { value: "ruin", label: "Ruin" },
              { value: "camp", label: "Camp" },
              { value: "crossing", label: "Crossing" },
              { value: "waystation", label: "Waystation" },
              { value: "fishing_spot", label: "Fishing Spot" },
            ],
          },
        },
        {
          key: "importance",
          label: "Importance",
          type: "slider",
          section: "Point of Interest",
          default: 0.5,
          description: "Higher importance = more road connectivity",
          config: { min: 0, max: 1, step: 0.05 },
        },
        {
          key: "radius",
          label: "Radius",
          type: "number",
          section: "Point of Interest",
          default: 20,
          description: "POI area radius (m)",
          config: { min: 5, max: 100, step: 5, unit: "m" },
        },
        {
          key: "position",
          label: "Position",
          type: "position",
          section: "Position",
          default: { x: 0, y: 0, z: 0 },
        },
        {
          key: "behaviorGraph",
          label: "Behavior Script",
          type: "scriptGraph",
          section: "Behavior Script",
          description: "Visual event graph for entity behavior triggers",
        },
      ],
      defaults: {
        name: "POI",
        category: "landmark",
        importance: 0.5,
        radius: 20,
        connectedRoads: [],
        position: { x: 0, y: 0, z: 0 },
        properties: {},
      },
      marker: {
        shape: "cylinder",
        scale: 0.8,
        yOffset: 0.5,
        showRadius: true,
        radiusField: "radius",
      },
    },

    // ───────── Water Body ─────────
    // Matches PlacedWaterBody
    {
      id: "waterBody",
      name: "Water Body",
      icon: "Waves",
      color: "#0ea5e9",
      paletteCategory: "water",
      outlinerLayer: "water",
      selectionType: "waterBody",
      storage: { stateKey: "waterBodies", type: "array" },
      spatial: false, // position is implicit from waypoints/polygon
      fields: [
        {
          key: "name",
          label: "Name",
          type: "string",
          section: "General",
          required: true,
          default: "Water Body",
        },
        {
          key: "bodyType",
          label: "Body Type",
          type: "select",
          section: "General",
          required: true,
          default: "lake",
          config: {
            options: [
              { value: "river", label: "River" },
              { value: "lake", label: "Lake" },
              { value: "pond", label: "Pond" },
            ],
          },
        },
        {
          key: "surfaceY",
          label: "Surface Y",
          type: "number",
          section: "Water",
          description: "Water surface elevation",
          config: { step: 0.1 },
        },
        {
          key: "bermWidth",
          label: "Berm Width",
          type: "number",
          section: "Water",
          description: "River berm width",
          config: { min: 0, max: 50, step: 0.5, unit: "m" },
          visibleWhen: { field: "bodyType", equals: "river" },
        },
        {
          key: "valleyMultiplier",
          label: "Valley Multiplier",
          type: "number",
          section: "Water",
          description: "River valley depth",
          config: { min: 0, max: 5, step: 0.1 },
          visibleWhen: { field: "bodyType", equals: "river" },
        },
      ],
      defaults: { name: "Water Body", bodyType: "lake", properties: {} },
      marker: { shape: "cylinder", scale: 1, yOffset: 0 },
      customSections: [
        {
          title: "Geometry",
          widgetId: "WaterBodyGeometry",
          defaultOpen: true,
        },
      ],
    },

    // ───────── Region ─────────
    // Matches PlacedRegion
    {
      id: "region",
      name: "Region",
      icon: "Map",
      color: "#28D47A",
      paletteCategory: "zones",
      outlinerLayer: "zones",
      selectionType: "region",
      storage: { stateKey: "regions", type: "array" },
      spatial: false, // regions are defined by tile keys, not a single position
      fields: [],
      defaults: { name: "Region", description: "", tileKeys: [], tags: [] },
      marker: { shape: "billboard", scale: 1, yOffset: 2 },
      customSections: [
        {
          title: "Region",
          widgetId: "RegionFullEditor",
          defaultOpen: true,
        },
      ],
    },

    // ───────── Danger Source ─────────
    // Matches PlacedDangerSource
    {
      id: "dangerSource",
      name: "Danger Source",
      icon: "AlertTriangle",
      color: "#E84A4A",
      paletteCategory: "zones",
      outlinerLayer: "zones",
      selectionType: "dangerSource",
      storage: { stateKey: "dangerSources", type: "array" },
      spatial: true,
      fields: [
        {
          key: "name",
          label: "Name",
          type: "string",
          section: "Danger Source",
          required: true,
          default: "Danger Source",
        },
        {
          key: "description",
          label: "Description",
          type: "string",
          section: "Danger Source",
          description: "Optional description for tooltips",
        },
        {
          key: "radius",
          label: "Radius",
          type: "slider",
          section: "Influence",
          default: 50,
          description: "How far the danger influence extends",
          config: { min: 10, max: 500, step: 5, unit: "m" },
        },
        {
          key: "intensity",
          label: "Intensity",
          type: "slider",
          section: "Influence",
          default: 1,
          description: "Adds to biome difficulty (0-3)",
          config: { min: 0.1, max: 3, step: 0.1 },
        },
        {
          key: "falloffCurve",
          label: "Falloff Curve",
          type: "slider",
          section: "Influence",
          default: 2,
          description: "Higher = sharper drop-off at edges",
          config: { min: 0.5, max: 4, step: 0.1 },
        },
        {
          key: "position",
          label: "Position",
          type: "position",
          section: "Transform",
          default: { x: 0, y: 0, z: 0 },
        },
        {
          key: "behaviorGraph",
          label: "Behavior Script",
          type: "scriptGraph",
          section: "Behavior Script",
          description: "Visual event graph for entity behavior triggers",
        },
      ],
      defaults: {
        name: "Danger Source",
        radius: 50,
        intensity: 1,
        falloffCurve: 2,
        position: { x: 0, y: 0, z: 0 },
      },
      marker: {
        shape: "sphere",
        scale: 0.8,
        yOffset: 1,
        showRadius: true,
        radiusField: "radius",
      },
      templates: [
        {
          id: "low-danger",
          name: "Low Danger",
          description: "Mild danger zone for starter areas",
          defaults: { intensity: 0.5, radius: 30, falloffCurve: 3 },
        },
        {
          id: "medium-danger",
          name: "Medium Danger",
          description: "Moderate danger for mid-level zones",
          defaults: { intensity: 1.5, radius: 50, falloffCurve: 2 },
        },
        {
          id: "high-danger",
          name: "High Danger",
          description: "Severe danger for endgame areas",
          defaults: { intensity: 3, radius: 80, falloffCurve: 1 },
        },
      ],
    },

    // ───────── Mine ─────────
    // Matches PlacedMine
    {
      id: "mine",
      name: "Mine",
      icon: "Mountain",
      color: "#78716c",
      paletteCategory: "resources",
      outlinerLayer: "resources",
      selectionType: "mine",
      storage: { stateKey: "mines", type: "array" },
      spatial: true,
      tracksSource: true,
      fields: [
        {
          key: "name",
          label: "Name",
          type: "string",
          section: "General",
          required: true,
          default: "Mine",
        },
        {
          key: "biome",
          label: "Biome",
          type: "string",
          section: "General",
          readOnly: true,
        },
        {
          key: "tierIndex",
          label: "Tier",
          type: "number",
          section: "General",
          readOnly: true,
          description: "Difficulty tier index",
        },
        {
          key: "radius",
          label: "Radius",
          type: "number",
          section: "Area",
          default: 20,
          description: "Base mine area radius (m)",
          config: { min: 15, max: 25, step: 1, unit: "m" },
        },
        {
          key: "position",
          label: "Position",
          type: "position",
          section: "Transform",
          default: { x: 0, y: 0, z: 0 },
        },
      ],
      defaults: {
        name: "Mine",
        radius: 20,
        biome: "",
        tierIndex: 0,
        radialOffsets: [],
        entryAngle: 0,
        oreRocks: [],
        source: "procgen",
        position: { x: 0, y: 0, z: 0 },
        properties: {},
      },
      marker: {
        shape: "cylinder",
        scale: 1.5,
        yOffset: 0,
        showRadius: true,
        radiusField: "radius",
      },
    },

    // ───────── Custom Asset ─────────
    // Matches PlacedCustomAsset
    {
      id: "customAsset",
      name: "Custom Asset",
      icon: "Package",
      color: "#ec4899",
      paletteCategory: "custom-assets",
      outlinerLayer: "custom-assets",
      selectionType: "customAsset",
      storage: { stateKey: "customAssets", type: "array" },
      spatial: true,
      tracksSource: true,
      fields: [
        {
          key: "name",
          label: "Name",
          type: "string",
          section: "Custom Asset",
          required: true,
          default: "Custom Asset",
        },
        {
          key: "assetId",
          label: "Asset ID",
          type: "string",
          section: "Custom Asset",
          readOnly: true,
          description: "HyperForge asset ID",
        },
        {
          key: "modelPath",
          label: "Model",
          type: "string",
          section: "Custom Asset",
          readOnly: true,
          description: "Model file path",
        },
        {
          key: "position",
          label: "Position",
          type: "position",
          section: "Transform",
          default: { x: 0, y: 0, z: 0 },
        },
        {
          key: "rotation",
          label: "Rotation",
          type: "rotation",
          section: "Transform",
          default: 0,
          config: { step: 5, unit: "°" },
        },
        {
          key: "scale",
          label: "Scale",
          type: "slider",
          section: "Transform",
          default: 1,
          config: { min: 0.1, max: 10, step: 0.1 },
        },
      ],
      defaults: {
        name: "Custom Asset",
        assetId: "",
        assetName: "",
        scale: 1,
        rotation: 0,
        position: { x: 0, y: 0, z: 0 },
        properties: {},
      },
      marker: { shape: "model", scale: 1, yOffset: 0 },
    },

    // ───────── Music Zone ─────────
    // Matches MusicZone (audio layer)
    {
      id: "musicZone",
      name: "Music Zone",
      icon: "Music",
      // Void Violet — procedural / dimensional / abstract systems.
      // Music zones are dimensional / atmospheric overlays, so the
      // void-violet environmental accent reads correctly here.
      color: "#6D3AFF",
      paletteCategory: "audio",
      outlinerLayer: "audio",
      selectionType: "musicZone",
      storage: {
        stateKey: "musicZones",
        type: "array",
        stateRoot: "audioLayers",
      },
      spatial: false, // defined by polygon
      fields: [
        {
          key: "name",
          label: "Name",
          type: "string",
          section: "Music Zone",
          required: true,
          default: "Music Zone",
        },
        {
          key: "trackId",
          label: "Track ID",
          type: "string",
          section: "Music Zone",
          required: true,
          description: "Track ID from music.json",
        },
        {
          key: "combatTrackId",
          label: "Combat Track",
          type: "string",
          section: "Music Zone",
          description: "Override track during combat",
        },
        {
          key: "priority",
          label: "Priority",
          type: "number",
          section: "Zone Settings",
          default: 0,
          config: { min: 0, max: 100, step: 1 },
        },
        {
          key: "blendDistance",
          label: "Blend Distance",
          type: "slider",
          section: "Zone Settings",
          default: 10,
          description: "Transition distance at zone edges",
          config: { min: 1, max: 50, step: 1, unit: "m" },
        },
      ],
      defaults: {
        name: "Music Zone",
        trackId: "",
        priority: 0,
        blendDistance: 10,
        polygon: [],
      },
      marker: { shape: "billboard", scale: 1, yOffset: 2 },
    },

    // ───────── Ambient Zone ─────────
    // Matches AmbientZone (audio layer)
    {
      id: "ambientZone",
      name: "Ambient Zone",
      icon: "Volume2",
      color: "#14b8a6",
      paletteCategory: "audio",
      outlinerLayer: "audio",
      selectionType: "ambientZone",
      storage: {
        stateKey: "ambientZones",
        type: "array",
        stateRoot: "audioLayers",
      },
      spatial: false,
      fields: [
        {
          key: "name",
          label: "Name",
          type: "string",
          section: "Ambient Zone",
          required: true,
          default: "Ambient Zone",
        },
        {
          key: "ambientType",
          label: "Type",
          type: "select",
          section: "Ambient Zone",
          required: true,
          default: "forest",
          config: {
            options: [
              { value: "forest", label: "Forest" },
              { value: "cave", label: "Cave" },
              { value: "ocean", label: "Ocean" },
              { value: "town", label: "Town" },
              { value: "desert", label: "Desert" },
              { value: "mountain", label: "Mountain" },
              { value: "swamp", label: "Swamp" },
              { value: "custom", label: "Custom" },
            ],
          },
        },
        {
          key: "volume",
          label: "Volume",
          type: "slider",
          section: "Sound Settings",
          default: 0.8,
          description: "Playback volume (0 = silent, 1 = full)",
          config: { min: 0, max: 1, step: 0.05 },
        },
        {
          key: "falloffDistance",
          label: "Falloff Distance",
          type: "slider",
          section: "Sound Settings",
          default: 10,
          description: "Edge fade distance",
          config: { min: 1, max: 50, step: 1, unit: "m" },
        },
        {
          key: "tracks",
          label: "Tracks",
          type: "tags",
          section: "Tracks",
          default: [],
          description: "Sound asset paths (layered)",
        },
      ],
      defaults: {
        name: "Ambient Zone",
        ambientType: "forest",
        tracks: [],
        polygon: [],
        volume: 0.8,
        falloffDistance: 10,
      },
      marker: { shape: "billboard", scale: 1, yOffset: 2 },
    },

    // ───────── SFX Trigger ─────────
    // Matches SFXTrigger (audio layer)
    {
      id: "sfxTrigger",
      name: "SFX Trigger",
      icon: "Bell",
      color: "#FF7A00",
      paletteCategory: "audio",
      outlinerLayer: "audio",
      selectionType: "sfxTrigger",
      storage: {
        stateKey: "sfxTriggers",
        type: "array",
        stateRoot: "audioLayers",
      },
      spatial: true,
      fields: [
        {
          key: "name",
          label: "Name",
          type: "string",
          section: "General",
          required: true,
          default: "SFX Trigger",
        },
        {
          key: "soundPath",
          label: "Sound Path",
          type: "string",
          section: "Sound",
          required: true,
          description: "Sound asset path",
        },
        {
          key: "description",
          label: "Description",
          type: "string",
          section: "Sound",
          description: "Description for AI generation",
        },
        {
          key: "volume",
          label: "Volume",
          type: "slider",
          section: "Playback",
          default: 0.8,
          config: { min: 0, max: 1, step: 0.05 },
        },
        {
          key: "radius",
          label: "Radius",
          type: "slider",
          section: "Playback",
          default: 10,
          description: "Audible distance from position",
          config: { min: 1, max: 100, step: 1, unit: "m" },
        },
        {
          key: "looping",
          label: "Looping",
          type: "boolean",
          section: "Playback",
          default: false,
        },
        {
          key: "position",
          label: "Position",
          type: "position",
          section: "Transform",
          default: { x: 0, y: 0, z: 0 },
        },
      ],
      defaults: {
        name: "SFX Trigger",
        soundPath: "",
        radius: 10,
        volume: 0.8,
        looping: false,
        position: { x: 0, y: 0, z: 0 },
      },
      marker: {
        shape: "sphere",
        scale: 0.5,
        yOffset: 0.5,
        showRadius: true,
        radiusField: "radius",
      },
    },

    // ───────── Wilderness Boundary (singleton, scalar storage) ─────────
    // World-scoped PvP boundary polyline. Not placeable from the palette —
    // drawn via the wilderness tool. Schema exists so PropertiesPanel
    // routes selection.type="wilderness" through SchemaPropertyEditor.
    {
      id: "wilderness",
      name: "Wilderness Boundary",
      icon: "AlertTriangle",
      color: "#E84A4A",
      paletteCategory: "zones",
      outlinerLayer: "zones",
      selectionType: "wilderness",
      storage: { stateKey: "wildernessBoundary", type: "scalar" },
      spatial: false,
      fields: [],
      defaults: {
        points: [],
        levelScale: 10,
        maxLevel: 56,
      },
      marker: { shape: "capsule", scale: 1, yOffset: 0 },
      customSections: [
        {
          title: "Wilderness Boundary",
          widgetId: "WildernessBoundaryEditor",
          defaultOpen: true,
        },
      ],
    },
  ],
};
