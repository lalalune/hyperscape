import React, { useEffect, useState } from "react";
import { EventType } from "@hyperscape/shared";
import type {
  ClientWorld,
  PlayerEquipmentItems,
  PlayerStats,
  InventorySlotItem,
  InventoryItem,
} from "../types";
import { useChatContext } from "./chat/ChatContext";
import { HintProvider } from "../components/Hint";
import { Minimap } from "./hud/Minimap";
import { MenuButton } from "../components/MenuButton";
import { GameWindow } from "../components/GameWindow";
import { MinimapCompass } from "../components/MinimapCompass";
import { SkillsPanel } from "./panels/SkillsPanel";
import { InventoryPanel } from "./panels/InventoryPanel";
import { CombatPanel } from "./panels/CombatPanel";
import { EquipmentPanel } from "./panels/EquipmentPanel";
import { SettingsPanel } from "./panels/SettingsPanel";
import { AccountPanel } from "./panels/AccountPanel";
import { DashboardPanel } from "./panels/DashboardPanel";
import { LootWindow } from "./panels/LootWindow";
import { BankPanel } from "./panels/BankPanel";

type InventorySlotViewItem = Pick<
  InventorySlotItem,
  "slot" | "itemId" | "quantity"
>;

interface SidebarProps {
  world: ClientWorld;
  ui: {
    active: boolean;
    pane: string | null;
  };
}

