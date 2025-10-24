/**
 * File Upload Validation Utility
 * Provides comprehensive validation for file uploads including:
 * - Size limits (per-file and total)
 * - Magic number verification
 * - MIME type validation
 * - Base64 encoding validation
 */

// NOTE: file-type package needs to be installed: npm install file-type --legacy-peer-deps
// Fallback implementation provided for basic validation without the package

export const FILE_SIZE_LIMITS = {
  IMAGE: 10 * 1024 * 1024,      // 10MB per image
  MODEL: 50 * 1024 * 1024,      // 50MB per model
  TOTAL: 200 * 1024 * 1024      // 200MB total per upload
}

export const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp'
]

export const ALLOWED_MODEL_TYPES = [
  'model/gltf-binary'  // .glb files
]

export class FileValidationError extends Error {
  constructor(message, code = 'VALIDATION_ERROR') {
    super(message)
    this.name = 'FileValidationError'
    this.code = code
  }
}

/**
 * Validate image buffer using magic numbers
 * @param {Buffer} buffer - Image buffer to validate
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} Validation result
 */
export async function validateImageBuffer(buffer, options = {}) {
  const { maxSize = FILE_SIZE_LIMITS.IMAGE } = options

  // Check size
  if (buffer.length > maxSize) {
    throw new FileValidationError(
      `Image size (${formatBytes(buffer.length)}) exceeds maximum (${formatBytes(maxSize)})`,
      'FILE_TOO_LARGE'
    )
  }

  // Verify it's actually an image using magic numbers
  let type
  try {
    // Try to use file-type package if available
    const { fileTypeFromBuffer } = await import('file-type')
    type = await fileTypeFromBuffer(buffer)
  } catch (importError) {
    // Fallback: Basic magic number checking without file-type package
    type = detectImageTypeFallback(buffer)
  }

  if (!type) {
    throw new FileValidationError(
      'Unable to determine file type - file may be corrupt',
      'INVALID_FILE_TYPE'
    )
  }

  if (!ALLOWED_IMAGE_TYPES.includes(type.mime)) {
    throw new FileValidationError(
      `Invalid image type: ${type.mime}. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
      'INVALID_MIME_TYPE'
    )
  }

  return { valid: true, mimeType: type.mime, ext: type.ext }
}

/**
 * Validate GLB model buffer
 * @param {Buffer} buffer - Model buffer to validate
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} Validation result
 */
export async function validateModelBuffer(buffer, options = {}) {
  const { maxSize = FILE_SIZE_LIMITS.MODEL } = options

  // Check size
  if (buffer.length > maxSize) {
    throw new FileValidationError(
      `Model size (${formatBytes(buffer.length)}) exceeds maximum (${formatBytes(maxSize)})`,
      'FILE_TOO_LARGE'
    )
  }

  // Verify GLB magic number (glTF binary starts with 'glTF')
  if (buffer.length < 12) {
    throw new FileValidationError(
      'File too small to be a valid GLB',
      'INVALID_GLB_FORMAT'
    )
  }

  const magic = buffer.toString('ascii', 0, 4)
  if (magic !== 'glTF') {
    throw new FileValidationError(
      'Invalid GLB file - missing glTF magic number',
      'INVALID_GLB_FORMAT'
    )
  }

  // Check version
  const version = buffer.readUInt32LE(4)
  if (version !== 2) {
    throw new FileValidationError(
      `Unsupported glTF version: ${version}. Only version 2 is supported.`,
      'UNSUPPORTED_VERSION'
    )
  }

  // Verify file length matches header
  const declaredLength = buffer.readUInt32LE(8)
  if (declaredLength !== buffer.length) {
    throw new FileValidationError(
      `GLB file length mismatch: header declares ${declaredLength} bytes but file is ${buffer.length} bytes`,
      'INVALID_GLB_FORMAT'
    )
  }

  return { valid: true, mimeType: 'model/gltf-binary', ext: 'glb', version }
}

/**
 * Validate and decode base64 image string
 * @param {string} base64String - Base64 encoded image
 * @returns {Buffer} Decoded buffer
 */
export function validateBase64Image(base64String) {
  // Remove data URL prefix if present
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '')

  // Validate base64 format
  if (!/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
    throw new FileValidationError(
      'Invalid base64 encoding',
      'INVALID_BASE64'
    )
  }

  try {
    const buffer = Buffer.from(base64Data, 'base64')

    // Sanity check - decoded buffer should be reasonable size
    if (buffer.length < 100) {
      throw new FileValidationError(
        'Decoded image is suspiciously small',
        'INVALID_IMAGE_DATA'
      )
    }

    return buffer
  } catch (error) {
    if (error instanceof FileValidationError) {
      throw error
    }
    throw new FileValidationError(
      'Failed to decode base64 data',
      'BASE64_DECODE_ERROR'
    )
  }
}

/**
 * Validate total size of multiple files
 * @param {Array} files - Array of file objects with size property
 * @param {number} maxTotal - Maximum total size
 * @returns {number} Total size
 */
export function validateTotalSize(files, maxTotal = FILE_SIZE_LIMITS.TOTAL) {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0)

  if (totalSize > maxTotal) {
    throw new FileValidationError(
      `Total upload size (${formatBytes(totalSize)}) exceeds maximum (${formatBytes(maxTotal)})`,
      'TOTAL_SIZE_EXCEEDED'
    )
  }

  return totalSize
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Byte count
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

/**
 * Fallback image type detection using magic numbers
 * Used when file-type package is not available
 * @param {Buffer} buffer - Image buffer
 * @returns {Object|null} Type object or null
 */
function detectImageTypeFallback(buffer) {
  if (buffer.length < 12) return null

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return { mime: 'image/png', ext: 'png' }
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { mime: 'image/jpeg', ext: 'jpg' }
  }

  // WebP: RIFF ... WEBP
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return { mime: 'image/webp', ext: 'webp' }
  }

  return null
}

export default {
  FILE_SIZE_LIMITS,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_MODEL_TYPES,
  FileValidationError,
  validateImageBuffer,
  validateModelBuffer,
  validateBase64Image,
  validateTotalSize
}
