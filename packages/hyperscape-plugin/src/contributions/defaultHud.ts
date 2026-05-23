/**
 * Hyperia plugin's default HUD layout contribution.
 *
 * Phase B0'.F of `PLAN_PROJECT_AS_DATA.md` introduced this as the
 * canonical Hyperia HUD shape — both the production client at
 * `localhost:3333` and PIE Play of a Hyperia project should render
 * the same layout without per-host duplication.
 *
 * Phase 1.2 of PLAN_AAA_UE5_PARITY (this commit) expanded the layout
 * from the original 3-widget minimal cut (HP bar + action bar +
 * tooltip) to the full 15-widget HUD that the production client
 * previously kept in `packages/client/src/ui-framework/defaultLayout.ts`.
 * That client copy now thin-re-exports from this manifest so PIE Play
 * and localhost:3333 render the same panels (inventory, chat, skills,
 * equipment, stats, prayer, spells, quests, bank, friends, settings,
 * plus the HP bar / action bar / tooltip / minimap).
 *
 * Every widget id here is registered by `bindAllWidgets()` (engine
 * builtins in `@hyperforge/ui-widgets`), so the layout renders
 * without depending on any further plugin contributions.
 *
 * Bindings reference the live `DataContext` PIE assembles via
 * `PIEEditorSession.getDataContext()` (B0.3, already shipped) and the
 * production client populates via its data source registry:
 *
 *   - `$player.hp`           → current player HP
 *   - `$player.maxHp`        → player's max HP
 *   - `$player.prayer`       → current prayer points
 *   - `$player.maxPrayer`    → max prayer points
 *   - `$player.combatLevel`  → combat level
 *   - `$inventory.items`     → inventory grid contents
 *   - `$inventory.coins`     → coin pouch total
 *   - `$skills.items`        → per-skill level/xp rows
 *   - `$skills.total`        → total skill level
 *   - `$skills.combatLevel`  → derived combat level
 *   - `$equipment.items`     → equipment slot contents
 *
 * When the binding source isn't populated (pre-spawn), the
 * widget's static `props` provide a fallback so the HUD doesn't
 * blank out.
 *
 * Most panels (inventory, chat, skills, etc.) ship with
 * `visible: false` — the in-game HUD framework toggles each one via
 * its keybinding (I = inventory, K = skills, etc.).
 */

import {
  UILayoutManifestSchema,
  type UILayoutManifest,
} from "@hyperforge/ui-framework";

export const HYPERSCAPE_DEFAULT_HUD_LAYOUT_ID = "com.hyperforge.hyperscape.hud";

/**
 * Default Hyperia HUD. Validated through `UILayoutManifestSchema`
 * at module load so any schema drift surfaces immediately on
 * import.
 */
