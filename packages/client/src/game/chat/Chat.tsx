import { MessageSquareIcon } from "lucide-react";
import { useThemeStore } from "@/ui";
import { GRADIENTS, typography } from "../../constants";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";

import { ControlPriorities, EventType, isTouch } from "@hyperforge/shared";
import type { ClientWorld, InventorySlotItem } from "../../types";
import { getEmbeddedConfig } from "../../types/embeddedConfig";
import { ActionPanel } from "../panels/ActionPanel";
import { cls } from "../../utils/classnames";
import { useChatContext } from "./ChatContext";

const CHAT_HEADER_FONT = typography.fontFamily.body;

/**
 * Module-level chat button style constant (without color - applied dynamically).
 * isTouch is a module-level constant from @hyperforge/shared that doesn't change at runtime,
 * so this style can be computed once at module load time.
 */
const CHAT_BUTTON_BASE_STYLE: Omit<React.CSSProperties, "color"> = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.6rem",
  background:
    "linear-gradient(135deg, rgba(30, 20, 10, 0.9) 0%, rgba(20, 15, 10, 0.95) 100%)",
  borderRadius: 9999,
  padding: isTouch ? "0.55rem 1.2rem" : "0.65rem 1.4rem",
  fontFamily: CHAT_HEADER_FONT,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontSize: isTouch ? "0.68rem" : "0.76rem",
  boxShadow:
    "0 4px 12px rgba(0, 0, 0, 0.7), 0 2px 6px rgba(139, 69, 19, 0.4), inset 0 1px 0 rgba(242, 208, 138, 0.2), inset 0 -1px 0 rgba(0, 0, 0, 0.5)",
  textShadow: "0 1px 2px rgba(0, 0, 0, 0.8), 0 0 6px rgba(242, 208, 138, 0.3)",
  pointerEvents: "auto",
};

// Local type definitions
interface ChatMessage {
  id: string;
  from: string;
  fromId?: string;
  body: string;
  createdAt: string;
  timestamp?: number;
  /** Message type for different display styles (default: "chat") */
  type?: "chat" | "system" | "trade_request" | "duel_challenge";
  /** Trade ID for trade_request messages */
  tradeId?: string;
  /** Challenge ID for duel_challenge messages */
  challengeId?: string;
}

interface ControlBinding {
  slash?: { onPress?: () => void | boolean | null };
  enter?: { onPress?: () => void | boolean | null };
  mouseLeft?: { onPress?: () => void | boolean | null };
  pointer?: { locked?: boolean };
  release?: () => void;
}

// Extended client world type for Chat component
type ChatWorld = ClientWorld & {
  prefs?: ClientWorld["prefs"] & {
    chatVisible?: boolean;
  };
  controls?: {
    bind?: (options: { priority?: number }) => ControlBinding;
    pointer?: { locked?: boolean };
  };
  chat: {
    subscribe: (callback: (msgs: ChatMessage[]) => void) => () => void;
    send: (message: string) => void;
    command: (command: string) => void;
  };
  network: {
    id: string;
    send?: (method: string, payload?: Record<string, unknown>) => void;
    lastInventoryByPlayerId?: Record<
      string,
      { items: InventorySlotItem[]; coins: number }
    >;
  };
};

function isInventoryEqual(
  current: InventorySlotItem[],
  next: InventorySlotItem[],
): boolean {
  if (current === next) {
    return true;
  }

  if (current.length !== next.length) {
    return false;
  }

  for (let index = 0; index < current.length; index += 1) {
    const currentItem = current[index];
    const nextItem = next[index];

    if (
      currentItem.slot !== nextItem.slot ||
      currentItem.itemId !== nextItem.itemId ||
      currentItem.quantity !== nextItem.quantity
    ) {
      return false;
    }
  }

  return true;
}

