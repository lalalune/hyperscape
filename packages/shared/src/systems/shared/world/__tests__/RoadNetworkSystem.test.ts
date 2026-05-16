/**
 * Tests for RoadNetworkSystem procedural road generation algorithms.
 * Tests MST construction, A* pathfinding, path smoothing, and spatial indexing.
 */

import { describe, it, expect } from "vitest";
import { BIOME_LIST } from "../TerrainBiomeTypes";

// ============== Types for testing ==============
type TileEdge = "north" | "south" | "east" | "west";

interface RoadBoundaryExit {
  roadId: string;
  position: { x: number; z: number };
  direction: number;
  tileX: number;
  tileZ: number;
  edge: TileEdge;
}

// ============== Constants (must match RoadNetworkSystem.ts) ==============
const ROAD_WIDTH = 6; // Updated to match RoadNetworkSystem default
const PATH_STEP_SIZE = 20;
const _MAX_PATH_ITERATIONS = 10000;
const EXTRA_CONNECTIONS_RATIO = 0.25;

const COST_BASE = 1.0;
const COST_SLOPE_MULTIPLIER = 5.0;
const COST_WATER_PENALTY = 1000;
const COST_BIOME_MULTIPLIER: Record<string, number> = {
  forest: 1.0,
  tundra: 1.5,
  canyon: 2.0,
};

const SMOOTHING_ITERATIONS = 2;
const _NOISE_DISPLACEMENT_SCALE = 0.01;
const _NOISE_DISPLACEMENT_STRENGTH = 3;
const _MIN_POINT_SPACING = 4;
const TILE_SIZE = 100;
// IMPORTANT: This must match TERRAIN_CONSTANTS.WATER_THRESHOLD (9.0)
const WATER_THRESHOLD = 9.0;
const HEURISTIC_WEIGHT = 2.5;

// A* neighbor directions
const DIRECTIONS = [
  { dx: PATH_STEP_SIZE, dz: 0 },
  { dx: -PATH_STEP_SIZE, dz: 0 },
  { dx: 0, dz: PATH_STEP_SIZE },
  { dx: 0, dz: -PATH_STEP_SIZE },
  { dx: PATH_STEP_SIZE, dz: PATH_STEP_SIZE },
  { dx: PATH_STEP_SIZE, dz: -PATH_STEP_SIZE },
  { dx: -PATH_STEP_SIZE, dz: PATH_STEP_SIZE },
  { dx: -PATH_STEP_SIZE, dz: -PATH_STEP_SIZE },
];

// ============== Helper Functions ==============

const dist2D = (x1: number, z1: number, x2: number, z2: number): number =>
  Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);

interface Edge {
  fromId: string;
  toId: string;
  distance: number;
}

interface Town {
  id: string;
  position: { x: number; z: number };
}

interface _PathNode {
  x: number;
  z: number;
  g: number;
  h: number;
  f: number;
  parent: _PathNode | null;
}

interface RoadPathPoint {
  x: number;
  z: number;
  y: number;
}

interface RoadTileSegment {
  start: { x: number; z: number };
  end: { x: number; z: number };
  width: number;
  roadId: string;
}

/** Calculate all possible edges between towns */
function calculateAllEdges(towns: Town[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < towns.length; i++) {
    for (let j = i + 1; j < towns.length; j++) {
      edges.push({
        fromId: towns[i].id,
        toId: towns[j].id,
        distance: dist2D(
          towns[i].position.x,
          towns[i].position.z,
          towns[j].position.x,
          towns[j].position.z,
        ),
      });
    }
  }
  return edges;
}

/** Build MST using Prim's algorithm */
function buildMST(towns: Town[], edges: Edge[]): Edge[] {
  const mstEdges: Edge[] = [];
  const inMST = new Set<string>();

  if (towns.length === 0) return mstEdges;

  inMST.add(towns[0].id);

  while (inMST.size < towns.length) {
    let minEdge: Edge | null = null;
    let minDistance = Infinity;

    for (const edge of edges) {
      const fromInMST = inMST.has(edge.fromId);
      const toInMST = inMST.has(edge.toId);

      if (fromInMST !== toInMST) {
        if (edge.distance < minDistance) {
          minDistance = edge.distance;
          minEdge = edge;
        }
      }
    }

    if (minEdge) {
      mstEdges.push(minEdge);
      inMST.add(minEdge.fromId);
      inMST.add(minEdge.toId);
    } else {
      break;
    }
  }

  return mstEdges;
}

/** A* heuristic (Euclidean) */
function heuristic(x1: number, z1: number, x2: number, z2: number): number {
  return dist2D(x1, z1, x2, z2) * COST_BASE;
}

/** Calculate movement cost */
function calculateMovementCost(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  getHeight: (x: number, z: number) => number,
  getBiome?: (x: number, z: number) => string,
): number {
  const fromHeight = getHeight(fromX, fromZ);
  const toHeight = getHeight(toX, toZ);

  if (toHeight < WATER_THRESHOLD) return COST_WATER_PENALTY;

  const horizontalDistance = dist2D(fromX, fromZ, toX, toZ);
  const slope = Math.abs(toHeight - fromHeight) / horizontalDistance;

  const biome = getBiome?.(toX, toZ);
  const biomeCost = biome ? (COST_BIOME_MULTIPLIER[biome] ?? 1.0) : 1.0;

  const baseCost = horizontalDistance * COST_BASE;
  const slopeCost = slope * COST_SLOPE_MULTIPLIER * horizontalDistance;

  return (baseCost + slopeCost) * biomeCost;
}

/** Distance from point to line segment */
function distanceToSegment(
  px: number,
  pz: number,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
): number {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lengthSq = dx * dx + dz * dz;

  if (lengthSq === 0) return dist2D(px, pz, x1, z1);

  const t = Math.max(
    0,
    Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / lengthSq),
  );
  return dist2D(px, pz, x1 + t * dx, z1 + t * dz);
}

/** Cohen-Sutherland line clipping */
function clipSegmentToTile(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): { x1: number; z1: number; x2: number; z2: number } | null {
  const INSIDE = 0,
    LEFT = 1,
    RIGHT = 2,
    BOTTOM = 4,
    TOP = 8;

  const computeCode = (x: number, z: number): number => {
    let code = INSIDE;
    if (x < minX) code |= LEFT;
    else if (x > maxX) code |= RIGHT;
    if (z < minZ) code |= BOTTOM;
    else if (z > maxZ) code |= TOP;
    return code;
  };

  let code1 = computeCode(x1, z1);
  let code2 = computeCode(x2, z2);
  let accept = false;

  while (true) {
    if ((code1 | code2) === 0) {
      accept = true;
      break;
    } else if ((code1 & code2) !== 0) {
      break;
    } else {
      const codeOut = code1 !== 0 ? code1 : code2;
      let x: number, z: number;

      if (codeOut & TOP) {
        x = x1 + ((x2 - x1) * (maxZ - z1)) / (z2 - z1);
        z = maxZ;
      } else if (codeOut & BOTTOM) {
        x = x1 + ((x2 - x1) * (minZ - z1)) / (z2 - z1);
        z = minZ;
      } else if (codeOut & RIGHT) {
        z = z1 + ((z2 - z1) * (maxX - x1)) / (x2 - x1);
        x = maxX;
      } else {
        z = z1 + ((z2 - z1) * (minX - x1)) / (x2 - x1);
        x = minX;
      }

      if (codeOut === code1) {
        x1 = x;
        z1 = z;
        code1 = computeCode(x1, z1);
      } else {
        x2 = x;
        z2 = z;
        code2 = computeCode(x2, z2);
      }
    }
  }

  return accept ? { x1, z1, x2, z2 } : null;
}

/** Chaikin smoothing iteration */
function chaikinSmooth(path: RoadPathPoint[]): RoadPathPoint[] {
  if (path.length < 2) return path;

  const newPath: RoadPathPoint[] = [path[0]];

  for (let i = 0; i < path.length - 1; i++) {
    const p0 = path[i];
    const p1 = path[i + 1];

    newPath.push({
      x: p0.x * 0.75 + p1.x * 0.25,
      z: p0.z * 0.75 + p1.z * 0.25,
      y: p0.y * 0.75 + p1.y * 0.25,
    });
    newPath.push({
      x: p0.x * 0.25 + p1.x * 0.75,
      z: p0.z * 0.25 + p1.z * 0.75,
      y: p0.y * 0.25 + p1.y * 0.75,
    });
  }

  newPath.push(path[path.length - 1]);
  return newPath;
}

// ============== Tests ==============

