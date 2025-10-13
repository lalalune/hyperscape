/**
 * Input Validation and Sanitization Utility
 * Provides comprehensive input validation and sanitization for client-side inputs
 */

import type { ValidationResult } from '@hyperscape/shared'

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  min?: number;
  max?: number;
  type?: 'string' | 'number' | 'email' | 'url' | 'boolean';
  customValidator?: (value: unknown) => string | null; // Returns error message or null
}

// Use shared ValidationResult for cross-system consistency
// Extended result for client input validation
export interface InputValidationResult extends ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue: unknown;
}

export class InputValidator {
  private static readonly DANGEROUS_PATTERNS = [
    // Script injection patterns
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /eval\s*\(/gi,
    /Function\s*\(/gi,
    
    // SQL injection patterns (basic)  
    /('|(\\')|(;\s*(drop|delete|insert|update|select|union)\s+))/gi,
    
    // Path traversal
    /\.\.\//gi,
    /\.\.\\\\/gi,
    
    // Command injection
    /[;&|`$(){}[\]]/g,
    
    // Common XSS vectors
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<link/gi,
    /<meta/gi,
    /<style/gi
  ];

  private static readonly HTML_ENTITIES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };

  /**
   * Validate and sanitize input based on rules
   * Note: This method uses defensive error handling because it processes UNTRUSTED USER INPUT.
   * This is a security boundary - errors from malicious input should be caught and converted to validation failures.
   */
  static validate(value: unknown, rules: ValidationRule = {}): InputValidationResult {
    try {
      const errors: string[] = [];
      let sanitizedValue = value;

      // Type validation and conversion
      const typeResult = this.validateType(value, rules.type);
      if (!typeResult.isValid) {
        errors.push(...typeResult.errors);
        return { isValid: false, passed: false, errors, sanitizedValue: value };
      }
      sanitizedValue = typeResult.sanitizedValue;

      // Required validation
      if (rules.required && this.isEmpty(sanitizedValue)) {
        errors.push('This field is required');
        return { isValid: false, passed: false, errors, sanitizedValue };
      }

      // Skip further validation if empty and not required
      if (this.isEmpty(sanitizedValue) && !rules.required) {
        return { isValid: true, passed: true, errors: [], sanitizedValue: '' };
      }

      // String-specific validations
      if (typeof sanitizedValue === 'string') {
        const stringResult = this.validateString(sanitizedValue, rules);
        errors.push(...stringResult.errors);
        sanitizedValue = stringResult.sanitizedValue;
      }

      // Number-specific validations
      if (typeof sanitizedValue === 'number') {
        const numberResult = this.validateNumber(sanitizedValue, rules);
        errors.push(...numberResult.errors);
        sanitizedValue = numberResult.sanitizedValue;
      }

      // Pattern validation
      if (rules.pattern && typeof sanitizedValue === 'string') {
        if (!rules.pattern.test(sanitizedValue)) {
          errors.push('Input format is invalid');
        }
      }

      // Custom validation - catch errors from user-provided validators
      if (rules.customValidator) {
        try {
          const customError = rules.customValidator(sanitizedValue);
          if (customError) {
            errors.push(customError);
          }
        } catch (error) {
          // Custom validator threw an error - treat as validation failure
          errors.push('Validation error occurred');
          console.error('[InputValidator] Custom validator error:', error);
        }
      }

      return {
        isValid: errors.length === 0,
        passed: errors.length === 0,
        errors,
        sanitizedValue
      };
    } catch (error) {
      // Catch any unexpected errors from malicious input
      console.error('[InputValidator] Validation error:', error);
      return {
        isValid: false,
        passed: false,
        errors: ['Invalid input'],
        sanitizedValue: value
      };
    }
  }

  /**
   * Sanitize HTML content to prevent XSS
   */
  static sanitizeHtml(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    // Remove dangerous patterns
    let sanitized = input;
    this.DANGEROUS_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    // Escape HTML entities
    sanitized = sanitized.replace(/[&<>"'`=]/g, (char) => {
      return this.HTML_ENTITIES[char] || char;
    });

    return sanitized.trim();
  }

  /**
   * Sanitize input for use in file names
   */
  static sanitizeFileName(input: string): string {
    if (typeof input !== 'string') {
      return 'untitled';
    }

    return input
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid chars with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
      .substring(0, 255) // Limit length
      || 'untitled'; // Fallback if empty
  }

  /**
   * Validate and sanitize URL input
   */
  static sanitizeUrl(input: string): InputValidationResult {
    if (typeof input !== 'string') {
      return { isValid: false, passed: false, errors: ['Invalid URL format'], sanitizedValue: '' };
    }

    const trimmed = input.trim();
    
    // Check for dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    const lowerInput = trimmed.toLowerCase();
    
    for (const protocol of dangerousProtocols) {
      if (lowerInput.startsWith(protocol)) {
        return { isValid: false, passed: false, errors: ['Unsafe URL protocol'], sanitizedValue: '' };
      }
    }

    // Allow only http, https, and relative URLs
    if (trimmed.startsWith('//') || 
        trimmed.startsWith('http://') || 
        trimmed.startsWith('https://') ||
        trimmed.startsWith('/') ||
        !trimmed.includes('://')) {
      
        try {
        // Additional URL validation
        if (trimmed.includes('://')) {
          new URL(trimmed); // This will throw if invalid
        }
          return { isValid: true, passed: true, errors: [], sanitizedValue: trimmed };
      } catch {
          return { isValid: false, passed: false, errors: ['Invalid URL format'], sanitizedValue: '' };
      }
    }

    return { isValid: false, passed: false, errors: ['Invalid URL protocol'], sanitizedValue: '' };
  }

