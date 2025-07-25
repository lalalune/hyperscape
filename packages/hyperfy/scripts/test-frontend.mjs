#!/usr/bin/env node

import { chromium } from 'playwright'
import { spawn } from 'child_process'
import { readFileSync } from 'fs'
import path from 'path'

const TEST_TIMEOUT = 60000 // 60 seconds
const PORT = 3333
const URL = `http://localhost:${PORT}`

console.log('[Frontend Test] Starting frontend verification test...')

// Check if server is already running
async function isServerRunning() {
  try {
    const response = await fetch(`${URL}/health`)
    return response.ok
  } catch (error) {
    return false
  }
}

// Start server if not running
async function startServer() {
  const serverRunning = await isServerRunning()
  if (serverRunning) {
    console.log('[Frontend Test] Server already running on port', PORT)
    return null
  }

  console.log('[Frontend Test] Starting server...')
  const serverProcess = spawn('node', ['build/index.js'], {
    cwd: '/Users/shawwalters/hyperscape/packages/hyperfy',
    stdio: 'pipe'
  })

  // Wait for server to be ready
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Server startup timeout'))
    }, 30000) // 30 second timeout

    const checkServer = async () => {
      try {
        const response = await fetch(`${URL}/health`)
        if (response.ok) {
          clearTimeout(timeout)
          console.log('[Frontend Test] Server is ready')
          resolve(true)
        } else {
          setTimeout(checkServer, 1000)
        }
      } catch (error) {
        setTimeout(checkServer, 1000)
      }
    }

    checkServer()
  })

  return serverProcess
}

// Test frontend
async function testFrontend() {
  console.log('[Frontend Test] Launching browser...')
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
  })
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1
  })
  
  const page = await context.newPage()
  
  // Track console messages and errors
  const consoleMessages = []
  const errors = []
  
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    })
  })
  
  page.on('pageerror', error => {
    errors.push({
      type: 'pageerror',
      message: error.message,
      stack: error.stack
    })
  })
  
  try {
    console.log('[Frontend Test] Loading page...')
    await page.goto(URL, { waitUntil: 'networkidle', timeout: TEST_TIMEOUT })
    
    // Wait for initial load
    await page.waitForTimeout(5000)
    
    // Check if page loaded basic content
    const title = await page.title()
    console.log('[Frontend Test] Page title:', title)
    
    // Check for canvas element (WebGL renderer)
    const canvas = await page.$('canvas')
    if (canvas) {
      console.log('[Frontend Test] ✅ Canvas element found')
    } else {
      console.log('[Frontend Test] ❌ No canvas element found')
    }
    
    // Check WebGL context
    const webglSupported = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      return !!gl
    })
    
    if (webglSupported) {
      console.log('[Frontend Test] ✅ WebGL context available')
    } else {
      console.log('[Frontend Test] ❌ WebGL context not available')
    }
    
    // Take a screenshot for visual verification
    await page.screenshot({ path: '/Users/shawwalters/hyperscape/packages/hyperfy/test-output/frontend-test.png' })
    console.log('[Frontend Test] Screenshot saved to test-output/frontend-test.png')
    
    // Check for critical errors
    const criticalErrors = errors.filter(error => 
      !error.message.includes('DevTools') && 
      !error.message.includes('extensions')
    )
    
    const criticalConsoleErrors = consoleMessages.filter(msg => 
      msg.type === 'error' && 
      !msg.text.includes('DevTools') &&
      !msg.text.includes('extensions') &&
      !msg.text.includes('favicon')
    )
    
    // Results
    console.log('\n[Frontend Test] === RESULTS ===')
    console.log('[Frontend Test] Page loaded:', title !== '')
    console.log('[Frontend Test] Canvas found:', !!canvas)
    console.log('[Frontend Test] WebGL supported:', webglSupported)
    console.log('[Frontend Test] Critical errors:', criticalErrors.length)
    console.log('[Frontend Test] Critical console errors:', criticalConsoleErrors.length)
    
    if (criticalErrors.length > 0) {
      console.log('\n[Frontend Test] Critical Page Errors:')
      criticalErrors.forEach((error, i) => {
        console.log(`${i + 1}. ${error.message}`)
        if (error.stack) console.log(`   ${error.stack.split('\n')[1]}`)
      })
    }
    
    if (criticalConsoleErrors.length > 0) {
      console.log('\n[Frontend Test] Critical Console Errors:')
      criticalConsoleErrors.forEach((msg, i) => {
        console.log(`${i + 1}. [${msg.type}] ${msg.text}`)
      })
    }
    
    // Check for black screen (basic pixel analysis)
    const screenColor = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      if (!canvas) return null
      
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        
        let totalR = 0, totalG = 0, totalB = 0
        const pixelCount = data.length / 4
        
        for (let i = 0; i < data.length; i += 4) {
          totalR += data[i]
          totalG += data[i + 1]
          totalB += data[i + 2]
        }
        
        return {
          avgR: totalR / pixelCount,
          avgG: totalG / pixelCount,
          avgB: totalB / pixelCount,
          pixelCount
        }
      } catch (error) {
        return { error: error.message }
      }
    })
    
    if (screenColor && !screenColor.error) {
      const { avgR, avgG, avgB } = screenColor
      const isBlackScreen = avgR < 10 && avgG < 10 && avgB < 10
      const isWhiteScreen = avgR > 245 && avgG > 245 && avgB > 245
      
      console.log(`[Frontend Test] Screen analysis: R=${avgR.toFixed(1)} G=${avgG.toFixed(1)} B=${avgB.toFixed(1)}`)
      
      if (isBlackScreen) {
        console.log('[Frontend Test] ❌ Black screen detected')
      } else if (isWhiteScreen) {
        console.log('[Frontend Test] ❌ White screen detected')
      } else {
        console.log('[Frontend Test] ✅ Screen appears to be rendering content')
      }
    }
    
    // Overall result
    const success = (
      title !== '' &&
      !!canvas &&
      webglSupported &&
      criticalErrors.length === 0 &&
      criticalConsoleErrors.length === 0
    )
    
    console.log(`\n[Frontend Test] Overall Result: ${success ? '✅ SUCCESS' : '❌ FAILURE'}`)
    
    return success
    
  } catch (error) {
    console.error('[Frontend Test] Test failed:', error)
    return false
  } finally {
    await browser.close()
  }
}

// Main execution
async function main() {
  let serverProcess = null
  
  try {
    // Ensure test output directory exists
    try {
      await import('fs').then(fs => fs.default.mkdirSync('/Users/shawwalters/hyperscape/packages/hyperfy/test-output', { recursive: true }))
    } catch (error) {
      // Directory might already exist
    }
    
    // Check if server is already running
    const serverRunning = await isServerRunning()
    if (!serverRunning) {
      serverProcess = await startServer()
    } else {
      console.log('[Frontend Test] Using existing running server')
    }
    
    const success = await testFrontend()
    
    process.exit(success ? 0 : 1)
    
  } catch (error) {
    console.error('[Frontend Test] Error:', error)
    process.exit(1)
  } finally {
    if (serverProcess) {
      console.log('[Frontend Test] Terminating server...')
      serverProcess.kill('SIGTERM')
    }
  }
}

main()