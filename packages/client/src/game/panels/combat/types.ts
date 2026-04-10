/**
 * Combat Panel Type Definitions
 *
 * Shared types used across combat sub-components.
 */

import type { Theme } from "@/ui/theme/themes";
import type { PlayerHealth } from "../../../types";

/** Individual combat style descriptor */
export interface CombatStyleInfo {
  id: string;
  label: string;
  xp: string;
  color: string;
}

/** Props for the combat style selector section */
export interface CombatStyleSelectorProps {
  styles: CombatStyleInfo[];
  activeStyleId: string;
  cooldown: number;
  compactPanel: boolean;
  theme: Theme;
  onStyleChange: (styleId: string) => void;
}

/** Props for the combat bonuses / HP + level display */
export interface CombatBonusesDisplayProps {
  health: PlayerHealth;
  combatLevel: number;
  inCombat: boolean;
  attackLevel: number;
  strengthLevel: number;
  defenseLevel: number;
  targetName: string | null;
  targetHealth: PlayerHealth | null;
  compactPanel: boolean;
  ultraCompactPanel: boolean;
  isMobile: boolean;
  innerPadding: number;
  theme: Theme;
}

/** Props for the special attack bar (future expansion) */
export interface SpecialAttackBarProps {
  specialEnergy: number;
  theme: Theme;
  compactPanel: boolean;
}

/** Props for the auto-retaliate toggle */
export interface AutoRetaliateToggleProps {
  enabled: boolean;
  onToggle: () => void;
  theme: Theme;
}

/** Event data interfaces for type-safe event handling */
export interface StyleUpdateEvent {
  playerId: string;
  currentStyle: { id: string };
}

export interface TargetChangedEvent {
  targetId: string | null;
  targetName?: string;
  targetHealth?: PlayerHealth;
}

export interface TargetHealthEvent {
  targetId: string;
  health: PlayerHealth;
}

export interface AutoRetaliateEvent {
  playerId: string;
  enabled: boolean;
}
