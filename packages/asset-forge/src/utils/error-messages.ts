/**
 * Standardized Error Messages and Codes
 *
 * Provides consistent error handling across Asset Forge with:
 * - Structured error codes by category
 * - User-friendly and developer-friendly messages
 * - Proper error context and metadata
 */

/**
 * Standardized error codes organized by category
 */
export const ErrorCodes = {
  // Authentication errors (1000-1099)
  AUTH_MISSING_TOKEN: 'AUTH_1000',
  AUTH_INVALID_TOKEN: 'AUTH_1001',
  AUTH_EXPIRED_TOKEN: 'AUTH_1002',
  AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_1003',
  AUTH_NOT_AUTHENTICATED: 'AUTH_1004',
  AUTH_FORBIDDEN: 'AUTH_1005',

  // Validation errors (1100-1199)
  VALIDATION_INVALID_INPUT: 'VAL_1100',
  VALIDATION_MISSING_FIELD: 'VAL_1101',
  VALIDATION_INVALID_FORMAT: 'VAL_1102',
  VALIDATION_CONSTRAINT_VIOLATION: 'VAL_1103',
  VALIDATION_FILE_TYPE: 'VAL_1104',
  VALIDATION_FILE_SIZE: 'VAL_1105',

  // Generation errors (1200-1299)
  GENERATION_API_FAILED: 'GEN_1200',
  GENERATION_TIMEOUT: 'GEN_1201',
  GENERATION_INVALID_CONFIG: 'GEN_1202',
  GENERATION_PIPELINE_FAILED: 'GEN_1203',
  GENERATION_IMAGE_FAILED: 'GEN_1204',
  GENERATION_3D_FAILED: 'GEN_1205',

  // Asset errors (1300-1399)
  ASSET_NOT_FOUND: 'ASSET_1300',
  ASSET_INVALID_FORMAT: 'ASSET_1301',
  ASSET_UPLOAD_FAILED: 'ASSET_1302',
  ASSET_PROCESSING_FAILED: 'ASSET_1303',
  ASSET_DOWNLOAD_FAILED: 'ASSET_1304',
  ASSET_ALREADY_EXISTS: 'ASSET_1305',

  // Database errors (1400-1499)
  DB_CONNECTION_FAILED: 'DB_1400',
  DB_QUERY_FAILED: 'DB_1401',
  DB_CONSTRAINT_VIOLATION: 'DB_1402',
  DB_RECORD_NOT_FOUND: 'DB_1403',
  DB_TRANSACTION_FAILED: 'DB_1404',

  // External API errors (1500-1599)
  EXTERNAL_API_UNAVAILABLE: 'API_1500',
  EXTERNAL_API_RATE_LIMIT: 'API_1501',
  EXTERNAL_API_INVALID_RESPONSE: 'API_1502',
  EXTERNAL_API_TIMEOUT: 'API_1503',
  EXTERNAL_API_AUTH_FAILED: 'API_1504',

  // Voice generation errors (1600-1699)
  VOICE_GENERATION_FAILED: 'VOICE_1600',
  VOICE_ELEVENLABS_ERROR: 'VOICE_1601',
  VOICE_INVALID_CONFIG: 'VOICE_1602',
  VOICE_QUOTA_EXCEEDED: 'VOICE_1603',
  VOICE_NOT_FOUND: 'VOICE_1604',

  // 3D Processing errors (1700-1799)
  RIGGING_FAILED: 'RIGGING_1700',
  FITTING_FAILED: 'FITTING_1701',
  MESH_PROCESSING_FAILED: 'MESH_1702',
  MODEL_LOADING_FAILED: 'MODEL_1703',
  TEXTURE_PROCESSING_FAILED: 'TEXTURE_1704',

  // File operation errors (1800-1899)
  FILE_READ_ERROR: 'FILE_1800',
  FILE_WRITE_ERROR: 'FILE_1801',
  FILE_DELETE_ERROR: 'FILE_1802',
  FILE_NOT_FOUND: 'FILE_1803',
  FILE_PERMISSION_DENIED: 'FILE_1804',

  // Blob storage errors (1900-1999)
  BLOB_UPLOAD_ERROR: 'BLOB_1900',
  BLOB_DOWNLOAD_ERROR: 'BLOB_1901',
  BLOB_DELETE_ERROR: 'BLOB_1902',
  BLOB_NOT_FOUND: 'BLOB_1903',

  // Team/Project errors (2000-2099)
  TEAM_NOT_FOUND: 'TEAM_2000',
  TEAM_CAPACITY_EXCEEDED: 'TEAM_2001',
  TEAM_MEMBER_EXISTS: 'TEAM_2002',
  PROJECT_NOT_FOUND: 'PROJECT_2000',
  PROJECT_ACCESS_DENIED: 'PROJECT_2001',

  // Network errors (2100-2199)
  NETWORK_ERROR: 'NET_2100',
  TIMEOUT_ERROR: 'NET_2101',
  CONNECTION_FAILED: 'NET_2102',

  // Generic errors (9000-9999)
  UNKNOWN_ERROR: 'ERR_9000',
  INTERNAL_ERROR: 'ERR_9001',
  SERVICE_UNAVAILABLE: 'ERR_9002',
  NOT_IMPLEMENTED: 'ERR_9003',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

/**
 * Standard error interface
 */
export interface StandardError {
  code: ErrorCode
  message: string
  details?: Record<string, unknown>
  timestamp: string
  requestId?: string
  userMessage?: string
}

/**
 * User-friendly error messages
 */
export const ErrorMessages = {
  // Authentication
  AUTH_MISSING_TOKEN: 'Authentication required. Please sign in.',
  AUTH_INVALID_TOKEN: 'Your session is invalid. Please sign in again.',
  AUTH_EXPIRED_TOKEN: 'Your session has expired. Please sign in again.',
  AUTH_INSUFFICIENT_PERMISSIONS: 'You do not have permission to perform this action.',
  AUTH_NOT_AUTHENTICATED: 'Authentication required. Please sign in.',
  AUTH_FORBIDDEN: 'Access denied. You do not have permission to access this resource.',

  // Validation
  VALIDATION_INVALID_INPUT: 'Invalid input provided. Please check your data and try again.',
  VALIDATION_MISSING_FIELD: 'Required field is missing. Please provide all required information.',
  VALIDATION_INVALID_FORMAT: 'Invalid format. Please check your input and try again.',
  VALIDATION_CONSTRAINT_VIOLATION: 'Input violates constraints. Please review and correct.',
  VALIDATION_FILE_TYPE: 'Invalid file type. Please upload a supported file format.',
  VALIDATION_FILE_SIZE: 'File size exceeds maximum limit. Please upload a smaller file.',

  // Generation
  GENERATION_API_FAILED: 'Asset generation failed. Please try again.',
  GENERATION_TIMEOUT: 'Generation took too long and timed out. Please try again.',
  GENERATION_INVALID_CONFIG: 'Invalid generation configuration. Please check your settings.',
  GENERATION_PIPELINE_FAILED: 'Generation pipeline failed. Please try again.',
  GENERATION_IMAGE_FAILED: 'Image generation failed. Please try again.',
  GENERATION_3D_FAILED: '3D model generation failed. Please try again.',

  // Asset
  ASSET_NOT_FOUND: 'The requested asset could not be found.',
  ASSET_INVALID_FORMAT: 'Invalid asset format. Please use a supported format.',
  ASSET_UPLOAD_FAILED: 'Asset upload failed. Please check your connection and try again.',
  ASSET_PROCESSING_FAILED: 'Asset processing failed. Please try again.',
  ASSET_DOWNLOAD_FAILED: 'Asset download failed. Please try again.',
  ASSET_ALREADY_EXISTS: 'An asset with this name already exists.',

  // Database
  DB_CONNECTION_FAILED: 'Database connection failed. Please try again later.',
  DB_QUERY_FAILED: 'Database operation failed. Please try again.',
  DB_CONSTRAINT_VIOLATION: 'Operation violates database constraints.',
  DB_RECORD_NOT_FOUND: 'Record not found in database.',
  DB_TRANSACTION_FAILED: 'Transaction failed. Please try again.',

  // External APIs
  EXTERNAL_API_UNAVAILABLE: 'External service is temporarily unavailable. Please try again later.',
  EXTERNAL_API_RATE_LIMIT: 'Rate limit exceeded. Please wait before trying again.',
  EXTERNAL_API_INVALID_RESPONSE: 'Received invalid response from external service.',
  EXTERNAL_API_TIMEOUT: 'External service request timed out. Please try again.',
  EXTERNAL_API_AUTH_FAILED: 'Authentication with external service failed.',

  // Voice
  VOICE_GENERATION_FAILED: 'Voice generation failed. Please try again.',
  VOICE_ELEVENLABS_ERROR: 'ElevenLabs service error. Please try again.',
  VOICE_INVALID_CONFIG: 'Invalid voice configuration. Please check your settings.',
  VOICE_QUOTA_EXCEEDED: 'Voice generation quota exceeded. Please upgrade your plan.',
  VOICE_NOT_FOUND: 'Voice profile not found.',

  // 3D Processing
  RIGGING_FAILED: '3D rigging failed. Please try again.',
  FITTING_FAILED: 'Mesh fitting failed. Please try again.',
  MESH_PROCESSING_FAILED: 'Mesh processing failed. Please try again.',
  MODEL_LOADING_FAILED: '3D model loading failed. Please check the file format.',
  TEXTURE_PROCESSING_FAILED: 'Texture processing failed. Please try again.',

  // File operations
  FILE_READ_ERROR: 'Failed to read file. Please try again.',
  FILE_WRITE_ERROR: 'Failed to write file. Please try again.',
  FILE_DELETE_ERROR: 'Failed to delete file. Please try again.',
  FILE_NOT_FOUND: 'File not found.',
  FILE_PERMISSION_DENIED: 'Permission denied to access file.',

  // Blob storage
  BLOB_UPLOAD_ERROR: 'Failed to upload to storage. Please try again.',
  BLOB_DOWNLOAD_ERROR: 'Failed to download from storage. Please try again.',
  BLOB_DELETE_ERROR: 'Failed to delete from storage. Please try again.',
  BLOB_NOT_FOUND: 'Blob not found in storage.',

  // Teams/Projects
  TEAM_NOT_FOUND: 'Team not found.',
  TEAM_CAPACITY_EXCEEDED: 'Team has reached maximum capacity.',
  TEAM_MEMBER_EXISTS: 'User is already a team member.',
  PROJECT_NOT_FOUND: 'Project not found.',
  PROJECT_ACCESS_DENIED: 'Access denied to project.',

  // Network
  NETWORK_ERROR: 'Network error occurred. Please check your connection.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  CONNECTION_FAILED: 'Connection failed. Please check your internet connection.',

  // Generic
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
  INTERNAL_ERROR: 'Internal server error. Please try again later.',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable. Please try again later.',
  NOT_IMPLEMENTED: 'Feature not yet implemented.',
} as const

/**
 * Developer-focused error message templates
 */
export const DeveloperMessages = {
  GENERATION_API_ERROR: (service: string, reason: string) =>
    `${service} API call failed: ${reason}`,

  VALIDATION_ERROR: (field: string, constraint: string) =>
    `Validation failed for ${field}: ${constraint}`,

  DATABASE_ERROR: (operation: string, table: string) =>
    `Database ${operation} failed on table ${table}`,

  EXTERNAL_API_ERROR: (service: string, statusCode: number, message: string) =>
    `${service} API error (${statusCode}): ${message}`,

  FILE_OPERATION_ERROR: (operation: string, path: string, reason: string) =>
    `File ${operation} failed for ${path}: ${reason}`,

  PROCESSING_ERROR: (stage: string, assetType: string, reason: string) =>
    `${stage} processing failed for ${assetType}: ${reason}`,
}

/**
 * Create a standard error object
 */
export function createStandardError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
  requestId?: string
): StandardError {
  return {
    code,
    message,
    details,
    timestamp: new Date().toISOString(),
    requestId,
    userMessage: ErrorMessages[code.replace(/_([\d]+)$/, '') as keyof typeof ErrorMessages] || ErrorMessages.UNKNOWN_ERROR
  }
}

