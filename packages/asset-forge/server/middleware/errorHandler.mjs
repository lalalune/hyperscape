/**
 * Error Handler Middleware
 * Provides consistent error responses and logging
 */

export function errorHandler(err, req, res, next) {
  // Log error details
  console.error('API Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString()
  })

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV !== 'production'

  // Default error status
  const status = err.status || 500

  // Send error response
  res.status(status).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: status,
      ...(isDevelopment && { stack: err.stack })
    }
  })
}