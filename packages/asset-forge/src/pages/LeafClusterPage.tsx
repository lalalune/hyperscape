/**
 * LeafClusterPage
 *
 * Visual tool for developing and testing SpeedTree-style leaf cluster rendering.
 *
 * SpeedTree Approach:
 * - Clusters based on actual branch structures (not pure spatial)
 * - Orthographic rendering to textures
 * - Collision detection removes overlapping leaves
 * - Higher resolution textures (256-512px)
 *
 * This page allows rapid iteration on cluster quality before
 * integrating into the main game.
 */

import {
  TreeGenerator,
  getPresetNames,
  getPreset,
  BranchClusterGenerator,
  createInstancedLeafMaterialTSL,
  generateInstancedLeaves,
  type TreeData,
  type TreeParams,
  type BranchClusterResult,
} from "@hyperforge/procgen";
import {
  TreePine,
  RefreshCw,
  Eye,
  EyeOff,
  Sliders,
  RotateCcw,
  Layers,
  GitBranch,
  Scissors,
} from "lucide-react";
import React, { useRef, useEffect, useState, useCallback } from "react";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MeshStandardNodeMaterial, MeshBasicNodeMaterial } from "three/webgpu";

import { notify } from "@/utils/notify";
import {
  THREE,
  createWebGPURenderer,
  type AssetForgeRenderer,
} from "@/utils/webgpu-renderer";

// ============================================================================
// TYPES
// ============================================================================

interface ClusterViewMode {
  showTree: boolean;
  showLeaves: boolean;
  showClusters: boolean;
  showClusterBounds: boolean;
  showBranches: boolean;
  showAtlas: boolean;
  selectedCluster: number | null;
}

interface ClusterSettings {
  textureSize: number;
  minStemDepth: number;
  minLeavesPerCluster: number;
  maxLeavesPerCluster: number;
  targetClusterCount: number;
  cullOverlapping: boolean;
  overlapThreshold: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const LeafClusterPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<AssetForgeRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Tree and cluster refs
  const treeGroupRef = useRef<THREE.Group | null>(null);
  const leafGroupRef = useRef<THREE.Group | null>(null);
  const clusterGroupRef = useRef<THREE.Group | null>(null);
  const boundsGroupRef = useRef<THREE.Group | null>(null);
  const branchGroupRef = useRef<THREE.Group | null>(null);

  // State
  const [preset, setPreset] = useState("quakingAspen");
  const [seed, setSeed] = useState(12345);
  const [isGenerating, setIsGenerating] = useState(false);
  const [clusterResult, setClusterResult] =
    useState<BranchClusterResult | null>(null);
  const [treeData, setTreeData] = useState<TreeData | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<ClusterViewMode>({
    showTree: true,
    showLeaves: true,
    showClusters: true,
    showClusterBounds: false,
    showBranches: false,
    showAtlas: false,
    selectedCluster: null,
  });

  // Cluster settings (SpeedTree style)
  const [settings, setSettings] = useState<ClusterSettings>({
    textureSize: 256,
    minStemDepth: 1,
    minLeavesPerCluster: 3,
    maxLeavesPerCluster: 40,
    targetClusterCount: 80,
    cullOverlapping: true,
    overlapThreshold: 0.3,
  });

  // Stats
  const [stats, setStats] = useState<{
    totalLeaves: number;
    clusterCount: number;
    avgLeavesPerCluster: number;
    leavesCulled: number;
    reductionRatio: number;
    stemCount: number;
  } | null>(null);

  // Ref to hold current generateTreeAndClusters callback (to avoid circular dependency)
  const generateTreeAndClustersRef = useRef<(() => Promise<void>) | null>(null);

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const init = async () => {
      // Create WebGPU renderer
      const renderer = await createWebGPURenderer({
        antialias: true,
        alpha: true,
      });
      if (!renderer) {
        notify.error("Failed to create WebGPU renderer");
        return;
      }

      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x1a1a2e, 1);
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Create scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Create camera
      const camera = new THREE.PerspectiveCamera(
        50,
        container.clientWidth / container.clientHeight,
        0.1,
        1000,
      );
      camera.position.set(10, 8, 10);
      cameraRef.current = camera;

