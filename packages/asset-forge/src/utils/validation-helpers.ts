/**
 * Validation Helpers
 *
 * Type-safe utilities for null/undefined checking and validation.
 *
 * These utilities help prevent "Cannot read property of undefined/null" errors
 * by providing consistent, reusable validation patterns throughout the application.
 */

import createLogger from './logger.ts'

const logger = createLogger('ValidationHelpers')

/**
 * Asserts that a value is defined (not null or undefined).
 * Throws an error if the value is null or undefined.
 *
 * @example
 * ```ts
 * const user = getUser()
 * assertDefined(user, 'User must be defined')
 * console.log(user.name) // TypeScript knows user is defined
 * ```
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message = 'Value is null or undefined'
): asserts value is T {
  if (value === null || value === undefined) {
    logger.error(`Assertion failed: ${message}`)
    throw new Error(message)
  }
}

/**
 * Type guard to check if a value is defined (not null or undefined).
 *
 * @example
 * ```ts
 * if (isDefined(config.value)) {
 *   console.log(config.value) // TypeScript narrows type
 * }
 * ```
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

/**
 * Type guard to check if an array is non-empty.
 *
 * @example
 * ```ts
 * if (isNonEmpty(items)) {
 *   console.log(items[0]) // Safe access
 * }
 * ```
 */
export function isNonEmpty<T>(array: T[] | null | undefined): array is T[] {
  return Array.isArray(array) && array.length > 0
}

/**
 * Type guard to check if a string is non-empty.
 *
 * @example
 * ```ts
 * if (isNonEmptyString(text)) {
 *   console.log(text.toUpperCase()) // Safe access
 * }
 * ```
 */
export function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Safely get a value from an array at a specific index.
 * Returns undefined if the index is out of bounds or the array is null/undefined.
 *
 * @example
 * ```ts
 * const firstUser = safeArrayAccess(users, 0)
 * if (firstUser) {
 *   console.log(firstUser.name)
 * }
 * ```
 */
export function safeArrayAccess<T>(
  array: T[] | null | undefined,
  index: number
): T | undefined {
  if (!array || !Array.isArray(array)) {
    return undefined
  }

  if (index < 0 || index >= array.length) {
    return undefined
  }

  return array[index]
}

/**
 * Safely get the first element of an array.
 * Returns undefined if the array is null/undefined or empty.
 *
 * @example
 * ```ts
 * const firstItem = safeFirst(items)
 * if (firstItem) {
 *   console.log(firstItem.name)
 * }
 * ```
 */
export function safeFirst<T>(array: T[] | null | undefined): T | undefined {
  return safeArrayAccess(array, 0)
}

/**
 * Safely get the last element of an array.
 * Returns undefined if the array is null/undefined or empty.
 *
 * @example
 * ```ts
 * const lastItem = safeLast(items)
 * if (lastItem) {
 *   console.log(lastItem.name)
 * }
 * ```
 */
export function safeLast<T>(array: T[] | null | undefined): T | undefined {
  if (!array || !Array.isArray(array) || array.length === 0) {
    return undefined
  }
  return array[array.length - 1]
}

/**
 * Safely get a property from an object.
 * Returns undefined if the object is null/undefined or the property doesn't exist.
 *
 * @example
 * ```ts
 * const name = safeGet(user, 'name')
 * console.log(name ?? 'Unknown')
 * ```
 */
export function safeGet<T, K extends keyof T>(
  obj: T | null | undefined,
  key: K
): T[K] | undefined {
  if (!obj || typeof obj !== 'object') {
    return undefined
  }
  return obj[key]
}

/**
 * Ensures a value is an array, converting null/undefined to an empty array.
 *
 * @example
 * ```ts
 * const items = ensureArray(maybeItems)
 * items.forEach(item => console.log(item)) // Always safe
 * ```
 */
export function ensureArray<T>(value: T[] | null | undefined): T[] {
  return value ?? []
}

/**
 * Ensures a value is a string, converting null/undefined to an empty string.
 *
 * @example
 * ```ts
 * const text = ensureString(maybeText)
 * console.log(text.toUpperCase()) // Always safe
 * ```
 */
export function ensureString(value: string | null | undefined): string {
  return value ?? ''
}

/**
 * Ensures a value is a number, converting null/undefined to a default value.
 *
 * @example
 * ```ts
 * const count = ensureNumber(maybeCount, 0)
 * console.log(count + 1) // Always safe
 * ```
 */
