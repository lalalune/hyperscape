/**
 * useXPOrbState - State management hook for XP Progress Orbs
 *
 * Handles all state logic for the XP visual feedback system:
 * - Active skills tracking (which skills have recent XP gains)
 * - Level-up detection and animation triggers
 * - Floating XP drop grouping (RS3-style game tick grouping)
 * - Orb fade timers
 * - Event subscription to XP_DROP_RECEIVED events
 *
 * Extracted from XPProgressOrb for Single Responsibility Principle (SRP)
 */

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { EventType, SKILL_ICONS } from "@hyperforge/shared";
import type { ClientWorld } from "../../../types";

// === CONSTANTS ===

/** Game tick duration in ms (OSRS-style) */
export const GAME_TICK_MS = 600;
/** Duration before orb starts fading (in ms) - ~10 seconds like RuneLite default */
export const ORB_VISIBLE_DURATION_MS = 10000;
/** Duration of the fade-out animation (in ms) */
export const ORB_FADE_DURATION_MS = 1000;
/** Time window to group XP drops (same game tick) */
const GROUP_WINDOW_MS = 600;

// === TYPES ===

export interface XPDropData {
  skill: string;
  xpGained: number;
  newXp: number;
  newLevel: number;
}

/** Grouped XP drop - multiple skills combined into one floating element */
export interface GroupedXPDrop {
  id: number;
  skills: Array<{ skill: string; amount: number }>;
  totalAmount: number;
  startTime: number;
}

/** Track active skills with their data for orb display */
export interface ActiveSkill {
  skill: string;
  level: number;
  xp: number;
  lastGainTime: number;
  isFading: boolean;
}

/** Computed skill data with memoized progress values */
export interface SkillWithProgress extends ActiveSkill {
  skillKey: string;
  icon: string;
  progress: number;
  xpToLevel: number;
}

// === UTILITY FUNCTIONS ===

/** Normalize skill names (hitpoints/constitution, defence/defense are the same) */
export function normalizeSkillName(skill: string): string {
  const lower = skill.toLowerCase();
  if (lower === "hitpoints") return "constitution";
  if (lower === "defense") return "defence";
  return lower;
}

// Pre-computed XP table for O(1) lookups (OSRS formula)
// Computed once at module load instead of looping on every render
const XP_TABLE: readonly number[] = (() => {
  const table: number[] = new Array(100).fill(0);
  for (let level = 2; level <= 99; level++) {
    let total = 0;
    for (let i = 1; i < level; i++) {
      total += Math.floor(i + 300 * Math.pow(2, i / 7));
    }
    table[level] = Math.floor(total / 4);
  }
  return table;
})();

/** O(1) lookup for XP required at a given level */
export function getXPForLevel(level: number): number {
  if (level < 1) return 0;
  if (level > 99) return XP_TABLE[99];
  return XP_TABLE[level];
}

