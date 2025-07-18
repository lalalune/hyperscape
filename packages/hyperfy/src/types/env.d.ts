/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MODE: string
  readonly BASE_URL: string
  readonly PROD: boolean
  readonly DEV: boolean
  readonly SSR: boolean

  // Hyperfy-specific environment variables
  readonly PUBLIC_SERVER_URL?: string
  readonly PUBLIC_API_URL?: string
  readonly PUBLIC_ASSETS_URL?: string
  readonly PUBLIC_MAX_UPLOAD_SIZE?: string

  // LiveKit configuration
  readonly LIVEKIT_URL?: string
  readonly LIVEKIT_API_KEY?: string
  readonly LIVEKIT_API_SECRET?: string
  // Note: LIVEKIT_API_SECRET, JWT_SECRET, and ADMIN_CODE are server-only
  // and should not be exposed to the client

  // Public variables
  readonly PUBLIC_API_URL?: string
  readonly PUBLIC_ASSETS_URL?: string
  readonly PUBLIC_MAX_UPLOAD_SIZE?: string

  // Hyperfy configuration
  readonly HYPERFY_ASSETS_URL?: string
  readonly HYPERFY_ASSETS_DIR?: string
  readonly HYPERFY_NETWORK_RATE?: string
  readonly HYPERFY_MAX_DELTA_TIME?: string
  readonly HYPERFY_FIXED_DELTA_TIME?: string
  readonly HYPERFY_LOG_LEVEL?: string
  readonly HYPERFY_PHYSICS_ENABLED?: string
  readonly HYPERFY_GRAVITY_X?: string
  readonly HYPERFY_GRAVITY_Y?: string
  readonly HYPERFY_GRAVITY_Z?: string

  // Build configuration
  readonly CLIENT_BUILD_DIR?: string
  readonly NO_CLIENT_SERVE?: string
  readonly COMMIT_HASH?: string

  // Allow any other environment variables
  [key: string]: string | boolean | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
