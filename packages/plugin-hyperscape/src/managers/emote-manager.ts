import type { IAgentRuntime } from '@elizaos/core'
import { Player, PlayerLocal, ClientNetwork } from '@hyperscape/shared'
import { promises as fsPromises } from 'fs'
import path from 'path'
import { NETWORK_CONFIG } from '../config/constants'
import { EMOTES_LIST } from '../constants'
import { HyperscapeService } from '../service'
import { getModuleDirectory, hashFileBuffer } from '../utils'
// import { playerEmotes, emoteMap } from '../hyperscape/core/extras/playerEmotes'
const playerEmotes: Record<string, unknown> = {}
const emoteMap: Record<string, string> = {}

const logger = {
  info: console.info,
  error: console.error,
  warn: console.warn,
  debug: console.debug,
}

export class EmoteManager {
  private emoteHashMap: Map<string, string>
  private currentEmoteTimeout: NodeJS.Timeout | null
  private movementCheckInterval: NodeJS.Timeout | null = null
  private runtime: IAgentRuntime

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime
    this.emoteHashMap = new Map()
    this.currentEmoteTimeout = null
  }

  async uploadEmotes() {
    for (const emote of EMOTES_LIST) {
      try {
        const moduleDirPath = getModuleDirectory()
        const emoteBuffer = await fsPromises.readFile(
          moduleDirPath + emote.path
        )
        const emoteMimeType = 'model/gltf-binary'

        const emoteHash = await hashFileBuffer(emoteBuffer)
        const emoteExt = emote.path.split('.').pop()?.toLowerCase() || 'glb'
        const emoteFullName = `${emoteHash}.${emoteExt}`
        const emoteUrl = `asset://${emoteFullName}`

        console.info(
          `[Appearance] Uploading emote '${emote.name}' as ${emoteFullName} (${(emoteBuffer.length / 1024).toFixed(2)} KB)`
        )

        const emoteArrayBuffer = emoteBuffer.buffer.slice(
          emoteBuffer.byteOffset,
          emoteBuffer.byteOffset + emoteBuffer.byteLength
        ) as ArrayBuffer
        const emoteFile = new File(
          [emoteArrayBuffer],
          path.basename(emote.path),
          {
            type: emoteMimeType,
          }
        )

        const service = this.getService()
        if (!service) {
          console.error(
            `[Appearance] Failed to upload emote '${emote.name}': Service not available`
          )
          continue
        }
        const world = service.getWorld()
        if (!world) {
          console.error(
            `[Appearance] Failed to upload emote '${emote.name}': World not available`
          )
          continue
        }
        const network = world.network as ClientNetwork
        if (!network.upload) {
          console.error(
            `[Appearance] Upload function not available for emote '${emote.name}'`
          )
          continue
        }

        const emoteUploadPromise = network.upload(emoteFile)
        const emoteTimeout = new Promise((_resolve, reject) =>
          setTimeout(
            () => reject(new Error('Upload timed out')),
            NETWORK_CONFIG.UPLOAD_TIMEOUT_MS
          )
        )

        await Promise.race([emoteUploadPromise, emoteTimeout])

        this.emoteHashMap.set(emote.name, emoteFullName)
        console.info(`[Appearance] Emote '${emote.name}' uploaded: ${emoteUrl}`)
      } catch (err) {
        console.error(
          `[Appearance] Failed to upload emote '${emote.name}': ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : ''
        )
      }
    }
  }

  async playEmote(emoteName: string): Promise<void> {
    const service = this.getService()
    if (!service) {
      console.error(
        'HyperscapeService: Cannot play emote. Service not available.'
      )
      return
    }
    const world = service.getWorld()
    if (!service.isConnected() || !world?.entities?.player) {
      console.error('HyperscapeService: Cannot play emote. Not ready.')
      return
    }

    const agentPlayer = world.entities.player as Player | undefined
    if (!agentPlayer) return

    // Ensure effect object exists with emote property
    const playerData = (agentPlayer as any).data
    if (!playerData) {
      ;(agentPlayer as any).data = { effect: { emote: emoteName } }
    } else if (!playerData.effect) {
      playerData.effect = { emote: emoteName }
    } else {
      playerData.effect.emote = emoteName
    }

    console.info(`[Emote] Playing '${emoteName}'`)

    this.clearTimers()

    // Get duration from EMOTES_LIST
    const emoteMeta = EMOTES_LIST.find(e => e.name === emoteName)
    const duration = emoteMeta?.duration || 1.5

    this.movementCheckInterval = setInterval(() => {
      const player = agentPlayer as unknown as PlayerLocal
      if (player.moving) {
        logger.info(
          `[EmoteManager] '${emoteName}' cancelled early due to movement`
        )
        this.clearEmote(agentPlayer)
      }
    }, 100)

    this.currentEmoteTimeout = setTimeout(() => {
      const data = (agentPlayer as any).data
      if (data?.effect && data.effect.emote === emoteName) {
        logger.info(`[EmoteManager] '${emoteName}' finished after ${duration}s`)
        this.clearEmote(agentPlayer)
      }
    }, duration * 1000)
  }

  private clearEmote(player: Player) {
    const data = (player as any).data as { effect?: { emote?: string | null } }
    if (data?.effect) {
      data.effect.emote = null
    }
    this.clearTimers()
  }

  private clearTimers() {
    if (this.currentEmoteTimeout) {
      clearTimeout(this.currentEmoteTimeout)
      this.currentEmoteTimeout = null
    }
    if (this.movementCheckInterval) {
      clearInterval(this.movementCheckInterval)
      this.movementCheckInterval = null
    }
  }

  private getService() {
    return this.runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName
    )
  }
}
