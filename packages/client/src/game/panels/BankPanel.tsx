/**
 * BankPanel - RuneScape-style bank interface
 *
 * SIMPLE SERVER-AUTHORITATIVE APPROACH:
 * - NO optimistic predictions - just display what server tells us
 * - Server is the single source of truth
 * - Clicks fire requests to server and wait for response
 * - 100% reliable - no desync, no duplication bugs, no oscillation
 *
 * This approach is used by many successful MMOs including early RuneScape.
 * Trade-off: Very slightly less responsive (wait ~50-100ms for server),
 * but 100% reliable with zero edge cases.
 *
 * Features:
 * - Scrollable grid display of bank items (480 slots)
 * - Right-click context menu with withdraw/deposit options (1, 5, 10, All, X)
 * - Left-click for quick withdraw/deposit 1
 * - All items stack in bank (MVP simplification)
 * - Shows alongside inventory when open
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getItem } from "@hyperscape/shared";

// Types
import type {
  BankItem,
  BankPanelProps,
  ContextMenuState,
  CoinModalState,
  ConfirmModalState,
} from "./BankPanel/types";

// Constants
import {
  BANK_SLOTS_PER_ROW,
  BANK_SLOT_SIZE,
  BANK_GAP,
  BANK_SCROLL_HEIGHT,
  SLOT_INDEX_APPEND_ZONE,
  TAB_INDEX_ALL,
  BANK_THEME,
} from "./BankPanel/constants";

// Utils
import { getItemIcon } from "./BankPanel/utils";

// Components
import {
  BankSlotItem,
  BankTabBar,
  BankFooter,
  RightPanel,
  ContextMenu,
  CoinAmountModal,
  ConfirmModal,
} from "./BankPanel/components";

// Hooks
import { useBankActions, useDragDrop } from "./BankPanel/hooks";

// ============================================================================
// MAIN BANK PANEL COMPONENT
// ============================================================================

// NOTE: Distance validation is now SERVER-AUTHORITATIVE
// The server tracks interaction sessions and sends bankClose packets
// when the player moves too far away. The client no longer polls distance.

export function BankPanel({
  items, // RS3-style: includes qty=0 items (placeholders)
  tabs = [],
  alwaysSetPlaceholder = false,
  maxSlots,
  world,
  inventory,
  equipment, // RS3-style equipment view
  coins,
  onClose,
}: BankPanelProps) {
  // RS3-style right panel view mode (inventory vs equipment)
  type RightPanelMode = "inventory" | "equipment";
  const [rightPanelMode, setRightPanelMode] =
    useState<RightPanelMode>("inventory");
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    itemId: "",
    quantity: 0,
    type: "bank",
  });

  const [coinModal, setCoinModal] = useState<CoinModalState>({
    visible: false,
    action: "deposit",
    maxAmount: 0,
  });

  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    visible: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // ========== TAB STATE ==========
  // -1 = "All" view (shows all items across all tabs)
  // 0 = Main tab
  // 1-9 = Custom tabs
  const [selectedTab, setSelectedTab] = useState<number>(-1);

  // ========== DRAG-DROP STATE (from useDragDrop hook) ==========
  // Note: useDragDrop is initialized after useBankActions because it needs handleBankMove/handleMoveToTab
  // We'll initialize it after the useBankActions call below

  // ========== BANK NOTE SYSTEM STATE ==========
  // OSRS-style: Toggle between withdrawing as base items or bank notes
  // Notes are stackable, so 1000 noted logs = 1 inventory slot
  // Persisted to localStorage for convenience
  const [withdrawAsNote, setWithdrawAsNote] = useState<boolean>(() => {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem("bank_withdrawAsNote") === "true";
    }
    return false;
  });

  // Persist withdrawAsNote to localStorage
  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(
        "bank_withdrawAsNote",
        withdrawAsNote ? "true" : "false",
      );
    }
  }, [withdrawAsNote]);

  // ========== PERFORMANCE: Memoize filtered items ==========
  const filteredItems = useMemo(() => {
    if (selectedTab === TAB_INDEX_ALL) {
      return items;
    }
    return items.filter((i) => i.tabIndex === selectedTab);
  }, [items, selectedTab]);

  // ========== PERFORMANCE: Pre-group items by tab for "All" view ==========
  // Only rebuilt when items change, not on every render
  const itemsByTab = useMemo(() => {
    const grouped = new Map<number, BankItem[]>();
    for (const item of items) {
      const list = grouped.get(item.tabIndex);
      if (list) {
        list.push(item);
      } else {
        grouped.set(item.tabIndex, [item]);
      }
    }
    // Sort each group by slot
    for (const list of grouped.values()) {
      list.sort((a, b) => a.slot - b.slot);
    }
    return grouped;
  }, [items]);

  // Sorted tab indexes (only when items change)
  const sortedTabIndexes = useMemo(() => {
    return Array.from(itemsByTab.keys()).sort((a, b) => a - b);
  }, [itemsByTab]);

  // ========== SIMPLE SERVER-AUTHORITATIVE UI ==========
  // NO optimistic predictions - just display server state directly.
  // This is simple, reliable, and correct.
  //
  // Server queue processes operations one at a time per player.
  // Each click fires a request; server responds with updated bank state.
  // The UI updates when the new props arrive from server.

  // Bank coins from server state
  const bankCoinsItem = items.find((item) => item.itemId === "coins");
  const bankCoins = bankCoinsItem?.quantity ?? 0;

  // ========== ACTION HANDLERS (from useBankActions hook) ==========
  const {
    handleWithdraw,
    handleDeposit,
    handleDepositAll,
    handleDepositCoins,
    handleWithdrawCoins,
    handleBankMove,
    handleCreateTab,
    handleDeleteTab,
    handleMoveToTab,
    handleWithdrawPlaceholder,
    handleReleasePlaceholder,
    handleReleaseAllPlaceholders,
    handleToggleAlwaysPlaceholder,
    handleWithdrawToEquipment,
    handleDepositEquipment,
    handleDepositAllEquipment,
  } = useBankActions({ world, selectedTab, withdrawAsNote });

  // ========== DRAG-DROP HANDLERS (from useDragDrop hook) ==========
  const {
    dragState,
    handleSlotDragStart,
    handleSlotDragOver,
    handleSlotDragLeave,
    handleSlotDrop,
    handleSlotDragEnd,
    setDraggedSlot,
    setDraggedTabIndex,
    setHoveredTabIndex,
    setHoveredSlot,
    setDropMode,
    setInsertPosition,
  } = useDragDrop({ onBankMove: handleBankMove, onMoveToTab: handleMoveToTab });

  // Destructure for convenience
  const {
    draggedSlot,
    draggedTabIndex,
    dropMode,
    hoveredSlot,
    hoveredTabIndex,
  } = dragState;

  // ========== COIN MODAL HANDLERS ==========

  const openCoinModal = (action: "deposit" | "withdraw") => {
    const maxAmount = action === "deposit" ? coins : bankCoins;
    if (maxAmount > 0) {
      setCoinModal({ visible: true, action, maxAmount });
    }
  };

  const closeCoinModal = () => {
    setCoinModal((prev) => ({ ...prev, visible: false }));
  };

  const handleCoinModalConfirm = (amount: number) => {
    if (coinModal.action === "deposit") {
      handleDepositCoins(amount);
    } else {
      handleWithdrawCoins(amount);
    }
  };

  // ========== CONTEXT MENU HANDLERS ==========

  const handleContextMenuAction = useCallback(
    (action: string, quantity: number) => {
      if (action === "withdraw") {
        handleWithdraw(contextMenu.itemId, quantity);
      } else if (action === "deposit") {
        handleDeposit(contextMenu.itemId, quantity);
      } else if (action === "withdrawPlaceholder") {
        // RS3-style: Withdraw all and leave qty=0 placeholder
        handleWithdrawPlaceholder(contextMenu.itemId);
      } else if (
        action === "releasePlaceholder" &&
        contextMenu.tabIndex !== undefined &&
        contextMenu.slot !== undefined
      ) {
        // RS3-style: Delete the qty=0 row
        handleReleasePlaceholder(contextMenu.tabIndex, contextMenu.slot);
      } else if (
        action === "equip" &&
        contextMenu.tabIndex !== undefined &&
        contextMenu.slot !== undefined
      ) {
        // RS3-style: Equip directly from bank
        handleWithdrawToEquipment(
          contextMenu.itemId,
          contextMenu.tabIndex,
          contextMenu.slot,
        );
      }
    },
    [
      contextMenu.itemId,
      contextMenu.tabIndex,
      contextMenu.slot,
      handleWithdraw,
      handleDeposit,
      handleWithdrawPlaceholder,
      handleReleasePlaceholder,
      handleWithdrawToEquipment,
    ],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  const openContextMenu = (
    e: React.MouseEvent,
    itemId: string,
    quantity: number,
    type: "bank" | "inventory",
    tabIndex?: number,
    slot?: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // For inventory items, calculate total count across ALL slots
    let totalQuantity = quantity;
    if (type === "inventory") {
      totalQuantity = inventory
        .filter((item) => item && item.itemId === itemId)
        .reduce((sum, item) => sum + (item.quantity || 1), 0);
    }

    // RS3-style: No separate hasPlaceholder check needed
    // Items with qty=0 ARE placeholders (handled by context menu component)
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      itemId,
      quantity: totalQuantity,
      type,
      tabIndex,
      slot,
    });
  };

  // ========== SLOT CLICK HANDLER ==========
  const handleSlotClick = useCallback(
    (itemId: string, tabIndex: number, slot: number) => {
      // RS3-style: When in equipment mode, try to withdraw directly to equipment
      if (rightPanelMode === "equipment") {
        const itemData = getItem(itemId);
        // Check if item is equipable (has an equipSlot)
        if (itemData?.equipSlot || itemData?.equipable) {
          handleWithdrawToEquipment(itemId, tabIndex, slot);
          return;
        }
        // Non-equipable items still go to inventory even in equipment mode
      }
      handleWithdraw(itemId, 1);
    },
    [handleWithdraw, handleWithdrawToEquipment, rightPanelMode],
  );

  const handleSlotContextMenu = useCallback(
    (e: React.MouseEvent, item: BankItem) => {
      openContextMenu(
        e,
        item.itemId,
        item.quantity,
        "bank",
        item.tabIndex,
        item.slot,
      );
    },
    [inventory], // openContextMenu depends on inventory for total calculation
  );

  // ========== RENDER ==========

  return (
    <div
      className="fixed z-[9999] pointer-events-auto"
      style={{
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Custom scrollbar styles */}
      <style>{`
        .bank-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .bank-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 4px;
        }
        .bank-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 69, 19, 0.6);
          border-radius: 4px;
        }
        .bank-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 69, 19, 0.8);
        }
      `}</style>

      <ContextMenu
        menu={contextMenu}
        onAction={handleContextMenuAction}
        onClose={closeContextMenu}
        rightPanelMode={rightPanelMode}
      />

      <CoinAmountModal
        modal={coinModal}
        onConfirm={handleCoinModalConfirm}
        onClose={closeCoinModal}
      />

      <ConfirmModal
        modal={confirmModal}
        onClose={() => setConfirmModal((prev) => ({ ...prev, visible: false }))}
      />

      <div className="flex gap-2">
        {/* Bank Panel - Left Side */}
        <div
          className="flex flex-col rounded-lg"
          style={{
            background:
              "linear-gradient(135deg, rgba(20, 15, 10, 0.98) 0%, rgba(15, 10, 5, 0.98) 100%)",
            border: `2px solid ${BANK_THEME.PANEL_BORDER}`,
            boxShadow: `0 10px 30px rgba(0, 0, 0, 0.8), inset 0 2px 4px ${BANK_THEME.PANEL_BORDER_LIGHT}`,
            minHeight: `${BANK_SCROLL_HEIGHT + 180}px`,
            width: `${BANK_SLOTS_PER_ROW * (BANK_SLOT_SIZE + BANK_GAP) + 32}px`,
          }}
        >
          {/* Header */}
          <div
            className="flex justify-between items-center px-4 py-2 rounded-t-lg"
            style={{
              background:
                "linear-gradient(180deg, rgba(139, 69, 19, 0.4) 0%, rgba(139, 69, 19, 0.2) 100%)",
              borderBottom: `1px solid ${BANK_THEME.PANEL_BORDER}`,
            }}
          >
            <h2
              className="text-lg font-bold flex items-center gap-2"
              style={{ color: BANK_THEME.TEXT_GOLD }}
            >
              <span>🏦</span>
              <span>Bank</span>
            </h2>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded text-sm font-bold transition-colors"
              style={{
                background: "rgba(180, 50, 50, 0.8)",
                color: "#fff",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(220, 60, 60, 0.9)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(180, 50, 50, 0.8)";
              }}
            >
              ✕
            </button>
          </div>

          {/* Tab Bar */}
          <BankTabBar
            tabs={tabs}
            items={items}
            selectedTab={selectedTab}
            onSelectTab={setSelectedTab}
            dragState={dragState}
            setDraggedSlot={setDraggedSlot}
            setDraggedTabIndex={setDraggedTabIndex}
            setHoveredTabIndex={setHoveredTabIndex}
            handleMoveToTab={handleMoveToTab}
            handleCreateTab={handleCreateTab}
            handleDeleteTab={handleDeleteTab}
            setConfirmModal={setConfirmModal}
          />

          {/* Scrollable Item Grid */}
          <div
            className="mx-3 mt-1 p-3 overflow-y-auto overflow-x-hidden bank-scrollbar flex-1 rounded"
            style={{
              maxHeight: `${BANK_SCROLL_HEIGHT}px`,
              scrollbarWidth: "thin",
              scrollbarColor: `${BANK_THEME.PANEL_BORDER} rgba(0, 0, 0, 0.3)`,
              background: "rgba(0, 0, 0, 0.2)",
              border: `1px solid ${BANK_THEME.PANEL_BORDER}`,
            }}
          >
            {/* "All" tab view with grouped headers */}
            {selectedTab === TAB_INDEX_ALL ? (
              <div className="space-y-2">
                {/* Group items by tabIndex and render with headers (using memoized grouping) */}
                {sortedTabIndexes.map((tabIdx) => {
                  const tabItems = itemsByTab.get(tabIdx) ?? [];
                  if (tabItems.length === 0) return null;

                  // RS3-style: Prefer real items, but show placeholder icon if tab only has placeholders
                  const firstRealItem = tabItems.find((i) => i.quantity > 0);
                  const firstAnyItem = tabItems[0];
                  const iconItem = firstRealItem || firstAnyItem;
                  const isPlaceholderIcon = iconItem && iconItem.quantity === 0;
                  // RS3-style: All tabs treated equally, icon derived from first item
                  const tabLabel = iconItem
                    ? `${getItemIcon(iconItem.itemId)} Tab ${tabIdx}${isPlaceholderIcon ? " (empty)" : ""}`
                    : `📦 Tab ${tabIdx}`;

                  // Check if this tab header is being hovered for drop
                  const isHeaderDropTarget =
                    hoveredTabIndex === tabIdx &&
                    draggedSlot !== null &&
                    draggedTabIndex !== tabIdx;

                  return (
                    <div key={tabIdx}>
                      {/* Tab Header - OSRS style separator - DROPPABLE to move items to this tab */}
                      <div
                        className="flex items-center gap-2 mb-1 pb-0.5 transition-colors"
                        style={{
                          background: isHeaderDropTarget
                            ? "rgba(100, 200, 255, 0.15)"
                            : "transparent",
                          padding: "1px 2px",
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (
                            draggedSlot !== null &&
                            draggedTabIndex !== tabIdx
                          ) {
                            setHoveredTabIndex(tabIdx);
                          }
                        }}
                        onDragLeave={() => {
                          setHoveredTabIndex(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (
                            draggedSlot !== null &&
                            draggedTabIndex !== null &&
                            draggedTabIndex !== tabIdx
                          ) {
                            handleMoveToTab(
                              draggedSlot,
                              draggedTabIndex,
                              tabIdx,
                            );
                          }
                          setDraggedSlot(null);
                          setDraggedTabIndex(null);
                          setHoveredTabIndex(null);
                          setDropMode(null);
                          setInsertPosition(null);
                          setHoveredSlot(null);
                        }}
                      >
                        <span
                          className="text-[10px] font-bold"
                          style={{
                            color: isHeaderDropTarget
                              ? "#fff"
                              : BANK_THEME.TEXT_GOLD,
                          }}
                        >
                          {tabLabel}
                        </span>
                        <div
                          className="flex-1"
                          style={{
                            height: isHeaderDropTarget ? "2px" : "1px",
                            background: isHeaderDropTarget
                              ? "rgba(100, 200, 255, 0.8)"
                              : BANK_THEME.PANEL_BORDER_LIGHT,
                            transition: "all 0.15s ease",
                          }}
                        />
                        <span
                          className="text-[9px]"
                          style={{
                            color: isHeaderDropTarget
                              ? "rgba(255,255,255,0.7)"
                              : `${BANK_THEME.TEXT_GOLD}88`,
                          }}
                        >
                          {isHeaderDropTarget
                            ? "Drop here"
                            : `${tabItems.length}`}
                        </span>
                      </div>

                      {/* Items grid for this tab */}
                      <div
                        className="grid gap-2"
                        style={{
                          gridTemplateColumns: `repeat(${BANK_SLOTS_PER_ROW}, ${BANK_SLOT_SIZE}px)`,
                        }}
                      >
                        {tabItems.map((item) => {
                          const slotIndex = item.slot;
                          const itemTabIndex = item.tabIndex;

                          // Determine visual states
                          const isDragging =
                            draggedSlot === slotIndex &&
                            draggedTabIndex === itemTabIndex;
                          const isDropTarget =
                            hoveredSlot === slotIndex &&
                            hoveredTabIndex === itemTabIndex &&
                            draggedSlot !== null &&
                            !(
                              draggedSlot === slotIndex &&
                              draggedTabIndex === itemTabIndex
                            );
                          const isCrossTabDrop =
                            isDropTarget &&
                            draggedTabIndex !== null &&
                            draggedTabIndex !== itemTabIndex;
                          const canReceiveDrop =
                            draggedSlot !== null && !isDragging;

                          // Visual states for different drop modes
                          const showInsertLine =
                            isDropTarget && dropMode === "insert";
                          const showSwapHighlight =
                            isDropTarget && dropMode === "swap";

                          // Show faint insert guides on ALL items while dragging
                          const showFaintGuide =
                            canReceiveDrop && !isDropTarget;

                          // Color based on cross-tab vs same-tab
                          const dropColor = isCrossTabDrop
                            ? "100, 255, 150"
                            : "100, 200, 255";
                          const guideColor =
                            draggedTabIndex !== itemTabIndex
                              ? "100, 255, 150"
                              : "100, 200, 255";

                          return (
                            <BankSlotItem
                              key={`${itemTabIndex}-${slotIndex}`}
                              item={item}
                              slotIndex={slotIndex}
                              itemTabIndex={itemTabIndex}
                              isDragging={isDragging}
                              isDropTarget={isDropTarget}
                              showSwapHighlight={showSwapHighlight}
                              showInsertLine={showInsertLine}
                              showFaintGuide={showFaintGuide}
                              dropColor={dropColor}
                              guideColor={guideColor}
                              onDragStart={handleSlotDragStart}
                              onDragOver={handleSlotDragOver}
                              onDragLeave={handleSlotDragLeave}
                              onDrop={handleSlotDrop}
                              onDragEnd={handleSlotDragEnd}
                              onClick={handleSlotClick}
                              onContextMenu={handleSlotContextMenu}
                            />
                          );
                        })}

                        {/* RS3-STYLE: Placeholders are items with qty=0, already rendered above with greyed style */}

                        {/* APPEND ZONE - Empty slot at end for dropping items to append */}
                        {draggedSlot !== null && (
                          <div
                            className="rounded flex items-center justify-center relative"
                            style={{
                              width: BANK_SLOT_SIZE,
                              height: BANK_SLOT_SIZE,
                              background:
                                hoveredSlot === SLOT_INDEX_APPEND_ZONE &&
                                hoveredTabIndex === tabIdx
                                  ? `linear-gradient(135deg, rgba(${draggedTabIndex !== tabIdx ? "100, 255, 150" : "100, 200, 255"}, 0.35) 0%, rgba(${draggedTabIndex !== tabIdx ? "100, 255, 150" : "100, 200, 255"}, 0.2) 100%)`
                                  : "linear-gradient(135deg, rgba(242, 208, 138, 0.05) 0%, rgba(242, 208, 138, 0.02) 100%)",
                              border:
                                hoveredSlot === SLOT_INDEX_APPEND_ZONE &&
                                hoveredTabIndex === tabIdx
                                  ? `2px dashed rgba(${draggedTabIndex !== tabIdx ? "100, 255, 150" : "100, 200, 255"}, 0.9)`
                                  : "2px dashed rgba(242, 208, 138, 0.2)",
                              transition: "all 0.15s ease",
                              boxShadow:
                                hoveredSlot === SLOT_INDEX_APPEND_ZONE &&
                                hoveredTabIndex === tabIdx
                                  ? `0 0 12px rgba(${draggedTabIndex !== tabIdx ? "100, 255, 150" : "100, 200, 255"}, 0.5)`
                                  : "none",
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setHoveredSlot(SLOT_INDEX_APPEND_ZONE); // Special marker for "append"
                              setHoveredTabIndex(tabIdx);
                              setDropMode("insert");
                              setInsertPosition("after");
                            }}
                            onDragLeave={() => {
                              setHoveredSlot(null);
                              setHoveredTabIndex(null);
                              setDropMode(null);
                              setInsertPosition(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (
                                draggedSlot !== null &&
                                draggedTabIndex !== null
                              ) {
                                const lastSlot =
                                  tabItems.length > 0
                                    ? tabItems[tabItems.length - 1].slot
                                    : -1;
                                if (draggedTabIndex === tabIdx) {
                                  // Same tab - move to end
                                  handleBankMove(
                                    draggedSlot,
                                    lastSlot + 1,
                                    "insert",
                                    draggedTabIndex,
                                  );
                                } else {
                                  // Cross-tab - append to this tab (no toSlot = append)
                                  handleMoveToTab(
                                    draggedSlot,
                                    draggedTabIndex,
                                    tabIdx,
                                  );
                                }
                              }
                              setDraggedSlot(null);
                              setDraggedTabIndex(null);
                              setDropMode(null);
                              setInsertPosition(null);
                              setHoveredSlot(null);
                              setHoveredTabIndex(null);
                            }}
                          >
                            <span
                              className="text-xs font-medium"
                              style={{
                                color:
                                  hoveredSlot === SLOT_INDEX_APPEND_ZONE &&
                                  hoveredTabIndex === tabIdx
                                    ? `rgba(${draggedTabIndex !== tabIdx ? "100, 255, 150" : "100, 200, 255"}, 1)`
                                    : "rgba(242, 208, 138, 0.3)",
                              }}
                            >
                              +
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Single tab view - flat grid with improved UX */
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(${BANK_SLOTS_PER_ROW}, ${BANK_SLOT_SIZE}px)`,
                }}
              >
                {filteredItems.map((item) => {
                  const slotIndex = item.slot;
                  const itemTabIndex = item.tabIndex;

                  // Determine visual states
                  const isDragging =
                    draggedSlot === slotIndex &&
                    draggedTabIndex === itemTabIndex;
                  const isDropTarget =
                    hoveredSlot === slotIndex &&
                    draggedSlot !== null &&
                    !(
                      draggedSlot === slotIndex &&
                      draggedTabIndex === itemTabIndex
                    );
                  const canReceiveDrop = draggedSlot !== null && !isDragging;
                  const showSwapHighlight = isDropTarget && dropMode === "swap";
                  const showInsertLine = isDropTarget && dropMode === "insert";

                  // Show faint insert guides on ALL items while dragging
                  const showFaintGuide = canReceiveDrop && !isDropTarget;

                  // Single-tab view uses same color for all
                  const dropColor = "100, 200, 255";
                  const guideColor = "100, 200, 255";

                  return (
                    <BankSlotItem
                      key={`${itemTabIndex}-${slotIndex}`}
                      item={item}
                      slotIndex={slotIndex}
                      itemTabIndex={itemTabIndex}
                      isDragging={isDragging}
                      isDropTarget={isDropTarget}
                      showSwapHighlight={showSwapHighlight}
                      showInsertLine={showInsertLine}
                      showFaintGuide={showFaintGuide}
                      dropColor={dropColor}
                      guideColor={guideColor}
                      onDragStart={handleSlotDragStart}
                      onDragOver={handleSlotDragOver}
                      onDragLeave={handleSlotDragLeave}
                      onDrop={handleSlotDrop}
                      onDragEnd={handleSlotDragEnd}
                      onClick={handleSlotClick}
                      onContextMenu={handleSlotContextMenu}
                    />
                  );
                })}

                {/* RS3-STYLE: Placeholders are items with qty=0, already rendered above with greyed style */}

                {/* APPEND ZONE - Empty slot at end for dropping items to append */}
                {draggedSlot !== null && selectedTab >= 0 && (
                  <div
                    className="rounded flex items-center justify-center relative"
                    style={{
                      width: BANK_SLOT_SIZE,
                      height: BANK_SLOT_SIZE,
                      background:
                        hoveredSlot === SLOT_INDEX_APPEND_ZONE
                          ? "linear-gradient(135deg, rgba(100, 200, 255, 0.35) 0%, rgba(100, 200, 255, 0.2) 100%)"
                          : "linear-gradient(135deg, rgba(242, 208, 138, 0.05) 0%, rgba(242, 208, 138, 0.02) 100%)",
                      border:
                        hoveredSlot === SLOT_INDEX_APPEND_ZONE
                          ? "2px dashed rgba(100, 200, 255, 0.9)"
                          : "2px dashed rgba(242, 208, 138, 0.2)",
                      transition: "all 0.15s ease",
                      boxShadow:
                        hoveredSlot === SLOT_INDEX_APPEND_ZONE
                          ? "0 0 12px rgba(100, 200, 255, 0.5)"
                          : "none",
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setHoveredSlot(SLOT_INDEX_APPEND_ZONE); // Special marker for "append"
                      setDropMode("insert");
                      setInsertPosition("after");
                    }}
                    onDragLeave={() => {
                      setHoveredSlot(null);
                      setDropMode(null);
                      setInsertPosition(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (
                        draggedSlot !== null &&
                        draggedTabIndex !== null &&
                        draggedTabIndex === selectedTab
                      ) {
                        const lastSlot =
                          filteredItems.length > 0
                            ? filteredItems[filteredItems.length - 1].slot
                            : -1;
                        handleBankMove(
                          draggedSlot,
                          lastSlot + 1,
                          "insert",
                          draggedTabIndex,
                        );
                      }
                      setDraggedSlot(null);
                      setDraggedTabIndex(null);
                      setDropMode(null);
                      setInsertPosition(null);
                      setHoveredSlot(null);
                    }}
                  >
                    <span
                      className="text-xs font-medium"
                      style={{
                        color:
                          hoveredSlot === SLOT_INDEX_APPEND_ZONE
                            ? "rgba(100, 200, 255, 1)"
                            : "rgba(242, 208, 138, 0.3)",
                      }}
                    >
                      +
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer - Status bar with placeholder controls */}
          <BankFooter
            items={items}
            filteredItems={filteredItems}
            maxSlots={maxSlots}
            selectedTab={selectedTab}
            withdrawAsNote={withdrawAsNote}
            onToggleNote={setWithdrawAsNote}
            alwaysSetPlaceholder={alwaysSetPlaceholder}
            onTogglePlaceholder={handleToggleAlwaysPlaceholder}
            onReleaseAllPlaceholders={handleReleaseAllPlaceholders}
          />
        </div>

        {/* Right Panel - Inventory / Equipment (RS3-style tab switcher) */}
        <RightPanel
          mode={rightPanelMode}
          onChangeMode={setRightPanelMode}
          inventory={inventory}
          coins={coins}
          equipment={equipment}
          onDeposit={handleDeposit}
          onDepositAll={handleDepositAll}
          onOpenCoinModal={openCoinModal}
          onContextMenu={openContextMenu}
          onDepositEquipment={handleDepositEquipment}
          onDepositAllEquipment={handleDepositAllEquipment}
        />
      </div>
    </div>
  );
}
