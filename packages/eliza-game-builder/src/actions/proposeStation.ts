/**
 * `PROPOSE_STATION` — placement action for crafting stations
 * (anvils, furnaces, cooking ranges, banks, etc.).
 *
 * Layer B (agent ↔ plugins) gives stations a first-class
 * vocabulary — the Hyperia plugin contributes `anvil`, `furnace`,
 * `range`, and `bank` station types. This action is the agent's
 * way to emit them. Mirrors the shape of `PROPOSE_NPC_PLACEMENT`:
 * Zod-validate against `WorldAreaStationSchema`, then run the
 * Layer B validators (type matches an installed plugin's
 * contribution; assetRef resolves in installed packs).
 *
 * Required fields:
 *   id, type, position { x, y, z }
 *
 * Optional:
 *   assetRef — `<packId>/<entryId>` from GET_PROJECT_STATE.availableAssets
 *
 * The schema uses `.passthrough()` so engine-specific extra
 * fields (rotation, scale) are preserved.
 */

import type {
  Action,
  ActionResult,
  HandlerCallback,
  HandlerOptions,
  IAgentRuntime,
  Memory,
  ProviderDataRecord,
  State,
} from "@elizaos/core";
import { WorldAreaStationSchema } from "@hyperforge/manifest-schema";
import { GameBuilderService } from "../services/GameBuilderService.js";
import {
  autoFillAssetRef,
  validateAssetRef,
  validatePlacementType,
} from "./placementValidators.js";
import { readObjectField } from "./shared.js";

export const proposeStationAction: Action = {
  name: "PROPOSE_STATION",
  similes: ["PLACE_STATION", "ADD_STATION", "CREATE_STATION", "SUBMIT_STATION"],
  description:
    'Propose a crafting station (anvil, furnace, cooking range, bank, etc.) in the world. Pass `station` — a JSON object matching `WorldAreaStationSchema` (id, type, position {x,y,z}; optionally assetRef). The handler validates the schema, then validates that `type` matches an installed plugin\'s station contribution (call LIST_ENTITY_TYPES kind="station" to discover) and that `assetRef` (when provided) resolves in an installed pack. Strongly recommend setting `assetRef` to a value from `GET_PROJECT_STATE.availableAssets` (filter by acceptedAssetTypes for this station type) so the engine renders the actual station model.',

  parameters: [
    {
      name: "station",
      description:
        "The WorldAreaStation JSON. Required: id (string), type (e.g. 'anvil', 'furnace', 'range', 'bank' — must match a station type from LIST_ENTITY_TYPES), position {x,y,z}. Optional: assetRef (a `<packId>/<entryId>` ref from GET_PROJECT_STATE.availableAssets).",
      required: true,
      schema: { type: "object" },
    },
  ],

  validate: async (runtime: IAgentRuntime) => {
    return (
      runtime.getService<GameBuilderService>(GameBuilderService.serviceType) !==
      null
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    options?: HandlerOptions | Record<string, unknown>,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    const service = runtime.getService<GameBuilderService>(
      GameBuilderService.serviceType,
    );
    if (!service) {
      const error = new Error("GameBuilderService not available");
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const stationRaw = readObjectField(options, "station");
    if (!stationRaw) {
      const error = new Error(
        "PROPOSE_STATION requires a `station` parameter — a WorldAreaStation JSON object.",
      );
      await callback?.({ text: error.message, error: true });
      return { success: false, error };
    }

    const result = WorldAreaStationSchema.safeParse(stationRaw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      }));
      const lines = issues.map((i) => `  ${i.path || "(root)"}: ${i.message}`);
      const text = `Station invalid — ${issues.length} issue${issues.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
      await callback?.({ text, error: true });
      return {
        success: false,
        text,
        data: { issues } as unknown as ProviderDataRecord,
      };
    }

    let station = result.data;

    // Layer B — gameplay-typed validation.
    const typeCheck = validatePlacementType(runtime, "station", station.type);
    if (!typeCheck.ok) {
      await callback?.({ text: typeCheck.message, error: true });
      return {
        success: false,
        text: typeCheck.message,
        data: typeCheck.detail as unknown as ProviderDataRecord,
      };
    }

    // Auto-fill assetRef when omitted. Stations have a tight
    // `type` ↔ entry id correspondence in the seeded Hyperia
    // packs (`anvil` station → `anvil` entry), so we pass the
    // type as the preferred id.
    let autoFilledRef: string | null = null;
    const providedRef = (station as { assetRef?: string }).assetRef;
    if (!providedRef) {
      autoFilledRef = autoFillAssetRef(
        runtime,
        "station",
        station.type,
        station.type,
      );
      if (autoFilledRef) {
        station = { ...station, assetRef: autoFilledRef };
      }
    }

    const refCheck = validateAssetRef(
      runtime,
      (station as { assetRef?: string }).assetRef,
    );
    if (!refCheck.ok) {
      await callback?.({ text: refCheck.message, error: true });
      return {
        success: false,
        text: refCheck.message,
        data: refCheck.detail as unknown as ProviderDataRecord,
      };
    }

    const summary = [
      `Station accepted: ${station.id}`,
      `  type:     ${station.type}`,
      `  position: (${station.position.x}, ${station.position.y}, ${station.position.z})`,
    ];
    const finalRef = (station as { assetRef?: string }).assetRef;
    if (finalRef) {
      summary.push(
        `  assetRef: ${finalRef}${autoFilledRef ? " (auto-picked)" : ""}`,
      );
    }
    const text = summary.join("\n");

    await callback?.({ text, action: "PROPOSE_STATION" });

    return {
      success: true,
      text,
      values: { id: station.id, type: station.type },
      data: { station } as unknown as ProviderDataRecord,
    };
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Drop an anvil and furnace next to the smithy." },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Station accepted: smithy-anvil\n  type: anvil\n  position: (12, 0, 8)\n  assetRef: @hyperforge/asset-pack-hyperia-stations-v1/anvil",
          actions: ["PROPOSE_STATION"],
        },
      },
    ],
  ],
};
