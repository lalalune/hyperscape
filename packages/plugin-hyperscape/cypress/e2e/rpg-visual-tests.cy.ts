/**
 * Cypress E2E Visual Tests for Hyperscape RPG
 * Real tests with visual verification and state assertions
 */

// Visual color constants from templates
const VISUAL_COLORS = {
  player: "#FF4543",
  goblin: "#228822",
  damageIndicator: "#FF0000",
  healIndicator: "#00FF00",
  sword: "#FF4444",
  questGiver: "#FFFF00",
  ironRock: "#404040",
  goldRock: "#FFD700",
};

describe("Hyperscape RPG Visual Tests", () => {
  beforeEach(() => {
    // Connect to Hyperscape world
    cy.visit("http://localhost:5555");

    // Wait for world to load
    cy.get("#hyperscape-world-canvas", { timeout: 10000 }).should("be.visible");

    // Login as test agent
    cy.window().then((win) => {
      win.hyperscapeLogin("TestAgent", "test-token");
    });

    // Wait for spawn
    cy.wait(2000);
  });

  describe("Combat System", () => {
    it("should deal damage when attacking", () => {
      // Take baseline screenshot
      cy.screenshot("combat-baseline");

      // Get initial health
      cy.window().then(async (win) => {
        const initialHealth = await win.getPlayerState()?.health?.current;
        cy.wrap(initialHealth).as("initialHealth");
      });

      // Find goblin by color
      cy.get("#hyperscape-world-canvas").then(($canvas) => {
        const canvas = $canvas[0] as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Look for goblin green color
        const goblinPosition = findColorInCanvas(
          imageData,
          VISUAL_COLORS.goblin,
        );
        expect(goblinPosition).to.not.be.null;

        // Click on goblin to target
        cy.get("#hyperscape-world-canvas").click(
          goblinPosition.x,
          goblinPosition.y,
        );
      });

      // Attack
      cy.get('[data-action="attack"]').click();

      // Wait for combat animation
      cy.wait(1000);

      // Verify damage indicator appears
      cy.get("#hyperscape-world-canvas").then(($canvas) => {
        const canvas = $canvas[0] as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Look for red damage numbers
        const damageIndicator = findColorInCanvas(
          imageData,
          VISUAL_COLORS.damageIndicator,
        );
        expect(damageIndicator).to.not.be.null;
      });

      // Verify health decreased
      cy.get("@initialHealth").then((initialHealth) => {
        cy.window().then(async (win) => {
          const currentHealth = await win.getPlayerState()?.health?.current;
          expect(currentHealth).to.be.lessThan(initialHealth);
        });
      });

      // Take combat screenshot
      cy.screenshot("combat-damage-dealt");
    });

    it("should show combat animations", () => {
      // Start recording video
      cy.get("#hyperscape-world-canvas").should("be.visible");

      // Attack sequence
      cy.get('[data-action="attack"]').click();

      // Capture multiple frames
      for (let i = 0; i < 5; i++) {
        cy.wait(200);
        cy.screenshot(`combat-animation-frame-${i}`);
      }

      // Verify animation occurred by comparing frames
      cy.task("compareScreenshots", {
        baseline: "combat-animation-frame-0",
        comparison: "combat-animation-frame-4",
      }).then((difference) => {
        expect(difference).to.be.greaterThan(0.05); // 5% difference threshold
      });
    });
  });

  describe("Inventory System", () => {
    it("should add items when picked up", () => {
      // Get initial inventory
      cy.window().then(async (win) => {
        const inventory = await win.getPlayerState()?.inventory;
        cy.wrap(inventory.items.length).as("initialItemCount");
      });

      // Find sword on ground by color
      cy.get("#hyperscape-world-canvas").then(($canvas) => {
        const canvas = $canvas[0] as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const swordPosition = findColorInCanvas(imageData, VISUAL_COLORS.sword);
        expect(swordPosition).to.not.be.null;

        // Move to sword
        cy.get("#hyperscape-world-canvas").click(
          swordPosition.x,
          swordPosition.y,
        );
      });

      // Pick up item
      cy.get('[data-action="pickup"]').click();
      cy.wait(500);

      // Verify inventory updated
      cy.get("@initialItemCount").then((initialCount) => {
        cy.window().then(async (win) => {
          const inventory = await win.getPlayerState()?.inventory;
          expect(inventory.items.length).to.be.greaterThan(initialCount);

          // Verify sword is in inventory
          const hasSword = inventory.items.some((item) =>
            item.name.includes("sword"),
          );
          expect(hasSword).to.be.true;
        });
      });

      // Verify visual disappears
      cy.get("#hyperscape-world-canvas").then(($canvas) => {
        const canvas = $canvas[0] as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const swordPosition = findColorInCanvas(imageData, VISUAL_COLORS.sword);
        expect(swordPosition).to.be.null; // Should be gone
      });
    });

    it("should show equipped items visually", () => {
      // Equip sword
      cy.get('[data-inventory-slot="weapon"]').click();
      cy.get('[data-item="bronze_sword"]').click();
      cy.get('[data-action="equip"]').click();

      // Verify visual change
      cy.screenshot("equipped-sword");

      // Check player model has sword attached
      cy.get("#hyperscape-world-canvas").then(($canvas) => {
        const canvas = $canvas[0] as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Find player
        const playerPos = findColorInCanvas(imageData, VISUAL_COLORS.player);

        // Check for sword color near player
        const swordNearPlayer = findColorNearPosition(
          imageData,
          VISUAL_COLORS.sword,
          playerPos,
          50, // 50 pixel radius
        );

        expect(swordNearPlayer).to.not.be.null;
      });
    });
  });

  describe("Quest System", () => {
    it("should show quest markers above NPCs", () => {
      // Look for yellow quest marker
      cy.get("#hyperscape-world-canvas").then(($canvas) => {
        const canvas = $canvas[0] as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const questMarker = findColorInCanvas(
          imageData,
          VISUAL_COLORS.questGiver,
        );
        expect(questMarker).to.not.be.null;
      });

      cy.screenshot("quest-marker-visible");
    });

    it("should update quest log when accepting quest", () => {
      // Click on quest giver
      cy.get("#hyperscape-world-canvas").then(($canvas) => {
        const canvas = $canvas[0] as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const questGiverPos = findColorInCanvas(
          imageData,
          VISUAL_COLORS.questGiver,
        );
        cy.get("#hyperscape-world-canvas").click(
          questGiverPos.x,
          questGiverPos.y,
        );
      });

      // Accept quest dialog
      cy.get('[data-dialog="quest"]').should("be.visible");
      cy.get('[data-action="accept-quest"]').click();

      // Verify quest added to log
      cy.window().then(async (win) => {
        const quests = await win.getPlayerState()?.quests;
        expect(quests.active.length).to.be.greaterThan(0);

        const goblinQuest = quests.active.find((q) => q.id === "goblin_menace");
        expect(goblinQuest).to.exist;
        expect(goblinQuest.objectives[0].completed).to.be.false;
      });

      // Verify quest UI updated
      cy.get("[data-quest-tracker]").should("contain", "Goblin Menace");
      cy.get("[data-quest-objective]").should("contain", "Kill 5 goblins");
    });
  });

  describe("Skills System", () => {
    it("should gain experience when mining", () => {
      // Get initial mining XP
      cy.window().then(async (win) => {
        const skills = await win.getPlayerState()?.skills;
        cy.wrap(skills.mining?.experience || 0).as("initialMiningXP");
      });

      // Find iron rock
      cy.get("#hyperscape-world-canvas").then(($canvas) => {
        const canvas = $canvas[0] as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const rockPos = findColorInCanvas(imageData, VISUAL_COLORS.ironRock);
        expect(rockPos).to.not.be.null;

        cy.get("#hyperscape-world-canvas").click(rockPos.x, rockPos.y);
      });

      // Start mining
      cy.get('[data-action="mine"]').click();

      // Wait for mining animation
      cy.wait(3000);

      // Verify XP gained
      cy.get("@initialMiningXP").then((initialXP) => {
        cy.window().then(async (win) => {
          const skills = await win.getPlayerState()?.skills;
          expect(skills.mining.experience).to.be.greaterThan(initialXP);
        });
      });

      // Verify visual feedback
      cy.get("[data-xp-notification]").should("be.visible");
      cy.get("[data-xp-notification]").should("contain", "+25 Mining XP");
    });
  });

  describe("Multi-player Synchronization", () => {
    it("should show other players moving", () => {
      // Take initial screenshot
      cy.screenshot("multiplayer-initial");

      // Count initial players
      cy.get("#hyperscape-world-canvas").then(($canvas) => {
        const canvas = $canvas[0] as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const playerPositions = findAllColorInCanvas(
          imageData,
          VISUAL_COLORS.player,
        );
        cy.wrap(playerPositions.length).as("playerCount");
      });

      // Wait for movement
      cy.wait(5000);

      // Verify positions changed
      cy.get("#hyperscape-world-canvas").then(($canvas) => {
        const canvas = $canvas[0] as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const newPlayerPositions = findAllColorInCanvas(
          imageData,
          VISUAL_COLORS.player,
        );

        // Should still see players
        cy.get("@playerCount").then((count) => {
          expect(newPlayerPositions.length).to.equal(count);
        });
      });

      // Compare screenshots to verify movement
      cy.screenshot("multiplayer-after-movement");
      cy.task("compareScreenshots", {
        baseline: "multiplayer-initial",
        comparison: "multiplayer-after-movement",
      }).then((difference) => {
        expect(difference).to.be.greaterThan(0.01); // Movement detected
      });
    });
  });
});

