/**
 * GenerateTownDialog — Modal dialog for generating a town at a specific world position.
 *
 * Accessible from the viewport context menu ("Generate Town Here"). Allows the user
 * to configure town name, size, layout, building count, and spacing before procedurally
 * generating a set of buildings and adding them to the world foundation.
 *
 * Item C-14 from the World Builder plan.
 */

import { Building2, Dice5, Loader2, X } from "lucide-react";
import React, { useState, useCallback, useMemo } from "react";

import { useWorldStudio } from "../WorldStudioContext";
import {
  SliderInput,
  SelectInput,
  Toggle,
} from "./properties/PropertyControls";
import { PropertySection } from "./properties/PropertyControls";

import type {
  GeneratedTown,
  GeneratedBuilding,
  WorldData,
} from "../../WorldBuilder/types";

// ============== PROPS ==============

interface GenerateTownDialogProps {
  position: { x: number; y: number; z: number };
  onClose: () => void;
  onGenerated?: () => void;
}

// ============== FANTASY NAME GENERATOR ==============

const PREFIXES = [
  "Lum",
  "Ash",
  "Thorn",
  "Raven",
  "Iron",
  "Silver",
  "Dark",
  "Storm",
  "Moon",
  "Star",
  "Oak",
  "Elm",
  "Pine",
  "Wolf",
  "Bear",
  "Hawk",
  "Stone",
  "Frost",
  "Dawn",
  "Dusk",
];

const SUFFIXES = [
  "bridge",
  "ford",
  "shire",
  "haven",
  "vale",
  "dale",
  "keep",
  "hold",
  "mere",
  "wick",
  "ton",
  "bury",
  "wood",
  "field",
  "marsh",
  "crest",
  "fall",
  "gate",
  "port",
  "watch",
];

function generateFantasyName(): string {
  const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
  return `${prefix}${suffix}`;
}

// ============== SIZE DEFAULTS ==============

type TownSize = "hamlet" | "village" | "town";
type LayoutType = "terminus" | "throughway" | "fork" | "crossroads";

const SIZE_BUILDING_DEFAULTS: Record<
  TownSize,
  { min: number; max: number; default: number }
> = {
  hamlet: { min: 3, max: 5, default: 4 },
  village: { min: 6, max: 12, default: 8 },
  town: { min: 13, max: 25, default: 18 },
};

const SIZE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "hamlet", label: "Hamlet (3-5 buildings)" },
  { value: "village", label: "Village (6-12 buildings)" },
  { value: "town", label: "Town (13-25 buildings)" },
];

const LAYOUT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "terminus", label: "Terminus (dead end)" },
  { value: "throughway", label: "Throughway (2 exits)" },
  { value: "fork", label: "Fork (3 exits)" },
  { value: "crossroads", label: "Crossroads (4 exits)" },
];

// ============== BUILDING TYPES ==============

const BUILDING_TYPES = [
  "house",
  "shop",
  "tavern",
  "blacksmith",
  "chapel",
  "warehouse",
  "market_stall",
  "guild_hall",
  "barracks",
  "library",
  "apothecary",
  "bakery",
  "stable",
  "well",
  "watchtower",
];

// ============== LAYOUT GENERATORS ==============

