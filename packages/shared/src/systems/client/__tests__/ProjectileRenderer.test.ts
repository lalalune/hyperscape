import { afterEach, describe, expect, it, vi } from "vitest";

import THREE from "../../../extras/three/three";
import { ProjectileRenderer } from "../ProjectileRenderer";

type ProjectileRendererInternals = {
  activeProjectiles: Array<{
    sprite: THREE.Object3D;
    travelDurationMs?: number;
  }>;
  arrowGeometryCache: Map<
    string,
    {
      shaft: THREE.BufferGeometry;
      head: THREE.BufferGeometry;
      fletching: THREE.BufferGeometry;
    }
  >;
  onProjectileLaunched: (data: unknown) => void;
  onProjectileHit: (data: unknown) => void;
  onCombatEnded: (data: unknown) => void;
};

function createRenderer(attackerEntity: unknown = null): {
  renderer: ProjectileRenderer;
  internals: ProjectileRendererInternals;
} {
  const world = {
    isClient: true,
    stage: { scene: new THREE.Scene() },
    entities: {
      get: vi.fn((id: string) => (id === "ranger" ? attackerEntity : null)),
    },
    camera: new THREE.PerspectiveCamera(),
    on: vi.fn(),
    off: vi.fn(),
  };
  const renderer = new ProjectileRenderer(world as never);
  return {
    renderer,
    internals: renderer as unknown as ProjectileRendererInternals,
  };
}

