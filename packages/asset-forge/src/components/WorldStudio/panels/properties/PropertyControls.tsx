/**
 * PropertyControls — UE5 Details-Panel-style property editing components
 *
 * Provides consistent slider, number input, toggle, select, and text controls
 * used across all per-type property editors.
 *
 * UE5-style features:
 * - Drag-to-scrub on numeric labels (DragNumberInput)
 * - Inline fill-bar sliders with overlay text (SliderInput)
 * - Axis-colored position inputs (PositionEditor)
 * - Collapsible sections with accent bar (PropertySection)
 */

import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { useWorldStudio } from "../../WorldStudioContext";
import type { ManifestData } from "../../types";

// ============== HELPERS ==============

/** Clamp a number between min and max. */
function clamp(val: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, val));
}

/** Format a number for display: use fixed decimals for small steps, round otherwise. */
function formatValue(val: number, step: number): string {
  if (step < 0.01) return val.toFixed(3);
  if (step < 1) return val.toFixed(2);
  return String(Math.round(val * 100) / 100);
}

/** Compute fill percentage for a value within [min, max]. */
function fillPercent(val: number, min: number, max: number): number {
  if (max <= min) return 0;
  return clamp(((val - min) / (max - min)) * 100, 0, 100);
}

/** Snap a value to the nearest step. */
function snapToStep(val: number, step: number): number {
  return Math.round(val / step) * step;
}

// ============== DRAG-TO-SCRUB HOOK ==============

interface UseDragScrubOptions {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step: number;
  sensitivity?: number;
}

/**
 * Hook providing UE5-style drag-to-scrub on a label element.
 * Returns a ref to attach to the drag handle, plus isDragging state.
 *
 * Shift = 10x speed, Ctrl/Meta = 0.1x precision.
 */
function useDragScrub({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step,
  sensitivity = 1,
}: UseDragScrubOptions) {
  const handleRef = useRef<HTMLElement>(null);
  const dragState = useRef<{
    startX: number;
    startValue: number;
    active: boolean;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Keep latest value/onChange in ref so listeners always see current values
  const latestRef = useRef({ value, onChange, min, max, step, sensitivity });
  latestRef.current = { value, onChange, min, max, step, sensitivity };

  useEffect(() => {
    const el = handleRef.current;
    if (!el) return;

    const onMouseDown = (e: MouseEvent) => {
      // Only primary button
      if (e.button !== 0) return;
      e.preventDefault();
      dragState.current = {
        startX: e.clientX,
        startValue: latestRef.current.value,
        active: false,
      };

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragState.current) return;
        const ds = dragState.current;
        if (!ds.active) {
          // Require a small deadzone (2px) before activating drag
          if (Math.abs(ev.clientX - ds.startX) < 2) return;
          ds.active = true;
          setIsDragging(true);
          document.body.style.cursor = "ew-resize";
          document.body.style.userSelect = "none";
        }

        const {
          min: lo,
          max: hi,
          step: s,
          sensitivity: sens,
          onChange: cb,
        } = latestRef.current;
        let multiplier = sens;
        if (ev.shiftKey) multiplier *= 10;
        if (ev.ctrlKey || ev.metaKey) multiplier *= 0.1;

        const dx = ev.clientX - ds.startX;
        const rawDelta = dx * s * multiplier;
        const newVal = clamp(snapToStep(ds.startValue + rawDelta, s), lo, hi);
        cb(newVal);
      };

      const onMouseUp = () => {
        dragState.current = null;
        setIsDragging(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };

    el.addEventListener("mousedown", onMouseDown);
    return () => {
      el.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  return { handleRef, isDragging };
}

// ============== INLINE EDIT HOOK ==============

/**
 * Hook for click-to-edit-precise-value behavior.
 * Returns editing state, value text, and handlers.
 */
function useInlineEdit(
  value: number,
  onChange: (v: number) => void,
  step: number,
  min?: number,
  max?: number,
) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    setEditText(formatValue(value, step));
    setEditing(true);
  }, [value, step]);

  const commitEdit = useCallback(() => {
    setEditing(false);
    const parsed = parseFloat(editText);
    if (!isNaN(parsed)) {
      const lo = min ?? -Infinity;
      const hi = max ?? Infinity;
      onChange(clamp(snapToStep(parsed, step), lo, hi));
    }
  }, [editText, onChange, step, min, max]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        commitEdit();
      } else if (e.key === "Escape") {
        setEditing(false);
      }
    },
    [commitEdit],
  );

  // Auto-focus input when editing starts
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  return {
    editing,
    editText,
    setEditText,
    inputRef,
    startEdit,
    commitEdit,
    handleKeyDown,
  };
}

// ============== SECTION ==============

interface PropertySectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
  /** Optional key for localStorage collapse memory. If provided, open/closed state persists. */
  persistKey?: string;
  children: React.ReactNode;
}

const SECTION_STORAGE_KEY = "worldstudio-sections";

function getSectionState(key: string): boolean | null {
  try {
    const raw = localStorage.getItem(SECTION_STORAGE_KEY);
    if (raw) {
      const map = JSON.parse(raw) as Record<string, boolean>;
      if (key in map) return map[key];
    }
  } catch {
    /* ignore */
  }
  return null;
}

