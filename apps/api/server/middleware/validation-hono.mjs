/**
 * Request Validation Middleware for Hono
 *
 * Provides Hono middleware for validating request bodies, params, and queries
 * using Zod schemas with proper error handling and logging.
 * Uses @hono/zod-validator for integration with Hono's context system.
 */

import { zValidator } from '@hono/zod-validator'

/**
 * Error handler for validation failures
 * Formats errors to match the existing API error format
 */
function validationErrorHandler(result, c) {
  if (!result.success) {
    console.warn(`[Validation] Validation failed:`, result.error.errors)

    return c.json({
      error: 'Validation failed',
      code: 'VAL_1100',
      message: `Invalid ${result.error.errors[0]?.path?.[0] || 'data'}`,
      details: {
        errors: result.error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
          code: e.code
        }))
      },
      timestamp: new Date().toISOString()
    }, 400)
  }
}

/**
 * Create a validation middleware for request body
 *
 * @param {import('zod').ZodType} schema - Zod schema to validate against
 * @returns {Function} Hono middleware
 *
 * @example
 * import { z } from 'zod'
 * const schema = z.object({ name: z.string() })
 * app.post('/api/users', validateBody(schema), async (c) => {
 *   const body = c.req.valid('json')
 *   return c.json({ success: true })
 * })
 */
export function validateBody(schema) {
  return zValidator('json', schema, validationErrorHandler)
}

/**
 * Create a validation middleware for request params
 *
 * @param {import('zod').ZodType} schema - Zod schema to validate against
 * @returns {Function} Hono middleware
 *
 * @example
 * import { z } from 'zod'
 * const schema = z.object({ id: z.string() })
 * app.get('/api/users/:id', validateParams(schema), async (c) => {
 *   const { id } = c.req.valid('param')
 *   return c.json({ id })
 * })
 */
export function validateParams(schema) {
  return zValidator('param', schema, validationErrorHandler)
}

/**
 * Create a validation middleware for query parameters
 *
 * @param {import('zod').ZodType} schema - Zod schema to validate against
 * @returns {Function} Hono middleware
 *
 * @example
 * import { z } from 'zod'
 * const schema = z.object({ page: z.string().optional() })
 * app.get('/api/users', validateQuery(schema), async (c) => {
 *   const { page } = c.req.valid('query')
 *   return c.json({ page })
 * })
 */
export function validateQuery(schema) {
  return zValidator('query', schema, validationErrorHandler)
}

/**
 * Validate response data before sending
 * Useful for ensuring API responses match expected schema
 *
 * @param {import('zod').ZodType} schema - Zod schema to validate against
 * @param {any} data - Data to validate
 * @returns {any} Validated data
 * @throws {Error} If validation fails
 *
 * @example
 * const responseSchema = z.object({ id: z.number(), name: z.string() })
 * app.get('/api/users/:id', async (c) => {
 *   const user = await getUser(c.req.param('id'))
 *   const validated = validateResponse(responseSchema, user)
 *   return c.json(validated)
 * })
 */
export function validateResponse(schema, data) {
  const startTime = Date.now()

  try {
    const result = schema.safeParse(data)

    if (!result.success) {
      const duration = Date.now() - startTime
      console.error(`[Validation] Response validation failed (${duration}ms):`, result.error.errors)

      throw new Error(`Response validation failed: ${result.error.errors.map(e => e.message).join(', ')}`)
    }

    const duration = Date.now() - startTime
    console.log(`[Validation] Response validation passed (${duration}ms)`)

    return result.data
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Validation] Response validation error (${duration}ms):`, error)
    throw error
  }
}
