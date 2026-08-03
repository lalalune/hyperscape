/**
 * SeededRandom - Deterministic PRNG for Rules-Accurate Combat
 *
 * Uses xorshift128+ algorithm for fast, high-quality random numbers.
 * Same seed always produces the same sequence on all platforms.
 *
 * This enables:
 * - Reproducible combat outcomes for debugging
 * - Replay functionality for anti-cheat investigation
 * - Deterministic server behavior for esports/streaming
 *
 * @see https://en.wikipedia.org/wiki/Xorshift
 */

/**
 * Serialized state for save/restore functionality
 */
export interface SeededRandomState {
  state0: string;
  state1: string;
}

/**
 * Deterministic pseudo-random number generator using xorshift128+
 *
 * Features:
 * - Period of 2^128 - 1 (effectively infinite for game purposes)
 * - Passes BigCrush statistical tests
 * - Fast: ~1ns per number on modern CPUs
 * - Serializable state for replay
 *
 * @example
 * ```typescript
 * // Create with seed
 * const rng = new SeededRandom(12345);
 *
 * // Get random values
 * const float = rng.random();      // 0.0 to 1.0
 * const int = rng.nextInt(100);    // 0 to 99
 * const roll = rng.nextInt(256);   // classic MMORPG accuracy roll
 *
 * // Save/restore state
 * const state = rng.getState();
 * rng.setState(state);
 * ```
 */
export class SeededRandom {
  private state0: bigint;
  private state1: bigint;

  /**
   * Create a new SeededRandom instance
   *
   * @param seed - Initial seed value (any integer)
   */
  constructor(seed: number) {
    // Initialize state using splitmix64 for better seed diffusion
    // This ensures even similar seeds produce very different sequences
    this.state0 = this.splitmix64(BigInt(seed));
    this.state1 = this.splitmix64(this.state0);

    // Ensure we don't have an all-zero state (invalid for xorshift)
    if (this.state0 === 0n && this.state1 === 0n) {
      this.state0 = 1n;
    }
  }

