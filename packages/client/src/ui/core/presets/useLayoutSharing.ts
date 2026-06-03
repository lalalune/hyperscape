/**
 * Layout Sharing System
 *
 * Enables sharing layout presets between players via share codes.
 * Supports encoding/decoding, import/export, and validation.
 *
 * @packageDocumentation
 */

import { useCallback, useState } from "react";
import { useWindowStore } from "../../stores/windowStore";
import type { WindowState, TabState } from "../../types";

/** Serialized layout for sharing */
export interface SharedLayout {
  version: number;
  name: string;
  windows: SerializedWindow[];
  resolution?: { width: number; height: number };
  createdAt: string;
  checksum: string;
}

/** Serialized window for sharing */
interface SerializedWindow {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tabs: string[];
  active: number;
  transparency: number;
}

/** Share code format version */
const SHARE_CODE_VERSION = 1;

/** Share code prefix */
const SHARE_CODE_PREFIX = "HSL"; // Hyperia Layout

/** Return value from useLayoutSharing */
export interface LayoutSharingResult {
  /** Generate a share code from current layout */
  generateShareCode: (name?: string, includeResolution?: boolean) => string;
  /** Import layout from share code */
  importFromShareCode: (code: string) => SharedLayout | null;
  /** Apply a shared layout */
  applySharedLayout: (
    layout: SharedLayout,
    scaleToResolution?: boolean,
  ) => void;
  /** Validate a share code */
  validateShareCode: (code: string) => { valid: boolean; error?: string };
  /** Export layout as JSON string */
  exportAsJSON: (name?: string) => string;
  /** Import layout from JSON string */
  importFromJSON: (json: string) => SharedLayout | null;
  /** Current error (if any) */
  error: string | null;
  /** Clear error */
  clearError: () => void;
}

/**
 * Calculate simple checksum for validation
 */
function calculateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 6);
}

/**
 * Encode layout to base64 share code
 */
function encodeLayout(layout: Omit<SharedLayout, "checksum">): string {
  const json = JSON.stringify(layout);
  const checksum = calculateChecksum(json);
  const fullData = { ...layout, checksum };
  const encoded = btoa(JSON.stringify(fullData));
  return `${SHARE_CODE_PREFIX}${SHARE_CODE_VERSION}-${encoded}`;
}

/**
 * Decode base64 share code to layout
 */
function decodeLayout(code: string): SharedLayout | null {
  try {
    // Validate prefix
    if (!code.startsWith(SHARE_CODE_PREFIX)) {
      return null;
    }

    // Extract version and data
    const withoutPrefix = code.substring(SHARE_CODE_PREFIX.length);
    const dashIndex = withoutPrefix.indexOf("-");
    if (dashIndex === -1) {
      return null;
    }

    const version = parseInt(withoutPrefix.substring(0, dashIndex), 10);
    if (version !== SHARE_CODE_VERSION) {
      // Could add version migration here
      return null;
    }

    const encoded = withoutPrefix.substring(dashIndex + 1);
    const json = atob(encoded);
    const layout = JSON.parse(json) as SharedLayout;

    // Validate checksum
    const { checksum, ...rest } = layout;
    const expectedChecksum = calculateChecksum(JSON.stringify(rest));
    if (checksum !== expectedChecksum) {
      return null;
    }

    return layout;
  } catch {
    return null;
  }
}

/**
 * Serialize windows for sharing
 */
function serializeWindows(windows: WindowState[]): SerializedWindow[] {
  return windows.map((w) => ({
    id: w.id,
    x: Math.round(w.position.x),
    y: Math.round(w.position.y),
    w: Math.round(w.size.width),
    h: Math.round(w.size.height),
    // Extract content as string (panel ID) for each tab
    tabs: w.tabs.map((t) =>
      typeof t.content === "string" ? t.content : t.label,
    ),
    active: w.activeTabIndex,
    transparency: w.transparency,
  }));
}

/**
 * Deserialize windows from shared layout
 */
function deserializeWindows(serialized: SerializedWindow[]): WindowState[] {
  return serialized.map((s, index) => {
    const windowId = s.id || `window-${index}`;
    return {
      id: windowId,
      position: { x: s.x, y: s.y },
      size: { width: s.w, height: s.h },
      minSize: { width: 100, height: 100 }, // Default min size
      tabs: s.tabs.map(
        (panelId, tabIndex): TabState => ({
          id: `${windowId}-tab-${tabIndex}`,
          windowId,
          label:
            panelId.charAt(0).toUpperCase() +
            panelId.slice(1).replace(/_/g, " "),
          content: panelId, // Store panel ID as content
          closeable: true,
        }),
      ),
      activeTabIndex: s.active,
      transparency: s.transparency,
      visible: true,
      zIndex: index,
      locked: false,
    };
  });
}

/**
 * Scale layout to current resolution
 */
