/**
 * Mobile Interface Manager
 *
 * Dedicated mobile UI for portrait and landscape orientations.
 * Features:
 * - Bottom navigation bar with 5 core buttons
 * - Bottom sheet drawers for panels (hybrid: sheets for compact, modals for complex)
 * - Mobile-optimized status HUD (HP/Prayer orbs, minimap)
 * - Touch action bar with swipe gestures
 * - Safe area handling for notch/home indicator
 *
 * @packageDocumentation
 */

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
  type CSSProperties,
} from "react";
import { useMobileLayout, useTheme, ModalWindow } from "@/ui";
import type { ClientWorld } from "../../types";
import { createPanelRenderer, MODAL_PANEL_IDS } from "./PanelRegistry";
import { RadialMinimapMenu } from "../../game/hud/RadialMinimapMenu";
import { CompactStatusHUD } from "./CompactStatusHUD";
import { getMobileUISizes } from "./mobileUISizes";
import { useModalPanels, usePlayerDataContext } from "@/hooks";
import { zIndex } from "../../constants";
import { BankPanel } from "../../game/panels/BankPanel";
import { StorePanel } from "../../game/panels/StorePanel";
import { DialoguePanel } from "../../game/panels/DialoguePanel";
import { DialoguePopupShell } from "../../game/panels/dialogue/DialoguePopupShell";
import { SmeltingPanel } from "../../game/panels/SmeltingPanel";
import { SmithingPanel } from "../../game/panels/SmithingPanel";
import { CraftingPanel } from "../../game/panels/CraftingPanel";
import { FletchingPanel } from "../../game/panels/FletchingPanel";
import { TanningPanel } from "../../game/panels/TanningPanel";
import { LootWindowPanel } from "../../game/panels/LootWindowPanel";
import { QuestStartPanel } from "../../game/panels/QuestStartPanel";
import { QuestCompletePanel } from "../../game/panels/QuestCompletePanel";
import { XpLampPanel } from "../../game/panels/XpLampPanel";
import { ActionBarPanel } from "../../game/panels/ActionBarPanel";

// Import Lucide icons
import { X } from "lucide-react";

// NetworkEvents and event handling moved to usePlayerData and useModalPanels hooks

/** Storage key for persisting active panel across mode switches */
const MOBILE_PANEL_STORAGE_KEY = "mobile-active-panel";

/** Props for MobileInterfaceManager */
export interface MobileInterfaceManagerProps {
  /** The game world instance */
  world: ClientWorld;
  /** Children to render (typically game viewport) */
  children?: ReactNode;
  /** Whether the interface is enabled */
  enabled?: boolean;
}

/**
 * Mobile Interface Manager
 *
 * Main mobile UI component with portrait/landscape layouts and
 * touch-optimized controls.
 */
