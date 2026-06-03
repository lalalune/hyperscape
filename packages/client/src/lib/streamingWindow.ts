export type PublicRuntimeEnv = {
  PUBLIC_CDN_URL?: string;
  PUBLIC_WS_URL?: string;
  PUBLIC_API_URL?: string;
  PUBLIC_APP_URL?: string;
  PUBLIC_EMBED_ALLOWED_ORIGINS?: string;
  PUBLIC_PRIVY_APP_ID?: string;
  PUBLIC_SOLANA_NETWORK?: string;
  PUBLIC_SOLANA_RPC_URL?: string;
  PUBLIC_SOLANA_WS_URL?: string;
};

export type StreamingWindowRendererHealth = {
  ready: boolean;
  degradedReason: string | null;
  updatedAt: number;
  phase: string | null;
};

export type CaptureControlStatus = {
  recording?: boolean;
  wsConnected?: boolean;
  chunkCount?: number;
  bytesSent?: number;
  uptime?: number;
  lastChunkMs?: number | null;
  wsBufferedAmount?: number;
  heapUsedBytes?: number | null;
  heapLimitBytes?: number | null;
};

export type StreamingWindow = Window & {
  env?: PublicRuntimeEnv;
  __CDN_URL?: string;
  __HYPERIA_STREAM_READY__?: boolean;
  __HYPERIA_STREAM_RENDERER_HEALTH__?: StreamingWindowRendererHealth | null;
  /**
   * Boot/loading phase indicator read by the capture pipeline's renderer
   * health probe. Set during the loading overlay lifecycle and cleared once
   * the stream is fully ready. Values match the probe's detection categories:
   * - "connecting" | "initializing" | "loading_assets" | "finalizing"
   * - "error:webgpu_required" | "error:init_failed" | "error:http"
   * - null when boot is complete
   */
  __HYPERIA_STREAM_BOOT_STATUS__?: string | null;
  /** In-page capture control exposed for deduplication and status queries. */
  __captureControl__?: {
    stop?: () => void;
    getStatus?: () => CaptureControlStatus;
  };
  __captureStatus__?: CaptureControlStatus;
};
