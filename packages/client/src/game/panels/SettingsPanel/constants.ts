/**
 * Settings Panel Constants
 *
 * Constant values used across settings panel components.
 *
 * @packageDocumentation
 */

import type { LucideIcon } from "lucide-react";
import { CircleUserRound, Sparkles, Layout, Volume2, Cpu } from "lucide-react";
import type { ComplexityMode } from "@/ui";

/**
 * Settings tab definition
 */
export interface SettingsTab {
  id: string;
  Icon: LucideIcon;
  label: string;
}

/**
 * Available settings tabs
 */
export const SETTINGS_TABS: SettingsTab[] = [
  { id: "account", Icon: CircleUserRound, label: "Account" },
  { id: "visuals", Icon: Sparkles, label: "Visual" },
  { id: "interface", Icon: Layout, label: "UI" },
  { id: "audio", Icon: Volume2, label: "Audio" },
  { id: "backend", Icon: Cpu, label: "System" },
];

/**
 * Shadow quality options
 */
export const SHADOW_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Low", value: "low" },
  { label: "Med", value: "med" },
  { label: "High", value: "high" },
] as const;

/**
 * Color grading options
 */
export const COLOR_GRADING_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Cinematic", value: "cinematic" },
  { label: "Bourbon", value: "bourbon" },
  { label: "Chemical", value: "chemical" },
  { label: "Clayton", value: "clayton" },
  { label: "Cubicle", value: "cubicle" },
  { label: "Remy", value: "remy" },
  { label: "B&W", value: "bw" },
  { label: "Night", value: "night" },
] as const;

/**
 * Complexity mode options
 */
export const COMPLEXITY_MODES: { mode: ComplexityMode; icon: string }[] = [
  { mode: "simple", icon: "🎮" },
  { mode: "standard", icon: "⚔️" },
  { mode: "advanced", icon: "🏰" },
];

/**
 * Cloud feature definitions
 */
export const CLOUD_FEATURES = [
  {
    id: "sync",
    label: "Cross-Device Sync",
    description: "Play on any device with your progress intact",
    icon: "🔄",
  },
  {
    id: "backup",
    label: "Cloud Backup",
    description: "Automatic saves to prevent data loss",
    icon: "☁️",
  },
  {
    id: "recovery",
    label: "Account Recovery",
    description: "Restore your account if you lose access",
    icon: "🔐",
  },
] as const;

/**
 * Minimum name length required for submission
 */
export const MIN_NAME_LENGTH = 1;
