/**
 * User API Keys Tests
 * Tests for encrypted API key storage and retrieval
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { query } from '../../database/db.mjs'
import { encrypt, decrypt, isEncrypted } from '../../utils/crypto.mjs'
import { getUserApiKey, getUserApiKeys } from '../users.mjs'

describe('User API Keys System', () => {
  let testUserId = null
  const testPrivyId = `test-user-${Date.now()}`

  before(async () => {
    // Create test user
    const result = await query(
      `INSERT INTO users (privy_user_id, email, display_name, role, settings)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [testPrivyId, 'test@test.com', 'Test User', 'member', JSON.stringify({})]
    )
    testUserId = result.rows[0].id
    console.log(`[Test] Created test user: ${testUserId}`)
  })

  after(async () => {
    // Cleanup test user
    if (testUserId) {
      await query('DELETE FROM users WHERE id = $1', [testUserId])
      console.log(`[Test] Deleted test user: ${testUserId}`)
    }
  })

  describe('Encryption/Decryption', () => {
    it('should encrypt and decrypt API keys correctly', () => {
      const original = 'sk-test-api-key-1234567890'
      const encrypted = encrypt(original)
      
      assert.ok(encrypted, 'Encryption should return a value')
      assert.notEqual(encrypted, original, 'Encrypted value should differ from original')
      assert.ok(encrypted.includes(':'), 'Encrypted value should contain colons')
      
      const decrypted = decrypt(encrypted)
      assert.equal(decrypted, original, 'Decrypted value should match original')
    })

    it('should detect encrypted values correctly', () => {
      const encrypted = encrypt('test-key-123')
      const plaintext = 'sk-plaintext-key'
      
      assert.ok(isEncrypted(encrypted), 'Should detect encrypted values')
      assert.ok(!isEncrypted(plaintext), 'Should not detect plaintext as encrypted')
    })

    it('should handle empty/null values', () => {
      assert.equal(encrypt(''), '', 'Empty string should return empty')
      assert.equal(decrypt(''), '', 'Empty string should return empty')
      assert.equal(encrypt(null), null, 'Null should return null')
    })
  })

  describe('API Key Storage', () => {
    it('should store encrypted API key in database', async () => {
      const testKey = 'sk-openai-test-key-1234567890'
      const encrypted = encrypt(testKey)

      await query(
        `UPDATE users
         SET settings = jsonb_set(
           COALESCE(settings, '{}'::jsonb),
           '{apiKeys,openai}',
           to_jsonb($1::text)
         )
         WHERE privy_user_id = $2`,
        [encrypted, testPrivyId]
      )

      // Verify it's stored encrypted
      const result = await query(
        'SELECT settings FROM users WHERE privy_user_id = $1',
        [testPrivyId]
      )

      const stored = result.rows[0].settings.apiKeys.openai
      assert.ok(isEncrypted(stored), 'Stored key should be encrypted')
      assert.notEqual(stored, testKey, 'Stored key should not be plaintext')
    })

    it('should retrieve and decrypt API key', async () => {
      const testKey = 'sk-meshy-test-key-abcdefg'
      const encrypted = encrypt(testKey)

      await query(
        `UPDATE users
         SET settings = jsonb_set(
           COALESCE(settings, '{}'::jsonb),
           '{apiKeys,meshy}',
           to_jsonb($1::text)
         )
         WHERE privy_user_id = $2`,
        [encrypted, testPrivyId]
      )

      // Retrieve using helper function
      const retrieved = await getUserApiKey(testPrivyId, 'meshy')
      assert.equal(retrieved, testKey, 'Retrieved key should match original')
    })
  })

  describe('getUserApiKey Helper', () => {
    it('should return null for non-existent user', async () => {
      const key = await getUserApiKey('non-existent-user', 'openai')
      assert.equal(key, null, 'Should return null for non-existent user')
    })

    it('should return null for non-existent provider key', async () => {
      const key = await getUserApiKey(testPrivyId, 'elevenlabs')
      assert.equal(key, null, 'Should return null if provider key not set')
    })

    it('should return decrypted key for valid user and provider', async () => {
      const testKey = 'sk-test-elevenlabs-key-xyz'
      const encrypted = encrypt(testKey)

      await query(
        `UPDATE users
         SET settings = jsonb_set(
           COALESCE(settings, '{}'::jsonb),
           '{apiKeys,elevenlabs}',
           to_jsonb($1::text)
         )
         WHERE privy_user_id = $2`,
        [encrypted, testPrivyId]
      )

      const retrieved = await getUserApiKey(testPrivyId, 'elevenlabs')
      assert.equal(retrieved, testKey, 'Should return decrypted key')
    })
  })

  describe('getUserApiKeys Helper', () => {
    it('should return all user API keys decrypted', async () => {
      // Set up multiple keys
      const keys = {
        openai: 'sk-openai-all-test-123',
        meshy: 'msh-meshy-all-test-456',
        elevenlabs: 'el-elevenlabs-all-test-789'
      }

      const encryptedKeys = {}
      for (const [provider, key] of Object.entries(keys)) {
        encryptedKeys[provider] = encrypt(key)
      }

      await query(
        `UPDATE users
         SET settings = jsonb_set(
           COALESCE(settings, '{}'::jsonb),
           '{apiKeys}',
           $1::jsonb
         )
         WHERE privy_user_id = $2`,
        [JSON.stringify(encryptedKeys), testPrivyId]
      )

      // Retrieve all keys
      const retrieved = await getUserApiKeys(testPrivyId)
      
      assert.equal(retrieved.openai, keys.openai, 'OpenAI key should match')
      assert.equal(retrieved.meshy, keys.meshy, 'Meshy key should match')
      assert.equal(retrieved.elevenlabs, keys.elevenlabs, 'ElevenLabs key should match')
    })

    it('should return empty object for user with no keys', async () => {
      await query(
        `UPDATE users SET settings = '{}'::jsonb WHERE privy_user_id = $1`,
        [testPrivyId]
      )

      const retrieved = await getUserApiKeys(testPrivyId)
      assert.deepEqual(retrieved, {}, 'Should return empty object')
    })
  })

  describe('Backward Compatibility', () => {
    it('should handle plaintext keys (migration scenario)', async () => {
      const plaintextKey = 'sk-plaintext-legacy-key'

      await query(
        `UPDATE users
         SET settings = jsonb_set(
           COALESCE(settings, '{}'::jsonb),
           '{apiKeys,openai}',
           to_jsonb($1::text)
         )
         WHERE privy_user_id = $2`,
        [plaintextKey, testPrivyId]
      )

      const retrieved = await getUserApiKey(testPrivyId, 'openai')
      assert.equal(retrieved, plaintextKey, 'Should handle plaintext keys')
    })
  })
})

console.log('✅ All User API Keys tests configured. Run with: node --test')

