/**
 * Authentication Types - User accounts and authentication
 *
 * Contains TypeScript types for user authentication, account management,
 * and authorization. These types are used by authentication handlers,
 * middleware, and user management systems.
 *
 * **Type Categories**:
 * - User accounts (User)
 * - Authentication tokens
 * - Authorization roles
 *
 * **Referenced by**: Authentication modules, connection handlers, API routes
 */

// ============================================================================
// USER ACCOUNTS
// ============================================================================

/**
 * Server-side user account representation
 *
 * Contains user account data including profile information,
 * roles, and account metadata.
 */
export interface User {
  id: string;
  name: string;
  avatar: string | null;
  roles: string | string[];
  createdAt: string;
}
