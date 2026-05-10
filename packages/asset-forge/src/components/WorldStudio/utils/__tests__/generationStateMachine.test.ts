/**
 * `generationStateMachine` — wizard state machine tests.
 *
 * The 3-stage wizard (Towns → Roads & Zones → Population) is
 * coordinated by an explicit state machine with 7 states. Invalid
 * transitions are rejected — e.g. you can't START_APPLY from
 * `idle`, can't GENERATION_COMPLETE while `applying`. Tests pin
 * down the canonical transition table + the per-action guards
 * + the per-stage cascading invalidation in REGENERATE_STEP.
 */

import { describe, expect, it } from "vitest";
import {
  createInitialMachineState,
  getValidTransitions,
  isValidTransition,
  machineReducer,
  WIZARD_STEPS,
  type GenerationMachineState,
  type MachineAction,
} from "../generationStateMachine";

const init = createInitialMachineState;

function dispatch(
  state: GenerationMachineState,
  action: MachineAction,
): GenerationMachineState {
  return machineReducer(state, action);
}

describe("createInitialMachineState", () => {
  it("returns the canonical zero state", () => {
    const s = init();
    expect(s.current).toBe("idle");
    expect(s.stepIndex).toBe(0);
    expect(s.progress).toBe(0);
    expect(s.progressLabel).toBe("");
    expect(s.errorMessage).toBeNull();
    expect(s.recoverable).toBe(false);
    expect(s.batchId).toBeNull();
    expect(s.completedSteps.size).toBe(0);
    expect(s.stageResults).toEqual({});
  });

  it("returns a fresh object each call", () => {
    const a = init();
    const b = init();
    expect(a).not.toBe(b);
    expect(a.completedSteps).not.toBe(b.completedSteps);
  });
});

describe("WIZARD_STEPS", () => {
  it("has exactly 3 stages — Towns / Roads & Zones / Population", () => {
    expect(WIZARD_STEPS).toHaveLength(3);
    expect(WIZARD_STEPS[0].name).toBe("Towns");
    expect(WIZARD_STEPS[1].name).toBe("Roads & Zones");
    expect(WIZARD_STEPS[2].name).toBe("Population");
  });

  it("step indices match array positions", () => {
    WIZARD_STEPS.forEach((step, i) => {
      expect(step.index).toBe(i);
    });
  });
});

describe("isValidTransition + getValidTransitions", () => {
  it("idle can transition to configuring", () => {
    expect(isValidTransition(init(), "configuring")).toBe(true);
  });

  it("idle CANNOT transition directly to generating", () => {
    expect(isValidTransition(init(), "generating")).toBe(false);
  });

  it("returns the canonical valid-next set per state", () => {
    expect(getValidTransitions(init())).toEqual(["configuring"]);
    const generating = dispatch(dispatch(init(), { type: "START_CONFIGURE" }), {
      type: "START_GENERATE",
    });
    expect(getValidTransitions(generating)).toEqual([
      "previewing",
      "error",
      "configuring",
    ]);
  });
});

describe("machineReducer — happy path: full wizard run", () => {
  it("idle → configuring → generating → previewing → applying → complete", () => {
    let s = init();
    s = dispatch(s, { type: "START_CONFIGURE" });
    expect(s.current).toBe("configuring");
    s = dispatch(s, { type: "START_GENERATE" });
    expect(s.current).toBe("generating");
    s = dispatch(s, { type: "GENERATION_COMPLETE" });
    expect(s.current).toBe("previewing");
    expect(s.completedSteps.has(0)).toBe(true);
    s = dispatch(s, { type: "START_APPLY" });
    expect(s.current).toBe("applying");
    s = dispatch(s, { type: "APPLY_COMPLETE", batchId: "batch-42" });
    expect(s.current).toBe("complete");
    expect(s.batchId).toBe("batch-42");
  });
});

describe("machineReducer — invalid transitions are rejected (returns state)", () => {
  it("START_GENERATE from idle is rejected", () => {
    const s = init();
    const after = dispatch(s, { type: "START_GENERATE" });
    expect(after).toBe(s); // same reference — no-op
  });

  it("START_APPLY from idle is rejected", () => {
    const s = init();
    expect(dispatch(s, { type: "START_APPLY" })).toBe(s);
  });

  it("GENERATION_COMPLETE outside generating is a no-op", () => {
    const s = dispatch(init(), { type: "START_CONFIGURE" });
    expect(dispatch(s, { type: "GENERATION_COMPLETE" })).toBe(s);
  });

  it("GENERATION_PROGRESS only mutates while generating", () => {
    const s = dispatch(init(), { type: "START_CONFIGURE" });
    const after = dispatch(s, {
      type: "GENERATION_PROGRESS",
      progress: 50,
      label: "halfway",
    });
    expect(after).toBe(s);
  });
});

