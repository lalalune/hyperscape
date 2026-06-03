/**
 * Color utility functions for the Hyperia UI
 */

/**
 * Converts a color with an opacity value to a valid CSS rgba() string.
 * Handles hex (#RGB, #RRGGBB), rgb(), rgba(), and hsl() formats.
 * Falls back to CSS color-mix for unsupported formats.
 *
 * @param color - The base color in any CSS format
 * @param alpha - The opacity value (0-1)
 * @returns A CSS color string with the specified opacity
 */
export function resolveColorWithOpacity(color: string, alpha: number): string {
  // Clamp alpha to 0-1
  const clampedAlpha = Math.max(0, Math.min(1, alpha));

  // Handle hex colors (#RGB, #RRGGBB, or #RRGGBBAA)
  if (color.startsWith("#")) {
    let hex = color.slice(1);
    // Expand shorthand (#RGB -> #RRGGBB)
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
    }
    // Handle 8-digit hex (#RRGGBBAA) - alpha from hex is multiplied with clampedAlpha
    if (hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const hexAlpha = parseInt(hex.slice(6, 8), 16) / 255;
      const finalAlpha = hexAlpha * clampedAlpha;
      return `rgba(${r}, ${g}, ${b}, ${finalAlpha})`;
    }
  }

  // Handle rgb() - convert to rgba()
  const rgbMatch = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${clampedAlpha})`;
  }

  // Handle rgba() - replace alpha value
  const rgbaMatch = color.match(
    /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)$/i,
  );
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${clampedAlpha})`;
  }

  // Handle hsl() - convert to hsla()
  const hslMatch = color.match(
    /^hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*\)$/i,
  );
  if (hslMatch) {
    return `hsla(${hslMatch[1]}, ${hslMatch[2]}%, ${hslMatch[3]}%, ${clampedAlpha})`;
  }

  // Fallback: use CSS color-mix for unsupported formats
  return `color-mix(in srgb, ${color} ${Math.round(clampedAlpha * 100)}%, transparent)`;
}
