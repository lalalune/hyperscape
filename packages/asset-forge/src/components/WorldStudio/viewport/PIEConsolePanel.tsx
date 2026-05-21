/**
 * PIEConsolePanel — Live debug log for the Play-In-Editor session.
 *
 * Mirrors UE5's "Output Log" while a PIE session is active. Reads entries
 * from `usePIEDebugStore` (populated by PlayTestWorld → PIEScriptRunner via
 * its `debugSink`) and renders them in a scrolling, collapsible floating
 * panel docked to the viewport.
 *
 * Visibility is gated externally — the parent should only mount this when
 * `state.pie.active` is true, so the panel disappears when PIE stops.
 *
 * Design language matches ViewportOverlay (frosted glass, explicit colors,
 * mono font) so it sits comfortably on top of the 3D scene.
 */

import {
  ChevronDown,
  ChevronUp,
  Trash2,
  Terminal,
  Zap,
  Play,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { PIEDebugEntry, PIEDebugLevel } from "@hyperforge/shared/runtime";
import { usePIEDebugStore } from "../../../editor/stores/usePIEDebugStore";

// ---------------------------------------------------------------------------
// Style tokens — match ViewportOverlay's frosted-glass language
// ---------------------------------------------------------------------------

const PANEL =
  "bg-[rgba(8,9,14,0.92)] backdrop-blur-xl border border-white/[0.08] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.6)]";

const HEADER_BTN =
  "p-1 rounded text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors";

const FILTER_BTN_OFF =
  "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider bg-[#141416] text-white/45 hover:text-white/80 hover:bg-[#1e1f28] border border-[#1C1E22] transition-colors";

const FILTER_BTN_ON =
  "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider bg-[rgba(99,102,241,0.18)] text-primary border border-primary/40 transition-colors";

// ---------------------------------------------------------------------------
// Per-level visual treatment
// ---------------------------------------------------------------------------

const LEVEL_META: Record<
  PIEDebugLevel,
  { color: string; bg: string; icon: typeof Zap; label: string }
> = {
  trigger: {
    color: "text-amber-300",
    bg: "bg-amber-500/[0.08]",
    icon: Zap,
    label: "TRIG",
  },
  action: {
    color: "text-sky-300",
    bg: "bg-sky-500/[0.06]",
    icon: Play,
    label: "ACT",
  },
  error: {
    color: "text-red-400",
    bg: "bg-red-500/[0.10]",
    icon: AlertTriangle,
    label: "ERR",
  },
  info: {
    color: "text-white/70",
    bg: "bg-white/[0.03]",
    icon: Info,
    label: "INFO",
  },
};

const ALL_LEVELS: PIEDebugLevel[] = ["trigger", "action", "error", "info"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function formatData(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  const keys = Object.keys(data);
  if (keys.length === 0) return null;
  // Compact one-line JSON for inline display.
  try {
    return JSON.stringify(data);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MAX_ROWS_VISIBLE = 200;

export function PIEConsolePanel() {
  const entries = usePIEDebugStore((s) => s.entries);
  const clear = usePIEDebugStore((s) => s.clear);

  const [collapsed, setCollapsed] = useState(false);
  const [enabledLevels, setEnabledLevels] = useState<Set<PIEDebugLevel>>(
    () => new Set(ALL_LEVELS),
  );

  const filtered = useMemo(() => {
    const out: PIEDebugEntry[] = [];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]!;
      if (enabledLevels.has(e.level)) out.push(e);
    }
    // Cap visible rows so a runaway script doesn't blow up the DOM.
    return out.length > MAX_ROWS_VISIBLE
      ? out.slice(out.length - MAX_ROWS_VISIBLE)
      : out;
  }, [entries, enabledLevels]);

  // Auto-scroll to bottom when new entries arrive (unless user scrolled up).
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distFromBottom < 8;
  };

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [filtered]);

  const toggleLevel = (level: PIEDebugLevel) => {
    setEnabledLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        // Don't allow disabling the last filter — keeps UX sane.
        if (next.size === 1) return prev;
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  return (
    <div
      className={`${PANEL} pointer-events-auto flex flex-col font-mono text-[10px] w-[420px] ${
        collapsed ? "" : "max-h-[260px]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-white/[0.06]">
        <Terminal size={11} className="text-primary" />
        <span className="text-[10px] uppercase tracking-wider font-medium text-white/80">
          PIE Console
        </span>
        <span className="text-white/30 text-[9px]">
          {entries.length}
          {entries.length !== filtered.length && ` · ${filtered.length} shown`}
        </span>

        <div className="flex-1" />

        {/* Level filters */}
        {!collapsed &&
          ALL_LEVELS.map((level) => {
            const meta = LEVEL_META[level];
            const on = enabledLevels.has(level);
            const Icon = meta.icon;
            return (
              <button
                key={level}
                className={on ? FILTER_BTN_ON : FILTER_BTN_OFF}
                onClick={() => toggleLevel(level)}
                title={`${on ? "Hide" : "Show"} ${level} entries`}
              >
                <Icon size={8} />
                {meta.label}
              </button>
            );
          })}

        {!collapsed && (
          <button className={HEADER_BTN} onClick={clear} title="Clear console">
            <Trash2 size={11} />
          </button>
        )}

        <button
          className={HEADER_BTN}
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {/* Body */}
      {!collapsed && (
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-white/30 text-[10px]">
              No script output yet — interact with the world or wait for
              triggers to fire.
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {filtered.map((e, i) => {
                const meta = LEVEL_META[e.level];
                const Icon = meta.icon;
                const dataStr = formatData(e.data);
                return (
                  <li
                    key={`${e.ts}-${i}`}
                    className={`flex items-start gap-2 px-2 py-1 ${meta.bg}`}
                  >
                    <Icon
                      size={10}
                      className={`${meta.color} mt-[2px] shrink-0`}
                    />
                    <span className="text-white/30 shrink-0 tabular-nums">
                      {formatTime(e.ts)}
                    </span>
                    <span className={`${meta.color} shrink-0 font-semibold`}>
                      {meta.label}
                    </span>
                    <span className="text-white/50 shrink-0 truncate max-w-[120px]">
                      {e.source}
                    </span>
                    {e.entityId && (
                      <span className="text-white/30 shrink-0 truncate max-w-[100px]">
                        {e.entityId}
                      </span>
                    )}
                    <span className="text-white/85 break-words min-w-0">
                      {e.message}
                      {dataStr && (
                        <span className="text-white/35 ml-1">{dataStr}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
