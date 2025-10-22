/**
 * Responsive Window Manager
 * Provides smart window positioning and sizing across mobile, tablet, and desktop
 */

export enum ScreenSize {
  MOBILE = 'mobile',
  TABLET = 'tablet',
  DESKTOP = 'desktop',
  ULTRAWIDE = 'ultrawide'
}

export interface WindowConfig {
  width: {
    mobile: number
    tablet: number
    desktop: number
  }
  position: {
    mobile: { x: number; y: number }
    tablet: { x: number; y: number }
    desktop: { x: number; y: number }
  }
  fullscreen?: {
    mobile?: boolean
    tablet?: boolean
  }
}

export class ResponsiveWindowManager {
  private static instance: ResponsiveWindowManager

  static getInstance(): ResponsiveWindowManager {
    if (!ResponsiveWindowManager.instance) {
      ResponsiveWindowManager.instance = new ResponsiveWindowManager()
    }
    return ResponsiveWindowManager.instance
  }

  getScreenSize(): ScreenSize {
    const width = window.innerWidth
    if (width < 768) return ScreenSize.MOBILE
    if (width < 1024) return ScreenSize.TABLET
    if (width < 2560) return ScreenSize.DESKTOP
    return ScreenSize.ULTRAWIDE
  }

  isMobile(): boolean {
    return this.getScreenSize() === ScreenSize.MOBILE
  }

  isTablet(): boolean {
    return this.getScreenSize() === ScreenSize.TABLET
  }

  isDesktop(): boolean {
    return this.getScreenSize() === ScreenSize.DESKTOP
  }

  isUltrawide(): boolean {
    return this.getScreenSize() === ScreenSize.ULTRAWIDE
  }

  getWindowDimensions(config?: WindowConfig) {
    const screenSize = this.getScreenSize()
    const defaultWidth = screenSize === ScreenSize.MOBILE ? window.innerWidth :
                        screenSize === ScreenSize.TABLET ? 400 :
                        500

    return {
      width: config?.width[screenSize] || defaultWidth,
      maxHeight: screenSize === ScreenSize.MOBILE ? 'calc(100vh - 80px)' : '80vh'
    }
  }

  getWindowPosition(windowId: string, config?: WindowConfig) {
    const screenSize = this.getScreenSize()

    // Mobile: center or bottom sheet
    if (screenSize === ScreenSize.MOBILE) {
      if (config?.fullscreen?.mobile) {
        return { x: 0, y: 60 }
      }
      // Bottom sheet style
      return {
        x: 0,
        y: window.innerHeight * 0.25
      }
    }

    // Tablet: right side or center
    if (screenSize === ScreenSize.TABLET) {
      if (config?.fullscreen?.tablet) {
        return { x: 20, y: 60 }
      }
      // Right side positioning
      return {
        x: window.innerWidth - 420,
        y: 80
      }
    }

    // Desktop: grid-based layout with safe positioning
    if (config?.position?.desktop) {
      return config.position.desktop
    }

    // Calculate safe viewport boundaries (with margins)
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const isUltrawide = this.isUltrawide()

    // Increase margins for ultrawide displays
    const leftMargin = 0
    const topMargin = 80
    const rightMargin = isUltrawide ? 60 : 40
    const bottomMargin = 80

    // Define standard window sizes for positioning calculations - uniform 550px height
    const windowSizes: Record<string, { width: number; height: number }> = {
      combat: { width: 450, height: 550 },
      equipment: { width: 500, height: 550 },
      inventory: { width: 450, height: 550 },
      settings: { width: 380, height: 550 },
      prefs: { width: 380, height: 550 },
      account: { width: 380, height: 550 },
      skills: { width: 450, height: 550 },
    }

    // Grid layout - ensure all windows fit on screen
    // Ultrawide: more horizontal spacing, Desktop: standard spacing
    const horizontalSpacing = isUltrawide ? 520 : 480
    const verticalSpacing = 620

    const desktopPositions: Record<string, { x: number; y: number }> = {
      // Top row - left to right with safe margins
      combat: {
        x: leftMargin,
        y: topMargin
      },
      equipment: {
        x: Math.min(leftMargin + horizontalSpacing, viewportWidth - (windowSizes.equipment?.width || 500) - rightMargin),
        y: topMargin
      },
      inventory: {
        x: Math.min(leftMargin + (horizontalSpacing * 2), viewportWidth - (windowSizes.inventory?.width || 450) - rightMargin),
        y: topMargin
      },
      settings: {
        x: Math.max(viewportWidth - (windowSizes.settings?.width || 380) - rightMargin, leftMargin),
        y: topMargin
      },
      prefs: {
        x: Math.max(viewportWidth - (windowSizes.prefs?.width || 380) - rightMargin, leftMargin),
        y: topMargin
      },

      // Bottom row - positioned to not overlap with top row
      account: {
        x: leftMargin,
        y: Math.min(topMargin + verticalSpacing, viewportHeight - (windowSizes.account?.height || 550) - bottomMargin)
      },
      skills: {
        x: Math.min(leftMargin + horizontalSpacing, viewportWidth - (windowSizes.skills?.width || 450) - rightMargin),
        y: Math.min(topMargin + verticalSpacing, viewportHeight - (windowSizes.skills?.height || 550) - bottomMargin)
      },
    }

    // Return position for this window or safe default
    const defaultPos = desktopPositions[windowId]
    if (defaultPos) {
      // Ensure position is within viewport bounds
      return {
        x: Math.max(leftMargin, Math.min(defaultPos.x, viewportWidth - 400 - rightMargin)),
        y: Math.max(topMargin, Math.min(defaultPos.y, viewportHeight - 400 - bottomMargin))
      }
    }

    // Fallback for unknown windows - center on screen
    return {
      x: Math.max(leftMargin, (viewportWidth - 400) / 2),
      y: Math.max(topMargin, (viewportHeight - 500) / 2)
    }
  }