/**
 * Format error response for API
 */
export function formatErrorResponse(error: StandardError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details && { details: error.details }),
      timestamp: error.timestamp,
      ...(error.requestId && { requestId: error.requestId })
    }
  }
}

/**
 * Map error codes to HTTP status codes
 */
export function getHttpStatusFromErrorCode(code: ErrorCode): number {
  const prefix = code.split('_')[0]

  switch (prefix) {
    case 'AUTH':
      if (code === ErrorCodes.AUTH_FORBIDDEN || code === ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS) {
        return 403
      }
      return 401

    case 'VAL':
      return 400

    case 'ASSET':
      if (code === ErrorCodes.ASSET_NOT_FOUND) return 404
      return 400

    case 'DB':
      if (code === ErrorCodes.DB_RECORD_NOT_FOUND) return 404
      return 500

    case 'API':
      if (code === ErrorCodes.EXTERNAL_API_RATE_LIMIT) return 429
      if (code === ErrorCodes.EXTERNAL_API_UNAVAILABLE) return 503
      return 502

    case 'GEN':
    case 'VOICE':
    case 'RIGGING':
    case 'MESH':
    case 'MODEL':
    case 'TEXTURE':
      return 500

    case 'FILE':
    case 'BLOB':
      if (code.includes('NOT_FOUND')) return 404
      if (code.includes('PERMISSION')) return 403
      return 500

    case 'TEAM':
    case 'PROJECT':
      if (code.includes('NOT_FOUND')) return 404
      if (code.includes('ACCESS_DENIED')) return 403
      return 400

    case 'NET':
      return 503

    case 'ERR':
      if (code === ErrorCodes.SERVICE_UNAVAILABLE) return 503
      return 500

    default:
      return 500
  }
}

/**
 * Check if error is a client error (4xx)
 */
export function isClientError(code: ErrorCode): boolean {
  const status = getHttpStatusFromErrorCode(code)
  return status >= 400 && status < 500
}

/**
 * Check if error is a server error (5xx)
 */
export function isServerError(code: ErrorCode): boolean {
  const status = getHttpStatusFromErrorCode(code)
  return status >= 500
}
