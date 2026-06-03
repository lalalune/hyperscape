import React, { useEffect, useMemo, useState } from "react";
import {
  useDroppable,
  useDragStore,
  useThemeStore,
  useMobileLayout,
} from "@/ui";
import {
  getInteractiveTileStyle,
  getPanelInsetStyle,
  getPanelSurfaceStyle,
} from "@/ui/theme/themes";
import { useContextMenuState } from "../../hooks";
import {
  EquipmentSlotName,
  EventType,
  getItem,
  uuid,
  CONTEXT_MENU_COLORS,
} from "@hyperforge/shared";
import type { PlayerEquipmentItems, ClientWorld } from "../../types";
import {
  HelmetIcon,
  WeaponIcon,
  BodyIcon,
  ShieldIcon,
  LegsIcon,
  ArrowsIcon,
  BootsIcon,
  GlovesIcon,
  CapeIcon,
  AmuletIcon,
  RingIcon,
} from "./equipment/EquipmentIcons";
import {
  EquipmentTooltip,
  type EquipmentSlotData,
  type EquipmentHoverState,
} from "./equipment/EquipmentTooltip";
import { ItemIcon } from "../../ui/components/ItemIcon";
import { EquipmentPaperdollPortrait } from "./equipment/EquipmentPaperdollPortrait";

interface EquipmentPanelProps {
  equipment: PlayerEquipmentItems | null;
  world?: ClientWorld;
  slotActionLabel?: string;
  onSlotAction?: (slotKey: string) => void;
  footerButtons?: Array<{
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }>;
  showBonuses?: boolean;
  layoutVariant?: "default" | "bank";
  isVisible?: boolean;
}

type EquipmentSlot = EquipmentSlotData;

interface DroppableEquipmentSlotProps {
  slot: EquipmentSlot;
  slotActionLabel: string;
  onSlotClick: (slot: EquipmentSlot) => void;
  onHoverStart: (
    slot: EquipmentSlot,
    position: { x: number; y: number },
  ) => void;
  onHoverMove: (position: { x: number; y: number }) => void;
  onHoverEnd: () => void;
  onContextMenuOpen: () => void;
}

