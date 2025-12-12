/**
 * Server Utility Functions
 *
 * This module provides core server-side utilities for file hashing and authentication.
 *
 * **File Hashing** (`hashFile`):
 * Creates SHA-256 hashes of uploaded files for content-addressable storage.
 * The hash algorithm matches the client-side implementation exactly to ensure
 * consistent file identification across client and server. This enables:
 * - Deduplication of uploaded assets
 * - Content verification and integrity checking
 * - Cache-friendly filenames based on content
 *
 * **JSON Web Tokens** (`createJWT`, `verifyJWT`):
 * Provides JWT-based authentication for session management and API access.
 * Tokens are signed with a secret key (from JWT_SECRET env var) and can contain
 * arbitrary user data. Used for:
 * - Session persistence across WebSocket reconnections
 * - API authentication without database lookups
 * - Stateless authentication with expiration
 *
 * **Security Notes**:
 * - JWT_SECRET must be set in production (warns if using default dev secret)
 * - Tokens should have reasonable expiration times (set by caller)
 * - Hash algorithm (SHA-256) matches client for consistency
 *
 * **Referenced by**:
 * - index.ts (file upload endpoint)
 * - ServerNetwork.ts (authentication token generation/verification)
 */

import { createHash } from "crypto";
import jsonwebtoken from "jsonwebtoken";
const jwt = jsonwebtoken;

/**
 * Generates a SHA-256 hash of a file buffer
 *
 * Creates a cryptographic hash of file contents for content-addressable storage.
 * Implementation matches the client-side hashFile function exactly to ensure
 * files are identified consistently across client and server.
 *
 * Used for uploaded asset deduplication - files with the same hash are only
 * stored once, saving disk space and bandwidth.
 *
 * @param buffer - File contents as a Buffer
 * @returns Promise resolving to a 64-character hexadecimal hash string
 *
 * @example
 * const buffer = await fs.readFile('avatar.png')
 * const hash = await hashFile(buffer) // => 'a1b2c3d4...'
 * const filename = `${hash}.png` // => 'a1b2c3d4...png'
 */
export async function hashFile(buffer: Buffer): Promise<string> {
  const hash = createHash("sha256");
  hash.update(buffer);
  return hash.digest("hex");
}

/**
 * JSON Web Token authentication utilities
 *
 * Provides JWT creation and verification for session tokens.
 * Tokens are signed with JWT_SECRET from environment variables.
 */

// Use a default JWT secret if none provided (for development only)
const jwtSecret =
  process.env["JWT_SECRET"] || "hyperscape-dev-secret-key-12345";

if (!process.env["JWT_SECRET"] && process.env.NODE_ENV === "production") {
  console.error(
    "[Security] Using default JWT secret - set JWT_SECRET environment variable in production",
  );
}

/**
 * Creates a signed JSON Web Token containing arbitrary data
 *
 * The token can be used for stateless authentication - verifying the token
 * confirms it was issued by this server without database lookups.
 *
 * @param data - Arbitrary payload to include in the token (user ID, roles, etc.)
 * @returns Promise resolving to a signed JWT string
 *
 * @example
 * const token = await createJWT({ userId: '123', roles: ['player'] })
 * // Send token to client for future requests
 */
export function createJWT(data: Record<string, unknown>): Promise<string> {
  return new Promise((resolve, reject) => {
    jwt.sign(data, jwtSecret, (err: Error | null, token?: string) => {
      if (err) reject(err);
      else resolve(token!);
    });
  });
}

/**
 * Verifies and decodes a JSON Web Token
 *
 * Checks the token signature and returns the decoded payload if valid.
 * Returns null if the token is invalid, expired, or tampered with.
 *
 * @param token - JWT string to verify
 * @returns Promise resolving to decoded payload or null if invalid
 *
 * @example
 * const decoded = await verifyJWT(token)
 * if (decoded) {
 *   const userId = decoded.userId as string
 *   // Token is valid, proceed with authenticated request
 * } else {
 *   // Token invalid, reject request
 * }
 */
export function verifyJWT(
  token: string,
): Promise<Record<string, unknown> | null> {
  return new Promise((resolve, _reject) => {
    jwt.verify(
      token,
      jwtSecret,
      (err: jsonwebtoken.VerifyErrors | null, decoded: unknown) => {
        if (err) resolve(null);
        else resolve((decoded as Record<string, unknown>) || null);
      },
    );
  });
}
