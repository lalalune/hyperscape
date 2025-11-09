import React from "react";

import { cn } from "../../styles";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "secondary" | "success" | "warning" | "error";
  size?: "sm" | "md";
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "secondary", size = "md", ...props }, ref) => {
    const variants = {
      primary: "badge-primary",
      secondary: "badge bg-bg-tertiary text-text-secondary",
      success: "badge-success",
      warning: "badge-warning",
      error: "badge-error",
    };

    const sizes = {
      sm: "text-[0.625rem] px-1.5 py-0.5",
      md: "text-xs px-2 py-1",
    };

    return (
      <span
        ref={ref}
        className={cn("badge", variants[variant], sizes[size], className)}
        {...props}
      />
    );
  },
);

Badge.displayName = "Badge";

export { Badge };