describe("machineReducer — error + retry + cancel", () => {
  it("FAIL from generating → error with message + default recoverable=true", () => {
    let s = init();
    s = dispatch(s, { type: "START_CONFIGURE" });
    s = dispatch(s, { type: "START_GENERATE" });
    s = dispatch(s, { type: "FAIL", message: "boom" });
    expect(s.current).toBe("error");
    expect(s.errorMessage).toBe("boom");
    expect(s.recoverable).toBe(true);
  });

  it("FAIL with recoverable=false sets the flag", () => {
    let s = init();
    s = dispatch(s, { type: "START_CONFIGURE" });
    s = dispatch(s, { type: "START_GENERATE" });
    s = dispatch(s, {
      type: "FAIL",
      message: "fatal",
      recoverable: false,
    });
    expect(s.recoverable).toBe(false);
  });

  it("RETRY from recoverable error → configuring + error cleared", () => {
    let s = init();
    s = dispatch(s, { type: "START_CONFIGURE" });
    s = dispatch(s, { type: "START_GENERATE" });
    s = dispatch(s, { type: "FAIL", message: "boom" });
    s = dispatch(s, { type: "RETRY" });
    expect(s.current).toBe("configuring");
    expect(s.errorMessage).toBeNull();
  });

  it("RETRY from NON-recoverable error is a no-op", () => {
    let s = init();
    s = dispatch(s, { type: "START_CONFIGURE" });
    s = dispatch(s, { type: "START_GENERATE" });
    s = dispatch(s, {
      type: "FAIL",
      message: "fatal",
      recoverable: false,
    });
    const after = dispatch(s, { type: "RETRY" });
    expect(after.current).toBe("error");
  });

  it("CANCEL resets to idle from any state", () => {
    let s = init();
    s = dispatch(s, { type: "START_CONFIGURE" });
    s = dispatch(s, { type: "START_GENERATE" });
    s = dispatch(s, { type: "CANCEL" });
    expect(s.current).toBe("idle");
    expect(s.progress).toBe(0);
    expect(s.errorMessage).toBeNull();
  });
});

describe("machineReducer — step navigation", () => {
  it("NEXT_STEP advances stepIndex (caps at last step)", () => {
    let s = init();
    s = dispatch(s, { type: "NEXT_STEP" });
    expect(s.stepIndex).toBe(1);
    s = dispatch(s, { type: "NEXT_STEP" });
    expect(s.stepIndex).toBe(2);
    // At max — further advance is rejected.
    const after = dispatch(s, { type: "NEXT_STEP" });
    expect(after).toBe(s);
  });

  it("PREV_STEP rewinds stepIndex (floor at 0)", () => {
    let s = init();
    s = dispatch(s, { type: "NEXT_STEP" });
    s = dispatch(s, { type: "NEXT_STEP" });
    s = dispatch(s, { type: "PREV_STEP" });
    expect(s.stepIndex).toBe(1);
    s = dispatch(s, { type: "PREV_STEP" });
    expect(s.stepIndex).toBe(0);
    // At 0 — further rewind is rejected.
    const after = dispatch(s, { type: "PREV_STEP" });
    expect(after).toBe(s);
  });

  it("JUMP_TO_STEP allows jumping to completed steps", () => {
    let s = init();
    s = dispatch(s, { type: "START_CONFIGURE" });
    s = dispatch(s, { type: "START_GENERATE" });
    s = dispatch(s, { type: "GENERATION_COMPLETE" }); // step 0 complete
    s = dispatch(s, { type: "NEXT_STEP" });
    expect(s.stepIndex).toBe(1);
    s = dispatch(s, { type: "JUMP_TO_STEP", stepIndex: 0 });
    expect(s.stepIndex).toBe(0);
  });

  it("JUMP_TO_STEP rejects forward jumps to uncompleted steps", () => {
    let s = init();
    // No completedSteps yet — can't jump from 0 to 2.
    const after = dispatch(s, { type: "JUMP_TO_STEP", stepIndex: 2 });
    expect(after).toBe(s);
  });

  it("JUMP_TO_STEP rejects out-of-range step indices", () => {
    let s = init();
    expect(dispatch(s, { type: "JUMP_TO_STEP", stepIndex: -1 })).toBe(s);
    expect(dispatch(s, { type: "JUMP_TO_STEP", stepIndex: 999 })).toBe(s);
  });
});

