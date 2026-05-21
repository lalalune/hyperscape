import {
  Layers,
  Play,
  RotateCcw,
  Download,
  EyeOff,
  Grid3x3,
  Loader2,
} from "lucide-react";
import React, { useRef, useState, useCallback } from "react";

import { ShellExtractionService } from "../../services/armor-pipeline/ShellExtractionService";
import type {
  EquipmentSlotName,
  BulkClass,
  ShellExtractionProgress,
  ShellExtractionResult,
} from "../../services/armor-pipeline/types";
import { BULK_OFFSETS } from "../../services/armor-pipeline/types";
import {
  AVATAR_OPTIONS,
  ALL_SLOTS,
  ALL_BULKS,
  SLOT_LABELS,
} from "../../services/armor-pipeline/constants";
import {
  ShellPreviewViewer,
  type ShellPreviewViewerRef,
} from "./ShellPreviewViewer";

type ViewMode = "regions" | "shell" | "all-shells";

interface ShellGeneratorTabProps {
  sharedExtraction?: ShellExtractionResult | null;
  onExtract?: (
    avatarUrl: string,
    onProgress?: (p: ShellExtractionProgress) => void,
    customOffsetM?: number,
  ) => Promise<ShellExtractionResult>;
}

export const ShellGeneratorTab: React.FC<ShellGeneratorTabProps> = ({
  sharedExtraction,
  onExtract,
}) => {
  const viewerRef = useRef<ShellPreviewViewerRef>(null);
  const serviceRef = useRef<ShellExtractionService | null>(null);

  // State
  const [avatarUrl, setAvatarUrl] = useState(AVATAR_OPTIONS[0].url);
  const [selectedSlots, setSelectedSlots] = useState<Set<EquipmentSlotName>>(
    new Set(ALL_SLOTS),
  );
  const [selectedBulk, setSelectedBulk] = useState<BulkClass | "custom">(
    "leather",
  );
  const [customThicknessMm, setCustomThicknessMm] = useState(50);
  const [viewMode, setViewMode] = useState<ViewMode>("regions");
  const [showWireframe, setShowWireframe] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(0.85);

  // Extraction state
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState<ShellExtractionProgress | null>(
    null,
  );
  const [result, setResult] = useState<ShellExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Log messages
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [
      ...prev.slice(-50),
      `[${new Date().toLocaleTimeString()}] ${msg}`,
    ]);
  }, []);

  const handleExtract = useCallback(async () => {
    setIsExtracting(true);
    setError(null);
    setResult(null);
    setLogs([]);

    try {
      const slots = Array.from(selectedSlots);
      addLog(`Starting extraction for ${slots.join(", ")} on ${avatarUrl}`);

      let extractionResult: ShellExtractionResult;

      if (onExtract) {
        // Use shared extraction (caches at page level)
        const customM =
          customThicknessMm > 0 ? customThicknessMm / 1000 : undefined;
        extractionResult = await onExtract(
          avatarUrl,
          (prog) => {
            setProgress(prog);
            addLog(prog.message);
          },
          customM,
        );
      } else {
        if (!serviceRef.current) {
          serviceRef.current = new ShellExtractionService();
        }
        const customM =
          customThicknessMm > 0 ? customThicknessMm / 1000 : undefined;
        extractionResult = await serviceRef.current.extractShells(
          avatarUrl,
          slots,
          ALL_BULKS,
          (prog) => {
            setProgress(prog);
            addLog(prog.message);
          },
          customM,
        );
      }

      setResult(extractionResult);
      addLog(
        `Extraction complete! ${extractionResult.shells.size} shells generated.`,
      );
      addLog(`Avatar height: ${extractionResult.avatarHeight.toFixed(3)}m`);

      viewerRef.current?.setAvatarScene(extractionResult.vrmScene);

      // Show regions overlay by default
      viewerRef.current?.showRegions(
        extractionResult.skinnedMesh,
        extractionResult.regions,
        extractionResult.processedGeometry,
      );
      addLog("Displaying avatar with region overlays.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      addLog(`ERROR: ${msg}`);
    } finally {
      setIsExtracting(false);
    }
  }, [avatarUrl, selectedSlots, customThicknessMm, addLog, onExtract]);

  const handleExportShell = useCallback(async () => {
    if (!result) return;
    // Ensure service is available — it may be null if extraction used the shared onExtract path
    if (!serviceRef.current) {
      serviceRef.current = new ShellExtractionService();
    }

    const bulkKey = selectedBulk;
    for (const slot of selectedSlots) {
      const key = `${slot}_${bulkKey}`;
      const shell = result.shells.get(key);
      if (!shell) continue;

      try {
        const blob = await serviceRef.current.exportShellAsGLB(shell);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `shell_${slot}_${bulkKey}.glb`;
        a.click();
        URL.revokeObjectURL(url);
        addLog(`Exported ${key}.glb (${(blob.size / 1024).toFixed(1)}KB)`);
      } catch (err) {
        addLog(`Export failed for ${key}: ${err}`);
      }
    }
  }, [result, selectedSlots, selectedBulk, addLog]);

  // Update viewer when view mode or selected bulk changes
  const updateViewerDisplay = useCallback(() => {
    if (!result) return;

    viewerRef.current?.clearOverlays();

    if (viewMode === "regions") {
      viewerRef.current?.showRegions(
        result.skinnedMesh,
        result.regions,
        result.processedGeometry,
      );
    } else if (viewMode === "shell") {
      // Show shells for each selected slot at the current bulk class
      for (const slot of selectedSlots) {
        const key = `${slot}_${selectedBulk}`;
        const shell = result.shells.get(key);
        if (shell) {
          viewerRef.current?.showShell(shell);
        }
      }
    } else if (viewMode === "all-shells") {
      viewerRef.current?.showShells(result.shells);
    }
  }, [result, viewMode, selectedBulk, selectedSlots]);

  // Re-render overlays when view mode or bulk selection changes
  React.useEffect(() => {
    updateViewerDisplay();
  }, [updateViewerDisplay]);

  const toggleSlot = (slot: EquipmentSlotName) => {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) {
        next.delete(slot);
      } else {
        next.add(slot);
      }
      return next;
    });
  };

  const toggleWireframe = () => {
    const next = !showWireframe;
    setShowWireframe(next);
    viewerRef.current?.setWireframe(next);
  };

  return (
    <div className="flex h-full">
      {/* Left panel — Controls */}
      <div className="w-80 flex-shrink-0 border-r border-border-primary bg-bg-primary overflow-y-auto">
        <div className="p-4 space-y-5">
          {/* Header */}
          <div>
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <Layers size={20} className="text-primary" />
              Shell Extraction
            </h2>
            <p className="text-xs text-text-tertiary mt-1">
              Extract body-fitting armor shells from VRM avatars
            </p>
          </div>

          {/* Avatar Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              Avatar
            </label>
            <select
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full bg-bg-secondary border border-border-primary rounded-lg px-5 py-4 text-sm text-text-primary"
            >
              {AVATAR_OPTIONS.map((opt) => (
                <option key={opt.url} value={opt.url}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Slot Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              Equipment Slots
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_SLOTS.map((slot) => (
                <button
                  key={slot}
                  onClick={() => toggleSlot(slot)}
                  className={`px-5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    selectedSlots.has(slot)
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-bg-secondary text-text-tertiary border border-border-primary hover:border-border-secondary"
                  } ease-out`}
                >
                  {SLOT_LABELS[slot]}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk Class Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              Bulk Class (for preview)
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_BULKS.map((bulk) => (
                <button
                  key={bulk}
                  onClick={() => setSelectedBulk(bulk)}
                  className={`px-5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    selectedBulk === bulk
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-bg-secondary text-text-tertiary border border-border-primary hover:border-border-secondary"
                  } ease-out`}
                >
                  {bulk} ({BULK_OFFSETS[bulk] * 1000}mm)
                </button>
              ))}
              <button
                onClick={() => setSelectedBulk("custom")}
                className={`px-5 py-1.5 rounded-md text-xs font-medium transition-all col-span-2 ${
                  selectedBulk === "custom"
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-bg-secondary text-text-tertiary border border-border-primary hover:border-border-secondary"
                } ease-out`}
              >
                Custom ({customThicknessMm}mm)
              </button>
            </div>
            {selectedBulk === "custom" && (
              <div className="flex items-center gap-2 mt-1.5">
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={customThicknessMm}
                  onChange={(e) =>
                    setCustomThicknessMm(parseInt(e.target.value, 10))
                  }
                  className="flex-1 accent-primary"
                />
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={customThicknessMm}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (v > 0) setCustomThicknessMm(v);
                  }}
                  className="w-16 bg-bg-secondary border border-border-primary rounded px-2 py-1 text-xs text-text-primary text-right"
                />
                <span className="text-xs text-text-tertiary">mm</span>
              </div>
            )}
          </div>

          {/* View Mode */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              View Mode
            </label>
            <div className="flex gap-1.5">
              {(
                [
                  { mode: "regions" as ViewMode, label: "Regions" },
                  { mode: "shell" as ViewMode, label: "Shell" },
                  { mode: "all-shells" as ViewMode, label: "All Shells" },
                ] as const
              ).map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === mode
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-bg-secondary text-text-tertiary border border-border-primary"
                  } ease-out`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Overlay Opacity */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              Overlay Opacity
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={overlayOpacity}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setOverlayOpacity(val);
                  viewerRef.current?.setOverlayOpacity(val);
                }}
                className="flex-1 accent-primary"
              />
              <span className="text-xs text-text-tertiary w-8 text-right">
                {Math.round(overlayOpacity * 100)}%
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-2 border-t border-border-primary">
            <button
              onClick={handleExtract}
              disabled={isExtracting || selectedSlots.size === 0}
              className="w-full px-4 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2
 bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed ease-out"
            >
              {isExtracting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Extract Shells
                </>
              )}
            </button>

            <div className="flex gap-2">
              <button
                onClick={toggleWireframe}
                className="flex-1 px-5 py-4 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5
 bg-bg-secondary border border-border-primary text-text-secondary hover:text-text-primary hover:border-border-secondary ease-out"
              >
                {showWireframe ? <EyeOff size={14} /> : <Grid3x3 size={14} />}
                Wireframe
              </button>

              <button
                onClick={handleExportShell}
                disabled={!result}
                className="flex-1 px-5 py-4 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5
 bg-bg-secondary border border-border-primary text-text-secondary hover:text-text-primary hover:border-border-secondary
 disabled:opacity-50 disabled:cursor-not-allowed ease-out"
              >
                <Download size={14} />
                Export GLB
              </button>
            </div>

            <button
              onClick={() => {
                viewerRef.current?.clear();
                setResult(null);
                setLogs([]);
                setError(null);
              }}
              className="w-full px-5 py-4 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5
 bg-bg-secondary border border-border-primary text-text-secondary hover:text-text-primary hover:border-border-secondary ease-out"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          </div>

          {/* Progress */}
          {progress && isExtracting && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-text-tertiary">
                <span className="capitalize">{progress.stage}</span>
                <span>{Math.round(progress.progress * 100)}%</span>
              </div>
              <div className="w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress.progress * 100}%` }}
                />
              </div>
              <p className="text-xs text-text-tertiary truncate">
                {progress.message}
              </p>
            </div>
          )}

          {/* Results summary */}
          {result && (
            <div className="p-5 bg-bg-secondary rounded-lg border border-border-primary space-y-1">
              <h3 className="text-xs font-semibold text-text-primary">
                Results
              </h3>
              <p className="text-xs text-text-tertiary">
                Regions: {result.regions.size}
              </p>
              <p className="text-xs text-text-tertiary">
                Shells: {result.shells.size}
              </p>
              <p className="text-xs text-text-tertiary">
                Height: {result.avatarHeight.toFixed(3)}m
              </p>
              {Array.from(result.regions.entries()).map(([slot, region]) => (
                <p key={slot} className="text-xs text-text-tertiary">
                  {slot}: {region.vertexIndices.length} verts,{" "}
                  {region.triangleIndices.length / 3} tris
                </p>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Center — 3D Viewer */}
      <div className="flex-1 flex flex-col">
        <ShellPreviewViewer ref={viewerRef} className="flex-1" />

        {/* Bottom log panel */}
        <div
          className="h-32 border-t border-border-primary bg-bg-primary overflow-y-auto"
          ref={(el) => {
            if (el) el.scrollTop = el.scrollHeight;
          }}
        >
          <div className="p-2 space-y-0.5">
            {logs.length === 0 ? (
              <p className="text-xs text-text-tertiary italic">
                Select an avatar and click &quot;Extract Shells&quot; to begin
              </p>
            ) : (
              logs.map((log, i) => (
                <p
                  key={i}
                  className={`text-xs font-mono ${
                    log.includes("ERROR")
                      ? "text-red-400"
                      : log.includes("complete")
                        ? "text-green-400"
                        : "text-text-tertiary"
                  }`}
                >
                  {log}
                </p>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
