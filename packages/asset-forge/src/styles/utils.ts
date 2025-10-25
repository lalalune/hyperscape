// Design System Utilities
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { CSSTokens, GenericFunction } from '../types'

/**
 * Merge class names with tailwind-merge to avoid conflicts
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Create variant classes for components
 */
export function createVariants<T extends Record<string, Record<string, string>>>(
  variants: T
): T {
  return variants
}

/**
 * Convert design tokens to CSS variables
 */
export function tokensToCSS(tokens: CSSTokens, prefix = ''): Record<string, string> {
  const cssVars: Record<string, string> = {}
  
  for (const [key, value] of Object.entries(tokens)) {
    const varName = prefix ? `--${prefix}-${key}` : `--${key}`
    
    if (typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(cssVars, tokensToCSS(value, prefix ? `${prefix}-${key}` : key))
    } else {
      cssVars[varName] = String(value)
    }
  }
  
  return cssVars
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends GenericFunction>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

/**
 * Focus management utilities
 */
export const focusManager = {
  /**
   * Trap focus within an element
   */
  trapFocus(element: HTMLElement) {
    const focusableElements = element.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    
    const firstFocusable = focusableElements[0] as HTMLElement
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          lastFocusable?.focus()
          e.preventDefault()
        }
      } else {
        if (document.activeElement === lastFocusable) {
          firstFocusable?.focus()
          e.preventDefault()
        }
      }
    }
    
    element.addEventListener('keydown', handleKeyDown)
    
    return () => {
      element.removeEventListener('keydown', handleKeyDown)
    }
  },
  
  /**
   * Restore focus to a previous element
   */
  restoreFocus(element: HTMLElement | null) {
    if (element && element.focus) {
      element.focus()
    }
  }
}

/**
 * Animation helpers
 */
export const animations = {
  /**
   * Wait for animation to complete
   */
  async waitForAnimation(element: HTMLElement): Promise<void> {
    return new Promise((resolve) => {
      const handleAnimationEnd = () => {
        element.removeEventListener('animationend', handleAnimationEnd)
        resolve()
      }
      element.addEventListener('animationend', handleAnimationEnd)
    })
  },
  
  /**
   * Wait for transition to complete
   */
  async waitForTransition(element: HTMLElement): Promise<void> {
    return new Promise((resolve) => {
      const handleTransitionEnd = () => {
        element.removeEventListener('transitionend', handleTransitionEnd)
        resolve()
      }
      element.addEventListener('transitionend', handleTransitionEnd)
    })
  }
}

/**
 * Responsive utilities
 */
export const responsive = {
  /**
   * Check if screen matches breakpoint
   */
  matchesBreakpoint(breakpoint: 'sm' | 'md' | 'lg' | 'xl' | '2xl'): boolean {
    const breakpoints = {
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      '2xl': 1536
    }
    
    return window.matchMedia(`(min-width: ${breakpoints[breakpoint]}px)`).matches
  },
  
  /**
   * Get current breakpoint
   */
  getCurrentBreakpoint(): string {
    const width = window.innerWidth
    
    if (width < 640) return 'xs'
    if (width < 768) return 'sm'
    if (width < 1024) return 'md'
    if (width < 1280) return 'lg'
    if (width < 1536) return 'xl'
    return '2xl'
  }
}

/**
 * Color utilities
 */
export const colorUtils = {
  /**
   * Convert hex to RGB
   */
  hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  },
  
  /**
   * Convert RGB to hex
   */
  rgbToHex(r: number, g: number, b: number): string {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
  },
  
  /**
   * Generate color with opacity
   */
  withOpacity(color: string, opacity: number): string {
    const rgb = this.hexToRgb(color)
    if (!rgb) return color
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`
  }
}