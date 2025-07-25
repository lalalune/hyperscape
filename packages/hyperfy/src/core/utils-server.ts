import crypto from 'crypto'
import jwt from 'jsonwebtoken'

/**
 *
 * Hash File
 *
 * takes a file and generates a sha256 unique hash.
 * carefully does this the same way as the client function.
 *
 */

export async function hashFile(file: Buffer | string): Promise<string> {
  const hash = crypto.createHash('sha256')
  hash.update(file)
  return hash.digest('hex')
}

/**
 * JSON Web Tokens
 */

// Use a default JWT secret if none provided (for development only)
const jwtSecret = process.env['JWT_SECRET'] || 'hyperfy-dev-secret-key-12345'

if (!process.env['JWT_SECRET']) {
  console.warn('[Security] Using default JWT secret - set JWT_SECRET environment variable in production')
}

export function createJWT(data: any): Promise<string> {
  return new Promise((resolve, reject) => {
    jwt.sign(data, jwtSecret, (err: Error | null, token?: string) => {
      if (err) reject(err)
      else resolve(token!)
    })
  })
}

export function verifyJWT(token: string): Promise<any> {
  return new Promise((resolve, _reject) => {
    jwt.verify(token, jwtSecret, (err: Error | null, data?: any) => {
      if (err) resolve(null)
      else resolve(data)
    })
  })
}
