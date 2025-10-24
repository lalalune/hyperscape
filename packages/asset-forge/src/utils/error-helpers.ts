/**
 * Error Handling Utilities
 *
 * Provides consistent error handling patterns across the application
 * with proper error propagation and context enrichment.
 *
 * @deprecated Use standardized error system from error-messages.ts instead
 */

import { ErrorCodes as StandardErrorCodes, ErrorCode as StandardErrorCode } from './error-messages'

/**
 * Application-specific error with context
 */
export class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ApplicationError';

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApplicationError);
    }
  }

  /**
   * Convert to a JSON-serializable format
   */
  toJSON(): Record<string, unknown> {
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
export function wrapError(
  error: unknown,
  message: string,
  code: string,
  context?: Record<string, unknown>
): ApplicationError {
  const originalError = error instanceof Error ? error : new Error(String(error));
  return new ApplicationError(message, code, context, originalError);
}

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
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
export function isApplicationError(error: unknown): error is ApplicationError {
  return error instanceof ApplicationError;
}

/**
 * Safe async function executor that ensures errors are wrapped
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  errorMessage: string,
  errorCode: string,
  context?: Record<string, unknown>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw wrapError(error, errorMessage, errorCode, context);
  }
}

/**
 * Error codes for common scenarios
 * @deprecated Use ErrorCodes from error-messages.ts instead
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
  RIGGING_FAILED: StandardErrorCodes.RIGGING_FAILED,
  FITTING_FAILED: StandardErrorCodes.FITTING_FAILED,
  MESH_PROCESSING_FAILED: StandardErrorCodes.MESH_PROCESSING_FAILED,
  UNKNOWN_ERROR: StandardErrorCodes.UNKNOWN_ERROR,
  INTERNAL_ERROR: StandardErrorCodes.INTERNAL_ERROR
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes] | StandardErrorCode;
