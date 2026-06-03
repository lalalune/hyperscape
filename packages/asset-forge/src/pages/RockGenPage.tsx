/**
 * RockGenPage
 * Page for procedural rock generation with noise displacement and vertex colors
 *
 * Features:
 * - Shape and rock type presets
 * - Custom preset saving (seed + settings)
 * - Batch generation (generate multiple variations)
 * - GLB export
 */

import {
  OctahedralImpostor,
  OctahedronType,
  type ImpostorInstance,
} from "@hyperforge/impostor";
import {
  RockGenerator,
  SHAPE_PRESETS,
  ROCK_TYPE_PRESETS,
} from "@hyperforge/procgen/rock";
import {
  Mountain,
  RefreshCw,
  Download,
  Settings2,
  Save,
  FolderOpen,
  Grid3x3,
  Trash2,
  Database,
  Eye,
  Sun,
  Image,
} from "lucide-react";
import React, { useRef, useEffect, useState, useCallback } from "react";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { MeshStandardNodeMaterial, MeshBasicNodeMaterial } from "three/webgpu";

import type { RockPreset } from "@/types/ProcgenPresets";
import { notify } from "@/utils/notify";
import {
  THREE,
  createWebGPURenderer,
  type AssetForgeRenderer,
} from "@/utils/webgpu-renderer";

// API base
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3401";

