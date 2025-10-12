/**
 * Interaction system types
 * 
 * These types are used for entity interactions, context menus,
 * and action handling across the UI and game systems.
 */

import type { InteractionAction as BaseInteractionAction } from './core';

/**
 * Interaction action with UI callback
 */
export interface InteractionAction extends Omit<BaseInteractionAction, 'callback'> {
  onClick: () => void;
}

/**
 * Base interaction target
 */
export interface InteractionTargetBase {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  actions: InteractionAction[];
}

/**
 * Resource interaction target
 */
export interface ResourceTarget extends InteractionTargetBase {
  type: 'resource';
  requiredTool?: string;
}

/**
 * All possible interaction targets
 */
export type InteractionTarget = 
  | (InteractionTargetBase & { type: 'bank' | 'store' | 'npc' | 'item' | 'mob' })
  | ResourceTarget;

/**
 * Context menu state for interactions
 */
export interface InteractionContextMenuState {
  visible: boolean;
  position: { x: number; y: number };
  target: InteractionTarget | null;
}

/**
 * Item context menu for inventory actions
 */
export interface ItemContextMenu {
  visible: boolean;
  position: { x: number; y: number };
  item: unknown;
}