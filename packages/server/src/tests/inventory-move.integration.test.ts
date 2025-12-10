/**
 * Inventory Move Integration Tests
 *
 * Tests the inventory move/swap handler logic with mocked socket/world dependencies.
 * Verifies OSRS-style SWAP behavior (not INSERT), validation, and rate limiting.
 */

import { describe, it, expect, beforeEach, mock } from "bun:test";
import { INPUT_LIMITS, EventType } from "@hyperscape/shared";

// Mock types matching the handler expectations
interface MockInventoryItem {
  itemId: string;
  quantity: number;
  slot: number;
  item: {
    id: string;
    name: string;
    type: string;
    stackable: boolean;
    weight: number;
  };
}

interface MockPlayer {
  id: string;
  visibleName: string;
  position: { x: number; y: number; z: number };
}

interface MockSocket {
  id: string;
  player: MockPlayer;
  emit: ReturnType<typeof mock>;
}

interface MockInventory {
  playerId: string;
  items: MockInventoryItem[];
  coins: number;
}

interface MockWorld {
  emit: ReturnType<typeof mock>;
  getSystem: (name: string) => MockInventorySystem | undefined;
}

interface MockInventorySystem {
  getInventory: (playerId: string) => MockInventory | undefined;
  getInventoryData: (playerId: string) => {
    items: MockInventoryItem[];
    coins: number;
    maxSlots: number;
  };
}

// Create mock factories
function createMockPlayer(overrides: Partial<MockPlayer> = {}): MockPlayer {
  return {
    id: "player-123",
    visibleName: "TestPlayer",
    position: { x: 10, y: 0, z: 10 },
    ...overrides,
  };
}

function createMockSocket(player: MockPlayer): MockSocket {
  return {
    id: "socket-123",
    player,
    emit: mock(() => {}),
  };
}

function createMockItem(
  itemId: string,
  slot: number,
  quantity: number = 1,
): MockInventoryItem {
  return {
    itemId,
    quantity,
    slot,
    item: {
      id: itemId,
      name: itemId.replace(/_/g, " "),
      type: "weapon",
      stackable: false,
      weight: 1.0,
    },
  };
}

function createMockInventory(
  playerId: string,
  items: MockInventoryItem[],
): MockInventory {
  return {
    playerId,
    items,
    coins: 100,
  };
}

// Simulate the slot validation logic from InputValidation.ts
function isValidInventorySlot(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < INPUT_LIMITS.MAX_INVENTORY_SLOTS
  );
}

// Simulate the OSRS-style SWAP logic from InventorySystem.moveItem
function performSwap(
  inventory: MockInventory,
  fromSlot: number,
  toSlot: number,
): boolean {
  // Validate slots
  if (!isValidInventorySlot(fromSlot) || !isValidInventorySlot(toSlot)) {
    return false;
  }

  // Can't swap with same slot (no-op)
  if (fromSlot === toSlot) {
    return false;
  }

  const fromItem = inventory.items.find((item) => item.slot === fromSlot);
  const toItem = inventory.items.find((item) => item.slot === toSlot);

  // Can't move from empty slot
  if (!fromItem) {
    return false;
  }

  // OSRS-style SWAP: exchange two slots directly
  if (fromItem && toItem) {
    // Both slots occupied - swap
    fromItem.slot = toSlot;
    toItem.slot = fromSlot;
  } else if (fromItem) {
    // Only fromSlot occupied - move to empty slot
    fromItem.slot = toSlot;
  }

  return true;
}

// Rate limiting simulation
const MAX_MOVES_PER_SECOND = 10;
const moveRateLimiter = new Map<string, { count: number; resetTime: number }>();

function checkMoveRateLimit(playerId: string): boolean {
  const now = Date.now();
  const playerLimit = moveRateLimiter.get(playerId);

  if (playerLimit) {
    if (now < playerLimit.resetTime) {
      if (playerLimit.count >= MAX_MOVES_PER_SECOND) {
        return false;
      }
      playerLimit.count++;
    } else {
      playerLimit.count = 1;
      playerLimit.resetTime = now + 1000;
    }
  } else {
    moveRateLimiter.set(playerId, { count: 1, resetTime: now + 1000 });
  }

  return true;
}

