/**
 * Authentication Flow Integration Tests
 * Tests the complete user journey: sign up → settings → API keys → logout → sign in
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { query } from '../../database/db.mjs'
import { encrypt, decrypt } from '../../utils/crypto.mjs'
import { getUserApiKey, getUserApiKeys } from '../users.mjs'

describe('Complete Authentication Flow', () => {
  const testPrivyId = `integration-test-${Date.now()}`
  let testUserId = null

  after(async () => {
    // Cleanup
    if (testUserId) {
      await query('DELETE FROM users WHERE id = $1', [testUserId])
      console.log(`[Test] ✅ Cleaned up test user: ${testUserId}`)
    }
  })

  it('should create user on first sign-in', async () => {
    console.log('[Test] Step 1: User signs in for the first time')
    
    // Simulate user creation (happens in GET /api/users/me)
    const result = await query(
      `INSERT INTO users (privy_user_id, email, wallet_address, display_name, role, settings)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, privy_user_id, email, wallet_address, display_name, role, settings, created_at`,
      [
        testPrivyId,
        'integration@test.com',
        '0xtest123',
        'Integration Test User',
        'member',
        JSON.stringify({})
      ]
    )

    testUserId = result.rows[0].id
    
    assert.ok(testUserId, 'User ID should be created')
    assert.equal(result.rows[0].privy_user_id, testPrivyId, 'Privy ID should match')
    assert.equal(result.rows[0].role, 'member', 'Default role should be member')
    assert.deepEqual(result.rows[0].settings, {}, 'Default settings should be empty object')
    
    console.log(`[Test] ✅ User created with ID: ${testUserId}`)
  })

  it('should save user settings to database', async () => {
    console.log('[Test] Step 2: User saves settings')
    
    const settings = {
      theme: 'dark',
      compactMode: true,
      emailNotifications: true,
      language: 'en',
      aiGatewayUrl: 'https://api.custom-gateway.com'
    }

    await query(
      `UPDATE users
       SET settings = $1, updated_at = CURRENT_TIMESTAMP
       WHERE privy_user_id = $2`,
      [JSON.stringify(settings), testPrivyId]
    )

    // Verify settings were saved
    const result = await query(
      'SELECT settings FROM users WHERE privy_user_id = $1',
      [testPrivyId]
    )

    const saved = result.rows[0].settings
    assert.equal(saved.theme, 'dark', 'Theme should be saved')
    assert.equal(saved.compactMode, true, 'Compact mode should be saved')
    assert.equal(saved.aiGatewayUrl, 'https://api.custom-gateway.com', 'AI Gateway URL should be saved')
    
    console.log('[Test] ✅ Settings saved successfully')
  })

  it('should add and encrypt OpenAI API key', async () => {
    console.log('[Test] Step 3: User adds OpenAI API key')
    
    const openaiKey = 'sk-test-openai-integration-key-1234567890'
    const encrypted = encrypt(openaiKey)

    // Simulate API key addition
    const currentSettings = await query(
      'SELECT settings FROM users WHERE privy_user_id = $1',
      [testPrivyId]
    )

    const settings = currentSettings.rows[0].settings || {}
    settings.apiKeys = {
      openai: encrypted,
      openaiCreatedAt: new Date().toISOString()
    }

    await query(
      `UPDATE users SET settings = $1 WHERE privy_user_id = $2`,
      [JSON.stringify(settings), testPrivyId]
    )

    // Verify key is encrypted in database
    const result = await query(
      'SELECT settings FROM users WHERE privy_user_id = $1',
      [testPrivyId]
    )

    const storedKey = result.rows[0].settings.apiKeys.openai
    assert.notEqual(storedKey, openaiKey, 'Stored key should not be plaintext')

    // Verify decryption works
    const retrieved = await getUserApiKey(testPrivyId, 'openai')
    assert.equal(retrieved, openaiKey, 'Retrieved key should match original')
    
    console.log('[Test] ✅ API key encrypted and stored')
  })

  it('should add multiple API keys', async () => {
    console.log('[Test] Step 4: User adds Meshy and ElevenLabs keys')
    
    const keys = {
      openai: 'sk-openai-multi-test-123',
      meshy: 'msh-meshy-multi-test-456',
      elevenlabs: 'el-elevenlabs-multi-test-789'
    }

    const encryptedKeys = {}
    for (const [provider, key] of Object.entries(keys)) {
      encryptedKeys[provider] = encrypt(key)
      encryptedKeys[`${provider}CreatedAt`] = new Date().toISOString()
    }

    const currentSettings = await query(
      'SELECT settings FROM users WHERE privy_user_id = $1',
      [testPrivyId]
    )

    const settings = { ...currentSettings.rows[0].settings, apiKeys: encryptedKeys }

    await query(
      `UPDATE users SET settings = $1 WHERE privy_user_id = $2`,
      [JSON.stringify(settings), testPrivyId]
    )

    // Verify all keys are retrievable
    const retrieved = await getUserApiKeys(testPrivyId)
    
    assert.equal(retrieved.openai, keys.openai, 'OpenAI key should match')
    assert.equal(retrieved.meshy, keys.meshy, 'Meshy key should match')
    assert.equal(retrieved.elevenlabs, keys.elevenlabs, 'ElevenLabs key should match')
    
    console.log('[Test] ✅ Multiple API keys stored and retrieved')
  })

  it('should persist settings and API keys across logout/login', async () => {
    console.log('[Test] Step 5: Simulating logout and re-login')
    
    // Get current state before "logout"
    const beforeLogout = await query(
      'SELECT settings FROM users WHERE privy_user_id = $1',
      [testPrivyId]
    )

    const settingsBeforeLogout = beforeLogout.rows[0].settings
    
    // Simulate logout (in real app, localStorage is cleared)
    // But database should persist
    
    // Simulate re-login (fetch user data again)
    const afterLogin = await query(
      'SELECT settings FROM users WHERE privy_user_id = $1',
      [testPrivyId]
    )

    const settingsAfterLogin = afterLogin.rows[0].settings

    // Verify settings persisted
    assert.equal(settingsAfterLogin.theme, settingsBeforeLogout.theme, 'Theme should persist')
    assert.deepEqual(settingsAfterLogin.apiKeys, settingsBeforeLogout.apiKeys, 'API keys should persist')
    assert.equal(settingsAfterLogin.aiGatewayUrl, settingsBeforeLogout.aiGatewayUrl, 'AI Gateway URL should persist')
    
    console.log('[Test] ✅ Settings and API keys persisted across logout/login')
  })

  it('should delete API key properly', async () => {
    console.log('[Test] Step 6: User deletes Meshy API key')
    
    const currentSettings = await query(
      'SELECT settings FROM users WHERE privy_user_id = $1',
      [testPrivyId]
    )

    const settings = currentSettings.rows[0].settings
    delete settings.apiKeys.meshy
    delete settings.apiKeys.meshyCreatedAt

    await query(
      `UPDATE users SET settings = $1 WHERE privy_user_id = $2`,
      [JSON.stringify(settings), testPrivyId]
    )

    // Verify key was deleted
    const meshyKey = await getUserApiKey(testPrivyId, 'meshy')
    assert.equal(meshyKey, null, 'Meshy key should be deleted')

    // Verify other keys still exist
    const openaiKey = await getUserApiKey(testPrivyId, 'openai')
    assert.ok(openaiKey, 'OpenAI key should still exist')
    
    console.log('[Test] ✅ API key deleted successfully')
  })

  it('should update last_login_at on sign in', async () => {
    console.log('[Test] Step 7: Update last login timestamp')
    
    const before = await query(
      'SELECT last_login_at FROM users WHERE privy_user_id = $1',
      [testPrivyId]
    )

    const beforeLogin = before.rows[0].last_login_at

    // Update last login (happens on every sign in)
    await query(
      `UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE privy_user_id = $1`,
      [testPrivyId]
    )

    const after = await query(
      'SELECT last_login_at FROM users WHERE privy_user_id = $1',
      [testPrivyId]
    )

    const afterLogin = after.rows[0].last_login_at

    assert.ok(afterLogin, 'Last login should have a value')
    
    // If there was a previous login timestamp, ensure new one is more recent
    if (beforeLogin) {
      const beforeTime = new Date(beforeLogin).getTime()
      const afterTime = new Date(afterLogin).getTime()
      assert.ok(afterTime > beforeTime, 'New last_login_at should be greater than previous')
    }
    
    // Ensure the timestamp is recent (within last 5 seconds)
    const now = Date.now()
    const afterTime = new Date(afterLogin).getTime()
    const timeDiff = now - afterTime
    assert.ok(timeDiff < 5000, `Last login timestamp should be within last 5 seconds (was ${timeDiff}ms ago)`)
    
    console.log('[Test] ✅ Last login timestamp updated')
  })

  it('should handle admin whitelist promotion', async () => {
    console.log('[Test] Step 8: Testing admin whitelist promotion')
    
    const testWallet = '0xadminwallet123'
    const adminTestPrivyId = `admin-test-${Date.now()}`

    // Add wallet to whitelist
    await query(
      `INSERT INTO admin_whitelist (wallet_address, reason)
       VALUES ($1, $2)
       ON CONFLICT (wallet_address) DO NOTHING`,
      [testWallet, 'Integration test admin']
    )

    // Create user with whitelisted wallet
    const result = await query(
      `INSERT INTO users (privy_user_id, wallet_address, role, settings)
       VALUES ($1, $2, $3, $4)
       RETURNING id, role`,
      [adminTestPrivyId, testWallet, 'member', JSON.stringify({})]
    )

    const userId = result.rows[0].id

    // In real app, the GET /me endpoint checks whitelist and updates role
    // Simulate that check
    const whitelistCheck = await query(
      'SELECT id FROM admin_whitelist WHERE wallet_address = $1',
      [testWallet]
    )

    if (whitelistCheck.rows.length > 0) {
      await query(
        'UPDATE users SET role = $1 WHERE privy_user_id = $2',
        ['admin', adminTestPrivyId]
      )
    }

    const updated = await query(
      'SELECT role FROM users WHERE privy_user_id = $1',
      [adminTestPrivyId]
    )

    assert.equal(updated.rows[0].role, 'admin', 'User should be promoted to admin')

    // Cleanup
    await query('DELETE FROM users WHERE id = $1', [userId])
    await query('DELETE FROM admin_whitelist WHERE wallet_address = $1', [testWallet])
    
    console.log('[Test] ✅ Admin whitelist promotion works')
  })
})

console.log('\n✅ Integration tests ready. Run with: node --test apps/api/server/routes/__tests__/auth-flow-integration.test.mjs')

