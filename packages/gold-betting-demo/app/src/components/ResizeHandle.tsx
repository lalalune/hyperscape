interface ResizeHandleProps {
  /** "h" = vertical bar you drag left/right; "v" = horizontal bar you drag up/down */
  direction: "h" | "v";
  onMouseDown: (e: React.MouseEvent) => void;
  /** Extra class names */
  className?: string;
}

/**
 * Thin draggable separator between two panels.
 * Visually highlights on hover and shows a gold accent while active.
 */
export function ResizeHandle({
  direction,
  onMouseDown,
  className = "",
}: ResizeHandleProps) {
  return (
    <div
      className={`resize-handle resize-handle--${direction === "h" ? "horizontal" : "vertical"} ${className}`}
      onMouseDown={onMouseDown}
      onDoubleClick={(e) => e.preventDefault()}
      role="separator"
      aria-orientation={direction === "h" ? "vertical" : "horizontal"}
      tabIndex={-1}
    />
  );
}