describe("machineReducer — REGENERATE_STEP cascading invalidation", () => {
  function fillAllStages(): GenerationMachineState {
    let s = init();
    s = dispatch(s, {
      type: "SET_STAGE_RESULT",
      stepIndex: 0,
      result: { towns: [] } as never,
    });
    s = dispatch(s, {
      type: "SET_STAGE_RESULT",
      stepIndex: 1,
      result: { regions: [] } as never,
    });
    s = dispatch(s, {
      type: "SET_STAGE_RESULT",
      stepIndex: 2,
      result: { mobs: [] } as never,
    });
    // Mark all 3 stages complete.
    s.completedSteps.add(0);
    s.completedSteps.add(1);
    s.completedSteps.add(2);
    return s;
  }

  it("REGENERATE_STEP 0 wipes all 3 stage results and completedSteps", () => {
    const s = dispatch(fillAllStages(), {
      type: "REGENERATE_STEP",
      stepIndex: 0,
    });
    expect(s.stepIndex).toBe(0);
    expect(s.stageResults).toEqual({});
    expect(s.completedSteps.has(0)).toBe(false);
    expect(s.completedSteps.has(1)).toBe(false);
    expect(s.completedSteps.has(2)).toBe(false);
    expect(s.current).toBe("configuring");
  });

  it("REGENERATE_STEP 1 keeps towns, wipes roadsZones + population", () => {
    const s = dispatch(fillAllStages(), {
      type: "REGENERATE_STEP",
      stepIndex: 1,
    });
    expect(s.stageResults.towns).toBeDefined();
    expect(s.stageResults.roadsZones).toBeUndefined();
    expect(s.stageResults.population).toBeUndefined();
    expect(s.completedSteps.has(0)).toBe(true);
    expect(s.completedSteps.has(1)).toBe(false);
    expect(s.completedSteps.has(2)).toBe(false);
  });

  it("REGENERATE_STEP 2 keeps towns + roadsZones, wipes only population", () => {
    const s = dispatch(fillAllStages(), {
      type: "REGENERATE_STEP",
      stepIndex: 2,
    });
    expect(s.stageResults.towns).toBeDefined();
    expect(s.stageResults.roadsZones).toBeDefined();
    expect(s.stageResults.population).toBeUndefined();
    expect(s.completedSteps.has(0)).toBe(true);
    expect(s.completedSteps.has(1)).toBe(true);
    expect(s.completedSteps.has(2)).toBe(false);
  });

  it("REGENERATE_STEP rejects out-of-range step indices", () => {
    const s = fillAllStages();
    expect(dispatch(s, { type: "REGENERATE_STEP", stepIndex: -1 })).toBe(s);
    expect(dispatch(s, { type: "REGENERATE_STEP", stepIndex: 99 })).toBe(s);
  });
});

describe("machineReducer — RESET", () => {
  it("returns the initial machine state regardless of current state", () => {
    let s = init();
    s = dispatch(s, { type: "START_CONFIGURE" });
    s = dispatch(s, { type: "START_GENERATE" });
    s = dispatch(s, { type: "GENERATION_COMPLETE" });
    const reset = dispatch(s, { type: "RESET" });
    expect(reset.current).toBe("idle");
    expect(reset.stepIndex).toBe(0);
    expect(reset.completedSteps.size).toBe(0);
    expect(reset.stageResults).toEqual({});
  });
});

describe("machineReducer — GENERATION_PROGRESS", () => {
  it("updates progress + label while generating", () => {
    let s = init();
    s = dispatch(s, { type: "START_CONFIGURE" });
    s = dispatch(s, { type: "START_GENERATE" });
    s = dispatch(s, {
      type: "GENERATION_PROGRESS",
      progress: 42,
      label: "Flood filling...",
    });
    expect(s.progress).toBe(42);
    expect(s.progressLabel).toBe("Flood filling...");
  });
});