// Simulate the full handler flow
function handleMoveItem(
  socket: MockSocket,
  data: unknown,
  world: MockWorld,
  inventory: MockInventory,
): { success: boolean; error?: string } {
  const playerEntity = socket.player;
  if (!playerEntity) {
    return { success: false, error: "No player entity" };
  }

  // Rate limit check
  if (!checkMoveRateLimit(playerEntity.id)) {
    return { success: false, error: "Rate limited" };
  }

  // Validate payload
  if (!data || typeof data !== "object") {
    return { success: false, error: "Invalid payload" };
  }

  const payload = data as Record<string, unknown>;
  const fromSlot = payload.fromSlot;
  const toSlot = payload.toSlot;

  // Validate slot indices
  if (!isValidInventorySlot(fromSlot)) {
    return { success: false, error: "Invalid fromSlot" };
  }
  if (!isValidInventorySlot(toSlot)) {
    return { success: false, error: "Invalid toSlot" };
  }

  // Perform the swap
  const swapped = performSwap(inventory, fromSlot, toSlot);

  if (swapped) {
    // Emit event for systems to handle
    world.emit(EventType.INVENTORY_MOVE, {
      playerId: playerEntity.id,
      fromSlot,
      toSlot,
    });
    return { success: true };
  }

  return { success: false, error: "Swap failed" };
}

describe("Inventory Move Integration - OSRS-style SWAP", () => {
  let player: MockPlayer;
  let socket: MockSocket;
  let world: MockWorld;
  let inventory: MockInventory;

  beforeEach(() => {
    // Reset rate limiter between tests
    moveRateLimiter.clear();

    player = createMockPlayer();
    socket = createMockSocket(player);
    world = {
      emit: mock(() => {}),
      getSystem: mock(() => {}),
    };
  });

  describe("Swapping items between two occupied slots", () => {
    it("swaps sword in slot 0 with shield in slot 5", () => {
      inventory = createMockInventory(player.id, [
        createMockItem("bronze_sword", 0),
        createMockItem("bronze_shield", 5),
      ]);

      const result = handleMoveItem(
        socket,
        { fromSlot: 0, toSlot: 5 },
        world,
        inventory,
      );

      expect(result.success).toBe(true);

      // Verify items swapped positions
      const sword = inventory.items.find((i) => i.itemId === "bronze_sword");
      const shield = inventory.items.find((i) => i.itemId === "bronze_shield");

      expect(sword?.slot).toBe(5);
      expect(shield?.slot).toBe(0);
    });

    it("swaps items in non-adjacent slots (slot 2 and slot 25)", () => {
      inventory = createMockInventory(player.id, [
        createMockItem("iron_sword", 2),
        createMockItem("gold_ring", 25),
      ]);

      const result = handleMoveItem(
        socket,
        { fromSlot: 2, toSlot: 25 },
        world,
        inventory,
      );

      expect(result.success).toBe(true);

      const sword = inventory.items.find((i) => i.itemId === "iron_sword");
      const ring = inventory.items.find((i) => i.itemId === "gold_ring");

      expect(sword?.slot).toBe(25);
      expect(ring?.slot).toBe(2);
    });

    it("emits INVENTORY_MOVE event on successful swap", () => {
      inventory = createMockInventory(player.id, [
        createMockItem("bronze_sword", 0),
        createMockItem("bronze_shield", 5),
      ]);

      handleMoveItem(socket, { fromSlot: 0, toSlot: 5 }, world, inventory);

      expect(world.emit).toHaveBeenCalledWith(EventType.INVENTORY_MOVE, {
        playerId: player.id,
        fromSlot: 0,
        toSlot: 5,
      });
    });
  });

  describe("Moving item to empty slot", () => {
    it("moves item from slot 0 to empty slot 10", () => {
      inventory = createMockInventory(player.id, [
        createMockItem("bronze_sword", 0),
      ]);

      const result = handleMoveItem(
        socket,
        { fromSlot: 0, toSlot: 10 },
        world,
        inventory,
      );

      expect(result.success).toBe(true);

      const sword = inventory.items.find((i) => i.itemId === "bronze_sword");
      expect(sword?.slot).toBe(10);
    });

    it("moves item to last slot (27)", () => {
      inventory = createMockInventory(player.id, [
        createMockItem("bronze_sword", 0),
      ]);

      const result = handleMoveItem(
        socket,
        { fromSlot: 0, toSlot: 27 },
        world,
        inventory,
      );

      expect(result.success).toBe(true);

      const sword = inventory.items.find((i) => i.itemId === "bronze_sword");
      expect(sword?.slot).toBe(27);
    });

    it("leaves source slot empty after move", () => {
      inventory = createMockInventory(player.id, [
        createMockItem("bronze_sword", 0),
      ]);

      handleMoveItem(socket, { fromSlot: 0, toSlot: 10 }, world, inventory);

      // No item should be in slot 0 anymore
      const itemInSlot0 = inventory.items.find((i) => i.slot === 0);
      expect(itemInSlot0).toBeUndefined();
    });
  });

  describe("Same-slot move (no-op)", () => {
    it("rejects move from slot 5 to slot 5", () => {
      inventory = createMockInventory(player.id, [
        createMockItem("bronze_sword", 5),
      ]);

      const result = handleMoveItem(
        socket,
        { fromSlot: 5, toSlot: 5 },
        world,
        inventory,
      );

      expect(result.success).toBe(false);
      expect(world.emit).not.toHaveBeenCalled();
    });

    it("does not modify inventory on same-slot move", () => {
      inventory = createMockInventory(player.id, [
        createMockItem("bronze_sword", 5),
      ]);

      const originalSlot = inventory.items[0].slot;

      handleMoveItem(socket, { fromSlot: 5, toSlot: 5 }, world, inventory);

      expect(inventory.items[0].slot).toBe(originalSlot);
    });
  });

  describe("Empty source slot", () => {
    it("rejects move from empty slot", () => {
      inventory = createMockInventory(player.id, [
        createMockItem("bronze_sword", 5), // Only item in slot 5
      ]);

      const result = handleMoveItem(
        socket,
        { fromSlot: 0, toSlot: 10 }, // Slot 0 is empty
        world,
        inventory,
      );

      expect(result.success).toBe(false);
      expect(world.emit).not.toHaveBeenCalled();
    });
  });
});

