/**
 * EntityIdValidator - Input validation for entity IDs
 *
 * Validates entity IDs to prevent injection attacks and malformed input.
 * Used at the network layer before processing combat requests.
 *
 * Security considerations:
 * - Rejects IDs with special characters that could be used for injection
 * - Limits ID length to prevent buffer overflow attempts
 * - Validates format matches expected patterns
 *
 * @see OWASP Input Validation: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
 */

/**
 * Result of entity ID validation
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
  sanitizedId?: string;
}

/**
 * Configuration for entity ID validation
 */
export interface EntityIdValidatorConfig {
  /** Maximum allowed ID length (default: 64) */
  maxLength: number;
  /** Minimum allowed ID length (default: 1) */
  minLength: number;
  /** Allowed character pattern (default: alphanumeric + underscore + hyphen) */
  allowedPattern: RegExp;
  /** Whether to allow UUIDs (default: true) */
  allowUuids: boolean;
}

/**
 * Default validation configuration
 */
const DEFAULT_CONFIG: EntityIdValidatorConfig = {
  maxLength: 64,
  minLength: 1,
  allowedPattern: /^[a-zA-Z0-9_-]+$/,
  allowUuids: true,
};

/**
 * UUID v4 pattern for validation
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Entity ID Validator
 *
 * Validates entity IDs at the network layer to prevent:
 * - SQL injection via entity IDs
 * - Path traversal attacks
 * - Buffer overflow attempts
 * - Script injection (XSS)
 *
 * @example
 * ```typescript
 * const validator = new EntityIdValidator();
 *
 * // Valid IDs
 * validator.validate("player_123");     // { valid: true }
 * validator.validate("mob-goblin-01");  // { valid: true }
 * validator.validate("550e8400-e29b-41d4-a716-446655440000"); // { valid: true } (UUID)
 *
 * // Invalid IDs
 * validator.validate("../../../etc/passwd"); // { valid: false, reason: "invalid_characters" }
 * validator.validate("<script>alert(1)</script>"); // { valid: false, reason: "invalid_characters" }
 * validator.validate(""); // { valid: false, reason: "too_short" }
 * ```
 */
export class EntityIdValidator {
  private readonly config: EntityIdValidatorConfig;

  constructor(config?: Partial<EntityIdValidatorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Validate an entity ID
   *
   * @param id - The entity ID to validate
   * @returns Validation result with reason if invalid
   */
  validate(id: unknown): ValidationResult {
    // Type check - must be a string
    if (typeof id !== "string") {
      return {
        valid: false,
        reason: "not_a_string",
      };
    }

    // Length checks
    if (id.length < this.config.minLength) {
      return {
        valid: false,
        reason: "too_short",
      };
    }

    if (id.length > this.config.maxLength) {
      return {
        valid: false,
        reason: "too_long",
      };
    }

    // Check for null bytes (common injection vector)
    if (id.includes("\0")) {
      return {
        valid: false,
        reason: "contains_null_byte",
      };
    }

    // Check for path traversal attempts
    if (id.includes("..") || id.includes("/") || id.includes("\\")) {
      return {
        valid: false,
        reason: "path_traversal_attempt",
      };
    }

    // UUID check (if allowed)
    if (this.config.allowUuids && UUID_PATTERN.test(id)) {
      return {
        valid: true,
        sanitizedId: id.toLowerCase(),
      };
    }

    // Standard pattern check
    if (!this.config.allowedPattern.test(id)) {
      return {
        valid: false,
        reason: "invalid_characters",
      };
    }

    return {
      valid: true,
      sanitizedId: id,
    };
  }

  /**
   * Quick validation check (returns boolean only)
   *
   * @param id - The entity ID to validate
   * @returns true if valid, false otherwise
   */
  isValid(id: unknown): boolean {
    return this.validate(id).valid;
  }

  /**
   * Validate multiple entity IDs at once
   *
   * @param ids - Array of entity IDs to validate
   * @returns Object with valid flag and array of invalid IDs with reasons
   */
  validateMany(ids: unknown[]): {
    valid: boolean;
    invalidIds: Array<{ id: unknown; reason: string }>;
  } {
    const invalidIds: Array<{ id: unknown; reason: string }> = [];

    for (const id of ids) {
      const result = this.validate(id);
      if (!result.valid) {
        invalidIds.push({ id, reason: result.reason || "unknown" });
      }
    }

    return {
      valid: invalidIds.length === 0,
      invalidIds,
    };
  }

  /**
   * Sanitize an entity ID for safe logging
   * Truncates and escapes special characters
   *
   * @param id - The entity ID to sanitize
   * @returns Sanitized string safe for logging
   */
  sanitizeForLogging(id: unknown): string {
    if (typeof id !== "string") {
      return `[non-string: ${typeof id}]`;
    }

    // Truncate to max length + indicator
    const truncated =
      id.length > this.config.maxLength
        ? id.slice(0, this.config.maxLength) + "..."
        : id;

    // Escape potentially dangerous characters for logging
    // IMPORTANT: & must be escaped FIRST to prevent double-escaping
    return truncated
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t")
      .replace(/\0/g, "\\0");
  }
}

/**
 * Singleton validator instance for common use cases
 */
export const entityIdValidator = new EntityIdValidator();