export const RockGenPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<AssetForgeRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const generatorRef = useRef<RockGenerator | null>(null);
  const currentRockRef = useRef<THREE.Mesh | null>(null);
  const batchRocksRef = useRef<THREE.Mesh[]>([]);

  // Impostor refs
  const impostorRef = useRef<OctahedralImpostor | null>(null);
  const impostorInstanceRef = useRef<ImpostorInstance | null>(null);
  const impostorMeshRef = useRef<THREE.Mesh | null>(null);
  const atlasDebugPlaneRef = useRef<THREE.Mesh | null>(null);
  const normalAtlasDebugPlaneRef = useRef<THREE.Mesh | null>(null);

  // Generation state
  const [preset, setPreset] = useState("boulder");
  const [seed, setSeed] = useState("rock-001");
  const [subdivisions, setSubdivisions] = useState(4);
  const [flatShading, setFlatShading] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stats, setStats] = useState<{
    vertices: number;
    triangles: number;
    time: number;
  } | null>(null);

  // Batch generation state
  const [batchMode, setBatchMode] = useState(false);
  const [batchCount, setBatchCount] = useState(10);
  const [batchResults, setBatchResults] = useState<THREE.Mesh[]>([]);
  const [selectedBatchIndex, setSelectedBatchIndex] = useState<number | null>(
    null,
  );

  // Saved presets state
  const [savedPresets, setSavedPresets] = useState<RockPreset[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  // Impostor state
  const [showImpostor, setShowImpostor] = useState(false);
  const [impostorSettings, setImpostorSettings] = useState({
    atlasSize: 1024,
    gridSize: 12,
    enableLighting: true,
  });
  const [isGeneratingImpostor, setIsGeneratingImpostor] = useState(false);
  const [impostorStats, setImpostorStats] = useState<{
    hasNormalAtlas: boolean;
    atlasSize: number;
  } | null>(null);

  const shapePresets = Object.keys(SHAPE_PRESETS);
  const rockTypePresets = Object.keys(ROCK_TYPE_PRESETS);

  // Load saved presets on mount
  useEffect(() => {
    loadSavedPresets();
  }, []);

  const loadSavedPresets = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/procgen/presets?category=rock`,
      );
      if (response.ok) {
        const data = await response.json();
        setSavedPresets(data.presets);
      }
    } catch (error) {
      console.error("Failed to load saved presets:", error);
    }
  };

  const saveCurrentAsPreset = async () => {
    if (!newPresetName.trim()) {
      notify.error("Please enter a preset name");
      return;
    }

    try {
      const numericSeed = parseInt(seed.replace(/\D/g, "")) || 0;
      const response = await fetch(`${API_BASE}/api/procgen/presets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPresetName,
          category: "rock",
          settings: {
            shapePreset: preset,
            seed: numericSeed,
            subdivisions,
            flatShading,
          },
        }),
      });

      if (response.ok) {
        notify.success(`Saved preset: ${newPresetName}`);
        setShowSaveDialog(false);
        setNewPresetName("");
        loadSavedPresets();
      } else {
        notify.error("Failed to save preset");
      }
    } catch (error) {
      console.error("Failed to save preset:", error);
      notify.error("Failed to save preset");
    }
  };

  const loadSavedPreset = (savedPreset: RockPreset) => {
    setPreset(savedPreset.settings.shapePreset);
    setSeed(`rock-${savedPreset.settings.seed}`);
    setSubdivisions(savedPreset.settings.subdivisions);
    setFlatShading(savedPreset.settings.flatShading);
    notify.info(`Loaded preset: ${savedPreset.name}`);
  };

  const deleteSavedPreset = async (presetId: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/procgen/presets/${presetId}`,
        {
          method: "DELETE",
        },
      );
      if (response.ok) {
        notify.success("Preset deleted");
        loadSavedPresets();
      }
    } catch (error) {
      console.error("Failed to delete preset:", error);
    }
  };

  // Export to GLB
  const exportToGLB = useCallback(
    async (rock?: THREE.Mesh, filename?: string) => {
      const mesh = rock ?? currentRockRef.current;
      if (!mesh) {
        notify.error("No rock to export");
        return;
      }

      try {
        const exporter = new GLTFExporter();
        const gltf = await exporter.parseAsync(mesh, { binary: true });

        const blob = new Blob([gltf as ArrayBuffer], {
          type: "model/gltf-binary",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename ?? `${preset}_${seed}.glb`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        notify.success("Rock exported successfully");
      } catch (error) {
        console.error("Export error:", error);
        notify.error("Failed to export rock");
      }
    },
    [preset, seed],
  );

  // Export batch to GLB
  const exportBatchToGLB = useCallback(async () => {
    if (batchResults.length === 0) {
      notify.error("No batch results to export");
      return;
    }

    notify.info(`Exporting ${batchResults.length} rocks...`);

    for (let i = 0; i < batchResults.length; i++) {
      const result = batchResults[i];
      const batchSeed = `${seed}-${i}`;
      await exportToGLB(result, `${preset}_${batchSeed}.glb`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    notify.success(`Exported ${batchResults.length} rocks`);
  }, [batchResults, preset, seed, exportToGLB]);

  // Clear batch results
  const clearBatchResults = useCallback(() => {
    if (!sceneRef.current) return;

    for (const rock of batchRocksRef.current) {
      sceneRef.current.remove(rock);
      rock.geometry.dispose();
      if (rock.material instanceof THREE.Material) {
        rock.material.dispose();
      }
    }
    batchRocksRef.current = [];
    setBatchResults([]);
    setSelectedBatchIndex(null);
  }, []);

  // Save to assets
  const saveToAssets = useCallback(
    async (rock?: THREE.Mesh) => {
      const mesh = rock ?? currentRockRef.current;
      if (!mesh) {
        notify.error("No rock to save");
        return;
      }

      try {
        const exporter = new GLTFExporter();
        const gltf = await exporter.parseAsync(mesh, { binary: true });

        const blob = new Blob([gltf as ArrayBuffer], {
          type: "model/gltf-binary",
        });
        const filename = `rock_${preset}_${seed}.glb`;
        const formData = new FormData();
        formData.append("file", blob, filename);
        formData.append("category", "rock");
        formData.append("name", `${preset} Rock (Seed: ${seed})`);
        formData.append(
          "metadata",
          JSON.stringify({
            generator: "procgen",
            preset,
            seed,
            subdivisions,
            flatShading,
            vertices: mesh.geometry.attributes.position.count,
            triangles: (mesh.geometry.index?.count ?? 0) / 3,
          }),
        );

        const response = await fetch(`${API_BASE}/api/assets/upload`, {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          await fetch(`${API_BASE}/api/procgen/assets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              presetId: "",
              presetName: preset,
              category: "rock",
              seed: parseInt(seed.replace(/\D/g, "")) || 0,
              modelPath: filename,
              stats: {
                vertices: mesh.geometry.attributes.position.count,
                triangles: (mesh.geometry.index?.count ?? 0) / 3,
                generationTime: stats?.time ?? 0,
              },
            }),
          });
          notify.success(`Saved to assets: ${filename}`);
        } else {
          notify.error("Failed to save to assets");
        }
      } catch (error) {
        console.error("Save to assets error:", error);
        notify.error("Failed to save to assets");
      }
    },
    [preset, seed, subdivisions, flatShading, stats],
  );

  // Initialize Three.js scene with WebGPU
  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;
    let animationId: number;
    const container = containerRef.current;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // Camera
    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 200);
    camera.position.set(4, 3, 4);
    cameraRef.current = camera;

    // Lighting (can add before renderer)
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(10, 15, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 50;
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    scene.add(sun);

    // Fill light
    const fill = new THREE.DirectionalLight(0x6688cc, 0.4);
    fill.position.set(-5, 5, -5);
    scene.add(fill);

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(20, 20);
    const groundMat = new MeshStandardNodeMaterial();
    groundMat.color = new THREE.Color(0x3a5a40);
    groundMat.roughness = 0.95;
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid helper
    const grid = new THREE.GridHelper(20, 20, 0x555555, 0x333333);
    grid.position.y = 0.01;
    scene.add(grid);

    // Generator
    generatorRef.current = new RockGenerator();

    // Async WebGPU renderer initialization
    const initRenderer = async () => {
      const renderer = await createWebGPURenderer({
        antialias: true,
        alpha: true,
      });

      if (!mounted) {
        renderer.dispose();
        return;
      }

      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Controls (need renderer.domElement)
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.target.set(0, 0.5, 0);
      controlsRef.current = controls;

      // Animation loop
      const animate = () => {
        if (!mounted) return;
        animationId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();
    };

    initRenderer();

    // Resize handler
    const handleResize = () => {
      if (!container || !rendererRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      mounted = false;
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);

      if (currentRockRef.current) {
        currentRockRef.current.geometry.dispose();
        if (currentRockRef.current.material instanceof THREE.Material) {
          currentRockRef.current.material.dispose();
        }
        currentRockRef.current = null;
      }

      ground.geometry.dispose();
      groundMat.dispose();

      generatorRef.current = null;

      // Dispose WebGPU renderer
      if (rendererRef.current) {
        if (
          container &&
          rendererRef.current.domElement.parentNode === container
        ) {
          container.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current.dispose();
        rendererRef.current = null;
      }

      controlsRef.current?.dispose();
    };
  }, []);

  // Generate single rock
  const generateRock = useCallback(() => {
    if (!sceneRef.current || !generatorRef.current) return;

    // Clear batch mode if active
    if (batchMode) {
      clearBatchResults();
    }

    setIsGenerating(true);
    const startTime = performance.now();

    // Remove old rock
    if (currentRockRef.current) {
      sceneRef.current.remove(currentRockRef.current);
      currentRockRef.current.geometry.dispose();
      if (currentRockRef.current.material instanceof THREE.Material) {
        currentRockRef.current.material.dispose();
      }
      currentRockRef.current = null;
    }

    try {
      // Generate rock
      const result = generatorRef.current.generateFromPreset(preset, {
        seed,
        params: {
          subdivisions,
          flatShading,
        },
      });

      if (result && result.mesh) {
        result.mesh.castShadow = true;
        result.mesh.receiveShadow = true;

        // Apply wireframe if enabled
        if (result.mesh.material instanceof THREE.Material) {
          (result.mesh.material as THREE.MeshStandardMaterial).wireframe =
            wireframe;
        }

        sceneRef.current.add(result.mesh);
        currentRockRef.current = result.mesh;

        // Center camera
        if (cameraRef.current && controlsRef.current) {
          controlsRef.current.target.set(0, 0.5, 0);
          cameraRef.current.position.set(4, 3, 4);
          controlsRef.current.update();
        }

        setStats({
          vertices: result.stats.vertices,
          triangles: result.stats.triangles,
          time: Math.round(performance.now() - startTime),
        });
      }
    } catch (error) {
      console.error("Rock generation error:", error);
      notify.error("Rock generation failed");
    }

    setIsGenerating(false);
  }, [
    preset,
    seed,
    subdivisions,
    flatShading,
    wireframe,
    batchMode,
    clearBatchResults,
  ]);

  // Generate batch of rocks
  const generateBatch = useCallback(() => {
    if (!sceneRef.current || !generatorRef.current) return;

    // Clear existing
    clearBatchResults();
    if (currentRockRef.current) {
      sceneRef.current.remove(currentRockRef.current);
      currentRockRef.current.geometry.dispose();
      if (currentRockRef.current.material instanceof THREE.Material) {
        currentRockRef.current.material.dispose();
      }
      currentRockRef.current = null;
    }

    setIsGenerating(true);
    const startTime = performance.now();

    try {
      const results: THREE.Mesh[] = [];
      const gridSize = Math.ceil(Math.sqrt(batchCount));
      const spacing = 3;

      for (let i = 0; i < batchCount; i++) {
        const batchSeed = `${seed}-${i}`;

        const result = generatorRef.current.generateFromPreset(preset, {
          seed: batchSeed,
          params: {
            subdivisions,
            flatShading,
          },
        });

        if (result && result.mesh) {
          // Position in grid
          const row = Math.floor(i / gridSize);
          const col = i % gridSize;
          const x = (col - gridSize / 2) * spacing;
          const z = (row - gridSize / 2) * spacing;
          result.mesh.position.set(x, 0, z);

          result.mesh.castShadow = true;
          result.mesh.receiveShadow = true;

          if (result.mesh.material instanceof THREE.Material) {
            (result.mesh.material as THREE.MeshStandardMaterial).wireframe =
              wireframe;
          }

          sceneRef.current!.add(result.mesh);
          results.push(result.mesh);
          batchRocksRef.current.push(result.mesh);
        }
      }

      setBatchResults(results);

      // Zoom camera out to see all rocks
      if (cameraRef.current && controlsRef.current) {
        const viewDistance = gridSize * spacing * 1.2;
        cameraRef.current.position.set(
          viewDistance,
          viewDistance * 0.6,
          viewDistance,
        );
        controlsRef.current.target.set(0, 0.5, 0);
        controlsRef.current.update();
      }

      // Calculate total stats
      let totalVertices = 0;
      let totalTriangles = 0;
      for (const mesh of results) {
        const geo = mesh.geometry;
        totalVertices += geo.attributes.position.count;
        totalTriangles += (geo.index?.count ?? 0) / 3;
      }

      setStats({
        vertices: totalVertices,
        triangles: totalTriangles,
        time: Math.round(performance.now() - startTime),
      });

      notify.success(`Generated ${results.length} rocks`);
    } catch (error) {
      console.error("Batch generation error:", error);
      notify.error("Batch generation failed");
    }

    setIsGenerating(false);
  }, [
    preset,
    seed,
    subdivisions,
    flatShading,
    wireframe,
    batchCount,
    clearBatchResults,
  ]);

  // Select a rock from batch
  const selectBatchRock = useCallback(
    (index: number) => {
      if (!batchResults[index]) return;

      setSelectedBatchIndex(index);

      const rock = batchResults[index];
      if (cameraRef.current && controlsRef.current) {
        const pos = rock.position;
        controlsRef.current.target.set(pos.x, 0.5, pos.z);
        cameraRef.current.position.set(pos.x + 4, 3, pos.z + 4);
        controlsRef.current.update();
      }
    },
    [batchResults],
  );

  // Clear impostor preview
  const clearImpostorPreview = useCallback(() => {
    if (!sceneRef.current) return;

    if (impostorMeshRef.current) {
      sceneRef.current.remove(impostorMeshRef.current);
      impostorMeshRef.current.geometry.dispose();
      if (impostorMeshRef.current.material instanceof THREE.Material) {
        impostorMeshRef.current.material.dispose();
      }
      impostorMeshRef.current = null;
    }

    if (atlasDebugPlaneRef.current) {
      sceneRef.current.remove(atlasDebugPlaneRef.current);
      atlasDebugPlaneRef.current.geometry.dispose();
      if (atlasDebugPlaneRef.current.material instanceof THREE.Material) {
        atlasDebugPlaneRef.current.material.dispose();
      }
      atlasDebugPlaneRef.current = null;
    }

    if (normalAtlasDebugPlaneRef.current) {
      sceneRef.current.remove(normalAtlasDebugPlaneRef.current);
      normalAtlasDebugPlaneRef.current.geometry.dispose();
      if (normalAtlasDebugPlaneRef.current.material instanceof THREE.Material) {
        normalAtlasDebugPlaneRef.current.material.dispose();
      }
      normalAtlasDebugPlaneRef.current = null;
    }

    impostorInstanceRef.current = null;
    setImpostorStats(null);
  }, []);

  // Generate impostor with normal atlas and lighting
  const generateImpostor = useCallback(async () => {
    if (!sceneRef.current || !rendererRef.current || !currentRockRef.current) {
      notify.error("Generate a rock first");
      return;
    }

    setIsGeneratingImpostor(true);
    clearImpostorPreview();

    try {
      // Create impostor
      const impostor = new OctahedralImpostor(rendererRef.current);
      impostorRef.current = impostor;

      // Bake with normals for lighting
      console.log("[RockGenPage] Baking impostor with normals...");
      const bakeResult = await impostor.bakeWithNormals(
        currentRockRef.current,
        {
          atlasWidth: impostorSettings.atlasSize,
          atlasHeight: impostorSettings.atlasSize,
          gridSizeX: impostorSettings.gridSize,
          gridSizeY: impostorSettings.gridSize,
          octType: OctahedronType.FULL, // Rocks can be viewed from any angle
          backgroundColor: 0x000000,
          backgroundAlpha: 0,
        },
      );

      console.log("[RockGenPage] Bake result:", bakeResult);

      // Create instance with TSL material for WebGPU
      const instance = impostor.createInstance(bakeResult, 1, { useTSL: true });
      impostorInstanceRef.current = instance;

      // Position impostor next to rock
      const rockBounds = new THREE.Box3().setFromObject(currentRockRef.current);
      const rockSize = new THREE.Vector3();
      rockBounds.getSize(rockSize);
      const offsetX = rockSize.x + 2;

      instance.mesh.position.set(offsetX, rockSize.y / 2, 0);
      instance.mesh.name = "RockImpostor";
      sceneRef.current.add(instance.mesh);
      impostorMeshRef.current = instance.mesh;

      // Add debug planes for atlases
      const atlasTexture = bakeResult.atlasTexture;
      const normalAtlasTexture = bakeResult.normalAtlasTexture;

      // Color atlas debug plane
      if (atlasTexture) {
        const planeMat = new MeshBasicNodeMaterial();
        planeMat.map = atlasTexture;
        planeMat.side = THREE.DoubleSide;
        const planeGeo = new THREE.PlaneGeometry(4, 4);
        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.position.set(offsetX - 3, 6, 0);
        plane.name = "ColorAtlasDebug";
        sceneRef.current.add(plane);
        atlasDebugPlaneRef.current = plane;
      }

      // Normal atlas debug plane
      if (normalAtlasTexture) {
        const normalMat = new MeshBasicNodeMaterial();
        normalMat.map = normalAtlasTexture;
        normalMat.side = THREE.DoubleSide;
        const normalGeo = new THREE.PlaneGeometry(4, 4);
        const normalPlane = new THREE.Mesh(normalGeo, normalMat);
        normalPlane.position.set(offsetX + 3, 6, 0);
        normalPlane.name = "NormalAtlasDebug";
        sceneRef.current.add(normalPlane);
        normalAtlasDebugPlaneRef.current = normalPlane;
      }

      setImpostorStats({
        hasNormalAtlas: !!normalAtlasTexture,
        atlasSize: impostorSettings.atlasSize,
      });

      setShowImpostor(true);
      notify.success("Impostor generated with normal atlas");
    } catch (error) {
      console.error("Impostor generation error:", error);
      notify.error("Failed to generate impostor");
    }

    setIsGeneratingImpostor(false);
  }, [currentRockRef, impostorSettings, clearImpostorPreview]);

  // Generate initial rock
  useEffect(() => {
    generateRock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update wireframe on existing rock
  useEffect(() => {
    if (
      currentRockRef.current &&
      currentRockRef.current.material instanceof THREE.Material
    ) {
      (
        currentRockRef.current.material as THREE.MeshStandardMaterial
      ).wireframe = wireframe;
    }
  }, [wireframe]);

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <Mountain size={28} />
            Rock Generator
          </h1>
          <p className="text-text-secondary mt-1">
            Generate procedural rocks with noise displacement and vertex colors
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Batch Mode Toggle */}
          <button
            onClick={() => setBatchMode(!batchMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              batchMode
                ? "bg-accent text-white"
                : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
            }`}
          >
            <Grid3x3 size={18} />
            Batch
          </button>

          {/* Save Preset */}
          <button
            onClick={() => setShowSaveDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary text-text-secondary hover:text-text-primary rounded-lg transition-all"
          >
            <Save size={18} />
            Save
          </button>

          {/* Save to Assets */}
          <button
            onClick={() => saveToAssets()}
            disabled={!currentRockRef.current}
            className="flex items-center gap-2 px-4 py-2 bg-green-600/20 text-green-500 hover:bg-green-600/30 rounded-lg transition-all disabled:opacity-50"
            title="Save to Assets for LOD/Impostor processing"
          >
            <Database size={18} />
            Save
          </button>

          {/* Export */}
          <button
            onClick={() => (batchMode ? exportBatchToGLB() : exportToGLB())}
            disabled={!currentRockRef.current && batchResults.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary text-text-secondary hover:text-text-primary rounded-lg transition-all disabled:opacity-50"
          >
            <Download size={18} />
            Export
          </button>

          {/* Generate */}
          <button
            onClick={batchMode ? generateBatch : generateRock}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-all disabled:opacity-50"
          >
            <RefreshCw
              size={18}
              className={isGenerating ? "animate-spin" : ""}
            />
            {batchMode ? `Generate ${batchCount}` : "Generate"}
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6">
        {/* Controls Panel */}
        <div className="w-72 flex-shrink-0 space-y-4 overflow-y-auto">
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
            <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Settings2 size={18} />
              Generation Settings
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  Preset
                </label>
                <select
                  value={preset}
                  onChange={(e) => setPreset(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-md text-text-primary"
                >
                  <optgroup label="Shapes">
                    {shapePresets.map((name) => (
                      <option key={name} value={name}>
                        {name.charAt(0).toUpperCase() + name.slice(1)}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Rock Types">
                    {rockTypePresets.map((name) => (
                      <option key={name} value={name}>
                        {name.charAt(0).toUpperCase() + name.slice(1)}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  Seed
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    className="flex-1 px-3 py-2 bg-bg-tertiary border border-border-primary rounded-md text-text-primary"
                  />
                  <button
                    onClick={() =>
                      setSeed(`rock-${Math.floor(Math.random() * 10000)}`)
                    }
                    className="px-3 py-2 bg-bg-tertiary border border-border-primary rounded-md text-text-secondary hover:text-text-primary transition-colors"
                    title="Random seed"
                  >
                    🎲
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  Subdivisions: {subdivisions}
                </label>
                <input
                  type="range"
                  min={1}
                  max={6}
                  value={subdivisions}
                  onChange={(e) => setSubdivisions(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-text-tertiary mt-1">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={flatShading}
                    onChange={(e) => setFlatShading(e.target.checked)}
                    className="rounded"
                  />
                  Flat Shading
                </label>

                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wireframe}
                    onChange={(e) => setWireframe(e.target.checked)}
                    className="rounded"
                  />
                  Wireframe
                </label>
              </div>

              {/* Batch Count */}
              {batchMode && (
                <div>
                  <label className="block text-sm text-text-secondary mb-2">
                    Batch Count
                  </label>
                  <input
                    type="range"
                    min={2}
                    max={25}
                    value={batchCount}
                    onChange={(e) => setBatchCount(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-text-secondary mt-1">
                    <span>2</span>
                    <span className="text-text-primary font-medium">
                      {batchCount}
                    </span>
                    <span>25</span>
                  </div>
                </div>
              )}

              <button
                onClick={batchMode ? generateBatch : generateRock}
                disabled={isGenerating}
                className="w-full py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition-all disabled:opacity-50"
              >
                {isGenerating
                  ? "Generating..."
                  : batchMode
                    ? `Generate ${batchCount} Rocks`
                    : "Generate Rock"}
              </button>
            </div>
          </div>

          {/* Saved Presets */}
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
            <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
              <FolderOpen size={18} />
              Saved Presets
            </h3>

            {savedPresets.length === 0 ? (
              <p className="text-sm text-text-secondary italic">
                No saved presets
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {savedPresets.map((savedPreset) => (
                  <div
                    key={savedPreset.id}
                    className="flex items-center justify-between p-2 bg-bg-tertiary rounded-md group"
                  >
                    <button
                      onClick={() => loadSavedPreset(savedPreset)}
                      className="flex-1 text-left text-sm text-text-primary hover:text-primary truncate"
                    >
                      {savedPreset.name}
                    </button>
                    <button
                      onClick={() => deleteSavedPreset(savedPreset.id)}
                      className="p-1 text-text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats Panel */}
          {stats && (
            <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
              <h3 className="font-semibold text-text-primary mb-3">
                {batchMode ? "Batch Stats" : "Generation Stats"}
              </h3>
              <div className="space-y-2 text-sm">
                {batchMode && (
                  <div className="flex justify-between text-text-secondary">
                    <span>Rocks:</span>
                    <span className="text-text-primary">
                      {batchResults.length}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-text-secondary">
                  <span>Total Vertices:</span>
                  <span className="text-text-primary">
                    {stats.vertices.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Total Triangles:</span>
                  <span className="text-text-primary">
                    {stats.triangles.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Gen Time:</span>
                  <span className="text-text-primary">{stats.time}ms</span>
                </div>
              </div>
            </div>
          )}

          {/* Impostor Settings */}
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
            <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Image size={18} />
              Impostor Settings
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">
                  Atlas Size: {impostorSettings.atlasSize}px
                </label>
                <select
                  value={impostorSettings.atlasSize}
                  onChange={(e) =>
                    setImpostorSettings((prev) => ({
                      ...prev,
                      atlasSize: parseInt(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-md text-text-primary text-sm"
                >
                  <option value={512}>512px</option>
                  <option value={1024}>1024px</option>
                  <option value={2048}>2048px</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1">
                  Grid Size: {impostorSettings.gridSize}x
                  {impostorSettings.gridSize}
                </label>
                <input
                  type="range"
                  min={8}
                  max={24}
                  step={2}
                  value={impostorSettings.gridSize}
                  onChange={(e) =>
                    setImpostorSettings((prev) => ({
                      ...prev,
                      gridSize: parseInt(e.target.value),
                    }))
                  }
                  className="w-full"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={impostorSettings.enableLighting}
                  onChange={(e) =>
                    setImpostorSettings((prev) => ({
                      ...prev,
                      enableLighting: e.target.checked,
                    }))
                  }
                  className="rounded"
                />
                <Sun size={14} />
                Enable Lighting (Normal Atlas)
              </label>

              <button
                onClick={generateImpostor}
                disabled={isGeneratingImpostor || !currentRockRef.current}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Eye size={16} />
                {isGeneratingImpostor ? "Generating..." : "Generate Impostor"}
              </button>

              {showImpostor && impostorStats && (
                <div className="p-2 bg-bg-tertiary rounded-md text-xs text-text-secondary">
                  <div className="flex justify-between">
                    <span>Normal Atlas:</span>
                    <span
                      className={
                        impostorStats.hasNormalAtlas
                          ? "text-green-500"
                          : "text-red-500"
                      }
                    >
                      {impostorStats.hasNormalAtlas ? "✓ Yes" : "✗ No"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Atlas Size:</span>
                    <span className="text-text-primary">
                      {impostorStats.atlasSize}px
                    </span>
                  </div>
                </div>
              )}

              {showImpostor && (
                <button
                  onClick={() => {
                    clearImpostorPreview();
                    setShowImpostor(false);
                  }}
                  className="w-full py-1.5 text-xs bg-bg-tertiary hover:bg-bg-primary text-text-secondary rounded transition-colors"
                >
                  Hide Impostor
                </button>
              )}
            </div>
          </div>

          {/* Batch Results Grid */}
          {batchMode && batchResults.length > 0 && (
            <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-text-primary">Results</h3>
                <button
                  onClick={clearBatchResults}
                  className="text-xs text-text-secondary hover:text-red-500"
                >
                  Clear All
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {batchResults.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => selectBatchRock(index)}
                    className={`aspect-square rounded text-xs font-medium ${
                      selectedBatchIndex === index
                        ? "bg-primary text-white"
                        : "bg-bg-tertiary text-text-secondary hover:bg-bg-primary"
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
              {selectedBatchIndex !== null && (
                <div className="mt-3 pt-3 border-t border-border-primary">
                  <p className="text-xs text-text-secondary mb-2">
                    Rock #{selectedBatchIndex + 1} - Seed: {seed}-
                    {selectedBatchIndex}
                  </p>
                  <button
                    onClick={() =>
                      exportToGLB(
                        batchResults[selectedBatchIndex],
                        `${preset}_${seed}-${selectedBatchIndex}.glb`,
                      )
                    }
                    className="w-full py-1.5 text-xs bg-bg-tertiary hover:bg-bg-primary text-text-primary rounded transition-colors flex items-center justify-center gap-1"
                  >
                    <Download size={12} />
                    Export Selected
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Viewer */}
        <div className="flex-1 bg-bg-secondary rounded-xl overflow-hidden border border-border-primary">
          <div ref={containerRef} className="w-full h-full" />
        </div>
      </div>

      {/* Save Preset Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary rounded-lg p-6 w-96 border border-border-primary">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              Save Preset
            </h3>
            <p className="text-sm text-text-secondary mb-4">
              Save current settings ({preset}, seed: {seed}) as a reusable
              preset.
            </p>
            <input
              type="text"
              placeholder="Preset name..."
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-md text-text-primary mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setNewPresetName("");
                }}
                className="px-4 py-2 text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={saveCurrentAsPreset}
                disabled={!newPresetName.trim()}
                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RockGenPage;