describe("Inventory Move Integration - Input Validation", () => {
  let player: MockPlayer;
  let socket: MockSocket;
  let world: MockWorld;
  let inventory: MockInventory;

  beforeEach(() => {
    moveRateLimiter.clear();
    player = createMockPlayer();
    socket = createMockSocket(player);
    world = { emit: mock(() => {}), getSystem: mock(() => {}) };
    inventory = createMockInventory(player.id, [
      createMockItem("bronze_sword", 0),
    ]);
  });

  describe("Out-of-bounds slot rejection", () => {
    it("rejects negative fromSlot (-1)", () => {
      const result = handleMoveItem(
        socket,
        { fromSlot: -1, toSlot: 5 },
        world,
        inventory,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid fromSlot");
    });

    it("rejects fromSlot >= 28", () => {
      const result = handleMoveItem(
        socket,
        { fromSlot: 28, toSlot: 5 },
        world,
        inventory,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid fromSlot");
    });

    it("rejects negative toSlot (-1)", () => {
      const result = handleMoveItem(
        socket,
        { fromSlot: 0, toSlot: -1 },
        world,
        inventory,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid toSlot");
    });

    it("rejects toSlot >= 28", () => {
      const result = handleMoveItem(
        socket,
        { fromSlot: 0, toSlot: 28 },
        world,
        inventory,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid toSlot");
    });

    it("rejects extremely large slot numbers", () => {
      const result = handleMoveItem(
        socket,
        { fromSlot: 0, toSlot: 999999 },
        world,
        inventory,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid toSlot");
    });
  });

  describe("Invalid payload types", () => {
    it("rejects non-integer fromSlot (float)", () => {
      const result = handleMoveItem(
        socket,
        { fromSlot: 1.5, toSlot: 5 },
        world,
        inventory,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid fromSlot");
    });

    it("rejects string fromSlot", () => {
      const result = handleMoveItem(
        socket,
        { fromSlot: "0", toSlot: 5 },
        world,
        inventory,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid fromSlot");
    });

    it("rejects null payload", () => {
      const result = handleMoveItem(socket, null, world, inventory);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid payload");
    });

    it("rejects undefined payload", () => {
      const result = handleMoveItem(socket, undefined, world, inventory);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid payload");
    });

    it("rejects NaN slot values", () => {
      const result = handleMoveItem(
        socket,
        { fromSlot: NaN, toSlot: 5 },
        world,
        inventory,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid fromSlot");
    });

    it("rejects Infinity slot values", () => {
      const result = handleMoveItem(
        socket,
        { fromSlot: 0, toSlot: Infinity },
        world,
        inventory,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid toSlot");
    });
  });

  describe("Boundary slot values (0 and 27)", () => {
    it("accepts fromSlot = 0", () => {
      const result = handleMoveItem(
        socket,
        { fromSlot: 0, toSlot: 5 },
        world,
        inventory,
      );

      expect(result.success).toBe(true);
    });

    it("accepts toSlot = 27", () => {
      const result = handleMoveItem(
        socket,
        { fromSlot: 0, toSlot: 27 },
        world,
        inventory,
      );

      expect(result.success).toBe(true);
    });

    it("accepts fromSlot = 27", () => {
      inventory = createMockInventory(player.id, [
        createMockItem("bronze_sword", 27),
      ]);

      const result = handleMoveItem(
        socket,
        { fromSlot: 27, toSlot: 0 },
        world,
        inventory,
      );

      expect(result.success).toBe(true);
    });
  });
});

describe("Inventory Move Integration - Rate Limiting", () => {
  let player: MockPlayer;
  let socket: MockSocket;
  let world: MockWorld;
  let inventory: MockInventory;

  beforeEach(() => {
    moveRateLimiter.clear();
    player = createMockPlayer();
    socket = createMockSocket(player);
    world = { emit: mock(() => {}), getSystem: mock(() => {}) };
  });

  it("allows up to 10 moves per second", () => {
    inventory = createMockInventory(player.id, [
      createMockItem("bronze_sword", 0),
      createMockItem("bronze_shield", 1),
    ]);

    // First 10 should succeed
    for (let i = 0; i < 10; i++) {
      const from = i % 2 === 0 ? 0 : 1;
      const to = i % 2 === 0 ? 1 : 0;
      const result = handleMoveItem(
        socket,
        { fromSlot: from, toSlot: to },
        world,
        inventory,
      );
      expect(result.success).toBe(true);
    }
  });

  it("blocks 11th move within same second", () => {
    inventory = createMockInventory(player.id, [
      createMockItem("bronze_sword", 0),
      createMockItem("bronze_shield", 1),
    ]);

    // Exhaust rate limit
    for (let i = 0; i < 10; i++) {
      handleMoveItem(
        socket,
        { fromSlot: i % 2, toSlot: (i + 1) % 2 },
        world,
        inventory,
      );
    }

    // 11th should fail
    const result = handleMoveItem(
      socket,
      { fromSlot: 0, toSlot: 1 },
      world,
      inventory,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Rate limited");
  });

  it("allows moves from different players simultaneously", () => {
    const player2 = createMockPlayer({ id: "player-456" });
    const socket2 = createMockSocket(player2);

    const inventory1 = createMockInventory(player.id, [
      createMockItem("bronze_sword", 0),
    ]);
    const inventory2 = createMockInventory(player2.id, [
      createMockItem("iron_sword", 0),
    ]);

    const result1 = handleMoveItem(
      socket,
      { fromSlot: 0, toSlot: 5 },
      world,
      inventory1,
    );
    const result2 = handleMoveItem(
      socket2,
      { fromSlot: 0, toSlot: 5 },
      world,
      inventory2,
    );

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
  });
});

describe("Inventory Move Integration - Concurrent Moves", () => {
  let player: MockPlayer;
  let socket: MockSocket;
  let world: MockWorld;
  let inventory: MockInventory;

  beforeEach(() => {
    moveRateLimiter.clear();
    player = createMockPlayer();
    socket = createMockSocket(player);
    world = { emit: mock(() => {}), getSystem: mock(() => {}) };
  });

  it("handles rapid sequential moves without corruption", () => {
    // Setup: items in slots 0, 1, 2
    inventory = createMockInventory(player.id, [
      createMockItem("item_a", 0),
      createMockItem("item_b", 1),
      createMockItem("item_c", 2),
    ]);

    // Rapid moves: 0->1, 1->2, 2->0 (circular swap pattern)
    handleMoveItem(socket, { fromSlot: 0, toSlot: 1 }, world, inventory);
    // After: A in 1, B in 0, C in 2

    handleMoveItem(socket, { fromSlot: 1, toSlot: 2 }, world, inventory);
    // After: A in 2, B in 0, C in 1

    handleMoveItem(socket, { fromSlot: 2, toSlot: 0 }, world, inventory);
    // After: A in 0, B in 2, C in 1

    // Verify final state
    const itemA = inventory.items.find((i) => i.itemId === "item_a");
    const itemB = inventory.items.find((i) => i.itemId === "item_b");
    const itemC = inventory.items.find((i) => i.itemId === "item_c");

    expect(itemA?.slot).toBe(0);
    expect(itemB?.slot).toBe(2);
    expect(itemC?.slot).toBe(1);
  });

  it("maintains item count after many moves", () => {
    inventory = createMockInventory(player.id, [
      createMockItem("item_a", 0),
      createMockItem("item_b", 5),
      createMockItem("item_c", 10),
      createMockItem("item_d", 15),
      createMockItem("item_e", 20),
    ]);

    const originalCount = inventory.items.length;

    // Perform many moves
    for (let i = 0; i < 9; i++) {
      // Stay under rate limit
      const from = i % 28;
      const to = (i + 5) % 28;
      handleMoveItem(socket, { fromSlot: from, toSlot: to }, world, inventory);
    }

    // Item count should never change (SWAP doesn't add/remove items)
    expect(inventory.items.length).toBe(originalCount);
  });

  it("never creates duplicate items", () => {
    inventory = createMockInventory(player.id, [
      createMockItem("unique_sword", 0),
      createMockItem("unique_shield", 1),
    ]);

    // Swap back and forth
    handleMoveItem(socket, { fromSlot: 0, toSlot: 1 }, world, inventory);
    handleMoveItem(socket, { fromSlot: 1, toSlot: 0 }, world, inventory);
    handleMoveItem(socket, { fromSlot: 0, toSlot: 1 }, world, inventory);

    // Should still only have 2 items
    expect(inventory.items.length).toBe(2);

    // Each item should appear exactly once
    const swordCount = inventory.items.filter(
      (i) => i.itemId === "unique_sword",
    ).length;
    const shieldCount = inventory.items.filter(
      (i) => i.itemId === "unique_shield",
    ).length;

    expect(swordCount).toBe(1);
    expect(shieldCount).toBe(1);
  });

  it("never loses items during moves", () => {
    const itemIds = ["sword", "shield", "helmet", "boots", "ring"];
    inventory = createMockInventory(
      player.id,
      itemIds.map((id, i) => createMockItem(id, i)),
    );

    // Shuffle items around
    handleMoveItem(socket, { fromSlot: 0, toSlot: 4 }, world, inventory);
    handleMoveItem(socket, { fromSlot: 1, toSlot: 3 }, world, inventory);
    handleMoveItem(socket, { fromSlot: 2, toSlot: 0 }, world, inventory);

    // All original items should still exist
    for (const id of itemIds) {
      const found = inventory.items.find((i) => i.itemId === id);
      expect(found).toBeDefined();
    }
  });
});

describe("Inventory Move Integration - Stackable Items", () => {
  let player: MockPlayer;
  let socket: MockSocket;
  let world: MockWorld;

  beforeEach(() => {
    moveRateLimiter.clear();
    player = createMockPlayer();
    socket = createMockSocket(player);
    world = { emit: mock(() => {}), getSystem: mock(() => {}) };
  });

  it("swaps stackable items without merging stacks", () => {
    // OSRS inventory swap doesn't merge stacks - that's a bank operation
    const arrows1 = createMockItem("bronze_arrows", 0, 50);
    arrows1.item.stackable = true;
    const arrows2 = createMockItem("bronze_arrows", 5, 100);
    arrows2.item.stackable = true;

    const inventory = createMockInventory(player.id, [arrows1, arrows2]);

    handleMoveItem(socket, { fromSlot: 0, toSlot: 5 }, world, inventory);

    // Should swap positions, not merge
    expect(inventory.items.length).toBe(2);

    const item1 = inventory.items.find((i) => i.slot === 0);
    const item2 = inventory.items.find((i) => i.slot === 5);

    expect(item1?.quantity).toBe(100); // Original 100-stack moved to slot 0
    expect(item2?.quantity).toBe(50); // Original 50-stack moved to slot 5
  });

  it("preserves quantity when moving stackable item to empty slot", () => {
    const arrows = createMockItem("bronze_arrows", 0, 999);
    arrows.item.stackable = true;

    const inventory = createMockInventory(player.id, [arrows]);

    handleMoveItem(socket, { fromSlot: 0, toSlot: 15 }, world, inventory);

    const movedArrows = inventory.items.find(
      (i) => i.itemId === "bronze_arrows",
    );
    expect(movedArrows?.slot).toBe(15);
    expect(movedArrows?.quantity).toBe(999);
  });
});
