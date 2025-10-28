/**
 * Admin Logs API Routes
 * Endpoints for viewing API request and error logs
 */

import { Hono } from 'hono'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const router = new Hono()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '../../../..')
const LOGS_DIR = path.join(ROOT_DIR, 'logs')

/**
 * Parse request log file and compute statistics
 */
async function parseRequestLogs() {
  try {
    const logPath = path.join(LOGS_DIR, 'api-requests.log')
    const content = await fs.readFile(logPath, 'utf-8')
    const lines = content.trim().split('\n').filter(line => line.length > 0)

    const requests = lines.map(line => {
      try {
        return JSON.parse(line)
      } catch (err) {
        return null
      }
    }).filter(Boolean)

    const total = requests.length
    const successful = requests.filter(r => r.success).length
    const failed = requests.filter(r => !r.success).length

    // Group by endpoint
    const byEndpoint = {}
    requests.forEach(req => {
      const key = `${req.method} ${req.path}`
      if (!byEndpoint[key]) {
        byEndpoint[key] = { total: 0, success: 0, failed: 0, avgDuration: 0, durations: [] }
      }
      byEndpoint[key].total++
      if (req.success) {
        byEndpoint[key].success++
      } else {
        byEndpoint[key].failed++
      }
      byEndpoint[key].durations.push(req.duration)
    })

    // Calculate average durations
    Object.keys(byEndpoint).forEach(key => {
      const durations = byEndpoint[key].durations
      byEndpoint[key].avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      delete byEndpoint[key].durations
    })

    // Recent requests (last 100)
    const recentRequests = requests.slice(-100).reverse()

    // Error rate over time (last 24 hours, grouped by hour)
    const now = Date.now()
    const hourAgo24 = now - (24 * 60 * 60 * 1000)
    const recentErrors = requests.filter(r => {
      const timestamp = new Date(r.timestamp).getTime()
      return !r.success && timestamp > hourAgo24
    })

    // Group errors by hour
    const errorsByHour = {}
    recentErrors.forEach(err => {
      const hour = new Date(err.timestamp).getHours()
      errorsByHour[hour] = (errorsByHour[hour] || 0) + 1
    })

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? ((successful / total) * 100).toFixed(2) : '0',
      byEndpoint,
      recentRequests: recentRequests.slice(0, 50),
      errorsByHour
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {
        total: 0,
        successful: 0,
        failed: 0,
        successRate: '0',
        byEndpoint: {},
        recentRequests: [],
        errorsByHour: {}
      }
    }
    throw err
  }
}

/**
 * Parse error log file
 */
async function parseErrorLogs(limit = 50) {
  try {
    const logPath = path.join(LOGS_DIR, 'api-errors.log')
    const content = await fs.readFile(logPath, 'utf-8')

    // Split by error separator
    const errorBlocks = content.split('=== API ERROR ===').filter(block => block.trim().length > 0)

    const errors = errorBlocks.map(block => {
      const lines = block.trim().split('\n')
      const error = {}

      lines.forEach(line => {
        const match = line.match(/^(\w+(?:\s\w+)?): (.+)$/)
        if (match) {
          const key = match[1].toLowerCase().replace(/\s+/g, '_')
          error[key] = match[2]
        }
      })

      // Extract JSON fields
      if (error.request_body) {
        try {
          error.request_body = JSON.parse(error.request_body)
        } catch (e) {
          // Keep as string if not valid JSON
        }
      }

      if (error.query_params) {
        try {
          error.query_params = JSON.parse(error.query_params)
        } catch (e) {
          // Keep as string if not valid JSON
        }
      }

      if (error.headers) {
        try {
          error.headers = JSON.parse(error.headers)
        } catch (e) {
          // Keep as string if not valid JSON
        }
      }

      return error
    })

    // Sort by timestamp (most recent first)
    errors.sort((a, b) => {
      const timeA = new Date(a.time || 0).getTime()
      const timeB = new Date(b.time || 0).getTime()
      return timeB - timeA
    })

    // Group by error code
    const byErrorCode = {}
    errors.forEach(err => {
      const code = err.error_code || 'UNKNOWN'
      if (!byErrorCode[code]) {
        byErrorCode[code] = { count: 0, errors: [] }
      }
      byErrorCode[code].count++
      byErrorCode[code].errors.push(err)
    })

    return {
      errors: errors.slice(0, limit),
      total: errors.length,
      byErrorCode
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {
        errors: [],
        total: 0,
        byErrorCode: {}
      }
    }
    throw err
  }
}

