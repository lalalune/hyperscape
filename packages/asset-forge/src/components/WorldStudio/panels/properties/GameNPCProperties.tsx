/**
 * GameNPCProperties — Full manifest editor for game world NPC entities
 *
 * Shows all NPC data from the base manifest with inline editing.
 * Edits create override deltas stored in manifestOverrides (staging layer).
 * Base manifests remain read-only.
 */

import {
  User,
  Sword,
  Heart,
  Footprints,
  Eye,
  Package,
  MessageSquare,
  Mic,
  Plus,
  Trash2,
} from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";

import type { NPCManifestOverride, ManifestItem } from "../../types";
import { useWorldStudio } from "../../WorldStudioContext";
import {
  PropertySection,
  InfoRow,
  DragNumberInput,
  TextInput,
  Toggle,
  OverridableField,
} from "./PropertyControls";
import { BehaviorScriptSection } from "./BehaviorScriptSection";
import { TransformSection } from "./TransformSection";
import { GameStoreEditor } from "./GameStoreEditor";
import { DialogueEditor } from "./DialogueEditor";

interface Props {
  entityData: Record<string, unknown>;
}

/** Deeply get a nested value from an object by dot-separated path */
function deepGet(
  obj: Record<string, unknown> | undefined,
  path: string,
): unknown {
  if (!obj) return undefined;
  const parts = path.split(".");
  let current: unknown = obj;
  for (const p of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[p];
  }
  return current;
}

