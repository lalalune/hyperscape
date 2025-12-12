import { Settings, Zap, Package } from "lucide-react";
import React from "react";

import { cn } from "../../styles";

interface Tab {
  id: "config" | "progress" | "results";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface TabNavigationProps {
  activeView: "config" | "progress" | "results";
  generatedAssetsCount: number;
  onTabChange: (view: "config" | "progress" | "results") => void;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  activeView,
  generatedAssetsCount,
  onTabChange,
}) => {
  const tabs: Tab[] = [
    { id: "config", label: "Configuration", icon: Settings },
    { id: "progress", label: "Pipeline", icon: Zap },
    { id: "results", label: "Results", icon: Package },
  ];

  return (
    <div className="flex gap-3 p-1.5 bg-bg-secondary/50 rounded-xl border border-border-primary">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const count = tab.id === "results" ? generatedAssetsCount : 0;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2.5 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 relative group",
              activeView === tab.id
                ? "bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-primary/50",
            )}
          >
            <div
              className={cn(
                "transition-transform duration-200",
                activeView === tab.id && "scale-110",
              )}
            >
              <Icon className="w-4 h-4" />
            </div>
            <span className="hidden sm:inline">{tab.label}</span>
            {count > 0 && (
              <span
                className={cn(
                  "ml-1.5 px-2 py-0.5 text-xs rounded-full font-semibold transition-all",
                  activeView === tab.id
                    ? "bg-white/20 text-white"
                    : "bg-primary/10 text-primary",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default TabNavigation;
