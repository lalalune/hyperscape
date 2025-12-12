import React, { useState, useEffect } from "react";
import {
  Search,
  Shield,
  AlertTriangle,
  Ban,
  MessageSquare,
  ChevronRight,
  X,
  Loader2,
  RefreshCw,
} from "lucide-react";

type BanReason =
  | "CHEATING"
  | "EXPLOITING"
  | "HARASSMENT"
  | "SPAM"
  | "SCAMMING"
  | "CSAM"
  | "OTHER";
type ReportStatus = "PENDING" | "REVIEWED" | "RESOLVED" | "DISMISSED";
type AppealStatus = "PENDING" | "APPROVED" | "DENIED";

interface PlayerBan {
  id: string;
  playerId: string;
  playerName: string;
  reason: BanReason;
  details: string;
  moderator: string;
  bannedAt: number;
  expiresAt: number | null;
  isActive: boolean;
}

interface PlayerReport {
  id: string;
  reporterId: string;
  reporterName: string;
  targetId: string;
  targetName: string;
  reportType: string;
  details: string;
  createdAt: number;
  status: ReportStatus;
  escalated: boolean;
}

interface PlayerAppeal {
  id: string;
  playerId: string;
  playerName: string;
  reason: string;
  createdAt: number;
  status: AppealStatus;
  reviewer?: string;
  reviewNotes?: string;
}

interface PlayerHistory {
  playerId: string;
  playerName: string;
  agentId?: number;
  registeredAt: number;
  lastLogin: number;
  totalReports: number;
  totalBans: number;
  isBanned: boolean;
  recentActivity: Array<{ type: string; timestamp: number; details: string }>;
}

type Tab = "reports" | "bans" | "appeals" | "search";

interface ModerationPanelProps {
  isAdmin: boolean;
  isModerator: boolean;
  onClose?: () => void;
}

