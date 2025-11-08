/**
 * Type-Safe API Client Examples
 *
 * This file demonstrates how to use the Eden Treaty client in React components.
 * All examples show fully type-safe API calls with autocomplete and compile-time checking.
 */

import { api } from "./api-client";
import { useEffect, useState } from "react";

/**
 * Example 1: Simple Health Check
 */
export function HealthCheckExample() {
  const [status, setStatus] = useState<string>("checking...");

  useEffect(() => {
    const checkHealth = async () => {
      const { data, error } = await api.api.health.get();

      if (error) {
        setStatus(`Error: ${error}`);
        return;
      }

      if (data) {
        // TypeScript knows the exact shape of data
        setStatus(
          `${data.status} - Meshy: ${data.services.meshy}, OpenAI: ${data.services.openai}`,
        );
      }
    };

    checkHealth();
  }, []);

  return <div>Health: {status}</div>;
}

/**
 * Example 2: List Assets with Type Safety
 */
export function AssetListExample() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAssets = async () => {
      const { data, error } = await api.api.assets.get();

      if (error) {
        console.error("Failed to load assets:", error);
        setLoading(false);
        return;
      }

      if (data) {
        // Extract assets array from paginated response
        const assetsArray = Array.isArray(data) ? data : data.data;
        setAssets(assetsArray);
      }

      setLoading(false);
    };

    loadAssets();
  }, []);

  if (loading) return <div>Loading assets...</div>;

  return (
    <ul>
      {assets.map((asset) => (
        <li key={asset.id}>{asset.name}</li>
      ))}
    </ul>
  );
}

/**
 * Example 3: Delete Asset with Confirmation
 */
export function DeleteAssetExample({ assetId }: { assetId: string }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (includeVariants: boolean) => {
    if (!confirm("Are you sure you want to delete this asset?")) {
      return;
    }

    setDeleting(true);

    const { data, error } = await api.api.assets({ id: assetId }).delete({
      query: { includeVariants: includeVariants ? "true" : "false" },
    });

    if (error) {
      alert(`Failed to delete: ${error}`);
    } else if (data) {
      alert(data.message);
    }

    setDeleting(false);
  };

  return (
    <div>
      <button onClick={() => handleDelete(false)} disabled={deleting}>
        Delete Asset
      </button>
      <button onClick={() => handleDelete(true)} disabled={deleting}>
        Delete Asset + Variants
      </button>
    </div>
  );
}

/**
 * Example 4: Update Asset Metadata
 */
export function UpdateAssetExample({ assetId }: { assetId: string }) {
  const [name, setName] = useState("");
  const [tier, setTier] = useState(1);
  const [updating, setUpdating] = useState(false);

  const handleUpdate = async () => {
    setUpdating(true);

    const { data, error } = await api.api.assets({ id: assetId }).patch({
      name,
      tier,
    });

    if (error) {
      alert(`Failed to update: ${error}`);
    } else if (data) {
      alert("Asset updated successfully!");
    }

    setUpdating(false);
  };

  return (
    <div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Asset name"
      />
      <input
        type="number"
        value={tier}
        onChange={(e) => setTier(Number(e.target.value))}
        min={1}
        max={5}
      />
      <button onClick={handleUpdate} disabled={updating}>
        Update Asset
      </button>
    </div>
  );
}

/**
 * Example 5: Start Generation Pipeline
 */
export function GenerationPipelineExample() {
  const [generating, setGenerating] = useState(false);
  const [pipelineId, setPipelineId] = useState<string | null>(null);

  const startGeneration = async () => {
    setGenerating(true);

    const { data, error } = await api.api.generation.pipeline.post({
      assetId: `asset-${Date.now()}`, // Generate unique asset ID
      name: "Iron Sword",
      type: "weapon",
      subtype: "sword",
      tier: 1,
      description: "A sturdy iron sword for beginner adventurers",
    });

    if (error) {
      alert(`Failed to start generation: ${error}`);
    } else if (data) {
      setPipelineId(data.pipelineId);
      alert(`Pipeline started: ${data.pipelineId}`);
    }

    setGenerating(false);
  };

  return (
    <div>
      <button onClick={startGeneration} disabled={generating}>
        Generate Sword
      </button>
      {pipelineId && <div>Pipeline ID: {pipelineId}</div>}
    </div>
  );
}

/**
 * Example 6: Check Pipeline Status
 */
