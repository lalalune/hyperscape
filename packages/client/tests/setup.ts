/**
 * Vitest Setup File
 *
 * Configures the test environment with required global mocks.
 */

import { expect, vi, beforeEach, afterEach } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// ============================================================================
// BROWSER API MOCKS
// ============================================================================

// Mock DataTransfer for drag events (jsdom doesn't support it)
class MockDataTransfer implements DataTransfer {
  dropEffect: DataTransfer["dropEffect"] = "none";
  effectAllowed: DataTransfer["effectAllowed"] = "all";
  readonly items = [] as unknown as DataTransferItemList;
  readonly types: readonly string[] = [];
  readonly files = [] as unknown as FileList;

  clearData(): void {}
  getData(): string {
    return "";
  }
  setData(): void {}
  setDragImage(): void {}
}

// Patch DragEvent to include dataTransfer
const originalDragEvent = globalThis.DragEvent;
class PatchedDragEvent extends Event {
  readonly dataTransfer: DataTransfer;

  constructor(type: string, eventInitDict?: DragEventInit) {
    super(type, eventInitDict);
    this.dataTransfer = eventInitDict?.dataTransfer ?? new MockDataTransfer();
  }
}

Object.defineProperty(globalThis, "DragEvent", {
  value: PatchedDragEvent,
  writable: true,
});

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(
    _callback: IntersectionObserverCallback,
    _options?: IntersectionObserverInit,
  ) {}

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver
class MockResizeObserver implements ResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: MockResizeObserver,
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// ============================================================================
// PERFORMANCE MOCKS
// ============================================================================

// Mock performance.now for throttle testing
let mockNow = 0;
const originalPerformanceNow = performance.now.bind(performance);

export function setMockPerformanceNow(time: number): void {
  mockNow = time;
}

export function advanceMockPerformanceNow(delta: number): void {
  mockNow += delta;
}

export function resetMockPerformanceNow(): void {
  mockNow = 0;
}

// Conditionally mock performance.now - tests can opt-in
export function enablePerformanceMock(): void {
  vi.spyOn(performance, "now").mockImplementation(() => mockNow);
}

export function disablePerformanceMock(): void {
  vi.spyOn(performance, "now").mockImplementation(originalPerformanceNow);
}

// ============================================================================
// REACT-DOM MOCKS
// ============================================================================

// Mock createPortal for modal testing
vi.mock("react-dom", async () => {
  const actual = await vi.importActual("react-dom");
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

// ============================================================================
// @HYPERSCAPE/SHARED MOCKS
// ============================================================================

// The @hyperscape/shared package is mocked via vitest.config.ts alias
// to tests/mocks/hyperscape-shared.ts which provides mock implementations

// ============================================================================
// TEST LIFECYCLE
// ============================================================================

beforeEach(() => {
  // Clear localStorage between tests
  localStorageMock.clear();
  vi.clearAllMocks();
  resetMockPerformanceNow();
});

afterEach(() => {
  vi.restoreAllMocks();
});
