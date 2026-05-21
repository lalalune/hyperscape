/**
 * LayoutPreview — interactive canvas for widget placement.
 *
 * Renders a 1280x720 logical viewport containing every visible widget
 * instance, **rendered with its real React component** so the editor
 * is WYSIWYG with the live game HUD. Supports:
 *   - Click a box to select (drives the inspector).
 *   - Click empty canvas to deselect.
 *   - Drag a box with the left mouse button to reposition. The
 *     position kind is preserved:
 *       - anchored → offset.x/y accumulate in logical pixels.
 *       - grid     → column/row snap to the manifest's grid.
 *       - flex     → not draggable (no canvas-equivalent layout).
 *   - Grid overlay: thin cell lines whenever `layout.grid` is defined.
 *
 * Props for each widget are resolved through the same
 * `resolveWidgetProps` pipeline the live HUD uses, against the editor
 * mock DataContext. That way bindings like `$player.hp` resolve to
 * plausible preview values and render real visuals.
 */

import {
  type AlignmentGuide,
  type AnchoredPosition,
  applyLayoutVariant,
  type Box,
  computeAlignmentSnap,
  type LayoutAnchor,
  resolveWidgetProps,
  snapBoxToViewport,
  type WidgetCustomization,
  type WidgetInstance,
  type WidgetPosition,
} from "@hyperforge/ui-framework";
import { ItemIconProvider } from "@hyperforge/ui-widgets";
import { useCallback, useEffect, useRef, useState } from "react";
import { CanvasContextMenu } from "./CanvasContextMenu";
import { getPreset, useCanvasViewStore } from "./canvasViewStore";
import { editorMockDataContext } from "./mockDataContext";
import { uiLayoutRegistry } from "./registry";
import { useUILayoutStore } from "./store";

/**
 * Widget default-size unit in logical pixels. A widget with
 * `defaultSize { width: 3, height: 2 }` renders as 72×48 px on the
 * canvas regardless of which preset is active.
 */
const UNIT_PX = 24;
/**
 * Pixel distance at which sibling/viewport alignment snaps kick in.
 * Matches the in-game edit overlay so authors get identical snap
 * behaviour whether they're placing widgets in World Studio or in the
 * live HUD edit mode.
 */
const SNAP_THRESHOLD_PX = 8;

