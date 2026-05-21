/**
 * Notification Bar Component
 * Displays application-wide notifications
 */

import { CheckCircle, XCircle, X } from "lucide-react";
import React, { useEffect } from "react";

import { useApp } from "../../contexts/AppContext";

const NotificationBar: React.FC = () => {
  const { notification, clearNotification } = useApp();

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(clearNotification, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification, clearNotification]);

  if (!notification) return null;

  const isSuccess = notification.type === "success";
  const Icon = isSuccess ? CheckCircle : XCircle;
  const accentColor = isSuccess ? "text-success" : "text-error";
  const edgeColor = isSuccess ? "before:bg-success" : "before:bg-error";

  return (
    <div
      className={`fixed top-4 right-4 z-50 relative flex items-center gap-3 px-4 py-3 rounded-md
        bg-bg-secondary border border-border-primary
        before:absolute before:left-0 before:top-2 before:bottom-2 before:w-px ${edgeColor}
        text-text-primary animate-slide-up shadow-[0_4px_16px_rgba(0,0,0,0.4)]`}
    >
      <Icon size={18} className={accentColor} strokeWidth={1.5} />
      <span className="text-sm font-medium">{notification.message}</span>
      <button
        onClick={clearNotification}
        className="ml-2 text-text-tertiary hover:text-text-primary transition-colors duration-300 ease-out"
      >
        <X size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
};

export default NotificationBar;
