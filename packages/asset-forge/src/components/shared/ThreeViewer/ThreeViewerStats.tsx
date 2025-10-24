/**
 * ThreeViewerStats Component
 * Displays model statistics overlay
 */

import React from 'react'
import { Info } from 'lucide-react'
import { formatNumber, formatFileSize } from '../../../utils/formatting'

export interface ModelInfo {
  vertices: number
  faces: number
  materials: number
  fileSize: number
}

export interface ThreeViewerStatsProps {
  modelInfo: ModelInfo
  assetInfo?: {
    name?: string
    type?: string
    tier?: string
    format?: string
  }
  show: boolean
}

export const ThreeViewerStats: React.FC<ThreeViewerStatsProps> = ({
  modelInfo,
  assetInfo,
  show
}) => {
  if (!show) return null

  return (
    <div className="absolute top-4 left-4 bg-bg-secondary bg-opacity-90 backdrop-blur-sm rounded-lg p-4 z-10 max-w-xs">
      <div className="flex items-center gap-2 mb-3">
        <Info size={16} className="text-primary" />
        <h3 className="font-semibold text-text-primary">Model Info</h3>
      </div>

      {assetInfo && (
        <div className="space-y-1 mb-3 pb-3 border-b border-border-primary">
          {assetInfo.name && (
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Name:</span>
              <span className="text-text-primary font-medium">{assetInfo.name}</span>
            </div>
          )}
          {assetInfo.type && (
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Type:</span>
              <span className="text-text-primary">{assetInfo.type}</span>
            </div>
          )}
          {assetInfo.tier && (
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Tier:</span>
              <span className="text-text-primary">{assetInfo.tier}</span>
            </div>
          )}
          {assetInfo.format && (
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Format:</span>
              <span className="text-text-primary">{assetInfo.format}</span>
            </div>
          )}
        </div>
      )}

      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Vertices:</span>
          <span className="text-text-primary font-mono">{formatNumber(modelInfo.vertices)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Faces:</span>
          <span className="text-text-primary font-mono">{formatNumber(modelInfo.faces)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Materials:</span>
          <span className="text-text-primary font-mono">{modelInfo.materials}</span>
        </div>
        {modelInfo.fileSize > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">File Size:</span>
            <span className="text-text-primary font-mono">{formatFileSize(modelInfo.fileSize)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
