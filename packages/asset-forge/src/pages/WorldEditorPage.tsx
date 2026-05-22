/**
 * WorldEditorPage.tsx - World Editor using Real Shared Engine Systems
 *
 * This page uses the EditorWorld factory which runs the actual game systems:
 * - TerrainSystem: Real heightmap terrain with biomes
 * - VegetationSystem: Real tree, plant, rock instancing
 * - ProceduralGrassSystem: Real GPU grass
 * - TownSystem: Real town generation
 * - RoadNetworkSystem: Real road generation
 * - BuildingRenderingSystem: Real building rendering
 *
 * What you see here is EXACTLY what renders in-game - no translation or duplication.
 *
 * Key Features:
 * - WYSIWYG editing: Changes apply to the same systems used in-game
 * - Full camera controls: Orbit, pan, fly modes
 * - Object selection: Click to select trees, buildings, etc.
 * - Transform gizmos: Move, rotate, scale selected objects
 *
 * @module WorldEditorPage
 */

import {
  Building2,
  Camera,
  Eye,
  EyeOff,
  Grid3x3,
  Maximize,
  Moon,
  Mountain,
  Move,
  RefreshCw,
  RotateCw,
  Route,
  Settings,
  Sprout, // Using Sprout for grass (no Grass icon in lucide)
  Sun,
  TreePine,
} from "lucide-react";
import React, { useRef, useState, useCallback, useEffect } from "react";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/common";
import {
  EditorWorldProvider,
  useEditorWorld,
  useEditorCamera,
  useEditorSelection,
  useEditorGizmo,
  useTerrain,
  useVegetation,
  useGrass,
  useTowns,
  useRoads,
  useBuildings,
  useEnvironment,
} from "@/context/EditorWorldContext";

// ============================================================================
// EDITOR TOOLBAR
// ============================================================================

interface EditorToolbarProps {
  onCameraModeChange: (mode: "orbit" | "pan" | "fly") => void;
  cameraMode: "orbit" | "pan" | "fly";
  onTransformModeChange: (mode: "translate" | "rotate" | "scale") => void;
  transformMode: "translate" | "rotate" | "scale";
  onSnapToggle: () => void;
  snapEnabled: boolean;
}

function EditorToolbar({
  onCameraModeChange,
  cameraMode,
  onTransformModeChange,
  transformMode,
  onSnapToggle,
  snapEnabled,
}: EditorToolbarProps) {
  return (
    <div className="flex items-center gap-2 p-2 bg-bg-secondary border-b border-border-primary">
      {/* Camera Mode */}
      <div className="flex items-center gap-1 mr-4">
        <span className="text-xs text-text-secondary mr-2">Camera:</span>
        <Button
          size="sm"
          variant={cameraMode === "orbit" ? "primary" : "ghost"}
          onClick={() => onCameraModeChange("orbit")}
          title="Orbit Mode (1)"
        >
          <Camera className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant={cameraMode === "pan" ? "primary" : "ghost"}
          onClick={() => onCameraModeChange("pan")}
          title="Pan Mode (2)"
        >
          <Move className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant={cameraMode === "fly" ? "primary" : "ghost"}
          onClick={() => onCameraModeChange("fly")}
          title="Fly Mode (3) - WASD to move"
        >
          <Grid3x3 className="w-4 h-4" />
        </Button>
      </div>

      {/* Transform Mode */}
      <div className="flex items-center gap-1 mr-4">
        <span className="text-xs text-text-secondary mr-2">Transform:</span>
        <Button
          size="sm"
          variant={transformMode === "translate" ? "primary" : "ghost"}
          onClick={() => onTransformModeChange("translate")}
          title="Move (W)"
        >
          <Move className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant={transformMode === "rotate" ? "primary" : "ghost"}
          onClick={() => onTransformModeChange("rotate")}
          title="Rotate (E)"
        >
          <RotateCw className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant={transformMode === "scale" ? "primary" : "ghost"}
          onClick={() => onTransformModeChange("scale")}
          title="Scale (R)"
        >
          <Maximize className="w-4 h-4" />
        </Button>
      </div>

      {/* Snap Toggle */}
      <Button
        size="sm"
        variant={snapEnabled ? "primary" : "ghost"}
        onClick={onSnapToggle}
        title="Toggle Snap (X)"
      >
        <Grid3x3 className="w-4 h-4 mr-1" />
        Snap
      </Button>
    </div>
  );
}

// ============================================================================
// SYSTEM PANEL
// ============================================================================

