/**
 * GamepadInput.test.ts - Tests for Gamepad Input System
 *
 * Tests the gamepad input system including:
 * - Button state tracking
 * - Analog stick handling
 * - Action mapping
 * - Event emission
 *
 * Note: Full gamepad integration tests require a browser environment.
 * These tests focus on the logic that can be tested in Node.js.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  GamepadInput,
  GamepadButton,
  GamepadAxis,
  DEFAULT_ACTION_MAPPING,
  GAMEPAD_BUTTON_GLYPHS,
  getButtonGlyph,
} from "../GamepadInput";

// Check if we're in a browser-like environment
const isBrowserEnv =
  typeof window !== "undefined" &&
  typeof navigator !== "undefined" &&
  typeof navigator.getGamepads === "function";

// Mock gamepad data
function createMockGamepad(overrides: Partial<Gamepad> = {}): Gamepad {
  const buttons: GamepadButton[] = [];
  for (let i = 0; i < 17; i++) {
    buttons.push({
      pressed: false,
      touched: false,
      value: 0,
    } as GamepadButton);
  }

  return {
    id: "Mock Gamepad (STANDARD GAMEPAD Vendor: 045e Product: 028e)",
    index: 0,
    connected: true,
    timestamp: performance.now(),
    mapping: "standard",
    axes: [0, 0, 0, 0],
    buttons,
    hapticActuators: [],
    ...overrides,
  } as Gamepad;
}

describe("GamepadInput", () => {
  let gamepadInput: GamepadInput;

  beforeEach(() => {
    gamepadInput = new GamepadInput();
  });

  afterEach(() => {
    gamepadInput.destroy();
    vi.restoreAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with no gamepad connected", () => {
      expect(gamepadInput.isConnected()).toBe(false);
      expect(gamepadInput.getGamepadInfo()).toBeNull();
    });

    it("should initialize with default action mapping", () => {
      expect(gamepadInput.getActionForButton(GamepadButton.A)).toBe("interact");
      expect(gamepadInput.getActionForButton(GamepadButton.B)).toBe("cancel");
    });

    it("should have default deadzone of 0.15", () => {
      expect(gamepadInput.getDeadzone()).toBe(0.15);
    });
  });

  // Browser-specific tests are skipped in Node.js environment
  describe.skipIf(!isBrowserEnv)("gamepad connection (browser only)", () => {
    it("should detect gamepad on connection event", () => {
      const mockGamepad = createMockGamepad();
      const connectHandler = vi.fn();

      gamepadInput.on("connected", connectHandler);

      // Simulate gamepad connection
      const event = new GamepadEvent("gamepadconnected", {
        gamepad: mockGamepad,
      });
      window.dispatchEvent(event);

      expect(connectHandler).toHaveBeenCalledWith(mockGamepad);
    });

    it("should detect gamepad disconnection", () => {
      const mockGamepad = createMockGamepad();
      const disconnectHandler = vi.fn();

      gamepadInput.on("disconnected", disconnectHandler);

      // Connect first
      const connectEvent = new GamepadEvent("gamepadconnected", {
        gamepad: mockGamepad,
      });
      window.dispatchEvent(connectEvent);

      // Then disconnect
      const disconnectEvent = new GamepadEvent("gamepaddisconnected", {
        gamepad: mockGamepad,
      });
      window.dispatchEvent(disconnectEvent);

      expect(disconnectHandler).toHaveBeenCalledWith(mockGamepad);
    });
  });

  describe("analog stick handling (no gamepad)", () => {
    it("should return zero when no gamepad connected", () => {
      const leftStick = gamepadInput.getLeftStick();
      const rightStick = gamepadInput.getRightStick();

      expect(leftStick).toEqual({ x: 0, y: 0 });
      expect(rightStick).toEqual({ x: 0, y: 0 });
    });

    it("should allow setting custom deadzone", () => {
      gamepadInput.setDeadzone(0.3);
      expect(gamepadInput.getDeadzone()).toBe(0.3);
    });

    it("should clamp deadzone to valid range", () => {
      gamepadInput.setDeadzone(0.8); // Above max (0.5)
      expect(gamepadInput.getDeadzone()).toBe(0.5);

      gamepadInput.setDeadzone(-0.1); // Below min (0)
      expect(gamepadInput.getDeadzone()).toBe(0);
    });
  });

  describe("D-pad handling (no gamepad)", () => {
    it("should return all false when no gamepad connected", () => {
      const dpad = gamepadInput.getDPad();

      expect(dpad.up).toBe(false);
      expect(dpad.right).toBe(false);
      expect(dpad.down).toBe(false);
      expect(dpad.left).toBe(false);
    });
  });

  describe("trigger handling (no gamepad)", () => {
    it("should return zero triggers when no gamepad connected", () => {
      const triggers = gamepadInput.getTriggers();

      expect(triggers.left).toBe(0);
      expect(triggers.right).toBe(0);
    });
  });

  describe("action mapping", () => {
    it("should use default action mapping", () => {
      expect(gamepadInput.getActionForButton(GamepadButton.A)).toBe(
        DEFAULT_ACTION_MAPPING[GamepadButton.A],
      );
    });

    it("should allow setting custom action mapping", () => {
      gamepadInput.setActionMapping({
        [GamepadButton.A]: "jump",
        [GamepadButton.B]: "attack",
      });

      expect(gamepadInput.getActionForButton(GamepadButton.A)).toBe("jump");
      expect(gamepadInput.getActionForButton(GamepadButton.B)).toBe("attack");
    });

    it("should reset action mapping to defaults", () => {
      gamepadInput.setActionMapping({
        [GamepadButton.A]: "jump",
      });

      gamepadInput.resetActionMapping();

      expect(gamepadInput.getActionForButton(GamepadButton.A)).toBe("interact");
    });

    it("should return null for unmapped buttons", () => {
      gamepadInput.setActionMapping({});

      expect(gamepadInput.getActionForButton(GamepadButton.A)).toBeNull();
    });
  });

  describe("enable/disable", () => {
    it("should be enabled by default", () => {
      expect(gamepadInput.isEnabled()).toBe(true);
    });

    it("should toggle enabled state", () => {
      gamepadInput.setEnabled(false);
      expect(gamepadInput.isEnabled()).toBe(false);

      gamepadInput.setEnabled(true);
      expect(gamepadInput.isEnabled()).toBe(true);
    });
  });

  describe("button glyphs", () => {
    it("should have glyphs for all buttons", () => {
      for (let i = 0; i <= 16; i++) {
        expect(GAMEPAD_BUTTON_GLYPHS[i as GamepadButton]).toBeDefined();
      }
    });

    it("should return correct glyph via helper function", () => {
      expect(getButtonGlyph(GamepadButton.A)).toBe("Ⓐ");
      expect(getButtonGlyph(GamepadButton.B)).toBe("Ⓑ");
      expect(getButtonGlyph(GamepadButton.X)).toBe("Ⓧ");
      expect(getButtonGlyph(GamepadButton.Y)).toBe("Ⓨ");
    });

    it("should return correct glyphs for bumpers and triggers", () => {
      expect(getButtonGlyph(GamepadButton.LB)).toBe("LB");
      expect(getButtonGlyph(GamepadButton.RB)).toBe("RB");
      expect(getButtonGlyph(GamepadButton.LT)).toBe("LT");
      expect(getButtonGlyph(GamepadButton.RT)).toBe("RT");
    });

    it("should return correct glyphs for D-pad", () => {
      expect(getButtonGlyph(GamepadButton.DPAD_UP)).toBe("▲");
      expect(getButtonGlyph(GamepadButton.DPAD_DOWN)).toBe("▼");
      expect(getButtonGlyph(GamepadButton.DPAD_LEFT)).toBe("◀");
      expect(getButtonGlyph(GamepadButton.DPAD_RIGHT)).toBe("▶");
    });
  });

  describe("event emitter", () => {
    it("should allow adding event handlers", () => {
      const handler = vi.fn();
      gamepadInput.on("buttonDown", handler);

      // Manually emit to test (simulating internal behavior)
      gamepadInput.emit("buttonDown", GamepadButton.A, "interact");

      expect(handler).toHaveBeenCalledWith(GamepadButton.A, "interact");
    });

    it("should clear all event handlers on destroy", () => {
      const handler = vi.fn();
      gamepadInput.on("buttonDown", handler);

      // Verify handler is registered
      expect(gamepadInput.listenerCount("buttonDown")).toBe(1);

      gamepadInput.destroy();

      // All listeners should be removed
      expect(gamepadInput.listenerCount("buttonDown")).toBe(0);
    });
  });

  describe("button state without gamepad", () => {
    it("should return false for button pressed when no gamepad", () => {
      expect(gamepadInput.isButtonPressed(GamepadButton.A)).toBe(false);
      expect(gamepadInput.isButtonPressed(GamepadButton.B)).toBe(false);
    });

    it("should return false for just pressed when no gamepad", () => {
      expect(gamepadInput.isButtonJustPressed(GamepadButton.A)).toBe(false);
    });

    it("should return false for just released when no gamepad", () => {
      expect(gamepadInput.isButtonJustReleased(GamepadButton.A)).toBe(false);
    });

    it("should return 0 for button value when no gamepad", () => {
      expect(gamepadInput.getButtonValue(GamepadButton.A)).toBe(0);
      expect(gamepadInput.getButtonValue(GamepadButton.LT)).toBe(0);
    });
  });
});

describe("GamepadAxis enum", () => {
  it("should have correct axis indices", () => {
    expect(GamepadAxis.LEFT_X).toBe(0);
    expect(GamepadAxis.LEFT_Y).toBe(1);
    expect(GamepadAxis.RIGHT_X).toBe(2);
    expect(GamepadAxis.RIGHT_Y).toBe(3);
  });
});

describe("GamepadButton enum", () => {
  it("should have correct button indices for face buttons", () => {
    expect(GamepadButton.A).toBe(0);
    expect(GamepadButton.B).toBe(1);
    expect(GamepadButton.X).toBe(2);
    expect(GamepadButton.Y).toBe(3);
  });

  it("should have correct button indices for bumpers and triggers", () => {
    expect(GamepadButton.LB).toBe(4);
    expect(GamepadButton.RB).toBe(5);
    expect(GamepadButton.LT).toBe(6);
    expect(GamepadButton.RT).toBe(7);
  });

  it("should have correct button indices for D-pad", () => {
    expect(GamepadButton.DPAD_UP).toBe(12);
    expect(GamepadButton.DPAD_DOWN).toBe(13);
    expect(GamepadButton.DPAD_LEFT).toBe(14);
    expect(GamepadButton.DPAD_RIGHT).toBe(15);
  });
});
