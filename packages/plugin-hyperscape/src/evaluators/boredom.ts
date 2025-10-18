import {
  type Evaluator,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
  composePromptFromState,
  parseKeyValueXml,
  ModelType,
} from "@elizaos/core";

/**
 * Template for evaluating engagement levels
 */
const boredomEvaluationTemplate = `# Task: Evaluate conversation engagement level

Analyze the recent conversation to determine the engagement level and identify signs of boredom.

Recent conversation:
{{recentMessages}}

Factors to consider:
- Message length and depth
- Response time and frequency
- Topic variety and interest
- Repetitive patterns
- Enthusiasm indicators (exclamation marks, emojis, etc.)
- Questions asked
- Initiative shown by participants

Boredom indicators:
- Short, one-word responses
- Lack of questions or follow-up
- Long delays between messages
- Repetitive topics without depth
- Dismissive language
- Lack of engagement with topics

Output format (XML):
<engagement>
  <level>high|medium|low|bored</level>
  <score>0-100</score>
  <indicators>List of engagement indicators observed</indicators>
  <concerns>Any boredom signals detected</concerns>
  <recommendation>suggested action: continue|vary_topic|pause|end</recommendation>
</engagement>`;

/**
 * Boredom Evaluator - Monitors conversation engagement levels
 *
 * This evaluator analyzes conversations to detect:
 * - Engagement levels (high, medium, low, bored)
 * - Signs of user boredom or disinterest
 * - Conversation quality metrics
 * - When to vary topics or end conversations
 *
 * Helps maintain engaging interactions by identifying when users
 * are losing interest or when conversations should be adjusted.
 */
export const boredomEvaluator: Evaluator = {
  name: "ENGAGEMENT_MONITOR",
  similes: ["BOREDOM_DETECTION", "ENGAGEMENT_TRACKING", "INTEREST_MONITOR"],
  description:
    "Monitors conversation engagement levels and detects signs of boredom. Helps maintain engaging interactions.",

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    // Only evaluate if there's actual conversation content
    if (!message.content.text || message.content.text.trim() === "") {
      return false;
    }

    // Skip if message is from the agent itself
    if (message.entityId === runtime.agentId) {
      return false;
    }

    return true;
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    logger.info("[BOREDOM_EVALUATOR] Analyzing engagement level");

    try {
      // Compose state with recent messages
      const evaluationState =
        state ||
        (await runtime.composeState(message, ["RECENT_MESSAGES", "ENTITIES"]));

      // Generate prompt for engagement evaluation
      const prompt = composePromptFromState({
        state: evaluationState,
        template: boredomEvaluationTemplate,
      });

      // Use LLM to evaluate engagement
      const response = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt,
      });

      // Parse the XML response
      const parsed = parseKeyValueXml(response);

      if (!parsed || !parsed.level) {
        logger.debug("[BOREDOM_EVALUATOR] Could not parse engagement response");
        return;
      }

      const level = String(parsed.level || "medium");
      const score =
        typeof parsed.score === "number"
          ? parsed.score
          : parseInt(String(parsed.score || 50));
      const indicators = String(parsed.indicators || "");
      const concerns = String(parsed.concerns || "");
      const recommendation = String(parsed.recommendation || "continue");

      // Store engagement evaluation in memory
      const engagementMemory: Memory = {
        id: crypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}`,
        entityId: message.entityId,
        agentId: runtime.agentId,
        content: {
          text: `Engagement: ${level} (${score}/100)`,
          source: "boredom_evaluation",
          level,
          score,
          indicators,
          concerns,
          recommendation,
        },
        roomId: message.roomId,
        createdAt: Date.now(),
        metadata: {
          type: "engagement",
          level,
          score,
          evaluatedFrom: message.id,
        },
      };

      await runtime.createMemory(engagementMemory, "boredom");

      // Log significant engagement changes
      if (level === "bored" || score < 30) {
        logger.warn(
          `[BOREDOM_EVALUATOR] Low engagement detected: ${level} (${score}/100)`,
        );
        logger.warn(`[BOREDOM_EVALUATOR] Concerns: ${concerns}`);
        logger.info(`[BOREDOM_EVALUATOR] Recommendation: ${recommendation}`);
      } else if (level === "high" || score > 80) {
        logger.info(
          `[BOREDOM_EVALUATOR] High engagement: ${level} (${score}/100)`,
        );
      } else {
        logger.debug(`[BOREDOM_EVALUATOR] Engagement: ${level} (${score}/100)`);
      }

      // Emit engagement event for other systems to react
      try {
        await runtime.emitEvent("ENGAGEMENT_UPDATE" as "ENGAGEMENT_UPDATE", {
          runtime,
          roomId: message.roomId,
          entityId: message.entityId,
          level,
          score,
          recommendation,
          concerns,
        });
      } catch (emitError) {
        // Event emission is optional, don't fail if it errors
        logger.debug("[BOREDOM_EVALUATOR] Could not emit engagement event");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(
        "[BOREDOM_EVALUATOR] Error evaluating engagement:",
        errorMsg,
      );
    }
  },

  examples: [],
};
