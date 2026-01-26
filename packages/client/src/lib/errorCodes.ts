/**
 * Structured Error Codes for Hyperscape Client
 *
 * Provides consistent error codes for error handling and reporting.
 * Each error code is unique and can be used for debugging and analytics.
 *
 * @packageDocumentation
 */

/**
 * Error code categories
 * E0xx: Network errors
 * E1xx: Authentication errors
 * E2xx: Asset/Resource errors
 * E3xx: Game state errors
 * E4xx: UI errors
 * E5xx: Input/Validation errors
 * E6xx: WebSocket errors
 * E7xx: Performance errors
 * E8xx: Storage errors
 * E9xx: System errors
 */
export enum ErrorCode {
  // Network Errors (E0xx)
  NETWORK_DISCONNECTED = "E001",
  NETWORK_TIMEOUT = "E002",
  NETWORK_REQUEST_FAILED = "E003",
  NETWORK_CORS_ERROR = "E004",
  NETWORK_SSL_ERROR = "E005",

  // Authentication Errors (E1xx)
  AUTH_FAILED = "E101",
  AUTH_TOKEN_EXPIRED = "E102",
  AUTH_TOKEN_INVALID = "E103",
  AUTH_SESSION_EXPIRED = "E104",
  AUTH_PRIVY_ERROR = "E105",
  AUTH_WALLET_ERROR = "E106",
  AUTH_USERNAME_TAKEN = "E107",
  AUTH_RATE_LIMITED = "E108",

  // Asset/Resource Errors (E2xx)
  ASSET_LOAD_FAILED = "E201",
  ASSET_NOT_FOUND = "E202",
  ASSET_CORRUPTED = "E203",
  ASSET_TIMEOUT = "E204",
  MODEL_LOAD_FAILED = "E205",
  TEXTURE_LOAD_FAILED = "E206",
  AUDIO_LOAD_FAILED = "E207",
  MANIFEST_LOAD_FAILED = "E208",

  // Game State Errors (E3xx)
  GAME_STATE_INVALID = "E301",
  PLAYER_NOT_FOUND = "E302",
  ENTITY_NOT_FOUND = "E303",
  WORLD_NOT_LOADED = "E304",
  SYSTEM_NOT_FOUND = "E305",
  COMBAT_ERROR = "E306",
  INVENTORY_ERROR = "E307",
  SKILL_ERROR = "E308",

  // UI Errors (E4xx)
  UI_RENDER_ERROR = "E401",
  UI_PANEL_ERROR = "E402",
  UI_COMPONENT_ERROR = "E403",
  UI_STATE_ERROR = "E404",
  UI_ANIMATION_ERROR = "E405",

  // Input/Validation Errors (E5xx)
  INPUT_INVALID = "E501",
  INPUT_XSS_DETECTED = "E502",
  INPUT_INJECTION_DETECTED = "E503",
  VALIDATION_FAILED = "E504",
  FORMAT_INVALID = "E505",

  // WebSocket Errors (E6xx)
  WS_CONNECTION_FAILED = "E601",
  WS_MESSAGE_INVALID = "E602",
  WS_HEARTBEAT_FAILED = "E603",
  WS_RECONNECT_FAILED = "E604",
  WS_PROTOCOL_ERROR = "E605",

  // Performance Errors (E7xx)
  PERF_MEMORY_HIGH = "E701",
  PERF_FPS_LOW = "E702",
  PERF_TIMEOUT = "E703",
  PERF_RESOURCE_LEAK = "E704",

  // Storage Errors (E8xx)
  STORAGE_QUOTA_EXCEEDED = "E801",
  STORAGE_ACCESS_DENIED = "E802",
  STORAGE_CORRUPTED = "E803",
  STORAGE_UNAVAILABLE = "E804",

  // System Errors (E9xx)
  SYSTEM_UNKNOWN = "E901",
  SYSTEM_WEBGL_ERROR = "E902",
  SYSTEM_PHYSICS_ERROR = "E903",
  SYSTEM_AUDIO_ERROR = "E904",
  SYSTEM_BROWSER_UNSUPPORTED = "E905",
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  /** Informational - doesn't affect functionality */
  INFO = "info",
  /** Warning - degraded functionality but still usable */
  WARNING = "warning",
  /** Error - functionality is broken */
  ERROR = "error",
  /** Critical - application cannot continue */
  CRITICAL = "critical",
}

