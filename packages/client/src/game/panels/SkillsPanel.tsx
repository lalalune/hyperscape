/**
 * Skills Panel
 * Classic RuneScape-style skills interface with Prayer/Buffs system
 */

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { COLORS } from "../../constants";
import type { ClientWorld, PlayerStats } from "../../types";

interface SkillsPanelProps {
  world: ClientWorld;
  stats: PlayerStats | null;
}

interface Skill {
  key: string;
  label: string;
  icon: string;
  level: number;
  xp: number;
}

interface Prayer {
  id: string;
  name: string;
  icon: string;
  level: number;
  description: string;
  drainRate: number;
  active: boolean;
  category: "offensive" | "defensive" | "utility";
}

type TabType = "skills" | "prayer";

function calculateXPForLevel(level: number): number {
  // RuneScape-style XP formula
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += Math.floor(i + 300 * Math.pow(2, i / 7));
  }
  return Math.floor(total / 4);
}

function SkillBox({
  skill,
  onHover,
  onLeave,
}: {
  skill: Skill;
  onHover: (skill: Skill, e: React.MouseEvent) => void;
  onLeave: () => void;
}) {
  return (
    <button
      className="relative group flex flex-col items-center p-0.5"
      onMouseEnter={(e) => onHover(skill, e)}
      onMouseMove={(e) => onHover(skill, e)}
      onMouseLeave={onLeave}
      style={{
        background:
          "linear-gradient(to bottom, rgba(45, 35, 25, 0.95) 0%, rgba(30, 25, 20, 0.95) 100%)",
        border: "1px solid #5c4a3a",
        borderRadius: "3px",
        boxShadow:
          "inset 1px 1px 0 rgba(80, 65, 50, 0.8), inset -1px -1px 0 rgba(20, 15, 10, 0.9), 0 1px 3px rgba(0, 0, 0, 0.8)",
        cursor: "default",
        width: "100%",
        minHeight: "40px",
      }}
    >
      {/* Icon - Top */}
      <div className="flex-1 flex items-center justify-center w-full">
        <div
          className="text-base"
          style={{ filter: "drop-shadow(1px 1px 1px rgba(0, 0, 0, 0.8))" }}
        >
          {skill.icon}
        </div>
      </div>

      {/* Skill Name and Level - Bottom */}
      <div className="flex items-center justify-between w-full mt-0.5">
        <span className="font-medium text-[8px]" style={{ color: "#c9b386" }}>
          {skill.label}
        </span>
        <span
          className="font-bold text-[9px]"
          style={{
            color: skill.level >= 99 ? "#ffcc00" : "#ffff00",
            textShadow:
              "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
          }}
        >
          {skill.level}
        </span>
      </div>

      {/* 99 Badge */}
      {skill.level >= 99 && (
        <div
          className="absolute top-0.5 right-0.5 text-[8px]"
          style={{ filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 1))" }}
        >
          ⭐
        </div>
      )}

      {/* Hover Effect */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-100 pointer-events-none"
        style={{
          background: "rgba(255, 255, 200, 0.1)",
          borderRadius: "3px",
        }}
      />
    </button>
  );
}

function PrayerCard({
  prayer,
  onToggle,
}: {
  prayer: Prayer;
  onToggle: (id: string) => void;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <button
      className="relative border rounded transition-all duration-200 group p-0.5"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={() => onToggle(prayer.id)}
      style={{
        background: prayer.active
          ? "linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(34, 197, 94, 0.1) 100%)"
          : "linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(25, 20, 35, 0.92) 100%)",
        borderColor: prayer.active
          ? "rgba(34, 197, 94, 0.6)"
          : "rgba(242, 208, 138, 0.35)",
        boxShadow: prayer.active
          ? "0 0 4px rgba(34, 197, 94, 0.3), 0 1px 2px rgba(0, 0, 0, 0.5)"
          : "0 1px 2px rgba(0, 0, 0, 0.5)",
        cursor: "pointer",
      }}
    >
      <div className="flex items-center justify-between gap-0.5">
        {/* Icon - Left */}
        <div
          className="flex items-center justify-center rounded text-xs w-5 h-5 sm:text-sm sm:w-6 sm:h-6 flex-shrink-0"
          style={{
            background: prayer.active
              ? "rgba(34, 197, 94, 0.15)"
              : "rgba(0, 0, 0, 0.3)",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: prayer.active
              ? "rgba(34, 197, 94, 0.4)"
              : "rgba(242, 208, 138, 0.2)",
          }}
        >
          {prayer.icon}
        </div>

        {/* Name - Middle */}
        <div className="flex-1 min-w-0 px-0.5">
          <div
            className="font-semibold text-[10px] leading-tight truncate"
            style={{ color: prayer.active ? "#22c55e" : COLORS.ACCENT }}
          >
            {prayer.name}
          </div>
        </div>

        {/* Level - Right */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <div
            className="text-[10px] font-semibold"
            style={{ color: "rgba(242, 208, 138, 0.8)" }}
          >
            {prayer.level}
          </div>
          {/* Active Indicator */}
          {prayer.active && (
            <div
              className="rounded-full w-1 h-1"
              style={{
                background: "#22c55e",
                boxShadow: "0 0 4px rgba(34, 197, 94, 0.6)",
              }}
            />
          )}
        </div>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute z-[200] border rounded pointer-events-none p-1.5"
          style={{
            bottom: "110%",
            left: "50%",
            transform: "translateX(-50%)",
            background:
              "linear-gradient(135deg, rgba(20, 20, 30, 0.98) 0%, rgba(25, 20, 35, 0.96) 100%)",
            borderColor: "rgba(242, 208, 138, 0.5)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.8)",
            minWidth: "140px",
            whiteSpace: "normal",
          }}
        >
          <div
            className="font-semibold mb-0.5 text-[10px]"
            style={{ color: COLORS.ACCENT }}
          >
            {prayer.name}
          </div>
          <div
            className="mb-0.5 text-[9px]"
            style={{
              color: "rgba(242, 208, 138, 0.8)",
              lineHeight: "1.3",
            }}
          >
            {prayer.description}
          </div>
          <div
            className="text-[9px]"
            style={{ color: "rgba(242, 208, 138, 0.7)" }}
          >
            Drain rate: {prayer.drainRate}/min
          </div>

          {/* Tooltip arrow */}
          <div
            className="absolute"
            style={{
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "6px solid rgba(242, 208, 138, 0.5)",
            }}
          />
        </div>
      )}

      {/* Hover Glow */}
      <div
        className="absolute inset-0 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style={{
          background: prayer.active
            ? "radial-gradient(circle at center, rgba(34, 197, 94, 0.1) 0%, transparent 70%)"
            : "radial-gradient(circle at center, rgba(242, 208, 138, 0.05) 0%, transparent 70%)",
        }}
      />
    </button>
  );
}

