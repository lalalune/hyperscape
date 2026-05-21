/**
 * QuestProperties — Editor for selected PlacedQuest with manifest integration
 *
 * Shows placement-level quest data and links to the quest's manifest entry
 * for stages, requirements, rewards, and linked NPCs.
 */

import { Scroll, Target, Users, Sparkles } from "lucide-react";
import React, { useCallback, useMemo } from "react";

import type { PlacedQuest } from "../../../WorldBuilder/types";
import { useWorldStudio } from "../../WorldStudioContext";
import { useAIGeneration } from "../../hooks/useAIGeneration";
import { ItemReference } from "../ItemPicker";
import { PropertySection, TextInput, InfoRow } from "./PropertyControls";
import { QuestStageBuilder } from "./QuestStageBuilder";

interface Props {
  quest: PlacedQuest;
}

export function QuestProperties({ quest }: Props) {
  const { actions, state } = useWorldStudio();
  const ai = useAIGeneration();

  const update = useCallback(
    (updates: Partial<PlacedQuest>) => {
      actions.updateQuest(quest.id, updates);
    },
    [actions, quest.id],
  );

  // Look up quest in manifest data
  const manifestQuest = useMemo(
    () => state.manifests.quests.find((q) => q.id === quest.questTemplateId),
    [state.manifests.quests, quest.questTemplateId],
  );

  // Resolve NPC names
  const giverNPC = useMemo(
    () => state.manifests.npcs.find((n) => n.id === quest.questGiverNpcId),
    [state.manifests.npcs, quest.questGiverNpcId],
  );
  const turnInNPC = useMemo(
    () => state.manifests.npcs.find((n) => n.id === quest.turnInNpcId),
    [state.manifests.npcs, quest.turnInNpcId],
  );

  return (
    <>
      <PropertySection title="Quest" icon={<Scroll size={10} />}>
        <TextInput
          label="Name"
          value={quest.name}
          onChange={(name) => update({ name })}
        />
        <InfoRow label="Template ID" value={quest.questTemplateId} />
        <InfoRow
          label="Giver NPC"
          value={giverNPC ? giverNPC.name : quest.questGiverNpcId}
        />
        <InfoRow
          label="Turn-in NPC"
          value={turnInNPC ? turnInNPC.name : quest.turnInNpcId}
        />
        {manifestQuest && (
          <>
            <InfoRow label="Difficulty" value={manifestQuest.difficulty} />
            <InfoRow label="Quest Points" value={manifestQuest.questPoints} />
            {manifestQuest.replayable && (
              <InfoRow label="Replayable" value="Yes" />
            )}
          </>
        )}
      </PropertySection>

      {/* Manifest: Requirements */}
      {manifestQuest?.requirements && (
        <PropertySection
          title="Requirements"
          icon={<Target size={10} />}
          defaultOpen={false}
        >
          {manifestQuest.requirements.quests &&
            manifestQuest.requirements.quests.length > 0 && (
              <div className="mb-1">
                <div className="text-[10px] text-text-tertiary mb-0.5">
                  Required Quests
                </div>
                {manifestQuest.requirements.quests.map((qId) => {
                  const reqQuest = state.manifests.quests.find(
                    (q) => q.id === qId,
                  );
                  return (
                    <div
                      key={qId}
                      className="text-[10px] text-text-secondary pl-2"
                    >
                      {reqQuest ? reqQuest.name : qId}
                    </div>
                  );
                })}
              </div>
            )}
          {manifestQuest.requirements.skills &&
            Object.keys(manifestQuest.requirements.skills).length > 0 && (
              <div className="mb-1">
                <div className="text-[10px] text-text-tertiary mb-0.5">
                  Required Skills
                </div>
                {Object.entries(manifestQuest.requirements.skills).map(
                  ([skill, level]) => (
                    <InfoRow key={skill} label={skill} value={`Lv${level}`} />
                  ),
                )}
              </div>
            )}
          {manifestQuest.requirements.items &&
            manifestQuest.requirements.items.length > 0 && (
              <div className="mb-1">
                <div className="text-[10px] text-text-tertiary mb-0.5">
                  Required Items
                </div>
                {manifestQuest.requirements.items.map((itemId) => (
                  <div key={itemId} className="pl-2 py-0.5">
                    <ItemReference itemId={itemId} />
                  </div>
                ))}
              </div>
            )}
        </PropertySection>
      )}

      {/* Manifest: Stages & Rewards (editable) */}
      {manifestQuest && <QuestStageBuilder quest={manifestQuest} />}

      {/* Locations */}
      {quest.locations.length > 0 && (
        <PropertySection
          title="Locations"
          icon={<Users size={10} />}
          defaultOpen={false}
        >
          {quest.locations.map((loc, idx) => (
            <div
              key={idx}
              className="text-[10px] text-text-secondary pl-2 py-0.5"
            >
              {loc.type}: {loc.id ?? `(${loc.position?.x}, ${loc.position?.z})`}
            </div>
          ))}
        </PropertySection>
      )}

      {/* AI Generation */}
      <PropertySection
        title="AI Generation"
        icon={<Sparkles size={10} />}
        defaultOpen={false}
      >
        <button
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] bg-primary/10 text-primary hover:bg-primary/20 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ease-out"
          disabled={ai.isGenerating}
          onClick={() => ai.generateQuest(quest.questTemplateId)}
        >
          <Sparkles size={10} />
          {ai.isGenerating && ai.activeEntityId === quest.questTemplateId
            ? "Generating..."
            : "Generate Quest Content"}
        </button>
        {ai.error && ai.activeEntityId === quest.questTemplateId && (
          <div className="text-[10px] text-red-400/80 italic mt-1">
            {ai.error}
          </div>
        )}
      </PropertySection>

      {/* No manifest warning */}
      {!manifestQuest && state.manifests.loaded && (
        <PropertySection title="Manifest">
          <div className="text-[10px] text-amber-400/80 italic">
            No manifest entry found for quest &quot;{quest.questTemplateId}
            &quot;.
          </div>
        </PropertySection>
      )}
    </>
  );
}
