/**
 * Comprehensive Input Validation Utilities
 *
 * Provides validation functions for all user inputs across API endpoints.
 * Prevents injection attacks, validates data types, ranges, and formats.
 */

import { createLogger } from './logger.mjs'

const logger = createLogger('input-validation')

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(message, field, received, expected) {
    super(message)
    this.name = 'ValidationError'
    this.field = field
    this.received = received
    this.expected = expected
  }
}

/**
 * Validate pagination parameters
 * @param {Object} query - Request query parameters
 * @param {Object} options - Validation options
 * @returns {Object} Validated pagination { page, limit, offset }
 */
export function validatePagination(query, options = {}) {
  const {
    defaultPage = 1,
    defaultLimit = 20,
    maxLimit = 100,
    minLimit = 1
  } = options

  let page = parseInt(query.page, 10)
  let limit = parseInt(query.limit, 10)

  // Validate page
  if (isNaN(page) || page < 1) {
    if (query.page !== undefined) {
      logger.warn('Invalid page parameter', { page: query.page })
    }
    page = defaultPage
  }

  // Validate limit
  if (isNaN(limit) || limit < minLimit) {
    if (query.limit !== undefined) {
      logger.warn('Invalid limit parameter (too small)', { limit: query.limit, minLimit })
    }
    limit = defaultLimit
  }

  if (limit > maxLimit) {
    logger.warn('Invalid limit parameter (too large)', { limit, maxLimit })
    limit = maxLimit
  }

  const offset = (page - 1) * limit

  return { page, limit, offset }
}

/**
 * Validate numeric parameter
 * @param {*} value - Value to validate
 * @param {Object} options - Validation options
 * @returns {number} Validated number
 * @throws {ValidationError}
 */
export function validateNumber(value, options = {}) {
  const {
    field = 'value',
    min = -Infinity,
    max = Infinity,
    integer = false,
    required = true
  } = options

  // Check if required
  if (value === undefined || value === null) {
    if (required) {
      throw new ValidationError(
        `${field} is required`,
        field,
        value,
        'number'
      )
    }
    return options.default !== undefined ? options.default : null
  }

  // Convert to number
  const num = Number(value)

  // Check if valid number
  if (isNaN(num) || !isFinite(num)) {
    throw new ValidationError(
      `${field} must be a valid number`,
      field,
      value,
      'number'
    )
  }

  // Check if integer required
  if (integer && !Number.isInteger(num)) {
    throw new ValidationError(
      `${field} must be an integer`,
      field,
      num,
      'integer'
    )
  }

  // Check range
  if (num < min) {
    throw new ValidationError(
      `${field} must be at least ${min}`,
      field,
      num,
      `>= ${min}`
    )
  }

  if (num > max) {
    throw new ValidationError(
      `${field} must be at most ${max}`,
      field,
      num,
      `<= ${max}`
    )
  }

  return num
}

/**
 * Validate string parameter
 * @param {*} value - Value to validate
 * @param {Object} options - Validation options
 * @returns {string} Validated string
 * @throws {ValidationError}
 */
export function validateString(value, options = {}) {
  const {
    field = 'value',
    minLength = 0,
    maxLength = Infinity,
    pattern = null,
    trim = true,
    required = true,
    allowEmpty = false
  } = options

  // Check if required
  if (value === undefined || value === null) {
    if (required) {
      throw new ValidationError(
        `${field} is required`,
        field,
        value,
        'string'
      )
    }
    return options.default !== undefined ? options.default : null
  }

  // Check type
  if (typeof value !== 'string') {
    throw new ValidationError(
      `${field} must be a string`,
      field,
      typeof value,
      'string'
    )
  }

  // Trim if requested
  let str = trim ? value.trim() : value

  // Check if empty
  if (!allowEmpty && str.length === 0 && required) {
    throw new ValidationError(
      `${field} cannot be empty`,
      field,
      str,
      'non-empty string'
    )
  }

  // Check length
  if (str.length < minLength) {
    throw new ValidationError(
      `${field} must be at least ${minLength} characters`,
      field,
      str.length,
      `length >= ${minLength}`
    )
  }

  if (str.length > maxLength) {
    throw new ValidationError(
      `${field} must be at most ${maxLength} characters`,
      field,
      str.length,
      `length <= ${maxLength}`
    )
  }

  // Check pattern
  if (pattern && !pattern.test(str)) {
    throw new ValidationError(
      `${field} format is invalid`,
      field,
      str,
      `match pattern ${pattern}`
    )
  }

  return str
}