// Helper functions
function findColorInCanvas(
  imageData: ImageData,
  hexColor: string,
): { x: number; y: number } | null {
  const rgb = hexToRgb(hexColor);
  const data = imageData.data;
  const width = imageData.width;

  for (let i = 0; i < data.length; i += 4) {
    if (colorMatch(data[i], data[i + 1], data[i + 2], rgb.r, rgb.g, rgb.b)) {
      const pixelIndex = i / 4;
      return {
        x: pixelIndex % width,
        y: Math.floor(pixelIndex / width),
      };
    }
  }

  return null;
}

function findAllColorInCanvas(
  imageData: ImageData,
  hexColor: string,
): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const rgb = hexToRgb(hexColor);
  const data = imageData.data;
  const width = imageData.width;

  for (let i = 0; i < data.length; i += 4) {
    if (colorMatch(data[i], data[i + 1], data[i + 2], rgb.r, rgb.g, rgb.b)) {
      const pixelIndex = i / 4;
      positions.push({
        x: pixelIndex % width,
        y: Math.floor(pixelIndex / width),
      });
    }
  }

  return positions;
}

function findColorNearPosition(
  imageData: ImageData,
  hexColor: string,
  position: { x: number; y: number },
  radius: number,
): { x: number; y: number } | null {
  const rgb = hexToRgb(hexColor);
  const data = imageData.data;
  const width = imageData.width;

  for (
    let y = Math.max(0, position.y - radius);
    y < Math.min(imageData.height, position.y + radius);
    y++
  ) {
    for (
      let x = Math.max(0, position.x - radius);
      x < Math.min(width, position.x + radius);
      x++
    ) {
      const distance = Math.sqrt(
        Math.pow(x - position.x, 2) + Math.pow(y - position.y, 2),
      );
      if (distance <= radius) {
        const i = (y * width + x) * 4;
        if (
          colorMatch(data[i], data[i + 1], data[i + 2], rgb.r, rgb.g, rgb.b)
        ) {
          return { x, y };
        }
      }
    }
  }

  return null;
}

function colorMatch(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
  tolerance = 10,
): boolean {
  return (
    Math.abs(r1 - r2) <= tolerance &&
    Math.abs(g1 - g2) <= tolerance &&
    Math.abs(b1 - b2) <= tolerance
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}
