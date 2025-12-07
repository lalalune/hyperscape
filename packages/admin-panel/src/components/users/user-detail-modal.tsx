'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui';
import { getUserFullDetails, type UserFullDetails } from '@/lib/actions/users';
import { CharacterDetailModal } from '@/components/characters/character-detail-modal';
import { RefreshCw, User, Bot, Wallet, Calendar, Clock, Package, Shield, Backpack } from 'lucide-react';

interface UserDetailModalProps {
  userId: string;
  onClose: () => void;
}

export function UserDetailModal({ userId, onClose }: UserDetailModalProps) {
  const [user, setUser] = useState<UserFullDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserDetails() {
      setLoading(true);
      try {
        const data = await getUserFullDetails(userId);
        setUser(data);
      } catch (error) {
        console.error('Failed to fetch user details:', error);
      }
      setLoading(false);
    }

    fetchUserDetails();
  }, [userId]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatLastLogin = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return formatDate(new Date(timestamp).toISOString());
  };

  const formatPlaytime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  };

  const getRoleBadges = (roles: string) => {
    if (!roles) return null;
    return roles.split(',').map((role) => (
      <Badge
        key={role}
        variant={role.trim() === 'admin' ? 'error' : 'default'}
        size="sm"
      >
        {role.trim()}
      </Badge>
    ));
  };

  if (loading) {
    return (
      <Dialog open onClose={onClose} onBack={onClose} title="User Details">
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="h-12 w-12 animate-spin text-[var(--text-muted)]" />
        </div>
      </Dialog>
    );
  }

  if (!user) {
    return (
      <Dialog open onClose={onClose} onBack={onClose} title="User Details">
        <div className="p-6 text-center text-[var(--text-muted)]">
          User not found
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open onClose={onClose} onBack={onClose} title="User Details">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white font-bold text-2xl">
            {user.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">{user.name}</h2>
            <div className="flex items-center gap-2 mt-2">
              {user.wallet && (
                <div className="flex items-center gap-1 text-sm text-[var(--text-secondary)]">
                  <Wallet className="h-4 w-4" />
                  <span className="font-mono">
                    {user.wallet.slice(0, 6)}...{user.wallet.slice(-4)}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-2">{getRoleBadges(user.roles)}</div>
          </div>
        </div>

        {/* User Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* User Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-[var(--text-secondary)]">User ID</p>
                <p className="text-sm font-mono text-[var(--text-primary)]">{user.id}</p>
              </div>
              {user.privyUserId && (
                <div>
                  <p className="text-sm text-[var(--text-secondary)]">Privy ID</p>
                  <p className="text-sm font-mono text-[var(--text-primary)]">{user.privyUserId}</p>
                </div>
              )}
              {user.farcasterFid && (
                <div>
                  <p className="text-sm text-[var(--text-secondary)]">Farcaster FID</p>
                  <p className="text-sm font-mono text-[var(--text-primary)]">{user.farcasterFid}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Created</p>
                <div className="flex items-center gap-1 text-sm text-[var(--text-primary)]">
                  <Calendar className="h-4 w-4" />
                  {formatDate(user.createdAt)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Total Characters</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {user.characters.length}
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Total Sessions</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {user.totalSessions}
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Total Playtime</p>
                <div className="flex items-center gap-1 text-xl font-bold text-[var(--text-primary)]">
                  <Clock className="h-5 w-5" />
                  {formatPlaytime(user.totalPlaytimeMinutes)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Items Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total Items Across All Characters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Backpack className="h-5 w-5 text-[var(--accent-primary)]" />
                  <p className="text-sm text-[var(--text-secondary)]">Inventory</p>
                </div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {user.totalInventoryItems}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Shield className="h-5 w-5 text-[var(--color-info)]" />
                  <p className="text-sm text-[var(--text-secondary)]">Equipment</p>
                </div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {user.totalEquipmentItems}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Package className="h-5 w-5 text-[var(--accent-secondary)]" />
                  <p className="text-sm text-[var(--text-secondary)]">Bank</p>
                </div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {user.totalBankItems}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Characters */}
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Characters ({user.characters.length})
          </h3>
          {user.characters.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-[var(--text-muted)]">
                No characters yet
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {user.characters.map((char) => (
                <Card
                  key={char.id}
                  className="bracket-corners cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                  onClick={() => setSelectedCharacterId(char.id)}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
                          {char.isAgent ? (
                            <Bot className="h-5 w-5 text-[var(--accent-secondary)]" />
                          ) : (
                            <User className="h-5 w-5 text-[var(--text-secondary)]" />
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-base">{char.name}</CardTitle>
                          <Badge variant={char.isAgent ? 'warning' : 'info'} size="sm">
                            {char.isAgent ? 'Agent' : 'Human'}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[var(--text-secondary)]">Combat Lvl</p>
                        <p className="text-xl font-bold text-[var(--text-primary)]">
                          {char.combatLevel || 3}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Health Bar */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-[var(--text-secondary)]">Health</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {char.health || 100}/{char.maxHealth || 100}
                        </p>
                      </div>
                      <div className="w-full h-2 bg-[var(--bg-tertiary)] rounded-full">
                        <div
                          className="h-2 bg-[var(--color-success)] rounded-full transition-all"
                          style={{
                            width: `${((char.health || 100) / (char.maxHealth || 100)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Coins */}
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-[var(--text-secondary)]">Coins</p>
                      <p className="text-lg font-bold text-[var(--accent-secondary)]">
                        {(char.coins || 0).toLocaleString()}
                      </p>
                    </div>

                    {/* Item Counts */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-secondary)]">
                      <div className="text-center">
                        <p className="text-xs text-[var(--text-secondary)]">Inv</p>
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {char.inventoryCount}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-[var(--text-secondary)]">Equip</p>
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {char.equipmentCount}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-[var(--text-secondary)]">Bank</p>
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {char.bankCount}
                        </p>
                      </div>
                    </div>

                    {/* Last Login */}
                    <div className="pt-2 border-t border-[var(--border-secondary)]">
                      <p className="text-xs text-[var(--text-secondary)]">Last Login</p>
                      <p className="text-sm text-[var(--text-primary)]">
                        {formatLastLogin(char.lastLogin)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Character Detail Modal */}
      {selectedCharacterId && (
        <CharacterDetailModal
          characterId={selectedCharacterId}
          onClose={onClose}
          onBack={() => setSelectedCharacterId(null)}
        />
      )}
    </Dialog>
  );
}