export const HYPERSCAPE_DEFAULT_HUD_LAYOUT: UILayoutManifest =
  UILayoutManifestSchema.parse({
    id: HYPERSCAPE_DEFAULT_HUD_LAYOUT_ID,
    name: "Hyperia Default HUD",
    description:
      "Canonical Hyperia HUD layout — full 15-widget set rendered identically by the production client and PIE Play of a Hyperia project. Phase 1.2 of PLAN_AAA_UE5_PARITY moved the panel set in from packages/client/src/ui-framework/defaultLayout.ts.",
    instances: [
      // ---------- Always-on HUD frame ----------
      {
        instanceId: "hp-bar-main",
        widgetId: "hyperforge.hud.hp-bar",
        customization: { movable: true },
        position: {
          kind: "anchored",
          anchor: "top-left",
          offset: { x: 60, y: 20 },
        },
        props: {
          orientation: "horizontal",
          showNumeric: true,
          current: 10,
          max: 10,
        },
        bindings: {
          current: "$player.hp",
          max: "$player.maxHp",
        },
        label: "HP",
      },
      {
        instanceId: "action-bar-main",
        widgetId: "hyperforge.hud.action-bar",
        customization: { movable: true },
        position: {
          kind: "anchored",
          anchor: "bottom-center",
          offset: { x: 0, y: -24 },
        },
        props: {
          slotCount: 7,
          slotSize: 36,
          showKeybindings: true,
          showGcd: true,
        },
        label: "Action Bar",
      },
      {
        instanceId: "tooltip-hover",
        widgetId: "hyperforge.overlay.tooltip",
        position: {
          kind: "anchored",
          anchor: "top-left",
          offset: { x: 12, y: 12 },
        },
        props: {
          anchor: "cursor",
          delayMs: 300,
          maxWidth: 320,
        },
        label: "Tooltip",
        visible: false,
      },
      {
        instanceId: "minimap-main",
        widgetId: "hyperforge.hud.minimap",
        customization: { movable: true },
        position: {
          kind: "anchored",
          anchor: "top-right",
          offset: { x: -24, y: 24 },
        },
        props: {
          size: 220,
          baseRadius: 48,
          showCompass: true,
          showPlayerPips: true,
          showEntityPips: true,
        },
        label: "Minimap",
      },

      // ---------- Always-on bottom-left chat ----------
      {
        instanceId: "chat-main",
        widgetId: "hyperforge.panel.chat",
        position: {
          kind: "anchored",
          anchor: "bottom-left",
          offset: { x: 24, y: -120 },
        },
        props: {
          bufferSize: 200,
          showChannels: true,
          autoHide: false,
          autoHideDelaySeconds: 10,
        },
        label: "Chat",
      },

      // ---------- Toggleable panels (visible:false by default) ----------
      {
        instanceId: "inventory-main",
        widgetId: "hyperforge.panel.inventory",
        position: {
          kind: "anchored",
          anchor: "bottom-right",
          offset: { x: -24, y: -24 },
        },
        props: {
          columns: 4,
          rows: 7,
          showQuantities: true,
          allowDragToActionBar: true,
        },
        bindings: {
          items: "$inventory.items",
        },
        label: "Inventory",
        visible: false,
      },
      {
        instanceId: "skills-main",
        widgetId: "hyperforge.panel.skills",
        position: {
          kind: "anchored",
          anchor: "bottom-right",
          offset: { x: -24, y: -320 },
        },
        props: {
          columns: 3,
          showHeader: true,
          total: 15,
          combatLevel: 3,
        },
        bindings: {
          items: "$skills.items",
          total: "$skills.total",
          combatLevel: "$skills.combatLevel",
        },
        label: "Skills",
        visible: false,
      },
      {
        instanceId: "equipment-main",
        widgetId: "hyperforge.panel.equipment",
        position: {
          kind: "anchored",
          anchor: "bottom-right",
          offset: { x: -270, y: -24 },
        },
        props: {
          showAvatar: true,
          showCombatSummary: true,
        },
        bindings: {
          items: "$equipment.items",
        },
        label: "Equipment",
        visible: false,
      },
      {
        instanceId: "stats-main",
        widgetId: "hyperforge.panel.stats",
        position: {
          kind: "anchored",
          anchor: "top-left",
          offset: { x: 20, y: 60 },
        },
        props: {
          playerName: "Player",
          combatLevel: 3,
          hp: 10,
          maxHp: 10,
          prayer: 1,
          maxPrayer: 1,
          totalLevel: 15,
        },
        bindings: {
          combatLevel: "$player.combatLevel",
          hp: "$player.hp",
          maxHp: "$player.maxHp",
          prayer: "$player.prayer",
          maxPrayer: "$player.maxPrayer",
          totalLevel: "$skills.total",
        },
        label: "Stats",
        visible: false,
      },
      {
        instanceId: "prayer-main",
        widgetId: "hyperforge.panel.prayer",
        position: {
          kind: "anchored",
          anchor: "bottom-right",
          offset: { x: -24, y: -600 },
        },
        props: {
          points: 1,
          maxPoints: 1,
          columns: 5,
        },
        bindings: {
          points: "$player.prayer",
          maxPoints: "$player.maxPrayer",
        },
        label: "Prayer",
        visible: false,
      },
      {
        instanceId: "spells-main",
        widgetId: "hyperforge.panel.spells",
        position: {
          kind: "anchored",
          anchor: "bottom-right",
          offset: { x: -24, y: -900 },
        },
        props: {
          magicLevel: 1,
          spellbook: "standard",
          columns: 5,
        },
        label: "Spells",
        visible: false,
      },
      {
        instanceId: "quests-main",
        widgetId: "hyperforge.panel.quests",
        position: {
          kind: "anchored",
          anchor: "center",
          offset: { x: -200, y: 0 },
        },
        props: {
          questPoints: 0,
          maxQuestPoints: 0,
        },
        label: "Quests",
        visible: false,
      },
      {
        instanceId: "bank-main",
        widgetId: "hyperforge.panel.bank",
        position: {
          kind: "anchored",
          anchor: "center",
          offset: { x: 0, y: 0 },
        },
        props: {
          columns: 8,
          showSearch: true,
          showCoins: true,
          coins: 0,
        },
        bindings: {
          coins: "$inventory.coins",
        },
        label: "Bank",
        visible: false,
      },
      {
        instanceId: "friends-main",
        widgetId: "hyperforge.panel.friends",
        position: {
          kind: "anchored",
          anchor: "top-right",
          offset: { x: -24, y: 260 },
        },
        props: {
          showAddInput: true,
        },
        label: "Friends",
        visible: false,
      },
      {
        instanceId: "settings-main",
        widgetId: "hyperforge.panel.settings",
        position: {
          kind: "anchored",
          anchor: "center",
          offset: { x: 200, y: 0 },
        },
        props: {
          showAudio: true,
          showGraphics: true,
          showKeybindings: true,
        },
        label: "Settings",
        visible: false,
      },
    ],
  });
