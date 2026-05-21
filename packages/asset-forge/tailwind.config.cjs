const { theme } = require('./src/styles/tokens.ts')

/**
 * FORGE / HyperForge Tailwind config.
 *
 * Implements the brand guide at
 * `.claude/skills/forge-design-system/SKILL.md`:
 *   "the engine beneath infinite worlds" — cinematic, restrained,
 *   architectural. Obsidian + Graphite dominate; Forge Gold is
 *   the earned accent; the secondary system (Ember Orange /
 *   Aether Blue / Void Violet / Verdant) surfaces at
 *   environmental moments only.
 *
 * Standard tailwind color utilities (`bg-red-500`, `text-green-400`,
 * etc.) are mapped to brand-aligned palettes below so the ~1,000+
 * existing utility-class consumers across the asset-forge studio
 * automatically render against the FORGE palette without
 * per-file rewrites.
 *
 *   red    → softened error tone (#E84A4A family)
 *   green  → Verdant (#28D47A family)
 *   amber  → Ember Orange (#FF7A00 family)
 *   yellow → Forge-Gold-adjacent warm tone
 *   blue   → Aether Blue (#2D8CFF family)
 *   purple → Void Violet (#6D3AFF family)
 *   orange → Ember Orange (#FF7A00 family)
 *   emerald → Verdant (#28D47A family)
 *   cyan / teal / sky → Aether Blue (#2D8CFF family)
 *   pink / rose / fuchsia → softened rose
 *   gray / slate / zinc / neutral / stone → Graphite + Ember White neutrals
 *
 * Each scale keeps tailwind's 50–900 range so `text-red-400` vs
 * `text-red-500` still differ. Lighter scales (50–200) read as
 * gentle washes; mid-scales (300–500) carry semantic emphasis;
 * deep scales (700–900) act as recessed surfaces.
 */

// Build a 50–900 scale around a single hue, biased toward the
// FORGE dark palette: lighter end stays muted (no harsh whites),
// darker end approaches Graphite.
const scale = ({ s50, s100, s200, s300, s400, s500, s600, s700, s800, s900 }) => ({
  50: s50, 100: s100, 200: s200, 300: s300, 400: s400,
  500: s500, 600: s600, 700: s700, 800: s800, 900: s900,
})