export function Sidebar({ world, ui: _ui }: SidebarProps) {
  const [inventory, setInventory] = useState<InventorySlotViewItem[]>([]);
  const [equipment, setEquipment] = useState<PlayerEquipmentItems | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [coins, setCoins] = useState<number>(0);
  const [minimapCollapsed, setMinimapCollapsed] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const {
    collapsed: _chatCollapsed,
    active: _chatActive,
    setHasOpenWindows,
  } = useChatContext();

  const [openWindows, setOpenWindows] = useState<Set<string>>(new Set());
  const [windowZIndices, setWindowZIndices] = useState<Map<string, number>>(
    new Map(),
  );
  const [nextZIndex, setNextZIndex] = useState(1000);

  // Loot window state
  const [lootWindowData, setLootWindowData] = useState<{
    visible: boolean;
    corpseId: string;
    corpseName: string;
    lootItems: InventoryItem[];
  } | null>(null);

  // Bank panel state
  const [bankData, setBankData] = useState<{
    visible: boolean;
    items: Array<{ itemId: string; quantity: number; slot: number }>;
    maxSlots: number;
    bankId: string;
  } | null>(null);

  // Update chat context whenever windows open/close
  useEffect(() => {
    setHasOpenWindows(openWindows.size > 0);
  }, [openWindows, setHasOpenWindows]);

  const toggleWindow = (windowId: string) => {
    setOpenWindows((prev) => {
      const next = new Set(prev);
      if (next.has(windowId)) {
        next.delete(windowId);
      } else {
        next.add(windowId);
        // Assign z-index when opening
        setWindowZIndices((prevIndices) => {
          const newIndices = new Map(prevIndices);
          newIndices.set(windowId, nextZIndex);
          return newIndices;
        });
        setNextZIndex((prev) => prev + 1);
      }
      return next;
    });
  };

  const closeWindow = (windowId: string) => {
    setOpenWindows((prev) => {
      const next = new Set(prev);
      next.delete(windowId);
      return next;
    });
    // Clean up z-index when closing
    setWindowZIndices((prev) => {
      const next = new Map(prev);
      next.delete(windowId);
      return next;
    });
  };

  const bringToFront = (windowId: string) => {
    setWindowZIndices((prevIndices) => {
      const newIndices = new Map(prevIndices);
      newIndices.set(windowId, nextZIndex);
      return newIndices;
    });
    setNextZIndex((prev) => prev + 1);
  };

  useEffect(() => {
    const onOpenPane = (d: unknown) => {
      const data = d as { pane?: string | null };
      if (data?.pane)
        setOpenWindows((prev) => new Set(prev).add(data.pane as string));
    };
    world.on(EventType.UI_OPEN_PANE, onOpenPane);

    const onUIUpdate = (raw: unknown) => {
      const update = raw as { component: string; data: unknown };
      if (update.component === "player")
        setPlayerStats(update.data as PlayerStats);
      if (update.component === "equipment") {
        // The backend sends PlayerEquipment (with slots containing items),
        // but the UI expects PlayerEquipmentItems (just the items).
        const data = update.data as { equipment: any };
        const rawEq = data.equipment;

        const mappedEquipment: PlayerEquipmentItems = {
          weapon: rawEq.weapon?.item || null,
          shield: rawEq.shield?.item || null,
          helmet: rawEq.helmet?.item || null,
          body: rawEq.body?.item || null,
          legs: rawEq.legs?.item || null,
          arrows: rawEq.arrows?.item || null,
        };
        console.log("[Sidebar] 🛡️ Equipment updated:", {
          weapon: mappedEquipment.weapon?.name || "empty",
          shield: mappedEquipment.shield?.name || "empty",
          helmet: mappedEquipment.helmet?.name || "empty",
          body: mappedEquipment.body?.name || "empty",
          legs: mappedEquipment.legs?.name || "empty",
          arrows: mappedEquipment.arrows?.name || "empty",
        });
        setEquipment(mappedEquipment);
      }
      // Handle bank state updates
      if (update.component === "bank") {
        const data = update.data as {
          items: Array<{ itemId: string; quantity: number; slot: number }>;
          maxSlots: number;
          bankId?: string;
          isOpen?: boolean;
        };
        if (data.isOpen) {
          setBankData({
            visible: true,
            items: data.items || [],
            maxSlots: data.maxSlots || 480,
            bankId: data.bankId || "spawn_bank",
          });
        }
      }
    };
    const onInventory = (raw: unknown) => {
      const data = raw as {
        items: InventorySlotViewItem[];
        playerId: string;
        coins: number;
      };
      console.log("[Sidebar] 📥 Received INVENTORY_UPDATED:", {
        itemCount: data.items.length,
        coins: data.coins,
        items: data.items.map((i) => ({
          slot: i.slot,
          itemId: i.itemId,
          qty: i.quantity,
        })),
      });
      setInventory(data.items);
      setCoins(data.coins);
    };
    const onCoins = (raw: unknown) => {
      const data = raw as { playerId: string; coins: number };
      const localId = world.entities?.player?.id;
      if (!localId || data.playerId === localId) setCoins(data.coins);
    };
    const onSkillsUpdate = (raw: unknown) => {
      const data = raw as { playerId: string; skills: PlayerStats["skills"] };
      const localId = world.entities?.player?.id;
      if (!localId || data.playerId === localId) {
        // Just update skills - combat level will come from server via PLAYER_UPDATED event
        setPlayerStats((prev) =>
          prev
            ? { ...prev, skills: data.skills }
            : ({ skills: data.skills } as PlayerStats),
        );
      }
    };

    const onCorpseClick = (raw: unknown) => {
      const data = raw as {
        corpseId: string;
        playerId: string;
        lootItems?: Array<{ itemId: string; quantity: number }>;
        position: { x: number; y: number; z: number };
      };

      console.log(
        `[Sidebar] CORPSE_CLICK received for ${data.corpseId} with ${data.lootItems?.length || 0} items:`,
        data.lootItems
          ?.map((item) => `${item.itemId} x${item.quantity}`)
          .join(", ") || "(none)",
      );

      // Open loot window with corpse items
      setLootWindowData({
        visible: true,
        corpseId: data.corpseId,
        corpseName: `Gravestone`, // TODO: Get actual corpse name
        lootItems:
          data.lootItems?.map((item, index) => ({
            id: `${data.corpseId}-${index}`,
            slot: index,
            itemId: item.itemId,
            quantity: item.quantity,
            metadata: null,
          })) || [],
      });

      console.log(
        `[Sidebar] LootWindow opened with ${data.lootItems?.length || 0} items`,
      );
    };

    world.on(EventType.UI_UPDATE, onUIUpdate);
    world.on(EventType.INVENTORY_UPDATED, onInventory);
    world.on(EventType.INVENTORY_UPDATE_COINS, onCoins);
    world.on(EventType.SKILLS_UPDATED, onSkillsUpdate);
    world.on(EventType.CORPSE_CLICK, onCorpseClick);

    const requestInitial = () => {
      const lp = world.entities?.player?.id;
      if (lp) {
        const cached = world.network?.lastInventoryByPlayerId?.[lp];
        if (cached && Array.isArray(cached.items)) {
          setInventory(cached.items);
          setCoins(cached.coins);
        }
        const cachedSkills = world.network?.lastSkillsByPlayerId?.[lp];
        if (cachedSkills) {
          const skills = cachedSkills as unknown as PlayerStats["skills"];
          // Just update skills - combat level will come from server
          setPlayerStats((prev) =>
            prev
              ? {
                  ...prev,
                  skills,
                }
              : ({
                  skills,
                } as PlayerStats),
          );
        }
        const cachedEquipment = world.network?.lastEquipmentByPlayerId?.[lp];
        if (cachedEquipment) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rawEq = cachedEquipment as any;
          const mappedEquipment: PlayerEquipmentItems = {
            weapon: rawEq.weapon?.item || null,
            shield: rawEq.shield?.item || null,
            helmet: rawEq.helmet?.item || null,
            body: rawEq.body?.item || null,
            legs: rawEq.legs?.item || null,
            arrows: rawEq.arrows?.item || null,
          };
          console.log("[Sidebar] 📦 Loaded cached equipment on mount:", {
            weapon: mappedEquipment.weapon?.name || "empty",
            shield: mappedEquipment.shield?.name || "empty",
            helmet: mappedEquipment.helmet?.name || "empty",
            body: mappedEquipment.body?.name || "empty",
            legs: mappedEquipment.legs?.name || "empty",
            arrows: mappedEquipment.arrows?.name || "empty",
          });
          setEquipment(mappedEquipment);
        }
        world.emit(EventType.INVENTORY_REQUEST, { playerId: lp });
        return true;
      }
      return false;
    };
    let timeoutId: number | null = null;
    if (!requestInitial())
      timeoutId = window.setTimeout(() => requestInitial(), 400);
    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      world.off(EventType.UI_OPEN_PANE, onOpenPane);
      world.off(EventType.UI_UPDATE, onUIUpdate);
      world.off(EventType.INVENTORY_UPDATED, onInventory);
      world.off(EventType.INVENTORY_UPDATE_COINS, onCoins);
      world.off(EventType.SKILLS_UPDATED, onSkillsUpdate);
      world.off(EventType.CORPSE_CLICK, onCorpseClick);
    };
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const menuButtons = [
    { windowId: "combat", icon: "⚔️", label: "Combat" },
    { windowId: "dashboard", icon: "📋", label: "Dashboard" },
    { windowId: "skills", icon: "🧠", label: "Skills" },
    { windowId: "inventory", icon: "🎒", label: "Inventory" },
    { windowId: "equipment", icon: "🛡️", label: "Equipment" },
    { windowId: "prefs", icon: "⚙️", label: "Settings" },
    { windowId: "account", icon: "👤", label: "Account" },
  ] as const;

  const minimapOuterSize = isMobile ? 180 : 220;
  const minimapInnerSize = isMobile ? 164 : 204;
  const minimapZoom = isMobile ? 40 : 50;

  const radialOffset = isMobile ? 20 : 28;
  const radialRadius = minimapOuterSize / 2 + radialOffset;
  const startAngleDeg = isMobile ? 135 : 130;
  const endAngleDeg = isMobile ? 225 : 220;
  const radialButtonSize = isMobile ? ("compact" as const) : ("small" as const);
  const startAngle = (Math.PI / 180) * startAngleDeg;
  const endAngle = (Math.PI / 180) * endAngleDeg;
  const angleStep =
    menuButtons.length > 1
      ? (endAngle - startAngle) / (menuButtons.length - 1)
      : 0;
  const radialButtons = menuButtons.map((button, index) => {
    const angle = startAngle + angleStep * index;
    const offsetX = Math.cos(angle) * radialRadius;
    const offsetY = Math.sin(angle) * radialRadius;
    return {
      ...button,
      style: {
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px)`,
      } as React.CSSProperties,
    };
  });

  return (
    <HintProvider>
      <div className="sidebar absolute text-base inset-0 pointer-events-none z-[1]">
        {/* Minimap and radial menu */}
        <div
          className="fixed z-[998] pointer-events-none"
          style={{
            right: isMobile ? 8 : 20,
            top: isMobile ? 8 : 24,
          }}
        >
          <div
            className="relative pointer-events-none"
            style={{
              width: minimapCollapsed ? 56 : minimapOuterSize,
              height: minimapCollapsed ? 56 : minimapOuterSize,
              transition: "width 0.3s ease-in-out, height 0.3s ease-in-out",
            }}
          >
            <div
              className={`absolute inset-0 rounded-full pointer-events-auto overflow-hidden flex items-center justify-center ${
                minimapCollapsed
                  ? "opacity-0 pointer-events-none"
                  : "opacity-100"
              }`}
              style={{
                background:
                  "linear-gradient(135deg, rgba(20, 15, 10, 0.85) 0%, rgba(15, 10, 5, 0.95) 50%, rgba(20, 15, 10, 0.85) 100%)",
                backdropFilter: "blur(12px)",
                border: "2px solid rgba(139, 69, 19, 0.7)",
                boxShadow:
                  "0 10px 30px rgba(0, 0, 0, 0.8), 0 4px 16px rgba(139, 69, 19, 0.5), inset 0 2px 4px rgba(242, 208, 138, 0.15), inset 0 -2px 4px rgba(0, 0, 0, 0.6)",
                paddingTop: "6px",
                paddingRight: isMobile ? "10px" : "10px",
                paddingBottom: "10px",
                paddingLeft: "6px",
                transition:
                  "opacity 0.3s ease-in-out, border-color 0.2s ease-in-out",
                willChange: "opacity",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(242, 208, 138, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(139, 69, 19, 0.7)";
              }}
            >
              <Minimap
                world={world}
                width={minimapInnerSize}
                height={minimapInnerSize}
                zoom={minimapZoom}
                onCompassClick={() => setMinimapCollapsed(true)}
                isVisible={!minimapCollapsed}
              />
            </div>
            {!minimapCollapsed &&
              radialButtons.map((button) => (
                <div
                  key={button.windowId}
                  className="absolute pointer-events-auto z-[999]"
                  style={button.style}
                >
                  <MenuButton
                    icon={button.icon}
                    label={button.label}
                    active={openWindows.has(button.windowId)}
                    onClick={() => toggleWindow(button.windowId)}
                    size={radialButtonSize}
                    circular={true}
                  />
                </div>
              ))}

            {/* Compass - always visible on outside of ring */}
            <div
              className="absolute pointer-events-auto z-[1000]"
              style={{
                right: minimapCollapsed ? 0 : isMobile ? 4 : 6,
                top: minimapCollapsed ? 0 : isMobile ? 4 : 6,
              }}
            >
              <MinimapCompass
                world={world}
                onClick={() => setMinimapCollapsed(!minimapCollapsed)}
                isCollapsed={minimapCollapsed}
              />
            </div>
          </div>
        </div>

        {/* Responsive windows */}
        {openWindows.has("account") && (
          <GameWindow
            title="Account"
            windowId="account"
            onClose={() => closeWindow("account")}
            zIndex={windowZIndices.get("account") || 1000}
            onFocus={() => bringToFront("account")}
          >
            <AccountPanel world={world} />
          </GameWindow>
        )}

        {openWindows.has("combat") && (
          <GameWindow
            title="Combat"
            windowId="combat"
            onClose={() => closeWindow("combat")}
            zIndex={windowZIndices.get("combat") || 1000}
            onFocus={() => bringToFront("combat")}
          >
            <CombatPanel
              world={world}
              stats={playerStats}
              equipment={equipment}
            />
          </GameWindow>
        )}

        {/* Dashboard - Fixed position below minimap */}
        {openWindows.has("dashboard") && (
          <GameWindow
            title="Dashboard"
            windowId="dashboard"
            onClose={() => closeWindow("dashboard")}
            zIndex={windowZIndices.get("dashboard") || 1000}
            onFocus={() => bringToFront("dashboard")}
            defaultX={window.innerWidth - (isMobile ? 608 : 620)}
            defaultY={
              isMobile
                ? minimapCollapsed
                  ? 72
                  : 260
                : minimapCollapsed
                  ? 88
                  : 280
            }
          >
            <DashboardPanel
              world={world}
              stats={playerStats}
              equipment={equipment}
              inventory={inventory}
              coins={coins}
              onOpenWindow={toggleWindow}
            />
          </GameWindow>
        )}

        {openWindows.has("skills") && (
          <GameWindow
            title="Skills"
            windowId="skills"
            onClose={() => closeWindow("skills")}
            zIndex={windowZIndices.get("skills") || 1000}
            onFocus={() => bringToFront("skills")}
          >
            <SkillsPanel world={world} stats={playerStats} />
          </GameWindow>
        )}

        {openWindows.has("inventory") && (
          <GameWindow
            title="Inventory"
            windowId="inventory"
            onClose={() => closeWindow("inventory")}
            zIndex={windowZIndices.get("inventory") || 1000}
            onFocus={() => bringToFront("inventory")}
            fitContent
          >
            <InventoryPanel items={inventory} coins={coins} world={world} />
          </GameWindow>
        )}

        {openWindows.has("equipment") && (
          <GameWindow
            title="Equipment"
            windowId="equipment"
            onClose={() => closeWindow("equipment")}
            zIndex={windowZIndices.get("equipment") || 1000}
            onFocus={() => bringToFront("equipment")}
          >
            <EquipmentPanel
              equipment={equipment}
              stats={playerStats}
              world={world}
            />
          </GameWindow>
        )}

        {openWindows.has("prefs") && (
          <GameWindow
            title="Settings"
            windowId="prefs"
            onClose={() => closeWindow("prefs")}
            zIndex={windowZIndices.get("prefs") || 1000}
            onFocus={() => bringToFront("prefs")}
          >
            <SettingsPanel world={world} />
          </GameWindow>
        )}

        {/* Loot Window */}
        {lootWindowData && (
          <LootWindow
            visible={lootWindowData.visible}
            corpseId={lootWindowData.corpseId}
            corpseName={lootWindowData.corpseName}
            lootItems={lootWindowData.lootItems}
            onClose={() => setLootWindowData(null)}
            world={world}
          />
        )}

        {/* Bank Panel (includes integrated inventory) */}
        {bankData?.visible && (
          <BankPanel
            items={bankData.items}
            maxSlots={bankData.maxSlots}
            world={world}
            inventory={inventory}
            coins={coins}
            bankId={bankData.bankId}
            onClose={() => {
              setBankData(null);
              if (world.network?.send) {
                world.network.send("bankClose", {});
              }
            }}
          />
        )}
      </div>
    </HintProvider>
  );
}