/**
 * Generate AI fix prompt for an error
 */
function generateAIFixPrompt(error) {
  const { method, path, status, message, stack, error_code, request_body, query_params } = error

  return `# API Error Fix Request

## Error Details
- **Endpoint**: ${method} ${path}
- **Status Code**: ${status}
- **Error Code**: ${error_code || 'N/A'}
- **Error Message**: ${message}

## Stack Trace
\`\`\`
${stack}
\`\`\`

## Request Details
- **Method**: ${method}
- **Path**: ${path}
- **Query Params**: ${JSON.stringify(query_params, null, 2)}
- **Request Body**: ${JSON.stringify(request_body, null, 2)}

## Task
Please analyze this error and provide a fix. The error occurred in the Asset Forge API server.

**Investigate:**
1. What is causing this error?
2. Which file(s) need to be modified?
3. What is the root cause?

**Fix:**
1. Provide the exact code changes needed
2. Explain why this error occurred
3. Suggest any additional improvements to prevent similar errors

**Test:**
Verify that the fix resolves the error without breaking existing functionality.
`
}

/**
 * GET /api/admin/logs/stats
 * Get aggregated log statistics
 */
router.get('/stats', async (c) => {
  try {
    const stats = await parseRequestLogs()
    return c.json(stats)
  } catch (error) {
    console.error('[AdminLogs] Failed to get stats:', error.message)
    return c.json({
      error: 'Failed to fetch log statistics',
      message: error.message
    }, 500)
  }
})

/**
 * GET /api/admin/logs/errors
 * Get recent error logs
 */
router.get('/errors', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50', 10)
    const errorLogs = await parseErrorLogs(limit)

    return c.json(errorLogs)
  } catch (error) {
    console.error('[AdminLogs] Failed to get errors:', error.message)
    return c.json({
      error: 'Failed to fetch error logs',
      message: error.message
    }, 500)
  }
})

/**
 * GET /api/admin/logs/error/:index/fix-prompt
 * Get AI fix prompt for a specific error
 */
router.get('/error/:index/fix-prompt', async (c) => {
  try {
    const index = parseInt(c.req.param('index'), 10)
    const errorLogs = await parseErrorLogs(1000) // Get more errors to find the right index

    if (index >= errorLogs.errors.length) {
      return c.json({
        error: 'Error not found',
        message: `No error at index ${index}`
      }, 404)
    }

    const error = errorLogs.errors[index]
    const prompt = generateAIFixPrompt(error)

    return c.json({
      error,
      prompt
    })
  } catch (error) {
    console.error('[AdminLogs] Failed to generate fix prompt:', error.message)
    return c.json({
      error: 'Failed to generate fix prompt',
      message: error.message
    }, 500)
  }
})

/**
 * DELETE /api/admin/logs/clear
 * Clear all log files
 */
router.delete('/clear', async (c) => {
  try {
    const requestLogPath = path.join(LOGS_DIR, 'api-requests.log')
    const errorLogPath = path.join(LOGS_DIR, 'api-errors.log')

    try {
      await fs.unlink(requestLogPath)
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }

    try {
      await fs.unlink(errorLogPath)
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }

    return c.json({
      success: true,
      message: 'Log files cleared'
    })
  } catch (error) {
    console.error('[AdminLogs] Failed to clear logs:', error.message)
    return c.json({
      error: 'Failed to clear logs',
      message: error.message
    }, 500)
  }
})

export default router
