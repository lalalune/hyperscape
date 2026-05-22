/**
 * Avatar — uniform avatar rendering across the app.
 *
 * Renders an actual image when `src` is provided; otherwise falls back
 * to a Graphite tile with the first initial in Forge Gold (the brand's
 * "earned" accent moment). Tile shape is square with rounded corners
 * by default; pass `rounded="full"` for circular avatars.
 *
 * Sizes are in pixels; the component sets equal width/height + scales
 * the initial font-size proportionally.
 */

import React from "react";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: number;
  rounded?: "md" | "lg" | "full";
  className?: string;
}

const ROUNDING = {
  md: "rounded",
  lg: "rounded-lg",
  full: "rounded-full",
} as const;

export function Avatar({
  src,
  name,
  size = 32,
  rounded = "md",
  className = "",
}: AvatarProps) {
  const initial = (name || "?").charAt(0).toUpperCase();
  const fontSize = Math.max(11, Math.round(size * 0.42));

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={`${ROUNDING[rounded]} bg-bg-primary border border-border-primary object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center ${ROUNDING[rounded]} bg-bg-primary border border-border-primary flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-label={name}
    >
      <span
        className="font-display font-medium text-primary tracking-tight leading-none"
        style={{ fontSize }}
      >
        {initial}
      </span>
    </div>
  );
}
