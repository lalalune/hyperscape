/**
 * ProfilePage — /profile
 *
 * Shows the current user's identity, connected auth methods, team
 * memberships with roles, and sign-out action.
 *
 * Data sources:
 *   - useForgeAuth()           — Privy user data
 *   - fetchCurrentUser()       — server view of teams + roles
 *
 * Layout follows the dashboard's editorial composition system:
 *   - 1200px max content
 *   - Numbered section labels
 *   - Atmospheric backdrop
 *   - Restrained Forge Gold accents
 */

import {
  User,
  Mail,
  Wallet,
  ChevronRight,
  LogOut,
  Shield,
  Users,
  ArrowUpRight,
  Loader2,
  Crown,
  Settings,
  Pencil,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useForgeAuth } from "../auth/ForgeAuthProvider";
import { EditProfileDialog } from "../components/profile/EditProfileDialog";
import { Avatar } from "../components/shared/Avatar";
import { ForgeLogo } from "../components/shared/ForgeLogo";
import { ROUTES, buildTeamDetailPath } from "../constants";
import {
  fetchCurrentUser,
  type AuthMeResponse,
  type AuthTeamMembership,
} from "../utils/worldProjectApi";

// =============================================================================
// Utilities
// =============================================================================

function StatusDot({
  tone = "online",
}: {
  tone?: "online" | "ready" | "idle";
}) {
  const map = {
    online: "bg-success",
    ready: "bg-primary",
    idle: "bg-text-tertiary",
  };
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${map[tone]}`}
      style={{ animation: "status-pulse 2.4s ease-in-out infinite" }}
    />
  );
}

function AtmosphericScene() {
  const halfContent = 600;
  const monoliths = [
    {
      side: "left" as const,
      offset: halfContent + 80,
      opacity: 0.45,
      dur: 22,
      delay: 0,
    },
    {
      side: "left" as const,
      offset: halfContent + 8,
      opacity: 0.75,
      dur: 18,
      delay: -7,
    },
    {
      side: "right" as const,
      offset: halfContent + 8,
      opacity: 0.75,
      dur: 20,
      delay: -12,
    },
    {
      side: "right" as const,
      offset: halfContent + 80,
      opacity: 0.45,
      dur: 24,
      delay: -3,
    },
  ];
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        className="absolute inset-x-0 top-0 h-[640px]"
        style={{
          background:
            "radial-gradient(ellipse 100% 100% at 50% 0%, rgba(28,30,34,0.75) 0%, transparent 75%)",
        }}
      />
      {monoliths.map((m, i) => (
        <div
          key={i}
          className="absolute inset-y-0 w-px"
          style={{
            [m.side]: `calc(50% - ${m.offset}px)`,
            background: `linear-gradient(180deg, transparent 0%, rgba(28,30,34,${m.opacity}) 30%, rgba(28,30,34,${m.opacity}) 70%, transparent 100%)`,
            animation: `drift-y ${m.dur}s ease-in-out infinite`,
            animationDelay: `${m.delay}s`,
          }}
        />
      ))}
      <div
        className="absolute inset-x-0 top-[440px] h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 5%, rgba(212,175,55,0.22) 50%, transparent 95%)",
          animation: "celestial-pulse 8s ease-in-out infinite",
        }}
      />
    </div>
  );
}

function SectionHeader({
  number,
  title,
  meta,
}: {
  number: string;
  title: string;
  meta?: React.ReactNode;
}) {
  return (
    <header className="mb-8 pb-4 border-b border-border-primary flex items-baseline gap-4">
      <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em] flex-shrink-0">
        {number}
      </span>
      <h2 className="font-display text-base font-medium text-text-primary tracking-tight">
        {title}
      </h2>
      {meta && (
        <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
          {meta}
        </span>
      )}
    </header>
  );
}

/** Role-to-icon-and-color helper for team membership rows. */
function roleBadge(role: string): {
  label: string;
  icon: typeof Crown;
  tone: "primary" | "secondary" | "tertiary";
} {
  const normalized = role.toLowerCase();
  if (normalized === "owner")
    return { label: "Owner", icon: Crown, tone: "primary" };
  if (normalized === "admin")
    return { label: "Admin", icon: Shield, tone: "primary" };
  if (normalized === "editor")
    return { label: "Editor", icon: Settings, tone: "secondary" };
  return { label: role || "Viewer", icon: User, tone: "tertiary" };
}

// =============================================================================
// Sections
// =============================================================================

function IdentityCard({
  user,
  displayName,
  avatarUrl,
  onEdit,
}: {
  user: ReturnType<typeof useForgeAuth>["user"];
  displayName: string;
  avatarUrl: string | null;
  onEdit: () => void;
}) {
  const email = user?.email?.address ?? null;
  const wallet = user?.wallet?.address ?? null;
  const linkedAccounts = (user?.linkedAccounts ?? []).length;

  return (
    <div className="rounded-lg bg-bg-tertiary border border-border-primary overflow-hidden">
      <div className="p-7 flex items-start gap-6">
        <Avatar size={80} rounded="lg" src={avatarUrl} name={displayName} />

        <div className="flex flex-col gap-2 min-w-0 flex-1">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="font-display text-2xl font-medium text-text-primary tracking-tight">
              {displayName}
            </h2>
            <span className="flex items-center gap-1.5 text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
              <StatusDot tone="online" />
              Signed in
            </span>
          </div>
          <p className="text-sm text-text-tertiary leading-relaxed">
            Identity managed by Privy. Sign in with email, Google, or wallet —
            all connections show below.
          </p>
        </div>

        <button
          type="button"
          onClick={onEdit}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-primary border border-border-primary hover:border-primary/40 text-[11px] text-text-secondary hover:text-primary uppercase tracking-[0.12em] transition-colors duration-300 ease-out"
          title="Edit display name + avatar"
        >
          <Pencil size={11} strokeWidth={1.5} />
          Edit
        </button>
      </div>

      {/* Connected methods strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border-primary border-t border-border-primary">
        <ConnectedMethod
          icon={Mail}
          label="Email"
          value={email}
          tone={email ? "online" : "idle"}
        />
        <ConnectedMethod
          icon={Wallet}
          label="Wallet"
          value={wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : null}
          tone={wallet ? "online" : "idle"}
          mono
        />
        <ConnectedMethod
          icon={User}
          label="Linked accounts"
          value={linkedAccounts > 0 ? `${linkedAccounts} connected` : null}
          tone={linkedAccounts > 0 ? "online" : "idle"}
        />
      </div>
    </div>
  );
}

function ConnectedMethod({
  icon: Icon,
  label,
  value,
  tone,
  mono = false,
}: {
  icon: typeof Mail;
  label: string;
  value: string | null;
  tone: "online" | "idle";
  mono?: boolean;
}) {
  return (
    <div className="px-6 py-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={12} strokeWidth={1.5} className="text-text-tertiary" />
        <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-[0.14em]">
          {label}
        </p>
        <StatusDot tone={tone} />
      </div>
      <p
        className={`text-sm text-text-primary truncate ${mono ? "font-mono tabular-nums" : ""}`}
      >
        {value || (
          <span className="text-text-tertiary italic font-normal">
            Not connected
          </span>
        )}
      </p>
    </div>
  );
}

function TeamMembershipsSection({
  teams,
  loading,
}: {
  teams: AuthTeamMembership[];
  loading: boolean;
}) {
  return (
    <section className="mb-20">
      <SectionHeader
        number="02"
        title="Teams"
        meta={
          loading
            ? "Loading"
            : `${teams.length} membership${teams.length === 1 ? "" : "s"}`
        }
      />

      {loading && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-20 rounded-lg bg-bg-tertiary border border-border-primary"
              style={{
                animation: "celestial-pulse 2.4s ease-in-out infinite",
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      )}

      {!loading && teams.length === 0 && (
        <div className="rounded-lg bg-bg-tertiary border border-border-primary p-10 text-center">
          <Users
            size={28}
            strokeWidth={1.25}
            className="text-text-tertiary/60 mx-auto mb-4"
          />
          <p className="text-sm text-text-tertiary mb-4">
            You don&apos;t belong to any teams yet.
          </p>
          <Link
            to={ROUTES.TEAMS}
            className="inline-flex items-center gap-1.5 text-[11px] text-primary uppercase tracking-[0.12em] hover:text-primary-light transition-colors duration-300 ease-out"
          >
            Create a team
            <ChevronRight size={12} strokeWidth={1.5} />
          </Link>
        </div>
      )}

      {!loading && teams.length > 0 && (
        <div className="rounded-lg bg-bg-tertiary border border-border-primary overflow-hidden">
          <ul className="divide-y divide-border-primary">
            {teams.map((t) => {
              const badge = roleBadge(t.role);
              const BadgeIcon = badge.icon;
              return (
                <li key={t.teamId}>
                  <Link
                    to={buildTeamDetailPath(t.teamId)}
                    className="group flex items-center gap-5 px-6 py-5 hover:bg-bg-secondary transition-colors duration-300 ease-out"
                  >
                    <div className="w-10 h-10 rounded bg-bg-primary border border-border-primary flex items-center justify-center flex-shrink-0">
                      <span className="font-display text-base font-medium text-text-primary tracking-tight">
                        {t.teamName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-base font-medium text-text-primary tracking-tight truncate">
                        {t.teamName}
                      </p>
                      <p className="text-[11px] text-text-tertiary uppercase tracking-[0.1em] mt-0.5 font-mono normal-case">
                        {t.teamId}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <BadgeIcon
                        size={12}
                        strokeWidth={1.5}
                        className={
                          badge.tone === "primary"
                            ? "text-primary"
                            : "text-text-tertiary"
                        }
                      />
                      <span
                        className={`text-[11px] uppercase tracking-[0.12em] ${
                          badge.tone === "primary"
                            ? "text-primary"
                            : "text-text-secondary"
                        }`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <ArrowUpRight
                      size={14}
                      strokeWidth={1.5}
                      className="text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out flex-shrink-0"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link
            to={ROUTES.TEAMS}
            className="block px-6 py-3 border-t border-border-primary text-[11px] text-text-tertiary hover:text-primary uppercase tracking-[0.12em] transition-colors duration-300 ease-out"
          >
            Manage all teams →
          </Link>
        </div>
      )}
    </section>
  );
}

function SessionSection({ onSignOut }: { onSignOut: () => void }) {
  return (
    <section className="mb-20">
      <SectionHeader number="03" title="Session" meta="Account actions" />
      <div className="rounded-lg bg-bg-tertiary border border-border-primary overflow-hidden">
        <button
          type="button"
          onClick={onSignOut}
          className="group flex items-center justify-between gap-4 w-full px-6 py-5 text-left hover:bg-bg-secondary transition-colors duration-300 ease-out"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded bg-bg-primary border border-border-primary flex items-center justify-center flex-shrink-0">
              <LogOut
                size={14}
                strokeWidth={1.5}
                className="text-error group-hover:text-error transition-colors duration-300 ease-out"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary mb-0.5">
                Sign out
              </p>
              <p className="text-[11px] text-text-tertiary uppercase tracking-[0.1em]">
                End this session and return to landing
              </p>
            </div>
          </div>
          <ChevronRight
            size={14}
            strokeWidth={1.5}
            className="text-text-tertiary group-hover:text-error transition-colors duration-300 ease-out flex-shrink-0"
          />
        </button>
      </div>
    </section>
  );
}

// =============================================================================
// Page
// =============================================================================

export function ProfilePage() {
  const auth = useForgeAuth();
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!auth.ready || !auth.authenticated) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetchCurrentUser();
        if (!cancelled) {
          setMe(res);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load profile",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [auth.ready, auth.authenticated]);

  // Display name — server takes priority, then Privy email/wallet
  const displayName =
    me?.user.displayName ||
    me?.user.email ||
    auth.user?.email?.address ||
    auth.user?.wallet?.address?.slice(0, 8) ||
    "Anonymous";

  // Auth not loaded yet
  if (!auth.ready) {
    return (
      <div className="flex items-center justify-center min-h-full bg-bg-primary">
        <Loader2 size={20} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="relative min-h-full bg-bg-primary overflow-hidden">
      <AtmosphericScene />

      <div className="relative max-w-[1200px] mx-auto px-10 py-16">
        {/* ====================================================================
            00 / HERO
            ==================================================================== */}
        <header className="mb-16">
          <div className="flex items-baseline gap-4 mb-6">
            <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
              00
            </span>
            <span className="font-display text-base font-medium text-text-primary tracking-tight">
              Profile
            </span>
            <span className="flex items-center gap-2 text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
              <StatusDot tone="online" />
              {me?.user.id ? `id ${me.user.id.slice(0, 8)}` : "Signed in"}
            </span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-medium text-text-primary tracking-tight leading-[1.05] mb-3">
            Your <span className="text-primary">identity</span>
          </h1>
          <p className="text-base text-text-tertiary max-w-2xl leading-relaxed">
            Manage your HyperForge identity, connected auth methods, and team
            memberships.
          </p>
        </header>

        {error && (
          <div className="rounded-lg bg-bg-tertiary border border-error/40 p-6 mb-8">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {/* ====================================================================
            01 / IDENTITY
            ==================================================================== */}
        <section className="mb-20">
          <SectionHeader
            number="01"
            title="Identity"
            meta="Connected accounts"
          />
          <IdentityCard
            user={auth.user}
            displayName={displayName}
            avatarUrl={me?.user.avatarUrl ?? null}
            onEdit={() => setEditOpen(true)}
          />
        </section>

        {/* ====================================================================
            02 / TEAMS
            ==================================================================== */}
        <TeamMembershipsSection teams={me?.teams ?? []} loading={loading} />

        {/* ====================================================================
            03 / SESSION
            ==================================================================== */}
        <SessionSection onSignOut={auth.logout} />

        {/* ====================================================================
            FOOTER
            ==================================================================== */}
        <footer className="relative pt-10 border-t border-border-primary">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div className="flex items-center gap-3">
              <ForgeLogo size={18} />
              <span className="font-display text-sm font-medium text-text-secondary tracking-tight">
                HyperForge
              </span>
              <span className="text-text-tertiary/40">·</span>
              <span className="text-[11px] text-text-tertiary uppercase tracking-[0.14em]">
                Profile
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
              <StatusDot tone="online" />
              Identity managed by Privy
            </div>
          </div>
        </footer>
      </div>

      {/* Edit profile modal — only mount once /api/auth/me has loaded */}
      {me && (
        <EditProfileDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          user={me.user}
          onUpdated={(updated) => setMe(updated)}
        />
      )}
    </div>
  );
}
