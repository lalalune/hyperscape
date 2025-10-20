import { Clock } from 'lucide-react'
import React from 'react'

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../common'

export const GenerationTimeline: React.FC = () => {
  return (
    <Card className="overflow-hidden bg-gradient-to-br from-bg-primary via-bg-primary to-primary/5 border-border-primary shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">Generation Timeline</CardTitle>
            <CardDescription className="text-xs mt-0.5">Track your generation progress</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-bg-secondary/50 rounded-lg border border-border-primary/50">
            <span className="text-sm text-text-secondary">Started</span>
            <span className="text-sm font-medium text-text-primary">
              {new Date().toLocaleTimeString()}
            </span>
          </div>
          <div className="flex justify-between items-center p-3 bg-bg-secondary/50 rounded-lg border border-border-primary/50">
            <span className="text-sm text-text-secondary">Estimated completion</span>
            <span className="text-sm font-medium text-primary">
              ~5-10 minutes
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}