import {
  type Evaluator,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
  composePromptFromState,
  parseKeyValueXml,
  ModelType,
} from '@elizaos/core'

/**
 * Template for tracking goal progress
 */
const goalTrackingTemplate = `# Task: Track goal progress from the conversation

Review the conversation and identify:
1. New goals mentioned by users
2. Progress updates on existing goals
3. Completed goals
4. Abandoned or failed goals

Recent conversation:
{{recentMessages}}

Current active goals:
{{goals}}

Instructions:
- Identify any NEW goals the user mentions
- Track progress on EXISTING goals
- Mark goals as COMPLETED when achieved
- Note if goals are ABANDONED or FAILED

Output format (XML):
<goals>
  <goal>
    <action>new|update|complete|abandon</action>
    <goalId>unique identifier (use existing ID for updates)</goalId>
    <description>Clear description of the goal</description>
    <progress>0-100 (percentage complete)</progress>
    <status>active|completed|abandoned|failed</status>
    <notes>Any relevant notes or updates</notes>
  </goal>
</goals>

If no goal-related activity, respond with:
<goals>
  <none>true</none>
</goals>`

/**
 * Goal Evaluator - Tracks user goals and objectives
 *
 * This evaluator monitors conversations for:
 * - New goals being set
 * - Progress updates on existing goals
 * - Goal completions
 * - Abandoned or failed goals
 *
 * Goals are stored in memory and can be retrieved to provide context
 * about what users are working toward.
 */
export const goalEvaluator: Evaluator = {
  name: 'TRACK_GOALS',
  similes: ['GOAL_TRACKING', 'OBJECTIVE_TRACKING', 'PROGRESS_TRACKING'],
  description:
    'Tracks user goals, objectives, and progress. Monitors for new goals, updates, completions, and failures.',

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    // Only evaluate if there's actual conversation content
    if (!message.content.text || message.content.text.trim() === '') {
      return false
    }

    // Skip if message is from the agent itself
    if (message.entityId === runtime.agentId) {
      return false
    }

    // Look for goal-related keywords
    const text = message.content.text.toLowerCase()
    const goalKeywords = [
      'goal',
      'objective',
      'want to',
      'trying to',
      'working on',
      'aim to',
      'plan to',
      'complete',
      'finish',
      'achieve',
      'level',
      'reach',
    ]

    return goalKeywords.some(keyword => text.includes(keyword))
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    logger.info('[GOAL_EVALUATOR] Analyzing conversation for goals')

    try {
      // Compose state with recent messages and existing goals
      const evaluationState =
        state ||
        (await runtime.composeState(message, ['RECENT_MESSAGES', 'GOALS']))

      // Get existing goals
      const existingGoals = await runtime.getMemories({
        roomId: message.roomId,
        count: 50,
        unique: false,
        tableName: 'goals',
      })

      // Filter active goals
      const activeGoals = existingGoals.filter(
        g =>
          g.content.status === 'active' ||
          !g.content.status ||
          g.content.status === undefined
      )

      // Add goals to state for context
      if (!evaluationState.data) {
        evaluationState.data = {}
      }
      Object.assign(evaluationState.data, {
        goals: activeGoals
          .map(
            g =>
              `[${g.content.goalId || g.id}] ${g.content.text} - ${g.content.progress || 0}% complete`
          )
          .join('\n'),
      })

      // Generate prompt for goal tracking
      const prompt = composePromptFromState({
        state: evaluationState,
        template: goalTrackingTemplate,
      })

      // Use LLM to track goals
      const response = await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt,
      })

      // Parse the XML response
      const parsed = parseKeyValueXml(response)

      if (!parsed || parsed.none === 'true' || parsed.none === true) {
        logger.debug('[GOAL_EVALUATOR] No goal activity found')
        return
      }

      // Handle goals array
      const goals = parsed.goals || (parsed.goal ? [parsed.goal] : [])

      if (!Array.isArray(goals) || goals.length === 0) {
        logger.debug('[GOAL_EVALUATOR] No goals in response')
        return
      }

      // Process each goal
      for (const goal of goals) {
        if (typeof goal !== 'object') continue

        const goalObj = goal as {
          action?: string
          goalId?: string
          description?: string
          progress?: string | number
          status?: string
          notes?: string
        }

        const action = goalObj.action || 'new'
        const goalId =
          goalObj.goalId || (crypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}`)
        const description = goalObj.description || ''
        const progress =
          typeof goalObj.progress === 'number'
            ? goalObj.progress
            : parseInt(String(goalObj.progress || 0))
        const status = goalObj.status || 'active'
        const notes = goalObj.notes || ''

        if (!description) continue

        if (action === 'new') {
          // Create new goal
          const validGoalId = goalId as `${string}-${string}-${string}-${string}-${string}`
          const goalMemory: Memory = {
            id: validGoalId,
            entityId: message.entityId,
            agentId: runtime.agentId,
            content: {
              text: description,
              source: 'goal_tracking',
              goalId: validGoalId,
              progress,
              status,
              notes,
            },
            roomId: message.roomId,
            createdAt: Date.now(),
            metadata: {
              type: 'goal',
              status,
              createdFrom: message.id,
            },
          }

          await runtime.createMemory(goalMemory, 'goals')
          logger.info(`[GOAL_EVALUATOR] New goal tracked: ${description}`)
        } else if (action === 'update' || action === 'complete' || action === 'abandon') {
          // Find existing goal
          const existingGoal = existingGoals.find(
            g => g.id === goalId || g.content.goalId === goalId
          )

          if (existingGoal && existingGoal.id) {
            // Update goal
            const updatedStatus =
              action === 'complete'
                ? 'completed'
                : action === 'abandon'
                  ? 'abandoned'
                  : status

            await runtime.updateMemory({
              id: existingGoal.id,
              content: {
                ...existingGoal.content,
                progress,
                status: updatedStatus,
                notes,
                lastUpdated: Date.now(),
              },
            })

            logger.info(
              `[GOAL_EVALUATOR] Goal ${action}: ${description} (${progress}%)`
            )
          } else {
            logger.warn(
              `[GOAL_EVALUATOR] Goal ${goalId} not found for ${action}`
            )
          }
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('[GOAL_EVALUATOR] Error tracking goals:', errorMsg)
    }
  },

  examples: [],
}
