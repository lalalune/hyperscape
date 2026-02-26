import React, { useEffect, useState } from "react";

export interface Trade {
  id: string; // unique
  side: "YES" | "NO";
  amount: number;
  price?: number;
  time: number; // timestamp
  trader?: string;
}

interface RecentTradesProps {
  yesPot: number;
  noPot: number;
  totalPot: number;
  goldPriceUsd: number | null;
  trades: Trade[]; // Real trades
}

function formatAmount(v: number): string {
  if (v > 0 && v < 0.000001) return "<0.000001";
  if (v > 0 && v < 1) {
    return v.toFixed(6).replace(/\.?0+$/, "");
  }
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return "0";
}

function formatTimeAgo(ts: number): string {
  const ago = Math.floor((Date.now() - ts) / 1000);
  if (ago < 0) return "just now";
  const mins = Math.floor(ago / 60);
  const secs = ago % 60;
  if (mins > 0) return `${mins}m ${secs}s ago`;
  return `${secs}s ago`;
}

export function RecentTrades({
  yesPot,
  noPot,
  totalPot,
  goldPriceUsd,
  trades,
}: RecentTradesProps) {
  // We'll use a tick to keep "time ago" fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <style>{`
        @keyframes flashNewTrade {
          0% { background: rgba(255,255,255,0.25); }
          100% { background: transparent; }
        }
        .trade-row-new {
          animation: flashNewTrade 1s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          paddingBottom: 4,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 2,
            color: "rgba(255,255,255,0.4)",
            fontFamily: "'Teko', sans-serif",
          }}
        >
          RECENT TRADES
        </div>
        {goldPriceUsd !== null && (
          <div
            style={{
              fontSize: 10,
              color: "rgba(242,208,138,0.5)",
              fontWeight: 700,
            }}
          >
            GOLD ${goldPriceUsd.toFixed(4)}
          </div>
        )}
      </div>

      {/* Header */}
      <div
        style={{
          display: "flex",
          fontSize: 9,
          fontWeight: 900,
          color: "rgba(255,255,255,0.35)",
          padding: "2px 4px",
          textTransform: "uppercase",
          letterSpacing: 1.5,
          fontFamily: "'Teko', sans-serif",
        }}
      >
        <div style={{ flex: 1 }}>Side</div>
        <div style={{ flex: 1, textAlign: "right" }}>Amount</div>
        <div style={{ flex: 1, textAlign: "right" }}>Time</div>
      </div>

      {/* Trade List — 7 visible rows, scrollable overflow */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
          height: 164,
          maxHeight: 164,
          overflowY: "auto",
        }}
      >
        {trades.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "16px 0",
              color: "rgba(255,255,255,0.2)",
              fontSize: 12,
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            No trades yet
          </div>
        ) : (
          trades.map((trade, i) => {
            // Assume trade is "new" if under 2 seconds old
            const isNew = Date.now() - trade.time < 2000;
            return (
              <div
                key={trade.id}
                className={isNew ? "trade-row-new" : ""}
                style={{
                  display: "flex",
                  fontSize: 11,
                  padding: "3px 6px",
                  borderRadius: 4,
                  borderBottom:
                    i < trades.length - 1
                      ? "1px solid rgba(255,255,255,0.03)"
                      : "none",
                  transition: "background 0.3s",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    color: trade.side === "YES" ? "#00ffcc" : "#ff0d3c",
                    fontWeight: 900,
                    fontFamily: "'Teko', sans-serif",
                    letterSpacing: 1,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: trade.side === "YES" ? "#00ffcc" : "#ff0d3c",
                      boxShadow:
                        trade.side === "YES"
                          ? "0 0 6px rgba(0,255,204,0.5)"
                          : "0 0 6px rgba(255,13,60,0.5)",
                      flexShrink: 0,
                    }}
                  />
                  {trade.side}
                </div>
                <div
                  style={{
                    flex: 1,
                    textAlign: "right",
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  {formatAmount(trade.amount)}
                </div>
                <div
                  style={{
                    flex: 1,
                    textAlign: "right",
                    color: "rgba(255,255,255,0.35)",
                    fontSize: 11,
                  }}
                >
                  {formatTimeAgo(trade.time)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pool Summary */}
      {totalPot > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            paddingTop: 4,
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "rgba(255,255,255,0.45)",
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "#00ffcc",
                boxShadow: "0 0 4px rgba(0,255,204,0.4)",
              }}
            />
            YES Pool: {formatAmount(yesPot)}
          </span>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "rgba(255,255,255,0.45)",
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "#ff0d3c",
                boxShadow: "0 0 4px rgba(255,13,60,0.4)",
              }}
            />
            NO Pool: {formatAmount(noPot)}
          </span>
        </div>
      )}
    </>
  );
}
