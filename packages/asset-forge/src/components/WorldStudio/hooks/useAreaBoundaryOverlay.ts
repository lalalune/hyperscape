/**
 * useAreaBoundaryOverlay — Renders boundary visualizations in the 3D viewport
 * for difficulty zones, town areas, and biome regions.
 *
 * Item D-21: "World area boundaries — polygon visualization"
 *
 * Overlays are toggled via WorldStudioState.overlays:
 * - difficultyOverlay  → rectangular zone outlines colored by difficulty level
 * - biomeOverlay       → circle outlines + semi-transparent fill per biome
 * - Town boundaries are always rendered when any overlay is active
 *
 * Pattern follows useBrushOverlaySync.ts: a single THREE.Group attached to
 * sceneRefs.scene, rebuilt when relevant state changes.
 */

import * as THREE from "three/webgpu";
import { useEffect, useRef } from "react";

import type { TerrainSceneRefs } from "../../WorldBuilder/TileBasedTerrain";
import { useWorldStudio } from "../WorldStudioContext";
import type { PlacedDangerSource, WildernessBoundary } from "../types";
import {
  deferredDisposeGroup,
  stageAddition,
  cancelStagedAdditions,
} from "../utils/deferredGpuDisposal";
import {
  getTerrainHeightAt,
  getWaterLevel,
} from "../utils/terrainQueryRegistry";

// ============== CONSTANTS ==============

/** Difficulty zone colors indexed by difficulty level (0–4). */
const DIFFICULTY_COLORS = [
  0x22c55e, // 0 - safe (green)
  0x3b82f6, // 1 - novice (blue)
  0xf59e0b, // 2 - intermediate (amber)
  0xef4444, // 3 - advanced (red)
  0xa855f7, // 4 - expert (purple)
];

/** Town boundary color — warm yellow. */
const TOWN_BOUNDARY_COLOR = 0xfbbf24;

/** Safe zone fill color — bright green. */
const SAFE_ZONE_COLOR = 0x22c55e;

/** Falloff boundary color — orange/amber. */
const FALLOFF_BOUNDARY_COLOR = 0xf59e0b;

/** Town radius defaults by size category (meters). */
const TOWN_RADIUS_DEFAULTS: Record<string, number> = {
  hamlet: 50,
  village: 100,
  town: 150,
};

/** Safe zone radius defaults by town size (meters). Matches game manifest export. */
const SAFE_ZONE_RADIUS_DEFAULTS: Record<string, number> = {
  hamlet: 40,
  village: 60,
  town: 80,
};

/** Falloff distance from safe zone edge (meters). Matches TerrainSystem constant. */
const TOWN_FALLOFF_RADIUS = 300;

/** Height offset so lines sit slightly above the terrain surface. */
const LINE_Y = 0.5;

// ============== GEOMETRY HELPERS ==============

function createCircleGeometry(
  radius: number,
  segments: number = 64,
): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    points.push(
      new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius),
    );
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

function createRectGeometry(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): THREE.BufferGeometry {
  const points = [
    new THREE.Vector3(minX, 0, minZ),
    new THREE.Vector3(maxX, 0, minZ),
    new THREE.Vector3(maxX, 0, maxZ),
    new THREE.Vector3(minX, 0, maxZ),
    new THREE.Vector3(minX, 0, minZ), // close loop
  ];
  return new THREE.BufferGeometry().setFromPoints(points);
}

// ============== LABEL SPRITE ==============

/**
 * Creates a small text sprite used as a zone label.
 * Renders the text into an offscreen canvas and maps it onto a SpriteMaterial.
 */
function createLabelSprite(text: string, color: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = 256;
  canvas.height = 64;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background pill
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  const pad = 8;
  ctx.beginPath();
  ctx.roundRect(pad, pad, canvas.width - pad * 2, canvas.height - pad * 2, 8);
  ctx.fill();

  // Text
  const hexStr = `#${color.toString(16).padStart(6, "0")}`;
  ctx.fillStyle = hexStr;
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(12, 3, 1);
  sprite.renderOrder = 998;

  return sprite;
}

