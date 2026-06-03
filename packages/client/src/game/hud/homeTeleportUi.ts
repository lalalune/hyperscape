import { HOME_TELEPORT_CONSTANTS } from "@hyperforge/shared";

export function readHomeTeleportRemainingMs(event?: unknown): number {
  const payload = event as { remainingMs?: number } | undefined;
  return payload?.remainingMs ?? 0;
}

export function getHomeTeleportCooldownProgress(
  cooldownRemaining: number,
): number {
  return Math.max(
    0,
    Math.min(
      100,
      ((HOME_TELEPORT_CONSTANTS.COOLDOWN_MS - cooldownRemaining) /
        HOME_TELEPORT_CONSTANTS.COOLDOWN_MS) *
        100,
    ),
  );
}
