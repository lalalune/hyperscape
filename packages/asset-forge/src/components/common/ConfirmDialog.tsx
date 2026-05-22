/**
 * ConfirmDialog — reusable confirmation modal for destructive actions.
 *
 * For irreversible operations (delete team, remove member, leave team)
 * we want the user to read what's about to happen and explicitly
 * confirm. Optionally requires typing a specific phrase before the
 * confirm button enables (e.g. "delete forge-studios") for high-risk
 * actions.
 */

import { AlertTriangle, Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";

import { Modal, ModalHeader, ModalBody, ModalFooter } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** Async action — modal closes only after this resolves. */
  onConfirm: () => Promise<void> | void;
  title: string;
  /** Body content. Can be a string or rich React content (for emphasis). */
  message: React.ReactNode;
  /** Label on the confirm button. */
  confirmLabel?: string;
  /** "destructive" colors the confirm button in error tone. */
  variant?: "destructive" | "primary";
  /**
   * If set, the user must type this exact value into the input before
   * the confirm button is enabled. Use for irreversible operations
   * (e.g. delete team).
   */
  confirmPhrase?: string;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  variant = "destructive",
  confirmPhrase,
}: ConfirmDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTyped("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  const phraseOK = !confirmPhrase || typed === confirmPhrase;
  const canConfirm = phraseOK && !submitting;

  return (
    <Modal open={open} onClose={handleClose} size="sm">
      <ModalHeader>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-bg-primary border border-border-primary flex items-center justify-center flex-shrink-0">
            <AlertTriangle
              size={14}
              strokeWidth={1.5}
              className={
                variant === "destructive" ? "text-error" : "text-primary"
              }
            />
          </div>
          <h2 className="font-display text-lg font-medium text-text-primary tracking-tight">
            {title}
          </h2>
        </div>
      </ModalHeader>

      <ModalBody>
        <div className="space-y-4">
          <div className="text-sm text-text-secondary leading-relaxed">
            {message}
          </div>

          {confirmPhrase && (
            <div>
              <p className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] mb-2">
                Type{" "}
                <span className="font-mono normal-case tracking-normal text-text-primary">
                  {confirmPhrase}
                </span>{" "}
                to confirm
              </p>
              <input
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={confirmPhrase}
                className="input font-mono text-[12px]"
                autoFocus
                disabled={submitting}
              />
            </div>
          )}

          {error && (
            <div className="rounded-md bg-bg-primary border border-error/40 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter>
        <button
          type="button"
          onClick={handleClose}
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors duration-300 ease-out disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          className={`inline-flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-colors duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed ${
            variant === "destructive"
              ? "bg-error text-bg-primary hover:bg-error/85"
              : "bg-primary text-bg-primary hover:bg-primary-dark"
          }`}
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {submitting ? "Working…" : confirmLabel}
        </button>
      </ModalFooter>
    </Modal>
  );
}
