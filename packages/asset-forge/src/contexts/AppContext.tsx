/**
 * Global App Context
 * Provides centralized state management for the application
 */

import React, { createContext, useContext, useState, ReactNode } from "react";

interface AppContextType {
  loading: boolean;
  setLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  notification: { message: string; type: "success" | "error" | "info" } | null;
  showNotification: (
    message: string,
    type?: "success" | "error" | "info",
  ) => void;
  clearNotification: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] =
    useState<AppContextType["notification"]>(null);

  const showNotification = (
    message: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    setNotification({ message, type });
    // Auto-clear after 5 seconds
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  const clearNotification = () => {
    setNotification(null);
  };

  return (
    <AppContext.Provider
      value={{
        loading,
        setLoading,
        error,
        setError,
        notification,
        showNotification,
        clearNotification,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
