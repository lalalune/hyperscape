/**
 * PerformancePanel.tsx - Performance Debug UI
 *
 * Displays comprehensive performance metrics in a collapsible panel:
 * - FPS counter (current, average, min, max)
 * - Frame time breakdown by phase
 * - Individual system timing
 * - Entity counts and statistics
 * - Memory usage
 * - Render statistics
 *
 * **Features**:
 * - Collapsible UI with sections
 * - State persisted to localStorage
 * - Color-coded FPS (green/yellow/red)
 * - Sortable system timings
 * - Enabled in dev mode only
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import type { PerformanceSnapshot } from "@hyperscape/shared";

const STORAGE_KEY = "hyperscape_perf_panel_state";

interface PanelState {
  collapsed: boolean;
  sections: {
    fps: boolean;
    phases: boolean;
    systems: boolean;
    entities: boolean;
    memory: boolean;
    render: boolean;
    physics: boolean;
    terrain: boolean;
  };
}

const defaultState: PanelState = {
  collapsed: true,
  sections: {
    fps: true,
    phases: false,
    systems: false,
    entities: true,
    memory: false,
    render: false,
    physics: false,
    terrain: false,
  },
};

function loadState(): PanelState {
  if (typeof localStorage === "undefined") return defaultState;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return defaultState;
  const parsed = JSON.parse(stored) as Partial<PanelState>;
  return {
    ...defaultState,
    ...parsed,
    sections: { ...defaultState.sections, ...parsed.sections },
  };
}

function saveState(state: PanelState): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFpsColor(fps: number): string {
  if (fps >= 55) return "text-green-400";
  if (fps >= 30) return "text-yellow-400";
  return "text-red-400";
}

function formatMs(ms: number): string {
  if (ms < 0.01) return "<0.01";
  if (ms < 1) return ms.toFixed(2);
  return ms.toFixed(1);
}

interface SectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ title, expanded, onToggle, children }: SectionProps) {
  return (
    <div className="border-t border-gray-700 first:border-t-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-2 py-1 hover:bg-gray-800 text-xs font-medium"
      >
        <span>{title}</span>
        <span className="text-gray-500">{expanded ? "▼" : "▶"}</span>
      </button>
      {expanded && <div className="px-2 pb-2 text-xs">{children}</div>}
    </div>
  );
}

interface PerformancePanelProps {
  /** Performance monitor instance from world */
  monitor?: {
    isEnabled: () => boolean;
    setEnabled: (enabled: boolean) => void;
    onUpdate: (callback: (snapshot: PerformanceSnapshot) => void) => () => void;
    getSnapshot: () => PerformanceSnapshot | null;
  };
  /** Override visibility (useful for testing) */
  visible?: boolean;
}

