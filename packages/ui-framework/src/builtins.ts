/**
 * Built-in widget schemas shipped by Hyperforge.
 *
 * These are schema-only — each widget declares its manifest + Zod
 * props schema + default props. The React (or other) renderer is
 * bound separately in the consumer package (see
 * `WidgetRegistry.bindComponent`). That separation lets server-side
 * layout validators and codemods understand the full widget catalog
 * without a React dependency.
 *
 * The six builtins here mirror Phase D2 of the World Studio AAA
 * completion plan: HP bar, minimap, inventory, chat, tooltip, and
 * action bar. More builtins land incrementally as we migrate
 * existing Hyperscape UI (Phase D6).
 */

import { z } from "zod";
import { defineWidget, type Widget } from "./widget";

// ----------------------------------------------------------------------
// HP Bar
// ----------------------------------------------------------------------

const hpBarPropsSchema = z.object({
  orientation: z.enum(["horizontal", "vertical"]),
  showNumeric: z.boolean(),
  /** HP value to display; bound at runtime via data expression. */
  current: z.number().min(0),
  /** Max HP; bound at runtime. */
  max: z.number().positive(),
});

export const hpBarWidget: Widget<z.infer<typeof hpBarPropsSchema>> =
  defineWidget({
    manifest: {
      id: "hyperforge.hud.hp-bar",
      name: "HP Bar",
      description: "Player health bar with optional numeric readout.",
      category: "hud",
      icon: "Heart",
      defaultSize: { width: 6, height: 1 },
    },
    propsSchema: hpBarPropsSchema,
    defaultProps: {
      orientation: "horizontal",
      showNumeric: true,
      current: 10,
      max: 10,
    },
  });

// ----------------------------------------------------------------------
// Minimap
// ----------------------------------------------------------------------

const minimapPropsSchema = z.object({
  /** Square edge length in viewport px. */
  size: z.number().positive(),
  /** World units visible at minimap zoom = 1. */
  baseRadius: z.number().positive(),
  showCompass: z.boolean(),
  showPlayerPips: z.boolean(),
  showEntityPips: z.boolean(),
});

export const minimapWidget: Widget<z.infer<typeof minimapPropsSchema>> =
  defineWidget({
    manifest: {
      id: "hyperforge.hud.minimap",
      name: "Minimap",
      description:
        "Radial minimap with compass, stamina, teleport orb, and entity pips.",
      category: "hud",
      icon: "Map",
      defaultSize: { width: 5, height: 5 },
    },
    propsSchema: minimapPropsSchema,
    defaultProps: {
      size: 220,
      baseRadius: 48,
      showCompass: true,
      showPlayerPips: true,
      showEntityPips: true,
    },
  });

// ----------------------------------------------------------------------
// Inventory
// ----------------------------------------------------------------------

/**
 * Live slot payload projected by the host (`$inventory.items` in the
 * default client data context). Left optional so structural placement
 * in the editor preview continues to work with no live data.
 */
const inventorySlotSchema = z.object({
  /** Zero-based slot index the item occupies. */
  slot: z.number().int().nonnegative(),
  /** Item id from the server/shared item manifest. */
  itemId: z.string().min(1),
  /** Stack size. `1` for non-stackable items. */
  quantity: z.number().int().positive(),
});

const inventoryPropsSchema = z.object({
  /** Grid columns. */
  columns: z.number().int().positive(),
  /** Grid rows. */
  rows: z.number().int().positive(),
  /** Show stack quantity badges on stackable items. */
  showQuantities: z.boolean(),
  /** Allow drag-and-drop to the action bar. */
  allowDragToActionBar: z.boolean(),
  /**
   * Optional live slot payload. When omitted, the widget renders an
   * empty grid — suitable for the editor preview and pre-spawn HUD.
   */
  items: z.array(inventorySlotSchema).optional(),
});

export const inventoryWidget: Widget<z.infer<typeof inventoryPropsSchema>> =
  defineWidget({
    manifest: {
      id: "hyperforge.panel.inventory",
      name: "Inventory",
      description: "Grid-based player inventory panel.",
      category: "panel",
      icon: "Backpack",
      defaultSize: { width: 8, height: 10 },
    },
    propsSchema: inventoryPropsSchema,
    defaultProps: {
      columns: 4,
      rows: 7,
      showQuantities: true,
      allowDragToActionBar: true,
    },
  });

// ----------------------------------------------------------------------
// Chat
// ----------------------------------------------------------------------

const chatPropsSchema = z.object({
  /** Max messages retained in scroll buffer. */
  bufferSize: z.number().int().positive(),
  /** Show channel tabs (public/party/trade/etc.). */
  showChannels: z.boolean(),
  /** Auto-hide when idle; show on keypress or new message. */
  autoHide: z.boolean(),
  /** Seconds of idle before auto-hide; only meaningful if autoHide. */
  autoHideDelaySeconds: z.number().nonnegative(),
});

