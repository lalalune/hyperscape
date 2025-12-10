import React, { useEffect, useState } from "react";
import { Shield, AlertTriangle, CheckCircle, Star, Skull } from "lucide-react";

type ReputationLabel = "TRUSTED" | "SCAMMER" | "HACKER" | "BANNED" | "VERIFIED";

interface ReputationBadgeData {
  label: ReputationLabel;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  tooltip: string;
}

const BADGES: Record<ReputationLabel, ReputationBadgeData> = {
  TRUSTED: {
    label: "TRUSTED",
    icon: <CheckCircle className="w-3 h-3" />,
    color: "text-green-400",
    bgColor: "bg-green-500/20",
    tooltip: "Trusted community member",
  },
  VERIFIED: {
    label: "VERIFIED",
    icon: <Star className="w-3 h-3" />,
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    tooltip: "Verified identity",
  },
  SCAMMER: {
    label: "SCAMMER",
    icon: <AlertTriangle className="w-3 h-3" />,
    color: "text-orange-400",
    bgColor: "bg-orange-500/20",
    tooltip: "Reported for scamming",
  },
  HACKER: {
    label: "HACKER",
    icon: <Shield className="w-3 h-3" />,
    color: "text-red-400",
    bgColor: "bg-red-500/20",
    tooltip: "Flagged for exploiting",
  },
  BANNED: {
    label: "BANNED",
    icon: <Skull className="w-3 h-3" />,
    color: "text-red-500",
    bgColor: "bg-red-600/30",
    tooltip: "Banned from network",
  },
};

interface ReputationNameplateProps {
  agentId?: number;
  playerId?: string;
  className?: string;
  showTooltip?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * ReputationNameplate - Shows reputation badges for players
 *
 * Can be used in:
 * - Player nameplates above heads
 * - Player context menus
 * - Chat messages
 * - Trade windows
 */
export default function ReputationNameplate({
  agentId,
  playerId,
  className = "",
  showTooltip = true,
  size = "md",
}: ReputationNameplateProps) {
  const [labels, setLabels] = useState<ReputationLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredBadge, setHoveredBadge] = useState<ReputationLabel | null>(
    null
  );

  useEffect(() => {
    const fetchLabels = async () => {
      if (!agentId && !playerId) {
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (agentId) params.set("agentId", String(agentId));
      if (playerId) params.set("playerId", playerId);

      const response = await fetch(`/api/moderation/labels?${params}`);
      if (response.ok) {
        const data = await response.json();
        setLabels(data.labels || []);
      }

      setLoading(false);
    };

    fetchLabels();
  }, [agentId, playerId]);

  if (loading || labels.length === 0) {
    return null;
  }

  const sizeClasses = {
    sm: "gap-0.5",
    md: "gap-1",
    lg: "gap-1.5",
  };

  const badgeSizeClasses = {
    sm: "p-0.5",
    md: "p-1",
    lg: "px-1.5 py-1",
  };

  return (
    <div className={`inline-flex items-center ${sizeClasses[size]} ${className}`}>
      {labels.map((label) => {
        const badge = BADGES[label];
        if (!badge) return null;

        return (
          <div
            key={label}
            className="relative"
            onMouseEnter={() => setHoveredBadge(label)}
            onMouseLeave={() => setHoveredBadge(null)}
          >
            <div
              className={`inline-flex items-center ${badgeSizeClasses[size]} rounded ${badge.bgColor} ${badge.color}`}
            >
              {badge.icon}
              {size === "lg" && (
                <span className="ml-1 text-xs font-medium">{badge.label}</span>
              )}
            </div>

            {/* Tooltip */}
            {showTooltip && hoveredBadge === label && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[#1a1005] border border-[#8b4513]/30 rounded text-xs text-[#f2d08a] whitespace-nowrap z-50 shadow-lg">
                {badge.tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1a1005]" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Inline badge for use in text/chat
 */
export function ReputationBadge({
  label,
  size = "sm",
}: {
  label: ReputationLabel;
  size?: "sm" | "md";
}) {
  const badge = BADGES[label];
  if (!badge) return null;

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${
        size === "sm" ? "px-1 py-0.5 text-xs" : "px-1.5 py-0.5 text-sm"
      } rounded ${badge.bgColor} ${badge.color}`}
    >
      {badge.icon}
      <span className="font-medium">{badge.label}</span>
    </span>
  );
}

/**
 * Hook to get reputation labels for a player
 */
export function useReputationLabels(agentId?: number, playerId?: string) {
  const [labels, setLabels] = useState<ReputationLabel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLabels = async () => {
      if (!agentId && !playerId) {
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (agentId) params.set("agentId", String(agentId));
      if (playerId) params.set("playerId", playerId);

      const response = await fetch(`/api/moderation/labels?${params}`);
      if (response.ok) {
        const data = await response.json();
        setLabels(data.labels || []);
      }

      setLoading(false);
    };

    fetchLabels();
  }, [agentId, playerId]);

  return { labels, loading, isFlagged: labels.some((l) => l !== "TRUSTED" && l !== "VERIFIED") };
}