export function LayoutPreview() {
  const layout = useUILayoutStore((s) => s.layout);
  const instances = layout.instances;
  const grid = layout.grid;
  const selectedId = useUILayoutStore((s) => s.selectedInstanceId);
  const additionalSelectionIds = useUILayoutStore(
    (s) => s.additionalSelectionIds,
  );
  const select = useUILayoutStore((s) => s.selectInstance);
  const toggleSelection = useUILayoutStore((s) => s.toggleSelection);
  const updatePosition = useUILayoutStore((s) => s.updateInstancePosition);
  const removeInstance = useUILayoutStore((s) => s.removeInstance);
  const removeInstances = useUILayoutStore((s) => s.removeInstances);
  const duplicateInstance = useUILayoutStore((s) => s.duplicateInstance);
  const duplicateInstances = useUILayoutStore((s) => s.duplicateInstances);
  const undo = useUILayoutStore((s) => s.undo);
  const redo = useUILayoutStore((s) => s.redo);
  const moveToFront = useUILayoutStore((s) => s.moveInstanceToFront);
  const moveToBack = useUILayoutStore((s) => s.moveInstanceToBack);
  const moveForward = useUILayoutStore((s) => s.moveInstanceForward);
  const moveBackward = useUILayoutStore((s) => s.moveInstanceBackward);
  const moveInstancesToFront = useUILayoutStore((s) => s.moveInstancesToFront);
  const moveInstancesToBack = useUILayoutStore((s) => s.moveInstancesToBack);
  const moveInstancesForward = useUILayoutStore((s) => s.moveInstancesForward);
  const moveInstancesBackward = useUILayoutStore(
    (s) => s.moveInstancesBackward,
  );

  const presetId = useCanvasViewStore((s) => s.presetId);
  const zoom = useCanvasViewStore((s) => s.zoom);
  const pan = useCanvasViewStore((s) => s.pan);
  const showGrid = useCanvasViewStore((s) => s.showGrid);
  const showGuides = useCanvasViewStore((s) => s.showGuides);
  const showRulers = useCanvasViewStore((s) => s.showRulers);
  const showCheckerboard = useCanvasViewStore((s) => s.showCheckerboard);
  const activeVariant = useCanvasViewStore((s) => s.activeVariant);
  const setZoom = useCanvasViewStore((s) => s.setZoom);
  const setPan = useCanvasViewStore((s) => s.setPan);
  const panBy = useCanvasViewStore((s) => s.panBy);
  const resetView = useCanvasViewStore((s) => s.resetView);

  const preset = getPreset(presetId);
  const viewportWidth = preset.width;
  const viewportHeight = preset.height;

  const outerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Alignment guides reported by whichever widget is currently being
  // dragged. Cleared on drag end. Guides are in logical pixel
  // coordinates relative to the active viewport.
  const [guides, setGuides] = useState<AlignmentGuide[]>([]);

  // Right-click context menu state. Cleared by ESC, outside click,
  // or any menu action. Pointer coords are in window space; the
  // menu clamps itself to the viewport.
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    instanceId: string;
  } | null>(null);

  // Pan-drag state (middle-click or space-hold + left-click).
  const panDragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startPan: { x: number; y: number };
  } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  // Marquee (rubber-band) selection state. Coordinates are in
  // VIEWPORT-LOCAL LOGICAL pixels so the overlay rectangle can be
  // rendered as a sibling of the widget layer (which uses the same
  // logical coordinate space). Rendered while dragging; cleared on
  // mouseup.
  const [marquee, setMarquee] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    additive: boolean;
  } | null>(null);
  const replaceSelection = useUILayoutStore((s) => s.replaceSelection);
  const selectAll = useUILayoutStore((s) => s.selectAll);

  // Pixel threshold under which a background mousedown+release is
  // treated as a plain background click (deselect) rather than a
  // marquee drag. Using screen-space pixels (before zoom conversion)
  // so the threshold feels consistent at any zoom level.
  const MARQUEE_DRAG_THRESHOLD = 3;

  // Converts a mouse event's client-space point into viewport-local
  // logical coords (the same space `computeLogicalBox` returns).
  const clientToLogical = useCallback(
    (clientX: number, clientY: number) => {
      const el = viewportRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      // `rect` is in screen-space with zoom applied. Divide by zoom
      // to get back to logical coords.
      return {
        x: (clientX - rect.left) / zoom,
        y: (clientY - rect.top) / zoom,
      };
    },
    [zoom],
  );

  const handleBgMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Space-pan and middle-click are handled by the outer wrapper
      // via `handleOuterMouseDown` — let that take priority.
      if (spaceHeld || e.button !== 0) return;
      // Don't interfere with widget clicks; widget mousedown stops
      // propagation so this handler only runs on true empty canvas.
      e.stopPropagation();

      const startClient = { x: e.clientX, y: e.clientY };
      const startLogical = clientToLogical(e.clientX, e.clientY);
      if (!startLogical) {
        select(null);
        return;
      }
      const shiftHeld = e.shiftKey;
      let drifted = false;

      const onMove = (me: MouseEvent) => {
        const dx = Math.abs(me.clientX - startClient.x);
        const dy = Math.abs(me.clientY - startClient.y);
        if (!drifted && dx + dy < MARQUEE_DRAG_THRESHOLD) return;
        drifted = true;
        const cur = clientToLogical(me.clientX, me.clientY);
        if (!cur) return;
        setMarquee({
          startX: startLogical.x,
          startY: startLogical.y,
          currentX: cur.x,
          currentY: cur.y,
          additive: shiftHeld,
        });
      };
      const onUp = (ue: MouseEvent) => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        if (!drifted) {
          // Plain background click — original deselect behavior.
          if (!shiftHeld) select(null);
          return;
        }
        const cur = clientToLogical(ue.clientX, ue.clientY);
        if (!cur) {
          setMarquee(null);
          return;
        }
        // Compute the marquee bbox in logical coords.
        const minX = Math.min(startLogical.x, cur.x);
        const maxX = Math.max(startLogical.x, cur.x);
        const minY = Math.min(startLogical.y, cur.y);
        const maxY = Math.max(startLogical.y, cur.y);

        // Hit-test every visible instance. Only anchored / grid
        // positions have a logical box; flex positions don't appear
        // on the canvas and are skipped.
        const hits: string[] = [];
        for (const inst of instances) {
          if (inst.visible === false) continue;
          const widget = uiLayoutRegistry.getWidget(inst.widgetId);
          const box = computeLogicalBox(
            inst,
            inst.position,
            grid,
            widget?.manifest.defaultSize,
            viewportWidth,
            viewportHeight,
          );
          if (!box) continue;
          // Standard AABB intersection — any overlap counts.
          if (
            box.x + box.width >= minX &&
            box.x <= maxX &&
            box.y + box.height >= minY &&
            box.y <= maxY
          ) {
            hits.push(inst.instanceId);
          }
        }

        if (shiftHeld) {
          // Additive — merge new hits into the existing selection
          // (preserving current primary and additional ordering).
          const state = useUILayoutStore.getState();
          const existing = state.selectedInstanceId
            ? [state.selectedInstanceId, ...state.additionalSelectionIds]
            : state.additionalSelectionIds;
          replaceSelection([...existing, ...hits]);
        } else {
          replaceSelection(hits);
        }
        setMarquee(null);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [
      clientToLogical,
      grid,
      instances,
      replaceSelection,
      select,
      spaceHeld,
      viewportWidth,
      viewportHeight,
    ],
  );

  // Ctrl/Cmd+wheel = zoom at cursor; plain wheel = pan the canvas.
  // Matches the ergonomics of every 2D editor (Figma, Photoshop, UE
  // UMG). Anchoring zoom at the cursor keeps the point under the
  // pointer stationary across zoom changes.
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const outer = outerRef.current;
        if (!outer) return;
        const rect = outer.getBoundingClientRect();
        const anchor = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        setZoom(zoom * factor, anchor);
      } else {
        // deltaY can come from trackpads with shift-scroll → deltaX;
        // honour both axes for predictable pan behaviour.
        panBy(-e.deltaX, -e.deltaY);
      }
    },
    [panBy, setZoom, zoom],
  );

  // Auto-fit the canvas to the available space on mount and whenever
  // the preset changes. Picks the largest zoom that fits width+height
  // (capped at 1.0 so we never over-zoom small presets) and centers
  // the viewport. This is what every vector editor does when you
  // open a new document — the user shouldn't have to pan/zoom just
  // to see their canvas.
  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    const fit = () => {
      const rect = outer.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      // Leave a small margin so the canvas doesn't kiss the rulers.
      const margin = 48;
      const fitW = (rect.width - margin * 2) / viewportWidth;
      const fitH = (rect.height - margin * 2) / viewportHeight;
      const nextZoom = Math.min(1, Math.max(0.1, Math.min(fitW, fitH)));
      setZoom(nextZoom);
      // Center: pan so the scaled viewport sits in the middle of
      // the outer container.
      const scaledW = viewportWidth * nextZoom;
      const scaledH = viewportHeight * nextZoom;
      setPan({
        x: (rect.width - scaledW) / 2,
        y: (rect.height - scaledH) / 2,
      });
    };
    // Run once on mount; also re-run whenever the outer container
    // resizes (e.g. window resize, sidebar collapse).
    fit();
    const ro = new ResizeObserver(() => fit());
    ro.observe(outer);
    return () => ro.disconnect();
    // Intentional: we want to re-fit when the preset dimensions change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportWidth, viewportHeight]);

  // Space-hold = pan mode (cursor becomes "grab"). Track globally so
  // the flag persists across focus changes on the canvas.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && !isTypingTarget(e.target)) {
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Global undo/redo shortcuts. Works without a selection — undo
  // should be reachable at any time. Ctrl+Z (Cmd+Z on mac) = undo;
  // Ctrl+Shift+Z or Ctrl+Y = redo. We intentionally skip this when
  // the event target is a typing field so the browser's native
  // textbox undo continues to work inside inspector inputs.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.code === "KeyZ" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        (e.code === "KeyZ" && e.shiftKey) ||
        (e.code === "KeyY" && !e.shiftKey)
      ) {
        e.preventDefault();
        redo();
      } else if (e.code === "KeyA" && !e.shiftKey) {
        // Ctrl/Cmd+A = select every instance in the layout.
        // Matches Figma / UMG / every vector editor.
        e.preventDefault();
        selectAll();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, selectAll]);

  // Escape cancels an in-progress marquee drag regardless of
  // selection state. Kept global (not selection-scoped) because the
  // marquee can start from an empty-canvas background click, at
  // which point there's no selected instance to gate off of.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Escape") return;
      if (isTypingTarget(e.target)) return;
      if (marquee) {
        e.preventDefault();
        setMarquee(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [marquee]);

  // Selection-scoped keyboard handlers:
  //   - Arrow keys:      nudge 1 logical pixel (10 with Shift)
  //   - Delete/Backspace: remove the selected instance
  //   - Escape:          clear selection
  //
  // Anchored positions nudge by pixel offset; grid positions nudge
  // by column/row cells (clamped to grid extents). Flex positions
  // are not nudgeable via arrow keys.
  useEffect(() => {
    if (!selectedId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      // Deselect / delete don't depend on the instance existing still.
      if (e.code === "Escape") {
        e.preventDefault();
        select(null);
        return;
      }
      // Build the full selection set once per keydown so every
      // command below can decide between single-id and batched
      // variants without recomputing.
      const allSelected = [selectedId, ...additionalSelectionIds];
      const multi = allSelected.length > 1;

      if (e.code === "Delete" || e.code === "Backspace") {
        e.preventDefault();
        if (multi) removeInstances(allSelected);
        else removeInstance(selectedId);
        return;
      }
      // Ctrl+D (Win/Linux) or Cmd+D (macOS) = duplicate selected.
      // Matches Figma/Photoshop/UMG conventions.
      if (e.code === "KeyD" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (multi) duplicateInstances(allSelected);
        else duplicateInstance(selectedId);
        return;
      }

      // Z-order shortcuts. Match Figma / Photoshop / UMG:
      //   Ctrl+]           = bring forward (one step)
      //   Ctrl+[           = send backward (one step)
      //   Ctrl+Shift+]     = bring to front (all the way up)
      //   Ctrl+Shift+[     = send to back   (all the way down)
      if ((e.ctrlKey || e.metaKey) && e.code === "BracketRight") {
        e.preventDefault();
        if (e.shiftKey) {
          if (multi) moveInstancesToFront(allSelected);
          else moveToFront(selectedId);
        } else {
          if (multi) moveInstancesForward(allSelected);
          else moveForward(selectedId);
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "BracketLeft") {
        e.preventDefault();
        if (e.shiftKey) {
          if (multi) moveInstancesToBack(allSelected);
          else moveToBack(selectedId);
        } else {
          if (multi) moveInstancesBackward(allSelected);
          else moveBackward(selectedId);
        }
        return;
      }

      const isArrow =
        e.code === "ArrowUp" ||
        e.code === "ArrowDown" ||
        e.code === "ArrowLeft" ||
        e.code === "ArrowRight";
      if (!isArrow) return;

      const inst = instances.find((i) => i.instanceId === selectedId);
      if (!inst) return;

      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (e.code === "ArrowLeft") dx = -step;
      if (e.code === "ArrowRight") dx = step;
      if (e.code === "ArrowUp") dy = -step;
      if (e.code === "ArrowDown") dy = step;

      if (inst.position.kind === "anchored") {
        e.preventDefault();
        updatePosition(inst.instanceId, {
          ...inst.position,
          offset: {
            x: inst.position.offset.x + dx,
            y: inst.position.offset.y + dy,
          },
        });
        return;
      }
      if (inst.position.kind === "grid" && grid) {
        e.preventDefault();
        const span = {
          columnSpan: inst.position.columnSpan ?? 1,
          rowSpan: inst.position.rowSpan ?? 1,
        };
        // Grid positions step by a single cell per arrow press —
        // Shift+arrow doesn't multiply here because stepping 10
        // cells at a time is rarely useful and cell counts are
        // typically small.
        const dCol = dx === 0 ? 0 : dx > 0 ? 1 : -1;
        const dRow = dy === 0 ? 0 : dy > 0 ? 1 : -1;
        updatePosition(inst.instanceId, {
          ...inst.position,
          column: clamp(
            inst.position.column + dCol,
            0,
            grid.columns - span.columnSpan,
          ),
          row: clamp(inst.position.row + dRow, 0, grid.rows - span.rowSpan),
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    additionalSelectionIds,
    duplicateInstance,
    duplicateInstances,
    grid,
    instances,
    moveBackward,
    moveForward,
    moveInstancesBackward,
    moveInstancesForward,
    moveInstancesToBack,
    moveInstancesToFront,
    moveToBack,
    moveToFront,
    removeInstance,
    removeInstances,
    select,
    selectedId,
    updatePosition,
  ]);

  // Middle-click OR space-hold+left-click = pan.
  const handleOuterMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const isMiddle = e.button === 1;
      const isPanLeft = e.button === 0 && spaceHeld;
      if (!isMiddle && !isPanLeft) return;
      e.preventDefault();
      panDragRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPan: { ...pan },
      };
      const onMove = (me: MouseEvent) => {
        if (!panDragRef.current) return;
        const dx = me.clientX - panDragRef.current.startClientX;
        const dy = me.clientY - panDragRef.current.startClientY;
        useCanvasViewStore.setState({
          pan: {
            x: panDragRef.current.startPan.x + dx,
            y: panDragRef.current.startPan.y + dy,
          },
        });
      };
      const onUp = () => {
        panDragRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "grabbing";
    },
    [pan, spaceHeld],
  );

  // When the author has a non-base viewport selected, render the
  // variant-resolved instances — `applyLayoutVariant` bakes in the
  // `offsetX/offsetY` + `hidden` overrides for the chosen viewport so
  // the canvas is WYSIWYG for that device. Variant authoring itself
  // still flows through the inspector's VariantOverrideSection; drag
  // edits on the canvas are disabled in variant mode to avoid
  // accidentally writing variant-adjusted positions back into the
  // base manifest (see `onCommitPosition` below).
  const displayInstances =
    activeVariant === "base"
      ? instances
      : applyLayoutVariant(layout, activeVariant).manifest.instances;
  const visibleInstances = displayInstances.filter((i) => i.visible !== false);
  const dragWritesAllowed = activeVariant === "base";

  return (
    <ItemIconProvider>
      <div
        ref={outerRef}
        className="relative h-full w-full overflow-hidden bg-bg-primary"
        onWheel={handleWheel}
        onMouseDown={handleOuterMouseDown}
        onDoubleClick={resetView}
        style={{ cursor: spaceHeld ? "grab" : "default" }}
      >
        {showCheckerboard && <CheckerBackground />}

        {activeVariant !== "base" && (
          <div
            className="pointer-events-none absolute left-1/2 top-2 z-40 -translate-x-1/2 rounded bg-bg-tertiary/90 px-3 py-1 text-xs text-text-secondary shadow"
            role="status"
            aria-live="polite"
          >
            Previewing{" "}
            <strong className="text-text-primary">{activeVariant}</strong>{" "}
            variant — drag is disabled. Edit overrides in the inspector.
          </div>
        )}

        <div
          className="absolute left-0 top-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          <div
            ref={viewportRef}
            className="relative overflow-hidden rounded-sm border border-bg-tertiary bg-bg-secondary shadow-xl"
            style={{
              width: viewportWidth,
              height: viewportHeight,
            }}
            onMouseDown={handleBgMouseDown}
          >
            {showGrid && (
              <PixelGridOverlay
                width={viewportWidth}
                height={viewportHeight}
                zoom={zoom}
              />
            )}
            {/* CanvasPanel grid (N×M cells) is only rendered when
                the author has a grid-positioned widget selected
                or dragging — otherwise it's just visual noise on
                top of the pixel grid. Surfaced per-widget via
                WidgetBox instead of globally here. */}

            {visibleInstances.map((inst) => (
              <WidgetBox
                key={inst.instanceId}
                instance={inst}
                grid={grid}
                allInstances={visibleInstances}
                viewportRef={viewportRef}
                viewportWidth={viewportWidth}
                viewportHeight={viewportHeight}
                selected={inst.instanceId === selectedId}
                additionallySelected={additionalSelectionIds.includes(
                  inst.instanceId,
                )}
                onSelect={(shift) =>
                  shift
                    ? toggleSelection(inst.instanceId)
                    : select(inst.instanceId)
                }
                onCommitPosition={(pos) => {
                  if (!dragWritesAllowed) return;
                  updatePosition(inst.instanceId, pos);
                }}
                onReportGuides={setGuides}
                onContextMenu={(x, y) => {
                  select(inst.instanceId);
                  setContextMenu({ x, y, instanceId: inst.instanceId });
                }}
              />
            ))}

            {showGuides && (
              <AlignmentGuidesOverlay
                guides={guides}
                viewportWidth={viewportWidth}
                viewportHeight={viewportHeight}
              />
            )}

            {marquee && (
              <MarqueeOverlay
                startX={marquee.startX}
                startY={marquee.startY}
                currentX={marquee.currentX}
                currentY={marquee.currentY}
                additive={marquee.additive}
              />
            )}

            {instances.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-text-tertiary">
                Empty layout — add widgets from the palette
              </div>
            )}
          </div>
        </div>

        {showRulers && (
          <RulerOverlay
            viewportWidth={viewportWidth}
            viewportHeight={viewportHeight}
            pan={pan}
            zoom={zoom}
          />
        )}

        <CanvasHud
          zoom={zoom}
          presetLabel={preset.label}
          viewportWidth={viewportWidth}
          viewportHeight={viewportHeight}
        />

        {contextMenu
          ? (() => {
              // Right-clicking an instance that's part of the current
              // selection operates on the whole selection; otherwise
              // the command runs on just the clicked instance. This
              // matches Figma / UMG behavior.
              const selectionSet = new Set([
                selectedId ?? "",
                ...additionalSelectionIds,
              ]);
              const inSelection =
                selectionSet.has(contextMenu.instanceId) &&
                selectionSet.size > 1;
              const targetIds = inSelection
                ? [selectedId!, ...additionalSelectionIds]
                : [contextMenu.instanceId];
              const runOne = (
                one: (id: string) => void,
                batch: (ids: string[]) => void,
              ) =>
                targetIds.length > 1 ? batch(targetIds) : one(targetIds[0]);
              return (
                <CanvasContextMenu
                  x={contextMenu.x}
                  y={contextMenu.y}
                  onDismiss={() => setContextMenu(null)}
                  onDuplicate={() =>
                    runOne(duplicateInstance, duplicateInstances)
                  }
                  onDelete={() => runOne(removeInstance, removeInstances)}
                  onBringToFront={() =>
                    runOne(moveToFront, moveInstancesToFront)
                  }
                  onSendToBack={() => runOne(moveToBack, moveInstancesToBack)}
                  onBringForward={() =>
                    runOne(moveForward, moveInstancesForward)
                  }
                  onSendBackward={() =>
                    runOne(moveBackward, moveInstancesBackward)
                  }
                />
              );
            })()
          : null}
      </div>
    </ItemIconProvider>
  );
}

/** True when a keyboard event's target is a text input/textarea so we
 *  don't steal Space or arrow keys from in-progress typing. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

// ---------- Ambient decorations ----------

/** Transparent-checker pattern that fills the outer canvas area so
 *  the viewport boundary reads as a "design surface" floating on top
 *  of infinite void. Rendered via a repeating CSS gradient for zero
 *  DOM cost and crisp scaling at any zoom. */
function CheckerBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundColor: "#0f141a",
        backgroundImage:
          "linear-gradient(45deg, #161c24 25%, transparent 25%)," +
          "linear-gradient(-45deg, #161c24 25%, transparent 25%)," +
          "linear-gradient(45deg, transparent 75%, #161c24 75%)," +
          "linear-gradient(-45deg, transparent 75%, #161c24 75%)",
        backgroundSize: "16px 16px",
        backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
      }}
    />
  );
}

