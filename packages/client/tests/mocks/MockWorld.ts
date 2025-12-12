/**
 * MockWorld - Mock ClientWorld for testing bank actions
 *
 * Provides a mock network.send function to verify outgoing messages.
 */

import { vi } from "vitest";

export interface MockNetworkSendCall {
  type: string;
  payload: Record<string, unknown>;
}

export interface MockNetwork {
  send: ReturnType<typeof vi.fn>;
  calls: MockNetworkSendCall[];
}

export interface MockClientWorld {
  network: MockNetwork;
}

/**
 * Creates a mock ClientWorld with a trackable network.send function
 */
export function createMockWorld(): MockClientWorld {
  const calls: MockNetworkSendCall[] = [];

  const send = vi.fn((type: string, payload: Record<string, unknown>) => {
    calls.push({ type, payload });
  });

  return {
    network: {
      send,
      calls,
    },
  };
}

/**
 * Creates a mock world with no network (network is undefined)
 */
export function createMockWorldWithoutNetwork(): { network: undefined } {
  return {
    network: undefined,
  };
}

/**
 * Clears the call history for a mock world
 */
export function clearMockWorldCalls(world: MockClientWorld): void {
  world.network.send.mockClear();
  world.network.calls.length = 0;
}

/**
 * Gets the last call made to network.send
 */
export function getLastNetworkCall(
  world: MockClientWorld,
): MockNetworkSendCall | undefined {
  return world.network.calls[world.network.calls.length - 1];
}

/**
 * Gets all calls of a specific message type
 */
export function getCallsByType(
  world: MockClientWorld,
  type: string,
): MockNetworkSendCall[] {
  return world.network.calls.filter((call) => call.type === type);
}
