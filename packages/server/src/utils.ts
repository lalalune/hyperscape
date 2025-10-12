import { createHash } from 'crypto'
import jsonwebtoken from 'jsonwebtoken'
const jwt = jsonwebtoken
/**
 *
 * Hash File
 *
 * takes a file and generates a sha256 unique hash.
 * carefully does this the same way as the client function.
 *
 */

export async function hashFile(buffer: Buffer): Promise<string> {
  const hash = createHash('sha256')
  hash.update(buffer)
  return hash.digest('hex')
}

/**
 * JSON Web Tokens
 */

// Use a default JWT secret if none provided (for development only)
const jwtSecret = process.env['JWT_SECRET'] || 'hyperscape-dev-secret-key-12345'

if (!process.env['JWT_SECRET'] && process.env.NODE_ENV === 'production') {
  console.error('[Security] Using default JWT secret - set JWT_SECRET environment variable in production')
}

export function createJWT(data: Record<string, unknown>): Promise<string> {
  return new Promise((resolve, reject) => {
    jwt.sign(data, jwtSecret, (err: Error | null, token?: string) => {
      if (err) reject(err)
      else resolve(token!)
    })
  })
}

export function verifyJWT(token: string): Promise<Record<string, unknown> | null> {
  return new Promise((resolve, _reject) => {
    jwt.verify(token, jwtSecret, (err: jsonwebtoken.VerifyErrors | null, decoded: unknown) => {
      if (err) resolve(null)
      else resolve((decoded as Record<string, unknown>) || null)
    })
  })
}
