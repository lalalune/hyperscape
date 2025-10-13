/**
 * Farcaster Frame v2 Configuration
 * Provides metadata for deploying Hyperscape as a Farcaster mini-app
 */

/**
 * Farcaster Frame v2 configuration object
 * 
 * Defines metadata for deploying Hyperscape as a Farcaster Frame (mini-app).
 * 
 * @public
 */
export interface FarcasterFrameConfig {
  /** Frame protocol version (e.g., 'next' for v2) */
  version: string
  
  /** Preview image URL shown in Farcaster feed */
  imageUrl: string
  
  /** Launch button configuration */
  button: {
    /** Button text */
    title: string
    
    /** Action to perform when button is clicked */
    action: {
      /** Action type ('launch_frame' for Frame v2) */
      type: string
      
      /** Frame name displayed to user */
      name: string
      
      /** URL to launch the frame */
      url: string
      
      /** Optional splash screen image URL */
      splashImageUrl?: string
      
      /** Optional splash screen background color (hex) */
      splashBackgroundColor?: string
    }
  }
}

/**
 * Gets Farcaster Frame configuration based on environment variables
 * 
 * Returns frame configuration if Farcaster support is enabled via PUBLIC_ENABLE_FARCASTER,
 * otherwise returns null.
 * 
 * @returns Frame configuration or null if disabled
 * 
 * @public
 */
export function getFarcasterFrameConfig(): FarcasterFrameConfig | null {
  // Check if Farcaster is enabled
  const enableFarcaster = 
    (typeof window !== 'undefined' && (window as typeof window & { env?: { PUBLIC_ENABLE_FARCASTER?: string } }).env?.PUBLIC_ENABLE_FARCASTER === 'true') ||
    import.meta.env.PUBLIC_ENABLE_FARCASTER === 'true'

  if (!enableFarcaster) {
    return null
  }

  const appUrl = 
    (typeof window !== 'undefined' && (window as typeof window & { env?: { PUBLIC_APP_URL?: string } }).env?.PUBLIC_APP_URL) ||
    import.meta.env.PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '')

  return {
    version: 'next',
    imageUrl: `${appUrl}/preview.jpg`,
    button: {
      title: 'Play Hyperscape',
      action: {
        type: 'launch_frame',
        name: 'Hyperscape',
        url: appUrl,
        splashImageUrl: `${appUrl}/preview.jpg`,
        splashBackgroundColor: '#0a0a0f',
      },
    },
  }
}

/**
 * Generates HTML meta tags for Farcaster Frame v2
 * 
 * Creates properly formatted Open Graph and Frame-specific meta tags
 * for embedding Hyperscape in Farcaster posts. Returns an empty string
 * if Farcaster is disabled.
 * 
 * @returns HTML string with meta tags (for SSR/static HTML)
 * 
 * @example
 * ```typescript
 * const metaTags = generateFarcasterMetaTags();
 * // Insert into <head>:
 * // <meta property="fc:frame" content="next" />
 * // <meta property="fc:frame:image" content="..." />
 * // ...
 * ```
 * 
 * @public
 */
export function generateFarcasterMetaTags(): string {
  const config = getFarcasterFrameConfig()
  
  if (!config) {
    return ''
  }

  const metaTags = [
    `<meta property="fc:frame" content="${config.version}" />`,
    `<meta property="fc:frame:image" content="${config.imageUrl}" />`,
    `<meta property="fc:frame:button:1" content="${config.button.title}" />`,
    `<meta property="fc:frame:button:1:action" content="${config.button.action.type}" />`,
    `<meta property="fc:frame:button:1:target" content="${config.button.action.url}" />`,
    `<meta property="og:image" content="${config.imageUrl}" />`,
    `<meta property="og:title" content="Hyperscape - 3D Multiplayer RPG" />`,
    `<meta property="og:description" content="A 3D multiplayer RPG adventure powered by Hyperscape" />`,
  ]

  if (config.button.action.splashImageUrl) {
    metaTags.push(
      `<meta property="fc:frame:splash:image" content="${config.button.action.splashImageUrl}" />`
    )
  }

  if (config.button.action.splashBackgroundColor) {
    metaTags.push(
      `<meta property="fc:frame:splash:background_color" content="${config.button.action.splashBackgroundColor}" />`
    )
  }

  return metaTags.join('\n')
}

/**
 * Injects Farcaster meta tags into the document head (for SPAs)
 * 
 * Dynamically adds Frame meta tags to the HTML head for client-side
 * rendered applications. Checks if tags are already present to avoid duplicates.
 * Does nothing if Farcaster is disabled or document is not available.
 * 
 * Call this during app initialization for SPA deployments.
 * 
 * @example
 * ```typescript
 * // In your app entry point:
 * injectFarcasterMetaTags();
 * ```
 * 
 * @public
 */
export function injectFarcasterMetaTags(): void {
  const config = getFarcasterFrameConfig()
  
  if (!config || typeof document === 'undefined') {
    return
  }

  // Check if already injected
  if (document.querySelector('meta[property="fc:frame"]')) {
    return
  }

  const metaTags = [
    { property: 'fc:frame', content: config.version },
    { property: 'fc:frame:image', content: config.imageUrl },
    { property: 'fc:frame:button:1', content: config.button.title },
    { property: 'fc:frame:button:1:action', content: config.button.action.type },
    { property: 'fc:frame:button:1:target', content: config.button.action.url },
    { property: 'og:image', content: config.imageUrl },
    { property: 'og:title', content: 'Hyperscape - 3D Multiplayer RPG' },
    { property: 'og:description', content: 'A 3D multiplayer RPG adventure powered by Hyperscape' },
  ]

  if (config.button.action.splashImageUrl) {
    metaTags.push({
      property: 'fc:frame:splash:image',
      content: config.button.action.splashImageUrl,
    })
  }

  if (config.button.action.splashBackgroundColor) {
    metaTags.push({
      property: 'fc:frame:splash:background_color',
      content: config.button.action.splashBackgroundColor,
    })
  }

  // Inject meta tags
  metaTags.forEach(({ property, content }) => {
    const meta = document.createElement('meta')
    meta.setAttribute('property', property)
    meta.setAttribute('content', content)
    document.head.appendChild(meta)
  })

  console.log('[Farcaster] Frame meta tags injected')
}


