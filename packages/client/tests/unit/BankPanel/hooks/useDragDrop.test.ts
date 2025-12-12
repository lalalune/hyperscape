/**
 * useDragDrop Hook Unit Tests
 *
 * Tests for drag-drop state management, throttling, and drop mode detection.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDragDrop } from "../../../../src/game/panels/BankPanel/hooks/useDragDrop";
import {
  createDragEventAtPosition,
  createInsertZoneDragEvent,
  createSwapZoneDragEvent,
  createMockDragEvent,
} from "../../../mocks";
import {
  enablePerformanceMock,
  setMockPerformanceNow,
  advanceMockPerformanceNow,
} from "../../../setup";
import { DRAG_THROTTLE_MS } from "../../../../src/game/panels/BankPanel/constants";

describe("useDragDrop", () => {
  const mockOnBankMove = vi.fn();
  const mockOnMoveToTab = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================================================
  // Initial State
  // ========================================================================

  describe("initial state", () => {
    it("starts with null dragState values", () => {
      const { result } = renderHook(() =>
        useDragDrop({
          onBankMove: mockOnBankMove,
          onMoveToTab: mockOnMoveToTab,
        }),
      );

      expect(result.current.dragState.draggedSlot).toBeNull();
      expect(result.current.dragState.draggedTabIndex).toBeNull();
      expect(result.current.dragState.dropMode).toBeNull();
      expect(result.current.dragState.insertPosition).toBeNull();
      expect(result.current.dragState.hoveredSlot).toBeNull();
      expect(result.current.dragState.hoveredTabIndex).toBeNull();
    });
  });

  // ========================================================================
  // Drag Start
  // ========================================================================

  describe("handleSlotDragStart", () => {
    it("sets draggedSlot and draggedTabIndex", () => {
      const { result } = renderHook(() =>
        useDragDrop({
          onBankMove: mockOnBankMove,
          onMoveToTab: mockOnMoveToTab,
        }),
      );

      act(() => {
        result.current.handleSlotDragStart(5, 2);
      });

      expect(result.current.dragState.draggedSlot).toBe(5);
      expect(result.current.dragState.draggedTabIndex).toBe(2);
    });

    it("can start drag from slot 0", () => {
      const { result } = renderHook(() =>
        useDragDrop({
          onBankMove: mockOnBankMove,
          onMoveToTab: mockOnMoveToTab,
        }),
      );

      act(() => {
        result.current.handleSlotDragStart(0, 0);
      });

      expect(result.current.dragState.draggedSlot).toBe(0);
      expect(result.current.dragState.draggedTabIndex).toBe(0);
    });
  });

  // ========================================================================
  // Drag Over
  // ========================================================================

  describe("handleSlotDragOver", () => {
    it("does nothing if no drag is in progress", () => {
      const { result } = renderHook(() =>
        useDragDrop({
          onBankMove: mockOnBankMove,
          onMoveToTab: mockOnMoveToTab,
        }),
      );

      const event = createMockDragEvent("dragover");

      act(() => {
        result.current.handleSlotDragOver(event, 10, 0);
      });

      expect(result.current.dragState.hoveredSlot).toBeNull();
    });

    it("does nothing when hovering over the dragged slot", () => {
      const { result } = renderHook(() =>
        useDragDrop({
          onBankMove: mockOnBankMove,
          onMoveToTab: mockOnMoveToTab,
        }),
      );

      act(() => {
        result.current.handleSlotDragStart(5, 0);
      });

      const event = createMockDragEvent("dragover");

      act(() => {
        result.current.handleSlotDragOver(event, 5, 0);
      });

      expect(result.current.dragState.hoveredSlot).toBeNull();
    });

    it("sets hoveredSlot and hoveredTabIndex on valid hover", () => {
      enablePerformanceMock();
      setMockPerformanceNow(0);

      const { result } = renderHook(() =>
        useDragDrop({
          onBankMove: mockOnBankMove,
          onMoveToTab: mockOnMoveToTab,
        }),
      );

      act(() => {
        result.current.handleSlotDragStart(5, 0);
      });

      // Advance time to pass throttle
      advanceMockPerformanceNow(DRAG_THROTTLE_MS + 1);

      const event = createSwapZoneDragEvent("dragover");

      act(() => {
        result.current.handleSlotDragOver(event, 10, 0);
      });

      expect(result.current.dragState.hoveredSlot).toBe(10);
      expect(result.current.dragState.hoveredTabIndex).toBe(0);
    });

    it("prevents default on drag event", () => {
      const { result } = renderHook(() =>
        useDragDrop({
          onBankMove: mockOnBankMove,
          onMoveToTab: mockOnMoveToTab,
        }),
      );

      act(() => {
        result.current.handleSlotDragStart(5, 0);
      });

      const event = createMockDragEvent("dragover");

      act(() => {
        result.current.handleSlotDragOver(event, 10, 0);
      });

      expect(event.preventDefault).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Drop Mode Detection (40% insert / 60% swap)
  // ========================================================================

  describe("drop mode detection", () => {
    it("sets insert mode when cursor is in left 40%", () => {
      enablePerformanceMock();
      setMockPerformanceNow(0);

      const { result } = renderHook(() =>
        useDragDrop({
          onBankMove: mockOnBankMove,
          onMoveToTab: mockOnMoveToTab,
        }),
      );

      act(() => {
        result.current.handleSlotDragStart(5, 0);
      });

      advanceMockPerformanceNow(DRAG_THROTTLE_MS + 1);

      // 20% of width = insert zone
      const event = createDragEventAtPosition("dragover", 0.2);

      act(() => {
        result.current.handleSlotDragOver(event, 10, 0);
      });

      expect(result.current.dragState.dropMode).toBe("insert");
      expect(result.current.dragState.insertPosition).toBe("before");
    });

    it("sets swap mode when cursor is in right 60%", () => {
      enablePerformanceMock();
      setMockPerformanceNow(0);

      const { result } = renderHook(() =>
        useDragDrop({
          onBankMove: mockOnBankMove,
          onMoveToTab: mockOnMoveToTab,
        }),
      );

      act(() => {
        result.current.handleSlotDragStart(5, 0);
      });

      advanceMockPerformanceNow(DRAG_THROTTLE_MS + 1);

      // 70% of width = swap zone
      const event = createDragEventAtPosition("dragover", 0.7);

      act(() => {
        result.current.handleSlotDragOver(event, 10, 0);
      });

      expect(result.current.dragState.dropMode).toBe("swap");
      expect(result.current.dragState.insertPosition).toBeNull();
    });

    it("treats exactly 40% as insert mode", () => {
      enablePerformanceMock();
      setMockPerformanceNow(0);

      const { result } = renderHook(() =>
        useDragDrop({
          onBankMove: mockOnBankMove,
          onMoveToTab: mockOnMoveToTab,
        }),
      );

      act(() => {
        result.current.handleSlotDragStart(5, 0);
      });

      advanceMockPerformanceNow(DRAG_THROTTLE_MS + 1);

      // Exactly 39.9% (just under 40%)
      const event = createDragEventAtPosition("dragover", 0.399);

      act(() => {
        result.current.handleSlotDragOver(event, 10, 0);
      });

      expect(result.current.dragState.dropMode).toBe("insert");
    });

    it("treats 41% as swap mode", () => {
      enablePerformanceMock();
      setMockPerformanceNow(0);

      const { result } = renderHook(() =>
        useDragDrop({
          onBankMove: mockOnBankMove,
          onMoveToTab: mockOnMoveToTab,
        }),
      );

      act(() => {
        result.current.handleSlotDragStart(5, 0);
      });

      advanceMockPerformanceNow(DRAG_THROTTLE_MS + 1);

      // 41% of width = swap zone
      const event = createDragEventAtPosition("dragover", 0.41);

      act(() => {
        result.current.handleSlotDragOver(event, 10, 0);
      });

      expect(result.current.dragState.dropMode).toBe("swap");
    });
  });

  // ========================================================================
  // 60fps Throttle
  // ========================================================================

  describe("60fps throttle", () => {
    it("throttles state updates to 16ms intervals", () => {
      enablePerformanceMock();
      setMockPerformanceNow(0);

      const { result } = renderHook(() =>
        useDragDrop({
          onBankMove: mockOnBankMove,
          onMoveToTab: mockOnMoveToTab,
        }),
      );

      act(() => {
        result.current.handleSlotDragStart(5, 0);
      });

      // First dragover - should work (enough time passed from start)
      advanceMockPerformanceNow(DRAG_THROTTLE_MS + 1);
      const event1 = createSwapZoneDragEvent("dragover");

      act(() => {
        result.current.handleSlotDragOver(event1, 10, 0);
      });

      expect(result.current.dragState.hoveredSlot).toBe(10);

      // Second dragover too soon - should be throttled
      advanceMockPerformanceNow(5); // Only 5ms passed
      const event2 = createSwapZoneDragEvent("dragover");

      act(() => {
        result.current.handleSlotDragOver(event2, 15, 0);
      });

      // Should still be 10, not updated to 15
      expect(result.current.dragState.hoveredSlot).toBe(10);

      // Third dragover after throttle period - should work
      advanceMockPerformanceNow(DRAG_THROTTLE_MS + 1);
      const event3 = createSwapZoneDragEvent("dragover");

      act(() => {
        result.current.handleSlotDragOver(event3, 20, 0);
      });

      expect(result.current.dragState.hoveredSlot).toBe(20);
    });
  });

  // ========================================================================
  // Drag Leave
  // ========================================================================

  describe("handleSlotDragLeave", () => {
    it("clears hover and drop state", () => {
      enablePerformanceMock();
      setMockPerformanceNow(0);

      const { result } = renderHook(() =>
        useDragDrop({
          onBankMove: mockOnBankMove,
          onMoveToTab: mockOnMoveToTab,
        }),
      );

      // Start drag
      act(() => {
        result.current.handleSlotDragStart(5, 0);
      });

      // Hover over a slot
      advanceMockPerformanceNow(DRAG_THROTTLE_MS + 1);
      const event = createSwapZoneDragEvent("dragover");

      act(() => {
        result.current.handleSlotDragOver(event, 10, 0);
      });

      expect(result.current.dragState.hoveredSlot).toBe(10);

      // Leave the slot
      act(() => {
        result.current.handleSlotDragLeave();
      });

      expect(result.current.dragState.hoveredSlot).toBeNull();
      expect(result.current.dragState.hoveredTabIndex).toBeNull();
      expect(result.current.dragState.dropMode).toBeNull();
      expect(result.current.dragState.insertPosition).toBeNull();
    });
  });

  // ========================================================================
  // Drag Drop
  // ========================================================================

  describe("handleSlotDrop", () => {
    it("calls onBankMove for same-tab drop with swap mode", () => {
      enablePerformanceMock();
      setMockPerformanceNow(0);

      const { result } = renderHook(() =>
        useDragDrop({
          onBankMove: mockOnBankMove,
          onMoveToTab: mockOnMoveToTab,
        }),
      );

      // Start drag
      act(() => {
        result.current.handleSlotDragStart(5, 0);
      });

      // Hover to set swap mode
      advanceMockPerformanceNow(DRAG_THROTTLE_MS + 1);
      const hoverEvent = createSwapZoneDragEvent("dragover");

      act(() => {
        result.current.handleSlotDragOver(hoverEvent, 10, 0);
      });

      // Drop
      const dropEvent = createMockDragEvent("drop");

      act(() => {
        result.current.handleSlotDrop(dropEvent, 10, 0);
      });

      expect(mockOnBankMove).toHaveBeenCalledWith(5, 10, "swap", 0);
      expect(mockOnMoveToTab).not.toHaveBeenCalled();
    });

    it("calls onBankMove for same-tab drop with insert mode", () => {
      enablePerformanceMock();
      setMockPerformanceNow(0);

      const { result } = renderHook(() =>
        useDragDrop({
          onBankMove: mockOnBankMove,
          onMoveToTab: mockOnMoveToTab,
        }),
      );

      // Start drag
      act(() => {
        result.current.handleSlotDragStart(5, 0);
      });

      // Hover to set insert mode
      advanceMockPerformanceNow(DRAG_THROTTLE_MS + 1);
      const hoverEvent = createInsertZoneDragEvent("dragover");

      act(() => {
        result.current.handleSlotDragOver(hoverEvent, 10, 0);
      });

      // Drop
      const dropEvent = createMockDragEvent("drop");

      act(() => {
        result.current.handleSlotDrop(dropEvent, 10, 0);
      });

      expect(mockOnBankMove).toHaveBeenCalledWith(5, 10, "insert", 0);
    });

    it("calls onMoveToTab for cross-tab drop", () => {
      const { result } = renderHook(() =>
        useDragDrop({
          onBankMove: mockOnBankMove,
          onMoveToTab: mockOnMoveToTab,
        }),
      );

      // Start drag from tab 0
      act(() => {
        result.current.handleSlotDragStart(5, 0);
      });

      // Drop on tab 2
      const dropEvent = createMockDragEvent("drop");

      act(() => {
        result.current.handleSlotDrop(dropEvent, 10, 2);
      });

      expect(mockOnMoveToTab).toHaveBeenCalledWith(5, 0, 2, 10);
      expect(mockOnBankMove).not.toHaveBeenCalled();
    });

    it("resets drag state after drop", () => {
      const { result } = renderHook(() =>
        useDragDrop({
          onBankMove: mockOnBankMove,
          onMoveToTab: mockOnMoveToTab,
        }),
      );

      // Start drag
      act(() => {
        result.current.handleSlotDragStart(5, 0);
      });

      // Drop
      const dropEvent = createMockDragEvent("drop");

      act(() => {
        result.current.handleSlotDrop(dropEvent, 10, 0);
      });

      expect(result.current.dragState.draggedSlot).toBeNull();
      expect(result.current.dragState.draggedTabIndex).toBeNull();
      expect(result.current.dragState.dropMode).toBeNull();
    });

    it("prevents default on drop event", () => {
      const { result } = renderHook(() =>
        useDragDrop({
          onBankMove: mockOnBankMove,
          onMoveToTab: mockOnMoveToTab,
        }),
      );

      act(() => {
        result.current.handleSlotDragStart(5, 0);
      });

      const dropEvent = createMockDragEvent("drop");

      act(() => {
        result.current.handleSlotDrop(dropEvent, 10, 0);
      });

      expect(dropEvent.preventDefault).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Drag End
  // ========================================================================

  describe("handleSlotDragEnd", () => {
    it("resets all drag state", () => {
      enablePerformanceMock();
      setMockPerformanceNow(0);

      const { result } = renderHook(() =>
        useDragDrop({
          onBankMove: mockOnBankMove,
          onMoveToTab: mockOnMoveToTab,
        }),
      );

      // Start drag
      act(() => {
        result.current.handleSlotDragStart(5, 2);
      });

      // Hover
      advanceMockPerformanceNow(DRAG_THROTTLE_MS + 1);
      const event = createSwapZoneDragEvent("dragover");

      act(() => {
        result.current.handleSlotDragOver(event, 10, 2);
      });

      // End drag
      act(() => {
        result.current.handleSlotDragEnd();
      });

      expect(result.current.dragState.draggedSlot).toBeNull();
      expect(result.current.dragState.draggedTabIndex).toBeNull();
      expect(result.current.dragState.hoveredSlot).toBeNull();
      expect(result.current.dragState.hoveredTabIndex).toBeNull();
      expect(result.current.dragState.dropMode).toBeNull();
      expect(result.current.dragState.insertPosition).toBeNull();
    });
  });

  // ========================================================================
  // Reset Drag
  // ========================================================================

  describe("resetDrag", () => {
    it("clears all drag state", () => {
      const { result } = renderHook(() =>
        useDragDrop({
          onBankMove: mockOnBankMove,
          onMoveToTab: mockOnMoveToTab,
        }),
      );

      // Set up some state
      act(() => {
        result.current.handleSlotDragStart(5, 2);
        result.current.setHoveredSlot(10);
        result.current.setHoveredTabIndex(3);
        result.current.setDropMode("swap");
        result.current.setInsertPosition("before");
      });

      // Reset
      act(() => {
        result.current.resetDrag();
      });

      expect(result.current.dragState.draggedSlot).toBeNull();
      expect(result.current.dragState.draggedTabIndex).toBeNull();
      expect(result.current.dragState.hoveredSlot).toBeNull();
      expect(result.current.dragState.hoveredTabIndex).toBeNull();
      expect(result.current.dragState.dropMode).toBeNull();
      expect(result.current.dragState.insertPosition).toBeNull();
    });
  });

  // ========================================================================
  // dragState Memoization
  // ========================================================================

  describe("dragState memoization", () => {
    it("returns same dragState reference when values unchanged", () => {
      const { result, rerender } = renderHook(() =>
        useDragDrop({
          onBankMove: mockOnBankMove,
          onMoveToTab: mockOnMoveToTab,
        }),
      );

      const firstState = result.current.dragState;
      rerender();
      const secondState = result.current.dragState;

      expect(firstState).toBe(secondState);
    });

    it("returns new dragState reference when values change", () => {
      const { result } = renderHook(() =>
        useDragDrop({
          onBankMove: mockOnBankMove,
          onMoveToTab: mockOnMoveToTab,
        }),
      );

      const firstState = result.current.dragState;

      act(() => {
        result.current.handleSlotDragStart(5, 0);
      });

      const secondState = result.current.dragState;

      expect(firstState).not.toBe(secondState);
    });
  });

  // ========================================================================
  // Callback Stability
  // ========================================================================

  describe("callback stability", () => {
    it("returns stable callbacks across rerenders", () => {
      const { result, rerender } = renderHook(() =>
        useDragDrop({
          onBankMove: mockOnBankMove,
          onMoveToTab: mockOnMoveToTab,
        }),
      );

      const first = {
        handleSlotDragStart: result.current.handleSlotDragStart,
        handleSlotDragLeave: result.current.handleSlotDragLeave,
        handleSlotDragEnd: result.current.handleSlotDragEnd,
        resetDrag: result.current.resetDrag,
      };

      rerender();

      expect(result.current.handleSlotDragStart).toBe(
        first.handleSlotDragStart,
      );
      expect(result.current.handleSlotDragLeave).toBe(
        first.handleSlotDragLeave,
      );
      expect(result.current.handleSlotDragEnd).toBe(first.handleSlotDragEnd);
      expect(result.current.resetDrag).toBe(first.resetDrag);
    });
  });
});