function setSectionState(key: string, open: boolean) {
  try {
    const raw = localStorage.getItem(SECTION_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    map[key] = open;
    localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function PropertySection({
  title,
  icon,
  defaultOpen = true,
  badge,
  persistKey,
  children,
}: PropertySectionProps) {
  const [open, setOpen] = useState(() => {
    if (persistKey) {
      const saved = getSectionState(persistKey);
      if (saved !== null) return saved;
    }
    return defaultOpen;
  });

  const handleToggle = useCallback(() => {
    setOpen((v) => {
      const next = !v;
      if (persistKey) setSectionState(persistKey, next);
      return next;
    });
  }, [persistKey]);

  return (
    <div className="border-b border-border-primary">
      <button
        className="w-full flex items-center gap-1.5 px-3 py-2 transition-all duration-120 relative group/section"
        style={{
          background: open ? "var(--bg-tertiary)" : "var(--bg-secondary)",
          borderTop: "1px solid var(--surface-highlight)",
        }}
        onClick={handleToggle}
        onMouseEnter={(e) => {
          if (!open)
            (e.currentTarget as HTMLElement).style.background =
              "var(--bg-tertiary)";
        }}
        onMouseLeave={(e) => {
          if (!open)
            (e.currentTarget as HTMLElement).style.background =
              "var(--bg-secondary)";
        }}
      >
        {/* UE5-style left accent bar when expanded */}
        {open && (
          <div
            className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary"
            style={{ boxShadow: "1px 0 6px rgba(99, 102, 241, 0.25)" }}
          />
        )}
        <ChevronDown
          size={9}
          className={`text-text-muted transition-transform duration-150 ${open ? "" : "-rotate-90"}`}
        />
        {icon && <span className="text-text-tertiary">{icon}</span>}
        <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex-1 text-left">
          {title}
        </span>
        {badge != null && (
          <span className="text-[10px] text-text-muted font-mono tabular-nums">
            {badge}
          </span>
        )}
      </button>
      {open && (
        <div className="px-3 py-2.5 space-y-2.5 ws-section-content">
          {children}
        </div>
      )}
    </div>
  );
}

// ============== DRAG NUMBER INPUT ==============

interface DragNumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** Drag speed multiplier (default 1). Higher = faster scrubbing. */
  sensitivity?: number;
}

/**
 * UE5-style drag-to-scrub numeric input.
 *
 * - Hover the label to see `ew-resize` cursor
 * - Drag left/right on the label to scrub the value
 * - Hold Shift for 10x speed, Ctrl for 0.1x precision
 * - The value display has an inline fill bar showing position in [min, max]
 * - Click the value text to type a precise number
 */
export function DragNumberInput({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit,
  sensitivity = 1,
}: DragNumberInputProps) {
  const { handleRef, isDragging } = useDragScrub({
    value,
    onChange,
    min,
    max,
    step,
    sensitivity,
  });

  const {
    editing,
    editText,
    setEditText,
    inputRef,
    startEdit,
    commitEdit,
    handleKeyDown,
  } = useInlineEdit(value, onChange, step, min, max);

  const pct = fillPercent(value, min, max);

  return (
    <div className="flex items-center justify-between gap-2 group">
      {/* Draggable label */}
      <label
        ref={handleRef as React.RefObject<HTMLLabelElement>}
        className={`text-xs text-text-secondary select-none shrink-0 ${
          isDragging
            ? "cursor-ew-resize text-primary"
            : "cursor-ew-resize hover:text-primary"
        }`}
      >
        {label}
      </label>

      {/* Value display with fill bar */}
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="w-20 px-1.5 py-0.5 text-xs border border-primary/50 rounded-[3px] font-mono text-text-primary text-right focus:outline-none"
          style={{
            background: "var(--input-bg)",
            boxShadow: "var(--input-shadow), 0 0 0 1px rgba(99, 102, 241, 0.2)",
          }}
        />
      ) : (
        <div
          className="relative w-20 h-[22px] border rounded-[3px] overflow-hidden cursor-text transition-colors duration-120 hover:border-[var(--input-border-hover)]"
          style={{
            background: "var(--input-bg)",
            borderColor: "var(--input-border)",
            boxShadow: "var(--input-shadow)",
          }}
          onClick={startEdit}
        >
          {/* Fill bar with gradient */}
          <div
            className="absolute inset-y-0 left-0 transition-[width] duration-75"
            style={{
              width: `${pct}%`,
              background:
                "linear-gradient(90deg, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0.22) 100%)",
            }}
          />
          {/* Value text */}
          <span className="relative z-10 flex items-center justify-end h-full px-1.5 text-xs font-mono text-text-primary">
            {formatValue(value, step)}
            {unit && <span className="text-text-muted ml-0.5">{unit}</span>}
          </span>
        </div>
      )}
    </div>
  );
}

// ============== SLIDER INPUT (UE5 STYLE) ==============

interface SliderInputProps {
  label: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
}

/**
 * UE5-style inline slider — the entire bar IS the slider.
 *
 * - A colored fill bar shows value position
 * - Numeric value overlays the bar as text
 * - Drag anywhere on the bar to change value
 * - Click the value text to type a precise number
 */
