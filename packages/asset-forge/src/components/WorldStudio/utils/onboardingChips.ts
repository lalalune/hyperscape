/**
 * Onboarding chip helpers — idle suggestions + next-step chips.
 *
 * Phase 1.2 fifth carve from DesignWithAIDialog. The dialog has
 * two complementary chip surfaces:
 *
 *   - `IDLE_SUGGESTIONS` — rich starter cards (emoji + title +
 *     subtitle + prompt) shown when the chat is empty. Each
 *     gives the user a curated entry point ("Tropical island
 *     RPG", "Top-down shooter", etc.).
 *
 *   - `nextStepChips(plan)` — compact one-click chips ("Pick a
 *     gameplay style", "Add NPCs") computed from the live
 *     OnboardingPlan. Each chip is a prompt the user can shoot
 *     back at the agent. As the agent fills slots, the chip
 *     set shrinks toward "Build my world".
 *
 * Both are pure data / pure transforms — no React, no DOM —
 * so they extract cleanly. `nextStepChips` is generic over the
 * plan shape (depends on a structural subset of `OnboardingPlan`)
 * so the helper doesn't need the full domain type.
 */

export interface IdleSuggestion {
  readonly emoji: string;
  readonly title: string;
  readonly subtitle: string;
  readonly prompt: string;
}

/**
 * Idle-state suggested prompts shown when the conversation is
 * empty. Each renders as a richer card with an emoji, title,
 * and one-line subtitle so the empty state feels like a curated
 * welcome instead of a row of pills.
 */
export const IDLE_SUGGESTIONS: ReadonlyArray<IdleSuggestion> = [
  {
    emoji: "🏝️",
    title: "Tropical island RPG",
    subtitle: "Village, combat, quest giver",
    prompt:
      "Build me a tropical island RPG with a starter village, basic combat, and a quest giver.",
  },
  {
    emoji: "🏔️",
    title: "Snowy mountains",
    subtitle: "Rugged terrain · exploration",
    prompt:
      "Make a snowy mountain region with rugged terrain, a few NPCs, and exploration-focused gameplay.",
  },
  {
    emoji: "🌑",
    title: "Empty canvas",
    subtitle: "Open terrain, no setup",
    prompt: "Just give me an empty terrain to start exploring on my own.",
  },
  {
    emoji: "🎯",
    title: "Top-down shooter",
    subtitle: "Crosshair HUD · minimal terrain",
    prompt:
      "Build a top-down shooter with a crosshair HUD and minimal terrain.",
  },
];

export interface NextStepChip {
  readonly label: string;
  readonly prompt: string;
}

/**
 * Structural subset of `OnboardingPlan` that nextStepChips
 * reads. Keeping the dependency structural means the helper
 * doesn't need to import the full domain type — callers pass
 * whatever object satisfies these fields.
 */
export interface NextStepChipPlan {
  readonly pluginIds: string[] | null;
  readonly terrainConfig: Record<string, unknown> | null;
  readonly npcs: ReadonlyArray<unknown>;
  readonly mobSpawns: ReadonlyArray<unknown>;
  readonly quests: ReadonlyArray<unknown>;
  readonly uiPack: unknown | null;
}

/**
 * Always-on next-step suggestion chips. Computed from the
 * current effective plan so the user never has to wonder
 * "what's next?". Each chip is a one-click prompt the user
 * can shoot back at the agent. As the agent fills slots the
 * chip set shrinks toward "Build my world".
 */
export function nextStepChips(plan: NextStepChipPlan): NextStepChip[] {
  const chips: NextStepChip[] = [];
  if (plan.pluginIds === null) {
    chips.push({
      label: "Pick a gameplay style",
      prompt:
        "What gameplay plugins should I use? List the choices and pick the best fit.",
    });
  }
  if (plan.terrainConfig === null) {
    chips.push({
      label: "Shape the terrain",
      prompt:
        "Propose a terrain configuration that fits the world we're designing.",
    });
  }
  if (plan.npcs.length === 0) {
    chips.push({
      label: "Add NPCs",
      prompt: "Add 1-3 starter NPCs that fit this world.",
    });
  }
  if (plan.mobSpawns.length === 0) {
    chips.push({
      label: "Place mobs",
      prompt: "Place a few mob spawn points that fit the difficulty curve.",
    });
  }
  if (plan.quests.length === 0) {
    chips.push({
      label: "Add quests",
      prompt: "Author 1-3 starter quests that introduce the gameplay loop.",
    });
  }
  if (plan.uiPack === null) {
    chips.push({
      label: "Design the HUD",
      prompt: "Design a HUD layout that fits the game we're building.",
    });
  }
  return chips;
}
