import React from 'react'
import { cn } from '../../styles'

// Input Component
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error = false, ...props }, ref) => {
    return (
      <input
        className={cn(
          'input',
          error && 'input-error',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'

// Textarea Component
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error = false, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'input min-h-[80px] resize-y',
          error && 'input-error',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

Textarea.displayName = 'Textarea'

// Select Component
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error = false, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          'input',
          error && 'input-error',
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    )
  }
)

Select.displayName = 'Select'

// Label Component
export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required = false, children, ...props }, ref) => {
    return (
      <label
        className={cn('label', className)}
        ref={ref}
        {...props}
      >
        {children}
        {required && <span className="text-error ml-1">*</span>}
      </label>
    )
  }
)

Label.displayName = 'Label'

// Helper Text Component
export interface HelperTextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  error?: boolean
}

const HelperText = React.forwardRef<HTMLParagraphElement, HelperTextProps>(
  ({ className, error = false, ...props }, ref) => {
    return (
      <p
        className={cn(
          error ? 'error-text' : 'helper-text',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

HelperText.displayName = 'HelperText'

// Form Field Component (combines label, input, and helper text)
export interface FormFieldProps {
  label?: string
  error?: string
  helperText?: string
  required?: boolean
  children: React.ReactElement<{ error?: boolean; id?: string }>
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  helperText,
  required = false,
  children
}) => {
  const childWithError = React.cloneElement(children, { error: !!error })
  
  return (
    <div className="stack gap-1">
      {label && (
        <Label htmlFor={children.props.id} required={required}>
          {label}
        </Label>
      )}
      {childWithError}
      {(error || helperText) && (
        <HelperText error={!!error}>
          {error || helperText}
        </HelperText>
      )}
    </div>
  )
}

export { Input, Textarea, Select, Label, HelperText, FormField }