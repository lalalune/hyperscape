import React, { useState } from "react";
import { COLORS } from "../../constants";
import { useDroppable } from "@dnd-kit/core";
import { EquipmentSlotName } from "@hyperscape/shared";
import type { PlayerEquipmentItems, Item, PlayerStats } from "../../types";

interface EquipmentPanelProps {
  equipment: PlayerEquipmentItems | null;
  stats?: PlayerStats | null;
  onItemDrop?: (item: Item, slot: keyof typeof EquipmentSlotName) => void;
}

interface EquipmentSlot {
  key: string;
  label: string;
  icon: string;
  item: Item | null;
}

interface DroppableEquipmentSlotProps {
  slot: EquipmentSlot;
  onSlotClick: (slot: EquipmentSlot) => void;
}

function DroppableEquipmentSlot({
  slot,
  onSlotClick,
}: DroppableEquipmentSlotProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `equipment-${slot.key}`,
    data: { slot: slot.key },
  });

  const isEmpty = !slot.item;

  return (
    <button
      ref={setNodeRef}
      onClick={() => onSlotClick(slot)}
      className="w-full h-full rounded transition-all duration-200 cursor-pointer group relative"
      style={{
        background: isEmpty
          ? "rgba(0, 0, 0, 0.35)"
          : "linear-gradient(135deg, rgba(40, 35, 50, 0.8) 0%, rgba(30, 25, 40, 0.9) 100%)",
        borderWidth: "2px",
        borderStyle: "solid",
        borderColor: isOver
          ? "rgba(242, 208, 138, 0.8)"
          : isEmpty
            ? "rgba(242, 208, 138, 0.25)"
            : "rgba(242, 208, 138, 0.5)",
        boxShadow: isEmpty
          ? "inset 0 2px 4px rgba(0, 0, 0, 0.3)"
          : "0 2px 8px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(242, 208, 138, 0.1)",
      }}
    >
      {/* Slot Label */}
      <div
        className="absolute top-1 left-1.5 text-[9px] font-medium uppercase tracking-wider"
        style={{
          color: "rgba(242, 208, 138, 0.6)",
          textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
        }}
      >
        {slot.label}
      </div>

      {/* Slot Content */}
      <div className="flex flex-col items-center justify-center h-full pt-3">
        {isEmpty ? (
          <span
            className="transition-transform duration-200 group-hover:scale-110"
            style={{
              fontSize: "clamp(1.5rem, 3vw, 2rem)",
              filter: "grayscale(100%) opacity(0.3)",
            }}
          >
            {slot.icon}
          </span>
        ) : (
          <>
            <span
              className="transition-transform duration-200 group-hover:scale-110 mb-1"
              style={{
                fontSize: "clamp(1.25rem, 2.5vw, 1.5rem)",
                filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.8))",
              }}
            >
              {slot.icon}
            </span>
            <div
              className="text-center px-1"
              style={{
                fontSize: "clamp(0.563rem, 1vw, 0.625rem)",
                color: "rgba(242, 208, 138, 0.9)",
                lineHeight: "1.2",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {slot.item!.name}
            </div>
            {slot.item!.quantity > 1 && (
              <div
                className="absolute bottom-1 right-1.5 font-bold"
                style={{
                  fontSize: "clamp(0.625rem, 1.1vw, 0.75rem)",
                  color: COLORS.ACCENT,
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
                }}
              >
                {slot.item!.quantity}
              </div>
            )}
          </>
        )}
      </div>

      {/* Hover Glow Effect */}
      {!isEmpty && (
        <div
          className="absolute inset-0 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at center, rgba(242, 208, 138, 0.1) 0%, transparent 70%)",
          }}
        />
      )}
    </button>
  );
}

