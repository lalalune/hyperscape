'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, useToast, ConfirmDialog } from '@/components/ui';
import { RefreshCw, X, Clock, User } from 'lucide-react';
import { getActiveSessions, closeSession, closeInactiveSessions } from '@/lib/actions/sessions';
import type { SessionWithDetails } from '@/lib/actions/sessions';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    message: string;
    onConfirm: () => void;
  }>({ open: false, message: '', onConfirm: () => {} });
  const { showSuccess, showError } = useToast();

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const data = await getActiveSessions();
      setSessions(data);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleCloseSession = async (sessionId: string, characterName: string) => {
    setConfirmDialog({
      open: true,
      message: `Close the session for ${characterName}? This will mark them as disconnected.`,
      onConfirm: async () => {
        try {
          await closeSession(sessionId);
          showSuccess(`Session closed for ${characterName}`);
          await fetchSessions();
        } catch (error) {
          console.error('Failed to close session:', error);
          showError('Failed to close session');
        }
      },
    });
  };

  const handleCloseInactive = async () => {
    setConfirmDialog({
      open: true,
      message: 'Close all sessions with no activity in the last 30 minutes? This will clean up stale connections.',
      onConfirm: async () => {
        try {
          const result = await closeInactiveSessions(30);
          showSuccess(`Closed ${result.closed} inactive session${result.closed !== 1 ? 's' : ''}`);
          await fetchSessions();
        } catch (error) {
          console.error('Failed to close inactive sessions:', error);
          showError('Failed to close inactive sessions');
        }
      },
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (startTime: number) => {
    const minutes = Math.floor((Date.now() - startTime) / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  };

  const getActivityStatus = (lastActivity: number | null, sessionStart: number) => {
    if (!lastActivity) {
      // Check if session just started (within 5 minutes)
      const sessionAge = Date.now() - sessionStart;
      if (sessionAge < 5 * 60 * 1000) {
        return { text: 'New session', color: 'var(--color-info)' };
      }
      return { text: 'No activity data', color: 'var(--text-muted)' };
    }

    const inactiveMinutes = Math.floor((Date.now() - lastActivity) / 60000);

    if (inactiveMinutes < 5) {
      return { text: 'Active', color: 'var(--color-success)' };
    } else if (inactiveMinutes < 30) {
      return { text: `Idle ${inactiveMinutes}m`, color: 'var(--color-warning)' };
    } else {
      return { text: `Stale (${inactiveMinutes}m)`, color: 'var(--color-error)' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Active Sessions</h1>
          <p className="text-[var(--text-secondary)]">
            Manage player sessions and connection states
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCloseInactive} variant="danger" size="sm">
            <X className="h-4 w-4 mr-2" />
            Close Inactive (30m+)
          </Button>
          <Button onClick={fetchSessions} variant="secondary" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Sessions Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            Open Sessions ({sessions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-muted)]">
              No active sessions
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => {
                const activityStatus = getActivityStatus(session.lastActivity, session.sessionStart);

                return (
                  <Card key={session.id} className="bg-[var(--bg-secondary)]">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <User className="h-5 w-5 text-[var(--accent-primary)]" />
                            <div>
                              <p className="text-sm font-medium text-[var(--text-primary)]">
                                {session.characterName}
                              </p>
                              {session.accountName && (
                                <p className="text-xs text-[var(--text-secondary)]">
                                  Account: {session.accountName}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            <div>
                              <p className="text-[var(--text-secondary)]">Session Start</p>
                              <p className="text-[var(--text-primary)] font-mono">
                                {formatDate(session.sessionStart)}
                              </p>
                            </div>

                            <div>
                              <p className="text-[var(--text-secondary)]">Duration</p>
                              <div className="flex items-center gap-1 text-[var(--text-primary)]">
                                <Clock className="h-3 w-3" />
                                <span>{formatDuration(session.sessionStart)}</span>
                              </div>
                            </div>

                            <div>
                              <p className="text-[var(--text-secondary)]">Status</p>
                              <p style={{ color: activityStatus.color }} className="font-medium">
                                {activityStatus.text}
                              </p>
                            </div>

                            <div>
                              <p className="text-[var(--text-secondary)]">Playtime</p>
                              <p className="text-[var(--text-primary)]">
                                {session.playtimeMinutes || 0} minutes
                              </p>
                            </div>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCloseSession(session.id, session.characterName)}
                          className="ml-4"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
        onConfirm={confirmDialog.onConfirm}
        message={confirmDialog.message}
        variant="warning"
        confirmText="Close Session"
        cancelText="Cancel"
      />
    </div>
  );
}
