/**
 * Chat Component
 * In-game chat interface with multiple channels
 *
 * PERFORMANCE: Style objects are memoized to avoid recreation on each render.
 * Static styles are defined outside the component, dynamic styles use useMemo.
 */

import { MessageSquareIcon } from "lucide-react";
import { COLORS, GRADIENTS } from "../../constants";
import React, { useCallback, useEffect, useRef, useState, useMemo, memo } from "react";

import { ControlPriorities, EventType, isTouch } from "@hyperscape/shared";
import type { ClientWorld, InventorySlotItem } from "../../types";
import { ActionPanel } from "../panels/ActionPanel";
import { cls } from "../../utils/classnames";
import { useChatContext } from "./ChatContext";

const CHAT_HEADER_FONT = "'Inter', system-ui, sans-serif";
const CHAT_ACCENT_COLOR = COLORS.CHAT_ACCENT;

// Local type definitions
interface ChatMessage {
  id: string;
  from: string;
  fromId?: string;
  body: string;
  createdAt: string;
  timestamp?: number;
}

interface ControlBinding {
  slash?: { onPress?: () => void | boolean | null };
  enter?: { onPress?: () => void | boolean | null };
  mouseLeft?: { onPress?: () => void | boolean | null };
  pointer?: { locked?: boolean };
  release?: () => void;
}

// Extended client world type for Chat component
export type ChatWorld = ClientWorld & {
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
    lastInventoryByPlayerId?: Record<
      string,
      { items: InventorySlotItem[]; coins: number }
    >;
  };
};

// Static styles that don't depend on any props
const DIVIDER_GRADIENT =
  "linear-gradient(90deg, rgba(242,208,138,0), rgba(242,208,138,0.4) 14%, rgba(255,215,128,0.95) 50%, rgba(242,208,138,0.4) 86%, rgba(242,208,138,0))";

const GOLD_LINE_STYLE: React.CSSProperties = {
  width: "100%",
  height: 1,
  background: DIVIDER_GRADIENT,
  opacity: 0.95,
};

const NARROW_GOLD_LINE_STYLE: React.CSSProperties = {
  width: "80%",
  height: 1,
  background: DIVIDER_GRADIENT,
  opacity: 0.95,
  margin: "0 auto",
};

const PLACEMENT_STYLE_COLLAPSED: React.CSSProperties = {
  left: `calc(env(safe-area-inset-left) + 24px)`,
  bottom: `calc(env(safe-area-inset-bottom) + 24px)`,
};

const PLACEMENT_STYLE_EXPANDED: React.CSSProperties = {
  left: 0,
  bottom: 0,
};

const INPUT_STYLE_BASE: React.CSSProperties = {
  flex: 1,
  background: "transparent",
  border: "none",
  outline: "none",
  color: "rgba(232, 235, 244, 0.96)",
  letterSpacing: "0.02em",
};

const TAB_UNDERLINE_STYLE: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  bottom: -2,
  transform: "translateX(-50%)",
  width: "80%",
  height: 1,
  borderRadius: 999,
  background:
    "linear-gradient(90deg, transparent, rgba(247,217,140,0.85), transparent)",
  boxShadow: "0 0 4px rgba(242, 208, 138, 0.4)",
};

const MESSAGE_STYLE: React.CSSProperties = {
  color: "rgba(232, 235, 244, 0.92)",
  fontFamily: "'Inter', system-ui, sans-serif",
  textShadow: "0 1px 2px rgba(0,0,0,0.75)",
};

const MESSAGE_FROM_STYLE: React.CSSProperties = {
  fontFamily: CHAT_HEADER_FONT,
  color: CHAT_ACCENT_COLOR,
  fontSize: "0.65rem",
  letterSpacing: "0.18em",
};

const TABS = ["Global", "Local", "Group"] as const;

