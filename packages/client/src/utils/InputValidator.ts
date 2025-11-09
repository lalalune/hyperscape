/**
 * Input Validation and Sanitization Utility
 * Provides comprehensive input validation and sanitization for client-side inputs
 */

interface ValidationResult {
  isValid?: boolean;
  passed: boolean;
  errors?: string[];
}

/**
 * Validation rule configuration
 *
 * Defines constraints for validating user input. All fields are optional
 * allowing for flexible validation scenarios.
 *
 * @public
 */
export interface ValidationRule {
  /** Whether the field is required (cannot be empty) */
  required?: boolean;

  /** Minimum length for string values */
  minLength?: number;

  /** Maximum length for string values */
  maxLength?: number;

  /** Regular expression pattern that value must match */
  pattern?: RegExp;

  /** Minimum value for numbers */
  min?: number;

  /** Maximum value for numbers */
  max?: number;

  /** Expected type for automatic type coercion */
  type?: "string" | "number" | "email" | "url" | "boolean";

  /** Custom validation function that returns error message or null */
  customValidator?: (value: unknown) => string | null;
}

/**
 * Extended validation result with sanitized value
 *
 * Extends the shared ValidationResult with additional fields specific
 * to client-side input validation.
 *
 * @public
 */
export interface InputValidationResult extends ValidationResult {
  /** Whether validation passed (no errors) */
  isValid: boolean;

  /** Array of validation error messages */
  errors: string[];

  /** Sanitized/coerced value safe for use */
  sanitizedValue: unknown;
}

