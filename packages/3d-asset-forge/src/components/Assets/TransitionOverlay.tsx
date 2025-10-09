import React from 'react'
import { Activity } from 'lucide-react'

export const TransitionOverlay: React.FC = () => {
  return (
    <div className="absolute inset-0 bg-bg-primary bg-opacity-50 flex items-center justify-center z-10">
      <div className="text-center">
        <Activity className="w-12 h-12 text-primary animate-pulse mb-2 mx-auto" />
        <p className="text-text-secondary">Loading asset...</p>
      </div>
    </div>
  )
} 