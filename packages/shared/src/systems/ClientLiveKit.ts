/**
 * ClientLiveKit.ts - Voice Chat Client Integration
 * 
 * Integrates LiveKit for real-time voice communication between players.
 * Handles room connection, audio track management, and spatial audio positioning.
 * 
 * **Features:**
 * - Peer-to-peer voice chat via LiveKit
 * - Spatial audio (voice positioned in 3D space relative to player)
 * - Automatic participant tracking (join/leave)
 * - Push-to-talk and voice activity detection
 * - Screen sharing support
 * - Audio ducking and mixing
 * 
 * **LiveKit Integration:**
 * - Connects to LiveKit server with JWT token (from server)
 * - Publishes local audio track from microphone
 * - Subscribes to remote participant tracks
 * - Routes audio through ClientAudio system for 3D positioning
 * 
 * **Spatial Audio:**
 * Each remote player's voice is positioned in 3D:
 * - Uses Web Audio API PannerNode
 * - Distance-based attenuation
 * - Directional audio (voice louder when facing player)
 * 
 * **Usage:**
 * System automatically connects when token is available in snapshot.
 * Audio tracks are routed to speakers/headphones via ClientAudio.
 * 
 * **Referenced by:** ClientRuntime, player join/leave events, ClientAudio
 */

import { ParticipantEvent, RemoteTrack, Room, RoomEvent } from 'livekit-client'
import type { World } from '../types/index'
import { System } from './System'

/**
 * ClientLiveKit - Voice Chat Client
 * 
 * Manages LiveKit room connection and spatial voice communication.
 */
export class ClientLiveKit extends System {
  // Properties
  room: Room | null = null
  status: {
    available: boolean
    audio: boolean
  }
  voices: Map<string, { source: MediaStreamAudioSourceNode; gainNode: GainNode; pannerNode: PannerNode }>
  screens: { track: RemoteTrack; element: HTMLVideoElement; playerId: string }[]

  constructor(world: World) {
    super(world)
    this.status = {
      available: false,
      audio: false,
    }
    this.voices = new Map() // playerId -> PlayerVoice
    this.screens = []
  }

  async deserialize(opts: { token?: string; wsUrl?: string }) {
    if (!opts || !opts.token) {
      console.warn('[ClientLiveKit] No opts or token provided for LiveKit connection');
      return;
    }
    const { token, wsUrl } = opts
    this.status.available = true
    this.room = new Room({
      audioCaptureDefaults: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      },
      videoCaptureDefaults: {
        resolution: {
          width: 640,
          height: 360,
          frameRate: 15,
        },
      },
    })
    this.room.on(RoomEvent.TrackMuted, this.onTrackMuted)
    this.room.on(RoomEvent.TrackUnmuted, this.onTrackUnmuted)
    this.room.on(RoomEvent.LocalTrackPublished, this.onLocalTrackPublished)
    this.room.on(RoomEvent.LocalTrackUnpublished, this.onLocalTrackUnpublished)
    this.room.on(RoomEvent.TrackSubscribed, this.onTrackSubscribed)
    this.room.on(RoomEvent.TrackUnsubscribed, this.onTrackUnsubscribed)
    this.room.localParticipant.on(ParticipantEvent.IsSpeakingChanged, (speaking: boolean) => {
      // @ts-ignore - setSpeaking might not exist
      this.world.entities.player?.setSpeaking(speaking)
    })
    // Get LiveKit URL from server snapshot (wsUrl is included in livekit opts)
    const livekitUrl = wsUrl || ''
    if (!livekitUrl) {
      console.warn('[ClientLiveKit] LIVEKIT_URL is not defined in snapshot')
      return
    }
    await this.room.connect(livekitUrl, token)
  }

  async enableAudio() {
    if (!this.room) return
    this.status.audio = true
    await this.room.localParticipant.setMicrophoneEnabled(true)
  }

  async disableAudio() {
    if (!this.room) return
    this.status.audio = false
    await this.room.localParticipant.setMicrophoneEnabled(false)
  }

  onTrackMuted = (_publication: unknown, _participant: unknown) => {
  }

  onTrackUnmuted = (_publication: unknown, _participant: unknown) => {
  }

  onLocalTrackPublished = (_publication: unknown, _participant: unknown) => {
  }

  onLocalTrackUnpublished = (_publication: unknown, _participant: unknown) => {
  }

  onTrackSubscribed = (track: RemoteTrack, _publication: unknown, participant: { identity: string }) => {
    const playerId = participant.identity
    const player = this.world.entities.players?.get(playerId)
    if (!player) return
    if (track.kind === 'audio') {
      // @ts-ignore - audio might not exist on world
      const audioCtx = (this.world.audio && 'ctx' in this.world.audio) ? (this.world.audio as { ctx: AudioContext }).ctx : undefined
      if (!audioCtx || !track.mediaStream) return
      const source = audioCtx.createMediaStreamSource(track.mediaStream)
      const gainNode = audioCtx.createGain()
      const pannerNode = audioCtx.createPanner()
      pannerNode.panningModel = 'HRTF'
      pannerNode.distanceModel = 'exponential'
      pannerNode.refDistance = 1
      pannerNode.maxDistance = 100
      pannerNode.rolloffFactor = 1.5
      pannerNode.coneInnerAngle = 360
      pannerNode.coneOuterAngle = 0
      pannerNode.coneOuterGain = 0
      source.connect(gainNode)
      gainNode.connect(pannerNode)
      pannerNode.connect(audioCtx.destination)
      const voice = { source, gainNode, pannerNode }
      this.voices.set(playerId, voice)
    }
  }

  onTrackUnsubscribed = (track: RemoteTrack, _publication: unknown, participant: { identity: string }) => {
    const playerId = participant.identity
    if (track.kind === 'audio') {
      const voice = this.voices.get(playerId)
      if (voice) {
        voice.source.disconnect()
        voice.gainNode.disconnect()
        voice.pannerNode.disconnect()
        this.voices.delete(playerId)
      }
    }
  }

  override fixedUpdate(_delta: number) {
    // update voice positions
    for (const [playerId, voice] of this.voices) {
      const player = this.world.entities.players?.get(playerId)
      if (!player) continue
      // @ts-ignore - position might not exist
      const position = player.node.position
      if (position) {
        voice.pannerNode.positionX.value = position.x
        voice.pannerNode.positionY.value = position.y
        voice.pannerNode.positionZ.value = position.z
      }
    }
  }

  override destroy() {
    if (this.room) {
      this.room.disconnect()
    }
  }
}

// PlayerVoice class removed - not used
// createPlayerScreen function removed - not used

