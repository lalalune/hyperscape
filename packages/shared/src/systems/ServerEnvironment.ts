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
    // Load initial environment model
    await this.updateModel()
  }

  async updateModel() {
    const modelSetting = this.world.settings?.model
    const url = typeof modelSetting === 'string' ? modelSetting : modelSetting?.url
    if (!url) return
    let glb = this.world.loader?.get('model', url)
    if (!glb) glb = (await this.world.loader?.load('model', url)) as LoaderResult | undefined
    if (!glb) return
    if (this.model) this.model.deactivate()
    
    // Create EnvironmentModel wrapper for the nodes
    if (glb && 'toNodes' in glb) {
      const nodes = glb.toNodes()
      this.model = {
        deactivate: () => {
          for (const node of nodes.values()) {
            if (node && node instanceof Node) {
              node.deactivate()
            }
          }
        },
        activate: (options: { world: World; label: string }) => {
          for (const node of nodes.values()) {
            if (node && node instanceof Node) {
              node.activate(options.world)
            }
          }
        }
      }
    } else {
      this.model = null
    }
    
    if (this.model) this.model.activate({ world: this.world, label: 'base' })
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
