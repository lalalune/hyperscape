import { useState, ReactNode } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { OrderBook, type OrderLevel } from "./OrderBook";
import { RecentTrades, type Trade } from "./RecentTrades";

type BetSide = "YES" | "NO";

export interface ChartDataPoint {
  time: number;
  pct: number;
}

interface PredictionMarketPanelProps {
  yesPercent: number;
  noPercent: number;
  yesPool: string | number;
  noPool: string | number;
  side: BetSide;
  setSide: (side: BetSide) => void;
  amountInput: string;
  setAmountInput: (val: string) => void;
  onPlaceBet: () => void;
  isWalletReady: boolean;
  programsReady: boolean;
  agent1Name: string;
  agent2Name: string;
  isEvm: boolean;
  supportsSell?: boolean;
  chartData?: ChartDataPoint[];
  bids?: OrderLevel[];
  asks?: OrderLevel[];
  recentTrades?: Trade[];
  goldPriceUsd?: number | null;
  children?: ReactNode;
  pointsDisplay?: ReactNode;
  currencySymbol?: string;
  onViewAgent1?: () => void;
  onViewAgent2?: () => void;
}

export function PredictionMarketPanel({
  yesPercent,
  noPercent,
  yesPool,
  noPool,
  side,
  setSide,
  amountInput,
  setAmountInput,
  onPlaceBet,
  isWalletReady,
  programsReady,
  agent1Name,
  agent2Name,
  isEvm,
  supportsSell = false,
  chartData = [],
  bids = [],
  asks = [],
  recentTrades = [],
  goldPriceUsd = null,
  children,
  pointsDisplay,
  currencySymbol = "SOL",
  onViewAgent1,
  onViewAgent2,
}: PredictionMarketPanelProps) {
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");

  const yesSelected = side === "YES";
  const noSelected = side === "NO";
  const canBet = isWalletReady && programsReady;
  const sellSupported = isEvm || supportsSell;

  return (
    <>
      {/* 4 Column Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "210px 1fr minmax(180px, 220px) minmax(180px, 220px)",
          alignItems: "stretch",
          gap: 12,
        }}
      >
        {/* ========== COL 1: Betting Controls ========== */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Agent buttons side by side */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            {/* Agent 1 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button
                type="button"
                aria-pressed={yesSelected}
                onClick={() => setSide("YES")}
                className="gm-btn gm-btn-agent1"
                style={{
                  position: "relative",
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: yesSelected
                    ? "1px solid rgba(0,255,204,0.4)"
                    : "1px solid rgba(255,255,255,0.1)",
                  color: "#fff",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                  overflow: "hidden",
                  background: yesSelected
                    ? "linear-gradient(180deg, rgba(0,255,204,0.22) 0%, rgba(0,255,204,0.06) 100%)"
                    : "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)",
                  boxShadow: yesSelected
                    ? "0 4px 20px rgba(0,255,204,0.2), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 0 16px rgba(0,255,204,0.08)"
                    : "inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.2)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    fontFamily: "'Teko', sans-serif",
                    color: yesSelected ? "#00ffcc" : "rgba(255,255,255,0.5)",
                    textShadow: yesSelected
                      ? "0 0 10px rgba(0,255,204,0.6)"
                      : "none",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {agent1Name}
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: yesSelected ? "#fff" : "rgba(255,255,255,0.25)",
                    fontFamily: "'Teko', sans-serif",
                    lineHeight: 1,
                    marginTop: 1,
                    textShadow: yesSelected
                      ? "0 2px 8px rgba(0,0,0,0.5)"
                      : "none",
                  }}
                >
                  {yesPercent}%
                </div>
                {yesSelected && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 2,
                      background:
                        "linear-gradient(90deg, rgba(0,255,204,0.2), #00ffcc, rgba(0,255,204,0.2))",
                      boxShadow: "0 0 8px rgba(0,255,204,0.5)",
                    }}
                  />
                )}
              </button>
              <button
                onClick={onViewAgent1}
                className="gm-btn-sm gm-btn-sm-yes"
                style={{
                  padding: "5px 4px",
                  borderRadius: 8,
                  border: "1px solid rgba(0, 255, 204, 0.15)",
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  transition: "all 0.15s ease",
                  fontFamily: "'Teko', sans-serif",
                  background:
                    "linear-gradient(180deg, rgba(0,255,204,0.06) 0%, rgba(0,255,204,0.02) 100%)",
                  color: "#00ffcc",
                  boxShadow:
                    "inset 0 1px 0 rgba(0,255,204,0.06), 0 2px 4px rgba(0,0,0,0.15)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                }}
              >
                STATS
              </button>
            </div>

            {/* Agent 2 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button
                type="button"
                aria-pressed={noSelected}
                onClick={() => setSide("NO")}
                className="gm-btn gm-btn-agent2"
                style={{
                  position: "relative",
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: noSelected
                    ? "1px solid rgba(255,13,60,0.4)"
                    : "1px solid rgba(255,255,255,0.1)",
                  color: "#fff",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                  overflow: "hidden",
                  background: noSelected
                    ? "linear-gradient(180deg, rgba(255,13,60,0.22) 0%, rgba(255,13,60,0.06) 100%)"
                    : "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)",
                  boxShadow: noSelected
                    ? "0 4px 20px rgba(255,13,60,0.2), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 0 16px rgba(255,13,60,0.08)"
                    : "inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.2)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    fontFamily: "'Teko', sans-serif",
                    color: noSelected ? "#ff0d3c" : "rgba(255,255,255,0.5)",
                    textShadow: noSelected
                      ? "0 0 10px rgba(255,13,60,0.6)"
                      : "none",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {agent2Name}
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: noSelected ? "#fff" : "rgba(255,255,255,0.25)",
                    fontFamily: "'Teko', sans-serif",
                    lineHeight: 1,
                    marginTop: 1,
                    textShadow: noSelected
                      ? "0 2px 8px rgba(0,0,0,0.5)"
                      : "none",
                  }}
                >
                  {noPercent}%
                </div>
                {noSelected && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 2,
                      background:
                        "linear-gradient(90deg, rgba(255,13,60,0.2), #ff0d3c, rgba(255,13,60,0.2))",
                      boxShadow: "0 0 8px rgba(255,13,60,0.5)",
                    }}
                  />
                )}
              </button>
              <button
                onClick={onViewAgent2}
                className="gm-btn-sm gm-btn-sm-no"
                style={{
                  padding: "5px 4px",
                  borderRadius: 8,
                  border: "1px solid rgba(255, 13, 60, 0.15)",
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  transition: "all 0.15s ease",
                  fontFamily: "'Teko', sans-serif",
                  background:
                    "linear-gradient(180deg, rgba(255,13,60,0.06) 0%, rgba(255,13,60,0.02) 100%)",
                  color: "#ff0d3c",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,13,60,0.06), 0 2px 4px rgba(0,0,0,0.15)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                }}
              >
                STATS
              </button>
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              height: 1,
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
            }}
          />

          {pointsDisplay && (
            <div style={{ marginBottom: 4 }}>{pointsDisplay}</div>
          )}

          {/* Buy / Sell Toggle */}
          <div
            style={{
              display: "flex",
              gap: 4,
              background: "rgba(0,0,0,0.25)",
              borderRadius: 12,
              padding: 3,
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow:
                "inset 0 2px 6px rgba(0,0,0,0.3), inset 0 0 0 0.5px rgba(255,255,255,0.04)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <button
              onClick={() => setActiveTab("buy")}
              className="gm-tab-btn"
              style={{
                flex: 1,
                padding: "8px 4px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                fontWeight: 900,
                fontSize: 13,
                letterSpacing: 2,
                textTransform: "uppercase",
                transition: "all 0.15s ease",
                fontFamily: "'Teko', sans-serif",
                background:
                  activeTab === "buy"
                    ? "linear-gradient(180deg, #00ffcc 0%, #00d4aa 100%)"
                    : "transparent",
                color: activeTab === "buy" ? "#000" : "rgba(255,255,255,0.35)",
                boxShadow:
                  activeTab === "buy"
                    ? "0 2px 12px rgba(0,255,204,0.4), inset 0 1px 0 rgba(255,255,255,0.3)"
                    : "none",
              }}
            >
              BUY
            </button>
            <button
              onClick={() => sellSupported && setActiveTab("sell")}
              className="gm-tab-btn"
              disabled={!sellSupported}
              style={{
                flex: 1,
                padding: "8px 4px",
                borderRadius: 9,
                border: "none",
                cursor: sellSupported ? "pointer" : "not-allowed",
                fontWeight: 900,
                fontSize: 13,
                letterSpacing: 2,
                textTransform: "uppercase",
                transition: "all 0.15s ease",
                fontFamily: "'Teko', sans-serif",
                background:
                  activeTab === "sell"
                    ? "linear-gradient(180deg, #ff0d3c 0%, #cc0a30 100%)"
                    : "transparent",
                color: !sellSupported
                  ? "rgba(255,255,255,0.2)"
                  : activeTab === "sell"
                    ? "#fff"
                    : "rgba(255,255,255,0.35)",
                boxShadow:
                  activeTab === "sell"
                    ? "0 2px 12px rgba(255,13,60,0.4), inset 0 1px 0 rgba(255,255,255,0.2)"
                    : "none",
              }}
            >
              SELL
            </button>
          </div>

          {/* Amount + Submit */}
          {activeTab === "buy" ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                flex: 1,
              }}
            >
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  min="0"
                  step="0.000001"
                  inputMode="decimal"
                  aria-label="Bet amount in GOLD"
                  placeholder="0.00"
                  value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)}
                  className="gm-amount-input"
                  style={{
                    width: "100%",
                    padding: "9px 44px 9px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(242, 208, 138, 0.18)",
                    color: "#f2d08a",
                    boxSizing: "border-box",
                    fontSize: 15,
                    fontWeight: 900,
                    fontFamily: "'IBM Plex Mono', monospace",
                    letterSpacing: 1,
                    background: "rgba(0,0,0,0.3)",
                    boxShadow:
                      "inset 0 2px 8px rgba(0,0,0,0.4), inset 0 0 0 0.5px rgba(242,208,138,0.06), 0 1px 0 rgba(255,255,255,0.04)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 9,
                    fontWeight: 900,
                    color: "rgba(242, 208, 138, 0.45)",
                    fontFamily: "'Orbitron', sans-serif",
                    letterSpacing: 1.5,
                  }}
                >
                  {currencySymbol}
                </div>
              </div>
              <button
                disabled={!canBet}
                onClick={onPlaceBet}
                className="gm-btn-submit"
                style={{
                  width: "100%",
                  padding: "10px 6px",
                  borderRadius: 10,
                  border: canBet
                    ? "1px solid rgba(242,208,138,0.5)"
                    : "1px solid rgba(255,255,255,0.08)",
                  fontWeight: 900,
                  fontSize: 14,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  cursor: canBet ? "pointer" : "not-allowed",
                  transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                  fontFamily: "'Teko', sans-serif",
                  background: canBet
                    ? "linear-gradient(180deg, rgba(242,208,138,0.95) 0%, rgba(212,168,78,0.9) 50%, rgba(196,154,58,0.95) 100%)"
                    : "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
                  color: canBet ? "#0a0a0a" : "rgba(255,255,255,0.15)",
                  boxShadow: canBet
                    ? "0 4px 24px rgba(242,208,138,0.2), inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.1)"
                    : "inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.15)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {canBet && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "40%",
                      height: "100%",
                      background:
                        "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
                      animation: "shimmerSweep 2.5s ease-in-out infinite",
                      pointerEvents: "none",
                    }}
                  />
                )}
                <span style={{ position: "relative", zIndex: 1 }}>
                  {isWalletReady
                    ? `${activeTab.toUpperCase()} ${side}`
                    : "CONNECT WALLET"}
                </span>
              </button>
            </div>
          ) : (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                flex: 1,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.15)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.45)",
                  margin: 0,
                  lineHeight: 1.5,
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 500,
                }}
              >
                {sellSupported
                  ? "Submit sell-side orders with the controls below."
                  : isEvm
                    ? "EVM sell orders supported via the EVM panel."
                    : "Sell disabled until market resolution."}
              </p>
              {sellSupported ? (
                (children ?? (
                  <button
                    disabled
                    style={{
                      width: "100%",
                      marginTop: 8,
                      padding: "10px",
                      borderRadius: 8,
                      border: "none",
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: "not-allowed",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                      color: "rgba(255,255,255,0.2)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                    }}
                  >
                    NO SELL ACTION
                  </button>
                ))
              ) : (
                <button
                  disabled
                  style={{
                    width: "100%",
                    marginTop: 8,
                    padding: "10px",
                    borderRadius: 8,
                    border: "none",
                    fontWeight: 700,
                    fontSize: 11,
                    cursor: "not-allowed",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                    color: "rgba(255,255,255,0.2)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                  }}
                >
                  LOCKED
                </button>
              )}
            </div>
          )}
        </div>

        {/* ========== COL 2: Chart ========== */}
        <div
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            overflow: "hidden",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 20px rgba(0,0,0,0.15)",
          }}
        >
          {/* Glass highlight overlay */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "40%",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)",
              pointerEvents: "none",
              zIndex: 0,
              borderRadius: "12px 12px 0 0",
            }}
          />
          {/* Subtle Scanline Overlay */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.04) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.015), rgba(0, 255, 0, 0.005), rgba(0, 0, 255, 0.015))",
              backgroundSize: "100% 2px, 3px 100%",
              pointerEvents: "none",
              zIndex: 10,
            }}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 6,
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              paddingBottom: 4,
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.4)",
                fontFamily: "'Teko', sans-serif",
              }}
            >
              PREDICTION MARKET
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 8,
                    fontWeight: 900,
                    color: "#00ffcc",
                    letterSpacing: 1,
                    textShadow: "0 0 8px rgba(0,255,204,0.6)",
                  }}
                >
                  {agent1Name.toUpperCase()}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 900,
                    color: "#fff",
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                >
                  {yesPercent}%
                </div>
              </div>
              <div
                style={{
                  width: 1,
                  height: 16,
                  background: "rgba(255,255,255,0.1)",
                }}
              />
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 8,
                    fontWeight: 900,
                    color: "#ff0d3c",
                    letterSpacing: 1,
                    textShadow: "0 0 8px rgba(255,13,60,0.6)",
                  }}
                >
                  {agent2Name.toUpperCase()}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 900,
                    color: "#fff",
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                >
                  {noPercent}%
                </div>
              </div>
            </div>
          </div>
          {/* Probability tug-of-war bar */}
          <div
            style={{
              height: 3,
              borderRadius: 2,
              display: "flex",
              overflow: "hidden",
              marginBottom: 6,
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div
              style={{
                width: `${yesPercent}%`,
                height: "100%",
                background:
                  "linear-gradient(90deg, #00ffcc, rgba(0,255,204,0.6))",
                boxShadow: "0 0 8px rgba(0,255,204,0.4)",
                transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                borderRadius: "2px 0 0 2px",
              }}
            />
            <div
              style={{
                width: `${noPercent}%`,
                height: "100%",
                background:
                  "linear-gradient(90deg, rgba(255,13,60,0.6), #ff0d3c)",
                boxShadow: "0 0 8px rgba(255,13,60,0.4)",
                transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                borderRadius: "0 2px 2px 0",
              }}
            />
          </div>
          <div
            style={{ flex: 1, minHeight: 0, position: "relative", zIndex: 1 }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <defs>
                  <filter
                    id="glow"
                    x="-20%"
                    y="-20%"
                    width="140%"
                    height="140%"
                  >
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite
                      in="SourceGraphic"
                      in2="blur"
                      operator="over"
                    />
                  </filter>
                </defs>
                <XAxis dataKey="time" hide />
                <YAxis domain={[0, 100]} hide />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div
                          style={{
                            background: "rgba(10,12,18,0.7)",
                            backdropFilter: "blur(20px)",
                            WebkitBackdropFilter: "blur(20px)",
                            padding: "6px 12px",
                            borderRadius: 8,
                            border: "1px solid rgba(242,208,138,0.3)",
                            fontSize: 13,
                            fontFamily: "monospace",
                            fontWeight: 900,
                            color: "#fff",
                            boxShadow:
                              "0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
                          }}
                        >
                          <span style={{ color: "#f2d08a" }}>
                            {payload[0].value}%
                          </span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine
                  y={50}
                  stroke="rgba(255,255,255,0.1)"
                  strokeDasharray="4 4"
                />
                <Line
                  type="monotone"
                  dataKey="pct"
                  stroke="#00ffcc"
                  strokeWidth={3}
                  dot={false}
                  isAnimationActive={true}
                  filter="url(#glow)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ========== COL 3: Order Book ========== */}
        <div
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            padding: "6px 10px 8px",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 20px rgba(0,0,0,0.15)",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            fontFamily: "'Inter', system-ui, sans-serif",
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          <OrderBook
            yesPot={Number(yesPool)}
            noPot={Number(noPool)}
            totalPot={Number(yesPool) + Number(noPool)}
            goldPriceUsd={goldPriceUsd}
            bids={bids}
            asks={asks}
            midPrice={yesPercent / 100}
          />
        </div>

        {/* ========== COL 4: Recent Trades ========== */}
        <div
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            padding: "6px 10px 8px",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 20px rgba(0,0,0,0.15)",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            fontFamily: "'Inter', system-ui, sans-serif",
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          <RecentTrades
            yesPot={Number(yesPool)}
            noPot={Number(noPool)}
            totalPot={Number(yesPool) + Number(noPool)}
            goldPriceUsd={goldPriceUsd}
            trades={recentTrades}
          />
        </div>
      </div>

      <style>{`
        @keyframes statusPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
        .gm-btn {
          transform: translateY(0);
        }
        .gm-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.15);
        }
        .gm-btn:active {
          transform: translateY(1px);
          filter: brightness(0.95);
        }
        .gm-btn-agent1:hover {
          box-shadow: 0 6px 28px rgba(0,255,204,0.25), inset 0 1px 0 rgba(255,255,255,0.15), 0 1px 0 rgba(0,0,0,0.6) !important;
          border-color: rgba(0,255,204,0.5) !important;
        }
        .gm-btn-agent2:hover {
          box-shadow: 0 6px 28px rgba(255,13,60,0.25), inset 0 1px 0 rgba(255,255,255,0.15), 0 1px 0 rgba(0,0,0,0.6) !important;
          border-color: rgba(255,13,60,0.5) !important;
        }
        .gm-btn-sm {
          transform: translateY(0);
        }
        .gm-btn-sm:hover {
          transform: translateY(-1px);
          filter: brightness(1.3);
        }
        .gm-btn-sm:active {
          transform: translateY(1px);
        }
        .gm-btn-sm-yes:hover {
          box-shadow: 0 4px 16px rgba(0,255,204,0.2), inset 0 1px 0 rgba(0,255,204,0.15) !important;
          border-color: rgba(0,255,204,0.5) !important;
        }
        .gm-btn-sm-no:hover {
          box-shadow: 0 4px 16px rgba(255,13,60,0.2), inset 0 1px 0 rgba(255,13,60,0.15) !important;
          border-color: rgba(255,13,60,0.5) !important;
        }
        .gm-tab-btn:hover {
          filter: brightness(1.1);
        }
        .gm-amount-input:focus {
          border-color: rgba(242,208,138,0.5) !important;
          box-shadow: inset 0 2px 8px rgba(0,0,0,0.8), 0 0 12px rgba(242,208,138,0.15) !important;
          outline: none;
        }
        .gm-btn-submit {
          transform: translateY(0);
        }
        .gm-btn-submit:not(:disabled):hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(242,208,138,0.35), inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -2px 0 rgba(0,0,0,0.2), 0 2px 0 rgba(0,0,0,0.4) !important;
          filter: brightness(1.08);
        }
        .gm-btn-submit:not(:disabled):active {
          transform: translateY(1px);
          box-shadow: 0 2px 8px rgba(242,208,138,0.2), inset 0 2px 4px rgba(0,0,0,0.3), 0 1px 0 rgba(0,0,0,0.4) !important;
          filter: brightness(0.95);
        }
      `}</style>
    </>
  );
}
