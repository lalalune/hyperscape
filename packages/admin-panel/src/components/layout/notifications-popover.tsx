"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Bell,
  Check,
  Trash2,
  X,
  AlertTriangle,
  Info,
  AlertOctagon,
} from "lucide-react";
import { useNotifications } from "@/components/providers/notification-provider";

export function NotificationsPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    markAllRead,
    clearAll,
    removeNotification,
  } = useNotifications();

  const toggleOpen = () => setIsOpen(!isOpen);

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeNotification(id);
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={toggleOpen}
        className={cn(
          "relative p-2 rounded-md transition-colors",
          "hover:bg-(--bg-hover) text-(--text-secondary)",
          isOpen && "bg-(--bg-hover) text-(--accent-primary)",
        )}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-(--color-danger) opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-(--color-danger)"></span>
          </span>
        )}
      </button>

      {/* Popover Content */}
      {isOpen && (
        <>
          {/* Backdrop (invisible) to close on click outside */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="bg-(--bg-secondary) border border-(--border-primary) rounded-sm shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col max-h-[80vh]">
              {/* Header */}
              <div className="p-3 border-b border-(--border-primary) flex items-center justify-between bg-(--bg-primary)/50">
                <div className="flex items-center gap-2">
                  <Bell size={14} className="text-(--accent-primary)" />
                  <span className="text-sm font-bold uppercase tracking-wider text-(--text-primary)">
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-(--color-danger)/20 text-(--color-danger)">
                      {unreadCount} NEW
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={markAllRead}
                    title="Mark all as read"
                    className="p-1.5 hover:bg-(--bg-hover) rounded text-(--text-muted) hover:text-(--text-primary) transition-colors"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={clearAll}
                    title="Clear all"
                    className="p-1.5 hover:bg-(--bg-hover) rounded text-(--text-muted) hover:text-(--color-danger) transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="overflow-y-auto custom-scrollbar flex-1">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center text-(--text-muted)">
                    <Bell size={32} className="opacity-20 mb-2" />
                    <p className="text-xs font-mono">NO ACTIVE ALERTS</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        "relative group p-4 border-b border-(--border-primary) last:border-0 transition-colors hover:bg-(--bg-hover)/50",
                        !notification.read && "bg-(--accent-primary)/5",
                      )}
                    >
                      <div className="flex gap-3">
                        <div className="shrink-0 mt-0.5">
                          {notification.type === "error" && (
                            <AlertOctagon
                              size={16}
                              className="text-(--color-danger)"
                            />
                          )}
                          {notification.type === "warning" && (
                            <AlertTriangle
                              size={16}
                              className="text-(--color-warning)"
                            />
                          )}
                          {notification.type === "success" && (
                            <Check
                              size={16}
                              className="text-(--color-success)"
                            />
                          )}
                          {notification.type === "info" && (
                            <Info size={16} className="text-(--color-info)" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4
                              className={cn(
                                "text-sm font-bold truncate",
                                !notification.read
                                  ? "text-(--text-primary)"
                                  : "text-(--text-secondary)",
                              )}
                            >
                              {notification.title}
                            </h4>
                            <span className="text-[10px] font-mono text-(--text-muted) shrink-0">
                              {notification.timestamp}
                            </span>
                          </div>
                          <p className="text-xs text-(--text-muted) leading-relaxed">
                            {notification.message}
                          </p>
                        </div>
                      </div>

                      {/* Actions on Hover */}
                      <button
                        onClick={(e) => handleRemove(notification.id, e)}
                        className="absolute top-2 right-2 p-1 text-(--text-muted) hover:text-(--color-danger) opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-2 border-t border-(--border-primary) bg-(--bg-primary)/30 text-center">
                <button className="text-[10px] font-mono text-(--text-muted) hover:text-(--accent-primary) transition-colors uppercase tracking-widest">
                  View System Log
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
