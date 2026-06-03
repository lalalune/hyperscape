/**
 * AdminScreen - Admin panel for user/player management and activity tracking
 *
 * Features:
 * - User list with search and filtering
 * - Player details view (stats, inventory, equipment, bank)
 * - Activity history with event filtering
 * - Trade history tracking
 *
 * Access: ?page=admin (requires admin code)
 */

import { GAME_API_URL } from "@/lib/api-config";
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Users,
  User,
  History,
  Package,
  Shield,
  Sword,
  Coins,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  Clock,
  Activity,
  ArrowLeft,
  Warehouse,
  RefreshCw,
} from "lucide-react";
import { INVENTORY_CONSTANTS } from "@hyperforge/shared";
import { AdminLiveControls } from "./AdminLiveControls";
import "./AdminScreen.css";

// Types
interface AdminUser {
  id: string;
  name: string;
  roles: string;
  createdAt: string;
  avatar: string | null;
  wallet: string | null;
}

interface AdminCharacter {
  id: string;
  name: string;
  combatLevel: number;
  createdAt: number;
  lastLogin: number;
  isAgent: number;
  avatar: string | null;
}

interface PlayerDetails {
  player: {
    id: string;
    name: string;
    accountId: string;
    combatLevel: number;
    health: number;
    maxHealth: number;
    coins: number;
    position: { x: number; y: number; z: number };
    attackStyle: string;
    autoRetaliate: boolean;
    isAgent: boolean;
    createdAt: number;
    lastLogin: number;
  };
  account: { id: string; name: string; roles: string } | null;
  skills: Record<string, { level: number; xp: number }>;
  inventory: Array<{
    itemId: string;
    quantity: number;
    slotIndex: number;
    metadata: Record<string, unknown> | null;
  }>;
  equipment: Array<{
    slotType: string;
    itemId: string | null;
    quantity: number;
  }>;
  bank: Array<{
    itemId: string;
    quantity: number;
    slot: number;
    tabIndex: number;
  }>;
  npcKills: Array<{ npcId: string; killCount: number }>;
  sessions: Array<{
    id: string;
    sessionStart: number;
    sessionEnd: number | null;
    playtimeMinutes: number;
    reason: string | null;
  }>;
}

