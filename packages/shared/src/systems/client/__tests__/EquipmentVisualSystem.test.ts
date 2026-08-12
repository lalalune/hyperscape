import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";
import {
  EquipmentVisualSystem,
  STREAMING_DUEL_INTENTIONALLY_INVISIBLE_EQUIPMENT_SLOTS,
  STREAMING_DUEL_VISIBLE_EQUIPMENT_SLOTS,
} from "../EquipmentVisualSystem";
import {
  createDynamicBowStringController,
  createStableHeldEquipmentPoseController,
  resolveEquipmentVisualUrls,
  shouldRenderHeldEquipmentVisual,
  validateStreamingEquipmentVisualModel,
  type DynamicBowStringTransition,
} from "../EquipmentVisualHelpers";
import { EventType } from "../../../types/events";

const TEST_RIG_FINGERPRINT = "a".repeat(64);

// Mock dependencies
vi.mock("three/examples/jsm/libs/meshopt_decoder.module.js", () => ({
  MeshoptDecoder: {},
}));

vi.mock("../../../libs/gltfloader/GLTFLoader", () => {
  const itemIdFromUrl = (url: string) => {
    if (url.includes("shortsword-bronze")) return "bronze_shortsword";
    if (url.includes("longsword-bronze")) return "bronze_longsword";
    return (
      url
        .split("/")
        .pop()
        ?.replace(/\.glb$/u, "") ?? "unknown_item"
    );
  };
  const createMockScene = (itemId: string) => {
    const attachment = {
      version: 2,
      vrmBoneName: "rightHand",
      relativeMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      duelFit: {
        schemaVersion: 1,
        itemId,
        slot: "weapon",
        compatibleAvatarIds: ["bandit"],
      },
    };
    return {
      userData: { hyperia: attachment },
      clone: () => ({
        userData: { hyperia: attachment },
        children: [],
        traverse: (fn: (child: unknown) => void) => void fn,
        add: () => {},
        remove: () => {},
        scale: { set: vi.fn(), multiplyScalar: vi.fn() },
        position: { copy: vi.fn() },
        quaternion: { copy: vi.fn() },
        visible: true,
      }),
      children: [],
      traverse: (fn: (child: unknown) => void) => void fn,
    };
  };

  class MockGLTFLoader {
    setMeshoptDecoder = vi.fn();
    loadAsync = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve({ scene: createMockScene(itemIdFromUrl(url)) }),
      );
    parseAsync = vi
      .fn()
      .mockImplementation((_buffer: ArrayBuffer, url: string) =>
        Promise.resolve({ scene: createMockScene(itemIdFromUrl(url)) }),
      );
  }

  return {
    GLTFLoader: MockGLTFLoader,
  };
});

import * as itemsModule from "../../../data/items";

const originalGetItem = itemsModule.getItem;
vi.spyOn(itemsModule, "getItem").mockImplementation((id: string) => {
  const realItem = originalGetItem(id);
  if (realItem) return realItem;
  // Partial Item stub — only the fields needed for equipment visual tests.
  // Full Item type requires many fields irrelevant to model loading.
  return {
    id,
    modelPath: `asset://models/${id}.glb`,
    equippedModelPath: `asset://models/${id}.glb`,
  } as unknown as ReturnType<typeof originalGetItem>;
});

