/**
 * Vitest setup file for React component testing
 */
import { afterEach, vi, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeAll(() => {
  // Mock WebGL context (required for Three.js)
  HTMLCanvasElement.prototype.getContext = vi.fn((contextId) => {
    if (contextId === "webgl" || contextId === "webgl2") {
      return {
        canvas: document.createElement("canvas"),
        drawingBufferWidth: 800,
        drawingBufferHeight: 600,
        getParameter: vi.fn(),
        getExtension: vi.fn(),
        getShaderPrecisionFormat: vi.fn(() => ({
          precision: 23,
          rangeMin: 127,
          rangeMax: 127,
        })),
        createProgram: vi.fn(),
        createShader: vi.fn(),
        shaderSource: vi.fn(),
        compileShader: vi.fn(),
        attachShader: vi.fn(),
        linkProgram: vi.fn(),
        getProgramParameter: vi.fn(() => true),
        getShaderParameter: vi.fn(() => true),
        deleteShader: vi.fn(),
        useProgram: vi.fn(),
        viewport: vi.fn(),
        clearColor: vi.fn(),
        clear: vi.fn(),
        // Add more WebGL methods as needed
      } as unknown;
    }
    return null;
  });

  // Mock window.matchMedia
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })) as unknown;

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })) as unknown as typeof ResizeObserver;
});