export function GameNPCProperties({ entityData }: Props) {
  const { state, actions } = useWorldStudio();
  const entityId = String(entityData.entityId ?? entityData.npcType ?? "");

  // Base manifest lookup
  const manifestNPC = useMemo(
    () => state.manifests.npcs.find((n) => n.id === entityId),
    [state.manifests.npcs, entityId],
  );
  const raw = manifestNPC?._raw as Record<string, unknown> | undefined;

  // Override from state
  const override = state.manifestOverrides.npcOverrides.get(entityId);

  // Helper: get merged value (override section.field wins over raw section.field)
  const get = useCallback(
    (section: string, field: string): unknown => {
      const ovrSection = override?.[section as keyof NPCManifestOverride];
      if (ovrSection != null && typeof ovrSection === "object") {
        const val = (ovrSection as Record<string, unknown>)[field];
        if (val !== undefined) return val;
      }
      return deepGet(raw, `${section}.${field}`);
    },
    [override, raw],
  );

  // Helper: check if a field is overridden
  const isOvr = useCallback(
    (section: string, field: string): boolean => {
      const ovrSection = override?.[section as keyof NPCManifestOverride];
      if (ovrSection != null && typeof ovrSection === "object") {
        return (ovrSection as Record<string, unknown>)[field] !== undefined;
      }
      return false;
    },
    [override],
  );

  // Helper: set override field
  const set = useCallback(
    (section: string, field: string, value: unknown) => {
      const existing = override ?? ({ entityId } as Record<string, unknown>);
      const sectionData = {
        ...((existing[section as keyof typeof existing] as Record<
          string,
          unknown
        >) ?? {}),
        [field]: value,
      };
      actions.setManifestOverride("npcOverrides", entityId, {
        ...existing,
        [section]: sectionData,
      });
    },
    [override, entityId, actions],
  );

  // Helper: reset one field
  const reset = useCallback(
    (section: string, field: string) => {
      if (!override) return;
      const sectionData = {
        ...((override[section as keyof NPCManifestOverride] as Record<
          string,
          unknown
        >) ?? {}),
      };
      delete sectionData[field];
      // If section is now empty, remove it
      const hasFields = Object.keys(sectionData).length > 0;
      const updated = { ...override } as Record<string, unknown>;
      if (hasFields) {
        updated[section] = sectionData;
      } else {
        delete updated[section];
      }
      // If entire override is just entityId, clear it
      const keys = Object.keys(updated).filter((k) => k !== "entityId");
      if (keys.length === 0) {
        actions.clearManifestOverride("npcOverrides", entityId);
      } else {
        actions.setManifestOverride("npcOverrides", entityId, updated);
      }
    },
    [override, entityId, actions],
  );

  // Helper: set a whole top-level section (for drops, dialogue)
  const setSection = useCallback(
    (section: string, value: unknown) => {
      const existing = override ?? ({ entityId } as Record<string, unknown>);
      actions.setManifestOverride("npcOverrides", entityId, {
        ...existing,
        [section]: value,
      });
    },
    [override, entityId, actions],
  );

  // Helper: reset an entire section
  const resetSection = useCallback(
    (section: string) => {
      if (!override) return;
      const updated = { ...override } as Record<string, unknown>;
      delete updated[section];
      const keys = Object.keys(updated).filter((k) => k !== "entityId");
      if (keys.length === 0) {
        actions.clearManifestOverride("npcOverrides", entityId);
      } else {
        actions.setManifestOverride("npcOverrides", entityId, updated);
      }
    },
    [override, entityId, actions],
  );

  const pos = entityData.position as
    | { x: number; y: number; z: number }
    | undefined;
  const drops = raw?.drops as Record<string, unknown> | undefined;

  // Merged dialogue (override wins)
  const mergedDialogue = useMemo(() => {
    if (override?.dialogue) return override.dialogue;
    if (!raw?.dialogue) return undefined;
    return raw.dialogue as NPCManifestOverride["dialogue"];
  }, [override?.dialogue, raw?.dialogue]);

  // Drop tier handlers
  const handleSetDropTier = useCallback(
    (tier: string, tierDrops: Array<Record<string, unknown>>) => {
      const currentDrops = (override?.drops ?? drops ?? {}) as Record<
        string,
        unknown
      >;
      setSection("drops", { ...currentDrops, [tier]: tierDrops });
    },
    [override?.drops, drops, setSection],
  );

  const handleResetDropTier = useCallback(
    (tier: string) => {
      if (!override?.drops) return;
      const updatedDrops = { ...override.drops } as Record<string, unknown>;
      delete updatedDrops[tier];
      if (Object.keys(updatedDrops).length > 0) {
        setSection("drops", updatedDrops);
      } else {
        resetSection("drops");
      }
    },
    [override?.drops, setSection, resetSection],
  );

  // Get store info
  const storeId = entityData.storeId as string | undefined;

  if (!manifestNPC && !raw) {
    // Fallback: show basic info if no manifest found
    return (
      <>
        <PropertySection title="NPC (Game World)" icon={<User size={10} />}>
          <InfoRow
            label="Name"
            value={String(entityData.displayName ?? entityData.entityId)}
          />
          <InfoRow label="NPC Type" value={entityId} />
          <InfoRow label="Entity ID" value={String(entityData.entityId)} />
        </PropertySection>
        {pos && (
          <PropertySection title="Transform">
            <TransformSection position={pos} readOnly />
          </PropertySection>
        )}
      </>
    );
  }

  return (
    <>
      {/* Identity */}
      <PropertySection
        title="NPC Identity"
        icon={<User size={10} />}
        persistKey="game-npc-identity"
      >
        <OverridableField
          label="Name"
          isOverridden={isOvr("identity", "name")}
          onReset={() => reset("identity", "name")}
        >
          <TextInput
            label=""
            value={String(
              get("identity", "name") ?? raw?.name ?? manifestNPC?.name ?? "",
            )}
            onChange={(v) => set("identity", "name", v)}
          />
        </OverridableField>
        <InfoRow label="ID" value={entityId} />
        <InfoRow
          label="Category"
          value={String(raw?.category ?? manifestNPC?.category ?? "")}
        />
        {raw?.faction != null ? (
          <InfoRow label="Faction" value={String(raw.faction)} />
        ) : null}
        <InfoRow
          label="Level Range"
          value={
            manifestNPC?.levelRange
              ? `${manifestNPC.levelRange[0]}–${manifestNPC.levelRange[1]}`
              : undefined
          }
        />
        {raw?.description != null ? (
          <OverridableField
            label="Description"
            isOverridden={isOvr("identity", "description")}
            onReset={() => reset("identity", "description")}
          >
            <TextInput
              label=""
              value={String(
                get("identity", "description") ?? raw.description ?? "",
              )}
              onChange={(v) => set("identity", "description", v)}
            />
          </OverridableField>
        ) : null}
      </PropertySection>

      {/* Stats */}
      {raw?.stats != null ? (
        <PropertySection
          title="Stats"
          icon={<Heart size={10} />}
          persistKey="game-npc-stats"
        >
          {(
            [
              ["level", "Level", 1, 200],
              ["health", "Health", 1, 10000],
              ["attack", "Attack", 1, 200],
              ["strength", "Strength", 1, 200],
              ["defense", "Defense", 1, 200],
              ["defenseBonus", "Defense Bonus", 0, 200],
              ["ranged", "Ranged", 1, 200],
              ["magic", "Magic", 1, 200],
            ] as const
          ).map(([field, label, min, max]) => {
            const val = get("stats", field);
            if (val == null) return null;
            return (
              <OverridableField
                key={field}
                label={label}
                isOverridden={isOvr("stats", field)}
                onReset={() => reset("stats", field)}
              >
                <DragNumberInput
                  label=""
                  value={Number(val)}
                  onChange={(v) => set("stats", field, v)}
                  min={min}
                  max={max}
                  step={1}
                />
              </OverridableField>
            );
          })}
        </PropertySection>
      ) : null}

      {/* Combat */}
      {raw?.combat != null ? (
        <PropertySection
          title="Combat"
          icon={<Sword size={10} />}
          persistKey="game-npc-combat"
        >
          <OverridableField
            label="Attackable"
            isOverridden={isOvr("combat", "attackable")}
            onReset={() => reset("combat", "attackable")}
          >
            <Toggle
              label=""
              value={Boolean(get("combat", "attackable") ?? false)}
              onChange={(v) => set("combat", "attackable", v)}
            />
          </OverridableField>
          <OverridableField
            label="Aggressive"
            isOverridden={isOvr("combat", "aggressive")}
            onReset={() => reset("combat", "aggressive")}
          >
            <Toggle
              label=""
              value={Boolean(get("combat", "aggressive") ?? false)}
              onChange={(v) => set("combat", "aggressive", v)}
            />
          </OverridableField>
          <OverridableField
            label="Retaliates"
            isOverridden={isOvr("combat", "retaliates")}
            onReset={() => reset("combat", "retaliates")}
          >
            <Toggle
              label=""
              value={Boolean(get("combat", "retaliates") ?? false)}
              onChange={(v) => set("combat", "retaliates", v)}
            />
          </OverridableField>
          {(
            [
              ["aggroRange", "Aggro Range", 0, 50, 1, "tiles"],
              ["combatRange", "Combat Range", 1, 20, 1, "tiles"],
              ["leashRange", "Leash Range", 1, 100, 1, "tiles"],
              ["attackSpeedTicks", "Attack Speed", 1, 20, 1, "ticks"],
              ["respawnTicks", "Respawn Time", 1, 1000, 1, "ticks"],
            ] as const
          ).map(([field, label, min, max, step, unit]) => {
            const val = get("combat", field);
            if (val == null) return null;
            return (
              <OverridableField
                key={field}
                label={label}
                isOverridden={isOvr("combat", field)}
                onReset={() => reset("combat", field)}
              >
                <DragNumberInput
                  label=""
                  value={Number(val)}
                  onChange={(v) => set("combat", field, v)}
                  min={min}
                  max={max}
                  step={step}
                  unit={unit}
                />
              </OverridableField>
            );
          })}
        </PropertySection>
      ) : null}

      {/* Movement */}
      {raw?.movement != null ? (
        <PropertySection
          title="Movement"
          icon={<Footprints size={10} />}
          persistKey="game-npc-movement"
        >
          <InfoRow
            label="Type"
            value={String(deepGet(raw, "movement.type") ?? "none")}
          />
          <OverridableField
            label="Speed"
            isOverridden={isOvr("movement", "speed")}
            onReset={() => reset("movement", "speed")}
          >
            <DragNumberInput
              label=""
              value={Number(get("movement", "speed") ?? 1)}
              onChange={(v) => set("movement", "speed", v)}
              min={0}
              max={20}
              step={0.1}
            />
          </OverridableField>
          <OverridableField
            label="Wander Radius"
            isOverridden={isOvr("movement", "wanderRadius")}
            onReset={() => reset("movement", "wanderRadius")}
          >
            <DragNumberInput
              label=""
              value={Number(get("movement", "wanderRadius") ?? 0)}
              onChange={(v) => set("movement", "wanderRadius", v)}
              min={0}
              max={100}
              step={1}
              unit="tiles"
            />
          </OverridableField>
        </PropertySection>
      ) : null}

      {/* Appearance */}
      <PropertySection
        title="Appearance"
        icon={<Eye size={10} />}
        persistKey="game-npc-appearance"
        defaultOpen={false}
      >
        <InfoRow
          label="Model"
          value={String(
            deepGet(raw, "appearance.modelPath") ??
              manifestNPC?.appearance?.modelPath ??
              "none",
          )}
        />
        <OverridableField
          label="Scale"
          isOverridden={isOvr("appearance", "scale")}
          onReset={() => reset("appearance", "scale")}
        >
          <DragNumberInput
            label=""
            value={Number(
              get("appearance", "scale") ?? manifestNPC?.appearance?.scale ?? 1,
            )}
            onChange={(v) => set("appearance", "scale", v)}
            min={0.1}
            max={10}
            step={0.1}
          />
        </OverridableField>
      </PropertySection>

      {/* Drops — editable */}
      {(drops || override?.drops) && (
        <DropTableEditor
          baseDrops={drops ?? {}}
          overrideDrops={override?.drops}
          items={state.manifests.items}
          onSetTier={handleSetDropTier}
          onResetTier={handleResetDropTier}
        />
      )}

      {/* Linked Store — full editable store editor */}
      {storeId && <GameStoreEditor storeId={storeId} />}

      {/* Dialogue — editable */}
      {mergedDialogue ? (
        <DialogueEditor
          dialogue={mergedDialogue}
          isOverridden={override?.dialogue !== undefined}
          onUpdate={(d) => setSection("dialogue", d)}
          onReset={() => resetSection("dialogue")}
          persistKey="game-npc-dialogue"
        />
      ) : (
        <PropertySection
          title="Dialogue"
          icon={<MessageSquare size={10} />}
          defaultOpen={false}
        >
          <button
            className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] rounded border border-dashed border-border-primary text-text-tertiary hover:text-text-secondary hover:border-text-tertiary transition-colors ease-out"
            onClick={() =>
              setSection("dialogue", {
                entryNodeId: "greeting",
                nodes: [
                  {
                    id: "greeting",
                    text: "Hello, adventurer!",
                    responses: [],
                  },
                ],
              })
            }
          >
            <Plus size={10} /> Create Dialogue
          </button>
        </PropertySection>
      )}

      {/* Transform */}
      {pos && (
        <PropertySection title="Transform" persistKey="game-npc-transform">
          <TransformSection position={pos} readOnly />
        </PropertySection>
      )}

      {/* Actions */}
      <PropertySection
        title="Actions"
        persistKey="game-npc-actions"
        defaultOpen={false}
      >
        <div className="space-y-1">
          <button
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-bg-tertiary hover:bg-primary/10 hover:text-primary text-text-secondary rounded-md border border-border-primary transition-colors w-full ease-out"
            onClick={() => console.log("[Action] Generate Voice for", entityId)}
          >
            <Mic size={12} className="flex-shrink-0" />
            <span>Generate Voice</span>
          </button>
        </div>
      </PropertySection>

      {/* Behavior Script */}
      <BehaviorScriptSection
        entityId={entityId}
        stateKey="npcOverrides"
        stateRoot="manifestOverrides"
        entityData={{
          ...entityData,
          hasDialogueTree: !!(
            mergedDialogue?.nodes && mergedDialogue.nodes.length > 0
          ),
        }}
        entityCategory="gameNPC"
        entityContext={{
          identifier: entityId,
          dialogue: mergedDialogue,
        }}
      />
    </>
  );
}

