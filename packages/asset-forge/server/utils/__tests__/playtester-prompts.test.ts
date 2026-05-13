/**
 * `playtester-prompts` — AI playtester prompt + result-parsing tests.
 *
 * Four exported functions plus two const records. The interesting
 * surface is the response parser (regex-driven extraction of 7
 * sections from a markdown playthrough doc) and the quality-grade
 * heuristic (instant-F on critical bugs, weighted penalties for
 * everything else).
 *
 * Tests pin:
 *   - `makePlaytestPrompt`: archetype + knowledge-level instructions
 *     embedded; falls back to casual / intermediate on missing values.
 *   - `parseTestResult`: each section's regex; clamps difficulty/
 *     engagement to [1,10]; "None" sentinels short-circuit list
 *     parsing; defaults survive when sections are missing.
 *   - `calculateQualityGrade`: criticalBugs > 0 ⇒ instant F; the
 *     90/80/70/60 grade boundaries; difficulty-delta penalty
 *     (only when |avg-5.5| > 2).
 *   - `generateRecommendations`: priority + category derived from
 *     thresholds; pacing recommendation depends on `>50%` majority;
 *     info-grade fallback when nothing is critical/high.
 */

import { describe, expect, it } from "vitest";
import {
  ARCHETYPE_INSTRUCTIONS,
  KNOWLEDGE_LEVEL_CONTEXT,
  calculateQualityGrade,
  generateRecommendations,
  makePlaytestPrompt,
  parseTestResult,
  type AggregatedMetrics,
  type PlaytesterArchetype,
  type PlaytesterConfig,
} from "../playtester-prompts";

function makeTester(
  overrides: Partial<PlaytesterConfig> = {},
): PlaytesterConfig {
  return {
    id: "t1",
    name: "Tester One",
    archetype: "casual",
    knowledgeLevel: "intermediate",
    personality: "friendly",
    expectations: ["fun", "clear"],
    ...overrides,
  };
}

function makeMetrics(
  overrides: Partial<AggregatedMetrics> = {},
): AggregatedMetrics {
  return {
    totalTests: 10,
    completionRate: 90,
    averageDifficulty: 5,
    difficultyByLevel: {},
    averageEngagement: 7,
    engagementByArchetype: {},
    pacing: { too_fast: 0, just_right: 10, too_slow: 0, unknown: 0 },
    bugReports: [],
    uniqueBugs: 0,
    criticalBugs: 0,
    majorBugs: 0,
    minorBugs: 0,
    confusionPoints: [],
    recommendations: { pass: 10, pass_with_changes: 0, fail: 0 },
    ...overrides,
  };
}

// ----- constants ------------------------------------------------------------

describe("ARCHETYPE_INSTRUCTIONS / KNOWLEDGE_LEVEL_CONTEXT", () => {
  it("has an entry for every PlaytesterArchetype", () => {
    const archetypes: PlaytesterArchetype[] = [
      "completionist",
      "speedrunner",
      "explorer",
      "casual",
      "minmaxer",
      "roleplayer",
      "breaker",
    ];
    for (const a of archetypes) {
      expect(ARCHETYPE_INSTRUCTIONS[a]).toBeTruthy();
      expect(typeof ARCHETYPE_INSTRUCTIONS[a]).toBe("string");
    }
  });

  it("has all 3 knowledge levels", () => {
    expect(KNOWLEDGE_LEVEL_CONTEXT.beginner).toBeTruthy();
    expect(KNOWLEDGE_LEVEL_CONTEXT.intermediate).toBeTruthy();
    expect(KNOWLEDGE_LEVEL_CONTEXT.expert).toBeTruthy();
  });
});

// ----- makePlaytestPrompt ---------------------------------------------------

