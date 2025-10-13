import React from 'react'

export const LoadingState: React.FC = () => {
  return (
    <div className="loading-state">
      <div className="text-center animate-fade-in">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4 mx-auto" />
        <p className="text-text-secondary text-lg">Loading assets...</p>
      </div>
    </div>
  )
} 