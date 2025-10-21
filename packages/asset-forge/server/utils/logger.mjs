/**
 * Structured Logging Utility
 *
 * Provides consistent, structured logging across the entire backend.
 * Designed for debugging, monitoring, and production troubleshooting.
 *
 * Features:
 * - Log levels: DEBUG, INFO, WARN, ERROR
 * - Contextual metadata (service, operation, duration, etc.)
 * - Timestamps and formatted output
 * - Environment-aware (verbose in dev, concise in prod)
 * - Performance tracking
 * - Error stack traces in development
 */

// Log levels
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
}

// Current log level (configurable via env)
const CURRENT_LOG_LEVEL = process.env.LOG_LEVEL === 'debug' ? LogLevel.DEBUG
  : process.env.LOG_LEVEL === 'warn' ? LogLevel.WARN
  : process.env.LOG_LEVEL === 'error' ? LogLevel.ERROR
  : LogLevel.INFO

// Development mode (shows more details)
const IS_DEV = process.env.NODE_ENV !== 'production'

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
}

/**
 * Format timestamp for logs
 */
function formatTimestamp() {
  return new Date().toISOString()
}

/**
 * Format log level with color
 */
function formatLevel(level) {
  switch (level) {
    case LogLevel.DEBUG:
      return `${colors.gray}DEBUG${colors.reset}`
    case LogLevel.INFO:
      return `${colors.blue}INFO ${colors.reset}`
    case LogLevel.WARN:
      return `${colors.yellow}WARN ${colors.reset}`
    case LogLevel.ERROR:
      return `${colors.red}ERROR${colors.reset}`
    default:
      return 'UNKNOWN'
  }
}

/**
 * Format context object for display
 */
function formatContext(context) {
  if (!context || Object.keys(context).length === 0) {
    return ''
  }

  const parts = []
  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined && value !== null) {
      if (typeof value === 'object') {
        try {
          // Safely stringify objects, handling circular references
          parts.push(`${key}=${JSON.stringify(value)}`)
        } catch (error) {
          parts.push(`${key}=[Object]`)
        }
      } else {
        parts.push(`${key}=${value}`)
      }
    }
  }

  return parts.length > 0 ? ` ${colors.gray}[${parts.join(', ')}]${colors.reset}` : ''
}

/**
 * Base logging function
 */
function log(level, service, message, context = {}, error = null) {
  if (level < CURRENT_LOG_LEVEL) {
    return // Skip logs below current level
  }

  const timestamp = formatTimestamp()
  const levelStr = formatLevel(level)
  const serviceStr = `${colors.cyan}[${service}]${colors.reset}`
  const contextStr = formatContext(context)

  // Build log line
  let logLine = `${colors.gray}${timestamp}${colors.reset} ${levelStr} ${serviceStr} ${message}${contextStr}`

  // Output to console
  if (level === LogLevel.ERROR) {
    console.error(logLine)
    if (error) {
      console.error(`${colors.red}Error:${colors.reset}`, error)
      if (IS_DEV && error.stack) {
        console.error(`${colors.gray}Stack:${colors.reset}\n${error.stack}`)
      }
    }
  } else if (level === LogLevel.WARN) {
    console.warn(logLine)
  } else {
    console.log(logLine)
  }

  // In production, also write to structured log format (could send to logging service)
  if (!IS_DEV && level >= LogLevel.INFO) {
    const structuredLog = {
      timestamp,
      level: Object.keys(LogLevel).find(k => LogLevel[k] === level),
      service,
      message,
      context,
      error: error ? {
        message: error.message,
        code: error.code,
        stack: error.stack
      } : undefined
    }
    // Could send to logging service here (e.g., CloudWatch, Datadog, etc.)
    // console.log(JSON.stringify(structuredLog))
  }
}

/**
 * Logger class for service-specific logging
 */
export class Logger {
  constructor(serviceName) {
    this.serviceName = serviceName
  }

  /**
   * Debug level - detailed information for debugging
   */
  debug(message, context = {}) {
    log(LogLevel.DEBUG, this.serviceName, message, context)
  }

  /**
   * Info level - general informational messages
   */
  info(message, context = {}) {
    log(LogLevel.INFO, this.serviceName, message, context)
  }

  /**
   * Warn level - warning messages that don't stop execution
   */
  warn(message, context = {}) {
    log(LogLevel.WARN, this.serviceName, message, context)
  }

  /**
   * Error level - error messages with optional error object
   */
  error(message, error = null, context = {}) {
    log(LogLevel.ERROR, this.serviceName, message, context, error)
  }

  /**
   * Time a function execution and log duration
   */
  async time(operation, fn, context = {}) {
    const startTime = Date.now()
    this.debug(`Starting: ${operation}`, context)

    try {
      const result = await fn()
      const duration = Date.now() - startTime

      this.info(`Completed: ${operation}`, {
        ...context,
        durationMs: duration,
        durationSec: (duration / 1000).toFixed(2)
      })

      return result
    } catch (error) {
      const duration = Date.now() - startTime

      this.error(`Failed: ${operation}`, error, {
        ...context,
        durationMs: duration,
        durationSec: (duration / 1000).toFixed(2)
      })

      throw error
    }
  }

  /**
   * Log rate limit information
   */
  rateLimit(current, max, context = {}) {
    const utilization = max > 0 ? (current / max * 100).toFixed(1) : 0
    const level = utilization > 80 ? LogLevel.WARN : LogLevel.INFO

    log(level, this.serviceName, `Rate limit: ${current}/${max} (${utilization}% used)`, context)
  }

  /**
   * Log retry attempt
   */
  retry(attempt, maxAttempts, delayMs, reason, context = {}) {
    this.warn(`Retry attempt ${attempt}/${maxAttempts} after ${delayMs}ms`, {
      ...context,
      reason
    })
  }

  /**
   * Log performance metric
   */
  metric(metricName, value, unit = '', context = {}) {
    this.info(`Metric: ${metricName} = ${value}${unit}`, context)
  }
}

/**
 * Create a logger for a specific service
 */
export function createLogger(serviceName) {
  return new Logger(serviceName)
}

/**
 * Performance timer helper
 */
export class PerformanceTimer {
  constructor(logger, operation) {
    this.logger = logger
    this.operation = operation
    this.startTime = Date.now()
    this.checkpoints = []
    this.lastCheckpointTime = this.startTime
  }

  /**
   * Mark a checkpoint in the operation
   */
  checkpoint(name) {
    const now = Date.now()
    const elapsed = now - this.startTime
    const delta = now - this.lastCheckpointTime

    this.checkpoints.push({ name, elapsed, delta })
    this.lastCheckpointTime = now

    this.logger.debug(`Checkpoint: ${this.operation} - ${name}`, {
      elapsedMs: elapsed,
      deltaMs: delta
    })
  }

  /**
   * End the timer and log final performance metrics
   */
  end(context = {}) {
    const totalDuration = Date.now() - this.startTime

    this.logger.info(`Performance: ${this.operation}`, {
      ...context,
      totalMs: totalDuration,
      totalSec: (totalDuration / 1000).toFixed(2),
      checkpoints: this.checkpoints.length
    })

    // In dev mode, show detailed checkpoint breakdown
    if (this.checkpoints.length > 0 && IS_DEV) {
      this.checkpoints.forEach((cp, index) => {
        const percentage = ((cp.delta / totalDuration) * 100).toFixed(1)
        this.logger.debug(`  → ${cp.name}: ${cp.elapsed}ms (Δ${cp.delta}ms, ${percentage}%)`)
      })
    }

    return totalDuration
  }
}

export default createLogger
