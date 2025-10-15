import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common'
import { cn } from '../../styles'
import { CheckCircle, AlertCircle, Search, Camera, Wand2, Activity, Layers } from 'lucide-react'
import { useHandRiggingStore } from '../../store'

export function HandProcessingSteps() {
  const {
    processingStage,
    selectedFile,
    useSimpleMode,
    getProcessingSteps
  } = useHandRiggingStore()
  
  // Don't show if no file is selected or processing hasn't started
  if (!selectedFile || processingStage === 'idle') {
    return null
  }
  
  // Get processing steps with icons
  const processingSteps = getProcessingSteps(useSimpleMode).map(step => ({
    ...step,
    icon: step.id === 'detecting-wrists' ? <Search className="w-4 h-4" /> :
          step.id === 'creating-bones' ? (useSimpleMode ? <Wand2 className="w-4 h-4" /> : <Camera className="w-4 h-4" />) :
          <Activity className="w-4 h-4" />
  }))
  
  return (
    <Card className={cn("overflow-hidden animate-slide-in-left [animation-delay:0.2s]")}>
      <CardHeader className="bg-gradient-to-r from-bg-secondary to-bg-tertiary">
        <CardTitle className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          Processing Pipeline
        </CardTitle>
        <CardDescription>
          Real-time progress tracking
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {processingSteps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "relative flex items-center gap-4 p-4 rounded-lg transition-all duration-500",
                step.status === 'active' && "bg-primary/10 shadow-lg scale-[1.02]",
                step.status === 'complete' && "opacity-75",
                step.status === 'error' && "bg-error/10",
                "animate-fade-in"
              )}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Step Icon */}
              <div className={cn(
                "relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300",
                step.status === 'pending' && "bg-bg-tertiary text-text-tertiary",
                step.status === 'active' && "bg-primary text-white shadow-lg animate-pulse",
                step.status === 'complete' && "bg-success text-white",
                step.status === 'error' && "bg-error text-white"
              )}>
                {step.status === 'complete' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : step.status === 'error' ? (
                  <AlertCircle className="w-5 h-5" />
                ) : step.status === 'active' ? (
                  <div className="relative">
                    {step.icon}
                    <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75"></div>
                  </div>
                ) : (
                  step.icon
                )}
              </div>
              
              {/* Step Content */}
              <div className="flex-1">
                <p className={cn(
                  "font-medium text-sm transition-colors",
                  step.status === 'active' ? "text-primary" : "text-text-primary"
                )}>
                  {step.name}
                </p>
                <p className="text-xs text-text-tertiary mt-0.5">
                  {step.description}
                </p>
              </div>
              
              {/* Progress Indicator */}
              {step.status === 'active' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-bg-tertiary rounded-full overflow-hidden">
                  <div className="h-full bg-primary animate-progress rounded-full"></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Add custom animation styles if not already present
const style = document.createElement('style')
style.textContent = `
  @keyframes progress {
    0% { width: 0%; }
    100% { width: 100%; }
  }
  
  .animate-progress {
    animation: progress 2s ease-in-out infinite;
  }
`
// Only add if not already present
if (!document.head.querySelector('style[data-hand-rigging-animations]')) {
  style.setAttribute('data-hand-rigging-animations', 'true')
  document.head.appendChild(style)
} 