  shouldBeFullscreen(): boolean {
    return this.isMobile()
  }

  getModalBackdrop() {
    return this.isMobile() ? {
      show: true,
      opacity: 0.5
    } : {
      show: false,
      opacity: 0
    }
  }

  getMaxWindowWidth(): number {
    const screenSize = this.getScreenSize()
    if (screenSize === ScreenSize.MOBILE) return window.innerWidth
    if (screenSize === ScreenSize.TABLET) return 500
    return 600
  }

  getMinWindowWidth(): number {
    const screenSize = this.getScreenSize()
    if (screenSize === ScreenSize.MOBILE) return window.innerWidth
    if (screenSize === ScreenSize.TABLET) return 350
    return 300
  }

  // Calculate smart grid positioning for multiple windows
  getGridPosition(windowIndex: number, totalWindows: number) {
    const screenSize = this.getScreenSize()

    if (screenSize === ScreenSize.MOBILE) {
      // Mobile: stack vertically from bottom, prevent going off-screen
      const maxY = window.innerHeight - 100
      const calculatedY = window.innerHeight - 300 - (windowIndex * 60)
      return {
        x: 0,
        y: Math.max(calculatedY, maxY - (totalWindows * 60))
      }
    }

    if (screenSize === ScreenSize.TABLET) {
      // Tablet: right side stack, prevent going off-screen
      const maxY = window.innerHeight - 100
      const calculatedY = 80 + (windowIndex * 60)
      return {
        x: window.innerWidth - 420,
        y: Math.min(calculatedY, maxY - (totalWindows * 60))
      }
    }

    // Desktop: cascade from top-right, prevent going off-screen
    const maxX = window.innerWidth - 100
    const maxY = window.innerHeight - 100
    const calculatedX = window.innerWidth - 520 - (windowIndex * 30)
    const calculatedY = 100 + (windowIndex * 40)
    
    return {
      x: Math.max(calculatedX, maxX - (totalWindows * 30)),
      y: Math.min(calculatedY, maxY - (totalWindows * 40))
    }
  }

  // Check if window should use bottom sheet style (mobile)
  useBottomSheet(): boolean {
    return this.isMobile()
  }

  // Get appropriate z-index based on screen size
  getBaseZIndex(): number {
    return this.isMobile() ? 2000 : 1000
  }
}

export const windowManager = ResponsiveWindowManager.getInstance()
