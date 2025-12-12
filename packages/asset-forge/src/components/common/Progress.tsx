import React from "react";

import { cn } from "../../styles";

// Linear Progress Component
export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  variant?: "primary" | "success" | "warning" | "error";
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  animated?: boolean;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      className,
      value,
      max = 100,
      variant = "primary",
      size = "md",
      showLabel = false,
      animated = false,
      ...props
    },
    ref,
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    const variants = {
      primary: "bg-gradient-to-r from-primary to-primary-light",
      success: "bg-gradient-to-r from-success to-success-light",
      warning: "bg-gradient-to-r from-warning to-warning-light",
      error: "bg-gradient-to-r from-error to-error-light",
    };

    const sizes = {
      sm: "h-1",
      md: "h-2",
      lg: "h-3",
    };

    return (
      <div className={cn("space-y-1", className)} {...props}>
        {showLabel && (
          <div className="flex justify-between text-xs text-text-secondary">
            <span>Progress</span>
            <span>{Math.round(percentage)}%</span>
          </div>
        )}
        <div
          ref={ref}
          className={cn(
            "w-full bg-bg-tertiary rounded-full overflow-hidden",
            sizes[size],
          )}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        >
          <div
            className={cn(
              "h-full transition-all duration-300 ease-out",
              variants[variant],
              animated && "animate-pulse",
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  },
);

Progress.displayName = "Progress";

// Circular Progress Component
export interface CircularProgressProps extends React.SVGAttributes<SVGSVGElement> {
  value?: number;
  size?: number;
  strokeWidth?: number;
  variant?: "primary" | "success" | "warning" | "error";
  showLabel?: boolean;
  indeterminate?: boolean;
}

const CircularProgress = React.forwardRef<SVGSVGElement, CircularProgressProps>(
  (
    {
      className,
      value = 0,
      size = 48,
      strokeWidth = 4,
      variant = "primary",
      showLabel = false,
      indeterminate = false,
      ...props
    },
    ref,
  ) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = indeterminate
      ? circumference * 0.75
      : circumference - (value / 100) * circumference;

    const colors = {
      primary: "text-primary",
      success: "text-success",
      warning: "text-warning",
      error: "text-error",
    };

    return (
      <div className={cn("relative inline-flex", className)}>
        <svg
          ref={ref}
          className={cn(colors[variant], indeterminate && "animate-spin")}
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          {...props}
        >
          <circle
            className="text-bg-tertiary"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <circle
            className={cn(
              "transition-all duration-300 ease-out",
              indeterminate && "animate-[dash_1.5s_ease-in-out_infinite]",
            )}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        {showLabel && !indeterminate && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium text-text-primary">
              {Math.round(value)}%
            </span>
          </div>
        )}
      </div>
    );
  },
);

CircularProgress.displayName = "CircularProgress";

// Loading Spinner Component
export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "white";
}

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size = "md", variant = "primary", ...props }, ref) => {
    const sizes = {
      sm: "w-4 h-4 border-2",
      md: "w-6 h-6 border-2",
      lg: "w-8 h-8 border-3",
    };

    const variants = {
      primary: "border-primary border-t-transparent",
      white: "border-white border-t-transparent",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-full animate-spin",
          sizes[size],
          variants[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

Spinner.displayName = "Spinner";

export { Progress, CircularProgress, Spinner };
