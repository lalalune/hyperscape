// Design Tokens - Single Source of Truth for Design System
// These tokens ensure consistency across all components and replace scattered CSS variables

export const colors = {
  // Primary colors
  primary: {
    DEFAULT: '#6366f1',
    light: '#818cf8',
    dark: '#4f46e5',
    rgb: '99, 102, 241'  // For opacity usage
  },
  secondary: {
    DEFAULT: '#8b5cf6',
    light: '#a78bfa',
    dark: '#7c3aed',
    rgb: '139, 92, 246'
  },
  
  // Dark Theme Colors (Default)
  dark: {
    'bg-primary': '#0f0f0f',
    'bg-secondary': '#1a1a1a',
    'bg-tertiary': '#262626',
    'bg-card': '#1a1a1a',
    'bg-hover': '#2a2a2a',
    'bg-elevated': '#2d2d2d',
    
    'text-primary': '#ffffff',
    'text-secondary': '#a1a1aa',
    'text-tertiary': '#71717a',
    'text-muted': '#52525b',
    
    'border-primary': '#27272a',
    'border-secondary': '#3f3f46',
    'border-hover': '#52525b',
  },
  
  // Light Theme Colors (Future)
  light: {
    'bg-primary': '#ffffff',
    'bg-secondary': '#f9fafb',
    'bg-tertiary': '#f3f4f6',
    'bg-card': '#ffffff',
    'bg-hover': '#f3f4f6',
    'bg-elevated': '#ffffff',
    
    'text-primary': '#111827',
    'text-secondary': '#6b7280',
    'text-tertiary': '#9ca3af',
    'text-muted': '#d1d5db',
    
    'border-primary': '#e5e7eb',
    'border-secondary': '#d1d5db',
    'border-hover': '#9ca3af',
  },
  
  // Semantic Colors
  semantic: {
    success: '#10b981',
    'success-light': '#34d399',
    'success-dark': '#059669',
    'success-bg': 'rgba(16, 185, 129, 0.1)',
    
    warning: '#f59e0b',
    'warning-light': '#fbbf24',
    'warning-dark': '#d97706',
    'warning-bg': 'rgba(245, 158, 11, 0.1)',
    
    error: '#ef4444',
    'error-light': '#f87171',
    'error-dark': '#dc2626',
    'error-bg': 'rgba(239, 68, 68, 0.1)',
    
    info: '#3b82f6',
    'info-light': '#60a5fa',
    'info-dark': '#2563eb',
    'info-bg': 'rgba(59, 130, 246, 0.1)',
  },
  
  // Utility Colors
  utility: {
    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',
    'overlay-dark': 'rgba(0, 0, 0, 0.5)',
    'overlay-light': 'rgba(255, 255, 255, 0.5)',
  },
  
  // UI Colors (alias for semantic colors for compatibility)
  ui: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
} as const

export const spacing = {
  0: '0',
  px: '1px',
  0.5: '0.125rem',   // 2px
  1: '0.25rem',      // 4px
  1.5: '0.375rem',   // 6px
  2: '0.5rem',       // 8px
  2.5: '0.625rem',   // 10px
  3: '0.75rem',      // 12px
  3.5: '0.875rem',   // 14px
  4: '1rem',         // 16px
  5: '1.25rem',      // 20px
  6: '1.5rem',       // 24px
  7: '1.75rem',      // 28px
  8: '2rem',         // 32px
  9: '2.25rem',      // 36px
  10: '2.5rem',      // 40px
  12: '3rem',        // 48px
  14: '3.5rem',      // 56px
  16: '4rem',        // 64px
  20: '5rem',        // 80px
  24: '6rem',        // 96px
  32: '8rem',        // 128px
  40: '10rem',       // 160px
  48: '12rem',       // 192px
  56: '14rem',       // 224px
  64: '16rem',       // 256px
  72: '18rem',       // 288px
  80: '20rem',       // 320px
  96: '24rem',       // 384px
} as const

export const borderRadius = {
  none: '0',
  sm: '0.375rem',    // 6px
  md: '0.5rem',      // 8px
  lg: '0.75rem',     // 12px
  xl: '1rem',        // 16px
  '2xl': '1.5rem',   // 24px
  '3xl': '2rem',     // 32px
  full: '9999px',
  pill: '9999px',
} as const

export const typography = {
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
    mono: '"SF Mono", "Monaco", "Inconsolata", "Fira Code", monospace',
  },
  
  fontSize: {
    xs: '0.75rem',     // 12px
    sm: '0.875rem',    // 14px
    base: '1rem',      // 16px
    lg: '1.125rem',    // 18px
    xl: '1.25rem',     // 20px
    '2xl': '1.5rem',   // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
    '5xl': '3rem',     // 48px
    '6xl': '3.75rem',  // 60px
  },
  
  fontWeight: {
    thin: '100',
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  },
  
  lineHeight: {
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
  },
  
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
} as const

