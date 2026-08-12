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
  IDLE: "asset://emotes/emote-idle.glb",

  /** Walking animation (1.5x speed for responsiveness) */
  WALK: "asset://emotes/emote-walk.glb?s=1.3",

  /** Running animation (1.65x speed - 10% faster to match movement) */
  RUN: "asset://emotes/emote-run.glb?s=1.4",

  /** Floating/swimming animation */
  FLOAT: "asset://emotes/emote-float.glb",

  /** Falling animation */
  FALL: "asset://emotes/emote-fall.glb",

  /** Flip/jump animation (1.5x speed) */
  FLIP: "asset://emotes/emote-flip.glb?s=1.5",

  /** Talking/gesturing animation */
  TALK: "asset://emotes/emote-talk.glb",

  /** Combat/attack animation (punching) - plays once per attack, no loop */
  COMBAT: "asset://emotes/emote-punching.glb?l=0",

  /** Sword swing attack animation (used when sword is equipped) - plays once per attack, no loop */
  SWORD_SWING: "asset://emotes/emote_sword_swing.glb?l=0",

  /** Two-handed sword idle stance (used when 2h sword is equipped) */
  TWO_HAND_IDLE: "asset://emotes/emote-2h-idle.glb",

  /** Two-handed sword slash animation - plays once per attack, no loop */
  TWO_HAND_SLASH: "asset://emotes/emote-2h-slash.glb?l=0",

  /** Ranged attack animation (used when bow is equipped) - plays once per attack, no loop */
  RANGE: "asset://emotes/emote-range.glb?l=0",

  /** Spell cast animation (used for magic attacks) - plays once per attack, no loop */
  SPELL_CAST: "asset://emotes/emote-spell-cast.glb?l=0",

  /** Chopping/woodcutting animation (used when cutting trees) */
  CHOPPING: "asset://emotes/emote_chopping.glb",

  /** Fishing animation (used when fishing) */
  FISHING: "asset://emotes/emote-fishing.glb",

  /** Death animation - no loop, stays at end pose */
  DEATH: "asset://emotes/emote-death.glb?l=0",

  /** Squat/crouch animation (used for firemaking and cooking) */
  SQUAT: "asset://emotes/emote-squat.glb",

  /** Victory celebration - waving both hands (used after winning duels) */
  VICTORY: "asset://emotes/emote-waving-both-hands.glb",

  /** Victory dance - happy dance celebration */
  VICTORY_DANCE: "asset://emotes/emote-dance-happy.glb",
};

/** Array of all emote URLs (for preloading) */
export const emoteUrls = [
  Emotes.IDLE,
  Emotes.WALK,
  Emotes.RUN,
  Emotes.FLOAT,
  Emotes.FALL,
  Emotes.FLIP,
  Emotes.TALK,
  Emotes.COMBAT,
  Emotes.SWORD_SWING,
  Emotes.TWO_HAND_IDLE,
  Emotes.TWO_HAND_SLASH,
  Emotes.RANGE,
  Emotes.SPELL_CAST,
  Emotes.CHOPPING,
  Emotes.FISHING,
  Emotes.DEATH,
  Emotes.SQUAT,
  Emotes.VICTORY,
  Emotes.VICTORY_DANCE,
];

/**
 * Essential emotes that MUST be pre-loaded immediately after avatar loads.
 * These are the most commonly used emotes that would cause visible T-pose flash
 * if loaded on-demand during gameplay.
 */
export const essentialEmotes = [
  Emotes.IDLE, // Default pose - MUST be loaded first
  Emotes.WALK, // Most common movement
  Emotes.RUN, // Fast movement
  Emotes.COMBAT, // Unarmed attack
  Emotes.SWORD_SWING, // One-handed duel attack
  Emotes.TWO_HAND_IDLE, // Two-handed combat stance
  Emotes.TWO_HAND_SLASH, // Two-handed duel attack
  Emotes.RANGE, // Ranged duel attack
  Emotes.SPELL_CAST, // Magic duel attack
  Emotes.DEATH, // Death animation
  Emotes.VICTORY, // Victory celebration (waving)
];
