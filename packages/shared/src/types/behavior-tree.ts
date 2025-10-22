/**
 * Behavior Tree Types
 *
 * Defines JSON-based behavior trees for character AI.
 * Behavior trees control movement, combat, dialogue, and other actions.
 *
 * Key Concepts:
 * - **Nodes**: Building blocks of behavior (conditions, actions, sequences)
 * - **Conditions**: Boolean checks (distance, health, time, etc.)
 * - **Actions**: Things characters do (move, attack, say, offer quest)
 * - **Sequences**: Run multiple nodes in order
 * - **Selectors**: Run first successful node
 *
 * Used by: BehaviorSystem, CharacterEntity, Asset Forge Behavior Editor
 */

import type { Position3D } from './core';

// ============================================================================
// Behavior Tree Structure
// ============================================================================

export interface BehaviorTree {
  rootNode: string; // ID of the starting node
  nodes: BehaviorNode[];
}

export type BehaviorNode =
  | ConditionNode
  | ActionNode
  | SequenceNode
  | SelectorNode;

export interface BaseNode {
  id: string;
  type: 'condition' | 'action' | 'sequence' | 'selector';
}

// ============================================================================
// Node Types
// ============================================================================

/**
 * Condition Node - Evaluates a boolean condition
 * Branches to different nodes based on true/false result
 */
export interface ConditionNode extends BaseNode {
  type: 'condition';
  condition: BehaviorCondition;
  onTrue: string; // Node ID to run if condition is true
  onFalse: string; // Node ID to run if condition is false
}

/**
 * Action Node - Executes an action
 * Actions are things the character does (move, attack, say dialogue, etc.)
 */
export interface ActionNode extends BaseNode {
  type: 'action';
  action: BehaviorAction;
  next?: string; // Optional node ID to run after action completes
}

/**
 * Sequence Node - Runs multiple nodes in order
 * Stops if any node fails
 */
export interface SequenceNode extends BaseNode {
  type: 'sequence';
  children: string[]; // Node IDs to run in order
  next?: string; // Node ID to run after sequence completes
}

/**
 * Selector Node - Runs first successful node
 * Stops when a node succeeds
 */
export interface SelectorNode extends BaseNode {
  type: 'selector';
  children: string[]; // Node IDs to try in order
  next?: string; // Node ID to run after selector completes
}

// ============================================================================
// Conditions
// ============================================================================

export type BehaviorCondition =
  | DistanceCheckCondition
  | HealthCheckCondition
  | PlayerLevelCheckCondition
  | HasQuestCondition
  | TimeOfDayCondition
  | FactionCheckCondition
  | RandomChanceCondition
  | InCombatCondition;

export interface DistanceCheckCondition {
  type: 'distance_check';
  distance: number; // Max distance in meters
  target?: 'nearest_player' | 'nearest_enemy' | 'spawn_point';
}

export interface HealthCheckCondition {
  type: 'health_check';
  operator: '<' | '>' | '<=' | '>=' | '==';
  value: number; // Percentage (0-100) or absolute value
  usePercentage: boolean;
}

export interface PlayerLevelCheckCondition {
  type: 'player_level_check';
  minLevel?: number;
  maxLevel?: number;
}

export interface HasQuestCondition {
  type: 'has_quest';
  questId: string;
  status: 'available' | 'active' | 'completed';
}

export interface TimeOfDayCondition {
  type: 'time_of_day';
  startHour: number; // 0-23
  endHour: number; // 0-23
}

export interface FactionCheckCondition {
  type: 'faction_check';
  faction: string;
  reputation: 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'allied';
}

export interface RandomChanceCondition {
  type: 'random_chance';
  probability: number; // 0.0 to 1.0
}

export interface InCombatCondition {
  type: 'in_combat';
}

// ============================================================================
// Actions
// ============================================================================

export type BehaviorAction =
  | IdleAction
  | SayAction
  | PatrolAction
  | WanderAction
  | CombatAction
  | FleeAction
  | OfferQuestAction
  | OpenShopAction
  | TurnToPlayerAction
  | PlayAnimationAction
  | SetFlagAction;

export interface IdleAction {
  type: 'idle';
  duration?: number; // Optional duration in milliseconds
}

export interface SayAction {
  type: 'say';
  text: string;
  duration?: number; // How long to show text (ms)
  voiceClipId?: string; // Optional voice clip ID
}

export interface PatrolAction {
  type: 'patrol';
  points: Position3D[]; // Patrol waypoints
  loop?: boolean; // Loop back to start? (default: true)
  waitTime?: number; // Time to wait at each point (ms)
}

export interface WanderAction {
  type: 'wander';
  radius: number; // Wander radius from spawn point
  minMoveTime?: number; // Min time to move (ms)
  maxMoveTime?: number; // Max time to move (ms)
}

export interface CombatAction {
  type: 'combat';
  targetNearestPlayer?: boolean;
  targetNearestEnemy?: boolean;
  targetAttacker?: boolean;
  callAllies?: boolean; // Call nearby allies to help?
  allyRadius?: number; // How far to search for allies
}

export interface FleeAction {
  type: 'flee';
  destination: 'spawn_point' | 'nearest_ally' | 'safe_zone';
  minDistance?: number; // Min distance to flee
}

export interface OfferQuestAction {
  type: 'offer_quest';
  questId: string;
}

export interface OpenShopAction {
  type: 'open_shop';
}

export interface TurnToPlayerAction {
  type: 'turn_to_player';
}

export interface PlayAnimationAction {
  type: 'play_animation';
  animationName: string;
  loop?: boolean;
  duration?: number;
}

export interface SetFlagAction {
  type: 'set_flag';
  flag: string;
  value: boolean;
}

// ============================================================================
// Behavior State (Runtime)
// ============================================================================

/**
 * Runtime state for behavior tree execution
 * Tracked per character instance
 */
export interface BehaviorState {
  currentNodeId: string; // Currently executing node
  nodeHistory: string[]; // History of executed nodes (for debugging)
  lastEvaluationTime: number; // Timestamp of last behavior update
  completedNodes: Set<string>; // Nodes that have completed (for sequences)
  blackboard: Record<string, unknown>; // Shared data between nodes
}

// ============================================================================
// Behavior Tree Events
// ============================================================================

export interface BehaviorExecutedEvent {
  characterId: string;
  nodeId: string;
  nodeType: 'condition' | 'action' | 'sequence' | 'selector';
  success: boolean;
  timestamp: number;
}

// ============================================================================
// Validation
// ============================================================================

export interface BehaviorTreeValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Character Behavior Configuration
// ============================================================================

/**
 * Complete behavior configuration for a character
 * Includes main behavior tree + event-triggered behaviors
 */
export interface CharacterBehaviorConfig {
  // Main behavior tree (runs continuously)
  mainBehavior: BehaviorTree;

  // Event-triggered behaviors
  onAttacked?: BehaviorTree; // Behavior when attacked
  onPlayerNearby?: BehaviorTree; // Behavior when player approaches
  onLowHealth?: BehaviorTree; // Behavior when health < threshold
  onAllyDied?: BehaviorTree; // Behavior when nearby ally dies

  // Behavior parameters
  updateInterval?: number; // How often to evaluate behavior (ms), default: 500
  aggroRange?: number; // Detection range for players/enemies
  fleeHealthThreshold?: number; // Health % to trigger flee behavior
}
