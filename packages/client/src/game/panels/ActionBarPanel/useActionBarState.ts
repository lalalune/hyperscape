/**
 * ActionBarPanel - State management hook
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useWindowStore, useEditStore } from "@/ui";
import { useActionBarKeybindsForBar } from "../../../ui/components/ActionBar";
import { EventType } from "@hyperforge/shared";
import type { ClientWorld } from "../../../types";
import type {
  ActionBarSlotContent,
  ActionBarSlotUpdatePayload,
  ActionBarSlotSwapPayload,
  PrayerStateSyncEventPayload,
  PrayerToggledEventPayload,
  AttackStyleUpdateEventPayload,
  AttackStyleChangedEventPayload,
  ActionBarStatePayload,
  ActionBarNetworkExtensions,
} from "./types";
import {
  MIN_SLOT_COUNT,
  MAX_SLOT_COUNT,
  BORDER_BUFFER,
  loadSlotCount,
  saveSlotCount,
  loadSlots,
  saveSlots,
  loadLockState,
  saveLockState,
  createEmptySlots,
  calcHorizontalDimensions,
} from "./utils";

/**
 * Parse a keybind string like "Ctrl+1" or "Shift+5" into its components
 */
function parseKeybind(keybind: string): {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
} {
  const parts = keybind.split("+");
  const key = parts[parts.length - 1];
  return {
    key,
    ctrl: parts.includes("Ctrl"),
    shift: parts.includes("Shift"),
    alt: parts.includes("Alt"),
  };
}

/**
 * Check if a keyboard event matches a keybind string
 */
function matchesKeybind(e: KeyboardEvent, keybind: string): boolean {
  const parsed = parseKeybind(keybind);
  return (
    e.key === parsed.key &&
    e.ctrlKey === parsed.ctrl &&
    e.shiftKey === parsed.shift &&
    e.altKey === parsed.alt
  );
}

// Save slots to server (persistent storage)
function saveSlotsToServer(
  world: ClientWorld,
  barId: number,
  slotCount: number,
  slots: ActionBarSlotContent[],
): void {
  if (!world?.network) return;
  try {
    world.network.send("actionBarSave", {
      barId,
      slotCount,
      slots,
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[ActionBar] Failed to save action bar to server:", error);
    }
  }
}

// Load slots from server
function loadSlotsFromServer(world: ClientWorld, barId: number): void {
  if (!world?.network) return;
  try {
    world.network.send("actionBarLoad", { barId });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[ActionBar] Failed to load action bar from server:", error);
    }
  }
}

export interface UseActionBarStateOptions {
  world: ClientWorld;
  barId: number;
  isEditMode: boolean;
  windowId?: string;
  useParentDndContext: boolean;
}

/** Inventory item data for action bar availability tracking */
export interface InventoryItemInfo {
  itemId: string;
  quantity: number;
}

export interface UseActionBarStateResult {
  // State
  slotCount: number;
  slots: ActionBarSlotContent[];
  hoveredSlot: number | null;
  activePrayers: Set<string>;
  activeAttackStyle: string | null;
  isLocked: boolean;
  keyboardShortcuts: string[];
  /** RS3-style: Map of itemId -> quantity in inventory */
  inventoryItems: Map<string, number>;

  // State setters
  setSlots: React.Dispatch<React.SetStateAction<ActionBarSlotContent[]>>;
  setHoveredSlot: React.Dispatch<React.SetStateAction<number | null>>;

  // Handlers
  handleIncreaseSlots: () => void;
  handleDecreaseSlots: () => void;
  handleToggleLock: () => void;
  handleClearAll: () => void;
  handleUseSlot: (slot: ActionBarSlotContent, index: number) => void;
  /** RS3-style: Get item availability and quantity for a slot */
  getItemAvailability: (itemId: string) => {
    available: boolean;
    quantity: number;
  };
}

