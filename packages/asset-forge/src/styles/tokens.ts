// Design Tokens — Single Source of Truth for the FORGE / HyperForge UI.
//
// Applies the brand guide at `.claude/skills/forge-design-system/SKILL.md`:
//   "the engine beneath infinite worlds" — cinematic, infrastructural,
//   restrained. Obsidian + graphite dominate (70%); ember white carries
//   typography (20%); Forge Gold is the earned-feel accent (8%); the
//   secondary accent system (orange / blue / violet / verdant) is used
//   very sparingly (2%) for environmental moments.
//
// Every component reads these tokens (directly or via the CSS-variable
// theme layer). A single edit here flows through 2,000+ consumer sites.

export const colors = {
  // Forge Gold — the earned-feel brand accent.
  // Used SPARINGLY for active states, selected nav, premium moments,
  // identity moments. Too much gold destroys the brand.
  primary: {
    DEFAULT: "#D4AF37",
    light: "#E8C760",
    dark: "#B8941F",
    rgb: "212, 175, 55", // For opacity usage
  },
  // Aether Blue — rendering / compute / infrastructure accent.
  // Used for data-visualization highlights, AI/compute system
  // indicators, network layers. Not a "secondary brand" — it's an
  // environmental accent in the brand-guide secondary system.
  secondary: {
    DEFAULT: "#2D8CFF",
    light: "#5BA6FF",
    dark: "#1E6BCC",
    rgb: "45, 140, 255",
  },

  // The full secondary accent system, exported as a named group so
  // components can request a specific environmental tone without
  // collapsing onto the generic `primary` / `secondary` slots.
  accent: {
    // Ember Orange — runtime energy / active forging / ignition /
    // generation. Only for engine-active moments; never dominant.
    ember: {
      DEFAULT: "#FF7A00",
      light: "#FF9933",
      dark: "#CC6200",
      rgb: "255, 122, 0",
    },
    // Void Violet — procedural systems / infinite simulation /
    // dimensional environments / abstract intelligence.
    void: {
      DEFAULT: "#6D3AFF",
      light: "#8B5FFF",
      dark: "#5527CC",
      rgb: "109, 58, 255",
    },
    // Verdant — ecosystems / emergence / living systems / world
    // simulation. Environmental systems only.
    verdant: {
      DEFAULT: "#28D47A",
      light: "#4FDD96",
      dark: "#1FA862",
      rgb: "40, 212, 122",
    },
  },

  // Dark Theme — Obsidian Black dominating, Graphite for surfaces.
  // The brand-guide 70% comes from these two values + the natural
  // negative space between them.
  dark: {
    // Obsidian Black — primary background. Dominates the app shell,
    // dashboards, fullscreen environments, navigation backgrounds.
    "bg-primary": "#0B0B0D",
    // Between Obsidian and Graphite — used for cards / containers
    // that need to read as "elevated above the shell" but not yet
    // at full Graphite weight.
    "bg-secondary": "#141416",
    // Graphite — cards / panels / sidebars / elevated surfaces.
    "bg-tertiary": "#1C1E22",
    "bg-card": "#141416",
    // Subtle hover lift — one step above Graphite. Keeps the
    // architectural-depth feel without flashing on hover.
    "bg-hover": "#25272C",
    "bg-elevated": "#1C1E22",

    // Ember White — typography. Never harsh white. Reads as soft
    // and premium across every panel surface.
    "text-primary": "#F5F5F5",
    // Warm-tilted neutrals so secondary copy reads as restrained
    // and editorial, not cool/clinical.
    "text-secondary": "#B0B0B5",
    "text-tertiary": "#7A7A82",
    "text-muted": "#54545C",

    // Borders are barely visible by design — Graphite reading as a
    // soft edge against Obsidian. The "subtle borders / faint edge
    // lighting" mandate from the guide.
    "border-primary": "#1C1E22",
    "border-secondary": "#2A2D34",
    "border-hover": "#3A3D45",
  },

  // Light Theme — preserved for future. NOT the canonical FORGE look;
  // brand identity lives in the dark theme.
  light: {
    "bg-primary": "#ffffff",
    "bg-secondary": "#f9fafb",
    "bg-tertiary": "#f3f4f6",
    "bg-card": "#ffffff",
    "bg-hover": "#f3f4f6",
    "bg-elevated": "#ffffff",

    "text-primary": "#111827",
    "text-secondary": "#6b7280",
    "text-tertiary": "#9ca3af",
    "text-muted": "#d1d5db",

    "border-primary": "#e5e7eb",
    "border-secondary": "#d1d5db",
    "border-hover": "#9ca3af",
  },

  // Semantic Colors — outcome tone (success / warning / error / info).
  // Tuned to read with the same restrained, cinematic feel as the
  // primary palette: deeper saturations than typical SaaS green/red,
  // not the bright trading-UI saturations the guide warns against.
  semantic: {
    success: "#28D47A", // Aligned with Verdant
    "success-light": "#4FDD96",
    "success-dark": "#1FA862",
    "success-bg": "rgba(40, 212, 122, 0.1)",

    warning: "#FF7A00", // Aligned with Ember Orange
    "warning-light": "#FF9933",
    "warning-dark": "#CC6200",
    "warning-bg": "rgba(255, 122, 0, 0.1)",

    error: "#E84A4A",
    "error-light": "#F06B6B",
    "error-dark": "#C13434",
    "error-bg": "rgba(232, 74, 74, 0.1)",

    info: "#2D8CFF", // Aligned with Aether Blue
    "info-light": "#5BA6FF",
    "info-dark": "#1E6BCC",
    "info-bg": "rgba(45, 140, 255, 0.1)",
  },

  // Utility Colors
  utility: {
    white: "#ffffff",
    black: "#000000",
    transparent: "transparent",
    "overlay-dark": "rgba(11, 11, 13, 0.78)", // Obsidian-tinted overlay
    "overlay-light": "rgba(245, 245, 245, 0.5)",
  },

  // UI Colors (alias for semantic colors for compatibility)
  ui: {
    success: "#28D47A",
    warning: "#FF7A00",
    error: "#E84A4A",
    info: "#2D8CFF",
  },
} as const;

