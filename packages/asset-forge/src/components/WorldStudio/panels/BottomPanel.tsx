/**
 * BottomPanel — Collapsible output/log panel at the bottom of the editor viewport
 *
 * Inspired by UE5's Output Log / Message Log. Three tabs:
 * - Validation: Cross-reference manifest issues
 * - Console: Captured console output (placeholder for now)
 * - History: Command history undo stack
 *
 * Persists expanded state and height in localStorage.
 */

import {
  AlertTriangle,
  Book,
  Terminal,
  History,
  LayoutPanelTop,
  ChevronDown,
  ChevronUp,
  Move,
  RotateCcw,
  Maximize2,
  Plus,
  Trash2,
  Copy,
  Mountain,
  Paintbrush,
  Package,
  Wrench,
  Circle,
  Boxes,
} from "lucide-react";
import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";

import type { Command } from "../../../editor/commands";
import { commandHistory } from "../../../editor/commands";
import {
  useManifestValidation,
  type ManifestValidationIssue,
} from "../hooks/useManifestValidation";
import { AssetPackBrowserPanelProjectBound } from "./AssetPackBrowserPanel";
import { ContentBrowser } from "./ContentBrowser";
import { PluginBrowserPanel } from "./PluginBrowserPanel";
import { UILayoutLibraryTab } from "./UILayoutLibraryTab";

// ============== CONSTANTS ==============

const STORAGE_KEY_EXPANDED = "worldstudio-bottom-panel-expanded";
const STORAGE_KEY_HEIGHT = "worldstudio-bottom-panel-height";
const STORAGE_KEY_TAB = "worldstudio-bottom-panel-tab";

// Content Browser needs substantially more vertical room than the
// log-style tabs — bump the default height when Content is the active
// tab (see `computeDefaultHeight`).
const DEFAULT_HEIGHT = 200;
const CONTENT_DEFAULT_HEIGHT = 340;
const MIN_HEIGHT = 100;
const MAX_HEIGHT = 720;
const TAB_BAR_HEIGHT = 24;

type TabId =
  | "content"
  | "uiLayouts"
  | "plugins"
  | "assetPacks"
  | "validation"
  | "console"
  | "history";

interface TabDef {
  id: TabId;
  label: string;
  icon: typeof AlertTriangle;
}

// UE5 convention: Content Browser sits leftmost in the bottom dock and is
// the primary tool users reach for. UI Layouts is its UMG-library sibling.
const TABS: TabDef[] = [
  { id: "content", label: "Content", icon: Book },
  { id: "uiLayouts", label: "UI Layouts", icon: LayoutPanelTop },
  { id: "plugins", label: "Plugins", icon: Package },
  { id: "assetPacks", label: "Asset Packs", icon: Boxes },
  { id: "validation", label: "Validation", icon: AlertTriangle },
  { id: "console", label: "Console", icon: Terminal },
  { id: "history", label: "History", icon: History },
];

// ============== COMMAND TYPE ICONS ==============

const COMMAND_TYPE_ICONS: Record<string, typeof Move> = {
  MoveEntity: Move,
  RotateEntity: RotateCcw,
  ScaleEntity: Maximize2,
  PlaceEntity: Plus,
  DeleteEntity: Trash2,
  DuplicateEntity: Copy,
  BatchDelete: Trash2,
  TerrainSculpt: Mountain,
  BiomePaint: Paintbrush,
  ModifyProperty: Wrench,
};

/** Human-readable description for a command */
function describeCommand(cmd: Command): string {
  switch (cmd.type) {
    case "MoveEntity":
      return "Move entity";
    case "RotateEntity":
      return "Rotate entity";
    case "ScaleEntity":
      return "Scale entity";
    case "PlaceEntity":
      return "Place entity";
    case "DeleteEntity":
      return "Delete entity";
    case "DuplicateEntity":
      return "Duplicate entity";
    case "BatchDelete":
      return "Batch delete";
    case "TerrainSculpt":
      return "Sculpt terrain";
    case "BiomePaint":
      return "Paint biome";
    case "ModifyProperty":
      return "Modify property";
    default:
      return cmd.type;
  }
}

// ============== PERSISTENCE HELPERS ==============

function loadBoolean(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    return stored === "true";
  } catch {
    return fallback;
  }
}

function loadNumber(key: string, fallback: number): number {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function loadString<T extends string>(key: string, fallback: T, valid: T[]): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    return valid.includes(stored as T) ? (stored as T) : fallback;
  } catch {
    return fallback;
  }
}

