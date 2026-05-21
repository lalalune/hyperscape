/**
 * NPC custom sections — migrated from the bespoke NPCProperties component.
 *
 * Each section is a small, focused widget registered under a stable widget ID
 * in `registerBuiltinCustomSections`. The NPC entity schema references them
 * via `customSections` in HyperiaModule.
 *
 * Widgets exported:
 *   - NPCIdentitySection      ("NPCIdentity")      read-only manifest + context
 *   - NPCStatsSection         ("NPCStats")         read-only manifest stats
 *   - NPCCombatSection        ("NPCCombat")        read-only manifest combat
 *   - NPCDropsSection         ("NPCDrops")         read-only manifest drops
 *   - NPCDialogueSection      ("NPCDialogue")      editable with override
 *   - NPCLinkedStoreSection   ("NPCLinkedStore")   StoreEditor passthrough
 *   - NPCAIGenerationSection  ("NPCAIGeneration")  AI generation buttons
 *   - NPCManifestMissingSection ("NPCManifestMissing") warning when missing
 */

import {
  Heart,
  Sword,
  Package,
  MessageSquare,
  Sparkles,
  Plus,
} from "lucide-react";
import React, { useCallback, useMemo } from "react";
import type { CustomSectionProps } from "./customSectionRegistry";
import { useWorldStudio } from "../../components/WorldStudio/WorldStudioContext";
import { useAIGeneration } from "../../components/WorldStudio/hooks/useAIGeneration";
import { InfoRow } from "../../components/WorldStudio/panels/properties/PropertyControls";
import { ItemReference } from "../../components/WorldStudio/panels/ItemPicker";
import { StoreEditor } from "../../components/WorldStudio/panels/properties/StoreEditor";
import { DialogueEditor } from "../../components/WorldStudio/panels/properties/DialogueEditor";
import type { NPCManifestOverride } from "../../components/WorldStudio/types";
import type { PlacedNPC } from "../../components/WorldBuilder/types";

// ─────────────────────────── helpers ───────────────────────────

interface NPCRawData {
  stats?: {
    level?: number;
    health?: number;
    attack?: number;
    strength?: number;
    defense?: number;
  };
  combat?: {
    attackable?: boolean;
    aggressive?: boolean;
    aggroRange?: number;
    attackSpeedTicks?: number;
    respawnTicks?: number;
  };
  drops?: {
    always?: Array<{ itemId: string; chance: number }>;
    common?: Array<{ itemId: string; chance: number }>;
    uncommon?: Array<{ itemId: string; chance: number }>;
    rare?: Array<{ itemId: string; chance: number }>;
    veryRare?: Array<{ itemId: string; chance: number }>;
  };
  dialogue?: NPCManifestOverride["dialogue"];
}

function useNPCManifest(entityData: Record<string, unknown>) {
  const { state } = useWorldStudio();
  const npcTypeId = entityData.npcTypeId as string | undefined;
  const manifestNPC = useMemo(
    () =>
      npcTypeId
        ? state.manifests.npcs.find((n) => n.id === npcTypeId)
        : undefined,
    [state.manifests.npcs, npcTypeId],
  );
  const rawData = (manifestNPC?._raw ?? undefined) as NPCRawData | undefined;
  return { npcTypeId, manifestNPC, rawData };
}

// ─────────────────────── NPCIdentitySection ───────────────────────

export function NPCIdentitySection({ entityData }: CustomSectionProps) {
  const { manifestNPC } = useNPCManifest(entityData);
  const npc = entityData as unknown as PlacedNPC;

  return (
    <>
      <InfoRow
        label="Context"
        value={
          npc.parentContext?.type === "world"
            ? "World"
            : npc.parentContext?.type === "town"
              ? `Town: ${npc.parentContext.townId}`
              : npc.parentContext?.type === "building"
                ? `Building: ${npc.parentContext.buildingId}`
                : "—"
        }
      />
      {manifestNPC && (
        <>
          <InfoRow label="Category" value={manifestNPC.category} />
          <InfoRow
            label="Level Range"
            value={
              manifestNPC.levelRange
                ? `${manifestNPC.levelRange[0]}–${manifestNPC.levelRange[1]}`
                : undefined
            }
          />
          {manifestNPC.services?.enabled && (
            <InfoRow
              label="Services"
              value={manifestNPC.services.types.join(", ")}
            />
          )}
        </>
      )}
    </>
  );
}

