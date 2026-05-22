/**
 * TeamSettingsPage — /teams/:teamId/settings
 *
 * Substantive settings surface modeled after Supabase / Linear / Vercel.
 * Replaces the single EditTeamDialog modal. Left-rail nav routes via
 * `?tab=` query param so deep links work: `/settings?tab=audit`.
 *
 * Tabs:
 *   general       — name + description + slug (read-only) + plan (read-only)
 *   members       — full member list with role badges (mutations come later)
 *   invitations   — pending invites + new-invite CTA + invite-link reveal
 *   audit         — chronological action log for the team
 *
 * Owner/admin only — viewers + editors get redirected to the team detail
 * page with a permission notice.
 */

import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  Clock,
  Loader2,
  LogOut,
  Mail,
  Plus,
  Save,
  Settings,
  Sparkles,
  Trash2,
  User as UserIcon,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { useForgeAuth } from "../auth/ForgeAuthProvider";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { Avatar } from "../components/shared/Avatar";
import {
  AtmosphericScene,
  ErrorBanner,
  FilterInput,
  PageFooter,
  PanelHeader,
  StatusDot,
} from "../components/shared/page";
import { InviteMemberDialog } from "../components/teams/InviteMemberDialog";
import { useApp } from "../contexts/AppContext";
import { ROUTES, buildTeamDetailPath } from "../constants";
import {
  roleBadge,
  roleBadgeIconClass,
  roleBadgeTextClass,
} from "../utils/roleBadge";
import { timeAgo } from "../utils/timeAgo";
import { fetchCurrentUser } from "../utils/worldProjectApi";
import {
  fetchTeam,
  fetchTeamMembers,
  fetchTeamInvites,
  fetchTeamAuditLog,
  updateTeam,
  updateMemberRole,
  removeMember,
  revokeInvite,
  leaveTeam,
  deleteTeam,
  isPersonalTeam,
  type AuditLogEntryResponse,
  type TeamResponse,
  type TeamMemberResponse,
  type TeamInviteResponse,
} from "../utils/teamApi";

// =============================================================================
// Types & helpers
// =============================================================================

type SettingsTab = "general" | "members" | "invitations" | "audit";

const TABS: { id: SettingsTab; label: string; icon: typeof Settings }[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "members", label: "Members", icon: Users },
  { id: "invitations", label: "Invitations", icon: Mail },
  { id: "audit", label: "Audit log", icon: Clock },
];

function isSettingsTab(v: string | null): v is SettingsTab {
  return (
    v === "general" || v === "members" || v === "invitations" || v === "audit"
  );
}

// =============================================================================
// Tab views
// =============================================================================

