/**
 * Processing / Skill Handlers
 *
 * Handles all processing-skill-related packet handlers:
 * - Firemaking (lighting fires from logs)
 * - Cooking (raw food on fire/range)
 * - Smelting (bars at furnace)
 * - Smithing (items at anvil)
 * - Crafting (needle, chisel, furnace jewelry)
 * - Fletching (knife on logs, item-on-item)
 * - Tanning (hides at tanner)
 * - Runecrafting (essence at altar)
 *
 * Each handler validates input, applies rate limiting, and emits the
 * appropriate EventType for the corresponding server-side system.
 */

import type { ServerSocket } from "../../../shared/types";
import { EventType, World } from "@hyperforge/shared";
import type { TileMovementManager } from "../tile-movement";
import type { PendingCookManager } from "../PendingCookManager";
import type { PendingGatherManager } from "../PendingGatherManager";
import type { TickSystem } from "../../TickSystem";
import type {
  ResourceInteractPayload,
  CookingSourceInteractPayload,
  FiremakingRequestPayload,
  CookingRequestPayload,
  SmeltingSourceInteractPayload,
  SmithingSourceInteractPayload,
  ProcessingSmeltingPayload,
  ProcessingSmithingPayload,
  CraftingSourceInteractPayload,
  ProcessingRecipePayload,
  FletchingSourceInteractPayload,
  ProcessingTanningPayload,
  RunecraftingAltarPayload,
} from "../types";

/**
 * Context passed to processing handlers so they can access shared server state
 * without being coupled to the ServerNetwork class.
 */
export interface ProcessingHandlerContext {
  world: World;
  pendingGatherManager: PendingGatherManager;
  pendingCookManager: PendingCookManager;
  tileMovementManager: TileMovementManager;
  tickSystem: TickSystem;
  canProcessRequest: (playerId: string) => boolean;
}

// ============================================================================
// Resource Interaction (PendingGatherManager path)
// ============================================================================

/**
 * SERVER-AUTHORITATIVE: Resource interaction - uses PendingGatherManager.
 * Same approach as combat: movePlayerToward() with meleeRange=1.
 */
export function handleResourceInteract(
  socket: ServerSocket,
  data: unknown,
  ctx: ProcessingHandlerContext,
): void {
  const player = socket.player;
  if (!player) return;

  const payload = data as ResourceInteractPayload;
  if (!payload.resourceId) return;

  ctx.pendingGatherManager.queuePendingGather(
    player.id,
    payload.resourceId,
    ctx.tickSystem.getCurrentTick(),
    payload.runMode,
  );
}

// ============================================================================
// Cooking Source Interaction (PendingCookManager path)
// ============================================================================

/**
 * SERVER-AUTHORITATIVE: Cooking source interaction - uses PendingCookManager.
 * Same approach as resource gathering: movePlayerToward() with meleeRange=1.
 */
export function handleCookingSourceInteract(
  socket: ServerSocket,
  data: unknown,
  ctx: ProcessingHandlerContext,
): void {
  const player = socket.player;
  if (!player) return;

  const payload = data as CookingSourceInteractPayload;
  if (!payload.sourceId || !payload.position) return;

  ctx.pendingCookManager.queuePendingCook(
    player.id,
    payload.sourceId,
    {
      x: payload.position[0],
      y: payload.position[1],
      z: payload.position[2],
    },
    ctx.tickSystem.getCurrentTick(),
    payload.runMode,
  );
}

// ============================================================================
// Firemaking
// ============================================================================

/**
 * Firemaking - use tinderbox on logs to create fire.
 * Validates slot bounds and emits PROCESSING_FIREMAKING_REQUEST.
 */