      // Create controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.target.set(0, 4, 0);
      controls.update();
      controlsRef.current = controls;

      // Add lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
      directionalLight.position.set(5, 10, 5);
      directionalLight.castShadow = true;
      scene.add(directionalLight);

      // Add ground plane
      const groundGeo = new THREE.PlaneGeometry(20, 20);
      const groundMat = new MeshStandardNodeMaterial({
        color: 0x2d5a27,
        roughness: 0.9,
      });
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      // Add grid helper
      const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
      gridHelper.position.y = 0.01;
      scene.add(gridHelper);

      // Create groups for organization
      treeGroupRef.current = new THREE.Group();
      treeGroupRef.current.name = "TreeGroup";
      scene.add(treeGroupRef.current);

      leafGroupRef.current = new THREE.Group();
      leafGroupRef.current.name = "LeafGroup";
      scene.add(leafGroupRef.current);

      clusterGroupRef.current = new THREE.Group();
      clusterGroupRef.current.name = "ClusterGroup";
      scene.add(clusterGroupRef.current);

      boundsGroupRef.current = new THREE.Group();
      boundsGroupRef.current.name = "BoundsGroup";
      scene.add(boundsGroupRef.current);

      branchGroupRef.current = new THREE.Group();
      branchGroupRef.current.name = "BranchGroup";
      scene.add(branchGroupRef.current);

      // Animation loop
      const animate = () => {
        requestAnimationFrame(animate);
        controls.update();

        // Update cluster billboard rotations to face camera
        if (clusterGroupRef.current) {
          clusterGroupRef.current.children.forEach((child) => {
            if (child instanceof THREE.Mesh) {
              child.lookAt(
                camera.position.x,
                child.position.y,
                camera.position.z,
              );
            }
          });
        }

        renderer.renderAsync(scene, camera);
      };
      animate();

