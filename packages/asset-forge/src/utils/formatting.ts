/**
 * Formatting Utilities
 *
 * Centralized utilities for formatting dates, numbers, file sizes, and strings.
 * Eliminates duplicate formatting logic across the application.
 */

/**
 * Format date to localized string.
 *
 * @param date - Date to format (Date object, timestamp, or ISO string)
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 *
 * @example
 * ```typescript
 * formatDate(new Date()) // "Oct 24, 2025"
 * formatDate('2025-10-24') // "Oct 24, 2025"
 * formatDate(1729756800000) // "Oct 24, 2025"
 * ```
 */
export function formatDate(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }
): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  return dateObj.toLocaleDateString('en-US', options)
}

/**
 * Format date to localized date and time string.
 *
 * @param date - Date to format
 * @returns Formatted date and time string
 *
 * @example
 * ```typescript
 * formatDateTime(new Date()) // "Oct 24, 2025, 10:30 AM"
 * ```
 */
export function formatDateTime(date: Date | string | number): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  return dateObj.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

/**
 * Format time to localized time string.
 *
 * @param date - Date to extract time from
 * @returns Formatted time string
 *
 * @example
 * ```typescript
 * formatTime(new Date()) // "10:30:15 AM"
 * ```
 */
export function formatTime(date: Date | string | number): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  return dateObj.toLocaleTimeString('en-US')
}

/**
 * Format number with locale-specific thousands separators.
 *
 * @param value - Number to format
 * @param options - Intl.NumberFormat options
 * @returns Formatted number string
 *
 * @example
 * ```typescript
 * formatNumber(1234567) // "1,234,567"
 * formatNumber(1234.56, { minimumFractionDigits: 2 }) // "1,234.56"
 * ```
 */
export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  return value.toLocaleString('en-US', options)
}

/**
 * Format number as percentage.
 *
 * @param value - Decimal value (0-1) or percentage value (0-100)
 * @param decimals - Number of decimal places (default: 0)
 * @param asDecimal - Whether input is decimal (0-1) or percentage (0-100) (default: true)
 * @returns Formatted percentage string
 *
 * @example
 * ```typescript
 * formatPercentage(0.75) // "75%"
 * formatPercentage(0.7532, 2) // "75.32%"
 * formatPercentage(75, 0, false) // "75%"
 * ```
 */
export function formatPercentage(
  value: number,
  decimals: number = 0,
  asDecimal: boolean = true
): string {
  const percentage = asDecimal ? value * 100 : value
  return `${percentage.toFixed(decimals)}%`
}

/**
 * Format bytes to human-readable file size.
 *
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted file size string
 *
 * @example
 * ```typescript
 * formatFileSize(1024) // "1.0 KB"
 * formatFileSize(1048576) // "1.0 MB"
 * formatFileSize(0) // "0 Bytes"
 * formatFileSize(1536, 2) // "1.50 KB"
 * ```
 */
export function formatFileSize(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${sizes[i]}`
}

/**
 * Truncate string with ellipsis.
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length before truncation
 * @param ellipsis - Ellipsis string (default: "...")
 * @returns Truncated string
 *
 * @example
 * ```typescript
 * truncate("Hello World", 8) // "Hello..."
 * truncate("Short", 10) // "Short"
 * truncate("Hello World", 8, "…") // "Hello W…"
 * ```
 */
export function truncate(
  str: string,
  maxLength: number,
  ellipsis: string = '...'
): string {
  if (!str || str.length <= maxLength) return str
  return str.substring(0, maxLength - ellipsis.length) + ellipsis
}

/**
 * Truncate string in the middle with ellipsis.
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length before truncation
 * @param ellipsis - Ellipsis string (default: "...")
 * @returns Truncated string
 *
 * @example
 * ```typescript
 * truncateMiddle("0x1234567890abcdef", 10) // "0x123...def"
 * truncateMiddle("verylongfilename.txt", 15) // "verylon...e.txt"
 * ```
 */
export function truncateMiddle(
  str: string,
  maxLength: number,
  ellipsis: string = '...'
): string {
  if (!str || str.length <= maxLength) return str

  const charsToShow = maxLength - ellipsis.length
  const frontChars = Math.ceil(charsToShow / 2)
  const backChars = Math.floor(charsToShow / 2)

  return str.substring(0, frontChars) + ellipsis + str.substring(str.length - backChars)
}

/**
 * Convert string to title case.
 *
 * @param str - String to convert
 * @returns Title-cased string
 *
 * @example
 * ```typescript
 * toTitleCase("hello world") // "Hello World"
 * toTitleCase("the quick brown fox") // "The Quick Brown Fox"
 * ```
 */
export function toTitleCase(str: string): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Convert camelCase or PascalCase to Title Case.
 *
 * @param str - String in camelCase or PascalCase
 * @returns Title-cased string with spaces
 *
 * @example
 * ```typescript
 * camelToTitleCase("helloWorld") // "Hello World"
 * camelToTitleCase("MyComponent") // "My Component"
 * ```
 */
export function camelToTitleCase(str: string): string {
  if (!str) return ''
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, char => char.toUpperCase())
    .trim()
}

/**
 * Convert kebab-case to Title Case.
 *
 * @param str - String in kebab-case
 * @returns Title-cased string with spaces
 *
 * @example
 * ```typescript
 * kebabToTitleCase("hello-world") // "Hello World"
 * kebabToTitleCase("my-component-name") // "My Component Name"
 * ```
 */
export function kebabToTitleCase(str: string): string {
  if (!str) return ''
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Format wallet address with truncation in the middle.
 *
 * @param address - Wallet address
 * @param startChars - Number of characters to show at start (default: 6)
 * @param endChars - Number of characters to show at end (default: 4)
 * @returns Formatted wallet address
 *
 * @example
 * ```typescript
 * formatWalletAddress("0x1234567890abcdef1234567890abcdef12345678") // "0x1234...5678"
 * formatWalletAddress("0x1234567890abcdef", 8, 6) // "0x123456...abcdef"
 * ```
 */
export function formatWalletAddress(
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string {
  if (!address || address.length <= startChars + endChars) return address
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

/**
 * Format duration in milliseconds to human-readable string.
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string
 *
 * @example
 * ```typescript
 * formatDuration(1000) // "1s"
 * formatDuration(65000) // "1m 5s"
 * formatDuration(3661000) // "1h 1m 1s"
 * ```
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor((ms / 1000) % 60)
  const minutes = Math.floor((ms / (1000 * 60)) % 60)
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24)
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`)

  return parts.join(' ')
}

/**
 * Pluralize a word based on count.
 *
 * @param count - Number to check
 * @param singular - Singular form of word
 * @param plural - Plural form of word (optional, defaults to singular + 's')
 * @returns Pluralized word
 *
 * @example
 * ```typescript
 * pluralize(1, "item") // "item"
 * pluralize(5, "item") // "items"
 * pluralize(2, "person", "people") // "people"
 * ```
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string
): string {
  return count === 1 ? singular : (plural || `${singular}s`)
}

/**
 * Format count with label and pluralization.
 *
 * @param count - Number to format
 * @param label - Label to use (singular form)
 * @param plural - Plural form of label (optional)
 * @returns Formatted count string
 *
 * @example
 * ```typescript
 * formatCount(1, "item") // "1 item"
 * formatCount(5, "item") // "5 items"
 * formatCount(2, "person", "people") // "2 people"
 * ```
 */
export function formatCount(
  count: number,
  label: string,
  plural?: string
): string {
  return `${formatNumber(count)} ${pluralize(count, label, plural)}`
}
