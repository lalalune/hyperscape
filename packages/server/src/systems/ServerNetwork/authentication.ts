/**
 * Authentication Module
 *
 * Handles user authentication through multiple providers:
 * - Privy (wallet and social authentication)
 * - Legacy JWT (custom token authentication)
 * - Anonymous users (fallback)
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

/**
 * Authenticates a user from connection parameters
 *
 * Authentication flow:
 * 1. Try Privy authentication (if enabled and token provided)
 * 2. Fall back to legacy JWT authentication
 * 3. Create anonymous user if no authentication succeeds
 *
 * @param params - Connection parameters from WebSocket
 * @param db - Database instance for user lookups/creation
 * @returns Authenticated user and auth token
 */
export async function authenticateUser(
  params: ConnectionParams,
  db: SystemDatabase,
): Promise<{
  user: User;
  authToken: string;
  userWithPrivy?: User & {
    privyUserId?: string | null;
    farcasterFid?: string | null;
  };
}> {
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
        console.log("[Authentication] 🔐 Verifying Privy User:", privyUserId);
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
          console.log("[Authentication] ✅ Found existing user:", dbResult.id);
          userWithPrivy = dbResult as User & {
            privyUserId?: string | null;
            farcasterFid?: string | null;
          };
          user = userWithPrivy;
        } else {
          // New Privy user - create account with stable id equal to privyUserId
          console.log(
            "[Authentication] 🆕 Creating new user for Privy ID:",
            privyInfo.privyUserId,
          );
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
        // Check if this is an agent token
        const isAgent = jwtPayload.isAgent === true;
        const characterId = jwtPayload.characterId as string | undefined;

        if (isAgent && characterId) {
          console.log(
            `[Authentication] 🤖 Agent JWT detected for character: ${characterId}`,
          );
        } else {
          console.log("[Authentication] 🔐 Hyperscape JWT detected");
        }

        // Look up user account
        const dbResult = await db("users")
          .where("id", jwtPayload.userId as string)
          .first();
        if (dbResult) {
          user = dbResult as User;
          console.log(
            `[Authentication] ✅ JWT verified for ${isAgent ? "agent" : "user"}: ${user.id}`,
          );
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
