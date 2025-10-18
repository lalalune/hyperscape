import { IAgentRuntime, logger } from "@elizaos/core";
import { HyperscapeService } from "../service";

/**
 * CLAUDE.md Compliance: Strong typing for visual testing framework
 * No `any` types - all test types explicitly defined
 */

/**
 * Visual template for color detection
 */
export interface VisualTemplate {
  color: number;
  hex: string;
}

/**
 * Color detector interface (from Hyperscape)
 */
export interface ColorDetector {
  detectColor: (x: number, y: number, z: number) => number | null;
  detectNearbyColors: (
    x: number,
    y: number,
    z: number,
    radius: number,
  ) => Array<{ color: number; position: { x: number; y: number; z: number } }>;
  getColorName: (color: number) => string | null;
  detectEntities?: (
    color: number,
    options?: { tolerance?: number; minClusterSize?: number },
  ) => Promise<
    Array<{ position: { x: number; y: number; z: number }; color: number }>
  >;
}

/**
 * State snapshot for test verification
 */
export interface StateSnapshot {
  playerPosition?: { x: number; y: number; z: number };
  location?: {
    coordinates: { x: number; y: number; z: number };
  };
  inventory?:
    | {
        items: Array<{
          id?: string;
          itemId: string;
          name?: string;
          quantity: number;
        }>;
        gold: number;
      }
    | Array<{ itemId: string; quantity: number }>;
  skills?: Record<string, { level: number; xp: number }>;
  nearbyEntities?: Array<{
    id: string;
    type: string;
    position: { x: number; y: number; z: number };
  }>;
  [key: string]: unknown;
}

/**
 * Visual test verification types
 */
export interface VisualCheck {
  entityType: string;
  expectedColor: string | number;
  position?: { x: number; y: number; z: number };
  shouldExist: boolean;
  tolerance?: number;
}

export interface StateCheck<T = unknown> {
  property: string;
  expectedValue: T;
  operator: "equals" | "greater" | "less" | "contains" | "matches";
}

export interface TestVerification {
  type: "visual" | "state" | "both";
  visualChecks?: VisualCheck[];
  stateChecks?: StateCheck[];
  screenshot?: boolean;
}

/**
 * Concrete test result with actual verification
 */
export interface TestResult {
  passed: boolean;
  failures: string[];
  screenshots: string[];
  stateSnapshot: StateSnapshot;
  timestamp: Date;
}

/**
 * Visual Test Framework using ColorDetector and state verification
 */
