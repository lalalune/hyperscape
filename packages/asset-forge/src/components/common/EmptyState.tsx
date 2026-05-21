import { LucideIcon } from "lucide-react";
import React from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  iconSize?: number;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  iconSize = 80,
  className = "",
}) => {
  return (
    <div className={`relative text-center p-12 overflow-hidden ${className}`}>
      {/* Atmospheric backdrop — volumetric Graphite radial fade,
         faint Gold horizon. Brand: distant rendered atmospheres. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(28,30,34,0.6) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(212,175,55,0.08), transparent)",
        }}
      />

      <div className="relative z-10">
        <Icon
          size={iconSize}
          className="text-text-tertiary mb-6 mx-auto animate-float"
          strokeWidth={1.25}
        />
        <h3 className="font-display text-2xl font-medium text-text-primary mb-3 tracking-tight">
          {title}
        </h3>
        <p className="text-text-tertiary text-base max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
};

export default EmptyState;
