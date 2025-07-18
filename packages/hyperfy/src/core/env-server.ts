/**
 * Server-only environment variables
 * These should NEVER be imported in client code
 */

// Ensure we're in a Node.js environment
if (typeof process === 'undefined' || !process.versions?.node) {
  throw new Error('env-server.ts can only be imported in Node.js environments');
}

// Server-only sensitive environment variables
export const ENV_SERVER = {
  // Authentication secrets
  JWT_SECRET: process.env.JWT_SECRET || '',
  ADMIN_CODE: process.env.ADMIN_CODE,

  // LiveKit secrets (NEVER expose to client)
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,

  // Add any other server-only secrets here
};
