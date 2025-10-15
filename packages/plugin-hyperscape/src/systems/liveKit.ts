import { spawn } from "node:child_process";
import { System } from "../types/core-types";
import type { World } from "@hyperscape/shared";

export interface LiveKitInitOptions {
  wsUrl: string;
  token: string;
}

// Stub types for when LiveKit is not available
interface AudioFrame {
  data: Int16Array;
}

interface ConnectOptions {
  [key: string]: string | number | boolean;
}

interface PublishOptions {
  [key: string]: string | number | boolean;
}

interface AudioTrack {
  [key: string]: string | number | boolean | Int16Array;
}

interface AudioSource {
  [key: string]: string | number | boolean | Int16Array;
}

interface Room {
  connect(url: string, token: string, options: ConnectOptions): Promise<void>;
  disconnect(): Promise<void>;
  on(event: string, handler: (...args: Array<string | number | boolean | Record<string, unknown>>) => void): void;
  localParticipant: {
    publishTrack(track: AudioTrack, options: PublishOptions): Promise<void>;
  };
}

export class AgentLiveKit extends System {
  private room: Room | null = null;
  private audioSource: AudioSource | null = null;
  private localTrack: AudioTrack | null = null;

  constructor(world: World) {
    super(world);
  }

  async deserialize(opts: LiveKitInitOptions): Promise<void> {
    console.warn(
      "[LiveKit] LiveKit support is not available - running in stub mode",
    );
    // Stub implementation - no actual connection
  }

  async stop(): Promise<void> {
    this.room = null;
    this.audioSource = null;
    this.localTrack = null;
  }

  private setupRoomEvents(): void {
    // Stub implementation
  }

  // Framework stubs
  preTick() {}
  preFixedUpdate() {}
  fixedUpdate() {}
  postFixedUpdate() {}
  preUpdate() {}
  update() {}
  postUpdate() {}
  lateUpdate() {}
  postLateUpdate() {}
  commit() {}
  postTick() {}
  start() {}

  async publishAudioStream(audioBuffer: Buffer): Promise<void> {
    console.log(
      "[LiveKit] Stub: Would publish audio stream of size:",
      audioBuffer.length,
    );
    // Stub implementation - no actual publishing
  }

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

      ff.stdout.on("data", (chunk) => {
        raw = Buffer.concat([raw, chunk]);
      });

      ff.stderr.on("data", () => {}); // ignore logs
      ff.on("close", (code) => {
        if (code !== 0) {
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

  private detectAudioFormat(buffer: Buffer): "mp3" | "wav" | "pcm" {
    const header = buffer.slice(0, 4).toString("ascii");
    if (header === "RIFF") {
      return "wav";
    }
    if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
      return "mp3";
    }
    return "pcm";
  }
}
