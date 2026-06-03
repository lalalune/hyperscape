/**
 * AgentLiveKit - Voice Chat for AI Agents
 *
 * Manages LiveKit room connection for AI agent voice communication.
 * This system enables agents to participate in voice chat with players.
 *
 * **Architecture:**
 * - Connects to LiveKit room using token from server
 * - Publishes synthesized speech (TTS output) as audio tracks
 * - Receives incoming voice tracks and emits audio events
 *
 * **Node.js Support:**
 * Uses @livekit/rtc-node for headless agent participants.
 *
 * **Referenced by:** VoiceManager, HyperiaService
 */

import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import {
  AudioFrame,
  AudioSource,
  LocalAudioTrack,
  Room,
  RoomEvent,
  TrackKind,
  TrackPublishOptions,
  TrackSource,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from "@livekit/rtc-node";

export interface LiveKitInitOptions {
  wsUrl: string;
  token: string;
}

type IncomingAudioEvent = {
  participantId: string;
  track: RemoteTrack;
  publication: RemoteTrackPublication;
};

/**
 * AgentLiveKit - Voice system for AI agents
 *
 * Handles voice chat integration for AI agents operating in Hyperia worlds.
 */
export class AgentLiveKit {
  private room: Room | null = null;
  private audioSource: AudioSource | null = null;
  private localTrack: LocalAudioTrack | null = null;
  private publishOptions: TrackPublishOptions | null = null;
  private localTrackPublished: boolean = false;
  private eventEmitter: EventEmitter = new EventEmitter();
  private isConnected: boolean = false;
  private wsUrl: string = "";
  private token: string = "";
  private remoteAudioTracks = new Map<string, RemoteTrack>();

  // Audio buffer for publishing
  private audioQueue: Buffer[] = [];
  private isPublishing: boolean = false;
  private readonly sampleRate = 48000;
  private readonly channels = 1;

  /**
   * Initialize and connect to LiveKit room
   */
  async deserialize(opts: LiveKitInitOptions): Promise<void> {
    await this.connect(opts);
  }

  async connect(opts: LiveKitInitOptions): Promise<void> {
    if (!opts?.wsUrl || !opts?.token) {
      console.warn("[AgentLiveKit] Missing wsUrl or token, cannot connect");
      return;
    }

    this.wsUrl = opts.wsUrl;
    this.token = opts.token;

    try {
      if (this.room) {
        await this.room.disconnect();
        this.room = null;
      }
      this.audioSource = null;
      this.localTrack = null;
      this.publishOptions = null;
      this.localTrackPublished = false;
      this.remoteAudioTracks.clear();

      console.info("[AgentLiveKit] Connecting to LiveKit room...");
      this.room = new Room();
      this.setupRoomEvents();
      await this.room.connect(opts.wsUrl, opts.token, {
        autoSubscribe: true,
        dynacast: true,
      });
      this.isConnected = true;
      console.info("[AgentLiveKit] Connected to LiveKit room successfully");
      await this.flushQueuedAudio();
    } catch (error) {
      console.error(
        `[AgentLiveKit] Failed to connect: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Setup room event handlers
   */
  private setupRoomEvents(): void {
    if (!this.room) return;

    this.room.on(
      RoomEvent.TrackSubscribed,
      (
        track: RemoteTrack,
        publication: RemoteTrackPublication,
        participant: RemoteParticipant,
      ) => {
        if (track.kind === TrackKind.KIND_AUDIO) {
          this.handleIncomingAudio(track, publication, participant);
        }
      },
    );

    this.room.on(
      RoomEvent.TrackUnsubscribed,
      (
        track: RemoteTrack,
        _publication: RemoteTrackPublication,
        participant: RemoteParticipant,
      ) => {
        if (track.kind !== TrackKind.KIND_AUDIO) return;
        this.remoteAudioTracks.delete(participant.identity);
      },
    );

    this.room.on(RoomEvent.Disconnected, () => {
      console.info("[AgentLiveKit] Disconnected from LiveKit room");
      this.isConnected = false;
    });

    this.room.on(RoomEvent.Reconnecting, () => {
      console.info("[AgentLiveKit] Reconnecting to LiveKit room...");
    });

    this.room.on(RoomEvent.Reconnected, () => {
      console.info("[AgentLiveKit] Reconnected to LiveKit room");
      this.isConnected = true;
    });
  }

  /**
   * Handle incoming audio from other participants
   */
  private handleIncomingAudio(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ): void {
    const participantId = participant.identity;
    this.remoteAudioTracks.set(participantId, track);
    const event: IncomingAudioEvent = {
      participantId,
      track,
      publication,
    };
    this.eventEmitter.emit("audio", event);
  }

  /**
   * Subscribe to audio events
   */
  onAudioEvent(
    event: "audio",
    handler: (data: IncomingAudioEvent) => void,
  ): void {
    this.eventEmitter.on(event, handler);
  }

  /**
   * Unsubscribe from audio events
   */
  offAudioEvent(
    event: "audio",
    handler: (data: IncomingAudioEvent) => void,
  ): void {
    this.eventEmitter.off(event, handler);
  }

  /**
   * Stop and disconnect from LiveKit
   */
  async stop(): Promise<void> {
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
    }
    this.audioSource = null;
    this.localTrack = null;
    this.publishOptions = null;
    this.localTrackPublished = false;
    this.isConnected = false;
    this.audioQueue = [];
    this.remoteAudioTracks.clear();
    console.info("[AgentLiveKit] Stopped and disconnected");
  }

  /**
   * Publish audio buffer to the LiveKit room
   * Converts various audio formats to PCM and streams to participants
   */
  async publishAudioStream(audioBuffer: Buffer): Promise<void> {
    if (!this.isConnected || !this.room) {
      console.debug("[AgentLiveKit] Not connected, queueing audio for later");
      this.audioQueue.push(audioBuffer);
      return;
    }

    if (this.isPublishing) {
      console.debug("[AgentLiveKit] Already publishing, queueing audio");
      this.audioQueue.push(audioBuffer);
      return;
    }

    this.isPublishing = true;

    try {
      const pcmData = await this.convertToPcm(audioBuffer, this.sampleRate);
      await this.publishPcmSamples(pcmData);

      // Process any queued audio
      while (this.audioQueue.length > 0) {
        const nextBuffer = this.audioQueue.shift()!;
        const nextPcm = await this.convertToPcm(nextBuffer, this.sampleRate);
        await this.publishPcmSamples(nextPcm);
      }
    } catch (error) {
      console.error(
        `[AgentLiveKit] Failed to publish audio: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.isPublishing = false;
    }
  }

  /**
   * Alias for publishAudioStream for compatibility
   */
  async publishAudio(audioBuffer: Buffer): Promise<void> {
    return this.publishAudioStream(audioBuffer);
  }

  getRemoteAudioParticipantIds(): string[] {
    return Array.from(this.remoteAudioTracks.keys());
  }

  private async flushQueuedAudio(): Promise<void> {
    if (this.audioQueue.length === 0) return;
    const next = this.audioQueue.shift();
    if (next) {
      await this.publishAudioStream(next);
    }
  }

  private async ensureAudioTrack(): Promise<boolean> {
    if (!this.room?.localParticipant) return false;
    if (!this.audioSource) {
      this.audioSource = new AudioSource(this.sampleRate, this.channels);
    }
    if (!this.localTrack) {
      this.localTrack = LocalAudioTrack.createAudioTrack(
        "agent-voice",
        this.audioSource,
      );
    }
    if (!this.publishOptions) {
      const options = new TrackPublishOptions();
      options.source = TrackSource.SOURCE_MICROPHONE;
      this.publishOptions = options;
    }
    if (!this.localTrackPublished) {
      await this.room.localParticipant.publishTrack(
        this.localTrack,
        this.publishOptions,
      );
      this.localTrackPublished = true;
    }
    return true;
  }

  private async publishPcmSamples(pcmData: Int16Array): Promise<void> {
    if (pcmData.length === 0) return;
    const ready = await this.ensureAudioTrack();
    if (!ready || !this.audioSource) return;
    const samplesPerChannel = Math.floor(pcmData.length / this.channels);
    if (samplesPerChannel <= 0) return;
    const frame = new AudioFrame(
      pcmData,
      this.sampleRate,
      this.channels,
      samplesPerChannel,
    );
    await this.audioSource.captureFrame(frame);
  }

  /**
   * Convert various audio formats to PCM using ffmpeg
   */
  private async convertToPcm(
    buffer: Buffer,
    sampleRate = 48000,
  ): Promise<Int16Array> {
    const format = this.detectAudioFormat(buffer);

    if (format === "pcm") {
      return new Int16Array(
        buffer.buffer,
        buffer.byteOffset,
        buffer.length / 2,
      );
    }

    const ffmpegArgs: string[] = [
      "-f",
      format,
      "-i",
      "pipe:0",
      "-f",
      "s16le",
      "-ar",
      sampleRate.toString(),
      "-ac",
      "1",
      "pipe:1",
    ];

    return new Promise((resolve, reject) => {
      const ff = spawn("ffmpeg", ffmpegArgs);
      let raw = Buffer.alloc(0);

      ff.stdout.on("data", (chunk: Buffer) => {
        raw = Buffer.concat([raw, chunk]);
      });

      ff.stderr.on("data", () => {
        // Ignore ffmpeg logs
      });

      ff.on("error", (err) => {
        // ffmpeg not found - return empty PCM
        console.warn(`[AgentLiveKit] ffmpeg not available: ${err.message}`);
        resolve(new Int16Array(0));
      });

      ff.on("close", (code) => {
        if (code !== 0 && code !== null) {
          return reject(new Error(`ffmpeg failed (code ${code})`));
        }
        const samples = new Int16Array(
          raw.buffer,
          raw.byteOffset,
          raw.byteLength / 2,
        );
        resolve(samples);
      });

      ff.stdin.write(buffer);
      ff.stdin.end();
    });
  }

  /**
   * Detect audio format from buffer header
   */
  private detectAudioFormat(buffer: Buffer): "mp3" | "wav" | "pcm" {
    if (buffer.length < 4) return "pcm";

    const header = buffer.slice(0, 4).toString("ascii");
    if (header === "RIFF") {
      return "wav";
    }
    if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
      return "mp3";
    }
    return "pcm";
  }

  /**
   * Check if connected to LiveKit
   */
  isLiveKitConnected(): boolean {
    return this.isConnected;
  }
}