export function PerformancePanel({ monitor, visible }: PerformancePanelProps) {
  const [state, setState] = useState<PanelState>(loadState);
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const stateRef = useRef(state);

  // Keep ref in sync for cleanup
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Subscribe to performance updates and poll enabled state
  useEffect(() => {
    if (!monitor) return;

    // Check enabled state immediately and periodically
    // (needed because init() runs async after component mounts)
    const checkEnabled = () => setIsEnabled(monitor.isEnabled());
    checkEnabled();
    const enabledInterval = setInterval(checkEnabled, 500);

    const unsubscribe = monitor.onUpdate((snap) => {
      setSnapshot(snap);
      setIsEnabled(true); // If we're getting updates, we're enabled
    });

    // Get initial snapshot
    const initial = monitor.getSnapshot();
    if (initial) setSnapshot(initial);

    return () => {
      clearInterval(enabledInterval);
      unsubscribe();
    };
  }, [monitor]);

  // Save state changes to localStorage
  useEffect(() => {
    saveState(state);
  }, [state]);

  const toggleCollapsed = useCallback(() => {
    setState((s) => ({ ...s, collapsed: !s.collapsed }));
  }, []);

  const toggleSection = useCallback((section: keyof PanelState["sections"]) => {
    setState((s) => ({
      ...s,
      sections: { ...s.sections, [section]: !s.sections[section] },
    }));
  }, []);

  // Check if we should show the panel
  // Use Vite's import.meta.env for browser, fallback to process.env for Node
  const isDev = (() => {
    // @ts-expect-error - import.meta.env is injected by Vite at build time
    if (typeof import.meta !== "undefined" && import.meta.env) {
      // @ts-expect-error - Vite injects this
      return (
        import.meta.env.DEV === true || import.meta.env.MODE === "development"
      );
    }
    if (typeof process !== "undefined" && process.env) {
      return process.env.NODE_ENV === "development";
    }
    return false;
  })();
  const shouldShow = visible ?? isDev;

  // Don't show if:
  // 1. Not in dev mode (unless visible override)
  // 2. No monitor provided
  // 3. Monitor is not enabled (yet)
  if (!shouldShow || !monitor || !isEnabled) {
    return null;
  }

  // Collapsed state - just show FPS badge
  if (state.collapsed) {
    return (
      <div
        className="fixed top-2 left-2 bg-black/90 border border-gray-700 rounded px-2 py-1 text-white cursor-pointer select-none z-[9999] pointer-events-auto"
        onClick={toggleCollapsed}
        data-testid="perf-panel-collapsed"
      >
        <span className="text-xs font-mono">
          <span className={getFpsColor(snapshot?.fps.current || 0)}>
            {snapshot?.fps.current || "--"} FPS
          </span>
          <span className="text-gray-500 ml-2">
            {snapshot?.fps.frameTime
              ? `${formatMs(snapshot.fps.frameTime)}ms`
              : "--"}
          </span>
        </span>
      </div>
    );
  }

  // Expanded state
  return (
    <div
      className="fixed top-2 left-2 bg-black/95 border border-gray-700 rounded text-white w-72 max-h-[80vh] overflow-y-auto z-[9999] font-mono text-xs pointer-events-auto"
      data-testid="perf-panel-expanded"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-2 py-1 bg-gray-900 cursor-pointer"
        onClick={toggleCollapsed}
      >
        <span className="font-bold text-sm">Performance</span>
        <span className="text-gray-500">▲</span>
      </div>

      {/* FPS Section */}
      <Section
        title="FPS & Frame Time"
        expanded={state.sections.fps}
        onToggle={() => toggleSection("fps")}
      >
        {snapshot?.fps && (
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Current:</span>
              <span className={getFpsColor(snapshot.fps.current)}>
                {snapshot.fps.current} FPS
              </span>
            </div>
            <div className="flex justify-between">
              <span>Average:</span>
              <span>{snapshot.fps.average} FPS</span>
            </div>
            <div className="flex justify-between">
              <span>Min/Max:</span>
              <span>
                {snapshot.fps.min} / {snapshot.fps.max}
              </span>
            </div>
            <div className="flex justify-between">
              <span>1% Low:</span>
              <span className={getFpsColor(snapshot.fps.onePercentLow || 0)}>
                {snapshot.fps.onePercentLow || "--"} FPS
              </span>
            </div>
            <div className="flex justify-between">
              <span>Frame Time:</span>
              <span>{formatMs(snapshot.fps.frameTime)}ms</span>
            </div>
            {/* Frame time bar */}
            <div className="h-2 bg-gray-800 rounded overflow-hidden">
              <div
                className={`h-full ${
                  snapshot.fps.frameTime < 16.67
                    ? "bg-green-500"
                    : snapshot.fps.frameTime < 33.33
                      ? "bg-yellow-500"
                      : "bg-red-500"
                }`}
                style={{
                  width: `${Math.min(100, (snapshot.fps.frameTime / 50) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
      </Section>

      {/* Frame Phases Section */}
      <Section
        title="Frame Phases"
        expanded={state.sections.phases}
        onToggle={() => toggleSection("phases")}
      >
        {snapshot?.phases && snapshot.phases.length > 0 ? (
          <div className="space-y-1">
            {snapshot.phases.map((phase) => (
              <div key={phase.name} className="flex justify-between">
                <span className="text-gray-400">{phase.name}:</span>
                <span>
                  {formatMs(phase.duration)}ms ({phase.percentage.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-gray-500">No phase data</span>
        )}
      </Section>

      {/* Systems Section */}
      <Section
        title="System Timing"
        expanded={state.sections.systems}
        onToggle={() => toggleSection("systems")}
      >
        {snapshot?.systems && snapshot.systems.length > 0 ? (
          <div className="space-y-1">
            {snapshot.systems.slice(0, 15).map((sys) => (
              <div key={sys.name} className="flex justify-between">
                <span className="text-gray-400 truncate max-w-[140px]">
                  {sys.name}:
                </span>
                <span>
                  {formatMs(sys.duration)}ms ({sys.percentage.toFixed(1)}%)
                </span>
              </div>
            ))}
            {snapshot.systems.length > 15 && (
              <span className="text-gray-500">
                +{snapshot.systems.length - 15} more
              </span>
            )}
          </div>
        ) : (
          <span className="text-gray-500">No system data</span>
        )}
      </Section>

      {/* Entities Section */}
      <Section
        title="Entities"
        expanded={state.sections.entities}
        onToggle={() => toggleSection("entities")}
      >
        {snapshot?.entities && (
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Total:</span>
              <span className="text-blue-400">{snapshot.entities.total}</span>
            </div>
            <div className="flex justify-between">
              <span>Players:</span>
              <span>{snapshot.entities.players}</span>
            </div>
            <div className="flex justify-between">
              <span>Mobs:</span>
              <span>{snapshot.entities.mobs}</span>
            </div>
            <div className="flex justify-between">
              <span>NPCs:</span>
              <span>{snapshot.entities.npcs}</span>
            </div>
            <div className="flex justify-between">
              <span>Items:</span>
              <span>{snapshot.entities.items}</span>
            </div>
            <div className="flex justify-between">
              <span>Resources:</span>
              <span>{snapshot.entities.resources}</span>
            </div>
            <div className="flex justify-between border-t border-gray-700 pt-1 mt-1">
              <span>Hot (updating):</span>
              <span className="text-yellow-400">{snapshot.entities.hot}</span>
            </div>
          </div>
        )}
      </Section>

      {/* Memory Section */}
      <Section
        title="Memory"
        expanded={state.sections.memory}
        onToggle={() => toggleSection("memory")}
      >
        {snapshot?.memory ? (
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Used Heap:</span>
              <span>{formatBytes(snapshot.memory.usedJSHeapSize)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Heap:</span>
              <span>{formatBytes(snapshot.memory.totalJSHeapSize)}</span>
            </div>
            <div className="flex justify-between">
              <span>Heap Limit:</span>
              <span>{formatBytes(snapshot.memory.jsHeapSizeLimit)}</span>
            </div>
            {/* Memory bar */}
            <div className="h-2 bg-gray-800 rounded overflow-hidden">
              <div
                className="h-full bg-blue-500"
                style={{
                  width: `${
                    (snapshot.memory.usedJSHeapSize /
                      snapshot.memory.jsHeapSizeLimit) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>
        ) : (
          <span className="text-gray-500">Memory API not available</span>
        )}
      </Section>

      {/* Render Stats Section */}
      <Section
        title="Render Stats"
        expanded={state.sections.render}
        onToggle={() => toggleSection("render")}
      >
        {snapshot?.renderStats ? (
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Draw Calls:</span>
              <span>{snapshot.renderStats.drawCalls}</span>
            </div>
            <div className="flex justify-between">
              <span>Triangles:</span>
              <span>{snapshot.renderStats.triangles.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Textures:</span>
              <span>{snapshot.renderStats.textures}</span>
            </div>
            <div className="flex justify-between">
              <span>Geometries:</span>
              <span>{snapshot.renderStats.geometries}</span>
            </div>
            <div className="flex justify-between">
              <span>Programs:</span>
              <span>{snapshot.renderStats.programs}</span>
            </div>
          </div>
        ) : (
          <span className="text-gray-500">No render stats</span>
        )}
      </Section>

      {/* Physics Section */}
      <Section
        title="Physics"
        expanded={state.sections.physics}
        onToggle={() => toggleSection("physics")}
      >
        {snapshot?.physics ? (
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Bodies:</span>
              <span>{snapshot.physics.bodies}</span>
            </div>
            <div className="flex justify-between">
              <span>Shapes:</span>
              <span>{snapshot.physics.shapes}</span>
            </div>
            <div className="flex justify-between">
              <span>Contacts:</span>
              <span>{snapshot.physics.contacts}</span>
            </div>
          </div>
        ) : (
          <span className="text-gray-500">No physics stats</span>
        )}
      </Section>

      {/* Terrain Section */}
      <Section
        title="Terrain"
        expanded={state.sections.terrain}
        onToggle={() => toggleSection("terrain")}
      >
        {snapshot?.terrain ? (
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Active Tiles:</span>
              <span>{snapshot.terrain.activeTiles}</span>
            </div>
            <div className="flex justify-between">
              <span>Pending Tiles:</span>
              <span
                className={
                  snapshot.terrain.pendingTiles > 0 ? "text-yellow-400" : ""
                }
              >
                {snapshot.terrain.pendingTiles}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Visible Chunks:</span>
              <span>{snapshot.terrain.visibleChunks}</span>
            </div>
          </div>
        ) : (
          <span className="text-gray-500">No terrain stats</span>
        )}
      </Section>

      {/* Footer */}
      <div className="px-2 py-1 bg-gray-900 text-gray-500 text-[10px] flex justify-between">
        <span>Press F10 to toggle</span>
        <span>Dev Mode</span>
      </div>
    </div>
  );
}

export default PerformancePanel;
