/**
 * SchemaPropertyEditor — Auto-generates a property editor from an EntityTypeSchema.
 *
 * Groups fields by section, handles conditional visibility, and dispatches
 * generic ENTITY_UPDATE actions via the World Studio context.
 */

import { Workflow } from "lucide-react";
import React, { useCallback } from "react";
import type {
  EntityTypeSchema,
  FieldSchema,
  CustomSectionSchema,
} from "../GameModule";
import { getCustomSection } from "./customSectionRegistry";
import {
  PropertySection,
  TextInput,
  NumberInput,
  SliderInput,
  SelectInput,
  PositionEditor,
  Toggle,
  InfoRow,
  ColorInput,
  TagsInput,
  JsonInput,
  Vector3Input,
  MultiSelectInput,
  ManifestRefInput,
  QuaternionInput,
  KeybindingInput,
  CurveInput,
  ColorRampInput,
  AssetRefInput,
  type CurvePoint,
  type ColorRampStop,
  type AssetKind,
} from "../../components/WorldStudio/panels/properties/PropertyControls";
import { useWorldStudio } from "../../components/WorldStudio/WorldStudioContext";
import { useOpenScriptEditor } from "../../components/WorldStudio/ScriptEditorContext";
import type { ScriptGraph } from "../../scripting/types";

interface SchemaPropertyEditorProps {
  schema: EntityTypeSchema;
  entityId: string;
  entityData: Record<string, unknown>;
}

export function SchemaPropertyEditor({
  schema,
  entityId,
  entityData,
}: SchemaPropertyEditorProps) {
  const { dispatch } = useWorldStudio();
  const openScriptEditor = useOpenScriptEditor();

  const handleChange = useCallback(
    (key: string, value: unknown) => {
      dispatch({
        type: "ENTITY_UPDATE",
        stateKey: schema.storage.stateKey,
        stateRoot: schema.storage.stateRoot,
        id: entityId,
        updates: { [key]: value },
        trackSource: schema.tracksSource,
      });
    },
    [
      dispatch,
      schema.storage.stateKey,
      schema.storage.stateRoot,
      schema.tracksSource,
      entityId,
    ],
  );

  // Group fields by section, filtering by visibility conditions
  const sections = new Map<string, FieldSchema[]>();
  for (const field of schema.fields) {
    if (field.visibleWhen) {
      const gate = entityData[field.visibleWhen.field];
      if (
        field.visibleWhen.equals !== undefined &&
        gate !== field.visibleWhen.equals
      ) {
        continue;
      }
      if (
        field.visibleWhen.notEquals !== undefined &&
        gate === field.visibleWhen.notEquals
      ) {
        continue;
      }
    }
    const arr = sections.get(field.section);
    if (arr) {
      arr.push(field);
    } else {
      sections.set(field.section, [field]);
    }
  }

  // Filter customSections by visibility
  const customSections: CustomSectionSchema[] = (
    schema.customSections ?? []
  ).filter((cs) => {
    if (!cs.visibleWhen) return true;
    const gate = entityData[cs.visibleWhen.field];
    if (cs.visibleWhen.equals !== undefined && gate !== cs.visibleWhen.equals)
      return false;
    if (
      cs.visibleWhen.notEquals !== undefined &&
      gate === cs.visibleWhen.notEquals
    )
      return false;
    return true;
  });

  return (
    <>
      {Array.from(sections.entries()).map(([sectionName, fields]) => (
        <PropertySection key={sectionName} title={sectionName}>
          {fields.map((field) => (
            <SchemaField
              key={field.key}
              field={field}
              value={entityData[field.key]}
              onChange={(v: unknown) => handleChange(field.key, v)}
              onOpenScriptEditor={
                field.type === "scriptGraph" && openScriptEditor
                  ? (fk, graph) =>
                      openScriptEditor(
                        entityId,
                        schema.storage.stateKey,
                        schema.storage.stateRoot ?? "extendedLayers",
                        schema.tracksSource,
                        fk,
                        graph,
                      )
                  : undefined
              }
            />
          ))}
        </PropertySection>
      ))}
      {customSections.map((cs) => {
        const Widget = getCustomSection(cs.widgetId);
        if (!Widget) {
          return (
            <PropertySection key={cs.widgetId} title={cs.title}>
              <InfoRow
                label="Missing widget"
                value={`"${cs.widgetId}" not registered`}
              />
            </PropertySection>
          );
        }
        return (
          <PropertySection
            key={cs.widgetId}
            title={cs.title}
            defaultOpen={cs.defaultOpen}
          >
            <Widget entityId={entityId} entityData={entityData} />
          </PropertySection>
        );
      })}
    </>
  );
}

// ============== FIELD RENDERER ==============

interface SchemaFieldProps {
  field: FieldSchema;
  value: unknown;
  onChange: (v: unknown) => void;
  onOpenScriptEditor?: (
    fieldKey: string,
    graph: ScriptGraph | undefined,
  ) => void;
}

