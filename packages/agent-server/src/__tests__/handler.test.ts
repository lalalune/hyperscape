/**
 * Handler tests. Validate the request → agent loop → response chain
 * end-to-end with a `FakeLLM`. No real API calls.
 */

import { describe, expect, it } from "vitest";
import { FakeLLM, textBlock, toolUseBlock } from "@hyperforge/agent-runner";
import { GameBuilderService } from "@hyperforge/eliza-game-builder";
import type { StaticCatalogDocument } from "@hyperforge/widget-catalog";
import { handleDesignRequest, parseDesignRequest } from "../handler.js";

const fixtureCatalog: StaticCatalogDocument = {
  version: 1,
  builtAt: "2026-04-28T19:00:00.000Z",
  widgets: [
    {
      id: "com.test.demo.alpha",
      name: "Alpha",
      description: "First widget",
      category: "panel",
      defaultSize: { width: 4, height: 3 },
      icon: "",
      props: [],
      defaultProps: {},
      jsdocSummary: "",
      sourcePath: "",
    },
  ],
  stats: { total: 1, byCategory: { panel: 1 } },
};

function makeService(): GameBuilderService {
  return GameBuilderService.create({ catalog: fixtureCatalog });
}

const validPack = {
  version: 1,
  id: "test-pack",
  name: "Test Pack",
  widgets: [{ id: "com.test.demo.alpha" }],
  layouts: {
    default: {
      id: "x",
      name: "y",
      revision: 1,
      instances: [
        {
          instanceId: "i1",
          widgetId: "com.test.demo.alpha",
          position: {
            kind: "anchored",
            anchor: "top-left",
            offset: { x: 0, y: 0 },
          },
          props: {},
        },
      ],
    },
  },
};

describe("parseDesignRequest", () => {
  it("accepts a valid body", () => {
    const r = parseDesignRequest({ prompt: "design a HUD" });
    expect("ok" in r && r.ok === false).toBe(false);
    expect((r as { prompt: string }).prompt).toBe("design a HUD");
  });

  it("rejects non-object body", () => {
    const r = parseDesignRequest("not an object");
    expect("ok" in r && r.ok === false).toBe(true);
  });

  it("rejects missing prompt field", () => {
    const r = parseDesignRequest({});
    if (!("ok" in r) || r.ok !== false) throw new Error("should be error");
    expect(r.code).toBe("MISSING_PROMPT");
  });

  it("forwards optional model + maxTurns", () => {
    const r = parseDesignRequest({
      prompt: "x",
      model: "claude-haiku",
      maxTurns: 3,
    }) as { model: string; maxTurns: number };
    expect(r.model).toBe("claude-haiku");
    expect(r.maxTurns).toBe(3);
  });
});

