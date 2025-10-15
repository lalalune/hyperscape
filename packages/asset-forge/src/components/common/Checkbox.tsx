import React, { forwardRef } from 'react'
import { cn } from '../../styles'
import { Check } from 'lucide-react'

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: React.ReactNode
  description?: string
  error?: string
  size?: 'sm' | 'md' | 'lg'
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ 
    className, 
    label,
    description,
    error,
    size = 'md',
    disabled,
    id,
    ...props 
  }, ref) => {
    
    const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`
    
    const sizes = {
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-6 h-6'
    }
    
    const iconSizes = {
      sm: 12,
      md: 14,
      lg: 16
    }
    
    const content = (
      <>
        <div className={cn(
          "relative flex items-center",
          label && "mt-0.5" // Small offset to align with text baseline when there's a label
        )}>
          <input
            id={checkboxId}
            type="checkbox"
            className="sr-only"
            ref={ref}
            disabled={disabled}
            {...props}
          />
          <div className={cn(
            "flex items-center justify-center rounded-sm border-2 transition-all duration-200",
            sizes[size],
            "bg-bg-secondary",
            props.checked 
              ? "border-primary bg-primary" 
              : "border-border-secondary hover:border-border-hover",
            disabled && "opacity-50 cursor-not-allowed",
            !disabled && !props.checked && "hover:bg-bg-tertiary",
            error && "border-error",
            className
          )}>
            {props.checked && (
              <Check 
                size={iconSizes[size]} 
                className="text-white animate-scale-in"
                strokeWidth={3}
              />
            )}
          </div>
        </div>
        
        {(label || description || error) && (
          <div className="flex-1">
            {label && (
              <div className={cn(
                "text-text-primary transition-colors",
                size === 'sm' && "text-sm",
                size === 'md' && "text-base",
                size === 'lg' && "text-lg",
                disabled && "opacity-50",
                !disabled && "group-hover:text-primary"
              )}>
                {label}
              </div>
            )}
            {description && (
              <p className={cn(
                "text-text-tertiary mt-0.5",
                size === 'sm' && "text-xs",
                size === 'md' && "text-sm",
                size === 'lg' && "text-base"
              )}>
                {description}
              </p>
            )}
            {error && (
              <p className={cn(
                "text-error mt-1",
                size === 'sm' && "text-xs",
                size === 'md' && "text-sm",
                size === 'lg' && "text-base"
              )}>
                {error}
              </p>
            )}
          </div>
        )}
      </>
    )
    
    // If there's a label, wrap in a label element
    if (label || description) {
      return (
        <label 
          htmlFor={checkboxId}
          className={cn(
            "flex items-start gap-3 cursor-pointer group",
            disabled && "cursor-not-allowed"
          )}
        >
          {content}
        </label>
      )
    }
    
    // Otherwise, just return the checkbox
    return content
  }
)

Checkbox.displayName = 'Checkbox'

export { Checkbox }