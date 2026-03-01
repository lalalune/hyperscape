/**
 * AgentMonitorScreen - Dashboard for monitoring and controlling duel agents.
 *
 * Layout: Top bar + duel status → sidebar (agent list, leaderboard, recent) | main detail panel.
 * Sharp corners, dense data, utilitarian.
 */

import { GAME_API_URL } from "@/lib/api-config";
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Swords,
  RefreshCw,
  Heart,
  Shield,
  Target,
  Clock,
  MapPin,
  Activity,
  Package,
  User,
  Pause,
  Play,
  Square,
  Trophy,
  Skull,
  ChevronRight,
  X,
} from "lucide-react";
import "./AgentMonitorScreen.css";

// ─── Types ──────────────────────────────────────────────────────────────────

interface AgentGoal {
  type: string;
  description: string;
  progress: number;
  target: number;
  location?: string;
  targetSkill?: string;
  startedAt: number;
  locked: boolean;
}

interface AgentThought {
  id: string;
  type: string;
  content: string;
  timestamp: number;
}

interface AgentData {
  characterId: string;
  name: string;
  state: "initializing" | "running" | "paused" | "stopped" | "error";
  scriptedRole?: string;
  startedAt: number;
  lastActivity: number;
  error?: string;

  entityId: string | null;
  position: [number, number, number] | null;
  health: number;
  maxHealth: number;
  alive: boolean;
  inCombat: boolean;
  combatTarget: string | null;

  goal: AgentGoal | null;
  goalsPaused: boolean;

  skills: Record<string, { level: number; xp: number }>;
  combatLevel: number;
  totalLevel: number;

  inventory: Array<{ slot: number; itemId: string; quantity: number }>;
  inventoryUsed: number;
  inventoryMax: number;
  coins: number;
  equipment: Record<string, string>;

  recentThoughts: AgentThought[];

  quests: AgentQuest[];
  questPoints: number;

  bankItems: Array<{
    itemId: string;
    quantity: number;
    slot: number;
    tabIndex: number;
  }>;
}

interface AgentQuest {
  questId: string;
  name: string;
  status: string;
  currentStage?: string;
  stageDescription?: string;
  stageProgress?: Record<string, number>;
}

interface MonitorResponse {
  timestamp: number;
  agentCount: number;
  agents: AgentData[];
}

interface DuelContestant {
  characterId: string;
  name: string;
  combatLevel: number;
  currentHp: number;
  maxHp: number;
}

interface DuelCycle {
  phase: string;
  contestants: DuelContestant[];
  startedAt: number;
  phaseStartedAt: number;
  winner: { characterId: string; name: string } | null;
  winReason: string | null;
}

interface LeaderboardEntry {
  rank: number;
  characterId: string;
  name: string;
  provider: string;
  model: string;
  wins: number;
  losses: number;
  winRate: number;
  combatLevel: number;
  currentStreak: number;
}

interface RecentDuelEntry {
  cycleId: string;
  duelId: string | null;
  finishedAt: number;
  winnerId: string;
  winnerName: string;
  loserId: string;
  loserName: string;
  winReason: string;
  damageWinner: number;
  damageLoser: number;
}

interface DuelStatusResponse {
  currentCycle: DuelCycle | null;
  leaderboard: LeaderboardEntry[];
  recentDuels: RecentDuelEntry[];
  streamHealth: { rtmpConnected: boolean; viewerCount: number } | null;
}

