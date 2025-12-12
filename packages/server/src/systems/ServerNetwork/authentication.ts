/**
 * Authentication Module
 *
 * Handles user authentication through multiple providers:
 * - Privy (wallet and social authentication)
 * - Legacy JWT (custom token authentication)
 * - Anonymous users (fallback with rate limiting)
 *
 * Security measures:
 * - Anonymous account creation rate limiting (prevents bot farming)
 * - IP-based rate limiting for account creation
 *
 * This module extracts all authentication logic from ServerNetwork
 * to improve maintainability and testability.
 */

import type {
  ConnectionParams,
  User,
  SystemDatabase,
} from "../../shared/types";
import {
  isPrivyEnabled,
  verifyPrivyToken,
} from "../../infrastructure/auth/privy-auth";
import { createJWT, verifyJWT } from "../../shared/utils";
import { uuid } from "@hyperscape/shared";

// ============================================================================
// ACCOUNT CREATION RATE LIMITING
// ============================================================================

/**
 * Rate limiter for anonymous account creation
 * Prevents bot farming and account spam attacks
 */
class AccountCreationRateLimiter {
  private creations = new Map<string, { count: number; resetAt: number }>();
  private readonly maxPerHour: number;
  private readonly windowMs: number;

  constructor(maxPerHour = 5, windowMs = 3600000) {
    this.maxPerHour = maxPerHour;
    this.windowMs = windowMs;

    // Cleanup old entries every 10 minutes
    setInterval(() => this.cleanup(), 600000);
  }

  /**
   * Check if IP is allowed to create account
   * @returns true if allowed, false if rate limited
   */
  isAllowed(ip: string): boolean {
    const now = Date.now();
    const entry = this.creations.get(ip);

    if (!entry || now > entry.resetAt) {
      return true;
    }

    return entry.count < this.maxPerHour;
  }

  /**
   * Record account creation for IP
   */
  record(ip: string): void {
    const now = Date.now();
    const entry = this.creations.get(ip);

    if (!entry || now > entry.resetAt) {
      this.creations.set(ip, { count: 1, resetAt: now + this.windowMs });
    } else {
      entry.count++;
    }
  }

  /**
   * Get remaining account creations for IP
   */
  getRemaining(ip: string): number {
    const entry = this.creations.get(ip);
    if (!entry || Date.now() > entry.resetAt) {
      return this.maxPerHour;
    }
    return Math.max(0, this.maxPerHour - entry.count);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [ip, entry] of this.creations) {
      if (now > entry.resetAt) {
        this.creations.delete(ip);
      }
    }
  }
}

// Singleton rate limiter for account creation
const accountCreationLimiter = new AccountCreationRateLimiter(
  5, // Max 5 anonymous accounts per IP per hour
  3600000, // 1 hour window
);

/**
 * Authenticates a user from connection parameters
 *
 * Authentication flow:
 * 1. Try Privy authentication (if enabled and token provided)
 * 2. Fall back to legacy JWT authentication
 * 3. Create anonymous user if no authentication succeeds (rate limited)
 *
 * Security:
 * - Anonymous account creation is rate limited per IP
 * - Max 5 anonymous accounts per IP per hour
 *
 * @param params - Connection parameters from WebSocket
 * @param db - Database instance for user lookups/creation
 * @param clientIP - Client IP address for rate limiting (optional)
 * @returns Authenticated user and auth token, or null if rate limited
 */
