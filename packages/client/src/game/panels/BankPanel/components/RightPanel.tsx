/**
 * RightPanel Component
 *
 * Right-side panel containing inventory grid and equipment paperdoll views.
 * RS3-style tab switcher between backpack and worn equipment.
 */

import React, { useState } from "react";
import { useThemeStore, useMobileLayout } from "@/ui";
import {
  getInteractiveTileStyle,
  getPanelHeaderStyle,
  getPanelInsetStyle,
  getPanelSurfaceStyle,
} from "@/ui/theme/themes";
import { INV_SLOTS_PER_ROW, INV_SLOT_SIZE } from "../constants";
import type { InventorySlotViewItem, RightPanelMode } from "../types";
import { InventoryPanel } from "../../InventoryPanel";
import { EquipmentPanel } from "../../EquipmentPanel";
import type { ClientWorld } from "../../../../types";

export interface RightPanelProps {
  mode: RightPanelMode;
  onChangeMode: (mode: RightPanelMode) => void;

  // Inventory data
  inventory: InventorySlotViewItem[];
  coins: number;
  world?: ClientWorld;

  // Equipment data
  equipment?: import("@hyperforge/shared").PlayerEquipmentItems | null;

  // Inventory actions
  onDeposit: (itemId: string, quantity: number) => void;
  onDepositAll: () => void;
  onOpenCoinModal: (action: "deposit" | "withdraw") => void;
  onContextMenu: (
    e: React.MouseEvent,
    itemId: string,
    quantity: number,
    type: "bank" | "inventory",
    tabIndex?: number,
    slot?: number,
  ) => void;

  // Equipment actions
  onDepositEquipment: (slot: string) => void;
  onDepositAllEquipment: () => void;
}