interface ActivityLog {
  id: number;
  playerId: string;
  eventType: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown>;
  position: { x: number; y: number; z: number } | null;
  timestamp: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Admin code storage key
const ADMIN_CODE_KEY = "hyperia_admin_code";

export const AdminScreen: React.FC = () => {
  const [adminCode, setAdminCode] = useState(
    () => localStorage.getItem(ADMIN_CODE_KEY) || "",
  );
  const [isAuthed, setIsAuthed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [checkingStored, setCheckingStored] = useState(
    () => !!localStorage.getItem(ADMIN_CODE_KEY),
  );

  // View state
  const [activeView, setActiveView] = useState<
    "users" | "player" | "activity" | "live"
  >("users");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // Data state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersPagination, setUsersPagination] = useState<Pagination | null>(
    null,
  );
  const [playerDetails, setPlayerDetails] = useState<PlayerDetails | null>(
    null,
  );
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [activityPagination, setActivityPagination] =
    useState<Pagination | null>(null);
  const [eventTypes, setEventTypes] = useState<string[]>([]);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Loading and error state
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const adminCodeRef = useRef(adminCode);
  adminCodeRef.current = adminCode;
  const activeAbort = useRef<AbortController | null>(null);

  // Simple fetch wrapper
  const adminFetch = useCallback(
    async (path: string, options?: RequestInit) => {
      const res = await fetch(`${GAME_API_URL}${path}`, {
        ...options,
        headers: {
          "x-admin-code": adminCodeRef.current,
          "Content-Type": "application/json",
          ...(options?.headers || {}),
        },
      });
      if (res.status === 403) throw new Error("Unauthorized");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    [],
  );

  // Single-attempt auth check
  const tryAuth = useCallback(
    async (code: string): Promise<boolean> => {
      adminCodeRef.current = code;
      try {
        await adminFetch("/admin/stats");
        return true;
      } catch {
        return false;
      }
    },
    [adminFetch],
  );

  // On mount: check stored code once
  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_CODE_KEY);
    if (!stored) {
      setCheckingStored(false);
      return;
    }
    let cancelled = false;
    tryAuth(stored).then((ok) => {
      if (cancelled) return;
      if (ok) {
        setIsAuthed(true);
      } else {
        localStorage.removeItem(ADMIN_CODE_KEY);
      }
      setCheckingStored(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tryAuth]);

  // Manual login
  const handleLogin = useCallback(async () => {
    const code = adminCodeRef.current;
    if (!code) return;
    setAuthLoading(true);
    setAuthError(null);
    const ok = await tryAuth(code);
    if (ok) {
      setIsAuthed(true);
      localStorage.setItem(ADMIN_CODE_KEY, code);
    } else {
      setAuthError("Invalid code or server unreachable");
    }
    setAuthLoading(false);
  }, [tryAuth]);

  // Fetch users
  const fetchUsers = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setFetchError(null);
      try {
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: "20",
        });
        if (searchQuery) params.set("search", searchQuery);
        if (roleFilter) params.set("role", roleFilter);

        const data = await adminFetch(`/admin/users?${params}`, { signal });
        setUsers(data.users);
        setUsersPagination(data.pagination);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        if (error instanceof Error && error.message === "Unauthorized") {
          setIsAuthed(false);
          localStorage.removeItem(ADMIN_CODE_KEY);
          return;
        }
        const msg =
          error instanceof Error ? error.message : "Failed to fetch users";
        setFetchError(msg);
      } finally {
        setLoading(false);
      }
    },
    [adminFetch, currentPage, searchQuery, roleFilter],
  );

  // Fetch player details
  const fetchPlayerDetails = useCallback(
    async (playerId: string, signal?: AbortSignal) => {
      setLoading(true);
      setFetchError(null);
      try {
        const data = await adminFetch(`/admin/players/${playerId}`, { signal });
        setPlayerDetails(data);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        if (error instanceof Error && error.message === "Unauthorized") {
          setIsAuthed(false);
          localStorage.removeItem(ADMIN_CODE_KEY);
          return;
        }
        const msg =
          error instanceof Error
            ? error.message
            : "Failed to fetch player details";
        setFetchError(msg);
      } finally {
        setLoading(false);
      }
    },
    [adminFetch],
  );

  // Fetch activities
  const fetchActivities = useCallback(
    async (playerId?: string, signal?: AbortSignal) => {
      setLoading(true);
      setFetchError(null);
      try {
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: "50",
        });
        if (eventTypeFilter) params.set("eventType", eventTypeFilter);

        const endpoint = playerId
          ? `/admin/players/${playerId}/activity?${params}`
          : `/admin/activity?${params}`;

        const data = await adminFetch(endpoint, { signal });
        setActivities(data.activities);
        setActivityPagination(data.pagination);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        if (error instanceof Error && error.message === "Unauthorized") {
          setIsAuthed(false);
          localStorage.removeItem(ADMIN_CODE_KEY);
          return;
        }
        const msg =
          error instanceof Error ? error.message : "Failed to fetch activities";
        setFetchError(msg);
      } finally {
        setLoading(false);
      }
    },
    [adminFetch, currentPage, eventTypeFilter],
  );

  // Fetch event types
  const fetchEventTypes = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await adminFetch("/admin/activity/types", { signal });
        setEventTypes(data.eventTypes || []);
      } catch {
        // Non-critical
      }
    },
    [adminFetch],
  );

  // Data-fetching effects with AbortController cleanup
  useEffect(() => {
    if (!isAuthed || activeView !== "users") return;
    const ac = new AbortController();
    activeAbort.current?.abort();
    activeAbort.current = ac;
    fetchUsers(ac.signal);
    return () => ac.abort();
  }, [isAuthed, activeView, fetchUsers]);

  useEffect(() => {
    if (!isAuthed || activeView !== "player" || !selectedPlayerId) return;
    const ac = new AbortController();
    activeAbort.current?.abort();
    activeAbort.current = ac;
    fetchPlayerDetails(selectedPlayerId, ac.signal);
    fetchActivities(selectedPlayerId, ac.signal);
    return () => ac.abort();
  }, [
    isAuthed,
    activeView,
    selectedPlayerId,
    fetchPlayerDetails,
    fetchActivities,
  ]);

  useEffect(() => {
    if (!isAuthed || activeView !== "activity") return;
    const ac = new AbortController();
    activeAbort.current?.abort();
    activeAbort.current = ac;
    fetchActivities(undefined, ac.signal);
    fetchEventTypes(ac.signal);
    return () => ac.abort();
  }, [isAuthed, activeView, fetchActivities, fetchEventTypes]);

  // Handlers
  const handleUserClick = (userId: string) => {
    setSelectedUserId(userId);
  };

  const handlePlayerClick = (playerId: string) => {
    setSelectedPlayerId(playerId);
    setActiveView("player");
    setCurrentPage(1);
  };

  const handleBackToUsers = () => {
    setActiveView("users");
    setSelectedPlayerId(null);
    setPlayerDetails(null);
    setCurrentPage(1);
  };

  if (!isAuthed && checkingStored) {
    return (
      <div className="admin-screen">
        <div className="admin-auth">
          <div className="admin-auth-card">
            <RefreshCw
              className="admin-auth-icon"
              size={48}
              style={{ animation: "spin 1.5s linear infinite" }}
            />
            <h1>Admin Panel</h1>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="admin-screen">
        <div className="admin-auth">
          <div className="admin-auth-card">
            <Shield className="admin-auth-icon" size={48} />
            <h1>Admin Panel</h1>
            <p>Enter admin code to access</p>
            <input
              type="password"
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              placeholder="Admin Code"
              className="admin-auth-input"
              onKeyDown={(e) =>
                e.key === "Enter" && !authLoading && handleLogin()
              }
              disabled={authLoading}
            />
            {authError && <p className="admin-auth-error">{authError}</p>}
            <button
              onClick={handleLogin}
              disabled={authLoading || !adminCode}
              className="admin-auth-button"
            >
              {authLoading ? "Checking..." : "Enter"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-screen">
      {/* Sidebar */}
      <div className="admin-sidebar">
        <div className="admin-sidebar-header">
          <Shield size={24} />
          <span>Admin Panel</span>
        </div>
        <nav className="admin-nav">
          <button
            className={`admin-nav-item ${activeView === "users" ? "active" : ""}`}
            onClick={() => {
              setActiveView("users");
              setCurrentPage(1);
            }}
          >
            <Users size={18} />
            <span>Users</span>
          </button>
          <button
            className={`admin-nav-item ${activeView === "activity" ? "active" : ""}`}
            onClick={() => {
              setActiveView("activity");
              setCurrentPage(1);
            }}
          >
            <History size={18} />
            <span>Activity Log</span>
          </button>
          <button
            className={`admin-nav-item ${activeView === "live" ? "active" : ""}`}
            onClick={() => {
              setActiveView("live");
              setCurrentPage(1);
            }}
          >
            <Activity size={18} />
            <span>Live Controls</span>
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="admin-content">
        {/* Error Banner */}
        {fetchError && (
          <div className="admin-error-banner">
            <span>{fetchError}</span>
            <button onClick={() => setFetchError(null)}>Dismiss</button>
          </div>
        )}

        {/* Users View */}
        {activeView === "users" && (
          <UsersView
            users={users}
            pagination={usersPagination}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            roleFilter={roleFilter}
            setRoleFilter={setRoleFilter}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            loading={loading}
            onUserClick={handleUserClick}
            onPlayerClick={handlePlayerClick}
            selectedUserId={selectedUserId}
            adminFetch={adminFetch}
            onRefresh={fetchUsers}
          />
        )}

        {/* Player View */}
        {activeView === "player" && playerDetails && (
          <PlayerView
            player={playerDetails}
            activities={activities}
            activityPagination={activityPagination}
            eventTypes={eventTypes}
            eventTypeFilter={eventTypeFilter}
            setEventTypeFilter={setEventTypeFilter}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            onBack={handleBackToUsers}
            loading={loading}
            onRefresh={() => {
              if (selectedPlayerId) {
                fetchPlayerDetails(selectedPlayerId);
                fetchActivities(selectedPlayerId);
              }
            }}
          />
        )}

        {/* Activity View */}
        {activeView === "activity" && (
          <ActivityView
            activities={activities}
            pagination={activityPagination}
            eventTypes={eventTypes}
            eventTypeFilter={eventTypeFilter}
            setEventTypeFilter={setEventTypeFilter}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            loading={loading}
            onPlayerClick={handlePlayerClick}
            onRefresh={() => fetchActivities()}
          />
        )}

        {/* Live Controls View */}
        {activeView === "live" && <AdminLiveControls adminFetch={adminFetch} />}
      </div>
    </div>
  );
};

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

/** Pagination controls - used by multiple views */
const PaginationControls: React.FC<{
  pagination: Pagination | null;
  currentPage: number;
  setCurrentPage: (p: number) => void;
}> = ({ pagination, currentPage, setCurrentPage }) => {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <div className="admin-pagination">
      <button
        disabled={currentPage === 1}
        onClick={() => setCurrentPage(currentPage - 1)}
      >
        <ChevronLeft size={16} />
      </button>
      <span>
        {currentPage} / {pagination.totalPages}
      </span>
      <button
        disabled={currentPage === pagination.totalPages}
        onClick={() => setCurrentPage(currentPage + 1)}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
};

/** Event type filter dropdown */
const EventTypeSelect: React.FC<{
  eventTypes: string[];
  value: string;
  onChange: (v: string) => void;
}> = ({ eventTypes, value, onChange }) => (
  <div className="admin-activity-filters">
    <Filter size={16} />
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="admin-select"
    >
      <option value="">All Events</option>
      {eventTypes.map((type) => (
        <option key={type} value={type}>
          {type}
        </option>
      ))}
    </select>
  </div>
);

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface UsersViewProps {
  users: AdminUser[];
  pagination: Pagination | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  roleFilter: string;
  setRoleFilter: (r: string) => void;
  currentPage: number;
  setCurrentPage: (p: number) => void;
  loading: boolean;
  onUserClick: (userId: string) => void;
  onPlayerClick: (playerId: string) => void;
  selectedUserId: string | null;
  adminFetch: (path: string) => Promise<{
    characters?: AdminCharacter[];
    user?: AdminUser & { roles: string[] };
    ban?: { reason: string; expiresAt: number | null } | null;
  }>;
  onRefresh: () => void;
}

const UsersView: React.FC<UsersViewProps> = ({
  users,
  pagination,
  searchQuery,
  setSearchQuery,
  roleFilter,
  setRoleFilter,
  currentPage,
  setCurrentPage,
  loading,
  onUserClick,
  onPlayerClick,
  selectedUserId,
  adminFetch,
  onRefresh,
}) => {
  const [userDetails, setUserDetails] = useState<{
    user: AdminUser & { roles: string[] };
    characters: AdminCharacter[];
    ban: { reason: string; expiresAt: number | null } | null;
  } | null>(null);

  useEffect(() => {
    if (selectedUserId) {
      adminFetch(`/admin/users/${selectedUserId}`)
        .then((data) => {
          setUserDetails({
            user: data.user as AdminUser & { roles: string[] },
            characters: data.characters as AdminCharacter[],
            ban: data.ban ?? null,
          });
        })
        .catch((error) => {
          console.error("Failed to fetch user details:", error);
          setUserDetails(null);
        });
    } else {
      setUserDetails(null);
    }
  }, [selectedUserId, adminFetch]);

  return (
    <div className="admin-users-view">
      <div className="admin-panel">
        <div className="admin-panel-header">
          <h2>
            <Users size={20} />
            Users
          </h2>
          <button
            className="admin-refresh-btn"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? "spinning" : ""} />
          </button>
        </div>

        {/* Filters */}
        <div className="admin-filters">
          <div className="admin-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="admin-select"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="mod">Moderator</option>
            <option value="user">User</option>
          </select>
        </div>

        {/* Users List */}
        <div className="admin-list">
          {loading ? (
            <div className="admin-loading">Loading...</div>
          ) : users.length === 0 ? (
            <div className="admin-empty">No users found</div>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                className={`admin-list-item ${selectedUserId === user.id ? "selected" : ""}`}
                onClick={() => onUserClick(user.id)}
              >
                <div className="admin-list-item-avatar">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} />
                  ) : (
                    <User size={24} />
                  )}
                </div>
                <div className="admin-list-item-info">
                  <div className="admin-list-item-name">{user.name}</div>
                  <div className="admin-list-item-meta">
                    <span className="admin-roles">
                      {(user.roles ?? "")
                        .split(",")
                        .filter(Boolean)
                        .map((role) => (
                          <span
                            key={role}
                            className={`admin-role admin-role-${role}`}
                          >
                            {role}
                          </span>
                        ))}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <PaginationControls
          pagination={pagination}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
        />
      </div>

      {/* User Details Panel */}
      {userDetails && (
        <div className="admin-details-panel">
          <div className="admin-panel-header">
            <h2>
              <User size={20} />
              {userDetails.user.name}
            </h2>
          </div>

          <div className="admin-user-details">
            <div className="admin-detail-row">
              <span className="admin-detail-label">ID:</span>
              <span className="admin-detail-value">{userDetails.user.id}</span>
            </div>
            <div className="admin-detail-row">
              <span className="admin-detail-label">Roles:</span>
              <span className="admin-detail-value">
                {(userDetails.user.roles ?? []).join(", ") || "user"}
              </span>
            </div>
            <div className="admin-detail-row">
              <span className="admin-detail-label">Created:</span>
              <span className="admin-detail-value">
                {new Date(userDetails.user.createdAt).toLocaleString()}
              </span>
            </div>
            {userDetails.user.wallet && (
              <div className="admin-detail-row">
                <span className="admin-detail-label">Wallet:</span>
                <span className="admin-detail-value admin-wallet">
                  {userDetails.user.wallet.slice(0, 6)}...
                  {userDetails.user.wallet.slice(-4)}
                </span>
              </div>
            )}
            {userDetails.ban && (
              <div className="admin-detail-row admin-banned">
                <span className="admin-detail-label">Banned:</span>
                <span className="admin-detail-value">
                  {userDetails.ban.reason || "No reason given"}
                  {userDetails.ban.expiresAt && (
                    <span className="admin-ban-expires">
                      {" "}
                      (until{" "}
                      {new Date(userDetails.ban.expiresAt).toLocaleString()})
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          <h3>Characters</h3>
          <div className="admin-characters-list">
            {userDetails.characters.length === 0 ? (
              <div className="admin-empty">No characters</div>
            ) : (
              userDetails.characters.map((char) => (
                <div
                  key={char.id}
                  className="admin-character-card"
                  onClick={() => onPlayerClick(char.id)}
                >
                  <div className="admin-character-info">
                    <div className="admin-character-name">
                      {char.name}
                      {char.isAgent === 1 && (
                        <span className="admin-agent-badge">AI</span>
                      )}
                    </div>
                    <div className="admin-character-level">
                      Combat Level {char.combatLevel}
                    </div>
                  </div>
                  <div className="admin-character-meta">
                    <span>Last login: {formatTimestamp(char.lastLogin)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface PlayerViewProps {
  player: PlayerDetails;
  activities: ActivityLog[];
  activityPagination: Pagination | null;
  eventTypes: string[];
  eventTypeFilter: string;
  setEventTypeFilter: (t: string) => void;
  currentPage: number;
  setCurrentPage: (p: number) => void;
  onBack: () => void;
  loading: boolean;
  onRefresh: () => void;
}

const PlayerView: React.FC<PlayerViewProps> = ({
  player,
  activities,
  activityPagination,
  eventTypes,
  eventTypeFilter,
  setEventTypeFilter,
  currentPage,
  setCurrentPage,
  onBack,
  loading,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<
    "stats" | "inventory" | "equipment" | "bank" | "activity"
  >("stats");

  return (
    <div className="admin-player-view">
      {/* Header */}
      <div className="admin-player-header">
        <button className="admin-back-btn" onClick={onBack}>
          <ArrowLeft size={16} />
          Back
        </button>
        <h2>{player.player.name}</h2>
        <button
          className="admin-refresh-btn"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "spinning" : ""} />
        </button>
      </div>

      {/* Player Summary */}
      <div className="admin-player-summary">
        <div className="admin-summary-card">
          <Sword size={20} />
          <div>
            <span className="admin-summary-label">Combat</span>
            <span className="admin-summary-value">
              {player.player.combatLevel}
            </span>
          </div>
        </div>
        <div className="admin-summary-card">
          <Activity size={20} />
          <div>
            <span className="admin-summary-label">Health</span>
            <span className="admin-summary-value">
              {player.player.health}/{player.player.maxHealth}
            </span>
          </div>
        </div>
        <div className="admin-summary-card">
          <Coins size={20} />
          <div>
            <span className="admin-summary-label">Coins</span>
            <span className="admin-summary-value">
              {player.player.coins.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="admin-summary-card">
          <Clock size={20} />
          <div>
            <span className="admin-summary-label">Last Login</span>
            <span className="admin-summary-value">
              {formatTimestamp(player.player.lastLogin)}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button
          className={activeTab === "stats" ? "active" : ""}
          onClick={() => setActiveTab("stats")}
        >
          <Sword size={16} /> Stats
        </button>
        <button
          className={activeTab === "inventory" ? "active" : ""}
          onClick={() => setActiveTab("inventory")}
        >
          <Package size={16} /> Inventory
        </button>
        <button
          className={activeTab === "equipment" ? "active" : ""}
          onClick={() => setActiveTab("equipment")}
        >
          <Shield size={16} /> Equipment
        </button>
        <button
          className={activeTab === "bank" ? "active" : ""}
          onClick={() => setActiveTab("bank")}
        >
          <Warehouse size={16} /> Bank
        </button>
        <button
          className={activeTab === "activity" ? "active" : ""}
          onClick={() => setActiveTab("activity")}
        >
          <History size={16} /> Activity
        </button>
      </div>

      {/* Tab Content */}
      <div className="admin-tab-content">
        {activeTab === "stats" && <StatsTab player={player} />}
        {activeTab === "inventory" && <InventoryTab items={player.inventory} />}
        {activeTab === "equipment" && <EquipmentTab items={player.equipment} />}
        {activeTab === "bank" && <BankTab items={player.bank} />}
        {activeTab === "activity" && (
          <ActivityTab
            activities={activities}
            pagination={activityPagination}
            eventTypes={eventTypes}
            eventTypeFilter={eventTypeFilter}
            setEventTypeFilter={setEventTypeFilter}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
};

const StatsTab: React.FC<{ player: PlayerDetails }> = ({ player }) => {
  const skillOrder = [
    "attack",
    "strength",
    "defense",
    "constitution",
    "ranged",
    "prayer",
    "woodcutting",
    "mining",
    "fishing",
    "firemaking",
    "cooking",
    "smithing",
  ];

  return (
    <div className="admin-stats-tab">
      <h3>Skills</h3>
      <div className="admin-skills-grid">
        {skillOrder.map((skill) => {
          const data = player.skills[skill];
          if (!data) return null;
          return (
            <div key={skill} className="admin-skill-card">
              <div className="admin-skill-name">{skill}</div>
              <div className="admin-skill-level">{data.level}</div>
              <div className="admin-skill-xp">
                {data.xp.toLocaleString()} XP
              </div>
            </div>
          );
        })}
      </div>

      <h3>NPC Kills</h3>
      {player.npcKills.length === 0 ? (
        <div className="admin-empty">No kills recorded</div>
      ) : (
        <div className="admin-kills-grid">
          {player.npcKills.map((kill) => (
            <div key={kill.npcId} className="admin-kill-card">
              <div className="admin-kill-name">{kill.npcId}</div>
              <div className="admin-kill-count">{kill.killCount}</div>
            </div>
          ))}
        </div>
      )}

      <h3>Recent Sessions</h3>
      {player.sessions.length === 0 ? (
        <div className="admin-empty">No sessions recorded</div>
      ) : (
        <div className="admin-sessions-list">
          {player.sessions.map((session) => (
            <div key={session.id} className="admin-session-row">
              <span>{formatTimestamp(session.sessionStart)}</span>
              <span>{session.playtimeMinutes} min</span>
              <span className="admin-session-reason">
                {session.reason || "active"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const InventoryTab: React.FC<{
  items: Array<{
    itemId: string;
    quantity: number;
    slotIndex: number;
    metadata: Record<string, unknown> | null;
  }>;
}> = ({ items }) => {
  // Create slots array using shared constant
  const maxSlots = INVENTORY_CONSTANTS.MAX_INVENTORY_SLOTS;
  const slots = Array(maxSlots).fill(null);
  items.forEach((item) => {
    if (item.slotIndex >= 0 && item.slotIndex < maxSlots) {
      slots[item.slotIndex] = item;
    }
  });

  return (
    <div className="admin-inventory-tab">
      <div className="admin-inventory-grid">
        {slots.map((item, index) => (
          <div
            key={index}
            className={`admin-inventory-slot ${item ? "filled" : "empty"}`}
          >
            {item ? (
              <>
                <div className="admin-item-id">{item.itemId}</div>
                {item.quantity > 1 && (
                  <div className="admin-item-qty">{item.quantity}</div>
                )}
              </>
            ) : (
              <span className="admin-slot-index">{index}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const EquipmentTab: React.FC<{
  items: Array<{ slotType: string; itemId: string | null; quantity: number }>;
}> = ({ items }) => {
  const slotOrder = [
    "helmet",
    "cape",
    "amulet",
    "weapon",
    "body",
    "shield",
    "legs",
    "gloves",
    "boots",
    "ring",
    "arrows",
  ];

  const equipmentMap = new Map(items.map((item) => [item.slotType, item]));

  return (
    <div className="admin-equipment-tab">
      <div className="admin-equipment-grid">
        {slotOrder.map((slot) => {
          const item = equipmentMap.get(slot);
          return (
            <div
              key={slot}
              className={`admin-equipment-slot ${item?.itemId ? "filled" : "empty"}`}
            >
              <div className="admin-slot-name">{slot}</div>
              {item?.itemId ? (
                <>
                  <div className="admin-item-id">{item.itemId}</div>
                  {item.quantity > 1 && (
                    <div className="admin-item-qty">{item.quantity}</div>
                  )}
                </>
              ) : (
                <div className="admin-empty-slot">Empty</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BankTab: React.FC<{
  items: Array<{
    itemId: string;
    quantity: number;
    slot: number;
    tabIndex: number;
  }>;
}> = ({ items }) => {
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  const tabItems = items.filter((item) => item.tabIndex === activeTabIndex);
  const usedTabs = [...new Set(items.map((item) => item.tabIndex))].sort();

  return (
    <div className="admin-bank-tab">
      <div className="admin-bank-tabs">
        {usedTabs.length === 0 ? (
          <button className="active">Main</button>
        ) : (
          usedTabs.map((tab) => (
            <button
              key={tab}
              className={activeTabIndex === tab ? "active" : ""}
              onClick={() => setActiveTabIndex(tab)}
            >
              Tab {tab}
            </button>
          ))
        )}
      </div>

      {tabItems.length === 0 ? (
        <div className="admin-empty">Bank tab is empty</div>
      ) : (
        <div className="admin-bank-grid">
          {tabItems.map((item) => (
            <div
              key={`${item.tabIndex}-${item.slot}`}
              className="admin-bank-slot"
            >
              <div className="admin-item-id">{item.itemId}</div>
              <div className="admin-item-qty">
                {item.quantity.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ActivityTab: React.FC<{
  activities: ActivityLog[];
  pagination: Pagination | null;
  eventTypes: string[];
  eventTypeFilter: string;
  setEventTypeFilter: (t: string) => void;
  currentPage: number;
  setCurrentPage: (p: number) => void;
  loading: boolean;
}> = ({
  activities,
  pagination,
  eventTypes,
  eventTypeFilter,
  setEventTypeFilter,
  currentPage,
  setCurrentPage,
  loading,
}) => (
  <div className="admin-activity-tab">
    <EventTypeSelect
      eventTypes={eventTypes}
      value={eventTypeFilter}
      onChange={setEventTypeFilter}
    />

    {loading ? (
      <div className="admin-loading">Loading...</div>
    ) : activities.length === 0 ? (
      <div className="admin-empty">No activity recorded</div>
    ) : (
      <div className="admin-activity-list">
        {activities.map((activity) => (
          <div key={activity.id} className="admin-activity-item">
            <div className="admin-activity-time">
              {formatTimestamp(activity.timestamp)}
            </div>
            <div className="admin-activity-content">
              <span
                className={`admin-event-type admin-event-${activity.eventType.toLowerCase()}`}
              >
                {activity.eventType}
              </span>
              <span className="admin-activity-action">{activity.action}</span>
              {activity.entityId && (
                <span className="admin-activity-entity">
                  {activity.entityId}
                </span>
              )}
              {activity.details && Object.keys(activity.details).length > 0 && (
                <span className="admin-activity-details">
                  {JSON.stringify(activity.details)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    )}

    <PaginationControls
      pagination={pagination}
      currentPage={currentPage}
      setCurrentPage={setCurrentPage}
    />
  </div>
);

interface ActivityViewProps {
  activities: ActivityLog[];
  pagination: Pagination | null;
  eventTypes: string[];
  eventTypeFilter: string;
  setEventTypeFilter: (t: string) => void;
  currentPage: number;
  setCurrentPage: (p: number) => void;
  loading: boolean;
  onPlayerClick: (playerId: string) => void;
  onRefresh: () => void;
}

const ActivityView: React.FC<ActivityViewProps> = ({
  activities,
  pagination,
  eventTypes,
  eventTypeFilter,
  setEventTypeFilter,
  currentPage,
  setCurrentPage,
  loading,
  onPlayerClick,
  onRefresh,
}) => (
  <div className="admin-activity-view">
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h2>
          <History size={20} /> Activity Log
        </h2>
        <button
          className="admin-refresh-btn"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "spinning" : ""} />
        </button>
      </div>

      <EventTypeSelect
        eventTypes={eventTypes}
        value={eventTypeFilter}
        onChange={setEventTypeFilter}
      />

      {loading ? (
        <div className="admin-loading">Loading...</div>
      ) : activities.length === 0 ? (
        <div className="admin-empty">No activity recorded</div>
      ) : (
        <div className="admin-activity-list">
          {activities.map((activity) => (
            <div key={activity.id} className="admin-activity-item">
              <div className="admin-activity-time">
                {formatTimestamp(activity.timestamp)}
              </div>
              <div className="admin-activity-content">
                <span
                  className="admin-activity-player"
                  onClick={() => onPlayerClick(activity.playerId)}
                >
                  {activity.playerId.slice(0, 8)}...
                </span>
                <span
                  className={`admin-event-type admin-event-${activity.eventType.toLowerCase()}`}
                >
                  {activity.eventType}
                </span>
                <span className="admin-activity-action">{activity.action}</span>
                {activity.entityId && (
                  <span className="admin-activity-entity">
                    {activity.entityId}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <PaginationControls
        pagination={pagination}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
      />
    </div>
  </div>
);

// ============================================================================
// UTILITIES
// ============================================================================

function formatTimestamp(timestamp: number): string {
  if (!timestamp) return "Never";
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
