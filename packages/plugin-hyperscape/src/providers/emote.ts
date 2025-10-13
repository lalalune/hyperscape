import { type Provider, type IAgentRuntime, type Memory } from "@elizaos/core";
import { EMOTES_LIST } from "../constants";

/**
 * A provider that lists all available emotes with descriptions.
 * @type {Provider}
 */
export const hyperscapeEmoteProvider: Provider = {
  name: "HYPERSCAPE_EMOTE_LIST",
  description: "Lists all available emotes and their descriptions",
  get: async (_runtime: IAgentRuntime, _message: Memory) => {
    const animationListText = EMOTES_LIST.map(
      (e) => `- **${e.name}**: ${e.description}`,
    ).join("\n");
    const animationText = `## Available Animations\n${animationListText}`;

    return {
      data: {
        emotes: EMOTES_LIST,
      },
      values: {
        hyperscapeAnimations: animationText,
      },
      text: animationText,
    };
  },
};
