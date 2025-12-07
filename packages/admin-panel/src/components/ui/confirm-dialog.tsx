"use client";

import { Dialog, DialogContent, DialogFooter } from "./dialog";
import { Button } from "./button";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "warning",
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "danger":
        return {
          iconColor: "text-(--color-error)",
          buttonVariant: "danger" as const,
        };
      case "warning":
        return {
          iconColor: "text-(--color-warning)",
          buttonVariant: "primary" as const,
        };
      case "info":
      default:
        return {
          iconColor: "text-(--color-info)",
          buttonVariant: "primary" as const,
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <DialogContent>
        <div className="flex items-start gap-4">
          <AlertTriangle
            className={`h-6 w-6 flex-shrink-0 mt-1 ${styles.iconColor}`}
          />
          <p className="text-(--text-primary)">{message}</p>
        </div>
      </DialogContent>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          {cancelText}
        </Button>
        <Button variant={styles.buttonVariant} onClick={handleConfirm}>
          {confirmText}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
