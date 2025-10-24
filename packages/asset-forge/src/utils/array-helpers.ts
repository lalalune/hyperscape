/**
 * Array Helpers
 *
 * Centralized utilities for common array operations like grouping,
 * partitioning, deduplication, and transformation.
 */

/**
 * Group array items by a key.
 *
 * @param array - Array to group
 * @param key - Key to group by (can be nested path like "metadata.type")
 * @returns Record mapping key values to arrays of items
 *
 * @example
 * ```typescript
 * const items = [
 *   { type: 'weapon', name: 'Sword' },
 *   { type: 'armor', name: 'Helmet' },
 *   { type: 'weapon', name: 'Axe' }
 * ]
 * groupBy(items, 'type')
 * // { weapon: [...], armor: [...] }
 * ```
 */
export function groupBy<T extends Record<string, unknown>>(
  array: T[],
  key: keyof T | string
): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const groupKey = getNestedValue(item, key as string) as string
    if (!acc[groupKey]) {
      acc[groupKey] = []
    }
    acc[groupKey].push(item)
    return acc
  }, {} as Record<string, T[]>)
}

/**
 * Group array items by a function.
 *
 * @param array - Array to group
 * @param fn - Function that returns the group key for each item
 * @returns Record mapping key values to arrays of items
 *
 * @example
 * ```typescript
 * const items = [
 *   { name: 'Apple', price: 1.99 },
 *   { name: 'Banana', price: 0.99 },
 *   { name: 'Cherry', price: 2.99 }
 * ]
 * groupByFn(items, item => item.price < 2 ? 'cheap' : 'expensive')
 * // { cheap: [...], expensive: [...] }
 * ```
 */
export function groupByFn<T>(
  array: T[],
  fn: (item: T) => string | number
): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const key = String(fn(item))
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(item)
    return acc
  }, {} as Record<string, T[]>)
}

/**
 * Partition array into two arrays based on a predicate.
 *
 * @param array - Array to partition
 * @param predicate - Function that returns true for first array, false for second
 * @returns Tuple of [matching items, non-matching items]
 *
 * @example
 * ```typescript
 * const numbers = [1, 2, 3, 4, 5, 6]
 * const [evens, odds] = partition(numbers, n => n % 2 === 0)
 * // evens: [2, 4, 6], odds: [1, 3, 5]
 * ```
 */
export function partition<T>(
  array: T[],
  predicate: (item: T) => boolean
): [T[], T[]] {
  const matching: T[] = []
  const nonMatching: T[] = []

  for (const item of array) {
    if (predicate(item)) {
      matching.push(item)
    } else {
      nonMatching.push(item)
    }
  }

  return [matching, nonMatching]
}

/**
 * Remove duplicate items from array.
 *
 * @param array - Array to deduplicate
 * @returns Array with duplicates removed
 *
 * @example
 * ```typescript
 * deduplicate([1, 2, 2, 3, 3, 3]) // [1, 2, 3]
 * deduplicate(['a', 'b', 'a', 'c']) // ['a', 'b', 'c']
 * ```
 */
export function deduplicate<T>(array: T[]): T[] {
  return Array.from(new Set(array))
}

/**
 * Remove duplicate items from array based on a key.
 *
 * @param array - Array to deduplicate
 * @param key - Key to use for uniqueness check
 * @returns Array with duplicates removed
 *
 * @example
 * ```typescript
 * const items = [
 *   { id: 1, name: 'A' },
 *   { id: 2, name: 'B' },
 *   { id: 1, name: 'C' }
 * ]
 * deduplicateBy(items, 'id') // [{ id: 1, name: 'A' }, { id: 2, name: 'B' }]
 * ```
 */
export function deduplicateBy<T extends Record<string, unknown>>(
  array: T[],
  key: keyof T | string
): T[] {
  const seen = new Set<unknown>()
  return array.filter(item => {
    const value = getNestedValue(item, key as string)
    if (seen.has(value)) {
      return false
    }
    seen.add(value)
    return true
  })
}

/**
 * Remove duplicate items from array based on a function.
 *
 * @param array - Array to deduplicate
 * @param fn - Function that returns the unique key for each item
 * @returns Array with duplicates removed
 *
 * @example
 * ```typescript
 * const items = [
 *   { id: 1, name: 'Apple' },
 *   { id: 2, name: 'Banana' },
 *   { id: 3, name: 'Apple' }
 * ]
 * deduplicateByFn(items, item => item.name.toLowerCase())
 * // [{ id: 1, name: 'Apple' }, { id: 2, name: 'Banana' }]
 * ```
 */
