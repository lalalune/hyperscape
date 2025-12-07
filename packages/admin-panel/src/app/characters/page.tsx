'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Input } from '@/components/ui';
import { Search, ChevronLeft, ChevronRight, RefreshCw, Swords, Bot, User } from 'lucide-react';
import { getCharacters, getCharacterStats, type CharacterWithDetails } from '@/lib/actions/characters';

export default function CharactersPage() {
  const [characters, setCharacters] = useState<CharacterWithDetails[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, agents: 0, humans: 0 });
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  
  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchCharacters = useCallback(async () => {
    setLoading(true);
    try {
      const [charsData, statsData] = await Promise.all([
        getCharacters({ page, limit, search }),
        getCharacterStats(),
      ]);
      setCharacters(charsData.characters);
      setTotal(charsData.total);
      setStats(statsData);
      setCurrentTime(Date.now());
    } catch (error) {
      console.error('Failed to fetch characters:', error);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  const formatLastLogin = useCallback((timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const diff = currentTime - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }, [currentTime]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Characters</h1>
          <p className="text-[var(--text-secondary)]">
            Browse all game characters and their stats
          </p>
        </div>
        <Button onClick={fetchCharacters} variant="secondary" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 rounded-lg bg-[var(--accent-primary)] bg-opacity-10">
              <Swords className="h-6 w-6 text-[var(--accent-primary)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)]">Total Characters</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 rounded-lg bg-[var(--color-info)] bg-opacity-10">
              <User className="h-6 w-6 text-[var(--color-info)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)]">Human Players</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.humans}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 rounded-lg bg-[var(--accent-secondary)] bg-opacity-10">
              <Bot className="h-6 w-6 text-[var(--accent-secondary)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)]">AI Agents</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.agents}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Characters</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <Input
              type="search"
              placeholder="Search characters..."
              className="pl-10"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : characters.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-muted)]">
              {search ? 'No characters match your search' : 'No characters found'}
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-primary)]">
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">Name</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">Combat Lvl</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">Health</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">Coins</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">Last Login</th>
                    </tr>
                  </thead>
                  <tbody>
                    {characters.map((char) => (
                      <tr 
                        key={char.id} 
                        className="border-b border-[var(--border-secondary)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
                              {char.isAgent ? (
                                <Bot className="h-4 w-4 text-[var(--accent-secondary)]" />
                              ) : (
                                <User className="h-4 w-4 text-[var(--text-secondary)]" />
                              )}
                            </div>
                            <span className="text-[var(--text-primary)] font-medium">{char.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={char.isAgent ? 'warning' : 'info'} size="sm">
                            {char.isAgent ? 'Agent' : 'Human'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[var(--text-primary)] font-medium">
                            {char.combatLevel || 3}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-[var(--bg-tertiary)] rounded-full">
                              <div 
                                className="h-2 bg-[var(--color-success)] rounded-full"
                                style={{ width: `${((char.health || 100) / (char.maxHealth || 100)) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-[var(--text-secondary)]">
                              {char.health || 100}/{char.maxHealth || 100}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[var(--accent-secondary)] font-medium">
                            {(char.coins || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[var(--text-secondary)] text-sm">
                          {formatLastLogin(char.lastLogin)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border-primary)]">
                <span className="text-sm text-[var(--text-secondary)]">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} characters
                </span>
                <div className="flex gap-2">
                  <Button 
                    variant="secondary" 
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="flex items-center px-3 text-sm text-[var(--text-primary)]">
                    Page {page} of {totalPages}
                  </span>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