export function PipelineStatusExample({ pipelineId }: { pipelineId: string }) {
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    const checkStatus = async () => {
      const { data, error } = await api.api.generation
        .pipeline({ pipelineId })
        .get();

      if (error) {
        console.error("Failed to check status:", error);
        return;
      }

      if (data) {
        setStatus(data);
      }
    };

    // Check status every 2 seconds
    const interval = setInterval(checkStatus, 2000);
    checkStatus(); // Initial check

    return () => clearInterval(interval);
  }, [pipelineId]);

  if (!status) return <div>Loading...</div>;

  return (
    <div>
      <div>Status: {status.status}</div>
      <div>Progress: {status.progress}%</div>
      {status.error && <div>Error: {status.error}</div>}
    </div>
  );
}

/**
 * Example 7: Retexture Asset
 */
export function RetextureExample({ baseAssetId }: { baseAssetId: string }) {
  const [material, setMaterial] = useState("steel");
  const [outputName, setOutputName] = useState("");
  const [retexturing, setRetexturing] = useState(false);

  const materialPresets: Record<
    string,
    { id: string; displayName: string; stylePrompt: string }
  > = {
    bronze: {
      id: "bronze",
      displayName: "Bronze",
      stylePrompt: "bronze material with weathered patina",
    },
    steel: {
      id: "steel",
      displayName: "Steel",
      stylePrompt: "polished steel with reflective surface",
    },
    mithril: {
      id: "mithril",
      displayName: "Mithril",
      stylePrompt: "silvery mithril with magical shimmer",
    },
    adamantine: {
      id: "adamantine",
      displayName: "Adamantine",
      stylePrompt: "dark adamantine with purple sheen",
    },
  };

  const handleRetexture = async () => {
    setRetexturing(true);

    const { data, error } = await api.api.retexture.post({
      baseAssetId,
      materialPreset: materialPresets[material],
      outputName: outputName || undefined,
    });

    if (error) {
      alert(`Failed to retexture: ${error}`);
    } else if (data) {
      alert(`Retexture completed: ${data.assetId}`);
    }

    setRetexturing(false);
  };

  return (
    <div>
      <select value={material} onChange={(e) => setMaterial(e.target.value)}>
        <option value="bronze">Bronze</option>
        <option value="steel">Steel</option>
        <option value="mithril">Mithril</option>
        <option value="adamantine">Adamantine</option>
      </select>
      <input
        type="text"
        value={outputName}
        onChange={(e) => setOutputName(e.target.value)}
        placeholder="Output name (optional)"
      />
      <button onClick={handleRetexture} disabled={retexturing}>
        Retexture
      </button>
    </div>
  );
}

/**
 * Example 8: Weapon Handle Detection
 */
export function WeaponHandleDetectionExample() {
  const [imageData, setImageData] = useState<string>("");
  const [detecting, setDetecting] = useState(false);
  const [gripData, setGripData] = useState<any>(null);

  const detectHandle = async () => {
    if (!imageData) return;

    setDetecting(true);

    const { data, error } = await api.api["weapon-handle-detect"].post({
      image: imageData,
      angle: "side",
      promptHint: "medieval sword with wrapped grip",
    });

    if (error) {
      alert(`Detection failed: ${error}`);
    } else if (data && data.success) {
      setGripData(data.gripData);
    }

    setDetecting(false);
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              setImageData(ev.target?.result as string);
            };
            reader.readAsDataURL(file);
          }
        }}
      />
      <button onClick={detectHandle} disabled={detecting || !imageData}>
        Detect Grip Location
      </button>
      {gripData && (
        <div>
          <div>Weapon Type: {gripData.weaponType}</div>
          <div>Confidence: {gripData.confidence}</div>
          <div>Grip Bounds: {JSON.stringify(gripData.gripBounds)}</div>
        </div>
      )}
    </div>
  );
}

/**
 * Example 9: Save Sprites
 */
export function SaveSpritesExample({ assetId }: { assetId: string }) {
  const [sprites, setSprites] = useState<
    Array<{ angle: number; imageData: string }>
  >([]);
  const [saving, setSaving] = useState(false);

  const handleSaveSprites = async () => {
    if (sprites.length === 0) return;

    setSaving(true);

    const { data, error } = await api.api.assets({ id: assetId }).sprites.post({
      sprites,
      config: {
        resolution: 512,
        angles: sprites.length,
      },
    });

    if (error) {
      alert(`Failed to save sprites: ${error}`);
    } else if (data) {
      alert(data.message);
    }

    setSaving(false);
  };

  return (
    <div>
      <div>Sprites ready: {sprites.length}</div>
      <button
        onClick={handleSaveSprites}
        disabled={saving || sprites.length === 0}
      >
        Save Sprites to Server
      </button>
    </div>
  );
}