export const effects = {
  boxShadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.3)',
    none: 'none',
    
    // Special shadows
    'glow-primary': `0 0 20px ${colors.primary.DEFAULT}40`,
    'glow-secondary': `0 0 20px ${colors.secondary.DEFAULT}40`,
    'elevation-1': '0 2px 4px rgba(0, 0, 0, 0.3)',
    'elevation-2': '0 4px 8px rgba(0, 0, 0, 0.3)',
    'elevation-3': '0 8px 16px rgba(0, 0, 0, 0.3)',
  },
  
  opacity: {
    0: '0',
    5: '0.05',
    10: '0.1',
    20: '0.2',
    25: '0.25',
    30: '0.3',
    40: '0.4',
    50: '0.5',
    60: '0.6',
    70: '0.7',
    75: '0.75',
    80: '0.8',
    90: '0.9',
    95: '0.95',
    100: '1',
  },
} as const

export const animation = {
  duration: {
    instant: '0ms',
    fast: '150ms',
    base: '200ms',
    slow: '300ms',
    slower: '500ms',
    slowest: '1000ms',
  },
  
  easing: {
    linear: 'linear',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
  
  // Predefined animations
  keyframes: {
    spin: 'spin 1s linear infinite',
    pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    bounce: 'bounce 1s infinite',
    fadeIn: 'fadeIn 0.2s ease-out',
    fadeOut: 'fadeOut 0.2s ease-in',
    slideUp: 'slideUp 0.3s ease-out',
    slideDown: 'slideDown 0.3s ease-out',
    scaleIn: 'scaleIn 0.2s ease-out',
    shimmer: 'shimmer 2s linear infinite',
  },
} as const

export const layout = {
  breakpoints: {
    xs: '480px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
  
  container: {
    xs: '100%',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
  
  zIndex: {
    auto: 'auto',
    0: '0',
    10: '10',
    20: '20',
    30: '30',
    40: '40',
    50: '50',
    dropdown: '1000',
    sticky: '1020',
    modal: '1030',
    popover: '1040',
    tooltip: '1050',
  },
} as const

// Export all tokens as a single theme object
export const theme = {
  colors,
  spacing,
  borderRadius,
  typography,
  effects,
  animation,
  layout,
} as const

// Helper function to generate CSS variables from tokens
export function generateCSSVariables(darkMode = true) {
  const themeColors = darkMode ? colors.dark : colors.light
  
  return {
    // Brand colors
    '--color-primary': colors.primary.DEFAULT,
    '--color-primary-dark': colors.primary.dark,
    '--color-primary-light': colors.primary.light,
    '--color-primary-rgb': colors.primary.rgb,
    '--color-secondary': colors.secondary.DEFAULT,
    '--color-secondary-dark': colors.secondary.dark,
    '--color-secondary-light': colors.secondary.light,
    '--color-secondary-rgb': colors.secondary.rgb,
    
    // Theme colors
    '--bg-primary': themeColors['bg-primary'],
    '--bg-secondary': themeColors['bg-secondary'],
    '--bg-tertiary': themeColors['bg-tertiary'],
    '--bg-card': themeColors['bg-card'],
    '--bg-hover': themeColors['bg-hover'],
    '--bg-elevated': themeColors['bg-elevated'],
    
    '--text-primary': themeColors['text-primary'],
    '--text-secondary': themeColors['text-secondary'],
    '--text-tertiary': themeColors['text-tertiary'],
    '--text-muted': themeColors['text-muted'],
    
    '--border-primary': themeColors['border-primary'],
    '--border-secondary': themeColors['border-secondary'],
    '--border-hover': themeColors['border-hover'],
    
    // Semantic colors
    '--color-success': colors.semantic.success,
    '--color-warning': colors.semantic.warning,
    '--color-error': colors.semantic.error,
    '--color-info': colors.semantic.info,
    
    // UI colors (for compatibility)
    '--color-ui-success': colors.ui.success,
    '--color-ui-warning': colors.ui.warning,
    '--color-ui-error': colors.ui.error,
    '--color-ui-info': colors.ui.info,
    
    // Typography
    '--font-sans': typography.fontFamily.sans,
    '--font-mono': typography.fontFamily.mono,
    
    // Effects
    '--shadow-sm': effects.boxShadow.sm,
    '--shadow-md': effects.boxShadow.md,
    '--shadow-lg': effects.boxShadow.lg,
    '--shadow-xl': effects.boxShadow.xl,
    
    // Animation
    '--duration-fast': animation.duration.fast,
    '--duration-base': animation.duration.base,
    '--duration-slow': animation.duration.slow,
    '--easing-out': animation.easing.out,
    '--easing-in-out': animation.easing.inOut,
  }
}