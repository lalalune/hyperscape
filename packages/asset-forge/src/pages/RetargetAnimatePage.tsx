import {
  Bone,
  Box,
  Check,
  Download,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Square,
  Upload,
  Wand2,
} from "lucide-react";
import { useRef, useState } from "react";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { VRMTestViewer } from "../components/VRMTestViewer";
import { ForgeLogo } from "../components/shared/ForgeLogo";
import ThreeViewer, {
  type ThreeViewerRef,
} from "../components/shared/ThreeViewer";
import { StatusDot } from "../components/shared/page";
import { AssetService } from "../services/api/AssetService";
import { convertGLBToVRM } from "../services/retargeting/VRMConverter";
import { useRetargetingStore } from "../store";

import { useAssets } from "@/hooks";

const QUICK_ANIMATIONS: { id: string; label: string }[] = [
  { id: "Idle_Loop", label: "Idle" },
  { id: "Walk_Loop", label: "Walk" },
  { id: "Jog_Fwd_Loop", label: "Jog" },
  { id: "Sprint_Loop", label: "Sprint" },
  { id: "Jump_Start", label: "Jump" },
  { id: "Dance_Loop", label: "Dance" },
];

/**
 * Normalize VRM URL for viewer consumption
 * Handles blob URLs, relative paths, and absolute URLs correctly
 */
const normalizeVRMUrl = (vrmUrl: string): string => {
  // Blob URLs should be used as-is
  if (vrmUrl.startsWith("blob:")) {
    return vrmUrl;
  }

  // Full URLs should be used as-is
  if (vrmUrl.startsWith("http://") || vrmUrl.startsWith("https://")) {
    return vrmUrl;
  }

  // Relative paths are served by Vite proxy (routes to backend)
  if (vrmUrl.startsWith("/")) {
    return vrmUrl;
  }

  // Default: assume it's a relative path without leading slash
  return `/${vrmUrl}`;
};