export function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  hint,
}: SliderInputProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const {
    editing,
    editText,
    setEditText,
    inputRef,
    startEdit,
    commitEdit,
    handleKeyDown,
  } = useInlineEdit(value, onChange, step, min, max);

  // Compute value from mouse position on bar
  const valueFromMouse = useCallback(
    (clientX: number) => {
      const bar = barRef.current;
      if (!bar) return value;
      const rect = bar.getBoundingClientRect();
      const pct = clamp((clientX - rect.left) / rect.width, 0, 1);
      const raw = min + pct * (max - min);
      return clamp(snapToStep(raw, step), min, max);
    },
    [min, max, step, value],
  );

  // Keep latest onChange in a ref for event listeners
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueFromMouseRef = useRef(valueFromMouse);
  valueFromMouseRef.current = valueFromMouse;

  const handleBarMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      setDragging(true);
      const newVal = valueFromMouse(e.clientX);
      onChange(newVal);

      const onMouseMove = (ev: MouseEvent) => {
        const v = valueFromMouseRef.current(ev.clientX);
        onChangeRef.current(v);
      };

      const onMouseUp = () => {
        setDragging(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [valueFromMouse, onChange],
  );

  const pct = fillPercent(value, min, max);

  return (
    <div className="space-y-1">
      <label className="text-xs text-text-secondary block" title={hint}>
        {label}
      </label>

      {editing ? (
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="flex-1 px-1.5 py-0.5 text-xs border border-primary/50 rounded-[3px] font-mono text-text-primary text-right focus:outline-none"
            style={{
              background: "var(--input-bg)",
              boxShadow:
                "var(--input-shadow), 0 0 0 1px rgba(99, 102, 241, 0.2)",
            }}
          />
          {unit && (
            <span className="text-[10px] text-text-tertiary">{unit}</span>
          )}
        </div>
      ) : (
        <div
          ref={barRef}
          className={`relative h-[22px] rounded-[3px] overflow-hidden select-none transition-all duration-120 ${
            dragging ? "border-primary/50 cursor-ew-resize" : "cursor-ew-resize"
          }`}
          style={{
            background: "var(--input-bg)",
            border: `1px solid ${dragging ? "rgba(99, 102, 241, 0.4)" : "var(--input-border)"}`,
            boxShadow: dragging
              ? "var(--input-shadow), 0 0 8px rgba(99, 102, 241, 0.1)"
              : "var(--input-shadow)",
          }}
          onMouseDown={handleBarMouseDown}
          onDoubleClick={startEdit}
          onMouseEnter={(e) => {
            if (!dragging)
              (e.currentTarget as HTMLElement).style.borderColor =
                "var(--input-border-hover)";
          }}
          onMouseLeave={(e) => {
            if (!dragging)
              (e.currentTarget as HTMLElement).style.borderColor =
                "var(--input-border)";
          }}
        >
          {/* Fill bar with gradient */}
          <div
            className="absolute inset-y-0 left-0 transition-[width] duration-75"
            style={{
              width: `${pct}%`,
              background:
                "linear-gradient(90deg, rgba(99, 102, 241, 0.12) 0%, rgba(99, 102, 241, 0.28) 100%)",
            }}
          />
          {/* Value overlay text */}
          <span className="relative z-10 flex items-center justify-end h-full px-1.5 text-xs font-mono text-text-primary pointer-events-none">
            {formatValue(value, step)}
            {unit && <span className="text-text-muted ml-0.5">{unit}</span>}
          </span>
        </div>
      )}
    </div>
  );
}

// ============== NUMBER INPUT (UE5 STYLE) ==============

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

/**
 * Upgraded NumberInput with drag-to-scrub on the label and a subtle
 * fill-bar background showing where in the range the value sits.
 */
export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
}: NumberInputProps) {
  const { handleRef, isDragging } = useDragScrub({
    value,
    onChange,
    min,
    max,
    step,
    sensitivity: 1,
  });

  const {
    editing,
    editText,
    setEditText,
    inputRef,
    startEdit,
    commitEdit,
    handleKeyDown,
  } = useInlineEdit(value, onChange, step, min, max);

  const hasBounds = min != null && max != null;
  const pct = hasBounds ? fillPercent(value, min!, max!) : 0;

  return (
    <div className="flex items-center justify-between gap-2">
      {/* Draggable label */}
      <label
        ref={handleRef as React.RefObject<HTMLLabelElement>}
        className={`text-xs select-none shrink-0 ${
          isDragging
            ? "cursor-ew-resize text-primary"
            : "cursor-ew-resize text-text-secondary hover:text-primary"
        }`}
      >
        {label}
      </label>

      <div className="flex items-center gap-1">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="w-16 px-1.5 py-0.5 text-xs border border-primary/50 rounded-[3px] font-mono text-text-primary text-right focus:outline-none"
            style={{
              background: "var(--input-bg)",
              boxShadow:
                "var(--input-shadow), 0 0 0 1px rgba(99, 102, 241, 0.2)",
            }}
          />
        ) : (
          <div
            className="relative w-16 h-[22px] border rounded-[3px] overflow-hidden cursor-text transition-colors duration-120"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--input-border)",
              boxShadow: "var(--input-shadow)",
            }}
            onClick={startEdit}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.borderColor =
                "var(--input-border-hover)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.borderColor =
                "var(--input-border)")
            }
          >
            {/* Subtle fill bar when bounds are known */}
            {hasBounds && (
              <div
                className="absolute inset-y-0 left-0 transition-[width] duration-75"
                style={{
                  width: `${pct}%`,
                  background:
                    "linear-gradient(90deg, rgba(99, 102, 241, 0.08) 0%, rgba(99, 102, 241, 0.18) 100%)",
                }}
              />
            )}
            <span className="relative z-10 flex items-center justify-end h-full px-1.5 text-xs font-mono text-text-primary">
              {formatValue(value, step)}
            </span>
          </div>
        )}
        {unit && <span className="text-[10px] text-text-tertiary">{unit}</span>}
      </div>
    </div>
  );
}

// ============== TEXT INPUT ==============

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: TextInputProps) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-text-secondary">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-1.5 text-xs border rounded-[3px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50"
        style={{
          background: "var(--input-bg)",
          borderColor: "var(--input-border)",
          boxShadow: "var(--input-shadow)",
        }}
      />
    </div>
  );
}

// ============== TOGGLE ==============

interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function Toggle({ label, value, onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-xs text-text-secondary">{label}</label>
      <button
        className={`w-9 h-[18px] rounded-full relative transition-all duration-200 ${
          value
            ? "bg-primary shadow-[0_0_8px_rgba(99,102,241,0.3)]"
            : "bg-[var(--input-bg)] border border-[var(--input-border)] shadow-[var(--input-shadow)]"
        }`}
        onClick={() => onChange(!value)}
      >
        <div
          className="w-3.5 h-3.5 rounded-full absolute top-[2px] shadow-sm"
          style={{
            background: value ? "#F5F5F5" : "var(--text-tertiary)",
            transform: value ? "translateX(18px)" : "translateX(2px)",
            transition:
              "transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), background 150ms",
          }}
        />
      </button>
    </div>
  );
}