export function ensureNumber(
  value: number | null | undefined,
  defaultValue = 0
): number {
  return value ?? defaultValue
}

/**
 * Checks if an object has all required properties.
 *
 * @example
 * ```ts
 * if (hasRequiredProps(obj, ['id', 'name'])) {
 *   console.log(obj.id, obj.name) // Safe access
 * }
 * ```
 */
export function hasRequiredProps<T extends object, K extends keyof T>(
  obj: T | null | undefined,
  keys: K[]
): obj is T & Record<K, NonNullable<T[K]>> {
  if (!obj || typeof obj !== 'object') {
    return false
  }

  return keys.every(key => {
    const value = obj[key]
    return value !== null && value !== undefined
  })
}

/**
 * Safely parse JSON, returning undefined on error.
 *
 * @example
 * ```ts
 * const data = safeJsonParse<MyType>(jsonString)
 * if (data) {
 *   console.log(data.property)
 * }
 * ```
 */
export function safeJsonParse<T>(json: string | null | undefined): T | undefined {
  if (!json || typeof json !== 'string') {
    return undefined
  }

  try {
    return JSON.parse(json) as T
  } catch (error) {
    logger.warn('Failed to parse JSON:', error)
    return undefined
  }
}

/**
 * Validates that an array contains at least one element and all elements are defined.
 *
 * @example
 * ```ts
 * if (validateArray(items, 'Items')) {
 *   // items is guaranteed to be non-empty with defined elements
 *   items.forEach(item => console.log(item.name))
 * }
 * ```
 */
export function validateArray<T>(
  array: T[] | null | undefined,
  name: string
): array is T[] {
  if (!isNonEmpty(array)) {
    logger.warn(`${name} is null, undefined, or empty`)
    return false
  }

  const hasUndefined = array.some(item => item === null || item === undefined)
  if (hasUndefined) {
    logger.warn(`${name} contains null or undefined elements`)
    return false
  }

  return true
}

/**
 * Filters out null and undefined values from an array.
 *
 * @example
 * ```ts
 * const definedItems = filterDefined(items)
 * definedItems.forEach(item => console.log(item.name)) // All items are defined
 * ```
 */
export function filterDefined<T>(array: (T | null | undefined)[]): T[] {
  return array.filter((item): item is T => item !== null && item !== undefined)
}

/**
 * Safely executes a function, catching and logging any errors.
 * Returns undefined on error.
 *
 * @example
 * ```ts
 * const result = safeExecute(() => dangerousOperation(), 'Operation failed')
 * if (result) {
 *   console.log(result)
 * }
 * ```
 */
export function safeExecute<T>(
  fn: () => T,
  errorMessage = 'Function execution failed'
): T | undefined {
  try {
    return fn()
  } catch (error) {
    logger.error(errorMessage, error)
    return undefined
  }
}

/**
 * Safely executes an async function, catching and logging any errors.
 * Returns undefined on error.
 *
 * @example
 * ```ts
 * const result = await safeExecuteAsync(async () => await fetchData(), 'Fetch failed')
 * if (result) {
 *   console.log(result)
 * }
 * ```
 */
export async function safeExecuteAsync<T>(
  fn: () => Promise<T>,
  errorMessage = 'Async function execution failed'
): Promise<T | undefined> {
  try {
    return await fn()
  } catch (error) {
    logger.error(errorMessage, error)
    return undefined
  }
}

/**
 * Type guard for checking if a value is a valid object (not null, array, or primitive).
 *
 * @example
 * ```ts
 * if (isObject(value)) {
 *   console.log(Object.keys(value))
 * }
 * ```
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

/**
 * Check if object has any keys.
 *
 * @param obj - Object to check
 * @returns True if object has at least one key
 *
 * @example
 * ```ts
 * hasKeys({}) // false
 * hasKeys({ name: 'John' }) // true
 * hasKeys(null) // false
 * ```
 */
export function hasKeys(obj: object | null | undefined): boolean {
  if (!obj || typeof obj !== 'object') return false
  return Object.keys(obj).length > 0
}

/**
 * Check if object is empty (no keys).
 *
 * @param obj - Object to check
 * @returns True if object has no keys
 *
 * @example
 * ```ts
 * isEmptyObject({}) // true
 * isEmptyObject({ name: 'John' }) // false
 * ```
 */
