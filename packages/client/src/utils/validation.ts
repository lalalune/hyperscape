/**
 * Shared validation utilities
 *
 * Single source of truth for input validation patterns used across the client.
 */

/**
 * Regex for sanitizing player names.
 * Only allows letters, numbers, spaces, hyphens, and underscores.
 * All other characters are replaced.
 */
export const NAME_SANITIZE_REGEX = /[^a-zA-Z0-9\s\-_]/g;

/**
 * Safely parse JSON with runtime type validation
 *
 * Unlike raw JSON.parse, this function validates the parsed data
 * against a type guard to ensure runtime type safety.
 *
 * @param text - The JSON string to parse
 * @param validator - A type guard function to validate the parsed data
 * @returns The parsed and validated data, or null if parsing/validation fails
 *
 * @example
 * ```typescript
 * interface UserData {
 *   id: string;
 *   name: string;
 * }
 *
 * function isUserData(data: unknown): data is UserData {
 *   return typeof data === 'object' && data !== null &&
 *     typeof (data as UserData).id === 'string' &&
 *     typeof (data as UserData).name === 'string';
 * }
 *
 * const result = parseJSON(jsonString, isUserData);
 * if (result) {
 *   // result is typed as UserData
 *   console.log(result.name);
 * }
 * ```
 */
export function parseJSON<T>(
  text: string,
  validator: (data: unknown) => data is T,
): T | null {
  try {
    const data: unknown = JSON.parse(text);
    return validator(data) ? data : null;
  } catch {
    return null;
  }
}

/**
 * Parse JSON with a default value on failure
 *
 * @param text - The JSON string to parse
 * @param validator - A type guard function to validate the parsed data
 * @param defaultValue - The default value to return if parsing/validation fails
 * @returns The parsed data or the default value
 */
export function parseJSONWithDefault<T>(
  text: string,
  validator: (data: unknown) => data is T,
  defaultValue: T,
): T {
  const result = parseJSON(text, validator);
  return result ?? defaultValue;
}
