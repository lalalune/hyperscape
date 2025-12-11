/**
 * Confirm Modal Component
 *
 * Generic confirmation modal for destructive actions (e.g., delete tab).
 */

import { createPortal } from "react-dom";
import type { ConfirmModalState } from "../../types";

interface ConfirmModalProps {
  modal: ConfirmModalState;
  onClose: () => void;
}

export function ConfirmModal({ modal, onClose }: ConfirmModalProps) {
  if (!modal.visible) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.5)" }}
      onClick={onClose}
    >
      <div
        className="rounded-lg p-4 shadow-xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(30, 25, 20, 0.98) 0%, rgba(20, 15, 10, 0.98) 100%)",
          border: "2px solid rgba(139, 69, 19, 0.8)",
          minWidth: "280px",
          maxWidth: "360px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="text-lg font-bold mb-3 text-center"
          style={{ color: "rgba(242, 208, 138, 0.9)" }}
        >
          {modal.title}
        </h3>

        <p
          className="text-sm mb-4 text-center"
          style={{ color: "rgba(255, 255, 255, 0.8)" }}
        >
          {modal.message}
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => {
              modal.onConfirm();
              onClose();
            }}
            className="flex-1 py-2 rounded text-sm font-bold transition-colors"
            style={{
              background: "rgba(180, 100, 100, 0.7)",
              color: "#fff",
              border: "1px solid rgba(180, 100, 100, 0.8)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(200, 80, 80, 0.9)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(180, 100, 100, 0.7)";
            }}
          >
            Delete
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded text-sm font-bold transition-colors"
            style={{
              background: "rgba(100, 100, 100, 0.5)",
              color: "#fff",
              border: "1px solid rgba(139, 69, 19, 0.6)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(120, 120, 120, 0.6)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(100, 100, 100, 0.5)";
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