describe("makePlaytestPrompt", () => {
  it("embeds tester identity, archetype, and knowledge level", () => {
    const out = makePlaytestPrompt(
      makeTester({
        name: "Alice",
        archetype: "speedrunner",
        knowledgeLevel: "expert",
        personality: "impatient",
        expectations: ["speed", "challenge"],
      }),
      { hello: "world" },
    );
    expect(out).toContain("You are Alice");
    expect(out).toContain("ARCHETYPE: speedrunner");
    expect(out).toContain(ARCHETYPE_INSTRUCTIONS.speedrunner);
    expect(out).toContain("KNOWLEDGE LEVEL: expert");
    expect(out).toContain(KNOWLEDGE_LEVEL_CONTEXT.expert);
    expect(out).toContain("PERSONALITY: impatient");
    expect(out).toContain("EXPECTATIONS: speed, challenge");
  });

  it("stringifies content as pretty JSON in the CONTENT TO TEST block", () => {
    const out = makePlaytestPrompt(makeTester(), {
      quest: "fetch",
      reward: 100,
    });
    expect(out).toContain('"quest": "fetch"');
    expect(out).toContain('"reward": 100');
  });

  it("interpolates the tester name + archetype into the output template", () => {
    const out = makePlaytestPrompt(
      makeTester({ name: "Bob", archetype: "breaker" }),
      {},
    );
    // The OUTPUT FORMAT block references the tester twice.
    expect(out).toContain("how you played through the content as Bob");
    expect(out).toContain("how your breaker playstyle");
  });

  it("emits the standard OUTPUT FORMAT section headers (parser depends on these)", () => {
    const out = makePlaytestPrompt(makeTester(), {});
    expect(out).toContain("## Playthrough");
    expect(out).toContain("## Completion Status");
    expect(out).toContain("**Completed:**");
    expect(out).toContain("## Difficulty Rating");
    expect(out).toContain("**Difficulty:**");
    expect(out).toContain("## Engagement Rating");
    expect(out).toContain("**Engagement:**");
    expect(out).toContain("## Pacing Assessment");
    expect(out).toContain("**Pacing:**");
    expect(out).toContain("## Bugs Found");
    expect(out).toContain("## Confusion Points");
    expect(out).toContain("## Overall Feedback");
    expect(out).toContain("## Recommendation");
  });
});

// ----- parseTestResult ------------------------------------------------------

describe("parseTestResult — full happy-path roundtrip", () => {
  it("extracts every section from a well-formed response", () => {
    const tester = makeTester({ name: "Cara", archetype: "explorer" });
    const text = `
## Playthrough
I tried everything. It was OK.

## Completion Status
**Completed:** YES

## Difficulty Rating
**Difficulty:** 7/10

## Engagement Rating
**Engagement:** 8/10

## Pacing Assessment
**Pacing:** just_right

## Bugs Found
1. Door doesn't open severity: critical
2. Tooltip typo severity: minor

## Confusion Points
- The map symbol was unclear
- The reward count made no sense

## Overall Feedback
Solid content with some bumps.

## Recommendation
**Recommendation:** pass_with_changes
`;
    const r = parseTestResult(text, tester);
    expect(r.testerId).toBe("t1");
    expect(r.testerName).toBe("Cara");
    expect(r.archetype).toBe("explorer");
    expect(r.playthrough).toContain("I tried everything");
    expect(r.completed).toBe(true);
    expect(r.difficulty).toBe(7);
    expect(r.engagement).toBe(8);
    expect(r.pacing).toBe("just_right");
    expect(r.bugs).toHaveLength(2);
    expect(r.bugs[0].severity).toBe("critical");
    expect(r.bugs[1].severity).toBe("minor");
    expect(r.bugs[0].reporter).toBe("Cara");
    expect(r.bugs[0].archetype).toBe("explorer");
    expect(r.confusionPoints).toEqual([
      "The map symbol was unclear",
      "The reward count made no sense",
    ]);
    expect(r.feedback).toContain("Solid content");
    expect(r.recommendation).toBe("pass_with_changes");
    expect(r.rawResponse).toBe(text);
  });
});