export default function ModerationPanel({
  isAdmin,
  isModerator,
  onClose,
}: ModerationPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("reports");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [reports, setReports] = useState<PlayerReport[]>([]);
  const [bans, setBans] = useState<PlayerBan[]>([]);
  const [appeals, setAppeals] = useState<PlayerAppeal[]>([]);
  const [searchResults, setSearchResults] = useState<PlayerHistory | null>(
    null,
  );

  // Modal states
  const [_selectedReport, setSelectedReport] = useState<PlayerReport | null>(
    null,
  );
  const [_selectedBan, _setSelectedBan] = useState<PlayerBan | null>(null);
  const [selectedAppeal, setSelectedAppeal] = useState<PlayerAppeal | null>(
    null,
  );
  const [showBanModal, setShowBanModal] = useState(false);
  const [banTarget, setBanTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Ban form
  const [banReason, setBanReason] = useState<BanReason>("OTHER");
  const [banDetails, setBanDetails] = useState("");
  const [banDuration, setBanDuration] = useState<"1h" | "24h" | "7d" | "perm">(
    "24h",
  );

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    const response = await fetch("/api/moderation/data");
    if (response.ok) {
      const data = await response.json();
      setReports(data.reports || []);
      setBans(data.bans || []);
      setAppeals(data.appeals || []);
    } else {
      setError("Failed to load moderation data");
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);

    const response = await fetch(
      `/api/moderation/search?q=${encodeURIComponent(searchQuery)}`,
    );
    if (response.ok) {
      const data = await response.json();
      setSearchResults(data);
    } else {
      setError("Player not found");
      setSearchResults(null);
    }

    setIsLoading(false);
  };

  const handleBan = async () => {
    if (!banTarget) return;

    setIsLoading(true);
    const response = await fetch("/api/moderation/ban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: banTarget.id,
        reason: banReason,
        details: banDetails,
        duration: banDuration,
      }),
    });

    if (response.ok) {
      setShowBanModal(false);
      setBanTarget(null);
      setBanDetails("");
      fetchData();
    } else {
      setError("Failed to ban player");
    }

    setIsLoading(false);
  };

  const handleUnban = async (playerId: string) => {
    setIsLoading(true);
    const response = await fetch("/api/moderation/unban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId }),
    });

    if (response.ok) {
      fetchData();
    } else {
      setError("Failed to unban player");
    }

    setIsLoading(false);
  };

  const handleAppealReview = async (appealId: string, approved: boolean) => {
    setIsLoading(true);
    const response = await fetch("/api/moderation/appeal/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appealId,
        approved,
        notes: `${approved ? "Approved" : "Denied"} by moderator`,
      }),
    });

    if (response.ok) {
      setSelectedAppeal(null);
      fetchData();
    } else {
      setError("Failed to process appeal");
    }

    setIsLoading(false);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (expiresAt: number | null) => {
    if (!expiresAt) return "Permanent";
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return "Expired";
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h remaining`;
    return `${hours}h remaining`;
  };

  const tabs = [
    {
      id: "reports" as Tab,
      label: "Reports",
      icon: AlertTriangle,
      count: reports.filter((r) => r.status === "PENDING").length,
    },
    {
      id: "bans" as Tab,
      label: "Bans",
      icon: Ban,
      count: bans.filter((b) => b.isActive).length,
    },
    {
      id: "appeals" as Tab,
      label: "Appeals",
      icon: MessageSquare,
      count: appeals.filter((a) => a.status === "PENDING").length,
    },
    { id: "search" as Tab, label: "Search", icon: Search, count: 0 },
  ];

  if (!isModerator && !isAdmin) {
    return (
      <div className="p-8 text-center text-[#f2d08a]/60">
        <Shield className="w-12 h-12 mx-auto mb-4 opacity-40" />
        <p>You do not have permission to access moderation tools.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0b0a15] text-[#f2d08a]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#8b4513]/30 bg-gradient-to-r from-[#2d1a0a] to-[#1a1005]">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          <h2 className="text-lg font-bold">Moderation Panel</h2>
          {isAdmin && (
            <span className="px-2 py-0.5 text-xs bg-[#f2d08a]/20 rounded">
              Admin
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2 rounded hover:bg-[#8b4513]/20 transition-colors"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded hover:bg-[#8b4513]/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs - Scrollable on mobile */}
      <div className="flex overflow-x-auto border-b border-[#8b4513]/20 bg-[#1a1005]/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "text-[#f2d08a] border-b-2 border-[#f2d08a]"
                : "text-[#f2d08a]/60 hover:text-[#f2d08a]"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && !reports.length && !bans.length && !appeals.length ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-[#f2d08a]/40" />
          </div>
        ) : (
          <>
            {/* Reports Tab */}
            {activeTab === "reports" && (
              <div className="space-y-3">
                {reports.length === 0 ? (
                  <div className="text-center py-8 text-[#f2d08a]/40">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>No pending reports</p>
                  </div>
                ) : (
                  reports.map((report) => (
                    <div
                      key={report.id}
                      onClick={() => setSelectedReport(report)}
                      className="p-4 bg-[#1a1005] border border-[#8b4513]/20 rounded-lg cursor-pointer hover:border-[#8b4513]/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">
                              {report.targetName}
                            </span>
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                report.status === "PENDING"
                                  ? "bg-yellow-500/20 text-yellow-400"
                                  : report.status === "RESOLVED"
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-gray-500/20 text-gray-400"
                              }`}
                            >
                              {report.status}
                            </span>
                            {report.escalated && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                                Escalated
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-[#f2d08a]/60 mt-1 truncate">
                            {report.reportType}: {report.details}
                          </p>
                          <p className="text-xs text-[#f2d08a]/40 mt-1">
                            By {report.reporterName} •{" "}
                            {formatDate(report.createdAt)}
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-[#f2d08a]/40 flex-shrink-0" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Bans Tab */}
            {activeTab === "bans" && (
              <div className="space-y-3">
                {bans.length === 0 ? (
                  <div className="text-center py-8 text-[#f2d08a]/40">
                    <Ban className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>No active bans</p>
                  </div>
                ) : (
                  bans.map((ban) => (
                    <div
                      key={ban.id}
                      className="p-4 bg-[#1a1005] border border-[#8b4513]/20 rounded-lg"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">
                              {ban.playerName}
                            </span>
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                ban.isActive
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-gray-500/20 text-gray-400"
                              }`}
                            >
                              {ban.isActive ? "Active" : "Expired"}
                            </span>
                          </div>
                          <p className="text-sm text-[#f2d08a]/60 mt-1">
                            {ban.reason}: {ban.details}
                          </p>
                          <p className="text-xs text-[#f2d08a]/40 mt-1">
                            By {ban.moderator} • {formatDate(ban.bannedAt)} •{" "}
                            {formatDuration(ban.expiresAt)}
                          </p>
                        </div>
                        {ban.isActive && (isModerator || isAdmin) && (
                          <button
                            onClick={() => handleUnban(ban.playerId)}
                            className="px-3 py-1.5 text-sm bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors"
                          >
                            Unban
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Appeals Tab */}
            {activeTab === "appeals" && (
              <div className="space-y-3">
                {appeals.length === 0 ? (
                  <div className="text-center py-8 text-[#f2d08a]/40">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>No pending appeals</p>
                  </div>
                ) : (
                  appeals.map((appeal) => (
                    <div
                      key={appeal.id}
                      onClick={() => setSelectedAppeal(appeal)}
                      className="p-4 bg-[#1a1005] border border-[#8b4513]/20 rounded-lg cursor-pointer hover:border-[#8b4513]/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">
                              {appeal.playerName}
                            </span>
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                appeal.status === "PENDING"
                                  ? "bg-yellow-500/20 text-yellow-400"
                                  : appeal.status === "APPROVED"
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-red-500/20 text-red-400"
                              }`}
                            >
                              {appeal.status}
                            </span>
                          </div>
                          <p className="text-sm text-[#f2d08a]/60 mt-1 truncate">
                            {appeal.reason}
                          </p>
                          <p className="text-xs text-[#f2d08a]/40 mt-1">
                            {formatDate(appeal.createdAt)}
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-[#f2d08a]/40 flex-shrink-0" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Search Tab */}
            {activeTab === "search" && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Search by username or player ID..."
                    className="flex-1 px-3 py-2 bg-[#1a1005] border border-[#8b4513]/30 rounded-lg text-[#f2d08a] placeholder-[#f2d08a]/30 focus:outline-none focus:border-[#f2d08a]/50"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={isLoading}
                    className="px-4 py-2 bg-[#f2d08a] text-[#1a1005] font-medium rounded-lg hover:bg-[#f2d08a]/90 transition-colors disabled:opacity-50"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                </div>

                {searchResults && (
                  <div className="p-4 bg-[#1a1005] border border-[#8b4513]/20 rounded-lg space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-bold">
                          {searchResults.playerName}
                        </h3>
                        <p className="text-sm text-[#f2d08a]/60">
                          ID: {searchResults.playerId}
                        </p>
                        {searchResults.agentId && (
                          <p className="text-sm text-[#f2d08a]/60">
                            Agent: #{searchResults.agentId}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {searchResults.isBanned ? (
                          <button
                            onClick={() => handleUnban(searchResults.playerId)}
                            className="px-3 py-1.5 text-sm bg-green-500/20 text-green-400 rounded hover:bg-green-500/30"
                          >
                            Unban
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setBanTarget({
                                id: searchResults.playerId,
                                name: searchResults.playerName,
                              });
                              setShowBanModal(true);
                            }}
                            className="px-3 py-1.5 text-sm bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                          >
                            Ban
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-[#2d1a0a]/50 rounded">
                        <p className="text-xs text-[#f2d08a]/60">Reports</p>
                        <p className="text-xl font-bold">
                          {searchResults.totalReports}
                        </p>
                      </div>
                      <div className="p-3 bg-[#2d1a0a]/50 rounded">
                        <p className="text-xs text-[#f2d08a]/60">Bans</p>
                        <p className="text-xl font-bold">
                          {searchResults.totalBans}
                        </p>
                      </div>
                      <div className="p-3 bg-[#2d1a0a]/50 rounded">
                        <p className="text-xs text-[#f2d08a]/60">Registered</p>
                        <p className="text-sm">
                          {formatDate(searchResults.registeredAt)}
                        </p>
                      </div>
                      <div className="p-3 bg-[#2d1a0a]/50 rounded">
                        <p className="text-xs text-[#f2d08a]/60">Last Login</p>
                        <p className="text-sm">
                          {formatDate(searchResults.lastLogin)}
                        </p>
                      </div>
                    </div>

                    {searchResults.recentActivity.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">
                          Recent Activity
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {searchResults.recentActivity.map((activity, i) => (
                            <div
                              key={i}
                              className="p-2 bg-[#2d1a0a]/30 rounded text-sm"
                            >
                              <span className="text-[#f2d08a]/60">
                                [{activity.type}]
                              </span>{" "}
                              {activity.details}
                              <span className="text-xs text-[#f2d08a]/40 ml-2">
                                {formatDate(activity.timestamp)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Ban Modal */}
      {showBanModal && banTarget && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1a1005] border border-[#8b4513]/50 rounded-lg shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#8b4513]/30">
              <h3 className="font-bold">Ban {banTarget.name}</h3>
              <button
                onClick={() => setShowBanModal(false)}
                className="p-1 rounded hover:bg-[#8b4513]/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#f2d08a]/80">
                  Reason
                </label>
                <select
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value as BanReason)}
                  className="w-full mt-1 px-3 py-2 bg-[#2d1a0a]/50 border border-[#8b4513]/30 rounded-lg text-[#f2d08a]"
                >
                  <option value="CHEATING">Cheating</option>
                  <option value="EXPLOITING">Exploiting</option>
                  <option value="HARASSMENT">Harassment</option>
                  <option value="SPAM">Spam</option>
                  <option value="SCAMMING">Scamming</option>
                  <option value="CSAM">Illegal Content</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#f2d08a]/80">
                  Duration
                </label>
                <select
                  value={banDuration}
                  onChange={(e) =>
                    setBanDuration(e.target.value as typeof banDuration)
                  }
                  className="w-full mt-1 px-3 py-2 bg-[#2d1a0a]/50 border border-[#8b4513]/30 rounded-lg text-[#f2d08a]"
                >
                  <option value="1h">1 Hour</option>
                  <option value="24h">24 Hours</option>
                  <option value="7d">7 Days</option>
                  <option value="perm">Permanent</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#f2d08a]/80">
                  Details
                </label>
                <textarea
                  value={banDetails}
                  onChange={(e) => setBanDetails(e.target.value)}
                  placeholder="Additional details..."
                  rows={3}
                  className="w-full mt-1 px-3 py-2 bg-[#2d1a0a]/50 border border-[#8b4513]/30 rounded-lg text-[#f2d08a] placeholder-[#f2d08a]/30 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBanModal(false)}
                  className="flex-1 px-4 py-2 border border-[#8b4513]/30 rounded-lg text-[#f2d08a]/60 hover:bg-[#8b4513]/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBan}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 disabled:opacity-50"
                >
                  {isLoading ? "Banning..." : "Ban Player"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Appeal Review Modal */}
      {selectedAppeal && selectedAppeal.status === "PENDING" && isAdmin && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1a1005] border border-[#8b4513]/50 rounded-lg shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#8b4513]/30">
              <h3 className="font-bold">Review Appeal</h3>
              <button
                onClick={() => setSelectedAppeal(null)}
                className="p-1 rounded hover:bg-[#8b4513]/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-sm text-[#f2d08a]/60">Player</p>
                <p className="font-medium">{selectedAppeal.playerName}</p>
              </div>
              <div>
                <p className="text-sm text-[#f2d08a]/60">Appeal Reason</p>
                <p className="bg-[#2d1a0a]/50 p-3 rounded mt-1">
                  {selectedAppeal.reason}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleAppealReview(selectedAppeal.id, false)}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 font-medium rounded-lg hover:bg-red-500/30 disabled:opacity-50"
                >
                  Deny
                </button>
                <button
                  onClick={() => handleAppealReview(selectedAppeal.id, true)}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
