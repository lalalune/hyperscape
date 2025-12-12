/**
 * MockDragEvent - Factory for creating mock drag events
 *
 * Provides utilities for testing drag-drop interactions.
 */

import { vi } from "vitest";

export interface MockDragEventInit {
  clientX?: number;
  clientY?: number;
  dataTransfer?: Partial<DataTransfer>;
}

export interface MockRect {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  x: number;
  y: number;
  toJSON: () => DOMRect;
}

/**
 * Creates a mock DragEvent
 */
export function createMockDragEvent(
  type: string,
  init: MockDragEventInit = {},
): React.DragEvent {
  const defaultDataTransfer: Partial<DataTransfer> = {
    effectAllowed: "move",
    dropEffect: "none",
    setData: vi.fn(),
    getData: vi.fn().mockReturnValue(""),
    clearData: vi.fn(),
  };

  const event = {
    type,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    dataTransfer: {
      ...defaultDataTransfer,
      ...init.dataTransfer,
    } as DataTransfer,
    currentTarget: createMockElement(),
    target: createMockElement(),
    bubbles: true,
    cancelable: true,
    defaultPrevented: false,
    eventPhase: 0,
    isTrusted: false,
    timeStamp: Date.now(),
    nativeEvent: {} as DragEvent,
    isDefaultPrevented: vi.fn().mockReturnValue(false),
    isPropagationStopped: vi.fn().mockReturnValue(false),
    persist: vi.fn(),
  } as unknown as React.DragEvent;

  return event;
}

/**
 * Creates a mock element with getBoundingClientRect
 */
export function createMockElement(rect?: Partial<MockRect>): HTMLElement {
  const defaultRect: MockRect = {
    left: 0,
    top: 0,
    width: 42,
    height: 42,
    right: 42,
    bottom: 42,
    x: 0,
    y: 0,
    toJSON: () =>
      ({
        left: 0,
        top: 0,
        width: 42,
        height: 42,
        right: 42,
        bottom: 42,
        x: 0,
        y: 0,
      }) as DOMRect,
  };

  const element = {
    getBoundingClientRect: vi.fn().mockReturnValue({
      ...defaultRect,
      ...rect,
    }),
    style: {},
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn().mockReturnValue(false),
    },
  } as unknown as HTMLElement;

  return element;
}

/**
 * Creates a drag event positioned at a specific percentage of an element's width
 *
 * @param type - Event type (dragover, drop, etc.)
 * @param percentX - Position as percentage of element width (0-1)
 * @param elementWidth - Width of the target element
 */
export function createDragEventAtPosition(
  type: string,
  percentX: number,
  elementWidth: number = 42,
): React.DragEvent {
  const left = 0;
  const clientX = left + elementWidth * percentX;

  const event = createMockDragEvent(type, { clientX });

  // Override currentTarget with element that has the correct rect
  (event as { currentTarget: HTMLElement }).currentTarget = createMockElement({
    left,
    width: elementWidth,
    right: left + elementWidth,
  });

  return event;
}

/**
 * Creates a drag event for the "insert" zone (left 40%)
 */
export function createInsertZoneDragEvent(type: string): React.DragEvent {
  // Position at 20% of width (within left 40%)
  return createDragEventAtPosition(type, 0.2);
}

/**
 * Creates a drag event for the "swap" zone (right 60%)
 */
export function createSwapZoneDragEvent(type: string): React.DragEvent {
  // Position at 70% of width (within right 60%)
  return createDragEventAtPosition(type, 0.7);
}

/**
 * Creates a mock MouseEvent for context menu testing
 */
export function createMockMouseEvent(
  type: string,
  init: { clientX?: number; clientY?: number } = {},
): React.MouseEvent {
  return {
    type,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    clientX: init.clientX ?? 100,
    clientY: init.clientY ?? 100,
    currentTarget: createMockElement(),
    target: createMockElement(),
    bubbles: true,
    cancelable: true,
    nativeEvent: {} as MouseEvent,
    isDefaultPrevented: vi.fn().mockReturnValue(false),
    isPropagationStopped: vi.fn().mockReturnValue(false),
    persist: vi.fn(),
  } as unknown as React.MouseEvent;
}
