import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge, Progress } from '../common'
import { CheckCircle, Loader2, XCircle, Sparkles, ChevronRight, Zap, FileText, Brain, Camera, Box, User, Layers, Grid3x3 } from 'lucide-react'
import { cn } from '../../styles'
import { PipelineStage } from '../../store'

interface PipelineProgressCardProps {
  pipelineStages: PipelineStage[]
  generationType: 'item' | 'avatar' | undefined
  isGenerating: boolean
  onBackToConfig: () => void
  onBack: () => void
}

export const PipelineProgressCard: React.FC<PipelineProgressCardProps> = ({
  pipelineStages,
  generationType,
  isGenerating,
  onBackToConfig,
  onBack
}) => {
  const filteredStages = pipelineStages.filter(stage => {
    // Hide material variants and sprites for avatar generation
    if (generationType === 'avatar') {
      return stage.id !== 'retexturing' && stage.id !== 'sprites'
    }
    return true
  })

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-bg-primary via-bg-primary to-primary/5 border-border-primary shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Generation Pipeline</CardTitle>
              <CardDescription className="text-xs mt-0.5">Tracking your asset creation progress</CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-text-secondary hover:text-text-primary"
            title="Back to generation type selection"
          >
            <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
            Back
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="space-y-4">
          {filteredStages.map((stage, index) => (
            <PipelineStageItem
              key={stage.id}
              stage={stage}
              isLast={index === filteredStages.length - 1}
            />
          ))}
        </div>
        
        <div className="mt-8 flex justify-center">
          <Button 
            variant="secondary" 
            onClick={onBackToConfig}
            disabled={isGenerating}
            size="lg"
            className="shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
          >
            Back to Configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Helper function to get icon for stage
const getStageIcon = (stageId: string) => {
  switch (stageId) {
    case 'text-input':
      return <FileText className="w-4 h-4" />
    case 'gpt4-enhancement':
      return <Brain className="w-4 h-4" />
    case 'image-generation':
      return <Camera className="w-4 h-4" />
    case 'image-to-3d':
      return <Box className="w-4 h-4" />
    case 'rigging':
      return <User className="w-4 h-4" />
    case 'retexturing':
      return <Layers className="w-4 h-4" />
    case 'sprites':
      return <Grid3x3 className="w-4 h-4" />
    default:
      return <Sparkles className="w-4 h-4" />
  }
}

// Sub-component for individual pipeline stage
const PipelineStageItem: React.FC<{
  stage: PipelineStage
  isLast: boolean
}> = ({ stage, isLast }) => {
  const isActive = stage.status === 'active'
  const isComplete = stage.status === 'completed'
  const isFailed = stage.status === 'failed'
  const isSkipped = stage.status === 'skipped'

  return (
    <div className="relative">
      <div className={cn(
        "flex items-center gap-4 p-4 rounded-xl border transition-all duration-200",
        isActive && "border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 shadow-sm",
        isComplete && "border-success/30 bg-gradient-to-r from-success/5 to-success/10",
        isFailed && "border-error/30 bg-gradient-to-r from-error/5 to-error/10",
        isSkipped && "opacity-50 border-border-secondary bg-bg-secondary/30",
        !isActive && !isComplete && !isFailed && !isSkipped && "border-border-primary bg-bg-secondary/50 hover:border-border-secondary"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2.5 rounded-xl transition-all",
            isActive && "bg-primary/10 animate-pulse",
            isComplete && "bg-success/10",
            isFailed && "bg-error/10",
            isSkipped && "bg-bg-tertiary/50",
            !isActive && !isComplete && !isFailed && !isSkipped && "bg-bg-tertiary/50"
          )}>
            {isActive ? (
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            ) : isComplete ? (
              <CheckCircle className="w-5 h-5 text-success" />
            ) : isFailed ? (
              <XCircle className="w-5 h-5 text-error" />
            ) : (
              <div className={cn(
                isSkipped ? "text-text-muted" : "text-text-secondary"
              )}>
                {stage.icon || getStageIcon(stage.id)}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex-1">
          <h4 className="font-medium text-text-primary">{stage.name}</h4>
          <p className="text-xs text-text-secondary mt-0.5">{stage.description}</p>
        </div>
        
        {isActive && (
          <div className="flex items-center gap-2">
            <Progress value={50} className="w-24 h-1.5" />
            <span className="text-xs font-medium text-primary animate-pulse">
              Processing...
            </span>
          </div>
        )}
        
        {isComplete && (
          <Badge variant="success" className="text-xs">
            Complete
          </Badge>
        )}
        
        {isFailed && (
          <Badge variant="error" className="text-xs">
            Failed
          </Badge>
        )}
      </div>
      
      {!isLast && (
        <div className={cn(
          "absolute left-8 top-full w-0.5 h-4 -translate-x-1/2 transition-all",
          (isComplete || isActive) ? "bg-primary/30" : "bg-border-primary/30"
        )} />
      )}
    </div>
  )
}

export default PipelineProgressCard