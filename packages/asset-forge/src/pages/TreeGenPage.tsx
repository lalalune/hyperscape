/**
 * TreeGenPage
 * Page for procedural tree generation using Weber & Penn algorithm
 *
 * Features:
 * - 19 species presets with full parameter customization
 * - Branch, trunk, and leaf settings
 * - Side-by-side LOD preview (LOD0, LOD1, LOD2, Impostor)
 * - LOD settings (distances, vertex percentages)
 * - Custom preset saving (seed + settings)
 * - Batch generation (generate multiple variations)
 * - GLB export
 */

import {
  generateTree,
  getPresetNames,
  getPreset,
  disposeTreeMesh,
  createTreeParams,
  TreeImpostor,
  TreeShape,
  LeafShape,
  createInstancedLeafMaterialTSL,
  TREE_LOD_PRESETS,
  BranchClusterGenerator,
  TreeGenerator,
  type TreeMeshResult,
  type TreeParams,
  type TreeShapeType,
  type LeafShapeType,
  type GeometryOptions,
  type BranchClusterResult,
} from "@hyperforge/procgen";
import {
  TreePine,
  RefreshCw,
  Download,
  Settings2,
  Save,
  FolderOpen,
  Grid3x3,
  Trash2,
  Database,
  Eye,
  Layers,
  ChevronDown,
  ChevronRight,
  Image,
  Sliders,
  Sun,
} from "lucide-react";
import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { MeshStandardNodeMaterial, MeshBasicNodeMaterial } from "three/webgpu";

import {
  DEFAULT_CATEGORY_LOD_SETTINGS,
  type CategoryLODDefaults,
} from "@/types/LODBundle";
import type { TreePreset } from "@/types/ProcgenPresets";
import { notify } from "@/utils/notify";
import {
  THREE,
  createWebGPURenderer,
  type AssetForgeRenderer,
} from "@/utils/webgpu-renderer";

// API base
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3401";

// Tree shape options for dropdown
const TREE_SHAPE_OPTIONS: { value: TreeShapeType; label: string }[] = [
  { value: TreeShape.Conical, label: "Conical" },
  { value: TreeShape.Spherical, label: "Spherical" },
  { value: TreeShape.Hemispherical, label: "Hemispherical" },
  { value: TreeShape.Cylindrical, label: "Cylindrical" },
  { value: TreeShape.TaperedCylindrical, label: "Tapered Cylindrical" },
  { value: TreeShape.Flame, label: "Flame" },
  { value: TreeShape.InverseConical, label: "Inverse Conical" },
  { value: TreeShape.TendFlame, label: "Tend Flame" },
  { value: TreeShape.Envelope, label: "Envelope/Custom" },
];

// Leaf shape options for dropdown
const LEAF_SHAPE_OPTIONS: { value: LeafShapeType; label: string }[] = [
  { value: LeafShape.Default, label: "Default (Elliptic)" },
  { value: LeafShape.Ovate, label: "Ovate" },
  { value: LeafShape.Linear, label: "Linear" },
  { value: LeafShape.Cordate, label: "Cordate (Heart)" },
  { value: LeafShape.Maple, label: "Maple" },
  { value: LeafShape.Palmate, label: "Palmate" },
  { value: LeafShape.SpikyOak, label: "Spiky Oak" },
  { value: LeafShape.RoundedOak, label: "Rounded Oak" },
  { value: LeafShape.Elliptic, label: "Elliptic" },
  { value: LeafShape.Rectangle, label: "Rectangle" },
  { value: LeafShape.Triangle, label: "Triangle" },
];

// Type for LOD data
type LODData = {
  mesh: TreeMeshResult | null;
  vertices: number;
  triangles: number;
  // Target values for decimated LODs (what we want to achieve)
  targetVertices?: number;
  targetTriangles?: number;
};

// Type for impostor data
type ImpostorData = {
  impostor: TreeImpostor | null;
  atlasTexture: THREE.Texture | null;
  normalAtlasTexture: THREE.Texture | null;
  mesh: THREE.Mesh | null;
};