export function Chat({ world }: { world: ChatWorld }) {
  const theme = useThemeStore((s) => s.theme);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const chatPanelRef = useRef<HTMLDivElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const [msg, setMsg] = useState("");
  const { active, setActive, collapsed, setCollapsed, hasOpenWindows } =
    useChatContext();
  const [chatVisible, setChatVisible] = useState(
    () => world.prefs?.chatVisible ?? true,
  );
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );
  const [inventory, setInventory] = useState<InventorySlotItem[]>([]);

  // Shared handler for ActionPanel item moves
  const handleItemMove = useCallback(
    (fromSlot: number, toSlot: number) => {
      world?.network?.send?.("moveItem", { fromSlot, toSlot });
    },
    [world],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setIsMobileLayout(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const onToggle = () => {
      setActive(!active);
      if (!active) {
        setCollapsed(false);
      }
    };
    world.on(EventType.UI_SIDEBAR_CHAT_TOGGLE, onToggle);
    return () => {
      world.off(EventType.UI_SIDEBAR_CHAT_TOGGLE, onToggle);
    };
  }, [active, setActive, setCollapsed, world]);

  useEffect(() => {
    const onPrefsChange = (changes: { chatVisible?: { value: boolean } }) => {
      if (changes.chatVisible !== undefined) {
        setChatVisible(changes.chatVisible.value);
      }
    };
    world.prefs?.on?.("change", onPrefsChange);
    return () => {
      world.prefs?.off?.("change", onPrefsChange);
    };
  }, [world]);

  useEffect(() => {
    const localPlayerId = world.entities?.player?.id;
    const onInventory = (raw: unknown) => {
      const data = raw as {
        items: InventorySlotItem[];
        playerId: string;
        coins: number;
      };
      // Only update if this inventory belongs to the local player (prevents cross-tab updates)
      if (localPlayerId && data.playerId && data.playerId !== localPlayerId) {
        return;
      }

      const nextItems = Array.isArray(data.items) ? data.items : [];
      setInventory((currentItems) =>
        isInventoryEqual(currentItems, nextItems) ? currentItems : nextItems,
      );
    };
    world.on(EventType.INVENTORY_UPDATED, onInventory);

    // Request initial inventory data using the client-side cache/bootstrap pattern
    const requestInitial = () => {
      // For spectator/embedded mode, use characterId from config
      let playerId = world.entities?.player?.id;
      if (!playerId) {
        const embeddedConfig = getEmbeddedConfig();
        if (embeddedConfig?.characterId) {
          playerId = embeddedConfig.characterId;
        }
      }
      if (playerId) {
        // Check cached inventory first for instant load
        const cached = world.network?.lastInventoryByPlayerId?.[playerId];
        if (cached && Array.isArray(cached.items)) {
          setInventory((currentItems) =>
            isInventoryEqual(currentItems, cached.items)
              ? currentItems
              : cached.items,
          );
        }
        // Request fresh data from server
        world.emit(EventType.INVENTORY_REQUEST, { playerId });
        return true;
      }
      return false;
    };

    // Try immediately, retry after delay if player not ready
    let timeoutId: number | null = null;
    if (!requestInitial()) {
      timeoutId = window.setTimeout(() => requestInitial(), 400);
    }

    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      world.off(EventType.INVENTORY_UPDATED, onInventory);
    };
  }, [world]);

  useEffect(() => {
    const control = world.controls?.bind?.({
      priority: ControlPriorities.CORE_UI,
    }) as ControlBinding | undefined;
    if (!control) return;
    if (control.slash) {
      control.slash.onPress = () => {
        if (!active) {
          setActive(true);
          setCollapsed(false);
        }
      };
    }
    if (control.enter) {
      control.enter.onPress = () => {
        if (!active) {
          setActive(true);
          setCollapsed(false);
        }
      };
    }
    if (control.mouseLeft) {
      control.mouseLeft.onPress = () => {
        if (control.pointer?.locked && active) {
          setActive(false);
        }
      };
    }
    return () => control?.release?.();
  }, [active, setActive, setCollapsed, world]);

  useEffect(() => {
    if (active && inputRef.current) {
      inputRef.current.focus();
    } else if (inputRef.current) {
      inputRef.current.blur();
    }
  }, [active]);

  const send = async (
    e: React.KeyboardEvent | React.MouseEvent | KeyboardEvent | MouseEvent,
  ) => {
    if (world.controls?.pointer?.locked) {
      setTimeout(() => setActive(false), 10);
    }
    if (!msg) {
      e.preventDefault();
      return setActive(false);
    }
    setMsg("");
    if (msg.startsWith("/")) {
      world.chat.command(msg);
      return;
    }
    world.chat.send(msg);
    if (isTouch) {
      if (e.target && e.target instanceof HTMLElement) {
        e.target.blur();
      }
      setTimeout(() => setActive(false), 10);
    }
  };

  const panelWidth = isTouch ? 386 : 550; // Desktop: clearly extends past action panel
  const dividerGradient =
    "linear-gradient(90deg, rgba(242,208,138,0), rgba(242,208,138,0.4) 14%, rgba(255,215,128,0.95) 50%, rgba(242,208,138,0.4) 86%, rgba(242,208,138,0))";

  const basePanelStyle: React.CSSProperties = {
    background: GRADIENTS.PANEL,
    border: "2px solid rgba(139, 69, 19, 0.6)",
    borderRadius: 0,
    padding: isTouch
      ? "0.5rem 0.85rem 0.25rem 0.25rem"
      : "0.6rem 1.1rem 0.3rem 0.3rem",
    boxShadow:
      "0 8px 32px rgba(0, 0, 0, 0.8), 0 4px 16px rgba(139, 69, 19, 0.4), inset 0 1px 0 rgba(242, 208, 138, 0.15), inset 0 -2px 0 rgba(0, 0, 0, 0.6)",
    backdropFilter: "blur(12px)",
    color: "rgba(232, 235, 244, 0.92)",
    display: "flex",
    flexDirection: "column",
    gap: isTouch ? "0.25rem" : "0.3rem",
    pointerEvents: "auto",
  };
  const goldLineStyle: React.CSSProperties = {
    width: "100%",
    height: 1,
    background: dividerGradient,
    opacity: 0.95,
  };
  const narrowGoldLineStyle: React.CSSProperties = {
    width: "80%",
    height: 1,
    background: dividerGradient,
    opacity: 0.95,
    margin: "0 auto",
  };
  const desktopPanelStyle: React.CSSProperties = {
    ...basePanelStyle,
    width: panelWidth,
    maxWidth: "min(96vw, 760px)",
    borderTopRightRadius: "12px",
    borderTop: "2px solid rgba(139, 69, 19, 0.6)",
    borderRight: "2px solid rgba(139, 69, 19, 0.6)",
    borderBottom: "none", // Flush with bottom of screen
    borderLeft: "none", // Flush with left of screen
    // Override box-shadow to remove the inset bottom shadow
    boxShadow:
      "0 -4px 16px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(139, 69, 19, 0.3), inset 0 1px 0 rgba(242, 208, 138, 0.15)",
  };
  const mobilePanelStyle: React.CSSProperties = {
    ...basePanelStyle,
    width: "100%",
    maxWidth: "100%",
  };

  // Build button style from base + theme color
  const chatButtonStyle: React.CSSProperties = {
    ...CHAT_BUTTON_BASE_STYLE,
    color: theme.colors.accent.primary,
    border: `2px solid ${theme.colors.border.decorative}`,
  };

  const closeButtonStyle: React.CSSProperties = {
    width: isTouch ? 24 : 28,
    height: isTouch ? 24 : 28,
    borderRadius: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    color: theme.colors.accent.primary,
    boxShadow: "none",
    cursor: "pointer",
    flexShrink: 0,
  };

  const inactiveInputStyle: React.CSSProperties = {
    width: "100%",
    padding: isTouch ? "0.35rem 0" : "0.4rem 0",
    borderRadius: 0,
    border: "none",
    borderBottom: "1px solid rgba(247,217,140,0.55)",
    background: "transparent",
    color: "rgba(232, 235, 244, 0.75)",
    fontSize: isTouch ? "0.72rem" : "0.8rem",
    letterSpacing: "0.02em",
    fontFamily: "'Inter', system-ui, sans-serif",
    textAlign: "left",
  };

  const inputContainerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    borderBottom: "1px solid rgba(247,217,140,0.55)",
    padding: isTouch ? "0.35rem 0" : "0.4rem 0",
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "rgba(232, 235, 244, 0.96)",
    fontSize: isTouch ? "0.74rem" : "0.86rem",
    letterSpacing: "0.02em",
  };

  const placementStyleCollapsed: React.CSSProperties = {
    left: `calc(env(safe-area-inset-left) + 24px)`,
    bottom: `calc(env(safe-area-inset-bottom) + 24px)`,
  };

  const placementStyleExpanded: React.CSSProperties = {
    left: 0,
    bottom: 0,
  };

  const tabs = ["Global", "Local", "Group"] as const;

  const updateMobileOffset = useCallback(
    (newCollapsed?: boolean) => {
      if (typeof document === "undefined") return;
      if (!isMobileLayout) {
        document.documentElement.style.setProperty(
          "--mobile-chat-offset",
          "0px",
        );
        return;
      }
      const isCollapsed = newCollapsed !== undefined ? newCollapsed : collapsed;
      if (!isCollapsed && chatPanelRef.current) {
        const height = chatPanelRef.current.offsetHeight;
        document.documentElement.style.setProperty(
          "--mobile-chat-offset",
          `${height}px`,
        );
      } else {
        document.documentElement.style.setProperty(
          "--mobile-chat-offset",
          "0px",
        );
      }
    },
    [collapsed, isMobileLayout],
  );

  useEffect(() => {
    updateMobileOffset();
  }, [updateMobileOffset, active, collapsed]);

  useEffect(() => {
    if (!isMobileLayout || typeof ResizeObserver === "undefined") return;
    const node = chatPanelRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => updateMobileOffset());
    observer.observe(node);
    return () => observer.disconnect();
  }, [isMobileLayout, updateMobileOffset]);

  useEffect(() => {
    return () => {
      if (typeof document !== "undefined") {
        document.documentElement.style.removeProperty("--mobile-chat-offset");
      }
    };
  }, []);

  const renderTabs = (fontSize: string) => (
    <div
      className="flex items-center gap-6"
      style={{
        fontFamily: CHAT_HEADER_FONT,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        fontSize,
      }}
    >
      {tabs.map((tab, index) => (
        <span
          key={tab}
          style={{
            color:
              index === 0
                ? theme.colors.accent.primary
                : theme.colors.text.muted,
            position: "relative",
            textShadow:
              index === 0
                ? `0 1px 2px rgba(0, 0, 0, 0.8), 0 0 6px ${theme.colors.accent.primary}4d`
                : "0 1px 2px rgba(0, 0, 0, 0.6)",
          }}
        >
          {tab}
          {index === 0 && (
            <span
              style={{
                position: "absolute",
                left: "50%",
                bottom: -2,
                transform: "translateX(-50%)",
                width: "80%",
                height: 1,
                borderRadius: 999,
                background: `linear-gradient(90deg, transparent, ${theme.colors.accent.primary}d9, transparent)`,
                boxShadow: `0 0 4px ${theme.colors.accent.primary}66`,
              }}
            />
          )}
        </span>
      ))}
    </div>
  );

  const renderChatBody = (variant: "desktop" | "mobile") => (
    <>
      <div className="flex items-center justify-between">
        {renderTabs(
          variant === "mobile"
            ? isTouch
              ? "0.64rem"
              : "0.7rem"
            : isTouch
              ? "0.64rem"
              : "0.74rem",
        )}
        <button
          type="button"
          style={closeButtonStyle}
          className="focus:outline-none transition-transform duration-150 hover:scale-[1.05] active:scale-95"
          onClick={() => {
            setCollapsed(true);
            setActive(false);
          }}
          title="Close chat"
        >
          <span
            style={{ fontSize: isTouch ? "0.85rem" : "0.95rem", lineHeight: 1 }}
          >
            ✕
          </span>
        </button>
      </div>
      <div style={goldLineStyle} />
      <div className="relative overflow-hidden">
        <div style={narrowGoldLineStyle} />
        <Messages
          world={world}
          active={active}
          variant={variant}
          style={{
            height: variant === "mobile" ? 110 : isTouch ? 95 : 120,
          }}
        />
        <div style={narrowGoldLineStyle} />
      </div>
      <div className="flex flex-col">
        <div style={goldLineStyle} />
        {!active ? (
          <button
            type="button"
            style={inactiveInputStyle}
            className="text-left text-[rgba(232,235,244,0.7)] transition-colors duration-150 hover:text-[rgba(247,217,140,0.9)] focus:outline-none"
            onClick={() => {
              setActive(true);
              setCollapsed(false);
            }}
          >
            Type in a message...
          </button>
        ) : (
          <label
            style={inputContainerStyle}
            className="cursor-text focus-within:border-b-[rgba(247,217,140,0.75)]"
            onClick={() => inputRef.current?.focus()}
          >
            <input
              ref={inputRef}
              style={inputStyle}
              className="placeholder:text-slate-300/60 selection:bg-slate-200/20 bg-transparent"
              type="text"
              placeholder="Type in a message..."
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.code === "Escape") {
                  setActive(false);
                }
                if (e.code === "Enter" || e.key === "Enter") {
                  send(e);
                }
              }}
              onBlur={(_e) => {
                if (!isTouch || variant === "mobile") {
                  setActive(false);
                }
              }}
            />
          </label>
        )}
      </div>
    </>
  );

  // Desktop chat button - memoized BEFORE mobile check to ensure consistent hook order
  // React requires hooks to be called in the same order on every render
  const desktopChatButton = useMemo(
    () => (
      <button
        type="button"
        style={{
          ...chatButtonStyle,
          padding: "0 10px",
          height: "32px",
          borderRadius: "5px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "5px",
        }}
        className="transition-transform duration-150 hover:scale-[1.03] active:scale-95 focus:outline-none"
        onClick={() => {
          if (collapsed) {
            setCollapsed(false);
            setActive(true);
          } else {
            setCollapsed(true);
            setActive(false);
          }
        }}
      >
        <MessageSquareIcon size={14} />
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: theme.colors.accent.primary,
          }}
        >
          Chat
        </span>
      </button>
    ),
    [collapsed, setCollapsed, setActive, chatButtonStyle],
  );

  if (isMobileLayout) {
    if (collapsed) {
      return (
        <>
          {/* Action Panel - Left aligned, hidden when GameWindows are open */}
          {!hasOpenWindows && (
            <div
              className={cls("fixed pointer-events-none z-[10]", {
                hidden: !chatVisible,
              })}
              style={{
                left: `calc(env(safe-area-inset-left) + 8px)`,
                bottom: `calc(env(safe-area-inset-bottom) + 6px)`,
              }}
            >
              <div className="pointer-events-auto">
                <ActionPanel items={inventory} onItemMove={handleItemMove} />
              </div>
            </div>
          )}

          {/* Chat Button - Right aligned, hidden when GameWindows are open */}
          {!hasOpenWindows && (
            <div
              className={cls("mainchat fixed pointer-events-none z-[90]", {
                hidden: !chatVisible,
              })}
              style={{
                right: `calc(env(safe-area-inset-right) + 8px)`,
                bottom: `calc(env(safe-area-inset-bottom) + 10px)`,
              }}
              onTouchStart={(event) => {
                touchStartYRef.current = event.touches[0].clientY;
              }}
              onTouchEnd={(event) => {
                if (touchStartYRef.current === null) return;
                const delta =
                  event.changedTouches[0].clientY - touchStartYRef.current;
                touchStartYRef.current = null;
                if (delta < -40) {
                  setCollapsed(false);
                  setActive(true);
                  updateMobileOffset(false);
                }
              }}
            >
              <button
                type="button"
                style={{
                  ...chatButtonStyle,
                  padding: "0 14px",
                  height: "36px", // Compact height aligned with action panel
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
                className="pointer-events-auto transition-transform duration-150 hover:scale-[1.04] active:scale-95 focus:outline-none"
                onClick={() => {
                  setCollapsed(false);
                  setActive(true);
                }}
              >
                <MessageSquareIcon size={16} />
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: theme.colors.accent.primary,
                  }}
                >
                  Chat
                </span>
              </button>
            </div>
          )}
        </>
      );
    }

    return (
      <>
        {/* Action Panel - Separate fixed container with low z-index, hidden when GameWindows are open */}
        {!hasOpenWindows && (
          <div
            className="fixed pointer-events-none z-[10]"
            style={{
              left: "clamp(0.5rem, 2vw, 1rem)",
              bottom: `calc(env(safe-area-inset-bottom) + ${chatPanelRef.current?.offsetHeight ?? 200}px + clamp(0.5rem, 1.2vw, 0.625rem))`,
            }}
          >
            <div className="pointer-events-auto">
              <ActionPanel items={inventory} onItemMove={handleItemMove} />
            </div>
          </div>
        )}

        {/* Chat Button - Always visible, positioned above chat panel */}
        {!hasOpenWindows && (
          <div
            className={cls("fixed pointer-events-none z-[961]", {
              hidden: !chatVisible,
            })}
            style={{
              right: `calc(env(safe-area-inset-right) + 8px)`,
              bottom: `calc(env(safe-area-inset-bottom) + ${(chatPanelRef.current?.offsetHeight ?? 200) + 10}px)`,
            }}
          >
            <button
              type="button"
              style={{
                ...chatButtonStyle,
                padding: "0 14px",
                height: "36px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
              className="pointer-events-auto transition-transform duration-150 hover:scale-[1.04] active:scale-95 focus:outline-none"
              onClick={() => {
                setCollapsed(true);
                setActive(false);
                updateMobileOffset(true);
              }}
            >
              <MessageSquareIcon size={16} />
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: theme.colors.accent.primary,
                }}
              >
                Chat
              </span>
            </button>
          </div>
        )}

        {/* Chat Panel */}
        <div
          className={cls(
            "mainchat fixed inset-x-0 pointer-events-none z-[960]",
            { hidden: !chatVisible },
          )}
          style={{ bottom: "env(safe-area-inset-bottom)" }}
          onTouchStart={(event) => {
            touchStartYRef.current = event.touches[0].clientY;
          }}
          onTouchEnd={(event) => {
            if (touchStartYRef.current === null) return;
            const delta =
              event.changedTouches[0].clientY - touchStartYRef.current;
            touchStartYRef.current = null;
            if (delta > 40) {
              setCollapsed(true);
              setActive(false);
              updateMobileOffset(true);
            }
          }}
        >
          <div className="pointer-events-auto">
            <div
              ref={chatPanelRef}
              style={mobilePanelStyle}
              className="w-full transition-transform duration-300 ease-out translate-y-0 opacity-95"
            >
              {renderChatBody("mobile")}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      className={cls(
        "mainchat fixed pointer-events-none",
        collapsed ? "z-[35]" : "z-[960]",
        { hidden: !chatVisible },
      )}
      style={collapsed ? placementStyleCollapsed : placementStyleExpanded}
    >
      {collapsed ? (
        <div
          className="flex items-center pointer-events-auto"
          style={{ gap: "clamp(0.5rem, 1vw, 0.625rem)" }}
        >
          {desktopChatButton}
          <ActionPanel items={inventory} onItemMove={handleItemMove} />
        </div>
      ) : (
        <div className="pointer-events-auto relative z-[10]">
          {/* Chat Button + Action Panel - Absolutely positioned above chat */}
          <div
            className="absolute pointer-events-auto flex items-center"
            style={{
              bottom: "100%",
              marginBottom: "clamp(0.5rem, 1vw, 0.625rem)",
              left: "clamp(0.5rem, 1vw, 0.75rem)",
              gap: "clamp(0.5rem, 1vw, 0.625rem)",
            }}
          >
            {desktopChatButton}
            <ActionPanel items={inventory} onItemMove={handleItemMove} />
          </div>

          {/* Chat Panel */}
          <div style={desktopPanelStyle} className="chat-panel">
            {renderChatBody("desktop")}
          </div>
        </div>
      )}
    </div>
  );
}