describe("handleDesignRequest", () => {
  it("returns ok with pack when agent emits PROPOSE_UI_PACK", async () => {
    const llm = new FakeLLM([
      { content: [toolUseBlock("u1", "GET_CATALOG_STATS", {})] },
      {
        content: [toolUseBlock("u2", "PROPOSE_UI_PACK", { pack: validPack })],
      },
      {
        content: [textBlock("Done.")],
        stop_reason: "end_turn",
      },
    ]);

    const result = await handleDesignRequest(
      { prompt: "design a HUD" },
      { llm, service: makeService() },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pack).toBeDefined();
    expect((result.pack as { id: string }).id).toBe("test-pack");
    expect(result.finalText).toContain("Done");
    expect(result.turns).toBe(3);
    expect(result.truncated).toBe(false);
  });

  it("returns ok with null pack when agent never proposes", async () => {
    const llm = new FakeLLM([
      {
        content: [textBlock("I won't design today.")],
        stop_reason: "end_turn",
      },
    ]);
    const result = await handleDesignRequest(
      { prompt: "hi" },
      { llm, service: makeService() },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pack).toBeNull();
  });

  it("returns MISSING_PROMPT error for empty prompt", async () => {
    const llm = new FakeLLM([]);
    const result = await handleDesignRequest(
      { prompt: "   " },
      { llm, service: makeService() },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("MISSING_PROMPT");
  });

  it("returns AGENT_FAILED when llm throws", async () => {
    const llm = {
      async sendMessage() {
        throw new Error("connection refused");
      },
    };
    const result = await handleDesignRequest(
      { prompt: "design something" },
      { llm, service: makeService() },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("AGENT_FAILED");
    expect(result.error).toContain("connection refused");
  });

  it("forwards onTurn callback to the loop", async () => {
    const llm = new FakeLLM([
      { content: [toolUseBlock("u1", "GET_CATALOG_STATS", {})] },
      { content: [textBlock("done")], stop_reason: "end_turn" },
    ]);
    const seen: Array<{ turn: number; calls: ReadonlyArray<string> }> = [];
    await handleDesignRequest(
      { prompt: "x" },
      {
        llm,
        service: makeService(),
        onTurn: (turn, calls) => seen.push({ turn, calls }),
      },
    );
    expect(seen.length).toBe(2);
    expect(seen[0]!.calls).toEqual(["GET_CATALOG_STATS"]);
    expect(seen[1]!.calls).toEqual([]);
  });

  it("fires onTurnDetail with assistant text + tool call results (B1'.7)", async () => {
    const llm = new FakeLLM([
      {
        content: [
          textBlock("Looking up the catalog…"),
          toolUseBlock("u1", "GET_CATALOG_STATS", {}),
        ],
      },
      { content: [textBlock("Done.")], stop_reason: "end_turn" },
    ]);
    const seen: Array<{
      turn: number;
      assistantText: string;
      toolCalls: ReadonlyArray<{
        name: string;
        success: boolean;
        data: unknown;
      }>;
    }> = [];
    await handleDesignRequest(
      { prompt: "x" },
      {
        llm,
        service: makeService(),
        onTurnDetail: (d) =>
          seen.push({
            turn: d.turn,
            assistantText: d.assistantText,
            toolCalls: d.toolCalls,
          }),
      },
    );
    expect(seen.length).toBe(2);
    expect(seen[0]!.assistantText).toBe("Looking up the catalog…");
    expect(seen[0]!.toolCalls).toHaveLength(1);
    expect(seen[0]!.toolCalls[0]!.name).toBe("GET_CATALOG_STATS");
    expect(seen[0]!.toolCalls[0]!.success).toBe(true);
    expect(seen[1]!.assistantText).toBe("Done.");
    expect(seen[1]!.toolCalls).toHaveLength(0);
  });

  it("respects per-request maxTurns", async () => {
    // Endless tool calls — should hit maxTurns=2 and report truncated.
    const llm = new FakeLLM([
      { content: [toolUseBlock("u1", "GET_CATALOG_STATS", {})] },
      { content: [toolUseBlock("u2", "GET_CATALOG_STATS", {})] },
    ]);
    const result = await handleDesignRequest(
      { prompt: "loop", maxTurns: 2 },
      { llm, service: makeService() },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.truncated).toBe(true);
    expect(result.turns).toBe(2);
  });
});

// ============================================================
// B1'.2.2 — Onboarding mode: multi-action plan aggregation
// ============================================================

describe("handleDesignRequest — onboarding mode", () => {
  it("aggregates terrain config + plugin set + npcs + uiPack into plan", async () => {
    const llm = new FakeLLM([
      // One turn that emits all four PROPOSE_* actions in parallel
      // — the realistic onboarding shape.
      {
        content: [
          toolUseBlock("u1", "PROPOSE_TERRAIN_CONFIG", {
            config: { seed: 42, preset: "small-island" },
          }),
          toolUseBlock("u2", "PROPOSE_PLUGIN_SET", {
            pluginIds: ["com.hyperforge.hyperscape"],
          }),
          toolUseBlock("u3", "PROPOSE_NPC_PLACEMENT", {
            entity: {
              id: "shopkeeper_01",
              type: "shopkeeper",
              position: { x: 10, y: 0, z: -5 },
            },
          }),
          toolUseBlock("u4", "PROPOSE_NPC_PLACEMENT", {
            entity: {
              id: "questgiver_01",
              type: "questgiver",
              position: { x: 0, y: 0, z: 0 },
            },
          }),
          toolUseBlock("u5", "PROPOSE_UI_PACK", { pack: validPack }),
        ],
      },
      // Final text-only turn to stop the loop. Without this, the
      // FakeLLM script runs out and the loop throws.
      { content: [textBlock("Done. Project plan ready.")] },
    ]);
    const result = await handleDesignRequest(
      { prompt: "build me a tiny island RPG", mode: "onboarding" },
      { llm, service: makeService() },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.terrainConfig).toEqual({
      seed: 42,
      preset: "small-island",
    });
    expect(result.plan.pluginIds).toEqual(["com.hyperforge.hyperscape"]);
    expect(result.plan.npcs.length).toBe(2);
    expect(result.plan.uiPack).toBeDefined();
    expect(result.pack).toBeDefined(); // backwards-compat surface
  });

  it("plan fields are null when actions don't emit them", async () => {
    const llm = new FakeLLM([
      // Onboarding mode but agent only emits a UI pack — others
      // stay null in the plan.
      {
        content: [toolUseBlock("u1", "PROPOSE_UI_PACK", { pack: validPack })],
      },
      { content: [textBlock("Done.")] },
    ]);
    const result = await handleDesignRequest(
      { prompt: "just give me a HUD", mode: "onboarding" },
      { llm, service: makeService() },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.terrainConfig).toBeNull();
    expect(result.plan.pluginIds).toBeNull();
    expect(result.plan.npcs).toEqual([]);
    expect(result.plan.uiPack).toBeDefined();
  });

  it("HUD mode (default) does not surface non-pack plan fields", async () => {
    const llm = new FakeLLM([
      {
        content: [toolUseBlock("u1", "PROPOSE_UI_PACK", { pack: validPack })],
      },
      { content: [textBlock("Done.")] },
    ]);
    const result = await handleDesignRequest(
      { prompt: "make a HUD" }, // no mode → default "hud"
      { llm, service: makeService() },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.uiPack).toBeDefined();
    expect(result.plan.terrainConfig).toBeNull();
    expect(result.plan.pluginIds).toBeNull();
    expect(result.plan.npcs).toEqual([]);
  });

  it("aggregates the LAST emission when an action fires multiple times", async () => {
    const llm = new FakeLLM([
      {
        content: [
          toolUseBlock("u1", "PROPOSE_TERRAIN_CONFIG", {
            config: { seed: 1 },
          }),
          toolUseBlock("u2", "PROPOSE_TERRAIN_CONFIG", {
            config: { seed: 999 },
          }),
        ],
      },
      { content: [textBlock("Done.")] },
    ]);
    const result = await handleDesignRequest(
      { prompt: "revise terrain", mode: "onboarding" },
      { llm, service: makeService() },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.terrainConfig).toEqual({ seed: 999 });
  });

  it("REMOVE_FROM_PROJECT applies to the in-run aggregate (A4)", async () => {
    const llm = new FakeLLM([
      {
        content: [
          toolUseBlock("u1", "PROPOSE_NPC_PLACEMENT", {
            entity: {
              id: "npc-keep",
              type: "shopkeeper",
              position: { x: 0, y: 0, z: 0 },
            },
          }),
          toolUseBlock("u2", "PROPOSE_NPC_PLACEMENT", {
            entity: {
              id: "npc-drop",
              type: "guard",
              position: { x: 5, y: 0, z: 5 },
            },
          }),
          toolUseBlock("u3", "PROPOSE_MOB_SPAWN", {
            spawn: {
              mobId: "goblin",
              position: { x: 12, y: 0, z: 8 },
              maxCount: 3,
              spawnRadius: 5,
            },
          }),
          toolUseBlock("u4", "REMOVE_FROM_PROJECT", {
            removal: { kind: "npc", id: "npc-drop" },
          }),
          toolUseBlock("u5", "REMOVE_FROM_PROJECT", {
            removal: {
              kind: "mobSpawn",
              mobId: "goblin",
              position: { x: 12, y: 0, z: 8 },
            },
          }),
        ],
      },
      { content: [textBlock("Cleaned up.")] },
    ]);
    const result = await handleDesignRequest(
      { prompt: "place stuff and remove some", mode: "onboarding" },
      { llm, service: makeService() },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.npcs).toHaveLength(1);
    expect((result.plan.npcs[0] as { id: string }).id).toBe("npc-keep");
    // mobSpawns lives at runtime on the plan but the type doesn't
    // expose it directly — verify via a cast.
    const plan = result.plan as unknown as { mobSpawns: unknown[] };
    expect(plan.mobSpawns).toHaveLength(0);
  });
});

describe("handleDesignRequest — OFFER_CHOICES surfacing (B1'.4)", () => {
  it("surfaces the last OFFER_CHOICES emission on response.choices", async () => {
    const llm = new FakeLLM([
      {
        content: [
          toolUseBlock("u1", "OFFER_CHOICES", {
            question: "What gameplay focus?",
            choices: [
              { label: "Combat", prompt: "I want combat-heavy" },
              { label: "Explore", prompt: "I want exploration" },
            ],
          }),
        ],
      },
      { content: [textBlock("Pick one of the choices above.")] },
    ]);
    const result = await handleDesignRequest(
      { prompt: "help me start", mode: "onboarding" },
      { llm, service: makeService() },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.choices).not.toBeNull();
    expect(result.choices?.question).toBe("What gameplay focus?");
    expect(result.choices?.choices.length).toBe(2);
    expect(result.choices?.choices[0]?.label).toBe("Combat");
  });

  it("response.choices is null when last turn didn't offer choices", async () => {
    const llm = new FakeLLM([
      {
        content: [
          toolUseBlock("u1", "OFFER_CHOICES", {
            choices: [{ label: "A", prompt: "a" }],
          }),
        ],
      },
      // Subsequent turn moved past choices to a proposal.
      {
        content: [
          toolUseBlock("u2", "PROPOSE_TERRAIN_CONFIG", {
            config: { seed: 1 },
          }),
        ],
      },
      { content: [textBlock("Done.")] },
    ]);
    const result = await handleDesignRequest(
      { prompt: "x", mode: "onboarding" },
      { llm, service: makeService() },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Latest turn was PROPOSE_TERRAIN_CONFIG — choices is null.
    expect(result.choices).toBeNull();
  });

  it("response.choices is null when no OFFER_CHOICES was emitted", async () => {
    const llm = new FakeLLM([
      { content: [textBlock("Hello, no chips here.")] },
    ]);
    const result = await handleDesignRequest(
      { prompt: "hi", mode: "onboarding" },
      { llm, service: makeService() },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.choices).toBeNull();
  });
});

describe("parseDesignRequest — mode field", () => {
  it("accepts mode: 'hud'", () => {
    const r = parseDesignRequest({ prompt: "x", mode: "hud" });
    if ("ok" in r) throw new Error("should not be an error");
    expect(r.mode).toBe("hud");
  });
  it("accepts mode: 'onboarding'", () => {
    const r = parseDesignRequest({ prompt: "x", mode: "onboarding" });
    if ("ok" in r) throw new Error("should not be an error");
    expect(r.mode).toBe("onboarding");
  });
  it("accepts mode: 'companion' (F2)", () => {
    const r = parseDesignRequest({ prompt: "x", mode: "companion" });
    if ("ok" in r) throw new Error("should not be an error");
    expect(r.mode).toBe("companion");
  });
  it("ignores unknown mode (defaults to undefined → hud)", () => {
    const r = parseDesignRequest({ prompt: "x", mode: "unknown-thing" });
    if ("ok" in r) throw new Error("should not be an error");
    expect(r.mode).toBeUndefined();
  });
});

describe("parseDesignRequest — history field (B1'.7)", () => {
  it("parses an empty history array", () => {
    const r = parseDesignRequest({ prompt: "x", history: [] });
    if ("ok" in r) throw new Error("should not be an error");
    expect(r.history).toEqual([]);
  });

  it("parses a valid history array with both roles", () => {
    const r = parseDesignRequest({
      prompt: "next",
      history: [
        { role: "user", text: "hi" },
        { role: "assistant", text: "hello — what kind of game?" },
      ],
    });
    if ("ok" in r) throw new Error("should not be an error");
    expect(r.history).toHaveLength(2);
    expect(r.history?.[0]).toEqual({ role: "user", text: "hi" });
    expect(r.history?.[1]).toEqual({
      role: "assistant",
      text: "hello — what kind of game?",
    });
  });

  it("filters out malformed turns (missing text, bad role, non-objects)", () => {
    const r = parseDesignRequest({
      prompt: "x",
      history: [
        { role: "user", text: "good" },
        { role: "system", text: "bad role" },
        { role: "user" }, // missing text
        null,
        "not an object",
        { role: "assistant", text: "ok" },
      ],
    });
    if ("ok" in r) throw new Error("should not be an error");
    expect(r.history).toHaveLength(2);
    expect(r.history?.[0]?.text).toBe("good");
    expect(r.history?.[1]?.text).toBe("ok");
  });

  it("history undefined when not provided", () => {
    const r = parseDesignRequest({ prompt: "x" });
    if ("ok" in r) throw new Error("should not be an error");
    expect(r.history).toBeUndefined();
  });
});

describe("handleDesignRequest — conversation history (B1'.7)", () => {
  // FakeLLM's seenRequests holds the live `messages` reference,
  // and runAgentLoop appends the assistant turn AFTER each call.
  // So the first call's `messages` will, by the time we inspect
  // it, include 1 extra assistant entry. Check the user-side
  // prefix instead of the total length.

  it("replays prior turns as Anthropic messages so the agent has context", async () => {
    const llm = new FakeLLM([
      { content: [textBlock("OK — you want a fantasy RPG. Got it.")] },
    ]);
    const result = await handleDesignRequest(
      {
        prompt: "yes, RPG",
        mode: "onboarding",
        history: [
          { role: "user", text: "I want to make a game" },
          { role: "assistant", text: "What genre?" },
        ],
      },
      { llm, service: makeService() },
    );
    expect(result.ok).toBe(true);
    const firstCall = llm.seenRequests[0];
    expect(firstCall).toBeDefined();
    // The first 3 entries are what the handler built; #4 is
    // FakeLLM's own assistant reply pushed by the loop.
    expect(firstCall!.messages[0]?.role).toBe("user");
    expect(firstCall!.messages[0]?.content).toContain("I want to make a game");
    expect(firstCall!.messages[1]?.role).toBe("assistant");
    expect(firstCall!.messages[1]?.content).toBe("What genre?");
    expect(firstCall!.messages[2]?.role).toBe("user");
    expect(firstCall!.messages[2]?.content).toContain("yes, RPG");
  });

  it("collapses adjacent same-role turns + appends prompt to trailing user turn", async () => {
    const llm = new FakeLLM([{ content: [textBlock("ok")] }]);
    await handleDesignRequest(
      {
        prompt: "more context",
        mode: "onboarding",
        history: [
          { role: "user", text: "one" },
          { role: "user", text: "two" }, // collapses with previous
          { role: "assistant", text: "got it" },
          { role: "user", text: "three" },
        ],
      },
      { llm, service: makeService() },
    );
    const firstCall = llm.seenRequests[0];
    expect(firstCall).toBeDefined();
    // Handler-built entries: [user(one+two), assistant(got it), user(three+more context)].
    expect(firstCall!.messages[0]?.role).toBe("user");
    expect(firstCall!.messages[0]?.content).toContain("one");
    expect(firstCall!.messages[0]?.content).toContain("two");
    expect(firstCall!.messages[1]?.role).toBe("assistant");
    expect(firstCall!.messages[2]?.role).toBe("user");
    expect(firstCall!.messages[2]?.content).toContain("three");
    expect(firstCall!.messages[2]?.content).toContain("more context");
  });

  it("works without history (back-compat)", async () => {
    const llm = new FakeLLM([{ content: [textBlock("ok")] }]);
    const result = await handleDesignRequest(
      { prompt: "design a HUD", mode: "hud" },
      { llm, service: makeService() },
    );
    expect(result.ok).toBe(true);
    const firstCall = llm.seenRequests[0];
    expect(firstCall!.messages[0]?.role).toBe("user");
    expect(firstCall!.messages[0]?.content).toContain("design a HUD");
  });
});
