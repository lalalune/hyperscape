/**
 * ControlPriorities.ts - Input System Priority Levels
 * 
 * Defines priority ordering for input bindings in the control system.
 * Higher priority bindings can "consume" input, preventing lower priority handlers from seeing it.
 * 
 * Priority Hierarchy (lowest to highest):
 * 0. PLAYER: Base player input (movement, looking around)
 * 1. ENTITY: Entity-specific controls (mounted vehicles, etc.)
 * 2. APP: App-level controls (mini-games, special modes)
 * 3. BUILDER: Builder tool controls (takes over mouse wheel, etc.)
 * 4. ACTION: Action system (E key for interactions, etc.)
 * 5. CORE_UI: Core UI elements (menus, dialogs)
 * 6. POINTER: Pointer lock and cursor system (highest priority)
 * 
 * How It Works:
 * - Each control binding has a priority number
 * - When input occurs (key press, mouse move), bindings are checked highest priority first
 * - A binding can "consume" input by returning true from its handler
 * - Consumed input doesn't propagate to lower priority bindings
 * 
 * Example Use Case:
 * - UI menu is open (CORE_UI priority = 5)
 * - Player presses W key
 * - Menu's W handler returns true (consumes input)
 * - Player's W movement handler never sees the input
 * - This prevents moving while typing in chat
 * 
 * Usage:
 * ```ts
 * import { ControlPriorities } from './extras/ControlPriorities';
 * 
 * world.controls.bind({
 *   priority: ControlPriorities.BUILDER,
 *   // ... other options
 * });
 * ```
 * 
 * Referenced by: ClientInput system, PlayerLocal, ClientActions, UI systems
 */

/**
 * Priority constants for input binding system.
 * Lower numbers = lower priority (checked last)
 * Higher numbers = higher priority (checked first, can consume input)
 */
export const ControlPriorities = {
  /** Base player controls (movement, looking) */
  PLAYER: 0,
  
  /** Entity-specific controls (vehicles, mounts) */
  ENTITY: 1,
  
  /** Application-level controls (mini-games, special modes) */
  APP: 2,
  
  /** World builder controls (mouse wheel for tool selection, etc.) */
  BUILDER: 3,
  
  /** Action system (E for interact, etc.) */
  ACTION: 4,
  
  /** Core UI (menus, dialogs, inventory) */
  CORE_UI: 5,
  
  /** Pointer lock and cursor (highest priority) */
  POINTER: 6,
}
