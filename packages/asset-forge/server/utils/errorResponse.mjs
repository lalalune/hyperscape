/**
 * Standardized Error Response System
 *
 * Provides consistent error handling across all Asset Forge API routes
 * with structured error types, codes, and user-friendly messages.
 */

import { ErrorCodes, ErrorMessages, sendErrorResponse as sendStandardError } from './error-messages.mjs'

/**
 * Error types for categorization
 */
export const ErrorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT: 'RATE_LIMIT',
  EXTERNAL_SERVICE: 'EXTERNAL_SERVICE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
}

/**
 * Create a standardized error response object
 *
 * @param {string} code - Error code from ErrorCodes
 * @param {string} message - Technical error message
 * @param {Object} details - Additional error details
 * @param {string} requestId - Optional request ID for tracking
 * @returns {Object} Standardized error response
 */
export function errorResponse(code, message, details = null, requestId = null) {
  return {
    success: false,
    error: {
      code,
      message,
      type: getErrorTypeFromCode(code),
      userMessage: ErrorMessages[code] || ErrorMessages.UNKNOWN_ERROR,
      ...(details && { details }),
      timestamp: new Date().toISOString(),
      ...(requestId && { requestId })
    }
  }
}

/**
 * Pre-configured standard errors for common scenarios
 */
export const standardErrors = {
  // Validation errors
  validation: (message, details = null) =>
    errorResponse(ErrorCodes.VALIDATION_INVALID_INPUT, message, details),

  missingField: (fieldName) =>
    errorResponse(
      ErrorCodes.VALIDATION_MISSING_FIELD,
      `Required field missing: ${fieldName}`,
      { field: fieldName }
    ),

  invalidFormat: (fieldName, expectedFormat) =>
    errorResponse(
      ErrorCodes.VALIDATION_INVALID_FORMAT,
      `Invalid format for ${fieldName}. Expected: ${expectedFormat}`,
      { field: fieldName, expectedFormat }
    ),

  // Not found errors
  notFound: (resourceType, resourceId = null) =>
    errorResponse(
      ErrorCodes.ASSET_NOT_FOUND,
      `${resourceType} not found`,
      resourceId ? { resourceId } : null
    ),

  // Authentication errors
  unauthorized: (message = 'Authentication required') =>
    errorResponse(ErrorCodes.AUTH_NOT_AUTHENTICATED, message),

  invalidToken: () =>
    errorResponse(ErrorCodes.AUTH_INVALID_TOKEN, 'Invalid or expired token'),

  // Authorization errors
  forbidden: (message = 'Access denied') =>
    errorResponse(ErrorCodes.AUTH_FORBIDDEN, message),

  insufficientPermissions: (requiredPermission) =>
    errorResponse(
      ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS,
      'Insufficient permissions',
      { requiredPermission }
    ),

  // Generation errors
  generationFailed: (provider, details = null) =>
    errorResponse(
      ErrorCodes.GENERATION_API_FAILED,
      `${provider} generation failed`,
      details
    ),

  generationTimeout: (timeout) =>
    errorResponse(
      ErrorCodes.GENERATION_TIMEOUT,
      'Generation timed out',
      { timeout }
    ),

  // External service errors
  externalServiceUnavailable: (serviceName) =>
    errorResponse(
      ErrorCodes.EXTERNAL_API_UNAVAILABLE,
      `${serviceName} is temporarily unavailable`,
      { service: serviceName }
    ),

  rateLimitExceeded: (retryAfter = null) =>
    errorResponse(
      ErrorCodes.EXTERNAL_API_RATE_LIMIT,
      'Rate limit exceeded',
      retryAfter ? { retryAfter } : null
    ),

  // Database errors
  databaseError: (operation, details = null) =>
    errorResponse(
      ErrorCodes.DB_QUERY_FAILED,
      `Database ${operation} failed`,
      details
    ),

  // Internal errors
  internalError: (message = 'Internal server error', details = null) =>
    errorResponse(ErrorCodes.INTERNAL_ERROR, message, details),

  // Context building errors
  contextBuildFailed: (reason) =>
    errorResponse(
      ErrorCodes.GENERATION_INVALID_CONFIG,
      'Failed to build generation context',
      { reason }
    ),

  // Parsing errors
  parseError: (rawResponse, error) =>
    errorResponse(
      ErrorCodes.EXTERNAL_API_INVALID_RESPONSE,
      'Failed to parse AI response',
      { rawResponse: rawResponse?.substring(0, 500), parseError: error.message }
    ),
}

/**
 * Send standardized error response
 * Automatically maps error code to HTTP status code
 *
 * @param {Object} res - Express response object
 * @param {string} code - Error code from ErrorCodes
 * @param {string} message - Error message
 * @param {Object} details - Additional details
 * @param {string} requestId - Optional request ID
 */
export function sendErrorResponse(res, code, message, details = null, requestId = null) {
  return sendStandardError(res, code, message, details, requestId)
}

/**
 * Get error type from error code
 *
 * @param {string} code - Error code
 * @returns {string} Error type
 */
function getErrorTypeFromCode(code) {
  const prefix = code.split('_')[0]

  switch (prefix) {
    case 'AUTH':
      return code === ErrorCodes.AUTH_FORBIDDEN
        ? ErrorTypes.FORBIDDEN
        : ErrorTypes.UNAUTHORIZED

    case 'VAL':
      return ErrorTypes.VALIDATION_ERROR

    case 'API':
      if (code === ErrorCodes.EXTERNAL_API_RATE_LIMIT) return ErrorTypes.RATE_LIMIT
      return ErrorTypes.EXTERNAL_SERVICE

    case 'ASSET':
    case 'DB':
    case 'FILE':
    case 'BLOB':
    case 'TEAM':
    case 'PROJECT':
    case 'VOICE':
      if (code.includes('NOT_FOUND')) return ErrorTypes.NOT_FOUND
      if (code.includes('EXISTS')) return ErrorTypes.CONFLICT
      return ErrorTypes.BAD_REQUEST

    default:
      return ErrorTypes.INTERNAL_ERROR
  }
}

// Re-export ErrorCodes for convenience
export { ErrorCodes }
