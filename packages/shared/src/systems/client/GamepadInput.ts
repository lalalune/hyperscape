/**
 * GamepadInput.ts - Gamepad/Controller Input System
 *
 * Handles gamepad input for Steam Deck and standard controllers.
 * Polls the Gamepad API and maps controller inputs to game actions.
 *
 * Key Features:
 * - **Controller Detection**: Auto-detects connected gamepads
 * - **Button Mapping**: Standard Xbox/Steam Deck button layout
 * - **Analog Sticks**: Left stick for movement, right for camera
 * - **Deadzone Handling**: Configurable deadzone for analog inputs
 * - **Event System**: Dispatches events for button press/release
 *
 * Steam Deck presents as an Xbox controller via Steam Input, so we use
 * the standard Xbox button mapping (A=0, B=1, X=2, Y=3, etc.)
 *
 * Usage:
 * ```typescript
 * const gamepad = new GamepadInput();
 *
 * // Check button state
 * if (gamepad.isButtonPressed(GamepadButton.A)) {
 *   player.interact();
 * }
 *
 * // Get analog stick values
 * const leftStick = gamepad.getLeftStick();
 * player.move(leftStick.x, leftStick.y);
 * ```
 *
 * @see ClientInput.ts for integration with the main input system
 */

import { EventEmitter } from "eventemitter3";

/**
 * Standard gamepad button indices (Xbox/Steam Deck layout)
 */
export enum GamepadButton {
  A = 0, // South button (confirm)
  B = 1, // East button (back/cancel)
  X = 2, // West button
  Y = 3, // North button
  LB = 4, // Left bumper
  RB = 5, // Right bumper
  LT = 6, // Left trigger (analog, but also has pressed state)
  RT = 7, // Right trigger (analog, but also has pressed state)
  SELECT = 8, // Back/View/Select
  START = 9, // Start/Menu
  L3 = 10, // Left stick press
  R3 = 11, // Right stick press
  DPAD_UP = 12,
  DPAD_DOWN = 13,
  DPAD_LEFT = 14,
  DPAD_RIGHT = 15,
  HOME = 16, // Xbox/Steam button (may not be available)
}

/**
 * Gamepad axis indices
 */
export enum GamepadAxis {
  LEFT_X = 0,
  LEFT_Y = 1,
  RIGHT_X = 2,
  RIGHT_Y = 3,
}

/**
 * Game action names for button mapping
 */
export type GameAction =
  | "interact"
  | "cancel"
  | "attack"
  | "specialAttack"
  | "inventory"
  | "equipment"
  | "skills"
  | "prayer"
  | "magic"
  | "menu"
  | "run"
  | "jump"
  | "zoomIn"
  | "zoomOut"
  | "cycleLeft"
  | "cycleRight";

/**
 * Button state for tracking press/release
 */
interface ButtonState {
  pressed: boolean;
  value: number;
  justPressed: boolean;
  justReleased: boolean;
}

/**
 * Stick state with x/y values
 */
export interface StickState {
  x: number;
  y: number;
}

/**
 * Events emitted by GamepadInput
 */
export interface GamepadInputEvents {
  connected: (gamepad: Gamepad) => void;
  disconnected: (gamepad: Gamepad) => void;
  buttonDown: (button: GamepadButton, action: GameAction | null) => void;
  buttonUp: (button: GamepadButton, action: GameAction | null) => void;
}

/**
 * Default button-to-action mapping for Hyperscape
 * Based on common RPG controller layouts
 */
export const DEFAULT_ACTION_MAPPING: Partial<
  Record<GamepadButton, GameAction>
