import React, { useState, useEffect } from "react";
import { Agent } from "../../screens/DashboardScreen";
import { ChevronDown, ChevronUp, Swords } from "lucide-react";

interface SkillData {
  level: number;
  xp: number;
}

interface AgentSkills {
  attack?: SkillData;
  strength?: SkillData;
  defense?: SkillData;
  constitution?: SkillData;
  // ranged?: SkillData; // Hidden for melee-only MVP
  woodcutting?: SkillData;
  fishing?: SkillData;
  firemaking?: SkillData;
  cooking?: SkillData;
}

interface AgentSkillsPanelProps {
  agent: Agent;
  isViewportActive: boolean;
}

// Skill definitions with icons (melee-only MVP - ranged hidden)
const SKILL_CONFIG = [
  { key: "attack", label: "Attack", icon: "⚔️" },
  { key: "strength", label: "Strength", icon: "💪" },
  { key: "defense", label: "Defense", icon: "🛡️" },
  { key: "constitution", label: "HP", icon: "❤️" },
  // { key: "ranged", label: "Ranged", icon: "🏹" }, // Hidden for melee-only MVP
  { key: "woodcutting", label: "Woodcut", icon: "🪓" },
  { key: "fishing", label: "Fishing", icon: "🎣" },
  { key: "firemaking", label: "Fire", icon: "🔥" },
  { key: "cooking", label: "Cooking", icon: "🍳" },
] as const;

// XP calculation for progress bar
function calculateXPForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += Math.floor(i + 300 * Math.pow(2, i / 7));
  }
  return Math.floor(total / 4);
}

function getXPProgress(xp: number, level: number): number {
  if (level >= 99) return 100;
  const currentLevelXP = calculateXPForLevel(level);
  const nextLevelXP = calculateXPForLevel(level + 1);
  const xpIntoLevel = xp - currentLevelXP;
  const xpForThisLevel = nextLevelXP - currentLevelXP;
  return Math.min(100, Math.max(0, (xpIntoLevel / xpForThisLevel) * 100));
}

// Calculate combat level from skills (melee-only MVP)
function calculateCombatLevel(skills: AgentSkills): number {
  const defense = skills.defense?.level || 1;
  const constitution = skills.constitution?.level || 10;
  const attack = skills.attack?.level || 1;
  const strength = skills.strength?.level || 1;

  const base = 0.25 * (defense + constitution);
  const melee = 0.325 * (attack + strength);
  return Math.floor(base + melee);
}

