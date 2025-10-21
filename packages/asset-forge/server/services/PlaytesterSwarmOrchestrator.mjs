/**
 * AI Playtester Swarm Orchestrator
 *
 * Coordinates multiple AI agents acting as synthetic players to test game content.
 * Generates automated bug reports, engagement predictions, and difficulty assessments.
 *
 * Features:
 * - Synthetic players with diverse playstyles
 * - Parallel testing across agent swarm
 * - Automated bug detection and reporting
 * - Engagement and difficulty prediction
 * - Statistical correlation with human player performance
 *
 * Research Sources:
 * - arxiv.org/html/2509.22170v1 (LLM Agents for Automated Video Game Testing)
 * - arxiv.org/html/2507.09490v1 (Towards LLM-Based Automatic Playtest)
 * - arxiv.org/abs/2410.02829 (LLMs as Game Difficulty Testers)
 * - EA's Adversarial Reinforcement Learning for Procedural Content Generation
 */

import { generateText } from 'ai'
import { getModelForTask } from '../utils/ai-router.mjs'
import { makePlaytestPrompt, parseTestResult } from '../utils/playtester-prompts.mjs'

export class PlaytesterSwarmOrchestrator {
  constructor(config = {}) {
    this.testers = new Map()
    this.testResults = []
    this.aggregatedMetrics = {
      bugReports: [],
      difficultyAssessments: [],
      engagementScores: [],
      completionRates: []
    }
    this.config = {
      parallelTests: config.parallelTests || true,
      temperature: config.temperature || 0.7,
      model: config.model || null
    }
  }

  /**
   * Register a playtester agent with specific persona
   *
   * @param {Object} testerConfig - Tester configuration
   * @param {string} testerConfig.id - Unique tester ID
   * @param {string} testerConfig.name - Tester display name
   * @param {string} testerConfig.archetype - Playstyle archetype
   * @param {string} testerConfig.knowledgeLevel - Skill level (beginner/intermediate/expert)
   * @param {string} testerConfig.personality - Testing personality
   * @param {Array<string>} testerConfig.expectations - What tester looks for
   */
  registerTester(testerConfig) {
    this.testers.set(testerConfig.id, {
      ...testerConfig,
      testsCompleted: 0,
      bugsFound: 0,
      averageEngagement: 0
    })
  }

  /**
   * Run swarm playtest on content
   *
   * @param {Object} contentToTest - Quest, dialogue, or other content
   * @param {Object} testConfig - Test configuration
   * @returns {Promise<Object>} Aggregated test results
   */
  async runSwarmPlaytest(contentToTest, testConfig = {}) {
    const testers = Array.from(this.testers.values())

    if (testers.length === 0) {
      throw new Error('No testers registered. Add testers before running playtest.')
    }

    console.log(`Running swarm playtest with ${testers.length} testers...`)

    // Run tests in parallel or sequential based on config
    const testPromises = this.config.parallelTests
      ? testers.map(tester => this.runSingleTest(tester, contentToTest, testConfig))
      : await this.runSequentialTests(testers, contentToTest, testConfig)

    const results = this.config.parallelTests
      ? await Promise.allSettled(testPromises)
      : testPromises

    // Process results
    const successfulTests = results
      .filter(r => r.status === 'fulfilled' || r.value)
      .map(r => r.value || r)

    // Aggregate metrics
    const aggregated = this.aggregateTestResults(successfulTests)

    // Update tester stats
    for (const result of successfulTests) {
      const tester = this.testers.get(result.testerId)
      if (tester) {
        tester.testsCompleted++
        tester.bugsFound += result.bugs.length
        tester.averageEngagement = (
          (tester.averageEngagement * (tester.testsCompleted - 1) + result.engagement) /
          tester.testsCompleted
        )
      }
    }

    return {
      testCount: successfulTests.length,
      individualResults: successfulTests,
      aggregatedMetrics: aggregated,
      consensus: this.buildConsensus(successfulTests),
      recommendations: this.generateRecommendations(aggregated)
    }
  }

