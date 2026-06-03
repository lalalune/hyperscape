/**
 * QuestJournalPanel - OSRS-style quest tracking interface
 *
 * Features:
 * - Quest list with color-coded status (red/yellow/green)
 * - Total quest points display
 * - Quest detail view with strikethrough for completed steps
 * - Dynamic progress counters
 */

import React, { useState, useEffect } from "react";
import { EventType } from "@hyperforge/shared";
import type { ClientWorld } from "../../types";
import { useThemeStore } from "@/ui";
import {
  getInteractiveTileStyle,
  getPanelHeaderStyle,
  getPanelInsetStyle,
  getPanelSurfaceStyle,
  getShellControlButtonStyle,
} from "@/ui/theme/themes";
import { UI } from "@/ui/core";

interface QuestJournalPanelProps {
  world: ClientWorld;
  visible: boolean;
  onClose: () => void;
}

interface QuestListItem {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "ready_to_complete" | "completed";
  difficulty: string;
  questPoints: number;
}

interface QuestDetail {
  id: string;
  name: string;
  description: string;
  status: "not_started" | "in_progress" | "ready_to_complete" | "completed";
  difficulty: string;
  questPoints: number;
  currentStage: string;
  stageProgress: Record<string, number>;
  stages: Array<{
    id: string;
    description: string;
    type: string;
    target?: string;
    count?: number;
  }>;
}

// Status colors matching OSRS
const STATUS_COLORS = {
  not_started: "#ff4444", // Red
  in_progress: "#ffff00", // Yellow
  ready_to_complete: "#ffff00", // Yellow (same as in_progress visually)
  completed: "#00ff00", // Green
};