interface AgentKillEntry {
  npcId: string;
  name: string;
  count: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ADMIN_CODE_KEY = "hyperscape_admin_code";
const POLL_INTERVAL_MS = 3000;

type DetailTab =
  | "overview"
  | "skills"
  | "inventory"
  | "quests"
  | "bank"
  | "kills"
  | "duels"
  | "actions";

// ─── XP Table ───────────────────────────────────────────────────────────────

const XP_TABLE = [
  0, 83, 174, 276, 388, 512, 650, 801, 969, 1154, 1358, 1584, 1833, 2107, 2411,
  2746, 3115, 3523, 3973, 4470, 5018, 5624, 6291, 7028, 7842, 8740, 9730, 10824,
  12031, 13363, 14833, 16456, 18247, 20224, 22406, 24815, 27473, 30408, 33648,
  37224, 41171, 45529, 50339, 55649, 61512, 67983, 75127, 83014, 91721, 101333,
  111945, 123660, 136594, 150872, 166636, 184040, 203254, 224466, 247886,
  273742, 302288, 333804, 368599, 407015, 449428, 496254, 547953, 605032,
  668051, 737627, 814445, 899257, 992895, 1096278, 1210421, 1336443, 1475581,
  1629200, 1798808, 1986068, 2192818, 2421087, 2673114, 2951373, 3258594,
  3597792, 3972294, 4385776, 4842295, 5346332, 5902831, 6517253, 7195629,
  7944614, 8771558, 9684577, 10692629, 11805606, 13034431,
];

function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level > 99) return XP_TABLE[98] ?? 13034431;
  return XP_TABLE[level - 1] ?? 0;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}m`;
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 1000) return "now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  return `${Math.floor(diff / 3600000)}h`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function hpColor(ratio: number): string {
  if (ratio > 0.6) return "#22c55e";
  if (ratio > 0.3) return "#eab308";
  return "#ef4444";
}

function hpClass(ratio: number): string {
  if (ratio > 0.6) return "high";
  if (ratio > 0.3) return "mid";
  return "low";
}

function formatItemId(itemId: unknown): string {
  if (typeof itemId === "string") {
    return itemId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (itemId && typeof itemId === "object" && "itemId" in itemId) {
    return formatItemId((itemId as { itemId: unknown }).itemId);
  }
  return String(itemId ?? "Unknown");
}

// ─── Phase Colors ───────────────────────────────────────────────────────────

const PHASE_COLORS: Record<string, string> = {
  IDLE: "#55556a",
  ANNOUNCEMENT: "#3b82f6",
  COUNTDOWN: "#eab308",
  FIGHTING: "#ef4444",
  RESOLUTION: "#22c55e",
};

// ─── Confirm Modal ─────────────────────────────────────────────────────────

function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="confirm-modal-backdrop" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <span className="confirm-modal-title">{title}</span>
          <button className="confirm-modal-close" onClick={onCancel}>
            <X size={14} />
          </button>
        </div>
        <div className="confirm-modal-body">{message}</div>
        <div className="confirm-modal-actions">
          <button className="confirm-modal-btn cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="confirm-modal-btn confirm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reset Progress Modal ──────────────────────────────────────────────────

type ResetPhase =
  | "confirm"
  | "disconnecting"
  | "wiping"
  | "reconnecting"
  | "verifying"
  | "done"
  | "error";

const RESET_STEPS: { phase: ResetPhase; label: string }[] = [
  { phase: "disconnecting", label: "Disconnecting agent" },
  { phase: "wiping", label: "Wiping account data" },
  { phase: "reconnecting", label: "Reconnecting agent" },
  { phase: "verifying", label: "Verifying fresh state" },
];

function ResetModal({
  agentName,
  phase,
  errorMessage,
  snapshotBefore,
  snapshotAfter,
  onClose,
}: {
  agentName: string;
  phase: ResetPhase;
  errorMessage: string | null;
  snapshotBefore: {
    totalLevel: number;
    coins: number;
    inventoryUsed: number;
  } | null;
  snapshotAfter: {
    totalLevel: number;
    coins: number;
    inventoryUsed: number;
  } | null;
  onClose: () => void;
}) {
  const isActive = phase !== "done" && phase !== "error" && phase !== "confirm";
  const activeIdx = RESET_STEPS.findIndex((s) => s.phase === phase);

  return (
    <div className="confirm-modal-backdrop">
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <span className="confirm-modal-title">
            {phase === "done"
              ? "Reset Complete"
              : phase === "error"
                ? "Reset Failed"
                : `Resetting ${agentName}`}
          </span>
          {(phase === "done" || phase === "error") && (
            <button className="confirm-modal-close" onClick={onClose}>
              <X size={14} />
            </button>
          )}
        </div>
        <div className="confirm-modal-body" style={{ padding: 0 }}>
          {/* Step list */}
          <div className="reset-steps">
            {RESET_STEPS.map((step, i) => {
              let status: "pending" | "active" | "done" | "error" = "pending";
              if (phase === "error" && i === activeIdx) status = "error";
              else if (phase === "done" || i < activeIdx) status = "done";
              else if (i === activeIdx && isActive) status = "active";
              return (
                <div className={`reset-step ${status}`} key={step.phase}>
                  <span className="reset-step-indicator">
                    {status === "done" && "\u2713"}
                    {status === "active" && <span className="reset-spinner" />}
                    {status === "error" && "\u2717"}
                    {status === "pending" && "\u2022"}
                  </span>
                  <span className="reset-step-label">{step.label}</span>
                </div>
              );
            })}
          </div>

          {/* Error message */}
          {phase === "error" && errorMessage && (
            <div className="reset-error-msg">{errorMessage}</div>
          )}

          {/* Before / After comparison */}
          {phase === "done" && snapshotBefore && snapshotAfter && (
            <div className="reset-diff">
              <div className="reset-diff-header">Verification</div>
              <div className="reset-diff-row">
                <span className="reset-diff-label">Total Level</span>
                <span className="reset-diff-before">
                  {snapshotBefore.totalLevel}
                </span>
                <span className="reset-diff-arrow">{"\u2192"}</span>
                <span className="reset-diff-after">
                  {snapshotAfter.totalLevel}
                </span>
              </div>
              <div className="reset-diff-row">
                <span className="reset-diff-label">Coins</span>
                <span className="reset-diff-before">
                  {snapshotBefore.coins.toLocaleString()}
                </span>
                <span className="reset-diff-arrow">{"\u2192"}</span>
                <span className="reset-diff-after">
                  {snapshotAfter.coins.toLocaleString()}
                </span>
              </div>
              <div className="reset-diff-row">
                <span className="reset-diff-label">Inventory</span>
                <span className="reset-diff-before">
                  {snapshotBefore.inventoryUsed} items
                </span>
                <span className="reset-diff-arrow">{"\u2192"}</span>
                <span className="reset-diff-after">
                  {snapshotAfter.inventoryUsed} items
                </span>
              </div>
            </div>
          )}
        </div>
        {(phase === "done" || phase === "error") && (
          <div className="confirm-modal-actions">
            <button className="confirm-modal-btn cancel" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Duel Status Bar ────────────────────────────────────────────────────────

function DuelStatusBar({
  duelStatus,
}: {
  duelStatus: DuelStatusResponse | null;
}) {
  if (!duelStatus) return null;
  const { currentCycle, streamHealth } = duelStatus;
  if (!currentCycle) return null;

  const phase = currentCycle.phase;
  const color = PHASE_COLORS[phase] ?? "#55556a";

  return (
    <div className="duel-status-bar">
      <span
        className="phase-tag"
        style={{ color, borderColor: `${color}60`, background: `${color}12` }}
      >
        {phase}
      </span>
      {currentCycle.contestants.length === 2 && (
        <span className="matchup">
          <strong>{currentCycle.contestants[0].name}</strong>
          {" (Cb "}
          {currentCycle.contestants[0].combatLevel}
          {") vs "}
          <strong>{currentCycle.contestants[1].name}</strong>
          {" (Cb "}
          {currentCycle.contestants[1].combatLevel}
          {")"}
          {phase === "FIGHTING" && (
            <>
              {" — "}
              {currentCycle.contestants[0].currentHp}/
              {currentCycle.contestants[0].maxHp}
              {" vs "}
              {currentCycle.contestants[1].currentHp}/
              {currentCycle.contestants[1].maxHp}
            </>
          )}
        </span>
      )}
      {currentCycle.winner && (
        <span className="winner-tag">
          {currentCycle.winner.name} wins
          {currentCycle.winReason
            ? ` (${currentCycle.winReason.replace(/_/g, " ")})`
            : ""}
        </span>
      )}
      <span className="timer">
        {formatDuration(Date.now() - currentCycle.phaseStartedAt)}
      </span>
      {streamHealth && (
        <span className="stream-status">
          <span
            className={`stream-dot ${streamHealth.rtmpConnected ? "on" : "off"}`}
          />
          {streamHealth.rtmpConnected
            ? `${streamHealth.viewerCount} viewers`
            : "Offline"}
        </span>
      )}
    </div>
  );
}

// ─── Agent List Item (sidebar) ──────────────────────────────────────────────

function AgentListItem({
  agent,
  selected,
  onClick,
}: {
  agent: AgentData;
  selected: boolean;
  onClick: () => void;
}) {
  const hpRatio = agent.maxHealth > 0 ? agent.health / agent.maxHealth : 0;
  const hpPct = Math.round(hpRatio * 100);

  return (
    <div
      className={`agent-list-item ${selected ? "selected" : ""}`}
      onClick={onClick}
    >
      <div className="agent-list-row1">
        <span className="agent-list-name">
          <span className={`state-dot ${agent.state}`} />
          {agent.name}
        </span>
        <div className="agent-list-badges">
          {agent.goalsPaused && (
            <span className="agent-paused-badge">PAUSED</span>
          )}
        </div>
      </div>
      <div className="agent-list-row2">
        <span className="combat-tag">Cb {agent.combatLevel}</span>
        <span className={`hp-tag ${hpClass(hpRatio)}`}>
          {agent.health}/{agent.maxHealth} ({hpPct}%)
        </span>
      </div>
      <div className="agent-list-row3">
        {agent.inCombat ? (
          <span className="combat-target">
            Fighting {agent.combatTarget ?? "..."}
          </span>
        ) : agent.goal ? (
          <>
            <span className="goal-type">{agent.goal.type}</span>
            {" — "}
            {agent.goal.description}
          </>
        ) : (
          "Idle"
        )}
      </div>
    </div>
  );
}

// ─── Sidebar Leaderboard ────────────────────────────────────────────────────

function SidebarLeaderboard({
  leaderboard,
  selectedId,
}: {
  leaderboard: LeaderboardEntry[];
  selectedId: string | null;
}) {
  if (leaderboard.length === 0) return null;

  return (
    <div className="sidebar-section sidebar-leaderboard">
      <div className="sidebar-section-header">Leaderboard</div>
      <div className="sidebar-lb-row header">
        <span>#</span>
        <span>Name</span>
        <span>W</span>
        <span>L</span>
        <span>%</span>
      </div>
      {leaderboard.map((e) => (
        <div
          className={`sidebar-lb-row ${e.characterId === selectedId ? "highlight" : ""}`}
          key={e.characterId}
        >
          <span className="rank">{e.rank}</span>
          <span className="name">{e.name}</span>
          <span className="wins">{e.wins}</span>
          <span className="losses">{e.losses}</span>
          <span className="rate">{(e.winRate * 100).toFixed(0)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Sidebar Recent Duels ───────────────────────────────────────────────────

function SidebarRecentDuels({ duels }: { duels: RecentDuelEntry[] }) {
  if (duels.length === 0) return null;

  return (
    <div className="sidebar-section sidebar-recent-duels">
      <div className="sidebar-section-header">Recent Duels</div>
      {duels.slice(0, 8).map((d) => (
        <div className="sidebar-duel-row" key={d.cycleId}>
          <span className="duel-names">
            <strong>{d.winnerName}</strong> beat {d.loserName}
          </span>
          <span className="duel-time">{formatTimeAgo(d.finishedAt)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Overview Tab ───────────────────────────────────────────────────────────

function OverviewTab({ agent }: { agent: AgentData }) {
  const hpRatio = agent.maxHealth > 0 ? agent.health / agent.maxHealth : 0;
  const uptime = Date.now() - agent.startedAt;

  return (
    <div>
      <div className="overview-hp-section detail-hp-bar">
        <div className="hp-bar-track">
          <div
            className="hp-bar-fill"
            style={{ width: `${hpRatio * 100}%`, background: hpColor(hpRatio) }}
          />
        </div>
        <div className="hp-bar-label">
          <span>
            <Heart size={11} style={{ marginRight: 3, verticalAlign: -1 }} />
            Health
          </span>
          <span className="hp-value">
            {agent.health} / {agent.maxHealth}
          </span>
        </div>
      </div>

      <div className="overview-grid">
        <div className="overview-row">
          <span className="overview-label">Status</span>
          <span className={`overview-value ${agent.alive ? "green" : "red"}`}>
            {agent.alive ? "Alive" : "Dead"}
          </span>
        </div>
        <div className="overview-row">
          <span className="overview-label">Combat</span>
          <span className={`overview-value ${agent.inCombat ? "red" : ""}`}>
            {agent.inCombat
              ? agent.combatTarget
                ? `vs ${agent.combatTarget}`
                : "Yes"
              : "—"}
          </span>
        </div>
        <div className="overview-row">
          <span className="overview-label">Cb Level</span>
          <span className="overview-value gold">{agent.combatLevel}</span>
        </div>
        <div className="overview-row">
          <span className="overview-label">Total Lv</span>
          <span className="overview-value">{agent.totalLevel}</span>
        </div>
        <div className="overview-row">
          <span className="overview-label">Position</span>
          <span className="overview-value">
            {agent.position
              ? `${agent.position[0].toFixed(0)}, ${agent.position[1].toFixed(0)}, ${agent.position[2].toFixed(0)}`
              : "—"}
          </span>
        </div>
        <div className="overview-row">
          <span className="overview-label">Location</span>
          <span className="overview-value">{agent.goal?.location ?? "—"}</span>
        </div>
        <div className="overview-row">
          <span className="overview-label">Uptime</span>
          <span className="overview-value">{formatDuration(uptime)}</span>
        </div>
        <div className="overview-row">
          <span className="overview-label">Last Active</span>
          <span className="overview-value">
            {formatTimeAgo(agent.lastActivity)}
          </span>
        </div>
        <div className="overview-row">
          <span className="overview-label">Goals</span>
          <span
            className={`overview-value ${agent.goalsPaused ? "gold" : "green"}`}
          >
            {agent.goalsPaused ? "Paused" : "Active"}
          </span>
        </div>
        <div className="overview-row">
          <span className="overview-label">Coins</span>
          <span className="overview-value gold">
            {agent.coins.toLocaleString()}
          </span>
        </div>
        {agent.goal && (
          <div className="overview-row full">
            <span className="overview-label">Goal</span>
            <span className="overview-value gold">
              {agent.goal.type}: {agent.goal.description}
              {agent.goal.target > 0 &&
                ` (${agent.goal.progress}/${agent.goal.target})`}
            </span>
          </div>
        )}
        {agent.scriptedRole && (
          <div className="overview-row full">
            <span className="overview-label">Role</span>
            <span
              className="overview-value"
              style={{ textTransform: "capitalize" }}
            >
              {agent.scriptedRole}
            </span>
          </div>
        )}
        {agent.error && (
          <div className="overview-row full">
            <span className="overview-label">Error</span>
            <span className="overview-value red">{agent.error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skills Tab ─────────────────────────────────────────────────────────────

function SkillsTab({ agent }: { agent: AgentData }) {
  const skillEntries = Object.entries(agent.skills);

  if (skillEntries.length === 0) {
    return <div className="action-log-empty">No skill data</div>;
  }

  return (
    <div className="skills-grid">
      {skillEntries.map(([name, skill]) => {
        const currentLevelXp = xpForLevel(skill.level);
        const nextLevelXp = xpForLevel(skill.level + 1);
        const xpRange = nextLevelXp - currentLevelXp;
        const xpProgress =
          xpRange > 0 ? (skill.xp - currentLevelXp) / xpRange : 1;

        return (
          <div className="skill-row" key={name}>
            <span className="skill-name">{name}</span>
            <span className="skill-level">{skill.level}</span>
            <div className="skill-xp-bar">
              <div className="skill-xp-track">
                <div
                  className="skill-xp-fill"
                  style={{
                    width: `${Math.max(0, Math.min(1, xpProgress)) * 100}%`,
                  }}
                />
              </div>
              <div className="skill-xp-text">
                {skill.xp.toLocaleString()} / {nextLevelXp.toLocaleString()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Inventory Tab ──────────────────────────────────────────────────────────

function InventoryTab({ agent }: { agent: AgentData }) {
  const items = agent.inventory.filter((i) => i.itemId && i.itemId !== "");
  const equipmentEntries = Object.entries(agent.equipment);

  return (
    <div>
      <div className="inventory-section">
        <h3>
          <Package size={11} />
          Inventory
        </h3>
        {items.length > 0 ? (
          <div className="inventory-items">
            {items.map((item, i) => (
              <span className="inventory-item" key={i}>
                {formatItemId(item.itemId)}
                {item.quantity > 1 && (
                  <span className="item-qty"> x{item.quantity}</span>
                )}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#55556a" }}>Empty</div>
        )}
        <div className="inventory-summary">
          <span>
            {agent.inventoryUsed}/{agent.inventoryMax} slots
          </span>
          <span className="coins">{agent.coins.toLocaleString()} gp</span>
        </div>
      </div>

      <div className="inventory-section">
        <h3>
          <Shield size={11} />
          Equipment
        </h3>
        {equipmentEntries.length > 0 ? (
          <div className="equipment-grid">
            {equipmentEntries.map(([slot, itemId]) => (
              <div className="equipment-slot" key={slot}>
                <span className="equipment-slot-name">{slot}</span>
                <span className="equipment-slot-item">
                  {formatItemId(itemId)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#55556a" }}>None</div>
        )}
      </div>
    </div>
  );
}

// ─── Quests Tab ─────────────────────────────────────────────────────────────

function QuestsTab({ agent }: { agent: AgentData }) {
  const inProgress = agent.quests.filter(
    (q) => q.status === "in_progress" || q.status === "ready_to_complete",
  );
  const completed = agent.quests.filter((q) => q.status === "completed");

  return (
    <div>
      <div className="inventory-summary" style={{ marginBottom: 12 }}>
        <span>
          {inProgress.length} active, {completed.length} completed
        </span>
        <span className="coins">{agent.questPoints} QP</span>
      </div>

      {inProgress.length > 0 && (
        <div className="inventory-section">
          <h3>Active</h3>
          <div className="quest-list">
            {inProgress.map((quest) => (
              <div className="quest-entry quest-active" key={quest.questId}>
                <div className="quest-header">
                  <span className="quest-name">{quest.name}</span>
                  <span
                    className={`quest-status quest-status-${quest.status.replace(/_/g, "-")}`}
                  >
                    {quest.status === "ready_to_complete"
                      ? "Ready"
                      : "In Progress"}
                  </span>
                </div>
                {quest.stageDescription && (
                  <div className="quest-stage">{quest.stageDescription}</div>
                )}
                {quest.stageProgress &&
                  Object.keys(quest.stageProgress).length > 0 && (
                    <div className="quest-progress-items">
                      {Object.entries(quest.stageProgress).map(
                        ([key, value]) => (
                          <span className="quest-progress-item" key={key}>
                            {formatItemId(key)}: {value}
                          </span>
                        ),
                      )}
                    </div>
                  )}
              </div>
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div className="inventory-section">
          <h3>Completed</h3>
          <div className="quest-list">
            {completed.map((quest) => (
              <div className="quest-entry quest-completed" key={quest.questId}>
                <span className="quest-name">{quest.name}</span>
                <span className="quest-status quest-status-completed">
                  Done
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {agent.quests.length === 0 && (
        <div className="action-log-empty">No quests</div>
      )}
    </div>
  );
}

// ─── Bank Tab ───────────────────────────────────────────────────────────────

function BankTab({ agent }: { agent: AgentData }) {
  const items = agent.bankItems ?? [];

  if (items.length === 0) {
    return (
      <div className="action-log-empty">
        <Package size={20} style={{ opacity: 0.3 }} />
        <div>Empty bank</div>
      </div>
    );
  }

  const tabs = new Map<number, typeof items>();
  for (const item of items) {
    const tab = item.tabIndex ?? 0;
    if (!tabs.has(tab)) tabs.set(tab, []);
    tabs.get(tab)!.push(item);
  }
  const sortedTabs = Array.from(tabs.entries()).sort((a, b) => a[0] - b[0]);

  return (
    <div>
      <div className="inventory-summary" style={{ marginBottom: 12 }}>
        <span>{items.length} items</span>
        <span className="coins">{sortedTabs.length} tabs</span>
      </div>

      {sortedTabs.map(([tabIndex, tabItems]) => (
        <div className="inventory-section" key={tabIndex}>
          <h3>
            <Package size={11} />
            {tabIndex === 0 ? "Main" : `Tab ${tabIndex}`}
            <span className="bank-slot-count">{tabItems.length}</span>
          </h3>
          <div className="inventory-items">
            {tabItems.map((item, i) => (
              <span className="inventory-item" key={i}>
                {formatItemId(item.itemId)}
                {item.quantity > 1 && (
                  <span className="item-qty"> x{item.quantity}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Kills Tab ──────────────────────────────────────────────────────────────

function KillsTab({
  characterId,
  adminCode,
}: {
  characterId: string;
  adminCode: string;
}) {
  const [kills, setKills] = useState<AgentKillEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${GAME_API_URL}/admin/agents/${characterId}/kills`,
          { headers: { "x-admin-code": adminCode } },
        );
        if (res.ok) {
          const data = (await res.json()) as { kills: AgentKillEntry[] };
          if (!cancelled) setKills(data.kills);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [characterId, adminCode]);

  if (loading) {
    return (
      <div className="action-log-empty">
        <RefreshCw size={16} className="spinning" style={{ opacity: 0.3 }} />
        <div>Loading...</div>
      </div>
    );
  }

  if (kills.length === 0) {
    return (
      <div className="action-log-empty">
        <Skull size={20} style={{ opacity: 0.3 }} />
        <div>No kills</div>
      </div>
    );
  }

  const totalKills = kills.reduce((sum, k) => sum + k.count, 0);

  return (
    <div>
      <div className="inventory-summary" style={{ marginBottom: 12 }}>
        <span>{kills.length} types</span>
        <span className="coins">{totalKills.toLocaleString()} total</span>
      </div>
      <div className="agent-kills-table">
        <div className="kills-header">
          <span>NPC</span>
          <span>Kills</span>
        </div>
        {kills.map((k) => (
          <div className="kills-row" key={k.npcId}>
            <span className="kills-npc-name">{k.name}</span>
            <span className="kills-count">{k.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Duels Tab ──────────────────────────────────────────────────────────────

function DuelsTab({
  characterId,
  duelStatus,
}: {
  characterId: string;
  duelStatus: DuelStatusResponse | null;
}) {
  if (!duelStatus) {
    return (
      <div className="action-log-empty">
        <Swords size={20} style={{ opacity: 0.3 }} />
        <div>No duel data</div>
      </div>
    );
  }

  const agentEntry = duelStatus.leaderboard.find(
    (e) => e.characterId === characterId,
  );
  const agentDuels = duelStatus.recentDuels.filter(
    (d) => d.winnerId === characterId || d.loserId === characterId,
  );

  return (
    <div>
      {agentEntry ? (
        <div className="agent-duel-stats">
          <div className="overview-grid">
            <div className="overview-row">
              <span className="overview-label">Rank</span>
              <span className="overview-value gold">#{agentEntry.rank}</span>
            </div>
            <div className="overview-row">
              <span className="overview-label">Win Rate</span>
              <span className="overview-value">
                {(agentEntry.winRate * 100).toFixed(0)}%
              </span>
            </div>
            <div className="overview-row">
              <span className="overview-label">Wins</span>
              <span className="overview-value green">{agentEntry.wins}</span>
            </div>
            <div className="overview-row">
              <span className="overview-label">Losses</span>
              <span className="overview-value red">{agentEntry.losses}</span>
            </div>
            <div className="overview-row">
              <span className="overview-label">Streak</span>
              <span className="overview-value">{agentEntry.currentStreak}</span>
            </div>
            <div className="overview-row">
              <span className="overview-label">Total</span>
              <span className="overview-value">
                {agentEntry.wins + agentEntry.losses}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#55556a", marginBottom: 12 }}>
          No duel record
        </div>
      )}

      {agentDuels.length > 0 && (
        <div className="inventory-section" style={{ marginTop: 12 }}>
          <h3>Recent Duels</h3>
          <div className="duel-recent-list">
            {agentDuels.slice(0, 10).map((d) => {
              const won = d.winnerId === characterId;
              return (
                <div
                  className={`duel-recent-entry ${won ? "won" : "lost"}`}
                  key={d.cycleId}
                >
                  <span className={`duel-result ${won ? "win" : "loss"}`}>
                    {won ? "W" : "L"}
                  </span>
                  <span className="duel-opponent">
                    vs {won ? d.loserName : d.winnerName}
                  </span>
                  <span className="duel-reason">{d.winReason}</span>
                  <span className="duel-time">
                    {formatTimeAgo(d.finishedAt)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Action Log Tab ─────────────────────────────────────────────────────────

function ActionLogTab({ agent }: { agent: AgentData }) {
  const [filter, setFilter] = useState<"all" | "actions" | "thoughts">("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const filtered = agent.recentThoughts.filter((t) => {
    if (filter === "actions") return t.type === "action";
    if (filter === "thoughts") return t.type !== "action";
    return true;
  });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (agent.recentThoughts.length === 0) {
    return (
      <div className="action-log-empty">
        <Activity size={20} style={{ opacity: 0.3 }} />
        <div>No activity</div>
      </div>
    );
  }

  return (
    <div>
      <div className="action-log-filters">
        {(["all", "actions", "thoughts"] as const).map((f) => (
          <button
            key={f}
            className={`action-log-filter ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f === "actions" ? "Actions" : "Thoughts"}
          </button>
        ))}
      </div>
      <div className="action-log">
        {filtered.map((thought) => {
          const expanded = expandedIds.has(thought.id);
          return (
            <div
              className={`action-log-entry ${thought.type === "action" ? "action-entry" : ""} ${expanded ? "expanded" : ""}`}
              key={thought.id}
              onClick={() => toggleExpand(thought.id)}
            >
              <span className="action-log-time">
                {formatTime(thought.timestamp)}
              </span>
              <span className={`action-log-type type-${thought.type}`}>
                {thought.type}
              </span>
              <ChevronRight
                size={12}
                className={`action-log-chevron ${expanded ? "open" : ""}`}
              />
              <span
                className={`action-log-content ${expanded ? "expanded" : ""}`}
              >
                {thought.content}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Detail Panel ───────────────────────────────────────────────────────────

function AgentDetailPanel({
  agent,
  adminCode,
  duelStatus,
  onRefresh,
}: {
  agent: AgentData;
  adminCode: string;
  duelStatus: DuelStatusResponse | null;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>("overview");
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [pausing, setPausing] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  // Reset modal state
  const [resetPhase, setResetPhase] = useState<ResetPhase | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [snapshotBefore, setSnapshotBefore] = useState<{
    totalLevel: number;
    coins: number;
    inventoryUsed: number;
  } | null>(null);
  const [snapshotAfter, setSnapshotAfter] = useState<{
    totalLevel: number;
    coins: number;
    inventoryUsed: number;
  } | null>(null);

  const showStatus = (msg: string, duration = 3000) => {
    setActionStatus(msg);
    setTimeout(() => setActionStatus(null), duration);
  };

  const adminPost = async (path: string) => {
    const response = await fetch(`${GAME_API_URL}${path}`, {
      method: "POST",
      headers: { "x-admin-code": adminCode },
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      throw new Error(body.error ?? `HTTP ${response.status}`);
    }
    return response;
  };

  const adminGet = async (path: string) => {
    const response = await fetch(`${GAME_API_URL}${path}`, {
      headers: { "x-admin-code": adminCode },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  };

  const handleReset = () => {
    // Capture before-snapshot from current agent data
    setSnapshotBefore({
      totalLevel: agent.totalLevel,
      coins: agent.coins,
      inventoryUsed: agent.inventoryUsed,
    });
    setSnapshotAfter(null);
    setResetError(null);
    setResetPhase("confirm");
  };

  const executeReset = async () => {
    try {
      // Phase 1: Disconnecting
      setResetPhase("disconnecting");
      await new Promise((r) => setTimeout(r, 300));

      // Phase 2: Wiping (the actual API call does disconnect + wipe + reconnect)
      setResetPhase("wiping");
      await adminPost(`/admin/players/${agent.characterId}/reset`);

      // Phase 3: Reconnecting (server already reconnected, wait for entity)
      setResetPhase("reconnecting");
      await new Promise((r) => setTimeout(r, 500));

      // Phase 4: Verify — poll the monitor until we see fresh data
      setResetPhase("verifying");
      let verified = false;
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          const result = (await adminGet(
            "/admin/agents/monitor",
          )) as MonitorResponse;
          const fresh = result.agents.find(
            (a) => a.characterId === agent.characterId,
          );
          if (fresh) {
            setSnapshotAfter({
              totalLevel: fresh.totalLevel,
              coins: fresh.coins,
              inventoryUsed: fresh.inventoryUsed,
            });
            verified = true;
            break;
          }
        } catch {
          /* retry */
        }
        await new Promise((r) => setTimeout(r, 800));
      }

      if (!verified) {
        // Agent not yet visible but reset succeeded — show what we can
        setSnapshotAfter({ totalLevel: 0, coins: 0, inventoryUsed: 0 });
      }

      setResetPhase("done");
      onRefresh();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Unknown error");
      setResetPhase("error");
    }
  };

  const closeResetModal = () => {
    setResetPhase(null);
    setResetError(null);
    setSnapshotBefore(null);
    setSnapshotAfter(null);
    onRefresh();
  };

  const handlePauseResume = async () => {
    const action = agent.goalsPaused ? "resume" : "pause";
    setPausing(true);
    setActionStatus(null);
    try {
      await adminPost(`/admin/agents/${agent.characterId}/${action}`);
      showStatus(action === "pause" ? "Paused" : "Resumed");
      setTimeout(onRefresh, 300);
    } catch (err) {
      showStatus(
        `Failed: ${err instanceof Error ? err.message : "error"}`,
        5000,
      );
    } finally {
      setPausing(false);
    }
  };

  const handleStop = () => {
    setConfirmModal({
      title: "Stop Agent",
      message: `Stop ${agent.name}? This removes the agent from the world. You'll need to restart the server to bring it back.`,
      confirmLabel: "Stop",
      onConfirm: async () => {
        setConfirmModal(null);
        setStopping(true);
        setActionStatus(null);
        try {
          await adminPost(`/admin/agents/${agent.characterId}/stop`);
          showStatus("Stopped");
          setTimeout(onRefresh, 500);
        } catch (err) {
          showStatus(
            `Failed: ${err instanceof Error ? err.message : "error"}`,
            5000,
          );
        } finally {
          setStopping(false);
        }
      },
    });
  };

  const isStatusError = actionStatus?.includes("Failed");
  const resetting = resetPhase !== null && resetPhase !== "confirm";

  return (
    <div className="agent-detail-panel">
      {/* Reset confirm prompt */}
      {resetPhase === "confirm" && (
        <ConfirmModal
          title="Reset Agent"
          message={`Reset ${agent.name}? This wipes all progress — skills, inventory, quests, bank — and respawns the agent fresh.`}
          confirmLabel="Reset"
          onConfirm={executeReset}
          onCancel={() => setResetPhase(null)}
        />
      )}
      {/* Reset progress modal */}
      {resetPhase && resetPhase !== "confirm" && (
        <ResetModal
          agentName={agent.name}
          phase={resetPhase}
          errorMessage={resetError}
          snapshotBefore={snapshotBefore}
          snapshotAfter={snapshotAfter}
          onClose={closeResetModal}
        />
      )}
      {/* Stop confirm */}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
      <div className="agent-detail-header">
        <h2>
          <span className={`state-dot ${agent.state}`} />
          {agent.name}
          <span className={`state-text ${agent.state}`}>{agent.state}</span>
        </h2>
        <div className="agent-detail-controls">
          {actionStatus && (
            <span
              className={`action-status ${isStatusError ? "error" : "success"}`}
            >
              {actionStatus}
            </span>
          )}
          <button
            className="agent-control-btn reset"
            onClick={handleReset}
            disabled={resetting}
          >
            {resetting ? "Resetting..." : "Reset"}
          </button>
          <button
            className={`agent-control-btn ${agent.goalsPaused ? "resume" : "pause"}`}
            onClick={handlePauseResume}
            disabled={pausing}
          >
            {agent.goalsPaused ? <Play size={12} /> : <Pause size={12} />}
            {pausing ? "..." : agent.goalsPaused ? "Resume" : "Pause"}
          </button>
          <button
            className="agent-control-btn stop"
            onClick={handleStop}
            disabled={stopping}
          >
            <Square size={12} />
            {stopping ? "..." : "Stop"}
          </button>
        </div>
      </div>

      <div className="agent-detail-tabs">
        {(
          [
            ["overview", "Overview"],
            ["skills", "Skills"],
            ["inventory", "Inventory"],
            ["quests", "Quests"],
            ["bank", "Bank"],
            ["kills", "Kills"],
            ["duels", "Duels"],
            ["actions", "Log"],
          ] as [DetailTab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            className={`agent-detail-tab ${tab === key ? "active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="agent-detail-content">
        {tab === "overview" && <OverviewTab agent={agent} />}
        {tab === "skills" && <SkillsTab agent={agent} />}
        {tab === "inventory" && <InventoryTab agent={agent} />}
        {tab === "quests" && <QuestsTab agent={agent} />}
        {tab === "bank" && <BankTab agent={agent} />}
        {tab === "kills" && (
          <KillsTab characterId={agent.characterId} adminCode={adminCode} />
        )}
        {tab === "duels" && (
          <DuelsTab characterId={agent.characterId} duelStatus={duelStatus} />
        )}
        {tab === "actions" && <ActionLogTab agent={agent} />}
      </div>
    </div>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export const AgentMonitorScreen: React.FC = () => {
  const [adminCode, setAdminCode] = useState<string>(
    () => localStorage.getItem(ADMIN_CODE_KEY) || "",
  );
  const [isAuthed, setIsAuthed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [data, setData] = useState<MonitorResponse | null>(null);
  const [duelStatus, setDuelStatus] = useState<DuelStatusResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const adminFetch = useCallback(
    async (path: string) => {
      const response = await fetch(`${GAME_API_URL}${path}`, {
        headers: {
          "x-admin-code": adminCode,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 403) {
        setIsAuthed(false);
        setAuthError("Invalid admin code");
        localStorage.removeItem(ADMIN_CODE_KEY);
        throw new Error("Unauthorized");
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.json();
    },
    [adminCode],
  );

  const verifyAdminCode = useCallback(async () => {
    if (!adminCode) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      await adminFetch("/admin/stats");
      setIsAuthed(true);
      localStorage.setItem(ADMIN_CODE_KEY, adminCode);
    } catch {
      setIsAuthed(false);
      setAuthError("Invalid admin code");
      localStorage.removeItem(ADMIN_CODE_KEY);
    } finally {
      setAuthLoading(false);
    }
  }, [adminCode, adminFetch]);

  useEffect(() => {
    const storedCode = localStorage.getItem(ADMIN_CODE_KEY);
    if (storedCode && adminCode === storedCode) {
      verifyAdminCode();
    }
  }, [verifyAdminCode, adminCode]);

  const fetchData = useCallback(async () => {
    if (!isAuthed) return;
    setLoading(true);
    try {
      const [monitorResult, duelResult] = await Promise.all([
        adminFetch("/admin/agents/monitor") as Promise<MonitorResponse>,
        (
          adminFetch("/admin/duels/status") as Promise<DuelStatusResponse>
        ).catch(() => null),
      ]);
      setData(monitorResult);
      if (duelResult) setDuelStatus(duelResult);
      setFetchError(null);
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setFetchError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthed, adminFetch]);

  useEffect(() => {
    if (isAuthed) fetchData();
  }, [isAuthed, fetchData]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (isAuthed && autoRefresh) {
      intervalRef.current = setInterval(fetchData, POLL_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAuthed, autoRefresh, fetchData]);

  // Keep a cached reference to the selected agent so the detail panel
  // doesn't disappear when the entity is temporarily gone during reset.
  const lastSelectedRef = useRef<AgentData | null>(null);
  const liveAgent =
    selectedId && data
      ? (data.agents.find((a) => a.characterId === selectedId) ?? null)
      : null;
  if (liveAgent) {
    lastSelectedRef.current = liveAgent;
  } else if (!selectedId) {
    lastSelectedRef.current = null;
  }
  const selectedAgent = liveAgent ?? lastSelectedRef.current;

  // ─── Auth Gate ──────────────────────────────────────────────────────

  if (!isAuthed) {
    return (
      <div className="agent-monitor">
        <div className="agent-monitor-auth">
          <div className="agent-monitor-auth-card">
            <Swords size={36} style={{ color: "#d4a84b", marginBottom: 16 }} />
            <h1>Agent Monitor</h1>
            <p>Enter admin code</p>
            {authError && (
              <div className="agent-monitor-auth-error">{authError}</div>
            )}
            <input
              className="agent-monitor-auth-input"
              type="password"
              placeholder="Admin code"
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && verifyAdminCode()}
              autoFocus
            />
            <button
              className="agent-monitor-auth-button"
              onClick={verifyAdminCode}
              disabled={authLoading || !adminCode}
            >
              {authLoading ? "Verifying..." : "Authenticate"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Layout ───────────────────────────────────────────────────

  return (
    <div className="agent-monitor">
      {/* Top bar */}
      <div className="agent-monitor-topbar">
        <div className="agent-monitor-topbar-left">
          <h1>Agent Monitor</h1>
          <span className="agent-count">
            {data ? `${data.agentCount} agents` : "..."}
          </span>
        </div>
        <div className="agent-monitor-topbar-right">
          <label className="agent-monitor-auto-label">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto {POLL_INTERVAL_MS / 1000}s
          </label>
          <button
            className={`agent-monitor-refresh-btn ${loading ? "spinning" : ""}`}
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {/* Duel status bar */}
      <DuelStatusBar duelStatus={duelStatus} />

      {/* Error banner */}
      {fetchError && <div className="agent-monitor-error">{fetchError}</div>}

      {/* Body: sidebar + main */}
      <div className="agent-monitor-body">
        {/* Sidebar */}
        <div className="agent-monitor-sidebar">
          <div className="sidebar-section agents-section">
            <div className="sidebar-section-header">
              Agents{data ? ` (${data.agentCount})` : ""}
            </div>
            <div className="sidebar-section-scroll">
              {data && data.agents.length > 0 ? (
                data.agents.map((agent) => (
                  <AgentListItem
                    key={agent.characterId}
                    agent={agent}
                    selected={selectedId === agent.characterId}
                    onClick={() =>
                      setSelectedId(
                        selectedId === agent.characterId
                          ? null
                          : agent.characterId,
                      )
                    }
                  />
                ))
              ) : data ? (
                <div
                  style={{
                    padding: "20px 12px",
                    color: "#3a3a48",
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  No agents running
                </div>
              ) : null}
            </div>
          </div>

          <SidebarLeaderboard
            leaderboard={duelStatus?.leaderboard ?? []}
            selectedId={selectedId}
          />

          <SidebarRecentDuels duels={duelStatus?.recentDuels ?? []} />
        </div>

        {/* Main content */}
        <div className="agent-monitor-main">
          {selectedAgent ? (
            <AgentDetailPanel
              agent={selectedAgent}
              adminCode={adminCode}
              duelStatus={duelStatus}
              onRefresh={fetchData}
            />
          ) : (
            <div className="agent-detail-empty">
              <User size={28} style={{ opacity: 0.3 }} />
              <div>Select an agent</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
