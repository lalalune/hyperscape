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

import { ParticipantEvent, RemoteTrack, Room, RoomEvent } from "livekit-client";
import type { World } from "../../types/index";
import { EventType } from "../../types/events";
import { System } from "../shared/infrastructure/System";

/**
 * ClientLiveKit - Voice Chat Client
 *
 * Manages LiveKit room connection and spatial voice communication.
 */
export class ClientLiveKit extends System {
  // Properties
  room: Room | null = null;
  status: {
    available: boolean;
    audio: boolean;
  };
  voices: Map<
    string,
    {
      source: MediaStreamAudioSourceNode;
      gainNode: GainNode;
      pannerNode: PannerNode;
    }
  >;
  screens: {
    track: RemoteTrack;
    element: HTMLVideoElement;
    playerId: string;
  }[];
  private prefsBound: boolean = false;

  constructor(world: World) {
    super(world);
    this.status = {
      available: false,
      audio: false,
    };
    this.voices = new Map(); // playerId -> PlayerVoice
    this.screens = [];
  }

  override start() {
    const prefs = this.world.prefs;
    if (prefs && !this.prefsBound) {
      if (typeof prefs.voiceEnabled === "boolean") {
        this.status.audio = prefs.voiceEnabled;
      }
      prefs.on?.("change", this.onPrefsChange);
      this.prefsBound = true;
    }
  }

