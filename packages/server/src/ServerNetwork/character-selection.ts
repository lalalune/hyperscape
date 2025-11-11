/**
 * Character Selection Module
 *
 * Handles character management for players:
 * - Loading character lists for accounts
 * - Creating new characters
 * - Selecting characters for gameplay
 * - Spawning characters into the world
 *
 * This module extracts character selection logic from ServerNetwork
 * to improve maintainability and separation of concerns.
 */

import type {
  ServerSocket,
  SpawnData,
  DatabaseSystemOperations,
} from "../types";
import {
  EventType,
  uuid,
  getItem,
  TerrainSystem,
  Entity,
  World,
} from "@hyperscape/shared";

const HEALTH_MAX = 100;

interface CharacterData {
  id: string;
  name: string;
  level?: number;
  lastLocation?: { x: number; y: number; z: number };
}

/**
 * Load character list for an account
 */
export async function loadCharacterList(
  accountId: string,
  world: World,
): Promise<CharacterData[]> {
  try {
    const databaseSystem = world.getSystem("database") as
      | import("../DatabaseSystem").DatabaseSystem
      | undefined;
    if (!databaseSystem) return [];
    const chars = await databaseSystem.getCharactersAsync(accountId);
    return chars.map((c) => ({ id: c.id, name: c.name }));
  } catch {
    return [];
  }
}

/**
 * Handle character list request from client
 */
export async function handleCharacterListRequest(
  socket: ServerSocket,
  world: World,
): Promise<void> {
  const accountId = socket.accountId;
  if (!accountId) {
    console.warn(
      "[CharacterSelection] characterListRequest received but socket has no accountId",
    );
    socket.send("characterList", { characters: [] });
    return;
  }
  try {
    const characters = await loadCharacterList(accountId, world);
    socket.send("characterList", { characters });
  } catch (err) {
    console.error("[CharacterSelection] Failed to load character list:", err);
    socket.send("characterList", { characters: [] });
  }
}

/**
 * Handle character creation request from client
 */
export async function handleCharacterCreate(
  socket: ServerSocket,
  data: unknown,
  world: World,
  sendToFn: (socketId: string, name: string, data: unknown) => void,
): Promise<void> {
  console.log(
    "[CharacterSelection] 🎭 handleCharacterCreate called with data:",
    data,
  );

  const payload = (data as { name?: string }) || {};
  const name = (payload.name || "").trim().slice(0, 20) || "Adventurer";

  console.log("[CharacterSelection] Raw name from payload:", payload.name);
  console.log("[CharacterSelection] Processed name:", name);

  // Basic validation: alphanumeric plus spaces, 3-20 chars
  const safeName = name.replace(/[^a-zA-Z0-9 ]/g, "").trim();
  const finalName = safeName.length >= 3 ? safeName : "Adventurer";

  console.log("[CharacterSelection] Final validated name:", finalName);

  const id = uuid();
  const accountId = socket.accountId || "";

  console.log("[CharacterSelection] Character creation params:", {
    characterId: id,
    accountId,
    finalName,
  });

  if (!accountId) {
    console.error(
      "[CharacterSelection] ❌ ERROR: No accountId on socket!",
      socket.id,
    );
    sendToFn(socket.id, "showToast", {
      message: "Authentication error - no account ID",
      type: "error",
    });
    return;
  }

  try {
    const databaseSystem = world.getSystem("database") as
      | import("../DatabaseSystem").DatabaseSystem
      | undefined;
    if (!databaseSystem) {
      console.error("[CharacterSelection] ❌ ERROR: DatabaseSystem not found!");
      sendToFn(socket.id, "showToast", {
        message: "Server error - database not available",
        type: "error",
      });
      return;
    }

    const result = await databaseSystem.createCharacter(
      accountId,
      id,
      finalName,
    );

    if (!result) {
      console.error(
        "[CharacterSelection] ❌ createCharacter returned false - character may already exist",
      );
      sendToFn(socket.id, "showToast", {
        message: "Character creation failed",
        type: "error",
      });
      return;
    }

    console.log(
      "[CharacterSelection] ✅ Character creation successful, sending response",
    );
  } catch (err) {
    console.error("[CharacterSelection] ❌ EXCEPTION in createCharacter:", err);
    sendToFn(socket.id, "showToast", {
      message: "Character creation error",
      type: "error",
    });
    return;
  }

  const responseData = { id, name: finalName };

  console.log(
    "[CharacterSelection] Sending characterCreated response:",
    responseData,
  );

  try {
    sendToFn(socket.id, "characterCreated", responseData);
  } catch (err) {
    console.error(
      "[CharacterSelection] ❌ ERROR sending characterCreated packet:",
      err,
    );
  }
}

