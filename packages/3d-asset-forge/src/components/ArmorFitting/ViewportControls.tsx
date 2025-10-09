import React from 'react'
import { Grid3X3, Camera } from 'lucide-react'
import { cn } from '../../styles'

interface ViewportControlsProps {
  showWireframe: boolean
  onToggleWireframe: () => void
  onResetCamera: () => void
}

export const ViewportControls: React.FC<ViewportControlsProps> = ({
  showWireframe,
  onToggleWireframe,
  onResetCamera
}) => {
  return (
    <div className="absolute top-4 right-4 flex flex-col gap-2">
      <button
        onClick={onToggleWireframe}
        className={cn(
          "p-2 rounded-lg backdrop-blur-sm transition-all",
          showWireframe
            ? "bg-primary/20 text-primary"
            : "bg-bg-tertiary/50 text-text-secondary hover:text-text-primary"
        )}
        title="Toggle wireframe"
      >
        <Grid3X3 size={18} />
      </button>
      <button
        onClick={onResetCamera}
        className="p-2 rounded-lg bg-bg-tertiary/50 text-text-secondary hover:text-text-primary backdrop-blur-sm transition-all"
        title="Reset camera"
      >
        <Camera size={18} />
      </button>
    </div>
  )
}

export default ViewportControls 