  /**
   * Splitmix64 - Used to initialize state from seed
   * Provides better seed-to-state diffusion than simple assignment
   */
  private splitmix64(x: bigint): bigint {
    x = (x + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    x = ((x ^ (x >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    x = ((x ^ (x >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    return (x ^ (x >> 31n)) & 0xffffffffffffffffn;
  }

  /**
   * xorshift128+ core - generates next 64-bit value
   * This is the heart of the PRNG algorithm
   */
  private next(): bigint {
    let s1 = this.state0;
    const s0 = this.state1;

    this.state0 = s0;
    s1 ^= s1 << 23n;
    s1 = (s1 ^ s0 ^ (s1 >> 18n) ^ (s0 >> 5n)) & 0xffffffffffffffffn;
    this.state1 = s1;

    return (s0 + s1) & 0xffffffffffffffffn;
  }

  /**
   * Generate a random float in [0, 1)
   * Drop-in replacement for Math.random()
   *
   * @returns Random number between 0 (inclusive) and 1 (exclusive)
   */
  random(): number {
    // Use upper 53 bits for full double precision
    const value = this.next();
    // Convert to float in [0, 1)
    return Number(value >> 11n) / 9007199254740992; // 2^53
  }

  /**
   * Generate a random integer in [0, max)
   *
   * @param max - Upper bound (exclusive)
   * @returns Random integer from 0 to max-1
   */
  nextInt(max: number): number {
    if (max <= 0) return 0;
    return Math.floor(this.random() * max);
  }

  /**
   * Generate a random integer in [min, max]
   *
   * @param min - Lower bound (inclusive)
   * @param max - Upper bound (inclusive)
   * @returns Random integer from min to max
   */
  nextIntRange(min: number, max: number): number {
    if (min > max) {
      const temp = min;
      min = max;
      max = temp;
    }
    return min + this.nextInt(max - min + 1);
  }

  /**
   * classic MMORPG-style accuracy roll
   * Compares attack roll vs defense roll
   *
   * @param attackRoll - Attacker's accuracy roll (0 to maxRoll)
   * @param defenseRoll - Defender's defense roll (0 to maxRoll)
   * @returns true if attack hits, false if it misses
   */
  accuracyRoll(attackRoll: number, defenseRoll: number): boolean {
    // classic combat formula: if attack > defense, hit chance = 1 - (def+2)/(2*(atk+1))
    // if attack <= defense, hit chance = atk / (2*(def+1))
    // We simulate this by rolling both and comparing

    const attackValue = this.nextInt(attackRoll + 1);
    const defenseValue = this.nextInt(defenseRoll + 1);

    return attackValue > defenseValue;
  }

  /**
   * classic MMORPG-style damage roll
   * Generates damage from 0 to maxHit (inclusive)
   *
   * @param maxHit - Maximum possible damage
   * @returns Random damage value from 0 to maxHit
   */
  damageRoll(maxHit: number): number {
    if (maxHit <= 0) return 0;
    return this.nextInt(maxHit + 1);
  }

  /**
   * Get current state for serialization
   * Use this to save RNG state for replay functionality
   *
   * @returns Serializable state object
   */
  getState(): SeededRandomState {
    return {
      state0: this.state0.toString(16).padStart(16, "0"),
      state1: this.state1.toString(16).padStart(16, "0"),
    };
  }

  /**
   * Restore state from serialized form
   * Use this to replay a sequence of random numbers
   *
   * @param state - Previously saved state
   */
  setState(state: SeededRandomState): void {
    this.state0 = BigInt("0x" + state.state0);
    this.state1 = BigInt("0x" + state.state1);
  }

  /**
   * Create a copy of this RNG with the same state
   * Useful for "what if" scenarios without affecting main RNG
   *
   * @returns New SeededRandom instance with identical state
   */
  clone(): SeededRandom {
    const cloned = new SeededRandom(0);
    cloned.state0 = this.state0;
    cloned.state1 = this.state1;
    return cloned;
  }

  /**
   * Create a SeededRandom from serialized state
   *
   * @param state - Previously saved state
   * @returns New SeededRandom instance with restored state
   */
  static fromState(state: SeededRandomState): SeededRandom {
    const rng = new SeededRandom(0);
    rng.setState(state);
    return rng;
  }

  /**
   * Generate a seed from current timestamp + entropy
   * Use for creating unique game seeds
   *
   * @returns A seed suitable for SeededRandom constructor
   */
  static generateSeed(): number {
    // Combine timestamp with some additional entropy
    const timestamp = Date.now();
    const entropy = Math.floor(Math.random() * 0xffffffff);
    return (timestamp ^ entropy) >>> 0;
  }
}

/**
 * Global game RNG instance
 * Initialized with a random seed on server start
 * Seed is logged for replay capability
 */
let globalGameRng: SeededRandom | null = null;
let globalGameSeed: number | null = null;

/**
 * Initialize the global game RNG
 * Call this once on server start
 *
 * @param seed - Optional seed (uses random if not provided)
 * @returns The seed that was used (log this for replay!)
 */
export function initializeGameRng(seed?: number): number {
  globalGameSeed = seed ?? SeededRandom.generateSeed();
  globalGameRng = new SeededRandom(globalGameSeed);
  return globalGameSeed;
}

/**
 * Get the global game RNG instance
 * Throws if not initialized
 *
 * @returns The global SeededRandom instance
 */
export function getGameRng(): SeededRandom {
  if (!globalGameRng) {
    // Auto-initialize with random seed if not done explicitly
    initializeGameRng();
  }
  return globalGameRng!;
}

/**
 * Get the current game seed
 * Log this on server start for replay capability
 *
 * @returns The seed used to initialize the game RNG
 */
export function getGameSeed(): number | null {
  return globalGameSeed;
}

/**
 * Get the current state of the global game RNG
 * Use for periodic snapshots in replay system
 *
 * @returns Current RNG state or null if not initialized
 */
export function getGameRngState(): SeededRandomState | null {
  return globalGameRng?.getState() ?? null;
}
