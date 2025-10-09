import React from 'react'
import { Card } from '../common'
import { cn } from '../../styles'
import { Grid3X3, Layers, Palette } from 'lucide-react'

interface ModelStatsProps {
  modelInfo: {
    vertices: number
    faces: number
    materials: number
  } | null
}

export const ModelStats: React.FC<ModelStatsProps> = ({ modelInfo }) => {
  if (!modelInfo) return null
  
  return (
    <div className="grid grid-cols-3 gap-4">
      <Card className={cn("p-4", "animate-fade-in")}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-text-primary">
              {modelInfo.vertices.toLocaleString()}
            </p>
            <p className="text-sm text-text-secondary">Vertices</p>
          </div>
          <Grid3X3 className="w-8 h-8 text-primary/20" />
        </div>
      </Card>
      <Card className={cn("p-4", "animate-fade-in")} style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-text-primary">
              {modelInfo.faces.toLocaleString()}
            </p>
            <p className="text-sm text-text-secondary">Faces</p>
          </div>
          <Layers className="w-8 h-8 text-primary/20" />
        </div>
      </Card>
      <Card className={cn("p-4", "animate-fade-in")} style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-text-primary">
              {modelInfo.materials}
            </p>
            <p className="text-sm text-text-secondary">Materials</p>
          </div>
          <Palette className="w-8 h-8 text-primary/20" />
        </div>
      </Card>
    </div>
  )
} 