import type { Plugin } from '@elizaos/core'
import { logger } from '@elizaos/core'
import { HyperscapeService } from './service'
import { z } from 'zod'
// import { hyperscapeChatAction } from './actions/chat';
import { hyperscapeGotoEntityAction } from './actions/goto'
import { useAction } from './actions/use'
import { hyperscapeUnuseItemAction } from './actions/unuse'
import { hyperscapeStopMovingAction } from './actions/stop'
import { hyperscapeWalkRandomlyAction } from './actions/walk_randomly'
import { ambientAction } from './actions/ambient'
import { hyperscapeScenePerceptionAction } from './actions/perception'
import { hyperscapeEditEntityAction } from './actions/build'
import { replyAction } from './actions/reply'
import { ignoreAction } from './actions/ignore'
import { hyperscapeProvider } from './providers/world'
import { hyperscapeEmoteProvider } from './providers/emote'
import { hyperscapeActionsProvider } from './providers/actions'
import { characterProvider } from './providers/character'
import { hyperscapeEvents } from './events'

import { NETWORK_CONFIG } from './config/constants'

// Define the plugin configuration schema (optional, adjust as needed)
// Renamed this one to avoid conflict
const hyperscapePluginConfigSchema = z.object({
  DEFAULT_HYPERSCAPE_WS_URL: z.string().url().optional(),
})

// --- Main Plugin Definition ---
export const hyperscapePlugin: Plugin = {
  name: 'hyperscape', // Renamed plugin
  description: 'Integrates ElizaOS agents with Hyperscape worlds',
  config: {
    // Map environment variables to config keys
    DEFAULT_HYPERSCAPE_WS_URL: NETWORK_CONFIG.DEFAULT_WS_URL,
  },
  async init(config: Record<string, string | undefined>) {
    logger.info('*** Initializing Hyperscape Integration plugin ***')
    try {
      // Validate config using the schema
      const validatedConfig =
        await hyperscapePluginConfigSchema.parseAsync({ DEFAULT_HYPERSCAPE_WS_URL: config.DEFAULT_HYPERSCAPE_WS_URL })
      logger.info(`Hyperscape plugin config validated: ${JSON.stringify(validatedConfig)}`)
      // Store validated config for service use (runtime.pluginConfigs is usually the way)
    } catch (error) {
      const zodError = error as z.ZodError
      // Assume it's a ZodError if it has an errors property
      if (zodError.errors) {
        logger.error(
          `Invalid Hyperscape plugin configuration: ${zodError.errors.map(e => e.message).join(', ')}`
        )
      } else {
        logger.error('Unknown error during Hyperscape plugin init:', error)
      }
      // Allow initialization to continue even if config fails, service might get config later
    }
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
}

export default hyperscapePlugin

// Export content packs for easy integration
export * from './content-packs'