export function RightPanel({
  mode,
  onChangeMode,
  inventory,
  coins,
  equipment,
  world,
  onDeposit,
  onDepositAll,
  onOpenCoinModal,
  onContextMenu,
  onDepositEquipment,
  onDepositAllEquipment,
}: RightPanelProps) {
  const theme = useThemeStore((s) => s.theme);
  const { shouldUseMobileUI } = useMobileLayout();
  const [hoveredModeButton, setHoveredModeButton] =
    useState<RightPanelMode | null>(null);
  const [isDepositCoinsHovered, setIsDepositCoinsHovered] = useState(false);
  const [isDepositInventoryHovered, setIsDepositInventoryHovered] =
    useState(false);
  const [isDepositEquipmentHovered, setIsDepositEquipmentHovered] =
    useState(false);

  // Responsive sizing
  const responsiveSlotSize = shouldUseMobileUI ? 34 : INV_SLOT_SIZE;
  const inventoryPanelWidth = Math.max(
    INV_SLOTS_PER_ROW * (responsiveSlotSize + 4) + 24,
    248,
  );
  const desktopPanelWidth = inventoryPanelWidth;
  return (
    <div
      className="flex flex-col rounded-lg"
      style={{
        ...getPanelSurfaceStyle(theme, { emphasis: "strong" }),
        boxShadow: `${theme.shadows.xl}, inset 0 1px 0 rgba(255,248,236,0.06), inset 0 -14px 22px rgba(0,0,0,0.1)`,
        width: shouldUseMobileUI ? "100%" : `${desktopPanelWidth}px`,
        minWidth: shouldUseMobileUI ? undefined : `${desktopPanelWidth}px`,
      }}
    >
      {/* RS3-style Tab Header with view switcher */}
      <div
        className="flex justify-between items-center px-2 py-1.5 rounded-t-lg"
        style={{
          ...getPanelHeaderStyle(theme),
          borderBottom: `1px solid ${theme.colors.border.decorative}`,
        }}
      >
        {/* Tab Buttons */}
        <div className="flex gap-1">
          <button
            onClick={() => onChangeMode("inventory")}
            className="px-2 py-1 rounded text-xs font-bold transition-all"
            style={{
              background:
                mode === "inventory"
                  ? String(
                      getInteractiveTileStyle(theme, {
                        active: true,
                        radius: theme.borderRadius.sm,
                      }).background,
                    )
                  : hoveredModeButton === "inventory"
                    ? String(
                        getInteractiveTileStyle(theme, {
                          hovered: true,
                          radius: theme.borderRadius.sm,
                        }).background,
                      )
                    : String(
                        getPanelInsetStyle(theme, {
                          radius: theme.borderRadius.sm,
                        }).background,
                      ),
              color:
                mode === "inventory"
                  ? theme.colors.accent.primary
                  : hoveredModeButton === "inventory"
                    ? theme.colors.text.primary
                    : theme.colors.text.secondary,
              border:
                mode === "inventory"
                  ? `1px solid ${theme.colors.accent.primary}50`
                  : hoveredModeButton === "inventory"
                    ? `1px solid ${theme.colors.border.hover}`
                    : `1px solid ${theme.colors.border.default}50`,
            }}
            onMouseEnter={() => setHoveredModeButton("inventory")}
            onMouseLeave={() =>
              setHoveredModeButton((prev) =>
                prev === "inventory" ? null : prev,
              )
            }
            title="View Backpack"
          >
            🎒
          </button>
          <button
            onClick={() => onChangeMode("equipment")}
            className="px-2 py-1 rounded text-xs font-bold transition-all"
            style={{
              background:
                mode === "equipment"
                  ? String(
                      getInteractiveTileStyle(theme, {
                        active: true,
                        radius: theme.borderRadius.sm,
                      }).background,
                    )
                  : hoveredModeButton === "equipment"
                    ? String(
                        getInteractiveTileStyle(theme, {
                          hovered: true,
                          radius: theme.borderRadius.sm,
                        }).background,
                      )
                    : String(
                        getPanelInsetStyle(theme, {
                          radius: theme.borderRadius.sm,
                        }).background,
                      ),
              color:
                mode === "equipment"
                  ? theme.colors.accent.primary
                  : hoveredModeButton === "equipment"
                    ? theme.colors.text.primary
                    : theme.colors.text.secondary,
              border:
                mode === "equipment"
                  ? `1px solid ${theme.colors.accent.primary}50`
                  : hoveredModeButton === "equipment"
                    ? `1px solid ${theme.colors.border.hover}`
                    : `1px solid ${theme.colors.border.default}50`,
            }}
            onMouseEnter={() => setHoveredModeButton("equipment")}
            onMouseLeave={() =>
              setHoveredModeButton((prev) =>
                prev === "equipment" ? null : prev,
              )
            }
            title="View Worn Equipment"
          >
            ⚔️
          </button>
        </div>
        <span
          className="text-xs font-bold"
          style={{ color: theme.colors.accent.primary }}
        >
          {mode === "inventory" ? "Inventory" : "Equipment"}
        </span>
      </div>

      {/* Content Area - keep both views mounted so the paperdoll preview stays warm across tab switches */}
      <div
        className="relative flex-1"
        style={{ minHeight: shouldUseMobileUI ? "200px" : "360px" }}
      >
        <div
          className="absolute inset-0 flex flex-col"
          style={{
            opacity: mode === "inventory" ? 1 : 0,
            pointerEvents: mode === "inventory" ? "auto" : "none",
            visibility: mode === "inventory" ? "visible" : "hidden",
          }}
        >
          {/* Modern Inventory Panel in bank mode */}
          <div
            className="flex-1"
            style={{ minHeight: shouldUseMobileUI ? "200px" : "280px" }}
          >
            <InventoryPanel
              items={inventory}
              coins={coins}
              embeddedMode="bank"
              onEmbeddedClick={(item) => onDeposit(item.itemId, 1)}
              onEmbeddedContextMenu={(e, item) =>
                onContextMenu(e, item.itemId, item.quantity || 1, "inventory")
              }
              showCoinPouch={false}
              footerHint="Left: Deposit 1 | Right: Options"
            />
          </div>

          {/* Coin Pouch Section */}
          <div
            className="mx-2 mb-2 p-2 rounded flex items-center justify-between"
            style={{
              ...getPanelInsetStyle(theme, {
                emphasis: "normal",
                radius: theme.borderRadius.md,
                padding: 0,
              }),
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">💰</span>
              <span
                className="text-sm font-bold"
                style={{ color: theme.colors.accent.primary }}
              >
                {coins.toLocaleString()}
              </span>
            </div>
            <button
              onClick={() => onOpenCoinModal("deposit")}
              disabled={coins <= 0}
              className="px-2 py-1 rounded text-xs font-bold transition-colors disabled:opacity-30"
              style={{
                ...getInteractiveTileStyle(theme, {
                  active: !isDepositCoinsHovered,
                  hovered: isDepositCoinsHovered,
                  accentColor: theme.colors.state.success,
                  radius: theme.borderRadius.sm,
                }),
                color: theme.colors.text.primary,
              }}
              onMouseEnter={() => setIsDepositCoinsHovered(true)}
              onMouseLeave={() => setIsDepositCoinsHovered(false)}
            >
              Deposit
            </button>
          </div>

          {/* Deposit All Button */}
          <div className="px-2 pb-2">
            <button
              onClick={onDepositAll}
              className="w-full py-2 rounded text-sm font-bold transition-colors"
              style={{
                ...getInteractiveTileStyle(theme, {
                  active: !isDepositInventoryHovered,
                  hovered: isDepositInventoryHovered,
                  accentColor: theme.colors.accent.primary,
                  radius: theme.borderRadius.md,
                }),
                color: theme.colors.accent.primary,
              }}
              onMouseEnter={() => setIsDepositInventoryHovered(true)}
              onMouseLeave={() => setIsDepositInventoryHovered(false)}
            >
              Deposit Inventory
            </button>
          </div>
        </div>

        <div
          className="absolute inset-0 flex flex-col"
          style={{
            opacity: mode === "equipment" ? 1 : 0,
            pointerEvents: mode === "equipment" ? "auto" : "none",
            visibility: mode === "equipment" ? "visible" : "hidden",
          }}
        >
          {/* Shared EquipmentPanel with bank-specific deposit actions */}
          <div
            className="p-2 flex-1 overflow-hidden"
            style={{
              ...getPanelInsetStyle(theme, {
                emphasis: "strong",
                radius: theme.borderRadius.md,
                padding: 0,
              }),
              borderRadius: "4px",
              margin: "4px",
            }}
          >
            <EquipmentPanel
              equipment={equipment ?? null}
              world={world}
              slotActionLabel="Deposit"
              onSlotAction={onDepositEquipment}
              footerButtons={[]}
              showBonuses={true}
              layoutVariant="bank"
              isVisible={mode === "equipment"}
            />
          </div>

          {/* Deposit All Equipment Button */}
          <div className="px-2 pb-2">
            <button
              onClick={onDepositAllEquipment}
              disabled={
                !equipment || Object.values(equipment).every((item) => !item)
              }
              className="w-full py-2 rounded text-sm font-bold transition-colors disabled:opacity-30"
              style={{
                ...getInteractiveTileStyle(theme, {
                  active: !isDepositEquipmentHovered,
                  hovered: isDepositEquipmentHovered,
                  accentColor: theme.colors.accent.primary,
                  radius: theme.borderRadius.md,
                }),
                color: theme.colors.accent.primary,
              }}
              onMouseEnter={() => setIsDepositEquipmentHovered(true)}
              onMouseLeave={() => setIsDepositEquipmentHovered(false)}
            >
              Deposit Worn Items
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
