/**
 * hexToTailwindAccent — Maps a hex color to the nearest Tailwind color accent classes.
 *
 * Used by the dynamic Entity Palette to derive UI accent classes from
 * GameModule entity type colors.
 */

interface TailwindAccent {
  icon: string;
  bg: string;
  bgHover: string;
  border: string;
  count: string;
}

/** Predefined Tailwind accent palettes mapped to hue ranges. */
const ACCENT_PALETTES: Array<{
  hueMin: number;
  hueMax: number;
  accent: TailwindAccent;
}> = [
  {
    hueMin: 0,
    hueMax: 15,
    accent: {
      icon: "text-red-400",
      bg: "bg-red-500/5",
      bgHover: "hover:bg-red-500/10",
      border: "border-l-red-500/60",
      count: "bg-red-500/15 text-red-400",
    },
  },
  {
    hueMin: 15,
    hueMax: 45,
    accent: {
      icon: "text-orange-400",
      bg: "bg-orange-500/5",
      bgHover: "hover:bg-orange-500/10",
      border: "border-l-orange-500/60",
      count: "bg-orange-500/15 text-orange-400",
    },
  },
  {
    hueMin: 45,
    hueMax: 65,
    accent: {
      icon: "text-amber-400",
      bg: "bg-amber-500/5",
      bgHover: "hover:bg-amber-500/10",
      border: "border-l-amber-500/60",
      count: "bg-amber-500/15 text-amber-400",
    },
  },
  {
    hueMin: 65,
    hueMax: 150,
    accent: {
      icon: "text-green-400",
      bg: "bg-green-500/5",
      bgHover: "hover:bg-green-500/10",
      border: "border-l-green-500/60",
      count: "bg-green-500/15 text-green-400",
    },
  },
  {
    hueMin: 150,
    hueMax: 195,
    accent: {
      icon: "text-cyan-400",
      bg: "bg-cyan-500/5",
      bgHover: "hover:bg-cyan-500/10",
      border: "border-l-cyan-500/60",
      count: "bg-cyan-500/15 text-cyan-400",
    },
  },
  {
    hueMin: 195,
    hueMax: 250,
    accent: {
      icon: "text-blue-400",
      bg: "bg-blue-500/5",
      bgHover: "hover:bg-blue-500/10",
      border: "border-l-blue-500/60",
      count: "bg-blue-500/15 text-blue-400",
    },
  },
  {
    hueMin: 250,
    hueMax: 290,
    accent: {
      icon: "text-purple-400",
      bg: "bg-purple-500/5",
      bgHover: "hover:bg-purple-500/10",
      border: "border-l-purple-500/60",
      count: "bg-purple-500/15 text-purple-400",
    },
  },
  {
    hueMin: 290,
    hueMax: 330,
    accent: {
      icon: "text-pink-400",
      bg: "bg-pink-500/5",
      bgHover: "hover:bg-pink-500/10",
      border: "border-l-pink-500/60",
      count: "bg-pink-500/15 text-pink-400",
    },
  },
  {
    hueMin: 330,
    hueMax: 360,
    accent: {
      icon: "text-rose-400",
      bg: "bg-rose-500/5",
      bgHover: "hover:bg-rose-500/10",
      border: "border-l-rose-500/60",
      count: "bg-rose-500/15 text-rose-400",
    },
  },
];

const DEFAULT_ACCENT: TailwindAccent = {
  icon: "text-slate-400",
  bg: "bg-slate-500/5",
  bgHover: "hover:bg-slate-500/10",
  border: "border-l-slate-500/60",
  count: "bg-slate-500/15 text-slate-400",
};

/**
 * Convert a hex color string (e.g., "#E84A4A") to the nearest Tailwind accent palette.
 * Falls back to slate for invalid or gray colors.
 */
export function hexToTailwindAccent(hex: string): TailwindAccent {
  // Parse hex → RGB
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6 && cleaned.length !== 3) return DEFAULT_ACCENT;

  const fullHex =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;
  const r = parseInt(fullHex.slice(0, 2), 16) / 255;
  const g = parseInt(fullHex.slice(2, 4), 16) / 255;
  const b = parseInt(fullHex.slice(4, 6), 16) / 255;

  if (isNaN(r) || isNaN(g) || isNaN(b)) return DEFAULT_ACCENT;

  // RGB → HSL (only need hue)
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  // Gray / very low saturation
  if (delta < 0.08) return DEFAULT_ACCENT;

  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;

  // Find matching palette
  for (const palette of ACCENT_PALETTES) {
    if (hue >= palette.hueMin && hue < palette.hueMax) {
      return palette.accent;
    }
  }
  return DEFAULT_ACCENT;
}