/**
 * Rulers along the top and left edges of the outer canvas. Tick
 * positions are in *logical* pixel space (manifest coordinates) so
 * authors can read widget offsets directly off the ruler.
 *
 * Tick cadence adapts to zoom: at high zoom we show finer ticks; at
 * low zoom we show coarser ones, always keeping ≈8 labelled major
 * ticks across the viewport width.
 */
function RulerOverlay({
  viewportWidth,
  viewportHeight,
  pan,
  zoom,
}: {
  viewportWidth: number;
  viewportHeight: number;
  pan: { x: number; y: number };
  zoom: number;
}) {
  const rulerSize = 20;
  // Choose a tick cadence that keeps ~8 labelled ticks across the
  // visible viewport regardless of zoom.
  const targetMajorSpacing = 120; // screen pixels between major ticks
  const logicalMajorSpacing = niceStep(targetMajorSpacing / zoom);

  // X ticks span the full logical viewport width.
  const xTicks: number[] = [];
  for (let x = 0; x <= viewportWidth; x += logicalMajorSpacing) {
    xTicks.push(x);
  }
  const yTicks: number[] = [];
  for (let y = 0; y <= viewportHeight; y += logicalMajorSpacing) {
    yTicks.push(y);
  }

  return (
    <>
      {/* Top ruler */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 border-b border-bg-tertiary bg-bg-primary/80 text-[9px] text-text-tertiary"
        style={{ width: "100%", height: rulerSize }}
      >
        {xTicks.map((logicalX) => {
          const screenX = pan.x + logicalX * zoom;
          return (
            <div
              key={`x-${logicalX}`}
              className="absolute bottom-0 border-l border-text-tertiary/40 pl-0.5"
              style={{
                left: screenX,
                height: "100%",
                lineHeight: `${rulerSize}px`,
              }}
            >
              {logicalX}
            </div>
          );
        })}
      </div>
      {/* Left ruler */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 border-r border-bg-tertiary bg-bg-primary/80 text-[9px] text-text-tertiary"
        style={{ height: "100%", width: rulerSize, paddingTop: rulerSize }}
      >
        {yTicks.map((logicalY) => {
          const screenY = pan.y + logicalY * zoom;
          return (
            <div
              key={`y-${logicalY}`}
              className="absolute border-t border-text-tertiary/40"
              style={{
                top: screenY,
                width: "100%",
                height: rulerSize,
                lineHeight: `${rulerSize}px`,
                paddingLeft: 2,
              }}
            >
              {logicalY}
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Round a target pixel spacing to a "nice" step (1, 2, 5, 10, 20, 50, 100…).
 *  Used by the ruler to keep tick labels at round numbers. */
function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw));
  const mantissa = raw / 10 ** exp;
  const snapped = mantissa < 1.5 ? 1 : mantissa < 3 ? 2 : mantissa < 7 ? 5 : 10;
  return snapped * 10 ** exp;
}

/** HUD pinned to the bottom-right of the outer canvas showing the
 *  current preset + zoom %. Read-only — interactive zoom controls go
 *  in the toolbar at the UILayoutEditorPage level. */
function CanvasHud({
  zoom,
  presetLabel,
  viewportWidth,
  viewportHeight,
}: {
  zoom: number;
  presetLabel: string;
  viewportWidth: number;
  viewportHeight: number;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-2 right-2 rounded bg-bg-secondary/90 px-2 py-1 text-[10px] font-medium text-text-secondary shadow-md"
    >
      {presetLabel} · {viewportWidth}×{viewportHeight} ·{" "}
      {Math.round(zoom * 100)}%
    </div>
  );
}

// ---------- Alignment guides overlay ----------

/**
 * Renders cyan lines across the viewport for every active alignment
 * guide. Guides come from `computeAlignmentSnap` in logical pixel
 * coordinates; we render them as CSS percentages so they track zoom.
 */
function AlignmentGuidesOverlay({
  guides,
  viewportWidth,
  viewportHeight,
}: {
  guides: AlignmentGuide[];
  viewportWidth: number;
  viewportHeight: number;
}) {
  if (guides.length === 0) return null;
  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width="100%"
      height="100%"
      aria-hidden
    >
      {guides.map((g, i) => {
        const stroke = g.type === "center" ? "#06b6d4" : "#22d3ee";
        const strokeDasharray = g.type === "center" ? "4 4" : undefined;
        if (g.axis === "x") {
          const xPct = (g.position / viewportWidth) * 100;
          return (
            <line
              key={`x-${i}-${g.position}`}
              x1={`${xPct}%`}
              x2={`${xPct}%`}
              y1="0"
              y2="100%"
              stroke={stroke}
              strokeWidth="1"
              strokeDasharray={strokeDasharray}
            />
          );
        }
        const yPct = (g.position / viewportHeight) * 100;
        return (
          <line
            key={`y-${i}-${g.position}`}
            x1="0"
            x2="100%"
            y1={`${yPct}%`}
            y2={`${yPct}%`}
            stroke={stroke}
            strokeWidth="1"
            strokeDasharray={strokeDasharray}
          />
        );
      })}
    </svg>
  );
}

// ---------- Grid overlay ----------

/** CanvasPanel grid (columns/rows) overlay — only rendered when the
 *  layout's grid config is present. Shows the author where grid-
 *  positioned widgets will snap. This is distinct from the pixel
 *  background grid below. */
function CanvasGridOverlay({
  columns,
  rows,
}: {
  columns: number;
  rows: number;
}) {
  const lines: React.ReactElement[] = [];
  for (let c = 1; c < columns; c++) {
    const x = (c / columns) * 100;
    lines.push(
      <line
        key={`v-${c}`}
        x1={`${x}%`}
        x2={`${x}%`}
        y1="0"
        y2="100%"
        stroke="currentColor"
        strokeWidth="1"
      />,
    );
  }
  for (let r = 1; r < rows; r++) {
    const y = (r / rows) * 100;
    lines.push(
      <line
        key={`h-${r}`}
        x1="0"
        x2="100%"
        y1={`${y}%`}
        y2={`${y}%`}
        stroke="currentColor"
        strokeWidth="1"
      />,
    );
  }
  return (
    <svg
      className="pointer-events-none absolute inset-0 text-primary/25"
      width="100%"
      height="100%"
      aria-hidden
    >
      {lines}
    </svg>
  );
}

/**
 * PixelGridOverlay — Hyperscape game-UI-style background grid.
 *
 * Mirrors the grid shown by `EditModeOverlay` in
 * `packages/client/src/ui/components/EditModeOverlay.tsx`: a pixel-
 * aligned minor grid (default 8px) with a heavier major grid every
 * 4 minors (32px). Renders independently of any CanvasPanel grid —
 * this is the editor-surface reference grid, equivalent to the grid
 * in Figma / Photoshop / UMG.
 *
 * The viewport itself is rendered at logical-pixel dimensions and
 * scaled by the pan/zoom transform above, so emitting lines at
 * fixed logical spacing keeps the grid at consistent pixel density
 * regardless of zoom level.
 */
function PixelGridOverlay({
  width,
  height,
  zoom,
  baseMinor = 16,
  majorMultiplier = 4,
}: {
  width: number;
  height: number;
  /** Current canvas zoom factor. Used to skip minor lines when they
   *  would render closer than ~6 screen pixels apart (which turns
   *  into visual noise rather than a usable grid). */
  zoom: number;
  /** Minor spacing in logical pixels at 1:1. */
  baseMinor?: number;
  /** How many minors per major. */
  majorMultiplier?: number;
}) {
  // Adapt minor spacing so neighboring minor lines never render
  // closer than 6 screen pixels at the current zoom. At low zoom we
  // step up to 2x / 4x to keep the grid legible.
  const MIN_SCREEN_PX = 6;
  let minorSize = baseMinor;
  while (minorSize * zoom < MIN_SCREEN_PX) minorSize *= 2;
  const majorSize = minorSize * majorMultiplier;

  const minorLines: React.ReactElement[] = [];
  const majorLines: React.ReactElement[] = [];
  for (let px = minorSize; px < width; px += minorSize) {
    const isMajor = px % majorSize === 0;
    (isMajor ? majorLines : minorLines).push(
      <line
        key={`v-${px}`}
        x1={px}
        x2={px}
        y1={0}
        y2={height}
        stroke="currentColor"
        strokeWidth={1}
      />,
    );
  }
  for (let py = minorSize; py < height; py += minorSize) {
    const isMajor = py % majorSize === 0;
    (isMajor ? majorLines : minorLines).push(
      <line
        key={`h-${py}`}
        x1={0}
        x2={width}
        y1={py}
        y2={py}
        stroke="currentColor"
        strokeWidth={1}
      />,
    );
  }
  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={width}
      height={height}
      aria-hidden
      // Vector-effect keeps line width constant regardless of the
      // outer CSS scale transform.
      style={{ vectorEffect: "non-scaling-stroke" }}
    >
      <g
        className="text-text-tertiary"
        style={{ opacity: 0.08, vectorEffect: "non-scaling-stroke" }}
      >
        {minorLines}
      </g>
      <g
        className="text-text-secondary"
        style={{ opacity: 0.22, vectorEffect: "non-scaling-stroke" }}
      >
        {majorLines}
      </g>
    </svg>
  );
}

// ---------- Widget box + drag ----------

interface WidgetBoxProps {
  instance: WidgetInstance;
  grid: { columns: number; rows: number } | undefined;
  /** Every visible instance — used to compute sibling alignment snaps. */
  allInstances: WidgetInstance[];
  viewportRef: React.RefObject<HTMLDivElement | null>;
  /** Logical width of the active preset viewport. Passed explicitly so
   *  position helpers stay pure and testable. */
  viewportWidth: number;
  viewportHeight: number;
  selected: boolean;
  /** True when this widget is one of the additional multi-selection
   *  members (not the primary). Rendered with a softer outline so
   *  it's visually distinct from the primary but clearly still
   *  part of the group. */
  additionallySelected: boolean;
  /** `shift` is true when the user held Shift (or equivalent
   *  multi-select modifier) during the click — callers use this to
   *  toggle membership instead of replacing the whole selection. */
  onSelect: (shift: boolean) => void;
  onCommitPosition: (pos: WidgetPosition) => void;
  /** Lift the in-progress alignment guides to the parent. Called with
   *  `[]` on drag end. */
  onReportGuides: (guides: AlignmentGuide[]) => void;
  /** Open the right-click menu at the given window-space pointer
   *  coords. Parent is responsible for selection + menu state. */
  onContextMenu: (x: number, y: number) => void;
}

function WidgetBox({
  instance,
  grid,
  allInstances,
  viewportRef,
  viewportWidth,
  viewportHeight,
  selected,
  additionallySelected,
  onSelect,
  onCommitPosition,
  onReportGuides,
  onContextMenu,
}: WidgetBoxProps) {
  const widget = uiLayoutRegistry.getWidget(instance.widgetId);
  const Component = widget
    ? uiLayoutRegistry.getComponent(instance.widgetId)
    : null;
  const defaultSize = widget?.manifest.defaultSize;
  const box = computeBox(
    instance,
    grid,
    defaultSize,
    viewportWidth,
    viewportHeight,
  );

  // Resolve the instance's props through the same pipeline the live
  // client uses, against the editor mock DataContext. Any failure (bad
  // binding, schema mismatch) falls back to a labelled placeholder so
  // the editor never crashes while the author iterates.
  const resolved = widget
    ? resolveWidgetProps(
        instance.props,
        instance.bindings,
        widget.propsSchema,
        editorMockDataContext,
      )
    : null;

  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startPos: WidgetPosition;
    scale: number;
    lastCommittedPos: WidgetPosition | null;
  } | null>(null);

  const resizeDragRef = useRef<{
    handle: ResizeHandleKind;
    startClientX: number;
    startClientY: number;
    startPos: AnchoredPosition;
    startBox: Box;
    scale: number;
    lastCommittedPos: WidgetPosition | null;
  } | null>(null);

  const handleResizeStart = (e: React.MouseEvent, handle: ResizeHandleKind) => {
    if (e.button !== 0) return;
    if (instance.position.kind !== "anchored") return;
    // Stop propagation so the outer box's drag handler doesn't also
    // fire — resize and move are mutually exclusive gestures.
    e.stopPropagation();
    e.preventDefault();
    onSelect(e.shiftKey);

    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const scale = rect.width / viewportWidth;

    const startBox = computeLogicalBox(
      instance,
      instance.position,
      grid,
      defaultSize,
      viewportWidth,
      viewportHeight,
    );
    if (!startBox) return;

    resizeDragRef.current = {
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPos: instance.position,
      startBox,
      scale,
      lastCommittedPos: null,
    };

    const onMove = (me: MouseEvent) => {
      const state = resizeDragRef.current;
      if (!state) return;

      const dxLogical = (me.clientX - state.startClientX) / state.scale;
      const dyLogical = (me.clientY - state.startClientY) / state.scale;

      const next = applyResize(
        state.startPos,
        state.startBox,
        state.handle,
        dxLogical,
        dyLogical,
        instance.customization,
        viewportWidth,
        viewportHeight,
        { axisLock: me.shiftKey, bypassSnap: me.altKey, grid: grid ?? null },
      );
      if (!positionsEqual(next, state.lastCommittedPos)) {
        state.lastCommittedPos = next;
        onCommitPosition(next);
      }
    };

    const onUp = () => {
      resizeDragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = RESIZE_CURSORS[handle];
    document.body.style.userSelect = "none";
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Left-click only; let right-click fall through.
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect(e.shiftKey);

    if (instance.position.kind === "flex") {
      // Flex positions have no canvas-equivalent layout — don't drag.
      return;
    }
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // `rect.width` is the *rendered* (post-zoom) width; dividing by
    // the preset's logical width yields the current zoom factor, so
    // client-pixel deltas convert directly to logical-pixel deltas.
    const scale = rect.width / viewportWidth;
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPos: instance.position,
      scale,
      lastCommittedPos: null,
    };

    const onMove = (me: MouseEvent) => {
      if (!dragRef.current) return;
      let dxLogical =
        (me.clientX - dragRef.current.startClientX) / dragRef.current.scale;
      let dyLogical =
        (me.clientY - dragRef.current.startClientY) / dragRef.current.scale;

      // Axis-lock with Shift — match the in-game editor ergonomics.
      if (me.shiftKey) {
        if (Math.abs(dxLogical) >= Math.abs(dyLogical)) dyLogical = 0;
        else dxLogical = 0;
      }

      // For anchored positions, compute sibling + viewport alignment
      // snap BEFORE translating the drag into a WidgetPosition. Alt
      // bypasses snap so authors can nudge freely.
      let reportedGuides: AlignmentGuide[] = [];
      if (dragRef.current.startPos.kind === "anchored" && !me.altKey) {
        const startBox = computeLogicalBox(
          instance,
          dragRef.current.startPos,
          grid,
          defaultSize,
          viewportWidth,
          viewportHeight,
        );
        if (startBox) {
          const candidate: Box = {
            x: startBox.x + dxLogical,
            y: startBox.y + dyLogical,
            width: startBox.width,
            height: startBox.height,
          };
          const siblingBoxes = siblingBoxesFor(
            instance,
            allInstances,
            grid,
            viewportWidth,
            viewportHeight,
          );
          const sibSnap = computeAlignmentSnap(candidate, siblingBoxes, {
            threshold: SNAP_THRESHOLD_PX,
            axisLock: me.shiftKey
              ? Math.abs(dxLogical) >= Math.abs(dyLogical)
                ? "x"
                : "y"
              : null,
          });
          const vpSnap = snapBoxToViewport(
            sibSnap.snappedBox,
            { width: viewportWidth, height: viewportHeight },
            { threshold: SNAP_THRESHOLD_PX },
          );
          dxLogical = vpSnap.snappedBox.x - startBox.x;
          dyLogical = vpSnap.snappedBox.y - startBox.y;
          reportedGuides = [...sibSnap.guides, ...vpSnap.guides];
        }
      }
      onReportGuides(reportedGuides);

      const next = applyDrag(
        dragRef.current.startPos,
        dxLogical,
        dyLogical,
        grid,
        viewportWidth,
        viewportHeight,
      );
      // Don't thrash the store — only commit when the resolved
      // position actually changed (important for grid snap).
      if (!positionsEqual(next, dragRef.current.lastCommittedPos)) {
        dragRef.current.lastCommittedPos = next;
        onCommitPosition(next);
      }
    };

    const onUp = () => {
      dragRef.current = null;
      onReportGuides([]);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  };

  if (!box) return null;

  const draggable = instance.position.kind !== "flex";
  const canRenderLive = Component !== null && resolved !== null && resolved.ok;

  return (
    <div
      role="button"
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e.clientX, e.clientY);
      }}
      data-instance-id={instance.instanceId}
      data-widget-id={instance.widgetId}
      className={`absolute select-none transition-colors ${
        selected
          ? "outline outline-2 outline-primary outline-offset-2"
          : additionallySelected
            ? "outline outline-dashed outline-2 outline-primary/60 outline-offset-2"
            : "outline outline-1 outline-bg-tertiary/40 hover:outline-primary/60"
      } ${draggable ? "cursor-grab" : "cursor-pointer"} ease-out`}
      style={{
        left: `${box.leftPct}%`,
        top: `${box.topPct}%`,
        width: `${box.widthPct}%`,
        height: `${box.heightPct}%`,
      }}
    >
      {/* Customization badges — make movable/resizable widgets visible
          at a glance so designers can tell which HUD elements players
          will be allowed to tweak in-game. */}
      {instance.customization?.movable ? (
        <span
          className="pointer-events-none absolute right-0 top-0 z-10 rounded-bl-[3px] bg-primary/90 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-white"
          title="Movable by players at runtime"
        >
          Move
        </span>
      ) : null}
      {instance.customization?.resizable ? (
        <span
          className="pointer-events-none absolute left-0 top-0 z-10 rounded-br-[3px] bg-accent/90 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-white"
          title="Resizable by players at runtime"
        >
          Size
        </span>
      ) : null}
      {canRenderLive ? (
        // The real widget is rendered in a non-interactive wrapper
        // sized to the widget's logical box — pointer events stay
        // on the outer drag target so the author can always pick
        // the instance up. `overflow-hidden` clips any component
        // that tries to render larger than its declared box so
        // selection outlines stay accurate.
        //
        // NOTE: we deliberately do NOT use `display: contents`
        // here. That property dissolves the wrapper from the
        // layout tree which disables h-full/w-full/overflow-hidden
        // and lets the real component's intrinsic size leak past
        // the selection outline.
        <div className="pointer-events-none relative h-full w-full overflow-hidden">
          <Component {...resolved.props} />
        </div>
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center rounded-md border text-[10px] font-medium ${
            selected
              ? "border-primary bg-primary/20 text-primary"
              : "border-bg-tertiary bg-bg-primary/80 text-text-secondary"
          }`}
        >
          <span className="truncate px-1">
            {instance.label ?? widget?.manifest.name ?? instance.instanceId}
          </span>
        </div>
      )}

      {/* 8-direction resize handles. Shown only for selected,
          anchored widgets. Corners let you resize two edges at
          once; midpoint handles resize one edge. Handles sit on
          top of the widget content (z-20) and stop propagation
          so the widget drag handler doesn't also fire. */}
      {selected && instance.position.kind === "anchored"
        ? RESIZE_HANDLES.map((kind) => (
            <div
              key={kind}
              role="button"
              tabIndex={-1}
              aria-label={`Resize ${kind}`}
              data-resize-handle={kind}
              onMouseDown={(e) => handleResizeStart(e, kind)}
              className="absolute z-20 h-2 w-2 rounded-sm border border-primary bg-bg-primary"
              style={{
                ...RESIZE_HANDLE_POS[kind],
                cursor: RESIZE_CURSORS[kind],
              }}
            />
          ))
        : null}
    </div>
  );
}

// ---------- Position math ----------

/**
 * Percent-space box for CSS rendering — `computeBox` returns this so
 * the widget DOM element's `left/top/width/height` can be set as `%`
 * values that scale with viewport zoom. Distinct from the
 * logical-pixel `Box` from `@hyperforge/ui-framework` which the
 * alignment primitives operate on.
 */
interface BoxPct {
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
}

/**
 * Resolve a drag delta (in logical viewport pixels) against a starting
 * position. Preserves the position `kind`. Takes the active viewport
 * dimensions so grid-cell math uses the active preset's size.
 */
function applyDrag(
  start: WidgetPosition,
  dxLogical: number,
  dyLogical: number,
  grid: { columns: number; rows: number } | undefined,
  viewportWidth: number,
  viewportHeight: number,
): WidgetPosition {
  if (start.kind === "anchored") {
    return {
      ...start,
      offset: {
        x: Math.round(start.offset.x + dxLogical),
        y: Math.round(start.offset.y + dyLogical),
      },
    };
  }
  if (start.kind === "grid" && grid) {
    const cellW = viewportWidth / grid.columns;
    const cellH = viewportHeight / grid.rows;
    const dCol = Math.round(dxLogical / cellW);
    const dRow = Math.round(dyLogical / cellH);
    const span = {
      columnSpan: start.columnSpan ?? 1,
      rowSpan: start.rowSpan ?? 1,
    };
    return {
      ...start,
      column: clamp(start.column + dCol, 0, grid.columns - span.columnSpan),
      row: clamp(start.row + dRow, 0, grid.rows - span.rowSpan),
    };
  }
  return start;
}

function positionsEqual(a: WidgetPosition, b: WidgetPosition | null): boolean {
  if (!b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === "anchored" && b.kind === "anchored") {
    return (
      a.anchor === b.anchor &&
      a.offset.x === b.offset.x &&
      a.offset.y === b.offset.y &&
      (a.width ?? null) === (b.width ?? null) &&
      (a.height ?? null) === (b.height ?? null)
    );
  }
  if (a.kind === "grid" && b.kind === "grid") {
    return (
      a.column === b.column &&
      a.row === b.row &&
      (a.columnSpan ?? 1) === (b.columnSpan ?? 1) &&
      (a.rowSpan ?? 1) === (b.rowSpan ?? 1)
    );
  }
  if (a.kind === "flex" && b.kind === "flex") {
    return a.container === b.container && a.order === b.order;
  }
  return false;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Rubber-band rectangle rendered while the author drags a marquee
 * across the empty canvas. Coordinates are in viewport-local logical
 * pixels — this component lives inside the scaled viewport so those
 * units match up with widget positions.
 *
 * The overlay is non-interactive so the mouse events keep flowing to
 * the underlying canvas and the drag can complete even when the
 * cursor passes over the overlay's rendered area.
 */
function MarqueeOverlay({
  startX,
  startY,
  currentX,
  currentY,
  additive,
}: {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  additive: boolean;
}) {
  const x = Math.min(startX, currentX);
  const y = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  return (
    <div
      className={`pointer-events-none absolute border ${
        additive ? "border-accent bg-accent/10" : "border-primary bg-primary/10"
      }`}
      style={{
        left: x,
        top: y,
        width,
        height,
      }}
      aria-hidden
    />
  );
}

/**
 * Compute a widget's bounding box on the preview viewport (as CSS
 * percentages). Mirrors the visual math for each position kind.
 * Viewport dimensions come from the active canvas preset.
 */
function computeBox(
  inst: WidgetInstance,
  grid: { columns: number; rows: number } | undefined,
  defaultSize: { width: number; height: number } | undefined,
  viewportWidth: number,
  viewportHeight: number,
): BoxPct | null {
  const size = defaultSize ?? { width: 3, height: 2 };

  if (inst.position.kind === "grid" && grid) {
    const { column, row, columnSpan = 1, rowSpan = 1 } = inst.position;
    return {
      leftPct: (column / grid.columns) * 100,
      topPct: (row / grid.rows) * 100,
      widthPct: (columnSpan / grid.columns) * 100,
      heightPct: (rowSpan / grid.rows) * 100,
    };
  }

  if (inst.position.kind === "anchored") {
    // Per-instance width/height (set by resize handles) takes
    // precedence over the widget manifest's defaultSize.
    const widthPx = inst.position.width ?? size.width * UNIT_PX;
    const heightPx = inst.position.height ?? size.height * UNIT_PX;

    const widthPct = (widthPx / viewportWidth) * 100;
    const heightPct = (heightPx / viewportHeight) * 100;
    const offXPct = (inst.position.offset.x / viewportWidth) * 100;
    const offYPct = (inst.position.offset.y / viewportHeight) * 100;

    // Anchor corner base position before offset.
    const anchor = inst.position.anchor;
    let baseLeftPct = 0;
    let baseTopPct = 0;
    if (anchor.endsWith("right")) baseLeftPct = 100 - widthPct;
    else if (anchor.endsWith("center")) baseLeftPct = 50 - widthPct / 2;
    if (anchor.startsWith("bottom")) baseTopPct = 100 - heightPct;
    else if (anchor.startsWith("middle")) baseTopPct = 50 - heightPct / 2;
    if (anchor === "center") {
      baseLeftPct = 50 - widthPct / 2;
      baseTopPct = 50 - heightPct / 2;
    }

    return {
      leftPct: baseLeftPct + offXPct,
      topPct: baseTopPct + offYPct,
      widthPct,
      heightPct,
    };
  }

  if (inst.position.kind === "flex") {
    // Flex containers aren't modelled in preview; show a small chip
    // in the top-left so the widget is still visible + selectable.
    return {
      leftPct: 1,
      topPct: 1 + inst.position.order * 4,
      widthPct: 10,
      heightPct: 3,
    };
  }

  return null;
}

/**
 * Compute a widget's bounding box in **logical pixel coordinates**
 * — the coordinate space the alignment primitives operate in.
 * Viewport dimensions come from the active canvas preset.
 * Returns null for kinds without a pixel box (flex positions are
 * skipped during alignment snap).
 */
function computeLogicalBox(
  inst: WidgetInstance,
  position: WidgetPosition,
  grid: { columns: number; rows: number } | undefined,
  defaultSize: { width: number; height: number } | undefined,
  viewportWidth: number,
  viewportHeight: number,
): Box | null {
  const size = defaultSize ?? { width: 3, height: 2 };

  if (position.kind === "grid" && grid) {
    const cellW = viewportWidth / grid.columns;
    const cellH = viewportHeight / grid.rows;
    const colSpan = position.columnSpan ?? 1;
    const rowSpan = position.rowSpan ?? 1;
    return {
      x: position.column * cellW,
      y: position.row * cellH,
      width: colSpan * cellW,
      height: rowSpan * cellH,
    };
  }

  if (position.kind === "anchored") {
    // Per-instance width/height (set by resize handles) takes
    // precedence over the widget manifest's defaultSize.
    const width = position.width ?? size.width * UNIT_PX;
    const height = position.height ?? size.height * UNIT_PX;
    let baseX = 0;
    let baseY = 0;
    const anchor = position.anchor;
    if (anchor.endsWith("right")) baseX = viewportWidth - width;
    else if (anchor.endsWith("center")) baseX = (viewportWidth - width) / 2;
    if (anchor.startsWith("bottom")) baseY = viewportHeight - height;
    else if (anchor.startsWith("middle")) baseY = (viewportHeight - height) / 2;
    if (anchor === "center") {
      baseX = (viewportWidth - width) / 2;
      baseY = (viewportHeight - height) / 2;
    }
    return {
      x: baseX + position.offset.x,
      y: baseY + position.offset.y,
      width,
      height,
    };
  }

  return null;
}

// ---------- Resize handles ----------

/**
 * 8 handle kinds, one per cardinal + ordinal direction:
 *   n  = top edge        s  = bottom edge
 *   e  = right edge      w  = left edge
 *   ne = top-right       nw = top-left
 *   se = bottom-right    sw = bottom-left
 */
type ResizeHandleKind = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const RESIZE_HANDLES: ResizeHandleKind[] = [
  "n",
  "s",
  "e",
  "w",
  "ne",
  "nw",
  "se",
  "sw",
];

/** CSS cursor name for each handle, matching the resize axis. */
const RESIZE_CURSORS: Record<ResizeHandleKind, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};

/**
 * Absolute CSS positioning for each handle relative to the widget box.
 * Each handle is 8px × 8px; we center it on the target edge/corner by
 * using negative offsets equal to half the handle size.
 */
const RESIZE_HANDLE_POS: Record<ResizeHandleKind, React.CSSProperties> = {
  n: { top: -4, left: "50%", transform: "translateX(-50%)" },
  s: { bottom: -4, left: "50%", transform: "translateX(-50%)" },
  e: { right: -4, top: "50%", transform: "translateY(-50%)" },
  w: { left: -4, top: "50%", transform: "translateY(-50%)" },
  ne: { top: -4, right: -4 },
  nw: { top: -4, left: -4 },
  se: { bottom: -4, right: -4 },
  sw: { bottom: -4, left: -4 },
};

/**
 * Apply a resize drag to a starting anchored position. Returns a new
 * anchored position (preserving `kind`), with `offset`, `width`, and
 * `height` adjusted to match the new box.
 *
 * Algorithm:
 *   1. Take starting screen-space logical box.
 *   2. Apply handle-specific deltas to derive a tentative new box.
 *   3. Clamp width/height by customization min/max.
 *   4. Enforce `customization.aspectRatio` if set — the dominant axis
 *      (based on which handle) drives the other. For corners, the
 *      larger |delta| axis wins.
 *   5. Preserve the opposite edge of the handle as the fixed anchor
 *      point so the box grows/shrinks toward the cursor.
 *   6. Translate the new (x, y, width, height) back into an
 *      AnchoredPosition (offset + width + height) via reverse anchor
 *      math.
 *
 * Modifiers:
 *   - axisLock (Shift): on corners, constrain the resize to whichever
 *     axis the user moved more on.
 *   - bypassSnap (Alt): bypass grid snapping on offsets (future use;
 *     current impl doesn't grid-snap resize yet).
 *   - grid: reserved for future cell-snap during resize.
 */
function applyResize(
  start: AnchoredPosition,
  startBox: Box,
  handle: ResizeHandleKind,
  dxLogical: number,
  dyLogical: number,
  customization: WidgetCustomization | undefined,
  viewportWidth: number,
  viewportHeight: number,
  _opts: {
    axisLock: boolean;
    bypassSnap: boolean;
    grid: { columns: number; rows: number } | null;
  },
): AnchoredPosition {
  const movesLeft = handle === "w" || handle === "nw" || handle === "sw";
  const movesRight = handle === "e" || handle === "ne" || handle === "se";
  const movesTop = handle === "n" || handle === "nw" || handle === "ne";
  const movesBottom = handle === "s" || handle === "sw" || handle === "se";

  // Starting edges.
  const left0 = startBox.x;
  const right0 = startBox.x + startBox.width;
  const top0 = startBox.y;
  const bottom0 = startBox.y + startBox.height;

  // Tentative new edges — anchor unchanged edges.
  let newLeft = left0;
  let newRight = right0;
  let newTop = top0;
  let newBottom = bottom0;
  if (movesLeft) newLeft = left0 + dxLogical;
  if (movesRight) newRight = right0 + dxLogical;
  if (movesTop) newTop = top0 + dyLogical;
  if (movesBottom) newBottom = bottom0 + dyLogical;

  // Clamp width/height by min/max.
  const minW = customization?.minWidth ?? 1;
  const maxW = customization?.maxWidth ?? Number.POSITIVE_INFINITY;
  const minH = customization?.minHeight ?? 1;
  const maxH = customization?.maxHeight ?? Number.POSITIVE_INFINITY;

  let newWidth = newRight - newLeft;
  let newHeight = newBottom - newTop;
  newWidth = Math.max(minW, Math.min(maxW, newWidth));
  newHeight = Math.max(minH, Math.min(maxH, newHeight));

  // Aspect ratio: one axis drives the other. For a single-edge handle
  // we use that axis. For corner handles we pick the dominant axis
  // (bigger |delta|) so diagonal drags feel natural.
  if (customization?.aspectRatio && customization.aspectRatio > 0) {
    const isCorner = (movesLeft || movesRight) && (movesTop || movesBottom);
    let widthDrivesHeight: boolean;
    if (isCorner) {
      widthDrivesHeight = Math.abs(dxLogical) >= Math.abs(dyLogical);
    } else {
      widthDrivesHeight = movesLeft || movesRight;
    }
    if (widthDrivesHeight) {
      newHeight = Math.max(
        minH,
        Math.min(maxH, newWidth / customization.aspectRatio),
      );
      newWidth = newHeight * customization.aspectRatio;
    } else {
      newWidth = Math.max(
        minW,
        Math.min(maxW, newHeight * customization.aspectRatio),
      );
      newHeight = newWidth / customization.aspectRatio;
    }
  }

  // Re-derive edges honouring "opposite edge stays put". If both left
  // and right move (full-width corner pair), left moves per delta; if
  // only right moves, keep left pinned.
  if (movesLeft && !movesRight) {
    newLeft = right0 - newWidth;
    newRight = right0;
  } else if (movesRight && !movesLeft) {
    newRight = left0 + newWidth;
    newLeft = left0;
  } else {
    // Neither edge moved horizontally (pure vertical handle) — keep
    // width centered around the original box's horizontal extents.
    newLeft = left0;
    newRight = left0 + newWidth;
  }
  if (movesTop && !movesBottom) {
    newTop = bottom0 - newHeight;
    newBottom = bottom0;
  } else if (movesBottom && !movesTop) {
    newBottom = top0 + newHeight;
    newTop = top0;
  } else {
    newTop = top0;
    newBottom = top0 + newHeight;
  }

  const finalX = newLeft;
  const finalY = newTop;
  const finalW = newRight - newLeft;
  const finalH = newBottom - newTop;

  // Reverse anchor math: given a box in logical viewport pixels and
  // an anchor, recover the offset. Mirrors `computeLogicalBox`.
  const anchor: LayoutAnchor = start.anchor;
  let baseX = 0;
  let baseY = 0;
  if (anchor.endsWith("right")) baseX = viewportWidth - finalW;
  else if (anchor.endsWith("center")) baseX = (viewportWidth - finalW) / 2;
  if (anchor.startsWith("bottom")) baseY = viewportHeight - finalH;
  else if (anchor.startsWith("middle")) baseY = (viewportHeight - finalH) / 2;
  if (anchor === "center") {
    baseX = (viewportWidth - finalW) / 2;
    baseY = (viewportHeight - finalH) / 2;
  }

  return {
    kind: "anchored",
    anchor,
    offset: {
      x: Math.round(finalX - baseX),
      y: Math.round(finalY - baseY),
    },
    width: Math.round(finalW),
    height: Math.round(finalH),
  };
}

/**
 * Build the set of candidate alignment boxes for a drag — every other
 * visible instance that has a pixel box. Attaches the instance id as
 * `id` so returned guides can carry a `sourceId`.
 *
 * Flex positions are skipped: they don't have a meaningful canvas box
 * for alignment purposes.
 */
function siblingBoxesFor(
  dragging: WidgetInstance,
  allInstances: WidgetInstance[],
  grid: { columns: number; rows: number } | undefined,
  viewportWidth: number,
  viewportHeight: number,
): Array<Box & { id: string }> {
  const out: Array<Box & { id: string }> = [];
  for (const inst of allInstances) {
    if (inst.instanceId === dragging.instanceId) continue;
    if (inst.position.kind === "flex") continue;
    const widget = uiLayoutRegistry.getWidget(inst.widgetId);
    const sibBox = computeLogicalBox(
      inst,
      inst.position,
      grid,
      widget?.manifest.defaultSize,
      viewportWidth,
      viewportHeight,
    );
    if (!sibBox) continue;
    out.push({ ...sibBox, id: inst.instanceId });
  }
  return out;
}