function GeneralPanel({
  team,
  canEdit,
  viewerRole,
  viewerUserId,
  members,
  onUpdated,
}: {
  team: TeamResponse;
  canEdit: boolean;
  viewerRole: string | null;
  viewerUserId: string | null;
  members: TeamMemberResponse[];
  onUpdated: (team: TeamResponse) => void;
}) {
  const { showNotification } = useApp();
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? "");
  const [avatarUrl, setAvatarUrl] = useState(team.avatarUrl ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when the team changes (e.g. after save)
  useEffect(() => {
    setName(team.name);
    setDescription(team.description ?? "");
    setAvatarUrl(team.avatarUrl ?? "");
  }, [team.name, team.description, team.avatarUrl]);

  const isDirty =
    name.trim() !== team.name ||
    description.trim() !== (team.description ?? "") ||
    (avatarUrl.trim() || null) !== (team.avatarUrl ?? null);
  const valid = name.trim().length > 0 && isDirty;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const updated = await updateTeam(team.id, {
        name: name.trim(),
        description: description.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
      });
      showNotification(`Saved "${updated.name}"`, "success");
      onUpdated(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setError(msg);
      showNotification(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PanelHeader
        title="General"
        description="Identifying details for this team. Visible to all members."
      />

      <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
        {/* Avatar preview + URL */}
        <div className="flex items-start gap-5">
          <Avatar
            size={80}
            rounded="lg"
            src={avatarUrl.trim() || null}
            name={name || team.name}
          />
          <div className="flex-1 min-w-0">
            <label className="label" htmlFor="team-avatar">
              Avatar URL
            </label>
            <input
              id="team-avatar"
              type="url"
              className="input font-mono text-[12px]"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
              disabled={!canEdit || submitting}
            />
            <p className="helper-text">
              Public image URL. Leave blank to use a Forge-Gold initial.
            </p>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="team-name">
            Team name
          </label>
          <input
            id="team-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="Forge Studios"
            disabled={!canEdit || submitting}
          />
        </div>

        <div>
          <label className="label" htmlFor="team-description">
            Description
          </label>
          <textarea
            id="team-description"
            className="input min-h-[90px] resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            placeholder="A short description of what the team is building"
            disabled={!canEdit || submitting}
          />
        </div>

        {/* Read-only metadata */}
        <div className="rounded-lg bg-bg-tertiary border border-border-primary p-5">
          <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-[0.14em] mb-3">
            System fields
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-[11px]">
            <div>
              <p className="text-text-tertiary uppercase tracking-[0.1em] mb-1">
                Slug
              </p>
              <p className="font-mono text-text-primary tabular-nums truncate">
                {team.slug}
              </p>
            </div>
            <div>
              <p className="text-text-tertiary uppercase tracking-[0.1em] mb-1">
                Plan
              </p>
              <p className="font-display text-text-primary">{team.plan}</p>
            </div>
            <div>
              <p className="text-text-tertiary uppercase tracking-[0.1em] mb-1">
                Created
              </p>
              <p className="text-text-primary">{timeAgo(team.createdAt)}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-bg-primary border border-error/40 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        {canEdit && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setName(team.name);
                setDescription(team.description ?? "");
                setAvatarUrl(team.avatarUrl ?? "");
              }}
              disabled={!isDirty || submitting}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={!valid || submitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-primary text-bg-primary text-sm font-medium hover:bg-primary-dark transition-colors duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} strokeWidth={1.75} />
              )}
              {submitting ? "Saving…" : "Save changes"}
            </button>
          </div>
        )}
      </form>

      {/* AI budget — read-only here; future tab will own billing */}
      <section className="mt-12 pt-8 border-t border-border-primary max-w-2xl">
        <PanelHeader
          title="Usage"
          description="AI generation budget for the current month."
        />
        <div className="rounded-lg bg-bg-tertiary border border-border-primary p-5">
          <div className="flex items-baseline justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles
                size={14}
                strokeWidth={1.5}
                className="text-text-tertiary"
              />
              <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-[0.14em]">
                Spent this month
              </p>
            </div>
            <p className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] font-mono tabular-nums normal-case">
              ${(team.aiSpentThisMonthCents / 100).toFixed(2)} / $
              {(team.aiBudgetMonthlyCents / 100).toFixed(2)}
            </p>
          </div>
          <div className="h-1.5 rounded-full bg-bg-primary overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-700 ease-out"
              style={{
                width: `${
                  team.aiBudgetMonthlyCents === 0
                    ? 0
                    : Math.min(
                        100,
                        (team.aiSpentThisMonthCents /
                          team.aiBudgetMonthlyCents) *
                          100,
                      )
                }%`,
              }}
            />
          </div>
        </div>
      </section>

      <DangerZonePanel
        team={team}
        viewerRole={viewerRole}
        members={members}
        viewerUserId={viewerUserId}
      />
    </div>
  );
}