export const spacing = {
  0: "0",
  px: "1px",
  0.5: "0.125rem", // 2px
  1: "0.25rem", // 4px
  1.5: "0.375rem", // 6px
  2: "0.5rem", // 8px
  2.5: "0.625rem", // 10px
  3: "0.75rem", // 12px
  3.5: "0.875rem", // 14px
  4: "1rem", // 16px
  5: "1.25rem", // 20px
  6: "1.5rem", // 24px
  7: "1.75rem", // 28px
  8: "2rem", // 32px
  9: "2.25rem", // 36px
  10: "2.5rem", // 40px
  12: "3rem", // 48px
  14: "3.5rem", // 56px
  16: "4rem", // 64px
  20: "5rem", // 80px
  24: "6rem", // 96px
  32: "8rem", // 128px
  40: "10rem", // 160px
  48: "12rem", // 192px
  56: "14rem", // 224px
  64: "16rem", // 256px
  72: "18rem", // 288px
  80: "20rem", // 320px
  96: "24rem", // 384px
} as const;

export const borderRadius = {
  none: "0",
  sm: "0.375rem", // 6px
  md: "0.5rem", // 8px
  lg: "0.75rem", // 12px
  xl: "1rem", // 16px
  "2xl": "1.5rem", // 24px
  "3xl": "2rem", // 32px
  full: "9999px",
  pill: "9999px",
} as const;

