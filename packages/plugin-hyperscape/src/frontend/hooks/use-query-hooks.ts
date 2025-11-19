/**
 * Stub for useAgent hook
 * This is provided by the consuming application (ElizaOS frontend)
 */
import type { UUID } from "@elizaos/core";

export type UseAgentHook = (agentId: UUID | undefined) => {
  data?: {
    data?: {
      plugins?: string[];
      metadata?: {
        hyperscapeWorld?: string;
      };
    };
  };
};

export const useAgent: UseAgentHook = () => {
  return {};
};
