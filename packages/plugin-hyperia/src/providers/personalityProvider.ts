/**
 * Personality Provider
 *
 * Provides personality traits that influence agent behavior, goal selection,
 * and social interactions. Traits are read from character settings or
 * generated with sensible defaults.
 *
 * Traits affect:
 * - Goal selection scoring (adventurous agents prefer quests/exploration)
 * - Social frequency (sociable agents greet and chat more)
 * - Activity preferences (some agents prefer fishing over combat)
 * - Chat style and tone
 */

import type {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  ProviderResult,
} from "@elizaos/core";

export interface PersonalityTraits {
  sociability: number;
  helpfulness: number;
  adventurousness: number;
  chattiness: number;
  aggression: number;
  patience: number;
  preferredSkills: string[];
  catchphrases: string[];
  quirks: string[];
}

const DEFAULT_TRAITS: PersonalityTraits = {
  sociability: 0.5,
  helpfulness: 0.5,
  adventurousness: 0.5,
  chattiness: 0.5,
  aggression: 0.3,
  patience: 0.5,
  preferredSkills: [],
  catchphrases: [],
  quirks: [],
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed + index) * 10000;
  return x - Math.floor(x);
}

function generateTraitsFromName(agentName: string): PersonalityTraits {
  const seed = hashString(agentName);

  const sociability = seededRandom(seed, 1);
  const helpfulness = seededRandom(seed, 2);
  const adventurousness = seededRandom(seed, 3);
  const chattiness = seededRandom(seed, 4);
  const aggression = seededRandom(seed, 5) * 0.6;
  const patience = seededRandom(seed, 6);

  const allSkills = [
    "woodcutting",
    "mining",
    "fishing",
    "combat",
    "cooking",
    "smithing",
    "firemaking",
    "exploration",
  ];
  const skillIndex1 = Math.floor(seededRandom(seed, 7) * allSkills.length);
  const skillIndex2 = Math.floor(seededRandom(seed, 8) * allSkills.length);
  const preferredSkills = [
    allSkills[skillIndex1],
    allSkills[
      skillIndex2 === skillIndex1
        ? (skillIndex2 + 1) % allSkills.length
        : skillIndex2
    ],
  ];

  const allCatchphrases = [
    "Let's get to work!",
    "Another fine day for adventure!",
    "The grind never stops.",
    "I wonder what's over there...",
    "Time to make some progress!",
    "This is the life!",
    "Back at it again!",
    "Nothing beats a good day of skilling!",
  ];
  const cpIndex = Math.floor(seededRandom(seed, 9) * allCatchphrases.length);

  const allQuirks = [
    "loves collecting rare items",
    "always stops to admire the scenery",
    "competitive about skill levels",
    "fascinated by combat techniques",
    "obsessed with efficiency",
    "enjoys the simple life of gathering",
    "always looking for new friends",
    "prefers working alone",
    "tells stories about past adventures",
    "names their tools",
  ];
  const quirkIndex = Math.floor(seededRandom(seed, 10) * allQuirks.length);

  return {
    sociability,
    helpfulness,
    adventurousness,
    chattiness,
    aggression,
    patience,
    preferredSkills,
    catchphrases: [allCatchphrases[cpIndex]],
    quirks: [allQuirks[quirkIndex]],
  };
}

function getTraitLabel(value: number): string {
  if (value >= 0.8) return "very high";
  if (value >= 0.6) return "high";
  if (value >= 0.4) return "moderate";
  if (value >= 0.2) return "low";
  return "very low";
}

const PROFILE_TRAITS: Record<string, Partial<PersonalityTraits>> = {
  social_butterfly: {
    sociability: 0.9,
    helpfulness: 0.7,
    adventurousness: 0.5,
    chattiness: 0.9,
    aggression: 0.1,
    patience: 0.7,
    preferredSkills: ["fishing", "cooking"],
    catchphrases: ["Hey friend! What are you up to?"],
    quirks: ["always stops to chat when seeing another player"],
  },
  grinder: {
    sociability: 0.2,
    helpfulness: 0.3,
    adventurousness: 0.3,
    chattiness: 0.15,
    aggression: 0.2,
    patience: 0.9,
    preferredSkills: ["mining", "smithing", "woodcutting"],
    catchphrases: ["Back to the grind."],
    quirks: ["obsessed with efficiency and optimal XP rates"],
  },
  adventurer: {
    sociability: 0.5,
    helpfulness: 0.5,
    adventurousness: 0.95,
    chattiness: 0.6,
    aggression: 0.4,
    patience: 0.4,
    preferredSkills: ["combat", "exploration"],
    catchphrases: ["What's over that hill?"],
    quirks: ["always exploring new areas instead of staying in one spot"],
  },
  helper: {
    sociability: 0.7,
    helpfulness: 0.95,
    adventurousness: 0.4,
    chattiness: 0.6,
    aggression: 0.1,
    patience: 0.8,
    preferredSkills: ["fishing", "cooking", "firemaking"],
    catchphrases: ["Need any help?"],
    quirks: ["always carries extra food to give to others"],
  },
  merchant: {
    sociability: 0.5,
    helpfulness: 0.4,
    adventurousness: 0.3,
    chattiness: 0.5,
    aggression: 0.1,
    patience: 0.7,
    preferredSkills: ["mining", "smithing", "fishing"],
    catchphrases: ["That's a good deal!"],
    quirks: ["always visits shops when near them"],
  },
};

