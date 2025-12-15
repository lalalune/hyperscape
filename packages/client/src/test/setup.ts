/**
 * Vitest setup file for React component testing
 */
/// <reference types="bun-types" />
import { afterEach, beforeAll, mock } from "bun:test";
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
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  // Mock window.matchMedia
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: mock(() => {}).mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: mock(() => {}),
      removeListener: mock(() => {}),
      addEventListener: mock(() => {}),
      removeEventListener: mock(() => {}),
      dispatchEvent: mock(() => {}),
    })) as unknown as typeof window.matchMedia,
  });

  // Mock IntersectionObserver
  const MockIntersectionObserver = mock((_callback: globalThis.IntersectionObserverCallback) => ({
    observe: mock(() => {}),
    unobserve: mock(() => {}),
    disconnect: mock(() => {}),
  }));
  // Add prototype to satisfy TypeScript
  Object.defineProperty(MockIntersectionObserver, "prototype", {
    value: {},
    writable: true,
    configurable: true,
  });
  global.IntersectionObserver = MockIntersectionObserver as unknown as typeof globalThis.IntersectionObserver;

  // Mock ResizeObserver
  global.ResizeObserver = mock(() => {}).mockImplementation(() => ({
    observe: mock(() => {}),
    unobserve: mock(() => {}),
    disconnect: mock(() => {}),
  })) as unknown as typeof ResizeObserver;
});
