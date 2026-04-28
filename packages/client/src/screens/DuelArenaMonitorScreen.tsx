/**
 * DuelArenaMonitorScreen - Live duel arena monitoring and sparbot management
 *
 * Access: ?page=duel-monitor (requires admin code)
 */

import { GAME_API_URL } from "@/lib/api-config";
import React, { useEffect, useState, useCallback, useRef } from "react";
import type {
  StreamingState,
  AgentInfo,
  LeaderboardEntry,
} from "./StreamingMode";

// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN_CODE_KEY = "hyperscape_admin_code";
const STREAM_POLL_MS = 2000;
const SPARBOTS_POLL_MS = 8000;
const DUELS_POLL_MS = 10000;

type CombatStyle = "melee" | "ranged" | "mage" | "prayer";
type SparbotTier = "novice" | "adept" | "expert";

interface StandaloneBot {
  characterId: string;
  name: string;
  style: string;
  tier: string;
}

interface RecentDuel {
  cycleId: string;
  duelId: string | null;
  finishedAt: number;
  winnerId: string;
  winnerName: string;
  loserId: string;
  loserName: string;
  winReason: string;
  damageWinner: number;
  damageLoser: number;
}

interface DuelStatus {
  currentCycle: {
    phase: string;
    contestants: Array<{
      characterId: string;
      name: string;
      combatLevel: number;
      currentHp: number;
      maxHp: number;
    }>;
    startedAt: number;
    phaseStartedAt: number;
    winner: { characterId: string; name: string } | null;
    winReason: string | null;
  } | null;
  leaderboard: LeaderboardEntry[];
  recentDuels: RecentDuel[];
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const styleColor = (s: string): string =>
  ({ melee: "#e06c6c", ranged: "#6cce6c", mage: "#6caae0", prayer: "#d4a84b" })[
    s
  ] ?? "#94a3b8";

const tierColor = (t: string): string =>
  ({ novice: "#64748b", adept: "#6caae0", expert: "#f2d08a" })[t] ?? "#94a3b8";

const phaseColor = (p: string): string =>
  ({
    FIGHTING: "#e06c6c",
    COUNTDOWN: "#f2d08a",
    ANNOUNCEMENT: "#6caae0",
    RESOLUTION: "#9b86d4",
    IDLE: "#334155",
  })[p] ?? "#94a3b8";

const WIN_REASON_LABELS: Record<string, string> = {
  kill: "Knockout",
  hp_advantage: "HP Advantage",
  damage_advantage: "Damage Advantage",
  draw: "Draw",
};

function fmtAge(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function winRate(wins: number, losses: number): string {
  const t = wins + losses;
  return t === 0 ? "—" : `${Math.round((wins / t) * 100)}%`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  const color = pct > 50 ? "#4ade80" : pct > 25 ? "#facc15" : "#f87171";
  return (
    <div
      style={{
        width: "100%",
        height: 7,
        background: "#0f172a",
        borderRadius: 3,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: color,
          borderRadius: 3,
          transition: "width 0.4s ease",
        }}
      />
    </div>
  );
}

function PhaseBar({
  phase,
  phaseStartTime,
  phaseEndTime,
}: {
  phase: string;
  phaseStartTime: number;
  phaseEndTime: number;
}) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const total = phaseEndTime - phaseStartTime;
      if (total <= 0) {
        setPct(100);
        return;
      }
      setPct(
        Math.max(0, Math.min(100, ((now - phaseStartTime) / total) * 100)),
      );
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [phaseStartTime, phaseEndTime]);

  return (
    <div
      style={{
        width: "100%",
        height: 4,
        background: "#0f172a",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: phaseColor(phase),
          transition: "width 0.5s linear",
        }}
      />
    </div>
  );
}

