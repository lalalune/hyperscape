/**
 * UI and Component Type Definitions
 *
 * Types for UI components, forms, and user interactions.
 */

import React from "react";

// Field types for dynamic forms
export interface Field {
  key: string;
  type: string;
  label: string;
  hint?: string;
  placeholder?: string;
  hidden?: boolean;
  when?: Array<{ op: string; key: string; value: unknown }>;
  // Type-specific properties
  dp?: number;
  min?: number;
  max?: number;
  step?: number;
  bigStep?: number;
  kind?: string;
  options?: Array<{ label: string; value: unknown }>;
  trueLabel?: string;
  falseLabel?: string;
  instant?: boolean;
  x?: string;
  y?: string;
  xRange?: number;
  yMin?: number;
  yMax?: number;
  onClick?: () => void;
  buttons?: Array<{ label: string; onClick: () => void }>;
}

// Component prop types
export interface HintContextType {
  hint: string | null;
  setHint: (hint: string | null) => void;
}

export interface PermissionsInfo {
  isAdmin: boolean;
  isBuilder: boolean;
}

// Event handler types
export type PointerEventHandler = (event: React.PointerEvent) => void;
export type ChangeEventHandler<T> = (value: T) => void;

// Option types
export interface SelectOption {
  label: string;
  value: unknown;
}
