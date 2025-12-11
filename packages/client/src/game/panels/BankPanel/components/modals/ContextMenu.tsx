/**
 * Bank Context Menu Component
 *
 * Right-click context menu for bank items with withdraw/deposit options.
 * RS3-style: Shows different options for placeholders (qty=0) vs items.
 */

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { getItem } from "@hyperscape/shared";
import type { ContextMenuState } from "../../types";
import type { RightPanelMode } from "../../types";

interface ContextMenuProps {
  menu: ContextMenuState;
  onAction: (action: string, quantity: number) => void;
  onClose: () => void;
  rightPanelMode: RightPanelMode;
}

export function ContextMenu({
  menu,
  onAction,
  onClose,
  rightPanelMode,
}: ContextMenuProps) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  // RS3-style: Items with qty=0 are placeholders
  const isPlaceholder = menu.type === "bank" && menu.quantity === 0;
  const actionLabel = menu.type === "bank" ? "Withdraw" : "Deposit";

  // RS3-style: Check if item is equipable for "Equip" option
  const itemData = menu.itemId ? getItem(menu.itemId) : null;
  const isEquipable = itemData?.equipSlot || itemData?.equipable;

  const handleCustomSubmit = () => {
    const amount = parseInt(customAmount, 10);
    if (amount > 0) {
      onAction(menu.type === "bank" ? "withdraw" : "deposit", amount);
    }
    onClose();
  };

  // Close on click outside - MUST be before any conditional returns (Rules of Hooks)
  useEffect(() => {
    if (!menu.visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    requestAnimationFrame(() => {
      document.addEventListener("mousedown", handleClickOutside, true);
    });

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, [menu.visible, onClose]);

  // IMPORTANT: Check visibility FIRST before any rendering
  if (!menu.visible) return null;

  // RS3-style: Handle placeholder-only context menu (qty=0 bank items)
  if (isPlaceholder) {
    return createPortal(
      <div
        ref={menuRef}
        className="fixed z-[10000] pointer-events-auto"
        style={{ left: menu.x, top: menu.y, width: "auto" }}
      >
        <div
          className="rounded shadow-xl py-1 inline-block"
          style={{
            background:
              "linear-gradient(135deg, rgba(30, 25, 20, 0.98) 0%, rgba(20, 15, 10, 0.98) 100%)",
            border: "1px solid rgba(139, 69, 19, 0.8)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.8)",
          }}
        >
          <button
            className="block px-3 py-1 text-left text-xs transition-colors whitespace-nowrap"
            style={{
              color: "rgba(242, 208, 138, 0.9)",
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(139, 69, 19, 0.4)";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "rgba(242, 208, 138, 0.9)";
            }}
            onClick={(e) => {
              e.stopPropagation();
              onAction("releasePlaceholder", 0);
              onClose();
            }}
          >
            Release
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  const menuOptions: Array<{ label: string; amount: number; action: string }> =
    [];

  // RS3-style: "Equip" option position depends on rightPanelMode
  // Equipment tab open: Equip at TOP (left-click equips)
  // Inventory tab open: Equip at BOTTOM (left-click withdraws to inventory)
  const canEquip = menu.type === "bank" && isEquipable && menu.quantity > 0;

  // Add "Equip" at TOP only if equipment tab is open
  if (canEquip && rightPanelMode === "equipment") {
    menuOptions.push({
      label: "Equip",
      amount: 1,
      action: "equip",
    });
  }

  // Standard withdraw/deposit options
  menuOptions.push(
    {
      label: `${actionLabel} 1`,
      amount: 1,
      action: menu.type === "bank" ? "withdraw" : "deposit",
    },
    {
      label: `${actionLabel} 5`,
      amount: 5,
      action: menu.type === "bank" ? "withdraw" : "deposit",
    },
    {
      label: `${actionLabel} 10`,
      amount: 10,
      action: menu.type === "bank" ? "withdraw" : "deposit",
    },
    {
      label: `${actionLabel} All`,
      amount: menu.quantity,
      action: menu.type === "bank" ? "withdraw" : "deposit",
    },
    {
      label: `${actionLabel} X`,
      amount: -1,
      action: menu.type === "bank" ? "withdraw" : "deposit",
    },
  );

  // Add "Equip" at BOTTOM if inventory tab is open (still available, just not default)
  if (canEquip && rightPanelMode === "inventory") {
    menuOptions.push({
      label: "Equip",
      amount: 1,
      action: "equip",
    });
  }

  // RS3-style: Add "Withdraw-Placeholder" option for bank items with qty > 0
  // This withdraws all and leaves a qty=0 placeholder regardless of toggle
  if (menu.type === "bank" && menu.quantity > 0) {
    menuOptions.push({
      label: "Withdraw-Placeholder",
      amount: menu.quantity,
      action: "withdrawPlaceholder",
    });
  }

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[10000] pointer-events-auto"
      style={{
        left: menu.x,
        top: menu.y,
        width: "auto",
      }}
    >
      <div
        className="rounded shadow-xl py-1 inline-block"
        style={{
          background:
            "linear-gradient(135deg, rgba(30, 25, 20, 0.98) 0%, rgba(20, 15, 10, 0.98) 100%)",
          border: "1px solid rgba(139, 69, 19, 0.8)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.8)",
        }}
      >
        {showCustomInput ? (
          <div className="px-2 py-2">
            <input
              type="number"
              min="1"
              max={menu.quantity}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCustomSubmit();
                if (e.key === "Escape") onClose();
              }}
              autoFocus
              className="w-full px-2 py-1 text-sm rounded"
              style={{
                background: "rgba(0, 0, 0, 0.5)",
                border: "1px solid rgba(139, 69, 19, 0.6)",
                color: "#fff",
                outline: "none",
              }}
              placeholder={`1-${menu.quantity}`}
            />
            <div className="flex gap-1 mt-1">
              <button
                onClick={handleCustomSubmit}
                className="flex-1 px-2 py-1 text-xs rounded"
                style={{
                  background: "rgba(100, 150, 100, 0.6)",
                  color: "#fff",
                }}
              >
                OK
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-2 py-1 text-xs rounded"
                style={{
                  background: "rgba(150, 100, 100, 0.6)",
                  color: "#fff",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          menuOptions.map((option, idx) => (
            <button
              key={idx}
              className="block px-3 py-1 text-left text-xs transition-colors whitespace-nowrap"
              style={{
                color: "rgba(242, 208, 138, 0.9)",
                background: "transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(139, 69, 19, 0.4)";
                e.currentTarget.style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "rgba(242, 208, 138, 0.9)";
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (option.amount === -1) {
                  setShowCustomInput(true);
                } else if (
                  option.action === "setPlaceholder" ||
                  option.action === "releasePlaceholder"
                ) {
                  onAction(option.action, 0);
                  onClose();
                } else {
                  onAction(
                    option.action,
                    Math.min(option.amount, menu.quantity),
                  );
                  onClose();
                }
              }}
            >
              {option.label}
            </button>
          ))
        )}
      </div>
    </div>,
    document.body,
  );
}