export function handleFiremakingRequest(
  socket: ServerSocket,
  data: unknown,
  ctx: ProcessingHandlerContext,
): void {
  const player = socket.player;
  if (!player) return;

  if (!ctx.canProcessRequest(player.id)) return;

  const payload = data as FiremakingRequestPayload;

  if (
    !payload.logsId ||
    payload.logsSlot === undefined ||
    payload.tinderboxSlot === undefined
  ) {
    console.log("[ServerNetwork] Invalid firemaking request:", payload);
    return;
  }

  // Validate inventory slot bounds (OSRS inventory is 28 slots: 0-27)
  if (
    payload.logsSlot < 0 ||
    payload.logsSlot > 27 ||
    payload.tinderboxSlot < 0 ||
    payload.tinderboxSlot > 27
  ) {
    console.warn(
      `[ServerNetwork] Invalid slot bounds in firemaking request from ${player.id}`,
    );
    return;
  }

  // Stop player movement before lighting fire (OSRS: player stands still to light)
  ctx.tileMovementManager.stopPlayer(player.id);

  ctx.world.emit(EventType.PROCESSING_FIREMAKING_REQUEST, {
    playerId: player.id,
    logsId: payload.logsId,
    logsSlot: payload.logsSlot,
    tinderboxSlot: payload.tinderboxSlot,
  });
}

// ============================================================================
// Cooking
// ============================================================================

/**
 * Cooking - use raw food on fire/range.
 * Routes through PendingCookManager for distance checking.
 */
export function handleCookingRequest(
  socket: ServerSocket,
  data: unknown,
  ctx: ProcessingHandlerContext,
): void {
  const player = socket.player;
  if (!player) return;

  if (!ctx.canProcessRequest(player.id)) return;

  const payload = data as CookingRequestPayload;

  if (
    !payload.rawFoodId ||
    payload.rawFoodSlot === undefined ||
    !payload.fireId
  ) {
    console.log("[ServerNetwork] Invalid cooking request:", payload);
    return;
  }

  // Validate inventory slot bounds (-1 is allowed = "find first cookable item")
  if (payload.rawFoodSlot < -1 || payload.rawFoodSlot > 27) {
    console.warn(
      `[ServerNetwork] Invalid slot bounds in cooking request from ${player.id}`,
    );
    return;
  }

  console.log(
    "[ServerNetwork] Cooking request from",
    player.id,
    "- routing through PendingCookManager for distance check",
  );

  ctx.pendingCookManager.queuePendingCook(
    player.id,
    payload.fireId,
    { x: 0, y: 0, z: 0 }, // Position ignored - server looks up from ProcessingSystem
    ctx.tickSystem.getCurrentTick(),
    undefined, // runMode - use server default
    payload.rawFoodSlot, // Pass specific slot to cook
  );
}

// ============================================================================
// Smelting
// ============================================================================

/**
 * Smelting - player clicked furnace.
 * Emits SMELTING_INTERACT event for SmeltingSystem.
 */
export function handleSmeltingSourceInteract(
  socket: ServerSocket,
  data: unknown,
  ctx: ProcessingHandlerContext,
): void {
  const player = socket.player;
  if (!player) return;

  const payload = data as SmeltingSourceInteractPayload;
  if (!payload.furnaceId || !payload.position) return;

  ctx.world.emit(EventType.SMELTING_INTERACT, {
    playerId: player.id,
    furnaceId: payload.furnaceId,
    position: {
      x: payload.position[0],
      y: payload.position[1],
      z: payload.position[2],
    },
  });
}

/**
 * Processing smelting - player selected bar to smelt from UI.
 * Validates input and emits PROCESSING_SMELTING_REQUEST.
 */
export function handleProcessingSmelting(
  socket: ServerSocket,
  data: unknown,
  ctx: ProcessingHandlerContext,
): void {
  const player = socket.player;
  if (!player) return;

  if (!ctx.canProcessRequest(player.id)) return;

  const payload = data as ProcessingSmeltingPayload;

  if (
    typeof payload.barItemId !== "string" ||
    typeof payload.furnaceId !== "string"
  ) {
    return;
  }

  if (payload.barItemId.length > 64 || payload.furnaceId.length > 64) {
    return;
  }

  const quantity =
    typeof payload.quantity === "number" && Number.isFinite(payload.quantity)
      ? Math.floor(Math.max(1, Math.min(payload.quantity, 10000)))
      : 1;

  ctx.world.emit(EventType.PROCESSING_SMELTING_REQUEST, {
    playerId: player.id,
    barItemId: payload.barItemId,
    furnaceId: payload.furnaceId,
    quantity,
  });
}

// ============================================================================
// Smithing
// ============================================================================

/**
 * Smithing - player clicked anvil.
 * Emits SMITHING_INTERACT event for SmithingSystem.
 */