describe("EquipmentVisualSystem", () => {
  let system: EquipmentVisualSystem;
  let mockWorld: any;
  let mockPlayer: any;
  let mockVRM: any;

  beforeEach(async () => {
    // Setup mock world
    // Create a mock File that returns an ArrayBuffer
    const mockFile = new File([new ArrayBuffer(8)], "mock.glb", {
      type: "model/gltf-binary",
    });

    mockWorld = {
      isServer: false,
      assetsUrl: "http://localhost:8080/assets",
      $eventBus: {
        subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
        emitEvent: vi.fn(),
      },
      events: {
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
      },
      entities: new Map(),
      network: {},
      loader: {
        loadFile: vi.fn().mockResolvedValue(mockFile),
      },
    };

    // Setup mock VRM
    const mockBone = new THREE.Object3D();
    mockBone.name = "rightHand";
    // Mock add to allow adding non-Object3D mocks
    mockBone.add = vi.fn();

    mockVRM = {
      humanoid: {
        getNormalizedBoneNode: vi.fn().mockReturnValue(mockBone),
        getRawBoneNode: vi.fn().mockReturnValue(mockBone),
      },
      scene: new THREE.Group(),
    };

    // Setup mock player
    mockPlayer = {
      id: "player1",
      avatarUrl: "asset://avatars/duel-candidates/duel-bandit.vrm",
      data: {
        avatar: "asset://avatars/duel-candidates/duel-bandit.vrm",
      },
      _avatar: {
        instance: {
          raw: {
            userData: {
              vrm: mockVRM,
            },
            scene: new THREE.Group(),
          },
        },
      },
      node: new THREE.Group(),
    };

    // Add bone to player node hierarchy (simulating raw avatar)
    mockPlayer._avatar.instance.raw.scene.add(mockBone);

    mockWorld.entities.set("player1", mockPlayer);

    // Initialize system
    system = new EquipmentVisualSystem(mockWorld);
    // Manually call init since we're testing logic that might run in constructor or init
    await system.init();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize and subscribe to events", async () => {
    expect(mockWorld.$eventBus.subscribe).toHaveBeenCalledWith(
      EventType.PLAYER_EQUIPMENT_CHANGED,
      expect.any(Function),
    );
    expect(mockWorld.$eventBus.subscribe).toHaveBeenCalledWith(
      EventType.PLAYER_CLEANUP,
      expect.any(Function),
    );
    expect(mockWorld.$eventBus.subscribe).toHaveBeenCalledWith(
      EventType.AVATAR_LOAD_COMPLETE,
      expect.any(Function),
    );
  });

  it("routes authoritative arrow release and combat cleanup to the bow", () => {
    const scheduleRelease = vi.fn().mockReturnValue(true);
    const cancelRelease = vi.fn();
    (
      system as unknown as {
        dynamicBowStrings: Map<string, unknown>;
      }
    ).dynamicBowStrings.set("player1", {
      scheduleRelease,
      cancelRelease,
    });
    const subscription = (event: EventType) =>
      mockWorld.$eventBus.subscribe.mock.calls.find(
        ([registered]: [EventType]) => registered === event,
      )?.[1] as ((data: unknown) => void) | undefined;

    subscription(EventType.COMBAT_PROJECTILE_LAUNCHED)?.({
      data: {
        attackerId: "player1",
        targetId: "player2",
        projectileType: "arrow",
        delayMs: 400,
        arrowId: "bronze_arrow",
      },
    });
    expect(scheduleRelease).toHaveBeenCalledWith(400, "bronze_arrow");

    subscription(EventType.COMBAT_PROJECTILE_LAUNCHED)?.({
      data: {
        attackerId: "player1",
        targetId: "player2",
        projectileType: "spell",
        delayMs: 600,
      },
    });
    expect(scheduleRelease).toHaveBeenCalledOnce();

    subscription(EventType.COMBAT_ENDED)?.({
      data: {
        attackerId: "player1",
        targetId: "player2",
      },
    });
    expect(cancelRelease).toHaveBeenCalledOnce();
  });

  it("exposes only requested players in bounded bow transition diagnostics", () => {
    const visibleNock = new THREE.Group();
    visibleNock.position.set(1, 2, 3);
    visibleNock.visible = true;
    const internals = system as unknown as {
      dynamicBowStrings: Map<string, unknown>;
      playerWeaponItemIds: Map<string, string>;
      recordBowTransition: (
        playerId: string,
        transition: DynamicBowStringTransition,
      ) => void;
    };
    internals.dynamicBowStrings.set("player1", {
      nockedArrow: visibleNock,
    });
    internals.playerWeaponItemIds.set("player1", "shortbow");
    internals.recordBowTransition("player1", {
      kind: "released",
      performanceTimeMs: 1_400,
      lastVisibleNockWorldPosition: [1, 2, 3],
      drawHandWorldPosition: [1, 2, 3],
    });
    internals.recordBowTransition("different-player", {
      kind: "cancelled",
      performanceTimeMs: 1_500,
    });

    expect(
      system.getStreamingDuelBowPresentationDiagnostics(["player1"]),
    ).toMatchObject({
      schemaVersion: 1,
      latestSequence: 2,
      players: [
        {
          playerId: "player1",
          itemId: "shortbow",
          controllerReady: true,
          nockedArrowVisible: true,
          nockedArrowWorldPosition: [1, 2, 3],
        },
      ],
      recentTransitions: [
        {
          sequence: 1,
          playerId: "player1",
          itemId: "shortbow",
          kind: "released",
          performanceTimeMs: 1_400,
          releaseAtPerformanceTimeMs: null,
          lastVisibleNockWorldPosition: [1, 2, 3],
          drawHandWorldPosition: [1, 2, 3],
        },
      ],
    });
  });

  it("declares the exact visible and intentionally non-mesh competitive slots", () => {
    expect(STREAMING_DUEL_VISIBLE_EQUIPMENT_SLOTS).toEqual([
      "weapon",
      "shield",
      "helmet",
      "body",
      "legs",
      "boots",
      "gloves",
      "cape",
    ]);
    expect(STREAMING_DUEL_INTENTIONALLY_INVISIBLE_EQUIPMENT_SLOTS).toEqual({
      arrows: "authoritative_projectile_visual",
      amulet: "public_loadout_disclosure_only",
      ring: "public_loadout_disclosure_only",
    });
  });

  it("fails closed before configuration and accepts an empty maintenance contract", () => {
    expect(system.getStreamingDuelEquipmentVisualReadiness()).toMatchObject({
      configured: false,
      ready: false,
    });
    system.setStreamingDuelEquipmentVisualContract({
      cycleId: "",
      requirements: [],
      currentEquipment: [],
    });
    expect(system.getStreamingDuelEquipmentVisualReadiness()).toMatchObject({
      configured: true,
      ready: true,
      cycleId: null,
    });
  });

  it("pre-warms the cycle-derived set and rejects armor with weapon-only fit metadata", async () => {
    system.setStreamingDuelEquipmentVisualContract({
      cycleId: "cycle-armor",
      requirements: [
        {
          playerId: "player1",
          itemId: "bronze_shortsword",
          slot: "weapon",
        },
        {
          playerId: "player1",
          itemId: "bronze_platebody",
          slot: "body",
        },
      ],
      currentEquipment: [],
    });

    await vi.waitFor(() => {
      expect(system.getStreamingDuelEquipmentVisualReadiness()).toMatchObject({
        configured: true,
        ready: false,
        cycleId: "cycle-armor",
        requiredCount: 2,
        readyCount: 1,
        unresolved: [
          {
            itemId: "bronze_platebody",
            playerId: "player1",
            slot: "body",
            status: "invalid_model",
          },
        ],
      });
    });
  });

  it("requires the authoritative current item to be attached", async () => {
    system.setStreamingDuelEquipmentVisualContract({
      cycleId: "cycle-attachment",
      requirements: [
        { playerId: "player1", itemId: "bronze_sword", slot: "weapon" },
      ],
      currentEquipment: [
        { playerId: "player1", itemId: "bronze_sword", slot: "weapon" },
      ],
    });

    await vi.waitFor(() => {
      expect(system.getStreamingDuelEquipmentVisualReadiness()).toMatchObject({
        ready: false,
        attachmentMismatches: [
          {
            playerId: "player1",
            itemId: "bronze_sword",
            slot: "weapon",
            desiredItemId: null,
            attachedItemId: null,
          },
        ],
      });
    });

    const handler = (
      system as unknown as {
        handleEquipmentChange: (data: {
          playerId: string;
          slot: string;
          itemId: string | null;
        }) => Promise<void>;
      }
    ).handleEquipmentChange.bind(system);
    await handler({
      playerId: "player1",
      slot: "weapon",
      itemId: "bronze_sword",
    });

    expect(system.getStreamingDuelEquipmentVisualReadiness()).toMatchObject({
      ready: true,
      attachmentMismatches: [],
    });
  });

  it("accepts an attached frozen role switch while the public projection catches up", async () => {
    system.setStreamingDuelEquipmentVisualContract({
      cycleId: "cycle-role-switch",
      requirements: [
        { playerId: "player1", itemId: "bronze_sword", slot: "weapon" },
        { playerId: "player1", itemId: "staff_of_air", slot: "weapon" },
      ],
      currentEquipment: [
        { playerId: "player1", itemId: "bronze_sword", slot: "weapon" },
      ],
    });

    const handler = (
      system as unknown as {
        handleEquipmentChange: (data: {
          playerId: string;
          slot: string;
          itemId: string | null;
        }) => Promise<void>;
      }
    ).handleEquipmentChange.bind(system);
    await handler({
      playerId: "player1",
      slot: "weapon",
      itemId: "staff_of_air",
    });

    await vi.waitFor(() => {
      expect(system.getStreamingDuelEquipmentVisualReadiness()).toMatchObject({
        ready: true,
        requiredCount: 2,
        readyCount: 2,
        attachmentMismatches: [],
      });
    });
  });

  it("rejects an attached item outside the frozen visual contract", async () => {
    system.setStreamingDuelEquipmentVisualContract({
      cycleId: "cycle-unapproved-switch",
      requirements: [
        { playerId: "player1", itemId: "bronze_sword", slot: "weapon" },
      ],
      currentEquipment: [
        { playerId: "player1", itemId: "bronze_sword", slot: "weapon" },
      ],
    });

    const handler = (
      system as unknown as {
        handleEquipmentChange: (data: {
          playerId: string;
          slot: string;
          itemId: string | null;
        }) => Promise<void>;
      }
    ).handleEquipmentChange.bind(system);
    await handler({
      playerId: "player1",
      slot: "weapon",
      itemId: "staff_of_air",
    });

    await vi.waitFor(() => {
      expect(system.getStreamingDuelEquipmentVisualReadiness()).toMatchObject({
        ready: false,
        attachmentMismatches: [
          {
            playerId: "player1",
            itemId: "bronze_sword",
            slot: "weapon",
            desiredItemId: "staff_of_air",
            attachedItemId: "staff_of_air",
          },
        ],
      });
    });
  });

  it("rejects a prewarmed item that was not fitted for the contestant avatar", async () => {
    mockPlayer.avatarUrl =
      "asset://avatars/duel-candidates/duel-dark-wizard.vrm";
    mockPlayer.data.avatar = mockPlayer.avatarUrl;
    system.setStreamingDuelEquipmentVisualContract({
      cycleId: "cycle-incompatible-avatar",
      requirements: [
        { playerId: "player1", itemId: "bronze_sword", slot: "weapon" },
      ],
      currentEquipment: [],
    });

    await vi.waitFor(() => {
      expect(system.getStreamingDuelEquipmentVisualReadiness()).toMatchObject({
        ready: false,
        readyCount: 0,
        unresolved: [
          {
            playerId: "player1",
            itemId: "bronze_sword",
            slot: "weapon",
            status: "incompatible_avatar",
          },
        ],
      });
    });
  });

  it("does not infer a nonexistent equipped model when ammunition opts out", () => {
    expect(
      resolveEquipmentVisualUrls({
        assetsUrl: "http://localhost:5555/game-assets",
        itemId: "rune_arrow",
        slot: "arrows",
        itemData: { modelPath: null, equippedModelPath: null },
      }),
    ).toBeNull();
  });

  it("rejects raw rigid armor and accepts only slot-compatible fitted assets", () => {
    expect(
      validateStreamingEquipmentVisualModel(new THREE.Group(), "weapon"),
    ).toEqual({ valid: false, reason: "missing_fit_metadata" });

    const bodyFit = {
      schemaVersion: 1,
      itemId: "bronze_platebody",
      slot: "body",
      compatibleAvatarIds: ["bandit"],
      rigFingerprint: TEST_RIG_FINGERPRINT,
    };
    const rawBody = new THREE.Group();
    rawBody.userData.hyperia = { duelFit: bodyFit };
    rawBody.add(
      new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()),
    );
    expect(validateStreamingEquipmentVisualModel(rawBody, "body")).toEqual({
      valid: false,
      reason: "missing_skinned_mesh",
    });

    const skinnedBody = new THREE.Group();
    skinnedBody.userData.hyperia = { duelFit: bodyFit };
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0], 3),
    );
    geometry.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute([0, 0, 0, 0], 4),
    );
    geometry.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute([1, 0, 0, 0], 4),
    );
    const rootBone = new THREE.Bone();
    rootBone.name = "hips";
    const skeleton = new THREE.Skeleton([rootBone]);
    const fittedBody = new THREE.SkinnedMesh(
      geometry,
      new THREE.MeshBasicMaterial(),
    );
    fittedBody.bind(skeleton);
    skinnedBody.add(fittedBody);
    expect(
      validateStreamingEquipmentVisualModel(skinnedBody, "body", {
        itemId: "bronze_platebody",
        avatarId: "bandit",
      }),
    ).toEqual({ valid: true, reason: null });

    const wrongHandShield = new THREE.Group();
    wrongHandShield.userData.hyperia = {
      version: 2,
      vrmBoneName: "rightHand",
      relativeMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      duelFit: {
        schemaVersion: 1,
        itemId: "bronze_kiteshield",
        slot: "shield",
        compatibleAvatarIds: ["bandit"],
      },
    };
    expect(
      validateStreamingEquipmentVisualModel(wrongHandShield, "shield"),
    ).toEqual({ valid: false, reason: "invalid_attachment_bone" });
  });

  it("rejects ambiguous or malformed competitive fit metadata", () => {
    const createWeapon = (compatibleAvatarIds: string[]) => {
      const model = new THREE.Group();
      model.userData.hyperia = {
        version: 2,
        vrmBoneName: "rightHand",
        relativeMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        duelFit: {
          schemaVersion: 1,
          itemId: "bronze_shortsword",
          slot: "weapon",
          compatibleAvatarIds,
        },
      };
      return model;
    };

    expect(
      validateStreamingEquipmentVisualModel(
        createWeapon(["bandit", "bandit"]),
        "weapon",
      ),
    ).toEqual({ valid: false, reason: "invalid_fit_metadata" });
    expect(
      validateStreamingEquipmentVisualModel(
        createWeapon([" bandit"]),
        "weapon",
      ),
    ).toEqual({ valid: false, reason: "invalid_fit_metadata" });
    const malformedItem = createWeapon(["bandit"]);
    malformedItem.userData.hyperia.duelFit.itemId = "../bronze_shortsword";
    expect(
      validateStreamingEquipmentVisualModel(malformedItem, "weapon"),
    ).toEqual({ valid: false, reason: "invalid_fit_metadata" });
  });

  it("accepts a skinned helmet only with a canonical fingerprint and matching rig", () => {
    const createSkinnedMesh = (skeleton: THREE.Skeleton) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute([0, 0, 0], 3),
      );
      geometry.setAttribute(
        "skinIndex",
        new THREE.Uint16BufferAttribute([0, 0, 0, 0], 4),
      );
      geometry.setAttribute(
        "skinWeight",
        new THREE.Float32BufferAttribute([1, 0, 0, 0], 4),
      );
      const mesh = new THREE.SkinnedMesh(
        geometry,
        new THREE.MeshBasicMaterial(),
      );
      mesh.bind(skeleton, new THREE.Matrix4());
      return mesh;
    };
    const sourceBone = new THREE.Bone();
    sourceBone.name = "head";
    const sourceSkeleton = new THREE.Skeleton(
      [sourceBone],
      [new THREE.Matrix4()],
    );
    const helmet = new THREE.Group();
    helmet.userData.hyperia = {
      duelFit: {
        schemaVersion: 1,
        itemId: "bronze_full_helm",
        slot: "helmet",
        compatibleAvatarIds: ["bandit"],
        rigFingerprint: TEST_RIG_FINGERPRINT,
      },
    };
    helmet.add(createSkinnedMesh(sourceSkeleton));

    const targetBone = new THREE.Bone();
    targetBone.name = "head";
    const targetSkeleton = new THREE.Skeleton(
      [targetBone],
      [new THREE.Matrix4()],
    );
    const targetScene = new THREE.Group();
    targetScene.add(createSkinnedMesh(targetSkeleton));
    const vrm = { scene: targetScene } as unknown as VRM;

    expect(
      validateStreamingEquipmentVisualModel(helmet, "helmet", {
        itemId: "bronze_full_helm",
        avatarId: "bandit",
        vrm,
      }),
    ).toEqual({ valid: true, reason: null });

    helmet.userData.hyperia.duelFit.rigFingerprint = "not-a-sha256";
    expect(
      validateStreamingEquipmentVisualModel(helmet, "helmet", {
        itemId: "bronze_full_helm",
        avatarId: "bandit",
        vrm,
      }),
    ).toEqual({ valid: false, reason: "invalid_skinned_mesh" });
  });

  it("rejects skinned equipment exported against a different inverse bind pose", () => {
    const createSkinnedMesh = (skeleton: THREE.Skeleton): THREE.SkinnedMesh => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute([0, 0, 0], 3),
      );
      geometry.setAttribute(
        "skinIndex",
        new THREE.Uint16BufferAttribute([0, 0, 0, 0], 4),
      );
      geometry.setAttribute(
        "skinWeight",
        new THREE.Float32BufferAttribute([1, 0, 0, 0], 4),
      );
      const mesh = new THREE.SkinnedMesh(
        geometry,
        new THREE.MeshBasicMaterial(),
      );
      mesh.bind(skeleton);
      return mesh;
    };

    const sourceBone = new THREE.Bone();
    sourceBone.name = "hips";
    const sourceSkeleton = new THREE.Skeleton(
      [sourceBone],
      [new THREE.Matrix4()],
    );
    const model = new THREE.Group();
    model.userData.hyperia = {
      duelFit: {
        schemaVersion: 1,
        itemId: "bronze_platebody",
        slot: "body",
        compatibleAvatarIds: ["bandit"],
        rigFingerprint: TEST_RIG_FINGERPRINT,
      },
    };
    model.add(createSkinnedMesh(sourceSkeleton));

    const targetBone = new THREE.Bone();
    targetBone.name = "hips";
    const targetSkeleton = new THREE.Skeleton([targetBone]);
    const targetScene = new THREE.Group();
    const targetMesh = createSkinnedMesh(targetSkeleton);
    targetSkeleton.boneInverses[0].makeTranslation(0.25, 0, 0);
    targetScene.add(targetMesh);

    expect(
      validateStreamingEquipmentVisualModel(model, "body", {
        itemId: "bronze_platebody",
        avatarId: "bandit",
        vrm: { scene: targetScene } as unknown as VRM,
      }),
    ).toEqual({ valid: false, reason: "incompatible_skeleton" });
  });

  it("deduplicates concurrent warm-up and first-equip model work", async () => {
    const internals = system as unknown as {
      loadEquipmentModel: (
        itemId: string,
        slot: string,
        fallbackItemData: null,
      ) => Promise<unknown>;
    };

    await Promise.all([
      internals.loadEquipmentModel("bronze_longsword", "weapon", null),
      internals.loadEquipmentModel("bronze_longsword", "weapon", null),
    ]);

    expect(mockWorld.loader.loadFile).toHaveBeenCalledTimes(1);
  });

  it("should handle equipment change and equip item", async () => {
    // Trigger the event handler directly to test logic
    // We need to access the private method or bind the event handler
    // But since we mocked world.events.on, we can't easily trigger it through world.
    // Instead, we'll cast system to any to access private methods for testing

    const handler = (system as any).handleEquipmentChange.bind(system);

    await handler({
      playerId: "player1",
      slot: "mainHand",
      itemId: "bronze_sword",
    });

    // Verify GLTFLoader was called
    // We need to access the mocked loader instance
    // Since we mocked the module, we can check if loadAsync was called implicitly
    // However, checking the visual result is better

    // Check if player equipment map has entry
    const equipment = (system as any).playerEquipment.get("player1");
    expect(equipment).toBeDefined();
    expect(equipment.mainhand).toBeDefined(); // Slot name lowercased
  });

  it("should unequip item when itemId is null", async () => {
    const handler = (system as any).handleEquipmentChange.bind(system);

    // First equip
    await handler({
      playerId: "player1",
      slot: "mainHand",
      itemId: "bronze_sword",
    });

    let equipment = (system as any).playerEquipment.get("player1");
    expect(equipment.mainhand).toBeDefined();

    // Then unequip
    await handler({
      playerId: "player1",
      slot: "mainHand",
      itemId: null,
    });

    equipment = (system as any).playerEquipment.get("player1");
    expect(equipment.mainhand).toBeUndefined();
  });

  it("should queue equipment if player VRM is not ready", async () => {
    // Remove VRM from player
    mockPlayer._avatar.instance.raw.userData.vrm = undefined;

    const handler = (system as any).handleEquipmentChange.bind(system);

    await handler({
      playerId: "player1",
      slot: "mainHand",
      itemId: "bronze_sword",
    });

    // Check pending queue
    const pending = (system as any).pendingEquipment.get("player1");
    expect(pending).toBeDefined();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toEqual({ slot: "mainHand", itemId: "bronze_sword" });
  });

  it("abandons an equipment load when its spectator entity leaves", async () => {
    let resolveFile: ((file: File) => void) | undefined;
    mockWorld.loader.loadFile.mockImplementationOnce(
      () =>
        new Promise<File>((resolve) => {
          resolveFile = resolve;
        }),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const handler = (system as any).handleEquipmentChange.bind(system);

    const pending = handler({
      playerId: "player1",
      slot: "weapon",
      itemId: "transition_race_sword",
    });
    mockWorld.entities.delete("player1");
    resolveFile?.(
      new File([new ArrayBuffer(8)], "transition-race.glb", {
        type: "model/gltf-binary",
      }),
    );
    await pending;

    expect(consoleError).not.toHaveBeenCalled();
    expect((system as any).playerEquipment.get("player1")).toEqual({});
  });

  it("cannot attach a stale model after a newer role switch wins the slot", async () => {
    const internals = system as unknown as {
      handleEquipmentChange: (data: {
        playerId: string;
        slot: string;
        itemId: string | null;
      }) => Promise<void>;
      loadEquipmentModel: (
        itemId: string,
        slot: string,
        fallbackItemData: unknown,
      ) => Promise<unknown>;
      attachedEquipmentItemIds: Map<string, Map<string, string>>;
    };
    const parsedModel = await internals.loadEquipmentModel(
      "replacement_sword",
      "weapon",
      null,
    );
    let resolveOld: ((model: unknown) => void) | undefined;
    internals.loadEquipmentModel = (itemId) =>
      itemId === "slow_old_sword"
        ? new Promise((resolve) => {
            resolveOld = resolve;
          })
        : Promise.resolve(parsedModel);

    const oldSwitch = internals.handleEquipmentChange({
      playerId: "player1",
      slot: "weapon",
      itemId: "slow_old_sword",
    });
    await internals.handleEquipmentChange({
      playerId: "player1",
      slot: "weapon",
      itemId: "replacement_sword",
    });
    resolveOld?.(parsedModel);
    await oldSwitch;

    expect(
      internals.attachedEquipmentItemIds.get("player1")?.get("weapon"),
    ).toBe("replacement_sword");
  });

  it("should handle gathering tool visibility (hide weapon)", async () => {
    const equipHandler = (system as any).handleEquipmentChange.bind(system);
    const showToolHandler = (system as any).handleGatheringToolShow.bind(
      system,
    );

    // Equip weapon first
    await equipHandler({
      playerId: "player1",
      slot: "weapon",
      itemId: "bronze_sword",
    });

    const equipment = (system as any).playerEquipment.get("player1");
    const weapon = equipment.weapon;
    expect(weapon.visible).toBe(true);

    // Show gathering tool
    await showToolHandler({
      playerId: "player1",
      itemId: "fishing_rod",
      slot: "weapon",
    });

    // Weapon should be hidden
    expect(weapon.visible).toBe(false);

    // Tool should be equipped in special slot
    expect(equipment.gatheringtool).toBeDefined();
  });

  it("should restore weapon visibility when gathering tool is hidden", async () => {
    const equipHandler = (system as any).handleEquipmentChange.bind(system);
    const showToolHandler = (system as any).handleGatheringToolShow.bind(
      system,
    );
    const hideToolHandler = (system as any).handleGatheringToolHide.bind(
      system,
    );

    // Equip weapon
    await equipHandler({
      playerId: "player1",
      slot: "weapon",
      itemId: "bronze_sword",
    });

    const equipment = (system as any).playerEquipment.get("player1");
    const weapon = equipment.weapon;

    // Show tool
    await showToolHandler({
      playerId: "player1",
      itemId: "fishing_rod",
      slot: "weapon",
    });

    expect(weapon.visible).toBe(false);

    // Hide tool
    await hideToolHandler({
      playerId: "player1",
      slot: "weapon",
    });

    // Weapon should be visible again
    expect(weapon.visible).toBe(true);
    // Tool should be removed
    expect(equipment.gatheringtool).toBeUndefined();
  });
});

