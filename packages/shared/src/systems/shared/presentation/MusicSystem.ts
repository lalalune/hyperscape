/**
 * MusicSystem - Manages background music and combat music with smooth crossfading
 *
 * Features:
 * - Fades in music at game start
 * - Crossfades between tracks
 * - Randomly selects tracks avoiding recent plays
 * - Switches to combat music when combat starts
 * - Returns to previous track after combat with crossfade
 */

import { SystemBase } from "../infrastructure/SystemBase";
import type { World } from "../../../core/World";
import { EventType } from "../../../types/events";
import type { ClientAudio } from "../../client/ClientAudio";
import type { ClientLoader } from "../../client/ClientLoader";

interface MusicTrack {
  id: string;
  name: string;
  type: string;
  category: "normal" | "combat";
  path: string;
  description: string;
  duration: number;
  mood: string;
}

interface PlayingTrack {
  track: MusicTrack;
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  startTime: number;
  pauseTime: number;
}

export class MusicSystem extends SystemBase {
  private tracks: MusicTrack[] = [];
  private normalTracks: MusicTrack[] = [];
  private combatTracks: MusicTrack[] = [];
  private currentTrack: PlayingTrack | null = null;
  private previousNormalTrack: PlayingTrack | null = null;
  private recentlyPlayed: Set<string> = new Set();
  private inCombat: boolean = false;
  private fadeInProgress: boolean = false;
  private musicInitialized: boolean = false;
  private audio: ClientAudio | null = null;
  private loader: ClientLoader | null = null;

  // Configuration
  private readonly FADE_DURATION = 2000; // 2 seconds
  private readonly INITIAL_FADE_DURATION = 3000; // 3 seconds for game start
  private readonly MAX_RECENT_TRACKS = 5; // Avoid repeating last 5 tracks
  private readonly MUSIC_VOLUME = 0.3; // Base music volume

  constructor(world: World) {
    super(world, {
      name: "music-system",
      dependencies: {},
      autoCleanup: false,
    });
  }

  async init(): Promise<void> {
    this.logger.info("Initializing MusicSystem...");

    // Get audio and loader systems
    this.audio = this.world.audio as ClientAudio;
    this.loader = this.world.loader as ClientLoader;

    if (!this.audio) {
      this.logger.error("ClientAudio system not found");
      return;
    }

    if (!this.loader) {
      this.logger.error("ClientLoader system not found");
      return;
    }

    // Check music preference from localStorage
    const musicEnabled = localStorage.getItem("music_enabled");
    if (musicEnabled === "false") {
      this.logger.info("Music disabled by user preference");
      // Set music volume to 0 in prefs
      if (this.world.prefs) {
        this.world.prefs.setMusic(0);
      }
      this.musicInitialized = false;
      return;
    }

    // Load music manifest
    await this.loadMusicManifest();

    // Listen for combat events
    this.subscribe(EventType.COMBAT_STARTED, this.onCombatStarted.bind(this));
    this.subscribe(EventType.COMBAT_ENDED, this.onCombatEnded.bind(this));

    // Start playing music after a short delay
    this.createTimer(() => {
      this.startMusic();
    }, 1000);

    this.musicInitialized = true;
    this.logger.info("MusicSystem initialized");
  }

  private async loadMusicManifest(): Promise<void> {
    // Load from world.assetsUrl (set by server snapshot) or server assets endpoint
    const cdnUrl =
      this.world.assetsUrl?.replace(/\/$/, "") ||
      "http://localhost:5555/assets";
    const manifestPath = `${cdnUrl}/manifests/music.json`;

    let response: Response;
    try {
      response = await fetch(manifestPath);
    } catch {
      // CDN/network not available - music disabled
      this.logger.warn(
        `Music manifest not available (CDN may not be running): ${manifestPath}`,
      );
      this.musicInitialized = false;
      return;
    }

    if (!response.ok) {
      this.logger.warn(
        `Music manifest not available: ${response.status} ${response.statusText}`,
      );
      this.musicInitialized = false;
      return;
    }

    this.tracks = (await response.json()) as MusicTrack[];

    // Separate tracks by category
    this.normalTracks = this.tracks.filter((t) => t.category === "normal");
    this.combatTracks = this.tracks.filter((t) => t.category === "combat");

    this.logger.info(
      `Loaded ${this.tracks.length} music tracks (${this.normalTracks.length} normal, ${this.combatTracks.length} combat)`,
    );
  }