// ============== HOOKS ==============

/** Subscribe to commandHistory changes via useSyncExternalStore */
let _cachedSnapshot: {
  undoEntries: readonly Command[];
  redoEntries: readonly Command[];
  undoCount: number;
} | null = null;
let _lastUndoRef: readonly Command[] | null = null;
let _lastRedoRef: readonly Command[] | null = null;
let _lastUndoCount = -1;

function getCommandHistorySnapshot() {
  const undo = commandHistory.getUndoEntries();
  const redo = commandHistory.getRedoEntries();
  const count = commandHistory.undoCount;
  if (
    _cachedSnapshot &&
    undo === _lastUndoRef &&
    redo === _lastRedoRef &&
    count === _lastUndoCount
  ) {
    return _cachedSnapshot;
  }
  _lastUndoRef = undo;
  _lastRedoRef = redo;
  _lastUndoCount = count;
  _cachedSnapshot = { undoEntries: undo, redoEntries: redo, undoCount: count };
  return _cachedSnapshot;
}

function subscribeCommandHistory(onStoreChange: () => void) {
  return commandHistory.subscribe(onStoreChange);
}

function useCommandHistorySnapshot() {
  return useSyncExternalStore(
    subscribeCommandHistory,
    getCommandHistorySnapshot,
  );
}

// ============== VALIDATION TAB ==============

