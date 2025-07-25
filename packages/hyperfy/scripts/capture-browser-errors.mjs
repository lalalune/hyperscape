#!/usr/bin/env node

import puppeteer from 'puppeteer'
import chalk from 'chalk'

const DEBUG_PORT = process.env.PORT || 3333
const WORLD_URL = `http://localhost:${DEBUG_PORT}/`

async function captureErrors() {
  console.log(chalk.cyan('🔍 Starting browser error capture...'))
  console.log(chalk.gray(`URL: ${WORLD_URL}`))
  
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()
    
    // Collect all console messages
    const messages = []
    const errors = []
    
    // Listen for console messages
    page.on('console', msg => {
      const type = msg.type()
      const text = msg.text()
      const location = msg.location()
      
      const entry = {
        type,
        text,
        url: location.url,
        line: location.lineNumber,
        column: location.columnNumber,
        timestamp: new Date().toISOString()
      }
      
      messages.push(entry)
      
      // Log in real-time with color coding
      if (type === 'error') {
        console.log(chalk.red(`❌ ERROR: ${text}`))
        if (location.url) {
          console.log(chalk.red(`   at ${location.url}:${location.lineNumber}:${location.columnNumber}`))
        }
        errors.push(entry)
      } else if (type === 'warning') {
        console.log(chalk.yellow(`⚠️  WARN: ${text}`))
      } else if (type === 'log') {
        console.log(chalk.gray(`📝 LOG: ${text}`))
      }
    })
    
    // Listen for page errors (uncaught exceptions)
    page.on('pageerror', error => {
      const errorEntry = {
        type: 'pageerror',
        text: error.toString(),
        stack: error.stack,
        timestamp: new Date().toISOString()
      }
      errors.push(errorEntry)
      console.log(chalk.red('💥 PAGE ERROR:'), error.toString())
      if (error.stack) {
        console.log(chalk.red(error.stack))
      }
    })
    
    // Listen for request failures
    page.on('requestfailed', request => {
      const failure = {
        type: 'requestfailed',
        url: request.url(),
        method: request.method(),
        error: request.failure().errorText,
        timestamp: new Date().toISOString()
      }
      errors.push(failure)
      console.log(chalk.red(`🚫 REQUEST FAILED: ${request.method()} ${request.url()}`))
      console.log(chalk.red(`   Error: ${request.failure().errorText}`))
    })
    
    // Listen for response errors
    page.on('response', response => {
      if (!response.ok() && response.status() >= 400) {
        console.log(chalk.yellow(`⚠️  HTTP ${response.status()}: ${response.url()}`))
      }
    })
    
    console.log(chalk.cyan('\n📡 Navigating to world...\n'))
    
    // Navigate and wait for initial load
    try {
      await page.goto(WORLD_URL, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      })
    } catch (navError) {
      console.log(chalk.red('❌ Navigation error:'), navError.message)
    }
    
    // Wait a bit more to catch any delayed errors
    console.log(chalk.cyan('\n⏳ Waiting for additional errors...\n'))
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Check page content
    const bodyHTML = await page.evaluate(() => document.body.innerHTML)
    const hasCanvas = await page.evaluate(() => !!document.querySelector('canvas'))
    const documentTitle = await page.evaluate(() => document.title)
    
    console.log(chalk.cyan('\n📊 Page Analysis:'))
    console.log(chalk.gray(`- Title: ${documentTitle}`))
    console.log(chalk.gray(`- Has Canvas: ${hasCanvas}`))
    console.log(chalk.gray(`- Body HTML Length: ${bodyHTML.length} chars`))
    
    // Check for specific error indicators
    const hasErrorOverlay = await page.evaluate(() => {
      const overlays = document.querySelectorAll('[data-error], .error-overlay, #error-root')
      return overlays.length > 0
    })
    
    if (hasErrorOverlay) {
      console.log(chalk.red('❌ Error overlay detected on page'))
    }
    
    // Summary
    console.log(chalk.cyan('\n📈 Summary:'))
    console.log(chalk.gray(`- Total console messages: ${messages.length}`))
    console.log(chalk.red(`- Total errors: ${errors.length}`))
    
    if (errors.length > 0) {
      console.log(chalk.red('\n❌ Error Details:'))
      errors.forEach((error, index) => {
        console.log(chalk.red(`\nError ${index + 1}:`))
        console.log(JSON.stringify(error, null, 2))
      })
    }
    
    // Save to file for analysis
    const report = {
      url: WORLD_URL,
      timestamp: new Date().toISOString(),
      documentTitle,
      hasCanvas,
      hasErrorOverlay,
      bodyLength: bodyHTML.length,
      messages,
      errors,
      summary: {
        totalMessages: messages.length,
        totalErrors: errors.length,
        errorTypes: errors.reduce((acc, err) => {
          acc[err.type] = (acc[err.type] || 0) + 1
          return acc
        }, {})
      }
    }
    
    const fs = await import('fs')
    const reportPath = '/Users/shawwalters/hyperscape/packages/hyperfy/browser-error-report.json'
    await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2))
    console.log(chalk.green(`\n✅ Report saved to: ${reportPath}`))
    
    // Keep browser open for manual inspection
    console.log(chalk.cyan('\n🔍 Browser kept open for inspection. Press Ctrl+C to exit.'))
    
  } catch (error) {
    console.error(chalk.red('Script error:'), error)
    await browser.close()
    process.exit(1)
  }
}

// Run the capture
captureErrors().catch(error => {
  console.error(chalk.red('Fatal error:'), error)
  process.exit(1)
})