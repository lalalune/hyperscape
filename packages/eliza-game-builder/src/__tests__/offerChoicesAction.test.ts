/**
 * OFFER_CHOICES — agent action tests.
 *
 * Phase B1'.4. Coverage:
 *   - validate gate
 *   - missing-param rejection
 *   - empty-array rejection
 *   - filters out malformed entries (no label / no prompt)
 *   - returns choices on data.choices
 *   - optional `question` surface
 */

import { describe, expect, it } from "vitest";
import { offerChoicesAction } from "../actions/offerChoices.js";
import { GameBuilderService } from "../services/GameBuilderService.js";
import { fixtureCatalog } from "./fixtures.js";
import { makeMessage, makeStubRuntime } from "./testRuntime.js";

function makeService(): GameBuilderService {
  return GameBuilderService.create({ catalog: fixtureCatalog });
}

describe("OFFER_CHOICES action", () => {
  it("validates true when service is registered", async () => {
    const { runtime } = makeStubRuntime({ service: makeService() });
    expect(await offerChoicesAction.validate(runtime, makeMessage(""))).toBe(
      true,
    );
  });

  it("rejects when `choices` parameter is missing", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await offerChoicesAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      undefined,
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("rejects when choices array is empty after filtering", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await offerChoicesAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      { choices: [{ label: "" }, { prompt: "" }] }, // both invalid
      callback,
    );
    expect(r?.success).toBe(false);
  });

  it("returns valid choices on data.choices", async () => {
    const { runtime, callback, calls } = makeStubRuntime({
      service: makeService(),
    });
    const r = await offerChoicesAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        choices: [
          { label: "RPG", prompt: "I want an RPG with combat" },
          { label: "Shooter", prompt: "I want a shooter game" },
        ],
      },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as
      | { choices: Array<{ label: string; prompt: string }> }
      | undefined;
    expect(data?.choices.length).toBe(2);
    expect(data?.choices[0]).toEqual({
      label: "RPG",
      prompt: "I want an RPG with combat",
    });
    expect(calls[0]?.action).toBe("OFFER_CHOICES");
  });

  it("filters out malformed entries (missing label or prompt)", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await offerChoicesAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        choices: [
          { label: "Valid", prompt: "good" },
          { label: "" }, // missing prompt + empty label
          { prompt: "no label" }, // missing label
          null, // not an object
          { label: "Also Valid", prompt: "also good" },
        ],
      },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { choices: Array<{ label: string }> } | undefined;
    expect(data?.choices.map((c) => c.label)).toEqual(["Valid", "Also Valid"]);
  });

  it("includes optional question on data.question", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await offerChoicesAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        question: "What gameplay focus?",
        choices: [
          { label: "Combat", prompt: "combat heavy" },
          { label: "Explore", prompt: "exploration focused" },
        ],
      },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as
      | { question: string | null; choices: unknown[] }
      | undefined;
    expect(data?.question).toBe("What gameplay focus?");
  });

  it("question defaults to null when not supplied", async () => {
    const { runtime, callback } = makeStubRuntime({ service: makeService() });
    const r = await offerChoicesAction.handler(
      runtime,
      makeMessage(""),
      undefined,
      {
        choices: [{ label: "A", prompt: "a" }],
      },
      callback,
    );
    expect(r?.success).toBe(true);
    const data = r?.data as { question: string | null } | undefined;
    expect(data?.question).toBeNull();
  });
});
