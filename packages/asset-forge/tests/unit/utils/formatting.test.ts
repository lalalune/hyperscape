/**
 * Formatting Utilities Tests
 * Comprehensive tests for date, number, string, and file size formatting
 */

import { describe, it, expect } from 'vitest'
import {
  formatDate,
  formatDateTime,
  formatTime,
  formatNumber,
  formatPercentage,
  formatFileSize,
  truncate,
  truncateMiddle,
  toTitleCase,
  camelToTitleCase,
  kebabToTitleCase,
  formatWalletAddress,
  formatDuration,
  pluralize,
  formatCount
} from '@/utils/formatting'

describe('formatting', () => {
  describe('formatDate', () => {
    it('should format Date objects', () => {
      const date = new Date('2025-10-24T12:00:00Z')
      const result = formatDate(date)
      expect(result).toContain('2025')
      expect(result).toContain('Oct')
    })

    it('should format ISO date strings', () => {
      const result = formatDate('2025-10-24')
      expect(result).toContain('2025')
      expect(result).toContain('Oct')
    })

    it('should format timestamps', () => {
      const timestamp = new Date('2025-10-24').getTime()
      const result = formatDate(timestamp)
      expect(result).toContain('2025')
      expect(result).toContain('Oct')
    })

    it('should accept custom format options', () => {
      const date = new Date('2025-10-24')
      const result = formatDate(date, { year: 'numeric', month: 'long', day: 'numeric' })
      expect(result).toContain('October')
    })
  })

  describe('formatDateTime', () => {
    it('should format date and time', () => {
      const date = new Date('2025-10-24T14:30:00')
      const result = formatDateTime(date)
      expect(result).toContain('2025')
      expect(result).toContain('Oct')
      expect(result).toMatch(/\d{1,2}:\d{2}/)
    })

    it('should handle string input', () => {
      const result = formatDateTime('2025-10-24T14:30:00')
      expect(result).toBeTruthy()
      expect(result).toContain('2025')
    })

    it('should handle timestamp input', () => {
      const timestamp = new Date('2025-10-24T14:30:00').getTime()
      const result = formatDateTime(timestamp)
      expect(result).toBeTruthy()
    })
  })

  describe('formatTime', () => {
    it('should format time from Date', () => {
      const date = new Date('2025-10-24T14:30:45')
      const result = formatTime(date)
      expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}/)
    })

    it('should handle string input', () => {
      const result = formatTime('2025-10-24T14:30:45')
      expect(result).toBeTruthy()
    })
  })

  describe('formatNumber', () => {
    it('should format integers with thousands separators', () => {
      expect(formatNumber(1234567)).toBe('1,234,567')
    })

    it('should format small numbers', () => {
      expect(formatNumber(123)).toBe('123')
    })

    it('should preserve decimal places when specified', () => {
      const result = formatNumber(1234.56, { minimumFractionDigits: 2 })
      expect(result).toContain('1,234')
      expect(result).toContain('56')
    })

    it('should handle zero', () => {
      expect(formatNumber(0)).toBe('0')
    })

    it('should handle negative numbers', () => {
      expect(formatNumber(-1234)).toBe('-1,234')
    })
  })

  describe('formatPercentage', () => {
    it('should format decimal as percentage', () => {
      expect(formatPercentage(0.75)).toBe('75%')
    })

    it('should format with decimal places', () => {
      expect(formatPercentage(0.7532, 2)).toBe('75.32%')
    })

    it('should handle percentage input when asDecimal is false', () => {
      expect(formatPercentage(75, 0, false)).toBe('75%')
    })

    it('should handle zero', () => {
      expect(formatPercentage(0)).toBe('0%')
    })

    it('should handle 100%', () => {
      expect(formatPercentage(1)).toBe('100%')
    })

    it('should handle values over 100%', () => {
      expect(formatPercentage(1.5)).toBe('150%')
    })
  })

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500.0 Bytes')
    })

    it('should format zero bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes')
    })

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB')
    })

    it('should format megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1.0 MB')
    })

    it('should format gigabytes', () => {
      expect(formatFileSize(1073741824)).toBe('1.0 GB')
    })

    it('should format terabytes', () => {
      expect(formatFileSize(1099511627776)).toBe('1.0 TB')
    })

    it('should respect decimal places', () => {
      expect(formatFileSize(1536, 2)).toBe('1.50 KB')
    })

    it('should handle partial units', () => {
      expect(formatFileSize(2560, 1)).toBe('2.5 KB')
    })
  })

  describe('truncate', () => {
    it('should truncate long strings', () => {
      expect(truncate('Hello World', 8)).toBe('Hello...')
    })

    it('should not truncate short strings', () => {
      expect(truncate('Short', 10)).toBe('Short')
    })

    it('should handle custom ellipsis', () => {
      expect(truncate('Hello World', 8, '…')).toBe('Hello W…')
    })

    it('should handle exact length match', () => {
      expect(truncate('Hello', 5)).toBe('Hello')
    })

    it('should handle empty string', () => {
      expect(truncate('', 5)).toBe('')
    })
  })

  describe('truncateMiddle', () => {
    it('should truncate in the middle', () => {
      expect(truncateMiddle('0x1234567890abcdef', 10)).toBe('0x12...def')
    })

    it('should not truncate short strings', () => {
      expect(truncateMiddle('Short', 10)).toBe('Short')
    })

    it('should handle custom ellipsis', () => {
      expect(truncateMiddle('verylongfilename.txt', 15, '…')).toContain('…')
    })

    it('should split evenly', () => {
      const result = truncateMiddle('abcdefghij', 7)
      expect(result).toBe('ab...ij')
    })
  })

  describe('toTitleCase', () => {
    it('should convert to title case', () => {
      expect(toTitleCase('hello world')).toBe('Hello World')
    })

    it('should handle uppercase input', () => {
      expect(toTitleCase('HELLO WORLD')).toBe('Hello World')
    })

    it('should handle mixed case', () => {
      expect(toTitleCase('hELLo WoRLd')).toBe('Hello World')
    })

    it('should handle single word', () => {
      expect(toTitleCase('hello')).toBe('Hello')
    })

    it('should handle empty string', () => {
      expect(toTitleCase('')).toBe('')
    })

    it('should handle multiple spaces', () => {
      expect(toTitleCase('hello  world')).toContain('Hello')
    })
  })

  describe('camelToTitleCase', () => {
    it('should convert camelCase to Title Case', () => {
      expect(camelToTitleCase('helloWorld')).toBe('Hello World')
    })

    it('should convert PascalCase to Title Case', () => {
      expect(camelToTitleCase('MyComponent')).toBe('My Component')
    })

    it('should handle single word', () => {
      expect(camelToTitleCase('hello')).toBe('Hello')
    })

    it('should handle empty string', () => {
      expect(camelToTitleCase('')).toBe('')
    })

    it('should handle multiple uppercase letters', () => {
      expect(camelToTitleCase('HTMLParser')).toContain('Parser')
    })
  })

  describe('kebabToTitleCase', () => {
    it('should convert kebab-case to Title Case', () => {
      expect(kebabToTitleCase('hello-world')).toBe('Hello World')
    })

    it('should handle multiple dashes', () => {
      expect(kebabToTitleCase('my-component-name')).toBe('My Component Name')
    })

    it('should handle single word', () => {
      expect(kebabToTitleCase('hello')).toBe('Hello')
    })

    it('should handle empty string', () => {
      expect(kebabToTitleCase('')).toBe('')
    })
  })

  describe('formatWalletAddress', () => {
    it('should format long addresses', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678'
      expect(formatWalletAddress(address)).toBe('0x1234...5678')
    })

    it('should handle custom start/end chars', () => {
      const address = '0x1234567890abcdef'
      expect(formatWalletAddress(address, 8, 6)).toBe('0x123456...abcdef')
    })

    it('should not truncate short addresses', () => {
      const address = '0x12345'
      expect(formatWalletAddress(address)).toBe('0x12345')
    })

    it('should handle empty address', () => {
      expect(formatWalletAddress('')).toBe('')
    })
  })

  describe('formatDuration', () => {
    it('should format seconds', () => {
      expect(formatDuration(1000)).toBe('1s')
    })

    it('should format minutes and seconds', () => {
      expect(formatDuration(65000)).toBe('1m 5s')
    })

    it('should format hours, minutes, and seconds', () => {
      expect(formatDuration(3661000)).toBe('1h 1m 1s')
    })

    it('should format days', () => {
      expect(formatDuration(86400000 + 3600000)).toBe('1d 1h')
    })

    it('should handle zero', () => {
      expect(formatDuration(0)).toBe('0s')
    })

    it('should only show non-zero parts', () => {
      expect(formatDuration(3600000)).toBe('1h')
    })

    it('should handle milliseconds only', () => {
      expect(formatDuration(500)).toBe('0s')
    })
  })

  describe('pluralize', () => {
    it('should return singular for count of 1', () => {
      expect(pluralize(1, 'item')).toBe('item')
    })

    it('should return plural for count > 1', () => {
      expect(pluralize(5, 'item')).toBe('items')
    })

    it('should return plural for count of 0', () => {
      expect(pluralize(0, 'item')).toBe('items')
    })

    it('should use custom plural form', () => {
      expect(pluralize(2, 'person', 'people')).toBe('people')
    })

    it('should handle irregular plurals', () => {
      expect(pluralize(3, 'child', 'children')).toBe('children')
    })
  })

  describe('formatCount', () => {
    it('should format count with singular label', () => {
      expect(formatCount(1, 'item')).toBe('1 item')
    })

    it('should format count with plural label', () => {
      expect(formatCount(5, 'item')).toBe('5 items')
    })

    it('should use custom plural form', () => {
      expect(formatCount(2, 'person', 'people')).toBe('2 people')
    })

    it('should format large numbers', () => {
      expect(formatCount(1234, 'item')).toBe('1,234 items')
    })

    it('should handle zero', () => {
      expect(formatCount(0, 'item')).toBe('0 items')
    })
  })
})