/**
 * Error metadata
 */
interface ErrorMeta {
  code: ErrorCode;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  recoverable: boolean;
}

/**
 * Error code metadata registry
 */
export const ERROR_META: Record<ErrorCode, ErrorMeta> = {
  // Network Errors
  [ErrorCode.NETWORK_DISCONNECTED]: {
    code: ErrorCode.NETWORK_DISCONNECTED,
    severity: ErrorSeverity.ERROR,
    message: "Network connection lost",
    userMessage: "Connection lost. Reconnecting...",
    recoverable: true,
  },
  [ErrorCode.NETWORK_TIMEOUT]: {
    code: ErrorCode.NETWORK_TIMEOUT,
    severity: ErrorSeverity.WARNING,
    message: "Network request timed out",
    userMessage: "Request timed out. Please try again.",
    recoverable: true,
  },
  [ErrorCode.NETWORK_REQUEST_FAILED]: {
    code: ErrorCode.NETWORK_REQUEST_FAILED,
    severity: ErrorSeverity.ERROR,
    message: "Network request failed",
    userMessage: "Failed to connect to server.",
    recoverable: true,
  },
  [ErrorCode.NETWORK_CORS_ERROR]: {
    code: ErrorCode.NETWORK_CORS_ERROR,
    severity: ErrorSeverity.ERROR,
    message: "CORS error",
    userMessage: "Connection blocked. Please contact support.",
    recoverable: false,
  },
  [ErrorCode.NETWORK_SSL_ERROR]: {
    code: ErrorCode.NETWORK_SSL_ERROR,
    severity: ErrorSeverity.CRITICAL,
    message: "SSL/TLS error",
    userMessage: "Secure connection failed.",
    recoverable: false,
  },

  // Auth Errors
  [ErrorCode.AUTH_FAILED]: {
    code: ErrorCode.AUTH_FAILED,
    severity: ErrorSeverity.ERROR,
    message: "Authentication failed",
    userMessage: "Login failed. Please try again.",
    recoverable: true,
  },
  [ErrorCode.AUTH_TOKEN_EXPIRED]: {
    code: ErrorCode.AUTH_TOKEN_EXPIRED,
    severity: ErrorSeverity.WARNING,
    message: "Auth token expired",
    userMessage: "Session expired. Please log in again.",
    recoverable: true,
  },
  [ErrorCode.AUTH_TOKEN_INVALID]: {
    code: ErrorCode.AUTH_TOKEN_INVALID,
    severity: ErrorSeverity.ERROR,
    message: "Auth token invalid",
    userMessage: "Invalid session. Please log in again.",
    recoverable: true,
  },
  [ErrorCode.AUTH_SESSION_EXPIRED]: {
    code: ErrorCode.AUTH_SESSION_EXPIRED,
    severity: ErrorSeverity.WARNING,
    message: "Session expired",
    userMessage: "Your session has expired.",
    recoverable: true,
  },
  [ErrorCode.AUTH_PRIVY_ERROR]: {
    code: ErrorCode.AUTH_PRIVY_ERROR,
    severity: ErrorSeverity.ERROR,
    message: "Privy authentication error",
    userMessage: "Authentication service error.",
    recoverable: true,
  },
  [ErrorCode.AUTH_WALLET_ERROR]: {
    code: ErrorCode.AUTH_WALLET_ERROR,
    severity: ErrorSeverity.ERROR,
    message: "Wallet connection error",
    userMessage: "Failed to connect wallet.",
    recoverable: true,
  },
  [ErrorCode.AUTH_USERNAME_TAKEN]: {
    code: ErrorCode.AUTH_USERNAME_TAKEN,
    severity: ErrorSeverity.INFO,
    message: "Username already taken",
    userMessage: "This username is already in use.",
    recoverable: true,
  },
  [ErrorCode.AUTH_RATE_LIMITED]: {
    code: ErrorCode.AUTH_RATE_LIMITED,
    severity: ErrorSeverity.WARNING,
    message: "Too many auth attempts",
    userMessage: "Too many attempts. Please wait.",
    recoverable: true,
  },

  // Asset Errors
  [ErrorCode.ASSET_LOAD_FAILED]: {
    code: ErrorCode.ASSET_LOAD_FAILED,
    severity: ErrorSeverity.ERROR,
    message: "Asset failed to load",
    userMessage: "Failed to load game assets.",
    recoverable: true,
  },
  [ErrorCode.ASSET_NOT_FOUND]: {
    code: ErrorCode.ASSET_NOT_FOUND,
    severity: ErrorSeverity.WARNING,
    message: "Asset not found",
    userMessage: "Some content could not be loaded.",
    recoverable: true,
  },
  [ErrorCode.ASSET_CORRUPTED]: {
    code: ErrorCode.ASSET_CORRUPTED,
    severity: ErrorSeverity.ERROR,
    message: "Asset corrupted",
    userMessage: "Game data corrupted. Please refresh.",
    recoverable: true,
  },
  [ErrorCode.ASSET_TIMEOUT]: {
    code: ErrorCode.ASSET_TIMEOUT,
    severity: ErrorSeverity.WARNING,
    message: "Asset load timeout",
    userMessage: "Loading taking too long. Retrying...",
    recoverable: true,
  },
  [ErrorCode.MODEL_LOAD_FAILED]: {
    code: ErrorCode.MODEL_LOAD_FAILED,
    severity: ErrorSeverity.ERROR,
    message: "3D model failed to load",
    userMessage: "Failed to load 3D model.",
    recoverable: true,
  },
  [ErrorCode.TEXTURE_LOAD_FAILED]: {
    code: ErrorCode.TEXTURE_LOAD_FAILED,
    severity: ErrorSeverity.WARNING,
    message: "Texture failed to load",
    userMessage: "Some textures could not be loaded.",
    recoverable: true,
  },
  [ErrorCode.AUDIO_LOAD_FAILED]: {
    code: ErrorCode.AUDIO_LOAD_FAILED,
    severity: ErrorSeverity.WARNING,
    message: "Audio failed to load",
    userMessage: "Audio could not be loaded.",
    recoverable: true,
  },
  [ErrorCode.MANIFEST_LOAD_FAILED]: {
    code: ErrorCode.MANIFEST_LOAD_FAILED,
    severity: ErrorSeverity.CRITICAL,
    message: "Game manifest failed to load",
    userMessage: "Failed to load game data.",
    recoverable: false,
  },

  // Game State Errors
  [ErrorCode.GAME_STATE_INVALID]: {
    code: ErrorCode.GAME_STATE_INVALID,
    severity: ErrorSeverity.ERROR,
    message: "Invalid game state",
    userMessage: "Game state error. Please refresh.",
    recoverable: true,
  },
  [ErrorCode.PLAYER_NOT_FOUND]: {
    code: ErrorCode.PLAYER_NOT_FOUND,
    severity: ErrorSeverity.ERROR,
    message: "Player not found",
    userMessage: "Player data not found.",
    recoverable: true,
  },
  [ErrorCode.ENTITY_NOT_FOUND]: {
    code: ErrorCode.ENTITY_NOT_FOUND,
    severity: ErrorSeverity.WARNING,
    message: "Entity not found",
    userMessage: "Object not found.",
    recoverable: true,
  },
  [ErrorCode.WORLD_NOT_LOADED]: {
    code: ErrorCode.WORLD_NOT_LOADED,
    severity: ErrorSeverity.ERROR,
    message: "World not loaded",
    userMessage: "World failed to load.",
    recoverable: true,
  },
  [ErrorCode.SYSTEM_NOT_FOUND]: {
    code: ErrorCode.SYSTEM_NOT_FOUND,
    severity: ErrorSeverity.ERROR,
    message: "Game system not found",
    userMessage: "Game system error.",
    recoverable: false,
  },
  [ErrorCode.COMBAT_ERROR]: {
    code: ErrorCode.COMBAT_ERROR,
    severity: ErrorSeverity.WARNING,
    message: "Combat system error",
    userMessage: "Combat action failed.",
    recoverable: true,
  },
  [ErrorCode.INVENTORY_ERROR]: {
    code: ErrorCode.INVENTORY_ERROR,
    severity: ErrorSeverity.WARNING,
    message: "Inventory system error",
    userMessage: "Inventory action failed.",
    recoverable: true,
  },
  [ErrorCode.SKILL_ERROR]: {
    code: ErrorCode.SKILL_ERROR,
    severity: ErrorSeverity.WARNING,
    message: "Skill system error",
    userMessage: "Skill action failed.",
    recoverable: true,
  },

  // UI Errors
  [ErrorCode.UI_RENDER_ERROR]: {
    code: ErrorCode.UI_RENDER_ERROR,
    severity: ErrorSeverity.ERROR,
    message: "UI render error",
    userMessage: "Display error occurred.",
    recoverable: true,
  },
  [ErrorCode.UI_PANEL_ERROR]: {
    code: ErrorCode.UI_PANEL_ERROR,
    severity: ErrorSeverity.WARNING,
    message: "Panel error",
    userMessage: "Panel failed to load.",
    recoverable: true,
  },
  [ErrorCode.UI_COMPONENT_ERROR]: {
    code: ErrorCode.UI_COMPONENT_ERROR,
    severity: ErrorSeverity.WARNING,
    message: "UI component error",
    userMessage: "Component error.",
    recoverable: true,
  },
  [ErrorCode.UI_STATE_ERROR]: {
    code: ErrorCode.UI_STATE_ERROR,
    severity: ErrorSeverity.WARNING,
    message: "UI state error",
    userMessage: "UI state error.",
    recoverable: true,
  },
  [ErrorCode.UI_ANIMATION_ERROR]: {
    code: ErrorCode.UI_ANIMATION_ERROR,
    severity: ErrorSeverity.INFO,
    message: "Animation error",
    userMessage: "Animation error.",
    recoverable: true,
  },

  // Input Errors
  [ErrorCode.INPUT_INVALID]: {
    code: ErrorCode.INPUT_INVALID,
    severity: ErrorSeverity.INFO,
    message: "Invalid input",
    userMessage: "Please check your input.",
    recoverable: true,
  },
  [ErrorCode.INPUT_XSS_DETECTED]: {
    code: ErrorCode.INPUT_XSS_DETECTED,
    severity: ErrorSeverity.WARNING,
    message: "XSS attempt detected",
    userMessage: "Invalid characters detected.",
    recoverable: true,
  },
  [ErrorCode.INPUT_INJECTION_DETECTED]: {
    code: ErrorCode.INPUT_INJECTION_DETECTED,
    severity: ErrorSeverity.WARNING,
    message: "Injection attempt detected",
    userMessage: "Invalid input detected.",
    recoverable: true,
  },
  [ErrorCode.VALIDATION_FAILED]: {
    code: ErrorCode.VALIDATION_FAILED,
    severity: ErrorSeverity.INFO,
    message: "Validation failed",
    userMessage: "Please check your input.",
    recoverable: true,
  },
  [ErrorCode.FORMAT_INVALID]: {
    code: ErrorCode.FORMAT_INVALID,
    severity: ErrorSeverity.INFO,
    message: "Invalid format",
    userMessage: "Invalid format.",
    recoverable: true,
  },

  // WebSocket Errors
  [ErrorCode.WS_CONNECTION_FAILED]: {
    code: ErrorCode.WS_CONNECTION_FAILED,
    severity: ErrorSeverity.ERROR,
    message: "WebSocket connection failed",
    userMessage: "Connection failed. Reconnecting...",
    recoverable: true,
  },
  [ErrorCode.WS_MESSAGE_INVALID]: {
    code: ErrorCode.WS_MESSAGE_INVALID,
    severity: ErrorSeverity.WARNING,
    message: "Invalid WebSocket message",
    userMessage: "Communication error.",
    recoverable: true,
  },
  [ErrorCode.WS_HEARTBEAT_FAILED]: {
    code: ErrorCode.WS_HEARTBEAT_FAILED,
    severity: ErrorSeverity.WARNING,
    message: "Heartbeat failed",
    userMessage: "Connection unstable.",
    recoverable: true,
  },
  [ErrorCode.WS_RECONNECT_FAILED]: {
    code: ErrorCode.WS_RECONNECT_FAILED,
    severity: ErrorSeverity.ERROR,
    message: "Reconnection failed",
    userMessage: "Failed to reconnect.",
    recoverable: true,
  },
  [ErrorCode.WS_PROTOCOL_ERROR]: {
    code: ErrorCode.WS_PROTOCOL_ERROR,
    severity: ErrorSeverity.ERROR,
    message: "WebSocket protocol error",
    userMessage: "Protocol error.",
    recoverable: false,
  },

  // Performance Errors
  [ErrorCode.PERF_MEMORY_HIGH]: {
    code: ErrorCode.PERF_MEMORY_HIGH,
    severity: ErrorSeverity.WARNING,
    message: "High memory usage",
    userMessage: "Performance may be affected.",
    recoverable: true,
  },
  [ErrorCode.PERF_FPS_LOW]: {
    code: ErrorCode.PERF_FPS_LOW,
    severity: ErrorSeverity.INFO,
    message: "Low FPS detected",
    userMessage: "Performance is low.",
    recoverable: true,
  },
  [ErrorCode.PERF_TIMEOUT]: {
    code: ErrorCode.PERF_TIMEOUT,
    severity: ErrorSeverity.WARNING,
    message: "Performance timeout",
    userMessage: "Operation timed out.",
    recoverable: true,
  },
  [ErrorCode.PERF_RESOURCE_LEAK]: {
    code: ErrorCode.PERF_RESOURCE_LEAK,
    severity: ErrorSeverity.WARNING,
    message: "Resource leak detected",
    userMessage: "Please refresh to improve performance.",
    recoverable: true,
  },

  // Storage Errors
  [ErrorCode.STORAGE_QUOTA_EXCEEDED]: {
    code: ErrorCode.STORAGE_QUOTA_EXCEEDED,
    severity: ErrorSeverity.WARNING,
    message: "Storage quota exceeded",
    userMessage: "Storage full. Please clear browser data.",
    recoverable: true,
  },
  [ErrorCode.STORAGE_ACCESS_DENIED]: {
    code: ErrorCode.STORAGE_ACCESS_DENIED,
    severity: ErrorSeverity.ERROR,
    message: "Storage access denied",
    userMessage: "Storage access denied.",
    recoverable: false,
  },
  [ErrorCode.STORAGE_CORRUPTED]: {
    code: ErrorCode.STORAGE_CORRUPTED,
    severity: ErrorSeverity.ERROR,
    message: "Storage corrupted",
    userMessage: "Saved data corrupted.",
    recoverable: true,
  },
  [ErrorCode.STORAGE_UNAVAILABLE]: {
    code: ErrorCode.STORAGE_UNAVAILABLE,
    severity: ErrorSeverity.ERROR,
    message: "Storage unavailable",
    userMessage: "Storage unavailable.",
    recoverable: false,
  },

  // System Errors
  [ErrorCode.SYSTEM_UNKNOWN]: {
    code: ErrorCode.SYSTEM_UNKNOWN,
    severity: ErrorSeverity.ERROR,
    message: "Unknown system error",
    userMessage: "An error occurred.",
    recoverable: true,
  },
  [ErrorCode.SYSTEM_WEBGL_ERROR]: {
    code: ErrorCode.SYSTEM_WEBGL_ERROR,
    severity: ErrorSeverity.CRITICAL,
    message: "WebGL error",
    userMessage: "Graphics error. Please update your browser.",
    recoverable: false,
  },
  [ErrorCode.SYSTEM_PHYSICS_ERROR]: {
    code: ErrorCode.SYSTEM_PHYSICS_ERROR,
    severity: ErrorSeverity.ERROR,
    message: "Physics system error",
    userMessage: "Physics error.",
    recoverable: true,
  },
  [ErrorCode.SYSTEM_AUDIO_ERROR]: {
    code: ErrorCode.SYSTEM_AUDIO_ERROR,
    severity: ErrorSeverity.WARNING,
    message: "Audio system error",
    userMessage: "Audio error.",
    recoverable: true,
  },
  [ErrorCode.SYSTEM_BROWSER_UNSUPPORTED]: {
    code: ErrorCode.SYSTEM_BROWSER_UNSUPPORTED,
    severity: ErrorSeverity.CRITICAL,
    message: "Browser not supported",
    userMessage: "Please use a modern browser.",
    recoverable: false,
  },
};

/**
 * Gets error metadata by code
 */
export function getErrorMeta(code: ErrorCode): ErrorMeta {
  return ERROR_META[code];
}

/**
 * Gets user-friendly message for an error code
 */
export function getUserMessage(code: ErrorCode): string {
  return ERROR_META[code]?.userMessage ?? "An error occurred.";
}

/**
 * Checks if an error is recoverable
 */
export function isRecoverable(code: ErrorCode): boolean {
  return ERROR_META[code]?.recoverable ?? true;
}

/**
 * Gets error severity
 */
export function getErrorSeverity(code: ErrorCode): ErrorSeverity {
  return ERROR_META[code]?.severity ?? ErrorSeverity.ERROR;
}