export function deduplicateByFn<T>(
  array: T[],
  fn: (item: T) => unknown
): T[] {
  const seen = new Set<unknown>()
  return array.filter(item => {
    const key = fn(item)
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

/**
 * Chunk array into smaller arrays of specified size.
 *
 * @param array - Array to chunk
 * @param size - Size of each chunk
 * @returns Array of chunks
 *
 * @example
 * ```typescript
 * chunk([1, 2, 3, 4, 5], 2) // [[1, 2], [3, 4], [5]]
 * chunk(['a', 'b', 'c'], 1) // [['a'], ['b'], ['c']]
 * ```
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Sort array by key in ascending or descending order.
 *
 * @param array - Array to sort
 * @param key - Key to sort by
 * @param order - Sort order ('asc' or 'desc')
 * @returns Sorted array (does not mutate original)
 *
 * @example
 * ```typescript
 * const items = [
 *   { name: 'Charlie', age: 30 },
 *   { name: 'Alice', age: 25 },
 *   { name: 'Bob', age: 35 }
 * ]
 * sortBy(items, 'age') // [Alice, Charlie, Bob]
 * sortBy(items, 'name', 'desc') // [Charlie, Bob, Alice]
 * ```
 */
export function sortBy<T extends Record<string, unknown>>(
  array: T[],
  key: keyof T | string,
  order: 'asc' | 'desc' = 'asc'
): T[] {
  return [...array].sort((a, b) => {
    const aVal = getNestedValue(a, key as string)
    const bVal = getNestedValue(b, key as string)

    if (aVal === bVal) return 0

    // Type guard for comparable values
    const isComparable = (v: unknown): v is number | string =>
      typeof v === 'number' || typeof v === 'string'

    if (!isComparable(aVal) || !isComparable(bVal)) return 0

    const comparison = aVal < bVal ? -1 : 1
    return order === 'asc' ? comparison : -comparison
  })
}

/**
 * Find first item matching predicate.
 *
 * @param array - Array to search
 * @param predicate - Function to test each item
 * @returns First matching item or undefined
 *
 * @example
 * ```typescript
 * const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
 * findFirst(items, item => item.id > 1) // { id: 2 }
 * ```
 */
export function findFirst<T>(
  array: T[],
  predicate: (item: T) => boolean
): T | undefined {
  return array.find(predicate)
}

/**
 * Find last item matching predicate.
 *
 * @param array - Array to search
 * @param predicate - Function to test each item
 * @returns Last matching item or undefined
 *
 * @example
 * ```typescript
 * const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
 * findLast(items, item => item.id > 1) // { id: 3 }
 * ```
 */
export function findLast<T>(
  array: T[],
  predicate: (item: T) => boolean
): T | undefined {
  for (let i = array.length - 1; i >= 0; i--) {
    if (predicate(array[i])) {
      return array[i]
    }
  }
  return undefined
}

/**
 * Count items matching predicate.
 *
 * @param array - Array to count
 * @param predicate - Function to test each item
 * @returns Count of matching items
 *
 * @example
 * ```typescript
 * const items = [1, 2, 3, 4, 5]
 * countWhere(items, n => n > 2) // 3
 * ```
 */
export function countWhere<T>(
  array: T[],
  predicate: (item: T) => boolean
): number {
  return array.filter(predicate).length
}

/**
 * Check if array is empty.
 *
 * @param array - Array to check
 * @returns True if array is null, undefined, or empty
 *
 * @example
 * ```typescript
 * isEmpty([]) // true
 * isEmpty([1, 2]) // false
 * isEmpty(null) // true
 * ```
 */
export function isEmpty(array: unknown[] | null | undefined): boolean {
  return !array || array.length === 0
}

/**
 * Check if array is non-empty.
 *
 * @param array - Array to check
 * @returns True if array is defined and has items
 *
 * @example
 * ```typescript
 * isNonEmpty([1, 2]) // true
 * isNonEmpty([]) // false
 * isNonEmpty(null) // false
 * ```
 */
export function isNonEmpty<T>(array: T[] | null | undefined): array is T[] {
  return Array.isArray(array) && array.length > 0
}

/**
 * Get random item from array.
 *
 * @param array - Array to pick from
 * @returns Random item or undefined if array is empty
 *
 * @example
 * ```typescript
 * const items = ['a', 'b', 'c']
 * randomItem(items) // 'b' (random)
 * ```
 */
export function randomItem<T>(array: T[]): T | undefined {
  if (isEmpty(array)) return undefined
  return array[Math.floor(Math.random() * array.length)]
}

/**
 * Get multiple random items from array.
 *
 * @param array - Array to pick from
 * @param count - Number of items to pick
 * @returns Array of random items (may contain duplicates)
 *
 * @example
 * ```typescript
 * const items = ['a', 'b', 'c', 'd']
 * randomItems(items, 2) // ['c', 'a'] (random)
 * ```
 */
export function randomItems<T>(array: T[], count: number): T[] {
  if (isEmpty(array)) return []
  return Array.from({ length: count }, () => randomItem(array)!)
}

/**
 * Shuffle array (Fisher-Yates shuffle).
 *
 * @param array - Array to shuffle
 * @returns Shuffled copy of array (does not mutate original)
 *
 * @example
 * ```typescript
 * shuffle([1, 2, 3, 4, 5]) // [3, 1, 5, 2, 4] (random)
 * ```
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Take first N items from array.
 *
 * @param array - Array to take from
 * @param count - Number of items to take
 * @returns Array of first N items
 *
 * @example
 * ```typescript
 * take([1, 2, 3, 4, 5], 3) // [1, 2, 3]
 * ```
 */
export function take<T>(array: T[], count: number): T[] {
  return array.slice(0, count)
}

/**
 * Take last N items from array.
 *
 * @param array - Array to take from
 * @param count - Number of items to take
 * @returns Array of last N items
 *
 * @example
 * ```typescript
 * takeLast([1, 2, 3, 4, 5], 3) // [3, 4, 5]
 * ```
 */
export function takeLast<T>(array: T[], count: number): T[] {
  return array.slice(-count)
}

/**
 * Get nested value from object using dot notation.
 *
 * @param obj - Object to get value from
 * @param path - Path to value (e.g., "user.name" or "metadata.type")
 * @returns Value at path or undefined
 *
 * @example
 * ```typescript
 * const obj = { user: { name: 'John', age: 30 } }
 * getNestedValue(obj, 'user.name') // 'John'
 * getNestedValue(obj, 'user.email') // undefined
 * ```
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current, key) => {
    return current && typeof current === 'object' && !Array.isArray(current)
      ? (current as Record<string, unknown>)[key]
      : undefined
  }, obj as unknown)
}

/**
 * Flatten nested arrays one level deep.
 *
 * @param array - Array to flatten
 * @returns Flattened array
 *
 * @example
 * ```typescript
 * flatten([[1, 2], [3, 4], [5]]) // [1, 2, 3, 4, 5]
 * ```
 */
export function flatten<T>(array: T[][]): T[] {
  return array.flat()
}

/**
 * Flatten nested arrays recursively.
 *
 * @param array - Array to flatten
 * @returns Deeply flattened array
 *
 * @example
 * ```typescript
 * flattenDeep([[1, [2, [3]]], [4, 5]]) // [1, 2, 3, 4, 5]
 * ```
 */
export function flattenDeep(array: unknown[]): unknown[] {
  return array.reduce((acc: unknown[], val) => {
    return acc.concat(Array.isArray(val) ? flattenDeep(val) : val)
  }, [])
}

/**
 * Compact array by removing falsy values.
 *
 * @param array - Array to compact
 * @returns Array with falsy values removed
 *
 * @example
 * ```typescript
 * compact([1, 0, null, 2, '', 3, undefined, false]) // [1, 2, 3]
 * ```
 */
export function compact<T>(array: (T | null | undefined | false | 0 | '')[]): T[] {
  return array.filter(Boolean) as T[]
}

/**
 * Create array of numbers in range.
 *
 * @param start - Start value (inclusive)
 * @param end - End value (exclusive)
 * @param step - Step value (default: 1)
 * @returns Array of numbers
 *
 * @example
 * ```typescript
 * range(0, 5) // [0, 1, 2, 3, 4]
 * range(1, 10, 2) // [1, 3, 5, 7, 9]
 * ```
 */
export function range(start: number, end: number, step: number = 1): number[] {
  const result: number[] = []
  for (let i = start; i < end; i += step) {
    result.push(i)
  }
  return result
}

/**
 * Zip multiple arrays together.
 *
 * @param arrays - Arrays to zip
 * @returns Array of tuples
 *
 * @example
 * ```typescript
 * zip([1, 2, 3], ['a', 'b', 'c']) // [[1, 'a'], [2, 'b'], [3, 'c']]
 * ```
 */
export function zip<T>(...arrays: T[][]): T[][] {
  const length = Math.min(...arrays.map(arr => arr.length))
  return Array.from({ length }, (_, i) => arrays.map(arr => arr[i]))
}
