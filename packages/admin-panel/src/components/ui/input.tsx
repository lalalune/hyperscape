import { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border bg-(--bg-secondary) px-3 py-2 text-sm",
          "text-(--text-primary) placeholder:text-(--text-muted)",
          "border-(--border-primary) focus:border-(--accent-primary)",
          "focus:outline-none focus:ring-2 focus:ring-(--accent-primary) focus:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-colors duration-150",
          error &&
            "border-(--color-error) focus:border-(--color-error) focus:ring-(--color-error)",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
