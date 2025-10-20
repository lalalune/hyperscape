import { Package } from 'lucide-react'
import React from 'react'

export const EmptyAssetState: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full bg-gradient-to-br from-bg-primary to-bg-secondary">
      <div className="text-center p-8 animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 bg-primary opacity-20 blur-3xl animate-pulse" />
          <Package size={80} className="text-text-muted mb-6 mx-auto relative z-10 animate-float" />
        </div>
        <h3 className="text-2xl font-semibold text-text-primary mb-2">No model loaded</h3>
        <p className="text-text-tertiary text-lg max-w-md mx-auto">
          Select an asset to begin
        </p>
      </div>
    </div>
  )
} 