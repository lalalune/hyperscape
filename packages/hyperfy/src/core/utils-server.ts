import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { ENV_SERVER } from './env-server';

/**
 *
 * Hash File
 *
 * takes a file and generates a sha256 unique hash.
 * carefully does this the same way as the client function.
 *
 */

export async function hashFile(file: Buffer | string): Promise<string> {
  const hash = crypto.createHash('sha256');
  hash.update(file);
  return hash.digest('hex');
}

/**
 * JSON Web Tokens
 */

const jwtSecret = ENV_SERVER.JWT_SECRET || 'default-secret-for-dev';

export function createJWT(data: any): Promise<string> {
  return new Promise((resolve, reject) => {
    jwt.sign(data, jwtSecret, (err: Error | null, token?: string) => {
      if (err) {
        reject(err);
      } else {
        resolve(token!);
      }
    });
  });
}

export function verifyJWT(token: string): Promise<any> {
  return new Promise((resolve, _reject) => {
    jwt.verify(token, jwtSecret, (err: Error | null, data?: any) => {
      if (err) {
        resolve(null);
      } else {
        resolve(data);
      }
    });
  });
}
