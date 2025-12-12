/**
 * Vitest setup file for React component testing
 */
import { afterEach, vi, beforeAll } from "bun:test";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";

// Cleanup after each test
afterEach(() => {
  cleanup();
  // mock cleanup not needed in bun:test;
});

beforeAll(() => {
  // Mock WebGL context (required for Three.js)
  HTMLCanvasElement.prototype.getContext = mock((contextId) => {
    if (contextId === "webgl" || contextId === "webgl2") {
      return {
        canvas: document.createElement("canvas"),
        drawingBufferWidth: 800,
        drawingBufferHeight: 600,
        getParameter: mock(() => {}),
        getExtension: mock(() => {}),
        getShaderPrecisionFormat: mock(() => ({
          precision: 23,
          rangeMin: 127,
          rangeMax: 127,
        })),
        createProgram: mock(() => {}),
        createShader: mock(() => {}),
        shaderSource: mock(() => {}),
        compileShader: mock(() => {}),
        attachShader: mock(() => {}),
        linkProgram: mock(() => {}),
        getProgramParameter: mock(() => true),
        getShaderParameter: mock(() => true),
        deleteShader: mock(() => {}),
        useProgram: mock(() => {}),
        viewport: mock(() => {}),
        clearColor: mock(() => {}),
        clear: mock(() => {}),
        // Add more WebGL methods as needed
      } as unknown;
    }
    return null;
  });

  // Mock window.matchMedia
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: mock(() => {}).mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: mock(() => {}),
      removeListener: mock(() => {}),
      addEventListener: mock(() => {}),
      removeEventListener: mock(() => {}),
      dispatchEvent: mock(() => {}),
    })),
  });

  // Mock IntersectionObserver
  global.IntersectionObserver = mock(() => {}).mockImplementation(() => ({
    observe: mock(() => {}),
    unobserve: mock(() => {}),
    disconnect: mock(() => {}),
  })) as unknown;

  // Mock ResizeObserver
  global.ResizeObserver = mock(() => {}).mockImplementation(() => ({
    observe: mock(() => {}),
    unobserve: mock(() => {}),
    disconnect: mock(() => {}),
  })) as unknown as typeof ResizeObserver;
});
