/**
 * Tooltip UI Components for Hyperscape Plugin
 *
 * Simple tooltip implementation using native title attribute.
 * For more advanced tooltips, consider using a library like Radix UI.
 */
import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface TooltipProps {
  children?: ReactNode;
}

export interface TooltipTriggerProps {
  children?: ReactNode;
  asChild?: boolean;
}

export interface TooltipContentProps {
  children?: ReactNode;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}

export interface TooltipProviderProps {
  children?: ReactNode;
  delayDuration?: number;
}

export function Tooltip({ children }: TooltipProps) {
  return <>{children}</>;
}

export function TooltipTrigger({ children, asChild }: TooltipTriggerProps) {
  if (
    asChild &&
    children &&
    typeof children === "object" &&
    "props" in children
  ) {
    return children;
  }
  return <>{children}</>;
}

export function TooltipContent({ children, className }: TooltipContentProps) {
  return (
    <div
      className={cn(
        "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TooltipProvider({
  children,
  delayDuration = 0,
}: TooltipProviderProps) {
  return <>{children}</>;
}
