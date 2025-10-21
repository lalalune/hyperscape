/**
 * AI Playtester Swarm API Route
 *
 * Deploy multiple AI agents as synthetic players to test game content.
 * Provides automated bug detection, engagement prediction, and difficulty assessment.
 *
 * Features:
 * - Multiple AI agents with different playstyles test content in parallel
 * - Automated bug reports with severity classification
 * - Engagement prediction before human testing
 * - Difficulty measurement with statistical correlation to human performance
 * - Comprehensive test report with actionable recommendations
 *
 * Research-based implementation:
 * - LLM agents for MMORPG testing patterns
 * - Lap Framework for preprocessing game states
 * - EA's adversarial RL concepts for content testing
 * - Statistical correlation with human player difficulty assessments
 */

import { randomUUID } from 'crypto'
import { PlaytesterSwarmOrchestrator } from '../services/PlaytesterSwarmOrchestrator.mjs'

// Predefined playtester personas based on research
const PLAYTESTER_PERSONAS = {
  completionist: {
    name: 'Alex the Completionist',
    personality: 'Thorough, detail-oriented, patient. Wants to find everything and complete all optional content.',
    expectations: [
      'All objectives clearly marked',
      'Optional content is discoverable',
      'Rewards for exploration',
      'No dead ends or impossible tasks'
    ]
  },
  speedrunner: {
    name: 'Riley the Speedrunner',
    personality: 'Efficient, skilled, impatient. Looks for optimal paths and skips unnecessary content.',
    expectations: [
      'Clear critical path',
      'Minimal backtracking',
      'Efficient quest flow',
      'No forced waiting'
    ]
  },
  explorer: {
    name: 'Morgan the Explorer',
    personality: 'Curious, experimental, boundary-testing. Tries unconventional approaches and edge cases.',
    expectations: [
      'World feels responsive',
      'Creative solutions work',
      'Hidden areas are rewarded',
      'Systems handle edge cases'
    ]
  },
  casual: {
    name: 'Jordan the Casual',
    personality: 'Relaxed, easily distracted, less experienced. May miss obvious hints or skip reading.',
    expectations: [
      'Clear, simple instructions',
      'Obvious quest markers',
      'Forgiving difficulty',
      'Minimal punishment for mistakes'
    ]
  },
  minmaxer: {
    name: 'Sam the Min-Maxer',
    personality: 'Analytical, optimization-focused, mechanics-driven. Looks for exploits and imbalances.',
    expectations: [
      'Balanced rewards',
      'No exploits or cheese strategies',
      'Meaningful choices',
      'Fair difficulty curve'
    ]
  },
  roleplayer: {
    name: 'Taylor the Roleplayer',
    personality: 'Story-focused, immersion-seeking, character-driven. Values consistency and narrative.',
    expectations: [
      'Coherent story',
      'Character motivations make sense',
      'Choices matter narratively',
      'No immersion-breaking elements'
    ]
  },
  breaker: {
    name: 'Casey the Bug Hunter',
    personality: 'Adversarial, creative, boundary-testing. Actively tries to break things and find bugs.',
    expectations: [
      'Robust error handling',
      'No sequence breaks',
      'Edge cases covered',
      'Consistent logic'
    ]
  }
}

export async function POST(req, res) {
  try {
    const body = req.body
    const {
      contentToTest,
      contentType,
      testerProfiles,
      testConfig,
      model: customModel
    } = body

    // Input validation
    if (!contentToTest || typeof contentToTest !== 'object') {
      return res.status(400).json({
        error: "Invalid input: 'contentToTest' must be an object (quest, dialogue, etc.)"
      })
    }

    if (!contentType || !['quest', 'dialogue', 'npc', 'combat', 'puzzle'].includes(contentType)) {
      return res.status(400).json({
        error: "Invalid input: 'contentType' must be one of: quest, dialogue, npc, combat, puzzle"
      })
    }

    if (customModel !== undefined && typeof customModel !== 'string') {
      return res.status(400).json({
        error: "Invalid input: 'model' must be a string if provided"
      })
    }

    const sessionId = `playtest_${randomUUID()}`
    const modelIdentifier = customModel || 'default'

    // Create playtester swarm orchestrator
    const orchestrator = new PlaytesterSwarmOrchestrator({
      parallelTests: testConfig?.parallel !== false,
      temperature: testConfig?.temperature || 0.7,
      model: customModel
    })

    // Register testers based on profiles or use defaults
    const selectedProfiles = testerProfiles && testerProfiles.length > 0
      ? testerProfiles
      : ['completionist', 'casual', 'breaker', 'speedrunner', 'explorer'] // Default 5 testers

    for (const profile of selectedProfiles) {
      let testerConfig

      if (typeof profile === 'string') {
        // Use predefined persona
        const persona = PLAYTESTER_PERSONAS[profile]
        if (!persona) {
          return res.status(400).json({
            error: `Invalid tester profile: ${profile}. Must be one of: ${Object.keys(PLAYTESTER_PERSONAS).join(', ')}`
          })
        }

        testerConfig = {
          id: `tester_${randomUUID()}`,
          archetype: profile,
          knowledgeLevel: getKnowledgeLevelForArchetype(profile),
          ...persona
        }
      } else if (typeof profile === 'object') {
        // Custom tester profile
        testerConfig = {
          id: profile.id || `tester_${randomUUID()}`,
          name: profile.name,
          archetype: profile.archetype || 'casual',
          knowledgeLevel: profile.knowledgeLevel || 'intermediate',
          personality: profile.personality,
          expectations: profile.expectations || []
        }
      }

      orchestrator.registerTester(testerConfig)
    }

    console.log(`[Playtester Swarm] Starting test session ${sessionId} with ${selectedProfiles.length} testers`)

    // Run swarm playtest
    const startTime = Date.now()
    const results = await orchestrator.runSwarmPlaytest(contentToTest, testConfig)
    const duration = Date.now() - startTime

    console.log(`[Playtester Swarm] Completed in ${duration}ms. Found ${results.aggregatedMetrics.uniqueBugs} unique issues.`)

    // Get orchestrator stats
    const stats = orchestrator.getStats()

    // Build comprehensive report
    const report = buildTestReport(results, contentType, duration)

    return res.json({
      sessionId,
      contentType,
      testCount: results.testCount,
      duration,
      consensus: results.consensus,
      aggregatedMetrics: results.aggregatedMetrics,
      individualResults: results.individualResults,
      recommendations: results.recommendations,
      report,
      stats,
      metadata: {
        generatedBy: 'AI Playtester Swarm',
        model: modelIdentifier,
        timestamp: new Date().toISOString(),
        parallel: testConfig?.parallel !== false
      }
    })

  } catch (error) {
    console.error('[Playtester Swarm] Generation error:', error)
    return res.status(500).json({
      error: 'Failed to run playtester swarm',
      details: error.message
    })
  }
}

