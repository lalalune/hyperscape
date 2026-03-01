import { useEffect, useRef, useState } from "react";
import { CONFIG } from "../lib/config";

export type DuelInventoryItem = {
  slot: number;
  itemId: string;
  quantity: number;
};

export type DuelMonologue = {
  id: string;
  type: string;
  content: string;
  timestamp: number;
};

export type DuelAgentContext = {
  id: string;
  name: string;
  provider: string;
  model: string;
  hp: number;
  maxHp: number;
  combatLevel: number;
  wins: number;
  losses: number;
  damageDealtThisFight: number;
  inventory: DuelInventoryItem[];
  monologues: DuelMonologue[];
};

export type DuelContextState = {
  type: string;
  cycle: {
    agent1: DuelAgentContext | null;
    agent2: DuelAgentContext | null;
    cycleId?: string;
    phase?: string;
    winnerId?: string | null;
    winnerName?: string | null;
    winReason?: string | null;
  };
  leaderboard: unknown[];
  cameraTarget: string | null;
};

const POLL_INTERVAL_MS = 3000;
const API_URL = CONFIG.gameApiUrl.replace(/\/$/, "");
const DUEL_CONTEXT_URL = `${API_URL}/api/streaming/duel-context`;

function normalizeDuelAgent(raw: unknown): DuelAgentContext | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  return {
    id: typeof a.id === "string" ? a.id : "unknown",
    name: typeof a.name === "string" ? a.name : "Agent",
    provider: typeof a.provider === "string" ? a.provider : "AI",
    model: typeof a.model === "string" ? a.model : "v1",
    hp: typeof a.hp === "number" ? a.hp : 100,
    maxHp: typeof a.maxHp === "number" ? a.maxHp : 100,
    combatLevel: typeof a.combatLevel === "number" ? a.combatLevel : 1,
    wins: typeof a.wins === "number" ? a.wins : 0,
    losses: typeof a.losses === "number" ? a.losses : 0,
    damageDealtThisFight:
      typeof a.damageDealtThisFight === "number" ? a.damageDealtThisFight : 0,
    inventory: Array.isArray(a.inventory)
      ? (a.inventory as DuelInventoryItem[])
      : [],
    monologues: Array.isArray(a.monologues)
      ? (a.monologues as DuelMonologue[])
      : [],
  };
}

function normalizeDuelContext(raw: unknown): DuelContextState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!r.cycle || typeof r.cycle !== "object") return null;
  const cycle = r.cycle as Record<string, unknown>;
  return {
    type: typeof r.type === "string" ? r.type : "STREAMING_DUEL_CONTEXT",
    cycle: {
      agent1: normalizeDuelAgent(cycle.agent1),
      agent2: normalizeDuelAgent(cycle.agent2),
      cycleId: typeof cycle.cycleId === "string" ? cycle.cycleId : undefined,
      phase: typeof cycle.phase === "string" ? cycle.phase : undefined,
      winnerId:
        typeof cycle.winnerId === "string" || cycle.winnerId === null
          ? (cycle.winnerId as string | null)
          : null,
      winnerName:
        typeof cycle.winnerName === "string" || cycle.winnerName === null
          ? (cycle.winnerName as string | null)
          : null,
      winReason:
        typeof cycle.winReason === "string" || cycle.winReason === null
          ? (cycle.winReason as string | null)
          : null,
    },
    leaderboard: Array.isArray(r.leaderboard) ? r.leaderboard : [],
    cameraTarget:
      typeof r.cameraTarget === "string" || r.cameraTarget === null
        ? (r.cameraTarget as string | null)
        : null,
  };
}

export function useDuelContext(options: { disabled?: boolean } = {}) {
  const { disabled = false } = options;
  const [context, setContext] = useState<DuelContextState | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (disabled) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      abortRef.current?.abort();
      return;
    }

    const doFetch = async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(DUEL_CONTEXT_URL, {
          cache: "no-store",
          signal: ac.signal,
        });
        if (res.ok) {
          const data = normalizeDuelContext(await res.json());
          if (data) setContext(data);
        }
      } catch {
        // unavailable — streaming mode not active, silently ignore
      }
    };

    void doFetch();
    timerRef.current = setInterval(() => void doFetch(), POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      abortRef.current?.abort();
    };
  }, [disabled]);

  return { context };
}
