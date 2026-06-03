/**
 * Drag Drop Coordinator
 *
 * Handles all drag-drop logic for the InterfaceManager including:
 * - Tab dragging between windows (custom DnD system)
 * - Item dragging between panels (@dnd-kit system)
 * - Inventory, equipment, action bar, skill, and prayer drops
 *
 * @packageDocumentation
 */

import { useCallback, useState, type MutableRefObject } from "react";
import { EventType, getItem } from "@hyperforge/shared";
import {
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent as DndKitDragEndEvent,
  type DragStartEvent as DndKitDragStartEvent,
} from "@dnd-kit/core";
import { useTabDrag, useDragStore, type DragEndEvent } from "@/ui";
import type { ClientWorld, InventorySlotViewItem } from "../../types";

/** Skill data for action bar */
interface SkillData {
  id: string;
  name: string;
  icon: string;
  level: number;
}

/** Prayer data for action bar */
interface PrayerData {
  id: string;
  name: string;
  icon: string;
  level: number;
}

/** Active drag item for @dnd-kit overlay */
export interface DndKitActiveItem {
  id: string;
  data: Record<string, unknown>;
}

/** Props for useDragDropCoordinator hook */
interface DragDropCoordinatorProps {
  world: ClientWorld | null;
  inventoryRef: MutableRefObject<InventorySlotViewItem[]>;
}

/** Return type for useDragDropCoordinator hook */
interface DragDropCoordinatorResult {
  /** Handler for custom tab drag end */
  handleDragEnd: (event: DragEndEvent) => void;
  /** Handler for @dnd-kit drag start */
  handleDndKitDragStart: (event: DndKitDragStartEvent) => void;
  /** Handler for @dnd-kit drag end */
  handleDndKitDragEnd: (event: DndKitDragEndEvent) => void;
  /** @dnd-kit sensors configuration */
  dndKitSensors: ReturnType<typeof useSensors>;
  /** Currently active @dnd-kit drag item */
  dndKitActiveItem: DndKitActiveItem | null;
}

/**
 * Custom hook that coordinates all drag-drop operations
 */
export function useDragDropCoordinator({
  world,
  inventoryRef,
}: DragDropCoordinatorProps): DragDropCoordinatorResult {
  // State for @dnd-kit item dragging
  const [dndKitActiveItem, setDndKitActiveItem] =
    useState<DndKitActiveItem | null>(null);

  // Tab drag handler from UI library
  const { splitTab } = useTabDrag();

  // Configure dnd-kit sensors with activation constraints
  const dndKitSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Must move 8 pixels before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // Long-press 250ms to start drag on mobile
        tolerance: 5, // Allow 5px movement during delay
      },
    }),
  );

  // Tab drag handler - create new window when tab dropped outside
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const activeId = active.id as string;
      const overId = over?.id as string | undefined;

      // Handle inventory -> equipment drops
      if (
        activeId.startsWith("inventory-") &&
        overId?.startsWith("equipment-")
      ) {
        handleInventoryToEquipment(
          activeId,
          overId,
          inventoryRef.current,
          world,
        );
        return;
      }

      // Handle inventory -> inventory drops (reordering)
      if (
        activeId.startsWith("inventory-") &&
        (overId?.startsWith("inventory-drop-") ||
          overId?.startsWith("inventory-"))
      ) {
        handleInventoryMove(activeId, overId, world);
        return;
      }

      // Handle drops to action bar
      if (overId?.startsWith("actionbar-drop-")) {
        handleActionBarDrop(
          activeId,
          overId,
          active,
          inventoryRef.current,
          world,
        );
        return;
      }

      // Only handle tab drags for the remaining logic
      const activeItem = active as {
        id: string;
        type?: string;
        sourceId?: string | null;
        data?: unknown;
      };
      if (activeItem.type !== "tab") return;

      if (over && overId) {
        if (
          overId.startsWith("tabbar-") ||
          overId.startsWith("window-header-drop-")
        ) {
          // Tab dropped on window zone, useDrop handles it
          return;
        }
      }

      // Tab was dropped outside of any window - create new window
      const tabId = active.id;
      const dragState = useDragStore.getState();
      const currentPos = dragState.current;

      const dropPosition = {
        x: Math.max(20, Math.min(window.innerWidth - 200, currentPos.x - 100)),
        y: Math.max(20, Math.min(window.innerHeight - 200, currentPos.y - 20)),
      };

      splitTab(tabId, dropPosition);
    },
    [splitTab, inventoryRef, world],
  );

  // @dnd-kit drag start handler
  const handleDndKitDragStart = useCallback((event: DndKitDragStartEvent) => {
    const { active } = event;
    setDndKitActiveItem({
      id: String(active.id),
      data: (active.data.current as Record<string, unknown>) || {},
    });
  }, []);

  // @dnd-kit drag end handler for item dragging between panels
  const handleDndKitDragEnd = useCallback(
    (event: DndKitDragEndEvent) => {
      const { active, over } = event;
      setDndKitActiveItem(null);

      const activeId = String(active.id);
      const activeData = active.data.current as
        | Record<string, unknown>
        | undefined;

      // Handle drag-out removal for action bar slots
      if (!over) {
        if (
          activeId.startsWith("actionbar-slot-") &&
          activeData?.source === "actionbar"
        ) {
          const slotIndex = activeData.slotIndex as number | undefined;
          if (slotIndex !== undefined && world) {
            world.emit(EventType.ACTION_BAR_SLOT_UPDATE, {
              barId: 0,
              slotIndex,
              slot: { type: "empty", id: `empty-${slotIndex}` },
            });
          }
        }
        return;
      }

      const overId = String(over.id);
      const overData = over.data.current as Record<string, unknown> | undefined;

      // Handle action bar -> rubbish bin drops
      if (
        activeId.startsWith("actionbar-slot-") &&
        (overId === "actionbar-rubbish-bin" ||
          overData?.target === "rubbish-bin")
      ) {
        handleActionBarToRubbish(activeData, world);
        return;
      }

      // Handle action bar -> action bar reordering
      if (
        activeId.startsWith("actionbar-slot-") &&
        overId.startsWith("actionbar-drop-")
      ) {
        handleActionBarReorder(activeData, overId, world);
        return;
      }

      // Handle inventory -> action bar drops
      if (
        activeId.startsWith("inventory-") &&
        overId.startsWith("actionbar-drop-")
      ) {
        handleInventoryToActionBar(
          activeId,
          overId,
          activeData,
          inventoryRef.current,
          world,
        );
        return;
      }

      // Handle inventory -> inventory drops
      if (
        activeId.startsWith("inventory-") &&
        (overId.startsWith("inventory-drop-") ||
          overId.startsWith("inventory-"))
      ) {
        handleInventoryMove(activeId, overId, world);
        return;
      }

      // Handle prayer -> action bar drops
      if (
        activeId.startsWith("prayer-") &&
        overId.startsWith("actionbar-drop-")
      ) {
        handlePrayerToActionBar(overId, activeData, world);
        return;
      }

      // Handle skill -> action bar drops
      if (
        activeId.startsWith("skill-") &&
        overId.startsWith("actionbar-drop-")
      ) {
        handleSkillToActionBar(overId, activeData, world);
        return;
      }

      // Handle inventory -> equipment drops
      if (
        activeId.startsWith("inventory-") &&
        overId.startsWith("equipment-")
      ) {
        handleInventoryToEquipment(
          activeId,
          overId,
          inventoryRef.current,
          world,
          activeData,
        );
        return;
      }
    },
    [inventoryRef, world],
  );

  return {
    handleDragEnd,
    handleDndKitDragStart,
    handleDndKitDragEnd,
    dndKitSensors,
    dndKitActiveItem,
  };
}