function FighterCard({
  agent,
  isWinner,
  isLoser,
}: {
  agent: AgentInfo;
  isWinner?: boolean;
  isLoser?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        background: "#0a0f16",
        border: `1px solid ${isWinner ? "#f2d08a55" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 6,
        padding: "10px 12px",
        opacity: isLoser ? 0.55 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 4,
        }}
      >
        <div
          style={{
            fontFamily: "Impact, sans-serif",
            fontSize: "0.9rem",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: isWinner ? "#f2d08a" : "#e2e8f0",
          }}
        >
          {isWinner && "♛ "}
          {agent.name}
        </div>
        <div
          style={{
            fontSize: "0.85rem",
            fontWeight: 700,
            color: "#e2e8f0",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {agent.hp}
          <span style={{ fontSize: "0.6rem", color: "#475569" }}>
            /{agent.maxHp}
          </span>
        </div>
      </div>
      <HpBar hp={agent.hp} maxHp={agent.maxHp} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "3px 8px",
          marginTop: 7,
        }}
      >
        {(
          [
            ["DMG", agent.damageDealtThisFight],
            ["BEST", agent.highestHit],
            ["HITS", agent.attacksLanded],
            ["HEALS", agent.healsUsed],
          ] as [string, number][]
        ).map(([l, v]) => (
          <div
            key={l}
            style={{ display: "flex", justifyContent: "space-between" }}
          >
            <span
              style={{
                fontSize: "0.58rem",
                color: "#475569",
                letterSpacing: "0.06em",
              }}
            >
              {l}
            </span>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 600,
                color: "#94a3b8",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {v}
            </span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 5, fontSize: "0.58rem", color: "#334155" }}>
        Lv{agent.combatLevel} · {agent.wins}W {agent.losses}L
      </div>
    </div>
  );
}

function RecentDuelRow({ d }: { d: RecentDuel }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 0",
        borderBottom: "1px solid rgba(255,255,255,0.03)",
        fontSize: "0.7rem",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: "#4ade80", fontWeight: 600 }}>
          {d.winnerName}
        </span>
        <span style={{ color: "#475569" }}> def. </span>
        <span style={{ color: "#94a3b8" }}>{d.loserName}</span>
      </div>
      <div
        style={{ whiteSpace: "nowrap", color: "#64748b", fontSize: "0.62rem" }}
      >
        {WIN_REASON_LABELS[d.winReason] ?? d.winReason}
      </div>
      <div
        style={{
          whiteSpace: "nowrap",
          color: "#334155",
          fontSize: "0.58rem",
          minWidth: 44,
          textAlign: "right",
        }}
      >
        {fmtAge(d.finishedAt)}
      </div>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function DuelArenaMonitorScreen() {
  // Auth
  const [adminCode, setAdminCode] = useState(
    localStorage.getItem(ADMIN_CODE_KEY) ?? "",
  );
  const adminCodeRef = useRef(adminCode);
  adminCodeRef.current = adminCode;
  const [isAuthed, setIsAuthed] = useState(false);
  const [checkingStored, setCheckingStored] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Streaming state (public)
  const [streamState, setStreamState] = useState<StreamingState | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [lastStreamAt, setLastStreamAt] = useState(0);

  // Duel status (admin)
  const [duelStatus, setDuelStatus] = useState<DuelStatus | null>(null);

  // Sparbots
  const [sparbots, setSparbots] = useState<StandaloneBot[]>([]);
  const [spawnStyle, setSpawnStyle] = useState<CombatStyle>("melee");
  const [spawnTier, setSpawnTier] = useState<SparbotTier>("adept");
  const [spawnCount, setSpawnCount] = useState(2);
  const [spawnLoading, setSpawnLoading] = useState(false);
  const [spawnError, setSpawnError] = useState<string | null>(null);
  const [spawnSuccess, setSpawnSuccess] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [fillLoading, setFillLoading] = useState(false);

  // Admin fetch
  const adminFetch = useCallback(
    async (path: string, options?: RequestInit): Promise<unknown> => {
      const res = await fetch(`${GAME_API_URL}${path}`, {
        ...options,
        headers: {
          "x-admin-code": adminCodeRef.current,
          "Content-Type": "application/json",
          ...((options?.headers as Record<string, string>) || {}),
        },
      });
      if (res.status === 403) throw new Error("Unauthorized");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    [],
  );

  const tryAuth = useCallback(
    async (code: string): Promise<boolean> => {
      adminCodeRef.current = code;
      try {
        await adminFetch("/admin/stats");
        return true;
      } catch {
        return false;
      }
    },
    [adminFetch],
  );

  // Check stored code on mount
  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_CODE_KEY);
    if (!stored) {
      setCheckingStored(false);
      return;
    }
    let cancelled = false;
    tryAuth(stored).then((ok) => {
      if (cancelled) return;
      if (ok) {
        setIsAuthed(true);
        setAdminCode(stored);
      } else localStorage.removeItem(ADMIN_CODE_KEY);
      setCheckingStored(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tryAuth]);

  const handleLogin = useCallback(async () => {
    const code = adminCodeRef.current;
    if (!code) return;
    setAuthLoading(true);
    setAuthError(null);
    const ok = await tryAuth(code);
    if (ok) {
      setIsAuthed(true);
      localStorage.setItem(ADMIN_CODE_KEY, code);
    } else setAuthError("Invalid code or server unreachable");
    setAuthLoading(false);
  }, [tryAuth]);

  // Poll streaming state (no auth)
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      if (!mounted) return;
      try {
        const res = await fetch(`${GAME_API_URL}/api/streaming/state`);
        if (!res.ok) {
          setStreamError(`HTTP ${res.status}`);
          return;
        }
        const data = (await res.json()) as StreamingState | null;
        if (!mounted) return;
        if (data?.type === "STREAMING_STATE_UPDATE") {
          setStreamState(data);
          setStreamError(null);
          setLastStreamAt(Date.now());
        }
      } catch (e) {
        if (mounted)
          setStreamError(e instanceof Error ? e.message : "unreachable");
      }
    };
    poll();
    const id = setInterval(poll, STREAM_POLL_MS);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  // Poll duel status + sparbots (admin)
  const fetchDuelStatus = useCallback(async () => {
    try {
      const data = (await adminFetch("/admin/duels/status")) as DuelStatus;
      setDuelStatus(data);
    } catch {
      /* silent */
    }
  }, [adminFetch]);

  const fetchSparbots = useCallback(async () => {
    try {
      const data = (await adminFetch("/admin/sparbots")) as {
        sparbots: StandaloneBot[];
      };
      setSparbots(data.sparbots ?? []);
    } catch {
      /* silent */
    }
  }, [adminFetch]);

  useEffect(() => {
    if (!isAuthed) return;
    fetchDuelStatus();
    fetchSparbots();
    const d = setInterval(fetchDuelStatus, DUELS_POLL_MS);
    const s = setInterval(fetchSparbots, SPARBOTS_POLL_MS);
    return () => {
      clearInterval(d);
      clearInterval(s);
    };
  }, [isAuthed, fetchDuelStatus, fetchSparbots]);

  // Spawn
  const handleSpawn = useCallback(
    async (style: CombatStyle, tier: SparbotTier, count: number) => {
      setSpawnLoading(true);
      setSpawnError(null);
      setSpawnSuccess(null);
      try {
        const data = (await adminFetch("/admin/sparbots", {
          method: "POST",
          body: JSON.stringify({ style, tier, count }),
        })) as { spawned: Array<{ name: string }> };
        setSpawnSuccess(
          `✓ Spawned ${data.spawned.length} ${tier} ${style} bot${data.spawned.length !== 1 ? "s" : ""}`,
        );
        await fetchSparbots();
      } catch (e) {
        setSpawnError(e instanceof Error ? e.message : "Spawn failed");
      }
      setSpawnLoading(false);
    },
    [adminFetch, fetchSparbots],
  );

  // Fill pool: 2 of each style at chosen tier
  const handleFillPool = useCallback(async () => {
    setFillLoading(true);
    setSpawnError(null);
    setSpawnSuccess(null);
    const styles: CombatStyle[] = ["melee", "ranged", "mage", "prayer"];
    try {
      let total = 0;
      for (const s of styles) {
        const data = (await adminFetch("/admin/sparbots", {
          method: "POST",
          body: JSON.stringify({ style: s, tier: spawnTier, count: 2 }),
        })) as { spawned: Array<unknown> };
        total += data.spawned.length;
      }
      setSpawnSuccess(
        `✓ Filled pool with ${total} bots (2× each style, ${spawnTier})`,
      );
      await fetchSparbots();
    } catch (e) {
      setSpawnError(e instanceof Error ? e.message : "Fill failed");
    }
    setFillLoading(false);
  }, [adminFetch, fetchSparbots, spawnTier]);

  // Remove one
  const handleRemove = useCallback(
    async (id: string) => {
      setRemovingId(id);
      try {
        await adminFetch(`/admin/sparbots/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        await fetchSparbots();
      } catch (e) {
        console.warn("Remove sparbot failed:", e);
      }
      setRemovingId(null);
    },
    [adminFetch, fetchSparbots],
  );

  // Remove all
  const handleRemoveAll = useCallback(async () => {
    if (
      sparbots.length === 0 ||
      !window.confirm(`Remove all ${sparbots.length} sparbot(s)?`)
    )
      return;
    try {
      await adminFetch("/admin/sparbots", { method: "DELETE" });
      await fetchSparbots();
    } catch (e) {
      console.warn("Remove all failed:", e);
    }
  }, [adminFetch, sparbots.length, fetchSparbots]);

  // ─── Auth Gate ────────────────────────────────────────────────────────────

  if (!isAuthed && checkingStored)
    return <AuthGate loading title="Duel Arena Monitor" />;

  if (!isAuthed) {
    return (
      <AuthGate
        title="Duel Arena Monitor"
        adminCode={adminCode}
        onChange={setAdminCode}
        onLogin={handleLogin}
        loading={authLoading}
        error={authError}
      />
    );
  }

  // ─── Data ─────────────────────────────────────────────────────────────────

  const cycle = streamState?.cycle;
  const phase = cycle?.phase ?? "IDLE";
  const agent1 = cycle?.agent1 ?? null;
  const agent2 = cycle?.agent2 ?? null;
  const leaderboard = streamState?.leaderboard ?? [];
  const winnerId = cycle?.winnerId ?? null;
  const recentDuels = duelStatus?.recentDuels ?? [];
  const secSinceStream =
    lastStreamAt > 0 ? Math.floor((Date.now() - lastStreamAt) / 1000) : null;
  const streamOk = secSinceStream !== null && secSinceStream < 10;

  // Pool count (unique agent IDs in leaderboard as proxy)
  const poolCount = leaderboard.length;

  return (
    <div style={s.root}>
      {/* ── Top bar ── */}
      <div style={s.topbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={s.topbarTitle}>Duel Arena Monitor</span>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 3,
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              background: phaseColor(phase) + "22",
              border: `1px solid ${phaseColor(phase)}55`,
              color: phaseColor(phase),
            }}
          >
            {phase}
          </span>
          {cycle && (
            <span style={{ fontSize: "0.7rem", color: "#475569" }}>
              {Math.max(
                0,
                Math.ceil(cycle.phaseEndTime / 1000 - Date.now() / 1000),
              )}
              s
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {streamError && (
            <span style={{ fontSize: "0.65rem", color: "#f87171" }}>
              ⚠ {streamError}
            </span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: streamOk ? "#4ade80" : "#f87171",
              }}
            />
            <span style={{ fontSize: "0.65rem", color: "#475569" }}>
              {streamOk
                ? `live`
                : secSinceStream !== null
                  ? `${secSinceStream}s stale`
                  : "connecting…"}
            </span>
          </div>
          <span style={{ fontSize: "0.65rem", color: "#334155" }}>
            Pool: {poolCount}
          </span>
        </div>
      </div>

      {/* Phase progress bar */}
      {cycle && cycle.phaseEndTime > 0 && (
        <PhaseBar
          phase={phase}
          phaseStartTime={cycle.phaseStartTime}
          phaseEndTime={cycle.phaseEndTime}
        />
      )}

      {/* ── Body ── */}
      <div style={s.body}>
        {/* Left: Fight + Recent ─────────────────────────────────── */}
        <div style={s.colLeft}>
          {/* Live fight */}
          <div style={s.card}>
            <div style={s.cardHead}>Live Fight</div>
            {agent1 && agent2 ? (
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                  <FighterCard
                    agent={agent1}
                    isWinner={winnerId === agent1.id}
                    isLoser={winnerId !== null && winnerId !== agent1.id}
                  />
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      color: "#f2d08a",
                      fontFamily: "Impact, sans-serif",
                      fontSize: "1.1rem",
                      padding: "0 2px",
                    }}
                  >
                    VS
                  </div>
                  <FighterCard
                    agent={agent2}
                    isWinner={winnerId === agent2.id}
                    isLoser={winnerId !== null && winnerId !== agent2.id}
                  />
                </div>
                {cycle?.winReason && (
                  <div
                    style={{
                      textAlign: "center",
                      marginTop: 6,
                      fontSize: "0.62rem",
                      color: "#475569",
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.1em",
                    }}
                  >
                    {WIN_REASON_LABELS[cycle.winReason] ?? cycle.winReason}
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  color: "#334155",
                  textAlign: "center",
                  padding: "18px 0",
                  fontSize: "0.8rem",
                }}
              >
                No active fight
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <div style={s.card}>
            <div style={s.cardHead}>Leaderboard</div>
            {leaderboard.length > 0 ? (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse" as const,
                  fontSize: "0.7rem",
                }}
              >
                <thead>
                  <tr
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    {["#", "Name", "W", "L", "W%", "Str", "Lv"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "2px 5px",
                          textAlign:
                            h === "Name"
                              ? ("left" as const)
                              : ("right" as const),
                          color: "#334155",
                          fontWeight: 600,
                          letterSpacing: "0.06em",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((e) => (
                    <tr
                      key={e.characterId}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.025)",
                      }}
                    >
                      <td
                        style={{
                          padding: "3px 5px",
                          textAlign: "right" as const,
                          color: "#334155",
                        }}
                      >
                        {e.rank}
                      </td>
                      <td
                        style={{
                          padding: "3px 5px",
                          textAlign: "left" as const,
                          color: "#e2e8f0",
                          fontWeight: 500,
                          maxWidth: 120,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap" as const,
                        }}
                      >
                        {e.name}
                      </td>
                      <td
                        style={{
                          padding: "3px 5px",
                          textAlign: "right" as const,
                          color: "#4ade80",
                        }}
                      >
                        {e.wins}
                      </td>
                      <td
                        style={{
                          padding: "3px 5px",
                          textAlign: "right" as const,
                          color: "#f87171",
                        }}
                      >
                        {e.losses}
                      </td>
                      <td
                        style={{
                          padding: "3px 5px",
                          textAlign: "right" as const,
                          color: "#f2d08a",
                        }}
                      >
                        {winRate(e.wins, e.losses)}
                      </td>
                      <td
                        style={{
                          padding: "3px 5px",
                          textAlign: "right" as const,
                          color: e.currentStreak > 1 ? "#facc15" : "#334155",
                        }}
                      >
                        {e.currentStreak > 1
                          ? `🔥${e.currentStreak}`
                          : e.currentStreak}
                      </td>
                      <td
                        style={{
                          padding: "3px 5px",
                          textAlign: "right" as const,
                          color: "#475569",
                        }}
                      >
                        {e.combatLevel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div
                style={{
                  color: "#334155",
                  textAlign: "center",
                  padding: 10,
                  fontSize: "0.75rem",
                }}
              >
                No leaderboard data yet
              </div>
            )}
          </div>

          {/* Recent duels */}
          {recentDuels.length > 0 && (
            <div style={s.card}>
              <div style={s.cardHead}>Recent Fights</div>
              {recentDuels.slice(0, 15).map((d) => (
                <RecentDuelRow key={d.cycleId} d={d} />
              ))}
            </div>
          )}
        </div>

        {/* Right: Sparbot management ──────────────────────────── */}
        <div style={s.colRight}>
          {/* Spawn */}
          <div style={s.card}>
            <div style={s.cardHead}>Spawn Sparbots</div>

            {/* Style */}
            <div style={{ marginBottom: 10 }}>
              <div style={s.label}>Style</div>
              <div
                style={{
                  display: "flex",
                  gap: 5,
                  marginTop: 4,
                  flexWrap: "wrap" as const,
                }}
              >
                {(["melee", "ranged", "mage", "prayer"] as CombatStyle[]).map(
                  (st) => (
                    <button
                      key={st}
                      onClick={() => setSpawnStyle(st)}
                      style={{
                        padding: "3px 9px",
                        borderRadius: 3,
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        background:
                          spawnStyle === st
                            ? styleColor(st) + "28"
                            : "transparent",
                        border: `1px solid ${spawnStyle === st ? styleColor(st) : "rgba(255,255,255,0.09)"}`,
                        color: spawnStyle === st ? styleColor(st) : "#475569",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {st.charAt(0).toUpperCase() + st.slice(1)}
                    </button>
                  ),
                )}
              </div>
            </div>

            {/* Tier */}
            <div style={{ marginBottom: 10 }}>
              <div style={s.label}>Tier</div>
              <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
                {(["novice", "adept", "expert"] as SparbotTier[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSpawnTier(t)}
                    style={{
                      padding: "3px 9px",
                      borderRadius: 3,
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      background:
                        spawnTier === t ? tierColor(t) + "28" : "transparent",
                      border: `1px solid ${spawnTier === t ? tierColor(t) : "rgba(255,255,255,0.09)"}`,
                      color: spawnTier === t ? tierColor(t) : "#475569",
                    }}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Count */}
            <div style={{ marginBottom: 10 }}>
              <div style={s.label}>Count</div>
              <input
                type="number"
                min={1}
                max={20}
                value={spawnCount}
                onChange={(e) =>
                  setSpawnCount(
                    Math.min(
                      20,
                      Math.max(1, parseInt(e.target.value, 10) || 1),
                    ),
                  )
                }
                style={{
                  marginTop: 4,
                  width: 72,
                  padding: "4px 8px",
                  background: "#0a0f16",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 3,
                  color: "#e2e8f0",
                  fontSize: "0.78rem",
                  outline: "none",
                }}
              />
            </div>

            <button
              onClick={() => handleSpawn(spawnStyle, spawnTier, spawnCount)}
              disabled={spawnLoading}
              style={{
                ...s.btn,
                background: spawnLoading ? "#1e293b" : "#1d4ed8",
                cursor: spawnLoading
                  ? ("not-allowed" as const)
                  : ("pointer" as const),
                marginBottom: 6,
              }}
            >
              {spawnLoading ? "Spawning…" : `Spawn ${spawnCount} ${spawnStyle}`}
            </button>

            <button
              onClick={handleFillPool}
              disabled={fillLoading}
              style={{
                ...s.btn,
                background: fillLoading ? "#1e293b" : "#14532d",
                cursor: fillLoading
                  ? ("not-allowed" as const)
                  : ("pointer" as const),
                fontSize: "0.72rem",
              }}
            >
              {fillLoading ? "Filling…" : `Fill Pool (2× each, ${spawnTier})`}
            </button>

            {spawnSuccess && (
              <div
                style={{ marginTop: 6, fontSize: "0.68rem", color: "#4ade80" }}
              >
                {spawnSuccess}
              </div>
            )}
            {spawnError && (
              <div
                style={{ marginTop: 6, fontSize: "0.68rem", color: "#f87171" }}
              >
                {spawnError}
              </div>
            )}
          </div>

          {/* Style Guide */}
          <div style={s.card}>
            <div style={s.cardHead}>Style Reference</div>
            <div style={{ fontSize: "0.65rem", lineHeight: 1.8 }}>
              {(
                [
                  ["melee", "Swords/scimitars, Attack+Strength build"],
                  ["ranged", "Bows+arrows, Ranged level build"],
                  ["mage", "Staff+runes, Magic level build"],
                  ["prayer", "Melee + high Prayer level, uses prayers"],
                ] as [string, string][]
              ).map(([st, desc]) => (
                <div key={st}>
                  <span style={{ color: styleColor(st), fontWeight: 600 }}>
                    {st.charAt(0).toUpperCase() + st.slice(1)}
                  </span>
                  <span style={{ color: "#334155" }}> — {desc}</span>
                </div>
              ))}
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: "0.62rem",
                borderTop: "1px solid rgba(255,255,255,0.04)",
                paddingTop: 6,
              }}
            >
              {(
                [
                  ["novice", "~Lv 35 skills"],
                  ["adept", "~Lv 60 skills"],
                  ["expert", "~Lv 85 skills"],
                ] as [string, string][]
              ).map(([t, d]) => (
                <div key={t}>
                  <span style={{ color: tierColor(t), fontWeight: 600 }}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </span>{" "}
                  <span style={{ color: "#334155" }}>— {d}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Active Sparbots */}
          <div style={s.card}>
            <div
              style={{
                ...s.cardHead,
                display: "flex" as const,
                justifyContent: "space-between" as const,
                alignItems: "center" as const,
              }}
            >
              <span>Active Bots ({sparbots.length})</span>
              {sparbots.length > 0 && (
                <button
                  onClick={handleRemoveAll}
                  style={{ ...s.dangerBtn, fontSize: "0.6rem" }}
                >
                  Remove All
                </button>
              )}
            </div>
            {sparbots.length === 0 ? (
              <div
                style={{
                  color: "#334155",
                  textAlign: "center" as const,
                  padding: "10px 0",
                  fontSize: "0.75rem",
                }}
              >
                None active
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column" as const,
                  gap: 4,
                }}
              >
                {sparbots.map((bot) => (
                  <div key={bot.characterId} style={s.botRow}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          color: "#e2e8f0",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap" as const,
                        }}
                      >
                        {bot.name}
                      </div>
                      <div style={{ fontSize: "0.58rem", marginTop: 1 }}>
                        <span style={{ color: styleColor(bot.style) }}>
                          {bot.style}
                        </span>
                        <span style={{ color: "#334155" }}> · </span>
                        <span style={{ color: tierColor(bot.tier) }}>
                          {bot.tier}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(bot.characterId)}
                      disabled={removingId === bot.characterId}
                      style={{
                        ...s.dangerBtn,
                        opacity: removingId === bot.characterId ? 0.4 : 1,
                        cursor:
                          removingId === bot.characterId
                            ? ("not-allowed" as const)
                            : ("pointer" as const),
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Auth gate ────────────────────────────────────────────────────────────────

function AuthGate(props: {
  title: string;
  loading?: boolean;
  adminCode?: string;
  onChange?: (v: string) => void;
  onLogin?: () => void;
  error?: string | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#020608",
      }}
    >
      <div
        style={{
          background: "#0d1117",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 8,
          padding: "36px 32px",
          width: 310,
          textAlign: "center" as const,
        }}
      >
        <div
          style={{
            fontSize: "1.3rem",
            fontWeight: 700,
            color: "#f2d08a",
            marginBottom: 6,
          }}
        >
          {props.title}
        </div>
        {props.loading && !props.adminCode ? (
          <div style={{ color: "#475569", marginTop: 16, fontSize: "0.85rem" }}>
            Checking…
          </div>
        ) : (
          <>
            <div
              style={{ color: "#475569", marginBottom: 14, fontSize: "0.8rem" }}
            >
              Enter admin code
            </div>
            {props.error && (
              <div
                style={{
                  color: "#f87171",
                  fontSize: "0.72rem",
                  marginBottom: 8,
                }}
              >
                {props.error}
              </div>
            )}
            <input
              type="password"
              placeholder="Admin code"
              value={props.adminCode ?? ""}
              onChange={(e) => props.onChange?.(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && props.onLogin?.()}
              autoFocus
              disabled={props.loading}
              style={{
                width: "100%",
                padding: "7px 10px",
                background: "#1e293b",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 4,
                color: "#e2e8f0",
                fontSize: "0.82rem",
                outline: "none",
                boxSizing: "border-box" as const,
                marginBottom: 8,
              }}
            />
            <button
              onClick={props.onLogin}
              disabled={props.loading || !props.adminCode}
              style={{
                width: "100%",
                padding: "7px 0",
                background:
                  props.loading || !props.adminCode ? "#1e293b" : "#1d4ed8",
                border: "none",
                borderRadius: 4,
                color: "#e2e8f0",
                fontWeight: 600,
                fontSize: "0.82rem",
                cursor:
                  props.loading || !props.adminCode
                    ? ("not-allowed" as const)
                    : ("pointer" as const),
              }}
            >
              {props.loading ? "Checking…" : "Authenticate"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Style object ─────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "#020608",
    color: "#e2e8f0",
    fontFamily: "system-ui, -apple-system, sans-serif",
    overflow: "hidden",
  },
  topbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px",
    background: "#07090d",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    flexShrink: 0,
  },
  topbarTitle: {
    fontSize: "0.85rem",
    fontWeight: 700,
    color: "#f2d08a",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  body: { display: "flex", flex: 1, overflow: "hidden" },
  colLeft: {
    flex: 1,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    overflowY: "auto",
    borderRight: "1px solid rgba(255,255,255,0.04)",
  },
  colRight: {
    width: 290,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    overflowY: "auto",
  },
  card: {
    background: "#07090d",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 5,
    padding: "10px 12px",
  },
  cardHead: {
    fontSize: "0.58rem",
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#334155",
    marginBottom: 8,
    paddingBottom: 5,
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  label: {
    fontSize: "0.6rem",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#334155",
  },
  btn: {
    width: "100%",
    padding: "7px 0",
    border: "none",
    borderRadius: 4,
    color: "#e2e8f0",
    fontWeight: 600,
    fontSize: "0.78rem",
    letterSpacing: "0.03em",
  },
  dangerBtn: {
    padding: "2px 7px",
    background: "transparent",
    border: "1px solid #ef444433",
    borderRadius: 3,
    color: "#f87171",
    fontSize: "0.65rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  botRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "5px 7px",
    background: "rgba(255,255,255,0.02)",
    borderRadius: 3,
    border: "1px solid rgba(255,255,255,0.04)",
  },
};
