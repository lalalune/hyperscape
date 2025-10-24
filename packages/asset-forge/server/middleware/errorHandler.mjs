/**
 * Error Handler Middleware
 * Provides consistent error responses and logging using standardized error codes
 */

import {
  ErrorCodes,
  sendErrorResponse,
  getHttpStatusFromErrorCode
} from '../utils/error-messages.mjs'

export function errorHandler(err, req, res, next) {
  // Extract error code (fallback to INTERNAL_ERROR if not set)
  const errorCode = err.code || ErrorCodes.INTERNAL_ERROR

  // Don't leak sensitive details in production
  const isDevelopment = process.env.NODE_ENV !== 'production'

  // Log error details for debugging
  console.error('API Error:', {
    code: errorCode,
    message: err.message,
    stack: isDevelopment ? err.stack : undefined,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  })

  // Prepare error details (omit sensitive data in production)
  const details = isDevelopment ? {
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    ...(err.context && { context: err.context }),
    ...(err.stack && { stack: err.stack })
  } : undefined

  // Send standardized error response
  return sendErrorResponse(
    res,
    errorCode,
    err.message || 'Internal Server Error',
    details,
    req.id
  )
}