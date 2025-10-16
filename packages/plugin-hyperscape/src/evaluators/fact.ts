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
 * Template for extracting facts from conversations
 */
const factExtractionTemplate = `# Task: Extract factual information from the conversation

Review the recent conversation and identify any factual information that should be remembered about:
- User preferences and interests
- User goals and objectives
- World state and entity information
- Gameplay progress and achievements
- Important decisions or commitments
- Biographical information about users

Recent conversation:
{{recentMessages}}

Current facts known:
{{facts}}

Instructions:
1. Identify NEW facts that aren't already known
2. Each fact should be clear, specific, and verifiable
3. Focus on information that will be useful for future interactions
4. Categorize facts as: preference, goal, biographical, world_state, or general

Output format (XML):
<facts>
  <fact>
    <category>preference|goal|biographical|world_state|general</category>
    <subject>Who or what this fact is about</subject>
    <predicate>What is being stated</predicate>
    <object>Additional context or value</object>
  </fact>
</facts>

If no new facts are found, respond with:
<facts>
  <none>true</none>
</facts>`

/**
 * Fact Evaluator - Extracts and stores factual information from conversations
 *
 * This evaluator analyzes conversations to identify and store important facts about:
 * - User preferences, goals, and interests
 * - World state and entity information
 * - Gameplay progress and achievements
 * - Biographical information
 *
 * Facts are stored in the memory system for future retrieval.
 */
export const factEvaluator: Evaluator = {
  name: 'EXTRACT_FACTS',
  similes: ['FACT_EXTRACTION', 'LEARN_FACTS', 'REMEMBER_FACTS'],
  description:
    'Extracts factual information from conversations and stores them in memory for future reference.',

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    // Only evaluate if there's actual conversation content
    if (!message.content.text || message.content.text.trim() === '') {
      return false
    }

    // Skip if message is from the agent itself
    if (message.entityId === runtime.agentId) {
      return false
    }

    return true
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    logger.info('[FACT_EVALUATOR] Analyzing conversation for facts')

    try {
      // Compose state with recent messages and existing facts
      const evaluationState =
        state ||
        (await runtime.composeState(message, [
          'RECENT_MESSAGES',
          'FACTS',
          'ENTITIES',
        ]))

      // Get existing facts to avoid duplicates
      const existingFacts = await runtime.getMemories({
        roomId: message.roomId,
        count: 50,
        unique: false,
        tableName: 'facts',
      })

      // Add facts to state for context
      if (!evaluationState.data) {
        evaluationState.data = {}
      }
      Object.assign(evaluationState.data, {
        facts: existingFacts.map(f => f.content.text).join('\n'),
      })

      // Generate prompt for fact extraction
      const prompt = composePromptFromState({
        state: evaluationState,
        template: factExtractionTemplate,
      })

      // Use LLM to extract facts
      const response = await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt,
      })

      // Parse the XML response
      const parsed = parseKeyValueXml(response)

      if (!parsed || parsed.none === 'true' || parsed.none === true) {
        logger.debug('[FACT_EVALUATOR] No new facts found')
        return
      }

      // Handle facts array
      const facts = parsed.facts || (parsed.fact ? [parsed.fact] : [])

      if (!Array.isArray(facts) || facts.length === 0) {
        logger.debug('[FACT_EVALUATOR] No facts in response')
        return
      }

      // Store each fact in memory
      for (const fact of facts) {
        if (typeof fact !== 'object') continue

        const factObj = fact as {
          category?: string
          subject?: string
          predicate?: string
          object?: string
        }

        const category = factObj.category || 'general'
        const subject = factObj.subject || ''
        const predicate = factObj.predicate || ''
        const objectValue = factObj.object || ''

        if (!subject || !predicate) continue

        // Create fact text
        const factText = `${subject} ${predicate}${objectValue ? ' ' + objectValue : ''}`

        // Check if fact already exists
        const isDuplicate = existingFacts.some(
          f =>
            f.content.text?.toLowerCase().includes(subject.toLowerCase()) &&
            f.content.text?.toLowerCase().includes(predicate.toLowerCase())
        )

        if (isDuplicate) {
          logger.debug(`[FACT_EVALUATOR] Skipping duplicate fact: ${factText}`)
          continue
        }

        // Store fact in memory
        const factMemory: Memory = {
          id: crypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}`,
          entityId: message.entityId,
          agentId: runtime.agentId,
          content: {
            text: factText,
            source: 'fact_extraction',
            category,
            subject,
            predicate,
            object: objectValue,
          },
          roomId: message.roomId,
          createdAt: Date.now(),
          metadata: {
            type: 'fact',
            category,
            extractedFrom: message.id,
          },
        }

        await runtime.createMemory(factMemory, 'facts')
        logger.info(`[FACT_EVALUATOR] Stored fact: ${factText}`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('[FACT_EVALUATOR] Error extracting facts:', errorMsg)
    }
  },

  examples: [],
}
