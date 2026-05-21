/**
 * BatchSpritesPage - Batch generate icon sprites from game 3D models
 *
 * Scans the game's models directory, renders each .glb model from an
 * isometric camera angle using Three.js WebGL, and saves the resulting
 * transparent PNGs to the game's icons/ directory.
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// All requests go through Vite proxy in dev (/api/* and /game-models/*)

interface GameModel {
  name: string;
  file: string;
  url: string;
}

interface SpriteResult {
  name: string;
  success: boolean;
  error?: string;
}

export const BatchSpritesPage: React.FC = () => {
  const [models, setModels] = useState<GameModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [currentModel, setCurrentModel] = useState("");
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<SpriteResult[]>([]);
  const [resolution, setResolution] = useState(256);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const abortRef = useRef(false);

  // Fetch the list of game models
  const fetchModels = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/batch/game-models`);
      const data = await resp.json();
      setModels(data.models || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to fetch models:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Generate sprites for all models
  const generateAll = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || models.length === 0) return;

    abortRef.current = false;
    setProcessing(true);
    setResults([]);
    setProgress(0);

    // Set up Three.js renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
    });
    renderer.setSize(resolution, resolution);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Scene
    const scene = new THREE.Scene();
    scene.background = null;

    // Lighting — match SpriteGenerationService
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);
    // Fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-3, 2, -5);
    scene.add(fillLight);

    // Orthographic camera — isometric angle
    const frustumSize = 5;
    const camera = new THREE.OrthographicCamera(
      -frustumSize / 2,
      frustumSize / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000,
    );
    // ~35° isometric view
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);

    const loader = new GLTFLoader();

    for (let i = 0; i < models.length; i++) {
      if (abortRef.current) break;

      const model = models[i];
      setCurrentModel(model.name);
      setProgress(i + 1);

      try {
        // Load model
        const gltf = await new Promise<{ scene: THREE.Object3D }>(
          (resolve, reject) => {
            loader.load(
              model.url,
              (g) => resolve(g as { scene: THREE.Object3D }),
              undefined,
              (err) => reject(err),
            );
          },
        );

        const obj = gltf.scene;

        // Center and scale to fit viewport
        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        obj.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const scale = (frustumSize * 0.75) / maxDim;
          obj.scale.multiplyScalar(scale);
        }

        scene.add(obj);

        // Ensure transparent background (some GLTF models may set scene.background)
        scene.background = null;

        // Clear and render
        renderer.clear();
        renderer.render(scene, camera);

        const imageData = canvas.toDataURL("image/png");
        setPreviewUrl(imageData);

        // Save to server
        const filename = `${model.name}.png`;
        await fetch(`/api/batch/save-icon`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename, imageData }),
        });

        // Cleanup
        scene.remove(obj);
        obj.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            if (Array.isArray(mesh.material))
              mesh.material.forEach((m) => m.dispose());
            else mesh.material.dispose();
          }
        });

        setResults((prev) => [...prev, { name: model.name, success: true }]);
      } catch (err) {
        console.error(`Failed to process ${model.name}:`, err);
        setResults((prev) => [
          ...prev,
          { name: model.name, success: false, error: String(err) },
        ]);
      }
    }

    renderer.dispose();
    setProcessing(false);
  }, [models, resolution]);

  const stop = useCallback(() => {
    abortRef.current = true;
  }, []);

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="font-display text-2xl font-medium text-text-primary mb-2 tracking-tight">
          Batch Sprite Generation
        </h2>
        <p className="text-text-secondary">
          Generate icon sprites from all game 3D models. Renders each .glb file
          and saves a transparent PNG to the game&apos;s icons/ directory.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-text-secondary text-sm">Resolution:</label>
            <select
              value={resolution}
              onChange={(e) => setResolution(Number(e.target.value))}
              disabled={processing}
              className="bg-bg-tertiary border border-border-primary rounded px-2 py-1 text-text-primary text-sm"
            >
              <option value={128}>128 x 128</option>
              <option value={256}>256 x 256</option>
              <option value={512}>512 x 512</option>
            </select>
          </div>

          <div className="text-text-secondary text-sm">
            {loading
              ? "Loading model list..."
              : `${models.length} models found`}
          </div>

          <div className="flex-1" />

          {!processing ? (
            <button
              onClick={generateAll}
              disabled={loading || models.length === 0}
              className="px-6 py-2 bg-primary text-white rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate All Icons
            </button>
          ) : (
            <button
              onClick={stop}
              className="px-6 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700"
            >
              Stop
            </button>
          )}
        </div>

        {/* Progress bar */}
        {processing && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-text-secondary">
                Processing:{" "}
                <strong className="text-text-primary">{currentModel}</strong>
              </span>
              <span className="text-text-secondary">
                {progress} / {total}
              </span>
            </div>
            <div className="w-full bg-bg-tertiary rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${(progress / total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Preview + Results */}
      <div className="grid grid-cols-[256px_1fr] gap-6">
        {/* Preview canvas */}
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-2">
            Preview
          </h3>
          <div
            className="border border-border-primary rounded-lg overflow-hidden bg-[#1a1a2e]"
            style={{ width: resolution, height: resolution }}
          >
            <canvas
              ref={canvasRef}
              width={resolution}
              height={resolution}
              style={{ width: resolution, height: resolution }}
            />
          </div>
          {previewUrl && !processing && (
            <div className="mt-2 text-xs text-text-secondary">
              Last rendered sprite preview
            </div>
          )}
        </div>

        {/* Results list */}
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-2">
            Results
            {results.length > 0 && (
              <span className="ml-2 font-normal">
                — {successCount} saved
                {failCount > 0 && (
                  <span className="text-red-400">, {failCount} failed</span>
                )}
              </span>
            )}
          </h3>
          <div className="border border-border-primary rounded-lg bg-bg-secondary max-h-[600px] overflow-y-auto">
            {results.length === 0 && !processing && (
              <div className="p-4 text-text-secondary text-sm text-center">
                Click &quot;Generate All Icons&quot; to start
              </div>
            )}
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm border-b border-border-primary last:border-b-0 ${
                  r.success ? "text-text-primary" : "text-red-400"
                }`}
              >
                <span className={r.success ? "text-green-400" : "text-red-400"}>
                  {r.success ? "✓" : "✗"}
                </span>
                <span className="font-mono text-xs">{r.name}.png</span>
                {r.error && (
                  <span className="text-xs text-red-400 truncate ml-2">
                    {r.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Model list (collapsed) */}
      {!processing && models.length > 0 && results.length === 0 && (
        <details className="mt-6">
          <summary className="text-sm text-text-secondary cursor-pointer hover:text-text-primary">
            Show all {models.length} models to process
          </summary>
          <div className="mt-2 grid grid-cols-3 gap-1 text-xs font-mono text-text-secondary">
            {models.map((m) => (
              <div key={m.url} className="truncate">
                {m.name}/{m.file}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};