/**
 * Handle character selection from client
 */
export function handleCharacterSelected(
  socket: ServerSocket,
  data: unknown,
  sendToFn: (socketId: string, name: string, data: unknown) => void,
): void {
  const payload = (data as { characterId?: string }) || {};
  // Store selection in socket for subsequent enterWorld
  socket.selectedCharacterId = payload.characterId || undefined;
  sendToFn(socket.id, "characterSelected", {
    characterId: payload.characterId || null,
  });
}

/**
 * Handle entering world with selected character
 */
export async function handleEnterWorld(
  socket: ServerSocket,
  data: unknown,
  world: World,
  spawn: SpawnData,
  sendFn: (name: string, data: unknown, ignoreSocketId?: string) => void,
  sendToFn: (socketId: string, name: string, data: unknown) => void,
): Promise<void> {
  console.log(
    "[CharacterSelection] 🚪 handleEnterWorld called with data:",
    data,
  );

  // Spawn the entity now, preserving legacy spawn shape
  if (socket.player) {
    console.log("[CharacterSelection] Player already spawned, skipping");
    return; // Already spawned
  }
  const accountId = socket.accountId || undefined;
  const payload = (data as { characterId?: string }) || {};
  const characterId = payload.characterId || null;

  console.log("[CharacterSelection] Enter world params:", {
    accountId,
    characterId,
    hasSocket: !!socket,
  });

  // Load character data from DB if characterId provided
  let name = "Adventurer";
  let characterData: { id: string; name: string } | null = null;
  if (characterId && accountId) {
    try {
      const databaseSystem = world.getSystem("database") as
        | import("../DatabaseSystem").DatabaseSystem
        | undefined;
      if (databaseSystem) {
        const characters = await databaseSystem.getCharactersAsync(accountId);
        console.log(
          "[CharacterSelection] Loaded characters for account:",
          characters,
        );
        characterData = characters.find((c) => c.id === characterId) || null;
        if (characterData) {
          name = characterData.name;
          console.log(
            "[CharacterSelection] ✅ Found character:",
            characterData,
          );
        } else {
          console.warn(
            `[CharacterSelection] ❌ Character ${characterId} not found for account ${accountId}`,
          );
        }
      }
    } catch (err) {
      console.error(
        "[CharacterSelection] ❌ Failed to load character data:",
        err,
      );
    }
  } else {
    console.warn(
      "[CharacterSelection] ⚠️ Missing characterId or accountId for enterWorld",
    );
  }

  console.log("[CharacterSelection] Will spawn player with name:", name);

  const avatar = undefined;
  const roles: string[] = [];

  // Require a characterId to ensure persistence uses stable IDs
  const entityId = characterId || socket.id;
  if (!characterId) {
    console.warn(
      `[CharacterSelection] No characterId provided to enterWorld, using socketId`,
    );
  }

  // Load saved position from character data if available
  let position = Array.isArray(spawn.position)
    ? ([...spawn.position] as [number, number, number])
    : [0, 50, 0];
  const quaternion = Array.isArray(spawn.quaternion)
    ? ([...spawn.quaternion] as [number, number, number, number])
    : [0, 0, 0, 1];

  // Load full character data from DB (position AND skills)
  let savedSkills: Record<string, { level: number; xp: number }> | undefined;
  if (characterId && accountId) {
    try {
      const databaseSystem = world.getSystem("database") as
        | import("../DatabaseSystem").DatabaseSystem
        | undefined;
      if (databaseSystem) {
        const savedData = await databaseSystem.getPlayerAsync(characterId);
        if (savedData) {
          // Load position
          if (savedData.positionX !== undefined) {
            const savedY =
              savedData.positionY !== undefined && savedData.positionY !== null
                ? Number(savedData.positionY)
                : 10;
            if (savedY >= 5 && savedY <= 200) {
              position = [
                Number(savedData.positionX) || 0,
                savedY,
                Number(savedData.positionZ) || 0,
              ];
            }
          }
          // Load skills
          savedSkills = {
            attack: { level: savedData.attackLevel, xp: savedData.attackXp },
            strength: {
              level: savedData.strengthLevel,
              xp: savedData.strengthXp,
            },
            defense: {
              level: savedData.defenseLevel,
              xp: savedData.defenseXp,
            },
            constitution: {
              level: savedData.constitutionLevel,
              xp: savedData.constitutionXp,
            },
            ranged: { level: savedData.rangedLevel, xp: savedData.rangedXp },
            woodcutting: {
              level: savedData.woodcuttingLevel || 1,
              xp: savedData.woodcuttingXp || 0,
            },
            fishing: {
              level: savedData.fishingLevel || 1,
              xp: savedData.fishingXp || 0,
            },
            firemaking: {
              level: savedData.firemakingLevel || 1,
              xp: savedData.firemakingXp || 0,
            },
            cooking: {
              level: savedData.cookingLevel || 1,
              xp: savedData.cookingXp || 0,
            },
          };
        }
      }
    } catch {}
  }

  // Ground to terrain
  const terrain = world.getSystem("terrain") as InstanceType<
    typeof TerrainSystem
  > | null;
  if (terrain && terrain.isReady && terrain.isReady()) {
    const th = terrain.getHeightAt(position[0], position[2]);
    if (Number.isFinite(th)) {
      position = [position[0], (th as number) + 0.1, position[2]];
    } else {
      position = [position[0], 10, position[2]];
    }
  } else {
    // Terrain not ready; use safe height
    position = [position[0], 10, position[2]];
  }
  const addedEntity = world.entities.add
    ? world.entities.add({
        id: entityId,
        type: "player",
        position,
        quaternion,
        owner: socket.id,
        userId: accountId || undefined,
        name,
        health: HEALTH_MAX,
        avatar: world.settings.avatar?.url || "asset://avatar.vrm",
        sessionAvatar: avatar || undefined,
        roles,
        // CRITICAL: Pass loaded skills so PlayerEntity constructor uses them instead of defaults
        skills: savedSkills,
      })
    : undefined;
  socket.player = (addedEntity as Entity) || undefined;
  if (socket.player) {
    world.emit(EventType.PLAYER_JOINED, {
      playerId: socket.player.data.id as string,
      player:
        socket.player as unknown as import("@hyperscape/shared").PlayerLocal,
    });
    try {
      // Send to everyone else
      sendFn("entityAdded", socket.player.serialize(), socket.id);
      // And also to the originating socket so their client receives their own entity
      sendToFn(socket.id, "entityAdded", socket.player.serialize());

      // CRITICAL: Send all existing entities (mobs, items, NPCs) to new client
      // These entities were spawned before this player connected
      if (world.entities?.items) {
        let entityCount = 0;
        for (const [entityId, entity] of world.entities.items.entries()) {
          // Skip the player we just added
          if (entityId !== socket.player.id) {
            sendToFn(socket.id, "entityAdded", entity.serialize());
            entityCount++;
          }
        }
        console.log(
          `[CharacterSelection] 📤 Sent ${entityCount} existing entities to new player ${socket.player.id}`,
        );
      }

      // Immediately reinforce authoritative transform to avoid initial client-side default pose
      sendToFn(socket.id, "entityModified", {
        id: socket.player.id,
        changes: {
          p: position,
          q: quaternion,
          v: [0, 0, 0],
          e: "idle",
        },
      });
      // Send initial skills to client immediately after spawn
      if (savedSkills) {
        sendToFn(socket.id, "skillsUpdated", {
          playerId: socket.player.id,
          skills: savedSkills,
        });
      }
      // Send inventory snapshot immediately from persistence to avoid races
      try {
        const dbSys = world.getSystem?.("database") as
          | DatabaseSystemOperations
          | undefined;
        const persistenceId = characterId || socket.player.id;
        const rows = dbSys?.getPlayerInventoryAsync
          ? await dbSys.getPlayerInventoryAsync(persistenceId)
          : [];
        const coinsRow = dbSys?.getPlayerAsync
          ? await dbSys.getPlayerAsync(persistenceId)
          : null;
        const sorted = rows
          .map((r) => ({
            rawSlot:
              Number.isFinite(r.slotIndex) && (r.slotIndex as number) >= 0
                ? (r.slotIndex as number)
                : Number.MAX_SAFE_INTEGER,
            itemId: String(r.itemId),
            quantity: r.quantity || 1,
          }))
          .sort((a, b) => a.rawSlot - b.rawSlot);
        const items = sorted.map((r, index) => {
          const def = getItem(r.itemId);
          return {
            slot: Math.min(index, 27),
            itemId: r.itemId,
            quantity: r.quantity,
            item: def
              ? {
                  id: def.id,
                  name: def.name,
                  type: def.type,
                  stackable: !!def.stackable,
                  weight: def.weight || 0,
                }
              : {
                  id: r.itemId,
                  name: r.itemId,
                  type: "misc",
                  stackable: false,
                  weight: 0,
                },
          };
        });
        sendToFn(socket.id, "inventoryUpdated", {
          playerId: socket.player.id,
          items,
          coins: coinsRow?.coins ?? 0,
          maxSlots: 28,
        });
      } catch {}
    } catch (_err) {}
  }
}
