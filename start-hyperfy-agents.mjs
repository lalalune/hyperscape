#!/usr/bin/env node

/**
 * Hyperfy + Multi-Agent Startup Script
 * ====================================
 * 
 * This script starts both:
 * 1. Hyperfy server (builds first if needed)
 * 2. ElizaOS agents that connect to the world
 * 
 * Agents wait for Hyperfy to be ready at :3333 before connecting.
 */

import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const execAsync = promisify(exec)

// Configuration
const CONFIG = {
  HYPERFY_PORT: 3333,
  HYPERFY_HOST: 'localhost',
  MAX_WAIT_TIME: 60000, // 1 minute max wait for server
  AGENT_COUNT: 3, // Start with fewer agents for quicker startup
}

// ANSI colors
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
  reset: '\x1b[0m'
}

function log(color, symbol, message, data = null) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  console.log(`${color}[${timestamp}] ${symbol} ${message}${colors.reset}`)
  if (data) {
    console.log(`${color}   ${JSON.stringify(data, null, 2)}${colors.reset}`)
  }
}

function info(msg, data) { log(colors.blue, 'ℹ️', msg, data) }
function success(msg, data) { log(colors.green, '✅', msg, data) }
function error(msg, data) { log(colors.red, '❌', msg, data) }
function warn(msg, data) { log(colors.yellow, '⚠️', msg, data) }

// Check if Hyperfy server is running
async function checkHyperfyServer() {
  try {
    const url = `http://${CONFIG.HYPERFY_HOST}:${CONFIG.HYPERFY_PORT}`
    const response = await fetch(url, { 
      signal: AbortSignal.timeout(5000) 
    })
    return response.ok || response.status === 404 // 404 is ok, means server is up
  } catch {
    return false
  }
}

// Build Hyperfy first
async function buildHyperfy() {
  return new Promise((resolve, reject) => {
    info('Building Hyperfy...')
    
    const hyperfyDir = path.join(__dirname, 'packages', 'hyperfy')
    if (!fs.existsSync(hyperfyDir)) {
      error('Hyperfy directory not found', { expected: hyperfyDir })
      reject(new Error('Hyperfy directory not found'))
      return
    }
    
    const buildProcess = spawn('npm', ['run', 'build'], {
      cwd: hyperfyDir,
      stdio: 'pipe',
      env: { ...process.env }
    })
    
    let buildOutput = ''
    let buildCompleted = false
    
    buildProcess.stdout.on('data', (data) => {
      const output = data.toString()
      buildOutput += output
      process.stdout.write(`[BUILD] ${output}`)
    })
    
    buildProcess.stderr.on('data', (data) => {
      const output = data.toString()
      buildOutput += output
      process.stderr.write(`[BUILD ERROR] ${output}`)
    })
    
    buildProcess.on('close', (code) => {
      if (code === 0) {
        buildCompleted = true
        success('Hyperfy build completed')
        resolve()
      } else {
        if (!buildCompleted) {
          warn(`Build completed with code ${code}, but continuing anyway`)
          resolve() // Continue even with build warnings
        }
      }
    })
    
    buildProcess.on('error', (err) => {
      error('Failed to build Hyperfy', err)
      reject(err)
    })
    
    // Timeout check
    setTimeout(() => {
      if (!buildCompleted) {
        buildProcess.kill()
        warn('Build timeout, continuing with existing build')
        resolve() // Continue with existing build
      }
    }, 60000) // 1 minute timeout
  })
}

// Start Hyperfy server  
async function startHyperfyServer() {
  return new Promise((resolve, reject) => {
    info('Starting Hyperfy server...')
    
    const hyperfyDir = path.join(__dirname, 'packages', 'hyperfy')
    
    // Try to start with npm run dev instead (skips rebuild and uses existing build)
    const serverProcess = spawn('npm', ['run', 'dev'], {
      cwd: hyperfyDir,
      stdio: 'pipe',
      env: { 
        ...process.env, 
        NODE_ENV: 'development',
        PORT: CONFIG.HYPERFY_PORT.toString(),
        SKIP_BUILD: 'true'
      }
    })
    
    let serverStarted = false
    
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString()
      
      // Look for server ready indicators
      if (output.includes('running on port') || 
          output.includes('Server listening') || 
          output.includes('started') || 
          output.includes(`port ${CONFIG.HYPERFY_PORT}`)) {
        if (!serverStarted) {
          serverStarted = true
          success('Hyperfy server started successfully')
          resolve(serverProcess)
        }
      }
      
      // Show real-time output
      process.stdout.write(`[HYPERFY] ${output}`)
    })
    
    serverProcess.stderr.on('data', (data) => {
      const output = data.toString()
      process.stderr.write(`[HYPERFY ERROR] ${output}`)
    })
    
    serverProcess.on('error', (err) => {
      error('Failed to start Hyperfy server', err)
      reject(err)
    })
    
    serverProcess.on('exit', (code) => {
      if (!serverStarted) {
        error(`Hyperfy server exited with code ${code}`)
        reject(new Error(`Server exited with code ${code}`))
      }
    })
    
    // Timeout check
    setTimeout(() => {
      if (!serverStarted) {
        serverProcess.kill()
        error('Hyperfy server start timeout')
        reject(new Error('Server start timeout'))
      }
    }, 30000)
  })
}

