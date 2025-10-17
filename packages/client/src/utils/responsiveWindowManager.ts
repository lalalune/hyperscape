/**
 * Responsive Window Manager
 * Provides smart window positioning and sizing across mobile, tablet, and desktop
 */

export enum ScreenSize {
  MOBILE = 'mobile',
  TABLET = 'tablet',
  DESKTOP = 'desktop'
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
    return ScreenSize.DESKTOP
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

  getWindowDimensions(config?: WindowConfig) {
    const screenSize = this.getScreenSize()
    const defaultWidth = screenSize === ScreenSize.MOBILE ? window.innerWidth - 16 :
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
        return { x: 8, y: 60 }
      }
      // Bottom sheet style
      return {
        x: 8,
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

    // Desktop: grid-based layout matching screenshot
    if (config?.position?.desktop) {
      return config.position.desktop
    }

    // Grid layout based on window type (matching screenshot layout)
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    const desktopPositions: Record<string, { x: number; y: number }> = {
      // Top row (left to right) - based on screenshot proportions
      combat: { x: viewportWidth * 0.11, y: 75 },           // ~11% from left, top
      equipment: { x: viewportWidth * 0.28, y: 75 },        // ~28% from left, top
      inventory: { x: viewportWidth * 0.63, y: 75 },        // ~63% from left, top
      settings: { x: viewportWidth * 0.82, y: 75 },         // ~82% from left, top

      // Bottom row (left to right) - bottom aligned
      // Account is taller, so it needs to start higher to align bottoms with Skills
      account: { x: viewportWidth * 0.11, y: viewportHeight * 0.38 },   // ~11% from left, starts higher
      skills: { x: viewportWidth * 0.28, y: viewportHeight * 0.64 },    // ~28% from left, lower

      // Prefs is same as settings
      prefs: { x: viewportWidth * 0.82, y: 75 },
    }

    // Return position for this window or default top-right
    return desktopPositions[windowId] || {
      x: viewportWidth * 0.7,
      y: 100
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
    if (screenSize === ScreenSize.MOBILE) return window.innerWidth - 16
    if (screenSize === ScreenSize.TABLET) return 500
    return 600
  }

  getMinWindowWidth(): number {
    const screenSize = this.getScreenSize()
    if (screenSize === ScreenSize.MOBILE) return window.innerWidth - 16
    if (screenSize === ScreenSize.TABLET) return 350
    return 300
  }

  // Calculate smart grid positioning for multiple windows
  getGridPosition(windowIndex: number, totalWindows: number) {
    const screenSize = this.getScreenSize()

    if (screenSize === ScreenSize.MOBILE) {
      // Mobile: stack vertically from bottom
      return {
        x: 8,
        y: window.innerHeight - 300 - (windowIndex * 60)
      }
    }

    if (screenSize === ScreenSize.TABLET) {
      // Tablet: right side stack
      return {
        x: window.innerWidth - 420,
        y: 80 + (windowIndex * 60)
      }
    }

    // Desktop: cascade from top-right
    return {
      x: window.innerWidth - 520 - (windowIndex * 30),
      y: 100 + (windowIndex * 40)
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
