/**
 * GamepadButtonHint.tsx - Controller Button Hint Components
 *
 * Displays gamepad button glyphs and action prompts for Steam Deck and controllers.
 * Shows appropriate button hints based on connected controller type.
 *
 * @example
 * ```tsx
 * // Single button hint
 * <GamepadButtonHint button="A" />
 *
 * // Button with label
 * <GamepadButtonHint button="X" label="Attack" />
 *
 * // Action bar with multiple hints
 * <GamepadActionBar actions={[
 *   { button: 'A', label: 'Interact' },
 *   { button: 'B', label: 'Cancel' },
 * ]} />
 * ```
 */

import React, { useEffect, useState } from "react";
import { isGamepadConnected, getGamepadType } from "../lib/tauri-integration";

/**
 * Gamepad button names matching GamepadButton enum
 */
export type GamepadButtonName =
  | "A"
  | "B"
  | "X"
  | "Y"
  | "LB"
  | "RB"
  | "LT"
  | "RT"
  | "SELECT"
  | "START"
  | "L3"
  | "R3"
  | "DPAD_UP"
  | "DPAD_DOWN"
  | "DPAD_LEFT"
  | "DPAD_RIGHT";

/**
 * Button glyphs for different controller types
 */
const BUTTON_GLYPHS: Record<
  string,
  Record<GamepadButtonName, { glyph: string; className: string }>
> = {
  xbox: {
    A: { glyph: "A", className: "button-a" },
    B: { glyph: "B", className: "button-b" },
    X: { glyph: "X", className: "button-x" },
    Y: { glyph: "Y", className: "button-y" },
    LB: { glyph: "LB", className: "button-lb" },
    RB: { glyph: "RB", className: "button-rb" },
    LT: { glyph: "LT", className: "button-lt" },
    RT: { glyph: "RT", className: "button-rt" },
    SELECT: { glyph: "⎚", className: "button-select" },
    START: { glyph: "☰", className: "button-start" },
    L3: { glyph: "L3", className: "button-lb" },
    R3: { glyph: "R3", className: "button-rb" },
    DPAD_UP: { glyph: "▲", className: "dpad" },
    DPAD_DOWN: { glyph: "▼", className: "dpad" },
    DPAD_LEFT: { glyph: "◀", className: "dpad" },
    DPAD_RIGHT: { glyph: "▶", className: "dpad" },
  },
  playstation: {
    A: { glyph: "✕", className: "button-a" },
    B: { glyph: "○", className: "button-b" },
    X: { glyph: "□", className: "button-x" },
    Y: { glyph: "△", className: "button-y" },
    LB: { glyph: "L1", className: "button-lb" },
    RB: { glyph: "R1", className: "button-rb" },
    LT: { glyph: "L2", className: "button-lt" },
    RT: { glyph: "R2", className: "button-rt" },
    SELECT: { glyph: "Share", className: "button-select" },
    START: { glyph: "Options", className: "button-start" },
    L3: { glyph: "L3", className: "button-lb" },
    R3: { glyph: "R3", className: "button-rb" },
    DPAD_UP: { glyph: "▲", className: "dpad" },
    DPAD_DOWN: { glyph: "▼", className: "dpad" },
    DPAD_LEFT: { glyph: "◀", className: "dpad" },
    DPAD_RIGHT: { glyph: "▶", className: "dpad" },
  },
  nintendo: {
    A: { glyph: "A", className: "button-b" }, // Nintendo A is on the right
    B: { glyph: "B", className: "button-a" },
    X: { glyph: "X", className: "button-y" },
    Y: { glyph: "Y", className: "button-x" },
    LB: { glyph: "L", className: "button-lb" },
    RB: { glyph: "R", className: "button-rb" },
    LT: { glyph: "ZL", className: "button-lt" },
    RT: { glyph: "ZR", className: "button-rt" },
    SELECT: { glyph: "-", className: "button-select" },
    START: { glyph: "+", className: "button-start" },
    L3: { glyph: "L", className: "button-lb" },
    R3: { glyph: "R", className: "button-rb" },
    DPAD_UP: { glyph: "▲", className: "dpad" },
    DPAD_DOWN: { glyph: "▼", className: "dpad" },
    DPAD_LEFT: { glyph: "◀", className: "dpad" },
    DPAD_RIGHT: { glyph: "▶", className: "dpad" },
  },
  generic: {
    A: { glyph: "1", className: "button-a" },
    B: { glyph: "2", className: "button-b" },
    X: { glyph: "3", className: "button-x" },
    Y: { glyph: "4", className: "button-y" },
    LB: { glyph: "L1", className: "button-lb" },
    RB: { glyph: "R1", className: "button-rb" },
    LT: { glyph: "L2", className: "button-lt" },
    RT: { glyph: "R2", className: "button-rt" },
    SELECT: { glyph: "Sel", className: "button-select" },
    START: { glyph: "Str", className: "button-start" },
    L3: { glyph: "L3", className: "button-lb" },
    R3: { glyph: "R3", className: "button-rb" },
    DPAD_UP: { glyph: "▲", className: "dpad" },
    DPAD_DOWN: { glyph: "▼", className: "dpad" },
    DPAD_LEFT: { glyph: "◀", className: "dpad" },
    DPAD_RIGHT: { glyph: "▶", className: "dpad" },
  },
};

