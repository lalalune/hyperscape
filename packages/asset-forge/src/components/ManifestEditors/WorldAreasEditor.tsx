/**
 * WorldAreasEditor
 * Visual map-based editor for world-areas.json
 * Shows areas on a 2D map with NPCs, resources, mob spawns, and stations
 */

import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Skull,
  User,
  Building,
  Fish,
  Swords,
  Shield,
  Settings,
  Move,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import React, { useState, useCallback, useMemo, useRef } from "react";

// Types based on world-areas.json structure
interface Position {
  x: number;
  y: number;
  z: number;
}

interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface AreaNPC {
  id: string;
  type: string;
  position: Position;
  storeId?: string;
}

interface AreaResource {
  type: string;
  position: Position;
  resourceId: string;
}

interface MobSpawn {
  mobId: string;
  position: Position;
  spawnRadius: number;
  maxCount: number;
}

interface Station {
  id: string;
  type: string;
  position: Position;
  bankId?: string;
}

interface FishingConfig {
  enabled: boolean;
  spotCount: number;
  spotTypes: string[];
}

interface WorldArea {
  id: string;
  name: string;
  description: string;
  difficultyLevel: number;
  bounds: Bounds;
  biomeType: string;
  safeZone: boolean;
  pvpEnabled?: boolean;
  npcs: AreaNPC[];
  resources: AreaResource[];
  mobSpawns: MobSpawn[];
  fishing: FishingConfig;
  stations?: Station[];
}

interface WorldAreasData {
  starterTowns: Record<string, WorldArea>;
  level1Areas: Record<string, WorldArea>;
  level2Areas: Record<string, WorldArea>;
  level3Areas: Record<string, WorldArea>;
}

interface WorldAreasEditorProps {
  data: WorldAreasData;
  onChange: (data: WorldAreasData) => void;
  availableNpcs: string[];
  availableMobs: string[];
  // Reserved for future resource editor functionality
  _availableResources?: string[];
}

const AREA_CATEGORIES = [
  { key: "starterTowns", label: "Starter Towns", color: "#28D47A" },
  { key: "level1Areas", label: "Level 1 Areas", color: "#D4AF37" },
  { key: "level2Areas", label: "Level 2 Areas", color: "#FF7A00" },
  { key: "level3Areas", label: "Level 3 Areas", color: "#E84A4A" },
] as const;

type AreaCategory = (typeof AREA_CATEGORIES)[number]["key"];

const BIOME_TYPES = [
  "starter_town",
  "plains",
  "forest",
  "mountains",
  "desert",
  "swamp",
  "tundra",
  "wastes",
];

const NPC_TYPES = ["bank", "general_store", "quest_giver", "trainer", "guard"];
const STATION_TYPES = ["bank", "furnace", "anvil", "altar", "range"];
const FISHING_SPOT_TYPES = [
  "fishing_spot_net",
  "fishing_spot_bait",
  "fishing_spot_fly",
  "fishing_spot_cage",
  "fishing_spot_harpoon",
];

