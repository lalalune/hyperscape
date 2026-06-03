/**
 * Interface Modals
 *
 * Modal panel components for InterfaceManager including:
 * - FullscreenWorldMap
 * - ItemsKeptOnDeathPanel
 * - All modal panel rendering logic
 *
 * @packageDocumentation
 */

import React, { memo, useCallback, useMemo } from "react";
import { EventType, getItem } from "@hyperforge/shared";
import type { PlayerStats, PlayerID, StakedItem } from "@hyperforge/shared";
import { ModalWindow, useThemeStore } from "@/ui";
import { UI } from "@/ui/core";
import {
  getPanelHeaderStyle,
  getPanelSurfaceStyle,
  getShellControlButtonStyle,
} from "@/ui/theme/themes";
import type { ClientWorld, PlayerEquipmentItems } from "../../types";
import type { InventorySlotViewItem } from "../types";
import type {
  BankData,
  StoreData,
  DialogueData,
  SmeltingData,
  SmithingData,
  CraftingData,
  FletchingData,
  TanningData,
  LootWindowData,
  QuestStartData,
  QuestCompleteData,
  XpLampData,
  DuelData,
  DuelResultData,
  TradeData,
} from "@/hooks";
import { BankPanel } from "../panels/BankPanel";
import { StorePanel } from "../panels/StorePanel";
import { DialoguePanel } from "../panels/DialoguePanel";
import { DialoguePopupShell } from "../panels/dialogue/DialoguePopupShell";
import { SmeltingPanel } from "../panels/SmeltingPanel";
import { SmithingPanel } from "../panels/SmithingPanel";
import { CraftingPanel } from "../panels/CraftingPanel";
import { FletchingPanel } from "../panels/FletchingPanel";
import { TanningPanel } from "../panels/TanningPanel";
import { StatsPanel } from "../panels/StatsPanel";
import { LootWindowPanel } from "../panels/LootWindowPanel";
import { QuestStartPanel } from "../panels/QuestStartPanel";
import { QuestCompletePanel } from "../panels/QuestCompletePanel";
import { XpLampPanel } from "../panels/XpLampPanel";
import { DuelPanel } from "../panels/DuelPanel";
import { DuelResultModal } from "../panels/DuelPanel/DuelResultModal";
import { TradePanel } from "../panels/TradePanel";
import { Minimap } from "../hud/Minimap";
import { MinimapOverlayControls } from "../hud/MinimapOverlayControls";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => {
    if (element.hasAttribute("disabled")) {
      return false;
    }
    if (element.getAttribute("aria-hidden") === "true") {
      return false;
    }
    return element.offsetParent !== null;
  });
}

/**
 * FullscreenWorldMap - RuneScape-style fullscreen world map overlay
 *
 * Features:
 * - Takes up entire screen with dark backdrop
 * - ESC key closes it (handled via useEffect)
 * - M key also toggles it
 * - Close button in top-right corner
 * - Player position display
 * - Zoom controls and legend
 */