describe("parseTestResult — defaults survive missing sections", () => {
  it("returns sensible defaults when the response is empty", () => {
    const r = parseTestResult("", makeTester());
    expect(r.playthrough).toBe("");
    expect(r.completed).toBe(false);
    expect(r.difficulty).toBe(5);
    expect(r.engagement).toBe(5);
    expect(r.pacing).toBe("unknown");
    expect(r.bugs).toEqual([]);
    expect(r.confusionPoints).toEqual([]);
    expect(r.feedback).toBe("");
    expect(r.recommendation).toBe("pass_with_changes");
    expect(r.success).toBe(true);
  });
});

describe("parseTestResult — numeric clamping", () => {
  it("clamps difficulty above 10 down to 10", () => {
    const r = parseTestResult("**Difficulty:** 99/10", makeTester());
    expect(r.difficulty).toBe(10);
  });

  it("clamps difficulty below 1 up to 1", () => {
    const r = parseTestResult("**Difficulty:** 0/10", makeTester());
    expect(r.difficulty).toBe(1);
  });

  it("accepts bare number without /10 suffix", () => {
    const r = parseTestResult("**Difficulty:** 4", makeTester());
    expect(r.difficulty).toBe(4);
  });

  it("clamps engagement the same way", () => {
    const high = parseTestResult("**Engagement:** 50", makeTester());
    expect(high.engagement).toBe(10);
    const low = parseTestResult("**Engagement:** 0", makeTester());
    expect(low.engagement).toBe(1);
  });
});

describe("parseTestResult — completion + pacing sentinels", () => {
  it("treats 'YES' (any case) as completed", () => {
    expect(parseTestResult("**Completed:** yes", makeTester()).completed).toBe(
      true,
    );
    expect(parseTestResult("**Completed:** YES", makeTester()).completed).toBe(
      true,
    );
  });

  it("treats 'NO' as not completed", () => {
    expect(parseTestResult("**Completed:** NO", makeTester()).completed).toBe(
      false,
    );
  });

  it("recognizes all three pacing values", () => {
    expect(parseTestResult("**Pacing:** too_fast", makeTester()).pacing).toBe(
      "too_fast",
    );
    expect(parseTestResult("**Pacing:** too_slow", makeTester()).pacing).toBe(
      "too_slow",
    );
    expect(parseTestResult("**Pacing:** just_right", makeTester()).pacing).toBe(
      "just_right",
    );
  });

  it("leaves pacing as 'unknown' when value is not a recognized literal", () => {
    expect(parseTestResult("**Pacing:** maybe", makeTester()).pacing).toBe(
      "unknown",
    );
  });
});

describe("parseTestResult — bugs section", () => {
  it("short-circuits when bugs section says 'None'", () => {
    const text = `## Bugs Found\nNone\n## Confusion Points\n- x`;
    const r = parseTestResult(text, makeTester());
    expect(r.bugs).toEqual([]);
  });

  it("parses numbered AND dash-bulleted bug lines", () => {
    const text = `
## Bugs Found
1. First bug severity: major
- Second bug severity: minor
2. Third bug
## End
`;
    const r = parseTestResult(text, makeTester());
    expect(r.bugs).toHaveLength(3);
    expect(r.bugs[0].severity).toBe("major");
    expect(r.bugs[1].severity).toBe("minor");
    // No severity match → default "minor".
    expect(r.bugs[2].severity).toBe("minor");
    expect(r.bugs[2].description).toContain("Third bug");
  });

  it("strips the list-marker prefix from bug descriptions", () => {
    const text = `## Bugs Found\n1. Real description\n## End`;
    const r = parseTestResult(text, makeTester());
    expect(r.bugs[0].description.startsWith("1.")).toBe(false);
    expect(r.bugs[0].description).toContain("Real description");
  });
});

