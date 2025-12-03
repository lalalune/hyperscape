import React, { useRef, useState } from "react";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import ThreeViewer, {
  type ThreeViewerRef,
} from "../components/shared/ThreeViewer";
import { VRMTestViewer } from "../components/VRMTestViewer";
import { AssetService } from "../services/api/AssetService";
import { useRetargetingStore } from "../store";
import { convertGLBToVRM } from "../services/retargeting/VRMConverter";

import { useAssets } from "@/hooks";

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

export const RetargetAnimatePage: React.FC = () => {
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
    (a) => a.type === "character" && (a as any).hasModel,
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
        author: "Hyperscape",
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

  return (
    <div className="h-[calc(100vh-60px)] w-full flex">
      {/* Sidebar */}
      <aside className="w-80 border-r border-border-primary bg-bg-secondary p-4 flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">Animation Retargeting</h2>
          <p className="text-xs text-text-tertiary mb-4">
            Load character → Retarget animations → Play & Test
          </p>
          {loadingState && (
            <div className="px-3 py-2 bg-primary/10 border border-primary/30 rounded-md">
              <p className="text-xs text-primary animate-pulse">
                {loadingState}
              </p>
            </div>
          )}
        </div>

        {/* Step 1: Select Character */}
        <section className="space-y-3 p-3 border border-border-primary rounded-md">
          <h3 className="text-sm font-semibold">1. Select Character</h3>

          <div className="space-y-2">
            <label className="text-xs text-text-tertiary">
              Source Model (Your Character with Mesh)
            </label>

            {/* File upload option */}
            <div className="space-y-1">
              <input
                type="file"
                accept=".glb,.gltf"
                className="w-full text-xs"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = URL.createObjectURL(file);
                    setSourceModel(url, file.name);
                    setVrmConverted(false);
                    setRetargetingApplied(false);
                    console.log(
                      "[RetargetAnimatePage] Loaded source model from file:",
                      file.name,
                    );
                  }
                }}
              />
              <p className="text-xs text-text-tertiary">
                Upload a GLB/GLTF file with mesh data
              </p>
            </div>

            {/* Or select from existing assets */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border-primary"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-bg-secondary text-text-tertiary">
                  or select from assets
                </span>
              </div>
            </div>

            <select
              className="w-full px-2 py-1 rounded-md bg-bg-tertiary text-sm"
              disabled={assetsLoading}
              value={sourceModelAssetId || ""}
              onChange={async (e) => {
                const assetId = e.target.value;
                const asset = avatarAssets.find((a) => a.id === assetId);
                if (asset) {
                  // Use T-pose URL if available
                  const modelUrl = await AssetService.getTPoseUrl(asset.id);
                  setSourceModel(modelUrl, asset.id);
                }
              }}
            >
              <option value="">
                {assetsLoading ? "Loading..." : "Select from assets..."}
              </option>
              {avatarAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <button
              className="w-full px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!sourceModelUrl || vrmConverted}
              onClick={handleConvertToVRM}
            >
              {vrmConverted ? "✓ Converted to VRM" : "🎭 Convert to VRM Format"}
            </button>

            {vrmConverted && conversionWarnings.length > 0 && (
              <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-md">
                <p className="text-xs font-semibold text-amber-400 mb-1">
                  Conversion Warnings:
                </p>
                {conversionWarnings.map((warning, idx) => (
                  <p key={idx} className="text-xs text-amber-300">
                    • {warning}
                  </p>
                ))}
              </div>
            )}

            {sourceModelUrl && !vrmConverted && (
              <p className="text-xs text-text-tertiary">
                Convert Meshy GLB to VRM format for standardized animation
                support. This fixes coordinate systems and bone naming.
                {sourceModelAssetId && (
                  <span className="block mt-1 text-text-secondary">
                    Will be uploaded to: /gdd-assets/{sourceModelAssetId}/
                    {sourceModelAssetId}.vrm
                  </span>
                )}
              </p>
            )}

            {vrmConverted && (
              <div className="space-y-1">
                <p className="text-xs text-green-400">
                  ✓ VRM conversion complete! Now viewing VRM in viewport.
                </p>
                {sourceModelAssetId && vrmUrl && (
                  <p className="text-xs text-blue-400">
                    📁 Saved to server: {vrmUrl}
                  </p>
                )}
                <p className="text-xs text-text-tertiary">
                  File also downloaded to your computer as backup.
                </p>
                <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded-md">
                  <p className="text-xs font-semibold text-blue-400 mb-1">
                    ✨ VRM Benefits:
                  </p>
                  <ul className="text-xs text-blue-300 space-y-0.5">
                    <li>✓ Y-up coordinate system (fixed orientation)</li>
                    <li>✓ Standard HumanoidBone names</li>
                    <li>✓ T-pose normalized</li>
                    <li>✓ Ready for animation testing!</li>
                  </ul>
                </div>

                <div className="mt-2">
                  <button
                    className="w-full px-3 py-2 rounded-md bg-primary text-white hover:bg-primary/90"
                    onClick={() => {
                      setShowVRMTestViewer(true);
                    }}
                  >
                    🎭 Test VRM with Animations
                  </button>
                  <p className="text-xs text-text-tertiary mt-1">
                    Opens the VRM Test Viewer with Idle, Walk, Run, and Jump
                    animations. Click the toggle in the top-right to switch
                    between viewers.
                  </p>
                </div>
              </div>
            )}
          </div>

          {!vrmConverted && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border-primary"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-bg-secondary text-text-tertiary">
                    or use legacy retargeting
                  </span>
                </div>
              </div>

              <button
                className="w-full px-3 py-2 rounded-md bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!sourceModelUrl || retargetingApplied}
                onClick={handleApplyRetargeting}
              >
                {retargetingApplied
                  ? "✓ Animations Retargeted (Legacy)"
                  : "Legacy: Retarget Animations"}
              </button>

              {!sourceModelUrl && (
                <p className="text-xs text-amber-400">
                  Select a character first
                </p>
              )}
              {sourceModelUrl && !retargetingApplied && (
                <p className="text-xs text-text-tertiary">
                  Legacy method: Direct animation retargeting (may have
                  coordinate system issues)
                </p>
              )}
            </>
          )}
        </section>

        {/* Step 2: Test Animations */}
        {retargetingApplied && (
          <section className="space-y-3 p-3 border border-border-primary rounded-md">
            <h3 className="text-sm font-semibold">
              2. Test Animations{vrmConverted && " (VRM)"}
            </h3>
            {vrmConverted && (
              <div className="p-2 bg-green-500/10 border border-green-500/30 rounded-md mb-2">
                <p className="text-xs text-green-400">
                  ✨ Testing VRM animations! Character should stand upright with
                  correct orientation.
                </p>
              </div>
            )}

            {availableAnimations.length === 0 ? (
              <p className="text-xs text-text-tertiary">
                Loading animations...
              </p>
            ) : (
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-xs text-text-tertiary">
                    Select Animation ({availableAnimations.length} available)
                  </label>
                  <select
                    className="w-full px-2 py-1 rounded-md bg-bg-tertiary text-sm"
                    value={selectedAnimation}
                    onChange={(e) => handlePlay(e.target.value)}
                  >
                    <option value="">Choose an animation...</option>
                    {availableAnimations.map((anim) => (
                      <option key={anim.name} value={anim.name}>
                        {anim.name} ({anim.duration.toFixed(2)}s)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quick access to common animations */}
                <div>
                  <label className="text-xs text-text-tertiary mb-1 block">
                    Quick Select
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      className="px-2 py-1 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={() => handlePlay("Idle_Loop")}
                    >
                      Idle
                    </button>
                    <button
                      className="px-2 py-1 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={() => handlePlay("Walk_Loop")}
                    >
                      Walk
                    </button>
                    <button
                      className="px-2 py-1 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={() => handlePlay("Jog_Fwd_Loop")}
                    >
                      Jog
                    </button>
                    <button
                      className="px-2 py-1 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={() => handlePlay("Sprint_Loop")}
                    >
                      Sprint
                    </button>
                    <button
                      className="px-2 py-1 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={() => handlePlay("Jump_Start")}
                    >
                      Jump
                    </button>
                    <button
                      className="px-2 py-1 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={() => handlePlay("Dance_Loop")}
                    >
                      Dance
                    </button>
                  </div>
                </div>

                {/* Playback controls */}
                <div className="flex gap-2 pt-2 border-t border-border-primary">
                  {!isPlaying && (
                    <button
                      className="flex-1 px-3 py-1 rounded-md bg-bg-tertiary hover:bg-bg-primary/20"
                      onClick={handleResume}
                    >
                      Resume
                    </button>
                  )}
                  {isPlaying && (
                    <button
                      className="flex-1 px-3 py-1 rounded-md bg-bg-tertiary hover:bg-bg-primary/20"
                      onClick={handlePause}
                    >
                      Pause
                    </button>
                  )}
                  <button
                    className="flex-1 px-3 py-1 rounded-md bg-bg-tertiary hover:bg-bg-primary/20"
                    onClick={() => viewerRef.current?.stopAnimation()}
                  >
                    Stop
                  </button>
                </div>

                {selectedAnimation && (
                  <p className="text-xs text-green-400">
                    Playing: {selectedAnimation}
                  </p>
                )}
              </div>
            )}

            <p className="text-xs text-text-tertiary">
              Test animations to ensure retargeting looks correct. Use the
              dropdown to access all {availableAnimations.length} animations.
            </p>
          </section>
        )}

        {/* Step 4: Export */}
        {retargetingApplied && (
          <section className="space-y-3 p-3 border border-border-primary rounded-md">
            <h3 className="text-sm font-semibold">4. Export</h3>

            <button
              className="w-full px-3 py-2 rounded-md bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"
              disabled={exporting}
              onClick={handleExport}
            >
              {exporting ? "Exporting..." : "Export Retargeted Model"}
            </button>

            <p className="text-xs text-text-tertiary">
              Export the retargeted model as a GLB file with the new skeleton.
            </p>
          </section>
        )}

        {/* Utilities */}
        <section className="space-y-2 pt-4 border-t border-border-primary">
          <button
            className="w-full px-3 py-1 rounded-md bg-bg-tertiary hover:bg-bg-primary/20 text-sm"
            onClick={() => viewerRef.current?.resetCamera()}
          >
            Reset Camera
          </button>
          <button
            className="w-full px-3 py-1 rounded-md bg-warning/10 text-warning hover:bg-warning/20 text-sm"
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
            Reset Workflow
          </button>
        </section>
      </aside>

      {/* Viewer */}
      <section className="flex-1 relative">
        {/* Viewer Controls */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          {vrmConverted && vrmUrl && (
            <button
              onClick={() => setShowVRMTestViewer(!showVRMTestViewer)}
              className="px-3 py-2 rounded-md bg-bg-primary border border-border-primary text-text-primary hover:bg-bg-tertiary transition-colors text-sm"
            >
              {showVRMTestViewer ? "🎨 GLB Viewer" : "🎭 VRM Tester"}
            </button>
          )}
          <button
            onClick={() => {
              setShowBones(!showBones);
              viewerRef.current?.toggleSkeleton();
            }}
            className="px-3 py-2 rounded-md bg-bg-primary border border-border-primary text-text-primary hover:bg-bg-tertiary transition-colors text-sm"
          >
            {showBones ? "🦴 Hide Bones" : "🦴 Show Bones"}
          </button>
        </div>

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
};

export default RetargetAnimatePage;
