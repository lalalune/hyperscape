/**
 * useHyperscapePlugin Hook
 *
 * Detects if an agent has the Hyperscape plugin enabled and provides
 * connection configuration for the Hyperscape WebSocket server.
 */

import type { UUID } from "@elizaos/core";
import { useAgent, type UseAgentHook } from "./use-query-hooks";

export type { UseAgentHook };

export interface HyperscapePluginConfig {
  /** Whether the Hyperscape plugin is active for this agent */
  isActive: boolean;
  /** WebSocket URL for the Hyperscape game server */
  worldUrl: string;
  /** Agent ID */
  agentId: UUID | undefined;
}

/**
 * Hook to detect if an agent has the Hyperscape plugin enabled
 *
 * @param agentId - The agent's UUID
 * @returns Plugin configuration including active status and WebSocket URL
 *
 * @example
 * ```tsx
 * import { useHyperscapePlugin } from '@hyperscape/plugin-hyperscape/frontend';
 *
 * const { isActive, worldUrl } = useHyperscapePlugin(agentId);
 *
 * if (isActive) {
 *   return <HyperscapeDashboard agentId={agentId} worldUrl={worldUrl} />;
 * }
 * ```
 */
export function useHyperscapePlugin(
  agentId: UUID | undefined,
): HyperscapePluginConfig {
  const { data: agentData } = useAgent(agentId);
  const agent = agentData?.data;

  // Check if agent has Hyperscape plugin in its plugins array
  // Support both @hyperscape/plugin-hyperscape and @elizaos/plugin-hyperscape for compatibility
  const isActive =
    agent?.plugins?.includes("@hyperscape/plugin-hyperscape") ||
    agent?.plugins?.includes("@elizaos/plugin-hyperscape") ||
    false;

  // Get WebSocket URL from agent metadata or use default
  const worldUrl =
    (agent?.metadata?.hyperscapeWorld as string) ?? "ws://localhost:5555/ws";

  return {
    isActive,
    worldUrl,
    agentId,
  };
}
