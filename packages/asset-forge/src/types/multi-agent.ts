/**
 * Multi-Agent AI Systems Types
 *
 * Type definitions for NPC Collaboration and Playtester Swarm features.
 */

import type { GeneratedQuest, LoreEntry } from './content-generation'

// ============================================================================
// NPC Collaboration Types
// ============================================================================

export type CollaborationType = 'dialogue' | 'quest' | 'lore' | 'relationship' | 'freeform'

export interface NPCPersona {
  id?: string
  name: string
  personality: string
  archetype?: string
  goals?: string[]
  background?: string
  specialties?: string[]
  relationships?: Record<string, string>
}

export interface CollaborationContext {
  location?: string
  situation?: string
  questSeed?: string
  quests?: GeneratedQuest[]
  relationships?: EmergentRelationship[]
  lore?: LoreEntry[]
  description?: string
}

export interface ConversationRound {
  round: number
  agentId: string
  agentName: string
  content: string
  timestamp: number
}

export interface EmergentRelationship {
  agents: string[]
  type: string
  interactionCount: number
  sentiment?: {
    positive: number
    neutral: number
    negative: number
  }
}

export interface EmergentContent {
  relationships: EmergentRelationship[]
  questIdeas?: GeneratedQuest[]
  loreFragments?: LoreEntry[]
  dialogueSnippets?: Array<{
    agent: string
    samples: string[]
  }>
  structuredOutput?: Record<string, unknown>
}

export interface ValidationDetail {
  validator: string
  score: number
  feedback: string
}

export interface ValidationResult {
  validated: boolean
  confidence: number
  scores?: {
    consistency: number
    authenticity: number
    quality: number
  }
  validatorCount?: number
  details?: ValidationDetail[]
  note?: string
}

export interface CollaborationSession {
  sessionId: string
  collaborationType: CollaborationType
  npcCount: number
  rounds: number
  conversation: ConversationRound[]
  emergentContent: EmergentContent
  validation?: ValidationResult
  stats: {
    agentCount: number
    totalMessages: number
    agentActivity: Array<{
      id: string
      name: string
      messageCount: number
      lastActive: number | null
    }>
  }
  metadata: {
    generatedBy: string
    model: string
    timestamp: string
    crossValidated: boolean
  }
}

export interface CollaborationRequest {
  npcPersonas: NPCPersona[]
  collaborationType: CollaborationType
  context?: CollaborationContext
  rounds?: number
  model?: string
  enableCrossValidation?: boolean
}

// ============================================================================
// Playtester Swarm Types
// ============================================================================

export type TesterArchetype =
  | 'completionist'
  | 'speedrunner'
  | 'explorer'
  | 'casual'
  | 'minmaxer'
  | 'roleplayer'
  | 'breaker'

export type KnowledgeLevel = 'beginner' | 'intermediate' | 'expert'

export type TestRecommendation = 'pass' | 'pass_with_changes' | 'fail'

export type BugSeverity = 'critical' | 'major' | 'minor'

export type PacingRating = 'too_fast' | 'just_right' | 'too_slow' | 'unknown'

export interface TesterProfile {
  id?: string
  name: string
  archetype: TesterArchetype
  knowledgeLevel: KnowledgeLevel
  personality: string
  expectations: string[]
}

export interface TesterPersona extends TesterProfile {
  // Predefined persona data from server
}

export interface BugReport {
  description: string
  severity: BugSeverity
  reporter: string
  archetype: TesterArchetype
  reportCount?: number
  reporters?: string[]
}

export interface IndividualTestResult {
  testerId: string
  testerName: string
  archetype: TesterArchetype
  knowledgeLevel: KnowledgeLevel
  success: boolean
  playthrough: string
  completed: boolean
  difficulty: number // 1-10
  engagement: number // 1-10
  pacing: PacingRating
  bugs: BugReport[]
  confusionPoints: string[]
  feedback: string
  recommendation: TestRecommendation
  rawResponse?: string
  error?: string
}

export interface AggregatedMetrics {
  totalTests: number
  completionRate: number // percentage
  averageDifficulty: number // 1-10
  difficultyByLevel: Record<
    KnowledgeLevel,
    {
      average: number
      count: number
    }
  >
  averageEngagement: number // 1-10
  engagementByArchetype: Record<
    string,
    {
      average: number
      count: number
    }
  >
  pacing: Record<PacingRating, number>
  bugReports: BugReport[]
  uniqueBugs: number
  criticalBugs: number
  majorBugs: number
  minorBugs: number
  confusionPoints: string[]
  recommendations: Record<TestRecommendation, number>
}

export interface TestConsensus {
  recommendation: TestRecommendation
  confidence: number // 0-1
  agreement: 'strong' | 'moderate'
  summary: string
}

export interface TestReportSummary {
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  gradeScore: number // 0-100
  recommendation: TestRecommendation
  confidence: number
  readyForProduction: boolean
}

export interface TestReport {
  summary: TestReportSummary
  qualityMetrics: {
    completionRate: string
    difficulty: {
      overall: string
      byLevel: Record<
        KnowledgeLevel,
        {
          average: number
          count: number
        }
      >
    }
    engagement: {
      overall: string
      byArchetype: Record<
        string,
        {
          average: number
          count: number
        }
      >
    }
    pacing: Record<PacingRating, number>
  }
  issues: {
    critical: number
    major: number
    minor: number
    total: number
    topIssues: Array<{
      description: string
      severity: BugSeverity
      reportedBy: string[]
      reportCount: number
    }>
  }
  playerFeedback: {
    commonConfusions: Array<{
      confusion: string
      reportCount: number
    }>
    testerAgreement: 'strong' | 'moderate'
    consensusSummary: string
  }
  recommendations: Array<{
    priority: 'critical' | 'high' | 'medium' | 'info'
    category: string
    message: string
    action?: string
  }>
  testingDetails?: {
    duration: string
    testerCount: number
    contentType: string
    timestamp: string
  }
}

export interface PlaytestSession {
  sessionId: string
  contentType: 'quest' | 'dialogue' | 'npc' | 'combat' | 'puzzle'
  testCount: number
  duration: number
  consensus: TestConsensus
  aggregatedMetrics: AggregatedMetrics
  individualResults: IndividualTestResult[]
  recommendations: Array<{
    priority: 'critical' | 'high' | 'medium' | 'info'
    category: string
    message: string
    action?: string
  }>
  report: TestReport
  stats: {
    testerCount: number
    totalTestsRun: number
    totalBugsFound: number
  }
  metadata: {
    generatedBy: string
    model: string
    timestamp: string
    parallel: boolean
  }
}

export interface PlaytestRequest {
  contentToTest: {
    id?: string
    title: string
    description?: string
    objectives?: string[]
    rewards?: string[]
  } & Record<string, unknown>
  contentType: 'quest' | 'dialogue' | 'npc' | 'combat' | 'puzzle'
  testerProfiles: Array<TesterArchetype | TesterProfile>
  testConfig?: {
    parallel?: boolean
    temperature?: number
  }
  model?: string
}

export interface PlaytesterPersonasResponse {
  availablePersonas: TesterArchetype[]
  personas: Record<TesterArchetype, TesterPersona>
  defaultSwarm: TesterArchetype[]
  description: string
}
