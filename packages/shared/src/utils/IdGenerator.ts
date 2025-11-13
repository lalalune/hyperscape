/**
 * ID Generation Utilities
 *
 * Provides unique ID generation for entities, players, sessions, and more.
 */

import { customAlphabet } from "nanoid";

const ALPHABET =
  "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Generates a unique 10-character alphanumeric ID
 *
 * Uses nano-id with a custom alphabet for collision-resistant short IDs.
 * Safe for use as primary keys in databases and entity identifiers.
 *
 * Collision probability: ~1% chance after 129 million IDs or 148 years of use
 * See: https://zelark.github.io/nano-id-cc/
 *
 * @returns A 10-character unique ID (e.g., "a3B9xK7m2Q")
 *
 * @example
 * const playerId = uuid() // => "a3B9xK7m2Q"
 * const entityId = uuid() // => "7kP2mX9bH4"
 */
export const uuid = customAlphabet(ALPHABET, 10);