  private async startMusic(): Promise<void> {
    if (!this.musicInitialized || !this.audio) return;

    // Wait for audio context to be unlocked
    // Wrap async callback to catch any errors since ready() doesn't handle promises
    this.audio.ready(() => {
      const track = this.selectRandomTrack(this.normalTracks);
      if (track) {
        this.playTrack(track, this.INITIAL_FADE_DURATION).catch((error) => {
          this.logger.warn(`Failed to play initial track: ${error}`);
        });
      }
    });
  }

  private selectRandomTrack(trackList: MusicTrack[]): MusicTrack | null {
    if (trackList.length === 0) return null;

    // Filter out recently played tracks
    const availableTracks = trackList.filter(
      (t) => !this.recentlyPlayed.has(t.id),
    );

    // If all tracks have been played recently, clear the history
    if (availableTracks.length === 0) {
      this.recentlyPlayed.clear();
      return trackList[Math.floor(Math.random() * trackList.length)]!;
    }

    // Select random track from available
    const selectedTrack =
      availableTracks[Math.floor(Math.random() * availableTracks.length)]!;

    // Add to recently played
    this.recentlyPlayed.add(selectedTrack.id);

    // Keep only the most recent tracks
    if (this.recentlyPlayed.size > this.MAX_RECENT_TRACKS) {
      const firstId = Array.from(this.recentlyPlayed)[0]!;
      this.recentlyPlayed.delete(firstId);
    }

    return selectedTrack;
  }

  private async playTrack(
    track: MusicTrack,
    fadeDuration: number = this.FADE_DURATION,
  ): Promise<void> {
    if (!this.audio || !this.loader) return;

    this.logger.info(`Playing track: ${track.name} (${track.category})`);

    // Load audio buffer
    let buffer: AudioBuffer;
    const cachedBuffer = this.loader.get("audio", track.path);
    if (cachedBuffer) {
      buffer = cachedBuffer as AudioBuffer;
    } else {
      // Load audio buffer - gracefully handle missing files
      let loadedBuffer;
      try {
        loadedBuffer = await this.loader.load("audio", track.path);
      } catch {
        // Music file not available - this is expected in dev without CDN
        this.logger.warn(
          `Music file not available: ${track.path} (CDN may not be running)`,
        );
        return;
      }
      if (!loadedBuffer) {
        this.logger.warn(`Failed to load audio track: ${track.path}`);
        return;
      }
      buffer = loadedBuffer as AudioBuffer;
    }

    // Create audio source
    const source = this.audio.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = false;

    // Create gain node for volume control and fading
    const gainNode = this.audio.ctx.createGain();
    gainNode.gain.value = 0; // Start silent

    // Connect nodes
    source.connect(gainNode);
    gainNode.connect(this.audio.groupGains.music);

    // Create playing track object
    const playingTrack: PlayingTrack = {
      track,
      source,
      gainNode,
      startTime: this.audio.ctx.currentTime,
      pauseTime: 0,
    };

    // Handle track end
    source.onended = () => {
      if (this.currentTrack === playingTrack) {
        this.onTrackEnded();
      }
    };

    // Start playing
    source.start(0);

    // Crossfade if there's a current track
    if (this.currentTrack) {
      await this.crossfade(this.currentTrack, playingTrack, fadeDuration);
    } else {
      // Just fade in
      await this.fadeIn(playingTrack, fadeDuration);
    }

    this.currentTrack = playingTrack;
  }

  private async fadeIn(
    playingTrack: PlayingTrack,
    duration: number,
  ): Promise<void> {
    if (!this.audio) return;

    this.fadeInProgress = true;
    const currentTime = this.audio.ctx.currentTime;

    playingTrack.gainNode.gain.setValueAtTime(0, currentTime);
    playingTrack.gainNode.gain.linearRampToValueAtTime(
      this.MUSIC_VOLUME,
      currentTime + duration / 1000,
    );

    await new Promise<void>((resolve) =>
      this.createTimer(() => resolve(), duration),
    );
    this.fadeInProgress = false;
  }

