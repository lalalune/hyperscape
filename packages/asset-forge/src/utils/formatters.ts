/**
 * formatters — small display helpers shared across panels and pages.
 *
 * Keep these dumb: no i18n, no timezone juggling, no rounding policy
 * decisions beyond what each helper documents. The point is a single
 * canonical version of each shape so labels don't drift between panels.
 */

/**
 * Clock time, 24-hour. `HH:MM:SS` by default; pass `withMs` for
 * `HH:MM:SS.mmm` (used by the PIE console where event ordering at
 * millisecond resolution matters).
 */
export function formatClockTime(ts: number, withMs = false): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const base = `${hh}:${mm}:${ss}`;
  if (!withMs) return base;
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${base}.${ms}`;
}

/**
 * Compact "time ago" suitable for hover-fresh log entries. Caps at
 * hours — anything older shows raw hour count, no day rollover.
 *
 *   < 5s    → "just now"
 *   < 60s   → "12s ago"
 *   < 60m   → "5m ago"
 *   else    → "3h ago"
 *
 * Accepts a millisecond timestamp.
 */
export function formatShortRelative(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/**
 * Relative time with day rollover + locale-date fallback past a week.
 * Used by the audit log and history panels — entries older than a
 * week are better shown as their absolute date.
 *
 *   < 60s          → "just now"
 *   < 60m          → "5m ago"
 *   < 24h          → "3h ago"
 *   < 7d           → "2d ago"
 *   else           → locale date string
 *
 * Accepts an ISO string.
 */
export function formatRelativeWithDateFallback(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Full date+time from an ISO string. Uses the browser locale; not
 * for log timestamps (use `formatClockTime`) — for things like file
 * created-at columns where day + time both matter.
 */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

/**
 * Human-readable byte size. One decimal place above KB.
 *   512    → "512 B"
 *   2048   → "2.0 KB"
 *   5e6    → "4.8 MB"
 *
 * Stops at MB — we don't ship GB-scale assets in the browser today.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
