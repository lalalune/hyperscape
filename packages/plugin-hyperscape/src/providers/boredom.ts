import {
  type Provider,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
} from '@elizaos/core'

/**
 * Boredom Provider - Provides engagement level context
 *
 * This provider retrieves recent engagement evaluations and formats them
 * for use in LLM prompts. It helps the agent understand current engagement
 * levels and adjust its behavior accordingly.
 */
export const boredomProvider: Provider = {
  name: 'BOREDOM',
  description:
    'Provides engagement level context from recent conversations, helping the agent adjust its behavior based on user interest levels.',

  get: async (runtime: IAgentRuntime, message: Memory, _state: State) => {
    logger.debug('[BOREDOM_PROVIDER] Retrieving engagement context')

    try {
      // Get recent engagement evaluations
      const engagementMemories = await runtime.getMemories({
        roomId: message.roomId,
        count: 5,
        unique: false,
        tableName: 'boredom',
      })

      if (!engagementMemories || engagementMemories.length === 0) {
        return {
          text: 'No engagement data available yet. Assume neutral engagement.',
          data: {
            level: 'medium',
            score: 50,
            hasData: false,
          },
        }
      }

      // Get the most recent engagement evaluation
      const latest = engagementMemories[0]
      if (!latest) {
        return {
          text: 'No engagement data available yet. Assume neutral engagement.',
          data: {
            level: 'medium',
            score: 50,
            hasData: false,
          },
        }
      }

      const level = String(latest.content.level || 'medium')
      const score =
        typeof latest.content.score === 'number'
          ? latest.content.score
          : 50
      const concerns = String(latest.content.concerns || '')
      const recommendation = String(latest.content.recommendation || 'continue')

      // Calculate trend if we have multiple evaluations
      let trend = 'stable'
      if (engagementMemories.length >= 2) {
        const previous = engagementMemories[1]
        if (previous) {
          const prevScore =
            typeof previous.content.score === 'number'
              ? previous.content.score
              : 50

          if (score > prevScore + 10) {
            trend = 'improving'
          } else if (score < prevScore - 10) {
            trend = 'declining'
          }
        }
      }

      // Format engagement context
      let text = `Current engagement level: ${level} (${score}/100)\n`
      text += `Trend: ${trend}\n`

      if (concerns) {
        text += `Concerns: ${concerns}\n`
      }

      text += `Recommendation: ${recommendation}\n`

      // Add guidance based on engagement level
      if (level === 'bored' || score < 30) {
        text += `\nUser appears bored or disengaged. Consider:\n`
        text += `- Changing the topic\n`
        text += `- Asking engaging questions\n`
        text += `- Being more concise\n`
        text += `- Ending the conversation gracefully if appropriate\n`
      } else if (level === 'low' || score < 50) {
        text += `\nEngagement is lower than ideal. Consider:\n`
        text += `- Adding variety to responses\n`
        text += `- Showing more enthusiasm\n`
        text += `- Asking interesting questions\n`
      } else if (level === 'high' || score > 80) {
        text += `\nUser is highly engaged! Maintain this by:\n`
        text += `- Continuing with current topics\n`
        text += `- Providing detailed, interesting responses\n`
        text += `- Matching the user's enthusiasm\n`
      }

      logger.debug(
        `[BOREDOM_PROVIDER] Engagement: ${level} (${score}/100), trend: ${trend}`
      )

      return {
        text,
        data: {
          level,
          score,
          trend,
          concerns,
          recommendation,
          hasData: true,
        },
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('[BOREDOM_PROVIDER] Error retrieving engagement data:', errorMsg)
      return {
        text: 'Error retrieving engagement data. Assume neutral engagement.',
        data: {
          level: 'medium',
          score: 50,
          hasData: false,
          error: errorMsg,
        },
      }
    }
  },
}