describe("parseTestResult — confusion points", () => {
  it("only collects dash-bulleted lines (numbered lines are ignored)", () => {
    const text = `
## Confusion Points
- valid one
1. ignored numbered
- valid two
## End
`;
    const r = parseTestResult(text, makeTester());
    expect(r.confusionPoints).toEqual(["valid one", "valid two"]);
  });

  it("short-circuits on 'None' sentinel", () => {
    const text = `## Confusion Points\nNone\n## End`;
    const r = parseTestResult(text, makeTester());
    expect(r.confusionPoints).toEqual([]);
  });
});

describe("parseTestResult — recommendation", () => {
  it("parses all three recommendation values case-insensitively", () => {
    expect(
      parseTestResult("**Recommendation:** pass", makeTester()).recommendation,
    ).toBe("pass");
    expect(
      parseTestResult("**Recommendation:** PASS_WITH_CHANGES", makeTester())
        .recommendation,
    ).toBe("pass_with_changes");
    expect(
      parseTestResult("**Recommendation:** fail", makeTester()).recommendation,
    ).toBe("fail");
  });
});

// ----- calculateQualityGrade ------------------------------------------------

describe("calculateQualityGrade", () => {
  it("instant-F on any critical bug, regardless of other metrics", () => {
    const { grade, score } = calculateQualityGrade(
      makeMetrics({
        criticalBugs: 1,
        completionRate: 100,
        averageEngagement: 10,
      }),
    );
    expect(grade).toBe("F");
    expect(score).toBe(40); // 50 - 1*10
  });

  it("critical score floors at 0", () => {
    const { grade, score } = calculateQualityGrade(
      makeMetrics({ criticalBugs: 100 }),
    );
    expect(grade).toBe("F");
    expect(score).toBe(0);
  });

  it("100-point baseline grade A for perfect metrics", () => {
    const { grade, score } = calculateQualityGrade(
      makeMetrics({
        completionRate: 100,
        averageDifficulty: 5.5, // ideal middle
        averageEngagement: 10,
      }),
    );
    expect(grade).toBe("A");
    expect(score).toBe(100);
  });

  it("penalizes major bugs at 10 points each", () => {
    const { score } = calculateQualityGrade(
      makeMetrics({
        majorBugs: 2,
        completionRate: 100,
        averageDifficulty: 5.5,
        averageEngagement: 10,
      }),
    );
    expect(score).toBe(80); // 100 - 2*10
  });

  it("penalizes minor bugs at 2 points each", () => {
    const { score } = calculateQualityGrade(
      makeMetrics({
        minorBugs: 5,
        completionRate: 100,
        averageDifficulty: 5.5,
        averageEngagement: 10,
      }),
    );
    expect(score).toBe(90); // 100 - 5*2
  });

  it("penalizes completion rate below 70", () => {
    const { score } = calculateQualityGrade(
      makeMetrics({
        completionRate: 50,
        averageDifficulty: 5.5,
        averageEngagement: 10,
      }),
    );
    expect(score).toBe(90); // 100 - (70-50)/2
  });

  it("does NOT penalize difficulty within ±2 of the ideal 5.5", () => {
    const within = calculateQualityGrade(
      makeMetrics({
        completionRate: 100,
        averageDifficulty: 7.5, // delta=2, still exempt
        averageEngagement: 10,
      }),
    );
    expect(within.score).toBe(100);
  });

  it("penalizes difficulty extremes beyond ±2 of ideal", () => {
    const tooHard = calculateQualityGrade(
      makeMetrics({
        completionRate: 100,
        averageDifficulty: 10, // delta=4.5, penalty = (4.5-2)*3 = 7.5
        averageEngagement: 10,
      }),
    );
    // Math.round(100 - 7.5) = 93 (banker's rounding: 92.5 → 92, but 100-7.5 = 92.5)
    // Actually Math.round(92.5) = 93 in JS.
    expect(tooHard.score).toBe(93);
  });

  it("returns A/B/C/D grade at the documented score boundaries", () => {
    // Construct minor-bug counts that land us in each band.
    const score90 = calculateQualityGrade(
      makeMetrics({
        minorBugs: 5,
        completionRate: 100,
        averageDifficulty: 5.5,
        averageEngagement: 10,
      }),
    );
    expect(score90.grade).toBe("A"); // 90 exactly

    const score89 = calculateQualityGrade(
      makeMetrics({
        majorBugs: 1,
        minorBugs: 1, // 100 - 10 - 2 = 88 → B
        completionRate: 100,
        averageDifficulty: 5.5,
        averageEngagement: 10,
      }),
    );
    expect(score89.grade).toBe("B");
    expect(score89.score).toBe(88);

    const score75 = calculateQualityGrade(
      makeMetrics({
        majorBugs: 2,
        completionRate: 90,
        averageDifficulty: 5.5,
        averageEngagement: 10,
        minorBugs: 5,
      }),
    );
    // 100 - 20 (major) - 10 (minor) = 70 → C boundary
    expect(score75.grade).toBe("C");

    const scoreD = calculateQualityGrade(
      makeMetrics({
        majorBugs: 4,
        completionRate: 100,
        averageDifficulty: 5.5,
        averageEngagement: 10,
      }),
    );
    // 100 - 40 = 60 → D boundary
    expect(scoreD.grade).toBe("D");

    const scoreF = calculateQualityGrade(
      makeMetrics({
        majorBugs: 5,
        completionRate: 100,
        averageDifficulty: 5.5,
        averageEngagement: 10,
      }),
    );
    // 100 - 50 = 50 → F
    expect(scoreF.grade).toBe("F");
  });
});