function DroppableEquipmentSlot({
  slot,
  slotActionLabel,
  onSlotClick,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
  onContextMenuOpen,
}: DroppableEquipmentSlotProps) {
  const theme = useThemeStore((s) => s.theme);
  const { shouldUseMobileUI } = useMobileLayout();
  const [isHovered, setIsHovered] = useState(false);
  const { isOver, setNodeRef } = useDroppable({
    id: `equipment-${slot.key}`,
    data: { slot: slot.key },
  });

  // Check if the currently dragged item can be equipped in this slot
  const dragItem = useDragStore((state) => state.item);
  const isDragging = useDragStore((state) => state.isDragging);

  // Determine if the dragged item is valid for this slot
  const isValidDrop = useMemo(() => {
    if (!isDragging || !dragItem?.id?.toString().startsWith("inventory-")) {
      return false; // Not dragging an inventory item
    }

    // Get item data from drag context
    const dragData = dragItem.data as { item?: { itemId: string } } | undefined;
    if (!dragData?.item?.itemId) return true; // No data, assume valid (server will validate)

    const itemData = getItem(dragData.item.itemId);
    if (!itemData) return true; // Unknown item, assume valid

    const itemEquipSlot = itemData.equipSlot;
    // Map 2h weapons to weapon slot
    const normalizedSlot = itemEquipSlot === "2h" ? "weapon" : itemEquipSlot;

    // Check if item matches this slot
    return !normalizedSlot || normalizedSlot === slot.key;
  }, [isDragging, dragItem?.id, dragItem?.data, slot.key]);

  // Is there an inventory item being dragged?
  const isDraggingInventoryItem =
    isDragging && dragItem?.id?.toString().startsWith("inventory-");

  const isEmpty = !slot.item;
  const slotTitle = slot.item
    ? `${slot.item.name} (${slot.label})`
    : `${slot.label} (empty)`;
  const invalidDrop = isOver && !isValidDrop;
  const validDrop = isOver && isValidDrop;
  const baseTileStyle = getInteractiveTileStyle(theme, {
    hovered: isHovered && !validDrop && !invalidDrop,
    dropTarget: validDrop,
    radius: 2,
    accentColor: theme.colors.accent.primary,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      data-equipment-slot={slot.key}
      data-slot-empty={isEmpty ? "true" : "false"}
      title={slotTitle}
      aria-label={
        slot.item
          ? `${slot.item.name} equipped in ${slot.label} slot`
          : `Empty ${slot.label} slot`
      }
      onClick={() => onSlotClick(slot)}
      onMouseEnter={(e) => {
        setIsHovered(true);
        onHoverStart(slot, { x: e.clientX, y: e.clientY });
      }}
      onMouseMove={(e) => {
        onHoverMove({ x: e.clientX, y: e.clientY });
      }}
      onBlur={() => setIsHovered(false)}
      onMouseLeave={() => {
        setIsHovered(false);
        onHoverEnd();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();

        // Hide hover tooltip and mark context menu as open
        onHoverEnd();
        onContextMenuOpen();

        if (!slot.item) return;

        // OSRS uses orange for item names in context menus
        const itemName = slot.item.name;

        const items = [
          {
            id: "slotAction",
            label: `${slotActionLabel} ${itemName}`,
            styledLabel: [
              { text: `${slotActionLabel} ` },
              { text: itemName, color: CONTEXT_MENU_COLORS.ITEM },
            ],
            enabled: true,
          },
          {
            id: "examine",
            label: `Examine ${itemName}`,
            styledLabel: [
              { text: "Examine " },
              { text: itemName, color: CONTEXT_MENU_COLORS.ITEM },
            ],
            enabled: true,
          },
        ];

        const evt = new CustomEvent("contextmenu", {
          detail: {
            target: {
              id: `equipment_slot_${slot.key}`,
              type: "equipment",
              name: itemName,
            },
            mousePosition: { x: e.clientX, y: e.clientY },
            items,
          },
        });
        window.dispatchEvent(evt);
      }}
      className="w-full h-full rounded-[2px] transition-all duration-150 cursor-pointer group relative overflow-hidden focus-visible:outline-none"
      style={{
        ...baseTileStyle,
        background: invalidDrop
          ? `linear-gradient(180deg, ${theme.colors.state.danger}20 0%, rgba(22, 26, 31, 0.4) 100%)`
          : validDrop
            ? baseTileStyle.background
            : isDraggingInventoryItem && isValidDrop
              ? `linear-gradient(180deg, ${theme.colors.accent.primary}14 0%, rgba(22, 26, 31, 0.4) 100%)`
              : isEmpty
                ? "linear-gradient(180deg, rgba(255,255,255,0.022) 0%, rgba(22,26,31,0.25) 100%)"
                : "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(26,30,36,0.25) 100%)",
        zIndex: 10,
        borderWidth: "1px",
        borderStyle:
          validDrop || invalidDrop
            ? "solid"
            : isDraggingInventoryItem && isValidDrop
              ? "dashed"
              : "solid",
        borderColor: invalidDrop
          ? `${theme.colors.state.danger}99`
          : validDrop
            ? theme.colors.border.hover
            : isDraggingInventoryItem && isValidDrop
              ? `${theme.colors.accent.primary}7a`
              : isEmpty
                ? `${theme.colors.border.default}55`
                : `${theme.colors.border.default}80`,
        boxShadow: invalidDrop
          ? `inset 0 0 8px ${theme.colors.state.danger}26`
          : validDrop
            ? `0 0 10px ${theme.colors.accent.primary}12, inset 0 1px 0 rgba(255,255,255,0.05)`
            : isEmpty
              ? "inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -8px 12px rgba(0,0,0,0.14)"
              : "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -10px 14px rgba(0,0,0,0.16)",
        outline: "none",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 26%, rgba(0,0,0,0.1) 100%)",
        }}
      />

      {isEmpty && (
        <div
          className="absolute inset-x-[14%] top-[14%] bottom-[14%] rounded-[2px] pointer-events-none"
          style={{
            border: `1px solid ${theme.colors.border.default}2e`,
            opacity: 0.3,
          }}
        />
      )}

      <div className="flex h-full w-full items-center justify-center">
        <div className="flex items-center justify-center">
          {isEmpty ? (
            <div
              className="transition-all duration-150 group-hover:scale-105 group-hover:opacity-40"
              style={{
                width: shouldUseMobileUI ? "20px" : "24px",
                height: shouldUseMobileUI ? "20px" : "24px",
                color: `${theme.colors.text.muted}aa`,
              }}
            >
              {slot.icon}
            </div>
          ) : (
            <div
              className="transition-transform duration-150 group-hover:scale-105"
              style={{
                width: shouldUseMobileUI ? "24px" : "28px",
                height: shouldUseMobileUI ? "24px" : "28px",
                filter: "drop-shadow(0 3px 6px rgba(0, 0, 0, 0.55))",
              }}
            >
              <ItemIcon
                itemId={slot.item!.id}
                size={shouldUseMobileUI ? 24 : 28}
              />
            </div>
          )}
        </div>
      </div>

      {!isEmpty && (
        <div
          className="absolute inset-0 rounded-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${theme.colors.accent.primary}15 0%, transparent 70%)`,
          }}
        />
      )}

      {(slot.item?.quantity ?? 1) > 1 && (
        <div
          className="absolute bottom-1.5 right-1.5 min-w-[18px] rounded-full px-1 text-center font-bold"
          style={{
            fontSize: shouldUseMobileUI ? "8px" : "9px",
            color: theme.colors.text.primary,
            background: "rgba(17, 20, 25, 0.86)",
            border: `1px solid ${theme.colors.border.hover}`,
            textShadow: "0 1px 2px rgba(0, 0, 0, 0.9)",
            lineHeight: shouldUseMobileUI ? "14px" : "15px",
          }}
        >
          {slot.item!.quantity ?? 1}
        </div>
      )}

      <div
        className="absolute inset-[2px] rounded-[2px] pointer-events-none opacity-0 group-focus-visible:opacity-100 transition-opacity duration-150"
        style={{
          border: `1px solid ${theme.colors.accent.primary}aa`,
          boxShadow: `0 0 0 1px ${theme.colors.accent.primary}22`,
        }}
      />
    </button>
  );
}

