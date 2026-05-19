/**
 * Dashboard Panel
 * tile-based-MMORPG-style unified UI with vertical tabs on the right side (desktop)
 * or horizontal tabs at the bottom (mobile)
 * Combines all panels into one interface with consistent UI
 */

import React, { useState, useEffect } from "react";
import { useThemeStore } from "@/ui";
import { getPanelHeaderStyle, getPanelSurfaceStyle } from "@/ui/theme/themes";
import type {
  ClientWorld,
  PlayerStats,
  PlayerEquipmentItems,
  InventorySlotItem,
} from "../../types";
import { AccountPanel } from "./AccountPanel";
import { CombatPanel } from "./CombatPanel";
import { SkillsPanel } from "./SkillsPanel";
import { InventoryPanel } from "./InventoryPanel";
import { EquipmentPanel } from "./EquipmentPanel";
import { SettingsPanel } from "./SettingsPanel";

type InventorySlotViewItem = Pick<
  InventorySlotItem,
  "slot" | "itemId" | "quantity"
>;

interface DashboardPanelProps {
  world: ClientWorld;
  stats: PlayerStats | null;
  equipment: PlayerEquipmentItems | null;
  inventory: InventorySlotViewItem[];
  coins: number;
  onOpenWindow?: (windowId: string) => void;
}

type TabType =
  | "account"
  | "combat"
  | "skills"
  | "inventory"
  | "equipment"
  | "settings";

interface Tab {
  id: TabType;
  icon: string;
  label: string;
  shortLabel: string;
  windowTitle: string;
}

const tabs: Tab[] = [
  {
    id: "account",
    icon: "👤",
    label: "Profile",
    shortLabel: "Prof",
    windowTitle: "Account",
  },
  {
    id: "combat",
    icon: "⚔️",
    label: "Combat",
    shortLabel: "Cmbt",
    windowTitle: "Combat",
  },
  {
    id: "skills",
    icon: "📊",
    label: "Skills",
    shortLabel: "Skll",
    windowTitle: "Skills",
  },
  {
    id: "inventory",
    icon: "🎒",
    label: "Items",
    shortLabel: "Invt",
    windowTitle: "Inventory",
  },
  {
    id: "equipment",
    icon: "🛡️",
    label: "Gear",
    shortLabel: "Gear",
    windowTitle: "Equipment",
  },
  {
    id: "settings",
    icon: "⚙️",
    label: "Config",
    shortLabel: "Cfg",
    windowTitle: "Settings",
  },
];

