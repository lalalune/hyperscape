/**
 * Client-Side Error Handler
 *
 * Handles errors from API calls and displays user-friendly messages.
 */

import { StandardError, ErrorCodes, ErrorMessages } from './error-messages'
import { createLogger } from './logger.ts'

const logger = createLogger('ErrorHandler')

/**
 * Extract error information from various error formats
 */
export function extractErrorInfo(error: unknown): {
  code: string
  message: string
  details?: Record<string, unknown>
} {
  // Handle StandardError format from API
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const apiError = (error as { error: StandardError }).error
    return {
      code: apiError.code,
      message: apiError.message,
      details: apiError.details
    }
  }

  // Handle Error objects
  if (error instanceof Error) {
    return {
      code: ErrorCodes.UNKNOWN_ERROR,
      message: error.message
    }
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      code: ErrorCodes.UNKNOWN_ERROR,
      message: error
    }
  }

  // Handle fetch Response objects
  if (error && typeof error === 'object' && 'status' in error && 'statusText' in error) {
    const response = error as Response
    return {
      code: ErrorCodes.NETWORK_ERROR,
      message: `HTTP ${response.status}: ${response.statusText}`
    }
  }

  // Default fallback
  return {
    code: ErrorCodes.UNKNOWN_ERROR,
    message: 'An unexpected error occurred'
  }
}

/**
 * Get user-friendly error message
 */
export function getUserErrorMessage(error: unknown): string {
  const { code, message } = extractErrorInfo(error)

  // Try to get predefined user message
  const errorCode = code as keyof typeof ErrorMessages
  if (errorCode in ErrorMessages) {
    return ErrorMessages[errorCode]
  }

  // Fall back to the message from the error
  return message || ErrorMessages.UNKNOWN_ERROR
}

/**
 * Handle API error and return user-friendly message
 */
export function handleAPIError(error: unknown): string {
  const errorInfo = extractErrorInfo(error)

  // Log error for debugging
  logger.error('API error occurred', {
    code: errorInfo.code,
    message: errorInfo.message,
    details: errorInfo.details
  })

  return getUserErrorMessage(error)
}

/**
 * Display error to user (use with your toast/notification system)
 */
export function displayError(error: unknown, toast?: {
  error: (message: string) => void
}) {
  const message = handleAPIError(error)

  if (toast) {
    toast.error(message)
  } else {
    // Fallback to console if no toast system provided
    console.error('User-facing error:', message)
  }
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const { code } = extractErrorInfo(error)

  const retryableCodes = [
    ErrorCodes.NETWORK_ERROR,
    ErrorCodes.TIMEOUT_ERROR,
    ErrorCodes.CONNECTION_FAILED,
    ErrorCodes.EXTERNAL_API_UNAVAILABLE,
    ErrorCodes.EXTERNAL_API_TIMEOUT,
    ErrorCodes.SERVICE_UNAVAILABLE,
    ErrorCodes.DB_CONNECTION_FAILED,
  ]

  return retryableCodes.includes(code as typeof retryableCodes[number])
}

/**
 * Check if error requires authentication
 */
export function requiresAuth(error: unknown): boolean {
  const { code } = extractErrorInfo(error)

  const authCodes = [
    ErrorCodes.AUTH_MISSING_TOKEN,
    ErrorCodes.AUTH_INVALID_TOKEN,
    ErrorCodes.AUTH_EXPIRED_TOKEN,
    ErrorCodes.AUTH_NOT_AUTHENTICATED,
  ]

  return authCodes.includes(code as typeof authCodes[number])
}

/**
 * Check if error is a permission issue
 */
export function isPermissionError(error: unknown): boolean {
  const { code } = extractErrorInfo(error)

  const permissionCodes = [
    ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS,
    ErrorCodes.AUTH_FORBIDDEN,
    ErrorCodes.PROJECT_ACCESS_DENIED,
    ErrorCodes.FILE_PERMISSION_DENIED,
  ]

  return permissionCodes.includes(code as typeof permissionCodes[number])
}

/**
 * Async error wrapper with automatic error handling
 */
export async function withErrorHandler<T>(
  fn: () => Promise<T>,
  toast?: { error: (message: string) => void }
): Promise<T | null> {
  try {
    return await fn()
  } catch (error) {
    displayError(error, toast)
    return null
  }
}

/**
 * Create error boundary fallback component props
 */
export interface ErrorBoundaryProps {
  error: Error
  resetErrorBoundary: () => void
}

/**
 * Get error message for error boundary
 */
export function getErrorBoundaryMessage(error: Error): string {
  logger.error('Error boundary caught error', error)
  return getUserErrorMessage(error)
}