export function MobileInterfaceManager({
  world,
  children,
  enabled = true,
}: MobileInterfaceManagerProps): React.ReactElement {
  const theme = useTheme();
  const layout = useMobileLayout();
  const { safeAreaInsets } = layout;

  // Panel state - restore from localStorage on mount for mode transitions
  const [activePanel, setActivePanel] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(MOBILE_PANEL_STORAGE_KEY);
      // Clear after reading to avoid stale state
      if (saved) {
        sessionStorage.removeItem(MOBILE_PANEL_STORAGE_KEY);
        return saved;
      }
    }
    return null;
  });

  // Chat overlay state (separate from drawer)
  const [chatVisible, setChatVisible] = useState(false);

  // Player state from shared hook
  const { inventory, equipment, playerStats, coins } = usePlayerDataContext();

  // Modal panel states from shared hook
  const {
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
  } = useModalPanels(world);

  const closeDialogue = useCallback(() => {
    if (!dialogueData) {
      return;
    }

    setDialogueData(null);
    world?.network?.send?.("dialogueEnd", {
      npcId: dialogueData.npcId,
    });
  }, [dialogueData, setDialogueData, world]);

  // Handle radial menu button clicks (by panel id)
  const handleRadialButtonClick = useCallback(
    (panelId: string) => {
      if (panelId === "chat") {
        // Toggle chat overlay
        setChatVisible((prev) => !prev);
        return;
      }

      if (activePanel === panelId) {
        // Close panel if same panel
        setActivePanel(null);
      } else {
        // Open panel
        setActivePanel(panelId);
      }
    },
    [activePanel],
  );

  // Handle panel close
  const handlePanelClose = useCallback(() => {
    setActivePanel(null);
  }, []);

  // Handle menu clicks from panels
  const handleMenuClick = useCallback((panelId: string) => {
    // If it's a modal panel, let the modal system handle it
    if ((MODAL_PANEL_IDS as readonly string[]).includes(panelId)) {
      return;
    }

    // Open the panel
    setActivePanel(panelId);
  }, []);

  // Persist active panel to sessionStorage for mode transition recovery
  // This allows panel state to survive mobile <-> desktop switches
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activePanel) {
      sessionStorage.setItem(MOBILE_PANEL_STORAGE_KEY, activePanel);
    } else {
      sessionStorage.removeItem(MOBILE_PANEL_STORAGE_KEY);
    }
  }, [activePanel]);

  // Handle viewport size changes - recalculate UI sizes
  const mobileUISizes = useMemo(() => getMobileUISizes(layout), [layout]);

  const panelDataRef = React.useRef({
    inventory,
    coins,
    playerStats,
    equipment,
  });

  useEffect(() => {
    panelDataRef.current = {
      inventory,
      coins,
      playerStats,
      equipment,
    };
  }, [inventory, coins, playerStats, equipment]);

  // Create panel renderer
  const renderPanel = useMemo(
    () =>
      createPanelRenderer({
        world,
        onPanelClick: handleMenuClick,
        isEditMode: false,
        getPanelData: () => ({
          inventoryItems: panelDataRef.current.inventory as never[],
          coins: panelDataRef.current.coins,
          stats: panelDataRef.current.playerStats,
          equipment: panelDataRef.current.equipment,
        }),
      }),
    [world, handleMenuClick],
  );

  // Event subscriptions are now handled by usePlayerData and useModalPanels hooks

  // Get panel title for active panel
  const getPanelTitle = useCallback((panelId: string | null): string => {
    if (!panelId) return "";
    const titles: Record<string, string> = {
      inventory: "Inventory",
      equipment: "Equipment",
      combat: "Combat",
      skills: "Skills",
      prayer: "Prayer",
      quests: "Quests",
      npc: "NPCs",
      placement: "3D Placement",
      settings: "Settings",
      menubar: "Menu",
      chat: "Chat",
    };
    return (
      titles[panelId] || panelId.charAt(0).toUpperCase() + panelId.slice(1)
    );
  }, []);

  // Get panel width based on panel type
  const getPanelWidth = useCallback(
    (panelId: string | null): number => {
      if (!panelId) return 260;
      const widths = mobileUISizes.panel.widths;
      const key = panelId as keyof typeof widths;
      return widths[key] ?? 260;
    },
    [mobileUISizes.panel.widths],
  );

  // Get panel height based on panel type
  const getPanelHeight = useCallback(
    (panelId: string | null): number => {
      if (!panelId) return 50;
      const heights = mobileUISizes.panel.heights;
      const key = panelId as keyof typeof heights;
      return heights[key] ?? 50;
    },
    [mobileUISizes.panel.heights],
  );

  // Render panel content
  const renderPanelContent = useCallback(() => {
    if (!activePanel || !renderPanel) return null;

    const content = renderPanel(activePanel);
    if (!content) return null;

    return (
      <div
        style={{
          padding: theme.spacing.sm,
          height: "100%",
          overflow: "auto",
        }}
      >
        {content}
      </div>
    );
  }, [activePanel, renderPanel, theme.spacing.sm]);

  // Container styles - pointer events none so clicks go through to game
  const containerStyle: CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    pointerEvents: "none", // Allow clicks through to game canvas
    // Hide entire UI when disabled
    opacity: enabled ? 1 : 0,
    visibility: enabled ? "visible" : "hidden",
  };

  // Get responsive UI sizes (layout already defined above)
  const uiSizes = mobileUISizes;

  // Pointer events based on enabled state
  const uiPointerEvents = enabled ? "auto" : "none";

  // Status HUD styles - adapts for orientation using layout config
  const statusHudStyle: CSSProperties = (() => {
    const pos = uiSizes.statusHud.position;
    if (pos === "left-center") {
      return {
        position: "fixed",
        top: "50%",
        left: safeAreaInsets.left + 8,
        transform: "translateY(-50%)",
        pointerEvents: uiPointerEvents,
        zIndex: zIndex.mobileStatusHud,
      };
    }
    // Default: top-left
    return {
      position: "fixed",
      top: safeAreaInsets.top + 8,
      left: safeAreaInsets.left + 8,
      pointerEvents: uiPointerEvents,
      zIndex: zIndex.mobileStatusHud,
    };
  })();

  // Calculate chat height for action bar positioning
  const chatHeightPx = chatVisible ? uiSizes.chat.height + 40 : 0;

  // Action bar container styles - responsive based on layout mode
  const actionBarStyle: CSSProperties = (() => {
    const pos = uiSizes.actionBar.position;
    const isVertical = uiSizes.actionBar.orientation === "vertical";

    if (pos === "left-side" && isVertical) {
      // Mobile: vertical action bar in bottom-left corner, touching edges
      return {
        position: "fixed",
        left: safeAreaInsets.left,
        bottom: safeAreaInsets.bottom + chatHeightPx,
        display: "flex",
        flexDirection: "column",
        pointerEvents: uiPointerEvents,
        zIndex: zIndex.mobileActionBar,
        transition: "bottom 0.2s ease-out",
      };
    }
    if (pos === "right-side" && isVertical) {
      // Landscape tablet: vertical action bar on right
      return {
        position: "fixed",
        right: safeAreaInsets.right + 8,
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
        flexDirection: "column",
        pointerEvents: uiPointerEvents,
        zIndex: zIndex.mobileActionBar,
      };
    }
    // Default: bottom-center horizontal
    return {
      position: "fixed",
      bottom: safeAreaInsets.bottom + 8 + chatHeightPx,
      left: "50%",
      transform: "translateX(-50%)",
      pointerEvents: uiPointerEvents,
      zIndex: zIndex.mobileActionBar,
      transition: "bottom 0.2s ease-out",
    };
  })();

  return (
    <div style={containerStyle}>
      {/* Game viewport (children) - only render wrapper if children exist */}
      {children && (
        <div
          style={{
            flex: 1,
            pointerEvents: "auto", // Game canvas receives clicks
          }}
        >
          {children}
        </div>
      )}

      {/* Compact Status HUD (top-left) */}
      <div style={statusHudStyle}>
        <CompactStatusHUD
          health={playerStats?.health}
          prayerPoints={playerStats?.prayerPoints}
        />
      </div>

      {/* Action Bar Panel - same as desktop but with vertical orientation on mobile */}
      <div style={actionBarStyle}>
        <ActionBarPanel
          world={world}
          barId={0}
          orientation={uiSizes.actionBar.orientation}
          showShortcuts={false}
          showControls={false}
        />
      </div>

      {/* Radial Minimap Menu */}
      <RadialMinimapMenu
        world={world}
        onButtonClick={handleRadialButtonClick}
        activePanel={activePanel}
        chatVisible={chatVisible}
      />

      {/* Responsive sliding panel - position based on layout mode */}
      {activePanel !== null && activePanel !== "chat" && (
        <div
          style={(() => {
            const panelPos = uiSizes.panel.position;
            const baseStyles: CSSProperties = {
              position: "fixed",
              width: getPanelWidth(activePanel),
              maxWidth: uiSizes.panel.maxWidth,
              height: `${getPanelHeight(activePanel)}vh`,
              maxHeight: uiSizes.panel.maxHeight,
              backgroundColor: theme.colors.background.overlay,
              borderRadius: 0,
              boxShadow: theme.shadows.lg,
              zIndex: zIndex.mobileDrawer + 10,
              display: "flex",
              flexDirection: "column",
              pointerEvents: "auto",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            };

            if (panelPos.anchor === "left-side") {
              // Landscape: left-side panel
              return {
                ...baseStyles,
                left: 0,
                top: safeAreaInsets.top,
                bottom: 0,
                height: "auto",
                maxHeight: "none",
                borderRight: `1px solid ${theme.colors.border.default}`,
                borderTop: "none",
                borderLeft: "none",
                animation: "slideInFromLeft 0.2s ease-out",
              };
            }
            // Default: bottom-right panel
            return {
              ...baseStyles,
              right: 0,
              bottom: 0,
              borderLeft: `1px solid ${theme.colors.border.default}`,
              borderTop: `1px solid ${theme.colors.border.default}`,
              animation: "slideInFromRight 0.2s ease-out",
            };
          })()}
        >
          {/* Panel Header - compact */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
              borderBottom: `1px solid ${theme.colors.border.default}`,
              flexShrink: 0,
              backgroundColor: theme.colors.background.secondary,
            }}
          >
            <span
              style={{
                color: theme.colors.text.primary,
                fontWeight: 600,
                fontSize: theme.typography.fontSize.sm,
              }}
            >
              {getPanelTitle(activePanel)}
            </span>
            <button
              onClick={handlePanelClose}
              style={{
                width: 24,
                height: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "transparent",
                border: "none",
                color: theme.colors.text.secondary,
                cursor: "pointer",
              }}
              aria-label="Close panel"
            >
              <X size={16} />
            </button>
          </div>

          {/* Panel Content */}
          <div
            style={{
              flex: 1,
              overflow: "auto",
              overscrollBehavior: "contain",
            }}
          >
            {renderPanelContent()}
          </div>
        </div>
      )}

      {/* Chat Panel - responsive positioning based on layout mode */}
      {chatVisible && (
        <div
          style={(() => {
            const chatPos = uiSizes.chat.position;
            const chatW = uiSizes.chat.width;

            if (chatPos === "left-side") {
              // Landscape: left-side panel
              return {
                position: "fixed" as const,
                left: 0,
                top: safeAreaInsets.top,
                bottom: 0,
                width: typeof chatW === "number" ? chatW : "35%",
                backgroundColor: theme.colors.background.overlay,
                borderRight: `1px solid ${theme.colors.border.default}`,
                zIndex: zIndex.mobileDrawer - 10,
                display: "flex",
                flexDirection: "column" as const,
                pointerEvents: "auto" as const,
                animation: "slideInFromLeft 0.15s ease-out",
              };
            }
            // Default: bottom full-width
            return {
              position: "fixed" as const,
              bottom: 0,
              left: 0,
              right: 0,
              height: uiSizes.chat.height + 40,
              backgroundColor: theme.colors.background.overlay,
              borderTop: `1px solid ${theme.colors.border.default}`,
              zIndex: zIndex.mobileDrawer - 10,
              display: "flex",
              flexDirection: "column" as const,
              pointerEvents: "auto" as const,
              animation: "slideInFromBottom 0.15s ease-out",
            };
          })()}
        >
          {/* Chat Header - minimal */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: `4px ${theme.spacing.sm}px`,
              borderBottom: `1px solid ${theme.colors.border.default}`,
              flexShrink: 0,
              backgroundColor: theme.colors.background.secondary,
            }}
          >
            <span
              style={{
                color: theme.colors.text.secondary,
                fontWeight: 500,
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Chat
            </span>
            <button
              onClick={() => setChatVisible(false)}
              style={{
                width: 20,
                height: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "transparent",
                border: "none",
                color: theme.colors.text.muted,
                cursor: "pointer",
              }}
              aria-label="Close chat"
            >
              <X size={14} />
            </button>
          </div>
          {/* Chat Content - more space for messages */}
          <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
            {renderPanel("chat")}
          </div>
        </div>
      )}

      {/* Modal Panels */}
      {bankData?.visible && (
        <ModalWindow
          visible={true}
          onClose={() => setBankData(null)}
          title="Bank"
          maxWidth="95vw"
          maxHeight="90vh"
        >
          <BankPanel
            world={world}
            items={bankData.items}
            tabs={bankData.tabs}
            inventory={inventory}
            alwaysSetPlaceholder={bankData.alwaysSetPlaceholder}
            maxSlots={bankData.maxSlots}
            coins={coins}
            onClose={() => setBankData(null)}
          />
        </ModalWindow>
      )}

      {storeData?.visible && (
        <ModalWindow
          visible={true}
          onClose={() => setStoreData(null)}
          title={storeData.storeName}
          maxWidth="95vw"
          maxHeight="90vh"
        >
          <StorePanel
            world={world}
            storeId={storeData.storeId}
            storeName={storeData.storeName}
            buybackRate={storeData.buybackRate}
            items={storeData.items}
            inventory={inventory}
            coins={coins}
            npcEntityId={storeData.npcEntityId}
            onClose={() => setStoreData(null)}
          />
        </ModalWindow>
      )}

      {/* Dialogue Panel */}
      {dialogueData?.visible && (
        <DialoguePopupShell
          visible={true}
          onClose={closeDialogue}
          title={dialogueData.npcName}
          width="min(88vw, 640px)"
          maxWidth="88vw"
          maxHeight="min(48vh, 400px)"
          contentStyle={{
            overflow: "hidden",
          }}
        >
          <DialoguePanel
            visible={true}
            world={world}
            npcId={dialogueData.npcId}
            npcName={dialogueData.npcName}
            text={dialogueData.text}
            responses={dialogueData.responses}
            npcEntityId={dialogueData.npcEntityId}
            onSelectResponse={(_index, response) => {
              if (!response.nextNodeId) {
                setDialogueData(null);
              }
            }}
          />
        </DialoguePopupShell>
      )}

      {smeltingData?.visible && (
        <ModalWindow
          visible={true}
          onClose={() => setSmeltingData(null)}
          title="Smelting"
          maxWidth="90vw"
          maxHeight="80vh"
        >
          <SmeltingPanel
            world={world}
            furnaceId={smeltingData.furnaceId}
            availableBars={smeltingData.availableBars}
            onClose={() => setSmeltingData(null)}
          />
        </ModalWindow>
      )}

      {smithingData?.visible && (
        <ModalWindow
          visible={true}
          onClose={() => setSmithingData(null)}
          title="Smithing"
          maxWidth="90vw"
          maxHeight="80vh"
        >
          <SmithingPanel
            world={world}
            anvilId={smithingData.anvilId}
            availableRecipes={smithingData.availableRecipes}
            onClose={() => setSmithingData(null)}
          />
        </ModalWindow>
      )}

      {craftingData?.visible && (
        <ModalWindow
          visible={true}
          onClose={() => setCraftingData(null)}
          title="Crafting"
          maxWidth="90vw"
          maxHeight="80vh"
        >
          <CraftingPanel
            world={world}
            availableRecipes={craftingData.availableRecipes}
            station={craftingData.station}
            onClose={() => setCraftingData(null)}
          />
        </ModalWindow>
      )}

      {fletchingData?.visible && (
        <ModalWindow
          visible={true}
          onClose={() => setFletchingData(null)}
          title="Fletching"
          maxWidth="90vw"
          maxHeight="80vh"
        >
          <FletchingPanel
            world={world}
            availableRecipes={fletchingData.availableRecipes}
            onClose={() => setFletchingData(null)}
          />
        </ModalWindow>
      )}

      {tanningData?.visible && (
        <ModalWindow
          visible={true}
          onClose={() => setTanningData(null)}
          title="Tanning"
          maxWidth="90vw"
          maxHeight="80vh"
        >
          <TanningPanel
            world={world}
            availableRecipes={tanningData.availableRecipes}
            onClose={() => setTanningData(null)}
          />
        </ModalWindow>
      )}

      {lootWindowData?.visible && (
        <ModalWindow
          visible={true}
          onClose={() => setLootWindowData(null)}
          title={`Loot: ${lootWindowData.corpseName}`}
          maxWidth="90vw"
          maxHeight="60vh"
        >
          <LootWindowPanel
            visible={true}
            world={world}
            corpseId={lootWindowData.corpseId}
            corpseName={lootWindowData.corpseName}
            lootItems={lootWindowData.lootItems}
            onClose={() => setLootWindowData(null)}
          />
        </ModalWindow>
      )}

      {questStartData?.visible && (
        <ModalWindow
          visible={true}
          onClose={() => setQuestStartData(null)}
          title="New Quest"
          maxWidth="90vw"
          maxHeight="80vh"
        >
          <QuestStartPanel
            visible={true}
            questId={questStartData.questId}
            questName={questStartData.questName}
            description={questStartData.description}
            difficulty={questStartData.difficulty}
            requirements={questStartData.requirements}
            rewards={questStartData.rewards}
            onAccept={() => {
              if (world.network?.send) {
                world.network.send("questAccept", {
                  questId: questStartData.questId,
                });
              }
              setQuestStartData(null);
            }}
            onDecline={() => setQuestStartData(null)}
          />
        </ModalWindow>
      )}

      {questCompleteData?.visible && (
        <ModalWindow
          visible={true}
          onClose={() => setQuestCompleteData(null)}
          title="Quest Complete!"
          maxWidth="90vw"
          maxHeight="80vh"
        >
          <QuestCompletePanel
            visible={true}
            world={world}
            questName={questCompleteData.questName}
            rewards={questCompleteData.rewards}
            onClose={() => setQuestCompleteData(null)}
          />
        </ModalWindow>
      )}

      {xpLampData?.visible && (
        <ModalWindow
          visible={true}
          onClose={() => setXpLampData(null)}
          title="XP Lamp"
          maxWidth="80vw"
          maxHeight="60vh"
        >
          <XpLampPanel
            visible={true}
            world={world}
            itemId={xpLampData.itemId}
            slot={xpLampData.slot}
            xpAmount={xpLampData.xpAmount}
            stats={playerStats}
            onClose={() => setXpLampData(null)}
          />
        </ModalWindow>
      )}
    </div>
  );
}

export default MobileInterfaceManager;
