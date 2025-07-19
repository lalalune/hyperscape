import { spawn, ChildProcess } from 'child_process'
import { promises as fs } from 'fs'
import fetch from 'node-fetch'

export interface SimpleServerConfig {
  port: number
  timeout: number
  healthCheckInterval: number
  maxRetries: number
}

export interface SimpleServerStatus {
  running: boolean
  port: number
  pid?: number
  startTime?: number
  logs: string[]
}

export class SimpleServerManager {
  private servers = new Map<number, ChildProcess>()
  private serverLogs = new Map<number, string[]>()

  constructor(private defaultConfig: Partial<SimpleServerConfig> = {}) {}

  async startServer(config: Partial<SimpleServerConfig> = {}): Promise<SimpleServerStatus> {
    const fullConfig: SimpleServerConfig = {
      port: 3001,
      timeout: 15000,
      healthCheckInterval: 500,
      maxRetries: 30,
      ...this.defaultConfig,
      ...config
    }

    console.log(`[SimpleServerManager] Starting test server on port ${fullConfig.port}...`)

    // Check if port is already in use
    if (await this.isPortInUse(fullConfig.port)) {
      await this.killProcessOnPort(fullConfig.port)
      await this.wait(1000)
    }

    // Start the simple server process
    const serverProcess = spawn('node', ['test-server.js'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: fullConfig.port.toString()
      }
    })

    if (!serverProcess.pid) {
      throw new Error('Failed to start server process')
    }

    // Set up logging
    const logs: string[] = []
    this.serverLogs.set(fullConfig.port, logs)

    serverProcess.stdout?.on('data', (data) => {
      const message = data.toString().trim()
      logs.push(`[STDOUT] ${message}`)
      console.log(`[TestServer:${fullConfig.port}] ${message}`)
    })

    serverProcess.stderr?.on('data', (data) => {
      const message = data.toString().trim()
      logs.push(`[STDERR] ${message}`)
      console.error(`[TestServer:${fullConfig.port}] ${message}`)
    })

    serverProcess.on('exit', (code) => {
      logs.push(`[EXIT] Server exited with code ${code}`)
      console.log(`[TestServer:${fullConfig.port}] Exited with code ${code}`)
      this.servers.delete(fullConfig.port)
    })

    // Store process reference
    this.servers.set(fullConfig.port, serverProcess)

    // Wait for server to be ready
    console.log(`[SimpleServerManager] Waiting for server to be ready...`)
    const startTime = Date.now()
    let retries = 0

    while (retries < fullConfig.maxRetries) {
      if (Date.now() - startTime > fullConfig.timeout) {
        this.killServer(fullConfig.port)
        throw new Error(`Server start timeout after ${fullConfig.timeout}ms`)
      }

      try {
        const isReady = await this.checkServerHealth(fullConfig.port)
        if (isReady) {
          console.log(`[SimpleServerManager] Server ready on port ${fullConfig.port} after ${Date.now() - startTime}ms`)
          return {
            running: true,
            port: fullConfig.port,
            pid: serverProcess.pid,
            startTime,
            logs: [...logs]
          }
        }
      } catch (error) {
        // Server not ready yet, continue waiting
      }

      await this.wait(fullConfig.healthCheckInterval)
      retries++
    }

    // If we get here, server failed to start
    this.killServer(fullConfig.port)
    throw new Error(`Server failed to become ready after ${retries} retries`)
  }

  async checkServerHealth(port: number): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${port}/test-empty`, {
        method: 'HEAD',
        timeout: 3000
      })
      return response.status < 500
    } catch (error) {
      return false
    }
  }

  async killServer(port: number): Promise<void> {
    const process = this.servers.get(port)
    if (process && !process.killed) {
      console.log(`[SimpleServerManager] Killing server on port ${port}...`)
      process.kill('SIGTERM')
      
      // Give it a moment to clean up
      await this.wait(1000)
      
      if (!process.killed) {
        console.log(`[SimpleServerManager] Force killing server on port ${port}...`)
        process.kill('SIGKILL')
      }
    }

    // Also try to kill any process using the port
    await this.killProcessOnPort(port)
    
    this.servers.delete(port)
    this.serverLogs.delete(port)
  }

  async killProcessOnPort(port: number): Promise<void> {
    try {
      const { spawn } = await import('child_process')
      
      // Find process using port
      const lsof = spawn('lsof', ['-ti', `:${port}`])
      let output = ''
      
      lsof.stdout?.on('data', (data) => {
        output += data.toString()
      })

      await new Promise((resolve) => {
        lsof.on('exit', resolve)
      })

      const pids = output.trim().split('\n').filter(Boolean)
      
      // Kill each process
      for (const pid of pids) {
        try {
          process.kill(parseInt(pid), 'SIGTERM')
          console.log(`[SimpleServerManager] Killed process ${pid} on port ${port}`)
        } catch (error) {
          // Process might already be dead
        }
      }
    } catch (error) {
      // lsof might not be available or port might not be in use
    }
  }

  async isPortInUse(port: number): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${port}`, {
        method: 'HEAD',
        timeout: 2000
      })
      return true // If we get any response, port is in use
    } catch (error) {
      return false // Connection refused means port is free
    }
  }

  getServerStatus(port: number): SimpleServerStatus {
    const process = this.servers.get(port)
    const logs = this.serverLogs.get(port) || []
    
    return {
      running: process ? !process.killed : false,
      port,
      pid: process?.pid,
      logs: [...logs]
    }
  }

  async killAllServers(): Promise<void> {
    console.log('[SimpleServerManager] Killing all servers...')
    const ports = Array.from(this.servers.keys())
    
    for (const port of ports) {
      await this.killServer(port)
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}