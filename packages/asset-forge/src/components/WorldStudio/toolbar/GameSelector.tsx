/**
 * GameSelector — lets the editor user pick which game plugin set
 * the PIE (Play-In-Editor) session will boot into.
 *
 * Persists the choice to `localStorage` under the well-known key
 * `hyperscape:game-plugin`. The same key is consumed by the
 * client's `resolveGamePluginSetIdFromEnv()` as a runtime fallback
 * after the `VITE_HYPERSCAPE_GAME_PLUGIN` build-time env var.
 *
 * Today's choices: "hyperscape" (default) and "shooter-demo"
 * (acceptance-test alternate game). Adding a new game plugin set
 * is a three-step change:
 *   1. Add the id to `GamePluginSetId` in
 *      `packages/client/src/startup/plugins.ts` +
 *      `packages/server/src/startup/plugins.ts`.
 *   2. Add a case to `getClientPluginModules` / `getServerPluginModules`
 *      building the plugin set for the new game.
 *   3. Add an entry to `OPTIONS` below.
 *
 * Switching the selector does NOT hot-reload a running PIE session
 * — the user must Stop and re-Play for the new plugin set to boot.
 * That's documented via the title attribute.
 */

import { Gamepad2 } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

import {
  GAME_PLUGIN_LOCAL_STORAGE_KEY,
  isKnownGamePluginSetId,
  resolveGamePluginSetId,
  type GamePluginSetId,
} from "./gamePluginResolver";

type GameId = GamePluginSetId;

const OPTIONS: ReadonlyArray<{ id: GameId; label: string }> = [
  { id: "hyperscape", label: "Hyperscape" },
  { id: "shooter-demo", label: "Shooter Demo" },
];

function writeStoredGame(id: GameId): void {
  try {
    window.localStorage.setItem(GAME_PLUGIN_LOCAL_STORAGE_KEY, id);
  } catch {
    // Silent fail — the dropdown still shows the choice even if
    // we can't persist it.
  }
}

export function GameSelector(): React.ReactElement {
  const [gameId, setGameId] = useState<GameId>("hyperscape");

  // Read the persisted value once on mount. Done in an effect (not
  // useState initializer) because `window` may not be available
  // during SSR / test-environment imports.
  useEffect(() => {
    setGameId(resolveGamePluginSetId());
  }, []);

  const onChange = useCallback((evt: React.ChangeEvent<HTMLSelectElement>) => {
    const raw = evt.target.value;
    if (!isKnownGamePluginSetId(raw)) return;
    setGameId(raw);
    writeStoredGame(raw);
  }, []);

  return (
    <label
      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-surface-raised/40 border border-border-subtle hover:bg-surface-raised/70 transition-all cursor-pointer ease-out"
      title="Game plugin set the next Play-In-Editor session will boot into. Stop + Play again to apply a change."
    >
      <Gamepad2 size={12} className="text-text-secondary" />
      <span className="sr-only">Game</span>
      <select
        className="bg-transparent text-xs text-text-primary outline-none cursor-pointer"
        value={gameId}
        onChange={onChange}
      >
        {OPTIONS.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
