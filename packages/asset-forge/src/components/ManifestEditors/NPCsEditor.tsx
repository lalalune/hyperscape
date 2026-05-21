/**
 * NPCsEditor
 * Visual editor for npcs.json with stats, dialogue, drops, and appearance
 */

import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Skull,
  Heart,
  Swords,
  MessageSquare,
  Package,
  User,
  Settings,
  Copy,
  Eye,
} from "lucide-react";
import React, { useState, useCallback } from "react";

// Types based on npcs.json structure
interface Stats {
  level: number;
  health: number;
  attack: number;
  strength: number;
  defense: number;
  defenseBonus: number;
  ranged: number;
  magic: number;
}

interface LevelRange {
  min: number;
  max: number;
}

interface CombatConfig {
  attackable: boolean;
  aggressive?: boolean;
  retaliates?: boolean;
  aggroRange?: number;
  combatRange?: number;
  leashRange?: number;
  attackSpeedTicks?: number;
  respawnTicks?: number;
}

interface MovementConfig {
  type: "wander" | "stationary" | "patrol";
  speed: number;
  wanderRadius: number;
}

interface Drop {
  itemId: string;
  minQuantity: number;
  maxQuantity: number;
  chance: number;
  rarity: string;
}

interface DropsConfig {
  defaultDrop?: {
    enabled: boolean;
    itemId: string;
    quantity: number;
  };
  always: Drop[];
  common: Drop[];
  uncommon: Drop[];
  rare: Drop[];
  veryRare: Drop[];
}

interface DialogueResponse {
  text: string;
  nextNodeId?: string;
  effect?: string;
}

interface DialogueNode {
  id: string;
  text: string;
  responses?: DialogueResponse[];
  effect?: string;
}

interface DialogueConfig {
  entryNodeId: string;
  questOverrides?: Record<string, Record<string, string>>;
  nodes: DialogueNode[];
}

interface ServicesConfig {
  enabled: boolean;
  types: string[];
}

interface AppearanceConfig {
  modelPath: string;
  iconPath: string;
  scale: number;
}

interface NPC {
  id: string;
  name: string;
  description: string;
  category: "mob" | "neutral";
  faction: string;
  levelRange?: LevelRange;
  stats?: Stats;
  combat: CombatConfig;
  movement: MovementConfig;
  drops?: DropsConfig;
  services?: ServicesConfig;
  dialogue?: DialogueConfig;
  appearance: AppearanceConfig;
  spawnBiomes?: string[];
}

interface NPCsEditorProps {
  npcs: NPC[];
  onChange: (npcs: NPC[]) => void;
  availableBiomes: string[];
  availableItems: string[];
}

const FACTIONS = ["monster", "town", "neutral", "hostile"];
const SERVICE_TYPES = ["bank", "shop", "quest", "heal"];
const _DROP_RARITIES = ["common", "uncommon", "rare", "very_rare"];

const CATEGORY_COLORS: Record<string, string> = {
  mob: "bg-red-500",
  neutral: "bg-blue-500",
};

