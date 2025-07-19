import { spawn, ChildProcess } from 'child_process'
import { promises as fs } from 'fs'
import fetch from 'node-fetch'

export interface ServerConfig {
  port: number
  hyperfyPath: string
  worldPath?: string
  timeout: number
  healthCheckInterval: number
  maxRetries: number
}

export interface ServerStatus {
  running: boolean
  port: number
  pid?: number
  startTime?: number
  logs: string[]
}

export class HyperfyServerManager {
  private servers = new Map<number, ChildProcess>()
  private serverLogs = new Map<number, string[]>()

  constructor(private defaultConfig: Partial<ServerConfig> = {}) {}

  async startServer(config: Partial<ServerConfig> = {}): Promise<ServerStatus> {
    const fullConfig: ServerConfig = {
      port: 3000,
      hyperfyPath: '../hyperfy',
      worldPath: 'world',
      timeout: 30000,
      healthCheckInterval: 1000,
      maxRetries: 30,
      ...this.defaultConfig,
      ...config
    }

    console.log(`[ServerManager] Starting Hyperfy server on port ${fullConfig.port}...`)

    // Check if port is already in use
    if (await this.isPortInUse(fullConfig.port)) {
      // Try to kill existing process
      await this.killProcessOnPort(fullConfig.port)
      await this.wait(2000) // Wait for cleanup
    }

    // Start the server process
    const serverProcess = spawn('npm', ['run', 'dev'], {
      cwd: fullConfig.hyperfyPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: fullConfig.port.toString(),
        WORLD: fullConfig.worldPath || 'world'
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
      console.log(`[Server:${fullConfig.port}] ${message}`)
    })

    serverProcess.stderr?.on('data', (data) => {
      const message = data.toString().trim()
      logs.push(`[STDERR] ${message}`)
      console.error(`[Server:${fullConfig.port}] ${message}`)
    })

    serverProcess.on('exit', (code) => {
      logs.push(`[EXIT] Server exited with code ${code}`)
      console.log(`[Server:${fullConfig.port}] Exited with code ${code}`)
      this.servers.delete(fullConfig.port)
    })

    // Store process reference
    this.servers.set(fullConfig.port, serverProcess)

    // Wait for server to be ready
    console.log(`[ServerManager] Waiting for server to be ready...`)
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
          console.log(`[ServerManager] Server ready on port ${fullConfig.port} after ${Date.now() - startTime}ms`)
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
      const response = await fetch(`http://localhost:${port}`, {
        method: 'HEAD',
        timeout: 5000
      })
      return response.status < 500
    } catch (error) {
      return false
    }
  }

  async killServer(port: number): Promise<void> {
    const process = this.servers.get(port)
    if (process && !process.killed) {
      console.log(`[ServerManager] Killing server on port ${port}...`)
      process.kill('SIGTERM')
      
      // Give it a moment to clean up
      await this.wait(2000)
      
      if (!process.killed) {
        console.log(`[ServerManager] Force killing server on port ${port}...`)
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
          console.log(`[ServerManager] Killed process ${pid} on port ${port}`)
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

  getServerStatus(port: number): ServerStatus {
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
    console.log('[ServerManager] Killing all servers...')
    const ports = Array.from(this.servers.keys())
    
    for (const port of ports) {
      await this.killServer(port)
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Create a test world with specific entities
  async createTestWorld(port: number, entities: Array<{ type: string; position: { x: number; y: number; z: number }; color: string }>): Promise<void> {
    try {
      // This would integrate with Hyperfy's world creation API
      // For now, we'll create the world configuration
      const worldConfig = {
        entities: entities.map(entity => ({
          ...entity,
          userData: {
            testType: entity.type,
            testColor: entity.color
          }
        }))
      }

      // In a real implementation, this would call Hyperfy APIs to spawn entities
      console.log(`[ServerManager] Would create test world with ${entities.length} entities`)
      
      // Wait a moment for entities to spawn
      await this.wait(1000)
    } catch (error) {
      console.error(`[ServerManager] Failed to create test world:`, error)
      throw error
    }
  }
}