export function isEmptyObject(obj: object | null | undefined): boolean {
  return !hasKeys(obj)
}

/**
 * Validate file type.
 *
 * @param file - File to validate
 * @param allowedTypes - Array of allowed MIME types or extensions
 * @returns True if file type is allowed
 *
 * @example
 * ```ts
 * isValidFileType(file, ['image/png', 'image/jpeg']) // true for PNG/JPEG
 * isValidFileType(file, ['.glb', '.gltf']) // true for GLB/GLTF
 * ```
 */
export function isValidFileType(file: File, allowedTypes: string[]): boolean {
  if (!file) return false

  // Check MIME type
  if (allowedTypes.some(type => !type.startsWith('.') && file.type === type)) {
    return true
  }

  // Check extension
  const extension = '.' + file.name.split('.').pop()?.toLowerCase()
  return allowedTypes.some(type => type.startsWith('.') && type.toLowerCase() === extension)
}

/**
 * Validate file size.
 *
 * @param file - File to validate
 * @param maxSize - Maximum size in bytes
 * @returns True if file size is within limit
 *
 * @example
 * ```ts
 * isValidFileSize(file, 5 * 1024 * 1024) // true if file <= 5MB
 * ```
 */
export function isValidFileSize(file: File, maxSize: number): boolean {
  if (!file) return false
  return file.size <= maxSize
}

/**
 * Validate URL format.
 *
 * @param url - URL to validate
 * @returns True if URL is valid
 *
 * @example
 * ```ts
 * isValidUrl('https://example.com') // true
 * isValidUrl('not a url') // false
 * ```
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false

  // Check for relative URLs
  if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
    return true
  }

  // Check for absolute URLs
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Validate email format.
 *
 * @param email - Email to validate
 * @returns True if email is valid
 *
 * @example
 * ```ts
 * isValidEmail('user@example.com') // true
 * isValidEmail('invalid') // false
 * ```
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Check if string contains pattern (case-insensitive).
 *
 * @param str - String to search
 * @param pattern - Pattern to search for
 * @returns True if pattern is found
 *
 * @example
 * ```ts
 * containsIgnoreCase('Hello World', 'world') // true
 * containsIgnoreCase('Test', 'xyz') // false
 * ```
 */
export function containsIgnoreCase(str: string, pattern: string): boolean {
  if (!str || !pattern) return false
  return str.toLowerCase().includes(pattern.toLowerCase())
}

/**
 * Check if string starts with pattern (case-insensitive).
 *
 * @param str - String to check
 * @param pattern - Pattern to check for
 * @returns True if string starts with pattern
 *
 * @example
 * ```ts
 * startsWithIgnoreCase('Hello World', 'hello') // true
 * startsWithIgnoreCase('Test', 'xyz') // false
 * ```
 */
export function startsWithIgnoreCase(str: string, pattern: string): boolean {
  if (!str || !pattern) return false
  return str.toLowerCase().startsWith(pattern.toLowerCase())
}

/**
 * Check if string ends with pattern (case-insensitive).
 *
 * @param str - String to check
 * @param pattern - Pattern to check for
 * @returns True if string ends with pattern
 *
 * @example
 * ```ts
 * endsWithIgnoreCase('Hello World', 'world') // true
 * endsWithIgnoreCase('Test', 'xyz') // false
 * ```
 */
export function endsWithIgnoreCase(str: string, pattern: string): boolean {
  if (!str || !pattern) return false
  return str.toLowerCase().endsWith(pattern.toLowerCase())
}

/**
 * Validate number is within range.
 *
 * @param value - Value to check
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @returns True if value is within range
 *
 * @example
 * ```ts
 * isInRange(5, 1, 10) // true
 * isInRange(15, 1, 10) // false
 * ```
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

/**
 * Validate number is positive.
 *
 * @param value - Value to check
 * @returns True if value is positive
 *
 * @example
 * ```ts
 * isPositive(5) // true
 * isPositive(-5) // false
 * isPositive(0) // false
 * ```
 */
export function isPositive(value: number): boolean {
  return value > 0
}

/**
 * Validate number is non-negative.
 *
 * @param value - Value to check
 * @returns True if value is >= 0
 *
 * @example
 * ```ts
 * isNonNegative(5) // true
 * isNonNegative(0) // true
 * isNonNegative(-5) // false
 * ```
 */
export function isNonNegative(value: number): boolean {
  return value >= 0
}
