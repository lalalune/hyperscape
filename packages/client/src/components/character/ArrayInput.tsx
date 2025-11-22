/**
 * ArrayInput Component
 *
 * A reusable component for editing arrays of strings in character templates
 */

import React from "react";
import { Plus, X } from "lucide-react";

interface ArrayInputProps {
  label: string;
  description?: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  required?: boolean;
  maxItems?: number;
  inputType?: "text" | "textarea";
  onAdd?: (item: string) => void;
}

export const ArrayInput: React.FC<ArrayInputProps> = ({
  label,
  description,
  value,
  onChange,
  placeholder = "Enter value",
  required = false,
  maxItems,
  inputType = "text",
  onAdd,
}) => {
  const [newItem, setNewItem] = React.useState("");

  const handleAdd = () => {
    if (!newItem.trim()) return;
    if (maxItems && value.length >= maxItems) return;

    const trimmedItem = newItem.trim();
    onChange([...value, trimmedItem]);
    onAdd?.(trimmedItem);
    setNewItem("");
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleUpdate = (index: number, newValue: string) => {
    const updated = [...value];
    updated[index] = newValue;
    onChange(updated);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && inputType === "text") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[#f2d08a]/80">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {description && (
        <p className="text-xs text-[#f2d08a]/40">{description}</p>
      )}

      {/* Existing items */}
      <div className="space-y-2">
        {value.map((item, index) => (
          <div key={index} className="flex gap-2">
            {inputType === "textarea" ? (
              <textarea
                value={item}
                onChange={(e) => handleUpdate(index, e.target.value)}
                className="flex-1 bg-[#1a1005] border border-[#8b4513]/30 rounded-lg p-3 text-[#e8ebf4] focus:border-[#f2d08a] outline-none transition-colors resize-none"
                rows={2}
              />
            ) : (
              <input
                type="text"
                value={item}
                onChange={(e) => handleUpdate(index, e.target.value)}
                className="flex-1 bg-[#1a1005] border border-[#8b4513]/30 rounded-lg p-3 text-[#e8ebf4] focus:border-[#f2d08a] outline-none transition-colors"
              />
            )}
            <button
              onClick={() => handleRemove(index)}
              className="px-3 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
              title="Remove"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Add new item */}
      <div className="flex gap-2">
        {inputType === "textarea" ? (
          <textarea
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className="flex-1 bg-[#1a1005]/50 border border-[#8b4513]/20 rounded-lg p-3 text-[#e8ebf4] focus:border-[#f2d08a] outline-none transition-colors resize-none"
            rows={2}
            disabled={maxItems ? value.length >= maxItems : false}
          />
        ) : (
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className="flex-1 bg-[#1a1005]/50 border border-[#8b4513]/20 rounded-lg p-3 text-[#e8ebf4] focus:border-[#f2d08a] outline-none transition-colors"
            disabled={maxItems ? value.length >= maxItems : false}
          />
        )}
        <button
          onClick={handleAdd}
          disabled={
            !newItem.trim() || (maxItems ? value.length >= maxItems : false)
          }
          className="px-4 rounded-lg bg-[#f2d08a]/10 border border-[#f2d08a]/30 text-[#f2d08a] hover:bg-[#f2d08a]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Add item"
        >
          <Plus size={16} />
        </button>
      </div>

      {maxItems && (
        <p className="text-xs text-[#f2d08a]/40">
          {value.length} / {maxItems} items
        </p>
      )}
    </div>
  );
};