function DangerZonePanel({
  team,
  viewerRole,
  viewerUserId,
  members,
}: {
  team: TeamResponse;
  viewerRole: string | null;
  viewerUserId: string | null;
  members: TeamMemberResponse[];
}) {
  const navigate = useNavigate();
  const { showNotification } = useApp();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const role = (viewerRole ?? "").toLowerCase();
  const isOwner = role === "owner";
  const isMember = !!viewerRole;
  const ownerCount = members.filter(
    (m) => m.role.toLowerCase() === "owner",
  ).length;
  const isOnlyOwner = isOwner && ownerCount <= 1;
  const personal = isPersonalTeam({ slug: team.slug }, viewerUserId);

  // Personal teams aren't deletable or leave-able — they're your default
  // workspace and there's no second team to fall back to. Hide the
  // entire Danger Zone for them; the user can still rename it via the
  // form above.
  if (personal) {
    return (
      <section className="mt-12 pt-8 border-t border-border-primary max-w-2xl">
        <div className="rounded-lg bg-bg-tertiary border border-border-primary p-5 flex items-start gap-3">
          <UserIcon
            size={14}
            strokeWidth={1.5}
            className="text-text-tertiary flex-shrink-0 mt-0.5"
          />
          <p className="text-sm text-text-tertiary leading-relaxed">
            This is your personal team. It can&apos;t be deleted or left —
            it&apos;s your default workspace for solo projects.
          </p>
        </div>
      </section>
    );
  }

  const handleLeave = async () => {
    await leaveTeam(team.id);
    showNotification(`Left "${team.name}"`, "success");
    navigate(ROUTES.TEAMS);
  };

  const handleDelete = async () => {
    await deleteTeam(team.id);
    showNotification(`Deleted "${team.name}"`, "success");
    navigate(ROUTES.TEAMS);
  };

  return (
    <section className="mt-12 pt-8 border-t border-border-primary max-w-2xl">
      <PanelHeader
        title="Danger zone"
        description="Irreversible actions affecting this team."
      />

      <div className="rounded-lg bg-bg-tertiary border border-error/30 overflow-hidden">
        {/* Leave team — visible to any member except a sole owner */}
        {isMember && (
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border-primary">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary mb-1">
                Leave team
              </p>
              <p className="text-xs text-text-tertiary leading-relaxed">
                {isOnlyOwner
                  ? "You're the only owner. Transfer ownership or delete the team to leave."
                  : "Remove yourself from this team. You'll lose access to its worlds and assets."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLeaveOpen(true)}
              disabled={isOnlyOwner}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-primary border border-border-primary hover:border-error/60 text-[11px] text-text-secondary hover:text-error uppercase tracking-[0.12em] transition-colors duration-300 ease-out disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border-primary disabled:hover:text-text-secondary"
            >
              <LogOut size={11} strokeWidth={1.5} />
              Leave
            </button>
          </div>
        )}

        {/* Delete team — owner only */}
        {isOwner && (
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary mb-1">
                Delete team
              </p>
              <p className="text-xs text-text-tertiary leading-relaxed">
                Permanently delete this team, its games, worlds, members, and
                history. Cannot be undone.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-error/10 border border-error/40 hover:border-error text-[11px] text-error uppercase tracking-[0.12em] transition-colors duration-300 ease-out"
            >
              <Trash2 size={11} strokeWidth={1.5} />
              Delete
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        onConfirm={handleLeave}
        title="Leave team?"
        confirmLabel="Leave team"
        message={
          <>
            You&apos;ll be removed from{" "}
            <span className="text-text-primary font-medium">{team.name}</span>{" "}
            and lose access to its worlds and asset library. You can rejoin if
            invited again.
          </>
        }
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete team?"
        confirmLabel="Delete forever"
        confirmPhrase={team.slug}
        message={
          <>
            This permanently deletes{" "}
            <span className="text-text-primary font-medium">{team.name}</span>{" "}
            and everything inside: games, worlds, member records, audit log, and
            asset packs.{" "}
            <strong className="text-error">There is no undo.</strong>
          </>
        }
      />
    </section>
  );
}

const ROLE_OPTIONS = ["owner", "admin", "editor", "viewer"] as const;

function MembersPanel({
  teamId,
  members,
  loading,
  viewerUserId,
  canManage,
  viewerIsOwner,
  onMembersChanged,
}: {
  teamId: string;
  members: TeamMemberResponse[];
  loading: boolean;
  viewerUserId: string | null;
  canManage: boolean;
  viewerIsOwner: boolean;
  onMembersChanged: () => void;
}) {
  const { showNotification } = useApp();
  const [query, setQuery] = useState("");
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TeamMemberResponse | null>(
    null,
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return members;
    const q = query.toLowerCase();
    return members.filter(
      (m) =>
        (m.displayName ?? "").toLowerCase().includes(q) ||
        (m.email ?? "").toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q),
    );
  }, [members, query]);

  const handleRoleChange = async (member: TeamMemberResponse, role: string) => {
    if (role === member.role) return;
    setUpdatingMemberId(member.id);
    try {
      await updateMemberRole(teamId, member.userId, role);
      showNotification(
        `Updated ${member.displayName || member.email || "member"} to ${role}`,
        "success",
      );
      onMembersChanged();
    } catch (err) {
      showNotification(
        err instanceof Error ? err.message : "Failed to update role",
        "error",
      );
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    await removeMember(teamId, removeTarget.userId);
    showNotification(
      `Removed ${removeTarget.displayName || removeTarget.email || "member"}`,
      "success",
    );
    onMembersChanged();
  };

  return (
    <div>
      <PanelHeader
        title="Members"
        description={`${members.length} ${members.length === 1 ? "person" : "people"} with access to this team.`}
      />

      {members.length > 4 && (
        <div className="mb-5">
          <FilterInput
            value={query}
            onChange={setQuery}
            placeholder="Filter members by name, email, or role"
            maxWidth="28rem"
          />
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 rounded-lg bg-bg-tertiary border border-border-primary"
              style={{
                animation: "celestial-pulse 2.4s ease-in-out infinite",
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-lg bg-bg-tertiary border border-border-primary p-8 text-center">
          <p className="text-sm text-text-tertiary">
            {query.trim() ? `No members match "${query}".` : "No members yet."}
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="rounded-lg bg-bg-tertiary border border-border-primary overflow-hidden">
          <ul className="divide-y divide-border-primary">
            {filtered.map((m) => {
              const badge = roleBadge(m.role);
              const BadgeIcon = badge.icon;
              const memberName = m.displayName || m.email || "Anonymous";
              const isYou = viewerUserId === m.userId;
              // Owner role can only be assigned by another owner; admins
              // can change any non-owner role.
              const canEditThisRow =
                canManage &&
                !isYou &&
                (viewerIsOwner || m.role.toLowerCase() !== "owner");
              const canRemoveThisRow = canManage && !isYou;
              const isUpdating = updatingMemberId === m.id;

              return (
                <li key={m.id} className="flex items-center gap-4 px-5 py-4">
                  <Avatar
                    size={40}
                    rounded="md"
                    src={m.avatarUrl}
                    name={memberName}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {memberName}
                      </p>
                      {isYou && (
                        <span className="text-[10px] text-text-tertiary uppercase tracking-[0.12em] flex-shrink-0">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-text-tertiary truncate">
                      {m.email || (
                        <span className="font-mono normal-case tracking-normal">
                          {m.userId.slice(0, 12)}…
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="hidden md:block text-[10px] text-text-tertiary uppercase tracking-[0.1em] font-mono normal-case flex-shrink-0">
                    Joined {timeAgo(m.joinedAt)}
                  </div>

                  {/* Role: editable select for admins+, static badge otherwise */}
                  {canEditThisRow ? (
                    <div className="flex-shrink-0">
                      <select
                        value={m.role.toLowerCase()}
                        onChange={(e) => handleRoleChange(m, e.target.value)}
                        disabled={isUpdating}
                        className="input py-1.5 pl-3 pr-8 text-[11px] uppercase tracking-[0.1em] w-[110px]"
                      >
                        {ROLE_OPTIONS.map((r) => {
                          // Only owners can promote someone to owner
                          if (r === "owner" && !viewerIsOwner) return null;
                          return (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-bg-primary border border-border-primary flex-shrink-0">
                      <BadgeIcon
                        size={11}
                        strokeWidth={1.5}
                        className={roleBadgeIconClass(badge.tone)}
                      />
                      <span
                        className={`text-[11px] uppercase tracking-[0.12em] ${roleBadgeTextClass(badge.tone)}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  )}

                  {/* Remove member */}
                  {canRemoveThisRow && (
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(m)}
                      title="Remove from team"
                      className="flex-shrink-0 p-1.5 rounded text-text-tertiary hover:text-error hover:bg-bg-primary transition-colors duration-300 ease-out"
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        title="Remove member?"
        confirmLabel="Remove"
        message={
          <>
            <span className="text-text-primary font-medium">
              {removeTarget?.displayName ||
                removeTarget?.email ||
                "This member"}
            </span>{" "}
            will lose access to this team and all its worlds. They can be
            re-invited later.
          </>
        }
      />
    </div>
  );
}

function InvitationsPanel({
  invites,
  loading,
  canManage,
  viewerIsOwner,
  team,
  onInvited,
  onRevoked,
}: {
  invites: TeamInviteResponse[];
  loading: boolean;
  canManage: boolean;
  viewerIsOwner: boolean;
  team: TeamResponse;
  onInvited: (invite: TeamInviteResponse) => void;
  onRevoked: (inviteId: string) => void;
}) {
  const { showNotification } = useApp();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<TeamInviteResponse | null>(
    null,
  );

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    await revokeInvite(team.id, revokeTarget.id);
    showNotification(`Revoked invite to ${revokeTarget.email}`, "success");
    onRevoked(revokeTarget.id);
  };

  return (
    <div>
      <PanelHeader
        title="Invitations"
        description="Pending invitations that haven't been accepted yet."
        action={
          canManage && (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-bg-primary text-sm font-medium hover:bg-primary-dark transition-colors duration-300 ease-out"
            >
              <Plus size={13} strokeWidth={2} />
              Invite
            </button>
          )
        }
      />

      {loading && (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-16 rounded-lg bg-bg-tertiary border border-border-primary"
              style={{
                animation: "celestial-pulse 2.4s ease-in-out infinite",
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      )}

      {!loading && invites.length === 0 && (
        <div className="rounded-lg bg-bg-tertiary border border-border-primary p-10 text-center">
          <Mail
            size={28}
            strokeWidth={1.25}
            className="text-text-tertiary/60 mx-auto mb-4"
          />
          <p className="text-sm text-text-tertiary mb-3">
            No pending invitations.
          </p>
          {canManage && (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="inline-flex items-center gap-1.5 text-[11px] text-primary uppercase tracking-[0.12em] hover:text-primary-light transition-colors duration-300 ease-out"
            >
              Invite someone
              <ChevronRight size={11} strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}

      {!loading && invites.length > 0 && (
        <div className="rounded-lg bg-bg-tertiary border border-border-primary overflow-hidden">
          <ul className="divide-y divide-border-primary">
            {invites.map((inv) => {
              const badge = roleBadge(inv.role);
              const BadgeIcon = badge.icon;
              return (
                <li key={inv.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-10 h-10 rounded bg-bg-primary border border-border-primary flex items-center justify-center flex-shrink-0">
                    <Mail
                      size={14}
                      strokeWidth={1.5}
                      className="text-text-tertiary"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {inv.email}
                    </p>
                    <p className="text-[11px] text-text-tertiary uppercase tracking-[0.1em] font-mono normal-case mt-0.5">
                      Expires {timeAgo(inv.expiresAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-bg-primary border border-border-primary flex-shrink-0">
                    <BadgeIcon
                      size={11}
                      strokeWidth={1.5}
                      className={roleBadgeIconClass(badge.tone)}
                    />
                    <span
                      className={`text-[11px] uppercase tracking-[0.12em] ${roleBadgeTextClass(badge.tone)}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setRevokeTarget(inv)}
                      title="Revoke invite"
                      className="flex-shrink-0 p-1.5 rounded text-text-tertiary hover:text-error hover:bg-bg-primary transition-colors duration-300 ease-out"
                    >
                      <X size={14} strokeWidth={1.5} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        title="Revoke invitation?"
        confirmLabel="Revoke"
        message={
          <>
            The invite to{" "}
            <span className="text-text-primary font-medium">
              {revokeTarget?.email}
            </span>{" "}
            will be invalidated. The recipient won&apos;t be able to use the
            existing link; you can send a new invite later.
          </>
        }
      />

      <InviteMemberDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        teamId={team.id}
        teamName={team.name}
        viewerIsOwner={viewerIsOwner}
        onInvited={onInvited}
      />
    </div>
  );
}

function AuditPanel({
  entries,
  loading,
  members,
}: {
  entries: AuditLogEntryResponse[];
  loading: boolean;
  members: TeamMemberResponse[];
}) {
  // Build a lookup so we can resolve userId → display name without
  // another API call. Members were already fetched alongside.
  const userById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) {
      map.set(m.userId, m.displayName || m.email || m.userId.slice(0, 8));
    }
    return map;
  }, [members]);

  return (
    <div>
      <PanelHeader
        title="Audit log"
        description="Chronological record of privileged actions on this team. Last 50 entries."
      />

      {loading && (
        <div className="space-y-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 rounded bg-bg-tertiary border border-border-primary"
              style={{
                animation: "celestial-pulse 2.4s ease-in-out infinite",
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div className="rounded-lg bg-bg-tertiary border border-border-primary p-10 text-center">
          <Clock
            size={28}
            strokeWidth={1.25}
            className="text-text-tertiary/60 mx-auto mb-4"
          />
          <p className="text-sm text-text-tertiary">
            No audit entries yet. Privileged actions will appear here as they
            happen.
          </p>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div className="rounded-lg bg-bg-tertiary border border-border-primary overflow-hidden">
          <ul className="divide-y divide-border-primary">
            {entries.map((e) => {
              const actorName = e.userId
                ? (userById.get(e.userId) ?? e.userId.slice(0, 8))
                : "System";
              return (
                <li key={e.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex items-baseline gap-3 min-w-0 flex-1">
                    <span className="text-[11px] font-mono text-text-tertiary tabular-nums whitespace-nowrap flex-shrink-0">
                      {new Date(e.createdAt).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="text-sm text-text-primary font-medium truncate">
                      {actorName}
                    </span>
                    <span className="text-sm text-text-tertiary truncate">
                      {e.action}
                    </span>
                    {e.targetType && (
                      <span className="text-[10px] text-text-tertiary uppercase tracking-[0.1em] font-mono normal-case truncate hidden md:inline">
                        {e.targetType}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-text-tertiary uppercase tracking-[0.1em] font-mono normal-case flex-shrink-0 hidden sm:inline">
                    {timeAgo(e.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Page
// =============================================================================

export function TeamSettingsPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const auth = useForgeAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabFromUrl = searchParams.get("tab");
  const activeTab: SettingsTab = isSettingsTab(tabFromUrl)
    ? tabFromUrl
    : "general";

  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [members, setMembers] = useState<TeamMemberResponse[]>([]);
  const [invites, setInvites] = useState<TeamInviteResponse[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditLogEntryResponse[]>([]);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);

  const [loadingTeam, setLoadingTeam] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Single load on mount — fetch everything in parallel since the user
  // can swap tabs without re-fetching.
  useEffect(() => {
    if (!teamId || !auth.ready || !auth.authenticated) {
      setLoadingTeam(false);
      setLoadingMembers(false);
      setLoadingInvites(false);
      setLoadingAudit(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        setError(null);
        setLoadingTeam(true);
        setLoadingMembers(true);
        setLoadingInvites(true);
        setLoadingAudit(true);

        const [meRes, teamRes, membersRes] = await Promise.all([
          fetchCurrentUser(),
          fetchTeam(teamId!),
          fetchTeamMembers(teamId!),
        ]);
        if (cancelled) return;

        const myMembership = meRes.teams.find((t) => t.teamId === teamId);
        setViewerRole(myMembership?.role ?? null);
        setViewerUserId(meRes.user.id);
        setTeam(teamRes);
        setMembers(membersRes);
        setLoadingTeam(false);
        setLoadingMembers(false);

        // Invites + audit are admin+ only — try, ignore 403
        const role = (myMembership?.role ?? "").toLowerCase();
        const canSeeAdminData = role === "owner" || role === "admin";

        if (canSeeAdminData) {
          fetchTeamInvites(teamId!)
            .then((data) => {
              if (!cancelled) setInvites(data);
            })
            .catch(() => {
              // swallow — leave empty
            })
            .finally(() => {
              if (!cancelled) setLoadingInvites(false);
            });
        } else {
          setLoadingInvites(false);
        }

        // Audit log: any member can see it (route gates by membership, not role)
        fetchTeamAuditLog(teamId!, { limit: 50 })
          .then((data) => {
            if (!cancelled) setAuditEntries(data);
          })
          .catch(() => {
            // swallow
          })
          .finally(() => {
            if (!cancelled) setLoadingAudit(false);
          });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load team");
          setLoadingTeam(false);
          setLoadingMembers(false);
          setLoadingInvites(false);
          setLoadingAudit(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [teamId, auth.ready, auth.authenticated]);

  const canManage = useMemo(() => {
    const r = (viewerRole ?? "").toLowerCase();
    return r === "owner" || r === "admin";
  }, [viewerRole]);

  const setTab = (tab: SettingsTab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === "general") {
        next.delete("tab");
      } else {
        next.set("tab", tab);
      }
      return next;
    });
  };

  // Auth loading
  if (!auth.ready || loadingTeam) {
    return (
      <div className="flex items-center justify-center min-h-full bg-bg-primary">
        <Loader2 size={20} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (error || !team || !teamId) {
    return (
      <div className="relative min-h-full bg-bg-primary overflow-hidden">
        <AtmosphericScene topEllipseHeight={520} horizonY={null} />
        <div className="relative max-w-[1200px] mx-auto px-10 py-16">
          {teamId && (
            <Link
              to={buildTeamDetailPath(teamId)}
              className="inline-flex items-center gap-2 text-[11px] text-text-tertiary hover:text-primary uppercase tracking-[0.12em] mb-8 transition-colors duration-300 ease-out"
            >
              <ArrowLeft size={12} strokeWidth={1.5} />
              Back to team
            </Link>
          )}
          <ErrorBanner variant="page" message={error || "Team not found"} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full bg-bg-primary overflow-hidden">
      <AtmosphericScene topEllipseHeight={520} horizonY={null} />

      <div className="relative max-w-[1200px] mx-auto px-10 py-12">
        {/* Breadcrumb + back */}
        <nav className="flex items-center gap-2 text-[11px] text-text-tertiary uppercase tracking-[0.12em] mb-6">
          <Link
            to={ROUTES.TEAMS}
            className="hover:text-primary transition-colors duration-300 ease-out"
          >
            Teams
          </Link>
          <ChevronRight
            size={11}
            strokeWidth={1.5}
            className="text-text-tertiary/40"
          />
          <Link
            to={buildTeamDetailPath(team.id)}
            className="hover:text-primary transition-colors duration-300 ease-out truncate max-w-[200px]"
          >
            {team.name}
          </Link>
          <ChevronRight
            size={11}
            strokeWidth={1.5}
            className="text-text-tertiary/40"
          />
          <span className="text-text-primary">Settings</span>
        </nav>

        {/* Page hero — concise so the settings UI dominates */}
        <header className="flex items-center gap-5 mb-10 pb-6 border-b border-border-primary">
          <Avatar
            size={56}
            rounded="lg"
            src={team.avatarUrl}
            name={team.name}
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-medium text-text-primary tracking-tight mb-1">
              {team.name}
            </h1>
            <p className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] font-mono normal-case tracking-normal">
              {team.slug}
            </p>
          </div>
          {viewerRole && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-bg-tertiary border border-border-primary">
              <StatusDot tone={canManage ? "ready" : "idle"} />
              <span className="text-[11px] uppercase tracking-[0.12em] text-text-secondary">
                {viewerRole}
              </span>
            </div>
          )}
        </header>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-10">
          {/* Sidebar nav */}
          <aside>
            <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-[0.14em] mb-3 pb-3 border-b border-border-primary/60">
              Settings
            </p>
            <nav className="space-y-0.5">
              {TABS.map((t) => {
                const Icon = t.icon;
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`group relative w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-300 ease-out ${
                      isActive
                        ? "bg-bg-tertiary text-text-primary"
                        : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/60"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-px bg-primary" />
                    )}
                    <Icon
                      size={14}
                      strokeWidth={1.5}
                      className={
                        isActive
                          ? "text-primary"
                          : "text-text-tertiary group-hover:text-primary transition-colors duration-300 ease-out"
                      }
                    />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Back link */}
            <div className="mt-8 pt-5 border-t border-border-primary/60">
              <Link
                to={buildTeamDetailPath(team.id)}
                className="inline-flex items-center gap-1.5 text-[11px] text-text-tertiary hover:text-primary uppercase tracking-[0.12em] transition-colors duration-300 ease-out"
              >
                <ArrowLeft size={11} strokeWidth={1.5} />
                Back to team
              </Link>
            </div>
          </aside>

          {/* Content */}
          <main className="min-w-0">
            {activeTab === "general" && (
              <GeneralPanel
                team={team}
                canEdit={canManage}
                viewerRole={viewerRole}
                viewerUserId={viewerUserId}
                members={members}
                onUpdated={(updated) => setTeam(updated)}
              />
            )}
            {activeTab === "members" && (
              <MembersPanel
                teamId={team.id}
                members={members}
                loading={loadingMembers}
                viewerUserId={viewerUserId}
                canManage={canManage}
                viewerIsOwner={(viewerRole ?? "").toLowerCase() === "owner"}
                onMembersChanged={() => {
                  // Refetch members + audit log so the change reflects
                  fetchTeamMembers(team.id)
                    .then(setMembers)
                    .catch(() => {});
                  fetchTeamAuditLog(team.id, { limit: 50 })
                    .then(setAuditEntries)
                    .catch(() => {});
                }}
              />
            )}
            {activeTab === "invitations" && (
              <InvitationsPanel
                invites={invites}
                loading={loadingInvites}
                canManage={canManage}
                viewerIsOwner={(viewerRole ?? "").toLowerCase() === "owner"}
                team={team}
                onInvited={(inv) => setInvites((prev) => [inv, ...prev])}
                onRevoked={(inviteId) =>
                  setInvites((prev) => prev.filter((i) => i.id !== inviteId))
                }
              />
            )}
            {activeTab === "audit" && (
              <AuditPanel
                entries={auditEntries}
                loading={loadingAudit}
                members={members}
              />
            )}
          </main>
        </div>

        <div className="mt-16">
          <PageFooter
            subtitle={
              <span className="flex items-center gap-3">
                <span className="text-[11px] text-text-tertiary uppercase tracking-[0.14em]">
                  Team settings
                </span>
                <ArrowUpRight
                  size={11}
                  strokeWidth={1.5}
                  className="text-text-tertiary/40"
                />
              </span>
            }
            right={
              <div className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] font-mono normal-case tracking-normal">
                {team.id}
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