export const NPCsEditor: React.FC<NPCsEditorProps> = ({
  npcs,
  onChange,
  availableBiomes,
  availableItems: _availableItems,
}) => {
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(
    npcs[0]?.id || null,
  );
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["general", "stats", "combat"]),
  );
  const [filter, setFilter] = useState<"all" | "mob" | "neutral">("all");

  const selectedNpc = npcs.find((n) => n.id === selectedNpcId);
  const filteredNpcs =
    filter === "all" ? npcs : npcs.filter((n) => n.category === filter);

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

  const updateNpc = useCallback(
    (npcId: string, updates: Partial<NPC>) => {
      const newNpcs = npcs.map((n) =>
        n.id === npcId ? { ...n, ...updates } : n,
      );
      onChange(newNpcs);
    },
    [npcs, onChange],
  );

  const updateStats = useCallback(
    (npcId: string, updates: Partial<Stats>) => {
      const npc = npcs.find((n) => n.id === npcId);
      if (!npc || !npc.stats) return;

      updateNpc(npcId, {
        stats: { ...npc.stats, ...updates },
      });
    },
    [npcs, updateNpc],
  );

  const updateCombat = useCallback(
    (npcId: string, updates: Partial<CombatConfig>) => {
      const npc = npcs.find((n) => n.id === npcId);
      if (!npc) return;

      updateNpc(npcId, {
        combat: { ...npc.combat, ...updates },
      });
    },
    [npcs, updateNpc],
  );

  const updateMovement = useCallback(
    (npcId: string, updates: Partial<MovementConfig>) => {
      const npc = npcs.find((n) => n.id === npcId);
      if (!npc) return;

      updateNpc(npcId, {
        movement: { ...npc.movement, ...updates },
      });
    },
    [npcs, updateNpc],
  );

  const updateAppearance = useCallback(
    (npcId: string, updates: Partial<AppearanceConfig>) => {
      const npc = npcs.find((n) => n.id === npcId);
      if (!npc) return;

      updateNpc(npcId, {
        appearance: { ...npc.appearance, ...updates },
      });
    },
    [npcs, updateNpc],
  );

  const updateLevelRange = useCallback(
    (npcId: string, updates: Partial<LevelRange>) => {
      const npc = npcs.find((n) => n.id === npcId);
      if (!npc) return;

      updateNpc(npcId, {
        levelRange: { ...(npc.levelRange || { min: 1, max: 1 }), ...updates },
      });
    },
    [npcs, updateNpc],
  );

  const addDialogueNode = useCallback(
    (npcId: string) => {
      const npc = npcs.find((n) => n.id === npcId);
      if (!npc || !npc.dialogue) return;

      const newNode: DialogueNode = {
        id: `node_${npc.dialogue.nodes.length + 1}`,
        text: "New dialogue...",
        responses: [],
      };

      updateNpc(npcId, {
        dialogue: {
          ...npc.dialogue,
          nodes: [...npc.dialogue.nodes, newNode],
        },
      });
    },
    [npcs, updateNpc],
  );

  const updateDialogueNode = useCallback(
    (npcId: string, nodeIndex: number, updates: Partial<DialogueNode>) => {
      const npc = npcs.find((n) => n.id === npcId);
      if (!npc || !npc.dialogue) return;

      const newNodes = npc.dialogue.nodes.map((node, i) =>
        i === nodeIndex ? { ...node, ...updates } : node,
      );

      updateNpc(npcId, {
        dialogue: { ...npc.dialogue, nodes: newNodes },
      });
    },
    [npcs, updateNpc],
  );

  const deleteDialogueNode = useCallback(
    (npcId: string, nodeIndex: number) => {
      const npc = npcs.find((n) => n.id === npcId);
      if (!npc || !npc.dialogue) return;

      updateNpc(npcId, {
        dialogue: {
          ...npc.dialogue,
          nodes: npc.dialogue.nodes.filter((_, i) => i !== nodeIndex),
        },
      });
    },
    [npcs, updateNpc],
  );

  const addDrop = useCallback(
    (npcId: string, rarity: keyof DropsConfig) => {
      const npc = npcs.find((n) => n.id === npcId);
      if (!npc || !npc.drops) return;

      const newDrop: Drop = {
        itemId: "coins",
        minQuantity: 1,
        maxQuantity: 1,
        chance: 0.5,
        rarity,
      };

      const drops = npc.drops[rarity] as Drop[];
      updateNpc(npcId, {
        drops: {
          ...npc.drops,
          [rarity]: [...drops, newDrop],
        },
      });
    },
    [npcs, updateNpc],
  );

  const updateDrop = useCallback(
    (
      npcId: string,
      rarity: keyof DropsConfig,
      dropIndex: number,
      updates: Partial<Drop>,
    ) => {
      const npc = npcs.find((n) => n.id === npcId);
      if (!npc || !npc.drops) return;

      const drops = npc.drops[rarity] as Drop[];
      const newDrops = drops.map((drop, i) =>
        i === dropIndex ? { ...drop, ...updates } : drop,
      );

      updateNpc(npcId, {
        drops: { ...npc.drops, [rarity]: newDrops },
      });
    },
    [npcs, updateNpc],
  );

  const deleteDrop = useCallback(
    (npcId: string, rarity: keyof DropsConfig, dropIndex: number) => {
      const npc = npcs.find((n) => n.id === npcId);
      if (!npc || !npc.drops) return;

      const drops = npc.drops[rarity] as Drop[];
      updateNpc(npcId, {
        drops: {
          ...npc.drops,
          [rarity]: drops.filter((_, i) => i !== dropIndex),
        },
      });
    },
    [npcs, updateNpc],
  );

  const duplicateNpc = useCallback(
    (npcId: string) => {
      const npc = npcs.find((n) => n.id === npcId);
      if (!npc) return;

      const newNpc: NPC = {
        ...JSON.parse(JSON.stringify(npc)),
        id: `${npc.id}_copy`,
        name: `${npc.name} (Copy)`,
      };

      onChange([...npcs, newNpc]);
      setSelectedNpcId(newNpc.id);
    },
    [npcs, onChange],
  );

  const deleteNpc = useCallback(
    (npcId: string) => {
      if (!confirm(`Delete NPC "${npcId}"?`)) return;

      const newNpcs = npcs.filter((n) => n.id !== npcId);
      onChange(newNpcs);

      if (selectedNpcId === npcId) {
        setSelectedNpcId(newNpcs[0]?.id || null);
      }
    },
    [npcs, onChange, selectedNpcId],
  );

  const createNewNpc = useCallback(
    (category: "mob" | "neutral") => {
      const newNpc: NPC = {
        id: `new_${category}_${Date.now()}`,
        name: `New ${category === "mob" ? "Mob" : "NPC"}`,
        description: "",
        category,
        faction: category === "mob" ? "monster" : "town",
        combat: {
          attackable: category === "mob",
          aggressive: false,
          retaliates: category === "mob",
        },
        movement: {
          type: category === "mob" ? "wander" : "stationary",
          speed: category === "mob" ? 3 : 0,
          wanderRadius: category === "mob" ? 5 : 0,
        },
        appearance: {
          modelPath: "asset://avatars/avatar-male-01.vrm",
          iconPath: "asset://icons/npcs/default.png",
          scale: 1.0,
        },
      };

      if (category === "mob") {
        newNpc.stats = {
          level: 1,
          health: 10,
          attack: 1,
          strength: 1,
          defense: 1,
          defenseBonus: 0,
          ranged: 1,
          magic: 1,
        };
        newNpc.levelRange = { min: 1, max: 5 };
        newNpc.drops = {
          always: [],
          common: [],
          uncommon: [],
          rare: [],
          veryRare: [],
        };
        newNpc.spawnBiomes = [];
      } else {
        newNpc.dialogue = {
          entryNodeId: "greeting",
          nodes: [
            {
              id: "greeting",
              text: "Hello, adventurer!",
              responses: [{ text: "Goodbye.", nextNodeId: "farewell" }],
            },
            {
              id: "farewell",
              text: "Safe travels!",
            },
          ],
        };
      }

      onChange([...npcs, newNpc]);
      setSelectedNpcId(newNpc.id);
    },
    [npcs, onChange],
  );

  return (
    <div className="flex h-full">
      {/* NPC list sidebar */}
      <div className="w-72 border-r border-border-primary bg-bg-secondary flex flex-col">
        <div className="p-3 border-b border-border-primary">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-text-primary">NPCs</h3>
            <span className="text-xs text-text-muted">{npcs.length}</span>
          </div>
          {/* Filter tabs */}
          <div className="flex gap-1">
            {(["all", "mob", "neutral"] as const).map((f) => (
              <button
                key={f}
                className={`flex-1 px-2 py-1 text-xs rounded ${
                  filter === f
                    ? "bg-primary bg-opacity-20 text-primary"
                    : "text-text-secondary hover:bg-bg-tertiary"
                }`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Add buttons */}
        <div className="p-2 border-b border-border-primary flex gap-2">
          <button
            onClick={() => createNewNpc("mob")}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-red-500 bg-opacity-20 text-red-400 rounded text-xs hover:bg-opacity-30"
          >
            <Skull className="w-3 h-3" />
            Add Mob
          </button>
          <button
            onClick={() => createNewNpc("neutral")}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-500 bg-opacity-20 text-blue-400 rounded text-xs hover:bg-opacity-30"
          >
            <User className="w-3 h-3" />
            Add NPC
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredNpcs.map((npc) => (
            <button
              key={npc.id}
              className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-bg-tertiary transition-colors ${
                selectedNpcId === npc.id
                  ? "bg-primary bg-opacity-10 border-l-2 border-primary"
                  : ""
              }`}
              onClick={() => setSelectedNpcId(npc.id)}
            >
              <div
                className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[npc.category]}`}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-text-primary truncate text-sm">
                  {npc.name}
                </div>
                <div className="text-xs text-text-muted flex items-center gap-2">
                  <span>{npc.category}</span>
                  {npc.stats && (
                    <span className="flex items-center gap-0.5">
                      <Heart className="w-3 h-3" />
                      {npc.stats.health}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor panel */}
      {selectedNpc ? (
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-bg-secondary border-b border-border-primary p-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${CATEGORY_COLORS[selectedNpc.category]}`}
              />
              <div>
                <input
                  type="text"
                  value={selectedNpc.name}
                  onChange={(e) =>
                    updateNpc(selectedNpc.id, { name: e.target.value })
                  }
                  className="text-lg font-semibold text-text-primary bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1"
                />
                <div className="text-xs text-text-muted">
                  ID: {selectedNpc.id}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => duplicateNpc(selectedNpc.id)}
                className="p-2 hover:bg-bg-tertiary rounded text-text-secondary"
                title="Duplicate NPC"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => deleteNpc(selectedNpc.id)}
                className="p-2 hover:bg-red-500 hover:bg-opacity-20 rounded text-red-400"
                title="Delete NPC"
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
                    value={selectedNpc.description}
                    onChange={(e) =>
                      updateNpc(selectedNpc.id, { description: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary resize-none"
                    rows={2}
                  />
                </FormField>

                <FormField label="Faction">
                  <select
                    value={selectedNpc.faction}
                    onChange={(e) =>
                      updateNpc(selectedNpc.id, { faction: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  >
                    {FACTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </FormField>

                {selectedNpc.category === "mob" && selectedNpc.levelRange && (
                  <FormField label="Level Range">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={selectedNpc.levelRange.min}
                        onChange={(e) =>
                          updateLevelRange(selectedNpc.id, {
                            min: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-20 px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                      />
                      <span className="text-text-muted">to</span>
                      <input
                        type="number"
                        min="1"
                        value={selectedNpc.levelRange.max}
                        onChange={(e) =>
                          updateLevelRange(selectedNpc.id, {
                            max: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-20 px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                      />
                    </div>
                  </FormField>
                )}

                {selectedNpc.category === "mob" && (
                  <FormField label="Spawn Biomes">
                    <div className="flex flex-wrap gap-1">
                      {(selectedNpc.spawnBiomes || []).map((biome) => (
                        <span
                          key={biome}
                          className="flex items-center gap-1 px-2 py-0.5 bg-bg-tertiary rounded text-xs"
                        >
                          {biome}
                          <button
                            onClick={() =>
                              updateNpc(selectedNpc.id, {
                                spawnBiomes: (
                                  selectedNpc.spawnBiomes || []
                                ).filter((b) => b !== biome),
                              })
                            }
                            className="text-text-muted hover:text-red-400"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <select
                        className="px-2 py-0.5 bg-bg-tertiary border border-border-primary rounded text-xs text-text-primary"
                        onChange={(e) => {
                          if (e.target.value) {
                            updateNpc(selectedNpc.id, {
                              spawnBiomes: [
                                ...(selectedNpc.spawnBiomes || []),
                                e.target.value,
                              ],
                            });
                            e.target.value = "";
                          }
                        }}
                        defaultValue=""
                      >
                        <option value="">Add...</option>
                        {availableBiomes
                          .filter(
                            (b) => !(selectedNpc.spawnBiomes || []).includes(b),
                          )
                          .map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                      </select>
                    </div>
                  </FormField>
                )}
              </div>
            </Section>

            {/* Stats Section (mobs only) */}
            {selectedNpc.stats && (
              <Section
                title="Stats"
                icon={<Heart className="w-4 h-4" />}
                expanded={expandedSections.has("stats")}
                onToggle={() => toggleSection("stats")}
              >
                <div className="grid grid-cols-4 gap-3">
                  {(
                    Object.entries(selectedNpc.stats) as [keyof Stats, number][]
                  ).map(([key, value]) => (
                    <FormField key={key} label={key}>
                      <input
                        type="number"
                        value={value}
                        onChange={(e) =>
                          updateStats(selectedNpc.id, {
                            [key]: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                      />
                    </FormField>
                  ))}
                </div>
              </Section>
            )}

            {/* Combat Section */}
            <Section
              title="Combat"
              icon={<Swords className="w-4 h-4" />}
              expanded={expandedSections.has("combat")}
              onToggle={() => toggleSection("combat")}
            >
              <div className="space-y-3">
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedNpc.combat.attackable}
                      onChange={(e) =>
                        updateCombat(selectedNpc.id, {
                          attackable: e.target.checked,
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm text-text-primary">
                      Attackable
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedNpc.combat.aggressive || false}
                      onChange={(e) =>
                        updateCombat(selectedNpc.id, {
                          aggressive: e.target.checked,
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm text-text-primary">
                      Aggressive
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedNpc.combat.retaliates || false}
                      onChange={(e) =>
                        updateCombat(selectedNpc.id, {
                          retaliates: e.target.checked,
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm text-text-primary">
                      Retaliates
                    </span>
                  </label>
                </div>

                {selectedNpc.combat.attackable && (
                  <div className="grid grid-cols-3 gap-3">
                    <FormField label="Aggro Range">
                      <input
                        type="number"
                        value={selectedNpc.combat.aggroRange || 0}
                        onChange={(e) =>
                          updateCombat(selectedNpc.id, {
                            aggroRange: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                      />
                    </FormField>
                    <FormField label="Combat Range">
                      <input
                        type="number"
                        value={selectedNpc.combat.combatRange || 1}
                        onChange={(e) =>
                          updateCombat(selectedNpc.id, {
                            combatRange: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                      />
                    </FormField>
                    <FormField label="Leash Range">
                      <input
                        type="number"
                        value={selectedNpc.combat.leashRange || 0}
                        onChange={(e) =>
                          updateCombat(selectedNpc.id, {
                            leashRange: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                      />
                    </FormField>
                    <FormField label="Attack Speed (ticks)">
                      <input
                        type="number"
                        value={selectedNpc.combat.attackSpeedTicks || 4}
                        onChange={(e) =>
                          updateCombat(selectedNpc.id, {
                            attackSpeedTicks: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                      />
                    </FormField>
                    <FormField label="Respawn (ticks)">
                      <input
                        type="number"
                        value={selectedNpc.combat.respawnTicks || 30}
                        onChange={(e) =>
                          updateCombat(selectedNpc.id, {
                            respawnTicks: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                      />
                    </FormField>
                  </div>
                )}
              </div>
            </Section>

            {/* Movement Section */}
            <Section
              title="Movement"
              icon={<Settings className="w-4 h-4" />}
              expanded={expandedSections.has("movement")}
              onToggle={() => toggleSection("movement")}
            >
              <div className="grid grid-cols-3 gap-3">
                <FormField label="Type">
                  <select
                    value={selectedNpc.movement.type}
                    onChange={(e) =>
                      updateMovement(selectedNpc.id, {
                        type: e.target.value as MovementConfig["type"],
                      })
                    }
                    className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  >
                    <option value="stationary">Stationary</option>
                    <option value="wander">Wander</option>
                    <option value="patrol">Patrol</option>
                  </select>
                </FormField>
                <FormField label="Speed">
                  <input
                    type="number"
                    step="0.5"
                    value={selectedNpc.movement.speed}
                    onChange={(e) =>
                      updateMovement(selectedNpc.id, {
                        speed: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  />
                </FormField>
                <FormField label="Wander Radius">
                  <input
                    type="number"
                    value={selectedNpc.movement.wanderRadius}
                    onChange={(e) =>
                      updateMovement(selectedNpc.id, {
                        wanderRadius: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  />
                </FormField>
              </div>
            </Section>

            {/* Appearance Section */}
            <Section
              title="Appearance"
              icon={<Eye className="w-4 h-4" />}
              expanded={expandedSections.has("appearance")}
              onToggle={() => toggleSection("appearance")}
            >
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Model Path">
                  <input
                    type="text"
                    value={selectedNpc.appearance.modelPath}
                    onChange={(e) =>
                      updateAppearance(selectedNpc.id, {
                        modelPath: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  />
                </FormField>
                <FormField label="Icon Path">
                  <input
                    type="text"
                    value={selectedNpc.appearance.iconPath}
                    onChange={(e) =>
                      updateAppearance(selectedNpc.id, {
                        iconPath: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  />
                </FormField>
                <FormField label="Scale">
                  <input
                    type="number"
                    step="0.1"
                    value={selectedNpc.appearance.scale}
                    onChange={(e) =>
                      updateAppearance(selectedNpc.id, {
                        scale: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  />
                </FormField>
              </div>
            </Section>

            {/* Drops Section (mobs only) */}
            {selectedNpc.drops && (
              <Section
                title="Drops"
                icon={<Package className="w-4 h-4" />}
                expanded={expandedSections.has("drops")}
                onToggle={() => toggleSection("drops")}
              >
                <div className="space-y-4">
                  {(["common", "uncommon", "rare", "veryRare"] as const).map(
                    (rarity) => (
                      <div key={rarity}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-text-primary capitalize">
                            {rarity.replace("veryRare", "Very Rare")}
                          </h4>
                          <button
                            onClick={() => addDrop(selectedNpc.id, rarity)}
                            className="text-xs text-primary hover:underline"
                          >
                            + Add
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(selectedNpc.drops![rarity] as Drop[]).map(
                            (drop, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-2 p-2 bg-bg-tertiary rounded"
                              >
                                <input
                                  type="text"
                                  value={drop.itemId}
                                  onChange={(e) =>
                                    updateDrop(selectedNpc.id, rarity, index, {
                                      itemId: e.target.value,
                                    })
                                  }
                                  placeholder="Item ID"
                                  className="flex-1 px-2 py-1 bg-bg-primary border border-border-primary rounded text-xs text-text-primary"
                                />
                                <input
                                  type="number"
                                  value={drop.minQuantity}
                                  onChange={(e) =>
                                    updateDrop(selectedNpc.id, rarity, index, {
                                      minQuantity: parseInt(e.target.value, 10),
                                    })
                                  }
                                  className="w-16 px-2 py-1 bg-bg-primary border border-border-primary rounded text-xs text-text-primary"
                                  title="Min Qty"
                                />
                                <span className="text-text-muted text-xs">
                                  -
                                </span>
                                <input
                                  type="number"
                                  value={drop.maxQuantity}
                                  onChange={(e) =>
                                    updateDrop(selectedNpc.id, rarity, index, {
                                      maxQuantity: parseInt(e.target.value, 10),
                                    })
                                  }
                                  className="w-16 px-2 py-1 bg-bg-primary border border-border-primary rounded text-xs text-text-primary"
                                  title="Max Qty"
                                />
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="1"
                                  value={drop.chance}
                                  onChange={(e) =>
                                    updateDrop(selectedNpc.id, rarity, index, {
                                      chance: parseFloat(e.target.value),
                                    })
                                  }
                                  className="w-20 px-2 py-1 bg-bg-primary border border-border-primary rounded text-xs text-text-primary"
                                  title="Chance (0-1)"
                                />
                                <button
                                  onClick={() =>
                                    deleteDrop(selectedNpc.id, rarity, index)
                                  }
                                  className="p-1 text-red-400 hover:bg-red-500 hover:bg-opacity-20 rounded"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </Section>
            )}

            {/* Dialogue Section (neutral NPCs) */}
            {selectedNpc.dialogue && (
              <Section
                title="Dialogue"
                icon={<MessageSquare className="w-4 h-4" />}
                expanded={expandedSections.has("dialogue")}
                onToggle={() => toggleSection("dialogue")}
                badge={selectedNpc.dialogue.nodes.length.toString()}
              >
                <div className="space-y-4">
                  <FormField label="Entry Node ID">
                    <select
                      value={selectedNpc.dialogue.entryNodeId}
                      onChange={(e) =>
                        updateNpc(selectedNpc.id, {
                          dialogue: {
                            ...selectedNpc.dialogue!,
                            entryNodeId: e.target.value,
                          },
                        })
                      }
                      className="w-48 px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                    >
                      {selectedNpc.dialogue.nodes.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.id}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-text-primary">
                      Dialogue Nodes
                    </h4>
                    <button
                      onClick={() => addDialogueNode(selectedNpc.id)}
                      className="flex items-center gap-1 px-2 py-1 bg-primary bg-opacity-20 text-primary rounded text-xs hover:bg-opacity-30"
                    >
                      <Plus className="w-3 h-3" />
                      Add Node
                    </button>
                  </div>

                  <div className="space-y-3">
                    {selectedNpc.dialogue.nodes.map((node, index) => (
                      <DialogueNodeEditor
                        key={node.id}
                        node={node}
                        allNodeIds={selectedNpc.dialogue!.nodes.map(
                          (n) => n.id,
                        )}
                        onChange={(updates) =>
                          updateDialogueNode(selectedNpc.id, index, updates)
                        }
                        onDelete={() =>
                          deleteDialogueNode(selectedNpc.id, index)
                        }
                      />
                    ))}
                  </div>
                </div>
              </Section>
            )}

            {/* Services Section (neutral NPCs with services) */}
            {selectedNpc.services && (
              <Section
                title="Services"
                icon={<Settings className="w-4 h-4" />}
                expanded={expandedSections.has("services")}
                onToggle={() => toggleSection("services")}
              >
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedNpc.services.enabled}
                      onChange={(e) =>
                        updateNpc(selectedNpc.id, {
                          services: {
                            ...selectedNpc.services!,
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm text-text-primary">
                      Enable services
                    </span>
                  </label>

                  <FormField label="Service Types">
                    <div className="flex flex-wrap gap-2">
                      {SERVICE_TYPES.map((st) => (
                        <label
                          key={st}
                          className="flex items-center gap-1 px-2 py-1 bg-bg-tertiary rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedNpc.services!.types.includes(st)}
                            onChange={(e) => {
                              const newTypes = e.target.checked
                                ? [...selectedNpc.services!.types, st]
                                : selectedNpc.services!.types.filter(
                                    (t) => t !== st,
                                  );
                              updateNpc(selectedNpc.id, {
                                services: {
                                  ...selectedNpc.services!,
                                  types: newTypes,
                                },
                              });
                            }}
                            className="rounded"
                          />
                          <span className="text-sm text-text-primary">
                            {st}
                          </span>
                        </label>
                      ))}
                    </div>
                  </FormField>
                </div>
              </Section>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-text-muted">
          Select an NPC to edit
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

// Dialogue node editor
interface DialogueNodeEditorProps {
  node: DialogueNode;
  allNodeIds: string[];
  onChange: (updates: Partial<DialogueNode>) => void;
  onDelete: () => void;
}

const DialogueNodeEditor: React.FC<DialogueNodeEditorProps> = ({
  node,
  allNodeIds,
  onChange,
  onDelete,
}) => {
  const [expanded, setExpanded] = useState(false);

  const addResponse = () => {
    onChange({
      responses: [
        ...(node.responses || []),
        { text: "New response...", nextNodeId: undefined },
      ],
    });
  };

  const updateResponse = (
    index: number,
    updates: Partial<DialogueResponse>,
  ) => {
    const newResponses = (node.responses || []).map((r, i) =>
      i === index ? { ...r, ...updates } : r,
    );
    onChange({ responses: newResponses });
  };

  const deleteResponse = (index: number) => {
    onChange({
      responses: (node.responses || []).filter((_, i) => i !== index),
    });
  };

  return (
    <div className="border border-border-primary rounded bg-bg-secondary">
      <div className="px-3 py-2 flex items-center gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center gap-2 text-left"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-text-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-muted" />
          )}
          <span className="font-mono text-sm text-primary">{node.id}</span>
          <span className="text-xs text-text-muted truncate flex-1">
            {node.text.slice(0, 40)}...
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
            <FormField label="Node ID">
              <input
                type="text"
                value={node.id}
                onChange={(e) => onChange({ id: e.target.value })}
                className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary font-mono"
              />
            </FormField>
            <FormField label="Effect">
              <input
                type="text"
                value={node.effect || ""}
                onChange={(e) =>
                  onChange({ effect: e.target.value || undefined })
                }
                placeholder="e.g., openBank, startQuest:id"
                className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
              />
            </FormField>
          </div>

          <FormField label="Text">
            <textarea
              value={node.text}
              onChange={(e) => onChange({ text: e.target.value })}
              className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary resize-none"
              rows={2}
            />
          </FormField>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-secondary font-medium">
                Responses
              </span>
              <button
                onClick={addResponse}
                className="text-xs text-primary hover:underline"
              >
                + Add Response
              </button>
            </div>
            <div className="space-y-2">
              {(node.responses || []).map((response, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 bg-bg-tertiary rounded"
                >
                  <input
                    type="text"
                    value={response.text}
                    onChange={(e) =>
                      updateResponse(index, { text: e.target.value })
                    }
                    placeholder="Response text"
                    className="flex-1 px-2 py-1 bg-bg-primary border border-border-primary rounded text-xs text-text-primary"
                  />
                  <select
                    value={response.nextNodeId || ""}
                    onChange={(e) =>
                      updateResponse(index, {
                        nextNodeId: e.target.value || undefined,
                      })
                    }
                    className="w-32 px-2 py-1 bg-bg-primary border border-border-primary rounded text-xs text-text-primary"
                  >
                    <option value="">End</option>
                    {allNodeIds.map((id) => (
                      <option key={id} value={id}>
                        → {id}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={response.effect || ""}
                    onChange={(e) =>
                      updateResponse(index, {
                        effect: e.target.value || undefined,
                      })
                    }
                    placeholder="Effect"
                    className="w-28 px-2 py-1 bg-bg-primary border border-border-primary rounded text-xs text-text-primary"
                  />
                  <button
                    onClick={() => deleteResponse(index)}
                    className="p-1 text-red-400 hover:bg-red-500 hover:bg-opacity-20 rounded"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NPCsEditor;
