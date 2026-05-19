/**
 * Level-Up Audio System
 *
 * Placeholder level-up sounds using Web Audio API.
 * Generates musical fanfares programmatically - replace with actual
 * audio files later for production.
 *
 * Features:
 * - Normal level-up: C major arpeggio (C5-E5-G5-C6)
 * - Milestone levels: Extended fanfare with harmony
 * - Respects SFX volume settings via gainNode connection
 */

/**
 * Milestone levels that get special fanfare
 * Matches tile-based MMORPG significant level milestones
 */
const MILESTONE_LEVELS = [10, 25, 50, 75, 99];

/**
 * Check if a level is a milestone (gets enhanced fanfare)
 */
export function isMilestoneLevel(level: number): boolean {
  return MILESTONE_LEVELS.includes(level);
}

/**
 * Play placeholder level-up fanfare
 *
 * Generates an ascending C major arpeggio using Web Audio API oscillators.
 * Sound: C5 → E5 → G5 → C6 (classic "level up" feel)
 *
 * @param ctx - AudioContext to use (from ClientAudio system)
 * @param destination - GainNode to connect to (for volume control)
 */
export function playLevelUpSound(
  ctx: AudioContext,
  destination?: GainNode,
): void {
  const output = destination || ctx.destination;

  // C major arpeggio: C5, E5, G5, C6
  const notes = [523.25, 659.25, 783.99, 1046.5];
  const noteDuration = 0.12;
  const noteGap = 0.08;

  notes.forEach((freq, i) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(output);

    oscillator.frequency.value = freq;
    oscillator.type = "triangle"; // Softer than sine, more musical

    const startTime = ctx.currentTime + i * (noteDuration + noteGap);
    const endTime = startTime + noteDuration * 2;

    // Attack and decay envelope for pleasant sound
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.02); // Quick attack
    gainNode.gain.exponentialRampToValueAtTime(0.01, endTime); // Smooth decay

    oscillator.start(startTime);
    oscillator.stop(endTime);
  });
}

/**
 * Play enhanced fanfare for milestone levels (10, 25, 50, 75, 99)
 *
 * Extended arpeggio with harmony for extra celebration.
 * Two voices: melody (triangle wave) + harmony (sine wave, octave lower)
 *
 * @param ctx - AudioContext to use (from ClientAudio system)
 * @param destination - GainNode to connect to (for volume control)
 */
export function playMilestoneLevelUpSound(
  ctx: AudioContext,
  destination?: GainNode,
): void {
  const output = destination || ctx.destination;

  // Extended melody with peak and resolution
  const melody = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1046.5];
  // Harmony one octave lower
  const harmony = [261.63, 329.63, 392.0, 523.25, 659.25, 523.25];

  const voices: [number[], "triangle" | "sine", number][] = [
    [melody, "triangle", 0.25], // Lead voice
    [harmony, "sine", 0.15], // Harmony voice (quieter)
  ];

  voices.forEach(([notes, waveType, volume]) => {
    notes.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(output);

      oscillator.frequency.value = freq;
      oscillator.type = waveType;

      const startTime = ctx.currentTime + i * 0.15;
      const endTime = startTime + 0.5;

      // Envelope
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);

      oscillator.start(startTime);
      oscillator.stop(endTime);
    });
  });
}

/**
 * Play the appropriate level-up sound based on level
 *
 * @param level - The new level reached
 * @param ctx - AudioContext from ClientAudio system
 * @param sfxGain - SFX GainNode for volume control
 */
export function playLevelUpFanfare(
  level: number,
  ctx: AudioContext,
  sfxGain?: GainNode,
): void {
  if (isMilestoneLevel(level)) {
    playMilestoneLevelUpSound(ctx, sfxGain);
  } else {
    playLevelUpSound(ctx, sfxGain);
  }
}
