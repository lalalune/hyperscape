'use client';

import { useTheme } from '@/components/providers/theme-provider';
import { cn } from '@/lib/utils';
import { Sun, Moon, Search, Bell } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface TopBarProps {
  sidebarCollapsed?: boolean;
}

export function TopBar({ sidebarCollapsed }: TopBarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 h-16 transition-all duration-300',
        'bg-[var(--bg-secondary)] border-b border-[var(--border-primary)]',
        'flex items-center justify-between px-6',
        sidebarCollapsed ? 'left-16' : 'left-64'
      )}
    >
      {/* Search */}
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
        <Input
          type="search"
          placeholder="Search users, characters, assets..."
          className="pl-10"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button
          className={cn(
            'p-2 rounded-md transition-colors',
            'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]',
            'relative'
          )}
        >
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--accent-primary)] rounded-full" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={cn(
            'p-2 rounded-md transition-colors',
            'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
          )}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* User Avatar */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white font-medium text-sm">
            A
          </div>
        </div>
      </div>
    </header>
  );
}
