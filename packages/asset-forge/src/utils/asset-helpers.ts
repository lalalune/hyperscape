/**
 * Asset Helpers
 *
 * Centralized utilities for asset-related operations including
 * URL construction, type detection, file extensions, and MIME types.
 */

/**
 * Get file extension from filename.
 *
 * @param filename - Filename to extract extension from
 * @returns File extension (lowercase, without dot) or empty string
 *
 * @example
 * ```typescript
 * getFileExtension('model.glb') // 'glb'
 * getFileExtension('texture.png') // 'png'
 * getFileExtension('archive.tar.gz') // 'gz'
 * ```
 */
export function getFileExtension(filename: string): string {
  if (!filename || !filename.includes('.')) return ''
  const parts = filename.split('.')
  return parts[parts.length - 1].toLowerCase()
}

/**
 * Get base filename without extension.
 *
 * @param filename - Filename to extract base from
 * @returns Filename without extension
 *
 * @example
 * ```typescript
 * getBasename('model.glb') // 'model'
 * getBasename('character.avatar.vrm') // 'character.avatar'
 * ```
 */
export function getBasename(filename: string): string {
  if (!filename) return ''
  const lastDotIndex = filename.lastIndexOf('.')
  return lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename
}

/**
 * Check if file has specific extension.
 *
 * @param filename - Filename to check
 * @param extension - Extension to check for (without dot)
 * @returns True if filename has extension
 *
 * @example
 * ```typescript
 * hasExtension('model.glb', 'glb') // true
 * hasExtension('texture.png', 'jpg') // false
 * ```
 */
export function hasExtension(filename: string, extension: string): boolean {
  return getFileExtension(filename) === extension.toLowerCase()
}

/**
 * Check if file has any of the specified extensions.
 *
 * @param filename - Filename to check
 * @param extensions - Array of extensions to check for
 * @returns True if filename has any of the extensions
 *
 * @example
 * ```typescript
 * hasAnyExtension('model.glb', ['glb', 'gltf']) // true
 * hasAnyExtension('texture.png', ['jpg', 'jpeg']) // false
 * ```
 */
export function hasAnyExtension(filename: string, extensions: string[]): boolean {
  const ext = getFileExtension(filename)
  return extensions.some(e => e.toLowerCase() === ext)
}

/**
 * Get MIME type from filename.
 *
 * @param filename - Filename to get MIME type for
 * @returns MIME type string
 *
 * @example
 * ```typescript
 * getMimeType('model.glb') // 'model/gltf-binary'
 * getMimeType('texture.png') // 'image/png'
 * getMimeType('unknown.xyz') // 'application/octet-stream'
 * ```
 */
export function getMimeType(filename: string): string {
  const ext = getFileExtension(filename)

  const mimeTypes: Record<string, string> = {
    // 3D Models
    glb: 'model/gltf-binary',
    gltf: 'model/gltf+json',
    vrm: 'model/gltf-binary',
    fbx: 'application/octet-stream',
    obj: 'text/plain',
    stl: 'application/sla',

    // Images
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',

    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',

    // Video
    mp4: 'video/mp4',
    webm: 'video/webm',

    // Documents
    pdf: 'application/pdf',
    txt: 'text/plain',
    json: 'application/json',
    xml: 'application/xml',

    // Archives
    zip: 'application/zip',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    rar: 'application/x-rar-compressed'
  }

  return mimeTypes[ext] || 'application/octet-stream'
}

/**
 * Detect asset type from filename.
 *
 * @param filename - Filename to detect type from
 * @returns Asset type string
 *
 * @example
 * ```typescript
 * detectAssetType('sword.glb') // 'model'
 * detectAssetType('texture.png') // 'image'
 * detectAssetType('sound.mp3') // 'audio'
 * ```
 */
export function detectAssetType(filename: string): string {
  const ext = getFileExtension(filename)

  if (['glb', 'gltf', 'vrm', 'fbx', 'obj', 'stl'].includes(ext)) {
    return 'model'
  }

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return 'image'
  }

  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
    return 'audio'
  }

  if (['mp4', 'webm'].includes(ext)) {
    return 'video'
  }

  if (['pdf', 'txt', 'json', 'xml'].includes(ext)) {
    return 'document'
  }

  if (['zip', 'tar', 'gz', 'rar'].includes(ext)) {
    return 'archive'
  }

  return 'unknown'
}

