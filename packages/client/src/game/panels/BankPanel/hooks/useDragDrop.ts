/**
 * useDragDrop Hook
 *
 * Manages drag-drop state for OSRS-style bank reorganization.
 * Provides stable callbacks for memoized slot components and
 * exposes state setters for tab-specific drag handling.
 *
 * CRITICAL: The 60fps throttle (DRAG_THROTTLE_MS) is essential for performance.
 * DO NOT remove the throttling logic.
 */

import React, { useState, useCallback, useRef, useMemo } from "react";
import { DRAG_THROTTLE_MS } from "../constants";

interface UseDragDropConfig {
  onBankMove: (
    fromSlot: number,
    toSlot: number,
    mode: "swap" | "insert",
    tabIndex: number,
  ) => void;
  onMoveToTab: (
    fromSlot: number,
    fromTabIndex: number,
    toTabIndex: number,
    toSlot?: number,
  ) => void;
}

export interface DragState {
  draggedSlot: number | null;
  draggedTabIndex: number | null;
  dropMode: "swap" | "insert" | null;
  insertPosition: "before" | "after" | null;
  hoveredSlot: number | null;
  hoveredTabIndex: number | null;
}

interface UseDragDropReturn {
  // Current drag state (for visual rendering)
  dragState: DragState;

  // Stable callbacks for memoized BankSlotItem component
  handleSlotDragStart: (slotIndex: number, tabIndex: number) => void;
  handleSlotDragOver: (
    e: React.DragEvent,
    slotIndex: number,
    tabIndex: number,
  ) => void;
  handleSlotDragLeave: () => void;
  handleSlotDrop: (
    e: React.DragEvent,
    targetSlot: number,
    targetTabIndex: number,
  ) => void;
  handleSlotDragEnd: () => void;

  // Setters exposed for tab drag handling in JSX
  // (Tab bar has its own drag logic for moving items to tabs)
  setDraggedSlot: React.Dispatch<React.SetStateAction<number | null>>;
  setDraggedTabIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setHoveredTabIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setHoveredSlot: React.Dispatch<React.SetStateAction<number | null>>;
  setDropMode: React.Dispatch<React.SetStateAction<"swap" | "insert" | null>>;
  setInsertPosition: React.Dispatch<
    React.SetStateAction<"before" | "after" | null>
  >;

  // Reset all drag state
  resetDrag: () => void;
}

export function useDragDrop({
  onBankMove,
  onMoveToTab,
}: UseDragDropConfig): UseDragDropReturn {
  // ========== DRAG-DROP STATE ==========
  const [draggedSlot, setDraggedSlot] = useState<number | null>(null);
  const [draggedTabIndex, setDraggedTabIndex] = useState<number | null>(null);
  const [dropMode, setDropMode] = useState<"swap" | "insert" | null>(null);
  const [insertPosition, setInsertPosition] = useState<
    "before" | "after" | null
  >(null);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [hoveredTabIndex, setHoveredTabIndex] = useState<number | null>(null);

  // ========== PERFORMANCE: Throttle drag state updates to 60fps ==========
  const lastDragUpdateTime = useRef(0);

  // ========== RESET HELPER ==========
  const resetDrag = useCallback(() => {
    setDraggedSlot(null);
    setDraggedTabIndex(null);
    setDropMode(null);
    setInsertPosition(null);
    setHoveredSlot(null);
    setHoveredTabIndex(null);
  }, []);

  // ========== STABLE CALLBACKS FOR MEMOIZED SLOT COMPONENT ==========
  // These must be stable (useCallback) to prevent re-rendering all 480 slots

  const handleSlotDragStart = useCallback(
    (slotIndex: number, tabIndex: number) => {
      setDraggedSlot(slotIndex);
      setDraggedTabIndex(tabIndex);
    },
    [],
  );

  const handleSlotDragOver = useCallback(
    (e: React.DragEvent, slotIndex: number, tabIndex: number) => {
      e.preventDefault();
      if (draggedSlot === null) return;
      if (draggedSlot === slotIndex && draggedTabIndex === tabIndex) return;

      // CRITICAL: Throttle state updates to 60fps for smooth drag
      const now = performance.now();
      if (now - lastDragUpdateTime.current < DRAG_THROTTLE_MS) return;
      lastDragUpdateTime.current = now;

      setHoveredSlot(slotIndex);
      setHoveredTabIndex(tabIndex);

      // SIMPLE: Left 40% = insert before, Right 60% = swap
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;

      if (x < width * 0.4) {
        setDropMode("insert");
        setInsertPosition("before");
      } else {
        setDropMode("swap");
        setInsertPosition(null);
      }
    },
    [draggedSlot, draggedTabIndex],
  );

  const handleSlotDragLeave = useCallback(() => {
    setHoveredSlot(null);
    setHoveredTabIndex(null);
    setDropMode(null);
    setInsertPosition(null);
  }, []);

  const handleSlotDrop = useCallback(
    (e: React.DragEvent, targetSlot: number, targetTabIndex: number) => {
      e.preventDefault();
      if (draggedSlot !== null && draggedTabIndex !== null) {
        if (draggedTabIndex === targetTabIndex) {
          // Same tab: swap or insert within tab
          onBankMove(
            draggedSlot,
            targetSlot,
            dropMode || "swap",
            draggedTabIndex,
          );
        } else {
          // Different tab: move to tab
          onMoveToTab(draggedSlot, draggedTabIndex, targetTabIndex, targetSlot);
        }
      }
      resetDrag();
    },
    [
      draggedSlot,
      draggedTabIndex,
      dropMode,
      onBankMove,
      onMoveToTab,
      resetDrag,
    ],
  );

  const handleSlotDragEnd = useCallback(() => {
    resetDrag();
  }, [resetDrag]);

  // Memoize dragState to prevent unnecessary child re-renders during drag
  const dragState = useMemo<DragState>(
    () => ({
      draggedSlot,
      draggedTabIndex,
      dropMode,
      insertPosition,
      hoveredSlot,
      hoveredTabIndex,
    }),
    [
      draggedSlot,
      draggedTabIndex,
      dropMode,
      insertPosition,
      hoveredSlot,
      hoveredTabIndex,
    ],
  );

  return {
    dragState,
    handleSlotDragStart,
    handleSlotDragOver,
    handleSlotDragLeave,
    handleSlotDrop,
    handleSlotDragEnd,
    // Expose setters for tab-specific drag handling
    setDraggedSlot,
    setDraggedTabIndex,
    setHoveredTabIndex,
    setHoveredSlot,
    setDropMode,
    setInsertPosition,
    resetDrag,
  };
}
