/**
 * Playtester Swarm Panel
 *
 * UI for running AI playtester swarms to test game content.
 * Deploy 5-10 AI agents with different playstyles to automatically find bugs,
 * assess difficulty, predict engagement, and generate comprehensive test reports.
 */

import { Play, AlertTriangle, AlertCircle, Info, Download } from 'lucide-react'
import React, { useState } from 'react'

import { API_ENDPOINTS } from '../../config/api'
import { useContentGenerationStore } from '../../store/useContentGenerationStore'
import { useMultiAgentStore } from '../../store/useMultiAgentStore'
import type { GeneratedQuest } from '../../types/content-generation'
import type {
  TesterArchetype,
  PlaytestRequest,
  PlaytestSession,
  BugSeverity,
} from '../../types/multi-agent'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { ModelSelector } from '../common/ModelSelector'

import { TesterPersonaSelector } from './TesterPersonaSelector'

interface PlaytesterSwarmPanelProps {
  onTestComplete: (session: PlaytestSession) => void
}

const GRADE_COLORS: Record<string, string> = {
  A: 'text-green-500',
  B: 'text-blue-500',
  C: 'text-yellow-500',
  D: 'text-orange-500',
  F: 'text-red-500',
}

const SEVERITY_COLORS: Record<BugSeverity, string> = {
  critical: 'text-red-500',
  major: 'text-orange-500',
  minor: 'text-yellow-500',
}

