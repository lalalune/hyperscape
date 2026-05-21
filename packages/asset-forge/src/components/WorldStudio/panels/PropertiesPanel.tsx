/**
 * PropertiesPanel — Right sidebar showing properties for selected objects
 *
 * Dispatches to per-type property editors based on selection type:
 * - terrain/chunk → TerrainProperties
 * - biome → BiomeProperties
 * - town → TownProperties
 */

import { Info, Settings, Search } from "lucide-react";
import React, { useState, useMemo, createContext, useContext } from "react";

import { useWorldStudio, useEntityTypeRegistry } from "../WorldStudioContext";
import { SchemaPropertyEditor } from "../../../gameModules/components/SchemaPropertyEditor";
import { registerBuiltinCustomSections } from "../../../gameModules/components/registerBuiltinCustomSections";

// Ensure built-in custom-section widgets are registered before first render.
registerBuiltinCustomSections();
import { ErrorBoundary } from "../../common/ErrorBoundary";
import { InfoRow, PropertySection } from "./properties/PropertyControls";
import { TransformSection } from "./properties/TransformSection";
import { TerrainProperties } from "./properties/TerrainProperties";
import { BiomeProperties } from "./properties/BiomeProperties";
import { TownProperties } from "./properties/TownProperties";
import { QuestProperties } from "./properties/QuestProperties";
import { RoadProperties } from "./properties/RoadProperties";
import { GameNPCProperties } from "./properties/GameNPCProperties";
import { GameStationProperties } from "./properties/GameStationProperties";
import { GameResourceProperties } from "./properties/GameResourceProperties";
import { GameMobSpawnProperties } from "./properties/GameMobSpawnProperties";

/** Context for property search filtering */
const PropertySearchContext = createContext<string>("");

/** Wrapper that hides children when search doesn't match the label */
function SearchableSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const search = useContext(PropertySearchContext);
  if (search && !label.toLowerCase().includes(search.toLowerCase())) {
    return null;
  }
  return <>{children}</>;
}

