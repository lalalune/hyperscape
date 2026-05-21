/**
 * BaseNode — Shared node chrome for all scripting node types.
 *
 * Layout (UE5 Blueprint-style):
 *  - Colored header with icon + label
 *  - Flow ports (In/Out) on a single row directly below the header
 *  - Data ports in two columns: inputs left, outputs right
 *  - Handles sit exactly on the node border edge
 *  - Expandable field editors at the bottom
 *  - Selection glow ring
 */

import { Handle, Position, type NodeProps } from "@xyflow/react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import React, { useState, useCallback } from "react";

import type { PortDefinition } from "../types";
import { getNodeType } from "../nodeLibrary";

// ============== TYPES ==============

/** Data payload stored on each React Flow node. */
export interface BaseNodeData extends Record<string, unknown> {
  scriptType: string;
  fieldValues: Record<string, unknown>;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  onFieldChange?: (nodeId: string, key: string, value: unknown) => void;
}

// ============== PORT COLORS ==============

const DATA_TYPE_COLORS: Record<string, string> = {
  string: "#f472b6",
  number: "#5BA6FF",
  boolean: "#8B5FFF",
  entity: "#4FDD96",
  position: "#FF9933",
};

const FLOW_COLOR = "#cbd5e1";

function portColor(port: PortDefinition): string {
  if (port.type === "flow") return FLOW_COLOR;
  return DATA_TYPE_COLORS[port.dataType ?? "string"] ?? "#94a3b8";
}

// ============== ICON RESOLVER ==============

function resolveIcon(name: string): LucideIcon | null {
  return (LucideIcons as unknown as Record<string, LucideIcon>)[name] ?? null;
}

// ============== INLINE PORT + HANDLE ==============

/** A single port row with the React Flow Handle sitting on the node edge. */
function PortRow({
  port,
  side,
}: {
  port: PortDefinition;
  side: "left" | "right";
}) {
  const color = portColor(port);
  const isFlow = port.type === "flow";
  const handleSize = isFlow ? 11 : 9;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: side === "left" ? "flex-start" : "flex-end",
        padding: "3px 10px",
        gap: 6,
        minHeight: 22,
      }}
    >
      {/* The actual React Flow handle — positioned on the border */}
      <Handle
        type={side === "left" ? "target" : "source"}
        position={side === "left" ? Position.Left : Position.Right}
        id={port.id}
        style={{
          position: "absolute",
          [side]: -handleSize / 2,
          top: "50%",
          transform: `translateY(-50%)${isFlow ? " rotate(45deg)" : ""}`,
          width: handleSize,
          height: handleSize,
          background: color,
          border: `2px solid color-mix(in srgb, ${color} 70%, black)`,
          borderRadius: isFlow ? 2 : "50%",
          cursor: "crosshair",
        }}
      />

      {/* Port color dot (visual only, inside the node) */}
      {side === "left" && (
        <>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: isFlow ? 1 : "50%",
              background: color,
              flexShrink: 0,
              transform: isFlow ? "rotate(45deg)" : "none",
            }}
          />
          <span
            style={{
              fontSize: 10,
              color: "var(--text-secondary)",
              userSelect: "none",
            }}
          >
            {port.label}
          </span>
        </>
      )}
      {side === "right" && (
        <>
          <span
            style={{
              fontSize: 10,
              color: "var(--text-secondary)",
              userSelect: "none",
            }}
          >
            {port.label}
          </span>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: isFlow ? 1 : "50%",
              background: color,
              flexShrink: 0,
              transform: isFlow ? "rotate(45deg)" : "none",
            }}
          />
        </>
      )}
    </div>
  );
}

// ============== FIELD EDITOR ==============

interface FieldEditorProps {
  fieldKey: string;
  label: string;
  fieldType: string;
  value: unknown;
  config?: Record<string, unknown>;
  options?: Array<{ value: string; label: string }>;
  onChange: (value: unknown) => void;
}