  /**
   * Run test with a single tester agent
   */
  async runSingleTest(tester, content, testConfig) {
    console.log(`[PlaytesterSwarm] [${tester.name}] Starting playtest...`)

    const testPrompt = makePlaytestPrompt(tester, content, testConfig)

    try {
      const model = getModelForTask('quest_generation', this.config.model, 'quality')

      const response = await generateText({
        model,
        prompt: testPrompt,
        temperature: this.config.temperature,
      })

      // Parse test results from response
      const testResult = parseTestResult(response.text, tester)

      console.log(`[PlaytesterSwarm] [${tester.name}] Completed. Found ${testResult.bugs.length} issues, engagement: ${testResult.engagement}/10`)

      return testResult

    } catch (error) {
      console.error(`[PlaytesterSwarm] [${tester.name}] Test failed:`, error)
      return {
        testerId: tester.id,
        testerName: tester.name,
        archetype: tester.archetype,
        knowledgeLevel: tester.knowledgeLevel,
        success: false,
        error: error.message,
        bugs: [],
        engagement: 0,
        difficulty: 0,
        completed: false,
        playthrough: '',
        confusionPoints: [],
        feedback: `Test failed: ${error.message}`,
        recommendation: 'fail',
        rawResponse: ''
      }
    }
  }

  /**
   * Run tests sequentially (for testing or low resource environments)
   */
  async runSequentialTests(testers, content, testConfig) {
    const results = []

    for (const tester of testers) {
      const result = await this.runSingleTest(tester, content, testConfig)
      results.push({ status: 'fulfilled', value: result })
    }

    return results
  }

  /**
   * Build playtest prompt for tester agent
   */
  buildPlaytestPrompt(tester, content, testConfig) {
    const archetypeInstructions = {
      completionist: 'You try to complete everything thoroughly, exploring all options and finding all secrets. You notice when content is missing or incomplete.',
      speedrunner: 'You try to complete content as quickly as possible, finding optimal paths. You notice sequence breaks and exploits.',
      explorer: 'You explore every possibility, testing boundaries and trying unexpected actions. You find edge cases and unusual interactions.',
      casual: 'You play at a relaxed pace, sometimes missing obvious hints. You notice when content is confusing or frustrating for less experienced players.',
      minmaxer: 'You analyze mechanics and optimize your approach. You notice balance issues and exploitable strategies.',
      roleplayer: 'You engage with content from a character perspective, valuing story and immersion. You notice when content breaks immersion or feels inconsistent.',
      breaker: 'You actively try to break the content, testing limits and trying to cause errors. You find bugs and edge cases.',
    }

    const knowledgeLevelContext = {
      beginner: 'You are new to this type of game and need clear guidance. You get stuck on things experienced players find obvious.',
      intermediate: 'You have moderate experience and can handle standard challenges. You notice when difficulty spikes unexpectedly.',
      expert: 'You are highly skilled and can handle complex challenges. You notice when content is too easy or lacks depth.'
    }

    return `You are ${tester.name}, an AI playtester with this profile:

ARCHETYPE: ${tester.archetype}
PLAYSTYLE: ${archetypeInstructions[tester.archetype] || archetypeInstructions.casual}

KNOWLEDGE LEVEL: ${tester.knowledgeLevel}
${knowledgeLevelContext[tester.knowledgeLevel] || knowledgeLevelContext.intermediate}

PERSONALITY: ${tester.personality}

EXPECTATIONS: ${tester.expectations.join(', ')}

CONTENT TO TEST:
${JSON.stringify(content, null, 2)}

PLAYTEST INSTRUCTIONS:
1. "Play through" this content step by step from your character's perspective
2. Try to complete the objectives as your archetype would
3. Look for:
   - Bugs: Logic errors, impossible tasks, broken triggers, unclear instructions
   - Difficulty: Rate difficulty 1-10 for your skill level
   - Engagement: Rate fun/interest 1-10
   - Pacing: Is it too fast, too slow, or just right?
   - Confusion: Any unclear or confusing elements?
   - Balance: Any exploits or unfair mechanics?

OUTPUT FORMAT:
PLAYTHROUGH: [Step-by-step description of your playthrough from your perspective]

COMPLETION: [YES/NO - could you complete it?]

DIFFICULTY: [1-10]/10 for ${tester.knowledgeLevel} player

ENGAGEMENT: [1-10]/10 - how fun/interesting was it?

PACING: [too_fast/just_right/too_slow]

BUGS FOUND:
- [Bug 1 description with severity: critical/major/minor]
- [Bug 2 description]
(or "None" if no bugs found)

CONFUSION POINTS:
- [Confusing element 1]
(or "None")

OVERALL FEEDBACK:
[2-3 sentences on overall quality and main issues]

RECOMMENDATION: [pass/pass_with_changes/fail]`
  }