export const chatWidget: Widget<z.infer<typeof chatPropsSchema>> = defineWidget(
  {
    manifest: {
      id: "hyperforge.panel.chat",
      name: "Chat",
      description: "Multi-channel chat panel with scrollback buffer.",
      category: "panel",
      icon: "MessageSquare",
      defaultSize: { width: 12, height: 6 },
    },
    propsSchema: chatPropsSchema,
    defaultProps: {
      bufferSize: 200,
      showChannels: true,
      autoHide: false,
      autoHideDelaySeconds: 10,
    },
  },
);

// ----------------------------------------------------------------------
// Tooltip
// ----------------------------------------------------------------------

const tooltipPropsSchema = z.object({
  /** Follow the cursor or anchor to the hovered element. */
  anchor: z.enum(["cursor", "element"]),
  /** ms before tooltip appears. */
  delayMs: z.number().int().nonnegative(),
  /** Max content width in px. */
  maxWidth: z.number().positive(),
});

export const tooltipWidget: Widget<z.infer<typeof tooltipPropsSchema>> =
  defineWidget({
    manifest: {
      id: "hyperforge.overlay.tooltip",
      name: "Tooltip",
      description: "Hover tooltip for items, skills, and entities.",
      category: "overlay",
      icon: "Info",
      defaultSize: { width: 4, height: 2 },
    },
    propsSchema: tooltipPropsSchema,
    defaultProps: { anchor: "cursor", delayMs: 300, maxWidth: 320 },
  });

// ----------------------------------------------------------------------
// Action Bar
// ----------------------------------------------------------------------

const actionBarPropsSchema = z.object({
  /** Number of action slots. */
  slotCount: z.number().int().positive(),
  /** Pixel size per slot. */
  slotSize: z.number().positive(),
  /** Show keybinding label on each slot. */
  showKeybindings: z.boolean(),
  /** Show global cooldown overlay. */
  showGcd: z.boolean(),
});

export const actionBarWidget: Widget<z.infer<typeof actionBarPropsSchema>> =
  defineWidget({
    manifest: {
      id: "hyperforge.hud.action-bar",
      name: "Action Bar",
      description:
        "Hotkey-driven action slots for abilities, items, and emotes.",
      category: "hud",
      icon: "Grid3x3",
      defaultSize: { width: 10, height: 2 },
    },
    propsSchema: actionBarPropsSchema,
    defaultProps: {
      slotCount: 10,
      slotSize: 48,
      showKeybindings: true,
      showGcd: true,
    },
  });

// ----------------------------------------------------------------------
// Skills
// ----------------------------------------------------------------------

/**
 * Live skill payload projected by the host (`$skills.items` in the
 * default client data context). One entry per displayed skill. The
 * widget always reserves a cell per `SKILL_DEFINITIONS` row — when a
 * slot is missing from the array, the cell renders with the static
 * fallback level so layout stays stable pre-first-stats event.
 */
const skillRowSchema = z.object({
  /** Skill key (e.g. `attack`, `woodcutting`). */
  key: z.string().min(1),
  /** Display label (e.g. `Attack`). */
  label: z.string().min(1),
  /** Emoji icon. */
  icon: z.string().min(1),
  /** Current level (1-99). */
  level: z.number().int().positive(),
  /** Total XP earned in this skill. */
  xp: z.number().int().nonnegative(),
});

const skillsPropsSchema = z.object({
  /** Grid columns. the tile-based MMORPG genre uses 3 for desktop, 2 for mobile. */
  columns: z.number().int().positive(),
  /** Show the Total-level / Combat-level header strip. */
  showHeader: z.boolean(),
  /** Total player level; sum of all skills. Bound via `$skills.total`. */
  total: z.number().int().nonnegative(),
  /** Combat level derived from combat skills. Bound via `$skills.combatLevel`. */
  combatLevel: z.number().int().nonnegative(),
  /**
   * Optional live skill rows. When omitted, the widget renders with a
   * static placeholder set — suitable for the editor preview.
   */
  items: z.array(skillRowSchema).optional(),
});

export const skillsWidget: Widget<z.infer<typeof skillsPropsSchema>> =
  defineWidget({
    manifest: {
      id: "hyperforge.panel.skills",
      name: "Skills",
      description:
        "Skill levels grid with combat/total header — matches tile-based MMORPG layout.",
      category: "panel",
      icon: "Sparkles",
      defaultSize: { width: 6, height: 8 },
    },
    propsSchema: skillsPropsSchema,
    defaultProps: {
      columns: 3,
      showHeader: true,
      total: 15,
      combatLevel: 3,
    },
  });