const launch = {
  attackerId: "ranger",
  targetId: "mage",
  projectileType: "arrow",
  sourcePosition: { x: 0, y: 0, z: 0 },
  targetPosition: { x: 6, y: 0, z: 0 },
  arrowId: "rune_arrow",
  travelDurationMs: 600,
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ProjectileRenderer authoritative timing", () => {
  it("keeps the visual in flight until the server-derived duration", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(0);
    const { renderer, internals } = createRenderer();

    internals.onProjectileLaunched(launch);
    expect(internals.activeProjectiles).toHaveLength(1);
    expect(internals.activeProjectiles[0].travelDurationMs).toBe(600);

    now.mockReturnValue(300);
    renderer.update(0.3);
    expect(internals.activeProjectiles).toHaveLength(1);

    now.mockReturnValue(599);
    renderer.update(0.299);
    expect(internals.activeProjectiles).toHaveLength(1);

    now.mockReturnValue(600);
    renderer.update(0.001);
    expect(internals.activeProjectiles).toHaveLength(0);
  });

  it("removes the visual on the authoritative impact event", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(0);
    const { renderer, internals } = createRenderer();
    internals.onProjectileLaunched(launch);

    now.mockReturnValue(250);
    internals.onProjectileHit({
      attackerId: "ranger",
      targetId: "mage",
    });
    renderer.update(0.25);

    expect(internals.activeProjectiles).toHaveLength(0);
  });

  it("cancels delayed and active pair visuals when combat ends", () => {
    vi.useFakeTimers();
    vi.spyOn(performance, "now").mockReturnValue(0);
    const { internals } = createRenderer();

    internals.onProjectileLaunched({ ...launch, delayMs: 300 });
    internals.onCombatEnded({ attackerId: "ranger", targetId: "mage" });
    vi.advanceTimersByTime(500);

    expect(internals.activeProjectiles).toHaveLength(0);
  });

  it("rejects non-finite timing instead of creating a ghost projectile", () => {
    const { internals } = createRenderer();

    internals.onProjectileLaunched({ ...launch, travelDurationMs: Number.NaN });

    expect(internals.activeProjectiles).toHaveLength(0);
  });

  it("rejects non-finite positions instead of poisoning the render loop", () => {
    const { internals } = createRenderer();

    internals.onProjectileLaunched({
      ...launch,
      sourcePosition: { x: Number.NaN, y: 0, z: 0 },
    });

    expect(internals.activeProjectiles).toHaveLength(0);
  });

  it("starts an arrow at the rendered draw hand without a forward pop", () => {
    vi.spyOn(performance, "now").mockReturnValue(0);
    const avatarScene = new THREE.Group();
    avatarScene.position.set(2, 0.25, -1);
    const rightHand = new THREE.Object3D();
    rightHand.position.set(0.3, 1.15, 0.2);
    avatarScene.add(rightHand);
    avatarScene.updateMatrixWorld(true);
    const attacker = {
      _avatar: {
        instance: {
          raw: {
            userData: {
              vrm: {
                humanoid: {
                  getRawBoneNode: (name: string) =>
                    name === "rightHand" ? rightHand : null,
                },
              },
            },
          },
        },
      },
    };
    const { renderer, internals } = createRenderer(attacker);
    const expected = rightHand.getWorldPosition(new THREE.Vector3());

    internals.onProjectileLaunched(launch);

    expect(internals.activeProjectiles).toHaveLength(1);
    expect(internals.activeProjectiles[0].sprite.position.x).toBeCloseTo(
      expected.x,
      6,
    );
    expect(internals.activeProjectiles[0].sprite.position.y).toBeCloseTo(
      expected.y,
      6,
    );
    expect(internals.activeProjectiles[0].sprite.position.z).toBeCloseTo(
      expected.z,
      6,
    );
    expect(renderer.getStreamingProjectileVisualDiagnostics()).toMatchObject({
      schemaVersion: 1,
      latestSequence: 1,
      arrowLaunchEventCount: 1,
      arrowSpawnCount: 1,
      arrowCancelledBeforeSpawnCount: 0,
      pendingArrowCount: 0,
      activeArrows: [
        {
          sequence: 1,
          attackerId: "ranger",
          targetId: "mage",
          arrowId: "rune_arrow",
          startPosition: [expected.x, expected.y, expected.z],
        },
      ],
      recentArrowSpawns: [
        {
          sequence: 1,
          attackerId: "ranger",
          targetId: "mage",
          arrowId: "rune_arrow",
          startPosition: [expected.x, expected.y, expected.z],
        },
      ],
    });
  });

  it("records a delayed arrow cancelled before spawn without a ghost visual", () => {
    vi.useFakeTimers();
    vi.spyOn(performance, "now").mockReturnValue(10);
    const { renderer, internals } = createRenderer();

    internals.onProjectileLaunched({ ...launch, delayMs: 400 });
    expect(renderer.getStreamingProjectileVisualDiagnostics()).toMatchObject({
      arrowLaunchEventCount: 1,
      arrowSpawnCount: 0,
      arrowCancelledBeforeSpawnCount: 0,
      pendingArrowCount: 1,
    });

    internals.onProjectileHit({ attackerId: "ranger", targetId: "mage" });
    vi.advanceTimersByTime(1_000);

    expect(renderer.getStreamingProjectileVisualDiagnostics()).toMatchObject({
      arrowLaunchEventCount: 1,
      arrowSpawnCount: 0,
      arrowCancelledBeforeSpawnCount: 1,
      pendingArrowCount: 0,
      activeArrows: [],
      recentArrowSpawns: [],
    });
  });

  it("reuses one geometry pair across repeated arrows with the same dimensions", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(0);
    const { renderer, internals } = createRenderer();

    internals.onProjectileLaunched(launch);
    const firstMeshes: THREE.Mesh[] = [];
    internals.activeProjectiles[0].sprite.traverse((child) => {
      if (child instanceof THREE.Mesh) firstMeshes.push(child);
    });

    now.mockReturnValue(600);
    renderer.update(0.6);
    internals.onProjectileLaunched(launch);
    const secondMeshes: THREE.Mesh[] = [];
    internals.activeProjectiles[0].sprite.traverse((child) => {
      if (child instanceof THREE.Mesh) secondMeshes.push(child);
    });

    expect(firstMeshes).toHaveLength(4);
    expect(secondMeshes).toHaveLength(4);
    secondMeshes.forEach((mesh, index) =>
      expect(mesh.geometry).toBe(firstMeshes[index].geometry),
    );
    expect(internals.arrowGeometryCache.size).toBe(1);
  });

  it("disposes the cached arrow geometry pair when the renderer is destroyed", () => {
    const { renderer, internals } = createRenderer();
    internals.onProjectileLaunched(launch);
    const geometries = [...internals.arrowGeometryCache.values()][0];
    const disposeShaft = vi.spyOn(geometries.shaft, "dispose");
    const disposeHead = vi.spyOn(geometries.head, "dispose");
    const disposeFletching = vi.spyOn(geometries.fletching, "dispose");

    renderer.destroy();

    expect(disposeShaft).toHaveBeenCalledOnce();
    expect(disposeHead).toHaveBeenCalledOnce();
    expect(disposeFletching).toHaveBeenCalledOnce();
    expect(internals.arrowGeometryCache.size).toBe(0);
  });
});
