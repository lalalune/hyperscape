/**
 * AI Playtester Prompts
 * Helper functions for building playtester prompts and parsing test results
 */

export type PlaytesterArchetype =
  | "completionist"
  | "speedrunner"
  | "explorer"
  | "casual"
  | "minmaxer"
  | "roleplayer"
  | "breaker";

export type KnowledgeLevel = "beginner" | "intermediate" | "expert";
export type Pacing = "too_fast" | "just_right" | "too_slow" | "unknown";
export type BugSeverity = "critical" | "major" | "minor";
export type Recommendation = "pass" | "pass_with_changes" | "fail";

export interface PlaytesterConfig {
  id: string;
  name: string;
  archetype: PlaytesterArchetype;
  knowledgeLevel: KnowledgeLevel;
  personality: string;
  expectations: string[];
}

export interface BugReport {
  description: string;
  severity: BugSeverity;
  reporter: string;
  archetype: PlaytesterArchetype;
}

export interface TestResult {
  testerId: string;
  testerName: string;
  archetype: PlaytesterArchetype;
  knowledgeLevel: KnowledgeLevel;
  success: boolean;
  playthrough: string;
  completed: boolean;
  difficulty: number;
  engagement: number;
  pacing: Pacing;
  bugs: BugReport[];
  confusionPoints: string[];
  feedback: string;
  recommendation: Recommendation;
  rawResponse: string;
  error?: string;
}

export interface ActionableRecommendation {
  priority: "critical" | "high" | "medium" | "low" | "info";
  category:
    | "bugs"
    | "completion"
    | "difficulty"
    | "engagement"
    | "pacing"
    | "quality";
  message: string;
  action: string;
}

export interface AggregatedMetrics {
  totalTests: number;
  completionRate: number;
  averageDifficulty: number;
  difficultyByLevel: Record<string, { average: number; count: number }>;
  averageEngagement: number;
  engagementByArchetype: Record<string, { average: number; count: number }>;
  pacing: {
    too_fast: number;
    just_right: number;
    too_slow: number;
    unknown: number;
  };
  bugReports: BugReport[];
  uniqueBugs: number;
  criticalBugs: number;
  majorBugs: number;
  minorBugs: number;
  confusionPoints: string[];
  recommendations: {
    pass: number;
    pass_with_changes: number;
    fail: number;
  };
}

export interface QualityGrade {
  grade: "A" | "B" | "C" | "D" | "F";
  score: number;
}

/**
 * Get archetype-specific instructions
 */
export const ARCHETYPE_INSTRUCTIONS: Record<PlaytesterArchetype, string> = {
  completionist:
    "You try to complete everything thoroughly, exploring all options and finding all secrets. You notice when content is missing or incomplete. You test every dialogue option and explore every corner.",

  speedrunner:
    "You try to complete content as quickly as possible, finding optimal paths and skipping optional content. You notice sequence breaks, exploits, and anything that slows down progression.",

  explorer:
    "You explore every possibility, testing boundaries and trying unexpected actions. You try unconventional approaches, look for hidden areas, and test what happens when you do things out of order.",

  casual:
    "You play at a relaxed pace, sometimes missing obvious hints or skipping dialogue. You get stuck on things experienced players find obvious. You notice when instructions are unclear or confusing.",

  minmaxer:
    "You analyze mechanics and optimize your approach. You calculate if rewards are worth the effort. You notice balance issues, exploitable strategies, and mathematical inconsistencies in rewards or difficulty.",

  roleplayer:
    "You engage with content from a character perspective, valuing story and immersion. You make choices based on character motivation, not optimization. You notice when content breaks immersion or feels inconsistent.",

  breaker:
    "You actively try to break the content, testing limits and trying to cause errors. You attempt to do things in the wrong order, try invalid inputs, and push boundaries. You find bugs and edge cases systematically.",
};

/**
 * Get knowledge level context
 */
export const KNOWLEDGE_LEVEL_CONTEXT: Record<KnowledgeLevel, string> = {
  beginner:
    "You are new to this type of game and need clear guidance. You get stuck on things experienced players find obvious. You appreciate tutorials and clear markers. Unclear instructions frustrate you.",

  intermediate:
    "You have moderate experience and can handle standard challenges. You understand basic game mechanics but may miss subtle hints. You notice when difficulty spikes unexpectedly.",

  expert:
    "You are highly skilled and can handle complex challenges. You quickly figure out mechanics and optimal strategies. You notice when content is too easy, lacks depth, or can be exploited.",
};