export const WorldAreasEditor: React.FC<WorldAreasEditorProps> = ({
  data,
  onChange,
  availableNpcs,
  availableMobs,
  // Note: _availableResources reserved for future resource placement UI
}) => {
  const [selectedCategory, setSelectedCategory] =
    useState<AreaCategory>("starterTowns");
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["general", "npcs", "resources"]),
  );
  const [mapZoom, setMapZoom] = useState(1);
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const mapRef = useRef<HTMLDivElement>(null);

  const areas = data[selectedCategory];
  const selectedArea = selectedAreaId ? areas[selectedAreaId] : null;

  // Get all areas for the map view
  const allAreas = useMemo(() => {
    const result: { area: WorldArea; category: AreaCategory; color: string }[] =
      [];
    for (const cat of AREA_CATEGORIES) {
      const categoryAreas = data[cat.key];
      for (const area of Object.values(categoryAreas)) {
        result.push({ area, category: cat.key, color: cat.color });
      }
    }
    return result;
  }, [data]);

  // Calculate map bounds
  const mapBounds = useMemo(() => {
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;

    for (const { area } of allAreas) {
      minX = Math.min(minX, area.bounds.minX);
      maxX = Math.max(maxX, area.bounds.maxX);
      minZ = Math.min(minZ, area.bounds.minZ);
      maxZ = Math.max(maxZ, area.bounds.maxZ);
    }

    // Add padding
    const padding = 50;
    return {
      minX: minX - padding,
      maxX: maxX + padding,
      minZ: minZ - padding,
      maxZ: maxZ + padding,
      width: maxX - minX + padding * 2,
      height: maxZ - minZ + padding * 2,
    };
  }, [allAreas]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  const updateArea = useCallback(
    (category: AreaCategory, areaId: string, updates: Partial<WorldArea>) => {
      const newData = { ...data };
      newData[category] = {
        ...newData[category],
        [areaId]: { ...newData[category][areaId], ...updates },
      };
      onChange(newData);
    },
    [data, onChange],
  );

  const addNpcToArea = useCallback(
    (category: AreaCategory, areaId: string) => {
      const area = data[category][areaId];
      if (!area) return;

      const newNpc: AreaNPC = {
        id: availableNpcs[0] || "new_npc",
        type: "quest_giver",
        position: {
          x: (area.bounds.minX + area.bounds.maxX) / 2,
          y: 0,
          z: (area.bounds.minZ + area.bounds.maxZ) / 2,
        },
      };

      updateArea(category, areaId, { npcs: [...area.npcs, newNpc] });
    },
    [data, updateArea, availableNpcs],
  );

  const updateNpc = useCallback(
    (
      category: AreaCategory,
      areaId: string,
      npcIndex: number,
      updates: Partial<AreaNPC>,
    ) => {
      const area = data[category][areaId];
      if (!area) return;

      const newNpcs = area.npcs.map((npc, i) =>
        i === npcIndex ? { ...npc, ...updates } : npc,
      );

      updateArea(category, areaId, { npcs: newNpcs });
    },
    [data, updateArea],
  );

  const deleteNpc = useCallback(
    (category: AreaCategory, areaId: string, npcIndex: number) => {
      const area = data[category][areaId];
      if (!area) return;

      updateArea(category, areaId, {
        npcs: area.npcs.filter((_, i) => i !== npcIndex),
      });
    },
    [data, updateArea],
  );

  // Reserved for future resource editor functionality
  const _addResourceToArea = useCallback(
    (category: AreaCategory, areaId: string) => {
      const area = data[category][areaId];
      if (!area) return;

      const newResource: AreaResource = {
        type: "tree",
        position: {
          x: (area.bounds.minX + area.bounds.maxX) / 2,
          y: 0,
          z: (area.bounds.minZ + area.bounds.maxZ) / 2,
        },
        resourceId: "tree_normal",
      };

      updateArea(category, areaId, {
        resources: [...area.resources, newResource],
      });
    },
    [data, updateArea],
  );

  const _updateResource = useCallback(
    (
      category: AreaCategory,
      areaId: string,
      resourceIndex: number,
      updates: Partial<AreaResource>,
    ) => {
      const area = data[category][areaId];
      if (!area) return;

      const newResources = area.resources.map((res, i) =>
        i === resourceIndex ? { ...res, ...updates } : res,
      );

      updateArea(category, areaId, { resources: newResources });
    },
    [data, updateArea],
  );

  const _deleteResource = useCallback(
    (category: AreaCategory, areaId: string, resourceIndex: number) => {
      const area = data[category][areaId];
      if (!area) return;

      updateArea(category, areaId, {
        resources: area.resources.filter((_, i) => i !== resourceIndex),
      });
    },
    [data, updateArea],
  );

  const addMobSpawn = useCallback(
    (category: AreaCategory, areaId: string) => {
      const area = data[category][areaId];
      if (!area) return;

      const newSpawn: MobSpawn = {
        mobId: availableMobs[0] || "goblin",
        position: {
          x: (area.bounds.minX + area.bounds.maxX) / 2,
          y: 0,
          z: (area.bounds.minZ + area.bounds.maxZ) / 2,
        },
        spawnRadius: 5,
        maxCount: 3,
      };

      updateArea(category, areaId, {
        mobSpawns: [...area.mobSpawns, newSpawn],
      });
    },
    [data, updateArea, availableMobs],
  );

  const updateMobSpawn = useCallback(
    (
      category: AreaCategory,
      areaId: string,
      spawnIndex: number,
      updates: Partial<MobSpawn>,
    ) => {
      const area = data[category][areaId];
      if (!area) return;

      const newSpawns = area.mobSpawns.map((spawn, i) =>
        i === spawnIndex ? { ...spawn, ...updates } : spawn,
      );

      updateArea(category, areaId, { mobSpawns: newSpawns });
    },
    [data, updateArea],
  );

  const deleteMobSpawn = useCallback(
    (category: AreaCategory, areaId: string, spawnIndex: number) => {
      const area = data[category][areaId];
      if (!area) return;

      updateArea(category, areaId, {
        mobSpawns: area.mobSpawns.filter((_, i) => i !== spawnIndex),
      });
    },
    [data, updateArea],
  );

  const addStation = useCallback(
    (category: AreaCategory, areaId: string) => {
      const area = data[category][areaId];
      if (!area) return;

      const newStation: Station = {
        id: `station_${Date.now()}`,
        type: "anvil",
        position: {
          x: (area.bounds.minX + area.bounds.maxX) / 2,
          y: 0,
          z: (area.bounds.minZ + area.bounds.maxZ) / 2,
        },
      };

      updateArea(category, areaId, {
        stations: [...(area.stations || []), newStation],
      });
    },
    [data, updateArea],
  );

  const updateStation = useCallback(
    (
      category: AreaCategory,
      areaId: string,
      stationIndex: number,
      updates: Partial<Station>,
    ) => {
      const area = data[category][areaId];
      if (!area || !area.stations) return;

      const newStations = area.stations.map((station, i) =>
        i === stationIndex ? { ...station, ...updates } : station,
      );

      updateArea(category, areaId, { stations: newStations });
    },
    [data, updateArea],
  );

  const deleteStation = useCallback(
    (category: AreaCategory, areaId: string, stationIndex: number) => {
      const area = data[category][areaId];
      if (!area || !area.stations) return;

      updateArea(category, areaId, {
        stations: area.stations.filter((_, i) => i !== stationIndex),
      });
    },
    [data, updateArea],
  );

  const createNewArea = useCallback(
    (category: AreaCategory) => {
      const newId = `new_area_${Date.now()}`;
      const newArea: WorldArea = {
        id: newId,
        name: "New Area",
        description: "",
        difficultyLevel:
          category === "starterTowns"
            ? 0
            : parseInt(category.charAt(5), 10) || 1,
        bounds: { minX: 0, maxX: 100, minZ: 0, maxZ: 100 },
        biomeType: category === "starterTowns" ? "starter_town" : "plains",
        safeZone: category === "starterTowns",
        pvpEnabled: false,
        npcs: [],
        resources: [],
        mobSpawns: [],
        fishing: { enabled: false, spotCount: 0, spotTypes: [] },
        stations: [],
      };

      const newData = { ...data };
      newData[category] = { ...newData[category], [newId]: newArea };
      onChange(newData);
      setSelectedAreaId(newId);
    },
    [data, onChange],
  );

  const deleteArea = useCallback(
    (category: AreaCategory, areaId: string) => {
      if (!confirm(`Delete area "${areaId}"?`)) return;

      const newData = { ...data };
      const { [areaId]: _, ...rest } = newData[category];
      newData[category] = rest;
      onChange(newData);

      if (selectedAreaId === areaId) {
        setSelectedAreaId(null);
      }
    },
    [data, onChange, selectedAreaId],
  );

  // Map interaction handlers
  const handleMapMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - mapOffset.x, y: e.clientY - mapOffset.y });
  };

  const handleMapMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setMapOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMapMouseUp = () => {
    setIsDragging(false);
  };

  // Convert world coordinates to map coordinates
  const worldToMap = (x: number, z: number) => {
    const mapWidth = 600;
    const mapHeight = 400;
    const scale = Math.min(
      mapWidth / mapBounds.width,
      mapHeight / mapBounds.height,
    );

    return {
      x: (x - mapBounds.minX) * scale * mapZoom + mapOffset.x,
      y: (z - mapBounds.minZ) * scale * mapZoom + mapOffset.y,
    };
  };

  return (
    <div className="flex h-full">
      {/* Area list sidebar */}
      <div className="w-72 border-r border-border-primary bg-bg-secondary flex flex-col">
        {/* Category tabs */}
        <div className="p-2 border-b border-border-primary flex flex-wrap gap-1">
          {AREA_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
                selectedCategory === cat.key
                  ? "bg-primary bg-opacity-20 text-primary"
                  : "text-text-secondary hover:bg-bg-tertiary"
              }`}
              onClick={() => {
                setSelectedCategory(cat.key);
                setSelectedAreaId(null);
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              {cat.label}
            </button>
          ))}
        </div>

        {/* Add area button */}
        <div className="p-2 border-b border-border-primary">
          <button
            onClick={() => createNewArea(selectedCategory)}
            className="w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-primary bg-opacity-20 text-primary rounded text-xs hover:bg-opacity-30"
          >
            <Plus className="w-3 h-3" />
            Add Area
          </button>
        </div>

        {/* Area list */}
        <div className="flex-1 overflow-y-auto">
          {Object.values(areas).map((area) => (
            <button
              key={area.id}
              className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-bg-tertiary transition-colors ${
                selectedAreaId === area.id
                  ? "bg-primary bg-opacity-10 border-l-2 border-primary"
                  : ""
              }`}
              onClick={() => setSelectedAreaId(area.id)}
            >
              <MapPin className="w-4 h-4 text-primary" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-text-primary truncate text-sm">
                  {area.name}
                </div>
                <div className="text-xs text-text-muted flex items-center gap-2">
                  <span>{area.biomeType}</span>
                  {area.safeZone && (
                    <Shield className="w-3 h-3 text-green-400" />
                  )}
                  {area.pvpEnabled && (
                    <Swords className="w-3 h-3 text-red-400" />
                  )}
                </div>
              </div>
            </button>
          ))}
          {Object.keys(areas).length === 0 && (
            <div className="p-4 text-center text-text-muted text-sm">
              No areas in this category
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Map view */}
        <div className="h-64 bg-bg-tertiary border-b border-border-primary relative overflow-hidden">
          {/* Zoom controls */}
          <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
            <button
              onClick={() => setMapZoom((z) => Math.min(z + 0.2, 3))}
              className="p-1 bg-bg-secondary rounded hover:bg-bg-tertiary"
            >
              <ZoomIn className="w-4 h-4 text-text-secondary" />
            </button>
            <button
              onClick={() => setMapZoom((z) => Math.max(z - 0.2, 0.5))}
              className="p-1 bg-bg-secondary rounded hover:bg-bg-tertiary"
            >
              <ZoomOut className="w-4 h-4 text-text-secondary" />
            </button>
            <button
              onClick={() => {
                setMapZoom(1);
                setMapOffset({ x: 0, y: 0 });
              }}
              className="p-1 bg-bg-secondary rounded hover:bg-bg-tertiary"
            >
              <Move className="w-4 h-4 text-text-secondary" />
            </button>
          </div>

          {/* Map canvas */}
          <div
            ref={mapRef}
            className="w-full h-full cursor-move"
            onMouseDown={handleMapMouseDown}
            onMouseMove={handleMapMouseMove}
            onMouseUp={handleMapMouseUp}
            onMouseLeave={handleMapMouseUp}
          >
            <svg width="100%" height="100%" className="overflow-visible">
              {/* Grid */}
              <defs>
                <pattern
                  id="grid"
                  width={50 * mapZoom}
                  height={50 * mapZoom}
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d={`M ${50 * mapZoom} 0 L 0 0 0 ${50 * mapZoom}`}
                    fill="none"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Areas */}
              {allAreas.map(({ area, color }) => {
                const topLeft = worldToMap(area.bounds.minX, area.bounds.minZ);
                const bottomRight = worldToMap(
                  area.bounds.maxX,
                  area.bounds.maxZ,
                );
                const width = bottomRight.x - topLeft.x;
                const height = bottomRight.y - topLeft.y;
                const isSelected = selectedAreaId === area.id;

                return (
                  <g key={area.id}>
                    <rect
                      x={topLeft.x}
                      y={topLeft.y}
                      width={width}
                      height={height}
                      fill={color}
                      fillOpacity={isSelected ? 0.4 : 0.2}
                      stroke={color}
                      strokeWidth={isSelected ? 2 : 1}
                      className="cursor-pointer"
                      onClick={() => setSelectedAreaId(area.id)}
                    />
                    <text
                      x={topLeft.x + width / 2}
                      y={topLeft.y + height / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize={10 * mapZoom}
                      className="pointer-events-none"
                    >
                      {area.name}
                    </text>

                    {/* Show NPCs */}
                    {isSelected &&
                      area.npcs.map((npc, i) => {
                        const pos = worldToMap(npc.position.x, npc.position.z);
                        return (
                          <circle
                            key={`npc-${i}`}
                            cx={pos.x}
                            cy={pos.y}
                            r={4 * mapZoom}
                            fill="#2D8CFF"
                            stroke="white"
                            strokeWidth={1}
                          />
                        );
                      })}

                    {/* Show mob spawns */}
                    {isSelected &&
                      area.mobSpawns.map((spawn, i) => {
                        const pos = worldToMap(
                          spawn.position.x,
                          spawn.position.z,
                        );
                        return (
                          <circle
                            key={`mob-${i}`}
                            cx={pos.x}
                            cy={pos.y}
                            r={4 * mapZoom}
                            fill="#E84A4A"
                            stroke="white"
                            strokeWidth={1}
                          />
                        );
                      })}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Legend */}
          <div className="absolute bottom-2 left-2 flex gap-3 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              NPCs
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              Mobs
            </span>
          </div>
        </div>

        {/* Editor panel */}
        {selectedArea ? (
          <div className="flex-1 overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-bg-secondary border-b border-border-primary p-4 flex items-center justify-between z-10">
              <div>
                <input
                  type="text"
                  value={selectedArea.name}
                  onChange={(e) =>
                    updateArea(selectedCategory, selectedArea.id, {
                      name: e.target.value,
                    })
                  }
                  className="text-lg font-semibold text-text-primary bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
                />
                <div className="text-xs text-text-muted">
                  ID: {selectedArea.id}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => deleteArea(selectedCategory, selectedArea.id)}
                  className="p-2 hover:bg-red-500 hover:bg-opacity-20 rounded text-red-400"
                  title="Delete area"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* General Section */}
              <Section
                title="General"
                icon={<Settings className="w-4 h-4" />}
                expanded={expandedSections.has("general")}
                onToggle={() => toggleSection("general")}
              >
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Description">
                    <textarea
                      value={selectedArea.description}
                      onChange={(e) =>
                        updateArea(selectedCategory, selectedArea.id, {
                          description: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary resize-none"
                      rows={2}
                    />
                  </FormField>

                  <FormField label="Biome Type">
                    <select
                      value={selectedArea.biomeType}
                      onChange={(e) =>
                        updateArea(selectedCategory, selectedArea.id, {
                          biomeType: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                    >
                      {BIOME_TYPES.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Difficulty Level">
                    <input
                      type="number"
                      min="0"
                      max="5"
                      value={selectedArea.difficultyLevel}
                      onChange={(e) =>
                        updateArea(selectedCategory, selectedArea.id, {
                          difficultyLevel: parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                    />
                  </FormField>

                  <FormField label="Flags">
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedArea.safeZone}
                          onChange={(e) =>
                            updateArea(selectedCategory, selectedArea.id, {
                              safeZone: e.target.checked,
                            })
                          }
                          className="rounded"
                        />
                        <span className="text-sm text-text-primary">
                          Safe Zone
                        </span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedArea.pvpEnabled || false}
                          onChange={(e) =>
                            updateArea(selectedCategory, selectedArea.id, {
                              pvpEnabled: e.target.checked,
                            })
                          }
                          className="rounded"
                        />
                        <span className="text-sm text-text-primary">
                          PvP Enabled
                        </span>
                      </label>
                    </div>
                  </FormField>
                </div>

                {/* Bounds */}
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-text-primary mb-2">
                    Bounds
                  </h4>
                  <div className="grid grid-cols-4 gap-3">
                    <FormField label="Min X">
                      <input
                        type="number"
                        value={selectedArea.bounds.minX}
                        onChange={(e) =>
                          updateArea(selectedCategory, selectedArea.id, {
                            bounds: {
                              ...selectedArea.bounds,
                              minX: parseInt(e.target.value, 10),
                            },
                          })
                        }
                        className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                      />
                    </FormField>
                    <FormField label="Max X">
                      <input
                        type="number"
                        value={selectedArea.bounds.maxX}
                        onChange={(e) =>
                          updateArea(selectedCategory, selectedArea.id, {
                            bounds: {
                              ...selectedArea.bounds,
                              maxX: parseInt(e.target.value, 10),
                            },
                          })
                        }
                        className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                      />
                    </FormField>
                    <FormField label="Min Z">
                      <input
                        type="number"
                        value={selectedArea.bounds.minZ}
                        onChange={(e) =>
                          updateArea(selectedCategory, selectedArea.id, {
                            bounds: {
                              ...selectedArea.bounds,
                              minZ: parseInt(e.target.value, 10),
                            },
                          })
                        }
                        className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                      />
                    </FormField>
                    <FormField label="Max Z">
                      <input
                        type="number"
                        value={selectedArea.bounds.maxZ}
                        onChange={(e) =>
                          updateArea(selectedCategory, selectedArea.id, {
                            bounds: {
                              ...selectedArea.bounds,
                              maxZ: parseInt(e.target.value, 10),
                            },
                          })
                        }
                        className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                      />
                    </FormField>
                  </div>
                </div>
              </Section>

              {/* NPCs Section */}
              <Section
                title="NPCs"
                icon={<User className="w-4 h-4" />}
                expanded={expandedSections.has("npcs")}
                onToggle={() => toggleSection("npcs")}
                badge={selectedArea.npcs.length.toString()}
              >
                <div className="space-y-3">
                  <button
                    onClick={() =>
                      addNpcToArea(selectedCategory, selectedArea.id)
                    }
                    className="flex items-center gap-1 px-3 py-1 bg-primary bg-opacity-20 text-primary rounded text-sm hover:bg-opacity-30"
                  >
                    <Plus className="w-4 h-4" />
                    Add NPC
                  </button>

                  {selectedArea.npcs.map((npc, index) => (
                    <div
                      key={index}
                      className="p-3 bg-bg-tertiary rounded space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <select
                          value={npc.id}
                          onChange={(e) =>
                            updateNpc(
                              selectedCategory,
                              selectedArea.id,
                              index,
                              { id: e.target.value },
                            )
                          }
                          className="flex-1 px-2 py-1 bg-bg-primary border border-border-primary rounded text-sm text-text-primary"
                        >
                          {availableNpcs.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                        <select
                          value={npc.type}
                          onChange={(e) =>
                            updateNpc(
                              selectedCategory,
                              selectedArea.id,
                              index,
                              { type: e.target.value },
                            )
                          }
                          className="w-32 px-2 py-1 bg-bg-primary border border-border-primary rounded text-sm text-text-primary"
                        >
                          {NPC_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() =>
                            deleteNpc(selectedCategory, selectedArea.id, index)
                          }
                          className="p-1 text-red-400 hover:bg-red-500 hover:bg-opacity-20 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-text-muted">Position:</span>
                        <input
                          type="number"
                          value={npc.position.x}
                          onChange={(e) =>
                            updateNpc(
                              selectedCategory,
                              selectedArea.id,
                              index,
                              {
                                position: {
                                  ...npc.position,
                                  x: parseInt(e.target.value, 10),
                                },
                              },
                            )
                          }
                          className="w-16 px-1 py-0.5 bg-bg-primary border border-border-primary rounded text-text-primary"
                          placeholder="X"
                        />
                        <input
                          type="number"
                          value={npc.position.z}
                          onChange={(e) =>
                            updateNpc(
                              selectedCategory,
                              selectedArea.id,
                              index,
                              {
                                position: {
                                  ...npc.position,
                                  z: parseInt(e.target.value, 10),
                                },
                              },
                            )
                          }
                          className="w-16 px-1 py-0.5 bg-bg-primary border border-border-primary rounded text-text-primary"
                          placeholder="Z"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Mob Spawns Section */}
              <Section
                title="Mob Spawns"
                icon={<Skull className="w-4 h-4" />}
                expanded={expandedSections.has("mobs")}
                onToggle={() => toggleSection("mobs")}
                badge={selectedArea.mobSpawns.length.toString()}
              >
                <div className="space-y-3">
                  <button
                    onClick={() =>
                      addMobSpawn(selectedCategory, selectedArea.id)
                    }
                    className="flex items-center gap-1 px-3 py-1 bg-red-500 bg-opacity-20 text-red-400 rounded text-sm hover:bg-opacity-30"
                  >
                    <Plus className="w-4 h-4" />
                    Add Spawn
                  </button>

                  {selectedArea.mobSpawns.map((spawn, index) => (
                    <div
                      key={index}
                      className="p-3 bg-bg-tertiary rounded space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <select
                          value={spawn.mobId}
                          onChange={(e) =>
                            updateMobSpawn(
                              selectedCategory,
                              selectedArea.id,
                              index,
                              { mobId: e.target.value },
                            )
                          }
                          className="flex-1 px-2 py-1 bg-bg-primary border border-border-primary rounded text-sm text-text-primary"
                        >
                          {availableMobs.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={spawn.maxCount}
                          onChange={(e) =>
                            updateMobSpawn(
                              selectedCategory,
                              selectedArea.id,
                              index,
                              { maxCount: parseInt(e.target.value, 10) },
                            )
                          }
                          className="w-16 px-2 py-1 bg-bg-primary border border-border-primary rounded text-sm text-text-primary"
                          title="Max Count"
                        />
                        <input
                          type="number"
                          value={spawn.spawnRadius}
                          onChange={(e) =>
                            updateMobSpawn(
                              selectedCategory,
                              selectedArea.id,
                              index,
                              { spawnRadius: parseInt(e.target.value, 10) },
                            )
                          }
                          className="w-16 px-2 py-1 bg-bg-primary border border-border-primary rounded text-sm text-text-primary"
                          title="Spawn Radius"
                        />
                        <button
                          onClick={() =>
                            deleteMobSpawn(
                              selectedCategory,
                              selectedArea.id,
                              index,
                            )
                          }
                          className="p-1 text-red-400 hover:bg-red-500 hover:bg-opacity-20 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-text-muted">Position:</span>
                        <input
                          type="number"
                          value={spawn.position.x}
                          onChange={(e) =>
                            updateMobSpawn(
                              selectedCategory,
                              selectedArea.id,
                              index,
                              {
                                position: {
                                  ...spawn.position,
                                  x: parseInt(e.target.value, 10),
                                },
                              },
                            )
                          }
                          className="w-16 px-1 py-0.5 bg-bg-primary border border-border-primary rounded text-text-primary"
                          placeholder="X"
                        />
                        <input
                          type="number"
                          value={spawn.position.z}
                          onChange={(e) =>
                            updateMobSpawn(
                              selectedCategory,
                              selectedArea.id,
                              index,
                              {
                                position: {
                                  ...spawn.position,
                                  z: parseInt(e.target.value, 10),
                                },
                              },
                            )
                          }
                          className="w-16 px-1 py-0.5 bg-bg-primary border border-border-primary rounded text-text-primary"
                          placeholder="Z"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Stations Section */}
              <Section
                title="Stations"
                icon={<Building className="w-4 h-4" />}
                expanded={expandedSections.has("stations")}
                onToggle={() => toggleSection("stations")}
                badge={(selectedArea.stations?.length || 0).toString()}
              >
                <div className="space-y-3">
                  <button
                    onClick={() =>
                      addStation(selectedCategory, selectedArea.id)
                    }
                    className="flex items-center gap-1 px-3 py-1 bg-primary bg-opacity-20 text-primary rounded text-sm hover:bg-opacity-30"
                  >
                    <Plus className="w-4 h-4" />
                    Add Station
                  </button>

                  {(selectedArea.stations || []).map((station, index) => (
                    <div
                      key={index}
                      className="p-3 bg-bg-tertiary rounded space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={station.id}
                          onChange={(e) =>
                            updateStation(
                              selectedCategory,
                              selectedArea.id,
                              index,
                              { id: e.target.value },
                            )
                          }
                          className="flex-1 px-2 py-1 bg-bg-primary border border-border-primary rounded text-sm text-text-primary"
                          placeholder="Station ID"
                        />
                        <select
                          value={station.type}
                          onChange={(e) =>
                            updateStation(
                              selectedCategory,
                              selectedArea.id,
                              index,
                              { type: e.target.value },
                            )
                          }
                          className="w-32 px-2 py-1 bg-bg-primary border border-border-primary rounded text-sm text-text-primary"
                        >
                          {STATION_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() =>
                            deleteStation(
                              selectedCategory,
                              selectedArea.id,
                              index,
                            )
                          }
                          className="p-1 text-red-400 hover:bg-red-500 hover:bg-opacity-20 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-text-muted">Position:</span>
                        <input
                          type="number"
                          value={station.position.x}
                          onChange={(e) =>
                            updateStation(
                              selectedCategory,
                              selectedArea.id,
                              index,
                              {
                                position: {
                                  ...station.position,
                                  x: parseInt(e.target.value, 10),
                                },
                              },
                            )
                          }
                          className="w-16 px-1 py-0.5 bg-bg-primary border border-border-primary rounded text-text-primary"
                          placeholder="X"
                        />
                        <input
                          type="number"
                          value={station.position.z}
                          onChange={(e) =>
                            updateStation(
                              selectedCategory,
                              selectedArea.id,
                              index,
                              {
                                position: {
                                  ...station.position,
                                  z: parseInt(e.target.value, 10),
                                },
                              },
                            )
                          }
                          className="w-16 px-1 py-0.5 bg-bg-primary border border-border-primary rounded text-text-primary"
                          placeholder="Z"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Fishing Section */}
              <Section
                title="Fishing"
                icon={<Fish className="w-4 h-4" />}
                expanded={expandedSections.has("fishing")}
                onToggle={() => toggleSection("fishing")}
              >
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedArea.fishing.enabled}
                      onChange={(e) =>
                        updateArea(selectedCategory, selectedArea.id, {
                          fishing: {
                            ...selectedArea.fishing,
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm text-text-primary">
                      Enable Fishing
                    </span>
                  </label>

                  {selectedArea.fishing.enabled && (
                    <>
                      <FormField label="Spot Count">
                        <input
                          type="number"
                          value={selectedArea.fishing.spotCount}
                          onChange={(e) =>
                            updateArea(selectedCategory, selectedArea.id, {
                              fishing: {
                                ...selectedArea.fishing,
                                spotCount: parseInt(e.target.value, 10),
                              },
                            })
                          }
                          className="w-24 px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                        />
                      </FormField>

                      <FormField label="Spot Types">
                        <div className="flex flex-wrap gap-2">
                          {FISHING_SPOT_TYPES.map((st) => (
                            <label
                              key={st}
                              className="flex items-center gap-1 px-2 py-1 bg-bg-tertiary rounded cursor-pointer text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={selectedArea.fishing.spotTypes.includes(
                                  st,
                                )}
                                onChange={(e) => {
                                  const newTypes = e.target.checked
                                    ? [...selectedArea.fishing.spotTypes, st]
                                    : selectedArea.fishing.spotTypes.filter(
                                        (t) => t !== st,
                                      );
                                  updateArea(
                                    selectedCategory,
                                    selectedArea.id,
                                    {
                                      fishing: {
                                        ...selectedArea.fishing,
                                        spotTypes: newTypes,
                                      },
                                    },
                                  );
                                }}
                                className="rounded"
                              />
                              <span className="text-text-primary">
                                {st.replace("fishing_spot_", "")}
                              </span>
                            </label>
                          ))}
                        </div>
                      </FormField>
                    </>
                  )}
                </div>
              </Section>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-muted">
            Select an area to edit
          </div>
        )}
      </div>
    </div>
  );
};

// Section component
interface SectionProps {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({
  title,
  icon,
  expanded,
  onToggle,
  badge,
  children,
}) => (
  <div className="border border-border-primary rounded-lg overflow-hidden">
    <button
      className="w-full px-4 py-3 bg-bg-secondary flex items-center gap-2 hover:bg-bg-tertiary transition-colors"
      onClick={onToggle}
    >
      {expanded ? (
        <ChevronDown className="w-4 h-4 text-text-muted" />
      ) : (
        <ChevronRight className="w-4 h-4 text-text-muted" />
      )}
      <span className="text-text-secondary">{icon}</span>
      <span className="font-medium text-text-primary">{title}</span>
      {badge && (
        <span className="ml-auto px-2 py-0.5 bg-primary bg-opacity-20 text-primary text-xs rounded-full">
          {badge}
        </span>
      )}
    </button>
    {expanded && <div className="p-4 bg-bg-primary">{children}</div>}
  </div>
);

// Form field component
interface FormFieldProps {
  label: string;
  children: React.ReactNode;
}

const FormField: React.FC<FormFieldProps> = ({ label, children }) => (
  <div className="space-y-1">
    <label className="text-xs text-text-secondary font-medium">{label}</label>
    {children}
  </div>
);

export default WorldAreasEditor;
