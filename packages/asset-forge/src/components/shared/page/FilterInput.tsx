/**
 * FilterInput — search/filter input with a leading magnifier icon.
 *
 * Brand-aligned wrapper around `.input` that adds the icon + left
 * padding so the icon doesn't overlap the placeholder. Used on lists
 * that get long enough to need filtering (members, games, asset
 * library).
 */

import { Search } from "lucide-react";
import React from "react";

interface FilterInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Optional fixed width — useful inside a flex header. */
  maxWidth?: string;
}

export function FilterInput({
  value,
  onChange,
  placeholder = "Filter…",
  maxWidth,
}: FilterInputProps) {
  return (
    <div className="relative" style={maxWidth ? { maxWidth } : undefined}>
      <Search
        size={13}
        strokeWidth={1.5}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-10"
      />
    </div>
  );
}