function Messages({
  world,
  active,
  variant,
  className,
  style,
}: {
  world: ChatWorld;
  active: boolean;
  variant: "desktop" | "mobile";
  className?: string;
  style?: React.CSSProperties;
}) {
  const initRef = useRef<boolean>(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const [msgs, setMsgs] = useState<unknown[]>([]);

  useEffect(() => {
    const unsubscribe = world.chat.subscribe(setMsgs);
    return () => {
      unsubscribe();
    };
  }, [world]);

  useEffect(() => {
    setTimeout(() => {
      const didInit = initRef.current;
      initRef.current = true;
      contentRef.current?.scroll({
        top: 9_999_999,
        behavior: (didInit ? "instant" : "smooth") as ScrollBehavior,
      });
    }, 10);
  }, [msgs]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const observer = new MutationObserver(() => {
      if (spacerRef.current && contentRef.current) {
        spacerRef.current.style.height = contentRef.current.offsetHeight + "px";
      }
      contentRef.current?.scroll({
        top: 9_999_999,
        behavior: "instant" as ScrollBehavior,
      });
    });
    observer.observe(content, { childList: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={contentRef}
      className={cls(
        "messages noscrollbar relative transition-all duration-150 ease-out flex flex-col items-stretch overflow-y-auto",
        variant === "desktop"
          ? "h-full w-full px-4 py-2 gap-0.5"
          : "w-full px-3.5 py-1.5 gap-0.5",
        className,
      )}
      style={{
        pointerEvents:
          variant === "mobile" ? (active ? "auto" : "none") : "auto",
        ...style,
      }}
    >
      <div className="messages-spacer shrink-0" ref={spacerRef} />
      {msgs.map((msg) => (
        <Message
          key={(msg as ChatMessage & { id: string }).id}
          msg={msg as ChatMessage}
          world={world}
        />
      ))}
    </div>
  );
}

function Message({ msg, world }: { msg: ChatMessage; world: ChatWorld }) {
  const theme = useThemeStore((s) => s.theme);

  // Handle trade request messages (OSRS-style pink display only)
  // Trade accept is handled by ChatPanel - this component just displays the message
  if (msg.type === "trade_request" && msg.tradeId) {
    return (
      <div
        className="message text-[0.75rem] leading-[1.35]"
        style={{
          color: "#FF00FF", // OSRS-style pink/magenta
          fontFamily: "'Inter', system-ui, sans-serif",
          textShadow: "0 1px 2px rgba(0,0,0,0.75)",
        }}
      >
        {msg.body}
      </div>
    );
  }

  // Handle duel challenge messages (red display only)
  // Duel accept is handled by ChatPanel
  if (msg.type === "duel_challenge" && msg.challengeId) {
    return (
      <div
        className="message text-[0.75rem] leading-[1.35]"
        style={{
          color: "#FF4444", // Red for duel challenges
          fontFamily: "'Inter', system-ui, sans-serif",
          textShadow: "0 1px 2px rgba(0,0,0,0.75)",
        }}
      >
        {msg.body}
      </div>
    );
  }

  // Normal chat messages
  return (
    <div
      className="message text-[0.75rem] leading-[1.35]"
      style={{
        color: theme.colors.text.primary,
        fontFamily: "'Inter', system-ui, sans-serif",
        textShadow: "0 1px 2px rgba(0,0,0,0.75)",
      }}
    >
      {msg.from && (
        <span
          className="message-from mr-1.5 uppercase tracking-[0.16em]"
          style={{
            fontFamily: CHAT_HEADER_FONT,
            color: theme.colors.accent.primary,
            fontSize: "0.65rem",
            letterSpacing: "0.18em",
          }}
        >
          [{msg.from}]
        </span>
      )}
      <span className="message-body">{msg.body}</span>
    </div>
  );
}
