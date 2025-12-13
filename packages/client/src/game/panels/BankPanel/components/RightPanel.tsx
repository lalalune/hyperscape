/**
 * RightPanel Component
 *
 * Right-side panel containing inventory grid and equipment paperdoll views.
 * RS3-style tab switcher between backpack and worn equipment.
 */

import React, { useCallback, useMemo } from "react";
import type { PlayerEquipmentItems } from "@hyperscape/shared";
import {
  INV_SLOTS_PER_ROW,
  INV_ROWS,
  INV_SLOT_SIZE,
  BANK_THEME,
} from "../constants";
import { isNotedItem, getItemIcon, formatItemName } from "../utils";
import type { InventorySlotViewItem, RightPanelMode } from "../types";

// Pre-allocated slot indices array - created once at module load, never recreated
const INVENTORY_SLOT_INDICES = Array.from(
  { length: INV_SLOTS_PER_ROW * INV_ROWS },
  (_, i) => i,
);

export interface RightPanelProps {
  mode: RightPanelMode;
  onChangeMode: (mode: RightPanelMode) => void;

  // Inventory data
  inventory: InventorySlotViewItem[];
  coins: number;

  // Equipment data
  equipment?: PlayerEquipmentItems | null;

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
  onDeposit,
  onDepositAll,
  onOpenCoinModal,
  onContextMenu,
  onDepositEquipment,
  onDepositAllEquipment,
}: RightPanelProps) {
  // O(1) lookup map - only rebuilt when inventory changes
  const inventoryBySlot = useMemo(() => {
    const map = new Map<number, InventorySlotViewItem>();
    for (const item of inventory) {
      if (item) {
        map.set(item.slot, item);
      }
    }
    return map;
  }, [inventory]);

  /**
   * Render a single equipment slot for the paperdoll layout
   */
  const renderEquipmentSlot = useCallback(
    (key: string, label: string, icon: string) => {
      const item = equipment?.[key as keyof PlayerEquipmentItems] ?? null;
      const hasItem = !!item;

      return (
        <button
          key={key}
          onClick={() => hasItem && onDepositEquipment(key)}
          className="w-full h-full rounded transition-all duration-200 cursor-pointer group relative"
          style={{
            background: hasItem
              ? "linear-gradient(135deg, rgba(40, 35, 50, 0.8) 0%, rgba(30, 25, 40, 0.9) 100%)"
              : "rgba(0, 0, 0, 0.35)",
            borderWidth: "2px",
            borderStyle: "solid",
            borderColor: hasItem
              ? "rgba(242, 208, 138, 0.5)"
              : "rgba(242, 208, 138, 0.25)",
            boxShadow: hasItem
              ? "0 2px 8px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(242, 208, 138, 0.1)"
              : "inset 0 2px 4px rgba(0, 0, 0, 0.3)",
          }}
          onMouseEnter={(e) => {
            if (hasItem) {
              e.currentTarget.style.borderColor = "rgba(100, 200, 100, 0.6)";
              e.currentTarget.style.background =
                "linear-gradient(135deg, rgba(100, 200, 100, 0.2) 0%, rgba(100, 200, 100, 0.1) 100%)";
            }
          }}
          onMouseLeave={(e) => {
            if (hasItem) {
              e.currentTarget.style.borderColor = "rgba(242, 208, 138, 0.5)";
              e.currentTarget.style.background =
                "linear-gradient(135deg, rgba(40, 35, 50, 0.8) 0%, rgba(30, 25, 40, 0.9) 100%)";
            }
          }}
          title={
            hasItem
              ? `${formatItemName(item.id)} - Click to deposit`
              : `${label} (empty)`
          }
        >
          {/* Slot Label */}
          <div
            className="absolute top-0.5 left-1 text-[8px] font-medium uppercase tracking-wider"
            style={{
              color: "rgba(242, 208, 138, 0.6)",
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
            }}
          >
            {label}
          </div>

          {/* Slot Content */}
          <div className="flex flex-col items-center justify-center h-full pt-2">
            {!hasItem ? (
              <span
                className="transition-transform duration-200 group-hover:scale-110"
                style={{
                  fontSize: "1.25rem",
                  filter: "grayscale(100%) opacity(0.3)",
                }}
              >
                {icon}
              </span>
            ) : (
              <>
                <span
                  className="transition-transform duration-200 group-hover:scale-110"
                  style={{
                    fontSize: "1.25rem",
                    filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.8))",
                  }}
                >
                  {getItemIcon(item.id)}
                </span>
                <div
                  className="text-center px-0.5 mt-0.5"
                  style={{
                    fontSize: "8px",
                    color: "rgba(242, 208, 138, 0.9)",
                    lineHeight: "1.1",
                    maxWidth: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatItemName(item.id).slice(0, 10)}
                </div>
              </>
            )}
          </div>
        </button>
      );
    },
    [equipment, onDepositEquipment],
  );

  return (
    <div
      className="flex flex-col rounded-lg"
      style={{
        background: BANK_THEME.PANEL_BG,
        border: `2px solid ${BANK_THEME.PANEL_BORDER}`,
        boxShadow: `0 10px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 ${BANK_THEME.PANEL_BORDER_LIGHT}`,
        width: `${INV_SLOTS_PER_ROW * (INV_SLOT_SIZE + 4) + 24}px`,
      }}
    >
      {/* RS3-style Tab Header with view switcher */}
      <div
        className="flex justify-between items-center px-2 py-1.5 rounded-t-lg"
        style={{
          background:
            "linear-gradient(180deg, rgba(139, 69, 19, 0.4) 0%, rgba(139, 69, 19, 0.2) 100%)",
          borderBottom: `1px solid ${BANK_THEME.PANEL_BORDER}`,
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
                  ? "rgba(139, 69, 19, 0.7)"
                  : "rgba(0, 0, 0, 0.3)",
              color:
                mode === "inventory"
                  ? BANK_THEME.TEXT_GOLD
                  : "rgba(255,255,255,0.5)",
              border:
                mode === "inventory"
                  ? `1px solid ${BANK_THEME.PANEL_BORDER_LIGHT}`
                  : "1px solid transparent",
            }}
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
                  ? "rgba(139, 69, 19, 0.7)"
                  : "rgba(0, 0, 0, 0.3)",
              color:
                mode === "equipment"
                  ? BANK_THEME.TEXT_GOLD
                  : "rgba(255,255,255,0.5)",
              border:
                mode === "equipment"
                  ? `1px solid ${BANK_THEME.PANEL_BORDER_LIGHT}`
                  : "1px solid transparent",
            }}
            title="View Worn Equipment"
          >
            ⚔️
          </button>
        </div>
        <span
          className="text-xs font-bold"
          style={{ color: BANK_THEME.TEXT_GOLD }}
        >
          {mode === "inventory" ? "Inventory" : "Equipment"}
        </span>
      </div>

      {/* Content Area - switches between inventory and equipment */}
      {mode === "inventory" ? (
        <>
          {/* Inventory Grid */}
          <div className="p-2 flex-1">
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${INV_SLOTS_PER_ROW}, ${INV_SLOT_SIZE}px)`,
              }}
            >
              {INVENTORY_SLOT_INDICES.map((idx) => {
                const item = inventoryBySlot.get(idx);

                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-center relative rounded ${item ? "cursor-pointer" : ""}`}
                    style={{
                      width: INV_SLOT_SIZE,
                      height: INV_SLOT_SIZE,
                      background: item
                        ? "linear-gradient(135deg, rgba(242, 208, 138, 0.1) 0%, rgba(242, 208, 138, 0.05) 100%)"
                        : "rgba(0, 0, 0, 0.4)",
                      border: item
                        ? `1px solid ${BANK_THEME.SLOT_BORDER_HIGHLIGHT}`
                        : `1px solid ${BANK_THEME.SLOT_BORDER}`,
                    }}
                    title={
                      item
                        ? `${formatItemName(item.itemId)} x${item.quantity} - Click to deposit`
                        : "Empty slot"
                    }
                    onClick={() => item && onDeposit(item.itemId, 1)}
                    onContextMenu={(e) => {
                      if (item) {
                        onContextMenu(
                          e,
                          item.itemId,
                          item.quantity || 1,
                          "inventory",
                        );
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (item) {
                        e.currentTarget.style.background =
                          "linear-gradient(135deg, rgba(100, 200, 100, 0.2) 0%, rgba(100, 200, 100, 0.1) 100%)";
                        e.currentTarget.style.borderColor =
                          "rgba(100, 200, 100, 0.5)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (item) {
                        e.currentTarget.style.background =
                          "linear-gradient(135deg, rgba(242, 208, 138, 0.1) 0%, rgba(242, 208, 138, 0.05) 100%)";
                        e.currentTarget.style.borderColor =
                          BANK_THEME.SLOT_BORDER_HIGHLIGHT;
                      }
                    }}
                  >
                    {item && (
                      <>
                        <span className="text-lg select-none">
                          {getItemIcon(item.itemId)}
                        </span>
                        {/* BANK NOTE SYSTEM: "N" badge for noted items */}
                        {isNotedItem(item.itemId) && (
                          <span
                            className="absolute top-0 left-0.5 text-[8px] font-bold px-0.5 rounded"
                            style={{
                              color: "#fff",
                              background: "rgba(139, 69, 19, 0.9)",
                              textShadow: "0 0 2px #000",
                            }}
                          >
                            N
                          </span>
                        )}
                        {(item.quantity || 1) > 1 && (
                          <span
                            className="absolute bottom-0 right-0.5 text-[9px] font-bold"
                            style={{
                              color: BANK_THEME.TEXT_YELLOW,
                              textShadow:
                                "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
                            }}
                          >
                            {item.quantity}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coin Pouch Section */}
          <div
            className="mx-2 mb-2 p-2 rounded flex items-center justify-between"
            style={{
              background: "rgba(0, 0, 0, 0.3)",
              border: `1px solid ${BANK_THEME.PANEL_BORDER}`,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">💰</span>
              <span className="text-sm font-bold" style={{ color: "#fbbf24" }}>
                {coins.toLocaleString()}
              </span>
            </div>
            <button
              onClick={() => onOpenCoinModal("deposit")}
              disabled={coins <= 0}
              className="px-2 py-1 rounded text-xs font-bold transition-colors disabled:opacity-30"
              style={{
                background: "rgba(100, 180, 100, 0.6)",
                color: "#fff",
                border: `1px solid ${BANK_THEME.PANEL_BORDER}`,
              }}
              onMouseEnter={(e) => {
                if (coins > 0)
                  e.currentTarget.style.background = "rgba(100, 180, 100, 0.8)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(100, 180, 100, 0.6)";
              }}
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
                background:
                  "linear-gradient(180deg, rgba(139, 69, 19, 0.7) 0%, rgba(139, 69, 19, 0.5) 100%)",
                color: BANK_THEME.TEXT_GOLD,
                border: `1px solid ${BANK_THEME.PANEL_BORDER}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  "linear-gradient(180deg, rgba(139, 69, 19, 0.9) 0%, rgba(139, 69, 19, 0.7) 100%)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  "linear-gradient(180deg, rgba(139, 69, 19, 0.7) 0%, rgba(139, 69, 19, 0.5) 100%)";
              }}
            >
              Deposit Inventory
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Equipment View - Paperdoll layout matching EquipmentPanel */}
          <div
            className="p-2 flex-1"
            style={{
              background:
                "linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(25, 20, 35, 0.92) 100%)",
              borderRadius: "4px",
              margin: "4px",
            }}
          >
            {/* Paperdoll Grid: 3 columns x 3 rows (melee-only MVP) */}
            <div
              className="grid gap-1 h-full"
              style={{
                gridTemplateColumns: "repeat(3, 1fr)",
                gridTemplateRows: "repeat(3, 1fr)",
              }}
            >
              {/* Row 1: empty, helmet, empty */}
              <div />
              {renderEquipmentSlot("helmet", "Head", "⛑️")}
              <div />

              {/* Row 2: weapon, body, shield */}
              {renderEquipmentSlot("weapon", "Weapon", "⚔️")}
              {renderEquipmentSlot("body", "Body", "🎽")}
              {renderEquipmentSlot("shield", "Shield", "🛡️")}

              {/* Row 3: empty, legs, empty */}
              <div />
              {renderEquipmentSlot("legs", "Legs", "👖")}
              <div />
              {/* Row 4: Arrows slot hidden for melee-only MVP */}
            </div>
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
                background:
                  "linear-gradient(180deg, rgba(139, 69, 19, 0.7) 0%, rgba(139, 69, 19, 0.5) 100%)",
                color: BANK_THEME.TEXT_GOLD,
                border: `1px solid ${BANK_THEME.PANEL_BORDER}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  "linear-gradient(180deg, rgba(139, 69, 19, 0.9) 0%, rgba(139, 69, 19, 0.7) 100%)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  "linear-gradient(180deg, rgba(139, 69, 19, 0.7) 0%, rgba(139, 69, 19, 0.5) 100%)";
              }}
            >
              Deposit Worn Items
            </button>
          </div>
        </>
      )}
    </div>
  );
}