/**
 * Check if file is a 3D model.
 *
 * @param filename - Filename to check
 * @returns True if file is a 3D model
 *
 * @example
 * ```typescript
 * isModelFile('sword.glb') // true
 * isModelFile('texture.png') // false
 * ```
 */
export function isModelFile(filename: string): boolean {
  return detectAssetType(filename) === 'model'
}

/**
 * Check if file is an image.
 *
 * @param filename - Filename to check
 * @returns True if file is an image
 *
 * @example
 * ```typescript
 * isImageFile('texture.png') // true
 * isImageFile('model.glb') // false
 * ```
 */
export function isImageFile(filename: string): boolean {
  return detectAssetType(filename) === 'image'
}

/**
 * Check if file is audio.
 *
 * @param filename - Filename to check
 * @returns True if file is audio
 *
 * @example
 * ```typescript
 * isAudioFile('sound.mp3') // true
 * isAudioFile('video.mp4') // false
 * ```
 */
export function isAudioFile(filename: string): boolean {
  return detectAssetType(filename) === 'audio'
}

/**
 * Construct model URL from asset ID.
 *
 * @param assetId - Asset ID or filename
 * @param baseUrl - Base URL (default: '/models')
 * @returns Full model URL
 *
 * @example
 * ```typescript
 * getModelUrl('sword-001') // '/models/sword-001.glb'
 * getModelUrl('helmet', '/assets/3d') // '/assets/3d/helmet.glb'
 * ```
 */
export function getModelUrl(assetId: string, baseUrl: string = '/models'): string {
  const hasExtension = assetId.includes('.')
  const filename = hasExtension ? assetId : `${assetId}.glb`
  return `${baseUrl}/${filename}`
}

/**
 * Construct texture URL from asset ID.
 *
 * @param assetId - Asset ID or filename
 * @param baseUrl - Base URL (default: '/textures')
 * @returns Full texture URL
 *
 * @example
 * ```typescript
 * getTextureUrl('stone-diffuse') // '/textures/stone-diffuse.png'
 * getTextureUrl('wood.jpg', '/assets/textures') // '/assets/textures/wood.jpg'
 * ```
 */
export function getTextureUrl(assetId: string, baseUrl: string = '/textures'): string {
  const hasExtension = assetId.includes('.')
  const filename = hasExtension ? assetId : `${assetId}.png`
  return `${baseUrl}/${filename}`
}

/**
 * Construct audio URL from asset ID.
 *
 * @param assetId - Asset ID or filename
 * @param baseUrl - Base URL (default: '/audio')
 * @returns Full audio URL
 *
 * @example
 * ```typescript
 * getAudioUrl('sword-swing') // '/audio/sword-swing.mp3'
 * getAudioUrl('music.ogg', '/assets/sounds') // '/assets/sounds/music.ogg'
 * ```
 */
export function getAudioUrl(assetId: string, baseUrl: string = '/audio'): string {
  const hasExtension = assetId.includes('.')
  const filename = hasExtension ? assetId : `${assetId}.mp3`
  return `${baseUrl}/${filename}`
}

/**
 * Sanitize filename by removing invalid characters.
 *
 * @param filename - Filename to sanitize
 * @returns Sanitized filename
 *
 * @example
 * ```typescript
 * sanitizeFilename('My File!@#$.glb') // 'My-File.glb'
 * sanitizeFilename('model (1).glb') // 'model-1.glb'
 * ```
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '-') // Replace invalid chars with hyphen
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
}

/**
 * Generate unique filename by appending timestamp.
 *
 * @param filename - Base filename
 * @returns Unique filename with timestamp
 *
 * @example
 * ```typescript
 * generateUniqueFilename('model.glb') // 'model-1729756800000.glb'
 * ```
 */
export function generateUniqueFilename(filename: string): string {
  const ext = getFileExtension(filename)
  const base = getBasename(filename)
  const timestamp = Date.now()
  return ext ? `${base}-${timestamp}.${ext}` : `${base}-${timestamp}`
}

/**
 * Parse asset metadata from filename.
 *
 * @param filename - Filename to parse
 * @returns Parsed metadata object
 *
 * @example
 * ```typescript
 * parseAssetFilename('sword-bronze-legendary.glb')
 * // { name: 'sword', material: 'bronze', rarity: 'legendary', extension: 'glb' }
 * ```
 */
export function parseAssetFilename(filename: string): {
  name: string
  parts: string[]
  extension: string
} {
  const ext = getFileExtension(filename)
  const base = getBasename(filename)
  const parts = base.split('-').filter(Boolean)

  return {
    name: parts[0] || base,
    parts,
    extension: ext
  }
}