interface PaperdollSlotPlacement {
  area: string;
  key: string;
}

const PAPERDOLL_PLACEMENTS: PaperdollSlotPlacement[] = [
  { area: "ammo", key: EquipmentSlotName.ARROWS },
  { area: "cape", key: EquipmentSlotName.CAPE },
  { area: "head", key: EquipmentSlotName.HELMET },
  { area: "amulet", key: EquipmentSlotName.AMULET },
  { area: "body", key: EquipmentSlotName.BODY },
  { area: "ring", key: EquipmentSlotName.RING },
  { area: "legs", key: EquipmentSlotName.LEGS },
  { area: "gloves", key: EquipmentSlotName.GLOVES },
  { area: "boots", key: EquipmentSlotName.BOOTS },
  { area: "weapon", key: EquipmentSlotName.WEAPON },
  { area: "shield", key: EquipmentSlotName.SHIELD },
];

interface EquipmentLayoutConfig {
  slotWidth: number;
  slotHeight: number;
  centerMin?: number;
  gap: number;
  padding: number;
  portraitMode: "overlay" | "area";
  portraitPadding?: string;
  portraitOffsetX?: number;
  portraitBleedX?: number;
  templateAreas: string;
  rowCount: number;
  portraitArea?: string;
  emptyAreas?: string[];
}

function getEquipmentLayoutConfig(
  isMobile: boolean,
  variant: "default" | "bank",
): EquipmentLayoutConfig {
  if (variant === "bank") {
    return {
      slotWidth: isMobile ? 30 : 30,
      slotHeight: isMobile ? 34 : 38,
      centerMin: 0,
      gap: isMobile ? 4 : 4,
      padding: isMobile ? 4 : 4,
      portraitMode: "area",
      portraitPadding: isMobile ? "0" : "0",
      portraitOffsetX: 0,
      portraitBleedX: isMobile ? 10 : 18,
      rowCount: 5,
      portraitArea: "portrait",
      emptyAreas: ["empty"],
      templateAreas: `
        "head portrait portrait cape"
        "body portrait portrait amulet"
        "legs portrait portrait ring"
        "boots portrait portrait gloves"
        "weapon ammo shield ."
      `,
    };
  }

  return {
    slotWidth: isMobile ? 34 : 38,
    slotHeight: isMobile ? 32 : 36,
    gap: isMobile ? 5 : 8,
    padding: isMobile ? 2 : 3,
    portraitMode: "overlay",
    portraitBleedX: isMobile ? 12 : 20,
    rowCount: 5,
    templateAreas: `
      "head . . . cape"
      "body . . . amulet"
      "legs . . . ring"
      "boots . . . gloves"
      "ammo weapon . shield ."
    `,
  };
}

