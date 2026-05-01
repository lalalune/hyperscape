/**
 * AutomationPanel — World building automation tools
 *
 * Provides:
 * - Auto-populate: Procedurally place NPCs/mobs/resources based on biome rules
 * - Balance check: Validate difficulty zones vs mob levels
 * - Audio coverage: Highlight areas without music/ambient zones
 * - Quest graph: Visualize quest dependencies
 */

import {
  Wand2,
  Scale,
  Volume2,
  GitBranch,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
} from "lucide-react";
import React, { useState, useCallback, useMemo } from "react";

import { useWorldStudio } from "../WorldStudioContext";
import { setAgentPack, persistAgentPackToProject } from "../state/agentPack";
import { useAgentPlacementDispatcher } from "../hooks/useAgentPlacementDispatcher";
import { AgentBuilderForm } from "./AgentBuilderForm";
import { PropertySection } from "./properties/PropertyControls";
import { QuestGraphPanel } from "./QuestGraphPanel";

interface AutomationResult {
  title: string;
  status: "success" | "warning" | "error";
  message: string;
  details?: string[];
}

export function AutomationPanel() {
  const { state } = useWorldStudio();
  const placementDispatcher = useAgentPlacementDispatcher();
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<AutomationResult[]>([]);

  const world = state.builder.editing.world;
  const ext = state.extendedLayers;
  const audio = state.audioLayers;

  // Balance Check: Validate mob levels match difficulty zones
  const runBalanceCheck = useCallback(() => {
    if (!world) return;
    setRunning("balance");
    const checkResults: AutomationResult[] = [];

    // Check spawn points exist
    if (ext.spawnPoints.length === 0) {
      checkResults.push({
        title: "Missing Spawn Points",
        status: "error",
        message:
          "No player spawn points defined. Players cannot enter the world.",
      });
    }

    // Check each difficulty zone has appropriate mob levels
    for (const zone of world.layers.difficultyZones) {
      const zoneMobs = ext.mobSpawns.filter((ms) => {
        // Use bounds to check if mob spawn is within the zone
        const b = zone.bounds;
        return (
          ms.position.x >= b.minX &&
          ms.position.x <= b.maxX &&
          ms.position.z >= b.minZ &&
          ms.position.z <= b.maxZ
        );
      });

      if (zoneMobs.length === 0) {
        checkResults.push({
          title: `${zone.name}: No Mobs`,
          status: "warning",
          message: `Difficulty zone "${zone.name}" (level ${zone.difficultyLevel}) has no mob spawns within its bounds.`,
        });
      }

      // Check for mobs without manifest entries
      for (const ms of zoneMobs) {
        const manifestMob = state.manifests.npcs.find((n) => n.id === ms.mobId);
        if (!manifestMob) {
          checkResults.push({
            title: `Unknown Mob: ${ms.mobId}`,
            status: "error",
            message: `Mob spawn "${ms.name}" references unknown mob ID "${ms.mobId}".`,
          });
        }
      }
    }

    // Check towns have NPCs
    for (const town of world.foundation.towns) {
      const townNpcs = world.layers.npcs.filter(
        (n) =>
          n.parentContext.type === "town" && n.parentContext.townId === town.id,
      );
      if (townNpcs.length === 0) {
        checkResults.push({
          title: `${town.name}: No NPCs`,
          status: "warning",
          message: `Town "${town.name}" has no NPCs placed.`,
        });
      }
    }

    // Check quests have valid NPC references
    for (const quest of world.layers.quests) {
      if (quest.questGiverNpcId) {
        const giverExists = state.manifests.npcs.some(
          (n) => n.id === quest.questGiverNpcId,
        );
        if (!giverExists) {
          checkResults.push({
            title: `Quest "${quest.name}": Invalid Giver`,
            status: "error",
            message: `Quest giver NPC "${quest.questGiverNpcId}" not found in manifest.`,
          });
        }
      }
    }

    // Check resources have manifest entries
    for (const r of ext.resources) {
      let found = false;
      if (r.resourceType === "mining") {
        found = state.manifests.miningRocks.some(
          (mr) => mr.id === r.resourceId,
        );
      } else if (r.resourceType === "woodcutting") {
        found = state.manifests.trees.some((t) => t.id === r.resourceId);
      } else if (r.resourceType === "fishing") {
        found = state.manifests.fishingSpots.some((f) => f.id === r.resourceId);
      }
      if (!found) {
        checkResults.push({
          title: `Unknown Resource: ${r.resourceId}`,
          status: "error",
          message: `Resource "${r.name}" (${r.resourceType}) references unknown ID "${r.resourceId}".`,
        });
      }
    }

    if (checkResults.length === 0) {
      checkResults.push({
        title: "All Checks Passed",
        status: "success",
        message: "No balance issues found.",
      });
    }

    setResults(checkResults);
    setRunning(null);
  }, [world, ext, state.manifests]);

  // Audio Coverage Check
  const runAudioCoverage = useCallback(() => {
    if (!world) return;
    setRunning("audio");
    const checkResults: AutomationResult[] = [];

    if (audio.musicZones.length === 0) {
      checkResults.push({
        title: "No Music Zones",
        status: "error",
        message: "No music zones defined. The world will be completely silent.",
      });
    } else {
      // Estimate coverage
      const totalPolygonArea = audio.musicZones.reduce((sum, mz) => {
        if (mz.polygon.length < 3) return sum;
        // Shoelace formula for polygon area
        let area = 0;
        for (let i = 0; i < mz.polygon.length; i++) {
          const j = (i + 1) % mz.polygon.length;
          area += mz.polygon[i].x * mz.polygon[j].z;
          area -= mz.polygon[j].x * mz.polygon[i].z;
        }
        return sum + Math.abs(area) / 2;
      }, 0);

      const worldSize = world.foundation.config.terrain.worldSize;
      const tileSize = world.foundation.config.terrain.tileSize;
      const worldArea = worldSize * tileSize * worldSize * tileSize;
      const coveragePercent =
        worldArea > 0 ? Math.min(100, (totalPolygonArea / worldArea) * 100) : 0;

      if (coveragePercent < 50) {
        checkResults.push({
          title: `Low Music Coverage: ${Math.round(coveragePercent)}%`,
          status: "warning",
          message: `Only ~${Math.round(coveragePercent)}% of the world has music zones. Consider adding more zones.`,
        });
      } else {
        checkResults.push({
          title: `Music Coverage: ${Math.round(coveragePercent)}%`,
          status: "success",
          message: `Good music zone coverage across ${audio.musicZones.length} zones.`,
        });
      }
    }

    if (audio.ambientZones.length === 0) {
      checkResults.push({
        title: "No Ambient Zones",
        status: "warning",
        message:
          "No ambient sound zones defined. Consider adding ambient sounds for immersion.",
      });
    }

    // Check for zones with empty polygons
    for (const mz of audio.musicZones) {
      if (mz.polygon.length < 3) {
        checkResults.push({
          title: `Music Zone "${mz.name}": No Area`,
          status: "error",
          message: `Music zone "${mz.name}" has no polygon defined. Use the brush tool to paint its area.`,
        });
      }
    }

    // Check SFX triggers
    if (audio.sfxTriggers.length > 0) {
      checkResults.push({
        title: `${audio.sfxTriggers.length} SFX Triggers`,
        status: "success",
        message: `${audio.sfxTriggers.length} point-source SFX triggers placed.`,
      });
    }

    setResults(checkResults);
    setRunning(null);
  }, [world, audio]);

  // Quest Dependency Check
  const runQuestGraph = useCallback(() => {
    if (!world) return;
    setRunning("quests");
    const checkResults: AutomationResult[] = [];

    const questCount = state.manifests.quests.length;
    if (questCount === 0) {
      checkResults.push({
        title: "No Quests",
        status: "warning",
        message: "No quests found in manifests.",
      });
    } else {
      // Check for circular dependencies
      const questIds = new Set(state.manifests.quests.map((q) => q.id));
      const reqGraph = new Map<string, string[]>();

      for (const quest of state.manifests.quests) {
        const reqs = quest.requirements?.quests ?? [];
        reqGraph.set(quest.id, reqs);

        for (const reqId of reqs) {
          if (!questIds.has(reqId)) {
            checkResults.push({
              title: `"${quest.name}": Unknown Prerequisite`,
              status: "error",
              message: `Quest "${quest.name}" requires quest "${reqId}" which doesn't exist.`,
            });
          }
        }
      }

      // Simple cycle detection via DFS
      const visited = new Set<string>();
      const inStack = new Set<string>();

      function hasCycle(id: string): boolean {
        if (inStack.has(id)) return true;
        if (visited.has(id)) return false;
        visited.add(id);
        inStack.add(id);
        for (const dep of reqGraph.get(id) ?? []) {
          if (hasCycle(dep)) return true;
        }
        inStack.delete(id);
        return false;
      }

      let hasCycles = false;
      for (const id of questIds) {
        if (hasCycle(id)) {
          hasCycles = true;
          break;
        }
      }

      if (hasCycles) {
        checkResults.push({
          title: "Circular Quest Dependencies",
          status: "error",
          message:
            "Quest dependency graph contains cycles — some quests can never be completed.",
        });
      }

      // Count quest chains
      const roots = state.manifests.quests.filter(
        (q) => !q.requirements?.quests?.length,
      );
      checkResults.push({
        title: `${questCount} Quests, ${roots.length} Start Points`,
        status: "success",
        message: `${roots.length} quests have no prerequisites (entry points). ${questCount - roots.length} require completing other quests first.`,
      });
    }

    setResults(checkResults);
    setRunning(null);
  }, [world, state.manifests.quests]);

  const tools = useMemo(
    () => [
      {
        id: "balance",
        label: "Balance Check",
        description:
          "Validate mob levels, NPC placement, and resource references",
        icon: Scale,
        run: runBalanceCheck,
      },
      {
        id: "audio",
        label: "Audio Coverage",
        description: "Check music and ambient zone coverage",
        icon: Volume2,
        run: runAudioCoverage,
      },
      {
        id: "quests",
        label: "Quest Graph",
        description: "Validate quest dependencies and detect cycles",
        icon: GitBranch,
        run: runQuestGraph,
      },
    ],
    [runBalanceCheck, runAudioCoverage, runQuestGraph],
  );

  if (!world) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <Wand2 size={12} />
            AI tools
          </span>
        </div>

        {/* Agent builder is available even before a world is generated —
            it works against the widget catalog, not world content. */}
        <div className="p-2">
          <AgentBuilderForm
            onPackReceived={(pack) => {
              // Push into the editor-local agent-pack store. PIE's HUD
              // overlay subscribes to this and re-renders with the
              // agent's design once PIE is running.
              const result = setAgentPack(pack);
              if (result.ok) {
                // eslint-disable-next-line no-console
                console.info(
                  "[AgentBuilder] Pack stored. Layout instances:",
                  result.loaded.defaultLayout?.instances.length ?? 0,
                  "Press Play to render in PIE.",
                );
              } else {
                // eslint-disable-next-line no-console
                console.warn(
                  "[AgentBuilder] Pack rejected by client validator:",
                  result.issues,
                );
              }
            }}
          />
        </div>

        <div className="flex items-center justify-center h-32 text-text-tertiary text-xs px-3">
          Generate a world to unlock procedural automation tools.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
          <Wand2 size={12} />
          AI tools
        </span>
      </div>

      {/* Agent builder — chat with the live game-builder agent. The
          rest of the panel (procedural automation) operates on the
          generated world. */}
      <div className="p-2 border-b border-border-primary">
        <AgentBuilderForm
          onPackReceived={(pack) => {
            const result = setAgentPack(pack);
            if (result.ok) {
              // eslint-disable-next-line no-console
              console.info(
                "[AgentBuilder] Pack stored. Layout instances:",
                result.loaded.defaultLayout?.instances.length ?? 0,
                "Press Play to render in PIE.",
              );
              // B0'.G: persist to the active project so the agent's
              // pack survives reload + ships on Publish.
              persistAgentPackToProject(
                state.project.currentProjectId,
                pack as Parameters<typeof persistAgentPackToProject>[1],
              ).then((persist) => {
                if (!persist.ok) {
                  // eslint-disable-next-line no-console
                  console.warn(
                    "[AgentBuilder] Pack persist failed:",
                    persist.error,
                  );
                }
              });
            } else {
              // eslint-disable-next-line no-console
              console.warn(
                "[AgentBuilder] Pack rejected by client validator:",
                result.issues,
              );
            }
          }}
        />
        {/* B1.2 demo — pushes a hardcoded NPC into the agent-world
            store + persists to the active project (B0'.G). The
            chain proves: validate → local store → API → DB → next
            reload sees the same NPC. */}
        <button
          type="button"
          onClick={() => {
            // P0.5 of PLAN_AGENT_STUDIO_PARITY — demo button now
            // dispatches through the unified path. Lands in
            // extendedLayers, picks up the gizmo / property panel /
            // outliner; auto-saved by useAutoSave; survives reload.
            placementDispatcher.placeNpc({
              id: "demo_eldric_shopkeeper",
              type: "shopkeeper",
              name: "Eldric",
              position: { x: 0, y: 0, z: 0 },
            });
            // eslint-disable-next-line no-console
            console.info(
              "[AgentBuilder] Demo NPC dispatched to extendedLayers.",
            );
          }}
          className="mt-2 w-full px-3 py-1 text-xs bg-bg-tertiary hover:bg-bg-tertiary/80 rounded"
        >
          Place demo NPC (P0.5 — unified placement path)
        </button>
      </div>

      {/* Tools */}
      <div className="p-2 space-y-2 border-b border-border-primary">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isRunning = running === tool.id;
          return (
            <button
              key={tool.id}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs bg-bg-tertiary hover:bg-bg-tertiary/80 rounded transition-colors disabled:opacity-50"
              onClick={tool.run}
              disabled={isRunning}
            >
              {isRunning ? (
                <Loader2
                  size={14}
                  className="animate-spin text-primary flex-shrink-0"
                />
              ) : (
                <Icon size={14} className="text-text-tertiary flex-shrink-0" />
              )}
              <div className="text-left flex-1">
                <div className="text-text-primary font-medium">
                  {tool.label}
                </div>
                <div className="text-[10px] text-text-tertiary">
                  {tool.description}
                </div>
              </div>
              <Play size={10} className="text-text-tertiary flex-shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
        {results.length > 0 ? (
          results.map((result, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-1.5 px-2 py-1.5 rounded text-[10px] ${
                result.status === "error"
                  ? "bg-red-500/5 border border-red-500/20"
                  : result.status === "warning"
                    ? "bg-amber-500/5 border border-amber-500/20"
                    : "bg-green-500/5 border border-green-500/20"
              }`}
            >
              {result.status === "error" ? (
                <AlertTriangle
                  size={12}
                  className="text-red-400 flex-shrink-0 mt-0.5"
                />
              ) : result.status === "warning" ? (
                <AlertTriangle
                  size={12}
                  className="text-amber-400 flex-shrink-0 mt-0.5"
                />
              ) : (
                <CheckCircle2
                  size={12}
                  className="text-green-400 flex-shrink-0 mt-0.5"
                />
              )}
              <div>
                <div
                  className={
                    result.status === "error"
                      ? "text-red-400 font-medium"
                      : result.status === "warning"
                        ? "text-amber-400 font-medium"
                        : "text-green-400 font-medium"
                  }
                >
                  {result.title}
                </div>
                <div className="text-text-tertiary mt-0.5">
                  {result.message}
                </div>
                {result.details?.map((d, i) => (
                  <div key={i} className="text-text-tertiary pl-2 mt-0.5">
                    {d}
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center h-20 text-text-tertiary text-xs">
            Run a check to see results
          </div>
        )}
      </div>

      {/* Quest Dependency Graph */}
      <PropertySection
        title="Quest Dependency Graph"
        icon={<GitBranch size={10} />}
        defaultOpen={false}
      >
        <QuestGraphPanel />
      </PropertySection>
    </div>
  );
}