export async function authenticateUser(
  params: ConnectionParams,
  db: SystemDatabase,
  clientIP?: string,
): Promise<{
  user: User;
  authToken: string;
  userWithPrivy?: User & {
    privyUserId?: string | null;
    farcasterFid?: string | null;
  };
} | null> {
  let authToken = params.authToken;
  const name = params.name;
  const avatar = params.avatar;
  const privyUserId = (params as { privyUserId?: string }).privyUserId;

  let user: User | undefined;
  let userWithPrivy:
    | (User & { privyUserId?: string | null; farcasterFid?: string | null })
    | undefined;

  // Try Privy authentication first if enabled
  if (isPrivyEnabled() && authToken && privyUserId) {
    try {
      const privyInfo = await verifyPrivyToken(authToken);

      if (privyInfo && privyInfo.privyUserId === privyUserId) {
        let dbResult: User | undefined;
        try {
          dbResult = (await db("users")
            .where("privyUserId", privyUserId)
            .first()) as User | undefined;
        } catch (_e) {
          dbResult = (await db("users").where("id", privyUserId).first()) as
            | User
            | undefined;
        }

        if (dbResult) {
          // Existing Privy user
          userWithPrivy = dbResult as User & {
            privyUserId?: string | null;
            farcasterFid?: string | null;
          };
          user = userWithPrivy;
        } else {
          // New Privy user - create account with stable id equal to privyUserId
          const timestamp = new Date().toISOString();
          const newUser: {
            id: string;
            name: string;
            avatar: string | null;
            roles: string;
            createdAt: string;
            privyUserId?: string;
            farcasterFid?: string;
          } = {
            id: privyInfo.privyUserId,
            name: name || "Adventurer",
            avatar: avatar || null,
            roles: "",
            createdAt: timestamp,
          };
          try {
            newUser.privyUserId = privyInfo.privyUserId;
            if (privyInfo.farcasterFid) {
              newUser.farcasterFid = privyInfo.farcasterFid;
            }
            await db("users").insert(newUser);
          } catch (_err) {
            await db("users").insert({
              id: newUser.id,
              name: newUser.name,
              avatar: newUser.avatar,
              roles: newUser.roles,
              createdAt: newUser.createdAt,
            });
          }
          userWithPrivy = newUser as User & {
            privyUserId?: string | null;
            farcasterFid?: string | null;
          };
          user = userWithPrivy;
        }

        // Generate a Hyperscape JWT for this user
        authToken = await createJWT({ userId: (user as User).id });
      } else {
        console.warn(
          "[Authentication] Privy token verification failed or user ID mismatch",
        );
      }
    } catch (err) {
      // JWT expiration is expected behavior, not an error
      if (err instanceof Error && err.message.includes("exp")) {
        console.warn(
          "[Authentication] Privy token expired - user needs to re-authenticate",
        );
      } else if (
        err instanceof Error &&
        (err.message.includes("alg") || err.name === "JOSEAlgNotAllowed")
      ) {
        // Algorithm mismatch is expected when a Hyperscape JWT is passed to Privy
        // This happens with agent tokens - silently fall through to Hyperscape JWT verification
      } else {
        console.error("[Authentication] Privy authentication error:", err);
      }
      // Fall through to legacy authentication
    }
  }

  // Fall back to Hyperscape JWT authentication if Privy didn't work
  if (!user && authToken) {
    try {
      const jwtPayload = await verifyJWT(authToken);
      if (jwtPayload && jwtPayload.userId) {
        // Check if this is an agent token (available for future use)
        const _isAgent = jwtPayload.isAgent === true;

        // Look up user account
        let dbResult = await db("users")
          .where("id", jwtPayload.userId as string)
          .first();

        // If user doesn't exist and this is a Privy ID, create the user record
        if (
          !dbResult &&
          (jwtPayload.userId as string).startsWith("did:privy:")
        ) {
          const timestamp = new Date().toISOString();
          const newUser = {
            id: jwtPayload.userId as string,
            name: name || "Agent",
            avatar: avatar || null,
            roles: "",
            createdAt: timestamp,
            privyUserId: jwtPayload.userId as string,
          };

          try {
            await db("users").insert(newUser);
            dbResult = newUser as User;
          } catch (insertErr) {
            console.error(
              "[Authentication] Failed to create user record:",
              insertErr,
            );
            // Try fetching again in case of race condition
            dbResult = await db("users")
              .where("id", jwtPayload.userId as string)
              .first();
          }
        }

        if (dbResult) {
          user = dbResult as User;
        }
      }
    } catch (err) {
      console.error(
        "[Authentication] Failed to read authToken:",
        authToken,
        err,
      );
    }
  }

  // Create anonymous user if no authentication succeeded
  if (!user) {
    // SECURITY: Rate limit anonymous account creation per IP
    const ip = clientIP || "unknown";
    if (!accountCreationLimiter.isAllowed(ip)) {
      console.warn(
        `[Authentication] Anonymous account creation rate limited for IP: ${ip} (remaining: ${accountCreationLimiter.getRemaining(ip)})`,
      );
      // Return null to signal rate limiting - caller should close connection
      return null;
    }

    const timestamp = new Date().toISOString();
    user = {
      id: uuid(),
      name: "Anonymous",
      avatar: null,
      roles: "",
      createdAt: timestamp,
    };
    await db("users").insert({
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      roles: Array.isArray(user.roles) ? user.roles.join(",") : user.roles,
      createdAt: timestamp,
    });
    authToken = await createJWT({ userId: user.id });

    // Record account creation for rate limiting
    accountCreationLimiter.record(ip);
    console.log(
      `[Authentication] Created anonymous account for IP: ${ip} (remaining: ${accountCreationLimiter.getRemaining(ip)})`,
    );
  }

  // Convert roles string to array - DB stores as string, runtime uses array
  if ((user.roles as string).split) {
    user.roles = (user.roles as string).split(",").filter((r) => r);
  }

  // Only grant admin in development mode when no admin code is set
  if (!process.env.ADMIN_CODE && process.env.NODE_ENV === "development") {
    console.warn(
      "[Authentication] No ADMIN_CODE set in development mode - granting temporary admin access",
    );
    if (Array.isArray(user.roles)) {
      user.roles.push("~admin");
    }
  }

  return { user, authToken: authToken || "", userWithPrivy };
}
