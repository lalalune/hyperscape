import React from 'react'
import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  iconSize?: number
  className?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  icon: Icon, 
  title, 
  description, 
  iconSize = 80,
  className = ''
}) => {
  return (
    <div className={`text-center p-8 ${className}`}>
      <div className="relative">
        <div className="absolute inset-0 bg-primary opacity-20 blur-3xl animate-pulse" />
        <Icon size={iconSize} className="text-text-muted mb-6 mx-auto relative z-10 animate-float" />
      </div>
      <h3 className="text-2xl font-semibold text-text-primary mb-2">{title}</h3>
      <p className="text-text-tertiary text-lg max-w-md mx-auto">
        {description}
      </p>
    </div>
  )
}

export default EmptyState 