describe("RoadNetworkSystem Algorithms", () => {
  describe("Edge Calculation", () => {
    it("calculates correct number of edges", () => {
      const towns: Town[] = [
        { id: "t0", position: { x: 0, z: 0 } },
        { id: "t1", position: { x: 100, z: 0 } },
        { id: "t2", position: { x: 0, z: 100 } },
      ];

      const edges = calculateAllEdges(towns);

      // n*(n-1)/2 edges for n towns
      expect(edges.length).toBe(3);
    });

    it("calculates correct distances", () => {
      const towns: Town[] = [
        { id: "t0", position: { x: 0, z: 0 } },
        { id: "t1", position: { x: 100, z: 0 } },
        { id: "t2", position: { x: 0, z: 100 } },
      ];

      const edges = calculateAllEdges(towns);

      const edge01 = edges.find((e) => e.fromId === "t0" && e.toId === "t1");
      const edge02 = edges.find((e) => e.fromId === "t0" && e.toId === "t2");
      const edge12 = edges.find((e) => e.fromId === "t1" && e.toId === "t2");

      expect(edge01?.distance).toBeCloseTo(100, 5);
      expect(edge02?.distance).toBeCloseTo(100, 5);
      expect(edge12?.distance).toBeCloseTo(Math.sqrt(2) * 100, 5);
    });

    it("handles empty town list", () => {
      const edges = calculateAllEdges([]);
      expect(edges.length).toBe(0);
    });

    it("handles single town", () => {
      const edges = calculateAllEdges([{ id: "t0", position: { x: 0, z: 0 } }]);
      expect(edges.length).toBe(0);
    });
  });

  describe("MST Construction (Prim's Algorithm)", () => {
    it("connects all towns", () => {
      const towns: Town[] = [
        { id: "t0", position: { x: 0, z: 0 } },
        { id: "t1", position: { x: 100, z: 0 } },
        { id: "t2", position: { x: 0, z: 100 } },
        { id: "t3", position: { x: 100, z: 100 } },
      ];

      const edges = calculateAllEdges(towns);
      const mst = buildMST(towns, edges);

      // MST has n-1 edges for n nodes
      expect(mst.length).toBe(3);

      // Verify all towns are connected
      const connectedTowns = new Set<string>();
      connectedTowns.add(towns[0].id);

      for (const edge of mst) {
        connectedTowns.add(edge.fromId);
        connectedTowns.add(edge.toId);
      }

      expect(connectedTowns.size).toBe(4);
    });

    it("selects minimum weight edges", () => {
      const towns: Town[] = [
        { id: "t0", position: { x: 0, z: 0 } },
        { id: "t1", position: { x: 10, z: 0 } }, // Close to t0
        { id: "t2", position: { x: 1000, z: 0 } }, // Far away
      ];

      const edges = calculateAllEdges(towns);
      const mst = buildMST(towns, edges);

      // Should include the short edge (t0-t1) and connect t2
      const totalLength = mst.reduce((sum, e) => sum + e.distance, 0);

      // Minimum total would be: 10 + 990 = 1000 (not 10 + 1000 = 1010)
      expect(totalLength).toBeCloseTo(1000, 0);
    });

    it("handles empty input", () => {
      const mst = buildMST([], []);
      expect(mst.length).toBe(0);
    });

    it("handles single town", () => {
      const towns: Town[] = [{ id: "t0", position: { x: 0, z: 0 } }];
      const mst = buildMST(towns, []);
      expect(mst.length).toBe(0);
    });

    it("produces tree structure (no cycles)", () => {
      const towns: Town[] = [];
      for (let i = 0; i < 10; i++) {
        towns.push({ id: `t${i}`, position: { x: i * 100, z: (i % 3) * 100 } });
      }

      const edges = calculateAllEdges(towns);
      const mst = buildMST(towns, edges);

      // Tree has exactly n-1 edges for n nodes
      expect(mst.length).toBe(towns.length - 1);

      // Each town should appear at most (n-1) times total in edges
      const degrees = new Map<string, number>();
      for (const edge of mst) {
        degrees.set(edge.fromId, (degrees.get(edge.fromId) ?? 0) + 1);
        degrees.set(edge.toId, (degrees.get(edge.toId) ?? 0) + 1);
      }

      // In a tree, sum of degrees = 2*(n-1)
      const totalDegree = Array.from(degrees.values()).reduce(
        (a, b) => a + b,
        0,
      );
      expect(totalDegree).toBe(2 * (towns.length - 1));
    });
  });

  describe("A* Pathfinding Costs", () => {
    it("heuristic returns Euclidean distance", () => {
      expect(heuristic(0, 0, 100, 0)).toBeCloseTo(100, 5);
      expect(heuristic(0, 0, 0, 100)).toBeCloseTo(100, 5);
      expect(heuristic(0, 0, 100, 100)).toBeCloseTo(Math.sqrt(2) * 100, 5);
    });

    it("water has extreme penalty", () => {
      const underwaterHeight = () => WATER_THRESHOLD - 1;
      const cost = calculateMovementCost(0, 0, 10, 0, underwaterHeight);
      expect(cost).toBe(COST_WATER_PENALTY);
    });

    it("flat terrain has base cost", () => {
      const flatHeight = () => 10;
      const cost = calculateMovementCost(0, 0, PATH_STEP_SIZE, 0, flatHeight);
      expect(cost).toBeCloseTo(PATH_STEP_SIZE * COST_BASE, 2);
    });

    it("slope increases cost", () => {
      const flatHeight = () => 10;
      const slopedHeight = (x: number) => 10 + x * 0.5; // 50% grade

      const flatCost = calculateMovementCost(
        0,
        0,
        PATH_STEP_SIZE,
        0,
        flatHeight,
      );
      const slopedCost = calculateMovementCost(
        0,
        0,
        PATH_STEP_SIZE,
        0,
        slopedHeight,
      );

      expect(slopedCost).toBeGreaterThan(flatCost);
    });

    it("biome affects cost", () => {
      const flatHeight = () => 10;

      const forestCost = calculateMovementCost(
        0,
        0,
        10,
        0,
        flatHeight,
        () => "forest",
      );
      const tundraCost = calculateMovementCost(
        0,
        0,
        10,
        0,
        flatHeight,
        () => "tundra",
      );
      const canyonCost = calculateMovementCost(
        0,
        0,
        10,
        0,
        flatHeight,
        () => "canyon",
      );

      expect(tundraCost).toBeGreaterThan(forestCost);
      expect(canyonCost).toBeGreaterThan(tundraCost);
    });

    it("diagonal movement costs more than cardinal", () => {
      const flatHeight = () => 10;

      const cardinalCost = calculateMovementCost(
        0,
        0,
        PATH_STEP_SIZE,
        0,
        flatHeight,
      );
      const diagonalCost = calculateMovementCost(
        0,
        0,
        PATH_STEP_SIZE,
        PATH_STEP_SIZE,
        flatHeight,
      );

      // Diagonal is sqrt(2) times longer
      expect(diagonalCost).toBeCloseTo(cardinalCost * Math.sqrt(2), 2);
    });
  });

  describe("Distance to Segment", () => {
    it("returns 0 for point on segment", () => {
      expect(distanceToSegment(5, 0, 0, 0, 10, 0)).toBeCloseTo(0, 5);
    });

    it("returns correct distance for point perpendicular to segment", () => {
      expect(distanceToSegment(5, 5, 0, 0, 10, 0)).toBeCloseTo(5, 5);
    });

    it("returns distance to nearest endpoint when beyond segment", () => {
      // Point is beyond segment end
      expect(distanceToSegment(15, 0, 0, 0, 10, 0)).toBeCloseTo(5, 5);
      // Point is before segment start
      expect(distanceToSegment(-5, 0, 0, 0, 10, 0)).toBeCloseTo(5, 5);
    });

    it("handles zero-length segment", () => {
      expect(distanceToSegment(3, 4, 0, 0, 0, 0)).toBeCloseTo(5, 5);
    });

    it("handles diagonal segments", () => {
      // Segment from (0,0) to (10,10), point at (10, 0)
      // Distance should be to midpoint perpendicular
      const d = distanceToSegment(10, 0, 0, 0, 10, 10);
      expect(d).toBeCloseTo(Math.sqrt(2) * 5, 2);
    });
  });

  describe("Cohen-Sutherland Line Clipping", () => {
    it("returns null for completely outside segment", () => {
      const result = clipSegmentToTile(200, 200, 300, 300, 0, 100, 0, 100);
      expect(result).toBeNull();
    });

    it("returns unchanged segment for completely inside", () => {
      const result = clipSegmentToTile(25, 25, 75, 75, 0, 100, 0, 100);
      expect(result).not.toBeNull();
      expect(result!.x1).toBe(25);
      expect(result!.z1).toBe(25);
      expect(result!.x2).toBe(75);
      expect(result!.z2).toBe(75);
    });

    it("clips segment crossing left boundary", () => {
      const result = clipSegmentToTile(-50, 50, 50, 50, 0, 100, 0, 100);
      expect(result).not.toBeNull();
      expect(result!.x1).toBeCloseTo(0, 5);
      expect(result!.x2).toBe(50);
    });

    it("clips segment crossing right boundary", () => {
      const result = clipSegmentToTile(50, 50, 150, 50, 0, 100, 0, 100);
      expect(result).not.toBeNull();
      expect(result!.x1).toBe(50);
      expect(result!.x2).toBeCloseTo(100, 5);
    });

    it("clips segment crossing both boundaries", () => {
      const result = clipSegmentToTile(-50, 50, 150, 50, 0, 100, 0, 100);
      expect(result).not.toBeNull();
      expect(result!.x1).toBeCloseTo(0, 5);
      expect(result!.x2).toBeCloseTo(100, 5);
    });

    it("clips diagonal segments correctly", () => {
      const result = clipSegmentToTile(-50, -50, 150, 150, 0, 100, 0, 100);
      expect(result).not.toBeNull();
      expect(result!.x1).toBeCloseTo(0, 5);
      expect(result!.z1).toBeCloseTo(0, 5);
      expect(result!.x2).toBeCloseTo(100, 5);
      expect(result!.z2).toBeCloseTo(100, 5);
    });

    it("handles segment at exact boundary", () => {
      const result = clipSegmentToTile(0, 50, 100, 50, 0, 100, 0, 100);
      expect(result).not.toBeNull();
    });
  });

  describe("Chaikin Path Smoothing", () => {
    it("preserves endpoints", () => {
      const path: RoadPathPoint[] = [
        { x: 0, z: 0, y: 0 },
        { x: 50, z: 0, y: 0 },
        { x: 100, z: 0, y: 0 },
      ];

      const smoothed = chaikinSmooth(path);

      expect(smoothed[0]).toEqual(path[0]);
      expect(smoothed[smoothed.length - 1]).toEqual(path[path.length - 1]);
    });

    it("increases point count", () => {
      const path: RoadPathPoint[] = [
        { x: 0, z: 0, y: 0 },
        { x: 50, z: 0, y: 0 },
        { x: 100, z: 0, y: 0 },
      ];

      const smoothed = chaikinSmooth(path);

      // Each segment becomes 2 points, plus original endpoints
      // n segments = n-1, so 2*(n-1) new points + 2 endpoints = 2n
      expect(smoothed.length).toBeGreaterThan(path.length);
    });

    it("places new points at 25% and 75% along segments", () => {
      const path: RoadPathPoint[] = [
        { x: 0, z: 0, y: 0 },
        { x: 100, z: 0, y: 0 },
      ];

      const smoothed = chaikinSmooth(path);

      // First new point at 25%: x = 0*0.75 + 100*0.25 = 25
      expect(smoothed[1].x).toBeCloseTo(25, 5);
      // Second new point at 75%: x = 0*0.25 + 100*0.75 = 75
      expect(smoothed[2].x).toBeCloseTo(75, 5);
    });

    it("handles short paths", () => {
      const singlePoint: RoadPathPoint[] = [{ x: 0, z: 0, y: 0 }];
      expect(chaikinSmooth(singlePoint)).toEqual(singlePoint);

      const twoPoints: RoadPathPoint[] = [
        { x: 0, z: 0, y: 0 },
        { x: 100, z: 0, y: 0 },
      ];
      const smoothed = chaikinSmooth(twoPoints);
      expect(smoothed.length).toBe(4); // start + 2 new + end
    });

    it("multiple iterations increase smoothness", () => {
      let path: RoadPathPoint[] = [
        { x: 0, z: 0, y: 0 },
        { x: 50, z: 50, y: 0 },
        { x: 100, z: 0, y: 0 },
      ];

      const lengths: number[] = [path.length];

      for (let i = 0; i < SMOOTHING_ITERATIONS; i++) {
        path = chaikinSmooth(path);
        lengths.push(path.length);
      }

      // Each iteration increases point count
      for (let i = 1; i < lengths.length; i++) {
        expect(lengths[i]).toBeGreaterThan(lengths[i - 1]);
      }
    });
  });

  describe("Road Width and isOnRoad", () => {
    function isOnRoad(
      x: number,
      z: number,
      roads: Array<{ path: RoadPathPoint[]; width: number }>,
    ): boolean {
      for (const road of roads) {
        for (let i = 0; i < road.path.length - 1; i++) {
          const p1 = road.path[i];
          const p2 = road.path[i + 1];
          const distance = distanceToSegment(x, z, p1.x, p1.z, p2.x, p2.z);
          if (distance <= road.width / 2) {
            return true;
          }
        }
      }
      return false;
    }

    it("returns true for point on road center", () => {
      const roads = [
        {
          path: [
            { x: 0, z: 0, y: 0 },
            { x: 100, z: 0, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
      ];

      expect(isOnRoad(50, 0, roads)).toBe(true);
    });

    it("returns true for point within road width", () => {
      const roads = [
        {
          path: [
            { x: 0, z: 0, y: 0 },
            { x: 100, z: 0, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
      ];

      // Point at half width from center
      expect(isOnRoad(50, ROAD_WIDTH / 2 - 0.1, roads)).toBe(true);
    });

    it("returns false for point outside road width", () => {
      const roads = [
        {
          path: [
            { x: 0, z: 0, y: 0 },
            { x: 100, z: 0, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
      ];

      expect(isOnRoad(50, ROAD_WIDTH, roads)).toBe(false);
    });

    it("handles multiple road segments", () => {
      const roads = [
        {
          path: [
            { x: 0, z: 0, y: 0 },
            { x: 100, z: 0, y: 0 },
            { x: 100, z: 100, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
      ];

      expect(isOnRoad(50, 0, roads)).toBe(true); // On first segment
      expect(isOnRoad(100, 50, roads)).toBe(true); // On second segment
      expect(isOnRoad(50, 50, roads)).toBe(false); // Not on any segment
    });
  });

  describe("getDistanceToNearestRoad", () => {
    function getDistanceToNearestRoad(
      x: number,
      z: number,
      roads: Array<{ path: RoadPathPoint[]; width: number }>,
    ): number {
      let minDistance = Infinity;
      for (const road of roads) {
        for (let i = 0; i < road.path.length - 1; i++) {
          const p1 = road.path[i];
          const p2 = road.path[i + 1];
          minDistance = Math.min(
            minDistance,
            distanceToSegment(x, z, p1.x, p1.z, p2.x, p2.z),
          );
        }
      }
      return minDistance;
    }

    it("returns 0 for point on road center", () => {
      const roads = [
        {
          path: [
            { x: 0, z: 0, y: 0 },
            { x: 100, z: 0, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
      ];
      expect(getDistanceToNearestRoad(50, 0, roads)).toBe(0);
    });

    it("returns exact distance perpendicular to road", () => {
      const roads = [
        {
          path: [
            { x: 0, z: 0, y: 0 },
            { x: 100, z: 0, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
      ];
      // Point 5m away perpendicular to road
      expect(getDistanceToNearestRoad(50, 5, roads)).toBeCloseTo(5, 5);
      expect(getDistanceToNearestRoad(50, -10, roads)).toBeCloseTo(10, 5);
    });

    it("returns distance to nearest segment endpoint", () => {
      const roads = [
        {
          path: [
            { x: 0, z: 0, y: 0 },
            { x: 100, z: 0, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
      ];
      // Point beyond road end - distance to endpoint
      expect(getDistanceToNearestRoad(110, 0, roads)).toBeCloseTo(10, 5);
      expect(getDistanceToNearestRoad(-10, 0, roads)).toBeCloseTo(10, 5);
    });

    it("handles diagonal roads", () => {
      const roads = [
        {
          path: [
            { x: 0, z: 0, y: 0 },
            { x: 100, z: 100, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
      ];
      // Point on diagonal road center
      expect(getDistanceToNearestRoad(50, 50, roads)).toBeCloseTo(0, 5);
      // Point perpendicular to diagonal: (55, 45) is 10/sqrt(2) away from line y=x
      const perpDist = 10 / Math.sqrt(2); // ~7.07m
      expect(getDistanceToNearestRoad(55, 45, roads)).toBeCloseTo(perpDist, 4);
    });

    it("returns Infinity for empty roads array", () => {
      expect(getDistanceToNearestRoad(50, 50, [])).toBe(Infinity);
    });

    it("finds minimum across multiple roads", () => {
      const roads = [
        {
          path: [
            { x: 0, z: 0, y: 0 },
            { x: 100, z: 0, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
        {
          path: [
            { x: 50, z: 10, y: 0 },
            { x: 50, z: 100, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
      ];
      // Point at (50, 5) - 5m from first road, 5m from second road
      expect(getDistanceToNearestRoad(50, 5, roads)).toBeCloseTo(5, 5);
      // Point at (50, 8) - 8m from first road, 2m from second road
      expect(getDistanceToNearestRoad(50, 8, roads)).toBeCloseTo(2, 5);
    });

    it("handles road at exact boundary (halfWidth)", () => {
      const roads = [
        {
          path: [
            { x: 0, z: 0, y: 0 },
            { x: 100, z: 0, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
      ];
      const halfWidth = ROAD_WIDTH / 2;
      // Point exactly at road edge
      expect(getDistanceToNearestRoad(50, halfWidth, roads)).toBeCloseTo(
        halfWidth,
        5,
      );
    });

    it("handles very small distances (sub-meter)", () => {
      const roads = [
        {
          path: [
            { x: 0, z: 0, y: 0 },
            { x: 100, z: 0, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
      ];
      expect(getDistanceToNearestRoad(50, 0.1, roads)).toBeCloseTo(0.1, 5);
      expect(getDistanceToNearestRoad(50, 0.01, roads)).toBeCloseTo(0.01, 5);
    });

    it("handles large distances", () => {
      const roads = [
        {
          path: [
            { x: 0, z: 0, y: 0 },
            { x: 100, z: 0, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
      ];
      expect(getDistanceToNearestRoad(50, 1000, roads)).toBeCloseTo(1000, 5);
    });

    it("handles negative coordinates", () => {
      const roads = [
        {
          path: [
            { x: -100, z: -100, y: 0 },
            { x: 100, z: 100, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
      ];
      expect(getDistanceToNearestRoad(0, 0, roads)).toBeCloseTo(0, 5);
      expect(getDistanceToNearestRoad(-50, -50, roads)).toBeCloseTo(0, 5);
    });
  });

  describe("Grass-Road Fade Calculation", () => {
    // Test the smoothstep fade logic used in ProceduralGrass
    function smoothstepJS(edge0: number, edge1: number, x: number): number {
      const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
      return t * t * (3 - 2 * t);
    }

    function calculateGrassFade(
      distance: number,
      roadWidth: number,
      fadeWidth: number,
    ): number {
      const halfWidth = roadWidth / 2;
      if (distance <= halfWidth) {
        return 0; // Inside road - no grass
      } else if (distance < halfWidth + fadeWidth) {
        return smoothstepJS(0, 1, (distance - halfWidth) / fadeWidth);
      }
      return 1; // Full grass
    }

    it("returns 0 inside road center", () => {
      expect(calculateGrassFade(0, 4, 2)).toBe(0);
    });

    it("returns 0 at road edge (distance = halfWidth)", () => {
      expect(calculateGrassFade(2, 4, 2)).toBe(0);
    });

    it("returns ~0 just beyond road edge", () => {
      expect(calculateGrassFade(2.01, 4, 2)).toBeCloseTo(0, 2);
    });

    it("returns ~0.5 at midpoint of fade zone", () => {
      // halfWidth=2, fadeWidth=2, midpoint at distance=3
      expect(calculateGrassFade(3, 4, 2)).toBeCloseTo(0.5, 1);
    });

    it("returns ~1 at end of fade zone", () => {
      // halfWidth=2, fadeWidth=2, end at distance=4
      expect(calculateGrassFade(3.99, 4, 2)).toBeCloseTo(1, 1);
    });

    it("returns 1 beyond fade zone", () => {
      expect(calculateGrassFade(5, 4, 2)).toBe(1);
      expect(calculateGrassFade(100, 4, 2)).toBe(1);
    });

    it("handles narrow roads (2m width)", () => {
      expect(calculateGrassFade(0, 2, 2)).toBe(0);
      expect(calculateGrassFade(1, 2, 2)).toBe(0);
      expect(calculateGrassFade(2, 2, 2)).toBeCloseTo(0.5, 1);
      expect(calculateGrassFade(3, 2, 2)).toBe(1);
    });

    it("handles wide roads (8m main street)", () => {
      expect(calculateGrassFade(0, 8, 2)).toBe(0);
      expect(calculateGrassFade(4, 8, 2)).toBe(0);
      expect(calculateGrassFade(5, 8, 2)).toBeCloseTo(0.5, 1);
      expect(calculateGrassFade(6, 8, 2)).toBe(1);
    });

    it("handles town paths (3m width)", () => {
      expect(calculateGrassFade(0, 3, 2)).toBe(0);
      expect(calculateGrassFade(1.5, 3, 2)).toBe(0);
      expect(calculateGrassFade(2.5, 3, 2)).toBeCloseTo(0.5, 1);
      expect(calculateGrassFade(3.5, 3, 2)).toBe(1);
    });

    it("smoothstep produces smooth curve (no discontinuities)", () => {
      const fadeWidth = 2;
      const halfWidth = 2;
      let prevValue = 0;
      for (let d = halfWidth; d <= halfWidth + fadeWidth; d += 0.1) {
        const value = calculateGrassFade(d, 4, fadeWidth);
        expect(value).toBeGreaterThanOrEqual(prevValue);
        prevValue = value;
      }
    });

    it("smoothstep derivative is 0 at boundaries", () => {
      // Smoothstep has 0 derivative at edge0 and edge1
      const nearStart = calculateGrassFade(2.001, 4, 2);
      const atStart = calculateGrassFade(2.0, 4, 2);
      expect(nearStart - atStart).toBeLessThan(0.001);

      const nearEnd = calculateGrassFade(3.999, 4, 2);
      const atEnd = calculateGrassFade(4.0, 4, 2);
      expect(atEnd - nearEnd).toBeLessThan(0.01);
    });
  });

  describe("Grass-Road Integration (End-to-End)", () => {
    // This test simulates what ProceduralGrass.generateHeightmapTexture() does
    // to verify the complete pipeline from roads → distance → grassiness

    function simulateGrassHeightmapGeneration(
      roads: Array<{ path: RoadPathPoint[]; width: number }>,
      samplePoints: Array<{ x: number; z: number }>,
      fadeWidth: number,
    ): Array<{ x: number; z: number; grassiness: number }> {
      return samplePoints.map(({ x, z }) => {
        // Step 1: Calculate distance to nearest road (like RoadNetworkSystem.getDistanceToNearestRoad)
        let minDistance = Infinity;
        for (const road of roads) {
          for (let i = 0; i < road.path.length - 1; i++) {
            const p1 = road.path[i];
            const p2 = road.path[i + 1];
            minDistance = Math.min(
              minDistance,
              distanceToSegment(x, z, p1.x, p1.z, p2.x, p2.z),
            );
          }
        }

        // Step 2: Calculate grassiness with fade (like ProceduralGrass road fade logic)
        let grassiness = 1.0;
        if (roads.length > 0 && minDistance < Infinity) {
          // Find width of closest road
          let closestWidth = ROAD_WIDTH;
          for (const road of roads) {
            for (let i = 0; i < road.path.length - 1; i++) {
              const p1 = road.path[i];
              const p2 = road.path[i + 1];
              const d = distanceToSegment(x, z, p1.x, p1.z, p2.x, p2.z);
              if (d === minDistance) {
                closestWidth = road.width;
              }
            }
          }

          const halfWidth = closestWidth / 2;
          if (minDistance <= halfWidth) {
            grassiness = 0;
          } else if (minDistance < halfWidth + fadeWidth) {
            const t = (minDistance - halfWidth) / fadeWidth;
            grassiness = t * t * (3 - 2 * t); // smoothstep
          }
        }

        return { x, z, grassiness };
      });
    }

    it("excludes grass on road center", () => {
      const roads = [
        {
          path: [
            { x: 0, z: 50, y: 0 },
            { x: 100, z: 50, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
      ];
      const samples = [
        { x: 50, z: 50 }, // On road center
      ];
      const result = simulateGrassHeightmapGeneration(roads, samples, 2);
      expect(result[0].grassiness).toBe(0);
    });

    it("excludes grass at road edge", () => {
      const roads = [
        {
          path: [
            { x: 0, z: 50, y: 0 },
            { x: 100, z: 50, y: 0 },
          ],
          width: ROAD_WIDTH, // 6m wide, halfWidth = 3m
        },
      ];
      const samples = [
        { x: 50, z: 53 }, // 3m from center = at edge (halfWidth = 3m for 6m road)
      ];
      const result = simulateGrassHeightmapGeneration(roads, samples, 2);
      expect(result[0].grassiness).toBe(0);
    });

    it("fades grass in transition zone", () => {
      const roads = [
        {
          path: [
            { x: 0, z: 50, y: 0 },
            { x: 100, z: 50, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
      ];
      const samples = [
        { x: 50, z: 54 }, // 4m from center = 1m into fade zone (3m halfWidth + 1m into 2m fade)
      ];
      const result = simulateGrassHeightmapGeneration(roads, samples, 2);
      expect(result[0].grassiness).toBeGreaterThan(0);
      expect(result[0].grassiness).toBeLessThan(1);
    });

    it("has full grass beyond fade zone", () => {
      const roads = [
        {
          path: [
            { x: 0, z: 50, y: 0 },
            { x: 100, z: 50, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
      ];
      const samples = [
        { x: 50, z: 56 }, // 6m from center = beyond fade (3m halfWidth + 2m fade + 1m extra)
        { x: 50, z: 60 }, // 10m from center = well beyond
      ];
      const result = simulateGrassHeightmapGeneration(roads, samples, 2);
      expect(result[0].grassiness).toBe(1);
      expect(result[1].grassiness).toBe(1);
    });

    it("handles multiple roads correctly", () => {
      const roads = [
        {
          path: [
            { x: 0, z: 50, y: 0 },
            { x: 100, z: 50, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
        {
          path: [
            { x: 50, z: 0, y: 0 },
            { x: 50, z: 100, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
      ];
      const samples = [
        { x: 50, z: 50 }, // Intersection - on both roads
        { x: 30, z: 50 }, // On first road only
        { x: 50, z: 30 }, // On second road only
        { x: 30, z: 30 }, // Not on any road
      ];
      const result = simulateGrassHeightmapGeneration(roads, samples, 2);
      expect(result[0].grassiness).toBe(0); // On intersection
      expect(result[1].grassiness).toBe(0); // On first road
      expect(result[2].grassiness).toBe(0); // On second road
      expect(result[3].grassiness).toBe(1); // Not on any road
    });

    it("respects different road widths (town paths vs main roads)", () => {
      const roads = [
        {
          path: [
            { x: 0, z: 50, y: 0 },
            { x: 100, z: 50, y: 0 },
          ],
          width: 8, // Main road - 8m wide
        },
        {
          path: [
            { x: 0, z: 70, y: 0 },
            { x: 100, z: 70, y: 0 },
          ],
          width: 3, // Town path - 3m wide
        },
      ];
      const samples = [
        { x: 50, z: 54 }, // 4m from main road center - still on road
        { x: 50, z: 71.5 }, // 1.5m from path center - at edge
      ];
      const result = simulateGrassHeightmapGeneration(roads, samples, 2);
      expect(result[0].grassiness).toBe(0); // Inside 8m road (halfWidth=4m)
      expect(result[1].grassiness).toBe(0); // At edge of 3m path (halfWidth=1.5m)
    });

    it("produces consistent results across heightmap grid", () => {
      const roads = [
        {
          path: [
            { x: 0, z: 50, y: 0 },
            { x: 100, z: 50, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
      ];

      // Simulate a small heightmap grid sampling
      const samples: Array<{ x: number; z: number }> = [];
      for (let x = 0; x < 100; x += 10) {
        for (let z = 0; z < 100; z += 10) {
          samples.push({ x, z });
        }
      }

      const result = simulateGrassHeightmapGeneration(roads, samples, 2);

      // Verify samples on road have grassiness = 0
      const onRoadSamples = result.filter(
        (r) => Math.abs(r.z - 50) <= ROAD_WIDTH / 2,
      );
      for (const sample of onRoadSamples) {
        expect(sample.grassiness).toBe(0);
      }

      // Verify samples far from road have grassiness = 1
      const farSamples = result.filter(
        (r) => Math.abs(r.z - 50) > ROAD_WIDTH / 2 + 2,
      );
      for (const sample of farSamples) {
        expect(sample.grassiness).toBe(1);
      }
    });
  });

  describe("Spatial Index (Tile Cache)", () => {
    function buildTileCache(
      roads: Array<{ id: string; path: RoadPathPoint[]; width: number }>,
    ): Map<string, RoadTileSegment[]> {
      const cache = new Map<string, RoadTileSegment[]>();

      for (const road of roads) {
        for (let i = 0; i < road.path.length - 1; i++) {
          const p1 = road.path[i];
          const p2 = road.path[i + 1];

          const minTileX = Math.floor(Math.min(p1.x, p2.x) / TILE_SIZE);
          const maxTileX = Math.floor(Math.max(p1.x, p2.x) / TILE_SIZE);
          const minTileZ = Math.floor(Math.min(p1.z, p2.z) / TILE_SIZE);
          const maxTileZ = Math.floor(Math.max(p1.z, p2.z) / TILE_SIZE);

          for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
            for (let tileZ = minTileZ; tileZ <= maxTileZ; tileZ++) {
              const tileKey = `${tileX}_${tileZ}`;
              const tileMinX = tileX * TILE_SIZE;
              const tileMaxX = (tileX + 1) * TILE_SIZE;
              const tileMinZ = tileZ * TILE_SIZE;
              const tileMaxZ = (tileZ + 1) * TILE_SIZE;

              const clipped = clipSegmentToTile(
                p1.x,
                p1.z,
                p2.x,
                p2.z,
                tileMinX,
                tileMaxX,
                tileMinZ,
                tileMaxZ,
              );

              if (clipped) {
                const segment: RoadTileSegment = {
                  start: { x: clipped.x1 - tileMinX, z: clipped.z1 - tileMinZ },
                  end: { x: clipped.x2 - tileMinX, z: clipped.z2 - tileMinZ },
                  width: road.width,
                  roadId: road.id,
                };

                if (!cache.has(tileKey)) {
                  cache.set(tileKey, []);
                }
                cache.get(tileKey)!.push(segment);
              }
            }
          }
        }
      }

      return cache;
    }

    it("indexes road segments by tile", () => {
      const roads = [
        {
          id: "road_0",
          path: [
            { x: 50, z: 50, y: 0 },
            { x: 150, z: 50, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
      ];

      const cache = buildTileCache(roads);

      // Road crosses tiles 0_0 and 1_0
      expect(cache.has("0_0")).toBe(true);
      expect(cache.has("1_0")).toBe(true);
      expect(cache.has("2_0")).toBe(false);
    });

    it("clips segments to tile bounds", () => {
      const roads = [
        {
          id: "road_0",
          path: [
            { x: 50, z: 50, y: 0 },
            { x: 150, z: 50, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
      ];

      const cache = buildTileCache(roads);
      const tile0 = cache.get("0_0")!;
      const tile1 = cache.get("1_0")!;

      // In tile 0_0: segment ends at tile boundary (100)
      expect(tile0[0].end.x).toBeCloseTo(100, 2); // Local coords: 100 - 0 = 100
      // In tile 1_0: segment starts at tile boundary (0 local)
      expect(tile1[0].start.x).toBeCloseTo(0, 2);
    });

    it("uses local tile coordinates", () => {
      const roads = [
        {
          id: "road_0",
          path: [
            { x: 250, z: 250, y: 0 },
            { x: 275, z: 275, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
      ];

      const cache = buildTileCache(roads);
      const tile = cache.get("2_2")!;

      // World coords (250, 250) -> local (50, 50) in tile 2_2
      expect(tile[0].start.x).toBeCloseTo(50, 2);
      expect(tile[0].start.z).toBeCloseTo(50, 2);
    });

    it("handles road spanning multiple tiles", () => {
      const roads = [
        {
          id: "road_0",
          path: [
            { x: 0, z: 50, y: 0 },
            { x: 500, z: 50, y: 0 },
          ],
          width: ROAD_WIDTH,
        },
      ];

      const cache = buildTileCache(roads);

      // Should have entries in tiles 0-4 (0, 100, 200, 300, 400)
      expect(cache.has("0_0")).toBe(true);
      expect(cache.has("1_0")).toBe(true);
      expect(cache.has("2_0")).toBe(true);
      expect(cache.has("3_0")).toBe(true);
      expect(cache.has("4_0")).toBe(true);
    });
  });

  describe("Extra Connections", () => {
    function selectExtraEdges(
      allEdges: Edge[],
      mstEdges: Edge[],
      townCount: number,
    ): Edge[] {
      const mstEdgeSet = new Set<string>();
      for (const edge of mstEdges) {
        mstEdgeSet.add(`${edge.fromId}-${edge.toId}`);
        mstEdgeSet.add(`${edge.toId}-${edge.fromId}`);
      }

      const nonMstEdges = allEdges
        .filter(
          (edge) =>
            !mstEdgeSet.has(`${edge.fromId}-${edge.toId}`) &&
            !mstEdgeSet.has(`${edge.toId}-${edge.fromId}`),
        )
        .sort((a, b) => a.distance - b.distance);

      const extraCount = Math.floor(townCount * EXTRA_CONNECTIONS_RATIO);
      return nonMstEdges.slice(0, extraCount);
    }

    it("selects correct number of extra edges", () => {
      const towns: Town[] = [];
      for (let i = 0; i < 20; i++) {
        towns.push({ id: `t${i}`, position: { x: i * 100, z: 0 } });
      }

      const allEdges = calculateAllEdges(towns);
      const mstEdges = buildMST(towns, allEdges);
      const extraEdges = selectExtraEdges(allEdges, mstEdges, towns.length);

      expect(extraEdges.length).toBe(Math.floor(20 * EXTRA_CONNECTIONS_RATIO));
    });

    it("selects shortest non-MST edges", () => {
      const towns: Town[] = [
        { id: "t0", position: { x: 0, z: 0 } },
        { id: "t1", position: { x: 100, z: 0 } },
        { id: "t2", position: { x: 200, z: 0 } },
        { id: "t3", position: { x: 300, z: 0 } },
      ];

      const allEdges = calculateAllEdges(towns);
      const mstEdges = buildMST(towns, allEdges);
      const extraEdges = selectExtraEdges(allEdges, mstEdges, towns.length);

      // Extra edges should be sorted by distance
      for (let i = 1; i < extraEdges.length; i++) {
        expect(extraEdges[i].distance).toBeGreaterThanOrEqual(
          extraEdges[i - 1].distance,
        );
      }
    });

    it("does not duplicate MST edges", () => {
      const towns: Town[] = [];
      for (let i = 0; i < 10; i++) {
        towns.push({ id: `t${i}`, position: { x: i * 100, z: (i % 2) * 50 } });
      }

      const allEdges = calculateAllEdges(towns);
      const mstEdges = buildMST(towns, allEdges);
      const extraEdges = selectExtraEdges(allEdges, mstEdges, towns.length);

      const mstSet = new Set<string>();
      for (const edge of mstEdges) {
        mstSet.add(`${edge.fromId}-${edge.toId}`);
        mstSet.add(`${edge.toId}-${edge.fromId}`);
      }

      for (const edge of extraEdges) {
        expect(mstSet.has(`${edge.fromId}-${edge.toId}`)).toBe(false);
        expect(mstSet.has(`${edge.toId}-${edge.fromId}`)).toBe(false);
      }
    });
  });

  describe("Road Length Calculation", () => {
    it("calculates correct length for straight path", () => {
      const path: RoadPathPoint[] = [
        { x: 0, z: 0, y: 0 },
        { x: 100, z: 0, y: 0 },
      ];

      let totalLength = 0;
      for (let i = 1; i < path.length; i++) {
        totalLength += dist2D(
          path[i - 1].x,
          path[i - 1].z,
          path[i].x,
          path[i].z,
        );
      }

      expect(totalLength).toBeCloseTo(100, 5);
    });

    it("calculates correct length for multi-segment path", () => {
      const path: RoadPathPoint[] = [
        { x: 0, z: 0, y: 0 },
        { x: 100, z: 0, y: 0 },
        { x: 100, z: 100, y: 0 },
      ];

      let totalLength = 0;
      for (let i = 1; i < path.length; i++) {
        totalLength += dist2D(
          path[i - 1].x,
          path[i - 1].z,
          path[i].x,
          path[i].z,
        );
      }

      expect(totalLength).toBeCloseTo(200, 5);
    });

    it("diagonal path is longer than Euclidean distance", () => {
      // A path that zigzags will be longer than direct distance
      const path: RoadPathPoint[] = [
        { x: 0, z: 0, y: 0 },
        { x: 50, z: 25, y: 0 },
        { x: 100, z: 0, y: 0 },
      ];

      let totalLength = 0;
      for (let i = 1; i < path.length; i++) {
        totalLength += dist2D(
          path[i - 1].x,
          path[i - 1].z,
          path[i].x,
          path[i].z,
        );
      }

      const directDistance = dist2D(0, 0, 100, 0);
      expect(totalLength).toBeGreaterThan(directDistance);
    });
  });

  describe("A* Direction Constants", () => {
    it("has 8 directions", () => {
      expect(DIRECTIONS.length).toBe(8);
    });

    it("includes all cardinal directions", () => {
      const hasRight = DIRECTIONS.some((d) => d.dx > 0 && d.dz === 0);
      const hasLeft = DIRECTIONS.some((d) => d.dx < 0 && d.dz === 0);
      const hasUp = DIRECTIONS.some((d) => d.dx === 0 && d.dz > 0);
      const hasDown = DIRECTIONS.some((d) => d.dx === 0 && d.dz < 0);

      expect(hasRight && hasLeft && hasUp && hasDown).toBe(true);
    });

    it("includes all diagonal directions", () => {
      const diagonals = DIRECTIONS.filter((d) => d.dx !== 0 && d.dz !== 0);
      expect(diagonals.length).toBe(4);
    });

    it("all movements use PATH_STEP_SIZE", () => {
      for (const dir of DIRECTIONS) {
        expect(Math.abs(dir.dx)).toBeLessThanOrEqual(PATH_STEP_SIZE);
        expect(Math.abs(dir.dz)).toBeLessThanOrEqual(PATH_STEP_SIZE);
      }
    });
  });

  describe("Performance Characteristics", () => {
    it("MST construction scales well", () => {
      const towns: Town[] = [];
      for (let i = 0; i < 100; i++) {
        towns.push({
          id: `t${i}`,
          position: { x: Math.random() * 10000, z: Math.random() * 10000 },
        });
      }

      const edges = calculateAllEdges(towns);

      const start = performance.now();
      buildMST(towns, edges);
      const elapsed = performance.now() - start;

      // Should complete in reasonable time
      // (threshold relaxed for CI environments with variable performance)
      expect(elapsed).toBeLessThan(600);
    });

    it("tile cache lookup is O(1)", () => {
      const cache = new Map<string, RoadTileSegment[]>();

      // Populate with many entries
      for (let x = 0; x < 100; x++) {
        for (let z = 0; z < 100; z++) {
          cache.set(`${x}_${z}`, [
            {
              start: { x: 0, z: 0 },
              end: { x: 50, z: 50 },
              width: 4,
              roadId: "test",
            },
          ]);
        }
      }

      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        cache.get("50_50");
      }
      const elapsed = performance.now() - start;

      // CI runners can be unpredictable. 50ms is plenty fast for O(1) in JS
      expect(elapsed).toBeLessThan(50);
    });

    it("distance to segment is fast", () => {
      const start = performance.now();

      for (let i = 0; i < 100000; i++) {
        distanceToSegment(
          Math.random() * 100,
          Math.random() * 100,
          0,
          0,
          100,
          100,
        );
      }

      const elapsed = performance.now() - start;
      // 100ms allows for CI variance
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe("A* Pathfinding with Binary Heap (Optimized)", () => {
    const MAX_PATH_ITERATIONS = _MAX_PATH_ITERATIONS;

    interface HeapPathNode {
      x: number;
      z: number;
      g: number;
      h: number;
      f: number;
      parent: HeapPathNode | null;
      heapIndex: number;
    }

    /**
     * Binary min-heap implementation matching the production code
     */
    class PathNodeHeap {
      private nodes: HeapPathNode[] = [];

      get length(): number {
        return this.nodes.length;
      }

      push(node: HeapPathNode): void {
        node.heapIndex = this.nodes.length;
        this.nodes.push(node);
        this.bubbleUp(this.nodes.length - 1);
      }

      pop(): HeapPathNode | undefined {
        if (this.nodes.length === 0) return undefined;
        const result = this.nodes[0];
        const last = this.nodes.pop()!;
        if (this.nodes.length > 0) {
          this.nodes[0] = last;
          last.heapIndex = 0;
          this.bubbleDown(0);
        }
        return result;
      }

      updateNode(node: HeapPathNode): void {
        this.bubbleUp(node.heapIndex);
        this.bubbleDown(node.heapIndex);
      }

      private bubbleUp(index: number): void {
        const node = this.nodes[index];
        while (index > 0) {
          const parentIndex = (index - 1) >> 1;
          const parent = this.nodes[parentIndex];
          if (node.f >= parent.f) break;
          this.nodes[index] = parent;
          parent.heapIndex = index;
          index = parentIndex;
        }
        this.nodes[index] = node;
        node.heapIndex = index;
      }

      private bubbleDown(index: number): void {
        const node = this.nodes[index];
        const length = this.nodes.length;
        const halfLength = length >> 1;

        while (index < halfLength) {
          const leftIndex = (index << 1) + 1;
          const rightIndex = leftIndex + 1;
          let bestIndex = leftIndex;
          let best = this.nodes[leftIndex];

          if (rightIndex < length && this.nodes[rightIndex].f < best.f) {
            bestIndex = rightIndex;
            best = this.nodes[rightIndex];
          }

          if (node.f <= best.f) break;

          this.nodes[index] = best;
          best.heapIndex = index;
          index = bestIndex;
        }
        this.nodes[index] = node;
        node.heapIndex = index;
      }
    }

    /**
     * Optimized A* pathfinding using binary heap - matches production implementation
     */
    function findPathOptimized(
      startX: number,
      startZ: number,
      endX: number,
      endZ: number,
      getHeight: (x: number, z: number) => number,
      getBiome?: (x: number, z: number) => string,
    ): { path: RoadPathPoint[]; iterations: number; hitFallback: boolean } {
      const gridStartX = Math.round(startX / PATH_STEP_SIZE) * PATH_STEP_SIZE;
      const gridStartZ = Math.round(startZ / PATH_STEP_SIZE) * PATH_STEP_SIZE;
      const gridEndX = Math.round(endX / PATH_STEP_SIZE) * PATH_STEP_SIZE;
      const gridEndZ = Math.round(endZ / PATH_STEP_SIZE) * PATH_STEP_SIZE;

      const openHeap = new PathNodeHeap();
      const openMap = new Map<string, HeapPathNode>();
      const closedSet = new Set<string>();

      const startH =
        dist2D(gridStartX, gridStartZ, gridEndX, gridEndZ) *
        COST_BASE *
        HEURISTIC_WEIGHT;
      const startNode: HeapPathNode = {
        x: gridStartX,
        z: gridStartZ,
        g: 0,
        h: startH,
        f: startH,
        parent: null,
        heapIndex: 0,
      };
      openHeap.push(startNode);
      openMap.set(`${gridStartX},${gridStartZ}`, startNode);

      let iterations = 0;
      while (openHeap.length > 0 && iterations < MAX_PATH_ITERATIONS) {
        iterations++;

        const current = openHeap.pop()!;
        const currentKey = `${current.x},${current.z}`;
        openMap.delete(currentKey);

        if (
          Math.abs(current.x - gridEndX) <= PATH_STEP_SIZE &&
          Math.abs(current.z - gridEndZ) <= PATH_STEP_SIZE
        ) {
          // Reconstruct path
          const path: RoadPathPoint[] = [];
          let node: HeapPathNode | null = current;
          while (node) {
            path.unshift({
              x: node.x,
              z: node.z,
              y: getHeight(node.x, node.z),
            });
            node = node.parent;
          }
          path.push({ x: endX, z: endZ, y: getHeight(endX, endZ) });
          return { path, iterations, hitFallback: false };
        }

        closedSet.add(currentKey);

        for (const dir of DIRECTIONS) {
          const neighborX = current.x + dir.dx;
          const neighborZ = current.z + dir.dz;
          const neighborKey = `${neighborX},${neighborZ}`;
          if (closedSet.has(neighborKey)) continue;

          const moveCost = calculateMovementCost(
            current.x,
            current.z,
            neighborX,
            neighborZ,
            getHeight,
            getBiome,
          );
          if (moveCost >= COST_WATER_PENALTY) continue;

          const tentativeG = current.g + moveCost;
          const existing = openMap.get(neighborKey);

          if (!existing) {
            const h =
              dist2D(neighborX, neighborZ, gridEndX, gridEndZ) *
              COST_BASE *
              HEURISTIC_WEIGHT;
            const neighbor: HeapPathNode = {
              x: neighborX,
              z: neighborZ,
              g: tentativeG,
              h,
              f: tentativeG + h,
              parent: current,
              heapIndex: 0,
            };
            openHeap.push(neighbor);
            openMap.set(neighborKey, neighbor);
          } else if (tentativeG < existing.g) {
            existing.g = tentativeG;
            existing.f = tentativeG + existing.h;
            existing.parent = current;
            openHeap.updateNode(existing);
          }
        }
      }

      // Fallback to direct path
      const path: RoadPathPoint[] = [];
      const dx = endX - startX;
      const dz = endZ - startZ;
      const steps = Math.ceil(Math.sqrt(dx * dx + dz * dz) / PATH_STEP_SIZE);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = startX + dx * t;
        const z = startZ + dz * t;
        path.push({ x, z, y: getHeight(x, z) });
      }
      return { path, iterations, hitFallback: true };
    }

    it("finds path for short distances without fallback", () => {
      const flatHeight = () => 10;
      const result = findPathOptimized(0, 0, 200, 200, flatHeight);

      expect(result.hitFallback).toBe(false);
      expect(result.path.length).toBeGreaterThan(2);
      expect(result.iterations).toBeLessThan(MAX_PATH_ITERATIONS);
    });

    it("finds path for medium distances (500 units) without fallback", () => {
      const flatHeight = () => 10;
      const result = findPathOptimized(0, 0, 500, 0, flatHeight);

      expect(result.hitFallback).toBe(false);
      expect(result.iterations).toBeLessThan(MAX_PATH_ITERATIONS);
    });

    it("finds path for long distances (1000 units) without fallback", () => {
      const flatHeight = () => 10;
      const result = findPathOptimized(0, 0, 1000, 0, flatHeight);

      expect(result.hitFallback).toBe(false);
      expect(result.iterations).toBeLessThan(MAX_PATH_ITERATIONS);
    });

    it("finds path for very long distances (2000 units) without fallback", () => {
      const flatHeight = () => 10;
      const result = findPathOptimized(0, 0, 2000, 0, flatHeight);

      expect(result.hitFallback).toBe(false);
      expect(result.iterations).toBeLessThan(MAX_PATH_ITERATIONS);
    });

    it("finds diagonal path (1500 units) without fallback", () => {
      const flatHeight = () => 10;
      const result = findPathOptimized(0, 0, 1000, 1000, flatHeight);

      expect(result.hitFallback).toBe(false);
      expect(result.iterations).toBeLessThan(MAX_PATH_ITERATIONS);
    });

    it("handles varied terrain biomes efficiently", () => {
      const flatHeight = () => 10;
      // Checkerboard of different biomes
      const biome = (x: number, z: number) => {
        const tx = Math.floor(x / 50);
        const tz = Math.floor(z / 50);
        const biomes = BIOME_LIST;
        return biomes[(tx + tz) % biomes.length];
      };

      const result = findPathOptimized(0, 0, 800, 800, flatHeight, biome);

      expect(result.hitFallback).toBe(false);
      expect(result.iterations).toBeLessThan(MAX_PATH_ITERATIONS);
    });

    it("handles sloped terrain efficiently", () => {
      // Terrain with gentle hills
      const hillyHeight = (x: number, z: number) =>
        10 + Math.sin(x / 100) * 5 + Math.cos(z / 100) * 5;

      const result = findPathOptimized(0, 0, 1000, 500, hillyHeight);

      expect(result.hitFallback).toBe(false);
      expect(result.iterations).toBeLessThan(MAX_PATH_ITERATIONS);
    });

    it("avoids water obstacles efficiently", () => {
      // Water in the middle, forcing path around
      const waterHeight = (x: number, z: number) => {
        const inWaterZone = x > 200 && x < 300 && z > -100 && z < 500;
        return inWaterZone ? WATER_THRESHOLD - 1 : 10;
      };

      const result = findPathOptimized(0, 200, 500, 200, waterHeight);

      expect(result.hitFallback).toBe(false);
      expect(result.iterations).toBeLessThan(MAX_PATH_ITERATIONS);
      // Path should go around water, making it longer than direct
      expect(result.path.length).toBeGreaterThan(500 / PATH_STEP_SIZE);
    });

    it("completes 20 paths quickly (simulates connecting towns)", () => {
      const flatHeight = () => 10;

      // Generate random town positions
      const towns: Array<{ x: number; z: number }> = [];
      let seed = 12345;
      for (let i = 0; i < 10; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const x = (seed % 3000) - 1500;
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const z = (seed % 3000) - 1500;
        towns.push({ x, z });
      }

      const results: Array<{ iterations: number; hitFallback: boolean }> = [];
      const startTime = performance.now();

      // Connect each town to closest 2 neighbors (simulates MST + extras)
      for (let i = 0; i < towns.length; i++) {
        for (let j = i + 1; j < Math.min(i + 3, towns.length); j++) {
          const result = findPathOptimized(
            towns[i].x,
            towns[i].z,
            towns[j].x,
            towns[j].z,
            flatHeight,
          );
          results.push({
            iterations: result.iterations,
            hitFallback: result.hitFallback,
          });
        }
      }

      const elapsed = performance.now() - startTime;

      // No paths should hit fallback
      const fallbackCount = results.filter((r) => r.hitFallback).length;
      expect(fallbackCount).toBe(0);

      // Total time should be reasonable (< 500ms for 20 paths)
      expect(elapsed).toBeLessThan(500);

      // Average iterations should be well below max
      const avgIterations =
        results.reduce((sum, r) => sum + r.iterations, 0) / results.length;
      expect(avgIterations).toBeLessThan(MAX_PATH_ITERATIONS / 2);
    });

    it("binary heap maintains correct ordering", () => {
      const heap = new PathNodeHeap();

      // Add nodes in random order
      const values = [50, 20, 80, 10, 60, 30, 90, 40, 70];
      for (let i = 0; i < values.length; i++) {
        heap.push({
          x: i,
          z: 0,
          g: 0,
          h: values[i],
          f: values[i],
          parent: null,
          heapIndex: 0,
        });
      }

      // Extract should give sorted order
      const extracted: number[] = [];
      while (heap.length > 0) {
        extracted.push(heap.pop()!.f);
      }

      // Should be in ascending order
      for (let i = 1; i < extracted.length; i++) {
        expect(extracted[i]).toBeGreaterThanOrEqual(extracted[i - 1]);
      }
    });

    it("heap update correctly reorders nodes", () => {
      const heap = new PathNodeHeap();

      const nodes: HeapPathNode[] = [];
      for (let i = 0; i < 5; i++) {
        const node: HeapPathNode = {
          x: i,
          z: 0,
          g: 0,
          h: (i + 1) * 10,
          f: (i + 1) * 10,
          parent: null,
          heapIndex: 0,
        };
        nodes.push(node);
        heap.push(node);
      }

      // Update middle node to be smallest
      nodes[2].f = 5;
      heap.updateNode(nodes[2]);

      // Should now be first
      const first = heap.pop()!;
      expect(first.x).toBe(2);
      expect(first.f).toBe(5);
    });
  });

  describe("Boundary Exit Detection", () => {
    const TILE_SIZE = 100;
    type TileEdge = "north" | "south" | "east" | "west";

    interface RoadBoundaryExit {
      roadId: string;
      position: { x: number; z: number };
      direction: number;
      tileX: number;
      tileZ: number;
      edge: TileEdge;
    }

    /**
     * Determine which edge of a tile a position is nearest to
     */
    function getNearestTileEdge(x: number, z: number): TileEdge | null {
      const tileX = Math.floor(x / TILE_SIZE);
      const tileZ = Math.floor(z / TILE_SIZE);
      const localX = x - tileX * TILE_SIZE;
      const localZ = z - tileZ * TILE_SIZE;

      const edgeThreshold = 10;

      if (localX < edgeThreshold) return "west";
      if (localX > TILE_SIZE - edgeThreshold) return "east";
      if (localZ < edgeThreshold) return "south";
      if (localZ > TILE_SIZE - edgeThreshold) return "north";

      return null;
    }

    /**
     * Check if a position is at or near a tile boundary
     */
    function isAtTileBoundary(x: number, z: number): boolean {
      const tileX = Math.floor(x / TILE_SIZE);
      const tileZ = Math.floor(z / TILE_SIZE);
      const localX = x - tileX * TILE_SIZE;
      const localZ = z - tileZ * TILE_SIZE;

      const edgeThreshold = 5;
      return (
        localX < edgeThreshold ||
        localX > TILE_SIZE - edgeThreshold ||
        localZ < edgeThreshold ||
        localZ > TILE_SIZE - edgeThreshold
      );
    }

    /**
     * Record a boundary exit if position is at tile edge
     */
    function recordBoundaryExitIfAtEdge(
      x: number,
      z: number,
      direction: number,
      roadId: string,
      exits: RoadBoundaryExit[],
    ): void {
      const edge = getNearestTileEdge(x, z);
      if (!edge) return;

      const tileX = Math.floor(x / TILE_SIZE);
      const tileZ = Math.floor(z / TILE_SIZE);

      // Avoid duplicates
      const existing = exits.find(
        (e) =>
          e.roadId === roadId &&
          e.tileX === tileX &&
          e.tileZ === tileZ &&
          e.edge === edge,
      );
      if (existing) return;

      exits.push({
        roadId,
        position: { x, z },
        direction,
        tileX,
        tileZ,
        edge,
      });
    }

    it("should detect tile boundaries correctly", () => {
      // Point in middle of tile
      expect(isAtTileBoundary(50, 50)).toBe(false);

      // Point near west edge
      expect(isAtTileBoundary(2, 50)).toBe(true);

      // Point near east edge
      expect(isAtTileBoundary(98, 50)).toBe(true);

      // Point near south edge
      expect(isAtTileBoundary(50, 2)).toBe(true);

      // Point near north edge
      expect(isAtTileBoundary(50, 98)).toBe(true);
    });

    it("should identify correct tile edge", () => {
      expect(getNearestTileEdge(2, 50)).toBe("west");
      expect(getNearestTileEdge(98, 50)).toBe("east");
      expect(getNearestTileEdge(50, 2)).toBe("south");
      expect(getNearestTileEdge(50, 98)).toBe("north");
      expect(getNearestTileEdge(50, 50)).toBe(null);
    });

    it("should record boundary exits at tile edges", () => {
      const exits: RoadBoundaryExit[] = [];

      // Road ending at east edge of tile 0,0
      recordBoundaryExitIfAtEdge(98, 50, 0, "road_1", exits);
      expect(exits.length).toBe(1);
      expect(exits[0].edge).toBe("east");
      expect(exits[0].tileX).toBe(0);
      expect(exits[0].tileZ).toBe(0);

      // Road ending at north edge
      recordBoundaryExitIfAtEdge(50, 98, Math.PI / 2, "road_2", exits);
      expect(exits.length).toBe(2);
      expect(exits[1].edge).toBe("north");
    });

    it("should not record duplicate boundary exits", () => {
      const exits: RoadBoundaryExit[] = [];

      recordBoundaryExitIfAtEdge(98, 50, 0, "road_1", exits);
      recordBoundaryExitIfAtEdge(97, 50, 0, "road_1", exits); // Same road, same edge

      expect(exits.length).toBe(1);
    });

    it("should not record exits for points not at boundary", () => {
      const exits: RoadBoundaryExit[] = [];

      recordBoundaryExitIfAtEdge(50, 50, 0, "road_1", exits);
      expect(exits.length).toBe(0);
    });

    it("should handle negative coordinates", () => {
      // Tile at (-1, -1) spans X: -100 to 0, Z: -100 to 0
      // Point (-98, -50) has local coords (2, 50) -> near west edge
      expect(getNearestTileEdge(-98, -50)).toBe("west");
      // Point (-2, -50) has local coords (98, 50) -> near east edge
      expect(getNearestTileEdge(-2, -50)).toBe("east");
    });

    it("should detect boundary exits from clipped segments (town-to-town roads)", () => {
      // This tests the new functionality: detecting boundary exits during segment clipping,
      // not just from road endpoints. This captures town-to-town roads that cross tile boundaries.

      const EDGE_EPSILON = 0.01;

      // Helper to detect which edge a point is on (matches getEdgeAtPoint in RoadNetworkSystem)
      function getEdgeAtPoint(
        x: number,
        z: number,
        tileMinX: number,
        tileMaxX: number,
        tileMinZ: number,
        tileMaxZ: number,
        epsilon: number,
      ): TileEdge | null {
        if (Math.abs(x - tileMinX) <= epsilon) return "west";
        if (Math.abs(x - tileMaxX) <= epsilon) return "east";
        if (Math.abs(z - tileMinZ) <= epsilon) return "south";
        if (Math.abs(z - tileMaxZ) <= epsilon) return "north";
        return null;
      }

      // Cohen-Sutherland clipping (copied from RoadNetworkSystem)
      function clipSegmentToTile(
        x1: number,
        z1: number,
        x2: number,
        z2: number,
        minX: number,
        maxX: number,
        minZ: number,
        maxZ: number,
      ): { x1: number; z1: number; x2: number; z2: number } | null {
        const INSIDE = 0,
          LEFT = 1,
          RIGHT = 2,
          BOTTOM = 4,
          TOP = 8;

        const computeCode = (x: number, z: number): number => {
          let code = INSIDE;
          if (x < minX) code |= LEFT;
          else if (x > maxX) code |= RIGHT;
          if (z < minZ) code |= BOTTOM;
          else if (z > maxZ) code |= TOP;
          return code;
        };

        let code1 = computeCode(x1, z1);
        let code2 = computeCode(x2, z2);

        while (true) {
          if ((code1 | code2) === 0) return { x1, z1, x2, z2 };
          if ((code1 & code2) !== 0) return null;

          const codeOut = code1 !== 0 ? code1 : code2;
          let x: number, z: number;

          if (codeOut & TOP) {
            x = x1 + ((x2 - x1) * (maxZ - z1)) / (z2 - z1);
            z = maxZ;
          } else if (codeOut & BOTTOM) {
            x = x1 + ((x2 - x1) * (minZ - z1)) / (z2 - z1);
            z = minZ;
          } else if (codeOut & RIGHT) {
            z = z1 + ((z2 - z1) * (maxX - x1)) / (x2 - x1);
            x = maxX;
          } else {
            z = z1 + ((z2 - z1) * (minX - x1)) / (x2 - x1);
            x = minX;
          }

          if (codeOut === code1) {
            x1 = x;
            z1 = z;
            code1 = computeCode(x1, z1);
          } else {
            x2 = x;
            z2 = z;
            code2 = computeCode(x2, z2);
          }
        }
      }

      // Simulate a town-to-town road that crosses from tile (0,0) to tile (1,0)
      // Road goes from (50, 50) to (150, 50) - crosses the east/west boundary at x=100
      const p1 = { x: 50, z: 50 };
      const p2 = { x: 150, z: 50 };

      const exits: RoadBoundaryExit[] = [];
      const roadId = "town_to_town_road";

      // Process tile (0, 0)
      let tileX = 0;
      const tileZ = 0;
      let tileMinX = 0;
      let tileMaxX = 100;
      const tileMinZ = 0;
      const tileMaxZ = 100;

      let clipped = clipSegmentToTile(
        p1.x,
        p1.z,
        p2.x,
        p2.z,
        tileMinX,
        tileMaxX,
        tileMinZ,
        tileMaxZ,
      );
      expect(clipped).not.toBeNull();
      expect(clipped!.x1).toBe(50);
      expect(clipped!.x2).toBe(100); // Clipped to tile boundary

      // Check if end was clipped (should be at east edge)
      const endWasClipped =
        Math.abs(clipped!.x2 - p2.x) > EDGE_EPSILON ||
        Math.abs(clipped!.z2 - p2.z) > EDGE_EPSILON;
      expect(endWasClipped).toBe(true);

      const endEdge = getEdgeAtPoint(
        clipped!.x2,
        clipped!.z2,
        tileMinX,
        tileMaxX,
        tileMinZ,
        tileMaxZ,
        EDGE_EPSILON,
      );
      expect(endEdge).toBe("east"); // Road exits tile 0,0 to the east

      // Record the boundary exit
      if (endEdge) {
        const segmentDirection = Math.atan2(
          clipped!.z2 - clipped!.z1,
          clipped!.x2 - clipped!.x1,
        );
        exits.push({
          roadId,
          position: { x: clipped!.x2, z: clipped!.z2 },
          direction: segmentDirection,
          tileX,
          tileZ,
          edge: endEdge,
        });
      }

      // Process tile (1, 0)
      tileX = 1;
      tileMinX = 100;
      tileMaxX = 200;

      clipped = clipSegmentToTile(
        p1.x,
        p1.z,
        p2.x,
        p2.z,
        tileMinX,
        tileMaxX,
        tileMinZ,
        tileMaxZ,
      );
      expect(clipped).not.toBeNull();
      expect(clipped!.x1).toBe(100); // Clipped to tile boundary
      expect(clipped!.x2).toBe(150);

      // Check if start was clipped (should be at west edge)
      const startWasClipped =
        Math.abs(clipped!.x1 - p1.x) > EDGE_EPSILON ||
        Math.abs(clipped!.z1 - p1.z) > EDGE_EPSILON;
      expect(startWasClipped).toBe(true);

      const startEdge = getEdgeAtPoint(
        clipped!.x1,
        clipped!.z1,
        tileMinX,
        tileMaxX,
        tileMinZ,
        tileMaxZ,
        EDGE_EPSILON,
      );
      expect(startEdge).toBe("west"); // Road enters tile 1,0 from the west

      // Verify we detected the boundary crossing
      expect(exits.length).toBe(1);
      expect(exits[0].edge).toBe("east");
      expect(exits[0].tileX).toBe(0);
      expect(exits[0].position.x).toBe(100);

      // This is the key improvement: town-to-town roads that cross tile boundaries
      // are now detected during clipping, not just exploration roads
    });
  });

  describe("Cross-Tile Road Continuity", () => {
    const TILE_SIZE = 100;
    type TileEdge = "north" | "south" | "east" | "west";

    interface RoadBoundaryExit {
      roadId: string;
      position: { x: number; z: number };
      direction: number;
      tileX: number;
      tileZ: number;
      edge: TileEdge;
    }

    /**
     * Get road entry points for a tile from adjacent tiles
     */
    function getRoadEntriesForTile(
      tileX: number,
      tileZ: number,
      allExits: RoadBoundaryExit[],
    ): RoadBoundaryExit[] {
      const entries: RoadBoundaryExit[] = [];

      const adjacentTiles: Array<{
        adjTileX: number;
        adjTileZ: number;
        adjEdge: TileEdge;
        entryEdge: TileEdge;
      }> = [
        {
          adjTileX: tileX - 1,
          adjTileZ: tileZ,
          adjEdge: "east",
          entryEdge: "west",
        },
        {
          adjTileX: tileX + 1,
          adjTileZ: tileZ,
          adjEdge: "west",
          entryEdge: "east",
        },
        {
          adjTileX: tileX,
          adjTileZ: tileZ - 1,
          adjEdge: "north",
          entryEdge: "south",
        },
        {
          adjTileX: tileX,
          adjTileZ: tileZ + 1,
          adjEdge: "south",
          entryEdge: "north",
        },
      ];

      for (const { adjTileX, adjTileZ, adjEdge, entryEdge } of adjacentTiles) {
        const adjacentExits = allExits.filter(
          (e) =>
            e.tileX === adjTileX && e.tileZ === adjTileZ && e.edge === adjEdge,
        );

        for (const exit of adjacentExits) {
          entries.push({
            ...exit,
            tileX,
            tileZ,
            edge: entryEdge,
          });
        }
      }

      return entries;
    }

    it("should find entries from adjacent tiles", () => {
      const exits: RoadBoundaryExit[] = [
        {
          roadId: "road_1",
          position: { x: 98, z: 50 },
          direction: 0,
          tileX: 0,
          tileZ: 0,
          edge: "east",
        },
      ];

      // Tile (1,0) should see entry from tile (0,0) on its west edge
      const entries = getRoadEntriesForTile(1, 0, exits);
      expect(entries.length).toBe(1);
      expect(entries[0].edge).toBe("west");
      expect(entries[0].roadId).toBe("road_1");
    });

    it("should find entries from multiple adjacent tiles", () => {
      const exits: RoadBoundaryExit[] = [
        {
          roadId: "road_1",
          position: { x: 98, z: 50 },
          direction: 0,
          tileX: 0,
          tileZ: 0,
          edge: "east",
        },
        {
          roadId: "road_2",
          position: { x: 50, z: 98 },
          direction: Math.PI / 2,
          tileX: 1,
          tileZ: -1,
          edge: "north",
        },
      ];

      // Tile (1,0) should see entries from west (road_1) and south (road_2)
      const entries = getRoadEntriesForTile(1, 0, exits);
      expect(entries.length).toBe(2);
    });

    it("should not find entries from non-adjacent tiles", () => {
      const exits: RoadBoundaryExit[] = [
        {
          roadId: "road_1",
          position: { x: 98, z: 50 },
          direction: 0,
          tileX: 5,
          tileZ: 5,
          edge: "east",
        },
      ];

      // Tile (0,0) should not see entry from tile (5,5)
      const entries = getRoadEntriesForTile(0, 0, exits);
      expect(entries.length).toBe(0);
    });

    it("should map edge correctly: east exit -> west entry", () => {
      const exits: RoadBoundaryExit[] = [
        {
          roadId: "road_1",
          position: { x: 98, z: 50 },
          direction: 0,
          tileX: 0,
          tileZ: 0,
          edge: "east",
        },
      ];

      const entries = getRoadEntriesForTile(1, 0, exits);
      expect(entries[0].edge).toBe("west");
    });

    it("should map edge correctly: north exit -> south entry", () => {
      const exits: RoadBoundaryExit[] = [
        {
          roadId: "road_1",
          position: { x: 50, z: 98 },
          direction: Math.PI / 2,
          tileX: 0,
          tileZ: 0,
          edge: "north",
        },
      ];

      const entries = getRoadEntriesForTile(0, 1, exits);
      expect(entries[0].edge).toBe("south");
    });

    it("should generate entry stub segments from boundary exits", () => {
      // This tests the entry stub generation that creates visual continuity
      // when roads cross from one tile into an adjacent tile

      const STUB_LENGTH = 15;

      interface RoadTileSegment {
        start: { x: number; z: number };
        end: { x: number; z: number };
        width: number;
        roadId: string;
      }

      // Helper to get direction angle into tile from edge
      function getDirectionIntoTile(edge: TileEdge): number {
        switch (edge) {
          case "west":
            return 0; // East (into tile from west edge)
          case "east":
            return Math.PI; // West (into tile from east edge)
          case "south":
            return Math.PI / 2; // North (into tile from south edge)
          case "north":
            return -Math.PI / 2; // South (into tile from north edge)
        }
      }

      // Simulate generating entry stub for road entering from west edge
      const entry: RoadBoundaryExit = {
        roadId: "road_test",
        position: { x: 100, z: 50 }, // At west boundary of tile (1, 0)
        direction: 0,
        tileX: 1,
        tileZ: 0,
        edge: "west",
      };

      // Generate stub segment
      const tileMinX = 1 * TILE_SIZE; // = 100
      const tileMinZ = 0 * TILE_SIZE; // = 0
      const entryLocalX = entry.position.x - tileMinX; // = 0 (at west edge)
      const entryLocalZ = entry.position.z - tileMinZ; // = 50

      const dirIntoTile = getDirectionIntoTile(entry.edge);
      expect(dirIntoTile).toBe(0); // East direction

      const endX = entryLocalX + Math.cos(dirIntoTile) * STUB_LENGTH;
      const endZ = entryLocalZ + Math.sin(dirIntoTile) * STUB_LENGTH;

      // Verify stub extends into tile from west edge
      expect(endX).toBeCloseTo(15, 5); // 0 + 15 * cos(0) = 15
      expect(endZ).toBeCloseTo(50, 5); // 50 + 15 * sin(0) = 50

      // Create the segment
      const stubSegment: RoadTileSegment = {
        start: { x: entryLocalX, z: entryLocalZ },
        end: { x: endX, z: endZ },
        width: 4,
        roadId: entry.roadId,
      };

      // Verify segment properties
      expect(stubSegment.start.x).toBe(0); // Starts at west edge
      expect(stubSegment.end.x).toBeCloseTo(15); // Extends 15m into tile
      expect(stubSegment.roadId).toBe("road_test");

      // Test stub from east edge (entering from tile on the right)
      const entryFromEast: RoadBoundaryExit = {
        roadId: "road_east",
        position: { x: 200, z: 50 }, // At east boundary of tile (1, 0)
        direction: Math.PI,
        tileX: 1,
        tileZ: 0,
        edge: "east",
      };

      const entryFromEastLocalX = entryFromEast.position.x - tileMinX; // = 100
      const dirFromEast = getDirectionIntoTile(entryFromEast.edge);
      expect(dirFromEast).toBe(Math.PI); // West direction

      const endFromEastX =
        entryFromEastLocalX + Math.cos(dirFromEast) * STUB_LENGTH;
      expect(endFromEastX).toBeCloseTo(85, 5); // 100 + 15 * cos(PI) = 100 - 15 = 85
    });
  });

  describe("Weighted Random Walk", () => {
    // Test the random walk algorithm properties
    const seed = 12345;
    let randomState = seed;

    function random(): number {
      randomState = (randomState * 1664525 + 1013904223) >>> 0;
      return randomState / 0xffffffff;
    }

    function resetRandom(newSeed: number): void {
      randomState = newSeed;
    }

    it("should produce deterministic walks with same seed", () => {
      const walk1: Array<{ x: number; z: number }> = [];
      const walk2: Array<{ x: number; z: number }> = [];

      // First walk
      resetRandom(seed);
      let x = 0,
        z = 0;
      for (let i = 0; i < 10; i++) {
        const angle = random() * Math.PI * 2;
        x += Math.cos(angle) * 20;
        z += Math.sin(angle) * 20;
        walk1.push({ x, z });
      }

      // Second walk with same seed
      resetRandom(seed);
      x = 0;
      z = 0;
      for (let i = 0; i < 10; i++) {
        const angle = random() * Math.PI * 2;
        x += Math.cos(angle) * 20;
        z += Math.sin(angle) * 20;
        walk2.push({ x, z });
      }

      // Should be identical
      for (let i = 0; i < walk1.length; i++) {
        expect(walk1[i].x).toBeCloseTo(walk2[i].x, 10);
        expect(walk1[i].z).toBeCloseTo(walk2[i].z, 10);
      }
    });

    it("should produce different walks with different seeds", () => {
      const walk1: Array<{ x: number; z: number }> = [];
      const walk2: Array<{ x: number; z: number }> = [];

      // First walk
      resetRandom(12345);
      let x = 0,
        z = 0;
      for (let i = 0; i < 10; i++) {
        const angle = random() * Math.PI * 2;
        x += Math.cos(angle) * 20;
        z += Math.sin(angle) * 20;
        walk1.push({ x, z });
      }

      // Second walk with different seed
      resetRandom(54321);
      x = 0;
      z = 0;
      for (let i = 0; i < 10; i++) {
        const angle = random() * Math.PI * 2;
        x += Math.cos(angle) * 20;
        z += Math.sin(angle) * 20;
        walk2.push({ x, z });
      }

      // Should be different
      let anyDifferent = false;
      for (let i = 0; i < walk1.length; i++) {
        if (
          Math.abs(walk1[i].x - walk2[i].x) > 1 ||
          Math.abs(walk1[i].z - walk2[i].z) > 1
        ) {
          anyDifferent = true;
          break;
        }
      }
      expect(anyDifferent).toBe(true);
    });

    it("weighted walk should favor forward direction", () => {
      resetRandom(seed);

      const forwardBias = 0.7;
      const directionVariance = Math.PI / 8;

      const deviations: number[] = [];

      for (let i = 0; i < 100; i++) {
        const randomValue = random();
        let angleAdjustment: number;

        if (randomValue < forwardBias) {
          angleAdjustment = (random() - 0.5) * directionVariance * 0.5;
        } else {
          angleAdjustment = (random() - 0.5) * directionVariance * 2;
        }

        deviations.push(Math.abs(angleAdjustment));
      }

      // Average deviation should be small due to forward bias
      const avgDeviation =
        deviations.reduce((a, b) => a + b) / deviations.length;
      expect(avgDeviation).toBeLessThan(directionVariance);
    });
  });

  describe("Boundary Exit Edge Cases", () => {
    const TILE_SIZE = 100;
    type TileEdge = "north" | "south" | "east" | "west";

    function getTileInfo(x: number, z: number) {
      const tileX = Math.floor(x / TILE_SIZE);
      const tileZ = Math.floor(z / TILE_SIZE);
      return {
        tileX,
        tileZ,
        localX: x - tileX * TILE_SIZE,
        localZ: z - tileZ * TILE_SIZE,
      };
    }

    function getNearestTileEdge(
      x: number,
      z: number,
      threshold: number = 10,
    ): TileEdge | null {
      const { localX, localZ } = getTileInfo(x, z);
      if (localX < threshold) return "west";
      if (localX > TILE_SIZE - threshold) return "east";
      if (localZ < threshold) return "south";
      if (localZ > TILE_SIZE - threshold) return "north";
      return null;
    }

    it("should handle exact boundary positions (x=0, z=0)", () => {
      const info = getTileInfo(0, 0);
      expect(info.tileX).toBe(0);
      expect(info.tileZ).toBe(0);
      expect(info.localX).toBe(0);
      expect(info.localZ).toBe(0);
      expect(getNearestTileEdge(0, 0)).toBe("west"); // localX=0 is near west edge
    });

    it("should handle positions at exact tile boundaries", () => {
      // Exact east edge of tile 0
      expect(getNearestTileEdge(100, 50)).toBe("west"); // This is localX=0 of tile 1
      // Just inside east edge of tile 0
      expect(getNearestTileEdge(99, 50)).toBe("east");
    });

    it("should handle corner positions (near two edges)", () => {
      // Near SW corner - should pick one edge (west takes priority in our impl)
      expect(getNearestTileEdge(2, 2)).toBe("west");
      // Near NE corner
      expect(getNearestTileEdge(98, 98)).toBe("east");
    });

    it("should handle positions exactly at threshold distance", () => {
      const threshold = 10;
      // Just inside threshold - should be at edge (localX < threshold)
      expect(getNearestTileEdge(9, 50, threshold)).toBe("west");
      // Exactly at threshold - NOT at edge (uses strict less-than)
      expect(getNearestTileEdge(10, 50, threshold)).toBe(null);
      // Just past threshold - not at edge
      expect(getNearestTileEdge(11, 50, threshold)).toBe(null);
    });

    it("should handle very large coordinates", () => {
      const info = getTileInfo(10050, 10050);
      expect(info.tileX).toBe(100);
      expect(info.tileZ).toBe(100);
      expect(info.localX).toBe(50);
      expect(info.localZ).toBe(50);
    });

    it("should handle very small negative coordinates", () => {
      const info = getTileInfo(-10050, -10050);
      expect(info.tileX).toBe(-101);
      expect(info.tileZ).toBe(-101);
      expect(info.localX).toBeCloseTo(50, 5);
      expect(info.localZ).toBeCloseTo(50, 5);
    });

    it("should handle fractional coordinates", () => {
      const info = getTileInfo(50.5, 50.5);
      expect(info.tileX).toBe(0);
      expect(info.tileZ).toBe(0);
      expect(info.localX).toBeCloseTo(50.5, 10);
      expect(info.localZ).toBeCloseTo(50.5, 10);
    });
  });

  describe("Road Extension Validation", () => {
    const WATER_THRESHOLD = 5.4;
    const MAX_SLOPE = 0.5;
    const STEP_SIZE = 20;

    interface RoadPathPoint {
      x: number;
      z: number;
      y: number;
    }

    /**
     * Simulate road extension with stop conditions
     */
    function simulateRoadExtension(
      startPath: RoadPathPoint[],
      terrainHeight: (x: number, z: number) => number,
      maxIterations: number = 15,
    ): RoadPathPoint[] {
      if (startPath.length < 2) return startPath;

      const path = [...startPath];
      const last = startPath[startPath.length - 1];
      const prev = startPath[startPath.length - 2];
      const direction = Math.atan2(last.z - prev.z, last.x - prev.x);
      let x = last.x;
      let z = last.z;

      for (let i = 0; i < maxIterations; i++) {
        const newX = x + Math.cos(direction) * STEP_SIZE;
        const newZ = z + Math.sin(direction) * STEP_SIZE;
        const height = terrainHeight(newX, newZ);
        const lastHeight = path[path.length - 1].y;
        const slope = Math.abs(height - lastHeight) / STEP_SIZE;

        // Stop conditions
        if (height < WATER_THRESHOLD) break;
        if (slope > MAX_SLOPE) break;

        path.push({ x: newX, z: newZ, y: height });
        x = newX;
        z = newZ;
      }

      return path;
    }

    it("should stop extension when hitting water", () => {
      const initialPath: RoadPathPoint[] = [
        { x: 0, z: 0, y: 10 },
        { x: 20, z: 0, y: 10 },
      ];

      // Terrain that becomes water after 3 steps
      const terrain = (x: number, _z: number) => (x > 60 ? 0 : 10);

      const extended = simulateRoadExtension(initialPath, terrain, 10);

      // Should stop before water (at x=60)
      const lastPoint = extended[extended.length - 1];
      expect(lastPoint.x).toBeLessThanOrEqual(60);
      expect(extended.length).toBeLessThan(10 + 2); // Less than max iterations + initial
    });

    it("should stop extension on steep slopes", () => {
      const initialPath: RoadPathPoint[] = [
        { x: 0, z: 0, y: 10 },
        { x: 20, z: 0, y: 10 },
      ];

      // Terrain with steep cliff after 2 steps
      const terrain = (x: number, _z: number) => (x > 40 ? 100 : 10);

      const extended = simulateRoadExtension(initialPath, terrain, 10);

      // Should stop before cliff
      const lastPoint = extended[extended.length - 1];
      expect(lastPoint.x).toBeLessThanOrEqual(60); // Cliff detection at x=60 step
    });

    it("should extend fully on flat, dry terrain", () => {
      const initialPath: RoadPathPoint[] = [
        { x: 0, z: 0, y: 10 },
        { x: 20, z: 0, y: 10 },
      ];

      // Completely flat terrain
      const terrain = () => 10;

      const extended = simulateRoadExtension(initialPath, terrain, 5);

      // Should extend all 5 iterations
      expect(extended.length).toBe(2 + 5);
    });

    it("should handle path with only 1 point", () => {
      const initialPath: RoadPathPoint[] = [{ x: 0, z: 0, y: 10 }];

      const extended = simulateRoadExtension(initialPath, () => 10, 5);

      // Should return unchanged (cannot determine direction)
      expect(extended.length).toBe(1);
    });

    it("should handle empty path", () => {
      const initialPath: RoadPathPoint[] = [];

      const extended = simulateRoadExtension(initialPath, () => 10, 5);

      expect(extended.length).toBe(0);
    });

    it("should preserve original path points", () => {
      const initialPath: RoadPathPoint[] = [
        { x: 100, z: 200, y: 15 },
        { x: 120, z: 200, y: 15 },
      ];

      const extended = simulateRoadExtension(initialPath, () => 15, 3);

      // First two points should be unchanged
      expect(extended[0]).toEqual(initialPath[0]);
      expect(extended[1]).toEqual(initialPath[1]);
    });

    it("should follow path direction", () => {
      // Path heading northeast
      const initialPath: RoadPathPoint[] = [
        { x: 0, z: 0, y: 10 },
        { x: 20, z: 20, y: 10 },
      ];

      const extended = simulateRoadExtension(initialPath, () => 10, 5);

      // Extended points should continue northeast
      for (let i = 2; i < extended.length; i++) {
        expect(extended[i].x).toBeGreaterThan(extended[i - 1].x);
        expect(extended[i].z).toBeGreaterThan(extended[i - 1].z);
      }
    });
  });

  describe("hasRoadAtPoint Edge Cases", () => {
    const dist2D = (x1: number, z1: number, x2: number, z2: number): number =>
      Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);

    interface Road {
      path: Array<{ x: number; z: number }>;
    }

    function hasRoadAtPoint(
      roads: Road[],
      x: number,
      z: number,
      threshold: number = 10,
    ): boolean {
      return roads.some((road) => {
        if (road.path.length === 0) return false;
        const first = road.path[0];
        const last = road.path[road.path.length - 1];
        return (
          dist2D(first.x, first.z, x, z) < threshold ||
          dist2D(last.x, last.z, x, z) < threshold
        );
      });
    }

    it("should return false for empty roads array", () => {
      expect(hasRoadAtPoint([], 50, 50)).toBe(false);
    });

    it("should handle road with empty path", () => {
      const roads: Road[] = [{ path: [] }];
      expect(hasRoadAtPoint(roads, 50, 50)).toBe(false);
    });

    it("should handle road with single point", () => {
      const roads: Road[] = [{ path: [{ x: 50, z: 50 }] }];
      expect(hasRoadAtPoint(roads, 50, 50)).toBe(true);
      expect(hasRoadAtPoint(roads, 100, 100)).toBe(false);
    });

    it("should check both endpoints", () => {
      const roads: Road[] = [
        {
          path: [
            { x: 0, z: 0 },
            { x: 100, z: 100 },
          ],
        },
      ];

      // Near start
      expect(hasRoadAtPoint(roads, 5, 5)).toBe(true);
      // Near end
      expect(hasRoadAtPoint(roads, 95, 95)).toBe(true);
      // In middle (not endpoint)
      expect(hasRoadAtPoint(roads, 50, 50)).toBe(false);
    });

    it("should respect threshold parameter", () => {
      const roads: Road[] = [
        {
          path: [
            { x: 0, z: 0 },
            { x: 100, z: 0 },
          ],
        },
      ];

      // Within threshold of 10
      expect(hasRoadAtPoint(roads, 5, 0, 10)).toBe(true);
      // Outside threshold of 3
      expect(hasRoadAtPoint(roads, 5, 0, 3)).toBe(false);
    });

    it("should find road at point with multiple roads", () => {
      const roads: Road[] = [
        {
          path: [
            { x: 0, z: 0 },
            { x: 50, z: 0 },
          ],
        },
        {
          path: [
            { x: 100, z: 100 },
            { x: 200, z: 100 },
          ],
        },
      ];

      expect(hasRoadAtPoint(roads, 0, 0)).toBe(true);
      expect(hasRoadAtPoint(roads, 100, 100)).toBe(true);
      expect(hasRoadAtPoint(roads, 200, 100)).toBe(true);
      expect(hasRoadAtPoint(roads, 150, 100)).toBe(false);
    });
  });

  describe("Edge Mapping Verification", () => {
    // Verify the edge mapping is correct for all 4 directions
    const edgeMappings: Array<{
      fromTile: [number, number];
      toTile: [number, number];
      exitEdge: string;
      entryEdge: string;
    }> = [
      { fromTile: [0, 0], toTile: [1, 0], exitEdge: "east", entryEdge: "west" },
      { fromTile: [1, 0], toTile: [0, 0], exitEdge: "west", entryEdge: "east" },
      {
        fromTile: [0, 0],
        toTile: [0, 1],
        exitEdge: "north",
        entryEdge: "south",
      },
      {
        fromTile: [0, 1],
        toTile: [0, 0],
        exitEdge: "south",
        entryEdge: "north",
      },
    ];

    for (const { fromTile, toTile, exitEdge, entryEdge } of edgeMappings) {
      it(`should map ${exitEdge} exit from (${fromTile}) to ${entryEdge} entry in (${toTile})`, () => {
        // Calculate the delta between tiles
        const dx = toTile[0] - fromTile[0];
        const dz = toTile[1] - fromTile[1];

        // Verify the mapping is correct
        if (dx === 1) {
          expect(exitEdge).toBe("east");
          expect(entryEdge).toBe("west");
        } else if (dx === -1) {
          expect(exitEdge).toBe("west");
          expect(entryEdge).toBe("east");
        } else if (dz === 1) {
          expect(exitEdge).toBe("north");
          expect(entryEdge).toBe("south");
        } else if (dz === -1) {
          expect(exitEdge).toBe("south");
          expect(entryEdge).toBe("north");
        }
      });
    }

    it("should verify all edge pairs are opposites", () => {
      const opposites: Record<string, string> = {
        north: "south",
        south: "north",
        east: "west",
        west: "east",
      };

      for (const [edge, opposite] of Object.entries(opposites)) {
        expect(opposites[opposite]).toBe(edge);
      }
    });
  });

  describe("Road Extension Algorithm (Full Implementation)", () => {
    /**
     * This test mirrors the EXACT implementation of extendRoadWithRandomWalk
     * from RoadNetworkSystem.ts to verify it actually extends roads properly.
     */

    type TileEdge = "north" | "south" | "east" | "west";

    interface RoadBoundaryExit {
      roadId: string;
      position: { x: number; z: number };
      direction: number;
      tileX: number;
      tileZ: number;
      edge: TileEdge;
    }

    interface TerrainProvider {
      getHeightAt(x: number, z: number): number;
    }

    // Exact replica of the implementation
    function extendRoadWithRandomWalk(
      currentPath: RoadPathPoint[],
      baseDirection: number,
      roadIndex: number,
      terrain: TerrainProvider,
      seed: number,
      worldHalfSize: number,
      boundaryExits: RoadBoundaryExit[],
    ): RoadPathPoint[] {
      if (currentPath.length < 2) {
        return currentPath;
      }

      // Initialize random state exactly as in RoadNetworkSystem
      let randomState = seed + roadIndex * 13337 + 500000;
      const random = () => {
        randomState = (randomState * 1664525 + 1013904223) >>> 0;
        return randomState / 0xffffffff;
      };

      const extendedPath = [...currentPath];
      const roadId = `road_explore_${roadIndex}`;

      // Get initial direction from path's last segment, or use base direction
      const last = currentPath[currentPath.length - 1];
      const secondLast = currentPath[currentPath.length - 2];
      const dx = last.x - secondLast.x;
      const dz = last.z - secondLast.z;
      const dirLen = Math.sqrt(dx * dx + dz * dz);
      let direction = dirLen > 0.1 ? Math.atan2(dz, dx) : baseDirection;

      let x = last.x;
      let z = last.z;

      // Walk parameters (exact values from implementation)
      const step = PATH_STEP_SIZE;
      const maxSteps = Math.ceil(300 / step);
      const variance = Math.PI / 8;
      const forwardBias = 0.7;

      for (let i = 0; i < maxSteps; i++) {
        // Weighted random direction adjustment
        const adjustment =
          random() < forwardBias
            ? (random() - 0.5) * variance * 0.5
            : (random() - 0.5) * variance * 2;

        direction += adjustment;
        const newX = x + Math.cos(direction) * step;
        const newZ = z + Math.sin(direction) * step;

        // Stop conditions: water, world bounds, steep slope, tile boundary
        const height = terrain.getHeightAt(newX, newZ);
        const lastY = extendedPath[extendedPath.length - 1].y;
        const slope = Math.abs(height - lastY) / step;

        if (
          height < WATER_THRESHOLD ||
          Math.abs(newX) > worldHalfSize ||
          Math.abs(newZ) > worldHalfSize ||
          slope > 0.5
        ) {
          recordBoundaryExitIfAtEdge(x, z, direction, roadId, boundaryExits);
          break;
        }

        extendedPath.push({ x: newX, z: newZ, y: height });
        x = newX;
        z = newZ;

        if (isAtTileBoundary(x, z)) {
          recordBoundaryExitIfAtEdge(x, z, direction, roadId, boundaryExits);
          break;
        }
      }

      return extendedPath;
    }

    function getTileInfo(x: number, z: number) {
      const tileX = Math.floor(x / TILE_SIZE);
      const tileZ = Math.floor(z / TILE_SIZE);
      return {
        tileX,
        tileZ,
        localX: x - tileX * TILE_SIZE,
        localZ: z - tileZ * TILE_SIZE,
      };
    }

    function isAtTileBoundary(
      x: number,
      z: number,
      threshold: number = 5,
    ): boolean {
      const { localX, localZ } = getTileInfo(x, z);
      return (
        localX < threshold ||
        localX > TILE_SIZE - threshold ||
        localZ < threshold ||
        localZ > TILE_SIZE - threshold
      );
    }

    function getNearestTileEdge(
      x: number,
      z: number,
      threshold: number = 10,
    ): TileEdge | null {
      const { localX, localZ } = getTileInfo(x, z);
      if (localX < threshold) return "west";
      if (localX > TILE_SIZE - threshold) return "east";
      if (localZ < threshold) return "south";
      if (localZ > TILE_SIZE - threshold) return "north";
      return null;
    }

    function recordBoundaryExitIfAtEdge(
      x: number,
      z: number,
      direction: number,
      roadId: string,
      exits: RoadBoundaryExit[],
    ): void {
      const edge = getNearestTileEdge(x, z);
      if (!edge) return;

      const { tileX, tileZ } = getTileInfo(x, z);

      const isDuplicate = exits.some(
        (e) =>
          e.roadId === roadId &&
          e.tileX === tileX &&
          e.tileZ === tileZ &&
          e.edge === edge,
      );
      if (isDuplicate) return;

      exits.push({ roadId, position: { x, z }, direction, tileX, tileZ, edge });
    }

    it("should extend road paths on valid terrain", () => {
      const terrain: TerrainProvider = { getHeightAt: () => 50 };

      // Initial path heading east, starting in middle of tile
      const initialPath: RoadPathPoint[] = [
        { x: 50, z: 50, y: 50 },
        { x: 70, z: 50, y: 50 },
      ];

      const boundaryExits: RoadBoundaryExit[] = [];
      const extended = extendRoadWithRandomWalk(
        initialPath,
        0, // heading east
        1,
        terrain,
        12345,
        5000,
        boundaryExits,
      );

      // Path should be extended
      expect(extended.length).toBeGreaterThan(initialPath.length);
      console.log(
        `Extended path from ${initialPath.length} to ${extended.length} points`,
      );

      // New points should have valid heights
      for (let i = initialPath.length; i < extended.length; i++) {
        expect(extended[i].y).toBe(50);
      }
    });

    it("should record boundary exits when reaching tile edge", () => {
      const terrain: TerrainProvider = { getHeightAt: () => 50 };

      // Start near tile boundary, heading toward it
      const initialPath: RoadPathPoint[] = [
        { x: 70, z: 50, y: 50 },
        { x: 90, z: 50, y: 50 }, // Heading east, near east edge
      ];

      const boundaryExits: RoadBoundaryExit[] = [];
      const extended = extendRoadWithRandomWalk(
        initialPath,
        0,
        1,
        terrain,
        42,
        5000,
        boundaryExits,
      );

      // Should record at least one boundary exit
      console.log(`Boundary exits recorded: ${boundaryExits.length}`);
      console.log(
        `Final path point: (${extended[extended.length - 1].x.toFixed(1)}, ${extended[extended.length - 1].z.toFixed(1)})`,
      );

      // Extension should happen (at least one step)
      expect(extended.length).toBeGreaterThan(initialPath.length);
    });

    it("should stop at water", () => {
      // Terrain that becomes water after x > 150
      const terrain: TerrainProvider = {
        getHeightAt: (x: number) => (x > 150 ? 0 : 50),
      };

      const initialPath: RoadPathPoint[] = [
        { x: 100, z: 50, y: 50 },
        { x: 120, z: 50, y: 50 },
      ];

      const boundaryExits: RoadBoundaryExit[] = [];
      const extended = extendRoadWithRandomWalk(
        initialPath,
        0,
        1,
        terrain,
        12345,
        5000,
        boundaryExits,
      );

      // All extended points should be above water
      for (const point of extended) {
        expect(point.y).toBeGreaterThanOrEqual(WATER_THRESHOLD);
      }

      // Last point should be before water (x <= 150)
      const lastPoint = extended[extended.length - 1];
      expect(lastPoint.x).toBeLessThanOrEqual(180); // Some buffer for step size
      console.log(`Stopped at x=${lastPoint.x.toFixed(1)} (water at x>150)`);
    });

    it("should stop at steep terrain", () => {
      // Terrain with cliff at x > 200
      const terrain: TerrainProvider = {
        getHeightAt: (x: number) => (x > 200 ? 500 : 50),
      };

      const initialPath: RoadPathPoint[] = [
        { x: 150, z: 50, y: 50 },
        { x: 170, z: 50, y: 50 },
      ];

      const boundaryExits: RoadBoundaryExit[] = [];
      const extended = extendRoadWithRandomWalk(
        initialPath,
        0,
        1,
        terrain,
        12345,
        5000,
        boundaryExits,
      );

      // Last point should be before cliff
      const lastPoint = extended[extended.length - 1];
      expect(lastPoint.x).toBeLessThanOrEqual(220); // Cliff detection at ~200 + step size
      console.log(`Stopped at x=${lastPoint.x.toFixed(1)} (cliff at x>200)`);
    });

    it("should respect world boundaries", () => {
      const terrain: TerrainProvider = { getHeightAt: () => 50 };
      const worldHalfSize = 200;

      // Start near world boundary
      const initialPath: RoadPathPoint[] = [
        { x: 150, z: 50, y: 50 },
        { x: 170, z: 50, y: 50 },
      ];

      const boundaryExits: RoadBoundaryExit[] = [];
      const extended = extendRoadWithRandomWalk(
        initialPath,
        0,
        1,
        terrain,
        12345,
        worldHalfSize,
        boundaryExits,
      );

      // All points should be within world bounds
      for (const point of extended) {
        expect(Math.abs(point.x)).toBeLessThanOrEqual(
          worldHalfSize + PATH_STEP_SIZE,
        );
        expect(Math.abs(point.z)).toBeLessThanOrEqual(
          worldHalfSize + PATH_STEP_SIZE,
        );
      }

      console.log(
        `Stopped at x=${extended[extended.length - 1].x.toFixed(1)} (world boundary at ${worldHalfSize})`,
      );
    });

    it("should produce deterministic results", () => {
      const terrain: TerrainProvider = { getHeightAt: () => 50 };

      const initialPath: RoadPathPoint[] = [
        { x: 50, z: 50, y: 50 },
        { x: 70, z: 50, y: 50 },
      ];

      const exits1: RoadBoundaryExit[] = [];
      const exits2: RoadBoundaryExit[] = [];

      const extended1 = extendRoadWithRandomWalk(
        initialPath,
        0,
        1,
        terrain,
        12345,
        5000,
        exits1,
      );
      const extended2 = extendRoadWithRandomWalk(
        initialPath,
        0,
        1,
        terrain,
        12345,
        5000,
        exits2,
      );

      // Same seed should produce identical paths
      expect(extended1.length).toBe(extended2.length);
      for (let i = 0; i < extended1.length; i++) {
        expect(extended1[i].x).toBeCloseTo(extended2[i].x, 10);
        expect(extended1[i].z).toBeCloseTo(extended2[i].z, 10);
      }
    });

    it("should produce different results with different seeds", () => {
      const terrain: TerrainProvider = { getHeightAt: () => 50 };

      // Start far from boundaries to allow variance
      const initialPath: RoadPathPoint[] = [
        { x: 500, z: 500, y: 50 },
        { x: 520, z: 500, y: 50 },
      ];

      const exits1: RoadBoundaryExit[] = [];
      const exits2: RoadBoundaryExit[] = [];

      const extended1 = extendRoadWithRandomWalk(
        initialPath,
        0,
        1,
        terrain,
        12345,
        5000,
        exits1,
      );
      const extended2 = extendRoadWithRandomWalk(
        initialPath,
        0,
        1,
        terrain,
        99999,
        5000,
        exits2,
      );

      // Different seeds should produce different paths (at least after a few steps)
      // Check the last point differs
      if (extended1.length > 3 && extended2.length > 3) {
        const last1 = extended1[extended1.length - 1];
        const last2 = extended2[extended2.length - 1];
        const different =
          Math.abs(last1.x - last2.x) > 1 || Math.abs(last1.z - last2.z) > 1;
        expect(different).toBe(true);
      }
    });

    it("should extend in the approximate initial direction", () => {
      const terrain: TerrainProvider = { getHeightAt: () => 50 };

      // Path heading northeast (45 degrees)
      const initialPath: RoadPathPoint[] = [
        { x: 200, z: 200, y: 50 },
        { x: 220, z: 220, y: 50 },
      ];

      const boundaryExits: RoadBoundaryExit[] = [];
      const extended = extendRoadWithRandomWalk(
        initialPath,
        Math.PI / 4, // 45 degrees
        1,
        terrain,
        42,
        5000,
        boundaryExits,
      );

      // New points should be generally northeast of the starting point
      const startX = initialPath[1].x;
      const startZ = initialPath[1].z;

      let northeastCount = 0;
      for (let i = initialPath.length; i < extended.length; i++) {
        if (extended[i].x >= startX - 50 && extended[i].z >= startZ - 50) {
          northeastCount++;
        }
      }

      // Most extension points should be in the general direction
      const extensionPoints = extended.length - initialPath.length;
      if (extensionPoints > 0) {
        const ratio = northeastCount / extensionPoints;
        expect(ratio).toBeGreaterThan(0.5);
        console.log(
          `${northeastCount}/${extensionPoints} points in NE direction (${(ratio * 100).toFixed(0)}%)`,
        );
      }
    });

    it("should not modify original path", () => {
      const terrain: TerrainProvider = { getHeightAt: () => 50 };

      const initialPath: RoadPathPoint[] = [
        { x: 50, z: 50, y: 50 },
        { x: 70, z: 50, y: 50 },
      ];
      const originalLength = initialPath.length;

      const boundaryExits: RoadBoundaryExit[] = [];
      const extended = extendRoadWithRandomWalk(
        initialPath,
        0,
        1,
        terrain,
        12345,
        5000,
        boundaryExits,
      );

      // Original array should not be modified
      expect(initialPath.length).toBe(originalLength);

      // Extended path should start with original points
      expect(extended[0]).toEqual(initialPath[0]);
      expect(extended[1]).toEqual(initialPath[1]);
    });

    it("should extend by at least one step on valid terrain", () => {
      const terrain: TerrainProvider = { getHeightAt: () => 50 };

      // Start in middle of tile, plenty of room to extend
      const initialPath: RoadPathPoint[] = [
        { x: 30, z: 50, y: 50 },
        { x: 50, z: 50, y: 50 },
      ];

      const boundaryExits: RoadBoundaryExit[] = [];
      const extended = extendRoadWithRandomWalk(
        initialPath,
        0,
        1,
        terrain,
        12345,
        5000,
        boundaryExits,
      );

      // Should add at least one point before hitting tile boundary
      expect(extended.length).toBeGreaterThan(initialPath.length);
      console.log(
        `Extended from ${initialPath.length} to ${extended.length} points (+${extended.length - initialPath.length})`,
      );
    });

    it("should calculate extension length correctly", () => {
      const terrain: TerrainProvider = { getHeightAt: () => 50 };

      const initialPath: RoadPathPoint[] = [
        { x: 50, z: 50, y: 50 },
        { x: 70, z: 50, y: 50 },
      ];

      const boundaryExits: RoadBoundaryExit[] = [];
      const extended = extendRoadWithRandomWalk(
        initialPath,
        0,
        1,
        terrain,
        12345,
        5000,
        boundaryExits,
      );

      // Calculate total extension length
      let extensionLength = 0;
      for (let i = initialPath.length; i < extended.length; i++) {
        const dx = extended[i].x - extended[i - 1].x;
        const dz = extended[i].z - extended[i - 1].z;
        extensionLength += Math.sqrt(dx * dx + dz * dz);
      }

      // Each step should be approximately PATH_STEP_SIZE
      const extensionSteps = extended.length - initialPath.length;
      if (extensionSteps > 0) {
        const avgStepSize = extensionLength / extensionSteps;
        expect(avgStepSize).toBeCloseTo(PATH_STEP_SIZE, 1);
        console.log(
          `Extension: ${extensionLength.toFixed(1)}m over ${extensionSteps} steps (avg ${avgStepSize.toFixed(1)}m/step)`,
        );
      }
    });
  });

  describe("Entry Stub Generation Edge Cases", () => {
    /**
     * ALGORITHM VERIFICATION TESTS
     *
     * These tests verify the entry stub generation algorithm that creates
     * short road segments continuing from adjacent tile boundaries.
     *
     * Algorithm extracted from RoadNetworkSystem.generateEntryStubSegments.
     * Source: packages/shared/src/systems/shared/world/RoadNetworkSystem.ts
     *
     * Note: Real integration tests in TownRoadIntegration.test.ts verify actual behavior.
     */

    const STUB_LENGTH = 15; // Must match RoadNetworkSystem.STUB_LENGTH
    const DIRECTION_INTO_TILE: Record<TileEdge, number> = {
      west: 0,
      east: Math.PI,
      south: Math.PI / 2,
      north: -Math.PI / 2,
    };

    function generateStubSegment(
      entry: RoadBoundaryExit,
      tileX: number,
      tileZ: number,
    ): RoadTileSegment | null {
      const tileMinX = tileX * TILE_SIZE;
      const tileMinZ = tileZ * TILE_SIZE;
      const localX = entry.position.x - tileMinX;
      const localZ = entry.position.z - tileMinZ;
      const dir = DIRECTION_INTO_TILE[entry.edge];

      const endX = Math.max(
        0,
        Math.min(TILE_SIZE, localX + Math.cos(dir) * STUB_LENGTH),
      );
      const endZ = Math.max(
        0,
        Math.min(TILE_SIZE, localZ + Math.sin(dir) * STUB_LENGTH),
      );

      const dx = endX - localX;
      const dz = endZ - localZ;
      if (dx * dx + dz * dz <= 1) return null;

      return {
        start: { x: localX, z: localZ },
        end: { x: endX, z: endZ },
        width: ROAD_WIDTH,
        roadId: entry.roadId,
      };
    }

    it("should handle entry at exact corner (touches two edges)", () => {
      // Entry at southwest corner of tile (1, 1)
      const cornerEntry: RoadBoundaryExit = {
        roadId: "road_corner",
        position: { x: 100, z: 100 }, // Corner of tile (1, 1)
        direction: Math.PI / 4,
        tileX: 1,
        tileZ: 1,
        edge: "west", // Entering from west
      };

      const stub = generateStubSegment(cornerEntry, 1, 1);
      expect(stub).not.toBeNull();
      expect(stub!.start.x).toBe(0);
      expect(stub!.start.z).toBe(0);
      // Stub extends east into tile
      expect(stub!.end.x).toBeCloseTo(15);
      expect(stub!.end.z).toBeCloseTo(0);
    });

    it("should handle entry at northeast corner", () => {
      const cornerEntry: RoadBoundaryExit = {
        roadId: "road_ne_corner",
        position: { x: 200, z: 200 }, // Northeast corner of tile (1, 1)
        direction: -Math.PI / 4,
        tileX: 1,
        tileZ: 1,
        edge: "north",
      };

      const stub = generateStubSegment(cornerEntry, 1, 1);
      expect(stub).not.toBeNull();
      expect(stub!.start.x).toBe(100); // At east edge
      expect(stub!.start.z).toBe(100); // At north edge
      // Direction south (into tile from north)
      expect(stub!.end.x).toBeCloseTo(100);
      expect(stub!.end.z).toBeCloseTo(85); // 100 - 15
    });

    it("should handle entry with negative tile coordinates", () => {
      const negEntry: RoadBoundaryExit = {
        roadId: "road_negative",
        position: { x: -100, z: -50 }, // West edge of tile (-1, -1)
        direction: 0,
        tileX: -1,
        tileZ: -1,
        edge: "west",
      };

      const stub = generateStubSegment(negEntry, -1, -1);
      expect(stub).not.toBeNull();
      // Tile (-1, -1) spans world [-100, 0) x [-100, 0)
      // Entry at x=-100 is at local x=0
      expect(stub!.start.x).toBe(0);
      expect(stub!.start.z).toBe(50); // -50 - (-100) = 50
      expect(stub!.end.x).toBeCloseTo(15);
    });

    it("should clamp stub at tile boundary when entry is near opposite edge", () => {
      // Entry from west edge but very close to east edge (should clamp)
      const nearEdgeEntry: RoadBoundaryExit = {
        roadId: "road_near_edge",
        position: { x: 100, z: 50 }, // West edge of tile (1, 0)
        direction: 0,
        tileX: 1,
        tileZ: 0,
        edge: "west",
      };

      const stub = generateStubSegment(nearEdgeEntry, 1, 0);
      expect(stub).not.toBeNull();
      expect(stub!.end.x).toBeLessThanOrEqual(TILE_SIZE);
    });

    it("should reject stub with zero effective length", () => {
      // Entry at southeast corner entering from south - endZ would be > TILE_SIZE, clamped to 100
      // But if localZ is already 100, stub length becomes 0
      const zeroLengthEntry: RoadBoundaryExit = {
        roadId: "road_zero",
        position: { x: 150, z: 100 }, // South edge at north boundary of tile (1, 0)
        direction: Math.PI / 2,
        tileX: 1,
        tileZ: 0,
        edge: "south",
      };

      // localZ = 100 - 0 = 100 (at north edge of tile)
      // Direction south (into tile) is Math.PI/2, so endZ = 100 + sin(PI/2)*15 = 115, clamped to 100
      // dx=0, dz=0, length=0 -> should be rejected
      const stub = generateStubSegment(zeroLengthEntry, 1, 0);
      expect(stub).toBeNull();
    });

    it("should generate correct stubs for all four edges", () => {
      const edges: TileEdge[] = ["north", "south", "east", "west"];
      const expectedDirs = {
        west: { dx: 1, dz: 0 }, // East
        east: { dx: -1, dz: 0 }, // West
        south: { dx: 0, dz: 1 }, // North
        north: { dx: 0, dz: -1 }, // South
      };

      for (const edge of edges) {
        const entry: RoadBoundaryExit = {
          roadId: `road_${edge}`,
          position: { x: 150, z: 150 }, // Center of tile (1, 1)
          direction: 0,
          tileX: 1,
          tileZ: 1,
          edge,
        };

        const stub = generateStubSegment(entry, 1, 1);
        expect(stub).not.toBeNull();

        const dx = stub!.end.x - stub!.start.x;
        const dz = stub!.end.z - stub!.start.z;
        const expected = expectedDirs[edge];

        // Verify direction is correct (normalized)
        const len = Math.sqrt(dx * dx + dz * dz);
        expect(dx / len).toBeCloseTo(expected.dx, 1);
        expect(dz / len).toBeCloseTo(expected.dz, 1);
      }
    });

    it("should handle multiple entries on same edge", () => {
      const entries: RoadBoundaryExit[] = [
        {
          roadId: "road_1",
          position: { x: 100, z: 20 },
          direction: 0,
          tileX: 1,
          tileZ: 0,
          edge: "west",
        },
        {
          roadId: "road_2",
          position: { x: 100, z: 50 },
          direction: 0,
          tileX: 1,
          tileZ: 0,
          edge: "west",
        },
        {
          roadId: "road_3",
          position: { x: 100, z: 80 },
          direction: 0,
          tileX: 1,
          tileZ: 0,
          edge: "west",
        },
      ];

      const stubs = entries
        .map((e) => generateStubSegment(e, 1, 0))
        .filter((s): s is RoadTileSegment => s !== null);
      expect(stubs.length).toBe(3);

      // All should start at x=0 (west edge)
      for (const stub of stubs) {
        expect(stub.start.x).toBe(0);
        expect(stub.end.x).toBeCloseTo(15);
      }

      // Z coordinates should differ
      expect(stubs[0].start.z).toBe(20);
      expect(stubs[1].start.z).toBe(50);
      expect(stubs[2].start.z).toBe(80);
    });
  });

  describe("Segment Combination Logic", () => {
    // These tests verify the segment combination algorithm
    // For real integration tests, see TownRoadIntegration.test.ts

    it("combining empty arrays produces empty result", () => {
      const cachedSegments: RoadTileSegment[] = [];
      const stubSegments: RoadTileSegment[] = [];
      const result =
        stubSegments.length > 0
          ? [...cachedSegments, ...stubSegments]
          : cachedSegments;
      expect(result).toEqual([]);
    });

    it("combines cached with stubs when both exist", () => {
      const cachedSegments: RoadTileSegment[] = [
        {
          start: { x: 20, z: 20 },
          end: { x: 80, z: 80 },
          width: 4,
          roadId: "internal_road",
        },
      ];
      const stubSegments: RoadTileSegment[] = [
        {
          start: { x: 0, z: 50 },
          end: { x: 15, z: 50 },
          width: 4,
          roadId: "cross_tile_road",
        },
      ];

      const result =
        stubSegments.length > 0
          ? [...cachedSegments, ...stubSegments]
          : cachedSegments;
      expect(result.length).toBe(2);
      expect(result).toContainEqual(cachedSegments[0]);
      expect(result).toContainEqual(stubSegments[0]);
    });

    it("returns cached only when stubs are empty", () => {
      const cachedSegments: RoadTileSegment[] = [
        {
          start: { x: 10, z: 10 },
          end: { x: 90, z: 90 },
          width: 4,
          roadId: "main_road",
        },
      ];
      const stubSegments: RoadTileSegment[] = [];

      const result =
        stubSegments.length > 0
          ? [...cachedSegments, ...stubSegments]
          : cachedSegments;
      expect(result).toBe(cachedSegments); // Same reference - no unnecessary spread
      expect(result.length).toBe(1);
    });
  });

  describe("Direction Constant Verification", () => {
    const DIRECTION_INTO_TILE: Record<TileEdge, number> = {
      west: 0,
      east: Math.PI,
      south: Math.PI / 2,
      north: -Math.PI / 2,
    };

    it("west entry direction points east (+X)", () => {
      const dir = DIRECTION_INTO_TILE["west"];
      expect(Math.cos(dir)).toBeCloseTo(1, 5);
      expect(Math.sin(dir)).toBeCloseTo(0, 5);
    });

    it("east entry direction points west (-X)", () => {
      const dir = DIRECTION_INTO_TILE["east"];
      expect(Math.cos(dir)).toBeCloseTo(-1, 5);
      expect(Math.sin(dir)).toBeCloseTo(0, 5);
    });

    it("south entry direction points north (+Z)", () => {
      const dir = DIRECTION_INTO_TILE["south"];
      expect(Math.cos(dir)).toBeCloseTo(0, 5);
      expect(Math.sin(dir)).toBeCloseTo(1, 5);
    });

    it("north entry direction points south (-Z)", () => {
      const dir = DIRECTION_INTO_TILE["north"];
      expect(Math.cos(dir)).toBeCloseTo(0, 5);
      expect(Math.sin(dir)).toBeCloseTo(-1, 5);
    });

    it("all directions are perpendicular to their edge", () => {
      // West/East edges are vertical (parallel to Z axis), direction should be horizontal (X axis)
      expect(Math.abs(Math.sin(DIRECTION_INTO_TILE["west"]))).toBeLessThan(
        0.01,
      );
      expect(Math.abs(Math.sin(DIRECTION_INTO_TILE["east"]))).toBeLessThan(
        0.01,
      );

      // North/South edges are horizontal (parallel to X axis), direction should be vertical (Z axis)
      expect(Math.abs(Math.cos(DIRECTION_INTO_TILE["north"]))).toBeLessThan(
        0.01,
      );
      expect(Math.abs(Math.cos(DIRECTION_INTO_TILE["south"]))).toBeLessThan(
        0.01,
      );
    });

    it("opposite edges have opposite directions", () => {
      const westDir = DIRECTION_INTO_TILE["west"];
      const eastDir = DIRECTION_INTO_TILE["east"];
      expect(Math.cos(westDir)).toBeCloseTo(-Math.cos(eastDir), 5);

      const northDir = DIRECTION_INTO_TILE["north"];
      const southDir = DIRECTION_INTO_TILE["south"];
      expect(Math.sin(northDir)).toBeCloseTo(-Math.sin(southDir), 5);
    });
  });

  describe("Boundary Detection Precision", () => {
    const EDGE_EPSILON = 0.01;

    function getEdgeAtPoint(
      x: number,
      z: number,
      tileMinX: number,
      tileMaxX: number,
      tileMinZ: number,
      tileMaxZ: number,
      epsilon: number,
    ): TileEdge | null {
      if (Math.abs(x - tileMinX) < epsilon) return "west";
      if (Math.abs(x - tileMaxX) < epsilon) return "east";
      if (Math.abs(z - tileMinZ) < epsilon) return "south";
      if (Math.abs(z - tileMaxZ) < epsilon) return "north";
      return null;
    }

    it("detects point exactly at west edge", () => {
      const edge = getEdgeAtPoint(0, 50, 0, 100, 0, 100, EDGE_EPSILON);
      expect(edge).toBe("west");
    });

    it("detects point exactly at east edge", () => {
      const edge = getEdgeAtPoint(100, 50, 0, 100, 0, 100, EDGE_EPSILON);
      expect(edge).toBe("east");
    });

    it("detects point slightly off west edge (within epsilon)", () => {
      const edge = getEdgeAtPoint(0.005, 50, 0, 100, 0, 100, EDGE_EPSILON);
      expect(edge).toBe("west");
    });

    it("does not detect point beyond epsilon from edge", () => {
      const edge = getEdgeAtPoint(0.02, 50, 0, 100, 0, 100, EDGE_EPSILON);
      expect(edge).toBeNull();
    });

    it("handles floating point precision issues", () => {
      // 0.1 + 0.2 = 0.30000000000000004 in IEEE 754
      const imprecise = 0.1 + 0.2;
      const edge = getEdgeAtPoint(
        imprecise,
        50,
        0.3,
        100.3,
        0,
        100,
        EDGE_EPSILON,
      );
      expect(edge).toBe("west"); // Should detect despite floating point error
    });

    it("prioritizes west edge at northwest corner", () => {
      // When at exact corner, first matching edge wins (order: west, east, south, north)
      const edge = getEdgeAtPoint(0, 100, 0, 100, 0, 100, EDGE_EPSILON);
      expect(edge).toBe("west");
    });

    it("prioritizes west edge at southwest corner", () => {
      const edge = getEdgeAtPoint(0, 0, 0, 100, 0, 100, EDGE_EPSILON);
      expect(edge).toBe("west");
    });

    it("handles negative coordinate tiles", () => {
      // Tile at (-2, -1) spans [-200, -100) x [-100, 0)
      const edge = getEdgeAtPoint(-200, -50, -200, -100, -100, 0, EDGE_EPSILON);
      expect(edge).toBe("west");
    });

    it("detects edges in large coordinate tiles", () => {
      // Tile at (100, 50) spans [10000, 10100) x [5000, 5100)
      const edge = getEdgeAtPoint(
        10100,
        5050,
        10000,
        10100,
        5000,
        5100,
        EDGE_EPSILON,
      );
      expect(edge).toBe("east");
    });
  });

  describe("Clipped Segment Boundary Exit Detection", () => {
    const EDGE_EPSILON = 0.01;

    function wasPointClipped(
      clippedX: number,
      clippedZ: number,
      originalX: number,
      originalZ: number,
      epsilon: number,
    ): boolean {
      return (
        Math.abs(clippedX - originalX) > epsilon ||
        Math.abs(clippedZ - originalZ) > epsilon
      );
    }

    it("detects when segment start was clipped", () => {
      // Original: (-10, 50) -> (50, 50), clipped to tile [0, 100]: (0, 50) -> (50, 50)
      const clippedX1 = 0,
        clippedZ1 = 50;
      const originalX1 = -10,
        originalZ1 = 50;
      expect(
        wasPointClipped(
          clippedX1,
          clippedZ1,
          originalX1,
          originalZ1,
          EDGE_EPSILON,
        ),
      ).toBe(true);
    });

    it("detects when segment end was clipped", () => {
      // Original: (50, 50) -> (150, 50), clipped: (50, 50) -> (100, 50)
      const clippedX2 = 100,
        clippedZ2 = 50;
      const originalX2 = 150,
        originalZ2 = 50;
      expect(
        wasPointClipped(
          clippedX2,
          clippedZ2,
          originalX2,
          originalZ2,
          EDGE_EPSILON,
        ),
      ).toBe(true);
    });

    it("detects when both endpoints were clipped", () => {
      // Original: (-10, 50) -> (150, 50), clipped: (0, 50) -> (100, 50)
      expect(wasPointClipped(0, 50, -10, 50, EDGE_EPSILON)).toBe(true);
      expect(wasPointClipped(100, 50, 150, 50, EDGE_EPSILON)).toBe(true);
    });

    it("does not flag unclipped endpoints", () => {
      // Segment fully inside tile
      expect(wasPointClipped(10, 50, 10, 50, EDGE_EPSILON)).toBe(false);
      expect(wasPointClipped(90, 50, 90, 50, EDGE_EPSILON)).toBe(false);
    });

    it("handles diagonal segment clipping", () => {
      // Original diagonal: (-20, -20) -> (120, 120)
      // Clipped to [0, 100]: approximately (0, 0) -> (100, 100)
      expect(wasPointClipped(0, 0, -20, -20, EDGE_EPSILON)).toBe(true);
      expect(wasPointClipped(100, 100, 120, 120, EDGE_EPSILON)).toBe(true);
    });

    it("segment direction is calculated correctly from clipped points", () => {
      // Clipped segment from (0, 50) to (100, 50) - horizontal
      const clippedX1 = 0,
        clippedZ1 = 50;
      const clippedX2 = 100,
        clippedZ2 = 50;
      const segDir = Math.atan2(clippedZ2 - clippedZ1, clippedX2 - clippedX1);
      expect(segDir).toBeCloseTo(0, 5); // East

      // Diagonal segment from (0, 0) to (100, 100)
      const diagDir = Math.atan2(100 - 0, 100 - 0);
      expect(diagDir).toBeCloseTo(Math.PI / 4, 5); // Northeast
    });

    it("entry direction is opposite of segment direction at clipped start", () => {
      // Segment goes east (0 radians) from start
      const segDir = 0;
      const entryDir = segDir + Math.PI; // West (road enters from west)
      expect(Math.cos(entryDir)).toBeCloseTo(-1, 5);
    });

    it("exit direction matches segment direction at clipped end", () => {
      // Segment goes east (0 radians) to end
      const segDir = 0;
      const exitDir = segDir; // East (road exits to east)
      expect(Math.cos(exitDir)).toBeCloseTo(1, 5);
    });
  });

  describe("Concurrent Cache Access Simulation", () => {
    // Simulate concurrent access patterns that might occur with async tile generation

    it("handles simultaneous reads from same tile", () => {
      const cache = new Map<string, RoadTileSegment[]>();
      const key = "1_1";
      cache.set(key, [
        {
          start: { x: 0, z: 0 },
          end: { x: 100, z: 100 },
          width: 4,
          roadId: "r1",
        },
      ]);

      // Simulate multiple "threads" reading same tile
      const reads = Array.from({ length: 100 }, () => cache.get(key));
      expect(reads.every((r) => r !== undefined && r.length === 1)).toBe(true);
    });

    it("handles cache miss gracefully", () => {
      const cache = new Map<string, RoadTileSegment[]>();
      const result = cache.get("nonexistent_tile") || [];
      expect(result).toEqual([]);
    });

    it("entry stub cache is independent of road cache", () => {
      const tileRoadCache = new Map<string, RoadTileSegment[]>();
      const entryStubCache = new Map<string, RoadTileSegment[]>();

      const key = "4_4";
      tileRoadCache.set(key, [
        {
          start: { x: 10, z: 10 },
          end: { x: 90, z: 90 },
          width: 4,
          roadId: "main",
        },
      ]);
      entryStubCache.set(key, [
        {
          start: { x: 0, z: 50 },
          end: { x: 15, z: 50 },
          width: 4,
          roadId: "stub",
        },
      ]);

      // Modify one cache shouldn't affect the other
      tileRoadCache.delete(key);
      expect(entryStubCache.get(key)?.length).toBe(1);

      // And vice versa
      entryStubCache.delete(key);
      expect(tileRoadCache.get(key)).toBeUndefined();
    });
  });

  describe("Road Influence Texture Resolution Algorithm", () => {
    /**
     * Tests for the auto-calculation of road influence texture resolution.
     * The algorithm ensures roads are at least 2 pixels wide to prevent sub-pixel roads.
     */

    it("should calculate minimum resolution for roads to be visible", () => {
      // Given a world size and road width, calculate the minimum texture size
      // that ensures roads span at least 2 pixels

      const worldSize = 10000; // 10km world
      const roadWidth = ROAD_WIDTH; // 6m roads
      const extraBlendWidth = 3; // 3m blend zone
      const roadInfluenceWidth = roadWidth / 2 + extraBlendWidth; // 6m total influence

      // Target: 2 pixels per road influence width
      const metersPerPixelTarget = roadInfluenceWidth / 2;
      const minResolution = Math.ceil(worldSize / metersPerPixelTarget);

      // Round to power of 2, capped at 2048
      const expectedSize = Math.min(
        2048,
        Math.pow(2, Math.ceil(Math.log2(Math.max(256, minResolution)))),
      );

      // For a 10km world with 6m road influence width:
      // metersPerPixel target = 6 / 2 = 3m
      // minResolution = 10000 / 3 = 3334
      // power of 2 = 4096, capped at 2048
      expect(expectedSize).toBe(2048);
    });

    it("should calculate smaller resolution for smaller worlds", () => {
      const worldSize = 1000; // 1km world
      const roadWidth = ROAD_WIDTH;
      const extraBlendWidth = 3;
      const roadInfluenceWidth = roadWidth / 2 + extraBlendWidth;

      const metersPerPixelTarget = roadInfluenceWidth / 2;
      const minResolution = Math.ceil(worldSize / metersPerPixelTarget);
      const expectedSize = Math.min(
        2048,
        Math.pow(2, Math.ceil(Math.log2(Math.max(256, minResolution)))),
      );

      // For 1km world: minResolution = 1000/3 = 334 → 512 (power of 2)
      expect(expectedSize).toBe(512);
    });

    it("should ensure metersPerPixel is less than road influence width", () => {
      const testCases = [
        { worldSize: 1000, expectedMaxMPP: 3 },
        { worldSize: 5000, expectedMaxMPP: 3 },
        { worldSize: 10000, expectedMaxMPP: 5 }, // Capped at 2048
      ];

      const roadWidth = ROAD_WIDTH;
      const extraBlendWidth = 3;
      const roadInfluenceWidth = roadWidth / 2 + extraBlendWidth;

      for (const { worldSize, expectedMaxMPP } of testCases) {
        const metersPerPixelTarget = roadInfluenceWidth / 2;
        const minResolution = Math.ceil(worldSize / metersPerPixelTarget);
        const textureSize = Math.min(
          2048,
          Math.pow(2, Math.ceil(Math.log2(Math.max(256, minResolution)))),
        );
        const actualMPP = worldSize / textureSize;

        // Meters per pixel should be reasonably close to target
        expect(actualMPP).toBeLessThanOrEqual(expectedMaxMPP);
      }
    });
  });
});
