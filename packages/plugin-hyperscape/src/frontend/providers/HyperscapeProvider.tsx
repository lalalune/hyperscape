/**
 * HyperscapeProvider
 *
 * Context provider that supplies the `useAgent` hook to all Hyperscape components.
 * Consuming applications must wrap their Hyperscape components with this provider.
 *
 * @example
 * ```tsx
 * import { useAgent } from '@/hooks/use-query-hooks'; // Your app's hook
 * import { HyperscapeProvider } from '@hyperscape/plugin-hyperscape/frontend';
 * import { HyperscapeDashboard } from '@hyperscape/plugin-hyperscape/frontend';
 *
 * function App() {
 *   return (
 *     <HyperscapeProvider useAgent={useAgent}>
 *       <HyperscapeDashboard agentId={agentId} />
 *     </HyperscapeProvider>
 *   );
 * }
 * ```
 */

import React, { createContext, useContext, type ReactNode } from "react";
import type { UUID, Agent } from "@elizaos/core";
import type { UseAgentHook } from "../hooks/use-query-hooks.js";

interface HyperscapeContextValue {
  useAgent: UseAgentHook;
}

const HyperscapeContext = createContext<HyperscapeContextValue | null>(null);

export interface HyperscapeProviderProps {
  /** The agent query hook from the consuming application */
  useAgent: UseAgentHook;
  /** Child components that will use Hyperscape hooks */
  children: ReactNode;
}

/**
 * Provider component that supplies the useAgent hook to all Hyperscape components
 */
export function HyperscapeProvider({
  useAgent,
  children,
}: HyperscapeProviderProps) {
  return (
    <HyperscapeContext.Provider value={{ useAgent }}>
      {children}
    </HyperscapeContext.Provider>
  );
}

/**
 * Hook to access the Hyperscape context
 * Used internally by Hyperscape hooks to get the useAgent function
 */
export function useHyperscapeContext(): HyperscapeContextValue {
  const context = useContext(HyperscapeContext);
  if (!context) {
    throw new Error(
      "useHyperscapeContext must be used within a HyperscapeProvider. " +
        "Wrap your Hyperscape components with <HyperscapeProvider useAgent={useAgent}>.",
    );
  }
  return context;
}