export function handleSmithingSourceInteract(
  socket: ServerSocket,
  data: unknown,
  ctx: ProcessingHandlerContext,
): void {
  const player = socket.player;
  if (!player) return;

  const payload = data as SmithingSourceInteractPayload;
  if (!payload.anvilId || !payload.position) return;

  ctx.world.emit(EventType.SMITHING_INTERACT, {
    playerId: player.id,
    anvilId: payload.anvilId,
    position: {
      x: payload.position[0],
      y: payload.position[1],
      z: payload.position[2],
    },
  });
}

/**
 * Processing smithing - player selected item to smith from UI.
 * Validates input and emits PROCESSING_SMITHING_REQUEST.
 */
export function handleProcessingSmithing(
  socket: ServerSocket,
  data: unknown,
  ctx: ProcessingHandlerContext,
): void {
  const player = socket.player;
  if (!player) return;

  if (!ctx.canProcessRequest(player.id)) return;

  const payload = data as ProcessingSmithingPayload;

  if (
    typeof payload.recipeId !== "string" ||
    typeof payload.anvilId !== "string"
  ) {
    return;
  }

  if (payload.recipeId.length > 64 || payload.anvilId.length > 64) {
    return;
  }

  const quantity =
    typeof payload.quantity === "number" && Number.isFinite(payload.quantity)
      ? Math.floor(Math.max(1, Math.min(payload.quantity, 10000)))
      : 1;

  ctx.world.emit(EventType.PROCESSING_SMITHING_REQUEST, {
    playerId: player.id,
    recipeId: payload.recipeId,
    anvilId: payload.anvilId,
    quantity,
  });
}

// ============================================================================
// Crafting
// ============================================================================

/**
 * Crafting - player initiated crafting (needle, chisel, or furnace jewelry).
 * Validates trigger type and emits CRAFTING_INTERACT.
 */
export function handleCraftingSourceInteract(
  socket: ServerSocket,
  data: unknown,
  ctx: ProcessingHandlerContext,
): void {
  const player = socket.player;
  if (!player) return;

  if (!ctx.canProcessRequest(player.id)) return;

  const payload = data as CraftingSourceInteractPayload;
  if (!payload.triggerType) return;

  const validTriggerTypes = ["needle", "chisel", "furnace"] as const;
  type CraftingTriggerType = (typeof validTriggerTypes)[number];
  if (!validTriggerTypes.includes(payload.triggerType as CraftingTriggerType)) {
    return;
  }
  const triggerType = payload.triggerType as CraftingTriggerType;

  if (
    payload.inputItemId !== undefined &&
    (typeof payload.inputItemId !== "string" || payload.inputItemId.length > 64)
  ) {
    return;
  }

  ctx.world.emit(EventType.CRAFTING_INTERACT, {
    playerId: player.id,
    triggerType,
    stationId: payload.stationId,
    inputItemId: payload.inputItemId,
  });
}

/**
 * Processing crafting - player selected item to craft from UI.
 * Validates input and emits PROCESSING_CRAFTING_REQUEST.
 */
export function handleProcessingCrafting(
  socket: ServerSocket,
  data: unknown,
  ctx: ProcessingHandlerContext,
): void {
  const player = socket.player;
  if (!player) return;

  if (!ctx.canProcessRequest(player.id)) return;

  const payload = data as ProcessingRecipePayload;

  if (typeof payload.recipeId !== "string") {
    return;
  }

  if (payload.recipeId.length > 64) {
    return;
  }

  // Quantity validation (-1 = "All", server computes actual max)
  let quantity = 1;
  if (
    typeof payload.quantity === "number" &&
    Number.isFinite(payload.quantity)
  ) {
    quantity =
      payload.quantity === -1
        ? 10000
        : Math.floor(Math.max(1, Math.min(payload.quantity, 10000)));
  }

  ctx.world.emit(EventType.PROCESSING_CRAFTING_REQUEST, {
    playerId: player.id,
    recipeId: payload.recipeId,
    quantity,
  });
}

// ============================================================================
// Fletching
// ============================================================================

/**
 * Fletching source interaction - player used knife on logs or item-on-item.
 * Validates trigger type and emits FLETCHING_INTERACT.
 */
