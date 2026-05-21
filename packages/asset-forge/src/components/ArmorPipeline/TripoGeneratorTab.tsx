import {
  Wand2,
  Info,
  Loader2,
  Download,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Check,
  Box,
  Scissors,
  Paintbrush,
  Puzzle,
  Plus,
  Trash2,
  Move,
} from "lucide-react";
import React, { useRef, useState, useCallback, useEffect } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { ArmorTripoService } from "../../services/armor-pipeline/ArmorTripoService";
import { ShellExtractionService } from "../../services/armor-pipeline/ShellExtractionService";
import type {
  EquipmentSlotName,
  BulkClass,
  ShellExtractionResult,
  ShellMesh,
  ArmorAttachment,
} from "../../services/armor-pipeline/types";
import { BULK_OFFSETS } from "../../services/armor-pipeline/types";
import {
  AVATAR_OPTIONS,
  ALL_SLOTS,
  ALL_BULKS,
  ATTACHMENT_SLOTS,
} from "../../services/armor-pipeline/constants";
import {
  ShellPreviewViewer,
  type ShellPreviewViewerRef,
} from "./ShellPreviewViewer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Wizard steps */
type WizardStep =
  | "setup"
  | "segmenting"
  | "customize"
  | "texturing"
  | "attachments"
  | "done";

/** Per-part prompt assignment */
interface PartPrompt {
  partName: string;
  prompt: string;
  enabled: boolean;
}

/** Default prompts based on part name keywords */
function defaultPromptForPart(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("shoulder") || lower.includes("pauldron"))
    return "ornate metal pauldrons with rivets and trim";
  if (
    lower.includes("chest") ||
    lower.includes("torso") ||
    lower.includes("front")
  )
    return "polished plate breastplate with engraved crest";
  if (lower.includes("back"))
    return "reinforced metal back plate with leather straps";
  if (lower.includes("arm") || lower.includes("sleeve"))
    return "layered metal arm guards with leather bindings";
  if (
    lower.includes("waist") ||
    lower.includes("belt") ||
    lower.includes("hip")
  )
    return "thick leather belt with metal buckle and pouches";
  if (lower.includes("leg") || lower.includes("thigh"))
    return "articulated plate leg armor with knee guards";
  if (lower.includes("boot") || lower.includes("foot"))
    return "heavy plated boots with metal toe caps";
  if (lower.includes("neck") || lower.includes("collar"))
    return "raised metal gorget with chain mail trim";
  return "medieval plate armor, polished metal with subtle detail";
}

// ---------------------------------------------------------------------------
// Segment session persistence (localStorage)
// ---------------------------------------------------------------------------

interface SavedSegmentSession {
  segmentTaskId: string;
  partNames: string[];
  avatarUrl: string;
  slot: EquipmentSlotName;
  bulk: BulkClass;
  timestamp: number;
}

const SESSION_STORAGE_KEY = "tripo-segment-sessions";

function saveSegmentSession(session: SavedSegmentSession) {
  try {
    const key = `${session.avatarUrl}:${session.slot}:${session.bulk}`;
    const all = JSON.parse(
      localStorage.getItem(SESSION_STORAGE_KEY) || "{}",
    ) as Record<string, SavedSegmentSession>;
    all[key] = session;
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* localStorage unavailable */
  }
}

