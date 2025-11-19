/**
 * Alert UI Components for Hyperscape Plugin
 */
import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface AlertProps {
  children?: ReactNode;
  className?: string;
  variant?: "default" | "destructive";
}

export interface AlertDescriptionProps {
  children?: ReactNode;
  className?: string;
}

const variantStyles = {
  default: "bg-background text-foreground border-border",
  destructive: "border-destructive/50 text-destructive dark:border-destructive",
};

export function Alert({
  children,
  className,
  variant = "default",
}: AlertProps) {
  return (
    <div
      className={cn(
        "relative w-full rounded-lg border p-4",
        variantStyles[variant],
        className,
      )}
      role="alert"
    >
      {children}
    </div>
  );
}

export function AlertDescription({
  children,
  className,
}: AlertDescriptionProps) {
  return (
    <div className={cn("text-sm [&_p]:leading-relaxed", className)}>
      {children}
    </div>
  );
}
