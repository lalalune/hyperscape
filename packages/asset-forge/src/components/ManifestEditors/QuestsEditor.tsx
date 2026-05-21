/**
 * QuestsEditor
 * Visual editor for quests.json with stage flow builder
 */

import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Scroll,
  Users,
  Swords,
  Package,
  Trophy,
  Settings,
  Copy,
  MessageSquare,
  Target,
  Pickaxe,
  MousePointer,
} from "lucide-react";
import React, { useState, useCallback, useMemo } from "react";

// Types based on quests.json structure
interface ItemReward {
  itemId: string;
  quantity: number;
}

interface QuestRequirements {
  quests: string[];
  skills: Record<string, number>;
  items: string[];
}

interface QuestStage {
  id: string;
  type: "dialogue" | "kill" | "gather" | "interact" | "location";
  description: string;
  npcId?: string;
  target?: string;
  count?: number;
  location?: { x: number; z: number; radius: number };
}

interface QuestOnStart {
  items: ItemReward[];
  dialogue?: string;
}

interface QuestRewards {
  questPoints: number;
  items: ItemReward[];
  xp: Record<string, number>;
}

interface Quest {
  id: string;
  name: string;
  description: string;
  difficulty:
    | "novice"
    | "intermediate"
    | "experienced"
    | "master"
    | "grandmaster";
  questPoints: number;
  replayable: boolean;
  requirements: QuestRequirements;
  startNpc: string;
  stages: QuestStage[];
  onStart: QuestOnStart;
  rewards: QuestRewards;
}

type QuestsData = Record<string, Quest>;

interface QuestsEditorProps {
  data: QuestsData;
  onChange: (data: QuestsData) => void;
  availableNpcs: string[];
  availableItems: string[];
  availableMobs: string[];
}

const STAGE_TYPES = [
  { value: "dialogue", label: "Dialogue", icon: MessageSquare },
  { value: "kill", label: "Kill", icon: Swords },
  { value: "gather", label: "Gather", icon: Pickaxe },
  { value: "interact", label: "Interact", icon: MousePointer },
  { value: "location", label: "Go To Location", icon: Target },
] as const;

const DIFFICULTIES = [
  { value: "novice", label: "Novice", color: "bg-green-500" },
  { value: "intermediate", label: "Intermediate", color: "bg-yellow-500" },
  { value: "experienced", label: "Experienced", color: "bg-orange-500" },
  { value: "master", label: "Master", color: "bg-red-500" },
  { value: "grandmaster", label: "Grandmaster", color: "bg-purple-500" },
] as const;

const SKILLS = [
  "attack",
  "strength",
  "defense",
  "hitpoints",
  "ranged",
  "magic",
  "prayer",
  "woodcutting",
  "fishing",
  "firemaking",
  "cooking",
  "mining",
  "smithing",
  "crafting",
  "fletching",
  "runecraft",
  "agility",
  "thieving",
  "slayer",
  "farming",
  "hunter",
  "construction",
];