// ============== Drop Table Editor ==============

const TIER_LABELS: Record<string, string> = {
  always: "Always",
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  veryRare: "Very Rare",
};

const TIER_COLORS: Record<string, string> = {
  always: "text-text-secondary",
  common: "text-text-secondary",
  uncommon: "text-success",
  rare: "text-info",
  veryRare: "text-primary-light",
};

function DropTableEditor({
  baseDrops,
  overrideDrops,
  items,
  onSetTier,
  onResetTier,
}: {
  baseDrops: Record<string, unknown>;
  overrideDrops?: NPCManifestOverride["drops"];
  items: ManifestItem[];
  onSetTier: (tier: string, drops: Array<Record<string, unknown>>) => void;
  onResetTier: (tier: string) => void;
}) {
  const resolveItemName = useCallback(
    (itemId: string): string => {
      const item = items.find((i) => i.id === itemId);
      return item?.name ?? itemId.replace(/_/g, " ");
    },
    [items],
  );

  return (
    <PropertySection
      title="Drops"
      icon={<Package size={10} />}
      persistKey="game-npc-drops"
      defaultOpen={false}
    >
      {/* Default drop (read-only) */}
      {baseDrops.defaultDrop != null &&
        (() => {
          const dd = baseDrops.defaultDrop as Record<string, unknown>;
          return (
            <div className="py-1 border-b border-border-primary/30">
              <div className="text-[9px] font-semibold text-text-tertiary uppercase tracking-[0.12em] mb-0.5">
                Default
              </div>
              <div className="flex items-center gap-1 text-[10px] text-text-secondary">
                <span>{resolveItemName(String(dd.itemId ?? ""))}</span>
                {dd.quantity != null && (
                  <span className="text-text-tertiary">
                    ×{String(dd.quantity)}
                  </span>
                )}
              </div>
            </div>
          );
        })()}

      {/* Tiered drops — editable */}
      {(["always", "common", "uncommon", "rare", "veryRare"] as const).map(
        (tier) => {
          const baseItems =
            (baseDrops[tier] as Array<Record<string, unknown>> | undefined) ??
            [];
          const ovrItems = overrideDrops?.[tier] as
            | Array<Record<string, unknown>>
            | undefined;
          const isOverridden = ovrItems !== undefined;
          const currentItems = ovrItems ?? baseItems;

          if (currentItems.length === 0 && !isOverridden) return null;

          const handleUpdateDrop = (
            idx: number,
            field: string,
            value: unknown,
          ) => {
            const newDrops = currentItems.map((d, i) =>
              i === idx ? { ...d, [field]: value } : { ...d },
            );
            onSetTier(tier, newDrops);
          };

          const handleDeleteDrop = (idx: number) => {
            onSetTier(
              tier,
              currentItems.filter((_, i) => i !== idx).map((d) => ({ ...d })),
            );
          };

          const handleAddDrop = () => {
            onSetTier(tier, [
              ...currentItems.map((d) => ({ ...d })),
              { itemId: "coins", minQuantity: 1, maxQuantity: 1, chance: 0.5 },
            ]);
          };

          return (
            <div
              key={tier}
              className="py-1.5 border-b border-border-primary/30 last:border-0"
            >
              <div className="flex items-center justify-between mb-1">
                <div
                  className={`text-[9px] font-semibold uppercase tracking-[0.12em] flex items-center gap-1 ${TIER_COLORS[tier] ?? "text-text-tertiary"}`}
                >
                  {TIER_LABELS[tier] ?? tier} ({currentItems.length})
                  {isOverridden && (
                    <span className="text-primary text-[8px]">●</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {isOverridden && (
                    <button
                      className="text-[8px] text-text-tertiary hover:text-text-secondary transition-colors px-1 ease-out"
                      onClick={() => onResetTier(tier)}
                      title="Reset to base"
                    >
                      ⟲
                    </button>
                  )}
                  <button
                    className="p-0.5 rounded text-text-tertiary hover:text-primary transition-colors ease-out"
                    onClick={handleAddDrop}
                    title="Add drop"
                  >
                    <Plus size={10} />
                  </button>
                </div>
              </div>

              {currentItems.map((drop, idx) => {
                const itemId = String(drop.itemId ?? "");
                const minQty = Number(drop.minQuantity ?? drop.quantity ?? 1);
                const maxQty = Number(drop.maxQuantity ?? drop.quantity ?? 1);
                const chance = Number(drop.chance ?? 1);
                return (
                  <div
                    key={idx}
                    className="py-1 pl-1 group border-b border-border-primary/20 last:border-0"
                  >
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-[10px] text-text-secondary truncate flex-1">
                        {resolveItemName(itemId)}
                      </span>
                      <button
                        className="p-0.5 rounded text-text-tertiary opacity-0 group-hover:opacity-100 hover:text-error transition-all ease-out"
                        onClick={() => handleDeleteDrop(idx)}
                        title="Remove drop"
                      >
                        <Trash2 size={9} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <TextInput
                        label=""
                        value={itemId}
                        onChange={(v) => handleUpdateDrop(idx, "itemId", v)}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-1 mt-0.5">
                      <DragNumberInput
                        label="Min"
                        value={minQty}
                        onChange={(v) =>
                          handleUpdateDrop(idx, "minQuantity", v)
                        }
                        min={1}
                        max={9999}
                        step={1}
                      />
                      <DragNumberInput
                        label="Max"
                        value={maxQty}
                        onChange={(v) =>
                          handleUpdateDrop(idx, "maxQuantity", v)
                        }
                        min={1}
                        max={9999}
                        step={1}
                      />
                      <DragNumberInput
                        label="Chance"
                        value={chance}
                        onChange={(v) => handleUpdateDrop(idx, "chance", v)}
                        min={0}
                        max={1}
                        step={0.01}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        },
      )}
    </PropertySection>
  );
}
