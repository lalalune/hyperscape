import {
  Crown,
  Info,
  Loader2,
  Download,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Check,
  Clock,
  X,
  Wand2,
} from "lucide-react";
import React, { useRef, useState, useCallback, useEffect } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { ArmorTextureService } from "../../services/armor-pipeline/ArmorTextureService";
import type { TextureTaskStatus } from "../../services/armor-pipeline/ArmorTextureService";
import { ShellExtractionService } from "../../services/armor-pipeline/ShellExtractionService";
import type {
  EquipmentSlotName,
  BulkClass,
  ShellExtractionResult,
  ShellMesh,
} from "../../services/armor-pipeline/types";
import { BULK_OFFSETS } from "../../services/armor-pipeline/types";
import {
  AVATAR_OPTIONS,
  ALL_SLOTS,
  ALL_BULKS,
  SLOT_LABELS,
  MATERIAL_TIERS,
  DETAIL_LEVELS,
  TIER_SHAPE_PREFIX,
} from "../../services/armor-pipeline/constants";
import type { MaterialTier } from "../../services/armor-pipeline/constants";
import {
  ShellPreviewViewer,
  type ShellPreviewViewerRef,
} from "./ShellPreviewViewer";

type TierTaskStatus =
  | "idle"
  | "pending"
  | "processing"
  | "succeeded"
  | "failed";

interface TierTask {
  tier: MaterialTier;
  taskId: string | null;
  status: TierTaskStatus;
  progress: number;
  error?: string;
  downloadUrl?: string;
}

type Stage =
  | "idle"
  | "extracting"
  | "uploading"
  | "texturing"
  | "done"
  | "error";

interface TierGeneratorTabProps {
  onAddToKit?: (shell: ShellMesh, texturedGlbUrl: string) => void;
  sharedExtraction?: ShellExtractionResult | null;
  onExtract?: (
    avatarUrl: string,
    onProgress?: (
      p: import("../../services/armor-pipeline/types").ShellExtractionProgress,
    ) => void,
  ) => Promise<ShellExtractionResult>;
}

