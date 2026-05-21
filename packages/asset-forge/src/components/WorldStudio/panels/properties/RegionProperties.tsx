/**
 * RegionProperties — Editor for selected region/zone entity.
 *
 * Shows name, description, tags, biome override, polygon info,
 * audio settings, and full spawn rule configuration with
 * mob/resource/station table editors.
 */

import {
  Hexagon,
  Plus,
  X,
  Trash2,
  Skull,
  Gem,
  Flame,
  Wand2,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";
import React, { useCallback, useState, useMemo } from "react";

import type { PlacedRegion, RegionSpawnRules } from "../../types";
import { ZONE_TILE_SIZE } from "../../types";
import { useWorldStudio } from "../../WorldStudioContext";
import {
  useZoneProcgen,
  type ProcgenStats,
  type ProgressionWarning,
} from "../../hooks/useZoneProcgen";
import {
  PropertySection,
  TextInput,
  SelectInput,
  SliderInput,
  NumberInput,
  InfoRow,
  Toggle,
} from "./PropertyControls";
import { BehaviorScriptSection } from "./BehaviorScriptSection";

interface Props {
  region: PlacedRegion;
}

export function RegionProperties({ region }: Props) {
  const { actions, state } = useWorldStudio();
  const [newTag, setNewTag] = useState("");
  const [procgenSeed, setProcgenSeed] = useState(42);
  const [lastStats, setLastStats] = useState<ProcgenStats | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<
    ProgressionWarning[]
  >([]);
  const { generateAndCommit, clearRegion, preview, validate } =
    useZoneProcgen();
  const manifests = state.manifests;

  const update = useCallback(
    (updates: Partial<PlacedRegion>) => {
      actions.updateRegion(region.id, updates);
    },
    [actions, region.id],
  );

  /** Helper to update spawn rules immutably */
  const updateRules = useCallback(
    (patch: Partial<RegionSpawnRules>) => {
      update({ spawnRules: { ...region.spawnRules, ...patch } });
    },
    [update, region.spawnRules],
  );

  // Tile metrics
  const tileSize = ZONE_TILE_SIZE;
  const tileCount = region.tileKeys.length;
  const area = tileCount * tileSize * tileSize;

  // Biome options
  const uniqueBiomeOptions = useMemo(() => {
    const opts = [
      { value: "", label: "— Inherit from terrain —" },
      ...(state.builder.editing.world?.foundation.biomes.map((b) => ({
        value: b.type,
        label: b.type.charAt(0).toUpperCase() + b.type.slice(1),
      })) ?? []),
    ];
    const seen = new Set<string>();
    return opts.filter((o) => {
      if (o.value === "" || !seen.has(o.value)) {
        seen.add(o.value);
        return true;
      }
      return false;
    });
  }, [state.builder.editing.world?.foundation.biomes]);

  // Manifest-derived options for pickers
  const mobOptions = useMemo(
    () =>
      manifests.npcs
        .filter((n) => n.category === "mob" || n.category === "boss")
        .map((n) => ({
          value: n.id,
          label: `${n.name} (Lv ${n.levelRange[0]}-${n.levelRange[1]})`,
        })),
    [manifests.npcs],
  );

  const resourceOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [];
    for (const r of manifests.miningRocks) {
      opts.push({
        value: r.id,
        label: `${r.name} (Mining ${r.levelRequired})`,
      });
    }
    for (const t of manifests.trees) {
      opts.push({ value: t.id, label: `${t.name} (WC ${t.levelRequired})` });
    }
    for (const f of manifests.fishingSpots) {
      opts.push({ value: f.id, label: `${f.name} (Fish ${f.levelRequired})` });
    }
    return opts;
  }, [manifests.miningRocks, manifests.trees, manifests.fishingSpots]);

  const stationOptions = useMemo(
    () => manifests.stations.map((s) => ({ value: s.type, label: s.name })),
    [manifests.stations],
  );

  // Tags
  const addTag = () => {
    const tag = newTag.trim().toLowerCase();
    if (tag && !region.tags.includes(tag)) {
      update({ tags: [...region.tags, tag] });
    }
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    update({ tags: region.tags.filter((t) => t !== tag) });
  };

  const hasMobRules = !!region.spawnRules?.mobs;
  const hasResourceRules = !!region.spawnRules?.resources;
  const hasStationRules =
    !!region.spawnRules?.stations && region.spawnRules.stations.length > 0;

  // === Mob table helpers ===
  const addMobEntry = (mobId: string) => {
    if (!region.spawnRules?.mobs) return;
    const existing = region.spawnRules.mobs.table.find(
      (e) => e.mobId === mobId,
    );
    if (existing) return;
    updateRules({
      mobs: {
        ...region.spawnRules.mobs,
        table: [...region.spawnRules.mobs.table, { mobId, weight: 1.0 }],
      },
    });
  };

  const removeMobEntry = (mobId: string) => {
    if (!region.spawnRules?.mobs) return;
    updateRules({
      mobs: {
        ...region.spawnRules.mobs,
        table: region.spawnRules.mobs.table.filter((e) => e.mobId !== mobId),
      },
    });
  };

  const updateMobEntry = (mobId: string, patch: Record<string, unknown>) => {
    if (!region.spawnRules?.mobs) return;
    updateRules({
      mobs: {
        ...region.spawnRules.mobs,
        table: region.spawnRules.mobs.table.map((e) =>
          e.mobId === mobId ? { ...e, ...patch } : e,
        ),
      },
    });
  };

  // === Resource table helpers ===
  const addResourceEntry = (resourceId: string) => {
    if (!region.spawnRules?.resources) return;
    const existing = region.spawnRules.resources.table.find(
      (e) => e.resourceId === resourceId,
    );
    if (existing) return;
    updateRules({
      resources: {
        ...region.spawnRules.resources,
        table: [
          ...region.spawnRules.resources.table,
          { resourceId, weight: 1.0 },
        ],
      },
    });
  };

  const removeResourceEntry = (resourceId: string) => {
    if (!region.spawnRules?.resources) return;
    updateRules({
      resources: {
        ...region.spawnRules.resources,
        table: region.spawnRules.resources.table.filter(
          (e) => e.resourceId !== resourceId,
        ),
      },
    });
  };

  const updateResourceEntry = (
    resourceId: string,
    patch: Record<string, unknown>,
  ) => {
    if (!region.spawnRules?.resources) return;
    updateRules({
      resources: {
        ...region.spawnRules.resources,
        table: region.spawnRules.resources.table.map((e) =>
          e.resourceId === resourceId ? { ...e, ...patch } : e,
        ),
      },
    });
  };

  // === Station helpers ===
  const addStationEntry = (stationType: string) => {
    const stations = region.spawnRules?.stations ?? [];
    if (stations.find((s) => s.stationType === stationType)) return;
    updateRules({
      stations: [
        ...stations,
        { stationType, count: 1, placement: "random" as const },
      ],
    });
  };

  const removeStationEntry = (stationType: string) => {
    updateRules({
      stations: (region.spawnRules?.stations ?? []).filter(
        (s) => s.stationType !== stationType,
      ),
    });
  };

  const updateStationEntry = (
    stationType: string,
    patch: Record<string, unknown>,
  ) => {
    updateRules({
      stations: (region.spawnRules?.stations ?? []).map((s) =>
        s.stationType === stationType ? { ...s, ...patch } : s,
      ),
    });
  };

  return (
    <>
      {/* Identity */}
      <PropertySection title="Region" icon={<Hexagon size={10} />}>
        <TextInput
          label="Name"
          value={region.name}
          onChange={(name) => update({ name })}
        />
        <TextInput
          label="Description"
          value={region.description}
          onChange={(description) => update({ description })}
        />
        <SelectInput
          label="Biome Override"
          value={region.biomeOverride ?? ""}
          onChange={(biomeOverride) =>
            update({ biomeOverride: biomeOverride || undefined })
          }
          options={uniqueBiomeOptions}
        />
      </PropertySection>

      {/* Tags */}
      <PropertySection title="Tags" badge={region.tags.length}>
        <div className="flex flex-wrap gap-1 mb-1.5">
          {region.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-bg-tertiary text-text-secondary border border-border-primary"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="ml-0.5 text-text-tertiary hover:text-red-400 transition-colors ease-out"
              >
                <X size={8} />
              </button>
            </span>
          ))}
          {region.tags.length === 0 && (
            <span className="text-[10px] text-text-tertiary italic">
              No tags
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <input
            type="text"
            placeholder="Add tag..."
            className="flex-1 px-1.5 py-0.5 text-[10px] bg-bg-tertiary rounded border border-border-primary text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary/50"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addTag();
            }}
          />
          <button
            onClick={addTag}
            className="px-1.5 py-0.5 text-[10px] rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors ease-out"
          >
            <Plus size={10} />
          </button>
        </div>
      </PropertySection>

      {/* Tile info + Paint button */}
      <PropertySection title="Tiles" badge={tileCount} defaultOpen={true}>
        <InfoRow label="Tiles" value={tileCount} />
        <InfoRow
          label="Area"
          value={`~${Math.round(area).toLocaleString()}m²`}
        />
        <InfoRow label="Tile Size" value={`${tileSize}m`} />
        <div className="mt-1.5">
          <button
            className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium bg-primary/20 text-primary hover:bg-primary/30 transition-colors ease-out"
            onClick={() => {
              actions.startZonePaint(region.id);
              actions.setTool("zonePaint");
            }}
            title="Switch to Zone Painter tool for this region (Z)"
          >
            <Hexagon size={10} />
            Paint Tiles
          </button>
        </div>
      </PropertySection>

      {/* Audio */}
      <PropertySection title="Audio" defaultOpen={false}>
        <TextInput
          label="Music Track"
          value={region.musicTrack ?? ""}
          onChange={(musicTrack) =>
            update({ musicTrack: musicTrack || undefined })
          }
        />
        <TextInput
          label="Ambient Sound"
          value={region.ambientSound ?? ""}
          onChange={(ambientSound) =>
            update({ ambientSound: ambientSound || undefined })
          }
        />
      </PropertySection>

      {/* ========== MOB SPAWN RULES ========== */}
      <PropertySection
        title="Mob Spawns"
        icon={<Skull size={10} />}
        badge={region.spawnRules?.mobs?.table.length}
        defaultOpen={hasMobRules}
      >
        <Toggle
          label="Enable Mob Overrides"
          value={hasMobRules}
          onChange={(enabled) => {
            if (enabled) {
              updateRules({
                mobs: { mode: "extend", table: [], densityMultiplier: 1.0 },
              });
            } else {
              const rules = { ...region.spawnRules };
              delete rules.mobs;
              update({ spawnRules: rules });
            }
          }}
        />
        {hasMobRules && region.spawnRules?.mobs && (
          <>
            <SelectInput
              label="Mode"
              value={region.spawnRules.mobs.mode}
              onChange={(mode) =>
                updateRules({
                  mobs: {
                    ...region.spawnRules!.mobs!,
                    mode: mode as "replace" | "extend",
                  },
                })
              }
              options={[
                { value: "extend", label: "Extend biome mobs" },
                { value: "replace", label: "Replace biome mobs" },
              ]}
            />
            <SliderInput
              label="Density"
              value={region.spawnRules.mobs.densityMultiplier ?? 1.0}
              onChange={(v) =>
                updateRules({
                  mobs: { ...region.spawnRules!.mobs!, densityMultiplier: v },
                })
              }
              min={0}
              max={5}
              step={0.1}
              hint="1.0 = normal"
            />

            {/* Mob table entries */}
            {region.spawnRules.mobs.table.map((entry) => {
              const mob = manifests.npcs.find((n) => n.id === entry.mobId);
              return (
                <div
                  key={entry.mobId}
                  className="flex items-center gap-1 py-1 border-b border-border-primary/20 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-medium text-text-primary truncate">
                      {mob?.name ?? entry.mobId}
                    </div>
                    <div className="flex gap-2 mt-0.5">
                      <SliderInput
                        label="Weight"
                        value={entry.weight}
                        onChange={(weight) =>
                          updateMobEntry(entry.mobId, { weight })
                        }
                        min={0.1}
                        max={10}
                        step={0.1}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => removeMobEntry(entry.mobId)}
                    className="p-0.5 text-text-tertiary hover:text-red-400 transition-colors flex-shrink-0 ease-out"
                    title="Remove"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              );
            })}

            {/* Add mob picker */}
            <MobAdder options={mobOptions} onAdd={addMobEntry} />
          </>
        )}
      </PropertySection>

      {/* ========== RESOURCE SPAWN RULES ========== */}
      <PropertySection
        title="Resource Spawns"
        icon={<Gem size={10} />}
        badge={region.spawnRules?.resources?.table.length}
        defaultOpen={hasResourceRules}
      >
        <Toggle
          label="Enable Resource Overrides"
          value={hasResourceRules}
          onChange={(enabled) => {
            if (enabled) {
              updateRules({
                resources: {
                  mode: "extend",
                  table: [],
                  densityMultiplier: 1.0,
                },
              });
            } else {
              const rules = { ...region.spawnRules };
              delete rules.resources;
              update({ spawnRules: rules });
            }
          }}
        />
        {hasResourceRules && region.spawnRules?.resources && (
          <>
            <SelectInput
              label="Mode"
              value={region.spawnRules.resources.mode}
              onChange={(mode) =>
                updateRules({
                  resources: {
                    ...region.spawnRules!.resources!,
                    mode: mode as "replace" | "extend",
                  },
                })
              }
              options={[
                { value: "extend", label: "Extend biome resources" },
                { value: "replace", label: "Replace biome resources" },
              ]}
            />
            <SliderInput
              label="Density"
              value={region.spawnRules.resources.densityMultiplier ?? 1.0}
              onChange={(v) =>
                updateRules({
                  resources: {
                    ...region.spawnRules!.resources!,
                    densityMultiplier: v,
                  },
                })
              }
              min={0}
              max={5}
              step={0.1}
              hint="1.0 = normal"
            />

            {/* Resource table entries */}
            {region.spawnRules.resources.table.map((entry) => {
              const res =
                manifests.miningRocks.find((r) => r.id === entry.resourceId) ??
                manifests.trees.find((t) => t.id === entry.resourceId) ??
                manifests.fishingSpots.find((f) => f.id === entry.resourceId);
              return (
                <div
                  key={entry.resourceId}
                  className="flex items-center gap-1 py-1 border-b border-border-primary/20 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-medium text-text-primary truncate">
                      {res?.name ?? entry.resourceId}
                    </div>
                    <div className="grid grid-cols-2 gap-1 mt-0.5">
                      <SliderInput
                        label="Weight"
                        value={entry.weight}
                        onChange={(weight) =>
                          updateResourceEntry(entry.resourceId, { weight })
                        }
                        min={0.1}
                        max={10}
                        step={0.1}
                      />
                      <SelectInput
                        label="Affinity"
                        value={entry.affinity ?? "any"}
                        onChange={(affinity) =>
                          updateResourceEntry(entry.resourceId, {
                            affinity: affinity === "any" ? undefined : affinity,
                          })
                        }
                        options={[
                          { value: "any", label: "Any" },
                          { value: "water", label: "Near water" },
                          { value: "mountain", label: "Mountain" },
                          { value: "road", label: "Near road" },
                        ]}
                      />
                    </div>
                    {(entry.clusterSize || entry.clusterSpacing) && (
                      <div className="grid grid-cols-2 gap-1 mt-0.5">
                        <NumberInput
                          label="Cluster"
                          value={entry.clusterSize ?? 3}
                          onChange={(clusterSize) =>
                            updateResourceEntry(entry.resourceId, {
                              clusterSize,
                            })
                          }
                          min={1}
                          max={20}
                          step={1}
                        />
                        <NumberInput
                          label="Spacing"
                          value={entry.clusterSpacing ?? 5}
                          onChange={(clusterSpacing) =>
                            updateResourceEntry(entry.resourceId, {
                              clusterSpacing,
                            })
                          }
                          min={1}
                          max={50}
                          step={1}
                          unit="m"
                        />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeResourceEntry(entry.resourceId)}
                    className="p-0.5 text-text-tertiary hover:text-red-400 transition-colors flex-shrink-0 ease-out"
                    title="Remove"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              );
            })}

            <ResourceAdder options={resourceOptions} onAdd={addResourceEntry} />
          </>
        )}
      </PropertySection>

      {/* ========== STATION PLACEMENT RULES ========== */}
      <PropertySection
        title="Station Placement"
        icon={<Flame size={10} />}
        badge={region.spawnRules?.stations?.length}
        defaultOpen={hasStationRules}
      >
        {(region.spawnRules?.stations ?? []).map((entry) => {
          const st = manifests.stations.find(
            (s) => s.type === entry.stationType,
          );
          return (
            <div
              key={entry.stationType}
              className="flex items-center gap-1 py-1 border-b border-border-primary/20 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-medium text-text-primary truncate">
                  {st?.name ?? entry.stationType}
                </div>
                <div className="grid grid-cols-2 gap-1 mt-0.5">
                  <NumberInput
                    label="Count"
                    value={entry.count}
                    onChange={(count) =>
                      updateStationEntry(entry.stationType, { count })
                    }
                    min={1}
                    max={10}
                    step={1}
                  />
                  <SelectInput
                    label="Placement"
                    value={entry.placement}
                    onChange={(placement) =>
                      updateStationEntry(entry.stationType, { placement })
                    }
                    options={[
                      { value: "random", label: "Random" },
                      { value: "center", label: "Center" },
                      { value: "near-road", label: "Near road" },
                      { value: "near-water", label: "Near water" },
                    ]}
                  />
                </div>
              </div>
              <button
                onClick={() => removeStationEntry(entry.stationType)}
                className="p-0.5 text-text-tertiary hover:text-red-400 transition-colors flex-shrink-0 ease-out"
                title="Remove"
              >
                <Trash2 size={10} />
              </button>
            </div>
          );
        })}

        <StationAdder options={stationOptions} onAdd={addStationEntry} />
      </PropertySection>

      {/* Procgen Section (Phase 4C) */}
      <PropertySection
        title="Entity Generation"
        icon={<Wand2 size={10} />}
        defaultOpen={false}
      >
        <div className="space-y-2">
          <NumberInput
            label="Seed"
            value={procgenSeed}
            onChange={setProcgenSeed}
            min={0}
            max={999999}
            step={1}
          />

          {/* Generation stats from last run */}
          {lastStats && (
            <div className="text-[9px] text-text-tertiary bg-bg-secondary rounded px-2 py-1 space-y-0.5">
              <div>
                Mobs: {lastStats.mobsGenerated} | Resources:{" "}
                {lastStats.resourcesGenerated} | Stations:{" "}
                {lastStats.stationsGenerated}
              </div>
              <div>
                Region area: ~{lastStats.regionArea.toLocaleString()}m² | Seed:{" "}
                {lastStats.seed}
              </div>
            </div>
          )}

          {/* Count of existing procgen entities */}
          {(() => {
            const procgenMobs = state.extendedLayers.mobSpawns.filter(
              (m) => m.source === "procgen" && m.sourceRegionId === region.id,
            ).length;
            const procgenRes = state.extendedLayers.resources.filter(
              (r) => r.source === "procgen" && r.sourceRegionId === region.id,
            ).length;
            const procgenSta = state.extendedLayers.stations.filter(
              (s) => s.source === "procgen" && s.sourceRegionId === region.id,
            ).length;
            const total = procgenMobs + procgenRes + procgenSta;
            if (total === 0) return null;
            return (
              <div className="text-[9px] text-text-secondary">
                Current: {procgenMobs} mobs, {procgenRes} resources,{" "}
                {procgenSta} stations (procgen)
              </div>
            );
          })()}

          <div className="flex gap-1">
            <button
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium bg-primary/20 text-primary hover:bg-primary/30 transition-colors ease-out"
              onClick={() => {
                const stats = generateAndCommit(region.id, procgenSeed);
                setLastStats(stats);
              }}
              disabled={!region.spawnRules}
              title={
                region.spawnRules
                  ? "Generate entities"
                  : "Add spawn rules first"
              }
            >
              <Wand2 size={10} />
              Generate
            </button>

            <button
              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors ease-out"
              onClick={() => {
                clearRegion(region.id);
                setLastStats(null);
              }}
              title="Remove all procgen entities in this region"
            >
              <RotateCcw size={10} />
              Clear
            </button>
          </div>

          {/* Validation */}
          <button
            className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors ease-out"
            onClick={() => setValidationWarnings(validate())}
          >
            <CheckCircle2 size={10} />
            Validate Progression
          </button>

          {validationWarnings.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {validationWarnings.map((w, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-1 text-[9px] px-1.5 py-0.5 rounded ${
                    w.level === "error"
                      ? "text-red-400 bg-red-500/10"
                      : w.level === "warning"
                        ? "text-amber-400 bg-amber-500/10"
                        : "text-blue-400 bg-blue-500/10"
                  }`}
                >
                  {w.level === "error" ? (
                    <AlertTriangle size={9} className="flex-shrink-0 mt-0.5" />
                  ) : (
                    <Info size={9} className="flex-shrink-0 mt-0.5" />
                  )}
                  <span>
                    [{w.skill}] {w.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </PropertySection>

      {/* Behavior Script */}
      <BehaviorScriptSection
        entityId={region.id}
        stateKey="regions"
        stateRoot="extendedLayers"
        entityData={region as unknown as Record<string, unknown>}
        description="Visual event graph for zone behavior triggers (e.g., player enters/leaves)"
      />
    </>
  );
}

// ============== INLINE ENTITY ADDERS ==============

/** Searchable dropdown to add a mob to the spawn table */
function MobAdder({
  options,
  onAdd,
}: {
  options: Array<{ value: string; label: string }>;
  onAdd: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () =>
      search
        ? options.filter((o) =>
            o.label.toLowerCase().includes(search.toLowerCase()),
          )
        : options,
    [options, search],
  );

  return (
    <div className="mt-1 relative">
      <div className="flex gap-1">
        <input
          type="text"
          placeholder="Add mob..."
          className="flex-1 px-1.5 py-0.5 text-[10px] bg-bg-tertiary rounded border border-border-primary text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary/50"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-0.5 max-h-32 overflow-y-auto bg-bg-secondary border border-border-primary rounded shadow-lg">
          {filtered.slice(0, 20).map((opt) => (
            <button
              key={opt.value}
              className="w-full text-left px-2 py-1 text-[10px] text-text-primary hover:bg-bg-tertiary truncate"
              onMouseDown={(e) => {
                e.preventDefault();
                onAdd(opt.value);
                setSearch("");
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Searchable dropdown to add a resource */
function ResourceAdder({
  options,
  onAdd,
}: {
  options: Array<{ value: string; label: string }>;
  onAdd: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () =>
      search
        ? options.filter((o) =>
            o.label.toLowerCase().includes(search.toLowerCase()),
          )
        : options,
    [options, search],
  );

  return (
    <div className="mt-1 relative">
      <div className="flex gap-1">
        <input
          type="text"
          placeholder="Add resource..."
          className="flex-1 px-1.5 py-0.5 text-[10px] bg-bg-tertiary rounded border border-border-primary text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary/50"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-0.5 max-h-32 overflow-y-auto bg-bg-secondary border border-border-primary rounded shadow-lg">
          {filtered.slice(0, 20).map((opt) => (
            <button
              key={opt.value}
              className="w-full text-left px-2 py-1 text-[10px] text-text-primary hover:bg-bg-tertiary truncate"
              onMouseDown={(e) => {
                e.preventDefault();
                onAdd(opt.value);
                setSearch("");
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Searchable dropdown to add a station */
function StationAdder({
  options,
  onAdd,
}: {
  options: Array<{ value: string; label: string }>;
  onAdd: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () =>
      search
        ? options.filter((o) =>
            o.label.toLowerCase().includes(search.toLowerCase()),
          )
        : options,
    [options, search],
  );

  return (
    <div className="mt-1 relative">
      <div className="flex gap-1">
        <input
          type="text"
          placeholder="Add station..."
          className="flex-1 px-1.5 py-0.5 text-[10px] bg-bg-tertiary rounded border border-border-primary text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary/50"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-0.5 max-h-32 overflow-y-auto bg-bg-secondary border border-border-primary rounded shadow-lg">
          {filtered.slice(0, 20).map((opt) => (
            <button
              key={opt.value}
              className="w-full text-left px-2 py-1 text-[10px] text-text-primary hover:bg-bg-tertiary truncate"
              onMouseDown={(e) => {
                e.preventDefault();
                onAdd(opt.value);
                setSearch("");
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
