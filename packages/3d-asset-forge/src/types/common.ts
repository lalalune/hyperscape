// Common callback types
export type ErrorCallback = (error: Error | string | { message: string; code?: string }) => void
export type SuccessCallback<T = void> = (result: T) => void
export type ProgressCallback = (progress: number) => void

// Common error types
export interface AppError extends Error {
  code?: string
  statusCode?: number
  details?: Record<string, string | number | boolean> | string | null
}

// Canvas and image types
export interface GripBounds {
  x: number
  y: number
  width: number
  height: number
  minX: number
  maxX: number
  minY: number
  maxY: number
  confidence?: number
}

export interface GripCoordinates {
  centerX: number
  centerY: number
  z: number
  redBox: {
    x: number
    y: number
    width: number
    height: number
  }
  bounds: GripBounds
  gripBounds: GripBounds  // Alternative name used in some contexts
  confidence?: number
}

// Extended grip data with weapon info
export interface GripDetectionData {
  gripBounds: GripBounds
  confidence: number
  weaponType?: string
  gripDescription?: string
}

// Detection types
export interface DetectionData {
  bounds?: { x: number; y: number; width: number; height: number }
  landmarks?: Array<{ x: number; y: number; z?: number }>
  label?: string
  score?: number
  confidence?: number
  class?: string
  id?: string | number
  metadata?: Record<string, string | number | boolean>
}

export interface Detection {
  type: string
  confidence: number
  data: DetectionData
}

// Capture types
export interface CaptureMetadata {
  width?: number
  height?: number
  format?: string
  source?: string
  cameraSettings?: {
    iso?: number
    aperture?: number
    shutterSpeed?: number
  }
  [key: string]: string | number | boolean | CaptureMetadata['cameraSettings'] | undefined
}

export interface Capture {
  image: string
  timestamp: number
  metadata?: CaptureMetadata
}

// Environment variables
export interface EnvironmentVariables {
  VITE_GENERATION_API_URL?: string
  VITE_OPENAI_API_KEY?: string
  VITE_MESHY_API_KEY?: string
  VITE_IMAGE_SERVER_URL?: string
}

// Window extensions
export interface ExtendedWindow extends Window {
  env?: EnvironmentVariables
  _rotationLogged?: boolean
  _lastLoggedRotation?: number
  _skeletonUpdateLogged?: boolean
  _lastSkeletonRotation?: number
}

// Import meta extensions
export interface ExtendedImportMeta extends ImportMeta {
  env?: EnvironmentVariables
}

// Generic event handlers
export type EventHandler<T = Event> = (event: T) => void
export type ChangeEventHandler<T = HTMLElement> = (event: React.ChangeEvent<T>) => void

// Generic function types
export type GenericFunction<TArgs extends readonly unknown[] = readonly unknown[], TReturn = void> = (...args: TArgs) => TReturn
export type GenericAsyncFunction<TArgs extends readonly unknown[] = readonly unknown[], TReturn = void> = (...args: TArgs) => Promise<TReturn>

// Serializable types that can be cached
export type CacheableValue = string | number | boolean | null | undefined | 
  CacheableValue[] | { [key: string]: CacheableValue }

// Cache event types
export interface CacheEvent<T extends CacheableValue = CacheableValue> {
  key: string
  value: T
}

// Token types for CSS generation
export interface CSSTokens {
  [key: string]: string | number | CSSTokens
}

// Debounced function type
export type DebouncedFunction<T extends GenericFunction> = T & {
  cancel: () => void
  flush: () => void
} 