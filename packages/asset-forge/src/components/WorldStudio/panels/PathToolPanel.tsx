/**
 * PathToolPanel — Left sidebar for road/path creation and editing.
 *
 * Features:
 * - "Draw Road" mode: click terrain to place waypoints, double-click to finish
 * - Road list: generated (read-only) + custom (editable)
 * - Property editing for custom roads (name, width)
 * - Delete custom roads
 */

import {
  Route,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
} from "lucide-react";
import React, { useState, useCallback, useMemo } from "react";

import type { CustomRoad } from "../../WorldBuilder/types";
import { useWorldStudio } from "../WorldStudioContext";
import { PropertySection, InfoRow } from "./properties/PropertyControls";

// ============== TYPES ==============

interface PathListEntry {
  id: string;
  name: string;
  points: number;
  width: number;
  isCustom: boolean;
  /** Connected town names for generated roads */
  connection?: string;
}

// ============== COMPONENT ==============

export function PathToolPanel() {
  const { state, actions, viewportRef } = useWorldStudio();

  const [hiddenPaths, setHiddenPaths] = useState<Set<string>>(new Set());
  const [activePathId, setActivePathId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editWidth, setEditWidth] = useState(6);

  // Merge generated + custom roads into a unified list
  const allPaths: PathListEntry[] = useMemo(() => {
    const foundation = state.builder.editing.world?.foundation;
    const layers = state.builder.editing.world?.layers;

    const generated: PathListEntry[] = (foundation?.roads ?? []).map((road) => {
      const fromTown = foundation?.towns.find(
        (t) => t.id === road.connectedTowns[0],
      );
      const toTown = foundation?.towns.find(
        (t) => t.id === road.connectedTowns[1],
      );
      return {
        id: road.id,
        name: `Road ${road.id.replace("autogen-road-", "")}`,
        points: road.path.length,
        width: road.width,
        isCustom: false,
        connection:
          fromTown && toTown ? `${fromTown.name} → ${toTown.name}` : undefined,
      };
    });

    const custom: PathListEntry[] = (layers?.customRoads ?? []).map((road) => ({
      id: road.id,
      name: road.name,
      points: road.path.length,
      width: road.width,
      isCustom: true,
    }));

    return [...custom, ...generated];
  }, [state.builder.editing.world]);

  const customRoads = state.builder.editing.world?.layers.customRoads ?? [];

  const togglePathVisibility = useCallback((pathId: string) => {
    setHiddenPaths((prev) => {
      const next = new Set(prev);
      if (next.has(pathId)) next.delete(pathId);
      else next.add(pathId);
      return next;
    });
  }, []);

  const handleCreateRoad = useCallback(() => {
    const vp = viewportRef.current;
    const querier = vp?.queryBiome;
    if (!querier) return;

    // Create a new custom road with empty path — user will add waypoints
    const id = `custom-road-${Date.now()}`;
    const index = customRoads.length + 1;
    const road: CustomRoad = {
      id,
      name: `Custom Road ${index}`,
      path: [],
      width: 6,
    };
    actions.addCustomRoad(road);
    setActivePathId(id);
    setEditingId(id);
    setEditName(road.name);
    setEditWidth(road.width);
  }, [actions, viewportRef, customRoads.length]);

  const handleDeleteRoad = useCallback(
    (roadId: string) => {
      actions.removeCustomRoad(roadId);
      if (activePathId === roadId) setActivePathId(null);
      if (editingId === roadId) setEditingId(null);
    },
    [actions, activePathId, editingId],
  );

  const handleStartEdit = useCallback((road: PathListEntry) => {
    setEditingId(road.id);
    setEditName(road.name);
    setEditWidth(road.width);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingId) return;
    actions.updateCustomRoad(editingId, {
      name: editName.trim() || `Custom Road`,
      width: editWidth,
    });
    setEditingId(null);
  }, [editingId, editName, editWidth, actions]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleAddWaypoint = useCallback(
    (roadId: string, x: number, z: number) => {
      const road = customRoads.find((r) => r.id === roadId);
      if (!road) return;
      const querier = viewportRef.current?.queryBiome;
      const y = querier ? querier(x, z).height : 0;
      actions.updateCustomRoad(roadId, {
        path: [...road.path, { x, y, z }],
      });
    },
    [customRoads, actions, viewportRef],
  );

  const handleRemoveWaypoint = useCallback(
    (roadId: string, index: number) => {
      const road = customRoads.find((r) => r.id === roadId);
      if (!road) return;
      const newPath = road.path.filter((_, i) => i !== index);
      actions.updateCustomRoad(roadId, { path: newPath });
    },
    [customRoads, actions],
  );

  // Active custom road for waypoint editing
  const activeCustomRoad = customRoads.find((r) => r.id === activePathId);
  const activeGenerated = !activeCustomRoad
    ? allPaths.find((p) => p.id === activePathId)
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-[0.12em]">
          Path / Road Tool
        </span>
        <button
          className="flex items-center gap-1 px-2 py-1 rounded bg-primary/20 hover:bg-primary/30 text-primary text-[10px] font-medium transition-colors ease-out"
          onClick={handleCreateRoad}
          title="Create new custom road"
        >
          <Plus size={10} />
          New Road
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Custom Roads */}
        {customRoads.length > 0 && (
          <PropertySection
            title="Custom Roads"
            icon={<Route size={10} />}
            badge={customRoads.length}
          >
            <div className="space-y-0.5 max-h-52 overflow-y-auto scrollbar-thin">
              {allPaths
                .filter((p) => p.isCustom)
                .map((path) => {
                  const isActive = path.id === activePathId;
                  const isEditing = path.id === editingId;
                  const isHidden = hiddenPaths.has(path.id);
                  return (
                    <div
                      key={path.id}
                      className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] cursor-pointer transition-colors ${
                        isActive
                          ? "bg-primary/15 border border-primary/30"
                          : "bg-bg-tertiary/30 border border-transparent hover:bg-bg-tertiary/60"
                      } ease-out`}
                      onClick={() => setActivePathId(path.id)}
                    >
                      <Route size={10} className="text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-text-primary truncate font-medium">
                          {path.name}
                        </div>
                        <div className="text-text-tertiary">
                          {path.points} pts &middot; {path.width}m wide
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          className="text-text-tertiary hover:text-primary transition-colors p-0.5 ease-out"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isEditing) handleCancelEdit();
                            else handleStartEdit(path);
                          }}
                          title={isEditing ? "Cancel edit" : "Edit road"}
                        >
                          {isEditing ? <X size={10} /> : <Pencil size={10} />}
                        </button>
                        <button
                          className="text-text-tertiary hover:text-red-400 transition-colors p-0.5 ease-out"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRoad(path.id);
                          }}
                          title="Delete road"
                        >
                          <Trash2 size={10} />
                        </button>
                        <button
                          className="text-text-tertiary hover:text-text-secondary transition-colors p-0.5 ease-out"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePathVisibility(path.id);
                          }}
                          title={isHidden ? "Show" : "Hide"}
                        >
                          {isHidden ? <EyeOff size={10} /> : <Eye size={10} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </PropertySection>
        )}

        {/* Edit Panel for selected custom road */}
        {editingId && activeCustomRoad && (
          <PropertySection title="Edit Road">
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-text-tertiary block mb-0.5">
                  Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-1.5 py-1 rounded bg-bg-tertiary border border-border-primary text-[10px] text-text-primary focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-text-tertiary block mb-0.5">
                  Width (m)
                </label>
                <input
                  type="range"
                  min={2}
                  max={20}
                  step={1}
                  value={editWidth}
                  onChange={(e) => setEditWidth(Number(e.target.value))}
                  className="w-full h-1 accent-primary"
                />
                <div className="text-[10px] text-text-tertiary text-right">
                  {editWidth}m
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded bg-primary/20 hover:bg-primary/30 text-primary text-[10px] font-medium transition-colors ease-out"
                  onClick={handleSaveEdit}
                >
                  <Check size={10} />
                  Save
                </button>
                <button
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 text-text-secondary text-[10px] transition-colors ease-out"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
              </div>
            </div>
          </PropertySection>
        )}

        {/* Waypoints for selected custom road */}
        {activeCustomRoad && (
          <PropertySection
            title="Waypoints"
            badge={activeCustomRoad.path.length}
          >
            <div className="text-[10px] text-text-tertiary italic mb-1">
              Click terrain in viewport to add waypoints.
            </div>
            {activeCustomRoad.path.length === 0 ? (
              <div className="text-[10px] text-amber-400/80 italic">
                No waypoints yet. Click on the terrain to start drawing.
              </div>
            ) : (
              <div className="space-y-0.5 max-h-40 overflow-y-auto scrollbar-thin">
                {activeCustomRoad.path.map((pt, index) => (
                  <div
                    key={`${activeCustomRoad.id}-wp-${index}`}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-bg-tertiary/50 text-[10px]"
                  >
                    <span className="text-text-tertiary w-4 text-right font-mono">
                      {index + 1}
                    </span>
                    <span className="flex-1 text-text-secondary font-mono truncate">
                      ({Math.round(pt.x)}, {Math.round(pt.z)})
                    </span>
                    <button
                      className="text-text-tertiary hover:text-red-400 transition-colors p-0.5 ease-out"
                      onClick={() =>
                        handleRemoveWaypoint(activeCustomRoad.id, index)
                      }
                      title="Remove waypoint"
                    >
                      <X size={8} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              className="mt-1 w-full flex items-center justify-center gap-1 px-2 py-1 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 text-text-secondary text-[10px] transition-colors ease-out"
              onClick={() => {
                // Use camera target position as a quick waypoint
                // In practice, user clicks terrain in viewport
                const vp = viewportRef.current;
                if (!vp?.queryBiome) return;
                // This is a fallback — primary way is clicking the terrain
              }}
              title="Click terrain to add waypoints"
              disabled
            >
              <Plus size={10} />
              Click terrain to add
            </button>
          </PropertySection>
        )}

        {/* Generated Roads (read-only) */}
        <PropertySection
          title="Generated Roads"
          icon={<Route size={10} />}
          badge={allPaths.filter((p) => !p.isCustom).length}
          defaultOpen={customRoads.length > 0 ? false : true}
        >
          {allPaths.filter((p) => !p.isCustom).length === 0 ? (
            <div className="text-[10px] text-text-tertiary italic">
              No generated roads. Generate a world with towns to create roads.
            </div>
          ) : (
            <div className="space-y-0.5 max-h-52 overflow-y-auto scrollbar-thin">
              {allPaths
                .filter((p) => !p.isCustom)
                .map((path) => {
                  const isActive = path.id === activePathId;
                  const isHidden = hiddenPaths.has(path.id);
                  return (
                    <div
                      key={path.id}
                      className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] cursor-pointer transition-colors ${
                        isActive
                          ? "bg-primary/15 border border-primary/30"
                          : "bg-bg-tertiary/30 border border-transparent hover:bg-bg-tertiary/60"
                      } ease-out`}
                      onClick={() => setActivePathId(path.id)}
                    >
                      <Route
                        size={10}
                        className="text-text-tertiary flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-text-primary truncate font-medium">
                          {path.name}
                        </div>
                        <div className="text-text-tertiary">
                          {path.connection ?? `${path.points} pts`}
                        </div>
                      </div>
                      <button
                        className="text-text-tertiary hover:text-text-secondary transition-colors p-0.5 flex-shrink-0 ease-out"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePathVisibility(path.id);
                        }}
                        title={isHidden ? "Show" : "Hide"}
                      >
                        {isHidden ? <EyeOff size={10} /> : <Eye size={10} />}
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </PropertySection>

        {/* Read-only control points for generated road */}
        {activeGenerated && (
          <PropertySection title="Road Info" defaultOpen={false}>
            <InfoRow label="Width" value={`${activeGenerated.width}m`} />
            <InfoRow label="Points" value={activeGenerated.points} />
            {activeGenerated.connection && (
              <InfoRow label="Connects" value={activeGenerated.connection} />
            )}
            <div className="text-[10px] text-amber-400/80 italic mt-1">
              Generated road (read-only). Edit in Creation Mode.
            </div>
          </PropertySection>
        )}

        {/* Summary */}
        <PropertySection title="Summary" defaultOpen={false}>
          <InfoRow
            label="Generated"
            value={allPaths.filter((p) => !p.isCustom).length}
          />
          <InfoRow label="Custom" value={customRoads.length} />
          <InfoRow label="Total roads" value={allPaths.length} />
        </PropertySection>
      </div>
    </div>
  );
}
