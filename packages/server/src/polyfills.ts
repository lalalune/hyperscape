// Browser polyfills for server-side Three.js/GLTF loading
// This file sets up global browser-like objects needed by Three.js loaders

/* eslint-disable @typescript-eslint/no-explicit-any */

import path from 'path'

interface GlobalWithPolyfills {
  self: GlobalWithPolyfills
  URL: typeof URL
  webkitURL: typeof URL
  window: GlobalWithPolyfills
  location: {
    origin: string
    href: string
    protocol: string
    host: string
    hostname: string
    port: string
    pathname: string
    search: string
    hash: string
  }
  document: {
    createElement: (tag: string) => object
    URL: typeof URL
    baseURI: string
  }
  performance: {
    now: () => number
    timeOrigin: number
  }
  path: typeof path
  nodePath: typeof path
  require: (id: string) => any
  __dirname: string
  __filename: string
}

// Set up self global with URL support for GLTFLoader
const globalWithPolyfills = globalThis as unknown as GlobalWithPolyfills
globalWithPolyfills.self = globalWithPolyfills
globalWithPolyfills.self.URL = URL
globalWithPolyfills.self.webkitURL = URL

// Ensure URL is available globally
if (!globalWithPolyfills.URL) {
  globalWithPolyfills.URL = URL
}

// Set up window global
globalWithPolyfills.window = globalWithPolyfills

// Add location object needed by PhysX loader
globalWithPolyfills.window.location = {
  origin: 'http://localhost:5555',
  href: 'http://localhost:5555',
  protocol: 'http:',
  host: 'localhost:5555',
  hostname: 'localhost',
  port: '5555',
  pathname: '/',
  search: '',
  hash: ''
};

// Basic document mock for loaders that check for it
globalWithPolyfills.document = {
  createElement: (tag: string) => {
    if (tag === 'canvas') {
      // Mock canvas for image loading and UI rendering
      // Provide a complete 2D context mock to prevent UIRenderer errors
      return {
        style: {},
        width: 1024,
        height: 1024,
        getContext: (contextType?: string) => {
          if (contextType === '2d' || contextType == null) {
            // Return a mock 2D context with all required methods
            return {
              // Drawing methods
              fillRect: () => {},
              strokeRect: () => {},
              clearRect: () => {},
              
              // Text methods
              fillText: () => {},
              strokeText: () => {},
              measureText: () => ({ width: 100 }),
              
              // Path methods
              beginPath: () => {},
              closePath: () => {},
              moveTo: () => {},
              lineTo: () => {},
              arc: () => {},
              arcTo: () => {},
              quadraticCurveTo: () => {},
              bezierCurveTo: () => {},
              
              // Style methods
              fill: () => {},
              stroke: () => {},
              clip: () => {},
              
              // Image methods
              drawImage: () => {},
              getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
              putImageData: () => {},
              createImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
              
              // Transform methods
              save: () => {},
              restore: () => {},
              translate: () => {},
              rotate: () => {},
              scale: () => {},
              transform: () => {},
              setTransform: () => {},
              
              // Style properties (with setters)
              set fillStyle(_value: any) {},
              get fillStyle() { return '#000000'; },
              set strokeStyle(_value: any) {},
              get strokeStyle() { return '#000000'; },
              set lineWidth(_value: any) {},
              get lineWidth() { return 1; },
              set font(_value: any) {},
              get font() { return '10px sans-serif'; },
              set textAlign(_value: unknown) {},
              get textAlign() { return 'start' as 'left' | 'right' | 'center' | 'start' | 'end'; },
              set textBaseline(_value: unknown) {},
              get textBaseline() { return 'alphabetic' as 'top' | 'hanging' | 'middle' | 'alphabetic' | 'ideographic' | 'bottom'; },
              set globalAlpha(_value: any) {},
              get globalAlpha() { return 1; },
              set globalCompositeOperation(_value: any) {},
              get globalCompositeOperation() { return 'source-over'; },
              
              // Other properties
              canvas: null as any,
            };
          }
          return null;
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        toDataURL: () => 'data:image/png;base64,'
      };
    }
    return {
      style: {},
      addEventListener: () => {},
      removeEventListener: () => {}
    };
  },
  // Add URL for document base URL resolution
  URL: URL,
  baseURI: 'http://localhost:5555'
};

// Add performance API if not available
if (!globalWithPolyfills.performance) {
  globalWithPolyfills.performance = {
    now: () => Date.now(),
    timeOrigin: Date.now()
  };
}

// Add path normalization support

if (!globalWithPolyfills.path) {
  globalWithPolyfills.path = path;
}

// PhysX loader needs nodePath
if (!globalWithPolyfills.nodePath) {
  globalWithPolyfills.nodePath = path;
}

// Ensure require is available for PhysX module
if (typeof require === 'undefined' && !globalWithPolyfills.require) {
  globalWithPolyfills.require = (id: string) => {
    if (id === 'path') return path;
    if (id === 'fs') return null; // PhysX checks for fs but doesn't need it in browser mode
    throw new Error(`Module not found: ${id}`);
  };
}

// Add __dirname and __filename for modules that might need them
if (typeof __dirname === 'undefined') {
  globalWithPolyfills.__dirname = process.cwd();
}
if (typeof __filename === 'undefined') {
  globalWithPolyfills.__filename = import.meta.url;
}

// Export empty object to make this a module
export {}

// Install WebSocket polyfill for Node environments (used by NodeClient/ServerBot)
// Only if a global WebSocket implementation is not already present
// Top-level await is supported in ESM; guard in try/catch to avoid startup failure
try {
  const g = globalThis as unknown as { WebSocket?: unknown } & Record<string, unknown>
  if (!g.WebSocket) {
    const mod = await import('ws')
    // ws exports the constructor as default
    const WS = (mod as unknown as { default?: unknown }).default || mod
    g.WebSocket = WS as unknown
  }
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('[Polyfills] Failed to install WebSocket polyfill:', err)
}