export const PlaytesterSwarmPanel: React.FC<PlaytesterSwarmPanelProps> = ({
  onTestComplete,
}) => {
  const {
    isTesting,
    testError,
    activePlaytest,
    setTesting,
    setTestError,
    addPlaytestSession,
  } = useMultiAgentStore()

  // Selective subscription for performance
  const generatedQuests = useContentGenerationStore(state => state.quests)

  // Test Configuration
  const [selectedQuest, setSelectedQuest] = useState<GeneratedQuest | null>(null)
  const [selectedPersonas, setSelectedPersonas] = useState<TesterArchetype[]>([
    'completionist',
    'casual',
    'breaker',
    'speedrunner',
    'explorer',
  ])
  const [parallelTesting, setParallelTesting] = useState(true)
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined)

  // View State
  const [showReport, setShowReport] = useState(false)
  const [bugFilter, setBugFilter] = useState<BugSeverity | 'all'>('all')

  const handleRunTest = async () => {
    if (!selectedQuest || selectedPersonas.length === 0) {
      setTestError('Please select content to test and at least one tester')
      return
    }

    setTesting(true)
    setTestError(null)

    try {
      const request: PlaytestRequest = {
        contentToTest: {
          id: selectedQuest.id,
          title: selectedQuest.title,
          description: selectedQuest.description,
          objectives: selectedQuest.objectives.map((obj) => obj.description),
          rewards: [
            `${selectedQuest.rewards.experience} XP`,
            `${selectedQuest.rewards.gold} Gold`,
            ...(selectedQuest.rewards.items?.map(
              (item) => `${item.quantity}x ${item.itemData?.name || item.itemId}`
            ) || []),
          ],
        },
        contentType: 'quest',
        testerProfiles: selectedPersonas,
        testConfig: {
          parallel: parallelTesting,
          temperature: 0.7,
        },
        model: selectedModel,
      }

      const response = await fetch(API_ENDPOINTS.playtesterSwarm, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        let error
        try {
          error = await response.json()
        } catch {
          const errorText = await response.text()
          throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`)
        }
        throw new Error(error.details || 'Failed to run playtester swarm')
      }

      const session: PlaytestSession = await response.json()

      addPlaytestSession(session)
      onTestComplete(session)
      setShowReport(true)
    } catch (error) {
      console.error('Playtest error:', error)
      setTestError(
        error instanceof Error ? error.message : 'Failed to run playtester swarm'
      )
    } finally {
      setTesting(false)
    }
  }

  const handleExportReport = () => {
    if (!activePlaytest) return

    const blob = new Blob([JSON.stringify(activePlaytest.report, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `playtest-report-${activePlaytest.sessionId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredBugs =
    activePlaytest?.aggregatedMetrics.bugReports.filter((bug) =>
      bugFilter === 'all' ? true : bug.severity === bugFilter
    ) || []

  return (
    <div className="space-y-6">
      {/* Configuration Panel */}
      <Card className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            AI Playtester Swarm
          </h3>
          <p className="text-sm text-text-secondary">
            Deploy multiple AI agents to test your content and generate automated bug reports
          </p>
        </div>

        {/* Error Display */}
        {testError && (
          <Card className="p-4 bg-red-500 bg-opacity-10 border-red-500">
            <div className="flex items-start gap-2">
              <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-400">{testError}</div>
            </div>
          </Card>
        )}

        {/* Content Selection */}
        <div>
          <label className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2 block">
            Content to Test
          </label>

          {generatedQuests.length === 0 ? (
            <div className="text-center py-8 text-text-tertiary">
              <p className="mb-2">No quests available to test</p>
              <p className="text-xs">Generate a quest first to test it with AI playtesters</p>
            </div>
          ) : (
            <div className="space-y-2">
              {generatedQuests.map((quest) => (
                <button
                  key={quest.id}
                  onClick={() => setSelectedQuest(quest)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    selectedQuest?.id === quest.id
                      ? 'bg-primary bg-opacity-10 border-2 border-primary'
                      : 'bg-bg-tertiary border border-border-primary hover:bg-bg-primary'
                  }`}
                >
                  <div className="font-medium text-text-primary">{quest.title}</div>
                  <div className="text-xs text-text-tertiary mt-1">
                    {quest.objectives.length} objectives • {quest.difficulty} difficulty
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tester Selection */}
        <div>
          <label className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2 block">
            Select Playtesters
          </label>
          <TesterPersonaSelector
            selectedPersonas={selectedPersonas}
            onSelectionChange={setSelectedPersonas}
            minSelection={1}
          />
        </div>

        {/* Settings */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-text-secondary uppercase tracking-wide block">
            Test Settings
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={parallelTesting}
              onChange={(e) => setParallelTesting(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-text-secondary">
              Run tests in parallel (faster, uses more resources)
            </span>
          </label>

          <div>
            <label className="text-xs text-text-tertiary mb-1 block">
              AI Model (Optional)
            </label>
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
            />
          </div>
        </div>

        {/* Run Button */}
        <Button
          onClick={handleRunTest}
          disabled={isTesting || !selectedQuest || selectedPersonas.length === 0}
          variant="primary"
          className="w-full"
        >
          {isTesting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
              Running Swarm Test ({selectedPersonas.length} testers)...
            </>
          ) : (
            <>
              <Play size={16} className="mr-2" />
              Run Swarm Test ({selectedPersonas.length} testers selected)
            </>
          )}
        </Button>
      </Card>

      {/* Test Report */}
      {showReport && activePlaytest && (
        <Card className="p-6 space-y-6">
          {/* Report Header */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-1">Test Report</h3>
              <p className="text-sm text-text-tertiary">
                {activePlaytest.testCount} testers • {(activePlaytest.duration / 1000).toFixed(1)}s
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className={`text-4xl font-bold ${GRADE_COLORS[activePlaytest.report.summary.grade]}`}>
                  {activePlaytest.report.summary.grade}
                </div>
                <div className="text-xs text-text-tertiary">
                  {activePlaytest.report.summary.gradeScore}/100
                </div>
              </div>
              <Button onClick={handleExportReport} variant="ghost" size="sm">
                <Download size={16} />
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4">
              <div className="text-xs text-text-tertiary mb-1">Completion Rate</div>
              <div className="text-2xl font-bold text-text-primary">
                {activePlaytest.report.qualityMetrics.completionRate}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-text-tertiary mb-1">Difficulty</div>
              <div className="text-2xl font-bold text-text-primary">
                {activePlaytest.report.qualityMetrics.difficulty.overall}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-text-tertiary mb-1">Engagement</div>
              <div className="text-2xl font-bold text-text-primary">
                {activePlaytest.report.qualityMetrics.engagement.overall}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-text-tertiary mb-1">Total Bugs</div>
              <div className="text-2xl font-bold text-text-primary">
                {activePlaytest.report.issues.total}
              </div>
            </Card>
          </div>

          {/* Recommendation */}
          <Card
            className={`p-4 ${
              activePlaytest.report.summary.recommendation === 'pass'
                ? 'bg-green-500 bg-opacity-10 border-green-500'
                : activePlaytest.report.summary.recommendation === 'fail'
                ? 'bg-red-500 bg-opacity-10 border-red-500'
                : 'bg-yellow-500 bg-opacity-10 border-yellow-500'
            }`}
          >
            <div className="flex items-start gap-2">
              <Info size={18} className="flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold capitalize mb-1">
                  {activePlaytest.report.summary.recommendation.replace('_', ' ')}
                </div>
                <div className="text-sm">{activePlaytest.consensus.summary}</div>
              </div>
            </div>
          </Card>

          {/* Bug Reports */}
          {activePlaytest.aggregatedMetrics.bugReports.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-text-primary">
                  Bug Reports ({activePlaytest.aggregatedMetrics.bugReports.length})
                </h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBugFilter('all')}
                    className={`text-xs px-2 py-1 rounded ${
                      bugFilter === 'all'
                        ? 'bg-primary text-white'
                        : 'bg-bg-tertiary text-text-tertiary'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setBugFilter('critical')}
                    className={`text-xs px-2 py-1 rounded ${
                      bugFilter === 'critical'
                        ? 'bg-red-500 text-white'
                        : 'bg-bg-tertiary text-text-tertiary'
                    }`}
                  >
                    Critical
                  </button>
                  <button
                    onClick={() => setBugFilter('major')}
                    className={`text-xs px-2 py-1 rounded ${
                      bugFilter === 'major'
                        ? 'bg-orange-500 text-white'
                        : 'bg-bg-tertiary text-text-tertiary'
                    }`}
                  >
                    Major
                  </button>
                  <button
                    onClick={() => setBugFilter('minor')}
                    className={`text-xs px-2 py-1 rounded ${
                      bugFilter === 'minor'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-bg-tertiary text-text-tertiary'
                    }`}
                  >
                    Minor
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {filteredBugs.map((bug, idx) => (
                  <Card key={idx} className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <Badge
                        variant={bug.severity === 'critical' ? 'error' : 'secondary'}
                        className={`text-xs ${SEVERITY_COLORS[bug.severity]}`}
                      >
                        {bug.severity.toUpperCase()}
                      </Badge>
                      <div className="text-xs text-text-tertiary">
                        Reported {bug.reportCount || 1}x
                      </div>
                    </div>
                    <p className="text-sm text-text-primary mb-2">{bug.description}</p>
                    <div className="text-xs text-text-tertiary">
                      Reported by: {bug.reporters?.join(', ') || bug.reporter}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {activePlaytest.recommendations.length > 0 && (
            <div>
              <h4 className="font-semibold text-text-primary mb-3">
                Recommendations ({activePlaytest.recommendations.length})
              </h4>
              <div className="space-y-2">
                {activePlaytest.recommendations.map((rec, idx) => (
                  <Card
                    key={idx}
                    className={`p-3 border-l-4 ${
                      rec.priority === 'critical'
                        ? 'border-red-500'
                        : rec.priority === 'high'
                        ? 'border-orange-500'
                        : rec.priority === 'medium'
                        ? 'border-yellow-500'
                        : 'border-blue-500'
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-1">
                      <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium text-text-primary text-sm">
                          {rec.message}
                        </div>
                        {rec.action && (
                          <div className="text-xs text-text-tertiary mt-1">{rec.action}</div>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {rec.priority}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