> = {
  [GamepadButton.A]: "interact",
  [GamepadButton.B]: "cancel",
  [GamepadButton.X]: "attack",
  [GamepadButton.Y]: "specialAttack",
  [GamepadButton.LB]: "cycleLeft",
  [GamepadButton.RB]: "cycleRight",
  [GamepadButton.LT]: "zoomOut",
  [GamepadButton.RT]: "zoomIn",
  [GamepadButton.SELECT]: "inventory",
  [GamepadButton.START]: "menu",
  [GamepadButton.L3]: "run",
  [GamepadButton.R3]: "jump",
  [GamepadButton.DPAD_UP]: "equipment",
  [GamepadButton.DPAD_DOWN]: "prayer",
  [GamepadButton.DPAD_LEFT]: "skills",
  [GamepadButton.DPAD_RIGHT]: "magic",
};

/**
 * GamepadInput - Gamepad/Controller Input Handler
 *
 * Manages gamepad input polling, button state tracking, and action mapping.
 */
export class GamepadInput extends EventEmitter<GamepadInputEvents> {
  /** Currently active gamepad (first connected) */
  private gamepad: Gamepad | null = null;

  /** Gamepad index to track */
  private gamepadIndex: number = -1;

  /** Button states for tracking press/release */
  private buttonStates: Map<GamepadButton, ButtonState> = new Map();

  /** Action mapping (button -> action) */
  private actionMapping: Partial<Record<GamepadButton, GameAction>> = {
    ...DEFAULT_ACTION_MAPPING,
  };

  /** Deadzone for analog sticks (0-1) */
  private deadzone: number = 0.15;

  /** Whether gamepad input is enabled */
  private enabled: boolean = true;

  /** Pre-allocated stick states to avoid GC */
  private leftStickState: StickState = { x: 0, y: 0 };
  private rightStickState: StickState = { x: 0, y: 0 };

  constructor() {
    super();
    this.initializeButtonStates();
    this.setupEventListeners();
  }

  /**
   * Initialize button states for all buttons
   */
  private initializeButtonStates(): void {
    for (let i = 0; i <= 16; i++) {
      this.buttonStates.set(i as GamepadButton, {
        pressed: false,
        value: 0,
        justPressed: false,
        justReleased: false,
      });
    }
  }

  /**
   * Setup gamepad connection event listeners
   */
  private setupEventListeners(): void {
    if (typeof window === "undefined") return;

    window.addEventListener("gamepadconnected", this.onGamepadConnected);
    window.addEventListener("gamepaddisconnected", this.onGamepadDisconnected);

    // Check for already-connected gamepads (Chrome requires polling first)
    this.checkForGamepads();
  }

