/**
 * Teleport custom sections — migrated from the bespoke TeleportProperties
 * component. Exports two widgets:
 *
 *   - TeleportRequirementsSection — edits the nested `requirements` object
 *     (questId, minLevel, itemId). The schema's auto-generated fields can't
 *     address nested keys yet, so this widget owns the requirements UI.
 *   - TeleportConnectionsSection — manages the bidirectional connections
 *     array, with a picker that updates both sides of each link and a
 *     click-to-select action that navigates to the linked teleport.
 *
 * Registered under "TeleportRequirements" and "TeleportConnections" in
 * `registerBuiltinCustomSections`.
 */

import { Link, Unlink, MapPin } from "lucide-react";
import React, { useCallback, useMemo } from "react";
import type { CustomSectionProps } from "./customSectionRegistry";
import { useWorldStudio } from "../../components/WorldStudio/WorldStudioContext";
import {
  TextInput,
  NumberInput,
} from "../../components/WorldStudio/panels/properties/PropertyControls";
import type { PlacedTeleport } from "../../components/WorldStudio/types";

interface TeleportRequirements {
  questId?: string;
  minLevel?: number;
  itemId?: string;
}

export function TeleportRequirementsSection({
  entityId,
  entityData,
}: CustomSectionProps) {
  const { actions } = useWorldStudio();
  const requirements =
    (entityData.requirements as TeleportRequirements | undefined) ?? {};

  const patch = useCallback(
    (next: TeleportRequirements) => {
      actions.updateTeleport(entityId, { requirements: next });
    },
    [actions, entityId],
  );

  return (
    <>
      <TextInput
        label="Quest ID"
        value={requirements.questId ?? ""}
        onChange={(questId) =>
          patch({
            ...requirements,
            questId: questId || undefined,
          })
        }
        placeholder="Optional quest requirement"
      />
      <NumberInput
        label="Min Level"
        value={requirements.minLevel ?? 0}
        onChange={(minLevel) =>
          patch({
            ...requirements,
            minLevel: minLevel || undefined,
          })
        }
        min={0}
        max={99}
      />
      <TextInput
        label="Item ID"
        value={requirements.itemId ?? ""}
        onChange={(itemId) =>
          patch({
            ...requirements,
            itemId: itemId || undefined,
          })
        }
        placeholder="Optional item requirement"
      />
    </>
  );
}

export function TeleportConnectionsSection({
  entityId,
  entityData,
}: CustomSectionProps) {
  const { state, actions } = useWorldStudio();
  const allTeleports = state.extendedLayers.teleports;
  const connections = (entityData.connections as string[] | undefined) ?? [];

  const availableTeleports = useMemo(
    () =>
      allTeleports.filter(
        (t) => t.id !== entityId && !connections.includes(t.id),
      ),
    [allTeleports, entityId, connections],
  );

  const connectedTeleports = useMemo(
    () =>
      connections.map((connId) => {
        const found = allTeleports.find((t) => t.id === connId);
        return { id: connId, name: found?.name ?? connId };
      }),
    [connections, allTeleports],
  );

  const addConnection = useCallback(
    (targetId: string) => {
      actions.updateTeleport(entityId, {
        connections: [...connections, targetId],
      });
      const target = allTeleports.find((t) => t.id === targetId);
      if (target && !target.connections.includes(entityId)) {
        actions.updateTeleport(targetId, {
          connections: [...target.connections, entityId],
        });
      }
    },
    [actions, entityId, allTeleports, connections],
  );

  const removeConnection = useCallback(
    (targetId: string) => {
      actions.updateTeleport(entityId, {
        connections: connections.filter((id) => id !== targetId),
      });
      const target = allTeleports.find((t) => t.id === targetId);
      if (target) {
        actions.updateTeleport(targetId, {
          connections: target.connections.filter((id) => id !== entityId),
        });
      }
    },
    [actions, entityId, allTeleports, connections],
  );

  const selectTeleport = useCallback(
    (id: string) => {
      const t = allTeleports.find((tp) => tp.id === id);
      if (t) {
        actions.setSelection({
          type: "teleport",
          id,
          path: [{ type: "teleport", id, name: t.name }],
        });
      }
    },
    [allTeleports, actions],
  );

  return (
    <>
      {connectedTeleports.length > 0 ? (
        <div className="space-y-1">
          {connectedTeleports.map(({ id, name }) => (
            <div key={id} className="flex items-center gap-1.5 group">
              <Link size={10} className="text-violet-400 flex-shrink-0" />
              <button
                className="flex-1 text-left text-[10px] text-text-secondary hover:text-primary truncate"
                onClick={() => selectTeleport(id)}
                title={`Select "${name}"`}
              >
                {name}
              </button>
              <button
                className="text-text-tertiary hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 ease-out"
                onClick={() => removeConnection(id)}
                title="Disconnect"
              >
                <Unlink size={10} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[10px] text-text-tertiary italic">
          No connections yet.
        </div>
      )}

      {availableTeleports.length > 0 && (
        <div className="mt-1.5 pt-1.5 border-t border-border-primary">
          <div className="text-[9px] text-text-tertiary uppercase tracking-[0.12em] mb-1">
            Link to...
          </div>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {availableTeleports.map((t: PlacedTeleport) => (
              <button
                key={t.id}
                className="w-full flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors ease-out"
                onClick={() => addConnection(t.id)}
                title={`Connect to "${t.name}"`}
              >
                <MapPin size={10} className="text-violet-300 flex-shrink-0" />
                <span className="truncate">{t.name}</span>
                <span className="ml-auto text-[9px] text-text-tertiary">
                  ({Math.round(t.position.x)}, {Math.round(t.position.z)})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {allTeleports.length <= 1 && (
        <div className="text-[10px] text-text-tertiary italic mt-1">
          Place more teleport nodes to create a network.
        </div>
      )}
    </>
  );
}