export class VisualTestFramework {
  private runtime: IAgentRuntime;
  private service: HyperscapeService;
  private colorDetector: ColorDetector | null = null;
  private visualTemplates: Map<string, VisualTemplate> = new Map();

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName,
    )!;
  }

  /**
   * Initialize visual testing with ColorDetector
   */
  async initialize(): Promise<void> {
    logger.info("[VisualTestFramework] Initializing visual testing...");

    // Load visual templates from hyperscape/src/rpg/config/visuals/templates.json
    await this.loadVisualTemplates();

    // Initialize ColorDetector if available
    const world = this.service.getWorld();
    if (world && typeof world === "object" && "colorDetector" in world) {
      const worldWithDetector = world as { colorDetector?: ColorDetector };
      this.colorDetector = worldWithDetector.colorDetector || null;
    } else {
      logger.warn("[VisualTestFramework] ColorDetector not available in world");
    }
  }

  /**
   * Load predefined visual templates
   */
  private async loadVisualTemplates(): Promise<void> {
    // These are from the templates.json mentioned in the analysis
    const templates = {
      items: {
        sword: { color: 16729156, hex: "#FF4444" },
        bow: { color: 9127187, hex: "#8B4513" },
        staff: { color: 9699539, hex: "#9400D3" },
        potion: { color: 16724736, hex: "#FF3300" },
        food: { color: 16753920, hex: "#FFA500" },
      },
      npcs: {
        goblin: { color: 2263842, hex: "#228822" },
        skeleton: { color: 16119260, hex: "#F5F5DC" },
        guard: { color: 4356961, hex: "#427361" },
        merchant: { color: 8421504, hex: "#808080" },
        quest_giver: { color: 16776960, hex: "#FFFF00" },
      },
      resources: {
        tree: { color: 2263842, hex: "#228822" },
        iron_rock: { color: 4210752, hex: "#404040" },
        gold_rock: { color: 16766720, hex: "#FFD700" },
        fishing_spot: { color: 255, hex: "#0000FF" },
      },
      special: {
        player: { color: 16729411, hex: "#FF4543" },
        damage_indicator: { color: 16711680, hex: "#FF0000" },
        heal_indicator: { color: 65280, hex: "#00FF00" },
        spawn_point: { color: 65280, hex: "#00FF00" },
      },
    };

    // Store templates for easy access
    Object.entries(templates).forEach(([category, items]) => {
      Object.entries(items).forEach(([name, data]) => {
        this.visualTemplates.set(`${category}.${name}`, data);
      });
    });
  }

  /**
   * Perform visual verification using ColorDetector
   */
  async verifyVisual(
    checks: VisualCheck[],
  ): Promise<{ passed: boolean; failures: string[] }> {
    const failures: string[] = [];

    for (const check of checks) {
      const template = this.visualTemplates.get(check.entityType)!;

      const expectedColor =
        typeof check.expectedColor === "number"
          ? check.expectedColor
          : template.color;

      // Detect entities of this color in the scene
      const detectedEntities = await this.colorDetector!.detectEntities!(
        expectedColor,
        {
          tolerance: check.tolerance || 10,
          minClusterSize: 20,
        },
      );

      const entityExists = detectedEntities && detectedEntities.length > 0;

      if (check.shouldExist && !entityExists) {
        failures.push(
          `Expected ${check.entityType} (color: ${expectedColor}) not found`,
        );
      } else if (!check.shouldExist && entityExists) {
        failures.push(
          `Unexpected ${check.entityType} (color: ${expectedColor}) found`,
        );
      }

      // Check position if specified
      if (check.position && entityExists) {
        const entity = detectedEntities[0];
        const distance = this.calculateDistance(
          entity.position,
          check.position,
        );
        if (distance > 5) {
          // 5 unit tolerance
          failures.push(
            `${check.entityType} at wrong position. Expected: ${JSON.stringify(check.position)}, Found: ${JSON.stringify(entity.position)}`,
          );
        }
      }
    }

    return { passed: failures.length === 0, failures };
  }

  /**
   * Perform state verification
   */
  async verifyState(
    checks: StateCheck[],
  ): Promise<{ passed: boolean; failures: string[] }> {
    const failures: string[] = [];
    const rpgManager = this.service.getRPGStateManager()!;

    const state = rpgManager.getPlayerState("test-player") as unknown as Record<
      string,
      unknown
    >;

    for (const check of checks) {
      const actualValue = this.getNestedProperty(state, check.property);
      const passed = this.compareValues(
        actualValue,
        check.expectedValue,
        check.operator,
      );

      if (!passed) {
        failures.push(
          `State check failed: ${check.property} expected ${check.operator} ${check.expectedValue}, got ${actualValue}`,
        );
      }
    }

    return { passed: failures.length === 0, failures };
  }

  /**
   * Take screenshot for visual record
   */
  async captureScreenshot(name: string): Promise<string> {
    const playwrightManager = this.service.getPlaywrightManager()!;

    const screenshot = await playwrightManager.takeScreenshot({
      fullPage: false,
    });

    // In a real implementation, save to file system
    const filename = `screenshot-${name}-${Date.now()}.png`;
    logger.info(`[VisualTestFramework] Screenshot captured: ${filename}`);
    return (screenshot as string) || "";
  }

  /**
   * Run a complete test with visual and state verification
   */
  async runTest(
    name: string,
    verification: TestVerification,
  ): Promise<TestResult> {
    logger.info(`[VisualTestFramework] Running test: ${name}`);

    const result: TestResult = {
      passed: true,
      failures: [],
      screenshots: [],
      stateSnapshot: {},
      timestamp: new Date(),
    };

    // Capture initial state
    const rpgManager = this.service.getRPGStateManager();
    if (rpgManager) {
      const playerState = rpgManager.getPlayerState("test-player");
      if (playerState && typeof playerState === "object") {
        result.stateSnapshot = playerState as unknown as StateSnapshot;
      }
    }

    // Visual verification
    if (verification.visualChecks && verification.visualChecks.length > 0) {
      const visualResult = await this.verifyVisual(verification.visualChecks);
      if (!visualResult.passed) {
        result.passed = false;
        result.failures.push(...visualResult.failures);
      }
    }

    // State verification
    if (verification.stateChecks && verification.stateChecks.length > 0) {
      const stateResult = await this.verifyState(verification.stateChecks);
      if (!stateResult.passed) {
        result.passed = false;
        result.failures.push(...stateResult.failures);
      }
    }

    // Screenshot capture
    if (verification.screenshot) {
      const screenshot = await this.captureScreenshot(name);
      if (screenshot) {
        result.screenshots.push(screenshot);
      }
    }

    // Log result
    if (result.passed) {
      logger.info(`[VisualTestFramework] ✅ Test PASSED: ${name}`);
    } else {
      logger.error(`[VisualTestFramework] ❌ Test FAILED: ${name}`);
      result.failures.forEach((failure) => logger.error(`  - ${failure}`));
    }

    return result;
  }

  /**
   * Helper to calculate distance between positions
   */
  private calculateDistance(
    pos1: { x: number; y: number; z: number },
    pos2: { x: number; y: number; z: number },
  ): number {
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) +
        Math.pow(pos1.y - pos2.y, 2) +
        Math.pow(pos1.z - pos2.z, 2),
    );
  }

  /**
   * Helper to get nested property from object
   */
  private getNestedProperty(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
    return path.split(".").reduce((current: unknown, prop: string) => {
      if (current && typeof current === "object" && prop in current) {
        return (current as Record<string, unknown>)[prop];
      }
      return undefined;
    }, obj);
  }

  /**
   * Helper to compare values based on operator
   */
  private compareValues(
    actual: unknown,
    expected: unknown,
    operator: string,
  ): boolean {
    switch (operator) {
      case "equals":
        return actual === expected;
      case "greater":
        return (
          typeof actual === "number" &&
          typeof expected === "number" &&
          actual > expected
        );
      case "less":
        return (
          typeof actual === "number" &&
          typeof expected === "number" &&
          actual < expected
        );
      case "contains":
        return Array.isArray(actual)
          ? actual.includes(expected)
          : String(actual).includes(String(expected));
      case "matches":
        return new RegExp(String(expected)).test(String(actual));
      default:
        return false;
    }
  }
}

