/**
 * Connection Quality Monitor
 *
 * Tracks connection quality metrics including latency, packet loss,
 * and connection stability. Provides quality indicators for UI display.
 *
 * @packageDocumentation
 */

import EventEmitter from "eventemitter3";

/**
 * Connection quality levels
 */
export enum ConnectionQualityLevel {
  EXCELLENT = "excellent",
  GOOD = "good",
  FAIR = "fair",
  POOR = "poor",
  DISCONNECTED = "disconnected",
}

/**
 * Connection quality metrics
 */
export interface ConnectionMetrics {
  /** Current latency in milliseconds */
  latency: number;
  /** Average latency over the sample window */
  averageLatency: number;
  /** Latency jitter (variation) */
  jitter: number;
  /** Estimated packet loss percentage (0-100) */
  packetLoss: number;
  /** Time since last successful ping */
  lastPingTime: number;
  /** Number of failed pings */
  failedPings: number;
  /** Connection quality level */
  quality: ConnectionQualityLevel;
  /** Whether currently connected */
  isConnected: boolean;
}

/**
 * Connection quality thresholds
 */
const QUALITY_THRESHOLDS = {
  excellent: { maxLatency: 50, maxJitter: 10, maxPacketLoss: 0 },
  good: { maxLatency: 100, maxJitter: 25, maxPacketLoss: 1 },
  fair: { maxLatency: 200, maxJitter: 50, maxPacketLoss: 5 },
  poor: { maxLatency: Infinity, maxJitter: Infinity, maxPacketLoss: 100 },
};

/**
 * Events emitted by ConnectionQuality
 */
interface ConnectionQualityEvents {
  "quality-changed": (quality: ConnectionQualityLevel) => void;
  "metrics-updated": (metrics: ConnectionMetrics) => void;
  "connection-lost": () => void;
  "connection-restored": () => void;
  "high-latency": (latency: number) => void;
}

/**
 * Connection Quality Monitor
 *
 * Tracks and reports connection quality metrics for multiplayer games.
 * Emits events when quality changes or issues are detected.
 *
 * @example
 * ```typescript
 * const monitor = new ConnectionQuality();
 *
 * monitor.on("quality-changed", (quality) => {
 *   console.log(`Connection quality: ${quality}`);
 * });
 *
 * // Record ping times
 * monitor.recordPing(45);
 * monitor.recordPing(52);
 *
 * // Get current quality
 * const metrics = monitor.getMetrics();
 * ```
 */
export class ConnectionQuality extends EventEmitter<ConnectionQualityEvents> {
  private latencySamples: number[] = [];
  private readonly maxSamples = 20;
  private failedPings = 0;
  private lastPingTime = Date.now();
  private isConnected = true;
  private currentQuality = ConnectionQualityLevel.GOOD;

  /** High latency warning threshold in ms */
  private readonly highLatencyThreshold = 200;

  /** Max consecutive failed pings before considered disconnected */
  private readonly maxFailedPings = 3;

  /**
   * Records a successful ping with the given latency
   */
  recordPing(latencyMs: number): void {
    this.lastPingTime = Date.now();
    this.failedPings = 0;

    // Track if we were disconnected
    const wasDisconnected = !this.isConnected;
    this.isConnected = true;

    // Add sample
    this.latencySamples.push(latencyMs);

    // Keep only recent samples
    if (this.latencySamples.length > this.maxSamples) {
      this.latencySamples.shift();
    }

    // Emit events
    if (wasDisconnected) {
      this.emit("connection-restored");
    }

    if (latencyMs > this.highLatencyThreshold) {
      this.emit("high-latency", latencyMs);
    }

    // Update quality and emit if changed
    this.updateQuality();
  }

  /**
   * Records a failed ping attempt
   */
  recordPingFailure(): void {
    this.failedPings++;

    if (this.failedPings >= this.maxFailedPings && this.isConnected) {
      this.isConnected = false;
      this.currentQuality = ConnectionQualityLevel.DISCONNECTED;
      this.emit("connection-lost");
      this.emit("quality-changed", this.currentQuality);
    }

    this.emit("metrics-updated", this.getMetrics());
  }

  /**
   * Gets current connection metrics
   */
  getMetrics(): ConnectionMetrics {
    const latency = this.getCurrentLatency();
    const averageLatency = this.getAverageLatency();
    const jitter = this.getJitter();
    const packetLoss = this.getPacketLossEstimate();

    return {
      latency,
      averageLatency,
      jitter,
      packetLoss,
      lastPingTime: this.lastPingTime,
      failedPings: this.failedPings,
      quality: this.currentQuality,
      isConnected: this.isConnected,
    };
  }

  /**
   * Gets the most recent latency sample
   */
  getCurrentLatency(): number {
    if (this.latencySamples.length === 0) return 0;
    return this.latencySamples[this.latencySamples.length - 1];
  }

