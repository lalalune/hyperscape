/**
 * FriendsPanel - Social/friends panel using theme tokens
 *
 * Clean, compact design matching Quest Log and Inventory panels.
 * Uses theme.colors.slot for consistent slot-based styling.
 */

import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  Users,
  UserPlus,
  MessageCircle,
  X,
  Check,
  Search,
  Bell,
} from "lucide-react";
import { useThemeStore, type Theme } from "@/ui";
import { breakpoints } from "../../constants";
import type { ClientWorld } from "../../types";
import type { Friend, FriendRequest, FriendStatus } from "@hyperforge/shared";

interface FriendsPanelProps {
  world: ClientWorld;
}

// Status colors - will use theme colors
const getStatusColors = (theme: Theme): Record<FriendStatus, string> => ({
  online: theme.colors.state.success,
  away: theme.colors.state.warning,
  busy: theme.colors.state.danger,
  offline: theme.colors.text.muted,
});

/**
 * FriendsPanel Component
 *
 * Social panel using theme tokens for consistent styling with other panels.
 */
export function FriendsPanel({ world }: FriendsPanelProps) {
  const theme = useThemeStore((s) => s.theme);
  const STATUS_COLORS = getStatusColors(theme);

  const [activeView, setActiveView] = useState<"friends" | "requests">(
    "friends",
  );
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [addFriendName, setAddFriendName] = useState("");
  const [hoveredFriendId, setHoveredFriendId] = useState<string | null>(null);

  // Re-render trigger for friend updates
  const [updateCounter, forceUpdate] = useState(0);

  // Listen for friend data updates
  useEffect(() => {
    const handler = (...args: unknown[]) => {
      const data = args[0] as { type?: string } | undefined;
      if (data?.type === "friends_updated") {
        forceUpdate((n) => n + 1);
      }
    };
    world.on?.("ui:stateChanged", handler);
    return () => {
      world.off?.("ui:stateChanged", handler);
    };
  }, [world]);

  // Mobile responsiveness
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < breakpoints.md : false,
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoints.md);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Get friends data from world - updateCounter in deps ensures re-fetch on updates
  const { friends, requests } = useMemo(() => {
    try {
      const socialSystem = world.getSystem?.("social");
      if (
        socialSystem &&
        typeof socialSystem === "object" &&
        "getFriends" in socialSystem
      ) {
        // Call as method to preserve 'this' context
        return (
          socialSystem as {
            getFriends: () => { friends: Friend[]; requests: FriendRequest[] };
          }
        ).getFriends();
      }
    } catch {
      // Fall back to sample data if SocialSystem unavailable
    }
    return getSampleSocialData();
  }, [world, updateCounter]);

  // Filter friends by search
  const filteredFriends = useMemo(() => {
    if (!searchText) return friends;
    const lower = searchText.toLowerCase();
    return friends.filter(
      (f) =>
        f.name.toLowerCase().includes(lower) ||
        f.location?.toLowerCase().includes(lower),
    );
  }, [friends, searchText]);

  // Sort friends: online first, then alphabetically
  const sortedFriends = useMemo(() => {
    return [...filteredFriends].sort((a, b) => {
      const statusOrder: Record<FriendStatus, number> = {
        online: 0,
        away: 1,
        busy: 2,
        offline: 3,
      };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return a.name.localeCompare(b.name);
    });
  }, [filteredFriends]);

  // Count online friends
  const onlineCount = useMemo(
    () => friends.filter((f) => f.status !== "offline").length,
    [friends],
  );

  // Handle friend actions
  const handleMessageFriend = useCallback(
    (friend: Friend) => {
      // Prompt for message content
      const message = window.prompt(`Send a message to ${friend.name}:`);
      if (message && message.trim()) {
        // Send via ClientNetwork convenience method if available
        const network = world.getSystem?.("network") as {
          sendPrivateMessage?: (targetName: string, content: string) => void;
          send?: (type: string, data: Record<string, unknown>) => void;
        };
        if (network?.sendPrivateMessage) {
          network.sendPrivateMessage(friend.name, message.trim());
        } else if (network?.send) {
          network.send("privateMessage", {
            targetName: friend.name,
            content: message.trim(),
          });
        }
      }
    },
    [world],
  );

  const handleRemoveFriend = useCallback(
    (friend: Friend) => {
      if (window.confirm(`Remove ${friend.name} from your friends list?`)) {
        world.network?.send?.("friendRemove", { friendId: friend.id });
      }
    },
    [world],
  );

  const handleAcceptRequest = useCallback(
    (request: FriendRequest) => {
      world.network?.send?.("friendAccept", { requestId: request.id });
    },
    [world],
  );

  const handleDeclineRequest = useCallback(
    (request: FriendRequest) => {
      world.network?.send?.("friendDecline", { requestId: request.id });
    },
    [world],
  );

  const handleAddFriend = useCallback(() => {
    if (addFriendName.trim()) {
      world.network?.send?.("friendRequest", {
        targetName: addFriendName.trim(),
      });
      setAddFriendName("");
      setShowAddFriend(false);
    }
  }, [world, addFriendName]);

  // === Styling using theme tokens (matching Quest Log and Inventory) ===

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "transparent",
  };

  // Header - compact like other panels
  const headerRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: isMobile ? "4px 8px" : "4px 6px",
    background: theme.colors.slot.filled,
    borderBottom: `1px solid ${theme.colors.border.default}30`,
    minHeight: isMobile ? "28px" : "26px",
  };

  const headerTitleStyle: React.CSSProperties = {
    color: theme.colors.text.primary,
    fontSize: isMobile ? "11px" : "10px",
    fontWeight: 600,
  };

  const headerActionsStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "2px",
  };

  // Compact icon button sizes
  const iconButtonSize = isMobile ? "24px" : "20px";
  const iconButtonStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: iconButtonSize,
    height: iconButtonSize,
    backgroundColor: theme.colors.slot.filled,
    border: `1px solid ${theme.colors.border.default}30`,
    borderRadius: "3px",
    color: theme.colors.text.muted,
    cursor: "pointer",
    padding: 0,
    position: "relative",
    transition: "all 0.1s ease",
  };

  const activeIconButtonStyle: React.CSSProperties = {
    ...iconButtonStyle,
    color: theme.colors.accent.primary,
    backgroundColor: `${theme.colors.accent.primary}20`,
    borderColor: `${theme.colors.accent.primary}40`,
  };

  // Search row - compact
  const searchRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: isMobile ? "4px 8px" : "3px 6px",
    borderBottom: `1px solid ${theme.colors.border.default}30`,
    backgroundColor: theme.colors.slot.empty,
    minHeight: isMobile ? "28px" : "24px",
  };

  const searchInputStyle: React.CSSProperties = {
    flex: 1,
    background: "none",
    border: "none",
    outline: "none",
    color: theme.colors.text.primary,
    fontSize: isMobile ? "11px" : "10px",
  };

  // Content list
  const listStyle: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
  };

  // Friend row - compact with hover state
  const getFriendRowStyle = (isHovered: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    padding: isMobile ? "6px 8px" : "4px 8px",
    gap: "8px",
    backgroundColor: isHovered ? theme.colors.slot.hover : "transparent",
    cursor: "pointer",
    transition: "background-color 0.1s ease",
    minHeight: isMobile ? "36px" : "28px",
  });

  const statusDotStyle = (status: FriendStatus): React.CSSProperties => ({
    width: isMobile ? "8px" : "6px",
    height: isMobile ? "8px" : "6px",
    borderRadius: "50%",
    backgroundColor: STATUS_COLORS[status],
    flexShrink: 0,
  });

  const friendInfoStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const friendNameStyle: React.CSSProperties = {
    color: theme.colors.text.primary,
    fontSize: isMobile ? "12px" : "11px",
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  const friendMetaStyle: React.CSSProperties = {
    color: theme.colors.text.muted,
    fontSize: isMobile ? "10px" : "9px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  // Action buttons - compact
  const actionButtonSize = isMobile ? "24px" : "18px";
  const actionButtonStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: actionButtonSize,
    height: actionButtonSize,
    backgroundColor: "transparent",
    border: "none",
    borderRadius: "2px",
    color: theme.colors.text.muted,
    cursor: "pointer",
    padding: 0,
    transition: "color 0.1s ease",
  };

  const acceptButtonStyle: React.CSSProperties = {
    ...actionButtonStyle,
    color: theme.colors.state.success,
  };

  const declineButtonStyle: React.CSSProperties = {
    ...actionButtonStyle,
    color: theme.colors.state.danger,
  };

  const emptyStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    color: theme.colors.text.muted,
    padding: isMobile ? "24px 8px" : "20px 8px",
    fontSize: isMobile ? "11px" : "10px",
    flex: 1,
  };

  // Add friend input area - compact
  const addInputRowStyle: React.CSSProperties = {
    display: "flex",
    gap: "4px",
    padding: isMobile ? "4px 8px" : "3px 6px",
    borderBottom: `1px solid ${theme.colors.border.default}30`,
    backgroundColor: theme.colors.slot.empty,
  };

  const addInputStyle: React.CSSProperties = {
    flex: 1,
    padding: isMobile ? "4px 6px" : "3px 6px",
    background: theme.colors.slot.filled,
    border: `1px solid ${theme.colors.border.default}30`,
    borderRadius: "3px",
    color: theme.colors.text.primary,
    fontSize: isMobile ? "11px" : "10px",
    outline: "none",
  };

  // Request badge
  const badgeStyle: React.CSSProperties = {
    position: "absolute",
    top: "1px",
    right: "1px",
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: theme.colors.state.danger,
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerRowStyle}>
        <span style={headerTitleStyle}>
          Friends ({onlineCount}/{friends.length})
        </span>
        <div style={headerActionsStyle}>
          {/* Search toggle */}
          <button
            style={showSearch ? activeIconButtonStyle : iconButtonStyle}
            onClick={() => {
              setShowSearch(!showSearch);
              if (showSearch) setSearchText("");
            }}
            title="Search"
          >
            <Search size={isMobile ? 14 : 12} />
          </button>
          {/* Requests toggle */}
          <button
            style={
              activeView === "requests"
                ? activeIconButtonStyle
                : iconButtonStyle
            }
            onClick={() =>
              setActiveView(activeView === "requests" ? "friends" : "requests")
            }
            title="Friend Requests"
          >
            <Bell size={isMobile ? 14 : 12} />
            {requests.length > 0 && <div style={badgeStyle} />}
          </button>
          {/* Add friend */}
          <button
            style={showAddFriend ? activeIconButtonStyle : iconButtonStyle}
            onClick={() => setShowAddFriend(!showAddFriend)}
            title="Add Friend"
          >
            <UserPlus size={isMobile ? 14 : 12} />
          </button>
        </div>
      </div>

      {/* Search row */}
      {showSearch && (
        <div style={searchRowStyle}>
          <Search size={isMobile ? 12 : 10} color={theme.colors.text.muted} />
          <input
            type="text"
            placeholder="Search friends..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={searchInputStyle}
            autoFocus
          />
          {searchText && (
            <button style={actionButtonStyle} onClick={() => setSearchText("")}>
              <X size={isMobile ? 12 : 10} />
            </button>
          )}
        </div>
      )}

      {/* Add friend input */}
      {showAddFriend && (
        <div style={addInputRowStyle}>
          <input
            type="text"
            placeholder="Enter player name..."
            value={addFriendName}
            onChange={(e) => setAddFriendName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddFriend()}
            style={addInputStyle}
            autoFocus
          />
          <button
            style={acceptButtonStyle}
            onClick={handleAddFriend}
            title="Add"
          >
            <Check size={isMobile ? 14 : 12} />
          </button>
          <button
            style={declineButtonStyle}
            onClick={() => {
              setShowAddFriend(false);
              setAddFriendName("");
            }}
            title="Cancel"
          >
            <X size={isMobile ? 14 : 12} />
          </button>
        </div>
      )}

      {/* Content - Friends or Requests */}
      <div style={listStyle} className="scrollbar-thin">
        {activeView === "friends" && (
          <>
            {sortedFriends.length === 0 ? (
              <div style={emptyStyle}>
                <Users
                  size={isMobile ? 32 : 28}
                  color={theme.colors.text.muted}
                  style={{ opacity: 0.3, marginBottom: "8px" }}
                />
                <div>
                  {searchText
                    ? "No friends match your search"
                    : "No friends yet"}
                </div>
              </div>
            ) : (
              sortedFriends.map((friend) => (
                <div
                  key={friend.id}
                  style={getFriendRowStyle(hoveredFriendId === friend.id)}
                  onMouseEnter={() => setHoveredFriendId(friend.id)}
                  onMouseLeave={() => setHoveredFriendId(null)}
                >
                  {/* Status dot */}
                  <div style={statusDotStyle(friend.status)} />

                  {/* Friend info */}
                  <div style={friendInfoStyle}>
                    <div style={friendNameStyle}>{friend.name}</div>
                    <div style={friendMetaStyle}>
                      {friend.status === "online" && friend.location
                        ? `${friend.location}${friend.level ? ` · Lvl ${friend.level}` : ""}`
                        : friend.status === "offline"
                          ? `Last seen ${formatLastSeen(friend.lastSeen)}`
                          : friend.status.charAt(0).toUpperCase() +
                            friend.status.slice(1)}
                    </div>
                  </div>

                  {/* Actions - shown on hover */}
                  {hoveredFriendId === friend.id && (
                    <>
                      {friend.status !== "offline" && (
                        <button
                          style={actionButtonStyle}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMessageFriend(friend);
                          }}
                          title="Message"
                        >
                          <MessageCircle size={isMobile ? 12 : 10} />
                        </button>
                      )}
                      <button
                        style={declineButtonStyle}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFriend(friend);
                        }}
                        title="Remove"
                      >
                        <X size={isMobile ? 12 : 10} />
                      </button>
                    </>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {activeView === "requests" && (
          <>
            {requests.length === 0 ? (
              <div style={emptyStyle}>
                <Bell
                  size={isMobile ? 32 : 28}
                  color={theme.colors.text.muted}
                  style={{ opacity: 0.3, marginBottom: "8px" }}
                />
                <div>No pending requests</div>
              </div>
            ) : (
              requests.map((request) => (
                <div
                  key={request.id}
                  style={getFriendRowStyle(hoveredFriendId === request.id)}
                  onMouseEnter={() => setHoveredFriendId(request.id)}
                  onMouseLeave={() => setHoveredFriendId(null)}
                >
                  {/* Request info */}
                  <div style={friendInfoStyle}>
                    <div style={friendNameStyle}>{request.fromName}</div>
                    <div style={friendMetaStyle}>
                      {formatTimeAgo(request.timestamp)}
                    </div>
                  </div>

                  {/* Accept/Decline */}
                  <button
                    style={acceptButtonStyle}
                    onClick={() => handleAcceptRequest(request)}
                    title="Accept"
                  >
                    <Check size={isMobile ? 14 : 12} />
                  </button>
                  <button
                    style={declineButtonStyle}
                    onClick={() => handleDeclineRequest(request)}
                    title="Decline"
                  >
                    <X size={isMobile ? 14 : 12} />
                  </button>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Format last seen timestamp
 */
function formatLastSeen(timestamp?: number): string {
  if (!timestamp) return "unknown";
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Format timestamp as relative time
 */
function formatTimeAgo(timestamp: number): string {
  return formatLastSeen(timestamp);
}

/**
 * Sample social data for development fallback
 * Returns empty data since real data comes from SocialSystem
 */
function getSampleSocialData(): {
  friends: Friend[];
  requests: FriendRequest[];
} {
  // Return empty data - real data comes from server via SocialSystem
  // Sample data would require PlayerID branded type casting
  return {
    friends: [],
    requests: [],
  };
}

export default FriendsPanel;
