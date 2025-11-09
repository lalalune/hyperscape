import React, { useRef, useState, useEffect } from "react";
import { DraggableWindow } from "../DraggableWindow";
import { windowManager } from "../../utils/responsiveWindowManager";
import { useChatContext } from "../ChatContext";

interface GameWindowProps {
  title: string;
  onClose: () => void;
  defaultX?: number;
  defaultY?: number;
  windowId?: string;
  children: React.ReactNode;
  fitContent?: boolean;
  zIndex?: number;
  onFocus?: () => void;
}

export function GameWindow({
  title,
  onClose,
  defaultX,
  defaultY,
  windowId = "default",
  children,
  fitContent = false,
  zIndex = 1000,
  onFocus,
}: GameWindowProps) {
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(windowManager.isMobile());
  const [isTablet, setIsTablet] = useState(windowManager.isTablet());
  const [showBackdrop, setShowBackdrop] = useState(false);
  const { collapsed } = useChatContext();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(windowManager.isMobile());
      setIsTablet(windowManager.isTablet());
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    // Show backdrop on mobile when window opens
    if (isMobile) {
      setShowBackdrop(true);
    }
  }, [isMobile]);

  // Calculate responsive position
  const position = windowManager.getWindowPosition(windowId);
  const finalX = defaultX !== undefined ? defaultX : position.x;
  const finalY = defaultY !== undefined ? defaultY : position.y;

  // Get responsive dimensions
  const dimensions = windowManager.getWindowDimensions();
  const maxWidth = windowManager.getMaxWindowWidth();
  const minWidth = windowManager.getMinWindowWidth();

  // Mobile: bottom sheet style with backdrop
  if (isMobile) {
    return (
      <>
        {/* Mobile backdrop */}
        {showBackdrop && (
          <div
            className="fixed inset-0 bg-black/50 pointer-events-auto z-[999] transition-opacity duration-300"
            onClick={onClose}
            style={{ opacity: showBackdrop ? 1 : 0 }}
          />
        )}

        {/* Mobile bottom sheet */}
        <div
          className="fixed left-0 right-0 border-t pointer-events-auto animate-slideUp"
          style={{
            background:
              "linear-gradient(180deg, rgba(20, 15, 10, 0.75) 0%, rgba(15, 10, 5, 0.85) 100%)",
            backdropFilter: "blur(12px)",
            borderTop: "2px solid rgba(139, 69, 19, 0.6)",
            borderLeft: "1px solid rgba(139, 69, 19, 0.3)",
            borderRight: "1px solid rgba(139, 69, 19, 0.3)",
            borderRadius: "16px 16px 0 0",
            boxShadow:
              "0 -10px 30px rgba(0, 0, 0, 0.7), 0 -2px 12px rgba(139, 69, 19, 0.3), inset 0 1px 0 rgba(242, 208, 138, 0.1), inset 0 -1px 0 rgba(0, 0, 0, 0.5)",
            maxHeight:
              "min(33vh, calc(100vh - var(--mobile-chat-offset, 0px) - 100px))",
            bottom: collapsed ? 0 : "var(--mobile-chat-offset, 0px)",
            paddingBottom: collapsed
              ? "calc(var(--mobile-chat-offset, 0px) + env(safe-area-inset-bottom))"
              : "env(safe-area-inset-bottom)",
            zIndex: zIndex,
          }}
          onClick={onFocus}
        >
          <style>{`
            @keyframes slideUp {
              from {
                transform: translateY(100%);
              }
              to {
                transform: translateY(0);
              }
            }
            .animate-slideUp {
              animation: slideUp 0.3s ease-out;
            }
          `}</style>

          {/* Header with drag handle */}
          <div
            className="border-b pt-1 pb-1.5 px-2.5 select-none"
            style={{
              background:
                "linear-gradient(180deg, rgba(30, 20, 10, 0.8) 0%, rgba(20, 15, 10, 0.6) 100%)",
              borderBottom: "1px solid rgba(139, 69, 19, 0.5)",
              boxShadow:
                "inset 0 1px 0 rgba(242, 208, 138, 0.15), inset 0 -1px 0 rgba(0, 0, 0, 0.5)",
              borderTopLeftRadius: "16px",
              borderTopRightRadius: "16px",
            }}
          >
            {/* Drag handle indicator */}
            <div className="flex justify-center mb-1">
              <div
                className="w-8 h-0.5 rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(242, 208, 138, 0.6), transparent)",
                  boxShadow: "0 0 6px rgba(242, 208, 138, 0.4)",
                }}
              />
            </div>

            {/* Title and close button */}
            <div className="flex items-center justify-between">
              <div
                className="font-semibold text-sm tracking-wider"
                style={{
                  color: "#f2d08a",
                  textShadow:
                    "0 1px 2px rgba(0, 0, 0, 0.8), 0 0 8px rgba(242, 208, 138, 0.3)",
                  fontFamily: "'Cinzel', serif",
                }}
              >
                {title}
              </div>
              <button
                onClick={onClose}
                className="border rounded-md w-6 h-6 cursor-pointer flex items-center justify-center text-xs font-bold touch-manipulation transition-all duration-150"
                style={{
                  WebkitTapHighlightColor: "transparent",
                  background:
                    "linear-gradient(135deg, rgba(139, 69, 19, 0.9) 0%, rgba(101, 50, 15, 0.95) 100%)",
                  border: "1px solid rgba(242, 208, 138, 0.4)",
                  color: "#f2d08a",
                  boxShadow:
                    "0 2px 4px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(242, 208, 138, 0.2)",
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content */}
          <div
            className="p-2.5 overflow-y-auto"
            style={{
              maxHeight:
                "calc(min(33vh, calc(100vh - var(--mobile-chat-offset, 0px) - 100px)) - 50px)",
            }}
          >
            {children}
          </div>
        </div>
      </>
    );
  }

  // Tablet & Desktop: draggable window with localStorage persistence for position
  const initialHeight =
    typeof dimensions.maxHeight === "string"
      ? parseInt(dimensions.maxHeight) || 500
      : dimensions.maxHeight;

  // Uniform sizes for specific windows with safeguards
  const getWindowSize = () => {
    // Ensure windows fit on screen with margins
    const safeWidth = window.innerWidth - 80; // 40px margin on each side
    const safeHeight = window.innerHeight - 160; // 80px margin top and bottom
    const maxWindowHeight = Math.min(safeHeight, 700);

    // Standard window sizes - uniform height of 550px for consistency
    const standardSizes: Record<string, { width: number; height: number }> = {
      account: { width: 380, height: Math.min(550, maxWindowHeight) },
      inventory: { width: 450, height: Math.min(550, maxWindowHeight) },
      equipment: { width: 500, height: Math.min(550, maxWindowHeight) },
      combat: { width: 450, height: Math.min(550, maxWindowHeight) },
      skills: { width: 450, height: Math.min(550, maxWindowHeight) },
      prefs: { width: 380, height: Math.min(550, maxWindowHeight) },
      settings: { width: 380, height: Math.min(550, maxWindowHeight) },
      dashboard: { width: 600, height: Math.min(420, maxWindowHeight) },
    };

    // Get size for this window
    const size = standardSizes[windowId];
    if (size) {
      return {
        width: Math.min(size.width, safeWidth),
        height: Math.min(size.height, safeHeight),
      };
    }

    // Fallback for unknown windows
    return {
      width: fitContent
        ? Math.min(400, safeWidth)
        : isTablet
          ? Math.min(window.innerWidth * 0.9, maxWidth)
          : Math.min(dimensions.width, safeWidth),
      height: Math.min(initialHeight, safeHeight),
    };
  };

  const windowSize = getWindowSize();

  return (
    <DraggableWindow
      windowId={windowId}
      initialPosition={{ x: finalX, y: finalY }}
      onFocus={onFocus}
      dragHandle={
        <div
          ref={dragHandleRef}
          className="border-b py-2.5 px-3 flex items-center justify-between cursor-grab select-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(30, 20, 10, 0.9) 0%, rgba(20, 15, 10, 0.7) 100%)",
            borderBottom: "2px solid rgba(139, 69, 19, 0.6)",
            borderTopLeftRadius: "12px",
            borderTopRightRadius: "12px",
            boxShadow:
              "inset 0 1px 0 rgba(242, 208, 138, 0.2), inset 0 -1px 0 rgba(0, 0, 0, 0.6)",
          }}
        >
          <div
            className="font-semibold text-sm tracking-wider"
            style={{
              color: "#f2d08a",
              textShadow:
                "0 1px 2px rgba(0, 0, 0, 0.8), 0 0 6px rgba(242, 208, 138, 0.3)",
              fontFamily: "'Cinzel', serif",
            }}
          >
            {title}
          </div>
          <button
            onClick={onClose}
            className="border rounded-md w-6 h-6 cursor-pointer flex items-center justify-center text-sm font-bold touch-manipulation transition-all duration-150 hover:scale-105 active:scale-95"
            style={{
              WebkitTapHighlightColor: "transparent",
              background:
                "linear-gradient(135deg, rgba(139, 69, 19, 0.9) 0%, rgba(101, 50, 15, 0.95) 100%)",
              border: "1px solid rgba(242, 208, 138, 0.4)",
              color: "#f2d08a",
              boxShadow:
                "0 2px 4px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(242, 208, 138, 0.2)",
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
            }}
          >
            ✕
          </button>
        </div>
      }
      className="pointer-events-auto"
      style={{
        background:
          "linear-gradient(135deg, rgba(20, 15, 10, 0.75) 0%, rgba(15, 10, 5, 0.85) 50%, rgba(20, 15, 10, 0.75) 100%)",
        backdropFilter: "blur(12px)",
        border: "2px solid rgba(139, 69, 19, 0.6)",
        borderRadius: "12px",
        boxShadow:
          "0 8px 32px rgba(0, 0, 0, 0.8), 0 4px 16px rgba(139, 69, 19, 0.4), inset 0 1px 0 rgba(242, 208, 138, 0.15), inset 0 -2px 0 rgba(0, 0, 0, 0.6)",
        display: fitContent ? ("inline-block" as const) : "flex",
        flexDirection: "column",
        width: windowSize.width,
        height: windowSize.height,
        zIndex: zIndex,
      }}
    >
      <div
        className={
          fitContent
            ? "p-3 overflow-y-auto flex flex-col flex-1"
            : "p-3 overflow-y-auto flex-1"
        }
      >
        {children}
      </div>
    </DraggableWindow>
  );
}