  /**
   * Parse test results from tester response
   */
  parseTestResults(responseText, tester) {
    const result = {
      testerId: tester.id,
      testerName: tester.name,
      archetype: tester.archetype,
      knowledgeLevel: tester.knowledgeLevel,
      success: true,
      playthrough: '',
      completed: false,
      difficulty: 5,
      engagement: 5,
      pacing: 'unknown',
      bugs: [],
      confusionPoints: [],
      feedback: '',
      recommendation: 'pass_with_changes',
      rawResponse: responseText
    }

    // Parse playthrough
    const playthroughMatch = responseText.match(/PLAYTHROUGH:\s*([\s\S]*?)(?=\n\n|COMPLETION:|$)/i)
    if (playthroughMatch) {
      result.playthrough = playthroughMatch[1].trim()
    }

    // Parse completion
    const completionMatch = responseText.match(/COMPLETION:\s*(YES|NO)/i)
    if (completionMatch) {
      result.completed = completionMatch[1].toUpperCase() === 'YES'
    }

    // Parse difficulty
    const difficultyMatch = responseText.match(/DIFFICULTY:\s*(\d+)\/10/i)
    if (difficultyMatch) {
      result.difficulty = parseInt(difficultyMatch[1])
    }

    // Parse engagement
    const engagementMatch = responseText.match(/ENGAGEMENT:\s*(\d+)\/10/i)
    if (engagementMatch) {
      result.engagement = parseInt(engagementMatch[1])
    }

    // Parse pacing
    const pacingMatch = responseText.match(/PACING:\s*(too_fast|just_right|too_slow)/i)
    if (pacingMatch) {
      result.pacing = pacingMatch[1].toLowerCase()
    }

    // Parse bugs
    const bugsSection = responseText.match(/BUGS FOUND:\s*([\s\S]*?)(?=\n\n|CONFUSION POINTS:|$)/i)
    if (bugsSection && !bugsSection[1].includes('None')) {
      const bugLines = bugsSection[1]
        .split('\n')
        .filter(line => line.trim().startsWith('-'))

      result.bugs = bugLines.map(line => {
        const cleaned = line.replace(/^-\s*/, '').trim()
        const severityMatch = cleaned.match(/severity:\s*(critical|major|minor)/i)

        return {
          description: cleaned,
          severity: severityMatch ? severityMatch[1].toLowerCase() : 'minor',
          reporter: tester.name,
          archetype: tester.archetype
        }
      })
    }

    // Parse confusion points
    const confusionSection = responseText.match(/CONFUSION POINTS:\s*([\s\S]*?)(?=\n\n|OVERALL FEEDBACK:|$)/i)
    if (confusionSection && !confusionSection[1].includes('None')) {
      result.confusionPoints = confusionSection[1]
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim())
    }

    // Parse feedback
    const feedbackMatch = responseText.match(/OVERALL FEEDBACK:\s*([\s\S]*?)(?=\n\n|RECOMMENDATION:|$)/i)
    if (feedbackMatch) {
      result.feedback = feedbackMatch[1].trim()
    }

    // Parse recommendation
    const recommendationMatch = responseText.match(/RECOMMENDATION:\s*(pass|pass_with_changes|fail)/i)
    if (recommendationMatch) {
      result.recommendation = recommendationMatch[1].toLowerCase()
    }