function loadSegmentSession(
  url: string,
  slot: EquipmentSlotName,
  bulk: BulkClass,
): SavedSegmentSession | null {
  try {
    const key = `${url}:${slot}:${bulk}`;
    const all = JSON.parse(
      localStorage.getItem(SESSION_STORAGE_KEY) || "{}",
    ) as Record<string, SavedSegmentSession>;
    const session = all[key];
    if (!session) return null;
    // Validate shape — localStorage data may be stale or malformed
    if (
      typeof session.segmentTaskId !== "string" ||
      !Array.isArray(session.partNames) ||
      typeof session.timestamp !== "number"
    ) {
      delete all[key];
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(all));
      return null;
    }
    // Expire after 24h — Tripo task IDs don't last forever
    if (Date.now() - session.timestamp > 24 * 60 * 60 * 1000) {
      delete all[key];
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(all));
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function clearSegmentSession(
  url: string,
  slot: EquipmentSlotName,
  bulk: BulkClass,
) {
  try {
    const key = `${url}:${slot}:${bulk}`;
    const all = JSON.parse(
      localStorage.getItem(SESSION_STORAGE_KEY) || "{}",
    ) as Record<string, SavedSegmentSession>;
    delete all[key];
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TripoGeneratorTabProps {
  onAddToKit?: (shell: ShellMesh, texturedGlbUrl: string) => void;
}

export const TripoGeneratorTab: React.FC<TripoGeneratorTabProps> = ({
  onAddToKit,
}) => {
  const viewerRef = useRef<ShellPreviewViewerRef>(null);
  const shellServiceRef = useRef<ShellExtractionService | null>(null);
  const tripoServiceRef = useRef<ArmorTripoService | null>(null);

  // Shell settings
  const [avatarUrl, setAvatarUrl] = useState(AVATAR_OPTIONS[0].url);
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlotName>("body");
  const [selectedBulk, setSelectedBulk] = useState<BulkClass>("plate");
  const [quality, setQuality] = useState<"standard" | "detailed">("standard");

  // Wizard state
  const [step, setStep] = useState<WizardStep>("setup");
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Segment results
  const [segmentTaskId, setSegmentTaskId] = useState<string | null>(null);
  const [partPrompts, setPartPrompts] = useState<PartPrompt[]>([]);
  const [expandedPart, setExpandedPart] = useState<string | null>(null);

  // Texture chain state (granular retry without credit waste)
  const [textureChainTaskId, setTextureChainTaskId] = useState<string | null>(
    null,
  );
  const [resumeFromGroup, setResumeFromGroup] = useState(0);
  const [cachedGroups, setCachedGroups] = useState<
    { partNames: string[]; prompt: string }[] | null
  >(null);

  // Saved session detection
  const [savedSession, setSavedSession] = useState<SavedSegmentSession | null>(
    null,
  );

  // Texture results
  const [completeTaskId, setCompleteTaskId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Shell data (for rigging / add-to-kit)
  const [extractionResult, setExtractionResult] =
    useState<ShellExtractionResult | null>(null);
  const [currentShell, setCurrentShell] = useState<ShellMesh | null>(null);

  // Attachment state
  const [attachments, setAttachments] = useState<ArmorAttachment[]>([]);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const [expandedAttachment, setExpandedAttachment] = useState<string | null>(
    null,
  );
  const gltfLoaderRef = useRef(new GLTFLoader());

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [
      ...prev.slice(-100),
      `[${new Date().toLocaleTimeString()}] ${msg}`,
    ]);
  }, []);

  // Ensure services exist
  const getShellService = useCallback(() => {
    if (!shellServiceRef.current)
      shellServiceRef.current = new ShellExtractionService();
    return shellServiceRef.current;
  }, []);

  const getTripoService = useCallback(() => {
    if (!tripoServiceRef.current)
      tripoServiceRef.current = new ArmorTripoService();
    return tripoServiceRef.current;
  }, []);

  // Check for saved segment session when settings change
  useEffect(() => {
    const session = loadSegmentSession(avatarUrl, selectedSlot, selectedBulk);
    setSavedSession(session);
  }, [avatarUrl, selectedSlot, selectedBulk]);

  // Resume a saved segment session (skip the expensive upload+import+segment)
  const handleResumeSession = useCallback(() => {
    if (!savedSession) return;

    setError(null);
    addLog(
      `Resuming saved segment from ${new Date(savedSession.timestamp).toLocaleString()}`,
    );
    addLog(`Segment task: ${savedSession.segmentTaskId}`);
    addLog(`Parts: ${savedSession.partNames.join(", ")}`);

    setSegmentTaskId(savedSession.segmentTaskId);
    setPartPrompts(
      savedSession.partNames.map((name) => ({
        partName: name,
        prompt: defaultPromptForPart(name),
        enabled: true,
      })),
    );

    // Reset texture chain state
    setTextureChainTaskId(null);
    setResumeFromGroup(0);
    setCachedGroups(null);

    setStep("customize");
  }, [savedSession, addLog]);

  // =====================================================================
  // Step 1: Extract shell → upload → import → segment → get parts
  // =====================================================================

  const handleSegment = useCallback(async () => {
    setStep("segmenting");
    setError(null);
    setLogs([]);
    setPartPrompts([]);
    setSegmentTaskId(null);
    setCompleteTaskId(null);
    setDownloadUrl(null);

    try {
      const shellService = getShellService();
      const tripoService = getTripoService();

      // Extract shell
      let result = extractionResult;
      if (!result || result.avatarHeight === 0) {
        addLog("Extracting shell from avatar...");
        result = await shellService.extractShells(
          avatarUrl,
          ALL_SLOTS,
          ALL_BULKS,
          (prog) => addLog(prog.message),
        );
        setExtractionResult(result);
      } else {
        addLog("Reusing cached shell extraction.");
      }

      // Set up viewer with VRM (enables bone access for attachments)
      if (result.vrm) {
        viewerRef.current?.setupAvatar(
          result.vrmScene,
          result.vrm as unknown as Parameters<
            NonNullable<typeof viewerRef.current>["setupAvatar"]
          >[1],
        );
      } else {
        viewerRef.current?.setAvatarScene(result.vrmScene);
      }

      // Export shell as GLB
      const shellKey = `${selectedSlot}_${selectedBulk}`;
      const shell = result.shells.get(shellKey);
      if (!shell) throw new Error(`Shell not found: ${shellKey}`);

      setCurrentShell(shell);
      addLog(`Exporting ${shellKey} as GLB...`);
      const glbBlob = await shellService.exportShellAsGLB(shell);
      addLog(`GLB: ${(glbBlob.size / 1024).toFixed(1)}KB`);

      // Upload → import → segment (server handles the chain)
      addLog("Uploading to Tripo → import → segment...");
      addLog("This takes 1-3 minutes. Please wait.");

      const segResult = await tripoService.uploadAndSegment(
        glbBlob,
        `${shellKey}_tripo_${Date.now()}.glb`,
      );

      setSegmentTaskId(segResult.segmentTaskId);
      addLog(
        `Segmentation complete! Found ${segResult.partNames.length} parts:`,
      );
      for (const name of segResult.partNames) {
        addLog(`  • ${name}`);
      }

      // Build prompt assignments with smart defaults
      const prompts: PartPrompt[] = segResult.partNames.map((name) => ({
        partName: name,
        prompt: defaultPromptForPart(name),
        enabled: true,
      }));
      setPartPrompts(prompts);

      // Persist session so user can resume without re-segmenting
      saveSegmentSession({
        segmentTaskId: segResult.segmentTaskId,
        partNames: segResult.partNames,
        avatarUrl,
        slot: selectedSlot,
        bulk: selectedBulk,
        timestamp: Date.now(),
      });
      setSavedSession(null); // clear "resume" prompt since we just created a fresh session

      setStep("customize");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStep("setup");
      addLog(`ERROR: ${msg}`);
    }
  }, [
    avatarUrl,
    selectedSlot,
    selectedBulk,
    extractionResult,
    addLog,
    getShellService,
    getTripoService,
  ]);

  // =====================================================================
  // Step 2: Texture parts with prompts → reassemble
  // =====================================================================

  const handleTexture = useCallback(async () => {
    if (!segmentTaskId) return;

    const enabledParts = partPrompts.filter((p) => p.enabled);
    if (enabledParts.length === 0) {
      setError("Enable at least one part to texture");
      return;
    }

    setStep("texturing");
    setError(null);

    try {
      const tripoService = getTripoService();

      // Group parts by prompt to reduce API calls
      const promptGroups = new Map<string, string[]>();
      for (const part of enabledParts) {
        const existing = promptGroups.get(part.prompt);
        if (existing) existing.push(part.partName);
        else promptGroups.set(part.prompt, [part.partName]);
      }

      const groups = Array.from(promptGroups.entries()).map(
        ([prompt, partNames]) => ({ partNames, prompt }),
      );

      // Check if we can resume from a previous partial run
      let startIdx = 0;
      let currentTaskId = segmentTaskId;

      const groupsMatch =
        cachedGroups &&
        cachedGroups.length === groups.length &&
        cachedGroups.every(
          (g, i) =>
            g.prompt === groups[i].prompt &&
            g.partNames.length === groups[i].partNames.length &&
            g.partNames.every((n, j) => n === groups[i].partNames[j]),
        );

      if (groupsMatch && textureChainTaskId && resumeFromGroup > 0) {
        startIdx = resumeFromGroup;
        currentTaskId = textureChainTaskId;
        addLog(
          `Resuming from group ${startIdx + 1}/${groups.length} (previous groups preserved)`,
        );
      } else {
        // Fresh run or prompts changed — start from segment
        setTextureChainTaskId(null);
        setResumeFromGroup(0);
        addLog(
          `Texturing ${enabledParts.length} parts in ${groups.length} group(s)...`,
        );
      }

      setCachedGroups(groups);

      // Chain texture calls: each builds on the previous result
      for (let i = startIdx; i < groups.length; i++) {
        const group = groups[i];
        addLog(
          `[${i + 1}/${groups.length}] Texturing: ${group.partNames.join(", ")}`,
        );
        addLog(
          `  Prompt: "${group.prompt.slice(0, 80)}${group.prompt.length > 80 ? "..." : ""}"`,
        );

        const { taskId } = await tripoService.startTexturePart(
          currentTaskId,
          group.partNames,
          group.prompt,
          { quality },
        );
        addLog(`  Task: ${taskId}`);

        // Poll until complete (throttled logging — only on status/progress change)
        let lastLogKey = "";
        const status = await tripoService.waitForCompletion(taskId, (s) => {
          const key = `${s.status}-${Math.floor(s.progress / 10) * 10}`;
          if (key !== lastLogKey) {
            lastLogKey = key;
            addLog(`  [${i + 1}/${groups.length}] ${s.status} ${s.progress}%`);
          }
        });

        addLog(
          `  Group ${i + 1} done (credits: ${status.consumedCredit ?? "?"})`,
        );

        // Update chain state so a retry resumes from here
        currentTaskId = taskId;
        setTextureChainTaskId(taskId);
        setResumeFromGroup(i + 1);
      }

      // All texturing done — reassemble via mesh completion
      addLog("All parts textured. Running mesh completion (reassembly)...");
      const { taskId: completeId } =
        await tripoService.startMeshCompletion(currentTaskId);
      addLog(`Completion task: ${completeId}`);

      let lastLogKey = "";
      const completeStatus = await tripoService.waitForCompletion(
        completeId,
        (s) => {
          const key = `${s.status}-${Math.floor(s.progress / 10) * 10}`;
          if (key !== lastLogKey) {
            lastLogKey = key;
            addLog(`Assembly: ${s.status} ${s.progress}%`);
          }
        },
      );

      setCompleteTaskId(completeId);
      const url = tripoService.getDownloadUrl(completeId);
      setDownloadUrl(url);
      setStep("done");
      addLog(`Done! Credits: ${completeStatus.consumedCredit ?? "?"}`);

      // Clear texture chain state on full success
      setTextureChainTaskId(null);
      setResumeFromGroup(0);
      setCachedGroups(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStep("customize");
      addLog(`ERROR: ${msg}`);
      addLog(
        "Previous steps preserved. Click 'Texture' to retry from the failed step.",
      );
    }
  }, [
    segmentTaskId,
    partPrompts,
    quality,
    textureChainTaskId,
    resumeFromGroup,
    cachedGroups,
    addLog,
    getTripoService,
  ]);

  // =====================================================================
  // Step 3: Attachments — generate 3D pieces on bones
  // =====================================================================

  /** Set up the viewer with the VRM for bone-parented attachments */
  const ensureViewerSetup = useCallback(() => {
    if (!extractionResult) return;
    const vrm = extractionResult.vrm;
    if (vrm && extractionResult.vrmScene) {
      // setupAvatar gives us bone access for attachments
      viewerRef.current?.setupAvatar(
        extractionResult.vrmScene,
        vrm as unknown as Parameters<
          NonNullable<typeof viewerRef.current>["setupAvatar"]
        >[1],
      );
    }
  }, [extractionResult]);

  const handleAddAttachment = useCallback(
    (slotId: string) => {
      const slotDef = ATTACHMENT_SLOTS.find((s) => s.id === slotId);
      if (!slotDef) return;

      // Prevent duplicates
      if (attachments.some((a) => a.slotId === slotId)) return;

      const attachment: ArmorAttachment = {
        id: `${slotId}_${Date.now()}`,
        slotId,
        label: slotDef.label,
        boneName: slotDef.boneName,
        prompt: slotDef.promptSuggestion,
        status: "idle",
        offset: { ...slotDef.defaultOffset },
        rotation: { x: 0, y: 0, z: 0 },
        scale: slotDef.defaultScale,
      };

      setAttachments((prev) => [...prev, attachment]);
      setExpandedAttachment(attachment.id);
      addLog(`Added attachment slot: ${slotDef.label}`);
    },
    [attachments, addLog],
  );

  const handleRemoveAttachment = useCallback(
    (id: string) => {
      const att = attachments.find((a) => a.id === id);
      if (att) {
        viewerRef.current?.removeBoneAttachment(att.id);
        addLog(`Removed attachment: ${att.label}`);
      }
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      if (expandedAttachment === id) setExpandedAttachment(null);
    },
    [attachments, expandedAttachment, addLog],
  );

  const handleGenerateAttachment = useCallback(
    async (id: string) => {
      // Read from ref to avoid stale closure — attachments may change while generation is in-flight
      const currentAttachments = attachmentsRef.current;
      const idx = currentAttachments.findIndex((a) => a.id === id);
      if (idx < 0) return;
      const att = currentAttachments[idx];

      setAttachments((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, status: "generating", error: undefined } : a,
        ),
      );

      try {
        const tripoService = getTripoService();

        addLog(`Generating "${att.label}": "${att.prompt.slice(0, 60)}..."`);
        const { taskId } = await tripoService.startTextToModel(att.prompt, {
          faceLimit: 5000,
          pbr: true,
          quality,
        });

        setAttachments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, tripoTaskId: taskId } : a)),
        );
        addLog(`  Task: ${taskId}`);

        // Poll until complete
        let lastLogKey = "";
        const status = await tripoService.waitForCompletion(taskId, (s) => {
          const key = `${s.status}-${Math.floor(s.progress / 10) * 10}`;
          if (key !== lastLogKey) {
            lastLogKey = key;
            addLog(`  ${att.label}: ${s.status} ${s.progress}%`);
          }
        });

        addLog(
          `  ${att.label} generated! Credits: ${status.consumedCredit ?? "?"}`,
        );

        // Download and add to viewer
        const downloadUrlForAttachment = tripoService.getDownloadUrl(taskId);
        const gltf = await gltfLoaderRef.current.loadAsync(
          downloadUrlForAttachment,
        );

        // Log mesh info for debugging
        let meshCount = 0;
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) meshCount++;
        });
        addLog(`  Mesh count: ${meshCount}`);

        // Auto-scale: compute bounding box of generated mesh, scale to fit avatar
        const bbox = new THREE.Box3().setFromObject(gltf.scene);
        const size = bbox.getSize(new THREE.Vector3());
        const center = bbox.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        addLog(
          `  Generated size: ${size.x.toFixed(3)} x ${size.y.toFixed(3)} x ${size.z.toFixed(3)} (max: ${maxDim.toFixed(3)})`,
        );

        // Scale so the largest dimension matches the target size
        // Target is relative to avatar height (~1.6m) — att.scale is in meters
        const targetSize = att.scale;
        const autoScale = maxDim > 0 ? targetSize / maxDim : targetSize;
        addLog(
          `  Auto-scale: ${autoScale.toFixed(4)} (target: ${targetSize}m)`,
        );

        // Center the mesh on its own origin
        gltf.scene.position.sub(center);

        // Wrap in a group for consistent transform
        const wrapper = new THREE.Group();
        wrapper.add(gltf.scene);

        viewerRef.current?.addBoneAttachment(
          att.id,
          wrapper,
          att.boneName,
          new THREE.Vector3(att.offset.x, att.offset.y, att.offset.z),
          new THREE.Euler(att.rotation.x, att.rotation.y, att.rotation.z),
          autoScale,
        );

        setAttachments((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, status: "ready", scale: autoScale } : a,
          ),
        );

        addLog(`  ${att.label} placed on bone "${att.boneName}"`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, status: "failed", error: msg } : a,
          ),
        );
        addLog(`  ERROR generating ${att.label}: ${msg}`);
      }
    },
    [quality, addLog, getTripoService],
  );

  const handleUpdateAttachmentTransform = useCallback(
    (id: string, field: string, value: number) => {
      setAttachments((prev) =>
        prev.map((a) => {
          if (a.id !== id) return a;
          const updated = { ...a };
          if (field === "scale") {
            updated.scale = value;
          } else if (field.startsWith("offset.")) {
            const axis = field.split(".")[1] as "x" | "y" | "z";
            updated.offset = { ...updated.offset, [axis]: value };
          } else if (field.startsWith("rotation.")) {
            const axis = field.split(".")[1] as "x" | "y" | "z";
            updated.rotation = { ...updated.rotation, [axis]: value };
          }

          // Update viewer in real-time
          if (a.status === "ready") {
            viewerRef.current?.updateAttachmentTransform(
              id,
              new THREE.Vector3(
                updated.offset.x,
                updated.offset.y,
                updated.offset.z,
              ),
              new THREE.Euler(
                updated.rotation.x,
                updated.rotation.y,
                updated.rotation.z,
              ),
              updated.scale,
            );
          }

          return updated;
        }),
      );
    },
    [],
  );

  // =====================================================================
  // Preview + Download
  // =====================================================================

  const handlePreview = useCallback(async () => {
    if (!downloadUrl) return;
    try {
      addLog("Loading 3D preview...");
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
      addLog("Preview loaded.");
    } catch (err) {
      addLog(
        `Preview error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }, [downloadUrl, addLog]);

  const handleDownload = useCallback(() => {
    if (!downloadUrl) return;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `tripo_segmented_${selectedSlot}_${selectedBulk}_${Date.now()}.glb`;
    a.click();
  }, [downloadUrl, selectedSlot, selectedBulk]);

  const handleReset = useCallback(() => {
    viewerRef.current?.clear();
    setStep("setup");
    setError(null);
    setLogs([]);
    setPartPrompts([]);
    setSegmentTaskId(null);
    setCompleteTaskId(null);
    setDownloadUrl(null);
    setExtractionResult(null);
    setCurrentShell(null);
    setExpandedPart(null);
    // Clear texture chain state
    setTextureChainTaskId(null);
    setResumeFromGroup(0);
    setCachedGroups(null);
    // Clear attachments
    viewerRef.current?.clearBoneAttachments();
    setAttachments([]);
    setExpandedAttachment(null);
    // Clear saved session for this config
    clearSegmentSession(avatarUrl, selectedSlot, selectedBulk);
    setSavedSession(null);
  }, [avatarUrl, selectedSlot, selectedBulk]);

  const isRunning =
    step === "segmenting" ||
    step === "texturing" ||
    attachments.some((a) => a.status === "generating");

  // =====================================================================
  // Render
  // =====================================================================

  return (
    <div className="flex h-full">
      {/* Left panel — Controls */}
      <div className="w-80 flex-shrink-0 border-r border-border-primary bg-bg-primary overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div>
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <Wand2 size={20} className="text-purple-400" />
              Tripo Armor Studio
            </h2>
            <p className="text-xs text-text-tertiary mt-1">
              Texture + 3D attachments for unique armor
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1 text-[10px] flex-wrap">
            {(
              [
                { id: "setup", label: "Setup", icon: Box },
                { id: "segmenting", label: "Segment", icon: Scissors },
                { id: "customize", label: "Texture", icon: Paintbrush },
                { id: "attachments", label: "Attach", icon: Move },
                { id: "done", label: "Done", icon: Check },
              ] as const
            ).map((s, i) => {
              const Icon = s.icon;
              const steps: WizardStep[] = [
                "setup",
                "segmenting",
                "customize",
                "texturing",
                "attachments",
                "done",
              ];
              const currentIdx = steps.indexOf(step);
              const stepIdx = steps.indexOf(s.id as WizardStep);
              const isActive =
                step === s.id || (s.id === "customize" && step === "texturing");
              const isPast = stepIdx < currentIdx;

              return (
                <React.Fragment key={s.id}>
                  {i > 0 && (
                    <div
                      className={`flex-1 h-px min-w-[8px] ${isPast ? "bg-purple-500" : "bg-border-primary"}`}
                    />
                  )}
                  <div
                    className={`flex items-center gap-1 px-1.5 py-1 rounded ${
                      isActive
                        ? "text-purple-400 font-medium"
                        : isPast
                          ? "text-purple-400/60"
                          : "text-text-tertiary"
                    }`}
                  >
                    <Icon size={10} />
                    {s.label}
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* === STEP: Setup === */}
          {(step === "setup" || step === "segmenting") && (
            <>
              {/* Avatar */}
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
                  disabled={isRunning}
                  className="w-full bg-bg-secondary border border-border-primary rounded-lg px-3 py-2 text-sm text-text-primary disabled:opacity-50"
                >
                  {AVATAR_OPTIONS.map((opt) => (
                    <option key={opt.url} value={opt.url}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Slot */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-secondary">
                  Slot
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {ALL_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      disabled={isRunning}
                      className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50 ${
                        selectedSlot === slot
                          ? "bg-primary/20 text-primary border border-primary/30"
                          : "bg-bg-secondary text-text-tertiary border border-border-primary hover:border-border-secondary"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bulk */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-secondary">
                  Bulk Class
                </label>
                <div className="grid grid-cols-2 gap-1">
                  {ALL_BULKS.map((bulk) => (
                    <button
                      key={bulk}
                      onClick={() => setSelectedBulk(bulk)}
                      disabled={isRunning}
                      className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50 ${
                        selectedBulk === bulk
                          ? "bg-primary/20 text-primary border border-primary/30"
                          : "bg-bg-secondary text-text-tertiary border border-border-primary hover:border-border-secondary"
                      }`}
                    >
                      {bulk} ({BULK_OFFSETS[bulk] * 1000}mm)
                    </button>
                  ))}
                </div>
              </div>

              {/* Resume saved session (skip expensive upload+segment) */}
              {savedSession && step === "setup" && (
                <div className="p-3 rounded-lg border border-purple-500/30 bg-purple-500/5 space-y-2">
                  <p className="text-xs text-purple-300 font-medium">
                    Saved segmentation found
                  </p>
                  <p className="text-[10px] text-text-tertiary">
                    {savedSession.partNames.length} parts from{" "}
                    {new Date(savedSession.timestamp).toLocaleString()}
                  </p>
                  <button
                    onClick={handleResumeSession}
                    className="w-full px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5
 bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30"
                  >
                    <RotateCcw size={14} />
                    Resume — Skip to Customize
                  </button>
                </div>
              )}

              {/* Segment button */}
              <button
                onClick={handleSegment}
                disabled={isRunning}
                className="w-full px-4 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2
 bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {step === "segmenting" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Uploading & Segmenting...
                  </>
                ) : (
                  <>
                    <Scissors size={16} />
                    {savedSession
                      ? "Re-segment (fresh)"
                      : "Upload & Segment Shell"}
                  </>
                )}
              </button>

              {/* Skip texturing, go straight to attachments */}
              {step === "setup" && (
                <button
                  onClick={async () => {
                    setError(null);
                    setLogs([]);
                    try {
                      const shellService = getShellService();
                      let result = extractionResult;
                      if (!result || result.avatarHeight === 0) {
                        addLog("Extracting shell for attachment preview...");
                        result = await shellService.extractShells(
                          avatarUrl,
                          ALL_SLOTS,
                          ALL_BULKS,
                          (prog) => addLog(prog.message),
                        );
                        setExtractionResult(result);
                      }
                      if (result.vrm) {
                        viewerRef.current?.setupAvatar(
                          result.vrmScene,
                          result.vrm as unknown as Parameters<
                            NonNullable<typeof viewerRef.current>["setupAvatar"]
                          >[1],
                        );
                      }
                      addLog("Ready for attachments.");
                      setStep("attachments");
                    } catch (err) {
                      const msg =
                        err instanceof Error ? err.message : String(err);
                      setError(msg);
                      addLog(`ERROR: ${msg}`);
                    }
                  }}
                  disabled={isRunning}
                  className="w-full px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5
 bg-bg-secondary border border-border-primary text-text-secondary hover:text-text-primary hover:border-border-secondary
 disabled:opacity-50"
                >
                  <Move size={14} />
                  Skip to 3D Attachments
                </button>
              )}
            </>
          )}

          {/* === STEP: Customize part prompts === */}
          {(step === "customize" || step === "texturing") && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
                  <Puzzle size={14} />
                  Discovered Parts ({partPrompts.length})
                </label>
                <p className="text-[10px] text-text-tertiary">
                  Assign a texture prompt to each part. Parts with the same
                  prompt are grouped into one API call.
                </p>
              </div>

              <div className="space-y-1">
                {partPrompts.map((part, idx) => {
                  const isExpanded = expandedPart === part.partName;
                  return (
                    <div
                      key={part.partName}
                      className={`rounded-md bg-bg-secondary border transition-all ${
                        isExpanded
                          ? "border-purple-500/30"
                          : "border-border-primary hover:border-border-secondary"
                      }`}
                    >
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={part.enabled}
                          disabled={step === "texturing"}
                          onChange={() =>
                            setPartPrompts((prev) =>
                              prev.map((p, i) =>
                                i === idx ? { ...p, enabled: !p.enabled } : p,
                              ),
                            )
                          }
                          className="rounded"
                        />
                        <span className="text-xs font-medium text-text-primary flex-1 truncate">
                          {part.partName}
                        </span>
                        <button
                          onClick={() =>
                            setExpandedPart(isExpanded ? null : part.partName)
                          }
                          disabled={step === "texturing"}
                          className="text-[10px] text-text-tertiary hover:text-purple-400 px-1 disabled:opacity-50"
                        >
                          {isExpanded ? "close" : "edit"}
                        </button>
                      </div>
                      {!isExpanded && (
                        <p className="px-2 pb-1.5 text-[10px] text-text-tertiary truncate">
                          {part.prompt}
                        </p>
                      )}
                      {isExpanded && (
                        <div className="px-2 pb-2">
                          <textarea
                            value={part.prompt}
                            onChange={(e) =>
                              setPartPrompts((prev) =>
                                prev.map((p, i) =>
                                  i === idx
                                    ? { ...p, prompt: e.target.value }
                                    : p,
                                ),
                              )
                            }
                            rows={3}
                            className="w-full bg-bg-primary border border-border-primary rounded px-2 py-1.5 text-xs text-text-primary resize-none"
                          />
                          <button
                            onClick={() =>
                              setPartPrompts((prev) =>
                                prev.map((p, i) =>
                                  i === idx
                                    ? {
                                        ...p,
                                        prompt: defaultPromptForPart(
                                          p.partName,
                                        ),
                                      }
                                    : p,
                                ),
                              )
                            }
                            className="text-[10px] text-text-tertiary hover:text-purple-400 mt-1"
                          >
                            Reset to default
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Quality */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-secondary">
                  Texture Quality
                </label>
                <div className="grid grid-cols-2 gap-1">
                  {(["standard", "detailed"] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuality(q)}
                      disabled={step === "texturing"}
                      className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all capitalize disabled:opacity-50 ${
                        quality === q
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                          : "bg-bg-secondary text-text-tertiary border border-border-primary hover:border-border-secondary"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate button */}
              <button
                onClick={handleTexture}
                disabled={
                  step === "texturing" ||
                  partPrompts.filter((p) => p.enabled).length === 0
                }
                className="w-full px-4 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2
 bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {step === "texturing" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Texturing & Assembling...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Texture {partPrompts.filter((p) => p.enabled).length} Parts
                  </>
                )}
              </button>

              {/* Show retry info when resuming from a failed texture step */}
              {textureChainTaskId &&
                resumeFromGroup > 0 &&
                step === "customize" && (
                  <div className="p-2.5 rounded-lg border border-yellow-500/30 bg-yellow-500/5 space-y-1.5">
                    <p className="text-[10px] text-yellow-400 font-medium">
                      {resumeFromGroup} group(s) already textured. Click
                      &quot;Texture&quot; to resume from group{" "}
                      {resumeFromGroup + 1}.
                    </p>
                    <button
                      onClick={() => {
                        setTextureChainTaskId(null);
                        setResumeFromGroup(0);
                        setCachedGroups(null);
                        addLog(
                          "Texture chain reset — will start from scratch.",
                        );
                      }}
                      className="text-[10px] text-yellow-400/70 hover:text-yellow-400 underline"
                    >
                      Or restart texturing from scratch
                    </button>
                  </div>
                )}

              <div className="flex gap-2">
                <button
                  onClick={() => setStep("setup")}
                  disabled={step === "texturing"}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5
 bg-bg-secondary border border-border-primary text-text-secondary hover:text-text-primary hover:border-border-secondary
 disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    ensureViewerSetup();
                    setStep("attachments");
                  }}
                  disabled={step === "texturing"}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5
 bg-purple-500/15 border border-purple-500/30 text-purple-400 hover:bg-purple-500/25
 disabled:opacity-50"
                >
                  <Move size={14} />
                  Attachments
                </button>
              </div>
            </>
          )}

          {/* === STEP: Attachments — generate 3D pieces on bones === */}
          {step === "attachments" && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
                  <Move size={14} />
                  3D Attachments
                </label>
                <p className="text-[10px] text-text-tertiary">
                  Generate 3D armor pieces and attach them to bones. These add
                  real geometry — pauldrons, crests, guards.
                </p>
              </div>

              {/* Add attachment slot picker */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">
                  Add Attachment
                </label>
                <div className="grid grid-cols-2 gap-1">
                  {ATTACHMENT_SLOTS.filter(
                    (slot) => !attachments.some((a) => a.slotId === slot.id),
                  ).map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => handleAddAttachment(slot.id)}
                      className="px-2 py-1.5 rounded-md text-[10px] font-medium transition-all
 bg-bg-secondary text-text-tertiary border border-border-primary
 hover:border-purple-500/30 hover:text-purple-400 flex items-center gap-1"
                    >
                      <Plus size={10} />
                      {slot.label}
                    </button>
                  ))}
                </div>
                {ATTACHMENT_SLOTS.filter(
                  (slot) => !attachments.some((a) => a.slotId === slot.id),
                ).length === 0 && (
                  <p className="text-[10px] text-text-tertiary italic">
                    All slots added
                  </p>
                )}
              </div>

              {/* Active attachments */}
              {attachments.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">
                    Active ({attachments.length})
                  </label>
                  <div className="space-y-1">
                    {attachments.map((att) => {
                      const isExpanded = expandedAttachment === att.id;
                      const isGenerating = att.status === "generating";
                      return (
                        <div
                          key={att.id}
                          className={`rounded-md bg-bg-secondary border transition-all ${
                            isExpanded
                              ? "border-purple-500/30"
                              : att.status === "ready"
                                ? "border-green-500/20"
                                : att.status === "failed"
                                  ? "border-red-500/20"
                                  : "border-border-primary"
                          }`}
                        >
                          {/* Header row */}
                          <div className="flex items-center gap-2 px-2 py-1.5">
                            {isGenerating ? (
                              <Loader2
                                size={12}
                                className="animate-spin text-purple-400 flex-shrink-0"
                              />
                            ) : att.status === "ready" ? (
                              <Check
                                size={12}
                                className="text-green-400 flex-shrink-0"
                              />
                            ) : att.status === "failed" ? (
                              <AlertCircle
                                size={12}
                                className="text-red-400 flex-shrink-0"
                              />
                            ) : (
                              <Box
                                size={12}
                                className="text-text-tertiary flex-shrink-0"
                              />
                            )}
                            <span className="text-xs font-medium text-text-primary flex-1 truncate">
                              {att.label}
                            </span>
                            <button
                              onClick={() =>
                                setExpandedAttachment(
                                  isExpanded ? null : att.id,
                                )
                              }
                              className="text-[10px] text-text-tertiary hover:text-purple-400 px-1"
                            >
                              {isExpanded ? "close" : "edit"}
                            </button>
                            <button
                              onClick={() => handleRemoveAttachment(att.id)}
                              disabled={isGenerating}
                              className="text-text-tertiary hover:text-red-400 disabled:opacity-50"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>

                          {/* Collapsed preview */}
                          {!isExpanded && (
                            <p className="px-2 pb-1.5 text-[10px] text-text-tertiary truncate">
                              {att.status === "ready"
                                ? `On ${att.boneName} — scale ${att.scale.toFixed(3)}`
                                : att.prompt}
                            </p>
                          )}

                          {/* Expanded editor */}
                          {isExpanded && (
                            <div className="px-2 pb-2 space-y-2">
                              {/* Prompt */}
                              <textarea
                                value={att.prompt}
                                onChange={(e) =>
                                  setAttachments((prev) =>
                                    prev.map((a) =>
                                      a.id === att.id
                                        ? { ...a, prompt: e.target.value }
                                        : a,
                                    ),
                                  )
                                }
                                rows={2}
                                disabled={isGenerating}
                                className="w-full bg-bg-primary border border-border-primary rounded px-2 py-1.5 text-xs text-text-primary resize-none disabled:opacity-50"
                              />

                              {/* Generate button */}
                              <button
                                onClick={() => handleGenerateAttachment(att.id)}
                                disabled={isGenerating || !att.prompt.trim()}
                                className="w-full px-2 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5
 bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isGenerating ? (
                                  <>
                                    <Loader2
                                      size={12}
                                      className="animate-spin"
                                    />
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles size={12} />
                                    {att.status === "ready"
                                      ? "Regenerate"
                                      : "Generate 3D"}
                                  </>
                                )}
                              </button>

                              {att.error && (
                                <p className="text-[10px] text-red-400">
                                  {att.error}
                                </p>
                              )}

                              {/* Transform sliders (only when mesh is ready) */}
                              {att.status === "ready" && (
                                <div className="space-y-1.5 pt-1 border-t border-border-primary">
                                  <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">
                                    Position
                                  </label>
                                  {(["x", "y", "z"] as const).map((axis) => (
                                    <div
                                      key={axis}
                                      className="flex items-center gap-2"
                                    >
                                      <span className="text-[10px] text-text-tertiary w-3 uppercase">
                                        {axis}
                                      </span>
                                      <input
                                        type="range"
                                        min={-0.3}
                                        max={0.3}
                                        step={0.005}
                                        value={att.offset[axis]}
                                        onChange={(e) =>
                                          handleUpdateAttachmentTransform(
                                            att.id,
                                            `offset.${axis}`,
                                            parseFloat(e.target.value),
                                          )
                                        }
                                        className="flex-1 h-1 accent-purple-500"
                                      />
                                      <span className="text-[10px] text-text-tertiary w-10 text-right font-mono">
                                        {att.offset[axis].toFixed(3)}
                                      </span>
                                    </div>
                                  ))}

                                  <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">
                                    Rotation
                                  </label>
                                  {(["x", "y", "z"] as const).map((axis) => (
                                    <div
                                      key={`rot-${axis}`}
                                      className="flex items-center gap-2"
                                    >
                                      <span className="text-[10px] text-text-tertiary w-3 uppercase">
                                        {axis}
                                      </span>
                                      <input
                                        type="range"
                                        min={-Math.PI}
                                        max={Math.PI}
                                        step={0.05}
                                        value={att.rotation[axis]}
                                        onChange={(e) =>
                                          handleUpdateAttachmentTransform(
                                            att.id,
                                            `rotation.${axis}`,
                                            parseFloat(e.target.value),
                                          )
                                        }
                                        className="flex-1 h-1 accent-purple-500"
                                      />
                                      <span className="text-[10px] text-text-tertiary w-10 text-right font-mono">
                                        {(
                                          (att.rotation[axis] * 180) /
                                          Math.PI
                                        ).toFixed(0)}
                                        &deg;
                                      </span>
                                    </div>
                                  ))}

                                  <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">
                                    Scale
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="range"
                                      min={0.01}
                                      max={1.0}
                                      step={0.01}
                                      value={att.scale}
                                      onChange={(e) =>
                                        handleUpdateAttachmentTransform(
                                          att.id,
                                          "scale",
                                          parseFloat(e.target.value),
                                        )
                                      }
                                      className="flex-1 h-1 accent-purple-500"
                                    />
                                    <span className="text-[10px] text-text-tertiary w-10 text-right font-mono">
                                      {att.scale.toFixed(3)}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quality picker for new generations */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">
                  Generation Quality
                </label>
                <div className="grid grid-cols-2 gap-1">
                  {(["standard", "detailed"] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuality(q)}
                      className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${
                        quality === q
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                          : "bg-bg-secondary text-text-tertiary border border-border-primary hover:border-border-secondary"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Navigation */}
              <button
                onClick={() => setStep("done")}
                disabled={attachments.some((a) => a.status === "generating")}
                className="w-full px-4 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2
 bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={16} />
                Finish
              </button>

              {segmentTaskId && (
                <button
                  onClick={() => setStep("customize")}
                  className="w-full px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5
 bg-bg-secondary border border-border-primary text-text-secondary hover:text-text-primary hover:border-border-secondary"
                >
                  Back to Texturing
                </button>
              )}
            </>
          )}

          {/* === STEP: Done === */}
          {step === "done" && (
            <>
              <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/5 flex items-center gap-2">
                <Check size={16} className="text-green-400" />
                <span className="text-sm font-medium text-green-400">
                  {attachments.some((a) => a.status === "ready")
                    ? "Armor with attachments ready!"
                    : downloadUrl
                      ? "Per-part texturing complete!"
                      : "Shell ready!"}
                </span>
              </div>

              <div className="flex gap-2">
                {downloadUrl && (
                  <>
                    <button
                      onClick={handlePreview}
                      className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5
 bg-purple-500/15 border border-purple-500/30 text-purple-400 hover:bg-purple-500/25"
                    >
                      <Box size={14} />
                      Preview 3D
                    </button>
                    <button
                      onClick={handleDownload}
                      className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5
 bg-bg-secondary border border-border-primary text-text-secondary hover:text-text-primary hover:border-border-secondary"
                    >
                      <Download size={14} />
                      Download
                    </button>
                  </>
                )}
              </div>

              {/* Navigate to attachments from done */}
              <button
                onClick={() => {
                  ensureViewerSetup();
                  setStep("attachments");
                }}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5
 bg-purple-500/15 border border-purple-500/30 text-purple-400 hover:bg-purple-500/25"
              >
                <Move size={14} />
                {attachments.length > 0
                  ? "Edit Attachments"
                  : "Add 3D Attachments"}
              </button>

              {onAddToKit && currentShell && downloadUrl && (
                <button
                  onClick={() => onAddToKit(currentShell, downloadUrl)}
                  className="w-full px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5
 bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25"
                >
                  <Wand2 size={14} />
                  Add to Armor Kit
                </button>
              )}
            </>
          )}

          {/* Reset (always visible except during running) */}
          {!isRunning && step !== "setup" && (
            <button
              onClick={handleReset}
              className="w-full px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5
 bg-bg-secondary border border-border-primary text-text-secondary hover:text-text-primary hover:border-border-secondary"
            >
              <RotateCcw size={14} />
              Start Over
            </button>
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

          {/* Info */}
          <div className="p-3 bg-bg-secondary rounded-lg border border-border-primary space-y-1.5">
            <h3 className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
              <Info size={12} />
              How It Works
            </h3>
            <ul className="text-xs text-text-tertiary space-y-0.5 list-disc pl-3">
              <li>
                Shell geometry stays <b>identical</b> — perfect fit preserved
              </li>
              <li>Optional: Tripo segments + textures the base shell</li>
              <li>
                <b>Attachments</b>: Tripo generates real 3D pieces (pauldrons,
                crests, guards) from text prompts
              </li>
              <li>Pieces attach to avatar bones — animate with the skeleton</li>
              <li>Adjust position, rotation, scale per piece</li>
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
                Select a shell and click &quot;Upload &amp; Segment Shell&quot;
                to start the Tripo pipeline
              </p>
            ) : (
              logs.map((log, i) => (
                <p
                  key={i}
                  className={`text-xs font-mono ${
                    log.includes("ERROR") || log.includes("FAILED")
                      ? "text-red-400"
                      : log.includes("complete") ||
                          log.includes("Done") ||
                          log.includes("done")
                        ? "text-green-400"
                        : log.includes("•")
                          ? "text-purple-400"
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