  /**
   * Validate player name input
   */
  static validatePlayerName(name: string): InputValidationResult {
    return this.validate(name, {
      required: true,
      minLength: 2,
      maxLength: 16,
      pattern: /^[a-zA-Z0-9_-]+$/,
      customValidator: (value: unknown) => {
        // Check for reserved names
        const reserved = ['admin', 'system', 'null', 'undefined', 'bot'];
        if (typeof value === 'string' && reserved.includes(value.toLowerCase())) {
          return 'This name is reserved';
        }
        return null;
      }
    });
  }

  /**
   * Validate chat message input
   */
  static validateChatMessage(message: string): InputValidationResult {
    return this.validate(message, {
      required: true,
      maxLength: 500,
      customValidator: (value: unknown) => {
        if (typeof value !== 'string') return null;
        // Check for spam patterns
        const repeatedChar = /(.)\1{10,}/;
        if (repeatedChar.test(value)) {
          return 'Message contains too many repeated characters';
        }
        
        // Check for excessive caps
        const capsCount = (value.match(/[A-Z]/g) || []).length;
        if (capsCount > value.length * 0.7 && value.length > 10) {
          return 'Message contains too many capital letters';
        }
        
        return null;
      }
    });
  }

  private static validateType(value: unknown, type?: string): InputValidationResult {
    if (!type) {
      return { isValid: true, passed: true, errors: [], sanitizedValue: value };
    }

    switch (type) {
      case 'string':
        return { 
          isValid: true, 
          passed: true,
          errors: [], 
          sanitizedValue: String(value || '') 
        };
        
      case 'number': {
        const num = Number(value);
        if (isNaN(num)) {
          return { isValid: false, passed: false, errors: ['Must be a valid number'], sanitizedValue: value };
        }
        return { isValid: true, passed: true, errors: [], sanitizedValue: num };
      }
        
      case 'boolean':
        return { 
          isValid: true, 
          passed: true,
          errors: [], 
          sanitizedValue: Boolean(value) 
        };
        
      case 'email': {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const emailStr = String(value || '');
        if (!emailPattern.test(emailStr)) {
          return { isValid: false, passed: false, errors: ['Must be a valid email address'], sanitizedValue: value };
        }
        return { isValid: true, passed: true, errors: [], sanitizedValue: emailStr };
      }
        
      case 'url':
        return this.sanitizeUrl(String(value || ''));
        
      default:
        return { isValid: true, passed: true, errors: [], sanitizedValue: value };
    }
  }

  private static validateString(value: string, rules: ValidationRule): InputValidationResult {
    const errors: string[] = [];
    let sanitized = this.sanitizeHtml(value);

    if (rules.minLength && sanitized.length < rules.minLength) {
      errors.push(`Must be at least ${rules.minLength} characters long`);
    }

    if (rules.maxLength && sanitized.length > rules.maxLength) {
      sanitized = sanitized.substring(0, rules.maxLength);
      errors.push(`Must be no more than ${rules.maxLength} characters long`);
    }

    return { isValid: errors.length === 0, passed: errors.length === 0, errors, sanitizedValue: sanitized };
  }

  private static validateNumber(value: number, rules: ValidationRule): InputValidationResult {
    const errors: string[] = [];

    if (rules.min !== undefined && value < rules.min) {
      errors.push(`Must be at least ${rules.min}`);
    }

    if (rules.max !== undefined && value > rules.max) {
      errors.push(`Must be no more than ${rules.max}`);
    }

    // Clamp value to bounds
    let clampedValue = value;
    if (rules.min !== undefined) {
      clampedValue = Math.max(clampedValue, rules.min);
    }
    if (rules.max !== undefined) {
      clampedValue = Math.min(clampedValue, rules.max);
    }

    return { isValid: errors.length === 0, passed: errors.length === 0, errors, sanitizedValue: clampedValue };
  }

  private static isEmpty(value: unknown): boolean {
    return value === null || 
           value === undefined || 
           (typeof value === 'string' && value.trim() === '') ||
           (Array.isArray(value) && value.length === 0);
  }
}

// Convenience functions for common validations
export const validatePlayerName = (name: string) => InputValidator.validatePlayerName(name);
export const validateChatMessage = (message: string) => InputValidator.validateChatMessage(message);
export const sanitizeHtml = (input: string) => InputValidator.sanitizeHtml(input);
export const sanitizeFileName = (input: string) => InputValidator.sanitizeFileName(input);
export const sanitizeUrl = (input: string) => InputValidator.sanitizeUrl(input);