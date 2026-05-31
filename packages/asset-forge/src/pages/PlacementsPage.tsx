import { Cuboid, Loader2, Plus, RefreshCw } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/utils/api";

type PlacementType = "npc" | "prop";

interface PlacementGroupSummary {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  placementCount?: number;
}

interface Position {
  x: number;
  y: number;
  z: number;
}

interface PlacementBase {
  id: string;
  type: PlacementType;
  position: Position;
  rotation: Position;
  scale: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
}

interface NPCPlacement extends PlacementBase {
  type: "npc";
  npcId: string;
  spawnRadius: number;
  maxCount: number;
}

interface PropPlacement extends PlacementBase {
  type: "prop";
  modelPath: string;
}

type PlacementPayload = NPCPlacement | PropPlacement;

const createPlacementId = (type: PlacementType): string =>
  `${type}_${Date.now().toString(36)}`;

export const PlacementsPage: React.FC = () => {
  const [groups, setGroups] = useState<PlacementGroupSummary[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("testing");
  const [placementType, setPlacementType] = useState<PlacementType>("npc");
  const [targetId, setTargetId] = useState("town_merchant");
  const [position, setPosition] = useState<Position>({ x: 0, y: 0, z: 0 });
  const [rotation, setRotation] = useState<Position>({ x: 0, y: 0, z: 0 });
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroup),
    [groups, selectedGroup],
  );

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch("/api/placements/groups");
      if (!response.ok) {
        throw new Error(`Failed to load placement groups (${response.status})`);
      }

      const data = (await response.json()) as PlacementGroupSummary[];
      setGroups(data);
      setSelectedGroup((current) =>
        data.length > 0 && !data.some((group) => group.id === current)
          ? data[0].id
          : current,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load groups");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const updatePosition = (axis: keyof Position, value: string) => {
    setPosition((current) => ({ ...current, [axis]: Number(value) }));
  };

  const updateRotation = (axis: keyof Position, value: string) => {
    setRotation((current) => ({ ...current, [axis]: Number(value) }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setMessage("");

    const base = {
      id: createPlacementId(placementType),
      position,
      rotation,
      scale,
      enabled: true,
      metadata: {},
    };
    const payload: PlacementPayload =
      placementType === "npc"
        ? {
            ...base,
            type: "npc",
            npcId: targetId,
            spawnRadius: 2,
            maxCount: 1,
          }
        : {
            ...base,
            type: "prop",
            modelPath: targetId,
          };

    try {
      const response = await apiFetch(
        `/api/placements/groups/${encodeURIComponent(selectedGroup)}/placements`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to save placement (${response.status})`);
      }

      setMessage(`Added ${payload.id} to ${selectedGroup}`);
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save placement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Cuboid size={20} className="text-primary" />
          <h1 className="text-lg font-semibold text-text-primary">
            3D Placement
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void loadGroups()}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[22rem_1fr]">
        <section className="card border border-border-primary bg-bg-secondary p-4">
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-text-secondary">
                Group
              </span>
              <select
                value={selectedGroup}
                onChange={(event) => setSelectedGroup(event.target.value)}
                className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              {(["npc", "prop"] as PlacementType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPlacementType(type)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    placementType === type
                      ? "border-primary bg-primary bg-opacity-15 text-primary"
                      : "border-border-primary bg-bg-primary text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-text-secondary">
                {placementType === "npc" ? "NPC ID" : "Model Path"}
              </span>
              <input
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
                className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
              />
            </label>

            <div className="grid grid-cols-3 gap-2">
              {(["x", "y", "z"] as Array<keyof Position>).map((axis) => (
                <label key={axis} className="block space-y-1.5">
                  <span className="text-xs font-medium uppercase text-text-secondary">
                    {axis}
                  </span>
                  <input
                    type="number"
                    value={position[axis]}
                    onChange={(event) =>
                      updatePosition(axis, event.target.value)
                    }
                    className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
                  />
                </label>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(["x", "y", "z"] as Array<keyof Position>).map((axis) => (
                <label key={axis} className="block space-y-1.5">
                  <span className="text-xs font-medium uppercase text-text-secondary">
                    R{axis}
                  </span>
                  <input
                    type="number"
                    value={rotation[axis]}
                    onChange={(event) =>
                      updateRotation(axis, event.target.value)
                    }
                    className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
                  />
                </label>
              ))}
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-text-secondary">
                Scale
              </span>
              <input
                type="number"
                min="0.01"
                step="0.1"
                value={scale}
                onChange={(event) => setScale(Number(event.target.value))}
                className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
              />
            </label>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !targetId.trim() || !selectedGroup}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              Add Placement
            </button>
          </div>
        </section>

        <section className="card min-h-[24rem] border border-border-primary bg-bg-secondary">
          <div className="border-b border-border-primary px-4 py-3">
            <h2 className="text-sm font-semibold text-text-primary">
              Placement Groups
            </h2>
          </div>
          <div className="space-y-3 p-4">
            {error && (
              <div className="rounded-lg border border-error bg-error bg-opacity-10 p-3 text-sm text-error">
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-lg border border-success bg-success bg-opacity-10 p-3 text-sm text-success">
                {message}
              </div>
            )}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Loader2 size={16} className="animate-spin" />
                Loading placements...
              </div>
            )}
            {!loading &&
              groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setSelectedGroup(group.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    group.id === activeGroup?.id
                      ? "border-primary bg-primary bg-opacity-10"
                      : "border-border-primary bg-bg-primary hover:bg-bg-tertiary"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {group.name}
                      </p>
                      <p className="text-xs text-text-tertiary">{group.id}</p>
                    </div>
                    <span className="text-xs text-text-secondary">
                      {group.placementCount ?? 0} placements
                    </span>
                  </div>
                  {group.description && (
                    <p className="mt-2 text-xs text-text-secondary">
                      {group.description}
                    </p>
                  )}
                </button>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default PlacementsPage;