export const TierGeneratorTab: React.FC<TierGeneratorTabProps> = ({
  onAddToKit,
  sharedExtraction,
  onExtract,
}) => {
  const viewerRef = useRef<ShellPreviewViewerRef>(null);
  const shellServiceRef = useRef<ShellExtractionService | null>(null);
  const textureServiceRef = useRef<ArmorTextureService | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unmountedRef = useRef(false);

  // Settings
  const [avatarUrl, setAvatarUrl] = useState(AVATAR_OPTIONS[0].url);
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlotName>("body");
  const [selectedBulk, setSelectedBulk] = useState<BulkClass>("plate");
  const [enabledTiers, setEnabledTiers] = useState<Set<string>>(
    () => new Set(MATERIAL_TIERS.map((t) => t.id)),
  );
  // Per-tier editable prompts (initialized from defaults)
  const [tierPrompts, setTierPrompts] = useState<Record<string, string>>(() =>
    Object.fromEntries(MATERIAL_TIERS.map((t) => [t.id, t.prompt])),
  );
  const [expandedTier, setExpandedTier] = useState<string | null>(null);
  const [detailLevel, setDetailLevel] = useState<string>("plain");

  // State
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [tierTasks, setTierTasks] = useState<TierTask[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);

  // Shell extraction result
  const [extractionResult, setExtractionResult] =
    useState<ShellExtractionResult | null>(null);
  const [currentShell, setCurrentShell] = useState<ShellMesh | null>(null);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [
      ...prev.slice(-80),
      `[${new Date().toLocaleTimeString()}] ${msg}`,
    ]);
  }, []);

  const toggleTier = useCallback((tierId: string) => {
    setEnabledTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tierId)) next.delete(tierId);
      else next.add(tierId);
      return next;
    });
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    const selectedTiers = MATERIAL_TIERS.filter((t) => enabledTiers.has(t.id));
    if (selectedTiers.length === 0) {
      setError("Select at least one tier");
      return;
    }

    // Clear any previous polling interval to avoid leaks
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    setStage("extracting");
    setError(null);
    setLogs([]);
    setTierTasks([]);
    setSelectedPreview(null);

    try {
      // Initialize services
      if (!shellServiceRef.current) {
        shellServiceRef.current = new ShellExtractionService();
      }
      if (!textureServiceRef.current) {
        textureServiceRef.current = new ArmorTextureService();
      }

      // Step 1: Extract shell (use shared cache or extract locally)
      let result = extractionResult ?? sharedExtraction ?? null;
      if (!result || result.avatarHeight === 0) {
        if (onExtract) {
          addLog("Extracting shell from avatar (shared)...");
          result = await onExtract(avatarUrl, (prog) => addLog(prog.message));
        } else {
          addLog("Extracting shell from avatar...");
          result = await shellServiceRef.current.extractShells(
            avatarUrl,
            ALL_SLOTS,
            ALL_BULKS,
            (prog) => addLog(prog.message),
          );
        }
        setExtractionResult(result);
        addLog(`Shell extraction complete. ${result.shells.size} shells.`);
      } else {
        setExtractionResult(result);
        addLog("Reusing cached shell extraction.");
      }

      viewerRef.current?.setAvatarScene(result.vrmScene);

      // Step 2: Export selected shell as GLB
      const shellKey = `${selectedSlot}_${selectedBulk}`;
      const shell = result.shells.get(shellKey);
      if (!shell) throw new Error(`Shell not found: ${shellKey}`);

      setCurrentShell(shell);
      addLog(`Exporting ${shellKey} as GLB (pre-painted metallic silver)...`);
      // Pre-paint with bright metallic silver — Meshy sees "metal plate" not "body"
      // Individual tier colors come from per-tier style swatch + prompt
      const glbBlob = await shellServiceRef.current.exportShellAsGLB(
        shell,
        "#c0c0c0", // neutral metallic silver
        0.9, // high metalness
      );
      addLog(`GLB exported: ${(glbBlob.size / 1024).toFixed(1)}KB`);

      // Step 3: Start batch retexture — all tiers with shape-override prefix
      // CRITICAL: Do NOT send image_style_url — it overrides text_style_prompt entirely.
      // The text prompt is our only tool for telling Meshy "this is armor, not a body."
      setStage("uploading");
      const detail = DETAIL_LEVELS.find((d) => d.id === detailLevel);
      const detailSuffix = detail ? `, ${detail.suffix}` : "";
      const tierPromptPayload = selectedTiers.map((t) => ({
        tierId: t.id,
        // Structure: [shape override], [material/color], [detail], [style suffix]
        prompt: `${TIER_SHAPE_PREFIX}, ${tierPrompts[t.id] || t.prompt}${detailSuffix}, ${t.style}`,
      }));

      addLog(
        `Starting batch retexture for ${selectedTiers.length} tiers (meshy-6, PBR, text-only prompts)...`,
      );
      for (const tp of tierPromptPayload) {
        addLog(`  ${tp.tierId}: "${tp.prompt.substring(0, 80)}..."`);
      }

      const tasks = await textureServiceRef.current.startBatchTexture(
        glbBlob,
        `${shellKey}_batch_${Date.now()}.glb`,
        tierPromptPayload,
        { enablePBR: true, aiModel: "meshy-6" },
      );

      // Initialize tier task tracking
      const initialTasks: TierTask[] = tasks.map(({ tierId, taskId }) => ({
        tier: MATERIAL_TIERS.find((t) => t.id === tierId)!,
        taskId,
        status: "pending" as TierTaskStatus,
        progress: 0,
      }));
      setTierTasks(initialTasks);
      setStage("texturing");

      addLog(`All ${tasks.length} tasks submitted. Polling for completion...`);
      for (const task of tasks) {
        addLog(`  ${task.tierId}: ${task.taskId}`);
      }

      // Step 4: Poll all tasks
      const service = textureServiceRef.current;
      const taskMap = new Map(tasks.map((t) => [t.tierId, t.taskId]));

      const poll = async () => {
        if (unmountedRef.current) return;
        let allDone = true;

        for (const [tierId, taskId] of taskMap) {
          try {
            const status: TextureTaskStatus = await service.getStatus(taskId);
            if (unmountedRef.current) return;

            setTierTasks((prev) =>
              prev.map((t) => {
                if (t.tier.id !== tierId) return t;
                const newStatus: TierTaskStatus =
                  status.status === "succeeded"
                    ? "succeeded"
                    : status.status === "failed"
                      ? "failed"
                      : status.status === "processing"
                        ? "processing"
                        : "pending";

                if (newStatus === "succeeded" && t.status !== "succeeded") {
                  addLog(`${tierId} completed!`);
                }
                if (newStatus === "failed" && t.status !== "failed") {
                  addLog(`${tierId} FAILED: ${status.error ?? "unknown"}`);
                }

                return {
                  ...t,
                  status: newStatus,
                  progress: status.progress,
                  error: status.error,
                  downloadUrl:
                    newStatus === "succeeded"
                      ? service.getDownloadUrl(taskId)
                      : t.downloadUrl,
                };
              }),
            );

            if (status.status !== "succeeded" && status.status !== "failed") {
              allDone = false;
            }
          } catch {
            allDone = false;
          }
        }

        if (allDone) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setStage("done");
          addLog("All tier tasks complete!");
        }
      };

      // Start polling every 5s
      pollRef.current = setInterval(poll, 5000);
      // Run once immediately
      await poll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStage("error");
      addLog(`ERROR: ${msg}`);
    }
  }, [
    avatarUrl,
    selectedSlot,
    selectedBulk,
    enabledTiers,
    tierPrompts,
    extractionResult,
    sharedExtraction,
    onExtract,
    detailLevel,
    addLog,
  ]);

  // Preview a completed tier in the viewer
  const handlePreviewTier = useCallback(
    async (task: TierTask) => {
      if (!task.downloadUrl) return;
      try {
        addLog(`Loading ${task.tier.label} preview...`);
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(task.downloadUrl);

        viewerRef.current?.clearOverlays();
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mats = Array.isArray(child.material)
              ? child.material
              : [child.material];
            mats.forEach((m) => {
              m.side = THREE.DoubleSide;
            });
          }
        });
        viewerRef.current?.showTexturedResult(gltf.scene);
        setSelectedPreview(task.tier.id);
        addLog(`Showing ${task.tier.label} preview.`);
      } catch (err) {
        addLog(
          `Preview error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [addLog],
  );

  const handleDownloadTier = useCallback(
    (task: TierTask) => {
      if (!task.downloadUrl) return;
      const a = document.createElement("a");
      a.href = task.downloadUrl;
      a.download = `${task.tier.id}_${selectedSlot}_${selectedBulk}.glb`;
      a.click();
    },
    [selectedSlot, selectedBulk],
  );

  const handleDownloadAll = useCallback(() => {
    const completed = tierTasks.filter((t) => t.status === "succeeded");
    for (const task of completed) {
      handleDownloadTier(task);
    }
  }, [tierTasks, handleDownloadTier]);

  const handleReset = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    viewerRef.current?.clear();
    setStage("idle");
    setError(null);
    setLogs([]);
    setTierTasks([]);
    setSelectedPreview(null);
    setExtractionResult(null);
    setCurrentShell(null);
  }, []);

  const isRunning =
    stage === "extracting" || stage === "uploading" || stage === "texturing";

  const succeededCount = tierTasks.filter(
    (t) => t.status === "succeeded",
  ).length;
  const totalCount = tierTasks.length;

  return (
    <div className="flex h-full">
      {/* Left panel — Controls */}
      <div className="w-80 flex-shrink-0 border-r border-border-primary bg-bg-primary overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div>
            <h2 className="font-display text-lg font-medium tracking-tight text-text-primary flex items-center gap-2">
              <Crown size={20} className="text-warning" />
              Tier Generator
            </h2>
            <p className="text-xs text-text-tertiary mt-1">
              Batch-generate bronze → dragon tier variants via Meshy AI
            </p>
          </div>

          {/* Avatar Selection */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Avatar
            </label>
            <select
              value={avatarUrl}
              onChange={(e) => {
                setAvatarUrl(e.target.value);
                setExtractionResult(null);
              }}
              className="w-full bg-bg-secondary border border-border-primary rounded-lg px-5 py-4 text-sm text-text-primary"
            >
              {AVATAR_OPTIONS.map((opt) => (
                <option key={opt.url} value={opt.url}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Slot + Bulk */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Slot
            </label>
            <div className="grid grid-cols-3 gap-1">
              {ALL_SLOTS.map((slot) => (
                <button
                  key={slot}
                  onClick={() => setSelectedSlot(slot)}
                  className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                    selectedSlot === slot
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-bg-secondary text-text-tertiary border border-border-primary hover:border-border-secondary"
                  } ease-out`}
                >
                  {SLOT_LABELS[slot]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Bulk Class
            </label>
            <div className="grid grid-cols-2 gap-1">
              {ALL_BULKS.map((bulk) => (
                <button
                  key={bulk}
                  onClick={() => setSelectedBulk(bulk)}
                  className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                    selectedBulk === bulk
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-bg-secondary text-text-tertiary border border-border-primary hover:border-border-secondary"
                  } ease-out`}
                >
                  {bulk} ({BULK_OFFSETS[bulk] * 1000}mm)
                </button>
              ))}
            </div>
          </div>

          {/* Tier Selection */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Tiers to Generate
            </label>
            <div className="space-y-1">
              {MATERIAL_TIERS.map((tier) => {
                const isExpanded = expandedTier === tier.id;
                return (
                  <div
                    key={tier.id}
                    className={`rounded-md bg-bg-secondary border transition-all ${
                      isExpanded
                        ? "border-primary/30"
                        : "border-border-primary hover:border-border-secondary"
                    } ease-out`}
                  >
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={enabledTiers.has(tier.id)}
                        onChange={() => toggleTier(tier.id)}
                        className="rounded"
                      />
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tier.color }}
                      />
                      <span className="text-xs font-medium text-text-primary flex-1">
                        {tier.label}
                      </span>
                      <button
                        onClick={() =>
                          setExpandedTier(isExpanded ? null : tier.id)
                        }
                        className="text-[10px] text-text-tertiary hover:text-primary px-1"
                        title="Edit prompt"
                      >
                        {isExpanded ? "close" : "edit"}
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="px-2 pb-2">
                        <textarea
                          value={tierPrompts[tier.id] ?? tier.prompt}
                          onChange={(e) =>
                            setTierPrompts((prev) => ({
                              ...prev,
                              [tier.id]: e.target.value,
                            }))
                          }
                          rows={3}
                          className="w-full bg-bg-primary border border-border-primary rounded px-2 py-1.5 text-xs text-text-primary resize-none"
                        />
                        <button
                          onClick={() =>
                            setTierPrompts((prev) => ({
                              ...prev,
                              [tier.id]: tier.prompt,
                            }))
                          }
                          className="text-[10px] text-text-tertiary hover:text-primary mt-1"
                        >
                          Reset to default
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setEnabledTiers(new Set(MATERIAL_TIERS.map((t) => t.id)))
                }
                className="text-[10px] text-primary hover:underline"
              >
                Select All
              </button>
              <button
                onClick={() => setEnabledTiers(new Set())}
                className="text-[10px] text-text-tertiary hover:underline"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Detail Level */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Detail Level
            </label>
            <div className="flex gap-1">
              {DETAIL_LEVELS.map((level) => (
                <button
                  key={level.id}
                  onClick={() => setDetailLevel(level.id)}
                  title={level.desc}
                  className={`flex-1 px-1 py-1.5 rounded-md text-[11px] font-medium transition-all text-center ${
                    detailLevel === level.id
                      ? "bg-warning/20 text-warning border border-warning/30"
                      : "bg-bg-secondary text-text-tertiary border border-border-primary hover:border-border-secondary"
                  } ease-out`}
                >
                  {level.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-text-tertiary">
              {DETAIL_LEVELS.find((d) => d.id === detailLevel)?.desc}
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-2 border-t border-border-primary">
            <button
              onClick={handleGenerate}
              disabled={isRunning || enabledTiers.size === 0}
              className="w-full px-4 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2
 bg-warning text-white hover:bg-warning/90 disabled:opacity-50 disabled:cursor-not-allowed ease-out"
            >
              {isRunning ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {stage === "extracting"
                    ? "Extracting..."
                    : stage === "uploading"
                      ? "Uploading..."
                      : `Texturing ${succeededCount}/${totalCount}...`}
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate {enabledTiers.size} Tiers
                </>
              )}
            </button>

            <div className="flex gap-2">
              <button
                onClick={handleDownloadAll}
                disabled={succeededCount === 0}
                className="flex-1 px-5 py-4 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5
 bg-bg-secondary border border-border-primary text-text-secondary hover:text-text-primary hover:border-border-secondary
 disabled:opacity-50 disabled:cursor-not-allowed ease-out"
              >
                <Download size={14} />
                Download All
              </button>
              <button
                onClick={handleReset}
                className="flex-1 px-5 py-4 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5
 bg-bg-secondary border border-border-primary text-text-secondary hover:text-text-primary hover:border-border-secondary ease-out"
              >
                <RotateCcw size={14} />
                Reset
              </button>
            </div>
          </div>

          {/* Tier Task Status Cards */}
          {tierTasks.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">
                Tier Results
              </label>
              {tierTasks.map((task) => (
                <div
                  key={task.tier.id}
                  className={`p-2 rounded-lg border flex items-center gap-2 ${
                    selectedPreview === task.tier.id
                      ? "border-primary/40 bg-primary/5"
                      : "border-border-primary bg-bg-secondary"
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: task.tier.color }}
                  />
                  <span className="text-xs font-medium text-text-primary flex-1">
                    {task.tier.label}
                  </span>

                  {task.status === "pending" && (
                    <Clock size={12} className="text-text-tertiary" />
                  )}
                  {task.status === "processing" && (
                    <span className="text-[10px] text-text-tertiary">
                      {Math.round(task.progress)}%
                    </span>
                  )}
                  {task.status === "processing" && (
                    <Loader2 size={12} className="text-primary animate-spin" />
                  )}
                  {task.status === "succeeded" && (
                    <>
                      <button
                        onClick={() => handlePreviewTier(task)}
                        className="text-[10px] text-primary hover:underline"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => handleDownloadTier(task)}
                        className="text-[10px] text-text-tertiary hover:text-text-primary"
                      >
                        <Download size={10} />
                      </button>
                      {onAddToKit && currentShell && task.downloadUrl && (
                        <button
                          onClick={() =>
                            onAddToKit(currentShell, task.downloadUrl!)
                          }
                          className="text-[10px] text-success hover:underline"
                          title="Add to armor kit"
                        >
                          <Wand2 size={10} />
                        </button>
                      )}
                      <Check size={12} className="text-success" />
                    </>
                  )}
                  {task.status === "failed" && (
                    <X size={12} className="text-error" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-error/10 border border-error/30 rounded-lg flex items-start gap-2">
              <AlertCircle
                size={14}
                className="text-error mt-0.5 flex-shrink-0"
              />
              <p className="text-xs text-error">{error}</p>
            </div>
          )}

          {/* Info */}
          <div className="p-5 bg-bg-secondary rounded-lg border border-border-primary space-y-1.5">
            <h3 className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
              <Info size={12} />
              Tier Generator
            </h3>
            <ul className="text-xs text-text-tertiary space-y-0.5 list-disc pl-3">
              <li>Same shell geometry, different tier textures</li>
              <li>All tiers retextured in parallel via Meshy</li>
              <li>
                ~$0.20/tier, 2-5 min each (parallel = same wall-clock time)
              </li>
              <li>6 tiers = ~$1.20 total, ~5 min</li>
            </ul>
          </div>
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
                Select tiers and click &quot;Generate&quot; to create tier
                variants from a single shell
              </p>
            ) : (
              logs.map((log, i) => (
                <p
                  key={i}
                  className={`text-xs font-mono ${
                    log.includes("ERROR")
                      ? "text-error"
                      : log.includes("complete") || log.includes("Done")
                        ? "text-success"
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
