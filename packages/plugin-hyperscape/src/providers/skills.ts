/**
 * skillsProvider - Supplies skill levels and XP information
 *
 * Provides:
 * - All skill levels
 * - Total level
 * - Combat level
 * - XP in each skill
 */

import type {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  ProviderResult,
} from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";
import type { SkillsData } from "../types.js";

export const skillsProvider: Provider = {
  name: "skills",
  description: "Provides skill levels and XP information",
  dynamic: true,
  position: 4,

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
  ): Promise<ProviderResult> => {
    const service = runtime.getService<HyperscapeService>("hyperscapeService");
    const playerEntity = service?.getPlayerEntity();

    if (!playerEntity) {
      return {
        text: "Skills unavailable",
        values: {},
        data: {},
      };
    }

    const skills = playerEntity.skills as Record<
      string,
      { level: number; xp: number }
    >;

    // Calculate total level
    const totalLevel = Object.values(skills).reduce(
      (sum, skill) => sum + (skill as { level: number }).level,
      0,
    );

    // Calculate combat level (simplified formula)
    const combatLevel = Math.floor(
      (skills.attack.level +
        skills.strength.level +
        skills.defense.level +
        skills.constitution.level +
        skills.ranged.level) /
        5,
    );

    const skillsData: SkillsData = {
      skills: playerEntity.skills,
      totalLevel,
      combatLevel,
    };

    const skillsList = Object.entries(skills)
      .map(
        ([name, data]) =>
          `  - **${name.charAt(0).toUpperCase() + name.slice(1)}**: Level ${(data as { level: number; xp: number }).level} (${(data as { level: number; xp: number }).xp} XP)`,
      )
      .join("\n");

    const text = `## Your Skills
**Total Level**: ${totalLevel}
**Combat Level**: ${combatLevel}

${skillsList}`;

    return {
      text,
      values: {
        totalLevel,
        combatLevel,
      },
      data: skillsData,
    };
  },
};
