/**
 * GenerationPackTargetBanner — bridges the Asset Packs page and
 * the Generation page so a user can launch a bake "for" a
 * specific pack and add the result with one click when it's
 * ready.
 *
 * Activation: the banner reads `?targetPack=<manifestId>` from
 * the URL. When present, it fetches the pack, sticks itself at
 * the top of the page, and watches `useGenerationStore.selectedAsset`.
 * Once the user has selected (or just baked) a completed asset,
 * the **Add to Pack** button posts to `addAssetPackEntry` and
 * navigates back to the Asset Packs page.
 *
 * Why a top-level banner instead of inline buttons in
 * GenerationPage: the generation surface is already complex
 * (pipelines, cards, advanced prompts). Wrapping its existing
 * flows with a thin overlay keeps the integration scoped — no
 * GenerationPage internals are touched, and the feature is easy
 * to remove or extend.
 */

import { ArrowLeft, Loader2, Package, Sparkles, X } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { ROUTES } from "../constants";
import { useGenerationStore } from "../store";
import {
  addAssetPackEntry,
  getAssetPack,
  type AssetPackResponse,
} from "../utils/assetPackApi";

const QUERY_TARGET_PACK = "targetPack";

/** Slugify free-form text for use as a pack-scoped entry id. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Map the generation pipeline's free-form `type` field to the
 * eight-value `AssetPackEntry["type"]` enum. Anything unknown
 * lands in "misc".
 */
function inferEntryType(
  raw: string | undefined,
):
  | "character"
  | "creature"
  | "prop"
  | "weapon"
  | "tool"
  | "armor"
  | "vehicle"
  | "misc" {
  const lc = (raw ?? "").toLowerCase();
  if (lc === "character") return "character";
  if (lc === "creature" || lc === "mob" || lc === "enemy") return "creature";
  if (lc === "weapon") return "weapon";
  if (lc === "tool") return "tool";
  if (lc === "armor" || lc === "helmet" || lc === "shield") return "armor";
  if (lc === "vehicle") return "vehicle";
  if (lc === "prop" || lc === "tree" || lc === "rock" || lc === "plant") {
    return "prop";
  }
  return "misc";
}

export function GenerationPackTargetBanner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const targetPackId = searchParams.get(QUERY_TARGET_PACK);
  const [pack, setPack] = useState<AssetPackResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packLoadError, setPackLoadError] = useState<string | null>(null);
  const selectedAsset = useGenerationStore((s) => s.selectedAsset);

  useEffect(() => {
    if (!targetPackId) {
      setPack(null);
      setPackLoadError(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const p = await getAssetPack(targetPackId);
        if (cancelled) return;
        if (!p) {
          setPack(null);
          setPackLoadError(`Pack "${targetPackId}" not found.`);
        } else {
          setPack(p);
          setPackLoadError(null);
        }
      } catch (err) {
        if (cancelled) return;
        setPack(null);
        setPackLoadError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetPackId]);

  const dismissTarget = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete(QUERY_TARGET_PACK);
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const canAdd = !!(
    pack &&
    selectedAsset &&
    selectedAsset.hasModel &&
    selectedAsset.status === "completed"
  );

  const handleAdd = useCallback(async () => {
    if (!pack || !selectedAsset || !canAdd) return;
    setError(null);
    setSubmitting(true);
    try {
      const entryId =
        slugify(selectedAsset.name) || slugify(selectedAsset.id) || "asset";
      await addAssetPackEntry(pack.manifestId, {
        id: entryId,
        name: selectedAsset.name,
        description: selectedAsset.description,
        type: inferEntryType(selectedAsset.type),
        subtype: selectedAsset.type || "misc",
        modelUrl: `/api/assets/${selectedAsset.id}/model`,
      });
      // Drop the target so a follow-up bake doesn't auto-route, then
      // navigate back to the packs page with success-celebration
      // params. The page reads these and feeds them to the panel
      // so the user lands on a flash banner + auto-expanded pack
      // showing their fresh entry.
      dismissTarget();
      const successParams = new URLSearchParams({
        justAdded: pack.manifestId,
        addedAssetName: selectedAsset.name,
      });
      navigate(`${ROUTES.ASSET_PACKS}?${successParams.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [pack, selectedAsset, canAdd, navigate, dismissTarget]);

  if (!targetPackId) return null;

  // Pack lookup failed — show a small error banner with a dismiss
  // affordance so users aren't stuck.
  if (packLoadError && !pack) {
    return (
      <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 flex items-center gap-2">
        <Package size={12} className="text-amber-400 flex-shrink-0" />
        <p className="text-[11px] text-amber-200 flex-1 truncate">
          Couldn't load target pack: {packLoadError}
        </p>
        <button
          type="button"
          onClick={dismissTarget}
          className="text-amber-200/70 hover:text-amber-100"
        >
          <X size={11} />
        </button>
      </div>
    );
  }

  if (!pack) {
    // Loading the pack — render a thin placeholder so layout
    // doesn't shift when it resolves.
    return (
      <div className="border-b border-border-primary bg-bg-tertiary/30 px-4 py-2 flex items-center gap-2">
        <Loader2 size={11} className="animate-spin text-text-tertiary" />
        <p className="text-[11px] text-text-tertiary">Loading target pack…</p>
      </div>
    );
  }

  const packName =
    (pack.manifest as { name?: string })?.name ?? pack.manifestId;

  const status = !selectedAsset
    ? "idle"
    : !selectedAsset.hasModel
      ? "baking"
      : selectedAsset.status !== "completed"
        ? "baking"
        : "ready";

  return (
    <div className="border-b border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-2.5 flex items-center gap-3 flex-wrap">
      <Sparkles size={14} className="text-primary flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-primary">
          <span className="text-text-tertiary">Generating for</span>{" "}
          <span className="font-medium">{packName}</span>
        </p>
        <p className="text-[10px] text-text-tertiary mt-0.5">
          {status === "ready" && selectedAsset && (
            <>
              Ready to add:{" "}
              <span className="text-text-secondary">{selectedAsset.name}</span>
            </>
          )}
          {status === "baking" && selectedAsset && (
            <>
              {selectedAsset.name} is still baking — pick a completed asset to
              add it.
            </>
          )}
          {status === "idle" && (
            <>Generate or select a completed asset, then add it to the pack.</>
          )}
        </p>
        {error && <p className="text-[10px] text-red-400 mt-0.5">{error}</p>}
      </div>
      <Link
        to={ROUTES.ASSET_PACKS}
        className="text-[11px] text-text-tertiary hover:text-text-primary transition-colors inline-flex items-center gap-1 flex-shrink-0"
      >
        <ArrowLeft size={11} />
        Back to packs
      </Link>
      <button
        type="button"
        onClick={() => void handleAdd()}
        disabled={!canAdd || submitting}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        title={
          canAdd
            ? `Add ${selectedAsset?.name} to ${packName}`
            : "Pick a completed asset first"
        }
      >
        {submitting ? (
          <>
            <Loader2 size={11} className="animate-spin" />
            Adding
          </>
        ) : (
          "Add to Pack"
        )}
      </button>
      <button
        type="button"
        onClick={dismissTarget}
        className="text-text-tertiary hover:text-text-primary flex-shrink-0"
        title="Dismiss target"
      >
        <X size={12} />
      </button>
    </div>
  );
}
