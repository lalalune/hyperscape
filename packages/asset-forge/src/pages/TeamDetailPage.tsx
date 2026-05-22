/**
 * TeamDetailPage — /teams/:teamId
 *
 * Shows team identity (name, slug, plan, AI budget), full member list
 * with roles, and pending invites. Owner/admin actions (role updates,
 * remove member, revoke invite, create invite) gated by the user's role.
 *
 * Data sources:
 *   - fetchTeam(teamId)         — team metadata
 *   - fetchTeamMembers(teamId)  — full member list
 *   - fetchTeamInvites(teamId)  — pending invites (admin+ only)
 *   - fetchCurrentUser()        — viewer's role in this team
 */

import {
  ArrowLeft,
  Users,
  Mail,
  Plus,
  Shield,
  Settings,
  Loader2,
  ChevronRight,
  Sparkles,
  Gamepad2,
  ArrowUpRight,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useForgeAuth } from "../auth/ForgeAuthProvider";
import { Avatar } from "../components/shared/Avatar";
import {
  AtmosphericScene,
  ErrorBanner,
  FilterInput,
  PageFooter,
  SectionHeader,
  StatCard,
  StatusDot,
} from "../components/shared/page";
import { InviteMemberDialog } from "../components/teams/InviteMemberDialog";
import {
  ROUTES,
  buildGameDetailPath,
  buildTeamSettingsPath,
} from "../constants";
import {
  roleBadge,
  roleBadgeIconClass,
  roleBadgeTextClass,
} from "../utils/roleBadge";
import { timeAgo } from "../utils/timeAgo";
import {
  fetchCurrentUser,
  fetchTeamGames,
  type GameResponse,
} from "../utils/worldProjectApi";
import {
  fetchTeam,
  fetchTeamMembers,
  fetchTeamInvites,
  type TeamResponse,
  type TeamMemberResponse,
  type TeamInviteResponse,
} from "../utils/teamApi";

// =============================================================================
// Utilities
// =============================================================================

