"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import {
  Users,
  Swords,
  Package,
  Activity,
  RefreshCw,
  Clock,
  TrendingUp,
} from "lucide-react";
import {
  getDashboardStats,
  getRecentActivity,
  getTopPlayersByPlaytime,
} from "@/lib/actions/dashboard";
import type { DashboardStats, RecentActivity } from "@/lib/actions/dashboard";

interface TopPlayer {
  characterId: string;
  characterName: string;
  totalPlaytime: number;
  sessionCount: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, activityData, topPlayersData] = await Promise.all([
        getDashboardStats(),
        getRecentActivity(8),
        getTopPlayersByPlaytime(5),
      ]);
      setStats(statsData);
      setActivity(activityData);
      setTopPlayers(topPlayersData);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const formatTimeAgo = (timestamp: number) => {
    if (!now) return "...";
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const formatPlaytime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "login":
        return "bg-(--color-success)";
      case "logout":
        return "bg-(--text-muted)";
      case "character_created":
        return "bg-(--accent-secondary)";
      default:
        return "bg-(--accent-primary)";
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-12 w-12 animate-spin text-(--text-muted)" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-(--text-primary)">
            Dashboard
          </h1>
          <p className="text-(--text-secondary)">
            Welcome to Hyperscape Admin Panel
          </p>
        </div>
        <RefreshCw
          className="h-5 w-5 text-(--text-secondary) cursor-pointer hover:text-(--text-primary) transition-colors"
          onClick={fetchData}
        />
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-[minmax(180px,auto)]">
        {/* Stats Cards - Row 1 & 2 Mixed */}
        <Card className="bracket-corners relative overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-(--text-secondary)">
              Total Users
            </CardTitle>
            <Users className="h-4 w-4 text-(--accent-primary)" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-(--text-primary)">
              {stats.totalUsers.toLocaleString()}
            </div>
            <p className="text-xs text-(--text-secondary) mt-1">
              Registered accounts
            </p>
            <div className="absolute -bottom-4 -right-4 h-24 w-24 bg-(--accent-primary)/5 rounded-full blur-2xl group-hover:bg-(--accent-primary)/10 transition-colors" />
          </CardContent>
        </Card>

        <Card className="bracket-corners relative overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-(--text-secondary)">
              Characters
            </CardTitle>
            <Swords className="h-4 w-4 text-(--accent-secondary)" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-(--text-primary)">
              {stats.totalCharacters.toLocaleString()}
            </div>
            <p className="text-xs text-(--text-secondary) mt-1">
              {stats.humanCharacters} human • {stats.agentCharacters} AI
            </p>
            <div className="absolute -bottom-4 -right-4 h-24 w-24 bg-(--accent-secondary)/5 rounded-full blur-2xl group-hover:bg-(--accent-secondary)/10 transition-colors" />
          </CardContent>
        </Card>

        {/* Recent Activity - Large Block (Span 2x2) */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-2 lg:row-span-2 bracket-corners flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-(--text-primary)" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden relative">
            {activity.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-(--text-muted)">
                <RefreshCw className="h-8 w-8 mb-2 opacity-20" />
                <p>No recent activity</p>
              </div>
            ) : (
              <div className="h-full overflow-y-auto custom-scrollbar endless-mask-y py-2 space-y-0 divide-y divide-(--border-secondary)">
                {activity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 py-3 hover:bg-(--bg-hover) px-2 rounded-lg transition-colors -mx-2"
                  >
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${getActivityIcon(item.type)}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-(--text-primary) truncate">
                        {item.description}
                      </p>
                      <p className="text-xs text-(--text-muted) flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {formatTimeAgo(item.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bracket-corners relative overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-(--text-secondary)">
              Total Items
            </CardTitle>
            <Package className="h-4 w-4 text-(--accent-tertiary)" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-(--text-primary)">
              {(
                stats.totalInventoryItems +
                stats.totalEquipmentItems +
                stats.totalBankItems
              ).toLocaleString()}
            </div>
            <p className="text-xs text-(--text-secondary) mt-1">
              Global economy size
            </p>
            <div className="absolute -bottom-4 -right-4 h-24 w-24 bg-(--accent-tertiary)/5 rounded-full blur-2xl group-hover:bg-(--accent-tertiary)/10 transition-colors" />
          </CardContent>
        </Card>

        <Card className="bracket-corners relative overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-(--text-secondary)">
              Active Now
            </CardTitle>
            <RefreshCw className="h-4 w-4 text-(--color-success)" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-(--text-primary)">
              {stats.activeSessions.toLocaleString()}
            </div>
            <p className="text-xs text-(--text-secondary) mt-1">
              Live sessions
            </p>
            <div className="absolute -bottom-4 -right-4 h-24 w-24 bg-(--color-success)/5 rounded-full blur-2xl group-hover:bg-(--color-success)/10 transition-colors" />
          </CardContent>
        </Card>

        {/* Top Players - Wide Block at Bottom (Span 4) */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-4 bracket-corners">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-(--accent-primary)" />
              Top Players by Playtime
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPlayers.length === 0 ? (
              <div className="text-center py-8 text-(--text-muted)">
                No playtime data available
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {topPlayers.map((player, index) => (
                  <div
                    key={player.characterId}
                    className="flex items-center gap-3 p-3 rounded-lg bg-(--bg-secondary) border border-(--border-secondary) hover:border-(--accent-primary)/30 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-(--bg-tertiary) flex items-center justify-center shrink-0 font-bold text-(--accent-primary) group-hover:scale-110 transition-transform">
                      #{index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-(--text-primary) truncate">
                        {player.characterName}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-(--text-secondary) mt-0.5">
                        <Clock className="h-3 w-3" />
                        <span>{formatPlaytime(player.totalPlaytime)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
