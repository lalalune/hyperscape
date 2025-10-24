/**
 * Validation Helpers Tests
 * Comprehensive tests for validation, type guards, and safe access utilities
 */

import { describe, it, expect, vi } from 'vitest'
import {
  assertDefined,
  isDefined,
  isNonEmpty,
  isNonEmptyString,
  safeArrayAccess,
  safeFirst,
  safeLast,
  safeGet,
  ensureArray,
  ensureString,
  ensureNumber,
  hasRequiredProps,
  safeJsonParse,
  validateArray,
  filterDefined,
  safeExecute,
  safeExecuteAsync,
  isObject,
  hasKeys,
  isEmptyObject,
  isValidFileType,
  isValidFileSize,
  isValidUrl,
  isValidEmail,
  containsIgnoreCase,
  startsWithIgnoreCase,
  endsWithIgnoreCase,
  isInRange,
  isPositive,
  isNonNegative
} from '@/utils/validation-helpers'

describe('validation-helpers', () => {
  describe('assertDefined', () => {
    it('should not throw for defined values', () => {
      expect(() => assertDefined(0)).not.toThrow()
      expect(() => assertDefined('')).not.toThrow()
      expect(() => assertDefined(false)).not.toThrow()
      expect(() => assertDefined({})).not.toThrow()
    })

    it('should throw for null', () => {
      expect(() => assertDefined(null)).toThrow()
    })

    it('should throw for undefined', () => {
      expect(() => assertDefined(undefined)).toThrow()
    })

    it('should throw with custom message', () => {
      expect(() => assertDefined(null, 'Custom error')).toThrow('Custom error')
    })
  })

  describe('isDefined', () => {
    it('should return true for defined values', () => {
      expect(isDefined(0)).toBe(true)
      expect(isDefined('')).toBe(true)
      expect(isDefined(false)).toBe(true)
      expect(isDefined({})).toBe(true)
    })

    it('should return false for null', () => {
      expect(isDefined(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isDefined(undefined)).toBe(false)
    })
  })

  describe('isNonEmpty', () => {
    it('should return true for non-empty arrays', () => {
      expect(isNonEmpty([1, 2, 3])).toBe(true)
      expect(isNonEmpty(['a'])).toBe(true)
    })

    it('should return false for empty arrays', () => {
      expect(isNonEmpty([])).toBe(false)
    })

    it('should return false for null and undefined', () => {
      expect(isNonEmpty(null)).toBe(false)
      expect(isNonEmpty(undefined)).toBe(false)
    })
  })

  describe('isNonEmptyString', () => {
    it('should return true for non-empty strings', () => {
      expect(isNonEmptyString('hello')).toBe(true)
      expect(isNonEmptyString('  text  ')).toBe(true)
    })

    it('should return false for empty strings', () => {
      expect(isNonEmptyString('')).toBe(false)
    })

    it('should return false for whitespace-only strings', () => {
      expect(isNonEmptyString('   ')).toBe(false)
    })

    it('should return false for null and undefined', () => {
      expect(isNonEmptyString(null)).toBe(false)
      expect(isNonEmptyString(undefined)).toBe(false)
    })
  })

  describe('safeArrayAccess', () => {
    it('should return element at valid index', () => {
      expect(safeArrayAccess([1, 2, 3], 0)).toBe(1)
      expect(safeArrayAccess([1, 2, 3], 2)).toBe(3)
    })

    it('should return undefined for out-of-bounds index', () => {
      expect(safeArrayAccess([1, 2, 3], -1)).toBeUndefined()
      expect(safeArrayAccess([1, 2, 3], 10)).toBeUndefined()
    })

    it('should return undefined for null array', () => {
      expect(safeArrayAccess(null, 0)).toBeUndefined()
    })

    it('should return undefined for undefined array', () => {
      expect(safeArrayAccess(undefined, 0)).toBeUndefined()
    })
  })

  describe('safeFirst', () => {
    it('should return first element', () => {
      expect(safeFirst([1, 2, 3])).toBe(1)
    })

    it('should return undefined for empty array', () => {
      expect(safeFirst([])).toBeUndefined()
    })

    it('should return undefined for null', () => {
      expect(safeFirst(null)).toBeUndefined()
    })
  })

  describe('safeLast', () => {
    it('should return last element', () => {
      expect(safeLast([1, 2, 3])).toBe(3)
    })

    it('should return undefined for empty array', () => {
      expect(safeLast([])).toBeUndefined()
    })

    it('should return undefined for null', () => {
      expect(safeLast(null)).toBeUndefined()
    })
  })

  describe('safeGet', () => {
    it('should get property from object', () => {
      const obj = { name: 'John', age: 30 }
      expect(safeGet(obj, 'name')).toBe('John')
    })

    it('should return undefined for missing property', () => {
      const obj = { name: 'John' }
      expect(safeGet(obj, 'age' as keyof typeof obj)).toBeUndefined()
    })

    it('should return undefined for null object', () => {
      expect(safeGet(null, 'name' as never)).toBeUndefined()
    })

    it('should return undefined for undefined object', () => {
      expect(safeGet(undefined, 'name' as never)).toBeUndefined()
    })
  })

  describe('ensureArray', () => {
    it('should return array as-is', () => {
      expect(ensureArray([1, 2, 3])).toEqual([1, 2, 3])
    })

    it('should return empty array for null', () => {
      expect(ensureArray(null)).toEqual([])
    })

    it('should return empty array for undefined', () => {
      expect(ensureArray(undefined)).toEqual([])
    })
  })

  describe('ensureString', () => {
    it('should return string as-is', () => {
      expect(ensureString('hello')).toBe('hello')
    })

    it('should return empty string for null', () => {
      expect(ensureString(null)).toBe('')
    })

    it('should return empty string for undefined', () => {
      expect(ensureString(undefined)).toBe('')
    })
  })

  describe('ensureNumber', () => {
    it('should return number as-is', () => {
      expect(ensureNumber(42)).toBe(42)
    })

    it('should return default for null', () => {
      expect(ensureNumber(null)).toBe(0)
    })

    it('should return default for undefined', () => {
      expect(ensureNumber(undefined)).toBe(0)
    })

    it('should use custom default', () => {
      expect(ensureNumber(null, 99)).toBe(99)
    })
  })

  describe('hasRequiredProps', () => {
    it('should return true when all props exist', () => {
      const obj = { id: 1, name: 'John' }
      expect(hasRequiredProps(obj, ['id', 'name'])).toBe(true)
    })

    it('should return false when prop is missing', () => {
      const obj = { id: 1 }
      expect(hasRequiredProps(obj, ['id', 'name'])).toBe(false)
    })

    it('should return false when prop is null', () => {
      const obj = { id: 1, name: null }
      expect(hasRequiredProps(obj, ['id', 'name'])).toBe(false)
    })

    it('should return false for null object', () => {
      expect(hasRequiredProps(null, ['id'])).toBe(false)
    })
  })

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = safeJsonParse<{ name: string }>('{"name":"John"}')
      expect(result).toEqual({ name: 'John' })
    })

    it('should return undefined for invalid JSON', () => {
      expect(safeJsonParse('invalid json')).toBeUndefined()
    })

    it('should return undefined for null', () => {
      expect(safeJsonParse(null)).toBeUndefined()
    })

    it('should return undefined for undefined', () => {
      expect(safeJsonParse(undefined)).toBeUndefined()
    })
  })

  describe('validateArray', () => {
    it('should return true for valid array', () => {
      expect(validateArray([1, 2, 3], 'numbers')).toBe(true)
    })

    it('should return false for empty array', () => {
      expect(validateArray([], 'items')).toBe(false)
    })

    it('should return false for null', () => {
      expect(validateArray(null, 'items')).toBe(false)
    })

    it('should return false if array contains null', () => {
      expect(validateArray([1, null, 3], 'numbers')).toBe(false)
    })

    it('should return false if array contains undefined', () => {
      expect(validateArray([1, undefined, 3], 'numbers')).toBe(false)
    })
  })

  describe('filterDefined', () => {
    it('should filter out null and undefined', () => {
      expect(filterDefined([1, null, 2, undefined, 3])).toEqual([1, 2, 3])
    })

    it('should keep falsy values like 0 and empty string', () => {
      expect(filterDefined([0, '', false])).toEqual([0, '', false])
    })

    it('should handle empty array', () => {
      expect(filterDefined([])).toEqual([])
    })

    it('should handle all null/undefined', () => {
      expect(filterDefined([null, undefined, null])).toEqual([])
    })
  })

  describe('safeExecute', () => {
    it('should execute function and return result', () => {
      const result = safeExecute(() => 42)
      expect(result).toBe(42)
    })

    it('should return undefined on error', () => {
      const result = safeExecute(() => {
        throw new Error('Test error')
      })
      expect(result).toBeUndefined()
    })

    it('should handle complex functions', () => {
      const result = safeExecute(() => {
        const a = 10
        const b = 20
        return a + b
      })
      expect(result).toBe(30)
    })
  })

  describe('safeExecuteAsync', () => {
    it('should execute async function and return result', async () => {
      const result = await safeExecuteAsync(async () => 42)
      expect(result).toBe(42)
    })

    it('should return undefined on error', async () => {
      const result = await safeExecuteAsync(async () => {
        throw new Error('Test error')
      })
      expect(result).toBeUndefined()
    })

    it('should handle async operations', async () => {
      const result = await safeExecuteAsync(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'success'
      })
      expect(result).toBe('success')
    })
  })

  describe('isObject', () => {
    it('should return true for objects', () => {
      expect(isObject({})).toBe(true)
      expect(isObject({ name: 'John' })).toBe(true)
    })

    it('should return false for arrays', () => {
      expect(isObject([])).toBe(false)
    })

    it('should return false for null', () => {
      expect(isObject(null)).toBe(false)
    })

    it('should return false for primitives', () => {
      expect(isObject(42)).toBe(false)
      expect(isObject('string')).toBe(false)
      expect(isObject(true)).toBe(false)
    })
  })

  describe('hasKeys', () => {
    it('should return true for objects with keys', () => {
      expect(hasKeys({ name: 'John' })).toBe(true)
    })

    it('should return false for empty objects', () => {
      expect(hasKeys({})).toBe(false)
    })

    it('should return false for null', () => {
      expect(hasKeys(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(hasKeys(undefined)).toBe(false)
    })
  })

  describe('isEmptyObject', () => {
    it('should return true for empty objects', () => {
      expect(isEmptyObject({})).toBe(true)
    })

    it('should return false for objects with keys', () => {
      expect(isEmptyObject({ name: 'John' })).toBe(false)
    })

    it('should return true for null', () => {
      expect(isEmptyObject(null)).toBe(true)
    })

    it('should return true for undefined', () => {
      expect(isEmptyObject(undefined)).toBe(true)
    })
  })

  describe('isValidFileType', () => {
    const createMockFile = (name: string, type: string): File => {
      return {
        name,
        type,
        size: 0,
        lastModified: 0
      } as File
    }

    it('should validate MIME types', () => {
      const file = createMockFile('image.png', 'image/png')
      expect(isValidFileType(file, ['image/png', 'image/jpeg'])).toBe(true)
    })

    it('should validate extensions', () => {
      const file = createMockFile('model.glb', 'model/gltf-binary')
      expect(isValidFileType(file, ['.glb', '.gltf'])).toBe(true)
    })

    it('should reject invalid types', () => {
      const file = createMockFile('video.mp4', 'video/mp4')
      expect(isValidFileType(file, ['image/png'])).toBe(false)
    })

    it('should be case-insensitive for extensions', () => {
      const file = createMockFile('MODEL.GLB', 'model/gltf-binary')
      expect(isValidFileType(file, ['.glb'])).toBe(true)
    })
  })

  describe('isValidFileSize', () => {
    const createMockFile = (size: number): File => {
      return {
        name: 'test.txt',
        type: 'text/plain',
        size,
        lastModified: 0
      } as File
    }

    it('should validate file within size limit', () => {
      const file = createMockFile(1024)
      expect(isValidFileSize(file, 2048)).toBe(true)
    })

    it('should reject file exceeding size limit', () => {
      const file = createMockFile(3000)
      expect(isValidFileSize(file, 2048)).toBe(false)
    })

    it('should accept file at exact size limit', () => {
      const file = createMockFile(2048)
      expect(isValidFileSize(file, 2048)).toBe(true)
    })
  })

  describe('isValidUrl', () => {
    it('should validate absolute URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true)
      expect(isValidUrl('http://example.com/path')).toBe(true)
    })

    it('should validate relative URLs', () => {
      expect(isValidUrl('/path/to/resource')).toBe(true)
      expect(isValidUrl('./relative/path')).toBe(true)
      expect(isValidUrl('../parent/path')).toBe(true)
    })

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not a url')).toBe(false)
    })

    it('should reject empty strings', () => {
      expect(isValidUrl('')).toBe(false)
    })
  })

  describe('isValidEmail', () => {
    it('should validate correct email formats', () => {
      expect(isValidEmail('user@example.com')).toBe(true)
      expect(isValidEmail('test.user@example.co.uk')).toBe(true)
    })

    it('should reject invalid email formats', () => {
      expect(isValidEmail('invalid')).toBe(false)
      expect(isValidEmail('@example.com')).toBe(false)
      expect(isValidEmail('user@')).toBe(false)
    })

    it('should reject empty strings', () => {
      expect(isValidEmail('')).toBe(false)
    })

    it('should reject null and undefined', () => {
      expect(isValidEmail(null as unknown as string)).toBe(false)
      expect(isValidEmail(undefined as unknown as string)).toBe(false)
    })
  })

  describe('containsIgnoreCase', () => {
    it('should find pattern case-insensitively', () => {
      expect(containsIgnoreCase('Hello World', 'world')).toBe(true)
      expect(containsIgnoreCase('Hello World', 'WORLD')).toBe(true)
    })

    it('should return false when pattern not found', () => {
      expect(containsIgnoreCase('Hello World', 'xyz')).toBe(false)
    })

    it('should handle empty strings', () => {
      expect(containsIgnoreCase('', 'test')).toBe(false)
      expect(containsIgnoreCase('test', '')).toBe(false)
    })
  })

  describe('startsWithIgnoreCase', () => {
    it('should check start pattern case-insensitively', () => {
      expect(startsWithIgnoreCase('Hello World', 'hello')).toBe(true)
      expect(startsWithIgnoreCase('Hello World', 'HELLO')).toBe(true)
    })

    it('should return false when pattern not at start', () => {
      expect(startsWithIgnoreCase('Hello World', 'world')).toBe(false)
    })

    it('should handle empty strings', () => {
      expect(startsWithIgnoreCase('', 'test')).toBe(false)
    })
  })

  describe('endsWithIgnoreCase', () => {
    it('should check end pattern case-insensitively', () => {
      expect(endsWithIgnoreCase('Hello World', 'world')).toBe(true)
      expect(endsWithIgnoreCase('Hello World', 'WORLD')).toBe(true)
    })

    it('should return false when pattern not at end', () => {
      expect(endsWithIgnoreCase('Hello World', 'hello')).toBe(false)
    })

    it('should handle empty strings', () => {
      expect(endsWithIgnoreCase('', 'test')).toBe(false)
    })
  })

  describe('isInRange', () => {
    it('should return true for values in range', () => {
      expect(isInRange(5, 1, 10)).toBe(true)
      expect(isInRange(1, 1, 10)).toBe(true)
      expect(isInRange(10, 1, 10)).toBe(true)
    })

    it('should return false for values out of range', () => {
      expect(isInRange(0, 1, 10)).toBe(false)
      expect(isInRange(11, 1, 10)).toBe(false)
    })

    it('should handle negative ranges', () => {
      expect(isInRange(-5, -10, 0)).toBe(true)
    })
  })

  describe('isPositive', () => {
    it('should return true for positive numbers', () => {
      expect(isPositive(1)).toBe(true)
      expect(isPositive(0.1)).toBe(true)
    })

    it('should return false for zero', () => {
      expect(isPositive(0)).toBe(false)
    })

    it('should return false for negative numbers', () => {
      expect(isPositive(-1)).toBe(false)
    })
  })

  describe('isNonNegative', () => {
    it('should return true for positive numbers', () => {
      expect(isNonNegative(1)).toBe(true)
    })

    it('should return true for zero', () => {
      expect(isNonNegative(0)).toBe(true)
    })

    it('should return false for negative numbers', () => {
      expect(isNonNegative(-1)).toBe(false)
    })
  })
})
