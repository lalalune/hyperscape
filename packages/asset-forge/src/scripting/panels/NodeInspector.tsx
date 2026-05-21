/**
 * NodeInspector — Right sidebar for the Script Editor.
 *
 * Shows the properties of the currently selected node:
 *  - Node type and label
 *  - Port list with connection status
 *  - Field editors for node data
 *  - Per-node validation errors/warnings
 */

import * as LucideIcons from "lucide-react";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  MessageCircleReply,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import React, { useMemo } from "react";

import type { ScriptNode, PortDefinition } from "../types";
import { getNodeType, getCategoryColor } from "../nodeLibrary";
import type { FieldSchema } from "../../gameModules/GameModule";
import type { ValidationResult } from "../validation";
import { getNodeErrors, getNodeWarnings } from "../validation";
import type { ScriptEditorEntityContext } from "../../components/WorldStudio/ScriptEditorContext";

// ============== TYPES ==============

interface NodeInspectorProps {
  /** Currently selected node, or null. */
  selectedNode: ScriptNode | null;
  /** Validation result for the current graph. */
  validationResult: ValidationResult;
  /** Callback when a field value changes. */
  onFieldChange: (nodeId: string, key: string, value: unknown) => void;
  /** Domain context (e.g. NPC dialogue tree) powering dynamic field options. */
  entityContext?: ScriptEditorEntityContext;
  /**
   * Optional callback invoked when the user clicks a context-aware action
   * (e.g. "Edit Dialogue Tree" on a `trigger/onDialogueResponse` node).
   * The host panel should close the script editor so the properties panel
   * (with its DialogueEditor) regains focus on the currently-selected NPC.
   */
  onJumpToDialogue?: () => void;
}

// ============== ICON RESOLVER ==============

function resolveIcon(iconName: string): LucideIcon | null {
  return (
    (LucideIcons as unknown as Record<string, LucideIcon>)[iconName] ?? null
  );
}

// ============== PORT TYPE COLORS ==============

const DATA_TYPE_COLORS: Record<string, string> = {
  string: "#f472b6",
  number: "#5BA6FF",
  boolean: "#8B5FFF",
  entity: "#4FDD96",
  position: "#FF9933",
};

const DATA_TYPE_LABELS: Record<string, string> = {
  string: "String",
  number: "Number",
  boolean: "Boolean",
  entity: "Entity",
  position: "Position",
};

// ============== PORT ROW ==============

interface PortRowProps {
  port: PortDefinition;
  direction: "input" | "output";
}

function PortRow({ port, direction }: PortRowProps) {
  const isFlow = port.type === "flow";
  const color = isFlow
    ? "#94a3b8"
    : (DATA_TYPE_COLORS[port.dataType ?? "string"] ?? "#94a3b8");
  const typeLabel = isFlow
    ? "Flow"
    : (DATA_TYPE_LABELS[port.dataType ?? "string"] ??
      port.dataType ??
      "Unknown");

  return (
    <div
      className="flex items-center justify-between py-1 px-2 rounded"
      style={{ fontSize: 11, transition: "background 100ms" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="shrink-0"
          style={{
            width: 10,
            height: 10,
            backgroundColor: color,
            borderRadius: isFlow ? 2 : "50%",
            transform: isFlow ? "rotate(45deg)" : "none",
          }}
        />
        <span style={{ color: "var(--text-secondary)" }}>{port.label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
          {typeLabel}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
          {direction === "input" ? "\u2190" : "\u2192"}
        </span>
      </div>
    </div>
  );
}

// ============== FIELD EDITOR ==============

interface InspectorFieldProps {
  fieldKey: string;
  label: string;
  fieldType: string;
  value: unknown;
  description?: string;
  required?: boolean;
  config?: Record<string, unknown>;
  options?: Array<{ value: string; label: string }>;
  onChange: (value: unknown) => void;
}

function InspectorField({
  label,
  fieldType,
  value,
  description,
  required,
  config,
  options,
  onChange,
}: InspectorFieldProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label
          style={{
            fontSize: 11,
            color: "var(--text-secondary)",
            fontWeight: 500,
          }}
        >
          {label}
          {required && (
            <span style={{ color: "var(--color-error)", marginLeft: 2 }}>
              *
            </span>
          )}
        </label>
      </div>

      {fieldType === "boolean" ? (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            style={{ accentColor: "var(--color-primary)" }}
          />
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            {value ? "Enabled" : "Disabled"}
          </span>
        </label>
      ) : fieldType === "number" || fieldType === "slider" ? (
        <input
          type="number"
          value={(value as number) ?? ""}
          min={(config?.min as number) ?? undefined}
          max={(config?.max as number) ?? undefined}
          step={(config?.step as number) ?? 1}
          onChange={(e) =>
            onChange(e.target.value === "" ? undefined : Number(e.target.value))
          }
          className="ws-input w-full"
          style={{ fontSize: 11, fontFamily: "var(--font-sans)" }}
        />
      ) : fieldType === "select" ? (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="ws-input w-full"
          style={{ fontSize: 11, fontFamily: "var(--font-sans)" }}
        >
          <option value="">-- select --</option>
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="ws-input w-full"
          style={{ fontSize: 11, fontFamily: "var(--font-sans)" }}
        />
      )}

      {description && (
        <p
          style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.4 }}
        >
          {description}
        </p>
      )}
    </div>
  );
}

