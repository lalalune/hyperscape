/**
 * playerEmotes.ts - Player Animation Asset URLs
 * 
 * Centralized list of animation asset URLs for player characters.
 * These Mixamo-compatible animations are applied to VRM avatars.
 * 
 * Animation Files:
 * - All animations are GLB files containing skeletal animations
 * - Located in /assets/emotes/ directory
 * - Query parameter `?s=1.5` sets playback speed (1.5x faster)
 * 
 * Usage:
 * - PlayerLocal and PlayerRemote use these for character animation
 * - Avatar system retargets animations to VRM skeleton
 * - Emotes are applied via avatar.setEmote(Emotes.WALK)
 * 
 * Referenced by: PlayerLocal, PlayerRemote, Avatar node
 */

/**
 * Player Animation URLs
 * 
 * Standard animations for player characters.
 * URLs are resolved via world.resolveURL() to CDN or local paths.
 */
export const Emotes = {
  /** Standing idle animation */
  IDLE: 'asset://emotes/emote-idle.glb',
  
  /** Walking animation (1.5x speed for responsiveness) */
  WALK: 'asset://emotes/emote-walk.glb?s=1.5',
  
  /** Running animation (1.5x speed) */
  RUN: 'asset://emotes/emote-run.glb?s=1.5',
  
  /** Floating/swimming animation */
  FLOAT: 'asset://emotes/emote-float.glb',
  
  /** Falling animation */
  FALL: 'asset://emotes/emote-fall.glb',
  
  /** Flip/jump animation (1.5x speed) */
  FLIP: 'asset://emotes/emote-flip.glb?s=1.5',
  
  /** Talking/gesturing animation */
  TALK: 'asset://emotes/emote-talk.glb',

  /** Combat/attack animation (punching) */
  COMBAT: 'asset://emotes/emote-punching.glb',
}

/** Array of all emote URLs (for preloading) */
export const emoteUrls = [Emotes.IDLE, Emotes.WALK, Emotes.RUN, Emotes.FLOAT, Emotes.FALL, Emotes.FLIP, Emotes.TALK, Emotes.COMBAT]