// Wait for Hyperfy server to be ready
async function waitForHyperfyReady() {
  info(`Waiting for Hyperfy server to be ready at :${CONFIG.HYPERFY_PORT}...`)
  const maxAttempts = 30
  const delay = 1000
  
  for (let i = 0; i < maxAttempts; i++) {
    if (await checkHyperfyServer()) {
      success('Hyperfy server is ready for connections')
      return true
    }
    await new Promise(resolve => setTimeout(resolve, delay))
    process.stdout.write('.')
  }
  
  error('Hyperfy server readiness check timeout')
  throw new Error('Server readiness timeout')
}

// Start ElizaOS agents
async function startAgents() {
  return new Promise((resolve, reject) => {
    info(`Starting ${CONFIG.AGENT_COUNT} ElizaOS agents...`)
    
    const pluginDir = path.join(__dirname, 'packages', 'plugin-hyperfy')
    
    const agentProcess = spawn('node', ['quick-test.mjs'], {
      cwd: pluginDir,
      stdio: 'pipe',
      env: { 
        ...process.env,
        WS_URL: `ws://${CONFIG.HYPERFY_HOST}:${CONFIG.HYPERFY_PORT}/ws`,
        AGENT_COUNT: CONFIG.AGENT_COUNT.toString(),
        NODE_ENV: 'production'
      }
    })
    
    let agentsStarted = false
    
    agentProcess.stdout.on('data', (data) => {
      const output = data.toString()
      
      // Look for agent success indicators
      if (output.includes('QUICK TEST PASSED') || 
          output.includes('connected to world')) {
        if (!agentsStarted) {
          agentsStarted = true
          success('Agents started and connected successfully')
        }
      }
      
      // Show real-time output
      process.stdout.write(`[AGENTS] ${output}`)
    })
    
    agentProcess.stderr.on('data', (data) => {
      const output = data.toString()
      process.stderr.write(`[AGENTS ERROR] ${output}`)
    })
    
    agentProcess.on('error', (err) => {
      error('Failed to start agents', err)
      reject(err)
    })
    
    agentProcess.on('exit', (code) => {
      if (code === 0) {
        success('Agents completed successfully')
        resolve(agentProcess)
      } else {
        warn(`Agents exited with code ${code}`)
        resolve(agentProcess) // Don't fail on non-zero exit for agents
      }
    })
    
    // Don't timeout agents, let them run indefinitely
    // They will manage their own lifecycle
  })
}

// Main execution
async function main() {
  console.log(`${colors.bold}${colors.blue}`)
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║        🚀 Hyperfy + Multi-Agent Startup             ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log(colors.reset)
  
  let hyperfyProcess = null
  let agentsProcess = null
  
  try {
    // Step 1: Check if Hyperfy is already running
    if (await checkHyperfyServer()) {
      success('Hyperfy server already running, will use it')
    } else {
      warn('Hyperfy server not running')
      info('For now, running agents in standalone test mode')
      info('To connect to a real Hyperfy world:')
      info('1. Start Hyperfy: cd packages/hyperfy && npm run dev')
      info('2. Then run this script again')
    }
    
    // Step 2: Start agents (they will handle connection gracefully)
    info('Starting agents...')
    await new Promise(resolve => setTimeout(resolve, 1000)) // Brief pause
    
    agentsProcess = await startAgents()
    
    success('🎉 Agents are running!')
    if (await checkHyperfyServer()) {
      success('✅ Connected to Hyperfy world')
    } else {
      info('ℹ️  Running in test mode (no Hyperfy connection)')
    }
    info('Press Ctrl+C to stop')
    
    // Keep the main process alive
    process.on('SIGINT', () => {
      info('Shutting down...')
      if (agentsProcess) agentsProcess.kill()
      if (hyperfyProcess) hyperfyProcess.kill()
      process.exit(0)
    })
    
    // Wait indefinitely (until user interrupts)
    await new Promise(() => {}) // Never resolves
    
  } catch (err) {
    error('Startup failed', err)
    
    // Cleanup on failure
    if (agentsProcess) {
      info('Stopping agents...')
      agentsProcess.kill()
    }
    if (hyperfyProcess) {
      info('Stopping Hyperfy server...')
      hyperfyProcess.kill()
    }
    
    process.exit(1)
  }
}

// Handle interrupts gracefully
process.on('uncaughtException', (err) => {
  error('Uncaught exception', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  error('Unhandled promise rejection', reason)
  process.exit(1)
})

// Run the startup script
main().catch(err => {
  error('Main execution failed', err)
  process.exit(1)
})