interface SystemPanelProps {
  systemName: string;
  icon: React.ReactNode;
  enabled: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

function SystemPanel({
  systemName,
  icon,
  enabled,
  onToggle,
  children,
}: SystemPanelProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card className="bg-bg-secondary border-border-primary">
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <button
            className="flex items-center gap-2 text-sm font-medium text-white hover:text-primary"
            onClick={() => setExpanded(!expanded)}
          >
            {icon}
            {systemName}
          </button>
          <Button size="sm" variant="ghost" onClick={onToggle}>
            {enabled ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      {expanded && children && (
        <CardContent className="py-2 px-3 border-t border-border-primary">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

// ============================================================================
// EDITOR CONTROLS PANEL
// ============================================================================

function EditorControlsPanel() {
  const world = useEditorWorld();
  const terrain = useTerrain();
  const _vegetation = useVegetation(); // Will be used for vegetation controls
  const grass = useGrass();
  const towns = useTowns();
  const _roads = useRoads(); // Will be used for road editing
  const _buildings = useBuildings(); // Will be used for building editing
  const environment = useEnvironment();

  const [terrainEnabled, setTerrainEnabled] = useState(true);
  const [vegetationEnabled, setVegetationEnabled] = useState(true);
  const [grassEnabled, setGrassEnabled] = useState(true);
  const [townsEnabled, setTownsEnabled] = useState(true);
  const [roadsEnabled, setRoadsEnabled] = useState(true);
  const [buildingsEnabled, setBuildingsEnabled] = useState(true);

  const [timeOfDay, setTimeOfDay] = useState(12);

  const handleTerrainRegenerate = useCallback(() => {
    if (terrain) {
      terrain.generate?.({});
    }
  }, [terrain]);

  const handleTimeOfDayChange = useCallback(
    (hour: number) => {
      setTimeOfDay(hour);
      if (environment) {
        environment.setTimeOfDay?.(hour);
      }
    },
    [environment],
  );

  if (!world) {
    return (
      <div className="p-4 text-center text-text-secondary">
        <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
        <p>Initializing editor...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-2 h-full overflow-y-auto">
      {/* Environment Controls */}
      <Card className="bg-bg-secondary border-border-primary">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-sm flex items-center gap-2">
            {timeOfDay >= 6 && timeOfDay < 18 ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
            Environment
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-3 border-t border-border-primary">
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-secondary w-20">
              Time of Day
            </label>
            <input
              type="range"
              min="0"
              max="24"
              step="0.5"
              value={timeOfDay}
              onChange={(e) =>
                handleTimeOfDayChange(parseFloat(e.target.value))
              }
              className="flex-1"
            />
            <span className="text-xs text-text-primary w-12 text-right">
              {Math.floor(timeOfDay)}:
              {String(Math.round((timeOfDay % 1) * 60)).padStart(2, "0")}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Terrain System */}
      <SystemPanel
        systemName="Terrain"
        icon={<Mountain className="w-4 h-4" />}
        enabled={terrainEnabled}
        onToggle={() => setTerrainEnabled(!terrainEnabled)}
      >
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleTerrainRegenerate}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Regenerate
          </Button>
          <p className="text-xs text-text-secondary">
            Using real TerrainSystem with streaming heightmap, biomes, and LOD.
          </p>
        </div>
      </SystemPanel>

      {/* Vegetation System */}
      <SystemPanel
        systemName="Vegetation"
        icon={<TreePine className="w-4 h-4" />}
        enabled={vegetationEnabled}
        onToggle={() => setVegetationEnabled(!vegetationEnabled)}
      >
        <p className="text-xs text-text-secondary">
          Real VegetationSystem with GPU instancing, LOD transitions, and
          impostor rendering.
        </p>
      </SystemPanel>

      {/* Grass System */}
      <SystemPanel
        systemName="Grass"
        icon={<Sprout className="w-4 h-4" />}
        enabled={grassEnabled}
        onToggle={() => {
          setGrassEnabled(!grassEnabled);
          grass?.setEnabled?.(!grassEnabled);
        }}
      >
        <p className="text-xs text-text-secondary">
          Real ProceduralGrassSystem with streaming heightmap and road
          avoidance.
        </p>
      </SystemPanel>

      {/* Towns System */}
      <SystemPanel
        systemName="Towns"
        icon={<Building2 className="w-4 h-4" />}
        enabled={townsEnabled}
        onToggle={() => setTownsEnabled(!townsEnabled)}
      >
        <div className="flex flex-col gap-2">
          <p className="text-xs text-text-secondary">
            Real TownSystem with flatness-based placement and building spawning.
          </p>
          {towns && (
            <p className="text-xs text-accent-aether">
              {towns.getTowns?.()?.length ?? 0} towns generated
            </p>
          )}
        </div>
      </SystemPanel>

      {/* Roads System */}
      <SystemPanel
        systemName="Roads"
        icon={<Route className="w-4 h-4" />}
        enabled={roadsEnabled}
        onToggle={() => setRoadsEnabled(!roadsEnabled)}
      >
        <p className="text-xs text-text-secondary">
          Real RoadNetworkSystem with A* pathfinding and terrain cost weighting.
        </p>
      </SystemPanel>

      {/* Buildings System */}
      <SystemPanel
        systemName="Buildings"
        icon={<Building2 className="w-4 h-4" />}
        enabled={buildingsEnabled}
        onToggle={() => setBuildingsEnabled(!buildingsEnabled)}
      >
        <p className="text-xs text-text-secondary">
          Real BuildingRenderingSystem with LOD, batching, and dynamic
          impostors.
        </p>
      </SystemPanel>
    </div>
  );
}

// ============================================================================
// MAIN EDITOR CANVAS
// ============================================================================

function EditorCanvas() {
  const world = useEditorWorld();
  const camera = useEditorCamera();
  const selection = useEditorSelection();
  const gizmo = useEditorGizmo();

  const [cameraMode, setCameraMode] = useState<"orbit" | "pan" | "fly">(
    "orbit",
  );
  const [transformMode, setTransformMode] = useState<
    "translate" | "rotate" | "scale"
  >("translate");
  const [snapEnabled, setSnapEnabled] = useState(false);

  // Update camera mode
  useEffect(() => {
    if (camera) {
      camera.setMode(cameraMode);
    }
  }, [camera, cameraMode]);

  // Update transform mode
  useEffect(() => {
    if (gizmo) {
      gizmo.setMode(transformMode);
    }
  }, [gizmo, transformMode]);

  // Update snap
  useEffect(() => {
    if (gizmo) {
      gizmo.setSnap(snapEnabled);
    }
  }, [gizmo, snapEnabled]);

  // Listen for camera mode changes from keyboard
  useEffect(() => {
    if (!camera) return;

    const handleModeChange = (event: { mode: string }) => {
      setCameraMode(event.mode as "orbit" | "pan" | "fly");
    };
    camera.on("mode-changed", handleModeChange);
    return () => {
      camera.off("mode-changed", handleModeChange);
    };
  }, [camera]);

  // Listen for gizmo mode changes from keyboard
  useEffect(() => {
    if (!gizmo) return;

    const handleModeChange = (event: { mode: string }) => {
      setTransformMode(event.mode as "translate" | "rotate" | "scale");
    };
    const handleSnapChange = (event: { enabled: boolean }) => {
      setSnapEnabled(event.enabled);
    };
    gizmo.on("mode-changed", handleModeChange);
    gizmo.on("snap-changed", handleSnapChange);
    return () => {
      gizmo.off("mode-changed", handleModeChange);
      gizmo.off("snap-changed", handleSnapChange);
    };
  }, [gizmo]);

  return (
    <div className="flex flex-col h-full">
      <EditorToolbar
        cameraMode={cameraMode}
        onCameraModeChange={setCameraMode}
        transformMode={transformMode}
        onTransformModeChange={setTransformMode}
        snapEnabled={snapEnabled}
        onSnapToggle={() => setSnapEnabled(!snapEnabled)}
      />

      {/* Status bar */}
      <div className="flex items-center justify-between px-2 py-1 bg-bg-secondary border-b border-border-primary text-xs text-text-secondary">
        <div className="flex items-center gap-4">
          <span>
            Camera: {cameraMode.charAt(0).toUpperCase() + cameraMode.slice(1)}
          </span>
          <span>
            Transform:{" "}
            {transformMode.charAt(0).toUpperCase() + transformMode.slice(1)}
          </span>
          {selection && <span>Selected: {selection.getSelectionCount()}</span>}
        </div>
        <div className="flex items-center gap-4">
          {world?.graphics?.renderer && (
            <span>
              {(world.graphics as { width?: number; height?: number }).width ??
                0}{" "}
              x{" "}
              {(world.graphics as { width?: number; height?: number }).height ??
                0}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// WORLD EDITOR PAGE
// ============================================================================

/**
 * Inner content that uses the EditorWorld context
 */
function WorldEditorContent() {
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 border-r border-border-primary bg-bg-secondary overflow-hidden flex flex-col">
        <EditorControlsPanel />
      </div>

      {/* Canvas and toolbar */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <EditorCanvas />
      </div>
    </div>
  );
}

export function WorldEditorPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerReady, setContainerReady] = useState(false);

  // Mark ready after first render when ref is attached
  useEffect(() => {
    if (containerRef.current) {
      setContainerReady(true);
    }
  }, []);

  return (
    <div className="h-[calc(100vh-44px)] flex flex-col bg-bg-secondary">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-bg-secondary border-b border-border-primary">
        <h1 className="font-display text-lg font-medium tracking-tight text-white flex items-center gap-2">
          <Mountain className="w-5 h-5" />
          World Editor
          <span className="text-xs text-accent-aether font-normal ml-2">
            (Using Real Game Systems)
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary">
            <Settings className="w-4 h-4 mr-1" />
            Settings
          </Button>
        </div>
      </header>

      {/* Canvas container - must exist before EditorWorldProvider */}
      <div className="flex-1 relative" ref={containerRef}>
        {containerReady && containerRef.current && (
          <EditorWorldProvider
            viewport={containerRef}
            options={{
              enableTerrain: true,
              enableVegetation: true,
              enableGrass: true,
              enableTowns: true,
              enableRoads: true,
              enableBuildings: true,
              cameraPosition: { x: 100, y: 80, z: 100 },
              cameraTarget: { x: 0, y: 0, z: 0 },
            }}
            initOptions={{
              assetsUrl: "/assets/",
            }}
          >
            <div className="absolute inset-0 flex flex-col">
              <WorldEditorContent />
            </div>
          </EditorWorldProvider>
        )}

        {/* Loading state */}
        {!containerReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-secondary">
            <div className="text-center text-text-secondary">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
              <p>Initializing WebGPU...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WorldEditorPage;
