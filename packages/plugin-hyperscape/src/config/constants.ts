/**
 * Configuration constants for the Hyperscape plugin
 * All configurable values should be defined here to avoid hardcoding
 */

// Network Configuration
export const NETWORK_CONFIG = {
  DEFAULT_WS_URL: process.env.WS_URL || 'wss://chill.hyperscape.xyz/ws',
  DEFAULT_API_BASE: process.env.API_BASE || 'http://localhost:5555',
  RETRY_DELAY_MS: parseInt(process.env.RETRY_DELAY_MS || '5000'),
  CONNECTION_TIMEOUT_MS: parseInt(process.env.CONNECTION_TIMEOUT_MS || '10000'),
  UPLOAD_TIMEOUT_MS: parseInt(process.env.UPLOAD_TIMEOUT_MS || '30000'),
  MAX_UPLOAD_SIZE_MB: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10'),
} as const

// Agent Behavior Configuration
export const AGENT_CONFIG = {
  APPEARANCE_POLL_INTERVAL_MS: parseInt(
    process.env.APPEARANCE_POLL_INTERVAL_MS || '30000'
  ),
  BEHAVIOR_TIME_INTERVAL_MIN_MS: parseInt(
    process.env.BEHAVIOR_TIME_MIN_MS || '15000'
  ),
  BEHAVIOR_TIME_INTERVAL_MAX_MS: parseInt(
    process.env.BEHAVIOR_TIME_MAX_MS || '30000'
  ),
  RANDOM_WALK_INTERVAL_MS: parseInt(
    process.env.RANDOM_WALK_INTERVAL_MS || '5000'
  ),
  RANDOM_WALK_MAX_DISTANCE: parseInt(
    process.env.RANDOM_WALK_MAX_DISTANCE || '7'
  ),
} as const

// Controls Configuration
export const CONTROLS_CONFIG = {
  TICK_INTERVAL_MS: parseInt(process.env.CONTROLS_TICK_INTERVAL_MS || '100'),
  NAVIGATION_STOP_DISTANCE: parseFloat(
    process.env.NAVIGATION_STOP_DISTANCE || '0.5'
  ),
  FOLLOW_STOP_DISTANCE: parseFloat(process.env.FOLLOW_STOP_DISTANCE || '2.5'),
  ACTION_DEFAULT_DURATION_MS: parseInt(
    process.env.ACTION_DURATION_MS || '5555'
  ),
} as const

// Game Configuration
export const GAME_CONFIG = {
  KILL_COOLDOWN_MS: parseInt(process.env.KILL_COOLDOWN_MS || '20000'),
  BUBBLE_DURATION_MS: parseInt(process.env.BUBBLE_DURATION_MS || '5000'),
  OBSERVATION_DURATION_MS: parseInt(
    process.env.OBSERVATION_DURATION_MS || '5555'
  ),
} as const

// Voice Configuration
export const VOICE_CONFIG = {
  SAMPLE_RATE: parseInt(process.env.VOICE_SAMPLE_RATE || '48000'),
  TRANSCRIPTION_DEBOUNCE_MS: parseInt(process.env.VOICE_DEBOUNCE_MS || '1500'),
} as const

// Testing Configuration
export const TEST_CONFIG = {
  DEFAULT_TIMEOUT_MS: parseInt(process.env.TEST_TIMEOUT_MS || '5000'),
  WAIT_DURATION_MS: parseInt(process.env.TEST_WAIT_MS || '5555'),
  LONG_WAIT_DURATION_MS: parseInt(process.env.TEST_LONG_WAIT_MS || '5000'),
  GAME_DURATION_MS: parseInt(process.env.TEST_GAME_DURATION_MS || '300000'), // 5 minutes
} as const

// Visual Configuration
export const VISUAL_CONFIG = {
  FLOOR_COLOR: parseInt(process.env.FLOOR_COLOR || '0x808080'),
  VICTIM_COLOR: parseInt(process.env.VICTIM_COLOR || '0x0000ff'),
  BODY_COLOR: parseInt(process.env.BODY_COLOR || '0x333333'),
  UI_Z_INDEX: parseInt(process.env.UI_Z_INDEX || '10000'),
} as const

// 3D Graphics Configuration
export const GRAPHICS_CONFIG = {
  SPHERE_GEOMETRY_RADIUS: parseInt(process.env.SPHERE_RADIUS || '1000'),
  SPHERE_WIDTH_SEGMENTS: parseInt(process.env.SPHERE_WIDTH_SEGMENTS || '60'),
  SPHERE_HEIGHT_SEGMENTS: parseInt(process.env.SPHERE_HEIGHT_SEGMENTS || '40'),
  CUBE_CAMERA_NEAR: parseFloat(process.env.CUBE_CAMERA_NEAR || '0.1'),
  CUBE_CAMERA_FAR: parseFloat(process.env.CUBE_CAMERA_FAR || '1000'),
  RENDER_TARGET_WIDTH: parseInt(process.env.RENDER_TARGET_WIDTH || '2048'),
  RENDER_TARGET_HEIGHT: parseInt(process.env.RENDER_TARGET_HEIGHT || '1024'),
  TEXTURE_SIZE: parseInt(process.env.TEXTURE_SIZE || '1024'),
} as const

// Development flags
export const DEV_CONFIG = {
  ENABLE_DEBUG_LOGGING: process.env.ENABLE_DEBUG_LOGGING === 'true',
  ENABLE_PERFORMANCE_MONITORING:
    process.env.ENABLE_PERFORMANCE_MONITORING === 'true',
  USE_MOCK_WORLD: process.env.USE_MOCK_WORLD === 'true',
} as const