export function RetargetAnimatePage() {
  const viewerRef = useRef<ThreeViewerRef | null>(null);
  const { assets, loading: assetsLoading } = useAssets();

  // Local workflow state
  const [vrmConverted, setVrmConverted] = useState(false);
  const [vrmUrl, setVrmUrl] = useState<string>("");
  const [conversionWarnings, setConversionWarnings] = useState<string[]>([]);
  const [retargetingApplied, setRetargetingApplied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [availableAnimations, setAvailableAnimations] = useState<
    { name: string; duration: number }[]
  >([]);
  const [selectedAnimation, setSelectedAnimation] = useState<string>("");
  const [loadingState, setLoadingState] = useState<string>("");
  const [showVRMTestViewer, setShowVRMTestViewer] = useState(false);
  const [showBones, setShowBones] = useState(false);

  // Zustand state
  const { sourceModelUrl, sourceModelAssetId, setSourceModel, reset } =
    useRetargetingStore();

  // Filter assets for character models
  const avatarAssets = assets.filter(
    (a) => a.type === "character" && (a as { hasModel?: boolean }).hasModel,
  );

  // Convert Meshy GLB to VRM format
  const handleConvertToVRM = async () => {
    if (!sourceModelUrl) {
      alert("Please select a character model first");
      return;
    }

    try {
      setLoadingState("Converting to VRM format...");
      console.log("[RetargetAnimatePage] Starting VRM conversion...");

      // Load the GLB file
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(sourceModelUrl);

      // Convert to VRM
      const result = await convertGLBToVRM(gltf.scene, {
        avatarName: sourceModelAssetId || "Converted Avatar",
        author: "Hyperia",
        version: "1.0",
        commercialUsage: "personalNonProfit",
      });

      console.log("[RetargetAnimatePage] VRM conversion complete!");
      console.log(`  - Bones mapped: ${result.boneMappings.size}`);
      console.log(
        `  - Coordinate system fixed: ${result.coordinateSystemFixed}`,
      );
      console.log(`  - Warnings: ${result.warnings.length}`);

      // Create blob URL for the VRM file
      const blob = new Blob([result.vrmData], {
        type: "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);
      setConversionWarnings(result.warnings);

      // Upload VRM to server if we have an assetId
      if (sourceModelAssetId) {
        try {
          setLoadingState("Uploading VRM to server...");
          const filename = `${sourceModelAssetId}.vrm`;
          const uploadResult = await AssetService.uploadVRM(
            sourceModelAssetId,
            result.vrmData,
            filename,
          );

          console.log(
            "[RetargetAnimatePage] VRM uploaded to server:",
            uploadResult.url,
          );

          // Use the server URL and update viewer
          setVrmUrl(uploadResult.url);
          setSourceModel(uploadResult.url, sourceModelAssetId);

          setLoadingState("VRM uploaded successfully!");
          setTimeout(() => setLoadingState(""), 2000);
        } catch (uploadError) {
          console.warn(
            "[RetargetAnimatePage] Server upload failed, using local blob:",
            uploadError,
          );
          // Fall back to blob URL if upload fails
          setVrmUrl(url);
          setSourceModel(url, sourceModelAssetId || "avatar");
          setLoadingState("Using local VRM (upload failed)");
          setTimeout(() => setLoadingState(""), 2000);
        }
      } else {
        // No asset ID, just use blob URL
        setVrmUrl(url);
        setSourceModel(url, "converted-avatar");
        setLoadingState("");
      }

      setVrmConverted(true);

      // Auto-download the VRM file as backup
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sourceModelAssetId || "avatar"}.vrm`;
      a.click();

      alert(
        `VRM conversion complete! ${sourceModelAssetId ? "File uploaded to server and downloaded." : "File downloaded."} Now viewing VRM in viewer.`,
      );
    } catch (error) {
      setLoadingState("");
      console.error("[RetargetAnimatePage] Error converting to VRM:", error);
      alert("Error converting to VRM: " + (error as Error).message);
    }
  };

  // NEW WORKFLOW: Animation Retargeting (Industry Standard)
  // Step 1: Apply Animation Retargeting (no skeleton editing needed!)
  const handleApplyRetargeting = async () => {
    if (!sourceModelUrl) {
      alert("Please select a character model first");
      return;
    }

    try {
      setLoadingState("Retargeting animations to character...");
      console.log("[RetargetAnimatePage] Starting animation retargeting...");

      // NEW: Use animation retargeting workflow
      // Character stays bound to original skeleton
      // Animations are retargeted from Mixamo → Character
      if (!viewerRef.current) {
        alert("Viewer not initialized");
        return;
      }

      const success = await viewerRef.current.retargetAnimationsToCharacter(
        "/rigs/rig-human.glb", // Animation rig (Mixamo)
        "/rigs/animations/human-base-animations.glb", // Animations
      );

      if (success) {
        console.log("[RetargetAnimatePage] Animation retargeting complete!");
        setRetargetingApplied(true);
        setLoadingState("Loading animations...");

        // Fetch available animations from the viewer
        setTimeout(() => {
          if (viewerRef.current) {
            const anims = viewerRef.current.getAvailableAnimations();
            console.log(
              "[RetargetAnimatePage] Fetched animations:",
              anims.length,
            );
            setAvailableAnimations(
              anims.map((a) => ({ name: a.name, duration: a.duration })),
            );
          }
          setLoadingState("");
        }, 500); // Small delay to ensure animations are loaded
      } else {
        setLoadingState("");
        alert("Failed to retarget animations");
      }
    } catch (error) {
      setLoadingState("");
      console.error(
        "[RetargetAnimatePage] Error retargeting animations:",
        error,
      );
      alert("Error retargeting animations: " + (error as Error).message);
    }
  };

  // Animation controls
  const handlePlay = (animName: string) => {
    viewerRef.current?.playAnimation(animName);
    setSelectedAnimation(animName);
    setIsPlaying(true);
  };

  const handlePause = () => {
    viewerRef.current?.pauseAnimation();
    setIsPlaying(false);
  };

  const handleResume = () => {
    viewerRef.current?.resumeAnimation();
    setIsPlaying(true);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      if (viewerRef.current?.exportTPoseModel) {
        viewerRef.current.exportTPoseModel();
      } else {
        // Fallback export
        const exporter = new GLTFExporter();
        const tmpScene = new THREE.Scene();
        await new Promise<void>((resolve, reject) => {
          exporter.parse(
            tmpScene,
            (result) => {
              const blob = new Blob([result as ArrayBuffer], {
                type: "application/octet-stream",
              });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "retargeted-model.glb";
              a.click();
              resolve();
            },
            (err) => reject(err),
            { binary: true, onlyVisible: false, embedImages: true },
          );
        });
      }
    } finally {
      setExporting(false);
    }
  };

  const sourceLabel = sourceModelAssetId || "Local file";

  return (
    <div className="h-[calc(100vh-44px)] w-full flex bg-bg-primary">
      {/* ============================================================
          SIDEBAR — workflow steps, editorial composition
          ============================================================ */}
      <aside className="w-[380px] border-r border-border-primary bg-bg-primary flex-shrink-0 overflow-y-auto scrollbar-thin">
        <div className="p-8 space-y-7">
          {/* HERO */}
          <header>
            <div className="flex items-baseline gap-4 mb-5">
              <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
                00
              </span>
              <span className="font-display text-base font-medium text-text-primary tracking-tight">
                Retargeting
              </span>
              <span className="flex items-center gap-2 text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
                <StatusDot tone={vrmConverted ? "ready" : "idle"} />
                {vrmConverted ? "VRM ready" : "Source needed"}
              </span>
            </div>
            <h1 className="font-display text-3xl font-medium text-text-primary tracking-tight leading-[1.05] mb-3">
              Animation <span className="text-primary">retargeting</span>
            </h1>
            <p className="text-sm text-text-tertiary leading-relaxed">
              Convert a character to VRM, then drive it with the standard
              animation rig.
            </p>
            {loadingState && (
              <div className="mt-5 flex items-center gap-2 px-3.5 py-2.5 rounded-md bg-bg-tertiary border border-primary/30">
                <Loader2
                  size={12}
                  strokeWidth={1.5}
                  className="animate-spin text-primary flex-shrink-0"
                />
                <span className="text-xs text-primary">{loadingState}</span>
              </div>
            )}
          </header>

          {/* ============================================================
              01 / SOURCE
              ============================================================ */}
          <section className="rounded-lg bg-bg-tertiary border border-border-primary p-6 space-y-5">
            <header className="flex items-baseline gap-3 pb-4 border-b border-border-primary">
              <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
                01
              </span>
              <h2 className="font-display text-base font-medium text-text-primary tracking-tight">
                Source character
              </h2>
              <span className="ml-auto text-[10px] text-text-tertiary uppercase tracking-[0.14em]">
                Required
              </span>
            </header>

            <div className="space-y-4">
              {/* File upload */}
              <div>
                <p className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] mb-1.5">
                  Upload file
                </p>
                <label className="group flex items-center gap-3 px-3.5 py-2.5 rounded-md bg-bg-primary border border-border-primary hover:border-primary/40 cursor-pointer transition-colors duration-300 ease-out">
                  <Upload
                    size={14}
                    strokeWidth={1.5}
                    className="text-text-tertiary group-hover:text-primary transition-colors duration-300 ease-out flex-shrink-0"
                  />
                  <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors duration-300 ease-out truncate flex-1">
                    {sourceModelUrl && sourceModelUrl.startsWith("blob:")
                      ? sourceLabel
                      : "Choose .glb or .gltf"}
                  </span>
                  <input
                    type="file"
                    accept=".glb,.gltf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setSourceModel(url, file.name);
                        setVrmConverted(false);
                        setRetargetingApplied(false);
                      }
                    }}
                  />
                </label>
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border-primary" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-bg-tertiary text-[10px] text-text-tertiary uppercase tracking-[0.14em]">
                    or
                  </span>
                </div>
              </div>

              {/* Library select */}
              <div>
                <p className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] mb-1.5">
                  From library
                </p>
                <select
                  className="input"
                  disabled={assetsLoading}
                  value={sourceModelAssetId || ""}
                  onChange={async (e) => {
                    const assetId = e.target.value;
                    const asset = avatarAssets.find((a) => a.id === assetId);
                    if (asset) {
                      const modelUrl = await AssetService.getTPoseUrl(asset.id);
                      setSourceModel(modelUrl, asset.id);
                    }
                  }}
                >
                  <option value="">
                    {assetsLoading ? "Loading…" : "Select character…"}
                  </option>
                  {avatarAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* ============================================================
              02 / CONVERT
              ============================================================ */}
          <section className="rounded-lg bg-bg-tertiary border border-border-primary p-6 space-y-5">
            <header className="flex items-baseline gap-3 pb-4 border-b border-border-primary">
              <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
                02
              </span>
              <h2 className="font-display text-base font-medium text-text-primary tracking-tight">
                Convert to VRM
              </h2>
              {vrmConverted && (
                <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-success uppercase tracking-[0.14em]">
                  <Check size={11} strokeWidth={2} />
                  Done
                </span>
              )}
            </header>

            <p className="text-sm text-text-tertiary leading-relaxed">
              Normalises coordinate system, bone names, and T-pose for animation
              playback.
            </p>

            <button
              type="button"
              className="btn-primary w-full"
              disabled={!sourceModelUrl || vrmConverted}
              onClick={handleConvertToVRM}
            >
              {vrmConverted ? (
                <>
                  <Check size={13} strokeWidth={2} />
                  Converted
                </>
              ) : (
                <>
                  <Wand2 size={13} strokeWidth={1.5} />
                  Convert to VRM
                </>
              )}
            </button>

            {vrmConverted && conversionWarnings.length > 0 && (
              <div className="rounded-md bg-bg-primary border border-warning/30 p-3.5 space-y-1.5">
                <p className="text-[10px] uppercase tracking-[0.14em] text-warning font-medium">
                  Conversion warnings
                </p>
                {conversionWarnings.map((warning, idx) => (
                  <p
                    key={idx}
                    className="text-xs text-text-secondary leading-relaxed"
                  >
                    · {warning}
                  </p>
                ))}
              </div>
            )}

            {vrmConverted && (
              <div className="rounded-md bg-bg-primary border border-border-primary p-4 space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-text-tertiary font-medium mb-2">
                    VRM properties
                  </p>
                  <ul className="text-xs text-text-secondary space-y-1.5">
                    <li className="flex items-center gap-2">
                      <Check
                        size={11}
                        strokeWidth={2}
                        className="text-success flex-shrink-0"
                      />
                      Y-up coordinate system
                    </li>
                    <li className="flex items-center gap-2">
                      <Check
                        size={11}
                        strokeWidth={2}
                        className="text-success flex-shrink-0"
                      />
                      Standard humanoid bones
                    </li>
                    <li className="flex items-center gap-2">
                      <Check
                        size={11}
                        strokeWidth={2}
                        className="text-success flex-shrink-0"
                      />
                      T-pose normalised
                    </li>
                  </ul>
                </div>
                {sourceModelAssetId && vrmUrl && (
                  <p className="text-[10px] text-text-tertiary font-mono break-all leading-relaxed">
                    {vrmUrl}
                  </p>
                )}
                <button
                  type="button"
                  className="btn-secondary w-full"
                  onClick={() => setShowVRMTestViewer(true)}
                >
                  <Play size={12} strokeWidth={1.5} />
                  Test in VRM viewer
                </button>
              </div>
            )}

            {!vrmConverted && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border-primary" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-3 bg-bg-tertiary text-[10px] text-text-tertiary uppercase tracking-[0.14em]">
                      or
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-ghost w-full"
                  disabled={!sourceModelUrl || retargetingApplied}
                  onClick={handleApplyRetargeting}
                >
                  {retargetingApplied
                    ? "Animations retargeted (legacy)"
                    : "Use legacy retargeting"}
                </button>
                <p className="text-xs text-text-tertiary leading-relaxed">
                  Legacy path keeps the original skeleton — coordinate-system
                  bugs may surface.
                </p>
              </>
            )}
          </section>

          {/* ============================================================
              03 / ANIMATIONS  (gated on retargeting applied)
              ============================================================ */}
          {retargetingApplied && (
            <section className="rounded-lg bg-bg-tertiary border border-border-primary p-6 space-y-5">
              <header className="flex items-baseline gap-3 pb-4 border-b border-border-primary">
                <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
                  03
                </span>
                <h2 className="font-display text-base font-medium text-text-primary tracking-tight">
                  Animations
                </h2>
                <span className="ml-auto text-[10px] text-text-tertiary uppercase tracking-[0.14em]">
                  {availableAnimations.length} available
                </span>
              </header>

              {availableAnimations.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-text-tertiary">
                  <Loader2 size={12} className="animate-spin" />
                  Loading animations…
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] mb-1.5">
                      Choose animation
                    </p>
                    <select
                      className="input"
                      value={selectedAnimation}
                      onChange={(e) => handlePlay(e.target.value)}
                    >
                      <option value="">Choose an animation…</option>
                      {availableAnimations.map((anim) => (
                        <option key={anim.name} value={anim.name}>
                          {anim.name} ({anim.duration.toFixed(2)}s)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <p className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] mb-2">
                      Quick select
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {QUICK_ANIMATIONS.map((q) => {
                        const active = selectedAnimation === q.id;
                        return (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => handlePlay(q.id)}
                            className={`px-2.5 py-1.5 rounded-md text-[11px] uppercase tracking-[0.1em] border transition-colors duration-300 ease-out ${
                              active
                                ? "bg-primary/10 border-primary/40 text-primary"
                                : "bg-bg-primary border-border-primary text-text-secondary hover:border-primary/40 hover:text-primary"
                            }`}
                          >
                            {q.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-border-primary">
                    {!isPlaying ? (
                      <button
                        type="button"
                        className="btn-secondary flex-1"
                        onClick={handleResume}
                      >
                        <Play size={12} strokeWidth={1.5} />
                        Resume
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary flex-1"
                        onClick={handlePause}
                      >
                        <Pause size={12} strokeWidth={1.5} />
                        Pause
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-secondary flex-1"
                      onClick={() => viewerRef.current?.stopAnimation()}
                    >
                      <Square size={12} strokeWidth={1.5} />
                      Stop
                    </button>
                  </div>

                  {selectedAnimation && (
                    <p className="flex items-center gap-2 text-xs text-success">
                      <StatusDot tone="ready" />
                      Playing {selectedAnimation}
                    </p>
                  )}
                </>
              )}
            </section>
          )}

          {/* ============================================================
              04 / EXPORT  (gated on retargeting applied)
              ============================================================ */}
          {retargetingApplied && (
            <section className="rounded-lg bg-bg-tertiary border border-border-primary p-6 space-y-4">
              <header className="flex items-baseline gap-3 pb-4 border-b border-border-primary">
                <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
                  04
                </span>
                <h2 className="font-display text-base font-medium text-text-primary tracking-tight">
                  Export
                </h2>
              </header>
              <p className="text-sm text-text-tertiary leading-relaxed">
                Export as GLB with the retargeted skeleton.
              </p>
              <button
                type="button"
                className="btn-primary w-full"
                disabled={exporting}
                onClick={handleExport}
              >
                {exporting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Exporting…
                  </>
                ) : (
                  <>
                    <Download size={13} strokeWidth={1.5} />
                    Export model
                  </>
                )}
              </button>
            </section>
          )}

          {/* ============================================================
              UTILITIES
              ============================================================ */}
          <section className="pt-2 space-y-2">
            <button
              type="button"
              className="btn-ghost w-full"
              onClick={() => viewerRef.current?.resetCamera()}
            >
              <RotateCcw size={12} strokeWidth={1.5} />
              Reset camera
            </button>
            <button
              type="button"
              className="btn-ghost w-full text-text-secondary hover:text-error"
              onClick={() => {
                if (confirm("Reset all settings and start over?")) {
                  reset();
                  setVrmConverted(false);
                  setVrmUrl("");
                  setConversionWarnings([]);
                  setRetargetingApplied(false);
                  setAvailableAnimations([]);
                  setSelectedAnimation("");
                }
              }}
            >
              Reset workflow
            </button>
          </section>
        </div>
      </aside>

      {/* ============================================================
          VIEWER — right pane
          ============================================================ */}
      <section className="flex-1 relative bg-bg-primary">
        {/* Top-right controls */}
        <div className="absolute top-5 right-5 z-10 flex gap-2">
          {vrmConverted && vrmUrl && (
            <button
              type="button"
              onClick={() => setShowVRMTestViewer(!showVRMTestViewer)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-tertiary border border-border-primary hover:border-primary/40 text-[11px] text-text-secondary hover:text-primary uppercase tracking-[0.12em] transition-colors duration-300 ease-out"
            >
              <Box size={11} strokeWidth={1.5} />
              {showVRMTestViewer ? "GLB viewer" : "VRM tester"}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setShowBones(!showBones);
              viewerRef.current?.toggleSkeleton();
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[11px] uppercase tracking-[0.12em] transition-colors duration-300 ease-out ${
              showBones
                ? "bg-primary/10 border-primary/40 text-primary"
                : "bg-bg-tertiary border-border-primary text-text-secondary hover:border-primary/40 hover:text-primary"
            }`}
          >
            <Bone size={11} strokeWidth={1.5} />
            Bones
          </button>
        </div>

        {/* Empty state overlay — shown when no source is loaded */}
        {!sourceModelUrl && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <div className="text-center max-w-sm px-6">
              <ForgeLogo size={56} className="mx-auto mb-6 opacity-50" />
              <p className="font-display text-xl text-text-primary tracking-tight mb-2">
                Pick a source character
              </p>
              <p className="text-sm text-text-tertiary leading-relaxed">
                Upload a GLB or pick one from the library to start retargeting.
              </p>
            </div>
          </div>
        )}

        {/* Viewers */}
        {showVRMTestViewer && vrmConverted && vrmUrl ? (
          <VRMTestViewer vrmUrl={normalizeVRMUrl(vrmUrl)} />
        ) : (
          <ThreeViewer
            ref={viewerRef}
            modelUrl={sourceModelUrl || undefined}
            isAnimationPlayer={false}
          />
        )}
      </section>
    </div>
  );
}

export default RetargetAnimatePage;
