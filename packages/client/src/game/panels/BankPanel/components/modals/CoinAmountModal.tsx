/**
 * Coin Amount Modal Component
 *
 * Modal for entering coin deposit/withdraw amounts with quick buttons.
 */

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { CoinModalState } from "../../types";
import { formatQuantity } from "../../utils";

interface CoinAmountModalProps {
  modal: CoinModalState;
  onConfirm: (amount: number) => void;
  onClose: () => void;
}

export function CoinAmountModal({
  modal,
  onConfirm,
  onClose,
}: CoinAmountModalProps) {
  const [amount, setAmount] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (modal.visible && inputRef.current) {
      inputRef.current.focus();
      setAmount("");
    }
  }, [modal.visible]);

  if (!modal.visible) return null;

  const handleSubmit = () => {
    const numAmount = parseInt(amount, 10);
    if (numAmount > 0 && numAmount <= modal.maxAmount) {
      onConfirm(numAmount);
      onClose();
    }
  };

  const handleQuickAmount = (value: number) => {
    const actualAmount = Math.min(value, modal.maxAmount);
    if (actualAmount > 0) {
      onConfirm(actualAmount);
      onClose();
    }
  };

  const actionLabel = modal.action === "deposit" ? "Deposit" : "Withdraw";
  const actionColor =
    modal.action === "deposit"
      ? "rgba(100, 180, 100, 0.8)"
      : "rgba(180, 150, 100, 0.8)";

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
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="text-lg font-bold mb-3 text-center"
          style={{ color: "rgba(242, 208, 138, 0.9)" }}
        >
          {actionLabel} Coins
        </h3>

        {/* Quick amounts */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[1, 10, 100, 1000].map((qty) => (
            <button
              key={qty}
              onClick={() => handleQuickAmount(qty)}
              disabled={modal.maxAmount < qty}
              className="py-2 rounded text-sm font-bold transition-colors disabled:opacity-30"
              style={{
                background:
                  modal.maxAmount >= qty
                    ? actionColor
                    : "rgba(50, 50, 50, 0.5)",
                color: "#fff",
                border: "1px solid rgba(139, 69, 19, 0.6)",
              }}
            >
              {qty >= 1000 ? `${qty / 1000}K` : qty}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => handleQuickAmount(Math.floor(modal.maxAmount / 2))}
            disabled={modal.maxAmount < 2}
            className="py-2 rounded text-sm font-bold transition-colors disabled:opacity-30"
            style={{
              background: actionColor,
              color: "#fff",
              border: "1px solid rgba(139, 69, 19, 0.6)",
            }}
          >
            Half ({formatQuantity(Math.floor(modal.maxAmount / 2))})
          </button>
          <button
            onClick={() => handleQuickAmount(modal.maxAmount)}
            disabled={modal.maxAmount < 1}
            className="py-2 rounded text-sm font-bold transition-colors disabled:opacity-30"
            style={{
              background: actionColor,
              color: "#fff",
              border: "1px solid rgba(139, 69, 19, 0.6)",
            }}
          >
            All ({formatQuantity(modal.maxAmount)})
          </button>
        </div>

        {/* Custom amount input */}
        <div className="mb-3">
          <label
            className="text-xs mb-1 block"
            style={{ color: "rgba(242, 208, 138, 0.7)" }}
          >
            Custom amount (max: {modal.maxAmount.toLocaleString()})
          </label>
          <input
            ref={inputRef}
            type="number"
            min="1"
            max={modal.maxAmount}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
              if (e.key === "Escape") onClose();
            }}
            className="w-full px-3 py-2 rounded text-sm"
            style={{
              background: "rgba(0, 0, 0, 0.5)",
              border: "1px solid rgba(139, 69, 19, 0.6)",
              color: "#fff",
              outline: "none",
            }}
            placeholder="Enter amount..."
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={
              !amount ||
              parseInt(amount, 10) <= 0 ||
              parseInt(amount, 10) > modal.maxAmount
            }
            className="flex-1 py-2 rounded text-sm font-bold transition-colors disabled:opacity-30"
            style={{
              background: actionColor,
              color: "#fff",
              border: "1px solid rgba(139, 69, 19, 0.6)",
            }}
          >
            {actionLabel}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded text-sm font-bold transition-colors"
            style={{
              background: "rgba(100, 100, 100, 0.5)",
              color: "#fff",
              border: "1px solid rgba(139, 69, 19, 0.6)",
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
