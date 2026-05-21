/**
 * WizardStatusViews — Full-screen status views for generating, error, and complete states
 */

import { Loader2, AlertTriangle, Check } from "lucide-react";

import type {
  TownStageResult,
  RoadZoneStageResult,
  PopulationStageResult,
} from "../../hooks/useZoneAutoGen";

// ============== GENERATING VIEW ==============

export function GeneratingView({
  progress,
  label,
  onCancel,
}: {
  progress: number;
  label: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <Loader2 size={32} className="text-primary animate-spin" />
      <div className="text-sm text-text-primary font-medium">
        {label || "Generating..."}
      </div>
      <div className="w-64 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-[10px] text-text-tertiary tabular-nums">
        {Math.round(progress)}%
      </span>
      <button
        className="text-xs text-text-tertiary hover:text-text-secondary mt-4"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  );
}

// ============== ERROR VIEW ==============

export function ErrorView({
  message,
  recoverable,
  onRetry,
  onCancel,
}: {
  message: string;
  recoverable: boolean;
  onRetry: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
        <AlertTriangle size={24} className="text-red-400" />
      </div>
      <div className="text-sm text-text-primary font-medium">
        Generation Failed
      </div>
      <p className="text-xs text-text-secondary max-w-md text-center">
        {message}
      </p>
      <div className="flex items-center gap-2">
        {recoverable && (
          <button
            className="px-4 py-1.5 rounded bg-primary text-white text-xs font-medium hover:bg-primary/90"
            onClick={onRetry}
          >
            Retry
          </button>
        )}
        <button
          className="px-4 py-1.5 rounded bg-bg-tertiary text-text-primary text-xs hover:bg-bg-secondary"
          onClick={onCancel}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ============== COMPLETE VIEW ==============

export function CompleteView({
  stageResults,
  onClose,
}: {
  stageResults: {
    towns?: TownStageResult;
    roadsZones?: RoadZoneStageResult;
    population?: PopulationStageResult;
  };
  onClose: () => void;
}) {
  const townCount = stageResults.towns?.generatedTowns.length ?? 0;
  const zoneCount = stageResults.roadsZones?.stats.zonesGenerated ?? 0;
  const mobCount = stageResults.population?.stats.totalMobs ?? 0;
  const resCount = stageResults.population?.stats.totalResources ?? 0;
  const mineCount = stageResults.population?.stats.totalMines ?? 0;
  const roadCount = stageResults.roadsZones?.roads.length ?? 0;

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-3">
      <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
        <Check size={24} className="text-green-400" />
      </div>
      <h3 className="text-sm font-semibold text-text-primary">
        World Generation Complete
      </h3>
      <p className="text-xs text-text-secondary max-w-sm text-center">
        Created {townCount} towns, {zoneCount} zones, {roadCount} roads,{" "}
        {mineCount} mines, {mobCount} mob spawns, and {resCount} resources. All
        entities tagged{" "}
        <code className="bg-bg-tertiary px-1 rounded">source: procgen</code>.
      </p>
      <button
        className="px-4 py-1.5 rounded bg-bg-tertiary text-text-primary text-xs font-medium hover:bg-bg-secondary mt-2"
        onClick={onClose}
      >
        Done
      </button>
    </div>
  );
}
