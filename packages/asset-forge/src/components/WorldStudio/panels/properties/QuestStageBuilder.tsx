/**
 * QuestStageBuilder — Inline editor for quest stages
 *
 * Allows adding, removing, reordering, and editing quest stages
 * including type, description, target NPC, objective count, etc.
 */

import {
  ListOrdered,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  Gift,
} from "lucide-react";
import React, { useCallback, useState } from "react";

import type { ManifestQuest, ManifestQuestStage } from "../../types";
import { useWorldStudio } from "../../WorldStudioContext";
import {
  PropertySection,
  TextInput,
  NumberInput,
  SelectInput,
} from "./PropertyControls";

interface Props {
  quest: ManifestQuest;
}

const STAGE_TYPES = [
  { value: "talk", label: "Talk to NPC" },
  { value: "kill", label: "Kill Mobs" },
  { value: "gather", label: "Gather Items" },
  { value: "deliver", label: "Deliver Items" },
  { value: "travel", label: "Travel to Location" },
  { value: "craft", label: "Craft Items" },
  { value: "explore", label: "Explore Area" },
  { value: "escort", label: "Escort NPC" },
  { value: "interact", label: "Interact with Object" },
];

export function QuestStageBuilder({ quest }: Props) {
  const { state, actions } = useWorldStudio();
  const [expandedStage, setExpandedStage] = useState<number | null>(null);

  const updateQuest = useCallback(
    (updates: Partial<ManifestQuest>) => {
      const updatedQuests = state.manifests.quests.map((q) =>
        q.id === quest.id ? { ...q, ...updates } : q,
      );
      actions.updateManifestQuests(updatedQuests);
    },
    [state.manifests.quests, quest.id, actions],
  );

  const updateStage = useCallback(
    (index: number, updates: Partial<ManifestQuestStage>) => {
      const newStages = [...quest.stages];
      newStages[index] = { ...newStages[index], ...updates };
      updateQuest({ stages: newStages });
    },
    [quest.stages, updateQuest],
  );

  const addStage = useCallback(() => {
    const newStage: ManifestQuestStage = {
      id: `stage-${quest.stages.length + 1}`,
      type: "talk",
      description: "New stage",
    };
    updateQuest({ stages: [...quest.stages, newStage] });
    setExpandedStage(quest.stages.length);
  }, [quest.stages, updateQuest]);

  const removeStage = useCallback(
    (index: number) => {
      updateQuest({ stages: quest.stages.filter((_, i) => i !== index) });
      setExpandedStage(null);
    },
    [quest.stages, updateQuest],
  );

  const moveStage = useCallback(
    (index: number, direction: -1 | 1) => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= quest.stages.length) return;
      const newStages = [...quest.stages];
      [newStages[index], newStages[newIndex]] = [
        newStages[newIndex],
        newStages[index],
      ];
      updateQuest({ stages: newStages });
      setExpandedStage(newIndex);
    },
    [quest.stages, updateQuest],
  );

  // Resolve NPC names for display
  const getNPCName = useCallback(
    (npcId?: string) => {
      if (!npcId) return null;
      const npc = state.manifests.npcs.find((n) => n.id === npcId);
      return npc?.name ?? npcId;
    },
    [state.manifests.npcs],
  );

  return (
    <>
      <PropertySection
        title="Stages"
        badge={quest.stages.length}
        icon={<ListOrdered size={10} />}
      >
        {quest.stages.map((stage, idx) => (
          <div
            key={stage.id}
            className="border-b border-border-primary/30 last:border-0"
          >
            {/* Stage header row */}
            <div
              className="flex items-center gap-1 py-1 cursor-pointer hover:bg-bg-tertiary/30 px-0.5 rounded transition-colors ease-out"
              onClick={() =>
                setExpandedStage(expandedStage === idx ? null : idx)
              }
            >
              <span className="text-[10px] text-text-tertiary w-4 text-right">
                {idx + 1}.
              </span>
              <span className="text-[10px] text-text-secondary capitalize flex-1 truncate">
                {stage.type}: {stage.description}
              </span>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  className="p-0.5 text-text-tertiary hover:text-text-primary disabled:opacity-20"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveStage(idx, -1);
                  }}
                  disabled={idx === 0}
                  title="Move up"
                >
                  <ChevronUp size={10} />
                </button>
                <button
                  className="p-0.5 text-text-tertiary hover:text-text-primary disabled:opacity-20"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveStage(idx, 1);
                  }}
                  disabled={idx === quest.stages.length - 1}
                  title="Move down"
                >
                  <ChevronDown size={10} />
                </button>
                <button
                  className="p-0.5 text-text-tertiary hover:text-red-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeStage(idx);
                  }}
                  title="Remove stage"
                >
                  <X size={10} />
                </button>
              </div>
            </div>

            {/* Expanded stage editor */}
            {expandedStage === idx && (
              <div className="pl-4 pb-2 space-y-1">
                <SelectInput
                  label="Type"
                  value={stage.type}
                  onChange={(type) => updateStage(idx, { type })}
                  options={STAGE_TYPES}
                />
                <TextInput
                  label="Description"
                  value={stage.description}
                  onChange={(description) => updateStage(idx, { description })}
                />
                <TextInput
                  label="NPC ID"
                  value={stage.npcId ?? ""}
                  onChange={(npcId) =>
                    updateStage(idx, { npcId: npcId || undefined })
                  }
                  placeholder="Optional NPC"
                />
                {stage.npcId && (
                  <div className="text-[9px] text-text-tertiary pl-1">
                    {getNPCName(stage.npcId)}
                  </div>
                )}
                <TextInput
                  label="Target"
                  value={stage.target ?? ""}
                  onChange={(target) =>
                    updateStage(idx, { target: target || undefined })
                  }
                  placeholder="e.g., mob ID, item ID"
                />
                {(stage.type === "kill" ||
                  stage.type === "gather" ||
                  stage.type === "craft") && (
                  <NumberInput
                    label="Count"
                    value={stage.count ?? 1}
                    onChange={(count) => updateStage(idx, { count })}
                    min={1}
                    max={999}
                  />
                )}
                <TextInput
                  label="Location"
                  value={stage.location ?? ""}
                  onChange={(location) =>
                    updateStage(idx, { location: location || undefined })
                  }
                  placeholder="Optional location hint"
                />
              </div>
            )}
          </div>
        ))}

        <button
          className="w-full mt-1 py-1 text-[10px] text-primary/80 hover:text-primary hover:bg-primary/5 rounded border border-dashed border-primary/30 flex items-center justify-center gap-1"
          onClick={addStage}
        >
          <Plus size={10} />
          Add Stage
        </button>
      </PropertySection>

      {/* Rewards editor */}
      <QuestRewardsEditor quest={quest} updateQuest={updateQuest} />
    </>
  );
}

