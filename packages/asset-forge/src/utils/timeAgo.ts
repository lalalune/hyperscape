/**
 * timeAgo — humanize a past ISO timestamp into a compact relative string.
 *
 *   < 60s       → "just now"
 *   < 60 min    → "12m ago"
 *   < 24 hr     → "5h ago"
 *   < 30 days   → "3d ago"
 *   < 12 mo     → "4mo ago"
 *   otherwise   → "2y ago"
 *
 * Negative diffs (future timestamps) are clamped to "just now". This
 * is the single source of truth — pages must not roll their own.
 */
export function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(day / 365);
  return `${yr}y ago`;
}
