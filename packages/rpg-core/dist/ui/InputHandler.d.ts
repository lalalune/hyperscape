import { World } from '@hyperfy/sdk';
import type { Vector3 as Vector2 } from '../types';
export interface InputState {
    mouse: {
        position: Vector2;
        buttons: boolean[];
        wheel: number;
    };
    keyboard: {
        keys: Set<string>;
        shift: boolean;
        ctrl: boolean;
        alt: boolean;
    };
    touch: {
        touches: TouchPoint[];
    };
}
export interface TouchPoint {
    id: number;
    position: Vector2;
    startPosition: Vector2;
    startTime: number;
}
export interface InputEvent {
    type: InputEventType;
    playerId: string;
    data: any;
    timestamp: number;
}
export declare enum InputEventType {
    MOUSE_MOVE = "mouse_move",
    MOUSE_DOWN = "mouse_down",
    MOUSE_UP = "mouse_up",
    MOUSE_WHEEL = "mouse_wheel",
    KEY_DOWN = "key_down",
    KEY_UP = "key_up",
    TOUCH_START = "touch_start",
    TOUCH_MOVE = "touch_move",
    TOUCH_END = "touch_end"
}
export declare class InputHandler {
    private world;
    private canvas;
    private state;
    private playerId;
    private mouseSensitivity;
    private keyBindings;
    private preventDefaultKeys;
    private dragStart;
    private isDragging;
    private dragThreshold;
    constructor(world: World, playerId: string);
    /**
     * Initialize input handler with canvas
     */
    initialize(canvas: HTMLCanvasElement): void;
    /**
     * Setup default key bindings
     */
    private setupDefaultKeyBindings;
    /**
     * Handle mouse move
     */
    private handleMouseMove;
    /**
     * Handle mouse down
     */
    private handleMouseDown;
    /**
     * Handle mouse up
     */
    private handleMouseUp;
    /**
     * Handle mouse wheel
     */
    private handleMouseWheel;
    /**
     * Handle key down
     */
    private handleKeyDown;
    /**
     * Handle key up
     */
    private handleKeyUp;
    /**
     * Handle touch start
     */
    private handleTouchStart;
    /**
     * Handle touch move
     */
    private handleTouchMove;
    /**
     * Handle touch end
     */
    private handleTouchEnd;
    /**
     * Handle key action
     */
    private handleKeyAction;
    /**
     * Update hovered element
     */
    private updateHoveredElement;
    /**
     * Handle element click
     */
    private handleElementClick;
    /**
     * Set key binding
     */
    setKeyBinding(key: string, action: string): void;
    /**
     * Remove key binding
     */
    removeKeyBinding(key: string): void;
    /**
     * Get current input state
     */
    getState(): InputState;
    /**
     * Is key pressed
     */
    isKeyPressed(key: string): boolean;
    /**
     * Is mouse button pressed
     */
    isMouseButtonPressed(button: number): boolean;
    /**
     * Get mouse position
     */
    getMousePosition(): Vector2;
    /**
     * Set mouse sensitivity
     */
    setMouseSensitivity(sensitivity: number): void;
    /**
     * Cleanup
     */
    destroy(): void;
}
//# sourceMappingURL=InputHandler.d.ts.map