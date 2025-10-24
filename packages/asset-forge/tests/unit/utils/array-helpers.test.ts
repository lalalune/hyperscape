/**
 * Array Helpers Tests
 * Comprehensive tests for array operations, grouping, filtering, and transformation
 */

import { describe, it, expect } from 'vitest'
import {
  groupBy,
  groupByFn,
  partition,
  deduplicate,
  deduplicateBy,
  deduplicateByFn,
  chunk,
  sortBy,
  findFirst,
  findLast,
  countWhere,
  isEmpty,
  isNonEmpty,
  randomItem,
  randomItems,
  shuffle,
  take,
  takeLast,
  getNestedValue,
  flatten,
  flattenDeep,
  compact,
  range,
  zip
} from '@/utils/array-helpers'

describe('array-helpers', () => {
  describe('groupBy', () => {
    it('should group items by key', () => {
      const items = [
        { type: 'weapon', name: 'Sword' },
        { type: 'armor', name: 'Helmet' },
        { type: 'weapon', name: 'Axe' }
      ]
      const result = groupBy(items, 'type')
      expect(result.weapon).toHaveLength(2)
      expect(result.armor).toHaveLength(1)
    })

    it('should handle empty arrays', () => {
      const result = groupBy([], 'type')
      expect(result).toEqual({})
    })

    it('should handle nested keys', () => {
      const items = [
        { metadata: { type: 'weapon' }, name: 'Sword' },
        { metadata: { type: 'armor' }, name: 'Helmet' }
      ]
      const result = groupBy(items, 'metadata.type')
      expect(result.weapon).toHaveLength(1)
      expect(result.armor).toHaveLength(1)
    })
  })

  describe('groupByFn', () => {
    it('should group items by function', () => {
      const items = [
        { name: 'Apple', price: 1.99 },
        { name: 'Banana', price: 0.99 },
        { name: 'Cherry', price: 2.99 }
      ]
      const result = groupByFn(items, item => item.price < 2 ? 'cheap' : 'expensive')
      expect(result.cheap).toHaveLength(2)
      expect(result.expensive).toHaveLength(1)
    })

    it('should handle numeric keys', () => {
      const items = [1, 2, 3, 4, 5]
      const result = groupByFn(items, item => item % 2)
      expect(result['0']).toHaveLength(2) // even
      expect(result['1']).toHaveLength(3) // odd
    })
  })

  describe('partition', () => {
    it('should partition array by predicate', () => {
      const numbers = [1, 2, 3, 4, 5, 6]
      const [evens, odds] = partition(numbers, n => n % 2 === 0)
      expect(evens).toEqual([2, 4, 6])
      expect(odds).toEqual([1, 3, 5])
    })

    it('should handle empty arrays', () => {
      const [matching, nonMatching] = partition([], () => true)
      expect(matching).toEqual([])
      expect(nonMatching).toEqual([])
    })

    it('should handle all matching', () => {
      const [matching, nonMatching] = partition([1, 2, 3], () => true)
      expect(matching).toEqual([1, 2, 3])
      expect(nonMatching).toEqual([])
    })

    it('should handle none matching', () => {
      const [matching, nonMatching] = partition([1, 2, 3], () => false)
      expect(matching).toEqual([])
      expect(nonMatching).toEqual([1, 2, 3])
    })
  })

  describe('deduplicate', () => {
    it('should remove duplicate numbers', () => {
      expect(deduplicate([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3])
    })

    it('should remove duplicate strings', () => {
      expect(deduplicate(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c'])
    })

    it('should handle empty arrays', () => {
      expect(deduplicate([])).toEqual([])
    })

    it('should handle arrays with no duplicates', () => {
      expect(deduplicate([1, 2, 3])).toEqual([1, 2, 3])
    })
  })

  describe('deduplicateBy', () => {
    it('should remove duplicates by key', () => {
      const items = [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 1, name: 'C' }
      ]
      const result = deduplicateBy(items, 'id')
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('A')
      expect(result[1].name).toBe('B')
    })

    it('should handle nested keys', () => {
      const items = [
        { metadata: { id: 1 }, name: 'A' },
        { metadata: { id: 2 }, name: 'B' },
        { metadata: { id: 1 }, name: 'C' }
      ]
      const result = deduplicateBy(items, 'metadata.id')
      expect(result).toHaveLength(2)
    })
  })

  describe('deduplicateByFn', () => {
    it('should remove duplicates by function', () => {
      const items = [
        { id: 1, name: 'Apple' },
        { id: 2, name: 'Banana' },
        { id: 3, name: 'Apple' }
      ]
      const result = deduplicateByFn(items, item => item.name.toLowerCase())
      expect(result).toHaveLength(2)
      expect(result.map(i => i.name)).toContain('Apple')
      expect(result.map(i => i.name)).toContain('Banana')
    })
  })

  describe('chunk', () => {
    it('should chunk array into specified size', () => {
      const result = chunk([1, 2, 3, 4, 5], 2)
      expect(result).toEqual([[1, 2], [3, 4], [5]])
    })

    it('should handle exact divisions', () => {
      const result = chunk([1, 2, 3, 4], 2)
      expect(result).toEqual([[1, 2], [3, 4]])
    })

    it('should handle size of 1', () => {
      const result = chunk(['a', 'b', 'c'], 1)
      expect(result).toEqual([['a'], ['b'], ['c']])
    })

    it('should handle empty arrays', () => {
      expect(chunk([], 2)).toEqual([])
    })
  })

  describe('sortBy', () => {
    it('should sort by key ascending', () => {
      const items = [
        { name: 'Charlie', age: 30 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 35 }
      ]
      const result = sortBy(items, 'age')
      expect(result[0].name).toBe('Alice')
      expect(result[2].name).toBe('Bob')
    })

    it('should sort by key descending', () => {
      const items = [
        { name: 'Charlie', age: 30 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 35 }
      ]
      const result = sortBy(items, 'age', 'desc')
      expect(result[0].name).toBe('Bob')
      expect(result[2].name).toBe('Alice')
    })

    it('should not mutate original array', () => {
      const items = [{ val: 3 }, { val: 1 }, { val: 2 }]
      const original = [...items]
      sortBy(items, 'val')
      expect(items).toEqual(original)
    })

    it('should sort strings', () => {
      const items = [{ name: 'Charlie' }, { name: 'Alice' }, { name: 'Bob' }]
      const result = sortBy(items, 'name')
      expect(result[0].name).toBe('Alice')
    })

    it('should handle nested keys', () => {
      const items = [
        { user: { age: 30 } },
        { user: { age: 25 } },
        { user: { age: 35 } }
      ]
      const result = sortBy(items, 'user.age')
      expect(result[0].user.age).toBe(25)
    })
  })

  describe('findFirst', () => {
    it('should find first matching item', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const result = findFirst(items, item => item.id > 1)
      expect(result).toEqual({ id: 2 })
    })

    it('should return undefined if not found', () => {
      const items = [{ id: 1 }, { id: 2 }]
      const result = findFirst(items, item => item.id > 5)
      expect(result).toBeUndefined()
    })
  })

  describe('findLast', () => {
    it('should find last matching item', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const result = findLast(items, item => item.id > 1)
      expect(result).toEqual({ id: 3 })
    })

    it('should return undefined if not found', () => {
      const items = [{ id: 1 }, { id: 2 }]
      const result = findLast(items, item => item.id > 5)
      expect(result).toBeUndefined()
    })
  })

  describe('countWhere', () => {
    it('should count matching items', () => {
      const items = [1, 2, 3, 4, 5]
      const result = countWhere(items, n => n > 2)
      expect(result).toBe(3)
    })

    it('should return 0 for no matches', () => {
      const items = [1, 2, 3]
      const result = countWhere(items, n => n > 10)
      expect(result).toBe(0)
    })
  })

  describe('isEmpty', () => {
    it('should return true for empty array', () => {
      expect(isEmpty([])).toBe(true)
    })

    it('should return true for null', () => {
      expect(isEmpty(null)).toBe(true)
    })

    it('should return true for undefined', () => {
      expect(isEmpty(undefined)).toBe(true)
    })

    it('should return false for non-empty array', () => {
      expect(isEmpty([1, 2])).toBe(false)
    })
  })

  describe('isNonEmpty', () => {
    it('should return true for non-empty array', () => {
      expect(isNonEmpty([1, 2])).toBe(true)
    })

    it('should return false for empty array', () => {
      expect(isNonEmpty([])).toBe(false)
    })

    it('should return false for null', () => {
      expect(isNonEmpty(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isNonEmpty(undefined)).toBe(false)
    })
  })

  describe('randomItem', () => {
    it('should return random item from array', () => {
      const items = ['a', 'b', 'c']
      const result = randomItem(items)
      expect(items).toContain(result)
    })

    it('should return undefined for empty array', () => {
      expect(randomItem([])).toBeUndefined()
    })

    it('should return only item for single item array', () => {
      expect(randomItem(['only'])).toBe('only')
    })
  })

  describe('randomItems', () => {
    it('should return specified number of items', () => {
      const items = ['a', 'b', 'c', 'd']
      const result = randomItems(items, 2)
      expect(result).toHaveLength(2)
      result.forEach(item => expect(items).toContain(item))
    })

    it('should return empty array for empty input', () => {
      expect(randomItems([], 5)).toEqual([])
    })

    it('should allow duplicates', () => {
      const items = ['a']
      const result = randomItems(items, 3)
      expect(result).toEqual(['a', 'a', 'a'])
    })
  })

  describe('shuffle', () => {
    it('should return same length array', () => {
      const items = [1, 2, 3, 4, 5]
      const result = shuffle(items)
      expect(result).toHaveLength(5)
    })

    it('should contain all original items', () => {
      const items = [1, 2, 3, 4, 5]
      const result = shuffle(items)
      items.forEach(item => expect(result).toContain(item))
    })

    it('should not mutate original array', () => {
      const items = [1, 2, 3, 4, 5]
      const original = [...items]
      shuffle(items)
      expect(items).toEqual(original)
    })

    it('should handle empty array', () => {
      expect(shuffle([])).toEqual([])
    })
  })

  describe('take', () => {
    it('should take first N items', () => {
      expect(take([1, 2, 3, 4, 5], 3)).toEqual([1, 2, 3])
    })

    it('should handle count larger than array', () => {
      expect(take([1, 2], 5)).toEqual([1, 2])
    })

    it('should handle zero count', () => {
      expect(take([1, 2, 3], 0)).toEqual([])
    })
  })

  describe('takeLast', () => {
    it('should take last N items', () => {
      expect(takeLast([1, 2, 3, 4, 5], 3)).toEqual([3, 4, 5])
    })

    it('should handle count larger than array', () => {
      expect(takeLast([1, 2], 5)).toEqual([1, 2])
    })

    it('should handle zero count', () => {
      expect(takeLast([1, 2, 3], 0)).toEqual([])
    })
  })

  describe('getNestedValue', () => {
    it('should get nested value from path', () => {
      const obj = { user: { name: 'John', age: 30 } }
      expect(getNestedValue(obj, 'user.name')).toBe('John')
    })

    it('should return undefined for missing path', () => {
      const obj = { user: { name: 'John' } }
      expect(getNestedValue(obj, 'user.email')).toBeUndefined()
    })

    it('should handle top-level keys', () => {
      const obj = { name: 'John' }
      expect(getNestedValue(obj, 'name')).toBe('John')
    })

    it('should handle deep nesting', () => {
      const obj = { a: { b: { c: { d: 'value' } } } }
      expect(getNestedValue(obj, 'a.b.c.d')).toBe('value')
    })
  })

  describe('flatten', () => {
    it('should flatten nested arrays one level', () => {
      expect(flatten([[1, 2], [3, 4], [5]])).toEqual([1, 2, 3, 4, 5])
    })

    it('should handle empty arrays', () => {
      expect(flatten([])).toEqual([])
    })

    it('should not flatten deeply nested arrays', () => {
      const result = flatten([[1, [2, 3]], [4]])
      expect(result).toHaveLength(3)
      expect(Array.isArray(result[1])).toBe(true)
    })
  })

  describe('flattenDeep', () => {
    it('should flatten deeply nested arrays', () => {
      expect(flattenDeep([[1, [2, [3]]], [4, 5]])).toEqual([1, 2, 3, 4, 5])
    })

    it('should handle empty arrays', () => {
      expect(flattenDeep([])).toEqual([])
    })

    it('should handle mixed nesting levels', () => {
      expect(flattenDeep([1, [2, [3, [4]]]])).toEqual([1, 2, 3, 4])
    })
  })

  describe('compact', () => {
    it('should remove falsy values', () => {
      expect(compact([1, 0, null, 2, '', 3, undefined, false])).toEqual([1, 2, 3])
    })

    it('should keep truthy values', () => {
      expect(compact([1, 'hello', true, {}, []])).toHaveLength(5)
    })

    it('should handle empty array', () => {
      expect(compact([])).toEqual([])
    })

    it('should handle all falsy', () => {
      expect(compact([null, undefined, false, 0, ''])).toEqual([])
    })
  })

  describe('range', () => {
    it('should create range of numbers', () => {
      expect(range(0, 5)).toEqual([0, 1, 2, 3, 4])
    })

    it('should handle custom step', () => {
      expect(range(1, 10, 2)).toEqual([1, 3, 5, 7, 9])
    })

    it('should handle step of 1', () => {
      expect(range(5, 8)).toEqual([5, 6, 7])
    })

    it('should return empty for start === end', () => {
      expect(range(5, 5)).toEqual([])
    })

    it('should handle negative ranges', () => {
      expect(range(-3, 2)).toEqual([-3, -2, -1, 0, 1])
    })
  })

  describe('zip', () => {
    it('should zip two arrays', () => {
      expect(zip([1, 2, 3], ['a', 'b', 'c'])).toEqual([[1, 'a'], [2, 'b'], [3, 'c']])
    })

    it('should handle arrays of different lengths', () => {
      expect(zip([1, 2], ['a', 'b', 'c'])).toEqual([[1, 'a'], [2, 'b']])
    })

    it('should handle multiple arrays', () => {
      const result = zip([1, 2], ['a', 'b'], [true, false])
      expect(result).toEqual([[1, 'a', true], [2, 'b', false]])
    })

    it('should handle empty arrays', () => {
      expect(zip([], [])).toEqual([])
    })
  })
})
