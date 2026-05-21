import {
  Paintbrush,
  Info,
  Loader2,
  Download,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Wand2,
  Layers,
} from "lucide-react";
import React, { useRef, useState, useCallback } from "react";
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
  DETAIL_LEVELS,
} from "../../services/armor-pipeline/constants";
import {
  ShellPreviewViewer,
  type ShellPreviewViewerRef,
} from "./ShellPreviewViewer";

/** Texture method — determines how textures are applied */
type TextureMethod = "solid" | "ai" | "batch";

/** Per-slot task tracking for full-set generation */
interface SlotTask {
  slot: EquipmentSlotName;
  taskId: string;
  status: "pending" | "processing" | "succeeded" | "failed";
  progress: number;
  error?: string;
}

/** AI style PREFIX — goes BEFORE the material description.
 *  Must override Meshy's body-shape semantic interpretation first,
 *  then describe what the object actually is. */
const AI_STYLE_PREFIX =
  "medieval plate armor, hard metallic surface, not skin, not clothing, not a body";

/** AI style suffix — goes AFTER material + detail descriptors */
const AI_STYLE_SUFFIX = "game-ready PBR texture, single 3D asset";

interface MaterialPreset {
  id: string;
  label: string;
  prompt: string;
  group: "osrs" | "fantasy";
  /** CSS color for the swatch dot */
  swatch?: string;
}

/** Preset material prompts organized by style.
 *  tile-based MMORPG presets include hex codes + specific material descriptors for Meshy-6 color accuracy.
 *  Fantasy presets are detailed AI prompts with surface quality keywords. */
const MATERIAL_PRESETS: MaterialPreset[] = [
  // ── tile-based-MMORPG-style solid color tiers ──────────────────────────
  {
    id: "bronze",
    label: "Bronze",
    prompt:
      "bronze metal armor plate, warm copper-gold #D4AF37 color, polished bronze surface",
    group: "osrs",
    swatch: "#D4AF37",
  },
  {
    id: "iron",
    label: "Iron",
    prompt:
      "iron metal armor plate, dark grey #6b6b6b color, matte forged iron surface",
    group: "osrs",
    swatch: "#6b6b6b",
  },
  {
    id: "steel",
    label: "Steel",
    prompt:
      "steel metal armor plate, bright silver #b8b8b8 color, polished reflective steel surface",
    group: "osrs",
    swatch: "#b8b8b8",
  },
  {
    id: "black",
    label: "Black",
    prompt:
      "black metal armor plate, very dark #2a2a2a color, polished obsidian black surface",
    group: "osrs",
    swatch: "#2a2a2a",
  },
  {
    id: "mithril",
    label: "Mithril",
    prompt:
      "mithril metal armor plate, blue-steel #4a7ab5 color, gleaming blue-purple surface",
    group: "osrs",
    swatch: "#4a7ab5",
  },
  {
    id: "adamant",
    label: "Adamant",
    prompt:
      "adamantite metal armor plate, dark green #2d6b3f color, polished green surface",
    group: "osrs",
    swatch: "#2d6b3f",
  },
  {
    id: "rune",
    label: "Rune",
    prompt:
      "runite metal armor plate, bright teal-cyan #3db8c4 color, polished cyan surface",
    group: "osrs",
    swatch: "#3db8c4",
  },
  {
    id: "dragon",
    label: "Dragon",
    prompt:
      "dragon metal armor plate, deep crimson #8b1a1a color, polished dark red surface",
    group: "osrs",
    swatch: "#8b1a1a",
  },
  // ── Detailed fantasy presets ──────────────────────────────
  {
    id: "iron_detailed",
    label: "Iron Plate",
    prompt:
      "iron plate armor, dark grey wrought metal, riveted plates, battle-worn scratches",
    group: "fantasy",
  },
  {
    id: "leather",
    label: "Leather",
    prompt:
      "leather armor, brown leather, hand-stitched seams, layered leather panels, visible grain",
    group: "fantasy",
  },
  {
    id: "cloth_robe",
    label: "Cloth Robe",
    prompt:
      "wizard robe armor, blue silk fabric, gold trim embroidery, arcane patterns",
    group: "fantasy",
  },
  {
    id: "steel_ornate",
    label: "Steel Ornate",
    prompt:
      "polished steel plate armor, bright silver sheen, ornate filigree engravings, royal craftsmanship",
    group: "fantasy",
  },
  {
    id: "mithril_elven",
    label: "Mithril Elven",
    prompt:
      "mithril elven plate armor, blue-tinted silver metal, gleaming enchanted surface, delicate elven leaf motifs",
    group: "fantasy",
  },
  {
    id: "dragon_scale",
    label: "Dragon Scale",
    prompt:
      "dragon scale plate armor, dark crimson metal, overlapping dragon scale pattern, black obsidian trim",
    group: "fantasy",
  },
];

type Stage =
  | "idle"
  | "extracting"
  | "uploading"
  | "texturing"
  | "loading-result"
  | "done"
  | "error";