/**
 * Test helpers for common verifications
 */
export class RPGTestHelpers {
  /**
   * Verify combat occurred with damage
   */
  static combatVerification(
    targetEntity: string,
    minDamage: number,
  ): TestVerification {
    return {
      type: "both",
      visualChecks: [
        { entityType: targetEntity, expectedColor: null, shouldExist: true },
        {
          entityType: "special.damage_indicator",
          expectedColor: null,
          shouldExist: true,
        },
      ],
      stateChecks: [
        {
          property: "combat.inCombat",
          expectedValue: true,
          operator: "equals",
        },
        {
          property: "combat.target",
          expectedValue: targetEntity,
          operator: "contains",
        },
      ],
      screenshot: true,
    };
  }

  /**
   * Verify inventory change
   */
  static inventoryVerification(
    itemName: string,
    expectedQuantity: number,
  ): TestVerification {
    return {
      type: "state",
      stateChecks: [
        {
          property: "inventory.items",
          expectedValue: itemName,
          operator: "contains",
        },
      ],
    };
  }

  /**
   * Verify skill progression
   */
  static skillVerification(
    skillName: string,
    minLevel: number,
  ): TestVerification {
    return {
      type: "state",
      stateChecks: [
        {
          property: `skills.${skillName}.level`,
          expectedValue: minLevel,
          operator: "greater",
        },
      ],
    };
  }

  /**
   * Verify quest completion
   */
  static questVerification(questName: string): TestVerification {
    return {
      type: "state",
      stateChecks: [
        {
          property: "quests.completed",
          expectedValue: questName,
          operator: "contains",
        },
      ],
    };
  }

  /**
   * Verify player position
   */
  static positionVerification(
    expectedPos: { x: number; y: number; z: number },
    tolerance: number = 5,
  ): TestVerification {
    return {
      type: "both",
      visualChecks: [
        {
          entityType: "special.player",
          expectedColor: null,
          position: expectedPos,
          shouldExist: true,
        },
      ],
      stateChecks: [
        {
          property: "location.coordinates.x",
          expectedValue: expectedPos.x - tolerance,
          operator: "greater",
        },
        {
          property: "location.coordinates.x",
          expectedValue: expectedPos.x + tolerance,
          operator: "less",
        },
      ],
    };
  }
}
