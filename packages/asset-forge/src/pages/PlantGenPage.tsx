/**
 * PlantGenPage
 * Page for procedural plant generation with customizable leaves and stems
 *
 * Features:
 * - 30+ plant species presets
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
  generateFromPreset,
  getPresetNames,
  RenderQualityEnum,
  type PlantPresetName,
  type PlantGenerationResult,
} from "@hyperforge/procgen/plant";
import {
  Flower2,
  RefreshCw,
  Settings2,
  Save,
  FolderOpen,
  Grid3x3,
  Download,
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

import type { PlantPreset as PlantPresetType } from "@/types/ProcgenPresets";
import { notify } from "@/utils/notify";
import {
  THREE,
  createWebGPURenderer,
  type AssetForgeRenderer,
} from "@/utils/webgpu-renderer";

// API base
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3401";

export const PlantGenPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<AssetForgeRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const currentPlantRef = useRef<PlantGenerationResult | null>(null);
  const batchPlantsRef = useRef<PlantGenerationResult[]>([]);

  // Impostor refs
  const impostorRef = useRef<OctahedralImpostor | null>(null);
  const impostorInstanceRef = useRef<ImpostorInstance | null>(null);
  const impostorMeshRef = useRef<THREE.Mesh | null>(null);
  const atlasDebugPlaneRef = useRef<THREE.Mesh | null>(null);
  const normalAtlasDebugPlaneRef = useRef<THREE.Mesh | null>(null);

  // Generation state
  const [preset, setPreset] = useState<PlantPresetName>("monstera");
  const [seed, setSeed] = useState(12345);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stats, setStats] = useState<{
    leaves: number;
    vertices: number;
    triangles: number;
    time: number;
  } | null>(null);

  // Batch generation state
  const [batchMode, setBatchMode] = useState(false);
  const [batchCount, setBatchCount] = useState(10);
  const [batchResults, setBatchResults] = useState<PlantGenerationResult[]>([]);
  const [selectedBatchIndex, setSelectedBatchIndex] = useState<number | null>(
    null,
  );

  // Saved presets state
  const [savedPresets, setSavedPresets] = useState<PlantPresetType[]>([]);
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

  const presetNames = getPresetNames();

  // Load saved presets on mount
  useEffect(() => {
    loadSavedPresets();
  }, []);

  const loadSavedPresets = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/procgen/presets?category=plant`,
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
      const response = await fetch(`${API_BASE}/api/procgen/presets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPresetName,
          category: "plant",
          settings: {
            basePreset: preset,
            seed,
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

  const loadSavedPreset = (savedPreset: PlantPresetType) => {
    setPreset(savedPreset.settings.basePreset as PlantPresetName);
    setSeed(savedPreset.settings.seed);
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
    async (plant?: PlantGenerationResult, filename?: string) => {
      const result = plant ?? currentPlantRef.current;
      if (!result?.group) {
        notify.error("No plant to export");
        return;
      }

      try {
        const exporter = new GLTFExporter();
        const gltf = await exporter.parseAsync(result.group, { binary: true });

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

        notify.success("Plant exported successfully");
      } catch (error) {
        console.error("Export error:", error);
        notify.error("Failed to export plant");
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

    notify.info(`Exporting ${batchResults.length} plants...`);

    for (let i = 0; i < batchResults.length; i++) {
      const result = batchResults[i];
      const batchSeed = seed + i * 1000;
      await exportToGLB(result, `${preset}_${batchSeed}.glb`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    notify.success(`Exported ${batchResults.length} plants`);
  }, [batchResults, preset, seed, exportToGLB]);

  // Clear batch results
  const clearBatchResults = useCallback(() => {
    if (!sceneRef.current) return;

    for (const plant of batchPlantsRef.current) {
      if (plant.group) {
        sceneRef.current.remove(plant.group);
      }
      plant.dispose?.();
    }
    batchPlantsRef.current = [];
    setBatchResults([]);
    setSelectedBatchIndex(null);
  }, []);

  // Save to assets
  const saveToAssets = useCallback(
    async (plant?: PlantGenerationResult) => {
      const result = plant ?? currentPlantRef.current;
      if (!result?.group) {
        notify.error("No plant to save");
        return;
      }

      try {
        const exporter = new GLTFExporter();
        const gltf = await exporter.parseAsync(result.group, { binary: true });

        const blob = new Blob([gltf as ArrayBuffer], {
          type: "model/gltf-binary",
        });
        const filename = `plant_${preset}_${seed}.glb`;
        const formData = new FormData();
        formData.append("file", blob, filename);
        formData.append("category", "plant");
        formData.append(
          "name",
          `${formatPresetName(preset)} Plant (Seed: ${seed})`,
        );

        let vertices = 0;
        let triangles = 0;
        result.group.traverse((obj) => {
          if (obj instanceof THREE.Mesh && obj.geometry) {
            vertices += obj.geometry.attributes.position?.count ?? 0;
            triangles += obj.geometry.index
              ? obj.geometry.index.count / 3
              : (obj.geometry.attributes.position?.count ?? 0) / 3;
          }
        });

        formData.append(
          "metadata",
          JSON.stringify({
            generator: "procgen",
            preset,
            seed,
            vertices: Math.round(vertices),
            triangles: Math.round(triangles),
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
              category: "plant",
              seed,
              modelPath: filename,
              stats: {
                vertices: Math.round(vertices),
                triangles: Math.round(triangles),
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
    [preset, seed, stats],
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
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
    camera.position.set(2, 1.5, 2);
    cameraRef.current = camera;

    // Lighting (can add before renderer)
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(5, 10, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 30;
    sun.shadow.camera.left = -5;
    sun.shadow.camera.right = 5;
    sun.shadow.camera.top = 5;
    sun.shadow.camera.bottom = -5;
    scene.add(sun);

    // Fill lights for better plant visualization
    const fill1 = new THREE.DirectionalLight(0x88ccff, 0.3);
    fill1.position.set(-5, 5, -5);
    scene.add(fill1);

    const fill2 = new THREE.DirectionalLight(0xffcc88, 0.2);
    fill2.position.set(0, -2, 5);
    scene.add(fill2);

    // Ground plane
    const groundGeo = new THREE.CircleGeometry(5, 64);
    const groundMat = new MeshStandardNodeMaterial();
    groundMat.color = new THREE.Color(0x2d4a3e);
    groundMat.roughness = 0.95;
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid helper
    const grid = new THREE.GridHelper(10, 20, 0x555555, 0x333333);
    grid.position.y = 0.01;
    scene.add(grid);

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

      if (currentPlantRef.current) {
        currentPlantRef.current.dispose?.();
        currentPlantRef.current = null;
      }

      ground.geometry.dispose();
      groundMat.dispose();

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

  // Generate single plant
  const generatePlant = useCallback(() => {
    if (!sceneRef.current) return;

    // Clear batch mode if active
    if (batchMode) {
      clearBatchResults();
    }

    setIsGenerating(true);
    const startTime = performance.now();

    // Remove old plant
    if (currentPlantRef.current) {
      if (currentPlantRef.current.group) {
        sceneRef.current.remove(currentPlantRef.current.group);
      }
      currentPlantRef.current.dispose?.();
      currentPlantRef.current = null;
    }

    try {
      // Generate plant (mesh only, no textures - requires canvas)
      const result = generateFromPreset(preset, seed, {
        generateTextures: false,
        quality: RenderQualityEnum.Medium,
      });

      if (result.group) {
        result.group.castShadow = true;
        result.group.receiveShadow = true;
        result.group.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });
        sceneRef.current.add(result.group);
        currentPlantRef.current = result;

        // Center camera
        if (cameraRef.current && controlsRef.current) {
          controlsRef.current.target.set(0, 0.5, 0);
          cameraRef.current.position.set(2, 1.5, 2);
          controlsRef.current.update();
        }

        // Calculate stats
        let vertices = 0;
        let triangles = 0;
        result.group.traverse((obj) => {
          if (obj instanceof THREE.Mesh && obj.geometry) {
            vertices += obj.geometry.attributes.position?.count ?? 0;
            triangles += obj.geometry.index
              ? obj.geometry.index.count / 3
              : (obj.geometry.attributes.position?.count ?? 0) / 3;
          }
        });

        setStats({
          leaves: result.leafBundles?.length ?? 0,
          vertices: Math.round(vertices),
          triangles: Math.round(triangles),
          time: Math.round(performance.now() - startTime),
        });
      }
    } catch (error) {
      console.error("Plant generation error:", error);
      notify.error("Plant generation failed");
    }

    setIsGenerating(false);
  }, [preset, seed, batchMode, clearBatchResults]);

  // Generate batch of plants
  const generateBatch = useCallback(() => {
    if (!sceneRef.current) return;

    // Clear existing
    clearBatchResults();
    if (currentPlantRef.current) {
      if (currentPlantRef.current.group) {
        sceneRef.current.remove(currentPlantRef.current.group);
      }
      currentPlantRef.current.dispose?.();
      currentPlantRef.current = null;
    }

    setIsGenerating(true);
    const startTime = performance.now();

    try {
      const results: PlantGenerationResult[] = [];
      const gridSize = Math.ceil(Math.sqrt(batchCount));
      const spacing = 1.5;

      for (let i = 0; i < batchCount; i++) {
        const batchSeed = seed + i * 1000;

        const result = generateFromPreset(preset, batchSeed, {
          generateTextures: false,
          quality: RenderQualityEnum.Medium,
        });

        if (result.group) {
          // Position in grid
          const row = Math.floor(i / gridSize);
          const col = i % gridSize;
          const x = (col - gridSize / 2) * spacing;
          const z = (row - gridSize / 2) * spacing;
          result.group.position.set(x, 0, z);

          result.group.castShadow = true;
          result.group.receiveShadow = true;
          result.group.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
              obj.castShadow = true;
              obj.receiveShadow = true;
            }
          });

          sceneRef.current!.add(result.group);
          results.push(result);
          batchPlantsRef.current.push(result);
        }
      }

      setBatchResults(results);

      // Zoom camera out to see all plants
      if (cameraRef.current && controlsRef.current) {
        const viewDistance = gridSize * spacing * 1.2;
        cameraRef.current.position.set(
          viewDistance,
          viewDistance * 0.5,
          viewDistance,
        );
        controlsRef.current.target.set(0, 0.5, 0);
        controlsRef.current.update();
      }

      // Calculate total stats
      let totalVertices = 0;
      let totalTriangles = 0;
      let totalLeaves = 0;
      for (const result of results) {
        totalLeaves += result.leafBundles?.length ?? 0;
        result.group?.traverse((obj) => {
          if (obj instanceof THREE.Mesh && obj.geometry) {
            totalVertices += obj.geometry.attributes.position?.count ?? 0;
            totalTriangles += obj.geometry.index
              ? obj.geometry.index.count / 3
              : (obj.geometry.attributes.position?.count ?? 0) / 3;
          }
        });
      }

      setStats({
        leaves: totalLeaves,
        vertices: Math.round(totalVertices),
        triangles: Math.round(totalTriangles),
        time: Math.round(performance.now() - startTime),
      });

      notify.success(`Generated ${results.length} plants`);
    } catch (error) {
      console.error("Batch generation error:", error);
      notify.error("Batch generation failed");
    }

    setIsGenerating(false);
  }, [preset, seed, batchCount, clearBatchResults]);

  // Select a plant from batch
  const selectBatchPlant = useCallback(
    (index: number) => {
      if (!batchResults[index]) return;

      setSelectedBatchIndex(index);

      const plant = batchResults[index];
      if (plant.group && cameraRef.current && controlsRef.current) {
        const pos = plant.group.position;
        controlsRef.current.target.set(pos.x, 0.5, pos.z);
        cameraRef.current.position.set(pos.x + 2, 1.5, pos.z + 2);
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
    if (
      !sceneRef.current ||
      !rendererRef.current ||
      !currentPlantRef.current?.group
    ) {
      notify.error("Generate a plant first");
      return;
    }

    setIsGeneratingImpostor(true);
    clearImpostorPreview();

    try {
      // Create impostor
      const impostor = new OctahedralImpostor(rendererRef.current);
      impostorRef.current = impostor;

      // Bake with normals for lighting
      console.log("[PlantGenPage] Baking impostor with normals...");
      const bakeResult = await impostor.bakeWithNormals(
        currentPlantRef.current.group,
        {
          atlasWidth: impostorSettings.atlasSize,
          atlasHeight: impostorSettings.atlasSize,
          gridSizeX: impostorSettings.gridSize,
          gridSizeY: impostorSettings.gridSize,
          octType: OctahedronType.HEMI, // Plants are typically viewed from ground level
          backgroundColor: 0x000000,
          backgroundAlpha: 0,
        },
      );

      console.log("[PlantGenPage] Bake result:", bakeResult);

      // Create instance with TSL material for WebGPU
      const instance = impostor.createInstance(bakeResult, 1, { useTSL: true });
      impostorInstanceRef.current = instance;

      // Position impostor next to plant
      const plantBounds = new THREE.Box3().setFromObject(
        currentPlantRef.current.group,
      );
      const plantSize = new THREE.Vector3();
      plantBounds.getSize(plantSize);
      const offsetX = plantSize.x + 1.5;

      instance.mesh.position.set(offsetX, plantSize.y / 2, 0);
      instance.mesh.name = "PlantImpostor";
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
        const planeGeo = new THREE.PlaneGeometry(2, 2);
        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.position.set(offsetX - 1.5, 3, 0);
        plane.name = "ColorAtlasDebug";
        sceneRef.current.add(plane);
        atlasDebugPlaneRef.current = plane;
      }

      // Normal atlas debug plane
      if (normalAtlasTexture) {
        const normalMat = new MeshBasicNodeMaterial();
        normalMat.map = normalAtlasTexture;
        normalMat.side = THREE.DoubleSide;
        const normalGeo = new THREE.PlaneGeometry(2, 2);
        const normalPlane = new THREE.Mesh(normalGeo, normalMat);
        normalPlane.position.set(offsetX + 1.5, 3, 0);
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
  }, [currentPlantRef, impostorSettings, clearImpostorPreview]);

  // Generate initial plant
  useEffect(() => {
    generatePlant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Friendly preset name display
  const formatPresetName = (name: string): string => {
    return name
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
  };

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <Flower2 size={28} />
            Plant Generator
          </h1>
          <p className="text-text-secondary mt-1">
            Generate procedural plants with customizable leaves, stems, and vein
            patterns
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
            disabled={!currentPlantRef.current}
            className="flex items-center gap-2 px-4 py-2 bg-green-600/20 text-green-500 hover:bg-green-600/30 rounded-lg transition-all disabled:opacity-50"
            title="Save to Assets for LOD/Impostor processing"
          >
            <Database size={18} />
            Save
          </button>

          {/* Export */}
          <button
            onClick={() => (batchMode ? exportBatchToGLB() : exportToGLB())}
            disabled={!currentPlantRef.current && batchResults.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary text-text-secondary hover:text-text-primary rounded-lg transition-all disabled:opacity-50"
          >
            <Download size={18} />
            Export
          </button>

          {/* Generate */}
          <button
            onClick={batchMode ? generateBatch : generatePlant}
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
                  Plant Species
                </label>
                <select
                  value={preset}
                  onChange={(e) => setPreset(e.target.value as PlantPresetName)}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-md text-text-primary"
                >
                  {presetNames.map((name) => (
                    <option key={name} value={name}>
                      {formatPresetName(name)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  Seed
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
                    className="flex-1 px-3 py-2 bg-bg-tertiary border border-border-primary rounded-md text-text-primary"
                  />
                  <button
                    onClick={() => setSeed(Math.floor(Math.random() * 1000000))}
                    className="px-3 py-2 bg-bg-tertiary border border-border-primary rounded-md text-text-secondary hover:text-text-primary transition-colors"
                    title="Random seed"
                  >
                    🎲
                  </button>
                </div>
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
                onClick={batchMode ? generateBatch : generatePlant}
                disabled={isGenerating}
                className="w-full py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition-all disabled:opacity-50"
              >
                {isGenerating
                  ? "Generating..."
                  : batchMode
                    ? `Generate ${batchCount} Plants`
                    : "Generate Plant"}
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
                    <span>Plants:</span>
                    <span className="text-text-primary">
                      {batchResults.length}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-text-secondary">
                  <span>Total Leaves:</span>
                  <span className="text-text-primary">{stats.leaves}</span>
                </div>
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
                disabled={isGeneratingImpostor || !currentPlantRef.current}
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
                    onClick={() => selectBatchPlant(index)}
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
                    Plant #{selectedBatchIndex + 1} - Seed:{" "}
                    {seed + selectedBatchIndex * 1000}
                  </p>
                  <button
                    onClick={() =>
                      exportToGLB(
                        batchResults[selectedBatchIndex],
                        `${preset}_${seed + selectedBatchIndex * 1000}.glb`,
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

          {/* Species Info */}
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
            <h3 className="font-semibold text-text-primary mb-2">
              Plant Species
            </h3>
            <p className="text-sm text-text-secondary mb-3">
              30+ species available including tropical, ornamental, and
              houseplants.
            </p>
            <div className="text-xs text-text-tertiary space-y-1">
              <div>
                <strong>Tropical:</strong> Monstera, Philodendron, Alocasia
              </div>
              <div>
                <strong>Houseplants:</strong> Pothos, Ficus, Calathea
              </div>
              <div>
                <strong>Herbs:</strong> Basil, Mint, Parsley
              </div>
              <div>
                <strong>Succulents:</strong> Echeveria, Jade, Aloe
              </div>
            </div>
          </div>
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
              Save current settings ({formatPresetName(preset)}, seed: {seed})
              as a reusable preset.
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

export default PlantGenPage;