      // Generate initial tree - called inside init
      void generateTreeAndClustersRef.current?.();
    };

    init();

    // Cleanup
    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
        container.removeChild(rendererRef.current.domElement);
      }
    };
  }, []);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current)
        return;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Clear a group's children
  const clearGroup = (group: THREE.Group | null) => {
    if (!group) return;
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
      if (child instanceof THREE.LineSegments) {
        child.geometry?.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    }
  };

  // Create visual representation of individual leaves
  const createLeafVisualization = useCallback((data: TreeData) => {
    if (!leafGroupRef.current) return;

    const { leaves, params: treeParams } = data;

    // Create instanced leaf mesh
    const leafResult = generateInstancedLeaves(
      leaves,
      treeParams,
      treeParams.gScale,
      {
        material: createInstancedLeafMaterialTSL({
          color: new THREE.Color(0x3d7a3d),
          leafShape: "elliptic",
          alphaTest: 0.5,
        }),
        useTSL: true,
      },
    );

    if (leafResult.mesh) {
      leafGroupRef.current.add(leafResult.mesh);
    }
  }, []);

  // Create visual representation of clusters
  const createClusterVisualization = useCallback(
    (result: BranchClusterResult, _params: TreeParams) => {
      if (!clusterGroupRef.current || !boundsGroupRef.current) return;

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
        billboard.userData = {
          clusterId: cluster.id,
          clusterIndex: i,
          stemDepth: cluster.stemDepth,
        };

        clusterGroupRef.current!.add(billboard);

        // Create bounding box wireframe
        const boxGeo = new THREE.BoxGeometry(
          cluster.bounds.max.x - cluster.bounds.min.x,
          cluster.bounds.max.y - cluster.bounds.min.y,
          cluster.bounds.max.z - cluster.bounds.min.z,
        );
        const boxMat = new THREE.LineBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.5,
        });
        const boxEdges = new THREE.EdgesGeometry(boxGeo);
        const boxWireframe = new THREE.LineSegments(boxEdges, boxMat);

        const boxCenter = new THREE.Vector3();
        cluster.bounds.getCenter(boxCenter);
        boxWireframe.position.copy(boxCenter);

        boundsGroupRef.current!.add(boxWireframe);
      }
    },
    [],
  );

  // Create branch visualization
  const createBranchVisualization = useCallback((data: TreeData) => {
    if (!branchGroupRef.current) return;

    const { stems } = data;

    // Colors for different stem depths
    const depthColors = [
      0x8b4513, // Depth 0 - brown (trunk)
      0xa0522d, // Depth 1 - sienna
      0xcd853f, // Depth 2 - peru
      0xdeb887, // Depth 3 - burlywood
      0xf4a460, // Depth 4+ - sandy brown
    ];

    for (const stemData of stems) {
      const points = stemData.points.map((p) => p.position);

      if (points.length < 2) continue;

      const color =
        depthColors[Math.min(stemData.depth, depthColors.length - 1)];

      // Create line for branch path
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color,
        linewidth: Math.max(1, 3 - stemData.depth),
      });
      const line = new THREE.Line(lineGeo, lineMat);

      branchGroupRef.current!.add(line);
    }
  }, []);

  // Generate tree and clusters
  const generateTreeAndClusters = useCallback(async () => {
    if (!sceneRef.current) return;

    setIsGenerating(true);

    try {
      // Clear previous
      clearGroup(treeGroupRef.current);
      clearGroup(leafGroupRef.current);
      clearGroup(clusterGroupRef.current);
      clearGroup(boundsGroupRef.current);
      clearGroup(branchGroupRef.current);

      // Get preset params
      const presetParams = getPreset(preset);
      if (!presetParams) {
        notify.error(`Unknown preset: ${preset}`);
        return;
      }

      // Generate tree using TreeGenerator to get both mesh and data
      const generator = new TreeGenerator(presetParams, {
        generation: {
          seed,
          generateLeaves: true,
        },
        geometry: {
          maxLeaves: 10000,
        },
      });

      const meshResult = generator.generate();
      const data = generator.getLastTreeData();

      if (!data) {
        notify.error("Failed to generate tree data");
        return;
      }

      setTreeData(data);

      // Add tree trunk/branches (without leaves)
      if (meshResult.group && treeGroupRef.current) {
        // Clone just the branch meshes
        meshResult.group.traverse((child) => {
          if (child instanceof THREE.Mesh && child.name.includes("branch")) {
            treeGroupRef.current!.add(child.clone());
          }
        });
      }

      // Generate branch-based clusters using SpeedTree style generator
      const clusterGenerator = new BranchClusterGenerator({
        minStemDepth: settings.minStemDepth,
        minLeavesPerCluster: settings.minLeavesPerCluster,
        maxLeavesPerCluster: settings.maxLeavesPerCluster,
        targetClusterCount: settings.targetClusterCount,
        cullOverlappingLeaves: settings.cullOverlapping,
        overlapThreshold: settings.overlapThreshold,
        textureSize: settings.textureSize,
      });

      // TreeData already has StemData[] and LeafData[] (not class instances)
      const clusters = clusterGenerator.generateClusters(
        data.leaves,
        data.stems,
        data.params,
      );
      setClusterResult(clusters);

      // Create cluster visualization
      createClusterVisualization(clusters, data.params);

      // Create individual leaf visualization (for comparison)
      createLeafVisualization(data);

      // Create branch visualization
      createBranchVisualization(data);

      // Update stats
      setStats({
        totalLeaves: clusters.stats.totalLeaves,
        clusterCount: clusters.stats.clusterCount,
        avgLeavesPerCluster: clusters.stats.avgLeavesPerCluster,
        leavesCulled: clusters.stats.leavesCulledForOverlap,
        reductionRatio: clusters.stats.reductionRatio,
        stemCount: data.stems.length,
      });

      notify.success(
        `Generated ${clusters.stats.clusterCount} branch clusters from ${clusters.stats.totalLeaves} leaves`,
      );
    } catch (error) {
      console.error("Error generating tree:", error);
      notify.error("Failed to generate tree: " + (error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  }, [
    preset,
    seed,
    settings,
    createBranchVisualization,
    createClusterVisualization,
    createLeafVisualization,
  ]);

  // Keep the ref updated
  useEffect(() => {
    generateTreeAndClustersRef.current = generateTreeAndClusters;
  }, [generateTreeAndClusters]);

  // Toggle view modes
  const toggleViewMode = (key: keyof ClusterViewMode) => {
    setViewMode((prev) => {
      const newMode = { ...prev, [key]: !prev[key] };

      // Update visibility
      if (treeGroupRef.current && key === "showTree") {
        treeGroupRef.current.visible = newMode.showTree;
      }
      if (leafGroupRef.current && key === "showLeaves") {
        leafGroupRef.current.visible = newMode.showLeaves;
      }
      if (clusterGroupRef.current && key === "showClusters") {
        clusterGroupRef.current.visible = newMode.showClusters;
      }
      if (boundsGroupRef.current && key === "showClusterBounds") {
        boundsGroupRef.current.visible = newMode.showClusterBounds;
      }
      if (branchGroupRef.current && key === "showBranches") {
        branchGroupRef.current.visible = newMode.showBranches;
      }

      return newMode;
    });
  };

  // Reset camera
  const resetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(10, 8, 10);
      controlsRef.current.target.set(0, 4, 0);
      controlsRef.current.update();
    }
  };

  // Regenerate when settings change
  useEffect(() => {
    if (treeData) {
      void generateTreeAndClusters();
    }
  }, [settings, treeData, generateTreeAndClusters]);

  return (
    <div className="flex h-full">
      {/* Main 3D View */}
      <div className="flex-1 relative">
        <div ref={containerRef} className="w-full h-full" />

        {/* Overlay Controls */}
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          <div className="bg-gray-900/90 rounded-lg p-3 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <TreePine className="w-5 h-5 text-green-400" />
              Branch Cluster Viewer
            </h2>
            <p className="text-xs text-gray-400 mb-3">
              SpeedTree-style branch-aware clustering
            </p>

            {/* Preset selector */}
            <div className="flex gap-2 mb-3">
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
                className="flex-1 bg-gray-800 text-white text-sm rounded px-2 py-1 border border-gray-700"
              >
                {getPresetNames().map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setSeed(Math.floor(Math.random() * 100000))}
                className="px-2 py-1 bg-gray-700 text-white rounded hover:bg-gray-600"
                title="Random seed"
              >
                🎲
              </button>
            </div>

            {/* Generate button */}
            <button
              onClick={generateTreeAndClusters}
              disabled={isGenerating}
              className="w-full px-3 py-2 bg-green-600 text-white rounded flex items-center justify-center gap-2 hover:bg-green-500 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`}
              />
              {isGenerating ? "Generating..." : "Generate"}
            </button>
          </div>

          {/* View Mode Toggles */}
          <div className="bg-gray-900/90 rounded-lg p-3 backdrop-blur-sm">
            <h3 className="text-sm font-semibold text-white mb-2">View Mode</h3>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => toggleViewMode("showTree")}
                className={`flex items-center gap-2 px-2 py-1 rounded text-sm ${
                  viewMode.showTree
                    ? "bg-amber-600 text-white"
                    : "bg-gray-700 text-gray-400"
                }`}
              >
                {viewMode.showTree ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
                Tree Trunk
              </button>
              <button
                onClick={() => toggleViewMode("showLeaves")}
                className={`flex items-center gap-2 px-2 py-1 rounded text-sm ${
                  viewMode.showLeaves
                    ? "bg-green-600 text-white"
                    : "bg-gray-700 text-gray-400"
                }`}
              >
                {viewMode.showLeaves ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
                Individual Leaves
              </button>
              <button
                onClick={() => toggleViewMode("showClusters")}
                className={`flex items-center gap-2 px-2 py-1 rounded text-sm ${
                  viewMode.showClusters
                    ? "bg-teal-600 text-white"
                    : "bg-gray-700 text-gray-400"
                }`}
              >
                {viewMode.showClusters ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
                Cluster Cards
              </button>
              <button
                onClick={() => toggleViewMode("showClusterBounds")}
                className={`flex items-center gap-2 px-2 py-1 rounded text-sm ${
                  viewMode.showClusterBounds
                    ? "bg-purple-600 text-white"
                    : "bg-gray-700 text-gray-400"
                }`}
              >
                {viewMode.showClusterBounds ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
                Cluster Bounds
              </button>
              <button
                onClick={() => toggleViewMode("showBranches")}
                className={`flex items-center gap-2 px-2 py-1 rounded text-sm ${
                  viewMode.showBranches
                    ? "bg-orange-600 text-white"
                    : "bg-gray-700 text-gray-400"
                }`}
              >
                {viewMode.showBranches ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
                Branch Lines
              </button>
            </div>
          </div>

          {/* Camera Controls */}
          <div className="bg-gray-900/90 rounded-lg p-3 backdrop-blur-sm">
            <button
              onClick={resetCamera}
              className="flex items-center gap-2 px-2 py-1 bg-gray-700 text-white rounded text-sm hover:bg-gray-600"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Camera
            </button>
          </div>
        </div>

        {/* Stats Overlay */}
        {stats && (
          <div className="absolute top-4 right-4 bg-gray-900/90 rounded-lg p-3 backdrop-blur-sm">
            <h3 className="text-sm font-semibold text-white mb-2">
              Statistics
            </h3>
            <div className="text-xs text-gray-300 space-y-1">
              <div>
                Total Leaves:{" "}
                <span className="text-green-400">
                  {stats.totalLeaves.toLocaleString()}
                </span>
              </div>
              <div>
                Stems:{" "}
                <span className="text-orange-400">{stats.stemCount}</span>
              </div>
              <div>
                Clusters:{" "}
                <span className="text-teal-400">{stats.clusterCount}</span>
              </div>
              <div>
                Avg Leaves/Cluster:{" "}
                <span className="text-yellow-400">
                  {stats.avgLeavesPerCluster.toFixed(1)}
                </span>
              </div>
              <div>
                Leaves Culled:{" "}
                <span className="text-red-400">{stats.leavesCulled}</span>
              </div>
              <div>
                Reduction:{" "}
                <span className="text-purple-400">
                  {stats.reductionRatio.toFixed(1)}x
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-gray-900/90 rounded-lg p-3 backdrop-blur-sm">
          <h3 className="text-xs font-semibold text-white mb-2">
            Cluster Colors by Depth
          </h3>
          <div className="flex gap-2">
            <div className="flex items-center gap-1 text-xs">
              <div className="w-3 h-3 rounded bg-red-400"></div>
              <span className="text-gray-400">D0</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <div className="w-3 h-3 rounded bg-teal-400"></div>
              <span className="text-gray-400">D1</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <div className="w-3 h-3 rounded bg-yellow-400"></div>
              <span className="text-gray-400">D2</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <div className="w-3 h-3 rounded bg-green-400"></div>
              <span className="text-gray-400">D3+</span>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      <div className="w-80 bg-gray-900 border-l border-gray-800 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Sliders className="w-5 h-5" />
            Cluster Settings
          </h3>

          {/* Texture Size */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1">
              Texture Size (per cluster)
            </label>
            <select
              value={settings.textureSize}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  textureSize: parseInt(e.target.value),
                }))
              }
              className="w-full bg-gray-800 text-white text-sm rounded px-2 py-1 border border-gray-700"
            >
              <option value={64}>64x64 (Low)</option>
              <option value={128}>128x128 (Medium)</option>
              <option value={256}>256x256 (High)</option>
              <option value={512}>512x512 (Ultra)</option>
            </select>
          </div>

          {/* Min Stem Depth */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1">
              Min Branch Depth: {settings.minStemDepth}
            </label>
            <input
              type="range"
              min={0}
              max={3}
              value={settings.minStemDepth}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  minStemDepth: parseInt(e.target.value),
                }))
              }
              className="w-full"
            />
            <div className="text-xs text-gray-500 mt-1">
              0 = include trunk, 1+ = branches only
            </div>
          </div>

          {/* Min Leaves Per Cluster */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1">
              Min Leaves/Cluster: {settings.minLeavesPerCluster}
            </label>
            <input
              type="range"
              min={1}
              max={15}
              value={settings.minLeavesPerCluster}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  minLeavesPerCluster: parseInt(e.target.value),
                }))
              }
              className="w-full"
            />
          </div>

          {/* Max Leaves Per Cluster */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1">
              Max Leaves/Cluster: {settings.maxLeavesPerCluster}
            </label>
            <input
              type="range"
              min={15}
              max={100}
              value={settings.maxLeavesPerCluster}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  maxLeavesPerCluster: parseInt(e.target.value),
                }))
              }
              className="w-full"
            />
          </div>

          {/* Target Cluster Count */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1">
              Target Clusters: {settings.targetClusterCount}
            </label>
            <input
              type="range"
              min={20}
              max={200}
              value={settings.targetClusterCount}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  targetClusterCount: parseInt(e.target.value),
                }))
              }
              className="w-full"
            />
          </div>

          <hr className="border-gray-700 my-4" />

          {/* Overlap Culling Section */}
          <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <Scissors className="w-4 h-4" />
            Overlap Culling
          </h4>

          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.cullOverlapping}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    cullOverlapping: e.target.checked,
                  }))
                }
                className="rounded bg-gray-800 border-gray-700"
              />
              Enable Overlap Culling
            </label>
            <div className="text-xs text-gray-500 mt-1">
              Removes leaves that overlap in screen space
            </div>
          </div>

          {settings.cullOverlapping && (
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">
                Overlap Threshold: {settings.overlapThreshold.toFixed(2)}
              </label>
              <input
                type="range"
                min={0.1}
                max={0.8}
                step={0.05}
                value={settings.overlapThreshold}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    overlapThreshold: parseFloat(e.target.value),
                  }))
                }
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">
                Lower = more aggressive culling
              </div>
            </div>
          )}

          <hr className="border-gray-700 my-4" />

          {/* Cluster List */}
          <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Clusters ({clusterResult?.clusters.length || 0})
          </h4>

          <div className="max-h-64 overflow-y-auto bg-gray-800 rounded p-2">
            {clusterResult?.clusters.map((cluster, idx) => (
              <div
                key={cluster.id}
                className={`text-xs p-2 rounded mb-1 cursor-pointer ${
                  viewMode.selectedCluster === idx
                    ? "bg-teal-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
                onClick={() => {
                  setViewMode((prev) => ({ ...prev, selectedCluster: idx }));
                  // Focus camera on this cluster
                  if (cameraRef.current && controlsRef.current) {
                    controlsRef.current.target.copy(cluster.center);
                    controlsRef.current.update();
                  }
                }}
              >
                <div className="font-medium flex items-center gap-1">
                  <GitBranch className="w-3 h-3" />
                  Cluster {cluster.id} (D{cluster.stemDepth})
                </div>
                <div className="text-gray-400">
                  {cluster.leafIndices.length} leaves •{" "}
                  {cluster.width.toFixed(2)}x{cluster.height.toFixed(2)}m
                  {cluster.overlapCulled && (
                    <span className="text-red-400 ml-1">✂</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <hr className="border-gray-700 my-4" />

          {/* Info Panel */}
          <div className="bg-gray-800 rounded p-3">
            <h4 className="text-sm font-semibold text-teal-400 mb-2">
              SpeedTree Approach
            </h4>
            <p className="text-xs text-gray-400">
              This generator clusters leaves by their{" "}
              <strong>parent branch</strong>, creating more natural groupings
              than pure spatial clustering.
            </p>
            <ul className="text-xs text-gray-400 mt-2 list-disc list-inside space-y-1">
              <li>Groups leaves by stem hierarchy</li>
              <li>Billboard oriented perpendicular to branch</li>
              <li>Screen-space overlap culling</li>
              <li>Merges small clusters, splits large ones</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeafClusterPage;
