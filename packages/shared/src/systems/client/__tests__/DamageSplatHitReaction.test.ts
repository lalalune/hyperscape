import { describe, expect, it, vi } from "vitest";

import type { CombatDamageDealtPayload } from "../../../types/events/event-payloads";
import {
  getPlayerHitReactionIntensity,
  getPlayerHitReactionSide,
} from "../../../utils/rendering/HitReaction";
import { triggerPlayerDamageReaction } from "../DamageSplatSystem";

function damage(
  overrides: Partial<CombatDamageDealtPayload> = {},
): CombatDamageDealtPayload {
  return {
    attackerId: "attacker-a",
    targetId: "target-b",
    damage: 9,
    targetType: "player",
    ...overrides,
  };
}

describe("damage-synchronized player hit reactions", () => {
  it("triggers one deterministic additive reaction for a positive player hit", () => {
    const triggerHitReaction = vi.fn();
    const target = {
      isPlayer: true,
      avatar: { triggerHitReaction },
    };
    const payload = damage({ isCritical: true });

    expect(triggerPlayerDamageReaction(target, payload)).toBe(true);
    expect(triggerHitReaction).toHaveBeenCalledOnce();
    expect(triggerHitReaction).toHaveBeenCalledWith(
      getPlayerHitReactionIntensity(payload.damage, true),
      getPlayerHitReactionSide(payload.attackerId, payload.targetId),
    );
  });

  it("ignores misses, mobs, unavailable avatars, and non-finite damage", () => {
    const triggerHitReaction = vi.fn();
    const player = {
      isPlayer: true,
      avatar: { triggerHitReaction },
    };

    expect(triggerPlayerDamageReaction(player, damage({ damage: 0 }))).toBe(
      false,
    );
    expect(
      triggerPlayerDamageReaction(player, damage({ damage: Number.NaN })),
    ).toBe(false);
    expect(
      triggerPlayerDamageReaction(player, damage({ targetType: "mob" })),
    ).toBe(false);
    expect(triggerPlayerDamageReaction({ isPlayer: true }, damage())).toBe(
      false,
    );
    expect(triggerPlayerDamageReaction(null, damage())).toBe(false);
    expect(triggerHitReaction).not.toHaveBeenCalled();
  });

  it("uses entity identity when older payloads omit target type", () => {
    const triggerHitReaction = vi.fn();
    const payload = damage({ targetType: undefined });

    expect(
      triggerPlayerDamageReaction(
        { isPlayer: true, avatar: { triggerHitReaction } },
        payload,
      ),
    ).toBe(true);
    expect(
      triggerPlayerDamageReaction(
        { isPlayer: false, avatar: { triggerHitReaction } },
        payload,
      ),
    ).toBe(false);
  });
});
