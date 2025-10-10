import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../common'
import { cn } from '../../styles'
import { CheckCircle } from 'lucide-react'
import type { HandRiggingResult } from '../../services/hand-rigging/HandRiggingService'
import type { SimpleHandRiggingResult } from '../../services/hand-rigging/SimpleHandRiggingService'

interface RiggingResultsProps {
  riggingResult: HandRiggingResult | SimpleHandRiggingResult | null
}

export const RiggingResults: React.FC<RiggingResultsProps> = ({ riggingResult }) => {
  if (!riggingResult) return null
  
  return (
    <Card className={cn("overflow-hidden", "animate-slide-in-up")}>
      <CardHeader className="bg-gradient-to-r from-success/10 to-success/5 border-b border-success/20">
        <CardTitle className="flex items-center gap-2 text-success">
          <CheckCircle className="w-5 h-5" />
          Rigging Complete!
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-text-primary">
              {riggingResult.metadata.originalBoneCount}
            </p>
            <p className="text-sm text-text-secondary mt-1">Original Bones</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-success">
              +{riggingResult.metadata.addedBoneCount}
            </p>
            <p className="text-sm text-text-secondary mt-1">Added Bones</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-text-primary">
              {riggingResult.metadata.originalBoneCount + riggingResult.metadata.addedBoneCount}
            </p>
            <p className="text-sm text-text-secondary mt-1">Total Bones</p>
          </div>
        </div>
        {'processingTime' in riggingResult.metadata && (
          <div className="mt-6 pt-6 border-t border-border-primary text-center">
            <p className="text-sm text-text-secondary">
              Processing completed in{' '}
              <span className="font-semibold text-text-primary">
                {(riggingResult.metadata.processingTime / 1000).toFixed(1)}s
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 