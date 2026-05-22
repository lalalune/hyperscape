import { Settings, Zap, Package } from "lucide-react";
import { type ComponentType } from "react";

interface Tab {
  id: "config" | "progress" | "results";
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
}

interface TabNavigationProps {
  activeView: "config" | "progress" | "results";
  generatedAssetsCount: number;
  onTabChange: (view: "config" | "progress" | "results") => void;
}

const TABS: Tab[] = [
  { id: "config", label: "Configure", icon: Settings },
  { id: "progress", label: "Pipeline", icon: Zap },
  { id: "results", label: "Results", icon: Package },
];

export function TabNavigation({
  activeView,
  generatedAssetsCount,
  onTabChange,
}: TabNavigationProps) {
  return (
    <div className="flex items-center gap-2" role="tablist">
      {TABS.map((tab, i) => {
        const Icon = tab.icon;
        const isActive = activeView === tab.id;
        const count = tab.id === "results" ? generatedAssetsCount : 0;
        const stepNum = String(i + 1).padStart(2, "0");

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={`group inline-flex items-center gap-2 px-3.5 py-2 rounded-md border text-[11px] uppercase tracking-[0.12em] transition-colors duration-300 ease-out ${
              isActive
                ? "bg-primary/10 border-primary/40 text-primary"
                : "bg-bg-tertiary border-border-primary text-text-secondary hover:text-primary hover:border-primary/40"
            }`}
          >
            <span
              className={`font-mono tabular-nums text-[10px] tracking-[0.05em] ${
                isActive ? "text-primary" : "text-text-tertiary"
              }`}
            >
              {stepNum}
            </span>
            <Icon size={13} strokeWidth={1.5} />
            <span className="font-medium normal-case tracking-normal text-[12px]">
              {tab.label}
            </span>
            {count > 0 && (
              <span
                className={`ml-1 px-1.5 py-0.5 text-[10px] rounded font-mono tabular-nums tracking-normal ${
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "bg-bg-primary text-text-tertiary"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default TabNavigation;