// Helper functions for specific drop operations

function handleInventoryToEquipment(
  activeId: string,
  overId: string,
  inventory: InventorySlotViewItem[],
  world: ClientWorld | null,
  activeData?: Record<string, unknown>,
): void {
  const slotIndex = parseInt(activeId.replace("inventory-", ""), 10);
  const equipmentSlot = overId.replace("equipment-", "");
  // Use drag data first (always correct), fall back to slot-based lookup
  const item =
    (activeData?.item as InventorySlotViewItem | undefined) ||
    inventory.find((i) => i.slot === slotIndex);

  if (item && world) {
    const localPlayer = world.getPlayer();
    if (localPlayer) {
      const itemData = getItem(item.itemId);

      if (itemData) {
        const itemEquipSlot = itemData.equipSlot;
        const normalizedItemSlot =
          itemEquipSlot === "2h" ? "weapon" : itemEquipSlot;

        if (normalizedItemSlot && normalizedItemSlot !== equipmentSlot) {
          world.emit(EventType.UI_MESSAGE, {
            playerId: localPlayer.id,
            message: `Cannot equip ${itemData.name || item.itemId} in ${equipmentSlot} slot`,
            type: "error",
          });
          return;
        }
      }

      world.network?.send("equipItem", {
        playerId: localPlayer.id,
        itemId: item.itemId,
        inventorySlot: slotIndex,
        equipmentSlot,
      });
    }
  }
}

function handleInventoryMove(
  activeId: string,
  overId: string,
  world: ClientWorld | null,
): void {
  const fromSlot = parseInt(activeId.replace("inventory-", ""), 10);
  const toSlot = overId.startsWith("inventory-drop-")
    ? parseInt(overId.replace("inventory-drop-", ""), 10)
    : parseInt(overId.replace("inventory-", ""), 10);

  if (fromSlot === toSlot) return;

  if (world) {
    world.network?.send?.("moveItem", { fromSlot, toSlot });
  }
}