// ============== BUILD FUNCTIONS ==============

function buildDifficultyOverlay(
  group: THREE.Group,
  difficultyZones: ReadonlyArray<{
    id: string;
    name: string;
    difficultyLevel: number;
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  }>,
): void {
  for (const zone of difficultyZones) {
    const color =
      DIFFICULTY_COLORS[
        Math.min(zone.difficultyLevel, DIFFICULTY_COLORS.length - 1)
      ] ?? DIFFICULTY_COLORS[0];

    // Rectangle outline
    const geo = createRectGeometry(
      zone.bounds.minX,
      zone.bounds.maxX,
      zone.bounds.minZ,
      zone.bounds.maxZ,
    );
    const mat = new THREE.LineBasicMaterial({
      color,
      depthWrite: false,
      depthTest: true,
      transparent: true,
      opacity: 0.85,
    });
    const line = new THREE.Line(geo, mat);
    line.position.y = LINE_Y;
    line.renderOrder = 998;
    line.name = `difficulty-zone-${zone.id}`;
    group.add(line);

    // Label sprite at center
    const cx = (zone.bounds.minX + zone.bounds.maxX) / 2;
    const cz = (zone.bounds.minZ + zone.bounds.maxZ) / 2;
    const label = createLabelSprite(zone.name, color);
    label.position.set(cx, LINE_Y + 5, cz);
    label.name = `difficulty-label-${zone.id}`;
    group.add(label);
  }
}