function SkillRow({
  icon,
  label,
  level,
  xp,
  showProgress,
}: {
  icon: string;
  label: string;
  level: number;
  xp: number;
  showProgress?: boolean;
}) {
  const progress = getXPProgress(xp, level);

  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-sm" title={label}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        {showProgress ? (
          <div className="relative h-3 bg-black/40 rounded overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-600 to-green-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-between px-1">
              <span className="text-[8px] text-[#f2d08a]/80 font-medium truncate">
                {label}
              </span>
              <span
                className="text-[9px] text-white font-bold"
                style={{ textShadow: "0 1px 2px black" }}
              >
                {level}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-[#f2d08a]/70">{label}</span>
            <span className="text-[10px] text-[#f2d08a] font-semibold">
              {level}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export const AgentSkillsPanel: React.FC<AgentSkillsPanelProps> = ({
  agent,
  isViewportActive,
}) => {
  const [skills, setSkills] = useState<AgentSkills | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [characterId, setCharacterId] = useState<string | null>(null);

  // Fetch character ID once when agent changes
  useEffect(() => {
    if (agent.status !== "active") {
      setSkills(null);
      setCharacterId(null);
      return;
    }
    fetchCharacterId();
  }, [agent.id, agent.status]);

  // Poll for skills updates when viewport is active and we have characterId
  useEffect(() => {
    if (!isViewportActive || agent.status !== "active" || !characterId) return;

    // Fetch immediately
    fetchSkills();

    const interval = setInterval(fetchSkills, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [isViewportActive, agent.id, agent.status, characterId]);

  const fetchCharacterId = async () => {
    try {
      setLoading(true);
      setError(null);

      const mappingResponse = await fetch(
        `http://localhost:5555/api/agents/mapping/${agent.id}`,
      );

      if (!mappingResponse.ok) {
        if (mappingResponse.status === 404) {
          setError("Agent not mapped");
          return;
        }
        throw new Error(`Mapping failed: ${mappingResponse.status}`);
      }

      const mappingData = await mappingResponse.json();
      const charId = mappingData.characterId;

      if (!charId) {
        setError("No character linked");
        return;
      }

      setCharacterId(charId);
    } catch (err) {
      console.error("[AgentSkillsPanel] Error fetching character ID:", err);
      setError("Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  const fetchSkills = async () => {
    if (!characterId) return;

    try {
      const skillsResponse = await fetch(
        `http://localhost:5555/api/characters/${characterId}/skills`,
      );

      if (!skillsResponse.ok) {
        // Skills endpoint might not exist yet, use defaults
        if (skillsResponse.status === 404) {
          setSkills({
            attack: { level: 1, xp: 0 },
            strength: { level: 1, xp: 0 },
            defense: { level: 1, xp: 0 },
            constitution: { level: 10, xp: 0 },
            woodcutting: { level: 1, xp: 0 },
            fishing: { level: 1, xp: 0 },
            firemaking: { level: 1, xp: 0 },
            cooking: { level: 1, xp: 0 },
          });
          return;
        }
        throw new Error(`Skills failed: ${skillsResponse.status}`);
      }

      const skillsData = await skillsResponse.json();
      setSkills(skillsData.skills || skillsData);
      setError(null);
    } catch (err) {
      console.error("[AgentSkillsPanel] Error fetching skills:", err);
      // Set default skills on error but don't spam error state
      if (!skills) {
        setSkills({
          attack: { level: 1, xp: 0 },
          strength: { level: 1, xp: 0 },
          defense: { level: 1, xp: 0 },
          constitution: { level: 10, xp: 0 },
          woodcutting: { level: 1, xp: 0 },
          fishing: { level: 1, xp: 0 },
          firemaking: { level: 1, xp: 0 },
          cooking: { level: 1, xp: 0 },
        });
      }
    }
  };

  // Don't show if agent is inactive
  if (agent.status !== "active") {
    return null;
  }

  const totalLevel = skills
    ? SKILL_CONFIG.reduce((sum, s) => {
        const skill = skills[s.key as keyof AgentSkills];
        return sum + (skill?.level || 1);
      }, 0)
    : 0;

  const combatLevel = skills ? calculateCombatLevel(skills) : 3;

  return (
    <div className="border-t border-[#8b4513]/30 bg-[#0b0a15]/80">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-2 hover:bg-[#f2d08a]/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Swords size={14} className="text-[#f2d08a]/60" />
          <span className="text-xs font-bold text-[#f2d08a]/80 uppercase tracking-wider">
            Skills
          </span>
          {skills && (
            <span className="text-[10px] text-[#f2d08a]/50">
              Lvl {totalLevel} / Cmb {combatLevel}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={14} className="text-[#f2d08a]/40" />
        ) : (
          <ChevronDown size={14} className="text-[#f2d08a]/40" />
        )}
      </button>

      {/* Skills Grid */}
      {expanded && (
        <div className="px-2 pb-2">
          {loading && !skills ? (
            <div className="flex items-center justify-center py-3">
              <div className="animate-spin rounded-full h-4 w-4 border-t border-b border-[#f2d08a]/60" />
            </div>
          ) : error ? (
            <div className="text-center py-2 text-[10px] text-red-400/70">
              {error}
            </div>
          ) : skills ? (
            <div className="space-y-0.5">
              {/* Combat Skills (melee-only MVP: 4 skills) */}
              <div className="grid grid-cols-2 gap-x-2">
                {SKILL_CONFIG.slice(0, 4).map((skillConfig) => {
                  const skill = skills[skillConfig.key as keyof AgentSkills];
                  return (
                    <SkillRow
                      key={skillConfig.key}
                      icon={skillConfig.icon}
                      label={skillConfig.label}
                      level={skill?.level || 1}
                      xp={skill?.xp || 0}
                      showProgress={isViewportActive}
                    />
                  );
                })}
              </div>

              {/* Divider */}
              <div className="border-t border-[#8b4513]/20 my-1" />

              {/* Gathering Skills */}
              <div className="grid grid-cols-2 gap-x-2">
                {SKILL_CONFIG.slice(4).map((skillConfig) => {
                  const skill = skills[skillConfig.key as keyof AgentSkills];
                  return (
                    <SkillRow
                      key={skillConfig.key}
                      icon={skillConfig.icon}
                      label={skillConfig.label}
                      level={skill?.level || 1}
                      xp={skill?.xp || 0}
                      showProgress={isViewportActive}
                    />
                  );
                })}
              </div>

              {/* Live indicator when viewport active */}
              {isViewportActive && (
                <div className="flex items-center justify-center gap-1 mt-1 pt-1 border-t border-[#8b4513]/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[9px] text-green-500/80">
                    Live Tracking
                  </span>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
