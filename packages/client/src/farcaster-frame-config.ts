/**
 * Farcaster Frame v2 Configuration
 * Provides metadata for deploying Hyperscape as a Farcaster mini-app
 */

export interface FarcasterFrameConfig {
  version: string
  imageUrl: string
  button: {
    title: string
    action: {
      type: string
      name: string
      url: string
      splashImageUrl?: string
      splashBackgroundColor?: string
    }
  }
}

/**
 * Get Farcaster Frame configuration based on environment
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
 * Generate meta tags for Farcaster Frame v2
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
 * Inject Farcaster meta tags into document head (for SPA)
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


