/**
 * Client API wrappers for /api/teams/* endpoints.
 *
 * Uses apiFetch() which auto-injects Privy auth tokens. Response shapes
 * match server TypeBox models in server/models/world-studio.models.ts.
 */

import { apiFetch } from "./api";

// ============== Types ==============

export interface TeamResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  plan: string;
  aiBudgetMonthlyCents: number;
  aiSpentThisMonthCents: number;
  createdAt: string;
}

export interface TeamMemberResponse {
  id: string;
  userId: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  role: string;
  joinedAt: string;
}

export interface TeamInviteResponse {
  id: string;
  teamId: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
}

export interface AuditLogEntryResponse {
  id: string;
  teamId: string | null;
  gameId: string | null;
  userId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: unknown | null;
  createdAt: string;
}

// ============== API ==============

export async function fetchTeam(teamId: string): Promise<TeamResponse> {
  const res = await apiFetch(`/api/teams/${teamId}`);
  if (!res.ok) throw new Error(`Failed to load team: ${res.status}`);
  return res.json();
}

export async function fetchTeamMembers(
  teamId: string,
): Promise<TeamMemberResponse[]> {
  const res = await apiFetch(`/api/teams/${teamId}/members`);
  if (!res.ok) throw new Error(`Failed to load members: ${res.status}`);
  return res.json();
}

export async function fetchTeamInvites(
  teamId: string,
): Promise<TeamInviteResponse[]> {
  const res = await apiFetch(`/api/teams/${teamId}/invites`);
  if (!res.ok) throw new Error(`Failed to load invites: ${res.status}`);
  return res.json();
}

export async function fetchTeamAuditLog(
  teamId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<AuditLogEntryResponse[]> {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.offset != null) params.set("offset", String(opts.offset));
  const qs = params.toString();
  const url = `/api/teams/${teamId}/audit-log${qs ? `?${qs}` : ""}`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`Failed to load audit log: ${res.status}`);
  return res.json();
}

// ============== Member mutations ==============

export async function updateMemberRole(
  teamId: string,
  userId: string,
  role: string,
): Promise<void> {
  const res = await apiFetch(`/api/teams/${teamId}/members/${userId}`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to update role: ${res.status}`);
  }
}

export async function removeMember(
  teamId: string,
  userId: string,
): Promise<void> {
  const res = await apiFetch(`/api/teams/${teamId}/members/${userId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to remove member: ${res.status}`);
  }
}

export async function leaveTeam(teamId: string): Promise<void> {
  const res = await apiFetch(`/api/teams/${teamId}/leave`, {
    method: "POST",
    // Empty body — Content-Type added by apiFetch only when string body
    // exists. Avoid sending one so Elysia doesn't try to parse it.
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to leave team: ${res.status}`);
  }
}

export async function deleteTeam(teamId: string): Promise<void> {
  const res = await apiFetch(`/api/teams/${teamId}`, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to delete team: ${res.status}`);
  }
}

// ============== Invite mutations ==============

export async function revokeInvite(
  teamId: string,
  inviteId: string,
): Promise<void> {
  const res = await apiFetch(`/api/teams/${teamId}/invites/${inviteId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to revoke invite: ${res.status}`);
  }
}

/** Invitations addressed to the current user's email. */
export async function fetchReceivedInvites(): Promise<TeamInviteResponse[]> {
  const res = await apiFetch("/api/invites/received");
  if (!res.ok) throw new Error(`Failed to load invites: ${res.status}`);
  return res.json();
}

export async function acceptInvite(token: string): Promise<void> {
  const res = await apiFetch("/api/invites/accept", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to accept invite: ${res.status}`);
  }
}

export async function createTeam(input: {
  name: string;
  slug: string;
  description?: string;
}): Promise<TeamResponse> {
  const res = await apiFetch("/api/teams", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create team: ${res.status}`);
  return res.json();
}

export async function updateTeam(
  teamId: string,
  input: {
    name?: string;
    description?: string | null;
    avatarUrl?: string | null;
  },
): Promise<TeamResponse> {
  const res = await apiFetch(`/api/teams/${teamId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to update team: ${res.status}`);
  return res.json();
}

export async function inviteToTeam(
  teamId: string,
  input: { email: string; role: string },
): Promise<TeamInviteResponse> {
  const res = await apiFetch(`/api/teams/${teamId}/invites`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to invite: ${res.status}`);
  return res.json();
}

/**
 * Detect whether a team is the user's auto-created personal team.
 *
 * The server (`server/middleware/auth.ts → ensurePersonalTeam`) seeds a
 * single-member team named "X's Team" with slug `team-${userId[:8]}`
 * for every new user. There's no `isPersonal` column on the teams
 * table; we infer it from the slug pattern.
 *
 * Personal teams should hide certain destructive surfaces (delete,
 * leave) and member/invite tabs since they're always a 1-member team.
 */
export function isPersonalTeam(
  team: { slug: string },
  viewerUserId: string | null,
): boolean {
  if (!viewerUserId) return false;
  return team.slug === `team-${viewerUserId.slice(0, 8)}`;
}

/**
 * Slug a name client-side — basic kebab-case with ASCII-only chars.
 * Server enforces uniqueness so collisions surface as a 409 / 4xx.
 */
export function slugifyTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining marks
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