/**
 * Build comprehensive playtest prompt
 */
export function makePlaytestPrompt(
  tester: PlaytesterConfig,
  content: Record<string, unknown>,
  testConfig?: Record<string, unknown>,
): string {
  const archetypeInstruction =
    ARCHETYPE_INSTRUCTIONS[tester.archetype] || ARCHETYPE_INSTRUCTIONS.casual;
  const knowledgeContext =
    KNOWLEDGE_LEVEL_CONTEXT[tester.knowledgeLevel] ||
    KNOWLEDGE_LEVEL_CONTEXT.intermediate;

  return `You are ${tester.name}, an AI playtester evaluating game content.

ARCHETYPE: ${tester.archetype}
PLAYSTYLE: ${archetypeInstruction}

KNOWLEDGE LEVEL: ${tester.knowledgeLevel}
${knowledgeContext}

PERSONALITY: ${tester.personality}

EXPECTATIONS: ${tester.expectations.join(", ")}

CONTENT TO TEST:
${JSON.stringify(content, null, 2)}

PLAYTEST INSTRUCTIONS:
1. "Play through" this content step by step from your character's perspective
2. Try to complete the objectives as your archetype would approach them
3. Look for issues from your unique perspective:

   BUG CATEGORIES:
   - Logic errors (impossible to complete, broken triggers, missing requirements)
   - Unclear instructions (confusing objectives, missing directions)
   - Sequence breaks (can do things out of order that break progression)
   - Balance issues (rewards too high/low, difficulty inconsistent)
   - Missing content (dead ends, incomplete features, placeholder text)

4. Evaluate difficulty for a ${tester.knowledgeLevel} player (1-10)
5. Rate engagement/fun (1-10)
6. Note pacing (too_fast/just_right/too_slow)
7. Identify confusion points that would frustrate players

OUTPUT FORMAT:
## Playthrough
[Describe step-by-step how you played through the content as ${tester.name}. Include what you tried, what worked, what didn't, and how your ${tester.archetype} playstyle affected your approach.]

## Completion Status
**Completed:** [YES/NO - Were you able to complete all objectives?]

## Difficulty Rating
**Difficulty:** [1-10]/10 for ${tester.knowledgeLevel} player
[Brief explanation: What made it easy/hard?]

## Engagement Rating
**Engagement:** [1-10]/10 - how fun/interesting was it?
[Brief explanation: What was engaging or boring?]

## Pacing Assessment
**Pacing:** [too_fast/just_right/too_slow]
[Brief explanation]

## Bugs Found
1. [Bug description with severity: critical/major/minor]
2. [Bug description with severity: critical/major/minor]
(Write "None" if no bugs found)

## Confusion Points
- [Thing that was unclear or confusing]
- [Thing that was unclear or confusing]
(Write "None" if nothing was confusing)

## Overall Feedback
[2-3 sentences summarizing the quality, main issues, and whether it's ready for players]

## Recommendation
**Recommendation:** [pass/pass_with_changes/fail]`;
}

/**
 * Parse test result from tester response
 */