  private async fadeOut(
    playingTrack: PlayingTrack,
    duration: number,
  ): Promise<void> {
    if (!this.audio) return;

    this.fadeInProgress = true;
    const currentTime = this.audio.ctx.currentTime;

    playingTrack.gainNode.gain.setValueAtTime(
      playingTrack.gainNode.gain.value,
      currentTime,
    );
    playingTrack.gainNode.gain.linearRampToValueAtTime(
      0,
      currentTime + duration / 1000,
    );

    await new Promise<void>((resolve) =>
      this.createTimer(() => resolve(), duration),
    );

    // Stop and disconnect safely
    playingTrack.source.stop();
    playingTrack.source.disconnect();
    playingTrack.gainNode.disconnect();

    this.fadeInProgress = false;
  }

  private async crossfade(
    oldTrack: PlayingTrack,
    newTrack: PlayingTrack,
    duration: number,
  ): Promise<void> {
    if (!this.audio) return;

    this.fadeInProgress = true;
    const currentTime = this.audio.ctx.currentTime;

    // Fade out old track
    oldTrack.gainNode.gain.setValueAtTime(
      oldTrack.gainNode.gain.value,
      currentTime,
    );
    oldTrack.gainNode.gain.linearRampToValueAtTime(
      0,
      currentTime + duration / 1000,
    );

    // Fade in new track
    newTrack.gainNode.gain.setValueAtTime(0, currentTime);
    newTrack.gainNode.gain.linearRampToValueAtTime(
      this.MUSIC_VOLUME,
      currentTime + duration / 1000,
    );

    await new Promise<void>((resolve) =>
      this.createTimer(() => resolve(), duration),
    );

    // Stop and disconnect old track safely
    oldTrack.source.stop();

    oldTrack.source.disconnect();
    oldTrack.gainNode.disconnect();

    this.fadeInProgress = false;
  }

  private onTrackEnded(): void {
    if (this.fadeInProgress) return;

    this.logger.info("Track ended, selecting next track");

    // Select next track based on current state
    const trackList = this.inCombat ? this.combatTracks : this.normalTracks;
    const nextTrack = this.selectRandomTrack(trackList);

    if (nextTrack) {
      this.playTrack(nextTrack, this.FADE_DURATION).catch((error) => {
        this.logger.warn(`Failed to play next track: ${error}`);
      });
    }
  }

  private onCombatStarted(_data: {
    attackerId: string;
    targetId: string;
  }): void {
    if (this.inCombat) return;

    this.logger.info("Combat started, switching to combat music");
    this.inCombat = true;

    // Save current normal track
    if (this.currentTrack && this.currentTrack.track.category === "normal") {
      this.previousNormalTrack = this.currentTrack;
    }

    // Switch to combat music
    const combatTrack = this.selectRandomTrack(this.combatTracks);
    if (combatTrack) {
      this.playTrack(combatTrack, this.FADE_DURATION).catch((error) => {
        this.logger.warn(`Failed to play combat track: ${error}`);
      });
    }
  }

  private onCombatEnded(_data: {
    sessionId: string;
    winnerId: string | null;
  }): void {
    if (!this.inCombat) return;

    this.logger.info("Combat ended, returning to normal music");
    this.inCombat = false;

    // Return to previous normal track or select new one
    if (this.previousNormalTrack) {
      // Resume previous track (but select new one for now since resuming is complex)
      this.previousNormalTrack = null;
    }

    const normalTrack = this.selectRandomTrack(this.normalTracks);
    if (normalTrack) {
      this.playTrack(normalTrack, this.FADE_DURATION).catch((error) => {
        this.logger.warn(`Failed to play normal track: ${error}`);
      });
    }
  }

  update(_delta: number): void {
    // Music system doesn't need regular updates
    // Track transitions are handled by events and callbacks
  }

  destroy(): void {
    // Stop current track
    if (this.currentTrack) {
      // Stop source safely (may already be stopped)
      this.currentTrack.source.stop();
      this.currentTrack.source.disconnect();
      this.currentTrack.gainNode.disconnect();
      this.currentTrack = null;
    }

    // Clear previous track reference
    this.previousNormalTrack = null;

    // Clear recently played
    this.recentlyPlayed.clear();

    // Parent class handles event unsubscription and timer cleanup
    super.destroy();

    this.logger.info("MusicSystem destroyed");
  }
}