function FieldEditor({
  fieldKey,
  label,
  fieldType,
  value,
  config,
  options,
  onChange,
}: FieldEditorProps) {
  switch (fieldType) {
    case "boolean":
      return (
        <label
          className="flex items-center gap-2 cursor-pointer"
          style={{ fontSize: 10, color: "var(--text-secondary)" }}
        >
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            style={{ accentColor: "var(--color-primary)" }}
          />
          {label}
        </label>
      );
    case "number":
    case "slider": {
      const min = (config?.min as number) ?? undefined;
      const max = (config?.max as number) ?? undefined;
      const step = (config?.step as number) ?? 1;
      const unit = (config?.unit as string) ?? "";
      return (
        <div className="flex items-center gap-1">
          <span
            className="shrink-0"
            style={{ fontSize: 10, color: "var(--text-tertiary)", width: 48 }}
          >
            {label}
          </span>
          <input
            type="number"
            value={(value as number) ?? ""}
            min={min}
            max={max}
            step={step}
            onChange={(e) =>
              onChange(
                e.target.value === "" ? undefined : Number(e.target.value),
              )
            }
            className="ws-input flex-1"
            style={{ fontSize: 10, padding: "2px 5px" }}
          />
          {unit && (
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
              {unit}
            </span>
          )}
        </div>
      );
    }
    case "select":
      return (
        <div className="flex items-center gap-1">
          <span
            className="shrink-0"
            style={{ fontSize: 10, color: "var(--text-tertiary)", width: 48 }}
          >
            {label}
          </span>
          <select
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="ws-input flex-1"
            style={{ fontSize: 10, padding: "2px 5px" }}
          >
            <option value="">--</option>
            {options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    default:
      return (
        <div className="flex items-center gap-1">
          <span
            className="shrink-0"
            style={{ fontSize: 10, color: "var(--text-tertiary)", width: 48 }}
          >
            {label}
          </span>
          <input
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={fieldKey}
            className="ws-input flex-1"
            style={{ fontSize: 10, padding: "2px 5px" }}
          />
        </div>
      );
  }
}

// ============== BASE NODE COMPONENT ==============

export function BaseNode({ id, data, selected }: NodeProps) {
  const nodeData = data as BaseNodeData;
  const typeDef = getNodeType(nodeData.scriptType);
  const [expanded, setExpanded] = useState(true);

  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      nodeData.onFieldChange?.(id, key, value);
    },
    [id, nodeData],
  );

  if (!typeDef) {
    return (
      <div
        style={{
          background: "rgba(239,68,68,0.15)",
          border: "1px solid var(--color-error)",
          borderRadius: 8,
          padding: 10,
          fontSize: 11,
          color: "var(--color-error-light)",
        }}
      >
        Unknown: {nodeData.scriptType}
      </div>
    );
  }

  const Icon = resolveIcon(typeDef.icon);
  const inputs = nodeData.inputs ?? typeDef.inputs;
  const outputs = nodeData.outputs ?? typeDef.outputs;
  const fields = typeDef.fields;
  const hasFields = fields.length > 0;

  // Separate flow vs data ports
  const flowInputs = inputs.filter((p) => p.type === "flow");
  const flowOutputs = outputs.filter((p) => p.type === "flow");
  const dataInputs = inputs.filter((p) => p.type !== "flow");
  const dataOutputs = outputs.filter((p) => p.type !== "flow");
  const maxDataPorts = Math.max(dataInputs.length, dataOutputs.length);

  return (
    <div
      style={{
        minWidth: 190,
        borderRadius: 8,
        background: "var(--bg-secondary)",
        border: selected
          ? "1.5px solid var(--color-primary)"
          : "1px solid var(--border-secondary)",
        boxShadow: selected
          ? "0 0 0 2px rgba(99,102,241,0.25), 0 8px 24px rgba(0,0,0,0.5)"
          : "0 4px 16px rgba(0,0,0,0.4)",
        transition: "border-color 150ms, box-shadow 150ms",
        overflow: "visible",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "6px 10px",
          borderRadius: "7px 7px 0 0",
          background: typeDef.color,
          cursor: "grab",
        }}
      >
        {Icon && (
          <Icon
            size={13}
            style={{ color: "white", flexShrink: 0, opacity: 0.9 }}
          />
        )}
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "white",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {typeDef.label}
        </span>
      </div>

      {/* ── Flow ports row (execution In / Out) ── */}
      {(flowInputs.length > 0 || flowOutputs.length > 0) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid var(--border-primary)",
            minHeight: 26,
          }}
        >
          <div>
            {flowInputs.map((p) => (
              <PortRow key={p.id} port={p} side="left" />
            ))}
          </div>
          <div>
            {flowOutputs.map((p) => (
              <PortRow key={p.id} port={p} side="right" />
            ))}
          </div>
        </div>
      )}

      {/* ── Data ports — two-column layout ── */}
      {maxDataPorts > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "2px 0",
          }}
        >
          {/* Left column: inputs */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {dataInputs.map((p) => (
              <PortRow key={p.id} port={p} side="left" />
            ))}
          </div>
          {/* Right column: outputs */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {dataOutputs.map((p) => (
              <PortRow key={p.id} port={p} side="right" />
            ))}
          </div>
        </div>
      )}

      {/* ── Fields ── */}
      {hasFields && (
        <div style={{ borderTop: "1px solid var(--border-primary)" }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 10px",
              fontSize: 10,
              color: "var(--text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              transition: "color 120ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <span
              style={{
                fontWeight: 500,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
              }}
            >
              Fields
            </span>
            <span style={{ fontSize: 8 }}>{expanded ? "▲" : "▼"}</span>
          </button>
          {expanded && (
            <div
              style={{
                padding: "0 10px 8px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {fields.map((f) => (
                <FieldEditor
                  key={f.key}
                  fieldKey={f.key}
                  label={f.label}
                  fieldType={f.type}
                  value={nodeData.fieldValues?.[f.key] ?? f.default}
                  config={f.config as Record<string, unknown> | undefined}
                  options={
                    (f.config?.options as Array<{
                      value: string;
                      label: string;
                    }>) ?? undefined
                  }
                  onChange={(val) => handleFieldChange(f.key, val)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** React Flow nodeTypes registration object — all categories use BaseNode. */
export const baseNodeTypes = {
  scriptNode: BaseNode,
};
