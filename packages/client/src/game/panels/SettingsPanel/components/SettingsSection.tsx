/**
 * Settings Section Component
 *
 * Reusable section wrapper for grouping related settings.
 *
 * @packageDocumentation
 */

import React from "react";
import { useThemeStore } from "@/ui";

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Settings section with title
 */
export function SettingsSection({
  title,
  children,
  className = "",
}: SettingsSectionProps): React.ReactElement {
  const theme = useThemeStore((s) => s.theme);

  return (
    <div className={className}>
      <div
        className="text-xs font-medium mb-1.5 uppercase tracking-wider"
        style={{ color: theme.colors.text.muted }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

export default SettingsSection;