  /**
   * Gets average latency over the sample window
   */
  getAverageLatency(): number {
    if (this.latencySamples.length === 0) return 0;
    const sum = this.latencySamples.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.latencySamples.length);
  }

  /**
   * Gets latency jitter (standard deviation)
   */
  getJitter(): number {
    if (this.latencySamples.length < 2) return 0;

    const avg = this.getAverageLatency();
    const squaredDiffs = this.latencySamples.map((x) => Math.pow(x - avg, 2));
    const variance =
      squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;

    return Math.round(Math.sqrt(variance));
  }

  /**
   * Estimates packet loss based on failed pings
   */
  getPacketLossEstimate(): number {
    // Simple estimation based on recent failed pings
    const recentPings = this.maxSamples + this.failedPings;
    if (recentPings === 0) return 0;
    return Math.round((this.failedPings / recentPings) * 100);
  }

  /**
   * Gets the current quality level
   */
  getQuality(): ConnectionQualityLevel {
    return this.currentQuality;
  }

  /**
   * Checks if the connection is currently healthy
   */
  isHealthy(): boolean {
    return (
      this.isConnected &&
      (this.currentQuality === ConnectionQualityLevel.EXCELLENT ||
        this.currentQuality === ConnectionQualityLevel.GOOD)
    );
  }

  /**
   * Updates the quality level based on current metrics
   */
  private updateQuality(): void {
    const oldQuality = this.currentQuality;
    const newQuality = this.calculateQuality();

    if (newQuality !== oldQuality) {
      this.currentQuality = newQuality;
      this.emit("quality-changed", newQuality);
    }

    this.emit("metrics-updated", this.getMetrics());
  }

  /**
   * Calculates quality level from current metrics
   */
  private calculateQuality(): ConnectionQualityLevel {
    if (!this.isConnected) {
      return ConnectionQualityLevel.DISCONNECTED;
    }

    const latency = this.getAverageLatency();
    const jitter = this.getJitter();
    const packetLoss = this.getPacketLossEstimate();

    if (
      latency <= QUALITY_THRESHOLDS.excellent.maxLatency &&
      jitter <= QUALITY_THRESHOLDS.excellent.maxJitter &&
      packetLoss <= QUALITY_THRESHOLDS.excellent.maxPacketLoss
    ) {
      return ConnectionQualityLevel.EXCELLENT;
    }

    if (
      latency <= QUALITY_THRESHOLDS.good.maxLatency &&
      jitter <= QUALITY_THRESHOLDS.good.maxJitter &&
      packetLoss <= QUALITY_THRESHOLDS.good.maxPacketLoss
    ) {
      return ConnectionQualityLevel.GOOD;
    }

    if (
      latency <= QUALITY_THRESHOLDS.fair.maxLatency &&
      jitter <= QUALITY_THRESHOLDS.fair.maxJitter &&
      packetLoss <= QUALITY_THRESHOLDS.fair.maxPacketLoss
    ) {
      return ConnectionQualityLevel.FAIR;
    }

    return ConnectionQualityLevel.POOR;
  }

  /**
   * Resets all metrics
   */
  reset(): void {
    this.latencySamples = [];
    this.failedPings = 0;
    this.lastPingTime = Date.now();
    this.isConnected = true;
    this.currentQuality = ConnectionQualityLevel.GOOD;
  }

  /**
   * Gets a display-friendly quality string
   */
  getQualityDisplay(): string {
    switch (this.currentQuality) {
      case ConnectionQualityLevel.EXCELLENT:
        return "Excellent";
      case ConnectionQualityLevel.GOOD:
        return "Good";
      case ConnectionQualityLevel.FAIR:
        return "Fair";
      case ConnectionQualityLevel.POOR:
        return "Poor";
      case ConnectionQualityLevel.DISCONNECTED:
        return "Disconnected";
    }
  }

  /**
   * Gets a color for the current quality level
   */
  getQualityColor(): string {
    switch (this.currentQuality) {
      case ConnectionQualityLevel.EXCELLENT:
        return "#22c55e"; // Green
      case ConnectionQualityLevel.GOOD:
        return "#84cc16"; // Lime
      case ConnectionQualityLevel.FAIR:
        return "#eab308"; // Yellow
      case ConnectionQualityLevel.POOR:
        return "#f97316"; // Orange
      case ConnectionQualityLevel.DISCONNECTED:
        return "#ef4444"; // Red
    }
  }

  /**
   * Gets the number of signal bars (1-4) for UI display
   */
  getSignalBars(): number {
    switch (this.currentQuality) {
      case ConnectionQualityLevel.EXCELLENT:
        return 4;
      case ConnectionQualityLevel.GOOD:
        return 3;
      case ConnectionQualityLevel.FAIR:
        return 2;
      case ConnectionQualityLevel.POOR:
        return 1;
      case ConnectionQualityLevel.DISCONNECTED:
        return 0;
    }
  }
}

/**
 * Singleton connection quality monitor instance
 */
export const connectionQuality = new ConnectionQuality();
