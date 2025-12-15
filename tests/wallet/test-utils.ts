/**
 * Shared test utilities for Hyperscape wallet tests
 */

// Client URL - respects HYPERSCAPE_URL > VITE_PORT > default 3333
export const CLIENT_URL =
  process.env.HYPERSCAPE_URL ||
  `http://localhost:${process.env.VITE_PORT || "3333"}`;

// Type-safe window access for game world
export interface GameWorld {
  network?: {
    socket?: {
      player?: { id?: string; data?: { name?: string } };
      send?: (type: string, data: Record<string, unknown>) => void;
      ws?: { onmessage?: ((event: MessageEvent) => void) | null };
    };
  };
  entities?: {
    player?: { id?: string };
    getAllPlayers?: () => unknown[];
  };
  getSystem?: (name: string) => { getAllEntities?: () => Map<string, unknown> };
}

export type WindowWithWorld = typeof globalThis & { world?: GameWorld };

/** Get player ID from game world */
export function getPlayerId(win: WindowWithWorld): string | null {
  return win.world?.network?.socket?.player?.id ?? null;
}

/** Check if socket can send packets */
export function canSendPackets(win: WindowWithWorld): boolean {
  return typeof win.world?.network?.socket?.send === "function";
}