/** Generate building positions based on layout type */
function generateBuildingPositions(
  center: { x: number; z: number },
  count: number,
  layoutType: LayoutType,
  minSpacing: number,
  maxRadius: number,
): Array<{ x: number; z: number; rotation: number }> {
  const positions: Array<{ x: number; z: number; rotation: number }> = [];

  switch (layoutType) {
    case "terminus": {
      // Buildings along a single road leading to a dead end
      for (let i = 0; i < count; i++) {
        const t = i / Math.max(count - 1, 1);
        const roadLen = Math.min(maxRadius * 0.8, count * minSpacing * 0.6);
        const alongRoad = -roadLen / 2 + t * roadLen;
        const side = i % 2 === 0 ? 1 : -1;
        const offset = minSpacing * 0.5 + Math.random() * minSpacing * 0.3;
        positions.push({
          x: center.x + side * offset,
          z: center.z + alongRoad,
          rotation: side > 0 ? Math.PI / 2 : -Math.PI / 2,
        });
      }
      break;
    }
    case "throughway": {
      // Buildings along a main road passing through
      for (let i = 0; i < count; i++) {
        const t = i / Math.max(count - 1, 1);
        const roadLen = Math.min(maxRadius * 1.2, count * minSpacing * 0.6);
        const alongRoad = -roadLen / 2 + t * roadLen;
        const side = i % 2 === 0 ? 1 : -1;
        const offset = minSpacing * 0.5 + Math.random() * minSpacing * 0.3;
        positions.push({
          x: center.x + side * offset,
          z: center.z + alongRoad,
          rotation: side > 0 ? Math.PI / 2 : -Math.PI / 2,
        });
      }
      break;
    }
    case "fork": {
      // Buildings arranged around a Y-intersection
      const armLength = Math.min(maxRadius * 0.6, count * minSpacing * 0.4);
      const arms = [
        { dx: 0, dz: -1 }, // south
        { dx: -0.866, dz: 0.5 }, // NW
        { dx: 0.866, dz: 0.5 }, // NE
      ];
      for (let i = 0; i < count; i++) {
        const arm = arms[i % 3];
        const armIndex = Math.floor(i / 3);
        const dist = (armIndex + 1) * minSpacing * 0.7;
        const perpX = -arm.dz;
        const perpZ = arm.dx;
        const side = i % 2 === 0 ? 1 : -1;
        const sideOffset = minSpacing * 0.4;
        positions.push({
          x:
            center.x +
            arm.dx * Math.min(dist, armLength) +
            perpX * side * sideOffset,
          z:
            center.z +
            arm.dz * Math.min(dist, armLength) +
            perpZ * side * sideOffset,
          rotation:
            Math.atan2(arm.dx, arm.dz) +
            (side > 0 ? Math.PI / 2 : -Math.PI / 2),
        });
      }
      break;
    }
    case "crossroads": {
      // Buildings arranged around a + intersection
      const roadHalf = Math.min(maxRadius * 0.5, count * minSpacing * 0.35);
      const quads = [
        { dx: 1, dz: 1 },
        { dx: -1, dz: 1 },
        { dx: -1, dz: -1 },
        { dx: 1, dz: -1 },
      ];
      for (let i = 0; i < count; i++) {
        const quad = quads[i % 4];
        const ring = Math.floor(i / 4);
        const offset = minSpacing * 0.5 + ring * minSpacing * 0.6;
        const jitter = (Math.random() - 0.5) * minSpacing * 0.3;
        positions.push({
          x: center.x + quad.dx * Math.min(offset, roadHalf) + jitter,
          z: center.z + quad.dz * Math.min(offset, roadHalf) + jitter,
          rotation: Math.atan2(-quad.dx, -quad.dz),
        });
      }
      break;
    }
  }

  return positions;
}

/** Generate entry points based on layout type */
function generateEntryPoints(
  center: { x: number; z: number },
  layoutType: LayoutType,
  maxRadius: number,
): Array<{
  direction: string;
  position: { x: number; y: number; z: number };
  connectedRoadId: string | null;
}> {
  const r = maxRadius * 0.8;

  switch (layoutType) {
    case "terminus":
      return [
        {
          direction: "south",
          position: { x: center.x, y: 0, z: center.z - r },
          connectedRoadId: null,
        },
      ];
    case "throughway":
      return [
        {
          direction: "north",
          position: { x: center.x, y: 0, z: center.z + r },
          connectedRoadId: null,
        },
        {
          direction: "south",
          position: { x: center.x, y: 0, z: center.z - r },
          connectedRoadId: null,
        },
      ];
    case "fork":
      return [
        {
          direction: "south",
          position: { x: center.x, y: 0, z: center.z - r },
          connectedRoadId: null,
        },
        {
          direction: "northwest",
          position: { x: center.x - r * 0.866, y: 0, z: center.z + r * 0.5 },
          connectedRoadId: null,
        },
        {
          direction: "northeast",
          position: { x: center.x + r * 0.866, y: 0, z: center.z + r * 0.5 },
          connectedRoadId: null,
        },
      ];
    case "crossroads":
      return [
        {
          direction: "north",
          position: { x: center.x, y: 0, z: center.z + r },
          connectedRoadId: null,
        },
        {
          direction: "south",
          position: { x: center.x, y: 0, z: center.z - r },
          connectedRoadId: null,
        },
        {
          direction: "east",
          position: { x: center.x + r, y: 0, z: center.z },
          connectedRoadId: null,
        },
        {
          direction: "west",
          position: { x: center.x - r, y: 0, z: center.z },
          connectedRoadId: null,
        },
      ];
  }
}