export const EquipmentPanel = React.memo(function EquipmentPanel({
  equipment,
  world,
  slotActionLabel = "Remove",
  onSlotAction,
  footerButtons,
  showBonuses = true,
  layoutVariant = "default",
  isVisible = true,
}: EquipmentPanelProps) {
  const theme = useThemeStore((s) => s.theme);
  const { shouldUseMobileUI } = useMobileLayout();
  // RS3-style hover tooltip state
  const [hoverState, setHoverState] = useState<EquipmentHoverState | null>(
    null,
  );

  // Track if context menu is open (suppress hover tooltips while open)
  const { isContextMenuOpen, setContextMenuOpen } = useContextMenuState();

  // Equipment slots with SVG icons for paperdoll layout
  const slots: EquipmentSlot[] = [
    {
      key: EquipmentSlotName.HELMET,
      label: "Head",
      icon: <HelmetIcon className="w-full h-full" />,
      item: equipment?.helmet || null,
    },
    {
      key: EquipmentSlotName.BODY,
      label: "Body",
      icon: <BodyIcon className="w-full h-full" />,
      item: equipment?.body || null,
    },
    {
      key: EquipmentSlotName.LEGS,
      label: "Legs",
      icon: <LegsIcon className="w-full h-full" />,
      item: equipment?.legs || null,
    },
    {
      key: EquipmentSlotName.WEAPON,
      label: "Weapon",
      icon: <WeaponIcon className="w-full h-full" />,
      item: equipment?.weapon || null,
    },
    {
      key: EquipmentSlotName.SHIELD,
      label: "Shield",
      icon: <ShieldIcon className="w-full h-full" />,
      item: equipment?.shield || null,
    },
    {
      key: EquipmentSlotName.BOOTS,
      label: "Boots",
      icon: <BootsIcon className="w-full h-full" />,
      item: equipment?.boots || null,
    },
    {
      key: EquipmentSlotName.GLOVES,
      label: "Gloves",
      icon: <GlovesIcon className="w-full h-full" />,
      item: equipment?.gloves || null,
    },
    {
      key: EquipmentSlotName.CAPE,
      label: "Cape",
      icon: <CapeIcon className="w-full h-full" />,
      item: equipment?.cape || null,
    },
    {
      key: EquipmentSlotName.AMULET,
      label: "Amulet",
      icon: <AmuletIcon className="w-full h-full" />,
      item: equipment?.amulet || null,
    },
    {
      key: EquipmentSlotName.RING,
      label: "Ring",
      icon: <RingIcon className="w-full h-full" />,
      item: equipment?.ring || null,
    },
    {
      key: EquipmentSlotName.ARROWS,
      label: "Ammo",
      icon: <ArrowsIcon className="w-full h-full" />,
      item: equipment?.arrows || null,
    },
  ];

  // Calculate total equipment bonuses for stats display
  const totalBonuses = useMemo(() => {
    let attack = 0;
    let defense = 0;
    let strength = 0;

    slots.forEach((slot) => {
      if (slot.item?.bonuses) {
        attack += slot.item.bonuses.attack || 0;
        defense += slot.item.bonuses.defense || 0;
        strength += slot.item.bonuses.strength || 0;
      }
    });

    return { attack, defense, strength };
  }, [equipment]);

  // Utility button handlers
  const handleOpenStats = () => {
    // Open the character stats panel via UI event
    if (world) {
      world.emit(EventType.UI_OPEN_PANE, { pane: "stats" });
    }
  };

  const handleOpenDeath = () => {
    // Open the items kept on death panel via UI event
    if (world) {
      world.emit(EventType.UI_OPEN_PANE, { pane: "death" });
    }
  };

  // Send unequip request to server for a given slot key
  const sendUnequip = (slotKey: string) => {
    const localPlayer = world?.getPlayer();
    if (localPlayer && world?.network?.send) {
      world.network.send("unequipItem", {
        playerId: localPlayer.id,
        slot: slotKey,
      });
    }
  };

  // RS3-style: Click immediately unequips
  const handleSlotClick = (slot: EquipmentSlot) => {
    if (!slot.item) return;
    if (onSlotAction) {
      onSlotAction(slot.key);
      return;
    }
    sendUnequip(slot.key);
  };

  // Hover handlers for tooltip
  const handleHoverStart = (
    slot: EquipmentSlot,
    position: { x: number; y: number },
  ) => {
    // Don't show hover tooltip if context menu is open
    if (isContextMenuOpen) return;
    setHoverState({ slot, position });
  };

  const handleHoverMove = (position: { x: number; y: number }) => {
    // Don't update hover tooltip if context menu is open
    if (isContextMenuOpen) return;
    setHoverState((prev) => (prev ? { ...prev, position } : null));
  };

  const handleHoverEnd = () => {
    setHoverState(null);
  };

  const handleContextMenuOpen = () => {
    setContextMenuOpen(true);
  };

  useEffect(() => {
    const onCtxSelect = (evt: Event) => {
      const ce = evt as CustomEvent<{
        actionId: string;
        targetId: string;
        position?: { x: number; y: number };
      }>;
      const target = ce.detail?.targetId || "";
      if (!target.startsWith("equipment_slot_")) return;

      const slotKey = target.replace("equipment_slot_", "");
      const slot = slots.find((s) => s.key === slotKey);

      if (!slot || !slot.item) return;

      if (ce.detail.actionId === "slotAction") {
        if (onSlotAction) {
          onSlotAction(slotKey);
        } else {
          sendUnequip(slotKey);
        }
      }

      if (ce.detail.actionId === "examine") {
        const itemData = getItem(slot.item.id);
        const examineText = itemData?.examine || `It's a ${slot.item.name}.`;
        world?.emit(EventType.UI_TOAST, {
          message: examineText,
          type: "info",
          position: ce.detail.position,
        });
        // Also add to chat (OSRS-style game message)
        if (world?.chat?.add) {
          world.chat.add({
            id: uuid(),
            from: "",
            body: examineText,
            createdAt: new Date().toISOString(),
            timestamp: Date.now(),
          });
        }
      }
    };
    window.addEventListener("contextmenu:select", onCtxSelect as EventListener);
    return () =>
      window.removeEventListener(
        "contextmenu:select",
        onCtxSelect as EventListener,
      );
  }, [onSlotAction, slots, world]);

  // Helper to find slot by key
  const getSlot = (key: string) => slots.find((s) => s.key === key) || null;

  const equipmentSignature = useMemo(
    () =>
      slots
        .map((slot) =>
          slot.item
            ? `${slot.key}:${slot.item.id}:${slot.item.quantity ?? 1}`
            : `${slot.key}:empty`,
        )
        .join("|"),
    [slots],
  );

  const renderSlotCell = (
    slotName: string,
    isMobile: boolean,
    slotSize: number,
    area?: string,
  ) => (
    <div
      key={slotName}
      className={isMobile ? undefined : "w-full h-full"}
      style={{
        gridArea: area,
        height: isMobile ? slotSize : undefined,
        containerType: "size",
      }}
    >
      <DroppableEquipmentSlot
        slot={getSlot(slotName)!}
        slotActionLabel={slotActionLabel}
        onSlotClick={handleSlotClick}
        onHoverStart={handleHoverStart}
        onHoverMove={handleHoverMove}
        onHoverEnd={handleHoverEnd}
        onContextMenuOpen={handleContextMenuOpen}
      />
    </div>
  );

  const renderEquipmentGrid = (isMobile: boolean) => {
    const layout = getEquipmentLayoutConfig(isMobile, layoutVariant);

    return (
      <div
        data-equipment-grid="paperdoll"
        className="grid h-full w-full"
        style={{
          gridTemplateColumns:
            layout.portraitMode === "overlay"
              ? `${layout.slotWidth}px ${layout.slotWidth}px 1fr ${layout.slotWidth}px ${layout.slotWidth}px`
              : `${layout.slotWidth}px minmax(${layout.centerMin}px, 1fr) minmax(${layout.centerMin}px, 1fr) ${layout.slotWidth}px`,
          gridTemplateRows: `repeat(${layout.rowCount}, ${layout.slotHeight}px)`,
          gridTemplateAreas: layout.templateAreas,
          gap: layout.gap,
          padding: layout.padding,
          alignItems: "stretch",
          justifyItems: "stretch",
        }}
      >
        <div
          data-equipment-center="portrait"
          style={{
            gridArea:
              layout.portraitMode === "area" ? layout.portraitArea : undefined,
            gridColumn:
              layout.portraitMode === "overlay" ? "1 / -1" : undefined,
            gridRow: layout.portraitMode === "overlay" ? "1 / -1" : undefined,
            minWidth: 0,
            minHeight:
              layout.portraitMode === "overlay"
                ? layout.slotHeight * layout.rowCount +
                  layout.gap * (layout.rowCount - 1)
                : layout.slotHeight * (layout.rowCount - 1) + layout.gap * 4,
            zIndex: 0,
            width: layout.portraitBleedX
              ? `calc(100% + ${layout.portraitBleedX * 2}px)`
              : "100%",
            height: "100%",
            padding: layout.portraitPadding,
            marginLeft: layout.portraitBleedX
              ? `-${layout.portraitBleedX}px`
              : 0,
            marginRight: layout.portraitBleedX
              ? `-${layout.portraitBleedX}px`
              : 0,
            overflow: "visible",
            transform:
              layout.portraitMode === "area" && layout.portraitOffsetX
                ? `translateX(${layout.portraitOffsetX}px)`
                : undefined,
          }}
        >
          <EquipmentPaperdollPortrait
            world={world}
            equipment={equipment}
            equipmentSignature={equipmentSignature}
            compact={isMobile || layoutVariant === "bank"}
            layoutVariant={layoutVariant}
            isVisible={isVisible}
            className="h-full w-full"
          />
        </div>

        {PAPERDOLL_PLACEMENTS.map((placement) =>
          renderSlotCell(
            placement.key,
            isMobile,
            layout.slotHeight,
            placement.area,
          ),
        )}

        {layout.emptyAreas?.map((area) => (
          <div key={area} style={{ gridArea: area }} />
        ))}
      </div>
    );
  };

  const resolvedFooterButtons = footerButtons ?? [
    {
      label: "Stats",
      onClick: handleOpenStats,
    },
    {
      label: "On Death",
      onClick: handleOpenDeath,
    },
  ];

  return (
    <>
      <div
        className="flex flex-col h-full overflow-hidden"
        style={{
          ...getPanelSurfaceStyle(theme, { emphasis: "normal" }),
          padding:
            layoutVariant === "bank"
              ? shouldUseMobileUI
                ? "2px"
                : "0"
              : shouldUseMobileUI
                ? "3px"
                : "4px",
          gap:
            layoutVariant === "bank"
              ? shouldUseMobileUI
                ? "4px"
                : "8px"
              : shouldUseMobileUI
                ? "3px"
                : "4px",
          border: "none",
          borderRadius: 0,
          boxShadow: "none",
        }}
      >
        <div
          className="flex-1 relative"
          style={{
            ...getPanelInsetStyle(theme, {
              emphasis: "strong",
              radius: 4,
            }),
            padding:
              layoutVariant === "bank"
                ? shouldUseMobileUI
                  ? "4px"
                  : "8px"
                : shouldUseMobileUI
                  ? 0
                  : "3px",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -18px 26px rgba(0,0,0,0.18)",
            display: "flex",
            alignItems: "stretch",
            justifyContent: "stretch",
            overflow: "visible",
          }}
        >
          {renderEquipmentGrid(shouldUseMobileUI)}
        </div>

        {resolvedFooterButtons.length > 0 && (
          <div
            className="grid gap-1.5 px-0.5"
            style={{
              gridTemplateColumns: `repeat(${resolvedFooterButtons.length}, minmax(0, 1fr))`,
              minHeight: shouldUseMobileUI ? 24 : 28,
            }}
          >
            {resolvedFooterButtons.map((button) => (
              <button
                key={button.label}
                type="button"
                onClick={button.onClick}
                disabled={button.disabled}
                className="flex items-center justify-center transition-all duration-150 hover:scale-[1.02] active:scale-95 focus-visible:outline-none disabled:opacity-40"
                style={{
                  height: shouldUseMobileUI ? 24 : 28,
                  ...getInteractiveTileStyle(theme, { radius: 2 }),
                  fontSize: shouldUseMobileUI ? "9px" : "10px",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  color: theme.colors.accent.primary,
                  textTransform: "uppercase",
                }}
              >
                {button.label}
              </button>
            ))}
          </div>
        )}

        {showBonuses && (
          <div
            className="flex justify-center gap-3"
            style={{
              ...getPanelInsetStyle(theme, {
                emphasis: "normal",
                radius: 4,
              }),
              padding: shouldUseMobileUI ? "2px 6px" : "4px 8px",
              fontSize: shouldUseMobileUI ? "8px" : "10px",
              lineHeight: 1,
            }}
          >
            <span style={{ color: theme.colors.status.hp }}>
              {totalBonuses.attack}
            </span>
            <span style={{ color: theme.colors.status.energy }}>
              {totalBonuses.defense}
            </span>
            <span style={{ color: theme.colors.status.prayer }}>
              {totalBonuses.strength}
            </span>
          </div>
        )}
      </div>

      {/* Enhanced hover tooltip - rendered via portal */}
      <EquipmentTooltip hoverState={hoverState} />
    </>
  );
});