export function parseTestResult(
  responseText: string,
  tester: PlaytesterConfig,
): TestResult {
  const result: TestResult = {
    testerId: tester.id,
    testerName: tester.name,
    archetype: tester.archetype,
    knowledgeLevel: tester.knowledgeLevel,
    success: true,
    playthrough: "",
    completed: false,
    difficulty: 5,
    engagement: 5,
    pacing: "unknown",
    bugs: [],
    confusionPoints: [],
    feedback: "",
    recommendation: "pass_with_changes",
    rawResponse: responseText,
  };

  // Parse playthrough
  const playthroughMatch = responseText.match(
    /##\s*Playthrough\s*([\s\S]*?)(?=##|$)/i,
  );
  if (playthroughMatch) {
    result.playthrough = playthroughMatch[1].trim();
  }

  // Parse completion
  const completionMatch = responseText.match(/\*\*Completed:\*\*\s*(YES|NO)/i);
  if (completionMatch) {
    result.completed = completionMatch[1].toUpperCase() === "YES";
  }

  // Parse difficulty (number/10 or just number)
  const difficultyMatch = responseText.match(
    /\*\*Difficulty:\*\*\s*(\d+)(?:\/10)?/i,
  );
  if (difficultyMatch) {
    result.difficulty = Math.min(10, Math.max(1, parseInt(difficultyMatch[1])));
  }

  // Parse engagement (number/10 or just number)
  const engagementMatch = responseText.match(
    /\*\*Engagement:\*\*\s*(\d+)(?:\/10)?/i,
  );
  if (engagementMatch) {
    result.engagement = Math.min(10, Math.max(1, parseInt(engagementMatch[1])));
  }

  // Parse pacing
  const pacingMatch = responseText.match(
    /\*\*Pacing:\*\*\s*(too_fast|just_right|too_slow)/i,
  );
  if (pacingMatch) {
    result.pacing = pacingMatch[1].toLowerCase() as Pacing;
  }

  // Parse bugs
  const bugsSection = responseText.match(
    /##\s*Bugs Found\s*([\s\S]*?)(?=##|$)/i,
  );
  if (bugsSection && !bugsSection[1].toLowerCase().includes("none")) {
    const bugLines = bugsSection[1]
      .split("\n")
      .filter(
        (line) => /^\d+\./.test(line.trim()) || line.trim().startsWith("-"),
      );

    result.bugs = bugLines.map((line) => {
      const cleaned = line.replace(/^\d+\.\s*|-\s*/, "").trim();
      const severityMatch = cleaned.match(
        /severity:\s*(critical|major|minor)/i,
      );

      return {
        description: cleaned,
        severity: (severityMatch
          ? severityMatch[1].toLowerCase()
          : "minor") as BugSeverity,
        reporter: tester.name,
        archetype: tester.archetype,
      };
    });
  }

  // Parse confusion points
  const confusionSection = responseText.match(
    /##\s*Confusion Points\s*([\s\S]*?)(?=##|$)/i,
  );
  if (confusionSection && !confusionSection[1].toLowerCase().includes("none")) {
    result.confusionPoints = confusionSection[1]
      .split("\n")
      .filter((line) => line.trim().startsWith("-"))
      .map((line) => line.replace(/^-\s*/, "").trim());
  }

  // Parse overall feedback
  const feedbackMatch = responseText.match(
    /##\s*Overall Feedback\s*([\s\S]*?)(?=##|$)/i,
  );
  if (feedbackMatch) {
    result.feedback = feedbackMatch[1].trim();
  }

  // Parse recommendation
  const recommendationMatch = responseText.match(
    /\*\*Recommendation:\*\*\s*(pass|pass_with_changes|fail)/i,
  );
  if (recommendationMatch) {
    result.recommendation =
      recommendationMatch[1].toLowerCase() as Recommendation;
  }

  return result;
}

/**
 * Calculate quality grade from metrics
 */
export function calculateQualityGrade(
  metrics: AggregatedMetrics,
): QualityGrade {
  let gradeScore = 100;

  // Critical bugs = instant F
  if (metrics.criticalBugs > 0) {
    return { grade: "F", score: Math.max(0, 50 - metrics.criticalBugs * 10) };
  }

  // Major bugs
  if (metrics.majorBugs > 0) {
    gradeScore -= metrics.majorBugs * 10;
  }

  // Minor bugs (less severe)
  if (metrics.minorBugs > 0) {
    gradeScore -= metrics.minorBugs * 2;
  }

  // Completion rate
  if (metrics.completionRate < 70) {
    gradeScore -= (70 - metrics.completionRate) / 2;
  }

  // Engagement
  if (metrics.averageEngagement < 5) {
    gradeScore -= (5 - metrics.averageEngagement) * 5;
  }

  // Difficulty extremes (too easy or too hard both lose points)
  const difficultyDelta = Math.abs(metrics.averageDifficulty - 5.5); // 5.5 is ideal middle
  if (difficultyDelta > 2) {
    gradeScore -= (difficultyDelta - 2) * 3;
  }

  // Convert score to letter grade
  gradeScore = Math.max(0, Math.min(100, gradeScore));

  let grade: QualityGrade["grade"];
  if (gradeScore >= 90) grade = "A";
  else if (gradeScore >= 80) grade = "B";
  else if (gradeScore >= 70) grade = "C";
  else if (gradeScore >= 60) grade = "D";
  else grade = "F";

  return { grade, score: Math.round(gradeScore) };
}

