"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

// --- Types ---

export type NotificationType = "info" | "warning" | "error" | "success";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: string; // Pre-formatted for display simplify
  read: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (
    title: string,
    message: string,
    type: NotificationType,
  ) => void;
  markAllRead: () => void;
  clearAll: () => void;
  removeNotification: (id: string) => void;
}

// --- Context ---

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider",
    );
  }
  return context;
}

// --- Provider ---

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const addNotification = (
    title: string,
    message: string,
    type: NotificationType,
  ) => {
    const newNotification: Notification = {
      id: crypto.randomUUID(),
      title,
      message,
      type,
      timestamp: "Just now", // Simple relative time for now
      read: false,
    };
    setNotifications((prev) => [newNotification, ...prev]);
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAllRead,
        clearAll,
        removeNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