export function DashboardPanel({
  world,
  stats,
  equipment,
  inventory,
  coins,
  onOpenWindow,
}: DashboardPanelProps) {
  const theme = useThemeStore((s) => s.theme);
  const [activeTab, setActiveTab] = useState<TabType>("account");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const currentTab = tabs.find((t) => t.id === activeTab);

  const handlePopOut = () => {
    if (onOpenWindow && currentTab) {
      // Map tab IDs to window IDs (account -> account, inventory -> inventory, etc.)
      const windowId = currentTab.id === "settings" ? "prefs" : currentTab.id;
      onOpenWindow(windowId);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden gap-1.5">
      {/* Content Area */}
      {!isMobile ? (
        <div
          className="flex-1 flex flex-col overflow-hidden"
          style={{
            ...getPanelSurfaceStyle(theme, { emphasis: "normal" }),
            borderRadius: theme.borderRadius.lg,
            border: `1px solid ${theme.colors.accent.primary}35`,
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
            minHeight: "350px",
            minWidth: 0,
          }}
        >
          {/* Panel Header with Pop-Out Button */}
          <div
            className="flex items-center justify-between border-b px-2 py-1.5"
            style={{
              ...getPanelHeaderStyle(theme),
              borderBottom: `1px solid ${theme.colors.accent.primary}20`,
              borderTopLeftRadius: `${theme.borderRadius.lg}px`,
              borderTopRightRadius: `${theme.borderRadius.lg}px`,
            }}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-base">{currentTab?.icon}</span>
              <span
                className="font-semibold uppercase tracking-wider text-xs"
                style={{
                  color: theme.colors.accent.primary,
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
                }}
              >
                {currentTab?.windowTitle}
              </span>
            </div>
            <button
              onClick={handlePopOut}
              className="rounded transition-all duration-200 hover:scale-105 active:scale-95 px-1.5 py-1"
              style={{
                background: `linear-gradient(135deg, ${theme.colors.accent.primary}15 0%, ${theme.colors.accent.primary}08 100%)`,
                border: `1px solid ${theme.colors.accent.primary}30`,
                color: theme.colors.text.secondary,
                fontSize: "10px",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.5)",
              }}
              title={`Open ${currentTab?.windowTitle} in new window`}
            >
              <span className="flex items-center gap-0.5">
                <span>↗</span>
                <span className="text-[8px] uppercase tracking-wider">
                  Pop Out
                </span>
              </span>
            </button>
          </div>

          {/* Panel Content */}
          <div
            className="flex-1 overflow-y-auto noscrollbar p-2"
            style={{ fontSize: "1rem" }}
          >
            {activeTab === "account" && <AccountPanel world={world} />}
            {activeTab === "combat" && (
              <CombatPanel world={world} stats={stats} equipment={equipment} />
            )}
            {activeTab === "skills" && <SkillsPanel stats={stats} />}
            {activeTab === "inventory" && (
              <InventoryPanel
                items={inventory}
                coins={coins}
                world={world}
                onItemMove={(fromSlot, toSlot) => {
                  world?.network?.send?.("moveItem", { fromSlot, toSlot });
                }}
              />
            )}
            {activeTab === "equipment" && (
              <EquipmentPanel equipment={equipment} world={world} />
            )}
            {activeTab === "settings" && <SettingsPanel world={world} />}
          </div>
        </div>
      ) : (
        <div
          className="flex-1 overflow-y-auto noscrollbar"
          style={{ fontSize: "0.875rem" }}
        >
          {activeTab === "account" && <AccountPanel world={world} />}
          {activeTab === "combat" && (
            <CombatPanel world={world} stats={stats} equipment={equipment} />
          )}
          {activeTab === "skills" && <SkillsPanel stats={stats} />}
          {activeTab === "inventory" && (
            <InventoryPanel
              items={inventory}
              coins={coins}
              world={world}
              onItemMove={(fromSlot, toSlot) => {
                world?.network?.send?.("moveItem", { fromSlot, toSlot });
              }}
            />
          )}
          {activeTab === "equipment" && (
            <EquipmentPanel equipment={equipment} world={world} />
          )}
          {activeTab === "settings" && <SettingsPanel world={world} />}
        </div>
      )}

      {/* Right Side: Vertical Tabs (same on mobile and desktop) */}
      <div
        className="flex flex-col"
        style={{
          width: isMobile ? "42px" : "86px",
          minHeight: isMobile ? "160px" : "350px",
          maxHeight: isMobile ? "220px" : "none",
          gap: isMobile ? "4px" : "6px",
          padding: isMobile ? "8px 4px" : "8px",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex flex-col items-center justify-center rounded-lg transition-all duration-200 group relative overflow-hidden"
            style={{
              padding: isMobile ? "4px 2px" : "8px 6px",
              background:
                activeTab === tab.id
                  ? `linear-gradient(135deg, ${theme.colors.accent.primary}25 0%, ${theme.colors.accent.primary}15 100%)`
                  : `linear-gradient(135deg, ${theme.colors.background.panelSecondary} 0%, ${theme.colors.background.panelPrimary} 100%)`,
              border: isMobile ? "1px solid" : "2px solid",
              borderColor:
                activeTab === tab.id
                  ? `${theme.colors.accent.primary}70`
                  : `${theme.colors.accent.primary}25`,
              boxShadow:
                activeTab === tab.id
                  ? `0 0 12px ${theme.colors.accent.primary}30, 0 2px 6px rgba(0, 0, 0, 0.6), inset 0 1px 0 ${theme.colors.accent.primary}20`
                  : "0 1px 3px rgba(0, 0, 0, 0.5)",
              cursor: "pointer",
              minHeight: isMobile ? "30px" : "50px",
              gap: isMobile ? "0" : "4px",
            }}
          >
            {/* Active indicator bar on left edge */}
            {activeTab === tab.id && (
              <div
                className={`absolute left-0 top-0 bottom-0 ${isMobile ? "w-1" : "w-1.5"}`}
                style={{
                  background: `linear-gradient(180deg, ${theme.colors.accent.secondary} 0%, ${theme.colors.accent.primary} 50%, ${theme.colors.accent.hover} 100%)`,
                  boxShadow: `0 0 12px ${theme.colors.accent.secondary}80, inset 0 0 4px rgba(255, 255, 255, 0.3)`,
                }}
              />
            )}

            {/* Icon */}
            <div
              className={`transition-all duration-200 group-hover:scale-110 ${isMobile ? "text-xs" : "text-xl"}`}
              style={{
                filter:
                  activeTab === tab.id
                    ? `drop-shadow(0 2px 6px ${theme.colors.accent.primary}60)`
                    : "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8))",
              }}
            >
              {tab.icon}
            </div>

            {/* Label - Hidden on mobile */}
            {!isMobile && (
              <div
                className="text-[10px] font-bold uppercase tracking-widest leading-tight text-center"
                style={{
                  color:
                    activeTab === tab.id
                      ? theme.colors.accent.secondary
                      : theme.colors.text.secondary,
                  textShadow:
                    activeTab === tab.id
                      ? `0 1px 3px rgba(0, 0, 0, 0.9), 0 0 8px ${theme.colors.accent.secondary}40`
                      : "0 1px 2px rgba(0, 0, 0, 0.8)",
                  wordBreak: "break-word",
                  maxWidth: "100%",
                  letterSpacing: "0.08em",
                }}
              >
                {tab.label}
              </div>
            )}

            {/* Hover glow effect */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
              style={{
                background:
                  activeTab === tab.id
                    ? `radial-gradient(circle at center, ${theme.colors.accent.secondary}15 0%, transparent 70%)`
                    : `radial-gradient(circle at center, ${theme.colors.accent.primary}08 0%, transparent 70%)`,
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