function SchemaField({
  field,
  value,
  onChange,
  onOpenScriptEditor,
}: SchemaFieldProps) {
  if (field.readOnly) {
    return <InfoRow label={field.label} value={String(value ?? "")} />;
  }

  switch (field.type) {
    case "scriptGraph": {
      const graph = value as ScriptGraph | undefined;
      const nodeCount = graph?.nodes?.length ?? 0;
      return (
        <div className="space-y-1">
          <label className="text-[11px] text-text-secondary font-medium">
            {field.label}
          </label>
          <button
            onClick={() => onOpenScriptEditor?.(field.key, graph)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 hover:border-indigo-500/50 transition-colors"
          >
            <Workflow size={14} />
            {nodeCount > 0
              ? `Edit Script (${nodeCount} node${nodeCount !== 1 ? "s" : ""})`
              : "Create Script"}
          </button>
          {field.description && (
            <p className="text-[10px] text-text-tertiary">
              {field.description}
            </p>
          )}
        </div>
      );
    }

    case "string":
    case "entityId":
      return (
        <TextInput
          label={field.label}
          value={String(value ?? "")}
          onChange={onChange as (v: string) => void}
        />
      );

    case "number":
      return (
        <NumberInput
          label={field.label}
          value={Number(value ?? field.default ?? 0)}
          onChange={onChange as (v: number) => void}
          min={field.config?.min}
          max={field.config?.max}
          step={field.config?.step}
          unit={field.config?.unit}
        />
      );

    case "slider":
      return (
        <SliderInput
          label={field.label}
          value={Number(value ?? field.default ?? 0)}
          onChange={onChange as (v: number) => void}
          min={field.config?.min ?? 0}
          max={field.config?.max ?? 100}
          step={field.config?.step ?? 1}
          unit={field.config?.unit}
          hint={field.description}
        />
      );

    case "boolean":
      return (
        <Toggle
          label={field.label}
          value={Boolean(value)}
          onChange={onChange as (v: boolean) => void}
        />
      );

    case "select":
      return (
        <SelectInput
          label={field.label}
          value={String(value ?? "")}
          onChange={onChange as (v: string) => void}
          options={field.config?.options ?? []}
        />
      );

    case "position":
      return (
        <PositionEditor
          label={field.label}
          position={
            (value as { x: number; y: number; z: number }) ?? {
              x: 0,
              y: 0,
              z: 0,
            }
          }
          onChange={
            onChange as (v: { x: number; y: number; z: number }) => void
          }
        />
      );

    case "rotation": {
      const deg = Math.round(((Number(value) || 0) * 180) / Math.PI);
      return (
        <SliderInput
          label={field.label}
          value={deg}
          onChange={(d: number) => onChange((d * Math.PI) / 180)}
          min={0}
          max={360}
          step={field.config?.step ?? 15}
          unit={field.config?.unit ?? "deg"}
        />
      );
    }

    case "vector3": {
      const v = (value as { x: number; y: number; z: number } | undefined) ?? {
        x: 0,
        y: 0,
        z: 0,
      };
      return (
        <Vector3Input
          label={field.label}
          value={v}
          onChange={
            onChange as (v: { x: number; y: number; z: number }) => void
          }
          step={field.config?.step}
          unit={field.config?.unit}
        />
      );
    }

    case "color":
      return (
        <ColorInput
          label={field.label}
          value={typeof value === "string" ? value : "#0B0B0D"}
          onChange={onChange as (v: string) => void}
        />
      );

    case "tags":
      return (
        <TagsInput
          label={field.label}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange as (v: string[]) => void}
          sorted={field.config?.sorted}
        />
      );

    case "json":
      return (
        <JsonInput label={field.label} value={value} onChange={onChange} />
      );

    case "multi-select":
      return (
        <MultiSelectInput
          label={field.label}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange as (v: string[]) => void}
          options={field.config?.options ?? []}
          sorted={field.config?.sorted}
        />
      );

    case "manifest-ref": {
      const kind = field.config?.manifestRef;
      if (!kind) {
        return (
          <InfoRow
            label={field.label}
            value={`${String(value ?? "")} (config.manifestRef missing)`}
          />
        );
      }
      return (
        <ManifestRefInput
          label={field.label}
          value={String(value ?? "")}
          onChange={onChange as (v: string) => void}
          manifestKind={kind}
          description={field.description}
        />
      );
    }

    // Widget types declared in FieldType but not yet implemented render as a
    // read-only InfoRow so the panel still shows the raw value. Implement
    // dedicated widgets as they're needed by migrated panels.
    case "quaternion": {
      const q = (value as
        | { x: number; y: number; z: number; w: number }
        | undefined) ?? { x: 0, y: 0, z: 0, w: 1 };
      return (
        <QuaternionInput
          label={field.label}
          value={q}
          onChange={
            onChange as (v: {
              x: number;
              y: number;
              z: number;
              w: number;
            }) => void
          }
          step={field.config?.step}
        />
      );
    }

    case "keybinding":
      return (
        <KeybindingInput
          label={field.label}
          value={typeof value === "string" ? value : ""}
          onChange={onChange as (v: string) => void}
          description={field.description}
        />
      );

    case "curve":
      return (
        <CurveInput
          label={field.label}
          value={Array.isArray(value) ? (value as CurvePoint[]) : []}
          onChange={onChange as (v: CurvePoint[]) => void}
          xRange={
            field.config?.min !== undefined && field.config?.max !== undefined
              ? [field.config.min, field.config.max]
              : undefined
          }
          description={field.description}
        />
      );

    case "color-ramp":
      return (
        <ColorRampInput
          label={field.label}
          value={Array.isArray(value) ? (value as ColorRampStop[]) : []}
          onChange={onChange as (v: ColorRampStop[]) => void}
          description={field.description}
        />
      );

    case "asset-ref": {
      const rawKind = field.config?.assetType;
      const allowedKinds: AssetKind[] = [
        "model",
        "texture",
        "audio",
        "hdri",
        "animation",
        "other",
      ];
      const assetKind: AssetKind | undefined =
        rawKind && (allowedKinds as string[]).includes(rawKind)
          ? (rawKind as AssetKind)
          : undefined;
      return (
        <AssetRefInput
          label={field.label}
          value={typeof value === "string" ? value : ""}
          onChange={onChange as (v: string) => void}
          assetKind={assetKind}
          description={field.description}
        />
      );
    }

    default:
      return <InfoRow label={field.label} value={String(value ?? "")} />;
  }
}
