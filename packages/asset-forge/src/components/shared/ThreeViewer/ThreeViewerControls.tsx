/**
 * ThreeViewerControls Component
 * UI controls for ThreeViewer (grid, bounds, rotation, etc.)
 */

import React from 'react'
import { Grid3X3, Box, RotateCw, Download, Keyboard, Eye, Activity } from 'lucide-react'
import { Button } from '../../common'

export interface ThreeViewerControlsProps {
  showGrid: boolean
  showBounds: boolean
  showStats: boolean
  showSkeleton: boolean
  autoRotate: boolean
  hasRiggedModel: boolean
  onToggleGrid: () => void
  onToggleBounds: () => void
  onToggleStats: () => void
  onToggleSkeleton: () => void
  onToggleAutoRotate: () => void
  onResetCamera: () => void
  onTakeScreenshot: () => void
  onShowShortcuts: () => void
  lightMode?: boolean
}

export const ThreeViewerControls: React.FC<ThreeViewerControlsProps> = ({
  showGrid,
  showBounds,
  showStats,
  showSkeleton,
  autoRotate,
  hasRiggedModel,
  onToggleGrid,
  onToggleBounds,
  onToggleStats,
  onToggleSkeleton,
  onToggleAutoRotate,
  onResetCamera,
  onTakeScreenshot,
  onShowShortcuts,
  lightMode = false
}) => {
  return (
    <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
      {/* Grid Toggle */}
      {!lightMode && (
        <Button
          onClick={onToggleGrid}
          variant={showGrid ? 'primary' : 'ghost'}
          size="sm"
          title="Toggle Grid (G)"
        >
          <Grid3X3 size={16} />
        </Button>
      )}

      {/* Bounds Toggle */}
      {!lightMode && (
        <Button
          onClick={onToggleBounds}
          variant={showBounds ? 'primary' : 'ghost'}
          size="sm"
          title="Toggle Bounding Box (B)"
        >
          <Box size={16} />
        </Button>
      )}

      {/* Stats Toggle */}
      {!lightMode && (
        <Button
          onClick={onToggleStats}
          variant={showStats ? 'primary' : 'ghost'}
          size="sm"
          title="Toggle Stats (I)"
        >
          <Activity size={16} />
        </Button>
      )}

      {/* Skeleton Toggle (only for rigged models) */}
      {hasRiggedModel && !lightMode && (
        <Button
          onClick={onToggleSkeleton}
          variant={showSkeleton ? 'primary' : 'ghost'}
          size="sm"
          title="Toggle Skeleton (K)"
        >
          <Eye size={16} />
        </Button>
      )}

      {/* Auto Rotate Toggle */}
      <Button
        onClick={onToggleAutoRotate}
        variant={autoRotate ? 'primary' : 'ghost'}
        size="sm"
        title="Toggle Auto Rotate (R)"
      >
        <RotateCw size={16} />
      </Button>

      {/* Reset Camera */}
      <Button onClick={onResetCamera} variant="ghost" size="sm" title="Reset Camera (Space)">
        <RotateCw size={16} />
      </Button>

      {/* Take Screenshot */}
      {!lightMode && (
        <Button onClick={onTakeScreenshot} variant="ghost" size="sm" title="Take Screenshot (S)">
          <Download size={16} />
        </Button>
      )}

      {/* Show Shortcuts */}
      <Button onClick={onShowShortcuts} variant="ghost" size="sm" title="Show Shortcuts (?)">
        <Keyboard size={16} />
      </Button>
    </div>
  )
}
