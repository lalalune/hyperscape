/**
 * BankSlotItem - Memoized Bank Slot Component
 *
 * CRITICAL: This component uses React.memo to prevent unnecessary re-renders.
 * Without memoization, all 480 slots would re-render on ANY state change
 * (hover, drag, selection). With React.memo, only slots whose props
 * actually changed will re-render.
 *
 * Performance impact: Reduces re-renders from O(n) to O(1) for most interactions.
 *
 * DO NOT REMOVE React.memo - it is essential for performance!
 */

import React, { memo } from "react";
import type { BankItem } from "../types";
import { BANK_SLOT_SIZE, BANK_THEME } from "../constants";
import { formatItemName, formatQuantity, getItemIcon } from "../utils";

/**
 * Props for the memoized BankSlotItem component
 */
export interface BankSlotItemProps {
  item: BankItem;
  slotIndex: number;
  itemTabIndex: number;
  isDragging: boolean;
  isDropTarget: boolean;
  showSwapHighlight: boolean;
  showInsertLine: boolean;
  showFaintGuide: boolean;
  dropColor: string;
  guideColor: string;
  onDragStart: (slotIndex: number, tabIndex: number) => void;
  onDragOver: (e: React.DragEvent, slotIndex: number, tabIndex: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, slotIndex: number, tabIndex: number) => void;
  onDragEnd: () => void;
  onClick: (itemId: string, tabIndex: number, slot: number) => void;
  onContextMenu: (e: React.MouseEvent, item: BankItem) => void;
}

/**
 * Memoized bank slot component to prevent unnecessary re-renders.
 *
 * CRITICAL: Do NOT remove memo() wrapper - essential for 480-slot performance!
 */
export const BankSlotItem = memo(function BankSlotItem({
  item,
  slotIndex,
  itemTabIndex,
  isDragging,
  isDropTarget,
  showSwapHighlight,
  showInsertLine,
  showFaintGuide,
  dropColor,
  guideColor,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onClick,
  onContextMenu,
}: BankSlotItemProps) {
  const isPlaceholder = item.quantity === 0;

  return (
    <div
      className="rounded flex items-center justify-center relative cursor-grab active:cursor-grabbing"
      style={{
        width: BANK_SLOT_SIZE,
        height: BANK_SLOT_SIZE,
        background: showSwapHighlight
          ? `linear-gradient(135deg, rgba(${dropColor}, 0.35) 0%, rgba(${dropColor}, 0.2) 100%)`
          : isPlaceholder
            ? "linear-gradient(135deg, rgba(50, 45, 40, 0.4) 0%, rgba(40, 35, 30, 0.4) 100%)"
            : "linear-gradient(135deg, rgba(242, 208, 138, 0.1) 0%, rgba(242, 208, 138, 0.05) 100%)",
        border: showSwapHighlight
          ? `2px solid rgba(${dropColor}, 0.9)`
          : isPlaceholder
            ? "1px dashed rgba(242, 208, 138, 0.2)"
            : `1px solid ${BANK_THEME.SLOT_BORDER_HIGHLIGHT}`,
        transform: isDragging ? "scale(0.9)" : "scale(1)",
        opacity: isDragging ? 0.4 : isPlaceholder ? 0.6 : 1,
        transition:
          "transform 0.15s ease, opacity 0.15s ease, background 0.1s ease, border 0.1s ease",
        boxShadow: showSwapHighlight
          ? `0 0 12px rgba(${dropColor}, 0.5)`
          : "none",
      }}
      title={
        isPlaceholder
          ? `${formatItemName(item.itemId)} (placeholder)`
          : `${formatItemName(item.itemId)} x${item.quantity} (Tab ${itemTabIndex})`
      }
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(slotIndex, itemTabIndex);
      }}
      onDragOver={(e) => onDragOver(e, slotIndex, itemTabIndex)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, slotIndex, itemTabIndex)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(item.itemId, itemTabIndex, slotIndex)}
      onContextMenu={(e) => onContextMenu(e, item)}
    >
      {/* Single INSERT LINE on left edge */}
      {(showInsertLine || showFaintGuide) && (
        <div
          style={{
            position: "absolute",
            left: -4,
            top: 0,
            bottom: 0,
            width: showInsertLine ? 6 : 3,
            background: showInsertLine
              ? `rgba(${dropColor}, 1)`
              : `rgba(${guideColor}, 0.2)`,
            borderRadius: 3,
            zIndex: 20,
            boxShadow: showInsertLine
              ? `0 0 10px rgba(${dropColor}, 0.9), 0 0 20px rgba(${dropColor}, 0.5)`
              : "none",
            transition: "all 0.1s ease",
          }}
        />
      )}
      <span className="text-xl select-none pointer-events-none">
        {getItemIcon(item.itemId)}
      </span>
      {item.quantity > 1 && (
        <span
          className="absolute bottom-0 right-0.5 text-[10px] font-bold pointer-events-none"
          style={{
            color:
              item.quantity >= 10000000
                ? "#00ff00"
                : item.quantity >= 100000
                  ? "#ffffff"
                  : "#ffff00",
            textShadow: "1px 1px 1px black, -1px -1px 1px black",
          }}
        >
          {formatQuantity(item.quantity)}
        </span>
      )}
    </div>
  );
});
