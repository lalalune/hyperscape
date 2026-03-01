/**
 * VFX Catalog — standalone effect metadata for the Asset Forge VFX browser.
 *
 * Data is duplicated here as plain objects so the Asset Forge never imports
 * from packages/shared (which would pull in the full game engine).
 *
 * Source-of-truth files:
 *   - packages/shared/src/data/spell-visuals.ts
 *   - packages/shared/src/entities/managers/particleManager/GlowParticleManager.ts
 *   - packages/shared/src/entities/managers/particleManager/WaterParticleManager.ts
 *   - packages/shared/src/systems/client/ClientTeleportEffectsSystem.ts
 *   - packages/shared/src/systems/client/DamageSplatSystem.ts
 *   - packages/shared/src/systems/client/XPDropSystem.ts
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type PreviewType = "spell" | "arrow" | "glow" | "water" | "static";

export type EffectCategory =
  | "spells"
  | "arrows"
  | "glow"
  | "fishing"
  | "teleport"
  | "combatHud";

export interface ColorEntry {
  label: string;
  hex: string; // e.g. "#ff4500"
}

export interface ParamEntry {
  label: string;
  value: string | number;
}

// ---------------------------------------------------------------------------
// Spell projectiles
// ---------------------------------------------------------------------------

export interface SpellEffect {
  id: string;
  name: string;
  category: "spells";
  previewType: "spell";
  tier: "strike" | "bolt";
  color: number;
  coreColor: number;
  size: number;
  glowIntensity: number;
  trailLength: number;
  trailFade: number;
  pulseSpeed: number;
  pulseAmount: number;
  colors: ColorEntry[];
  params: ParamEntry[];
}

const STRIKE_BASE = {
  tier: "strike" as const,
  size: 0.35,
  glowIntensity: 0.45,
  trailLength: 3,
  trailFade: 0.5,
  pulseSpeed: 0,
  pulseAmount: 0,
};

const BOLT_BASE = {
  tier: "bolt" as const,
  size: 0.7,
  glowIntensity: 0.8,
  trailLength: 5,
  trailFade: 0.4,
  pulseSpeed: 5,
  pulseAmount: 0.2,
};

function makeSpell(
  id: string,
  name: string,
  color: number,
  coreColor: number,
  glow: number,
  base: typeof STRIKE_BASE | typeof BOLT_BASE,
): SpellEffect {
  return {
    id,
    name,
    category: "spells",
    previewType: "spell",
    ...base,
    color,
    coreColor,
    glowIntensity: glow,
    colors: [
      { label: "Outer", hex: `#${color.toString(16).padStart(6, "0")}` },
      { label: "Core", hex: `#${coreColor.toString(16).padStart(6, "0")}` },
    ],
    params: [
      { label: "Size", value: base.size },
      { label: "Glow Intensity", value: glow },
      { label: "Trail Length", value: base.trailLength },
      { label: "Trail Fade", value: base.trailFade },
      { label: "Pulse Speed", value: base.pulseSpeed },
      { label: "Pulse Amount", value: base.pulseAmount },
    ],
  };
}

export const SPELL_EFFECTS: SpellEffect[] = [
  // Strikes
  makeSpell("wind_strike", "Wind Strike", 0xcccccc, 0xffffff, 0.4, STRIKE_BASE),
  makeSpell(
    "water_strike",
    "Water Strike",
    0x3b82f6,
    0x93c5fd,
    0.5,
    STRIKE_BASE,
  ),
  makeSpell(
    "earth_strike",
    "Earth Strike",
    0x8b4513,
    0xd2691e,
    0.4,
    STRIKE_BASE,
  ),
  makeSpell(
    "fire_strike",
    "Fire Strike",
    0xff4500,
    0xffff00,
    0.55,
    STRIKE_BASE,
  ),
  // Bolts
  makeSpell("wind_bolt", "Wind Bolt", 0xcccccc, 0xffffff, 0.7, BOLT_BASE),
  makeSpell("water_bolt", "Water Bolt", 0x3b82f6, 0x93c5fd, 0.8, BOLT_BASE),
  makeSpell("earth_bolt", "Earth Bolt", 0x8b4513, 0xd2691e, 0.7, BOLT_BASE),
  makeSpell("fire_bolt", "Fire Bolt", 0xff4500, 0xffff00, 0.9, BOLT_BASE),
];

// ---------------------------------------------------------------------------
// Arrow projectiles
// ---------------------------------------------------------------------------

export interface ArrowEffect {
  id: string;
  name: string;
  category: "arrows";
  previewType: "arrow";
  shaftColor: number;
  headColor: number;
  fletchingColor: number;
  length: number;
  width: number;
  colors: ColorEntry[];
  params: ParamEntry[];
}

function makeArrow(
  id: string,
  name: string,
  headColor: number,
  fletchingColor: number,
): ArrowEffect {
  const shaft = 0x8b4513;
  return {
    id,
    name,
    category: "arrows",
    previewType: "arrow",
    shaftColor: shaft,
    headColor,
    fletchingColor,
    length: 0.5,
    width: 0.08,
    colors: [
      { label: "Shaft", hex: "#8b4513" },
      { label: "Head", hex: `#${headColor.toString(16).padStart(6, "0")}` },
      {
        label: "Fletching",
        hex: `#${fletchingColor.toString(16).padStart(6, "0")}`,
      },
    ],
    params: [
      { label: "Length", value: 0.5 },
      { label: "Width", value: 0.08 },
      { label: "Arc Height", value: 0 },
      { label: "Rotate to Direction", value: "yes" },
    ],
  };
}

export const ARROW_EFFECTS: ArrowEffect[] = [
  makeArrow("default_arrow", "Default Arrow", 0xa0a0a0, 0xffffff),
  makeArrow("bronze_arrow", "Bronze Arrow", 0xcd7f32, 0xffffff),
  makeArrow("iron_arrow", "Iron Arrow", 0x71797e, 0xffffff),
  makeArrow("steel_arrow", "Steel Arrow", 0xb0b0b0, 0xffffff),
  makeArrow("mithril_arrow", "Mithril Arrow", 0x4169e1, 0xe0e0ff),
  makeArrow("adamant_arrow", "Adamant Arrow", 0x228b22, 0xe0ffe0),
];

// ---------------------------------------------------------------------------
// Glow particle presets
// ---------------------------------------------------------------------------

export interface GlowLayer {
  pool: string;
  count: number;
  lifetime: string;
  scale: string;
  sharpness: number;
  notes: string;
}

export interface GlowEffect {
  id: string;
  name: string;
  category: "glow";
  previewType: "glow";
  palette: ColorEntry[];
  layers: GlowLayer[];
  params: ParamEntry[];
}

export const GLOW_EFFECTS: GlowEffect[] = [
  {
    id: "altar_glow",
    name: "Altar",
    category: "glow",
    previewType: "glow",
    palette: [
      { label: "Core", hex: "#c4b5fd" },
      { label: "Mid", hex: "#8b5cf6" },
      { label: "Outer", hex: "#60a5fa" },
    ],
    layers: [
      {
        pool: "pillar",
        count: 2,
        lifetime: "4-6s",
        scale: "0.7-1.0 × radius",
        sharpness: 1.5,
        notes: "Gentle bob & sway above mesh",
      },
      {
        pool: "wisp",
        count: 10,
        lifetime: "3-6s",
        scale: "0.25-0.45",
        sharpness: 3.0,
        notes: "Helical orbit outside mesh",
      },
      {
        pool: "spark",
        count: 14,
        lifetime: "1.2-2.7s",
        scale: "0.05-0.11",
        sharpness: 4.0,
        notes: "Rising from mesh surface",
      },
      {
        pool: "base",
        count: 4,
        lifetime: "5-8s",
        scale: "0.5-0.8 × radius",
        sharpness: 1.5,
        notes: "Slow orbit at footprint",
      },
    ],
    params: [
      { label: "Total Particles", value: 30 },
      { label: "Layers", value: 4 },
      { label: "Blend Mode", value: "Additive" },
    ],
  },
  {
    id: "fire_glow",
    name: "Fire",
    category: "glow",
    previewType: "glow",
    palette: [
      { label: "Core", hex: "#ff4400" },
      { label: "Mid-1", hex: "#ff6600" },
      { label: "Mid-2", hex: "#ff8800" },
      { label: "Outer-1", hex: "#ffaa00" },
      { label: "Outer-2", hex: "#ffcc00" },
    ],
    layers: [
      {
        pool: "riseSpread",
        count: 18,
        lifetime: "0.5-1.2s",
        scale: "0.18-0.40",
        sharpness: 2.0,
        notes: "Rising with spread, scaleY × 1.3",
      },
    ],
    params: [
      { label: "Total Particles", value: 18 },
      { label: "Speed", value: "0.6-1.4 u/s" },
      { label: "Spawn Y", value: 0.1 },
      { label: "Spread Radius", value: "±0.125" },
      { label: "Scale Y Mult", value: 1.3 },
      { label: "Blend Mode", value: "Additive" },
    ],
  },
  {
    id: "torch_glow",
    name: "Torch",
    category: "glow",
    previewType: "glow",
    palette: [
      { label: "Core", hex: "#ff4400" },
      { label: "Mid-1", hex: "#ff6600" },
      { label: "Mid-2", hex: "#ff8800" },
      { label: "Outer-1", hex: "#ffaa00" },
      { label: "Outer-2", hex: "#ffcc00" },
    ],
    layers: [
      {
        pool: "riseSpread",
        count: 6,
        lifetime: "0.4-0.9s",
        scale: "0.10-0.22",
        sharpness: 2.0,
        notes: "Tighter spread, faster speed",
      },
    ],
    params: [
      { label: "Total Particles", value: 6 },
      { label: "Speed", value: "0.8-1.7 u/s" },
      { label: "Spawn Y", value: 0.15 },
      { label: "Spread Radius", value: "±0.04" },
      { label: "Scale Y Mult", value: 1.3 },
      { label: "Blend Mode", value: "Additive" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Fishing spot (water particle) effects
// ---------------------------------------------------------------------------

export interface FishingEffect {
  id: string;
  name: string;
  category: "fishing";
  previewType: "water";
  baseColor: number;
  splashColor: number;
  bubbleColor: number;
  shimmerColor: number;
  colors: ColorEntry[];
  params: ParamEntry[];
}

function makeFishing(
  id: string,
  name: string,
  base: number,
  splash: number,
  bubble: number,
  shimmer: number,
  rippleSpeed: number,
  splashCount: number,
  bubbleCount: number,
  shimmerCount: number,
  burstMin: number,
  burstMax: number,
  burstSplash: number,
): FishingEffect {
  const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
  return {
    id,
    name,
    category: "fishing",
    previewType: "water",
    baseColor: base,
    splashColor: splash,
    bubbleColor: bubble,
    shimmerColor: shimmer,
    colors: [
      { label: "Base", hex: hex(base) },
      { label: "Splash", hex: hex(splash) },
      { label: "Bubble", hex: hex(bubble) },
      { label: "Shimmer", hex: hex(shimmer) },
    ],
    params: [
      { label: "Ripple Speed", value: rippleSpeed },
      { label: "Splash Count", value: splashCount },
      { label: "Bubble Count", value: bubbleCount },
      { label: "Shimmer Count", value: shimmerCount },
      { label: "Burst Interval", value: `${burstMin}-${burstMax}s` },
      { label: "Burst Splashes", value: burstSplash },
    ],
  };
}

export const FISHING_EFFECTS: FishingEffect[] = [
  makeFishing(
    "net_fishing",
    "Net Fishing",
    0x88ccff,
    0xddeeff,
    0x99ccee,
    0xeef4ff,
    0.8,
    4,
    3,
    3,
    5,
    10,
    2,
  ),
  makeFishing(
    "fly_fishing",
    "Fly Fishing",
    0xaaddff,
    0xeef5ff,
    0xaaddee,
    0xf5faff,
    1.5,
    8,
    5,
    5,
    2,
    5,
    4,
  ),
  makeFishing(
    "default_fishing",
    "Default Fishing",
    0x66bbff,
    0xddeeff,
    0x88ccee,
    0xeef4ff,
    1.0,
    5,
    4,
    4,
    3,
    7,
    3,
  ),
];

// ---------------------------------------------------------------------------
// Teleport effect
// ---------------------------------------------------------------------------

export interface TeleportPhase {
  name: string;
  start: number;
  end: number;
  color: string;
}

export interface TeleportComponent {
  name: string;
  color: string;
  description: string;
}

export interface TeleportEffect {
  id: string;
  name: string;
  category: "teleport";
  previewType: "static";
  duration: number;
  colors: ColorEntry[];
  phases: TeleportPhase[];
  components: TeleportComponent[];
  params: ParamEntry[];
}

export const TELEPORT_EFFECT: TeleportEffect = {
  id: "teleport",
  name: "Teleport",
  category: "teleport",
  previewType: "static",
  duration: 2.5,
  colors: [
    { label: "Cyan", hex: "#66ccff" },
    { label: "White-Cyan", hex: "#ccffff" },
    { label: "White", hex: "#ffffff" },
    { label: "Gold", hex: "#ffdd66" },
  ],
  phases: [
    { name: "Gather", start: 0, end: 0.2, color: "#66ccff" },
    { name: "Erupt", start: 0.2, end: 0.34, color: "#ffffff" },
    { name: "Sustain", start: 0.34, end: 0.68, color: "#ccffff" },
    { name: "Fade", start: 0.68, end: 1.0, color: "#4488cc" },
  ],
  components: [
    {
      name: "Ground Rune Circle",
      color: "#66ccff",
      description: "Scale 0.5→2.0, rotates at 2.0 rad/s",
    },
    {
      name: "Base Glow Disc",
      color: "#ccffff",
      description: "Scale 1.5 + pulse, opacity 0.8",
    },
    {
      name: "Inner Beam",
      color: "#ffffff",
      description: "White→cyan gradient, Hermite elastic height",
    },
    {
      name: "Outer Beam",
      color: "#aaddff",
      description: "Light cyan→dark blue, delayed 0.03s",
    },
    {
      name: "Core Flash",
      color: "#ffffff",
      description: "Pop 0→2.5 scale at t=0.20-0.22s",
    },
    {
      name: "Shockwave Ring 1",
      color: "#ccffff",
      description: "Scale 1→13 easeOutExpo, 0.2s",
    },
    {
      name: "Shockwave Ring 2",
      color: "#66ccff",
      description: "Scale 1→11, delayed 0.024s",
    },
    {
      name: "Point Light",
      color: "#66ccff",
      description: "Peak intensity 5.0 at eruption, radius 8",
    },
    {
      name: "Helix Particles (12)",
      color: "#66ccff",
      description: "2 strands × 6, spiral radius 0.8→0.1",
    },
    {
      name: "Burst Particles (8)",
      color: "#ffdd66",
      description: "3 white + 3 cyan + 2 gold, gravity 6.0",
    },
  ],
  params: [
    { label: "Duration", value: "2.5s" },
    { label: "Pool Size", value: 2 },
    { label: "Helix Particles", value: 12 },
    { label: "Burst Particles", value: 8 },
    { label: "Light Radius", value: 8 },
    { label: "Peak Light Intensity", value: 5.0 },
  ],
};

// ---------------------------------------------------------------------------
// Combat HUD effects (damage splats & XP drops)
// ---------------------------------------------------------------------------

export interface CombatHudEffect {
  id: string;
  name: string;
  category: "combatHud";
  previewType: "static";
  colors: ColorEntry[];
  params: ParamEntry[];
  variants?: { label: string; colors: ColorEntry[] }[];
}

export const COMBAT_HUD_EFFECTS: CombatHudEffect[] = [
  {
    id: "damage_splats",
    name: "Damage Splats",
    category: "combatHud",
    previewType: "static",
    colors: [
      { label: "Hit BG", hex: "#8b0000" },
      { label: "Miss BG", hex: "#000080" },
      { label: "Text", hex: "#ffffff" },
      { label: "Border", hex: "#000000" },
    ],
    params: [
      { label: "Pool Size", value: 50 },
      { label: "Duration", value: "1.5s" },
      { label: "Rise Distance", value: "1.5 units" },
      { label: "Sprite Size", value: "0.6 units" },
      { label: "Canvas Size", value: "256px" },
      { label: "Font", value: "Bold 80px Arial" },
      { label: "Border Radius", value: "15px" },
    ],
    variants: [
      {
        label: "Hit (damage > 0)",
        colors: [
          { label: "Background", hex: "#8b0000" },
          { label: "Text", hex: "#ffffff" },
        ],
      },
      {
        label: "Miss (damage = 0)",
        colors: [
          { label: "Background", hex: "#000080" },
          { label: "Text", hex: "#ffffff" },
        ],
      },
    ],
  },
  {
    id: "xp_drops",
    name: "XP Drops",
    category: "combatHud",
    previewType: "static",
    colors: [
      { label: "Text", hex: "#f2d08a" },
      { label: "Border", hex: "#c9a54a" },
      { label: "Background", hex: "rgba(0,0,0,0.6)" },
    ],
    params: [
      { label: "Duration", value: "2.0s" },
      { label: "Rise Distance", value: "2.5 units" },
      { label: "Sprite Size", value: "0.5 units" },
      { label: "Canvas Size", value: "256px" },
      { label: "Font", value: "Bold 48px Arial" },
      { label: "Border Radius", value: "12px" },
      { label: "Easing", value: "Cubic ease-out" },
      { label: "Fade Start", value: "70% progress" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Unified catalog
// ---------------------------------------------------------------------------

export type VFXEffect =
  | SpellEffect
  | ArrowEffect
  | GlowEffect
  | FishingEffect
  | TeleportEffect
  | CombatHudEffect;

export interface EffectCategoryInfo {
  id: EffectCategory;
  label: string;
  effects: VFXEffect[];
}

export const VFX_CATEGORIES: EffectCategoryInfo[] = [
  { id: "spells", label: "Magic Spells", effects: SPELL_EFFECTS },
  { id: "arrows", label: "Arrow Projectiles", effects: ARROW_EFFECTS },
  { id: "glow", label: "Glow Particles", effects: GLOW_EFFECTS },
  { id: "fishing", label: "Fishing Spots", effects: FISHING_EFFECTS },
  { id: "teleport", label: "Teleport", effects: [TELEPORT_EFFECT] },
  { id: "combatHud", label: "Combat HUD", effects: COMBAT_HUD_EFFECTS },
];
