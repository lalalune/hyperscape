/**
 * Action Panel - Quick access to inventory items
 * Shows first N items from inventory with pagination
 * Desktop: 6 slots, Mobile: 4 slots
 */

import React, { useState } from "react";
import type { InventorySlotItem } from "../types";

interface ActionPanelProps {
  items: InventorySlotItem[];
  onItemUse?: (item: InventorySlotItem, index: number) => void;
}

export function ActionPanel({ items, onItemUse }: ActionPanelProps) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [currentPage, setCurrentPage] = useState(0);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const slotsPerPage = 6;
  const totalPages = Math.ceil(items.length / slotsPerPage);
  const startIndex = currentPage * slotsPerPage;
  const visibleItems = items.slice(startIndex, startIndex + slotsPerPage);

  // Fill empty slots to maintain consistent size
  const slots = [...visibleItems];
  while (slots.length < slotsPerPage) {
    slots.push(null);
  }

  const handlePrevious = () => {
    setCurrentPage(Math.max(0, currentPage - 1));
  };

  const handleNext = () => {
    setCurrentPage(Math.min(totalPages - 1, currentPage + 1));
  };

  const getItemIcon = (itemId: string) => {
    if (
      itemId.includes("sword") ||
      itemId.includes("dagger") ||
      itemId.includes("scimitar")
    )
      return "⚔️";
    if (itemId.includes("shield") || itemId.includes("defender")) return "🛡️";
    if (
      itemId.includes("helmet") ||
      itemId.includes("helm") ||
      itemId.includes("hat")
    )
      return "⛑️";
    if (itemId.includes("boots") || itemId.includes("boot")) return "👢";
    if (itemId.includes("glove") || itemId.includes("gauntlet")) return "🧤";
    if (itemId.includes("cape") || itemId.includes("cloak")) return "🧥";
    if (itemId.includes("amulet") || itemId.includes("necklace")) return "📿";
    if (itemId.includes("ring")) return "💍";
    if (itemId.includes("arrow") || itemId.includes("bolt")) return "🏹";
    if (
      itemId.includes("fish") ||
      itemId.includes("lobster") ||
      itemId.includes("shark")
    )
      return "🐟";
    if (itemId.includes("log") || itemId.includes("wood")) return "🪵";
    if (itemId.includes("ore") || itemId.includes("bar")) return "⛏️";
    if (itemId.includes("coin")) return "💰";
    if (itemId.includes("potion") || itemId.includes("vial")) return "🧪";
    if (
      itemId.includes("food") ||
      itemId.includes("bread") ||
      itemId.includes("meat")
    )
      return "🍖";
    if (itemId.includes("axe")) return "🪓";
    if (itemId.includes("pickaxe")) return "⛏️";
    return itemId.substring(0, 2).toUpperCase();
  };

  const slotSize = isMobile
    ? "clamp(2rem, 10vw, 2.5rem)"
    : "clamp(2.5rem, 5vw, 3rem)";
  const iconSize = isMobile
    ? "clamp(0.875rem, 2vw, 1rem)"
    : "clamp(1rem, 2vw, 1.25rem)";
  const arrowSize = isMobile
    ? "clamp(0.625rem, 1.5vw, 0.75rem)"
    : "clamp(0.75rem, 1.5vw, 0.875rem)";

  return (
    <div
      className="flex items-center"
      style={{ gap: "clamp(0.25rem, 0.5vw, 0.375rem)" }}
    >
      {/* Pagination Controls */}
      <div
        className="flex flex-col"
        style={{ gap: "clamp(0.125rem, 0.25vw, 0.1875rem)" }}
      >
        <button
          onClick={handlePrevious}
          disabled={currentPage === 0}
          className="border rounded transition-all duration-200"
          style={{
            width: slotSize,
            height: `calc(${slotSize} / 2 - 0.125rem)`,
            background:
              currentPage === 0
                ? "linear-gradient(135deg, rgba(20, 15, 10, 0.6) 0%, rgba(15, 10, 5, 0.7) 100%)"
                : "linear-gradient(135deg, rgba(30, 20, 10, 0.9) 0%, rgba(20, 15, 10, 0.95) 100%)",
            backdropFilter: "blur(8px)",
            borderColor:
              currentPage === 0
                ? "rgba(139, 69, 19, 0.3)"
                : "rgba(139, 69, 19, 0.6)",
            boxShadow:
              currentPage === 0
                ? "inset 0 1px 2px rgba(0, 0, 0, 0.5)"
                : "0 2px 6px rgba(0, 0, 0, 0.6), 0 1px 3px rgba(139, 69, 19, 0.3), inset 0 1px 0 rgba(242, 208, 138, 0.15)",
            color: currentPage === 0 ? "rgba(242, 208, 138, 0.3)" : "#f2d08a",
            cursor: currentPage === 0 ? "default" : "pointer",
            opacity: currentPage === 0 ? 0.5 : 1,
            fontSize: arrowSize,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
          }}
        >
          ▲
        </button>
        <button
          onClick={handleNext}
          disabled={currentPage >= totalPages - 1}
          className="border rounded transition-all duration-200"
          style={{
            width: slotSize,
            height: `calc(${slotSize} / 2 - 0.125rem)`,
            background:
              currentPage >= totalPages - 1
                ? "linear-gradient(135deg, rgba(20, 15, 10, 0.6) 0%, rgba(15, 10, 5, 0.7) 100%)"
                : "linear-gradient(135deg, rgba(30, 20, 10, 0.9) 0%, rgba(20, 15, 10, 0.95) 100%)",
            backdropFilter: "blur(8px)",
            borderColor:
              currentPage >= totalPages - 1
                ? "rgba(139, 69, 19, 0.3)"
                : "rgba(139, 69, 19, 0.6)",
            boxShadow:
              currentPage >= totalPages - 1
                ? "inset 0 1px 2px rgba(0, 0, 0, 0.5)"
                : "0 2px 6px rgba(0, 0, 0, 0.6), 0 1px 3px rgba(139, 69, 19, 0.3), inset 0 1px 0 rgba(242, 208, 138, 0.15)",
            color:
              currentPage >= totalPages - 1
                ? "rgba(242, 208, 138, 0.3)"
                : "#f2d08a",
            cursor: currentPage >= totalPages - 1 ? "default" : "pointer",
            opacity: currentPage >= totalPages - 1 ? 0.5 : 1,
            fontSize: arrowSize,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
          }}
        >
          ▼
        </button>
      </div>

      {/* Action Slots */}
      <div className="flex" style={{ gap: "clamp(0.25rem, 0.5vw, 0.375rem)" }}>
        {slots.map((item, index) => {
          const isEmpty = !item;
          const actualIndex = startIndex + index;

          return (
            <button
              key={actualIndex}
              onClick={() => item && onItemUse?.(item, actualIndex)}
              disabled={isEmpty}
              className="relative border rounded transition-all duration-200 group"
              title={item ? `${item.itemId} (${item.quantity})` : "Empty slot"}
              style={{
                width: slotSize,
                height: slotSize,
                borderColor: isEmpty
                  ? "rgba(242, 208, 138, 0.2)"
                  : "rgba(242, 208, 138, 0.4)",
                background: isEmpty
                  ? "rgba(0, 0, 0, 0.35)"
                  : "linear-gradient(135deg, rgba(242, 208, 138, 0.08) 0%, rgba(242, 208, 138, 0.04) 100%)",
                backdropFilter: isEmpty ? "none" : "blur(4px)",
                boxShadow: isEmpty
                  ? "inset 0 1px 2px rgba(0, 0, 0, 0.3)"
                  : "0 1px 3px rgba(242, 208, 138, 0.2), inset 0 1px 0 rgba(242, 208, 138, 0.05)",
                cursor: isEmpty ? "default" : "pointer",
              }}
            >
              {/* Item Icon */}
              {!isEmpty ? (
                <div
                  className="flex items-center justify-center h-full transition-transform duration-200 group-hover:scale-110"
                  style={{
                    color: "#f2d08a",
                    fontSize: iconSize,
                  }}
                >
                  {getItemIcon(item.itemId)}
                </div>
              ) : (
                <div
                  className="flex items-center justify-center h-full opacity-20"
                  style={{
                    color: "#f2d08a",
                    fontSize: `calc(${iconSize} * 0.6)`,
                  }}
                >
                  •
                </div>
              )}

              {/* Quantity Badge */}
              {item && item.quantity > 1 && (
                <div
                  className="absolute bottom-0.5 right-0.5 font-bold rounded px-0.5 leading-none"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(242, 208, 138, 0.95) 0%, rgba(242, 208, 138, 0.85) 100%)",
                    color: "rgba(20, 20, 30, 0.95)",
                    fontSize: isMobile
                      ? "clamp(0.375rem, 1vw, 0.438rem)"
                      : "clamp(0.438rem, 1vw, 0.5rem)",
                    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.6)",
                    padding: "1px 2px",
                  }}
                >
                  {item.quantity}
                </div>
              )}

              {/* Hover Glow */}
              {!isEmpty && (
                <div
                  className="absolute inset-0 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(circle at center, rgba(242, 208, 138, 0.15) 0%, transparent 70%)",
                  }}
                />
              )}

              {/* Slot Number Indicator */}
              <div
                className="absolute top-0.5 left-0.5 font-bold opacity-40"
                style={{
                  color: "#f2d08a",
                  fontSize: isMobile
                    ? "clamp(0.375rem, 0.9vw, 0.438rem)"
                    : "clamp(0.438rem, 0.9vw, 0.5rem)",
                  textShadow: "0 1px 1px rgba(0, 0, 0, 0.8)",
                }}
              >
                {actualIndex + 1}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
