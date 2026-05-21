/**
 * ZonePaintPanel — Dedicated left sidebar for zone/region tile painting.
 *
 * Shows when the zonePaint tool is active. Provides:
 * - Zone list with colored indicators and tile counts
 * - "+ New Zone" button to create and start painting
 * - Brush size picker (1x1, 3x3, 5x5)
 * - Paint / Erase mode toggle
 * - Quick properties for the active zone (name, biome)
 */

import { Hexagon, Plus, Paintbrush, Eraser, Trash2 } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";

import type { PlacedRegion } from "../types";
import { ZONE_TILE_SIZE } from "../types";
import { useWorldStudio } from "../WorldStudioContext";
import {
  PropertySection,
  TextInput,
  SelectInput,
  InfoRow,
} from "./properties/PropertyControls";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REGION_COLORS = [
  "#ff8800", // orange
  "#00ccff", // cyan
  "#88ff00", // lime
  "#ff44aa", // pink
  "#aa44ff", // purple
  "#ffcc00", // gold
  "#00ff88", // mint
  "#ff4444", // red
  "#4488ff", // blue
  "#44ffcc", // teal
];

const BRUSH_SIZES = [1, 3, 5, 10, 20, 50] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ZonePaintPanel() {
  const { state, actions } = useWorldStudio();
  const regions = state.extendedLayers.regions;
  const zonePaint = state.tools.zonePaint;
  const activeRegionId = zonePaint?.regionId ?? null;
  const activeRegion = activeRegionId
    ? (regions.find((r) => r.id === activeRegionId) ?? null)
    : null;

  const tileSize = ZONE_TILE_SIZE;

  // Biome options for quick-edit
  const biomeOptions = useMemo(() => {
    const opts = [
      { value: "", label: "-- Inherit --" },
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

  // Create new zone and start painting it
  const createNewZone = useCallback(() => {
    const regionId = `region-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newRegion: PlacedRegion = {
      id: regionId,
      name: `Zone ${regions.length + 1}`,
      description: "",
      tileKeys: [],
      tags: [],
    };
    actions.addRegion(newRegion);
    actions.startZonePaint(regionId);
    actions.setSelection({
      type: "region" as never,
      id: regionId,
      path: [{ type: "region", id: regionId, name: newRegion.name }],
    });
  }, [actions, regions.length]);

  // Switch to painting a different zone
  const selectZone = useCallback(
    (regionId: string) => {
      if (zonePaint) {
        actions.switchZonePaintRegion(regionId);
      } else {
        actions.startZonePaint(regionId);
      }
    },
    [actions, zonePaint],
  );

  // Delete a zone
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const deleteZone = useCallback(
    (regionId: string) => {
      actions.removeRegion(regionId);
      setConfirmDelete(null);
      // If we deleted the active paint target, switch to another or clear
      if (activeRegionId === regionId) {
        const remaining = regions.filter((r) => r.id !== regionId);
        if (remaining.length > 0) {
          actions.switchZonePaintRegion(remaining[0].id);
        } else {
          actions.setTool("select");
        }
      }
    },
    [actions, activeRegionId, regions],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary">
        <div className="flex items-center gap-1.5">
          <Hexagon size={12} className="text-primary" />
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-[0.12em]">
            Zone Painter
          </span>
        </div>
        <button
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-primary/20 text-primary hover:bg-primary/30 transition-colors ease-out"
          onClick={createNewZone}
          title="Create new zone and start painting"
        >
          <Plus size={10} />
          New Zone
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Zone list */}
        <div className="px-2 py-1.5">
          <div className="text-[9px] text-text-tertiary uppercase tracking-[0.12em] font-medium px-1 mb-1">
            Zones ({regions.length})
          </div>

          {regions.length === 0 ? (
            <div className="text-[10px] text-text-tertiary italic px-1 py-3 text-center">
              No zones yet. Click "+ New Zone" to create one.
            </div>
          ) : (
            <div className="space-y-0.5">
              {regions.map((region, index) => {
                const isActive = region.id === activeRegionId;
                const color = REGION_COLORS[index % REGION_COLORS.length];
                const area = region.tileKeys.length * tileSize * tileSize;

                return (
                  <div
                    key={region.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors group ${
                      isActive
                        ? "bg-primary/15 ring-1 ring-primary/30"
                        : "hover:bg-bg-tertiary/40"
                    } ease-out`}
                    onClick={() => selectZone(region.id)}
                  >
                    {/* Color indicator */}
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0 border border-border-secondary"
                      style={{ backgroundColor: color }}
                    />

                    {/* Name + info */}
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-[11px] font-medium truncate ${
                          isActive ? "text-primary" : "text-text-primary"
                        }`}
                      >
                        {region.name}
                      </div>
                      <div className="text-[9px] text-text-tertiary">
                        {region.tileKeys.length} tiles
                        {area > 0 &&
                          ` / ${Math.round(area / 1000).toLocaleString()}k m\u00B2`}
                      </div>
                    </div>

                    {/* Delete button */}
                    {confirmDelete === region.id ? (
                      <div className="flex items-center gap-0.5">
                        <button
                          className="px-1.5 py-0.5 text-[9px] rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteZone(region.id);
                          }}
                        >
                          Yes
                        </button>
                        <button
                          className="px-1.5 py-0.5 text-[9px] rounded bg-bg-tertiary text-text-tertiary hover:text-text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(null);
                          }}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        className="p-0.5 text-text-tertiary/0 group-hover:text-text-tertiary hover:!text-red-400 transition-colors flex-shrink-0 ease-out"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(region.id);
                        }}
                        title="Delete zone"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Brush controls — always visible when painting */}
        {zonePaint && (
          <PropertySection
            title="Brush"
            icon={<Paintbrush size={10} />}
            defaultOpen={true}
          >
            {/* Brush size */}
            <div className="mb-2">
              <div className="text-[9px] text-text-tertiary uppercase tracking-[0.12em] mb-1">
                Brush Size
              </div>
              <div className="flex gap-1 flex-wrap">
                {BRUSH_SIZES.map((size) => {
                  const meters = size * ZONE_TILE_SIZE;
                  return (
                    <button
                      key={size}
                      className={`px-2 py-1.5 rounded text-[10px] font-medium transition-colors ${
                        zonePaint.brushSize === size
                          ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                          : "bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/60"
                      } ease-out`}
                      onClick={() => actions.setZoneBrushSize(size)}
                      title={`${size}\u00D7${size} tiles = ${meters}m \u00D7 ${meters}m`}
                    >
                      {meters}m
                    </button>
                  );
                })}
              </div>
              <div className="text-[9px] text-text-tertiary mt-0.5">
                {zonePaint.brushSize}\u00D7{zonePaint.brushSize} tiles ={" "}
                {zonePaint.brushSize * ZONE_TILE_SIZE}m \u00D7{" "}
                {zonePaint.brushSize * ZONE_TILE_SIZE}m
              </div>
            </div>

            {/* Paint / Erase toggle */}
            <div>
              <div className="text-[9px] text-text-tertiary uppercase tracking-[0.12em] mb-1">
                Mode
              </div>
              <div className="flex gap-1">
                <button
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[11px] font-medium transition-colors ${
                    zonePaint.mode === "paint"
                      ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                      : "bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/60"
                  } ease-out`}
                  onClick={() => actions.setZonePaintMode("paint")}
                  title="Paint tiles (E to toggle)"
                >
                  <Paintbrush size={11} />
                  Paint
                </button>
                <button
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[11px] font-medium transition-colors ${
                    zonePaint.mode === "erase"
                      ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                      : "bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/60"
                  } ease-out`}
                  onClick={() => actions.setZonePaintMode("erase")}
                  title="Erase tiles (E to toggle)"
                >
                  <Eraser size={11} />
                  Erase
                </button>
              </div>
            </div>

            {/* Shortcuts hint */}
            <div className="mt-2 text-[9px] text-text-tertiary space-y-0.5 border-t border-border-primary pt-1.5">
              <div className="flex justify-between">
                <span>LMB / Drag</span>
                <span className="text-text-secondary">Paint</span>
              </div>
              <div className="flex justify-between">
                <span>RMB / Drag</span>
                <span className="text-text-secondary">Erase</span>
              </div>
              <div className="flex justify-between">
                <span>E</span>
                <span className="text-text-secondary">Toggle mode</span>
              </div>
              <div className="flex justify-between">
                <span>[ / ]</span>
                <span className="text-text-secondary">Brush size -/+</span>
              </div>
            </div>
          </PropertySection>
        )}

        {/* Active zone quick-properties */}
        {activeRegion && (
          <PropertySection
            title="Zone Properties"
            icon={<Hexagon size={10} />}
            defaultOpen={true}
          >
            <TextInput
              label="Name"
              value={activeRegion.name}
              onChange={(name) =>
                actions.updateRegion(activeRegion.id, { name })
              }
            />
            <SelectInput
              label="Biome"
              value={activeRegion.biomeOverride ?? ""}
              onChange={(biomeOverride) =>
                actions.updateRegion(activeRegion.id, {
                  biomeOverride: biomeOverride || undefined,
                })
              }
              options={biomeOptions}
            />
            <InfoRow label="Tiles" value={activeRegion.tileKeys.length} />
            <InfoRow
              label="Area"
              value={`~${Math.round(activeRegion.tileKeys.length * tileSize * tileSize).toLocaleString()} m\u00B2`}
            />
          </PropertySection>
        )}

        {/* Empty state — no zones and not painting */}
        {!zonePaint && regions.length === 0 && (
          <div className="px-4 py-8 text-center">
            <Hexagon size={24} className="text-text-tertiary/30 mx-auto mb-2" />
            <p className="text-[11px] text-text-tertiary mb-3">
              Zones define named areas of your world with custom biomes, spawn
              rules, and audio.
            </p>
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium bg-primary/20 text-primary hover:bg-primary/30 transition-colors ease-out"
              onClick={createNewZone}
            >
              <Plus size={11} />
              Create First Zone
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
