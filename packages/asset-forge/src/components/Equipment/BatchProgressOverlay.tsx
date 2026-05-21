import {
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  Check,
  SkipForward,
} from "lucide-react";
import React from "react";

import { cn } from "../../styles";

// Simple spinner overlay for quick batch operations (e.g. apply fitting)
export interface BatchProgress {
  current: number;
  total: number;
  currentAsset: string;
  phase: "applying" | "exporting";
}

interface BatchProgressOverlayProps {
  progress: BatchProgress;
  onCancel: () => void;
}

export const BatchProgressOverlay: React.FC<BatchProgressOverlayProps> = ({
  progress,
  onCancel,
}) => {
  const percentage = Math.round((progress.current / progress.total) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 ">
      <div className="bg-bg-primary border border-border-primary rounded-2xl shadow-2xl p-6 w-96 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">
            Applying Fitting Config
          </h3>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-bg-tertiary/30 text-text-tertiary hover:text-text-primary transition-colors ease-out"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 size={14} className="animate-spin text-primary" />
          <span className="truncate">{progress.currentAsset}</span>
        </div>

        <div className="space-y-1">
          <div className="w-full h-2 bg-bg-tertiary/30 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 bg-amber-500 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <span>
              {progress.current} / {progress.total}
            </span>
            <span>{percentage}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Review bar for stepping through weapons before export
export interface BatchReviewState {
  weapons: { id: string; name: string }[];
  currentIndex: number;
  exported: Set<string>;
  isExporting: boolean;
}

interface BatchReviewBarProps {
  review: BatchReviewState;
  onPrev: () => void;
  onNext: () => void;
  onExportCurrent: () => void;
  onExportAll: () => void;
  onSkip: () => void;
  onDone: () => void;
}

export const BatchReviewBar: React.FC<BatchReviewBarProps> = ({
  review,
  onPrev,
  onNext,
  onExportCurrent,
  onExportAll,
  onSkip,
  onDone,
}) => {
  const current = review.weapons[review.currentIndex];
  const isExported = current ? review.exported.has(current.id) : false;
  const exportedCount = review.exported.size;
  const total = review.weapons.length;
  const allExported = exportedCount === total;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 bg-bg-primary/90 border-t border-border-primary">
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Navigation */}
        <button
          onClick={onPrev}
          disabled={review.currentIndex === 0 || review.isExporting}
          className={cn(
            "p-2 rounded-lg border border-border-primary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/30 transition-colors",
            (review.currentIndex === 0 || review.isExporting) &&
              "opacity-40 cursor-not-allowed",
          )}
        >
          <ChevronLeft size={18} />
        </button>

        {/* Current weapon info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary font-mono">
              {review.currentIndex + 1}/{total}
            </span>
            <span className="text-sm font-medium text-text-primary truncate">
              {current?.name || "—"}
            </span>
            {isExported && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <Check size={12} />
                exported
              </span>
            )}
          </div>
          {/* Progress dots */}
          <div className="flex gap-1 mt-1.5">
            {review.weapons.map((w, i) => (
              <div
                key={w.id}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === review.currentIndex ? "w-4" : "w-1.5",
                  review.exported.has(w.id)
                    ? "bg-emerald-500"
                    : i === review.currentIndex
                      ? "bg-primary"
                      : "bg-bg-tertiary/50",
                )}
              />
            ))}
          </div>
        </div>

        <button
          onClick={onNext}
          disabled={review.currentIndex === total - 1 || review.isExporting}
          className={cn(
            "p-2 rounded-lg border border-border-primary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/30 transition-colors",
            (review.currentIndex === total - 1 || review.isExporting) &&
              "opacity-40 cursor-not-allowed",
          )}
        >
          <ChevronRight size={18} />
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-bg-tertiary" />

        {/* Actions */}
        {review.isExporting ? (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Loader2 size={14} className="animate-spin" />
            Exporting...
          </div>
        ) : (
          <>
            <button
              onClick={onSkip}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary/20 transition-colors flex items-center gap-1.5 ease-out"
            >
              <SkipForward size={12} />
              Skip
            </button>
            <button
              onClick={onExportCurrent}
              disabled={isExported}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all",
                isExported
                  ? "bg-emerald-500/10 text-emerald-400/50 cursor-not-allowed"
                  : "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30",
              )}
            >
              <Download size={14} />
              {isExported ? "Exported" : "Export"}
            </button>
            <button
              onClick={allExported ? onDone : onExportAll}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all",
                allExported
                  ? "bg-primary/80 text-white hover:bg-primary"
                  : "bg-bg-secondary/50 border border-border-primary text-text-primary hover:bg-bg-secondary/70",
              )}
            >
              {allExported ? (
                <>
                  <Check size={14} />
                  Done
                </>
              ) : exportedCount > 0 ? (
                `Export Remaining (${total - exportedCount})`
              ) : (
                `Export All (${total})`
              )}
            </button>
          </>
        )}

        {/* Close */}
        <button
          onClick={onDone}
          disabled={review.isExporting}
          className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary/30 transition-colors ease-out"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
