import { rpgBasicScenarios } from './rpg-basic-connection';
import { rpgQuestScenarios } from './rpg-quest-scenarios';
import { rpgSelfImprovementScenarios } from './rpg-self-improvement';
import { comprehensiveRPGTests } from './rpg-comprehensive-test';

// Re-export individual scenario collections
export { rpgBasicScenarios } from './rpg-basic-connection';
export { rpgQuestScenarios } from './rpg-quest-scenarios';
export { rpgSelfImprovementScenarios } from './rpg-self-improvement';
export { comprehensiveRPGTests } from './rpg-comprehensive-test';

// Individual scenario exports for direct access
export { basicRPGConnectionScenario, singlePlayerLevelUpScenario } from './rpg-basic-connection';

export {
  questCompletionScenario,
  multiAgentTradingScenario,
  cooperativeQuestScenario,
} from './rpg-quest-scenarios';

export {
  selfImprovementGamingScenario,
  collaborativeSelfImprovementScenario,
} from './rpg-self-improvement';

export {
  combatSystemTest,
  skillsSystemTest,
  questSystemTest,
  economySystemTest,
  rpgSwarmTest,
  endToEndRPGTest
} from './rpg-comprehensive-test';

// Complete collection of all RPG scenarios
export const allRPGScenarios = [
  ...rpgBasicScenarios,
  ...rpgQuestScenarios,
  ...rpgSelfImprovementScenarios,
  ...comprehensiveRPGTests,
];

// Scenario collections by category
export const rpgScenarioCategories = {
  basic: rpgBasicScenarios,
  quests: rpgQuestScenarios,
  selfImprovement: rpgSelfImprovementScenarios,
  comprehensive: comprehensiveRPGTests,
};

// Scenario metadata for easy discovery
export const rpgScenarioMetadata = {
  totalScenarios: allRPGScenarios.length,
  categories: Object.keys(rpgScenarioCategories),
  tags: [
    'hyperfy',
    'rpg',
    'connection',
    'basic',
    'leveling',
    'single-player',
    'progression',
    'quest',
    'npc',
    'fetch',
    'kill',
    'trading',
    'multi-agent',
    'items',
    'cooperation',
    'teamwork',
    'self-improvement',
    'autocoder',
    'long-running',
    'assessment',
    'collaboration',
    'combat',
    'pvp',
    'pve',
    'skills',
    'comprehensive',
    'crafting',
    'gathering',
    'economy',
    'shops',
    'swarm',
    'performance',
    'stress-test',
    'complete',
  ],
  estimatedDurations: {
    basic: '30 seconds - 10 minutes',
    quests: '10-15 minutes',
    selfImprovement: '30-40 minutes',
    comprehensive: '15-60 minutes per test (3-4 hours total)',
  },
  requirements: {
    plugins: ['@elizaos/plugin-hyperfy'],
    optionalPlugins: ['@elizaos/plugin-autocoder', '@elizaos/plugin-autonomy'],
    features: ['dynamic-actions', 'rpg-state', 'observer-mode'],
    services: ['Hyperfy world server running on localhost:3000'],
  },
};

// Quick scenario selection helpers
export const getScenariosByTag = (tag: string) => {
  return allRPGScenarios.filter((scenario) => scenario.tags.includes(tag));
};

export const getScenariosByCategory = (category: keyof typeof rpgScenarioCategories) => {
  return rpgScenarioCategories[category] || [];
};

export const getScenariosByDuration = (maxDurationMs: number) => {
  return allRPGScenarios.filter(
    (scenario) => (scenario.execution?.maxDuration || 0) <= maxDurationMs
  );
};

export const getQuickTestScenarios = () => {
  return getScenariosByDuration(300000); // 5 minutes or less
};

export const getLongRunningScenarios = () => {
  return allRPGScenarios.filter(
    (scenario) => (scenario.execution?.maxDuration || 0) > 900000 // More than 15 minutes
  );
};

// Comprehensive test helpers
export const getComprehensiveTests = () => {
  return getScenariosByCategory('comprehensive');
};

export const getCombatTests = () => {
  return getScenariosByTag('combat');
};

export const getEconomyTests = () => {
  return getScenariosByTag('economy');
};

// Scenario execution helpers
export const getRecommendedScenarioOrder = () => {
  return [
    'Basic RPG Connection Test', // 1. Verify basic connectivity
    'Single Player Level-Up Challenge', // 2. Test core gameplay mechanics
    'RPG Combat System Test', // 3. Test combat comprehensively
    'RPG Skills System Test', // 4. Test all skills
    'Quest Completion Challenge', // 5. Test quest system
    'RPG Quest System Test', // 6. Comprehensive quest testing
    'Multi-Agent Trading Challenge', // 7. Test player interaction
    'RPG Economy System Test', // 8. Test complete economy
    'Cooperative Quest Challenge', // 9. Test team coordination
    'RPG Agent Swarm Test', // 10. Test system performance
    'Self-Improvement Gaming Marathon', // 11. Test self-assessment
    'Collaborative Self-Improvement Gaming', // 12. Test collaborative improvement
    'End-to-End RPG Experience', // 13. Complete playthrough test
  ];
};

export const getScenarioByName = (name: string) => {
  return allRPGScenarios.find((scenario) => scenario.name === name);
};

// Development and testing utilities
export const validateAllScenarios = () => {
  const issues: string[] = [];

  for (const scenario of allRPGScenarios) {
    // Check required fields
    if (!scenario.id) {
      issues.push(`${scenario.name}: Missing ID`);
    }
    if (!scenario.actors || scenario.actors.length === 0) {
      issues.push(`${scenario.name}: No actors defined`);
    }
    if (
      !scenario.verification ||
      !scenario.verification.rules ||
      scenario.verification.rules.length === 0
    ) {
      issues.push(`${scenario.name}: No verification rules defined`);
    }

    // Check actor plugins
    for (const actor of scenario.actors || []) {
      if (!actor.plugins || !actor.plugins.includes('@elizaos/plugin-hyperfy')) {
        issues.push(`${scenario.name}: Actor ${actor.name} missing hyperfy plugin`);
      }
    }

    // Check observer config for comprehensive tests
    if (scenario.tags?.includes('comprehensive')) {
      if (!scenario.observerConfig) {
        issues.push(`${scenario.name}: Comprehensive test missing observer config`);
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
};

// Production test suite configuration
export const productionTestSuite = {
  name: 'Hyperfy RPG Production Test Suite',
  description: 'Complete test suite for production-ready RPG gameplay',
  phases: [
    {
      name: 'Basic Connectivity',
      scenarios: ['Basic RPG Connection Test'],
      duration: '5 minutes',
    },
    {
      name: 'Core Systems',
      scenarios: [
        'RPG Combat System Test',
        'RPG Skills System Test',
        'RPG Quest System Test',
        'RPG Economy System Test',
      ],
      duration: '90 minutes',
    },
    {
      name: 'Multi-Agent',
      scenarios: [
        'Multi-Agent Trading Challenge',
        'Cooperative Quest Challenge',
        'RPG Agent Swarm Test',
      ],
      duration: '60 minutes',
    },
    {
      name: 'Complete Experience',
      scenarios: ['End-to-End RPG Experience'],
      duration: '60 minutes',
    },
  ],
  totalDuration: '3.5 hours',
  requirements: {
    minAgents: 1,
    maxAgents: 5,
    observerMode: true,
  },
};

// Export default collection
export default allRPGScenarios;