export function FullscreenWorldMap({
  world,
  onClose,
}: {
  world: ClientWorld;
  onClose: () => void;
}): React.ReactElement {
  const theme = useThemeStore((s) => s.theme);
  const closeButtonStyle = getShellControlButtonStyle(theme, "danger");
  const modalRef = React.useRef<HTMLDivElement>(null);
  const previousActiveElementRef = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();

  // Get player position for header display
  const player = world?.getPlayer?.();
  const playerPos = player?.position || { x: 0, y: 0, z: 0 };

  // Calculate map dimensions based on viewport
  const [mapDimensions, setMapDimensions] = React.useState({
    width: Math.min(window.innerWidth - 80, 1400),
    height: Math.min(window.innerHeight - 120, 900),
  });

  // Handle ESC key to close
  React.useEffect(() => {
    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const container = modalRef.current;
    if (!container) {
      return;
    }

    const focusableElements = getFocusableElements(container);
    const initialFocusTarget = focusableElements[0] ?? container;
    initialFocusTarget.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== "Tab") {
        return;
      }

      const liveContainer = modalRef.current;
      if (!liveContainer) {
        return;
      }

      const liveFocusableElements = getFocusableElements(liveContainer);
      if (liveFocusableElements.length === 0) {
        e.preventDefault();
        liveContainer.focus();
        return;
      }

      const firstElement = liveFocusableElements[0];
      const lastElement =
        liveFocusableElements[liveFocusableElements.length - 1];
      const activeElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      if (!activeElement || !liveContainer.contains(activeElement)) {
        e.preventDefault();
        firstElement.focus();
        return;
      }

      if (e.shiftKey && activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      const previousActiveElement = previousActiveElementRef.current;
      if (previousActiveElement?.isConnected) {
        previousActiveElement.focus();
      }
    };
  }, [onClose]);

  // Update map dimensions on window resize
  React.useEffect(() => {
    const handleResize = () => {
      setMapDimensions({
        width: Math.min(window.innerWidth - 80, 1400),
        height: Math.min(window.innerHeight - 120, 900),
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-modal="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: UI.Z_INDEX.MODAL,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        pointerEvents: "auto",
        animation: "worldMapFadeIn 0.2s ease-out",
      }}
      onMouseDown={(e) => {
        (e.nativeEvent as PointerEvent & { isCoreUI?: boolean }).isCoreUI =
          true;
      }}
      onPointerDown={(e) => {
        (e.nativeEvent as PointerEvent & { isCoreUI?: boolean }).isCoreUI =
          true;
      }}
      onClick={(e) => {
        // Close when clicking backdrop (not the map)
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* Animation keyframes */}
      <style>
        {`
          @keyframes worldMapFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes worldMapSlideIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
        `}
      </style>

      {/* Map Container */}
      <div
        ref={modalRef}
        tabIndex={-1}
        style={{
          display: "flex",
          flexDirection: "column",
          ...getPanelSurfaceStyle(theme, { emphasis: "strong" }),
          borderRadius: theme.borderRadius.xl,
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8)",
          overflow: "hidden",
          animation: "worldMapSlideIn 0.2s ease-out",
          maxWidth: "calc(100vw - 40px)",
          maxHeight: "calc(100vh - 40px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            ...getPanelHeaderStyle(theme),
            padding: "12px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span
              id={titleId}
              style={{
                color: theme.colors.text.primary,
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.semibold,
              }}
            >
              World Map
            </span>
            <span
              style={{
                color: theme.colors.text.secondary,
                fontSize: theme.typography.fontSize.sm,
              }}
            >
              World of Hyperia
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <span
              style={{
                color: theme.colors.accent.primary,
                fontSize: theme.typography.fontSize.sm,
                fontFamily: theme.typography.fontFamily.mono,
              }}
            >
              ({Math.round(playerPos.x)}, {Math.round(playerPos.z)})
            </span>

            {/* Close button */}
            <button
              onClick={onClose}
              style={{
                ...closeButtonStyle,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                fontSize: 18,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = String(
                  closeButtonStyle["--shell-button-hover-bg"],
                );
                e.currentTarget.style.color = String(
                  closeButtonStyle["--shell-button-hover-fg"],
                );
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = String(
                  closeButtonStyle.background,
                );
                e.currentTarget.style.color = String(closeButtonStyle.color);
              }}
              aria-label="Close map (ESC)"
              title="Close (ESC)"
            >
              X
            </button>
          </div>
        </div>

        {/* Map area - using Minimap with full size */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            background:
              theme.name === "hyperia"
                ? "linear-gradient(180deg, rgba(255, 255, 255, 0.015) 0%, rgba(0, 0, 0, 0.14) 100%)"
                : "transparent",
            overflow: "visible",
          }}
        >
          <div
            style={{
              position: "relative",
              width: mapDimensions.width,
              height: mapDimensions.height,
              overflow: "visible",
            }}
          >
            <Minimap
              world={world}
              width={mapDimensions.width}
              height={mapDimensions.height}
              zoom={20}
              embedded={true}
              resizable={false}
              isVisible={true}
            />
            <MinimapOverlayControls
              world={world}
              width={mapDimensions.width}
              height={mapDimensions.height}
            />
          </div>
        </div>

        {/* Footer with legend and controls hint */}
        <div
          style={{
            ...getPanelHeaderStyle(theme),
            padding: "10px 20px",
            borderBottom: "none",
            borderTop: `1px solid ${theme.colors.border.default}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {/* Legend */}
          <div
            style={{
              display: "flex",
              gap: 20,
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.secondary,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  background: "#00ff00",
                  borderRadius: "50%",
                  border: "1px solid white",
                }}
              />
              You
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  background: "#ff4444",
                  borderRadius: "50%",
                  border: "1px solid white",
                }}
              />
              Enemies
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  background: "#22cc55",
                  borderRadius: "50%",
                  border: "1px solid white",
                }}
              />
              Resources
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  background: "#3b82f6",
                  borderRadius: "50%",
                  border: "1px solid white",
                }}
              />
              NPCs
            </span>
          </div>

          {/* Controls hint */}
          <div
            style={{
              display: "flex",
              gap: 16,
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.muted,
            }}
          >
            <span>Drag to pan</span>
            <span>Scroll to zoom</span>
            <span>Click to move</span>
            <span
              style={{
                padding: "2px 8px",
                background:
                  theme.name === "hyperia"
                    ? "rgba(255, 255, 255, 0.06)"
                    : theme.colors.background.tertiary,
                borderRadius: theme.borderRadius.sm,
                color: theme.colors.text.secondary,
                border: `1px solid ${theme.colors.border.default}40`,
              }}
            >
              ESC or M to close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ItemsKeptOnDeathPanel - Shows which items will be kept/lost on death
 */
export function ItemsKeptOnDeathPanel({
  world,
  equipment,
  onClose: _onClose,
}: {
  world: ClientWorld;
  equipment: PlayerEquipmentItems | null;
  onClose: () => void;
}): React.ReactElement {
  const theme = useThemeStore((s) => s.theme);
  // Get inventory items from network cache
  const playerId = world?.entities?.player?.id;
  const cachedInventory = playerId
    ? world?.network?.lastInventoryByPlayerId?.[playerId]
    : null;
  const inventoryItems = cachedInventory?.items || [];

  // Calculate most valuable items (3 kept on death by default)
  const allItems: Array<{ name: string; value: number; source: string }> = [];

  // Add inventory items
  inventoryItems.forEach(
    (item: { itemId: string; quantity: number; slot: number }) => {
      const itemData = getItem(item.itemId);
      if (itemData) {
        allItems.push({
          name: itemData.name,
          value: (itemData.value || 0) * (item.quantity || 1),
          source: "Inventory",
        });
      }
    },
  );

  // Add equipment items
  if (equipment) {
    const slots = [
      "helmet",
      "body",
      "legs",
      "weapon",
      "shield",
      "boots",
      "gloves",
      "cape",
      "amulet",
      "ring",
    ] as const;
    slots.forEach((slot) => {
      const item = equipment[slot];
      if (item) {
        const itemData = getItem(item.id);
        allItems.push({
          name: item.name || itemData?.name || slot,
          value: itemData?.value || 0,
          source: "Equipment",
        });
      }
    });
  }

  // Sort by value descending
  allItems.sort((a, b) => b.value - a.value);

  // First 3 are kept, rest are lost
  const keptItems = allItems.slice(0, 3);
  const lostItems = allItems.slice(3);

  return (
    <div
      data-modal="true"
      style={{
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        color: theme.colors.text.secondary,
        fontSize: 13,
      }}
    >
      {/* Info header */}
      <div
        style={{
          ...getPanelSurfaceStyle(theme, { emphasis: "normal" }),
          borderRadius: theme.borderRadius.md,
          padding: "12px",
        }}
      >
        <div
          style={{
            color: theme.colors.text.primary,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          Standard Death Mechanics
        </div>
        <div
          style={{
            fontSize: 11,
            opacity: 0.8,
            lineHeight: 1.4,
            color: theme.colors.text.secondary,
          }}
        >
          On death, you will keep your <strong>3 most valuable</strong> items.
          All other items will remain on your gravestone for 15 minutes.
        </div>
      </div>

      {/* Items kept section */}
      <div>
        <div
          style={{
            color: theme.colors.state.success,
            fontWeight: 600,
            marginBottom: 8,
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Items Kept ({keptItems.length})
        </div>
        {keptItems.length === 0 ? (
          <div style={{ opacity: 0.5, fontSize: 12 }}>No items to keep</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {keptItems.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 10px",
                  background: `${theme.colors.state.success}14`,
                  borderRadius: theme.borderRadius.sm,
                  border: `1px solid ${theme.colors.state.success}40`,
                }}
              >
                <span style={{ color: theme.colors.text.primary }}>
                  {item.name}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    opacity: 0.7,
                    color: theme.colors.text.secondary,
                  }}
                >
                  {item.value.toLocaleString()} gp
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Items lost section */}
      <div>
        <div
          style={{
            color: theme.colors.state.danger,
            fontWeight: 600,
            marginBottom: 8,
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Items Lost ({lostItems.length})
        </div>
        {lostItems.length === 0 ? (
          <div style={{ opacity: 0.5, fontSize: 12 }}>
            No items will be lost
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              maxHeight: 200,
              overflowY: "auto",
            }}
          >
            {lostItems.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 10px",
                  background: `${theme.colors.state.danger}14`,
                  borderRadius: theme.borderRadius.sm,
                  border: `1px solid ${theme.colors.state.danger}40`,
                }}
              >
                <span style={{ color: theme.colors.text.primary }}>
                  {item.name}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    opacity: 0.7,
                    color: theme.colors.text.secondary,
                  }}
                >
                  {item.value.toLocaleString()} gp
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Total value footer */}
      <div
        style={{
          borderTop: `1px solid ${theme.colors.border.default}40`,
          paddingTop: 12,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
        }}
      >
        <span style={{ opacity: 0.7, color: theme.colors.text.secondary }}>
          Total Risked Value:
        </span>
        <span style={{ color: theme.colors.state.danger, fontWeight: 600 }}>
          {lostItems
            .reduce((sum, item) => sum + item.value, 0)
            .toLocaleString()}{" "}
          gp
        </span>
      </div>
    </div>
  );
}

/** Props for InterfaceModalsRenderer */
export interface InterfaceModalsRendererProps {
  world: ClientWorld;
  inventory: InventorySlotViewItem[];
  equipment: PlayerEquipmentItems | null;
  coins: number;
  playerStats: PlayerStats | null;

  // Modal data
  lootWindowData: LootWindowData | null;
  bankData: BankData | null;
  storeData: StoreData | null;
  dialogueData: DialogueData | null;
  smeltingData: SmeltingData | null;
  smithingData: SmithingData | null;
  craftingData: CraftingData | null;
  fletchingData: FletchingData | null;
  tanningData: TanningData | null;
  questStartData: QuestStartData | null;
  questCompleteData: QuestCompleteData | null;
  xpLampData: XpLampData | null;
  duelData: DuelData | null;
  duelResultData: DuelResultData | null;
  tradeData: TradeData | null;

  // Simple modal states
  worldMapOpen: boolean;
  statsModalOpen: boolean;
  deathModalOpen: boolean;

  // Setters
  setLootWindowData: React.Dispatch<
    React.SetStateAction<LootWindowData | null>
  >;
  setBankData: React.Dispatch<React.SetStateAction<BankData | null>>;
  setStoreData: React.Dispatch<React.SetStateAction<StoreData | null>>;
  setDialogueData: React.Dispatch<React.SetStateAction<DialogueData | null>>;
  setSmeltingData: React.Dispatch<React.SetStateAction<SmeltingData | null>>;
  setSmithingData: React.Dispatch<React.SetStateAction<SmithingData | null>>;
  setCraftingData: React.Dispatch<React.SetStateAction<CraftingData | null>>;
  setFletchingData: React.Dispatch<React.SetStateAction<FletchingData | null>>;
  setTanningData: React.Dispatch<React.SetStateAction<TanningData | null>>;
  setQuestStartData: React.Dispatch<
    React.SetStateAction<QuestStartData | null>
  >;
  setQuestCompleteData: React.Dispatch<
    React.SetStateAction<QuestCompleteData | null>
  >;
  setXpLampData: React.Dispatch<React.SetStateAction<XpLampData | null>>;
  setDuelData: React.Dispatch<React.SetStateAction<DuelData | null>>;
  setDuelResultData: React.Dispatch<
    React.SetStateAction<DuelResultData | null>
  >;
  setTradeData: React.Dispatch<React.SetStateAction<TradeData | null>>;
  setWorldMapOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setStatsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDeathModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * InterfaceModalsRenderer - Renders all modal panels
 *
 * This component renders all modal panels based on their visibility state.
 * It is extracted from InterfaceManager to reduce file size.
 */
export const InterfaceModalsRenderer = memo(function InterfaceModalsRenderer({
  world,
  inventory,
  equipment,
  coins,
  playerStats,
  lootWindowData,
  bankData,
  storeData,
  dialogueData,
  smeltingData,
  smithingData,
  craftingData,
  fletchingData,
  tanningData,
  questStartData,
  questCompleteData,
  xpLampData,
  duelData,
  duelResultData,
  tradeData,
  worldMapOpen,
  statsModalOpen,
  deathModalOpen,
  setLootWindowData,
  setBankData,
  setStoreData,
  setDialogueData,
  setSmeltingData,
  setSmithingData,
  setCraftingData,
  setFletchingData,
  setTanningData,
  setQuestStartData,
  setQuestCompleteData,
  setXpLampData,
  setDuelData,
  setDuelResultData,
  setTradeData,
  setWorldMapOpen,
  setStatsModalOpen,
  setDeathModalOpen,
}: InterfaceModalsRendererProps): React.ReactElement {
  const closeDialogue = useCallback(() => {
    if (!dialogueData) {
      return;
    }

    setDialogueData(null);
    world?.network?.send?.("dialogueEnd", {
      npcId: dialogueData.npcId,
    });
  }, [dialogueData, setDialogueData, world]);

  const myStakeValue = useMemo(
    () => duelData?.myStakes.reduce((sum, s) => sum + s.value, 0) ?? 0,
    [duelData?.myStakes],
  );
  const opponentStakeValue = useMemo(
    () => duelData?.opponentStakes.reduce((sum, s) => sum + s.value, 0) ?? 0,
    [duelData?.opponentStakes],
  );
  const compactInventory = useMemo(
    () =>
      inventory.map((item) => ({
        slot: item.slot,
        itemId: item.itemId,
        quantity: item.quantity,
      })),
    [inventory],
  );

  return (
    <>
      {/* Loot Window */}
      {lootWindowData && (
        <LootWindowPanel
          visible={lootWindowData.visible}
          corpseId={lootWindowData.corpseId}
          corpseName={lootWindowData.corpseName}
          lootItems={lootWindowData.lootItems}
          onClose={() => setLootWindowData(null)}
          world={world}
        />
      )}

      {/* Bank Panel */}
      {bankData?.visible && (
        <ModalWindow
          visible={true}
          onClose={() => {
            setBankData(null);
            world?.network?.send?.("bankClose", {});
          }}
          title="Bank"
          width={900}
          maxWidth="95vw"
        >
          <BankPanel
            items={bankData.items}
            tabs={bankData.tabs}
            alwaysSetPlaceholder={bankData.alwaysSetPlaceholder}
            maxSlots={bankData.maxSlots}
            world={world}
            inventory={inventory}
            equipment={equipment}
            coins={coins}
            onClose={() => {
              setBankData(null);
              world?.network?.send?.("bankClose", {});
            }}
          />
        </ModalWindow>
      )}

      {/* Store Panel */}
      {storeData?.visible && (
        <ModalWindow
          visible={true}
          onClose={() => {
            setStoreData(null);
            world?.network?.send?.("storeClose", {
              storeId: storeData.storeId,
            });
          }}
          title={storeData.storeName}
          width={800}
        >
          <StorePanel
            storeId={storeData.storeId}
            storeName={storeData.storeName}
            buybackRate={storeData.buybackRate}
            items={storeData.items}
            world={world}
            inventory={inventory}
            coins={coins}
            npcEntityId={storeData.npcEntityId}
            onClose={() => {
              setStoreData(null);
              world?.network?.send?.("storeClose", {
                storeId: storeData.storeId,
              });
            }}
          />
        </ModalWindow>
      )}

      {/* Dialogue Panel */}
      {dialogueData?.visible && (
        <DialoguePopupShell
          visible={true}
          onClose={closeDialogue}
          title={dialogueData.npcName}
          width={700}
          maxWidth="min(86vw, 700px)"
          maxHeight="min(40vh, 400px)"
          contentStyle={{
            overflow: "hidden",
          }}
        >
          <DialoguePanel
            visible={dialogueData.visible}
            npcName={dialogueData.npcName}
            npcId={dialogueData.npcId}
            text={dialogueData.text}
            responses={dialogueData.responses}
            npcEntityId={dialogueData.npcEntityId}
            world={world}
            onSelectResponse={(_index, response) => {
              if (!response.nextNodeId) {
                setDialogueData(null);
              }
            }}
          />
        </DialoguePopupShell>
      )}

      {/* Smelting Panel */}
      {smeltingData?.visible && (
        <ModalWindow
          visible={true}
          onClose={() => setSmeltingData(null)}
          title="Smelting"
          width={600}
        >
          <SmeltingPanel
            furnaceId={smeltingData.furnaceId}
            availableBars={smeltingData.availableBars}
            world={world}
            onClose={() => setSmeltingData(null)}
          />
        </ModalWindow>
      )}

      {/* Smithing Panel */}
      {smithingData?.visible && (
        <ModalWindow
          visible={true}
          onClose={() => setSmithingData(null)}
          title="Smithing"
          width={700}
        >
          <SmithingPanel
            anvilId={smithingData.anvilId}
            availableRecipes={smithingData.availableRecipes}
            world={world}
            onClose={() => setSmithingData(null)}
          />
        </ModalWindow>
      )}

      {/* Crafting Panel */}
      {craftingData?.visible && (
        <ModalWindow
          visible={true}
          onClose={() => setCraftingData(null)}
          title="Crafting"
          width={480}
        >
          <CraftingPanel
            availableRecipes={craftingData.availableRecipes}
            world={world}
            onClose={() => setCraftingData(null)}
          />
        </ModalWindow>
      )}

      {/* Fletching Panel */}
      {fletchingData?.visible && (
        <ModalWindow
          visible={true}
          onClose={() => setFletchingData(null)}
          title="Fletching"
          width={480}
        >
          <FletchingPanel
            availableRecipes={fletchingData.availableRecipes}
            world={world}
            onClose={() => setFletchingData(null)}
          />
        </ModalWindow>
      )}

      {/* Tanning Panel */}
      {tanningData?.visible && (
        <ModalWindow
          visible={true}
          onClose={() => setTanningData(null)}
          title="Tanning"
          width={600}
        >
          <TanningPanel
            availableRecipes={tanningData.availableRecipes}
            world={world}
            onClose={() => setTanningData(null)}
          />
        </ModalWindow>
      )}

      {/* World Map - Fullscreen Overlay (RuneScape-style) */}
      {worldMapOpen && (
        <FullscreenWorldMap
          world={world}
          onClose={() => setWorldMapOpen(false)}
        />
      )}

      {/* Stats Modal */}
      {statsModalOpen && (
        <ModalWindow
          visible={true}
          onClose={() => setStatsModalOpen(false)}
          title="Equipment Stats"
          width={520}
          maxWidth="95vw"
        >
          <StatsPanel
            stats={playerStats}
            equipment={equipment}
            showSilhouette={true}
          />
        </ModalWindow>
      )}

      {/* Items Kept on Death Modal */}
      {deathModalOpen && (
        <ModalWindow
          visible={true}
          onClose={() => setDeathModalOpen(false)}
          title="Items Kept on Death"
          width={400}
          maxWidth="95vw"
        >
          <ItemsKeptOnDeathPanel
            world={world}
            equipment={equipment}
            onClose={() => setDeathModalOpen(false)}
          />
        </ModalWindow>
      )}

      {/* Quest Start Panel */}
      {questStartData?.visible && (
        <QuestStartPanel
          visible={true}
          questId={questStartData.questId}
          questName={questStartData.questName}
          description={questStartData.description}
          difficulty={questStartData.difficulty}
          requirements={questStartData.requirements}
          rewards={questStartData.rewards}
          onAccept={() => {
            // Send quest accept to server (must go over network, not local event)
            if (world.network?.send) {
              world.network.send("questAccept", {
                questId: questStartData.questId,
              });
            }
            setQuestStartData(null);
          }}
          onDecline={() => {
            const localPlayer = world.getPlayer?.();
            if (localPlayer) {
              world.emit(EventType.QUEST_START_DECLINED, {
                playerId: localPlayer.id,
                questId: questStartData.questId,
              });
            }
            setQuestStartData(null);
          }}
        />
      )}

      {/* Quest Complete Panel */}
      {questCompleteData?.visible && (
        <QuestCompletePanel
          visible={true}
          questName={questCompleteData.questName}
          rewards={questCompleteData.rewards}
          world={world}
          onClose={() => setQuestCompleteData(null)}
        />
      )}

      {/* XP Lamp Panel */}
      {xpLampData?.visible && (
        <XpLampPanel
          visible={true}
          world={world}
          stats={playerStats}
          xpAmount={xpLampData.xpAmount}
          itemId={xpLampData.itemId}
          slot={xpLampData.slot}
          onClose={() => setXpLampData(null)}
        />
      )}

      {/* Duel Panel */}
      {duelData?.visible && (
        <DuelPanel
          state={{
            visible: true,
            duelId: duelData.duelId,
            screenState: duelData.screenState,
            opponentId: duelData.opponentId,
            opponentName: duelData.opponentName,
            isChallenger: duelData.isChallenger,
            rules: duelData.rules,
            equipmentRestrictions: duelData.equipmentRestrictions,
            myAccepted: duelData.myAccepted,
            opponentAccepted: duelData.opponentAccepted,
            myStakes: duelData.myStakes as StakedItem[],
            opponentStakes: duelData.opponentStakes as StakedItem[],
            myStakeValue,
            opponentStakeValue,
            opponentModifiedStakes: duelData.opponentModifiedStakes,
          }}
          inventory={compactInventory}
          onToggleRule={(rule) => {
            world?.network?.send?.("duel:toggle:rule", {
              duelId: duelData.duelId,
              rule,
            });
          }}
          onToggleEquipment={(slot) => {
            world?.network?.send?.("duel:toggle:equipment", {
              duelId: duelData.duelId,
              slot,
            });
          }}
          onAcceptRules={() => {
            world?.network?.send?.("duel:accept:rules", {
              duelId: duelData.duelId,
            });
          }}
          onAddStake={(inventorySlot, quantity) => {
            world?.network?.send?.("duel:add:stake", {
              duelId: duelData.duelId,
              inventorySlot,
              quantity,
            });
          }}
          onRemoveStake={(stakeIndex) => {
            world?.network?.send?.("duel:remove:stake", {
              duelId: duelData.duelId,
              stakeIndex,
            });
          }}
          onAcceptStakes={() => {
            world?.network?.send?.("duel:accept:stakes", {
              duelId: duelData.duelId,
            });
          }}
          onAcceptFinal={() => {
            world?.network?.send?.("duel:accept:final", {
              duelId: duelData.duelId,
            });
          }}
          onCancel={() => {
            setDuelData(null);
            world?.network?.send?.("duel:cancel", {
              duelId: duelData.duelId,
            });
          }}
        />
      )}

      {/* Trade Panel */}
      {tradeData?.visible && (
        <TradePanel
          state={{
            isOpen: true,
            tradeId: tradeData.tradeId,
            screen: tradeData.screen,
            partner: {
              id: tradeData.partnerId as PlayerID,
              name: tradeData.partnerName,
              level: tradeData.partnerLevel,
            },
            myOffer: tradeData.myOffer,
            myAccepted: tradeData.myAccepted,
            theirOffer: tradeData.theirOffer,
            theirAccepted: tradeData.theirAccepted,
            myOfferValue: tradeData.myOfferValue,
            theirOfferValue: tradeData.theirOfferValue,
            partnerFreeSlots: tradeData.partnerFreeSlots,
          }}
          inventory={compactInventory}
          onAddItem={(slot, qty) =>
            world?.network?.send?.("tradeAddItem", {
              tradeId: tradeData.tradeId,
              inventorySlot: slot,
              quantity: qty,
            })
          }
          onRemoveItem={(tradeSlot) =>
            world?.network?.send?.("tradeRemoveItem", {
              tradeId: tradeData.tradeId,
              tradeSlot,
            })
          }
          onAccept={() =>
            world?.network?.send?.("tradeAccept", {
              tradeId: tradeData.tradeId,
            })
          }
          onCancel={() => {
            setTradeData(null);
            world?.network?.send?.("tradeCancel", {
              tradeId: tradeData.tradeId,
            });
          }}
        />
      )}

      {/* Duel Result Modal */}
      {duelResultData?.visible && (
        <DuelResultModal
          state={{
            visible: true,
            won: duelResultData.won,
            opponentName: duelResultData.opponentName,
            itemsReceived: duelResultData.itemsReceived,
            itemsLost: duelResultData.itemsLost,
            totalValueWon: duelResultData.totalValueWon,
            totalValueLost: duelResultData.totalValueLost,
            forfeit: duelResultData.forfeit,
          }}
          onClose={() => setDuelResultData(null)}
        />
      )}
    </>
  );
});
