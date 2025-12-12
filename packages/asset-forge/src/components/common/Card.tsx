import React from "react";

import { cn } from "../../styles";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "hover" | "interactive";
  selected?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    { className, variant = "default", selected = false, children, ...props },
    ref,
  ) => {
    const variants = {
      default: "card",
      hover: "card-hover",
      interactive: "card-interactive",
    };

    return (
      <div
        ref={ref}
        className={cn(
          variants[variant],
          selected &&
            "border-primary ring-2 ring-primary ring-opacity-20 bg-primary bg-opacity-5",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = "Card";

// Card Header Component
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("panel-header", className)} {...props} />
  ),
);

CardHeader.displayName = "CardHeader";

// Card Title Component
export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, as = "h3", ...props }, ref) => {
    const Component = as;

    return (
      <Component
        ref={ref}
        className={cn("text-base font-semibold text-text-primary", className)}
        {...props}
      />
    );
  },
);

CardTitle.displayName = "CardTitle";

// Card Description Component
export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  CardDescriptionProps
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-text-secondary mt-1", className)}
    {...props}
  />
));

CardDescription.displayName = "CardDescription";

// Card Content Component
export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("panel-body", className)} {...props} />
  ),
);

CardContent.displayName = "CardContent";

// Card Footer Component
export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "px-4 py-3 border-t border-border-primary bg-bg-tertiary bg-opacity-50 rounded-b-lg",
        className,
      )}
      {...props}
    />
  ),
);

CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
};