export function Chat({ world }: { world: ChatWorld }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const chatPanelRef = useRef<HTMLDivElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const [msg, setMsg] = useState("");
  const { active, setActive, collapsed, setCollapsed, hasOpenWindows } =
    useChatContext();
  const [chatVisible, setChatVisible] = useState(
    () => world.prefs?.chatVisible ?? true
  );
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  const [inventory, setInventory] = useState<InventorySlotItem[]>([]);

  // Memoize styles that depend on isTouch
  const styles = useMemo(() => {
    const panelWidth = isTouch ? 386 : 720;

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

    return {
      desktopPanel: {
        ...basePanelStyle,
        width: panelWidth,
        maxWidth: "min(96vw, 760px)",
        borderTopRightRadius: "12px",
        borderTop: "2px solid rgba(139, 69, 19, 0.6)",
        borderRight: "2px solid rgba(139, 69, 19, 0.6)",
      } as React.CSSProperties,

      mobilePanel: {
        ...basePanelStyle,
        width: "100%",
        maxWidth: "100%",
      } as React.CSSProperties,

      chatButton: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.6rem",
        background:
          "linear-gradient(135deg, rgba(30, 20, 10, 0.9) 0%, rgba(20, 15, 10, 0.95) 100%)",
        border: "2px solid rgba(139, 69, 19, 0.7)",
        borderRadius: 9999,
        padding: isTouch ? "0.55rem 1.2rem" : "0.65rem 1.4rem",
        color: CHAT_ACCENT_COLOR,
        fontFamily: CHAT_HEADER_FONT,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        fontSize: isTouch ? "0.68rem" : "0.76rem",
        boxShadow:
          "0 4px 12px rgba(0, 0, 0, 0.7), 0 2px 6px rgba(139, 69, 19, 0.4), inset 0 1px 0 rgba(242, 208, 138, 0.2), inset 0 -1px 0 rgba(0, 0, 0, 0.5)",
        textShadow:
          "0 1px 2px rgba(0, 0, 0, 0.8), 0 0 6px rgba(242, 208, 138, 0.3)",
        pointerEvents: "auto",
      } as React.CSSProperties,

      closeButton: {
        width: isTouch ? 24 : 28,
        height: isTouch ? 24 : 28,
        borderRadius: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        color: CHAT_ACCENT_COLOR,
        boxShadow: "none",
        cursor: "pointer",
        flexShrink: 0,
      } as React.CSSProperties,

      inactiveInput: {
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
      } as React.CSSProperties,

      inputContainer: {
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        borderBottom: "1px solid rgba(247,217,140,0.55)",
        padding: isTouch ? "0.35rem 0" : "0.4rem 0",
      } as React.CSSProperties,

      input: {
        ...INPUT_STYLE_BASE,
        fontSize: isTouch ? "0.74rem" : "0.86rem",
      } as React.CSSProperties,

      closeIconFontSize: isTouch ? "0.85rem" : "0.95rem",
      chatButtonPadding: isTouch ? "0.65rem" : "0.75rem",
      iconSize: isTouch ? 20 : 24,
    };
  }, []); // isTouch is a constant, so empty deps is fine

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
    const onInventory = (raw: unknown) => {
      const data = raw as {
        items: InventorySlotItem[];
        playerId: string;
        coins: number;
      };
      setInventory(data.items);
    };
    world.on(EventType.INVENTORY_UPDATED, onInventory);

    const requestInitial = () => {
      const playerId = world.entities?.player?.id;
      if (playerId) {
        const cached = world.network?.lastInventoryByPlayerId?.[playerId];
        if (cached && Array.isArray(cached.items)) {
          setInventory(cached.items);
        }
        world.emit(EventType.INVENTORY_REQUEST, { playerId });
        return true;
      }
      return false;
    };

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

  const send = useCallback(
    async (
      e: React.KeyboardEvent | React.MouseEvent | KeyboardEvent | MouseEvent
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
    },
    [msg, setActive, world]
  );

  const updateMobileOffset = useCallback(
    (newCollapsed?: boolean) => {
      if (typeof document === "undefined") return;
      if (!isMobileLayout) {
        document.documentElement.style.setProperty(
          "--mobile-chat-offset",
          "0px"
        );
        return;
      }
      const isCollapsedState =
        newCollapsed !== undefined ? newCollapsed : collapsed;
      if (!isCollapsedState && chatPanelRef.current) {
        const height = chatPanelRef.current.offsetHeight;
        document.documentElement.style.setProperty(
          "--mobile-chat-offset",
          `${height}px`
        );
      } else {
        document.documentElement.style.setProperty(
          "--mobile-chat-offset",
          "0px"
        );
      }
    },
    [collapsed, isMobileLayout]
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

  // Memoize tab header styles
  const tabHeaderStyles = useMemo(
    () => ({
      container: {
        fontFamily: CHAT_HEADER_FONT,
        letterSpacing: "0.16em",
        textTransform: "uppercase" as const,
      },
      activeTab: {
        color: CHAT_ACCENT_COLOR,
        position: "relative" as const,
        textShadow:
          "0 1px 2px rgba(0, 0, 0, 0.8), 0 0 6px rgba(242, 208, 138, 0.3)",
      },
      inactiveTab: {
        color: "rgba(205, 212, 230, 0.5)",
        position: "relative" as const,
        textShadow: "0 1px 2px rgba(0, 0, 0, 0.6)",
      },
    }),
    []
  );

  const renderTabs = useCallback(
    (fontSize: string) => (
      <div
        className="flex items-center gap-6"
        style={{ ...tabHeaderStyles.container, fontSize }}
      >
        {TABS.map((tab, index) => (
          <span
            key={tab}
            style={index === 0 ? tabHeaderStyles.activeTab : tabHeaderStyles.inactiveTab}
          >
            {tab}
            {index === 0 && <span style={TAB_UNDERLINE_STYLE} />}
          </span>
        ))}
      </div>
    ),
    [tabHeaderStyles]
  );

  const handleCloseClick = useCallback(() => {
    setCollapsed(true);
    setActive(false);
  }, [setCollapsed, setActive]);

  const handleOpenClick = useCallback(() => {
    setActive(true);
    setCollapsed(false);
  }, [setActive, setCollapsed]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.code === "Escape") {
        setActive(false);
      }
      if (e.code === "Enter" || e.key === "Enter") {
        send(e);
      }
    },
    [send, setActive]
  );

  const handleInputBlur = useCallback(() => {
    if (!isTouch || isMobileLayout) {
      setActive(false);
    }
  }, [setActive, isMobileLayout]);

  const handleInputClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // Memoize message height styles
  const messageHeights = useMemo(
    () => ({
      mobile: 110,
      desktopTouch: 95,
      desktop: 120,
    }),
    []
  );

  const renderChatBody = useCallback(
    (variant: "desktop" | "mobile") => {
      const fontSize =
        variant === "mobile"
          ? isTouch
            ? "0.64rem"
            : "0.7rem"
          : isTouch
            ? "0.64rem"
            : "0.74rem";

      const messageHeight =
        variant === "mobile"
          ? messageHeights.mobile
          : isTouch
            ? messageHeights.desktopTouch
            : messageHeights.desktop;

      return (
        <>
          <div className="flex items-center justify-between">
            {renderTabs(fontSize)}
            <button
              type="button"
              style={styles.closeButton}
              className="focus:outline-none transition-transform duration-150 hover:scale-[1.05] active:scale-95"
              onClick={handleCloseClick}
              title="Close chat"
            >
              <span style={{ fontSize: styles.closeIconFontSize, lineHeight: 1 }}>
                ✕
              </span>
            </button>
          </div>
          <div style={GOLD_LINE_STYLE} />
          <div className="relative overflow-hidden">
            <div style={NARROW_GOLD_LINE_STYLE} />
            <Messages
              world={world}
              active={active}
              variant={variant}
              style={{ height: messageHeight }}
            />
            <div style={NARROW_GOLD_LINE_STYLE} />
          </div>
          <div className="flex flex-col">
            <div style={GOLD_LINE_STYLE} />
            {!active ? (
              <button
                type="button"
                style={styles.inactiveInput}
                className="text-left text-[rgba(232,235,244,0.7)] transition-colors duration-150 hover:text-[rgba(247,217,140,0.9)] focus:outline-none"
                onClick={handleOpenClick}
              >
                Type in a message...
              </button>
            ) : (
              <label
                style={styles.inputContainer}
                className="cursor-text focus-within:border-b-[rgba(247,217,140,0.75)]"
                onClick={handleInputClick}
              >
                <input
                  ref={inputRef}
                  style={styles.input}
                  className="placeholder:text-slate-300/60 selection:bg-slate-200/20 bg-transparent"
                  type="text"
                  placeholder="Type in a message..."
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleInputBlur}
                />
              </label>
            )}
          </div>
        </>
      );
    },
    [
      active,
      handleCloseClick,
      handleInputBlur,
      handleInputClick,
      handleKeyDown,
      handleOpenClick,
      messageHeights,
      msg,
      renderTabs,
      styles,
      world,
    ]
  );

  // Mobile collapsed button style (combines base + overrides)
  const mobileCollapsedButtonStyle = useMemo(
    () => ({
      ...styles.chatButton,
      padding: "0.65rem",
      borderRadius: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }),
    [styles.chatButton]
  );

  // Desktop collapsed button style
  const desktopCollapsedButtonStyle = useMemo(
    () => ({
      ...styles.chatButton,
      padding: styles.chatButtonPadding,
    }),
    [styles.chatButton, styles.chatButtonPadding]
  );

  // Touch handlers for mobile swipe
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    touchStartYRef.current = event.touches[0].clientY;
  }, []);

  const handleSwipeUp = useCallback(
    (event: React.TouchEvent) => {
      if (touchStartYRef.current === null) return;
      const delta = event.changedTouches[0].clientY - touchStartYRef.current;
      touchStartYRef.current = null;
      if (delta < -40) {
        setCollapsed(false);
        setActive(true);
        updateMobileOffset(false);
      }
    },
    [setActive, setCollapsed, updateMobileOffset]
  );

  const handleSwipeDown = useCallback(
    (event: React.TouchEvent) => {
      if (touchStartYRef.current === null) return;
      const delta = event.changedTouches[0].clientY - touchStartYRef.current;
      touchStartYRef.current = null;
      if (delta > 40) {
        setCollapsed(true);
        setActive(false);
        updateMobileOffset(true);
      }
    },
    [setActive, setCollapsed, updateMobileOffset]
  );

  const openChat = useCallback(() => {
    setCollapsed(false);
    setActive(true);
  }, [setActive, setCollapsed]);

  // Mobile layout positioning styles (these reference dynamic values)
  const mobileActionPanelStyle = useMemo(
    () => ({
      left: `calc(env(safe-area-inset-left) + 16px)`,
      bottom: `calc(env(safe-area-inset-bottom) + 16px)`,
    }),
    []
  );

  const mobileChatButtonStyle = useMemo(
    () => ({
      right: `calc(env(safe-area-inset-right) + 16px)`,
      bottom: `calc(env(safe-area-inset-bottom) + 16px)`,
    }),
    []
  );

  // This style depends on chat panel height which is a DOM measurement
  // We intentionally use the ref value directly here
  const mobileExpandedActionPanelStyle = useMemo(
    () => ({
      left: "clamp(0.5rem, 2vw, 1rem)",
      bottom: `calc(env(safe-area-inset-bottom) + ${chatPanelRef.current?.offsetHeight ?? 200}px + clamp(0.5rem, 1.2vw, 0.625rem))`,
    }),
    [collapsed, active] // Re-calculate when chat visibility changes
  );

  if (isMobileLayout) {
    if (collapsed) {
      return (
        <>
          {!hasOpenWindows && (
            <div
              className={cls("fixed pointer-events-none z-[10]", {
                hidden: !chatVisible,
              })}
              style={mobileActionPanelStyle}
            >
              <div className="pointer-events-auto">
                <ActionPanel items={inventory} />
              </div>
            </div>
          )}

          {!hasOpenWindows && (
            <div
              className={cls("mainchat fixed pointer-events-none z-[90]", {
                hidden: !chatVisible,
              })}
              style={mobileChatButtonStyle}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleSwipeUp}
            >
              <button
                type="button"
                style={mobileCollapsedButtonStyle}
                className="pointer-events-auto transition-transform duration-150 hover:scale-[1.04] active:scale-95 focus:outline-none"
                onClick={openChat}
              >
                <MessageSquareIcon size={20} />
              </button>
            </div>
          )}
        </>
      );
    }

    return (
      <>
        {!hasOpenWindows && (
          <div
            className="fixed pointer-events-none z-[10]"
            style={mobileExpandedActionPanelStyle}
          >
            <div className="pointer-events-auto">
              <ActionPanel items={inventory} />
            </div>
          </div>
        )}

        <div
          className={cls(
            "mainchat fixed inset-x-0 pointer-events-none z-[960]",
            { hidden: !chatVisible }
          )}
          style={{ bottom: "env(safe-area-inset-bottom)" }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleSwipeDown}
        >
          <div className="pointer-events-auto">
            <div
              ref={chatPanelRef}
              style={styles.mobilePanel}
              className="w-full transition-transform duration-300 ease-out translate-y-0 opacity-95"
            >
              {renderChatBody("mobile")}
            </div>
          </div>
        </div>
      </>
    );
  }

  // Desktop layout
  return (
    <div
      className={cls(
        "mainchat fixed pointer-events-none",
        collapsed ? "z-[35]" : "z-[960]",
        { hidden: !chatVisible }
      )}
      style={collapsed ? PLACEMENT_STYLE_COLLAPSED : PLACEMENT_STYLE_EXPANDED}
    >
      {collapsed ? (
        <div
          className="flex items-center pointer-events-auto"
          style={{ gap: "clamp(0.5rem, 1vw, 0.625rem)" }}
        >
          <button
            type="button"
            style={desktopCollapsedButtonStyle}
            className="transition-transform duration-150 hover:scale-[1.03] active:scale-95 focus:outline-none"
            onClick={openChat}
          >
            <MessageSquareIcon size={styles.iconSize} />
          </button>
          <ActionPanel items={inventory} />
        </div>
      ) : (
        <div className="pointer-events-auto relative z-[10]">
          <div
            className="absolute pointer-events-auto"
            style={{
              bottom: "100%",
              marginBottom: "clamp(0.5rem, 1vw, 0.625rem)",
              left: "clamp(0.5rem, 1vw, 0.75rem)",
            }}
          >
            <ActionPanel items={inventory} />
          </div>

          <div style={styles.desktopPanel} className="chat-panel">
            {renderChatBody("desktop")}
          </div>
        </div>
      )}
    </div>
  );
}

