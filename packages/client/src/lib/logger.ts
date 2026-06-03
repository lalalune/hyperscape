/**
 * Secure Logger Utility
 *
 * Provides logging functions that automatically redact sensitive data
 * like auth tokens, passwords, API keys, and other secrets.
 *
 * Features:
 * - Production mode silences debug/log/info output
 * - URL sanitization removes query params containing tokens
 * - Object sanitization redacts sensitive keys
 * - Maintains console.warn and console.error in production
 *
 * @module logger
 */

const isDev = import.meta.env.DEV;

/**
 * Redacts a sensitive string value, showing only the first few characters
 *
 * @param value - The sensitive string to redact
 * @param visibleChars - Number of characters to leave visible (default: 8)
 * @returns Redacted string with visible prefix and [REDACTED] suffix
 *
 * @example
 * redact("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz") // "eyJhbGci...[REDACTED]"
 */
function redact(value: string, visibleChars = 8): string {
  if (!value || value.length <= visibleChars) return "***";
  return value.substring(0, visibleChars) + "...[REDACTED]";
}

/**
 * Sanitizes a URL by removing/redacting sensitive query parameters
 *
 * Handles common auth-related query params:
 * - authToken, token, accessToken, refreshToken
 * - Bearer tokens in headers
 * - Any query param containing "token" or "secret"
 *
 * @param url - URL string that may contain sensitive query params
 * @returns URL with sensitive params redacted
 *
 * @example
 * sanitizeUrl("wss://api.example.com/ws?authToken=abc123&userId=1")
 * // "wss://api.example.com/ws?authToken=[REDACTED]&userId=1"
 */
function sanitizeUrl(url: string): string {
  return url
    .replace(/authToken=[^&]+/gi, "authToken=[REDACTED]")
    .replace(/accessToken=[^&]+/gi, "accessToken=[REDACTED]")
    .replace(/refreshToken=[^&]+/gi, "refreshToken=[REDACTED]")
    .replace(/token=[^&]+/gi, "token=[REDACTED]")
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
    .replace(/secret=[^&]+/gi, "secret=[REDACTED]")
    .replace(/apiKey=[^&]+/gi, "apiKey=[REDACTED]");
}

/** Keys that should be redacted when logging objects */
const SENSITIVE_KEYS = [
  "authToken",
  "token",
  "accessToken",
  "refreshToken",
  "password",
  "secret",
  "apiKey",
  "privateKey",
  "sessionToken",
  "jwt",
  "privyToken",
  "tokenSecret",
  "HYPERIA_AUTH_TOKEN",
];

/**
 * Sanitizes an object by redacting sensitive key values
 *
 * Recursively processes nested objects and arrays.
 * Only redacts string values for known sensitive keys.
 *
 * @param obj - Object that may contain sensitive values
 * @returns Shallow copy with sensitive values redacted
 *
 * @example
 * sanitizeObject({ userId: "123", authToken: "secret123" })
 * // { userId: "123", authToken: "secret12...[REDACTED]" }
 */
function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      result[key] = value;
      continue;
    }

    // Check if key is sensitive
    const isSensitive = SENSITIVE_KEYS.some(
      (sensitiveKey) => key.toLowerCase() === sensitiveKey.toLowerCase(),
    );

    if (isSensitive && typeof value === "string") {
      result[key] = redact(value);
    } else if (typeof value === "object" && !Array.isArray(value)) {
      // Recursively sanitize nested objects
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      // Handle arrays
      result[key] = value.map((item) =>
        typeof item === "object" && item !== null
          ? sanitizeObject(item as Record<string, unknown>)
          : item,
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Sanitizes any value for safe logging
 *
 * @param value - Any value to sanitize
 * @returns Sanitized value safe for logging
 */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    // Check if it looks like a URL
    if (value.includes("://") || value.includes("?")) {
      return sanitizeUrl(value);
    }
    return value;
  }

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return sanitizeObject(value as Record<string, unknown>);
  }

  return value;
}

/**
 * Secure logger with automatic redaction of sensitive data
 *
 * @example
 * // Basic usage
 * logger.log("User logged in:", userId);
 *
 * // URL logging (auto-sanitizes tokens)
 * logger.url("WebSocket URL:", wsUrl);
 *
 * // Config logging (auto-sanitizes sensitive keys)
 * logger.config("App config:", { authToken: "...", mode: "spectator" });
 */
export const logger = {
  /**
   * General logging (dev only)
   * Silenced in production
   */
  log: (...args: unknown[]) => {
    if (!isDev) return;
    console.log(...args.map(sanitizeValue));
  },

  /**
   * Warning logging (always active)
   * Use for deprecation warnings, potential issues
   */
  warn: (...args: unknown[]) => {
    console.warn(...args.map(sanitizeValue));
  },

  /**
   * Error logging (always active)
   * Use for errors and exceptions
   */
  error: (...args: unknown[]) => {
    console.error(...args.map(sanitizeValue));
  },

  /**
   * Info logging (dev only)
   * Silenced in production
   */
  info: (...args: unknown[]) => {
    if (!isDev) return;
    console.info(...args.map(sanitizeValue));
  },

  /**
   * Debug logging (dev only)
   * Silenced in production
   */
  debug: (...args: unknown[]) => {
    if (!isDev) return;
    console.debug(...args.map(sanitizeValue));
  },

  /**
   * URL logging with automatic token sanitization
   *
   * Use this specifically for logging URLs that may contain auth tokens
   * or other sensitive query parameters.
   *
   * @param label - Description of the URL being logged
   * @param url - The URL to log (will be sanitized)
   *
   * @example
   * logger.url("Connecting to:", "wss://api.com/ws?authToken=secret123");
   * // Logs: "Connecting to: wss://api.com/ws?authToken=[REDACTED]"
   */
  url: (label: string, url: string) => {
    if (!isDev) return;
    console.log(label, sanitizeUrl(url));
  },

  /**
   * Config/object logging with automatic secret sanitization
   *
   * Use this for logging configuration objects that may contain
   * sensitive values like tokens, passwords, or API keys.
   *
   * @param label - Description of the config being logged
   * @param config - Object to log (sensitive keys will be redacted)
   *
   * @example
   * logger.config("Embedded config:", { authToken: "abc123", mode: "spectator" });
   * // Logs: "Embedded config: { authToken: 'abc123...[REDACTED]', mode: 'spectator' }"
   */
  config: <T extends object>(label: string, config: T) => {
    if (!isDev) return;
    console.log(label, sanitizeObject(config as Record<string, unknown>));
  },
};

export default logger;