/**
 * Inline quest rewards editor — XP, items, quest points
 */
function QuestRewardsEditor({
  quest,
  updateQuest,
}: {
  quest: ManifestQuest;
  updateQuest: (updates: Partial<ManifestQuest>) => void;
}) {
  const rewards = quest.rewards ?? {};

  const updateRewards = useCallback(
    (updates: Partial<NonNullable<ManifestQuest["rewards"]>>) => {
      updateQuest({ rewards: { ...rewards, ...updates } });
    },
    [rewards, updateQuest],
  );

  return (
    <PropertySection title="Rewards" icon={<Gift size={10} />}>
      <NumberInput
        label="Quest Points"
        value={rewards.questPoints ?? quest.questPoints}
        onChange={(questPoints) => updateRewards({ questPoints })}
        min={0}
        max={10}
      />
      {rewards.xp && Object.keys(rewards.xp).length > 0 && (
        <div className="mt-1">
          <div className="text-[9px] text-text-tertiary uppercase mb-0.5 tracking-[0.12em]">
            XP Rewards
          </div>
          {Object.entries(rewards.xp).map(([skill, amount]) => (
            <div key={skill} className="flex items-center gap-1 text-[10px]">
              <span className="text-text-tertiary capitalize w-16">
                {skill}
              </span>
              <span className="text-text-secondary">{amount} xp</span>
            </div>
          ))}
        </div>
      )}
      {rewards.items && rewards.items.length > 0 && (
        <div className="mt-1">
          <div className="text-[9px] text-text-tertiary uppercase mb-0.5 tracking-[0.12em]">
            Item Rewards
          </div>
          {rewards.items.map((reward, idx) => (
            <div key={idx} className="text-[10px] text-text-secondary pl-1">
              {reward.itemId} x{reward.quantity}
            </div>
          ))}
        </div>
      )}
    </PropertySection>
  );
}
