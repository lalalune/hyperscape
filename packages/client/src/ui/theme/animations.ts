/**
 * Animation Library
 *
 * Standard animation definitions for UI components.
 * Based on modern MMORPG/MMO interface design patterns.
 *
 * @packageDocumentation
 */

import type React from "react";

/** Animation timing function */
export type AnimationEasing = string;

/** Standard animation durations in milliseconds */
export const animationDurations = {
  /** Ultra-fast interactions (button press) */
  instant: 50,
  /** Fast interactions (hover, focus) */
  fast: 100,
  /** Normal transitions (state changes) */
  normal: 200,
  /** Slow transitions (window open/close) */
  slow: 300,
  /** Extended animations (complex reveals) */
  extended: 500,
  /** Long-running effects (pulse, glow) */
  continuous: 1000,
  /** Very long animations (float away) */
  extended2: 2000,
} as const;

/** Standard animation easings */
export const animationEasings = {
  /** Linear - for continuous animations like cooldowns */
  linear: "linear",
  /** Ease - general purpose */
  ease: "ease",
  /** Ease in - for fade outs */
  easeIn: "ease-in",
  /** Ease out - for quick starts (like button press) */
  easeOut: "ease-out",
  /** Ease in out - for smooth transitions */
  easeInOut: "ease-in-out",
  /** Bounce out - for playful elements */
  bounceOut: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  /** Bounce in - for closing elements */
  bounceIn: "cubic-bezier(0.36, 0, 0.66, -0.56)",
  /** Spring - for elastic effects */
  spring: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
  /** Smooth decel - for window opening */
  smoothDecel: "cubic-bezier(0.0, 0.0, 0.2, 1)",
  /** Smooth accel - for window closing */
  smoothAccel: "cubic-bezier(0.4, 0.0, 1, 1)",
} as const;