// ============== INSPECTOR COMPONENT ==============

/**
 * Compute dynamic options for fields that depend on the entity context.
 * Returns undefined if the field has no dynamic options for this context.
 */
function getDynamicFieldOptions(
  nodeType: string,
  fieldKey: string,
  entityContext: ScriptEditorEntityContext | undefined,
): Array<{ value: string; label: string }> | undefined {
  if (!entityContext) return undefined;

  // Response ID on `trigger/onDialogueResponse` — offer each response text
  // across the entity's dialogue tree so authors can pick without typing.
  if (
    nodeType === "trigger/onDialogueResponse" &&
    fieldKey === "responseId" &&
    entityContext.dialogue?.nodes
  ) {
    const options: Array<{ value: string; label: string }> = [];
    for (const node of entityContext.dialogue.nodes) {
      for (const resp of node.responses ?? []) {
        const truncated =
          resp.text.length > 40 ? resp.text.slice(0, 37) + "..." : resp.text;
        options.push({
          value: resp.text,
          label: `${node.id}: ${truncated}`,
        });
      }
    }
    return options;
  }

  return undefined;
}

export function NodeInspector({
  selectedNode,
  validationResult,
  onFieldChange,
  entityContext,
  onJumpToDialogue,
}: NodeInspectorProps) {
  const typeDef = selectedNode ? getNodeType(selectedNode.type) : null;

  const nodeErrors = useMemo(
    () =>
      selectedNode ? getNodeErrors(validationResult, selectedNode.id) : [],
    [validationResult, selectedNode],
  );

  const nodeWarnings = useMemo(
    () =>
      selectedNode ? getNodeWarnings(validationResult, selectedNode.id) : [],
    [validationResult, selectedNode],
  );

  // Group fields by section
  const fieldsBySection = useMemo(() => {
    if (!typeDef) return new Map<string, FieldSchema[]>();
    const map = new Map<string, FieldSchema[]>();
    for (const field of typeDef.fields) {
      const section = field.section ?? "General";
      if (!map.has(section)) {
        map.set(section, []);
      }
      map.get(section)!.push(field);
    }
    return map;
  }, [typeDef]);

  if (!selectedNode || !typeDef) {
    return (
      <div
        className="flex flex-col h-full"
        style={{
          background: "var(--bg-secondary)",
          borderLeft: "1px solid var(--border-primary)",
        }}
      >
        <div
          className="p-4"
          style={{ borderBottom: "1px solid var(--border-primary)" }}
        >
          <h3
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-secondary)",
            }}
          >
            Inspector
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <Info
              size={24}
              className="mx-auto mb-2"
              style={{ color: "var(--text-muted)" }}
            />
            <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              Select a node to inspect its properties
            </p>
          </div>
        </div>
      </div>
    );
  }

  const Icon = resolveIcon(typeDef.icon);
  const categoryColor = getCategoryColor(typeDef.category);

  return (
    <div
      className="flex flex-col h-full"
      style={{
        background: "var(--bg-secondary)",
        borderLeft: "1px solid var(--border-primary)",
      }}
    >
      {/* Header */}
      <div
        className="p-4"
        style={{ borderBottom: "1px solid var(--border-primary)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded flex items-center justify-center shrink-0"
            style={{ backgroundColor: categoryColor + "30" }}
          >
            {Icon && <Icon size={16} style={{ color: categoryColor }} />}
          </div>
          <div className="min-w-0">
            <h3
              className="truncate"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              {typeDef.label}
            </h3>
            <p
              className="truncate"
              style={{ fontSize: 10, color: "var(--text-tertiary)" }}
            >
              {typeDef.category} node
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto ws-panel">
        {/* Validation messages */}
        {(nodeErrors.length > 0 || nodeWarnings.length > 0) && (
          <div
            className="p-3 space-y-1.5"
            style={{ borderBottom: "1px solid var(--border-primary)" }}
          >
            {nodeErrors.map((err, i) => (
              <div
                key={`err-${i}`}
                className="flex items-start gap-2"
                style={{ fontSize: 11 }}
              >
                <AlertCircle
                  size={12}
                  className="shrink-0 mt-0.5"
                  style={{ color: "var(--color-error)" }}
                />
                <span style={{ color: "var(--color-error-light)" }}>
                  {err.message}
                </span>
              </div>
            ))}
            {nodeWarnings.map((warn, i) => (
              <div
                key={`warn-${i}`}
                className="flex items-start gap-2"
                style={{ fontSize: 11 }}
              >
                <AlertTriangle
                  size={12}
                  className="shrink-0 mt-0.5"
                  style={{ color: "var(--color-warning)" }}
                />
                <span style={{ color: "var(--color-warning-light)" }}>
                  {warn.message}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Ports */}
        <div
          className="p-3"
          style={{ borderBottom: "1px solid var(--border-primary)" }}
        >
          <h4
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 8,
            }}
          >
            Ports
          </h4>
          {selectedNode.inputs.length > 0 && (
            <div className="mb-2">
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  marginBottom: 4,
                }}
              >
                Inputs
              </div>
              {selectedNode.inputs.map((port) => (
                <PortRow key={port.id} port={port} direction="input" />
              ))}
            </div>
          )}
          {selectedNode.outputs.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  marginBottom: 4,
                }}
              >
                Outputs
              </div>
              {selectedNode.outputs.map((port) => (
                <PortRow key={port.id} port={port} direction="output" />
              ))}
            </div>
          )}
        </div>

        {/* Fields by section */}
        {Array.from(fieldsBySection.entries()).map(([section, fields]) => (
          <div
            key={section}
            className="p-3 space-y-3"
            style={{ borderBottom: "1px solid var(--border-primary)" }}
          >
            <h4
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {section}
            </h4>
            {fields.map((field) => {
              const dynamicOptions = getDynamicFieldOptions(
                selectedNode.type,
                field.key,
                entityContext,
              );
              // When we have dynamic options, render as a select regardless
              // of the field's declared type (e.g. upgrade string → select).
              const effectiveType =
                dynamicOptions && dynamicOptions.length > 0
                  ? "select"
                  : field.type;
              const staticOptions =
                (field.config?.options as Array<{
                  value: string;
                  label: string;
                }>) ?? undefined;
              return (
                <InspectorField
                  key={field.key}
                  fieldKey={field.key}
                  label={field.label}
                  fieldType={effectiveType}
                  value={selectedNode.data[field.key] ?? field.default}
                  description={field.description}
                  required={field.required}
                  config={field.config as Record<string, unknown> | undefined}
                  options={dynamicOptions ?? staticOptions}
                  onChange={(val) =>
                    onFieldChange(selectedNode.id, field.key, val)
                  }
                />
              );
            })}
          </div>
        ))}

        {/* Context-aware action: jump from a dialogue trigger to the editor */}
        {selectedNode.type === "trigger/onDialogueResponse" &&
          entityContext?.dialogue?.nodes &&
          onJumpToDialogue && (
            <div
              className="p-3"
              style={{ borderBottom: "1px solid var(--border-primary)" }}
            >
              <button
                onClick={onJumpToDialogue}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "8px 12px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 500,
                  background: "rgba(244, 114, 182, 0.12)",
                  border: "1px solid rgba(244, 114, 182, 0.3)",
                  color: "#f472b6",
                  cursor: "pointer",
                  transition: "all 150ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "rgba(244, 114, 182, 0.22)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    "rgba(244, 114, 182, 0.12)";
                }}
                title="Close this editor and return to the NPC's dialogue tree editor"
              >
                <MessageCircleReply size={12} />
                Edit Dialogue Tree
              </button>
              <p
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  marginTop: 6,
                  lineHeight: 1.4,
                }}
              >
                Jump back to the dialogue editor to add, rename, or rewire
                responses for this NPC.
              </p>
            </div>
          )}

        {/* Node ID (read-only) */}
        <div className="p-3">
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
            Node ID
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-tertiary)",
              fontFamily: "var(--font-mono)",
              marginTop: 2,
              wordBreak: "break-all",
            }}
          >
            {selectedNode.id}
          </div>
        </div>
      </div>
    </div>
  );
}
