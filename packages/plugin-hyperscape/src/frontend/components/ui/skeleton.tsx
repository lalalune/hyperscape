/**
 * Skeleton UI Component for Hyperscape Plugin
 */
import { cn } from "../../utils/cn";

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      aria-label="Loading..."
    />
  );
}