export function handleFletchingSourceInteract(
  socket: ServerSocket,
  data: unknown,
  ctx: ProcessingHandlerContext,
): void {
  const player = socket.player;
  if (!player) return;

  if (!ctx.canProcessRequest(player.id)) return;

  const payload = data as FletchingSourceInteractPayload;
  if (!payload.triggerType) return;

  const validFletchingTriggers = ["knife", "item_on_item"] as const;
  type FletchingTriggerType = (typeof validFletchingTriggers)[number];
  if (
    !validFletchingTriggers.includes(
      payload.triggerType as FletchingTriggerType,
    )
  ) {
    return;
  }
  const triggerType = payload.triggerType as FletchingTriggerType;

  if (
    typeof payload.inputItemId !== "string" ||
    payload.inputItemId.length > 64
  ) {
    return;
  }

  if (
    payload.secondaryItemId !== undefined &&
    (typeof payload.secondaryItemId !== "string" ||
      payload.secondaryItemId.length > 64)
  ) {
    return;
  }

  ctx.world.emit(EventType.FLETCHING_INTERACT, {
    playerId: player.id,
    triggerType,
    inputItemId: payload.inputItemId,
    secondaryItemId: payload.secondaryItemId,
  });
}

/**
 * Processing fletching - player selected recipe to fletch from UI.
 * Validates input and emits PROCESSING_FLETCHING_REQUEST.
 */
export function handleProcessingFletching(
  socket: ServerSocket,
  data: unknown,
  ctx: ProcessingHandlerContext,
): void {
  const player = socket.player;
  if (!player) return;

  if (!ctx.canProcessRequest(player.id)) return;

  const payload = data as ProcessingRecipePayload;

  if (typeof payload.recipeId !== "string") {
    return;
  }

  if (payload.recipeId.length > 64) {
    return;
  }

  // Quantity validation (-1 = "All", server computes actual max)
  let quantity = 1;
  if (
    typeof payload.quantity === "number" &&
    Number.isFinite(payload.quantity)
  ) {
    quantity =
      payload.quantity === -1
        ? 10000
        : Math.floor(Math.max(1, Math.min(payload.quantity, 10000)));
  }

  ctx.world.emit(EventType.PROCESSING_FLETCHING_REQUEST, {
    playerId: player.id,
    recipeId: payload.recipeId,
    quantity,
  });
}

// ============================================================================
// Tanning
// ============================================================================

/**
 * Tanning - player selected hide to tan from UI.
 * Validates input and emits TANNING_REQUEST.
 */
export function handleProcessingTanning(
  socket: ServerSocket,
  data: unknown,
  ctx: ProcessingHandlerContext,
): void {
  const player = socket.player;
  if (!player) return;

  if (!ctx.canProcessRequest(player.id)) return;

  const payload = data as ProcessingTanningPayload;

  if (typeof payload.inputItemId !== "string") {
    return;
  }

  if (payload.inputItemId.length > 64) {
    return;
  }

  // Quantity validation (-1 = "All", server computes actual max)
  let quantity = 1;
  if (
    typeof payload.quantity === "number" &&
    Number.isFinite(payload.quantity)
  ) {
    quantity =
      payload.quantity === -1
        ? 10000
        : Math.floor(Math.max(1, Math.min(payload.quantity, 10000)));
  }

  ctx.world.emit(EventType.TANNING_REQUEST, {
    playerId: player.id,
    inputItemId: payload.inputItemId,
    quantity,
  });
}

// ============================================================================
// Runecrafting
// ============================================================================

/**
 * Runecrafting - player clicked runecrafting altar.
 * Validates altarId, looks up runeType, and emits RUNECRAFTING_INTERACT.
 */
export function handleRunecraftingAltarInteract(
  socket: ServerSocket,
  data: unknown,
  ctx: ProcessingHandlerContext,
): void {
  const player = socket.player;
  if (!player) return;

  if (!ctx.canProcessRequest(player.id)) return;

  const payload = data as RunecraftingAltarPayload;

  if (typeof payload.altarId !== "string" || payload.altarId.length > 64) {
    return;
  }

  // Look up the altar entity to get the authoritative runeType
  const altarEntity = ctx.world.entities.get(payload.altarId);
  if (!altarEntity) return;

  const runeType = (altarEntity as unknown as { runeType?: string }).runeType;
  if (!runeType) return;

  ctx.world.emit(EventType.RUNECRAFTING_INTERACT, {
    playerId: player.id,
    altarId: payload.altarId,
    runeType,
  });
}