/**
 * Validate enum parameter (one of allowed values)
 * @param {*} value - Value to validate
 * @param {Array} allowedValues - Array of allowed values
 * @param {Object} options - Validation options
 * @returns {*} Validated value
 * @throws {ValidationError}
 */
export function validateEnum(value, allowedValues, options = {}) {
  const {
    field = 'value',
    required = true,
    caseSensitive = true
  } = options

  // Check if required
  if (value === undefined || value === null) {
    if (required) {
      throw new ValidationError(
        `${field} is required`,
        field,
        value,
        `one of: ${allowedValues.join(', ')}`
      )
    }
    return options.default !== undefined ? options.default : null
  }

  // Normalize for case-insensitive comparison
  const normalizedValue = caseSensitive ? value : value.toLowerCase()
  const normalizedAllowed = caseSensitive
    ? allowedValues
    : allowedValues.map(v => v.toLowerCase())

  // Check if value is allowed
  if (!normalizedAllowed.includes(normalizedValue)) {
    throw new ValidationError(
      `${field} must be one of: ${allowedValues.join(', ')}`,
      field,
      value,
      allowedValues.join(', ')
    )
  }

  return value
}

/**
 * Validate array parameter
 * @param {*} value - Value to validate
 * @param {Object} options - Validation options
 * @returns {Array} Validated array
 * @throws {ValidationError}
 */
export function validateArray(value, options = {}) {
  const {
    field = 'value',
    minLength = 0,
    maxLength = Infinity,
    required = true,
    itemValidator = null
  } = options

  // Check if required
  if (value === undefined || value === null) {
    if (required) {
      throw new ValidationError(
        `${field} is required`,
        field,
        value,
        'array'
      )
    }
    return options.default !== undefined ? options.default : null
  }

  // Check type
  if (!Array.isArray(value)) {
    throw new ValidationError(
      `${field} must be an array`,
      field,
      typeof value,
      'array'
    )
  }

  // Check length
  if (value.length < minLength) {
    throw new ValidationError(
      `${field} must have at least ${minLength} items`,
      field,
      value.length,
      `>= ${minLength} items`
    )
  }

  if (value.length > maxLength) {
    throw new ValidationError(
      `${field} must have at most ${maxLength} items`,
      field,
      value.length,
      `<= ${maxLength} items`
    )
  }

  // Validate items if validator provided
  if (itemValidator) {
    for (let i = 0; i < value.length; i++) {
      try {
        value[i] = itemValidator(value[i], i)
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new ValidationError(
            `${field}[${i}]: ${error.message}`,
            `${field}[${i}]`,
            error.received,
            error.expected
          )
        }
        throw error
      }
    }
  }

  return value
}

/**
 * Validate boolean parameter
 * @param {*} value - Value to validate
 * @param {Object} options - Validation options
 * @returns {boolean} Validated boolean
 * @throws {ValidationError}
 */
export function validateBoolean(value, options = {}) {
  const {
    field = 'value',
    required = true
  } = options

  // Check if required
  if (value === undefined || value === null) {
    if (required) {
      throw new ValidationError(
        `${field} is required`,
        field,
        value,
        'boolean'
      )
    }
    return options.default !== undefined ? options.default : null
  }

  // Convert string representations
  if (typeof value === 'string') {
    const lower = value.toLowerCase()
    if (lower === 'true') return true
    if (lower === 'false') return false
  }

  // Check type
  if (typeof value !== 'boolean') {
    throw new ValidationError(
      `${field} must be a boolean`,
      field,
      typeof value,
      'boolean'
    )
  }

  return value
}

/**
 * Validate object parameter
 * @param {*} value - Value to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validated object
 * @throws {ValidationError}
 */
