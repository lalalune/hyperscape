/**
 * TeamsPage — /teams
 *
 * Lists all teams the user belongs to with role, member counts (loaded
 * lazily), and a CTA to create a new team. Real product surface that
 * uses the existing AuthMeResponse.teams shape from /api/auth/me.
 */

import {
  Users,
  Plus,
  ArrowUpRight,
  ChevronRight,
  Crown,
  Shield,
  Settings,
  User,
  Loader2,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useForgeAuth } from "../auth/ForgeAuthProvider";
import { ForgeLogo } from "../components/shared/ForgeLogo";
import { CreateTeamDialog } from "../components/teams/CreateTeamDialog";
import { ROUTES, buildTeamDetailPath } from "../constants";
import {
  fetchCurrentUser,
  type AuthTeamMembership,
} from "../utils/worldProjectApi";

// =============================================================================
// Primitives (mirrors ProfilePage / DashboardPage)
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
  action,
}: {
  number: string;
  title: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-8 pb-4 border-b border-border-primary flex items-baseline justify-between gap-4">
      <div className="flex items-baseline gap-4 min-w-0">
        <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em] flex-shrink-0">
          {number}
        </span>
        <h2 className="font-display text-base font-medium text-text-primary tracking-tight">
          {title}
        </h2>
        {meta && (
          <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] truncate">
            {meta}
          </span>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </header>
  );
}

function roleBadge(role: string) {
  const normalized = role.toLowerCase();
  if (normalized === "owner")
    return { label: "Owner", icon: Crown, isPrimary: true };
  if (normalized === "admin")
    return { label: "Admin", icon: Shield, isPrimary: true };
  if (normalized === "editor")
    return { label: "Editor", icon: Settings, isPrimary: false };
  return { label: role || "Viewer", icon: User, isPrimary: false };
}

// =============================================================================
// Page
// =============================================================================

