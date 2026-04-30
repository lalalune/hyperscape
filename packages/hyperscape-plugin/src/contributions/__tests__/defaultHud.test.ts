/**
 * HYPERSCAPE_DEFAULT_HUD_LAYOUT — schema + shape tests.
 *
 * Phase B0'.F. Locks in the contract: the plugin exports a
 * UILayoutManifest that validates against `UILayoutManifestSchema`
 * and contains the essential widgets (HP bar + action bar) PIE
 * Play of Hyperia depends on rendering.
 */

import { describe, expect, it } from "vitest";
import { UILayoutManifestSchema } from "@hyperforge/ui-framework";
import {
  HYPERSCAPE_DEFAULT_HUD_LAYOUT,
  HYPERSCAPE_DEFAULT_HUD_LAYOUT_ID,
} from "../defaultHud.js";

describe("HYPERSCAPE_DEFAULT_HUD_LAYOUT", () => {
  it("validates against UILayoutManifestSchema", () => {
    const r = UILayoutManifestSchema.safeParse(HYPERSCAPE_DEFAULT_HUD_LAYOUT);
    expect(r.success).toBe(true);
  });

  it("uses the documented id", () => {
    expect(HYPERSCAPE_DEFAULT_HUD_LAYOUT.id).toBe(
      HYPERSCAPE_DEFAULT_HUD_LAYOUT_ID,
    );
    expect(HYPERSCAPE_DEFAULT_HUD_LAYOUT_ID).toBe(
      "com.hyperforge.hyperscape.hud",
    );
  });

  it("includes HP bar bound to live player data", () => {
    const hp = HYPERSCAPE_DEFAULT_HUD_LAYOUT.instances.find(
      (i) => i.instanceId === "hp-bar-main",
    );
    expect(hp).toBeDefined();
    expect(hp?.widgetId).toBe("hyperforge.hud.hp-bar");
    expect(hp?.bindings?.current).toBe("$player.hp");
    expect(hp?.bindings?.max).toBe("$player.maxHp");
  });

  it("includes action bar", () => {
    const ab = HYPERSCAPE_DEFAULT_HUD_LAYOUT.instances.find(
      (i) => i.instanceId === "action-bar-main",
    );
    expect(ab).toBeDefined();
    expect(ab?.widgetId).toBe("hyperforge.hud.action-bar");
  });

  it("includes tooltip overlay", () => {
    const tt = HYPERSCAPE_DEFAULT_HUD_LAYOUT.instances.find(
      (i) => i.instanceId === "tooltip-hover",
    );
    expect(tt).toBeDefined();
    expect(tt?.widgetId).toBe("hyperforge.overlay.tooltip");
  });
});
