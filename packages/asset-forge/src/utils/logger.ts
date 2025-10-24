/**
 * Logger class for structured, contextual logging.
 *
 * Provides a centralized logging system with context tagging
 * and environment-aware debug output. All logs are prefixed
 * with the context name for easier debugging and filtering.
 */
class Logger {
  context: string

  /**
   * Create a new logger instance.
   *
   * @param context - Context identifier for log messages (e.g., 'AssetService', 'MeshFitting')
   */
  constructor(context: string) {
    this.context = context
  }

  /**
   * Log debug message (only in development mode).
   *
   * @param message - Debug message to log
   * @param data - Optional additional data to include
   */
  debug(message: string, data?: unknown) {
    if (typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      console.debug(`[${this.context}]`, message, data)
    }
  }

  /**
   * Log informational message.
   *
   * @param message - Info message to log
   * @param data - Optional additional data to include
   */
  info(message: string, data?: unknown) {
    console.info(`[${this.context}]`, message, data)
  }

  /**
   * Log warning message.
   *
   * @param message - Warning message to log
   * @param data - Optional additional data to include
   */
  warn(message: string, data?: unknown) {
    console.warn(`[${this.context}]`, message, data)
  }

  /**
   * Log error message with optional error object.
   *
   * @param message - Error message to log
   * @param error - Optional Error object or additional data
   */
  error(message: string, error?: Error | unknown) {
    console.error(`[${this.context}]`, message, error)
  }
}

/**
 * Create a new logger instance with a specific context.
 *
 * @param context - Context identifier for the logger
 * @returns Logger instance configured with the given context
 *
 * @example
 * ```typescript
 * const logger = createLogger('MyService')
 * logger.info('Service initialized')
 * logger.debug('Processing item', { id: 123 })
 * logger.error('Failed to process', error)
 * ```
 */
export const createLogger = (context: string) => new Logger(context)

// Default export for backwards compatibility
export default createLogger
