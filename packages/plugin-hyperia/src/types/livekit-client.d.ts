/** Type stub for optional livekit-client dependency (dynamically imported at runtime) */
declare module "livekit-client" {
  export class Room {
    constructor(opts?: unknown);
    connect(url: string, token: string): Promise<void>;
    disconnect(): Promise<void>;
    on(event: string, handler: (...args: unknown[]) => void): this;
    off(event: string, handler: (...args: unknown[]) => void): this;
    localParticipant: {
      setMicrophoneEnabled(enabled: boolean): Promise<void>;
    };
    state: string;
  }

  export enum RoomEvent {
    Connected = "connected",
    Disconnected = "disconnected",
    ParticipantConnected = "participantConnected",
    ParticipantDisconnected = "participantDisconnected",
    TrackSubscribed = "trackSubscribed",
    TrackUnsubscribed = "trackUnsubscribed",
    AudioPlaybackStatusChanged = "audioPlaybackChanged",
  }
}