export const QuestsEditor: React.FC<QuestsEditorProps> = ({
  data,
  onChange,
  availableNpcs,
  availableItems,
  availableMobs,
}) => {
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(
    Object.keys(data)[0] || null,
  );
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["general", "stages", "rewards"]),
  );

  const quests = useMemo(() => Object.values(data), [data]);
  const selectedQuest = selectedQuestId ? data[selectedQuestId] : null;

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  const updateQuest = useCallback(
    (questId: string, updates: Partial<Quest>) => {
      const newData = { ...data };
      newData[questId] = { ...newData[questId], ...updates };
      onChange(newData);
    },
    [data, onChange],
  );

  const updateStage = useCallback(
    (questId: string, stageIndex: number, updates: Partial<QuestStage>) => {
      const quest = data[questId];
      if (!quest) return;

      const newStages = quest.stages.map((stage, i) =>
        i === stageIndex ? { ...stage, ...updates } : stage,
      );

      updateQuest(questId, { stages: newStages });
    },
    [data, updateQuest],
  );

  const addStage = useCallback(
    (questId: string) => {
      const quest = data[questId];
      if (!quest) return;

      const newStage: QuestStage = {
        id: `stage_${quest.stages.length + 1}`,
        type: "dialogue",
        description: "New stage",
        npcId: quest.startNpc,
      };

      updateQuest(questId, { stages: [...quest.stages, newStage] });
    },
    [data, updateQuest],
  );

  const deleteStage = useCallback(
    (questId: string, stageIndex: number) => {
      const quest = data[questId];
      if (!quest) return;

      updateQuest(questId, {
        stages: quest.stages.filter((_, i) => i !== stageIndex),
      });
    },
    [data, updateQuest],
  );

  const moveStage = useCallback(
    (questId: string, fromIndex: number, direction: "up" | "down") => {
      const quest = data[questId];
      if (!quest) return;

      const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= quest.stages.length) return;

      const newStages = [...quest.stages];
      [newStages[fromIndex], newStages[toIndex]] = [
        newStages[toIndex],
        newStages[fromIndex],
      ];

      updateQuest(questId, { stages: newStages });
    },
    [data, updateQuest],
  );

  const addStartItem = useCallback(
    (questId: string) => {
      const quest = data[questId];
      if (!quest) return;

      updateQuest(questId, {
        onStart: {
          ...quest.onStart,
          items: [...quest.onStart.items, { itemId: "coins", quantity: 1 }],
        },
      });
    },
    [data, updateQuest],
  );

  const updateStartItem = useCallback(
    (questId: string, itemIndex: number, updates: Partial<ItemReward>) => {
      const quest = data[questId];
      if (!quest) return;

      const newItems = quest.onStart.items.map((item, i) =>
        i === itemIndex ? { ...item, ...updates } : item,
      );

      updateQuest(questId, {
        onStart: { ...quest.onStart, items: newItems },
      });
    },
    [data, updateQuest],
  );

  const deleteStartItem = useCallback(
    (questId: string, itemIndex: number) => {
      const quest = data[questId];
      if (!quest) return;

      updateQuest(questId, {
        onStart: {
          ...quest.onStart,
          items: quest.onStart.items.filter((_, i) => i !== itemIndex),
        },
      });
    },
    [data, updateQuest],
  );

  const addRewardItem = useCallback(
    (questId: string) => {
      const quest = data[questId];
      if (!quest) return;

      updateQuest(questId, {
        rewards: {
          ...quest.rewards,
          items: [...quest.rewards.items, { itemId: "coins", quantity: 1 }],
        },
      });
    },
    [data, updateQuest],
  );

  const updateRewardItem = useCallback(
    (questId: string, itemIndex: number, updates: Partial<ItemReward>) => {
      const quest = data[questId];
      if (!quest) return;

      const newItems = quest.rewards.items.map((item, i) =>
        i === itemIndex ? { ...item, ...updates } : item,
      );

      updateQuest(questId, {
        rewards: { ...quest.rewards, items: newItems },
      });
    },
    [data, updateQuest],
  );

  const deleteRewardItem = useCallback(
    (questId: string, itemIndex: number) => {
      const quest = data[questId];
      if (!quest) return;

      updateQuest(questId, {
        rewards: {
          ...quest.rewards,
          items: quest.rewards.items.filter((_, i) => i !== itemIndex),
        },
      });
    },
    [data, updateQuest],
  );

  const addRewardXp = useCallback(
    (questId: string, skill: string, amount: number) => {
      const quest = data[questId];
      if (!quest) return;

      updateQuest(questId, {
        rewards: {
          ...quest.rewards,
          xp: { ...quest.rewards.xp, [skill]: amount },
        },
      });
    },
    [data, updateQuest],
  );

  const deleteRewardXp = useCallback(
    (questId: string, skill: string) => {
      const quest = data[questId];
      if (!quest) return;

      const { [skill]: _, ...remainingXp } = quest.rewards.xp;
      updateQuest(questId, {
        rewards: { ...quest.rewards, xp: remainingXp },
      });
    },
    [data, updateQuest],
  );

  const createNewQuest = useCallback(() => {
    const newId = `new_quest_${Date.now()}`;
    const newQuest: Quest = {
      id: newId,
      name: "New Quest",
      description: "",
      difficulty: "novice",
      questPoints: 1,
      replayable: false,
      requirements: { quests: [], skills: {}, items: [] },
      startNpc: availableNpcs[0] || "shopkeeper",
      stages: [
        {
          id: "start",
          type: "dialogue",
          description: "Speak to the quest giver",
          npcId: availableNpcs[0] || "shopkeeper",
        },
      ],
      onStart: { items: [], dialogue: "quest_accepted" },
      rewards: { questPoints: 1, items: [], xp: {} },
    };

    const newData = { ...data, [newId]: newQuest };
    onChange(newData);
    setSelectedQuestId(newId);
  }, [data, onChange, availableNpcs]);

  const duplicateQuest = useCallback(
    (questId: string) => {
      const quest = data[questId];
      if (!quest) return;

      const newId = `${quest.id}_copy`;
      const newQuest: Quest = {
        ...JSON.parse(JSON.stringify(quest)),
        id: newId,
        name: `${quest.name} (Copy)`,
      };

      const newData = { ...data, [newId]: newQuest };
      onChange(newData);
      setSelectedQuestId(newId);
    },
    [data, onChange],
  );

  const deleteQuest = useCallback(
    (questId: string) => {
      if (!confirm(`Delete quest "${questId}"?`)) return;

      const { [questId]: _, ...newData } = data;
      onChange(newData);

      if (selectedQuestId === questId) {
        setSelectedQuestId(Object.keys(newData)[0] || null);
      }
    },
    [data, onChange, selectedQuestId],
  );

  const getDifficultyColor = (difficulty: string) => {
    return (
      DIFFICULTIES.find((d) => d.value === difficulty)?.color || "bg-gray-500"
    );
  };

  return (
    <div className="flex h-full">
      {/* Quest list sidebar */}
      <div className="w-72 border-r border-border-primary bg-bg-secondary flex flex-col">
        <div className="p-3 border-b border-border-primary flex items-center justify-between">
          <h3 className="font-medium text-text-primary">Quests</h3>
          <span className="text-xs text-text-muted">{quests.length}</span>
        </div>

        {/* Add quest button */}
        <div className="p-2 border-b border-border-primary">
          <button
            onClick={createNewQuest}
            className="w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-primary bg-opacity-20 text-primary rounded text-xs hover:bg-opacity-30"
          >
            <Plus className="w-3 h-3" />
            New Quest
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {quests.map((quest) => (
            <button
              key={quest.id}
              className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-bg-tertiary transition-colors ${
                selectedQuestId === quest.id
                  ? "bg-primary bg-opacity-10 border-l-2 border-primary"
                  : ""
              }`}
              onClick={() => setSelectedQuestId(quest.id)}
            >
              <Scroll className="w-4 h-4 text-primary" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-text-primary truncate text-sm">
                  {quest.name}
                </div>
                <div className="text-xs text-text-muted flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-white text-[10px] ${getDifficultyColor(quest.difficulty)}`}
                  >
                    {quest.difficulty}
                  </span>
                  <span>{quest.stages.length} stages</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor panel */}
      {selectedQuest ? (
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-bg-secondary border-b border-border-primary p-4 flex items-center justify-between z-10">
            <div>
              <input
                type="text"
                value={selectedQuest.name}
                onChange={(e) =>
                  updateQuest(selectedQuest.id, { name: e.target.value })
                }
                className="text-lg font-semibold text-text-primary bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1"
              />
              <div className="text-xs text-text-muted">
                ID: {selectedQuest.id}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => duplicateQuest(selectedQuest.id)}
                className="p-2 hover:bg-bg-tertiary rounded text-text-secondary"
                title="Duplicate quest"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => deleteQuest(selectedQuest.id)}
                className="p-2 hover:bg-red-500 hover:bg-opacity-20 rounded text-red-400"
                title="Delete quest"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* General Section */}
            <Section
              title="General"
              icon={<Settings className="w-4 h-4" />}
              expanded={expandedSections.has("general")}
              onToggle={() => toggleSection("general")}
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Description">
                  <textarea
                    value={selectedQuest.description}
                    onChange={(e) =>
                      updateQuest(selectedQuest.id, {
                        description: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary resize-none"
                    rows={2}
                  />
                </FormField>

                <FormField label="Difficulty">
                  <select
                    value={selectedQuest.difficulty}
                    onChange={(e) =>
                      updateQuest(selectedQuest.id, {
                        difficulty: e.target.value as Quest["difficulty"],
                      })
                    }
                    className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Quest Points">
                  <input
                    type="number"
                    min="0"
                    value={selectedQuest.questPoints}
                    onChange={(e) =>
                      updateQuest(selectedQuest.id, {
                        questPoints: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  />
                </FormField>

                <FormField label="Start NPC">
                  <select
                    value={selectedQuest.startNpc}
                    onChange={(e) =>
                      updateQuest(selectedQuest.id, {
                        startNpc: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  >
                    {availableNpcs.map((npc) => (
                      <option key={npc} value={npc}>
                        {npc}
                      </option>
                    ))}
                  </select>
                </FormField>

                <div className="col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedQuest.replayable}
                      onChange={(e) =>
                        updateQuest(selectedQuest.id, {
                          replayable: e.target.checked,
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm text-text-primary">
                      Quest can be replayed
                    </span>
                  </label>
                </div>
              </div>
            </Section>

            {/* Quest Stages (Flow Builder) */}
            <Section
              title="Quest Stages"
              icon={<Target className="w-4 h-4" />}
              expanded={expandedSections.has("stages")}
              onToggle={() => toggleSection("stages")}
              badge={selectedQuest.stages.length.toString()}
            >
              <div className="space-y-2">
                <p className="text-xs text-text-muted mb-3">
                  Define the stages players must complete. Stages are completed
                  in order.
                </p>

                {selectedQuest.stages.map((stage, index) => (
                  <QuestStageEditor
                    key={`${stage.id}-${index}`}
                    stage={stage}
                    index={index}
                    totalStages={selectedQuest.stages.length}
                    availableNpcs={availableNpcs}
                    availableMobs={availableMobs}
                    availableItems={availableItems}
                    onChange={(updates) =>
                      updateStage(selectedQuest.id, index, updates)
                    }
                    onDelete={() => deleteStage(selectedQuest.id, index)}
                    onMoveUp={
                      index > 0
                        ? () => moveStage(selectedQuest.id, index, "up")
                        : undefined
                    }
                    onMoveDown={
                      index < selectedQuest.stages.length - 1
                        ? () => moveStage(selectedQuest.id, index, "down")
                        : undefined
                    }
                  />
                ))}

                <button
                  onClick={() => addStage(selectedQuest.id)}
                  className="w-full flex items-center justify-center gap-1 px-3 py-2 bg-primary bg-opacity-10 text-primary rounded text-sm hover:bg-opacity-20 border border-dashed border-primary"
                >
                  <Plus className="w-4 h-4" />
                  Add Stage
                </button>
              </div>
            </Section>

            {/* On Start Section */}
            <Section
              title="On Quest Start"
              icon={<Package className="w-4 h-4" />}
              expanded={expandedSections.has("onstart")}
              onToggle={() => toggleSection("onstart")}
            >
              <div className="space-y-3">
                <p className="text-xs text-text-muted">
                  Items given to the player when they accept the quest.
                </p>

                {selectedQuest.onStart.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-bg-tertiary rounded"
                  >
                    <input
                      type="text"
                      value={item.itemId}
                      onChange={(e) =>
                        updateStartItem(selectedQuest.id, index, {
                          itemId: e.target.value,
                        })
                      }
                      placeholder="Item ID"
                      className="flex-1 px-2 py-1 bg-bg-primary border border-border-primary rounded text-sm text-text-primary"
                    />
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateStartItem(selectedQuest.id, index, {
                          quantity: parseInt(e.target.value, 10),
                        })
                      }
                      className="w-20 px-2 py-1 bg-bg-primary border border-border-primary rounded text-sm text-text-primary"
                    />
                    <button
                      onClick={() => deleteStartItem(selectedQuest.id, index)}
                      className="p-1 text-red-400 hover:bg-red-500 hover:bg-opacity-20 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => addStartItem(selectedQuest.id)}
                  className="text-xs text-primary hover:underline"
                >
                  + Add Start Item
                </button>
              </div>
            </Section>

            {/* Rewards Section */}
            <Section
              title="Rewards"
              icon={<Trophy className="w-4 h-4" />}
              expanded={expandedSections.has("rewards")}
              onToggle={() => toggleSection("rewards")}
            >
              <div className="space-y-4">
                {/* Quest Points */}
                <FormField label="Quest Points Reward">
                  <input
                    type="number"
                    min="0"
                    value={selectedQuest.rewards.questPoints}
                    onChange={(e) =>
                      updateQuest(selectedQuest.id, {
                        rewards: {
                          ...selectedQuest.rewards,
                          questPoints: parseInt(e.target.value, 10),
                        },
                      })
                    }
                    className="w-24 px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  />
                </FormField>

                {/* Item Rewards */}
                <div>
                  <h4 className="text-sm font-medium text-text-primary mb-2">
                    Item Rewards
                  </h4>
                  <div className="space-y-2">
                    {selectedQuest.rewards.items.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 bg-bg-tertiary rounded"
                      >
                        <input
                          type="text"
                          value={item.itemId}
                          onChange={(e) =>
                            updateRewardItem(selectedQuest.id, index, {
                              itemId: e.target.value,
                            })
                          }
                          placeholder="Item ID"
                          className="flex-1 px-2 py-1 bg-bg-primary border border-border-primary rounded text-sm text-text-primary"
                        />
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateRewardItem(selectedQuest.id, index, {
                              quantity: parseInt(e.target.value, 10),
                            })
                          }
                          className="w-20 px-2 py-1 bg-bg-primary border border-border-primary rounded text-sm text-text-primary"
                        />
                        <button
                          onClick={() =>
                            deleteRewardItem(selectedQuest.id, index)
                          }
                          className="p-1 text-red-400 hover:bg-red-500 hover:bg-opacity-20 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addRewardItem(selectedQuest.id)}
                      className="text-xs text-primary hover:underline"
                    >
                      + Add Item Reward
                    </button>
                  </div>
                </div>

                {/* XP Rewards */}
                <div>
                  <h4 className="text-sm font-medium text-text-primary mb-2">
                    XP Rewards
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(selectedQuest.rewards.xp).map(
                      ([skill, amount]) => (
                        <div
                          key={skill}
                          className="flex items-center gap-2 p-2 bg-bg-tertiary rounded"
                        >
                          <span className="flex-1 text-sm text-text-primary capitalize">
                            {skill}
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={amount}
                            onChange={(e) =>
                              addRewardXp(
                                selectedQuest.id,
                                skill,
                                parseInt(e.target.value, 10),
                              )
                            }
                            className="w-24 px-2 py-1 bg-bg-primary border border-border-primary rounded text-sm text-text-primary"
                          />
                          <span className="text-xs text-text-muted">XP</span>
                          <button
                            onClick={() =>
                              deleteRewardXp(selectedQuest.id, skill)
                            }
                            className="p-1 text-red-400 hover:bg-red-500 hover:bg-opacity-20 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ),
                    )}
                    <div className="flex items-center gap-2">
                      <select
                        className="flex-1 px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                        onChange={(e) => {
                          if (e.target.value) {
                            addRewardXp(selectedQuest.id, e.target.value, 100);
                            e.target.value = "";
                          }
                        }}
                        defaultValue=""
                      >
                        <option value="">Add XP reward...</option>
                        {SKILLS.filter(
                          (s) => !(s in selectedQuest.rewards.xp),
                        ).map((skill) => (
                          <option key={skill} value={skill}>
                            {skill}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            {/* Requirements Section */}
            <Section
              title="Requirements"
              icon={<Users className="w-4 h-4" />}
              expanded={expandedSections.has("requirements")}
              onToggle={() => toggleSection("requirements")}
            >
              <p className="text-xs text-text-muted mb-3">
                Prerequisites required to start this quest.
              </p>

              {/* Quest requirements */}
              <FormField label="Required Quests">
                <div className="flex flex-wrap gap-1 mb-2">
                  {selectedQuest.requirements.quests.map((questId, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1 px-2 py-0.5 bg-bg-tertiary rounded text-xs"
                    >
                      {questId}
                      <button
                        onClick={() =>
                          updateQuest(selectedQuest.id, {
                            requirements: {
                              ...selectedQuest.requirements,
                              quests: selectedQuest.requirements.quests.filter(
                                (_, j) => j !== i,
                              ),
                            },
                          })
                        }
                        className="text-text-muted hover:text-red-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <select
                  className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  onChange={(e) => {
                    if (e.target.value) {
                      updateQuest(selectedQuest.id, {
                        requirements: {
                          ...selectedQuest.requirements,
                          quests: [
                            ...selectedQuest.requirements.quests,
                            e.target.value,
                          ],
                        },
                      });
                      e.target.value = "";
                    }
                  }}
                  defaultValue=""
                >
                  <option value="">Add quest requirement...</option>
                  {Object.keys(data)
                    .filter(
                      (q) =>
                        q !== selectedQuest.id &&
                        !selectedQuest.requirements.quests.includes(q),
                    )
                    .map((questId) => (
                      <option key={questId} value={questId}>
                        {data[questId].name}
                      </option>
                    ))}
                </select>
              </FormField>

              {/* Skill requirements */}
              <FormField label="Skill Requirements">
                <div className="space-y-2">
                  {Object.entries(selectedQuest.requirements.skills).map(
                    ([skill, level]) => (
                      <div
                        key={skill}
                        className="flex items-center gap-2 p-2 bg-bg-tertiary rounded"
                      >
                        <span className="flex-1 text-sm text-text-primary capitalize">
                          {skill}
                        </span>
                        <span className="text-xs text-text-muted">Level</span>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={level}
                          onChange={(e) =>
                            updateQuest(selectedQuest.id, {
                              requirements: {
                                ...selectedQuest.requirements,
                                skills: {
                                  ...selectedQuest.requirements.skills,
                                  [skill]: parseInt(e.target.value, 10),
                                },
                              },
                            })
                          }
                          className="w-16 px-2 py-1 bg-bg-primary border border-border-primary rounded text-sm text-text-primary"
                        />
                        <button
                          onClick={() => {
                            const { [skill]: _, ...rest } =
                              selectedQuest.requirements.skills;
                            updateQuest(selectedQuest.id, {
                              requirements: {
                                ...selectedQuest.requirements,
                                skills: rest,
                              },
                            });
                          }}
                          className="p-1 text-red-400 hover:bg-red-500 hover:bg-opacity-20 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ),
                  )}
                  <select
                    className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                    onChange={(e) => {
                      if (e.target.value) {
                        updateQuest(selectedQuest.id, {
                          requirements: {
                            ...selectedQuest.requirements,
                            skills: {
                              ...selectedQuest.requirements.skills,
                              [e.target.value]: 1,
                            },
                          },
                        });
                        e.target.value = "";
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="">Add skill requirement...</option>
                    {SKILLS.filter(
                      (s) => !(s in selectedQuest.requirements.skills),
                    ).map((skill) => (
                      <option key={skill} value={skill}>
                        {skill}
                      </option>
                    ))}
                  </select>
                </div>
              </FormField>
            </Section>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-text-muted">
          Select a quest to edit
        </div>
      )}
    </div>
  );
};

// Section component
interface SectionProps {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({
  title,
  icon,
  expanded,
  onToggle,
  badge,
  children,
}) => (
  <div className="border border-border-primary rounded-lg overflow-hidden">
    <button
      className="w-full px-4 py-3 bg-bg-secondary flex items-center gap-2 hover:bg-bg-tertiary transition-colors"
      onClick={onToggle}
    >
      {expanded ? (
        <ChevronDown className="w-4 h-4 text-text-muted" />
      ) : (
        <ChevronRight className="w-4 h-4 text-text-muted" />
      )}
      <span className="text-text-secondary">{icon}</span>
      <span className="font-medium text-text-primary">{title}</span>
      {badge && (
        <span className="ml-auto px-2 py-0.5 bg-primary bg-opacity-20 text-primary text-xs rounded-full">
          {badge}
        </span>
      )}
    </button>
    {expanded && <div className="p-4 bg-bg-primary">{children}</div>}
  </div>
);

// Form field component
interface FormFieldProps {
  label: string;
  children: React.ReactNode;
}

const FormField: React.FC<FormFieldProps> = ({ label, children }) => (
  <div className="space-y-1">
    <label className="text-xs text-text-secondary font-medium">{label}</label>
    {children}
  </div>
);

// Quest stage editor
interface QuestStageEditorProps {
  stage: QuestStage;
  index: number;
  totalStages: number;
  availableNpcs: string[];
  availableMobs: string[];
  availableItems: string[];
  onChange: (updates: Partial<QuestStage>) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

const QuestStageEditor: React.FC<QuestStageEditorProps> = ({
  stage,
  index,
  totalStages,
  availableNpcs,
  availableMobs,
  availableItems: _availableItems,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}) => {
  const [expanded, setExpanded] = useState(false);
  const StageIcon =
    STAGE_TYPES.find((t) => t.value === stage.type)?.icon || Target;

  return (
    <div className="relative">
      {/* Connection line */}
      {index < totalStages - 1 && (
        <div className="absolute left-6 top-full h-2 w-0.5 bg-border-primary z-0" />
      )}

      <div className="border border-border-primary rounded bg-bg-secondary relative z-10">
        <div className="px-3 py-2 flex items-center gap-2">
          <div className="flex flex-col">
            {onMoveUp && (
              <button
                onClick={onMoveUp}
                className="text-text-muted hover:text-text-primary"
                title="Move up"
              >
                <ChevronRight className="w-3 h-3 -rotate-90" />
              </button>
            )}
            {onMoveDown && (
              <button
                onClick={onMoveDown}
                className="text-text-muted hover:text-text-primary"
                title="Move down"
              >
                <ChevronRight className="w-3 h-3 rotate-90" />
              </button>
            )}
          </div>

          <div className="w-6 h-6 rounded-full bg-primary bg-opacity-20 flex items-center justify-center text-xs text-primary font-medium">
            {index + 1}
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-1 flex items-center gap-2 text-left"
          >
            <StageIcon className="w-4 h-4 text-text-secondary" />
            <span className="font-medium text-text-primary text-sm capitalize">
              {stage.type}
            </span>
            <span className="text-xs text-text-muted truncate flex-1">
              {stage.description}
            </span>
          </button>

          <button
            onClick={onDelete}
            className="p-1 hover:bg-red-500 hover:bg-opacity-20 rounded text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {expanded && (
          <div className="px-3 pb-3 pt-1 border-t border-border-primary space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Stage ID">
                <input
                  type="text"
                  value={stage.id}
                  onChange={(e) => onChange({ id: e.target.value })}
                  className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary font-mono"
                />
              </FormField>

              <FormField label="Type">
                <select
                  value={stage.type}
                  onChange={(e) =>
                    onChange({ type: e.target.value as QuestStage["type"] })
                  }
                  className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                >
                  {STAGE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <FormField label="Description">
              <input
                type="text"
                value={stage.description}
                onChange={(e) => onChange({ description: e.target.value })}
                className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
              />
            </FormField>

            {/* Type-specific fields */}
            {stage.type === "dialogue" && (
              <FormField label="NPC">
                <select
                  value={stage.npcId || ""}
                  onChange={(e) => onChange({ npcId: e.target.value })}
                  className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                >
                  {availableNpcs.map((npc) => (
                    <option key={npc} value={npc}>
                      {npc}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            {stage.type === "kill" && (
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Target Mob">
                  <select
                    value={stage.target || ""}
                    onChange={(e) => onChange({ target: e.target.value })}
                    className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  >
                    {availableMobs.map((mob) => (
                      <option key={mob} value={mob}>
                        {mob}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Count">
                  <input
                    type="number"
                    min="1"
                    value={stage.count || 1}
                    onChange={(e) =>
                      onChange({ count: parseInt(e.target.value, 10) })
                    }
                    className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  />
                </FormField>
              </div>
            )}

            {(stage.type === "gather" || stage.type === "interact") && (
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Target">
                  <input
                    type="text"
                    value={stage.target || ""}
                    onChange={(e) => onChange({ target: e.target.value })}
                    placeholder="Item or object ID"
                    className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  />
                </FormField>
                <FormField label="Count">
                  <input
                    type="number"
                    min="1"
                    value={stage.count || 1}
                    onChange={(e) =>
                      onChange({ count: parseInt(e.target.value, 10) })
                    }
                    className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  />
                </FormField>
              </div>
            )}

            {stage.type === "location" && (
              <div className="grid grid-cols-3 gap-3">
                <FormField label="X">
                  <input
                    type="number"
                    value={stage.location?.x || 0}
                    onChange={(e) =>
                      onChange({
                        location: {
                          ...(stage.location || { x: 0, z: 0, radius: 10 }),
                          x: parseInt(e.target.value, 10),
                        },
                      })
                    }
                    className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  />
                </FormField>
                <FormField label="Z">
                  <input
                    type="number"
                    value={stage.location?.z || 0}
                    onChange={(e) =>
                      onChange({
                        location: {
                          ...(stage.location || { x: 0, z: 0, radius: 10 }),
                          z: parseInt(e.target.value, 10),
                        },
                      })
                    }
                    className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  />
                </FormField>
                <FormField label="Radius">
                  <input
                    type="number"
                    min="1"
                    value={stage.location?.radius || 10}
                    onChange={(e) =>
                      onChange({
                        location: {
                          ...(stage.location || { x: 0, z: 0, radius: 10 }),
                          radius: parseInt(e.target.value, 10),
                        },
                      })
                    }
                    className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  />
                </FormField>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestsEditor;