export const typography = {
  fontFamily: {
    // Manrope — refined geometric sans with editorial weight.
    // Replaces Inter (on the brand-guide "avoid" list as a generic
    // tech default). Manrope reads as premium engineering tooling —
    // closer to Apple Pro / Linear / Notion editorial sensibility.
    sans: '"Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    // Fraunces — variable serif with editorial / cinematic energy.
    // Used for display-scale headings, hero copy, premium moments.
    // Combines the "elegant serif hybrid" mandate with restraint
    // (it has subtle modulation, not aggressive sci-fi).
    display: '"Fraunces", "Newsreader", "Iowan Old Style", Georgia, serif',
    // JetBrains Mono — kept for code / data / numeric display.
    // Aligns with the "computational / engineered" feel.
    mono: '"JetBrains Mono", "SF Mono", "Cascadia Code", "Fira Code", monospace',
  },

  fontSize: {
    xs: "0.75rem", // 12px
    sm: "0.875rem", // 14px
    base: "1rem", // 16px
    lg: "1.125rem", // 18px
    xl: "1.25rem", // 20px
    "2xl": "1.5rem", // 24px
    "3xl": "1.875rem", // 30px
    "4xl": "2.25rem", // 36px
    "5xl": "3rem", // 48px
    "6xl": "3.75rem", // 60px
  },

  fontWeight: {
    thin: "100",
    light: "300",
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    extrabold: "800",
    black: "900",
  },

  lineHeight: {
    tight: "1.25",
    snug: "1.375",
    normal: "1.5",
    relaxed: "1.625",
    loose: "2",
  },

  letterSpacing: {
    tighter: "-0.05em",
    tight: "-0.025em",
    normal: "0em",
    wide: "0.025em",
    wider: "0.05em",
    widest: "0.1em",
  },
} as const;

export const effects = {
  boxShadow: {
    // Heavier, more infrastructural shadows — Obsidian-tinted instead
    // of pure black. Per the brand guide, surfaces should feel
    // "machined" / "premium" rather than glowing or floating.
    sm: "0 1px 2px 0 rgba(11, 11, 13, 0.6)",
    md: "0 4px 6px -1px rgba(11, 11, 13, 0.6), 0 2px 4px -2px rgba(11, 11, 13, 0.35)",
    lg: "0 10px 20px -3px rgba(11, 11, 13, 0.7), 0 4px 6px -4px rgba(11, 11, 13, 0.4)",
    xl: "0 20px 30px -5px rgba(11, 11, 13, 0.75), 0 8px 12px -6px rgba(11, 11, 13, 0.45)",
    "2xl": "0 25px 50px -12px rgba(11, 11, 13, 0.85)",
    inner: "inset 0 1px 3px 0 rgba(11, 11, 13, 0.5)",
    none: "none",

    // Forge Gold glow — used VERY sparingly for the "earned moment"
    // (selected nav item, active CTA). Toned down from the prior
    // indigo glow so it reads as edge-lighting, not a halo.
    "glow-primary": `0 0 18px ${colors.primary.DEFAULT}28, 0 0 4px ${colors.primary.DEFAULT}18`,
    "glow-secondary": `0 0 18px ${colors.secondary.DEFAULT}28, 0 0 4px ${colors.secondary.DEFAULT}18`,
    // Architectural elevation — each step pairs a deeper drop shadow
    // with a fainter 1px Ember-White ring to read as machined edge.
    "elevation-1":
      "0 2px 4px rgba(11, 11, 13, 0.55), 0 0 0 1px rgba(245, 245, 245, 0.04)",
    "elevation-2":
      "0 4px 12px rgba(11, 11, 13, 0.65), 0 0 0 1px rgba(245, 245, 245, 0.05)",
    "elevation-3":
      "0 8px 24px rgba(11, 11, 13, 0.75), 0 0 0 1px rgba(245, 245, 245, 0.06)",
  },

  opacity: {
    0: "0",
    5: "0.05",
    10: "0.1",
    20: "0.2",
    25: "0.25",
    30: "0.3",
    40: "0.4",
    50: "0.5",
    60: "0.6",
    70: "0.7",
    75: "0.75",
    80: "0.8",
    90: "0.9",
    95: "0.95",
    100: "1",
  },
} as const;

export const animation = {
  duration: {
    instant: "0ms",
    // Slightly longer base than typical SaaS to read as "deliberate /
    // heavy / infrastructural" per the brand-guide motion direction.
    fast: "180ms",
    base: "240ms",
    slow: "360ms",
    slower: "560ms",
    slowest: "1100ms",
  },

  easing: {
    linear: "linear",
    in: "cubic-bezier(0.4, 0, 1, 1)",
    // Slow, weighty ease-out for cinematic reveals (panels sliding
    // in, modals opening). Heavier than the default ease-out.
    out: "cubic-bezier(0.16, 1, 0.3, 1)",
    inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
    // Kept as a token for legacy callers but the brand guide
    // explicitly discourages bouncy motion. Prefer `out` / `inOut`.
    bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
  },

  // Predefined animations
  keyframes: {
    spin: "spin 1s linear infinite",
    pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
    bounce: "bounce 1s infinite",
    fadeIn: "fadeIn 0.24s cubic-bezier(0.16, 1, 0.3, 1)",
    fadeOut: "fadeOut 0.18s cubic-bezier(0.4, 0, 1, 1)",
    slideUp: "slideUp 0.36s cubic-bezier(0.16, 1, 0.3, 1)",
    slideDown: "slideDown 0.36s cubic-bezier(0.16, 1, 0.3, 1)",
    scaleIn: "scaleIn 0.24s cubic-bezier(0.16, 1, 0.3, 1)",
    shimmer: "shimmer 2s linear infinite",
  },
} as const;

