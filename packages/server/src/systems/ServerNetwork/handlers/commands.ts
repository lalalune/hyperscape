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
  TerrainSystem,
  World,
} from "@hyperscape/shared";

export async function handleCommand(
  socket: ServerSocket,
  data: unknown,
  world: World,
  db: SystemDatabase,
  sendFn: (name: string, data: unknown, ignoreSocketId?: string) => void,
  isBuilder: (player: { data?: { roles?: string[] } }) => boolean,
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
}