export function SkillsPanel({ world: _world, stats }: SkillsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("skills");
  const [hoveredSkill, setHoveredSkill] = useState<Skill | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [activePrayers, setActivePrayers] = useState<Set<string>>(new Set());

  const s = stats?.skills || ({} as NonNullable<PlayerStats["skills"]>);

  const skills: Skill[] = [
    {
      key: "attack",
      label: "Attack",
      icon: "⚔️",
      level: s?.attack?.level || 1,
      xp: s?.attack?.xp || 0,
    },
    {
      key: "constitution",
      label: "Constitution",
      icon: "❤️",
      level: Math.max(10, s?.constitution?.level || 10),
      xp: s?.constitution?.xp || 0,
    },
    {
      key: "strength",
      label: "Strength",
      icon: "💪",
      level: s?.strength?.level || 1,
      xp: s?.strength?.xp || 0,
    },
    {
      key: "defense",
      label: "Defense",
      icon: "🛡️",
      level: s?.defense?.level || 1,
      xp: s?.defense?.xp || 0,
    },
    // Ranged skill hidden for melee-only MVP
    {
      key: "woodcutting",
      label: "Woodcutting",
      icon: "🪓",
      level: s?.woodcutting?.level || 1,
      xp: s?.woodcutting?.xp || 0,
    },
    {
      key: "fishing",
      label: "Fishing",
      icon: "🎣",
      level: s?.fishing?.level || 1,
      xp: s?.fishing?.xp || 0,
    },
    {
      key: "firemaking",
      label: "Firemaking",
      icon: "🔥",
      level: s?.firemaking?.level || 1,
      xp: s?.firemaking?.xp || 0,
    },
    {
      key: "cooking",
      label: "Cooking",
      icon: "🍳",
      level: s?.cooking?.level || 1,
      xp: s?.cooking?.xp || 0,
    },
  ];

  const prayers: Prayer[] = [
    // Offensive Prayers
    {
      id: "clarity",
      name: "Clarity",
      icon: "🧠",
      level: 1,
      description: "Increases accuracy by 5%",
      drainRate: 3,
      active: activePrayers.has("clarity"),
      category: "offensive",
    },
    {
      id: "strength",
      name: "Strength",
      icon: "💪",
      level: 4,
      description: "Increases max hit by 5%",
      drainRate: 3,
      active: activePrayers.has("strength"),
      category: "offensive",
    },
    {
      id: "sharpEye",
      name: "Sharp Eye",
      icon: "🎯",
      level: 8,
      description: "Increases ranged accuracy by 5%",
      drainRate: 3,
      active: activePrayers.has("sharpEye"),
      category: "offensive",
    },
    {
      id: "burst",
      name: "Burst of Strength",
      icon: "⚡",
      level: 16,
      description: "Increases max hit by 10%",
      drainRate: 6,
      active: activePrayers.has("burst"),
      category: "offensive",
    },

    // Defensive Prayers
    {
      id: "thickSkin",
      name: "Thick Skin",
      icon: "🛡️",
      level: 1,
      description: "Increases defense by 5%",
      drainRate: 3,
      active: activePrayers.has("thickSkin"),
      category: "defensive",
    },
    {
      id: "rockSkin",
      name: "Rock Skin",
      icon: "🪨",
      level: 10,
      description: "Increases defense by 10%",
      drainRate: 6,
      active: activePrayers.has("rockSkin"),
      category: "defensive",
    },
    {
      id: "steelSkin",
      name: "Steel Skin",
      icon: "⚙️",
      level: 28,
      description: "Increases defense by 15%",
      drainRate: 12,
      active: activePrayers.has("steelSkin"),
      category: "defensive",
    },
    {
      id: "protect",
      name: "Protect from Melee",
      icon: "🔰",
      level: 43,
      description: "Blocks 40% melee damage",
      drainRate: 12,
      active: activePrayers.has("protect"),
      category: "defensive",
    },

    // Utility Prayers
    {
      id: "rapidHeal",
      name: "Rapid Heal",
      icon: "❤️‍🩹",
      level: 22,
      description: "Doubles health regeneration",
      drainRate: 6,
      active: activePrayers.has("rapidHeal"),
      category: "utility",
    },
    {
      id: "preserveGather",
      name: "Preserve",
      icon: "🌿",
      level: 35,
      description: "Reduces gathering drain by 50%",
      drainRate: 3,
      active: activePrayers.has("preserveGather"),
      category: "utility",
    },
  ];

  const totalLevel = skills.reduce((sum, skill) => sum + skill.level, 0);
  const totalXP = skills.reduce((sum, skill) => sum + skill.xp, 0);

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const togglePrayer = (id: string) => {
    const newActivePrayers = new Set(activePrayers);
    if (newActivePrayers.has(id)) {
      newActivePrayers.delete(id);
    } else {
      newActivePrayers.add(id);
    }
    setActivePrayers(newActivePrayers);
  };

  const offensivePrayers = prayers.filter((p) => p.category === "offensive");
  const defensivePrayers = prayers.filter((p) => p.category === "defensive");
  const utilityPrayers = prayers.filter((p) => p.category === "utility");

  return (
    <div className="flex flex-col h-full overflow-hidden gap-1">
      {/* Tabs */}
      <div className="flex gap-1">
        <button
          onClick={() => setActiveTab("skills")}
          className="flex-1 border rounded transition-all duration-200 py-1 px-2 text-[10px]"
          style={{
            background:
              activeTab === "skills"
                ? "linear-gradient(135deg, rgba(242, 208, 138, 0.2) 0%, rgba(242, 208, 138, 0.1) 100%)"
                : "linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(25, 20, 35, 0.92) 100%)",
            borderColor:
              activeTab === "skills"
                ? "rgba(242, 208, 138, 0.6)"
                : "rgba(242, 208, 138, 0.35)",
            boxShadow:
              activeTab === "skills"
                ? "0 0 8px rgba(242, 208, 138, 0.2), 0 1px 3px rgba(0, 0, 0, 0.5)"
                : "0 1px 3px rgba(0, 0, 0, 0.5)",
            color:
              activeTab === "skills"
                ? COLORS.ACCENT
                : "rgba(242, 208, 138, 0.7)",
            fontWeight: activeTab === "skills" ? "bold" : "medium",
          }}
        >
          📊 Skills
        </button>
        <button
          onClick={() => setActiveTab("prayer")}
          className="flex-1 border rounded transition-all duration-200 py-1 px-2 text-[10px]"
          style={{
            background:
              activeTab === "prayer"
                ? "linear-gradient(135deg, rgba(242, 208, 138, 0.2) 0%, rgba(242, 208, 138, 0.1) 100%)"
                : "linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(25, 20, 35, 0.92) 100%)",
            borderColor:
              activeTab === "prayer"
                ? "rgba(242, 208, 138, 0.6)"
                : "rgba(242, 208, 138, 0.35)",
            boxShadow:
              activeTab === "prayer"
                ? "0 0 8px rgba(242, 208, 138, 0.2), 0 1px 3px rgba(0, 0, 0, 0.5)"
                : "0 1px 3px rgba(0, 0, 0, 0.5)",
            color:
              activeTab === "prayer"
                ? COLORS.ACCENT
                : "rgba(242, 208, 138, 0.7)",
            fontWeight: activeTab === "prayer" ? "bold" : "medium",
          }}
        >
          🙏 Prayer
        </button>
      </div>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto noscrollbar"
        onMouseMove={handleMouseMove}
      >
        {activeTab === "skills" ? (
          <div className="flex flex-col gap-1.5">
            {/* Skills Grid - 3x3 */}
            <div className="grid grid-cols-3 gap-1">
              {skills.map((skill) => (
                <SkillBox
                  key={skill.key}
                  skill={skill}
                  onHover={(s, e) => {
                    setHoveredSkill(s);
                    setMousePos({ x: e.clientX, y: e.clientY });
                  }}
                  onLeave={() => setHoveredSkill(null)}
                />
              ))}
            </div>

            {/* Stats List */}
            <div className="flex flex-col gap-0.5">
              {/* Total Level */}
              <div className="flex items-center justify-between">
                <span
                  className="font-medium text-[10px]"
                  style={{ color: "#c9b386" }}
                >
                  Total level:
                </span>
                <span
                  className="font-bold text-xs"
                  style={{
                    color: "#ffff00",
                    textShadow:
                      "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
                  }}
                >
                  {totalLevel}
                </span>
              </div>

              {/* Combat Level */}
              <div className="flex items-center justify-between">
                <span
                  className="font-medium text-[10px]"
                  style={{ color: "#c9b386" }}
                >
                  Combat:
                </span>
                <span
                  className="font-bold text-xs"
                  style={{
                    color: "#00ff00",
                    textShadow:
                      "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
                  }}
                >
                  {(() => {
                    // OSRS Combat Level Formula (simplified - no Prayer/Magic yet)
                    const base =
                      0.25 *
                      ((s.defense?.level || 1) + (s.constitution?.level || 10));
                    // Melee-only MVP: Combat level based on melee stats only
                    const melee =
                      0.325 *
                      ((s.attack?.level || 1) + (s.strength?.level || 1));
                    return Math.floor(base + melee);
                  })()}
                </span>
              </div>

              {/* Total XP */}
              <div className="flex items-center justify-between">
                <span
                  className="font-medium text-[10px]"
                  style={{ color: "#c9b386" }}
                >
                  Total XP:
                </span>
                <span
                  className="font-bold text-[10px]"
                  style={{
                    color: "#ffffff",
                    textShadow: "1px 1px 0 #000",
                  }}
                >
                  {Math.floor(totalXP).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {/* Offensive Prayers */}
            <div>
              <div
                className="font-semibold mb-1 text-[10px]"
                style={{ color: COLORS.ACCENT }}
              >
                ⚔️ Offensive
              </div>
              <div className="grid grid-cols-2 gap-1">
                {offensivePrayers.map((prayer) => (
                  <PrayerCard
                    key={prayer.id}
                    prayer={prayer}
                    onToggle={togglePrayer}
                  />
                ))}
              </div>
            </div>

            {/* Defensive Prayers */}
            <div>
              <div
                className="font-semibold mb-1 text-[10px]"
                style={{ color: COLORS.ACCENT }}
              >
                🛡️ Defensive
              </div>
              <div className="grid grid-cols-2 gap-1">
                {defensivePrayers.map((prayer) => (
                  <PrayerCard
                    key={prayer.id}
                    prayer={prayer}
                    onToggle={togglePrayer}
                  />
                ))}
              </div>
            </div>

            {/* Utility Prayers */}
            <div>
              <div
                className="font-semibold mb-1 text-[10px]"
                style={{ color: COLORS.ACCENT }}
              >
                🌟 Utility
              </div>
              <div className="grid grid-cols-2 gap-1">
                {utilityPrayers.map((prayer) => (
                  <PrayerCard
                    key={prayer.id}
                    prayer={prayer}
                    onToggle={togglePrayer}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tooltip for Skills Tab - rendered via portal to avoid transform issues */}
      {activeTab === "skills" &&
        hoveredSkill &&
        createPortal(
          (() => {
            const currentLevelXP = calculateXPForLevel(hoveredSkill.level);
            const nextLevelXP = calculateXPForLevel(hoveredSkill.level + 1);
            const xpRemaining = nextLevelXP - hoveredSkill.xp;
            const xpIntoLevel = hoveredSkill.xp - currentLevelXP;
            const xpForThisLevel = nextLevelXP - currentLevelXP;
            const progress = Math.min(
              100,
              Math.max(0, (xpIntoLevel / xpForThisLevel) * 100),
            );

            const tooltipWidth = 200;
            const tooltipHeight = 100;
            const padding = 12;

            let left = mousePos.x + padding;
            if (left + tooltipWidth > window.innerWidth - 8) {
              left = mousePos.x - tooltipWidth - padding;
            }
            if (left < 8) left = 8;

            let top = mousePos.y + padding;
            if (top + tooltipHeight > window.innerHeight - 8) {
              top = mousePos.y - tooltipHeight - padding;
            }
            if (top < 8) top = 8;

            return (
              <div
                className="fixed border rounded pointer-events-none z-[10000] p-2"
                style={{
                  left,
                  top,
                  minWidth: tooltipWidth,
                  background:
                    "linear-gradient(135deg, rgba(20, 20, 30, 0.98) 0%, rgba(15, 15, 25, 0.95) 100%)",
                  borderColor: "rgba(242, 208, 138, 0.5)",
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.9)",
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <span className="text-base">{hoveredSkill.icon}</span>
                    <span
                      className="font-semibold text-[10px]"
                      style={{ color: COLORS.ACCENT }}
                    >
                      {hoveredSkill.label}
                    </span>
                  </div>
                  <span
                    className="font-bold text-[10px]"
                    style={{
                      color:
                        hoveredSkill.level >= 99 ? "#fbbf24" : COLORS.ACCENT,
                    }}
                  >
                    {hoveredSkill.level}
                  </span>
                </div>

                {hoveredSkill.key !== "total" ? (
                  <>
                    <div
                      className="mb-0.5 text-[9px]"
                      style={{ color: "rgba(242, 208, 138, 0.8)" }}
                    >
                      XP: {Math.floor(hoveredSkill.xp).toLocaleString()}
                    </div>
                    <div
                      className="mb-1 text-[9px]"
                      style={{ color: "rgba(242, 208, 138, 0.8)" }}
                    >
                      Next level: {xpRemaining.toLocaleString()} XP
                    </div>

                    <div
                      className="rounded overflow-hidden h-1.5"
                      style={{ background: "rgba(0, 0, 0, 0.5)" }}
                    >
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${progress}%`,
                          background:
                            hoveredSkill.level >= 99
                              ? "linear-gradient(90deg, rgba(251, 191, 36, 0.9) 0%, rgba(251, 191, 36, 0.7) 100%)"
                              : "linear-gradient(90deg, rgba(34, 197, 94, 0.9) 0%, rgba(34, 197, 94, 0.7) 100%)",
                          boxShadow:
                            hoveredSkill.level >= 99
                              ? "0 0 6px rgba(251, 191, 36, 0.5)"
                              : "0 0 6px rgba(34, 197, 94, 0.4)",
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div
                    className="text-[9px]"
                    style={{ color: "rgba(242, 208, 138, 0.8)" }}
                  >
                    Total XP: {Math.floor(totalXP).toLocaleString()}
                  </div>
                )}
              </div>
            );
          })(),
          document.body,
        )}
    </div>
  );
}