function scaleLayout(
  windows: WindowState[],
  fromResolution: { width: number; height: number },
): WindowState[] {
  const currentWidth = typeof window !== "undefined" ? window.innerWidth : 1920;
  const currentHeight =
    typeof window !== "undefined" ? window.innerHeight : 1080;

  if (
    fromResolution.width === currentWidth &&
    fromResolution.height === currentHeight
  ) {
    return windows;
  }

  const scaleX = currentWidth / fromResolution.width;
  const scaleY = currentHeight / fromResolution.height;

  return windows.map((w) => ({
    ...w,
    position: {
      x: Math.round(w.position.x * scaleX),
      y: Math.round(w.position.y * scaleY),
    },
    size: {
      width: Math.round(w.size.width * scaleX),
      height: Math.round(w.size.height * scaleY),
    },
  }));
}

/**
 * Hook for layout sharing functionality
 *
 * @example
 * ```tsx
 * function LayoutSharingUI() {
 *   const {
 *     generateShareCode,
 *     importFromShareCode,
 *     applySharedLayout,
 *     error,
 *   } = useLayoutSharing();
 *
 *   const [shareCode, setShareCode] = useState('');
 *   const [importCode, setImportCode] = useState('');
 *
 *   const handleShare = () => {
 *     const code = generateShareCode('My PvM Layout', true);
 *     setShareCode(code);
 *     navigator.clipboard.writeText(code);
 *   };
 *
 *   const handleImport = () => {
 *     const layout = importFromShareCode(importCode);
 *     if (layout) {
 *       applySharedLayout(layout, true);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleShare}>Share Layout</button>
 *       {shareCode && <input readOnly value={shareCode} />}
 *
 *       <input
 *         value={importCode}
 *         onChange={(e) => setImportCode(e.target.value)}
 *         placeholder="Paste share code..."
 *       />
 *       <button onClick={handleImport}>Import</button>
 *
 *       {error && <div className="error">{error}</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useLayoutSharing(): LayoutSharingResult {
  const getAllWindows = useWindowStore((s) => s.getAllWindows);
  const setWindows = useWindowStore((s) => s.setWindows);

  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const generateShareCode = useCallback(
    (name: string = "Shared Layout", includeResolution: boolean = true) => {
      const windows = getAllWindows();
      const serialized = serializeWindows(windows);

      const layout: Omit<SharedLayout, "checksum"> = {
        version: SHARE_CODE_VERSION,
        name,
        windows: serialized,
        resolution: includeResolution
          ? {
              width: typeof window !== "undefined" ? window.innerWidth : 1920,
              height: typeof window !== "undefined" ? window.innerHeight : 1080,
            }
          : undefined,
        createdAt: new Date().toISOString(),
      };

      return encodeLayout(layout);
    },
    [getAllWindows],
  );

  const importFromShareCode = useCallback(
    (code: string): SharedLayout | null => {
      clearError();

      const layout = decodeLayout(code.trim());
      if (!layout) {
        setError("Invalid share code");
        return null;
      }

      return layout;
    },
    [clearError],
  );

  const validateShareCode = useCallback(
    (code: string): { valid: boolean; error?: string } => {
      if (!code.trim()) {
        return { valid: false, error: "Empty share code" };
      }

      if (!code.startsWith(SHARE_CODE_PREFIX)) {
        return { valid: false, error: "Invalid share code format" };
      }

      const layout = decodeLayout(code.trim());
      if (!layout) {
        return { valid: false, error: "Failed to decode share code" };
      }

      if (!layout.windows || layout.windows.length === 0) {
        return { valid: false, error: "No windows in layout" };
      }

      return { valid: true };
    },
    [],
  );

  const applySharedLayout = useCallback(
    (layout: SharedLayout, scaleToResolution: boolean = true) => {
      clearError();

      try {
        let windows = deserializeWindows(layout.windows);

        if (scaleToResolution && layout.resolution) {
          windows = scaleLayout(windows, layout.resolution);
        }

        setWindows(windows);
      } catch (err) {
        setError(`Failed to apply layout: ${err}`);
      }
    },
    [setWindows, clearError],
  );

  const exportAsJSON = useCallback(
    (name: string = "Exported Layout"): string => {
      const windows = getAllWindows();
      const serialized = serializeWindows(windows);

      const layout: SharedLayout = {
        version: SHARE_CODE_VERSION,
        name,
        windows: serialized,
        resolution: {
          width: typeof window !== "undefined" ? window.innerWidth : 1920,
          height: typeof window !== "undefined" ? window.innerHeight : 1080,
        },
        createdAt: new Date().toISOString(),
        checksum: "",
      };

      const json = JSON.stringify(layout, null, 2);
      layout.checksum = calculateChecksum(json);

      return JSON.stringify(layout, null, 2);
    },
    [getAllWindows],
  );

  const importFromJSON = useCallback(
    (json: string): SharedLayout | null => {
      clearError();

      try {
        const layout = JSON.parse(json) as SharedLayout;

        if (!layout.version || !layout.windows) {
          setError("Invalid layout JSON");
          return null;
        }

        return layout;
      } catch {
        setError("Failed to parse JSON");
        return null;
      }
    },
    [clearError],
  );

  return {
    generateShareCode,
    importFromShareCode,
    applySharedLayout,
    validateShareCode,
    exportAsJSON,
    importFromJSON,
    error,
    clearError,
  };
}