// ─────────────────────── NPCStatsSection ───────────────────────

export function NPCStatsSection({ entityData }: CustomSectionProps) {
  const { rawData } = useNPCManifest(entityData);
  const stats = rawData?.stats;
  if (!stats) {
    return (
      <div className="text-[10px] text-text-tertiary italic">
        No stats in manifest.
      </div>
    );
  }
  return (
    <>
      {stats.level != null && <InfoRow label="Level" value={stats.level} />}
      {stats.health != null && <InfoRow label="Health" value={stats.health} />}
      {stats.attack != null && <InfoRow label="Attack" value={stats.attack} />}
      {stats.strength != null && (
        <InfoRow label="Strength" value={stats.strength} />
      )}
      {stats.defense != null && (
        <InfoRow label="Defense" value={stats.defense} />
      )}
    </>
  );
}

// ─────────────────────── NPCCombatSection ───────────────────────

export function NPCCombatSection({ entityData }: CustomSectionProps) {
  const { rawData } = useNPCManifest(entityData);
  const combat = rawData?.combat;
  if (!combat?.attackable) {
    return (
      <div className="text-[10px] text-text-tertiary italic">
        This NPC is not attackable.
      </div>
    );
  }
  return (
    <>
      <InfoRow label="Attackable" value="Yes" />
      {combat.aggressive != null && (
        <InfoRow label="Aggressive" value={combat.aggressive ? "Yes" : "No"} />
      )}
      {combat.aggroRange != null && (
        <InfoRow label="Aggro Range" value={combat.aggroRange} />
      )}
      {combat.attackSpeedTicks != null && (
        <InfoRow
          label="Attack Speed"
          value={`${combat.attackSpeedTicks} ticks`}
        />
      )}
      {combat.respawnTicks != null && (
        <InfoRow label="Respawn" value={`${combat.respawnTicks} ticks`} />
      )}
    </>
  );
}

// ─────────────────────── NPCDropsSection ───────────────────────

export function NPCDropsSection({ entityData }: CustomSectionProps) {
  const { rawData } = useNPCManifest(entityData);
  const drops = rawData?.drops;
  if (!drops) {
    return (
      <div className="text-[10px] text-text-tertiary italic">
        No drops in manifest.
      </div>
    );
  }
  return (
    <>
      {(["always", "common", "uncommon", "rare", "veryRare"] as const).map(
        (rarity) => {
          const items = drops[rarity];
          if (!items || items.length === 0) return null;
          return (
            <div key={rarity} className="mb-1">
              <div className="text-[10px] text-text-tertiary capitalize mb-0.5">
                {rarity === "veryRare" ? "Very Rare" : rarity} ({items.length})
              </div>
              {items.map((drop, idx) => (
                <div key={idx} className="flex items-center gap-1 pl-2 py-0.5">
                  <ItemReference itemId={drop.itemId} />
                  <span className="text-[10px] text-text-tertiary">
                    {Math.round(drop.chance * 100)}%
                  </span>
                </div>
              ))}
            </div>
          );
        },
      )}
    </>
  );
}

// ─────────────────────── NPCDialogueSection ───────────────────────