interface TextureGeneratorTabProps {
  onAddToKit?: (shell: ShellMesh, texturedGlbUrl: string) => void;
  /** Shared extraction cache from parent — avoids re-extracting */
  sharedExtraction?: ShellExtractionResult | null;
  /** Shared extraction function from parent */
  onExtract?: (
    avatarUrl: string,
    onProgress?: (
      p: import("../../services/armor-pipeline/types").ShellExtractionProgress,
    ) => void,
    customOffsetM?: number,
  ) => Promise<ShellExtractionResult>;
}

export const TextureGeneratorTab: React.FC<TextureGeneratorTabProps> = ({
  onAddToKit,
  sharedExtraction,
  onExtract,
}) => {
  const viewerRef = useRef<ShellPreviewViewerRef>(null);
  const shellServiceRef = useRef<ShellExtractionService | null>(null);
  const textureServiceRef = useRef<ArmorTextureService | null>(null);

  // Settings
  const [avatarUrl, setAvatarUrl] = useState(AVATAR_OPTIONS[0].url);
  const [selectedSlots, setSelectedSlots] = useState<Set<EquipmentSlotName>>(
    new Set(ALL_SLOTS),
  );
  const [selectedBulk, setSelectedBulk] = useState<BulkClass | "custom">(
    "plate",
  );
  const [customThicknessMm, setCustomThicknessMm] = useState(50);
  const [textureMethod, setTextureMethod] = useState<TextureMethod>("solid");
  const [selectedPreset, setSelectedPreset] = useState<string>("rune");
  const [customPrompt, setCustomPrompt] = useState("");
  const [detailLevel, setDetailLevel] = useState<string>("plain");
  // Solid color controls
  const [customColor, setCustomColor] = useState("#3ab5a5"); // rune default
  const [useCustomColor, setUseCustomColor] = useState(false);
  const [metalness, setMetalness] = useState(0.85);
  const [roughness, setRoughness] = useState(0.35);

  // State
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const [slotTasks, setSlotTasks] = useState<SlotTask[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Shell extraction result (reused between texturing attempts)
  const [extractionResult, setExtractionResult] =
    useState<ShellExtractionResult | null>(null);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [
      ...prev.slice(-50),
      `[${new Date().toLocaleTimeString()}] ${msg}`,
    ]);
  }, []);

  const getPrompt = useCallback(() => {
    const base = customPrompt.trim()
      ? customPrompt.trim()
      : (MATERIAL_PRESETS.find((p) => p.id === selectedPreset)?.prompt ??
        MATERIAL_PRESETS[0].prompt);
    const detail = DETAIL_LEVELS.find((d) => d.id === detailLevel);
    const detailSuffix = detail ? `, ${detail.suffix}` : "";
    // Structure: [override shape interpretation], [material/color], [detail level], [output format]
    return `${AI_STYLE_PREFIX}, ${base}${detailSuffix}, ${AI_STYLE_SUFFIX}`;
  }, [customPrompt, selectedPreset, detailLevel]);

  /** Get the solid hex color for programmatic materials */
  const getSolidColor = useCallback((): string => {
    if (useCustomColor) return customColor;
    const preset = MATERIAL_PRESETS.find((p) => p.id === selectedPreset);
    return preset?.swatch ?? "#7A7A82";
  }, [useCustomColor, customColor, selectedPreset]);

  const handleGenerate = useCallback(async () => {
    const slots = Array.from(selectedSlots);
    if (slots.length === 0) return;

    // Clear any previous polling interval to avoid leaks
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    setStage("extracting");
    setError(null);
    setProgress(0);
    setLogs([]);
    setSlotTasks([]);

    try {
      // Initialize services
      if (!shellServiceRef.current) {
        shellServiceRef.current = new ShellExtractionService();
      }
      if (!textureServiceRef.current) {
        textureServiceRef.current = new ArmorTextureService();
      }

      // Step 1: Extract shells
      const customM =
        selectedBulk === "custom" && customThicknessMm > 0
          ? customThicknessMm / 1000
          : undefined;
      let result = extractionResult ?? sharedExtraction ?? null;
      // Re-extract if we need custom shells and the cached result doesn't have them
      const needsCustom = selectedBulk === "custom";
      const hasCustom = result?.shells.has("body_custom") ?? false;
      if (!result || result.avatarHeight === 0 || (needsCustom && !hasCustom)) {
        if (onExtract) {
          addLog("Extracting shells from avatar (shared)...");
          result = await onExtract(
            avatarUrl,
            (prog) => {
              setProgress(prog.progress * 20);
              addLog(prog.message);
            },
            customM,
          );
        } else {
          addLog("Extracting shells from avatar...");
          result = await shellServiceRef.current.extractShells(
            avatarUrl,
            ALL_SLOTS,
            ALL_BULKS,
            (prog) => {
              setProgress(prog.progress * 20);
              addLog(prog.message);
            },
            customM,
          );
        }
        setExtractionResult(result);
        addLog(`Shell extraction complete. ${result.shells.size} shells.`);
      } else {
        setExtractionResult(result);
        addLog("Reusing cached shell extraction.");
        setProgress(20);
      }

      viewerRef.current?.setAvatarScene(result.vrmScene);

      // ── Solid color: programmatic PBR materials (instant, no AI) ──
      if (textureMethod === "solid") {
        const hexColor = getSolidColor();
        const preset = MATERIAL_PRESETS.find((p) => p.id === selectedPreset);

        setStage("loading-result");
        addLog(
          `Applying solid ${useCustomColor ? "custom" : (preset?.label ?? "metal")} color (${hexColor}) — no AI needed`,
        );
        viewerRef.current?.clearOverlays();

        const scene = new THREE.Group();
        const localTasks: SlotTask[] = [];

        for (const slot of slots) {
          const shellKey = `${slot}_${selectedBulk}`;
          const shell = result.shells.get(shellKey);
          if (!shell) {
            addLog(`WARN: Shell not found: ${shellKey}, skipping`);
            continue;
          }

          const geo = shell.geometry.clone();
          geo.deleteAttribute("skinIndex");
          geo.deleteAttribute("skinWeight");

          const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(hexColor),
            metalness,
            roughness,
            side: THREE.DoubleSide,
          });

          scene.add(new THREE.Mesh(geo, material));
          localTasks.push({
            slot,
            taskId: `local_${slot}`,
            status: "succeeded" as const,
            progress: 100,
          });
          addLog(`  ${SLOT_LABELS[slot]}: solid color applied`);
        }

        viewerRef.current?.showTexturedResult(scene);
        setSlotTasks(localTasks);
        setProgress(100);
        setStage("done");
        addLog(`Done! ${localTasks.length} pieces — instant, uniform color.`);
        return;
      }

      // ── Batch Tiers: generate all 8 tile-based MMORPG tiers at once (programmatic) ──
      if (textureMethod === "batch") {
        const tierPresets = MATERIAL_PRESETS.filter((p) => p.group === "osrs");
        setStage("loading-result");
        addLog(
          `Generating ${tierPresets.length} material tiers for ${slots.length} slot(s)...`,
        );
        viewerRef.current?.clearOverlays();

        const scene = new THREE.Group();
        const localTasks: SlotTask[] = [];
        // Offset each tier horizontally for comparison
        const tierSpacing = 0.8;
        const totalWidth = (tierPresets.length - 1) * tierSpacing;

        for (let tierIdx = 0; tierIdx < tierPresets.length; tierIdx++) {
          const tier = tierPresets[tierIdx];
          const tierGroup = new THREE.Group();
          tierGroup.position.x = -totalWidth / 2 + tierIdx * tierSpacing;

          for (const slot of slots) {
            const shellKey = `${slot}_${selectedBulk}`;
            const shell = result.shells.get(shellKey);
            if (!shell) continue;

            const geo = shell.geometry.clone();
            geo.deleteAttribute("skinIndex");
            geo.deleteAttribute("skinWeight");

            const material = new THREE.MeshStandardMaterial({
              color: new THREE.Color(tier.swatch ?? "#7A7A82"),
              metalness,
              roughness,
              side: THREE.DoubleSide,
            });

            tierGroup.add(new THREE.Mesh(geo, material));
          }

          scene.add(tierGroup);
          localTasks.push({
            slot: slots[0], // just for tracking
            taskId: `batch_${tier.id}`,
            status: "succeeded" as const,
            progress: 100,
          });
          addLog(`  ${tier.label} (${tier.swatch}): applied`);
        }

        viewerRef.current?.showTexturedResult(scene);
        setSlotTasks(localTasks);
        setProgress(100);
        setStage("done");
        addLog(
          `Done! ${tierPresets.length} tiers × ${slots.length} slots — all instant.`,
        );
        return;
      }

      // ── AI Retexture: Meshy API ──
      const prompt = getPrompt();
      const preset = MATERIAL_PRESETS.find((p) => p.id === selectedPreset);
      const swatchHex = preset?.swatch; // only tile-based MMORPG presets have swatch

      // CRITICAL: Do NOT send image_style_url alongside text_style_prompt.
      // Per Meshy docs, image_style_url OVERRIDES text_style_prompt entirely —
      // our prompt would be silently ignored. The text prompt is our only tool
      // for telling Meshy "this is armor, not a body."

      addLog(`Prompt: "${prompt}"`);
      addLog(`Model: meshy-6 | PBR: enabled`);
      if (swatchHex)
        addLog(`Pre-paint: ${swatchHex} (primes Meshy to see correct color)`);

      // Step 2: Upload + start texture for each slot
      setStage("uploading");
      const tasks: { slot: EquipmentSlotName; taskId: string }[] = [];

      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const shellKey = `${slot}_${selectedBulk}`;
        const shell = result.shells.get(shellKey);
        if (!shell) {
          addLog(`WARN: Shell not found: ${shellKey}, skipping`);
          continue;
        }

        addLog(`Uploading ${SLOT_LABELS[slot]} (${selectedBulk})...`);
        // Pre-paint the shell with the target color so Meshy sees a bronze/iron/etc
        // metallic object instead of a grey body shape.
        const glbBlob = await shellServiceRef.current!.exportShellAsGLB(
          shell,
          swatchHex, // e.g. "#D4AF37" for bronze — undefined for fantasy presets
        );

        const { taskId: newTaskId, sizeKB } =
          await textureServiceRef.current!.startTexture(
            glbBlob,
            `${shellKey}_${Date.now()}.glb`,
            prompt,
            {
              enablePBR: true,
              aiModel: "meshy-6",
              // No styleImageUrl — it would override the text prompt entirely
            },
          );

        tasks.push({ slot, taskId: newTaskId });
        addLog(`  ${SLOT_LABELS[slot]}: ${sizeKB}KB → ${newTaskId}`);

        // Small delay between uploads to avoid server overload
        if (i < slots.length - 1) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      if (tasks.length === 0) {
        throw new Error("No shells found for selected slots");
      }

      // For single-slot, keep the old taskId for download button
      if (tasks.length === 1) {
        setTaskId(tasks[0].taskId);
      }

      // Step 3: Poll all tasks
      setStage("texturing");
      setProgress(30);
      const initialSlotTasks: SlotTask[] = tasks.map(
        ({ slot, taskId: tid }) => ({
          slot,
          taskId: tid,
          status: "pending" as const,
          progress: 0,
        }),
      );
      setSlotTasks(initialSlotTasks);

      addLog(
        `${tasks.length} texture task${tasks.length > 1 ? "s" : ""} submitted. Polling...`,
      );

      const service = textureServiceRef.current!;

      // Track final task statuses (React state is async, can't read after poll)
      const finalStatuses = new Map<string, TextureTaskStatus["status"]>();

      // Poll until all done
      await new Promise<void>((resolve, reject) => {
        const poll = async () => {
          try {
            let allDone = true;
            let totalProgress = 0;

            for (const { slot, taskId: tid } of tasks) {
              const status: TextureTaskStatus = await service.getStatus(tid);
              finalStatuses.set(tid, status.status);

              setSlotTasks((prev) =>
                prev.map((t) => {
                  if (t.slot !== slot) return t;
                  const newStatus =
                    status.status === "succeeded"
                      ? ("succeeded" as const)
                      : status.status === "failed"
                        ? ("failed" as const)
                        : status.status === "processing"
                          ? ("processing" as const)
                          : ("pending" as const);

                  if (newStatus === "succeeded" && t.status !== "succeeded") {
                    addLog(`${SLOT_LABELS[slot]} complete!`);
                  }
                  if (newStatus === "failed" && t.status !== "failed") {
                    addLog(
                      `${SLOT_LABELS[slot]} FAILED: ${status.error ?? "unknown"}`,
                    );
                  }

                  return {
                    ...t,
                    status: newStatus,
                    progress: status.progress,
                    error: status.error,
                  };
                }),
              );

              totalProgress +=
                status.status === "succeeded" ? 100 : status.progress;
              if (status.status !== "succeeded" && status.status !== "failed") {
                allDone = false;
              }
            }

            setProgress(30 + (totalProgress / tasks.length) * 0.7);

            if (allDone) {
              if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
              }
              resolve();
            }
          } catch (err) {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
            reject(err);
          }
        };

        pollRef.current = setInterval(poll, 5000);
        poll(); // Run once immediately
      });

      // Step 4: Load first SUCCEEDED result for preview (skip failed tasks)
      setStage("loading-result");
      const firstSucceeded = tasks.find(
        (t) => finalStatuses.get(t.taskId) === "succeeded",
      );
      if (firstSucceeded) {
        addLog("Loading textured model preview...");
        const downloadUrl = service.getDownloadUrl(firstSucceeded.taskId);
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(downloadUrl);

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
      }

      setProgress(100);
      setStage("done");
      addLog(
        `Done! ${tasks.length} piece${tasks.length > 1 ? "s" : ""} textured.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStage("error");
      addLog(`ERROR: ${msg}`);
    }
  }, [
    avatarUrl,
    selectedSlots,
    selectedBulk,
    customThicknessMm,
    textureMethod,
    selectedPreset,
    metalness,
    roughness,
    detailLevel,
    extractionResult,
    sharedExtraction,
    onExtract,
    getPrompt,
    getSolidColor,
    useCustomColor,
    addLog,
  ]);

  // Cleanup polling on unmount
  React.useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleDownload = useCallback(async () => {
    const completed = slotTasks.filter((t) => t.status === "succeeded");
    const isLocal = completed.some((t) => t.taskId.startsWith("local_"));
    const isBatch = completed.some((t) => t.taskId.startsWith("batch_"));

    if (isBatch && extractionResult) {
      // Batch tiers — export each tier × slot as separate GLBs
      const { GLTFExporter } =
        await import("three/addons/exporters/GLTFExporter.js");
      const exporter = new GLTFExporter();
      const tierPresets = MATERIAL_PRESETS.filter((p) => p.group === "osrs");
      const slots = Array.from(selectedSlots);

      for (const tier of tierPresets) {
        for (const slot of slots) {
          const shellKey = `${slot}_${selectedBulk}`;
          const shell = extractionResult.shells.get(shellKey);
          if (!shell) continue;

          const geo = shell.geometry.clone();
          geo.deleteAttribute("skinIndex");
          geo.deleteAttribute("skinWeight");
          const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(tier.swatch ?? "#7A7A82"),
            metalness,
            roughness,
          });
          const mesh = new THREE.Mesh(geo, mat);

          const glb = await new Promise<ArrayBuffer>((resolve, reject) => {
            exporter.parse(mesh, (r) => resolve(r as ArrayBuffer), reject, {
              binary: true,
            });
          });

          const blob = new Blob([glb], { type: "model/gltf-binary" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${slot}_${selectedBulk}_${tier.id}.glb`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    } else if (isLocal && extractionResult) {
      // Solid color — export each shell with solid material via GLTFExporter
      const { GLTFExporter } =
        await import("three/addons/exporters/GLTFExporter.js");
      const exporter = new GLTFExporter();
      const hexColor = getSolidColor();
      const preset = MATERIAL_PRESETS.find((p) => p.id === selectedPreset);

      for (const task of completed) {
        const shellKey = `${task.slot}_${selectedBulk}`;
        const shell = extractionResult.shells.get(shellKey);
        if (!shell) continue;

        const geo = shell.geometry.clone();
        geo.deleteAttribute("skinIndex");
        geo.deleteAttribute("skinWeight");
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(hexColor),
          metalness,
          roughness,
        });
        const mesh = new THREE.Mesh(geo, mat);

        const glb = await new Promise<ArrayBuffer>((resolve, reject) => {
          exporter.parse(mesh, (r) => resolve(r as ArrayBuffer), reject, {
            binary: true,
          });
        });

        const blob = new Blob([glb], { type: "model/gltf-binary" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${task.slot}_${selectedBulk}_${preset?.id ?? "solid"}.glb`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } else if (textureServiceRef.current && completed.length > 0) {
      // Meshy (detailed style) — download from server
      for (const task of completed) {
        const url = textureServiceRef.current.getDownloadUrl(task.taskId);
        const a = document.createElement("a");
        a.href = url;
        a.download = `textured_${task.slot}_${selectedBulk}.glb`;
        a.click();
      }
    } else if (taskId && textureServiceRef.current) {
      const url = textureServiceRef.current.getDownloadUrl(taskId);
      const a = document.createElement("a");
      a.href = url;
      a.download = `textured_${selectedBulk}.glb`;
      a.click();
    }
  }, [
    taskId,
    slotTasks,
    selectedBulk,
    selectedSlots,
    extractionResult,
    selectedPreset,
    metalness,
    roughness,
    getSolidColor,
  ]);

  const handleReset = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    viewerRef.current?.clear();
    setStage("idle");
    setProgress(0);
    setTaskId(null);
    setError(null);
    setLogs([]);
    setSlotTasks([]);
    setExtractionResult(null);
  }, []);

  const isRunning = stage !== "idle" && stage !== "done" && stage !== "error";

  return (
    <div className="flex h-full">
      {/* Left panel — Controls */}
      <div className="w-80 flex-shrink-0 border-r border-border-primary bg-bg-primary overflow-y-auto">
        <div className="p-4 space-y-5">
          {/* Header */}
          <div>
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <Paintbrush size={20} className="text-primary" />
              Texture Generator
            </h2>
            <p className="text-xs text-text-tertiary mt-1">
              Apply materials and AI textures to armor shells
            </p>
          </div>

          {/* Avatar Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              Avatar
            </label>
            <select
              value={avatarUrl}
              onChange={(e) => {
                setAvatarUrl(e.target.value);
                setExtractionResult(null); // force re-extract
              }}
              className="w-full bg-bg-secondary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary"
            >
              {AVATAR_OPTIONS.map((opt) => (
                <option key={opt.url} value={opt.url}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Slot Selection (multi-select for full set) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text-secondary">
                Equipment Slots
              </label>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setSelectedSlots(new Set(ALL_SLOTS))}
                  className="text-[10px] text-primary hover:underline"
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedSlots(new Set())}
                  className="text-[10px] text-text-tertiary hover:underline"
                >
                  None
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {ALL_SLOTS.map((slot) => (
                <button
                  key={slot}
                  onClick={() => {
                    setSelectedSlots((prev) => {
                      const next = new Set(prev);
                      if (next.has(slot)) next.delete(slot);
                      else next.add(slot);
                      return next;
                    });
                  }}
                  className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                    selectedSlots.has(slot)
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-bg-secondary text-text-tertiary border border-border-primary hover:border-border-secondary"
                  }`}
                >
                  {SLOT_LABELS[slot]}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk Class */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              Bulk Class
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_BULKS.map((bulk) => (
                <button
                  key={bulk}
                  onClick={() => setSelectedBulk(bulk)}
                  className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                    selectedBulk === bulk
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-bg-secondary text-text-tertiary border border-border-primary hover:border-border-secondary"
                  }`}
                >
                  {bulk} ({BULK_OFFSETS[bulk] * 1000}mm)
                </button>
              ))}
              <button
                onClick={() => setSelectedBulk("custom")}
                className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all col-span-2 ${
                  selectedBulk === "custom"
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-bg-secondary text-text-tertiary border border-border-primary hover:border-border-secondary"
                }`}
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

          {/* Texture Method */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              Texture Method
            </label>
            <div className="flex gap-1.5">
              {(
                [
                  {
                    id: "solid" as TextureMethod,
                    label: "Solid Color",
                    desc: "Instant",
                  },
                  {
                    id: "ai" as TextureMethod,
                    label: "AI Texture",
                    desc: "~$0.20/pc",
                  },
                  {
                    id: "batch" as TextureMethod,
                    label: "All Tiers",
                    desc: "Instant",
                  },
                ] as const
              ).map(({ id, label, desc }) => (
                <button
                  key={id}
                  onClick={() => {
                    setTextureMethod(id);
                    if (id === "solid" || id === "batch") {
                      const cur = MATERIAL_PRESETS.find(
                        (p) => p.id === selectedPreset,
                      );
                      if (cur?.group !== "osrs") {
                        setSelectedPreset("rune");
                      }
                    }
                    // AI mode keeps whatever preset is selected — supports both tile-based MMORPG and fantasy
                  }}
                  className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all text-center ${
                    textureMethod === id
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-bg-secondary text-text-tertiary border border-border-primary"
                  }`}
                >
                  <div>{label}</div>
                  <div className="text-[10px] opacity-60">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Solid Color options ── */}
          {textureMethod === "solid" && (
            <>
              {/* Metal Tier presets */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">
                  Metal Tier
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {MATERIAL_PRESETS.filter((p) => p.group === "osrs").map(
                    (preset) => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          setSelectedPreset(preset.id);
                          setUseCustomColor(false);
                          if (preset.swatch) setCustomColor(preset.swatch);
                        }}
                        className={`px-1.5 py-1.5 rounded-md text-[11px] font-medium transition-all flex flex-col items-center gap-1 ${
                          selectedPreset === preset.id && !useCustomColor
                            ? "bg-primary/20 text-primary border border-primary/30"
                            : "bg-bg-secondary text-text-tertiary border border-border-primary hover:border-border-secondary"
                        }`}
                      >
                        {preset.swatch && (
                          <span
                            className="w-4 h-4 rounded-full border border-border-primary"
                            style={{ backgroundColor: preset.swatch }}
                          />
                        )}
                        {preset.label}
                      </button>
                    ),
                  )}
                </div>

                {/* Custom color picker */}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => setUseCustomColor(!useCustomColor)}
                    className={`px-2 py-1 rounded text-[11px] font-medium ${
                      useCustomColor
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "bg-bg-secondary text-text-tertiary border border-border-primary"
                    }`}
                  >
                    Custom
                  </button>
                  {useCustomColor && (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="color"
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-border-primary bg-transparent"
                      />
                      <input
                        type="text"
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        className="flex-1 bg-bg-secondary border border-border-primary rounded px-2 py-1 text-xs text-text-primary font-mono"
                        placeholder="#D4AF37"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Material sliders */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">
                  Material Properties
                </label>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-tertiary w-16">
                      Metalness
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={metalness}
                      onChange={(e) => setMetalness(parseFloat(e.target.value))}
                      className="flex-1 accent-primary"
                    />
                    <span className="text-[11px] text-text-tertiary w-8 text-right">
                      {metalness.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-tertiary w-16">
                      Roughness
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={roughness}
                      onChange={(e) => setRoughness(parseFloat(e.target.value))}
                      className="flex-1 accent-primary"
                    />
                    <span className="text-[11px] text-text-tertiary w-8 text-right">
                      {roughness.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Batch Tiers options ── */}
          {textureMethod === "batch" && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">
                All 8 tile-based MMORPG Tiers
              </label>
              <div className="flex flex-wrap gap-1.5">
                {MATERIAL_PRESETS.filter((p) => p.group === "osrs").map(
                  (tier) => (
                    <div
                      key={tier.id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg-secondary border border-border-primary text-[11px] text-text-tertiary"
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-border-primary"
                        style={{ backgroundColor: tier.swatch }}
                      />
                      {tier.label}
                    </div>
                  ),
                )}
              </div>
              <p className="text-[11px] text-text-tertiary">
                Generates all tiers side-by-side for comparison. Each tier uses
                the metalness/roughness below.
              </p>
              {/* Material sliders for batch too */}
              <div className="space-y-1.5 mt-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-text-tertiary w-16">
                    Metalness
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={metalness}
                    onChange={(e) => setMetalness(parseFloat(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <span className="text-[11px] text-text-tertiary w-8 text-right">
                    {metalness.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-text-tertiary w-16">
                    Roughness
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={roughness}
                    onChange={(e) => setRoughness(parseFloat(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <span className="text-[11px] text-text-tertiary w-8 text-right">
                    {roughness.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── AI Texture options ── */}
          {textureMethod === "ai" && (
            <>
              {/* tile-based MMORPG Metal Tiers — AI textured with style reference for consistency */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">
                  Metal Tier{" "}
                  <span className="text-[10px] text-text-tertiary ml-1">
                    (uses color swatch for consistency)
                  </span>
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {MATERIAL_PRESETS.filter((p) => p.group === "osrs").map(
                    (preset) => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          setSelectedPreset(preset.id);
                          setCustomPrompt("");
                        }}
                        className={`px-1.5 py-1.5 rounded-md text-[11px] font-medium transition-all flex flex-col items-center gap-1 ${
                          selectedPreset === preset.id && !customPrompt
                            ? "bg-primary/20 text-primary border border-primary/30"
                            : "bg-bg-secondary text-text-tertiary border border-border-primary hover:border-border-secondary"
                        }`}
                      >
                        {preset.swatch && (
                          <span
                            className="w-4 h-4 rounded-full border border-border-primary"
                            style={{ backgroundColor: preset.swatch }}
                          />
                        )}
                        {preset.label}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Fantasy Detailed Presets */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">
                  Fantasy Presets{" "}
                  <span className="text-[10px] text-text-tertiary ml-1">
                    (detailed AI textures)
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {MATERIAL_PRESETS.filter((p) => p.group === "fantasy").map(
                    (preset) => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          setSelectedPreset(preset.id);
                          setCustomPrompt("");
                        }}
                        className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all text-left ${
                          selectedPreset === preset.id && !customPrompt
                            ? "bg-primary/20 text-primary border border-primary/30"
                            : "bg-bg-secondary text-text-tertiary border border-border-primary hover:border-border-secondary"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Custom Prompt */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">
                  Custom Prompt{" "}
                  <span className="text-[10px] text-text-tertiary ml-1">
                    (overrides preset)
                  </span>
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g., gold-trimmed bronze plate armor, ornate engravings..."
                  rows={3}
                  className="w-full bg-bg-secondary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary resize-none"
                />
              </div>

              {/* Detail Level */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">
                  Detail Level
                </label>
                <div className="flex gap-1">
                  {DETAIL_LEVELS.map((level, i) => (
                    <button
                      key={level.id}
                      onClick={() => setDetailLevel(level.id)}
                      title={level.desc}
                      className={`flex-1 px-1 py-1.5 rounded-md text-[11px] font-medium transition-all text-center ${
                        detailLevel === level.id
                          ? "bg-primary/20 text-primary border border-primary/30"
                          : "bg-bg-secondary text-text-tertiary border border-border-primary hover:border-border-secondary"
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-text-tertiary">
                  {DETAIL_LEVELS.find((d) => d.id === detailLevel)?.desc}
                </p>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-2 border-t border-border-primary">
            <button
              onClick={handleGenerate}
              disabled={isRunning}
              className="w-full px-4 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2
 bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {stage === "extracting"
                    ? "Extracting Shell..."
                    : stage === "uploading"
                      ? "Uploading..."
                      : stage === "texturing"
                        ? "Texturing..."
                        : "Loading Result..."}
                </>
              ) : (
                <>
                  {textureMethod === "batch" ? (
                    <Layers size={16} />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  {textureMethod === "batch"
                    ? `Generate All 8 Tiers (${selectedSlots.size} slot${selectedSlots.size > 1 ? "s" : ""})`
                    : textureMethod === "solid"
                      ? `Apply Color (${selectedSlots.size} slot${selectedSlots.size > 1 ? "s" : ""})`
                      : selectedSlots.size > 1
                        ? `AI Texture (${selectedSlots.size} slots)`
                        : "AI Texture"}
                </>
              )}
            </button>

            <div className="flex gap-2">
              <button
                onClick={handleDownload}
                disabled={stage !== "done"}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5
 bg-bg-secondary border border-border-primary text-text-secondary hover:text-text-primary hover:border-border-secondary
 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={14} />
                Download{slotTasks.length > 1 ? " All" : " GLB"}
              </button>

              <button
                onClick={handleReset}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5
 bg-bg-secondary border border-border-primary text-text-secondary hover:text-text-primary hover:border-border-secondary"
              >
                <RotateCcw size={14} />
                Reset
              </button>
            </div>

            {/* Add to Kit — all completed pieces */}
            {stage === "done" &&
              onAddToKit &&
              extractionResult &&
              slotTasks.some((t) => t.status === "succeeded") && (
                <button
                  onClick={async () => {
                    const service = textureServiceRef.current;
                    const completed = slotTasks.filter(
                      (t) => t.status === "succeeded",
                    );
                    const isLocal = completed.some((t) =>
                      t.taskId.startsWith("local_"),
                    );
                    const isBatch = completed.some((t) =>
                      t.taskId.startsWith("batch_"),
                    );

                    if (isLocal || isBatch) {
                      // Local/batch textures: export GLBs client-side as blob URLs
                      const { GLTFExporter } =
                        await import("three/addons/exporters/GLTFExporter.js");
                      const exporter = new GLTFExporter();
                      const hexColor = getSolidColor();

                      for (const task of completed) {
                        const shellKey = `${task.slot}_${selectedBulk}`;
                        const shell = extractionResult.shells.get(shellKey);
                        if (!shell) continue;

                        const geo = shell.geometry.clone();
                        geo.deleteAttribute("skinIndex");
                        geo.deleteAttribute("skinWeight");
                        const mat = new THREE.MeshStandardMaterial({
                          color: new THREE.Color(hexColor),
                          metalness,
                          roughness,
                        });
                        const mesh = new THREE.Mesh(geo, mat);

                        const glb = await new Promise<ArrayBuffer>(
                          (resolve, reject) => {
                            exporter.parse(
                              mesh,
                              (r) => resolve(r as ArrayBuffer),
                              reject,
                              { binary: true },
                            );
                          },
                        );

                        const blob = new Blob([glb], {
                          type: "model/gltf-binary",
                        });
                        const blobUrl = URL.createObjectURL(blob);
                        onAddToKit(shell, blobUrl);
                      }
                    } else if (service) {
                      // Meshy AI textures: use server download endpoint
                      for (const task of completed) {
                        const shellKey = `${task.slot}_${selectedBulk}`;
                        const shell = extractionResult.shells.get(shellKey);
                        if (shell) {
                          const downloadUrl = service.getDownloadUrl(
                            task.taskId,
                          );
                          onAddToKit(shell, downloadUrl);
                        }
                      }
                    }
                  }}
                  className="w-full px-4 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2
 bg-green-600 text-white hover:bg-green-500"
                >
                  <Wand2 size={16} />
                  Add{" "}
                  {slotTasks.filter((t) => t.status === "succeeded").length > 1
                    ? `${slotTasks.filter((t) => t.status === "succeeded").length} Pieces`
                    : "1 Piece"}{" "}
                  to Kit &amp; Preview
                </button>
              )}
          </div>

          {/* Per-slot task status */}
          {slotTasks.length > 1 && (
            <div className="space-y-1">
              {slotTasks.map((task) => (
                <div
                  key={task.slot}
                  className="flex items-center gap-2 px-2 py-1 rounded-md bg-bg-secondary border border-border-primary text-xs"
                >
                  <span className="font-medium text-text-primary flex-1">
                    {SLOT_LABELS[task.slot]}
                  </span>
                  {task.status === "pending" && (
                    <span className="text-text-tertiary">Pending</span>
                  )}
                  {task.status === "processing" && (
                    <>
                      <span className="text-text-tertiary">
                        {Math.round(task.progress)}%
                      </span>
                      <Loader2
                        size={12}
                        className="text-primary animate-spin"
                      />
                    </>
                  )}
                  {task.status === "succeeded" && (
                    <span className="text-green-400">Done</span>
                  )}
                  {task.status === "failed" && (
                    <span className="text-red-400">Failed</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Progress */}
          {isRunning && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-text-tertiary">
                <span>
                  {stage === "extracting"
                    ? "Extracting Shells"
                    : stage === "uploading"
                      ? "Uploading to Meshy"
                      : stage === "texturing"
                        ? "AI Texturing"
                        : "Loading Result"}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
              <AlertCircle
                size={14}
                className="text-red-400 mt-0.5 flex-shrink-0"
              />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Info box */}
          <div className="p-3 bg-bg-secondary rounded-lg border border-border-primary space-y-1.5">
            <h3 className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
              <Info size={12} />
              {textureMethod === "ai" ? "AI Texture Info" : "Info"}
            </h3>
            <ul className="text-xs text-text-tertiary space-y-0.5 list-disc pl-3">
              {textureMethod === "ai" ? (
                <>
                  <li>MESHY_API_KEY must be set in server .env</li>
                  <li>
                    Shell is sent as base64 data URI (no public URL needed)
                  </li>
                  <li>Each retexture call costs ~$0.20 and takes 2-5 min</li>
                </>
              ) : textureMethod === "batch" ? (
                <>
                  <li>
                    Generates all 8 tile-based MMORPG metal tiers side-by-side
                  </li>
                  <li>Instant — no API call needed</li>
                  <li>Download exports each tier × slot as separate GLBs</li>
                </>
              ) : (
                <>
                  <li>Instant — no API call, no cost</li>
                  <li>Perfect for tile-based-MMORPG-style flat metal armor</li>
                  <li>Adjust metalness/roughness for different looks</li>
                </>
              )}
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
                Choose a material and slots, then generate textures
              </p>
            ) : (
              logs.map((log, i) => (
                <p
                  key={i}
                  className={`text-xs font-mono ${
                    log.includes("ERROR")
                      ? "text-red-400"
                      : log.includes("complete") || log.includes("Done")
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