// ----------------------------------------------------------------------
// Equipment
// ----------------------------------------------------------------------

const equipmentSlotSchema = z.object({
  /** Slot name (`mainhand`, `body`, `head`, ...). */
  slot: z.string().min(1),
  /** Item id, or `null` for an empty slot. */
  itemId: z.string().nullable(),
  /** Optional human-readable item name for tooltip-less previews. */
  name: z.string().optional(),
});

const equipmentPropsSchema = z.object({
  /** Show the avatar silhouette between slot columns. */
  showAvatar: z.boolean(),
  /** Show the combat summary strip under the slots. */
  showCombatSummary: z.boolean(),
  /** Live slot rows keyed by slot name. */
  items: z.array(equipmentSlotSchema).optional(),
});

export const equipmentWidget: Widget<z.infer<typeof equipmentPropsSchema>> =
  defineWidget({
    manifest: {
      id: "hyperforge.panel.equipment",
      name: "Equipment",
      description: "Worn gear slots with avatar silhouette.",
      category: "panel",
      icon: "Shield",
      defaultSize: { width: 6, height: 8 },
    },
    propsSchema: equipmentPropsSchema,
    defaultProps: {
      showAvatar: true,
      showCombatSummary: true,
    },
  });

// ----------------------------------------------------------------------
// Stats
// ----------------------------------------------------------------------

const statsPropsSchema = z.object({
  /** Player-facing display name. */
  playerName: z.string(),
  /** Combat level. */
  combatLevel: z.number().int().nonnegative(),
  /** Current HP. */
  hp: z.number().nonnegative(),
  /** Max HP. */
  maxHp: z.number().positive(),
  /** Current prayer points. */
  prayer: z.number().nonnegative(),
  /** Max prayer points. */
  maxPrayer: z.number().positive(),
  /** Total level (sum of all skill levels). */
  totalLevel: z.number().int().nonnegative(),
});

export const statsWidget: Widget<z.infer<typeof statsPropsSchema>> =
  defineWidget({
    manifest: {
      id: "hyperforge.panel.stats",
      name: "Stats",
      description: "Player summary: combat level, HP, prayer, totals.",
      category: "panel",
      icon: "User",
      defaultSize: { width: 6, height: 4 },
    },
    propsSchema: statsPropsSchema,
    defaultProps: {
      playerName: "Player",
      combatLevel: 3,
      hp: 10,
      maxHp: 10,
      prayer: 1,
      maxPrayer: 1,
      totalLevel: 15,
    },
  });

// ----------------------------------------------------------------------
// Prayer
// ----------------------------------------------------------------------

const prayerRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string(),
  levelRequired: z.number().int().positive(),
  drainRate: z.number().nonnegative(),
  active: z.boolean(),
  unlocked: z.boolean(),
});

const prayerPropsSchema = z.object({
  /** Remaining prayer points. */
  points: z.number().nonnegative(),
  /** Max prayer points. */
  maxPoints: z.number().positive(),
  /** Grid columns. the tile-based MMORPG genre uses 5 desktop, 3 mobile. */
  columns: z.number().int().positive(),
  /** Prayer rows. */
  items: z.array(prayerRowSchema).optional(),
});

export const prayerWidget: Widget<z.infer<typeof prayerPropsSchema>> =
  defineWidget({
    manifest: {
      id: "hyperforge.panel.prayer",
      name: "Prayer",
      description: "Active/inactive prayer grid with drain meter.",
      category: "panel",
      icon: "HeartHandshake",
      defaultSize: { width: 6, height: 8 },
    },
    propsSchema: prayerPropsSchema,
    defaultProps: {
      points: 1,
      maxPoints: 1,
      columns: 5,
    },
  });

// ----------------------------------------------------------------------
// Spells
// ----------------------------------------------------------------------

const spellRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string(),
  levelRequired: z.number().int().positive(),
  castable: z.boolean(),
});

const spellsPropsSchema = z.object({
  /** Current magic level. */
  magicLevel: z.number().int().nonnegative(),
  /** Spellbook name (standard/ancient/lunar). */
  spellbook: z.string(),
  /** Grid columns. */
  columns: z.number().int().positive(),
  /** Spell rows. */
  items: z.array(spellRowSchema).optional(),
});

export const spellsWidget: Widget<z.infer<typeof spellsPropsSchema>> =
  defineWidget({
    manifest: {
      id: "hyperforge.panel.spells",
      name: "Spells",
      description: "Spellbook grid filterable by level.",
      category: "panel",
      icon: "Sparkle",
      defaultSize: { width: 6, height: 8 },
    },
    propsSchema: spellsPropsSchema,
    defaultProps: {
      magicLevel: 1,
      spellbook: "standard",
      columns: 5,
    },
  });