function formatCents(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toFixed(2)}`;
}

// =============================================================================
// Page
// =============================================================================

export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const auth = useForgeAuth();

  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [members, setMembers] = useState<TeamMemberResponse[]>([]);
  const [invites, setInvites] = useState<TeamInviteResponse[]>([]);
  const [games, setGames] = useState<GameResponse[]>([]);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [gameQuery, setGameQuery] = useState("");

  useEffect(() => {
    if (!teamId || !auth.ready || !auth.authenticated) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);

        // Load viewer's role in parallel with team data
        const [meRes, teamRes, membersRes, gamesRes] = await Promise.all([
          fetchCurrentUser(),
          fetchTeam(teamId!),
          fetchTeamMembers(teamId!),
          fetchTeamGames(teamId!),
        ]);
        if (cancelled) return;

        const myMembership = meRes.teams.find((t) => t.teamId === teamId);
        setViewerRole(myMembership?.role ?? null);
        setTeam(teamRes);
        setMembers(membersRes);
        setGames(gamesRes);

        // Invites only loadable by admin+ — try, ignore 403
        const role = (myMembership?.role ?? "").toLowerCase();
        if (role === "owner" || role === "admin") {
          try {
            const inv = await fetchTeamInvites(teamId!);
            if (!cancelled) setInvites(inv);
          } catch {
            // Permission denied — leave invites empty
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load team");
        }
      } finally {
        if (!cancelled) setLoading(false);
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

  const filteredMembers = useMemo(() => {
    if (!memberQuery.trim()) return members;
    const q = memberQuery.toLowerCase();
    return members.filter(
      (m) =>
        (m.displayName ?? "").toLowerCase().includes(q) ||
        (m.email ?? "").toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q),
    );
  }, [members, memberQuery]);

  const filteredGames = useMemo(() => {
    if (!gameQuery.trim()) return games;
    const q = gameQuery.toLowerCase();
    return games.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.slug.toLowerCase().includes(q) ||
        (g.description ?? "").toLowerCase().includes(q),
    );
  }, [games, gameQuery]);

  const aiBudgetUsedPct = useMemo(() => {
    if (!team || team.aiBudgetMonthlyCents === 0) return 0;
    return Math.min(
      100,
      (team.aiSpentThisMonthCents / team.aiBudgetMonthlyCents) * 100,
    );
  }, [team]);

  if (!auth.ready || loading) {
    return (
      <div className="flex items-center justify-center min-h-full bg-bg-primary">
        <Loader2 size={20} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="relative min-h-full bg-bg-primary overflow-hidden">
        <AtmosphericScene />
        <div className="relative max-w-[1200px] mx-auto px-10 py-16">
          <Link
            to={ROUTES.TEAMS}
            className="inline-flex items-center gap-2 text-[11px] text-text-tertiary hover:text-primary uppercase tracking-[0.12em] mb-8 transition-colors duration-300 ease-out"
          >
            <ArrowLeft size={12} strokeWidth={1.5} />
            All teams
          </Link>
          <ErrorBanner
            variant="page"
            message={error || "Team not found"}
            meta={teamId}
          />
        </div>
      </div>
    );
  }

  const viewerBadge = roleBadge(viewerRole ?? "");
  const ViewerBadgeIcon = viewerBadge.icon;

  return (
    <div className="relative min-h-full bg-bg-primary overflow-hidden">
      <AtmosphericScene />

      <div className="relative max-w-[1200px] mx-auto px-10 py-16">
        {/* BACK */}
        <Link
          to={ROUTES.TEAMS}
          className="inline-flex items-center gap-2 text-[11px] text-text-tertiary hover:text-primary uppercase tracking-[0.12em] mb-8 transition-colors duration-300 ease-out"
        >
          <ArrowLeft size={12} strokeWidth={1.5} />
          All teams
        </Link>

        {/* HERO */}
        <header className="mb-16">
          <div className="flex items-baseline gap-4 mb-6">
            <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
              00
            </span>
            <span className="font-display text-base font-medium text-text-primary tracking-tight">
              Team
            </span>
            <span className="flex items-center gap-2 text-[11px] text-text-tertiary uppercase tracking-[0.12em] font-mono normal-case tracking-normal">
              {team.slug}
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-6 mb-6">
            <Avatar
              size={80}
              rounded="lg"
              src={team.avatarUrl}
              name={team.name}
            />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-4xl md:text-5xl font-medium text-text-primary tracking-tight leading-[1.05] mb-2">
                {team.name}
              </h1>
              {team.description && (
                <p className="text-base text-text-tertiary leading-relaxed">
                  {team.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {viewerRole && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-bg-tertiary border border-border-primary">
                  <ViewerBadgeIcon
                    size={12}
                    strokeWidth={1.5}
                    className={roleBadgeIconClass(viewerBadge.tone)}
                  />
                  <span
                    className={`text-[11px] uppercase tracking-[0.12em] ${roleBadgeTextClass(viewerBadge.tone)}`}
                  >
                    You: {viewerBadge.label}
                  </span>
                </div>
              )}
              {canManage && (
                <Link
                  to={buildTeamSettingsPath(team.id)}
                  title="Team settings"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-bg-tertiary border border-border-primary hover:border-primary/40 text-[11px] text-text-secondary hover:text-primary uppercase tracking-[0.12em] transition-colors duration-300 ease-out"
                >
                  <Settings size={11} strokeWidth={1.5} />
                  Settings
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* OVERVIEW STATS */}
        <section className="mb-20">
          <SectionHeader number="01" title="Overview" meta="Team status" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Games"
              value={games.length.toString().padStart(2, "0")}
              sub={games.length === 1 ? "project" : "projects"}
            />
            <StatCard
              label="Members"
              value={members.length.toString().padStart(2, "0")}
              sub={members.length === 1 ? "member" : "members"}
            />
            <StatCard
              label="Plan"
              value={team.plan}
              sub="Subscription"
              valueMono={false}
            />
            <StatCard
              label="Created"
              value={timeAgo(team.createdAt)}
              sub={new Date(team.createdAt).toLocaleDateString()}
            />
          </div>

          {/* AI Budget */}
          <div className="mt-4 rounded-lg bg-bg-tertiary border border-border-primary p-6">
            <div className="flex items-baseline justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles
                  size={14}
                  strokeWidth={1.5}
                  className="text-text-tertiary"
                />
                <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-[0.14em]">
                  AI Budget · This month
                </p>
              </div>
              <p className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] font-mono tabular-nums normal-case">
                {formatCents(team.aiSpentThisMonthCents)} /{" "}
                {formatCents(team.aiBudgetMonthlyCents)}
              </p>
            </div>
            <div className="h-1.5 rounded-full bg-bg-primary overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-700 ease-out"
                style={{ width: `${aiBudgetUsedPct}%` }}
              />
            </div>
            <p className="mt-3 text-[10px] text-text-tertiary uppercase tracking-[0.12em] font-mono tabular-nums normal-case">
              {aiBudgetUsedPct.toFixed(1)}% used
            </p>
          </div>
        </section>

        {/* GAMES — projects within this team */}
        <section className="mb-20">
          <SectionHeader
            number="02"
            title="Games"
            meta={`${games.length} ${games.length === 1 ? "project" : "projects"}`}
            action={
              canManage && (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-tertiary border border-border-primary text-[11px] text-text-tertiary uppercase tracking-[0.12em] cursor-not-allowed opacity-60"
                  title="New game (coming soon)"
                >
                  <Plus size={11} strokeWidth={2} />
                  New game
                </button>
              )
            }
          />

          {games.length === 0 ? (
            <div className="rounded-lg bg-bg-tertiary border border-border-primary p-10 text-center">
              <Gamepad2
                size={28}
                strokeWidth={1.25}
                className="text-text-tertiary/60 mx-auto mb-4"
              />
              <p className="text-sm text-text-tertiary mb-2">No games yet.</p>
              <p className="text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
                Game creation coming soon
              </p>
            </div>
          ) : (
            <>
              {games.length > 3 && (
                <div className="mb-4">
                  <FilterInput
                    value={gameQuery}
                    onChange={setGameQuery}
                    placeholder="Filter games by name, slug, or description"
                  />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredGames.length === 0 && (
                  <div className="col-span-full rounded-lg bg-bg-tertiary border border-border-primary p-6 text-center text-sm text-text-tertiary">
                    No games match &ldquo;{gameQuery}&rdquo;.
                  </div>
                )}
                {filteredGames.map((g) => (
                  <Link
                    key={g.id}
                    to={buildGameDetailPath(g.teamId, g.id)}
                    className="group relative flex flex-col rounded-lg bg-bg-tertiary border border-border-primary hover:border-primary/40 transition-colors duration-500 ease-out overflow-hidden p-6"
                  >
                    <span className="pointer-events-none absolute left-0 top-6 bottom-6 w-px bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out" />

                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 rounded bg-bg-primary border border-border-primary flex items-center justify-center">
                        <Gamepad2
                          size={16}
                          strokeWidth={1.5}
                          className="text-text-secondary group-hover:text-primary transition-colors duration-500 ease-out"
                        />
                      </div>
                      <ArrowUpRight
                        size={14}
                        strokeWidth={1.5}
                        className="text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out"
                      />
                    </div>

                    <h3 className="font-display text-lg font-medium text-text-primary tracking-tight mb-2 truncate">
                      {g.name}
                    </h3>
                    <p className="text-xs text-text-tertiary leading-relaxed line-clamp-2 mb-4 min-h-[2.5em]">
                      {g.description || (
                        <span className="italic text-text-tertiary/60">
                          No description
                        </span>
                      )}
                    </p>

                    <div className="flex items-center justify-between pt-3 border-t border-border-primary text-[11px] text-text-tertiary uppercase tracking-[0.1em]">
                      <span className="font-mono normal-case tracking-normal truncate">
                        {g.slug}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <StatusDot
                          tone={g.productionServerUrl ? "online" : "idle"}
                        />
                        {g.productionServerUrl ? "Live" : "Draft"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>

        {/* MEMBERS */}
        <section className="mb-20">
          <SectionHeader
            number="03"
            title="Members"
            meta={`${members.length} ${members.length === 1 ? "person" : "people"}`}
            action={
              canManage && (
                <button
                  type="button"
                  onClick={() => setInviteOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-tertiary border border-border-primary hover:border-primary/40 text-[11px] text-text-secondary hover:text-primary uppercase tracking-[0.12em] transition-colors duration-300 ease-out"
                >
                  <Plus size={11} strokeWidth={2} />
                  Invite
                </button>
              )
            }
          />

          {members.length === 0 ? (
            <div className="rounded-lg bg-bg-tertiary border border-border-primary p-10 text-center">
              <Users
                size={28}
                strokeWidth={1.25}
                className="text-text-tertiary/60 mx-auto mb-4"
              />
              <p className="text-sm text-text-tertiary">No members yet.</p>
            </div>
          ) : (
            <>
              {members.length > 5 && (
                <div className="mb-4">
                  <FilterInput
                    value={memberQuery}
                    onChange={setMemberQuery}
                    placeholder="Filter members by name, email, or role"
                  />
                </div>
              )}
              <div className="rounded-lg bg-bg-tertiary border border-border-primary overflow-hidden">
                {filteredMembers.length === 0 ? (
                  <p className="px-6 py-8 text-center text-sm text-text-tertiary">
                    No members match &ldquo;{memberQuery}&rdquo;.
                  </p>
                ) : (
                  <ul className="divide-y divide-border-primary">
                    {filteredMembers.map((m) => {
                      const badge = roleBadge(m.role);
                      const BadgeIcon = badge.icon;
                      const memberName =
                        m.displayName || m.email || "Anonymous";
                      return (
                        <li
                          key={m.id}
                          className="flex items-center gap-4 px-6 py-4"
                        >
                          <Avatar
                            size={40}
                            rounded="md"
                            src={m.avatarUrl}
                            name={memberName}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-text-primary truncate">
                              {m.displayName || "Anonymous"}
                            </p>
                            <p className="text-[11px] text-text-tertiary truncate">
                              {m.email || (
                                <span className="font-mono normal-case tracking-normal">
                                  {m.userId.slice(0, 12)}…
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="hidden sm:block text-[11px] text-text-tertiary uppercase tracking-[0.1em] font-mono normal-case flex-shrink-0">
                            Joined {timeAgo(m.joinedAt)}
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
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>

        {/* INVITES — admin+ only */}
        {canManage && invites.length > 0 && (
          <section className="mb-20">
            <SectionHeader
              number="04"
              title="Pending invites"
              meta={`${invites.length} outstanding`}
            />
            <div className="rounded-lg bg-bg-tertiary border border-border-primary overflow-hidden">
              <ul className="divide-y divide-border-primary">
                {invites.map((inv) => {
                  const badge = roleBadge(inv.role);
                  const BadgeIcon = badge.icon;
                  return (
                    <li
                      key={inv.id}
                      className="flex items-center gap-4 px-6 py-4"
                    >
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
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        {/* PERMISSIONS notice for non-admin viewers */}
        {!canManage && (
          <section className="mb-20">
            <SectionHeader number="04" title="Permissions" meta="Your access" />
            <div className="rounded-lg bg-bg-tertiary border border-border-primary p-6 flex items-start gap-4">
              <Shield
                size={18}
                strokeWidth={1.5}
                className="text-text-tertiary flex-shrink-0 mt-0.5"
              />
              <div className="text-sm text-text-tertiary leading-relaxed">
                Some team management actions (inviting members, changing roles,
                editing team settings) require Admin or Owner permissions.
                Contact a team owner to request additional access.
              </div>
            </div>
          </section>
        )}

        <PageFooter
          subtitle={
            <>
              <Link
                to={ROUTES.TEAMS}
                className="text-[11px] text-text-tertiary hover:text-primary uppercase tracking-[0.14em] transition-colors duration-300 ease-out inline-flex items-center gap-1.5"
              >
                Teams
                <ChevronRight size={11} strokeWidth={1.5} />
              </Link>
              <span className="text-[11px] text-text-tertiary uppercase tracking-[0.14em]">
                {team.name}
              </span>
            </>
          }
          right={
            <div className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] font-mono normal-case tracking-normal">
              {team.id}
            </div>
          }
        />
      </div>

      {/* Invite member modal */}
      <InviteMemberDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        teamId={team.id}
        teamName={team.name}
        viewerIsOwner={(viewerRole ?? "").toLowerCase() === "owner"}
        onInvited={(invite) => {
          setInvites((prev) => [invite, ...prev]);
        }}
      />
    </div>
  );
}
