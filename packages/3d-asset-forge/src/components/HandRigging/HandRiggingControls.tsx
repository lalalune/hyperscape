import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge, Checkbox } from '../common'
import { cn } from '../../styles'
import { 
  Settings, Wand2, Brain, Check, CheckCircle, 
  Sparkles, Loader2, RotateCw, X
} from 'lucide-react'
import { useHandRiggingStore } from '../../store'

interface HandRiggingControlsProps {
  onStartProcessing: () => void
}

export function HandRiggingControls({ onStartProcessing }: HandRiggingControlsProps) {
  const {
    selectedAvatar,
    processingStage,
    useSimpleMode,
    showDebugImages,
    serviceInitialized,
    error,
    setUseSimpleMode,
    toggleDebugImages,
    reset,
    canStartProcessing,
    isProcessing
  } = useHandRiggingStore()
  
  const handleReset = () => {
    reset()
  }
  
  if (!selectedAvatar) {
    return null
  }
  
  return (
    <>
      {/* Processing Controls */}
      <CardFooter className="bg-bg-secondary/50 p-4 flex gap-3">
        <Button
          variant="primary"
          onClick={onStartProcessing}
          disabled={!canStartProcessing()}
          className="flex-1 shadow-lg"
        >
          {!serviceInitialized ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Initializing...
            </>
          ) : processingStage === 'idle' ? (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Start Rigging
            </>
          ) : processingStage === 'complete' ? (
            <>
              <RotateCw className="w-4 h-4 mr-2" />
              Rig Again
            </>
          ) : (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          )}
        </Button>
        <Button
          variant="secondary"
          onClick={handleReset}
          disabled={isProcessing() && processingStage !== 'error'}
        >
          <X className="w-4 h-4" />
        </Button>
      </CardFooter>
      
      {/* Rigging Configuration Card */}
      <Card className={cn("overflow-hidden", "animate-slide-in-left")} style={{ animationDelay: '0.1s' }}>
        <CardHeader className="bg-gradient-to-r from-bg-secondary to-bg-tertiary">
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Rigging Configuration
          </CardTitle>
          <CardDescription>
            Choose your rigging method and settings
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {/* Mode Toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text-primary">Rigging Mode</label>
              <Badge 
                variant={useSimpleMode ? 'success' : 'primary'}
                className="text-xs text-white"
              >
                {useSimpleMode ? 'Simple' : 'Advanced AI'}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setUseSimpleMode(true)}
                disabled={isProcessing()}
                className={cn(
                  "relative p-4 rounded-lg border-2 transition-all duration-200",
                  "hover:scale-[1.02] hover:shadow-md",
                  useSimpleMode 
                    ? "border-primary bg-primary/10 shadow-lg" 
                    : "border-border-primary hover:border-primary/50"
                )}
              >
                <Wand2 className={cn(
                  "w-6 h-6 mx-auto mb-2",
                  useSimpleMode ? "text-primary" : "text-text-tertiary"
                )} />
                <p className="text-sm font-medium">Simple</p>
                <p className="text-xs text-text-tertiary mt-1">2 bones</p>
                {useSimpleMode && (
                  <div className="absolute -top-2 -right-2">
                    <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  </div>
                )}
              </button>
              
              <button
                onClick={() => setUseSimpleMode(false)}
                disabled={isProcessing()}
                className={cn(
                  "relative p-4 rounded-lg border-2 transition-all duration-200",
                  "hover:scale-[1.02] hover:shadow-md",
                  !useSimpleMode 
                    ? "border-primary bg-primary/10 shadow-lg" 
                    : "border-border-primary hover:border-primary/50"
                )}
              >
                <Brain className={cn(
                  "w-6 h-6 mx-auto mb-2",
                  !useSimpleMode ? "text-primary" : "text-text-tertiary"
                )} />
                <p className="text-sm font-medium">AI Mode</p>
                <p className="text-xs text-text-tertiary mt-1">Full hand</p>
                {!useSimpleMode && (
                  <div className="absolute -top-2 -right-2">
                    <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Feature List */}
          <div className="pt-4 border-t border-border-primary">
            <div className="space-y-2">
              {useSimpleMode ? (
                <>
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-success" />
                    <span className="text-text-secondary">Works with any hand pose</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-success" />
                    <span className="text-text-secondary">Fast processing (5-10 seconds)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-success" />
                    <span className="text-text-secondary">Perfect for grab animations</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-success" />
                    <span className="text-text-secondary">Individual control for each finger</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-success" />
                    <span className="text-text-secondary">AI-powered hand pose detection</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-success" />
                    <span className="text-text-secondary">Supports complex hand gestures</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-success" />
                    <span className="text-text-secondary">Best with open hands in T-pose</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Debug Options */}
          {!useSimpleMode && (
            <div className="pt-4 border-t border-border-primary">
                          <Checkbox
              checked={showDebugImages}
              onChange={toggleDebugImages}
              label="Show debug captures"
              size="sm"
            />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
} 