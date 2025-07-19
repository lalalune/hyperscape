// Vitest Setup for Game Engine Testing
// Configures the test environment for Hyperfy game engine tests

import { vi } from 'vitest'
import { JSDOM } from 'jsdom'

// Set up DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:3000',
  pretendToBeVisual: true,
  resources: 'usable'
})

// Make DOM available globally
global.window = dom.window as any
global.document = dom.window.document
global.navigator = dom.window.navigator
global.HTMLElement = dom.window.HTMLElement
global.HTMLCanvasElement = dom.window.HTMLCanvasElement
global.CanvasRenderingContext2D = dom.window.CanvasRenderingContext2D
global.WebGLRenderingContext = dom.window.WebGLRenderingContext
global.Image = dom.window.Image

// Mock WebGL context for Three.js
const mockWebGLContext = {
  canvas: null,
  drawingBufferWidth: 1024,
  drawingBufferHeight: 768,
  getParameter: vi.fn(),
  getExtension: vi.fn(),
  createShader: vi.fn(),
  createProgram: vi.fn(),
  attachShader: vi.fn(),
  linkProgram: vi.fn(),
  useProgram: vi.fn(),
  createBuffer: vi.fn(),
  bindBuffer: vi.fn(),
  bufferData: vi.fn(),
  enableVertexAttribArray: vi.fn(),
  vertexAttribPointer: vi.fn(),
  drawElements: vi.fn(),
  drawArrays: vi.fn(),
  clear: vi.fn(),
  clearColor: vi.fn(),
  viewport: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  depthMask: vi.fn(),
  depthFunc: vi.fn(),
  frontFace: vi.fn(),
  cullFace: vi.fn(),
  blendFunc: vi.fn(),
  pixelStorei: vi.fn(),
  activeTexture: vi.fn(),
  bindTexture: vi.fn(),
  createTexture: vi.fn(),
  texImage2D: vi.fn(),
  texParameteri: vi.fn(),
  generateMipmap: vi.fn(),
  createFramebuffer: vi.fn(),
  bindFramebuffer: vi.fn(),
  createRenderbuffer: vi.fn(),
  bindRenderbuffer: vi.fn(),
  renderbufferStorage: vi.fn(),
  framebufferRenderbuffer: vi.fn(),
  framebufferTexture2D: vi.fn(),
  checkFramebufferStatus: vi.fn(() => 36053), // FRAMEBUFFER_COMPLETE
  deleteTexture: vi.fn(),
  deleteBuffer: vi.fn(),
  deleteFramebuffer: vi.fn(),
  deleteRenderbuffer: vi.fn(),
  deleteProgram: vi.fn(),
  deleteShader: vi.fn(),
  getShaderParameter: vi.fn(() => true),
  getProgramParameter: vi.fn(() => true),
  getShaderInfoLog: vi.fn(() => ''),
  getProgramInfoLog: vi.fn(() => ''),
  shaderSource: vi.fn(),
  compileShader: vi.fn(),
  getAttribLocation: vi.fn(() => 0),
  getUniformLocation: vi.fn(() => ({})),
  uniformMatrix4fv: vi.fn(),
  uniformMatrix3fv: vi.fn(),
  uniform4fv: vi.fn(),
  uniform3fv: vi.fn(),
  uniform2fv: vi.fn(),
  uniform1fv: vi.fn(),
  uniform4f: vi.fn(),
  uniform3f: vi.fn(),
  uniform2f: vi.fn(),
  uniform1f: vi.fn(),
  uniform1i: vi.fn(),
  VERTEX_SHADER: 35633,
  FRAGMENT_SHADER: 35632,
  COMPILE_STATUS: 35713,
  LINK_STATUS: 35714,
  ARRAY_BUFFER: 34962,
  ELEMENT_ARRAY_BUFFER: 34963,
  STATIC_DRAW: 35044,
  DYNAMIC_DRAW: 35048,
  FLOAT: 5126,
  UNSIGNED_SHORT: 5123,
  UNSIGNED_INT: 5125,
  TRIANGLES: 4,
  DEPTH_TEST: 2929,
  LEQUAL: 515,
  COLOR_BUFFER_BIT: 16384,
  DEPTH_BUFFER_BIT: 256,
  TEXTURE_2D: 3553,
  RGBA: 6408,
  UNSIGNED_BYTE: 5121,
  TEXTURE_WRAP_S: 10242,
  TEXTURE_WRAP_T: 10243,
  TEXTURE_MIN_FILTER: 10241,
  TEXTURE_MAG_FILTER: 10240,
  NEAREST: 9728,
  LINEAR: 9729,
  LINEAR_MIPMAP_LINEAR: 9987,
  CLAMP_TO_EDGE: 33071,
  REPEAT: 10497,
  FRAMEBUFFER: 36160,
  COLOR_ATTACHMENT0: 36064,
  DEPTH_ATTACHMENT: 36096,
  RENDERBUFFER: 36161,
  DEPTH_COMPONENT16: 33189,
}

// Mock HTMLCanvasElement.getContext
HTMLCanvasElement.prototype.getContext = vi.fn((contextType) => {
  if (contextType === 'webgl' || contextType === 'experimental-webgl') {
    return mockWebGLContext
  }
  if (contextType === '2d') {
    return {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      setTransform: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(1024 * 768 * 4),
        width: 1024,
        height: 768
      })),
      putImageData: vi.fn(),
      createImageData: vi.fn(),
      measureText: vi.fn(() => ({ width: 100 })),
      fillText: vi.fn(),
      strokeText: vi.fn(),
    }
  }
  return null
})

