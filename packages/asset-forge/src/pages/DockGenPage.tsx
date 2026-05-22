/**
 * DockGenPage
 * Procedural dock generation preview using DockGenerator layout data.
 *
 * Uses DockGenerator for layout computation (dimensions, posts, railings),
 * then builds its own simple mesh — matching how the game's ProceduralDocks
 * system builds world-space geometry from the layout.
 */

import {
  DockGenerator,
  DOCK_PRESETS,
  getDockPresetNames,
  DEFAULT_DOCK_PARAMS,
  mergeDockParams,
  DockStyle,
  type DockRecipe,
  type DockStyleValue,
  type DockLayout,
} from "@hyperforge/procgen/items/dock";
import { WoodType, type WoodTypeValue } from "@hyperforge/procgen/items";
import {
  Anchor,
  RefreshCw,
  Download,
  Settings2,
  Eye,
  Gauge,
} from "lucide-react";
import React, { useRef, useEffect, useState, useCallback } from "react";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { MeshStandardNodeMaterial } from "three/webgpu";

import {
  THREE,
  createWebGPURenderer,
  type HyperForgeRenderer,
} from "@/utils/webgpu-renderer";

// ============================================================================
// WOOD COLORS
// ============================================================================

const WOOD_COLORS: Record<string, number> = {
  weathered: 0x8c7a64,
  fresh: 0xb38d5c,
  dark: 0x5c4028,
  mossy: 0x736b5a,
};

const WOOD_TYPES: WoodTypeValue[] = [
  WoodType.Weathered,
  WoodType.Fresh,
  WoodType.Dark,
  WoodType.Mossy,
];

const DOCK_STYLE_OPTIONS: { label: string; value: DockStyleValue }[] = [
  { label: "Pier", value: DockStyle.Pier },
  { label: "T-Shaped", value: DockStyle.TShaped },
  { label: "L-Shaped", value: DockStyle.LShaped },
];

/** Mock shoreline point for standalone preview */
const MOCK_SHORELINE = {
  position: { x: 0, y: 0, z: 0 },
  landwardNormal: { x: 0, z: -1 },
  waterwardNormal: { x: 0, z: 1 },
  height: 0.5,
  slope: 0.1,
  distanceFromCenter: 10,
};

// Dock structural constants (exact values from ProceduralDocks.ts)
const DOCK_POST_CAP_OVERHANG = 0.05;
const DOCK_POST_CAP_HEIGHT = 0.06;
const DOCK_STRINGER_WIDTH = 0.16;
const DOCK_STRINGER_HEIGHT = 0.2;
const DOCK_JOIST_SPACING = 0.8;
const DOCK_JOIST_WIDTH = 0.1;
const DOCK_JOIST_HEIGHT = 0.14;
const DOCK_FENCE_POST_SIZE = 0.16;
const DOCK_FENCE_HEIGHT = 1.2;
const DOCK_FENCE_CAP_OVERHANG = 0.05;
const DOCK_FENCE_CAP_HEIGHT = 0.05;
const DOCK_FENCE_RAIL_HEIGHTS = [0.25, 0.6, 1.0];
const DOCK_FENCE_RAIL_SIZE = 0.06;
const DOCK_FENCE_POST_SPACING = 1.5;

// ============================================================================
// MESH BUILDING HELPERS (like ProceduralDocks world-space approach)
// ============================================================================

