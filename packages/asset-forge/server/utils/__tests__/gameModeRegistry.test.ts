/**
 * `gameModeRegistry` — server-side GameMode manifest validation tests.
 *
 * The server doesn't drag in Three.js/PhysX for this validation —
 * it just checks the manifest fields against allowlists of known
 * client-side ids. Drift between this allowlist and what the
 * client actually registers would silently let bad ids through
 * to the runtime where they'd resolve to broken sessions.
 *
 * Tests pin the allowlist contents + the validator's per-field
 * rejection order.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_GAME_MODE_MANIFEST,
  KNOWN_CAMERA_IDS,
  KNOWN_INPUT_CONTEXT_IDS,
  KNOWN_PAWN_IDS,
  KNOWN_PLAYER_CONTROLLER_IDS,
  validateGameModeManifest,
  type GameModeManifest,
} from "../gameModeRegistry";

describe("DEFAULT_GAME_MODE_MANIFEST", () => {
  it("has the canonical Hyperia defaults", () => {
    expect(DEFAULT_GAME_MODE_MANIFEST).toEqual({
      playerController: "click-to-walk",
      camera: "orbit",
      inputContext: "hyperia-default",
      pawn: "humanoid-rpg",
    });
  });

  it("DEFAULT manifest passes validation", () => {
    expect(validateGameModeManifest(DEFAULT_GAME_MODE_MANIFEST)).toBeNull();
  });
});

describe("KNOWN_*_IDS allowlists", () => {
  it("KNOWN_PLAYER_CONTROLLER_IDS includes the Hyperia + WASD + top-down trio", () => {
    expect(KNOWN_PLAYER_CONTROLLER_IDS.has("click-to-walk")).toBe(true);
    expect(KNOWN_PLAYER_CONTROLLER_IDS.has("wasd")).toBe(true);
    expect(KNOWN_PLAYER_CONTROLLER_IDS.has("top-down")).toBe(true);
    expect(KNOWN_PLAYER_CONTROLLER_IDS.size).toBe(3);
  });

  it("KNOWN_CAMERA_IDS includes orbit / first-person / fixed-angle", () => {
    expect(KNOWN_CAMERA_IDS.has("orbit")).toBe(true);
    expect(KNOWN_CAMERA_IDS.has("first-person")).toBe(true);
    expect(KNOWN_CAMERA_IDS.has("fixed-angle")).toBe(true);
    expect(KNOWN_CAMERA_IDS.size).toBe(3);
  });

  it("KNOWN_INPUT_CONTEXT_IDS includes the 4 default contexts", () => {
    expect(KNOWN_INPUT_CONTEXT_IDS.has("hyperia-default")).toBe(true);
    expect(KNOWN_INPUT_CONTEXT_IDS.has("wasd-default")).toBe(true);
    expect(KNOWN_INPUT_CONTEXT_IDS.has("fps-default")).toBe(true);
    expect(KNOWN_INPUT_CONTEXT_IDS.has("topdown-default")).toBe(true);
    expect(KNOWN_INPUT_CONTEXT_IDS.size).toBe(4);
  });

  it("KNOWN_PAWN_IDS includes humanoid-rpg / humanoid-kinematic / cursor-avatar", () => {
    expect(KNOWN_PAWN_IDS.has("humanoid-rpg")).toBe(true);
    expect(KNOWN_PAWN_IDS.has("humanoid-kinematic")).toBe(true);
    expect(KNOWN_PAWN_IDS.has("cursor-avatar")).toBe(true);
    expect(KNOWN_PAWN_IDS.size).toBe(3);
  });
});

describe("validateGameModeManifest — happy path", () => {
  it("returns null for a fully-valid manifest", () => {
    expect(
      validateGameModeManifest({
        playerController: "wasd",
        camera: "first-person",
        inputContext: "fps-default",
        pawn: "humanoid-kinematic",
      }),
    ).toBeNull();
  });

  it("validates every (controller, camera, input, pawn) combo from the allowlists", () => {
    for (const pc of KNOWN_PLAYER_CONTROLLER_IDS) {
      for (const cam of KNOWN_CAMERA_IDS) {
        for (const ic of KNOWN_INPUT_CONTEXT_IDS) {
          for (const pawn of KNOWN_PAWN_IDS) {
            const result = validateGameModeManifest({
              playerController: pc,
              camera: cam,
              inputContext: ic,
              pawn,
            });
            expect(result).toBeNull();
          }
        }
      }
    }
  });
});

describe("validateGameModeManifest — rejection by field", () => {
  it("rejects unknown playerController with structured error", () => {
    const result = validateGameModeManifest({
      playerController: "spaceship-controls",
      camera: "orbit",
      inputContext: "hyperia-default",
      pawn: "humanoid-rpg",
    });
    expect(result).not.toBeNull();
    expect(result!.field).toBe("playerController");
    expect(result!.value).toBe("spaceship-controls");
    expect(result!.known).toEqual([...KNOWN_PLAYER_CONTROLLER_IDS]);
  });

  it("rejects unknown camera", () => {
    const result = validateGameModeManifest({
      playerController: "click-to-walk",
      camera: "vr-stereoscopic",
      inputContext: "hyperia-default",
      pawn: "humanoid-rpg",
    });
    expect(result?.field).toBe("camera");
  });

  it("rejects unknown inputContext", () => {
    const result = validateGameModeManifest({
      playerController: "click-to-walk",
      camera: "orbit",
      inputContext: "gamepad-only",
      pawn: "humanoid-rpg",
    });
    expect(result?.field).toBe("inputContext");
  });

  it("rejects unknown pawn", () => {
    const result = validateGameModeManifest({
      playerController: "click-to-walk",
      camera: "orbit",
      inputContext: "hyperia-default",
      pawn: "alien-tentacle",
    });
    expect(result?.field).toBe("pawn");
  });
});

describe("validateGameModeManifest — short-circuit order", () => {
  it("reports playerController error FIRST when multiple fields invalid", () => {
    // All four fields invalid; should report playerController.
    const result = validateGameModeManifest({
      playerController: "bogus",
      camera: "bogus",
      inputContext: "bogus",
      pawn: "bogus",
    } as GameModeManifest);
    expect(result?.field).toBe("playerController");
  });

  it("reports camera error when playerController is valid but camera invalid", () => {
    const result = validateGameModeManifest({
      playerController: "click-to-walk",
      camera: "bogus",
      inputContext: "bogus",
      pawn: "bogus",
    } as GameModeManifest);
    expect(result?.field).toBe("camera");
  });

  it("reports inputContext error when first two valid", () => {
    const result = validateGameModeManifest({
      playerController: "click-to-walk",
      camera: "orbit",
      inputContext: "bogus",
      pawn: "bogus",
    } as GameModeManifest);
    expect(result?.field).toBe("inputContext");
  });
});