// ============== SELECT ==============

interface SelectInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export function SelectInput({
  label,
  value,
  onChange,
  options,
}: SelectInputProps) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-xs text-text-secondary">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 text-xs border rounded-[3px] text-text-primary focus:outline-none focus:border-primary/50 cursor-pointer"
        style={{
          background: "var(--input-bg)",
          borderColor: "var(--input-border)",
          boxShadow: "var(--input-shadow)",
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ============== POSITION EDITOR (UE5 AXIS-COLORED) ==============

const AXIS_COLORS = {
  x: "border-l-red-500",
  y: "border-l-green-500",
  z: "border-l-blue-500",
} as const;

const AXIS_ACCENT = {
  x: "bg-red-500/15",
  y: "bg-green-500/15",
  z: "bg-blue-500/15",
} as const;

interface PositionEditorProps {
  label: string;
  position: { x: number; y: number; z: number };
  onChange: (position: { x: number; y: number; z: number }) => void;
}

/** Single axis input with drag-to-scrub and UE5 color coding. */
function AxisInput({
  axis,
  value,
  onChange,
}: {
  axis: "x" | "y" | "z";
  value: number;
  onChange: (v: number) => void;
}) {
  const step = 0.5;

  const { handleRef, isDragging } = useDragScrub({
    value,
    onChange,
    step,
    sensitivity: 0.5,
  });

  const {
    editing,
    editText,
    setEditText,
    inputRef,
    startEdit,
    commitEdit,
    handleKeyDown,
  } = useInlineEdit(value, onChange, step);

  const display = (Math.round(value * 10) / 10).toFixed(1);

  return (
    <div className="flex items-center gap-0.5">
      {/* Axis label — drag-to-scrub */}
      <span
        ref={handleRef as React.RefObject<HTMLSpanElement>}
        className={`text-[10px] uppercase w-3 text-center select-none font-semibold ${
          isDragging
            ? "cursor-ew-resize text-primary"
            : "cursor-ew-resize text-text-tertiary hover:text-text-secondary"
        }`}
      >
        {axis}
      </span>

      {/* Input with colored left border */}
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className={`flex-1 w-full px-1 py-0.5 text-[11px] border border-primary/50 border-l-2 ${AXIS_COLORS[axis]} rounded-[3px] font-mono text-text-primary text-right focus:outline-none`}
          style={{
            background: "var(--input-bg)",
            boxShadow: "var(--input-shadow)",
          }}
        />
      ) : (
        <div
          className={`relative flex-1 w-full h-[22px] border border-l-2 ${AXIS_COLORS[axis]} rounded-[3px] overflow-hidden cursor-text transition-colors duration-120`}
          style={{
            background: "var(--input-bg)",
            borderColor: "var(--input-border)",
            boxShadow: "var(--input-shadow)",
          }}
          onClick={startEdit}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.borderColor =
              "var(--input-border-hover)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.borderColor =
              "var(--input-border)")
          }
        >
          {/* Subtle axis-colored tint */}
          <div className={`absolute inset-0 ${AXIS_ACCENT[axis]} opacity-60`} />
          <span className="relative z-10 flex items-center justify-end h-full px-1.5 text-[11px] font-mono text-text-primary">
            {display}
          </span>
        </div>
      )}
    </div>
  );
}

export function PositionEditor({
  label,
  position,
  onChange,
}: PositionEditorProps) {
  const handleChange = useCallback(
    (axis: "x" | "y" | "z", value: number) => {
      onChange({ ...position, [axis]: value });
    },
    [position, onChange],
  );

  return (
    <div className="space-y-1">
      <label className="text-xs text-text-secondary">{label}</label>
      <div className="grid grid-cols-3 gap-1">
        {(["x", "y", "z"] as const).map((axis) => (
          <AxisInput
            key={axis}
            axis={axis}
            value={position[axis]}
            onChange={(v) => handleChange(axis, v)}
          />
        ))}
      </div>
    </div>
  );
}

// ============== OVERRIDABLE FIELD ==============

interface OverridableFieldProps {
  label: string;
  isOverridden: boolean;
  onReset?: () => void;
  children: React.ReactNode;
}

