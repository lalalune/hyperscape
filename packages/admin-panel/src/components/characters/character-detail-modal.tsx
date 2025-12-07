'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui';
import { getCharacterById } from '@/lib/actions/characters';
import {
  RefreshCw,
  User,
  Bot,
  Calendar,
  Clock,
  Package,
  Shield,
  Backpack,
  Swords,
  Heart,
  Coins,
  MapPin,
  Target,
  Axe,
  Fish,
  Flame,
  ChefHat,
  Pickaxe,
  TrendingUp,
  Trophy,
} from 'lucide-react';

interface CharacterDetailModalProps {
  characterId: string;
  onClose: () => void;
  onBack?: () => void;
}

type CharacterData = Awaited<ReturnType<typeof getCharacterById>>;

export function CharacterDetailModal({ characterId, onClose, onBack }: CharacterDetailModalProps) {
  const [character, setCharacter] = useState<CharacterData>(null);
  const [loading, setLoading] = useState(true);

  // If no onBack is provided, use onClose as the back action
  const handleBack = onBack || onClose;

  useEffect(() => {
    async function fetchCharacterDetails() {
      setLoading(true);
      try {
        const data = await getCharacterById(characterId);
        setCharacter(data);
      } catch (error) {
        console.error('Failed to fetch character details:', error);
      }
      setLoading(false);
    }

    fetchCharacterDetails();
  }, [characterId]);

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
    return formatDate(timestamp);
  };

  const formatPlaytime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  };

  const formatPosition = (x: number | null, y: number | null, z: number | null) => {
    if (x === null || y === null || z === null) return 'Unknown';
    return `${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`;
  };

  if (loading) {
    return (
      <Dialog open onClose={onClose} onBack={handleBack} title="Character Details">
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="h-12 w-12 animate-spin text-[var(--text-muted)]" />
        </div>
      </Dialog>
    );
  }

  if (!character) {
    return (
      <Dialog open onClose={onClose} onBack={handleBack} title="Character Details">
        <div className="p-6 text-center text-[var(--text-muted)]">Character not found</div>
      </Dialog>
    );
  }

  const combatSkills = [
    { name: 'Attack', level: character.attackLevel, xp: character.attackXp, icon: Swords },
    { name: 'Strength', level: character.strengthLevel, xp: character.strengthXp, icon: TrendingUp },
    { name: 'Defense', level: character.defenseLevel, xp: character.defenseXp, icon: Shield },
    { name: 'Constitution', level: character.constitutionLevel, xp: character.constitutionXp, icon: Heart },
    { name: 'Ranged', level: character.rangedLevel, xp: character.rangedXp, icon: Target },
  ];

  const gatheringSkills = [
    { name: 'Mining', level: character.miningLevel, xp: character.miningXp, icon: Pickaxe },
    { name: 'Woodcutting', level: character.woodcuttingLevel, xp: character.woodcuttingXp, icon: Axe },
    { name: 'Fishing', level: character.fishingLevel, xp: character.fishingXp, icon: Fish },
    { name: 'Firemaking', level: character.firemakingLevel, xp: character.firemakingXp, icon: Flame },
    { name: 'Cooking', level: character.cookingLevel, xp: character.cookingXp, icon: ChefHat },
  ];

  return (
    <Dialog open onClose={onClose} onBack={handleBack} title="Character Details">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
            {character.isAgent ? (
              <Bot className="h-8 w-8 text-[var(--accent-secondary)]" />
            ) : (
              <User className="h-8 w-8 text-[var(--text-secondary)]" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">{character.name}</h2>
              <Badge variant={character.isAgent ? 'warning' : 'info'}>
                {character.isAgent ? 'AI Agent' : 'Human'}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-[var(--text-secondary)]">
              <div className="flex items-center gap-1">
                <Swords className="h-4 w-4" />
                <span>Combat Lvl {character.combatLevel || 3}</span>
              </div>
              {character.user && (
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>Account: {character.user.name}</span>
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-[var(--text-secondary)]">Total XP</p>
            <p className="text-2xl font-bold text-[var(--accent-primary)]">
              {(character.totalXp || 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Agent Info Banner (if AI agent) */}
        {character.isAgent && character.agentMapping && (
          <Card className="bg-gradient-to-r from-[var(--accent-secondary)]/10 to-[var(--accent-tertiary)]/10 border-[var(--accent-secondary)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Bot className="h-8 w-8 text-[var(--accent-secondary)]" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">ElizaOS AI Agent</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Agent: {character.agentMapping.agentName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[var(--text-secondary)]">Agent ID</p>
                  <p className="text-xs font-mono text-[var(--text-primary)]">
                    {character.agentMapping.agentId.slice(0, 8)}...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Basic Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Character Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Character Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-[var(--text-secondary)]">ID</p>
                <p className="text-xs font-mono text-[var(--text-primary)]">{character.id}</p>
              </div>
              {character.wallet && (
                <div>
                  <p className="text-sm text-[var(--text-secondary)]">Wallet</p>
                  <p className="text-xs font-mono text-[var(--text-primary)]">
                    {character.wallet.slice(0, 6)}...{character.wallet.slice(-4)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Created</p>
                <div className="flex items-center gap-1 text-sm text-[var(--text-primary)]">
                  <Calendar className="h-4 w-4" />
                  {formatDate(character.createdAt)}
                </div>
              </div>
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Last Login</p>
                <div className="flex items-center gap-1 text-sm text-[var(--text-primary)]">
                  <Clock className="h-4 w-4" />
                  {formatLastLogin(character.lastLogin)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Health</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 bg-[var(--bg-tertiary)] rounded-full">
                    <div
                      className="h-2 bg-[var(--color-success)] rounded-full"
                      style={{
                        width: `${((character.health || 100) / (character.maxHealth || 100)) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm text-[var(--text-primary)]">
                    {character.health || 100}/{character.maxHealth || 100}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Coins</p>
                <div className="flex items-center gap-1 text-xl font-bold text-[var(--accent-secondary)]">
                  <Coins className="h-5 w-5" />
                  {(character.coins || 0).toLocaleString()}
                </div>
              </div>
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Position</p>
                <div className="flex items-center gap-1 text-xs font-mono text-[var(--text-primary)]">
                  <MapPin className="h-4 w-4" />
                  {formatPosition(character.positionX, character.positionY, character.positionZ)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Sessions</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {character.totalSessions || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Playtime</p>
                <div className="flex items-center gap-1 text-xl font-bold text-[var(--text-primary)]">
                  <Clock className="h-5 w-5" />
                  {formatPlaytime(character.totalPlaytimeMinutes || 0)}
                </div>
              </div>
              <div>
                <p className="text-sm text-[var(--text-secondary)]">NPC Kills</p>
                <div className="flex items-center gap-1 text-xl font-bold text-[var(--text-primary)]">
                  <Trophy className="h-5 w-5" />
                  {character.kills?.reduce((acc, k) => acc + (k.killCount || 0), 0) || 0}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Items Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Backpack className="h-5 w-5 text-[var(--accent-primary)]" />
                  <p className="text-sm text-[var(--text-secondary)]">Inventory</p>
                </div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {character.inventory?.length || 0}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Shield className="h-5 w-5 text-[var(--color-info)]" />
                  <p className="text-sm text-[var(--text-secondary)]">Equipment</p>
                </div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {character.equipment?.filter(e => e.itemId).length || 0}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Package className="h-5 w-5 text-[var(--accent-secondary)]" />
                  <p className="text-sm text-[var(--text-secondary)]">Bank</p>
                </div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {character.bank?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Combat Skills */}
        <Card className="bracket-corners">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Swords className="h-5 w-5 text-[var(--accent-primary)]" />
              Combat Skills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {combatSkills.map((skill) => {
                const Icon = skill.icon;
                return (
                  <div key={skill.name} className="text-center">
                    <Icon className="h-6 w-6 mx-auto mb-2 text-[var(--text-secondary)]" />
                    <p className="text-xs text-[var(--text-secondary)] mb-1">{skill.name}</p>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">{skill.level || 1}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {(skill.xp || 0).toLocaleString()} XP
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Gathering Skills */}
        <Card className="bracket-corners">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Axe className="h-5 w-5 text-[var(--color-success)]" />
              Gathering Skills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {gatheringSkills.map((skill) => {
                const Icon = skill.icon;
                return (
                  <div key={skill.name} className="text-center">
                    <Icon className="h-6 w-6 mx-auto mb-2 text-[var(--text-secondary)]" />
                    <p className="text-xs text-[var(--text-secondary)] mb-1">{skill.name}</p>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">{skill.level || 1}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {(skill.xp || 0).toLocaleString()} XP
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Equipment Details */}
        {character.equipment && character.equipment.filter(e => e.itemId).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Equipped Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {character.equipment
                  .filter(e => e.itemId)
                  .map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded"
                    >
                      <p className="text-xs text-[var(--text-secondary)] uppercase mb-1">
                        {item.slotType}
                      </p>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{item.itemId}</p>
                      {item.quantity && item.quantity > 1 && (
                        <p className="text-xs text-[var(--text-muted)]">x{item.quantity}</p>
                      )}
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* NPC Kills */}
        {character.kills && character.kills.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">NPC Kill Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {character.kills
                  .sort((a, b) => (b.killCount || 0) - (a.killCount || 0))
                  .slice(0, 12)
                  .map((kill, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded text-center"
                    >
                      <p className="text-sm font-medium text-[var(--text-primary)]">{kill.npcId}</p>
                      <p className="text-2xl font-bold text-[var(--accent-primary)] mt-1">
                        {kill.killCount}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">kills</p>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Inventory Preview */}
        {character.inventory && character.inventory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inventory ({character.inventory.length} items)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 max-h-64 overflow-y-auto">
                {character.inventory.slice(0, 24).map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded text-center"
                  >
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                      {item.itemId}
                    </p>
                    <p className="text-sm font-bold text-[var(--accent-secondary)]">x{item.quantity}</p>
                  </div>
                ))}
              </div>
              {character.inventory.length > 24 && (
                <p className="text-xs text-[var(--text-muted)] text-center mt-2">
                  + {character.inventory.length - 24} more items
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Bank Preview */}
        {character.bank && character.bank.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bank ({character.bank.length} items)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 max-h-64 overflow-y-auto">
                {character.bank.slice(0, 24).map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded text-center"
                  >
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                      {item.itemId}
                    </p>
                    <p className="text-sm font-bold text-[var(--accent-secondary)]">x{item.quantity}</p>
                  </div>
                ))}
              </div>
              {character.bank.length > 24 && (
                <p className="text-xs text-[var(--text-muted)] text-center mt-2">
                  + {character.bank.length - 24} more items
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Dialog>
  );
}
