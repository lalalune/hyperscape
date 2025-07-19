import sourceMapSupport from 'source-map-support'
import path from 'path'
import { fileURLToPath } from 'url'

// read .env files
import 'dotenv-flow/config'

// support node source maps
sourceMapSupport.install()

// support `__dirname` in ESM
globalThis.__dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Bootstrap for server environment
 * Sets up necessary globals before SES lockdown
 */

// Only apply in Node.js environment
if (typeof window === 'undefined' && typeof process !== 'undefined') {
  console.log('[Bootstrap] Applying Node.js polyfills for Three.js...');
  // Create a proper URL global that GLTFLoader can use
  if (typeof globalThis.URL === 'undefined' && typeof require !== 'undefined') {
    const { URL } = require('url');
    (globalThis as any).URL = URL;
  }
  
  // Create a mock self object for GLTFLoader with blob URL support
  if (typeof globalThis.self === 'undefined') {
    const URLConstructor = globalThis.URL || require('url').URL;
    
    // Add createObjectURL and revokeObjectURL support
    const URLWithObjectSupport = {
      ...URLConstructor,
      createObjectURL: (blob: any) => {
        const id = `blob:mock-${Math.random().toString(36).substr(2, 9)}`;
        console.log('[Bootstrap] Created mock blob URL:', id);
        return id;
      },
      revokeObjectURL: (url: string) => {
        console.log('[Bootstrap] Revoked mock blob URL:', url);
      }
    };
    
    (globalThis as any).self = {
      URL: URLWithObjectSupport,
      webkitURL: URLWithObjectSupport,
    };
    
    // Also update the global URL
    (globalThis as any).URL = URLWithObjectSupport;
  }
  
  // Mock Image for texture loading
  if (typeof globalThis.Image === 'undefined') {
    (globalThis as any).Image = class MockImage {
      width = 1;
      height = 1;
      private _src = '';
      onload: (() => void) | null = null;
      onerror: ((error: any) => void) | null = null;
      
      constructor() {
        // Bind methods to ensure correct context
        this.addEventListener = this.addEventListener.bind(this);
        this.removeEventListener = this.removeEventListener.bind(this);
      }
      
      addEventListener(event: string, handler: Function) {
        if (event === 'load') {
          this.onload = handler as any;
        } else if (event === 'error') {
          this.onerror = handler as any;
        }
      }
      
      removeEventListener(event: string, handler: Function) {
        if (event === 'load' && this.onload === handler) {
          this.onload = null;
        } else if (event === 'error' && this.onerror === handler) {
          this.onerror = null;
        }
      }
      
      get src() {
        return this._src;
      }
      
      set src(value: string) {
        this._src = value;
        // Simulate successful load asynchronously
        process.nextTick(() => {
          if (this.onload) {
            this.onload();
          }
        });
      }
    };
  }
  
  // Mock window
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = {
      URL: globalThis.URL,
    };
  }
  
  // Mock document
  if (typeof globalThis.document === 'undefined') {
    (globalThis as any).document = {
      createElementNS: () => ({ style: {} }),
      createElement: (tagName: string) => {
        if (tagName === 'canvas') {
          return {
            width: 1,
            height: 1,
            style: {},
            getContext: (type: string) => {
              if (type === '2d') {
                return {
                  fillStyle: '',
                  fillRect: () => {},
                  getImageData: () => ({ data: new Uint8ClampedArray(4) }),
                  putImageData: () => {},
                  drawImage: () => {}
                };
              }
              return null;
            }
          };
        }
        if (tagName === 'img') {
          return new (globalThis as any).Image();
        }
        return { style: {} };
      }
    };
  }
  
  // Mock Blob constructor
  if (typeof globalThis.Blob === 'undefined') {
    (globalThis as any).Blob = class MockBlob {
      type: string;
      
      constructor(private parts: any[], private options?: any) {
        this.type = options?.type || '';
      }
    };
  }
}

export {};
