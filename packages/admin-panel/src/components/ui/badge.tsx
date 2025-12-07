import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "info" | "outline";
  size?: "sm" | "md";
}

function Badge({
  className,
  variant = "default",
  size = "md",
  ...props
}: BadgeProps) {
  const baseStyles = "inline-flex items-center font-medium rounded-full";

  const variants = {
    default:
      "bg-(--bg-tertiary) text-(--text-secondary) border border-(--border-primary)",
    success:
      "bg-[rgba(16,185,129,0.15)] text-(--color-success) border border-(--color-success)",
    warning:
      "bg-[rgba(245,158,11,0.15)] text-(--color-warning) border border-(--color-warning)",
    error:
      "bg-[rgba(239,68,68,0.15)] text-(--color-error) border border-(--color-error)",
    info: "bg-[rgba(59,130,246,0.15)] text-(--color-info) border border-(--color-info)",
    outline:
      "bg-transparent text-(--text-secondary) border border-(--border-primary)",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-xs",
  };

  return (
    <span
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}

export { Badge };
