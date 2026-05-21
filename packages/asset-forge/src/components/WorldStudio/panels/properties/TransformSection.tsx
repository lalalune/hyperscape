/**
 * TransformSection — Editable position/rotation/scale fields for the Properties panel.
 *
 * Matches UE5's Details Panel Transform section. Position fields are directly
 * editable and sync with the 3D viewport.
 */

import React, { useState, useCallback, useEffect } from "react";

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface TransformSectionProps {
  position: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  onPositionChange?: (position: Vec3) => void;
  onRotationChange?: (rotation: Vec3) => void;
  onScaleChange?: (scale: Vec3) => void;
  /** Whether the entity is read-only (e.g., foundation entities) */
  readOnly?: boolean;
}

// ============== EDITABLE FIELD ==============

/** Map axis color class to a left-border accent class (UE5 axis style) */
const AXIS_BORDER: Record<string, string> = {
  "text-red-400": "border-l-2 border-l-red-500",
  "text-green-400": "border-l-2 border-l-green-500",
  "text-blue-400": "border-l-2 border-l-blue-500",
};

interface EditableFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  readOnly?: boolean;
  color: string;
}

function EditableField({
  label,
  value,
  onChange,
  step = 0.1,
  readOnly,
  color,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const axisBorder = AXIS_BORDER[color] ?? "";

  const startEditing = useCallback(() => {
    if (readOnly) return;
    setEditing(true);
    setEditValue(value.toFixed(2));
  }, [readOnly, value]);

  const commitEdit = useCallback(() => {
    setEditing(false);
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  }, [editValue, onChange]);

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

  // Update display when external value changes
  useEffect(() => {
    if (!editing) {
      setEditValue(value.toFixed(2));
    }
  }, [value, editing]);

  return (
    <div className="flex items-center gap-1 flex-1 min-w-0">
      <span
        className={`text-[10px] font-bold w-3 text-center cursor-ew-resize select-none ${color}`}
      >
        {label}
      </span>
      {editing ? (
        <input
          type="number"
          className={`flex-1 min-w-0 px-1.5 py-0.5 text-xs border border-primary/50 rounded-[3px] text-text-primary focus:outline-none text-right font-mono ${axisBorder}`}
          style={{
            background: "var(--input-bg)",
            boxShadow: "var(--input-shadow)",
          }}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          step={step}
          autoFocus
        />
      ) : (
        <button
          className={`flex-1 min-w-0 px-1.5 py-0.5 text-xs rounded-[3px] text-right font-mono transition-all duration-120 border ${axisBorder} ${
            readOnly
              ? "text-text-tertiary cursor-default opacity-60"
              : "text-text-primary cursor-text"
          } ease-out`}
          style={{
            background: "var(--input-bg)",
            borderColor: "var(--input-border)",
            boxShadow: "var(--input-shadow)",
          }}
          onClick={startEditing}
          disabled={readOnly}
          onMouseEnter={(e) => {
            if (!readOnly)
              (e.currentTarget as HTMLElement).style.borderColor =
                "var(--input-border-hover)";
          }}
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.borderColor =
              "var(--input-border)")
          }
        >
          {value.toFixed(2)}
        </button>
      )}
    </div>
  );
}

// ============== TRANSFORM SECTION ==============

export function TransformSection({
  position,
  rotation,
  scale,
  onPositionChange,
  onRotationChange,
  onScaleChange,
  readOnly = false,
}: TransformSectionProps) {
  const handlePosChange = useCallback(
    (axis: "x" | "y" | "z", value: number) => {
      onPositionChange?.({ ...position, [axis]: value });
    },
    [position, onPositionChange],
  );

  const handleRotChange = useCallback(
    (axis: "x" | "y" | "z", value: number) => {
      if (!rotation) return;
      onRotationChange?.({ ...rotation, [axis]: value });
    },
    [rotation, onRotationChange],
  );

  const handleScaleChange = useCallback(
    (axis: "x" | "y" | "z", value: number) => {
      if (!scale) return;
      onScaleChange?.({ ...scale, [axis]: value });
    },
    [scale, onScaleChange],
  );

  return (
    <div className="space-y-2">
      <div
        className="flex items-center justify-between -mx-3 px-3 py-1.5"
        style={{
          background: "var(--bg-tertiary)",
          borderBottom: "1px solid var(--bg-primary)",
          borderTop: "1px solid var(--surface-highlight)",
        }}
      >
        <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-[0.12em]">
          Transform
        </span>
        {readOnly && (
          <span className="text-[9px] text-text-muted uppercase tracking-[0.12em]">
            Read Only
          </span>
        )}
      </div>

      {/* Position */}
      <div className="space-y-0.5">
        <span className="text-[10px] text-text-tertiary">Position</span>
        <div className="flex gap-1">
          <EditableField
            label="X"
            value={position.x}
            onChange={(v) => handlePosChange("x", v)}
            readOnly={readOnly}
            color="text-red-400"
          />
          <EditableField
            label="Y"
            value={position.y}
            onChange={(v) => handlePosChange("y", v)}
            readOnly={readOnly}
            color="text-green-400"
          />
          <EditableField
            label="Z"
            value={position.z}
            onChange={(v) => handlePosChange("z", v)}
            readOnly={readOnly}
            color="text-blue-400"
          />
        </div>
      </div>

      {/* Rotation */}
      {rotation && (
        <div className="space-y-0.5">
          <span className="text-[10px] text-text-tertiary">Rotation</span>
          <div className="flex gap-1">
            <EditableField
              label="X"
              value={rotation.x * (180 / Math.PI)}
              onChange={(v) => handleRotChange("x", v * (Math.PI / 180))}
              step={1}
              readOnly={readOnly}
              color="text-red-400"
            />
            <EditableField
              label="Y"
              value={rotation.y * (180 / Math.PI)}
              onChange={(v) => handleRotChange("y", v * (Math.PI / 180))}
              step={1}
              readOnly={readOnly}
              color="text-green-400"
            />
            <EditableField
              label="Z"
              value={rotation.z * (180 / Math.PI)}
              onChange={(v) => handleRotChange("z", v * (Math.PI / 180))}
              step={1}
              readOnly={readOnly}
              color="text-blue-400"
            />
          </div>
        </div>
      )}

      {/* Scale */}
      {scale && (
        <div className="space-y-0.5">
          <span className="text-[10px] text-text-tertiary">Scale</span>
          <div className="flex gap-1">
            <EditableField
              label="X"
              value={scale.x}
              onChange={(v) => handleScaleChange("x", v)}
              step={0.1}
              readOnly={readOnly}
              color="text-red-400"
            />
            <EditableField
              label="Y"
              value={scale.y}
              onChange={(v) => handleScaleChange("y", v)}
              step={0.1}
              readOnly={readOnly}
              color="text-green-400"
            />
            <EditableField
              label="Z"
              value={scale.z}
              onChange={(v) => handleScaleChange("z", v)}
              step={0.1}
              readOnly={readOnly}
              color="text-blue-400"
            />
          </div>
        </div>
      )}
    </div>
  );
}