export const TreeGenPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<AssetForgeRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const currentTreeRef = useRef<TreeMeshResult | null>(null);
  const batchTreesRef = useRef<TreeMeshResult[]>([]);

  // LOD refs for multi-view
  const lodMeshRefs = useRef<{
    lod0: THREE.Group | null;
    lod1: THREE.Group | null;
    lod2: THREE.Group | null;
    impostor: THREE.Mesh | null;
  }>({ lod0: null, lod1: null, lod2: null, impostor: null });
  const impostorRef = useRef<TreeImpostor | null>(null);
  const impostorInstanceRef = useRef<ReturnType<
    TreeImpostor["createInstance"]
  > | null>(null);

  // Generation state
  const [preset, setPreset] = useState("quakingAspen");
  const [seed, setSeed] = useState(12345);
  const [showLeaves, setShowLeaves] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stats, setStats] = useState<{
    stems: number;
    leaves: number;
    vertices: number;
    triangles: number;
    time: number;
  } | null>(null);

  // Tree parameter overrides (applied to preset)
  const [advancedParams, setAdvancedParams] = useState<Partial<TreeParams>>({});

  // Geometry options (for optimization) - defaults are min visually acceptable for LOD0
  const [geometryOptions, setGeometryOptions] = useState<GeometryOptions>({
    radialSegments: 5,
    branchCaps: false,
    maxLeaves: 25000,
    maxStems: 1000,
    maxBranchDepth: undefined,
  });

  // Panel collapse state
  const [expandedPanels, setExpandedPanels] = useState<{
    shape: boolean;
    trunk: boolean;
    branches: boolean;
    leaves: boolean;
    geometry: boolean;
    lod: boolean;
    impostor: boolean;
    lighting: boolean;
  }>({
    shape: true,
    trunk: false,
    branches: false,
    leaves: false,
    geometry: false,
    lod: false,
    impostor: false,
    lighting: true,
  });

  // Lighting controls for impostor
  const [lightingSettings, setLightingSettings] = useState({
    azimuth: 30, // Horizontal angle in degrees (0 = +X, 90 = +Z)
    elevation: 55, // Vertical angle in degrees (0 = horizon, 90 = directly above)
    intensity: 1.2,
    ambientIntensity: 0.5,
    showHelper: true,
  });
  const lightHelperRef = useRef<THREE.ArrowHelper | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);

  // Batch generation state
  const [batchMode, setBatchMode] = useState(false);
  const [batchCount, setBatchCount] = useState(10);
  const [batchResults, setBatchResults] = useState<TreeMeshResult[]>([]);
  const [selectedBatchIndex, setSelectedBatchIndex] = useState<number | null>(
    null,
  );

  // Saved presets state
  const [savedPresets, setSavedPresets] = useState<TreePreset[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  // LOD preview state
  const [showLODPreview, setShowLODPreview] = useState(false);
  const [lodData, setLodData] = useState<{
    lod0: LODData;
    lod1: LODData;
    lod2: LODData;
  }>({
    lod0: { mesh: null, vertices: 0, triangles: 0 },
    lod1: { mesh: null, vertices: 0, triangles: 0 },
    lod2: { mesh: null, vertices: 0, triangles: 0 },
  });

  // LOD settings (editable)
  const [lodSettings, setLodSettings] = useState<CategoryLODDefaults>(
    DEFAULT_CATEGORY_LOD_SETTINGS.tree,
  );

  // Impostor state
  const [impostorData, setImpostorData] = useState<ImpostorData>({
    impostor: null,
    atlasTexture: null,
    normalAtlasTexture: null,
    mesh: null,
  });

  // Branch cluster state (used for cluster visualization)
  const clusterGroupRef = useRef<THREE.Group | null>(null);
  const [clusterResult, setClusterResult] =
    useState<BranchClusterResult | null>(null);
  const [showClusters, setShowClusters] = useState(false);
  const clusterSettings = useMemo(
    () => ({
      minStemDepth: 1,
      minLeavesPerCluster: 3,
      maxLeavesPerCluster: 40,
      targetClusterCount: 80,
      cullOverlapping: true,
      overlapThreshold: 0.3,
    }),
    [],
  );

  // Auto-generate LODs when tree is generated
  const [autoGenerateLODs, setAutoGenerateLODs] = useState(true);
  const [impostorSettings, setImpostorSettings] = useState({
    atlasSize: 2048,
    gridSize: 16,
    enableLighting: true,
  });

  const presetNames = getPresetNames();

  // Calculate light direction from azimuth and elevation
  const calculateLightDirection = useCallback(
    (azimuthDeg: number, elevationDeg: number): THREE.Vector3 => {
      const azimuthRad = (azimuthDeg * Math.PI) / 180;
      const elevationRad = (elevationDeg * Math.PI) / 180;

      // Convert spherical to cartesian
      // Elevation: 0 = horizon (y=0), 90 = directly above (y=1)
      // Azimuth: 0 = +X, 90 = +Z, 180 = -X, 270 = -Z
      const cosElevation = Math.cos(elevationRad);
      const x = Math.cos(azimuthRad) * cosElevation;
      const y = Math.sin(elevationRad);
      const z = Math.sin(azimuthRad) * cosElevation;

      return new THREE.Vector3(x, y, z).normalize();
    },
    [],
  );

  // Update light direction helper and scene light
  const updateLightDirection = useCallback(() => {
    const direction = calculateLightDirection(
      lightingSettings.azimuth,
      lightingSettings.elevation,
    );

    // Update ArrowHelper
    if (lightHelperRef.current) {
      lightHelperRef.current.setDirection(direction);
      lightHelperRef.current.visible = lightingSettings.showHelper;
    }

    // Update scene's sun light to match
    if (sunLightRef.current) {
      sunLightRef.current.position
        .copy(direction)
        .multiplyScalar(30)
        .add(new THREE.Vector3(0, 5, 0));
      sunLightRef.current.intensity = lightingSettings.intensity;
    }

    // Update impostor instance lighting
    if (impostorInstanceRef.current?.updateLighting) {
      impostorInstanceRef.current.updateLighting({
        lightDirection: direction.clone(),
        lightColor: new THREE.Vector3(1.0, 0.98, 0.95),
        lightIntensity: lightingSettings.intensity,
        ambientColor: new THREE.Vector3(0.5, 0.55, 0.6),
        ambientIntensity: lightingSettings.ambientIntensity,
      });
    }
  }, [
    calculateLightDirection,
    lightingSettings.azimuth,
    lightingSettings.elevation,
    lightingSettings.intensity,
    lightingSettings.ambientIntensity,
    lightingSettings.showHelper,
  ]);

  // Toggle panel expand/collapse
  const togglePanel = (panel: keyof typeof expandedPanels) => {
    setExpandedPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  };

  // Update a single advanced param
  const updateAdvancedParam = <K extends keyof TreeParams>(
    key: K,
    value: TreeParams[K],
  ) => {
    setAdvancedParams((prev) => ({ ...prev, [key]: value }));
  };

  // Load saved presets on mount
  useEffect(() => {
    loadSavedPresets();
  }, []);

  const loadSavedPresets = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/procgen/presets?category=tree`,
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
          category: "tree",
          settings: {
            basePreset: preset,
            seed,
            showLeaves,
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

  const loadSavedPreset = (savedPreset: TreePreset) => {
    setPreset(savedPreset.settings.basePreset);
    setSeed(savedPreset.settings.seed);
    setShowLeaves(savedPreset.settings.showLeaves);
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
    async (treeResult?: TreeMeshResult, filename?: string) => {
      const tree = treeResult ?? currentTreeRef.current;
      if (!tree?.group) {
        notify.error("No tree to export");
        return;
      }

      try {
        const exporter = new GLTFExporter();
        const gltf = await exporter.parseAsync(tree.group, { binary: true });

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

        notify.success("Tree exported successfully");
      } catch (error) {
        console.error("Export error:", error);
        notify.error("Failed to export tree");
      }
    },
    [preset, seed],
  );

  // Save to assets - saves the GLB to the asset database for LOD/Impostor processing
  const saveToAssets = useCallback(
    async (treeResult?: TreeMeshResult) => {
      const tree = treeResult ?? currentTreeRef.current;
      if (!tree?.group) {
        notify.error("No tree to save");
        return;
      }

      try {
        const exporter = new GLTFExporter();
        const gltf = await exporter.parseAsync(tree.group, { binary: true });

        // Create FormData with GLB file
        const blob = new Blob([gltf as ArrayBuffer], {
          type: "model/gltf-binary",
        });
        const filename = `tree_${preset}_${seed}.glb`;
        const formData = new FormData();
        formData.append("file", blob, filename);
        formData.append("category", "tree");
        formData.append("name", `${preset} Tree (Seed: ${seed})`);
        formData.append(
          "metadata",
          JSON.stringify({
            generator: "procgen",
            preset,
            seed,
            showLeaves,
            vertices: tree.vertexCount,
            triangles: tree.triangleCount,
          }),
        );

        // Upload to assets
        const response = await fetch(`${API_BASE}/api/assets/upload`, {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();

          // Record in procgen manifest
          await fetch(`${API_BASE}/api/procgen/assets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              presetId: "",
              presetName: preset,
              category: "tree",
              seed,
              modelPath: data.path ?? filename,
              stats: {
                vertices: tree.vertexCount,
                triangles: tree.triangleCount,
                generationTime: stats?.time ?? 0,
              },
            }),
          });

          notify.success(`Saved to assets: ${filename}`);
        } else {
          const error = await response.json();
          notify.error(error.message ?? "Failed to save to assets");
        }
      } catch (error) {
        console.error("Save to assets error:", error);
        notify.error("Failed to save to assets");
      }
    },
    [preset, seed, showLeaves, stats],
  );

  // Export batch to GLB
  const exportBatchToGLB = useCallback(async () => {
    if (batchResults.length === 0) {
      notify.error("No batch results to export");
      return;
    }

    notify.info(`Exporting ${batchResults.length} trees...`);

    for (let i = 0; i < batchResults.length; i++) {
      const result = batchResults[i];
      const batchSeed = seed + i * 1000;
      await exportToGLB(result, `${preset}_${batchSeed}.glb`);
      // Small delay between downloads
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    notify.success(`Exported ${batchResults.length} trees`);
  }, [batchResults, preset, seed, exportToGLB]);

  // Clear batch results
  const clearBatchResults = useCallback(() => {
    if (!sceneRef.current) return;

    for (const tree of batchTreesRef.current) {
      if (tree.group) {
        sceneRef.current.remove(tree.group);
      }
      disposeTreeMesh(tree);
    }
    batchTreesRef.current = [];
    setBatchResults([]);
    setSelectedBatchIndex(null);
  }, []);

  // Initialize Three.js scene with WebGPU
  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;
    let animationId: number;
    let renderer: AssetForgeRenderer;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // Camera
    const aspect =
      containerRef.current.clientWidth / containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 500);
    camera.position.set(15, 10, 15);
    cameraRef.current = camera;

    const containerEl = containerRef.current;

    // Async WebGPU initialization
    const initRenderer = async () => {
      renderer = await createWebGPURenderer({
        antialias: true,
        alpha: true,
      });

      if (!mounted) {
        renderer.dispose();
        return;
      }

      renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;

      containerEl.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Controls (after renderer is ready)
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.target.set(0, 5, 0);
      controlsRef.current = controls;

      // Animation loop
      const animate = () => {
        if (!mounted) return;
        animationId = requestAnimationFrame(animate);
        controls.update();
        // Update impostor to face camera (critical for correct atlas sampling)
        if (impostorInstanceRef.current) {
          impostorInstanceRef.current.update(camera);
        }
        renderer.render(scene, camera);
      };
      animate();
    };

    initRenderer();

    // Lighting (can be added before renderer is ready)
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(20, 30, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 100;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    scene.add(sun);
    sunLightRef.current = sun;

    // Fill light
    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-10, 10, -10);
    scene.add(fill);

    // Light direction helper (ArrowHelper for visualizing light direction)
    const initialDirection = new THREE.Vector3(0.5, 0.8, 0.3).normalize();
    const lightHelper = new THREE.ArrowHelper(
      initialDirection,
      new THREE.Vector3(0, 15, 0), // Position above the scene
      8, // Length
      0xffff00, // Yellow color
      1.5, // Head length
      0.8, // Head width
    );
    lightHelper.name = "lightDirectionHelper";
    scene.add(lightHelper);
    lightHelperRef.current = lightHelper;

    // Ground plane
    const groundGeo = new THREE.CircleGeometry(50, 64);
    const groundMat = new MeshStandardNodeMaterial();
    groundMat.color = new THREE.Color(0x3a5a40);
    groundMat.roughness = 0.9;
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid helper
    const grid = new THREE.GridHelper(100, 100, 0x555555, 0x333333);
    grid.position.y = 0.01;
    scene.add(grid);

    // Cluster visualization group
    const clusterGroup = new THREE.Group();
    clusterGroup.name = "ClusterGroup";
    clusterGroup.visible = false; // Hidden by default
    scene.add(clusterGroup);
    clusterGroupRef.current = clusterGroup;

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // Capture ref values at effect creation time for cleanup
    const lodMeshes = lodMeshRefs.current;
    const container = containerRef.current;

    return () => {
      mounted = false;
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);

      if (currentTreeRef.current) {
        disposeTreeMesh(currentTreeRef.current);
        currentTreeRef.current = null;
      }

      // Clean up batch trees
      for (const tree of batchTreesRef.current) {
        disposeTreeMesh(tree);
      }
      batchTreesRef.current = [];

      // Clean up LOD meshes
      if (lodMeshes.lod0) {
        scene.remove(lodMeshes.lod0);
        lodMeshes.lod0 = null;
      }
      if (lodMeshes.lod1) {
        scene.remove(lodMeshes.lod1);
        lodMeshes.lod1 = null;
      }
      if (lodMeshes.lod2) {
        scene.remove(lodMeshes.lod2);
        lodMeshes.lod2 = null;
      }
      if (lodMeshes.impostor) {
        scene.remove(lodMeshes.impostor);
        lodMeshes.impostor = null;
      }
      if (impostorInstanceRef.current) {
        impostorInstanceRef.current.dispose();
        impostorInstanceRef.current = null;
      }
      if (impostorRef.current) {
        impostorRef.current.dispose();
        impostorRef.current = null;
      }

      ground.geometry.dispose();
      groundMat.dispose();

      // Dispose light helper
      if (lightHelperRef.current) {
        scene.remove(lightHelperRef.current);
        lightHelperRef.current = null;
      }
      sunLightRef.current = null;

      if (rendererRef.current) {
        containerEl.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
        rendererRef.current = null;
      }

      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Clear LOD previews
  const clearLODPreviews = useCallback(() => {
    if (!sceneRef.current) return;

    // Remove all LOD meshes
    if (lodMeshRefs.current.lod0) {
      sceneRef.current.remove(lodMeshRefs.current.lod0);
      lodMeshRefs.current.lod0 = null;
    }
    if (lodMeshRefs.current.lod1) {
      sceneRef.current.remove(lodMeshRefs.current.lod1);
      lodMeshRefs.current.lod1 = null;
    }
    if (lodMeshRefs.current.lod2) {
      sceneRef.current.remove(lodMeshRefs.current.lod2);
      lodMeshRefs.current.lod2 = null;
    }
    if (lodMeshRefs.current.impostor) {
      sceneRef.current.remove(lodMeshRefs.current.impostor);
      lodMeshRefs.current.impostor = null;
    }
    // Remove atlas debug plane if present
    const debugPlane = sceneRef.current.getObjectByName("atlasDebugPlane");
    if (debugPlane) {
      sceneRef.current.remove(debugPlane);
    }

    // Dispose impostor instance and tree impostor
    if (impostorInstanceRef.current) {
      impostorInstanceRef.current.dispose();
      impostorInstanceRef.current = null;
    }
    if (impostorRef.current) {
      impostorRef.current.dispose();
      impostorRef.current = null;
    }

    setLodData({
      lod0: { mesh: null, vertices: 0, triangles: 0 },
      lod1: { mesh: null, vertices: 0, triangles: 0 },
      lod2: { mesh: null, vertices: 0, triangles: 0 },
    });
    setImpostorData({
      impostor: null,
      atlasTexture: null,
      normalAtlasTexture: null,
      mesh: null,
    });
  }, []);

  // Generate LOD variants by REGENERATING with different geometry options
  // This is the correct approach - not decimation - for procedural trees
  const generateLODPreviews = useCallback(async () => {
    if (
      !sceneRef.current ||
      !rendererRef.current ||
      !currentTreeRef.current?.group
    ) {
      notify.error("Generate a tree first");
      return;
    }

    setIsGenerating(true);
    clearLODPreviews();

    try {
      const spacing = 20; // Space between LOD views

      // Get current tree params for regeneration
      const basePresetParams = getPreset(preset);
      // Merge preset with any parameter overrides
      const treeParams = createTreeParams({
        ...basePresetParams,
        ...advancedParams,
      });

      // Create shared leaf material for all LODs
      const lodLeafMaterial = createInstancedLeafMaterialTSL({
        color: new THREE.Color(0x3d7a3d),
        colorVariation: 0.15,
        alphaTest: 0.5,
        leafShape: "elliptic",
        subsurfaceScatter: 0.35,
      });

      // Helper to generate a tree at specific LOD level
      const generateAtLOD = (
        lodPreset: GeometryOptions,
        position: number,
      ): TreeMeshResult => {
        // Apply leaf scale multiplier to tree params for this LOD
        // This makes fewer leaves bigger to maintain visual coverage
        const multiplier = lodPreset.leafScaleMultiplier ?? 1.0;
        const lodParams: TreeParams = {
          ...treeParams,
          leafScale: treeParams.leafScale * multiplier,
        };

        const result = generateTree(lodParams, {
          generation: { seed }, // Same seed = same tree structure
          geometry: lodPreset,
          mesh: {
            useInstancedLeaves: true,
            leafMaterial: lodLeafMaterial,
          },
        });
        result.group.position.set(position, 0, 0);
        result.group.traverse((obj: THREE.Object3D) => {
          if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });
        return result;
      };

      // LOD0 - Full quality (use preset or current tree's settings)
      const lod0Result = generateAtLOD(TREE_LOD_PRESETS.lod0, -spacing * 1.5);
      sceneRef.current.add(lod0Result.group);
      lodMeshRefs.current.lod0 = lod0Result.group;

      // LOD1 - Medium quality (~30% vertices)
      const lod1Result = generateAtLOD(TREE_LOD_PRESETS.lod1, -spacing * 0.5);
      sceneRef.current.add(lod1Result.group);
      lodMeshRefs.current.lod1 = lod1Result.group;

      // LOD2 - Low quality (~10% vertices)
      const lod2Result = generateAtLOD(TREE_LOD_PRESETS.lod2, spacing * 0.5);
      sceneRef.current.add(lod2Result.group);
      lodMeshRefs.current.lod2 = lod2Result.group;

      // Generate Impostor from LOD0 (full quality source)
      console.log("[TreeGenPage] Creating TreeImpostor...");
      const treeImpostor = new TreeImpostor({
        atlasSize: impostorSettings.atlasSize,
        gridSizeX: impostorSettings.gridSize,
        gridSizeY: impostorSettings.gridSize,
        enableLighting: impostorSettings.enableLighting,
      });

      console.log("[TreeGenPage] Baking impostor...");
      // Cast renderer for impostor baking (WebGPU renderer is compatible)
      // IMPORTANT: bake() is async for WebGPU - must await before createInstance()
      await treeImpostor.bake(
        lod0Result,
        rendererRef.current as AssetForgeRenderer,
      );
      impostorRef.current = treeImpostor;
      console.log(
        "[TreeGenPage] Bake complete, bakeResult:",
        treeImpostor.getBakeResult(),
      );

      // Use TSL material for WebGPU renderer
      console.log("[TreeGenPage] Creating impostor instance...");
      const impostorInstance = treeImpostor.createInstance(1, { useTSL: true });
      console.log("[TreeGenPage] Instance created:", impostorInstance.mesh);

      // Get tree dimensions for proper positioning
      const treeDimensions = treeImpostor.getTreeDimensions();
      const treeSize = Math.max(treeDimensions.width, treeDimensions.height);
      console.log(
        "[TreeGenPage] Tree dimensions:",
        treeDimensions,
        "treeSize:",
        treeSize,
      );

      // Position impostor at ground level (y=0 for bottom of billboard)
      // The billboard is treeSize × treeSize, so center should be at y = treeSize/2
      impostorInstance.mesh.position.set(
        spacing * 1.5,
        treeSize / 2, // Center of billboard - bottom at y=0
        0,
      );
      // Impostor should NOT cast shadows - the quad would cast a square shadow
      // instead of the tree shape. It can receive shadows though.
      impostorInstance.mesh.castShadow = false;
      impostorInstance.mesh.receiveShadow = true;
      sceneRef.current.add(impostorInstance.mesh);
      lodMeshRefs.current.impostor = impostorInstance.mesh;
      impostorInstanceRef.current = impostorInstance; // Store for update loop
      console.log(
        "[TreeGenPage] Impostor added at position:",
        impostorInstance.mesh.position,
      );

      // Configure impostor lighting using current light settings
      if (impostorInstance.updateLighting) {
        const lightDir = calculateLightDirection(
          lightingSettings.azimuth,
          lightingSettings.elevation,
        );
        impostorInstance.updateLighting({
          lightDirection: lightDir,
          lightColor: new THREE.Vector3(1.0, 0.98, 0.95),
          lightIntensity: lightingSettings.intensity,
          ambientColor: new THREE.Vector3(0.5, 0.55, 0.6),
          ambientIntensity: lightingSettings.ambientIntensity,
        });
        console.log(
          "[TreeGenPage] Configured impostor lighting with azimuth:",
          lightingSettings.azimuth,
          "elevation:",
          lightingSettings.elevation,
        );
      }

      // Add debug atlas planes to visualize both color and normal atlases
      const atlasTexture = treeImpostor.getAtlasTexture();
      const bakeResultLocal = treeImpostor.getBakeResult();
      const normalAtlasTexture = bakeResultLocal?.normalAtlasTexture;

      // Color atlas debug plane (left)
      if (atlasTexture) {
        const debugPlaneMat = new MeshBasicNodeMaterial();
        debugPlaneMat.map = atlasTexture;
        debugPlaneMat.side = THREE.DoubleSide;
        debugPlaneMat.transparent = true;
        const debugPlaneGeo = new THREE.PlaneGeometry(12, 12);
        const debugPlane = new THREE.Mesh(debugPlaneGeo, debugPlaneMat);
        debugPlane.position.set(spacing * 1.5 - 8, 20, 0); // Left of center
        debugPlane.name = "atlasDebugPlane";
        sceneRef.current.add(debugPlane);
        console.log("[TreeGenPage] Added color atlas debug plane");
      }

      // Normal atlas debug plane (right)
      if (normalAtlasTexture) {
        const normalPlaneMat = new MeshBasicNodeMaterial();
        normalPlaneMat.map = normalAtlasTexture;
        normalPlaneMat.side = THREE.DoubleSide;
        const normalPlaneGeo = new THREE.PlaneGeometry(12, 12);
        const normalPlane = new THREE.Mesh(normalPlaneGeo, normalPlaneMat);
        normalPlane.position.set(spacing * 1.5 + 8, 20, 0); // Right of center
        normalPlane.name = "normalAtlasDebugPlane";
        sceneRef.current.add(normalPlane);
        console.log("[TreeGenPage] Added normal atlas debug plane");
      } else {
        console.warn("[TreeGenPage] No normal atlas texture - check bake mode");
      }

      // Update LOD data state with ACTUAL vertex counts from regenerated LODs
      setLodData({
        lod0: {
          mesh: lod0Result,
          vertices: lod0Result.vertexCount,
          triangles: lod0Result.triangleCount,
        },
        lod1: {
          mesh: lod1Result,
          vertices: lod1Result.vertexCount,
          triangles: lod1Result.triangleCount,
          // Target is now what we actually achieved (no longer "target" since we regenerate)
          targetVertices: Math.round(lod0Result.vertexCount * 0.3),
          targetTriangles: Math.round(lod0Result.triangleCount * 0.3),
        },
        lod2: {
          mesh: lod2Result,
          vertices: lod2Result.vertexCount,
          triangles: lod2Result.triangleCount,
          targetVertices: Math.round(lod0Result.vertexCount * 0.1),
          targetTriangles: Math.round(lod0Result.triangleCount * 0.1),
        },
      });

      setImpostorData({
        impostor: treeImpostor,
        atlasTexture: treeImpostor.getAtlasTexture(),
        normalAtlasTexture: bakeResultLocal?.normalAtlasTexture ?? null,
        mesh: impostorInstance.mesh,
      });

      // Zoom camera out to see all LODs
      if (cameraRef.current && controlsRef.current) {
        cameraRef.current.position.set(60, 30, 60);
        controlsRef.current.target.set(0, 5, 0);
        controlsRef.current.update();
      }

      setShowLODPreview(true);
      notify.success("LOD previews generated");
    } catch (error) {
      console.error("LOD generation error:", error);
      notify.error("Failed to generate LOD previews");
    }

    setIsGenerating(false);
  }, [
    clearLODPreviews,
    preset,
    seed,
    advancedParams,
    impostorSettings,
    lightingSettings,
    calculateLightDirection,
  ]);

  // Create cluster visualization meshes
  const createClusterVisualization = useCallback(
    (result: BranchClusterResult, group: THREE.Group) => {
      const { clusters, leaves } = result;

      // Colors for different stem depths
      const depthColors = [
        0xff6b6b, // Depth 0 - red
        0x4ecdc4, // Depth 1 - teal
        0xffd93d, // Depth 2 - yellow
        0x6bcb77, // Depth 3 - green
        0x4d96ff, // Depth 4+ - blue
      ];

      for (let i = 0; i < clusters.length; i++) {
        const cluster = clusters[i];
        const color =
          depthColors[Math.min(cluster.stemDepth, depthColors.length - 1)];

        // Create billboard quad representing the cluster
        const billboardGeo = new THREE.PlaneGeometry(
          cluster.width,
          cluster.height,
        );

        // Create a texture showing the leaf arrangement
        const canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext("2d")!;

        // Background with alpha
        ctx.fillStyle = "rgba(0, 0, 0, 0)";
        ctx.fillRect(0, 0, 128, 128);

        // Draw leaf positions as circles
        const leafColor = `rgba(${(color >> 16) & 255}, ${(color >> 8) & 255}, ${color & 255}, 0.8)`;
        ctx.fillStyle = leafColor;

        for (const idx of cluster.leafIndices) {
          const leaf = leaves[idx];
          // Project leaf position to billboard space
          const relPos = leaf.position.clone().sub(cluster.center);

          // Simple projection onto billboard plane
          const x = (relPos.x / cluster.width + 0.5) * 128;
          const y = (1 - (relPos.y / cluster.height + 0.5)) * 128;

          // Draw leaf as ellipse
          ctx.beginPath();
          ctx.ellipse(x, y, 8, 12, Math.random() * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }

        // Add border to show cluster bounds
        ctx.strokeStyle = leafColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, 124, 124);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const billboardMat = new MeshBasicNodeMaterial({
          map: texture,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          depthWrite: false,
        });

        const billboard = new THREE.Mesh(billboardGeo, billboardMat);
        billboard.position.copy(cluster.center);

        // Orient the billboard to face outward from tree center and be vertical (Y-up)
        // Use the cluster's billboardNormal and billboardUp
        const matrix = new THREE.Matrix4();
        const right = new THREE.Vector3()
          .crossVectors(cluster.billboardUp, cluster.billboardNormal)
          .normalize();
        matrix.makeBasis(right, cluster.billboardUp, cluster.billboardNormal);
        billboard.setRotationFromMatrix(matrix);

        billboard.userData = {
          clusterId: cluster.id,
          clusterIndex: i,
          stemDepth: cluster.stemDepth,
        };

        group.add(billboard);
      }
    },
    [],
  );

  // Generate single tree (and optionally LODs + clusters)
  const generateTreeMesh = useCallback(async () => {
    if (!sceneRef.current) return;

    // Clear batch mode if active
    if (batchMode) {
      clearBatchResults();
    }

    // Clear LOD previews if active
    if (showLODPreview) {
      clearLODPreviews();
      setShowLODPreview(false);
    }

    // Clear cluster visualization
    if (clusterGroupRef.current) {
      while (clusterGroupRef.current.children.length > 0) {
        const child = clusterGroupRef.current.children[0];
        clusterGroupRef.current.remove(child);
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      }
    }
    setClusterResult(null);

    setIsGenerating(true);
    const startTime = performance.now();

    // Remove old tree
    if (currentTreeRef.current) {
      if (currentTreeRef.current.group) {
        sceneRef.current.remove(currentTreeRef.current.group);
      }
      disposeTreeMesh(currentTreeRef.current);
      currentTreeRef.current = null;
    }

    try {
      // Get preset parameters
      const basePresetParams = getPreset(preset);
      if (!basePresetParams) {
        console.error(`Preset not found: ${preset}`);
        notify.error(`Preset not found: ${preset}`);
        setIsGenerating(false);
        return;
      }

      // Merge with advanced params if enabled
      const treeParams = createTreeParams({
        ...basePresetParams,
        ...advancedParams,
      });

      // Use TreeGenerator to get access to tree data for cluster generation
      const webGPULeafMaterial = createInstancedLeafMaterialTSL({
        color: new THREE.Color(0x3d7a3d),
        colorVariation: 0.15,
        alphaTest: 0.5,
        leafShape: "elliptic",
        subsurfaceScatter: 0.35,
      });

      const generator = new TreeGenerator(treeParams, {
        generation: { seed, generateLeaves: true },
        geometry: geometryOptions,
        mesh: {
          useInstancedLeaves: true,
          leafMaterial: webGPULeafMaterial,
        },
      });

      const result = generator.generate();
      const treeData = generator.getLastTreeData();

      if (result.group) {
        // Remove leaves if not showing
        if (!showLeaves && result.leaves) {
          result.group.remove(result.leaves);
        }

        result.group.castShadow = true;
        result.group.receiveShadow = true;
        result.group.traverse((obj: THREE.Object3D) => {
          if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });
        sceneRef.current.add(result.group);
        currentTreeRef.current = result;

        // Generate branch clusters if tree data is available
        if (
          treeData &&
          treeData.leaves.length > 0 &&
          treeData.stems.length > 0
        ) {
          const clusterGenerator = new BranchClusterGenerator({
            minStemDepth: clusterSettings.minStemDepth,
            minLeavesPerCluster: clusterSettings.minLeavesPerCluster,
            maxLeavesPerCluster: clusterSettings.maxLeavesPerCluster,
            targetClusterCount: clusterSettings.targetClusterCount,
            cullOverlappingLeaves: clusterSettings.cullOverlapping,
            overlapThreshold: clusterSettings.overlapThreshold,
          });
          const clusters = clusterGenerator.generateClusters(
            treeData.leaves,
            treeData.stems,
            treeData.params,
          );
          setClusterResult(clusters);

          // Create cluster visualization
          if (clusterGroupRef.current) {
            createClusterVisualization(clusters, clusterGroupRef.current);
          }
        }

        // Center camera on tree
        if (cameraRef.current && controlsRef.current) {
          controlsRef.current.target.set(0, 5, 0);
          cameraRef.current.position.set(15, 10, 15);
          controlsRef.current.update();
        }

        // Use stats from result
        const branchCount = result.branches?.length ?? 0;
        const hasLeaves = result.leaves !== null;

        setStats({
          stems: branchCount,
          leaves: hasLeaves ? 1 : 0,
          vertices: result.vertexCount,
          triangles: result.triangleCount,
          time: Math.round(performance.now() - startTime),
        });

        // Auto-generate LODs if enabled (after tree is visible)
        if (autoGenerateLODs && rendererRef.current) {
          // Small delay to let the tree render first
          setTimeout(() => {
            generateLODPreviews();
          }, 100);
        }
      }
    } catch (error) {
      console.error("Tree generation error:", error);
      notify.error("Tree generation failed");
    }

    setIsGenerating(false);
  }, [
    preset,
    seed,
    showLeaves,
    batchMode,
    clearBatchResults,
    advancedParams,
    geometryOptions,
    showLODPreview,
    clearLODPreviews,
    clusterSettings,
    autoGenerateLODs,
    generateLODPreviews,
    createClusterVisualization,
  ]);

  // Generate batch of trees
  const generateBatch = useCallback(() => {
    if (!sceneRef.current) return;

    // Clear existing
    clearBatchResults();
    if (currentTreeRef.current) {
      sceneRef.current.remove(currentTreeRef.current.group!);
      disposeTreeMesh(currentTreeRef.current);
      currentTreeRef.current = null;
    }

    setIsGenerating(true);
    const startTime = performance.now();

    try {
      const presetParams = getPreset(preset);
      if (!presetParams) {
        notify.error(`Preset not found: ${preset}`);
        setIsGenerating(false);
        return;
      }

      const results: TreeMeshResult[] = [];
      const gridSize = Math.ceil(Math.sqrt(batchCount));
      const spacing = 15; // Space between trees

      // Create shared TSL material for batch (WebGPU-compatible instanced rendering)
      const batchLeafMaterial = createInstancedLeafMaterialTSL({
        color: new THREE.Color(0x3d7a3d),
        colorVariation: 0.15,
        alphaTest: 0.5,
        leafShape: "elliptic",
        subsurfaceScatter: 0.35,
      });

      for (let i = 0; i < batchCount; i++) {
        const batchSeed = seed + i * 1000;

        // Use TSL instanced leaf material for WebGPU
        const result = generateTree(preset, {
          generation: { seed: batchSeed },
          geometry: geometryOptions,
          mesh: {
            useInstancedLeaves: true,
            leafMaterial: batchLeafMaterial,
          },
        });

        if (result.group) {
          // Remove leaves if not showing
          if (!showLeaves && result.leaves) {
            result.group.remove(result.leaves);
          }

          // Position in grid
          const row = Math.floor(i / gridSize);
          const col = i % gridSize;
          const x = (col - gridSize / 2) * spacing;
          const z = (row - gridSize / 2) * spacing;
          result.group.position.set(x, 0, z);

          result.group.castShadow = true;
          result.group.receiveShadow = true;
          result.group.traverse((obj: THREE.Object3D) => {
            if (obj instanceof THREE.Mesh) {
              obj.castShadow = true;
              obj.receiveShadow = true;
            }
          });

          sceneRef.current!.add(result.group);
          results.push(result);
          batchTreesRef.current.push(result);
        }
      }

      setBatchResults(results);

      // Zoom camera out to see all trees
      if (cameraRef.current && controlsRef.current) {
        const viewDistance = gridSize * spacing * 0.8;
        cameraRef.current.position.set(
          viewDistance,
          viewDistance * 0.6,
          viewDistance,
        );
        controlsRef.current.target.set(0, 5, 0);
        controlsRef.current.update();
      }

      // Calculate total stats
      const totalVertices = results.reduce((sum, r) => sum + r.vertexCount, 0);
      const totalTriangles = results.reduce(
        (sum, r) => sum + r.triangleCount,
        0,
      );

      setStats({
        stems: results.length,
        leaves: results.filter((r) => r.leaves !== null).length,
        vertices: totalVertices,
        triangles: totalTriangles,
        time: Math.round(performance.now() - startTime),
      });

      notify.success(`Generated ${results.length} trees`);
    } catch (error) {
      console.error("Batch generation error:", error);
      notify.error("Batch generation failed");
    }

    setIsGenerating(false);
  }, [
    preset,
    seed,
    showLeaves,
    batchCount,
    clearBatchResults,
    geometryOptions,
  ]);

  // Select a tree from batch
  const selectBatchTree = useCallback(
    (index: number) => {
      if (!batchResults[index]) return;

      setSelectedBatchIndex(index);

      // Center camera on selected tree
      const tree = batchResults[index];
      if (tree.group && cameraRef.current && controlsRef.current) {
        const pos = tree.group.position;
        controlsRef.current.target.set(pos.x, 5, pos.z);
        cameraRef.current.position.set(pos.x + 15, 10, pos.z + 15);
        controlsRef.current.update();
      }
    },
    [batchResults],
  );

  // Generate initial tree
  useEffect(() => {
    generateTreeMesh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update light direction when settings change
  useEffect(() => {
    updateLightDirection();
  }, [updateLightDirection]);

  // Get current preset params for display
  const currentPresetParams = getPreset(preset);

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <TreePine size={28} />
            Tree Editor
          </h1>
          <p className="text-text-secondary mt-1">
            Full tree customization with LOD preview and impostor generation
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* LOD Preview Toggle */}
          <button
            onClick={() => {
              if (showLODPreview) {
                clearLODPreviews();
                setShowLODPreview(false);
              } else {
                generateLODPreviews();
              }
            }}
            disabled={!currentTreeRef.current || isGenerating}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              showLODPreview
                ? "bg-purple-600 text-white"
                : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
            } disabled:opacity-50`}
            title="Show all LODs and impostor side by side"
          >
            <Eye size={18} />
            LOD View
          </button>

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
            disabled={!currentTreeRef.current}
            className="flex items-center gap-2 px-4 py-2 bg-green-600/20 text-green-500 hover:bg-green-600/30 rounded-lg transition-all disabled:opacity-50"
            title="Save GLB to assets (loses instancing - for external tools only)"
          >
            <Database size={18} />
            Assets
          </button>

          {/* Export */}
          <button
            onClick={() => (batchMode ? exportBatchToGLB() : exportToGLB())}
            disabled={!currentTreeRef.current && batchResults.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary text-text-secondary hover:text-text-primary rounded-lg transition-all disabled:opacity-50"
            title="Export GLB (bakes geometry - loses instancing)"
          >
            <Download size={18} />
            Export GLB
          </button>

          {/* Generate */}
          <button
            onClick={batchMode ? generateBatch : generateTreeMesh}
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

      <div className="flex-1 flex gap-4">
        {/* Controls Panel */}
        <div className="w-80 flex-shrink-0 space-y-3 overflow-y-auto max-h-[calc(100vh-180px)]">
          {/* Base Settings */}
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
            <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Settings2 size={18} />
              Base Settings
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Tree Species
                </label>
                <select
                  value={preset}
                  onChange={(e) => {
                    setPreset(e.target.value);
                    // Reset advanced params when changing preset
                    setAdvancedParams({});
                  }}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-md text-text-primary text-sm"
                >
                  {presetNames.map((name) => (
                    <option key={name} value={name}>
                      {name
                        .replace(/([A-Z])/g, " $1")
                        .replace(/^./, (s) => s.toUpperCase())
                        .trim()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Seed
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
                    className="flex-1 px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded-md text-text-primary text-sm"
                  />
                  <button
                    onClick={() => setSeed(Math.floor(Math.random() * 1000000))}
                    className="px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded-md text-text-secondary hover:text-text-primary transition-colors"
                    title="Random seed"
                  >
                    🎲
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLeaves}
                    onChange={(e) => setShowLeaves(e.target.checked)}
                    className="rounded"
                  />
                  Show Leaves
                </label>
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showClusters}
                    onChange={(e) => {
                      setShowClusters(e.target.checked);
                      if (clusterGroupRef.current) {
                        clusterGroupRef.current.visible = e.target.checked;
                      }
                    }}
                    className="rounded"
                  />
                  Show Clusters
                  {clusterResult && (
                    <span className="text-xs text-text-tertiary">
                      ({clusterResult.stats.clusterCount})
                    </span>
                  )}
                </label>
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoGenerateLODs}
                    onChange={(e) => setAutoGenerateLODs(e.target.checked)}
                    className="rounded"
                  />
                  Auto-generate LODs
                </label>
              </div>

              {/* Batch Count */}
              {batchMode && (
                <div>
                  <label className="block text-sm text-text-secondary mb-1">
                    Batch Count: {batchCount}
                  </label>
                  <input
                    type="range"
                    min={2}
                    max={25}
                    value={batchCount}
                    onChange={(e) => setBatchCount(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}

              <button
                onClick={batchMode ? generateBatch : generateTreeMesh}
                disabled={isGenerating}
                className="w-full py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition-all disabled:opacity-50 text-sm"
              >
                {isGenerating
                  ? "Generating..."
                  : batchMode
                    ? `Generate ${batchCount} Trees`
                    : "Generate Tree"}
              </button>
            </div>
          </div>

          {/* Tree Shape Settings */}
          <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
            <button
              onClick={() => togglePanel("shape")}
              className="w-full px-4 py-3 flex items-center justify-between text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <span className="font-semibold flex items-center gap-2">
                <TreePine size={16} />
                Tree Shape
              </span>
              {expandedPanels.shape ? (
                <ChevronDown size={18} />
              ) : (
                <ChevronRight size={18} />
              )}
            </button>
            {expandedPanels.shape && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Shape Type
                  </label>
                  <select
                    value={
                      advancedParams.shape ?? currentPresetParams?.shape ?? 0
                    }
                    onChange={(e) =>
                      updateAdvancedParam(
                        "shape",
                        parseInt(e.target.value) as TreeShapeType,
                      )
                    }
                    className="w-full px-2 py-1.5 bg-bg-tertiary border border-border-primary rounded text-text-primary text-sm"
                  >
                    {TREE_SHAPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">
                      Scale (
                      {(
                        advancedParams.gScale ??
                        currentPresetParams?.gScale ??
                        10
                      ).toFixed(1)}
                      )
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={50}
                      step={0.5}
                      value={
                        advancedParams.gScale ??
                        currentPresetParams?.gScale ??
                        10
                      }
                      onChange={(e) =>
                        updateAdvancedParam(
                          "gScale",
                          parseFloat(e.target.value),
                        )
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">
                      Levels (
                      {advancedParams.levels ??
                        currentPresetParams?.levels ??
                        3}
                      )
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={4}
                      step={1}
                      value={
                        advancedParams.levels ??
                        currentPresetParams?.levels ??
                        3
                      }
                      onChange={(e) =>
                        updateAdvancedParam("levels", parseInt(e.target.value))
                      }
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">
                      Ratio (
                      {(
                        advancedParams.ratio ??
                        currentPresetParams?.ratio ??
                        0.015
                      ).toFixed(3)}
                      )
                    </label>
                    <input
                      type="range"
                      min={0.001}
                      max={0.1}
                      step={0.001}
                      value={
                        advancedParams.ratio ??
                        currentPresetParams?.ratio ??
                        0.015
                      }
                      onChange={(e) =>
                        updateAdvancedParam("ratio", parseFloat(e.target.value))
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">
                      Flare (
                      {(
                        advancedParams.flare ??
                        currentPresetParams?.flare ??
                        0
                      ).toFixed(2)}
                      )
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      value={
                        advancedParams.flare ?? currentPresetParams?.flare ?? 0
                      }
                      onChange={(e) =>
                        updateAdvancedParam("flare", parseFloat(e.target.value))
                      }
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Trunk Settings */}
          <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
            <button
              onClick={() => togglePanel("trunk")}
              className="w-full px-4 py-3 flex items-center justify-between text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <span className="font-semibold flex items-center gap-2">
                <Layers size={16} />
                Trunk
              </span>
              {expandedPanels.trunk ? (
                <ChevronDown size={18} />
              ) : (
                <ChevronRight size={18} />
              )}
            </button>
            {expandedPanels.trunk && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Base Splits (
                    {advancedParams.baseSplits ??
                      currentPresetParams?.baseSplits ??
                      0}
                    )
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={1}
                    value={
                      advancedParams.baseSplits ??
                      currentPresetParams?.baseSplits ??
                      0
                    }
                    onChange={(e) =>
                      updateAdvancedParam(
                        "baseSplits",
                        parseInt(e.target.value),
                      )
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Ratio Power (
                    {(
                      advancedParams.ratioPower ??
                      currentPresetParams?.ratioPower ??
                      1.2
                    ).toFixed(2)}
                    )
                  </label>
                  <input
                    type="range"
                    min={0.5}
                    max={3}
                    step={0.1}
                    value={
                      advancedParams.ratioPower ??
                      currentPresetParams?.ratioPower ??
                      1.2
                    }
                    onChange={(e) =>
                      updateAdvancedParam(
                        "ratioPower",
                        parseFloat(e.target.value),
                      )
                    }
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Branch Settings */}
          <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
            <button
              onClick={() => togglePanel("branches")}
              className="w-full px-4 py-3 flex items-center justify-between text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <span className="font-semibold flex items-center gap-2">
                <TreePine size={16} />
                Branches
              </span>
              {expandedPanels.branches ? (
                <ChevronDown size={18} />
              ) : (
                <ChevronRight size={18} />
              )}
            </button>
            {expandedPanels.branches && (
              <div className="px-4 pb-4 space-y-2">
                <p className="text-xs text-text-secondary italic">
                  Branch parameters are per-level arrays [trunk, level1, level2,
                  level3]. Adjusting these requires editing the preset JSON
                  directly.
                </p>
                <div className="text-xs text-text-secondary">
                  <p>
                    Current preset branch count: [
                    {currentPresetParams?.branches?.join(", ")}]
                  </p>
                  <p>
                    Down angles: [{currentPresetParams?.downAngle?.join(", ")}
                    ]°
                  </p>
                  <p>Rotation: [{currentPresetParams?.rotate?.join(", ")}]°</p>
                  <p>
                    Length: [
                    {currentPresetParams?.length
                      ?.map((l) => l.toFixed(2))
                      .join(", ")}
                    ]
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Leaf Settings */}
          <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
            <button
              onClick={() => togglePanel("leaves")}
              className="w-full px-4 py-3 flex items-center justify-between text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <span className="font-semibold flex items-center gap-2">
                <TreePine size={16} />
                Leaves
              </span>
              {expandedPanels.leaves ? (
                <ChevronDown size={18} />
              ) : (
                <ChevronRight size={18} />
              )}
            </button>
            {expandedPanels.leaves && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Leaf Shape
                  </label>
                  <select
                    value={
                      advancedParams.leafShape ??
                      currentPresetParams?.leafShape ??
                      8
                    }
                    onChange={(e) =>
                      updateAdvancedParam(
                        "leafShape",
                        parseInt(e.target.value) as LeafShapeType,
                      )
                    }
                    className="w-full px-2 py-1.5 bg-bg-tertiary border border-border-primary rounded text-text-primary text-sm"
                  >
                    {LEAF_SHAPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">
                      Leaf Scale (
                      {(
                        advancedParams.leafScale ??
                        currentPresetParams?.leafScale ??
                        0.2
                      ).toFixed(2)}
                      )
                    </label>
                    <input
                      type="range"
                      min={0.01}
                      max={1}
                      step={0.01}
                      value={
                        advancedParams.leafScale ??
                        currentPresetParams?.leafScale ??
                        0.2
                      }
                      onChange={(e) =>
                        updateAdvancedParam(
                          "leafScale",
                          parseFloat(e.target.value),
                        )
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">
                      Width Scale (
                      {(
                        advancedParams.leafScaleX ??
                        currentPresetParams?.leafScaleX ??
                        1
                      ).toFixed(2)}
                      )
                    </label>
                    <input
                      type="range"
                      min={0.1}
                      max={2}
                      step={0.05}
                      value={
                        advancedParams.leafScaleX ??
                        currentPresetParams?.leafScaleX ??
                        1
                      }
                      onChange={(e) =>
                        updateAdvancedParam(
                          "leafScaleX",
                          parseFloat(e.target.value),
                        )
                      }
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">
                      Leaf Count (
                      {advancedParams.leafBlosNum ??
                        currentPresetParams?.leafBlosNum ??
                        40}
                      )
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      step={1}
                      value={
                        advancedParams.leafBlosNum ??
                        currentPresetParams?.leafBlosNum ??
                        40
                      }
                      onChange={(e) =>
                        updateAdvancedParam(
                          "leafBlosNum",
                          parseInt(e.target.value),
                        )
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">
                      Leaf Bend (
                      {(
                        advancedParams.leafBend ??
                        currentPresetParams?.leafBend ??
                        0.3
                      ).toFixed(2)}
                      )
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={
                        advancedParams.leafBend ??
                        currentPresetParams?.leafBend ??
                        0.3
                      }
                      onChange={(e) =>
                        updateAdvancedParam(
                          "leafBend",
                          parseFloat(e.target.value),
                        )
                      }
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Geometry Settings */}
          <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
            <button
              onClick={() => togglePanel("geometry")}
              className="w-full px-4 py-3 flex items-center justify-between text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <span className="font-semibold flex items-center gap-2">
                <Settings2 size={16} />
                Geometry
              </span>
              {expandedPanels.geometry ? (
                <ChevronDown size={18} />
              ) : (
                <ChevronRight size={18} />
              )}
            </button>
            {expandedPanels.geometry && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Radial Segments ({geometryOptions.radialSegments})
                  </label>
                  <input
                    type="range"
                    min={3}
                    max={16}
                    step={1}
                    value={geometryOptions.radialSegments ?? 5}
                    onChange={(e) =>
                      setGeometryOptions((prev) => ({
                        ...prev,
                        radialSegments: parseInt(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                  <p className="text-xs text-text-tertiary mt-1">
                    Lower = less vertices, blockier branches
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Max Leaves ({geometryOptions.maxLeaves?.toLocaleString()})
                  </label>
                  <input
                    type="range"
                    min={1000}
                    max={100000}
                    step={1000}
                    value={geometryOptions.maxLeaves ?? 25000}
                    onChange={(e) =>
                      setGeometryOptions((prev) => ({
                        ...prev,
                        maxLeaves: parseInt(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Max Stems ({geometryOptions.maxStems?.toLocaleString()})
                  </label>
                  <input
                    type="range"
                    min={100}
                    max={5000}
                    step={100}
                    value={geometryOptions.maxStems ?? 1000}
                    onChange={(e) =>
                      setGeometryOptions((prev) => ({
                        ...prev,
                        maxStems: parseInt(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Max Branch Depth ({geometryOptions.maxBranchDepth ?? "All"})
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={4}
                    step={1}
                    value={geometryOptions.maxBranchDepth ?? 4}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setGeometryOptions((prev) => ({
                        ...prev,
                        maxBranchDepth: val >= 4 ? undefined : val,
                      }));
                    }}
                    className="w-full"
                  />
                  <p className="text-xs text-text-tertiary mt-1">
                    0=trunk only, 1=main branches, 4=all
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="branchCaps"
                    checked={geometryOptions.branchCaps ?? false}
                    onChange={(e) =>
                      setGeometryOptions((prev) => ({
                        ...prev,
                        branchCaps: e.target.checked,
                      }))
                    }
                    className="rounded"
                  />
                  <label
                    htmlFor="branchCaps"
                    className="text-xs text-text-secondary cursor-pointer"
                  >
                    Branch End Caps
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* LOD Settings */}
          <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
            <button
              onClick={() => togglePanel("lod")}
              className="w-full px-4 py-3 flex items-center justify-between text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <span className="font-semibold flex items-center gap-2">
                <Sliders size={16} />
                LOD Settings
              </span>
              {expandedPanels.lod ? (
                <ChevronDown size={18} />
              ) : (
                <ChevronRight size={18} />
              )}
            </button>
            {expandedPanels.lod && (
              <div className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">
                      LOD1 % ({lodSettings.lod1.targetPercent}%)
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={60}
                      step={5}
                      value={lodSettings.lod1.targetPercent}
                      onChange={(e) =>
                        setLodSettings((prev) => ({
                          ...prev,
                          lod1: {
                            ...prev.lod1,
                            targetPercent: parseInt(e.target.value),
                          },
                        }))
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">
                      LOD1 Dist ({lodSettings.lod1.distance}m)
                    </label>
                    <input
                      type="range"
                      min={20}
                      max={200}
                      step={10}
                      value={lodSettings.lod1.distance}
                      onChange={(e) =>
                        setLodSettings((prev) => ({
                          ...prev,
                          lod1: {
                            ...prev.lod1,
                            distance: parseInt(e.target.value),
                          },
                        }))
                      }
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">
                      LOD2 % ({lodSettings.lod2.targetPercent}%)
                    </label>
                    <input
                      type="range"
                      min={5}
                      max={30}
                      step={5}
                      value={lodSettings.lod2.targetPercent}
                      onChange={(e) =>
                        setLodSettings((prev) => ({
                          ...prev,
                          lod2: {
                            ...prev.lod2,
                            targetPercent: parseInt(e.target.value),
                          },
                        }))
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">
                      LOD2 Dist ({lodSettings.lod2.distance}m)
                    </label>
                    <input
                      type="range"
                      min={50}
                      max={400}
                      step={10}
                      value={lodSettings.lod2.distance}
                      onChange={(e) =>
                        setLodSettings((prev) => ({
                          ...prev,
                          lod2: {
                            ...prev.lod2,
                            distance: parseInt(e.target.value),
                          },
                        }))
                      }
                      className="w-full"
                    />
                  </div>
                </div>
                <button
                  onClick={generateLODPreviews}
                  disabled={!currentTreeRef.current || isGenerating}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                >
                  <Eye size={16} />
                  Generate LOD Preview
                </button>
              </div>
            )}
          </div>

          {/* Impostor Settings */}
          <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
            <button
              onClick={() => togglePanel("impostor")}
              className="w-full px-4 py-3 flex items-center justify-between text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <span className="font-semibold flex items-center gap-2">
                <Image size={16} />
                Impostor Settings
              </span>
              {expandedPanels.impostor ? (
                <ChevronDown size={18} />
              ) : (
                <ChevronRight size={18} />
              )}
            </button>
            {expandedPanels.impostor && (
              <div className="px-4 pb-4 space-y-3">
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
                    className="w-full px-2 py-1.5 bg-bg-tertiary border border-border-primary rounded text-text-primary text-sm"
                  >
                    <option value={512}>512px</option>
                    <option value={1024}>1024px</option>
                    <option value={2048}>2048px</option>
                    <option value={4096}>4096px</option>
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
                    max={32}
                    step={1}
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
                <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
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
                  Enable Dynamic Lighting
                </label>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Impostor Distance: {lodSettings.imposter.activationDistance}
                    m
                  </label>
                  <input
                    type="range"
                    min={100}
                    max={500}
                    step={25}
                    value={lodSettings.imposter.activationDistance}
                    onChange={(e) =>
                      setLodSettings((prev) => ({
                        ...prev,
                        imposter: {
                          ...prev.imposter,
                          activationDistance: parseInt(e.target.value),
                        },
                      }))
                    }
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Lighting Controls */}
          <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
            <button
              onClick={() => togglePanel("lighting")}
              className="w-full px-4 py-3 flex items-center justify-between text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <span className="font-semibold flex items-center gap-2">
                <Sun size={16} />
                Lighting
              </span>
              {expandedPanels.lighting ? (
                <ChevronDown size={18} />
              ) : (
                <ChevronRight size={18} />
              )}
            </button>
            {expandedPanels.lighting && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Sun Azimuth: {lightingSettings.azimuth}°
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={5}
                    value={lightingSettings.azimuth}
                    onChange={(e) =>
                      setLightingSettings((prev) => ({
                        ...prev,
                        azimuth: parseInt(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Sun Elevation: {lightingSettings.elevation}°
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={90}
                    step={5}
                    value={lightingSettings.elevation}
                    onChange={(e) =>
                      setLightingSettings((prev) => ({
                        ...prev,
                        elevation: parseInt(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Sun Intensity: {lightingSettings.intensity.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={0.1}
                    value={lightingSettings.intensity}
                    onChange={(e) =>
                      setLightingSettings((prev) => ({
                        ...prev,
                        intensity: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Ambient Intensity:{" "}
                    {lightingSettings.ambientIntensity.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={lightingSettings.ambientIntensity}
                    onChange={(e) =>
                      setLightingSettings((prev) => ({
                        ...prev,
                        ambientIntensity: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lightingSettings.showHelper}
                    onChange={(e) =>
                      setLightingSettings((prev) => ({
                        ...prev,
                        showHelper: e.target.checked,
                      }))
                    }
                    className="rounded"
                  />
                  Show Light Direction Arrow
                </label>
                <p className="text-xs text-text-tertiary mt-2">
                  Adjust light direction to see how the impostor responds to
                  dynamic lighting via the normal atlas.
                </p>
              </div>
            )}
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
                {showLODPreview
                  ? "LOD Comparison"
                  : batchMode
                    ? "Batch Stats"
                    : "Generation Stats"}
              </h3>

              {/* Instancing Badge - show in normal mode */}
              {!showLODPreview && !batchMode && (
                <div className="mb-3 p-2 bg-green-900/30 border border-green-600/50 rounded-md">
                  <div className="text-xs font-semibold text-green-400 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    WebGPU Instanced Rendering
                  </div>
                  <p className="text-xs text-green-300/80 mt-1">
                    TSL shader - 1 draw call for all leaves per tree
                  </p>
                </div>
              )}

              <div className="space-y-2 text-sm">
                {showLODPreview ? (
                  <>
                    {/* LOD0 Stats */}
                    <div className="p-2 bg-bg-tertiary rounded">
                      <div className="text-xs font-semibold text-blue-400 mb-1">
                        LOD0 (Original)
                      </div>
                      <div className="flex justify-between text-text-secondary text-xs">
                        <span>Vertices:</span>
                        <span className="text-text-primary font-mono">
                          {lodData.lod0.vertices.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-text-secondary text-xs">
                        <span>Triangles:</span>
                        <span className="text-text-primary font-mono">
                          {lodData.lod0.triangles.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {/* LOD1 Stats */}
                    <div className="p-2 bg-bg-tertiary rounded">
                      <div className="text-xs font-semibold text-green-400 mb-1">
                        LOD1 @ {lodSettings.lod1.distance}m
                      </div>
                      <div className="flex justify-between text-text-secondary text-xs">
                        <span>Vertices:</span>
                        <span className="text-text-primary font-mono">
                          {lodData.lod1.vertices.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-text-secondary text-xs">
                        <span>Triangles:</span>
                        <span className="text-text-primary font-mono">
                          {lodData.lod1.triangles.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-text-secondary text-xs mt-1 pt-1 border-t border-border-primary/50">
                        <span>Reduction:</span>
                        <span
                          className={`font-mono ${lodData.lod1.vertices < lodData.lod0.vertices * 0.4 ? "text-green-400" : "text-yellow-400"}`}
                        >
                          {lodData.lod0.vertices > 0
                            ? Math.round(
                                (1 -
                                  lodData.lod1.vertices /
                                    lodData.lod0.vertices) *
                                  100,
                              )
                            : 0}
                          % fewer
                        </span>
                      </div>
                    </div>
                    {/* LOD2 Stats */}
                    <div className="p-2 bg-bg-tertiary rounded">
                      <div className="text-xs font-semibold text-yellow-400 mb-1">
                        LOD2 @ {lodSettings.lod2.distance}m
                      </div>
                      <div className="flex justify-between text-text-secondary text-xs">
                        <span>Vertices:</span>
                        <span className="text-text-primary font-mono">
                          {lodData.lod2.vertices.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-text-secondary text-xs">
                        <span>Triangles:</span>
                        <span className="text-text-primary font-mono">
                          {lodData.lod2.triangles.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-text-secondary text-xs mt-1 pt-1 border-t border-border-primary/50">
                        <span>Reduction:</span>
                        <span
                          className={`font-mono ${lodData.lod2.vertices < lodData.lod0.vertices * 0.15 ? "text-green-400" : "text-yellow-400"}`}
                        >
                          {lodData.lod0.vertices > 0
                            ? Math.round(
                                (1 -
                                  lodData.lod2.vertices /
                                    lodData.lod0.vertices) *
                                  100,
                              )
                            : 0}
                          % fewer
                        </span>
                      </div>
                    </div>
                    {/* Impostor Stats */}
                    <div className="p-2 bg-bg-tertiary rounded">
                      <div className="text-xs font-semibold text-purple-400 mb-1">
                        Impostor @ {lodSettings.imposter.activationDistance}m
                      </div>
                      <div className="flex justify-between text-text-secondary text-xs">
                        <span>Vertices:</span>
                        <span className="text-text-primary font-mono">4</span>
                      </div>
                      <div className="flex justify-between text-text-secondary text-xs">
                        <span>Triangles:</span>
                        <span className="text-text-primary font-mono">2</span>
                      </div>
                      <div className="flex justify-between text-text-secondary text-xs mt-1 pt-1 border-t border-border-primary/50">
                        <span>Atlas:</span>
                        <span className="text-text-primary font-mono">
                          {impostorSettings.atlasSize}x
                          {impostorSettings.atlasSize}
                        </span>
                      </div>
                      <div className="flex justify-between text-text-secondary text-xs">
                        <span>Grid:</span>
                        <span className="text-text-primary font-mono">
                          {impostorSettings.gridSize}x
                          {impostorSettings.gridSize}
                        </span>
                      </div>
                    </div>
                    {/* Note about LOD regeneration */}
                    <div className="text-xs text-text-secondary/60 italic mt-2">
                      LODs are regenerated with reduced geometry (branches,
                      leaves, radial segments) - not decimated.
                    </div>
                  </>
                ) : batchMode ? (
                  <>
                    <div className="flex justify-between text-text-secondary">
                      <span>Trees:</span>
                      <span className="text-text-primary">{stats.stems}</span>
                    </div>
                    <div className="flex justify-between text-text-secondary">
                      <span>With Leaves:</span>
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
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-text-secondary">
                      <span>Stems:</span>
                      <span className="text-text-primary">
                        {stats.stems.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-text-secondary">
                      <span>Leaves:</span>
                      <span className="text-text-primary">
                        {stats.leaves.toLocaleString()}
                      </span>
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
                  </>
                )}
                <div className="flex justify-between text-text-secondary">
                  <span>Gen Time:</span>
                  <span className="text-text-primary">{stats.time}ms</span>
                </div>

                {/* Runtime vs Export info - show in normal mode */}
                {!showLODPreview && !batchMode && (
                  <div className="mt-3 pt-3 border-t border-border-primary">
                    <div className="text-xs text-text-secondary space-y-1">
                      <p className="font-medium text-text-primary">
                        Runtime (Game):
                      </p>
                      <p>
                        • {stats.vertices.toLocaleString()} verts (instanced
                        leaves)
                      </p>
                      <p>• 1 draw call per preset per LOD</p>
                      <p>• All leaves in single global buffer</p>
                      <p className="font-medium text-text-primary mt-2">
                        GLB Export:
                      </p>
                      <p>
                        • ~{(stats.triangles * 3).toLocaleString()} verts
                        (baked)
                      </p>
                      <p>• Instancing lost - for external tools</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Impostor Atlas Preview */}
          {showLODPreview && impostorData.atlasTexture && (
            <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
              <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                <Image size={16} />
                Impostor Atlas
              </h3>
              <div className="relative aspect-square bg-black rounded overflow-hidden">
                <canvas
                  ref={(canvas) => {
                    if (!canvas || !impostorData.atlasTexture) return;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return;

                    // Handle both WebGL (.image) and WebGPU (.source) texture sources
                    const texture = impostorData.atlasTexture;
                    const imageSource = texture.image ?? texture.source;

                    // Check if we have a valid drawable source
                    if (
                      imageSource &&
                      (imageSource instanceof HTMLCanvasElement ||
                        imageSource instanceof HTMLImageElement ||
                        imageSource instanceof ImageBitmap ||
                        imageSource instanceof OffscreenCanvas)
                    ) {
                      canvas.width = 256;
                      canvas.height = 256;
                      ctx.drawImage(imageSource, 0, 0, 256, 256);
                    } else {
                      // Fallback: WebGPU textures can't be drawn to 2D canvas directly
                      canvas.width = 256;
                      canvas.height = 256;
                      ctx.fillStyle = "#1a1a2e";
                      ctx.fillRect(0, 0, 256, 256);
                      ctx.fillStyle = "#6a6a8a";
                      ctx.font = "11px sans-serif";
                      ctx.textAlign = "center";
                      // Show that we have a texture but it's GPU-resident
                      if (texture && texture.uuid) {
                        ctx.fillText("WebGPU Atlas (GPU)", 128, 120);
                        ctx.fillStyle = "#4a8a4a";
                        ctx.fillText(
                          `${impostorSettings.atlasSize}x${impostorSettings.atlasSize}`,
                          128,
                          140,
                        );
                      } else {
                        ctx.fillText("Atlas rendering...", 128, 128);
                      }
                    }
                  }}
                  className="w-full h-full"
                />
              </div>
              <p className="text-xs text-text-secondary mt-2 text-center">
                {impostorSettings.gridSize}x{impostorSettings.gridSize}{" "}
                octahedral views
              </p>
            </div>
          )}

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
                    onClick={() => selectBatchTree(index)}
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
                    Tree #{selectedBatchIndex + 1} - Seed:{" "}
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
        </div>

        {/* Viewer */}
        <div className="flex-1 bg-bg-secondary rounded-xl overflow-hidden border border-border-primary relative">
          <div ref={containerRef} className="w-full h-full" />

          {/* LOD Labels overlay when in LOD preview mode */}
          {showLODPreview && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-16 pointer-events-none">
              <div className="text-center">
                <div className="bg-blue-500/80 text-white text-xs px-3 py-1 rounded-full font-semibold">
                  LOD0
                </div>
                <div className="text-xs text-white/80 mt-1">Original</div>
              </div>
              <div className="text-center">
                <div className="bg-green-500/80 text-white text-xs px-3 py-1 rounded-full font-semibold">
                  LOD1
                </div>
                <div className="text-xs text-white/80 mt-1">
                  {lodSettings.lod1.targetPercent}%
                </div>
              </div>
              <div className="text-center">
                <div className="bg-yellow-500/80 text-white text-xs px-3 py-1 rounded-full font-semibold">
                  LOD2
                </div>
                <div className="text-xs text-white/80 mt-1">
                  {lodSettings.lod2.targetPercent}%
                </div>
              </div>
              <div className="text-center">
                <div className="bg-purple-500/80 text-white text-xs px-3 py-1 rounded-full font-semibold">
                  Impostor
                </div>
                <div className="text-xs text-white/80 mt-1">Billboard</div>
              </div>
            </div>
          )}
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

export default TreeGenPage;