/** Get level for a given XP amount (binary search for efficiency) */
function getLevelForXP(xp: number): number {
  if (xp <= 0) return 1;
  // Binary search through XP_TABLE to find highest level where XP_TABLE[level] <= xp
  let low = 1;
  let high = 99;
  while (low < high) {
    const mid = Math.ceil((low + high + 1) / 2);
    if (XP_TABLE[mid] <= xp) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

/** Type guard for runtime validation of XP drop data from server */
function isValidXPDropData(data: unknown): data is XPDropData {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.skill === "string" &&
    obj.skill.length > 0 &&
    typeof obj.xpGained === "number" &&
    typeof obj.newXp === "number" &&
    typeof obj.newLevel === "number" &&
    obj.xpGained >= 0 &&
    obj.newXp >= 0 &&
    obj.newLevel >= 1 &&
    obj.newLevel <= 99
  );
}

// === HOOK ===

export interface UseXPOrbStateResult {
  /** Computed skill data with memoized progress values */
  skillsWithProgress: SkillWithProgress[];
  /** Currently leveling up skill (for animation) */
  levelUpSkill: string | null;
  /** Active floating XP drops */
  floatingDrops: GroupedXPDrop[];
  /** Currently hovered skill key */
  hoveredSkill: string | null;
  /** Set hovered skill for tooltip display */
  setHoveredSkill: (skill: string | null) => void;
}

export function useXPOrbState(world: ClientWorld): UseXPOrbStateResult {
  // Track multiple active skills - each gets its own orb
  const [activeSkills, setActiveSkills] = useState<ActiveSkill[]>([]);
  const [levelUpSkill, setLevelUpSkill] = useState<string | null>(null);
  const [floatingDrops, setFloatingDrops] = useState<GroupedXPDrop[]>([]);
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);

  const dropIdRef = useRef(0);
  const pendingDropRef = useRef<GroupedXPDrop | null>(null);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousLevelsRef = useRef<Record<string, number>>({});
  const activeSkillsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Initialize previousLevelsRef from player's current skills on mount
  // This ensures level-up detection works even for first XP gain in a skill
  useEffect(() => {
    const player = world.entities?.player;
    if (!player) return;

    // Try to get skills from player data
    const playerData = player.data as {
      skills?: Record<string, { level: number; xp: number }>;
    };
    const skills = playerData?.skills;

    if (skills) {
      const levels: Record<string, number> = {};
      for (const [skillName, skillData] of Object.entries(skills)) {
        if (skillData && typeof skillData.level === "number") {
          levels[normalizeSkillName(skillName)] = skillData.level;
        }
      }
      previousLevelsRef.current = levels;
    }
  }, [world.entities?.player]);

  // Calculate progress to next level (uses pre-computed XP table)
  const calculateProgress = useCallback((xp: number, level: number): number => {
    if (level >= 99) return 100;
    const currentLevelXP = getXPForLevel(level);
    const nextLevelXP = getXPForLevel(level + 1);
    const xpInLevel = xp - currentLevelXP;
    const xpNeeded = nextLevelXP - currentLevelXP;
    return Math.min(100, Math.max(0, (xpInLevel / xpNeeded) * 100));
  }, []);

  // Calculate XP to next level (uses pre-computed XP table)
  const getXPToNextLevel = useCallback((xp: number, level: number): number => {
    if (level >= 99) return 0;
    const nextLevelXP = getXPForLevel(level + 1);
    return nextLevelXP - xp;
  }, []);

  // Memoize derived skill data to avoid recalculating on every render
  const skillsWithProgress = useMemo((): SkillWithProgress[] => {
    return activeSkills.map((skill) => {
      const skillKey = normalizeSkillName(skill.skill);
      return {
        ...skill,
        skillKey,
        icon:
          SKILL_ICONS[skillKey] ||
          SKILL_ICONS[skill.skill.toLowerCase()] ||
          "\u2B50",
        progress: calculateProgress(skill.xp, skill.level),
        xpToLevel: getXPToNextLevel(skill.xp, skill.level),
      };
    });
  }, [activeSkills, calculateProgress, getXPToNextLevel]);

  useEffect(() => {
    const clearActiveSkillsTimeout = () => {
      if (activeSkillsTimeoutRef.current) {
        clearTimeout(activeSkillsTimeoutRef.current);
        activeSkillsTimeoutRef.current = null;
      }
    };

    const scheduleNextUpdate = (skills: ActiveSkill[]) => {
      clearActiveSkillsTimeout();
      if (skills.length === 0) return;

      const now = Date.now();
      let nextDelay = Number.POSITIVE_INFINITY;

      for (let i = 0; i < skills.length; i++) {
        const skill = skills[i];
        const fadeIn = ORB_VISIBLE_DURATION_MS - (now - skill.lastGainTime);
        const removeIn =
          ORB_VISIBLE_DURATION_MS +
          ORB_FADE_DURATION_MS -
          (now - skill.lastGainTime);
        if (!skill.isFading && fadeIn > 0) {
          nextDelay = Math.min(nextDelay, fadeIn);
        }
        if (removeIn > 0) {
          nextDelay = Math.min(nextDelay, removeIn);
        }
      }

      if (!Number.isFinite(nextDelay)) return;
      activeSkillsTimeoutRef.current = setTimeout(
        () => {
          let needsReschedule = false;
          let nextSkillsSnapshot: ActiveSkill[] | null = null;
          setActiveSkills((prev) => {
            if (prev.length === 0) return prev;

            const currentNow = Date.now();
            const fadeThreshold = ORB_VISIBLE_DURATION_MS;
            const removeThreshold =
              ORB_VISIBLE_DURATION_MS + ORB_FADE_DURATION_MS;

            let hasChanges = false;
            let hasRemovals = false;

            for (let i = 0; i < prev.length; i++) {
              const elapsed = currentNow - prev[i].lastGainTime;
              if (!prev[i].isFading && elapsed >= fadeThreshold)
                hasChanges = true;
              if (elapsed >= removeThreshold) hasRemovals = true;
            }

            if (!hasChanges && !hasRemovals) {
              needsReschedule = true;
              nextSkillsSnapshot = prev;
              return prev;
            }

            const result: ActiveSkill[] = [];
            for (let i = 0; i < prev.length; i++) {
              const skill = prev[i];
              const elapsed = currentNow - skill.lastGainTime;

              if (hasRemovals && elapsed >= removeThreshold) continue;

              if (!skill.isFading && elapsed >= fadeThreshold) {
                result.push({
                  skill: skill.skill,
                  level: skill.level,
                  xp: skill.xp,
                  lastGainTime: skill.lastGainTime,
                  isFading: true,
                });
              } else {
                result.push(skill);
              }
            }

            return result;
          });

          if (needsReschedule && nextSkillsSnapshot) {
            scheduleNextUpdate(nextSkillsSnapshot);
          }
        },
        Math.max(16, nextDelay),
      );
    };

    scheduleNextUpdate(activeSkills);

    return clearActiveSkillsTimeout;
  }, [activeSkills]);

  // Function to finalize and display a grouped drop
  const finalizeGroupedDrop = useCallback((drop: GroupedXPDrop) => {
    setFloatingDrops((prev) => [...prev, drop]);

    setTimeout(() => {
      setFloatingDrops((prev) => prev.filter((d) => d.id !== drop.id));
    }, 1500);
  }, []);

  // XP drop event handler
  useEffect(() => {
    let levelUpTimeout: ReturnType<typeof setTimeout>;

    const handleXPDrop = (data: unknown) => {
      if (!isValidXPDropData(data)) {
        console.warn("[XPProgressOrb] Invalid XP drop data received:", data);
        return;
      }
      const now = Date.now();
      const skillKey = normalizeSkillName(data.skill);

      // Check for level up
      const prevLevel = previousLevelsRef.current[skillKey];

      // Calculate what level they were at before this XP gain
      // This handles cases where prevLevel wasn't initialized (e.g., first XP drop for this skill)
      const xpBefore = data.newXp - data.xpGained;
      const calculatedPrevLevel = getLevelForXP(xpBefore);
      const effectivePrevLevel = prevLevel ?? calculatedPrevLevel;

      if (data.newLevel > effectivePrevLevel) {
        setLevelUpSkill(skillKey);

        // Emit client-side level-up event (single source of truth)
        // Note: Server also emits SKILLS_LEVEL_UP but doesn't send over WebSocket
        world.emit(EventType.SKILLS_LEVEL_UP, {
          skill: data.skill,
          oldLevel: effectivePrevLevel,
          newLevel: data.newLevel,
          timestamp: Date.now(),
        });

        clearTimeout(levelUpTimeout);
        levelUpTimeout = setTimeout(() => {
          setLevelUpSkill(null);
        }, 600);
      }
      previousLevelsRef.current[skillKey] = data.newLevel;

      // Update active skills for orb display
      setActiveSkills((prev) => {
        const existingIdx = prev.findIndex(
          (s) => normalizeSkillName(s.skill) === skillKey,
        );
        const newSkill: ActiveSkill = {
          skill: data.skill,
          level: data.newLevel,
          xp: data.newXp,
          lastGainTime: now,
          isFading: false,
        };

        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = newSkill;
          return updated;
        } else {
          return [...prev, newSkill];
        }
      });

      // RS3-style grouping
      if (
        pendingDropRef.current &&
        now - pendingDropRef.current.startTime < GROUP_WINDOW_MS
      ) {
        pendingDropRef.current.skills.push({
          skill: data.skill,
          amount: data.xpGained,
        });
        pendingDropRef.current.totalAmount += data.xpGained;
      } else {
        if (pendingDropRef.current) {
          if (pendingTimeoutRef.current) {
            clearTimeout(pendingTimeoutRef.current);
          }
          finalizeGroupedDrop(pendingDropRef.current);
        }

        pendingDropRef.current = {
          id: ++dropIdRef.current,
          skills: [{ skill: data.skill, amount: data.xpGained }],
          totalAmount: data.xpGained,
          startTime: now,
        };

        pendingTimeoutRef.current = setTimeout(() => {
          if (pendingDropRef.current) {
            finalizeGroupedDrop(pendingDropRef.current);
            pendingDropRef.current = null;
          }
        }, GROUP_WINDOW_MS);
      }
    };

    world.on(EventType.XP_DROP_RECEIVED, handleXPDrop);

    return () => {
      world.off(EventType.XP_DROP_RECEIVED, handleXPDrop);
      clearTimeout(levelUpTimeout);
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
      }
    };
  }, [world, finalizeGroupedDrop]);

  return {
    skillsWithProgress,
    levelUpSkill,
    floatingDrops,
    hoveredSkill,
    setHoveredSkill,
  };
}