  /**
   * Check for already-connected gamepads
   */
  private checkForGamepads(): void {
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp && this.gamepadIndex === -1) {
        this.gamepad = gp;
        this.gamepadIndex = gp.index;
        console.log(`[GamepadInput] Found gamepad: ${gp.id}`);
        this.emit("connected", gp);
        break;
      }
    }
  }

  /**
   * Handle gamepad connection
   */
  private onGamepadConnected = (e: GamepadEvent): void => {
    console.log(`[GamepadInput] Gamepad connected: ${e.gamepad.id}`);

    // Use first gamepad if none connected
    if (this.gamepadIndex === -1) {
      this.gamepad = e.gamepad;
      this.gamepadIndex = e.gamepad.index;
      this.emit("connected", e.gamepad);
    }
  };

  /**
   * Handle gamepad disconnection
   */
  private onGamepadDisconnected = (e: GamepadEvent): void => {
    console.log(`[GamepadInput] Gamepad disconnected: ${e.gamepad.id}`);

    if (e.gamepad.index === this.gamepadIndex) {
      this.emit("disconnected", e.gamepad);
      this.gamepad = null;
      this.gamepadIndex = -1;

      // Reset all button states
      this.initializeButtonStates();

      // Check for other gamepads
      this.checkForGamepads();
    }
  };

  /**
   * Update gamepad state - call this every frame
   */
  update(): void {
    if (!this.enabled || this.gamepadIndex === -1) return;

    // Must re-fetch gamepad state each frame (Gamepad API requirement)
    const gamepads = navigator.getGamepads();
    this.gamepad = gamepads[this.gamepadIndex];

    if (!this.gamepad) return;

    // Clear justPressed/justReleased flags from previous frame
    for (const state of this.buttonStates.values()) {
      state.justPressed = false;
      state.justReleased = false;
    }

    // Update button states
    this.updateButtons();
  }

  /**
   * Update button states and emit events
   */
  private updateButtons(): void {
    if (!this.gamepad) return;

    for (let i = 0; i < this.gamepad.buttons.length && i <= 16; i++) {
      const button = this.gamepad.buttons[i];
      const buttonId = i as GamepadButton;
      const state = this.buttonStates.get(buttonId);

      if (!state) continue;

      const wasPressed = state.pressed;
      const isPressed = button.pressed || button.value > 0.5;

      state.value = button.value;
      state.pressed = isPressed;

      // Detect press/release transitions
      if (isPressed && !wasPressed) {
        state.justPressed = true;
        const action = this.actionMapping[buttonId] ?? null;
        this.emit("buttonDown", buttonId, action);
      } else if (!isPressed && wasPressed) {
        state.justReleased = true;
        const action = this.actionMapping[buttonId] ?? null;
        this.emit("buttonUp", buttonId, action);
      }
    }
  }

  /**
   * Apply deadzone to analog value
   */
  private applyDeadzone(value: number): number {
    if (Math.abs(value) < this.deadzone) return 0;
    // Rescale value to 0-1 range after deadzone
    const sign = value > 0 ? 1 : -1;
    return sign * ((Math.abs(value) - this.deadzone) / (1 - this.deadzone));
  }

  // ========================================
  // PUBLIC API
  // ========================================

  /**
   * Check if a gamepad is connected
   */
  isConnected(): boolean {
    return this.gamepad !== null;
  }

  /**
   * Get the connected gamepad info
   */
  getGamepadInfo(): { id: string; index: number } | null {
    if (!this.gamepad) return null;
    return { id: this.gamepad.id, index: this.gamepad.index };
  }

  /**
   * Check if a button is currently pressed
   */
  isButtonPressed(button: GamepadButton): boolean {
    return this.buttonStates.get(button)?.pressed ?? false;
  }

  /**
   * Check if a button was just pressed this frame
   */
  isButtonJustPressed(button: GamepadButton): boolean {
    return this.buttonStates.get(button)?.justPressed ?? false;
  }

  /**
   * Check if a button was just released this frame
   */
  isButtonJustReleased(button: GamepadButton): boolean {
    return this.buttonStates.get(button)?.justReleased ?? false;
  }

  /**
   * Get the analog value of a button (0-1 for triggers)
   */
  getButtonValue(button: GamepadButton): number {
    return this.buttonStates.get(button)?.value ?? 0;
  }

  /**
   * Get left analog stick state
   */
  getLeftStick(): StickState {
    if (!this.gamepad) {
      this.leftStickState.x = 0;
      this.leftStickState.y = 0;
      return this.leftStickState;
    }

    this.leftStickState.x = this.applyDeadzone(
      this.gamepad.axes[GamepadAxis.LEFT_X] ?? 0,
    );
    this.leftStickState.y = this.applyDeadzone(
      this.gamepad.axes[GamepadAxis.LEFT_Y] ?? 0,
    );

    return this.leftStickState;
  }

  /**
   * Get right analog stick state
   */
  getRightStick(): StickState {
    if (!this.gamepad) {
      this.rightStickState.x = 0;
      this.rightStickState.y = 0;
      return this.rightStickState;
    }

    this.rightStickState.x = this.applyDeadzone(
      this.gamepad.axes[GamepadAxis.RIGHT_X] ?? 0,
    );
    this.rightStickState.y = this.applyDeadzone(
      this.gamepad.axes[GamepadAxis.RIGHT_Y] ?? 0,
    );

    return this.rightStickState;
  }

  /**
   * Get trigger values (0-1)
   */
  getTriggers(): { left: number; right: number } {
    return {
      left: this.getButtonValue(GamepadButton.LT),
      right: this.getButtonValue(GamepadButton.RT),
    };
  }

  /**
   * Check if any D-pad button is pressed
   */
  getDPad(): { up: boolean; down: boolean; left: boolean; right: boolean } {
    return {
      up: this.isButtonPressed(GamepadButton.DPAD_UP),
      down: this.isButtonPressed(GamepadButton.DPAD_DOWN),
      left: this.isButtonPressed(GamepadButton.DPAD_LEFT),
      right: this.isButtonPressed(GamepadButton.DPAD_RIGHT),
    };
  }

  /**
   * Get the action mapped to a button
   */
  getActionForButton(button: GamepadButton): GameAction | null {
    return this.actionMapping[button] ?? null;
  }

  /**
   * Set custom action mapping
   */
  setActionMapping(mapping: Partial<Record<GamepadButton, GameAction>>): void {
    this.actionMapping = { ...mapping };
  }

  /**
   * Reset action mapping to defaults
   */
  resetActionMapping(): void {
    this.actionMapping = { ...DEFAULT_ACTION_MAPPING };
  }

  /**
   * Set deadzone value (0-1)
   */
  setDeadzone(value: number): void {
    this.deadzone = Math.max(0, Math.min(0.5, value));
  }

  /**
   * Get current deadzone value
   */
  getDeadzone(): number {
    return this.deadzone;
  }

  /**
   * Enable/disable gamepad input
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if gamepad input is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Vibrate the gamepad (if supported)
   */
  vibrate(
    duration: number,
    weakMagnitude: number = 0.5,
    strongMagnitude: number = 0.5,
  ): void {
    if (!this.gamepad) return;

    // Check for vibration actuator support
    const vibrationActuator = (
      this.gamepad as Gamepad & {
        vibrationActuator?: {
          playEffect: (
            type: string,
            params: {
              duration: number;
              weakMagnitude: number;
              strongMagnitude: number;
            },
          ) => Promise<string>;
        };
      }
    ).vibrationActuator;

    if (vibrationActuator) {
      vibrationActuator
        .playEffect("dual-rumble", {
          duration,
          weakMagnitude,
          strongMagnitude,
        })
        .catch(() => {
          // Vibration not supported or failed
        });
    }
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    // Remove window event listeners if in browser
    if (typeof window !== "undefined") {
      window.removeEventListener("gamepadconnected", this.onGamepadConnected);
      window.removeEventListener(
        "gamepaddisconnected",
        this.onGamepadDisconnected,
      );
    }

    // Always clean up EventEmitter listeners and state
    this.removeAllListeners();
    this.gamepad = null;
    this.gamepadIndex = -1;
  }
}

/**
 * Button glyphs for UI display
 * These match the Steam Deck / Xbox controller layout
 */
export const GAMEPAD_BUTTON_GLYPHS: Record<GamepadButton, string> = {
  [GamepadButton.A]: "Ⓐ",
  [GamepadButton.B]: "Ⓑ",
  [GamepadButton.X]: "Ⓧ",
  [GamepadButton.Y]: "Ⓨ",
  [GamepadButton.LB]: "LB",
  [GamepadButton.RB]: "RB",
  [GamepadButton.LT]: "LT",
  [GamepadButton.RT]: "RT",
  [GamepadButton.SELECT]: "⎚",
  [GamepadButton.START]: "☰",
  [GamepadButton.L3]: "L3",
  [GamepadButton.R3]: "R3",
  [GamepadButton.DPAD_UP]: "▲",
  [GamepadButton.DPAD_DOWN]: "▼",
  [GamepadButton.DPAD_LEFT]: "◀",
  [GamepadButton.DPAD_RIGHT]: "▶",
  [GamepadButton.HOME]: "⌂",
};

/**
 * Get button glyph for UI display
 */
export function getButtonGlyph(button: GamepadButton): string {
  return GAMEPAD_BUTTON_GLYPHS[button] ?? "?";
}