export function QuestJournalPanel({
  world,
  visible,
  onClose,
}: QuestJournalPanelProps) {
  const theme = useThemeStore((s) => s.theme);
  const closeButtonStyle = getShellControlButtonStyle(theme, "danger");
  const [quests, setQuests] = useState<QuestListItem[]>([]);
  const [selectedQuest, setSelectedQuest] = useState<QuestDetail | null>(null);
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const [questPoints, setQuestPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch quest data on mount and when visible
  useEffect(() => {
    if (!visible) return;

    const fetchQuestData = () => {
      // Request quest list from server
      if (world.network?.send) {
        world.network.send("getQuestList", {});
      }
    };

    const fetchQuestDetail = (questId: string) => {
      if (world.network?.send) {
        world.network.send("getQuestDetail", { questId });
      }
    };

    // Always fetch fresh data when panel opens
    fetchQuestData();
    // If a quest was previously selected, refresh its detail too
    if (selectedQuestId) {
      fetchQuestDetail(selectedQuestId);
    }

    // Listen for quest list updates via network packets
    const onQuestListUpdate = (data: unknown) => {
      const payload = data as {
        quests: QuestListItem[];
        questPoints: number;
      };
      setQuests(payload.quests || []);
      setQuestPoints(payload.questPoints || 0);
      setLoading(false);
    };

    // Listen for quest detail updates via network packets
    const onQuestDetailUpdate = (data: unknown) => {
      const payload = data as QuestDetail;
      setSelectedQuest(payload);
      setSelectedQuestId(payload.id);
    };

    // Register network packet handlers
    world.network?.on("questList", onQuestListUpdate);
    world.network?.on("questDetail", onQuestDetailUpdate);

    // Also listen for quest events to refresh
    const onQuestEvent = () => {
      fetchQuestData();
    };

    // Listen for quest progress to update the detail view
    const onQuestProgressed = (data: unknown) => {
      const payload = data as {
        questId: string;
        progress: Record<string, number>;
      };
      // Refresh list
      fetchQuestData();
      // Refresh the quest detail that progressed
      if (payload.questId) {
        fetchQuestDetail(payload.questId);
      }
    };

    // Bridge server→client quest packets to trigger re-fetch
    world.network?.on("questStarted", onQuestEvent);
    world.network?.on("questProgressed", onQuestProgressed);
    world.network?.on("questCompleted", onQuestEvent);
    world.on(EventType.QUEST_STARTED, onQuestEvent);
    world.on(EventType.QUEST_PROGRESSED, onQuestProgressed);
    world.on(EventType.QUEST_COMPLETED, onQuestEvent);

    return () => {
      world.network?.off("questList", onQuestListUpdate);
      world.network?.off("questDetail", onQuestDetailUpdate);
      world.network?.off("questStarted", onQuestEvent);
      world.network?.off("questProgressed", onQuestProgressed);
      world.network?.off("questCompleted", onQuestEvent);
      world.off(EventType.QUEST_STARTED, onQuestEvent);
      world.off(EventType.QUEST_PROGRESSED, onQuestProgressed);
      world.off(EventType.QUEST_COMPLETED, onQuestEvent);
    };
  }, [visible, world, selectedQuestId]);

  const handleSelectQuest = (questId: string) => {
    // Request quest details from server
    if (world.network?.send) {
      world.network.send("getQuestDetail", { questId });
    }
  };

  const handleBackToList = () => {
    setSelectedQuest(null);
    setSelectedQuestId(null);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center pointer-events-auto"
      style={{
        backgroundColor: theme.colors.background.overlay,
        zIndex: UI.Z_INDEX.MODAL,
      }}
      onClick={onClose}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="relative"
        style={{
          ...getPanelSurfaceStyle(theme, { emphasis: "strong" }),
          width: "32rem",
          maxWidth: "90vw",
          maxHeight: "80vh",
          padding: "1.5rem",
          boxShadow:
            "0 18px 40px rgba(0, 0, 0, 0.46), inset 0 1px 0 rgba(255,255,255,0.05)",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex justify-between items-center mb-4 pb-2"
          style={{
            ...getPanelHeaderStyle(theme),
            margin: "-1.5rem -1.5rem 1rem",
            padding: "0.75rem 1rem",
          }}
        >
          <div className="flex items-center gap-3">
            {selectedQuest && (
              <button
                onClick={handleBackToList}
                className="cursor-pointer"
                style={{ color: theme.colors.text.muted }}
                title="Back to list"
              >
                ←
              </button>
            )}
            <h3
              className="m-0 text-lg font-bold"
              style={{ color: theme.colors.text.accent }}
            >
              {selectedQuest ? selectedQuest.name : "Quest Journal"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer text-xl leading-none"
            style={{ ...closeButtonStyle, width: 28, height: 28, fontSize: 18 }}
            title="Close"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = String(
                closeButtonStyle["--shell-button-hover-bg"],
              );
              e.currentTarget.style.color = String(
                closeButtonStyle["--shell-button-hover-fg"],
              );
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = String(
                closeButtonStyle.background,
              );
              e.currentTarget.style.color = String(closeButtonStyle.color);
            }}
          >
            ×
          </button>
        </div>

        {/* Quest Points (list view only) */}
        {!selectedQuest && (
          <div
            className="mb-4"
            style={{
              ...getPanelInsetStyle(theme, {
                emphasis: "strong",
                radius: theme.borderRadius.md,
                padding: "0.75rem 0.9rem",
              }),
            }}
          >
            <div
              className="text-[10px] uppercase tracking-[0.18em] mb-1"
              style={{ color: theme.colors.text.muted }}
            >
              Adventurer's Chronicle
            </div>
            <div
              className="flex items-center justify-between"
              style={{ color: theme.colors.text.accent }}
            >
              <span className="text-sm font-semibold">Quest Points</span>
              <strong className="text-lg">{questPoints}</strong>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div
          className="flex-1 overflow-y-auto"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "#c9a227 rgba(0,0,0,0.3)",
          }}
        >
          {loading ? (
            <div
              className="text-center py-8"
              style={{ color: theme.colors.text.muted }}
            >
              Loading quests...
            </div>
          ) : selectedQuest ? (
            <QuestDetailView quest={selectedQuest} theme={theme} />
          ) : (
            <QuestListView
              quests={quests}
              onSelectQuest={handleSelectQuest}
              theme={theme}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Quest List View Component
function QuestListView({
  quests,
  onSelectQuest,
  theme,
}: {
  quests: QuestListItem[];
  onSelectQuest: (questId: string) => void;
  theme: ReturnType<typeof useThemeStore.getState>["theme"];
}) {
  if (quests.length === 0) {
    return (
      <div
        className="text-center py-8"
        style={{ color: theme.colors.text.muted }}
      >
        No quests available yet.
      </div>
    );
  }

  // Sort quests: in_progress first, then not_started, then completed
  const sortedQuests = [...quests].sort((a, b) => {
    const order = {
      in_progress: 0,
      ready_to_complete: 0,
      not_started: 1,
      completed: 2,
    };
    return order[a.status] - order[b.status];
  });

  return (
    <div className="space-y-1">
      {sortedQuests.map((quest) => (
        <button
          key={quest.id}
          onClick={() => onSelectQuest(quest.id)}
          className="w-full text-left p-2 transition-colors"
          style={{
            ...getInteractiveTileStyle(theme, {
              radius: theme.borderRadius.md,
              accentColor: theme.colors.accent.primary,
            }),
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = `${theme.colors.text.accent}`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = `${theme.colors.border.default}40`;
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div
                className="text-[10px] uppercase tracking-[0.14em] mb-1"
                style={{ color: theme.colors.text.muted }}
              >
                {quest.status.replaceAll("_", " ")}
              </div>
              <span
                className="font-medium block"
                style={{ color: STATUS_COLORS[quest.status] }}
              >
                {quest.name}
              </span>
            </div>
            <span
              className="text-[10px] px-2 py-1"
              style={{
                ...getPanelInsetStyle(theme, {
                  radius: theme.borderRadius.sm,
                  padding: "0.25rem 0.5rem",
                }),
                color: theme.colors.text.secondary,
              }}
            >
              {quest.difficulty}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

// Quest Detail View Component
function QuestDetailView({
  quest,
  theme,
}: {
  quest: QuestDetail;
  theme: ReturnType<typeof useThemeStore.getState>["theme"];
}) {
  // Determine which stages are completed
  const getStageStatus = (
    stageIndex: number,
  ): "completed" | "current" | "future" => {
    const currentStageIndex = quest.stages.findIndex(
      (s) => s.id === quest.currentStage,
    );

    if (quest.status === "completed") {
      return "completed";
    }

    if (stageIndex < currentStageIndex) {
      return "completed";
    } else if (stageIndex === currentStageIndex) {
      return "current";
    }
    return "future";
  };

  // Get progress text for a specific stage (inline display)
  const getStageProgress = (stage: QuestDetail["stages"][0]): string | null => {
    if (!stage.count) return null;

    if (stage.type === "kill" && stage.target) {
      const kills = quest.stageProgress.kills || 0;
      return `(${kills}/${stage.count})`;
    }

    if (stage.type === "gather" && stage.target) {
      const gathered = quest.stageProgress[stage.target] || 0;
      return `(${gathered}/${stage.count})`;
    }

    if (stage.type === "interact" && stage.target) {
      const interacted = quest.stageProgress[stage.target] || 0;
      return `(${interacted}/${stage.count})`;
    }

    return null;
  };

  return (
    <div className="space-y-4">
      {/* Quest Info */}
      <div
        className="p-3 rounded"
        style={{
          ...getPanelInsetStyle(theme, {
            emphasis: "strong",
            radius: theme.borderRadius.md,
            padding: "0.75rem",
          }),
        }}
      >
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm" style={{ color: theme.colors.text.muted }}>
            Difficulty: {quest.difficulty}
          </span>
          <span className="text-sm" style={{ color: theme.colors.text.accent }}>
            {quest.questPoints} Quest Point{quest.questPoints !== 1 ? "s" : ""}
          </span>
        </div>
        <p
          className="text-sm m-0"
          style={{ color: theme.colors.text.secondary }}
        >
          {quest.description}
        </p>
      </div>

      {/* Quest Status */}
      <div
        className="text-center py-2 rounded"
        style={{
          backgroundColor:
            quest.status === "completed"
              ? `${theme.colors.state.success}12`
              : quest.status === "not_started"
                ? `${theme.colors.state.danger}12`
                : `${theme.colors.state.warning}12`,
          color: STATUS_COLORS[quest.status],
          ...getPanelInsetStyle(theme, {
            radius: theme.borderRadius.md,
            padding: "0.5rem 0.75rem",
          }),
        }}
      >
        {quest.status === "completed"
          ? "Quest Complete!"
          : quest.status === "not_started"
            ? "Not Started"
            : quest.status === "ready_to_complete"
              ? "Ready to Complete"
              : "In Progress"}
      </div>

      {/* Quest Steps with Strikethrough */}
      <div className="space-y-2">
        <h4
          className="text-sm font-bold m-0 mb-2"
          style={{ color: theme.colors.text.accent }}
        >
          Quest Progress:
        </h4>
        {quest.stages.map((stage, index) => {
          const status = getStageStatus(index);
          const progress = getStageProgress(stage);
          const showProgress =
            progress && status !== "completed" && quest.status !== "completed";

          return (
            <div
              key={stage.id}
              className="text-sm flex justify-between items-center"
              style={{
                ...getPanelInsetStyle(theme, {
                  radius: theme.borderRadius.sm,
                  padding: "0.45rem 0.6rem",
                }),
                color:
                  status === "completed"
                    ? theme.colors.text.disabled
                    : status === "current"
                      ? theme.colors.text.primary
                      : theme.colors.text.muted,
                textDecoration:
                  status === "completed" ? "line-through" : "none",
              }}
            >
              <span>• {stage.description}</span>
              {showProgress && (
                <span
                  style={{
                    color: theme.colors.text.accent,
                    marginLeft: "0.5rem",
                  }}
                >
                  {progress}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
