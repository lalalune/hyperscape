"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Input,
} from "@/components/ui";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Users,
  RefreshCw,
} from "lucide-react";
import {
  getUsers,
  getUserStats,
  type UserWithStats,
} from "@/lib/actions/users";
import { UserDetailModal } from "@/components/users/user-detail-modal";

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCharacters: 0,
    activeSessions: 0,
  });
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, statsData] = await Promise.all([
        getUsers({ page, limit, search }),
        getUserStats(),
      ]);
      setUsers(usersData.users);
      setTotal(usersData.total);
      setStats(statsData);
      setCurrentTime(Date.now());
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers();
  }, [fetchUsers]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const formatLastActive = useCallback(
    (timestamp: number | null) => {
      if (!timestamp) return "Never";
      const diff = currentTime - timestamp;
      const minutes = Math.floor(diff / 60000);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    },
    [currentTime],
  );

  const getRoleBadges = (roles: string) => {
    if (!roles) return null;
    return roles.split(",").map((role) => (
      <Badge
        key={role}
        variant={role.trim() === "admin" ? "error" : "default"}
        size="sm"
      >
        {role.trim()}
      </Badge>
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-(--text-primary)">Users</h1>
          <p className="text-(--text-secondary)">
            Manage Hyperscape user accounts
          </p>
        </div>
        <Button onClick={fetchUsers} variant="secondary" disabled={loading}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 rounded-lg bg-(--accent-primary) bg-opacity-10">
              <Users className="h-6 w-6 text-(--accent-primary)" />
            </div>
            <div>
              <p className="text-sm text-(--text-secondary)">Total Users</p>
              <p className="text-2xl font-bold text-(--text-primary)">
                {stats.totalUsers}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 rounded-lg bg-(--accent-secondary) bg-opacity-10">
              <Users className="h-6 w-6 text-(--accent-secondary)" />
            </div>
            <div>
              <p className="text-sm text-(--text-secondary)">Characters</p>
              <p className="text-2xl font-bold text-(--text-primary)">
                {stats.totalCharacters}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 rounded-lg bg-(--color-success) bg-opacity-10">
              <Users className="h-6 w-6 text-(--color-success)" />
            </div>
            <div>
              <p className="text-sm text-(--text-secondary)">Active Sessions</p>
              <p className="text-2xl font-bold text-(--text-primary)">
                {stats.activeSessions}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Users</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--text-muted)" />
            <Input
              type="search"
              placeholder="Search users..."
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
              <RefreshCw className="h-8 w-8 animate-spin text-(--text-muted)" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-(--text-muted)">
              {search ? "No users match your search" : "No users found"}
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-(--border-primary)">
                      <th className="text-left py-3 px-4 text-sm font-medium text-(--text-secondary)">
                        Name
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-(--text-secondary)">
                        Wallet
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-(--text-secondary)">
                        Roles
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-(--text-secondary)">
                        Characters
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-(--text-secondary)">
                        Created
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-(--text-secondary)">
                        Last Active
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-(--border-secondary) hover:bg-(--bg-hover) cursor-pointer transition-colors"
                        onClick={() => setSelectedUserId(user.id)}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-(--accent-primary) flex items-center justify-center text-white font-medium text-sm">
                              {user.name?.[0]?.toUpperCase() || "?"}
                            </div>
                            <span className="text-(--text-primary) font-medium">
                              {user.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-(--text-secondary) font-mono text-xs">
                            {user.wallet
                              ? `${user.wallet.slice(0, 6)}...${user.wallet.slice(-4)}`
                              : "N/A"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1">
                            {getRoleBadges(user.roles)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">{user.characterCount}</Badge>
                        </td>
                        <td className="py-3 px-4 text-(--text-secondary) text-sm">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-(--text-secondary) text-sm">
                          {formatLastActive(user.lastActive)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-(--border-primary)">
                <span className="text-sm text-(--text-secondary)">
                  Showing {(page - 1) * limit + 1} to{" "}
                  {Math.min(page * limit, total)} of {total} users
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="flex items-center px-3 text-sm text-(--text-primary)">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* User Detail Modal */}
      {selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}
