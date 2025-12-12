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

  const icon =
    notification.type === "success" ? (
      <CheckCircle size={20} />
    ) : (
      <XCircle size={20} />
    );
  const bgColor = notification.type === "success" ? "bg-success" : "bg-error";

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${bgColor} text-white animate-slide-up`}
    >
      {icon}
      <span className="font-medium">{notification.message}</span>
      <button onClick={clearNotification} className="ml-2 hover:opacity-80">
        <X size={18} />
      </button>
    </div>
  );
};

export default NotificationBar;