export function EquipmentPanel({
  equipment,
  stats,
  onItemDrop: _onItemDrop,
}: EquipmentPanelProps) {
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot | null>(null);

  // Equipment slots with icons for paperdoll layout
  const slots: EquipmentSlot[] = [
    {
      key: EquipmentSlotName.HELMET,
      label: "Head",
      icon: "⛑️",
      item: equipment?.helmet || null,
    },
    {
      key: EquipmentSlotName.BODY,
      label: "Body",
      icon: "🎽",
      item: equipment?.body || null,
    },
    {
      key: EquipmentSlotName.LEGS,
      label: "Legs",
      icon: "👖",
      item: equipment?.legs || null,
    },
    {
      key: EquipmentSlotName.WEAPON,
      label: "Weapon",
      icon: "⚔️",
      item: equipment?.weapon || null,
    },
    {
      key: EquipmentSlotName.SHIELD,
      label: "Shield",
      icon: "🛡️",
      item: equipment?.shield || null,
    },
    {
      key: EquipmentSlotName.ARROWS,
      label: "Ammo",
      icon: "🏹",
      item: equipment?.arrows || null,
    },
  ];

  // Calculate total bonuses from equipped items
  const totalStats = slots.reduce(
    (acc, slot) => {
      if (slot.item) {
        acc.attack += slot.item.stats?.attack || 0;
        acc.defense += slot.item.stats?.defense || 0;
        acc.strength += slot.item.stats?.strength || 0;
      }
      return acc;
    },
    { attack: 0, defense: 0, strength: 0 },
  );

  const handleSlotClick = (slot: EquipmentSlot) => {
    if (slot.item) {
      setSelectedSlot(slot);
    }
  };

  // Get player stats with proper defaults
  const playerLevel = stats?.level || 1;
  const combatLevel = stats?.combatLevel || 1;
  const health = {
    current: stats?.health?.current ?? 100,
    max: stats?.health?.max ?? 100,
  };
  const attackSkill = stats?.skills?.attack?.level || 1;
  const strengthSkill = stats?.skills?.strength?.level || 1;
  const defenseSkill = stats?.skills?.defense?.level || 1;

  // Helper to find slot by key
  const getSlot = (key: string) => slots.find((s) => s.key === key) || null;

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Main Content: Paperdoll + Stats */}
        <div className="flex-1 flex overflow-hidden gap-1">
          {/* Left Side: Paperdoll */}
          <div className="flex-1 flex flex-col" style={{ minWidth: "60%" }}>
            <div
              className="border rounded flex-1"
              style={{
                background:
                  "linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(25, 20, 35, 0.92) 100%)",
                borderColor: "rgba(242, 208, 138, 0.35)",
                padding: "clamp(0.25rem, 0.8vw, 0.5rem)",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
              }}
            >
              {/* Paperdoll Grid Layout */}
              <div
                className="grid grid-cols-3 gap-1 h-full"
                style={{ gridTemplateRows: "repeat(4, 1fr)" }}
              >
                {/* Row 1: Head slot centered */}
                <div />
                <div className="w-full h-full">
                  <DroppableEquipmentSlot
                    slot={getSlot(EquipmentSlotName.HELMET)!}
                    onSlotClick={handleSlotClick}
                  />
                </div>
                <div />

                {/* Row 2: Weapon, Body, Shield */}
                <div className="w-full h-full">
                  <DroppableEquipmentSlot
                    slot={getSlot(EquipmentSlotName.WEAPON)!}
                    onSlotClick={handleSlotClick}
                  />
                </div>
                <div className="w-full h-full">
                  <DroppableEquipmentSlot
                    slot={getSlot(EquipmentSlotName.BODY)!}
                    onSlotClick={handleSlotClick}
                  />
                </div>
                <div className="w-full h-full">
                  <DroppableEquipmentSlot
                    slot={getSlot(EquipmentSlotName.SHIELD)!}
                    onSlotClick={handleSlotClick}
                  />
                </div>

                {/* Row 3: Legs centered */}
                <div />
                <div className="w-full h-full">
                  <DroppableEquipmentSlot
                    slot={getSlot(EquipmentSlotName.LEGS)!}
                    onSlotClick={handleSlotClick}
                  />
                </div>
                <div />

                {/* Row 4: Arrows centered */}
                <div />
                <div className="w-full h-full">
                  <DroppableEquipmentSlot
                    slot={getSlot(EquipmentSlotName.ARROWS)!}
                    onSlotClick={handleSlotClick}
                  />
                </div>
                <div />
              </div>
            </div>
          </div>

          {/* Right Side: Stats Panel */}
          <div className="flex flex-col gap-1" style={{ width: "40%" }}>
            {/* Player Info Card */}
            <div
              className="border rounded p-1"
              style={{
                background:
                  "linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(25, 20, 35, 0.92) 100%)",
                borderColor: "rgba(242, 208, 138, 0.35)",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
              }}
            >
              {/* Level and CB */}
              <div className="flex items-center justify-center mb-1 gap-1.5">
                <div
                  style={{
                    fontSize: "clamp(0.625rem, 1.1vw, 0.75rem)",
                    color: "rgba(242, 208, 138, 0.8)",
                  }}
                >
                  Lvl{" "}
                  <span className="font-bold" style={{ color: COLORS.ACCENT }}>
                    {playerLevel}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "clamp(0.625rem, 1.1vw, 0.75rem)",
                    color: "rgba(242, 208, 138, 0.8)",
                  }}
                >
                  CB{" "}
                  <span className="font-bold" style={{ color: COLORS.ACCENT }}>
                    {combatLevel}
                  </span>
                </div>
              </div>

              {/* Health */}
              <div className="flex items-center mb-0.5 gap-1">
                <span style={{ fontSize: "clamp(0.563rem, 1vw, 0.625rem)" }}>
                  ❤️
                </span>
                <span
                  style={{
                    fontSize: "clamp(0.563rem, 1vw, 0.625rem)",
                    color: "rgba(242, 208, 138, 0.9)",
                    fontWeight: "bold",
                  }}
                >
                  {health.current}/{health.max}
                </span>
              </div>
              <div
                className="rounded overflow-hidden"
                style={{
                  background: "rgba(0, 0, 0, 0.5)",
                  height: "clamp(6px, 1.2vw, 8px)",
                  border: "1px solid rgba(220, 38, 38, 0.3)",
                }}
              >
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(220, 38, 38, 0.8) 0%, rgba(239, 68, 68, 0.9) 100%)",
                    width: `${(health.current / health.max) * 100}%`,
                    boxShadow: "0 0 8px rgba(220, 38, 38, 0.5)",
                  }}
                />
              </div>
            </div>

            {/* Combat Stats */}
            <div
              className="border rounded p-1 flex-1 overflow-y-auto noscrollbar"
              style={{
                background:
                  "linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(25, 20, 35, 0.92) 100%)",
                borderColor: "rgba(242, 208, 138, 0.35)",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
              }}
            >
              <div
                style={{
                  fontSize: "clamp(0.563rem, 1vw, 0.625rem)",
                  color: "rgba(242, 208, 138, 0.9)",
                  fontWeight: "bold",
                  marginBottom: "clamp(0.25rem, 0.5vw, 0.375rem)",
                }}
              >
                Combat Stats
              </div>
              <div className="space-y-0.5">
                {/* Attack */}
                <div className="flex justify-between items-center">
                  <div
                    className="flex items-center"
                    style={{ gap: "clamp(0.125rem, 0.3vw, 0.2rem)" }}
                  >
                    <span
                      style={{ fontSize: "clamp(0.563rem, 1vw, 0.625rem)" }}
                    >
                      ⚔️
                    </span>
                    <span
                      style={{
                        fontSize: "clamp(0.563rem, 1vw, 0.625rem)",
                        color: "rgba(242, 208, 138, 0.8)",
                      }}
                    >
                      Attack
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "clamp(0.563rem, 1vw, 0.625rem)",
                      color: COLORS.ACCENT,
                      fontWeight: "bold",
                    }}
                  >
                    {attackSkill}
                    {totalStats.attack > 0 && (
                      <span
                        style={{
                          color: "#22c55e",
                          fontSize: "clamp(0.5rem, 0.9vw, 0.563rem)",
                        }}
                      >
                        {" "}
                        +{totalStats.attack}
                      </span>
                    )}
                  </div>
                </div>

                {/* Strength */}
                <div className="flex justify-between items-center">
                  <div
                    className="flex items-center"
                    style={{ gap: "clamp(0.125rem, 0.3vw, 0.2rem)" }}
                  >
                    <span
                      style={{ fontSize: "clamp(0.563rem, 1vw, 0.625rem)" }}
                    >
                      💪
                    </span>
                    <span
                      style={{
                        fontSize: "clamp(0.563rem, 1vw, 0.625rem)",
                        color: "rgba(242, 208, 138, 0.8)",
                      }}
                    >
                      Strength
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "clamp(0.563rem, 1vw, 0.625rem)",
                      color: COLORS.ACCENT,
                      fontWeight: "bold",
                    }}
                  >
                    {strengthSkill}
                    {totalStats.strength > 0 && (
                      <span
                        style={{
                          color: "#22c55e",
                          fontSize: "clamp(0.5rem, 0.9vw, 0.563rem)",
                        }}
                      >
                        {" "}
                        +{totalStats.strength}
                      </span>
                    )}
                  </div>
                </div>

                {/* Defense */}
                <div className="flex justify-between items-center">
                  <div
                    className="flex items-center"
                    style={{ gap: "clamp(0.125rem, 0.3vw, 0.2rem)" }}
                  >
                    <span
                      style={{ fontSize: "clamp(0.563rem, 1vw, 0.625rem)" }}
                    >
                      🛡️
                    </span>
                    <span
                      style={{
                        fontSize: "clamp(0.563rem, 1vw, 0.625rem)",
                        color: "rgba(242, 208, 138, 0.8)",
                      }}
                    >
                      Defense
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "clamp(0.563rem, 1vw, 0.625rem)",
                      color: COLORS.ACCENT,
                      fontWeight: "bold",
                    }}
                  >
                    {defenseSkill}
                    {totalStats.defense > 0 && (
                      <span
                        style={{
                          color: "#22c55e",
                          fontSize: "clamp(0.5rem, 0.9vw, 0.563rem)",
                        }}
                      >
                        {" "}
                        +{totalStats.defense}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Equipment Bonuses Section */}
              <div
                style={{
                  marginTop: "clamp(0.375rem, 0.8vw, 0.5rem)",
                  paddingTop: "clamp(0.375rem, 0.8vw, 0.5rem)",
                  borderTop: "1px solid rgba(242, 208, 138, 0.2)",
                }}
              >
                <div
                  style={{
                    fontSize: "clamp(0.563rem, 1vw, 0.625rem)",
                    color: "rgba(242, 208, 138, 0.9)",
                    fontWeight: "bold",
                    marginBottom: "clamp(0.25rem, 0.5vw, 0.375rem)",
                  }}
                >
                  Equipment Bonuses
                </div>
                <div className="space-y-0.5">
                  <div className="flex justify-between">
                    <span
                      style={{
                        fontSize: "clamp(0.563rem, 1vw, 0.625rem)",
                        color: "rgba(242, 208, 138, 0.8)",
                      }}
                    >
                      ⚔️ Attack Bonus
                    </span>
                    <span
                      style={{
                        fontSize: "clamp(0.563rem, 1vw, 0.625rem)",
                        color: "#22c55e",
                        fontWeight: "bold",
                      }}
                    >
                      +{totalStats.attack}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span
                      style={{
                        fontSize: "clamp(0.563rem, 1vw, 0.625rem)",
                        color: "rgba(242, 208, 138, 0.8)",
                      }}
                    >
                      🛡️ Defense Bonus
                    </span>
                    <span
                      style={{
                        fontSize: "clamp(0.563rem, 1vw, 0.625rem)",
                        color: "#22c55e",
                        fontWeight: "bold",
                      }}
                    >
                      +{totalStats.defense}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span
                      style={{
                        fontSize: "clamp(0.563rem, 1vw, 0.625rem)",
                        color: "rgba(242, 208, 138, 0.8)",
                      }}
                    >
                      💪 Strength Bonus
                    </span>
                    <span
                      style={{
                        fontSize: "clamp(0.563rem, 1vw, 0.625rem)",
                        color: "#22c55e",
                        fontWeight: "bold",
                      }}
                    >
                      +{totalStats.strength}
                    </span>
                  </div>
                </div>
              </div>

              {/* Weight Section */}
              <div
                style={{
                  marginTop: "clamp(0.375rem, 0.8vw, 0.5rem)",
                  paddingTop: "clamp(0.375rem, 0.8vw, 0.5rem)",
                  borderTop: "1px solid rgba(242, 208, 138, 0.2)",
                }}
              >
                <div className="flex justify-between">
                  <span
                    style={{
                      fontSize: "clamp(0.563rem, 1vw, 0.625rem)",
                      color: "rgba(242, 208, 138, 0.8)",
                    }}
                  >
                    ⚖️ Total Weight
                  </span>
                  <span
                    style={{
                      fontSize: "clamp(0.563rem, 1vw, 0.625rem)",
                      color: COLORS.ACCENT,
                      fontWeight: "bold",
                    }}
                  >
                    {slots
                      .reduce(
                        (sum, slot) =>
                          sum +
                          (slot.item?.weight || 0) * (slot.item?.quantity || 0),
                        0,
                      )
                      .toFixed(1)}{" "}
                    kg
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Item Details Popup */}
      {selectedSlot &&
        selectedSlot.item &&
        (() => {
          const item = selectedSlot.item;
          return (
            <div
              className="fixed inset-0 flex items-center justify-center z-[300]"
              style={{ background: "rgba(0, 0, 0, 0.7)" }}
              onClick={() => setSelectedSlot(null)}
            >
              <div
                className="border rounded"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(20, 20, 30, 0.98) 0%, rgba(30, 25, 40, 0.95) 100%)",
                  borderColor: "rgba(242, 208, 138, 0.5)",
                  borderWidth: "2px",
                  padding: "clamp(0.75rem, 1.5vw, 1rem)",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.9)",
                  width: "clamp(250px, 40vw, 350px)",
                  maxHeight: "80vh",
                  overflowY: "auto",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="flex items-center"
                    style={{ gap: "clamp(0.375rem, 0.8vw, 0.5rem)" }}
                  >
                    <span style={{ fontSize: "clamp(1.25rem, 2.5vw, 1.5rem)" }}>
                      {selectedSlot.icon}
                    </span>
                    <div>
                      <div
                        className="font-bold"
                        style={{
                          color: COLORS.ACCENT,
                          fontSize: "clamp(0.875rem, 1.5vw, 1rem)",
                        }}
                      >
                        {item.name}
                      </div>
                      <div
                        style={{
                          color: "rgba(242, 208, 138, 0.7)",
                          fontSize: "clamp(0.625rem, 1.1vw, 0.75rem)",
                        }}
                      >
                        {selectedSlot.label}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedSlot(null)}
                    style={{
                      color: "rgba(242, 208, 138, 0.7)",
                      fontSize: "clamp(0.875rem, 1.5vw, 1rem)",
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Description */}
                {item.description && (
                  <div
                    className="mb-3 p-2 rounded"
                    style={{
                      background: "rgba(0, 0, 0, 0.3)",
                      borderLeft: "2px solid rgba(242, 208, 138, 0.4)",
                      fontSize: "clamp(0.625rem, 1.1vw, 0.75rem)",
                      color: "rgba(242, 208, 138, 0.85)",
                      lineHeight: "1.4",
                    }}
                  >
                    {item.description}
                  </div>
                )}

                {/* Stats */}
                {(item.stats.attack > 0 ||
                  item.stats.defense > 0 ||
                  item.stats.strength > 0) && (
                  <div className="mb-3">
                    <div
                      className="mb-1"
                      style={{
                        fontSize: "clamp(0.688rem, 1.2vw, 0.75rem)",
                        color: "rgba(242, 208, 138, 0.9)",
                        fontWeight: "bold",
                      }}
                    >
                      Combat Stats
                    </div>
                    <div className="space-y-1">
                      {item.stats.attack > 0 && (
                        <div
                          className="flex justify-between"
                          style={{
                            fontSize: "clamp(0.625rem, 1.1vw, 0.75rem)",
                            color: "rgba(242, 208, 138, 0.8)",
                          }}
                        >
                          <span>⚔️ Attack</span>
                          <span
                            style={{ color: "#22c55e", fontWeight: "bold" }}
                          >
                            +{item.stats.attack}
                          </span>
                        </div>
                      )}
                      {item.stats.defense > 0 && (
                        <div
                          className="flex justify-between"
                          style={{
                            fontSize: "clamp(0.625rem, 1.1vw, 0.75rem)",
                            color: "rgba(242, 208, 138, 0.8)",
                          }}
                        >
                          <span>🛡️ Defense</span>
                          <span
                            style={{ color: "#22c55e", fontWeight: "bold" }}
                          >
                            +{item.stats.defense}
                          </span>
                        </div>
                      )}
                      {item.stats.strength > 0 && (
                        <div
                          className="flex justify-between"
                          style={{
                            fontSize: "clamp(0.625rem, 1.1vw, 0.75rem)",
                            color: "rgba(242, 208, 138, 0.8)",
                          }}
                        >
                          <span>💪 Strength</span>
                          <span
                            style={{ color: "#22c55e", fontWeight: "bold" }}
                          >
                            +{item.stats.strength}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Requirements */}
                {(item.requirements.level > 1 ||
                  Object.keys(item.requirements.skills || {}).length > 0) && (
                  <div className="mb-3">
                    <div
                      className="mb-1"
                      style={{
                        fontSize: "clamp(0.688rem, 1.2vw, 0.75rem)",
                        color: "rgba(242, 208, 138, 0.9)",
                        fontWeight: "bold",
                      }}
                    >
                      Requirements
                    </div>
                    <div className="space-y-1">
                      {item.requirements.level > 1 && (
                        <div
                          style={{
                            fontSize: "clamp(0.625rem, 1.1vw, 0.75rem)",
                            color: "rgba(242, 208, 138, 0.8)",
                          }}
                        >
                          Level {item.requirements.level}
                        </div>
                      )}
                      {item.requirements.skills &&
                        Object.entries(item.requirements.skills).map(
                          ([skill, level]) => (
                            <div
                              key={skill}
                              style={{
                                fontSize: "clamp(0.625rem, 1.1vw, 0.75rem)",
                                color: "rgba(242, 208, 138, 0.8)",
                              }}
                            >
                              {skill.charAt(0).toUpperCase() + skill.slice(1)}:{" "}
                              {level}
                            </div>
                          ),
                        )}
                    </div>
                  </div>
                )}

                {/* Item Properties */}
                <div className="space-y-1">
                  <div
                    className="flex justify-between"
                    style={{
                      fontSize: "clamp(0.625rem, 1.1vw, 0.75rem)",
                      color: "rgba(242, 208, 138, 0.8)",
                    }}
                  >
                    <span>Value</span>
                    <span style={{ color: COLORS.ACCENT, fontWeight: "bold" }}>
                      {item.value} coins
                    </span>
                  </div>
                  <div
                    className="flex justify-between"
                    style={{
                      fontSize: "clamp(0.625rem, 1.1vw, 0.75rem)",
                      color: "rgba(242, 208, 138, 0.8)",
                    }}
                  >
                    <span>Weight</span>
                    <span style={{ color: COLORS.ACCENT, fontWeight: "bold" }}>
                      {item.weight} kg
                    </span>
                  </div>
                  {item.quantity > 1 && (
                    <div
                      className="flex justify-between"
                      style={{
                        fontSize: "clamp(0.625rem, 1.1vw, 0.75rem)",
                        color: "rgba(242, 208, 138, 0.8)",
                      }}
                    >
                      <span>Quantity</span>
                      <span
                        style={{ color: COLORS.ACCENT, fontWeight: "bold" }}
                      >
                        {item.quantity}
                      </span>
                    </div>
                  )}
                </div>

                {/* Unequip Button */}
                <button
                  onClick={() => {
                    // Unequip functionality not yet implemented
                    // Will require network protocol for item unequip action
                    setSelectedSlot(null);
                  }}
                  className="w-full mt-4 py-2 px-4 rounded transition-all duration-200 hover:scale-[1.02]"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(139, 69, 19, 0.3) 0%, rgba(139, 69, 19, 0.2) 100%)",
                    border: "1px solid rgba(139, 69, 19, 0.5)",
                    color: COLORS.ACCENT,
                    fontSize: "clamp(0.688rem, 1.2vw, 0.75rem)",
                    fontWeight: "bold",
                  }}
                >
                  🗑️ Unequip Item
                </button>
              </div>
            </div>
          );
        })()}
    </>
  );
}