/**
 * Generate actionable recommendations
 */
export function generateRecommendations(
  aggregated: AggregatedMetrics,
): ActionableRecommendation[] {
  const recommendations: ActionableRecommendation[] = [];

  // Critical bugs block release
  if (aggregated.criticalBugs > 0) {
    recommendations.push({
      priority: "critical",
      category: "bugs",
      message: `${aggregated.criticalBugs} critical bug(s) must be fixed before release`,
      action:
        "Fix all critical bugs immediately - these prevent content from working",
    });
  }

  // Major bugs need attention
  if (aggregated.majorBugs > 0) {
    recommendations.push({
      priority: "high",
      category: "bugs",
      message: `${aggregated.majorBugs} major bug(s) should be fixed`,
      action:
        "Address major bugs - these significantly impact player experience",
    });
  }

  // Low completion rate
  if (aggregated.completionRate < 50) {
    recommendations.push({
      priority: "critical",
      category: "completion",
      message: `Only ${aggregated.completionRate.toFixed(0)}% of testers could complete content`,
      action:
        "Review quest logic, ensure all objectives are achievable, add clearer instructions",
    });
  } else if (aggregated.completionRate < 80) {
    recommendations.push({
      priority: "high",
      category: "completion",
      message: `${aggregated.completionRate.toFixed(0)}% completion rate (should be 80%+)`,
      action:
        "Improve clarity of objectives and ensure all paths are completable",
    });
  }

  // Difficulty issues
  if (aggregated.averageDifficulty < 3) {
    recommendations.push({
      priority: "medium",
      category: "difficulty",
      message: `Content is very easy (${aggregated.averageDifficulty.toFixed(1)}/10)`,
      action:
        "Consider adding more challenge, complexity, or making it early-game content",
    });
  } else if (aggregated.averageDifficulty > 8) {
    recommendations.push({
      priority: "high",
      category: "difficulty",
      message: `Content is very difficult (${aggregated.averageDifficulty.toFixed(1)}/10)`,
      action:
        "Reduce difficulty, add hints/guidance, or mark as late-game content",
    });
  }

  // Engagement issues
  if (aggregated.averageEngagement < 4) {
    recommendations.push({
      priority: "critical",
      category: "engagement",
      message: `Very low engagement score (${aggregated.averageEngagement.toFixed(1)}/10)`,
      action:
        "Major redesign needed - improve story, rewards, mechanics, or presentation",
    });
  } else if (aggregated.averageEngagement < 6) {
    recommendations.push({
      priority: "high",
      category: "engagement",
      message: `Low engagement score (${aggregated.averageEngagement.toFixed(1)}/10)`,
      action:
        "Enhance story elements, improve rewards, or add more interesting mechanics",
    });
  }

  // Pacing issues
  const totalPacing =
    aggregated.pacing.too_fast +
    aggregated.pacing.just_right +
    aggregated.pacing.too_slow;
  if (totalPacing > 0) {
    if (aggregated.pacing.too_slow > totalPacing * 0.5) {
      recommendations.push({
        priority: "medium",
        category: "pacing",
        message: "Content feels too slow for most testers",
        action:
          "Reduce travel time, streamline objectives, or add more action/variety",
      });
    } else if (aggregated.pacing.too_fast > totalPacing * 0.5) {
      recommendations.push({
        priority: "low",
        category: "pacing",
        message: "Content feels too fast for some testers",
        action: "Consider adding more story beats or moments to breathe",
      });
    }
  }

  // If no critical issues, positive reinforcement
  if (
    recommendations.length === 0 ||
    !recommendations.some(
      (r) => r.priority === "critical" || r.priority === "high",
    )
  ) {
    recommendations.push({
      priority: "info",
      category: "quality",
      message: "Content meets quality standards",
      action: "Address minor feedback and proceed to production",
    });
  }

  return recommendations;
}