export function TeamsPage() {
  const auth = useForgeAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<AuthTeamMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!auth.ready || !auth.authenticated) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const me = await fetchCurrentUser();
        if (!cancelled) {
          setTeams(me.teams);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load teams");
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
        {/* HERO */}
        <header className="mb-16">
          <div className="flex items-baseline gap-4 mb-6">
            <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
              00
            </span>
            <span className="font-display text-base font-medium text-text-primary tracking-tight">
              Teams
            </span>
            <span className="flex items-center gap-2 text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
              <StatusDot tone="online" />
              {loading
                ? "Loading"
                : `${teams.length} membership${teams.length === 1 ? "" : "s"}`}
            </span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-medium text-text-primary tracking-tight leading-[1.05] mb-3">
            Your <span className="text-primary">teams</span>
          </h1>
          <p className="text-base text-text-tertiary max-w-2xl leading-relaxed">
            Teams group your worlds, asset libraries, and member roles. Each
            team has its own AI budget and permissions.
          </p>
        </header>

        {error && (
          <div className="rounded-lg bg-bg-tertiary border border-error/40 p-6 mb-8">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {/* TEAM LIST */}
        <section className="mb-20">
          <SectionHeader
            number="01"
            title="Memberships"
            meta="All teams"
            action={
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-tertiary border border-border-primary hover:border-primary/40 text-[11px] text-text-secondary hover:text-primary uppercase tracking-[0.12em] transition-colors duration-300 ease-out"
              >
                <Plus size={11} strokeWidth={2} />
                New team
              </button>
            }
          />

          {loading && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-lg bg-bg-tertiary border border-border-primary"
                  style={{
                    animation: "celestial-pulse 2.4s ease-in-out infinite",
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          )}

          {!loading && teams.length === 0 && (
            <div className="rounded-lg bg-bg-tertiary border border-border-primary p-12 text-center overflow-hidden relative">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse 60% 80% at 50% 100%, rgba(212,175,55,0.05) 0%, transparent 70%)",
                }}
              />
              <div className="relative">
                <Users
                  size={32}
                  strokeWidth={1.25}
                  className="text-text-tertiary/60 mx-auto mb-5"
                />
                <h3 className="font-display text-xl font-medium text-text-primary tracking-tight mb-2">
                  No team memberships
                </h3>
                <p className="text-sm text-text-tertiary max-w-md mx-auto leading-relaxed mb-6">
                  Teams are how you collaborate on worlds. Create your first
                  team to start a game project.
                </p>
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-bg-primary text-sm font-medium hover:bg-primary-dark transition-colors duration-500 ease-out"
                >
                  <Plus size={14} strokeWidth={2} />
                  Create your first team
                </button>
              </div>
            </div>
          )}

          {!loading && teams.length > 0 && (
            <div className="space-y-3">
              {teams.map((t) => {
                const badge = roleBadge(t.role);
                const BadgeIcon = badge.icon;
                return (
                  <Link
                    key={t.teamId}
                    to={buildTeamDetailPath(t.teamId)}
                    className="group relative flex items-center gap-5 rounded-lg bg-bg-tertiary border border-border-primary hover:border-primary/40 p-6 transition-colors duration-500 ease-out overflow-hidden"
                  >
                    {/* Gold left-edge on hover */}
                    <span className="pointer-events-none absolute left-0 top-6 bottom-6 w-px bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out" />

                    {/* Avatar */}
                    <div className="w-12 h-12 rounded bg-bg-primary border border-border-primary flex items-center justify-center flex-shrink-0">
                      <span className="font-display text-lg font-medium text-text-primary tracking-tight">
                        {t.teamName.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-display text-lg font-medium text-text-primary tracking-tight truncate">
                        {t.teamName}
                      </p>
                      <p className="text-[11px] text-text-tertiary uppercase tracking-[0.1em] mt-1 font-mono normal-case">
                        {t.teamId}
                      </p>
                    </div>

                    {/* Role badge */}
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded bg-bg-primary border border-border-primary flex-shrink-0">
                      <BadgeIcon
                        size={12}
                        strokeWidth={1.5}
                        className={
                          badge.isPrimary
                            ? "text-primary"
                            : "text-text-tertiary"
                        }
                      />
                      <span
                        className={`text-[11px] uppercase tracking-[0.12em] ${
                          badge.isPrimary
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
                      className="text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out flex-shrink-0"
                    />
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* QUICK LINKS */}
        <section className="mb-20">
          <SectionHeader
            number="02"
            title="Quick links"
            meta="Related surfaces"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Link
              to={ROUTES.PROFILE}
              className="group flex items-center justify-between p-5 rounded-lg bg-bg-tertiary border border-border-primary hover:border-primary/40 transition-colors duration-500 ease-out"
            >
              <div className="flex items-center gap-3">
                <User
                  size={16}
                  strokeWidth={1.5}
                  className="text-text-tertiary group-hover:text-primary transition-colors duration-500 ease-out"
                />
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    Your profile
                  </p>
                  <p className="text-[11px] text-text-tertiary uppercase tracking-[0.1em] mt-0.5">
                    Identity & connected accounts
                  </p>
                </div>
              </div>
              <ChevronRight
                size={14}
                strokeWidth={1.5}
                className="text-text-tertiary group-hover:text-primary transition-colors duration-500 ease-out"
              />
            </Link>
            <Link
              to={ROUTES.WORLD_STUDIO}
              className="group flex items-center justify-between p-5 rounded-lg bg-bg-tertiary border border-border-primary hover:border-primary/40 transition-colors duration-500 ease-out"
            >
              <div className="flex items-center gap-3">
                <Users
                  size={16}
                  strokeWidth={1.5}
                  className="text-text-tertiary group-hover:text-primary transition-colors duration-500 ease-out"
                />
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    Team worlds
                  </p>
                  <p className="text-[11px] text-text-tertiary uppercase tracking-[0.1em] mt-0.5">
                    Browse projects in your team
                  </p>
                </div>
              </div>
              <ChevronRight
                size={14}
                strokeWidth={1.5}
                className="text-text-tertiary group-hover:text-primary transition-colors duration-500 ease-out"
              />
            </Link>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="pt-10 border-t border-border-primary">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div className="flex items-center gap-3">
              <ForgeLogo size={18} />
              <span className="font-display text-sm font-medium text-text-secondary tracking-tight">
                HyperForge
              </span>
              <span className="text-text-tertiary/40">·</span>
              <span className="text-[11px] text-text-tertiary uppercase tracking-[0.14em]">
                Teams
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
              <StatusDot tone="online" />
              All systems operational
            </div>
          </div>
        </footer>
      </div>

      {/* Create-team modal */}
      <CreateTeamDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(team) => navigate(buildTeamDetailPath(team.id))}
      />
    </div>
  );
}
