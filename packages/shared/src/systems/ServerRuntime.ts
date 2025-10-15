import os from 'os'
import { System } from './System'
import type { World } from '../types'

// 30Hz tick rate for smooth, consistent gameplay
const TICK_RATE = 1 / 30
const TICK_INTERVAL_MS = TICK_RATE * 1000

/**
 * Server Runtime System
 * 
 * Manages the server-side game loop with precise timing and performance monitoring
 */
export class ServerRuntime extends System {
  private running = false
  private lastTickTime = 0
  private tickAccumulator = 0
  
  // Performance monitoring
  private lastStatsTime = 0
  private statsInterval = 1000 // Cache stats for 1 second
  private cachedStats: { maxMemory: number; currentMemory: number; maxCPU: number; currentCPU: number } | null = null
  
  constructor(world: World) {
    super(world)
  }

  start() {
    this.running = true
    this.lastTickTime = performance.now()
    this.scheduleTick()
  }

  private scheduleTick() {
    if (!this.running) return
    
    // Use setImmediate for more precise timing on server
    setImmediate(() => {
      const currentTime = performance.now()
      const deltaTime = currentTime - this.lastTickTime
      
      // Accumulate time and tick when enough has passed
      this.tickAccumulator += deltaTime
      
      if (this.tickAccumulator >= TICK_INTERVAL_MS) {
        // Perform the tick
        this.world.tick(currentTime)
        
        // Subtract the tick interval (keep remainder for precision)
        this.tickAccumulator -= TICK_INTERVAL_MS
        
        // Prevent accumulator from growing too large (cap at 2 ticks worth)
        if (this.tickAccumulator > TICK_INTERVAL_MS * 2) {
          this.tickAccumulator = TICK_INTERVAL_MS
        }
      }
      
      this.lastTickTime = currentTime
      
      // Schedule next check
      this.scheduleTick()
    })
  }

  /**
   * Get server performance stats with caching to avoid expensive CPU sampling
   */
  async getStats() {
    const now = Date.now()
    
    // Return cached stats if recent
    if (this.cachedStats && (now - this.lastStatsTime) < this.statsInterval) {
      return this.cachedStats
    }
    
    // Calculate new stats
    const memUsage = process.memoryUsage()
    const startCPU = process.cpuUsage()
    
    // Sample CPU over 100ms
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const endCPU = process.cpuUsage(startCPU)
    const cpuPercent = (endCPU.user + endCPU.system) / 1000 / 100
    
    this.cachedStats = {
      maxMemory: Math.round(os.totalmem() / 1024 / 1024),
      currentMemory: Math.round(memUsage.rss / 1024 / 1024),
      maxCPU: os.cpus().length * 100,
      currentCPU: cpuPercent,
    }
    
    this.lastStatsTime = now
    return this.cachedStats
  }

  destroy() {
    this.running = false
    this.cachedStats = null
  }
}