export function useActionBarState({
  world,
  barId,
  isEditMode,
  windowId,
  useParentDndContext,
}: UseActionBarStateOptions): UseActionBarStateResult {
  const updateWindow = useWindowStore((s) => s.updateWindow);
  const gridSize = useEditStore((s) => s.gridSize);

  // Slot count state (persisted to localStorage)
  const [slotCount, setSlotCount] = useState<number>(() =>
    loadSlotCount(barId),
  );
  const [slots, setSlots] = useState<ActionBarSlotContent[]>(() =>
    loadSlots(barId, loadSlotCount(barId)),
  );
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [activePrayers, setActivePrayers] = useState<Set<string>>(new Set());
  const [activeAttackStyle, setActiveAttackStyle] = useState<string | null>(
    null,
  );
  const [isLocked, setIsLocked] = useState<boolean>(() => loadLockState(barId));
  // RS3-style: Track inventory items for availability display
  const [inventoryItems, setInventoryItems] = useState<Map<string, number>>(
    new Map(),
  );

  // Track if we've loaded from server
  const serverLoadedRef = useRef(false);

  // Helper to snap to grid
  const snapToGrid = useCallback(
    (value: number) => Math.ceil(value / gridSize) * gridSize,
    [gridSize],
  );

  // Update window size and position when slot count changes
  // Recalculate position to keep action bar centered horizontally AND anchored to bottom
  useEffect(() => {
    if (!windowId) return;

    const dims = calcHorizontalDimensions(slotCount, { isEditMode, isLocked });
    const width = snapToGrid(dims.width + BORDER_BUFFER);
    const height = snapToGrid(dims.height + BORDER_BUFFER);

    // Get viewport dimensions for positioning
    const viewportWidth =
      typeof window !== "undefined" ? window.innerWidth : 1920;
    const viewportHeight =
      typeof window !== "undefined" ? window.innerHeight : 1080;

    // Center horizontally and anchor to bottom of viewport
    const centeredX = Math.floor(viewportWidth / 2 - width / 2);
    const bottomAnchoredY = viewportHeight - height;

    updateWindow(windowId, {
      minSize: { width, height },
      maxSize: { width, height },
      size: { width, height },
      position: { x: centeredX, y: bottomAnchoredY },
    });
  }, [windowId, slotCount, isEditMode, isLocked, updateWindow, snapToGrid]);

  // Handle slot count changes
  const handleIncreaseSlots = useCallback(() => {
    if (slotCount < MAX_SLOT_COUNT) {
      const newCount = slotCount + 1;
      setSlotCount(newCount);
      saveSlotCount(barId, newCount);
      setSlots((prev) => [
        ...prev,
        { type: "empty", id: `empty-${prev.length}` },
      ]);
    }
  }, [slotCount, barId]);

  const handleDecreaseSlots = useCallback(() => {
    if (slotCount > MIN_SLOT_COUNT) {
      const newCount = slotCount - 1;
      setSlotCount(newCount);
      saveSlotCount(barId, newCount);
      setSlots((prev) => prev.slice(0, newCount));
    }
  }, [slotCount, barId]);

  // Toggle lock state
  const handleToggleLock = useCallback(() => {
    setIsLocked((prev) => {
      const newValue = !prev;
      saveLockState(barId, newValue);
      return newValue;
    });
  }, [barId]);

  // Clear all slots
  const handleClearAll = useCallback(() => {
    setSlots(createEmptySlots(slotCount));
  }, [slotCount]);

  // Listen for prayer state changes
  useEffect(() => {
    if (!world) return;

    const handlePrayerStateSync = (...args: unknown[]) => {
      const data = args[0] as PrayerStateSyncEventPayload;
      const localPlayer = world.getPlayer();
      if (!localPlayer || data.playerId !== localPlayer.id) return;
      setActivePrayers(new Set(data.active));
    };

    const handlePrayerToggled = (...args: unknown[]) => {
      const data = args[0] as PrayerToggledEventPayload;
      const localPlayer = world.getPlayer();
      if (!localPlayer || data.playerId !== localPlayer.id) return;
      setActivePrayers((prev) => {
        const next = new Set(prev);
        if (data.active) {
          next.add(data.prayerId);
        } else {
          next.delete(data.prayerId);
        }
        return next;
      });
    };

    // Event handlers cast to match emitter signature - data validated by type guards
    world.on(
      EventType.PRAYER_STATE_SYNC,
      handlePrayerStateSync as (...args: unknown[]) => void,
    );
    world.on(
      EventType.PRAYER_TOGGLED,
      handlePrayerToggled as (...args: unknown[]) => void,
    );

    return () => {
      world.off(
        EventType.PRAYER_STATE_SYNC,
        handlePrayerStateSync as (...args: unknown[]) => void,
      );
      world.off(
        EventType.PRAYER_TOGGLED,
        handlePrayerToggled as (...args: unknown[]) => void,
      );
    };
  }, [world]);

  // Listen for attack style changes
  useEffect(() => {
    if (!world) return;

    const handleAttackStyleUpdate = (...args: unknown[]) => {
      const data = args[0] as AttackStyleUpdateEventPayload;
      const localPlayer = world.getPlayer();
      if (!localPlayer || data.playerId !== localPlayer.id) return;
      setActiveAttackStyle(data.style);
    };

    const handleAttackStyleChanged = (...args: unknown[]) => {
      const data = args[0] as AttackStyleChangedEventPayload;
      const localPlayer = world.getPlayer();
      if (!localPlayer || data.playerId !== localPlayer.id) return;
      setActiveAttackStyle(data.newStyle);
    };

    // Initialize from network cache if available
    const localPlayer = world.getPlayer();
    if (localPlayer) {
      const networkCache = world.network as ActionBarNetworkExtensions;
      const cachedStyle =
        networkCache?.lastAttackStyleByPlayerId?.[localPlayer.id];
      if (cachedStyle) {
        setActiveAttackStyle(cachedStyle);
      }
    }

    // Event handlers cast to match emitter signature
    world.on(
      EventType.UI_ATTACK_STYLE_UPDATE,
      handleAttackStyleUpdate as (...args: unknown[]) => void,
    );
    world.on(
      EventType.UI_ATTACK_STYLE_CHANGED,
      handleAttackStyleChanged as (...args: unknown[]) => void,
    );

    return () => {
      world.off(
        EventType.UI_ATTACK_STYLE_UPDATE,
        handleAttackStyleUpdate as (...args: unknown[]) => void,
      );
      world.off(
        EventType.UI_ATTACK_STYLE_CHANGED,
        handleAttackStyleChanged as (...args: unknown[]) => void,
      );
    };
  }, [world]);

  // Get bar-specific keybinds (barId is 0-indexed, useActionBarKeybindsForBar expects 1-indexed)
  const keyboardShortcuts = useActionBarKeybindsForBar(barId + 1);

  // Load from server on mount
  useEffect(() => {
    if (!world) return;
    loadSlotsFromServer(world, barId);
  }, [world, barId]);

  // Handle server response with action bar state
  useEffect(() => {
    if (!world) return;

    const handleActionBarState = (...args: unknown[]) => {
      const data = args[0] as ActionBarStatePayload;
      if (data.barId !== barId) return;

      if (Array.isArray(data.slots) && data.slots.length > 0) {
        serverLoadedRef.current = true;
        if (
          data.slotCount >= MIN_SLOT_COUNT &&
          data.slotCount <= MAX_SLOT_COUNT
        ) {
          setSlotCount(data.slotCount);
          saveSlotCount(barId, data.slotCount);
        }
        setSlots(data.slots);
        saveSlots(barId, data.slots);
      }
    };

    // Event handler cast to match emitter signature
    world.on(
      "actionBarState",
      handleActionBarState as (...args: unknown[]) => void,
    );
    return () => {
      world.off(
        "actionBarState",
        handleActionBarState as (...args: unknown[]) => void,
      );
    };
  }, [world, barId]);

  // Listen for slot updates from InterfaceManager (cross-panel drag-drop)
  useEffect(() => {
    if (!world || !useParentDndContext) return;

    const handleSlotUpdate = (...args: unknown[]) => {
      const data = args[0] as ActionBarSlotUpdatePayload;
      if (data.barId !== barId) return;

      setSlots((prev) => {
        const newSlots = [...prev];
        newSlots[data.slotIndex] = data.slot;
        return newSlots;
      });
    };

    const handleSlotSwap = (...args: unknown[]) => {
      const data = args[0] as ActionBarSlotSwapPayload;
      if (data.barId !== barId) return;

      setSlots((prev) => {
        const newSlots = [...prev];
        [newSlots[data.fromIndex], newSlots[data.toIndex]] = [
          newSlots[data.toIndex],
          newSlots[data.fromIndex],
        ];
        return newSlots;
      });
    };

    // Event handlers cast to match emitter signature
    world.on(
      EventType.ACTION_BAR_SLOT_UPDATE,
      handleSlotUpdate as (...args: unknown[]) => void,
    );
    world.on(
      EventType.ACTION_BAR_SLOT_SWAP,
      handleSlotSwap as (...args: unknown[]) => void,
    );
    return () => {
      world.off(
        EventType.ACTION_BAR_SLOT_UPDATE,
        handleSlotUpdate as (...args: unknown[]) => void,
      );
      world.off(
        EventType.ACTION_BAR_SLOT_SWAP,
        handleSlotSwap as (...args: unknown[]) => void,
      );
    };
  }, [world, barId, useParentDndContext]);

  // Persist slots to localStorage and server
  useEffect(() => {
    saveSlots(barId, slots);
    if (serverLoadedRef.current) {
      saveSlotsToServer(world, barId, slotCount, slots);
    }
  }, [world, barId, slots, slotCount]);

  // Handle using a slot (left click or keyboard shortcut)
  const handleUseSlot = useCallback(
    (slot: ActionBarSlotContent, _index: number) => {
      if (slot.type === "empty") return;

      if (slot.type === "item" && slot.itemId) {
        const player = world.getPlayer();
        if (!player) return;

        const network = world.network as {
          lastInventoryByPlayerId?: Record<
            string,
            { items: Array<{ slot: number; itemId: string; quantity: number }> }
          >;
        };
        const inventory = network?.lastInventoryByPlayerId?.[player.id];
        if (!inventory) {
          console.debug("[ActionBar] No inventory cache available");
          return;
        }

        const invItem = inventory.items.find(
          (item) => item.itemId === slot.itemId && item.quantity > 0,
        );
        if (!invItem) {
          console.debug(
            "[ActionBar] Item not found in inventory:",
            slot.itemId,
          );
          return;
        }

        world.network?.send?.("useItem", {
          itemId: slot.itemId,
          slot: invItem.slot,
        });
      } else if (slot.type === "skill" && slot.skillId) {
        // Open the skills panel when a skill slot is clicked (RS3 behavior)
        // Emit event to open the pane with the skills tab focused
        world.emit(EventType.UI_OPEN_PANE, {
          pane: "skills",
        });
      } else if (slot.type === "spell" && slot.spellId) {
        const network = world.network;
        if (network && "castSpell" in network) {
          const localPlayer = world.getPlayer();
          const targetId =
            (
              localPlayer as { getCombatTarget?: () => string | undefined }
            )?.getCombatTarget?.() ?? undefined;
          (
            network as {
              castSpell: (id: string, targetId?: string) => void;
            }
          ).castSpell(slot.spellId, targetId);
          console.debug(
            "[ActionBar] Spell cast:",
            slot.spellId,
            "target:",
            targetId,
          );
        }
      } else if (slot.type === "prayer" && slot.prayerId) {
        const network = world.network;
        if (network && "togglePrayer" in network) {
          (network as { togglePrayer: (id: string) => void }).togglePrayer(
            slot.prayerId,
          );
        }
      } else if (slot.type === "combatstyle" && slot.combatStyleId) {
        // Change attack style when combat style slot is clicked
        const player = world.getPlayer();
        if (!player) return;

        const actions = world.getSystem("actions") as {
          actionMethods?: {
            changeAttackStyle?: (playerId: string, style: string) => void;
          };
        } | null;

        actions?.actionMethods?.changeAttackStyle?.(
          player.id,
          slot.combatStyleId,
        );
      }
    },
    [world],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Find matching keybind (supports modifiers like Ctrl+1, Shift+2, etc.)
      const shortcutIndex = keyboardShortcuts.findIndex((shortcut) =>
        matchesKeybind(e, shortcut),
      );

      if (shortcutIndex !== -1 && shortcutIndex < slots.length) {
        const slot = slots[shortcutIndex];
        if (slot.type !== "empty") {
          // Prevent default for modifier combinations to avoid browser shortcuts
          e.preventDefault();
          handleUseSlot(slot, shortcutIndex);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slots, keyboardShortcuts, handleUseSlot]);

  // RS3-style: Track inventory items for availability display
  useEffect(() => {
    if (!world) return;

    const updateInventoryItems = () => {
      const player = world.getPlayer();
      if (!player) return;

      const network = world.network as {
        lastInventoryByPlayerId?: Record<
          string,
          { items: Array<{ slot: number; itemId: string; quantity: number }> }
        >;
      };
      const inventory = network?.lastInventoryByPlayerId?.[player.id];
      if (!inventory) return;

      // Build map of itemId -> total quantity
      const itemMap = new Map<string, number>();
      for (const item of inventory.items) {
        if (item.quantity > 0) {
          const current = itemMap.get(item.itemId) || 0;
          itemMap.set(item.itemId, current + item.quantity);
        }
      }
      setInventoryItems(itemMap);
    };

    // Update on inventory sync event
    const handleInventorySync = () => {
      updateInventoryItems();
    };

    // Initial update
    updateInventoryItems();

    world.on(EventType.INVENTORY_UPDATED, handleInventorySync);
    return () => {
      world.off(EventType.INVENTORY_UPDATED, handleInventorySync);
    };
  }, [world]);

  // RS3-style: Get item availability and quantity
  const getItemAvailability = useCallback(
    (itemId: string): { available: boolean; quantity: number } => {
      const quantity = inventoryItems.get(itemId) || 0;
      return { available: quantity > 0, quantity };
    },
    [inventoryItems],
  );

  return {
    slotCount,
    slots,
    hoveredSlot,
    activePrayers,
    activeAttackStyle,
    isLocked,
    keyboardShortcuts,
    inventoryItems,
    setSlots,
    setHoveredSlot,
    handleIncreaseSlots,
    handleDecreaseSlots,
    handleToggleLock,
    handleClearAll,
    handleUseSlot,
    getItemAvailability,
  };
}
