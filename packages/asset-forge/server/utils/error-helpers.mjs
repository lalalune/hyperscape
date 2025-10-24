/**
 * Server-side Error Handling Utilities
 *
 * Provides consistent error handling patterns for Node.js server
 * with proper error propagation and context enrichment.
 *
 * @deprecated Use standardized error system from error-messages.mjs instead
 */

import {
  ErrorCodes as StandardErrorCodes,
  sendErrorResponse,
  getHttpStatusFromErrorCode
} from './error-messages.mjs'

/**
 * Application-specific error with context
 */
export class ApplicationError extends Error {
  constructor(message, code, context, cause) {
    super(message);
    this.name = 'ApplicationError';
    this.code = code;
    this.context = context;
    this.cause = cause;

    // Maintain proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApplicationError);
    }
  }

  /**
   * Convert to a JSON-serializable format
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      cause: this.cause ? {
        message: this.cause.message,
        stack: this.cause.stack
      } : undefined,
      stack: this.stack
    };
  }
}

/**
 * Wrap an unknown error with additional context
 */
export function wrapError(error, message, code, context) {
  const originalError = error instanceof Error ? error : new Error(String(error));
  return new ApplicationError(message, code, context, originalError);
}

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

/**
 * Check if error is of a specific type
 */
export function isApplicationError(error) {
  return error instanceof ApplicationError;
}

/**
 * Safe async function executor that ensures errors are wrapped
 */
export async function safeAsync(fn, errorMessage, errorCode, context) {
  try {
    return await fn();
  } catch (error) {
    throw wrapError(error, errorMessage, errorCode, context);
  }
}

/**
 * Error codes for common scenarios
 * @deprecated Use ErrorCodes from error-messages.mjs instead
 */
export const ErrorCodes = {
  // Legacy codes mapped to new standardized codes
  NETWORK_ERROR: StandardErrorCodes.NETWORK_ERROR,
  API_REQUEST_FAILED: StandardErrorCodes.EXTERNAL_API_UNAVAILABLE,
  TIMEOUT_ERROR: StandardErrorCodes.TIMEOUT_ERROR,
  GENERATION_FAILED: StandardErrorCodes.GENERATION_API_FAILED,
  ASSET_PROCESSING_FAILED: StandardErrorCodes.ASSET_PROCESSING_FAILED,
  MODEL_LOADING_FAILED: StandardErrorCodes.MODEL_LOADING_FAILED,
  FILE_READ_ERROR: StandardErrorCodes.FILE_READ_ERROR,
  FILE_WRITE_ERROR: StandardErrorCodes.FILE_WRITE_ERROR,
  FILE_VALIDATION_ERROR: StandardErrorCodes.VALIDATION_FILE_TYPE,
  DATABASE_ERROR: StandardErrorCodes.DB_CONNECTION_FAILED,
  QUERY_FAILED: StandardErrorCodes.DB_QUERY_FAILED,
  VALIDATION_ERROR: StandardErrorCodes.VALIDATION_INVALID_INPUT,
  INVALID_INPUT: StandardErrorCodes.VALIDATION_INVALID_INPUT,
  AUTH_ERROR: StandardErrorCodes.AUTH_NOT_AUTHENTICATED,
  UNAUTHORIZED: StandardErrorCodes.AUTH_NOT_AUTHENTICATED,
  FORBIDDEN: StandardErrorCodes.AUTH_FORBIDDEN,
  SERVICE_UNAVAILABLE: StandardErrorCodes.SERVICE_UNAVAILABLE,
  EXTERNAL_SERVICE_ERROR: StandardErrorCodes.EXTERNAL_API_UNAVAILABLE,
  VOICE_GENERATION_FAILED: StandardErrorCodes.VOICE_GENERATION_FAILED,
  ELEVENLABS_ERROR: StandardErrorCodes.VOICE_ELEVENLABS_ERROR,
  BLOB_UPLOAD_ERROR: StandardErrorCodes.BLOB_UPLOAD_ERROR,
  BLOB_DELETE_ERROR: StandardErrorCodes.BLOB_DELETE_ERROR,
  RIGGING_FAILED: StandardErrorCodes.RIGGING_FAILED,
  FITTING_FAILED: StandardErrorCodes.FITTING_FAILED,
  MESH_PROCESSING_FAILED: StandardErrorCodes.MESH_PROCESSING_FAILED,
  UNKNOWN_ERROR: StandardErrorCodes.UNKNOWN_ERROR,
  INTERNAL_ERROR: StandardErrorCodes.INTERNAL_ERROR
};

/**
 * Express error handler middleware
 * @deprecated Use standardized error middleware from error-messages.mjs
 */
export function errorMiddleware(err, req, res, next) {
  // Use standardized error response
  const code = err.code || StandardErrorCodes.INTERNAL_ERROR
  const message = err.message || 'Internal server error'
  const details = {
    context: err.context,
    method: req.method,
    path: req.path,
    userId: req.user?.id
  }

  // Log the error
  console.error('Request failed:', {
    code,
    message,
    details,
    stack: err.stack
  });

  // Send standardized error response
  return sendErrorResponse(res, code, message, details, req.id)
}

/**
 * Map error codes to HTTP status codes
 * @deprecated Use getHttpStatusFromErrorCode from error-messages.mjs instead
 */
function getStatusCodeFromError(error) {
  if (error instanceof ApplicationError) {
    return getHttpStatusFromErrorCode(error.code)
  }
  return 500;
}
