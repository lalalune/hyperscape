const { theme } = require('./src/styles/tokens.ts')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // Use design tokens as the foundation
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
        'modal-appear': 'modal-appear 0.3s ease-out',
        'scale-in-top': 'scale-in-top 0.2s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
      },
      
      keyframes: {
        'modal-appear': {
          '0%': { 
            opacity: '0', 
            transform: 'translateY(20px) scale(0.95)' 
          },
          '100%': { 
            opacity: '1', 
            transform: 'translateY(0) scale(1)' 
          },
        },
        'scale-in-top': {
          '0%': { 
            opacity: '0', 
            transform: 'scaleY(0)',
            transformOrigin: 'top'
          },
          '100%': { 
            opacity: '1', 
            transform: 'scaleY(1)',
            transformOrigin: 'top'
          },
        },
        'fade-in': {
          '0%': { 
            opacity: '0'
          },
          '100%': { 
            opacity: '1'
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
