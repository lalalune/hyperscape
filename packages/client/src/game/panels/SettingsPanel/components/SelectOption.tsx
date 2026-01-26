/**
 * Select Option Component
 *
 * Dropdown select for settings options.
 *
 * @packageDocumentation
 */

import React from "react";
import { useThemeStore } from "@/ui";

interface SelectOptionProps<T extends string> {
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
  id?: string;
  className?: string;
}

/**
 * Select dropdown for settings
 */
export function SelectOption<T extends string>({
  options,
  value,
  onChange,
  id,
  className = "",
}: SelectOptionProps<T>): React.ReactElement {
  const theme = useThemeStore((s) => s.theme);

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={`px-2 py-1 rounded text-sm cursor-pointer ${className}`}
      style={{
        backgroundColor: theme.colors.background.tertiary,
        color: theme.colors.text.primary,
        border: `1px solid ${theme.colors.border.default}`,
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export default SelectOption;
