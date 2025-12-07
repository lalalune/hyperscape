"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
  showWarning: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", duration: number = 5000) => {
      const id = Math.random().toString(36).substring(7);
      const toast: Toast = { id, message, type, duration };

      setToasts((prev) => [...prev, toast]);

      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
    },
    [removeToast],
  );

  const showSuccess = useCallback(
    (message: string) => showToast(message, "success"),
    [showToast],
  );
  const showError = useCallback(
    (message: string) => showToast(message, "error", 8000),
    [showToast],
  );
  const showInfo = useCallback(
    (message: string) => showToast(message, "info"),
    [showToast],
  );
  const showWarning = useCallback(
    (message: string) => showToast(message, "warning", 6000),
    [showToast],
  );

  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case "success":
        return {
          bg: "bg-(--color-success)/10",
          border: "border-(--color-success)",
          icon: CheckCircle,
          iconColor: "text-(--color-success)",
        };
      case "error":
        return {
          bg: "bg-(--color-error)/10",
          border: "border-(--color-error)",
          icon: AlertCircle,
          iconColor: "text-(--color-error)",
        };
      case "warning":
        return {
          bg: "bg-(--color-warning)/10",
          border: "border-(--color-warning)",
          icon: AlertTriangle,
          iconColor: "text-(--color-warning)",
        };
      case "info":
      default:
        return {
          bg: "bg-(--color-info)/10",
          border: "border-(--color-info)",
          icon: Info,
          iconColor: "text-(--color-info)",
        };
    }
  };

  return (
    <ToastContext.Provider
      value={{ showToast, showSuccess, showError, showInfo, showWarning }}
    >
      {children}

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
        {toasts.map((toast) => {
          const styles = getToastStyles(toast.type);
          const Icon = styles.icon;

          return (
            <div
              key={toast.id}
              className={cn(
                "flex items-start gap-3 p-4 rounded-lg border shadow-lg",
                "animate-in slide-in-from-right duration-300",
                "bg-(--bg-elevated)",
                styles.border,
              )}
            >
              <Icon
                className={cn("h-5 w-5 flex-shrink-0 mt-0.5", styles.iconColor)}
              />
              <p className="flex-1 text-sm text-(--text-primary)">
                {toast.message}
              </p>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-(--text-muted) hover:text-(--text-primary) transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
