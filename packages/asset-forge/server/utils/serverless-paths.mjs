/**
 * Serverless-aware Path Helper
 *
 * Provides utility functions to get writable directories in serverless environments.
 * In Vercel serverless functions, only /tmp is writable. In local development,
 * we use the project directory structure.
 */

import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '../../')

/**
 * Get a writable directory path that works in both local and serverless environments
 *
 * @param {string} relativePath - Relative path from project root (e.g., 'temp-images', 'gdd-assets')
 * @returns {string} Absolute path to writable directory
 *
 * @example
 * // Local: /Users/home/project/temp-images
 * // Vercel: /tmp/temp-images
 * const tempDir = getWritableDir('temp-images')
 */
export function getWritableDir(relativePath) {
  if (process.env.VERCEL === '1') {
    // Serverless environment - use /tmp
    return path.join('/tmp', relativePath)
  }
  // Local development - use project directory
  return path.join(ROOT_DIR, relativePath)
}

/**
 * Get a writable file path that works in both local and serverless environments
 *
 * @param {string} relativeFilePath - Relative file path from project root
 * @returns {string} Absolute path to writable file
 *
 * @example
 * const imagePath = getWritablePath('temp-images/image.png')
 */
export function getWritablePath(relativeFilePath) {
  if (process.env.VERCEL === '1') {
    return path.join('/tmp', relativeFilePath)
  }
  return path.join(ROOT_DIR, relativeFilePath)
}

/**
 * Check if we're running in a serverless environment
 *
 * @returns {boolean} True if serverless, false if local
 */
export function isServerless() {
  return process.env.VERCEL === '1'
}

/**
 * Get the root directory for the application
 * In serverless, this may be read-only
 *
 * @returns {string} Root directory path
 */
export function getRootDir() {
  return ROOT_DIR
}

export default {
  getWritableDir,
  getWritablePath,
  isServerless,
  getRootDir
}