describe("held-equipment death visibility", () => {
  it("keeps held equipment visible during ordinary and combat emotes", () => {
    expect(shouldRenderHeldEquipmentVisual({ emote: "idle" })).toBe(true);
    expect(shouldRenderHeldEquipmentVisual({ emote: "range" })).toBe(true);
    expect(
      shouldRenderHeldEquipmentVisual({
        emote: "spell_cast",
        deathState: "alive",
      }),
    ).toBe(true);
  });

  it("hides held equipment for every authoritative death signal", () => {
    expect(shouldRenderHeldEquipmentVisual({ emote: "death" })).toBe(false);
    expect(shouldRenderHeldEquipmentVisual({ abbreviatedEmote: "death" })).toBe(
      false,
    );
    expect(shouldRenderHeldEquipmentVisual({ deathState: "dying" })).toBe(
      false,
    );
    expect(shouldRenderHeldEquipmentVisual({ deathState: "dead" })).toBe(false);
  });

  it("hides held equipment during the two-hands-up victory presentation", () => {
    expect(shouldRenderHeldEquipmentVisual({ emote: "victory" })).toBe(false);
    expect(
      shouldRenderHeldEquipmentVisual({ abbreviatedEmote: "victory" }),
    ).toBe(false);
  });
});

describe("stable fitted staff pose", () => {
  const createStaff = () => {
    const root = new THREE.Group();
    root.userData.hyperia = {
      version: 2,
      vrmBoneName: "rightHand",
      relativeMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      weaponType: "staff",
      duelFit: {
        schemaVersion: 1,
        itemId: "staff_of_air",
        slot: "weapon",
        compatibleAvatarIds: ["steve"],
      },
      stableHeldPose: {
        schemaVersion: 1,
        wrapperNodeName: "EquipmentWrapper",
        avatarLocalEulerDegrees: [0, 0, 18],
      },
    };
    const wrapper = new THREE.Group();
    wrapper.name = "EquipmentWrapper";
    wrapper.position.set(0.1, 0.2, 0.3);
    wrapper.quaternion.setFromEuler(new THREE.Euler(0.2, -0.4, 0.1));
    wrapper.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 1.3, 0.05),
        new THREE.MeshBasicMaterial(),
      ),
    );
    root.add(wrapper);
    return { root, wrapper };
  };

  it("fails closed when a fitted staff has no valid stable-pose authority", () => {
    const { root } = createStaff();
    delete root.userData.hyperia.stableHeldPose;
    expect(
      validateStreamingEquipmentVisualModel(root, "weapon", {
        itemId: "staff_of_air",
        avatarId: "steve",
      }),
    ).toEqual({ valid: false, reason: "invalid_stable_held_pose" });

    root.userData.hyperia.stableHeldPose = {
      schemaVersion: 1,
      wrapperNodeName: "EquipmentWrapper",
      avatarLocalEulerDegrees: [0, 0, 181],
    };
    expect(
      validateStreamingEquipmentVisualModel(root, "weapon", {
        itemId: "staff_of_air",
        avatarId: "steve",
      }),
    ).toEqual({ valid: false, reason: "invalid_stable_held_pose" });
  });

  it("cancels wrist roll while preserving grip position and avatar facing", () => {
    const { root, wrapper } = createStaff();
    const avatarScene = new THREE.Group();
    avatarScene.rotation.y = 0.7;
    const rightHand = new THREE.Object3D();
    rightHand.position.set(0.4, 1, -0.2);
    rightHand.rotation.set(0.8, -0.3, 1.1);
    avatarScene.add(rightHand);
    rightHand.add(root);
    avatarScene.updateMatrixWorld(true);
    const originalPosition = wrapper.position.clone();
    const originalQuaternion = wrapper.quaternion.clone();
    const mesh = wrapper.children[0] as THREE.Mesh;
    const originalRenderHook = vi.fn();
    mesh.onBeforeRender = originalRenderHook;

    const controller = createStableHeldEquipmentPoseController({
      modelRoot: root,
      vrm: { scene: avatarScene } as unknown as VRM,
    });
    expect(controller).not.toBeNull();

    const expectedAvatarLocal = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, 0, THREE.MathUtils.degToRad(18)),
    );
    const expectedWorld = avatarScene
      .getWorldQuaternion(new THREE.Quaternion())
      .multiply(expectedAvatarLocal);
    expect(
      wrapper.getWorldQuaternion(new THREE.Quaternion()).angleTo(expectedWorld),
    ).toBeLessThan(1e-7);
    expect(wrapper.position.distanceTo(originalPosition)).toBe(0);

    rightHand.rotation.set(-1.2, 0.9, -0.6);
    avatarScene.rotation.y = -0.45;
    avatarScene.updateMatrixWorld(true);
    controller!.update();
    const rotatedExpected = avatarScene
      .getWorldQuaternion(new THREE.Quaternion())
      .multiply(expectedAvatarLocal);
    expect(
      wrapper
        .getWorldQuaternion(new THREE.Quaternion())
        .angleTo(rotatedExpected),
    ).toBeLessThan(1e-7);
    expect(wrapper.position.distanceTo(originalPosition)).toBe(0);

    mesh.onBeforeRender(
      {} as THREE.WebGLRenderer,
      {} as THREE.Scene,
      {} as THREE.Camera,
      {} as THREE.BufferGeometry,
      {} as THREE.Material,
      {} as THREE.Group,
    );
    expect(originalRenderHook).toHaveBeenCalledOnce();

    controller!.dispose();
    expect(wrapper.quaternion.angleTo(originalQuaternion)).toBeLessThan(1e-7);
    expect(mesh.onBeforeRender).toBe(originalRenderHook);
  });
});

