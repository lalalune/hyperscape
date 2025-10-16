import {
  type Provider,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
} from '@elizaos/core'

/**
 * Facts Provider - Provides relevant facts for context
 *
 * This provider retrieves stored facts about users, world state, and
 * other information that has been learned through conversations.
 * It helps the agent maintain continuity and demonstrate memory.
 */
export const factsProvider: Provider = {
  name: 'FACTS',
  description:
    'Provides relevant facts learned from previous conversations, including user preferences, goals, and world state information.',

  get: async (runtime: IAgentRuntime, message: Memory, _state: State) => {
    logger.debug('[FACTS_PROVIDER] Retrieving relevant facts')

    try {
      // Get facts from memory
      const facts = await runtime.getMemories({
        roomId: message.roomId,
        count: 50,
        unique: false,
        tableName: 'facts',
      })

      if (!facts || facts.length === 0) {
        return {
          text: 'No facts stored yet. This is a new conversation.',
          data: {
            factCount: 0,
            hasFacts: false,
          },
        }
      }

      // Group facts by category
      const factsByCategory: Record<string, string[]> = {
        preference: [],
        goal: [],
        biographical: [],
        world_state: [],
        general: [],
      }

      for (const fact of facts) {
        const category = String(fact.content.category || 'general')
        const text = String(fact.content.text || '')

        if (text) {
          if (!factsByCategory[category]) {
            factsByCategory[category] = []
          }
          factsByCategory[category].push(text)
        }
      }

      // Format facts for context
      let text = '# Known Facts\n\n'

      // Add facts by category
      const categoryLabels: Record<string, string> = {
        preference: 'User Preferences',
        goal: 'User Goals',
        biographical: 'User Information',
        world_state: 'World State',
        general: 'General Facts',
      }

      let hasAnyFacts = false
      for (const [category, label] of Object.entries(categoryLabels)) {
        const categoryFacts = factsByCategory[category]
        if (categoryFacts && categoryFacts.length > 0) {
          hasAnyFacts = true
          text += `## ${label}\n`
          for (const fact of categoryFacts) {
            text += `- ${fact}\n`
          }
          text += '\n'
        }
      }

      if (!hasAnyFacts) {
        return {
          text: 'No facts stored yet. This is a new conversation.',
          data: {
            factCount: 0,
            hasFacts: false,
          },
        }
      }

      // Add usage guidance
      text += `\nUse these facts to:\n`
      text += `- Personalize your responses\n`
      text += `- Show continuity and memory\n`
      text += `- Reference past conversations\n`
      text += `- Understand user context\n`

      logger.debug(`[FACTS_PROVIDER] Retrieved ${facts.length} facts`)

      return {
        text,
        data: {
          factCount: facts.length,
          hasFacts: true,
          byCategory: Object.fromEntries(
            Object.entries(factsByCategory).map(([cat, items]) => [
              cat,
              items.length,
            ])
          ),
        },
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('[FACTS_PROVIDER] Error retrieving facts:', errorMsg)
      return {
        text: 'Error retrieving facts. Proceeding without fact context.',
        data: {
          factCount: 0,
          hasFacts: false,
          error: errorMsg,
        },
      }
    }
  },
}