// ----------------------------------------------------------------------
// Quests
// ----------------------------------------------------------------------

const questRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["not-started", "in-progress", "complete"]),
  difficulty: z.string().optional(),
  questPoints: z.number().int().nonnegative().optional(),
});

const questsPropsSchema = z.object({
  /** Total quest points earned. */
  questPoints: z.number().int().nonnegative(),
  /** Maximum quest points available. */
  maxQuestPoints: z.number().int().nonnegative(),
  /** Quest rows. */
  items: z.array(questRowSchema).optional(),
});

export const questsWidget: Widget<z.infer<typeof questsPropsSchema>> =
  defineWidget({
    manifest: {
      id: "hyperforge.panel.quests",
      name: "Quests",
      description: "Quest journal with progress status.",
      category: "panel",
      icon: "ScrollText",
      defaultSize: { width: 6, height: 8 },
    },
    propsSchema: questsPropsSchema,
    defaultProps: {
      questPoints: 0,
      maxQuestPoints: 0,
    },
  });

// ----------------------------------------------------------------------
// Bank
// ----------------------------------------------------------------------

const bankSlotSchema = z.object({
  slot: z.number().int().nonnegative(),
  itemId: z.string().min(1),
  quantity: z.number().int().positive(),
});

const bankPropsSchema = z.object({
  /** Grid columns. tile-based MMORPG default is 8. */
  columns: z.number().int().positive(),
  /** Show the search field above the grid. */
  showSearch: z.boolean(),
  /** Show the coin-count strip at the top. */
  showCoins: z.boolean(),
  /** Coin count. */
  coins: z.number().int().nonnegative(),
  /** Bank slot rows. */
  items: z.array(bankSlotSchema).optional(),
});

export const bankWidget: Widget<z.infer<typeof bankPropsSchema>> = defineWidget(
  {
    manifest: {
      id: "hyperforge.panel.bank",
      name: "Bank",
      description: "Bank grid with search + coin count.",
      category: "panel",
      icon: "Landmark",
      defaultSize: { width: 12, height: 10 },
    },
    propsSchema: bankPropsSchema,
    defaultProps: {
      columns: 8,
      showSearch: true,
      showCoins: true,
      coins: 0,
    },
  },
);

// ----------------------------------------------------------------------
// Friends
// ----------------------------------------------------------------------

const friendRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  online: z.boolean(),
  world: z.number().int().optional(),
});

const friendsPropsSchema = z.object({
  /** Show the add-friend input. */
  showAddInput: z.boolean(),
  /** Friend rows. */
  items: z.array(friendRowSchema).optional(),
});

export const friendsWidget: Widget<z.infer<typeof friendsPropsSchema>> =
  defineWidget({
    manifest: {
      id: "hyperforge.panel.friends",
      name: "Friends",
      description: "Online/offline friend list.",
      category: "panel",
      icon: "Users",
      defaultSize: { width: 6, height: 8 },
    },
    propsSchema: friendsPropsSchema,
    defaultProps: {
      showAddInput: true,
    },
  });

// ----------------------------------------------------------------------
// Settings
// ----------------------------------------------------------------------

const settingsPropsSchema = z.object({
  /** Show the volume sliders section. */
  showAudio: z.boolean(),
  /** Show graphics-quality toggles. */
  showGraphics: z.boolean(),
  /** Show the keybindings editor entry. */
  showKeybindings: z.boolean(),
});

export const settingsWidget: Widget<z.infer<typeof settingsPropsSchema>> =
  defineWidget({
    manifest: {
      id: "hyperforge.panel.settings",
      name: "Settings",
      description: "Audio, graphics, and keybinding controls.",
      category: "panel",
      icon: "Settings",
      defaultSize: { width: 6, height: 8 },
    },
    propsSchema: settingsPropsSchema,
    defaultProps: {
      showAudio: true,
      showGraphics: true,
      showKeybindings: true,
    },
  });

// ----------------------------------------------------------------------
// Catalog — stable order is important: the editor palette displays
// builtins in this order and tests assert against .length.
// ----------------------------------------------------------------------

export const BUILTIN_WIDGETS: ReadonlyArray<Widget<Record<string, unknown>>> = [
  hpBarWidget,
  minimapWidget,
  inventoryWidget,
  chatWidget,
  tooltipWidget,
  actionBarWidget,
  skillsWidget,
  equipmentWidget,
  statsWidget,
  prayerWidget,
  spellsWidget,
  questsWidget,
  bankWidget,
  friendsWidget,
  settingsWidget,
];