/**
 * Hook to track gamepad connection state
 */
export function useGamepadConnected(): boolean {
  const [connected, setConnected] = useState(isGamepadConnected());

  useEffect(() => {
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => {
      // Check if any gamepads still connected
      setConnected(isGamepadConnected());
    };

    window.addEventListener("gamepadconnected", handleConnect);
    window.addEventListener("gamepaddisconnected", handleDisconnect);

    return () => {
      window.removeEventListener("gamepadconnected", handleConnect);
      window.removeEventListener("gamepaddisconnected", handleDisconnect);
    };
  }, []);

  return connected;
}

/**
 * Hook to get the connected gamepad type
 */
export function useGamepadType():
  | "xbox"
  | "playstation"
  | "nintendo"
  | "generic" {
  const [type, setType] = useState<
    "xbox" | "playstation" | "nintendo" | "generic"
  >(() => getGamepadType() || "xbox");

  useEffect(() => {
    const updateType = () => {
      setType(getGamepadType() || "xbox");
    };

    window.addEventListener("gamepadconnected", updateType);
    window.addEventListener("gamepaddisconnected", updateType);

    return () => {
      window.removeEventListener("gamepadconnected", updateType);
      window.removeEventListener("gamepaddisconnected", updateType);
    };
  }, []);

  return type;
}

/**
 * Props for GamepadButtonHint component
 */
interface GamepadButtonHintProps {
  /** Button to display */
  button: GamepadButtonName;
  /** Optional label to show next to button */
  label?: string;
  /** Additional CSS classes */
  className?: string;
  /** Force specific controller type (default: auto-detect) */
  controllerType?: "xbox" | "playstation" | "nintendo" | "generic";
}

/**
 * Single gamepad button hint with optional label
 */
export function GamepadButtonHint({
  button,
  label,
  className = "",
  controllerType,
}: GamepadButtonHintProps): React.ReactElement | null {
  const gamepadConnected = useGamepadConnected();
  const detectedType = useGamepadType();
  const type = controllerType || detectedType;

  // Don't render if no gamepad connected and not forced
  if (!gamepadConnected && !controllerType) {
    return null;
  }

  const buttonInfo =
    BUTTON_GLYPHS[type]?.[button] || BUTTON_GLYPHS.xbox[button];

  if (label) {
    return (
      <span className={`controller-hint gamepad-hint ${className}`}>
        <span className={`gamepad-button-glyph ${buttonInfo.className}`}>
          {buttonInfo.glyph}
        </span>
        <span className="controller-hint-label">{label}</span>
      </span>
    );
  }

  return (
    <span
      className={`gamepad-button-glyph gamepad-hint ${buttonInfo.className} ${className}`}
    >
      {buttonInfo.glyph}
    </span>
  );
}

/**
 * Props for GamepadActionBar component
 */
interface GamepadActionBarProps {
  /** Actions to display */
  actions: Array<{
    button: GamepadButtonName;
    label: string;
  }>;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Action bar showing multiple button hints
 * Typically displayed at bottom of screen
 */
export function GamepadActionBar({
  actions,
  className = "",
}: GamepadActionBarProps): React.ReactElement | null {
  const gamepadConnected = useGamepadConnected();

  if (!gamepadConnected) {
    return null;
  }

  return (
    <div className={`gamepad-action-bar ${className}`}>
      {actions.map((action) => (
        <div key={action.button} className="action-item">
          <GamepadButtonHint button={action.button} />
          <span>{action.label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Props for AdaptiveHint component
 */
interface AdaptiveHintProps {
  /** Keyboard key to show when no gamepad */
  keyboardKey: string;
  /** Gamepad button to show when gamepad connected */
  gamepadButton: GamepadButtonName;
  /** Label for the action */
  label?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Adaptive hint that shows keyboard or gamepad hint based on input device
 */
export function AdaptiveHint({
  keyboardKey,
  gamepadButton,
  label,
  className = "",
}: AdaptiveHintProps): React.ReactElement {
  const gamepadConnected = useGamepadConnected();

  if (gamepadConnected) {
    return (
      <GamepadButtonHint
        button={gamepadButton}
        label={label}
        className={className}
      />
    );
  }

  // Keyboard hint
  return (
    <span className={`controller-hint keyboard-hint ${className}`}>
      <kbd className="px-2 py-1 bg-gray-700 rounded text-sm font-mono">
        {keyboardKey}
      </kbd>
      {label && <span className="controller-hint-label ml-2">{label}</span>}
    </span>
  );
}

/**
 * Common action hints for the game
 */
export const CommonHints = {
  Interact: () => (
    <AdaptiveHint keyboardKey="E" gamepadButton="A" label="Interact" />
  ),
  Cancel: () => (
    <AdaptiveHint keyboardKey="Esc" gamepadButton="B" label="Cancel" />
  ),
  Attack: () => (
    <AdaptiveHint keyboardKey="Space" gamepadButton="X" label="Attack" />
  ),
  Inventory: () => (
    <AdaptiveHint keyboardKey="I" gamepadButton="SELECT" label="Inventory" />
  ),
  Menu: () => (
    <AdaptiveHint keyboardKey="Esc" gamepadButton="START" label="Menu" />
  ),
};

export default GamepadButtonHint;