/**
 * Get appropriate knowledge level for archetype
 */
function getKnowledgeLevelForArchetype(archetype) {
  const levelMap = {
    completionist: 'intermediate',
    speedrunner: 'expert',
    explorer: 'intermediate',
    casual: 'beginner',
    minmaxer: 'expert',
    roleplayer: 'intermediate',
    breaker: 'expert'
  }

  return levelMap[archetype] || 'intermediate'
}

/**
 * Build comprehensive test report
 */
function buildTestReport(results, contentType, duration) {
  const metrics = results.aggregatedMetrics
  const consensus = results.consensus

  // Quality grade based on multiple factors
  let grade = 'A'
  let gradeScore = 100

  if (metrics.criticalBugs > 0) {
    grade = 'F'
    gradeScore = Math.max(0, gradeScore - 50)
  } else if (metrics.majorBugs > 0) {
    gradeScore -= metrics.majorBugs * 10
  }

  if (metrics.completionRate < 70) {
    gradeScore -= (70 - metrics.completionRate) / 2
  }

  if (metrics.averageEngagement < 5) {
    gradeScore -= (5 - metrics.averageEngagement) * 5
  }

  if (gradeScore >= 90) grade = 'A'
  else if (gradeScore >= 80) grade = 'B'
  else if (gradeScore >= 70) grade = 'C'
  else if (gradeScore >= 60) grade = 'D'
  else grade = 'F'

  const report = {
    summary: {
      grade,
      gradeScore: Math.round(gradeScore),
      recommendation: consensus.recommendation,
      confidence: consensus.confidence,
      readyForProduction: grade >= 'B' && metrics.criticalBugs === 0
    },

    qualityMetrics: {
      completionRate: `${metrics.completionRate.toFixed(1)}%`,
      difficulty: {
        overall: `${metrics.averageDifficulty.toFixed(1)}/10`,
        byLevel: metrics.difficultyByLevel
      },
      engagement: {
        overall: `${metrics.averageEngagement.toFixed(1)}/10`,
        byArchetype: metrics.engagementByArchetype
      },
      pacing: metrics.pacing
    },

    issues: {
      critical: metrics.criticalBugs,
      major: metrics.majorBugs,
      minor: metrics.minorBugs,
      total: metrics.uniqueBugs,
      topIssues: metrics.bugReports.slice(0, 5).map(bug => ({
        description: bug.description,
        severity: bug.severity,
        reportedBy: bug.reporters,
        reportCount: bug.reportCount
      }))
    },

    playerFeedback: {
      commonConfusions: getTopConfusionPoints(metrics.confusionPoints, 5),
      testerAgreement: consensus.agreement,
      consensusSummary: consensus.summary
    },

    recommendations: results.recommendations,

    testingDetails: {
      duration: `${(duration / 1000).toFixed(1)}s`,
      testerCount: results.testCount,
      contentType,
      timestamp: new Date().toISOString()
    }
  }

  return report
}

/**
 * Get top confusion points by frequency
 */
function getTopConfusionPoints(confusionPoints, limit = 5) {
  if (confusionPoints.length === 0) {
    return []
  }

  // Count frequency of similar confusion points
  const frequencyMap = new Map()

  for (const point of confusionPoints) {
    // Simple grouping by first 50 characters
    const key = point.toLowerCase().slice(0, 50)
    if (frequencyMap.has(key)) {
      frequencyMap.get(key).count++
    } else {
      frequencyMap.set(key, { text: point, count: 1 })
    }
  }

  // Sort by frequency and return top N
  return Array.from(frequencyMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(item => ({
      confusion: item.text,
      reportCount: item.count
    }))
}

/**
 * GET endpoint to retrieve predefined tester personas
 */
export async function GET(req, res) {
  return res.json({
    availablePersonas: Object.keys(PLAYTESTER_PERSONAS),
    personas: PLAYTESTER_PERSONAS,
    defaultSwarm: ['completionist', 'casual', 'breaker', 'speedrunner', 'explorer'],
    description: 'Predefined AI playtester personas based on common player archetypes'
  })
}
