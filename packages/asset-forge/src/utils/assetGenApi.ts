/**
 * Client wrapper for the AI asset generation pipeline endpoints.
 *
 * Phase A5 of the AAA gap audit. Lets the agent's `PROPOSE_ASSET`
 * emissions flow into the existing studio bake pipeline without
 * the agent server having to know about the studio's internal
 * generation routes.
 *
 * The pipeline is async — `kickoffAssetGeneration` POSTs the
 * config and returns a `pipelineId` immediately. The caller polls
 * `getAssetPipelineStatus(id)` until status === "completed" or
 * "failed". Total bake time: 30s preview / 2-5min standard.
 */

import { apiFetch } from "./api";

/**
 * Asset proposal as the agent sees it (matches `AssetProposal`
 * from `@hyperforge/eliza-game-builder`). Pulled into a local
 * type so this file doesn't introduce a transitive import on
 * the agent package — the agent server stays the canonical
 * shape definer; this client wrapper just maps proposals to
 * pipeline configs.
 */
export interface AgentAssetProposal {
  readonly name: string;
  readonly type: string;
  readonly subtype: string;
  readonly prompt: string;
  readonly style?: string;
  readonly quality?: string;
  readonly enableRigging?: boolean;
  readonly characterHeight?: number;
  readonly referenceImageUrl?: string;
}

export interface AssetGenerationKickoff {
  readonly pipelineId: string;
  readonly assetId: string;
  readonly status: string;
  readonly message: string;
}

export interface AssetPipelineStatus {
  readonly id: string;
  readonly status: string;
  readonly progress: number;
  readonly stages: Record<string, unknown>;
  readonly results: Record<string, unknown>;
  readonly error?: string;
  readonly createdAt: string;
  readonly completedAt?: string;
}

/**
 * Translate an agent's `PROPOSE_ASSET` proposal to a server-side
 * pipeline kickoff. Returns the `pipelineId` + synthesized
 * `assetId` so the caller can track the bake without further
 * agent involvement.
 *
 * Throws on HTTP error (400 invalid config / 500 server error).
 * The caller is responsible for surfacing the failure.
 */
export async function kickoffAssetGeneration(
  proposal: AgentAssetProposal,
): Promise<AssetGenerationKickoff> {
  // Synthesize an assetId from the name. The server uses this as
  // the asset record's primary key — slugified for the route +
  // suffixed with a short random code so concurrent agent runs
  // don't collide.
  const slug = proposal.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const random = Math.random().toString(36).slice(2, 8);
  const assetId = `${slug || "asset"}-${random}`;

  const config: Record<string, unknown> = {
    description: proposal.prompt,
    assetId,
    name: proposal.name,
    type: proposal.type,
    subtype: proposal.subtype,
    quality: proposal.quality ?? "standard",
    style: proposal.style ?? "stylized",
    enableRigging: proposal.enableRigging ?? false,
  };
  if (proposal.characterHeight !== undefined) {
    config.metadata = { characterHeight: proposal.characterHeight };
  }
  if (proposal.referenceImageUrl) {
    config.referenceImage = {
      source: "url",
      url: proposal.referenceImageUrl,
    };
  }

  const res = await apiFetch("/api/generation/pipeline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {
      /* ignore */
    }
    throw new Error(
      `kickoffAssetGeneration failed (HTTP ${res.status})${detail ? ": " + detail : ""}`,
    );
  }
  const json = (await res.json()) as {
    pipelineId: string;
    status: string;
    message: string;
  };
  return {
    pipelineId: json.pipelineId,
    assetId,
    status: json.status,
    message: json.message,
  };
}

export async function getAssetPipelineStatus(
  pipelineId: string,
): Promise<AssetPipelineStatus> {
  const res = await apiFetch(
    `/api/generation/pipeline/${encodeURIComponent(pipelineId)}`,
  );
  if (!res.ok) {
    throw new Error(`getAssetPipelineStatus failed (HTTP ${res.status})`);
  }
  return (await res.json()) as AssetPipelineStatus;
}
