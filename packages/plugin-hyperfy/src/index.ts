import 'ses'

import type { Plugin } from '@elizaos/core'
import { logger } from '@elizaos/core'
import { HyperfyService } from './service'
import { z } from 'zod'
// import { hyperfyChatAction } from './actions/chat';
import { hyperfyGotoEntityAction } from './actions/goto'
import { hyperfyUseItemAction } from './actions/use'
import { hyperfyUnuseItemAction } from './actions/unuse'
import { hyperfyStopMovingAction } from './actions/stop'
import { hyperfyWalkRandomlyAction } from './actions/walk_randomly'
import { ambientAction } from './actions/ambient'
import { hyperfyScenePerceptionAction } from './actions/perception'
import { hyperfyEditEntityAction } from './actions/build'
import { replyAction } from './actions/reply'
import { ignoreAction } from './actions/ignore'
import { hyperfyProvider } from './providers/world'
import { hyperfyEmoteProvider } from './providers/emote'
import { hyperfyActionsProvider } from './providers/actions'
import { characterProvider } from './providers/character'
import { hyperfyEvents } from './events'

// --- Hardcoded values matching agent/index.mjs ---
const HYPERFY_WS_URL = process.env.WS_URL || 'wss://chill.hyperfy.xyz/ws'
// ---------------------------------------------

// Define the plugin configuration schema (optional, adjust as needed)
// Renamed this one to avoid conflict
const hyperfyPluginConfigSchema = z.object({
  DEFAULT_HYPERFY_WS_URL: z.string().url().optional(),
})

// --- Main Plugin Definition ---
export const hyperfyPlugin: Plugin = {
  name: 'hyperfy', // Renamed plugin
  description: 'Integrates ElizaOS agents with Hyperfy worlds',
  config: {
    // Map environment variables to config keys
    DEFAULT_HYPERFY_WS_URL: HYPERFY_WS_URL,
  },
  async init(config: Record<string, string | undefined>) {
    logger.info('*** Initializing Hyperfy Integration plugin ***')
    try {
      // Validate config using the schema
      const validatedConfig = await hyperfyPluginConfigSchema.parseAsync(config)
      logger.info('Hyperfy plugin config validated:', validatedConfig)
      // Store validated config for service use (runtime.pluginConfigs is usually the way)
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error(
          `Invalid Hyperfy plugin configuration: ${error.errors.map(e => e.message).join(', ')}`
        )
        // Decide if this is a fatal error
        // throw new Error(`Invalid Hyperfy plugin configuration...`);
      } else {
        logger.error('Unknown error during Hyperfy plugin init:', error)
        // throw error;
      }
      // Allow initialization to continue even if config fails, service might get config later
    }
  },
  services: [HyperfyService],
  events: hyperfyEvents,
  actions: [
    hyperfyScenePerceptionAction,
    hyperfyGotoEntityAction,
    hyperfyUseItemAction,
    hyperfyUnuseItemAction,
    hyperfyStopMovingAction,
    hyperfyWalkRandomlyAction,
    ambientAction,
    hyperfyEditEntityAction,
    replyAction,
    ignoreAction,
  ],
  providers: [
    hyperfyProvider,
    hyperfyEmoteProvider,
    hyperfyActionsProvider,
    characterProvider,
  ],
  routes: [],
}

export default hyperfyPlugin