// Memoized Messages component
const Messages = memo(function Messages({
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
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);

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

  const containerStyle = useMemo(
    (): React.CSSProperties => ({
      pointerEvents:
        variant === "mobile" ? (active ? "auto" : "none") : "auto",
      ...style,
    }),
    [variant, active, style]
  );

  return (
    <div
      ref={contentRef}
      className={cls(
        "messages noscrollbar relative transition-all duration-150 ease-out flex flex-col items-stretch overflow-y-auto",
        variant === "desktop"
          ? "h-full w-full px-4 py-2 gap-0.5"
          : "w-full px-3.5 py-1.5 gap-0.5",
        className
      )}
      style={containerStyle}
    >
      <div className="messages-spacer shrink-0" ref={spacerRef} />
      {msgs.map((msg) => (
        <Message key={msg.id} msg={msg} />
      ))}
    </div>
  );
});

// Memoized Message component
const Message = memo(function Message({ msg }: { msg: ChatMessage }) {
  return (
    <div className="message text-[0.75rem] leading-[1.35]" style={MESSAGE_STYLE}>
      {msg.from && (
        <span
          className="message-from mr-1.5 uppercase tracking-[0.16em]"
          style={MESSAGE_FROM_STYLE}
        >
          [{msg.from}]
        </span>
      )}
      <span className="message-body">{msg.body}</span>
    </div>
  );
});