function handleActionBarDrop(
  activeId: string,
  overId: string,
  active: { id: string; data?: unknown },
  inventory: InventorySlotViewItem[],
  world: ClientWorld | null,
): void {
  const slotIndex = parseInt(overId.replace("actionbar-drop-", ""), 10);
  const activeData = active.data as
    | {
        skill?: SkillData;
        prayer?: PrayerData;
        item?: { slot: number; itemId: string; quantity: number };
        source?: string;
      }
    | undefined;

  const barId = 0;

  if (activeData?.source === "skill" && activeData.skill && world) {
    world.emit(EventType.ACTION_BAR_SLOT_UPDATE, {
      barId,
      slotIndex,
      slot: {
        type: "skill",
        id: `skill-${activeData.skill.id}-${Date.now()}`,
        skillId: activeData.skill.id,
        icon: activeData.skill.icon,
        label: activeData.skill.name,
      },
    });
    return;
  }

  if (activeData?.source === "prayer" && activeData.prayer && world) {
    world.emit(EventType.ACTION_BAR_SLOT_UPDATE, {
      barId,
      slotIndex,
      slot: {
        type: "prayer",
        id: `prayer-${activeData.prayer.id}-${Date.now()}`,
        prayerId: activeData.prayer.id,
        icon: activeData.prayer.icon,
        label: activeData.prayer.name,
      },
    });
    return;
  }

  if (activeId.startsWith("inventory-") && activeData?.item && world) {
    world.emit(EventType.ACTION_BAR_SLOT_UPDATE, {
      barId,
      slotIndex,
      slot: {
        type: "item",
        id: `item-${activeData.item.itemId}-${Date.now()}`,
        itemId: activeData.item.itemId,
        quantity: activeData.item.quantity,
        label: activeData.item.itemId,
      },
    });
  }
}

function handleActionBarToRubbish(
  activeData: Record<string, unknown> | undefined,
  world: ClientWorld | null,
): void {
  const slotIndex = activeData?.slotIndex as number | undefined;
  if (slotIndex !== undefined && world) {
    world.emit(EventType.ACTION_BAR_SLOT_UPDATE, {
      barId: 0,
      slotIndex,
      slot: { type: "empty", id: `empty-${slotIndex}` },
    });
  }
}

function handleActionBarReorder(
  activeData: Record<string, unknown> | undefined,
  overId: string,
  world: ClientWorld | null,
): void {
  const fromIndex = activeData?.slotIndex as number | undefined;
  const slotMatch = overId.match(/actionbar-drop-(\d+)/);
  const toIndex = slotMatch ? parseInt(slotMatch[1], 10) : undefined;

  if (
    fromIndex !== undefined &&
    toIndex !== undefined &&
    fromIndex !== toIndex &&
    world
  ) {
    world.emit(EventType.ACTION_BAR_SLOT_SWAP, {
      barId: 0,
      fromIndex,
      toIndex,
    });
  }
}

function handleInventoryToActionBar(
  activeId: string,
  overId: string,
  activeData: Record<string, unknown> | undefined,
  inventory: InventorySlotViewItem[],
  world: ClientWorld | null,
): void {
  const invSlot = parseInt(activeId.replace("inventory-", ""), 10);
  const slotMatch = overId.match(/actionbar-drop-(\d+)/);
  const slotIndex = slotMatch ? parseInt(slotMatch[1], 10) : undefined;

  // Use drag data first (always correct), fall back to slot-based lookup
  const itemFromDragData = activeData?.item as
    | InventorySlotViewItem
    | undefined;
  const itemFromProps = inventory.find((i) => i.slot === invSlot);
  const item = itemFromDragData || itemFromProps;

  if (item && slotIndex !== undefined && world) {
    world.emit(EventType.ACTION_BAR_SLOT_UPDATE, {
      barId: 0,
      slotIndex,
      slot: {
        type: "item",
        id: `item-${item.itemId}-${Date.now()}`,
        itemId: item.itemId,
        quantity: item.quantity,
        label: item.itemId,
      },
    });
  }
}

function handlePrayerToActionBar(
  overId: string,
  activeData: Record<string, unknown> | undefined,
  world: ClientWorld | null,
): void {
  const slotMatch = overId.match(/actionbar-drop-(\d+)/);
  const slotIndex = slotMatch ? parseInt(slotMatch[1], 10) : undefined;
  const prayerData = activeData?.prayer as PrayerData | undefined;

  if (prayerData && slotIndex !== undefined && world) {
    world.emit(EventType.ACTION_BAR_SLOT_UPDATE, {
      barId: 0,
      slotIndex,
      slot: {
        type: "prayer",
        id: `prayer-${prayerData.id}-${Date.now()}`,
        prayerId: prayerData.id,
        icon: prayerData.icon,
        label: prayerData.name,
      },
    });
  }
}

function handleSkillToActionBar(
  overId: string,
  activeData: Record<string, unknown> | undefined,
  world: ClientWorld | null,
): void {
  const slotMatch = overId.match(/actionbar-drop-(\d+)/);
  const slotIndex = slotMatch ? parseInt(slotMatch[1], 10) : undefined;
  const skillData = activeData?.skill as SkillData | undefined;

  if (skillData && slotIndex !== undefined && world) {
    world.emit(EventType.ACTION_BAR_SLOT_UPDATE, {
      barId: 0,
      slotIndex,
      slot: {
        type: "skill",
        id: `skill-${skillData.id}-${Date.now()}`,
        skillId: skillData.id,
        icon: skillData.icon,
        label: skillData.name,
      },
    });
  }
}