let cachedTraits: PersonalityTraits | null = null;
let cachedAgentId: string | null = null;

export function getPersonalityTraits(
  runtime: IAgentRuntime,
): PersonalityTraits {
  if (cachedTraits && cachedAgentId === runtime.agentId) {
    return cachedTraits;
  }

  // Check for explicit personality settings
  const settingsTraits = runtime.getSetting("HYPERIA_PERSONALITY") as
    | Partial<PersonalityTraits>
    | undefined;

  // Check for a named character profile
  const profileName = runtime.getSetting("HYPERIA_CHARACTER_PROFILE") as
    | string
    | undefined;

  if (settingsTraits && typeof settingsTraits === "object") {
    cachedTraits = { ...DEFAULT_TRAITS, ...settingsTraits };
  } else if (profileName && typeof profileName === "string") {
    const profileTraits = PROFILE_TRAITS[profileName.toLowerCase()];
    if (profileTraits) {
      cachedTraits = { ...DEFAULT_TRAITS, ...profileTraits };
    } else {
      const agentName =
        (runtime.character?.name as string) || runtime.agentId || "agent";
      cachedTraits = generateTraitsFromName(agentName);
    }
  } else {
    const agentName =
      (runtime.character?.name as string) || runtime.agentId || "agent";
    cachedTraits = generateTraitsFromName(agentName);
  }

  cachedAgentId = runtime.agentId;
  return cachedTraits;
}

export const personalityProvider: Provider = {
  name: "personality",
  description:
    "Agent personality traits that influence behavior and social style",
  dynamic: false,
  position: 11,

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<ProviderResult> => {
    const traits = getPersonalityTraits(runtime);

    const textParts: string[] = ["## Your Personality\n"];

    textParts.push(
      `- **Sociability**: ${getTraitLabel(traits.sociability)} (${(traits.sociability * 100).toFixed(0)}%)`,
    );
    textParts.push(
      `  ${traits.sociability > 0.6 ? "You enjoy chatting and meeting people." : traits.sociability < 0.3 ? "You prefer keeping to yourself." : "You're friendly but not overly social."}`,
    );

    textParts.push(
      `- **Helpfulness**: ${getTraitLabel(traits.helpfulness)} (${(traits.helpfulness * 100).toFixed(0)}%)`,
    );
    textParts.push(
      `  ${traits.helpfulness > 0.6 ? "You go out of your way to help others." : traits.helpfulness < 0.3 ? "You focus on your own goals first." : "You help when convenient."}`,
    );

    textParts.push(
      `- **Adventurousness**: ${getTraitLabel(traits.adventurousness)} (${(traits.adventurousness * 100).toFixed(0)}%)`,
    );
    textParts.push(
      `  ${traits.adventurousness > 0.6 ? "You love exploring and trying new things." : traits.adventurousness < 0.3 ? "You prefer familiar routines." : "You balance routine with occasional exploration."}`,
    );

    textParts.push(
      `- **Chattiness**: ${getTraitLabel(traits.chattiness)} (${(traits.chattiness * 100).toFixed(0)}%)`,
    );
    textParts.push(
      `  ${traits.chattiness > 0.6 ? "You frequently share thoughts and observations." : traits.chattiness < 0.3 ? "You keep quiet and focused." : "You chat when there's something worth saying."}`,
    );

    if (traits.preferredSkills.length > 0) {
      textParts.push(
        `- **Favorite activities**: ${traits.preferredSkills.join(", ")}`,
      );
    }

    if (traits.quirks.length > 0) {
      textParts.push(`- **Quirk**: ${traits.quirks[0]}`);
    }

    textParts.push("");
    textParts.push(
      "**Behavior guidance**: Let your personality influence your decisions!",
    );
    textParts.push(
      "- If sociable, greet nearby players and chat about what you're doing",
    );
    textParts.push(
      "- If adventurous, prefer quests and exploration over repetitive grinding",
    );
    textParts.push(
      "- If helpful, offer food/advice to players who seem to be struggling",
    );
    textParts.push(
      "- Express your opinions about the world naturally through chat",
    );

    return {
      text: textParts.join("\n"),
      values: {
        sociability: traits.sociability,
        helpfulness: traits.helpfulness,
        adventurousness: traits.adventurousness,
        chattiness: traits.chattiness,
        preferredSkills: traits.preferredSkills,
      },
      data: { traits },
    };
  },
};
