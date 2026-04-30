/**
 * `OFFER_CHOICES` — surface clickable choice chips to the user.
 *
 * Phase B1'.4 of `PLAN_PROJECT_AS_DATA.md`. The conversational
 * onboarding flow is hybrid — pure free-text chat puts too much
 * burden on the user (and gives the agent too much room to
 * hallucinate options that don't exist). When the agent has 3–6
 * concrete options to pick from, it emits this action with each
 * option as `{ label, prompt }`:
 *
 *   - `label` — short button text the user sees
 *   - `prompt` — what's sent as the user's next message if they
 *               click the chip (replays through the agent loop
 *               like the user typed it)
 *
 * The host (`DesignWithAIDialog`) renders the choices below the
 * agent's text response. The user can click a chip OR keep typing
 * — both paths productive.
 *
 * The action is purely informational; it doesn't mutate any
 * project state. The chip's prompt feeds back into the next
 * design turn, where the agent reacts to the user's selection.
 */

import type {
  Action,
  ActionResult,
  HandlerCallback,
  HandlerOptions,
  IAgentRuntime,
  Memory,
  ProviderDataRecord,
  State,
} from "@elizaos/core";
import { GameBuilderService } from "../services/GameBuilderService.js";

/** One offered choice. */
export interface OfferedChoice {
  /** Short text shown on the chip button. */
  readonly label: string;
  /**
   * The prompt sent as the user's next message when this chip is
   * clicked. Should read like something the user could plausibly
   * have typed, e.g. "I want an open-world RPG with combat".
   */
  readonly prompt: string;
}

function readChoicesField(
  options: HandlerOptions | Record<string, unknown> | undefined,
  name: string,
): unknown[] | undefined {
  const params = (
    options as { parameters?: Record<string, unknown> } | undefined
  )?.parameters;
  const fromParams = params?.[name];
  if (Array.isArray(fromParams)) return fromParams;
  const direct = (options as Record<string, unknown> | undefined)?.[name];
  if (Array.isArray(direct)) return direct;
  return undefined;
}

function readStringField(
  options: HandlerOptions | Record<string, unknown> | undefined,
  name: string,
): string | undefined {
  const params = (
    options as { parameters?: Record<string, unknown> } | undefined
  )?.parameters;
  const fromParams = params?.[name];
  if (typeof fromParams === "string" && fromParams.length > 0)
    return fromParams;
  const direct = (options as Record<string, unknown> | undefined)?.[name];
  if (typeof direct === "string" && direct.length > 0) return direct;
  return undefined;
}

export const offerChoicesAction: Action = {
  name: "OFFER_CHOICES",
  similes: ["ASK_USER", "PROMPT_CHOICE", "SHOW_OPTIONS", "PRESENT_CHOICES"],
  description:
    "Offer the user 3-6 clickable choices when the next decision is faster to pick than describe in text. Pass `choices` — an array of `{ label, prompt }` objects. `label` is the button text; `prompt` is what gets sent as the user's next message if they click. Use this to short-circuit obvious questions like genre, scale, mood, or yes/no confirmations. Pure UI — does not mutate project state.",

  parameters: [
    {
      name: "question",
      description:
        "Optional short question shown above the chips (e.g. 'What gameplay focus?'). Render-time hint; the chips work with or without it.",
      required: false,
      schema: { type: "string" },
    },
    {
      name: "choices",
      description:
        "Array of choices. Each: { label: short button text, prompt: full message sent if clicked }. 3-6 choices is the sweet spot.",
      required: true,
      schema: { type: "array" },
    },
  ],

  validate: async (runtime: IAgentRuntime) => {
    return (
      runtime.getService<GameBuilderService>(GameBuilderService.serviceType) !==
      null
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    options?: HandlerOptions | Record<string, unknown>,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    const service = runtime.getService<GameBuilderService>(
      GameBuilderService.serviceType,
    );
    if (!service) {
      const error = new Error("GameBuilderService not available");
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const rawChoices = readChoicesField(options, "choices");
    if (!rawChoices) {
      const error = new Error(
        "OFFER_CHOICES requires a `choices` parameter — an array of { label, prompt } objects.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    // Validate each entry has label + prompt strings.
    const validated: OfferedChoice[] = [];
    for (const c of rawChoices) {
      if (!c || typeof c !== "object") continue;
      const obj = c as Record<string, unknown>;
      const label = obj.label;
      const prompt = obj.prompt;
      if (typeof label !== "string" || label.length === 0) continue;
      if (typeof prompt !== "string" || prompt.length === 0) continue;
      validated.push({ label, prompt });
    }

    if (validated.length === 0) {
      const error = new Error(
        "OFFER_CHOICES `choices` array must contain at least one valid { label, prompt } entry.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const question = readStringField(options, "question");
    const summary = question
      ? `${question}\n${validated.map((c) => `  • ${c.label}`).join("\n")}`
      : `Choices offered:\n${validated.map((c) => `  • ${c.label}`).join("\n")}`;

    await callback?.({ text: summary, action: "OFFER_CHOICES" });

    return {
      success: true,
      text: summary,
      values: { count: validated.length },
      data: {
        question: question ?? null,
        choices: validated,
      } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "user",
        content: { text: "Help me build a game" },
      },
      {
        name: "agent",
        content: {
          text: "What gameplay focus?\n  • Combat-heavy RPG\n  • Open-world exploration\n  • Top-down shooter\n  • Sandbox / building",
          action: "OFFER_CHOICES",
        },
      },
    ],
  ],
};
