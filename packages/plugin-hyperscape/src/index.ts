/**
 * Hyperscape ElizaOS Plugin
 *
 * This plugin integrates ElizaOS AI agents with Hyperscape 3D multiplayer worlds.
 * It enables autonomous agents to join virtual worlds, navigate environments, interact
 * with objects, chat with users, and perform actions just like human players.
 *
 * **Key Features**:
 *
 * **Agent Actions**:
 * - `perception`: Scan the environment and identify nearby entities
 * - `goto`: Navigate to specific entities or locations
 * - `use`: Use/activate items or objects in the world
 * - `unuse`: Stop using an item
 * - `stop`: Stop current movement
 * - `walk_randomly`: Wander around randomly
 * - `ambient`: Perform ambient behaviors (idle animations, emotes)
 * - `build`: Place and modify world entities (if agent has builder role)
 * - `reply`: Respond to chat messages
 * - `ignore`: Ignore specific messages or users
 *
 * **Providers** (context for agent decision-making):
 * - `world`: Current world state, entities, and environment info
 * - `emote`: Available emotes and gestures
 * - `actions`: Available actions the agent can perform
 * - `character`: Agent's character state (health, inventory, etc.)
 *
 * **Service**:
 * `HyperscapeService` manages the connection to Hyperscape worlds, handles
 * real-time state synchronization, and executes actions on behalf of the agent.
 *
 * **Events**:
 * Listens for world events (chat messages, entity spawns, etc.) and routes
 * them to the agent's decision-making system.
 *
 * **Configuration**:
 * - `DEFAULT_HYPERSCAPE_WS_URL`: WebSocket URL for the Hyperscape server
 *   (default: ws://localhost:5555/ws)
 *
 * **Usage**:
 * ```typescript
 * import { hyperscapePlugin } from '@hyperscape/plugin';
 *
 * const character = {
 *   name: 'MyAgent',
 *   plugins: [hyperscapePlugin],
 *   // ...
 * };
 * ```
 *
 * **Architecture**:
 * This plugin follows the ElizaOS plugin pattern:
 * - Service: Long-lived connection and state management
 * - Actions: Discrete tasks the agent can perform
 * - Providers: Context injection for agent prompts
 * - Events: React to world events
 *
 * **Referenced by**: ElizaOS agent configurations, character definitions
 */

import type { Plugin } from "@elizaos/core";
import { logger } from "@elizaos/core";
import { HyperscapeService } from "./service";
import { z } from "zod";
// import { hyperscapeChatAction } from './actions/chat';
import { hyperscapeGotoEntityAction } from "./actions/goto";
import { useAction } from "./actions/use";
import { hyperscapeUnuseItemAction } from "./actions/unuse";
import { hyperscapeStopMovingAction } from "./actions/stop";
import { hyperscapeWalkRandomlyAction } from "./actions/walk_randomly";
import { ambientAction } from "./actions/ambient";
import { hyperscapeScenePerceptionAction } from "./actions/perception";
import { hyperscapeEditEntityAction } from "./actions/build";
import { replyAction } from "./actions/reply";
import { ignoreAction } from "./actions/ignore";
import { hyperscapeProvider } from "./providers/world";
import { hyperscapeEmoteProvider } from "./providers/emote";
import { hyperscapeActionsProvider } from "./providers/actions";
import { characterProvider } from "./providers/character";
import { hyperscapeEvents } from "./events";

import { NETWORK_CONFIG } from "./config/constants";

/**
 * Configuration schema for the Hyperscape plugin
 * Validates environment variables and plugin settings
 */
const hyperscapePluginConfigSchema = z.object({
  DEFAULT_HYPERSCAPE_WS_URL: z.string().url().optional(),
});

/**
 * Main Hyperscape Plugin Definition
 *
 * Registers all services, actions, providers, and event handlers with ElizaOS
 */
export const hyperscapePlugin: Plugin = {
  name: "hyperscape", // Renamed plugin
  description: "Integrates ElizaOS agents with Hyperscape worlds",
  config: {
    // Map environment variables to config keys
    DEFAULT_HYPERSCAPE_WS_URL: NETWORK_CONFIG.DEFAULT_WS_URL,
  },
  async init(config: Record<string, string | undefined>) {
    logger.info("*** Initializing Hyperscape Integration plugin ***");
    // Validate config using the schema
    const validatedConfig = await hyperscapePluginConfigSchema.parseAsync({
      DEFAULT_HYPERSCAPE_WS_URL: config.DEFAULT_HYPERSCAPE_WS_URL,
    });
    logger.info(
      `Hyperscape plugin config validated: ${JSON.stringify(validatedConfig)}`,
    );
    // Store validated config for service use (runtime.pluginConfigs is usually the way)
  },
  services: [HyperscapeService],
  events: hyperscapeEvents,
  actions: [
    hyperscapeScenePerceptionAction,
    hyperscapeGotoEntityAction,
    useAction,
    hyperscapeUnuseItemAction,
    hyperscapeStopMovingAction,
    hyperscapeWalkRandomlyAction,
    ambientAction,
    hyperscapeEditEntityAction,
    replyAction,
    ignoreAction,
  ],
  providers: [
    hyperscapeProvider,
    hyperscapeEmoteProvider,
    hyperscapeActionsProvider,
    characterProvider,
  ],
  routes: [],
};

export default hyperscapePlugin;

// Export content packs for easy integration
export * from "./content-packs";