function ValidationTab() {
  const issues = useManifestValidation();
  const scrollRef = useRef<HTMLDivElement>(null);

  if (issues.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-tertiary text-xs">
        No validation issues found
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
      {issues.map((issue: ManifestValidationIssue, idx: number) => (
        <div
          key={`${issue.manifest}-${issue.entryId}-${issue.field}-${idx}`}
          className="flex items-start gap-2 px-3 py-1.5 text-xs border-b border-border-primary/30 hover:bg-bg-tertiary/50 transition-colors ease-out"
        >
          <AlertTriangle
            size={12}
            className={`flex-shrink-0 mt-0.5 ${
              issue.severity === "error" ? "text-red-400" : "text-amber-400"
            }`}
          />
          <div className="flex-1 min-w-0">
            <span className="text-text-primary">{issue.entryName}</span>
            <span className="text-text-tertiary mx-1">—</span>
            <span className="text-text-secondary">
              {issue.field}: <span className="text-red-300">{issue.value}</span>{" "}
              (expected {issue.expected})
            </span>
          </div>
          <span className="flex-shrink-0 text-[10px] text-text-tertiary bg-bg-tertiary px-1.5 rounded">
            {issue.manifest}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============== CONSOLE CAPTURE ==============

type ConsoleLevel = "log" | "warn" | "error";

interface ConsoleEntry {
  id: number;
  level: ConsoleLevel;
  message: string;
  timestamp: number;
}

const MAX_CONSOLE_ENTRIES = 500;
let _consoleEntryId = 0;

/** Module-level store so entries survive re-mounts within the same session. */
const consoleEntries: ConsoleEntry[] = [];
const consoleListeners = new Set<() => void>();

function pushConsoleEntry(level: ConsoleLevel, args: unknown[]) {
  const message = args
    .map((a) => {
      if (typeof a === "string") return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ");

  consoleEntries.push({
    id: ++_consoleEntryId,
    level,
    message,
    timestamp: Date.now(),
  });

  // Trim to max
  while (consoleEntries.length > MAX_CONSOLE_ENTRIES) {
    consoleEntries.shift();
  }

  for (const listener of consoleListeners) listener();
}

function clearConsoleEntries() {
  consoleEntries.length = 0;
  for (const listener of consoleListeners) listener();
}

// ============== CONSOLE TAB ==============

const LEVEL_COLORS: Record<ConsoleLevel, string> = {
  log: "text-text-secondary",
  warn: "text-amber-400",
  error: "text-red-400",
};

const LEVEL_BG: Record<ConsoleLevel, string> = {
  log: "",
  warn: "bg-amber-500/5",
  error: "bg-red-500/5",
};

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ConsoleTab() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);

  // Subscribe to console entries
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    consoleListeners.add(listener);
    return () => {
      consoleListeners.delete(listener);
    };
  }, []);

  // Install console overrides once
  useEffect(() => {
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;

    console.log = (...args: unknown[]) => {
      origLog.apply(console, args);
      pushConsoleEntry("log", args);
    };
    console.warn = (...args: unknown[]) => {
      origWarn.apply(console, args);
      pushConsoleEntry("warn", args);
    };
    console.error = (...args: unknown[]) => {
      origError.apply(console, args);
      pushConsoleEntry("error", args);
    };

    return () => {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
    };
  }, []);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  });

  if (consoleEntries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-tertiary text-xs font-mono">
        No console output captured
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-0.5 border-b border-border-primary/30">
        <span className="text-[10px] text-text-tertiary">
          {consoleEntries.length} entries
        </span>
        <button
          className="text-[10px] text-text-tertiary hover:text-text-primary transition-colors ease-out"
          onClick={clearConsoleEntries}
        >
          Clear
        </button>
      </div>

      {/* Entries */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-thin font-mono"
      >
        {consoleEntries.map((entry) => (
          <div
            key={entry.id}
            className={`flex items-start gap-2 px-3 py-0.5 text-[11px] border-b border-border-primary/20 ${LEVEL_BG[entry.level]}`}
          >
            <span className="text-text-tertiary flex-shrink-0 tabular-nums text-[10px] leading-[18px]">
              {formatTimestamp(entry.timestamp)}
            </span>
            <span
              className={`flex-1 break-all whitespace-pre-wrap leading-[18px] ${LEVEL_COLORS[entry.level]}`}
            >
              {entry.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== HISTORY TAB ==============

/** Format relative time from now (e.g., "2m ago", "just now") */
function formatRelativeTime(timestampMs: number): string {
  const delta = Date.now() - timestampMs;
  const seconds = Math.floor(delta / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function HistoryTab() {
  const { undoEntries, redoEntries } = useCommandHistorySnapshot();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);

  // Refresh relative timestamps every 30s
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom (current position) when entries change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [undoEntries.length, redoEntries.length]);

  if (undoEntries.length === 0 && redoEntries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-tertiary text-xs">
        No commands in history
      </div>
    );
  }

  // We don't have timestamps on commands, so we estimate based on index.
  // Use a rough base timestamp: now minus a few seconds per entry.
  const now = Date.now();
  const totalCount = undoEntries.length + redoEntries.length;

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
      {/* Undo entries (already executed, from oldest to newest) */}
      {undoEntries.map((cmd, idx) => {
        const Icon = COMMAND_TYPE_ICONS[cmd.type] ?? Circle;
        const age = (totalCount - idx) * 3000; // rough approximation
        return (
          <div
            key={`undo-${idx}`}
            className="flex items-center gap-2 px-3 py-1 text-xs border-b border-border-primary/30 hover:bg-bg-tertiary/50 transition-colors ease-out"
          >
            <Icon size={11} className="flex-shrink-0 text-text-tertiary" />
            <span className="flex-1 text-text-secondary truncate">
              {describeCommand(cmd)}
            </span>
            <span className="flex-shrink-0 text-[10px] text-text-tertiary">
              {formatRelativeTime(now - age)}
            </span>
          </div>
        );
      })}

      {/* Current position marker */}
      <div className="flex items-center gap-2 px-3 py-0.5">
        <div className="flex-1 border-t border-primary/50" />
        <span className="text-[10px] text-primary font-medium flex-shrink-0">
          Current
        </span>
        <div className="flex-1 border-t border-primary/50" />
      </div>

      {/* Redo entries (undone, shown greyed out, from oldest to newest) */}
      {redoEntries.map((cmd, idx) => {
        const Icon = COMMAND_TYPE_ICONS[cmd.type] ?? Circle;
        return (
          <div
            key={`redo-${idx}`}
            className="flex items-center gap-2 px-3 py-1 text-xs border-b border-border-primary/30 opacity-40"
          >
            <Icon size={11} className="flex-shrink-0 text-text-tertiary" />
            <span className="flex-1 text-text-tertiary truncate">
              {describeCommand(cmd)}
            </span>
            <span className="flex-shrink-0 text-[10px] text-text-tertiary">
              (undone)
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============== BOTTOM PANEL ==============

export const BottomPanel = React.memo(function BottomPanel() {
  // Default expanded now that Content is the primary tab — users expect
  // to see the browser on first load. Anyone who previously collapsed it
  // still gets their saved state.
  const [expanded, setExpanded] = useState(() =>
    loadBoolean(STORAGE_KEY_EXPANDED, true),
  );
  const [height, setHeight] = useState(() =>
    loadNumber(STORAGE_KEY_HEIGHT, CONTENT_DEFAULT_HEIGHT),
  );
  const [activeTab, setActiveTab] = useState<TabId>(() =>
    loadString(STORAGE_KEY_TAB, "content", [
      "content",
      "uiLayouts",
      "plugins",
      "validation",
      "console",
      "history",
    ]),
  );

  const dragRef = useRef<{
    startY: number;
    startHeight: number;
  } | null>(null);

  const issues = useManifestValidation();
  const { undoCount } = useCommandHistorySnapshot();

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warnCount = issues.filter((i) => i.severity === "warning").length;

  // Persist state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EXPANDED, String(expanded));
    } catch {
      // Ignore storage errors
    }
  }, [expanded]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HEIGHT, String(height));
    } catch {
      // Ignore storage errors
    }
  }, [height]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TAB, activeTab);
    } catch {
      // Ignore storage errors
    }
  }, [activeTab]);

  // Drag resize handler
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startY: e.clientY, startHeight: height };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!dragRef.current) return;
        // Dragging up increases height, dragging down decreases
        const delta = dragRef.current.startY - moveEvent.clientY;
        const newHeight = Math.min(
          MAX_HEIGHT,
          Math.max(MIN_HEIGHT, dragRef.current.startHeight + delta),
        );
        setHeight(newHeight);
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [height],
  );

  const toggleExpanded = useCallback(() => {
    setExpanded((v) => !v);
  }, []);

  const handleTabClick = useCallback((tabId: TabId) => {
    setActiveTab(tabId);
    setExpanded(true);
  }, []);

  /** Render the badge text for a tab */
  const renderBadge = (tabId: TabId): string | null => {
    switch (tabId) {
      case "validation":
        if (errorCount === 0 && warnCount === 0) return null;
        return `${errorCount > 0 ? `${errorCount}E` : ""}${errorCount > 0 && warnCount > 0 ? " " : ""}${warnCount > 0 ? `${warnCount}W` : ""}`;
      case "history":
        if (undoCount === 0) return null;
        return String(undoCount);
      default:
        return null;
    }
  };

  return (
    <div
      className="flex-shrink-0 border-t border-border-primary bg-bg-secondary"
      style={{
        height: expanded ? height + TAB_BAR_HEIGHT : TAB_BAR_HEIGHT,
        borderTop: "1px solid var(--surface-highlight)",
      }}
    >
      {/* Drag handle — only visible when expanded */}
      {expanded && (
        <div
          className="ws-divider h-[3px] cursor-ns-resize"
          style={{ background: "var(--bg-primary)" }}
          onMouseDown={handleDragStart}
        />
      )}

      {/* Tab bar */}
      <div
        className="flex items-center px-1"
        style={{
          height: TAB_BAR_HEIGHT,
          borderBottom: expanded ? "1px solid var(--border-primary)" : "none",
          background: "var(--bg-tertiary)",
        }}
      >
        {/* Tabs */}
        <div className="flex items-center gap-0 flex-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const badge = renderBadge(tab.id);
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`flex items-center gap-1 px-2.5 h-full text-[11px] transition-colors duration-120 border-b ${
                  isActive
                    ? "text-text-primary border-primary"
                    : "text-text-tertiary border-transparent hover:text-text-secondary"
                } ease-out`}
                style={
                  isActive
                    ? { background: "rgba(99, 102, 241, 0.08)" }
                    : undefined
                }
                onClick={() => handleTabClick(tab.id)}
              >
                <TabIcon size={11} />
                <span>{tab.label}</span>
                {badge && (
                  <span
                    className={`text-[9px] px-1 rounded ${
                      tab.id === "validation" && errorCount > 0
                        ? "bg-red-500/20 text-red-400"
                        : "bg-bg-tertiary text-text-tertiary"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Collapse/expand toggle */}
        <button
          className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors ease-out"
          onClick={toggleExpanded}
          title={expanded ? "Collapse panel" : "Expand panel"}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>
      </div>

      {/* Content area */}
      {expanded && (
        <div
          className="flex flex-col overflow-hidden"
          style={{ height: height - 1 /* subtract drag handle pixel */ }}
        >
          {activeTab === "content" && <ContentBrowser />}
          {activeTab === "uiLayouts" && <UILayoutLibraryTab />}
          {activeTab === "plugins" && <PluginBrowserPanel />}
          {activeTab === "assetPacks" && <AssetPackBrowserPanelProjectBound />}
          {activeTab === "validation" && <ValidationTab />}
          {activeTab === "console" && <ConsoleTab />}
          {activeTab === "history" && <HistoryTab />}
        </div>
      )}
    </div>
  );
});
