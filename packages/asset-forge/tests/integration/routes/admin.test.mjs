/**
 * Integration Tests: Admin Routes
 *
 * Tests for /api/admin/* endpoints
 */

import { test, expect } from '@playwright/test'
import request from 'supertest'
import app from '../../../server/api.mjs'
import { initTestDatabase, clearTestDatabase, closeTestDatabase, getTestDb } from '../setup.mjs'
import { createAuthHeader, insertTestUser, createTestUser } from '../helpers/factories.mjs'

test.describe('Admin Routes', () => {
  let db = null
  let adminUser = null
  let regularUser = null

  test.beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.JWT_SECRET = 'test-secret-key-minimum-32-chars-long-12345'
    db = initTestDatabase()
  })

  test.afterAll(async () => {
    closeTestDatabase()
  })

  test.beforeEach(async () => {
    clearTestDatabase()
    adminUser = await insertTestUser(db, { role: 'admin', name: 'Admin User' })
    regularUser = await insertTestUser(db, { role: 'user', name: 'Regular User' })
  })

  test.describe('POST /api/admin/whitelist/add', () => {
    test('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/admin/whitelist/add')
        .send({ walletAddress: '0x1234567890abcdef' })
        .expect(401)

      expect(response.body.error).toBe('Authentication required')
    })

    test('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .post('/api/admin/whitelist/add')
        .set('Authorization', createAuthHeader(regularUser))
        .send({ walletAddress: '0x1234567890abcdef' })
        .expect(403)

      expect(response.body).toMatchObject({
        error: 'Forbidden',
        message: 'Admin access required',
      })
    })

    test('should add wallet to whitelist as admin', async () => {
      const walletAddress = '0x1234567890abcdef1234567890abcdef12345678'

      const response = await request(app)
        .post('/api/admin/whitelist/add')
        .set('Authorization', createAuthHeader(adminUser))
        .send({
          walletAddress,
          reason: 'Test admin wallet',
        })
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('added'),
      })
    })

    test('should return 400 for invalid wallet address', async () => {
      const response = await request(app)
        .post('/api/admin/whitelist/add')
        .set('Authorization', createAuthHeader(adminUser))
        .send({
          walletAddress: 'invalid-address',
          reason: 'Test',
        })
        .expect(400)

      expect(response.body.error).toBeDefined()
    })

    test('should normalize wallet addresses to lowercase', async () => {
      const walletAddress = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12'

      const response = await request(app)
        .post('/api/admin/whitelist/add')
        .set('Authorization', createAuthHeader(adminUser))
        .send({ walletAddress })
        .expect(200)

      expect(response.body.success).toBe(true)
    })
  })

  test.describe('POST /api/admin/whitelist/remove', () => {
    test('should remove wallet from whitelist', async () => {
      const walletAddress = '0x1234567890abcdef1234567890abcdef12345678'

      // First add to whitelist
      await db.insert(db._.schema.adminWhitelist).values({
        id: 'whitelist_1',
        walletAddress: walletAddress.toLowerCase(),
        isActive: true,
        createdAt: new Date(),
      })

      const response = await request(app)
        .post('/api/admin/whitelist/remove')
        .set('Authorization', createAuthHeader(adminUser))
        .send({ walletAddress })
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('removed'),
      })
    })

    test('should require admin access', async () => {
      const response = await request(app)
        .post('/api/admin/whitelist/remove')
        .set('Authorization', createAuthHeader(regularUser))
        .send({ walletAddress: '0x1234' })
        .expect(403)

      expect(response.body.error).toBe('Forbidden')
    })
  })

  test.describe('GET /api/admin/whitelist', () => {
    test('should return whitelist for admin', async () => {
      // Add test whitelist entries
      await db.insert(db._.schema.adminWhitelist).values([
        {
          id: 'whitelist_1',
          walletAddress: '0x1111111111111111111111111111111111111111',
          isActive: true,
          createdAt: new Date(),
        },
        {
          id: 'whitelist_2',
          walletAddress: '0x2222222222222222222222222222222222222222',
          isActive: true,
          createdAt: new Date(),
        },
      ])

      const response = await request(app)
        .get('/api/admin/whitelist')
        .set('Authorization', createAuthHeader(adminUser))
        .expect(200)

      expect(response.body.whitelist).toHaveLength(2)
      expect(response.body.whitelist[0]).toMatchObject({
        walletAddress: expect.any(String),
        isActive: true,
      })
    })

    test('should require admin access', async () => {
      const response = await request(app)
        .get('/api/admin/whitelist')
        .set('Authorization', createAuthHeader(regularUser))
        .expect(403)

      expect(response.body.error).toBe('Forbidden')
    })
  })

  test.describe('GET /api/admin/users', () => {
    test('should return all users for admin', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', createAuthHeader(adminUser))
        .expect(200)

      expect(response.body.users).toBeDefined()
      expect(response.body.users.length).toBeGreaterThanOrEqual(2) // admin + regular user
    })

    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', createAuthHeader(adminUser))
        .query({ limit: 1, offset: 0 })
        .expect(200)

      expect(response.body.users).toHaveLength(1)
      expect(response.body.total).toBeGreaterThanOrEqual(2)
    })

    test('should require admin access', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', createAuthHeader(regularUser))
        .expect(403)

      expect(response.body.error).toBe('Forbidden')
    })
  })

  test.describe('GET /api/admin/stats', () => {
    test('should return platform statistics', async () => {
      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', createAuthHeader(adminUser))
        .expect(200)

      expect(response.body).toMatchObject({
        totalUsers: expect.any(Number),
        activeUsers: expect.any(Number),
        totalProjects: expect.any(Number),
        totalAssets: expect.any(Number),
      })
    })

    test('should require admin access', async () => {
      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', createAuthHeader(regularUser))
        .expect(403)

      expect(response.body.error).toBe('Forbidden')
    })
  })

  test.describe('GET /api/admin/activity', () => {
    test('should return recent activity logs', async () => {
      const response = await request(app)
        .get('/api/admin/activity')
        .set('Authorization', createAuthHeader(adminUser))
        .expect(200)

      expect(response.body.activity).toBeDefined()
      expect(Array.isArray(response.body.activity)).toBe(true)
    })

    test('should support time filtering', async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago

      const response = await request(app)
        .get('/api/admin/activity')
        .set('Authorization', createAuthHeader(adminUser))
        .query({ since })
        .expect(200)

      expect(response.body.activity).toBeDefined()
    })

    test('should require admin access', async () => {
      const response = await request(app)
        .get('/api/admin/activity')
        .set('Authorization', createAuthHeader(regularUser))
        .expect(403)

      expect(response.body.error).toBe('Forbidden')
    })
  })
})