// Mock Performance API
global.performance = {
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByName: vi.fn(() => []),
  getEntriesByType: vi.fn(() => []),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn(),
} as any

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((callback) => {
  return setTimeout(callback, 16) // ~60fps
})

global.cancelAnimationFrame = vi.fn((id) => {
  clearTimeout(id)
})

// Mock Audio API
global.AudioContext = vi.fn(() => ({
  createOscillator: vi.fn(),
  createGain: vi.fn(),
  createBuffer: vi.fn(),
  createBufferSource: vi.fn(),
  destination: {},
  currentTime: 0,
  sampleRate: 44100,
  state: 'running',
  suspend: vi.fn(),
  resume: vi.fn(),
  close: vi.fn(),
}))

// Mock WebSocket for networking tests
global.WebSocket = vi.fn(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}))

// Mock File API
global.FileReader = vi.fn(() => ({
  readAsArrayBuffer: vi.fn(),
  readAsText: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  result: null,
  error: null,
  readyState: 0,
  EMPTY: 0,
  LOADING: 1,
  DONE: 2,
}))

// Mock Blob and URL
global.Blob = vi.fn()
global.URL = {
  createObjectURL: vi.fn(() => 'blob:mock-url'),
  revokeObjectURL: vi.fn(),
}

// Mock fetch for asset loading
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
    text: () => Promise.resolve('mock response'),
    json: () => Promise.resolve({}),
  })
) as any

// Console enhancements for test debugging
const originalConsoleLog = console.log
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

// Track game metrics from console output
let gameMetrics = {
  renderTime: 0,
  physicsTime: 0,
  pixelAccuracy: 0,
  geometryValidation: 0,
}

console.log = (...args) => {
  const message = args.join(' ')
  
  // Extract metrics from log messages
  const renderMatch = message.match(/render.*?(\d+\.?\d*)\s*ms/i)
  if (renderMatch) {
    gameMetrics.renderTime = Math.max(gameMetrics.renderTime, parseFloat(renderMatch[1]))
  }
  
  const physicsMatch = message.match(/physics.*?(\d+\.?\d*)\s*ms/i)
  if (physicsMatch) {
    gameMetrics.physicsTime = Math.max(gameMetrics.physicsTime, parseFloat(physicsMatch[1]))
  }
  
  const pixelMatch = message.match(/pixel.*?accuracy.*?(\d+\.?\d*)\s*%/i)
  if (pixelMatch) {
    gameMetrics.pixelAccuracy = Math.max(gameMetrics.pixelAccuracy, parseFloat(pixelMatch[1]))
  }
  
  const geometryMatch = message.match(/geometry.*?validation.*?(\d+\.?\d*)\s*%/i)
  if (geometryMatch) {
    gameMetrics.geometryValidation = Math.max(gameMetrics.geometryValidation, parseFloat(geometryMatch[1]))
  }
  
  originalConsoleLog(...args)
}

console.error = (...args) => {
  // Highlight errors for game engine issues
  originalConsoleError('🔴 GAME ENGINE ERROR:', ...args)
}

console.warn = (...args) => {
  // Highlight warnings for performance issues
  originalConsoleWarn('⚠️  GAME ENGINE WARNING:', ...args)
}

// Export game metrics for reporters
;(global as any).__GAME_METRICS__ = gameMetrics

// Setup cleanup
afterEach(() => {
  vi.clearAllMocks()
  
  // Reset game metrics
  gameMetrics = {
    renderTime: 0,
    physicsTime: 0,
    pixelAccuracy: 0,
    geometryValidation: 0,
  }
  ;(global as any).__GAME_METRICS__ = gameMetrics
})

// Global test utilities
;(global as any).testUtils = {
  // Create mock Three.js scene
  createMockScene: () => ({
    add: vi.fn(),
    remove: vi.fn(),
    getObjectByName: vi.fn(),
    traverse: vi.fn(),
    children: [],
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    matrix: {},
    matrixWorld: {},
    updateMatrixWorld: vi.fn(),
  }),
  
  // Create mock game world
  createMockWorld: () => ({
    network: {
      isServer: false,
      send: vi.fn(),
      on: vi.fn(),
    },
    players: {
      getAll: vi.fn(() => []),
      get: vi.fn(),
    },
    entities: {
      create: vi.fn(),
      destroy: vi.fn(),
      getAll: vi.fn(() => []),
    },
    apps: {
      getAll: vi.fn(() => []),
    },
    chat: {
      send: vi.fn(),
    },
    time: {
      now: () => Date.now(),
      delta: 16.67,
    }
  }),
  
  // Wait for next frame
  waitForFrame: () => new Promise(resolve => requestAnimationFrame(resolve)),
  
  // Wait for multiple frames
  waitForFrames: (count: number) => {
    let remaining = count
    return new Promise(resolve => {
      const step = () => {
        remaining--
        if (remaining <= 0) {
          resolve(undefined)
        } else {
          requestAnimationFrame(step)
        }
      }
      requestAnimationFrame(step)
    })
  },
  
  // Get current game metrics
  getGameMetrics: () => ({ ...(global as any).__GAME_METRICS__ }),
}

console.log('🧪 Test environment initialized for Hyperfy game engine')
console.log('📊 Game metrics tracking enabled')
console.log('🎮 Mock WebGL, Audio, and Network APIs ready')