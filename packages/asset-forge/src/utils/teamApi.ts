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
