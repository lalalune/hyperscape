'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Users, Swords, Package, Activity, Bot, User as UserIcon, RefreshCw, Clock, TrendingUp } from 'lucide-react';
import { getDashboardStats, getRecentActivity, getTopPlayersByPlaytime } from '@/lib/actions/dashboard';
import type { DashboardStats, RecentActivity } from '@/lib/actions/dashboard';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [topPlayers, setTopPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      console.error('Failed to fetch dashboard data:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
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
      case 'login':
        return 'bg-[var(--color-success)]';
      case 'logout':
        return 'bg-[var(--text-muted)]';
      case 'character_created':
        return 'bg-[var(--accent-secondary)]';
      default:
        return 'bg-[var(--accent-primary)]';
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-12 w-12 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
          <p className="text-[var(--text-secondary)]">
            Welcome to Hyperscape Admin Panel
          </p>
        </div>
        <RefreshCw
          className="h-5 w-5 text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)] transition-colors"
          onClick={fetchData}
        />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bracket-corners">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
              Total Users
            </CardTitle>
            <Users className="h-4 w-4 text-[var(--accent-primary)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[var(--text-primary)]">
              {stats.totalUsers.toLocaleString()}
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Registered accounts
            </p>
          </CardContent>
        </Card>

        <Card className="bracket-corners">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
              Characters
            </CardTitle>
            <Swords className="h-4 w-4 text-[var(--accent-secondary)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[var(--text-primary)]">
              {stats.totalCharacters.toLocaleString()}
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              {stats.humanCharacters} human, {stats.agentCharacters} AI
            </p>
          </CardContent>
        </Card>

        <Card className="bracket-corners">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
              Total Items
            </CardTitle>
            <Package className="h-4 w-4 text-[var(--accent-tertiary)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[var(--text-primary)]">
              {(stats.totalInventoryItems + stats.totalEquipmentItems + stats.totalBankItems).toLocaleString()}
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Across all players
            </p>
          </CardContent>
        </Card>

        <Card className="bracket-corners">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
              Active Now
            </CardTitle>
            <Activity className="h-4 w-4 text-[var(--color-success)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[var(--text-primary)]">
              {stats.activeSessions.toLocaleString()}
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Players online
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Top Players */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] text-center py-8">
                No recent activity
              </p>
            ) : (
              <div className="space-y-4">
                {activity.map((item) => (
                  <div key={item.id} className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${getActivityIcon(item.type)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text-primary)] truncate">
                        {item.description}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {formatTimeAgo(item.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[var(--accent-primary)]" />
              Top Players by Playtime
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPlayers.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] text-center py-8">
                No playtime data yet
              </p>
            ) : (
              <div className="space-y-4">
                {topPlayers.map((player, index) => (
                  <div key={player.characterId} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
                      <span className="text-sm font-bold text-[var(--accent-primary)]">
                        #{index + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {player.characterName}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <Clock className="h-3 w-3" />
                        <span>{formatPlaytime(player.totalPlaytime)}</span>
                        <span>•</span>
                        <span>{player.sessionCount} sessions</span>
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
