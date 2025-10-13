/**
 * ServerLiveKit.ts - Voice Chat Server Integration
 * 
 * Generates LiveKit access tokens for players to join voice rooms.
 * Server-side component of the voice chat system.
 * 
 * **Responsibilities:**
 * - Generate JWT tokens for LiveKit room access
 * - Configure room permissions per player
 * - Manage voice room lifecycle
 * - Single room per world instance
 * 
 * **Environment Variables Required:**
 * - LIVEKIT_URL or LIVEKIT_WS_URL: LiveKit server WebSocket URL
 * - LIVEKIT_API_KEY: API key for token generation
 * - LIVEKIT_API_SECRET: Secret key for signing JWT tokens
 * 
 * **Token Contents:**
 * Each player receives a token with:
 * - Room name: Based on world ID
 * - Player identity: Player ID
 * - Permissions: canPublish (microphone) and canSubscribe (hear others)
 * - Track sources: Microphone and screen share
 * 
 * **Usage:**
 * ServerNetwork calls getPlayerOpts(playerId) to generate tokens.
 * Tokens are sent to client in the initial snapshot.
 * 
 * **Referenced by:** ServerNetwork (provides tokens during player connection)
 */

import { AccessToken, TrackSource } from 'livekit-server-sdk'

import { System } from './System'
import { uuid } from '../utils'
import { World } from '../World'

/**
 * ServerLiveKit - Voice Token Generator
 * 
 * Server-side LiveKit integration for generating voice room access tokens.
 */
export class ServerLiveKit extends System {
  private roomId: string
  private wsUrl: string | undefined
  private apiKey: string | undefined
  private apiSecret: string | undefined
  private enabled: boolean
  
  constructor(world: World) {
    super(world)
    this.roomId = uuid()
    this.wsUrl = process.env.LIVEKIT_URL || process.env.LIVEKIT_WS_URL
    this.apiKey = process.env.LIVEKIT_API_KEY
    this.apiSecret = process.env.LIVEKIT_API_SECRET
    this.enabled = !!(this.wsUrl && this.apiKey && this.apiSecret)
  }

  async getPlayerOpts(playerId: string) {
    if (!this.enabled || !this.apiKey || !this.apiSecret || !this.wsUrl) return null
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: playerId,
    })
    const videoGrant = {
      room: this.roomId,
      roomJoin: true,
      canSubscribe: true,
      canPublish: true,
      canPublishSources: [TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO],
      canUpdateOwnMetadata: true,
    }
    at.addGrant(videoGrant)
    const token = await at.toJwt()
    return {
      wsUrl: this.wsUrl,
      token,
    }
  }
}