/** Animation preset definitions */
export const animations = {
  /** Button press feedback */
  buttonPress: {
    duration: `${animationDurations.fast}ms`,
    easing: animationEasings.easeOut,
    transform: "scale(0.95)",
  },

  /** Hover state transition */
  hover: {
    duration: `${animationDurations.normal}ms`,
    easing: animationEasings.easeInOut,
  },

  /** Hover lift effect */
  hoverLift: {
    duration: `${animationDurations.normal}ms`,
    easing: animationEasings.easeOut,
    initial: { transform: "translateY(0)", boxShadow: "none" },
    animate: {
      transform: "translateY(-2px)",
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    },
  },

  /** Subtle scale on hover */
  hoverScale: {
    duration: `${animationDurations.fast}ms`,
    easing: animationEasings.easeOut,
    initial: { transform: "scale(1)" },
    animate: { transform: "scale(1.02)" },
  },

  /** Window opening animation */
  windowOpen: {
    duration: `${animationDurations.slow}ms`,
    easing: animationEasings.bounceOut,
    initial: { opacity: 0, transform: "scale(0.9)" },
    animate: { opacity: 1, transform: "scale(1)" },
  },

  /** Window closing animation */
  windowClose: {
    duration: `${animationDurations.normal}ms`,
    easing: animationEasings.bounceIn,
    initial: { opacity: 1, transform: "scale(1)" },
    animate: { opacity: 0, transform: "scale(0.9)" },
  },

  /** Pop in animation for toasts/notifications */
  popIn: {
    duration: `${animationDurations.slow}ms`,
    easing: animationEasings.spring,
    initial: { opacity: 0, transform: "scale(0.8) translateY(10px)" },
    animate: { opacity: 1, transform: "scale(1) translateY(0)" },
  },

  /** Gentle bounce */
  bounce: {
    duration: `${animationDurations.extended}ms`,
    keyframes: {
      "0%, 100%": { transform: "translateY(0)" },
      "50%": { transform: "translateY(-5px)" },
    },
  },

  /** Cooldown radial fill animation */
  cooldown: {
    easing: animationEasings.linear,
    effect: "radial-fill",
  },

  /** Pulse animation for alerts/notifications */
  pulse: {
    duration: `${animationDurations.continuous}ms`,
    keyframes: {
      "0%": { transform: "scale(1)" },
      "50%": { transform: "scale(1.1)" },
      "100%": { transform: "scale(1)" },
    },
  },

  /** Glow pulse for active states */
  glowPulse: {
    duration: `${animationDurations.continuous}ms`,
    keyframes: {
      "0%": { boxShadow: "0 0 5px rgba(255, 153, 0, 0.3)" },
      "50%": { boxShadow: "0 0 15px rgba(255, 153, 0, 0.6)" },
      "100%": { boxShadow: "0 0 5px rgba(255, 153, 0, 0.3)" },
    },
  },

  /** Float up and fade (damage numbers, loot) */
  floatUp: {
    duration: `${animationDurations.extended2}ms`,
    transform: "translateY(-100px)",
    opacity: "0",
    keyframes: {
      "0%": { transform: "translateY(0)", opacity: "1" },
      "100%": { transform: "translateY(-100px)", opacity: "0" },
    },
  },

  /** Fade in animation */
  fadeIn: {
    duration: `${animationDurations.normal}ms`,
    easing: animationEasings.easeOut,
    initial: { opacity: 0 },
    animate: { opacity: 1 },
  },

  /** Fade out animation */
  fadeOut: {
    duration: `${animationDurations.normal}ms`,
    easing: animationEasings.easeIn,
    initial: { opacity: 1 },
    animate: { opacity: 0 },
  },

  /** Slide in from right */
  slideInRight: {
    duration: `${animationDurations.slow}ms`,
    easing: animationEasings.smoothDecel,
    initial: { transform: "translateX(100%)", opacity: 0 },
    animate: { transform: "translateX(0)", opacity: 1 },
  },

  /** Slide in from left */
  slideInLeft: {
    duration: `${animationDurations.slow}ms`,
    easing: animationEasings.smoothDecel,
    initial: { transform: "translateX(-100%)", opacity: 0 },
    animate: { transform: "translateX(0)", opacity: 1 },
  },

  /** Slide in from bottom */
  slideInBottom: {
    duration: `${animationDurations.slow}ms`,
    easing: animationEasings.smoothDecel,
    initial: { transform: "translateY(100%)", opacity: 0 },
    animate: { transform: "translateY(0)", opacity: 1 },
  },

  /** Shake animation (error state) */
  shake: {
    duration: `${animationDurations.extended}ms`,
    keyframes: {
      "0%, 100%": { transform: "translateX(0)" },
      "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-4px)" },
      "20%, 40%, 60%, 80%": { transform: "translateX(4px)" },
    },
  },

  /** Spin animation (loading) */
  spin: {
    duration: `${animationDurations.continuous}ms`,
    easing: animationEasings.linear,
    keyframes: {
      "0%": { transform: "rotate(0deg)" },
      "100%": { transform: "rotate(360deg)" },
    },
  },

  /** Buff expiring pulse */
  expiringPulse: {
    duration: `${animationDurations.extended}ms`,
    keyframes: {
      "0%, 100%": { opacity: 1 },
      "50%": { opacity: 0.4 },
    },
  },

  /** Subtle breathing effect */
  breathe: {
    duration: `${animationDurations.extended2}ms`,
    keyframes: {
      "0%, 100%": { opacity: 0.7 },
      "50%": { opacity: 1 },
    },
  },

  /** Highlight flash */
  flash: {
    duration: `${animationDurations.slow}ms`,
    keyframes: {
      "0%": { backgroundColor: "rgba(255, 215, 0, 0.3)" },
      "100%": { backgroundColor: "transparent" },
    },
  },

  /** Item pickup/acquire effect */
  acquire: {
    duration: `${animationDurations.slow}ms`,
    easing: animationEasings.bounceOut,
    keyframes: {
      "0%": { transform: "scale(1.2)", opacity: 0 },
      "100%": { transform: "scale(1)", opacity: 1 },
    },
  },

  /** Ripple click effect */
  ripple: {
    duration: `${animationDurations.extended}ms`,
    easing: animationEasings.easeOut,
    keyframes: {
      "0%": { transform: "scale(0)", opacity: 0.5 },
      "100%": { transform: "scale(2)", opacity: 0 },
    },
  },

  /** Skeleton loading shimmer */
  shimmer: {
    duration: `${animationDurations.continuous * 1.5}ms`,
    easing: animationEasings.linear,
    keyframes: {
      "0%": { backgroundPosition: "-200% 0" },
      "100%": { backgroundPosition: "200% 0" },
    },
  },

  /** Success checkmark */
  checkmark: {
    duration: `${animationDurations.slow}ms`,
    easing: animationEasings.bounceOut,
    keyframes: {
      "0%": { strokeDashoffset: "100" },
      "100%": { strokeDashoffset: "0" },
    },
  },

  /** Progress bar fill */
  progressFill: {
    duration: `${animationDurations.slow}ms`,
    easing: animationEasings.smoothDecel,
  },

  /** Tooltip appear */
  tooltipIn: {
    duration: `${animationDurations.fast}ms`,
    easing: animationEasings.easeOut,
    initial: { opacity: 0, transform: "scale(0.95)" },
    animate: { opacity: 1, transform: "scale(1)" },
  },
} as const;

/**
 * Get CSS transition string from animation preset
 */
export function getTransition(
  properties: string | string[] = "all",
  duration: keyof typeof animationDurations = "normal",
  easing: keyof typeof animationEasings = "ease",
): string {
  const props = Array.isArray(properties) ? properties : [properties];
  const durationMs = animationDurations[duration];
  const easingValue = animationEasings[easing];

  return props.map((p) => `${p} ${durationMs}ms ${easingValue}`).join(", ");
}

/**
 * Get CSS keyframes string from animation preset
 */
export function getKeyframesCSS(
  name: string,
  keyframes: Record<string, Record<string, string>>,
): string {
  const frames = Object.entries(keyframes)
    .map(([key, styles]) => {
      const styleStr = Object.entries(styles)
        .map(([prop, val]) => `${prop}: ${val};`)
        .join(" ");
      return `${key} { ${styleStr} }`;
    })
    .join(" ");

  return `@keyframes ${name} { ${frames} }`;
}

/**
 * Apply animation styles inline
 */
export function applyAnimation(
  preset: keyof typeof animations,
  state: "initial" | "animate" = "animate",
): React.CSSProperties {
  const anim = animations[preset];
  if (!anim) return {};

  const styles: React.CSSProperties = {};

  if ("duration" in anim) {
    styles.transitionDuration = anim.duration as string;
  }

  if ("easing" in anim) {
    styles.transitionTimingFunction = anim.easing as string;
  }

  if (state === "initial" && "initial" in anim) {
    Object.assign(styles, anim.initial as object);
  } else if (state === "animate" && "animate" in anim) {
    Object.assign(styles, anim.animate as object);
  }

  return styles;
}
