/**
 * AnchorPicker — 3×3 visual picker for the 9 LayoutAnchor values.
 *
 * Mirrors the UE5 UMG anchor preset widget: authors click a dot in
 * the grid (corners, edge midpoints, or center) to set where their
 * widget anchors to within the viewport. Selection is highlighted
 * with a filled dot; surrounding dots are outline-only.
 *
 * Keyboard:
 *   Arrow keys move focus between dots; Space/Enter commits.
 *
 * The component is controlled — it renders whatever anchor the
 * caller passes in and fires `onChange` with the new value. No
 * internal state, no effects.
 */

import type { LayoutAnchor } from "@hyperforge/ui-framework";

// Row-major layout of the 9 LayoutAnchor values in the 3×3 grid.
// Column order: left / center / right. Row order: top / middle /
// bottom. `center` is the sole value where both axes are "center".
const ANCHOR_GRID: LayoutAnchor[][] = [
  ["top-left", "top-center", "top-right"],
  ["middle-left", "center", "middle-right"],
  ["bottom-left", "bottom-center", "bottom-right"],
];

const ANCHOR_TOOLTIP: Record<LayoutAnchor, string> = {
  "top-left": "Top Left",
  "top-center": "Top Center",
  "top-right": "Top Right",
  "middle-left": "Middle Left",
  center: "Center",
  "middle-right": "Middle Right",
  "bottom-left": "Bottom Left",
  "bottom-center": "Bottom Center",
  "bottom-right": "Bottom Right",
};

export interface AnchorPickerProps {
  value: LayoutAnchor;
  onChange: (next: LayoutAnchor) => void;
  /** Visible label printed above the grid. Defaults to "Anchor". */
  label?: string;
}

export function AnchorPicker({
  value,
  onChange,
  label = "Anchor",
}: AnchorPickerProps) {
  // Track which cell currently has keyboard focus so arrow-nav works
  // even before any click. Seeded from `value`; stays in sync with it
  // via the key of each button so React re-applies focus when the
  // external value changes.
  const flat = ANCHOR_GRID.flat();
  const currentIndex = flat.indexOf(value);

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next = i;
    if (e.code === "ArrowLeft") next = i % 3 === 0 ? i : i - 1;
    else if (e.code === "ArrowRight") next = i % 3 === 2 ? i : i + 1;
    else if (e.code === "ArrowUp") next = i < 3 ? i : i - 3;
    else if (e.code === "ArrowDown") next = i > 5 ? i : i + 3;
    else return;
    e.preventDefault();
    onChange(flat[next]);
    // Focus follows selection so subsequent arrows continue from the
    // new cell. The button with the matching `aria-pressed=true` will
    // be the one to receive focus on next render.
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-text-tertiary">
        <span>{label}</span>
        <span
          className="font-mono text-[10px] normal-case tracking-normal text-text-secondary"
          title={`Current: ${ANCHOR_TOOLTIP[value]}`}
        >
          {value}
        </span>
      </label>
      <div
        role="radiogroup"
        aria-label={label}
        className="mx-auto grid w-max grid-cols-3 gap-1 rounded border border-bg-tertiary bg-bg-primary p-1.5"
      >
        {flat.map((anchor, i) => {
          const isActive = anchor === value;
          const isFocusTarget = i === (currentIndex === -1 ? 4 : currentIndex);
          return (
            <button
              key={anchor}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={ANCHOR_TOOLTIP[anchor]}
              tabIndex={isFocusTarget ? 0 : -1}
              title={ANCHOR_TOOLTIP[anchor]}
              onClick={() => onChange(anchor)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={
                "flex h-6 w-6 items-center justify-center rounded-sm outline-none transition-colors focus:ring-1 focus:ring-primary/40 " +
                (isActive
                  ? "bg-primary/20 hover:bg-primary/30"
                  : "hover:bg-bg-tertiary")
              }
            >
              {/* The dot. Filled when active; hollow otherwise. */}
              <span
                className={
                  "block h-2 w-2 rounded-full " +
                  (isActive
                    ? "bg-primary"
                    : "border border-text-tertiary bg-transparent")
                }
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
