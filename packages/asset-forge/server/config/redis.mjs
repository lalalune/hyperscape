/**
 * Redis Configuration
 *
 * Redis client for caching, sessions, rate limiting, and job queues
 * Uses Fly.io Redis (Upstash) for managed Redis service
 */

import { createClient } from 'redis'
import { createLogger } from '../utils/logger.mjs'

const logger = createLogger('Redis')

/**
 * Redis configuration
 */
const config = {
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Redis max reconnection attempts reached')
        return new Error('Max reconnection attempts reached')
      }
      // Exponential backoff: 100ms, 200ms, 400ms, 800ms, etc.
      return Math.min(retries * 100, 3000)
    }
  }
}

/**
 * Redis client instance
 */
let redisClient = null

/**
 * Get or create Redis client
 */
export function getRedisClient() {
  if (!redisClient) {
    if (!config.url) {
      logger.warn('REDIS_URL not set - Redis features disabled')
      return null
    }

    redisClient = createClient(config)

    // Event listeners
    redisClient.on('error', (err) => {
      logger.error('Redis client error', { error: err.message })
    })

    redisClient.on('connect', () => {
      logger.info('Redis client connecting...')
    })

    redisClient.on('ready', () => {
      logger.info('Redis client ready')
    })

    redisClient.on('reconnecting', () => {
      logger.warn('Redis client reconnecting...')
    })

    redisClient.on('end', () => {
      logger.info('Redis client disconnected')
    })
  }

  return redisClient
}

/**
 * Connect to Redis
 */
export async function connectRedis() {
  const client = getRedisClient()
  if (!client) {
    return false
  }

  if (client.isOpen) {
    return true
  }

  try {
    await client.connect()
    logger.info('Redis connected successfully')
    return true
  } catch (error) {
    logger.error('Redis connection failed', { error: error.message })
    return false
  }
}

/**
 * Disconnect from Redis
 */
export async function disconnectRedis() {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit()
    logger.info('Redis disconnected')
    redisClient = null
  }
}

/**
 * Cache utilities
 */
export const cache = {
  /**
   * Get value from cache
   */
  async get(key) {
    const client = getRedisClient()
    if (!client || !client.isOpen) return null

    try {
      const value = await client.get(key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      logger.error('Cache get error', { key, error: error.message })
      return null
    }
  },

  /**
   * Set value in cache with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache (will be JSON stringified)
   * @param {number} ttl - Time to live in seconds (default: 5 minutes)
   */
  async set(key, value, ttl = 300) {
    const client = getRedisClient()
    if (!client || !client.isOpen) return false

    try {
      await client.setEx(key, ttl, JSON.stringify(value))
      return true
    } catch (error) {
      logger.error('Cache set error', { key, error: error.message })
      return false
    }
  },

  /**
   * Delete value from cache
   */
  async del(key) {
    const client = getRedisClient()
    if (!client || !client.isOpen) return false

    try {
      await client.del(key)
      return true
    } catch (error) {
      logger.error('Cache delete error', { key, error: error.message })
      return false
    }
  },

  /**
   * Delete all keys matching pattern
   */
  async delPattern(pattern) {
    const client = getRedisClient()
    if (!client || !client.isOpen) return 0

    try {
      const keys = await client.keys(pattern)
      if (keys.length === 0) return 0

      await client.del(keys)
      return keys.length
    } catch (error) {
      logger.error('Cache delete pattern error', { pattern, error: error.message })
      return 0
    }
  },

  /**
   * Check if key exists
   */
  async exists(key) {
    const client = getRedisClient()
    if (!client || !client.isOpen) return false

    try {
      const exists = await client.exists(key)
      return exists === 1
    } catch (error) {
      logger.error('Cache exists error', { key, error: error.message })
      return false
    }
  },

  /**
   * Get TTL for key
   */
  async ttl(key) {
    const client = getRedisClient()
    if (!client || !client.isOpen) return -1

    try {
      return await client.ttl(key)
    } catch (error) {
      logger.error('Cache TTL error', { key, error: error.message })
      return -1
    }
  }
}

/**
 * Rate limiting utilities
 */
export const rateLimit = {
  /**
   * Check rate limit
   * @param {string} key - Rate limit key (e.g., user ID, IP address)
   * @param {number} limit - Maximum requests
   * @param {number} window - Time window in seconds
   * @returns {Promise<{allowed: boolean, remaining: number, resetAt: number}>}
   */
  async check(key, limit = 100, window = 3600) {
    const client = getRedisClient()
    if (!client || !client.isOpen) {
      // If Redis is down, allow requests but log warning
      logger.warn('Rate limiting unavailable - allowing request')
      return { allowed: true, remaining: limit, resetAt: Date.now() + window * 1000 }
    }

    const rateLimitKey = `ratelimit:${key}`

    try {
      // Increment counter
      const count = await client.incr(rateLimitKey)

      // Set expiry on first request
      if (count === 1) {
        await client.expire(rateLimitKey, window)
      }

      // Get TTL
      const ttl = await client.ttl(rateLimitKey)
      const resetAt = Date.now() + ttl * 1000

      const allowed = count <= limit
      const remaining = Math.max(0, limit - count)

      return { allowed, remaining, resetAt }
    } catch (error) {
      logger.error('Rate limit check error', { key, error: error.message })
      return { allowed: true, remaining: limit, resetAt: Date.now() + window * 1000 }
    }
  },

  /**
   * Reset rate limit for key
   */
  async reset(key) {
    const client = getRedisClient()
    if (!client || !client.isOpen) return false

    try {
      await client.del(`ratelimit:${key}`)
      return true
    } catch (error) {
      logger.error('Rate limit reset error', { key, error: error.message })
      return false
    }
  }
}

/**
 * Session utilities
 */
export const session = {
  /**
   * Get session data
   */
  async get(sessionId) {
    const client = getRedisClient()
    if (!client || !client.isOpen) return null

    try {
      const data = await client.get(`session:${sessionId}`)
      return data ? JSON.parse(data) : null
    } catch (error) {
      logger.error('Session get error', { sessionId, error: error.message })
      return null
    }
  },

  /**
   * Set session data with TTL
   * @param {string} sessionId - Session ID
   * @param {object} data - Session data
   * @param {number} ttl - Time to live in seconds (default: 24 hours)
   */
  async set(sessionId, data, ttl = 86400) {
    const client = getRedisClient()
    if (!client || !client.isOpen) return false

    try {
      await client.setEx(`session:${sessionId}`, ttl, JSON.stringify(data))
      return true
    } catch (error) {
      logger.error('Session set error', { sessionId, error: error.message })
      return false
    }
  },

  /**
   * Delete session
   */
  async delete(sessionId) {
    const client = getRedisClient()
    if (!client || !client.isOpen) return false

    try {
      await client.del(`session:${sessionId}`)
      return true
    } catch (error) {
      logger.error('Session delete error', { sessionId, error: error.message })
      return false
    }
  },

  /**
   * Touch session (refresh TTL)
   */
  async touch(sessionId, ttl = 86400) {
    const client = getRedisClient()
    if (!client || !client.isOpen) return false

    try {
      const exists = await client.exists(`session:${sessionId}`)
      if (exists) {
        await client.expire(`session:${sessionId}`, ttl)
        return true
      }
      return false
    } catch (error) {
      logger.error('Session touch error', { sessionId, error: error.message })
      return false
    }
  }
}

// Export singleton client
export const redis = {
  get client() {
    return getRedisClient()
  },
  connect: connectRedis,
  disconnect: disconnectRedis,
  cache,
  rateLimit,
  session
}

export default redis