export function PropertiesPanel() {
  const [searchText, setSearchText] = useState("");
  const { state } = useWorldStudio();
  const registry = useEntityTypeRegistry();
  const selection = state.builder.editing.selection;
  const world = state.builder.editing.world;
  const extendedLayers = state.extendedLayers;
  const audioLayers = state.audioLayers;

  // Resolve the selected entity for per-type editors
  const renderSelectionEditor = () => {
    if (!selection) return null;

    switch (selection.type) {
      case "terrain":
      case "chunk":
        if (world) return <TerrainProperties world={world} />;
        break;

      case "tile": {
        // Tile inspector — show detailed tile data from viewport click
        const td = selection.tileData;
        if (td) {
          return (
            <PropertySection title="Tile Inspector">
              <InfoRow label="Tile" value={`(${td.tileX}, ${td.tileZ})`} />
              <InfoRow label="Chunk" value={`(${td.chunkX}, ${td.chunkZ})`} />
              <InfoRow
                label="World"
                value={`(${td.worldX.toFixed(1)}, ${td.worldZ.toFixed(1)})`}
              />
              <InfoRow label="Height" value={`${td.height.toFixed(1)}m`} />
              <InfoRow label="Biome" value={td.biome} />
              <InfoRow
                label="Slope"
                value={`${(td.slope * 100).toFixed(0)}%`}
              />
              <InfoRow label="Walkable" value={td.walkable ? "Yes" : "No"} />
              <InfoRow
                label="In Town"
                value={td.inTown ? (td.townId ?? "Yes") : "No"}
              />
              <InfoRow
                label="Wilderness"
                value={td.inWilderness ? "Yes" : "No"}
              />
              <InfoRow label="Difficulty" value={`${td.difficultyLevel}`} />
            </PropertySection>
          );
        }
        if (world) return <TerrainProperties world={world} />;
        break;
      }

      case "biome":
        if (world)
          return <BiomeProperties biomeId={selection.id} world={world} />;
        break;

      case "town":
        if (world)
          return <TownProperties townId={selection.id} world={world} />;
        break;

      case "building":
        if (world) {
          const building = world.foundation.buildings.find(
            (b) => b.id === selection.id,
          );
          if (building) {
            // Find any existing modification for this building
            const townOverride = world.layers.townOverrides.get(
              building.townId,
            );
            const mod = townOverride?.buildingModifications?.find(
              (m) => m.buildingId === building.id,
            );
            const effectiveX =
              building.position.x + (mod?.positionOffset?.x ?? 0);
            const effectiveZ =
              building.position.z + (mod?.positionOffset?.z ?? 0);
            return (
              <>
                <PropertySection title="Building">
                  <InfoRow
                    label="Name"
                    value={mod?.nameOverride || building.name}
                  />
                  <InfoRow
                    label="Type"
                    value={mod?.typeOverride || building.type}
                  />
                  <InfoRow label="Town" value={building.townId} />
                  {mod?.disabled && <InfoRow label="Status" value="Disabled" />}
                </PropertySection>
                <PropertySection title="Transform">
                  <TransformSection
                    position={{ x: effectiveX, y: 0, z: effectiveZ }}
                    readOnly
                  />
                  <InfoRow
                    label="Rotation"
                    value={`${Math.round(((mod?.rotationOverride ?? building.rotation) * 180) / Math.PI)}°`}
                  />
                </PropertySection>
                <PropertySection title="Dimensions">
                  <InfoRow
                    label="Size"
                    value={`${building.dimensions.width}×${building.dimensions.depth}`}
                  />
                  <InfoRow label="Floors" value={building.dimensions.floors} />
                </PropertySection>
                <div className="px-2 py-1">
                  <div className="text-[10px] text-text-tertiary italic">
                    Edit properties via Town → Buildings section.
                  </div>
                </div>
              </>
            );
          }
        }
        break;

      case "quest": {
        if (world) {
          const quest = world.layers.quests.find((q) => q.id === selection.id);
          if (quest) return <QuestProperties quest={quest} />;
        }
        break;
      }

      case "boss": {
        if (world) {
          const boss = world.layers.bosses.find((b) => b.id === selection.id);
          if (boss) {
            return (
              <PropertySection title="Boss">
                <InfoRow label="Name" value={boss.name} />
                <InfoRow label="ID" value={boss.id} />
              </PropertySection>
            );
          }
        }
        break;
      }

      case "road":
      case "customRoad": {
        if (world)
          return <RoadProperties roadId={selection.id} world={world} />;
        break;
      }

      // Vegetation instance (InstancedMesh per-instance selection)
      case "vegetation": {
        const d = selection.entityData;
        if (d) {
          const pos = d.position as
            | { x: number; y: number; z: number }
            | undefined;
          const speciesLabel = String(d.species ?? "unknown")
            .replace(/^tree_/, "")
            .replace(/_/g, " ");
          return (
            <>
              <PropertySection title="Vegetation Instance">
                <InfoRow label="Species" value={speciesLabel} />
                <InfoRow label="Instance" value={`#${d.instanceIndex}`} />
              </PropertySection>
              {pos && (
                <PropertySection title="Transform">
                  <TransformSection position={pos} readOnly />
                </PropertySection>
              )}
            </>
          );
        }
        break;
      }

      // Game world manifest entities (from GameWorldEntitySync)
      case "gameNpc":
        return selection.entityData ? (
          <GameNPCProperties entityData={selection.entityData} />
        ) : null;

      case "gameStation":
        return selection.entityData ? (
          <GameStationProperties entityData={selection.entityData} />
        ) : null;

      case "gameResource":
        return selection.entityData ? (
          <GameResourceProperties entityData={selection.entityData} />
        ) : null;

      case "gameMobSpawn":
        return selection.entityData ? (
          <GameMobSpawnProperties entityData={selection.entityData} />
        ) : null;

      default: {
        // Schema-driven fallback: look up the selection type in the game module registry
        const schema = registry.getBySelectionType(selection.type);
        if (schema) {
          const root =
            schema.storage.stateRoot === "audioLayers"
              ? state.audioLayers
              : state.extendedLayers;
          const entities = root[schema.storage.stateKey as keyof typeof root];
          if (schema.storage.type === "scalar") {
            // Scalar storage (e.g. wildernessBoundary) — the stateKey value
            // IS the entity. The custom section widget is responsible for
            // reading state itself; we pass an empty entityData so field
            // `visibleWhen` checks have a stable object to read from.
            const scalarData =
              entities &&
              typeof entities === "object" &&
              !Array.isArray(entities)
                ? (entities as Record<string, unknown>)
                : {};
            return (
              <SchemaPropertyEditor
                schema={schema}
                entityId={selection.id}
                entityData={scalarData}
              />
            );
          }
          if (Array.isArray(entities)) {
            const entity = (entities as Array<{ id: string }>).find(
              (e) => e.id === selection.id,
            );
            if (entity) {
              return (
                <SchemaPropertyEditor
                  schema={schema}
                  entityId={selection.id}
                  entityData={entity as Record<string, unknown>}
                />
              );
            }
          }
        }
        break;
      }
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-[0.12em]">
          Properties
        </span>
        <button
          className="p-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors ease-out"
          title="Settings"
        >
          <Settings size={12} />
        </button>
      </div>

      {/* Search filter */}
      {selection && (
        <div className="px-2 py-1.5 border-b border-border-primary">
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
            <input
              type="text"
              placeholder="Filter properties..."
              className="w-full pl-6 pr-2 py-1 text-xs bg-bg-tertiary rounded-sm border border-border-primary text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary/50"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <PropertySearchContext.Provider value={searchText}>
          {selection ? (
            <>
              {/* Selection header */}
              <SearchableSection label="Selection Type ID Path">
                <PropertySection title="Selection">
                  <InfoRow label="Type" value={selection.type} />
                  <InfoRow label="ID" value={selection.id} />
                  {selection.path.length > 0 && (
                    <InfoRow
                      label="Path"
                      value={selection.path.map((p) => p.name).join(" > ")}
                    />
                  )}
                </PropertySection>
              </SearchableSection>

              {/* Per-type editor */}
              <ErrorBoundary
                resetKey={selection.id}
                fallback={
                  <PropertySection title="Error">
                    <p style={{ padding: 8, color: "#e88" }}>
                      Failed to render properties. Select a different entity to
                      recover.
                    </p>
                  </PropertySection>
                }
              >
                {renderSelectionEditor()}
              </ErrorBoundary>

              {/* World summary when available */}
              {world && (
                <PropertySection title="World" defaultOpen={false}>
                  <InfoRow label="Name" value={world.name} />
                  <InfoRow label="Seed" value={world.foundation.config.seed} />
                  <InfoRow
                    label="Size"
                    value={`${world.foundation.config.terrain.worldSize}×${world.foundation.config.terrain.worldSize}`}
                  />
                  <InfoRow
                    label="Towns"
                    value={world.foundation.towns.length}
                  />
                  <InfoRow
                    label="Roads"
                    value={world.foundation.roads.length}
                  />
                  <InfoRow label="NPCs" value={world.layers.npcs.length} />
                  <InfoRow
                    label="Spawn Points"
                    value={extendedLayers.spawnPoints.length}
                  />
                  <InfoRow
                    label="Resources"
                    value={extendedLayers.resources.length}
                  />
                  <InfoRow
                    label="Stations"
                    value={extendedLayers.stations.length}
                  />
                  <InfoRow label="POIs" value={extendedLayers.pois.length} />
                  <InfoRow
                    label="Water Bodies"
                    value={extendedLayers.waterBodies.length}
                  />
                </PropertySection>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-text-tertiary text-xs px-4 text-center">
              <Info size={20} className="mb-2 opacity-40" />
              <p>
                Select an object in the viewport or hierarchy to view its
                properties.
              </p>
            </div>
          )}
        </PropertySearchContext.Provider>
      </div>
    </div>
  );
}