export const layout = {
  breakpoints: {
    xs: "480px",
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
  },

  container: {
    xs: "100%",
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
  },

  zIndex: {
    auto: "auto",
    0: "0",
    10: "10",
    20: "20",
    30: "30",
    40: "40",
    50: "50",
    dropdown: "1000",
    sticky: "1020",
    modal: "1030",
    popover: "1040",
    tooltip: "1050",
  },
} as const;

// Export all tokens as a single theme object
export const theme = {
  colors,
  spacing,
  borderRadius,
  typography,
  effects,
  animation,
  layout,
} as const;

// Helper function to generate CSS variables from tokens
export function generateCSSVariables(darkMode = true) {
  const themeColors = darkMode ? colors.dark : colors.light;

  return {
    // Brand colors
    "--color-primary": colors.primary.DEFAULT,
    "--color-primary-dark": colors.primary.dark,
    "--color-primary-light": colors.primary.light,
    "--color-primary-rgb": colors.primary.rgb,
    "--color-secondary": colors.secondary.DEFAULT,
    "--color-secondary-dark": colors.secondary.dark,
    "--color-secondary-light": colors.secondary.light,
    "--color-secondary-rgb": colors.secondary.rgb,

    // Accent system — sparingly used environmental tones
    "--color-accent-ember": colors.accent.ember.DEFAULT,
    "--color-accent-ember-rgb": colors.accent.ember.rgb,
    "--color-accent-void": colors.accent.void.DEFAULT,
    "--color-accent-void-rgb": colors.accent.void.rgb,
    "--color-accent-verdant": colors.accent.verdant.DEFAULT,
    "--color-accent-verdant-rgb": colors.accent.verdant.rgb,

    // Theme colors
    "--bg-primary": themeColors["bg-primary"],
    "--bg-secondary": themeColors["bg-secondary"],
    "--bg-tertiary": themeColors["bg-tertiary"],
    "--bg-card": themeColors["bg-card"],
    "--bg-hover": themeColors["bg-hover"],
    "--bg-elevated": themeColors["bg-elevated"],

    "--text-primary": themeColors["text-primary"],
    "--text-secondary": themeColors["text-secondary"],
    "--text-tertiary": themeColors["text-tertiary"],
    "--text-muted": themeColors["text-muted"],

    "--border-primary": themeColors["border-primary"],
    "--border-secondary": themeColors["border-secondary"],
    "--border-hover": themeColors["border-hover"],

    // Semantic colors
    "--color-success": colors.semantic.success,
    "--color-warning": colors.semantic.warning,
    "--color-error": colors.semantic.error,
    "--color-info": colors.semantic.info,

    // UI colors (for compatibility)
    "--color-ui-success": colors.ui.success,
    "--color-ui-warning": colors.ui.warning,
    "--color-ui-error": colors.ui.error,
    "--color-ui-info": colors.ui.info,

    // Typography
    "--font-sans": typography.fontFamily.sans,
    "--font-display": typography.fontFamily.display,
    "--font-mono": typography.fontFamily.mono,

    // Effects
    "--shadow-sm": effects.boxShadow.sm,
    "--shadow-md": effects.boxShadow.md,
    "--shadow-lg": effects.boxShadow.lg,
    "--shadow-xl": effects.boxShadow.xl,

    // Animation
    "--duration-fast": animation.duration.fast,
    "--duration-base": animation.duration.base,
    "--duration-slow": animation.duration.slow,
    "--easing-out": animation.easing.out,
    "--easing-in-out": animation.easing.inOut,
  };
}
