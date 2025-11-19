/**
 * Badge UI Component for Hyperscape Plugin
 */
import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface BadgeProps {
  children?: ReactNode;
  className?: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
}

const variantStyles = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  destructive: "bg-destructive text-destructive-foreground",
  outline: "border border-input bg-background",
};

export function Badge({
  children,
  className,
  variant = "default",
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
