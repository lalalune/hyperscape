/**
 * Settings Row Component
 *
 * Consistent row layout for individual settings.
 *
 * @packageDocumentation
 */

import React from "react";
import { useThemeStore } from "@/ui";

interface SettingsRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Settings row with label and control
 */
export function SettingsRow({
  label,
  description,
  children,
  className = "",
}: SettingsRowProps): React.ReactElement {
  const theme = useThemeStore((s) => s.theme);

  return (
    <div
      className={`flex items-center justify-between py-1.5 ${className}`}
      style={{ borderBottom: `1px solid ${theme.colors.border.default}20` }}
    >
      <div className="flex-1 min-w-0 mr-3">
        <div
          className="text-sm font-medium"
          style={{ color: theme.colors.text.primary }}
        >
          {label}
        </div>
        {description && (
          <div
            className="text-xs mt-0.5"
            style={{ color: theme.colors.text.muted }}
          >
            {description}
          </div>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

export default SettingsRow;