// ----- generateRecommendations ----------------------------------------------

describe("generateRecommendations — bug-driven priorities", () => {
  it("'critical' priority for any critical bug", () => {
    const recs = generateRecommendations(makeMetrics({ criticalBugs: 2 }));
    const bugRec = recs.find(
      (r) => r.category === "bugs" && r.priority === "critical",
    );
    expect(bugRec?.message).toContain("2 critical bug(s)");
  });

  it("'high' priority for major bugs", () => {
    const recs = generateRecommendations(makeMetrics({ majorBugs: 3 }));
    const bugRec = recs.find(
      (r) => r.category === "bugs" && r.priority === "high",
    );
    expect(bugRec?.message).toContain("3 major bug(s)");
  });
});

describe("generateRecommendations — completion thresholds", () => {
  it("completionRate < 50 ⇒ critical recommendation", () => {
    const recs = generateRecommendations(makeMetrics({ completionRate: 30 }));
    const r = recs.find((x) => x.category === "completion");
    expect(r?.priority).toBe("critical");
    expect(r?.message).toContain("30%");
  });

  it("50 ≤ completionRate < 80 ⇒ high recommendation", () => {
    const recs = generateRecommendations(makeMetrics({ completionRate: 70 }));
    const r = recs.find((x) => x.category === "completion");
    expect(r?.priority).toBe("high");
    expect(r?.message).toContain("70%");
  });

  it("completionRate >= 80 ⇒ no completion recommendation", () => {
    const recs = generateRecommendations(makeMetrics({ completionRate: 95 }));
    expect(recs.some((x) => x.category === "completion")).toBe(false);
  });
});

describe("generateRecommendations — difficulty thresholds", () => {
  it("averageDifficulty < 3 ⇒ medium 'too easy' recommendation", () => {
    const recs = generateRecommendations(makeMetrics({ averageDifficulty: 2 }));
    const r = recs.find((x) => x.category === "difficulty");
    expect(r?.priority).toBe("medium");
    expect(r?.message).toContain("easy");
  });

  it("averageDifficulty > 8 ⇒ high 'too hard' recommendation", () => {
    const recs = generateRecommendations(makeMetrics({ averageDifficulty: 9 }));
    const r = recs.find((x) => x.category === "difficulty");
    expect(r?.priority).toBe("high");
    expect(r?.message).toContain("difficult");
  });

  it("difficulty in [3, 8] ⇒ no difficulty recommendation", () => {
    const recs = generateRecommendations(makeMetrics({ averageDifficulty: 5 }));
    expect(recs.some((x) => x.category === "difficulty")).toBe(false);
  });
});

