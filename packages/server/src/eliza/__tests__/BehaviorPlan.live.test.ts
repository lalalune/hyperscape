/**
 * Live LLM integration tests for ModelAgentSpawner behavior planning.
 *
 * These tests call the OpenRouter API with the exact prompts used
 * by createBehaviorPlan() and validate the responses parse correctly.
 *
 * Requires OPENROUTER_API_KEY in environment or server .env file.
 * Skipped automatically if no API key is available.
 */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

function getApiKey(): string | null {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;

  try {
    const envPath = path.resolve(__dirname, "../../../.env");
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(/OPENROUTER_API_KEY=(.+)/);
    return match?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

const API_KEY = getApiKey();
const describeIfKey = API_KEY ? describe : describe.skip;

async function callOpenRouter(
  prompt: string,
  maxTokens: number,
  retries = 3,
): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://hyperia.ai",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.3-70b-instruct:free",
          messages: [{ role: "user", content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.5,
        }),
      },
    );

    if (response.status === 429 && attempt < retries - 1) {
      console.log(
        `[Live Test] Rate limited, retrying in ${3 * (attempt + 1)}s...`,
      );
      continue;
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${err}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0]?.message?.content || "";
  }
  throw new Error("Max retries exceeded");
}

function buildBehaviorPrompt(scenario: {
  agentName: string;
  healthPct: string;
  inventoryCount: number;
  foodCount: number;
  inCombat: boolean;
  mobs: Array<{ name: string; distance: number }>;
  resources: Array<{ name: string; distance: number }>;
  items: Array<{ name: string; distance: number }>;
}): string {
  return [
    `You are ${scenario.agentName}, an OSRS-style RPG agent between arena duels.`,
    `Plan your next 3-5 actions to prepare for the next duel.`,
    ``,
    `STATE: HP ${scenario.healthPct}%, ${scenario.inventoryCount}/28 inventory, ${scenario.foodCount} food, ${scenario.inCombat ? "IN COMBAT" : "idle"}`,
    `NEARBY: ${scenario.mobs.length} mobs, ${scenario.resources.length} resources, ${scenario.items.length} ground items, 0 NPCs`,
    scenario.mobs.length > 0
      ? `MOBS: ${scenario.mobs.map((m) => `${m.name}(${m.distance}m)`).join(", ")}`
      : "",
    scenario.resources.length > 0
      ? `RESOURCES: ${scenario.resources.map((r) => `${r.name}(${r.distance}m)`).join(", ")}`
      : "",
    scenario.items.length > 0
      ? `ITEMS: ${scenario.items.map((i) => `${i.name}(${i.distance}m)`).join(", ")}`
      : "",
    ``,
    `PRIORITIES: Get food for duels > train combat > gather resources > explore`,
    `AVAILABLE ACTIONS: MOVE, ATTACK, GATHER, PICKUP, USE, EQUIP, EXPLORE, IDLE`,
    ``,
    `Respond as JSON: { "goal": "brief goal", "actions": [{"action": "ACTION", "target": "id or description", "reason": "why"}] }`,
  ]
    .filter(Boolean)
    .join("\n");
}

function parseBehaviorPlan(text: string) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  return JSON.parse(jsonMatch[0]);
}

const VALID_ACTIONS = new Set([
  "MOVE",
  "ATTACK",
  "GATHER",
  "PICKUP",
  "USE",
  "EQUIP",
  "EXPLORE",
  "IDLE",
  "COOK",
  "SMELT",
  "SMITH",
  "FIREMAKE",
]);

describeIfKey("ModelAgentSpawner Live LLM Behavior Planning", () => {
  it("produces valid plan with mobs and resources nearby", async () => {
    const prompt = buildBehaviorPrompt({
      agentName: "GPT-5 Arena Fighter",
      healthPct: "85",
      inventoryCount: 12,
      foodCount: 3,
      inCombat: false,
      mobs: [
        { name: "Goblin", distance: 15 },
        { name: "Bandit", distance: 25 },
      ],
      resources: [
        { name: "Oak Tree", distance: 10 },
        { name: "Fishing Spot", distance: 30 },
      ],
      items: [{ name: "Bronze Sword", distance: 5 }],
    });

    const response = await callOpenRouter(prompt, 300);
    console.log("[Live Test] Behavior plan response:", response);

    const plan = parseBehaviorPlan(response);
    expect(plan).not.toBeNull();
    expect(plan.goal).toBeDefined();
    expect(typeof plan.goal).toBe("string");
    expect(plan.actions).toBeDefined();
    expect(Array.isArray(plan.actions)).toBe(true);
    expect(plan.actions.length).toBeGreaterThanOrEqual(1);
    expect(plan.actions.length).toBeLessThanOrEqual(8);

    for (const action of plan.actions) {
      expect(action.action).toBeDefined();
      expect(typeof action.action).toBe("string");
      expect(VALID_ACTIONS.has(action.action.toUpperCase())).toBe(true);
      expect(typeof action.reason).toBe("string");
    }
  }, 60000);

  it("produces food-focused plan when low on food", async () => {
    const prompt = buildBehaviorPrompt({
      agentName: "Claude Duelist",
      healthPct: "90",
      inventoryCount: 5,
      foodCount: 0,
      inCombat: false,
      mobs: [],
      resources: [{ name: "Fishing Spot", distance: 12 }],
      items: [],
    });

    const response = await callOpenRouter(prompt, 300);
    console.log("[Live Test] Food-focused plan:", response);

    const plan = parseBehaviorPlan(response);
    expect(plan).not.toBeNull();
    expect(plan.actions.length).toBeGreaterThanOrEqual(1);

    const hasGatherOrMove = plan.actions.some(
      (a: { action: string }) =>
        a.action.toUpperCase() === "GATHER" ||
        a.action.toUpperCase() === "MOVE",
    );
    expect(hasGatherOrMove).toBe(true);
  }, 60000);

  it("produces combat plan when mobs are close", async () => {
    const prompt = buildBehaviorPrompt({
      agentName: "Grok Fighter",
      healthPct: "95",
      inventoryCount: 20,
      foodCount: 8,
      inCombat: false,
      mobs: [
        { name: "Goblin", distance: 3 },
        { name: "Goblin", distance: 8 },
      ],
      resources: [],
      items: [{ name: "Bones", distance: 2 }],
    });

    const response = await callOpenRouter(prompt, 300);
    console.log("[Live Test] Combat plan:", response);

    const plan = parseBehaviorPlan(response);
    expect(plan).not.toBeNull();
    expect(plan.actions.length).toBeGreaterThanOrEqual(1);
  }, 60000);

  it("produces exploration plan in empty area", async () => {
    const prompt = buildBehaviorPrompt({
      agentName: "Explorer Bot",
      healthPct: "100",
      inventoryCount: 2,
      foodCount: 1,
      inCombat: false,
      mobs: [],
      resources: [],
      items: [],
    });

    const response = await callOpenRouter(prompt, 300);
    console.log("[Live Test] Empty area plan:", response);

    const plan = parseBehaviorPlan(response);
    expect(plan).not.toBeNull();
    expect(plan.actions.length).toBeGreaterThanOrEqual(1);

    const hasMovement = plan.actions.some(
      (a: { action: string }) =>
        a.action.toUpperCase() === "EXPLORE" ||
        a.action.toUpperCase() === "MOVE",
    );
    expect(hasMovement).toBe(true);
  }, 60000);
});
