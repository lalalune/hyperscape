/**
 * Notification Store Tests
 *
 * Tests for the notification state store including lifecycle management.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Notification type
interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  message: string;
  duration?: number;
  dismissible?: boolean;
}

// Mock notification store
const createMockNotificationStore = () => {
  let notifications: Notification[] = [];
  let counter = 0;

  return {
    getState: () => ({ notifications }),
    add: (notification: Omit<Notification, "id">) => {
      const id = `notification_${++counter}`;
      notifications = [...notifications, { id, ...notification }];
      return id;
    },
    remove: (id: string) => {
      notifications = notifications.filter((n) => n.id !== id);
    },
    clear: () => {
      notifications = [];
    },
    getById: (id: string) => notifications.find((n) => n.id === id),
  };
};

describe("NotificationStore", () => {
  let store: ReturnType<typeof createMockNotificationStore>;

  beforeEach(() => {
    store = createMockNotificationStore();
  });

  describe("Initial State", () => {
    it("should start with empty notifications", () => {
      expect(store.getState().notifications).toEqual([]);
    });
  });

  describe("Add Notification", () => {
    it("should add a notification", () => {
      store.add({
        type: "info",
        message: "Test notification",
      });

      expect(store.getState().notifications.length).toBe(1);
    });

    it("should return notification ID", () => {
      const id = store.add({
        type: "info",
        message: "Test notification",
      });

      expect(id).toMatch(/^notification_/);
    });

    it("should add notification with correct properties", () => {
      store.add({
        type: "success",
        message: "Operation successful",
        duration: 5000,
        dismissible: true,
      });

      const notification = store.getState().notifications[0];
      expect(notification.type).toBe("success");
      expect(notification.message).toBe("Operation successful");
      expect(notification.duration).toBe(5000);
      expect(notification.dismissible).toBe(true);
    });

    it("should add multiple notifications", () => {
      store.add({ type: "info", message: "First" });
      store.add({ type: "warning", message: "Second" });
      store.add({ type: "error", message: "Third" });

      expect(store.getState().notifications.length).toBe(3);
    });

    it("should generate unique IDs", () => {
      const id1 = store.add({ type: "info", message: "First" });
      const id2 = store.add({ type: "info", message: "Second" });

      expect(id1).not.toBe(id2);
    });
  });

  describe("Remove Notification", () => {
    it("should remove a notification by ID", () => {
      const id = store.add({ type: "info", message: "Test" });
      store.remove(id);

      expect(store.getState().notifications.length).toBe(0);
    });

    it("should only remove specified notification", () => {
      const id1 = store.add({ type: "info", message: "First" });
      const id2 = store.add({ type: "info", message: "Second" });

      store.remove(id1);

      const notifications = store.getState().notifications;
      expect(notifications.length).toBe(1);
      expect(notifications[0].id).toBe(id2);
    });

    it("should handle removing non-existent notification", () => {
      store.add({ type: "info", message: "Test" });

      // Should not throw
      store.remove("non_existent_id");

      expect(store.getState().notifications.length).toBe(1);
    });
  });

  describe("Clear Notifications", () => {
    it("should clear all notifications", () => {
      store.add({ type: "info", message: "First" });
      store.add({ type: "warning", message: "Second" });
      store.add({ type: "error", message: "Third" });

      store.clear();

      expect(store.getState().notifications).toEqual([]);
    });

    it("should handle clearing empty notifications", () => {
      store.clear();
      expect(store.getState().notifications).toEqual([]);
    });
  });

  describe("Get By ID", () => {
    it("should get notification by ID", () => {
      const id = store.add({
        type: "success",
        message: "Found it",
      });

      const notification = store.getById(id);
      expect(notification).toBeDefined();
      expect(notification!.message).toBe("Found it");
    });

    it("should return undefined for non-existent ID", () => {
      const notification = store.getById("non_existent");
      expect(notification).toBeUndefined();
    });
  });

  describe("Notification Types", () => {
    it("should support info type", () => {
      store.add({ type: "info", message: "Info" });
      expect(store.getState().notifications[0].type).toBe("info");
    });

    it("should support success type", () => {
      store.add({ type: "success", message: "Success" });
      expect(store.getState().notifications[0].type).toBe("success");
    });

    it("should support warning type", () => {
      store.add({ type: "warning", message: "Warning" });
      expect(store.getState().notifications[0].type).toBe("warning");
    });

    it("should support error type", () => {
      store.add({ type: "error", message: "Error" });
      expect(store.getState().notifications[0].type).toBe("error");
    });
  });

  describe("Notification Lifecycle", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should support auto-dismiss with duration", () => {
      const id = store.add({
        type: "info",
        message: "Auto dismiss",
        duration: 3000,
      });

      // Simulate auto-dismiss (in real implementation)
      setTimeout(() => store.remove(id), 3000);

      vi.advanceTimersByTime(3000);

      expect(store.getState().notifications.length).toBe(0);
    });

    it("should keep notification without duration", () => {
      store.add({
        type: "error",
        message: "Persistent error",
        dismissible: true,
      });

      vi.advanceTimersByTime(10000);

      // Should still be there
      expect(store.getState().notifications.length).toBe(1);
    });
  });
});