// Brand-aligned standard tailwind palettes. Mid-scale (400/500)
// hits the canonical brand hex; the rest fan out around it.
const FORGE_PALETTES = {
  // red → softened error tone (less SaaS-bright).
  red: scale({
    s50: '#FCE9E9', s100: '#F8C8C8', s200: '#F09E9E', s300: '#EC7777',
    s400: '#E84A4A', s500: '#D43A3A', s600: '#B82E2E', s700: '#962525',
    s800: '#6E1B1B', s900: '#3F1010',
  }),
  rose: scale({
    s50: '#FCE9EE', s100: '#F8C8D2', s200: '#F09EAE', s300: '#EC7790',
    s400: '#E84A6E', s500: '#D43A5A', s600: '#B82E47', s700: '#962538',
    s800: '#6E1B28', s900: '#3F1018',
  }),
  pink: scale({
    s50: '#FCE9F0', s100: '#F8C8D8', s200: '#F09EB6', s300: '#EC7794',
    s400: '#E84A78', s500: '#D43A65', s600: '#B82E52', s700: '#96253F',
    s800: '#6E1B2D', s900: '#3F101A',
  }),
  fuchsia: scale({
    s50: '#FCE9F6', s100: '#F8C8E8', s200: '#F09ED1', s300: '#EC77B9',
    s400: '#E84AA0', s500: '#D43A88', s600: '#B82E6F', s700: '#962557',
    s800: '#6E1B3F', s900: '#3F1024',
  }),

  // green → Verdant family.
  green: scale({
    s50: '#E6FBEF', s100: '#C6F4D8', s200: '#9CEABA', s300: '#6FDF9A',
    s400: '#28D47A', s500: '#1FB867', s600: '#1B9B57', s700: '#177D48',
    s800: '#0F5C35', s900: '#0A3924',
  }),
  emerald: scale({
    s50: '#E6FBEF', s100: '#C6F4D8', s200: '#9CEABA', s300: '#6FDF9A',
    s400: '#28D47A', s500: '#1FB867', s600: '#1B9B57', s700: '#177D48',
    s800: '#0F5C35', s900: '#0A3924',
  }),
  lime: scale({
    s50: '#EEFBE0', s100: '#D8F4B6', s200: '#BCE988', s300: '#9CD957',
    s400: '#7BBE3A', s500: '#67A330', s600: '#558827', s700: '#446B20',
    s800: '#314D17', s900: '#1B2D0D',
  }),
  teal: scale({
    s50: '#E0F0FB', s100: '#B6DCF4', s200: '#88C0E9', s300: '#5BA6FF',
    s400: '#2D8CFF', s500: '#2376D9', s600: '#1E6BCC', s700: '#1A57A6',
    s800: '#143F78', s900: '#0B2545',
  }),
  cyan: scale({
    s50: '#E0F0FB', s100: '#B6DCF4', s200: '#88C0E9', s300: '#5BA6FF',
    s400: '#2D8CFF', s500: '#2376D9', s600: '#1E6BCC', s700: '#1A57A6',
    s800: '#143F78', s900: '#0B2545',
  }),
  sky: scale({
    s50: '#E0F0FB', s100: '#B6DCF4', s200: '#88C0E9', s300: '#5BA6FF',
    s400: '#2D8CFF', s500: '#2376D9', s600: '#1E6BCC', s700: '#1A57A6',
    s800: '#143F78', s900: '#0B2545',
  }),

  // blue → Aether Blue family.
  blue: scale({
    s50: '#E0F0FB', s100: '#B6DCF4', s200: '#88C0E9', s300: '#5BA6FF',
    s400: '#2D8CFF', s500: '#2376D9', s600: '#1E6BCC', s700: '#1A57A6',
    s800: '#143F78', s900: '#0B2545',
  }),
  indigo: scale({
    s50: '#EBE5FB', s100: '#D6C8F8', s200: '#B8A0F4', s300: '#9279ED',
    s400: '#6D3AFF', s500: '#5527CC', s600: '#451FA8', s700: '#371985',
    s800: '#25115C', s900: '#160833',
  }),
  violet: scale({
    s50: '#EBE5FB', s100: '#D6C8F8', s200: '#B8A0F4', s300: '#9279ED',
    s400: '#6D3AFF', s500: '#5527CC', s600: '#451FA8', s700: '#371985',
    s800: '#25115C', s900: '#160833',
  }),
  purple: scale({
    s50: '#EBE5FB', s100: '#D6C8F8', s200: '#B8A0F4', s300: '#9279ED',
    s400: '#6D3AFF', s500: '#5527CC', s600: '#451FA8', s700: '#371985',
    s800: '#25115C', s900: '#160833',
  }),

  // amber / yellow / orange → Ember Orange family. Yellows lean
  // toward gold-adjacent warmth.
  amber: scale({
    s50: '#FFEFD7', s100: '#FFDBA8', s200: '#FFC273', s300: '#FFA73B',
    s400: '#FF7A00', s500: '#E36900', s600: '#C25800', s700: '#964400',
    s800: '#682F00', s900: '#3A1B00',
  }),
  yellow: scale({
    s50: '#FCF4DB', s100: '#F7E6A8', s200: '#F0D068', s300: '#E5B637',
    s400: '#D4AF37', s500: '#B8941F', s600: '#967818', s700: '#735B11',
    s800: '#4F3F0B', s900: '#2A2206',
  }),
  orange: scale({
    s50: '#FFEFD7', s100: '#FFDBA8', s200: '#FFC273', s300: '#FFA73B',
    s400: '#FF7A00', s500: '#E36900', s600: '#C25800', s700: '#964400',
    s800: '#682F00', s900: '#3A1B00',
  }),

  // gray / slate / zinc / neutral / stone → Graphite + Ember
  // White neutrals. Lighter scales never reach harsh white
  // (#F5F5F5 ceiling); darker scales descend into Graphite.
  gray: scale({
    s50: '#F5F5F5', s100: '#E4E4E6', s200: '#C8C8CD', s300: '#A8A8B0',
    s400: '#7A7A82', s500: '#54545C', s600: '#3A3D45', s700: '#2A2D34',
    s800: '#1C1E22', s900: '#0B0B0D',
  }),
  slate: scale({
    s50: '#F5F5F5', s100: '#E4E4E6', s200: '#C8C8CD', s300: '#A8A8B0',
    s400: '#7A7A82', s500: '#54545C', s600: '#3A3D45', s700: '#2A2D34',
    s800: '#1C1E22', s900: '#0B0B0D',
  }),
  zinc: scale({
    s50: '#F5F5F5', s100: '#E4E4E6', s200: '#C8C8CD', s300: '#A8A8B0',
    s400: '#7A7A82', s500: '#54545C', s600: '#3A3D45', s700: '#2A2D34',
    s800: '#1C1E22', s900: '#0B0B0D',
  }),
  neutral: scale({
    s50: '#F5F5F5', s100: '#E4E4E6', s200: '#C8C8CD', s300: '#A8A8B0',
    s400: '#7A7A82', s500: '#54545C', s600: '#3A3D45', s700: '#2A2D34',
    s800: '#1C1E22', s900: '#0B0B0D',
  }),
  stone: scale({
    s50: '#F5F5F5', s100: '#E4E4E6', s200: '#C8C8CD', s300: '#A8A8B0',
    s400: '#7A7A82', s500: '#54545C', s600: '#3A3D45', s700: '#2A2D34',
    s800: '#1C1E22', s900: '#0B0B0D',
  }),
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    colors: {
      // Utility colors
      transparent: theme.colors.utility.transparent,
      current: 'currentColor',
      white: theme.colors.utility.white,
      black: theme.colors.utility.black,

      // Brand colors
      primary: {
        DEFAULT: theme.colors.primary.DEFAULT,
        dark: theme.colors.primary.dark,
        light: theme.colors.primary.light,
      },
      secondary: {
        DEFAULT: theme.colors.secondary.DEFAULT,
        dark: theme.colors.secondary.dark,
        light: theme.colors.secondary.light,
      },

      // Named environmental accents (from the FORGE secondary
      // accent system). Components that want a specific tone
      // request it by name rather than collapsing onto the
      // generic primary slot.
      //
      // Literal hex values used here (instead of pulling through
      // `theme.colors.accent.*`) so the tailwind config compiles
      // even when the cjs-from-ts loader caches an older shape
      // of `tokens.ts` during HMR. The canonical source of truth
      // is still `src/styles/tokens.ts`; these must match it.
      ember: {
        DEFAULT: '#FF7A00',
        dark: '#CC6200',
        light: '#FF9933',
      },
      aether: {
        DEFAULT: '#2D8CFF',
        dark: '#1E6BCC',
        light: '#5BA6FF',
      },
      void: {
        DEFAULT: '#6D3AFF',
        dark: '#5527CC',
        light: '#8B5FFF',
      },
      verdant: {
        DEFAULT: '#28D47A',
        dark: '#1FA862',
        light: '#4FDD96',
      },
      // Forge Gold alias for `text-gold-*` / `bg-gold-*` patterns
      // common in landing-page / hero copy. Gold = primary; aliasing
      // here keeps both vocabularies live without divergence.
      gold: {
        DEFAULT: theme.colors.primary.DEFAULT,
        dark: theme.colors.primary.dark,
        light: theme.colors.primary.light,
      },

      // Semantic colors
      success: theme.colors.ui.success,
      warning: theme.colors.ui.warning,
      error: theme.colors.ui.error,
      info: theme.colors.ui.info,

      // Theme colors (using CSS variables for dynamic theming)
      bg: {
        primary: 'var(--bg-primary)',
        secondary: 'var(--bg-secondary)',
        tertiary: 'var(--bg-tertiary)',
        card: 'var(--bg-card)',
        hover: 'var(--bg-hover)',
        elevated: 'var(--bg-elevated)',
      },
      text: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        tertiary: 'var(--text-tertiary)',
        muted: 'var(--text-muted)',
      },
      border: {
        primary: 'var(--border-primary)',
        secondary: 'var(--border-secondary)',
        hover: 'var(--border-hover)',
      },

      // Brand-aligned standard tailwind palettes. Every existing
      // `text-red-400` / `bg-green-500` / `border-purple-400` /
      // etc. across the studio's ~1,000 utility-class consumers
      // now resolves to a FORGE-tuned value instead of tailwind's
      // SaaS defaults. See FORGE_PALETTES above for the mapping.
      ...FORGE_PALETTES,
    },

    spacing: theme.spacing,

    borderRadius: theme.borderRadius,

    fontFamily: theme.typography.fontFamily,

    fontSize: theme.typography.fontSize,

    fontWeight: theme.typography.fontWeight,

    lineHeight: theme.typography.lineHeight,

    letterSpacing: theme.typography.letterSpacing,

    boxShadow: {
      ...theme.effects.boxShadow,
      // Dynamic shadows using CSS variables
      'theme-sm': 'var(--shadow-sm)',
      'theme-md': 'var(--shadow-md)',
      'theme-lg': 'var(--shadow-lg)',
      'theme-xl': 'var(--shadow-xl)',
    },

    opacity: theme.effects.opacity,

    screens: theme.layout.breakpoints,

    zIndex: theme.layout.zIndex,

    extend: {
      animation: {
        ...theme.animation.keyframes,
        'modal-appear': 'modal-appear 0.36s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in-top': 'scale-in-top 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fade-in 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
      },

      keyframes: {
        'modal-appear': {
          '0%': {
            opacity: '0',
            transform: 'translateY(20px) scale(0.95)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0) scale(1)',
          },
        },
        'scale-in-top': {
          '0%': {
            opacity: '0',
            transform: 'scaleY(0)',
            transformOrigin: 'top',
          },
          '100%': {
            opacity: '1',
            transform: 'scaleY(1)',
            transformOrigin: 'top',
          },
        },
        'fade-in': {
          '0%': {
            opacity: '0',
          },
          '100%': {
            opacity: '1',
          },
        },
      },

      transitionDuration: theme.animation.duration,

      transitionTimingFunction: theme.animation.easing,

      maxWidth: theme.layout.container,
    },
  },
  plugins: [],
}