export function NPCDialogueSection({ entityData }: CustomSectionProps) {
  const { state, actions } = useWorldStudio();
  const { npcTypeId, manifestNPC, rawData } = useNPCManifest(entityData);
  const override = npcTypeId
    ? state.manifestOverrides.npcOverrides.get(npcTypeId)
    : undefined;

  const mergedDialogue = useMemo(() => {
    if (override?.dialogue) return override.dialogue;
    return rawData?.dialogue;
  }, [override?.dialogue, rawData?.dialogue]);

  const setDialogueSection = useCallback(
    (value: NPCManifestOverride["dialogue"]) => {
      if (!npcTypeId) return;
      const existing =
        override ?? ({ entityId: npcTypeId } as Record<string, unknown>);
      actions.setManifestOverride("npcOverrides", npcTypeId, {
        ...existing,
        dialogue: value,
      });
    },
    [override, npcTypeId, actions],
  );

  const resetDialogueSection = useCallback(() => {
    if (!override || !npcTypeId) return;
    const updated = { ...override } as Record<string, unknown>;
    delete updated.dialogue;
    const keys = Object.keys(updated).filter((k) => k !== "entityId");
    if (keys.length === 0) {
      actions.clearManifestOverride("npcOverrides", npcTypeId);
    } else {
      actions.setManifestOverride("npcOverrides", npcTypeId, updated);
    }
  }, [override, npcTypeId, actions]);

  if (mergedDialogue) {
    return (
      <DialogueEditor
        dialogue={mergedDialogue}
        isOverridden={override?.dialogue !== undefined}
        onUpdate={(d) => setDialogueSection(d)}
        onReset={resetDialogueSection}
        persistKey="npc-dialogue"
      />
    );
  }

  if (!manifestNPC) {
    return (
      <div className="text-[10px] text-text-tertiary italic">
        No dialogue (manifest entry missing).
      </div>
    );
  }

  return (
    <button
      className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] rounded border border-dashed border-border-primary text-text-tertiary hover:text-text-secondary hover:border-text-tertiary transition-colors ease-out"
      onClick={() =>
        setDialogueSection({
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
  );
}

// ─────────────────────── NPCLinkedStoreSection ───────────────────────

export function NPCLinkedStoreSection({ entityData }: CustomSectionProps) {
  const { state } = useWorldStudio();
  const storeId = entityData.storeId as string | undefined;
  const linkedStore = useMemo(
    () =>
      storeId
        ? state.manifests.stores.find((s) => s.id === storeId)
        : undefined,
    [state.manifests.stores, storeId],
  );
  if (!linkedStore) {
    return (
      <div className="text-[10px] text-text-tertiary italic">
        No linked store.
      </div>
    );
  }
  return <StoreEditor store={linkedStore} />;
}

// ─────────────────────── NPCAIGenerationSection ───────────────────────

export function NPCAIGenerationSection({
  entityId,
  entityData,
}: CustomSectionProps) {
  const { state } = useWorldStudio();
  const ai = useAIGeneration();
  const { npcTypeId, rawData } = useNPCManifest(entityData);
  const override = npcTypeId
    ? state.manifestOverrides.npcOverrides.get(npcTypeId)
    : undefined;
  const mergedDialogue = override?.dialogue ?? rawData?.dialogue;

  const activeOnThis =
    state.aiGeneration.status === "generating" &&
    state.aiGeneration.activeEntityId === entityId;

  return (
    <div className="space-y-1.5">
      <button
        className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] bg-primary/10 text-primary hover:bg-primary/20 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ease-out"
        disabled={ai.isGenerating || !npcTypeId}
        onClick={() => npcTypeId && ai.generateDialogue(npcTypeId)}
      >
        <Sparkles size={10} />
        {activeOnThis ? "Generating..." : "Generate Dialogue"}
      </button>
      <button
        className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] bg-primary/10 text-primary hover:bg-primary/20 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ease-out"
        disabled={
          ai.isGenerating || !npcTypeId || !mergedDialogue?.nodes?.length
        }
        onClick={() => npcTypeId && ai.generateVoice(npcTypeId)}
      >
        <Sparkles size={10} />
        Generate Voice Lines
      </button>
      {state.aiGeneration.status === "error" &&
        state.aiGeneration.activeEntityId === entityId && (
          <div className="text-[10px] text-red-400/80 italic">
            {state.aiGeneration.error}
          </div>
        )}
    </div>
  );
}

// ─────────────────────── NPCManifestMissingSection ───────────────────────

export function NPCManifestMissingSection({ entityData }: CustomSectionProps) {
  const { state } = useWorldStudio();
  const { npcTypeId, manifestNPC } = useNPCManifest(entityData);
  if (manifestNPC || !state.manifests.loaded) return null;
  return (
    <div className="text-[10px] text-amber-400/80 italic">
      No manifest entry found for NPC type &quot;{npcTypeId}&quot;. This NPC
      will not have stats, drops, or dialogue in-game.
    </div>
  );
}

// Icons re-exported for any future UI that wants them
export const NPCSectionIcons = {
  stats: Heart,
  combat: Sword,
  drops: Package,
  dialogue: MessageSquare,
  ai: Sparkles,
};
