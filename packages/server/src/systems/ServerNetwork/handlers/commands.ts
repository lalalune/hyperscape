/**
 * Commands Handler
 *
 * Handles slash commands from clients
 */

import moment from "moment";
import type {
  ServerSocket,
  SystemDatabase,
  ServerStats,
} from "../../../shared/types";
import {
  uuid,
  hasRole,
  addRole,
  removeRole,
  serializeRoles,
  hasModPermission,
  hasAdminPermission,
  isProtectedFromModAction,
  TerrainSystem,
  World,
  writePacket,
} from "@hyperscape/shared";
import { getDatabase } from "./common";

// Type definitions for database query results
type UserRow = {
  id: string;
  name: string;
  roles?: string;
};

type BanRow = {
  id?: number;
  bannedUserId: string;
  bannedByUserId: string;
  reason?: string;
  expiresAt?: number | null;
  createdAt?: string;
  active?: number;
};

export async function handleCommand(
  socket: ServerSocket,
  data: unknown,
  world: World,
  db: SystemDatabase,
  sendFn: (name: string, data: unknown, ignoreSocketId?: string) => void,
  isBuilder: (player: { data?: { roles?: string[] } }) => boolean,
  sockets?: Map<string, ServerSocket>,
): Promise<void> {
  const args = data as string[];
  const player = socket.player;
  if (!player) return;
  const [cmd, arg1] = args;

  // become admin command
  if (cmd === "admin") {
    const code = arg1;
    if (process.env.ADMIN_CODE && process.env.ADMIN_CODE === code) {
      const id = player.data.id;
      const userId = player.data.userId;
      const roles: string[] = Array.isArray(player.data.roles)
        ? player.data.roles
        : [];
      const granting = !hasRole(roles, "admin");
      if (granting) {
        addRole(roles, "admin");
      } else {
        removeRole(roles, "admin");
      }
      player.modify({ roles });
      sendFn("entityModified", { id, changes: { roles } });
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: granting ? "Admin granted!" : "Admin revoked!",
        createdAt: moment().toISOString(),
      });
      if (userId) {
        const rolesString = serializeRoles(roles);
        await db("users").where("id", userId).update({ roles: rolesString });
      }
    }
  }

  if (cmd === "name") {
    const name = arg1;
    if (name) {
      const id = player.data.id;
      const userId = player.data.userId;
      player.data.name = name;
      player.modify({ name });
      sendFn("entityModified", { id, changes: { name } });
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: `Name set to ${name}!`,
        createdAt: moment().toISOString(),
      });
      if (userId) {
        await db("users").where("id", userId).update({ name });
      }
    }
  }

  // Server-driven movement: move this socket's player entity randomly and broadcast
  if (cmd === "move") {
    const mode = arg1 || "random";
    if (!player) return;
    const entity = player;
    const curr = entity.position;
    let nx = curr.x;
    const _ny = curr.y;
    let nz = curr.z;
    if (mode === "random") {
      // Ensure movement is at least 1.5 units to pass test assertions
      const minRadius = 1.5;
      const maxRadius = 3;
      const angle = Math.random() * Math.PI * 2;
      const radius = minRadius + Math.random() * (maxRadius - minRadius);
      const dx = Math.cos(angle) * radius;
      const dz = Math.sin(angle) * radius;
      nx = curr.x + dx;
      nz = curr.z + dz;
    } else if (mode === "to" && args.length >= 4) {
      // move to specified coordinates: /move to x y z
      const x = parseFloat(args[2]);
      const y = parseFloat(args[3]);
      const z = parseFloat(args[4]);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        nx = x;
        const _ny = y;
        nz = z;
      }
    }
    // Apply on server entity
    // Clamp Y to terrain height on all server-side position sets via command
    const terrain = world.getSystem("terrain") as InstanceType<
      typeof TerrainSystem
    > | null;
    if (!terrain) {
      throw new Error("[Commands] Terrain system not available for chat move");
    }
    const th = terrain.getHeightAt(nx, nz);
    if (!Number.isFinite(th)) {
      throw new Error(
        `[Commands] Invalid terrain height for chat move at x=${nx}, z=${nz}`,
      );
    }
    const gy = th + 0.1;
    entity.position.set(nx, gy, nz);
    // Broadcast to all clients, including the origin, using normalized shape
    sendFn("entityModified", {
      id: entity.id,
      changes: { p: [nx, gy, nz] },
    });
  }

  // Teleport command: /teleport x y z - sends proper playerTeleport packet
  // Used by dev tools to teleport player with proper tile movement reset
  // PERMISSION: Requires mod or admin role
  console.log("[Commands] Received command:", cmd, "args:", args);
  if (cmd === "teleport" && args.length >= 4) {
    console.log("[Commands] Processing teleport command");

    // Check permission - only mods and admins can teleport
    const playerRoles: string[] = Array.isArray(player.data.roles)
      ? player.data.roles
      : [];
    if (!hasModPermission(playerRoles)) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: "You don't have permission to use /teleport. Only mods and admins can use this command.",
        createdAt: moment().toISOString(),
      });
      return;
    }

    const x = parseFloat(args[1]);
    const y = parseFloat(args[2]);
    const z = parseFloat(args[3]);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      // Get terrain height at target position
      const terrain = world.getSystem("terrain") as InstanceType<
        typeof TerrainSystem
      > | null;
      if (!terrain) {
        console.warn("[Commands] Terrain system not available for teleport");
        return;
      }
      const th = terrain.getHeightAt(x, z);
      if (!Number.isFinite(th)) {
        console.warn(
          `[Commands] Invalid terrain height for teleport at x=${x}, z=${z}`,
        );
        return;
      }
      const groundedY = th + 0.1;

      // Update server-side entity position
      player.position.set(x, groundedY, z);
      if (Array.isArray(player.data.position)) {
        player.data.position[0] = x;
        player.data.position[1] = groundedY;
        player.data.position[2] = z;
      }

      // Send playerTeleport packet to the client (resets tile movement properly)
      socket.send("playerTeleport", {
        playerId: player.id,
        position: [x, groundedY, z],
      });

      // Broadcast position update to other clients
      sendFn(
        "entityModified",
        { id: player.id, changes: { p: [x, groundedY, z] } },
        socket.id,
      );
    }
  }

  // ============================================================================
  // MOD MANAGEMENT COMMANDS (Admin only)
  // ============================================================================

  // /mod <username> - Grant mod role to a user (admin only)
  if (cmd === "mod" && arg1) {
    const adminRoles: string[] = Array.isArray(player.data.roles)
      ? player.data.roles
      : [];
    if (!hasAdminPermission(adminRoles)) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: "You don't have permission to use /mod. Only admins can manage moderators.",
        createdAt: moment().toISOString(),
      });
      return;
    }

    const targetName = arg1.toLowerCase();

    // Find the target user by name (case-insensitive)
    const targetUser = (await db("users")
      .whereRaw("LOWER(name) = ?", [targetName])
      .first()) as UserRow | undefined;

    if (!targetUser) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: `User "${arg1}" not found.`,
        createdAt: moment().toISOString(),
      });
      return;
    }

    // Parse existing roles
    const targetUserData = targetUser as {
      id: string;
      name: string;
      roles?: string;
    };
    const targetRoles: string[] = targetUserData.roles
      ? targetUserData.roles.split(",").filter((r: string) => r.trim())
      : [];

    // Check if already a mod
    if (hasRole(targetRoles, "mod")) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: `${targetUserData.name} is already a moderator.`,
        createdAt: moment().toISOString(),
      });
      return;
    }

    // Add mod role
    addRole(targetRoles, "mod");
    const newRolesString = serializeRoles(targetRoles);

    // Update database
    await db("users")
      .where("id", targetUserData.id)
      .update({ roles: newRolesString });

    // If target is online, update their entity
    for (const entity of world.entities.values()) {
      if (
        entity.data?.userId === targetUserData.id &&
        entity.data?.type === "player"
      ) {
        const entityRoles = Array.isArray(entity.data.roles)
          ? entity.data.roles
          : [];
        addRole(entityRoles, "mod");
        entity.modify({ roles: entityRoles });
        sendFn("entityModified", {
          id: entity.id,
          changes: { roles: entityRoles },
        });
        break;
      }
    }

    socket.send("chatAdded", {
      id: uuid(),
      from: null,
      fromId: null,
      body: `${targetUserData.name} is now a moderator.`,
      createdAt: moment().toISOString(),
    });
    console.log(
      `[Commands] Admin ${player.data.name} granted mod to ${targetUserData.name}`,
    );
  }

  // /demod <username> - Remove mod role from a user (admin only)
  if (cmd === "demod" && arg1) {
    const adminRoles: string[] = Array.isArray(player.data.roles)
      ? player.data.roles
      : [];
    if (!hasAdminPermission(adminRoles)) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: "You don't have permission to use /demod. Only admins can manage moderators.",
        createdAt: moment().toISOString(),
      });
      return;
    }

    const targetName = arg1.toLowerCase();

    // Find the target user by name (case-insensitive)
    const targetUser = (await db("users")
      .whereRaw("LOWER(name) = ?", [targetName])
      .first()) as UserRow | undefined;

    if (!targetUser) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: `User "${arg1}" not found.`,
        createdAt: moment().toISOString(),
      });
      return;
    }

    // Parse existing roles
    const demodUserData = targetUser as {
      id: string;
      name: string;
      roles?: string;
    };
    const targetRoles: string[] = demodUserData.roles
      ? demodUserData.roles.split(",").filter((r: string) => r.trim())
      : [];

    // Check if not a mod
    if (!hasRole(targetRoles, "mod")) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: `${demodUserData.name} is not a moderator.`,
        createdAt: moment().toISOString(),
      });
      return;
    }

    // Remove mod role
    removeRole(targetRoles, "mod");
    const newRolesString = serializeRoles(targetRoles);

    // Update database
    await db("users")
      .where("id", demodUserData.id)
      .update({ roles: newRolesString });

    // If target is online, update their entity
    for (const entity of world.entities.values()) {
      if (
        entity.data?.userId === demodUserData.id &&
        entity.data?.type === "player"
      ) {
        const entityRoles = Array.isArray(entity.data.roles)
          ? entity.data.roles
          : [];
        removeRole(entityRoles, "mod");
        entity.modify({ roles: entityRoles });
        sendFn("entityModified", {
          id: entity.id,
          changes: { roles: entityRoles },
        });
        break;
      }
    }

    socket.send("chatAdded", {
      id: uuid(),
      from: null,
      fromId: null,
      body: `${demodUserData.name} is no longer a moderator.`,
      createdAt: moment().toISOString(),
    });
    console.log(
      `[Commands] Admin ${player.data.name} removed mod from ${demodUserData.name}`,
    );
  }

  // /listmods - List all moderators and admins (admin only)
  if (cmd === "listmods") {
    const adminRoles: string[] = Array.isArray(player.data.roles)
      ? player.data.roles
      : [];
    if (!hasAdminPermission(adminRoles)) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: "You don't have permission to use /listmods. Only admins can view the moderator list.",
        createdAt: moment().toISOString(),
      });
      return;
    }

    // Query all users with mod or admin roles
    const allUsers = (await db("users").select(["name", "roles"])) as UserRow[];
    const mods: string[] = [];
    const admins: string[] = [];

    for (const user of allUsers) {
      const roles: string[] = user.roles
        ? user.roles.split(",").filter((r: string) => r.trim())
        : [];
      if (hasRole(roles, "admin")) {
        admins.push(user.name);
      } else if (hasRole(roles, "mod")) {
        mods.push(user.name);
      }
    }

    // Build response message
    let message = "=== Staff List ===\n";
    message += `Admins (${admins.length}): ${admins.length > 0 ? admins.join(", ") : "None"}\n`;
    message += `Mods (${mods.length}): ${mods.length > 0 ? mods.join(", ") : "None"}`;

    socket.send("chatAdded", {
      id: uuid(),
      from: null,
      fromId: null,
      body: message,
      createdAt: moment().toISOString(),
    });
  }

  if (cmd === "chat") {
    const op = arg1;
    if (op === "clear" && socket.player && isBuilder(socket.player)) {
      // Clear chat if method exists
      if (world.chat.clear) {
        world.chat.clear(true);
      }
    }
  }

  if (cmd === "server") {
    const op = arg1;
    if (op === "stats") {
      const send = (body: string) => {
        socket.send("chatAdded", {
          id: uuid(),
          from: null,
          fromId: null,
          body,
          createdAt: moment().toISOString(),
        });
      };
      // Get server stats if monitor exists
      const statsResult = world.monitor?.getStats?.();
      const stats =
        statsResult && "then" in statsResult
          ? await statsResult
          : ((statsResult || {
              currentCPU: 0,
              currentMemory: 0,
              maxMemory: 0,
            }) as ServerStats);
      send(`CPU: ${stats.currentCPU.toFixed(3)}%`);
      send(`Memory: ${stats.currentMemory}MB / ${stats.maxMemory}MB`);
    }
  }

  // ============================================================================
  // MODERATION COMMANDS (Mod+ only)
  // ============================================================================

  // /kick <username> [reason] - Kick a player (mod+ only, cannot kick mods/admins)
  if (cmd === "kick" && arg1) {
    const modRoles: string[] = Array.isArray(player.data.roles)
      ? player.data.roles
      : [];
    if (!hasModPermission(modRoles)) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: "You don't have permission to use /kick. Only mods and admins can use this command.",
        createdAt: moment().toISOString(),
      });
      return;
    }

    const targetName = arg1.toLowerCase();
    const reason = args.slice(2).join(" ") || "No reason specified";

    // Find the target user by name (case-insensitive)
    const targetUser = (await db("users")
      .whereRaw("LOWER(name) = ?", [targetName])
      .first()) as UserRow | undefined;

    if (!targetUser) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: `User "${arg1}" not found.`,
        createdAt: moment().toISOString(),
      });
      return;
    }

    // Parse target's roles and check if they're protected
    const targetRoles: string[] = targetUser.roles
      ? targetUser.roles.split(",").filter((r: string) => r.trim())
      : [];

    const protection = isProtectedFromModAction(targetRoles, modRoles);
    if (protection.protected) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: protection.reason || "Cannot kick this user.",
        createdAt: moment().toISOString(),
      });
      return;
    }

    // Find the target's socket and kick them
    let kicked = false;
    if (sockets) {
      for (const [_socketId, targetSocket] of sockets) {
        if (targetSocket.accountId === targetUser.id) {
          // Send kick packet with reason before closing
          const kickPacket = writePacket(
            "kick",
            `Kicked by ${player.data.name}: ${reason}`,
          );
          targetSocket.ws?.send?.(kickPacket);

          // Close the WebSocket - this will trigger handleDisconnect which:
          // 1. Removes socket from tracking
          // 2. Emits PLAYER_LEFT event
          // 3. Removes player entity from world
          // 4. Broadcasts entityRemoved to all clients
          // DO NOT manually delete from sockets - let handleDisconnect do it
          targetSocket.ws?.close?.(4002, "Kicked by moderator");

          kicked = true;
          console.log(
            `[Commands] Mod ${player.data.name} kicked ${targetUser.name}. Reason: ${reason}`,
          );
          break;
        }
      }
    }

    if (kicked) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: `${targetUser.name} has been kicked. Reason: ${reason}`,
        createdAt: moment().toISOString(),
      });
    } else {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: `${targetUser.name} is not currently online.`,
        createdAt: moment().toISOString(),
      });
    }
  }

  // /ban <username> [duration] [reason] - Ban a user (mod+ only, cannot ban mods/admins)
  // Duration format: 1h, 2d, 1w, perm (default: permanent)
  if (cmd === "ban" && arg1) {
    const modRoles: string[] = Array.isArray(player.data.roles)
      ? player.data.roles
      : [];
    if (!hasModPermission(modRoles)) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: "You don't have permission to use /ban. Only mods and admins can use this command.",
        createdAt: moment().toISOString(),
      });
      return;
    }

    const targetName = arg1.toLowerCase();

    // Parse duration (optional second argument)
    let expiresAt: number | null = null;
    let reasonStartIndex = 2;
    const durationArg = args[2]?.toLowerCase();

    if (durationArg) {
      const durationMatch = durationArg.match(/^(\d+)([hdwm])$/);
      if (durationMatch) {
        const amount = parseInt(durationMatch[1], 10);
        const unit = durationMatch[2];
        const now = Date.now();

        switch (unit) {
          case "h":
            expiresAt = now + amount * 60 * 60 * 1000;
            break;
          case "d":
            expiresAt = now + amount * 24 * 60 * 60 * 1000;
            break;
          case "w":
            expiresAt = now + amount * 7 * 24 * 60 * 60 * 1000;
            break;
          case "m":
            expiresAt = now + amount * 30 * 24 * 60 * 60 * 1000;
            break;
        }
        reasonStartIndex = 3;
      } else if (durationArg === "perm" || durationArg === "permanent") {
        expiresAt = null; // Permanent
        reasonStartIndex = 3;
      }
    }

    const reason =
      args.slice(reasonStartIndex).join(" ") || "No reason specified";

    // Find the target user by name (case-insensitive)
    const targetUser = (await db("users")
      .whereRaw("LOWER(name) = ?", [targetName])
      .first()) as UserRow | undefined;

    if (!targetUser) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: `User "${arg1}" not found.`,
        createdAt: moment().toISOString(),
      });
      return;
    }

    // Parse target's roles and check if they're protected
    const targetRoles: string[] = targetUser.roles
      ? targetUser.roles.split(",").filter((r: string) => r.trim())
      : [];

    const protection = isProtectedFromModAction(targetRoles, modRoles);
    if (protection.protected) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: protection.reason || "Cannot ban this user.",
        createdAt: moment().toISOString(),
      });
      return;
    }

    // Check if already banned (must check expiration too)
    const now = Date.now();
    const existingBan = (await db("user_bans")
      .where("bannedUserId", targetUser.id)
      .where("active", 1)
      .where(function (this: ReturnType<SystemDatabase>) {
        this.whereNull("expiresAt").orWhere("expiresAt", ">", now);
      })
      .first()) as BanRow | undefined;

    if (existingBan) {
      const expiresText = existingBan.expiresAt
        ? `until ${new Date(existingBan.expiresAt).toLocaleString()}`
        : "permanently";
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: `${targetUser.name} is already banned ${expiresText}.`,
        createdAt: moment().toISOString(),
      });
      return;
    }

    // Create ban record
    await db("user_bans").insert({
      bannedUserId: targetUser.id,
      bannedByUserId: player.data.userId,
      reason,
      expiresAt,
      active: 1,
    });

    // Kick the user if they're online
    if (sockets) {
      for (const [_socketId, targetSocket] of sockets) {
        if (targetSocket.accountId === targetUser.id) {
          const durationText = expiresAt
            ? `until ${new Date(expiresAt).toLocaleString()}`
            : "permanently";
          const kickPacket = writePacket(
            "kick",
            `Banned ${durationText} by ${player.data.name}: ${reason}`,
          );
          targetSocket.ws?.send?.(kickPacket);

          // Close the WebSocket - this triggers proper cleanup via handleDisconnect
          // DO NOT manually delete from sockets - let handleDisconnect do it
          targetSocket.ws?.close?.(4003, "Banned");
          break;
        }
      }
    }

    const durationText = expiresAt ? `for ${args[2]}` : "permanently";
    socket.send("chatAdded", {
      id: uuid(),
      from: null,
      fromId: null,
      body: `${targetUser.name} has been banned ${durationText}. Reason: ${reason}`,
      createdAt: moment().toISOString(),
    });
    console.log(
      `[Commands] Mod ${player.data.name} banned ${targetUser.name} ${durationText}. Reason: ${reason}`,
    );
  }

  // /unban <username> - Unban a user (mod+ only)
  if (cmd === "unban" && arg1) {
    const modRoles: string[] = Array.isArray(player.data.roles)
      ? player.data.roles
      : [];
    if (!hasModPermission(modRoles)) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: "You don't have permission to use /unban. Only mods and admins can use this command.",
        createdAt: moment().toISOString(),
      });
      return;
    }

    const targetName = arg1.toLowerCase();

    // Find the target user by name (case-insensitive)
    const unbanTargetUser = (await db("users")
      .whereRaw("LOWER(name) = ?", [targetName])
      .first()) as UserRow | undefined;

    if (!unbanTargetUser) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: `User "${arg1}" not found.`,
        createdAt: moment().toISOString(),
      });
      return;
    }

    // Find and deactivate the ban
    const existingBanToRemove = (await db("user_bans")
      .where("bannedUserId", unbanTargetUser.id)
      .where("active", 1)
      .first()) as BanRow | undefined;

    if (!existingBanToRemove) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: `${unbanTargetUser.name} is not currently banned.`,
        createdAt: moment().toISOString(),
      });
      return;
    }

    // Deactivate the ban (soft delete - preserves history)
    await db("user_bans")
      .where("id", existingBanToRemove.id!)
      .update({ active: 0 });

    socket.send("chatAdded", {
      id: uuid(),
      from: null,
      fromId: null,
      body: `${unbanTargetUser.name} has been unbanned.`,
      createdAt: moment().toISOString(),
    });
    console.log(
      `[Commands] Mod ${player.data.name} unbanned ${unbanTargetUser.name}`,
    );
  }

  // /listbans - List all active bans (mod+ only)
  if (cmd === "listbans") {
    const modRoles: string[] = Array.isArray(player.data.roles)
      ? player.data.roles
      : [];
    if (!hasModPermission(modRoles)) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: "You don't have permission to use /listbans. Only mods and admins can use this command.",
        createdAt: moment().toISOString(),
      });
      return;
    }

    // Get all active bans
    const now = Date.now();
    const activeBansResult = db("user_bans")
      .where("active", 1)
      .where(function (this: ReturnType<SystemDatabase>) {
        this.whereNull("expiresAt").orWhere("expiresAt", ">", now);
      })
      .select([
        "bannedUserId",
        "bannedByUserId",
        "reason",
        "expiresAt",
        "createdAt",
      ]);
    const activeBans = (await activeBansResult) as BanRow[];

    if (activeBans.length === 0) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: "No active bans.",
        createdAt: moment().toISOString(),
      });
      return;
    }

    // Get user names for the ban list
    const userIds = [
      ...new Set([
        ...activeBans.map((b) => b.bannedUserId),
        ...activeBans.map((b) => b.bannedByUserId),
      ]),
    ];
    // Query each user individually since whereIn may not be supported
    const userMap = new Map<string, string>();
    for (const id of userIds) {
      const user = (await db("users").where("id", id).first()) as
        | UserRow
        | undefined;
      if (user) {
        userMap.set(user.id, user.name);
      }
    }

    // Build ban list message
    let message = `=== Active Bans (${activeBans.length}) ===\n`;
    for (const ban of activeBans) {
      const bannedName = userMap.get(ban.bannedUserId) || "Unknown";
      const bannedByName = userMap.get(ban.bannedByUserId) || "Unknown";
      const expiresText = ban.expiresAt
        ? `expires ${new Date(ban.expiresAt).toLocaleString()}`
        : "permanent";
      message += `${bannedName} - by ${bannedByName} (${expiresText})`;
      if (ban.reason) {
        message += ` - ${ban.reason}`;
      }
      message += "\n";
    }

    socket.send("chatAdded", {
      id: uuid(),
      from: null,
      fromId: null,
      body: message.trim(),
      createdAt: moment().toISOString(),
    });
  }

  // /message, /msg, /pm, /w, /whisper - Send private message to a player
  if (
    cmd === "message" ||
    cmd === "msg" ||
    cmd === "pm" ||
    cmd === "w" ||
    cmd === "whisper"
  ) {
    // Parse: /message @username content  OR  /message username content
    const fullArgs = args.slice(1).join(" ");
    const match = fullArgs.match(/^@?(\S+)\s+(.+)$/);

    if (!match) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: "Usage: /message @username your message",
        createdAt: moment().toISOString(),
      });
      return;
    }

    const [, targetName, content] = match;

    // Import and call handlePrivateMessage from friends handler
    const { handlePrivateMessage } = await import("./friends");
    await handlePrivateMessage(
      socket,
      { targetName: targetName.trim(), content: content.trim() },
      world,
    );
  }

  // /testfriend - Create a real friend request for testing (localhost only)
  if (cmd === "testfriend") {
    // Only allow on localhost/development
    const isDev = process.env.NODE_ENV !== "production";
    if (!isDev) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: "This command is only available in development mode.",
        createdAt: moment().toISOString(),
      });
      return;
    }

    // Use player.id (Entity's id) for consistency with getPlayerId() in friends.ts
    // This ensures the request's toPlayerId matches what handleFriendAccept will check
    const playerId = player.id || player.data?.id || socket.id;
    const playerName = player.data?.name || player.name || "Player";

    // Get the database to create a real entry
    // Use getDatabase(world) which is the same pattern as friend handlers
    const { FriendRepository } = await import(
      "../../../database/repositories/FriendRepository"
    );
    const dbConn = getDatabase(world);

    if (!dbConn) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: "[Test] Database not available. Cannot create friend request.",
        createdAt: moment().toISOString(),
      });
      return;
    }

    const repo = new FriendRepository(dbConn.drizzle, dbConn.pool);

    try {
      // Find another character in the database to use as the sender
      // FK constraints require valid character IDs
      const otherCharacter = await repo.findOtherCharacterAsync(playerId);

      if (!otherCharacter) {
        socket.send("chatAdded", {
          id: uuid(),
          from: null,
          fromId: null,
          body: "[Test] No other characters found. Create another character first to test friend requests.",
          createdAt: moment().toISOString(),
        });
        return;
      }

      // Check if already friends
      const alreadyFriends = await repo.areFriendsAsync(
        otherCharacter.id,
        playerId,
      );
      if (alreadyFriends) {
        socket.send("chatAdded", {
          id: uuid(),
          from: null,
          fromId: null,
          body: `[Test] You are already friends with ${otherCharacter.name}. Remove them first to test again.`,
          createdAt: moment().toISOString(),
        });
        return;
      }

      // Check if request already exists
      const existingRequest = await repo.hasRequestAsync(
        otherCharacter.id,
        playerId,
      );
      if (existingRequest) {
        socket.send("chatAdded", {
          id: uuid(),
          from: null,
          fromId: null,
          body: `[Test] Friend request from ${otherCharacter.name} already exists. Accept or decline it first.`,
          createdAt: moment().toISOString(),
        });
        return;
      }

      // Create the friend request in the database using the real character
      const createdId = await repo.createRequestAsync(
        otherCharacter.id,
        playerId,
      );
      const createdTimestamp = Date.now();

      // Send friend request incoming packet to client
      socket.send("friendRequestIncoming", {
        id: createdId,
        fromId: otherCharacter.id,
        fromName: otherCharacter.name,
        toId: playerId,
        toName: playerName,
        timestamp: createdTimestamp,
      });

      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: `[Test] Friend request created from "${otherCharacter.name}" to you!`,
        createdAt: moment().toISOString(),
      });

      console.log(
        `[TestFriend] Created friend request from ${otherCharacter.name} (${otherCharacter.id}) to ${playerName} (${playerId}) - request ID: ${createdId}`,
      );
    } catch (err) {
      console.error("[TestFriend] Error creating friend request:", err);
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: `[Test] Error: ${(err as Error).message}`,
        createdAt: moment().toISOString(),
      });
    }
  }

  // /testlevelup [skill] - Test level up popup (dev only)
  // No param = random skill, or specify: /testlevelup agility
  if (cmd === "testlevelup") {
    const isDev = process.env.NODE_ENV !== "production";
    if (!isDev) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: "This command is only available in development mode.",
        createdAt: moment().toISOString(),
      });
      return;
    }

    const validSkills = [
      "attack",
      "strength",
      "defense",
      "constitution",
      "range",
      "woodcutting",
      "fishing",
      "firemaking",
      "cooking",
      "agility",
      "prayer",
      "magic",
      "mining",
      "smithing",
      "crafting",
      "herblore",
      "thieving",
      "fletching",
      "slayer",
      "runecrafting",
      "hunter",
      "construction",
    ];

    // Pick random skill if none provided
    const skill = arg1
      ? arg1.toLowerCase()
      : validSkills[Math.floor(Math.random() * validSkills.length)];

    if (!validSkills.includes(skill)) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: `[Test] Invalid skill. Valid skills: ${validSkills.slice(0, 10).join(", ")}...`,
        createdAt: moment().toISOString(),
      });
      return;
    }

    // Generate random level between 2 and 99
    const newLevel = Math.floor(Math.random() * 98) + 2;
    const oldLevel = newLevel - 1;

    // Send test level up event to client (visual only - no state changes)
    socket.send("testLevelUp", {
      skill,
      oldLevel,
      newLevel,
    });

    socket.send("chatAdded", {
      id: uuid(),
      from: null,
      fromId: null,
      body: `[Test] Level up: ${skill} (${oldLevel} -> ${newLevel})`,
      createdAt: moment().toISOString(),
    });
  }

  // /testquest [questname] - Test quest completion popup (dev only)
  // No param = random quest, or specify: /testquest Dragon Slayer
  if (cmd === "testquest") {
    const isDev = process.env.NODE_ENV !== "production";
    if (!isDev) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: "This command is only available in development mode.",
        createdAt: moment().toISOString(),
      });
      return;
    }

    // Sample quest names for random selection
    const sampleQuests = [
      "Cook's Assistant",
      "Dragon Slayer",
      "Goblin Diplomacy",
      "The Restless Ghost",
      "Romeo & Juliet",
      "Sheep Shearer",
      "Imp Catcher",
      "Witch's Potion",
      "Ernest the Chicken",
      "Vampire Slayer",
      "The Knight's Sword",
      "Demon Slayer",
      "Shield of Arrav",
      "Lost City",
      "Monkey Madness",
    ];

    // Join all args after command for multi-word quest names, or pick random
    const questName =
      args.slice(1).join(" ").trim() ||
      sampleQuests[Math.floor(Math.random() * sampleQuests.length)];
    const playerId = player.id || player.data?.id || socket.id;

    // Random rewards based on "quest difficulty"
    const questPoints = Math.floor(Math.random() * 5) + 1;
    const coinReward = (Math.floor(Math.random() * 10) + 1) * 100;
    const xpReward = (Math.floor(Math.random() * 5) + 1) * 100;

    // Pick random skills for XP rewards
    const xpSkills = [
      "attack",
      "strength",
      "defense",
      "cooking",
      "fishing",
      "woodcutting",
      "mining",
      "magic",
      "prayer",
    ];
    const skill1 = xpSkills[Math.floor(Math.random() * xpSkills.length)];
    const skill2 = xpSkills[Math.floor(Math.random() * xpSkills.length)];

    // Send quest completed event to client
    socket.send("questCompleted", {
      playerId,
      questId: `test-quest-${Date.now()}`,
      questName,
      rewards: {
        questPoints,
        items: [{ itemId: "coins", quantity: coinReward }],
        xp: {
          [skill1]: xpReward,
          [skill2]: Math.floor(xpReward / 2),
        },
      },
    });

    socket.send("chatAdded", {
      id: uuid(),
      from: null,
      fromId: null,
      body: `[Test] Quest completed: "${questName}" (+${questPoints} QP)`,
      createdAt: moment().toISOString(),
    });
  }

  // /testtoast [type] [message] - Test toast notification (dev only)
  // No params = random type with sample message
  if (cmd === "testtoast") {
    const isDev = process.env.NODE_ENV !== "production";
    if (!isDev) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: "This command is only available in development mode.",
        createdAt: moment().toISOString(),
      });
      return;
    }

    const validTypes = ["info", "success", "warning", "error"];

    // Sample messages for each type
    const sampleMessages: Record<string, string[]> = {
      info: [
        "A new update is available!",
        "Your session will expire in 5 minutes.",
        "Daily challenges have reset.",
      ],
      success: [
        "Item acquired!",
        "Trade completed successfully.",
        "You have unlocked a new area!",
        "Achievement unlocked!",
      ],
      warning: [
        "Your inventory is almost full.",
        "Low prayer points!",
        "You are under attack!",
        "Connection unstable.",
      ],
      error: [
        "Cannot equip that item.",
        "Inventory is full.",
        "Not enough coins.",
        "That action is not allowed here.",
      ],
    };

    // If type provided, use it; otherwise pick random
    const toastType = validTypes.includes(arg1?.toLowerCase() || "")
      ? arg1.toLowerCase()
      : validTypes[Math.floor(Math.random() * validTypes.length)];

    // If message provided, use it; otherwise pick random sample for this type
    const typeMessages = sampleMessages[toastType];
    const message =
      args.slice(2).join(" ").trim() ||
      typeMessages[Math.floor(Math.random() * typeMessages.length)];

    socket.send("showToast", {
      message,
      type: toastType,
    });

    socket.send("chatAdded", {
      id: uuid(),
      from: null,
      fromId: null,
      body: `[Test] Toast (${toastType}): "${message}"`,
      createdAt: moment().toISOString(),
    });
  }

  // /testxp [skill] [amount] - Test XP drop visualization (dev only)
  // No params = random skill and amount
  if (cmd === "testxp") {
    const isDev = process.env.NODE_ENV !== "production";
    if (!isDev) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: "This command is only available in development mode.",
        createdAt: moment().toISOString(),
      });
      return;
    }

    const validSkills = [
      "attack",
      "strength",
      "defense",
      "constitution",
      "range",
      "woodcutting",
      "fishing",
      "firemaking",
      "cooking",
      "agility",
      "prayer",
      "magic",
      "mining",
    ];

    // Pick random skill if none provided
    const skill = arg1
      ? arg1.toLowerCase()
      : validSkills[Math.floor(Math.random() * validSkills.length)];

    // Random amount if none provided (10-500 XP)
    const amount = args[2]
      ? parseInt(args[2], 10) || 100
      : Math.floor(Math.random() * 491) + 10;

    if (!validSkills.includes(skill)) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: `[Test] Invalid skill. Valid: ${validSkills.join(", ")}`,
        createdAt: moment().toISOString(),
      });
      return;
    }

    // Send test XP drop to client (visual only - no state changes)
    socket.send("testXpDrop", {
      skill,
      amount,
    });

    socket.send("chatAdded", {
      id: uuid(),
      from: null,
      fromId: null,
      body: `[Test] XP drop: +${amount} ${skill}`,
      createdAt: moment().toISOString(),
    });
  }

  // /testdeath - Test death screen (dev only)
  if (cmd === "testdeath") {
    const isDev = process.env.NODE_ENV !== "production";
    if (!isDev) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: "This command is only available in development mode.",
        createdAt: moment().toISOString(),
      });
      return;
    }

    const playerId = player.id || player.data?.id || socket.id;

    // Send test death screen to client (visual only - no state changes)
    // Uses UI_DEATH_SCREEN event with proper data structure
    socket.send("uiDeathScreen", {
      message: "Test death - no items were actually dropped",
      killedBy: "Test Command",
      respawnTime: Date.now() + 60000, // 60 second timer for testing
      playerId, // Include playerId for tracking
    });

    socket.send("chatAdded", {
      id: uuid(),
      from: null,
      fromId: null,
      body: `[Test] Death screen triggered for player ${playerId}`,
      createdAt: moment().toISOString(),
    });
  }

  // /testtrade [name] - Test trade request popup (dev only)
  // No param = random trader name, or specify: /testtrade Bob
  if (cmd === "testtrade") {
    const isDev = process.env.NODE_ENV !== "production";
    if (!isDev) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: "This command is only available in development mode.",
        createdAt: moment().toISOString(),
      });
      return;
    }

    // Sample trader names for random selection
    const sampleTraders = [
      "MerchantMike",
      "TradingTom",
      "WealthyWilliam",
      "ShopkeepSally",
      "BarterBob",
      "DealerDan",
      "VendorVicky",
      "MarketMary",
      "SwapperSteve",
      "ExchangeEmma",
    ];

    // Use provided name or pick random
    const traderName =
      arg1 || sampleTraders[Math.floor(Math.random() * sampleTraders.length)];
    const traderLevel = Math.floor(Math.random() * 126) + 3; // Random level 3-128

    // Send test trade request packet (visual only)
    socket.send("tradeIncoming", {
      tradeId: `test-trade-${uuid()}`,
      fromPlayerId: `test-player-${uuid()}`,
      fromPlayerName: traderName,
      fromPlayerLevel: traderLevel,
    });

    socket.send("chatAdded", {
      id: uuid(),
      from: null,
      fromId: null,
      body: `[Test] Trade request from ${traderName} (Level ${traderLevel})`,
      createdAt: moment().toISOString(),
    });
  }

  // /testhelp - Show all test commands (dev only)
  if (cmd === "testhelp") {
    const isDev = process.env.NODE_ENV !== "production";
    if (!isDev) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: "This command is only available in development mode.",
        createdAt: moment().toISOString(),
      });
      return;
    }

    const helpMessages = [
      "[Test Commands - all params optional, uses random defaults]",
      "/testfriend - Friend request from another character",
      "/testlevelup [skill] - Level up popup (random skill if omitted)",
      "/testquest [name] - Quest complete popup (random quest if omitted)",
      "/testtoast [type] [msg] - Toast: info/success/warning/error",
      "/testxp [skill] [amt] - XP drop (random if omitted)",
      "/testdeath - Death screen",
      "/testtrade [name] - Trade request popup (random trader if omitted)",
    ];

    for (const msg of helpMessages) {
      socket.send("chatAdded", {
        id: uuid(),
        from: null,
        fromId: null,
        body: msg,
        createdAt: moment().toISOString(),
      });
    }
  }
}