describe("dynamic competitive bowstring", () => {
  const createBow = () => {
    const root = new THREE.Group();
    root.userData.hyperia = {
      version: 2,
      vrmBoneName: "leftHand",
      relativeMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      weaponType: "bow",
      duelFit: {
        schemaVersion: 1,
        itemId: "shortbow",
        slot: "weapon",
        compatibleAvatarIds: ["steve"],
      },
      bowString: {
        schemaVersion: 1,
        contentNodeName: "EquipmentContent",
        upperTip: [0, 1, 0],
        lowerTip: [0, -1, 0],
        restNock: [0, 0, 0],
      },
    };
    const content = new THREE.Group();
    content.name = "EquipmentContent";
    root.add(content);
    return { root, content };
  };

  it("fails closed when a fitted bow has no dynamic string authority", () => {
    const { root } = createBow();
    delete root.userData.hyperia.bowString;
    expect(
      validateStreamingEquipmentVisualModel(root, "weapon", {
        itemId: "shortbow",
        avatarId: "steve",
      }),
    ).toEqual({ valid: false, reason: "invalid_dynamic_bow_string" });
  });

  it("keeps a resting string straight and moves its nock to the draw hand", () => {
    const { root, content } = createBow();
    const avatarScene = new THREE.Group();
    const rightHand = new THREE.Object3D();
    rightHand.position.set(0.25, 0.1, 0.75);
    avatarScene.add(rightHand);
    avatarScene.updateMatrixWorld(true);
    let emote = "idle";
    let now = 1_000;
    const transitions: DynamicBowStringTransition[] = [];
    const controller = createDynamicBowStringController({
      modelRoot: root,
      vrm: {
        scene: avatarScene,
        humanoid: {
          getRawBoneNode: (name: string) =>
            name === "rightHand" ? rightHand : null,
        },
      } as unknown as VRM,
      getState: () => ({ emote }),
      now: () => now,
      onTransition: (transition) => transitions.push(transition),
    });
    expect(controller).not.toBeNull();
    const positions = controller!.line.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    expect(Array.from(positions.array)).toEqual([0, 1, 0, 0, 0, 0, 0, -1, 0]);

    emote = "range";
    content.updateMatrixWorld(true);
    controller!.update();
    expect(Array.from(positions.array)).toHaveLength(9);
    [0, 1, 0, 0.25, 0.1, 0.75, 0, -1, 0].forEach((value, index) =>
      expect(positions.array[index]).toBeCloseTo(value, 6),
    );
    expect(controller!.nockedArrow.visible).toBe(true);
    expect(controller!.nockedArrow.parent).toBe(avatarScene);

    expect(controller!.scheduleRelease(400, "bronze_arrow")).toBe(true);
    expect(transitions).toEqual([
      {
        kind: "scheduled",
        performanceTimeMs: 1_000,
        releaseAtPerformanceTimeMs: 1_400,
      },
    ]);
    now = 1_399;
    controller!.update();
    expect(controller!.nockedArrow.visible).toBe(true);
    now = 1_400;
    controller!.update();
    expect(controller!.nockedArrow.visible).toBe(false);
    expect(transitions[1]).toEqual({
      kind: "released",
      performanceTimeMs: 1_400,
      lastVisibleNockWorldPosition: [0.25, 0.1, 0.75],
      drawHandWorldPosition: [0.25, 0.1, 0.75],
    });
    controller!.update();
    expect(transitions).toHaveLength(2);
    expect(Array.from(positions.array)).toEqual([0, 1, 0, 0, 0, 0, 0, -1, 0]);
    expect(controller!.scheduleRelease(Number.NaN, "bronze_arrow")).toBe(false);
    expect(transitions).toHaveLength(2);

    emote = "idle";
    controller!.update();
    emote = "range";
    now = 1_500;
    controller!.update();
    expect(controller!.nockedArrow.visible).toBe(true);

    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    controller!.nockedArrow.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      objectMaterials.forEach((material) => materials.add(material));
    });
    const geometryDisposals = [...geometries].map((geometry) =>
      vi.spyOn(geometry, "dispose"),
    );
    const materialDisposals = [...materials].map((material) =>
      vi.spyOn(material, "dispose"),
    );
    controller!.dispose();
    expect(controller!.line.parent).toBeNull();
    expect(controller!.nockedArrow.parent).toBeNull();
    expect(geometryDisposals.every((spy) => spy.mock.calls.length > 0)).toBe(
      true,
    );
    expect(materialDisposals.every((spy) => spy.mock.calls.length > 0)).toBe(
      true,
    );
  });
});