function buildTownBoundaryOverlay(
  group: THREE.Group,
  towns: ReadonlyArray<{
    id: string;
    name: string;
    size: string;
    position: { x: number; y: number; z: number };
    buildingIds: string[];
  }>,
  buildings: ReadonlyArray<{
    id: string;
    position: { x: number; y: number; z: number };
  }>,
  townOverrides?: ReadonlyMap<string, { safeZoneRadiusOverride?: number }>,
): void {
  // Index buildings by id for quick lookup
  const buildingMap = new Map<string, { x: number; y: number; z: number }>();
  for (const b of buildings) {
    buildingMap.set(b.id, b.position);
  }

  for (const town of towns) {
    const px = town.position.x;
    const pz = town.position.z;

    // Compute town extent from building spread
    let extentRadius = TOWN_RADIUS_DEFAULTS[town.size] ?? 75;
    if (town.buildingIds.length > 0) {
      let maxDist = 0;
      for (const bid of town.buildingIds) {
        const bpos = buildingMap.get(bid);
        if (!bpos) continue;
        const dx = bpos.x - px;
        const dz = bpos.z - pz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > maxDist) maxDist = dist;
      }
      if (maxDist > 0) extentRadius = maxDist + 15;
    }

    // Safe zone radius (from override or size default)
    const override = townOverrides?.get(town.id);
    const safeZoneRadius =
      override?.safeZoneRadiusOverride ??
      SAFE_ZONE_RADIUS_DEFAULTS[town.size] ??
      60;

    // Falloff outer boundary
    const falloffRadius = safeZoneRadius + TOWN_FALLOFF_RADIUS;

    // 1) Safe zone — semi-transparent green filled circle
    const safeGeo = new THREE.CircleGeometry(safeZoneRadius, 64);
    safeGeo.rotateX(-Math.PI / 2);
    const safeMat = new THREE.MeshBasicMaterial({
      color: SAFE_ZONE_COLOR,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    const safeFill = new THREE.Mesh(safeGeo, safeMat);
    safeFill.position.set(px, LINE_Y, pz);
    safeFill.renderOrder = 997;
    safeFill.name = `town-safe-fill-${town.id}`;
    safeFill.raycast = () => {};
    group.add(safeFill);

    // Safe zone outline — solid green
    const safeOutlineGeo = createCircleGeometry(safeZoneRadius);
    const safeOutlineMat = new THREE.LineBasicMaterial({
      color: SAFE_ZONE_COLOR,
      depthWrite: false,
      depthTest: true,
      transparent: true,
      opacity: 0.6,
    });
    const safeOutline = new THREE.Line(safeOutlineGeo, safeOutlineMat);
    safeOutline.position.set(px, LINE_Y, pz);
    safeOutline.renderOrder = 998;
    safeOutline.name = `town-safe-outline-${town.id}`;
    group.add(safeOutline);

    // 2) Town extent — dashed yellow circle (existing behavior)
    const circleGeo = createCircleGeometry(extentRadius);
    const dashMat = new THREE.LineDashedMaterial({
      color: TOWN_BOUNDARY_COLOR,
      dashSize: 4,
      gapSize: 2,
      depthWrite: false,
      depthTest: true,
      transparent: true,
      opacity: 0.8,
    });
    const circle = new THREE.Line(circleGeo, dashMat);
    circle.computeLineDistances();
    circle.position.set(px, LINE_Y, pz);
    circle.renderOrder = 998;
    circle.name = `town-boundary-${town.id}`;
    group.add(circle);

    // 3) Falloff outer boundary — dashed orange circle
    const falloffGeo = createCircleGeometry(falloffRadius);
    const falloffMat = new THREE.LineDashedMaterial({
      color: FALLOFF_BOUNDARY_COLOR,
      dashSize: 6,
      gapSize: 4,
      depthWrite: false,
      depthTest: true,
      transparent: true,
      opacity: 0.35,
    });
    const falloffLine = new THREE.Line(falloffGeo, falloffMat);
    falloffLine.computeLineDistances();
    falloffLine.position.set(px, LINE_Y, pz);
    falloffLine.renderOrder = 998;
    falloffLine.name = `town-falloff-${town.id}`;
    group.add(falloffLine);

    // Label
    const label = createLabelSprite(town.name, TOWN_BOUNDARY_COLOR);
    label.position.set(px, LINE_Y + 5, pz);
    label.name = `town-label-${town.id}`;
    group.add(label);
  }
}

function buildBiomeOverlay(
  group: THREE.Group,
  biomes: ReadonlyArray<{
    id: string;
    type: string;
    center: { x: number; y: number; z: number };
    influenceRadius: number;
    color: number;
  }>,
): void {
  for (const biome of biomes) {
    const biomeColor = biome.color;

    // Semi-transparent filled circle
    const fillGeo = new THREE.CircleGeometry(biome.influenceRadius, 64);
    fillGeo.rotateX(-Math.PI / 2);
    const fillMat = new THREE.MeshBasicMaterial({
      color: biomeColor,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    const fillMesh = new THREE.Mesh(fillGeo, fillMat);
    fillMesh.position.set(biome.center.x, LINE_Y, biome.center.z);
    fillMesh.renderOrder = 998;
    fillMesh.name = `biome-fill-${biome.id}`;
    group.add(fillMesh);

    // Wire outline ring
    const ringGeo = createCircleGeometry(biome.influenceRadius);
    const ringMat = new THREE.LineBasicMaterial({
      color: biomeColor,
      depthWrite: false,
      depthTest: true,
      transparent: true,
      opacity: 0.6,
    });
    const ring = new THREE.Line(ringGeo, ringMat);
    ring.position.set(biome.center.x, LINE_Y, biome.center.z);
    ring.renderOrder = 998;
    ring.name = `biome-ring-${biome.id}`;
    group.add(ring);
  }
}

// ============== DANGER SOURCE OVERLAY ==============

/** Danger source color — red with varying opacity by intensity. */
const DANGER_SOURCE_COLOR = 0xe54545;

function buildDangerSourceOverlay(
  group: THREE.Group,
  dangerSources: ReadonlyArray<PlacedDangerSource>,
): void {
  for (const ds of dangerSources) {
    const px = ds.position.x;
    const pz = ds.position.z;

    // Semi-transparent red filled circle (opacity scales with intensity)
    const fillGeo = new THREE.CircleGeometry(ds.radius, 48);
    fillGeo.rotateX(-Math.PI / 2);
    const fillMat = new THREE.MeshBasicMaterial({
      color: DANGER_SOURCE_COLOR,
      transparent: true,
      opacity: Math.min(0.2, 0.05 + ds.intensity * 0.05),
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    const fillMesh = new THREE.Mesh(fillGeo, fillMat);
    fillMesh.position.set(px, LINE_Y, pz);
    fillMesh.renderOrder = 997;
    fillMesh.name = `danger-fill-${ds.id}`;
    fillMesh.raycast = () => {};
    group.add(fillMesh);

    // Dashed red outline
    const outlineGeo = createCircleGeometry(ds.radius);
    const outlineMat = new THREE.LineDashedMaterial({
      color: DANGER_SOURCE_COLOR,
      dashSize: 3,
      gapSize: 2,
      depthWrite: false,
      depthTest: true,
      transparent: true,
      opacity: 0.6,
    });
    const outline = new THREE.Line(outlineGeo, outlineMat);
    outline.computeLineDistances();
    outline.position.set(px, LINE_Y, pz);
    outline.renderOrder = 998;
    outline.name = `danger-outline-${ds.id}`;
    group.add(outline);

    // Center marker (small diamond/dot)
    const dotGeo = new THREE.CircleGeometry(2, 8);
    dotGeo.rotateX(-Math.PI / 2);
    const dotMat = new THREE.MeshBasicMaterial({
      color: DANGER_SOURCE_COLOR,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(px, LINE_Y + 0.1, pz);
    dot.renderOrder = 999;
    dot.name = `danger-dot-${ds.id}`;
    group.add(dot);

    // Label
    const label = createLabelSprite(ds.name, DANGER_SOURCE_COLOR);
    label.position.set(px, LINE_Y + 5, pz);
    label.name = `danger-label-${ds.id}`;
    group.add(label);
  }
}

// ============== WILDERNESS BOUNDARY OVERLAY ==============

const WILDERNESS_COLOR = 0xd45b5b;

function buildWildernessBoundaryOverlay(
  group: THREE.Group,
  boundary: WildernessBoundary,
): void {
  if (boundary.points.length < 2) return;

  // Per-vertex terrain elevation. Without this the boundary
  // line floats at LINE_Y (0.5) — far below default water
  // level (~y=8) — so on Hyperia-style worlds the line was
  // INVISIBLE underwater on most coastal terrain. We sample
  // the active terrain querier per point and lift each vertex
  // a small fixed margin above ground OR water surface,
  // whichever is higher, so the line is always visible
  // following the actual contour.
  //
  // When the querier isn't registered yet (early load), we
  // fall back to the legacy LINE_Y so the boundary still
  // renders at SOMETHING. The next render pass after
  // terrain-ready picks up real elevations.
  const waterLevel = getWaterLevel();
  const liftPoint = (p: { x: number; z: number }): number => {
    const terrainY = getTerrainHeightAt(p.x, p.z);
    if (terrainY === null) return LINE_Y;
    const surfaceY =
      waterLevel !== null && waterLevel > terrainY ? waterLevel : terrainY;
    return surfaceY + 1.5; // small lift so the line floats above the surface
  };

  // Main boundary line — thick red
  const points = boundary.points.map(
    (p) => new THREE.Vector3(p.x, liftPoint(p), p.z),
  );
  const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
  const lineMat = new THREE.LineBasicMaterial({
    color: WILDERNESS_COLOR,
    depthWrite: false,
    depthTest: true,
    transparent: true,
    opacity: 0.8,
    linewidth: 2,
  });
  const line = new THREE.Line(lineGeo, lineMat);
  line.renderOrder = 998;
  line.name = "wilderness-boundary-line";
  group.add(line);

  // Vertex markers
  for (let i = 0; i < boundary.points.length; i++) {
    const p = boundary.points[i];
    const dotGeo = new THREE.CircleGeometry(3, 8);
    dotGeo.rotateX(-Math.PI / 2);
    const dotMat = new THREE.MeshBasicMaterial({
      color: WILDERNESS_COLOR,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(p.x, liftPoint(p) + 0.1, p.z);
    dot.renderOrder = 999;
    dot.name = `wilderness-vertex-${i}`;
    group.add(dot);
  }

  // Label at midpoint — lifted above terrain (or water) so it
  // floats clearly visible above the contour.
  const mid = boundary.points[Math.floor(boundary.points.length / 2)];
  const label = createLabelSprite(
    `Wilderness (Lv ${boundary.maxLevel})`,
    WILDERNESS_COLOR,
  );
  label.position.set(mid.x, liftPoint(mid) + 8, mid.z);
  label.name = "wilderness-boundary-label";
  group.add(label);
}

// ============== HOOK ==============

export function useAreaBoundaryOverlay(
  sceneRefs: TerrainSceneRefs | null,
): void {
  const { state } = useWorldStudio();
  const overlayGroup = useRef<THREE.Group | null>(null);
  const sceneRefsRef = useRef(sceneRefs);
  sceneRefsRef.current = sceneRefs;

  // Derive data from state
  const world = state.builder.editing.world;
  const difficultyOverlay = state.overlays.difficultyOverlay;
  const biomeOverlay = state.overlays.biomeOverlay;

  // Extended layers for danger sources + wilderness
  const dangerSources = state.extendedLayers.dangerSources;
  const wildernessBoundary = state.extendedLayers.wildernessBoundary;

  // Any overlay active means we also show town boundaries + danger sources
  const anyOverlayActive = difficultyOverlay || biomeOverlay;

  const difficultyZones = world?.layers.difficultyZones;
  const towns = world?.foundation.towns;
  const buildings = world?.foundation.buildings;
  const biomes = world?.foundation.biomes;
  const townOverrides = world?.layers.townOverrides;

  useEffect(() => {
    if (!sceneRefs) return;

    // Tear down previous group — cancel any pending staged additions first
    if (overlayGroup.current) {
      cancelStagedAdditions(overlayGroup.current);
      sceneRefs.scene.remove(overlayGroup.current);
      deferredDisposeGroup(overlayGroup.current);
      overlayGroup.current = null;
    }

    // Nothing to render if no overlay is active or no world data
    if (!anyOverlayActive || !world) return;

    // Build all children into a temporary group, then stage them into the
    // real group in batches — prevents bulk GPU buffer creation in one frame.
    const tmpGroup = new THREE.Group();

    // Difficulty zones
    if (difficultyOverlay && difficultyZones && difficultyZones.length > 0) {
      buildDifficultyOverlay(tmpGroup, difficultyZones);
    }

    // Town boundaries (always shown when any overlay is active)
    if (towns && towns.length > 0) {
      buildTownBoundaryOverlay(tmpGroup, towns, buildings ?? [], townOverrides);
    }

    // Danger sources (shown when difficulty overlay is active)
    if (difficultyOverlay && dangerSources.length > 0) {
      buildDangerSourceOverlay(tmpGroup, dangerSources);
    }

    // Wilderness boundary (shown when difficulty overlay is active)
    if (difficultyOverlay && wildernessBoundary) {
      buildWildernessBoundaryOverlay(tmpGroup, wildernessBoundary);
    }

    // Biome regions
    if (biomeOverlay && biomes && biomes.length > 0) {
      buildBiomeOverlay(tmpGroup, biomes);
    }

    // Add empty group to scene, then stage children in batches
    const group = new THREE.Group();
    group.name = "area-boundary-overlay";
    group.renderOrder = 998;
    sceneRefs.scene.add(group);
    overlayGroup.current = group;

    // Collect children from tmpGroup and stage them
    const children = [...tmpGroup.children];
    tmpGroup.clear(); // detach from tmpGroup (no GPU cost)
    for (const child of children) {
      stageAddition(child, group);
    }
  }, [
    sceneRefs,
    anyOverlayActive,
    difficultyOverlay,
    biomeOverlay,
    difficultyZones,
    towns,
    buildings,
    biomes,
    townOverrides,
    dangerSources,
    wildernessBoundary,
    world,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const refs = sceneRefsRef.current;
      const group = overlayGroup.current;
      if (refs && group) {
        refs.scene.remove(group);
        deferredDisposeGroup(group);
      }
    };
  }, []);
}
