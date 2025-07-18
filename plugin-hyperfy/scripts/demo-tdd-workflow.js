#!/usr/bin/env node

/**
 * Demonstrates the Test-Driven Development workflow for Among Us Hyperfy
 * This script shows how to implement features using TDD principles
 */

console.log(`
🧪 Among Us Hyperfy - Test-Driven Development Demo
================================================

This demo shows how to implement new features using TDD:

1. Write the test first
2. Watch it fail (Red)
3. Write minimal code to pass (Green)
4. Refactor (Refactor)

Let's implement a new feature: "Sabotage System"
`);

const steps = [
  {
    title: "Step 1: Write the Test First",
    command: "Create test file: src/__tests__/core/SabotageSystem.test.ts",
    code: `
import { describe, it, expect } from 'vitest';
import { SabotageSystem } from '../../systems/SabotageSystem';
import { GameState } from '../../apps/amongus/GameState';

describe('SabotageSystem', () => {
  let sabotageSystem: SabotageSystem;
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
    sabotageSystem = new SabotageSystem(gameState);
  });

  it('should allow impostors to trigger sabotage', () => {
    const impostor = { id: 'imp1', role: 'impostor' };
    
    const result = sabotageSystem.triggerSabotage('lights', impostor);
    
    expect(result.success).toBe(true);
    expect(gameState.activeSabotage).toBe('lights');
  });

  it('should not allow crewmates to sabotage', () => {
    const crewmate = { id: 'crew1', role: 'crewmate' };
    
    expect(() => {
      sabotageSystem.triggerSabotage('lights', crewmate);
    }).toThrow('Only impostors can sabotage');
  });

  it('should have cooldown between sabotages', () => {
    const impostor = { id: 'imp1', role: 'impostor' };
    
    sabotageSystem.triggerSabotage('lights', impostor);
    
    expect(() => {
      sabotageSystem.triggerSabotage('oxygen', impostor);
    }).toThrow('Sabotage on cooldown');
  });
});
    `
  },
  {
    title: "Step 2: Run the Test (Red Phase)",
    command: "npm run test:unit -- SabotageSystem.test.ts",
    expectedOutput: `
❌ Test fails because SabotageSystem doesn't exist yet
Error: Cannot find module '../../systems/SabotageSystem'
    `
  },
  {
    title: "Step 3: Write Minimal Code (Green Phase)",
    command: "Create implementation: src/systems/SabotageSystem.ts",
    code: `
export class SabotageSystem {
  private gameState: any;
  private lastSabotageTime: number = 0;
  private cooldown = 30000; // 30 seconds

  constructor(gameState: any) {
    this.gameState = gameState;
  }

  triggerSabotage(type: string, player: any) {
    if (player.role !== 'impostor') {
      throw new Error('Only impostors can sabotage');
    }

    const now = Date.now();
    if (now - this.lastSabotageTime < this.cooldown) {
      throw new Error('Sabotage on cooldown');
    }

    this.gameState.activeSabotage = type;
    this.lastSabotageTime = now;

    return { success: true };
  }
}
    `
  },
  {
    title: "Step 4: Run Tests Again (Should Pass)",
    command: "npm run test:unit -- SabotageSystem.test.ts",
    expectedOutput: `
✅ SabotageSystem
  ✓ should allow impostors to trigger sabotage
  ✓ should not allow crewmates to sabotage
  ✓ should have cooldown between sabotages

3 tests passed
    `
  },
  {
    title: "Step 5: Refactor",
    command: "Improve the implementation",
    code: `
// Add more sabotage types
export enum SabotageType {
  LIGHTS = 'lights',
  OXYGEN = 'oxygen',
  REACTOR = 'reactor',
  COMMUNICATIONS = 'communications'
}

// Add sabotage effects
export interface SabotageEffect {
  type: SabotageType;
  duration: number;
  fixRequirements: {
    playersNeeded: number;
    locations: string[];
  };
}

// Refactored implementation with better structure
export class SabotageSystem {
  // ... improved implementation
}
    `
  },
  {
    title: "Step 6: Add More Tests",
    command: "Expand test coverage",
    code: `
describe('Sabotage Effects', () => {
  it('should reduce visibility during lights sabotage', () => {
    sabotageSystem.triggerSabotage('lights', impostor);
    
    expect(gameState.visibility).toBe(0.3); // 30% visibility
  });

  it('should start countdown during oxygen sabotage', () => {
    sabotageSystem.triggerSabotage('oxygen', impostor);
    
    expect(gameState.oxygenTimer).toBe(30); // 30 seconds
  });

  it('should require multiple players to fix reactor', () => {
    sabotageSystem.triggerSabotage('reactor', impostor);
    
    const requirements = sabotageSystem.getFixRequirements();
    expect(requirements.playersNeeded).toBe(2);
  });
});
    `
  }
];

console.log(`
📋 TDD Workflow Steps:
`);

steps.forEach((step, index) => {
  console.log(`
${index + 1}. ${step.title}
${'─'.repeat(50)}
Command: ${step.command}
${step.code ? `\nCode:\n${step.code}` : ''}
${step.expectedOutput ? `\nExpected Output:${step.expectedOutput}` : ''}
`);
});

console.log(`
🎯 Benefits of TDD:

1. ✅ Better Design - Tests force you to think about API first
2. ✅ Confidence - Know immediately when something breaks
3. ✅ Documentation - Tests serve as living documentation
4. ✅ Refactoring Safety - Change code without fear
5. ✅ Faster Development - Less debugging, more coding

🚀 To start TDD workflow:

1. Run tests in watch mode:
   npm run test:tdd

2. Create a new test file for your feature

3. Follow the Red-Green-Refactor cycle

4. Run full test suite before committing:
   npm run test:all

📚 Additional Resources:

- TDD Strategy: HYPERFY_AMONGUS_TDD_STRATEGY.md
- Test Examples: src/__tests__/
- Coverage Report: npm run test:coverage

Happy Testing! 🧪
`); 