export function validateObject(value, options = {}) {
  const {
    field = 'value',
    required = true,
    schema = null
  } = options

  // Check if required
  if (value === undefined || value === null) {
    if (required) {
      throw new ValidationError(
        `${field} is required`,
        field,
        value,
        'object'
      )
    }
    return options.default !== undefined ? options.default : null
  }

  // Check type
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(
      `${field} must be an object`,
      field,
      Array.isArray(value) ? 'array' : typeof value,
      'object'
    )
  }

  // Validate schema if provided
  if (schema) {
    const validated = {}
    for (const [key, validator] of Object.entries(schema)) {
      try {
        validated[key] = validator(value[key])
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new ValidationError(
            `${field}.${key}: ${error.message}`,
            `${field}.${key}`,
            error.received,
            error.expected
          )
        }
        throw error
      }
    }
    return validated
  }

  return value
}

/**
 * Validate date/timestamp parameter
 * @param {*} value - Value to validate
 * @param {Object} options - Validation options
 * @returns {Date} Validated Date object
 * @throws {ValidationError}
 */
export function validateDate(value, options = {}) {
  const {
    field = 'value',
    required = true,
    min = null,
    max = null
  } = options

  // Check if required
  if (value === undefined || value === null) {
    if (required) {
      throw new ValidationError(
        `${field} is required`,
        field,
        value,
        'date'
      )
    }
    return options.default !== undefined ? options.default : null
  }

  // Try to parse date
  let date
  if (value instanceof Date) {
    date = value
  } else {
    date = new Date(value)
  }

  // Check if valid date
  if (isNaN(date.getTime())) {
    throw new ValidationError(
      `${field} must be a valid date`,
      field,
      value,
      'valid date'
    )
  }

  // Check range
  if (min && date < new Date(min)) {
    throw new ValidationError(
      `${field} must be after ${min}`,
      field,
      date.toISOString(),
      `> ${min}`
    )
  }

  if (max && date > new Date(max)) {
    throw new ValidationError(
      `${field} must be before ${max}`,
      field,
      date.toISOString(),
      `< ${max}`
    )
  }

  return date
}

/**
 * Validate file size
 * @param {number} size - File size in bytes
 * @param {Object} options - Validation options
 * @returns {number} Validated size
 * @throws {ValidationError}
 */
export function validateFileSize(size, options = {}) {
  const {
    field = 'file',
    maxSize = 50 * 1024 * 1024, // 50MB default
    minSize = 0
  } = options

  const sizeNum = validateNumber(size, {
    field: `${field} size`,
    min: minSize,
    max: maxSize,
    integer: true,
    required: true
  })

  return sizeNum
}

/**
 * Validate JSON payload structure
 * @param {*} data - Data to validate
 * @param {Object} schema - Schema definition
 * @returns {Object} Validated data
 * @throws {ValidationError}
 */
export function validateSchema(data, schema) {
  if (!data || typeof data !== 'object') {
    throw new ValidationError(
      'Request body must be a valid JSON object',
      'body',
      typeof data,
      'object'
    )
  }

  const validated = {}

  for (const [key, validator] of Object.entries(schema)) {
    try {
      validated[key] = validator(data[key])
    } catch (error) {
      if (error instanceof ValidationError) {
        // Re-throw with field context
        throw error
      }
      throw new ValidationError(
        `Validation failed for field "${key}": ${error.message}`,
        key,
        data[key],
        'valid value'
      )
    }
  }

  return validated
}

/**
 * Express middleware factory for validation
 * @param {Object} schema - Validation schema
 * @param {string} source - Source of data ('body', 'query', 'params')
 * @returns {Function} Express middleware
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const data = req[source]
      req[`validated${source.charAt(0).toUpperCase() + source.slice(1)}`] = validateSchema(data, schema)
      next()
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.warn('Validation error', {
          field: error.field,
          received: error.received,
          expected: error.expected,
          path: req.path
        })
        return res.status(400).json({
          error: 'Validation Error',
          message: error.message,
          field: error.field,
          received: error.received,
          expected: error.expected
        })
      }
      logger.error('Unexpected validation error', error)
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred during validation'
      })
    }
  }
}

export default {
  ValidationError,
  validatePagination,
  validateNumber,
  validateString,
  validateEnum,
  validateArray,
  validateBoolean,
  validateObject,
  validateDate,
  validateFileSize,
  validateSchema,
  validate
}