describe("generateRecommendations — engagement thresholds", () => {
  it("averageEngagement < 4 ⇒ critical recommendation", () => {
    const recs = generateRecommendations(makeMetrics({ averageEngagement: 3 }));
    const r = recs.find((x) => x.category === "engagement");
    expect(r?.priority).toBe("critical");
  });

  it("averageEngagement in [4, 6) ⇒ high recommendation", () => {
    const recs = generateRecommendations(makeMetrics({ averageEngagement: 5 }));
    const r = recs.find((x) => x.category === "engagement");
    expect(r?.priority).toBe("high");
  });

  it("averageEngagement >= 6 ⇒ no engagement recommendation", () => {
    const recs = generateRecommendations(makeMetrics({ averageEngagement: 7 }));
    expect(recs.some((x) => x.category === "engagement")).toBe(false);
  });
});

describe("generateRecommendations — pacing majority rule", () => {
  it("too_slow majority (>50%) ⇒ medium pacing recommendation", () => {
    const recs = generateRecommendations(
      makeMetrics({
        pacing: { too_fast: 1, just_right: 1, too_slow: 5, unknown: 0 },
      }),
    );
    const r = recs.find((x) => x.category === "pacing");
    expect(r?.priority).toBe("medium");
    expect(r?.message).toContain("too slow");
  });

  it("too_fast majority (>50%) ⇒ low pacing recommendation", () => {
    const recs = generateRecommendations(
      makeMetrics({
        pacing: { too_fast: 5, just_right: 1, too_slow: 1, unknown: 0 },
      }),
    );
    const r = recs.find((x) => x.category === "pacing");
    expect(r?.priority).toBe("low");
    expect(r?.message).toContain("too fast");
  });

  it("no majority (50/50) ⇒ no pacing recommendation", () => {
    const recs = generateRecommendations(
      makeMetrics({
        pacing: { too_fast: 5, just_right: 0, too_slow: 5, unknown: 0 },
      }),
    );
    expect(recs.some((x) => x.category === "pacing")).toBe(false);
  });

  it("zero pacing data ⇒ no pacing recommendation", () => {
    const recs = generateRecommendations(
      makeMetrics({
        pacing: { too_fast: 0, just_right: 0, too_slow: 0, unknown: 0 },
      }),
    );
    expect(recs.some((x) => x.category === "pacing")).toBe(false);
  });
});

describe("generateRecommendations — info-grade fallback", () => {
  it("emits a single info-grade 'meets quality standards' rec when nothing else fires", () => {
    const recs = generateRecommendations(makeMetrics());
    expect(recs).toHaveLength(1);
    expect(recs[0].priority).toBe("info");
    expect(recs[0].category).toBe("quality");
    expect(recs[0].message).toContain("quality standards");
  });

  it("ALSO appends the info-grade rec when only medium/low recs exist", () => {
    // Pacing-medium + difficulty-low scenario: no critical or high recs.
    const recs = generateRecommendations(
      makeMetrics({
        averageDifficulty: 2, // medium
        pacing: { too_fast: 0, just_right: 0, too_slow: 5, unknown: 0 }, // medium
      }),
    );
    // Two existing recs (difficulty + pacing) are both medium; info should also be appended.
    expect(recs.some((r) => r.priority === "info")).toBe(true);
  });

  it("does NOT emit info-grade when at least one critical/high rec exists", () => {
    const recs = generateRecommendations(makeMetrics({ criticalBugs: 1 }));
    expect(recs.some((r) => r.priority === "info")).toBe(false);
  });
});