    return result
  }

  /**
   * Aggregate results from multiple testers
   */
  aggregateTestResults(results) {
    const aggregated = {
      totalTests: results.length,
      completionRate: 0,
      averageDifficulty: 0,
      difficultyByLevel: {},
      averageEngagement: 0,
      engagementByArchetype: {},
      pacing: { too_fast: 0, just_right: 0, too_slow: 0, unknown: 0 },
      bugReports: [],
      uniqueBugs: 0,
      criticalBugs: 0,
      majorBugs: 0,
      minorBugs: 0,
      confusionPoints: [],
      recommendations: { pass: 0, pass_with_changes: 0, fail: 0 }
    }

    if (results.length === 0) {
      return aggregated
    }

    // Calculate completion rate
    const completed = results.filter(r => r.completed).length
    aggregated.completionRate = (completed / results.length) * 100

    // Calculate average difficulty
    const difficulties = results.map(r => r.difficulty).filter(d => d > 0)
    aggregated.averageDifficulty = difficulties.length > 0
      ? difficulties.reduce((sum, d) => sum + d, 0) / difficulties.length
      : 0

    // Difficulty by knowledge level
    for (const result of results) {
      if (!aggregated.difficultyByLevel[result.knowledgeLevel]) {
        aggregated.difficultyByLevel[result.knowledgeLevel] = []
      }
      aggregated.difficultyByLevel[result.knowledgeLevel].push(result.difficulty)
    }

    for (const level in aggregated.difficultyByLevel) {
      const scores = aggregated.difficultyByLevel[level]
      aggregated.difficultyByLevel[level] = {
        average: scores.reduce((sum, s) => sum + s, 0) / scores.length,
        count: scores.length
      }
    }

    // Calculate average engagement
    const engagements = results.map(r => r.engagement).filter(e => e > 0)
    aggregated.averageEngagement = engagements.length > 0
      ? engagements.reduce((sum, e) => sum + e, 0) / engagements.length
      : 0

    // Engagement by archetype
    for (const result of results) {
      if (!aggregated.engagementByArchetype[result.archetype]) {
        aggregated.engagementByArchetype[result.archetype] = []
      }
      aggregated.engagementByArchetype[result.archetype].push(result.engagement)
    }

    for (const archetype in aggregated.engagementByArchetype) {
      const scores = aggregated.engagementByArchetype[archetype]
      aggregated.engagementByArchetype[archetype] = {
        average: scores.reduce((sum, s) => sum + s, 0) / scores.length,
        count: scores.length
      }
    }

    // Aggregate pacing
    for (const result of results) {
      if (result.pacing in aggregated.pacing) {
        aggregated.pacing[result.pacing]++
      }
    }

    // Collect all bugs
    const allBugs = []
    for (const result of results) {
      for (const bug of result.bugs) {
        allBugs.push(bug)

        // Count by severity
        if (bug.severity === 'critical') aggregated.criticalBugs++
        else if (bug.severity === 'major') aggregated.majorBugs++
        else aggregated.minorBugs++
      }
    }

    // Deduplicate similar bugs (simple similarity check)
    aggregated.bugReports = this.deduplicateBugs(allBugs)
    aggregated.uniqueBugs = aggregated.bugReports.length

    // Collect confusion points
    for (const result of results) {
      aggregated.confusionPoints.push(...result.confusionPoints)
    }

    // Aggregate recommendations
    for (const result of results) {
      aggregated.recommendations[result.recommendation]++
    }

    return aggregated
  }

  /**
   * Deduplicate similar bug reports
   */
  deduplicateBugs(bugs) {
    const unique = []
    const seen = new Set()

    for (const bug of bugs) {
      // Simple deduplication: lowercase first 50 chars
      const key = bug.description.toLowerCase().slice(0, 50)

      if (!seen.has(key)) {
        seen.add(key)
        unique.push({
          ...bug,
          reportCount: 1,
          reporters: [bug.reporter]
        })
      } else {
        // Find existing bug and increment count
        const existing = unique.find(b =>
          b.description.toLowerCase().slice(0, 50) === key
        )
        if (existing) {
          existing.reportCount++
          if (!existing.reporters.includes(bug.reporter)) {
            existing.reporters.push(bug.reporter)
          }
          // Upgrade severity if higher
          const severityOrder = { critical: 3, major: 2, minor: 1 }
          if (severityOrder[bug.severity] > severityOrder[existing.severity]) {
            existing.severity = bug.severity
          }
        }
      }
    }

    // Sort by report count (most reported first) then severity
    unique.sort((a, b) => {
      if (b.reportCount !== a.reportCount) {
        return b.reportCount - a.reportCount
      }
      const severityOrder = { critical: 3, major: 2, minor: 1 }
      return severityOrder[b.severity] - severityOrder[a.severity]
    })

    return unique
  }

  /**
   * Build consensus summary from test results
   */
  buildConsensus(results) {
    const totalTesters = results.length
    const passRate = results.filter(r => r.recommendation === 'pass').length / totalTesters
    const failRate = results.filter(r => r.recommendation === 'fail').length / totalTesters

    let consensusRecommendation = 'pass_with_changes'
    if (passRate >= 0.7) consensusRecommendation = 'pass'
    else if (failRate >= 0.5) consensusRecommendation = 'fail'

    return {
      recommendation: consensusRecommendation,
      confidence: Math.max(passRate, failRate),
      agreement: passRate >= 0.7 || failRate >= 0.5 ? 'strong' : 'moderate',
      summary: this.generateConsensusSummary(results, consensusRecommendation)
    }
  }

  /**
   * Generate natural language consensus summary
   */
  generateConsensusSummary(results, recommendation) {
    const totalTesters = results.length
    const completed = results.filter(r => r.completed).length
    const avgDifficulty = results.reduce((sum, r) => sum + r.difficulty, 0) / totalTesters
    const avgEngagement = results.reduce((sum, r) => sum + r.engagement, 0) / totalTesters
    const totalBugs = results.reduce((sum, r) => sum + r.bugs.length, 0)

    return `${totalTesters} AI playtesters evaluated this content. ` +
      `${completed} of ${totalTesters} completed it successfully. ` +
      `Average difficulty was ${avgDifficulty.toFixed(1)}/10, ` +
      `engagement was ${avgEngagement.toFixed(1)}/10. ` +
      `${totalBugs} potential issues were reported. ` +
      `Overall recommendation: ${recommendation.toUpperCase().replace('_', ' ')}.`
  }

  /**
   * Generate actionable recommendations based on test results
   */
  generateRecommendations(aggregated) {
    const recommendations = []

    // Critical bugs block release
    if (aggregated.criticalBugs > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'bugs',
        message: `${aggregated.criticalBugs} critical bug(s) must be fixed before release`,
        action: 'Fix critical bugs immediately'
      })
    }

    // Low completion rate
    if (aggregated.completionRate < 50) {
      recommendations.push({
        priority: 'high',
        category: 'completion',
        message: `Only ${aggregated.completionRate.toFixed(0)}% of testers could complete content`,
        action: 'Review quest logic and ensure all objectives are achievable'
      })
    }

    // Difficulty issues
    if (aggregated.averageDifficulty < 3) {
      recommendations.push({
        priority: 'medium',
        category: 'difficulty',
        message: 'Content may be too easy',
        action: 'Consider adding more challenge or making it an early-game quest'
      })
    } else if (aggregated.averageDifficulty > 8) {
      recommendations.push({
        priority: 'medium',
        category: 'difficulty',
        message: 'Content is very difficult',
        action: 'Consider reducing difficulty or adding hints/guidance'
      })
    }

    // Engagement issues
    if (aggregated.averageEngagement < 5) {
      recommendations.push({
        priority: 'high',
        category: 'engagement',
        message: `Low engagement score (${aggregated.averageEngagement.toFixed(1)}/10)`,
        action: 'Improve story, rewards, or mechanics to make content more interesting'
      })
    }

    // Pacing issues
    const totalPacing = aggregated.pacing.too_fast + aggregated.pacing.just_right + aggregated.pacing.too_slow
    if (aggregated.pacing.too_slow > totalPacing * 0.5) {
      recommendations.push({
        priority: 'medium',
        category: 'pacing',
        message: 'Content feels too slow for most testers',
        action: 'Reduce travel time, simplify objectives, or add more action'
      })
    }

    // If no issues, positive reinforcement
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'info',
        category: 'quality',
        message: 'Content passed all quality checks',
        action: 'Ready for production after addressing minor feedback'
      })
    }

    return recommendations
  }

  /**
   * Get orchestrator statistics
   */
  getStats() {
    const testers = Array.from(this.testers.values())

    return {
      testerCount: testers.length,
      totalTestsRun: testers.reduce((sum, t) => sum + t.testsCompleted, 0),
      totalBugsFound: testers.reduce((sum, t) => sum + t.bugsFound, 0),
      testerBreakdown: testers.map(t => ({
        name: t.name,
        archetype: t.archetype,
        knowledgeLevel: t.knowledgeLevel,
        testsCompleted: t.testsCompleted,
        bugsFound: t.bugsFound,
        averageEngagement: t.averageEngagement.toFixed(1)
      }))
    }
  }

  /**
   * Reset orchestrator state
   */
  reset() {
    this.testResults = []
    this.aggregatedMetrics = {
      bugReports: [],
      difficultyAssessments: [],
      engagementScores: [],
      completionRates: []
    }

    // Reset tester stats
    for (const tester of this.testers.values()) {
      tester.testsCompleted = 0
      tester.bugsFound = 0
      tester.averageEngagement = 0
    }
  }
}
