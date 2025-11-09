import {
  type IAgentRuntime,
  type Memory,
  type Provider,
  type State,
} from "@elizaos/core";
import { HyperscapeService } from "../service";

/**
 * Main Skills Provider
 * Provides overview of all character skills and their current levels
 * This is a standard provider (always loaded) that gives the agent awareness of its skill progression
 */
export const hyperscapeSkillProvider: Provider = {
  name: "SKILLS_OVERVIEW",
  description: "Overview of all character skills and levels",
  dynamic: false, // Standard provider - always available
  position: 1, // After world state, before actions
  get: async (runtime: IAgentRuntime, _message: Memory, _state: State) => {
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName,
    );

    if (!service || !service.isConnected()) {
      return {
        text: "# Skills Overview\nStatus: Not connected to world",
        values: {
          skills_available: false,
        },
        data: {},
      };
    }

    const world = service.getWorld();
    const player = world?.entities?.player;
    const playerData = player?.data as
      | {
          skills?: Record<string, { level: number; experience: number }>;
        }
      | undefined;

    const skills = playerData?.skills || {};

    // Format skills list
    const skillsList = Object.entries(skills)
      .map(([skillName, skillData]) => {
        const { level, experience } = skillData;
        return `- ${skillName}: Level ${level} (${experience} XP)`;
      })
      .join("\n");

    const totalLevel = Object.values(skills).reduce(
      (sum, skill) => sum + skill.level,
      0,
    );
    const skillCount = Object.keys(skills).length;

    const text = `# Skills Overview

## Character Skills (${skillCount} total)
${skillsList || "No skills data available"}

## Total Level: ${totalLevel}

## Skill Categories
- **Gathering**: Woodcutting, Fishing
- **Production**: Firemaking, Cooking
- **Combat**: Attack, Strength, Defense (coming soon)

Use specific skill actions to train and level up your skills!`;

    return {
      text,
      values: {
        total_level: totalLevel,
        skill_count: skillCount,
        skills_available: skillCount > 0,
      },
      data: {
        skills,
      },
    };
  },
};
