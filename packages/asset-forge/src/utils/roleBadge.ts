/**
 * Map a team role string to the visual badge presentation. Single
 * source of truth — pages must not roll their own.
 *
 * Tones:
 *   primary   — Owner/Admin (Forge Gold accent)
 *   secondary — Editor (text-secondary)
 *   tertiary  — Viewer / unknown roles (text-tertiary)
 */

import { Crown, Settings, Shield, User, type LucideIcon } from "lucide-react";

export type RoleBadgeTone = "primary" | "secondary" | "tertiary";

export interface RoleBadge {
  label: string;
  icon: LucideIcon;
  tone: RoleBadgeTone;
}

export function roleBadge(role: string): RoleBadge {
  const normalized = role.toLowerCase();
  if (normalized === "owner")
    return { label: "Owner", icon: Crown, tone: "primary" };
  if (normalized === "admin")
    return { label: "Admin", icon: Shield, tone: "primary" };
  if (normalized === "editor")
    return { label: "Editor", icon: Settings, tone: "secondary" };
  return { label: role || "Viewer", icon: User, tone: "tertiary" };
}

/** Tailwind class for tinting the badge icon/text based on tone. */
export function roleBadgeIconClass(tone: RoleBadgeTone): string {
  return tone === "primary" ? "text-primary" : "text-text-tertiary";
}

export function roleBadgeTextClass(tone: RoleBadgeTone): string {
  if (tone === "primary") return "text-primary";
  if (tone === "secondary") return "text-text-secondary";
  return "text-text-secondary";
}