/** Field with override visual indicator — label turns primary color, dot badge, hover reset */
export function OverridableField({
  label,
  isOverridden,
  onReset,
  children,
}: OverridableFieldProps) {
  return (
    <div className="group/field relative">
      <div className="flex items-center justify-between mb-0.5">
        <span
          className={`text-xs ${isOverridden ? "text-primary font-medium" : "text-text-tertiary"}`}
        >
          {label}
          {isOverridden && (
            <span className="ml-0.5 text-[8px] text-primary/60">
              {"\u25CF"}
            </span>
          )}
        </span>
        {isOverridden && onReset && (
          <button
            onClick={onReset}
            className="text-[9px] text-text-tertiary hover:text-primary opacity-0 group-hover/field:opacity-100 transition-opacity"
          >
            Reset
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ============== INFO ROW ==============

interface InfoRowProps {
  label: string;
  value: string | number | undefined;
}

export function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-xs text-text-tertiary">{label}</span>
      <span className="text-xs text-text-secondary font-mono">
        {value ?? "\u2014"}
      </span>
    </div>
  );
}

// ============== COLOR INPUT ==============

/** `#RRGGBB` or `#RGB`. */
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

interface ColorInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

/** Hex-string color picker with swatch + text entry. Commits on blur/Enter. */
export function ColorInput({ label, value, onChange }: ColorInputProps) {
  const safe = HEX_COLOR_RE.test(value) ? value : "#0B0B0D";
  const [draft, setDraft] = useState(safe);
  const commit = useCallback(
    (next: string) => {
      if (HEX_COLOR_RE.test(next)) {
        onChange(next);
      } else {
        setDraft(safe); // revert
      }
    },
    [onChange, safe],
  );
  useEffect(() => {
    setDraft(safe);
  }, [safe]);
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-xs text-text-tertiary">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          className="w-5 h-5 rounded border border-border cursor-pointer bg-transparent p-0"
          aria-label={`${label} swatch`}
        />
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setDraft(safe);
          }}
          className="w-20 text-xs font-mono px-1.5 py-0.5 rounded bg-surface-2 border border-border text-text-primary focus:outline-none focus:border-accent"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

// ============== TAGS INPUT ==============

interface TagsInputProps {
  label: string;
  value: readonly string[];
  onChange: (v: string[]) => void;
  /** If true, keep the array sorted on every commit. */
  sorted?: boolean;
}

/** Chip-style tag editor. Comma or Enter commits; backspace on empty removes last. */
export function TagsInput({ label, value, onChange, sorted }: TagsInputProps) {
  const [draft, setDraft] = useState("");
  const commitTag = useCallback(
    (raw: string) => {
      const next = raw.trim();
      if (!next || value.includes(next)) return;
      const arr = [...value, next];
      if (sorted) arr.sort();
      onChange(arr);
    },
    [onChange, sorted, value],
  );
  const removeTag = useCallback(
    (tag: string) => {
      onChange(value.filter((t) => t !== tag));
    },
    [onChange, value],
  );
  return (
    <div className="space-y-1 py-0.5">
      <span className="text-xs text-text-tertiary">{label}</span>
      <div className="flex flex-wrap items-center gap-1 rounded border border-border bg-surface-2 px-1.5 py-1 min-h-[26px]">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-accent/15 border border-accent/30 text-[10px] text-accent px-1.5 py-px"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-accent/70 hover:text-accent"
              aria-label={`remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commitTag(draft);
              setDraft("");
            } else if (
              e.key === "Backspace" &&
              draft === "" &&
              value.length > 0
            ) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (draft.trim()) {
              commitTag(draft);
              setDraft("");
            }
          }}
          placeholder={value.length === 0 ? "Add tag…" : ""}
          className="flex-1 min-w-[60px] text-xs bg-transparent focus:outline-none text-text-primary"
        />
      </div>
    </div>
  );
}

// ============== JSON INPUT ==============

interface JsonInputProps {
  label: string;
  value: unknown;
  onChange: (v: unknown) => void;
  rows?: number;
}

/** Textarea JSON editor. Commits on blur when text parses; otherwise highlights error. */
export function JsonInput({
  label,
  value,
  onChange,
  rows = 4,
}: JsonInputProps) {
  const serialized = React.useMemo(() => {
    try {
      return JSON.stringify(value ?? null, null, 2);
    } catch {
      return "";
    }
  }, [value]);
  const [draft, setDraft] = useState(serialized);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setDraft(serialized);
    setErr(null);
  }, [serialized]);
  const commit = useCallback(() => {
    try {
      const parsed: unknown = draft.trim() === "" ? null : JSON.parse(draft);
      setErr(null);
      onChange(parsed);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "invalid JSON");
    }
  }, [draft, onChange]);
  return (
    <div className="space-y-1 py-0.5">
      <span className="text-xs text-text-tertiary">{label}</span>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        rows={rows}
        spellCheck={false}
        className={`w-full text-[11px] font-mono px-1.5 py-1 rounded bg-surface-2 border ${err ? "border-red-500" : "border-border"} text-text-primary focus:outline-none focus:border-accent`}
      />
      {err && <p className="text-[10px] text-red-400">{err}</p>}
    </div>
  );
}

// ============== VECTOR3 INPUT ==============

interface Vector3InputProps {
  label: string;
  value: { x: number; y: number; z: number };
  onChange: (v: { x: number; y: number; z: number }) => void;
  step?: number;
  unit?: string;
}

/**
 * Three-axis numeric editor. Use for sizes / offsets / extents — unlike
 * `PositionEditor` this carries no ground-snap or world-space semantics.
 */
export function Vector3Input({
  label,
  value,
  onChange,
  step,
  unit,
}: Vector3InputProps) {
  const v = value ?? { x: 0, y: 0, z: 0 };
  const effStep = step ?? 0.1;
  return (
    <div className="space-y-1 py-0.5">
      <span className="text-xs text-text-tertiary">{label}</span>
      <div className="grid grid-cols-3 gap-1">
        {(["x", "y", "z"] as const).map((axis) => (
          <div key={axis} className="flex items-center gap-1">
            <span className="text-[10px] uppercase w-3 text-center text-text-tertiary font-semibold">
              {axis}
            </span>
            <input
              type="number"
              value={v[axis]}
              step={effStep}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n)) onChange({ ...v, [axis]: n });
              }}
              className="flex-1 min-w-0 text-[11px] font-mono px-1 py-0.5 rounded bg-surface-2 border border-border text-text-primary focus:outline-none focus:border-accent"
            />
            {unit && (
              <span className="text-[10px] text-text-tertiary">{unit}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== MANIFEST REF INPUT ==============

interface ManifestRefInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Manifest kind to resolve (e.g. "items", "npcs", "miningRocks", "trees"). */
  manifestKind: string;
  /** Optional description shown beneath the picker. */
  description?: string;
}

/** Known manifest keys with `id` fields we can iterate for options. */
const MANIFEST_ARRAY_KEYS: ReadonlyArray<keyof ManifestData> = [
  "npcs",
  "stations",
  "miningRocks",
  "trees",
  "fishingSpots",
  "items",
  "quests",
  "stores",
  "combatSpells",
  "prayers",
  "runes",
  "elementalStaves",
  "ammunition",
  "recipes",
  "skillUnlocks",
  "tierRequirements",
  "duelArenas",
];

/**
 * Resolves an entity ID to a manifest entry from
 * `state.manifests[manifestKind]`. Renders a dropdown picker populated with
 * `{id, name}` from the manifest, falling back to the raw id if no match is
 * found. Shows an amber warning when the current value isn't in the manifest.
 */
export function ManifestRefInput({
  label,
  value,
  onChange,
  manifestKind,
  description,
}: ManifestRefInputProps) {
  const { state } = useWorldStudio();
  const entries = useMemo(() => {
    const key = manifestKind as keyof ManifestData;
    if (!MANIFEST_ARRAY_KEYS.includes(key)) {
      return [] as Array<Record<string, unknown>>;
    }
    const raw = state.manifests[key];
    if (!Array.isArray(raw)) return [];
    return raw as unknown as Array<Record<string, unknown>>;
  }, [state.manifests, manifestKind]);

  const options = useMemo(
    () =>
      entries.map((e) => {
        // Manifest entries use `id` for most kinds, `type` for stations.
        const id = (e.id ?? e.type ?? "") as string;
        const label = (e.name ?? e.label ?? id) as string;
        return { value: id, label };
      }),
    [entries],
  );
  const matched = options.some((o) => o.value === value);
  const loaded = state.manifests.loaded;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-text-secondary">{label}</label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="px-2 py-1 text-xs border rounded-[3px] text-text-primary focus:outline-none focus:border-primary/50 cursor-pointer"
          style={{
            background: "var(--input-bg)",
            borderColor:
              !matched && value && loaded
                ? "rgb(245 158 11 / 0.6)"
                : "var(--input-border)",
            boxShadow: "var(--input-shadow)",
            minWidth: 160,
          }}
        >
          {!matched && value ? (
            <option value={value}>{value} (not in manifest)</option>
          ) : null}
          {!value ? <option value="">— select —</option> : null}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {description ? (
        <p className="text-[10px] text-text-tertiary">{description}</p>
      ) : null}
      {!loaded ? (
        <p className="text-[10px] text-text-tertiary italic">
          Manifests loading…
        </p>
      ) : !matched && value ? (
        <p className="text-[10px] text-amber-400/80 italic">
          No {manifestKind} entry for &quot;{value}&quot;.
        </p>
      ) : null}
    </div>
  );
}

// ============== MULTI-SELECT INPUT ==============

interface MultiSelectInputProps {
  label: string;
  value: readonly string[];
  onChange: (v: string[]) => void;
  options: Array<{ value: string; label: string }>;
  sorted?: boolean;
}

/** Checkbox-list multi-select. Produces a string array of selected option values. */
export function MultiSelectInput({
  label,
  value,
  onChange,
  options,
  sorted,
}: MultiSelectInputProps) {
  const toggle = useCallback(
    (opt: string) => {
      const has = value.includes(opt);
      const next = has ? value.filter((v) => v !== opt) : [...value, opt];
      if (sorted) next.sort();
      onChange(next);
    },
    [onChange, sorted, value],
  );
  return (
    <div className="space-y-1 py-0.5">
      <span className="text-xs text-text-tertiary">{label}</span>
      <div className="rounded border border-border bg-surface-2 divide-y divide-border max-h-40 overflow-y-auto">
        {options.length === 0 ? (
          <div className="px-2 py-1.5 text-[11px] text-text-tertiary italic">
            No options
          </div>
        ) : (
          options.map((opt) => {
            const checked = value.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex items-center gap-1.5 px-2 py-1 cursor-pointer hover:bg-surface-3 text-[11px] text-text-primary"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt.value)}
                  className="accent-accent"
                />
                <span>{opt.label}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============== QUATERNION INPUT ==============

interface QuaternionInputProps {
  label: string;
  value: { x: number; y: number; z: number; w: number };
  onChange: (v: { x: number; y: number; z: number; w: number }) => void;
  step?: number;
}

/**
 * Four-axis quaternion editor (x, y, z, w). Raw numeric fields — users
 * are expected to understand the quaternion format. For Euler-friendly
 * rotation editing, use the `rotation` field type instead.
 */
export function QuaternionInput({
  label,
  value,
  onChange,
  step,
}: QuaternionInputProps) {
  const q = value ?? { x: 0, y: 0, z: 0, w: 1 };
  const effStep = step ?? 0.01;
  return (
    <div className="space-y-1 py-0.5">
      <span className="text-xs text-text-tertiary">{label}</span>
      <div className="grid grid-cols-4 gap-1">
        {(["x", "y", "z", "w"] as const).map((axis) => (
          <div key={axis} className="flex items-center gap-1">
            <span className="text-[10px] uppercase w-3 text-center text-text-tertiary font-semibold">
              {axis}
            </span>
            <input
              type="number"
              value={q[axis]}
              step={effStep}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isNaN(n)) onChange({ ...q, [axis]: n });
              }}
              className="flex-1 min-w-0 text-[11px] font-mono px-1 py-0.5 rounded bg-surface-2 border border-border text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== KEYBINDING INPUT ==============

interface KeybindingInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  description?: string;
}

/**
 * Capture-style key binding input. Click to focus, then press any key
 * combination (with optional modifiers) to bind. Displays "Esc" to clear.
 */
export function KeybindingInput({
  label,
  value,
  onChange,
  description,
}: KeybindingInputProps) {
  const [capturing, setCapturing] = React.useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.key === "Escape") {
      onChange("");
      setCapturing(false);
      return;
    }
    if (e.key === "Tab") {
      setCapturing(false);
      return;
    }
    const parts: string[] = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.metaKey) parts.push("Meta");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (!["Control", "Meta", "Alt", "Shift"].includes(e.key)) {
      parts.push(key);
      onChange(parts.join("+"));
      setCapturing(false);
    }
  };

  return (
    <div className="space-y-0.5 py-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-text-tertiary">{label}</span>
        <input
          readOnly
          value={capturing ? "Press a key..." : value || "(unbound)"}
          onFocus={() => setCapturing(true)}
          onBlur={() => setCapturing(false)}
          onKeyDown={handleKeyDown}
          className={`flex-1 min-w-0 text-[11px] font-mono px-2 py-0.5 rounded border text-text-primary focus:outline-none text-center cursor-pointer ${
            capturing
              ? "bg-primary/20 border-primary"
              : "bg-surface-2 border-border focus:border-accent"
          }`}
        />
      </div>
      {description && (
        <p className="text-[10px] text-text-tertiary italic">{description}</p>
      )}
    </div>
  );
}

// ============== CurveInput ==============

export interface CurvePoint {
  x: number;
  y: number;
}

interface CurveInputProps {
  label: string;
  value: CurvePoint[] | undefined;
  onChange: (v: CurvePoint[]) => void;
  /** Visual x-axis range (for preview scaling). Defaults to auto from data. */
  xRange?: [number, number];
  /** Visual y-axis range (for preview scaling). Defaults to auto from data. */
  yRange?: [number, number];
  description?: string;
}

/**
 * CurveInput — edits a sequence of {x, y} control points plus an SVG preview.
 * Points are kept sorted by x on every edit. Minimal by design: the serialized
 * shape is a plain array, so downstream sampling is the consumer's choice
 * (linear, catmull-rom, etc.).
 */
export function CurveInput({
  label,
  value,
  onChange,
  xRange,
  yRange,
  description,
}: CurveInputProps) {
  const points = useMemo(
    () =>
      Array.isArray(value)
        ? [...value].sort((a, b) => a.x - b.x)
        : ([] as CurvePoint[]),
    [value],
  );

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = xRange?.[0] ?? (xs.length ? Math.min(...xs) : 0);
  const xMax = xRange?.[1] ?? (xs.length ? Math.max(...xs) : 1);
  const yMin = yRange?.[0] ?? (ys.length ? Math.min(...ys) : 0);
  const yMax = yRange?.[1] ?? (ys.length ? Math.max(...ys) : 1);
  const xSpan = xMax - xMin || 1;
  const ySpan = yMax - yMin || 1;

  const W = 180;
  const H = 64;
  const pathD = points.length
    ? points
        .map((p, i) => {
          const px = ((p.x - xMin) / xSpan) * W;
          const py = H - ((p.y - yMin) / ySpan) * H;
          return `${i === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`;
        })
        .join(" ")
    : "";

  const updatePoint = (i: number, patch: Partial<CurvePoint>) => {
    const next = points.map((p, idx) => (idx === i ? { ...p, ...patch } : p));
    onChange(next);
  };
  const removePoint = (i: number) => {
    onChange(points.filter((_, idx) => idx !== i));
  };
  const addPoint = () => {
    const lastX = points.length ? points[points.length - 1].x : 0;
    const lastY = points.length ? points[points.length - 1].y : 0;
    onChange([...points, { x: lastX + 1, y: lastY }]);
  };

  return (
    <div className="space-y-1 py-0.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-tertiary">{label}</span>
        <button
          type="button"
          onClick={addPoint}
          className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-2 border border-border text-text-secondary hover:bg-surface-3"
          title="Add point"
        >
          <Plus size={10} /> Add
        </button>
      </div>
      <svg
        width={W}
        height={H}
        className="w-full rounded border border-border bg-surface-2"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
      >
        {pathD && (
          <path d={pathD} stroke="currentColor" fill="none" strokeWidth={1.5} />
        )}
        {points.map((p, i) => {
          const px = ((p.x - xMin) / xSpan) * W;
          const py = H - ((p.y - yMin) / ySpan) * H;
          return <circle key={i} cx={px} cy={py} r={2.5} fill="currentColor" />;
        })}
      </svg>
      <div className="space-y-0.5">
        {points.map((p, i) => (
          <div
            key={i}
            className="flex items-center gap-1 text-[11px] text-text-primary"
          >
            <span className="w-4 text-text-tertiary">{i}</span>
            <input
              type="number"
              value={p.x}
              step={0.01}
              onChange={(e) =>
                updatePoint(i, { x: parseFloat(e.target.value) || 0 })
              }
              className="w-16 px-1.5 py-0.5 rounded border border-border bg-surface-2 focus:outline-none focus:border-accent"
            />
            <input
              type="number"
              value={p.y}
              step={0.01}
              onChange={(e) =>
                updatePoint(i, { y: parseFloat(e.target.value) || 0 })
              }
              className="w-16 px-1.5 py-0.5 rounded border border-border bg-surface-2 focus:outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => removePoint(i)}
              className="ml-auto p-0.5 rounded text-text-tertiary hover:text-red-400"
              title="Remove point"
            >
              <Trash2 size={10} />
            </button>
          </div>
        ))}
      </div>
      {description && (
        <p className="text-[10px] text-text-tertiary italic">{description}</p>
      )}
    </div>
  );
}

// ============== ColorRampInput ==============

export interface ColorRampStop {
  stop: number; // 0..1
  color: string; // hex
}

interface ColorRampInputProps {
  label: string;
  value: ColorRampStop[] | undefined;
  onChange: (v: ColorRampStop[]) => void;
  description?: string;
}

/**
 * ColorRampInput — edits a gradient stop list and renders a live preview bar.
 * Stops are kept sorted by `stop` ascending; `stop` is clamped to [0, 1].
 */
export function ColorRampInput({
  label,
  value,
  onChange,
  description,
}: ColorRampInputProps) {
  const stops = useMemo(
    () =>
      Array.isArray(value)
        ? [...value].sort((a, b) => a.stop - b.stop)
        : ([] as ColorRampStop[]),
    [value],
  );

  const gradient =
    stops.length > 0
      ? `linear-gradient(to right, ${stops
          .map((s) => `${s.color} ${(s.stop * 100).toFixed(1)}%`)
          .join(", ")})`
      : "linear-gradient(to right, #0B0B0D 0%, #0B0B0D 100%)";

  const updateStop = (i: number, patch: Partial<ColorRampStop>) => {
    const next = stops.map((s, idx) =>
      idx === i
        ? {
            ...s,
            ...patch,
            stop: Math.min(
              1,
              Math.max(0, patch.stop !== undefined ? patch.stop : s.stop),
            ),
          }
        : s,
    );
    onChange(next);
  };
  const removeStop = (i: number) => {
    onChange(stops.filter((_, idx) => idx !== i));
  };
  const addStop = () => {
    const lastStop = stops.length ? stops[stops.length - 1].stop : 0;
    const lastColor = stops.length ? stops[stops.length - 1].color : "#F5F5F5";
    const newStop = Math.min(1, lastStop + 0.1);
    onChange([...stops, { stop: newStop, color: lastColor }]);
  };

  return (
    <div className="space-y-1 py-0.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-tertiary">{label}</span>
        <button
          type="button"
          onClick={addStop}
          className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-2 border border-border text-text-secondary hover:bg-surface-3"
          title="Add stop"
        >
          <Plus size={10} /> Add
        </button>
      </div>
      <div
        className="w-full h-4 rounded border border-border"
        style={{ background: gradient }}
      />
      <div className="space-y-0.5">
        {stops.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-1 text-[11px] text-text-primary"
          >
            <input
              type="number"
              value={s.stop}
              min={0}
              max={1}
              step={0.01}
              onChange={(e) =>
                updateStop(i, { stop: parseFloat(e.target.value) || 0 })
              }
              className="w-16 px-1.5 py-0.5 rounded border border-border bg-surface-2 focus:outline-none focus:border-accent"
            />
            <input
              type="color"
              value={s.color}
              onChange={(e) => updateStop(i, { color: e.target.value })}
              className="w-7 h-5 p-0 rounded border border-border bg-surface-2 cursor-pointer"
            />
            <input
              type="text"
              value={s.color}
              onChange={(e) => updateStop(i, { color: e.target.value })}
              className="flex-1 min-w-0 font-mono px-1.5 py-0.5 rounded border border-border bg-surface-2 focus:outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => removeStop(i)}
              className="p-0.5 rounded text-text-tertiary hover:text-red-400"
              title="Remove stop"
            >
              <Trash2 size={10} />
            </button>
          </div>
        ))}
      </div>
      {description && (
        <p className="text-[10px] text-text-tertiary italic">{description}</p>
      )}
    </div>
  );
}

// ============== AssetRefInput ==============

export type AssetKind =
  | "model"
  | "texture"
  | "audio"
  | "hdri"
  | "animation"
  | "other";

interface AssetRefInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Expected asset kind, determines the icon + accept filter hint. */
  assetKind?: AssetKind;
  /** Optional curated list (e.g. all known model urls). If provided, renders as datalist. */
  suggestions?: string[];
  description?: string;
}

const ASSET_KIND_EXTS: Record<AssetKind, string[]> = {
  model: [".glb", ".gltf", ".fbx", ".obj", ".vrm"],
  texture: [".png", ".jpg", ".jpeg", ".webp", ".ktx2"],
  audio: [".mp3", ".ogg", ".wav", ".webm"],
  hdri: [".hdr", ".exr"],
  animation: [".glb", ".fbx"],
  other: [],
};

function detectAssetKindFromValue(value: string): AssetKind {
  const lower = value.toLowerCase();
  for (const [kind, exts] of Object.entries(ASSET_KIND_EXTS) as Array<
    [AssetKind, string[]]
  >) {
    if (kind === "other") continue;
    if (exts.some((ext) => lower.endsWith(ext))) return kind;
  }
  return "other";
}

const ASSET_KIND_LABEL: Record<AssetKind, string> = {
  model: "3D Model",
  texture: "Texture",
  audio: "Audio",
  hdri: "HDRI",
  animation: "Animation",
  other: "Asset",
};

/**
 * AssetRefInput — edits a reference to an asset by URL/id.
 *
 * Minimal scope: typed text input + datalist suggestions + a small
 * filename preview. Does NOT open a full asset browser (that lives in
 * `ContentBrowser`); the user can paste a URL or pick from suggestions.
 * A future revision will add a "Browse…" button wired to the content browser.
 */
export function AssetRefInput({
  label,
  value,
  onChange,
  assetKind,
  suggestions,
  description,
}: AssetRefInputProps) {
  const resolvedKind =
    assetKind ?? (value ? detectAssetKindFromValue(value) : "other");
  const filename = value ? value.split("/").pop() || value : "";
  const listId = useMemo(
    () => `asset-ref-suggestions-${Math.random().toString(36).slice(2, 8)}`,
    [],
  );

  return (
    <div className="space-y-0.5 py-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-text-tertiary">{label}</span>
        <span className="text-[10px] text-text-tertiary italic">
          {ASSET_KIND_LABEL[resolvedKind]}
        </span>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          assetKind && ASSET_KIND_EXTS[assetKind].length
            ? `Paste url (${ASSET_KIND_EXTS[assetKind].join(", ")})`
            : "Paste asset url or id"
        }
        list={suggestions && suggestions.length > 0 ? listId : undefined}
        className="w-full text-[11px] font-mono px-2 py-0.5 rounded border border-border bg-surface-2 text-text-primary focus:outline-none focus:border-accent"
      />
      {suggestions && suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {filename && (
        <p className="text-[10px] text-text-tertiary truncate font-mono">
          {filename}
        </p>
      )}
      {description && (
        <p className="text-[10px] text-text-tertiary italic">{description}</p>
      )}
    </div>
  );
}
