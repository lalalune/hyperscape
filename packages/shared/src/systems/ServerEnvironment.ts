import { System } from './System'
import { Node } from '../nodes/Node'
import type { World } from '../World'
import type { LoaderResult, EnvironmentModel } from '../types/index'

/**
 * Environment System
 *
 * - Runs on the server
 * - Sets up the environment model
 *
 */
export class ServerEnvironment extends System {
  private model: EnvironmentModel | null
  
  constructor(world: World) {
    super(world)
    this.model = null
  }

  async start() {
    this.world.settings?.on('change', this.onSettingsChange)
    // Skip model loading on server - server doesn't render, only tracks settings for clients
    console.log('[ServerEnvironment] Server-side environment - skipping 3D model loading')
  }

  async updateModel() {
    // Skip model loading on server - no rendering needed
    // Server only tracks environment settings for clients, doesn't load/render 3D models
    console.log('[ServerEnvironment] Server-side - skipping environment model loading')
  }

  onSettingsChange = (changes: Record<string, unknown>) => {
    if (changes.model) {
      this.updateModel()
    }
  }

  override destroy(): void {
    this.world.settings?.off('change', this.onSettingsChange)
    if (this.model) {
      try { this.model.deactivate() } catch {}
      this.model = null
    }
  }
}