/**
 * Check if URL is valid.
 *
 * @param url - URL to validate
 * @returns True if URL is valid
 *
 * @example
 * ```typescript
 * isValidUrl('https://example.com/model.glb') // true
 * isValidUrl('/models/sword.glb') // true
 * isValidUrl('not a url') // false
 * ```
 */
export function isValidUrl(url: string): boolean {
  if (!url) return false

  // Check for relative URLs
  if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
    return true
  }

  // Check for absolute URLs
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Check if URL is absolute.
 *
 * @param url - URL to check
 * @returns True if URL is absolute
 *
 * @example
 * ```typescript
 * isAbsoluteUrl('https://example.com/model.glb') // true
 * isAbsoluteUrl('/models/sword.glb') // false
 * ```
 */
export function isAbsoluteUrl(url: string): boolean {
  if (!url) return false

  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Join URL parts safely.
 *
 * @param parts - URL parts to join
 * @returns Joined URL
 *
 * @example
 * ```typescript
 * joinUrl('/models/', '/sword.glb') // '/models/sword.glb'
 * joinUrl('https://example.com/', 'assets', 'model.glb') // 'https://example.com/assets/model.glb'
 * ```
 */
export function joinUrl(...parts: string[]): string {
  return parts
    .map((part, index) => {
      // Remove leading slash except for first part
      if (index > 0 && part.startsWith('/')) {
        part = part.substring(1)
      }
      // Remove trailing slash except for last part
      if (index < parts.length - 1 && part.endsWith('/')) {
        part = part.substring(0, part.length - 1)
      }
      return part
    })
    .filter(Boolean)
    .join('/')
}

/**
 * Extract filename from URL.
 *
 * @param url - URL to extract filename from
 * @returns Filename
 *
 * @example
 * ```typescript
 * getFilenameFromUrl('https://example.com/models/sword.glb') // 'sword.glb'
 * getFilenameFromUrl('/assets/texture.png') // 'texture.png'
 * ```
 */
export function getFilenameFromUrl(url: string): string {
  if (!url) return ''
  const parts = url.split('/')
  return parts[parts.length - 1].split('?')[0] // Remove query params
}

/**
 * Add query params to URL.
 *
 * @param url - Base URL
 * @param params - Query parameters
 * @returns URL with query params
 *
 * @example
 * ```typescript
 * addQueryParams('/api/assets', { id: '123', format: 'json' })
 * // '/api/assets?id=123&format=json'
 * ```
 */
export function addQueryParams(
  url: string,
  params: Record<string, string | number | boolean>
): string {
  const queryString = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')

  return queryString ? `${url}?${queryString}` : url
}

/**
 * Check if filename contains pattern (case-insensitive).
 *
 * @param filename - Filename to search
 * @param pattern - Pattern to search for
 * @returns True if pattern is found
 *
 * @example
 * ```typescript
 * filenameContains('bronze-sword.glb', 'sword') // true
 * filenameContains('Helmet_01.glb', 'helmet') // true
 * ```
 */
export function filenameContains(filename: string, pattern: string): boolean {
  if (!filename || !pattern) return false
  return filename.toLowerCase().includes(pattern.toLowerCase())
}

/**
 * Check if filename starts with pattern (case-insensitive).
 *
 * @param filename - Filename to check
 * @param pattern - Pattern to check for
 * @returns True if filename starts with pattern
 *
 * @example
 * ```typescript
 * filenameStartsWith('sword-bronze.glb', 'sword') // true
 * filenameStartsWith('Helmet_01.glb', 'helm') // true
 * ```
 */
export function filenameStartsWith(filename: string, pattern: string): boolean {
  if (!filename || !pattern) return false
  return filename.toLowerCase().startsWith(pattern.toLowerCase())
}

/**
 * Check if filename ends with pattern (case-insensitive, before extension).
 *
 * @param filename - Filename to check
 * @param pattern - Pattern to check for
 * @returns True if filename ends with pattern
 *
 * @example
 * ```typescript
 * filenameEndsWith('bronze-sword.glb', 'sword') // true
 * filenameEndsWith('Helmet_LOD0.glb', 'lod0') // true
 * ```
 */
export function filenameEndsWith(filename: string, pattern: string): boolean {
  if (!filename || !pattern) return false
  const base = getBasename(filename)
  return base.toLowerCase().endsWith(pattern.toLowerCase())
}