function buildOrientedRail(
  x0: number,
  z0: number,
  y0: number,
  x1: number,
  z1: number,
  y1: number,
  width: number,
  height: number,
  perpX: number,
  perpZ: number,
): THREE.BufferGeometry {
  const hw = width / 2;
  const hh = height / 2;
  const verts = new Float32Array([
    x0 + perpX * hw,
    y0 - hh,
    z0 + perpZ * hw,
    x0 - perpX * hw,
    y0 - hh,
    z0 - perpZ * hw,
    x0 + perpX * hw,
    y0 + hh,
    z0 + perpZ * hw,
    x0 - perpX * hw,
    y0 + hh,
    z0 - perpZ * hw,
    x1 + perpX * hw,
    y1 - hh,
    z1 + perpZ * hw,
    x1 - perpX * hw,
    y1 - hh,
    z1 - perpZ * hw,
    x1 + perpX * hw,
    y1 + hh,
    z1 + perpZ * hw,
    x1 - perpX * hw,
    y1 + hh,
    z1 - perpZ * hw,
  ]);
  const indices = new Uint16Array([
    2, 6, 3, 3, 6, 7, 0, 1, 4, 1, 5, 4, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5, 0,
    2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();
  return geo;
}

function buildDeckGeometry(
  sx: number,
  sz: number,
  deckY: number,
  dx: number,
  dz: number,
  px: number,
  pz: number,
  len: number,
  width: number,
): THREE.BufferGeometry {
  // Match in-game resolution: Math.ceil(length / 0.5) for fine mesh
  const lengthSteps = Math.max(4, Math.ceil(len / 0.5));
  const widthSteps = Math.max(2, Math.ceil(width));
  const stride = widthSteps + 1;

  const vertices: number[] = [];
  const norms: number[] = [];
  const indices: number[] = [];

  const topStart = vertices.length / 3;
  for (let s = 0; s <= lengthSteps; s++) {
    const t = s / lengthSteps;
    const cx = sx + dx * len * t;
    const cz = sz + dz * len * t;
    for (let w = 0; w <= widthSteps; w++) {
      const wt = (w / widthSteps - 0.5) * width;
      vertices.push(cx + px * wt, deckY, cz + pz * wt);
      norms.push(0, 1, 0);
    }
  }
  for (let s = 0; s < lengthSteps; s++) {
    for (let w = 0; w < widthSteps; w++) {
      const a = topStart + s * stride + w;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(norms, 3));
  geo.setIndex(indices);
  return geo;
}

function mergeGeometries(
  geometries: THREE.BufferGeometry[],
): THREE.BufferGeometry | null {
  const allVerts: number[] = [];
  const allNormals: number[] = [];
  const allIndices: number[] = [];
  let offset = 0;

  for (const geo of geometries) {
    const posAttr = geo.getAttribute("position");
    if (!posAttr) continue;
    for (let i = 0; i < posAttr.array.length; i++)
      allVerts.push(posAttr.array[i]);
    const normAttr = geo.getAttribute("normal");
    if (normAttr) {
      for (let i = 0; i < normAttr.array.length; i++)
        allNormals.push(normAttr.array[i]);
    } else {
      for (let i = 0; i < posAttr.count; i++) allNormals.push(0, 1, 0);
    }
    const index = geo.getIndex();
    if (index) {
      for (let i = 0; i < index.count; i++)
        allIndices.push(index.getX(i) + offset);
    }
    offset += posAttr.count;
  }

  if (allVerts.length === 0) return null;
  const merged = new THREE.BufferGeometry();
  merged.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(allVerts, 3),
  );
  merged.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(allNormals, 3),
  );
  merged.setIndex(allIndices);
  return merged;
}

/** Build a dock section mesh from layout data — exact port of ProceduralDocks.buildSection */
function buildDockSection(
  sx: number,
  sz: number,
  deckY: number,
  dx: number,
  dz: number,
  px: number,
  pz: number,
  sectionLen: number,
  sectionWidth: number,
  postSpacing: number,
  postRadius: number,
  waterFloorY: number,
): THREE.BufferGeometry[] {
  const hw = sectionWidth / 2;
  const geometries: THREE.BufferGeometry[] = [];

  // Deck surface
  const deckGeo = buildDeckGeometry(
    sx,
    sz,
    deckY,
    dx,
    dz,
    px,
    pz,
    sectionLen,
    sectionWidth,
  );
  geometries.push(deckGeo);

  // Side stringers (structural beams under deck edges)
  const stringerY = deckY - DOCK_STRINGER_HEIGHT / 2 - 0.03;
  for (const side of [-1, 1]) {
    geometries.push(
      buildOrientedRail(
        sx + px * hw * side,
        sz + pz * hw * side,
        stringerY,
        sx + dx * sectionLen + px * hw * side,
        sz + dz * sectionLen + pz * hw * side,
        stringerY,
        DOCK_STRINGER_WIDTH,
        DOCK_STRINGER_HEIGHT,
        px,
        pz,
      ),
    );
  }

  // Cross joists (transverse beams between stringers)
  const joistCount = Math.max(
    2,
    Math.floor(sectionLen / DOCK_JOIST_SPACING) + 1,
  );
  const inset = DOCK_STRINGER_WIDTH / 2;
  for (let j = 0; j < joistCount; j++) {
    const t = j / (joistCount - 1);
    const cx = sx + dx * sectionLen * t;
    const cz = sz + dz * sectionLen * t;
    const joistY = deckY - DOCK_JOIST_HEIGHT / 2 - 0.03;
    geometries.push(
      buildOrientedRail(
        cx + px * (hw - inset),
        cz + pz * (hw - inset),
        joistY,
        cx - px * (hw - inset),
        cz - pz * (hw - inset),
        joistY,
        DOCK_JOIST_WIDTH,
        DOCK_JOIST_HEIGHT,
        dx,
        dz,
      ),
    );
  }

  // Support posts (square, from water floor to deck underside — matching in-game BoxGeometry)
  const postCount = Math.max(2, Math.ceil(sectionLen / postSpacing) + 1);
  const postSize = postRadius * 2;
  const postInset = hw - postRadius * 2;
  for (let p = 0; p < postCount; p++) {
    const t = p / (postCount - 1);
    const cx = sx + dx * sectionLen * t;
    const cz = sz + dz * sectionLen * t;

    for (const side of [-1, 1]) {
      const postX = cx + px * postInset * side;
      const postZ = cz + pz * postInset * side;
      const postHeight = deckY - waterFloorY;
      if (postHeight < 0.2) continue;

      // Post shaft
      const postGeo = new THREE.BoxGeometry(postSize, postHeight, postSize);
      postGeo.translate(postX, waterFloorY + postHeight / 2, postZ);
      geometries.push(postGeo);

      // Post cap (wider, just under deck)
      const capSize = postSize + DOCK_POST_CAP_OVERHANG * 2;
      const capGeo = new THREE.BoxGeometry(
        capSize,
        DOCK_POST_CAP_HEIGHT,
        capSize,
      );
      capGeo.translate(postX, deckY - DOCK_POST_CAP_HEIGHT / 2, postZ);
      geometries.push(capGeo);
    }
  }

  return geometries;
}

/** Build fence posts + horizontal rails for one side — exact port of ProceduralDocks.buildFenceSide */
function buildFenceSide(
  geometries: THREE.BufferGeometry[],
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  deckY: number,
): void {
  const dx = endX - startX;
  const dz = endZ - startZ;
  const sideLen = Math.sqrt(dx * dx + dz * dz);
  if (sideLen < 0.5) return;

  const sdx = dx / sideLen;
  const sdz = dz / sideLen;
  const spx = -sdz;
  const spz = sdx;

  const postCount = Math.max(
    2,
    Math.floor(sideLen / DOCK_FENCE_POST_SPACING) + 1,
  );

  // Fence posts + caps
  for (let p = 0; p < postCount; p++) {
    const t = p / (postCount - 1);
    const fpx = startX + dx * t;
    const fpz = startZ + dz * t;

    const postGeo = new THREE.BoxGeometry(
      DOCK_FENCE_POST_SIZE,
      DOCK_FENCE_HEIGHT,
      DOCK_FENCE_POST_SIZE,
    );
    postGeo.translate(fpx, deckY + DOCK_FENCE_HEIGHT / 2, fpz);
    geometries.push(postGeo);

    const capSize = DOCK_FENCE_POST_SIZE + DOCK_FENCE_CAP_OVERHANG * 2;
    const capGeo = new THREE.BoxGeometry(
      capSize,
      DOCK_FENCE_CAP_HEIGHT,
      capSize,
    );
    capGeo.translate(
      fpx,
      deckY + DOCK_FENCE_HEIGHT + DOCK_FENCE_CAP_HEIGHT / 2,
      fpz,
    );
    geometries.push(capGeo);
  }

  // Horizontal rails connecting posts
  for (let p = 0; p < postCount - 1; p++) {
    const t0 = p / (postCount - 1);
    const t1 = (p + 1) / (postCount - 1);
    const px0 = startX + dx * t0;
    const pz0 = startZ + dz * t0;
    const px1 = startX + dx * t1;
    const pz1 = startZ + dz * t1;

    for (const railH of DOCK_FENCE_RAIL_HEIGHTS) {
      geometries.push(
        buildOrientedRail(
          px0,
          pz0,
          deckY + railH,
          px1,
          pz1,
          deckY + railH,
          DOCK_FENCE_RAIL_SIZE,
          DOCK_FENCE_RAIL_SIZE,
          spx,
          spz,
        ),
      );
    }
  }
}

/** Build fence on both sides of a dock section — port of ProceduralDocks.buildFenceForSection */
function buildFenceForSection(
  geometries: THREE.BufferGeometry[],
  sx: number,
  sz: number,
  dx: number,
  dz: number,
  px: number,
  pz: number,
  sectionLen: number,
  sectionWidth: number,
  deckY: number,
  includeEndRailing: boolean,
): void {
  const hw = sectionWidth / 2;

  // Left side
  buildFenceSide(
    geometries,
    sx + px * hw,
    sz + pz * hw,
    sx + dx * sectionLen + px * hw,
    sz + dz * sectionLen + pz * hw,
    deckY,
  );

  // Right side
  buildFenceSide(
    geometries,
    sx - px * hw,
    sz - pz * hw,
    sx + dx * sectionLen - px * hw,
    sz + dz * sectionLen - pz * hw,
    deckY,
  );

  // End railing (at water end)
  if (includeEndRailing) {
    buildFenceSide(
      geometries,
      sx + dx * sectionLen + px * hw,
      sz + dz * sectionLen + pz * hw,
      sx + dx * sectionLen - px * hw,
      sz + dz * sectionLen - pz * hw,
      deckY,
    );
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

const DockGenPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<HyperForgeRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const generatorRef = useRef<DockGenerator | null>(null);
  const currentGroupRef = useRef<THREE.Group | null>(null);
  const animationIdRef = useRef<number>(0);
  const fpsRef = useRef<number>(0);
  const frameTimesRef = useRef<number[]>([]);

  const [preset, setPreset] = useState("fishing");
  const [seed, setSeed] = useState("dock-001");
  const [dockStyle, setDockStyle] = useState<DockStyleValue>(DockStyle.Pier);
  const [woodType, setWoodType] = useState<WoodTypeValue>(WoodType.Weathered);
  const [length, setLength] = useState(6);
  const [width, setWidth] = useState(2.5);
  const [deckHeight, setDeckHeight] = useState(0.4);
  const [postSpacing, setPostSpacing] = useState(2.5);
  const [postRadius, setPostRadius] = useState(0.18);
  const [hasRailing, setHasRailing] = useState(false);
  const [railingHeight, setRailingHeight] = useState(0.9);
  const [hasMooring, setHasMooring] = useState(false);
  const [tSectionWidth, setTSectionWidth] = useState(6);
  const [lSectionLength, setLSectionLength] = useState(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stats, setStats] = useState<{
    vertices: number;
    triangles: number;
    time: number;
  } | null>(null);

  const applyPreset = useCallback((presetName: string) => {
    const presetData = DOCK_PRESETS[presetName];
    if (!presetData) return;
    const merged = mergeDockParams(DEFAULT_DOCK_PARAMS, presetData);
    setDockStyle(merged.style);
    setWoodType(merged.woodType);
    setLength(merged.lengthRange[0]);
    setWidth(merged.widthRange[0]);
    setDeckHeight(merged.deckHeight);
    setPostSpacing(merged.postSpacing);
    setPostRadius(merged.postRadius);
    setHasRailing(merged.hasRailing);
    setRailingHeight(merged.railingHeight);
    setHasMooring(merged.hasMooring);
    if (merged.tSectionWidthRange)
      setTSectionWidth(merged.tSectionWidthRange[0]);
    if (merged.lSectionLengthRange)
      setLSectionLength(merged.lSectionLengthRange[0]);
  }, []);

  const handlePresetChange = useCallback(
    (presetName: string) => {
      setPreset(presetName);
      applyPreset(presetName);
    },
    [applyPreset],
  );

  const removeOldDock = useCallback(() => {
    if (!sceneRef.current || !currentGroupRef.current) return;
    sceneRef.current.remove(currentGroupRef.current);
    currentGroupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) child.material.dispose();
      }
    });
    currentGroupRef.current = null;
  }, []);

  const generateDock = useCallback(() => {
    if (!sceneRef.current || !generatorRef.current) return;

    setIsGenerating(true);
    const startTime = performance.now();
    removeOldDock();

    try {
      const recipe: DockRecipe = {
        ...DEFAULT_DOCK_PARAMS,
        style: dockStyle,
        woodType,
        lengthRange: [length, length],
        widthRange: [width, width],
        deckHeight,
        postSpacing,
        postRadius,
        hasRailing,
        railingHeight,
        railingPostSpacing: 1.3,
        hasMooring,
        tSectionWidthRange:
          dockStyle === DockStyle.TShaped
            ? [tSectionWidth, tSectionWidth]
            : undefined,
        lSectionLengthRange:
          dockStyle === DockStyle.LShaped
            ? [lSectionLength, lSectionLength]
            : undefined,
        label: "Preview Dock",
      };

      // Generate layout only (skip built-in mesh — we build our own)
      const result = generatorRef.current.generate(recipe, MOCK_SHORELINE, {
        seed,
        waterLevel: 0,
        waterFloorDepth: 3,
        skipMesh: true,
      });

      const layout = result.layout;
      const {
        position,
        direction,
        length: dockLength,
        width: dockWidth,
      } = layout;
      const perpX = -direction.z;
      const perpZ = direction.x;
      const deckY = position.y; // waterLevel + deckHeight
      const waterFloorY = -3;

      // Build world-space mesh — exact port of ProceduralDocks.buildDockMeshWorldSpace
      const woodGeos: THREE.BufferGeometry[] = [];

      // Main section
      woodGeos.push(
        ...buildDockSection(
          position.x,
          position.z,
          deckY,
          direction.x,
          direction.z,
          perpX,
          perpZ,
          dockLength,
          dockWidth,
          postSpacing,
          postRadius,
          waterFloorY,
        ),
      );

      // Fence (if hasRailing)
      if (hasRailing) {
        const hasTSection = layout.tSection != null;
        const hasLSection = layout.lSection != null;

        buildFenceForSection(
          woodGeos,
          position.x,
          position.z,
          direction.x,
          direction.z,
          perpX,
          perpZ,
          dockLength,
          dockWidth,
          deckY,
          !(hasTSection || hasLSection), // skip end railing if T/L junction
        );
      }

      // T-section (perpendicular bar at dock end)
      if (layout.tSection) {
        const tWidth = layout.tSection.width;
        const halfTWidth = tWidth / 2;
        const endX = position.x + direction.x * dockLength;
        const endZ = position.z + direction.z * dockLength;

        // T-section runs perpendicular, centered at dock end
        const tStartX = endX - perpX * halfTWidth;
        const tStartZ = endZ - perpZ * halfTWidth;

        woodGeos.push(
          ...buildDockSection(
            tStartX,
            tStartZ,
            deckY,
            perpX,
            perpZ,
            -direction.x,
            -direction.z,
            tWidth,
            dockWidth,
            postSpacing,
            postRadius,
            waterFloorY,
          ),
        );

        // T-section fence (3 outer edges)
        if (hasRailing) {
          buildFenceForSection(
            woodGeos,
            tStartX,
            tStartZ,
            perpX,
            perpZ,
            -direction.x,
            -direction.z,
            tWidth,
            dockWidth,
            deckY,
            true, // both ends
          );
          // Front edge (outer, along main dock direction)
          buildFenceSide(
            woodGeos,
            endX + direction.x * (dockWidth / 2) - perpX * halfTWidth,
            endZ + direction.z * (dockWidth / 2) - perpZ * halfTWidth,
            endX + direction.x * (dockWidth / 2) + perpX * halfTWidth,
            endZ + direction.z * (dockWidth / 2) + perpZ * halfTWidth,
            deckY,
          );
        }
      }

      // L-section (90-degree turn at dock end)
      if (layout.lSection) {
        const lLen = layout.lSection.length;
        const lDir = layout.lSection.direction;
        const lPerpX = -lDir.z;
        const lPerpZ = lDir.x;
        const lStartX = position.x + direction.x * dockLength;
        const lStartZ = position.z + direction.z * dockLength;

        woodGeos.push(
          ...buildDockSection(
            lStartX,
            lStartZ,
            deckY,
            lDir.x,
            lDir.z,
            lPerpX,
            lPerpZ,
            lLen,
            dockWidth,
            postSpacing,
            postRadius,
            waterFloorY,
          ),
        );

        if (hasRailing) {
          buildFenceForSection(
            woodGeos,
            lStartX,
            lStartZ,
            lDir.x,
            lDir.z,
            lPerpX,
            lPerpZ,
            lLen,
            dockWidth,
            deckY,
            true, // include end
          );
        }
      }

      // Mooring posts (from layout data)
      if (hasMooring && layout.moorings.length > 0) {
        for (const m of layout.moorings) {
          // Mooring positions are local to dock origin — add layout.position
          const mx = position.x + m.position.x;
          const mz = position.z + m.position.z;
          const mooringSize = m.radius * 2;

          // Post shaft (box, matching in-game style)
          const postGeo = new THREE.BoxGeometry(
            mooringSize,
            m.height,
            mooringSize,
          );
          postGeo.translate(mx, deckY + m.height / 2, mz);
          woodGeos.push(postGeo);

          // Cap (wider box on top)
          const capSize = mooringSize + 0.1;
          const capGeo = new THREE.BoxGeometry(capSize, 0.06, capSize);
          capGeo.translate(mx, deckY + m.height + 0.03, mz);
          woodGeos.push(capGeo);
        }
      }

      // Merge into single mesh
      const group = new THREE.Group();
      group.name = "dock_preview";

      const woodColor = WOOD_COLORS[woodType] ?? 0x8c7a64;
      const woodMat = new MeshStandardNodeMaterial();
      woodMat.color = new THREE.Color(woodColor);
      woodMat.roughness = 0.8;

      if (woodGeos.length > 0) {
        const merged = mergeGeometries(woodGeos);
        for (const g of woodGeos) g.dispose();
        if (merged) {
          const mesh = new THREE.Mesh(merged, woodMat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          group.add(mesh);
        }
      }

      sceneRef.current.add(group);
      currentGroupRef.current = group;

      // Center camera
      if (cameraRef.current && controlsRef.current) {
        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        controlsRef.current.target.copy(center);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const dist = Math.max(maxDim * 1.5, 6);
        cameraRef.current.position.set(
          center.x + dist * 0.7,
          center.y + dist * 0.5,
          center.z + dist * 0.7,
        );
        controlsRef.current.update();
      }

      let totalVerts = 0,
        totalTris = 0;
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          totalVerts += child.geometry.attributes.position.count;
          totalTris += (child.geometry.index?.count ?? 0) / 3;
        }
      });

      setStats({
        vertices: totalVerts,
        triangles: totalTris,
        time: Math.round(performance.now() - startTime),
      });
    } catch (error) {
      console.error("Dock generation error:", error);
    }

    setIsGenerating(false);
  }, [
    dockStyle,
    woodType,
    length,
    width,
    deckHeight,
    postSpacing,
    postRadius,
    hasRailing,
    railingHeight,
    hasMooring,
    tSectionWidth,
    lSectionLength,
    seed,
    removeOldDock,
  ]);

  const exportToGLB = useCallback(async () => {
    const mesh = currentGroupRef.current;
    if (!mesh) return;
    try {
      const exporter = new GLTFExporter();
      const gltf = await exporter.parseAsync(mesh, { binary: true });
      const blob = new Blob([gltf as ArrayBuffer], {
        type: "model/gltf-binary",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dock_${dockStyle}_${seed}.glb`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
    }
  }, [dockStyle, seed]);

  // Initialize WebGPU scene
  useEffect(() => {
    if (!containerRef.current) return;
    let mounted = true;
    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a2332);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      500,
    );
    camera.position.set(8, 6, 8);
    cameraRef.current = camera;

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(5, 10, 5);
    sun.castShadow = true;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x1a2332, 0.4));

    // Water plane
    const waterGeo = new THREE.PlaneGeometry(100, 100);
    const waterMat = new MeshStandardNodeMaterial();
    waterMat.color = new THREE.Color(0x2255aa);
    waterMat.opacity = 0.6;
    waterMat.transparent = true;
    waterMat.roughness = 0.3;
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.receiveShadow = true;
    scene.add(water);

    // Ground floor
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new MeshStandardNodeMaterial();
    groundMat.color = new THREE.Color(0x3a2a1a);
    groundMat.roughness = 0.95;
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -3;
    scene.add(ground);

    scene.add(new THREE.GridHelper(100, 50, 0x334466, 0x223344));

    generatorRef.current = new DockGenerator();

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
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.target.set(0, 1, 3);
      controlsRef.current = controls;

      let lastTime = performance.now();
      const animate = () => {
        if (!mounted) return;
        animationIdRef.current = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
        const now = performance.now();
        frameTimesRef.current.push(now - lastTime);
        lastTime = now;
        if (frameTimesRef.current.length > 60) frameTimesRef.current.shift();
        fpsRef.current = Math.round(
          1000 /
            (frameTimesRef.current.reduce((a, b) => a + b, 0) /
              frameTimesRef.current.length),
        );
      };
      animate();
    };

    initRenderer();

    const handleResize = () => {
      if (!container || !rendererRef.current) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(
        container.clientWidth,
        container.clientHeight,
      );
    };
    window.addEventListener("resize", handleResize);

    return () => {
      mounted = false;
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationIdRef.current);
      if (currentGroupRef.current) {
        currentGroupRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (child.material instanceof THREE.Material)
              child.material.dispose();
          }
        });
      }
      waterGeo.dispose();
      waterMat.dispose();
      groundGeo.dispose();
      groundMat.dispose();
      if (rendererRef.current) {
        if (container.contains(rendererRef.current.domElement))
          container.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
      controlsRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    applyPreset(preset);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-[calc(100vh-44px)]">
      <div className="w-80 bg-bg-secondary border-r border-border-primary overflow-y-auto">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border-primary">
            <Anchor className="w-5 h-5 text-accent-aether" />
            <h2 className="font-display text-lg font-medium tracking-tight text-text-primary">
              Dock Generator
            </h2>
          </div>

          <div className="bg-primary/10 border border-primary/20 rounded-md p-3">
            <p className="text-xs text-primary">
              Uses @hyperforge/procgen DockGenerator for layout, with simplified
              world-space mesh matching the in-game rendering.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-text-tertiary">Preset</label>
            <select
              value={preset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full bg-bg-tertiary border border-border-primary rounded-md px-5 py-4 text-sm text-text-primary"
            >
              {getDockPresetNames().map((name) => (
                <option key={name} value={name}>
                  {name.charAt(0).toUpperCase() + name.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-text-tertiary">Dock Style</label>
            <select
              value={dockStyle}
              onChange={(e) => setDockStyle(e.target.value as DockStyleValue)}
              className="w-full bg-bg-tertiary border border-border-primary rounded-md px-5 py-4 text-sm text-text-primary"
            >
              {DOCK_STYLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-text-tertiary">Seed</label>
            <input
              type="text"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              className="w-full bg-bg-tertiary border border-border-primary rounded-md px-5 py-4 text-sm text-text-primary"
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
              <Settings2 className="w-4 h-4" /> Dimensions
            </h3>
            {[
              {
                label: "Length",
                value: length,
                set: setLength,
                min: 3,
                max: 20,
                step: 0.5,
                unit: "m",
              },
              {
                label: "Width",
                value: width,
                set: setWidth,
                min: 1.5,
                max: 6,
                step: 0.5,
                unit: "m",
              },
              {
                label: "Deck Height",
                value: deckHeight,
                set: setDeckHeight,
                min: 0.2,
                max: 1.0,
                step: 0.05,
                unit: "m",
              },
            ].map(({ label, value, set, min, max, step, unit }) => (
              <div key={label} className="space-y-1">
                <div className="flex justify-between">
                  <label className="text-xs text-text-tertiary">{label}</label>
                  <span className="text-xs text-text-tertiary">
                    {value}
                    {unit}
                  </span>
                </div>
                <input
                  type="range"
                  className="w-full"
                  min={min}
                  max={max}
                  step={step}
                  value={value}
                  onChange={(e) => set(parseFloat(e.target.value))}
                />
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
              <Gauge className="w-4 h-4" /> Posts
            </h3>
            <div className="space-y-1">
              <div className="flex justify-between">
                <label className="text-xs text-text-tertiary">
                  Post Spacing
                </label>
                <span className="text-xs text-text-tertiary">
                  {postSpacing}m
                </span>
              </div>
              <input
                type="range"
                className="w-full"
                min={1.5}
                max={4}
                step={0.5}
                value={postSpacing}
                onChange={(e) => setPostSpacing(parseFloat(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <label className="text-xs text-text-tertiary">
                  Post Radius
                </label>
                <span className="text-xs text-text-tertiary">
                  {postRadius}m
                </span>
              </div>
              <input
                type="range"
                className="w-full"
                min={0.08}
                max={0.3}
                step={0.02}
                value={postRadius}
                onChange={(e) => setPostRadius(parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
              <Eye className="w-4 h-4" /> Features
            </h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasRailing}
                onChange={(e) => setHasRailing(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-text-primary">Has Railing</span>
            </label>
            {hasRailing && (
              <div className="space-y-1 pl-6">
                <div className="flex justify-between">
                  <label className="text-xs text-text-tertiary">
                    Railing Height
                  </label>
                  <span className="text-xs text-text-tertiary">
                    {railingHeight}m
                  </span>
                </div>
                <input
                  type="range"
                  className="w-full"
                  min={0.5}
                  max={1.5}
                  step={0.1}
                  value={railingHeight}
                  onChange={(e) => setRailingHeight(parseFloat(e.target.value))}
                />
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasMooring}
                onChange={(e) => setHasMooring(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-text-primary">Has Mooring</span>
            </label>
          </div>

          {(dockStyle === DockStyle.TShaped ||
            dockStyle === DockStyle.LShaped) && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                {dockStyle === DockStyle.TShaped ? "T-Section" : "L-Section"}
              </h3>
              {dockStyle === DockStyle.TShaped && (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="text-xs text-text-tertiary">
                      T Section Width
                    </label>
                    <span className="text-xs text-text-tertiary">
                      {tSectionWidth}m
                    </span>
                  </div>
                  <input
                    type="range"
                    className="w-full"
                    min={4}
                    max={12}
                    step={0.5}
                    value={tSectionWidth}
                    onChange={(e) =>
                      setTSectionWidth(parseFloat(e.target.value))
                    }
                  />
                </div>
              )}
              {dockStyle === DockStyle.LShaped && (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="text-xs text-text-tertiary">
                      L Section Length
                    </label>
                    <span className="text-xs text-text-tertiary">
                      {lSectionLength}m
                    </span>
                  </div>
                  <input
                    type="range"
                    className="w-full"
                    min={3}
                    max={8}
                    step={0.5}
                    value={lSectionLength}
                    onChange={(e) =>
                      setLSectionLength(parseFloat(e.target.value))
                    }
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs text-text-tertiary">Wood Type</label>
            <select
              value={woodType}
              onChange={(e) => setWoodType(e.target.value as WoodTypeValue)}
              className="w-full bg-bg-tertiary border border-border-primary rounded-md px-5 py-4 text-sm text-text-primary"
            >
              {WOOD_TYPES.map((wt) => (
                <option key={wt} value={wt}>
                  {wt.charAt(0).toUpperCase() + wt.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={generateDock}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-dark text-white rounded-md font-medium transition-colors disabled:opacity-50 ease-out"
          >
            <RefreshCw
              className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`}
            />
            {isGenerating ? "Generating..." : "Generate Dock"}
          </button>

          <button
            onClick={exportToGLB}
            disabled={!currentGroupRef.current}
            className="w-full flex items-center justify-center gap-2 px-5 py-4 bg-bg-tertiary hover:bg-bg-tertiary/80 text-text-primary border border-border-primary rounded-md text-sm transition-colors disabled:opacity-50 ease-out"
          >
            <Download className="w-4 h-4" /> Export GLB
          </button>

          {stats && (
            <div className="bg-bg-tertiary rounded-md p-3 space-y-2">
              <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
                <Gauge className="w-4 h-4" /> Statistics
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-text-tertiary">Vertices</span>
                  <p className="text-text-primary font-mono">
                    {stats.vertices.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-text-tertiary">Triangles</span>
                  <p className="text-text-primary font-mono">
                    {stats.triangles.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-text-tertiary">Gen Time</span>
                  <p className="text-text-primary font-mono">{stats.time}ms</p>
                </div>
                <div>
                  <span className="text-text-tertiary">FPS</span>
                  <p className="text-text-primary font-mono">
                    {fpsRef.current}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 relative">
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
};

export { DockGenPage };
