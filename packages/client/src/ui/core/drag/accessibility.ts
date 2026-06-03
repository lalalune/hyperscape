/**
 * Accessibility utilities for drag and drop
 */

import { useEffect, useRef } from "react";
import { useDragStore } from "../../stores/dragStore";

export interface Announcement {
  message: string;
  priority?: "assertive" | "polite";
}

export const DEFAULT_ANNOUNCEMENTS = {
  onDragStart: (id: string) => `Picked up ${id}. Use arrow keys to move.`,
  onDragMove: (id: string, over: string | null) =>
    over ? `${id} is over ${over}.` : `${id} is not over a drop target.`,
  onDragEnd: (id: string, over: string | null) =>
    over ? `Dropped ${id} on ${over}.` : `Dropped ${id}.`,
  onDragCancel: (id: string) => `Cancelled dragging ${id}.`,
};

let liveRegion: HTMLElement | null = null;

export function getLiveRegion(id = "hyperia-live-region"): HTMLElement {
  if (liveRegion && document.body.contains(liveRegion)) return liveRegion;
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-atomic", "true");
    el.style.cssText =
      "position:fixed;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;";
    document.body.appendChild(el);
  }
  liveRegion = el;
  return el;
}

export function announce(announcement: Announcement | string): void {
  const msg =
    typeof announcement === "string" ? announcement : announcement.message;
  const priority =
    typeof announcement === "string"
      ? "polite"
      : (announcement.priority ?? "polite");
  const region = getLiveRegion();
  region.setAttribute("aria-live", priority);
  region.textContent = "";
  setTimeout(() => {
    region.textContent = msg;
  }, 50);
}

export function getDraggableAriaAttributes(
  id: string,
  isDragging: boolean,
  disabled = false,
) {
  return {
    role: "button",
    "aria-roledescription": "draggable",
    "aria-grabbed": isDragging,
    "aria-disabled": disabled,
    "aria-describedby": `hyperia-instructions-${id}`,
    tabIndex: disabled ? -1 : 0,
  };
}

export function getDroppableAriaAttributes(
  id: string,
  isOver: boolean,
  canDrop: boolean,
) {
  return { "aria-dropeffect": canDrop ? (isOver ? "move" : "none") : "none" };
}

export const SCREEN_READER_INSTRUCTIONS =
  "Press Space or Enter to drag. Use arrows to move. Space/Enter to drop. Escape to cancel.";

export function useAccessibilityAnnouncements(
  config: { announcements?: typeof DEFAULT_ANNOUNCEMENTS } = {},
): void {
  const { announcements = DEFAULT_ANNOUNCEMENTS } = config;
  const isDragging = useDragStore((s) => s.isDragging);
  const item = useDragStore((s) => s.item);
  const overTargets = useDragStore((s) => s.overTargets);
  const prevRef = useRef({ isDragging: false, over: "" });

  useEffect(() => {
    const prev = prevRef.current;
    if (!prev.isDragging && isDragging && item) {
      announce({
        message: announcements.onDragStart(item.id),
        priority: "assertive",
      });
    }
    if (prev.isDragging && !isDragging && item) {
      announce({
        message: announcements.onDragEnd(item.id, prev.over || null),
        priority: "assertive",
      });
    }
    if (isDragging && item && overTargets[0] !== prev.over) {
      announce({
        message: announcements.onDragMove(item.id, overTargets[0] || null),
        priority: "polite",
      });
    }
    prevRef.current = { isDragging, over: overTargets[0] || "" };
  }, [isDragging, item, overTargets, announcements]);
}