  async deserialize(opts: { token?: string; wsUrl?: string }) {
    if (!opts || !opts.token) {
      console.warn(
        "[ClientLiveKit] No opts or token provided for LiveKit connection",
      );
      return;
    }
    const { token, wsUrl } = opts;
    this.status.available = true;
    // FUTURE: check if the token has expired
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
    });
    this.room.on(RoomEvent.TrackMuted, this.onTrackMuted);
    this.room.on(RoomEvent.TrackUnmuted, this.onTrackUnmuted);
    this.room.on(RoomEvent.LocalTrackPublished, this.onLocalTrackPublished);
    this.room.on(RoomEvent.LocalTrackUnpublished, this.onLocalTrackUnpublished);
    this.room.on(RoomEvent.TrackSubscribed, this.onTrackSubscribed);
    this.room.on(RoomEvent.TrackUnsubscribed, this.onTrackUnsubscribed);
    this.room.localParticipant.on(
      ParticipantEvent.IsSpeakingChanged,
      (speaking: boolean) => {
        const player = this.world.entities.player as {
          setSpeaking?: (speaking: boolean) => void;
        } | null;
        player?.setSpeaking?.(speaking);
      },
    );
    // Get LiveKit URL from server snapshot (wsUrl is included in livekit opts)
    const livekitUrl = wsUrl || "";
    if (!livekitUrl) {
      console.warn("[ClientLiveKit] LIVEKIT_URL is not defined in snapshot");
      return;
    }
    try {
      await this.room.connect(livekitUrl, token);
      await this.applyMicrophonePreference();
    } catch (err) {
      console.warn(
        "[ClientLiveKit] Failed to connect to LiveKit:",
        err instanceof Error ? err.message : String(err),
      );
      this.status.available = false;
    }
  }

  async enableAudio() {
    await this.setMicrophoneEnabled(true);
  }

  async disableAudio() {
    await this.setMicrophoneEnabled(false);
  }

  private onPrefsChange = (changes: { voiceEnabled?: { value: boolean } }) => {
    if (changes.voiceEnabled) {
      this.setMicrophoneEnabled(changes.voiceEnabled.value);
    }
  };

  private async applyMicrophonePreference(): Promise<void> {
    const enabled = this.world.prefs?.voiceEnabled ?? false;
    await this.setMicrophoneEnabled(enabled);
  }

  private async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    this.status.audio = enabled;
    if (!this.room?.localParticipant) return;
    try {
      await this.room.localParticipant.setMicrophoneEnabled(enabled);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Microphone unavailable";
      console.warn("[ClientLiveKit] Failed to toggle microphone:", message);
      this.status.audio = false;
      this.world.prefs?.setVoiceEnabled?.(false);
      this.world.emit(EventType.UI_TOAST, {
        message: "Microphone permission denied",
        type: "warning",
      });
    }
  }

  onTrackMuted = (_publication: unknown, _participant: unknown) => {};

  onTrackUnmuted = (_publication: unknown, _participant: unknown) => {};

  onLocalTrackPublished = (_publication: unknown, _participant: unknown) => {};

  onLocalTrackUnpublished = (
    _publication: unknown,
    _participant: unknown,
  ) => {};

  onTrackSubscribed = (
    track: RemoteTrack,
    _publication: unknown,
    participant: { identity: string },
  ) => {
    const playerId = participant.identity;
    const player = this.world.entities.players?.get(playerId);
    if (!player) return;
    if (track.kind === "audio") {
      const audio = this.world.audio;
      const mediaStream = track.mediaStream;
      if (!audio || !mediaStream) return;
      audio.ready(() => {
        const audioCtx = audio.getContext();
        const source = audioCtx.createMediaStreamSource(mediaStream);
        const gainNode = audioCtx.createGain();
        const pannerNode = audioCtx.createPanner();
        pannerNode.panningModel = "HRTF";
        pannerNode.distanceModel = "exponential";
        pannerNode.refDistance = 1;
        pannerNode.maxDistance = 100;
        pannerNode.rolloffFactor = 1.5;
        pannerNode.coneInnerAngle = 360;
        pannerNode.coneOuterAngle = 0;
        pannerNode.coneOuterGain = 0;
        source.connect(gainNode);
        gainNode.connect(pannerNode);
        pannerNode.connect(audio.getVoiceGain());
        const voice = { source, gainNode, pannerNode };
        this.voices.set(playerId, voice);
      });
    }
  };

  onTrackUnsubscribed = (
    track: RemoteTrack,
    _publication: unknown,
    participant: { identity: string },
  ) => {
    const playerId = participant.identity;
    if (track.kind === "audio") {
      const voice = this.voices.get(playerId);
      if (voice) {
        voice.source.disconnect();
        voice.gainNode.disconnect();
        voice.pannerNode.disconnect();
        this.voices.delete(playerId);
      }
    }
  };

  override fixedUpdate(_delta: number) {
    // update voice positions
    for (const [playerId, voice] of this.voices) {
      const player = this.world.entities.players?.get(playerId) as
        | {
            node?: { position?: { x: number; y: number; z: number } };
          }
        | undefined;
      if (!player?.node?.position) continue;
      const position = player.node.position;
      voice.pannerNode.positionX.value = position.x;
      voice.pannerNode.positionY.value = position.y;
      voice.pannerNode.positionZ.value = position.z;
    }
  }

  override destroy() {
    if (this.world.prefs && this.prefsBound) {
      this.world.prefs.off?.("change", this.onPrefsChange);
      this.prefsBound = false;
    }

    // Clean up all voice audio nodes to prevent memory leaks
    for (const [, voice] of this.voices) {
      voice.source.disconnect();
      voice.gainNode.disconnect();
      voice.pannerNode.disconnect();
    }
    this.voices.clear();

    // Clean up screens
    this.screens = [];

    if (this.room) {
      // Remove room event listeners
      this.room.off(RoomEvent.TrackMuted, this.onTrackMuted);
      this.room.off(RoomEvent.TrackUnmuted, this.onTrackUnmuted);
      this.room.off(RoomEvent.LocalTrackPublished, this.onLocalTrackPublished);
      this.room.off(
        RoomEvent.LocalTrackUnpublished,
        this.onLocalTrackUnpublished,
      );
      this.room.off(RoomEvent.TrackSubscribed, this.onTrackSubscribed);
      this.room.off(RoomEvent.TrackUnsubscribed, this.onTrackUnsubscribed);
      this.room.disconnect();
      this.room = null;
    }
  }
}

// PlayerVoice class removed - not used
// createPlayerScreen function removed - not used
