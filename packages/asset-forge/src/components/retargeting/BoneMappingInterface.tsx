import { useState, useEffect } from "react";
import { X, Save, Upload, Download, Link2, Trash2 } from "lucide-react";
import * as THREE from "three";

interface BoneMappingInterfaceProps {
  sourceSkeleton: THREE.Skeleton | null;
  targetSkeleton: THREE.Skeleton | null;
  onMappingChange: (mapping: Record<string, string>) => void;
  initialMapping?: Record<string, string>;
}

interface BoneNode {
  name: string;
  bone: THREE.Bone;
  children: BoneNode[];
  depth: number;
}

export function BoneMappingInterface({
  sourceSkeleton,
  targetSkeleton,
  onMappingChange,
  initialMapping = {},
}: BoneMappingInterfaceProps) {
  const [mapping, setMapping] =
    useState<Record<string, string>>(initialMapping);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [sourceTree, setSourceTree] = useState<BoneNode[]>([]);
  const [targetTree, setTargetTree] = useState<BoneNode[]>([]);
  const [presetName, setPresetName] = useState("");

  // Build bone tree hierarchy
  useEffect(() => {
    if (sourceSkeleton) {
      const tree = buildBoneTree(sourceSkeleton.bones);
      setSourceTree(tree);
    }
  }, [sourceSkeleton]);

  useEffect(() => {
    if (targetSkeleton) {
      const tree = buildBoneTree(targetSkeleton.bones);
      setTargetTree(tree);
    }
  }, [targetSkeleton]);

  function buildBoneTree(bones: THREE.Bone[]): BoneNode[] {
    const boneMap = new Map<THREE.Bone, BoneNode>();
    const roots: BoneNode[] = [];

    // Create nodes for all bones
    bones.forEach((bone) => {
      boneMap.set(bone, {
        name: bone.name,
        bone,
        children: [],
        depth: 0,
      });
    });

    // Build hierarchy
    bones.forEach((bone) => {
      const node = boneMap.get(bone)!;
      if (
        bone.parent &&
        bone.parent instanceof THREE.Bone &&
        boneMap.has(bone.parent)
      ) {
        const parentNode = boneMap.get(bone.parent)!;
        parentNode.children.push(node);
        node.depth = parentNode.depth + 1;
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  function handleLink() {
    if (selectedSource && selectedTarget) {
      const newMapping = { ...mapping, [selectedSource]: selectedTarget };
      setMapping(newMapping);
      onMappingChange(newMapping);
      setSelectedSource(null);
      setSelectedTarget(null);
    }
  }

  function handleUnlink(sourceBone: string) {
    const newMapping = { ...mapping };
    delete newMapping[sourceBone];
    setMapping(newMapping);
    onMappingChange(newMapping);
  }

  function handleAutoMap() {
    if (!sourceSkeleton || !targetSkeleton) return;

    const autoMapping: Record<string, string> = {};
    const targetNames = targetSkeleton.bones.map((b) => b.name.toLowerCase());

    sourceSkeleton.bones.forEach((sourceBone) => {
      const sourceName = sourceBone.name.toLowerCase();

      // Try exact match first
      const exactMatch = targetSkeleton.bones.find(
        (b) => b.name.toLowerCase() === sourceName,
      );
      if (exactMatch) {
        autoMapping[sourceBone.name] = exactMatch.name;
        return;
      }

      // Try fuzzy match (contains)
      const fuzzyMatch = targetSkeleton.bones.find((b) => {
        const targetName = b.name.toLowerCase();
        return (
          targetName.includes(sourceName) || sourceName.includes(targetName)
        );
      });
      if (fuzzyMatch) {
        autoMapping[sourceBone.name] = fuzzyMatch.name;
      }
    });

    setMapping(autoMapping);
    onMappingChange(autoMapping);
  }

  function handleSavePreset() {
    if (!presetName) return;
    const presets = JSON.parse(
      localStorage.getItem("boneMappingPresets") || "{}",
    );
    presets[presetName] = mapping;
    localStorage.setItem("boneMappingPresets", JSON.stringify(presets));
    alert(`Preset "${presetName}" saved!`);
  }

  function handleLoadPreset(name: string) {
    const presets = JSON.parse(
      localStorage.getItem("boneMappingPresets") || "{}",
    );
    if (presets[name]) {
      setMapping(presets[name]);
      onMappingChange(presets[name]);
    }
  }

  function getAvailablePresets(): string[] {
    const presets = JSON.parse(
      localStorage.getItem("boneMappingPresets") || "{}",
    );
    return Object.keys(presets);
  }

  function exportMapping() {
    const dataStr = JSON.stringify(mapping, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
    const exportFileDefaultName = "bone-mapping.json";

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  }

  function importMapping(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedMapping = JSON.parse(e.target?.result as string);
        setMapping(importedMapping);
        onMappingChange(importedMapping);
      } catch (error) {
        alert("Invalid mapping file");
      }
    };
    reader.readAsText(file);
  }

  function renderBoneTree(
    nodes: BoneNode[],
    type: "source" | "target",
  ): React.ReactElement[] {
    const elements: React.ReactElement[] = [];

    function renderNode(node: BoneNode) {
      const isSelected =
        type === "source"
          ? selectedSource === node.name
          : selectedTarget === node.name;
      const isMapped = type === "source" && mapping[node.name];
      const isTargetOfMapping =
        type === "target" && Object.values(mapping).includes(node.name);

      elements.push(
        <div
          key={node.name}
          style={{ paddingLeft: `${node.depth * 20}px` }}
          className={`
            p-2 cursor-pointer border-l-2 transition-colors
            ${isSelected ? "bg-primary text-white" : "hover:bg-bg-hover text-text-primary"}
            ${isMapped ? "border-success" : "border-border-secondary"}
            ${isTargetOfMapping ? "bg-success/10" : ""}
          `}
          onClick={() => {
            if (type === "source") {
              setSelectedSource(node.name);
            } else {
              setSelectedTarget(node.name);
            }
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono">{node.name}</span>
            {type === "source" && mapping[node.name] && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-success">
                  → {mapping[node.name]}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUnlink(node.name);
                  }}
                  className="p-1 hover:bg-error/20 rounded"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        </div>,
      );

      node.children.forEach((child) => renderNode(child));
    }

    nodes.forEach((node) => renderNode(node));
    return elements;
  }

  const mappingCount = Object.keys(mapping).length;
  const sourceBoneCount = sourceSkeleton?.bones.length || 0;
  const targetBoneCount = targetSkeleton?.bones.length || 0;

  return (
    <div className="flex flex-col h-full bg-bg-secondary rounded-lg shadow-lg border border-border-primary">
      {/* Header */}
      <div className="p-4 border-b border-border-primary bg-bg-tertiary">
        <h2 className="text-xl font-bold mb-2 text-text-primary">
          Visual Bone Mapping
        </h2>

        {/* Usage Instructions */}
        <div className="mb-4 p-3 bg-info/10 border border-info/20 rounded">
          <p className="text-sm font-semibold text-text-primary mb-2">
            How to Use:
          </p>
          <ol className="text-xs text-text-secondary space-y-1 list-decimal pl-4">
            <li>
              Click a bone in the <strong>Source Skeleton</strong> (left, your
              Meshy model)
            </li>
            <li>
              Click the corresponding bone in the{" "}
              <strong>Target Skeleton</strong> (right, Mixamo rig)
            </li>
            <li>
              Click <strong>"Link Selected"</strong> to create the mapping
            </li>
            <li>
              Or click <strong>"Auto-Map"</strong> to automatically match bones
              by name
            </li>
            <li>Green borders = already mapped | Blue highlight = selected</li>
            <li>Click X next to a mapping to remove it</li>
            <li>Save your mapping as a preset for future use!</li>
          </ol>
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-sm mb-4 text-text-primary">
          <span>Source: {sourceBoneCount} bones</span>
          <span>Target: {targetBoneCount} bones</span>
          <span className="font-bold text-success">Mapped: {mappingCount}</span>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleLink}
            disabled={!selectedSource || !selectedTarget}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-dark transition-colors"
          >
            <Link2 size={16} />
            Link Selected
          </button>

          <button
            onClick={handleAutoMap}
            className="flex items-center gap-2 px-3 py-2 bg-secondary text-white rounded hover:bg-secondary-dark transition-colors"
          >
            <Link2 size={16} />
            Auto-Map (Fuzzy Match)
          </button>

          <button
            onClick={exportMapping}
            className="flex items-center gap-2 px-3 py-2 bg-bg-hover text-text-primary rounded hover:bg-bg-elevated transition-colors"
          >
            <Download size={16} />
            Export
          </button>

          <label className="flex items-center gap-2 px-3 py-2 bg-bg-hover text-text-primary rounded hover:bg-bg-elevated transition-colors cursor-pointer">
            <Upload size={16} />
            Import
            <input
              type="file"
              accept=".json"
              onChange={importMapping}
              className="hidden"
            />
          </label>
        </div>

        {/* Preset Management */}
        <div className="flex gap-2 mt-4">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name"
            className="flex-1 px-3 py-2 border border-border-primary rounded bg-bg-primary text-text-primary placeholder:text-text-tertiary"
          />
          <button
            onClick={handleSavePreset}
            disabled={!presetName}
            className="flex items-center gap-2 px-3 py-2 bg-success text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-colors"
          >
            <Save size={16} />
            Save Preset
          </button>
        </div>

        {/* Load Presets */}
        {getAvailablePresets().length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {getAvailablePresets().map((preset) => (
              <button
                key={preset}
                onClick={() => handleLoadPreset(preset)}
                className="px-3 py-1 bg-bg-hover text-text-primary rounded hover:bg-bg-elevated transition-colors text-sm"
              >
                Load: {preset}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bone Lists */}
      <div className="flex-1 flex overflow-hidden">
        {/* Source Skeleton */}
        <div className="flex-1 flex flex-col border-r border-border-primary">
          <div className="p-3 bg-bg-tertiary border-b border-border-primary font-semibold text-text-primary">
            Source Skeleton (Meshy)
          </div>
          <div className="flex-1 overflow-y-auto bg-bg-primary">
            {sourceTree.length > 0 ? (
              renderBoneTree(sourceTree, "source")
            ) : (
              <div className="p-4 text-text-secondary text-center space-y-2">
                <p className="font-semibold">No source skeleton loaded</p>
                <p className="text-xs text-text-tertiary">
                  Go back to Step 1 and load your Meshy model first
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Target Skeleton */}
        <div className="flex-1 flex flex-col">
          <div className="p-3 bg-bg-tertiary border-b border-border-primary font-semibold text-text-primary">
            Target Skeleton (Mixamo)
          </div>
          <div className="flex-1 overflow-y-auto bg-bg-primary">
            {targetTree.length > 0 ? (
              renderBoneTree(targetTree, "target")
            ) : (
              <div className="p-4 text-text-secondary text-center space-y-2">
                <p className="font-semibold">No target skeleton loaded</p>
                <p className="text-xs text-text-tertiary">
                  Go back to Step 2 (Load Skeleton) and select a target rig
                  (Human/Quadruped/Bird)
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