// ============== COMPONENT ==============

export function GenerateTownDialog({
  position,
  onClose,
  onGenerated,
}: GenerateTownDialogProps) {
  const { state, actions } = useWorldStudio();
  const world = state.builder.editing.world;

  // ----- Form state -----
  const [townName, setTownName] = useState(generateFantasyName);
  const [townSize, setTownSize] = useState<TownSize>("village");
  const [layoutType, setLayoutType] = useState<LayoutType>("throughway");
  const [buildingCount, setBuildingCount] = useState(
    SIZE_BUILDING_DEFAULTS.village.default,
  );
  const [connectRoads, setConnectRoads] = useState(true);
  const [minSpacing, setMinSpacing] = useState(20);
  const [maxRadius, setMaxRadius] = useState(150);

  // ----- Generation state -----
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ----- Biome detection -----
  const biomeAtPosition = useMemo(() => {
    if (!world) return null;
    // Find the closest biome center to the given position
    let closest: { id: string; type: string; distance: number } | null = null;
    for (const biome of world.foundation.biomes) {
      const dx = biome.center.x - position.x;
      const dz = biome.center.z - position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (!closest || dist < closest.distance) {
        closest = { id: biome.id, type: biome.type, distance: dist };
      }
    }
    return closest;
  }, [world, position]);

  // ----- Sync building count with size changes -----
  const handleSizeChange = useCallback((value: string) => {
    const size = value as TownSize;
    setTownSize(size);
    setBuildingCount(SIZE_BUILDING_DEFAULTS[size].default);
  }, []);

  // ----- Preview summary -----
  const previewSummary = useMemo(() => {
    const entryPointCount =
      layoutType === "terminus"
        ? 1
        : layoutType === "throughway"
          ? 2
          : layoutType === "fork"
            ? 3
            : 4;
    return {
      buildings: buildingCount,
      roads: connectRoads ? entryPointCount : 0,
      entryPoints: entryPointCount,
    };
  }, [buildingCount, layoutType, connectRoads]);

  // ----- Randomize name -----
  const handleRandomizeName = useCallback(() => {
    setTownName(generateFantasyName());
  }, []);

  // ----- Generate town -----
  const handleGenerate = useCallback(() => {
    if (!world || !townName.trim()) return;

    setIsGenerating(true);
    setError(null);

    // Defer to next tick to allow UI update
    setTimeout(() => {
      try {
        const townId = `town_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        // Generate building positions
        const buildingPositions = generateBuildingPositions(
          { x: position.x, z: position.z },
          buildingCount,
          layoutType,
          minSpacing,
          maxRadius,
        );

        // Create building entries
        const buildings: GeneratedBuilding[] = buildingPositions.map(
          (pos, i) => ({
            id: `${townId}_bldg_${i}`,
            type: BUILDING_TYPES[i % BUILDING_TYPES.length],
            name: `${BUILDING_TYPES[i % BUILDING_TYPES.length].replace(/_/g, " ")} ${i + 1}`,
            position: { x: pos.x, y: position.y, z: pos.z },
            rotation: pos.rotation,
            townId,
            dimensions: {
              width: 6 + Math.floor(Math.random() * 5),
              depth: 6 + Math.floor(Math.random() * 5),
              floors: 1 + Math.floor(Math.random() * 2),
            },
          }),
        );

        // Create entry points
        const entryPoints = generateEntryPoints(
          { x: position.x, z: position.z },
          layoutType,
          maxRadius,
        );

        // Create town entry
        const town: GeneratedTown = {
          id: townId,
          name: townName.trim(),
          size: townSize,
          position: { x: position.x, y: position.y, z: position.z },
          layoutType,
          buildingIds: buildings.map((b) => b.id),
          entryPoints,
          biomeId: biomeAtPosition?.id ?? "unknown",
        };

        // Clone the world data and add the new town + buildings to the foundation
        const updatedWorld: WorldData = {
          ...world,
          modifiedAt: Date.now(),
          foundation: {
            ...world.foundation,
            towns: [...world.foundation.towns, town],
            buildings: [...world.foundation.buildings, ...buildings],
          },
        };

        // Reload the world with the updated data
        actions.loadWorld(updatedWorld);

        setIsGenerating(false);
        onGenerated?.();
        onClose();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to generate town",
        );
        setIsGenerating(false);
      }
    }, 50);
  }, [
    world,
    townName,
    townSize,
    layoutType,
    buildingCount,
    minSpacing,
    maxRadius,
    position,
    biomeAtPosition,
    actions,
    onClose,
    onGenerated,
  ]);

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-bg-secondary border border-border-primary rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-text-primary">
              Generate Town
            </h2>
          </div>
          <button
            className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors ease-out"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Location info */}
          <div className="flex items-center gap-3 p-2 bg-bg-tertiary/50 rounded text-xs text-text-secondary">
            <div>
              <span className="text-text-tertiary">Position:</span>{" "}
              <span className="font-mono">
                {Math.round(position.x)}, {Math.round(position.z)}
              </span>
            </div>
            {biomeAtPosition && (
              <div>
                <span className="text-text-tertiary">Biome:</span>{" "}
                <span className="capitalize">
                  {biomeAtPosition.type.replace(/_/g, " ")}
                </span>
              </div>
            )}
          </div>

          {/* Town Name */}
          <div className="space-y-0.5">
            <label className="text-xs text-text-secondary">Town Name</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={townName}
                onChange={(e) => setTownName(e.target.value)}
                placeholder="Enter a name..."
                className="flex-1 px-2 py-1 text-xs bg-bg-tertiary border border-border-primary rounded text-text-primary focus:outline-none focus:border-primary/50"
                autoFocus
              />
              <button
                className="px-2 py-1 text-xs bg-bg-tertiary border border-border-primary rounded text-text-secondary hover:text-text-primary hover:border-border-secondary transition-colors ease-out"
                onClick={handleRandomizeName}
                title="Generate random name"
              >
                <Dice5 size={14} />
              </button>
            </div>
          </div>

          {/* Town Size */}
          <SelectInput
            label="Town Size"
            value={townSize}
            onChange={handleSizeChange}
            options={SIZE_OPTIONS}
          />

          {/* Layout Type */}
          <SelectInput
            label="Layout Type"
            value={layoutType}
            onChange={(v) => setLayoutType(v as LayoutType)}
            options={LAYOUT_OPTIONS}
          />

          {/* Building Count */}
          <SliderInput
            label="Building Count"
            value={buildingCount}
            onChange={setBuildingCount}
            min={3}
            max={30}
            hint="Number of buildings to generate"
          />

          {/* Road Connections */}
          <Toggle
            label="Connect to nearest roads"
            value={connectRoads}
            onChange={setConnectRoads}
          />

          {/* Advanced Section */}
          <PropertySection
            title="Advanced"
            defaultOpen={false}
            persistKey="gen-town-advanced"
          >
            <SliderInput
              label="Min Building Spacing"
              value={minSpacing}
              onChange={setMinSpacing}
              min={10}
              max={50}
              unit="m"
              hint="Minimum distance between building centers"
            />
            <SliderInput
              label="Max Town Radius"
              value={maxRadius}
              onChange={setMaxRadius}
              min={50}
              max={500}
              unit="m"
              hint="Maximum extent of the town from center"
            />
          </PropertySection>

          {/* Preview */}
          <div className="p-2 bg-bg-tertiary/50 rounded border border-border-primary/50">
            <div className="text-[10px] uppercase tracking-[0.12em] text-text-tertiary font-semibold mb-1">
              Preview
            </div>
            <div className="flex gap-4 text-xs text-text-secondary">
              <span>
                <span className="text-text-primary font-medium">
                  {previewSummary.buildings}
                </span>{" "}
                buildings
              </span>
              <span>
                <span className="text-text-primary font-medium">
                  {previewSummary.entryPoints}
                </span>{" "}
                entry points
              </span>
              {connectRoads && (
                <span>
                  <span className="text-text-primary font-medium">
                    {previewSummary.roads}
                  </span>{" "}
                  road connections
                </span>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border-primary">
          <button
            className="flex-1 px-5 py-1.5 text-xs font-medium rounded bg-bg-tertiary border border-border-primary text-text-primary hover:bg-bg-secondary transition-colors ease-out"
            onClick={onClose}
            disabled={isGenerating}
          >
            Cancel
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ease-out"
            onClick={handleGenerate}
            disabled={!townName.trim() || isGenerating || !world}
          >
            {isGenerating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Building2 size={14} />
                Generate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