/**
 * InputValidator - Comprehensive input validation and sanitization
 *
 * Provides security-focused validation for all user inputs including:
 * - XSS prevention (HTML/script injection)
 * - SQL injection protection
 * - Path traversal prevention
 * - URL validation
 * - Type coercion and sanitization
 *
 * @remarks
 * This is a SECURITY BOUNDARY - it handles untrusted user input.
 * Defensive error handling is intentional to prevent security bypasses.
 *
 * @public
 */
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
    /<style/gi,
  ];

  private static readonly HTML_ENTITIES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
    "`": "&#x60;",
    "=": "&#x3D;",
  };

  /**
   * Validates and sanitizes input based on provided rules
   *
   * This is the main entry point for input validation. It applies all specified rules,
   * sanitizes the input to remove dangerous patterns, and returns a result with errors.
   *
   * @remarks
   * Uses defensive error handling because it processes UNTRUSTED USER INPUT.
   * This is a security boundary - errors from malicious input are caught and
   * converted to validation failures rather than thrown.
   *
   * @param value - The user input to validate (any type)
   * @param rules - Validation rules to apply
   * @returns Validation result with sanitized value and any errors
   *
   * @example
   * ```typescript
   * const result = InputValidator.validate(userInput, {
   *   required: true,
   *   minLength: 3,
   *   maxLength: 20,
   *   pattern: /^[a-zA-Z0-9]+$/
   * });
   *
   * if (result.isValid) {
   *   console.log('Valid:', result.sanitizedValue);
   * } else {
   *   console.error('Errors:', result.errors);
   * }
   * ```
   *
   * @public
   */
  static validate(
    value: unknown,
    rules: ValidationRule = {},
  ): InputValidationResult {
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
        errors.push("This field is required");
        return { isValid: false, passed: false, errors, sanitizedValue };
      }

      // Skip further validation if empty and not required
      if (this.isEmpty(sanitizedValue) && !rules.required) {
        return { isValid: true, passed: true, errors: [], sanitizedValue: "" };
      }

      // String-specific validations
      if (typeof sanitizedValue === "string") {
        const stringResult = this.validateString(sanitizedValue, rules);
        errors.push(...stringResult.errors);
        sanitizedValue = stringResult.sanitizedValue;
      }

      // Number-specific validations
      if (typeof sanitizedValue === "number") {
        const numberResult = this.validateNumber(sanitizedValue, rules);
        errors.push(...numberResult.errors);
        sanitizedValue = numberResult.sanitizedValue;
      }

      // Pattern validation
      if (rules.pattern && typeof sanitizedValue === "string") {
        if (!rules.pattern.test(sanitizedValue)) {
          errors.push("Input format is invalid");
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
          errors.push("Validation error occurred");
          console.error("[InputValidator] Custom validator error:", error);
        }
      }

      return {
        isValid: errors.length === 0,
        passed: errors.length === 0,
        errors,
        sanitizedValue,
      };
    } catch (error) {
      // Catch any unexpected errors from malicious input
      console.error("[InputValidator] Validation error:", error);
      return {
        isValid: false,
        passed: false,
        errors: ["Invalid input"],
        sanitizedValue: value,
      };
    }
  }

  /**
   * Sanitizes HTML content to prevent XSS attacks
   *
   * Removes dangerous patterns (scripts, event handlers) and escapes HTML entities.
   * Always use this before displaying user-provided content in the DOM.
   *
   * @param input - User-provided string that may contain HTML
   * @returns Sanitized string safe for innerHTML
   *
   * @example
   * ```typescript
   * const userInput = '<script>alert("xss")</script>Hello';
   * const safe = InputValidator.sanitizeHtml(userInput);
   * // => '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;Hello'
   * ```
   *
   * @public
   */
  static sanitizeHtml(input: string): string {
    if (typeof input !== "string") {
      return "";
    }

    // Remove dangerous patterns
    let sanitized = input;
    this.DANGEROUS_PATTERNS.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, "");
    });

    // Escape HTML entities
    sanitized = sanitized.replace(/[&<>"'`=]/g, (char) => {
      return this.HTML_ENTITIES[char] || char;
    });

    return sanitized.trim();
  }

  /**
   * Sanitizes input for safe use in file names
   *
   * Removes or replaces characters that are invalid or dangerous in filenames
   * across different operating systems.
   *
   * @param input - User-provided filename
   * @returns Safe filename (or 'untitled' if input is invalid)
   *
   * @example
   * ```typescript
   * const filename = InputValidator.sanitizeFileName('my file!@#.txt');
   * // => 'my_file_.txt'
   * ```
   *
   * @public
   */
  static sanitizeFileName(input: string): string {
    if (typeof input !== "string") {
      return "untitled";
    }

    return (
      input
        .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace invalid chars with underscore
        .replace(/_{2,}/g, "_")
        .replace(/^_+|_+$/g, "")
        .substring(0, 255) || "untitled"
    );
  }

  /**
   * Validates and sanitizes URL input
   *
   * Checks for dangerous protocols (javascript:, data:, etc.) and validates
   * URL format. Only allows http://, https://, relative URLs, and protocol-relative URLs.
   *
   * @param input - User-provided URL string
   * @returns Validation result with sanitized URL or error
   *
   * @example
   * ```typescript
   * const result = InputValidator.sanitizeUrl('javascript:alert("xss")');
   * // => { isValid: false, errors: ['Unsafe URL protocol'], ... }
   *
   * const safe = InputValidator.sanitizeUrl('https://example.com');
   * // => { isValid: true, sanitizedValue: 'https://example.com', ... }
   * ```
   *
   * @public
   */
  static sanitizeUrl(input: string): InputValidationResult {
    if (typeof input !== "string") {
      return {
        isValid: false,
        passed: false,
        errors: ["Invalid URL format"],
        sanitizedValue: "",
      };
    }

    const trimmed = input.trim();

    // Check for dangerous protocols
    const dangerousProtocols = ["javascript:", "data:", "vbscript:", "file:"];
    const lowerInput = trimmed.toLowerCase();

    for (const protocol of dangerousProtocols) {
      if (lowerInput.startsWith(protocol)) {
        return {
          isValid: false,
          passed: false,
          errors: ["Unsafe URL protocol"],
          sanitizedValue: "",
        };
      }
    }

    // Allow only http, https, and relative URLs
    if (
      trimmed.startsWith("//") ||
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("/") ||
      !trimmed.includes("://")
    ) {
      try {
        // Additional URL validation
        if (trimmed.includes("://")) {
          new URL(trimmed); // This will throw if invalid
        }
        return {
          isValid: true,
          passed: true,
          errors: [],
          sanitizedValue: trimmed,
        };
      } catch {
        return {
          isValid: false,
          passed: false,
          errors: ["Invalid URL format"],
          sanitizedValue: "",
        };
      }
    }

    return {
      isValid: false,
      passed: false,
      errors: ["Invalid URL protocol"],
      sanitizedValue: "",
    };
  }

  /**
   * Validates player name input
   *
   * Enforces requirements for player names:
   * - 2-16 characters long
   * - Alphanumeric, underscores, and hyphens only
   * - Not a reserved name (admin, system, null, etc.)
   *
   * @param name - Player name to validate
   * @returns Validation result with sanitized name or errors
   *
   * @example
   * ```typescript
   * const result = InputValidator.validatePlayerName('Player_123');
   * // => { isValid: true, sanitizedValue: 'Player_123', ... }
   *
   * const invalid = InputValidator.validatePlayerName('admin');
   * // => { isValid: false, errors: ['This name is reserved'], ... }
   * ```
   *
   * @public
   */
  static validatePlayerName(name: string): InputValidationResult {
    return this.validate(name, {
      required: true,
      minLength: 2,
      maxLength: 16,
      pattern: /^[a-zA-Z0-9_-]+$/,
      customValidator: (value: unknown) => {
        // Check for reserved names
        const reserved = ["admin", "system", "null", "undefined", "bot"];
        if (
          typeof value === "string" &&
          reserved.includes(value.toLowerCase())
        ) {
          return "This name is reserved";
        }
        return null;
      },
    });
  }

  /**
   * Validates chat message input
   *
   * Enforces requirements for chat messages:
   * - Cannot be empty
   * - Maximum 500 characters
   * - No excessive repeated characters (spam prevention)
   * - Not excessively capitalized (caps lock spam)
   *
   * @param message - Chat message to validate
   * @returns Validation result with sanitized message or errors
   *
   * @example
   * ```typescript
   * const result = InputValidator.validateChatMessage('Hello world!');
   * // => { isValid: true, sanitizedValue: 'Hello world!', ... }
   *
   * const spam = InputValidator.validateChatMessage('AAAAAAAAAAAA');
   * // => { isValid: false, errors: ['Message contains too many repeated characters'], ... }
   * ```
   *
   * @public
   */
  static validateChatMessage(message: string): InputValidationResult {
    return this.validate(message, {
      required: true,
      maxLength: 500,
      customValidator: (value: unknown) => {
        if (typeof value !== "string") return null;
        // Check for spam patterns
        const repeatedChar = /(.)\1{10,}/;
        if (repeatedChar.test(value)) {
          return "Message contains too many repeated characters";
        }

        // Check for excessive caps
        const capsCount = (value.match(/[A-Z]/g) || []).length;
        if (capsCount > value.length * 0.7 && value.length > 10) {
          return "Message contains too many capital letters";
        }

        return null;
      },
    });
  }

  private static validateType(
    value: unknown,
    type?: string,
  ): InputValidationResult {
    if (!type) {
      return { isValid: true, passed: true, errors: [], sanitizedValue: value };
    }

    switch (type) {
      case "string":
        return {
          isValid: true,
          passed: true,
          errors: [],
          sanitizedValue: String(value || ""),
        };

      case "number": {
        const num = Number(value);
        if (isNaN(num)) {
          return {
            isValid: false,
            passed: false,
            errors: ["Must be a valid number"],
            sanitizedValue: value,
          };
        }
        return { isValid: true, passed: true, errors: [], sanitizedValue: num };
      }

      case "boolean":
        return {
          isValid: true,
          passed: true,
          errors: [],
          sanitizedValue: Boolean(value),
        };

      case "email": {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const emailStr = String(value || "");
        if (!emailPattern.test(emailStr)) {
          return {
            isValid: false,
            passed: false,
            errors: ["Must be a valid email address"],
            sanitizedValue: value,
          };
        }
        return {
          isValid: true,
          passed: true,
          errors: [],
          sanitizedValue: emailStr,
        };
      }

      case "url":
        return this.sanitizeUrl(String(value || ""));

      default:
        return {
          isValid: true,
          passed: true,
          errors: [],
          sanitizedValue: value,
        };
    }
  }

  private static validateString(
    value: string,
    rules: ValidationRule,
  ): InputValidationResult {
    const errors: string[] = [];
    let sanitized = this.sanitizeHtml(value);

    if (rules.minLength && sanitized.length < rules.minLength) {
      errors.push(`Must be at least ${rules.minLength} characters long`);
    }

    if (rules.maxLength && sanitized.length > rules.maxLength) {
      sanitized = sanitized.substring(0, rules.maxLength);
      errors.push(`Must be no more than ${rules.maxLength} characters long`);
    }

    return {
      isValid: errors.length === 0,
      passed: errors.length === 0,
      errors,
      sanitizedValue: sanitized,
    };
  }

  private static validateNumber(
    value: number,
    rules: ValidationRule,
  ): InputValidationResult {
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

    return {
      isValid: errors.length === 0,
      passed: errors.length === 0,
      errors,
      sanitizedValue: clampedValue,
    };
  }

  private static isEmpty(value: unknown): boolean {
    return (
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0)
    );
  }
}

/**
 * Convenience function for validating player names
 * @public
 * @see {@link InputValidator.validatePlayerName}
 */
export const validatePlayerName = (name: string) =>
  InputValidator.validatePlayerName(name);

/**
 * Convenience function for validating chat messages
 * @public
 * @see {@link InputValidator.validateChatMessage}
 */
export const validateChatMessage = (message: string) =>
  InputValidator.validateChatMessage(message);

/**
 * Convenience function for HTML sanitization
 * @public
 * @see {@link InputValidator.sanitizeHtml}
 */
export const sanitizeHtml = (input: string) =>
  InputValidator.sanitizeHtml(input);

/**
 * Convenience function for filename sanitization
 * @public
 * @see {@link InputValidator.sanitizeFileName}
 */
export const sanitizeFileName = (input: string) =>
  InputValidator.sanitizeFileName(input);

/**
 * Convenience function for URL sanitization
 * @public
 * @see {@link InputValidator.sanitizeUrl}
 */
export const sanitizeUrl = (input: string) => InputValidator.sanitizeUrl(input);
