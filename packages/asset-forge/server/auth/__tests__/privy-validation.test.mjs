/**
 * Tests for Privy Configuration Validation
 *
 * These tests verify that the fail-fast validation works correctly
 * in both production and development environments.
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'

describe('Privy Configuration Validation', () => {
  let originalEnv

  beforeEach(() => {
    // Save original environment
    originalEnv = {
      PRIVY_APP_ID: process.env.PRIVY_APP_ID,
      PUBLIC_PRIVY_APP_ID: process.env.PUBLIC_PRIVY_APP_ID,
      PRIVY_APP_SECRET: process.env.PRIVY_APP_SECRET,
      NODE_ENV: process.env.NODE_ENV,
    }
  })

  afterEach(() => {
    // Restore original environment
    Object.assign(process.env, originalEnv)

    // Clear module cache to reset privy client
    const privyModulePath = new URL('../privy.mjs', import.meta.url).href
    if (privyModulePath in import.meta.resolve) {
      delete import.meta.cache[privyModulePath]
    }
  })

  it('should throw error in production when credentials are missing', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.PRIVY_APP_ID
    delete process.env.PUBLIC_PRIVY_APP_ID
    delete process.env.PRIVY_APP_SECRET

    // Dynamic import to ensure clean module state
    const { validatePrivyConfig } = await import('../privy.mjs')

    assert.throws(
      () => validatePrivyConfig(),
      {
        name: 'Error',
        message: /CRITICAL: Missing required Privy credentials/,
      },
      'Should throw error in production when credentials are missing'
    )
  })

  it('should throw error in production when PRIVY_APP_ID is missing', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.PRIVY_APP_ID
    delete process.env.PUBLIC_PRIVY_APP_ID
    process.env.PRIVY_APP_SECRET = 'test-secret'

    const { validatePrivyConfig } = await import('../privy.mjs')

    assert.throws(
      () => validatePrivyConfig(),
      {
        name: 'Error',
        message: /CRITICAL: Missing required Privy credentials/,
      },
      'Should throw error when PRIVY_APP_ID is missing'
    )
  })

  it('should throw error in production when PRIVY_APP_SECRET is missing', async () => {
    process.env.NODE_ENV = 'production'
    process.env.PRIVY_APP_ID = 'test-app-id'
    delete process.env.PRIVY_APP_SECRET

    const { validatePrivyConfig } = await import('../privy.mjs')

    assert.throws(
      () => validatePrivyConfig(),
      {
        name: 'Error',
        message: /CRITICAL: Missing required Privy credentials/,
      },
      'Should throw error when PRIVY_APP_SECRET is missing'
    )
  })

  it('should return false in development when credentials are missing', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.PRIVY_APP_ID
    delete process.env.PUBLIC_PRIVY_APP_ID
    delete process.env.PRIVY_APP_SECRET

    const { validatePrivyConfig } = await import('../privy.mjs')

    const result = validatePrivyConfig()
    assert.strictEqual(result, false, 'Should return false in development')
  })

  it('should return true when credentials are present', async () => {
    process.env.NODE_ENV = 'production'
    process.env.PRIVY_APP_ID = 'test-app-id'
    process.env.PRIVY_APP_SECRET = 'test-secret'

    const { validatePrivyConfig } = await import('../privy.mjs')

    const result = validatePrivyConfig()
    assert.strictEqual(result, true, 'Should return true when credentials are present')
  })

  it('should accept PUBLIC_PRIVY_APP_ID as fallback', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.PRIVY_APP_ID
    process.env.PUBLIC_PRIVY_APP_ID = 'test-app-id'
    process.env.PRIVY_APP_SECRET = 'test-secret'

    const { validatePrivyConfig } = await import('../privy.mjs')

    const result = validatePrivyConfig()
    assert.strictEqual(result, true, 'Should accept PUBLIC_PRIVY_APP_ID')
  })
})
