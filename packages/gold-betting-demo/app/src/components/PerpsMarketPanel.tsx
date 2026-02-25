import React, { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import goldPerpsIdl from "../idl/gold_perps_market.json";
import { Toaster, toast } from "sonner"; // Assuming sonner is available or we can use generic toast styling

interface PerpsMarketPanelProps {
  agent1Name: string;
  agent2Name: string;
  agent1Id: number;
  agent2Id: number;
}

const PROGRAM_ID = new PublicKey(
  "3WKQf3J4B8QqRyWcBLR7xrb9VFPVjkZwzyZS67AahDbK",
);
const GOLD_MINT = new PublicKey(
  import.meta.env.VITE_GOLD_MINT_ADDRESS ||
    "61V8vBaqAGMpgDQi4JcAwo1sBGHuwHzynUqF5zdCQ2T",
);

interface PositionRow {
  agentId: number;
  type: number; // 0 Long, 1 Short
  size: number;
  collateral: number;
  entryPrice: number;
  markPrice: number;
  pnl: number;
  liquidationPrice: number;
}

export function PerpsMarketPanel({
  agent1Name,
  agent2Name,
  agent1Id,
  agent2Id,
}: PerpsMarketPanelProps) {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [agent1Spot, setAgent1Spot] = useState<number | null>(null);
  const [agent2Spot, setAgent2Spot] = useState<number | null>(null);

  // Form states
  const [a1Leverage, setA1Leverage] = useState<number>(2);
  const [a2Leverage, setA2Leverage] = useState<number>(2);
  const [a1Collateral, setA1Collateral] = useState<number>(10);
  const [a2Collateral, setA2Collateral] = useState<number>(10);

  const [loadingTx, setLoadingTx] = useState<string | null>(null);

  const [positions, setPositions] = useState<PositionRow[]>([]);

  const fetchState = async () => {
    try {
      const provider = new anchor.AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
      const program = new anchor.Program(
        goldPerpsIdl as anchor.Idl,
        provider,
      ) as any;

      // Fetch Oracles
      const [oracle1Pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("oracle"),
          new anchor.BN(agent1Id).toArrayLike(Buffer, "le", 4),
        ],
        PROGRAM_ID,
      );
      const [oracle2Pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("oracle"),
          new anchor.BN(agent2Id).toArrayLike(Buffer, "le", 4),
        ],
        PROGRAM_ID,
      );

      let s1 = null,
        s2 = null;
      try {
        const acc1 = await program.account.oracleState.fetch(oracle1Pda);
        s1 = acc1.spotIndex.toNumber() / 1_000_000;
      } catch (e) {}

      try {
        const acc2 = await program.account.oracleState.fetch(oracle2Pda);
        s2 = acc2.spotIndex.toNumber() / 1_000_000;
      } catch (e) {}

      setAgent1Spot(s1);
      setAgent2Spot(s2);

      // Fetch Positions
      if (wallet.publicKey) {
        const [pos1Pda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("position"),
            wallet.publicKey.toBuffer(),
            new anchor.BN(agent1Id).toArrayLike(Buffer, "le", 4),
          ],
          PROGRAM_ID,
        );
        const [pos2Pda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("position"),
            wallet.publicKey.toBuffer(),
            new anchor.BN(agent2Id).toArrayLike(Buffer, "le", 4),
          ],
          PROGRAM_ID,
        );

        const activePositions: PositionRow[] = [];

        const checkPos = async (
          pda: PublicKey,
          agentId: number,
          markPrice: number | null,
        ) => {
          try {
            const acc = await program.account.positionState.fetch(pda);
            const size = acc.size.toNumber() / 1_000_000;
            const collateral = acc.collateral.toNumber() / 1_000_000;
            const entryPrice = acc.entryPrice.toNumber() / 1_000_000;

            let pnl = 0;
            let liqPrice = 0;

            if (markPrice) {
              if (acc.positionType === 0) {
                pnl = (markPrice - entryPrice) * (size / entryPrice);
                liqPrice = entryPrice * (1 - (collateral * 0.9) / size);
              } else {
                pnl = (entryPrice - markPrice) * (size / entryPrice);
                liqPrice = entryPrice * (1 + (collateral * 0.9) / size);
              }
            }

            activePositions.push({
              agentId,
              type: acc.positionType,
              size,
              collateral,
              entryPrice,
              markPrice: markPrice || 0,
              pnl,
              liquidationPrice: liqPrice,
            });
          } catch (e) {}
        };

        await checkPos(pos1Pda, agent1Id, s1);
        await checkPos(pos2Pda, agent2Id, s2);

        setPositions(activePositions);
      }
    } catch (err) {
      console.error("Failed to fetch perps state", err);
    }
  };

  useEffect(() => {
    let active = true;
    const doFetch = async () => {
      if (active) await fetchState();
    };
    doFetch();
    const interval = setInterval(doFetch, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [connection, wallet, agent1Id, agent2Id]);

  const handleOpenPosition = async (
    agentId: number,
    positionType: number,
    collateralAmt: number,
    lev: number,
  ) => {
    if (!wallet.connected || !wallet.publicKey) {
      toast.error("Please connect your wallet to trade");
      return;
    }

    const txId = `open-${agentId}-${positionType}`;
    setLoadingTx(txId);
    toast.loading(
      `Opening ${lev}x ${positionType === 0 ? "Long" : "Short"}...`,
      { id: txId },
    );

    try {
      const provider = new anchor.AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
      const program = new anchor.Program(
        goldPerpsIdl as anchor.Idl,
        provider,
      ) as any;

      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault")],
        PROGRAM_ID,
      );
      const [oraclePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("oracle"),
          new anchor.BN(agentId).toArrayLike(Buffer, "le", 4),
        ],
        PROGRAM_ID,
      );
      const [positionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("position"),
          wallet.publicKey.toBuffer(),
          new anchor.BN(agentId).toArrayLike(Buffer, "le", 4),
        ],
        PROGRAM_ID,
      );

      const SPL_ASSOC_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey(
        "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
      );
      const vaultTokenAccount = PublicKey.findProgramAddressSync(
        [
          vaultPda.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          GOLD_MINT.toBuffer(),
        ],
        SPL_ASSOC_TOKEN_ACCOUNT_PROGRAM_ID,
      )[0];
      const traderTokenAccount = PublicKey.findProgramAddressSync(
        [
          wallet.publicKey.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          GOLD_MINT.toBuffer(),
        ],
        SPL_ASSOC_TOKEN_ACCOUNT_PROGRAM_ID,
      )[0];

      const collateralBN = new anchor.BN(collateralAmt * 1_000_000);
      const leverageBN = new anchor.BN(lev);

      const tx = await program.methods
        .openPosition(agentId, positionType, collateralBN, leverageBN)
        .accounts({
          position: positionPda,
          trader: wallet.publicKey,
          traderTokenAccount,
          vaultTokenAccount,
          oracle: oraclePda,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      toast.success(`Position opened!`, { id: txId });
      await fetchState();
    } catch (e: any) {
      console.error("Open Position Error:", e);
      toast.error(`Error: ${e.message}`, { id: txId });
    } finally {
      setLoadingTx(null);
    }
  };

  const handleClosePosition = async (agentId: number) => {
    if (!wallet.connected || !wallet.publicKey) return;

    const txId = `close-${agentId}`;
    setLoadingTx(txId);
    toast.loading(`Closing position...`, { id: txId });

    try {
      const provider = new anchor.AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
      const program = new anchor.Program(
        goldPerpsIdl as anchor.Idl,
        provider,
      ) as any;

      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault")],
        PROGRAM_ID,
      );
      const [oraclePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("oracle"),
          new anchor.BN(agentId).toArrayLike(Buffer, "le", 4),
        ],
        PROGRAM_ID,
      );
      const [positionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("position"),
          wallet.publicKey.toBuffer(),
          new anchor.BN(agentId).toArrayLike(Buffer, "le", 4),
        ],
        PROGRAM_ID,
      );

      const SPL_ASSOC_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey(
        "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
      );
      const vaultTokenAccount = PublicKey.findProgramAddressSync(
        [
          vaultPda.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          GOLD_MINT.toBuffer(),
        ],
        SPL_ASSOC_TOKEN_ACCOUNT_PROGRAM_ID,
      )[0];
      const traderTokenAccount = PublicKey.findProgramAddressSync(
        [
          wallet.publicKey.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          GOLD_MINT.toBuffer(),
        ],
        SPL_ASSOC_TOKEN_ACCOUNT_PROGRAM_ID,
      )[0];

      await program.methods
        .closePosition()
        .accounts({
          position: positionPda,
          owner: wallet.publicKey,
          oracle: oraclePda,
          vault: vaultPda,
          vaultTokenAccount,
          ownerTokenAccount: traderTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      toast.success(`Position closed!`, { id: txId });
      await fetchState();
    } catch (e: any) {
      console.error("Close Error:", e);
      toast.error(`Error closing: ${e.message}`, { id: txId });
    } finally {
      setLoadingTx(null);
    }
  };

  const renderTradeCard = (
    agentName: string,
    agentId: number,
    spotPrice: number | null,
    collateral: number,
    setCollateral: (v: number) => void,
    leverage: number,
    setLeverage: (v: number) => void,
  ) => {
    const estSize = collateral * leverage;
    const estLiqLong = spotPrice
      ? spotPrice * (1 - (collateral * 0.9) / estSize)
      : 0;
    const estLiqShort = spotPrice
      ? spotPrice * (1 + (collateral * 0.9) / estSize)
      : 0;

    return (
      <div className="perp-card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: spotPrice ? "#22c55e" : "#888",
                boxShadow: spotPrice ? "0 0 8px #22c55e" : "none",
              }}
            />
            <span style={{ fontWeight: 700, fontSize: "18px" }}>
              {agentName}
            </span>
          </div>
          <div className="perp-price">
            {spotPrice !== null ? "$" + spotPrice.toFixed(2) : "--"}
          </div>
        </div>

        <div className="perp-input-group">
          <label>Collateral (GOLD)</label>
          <input
            type="number"
            value={collateral}
            onChange={(e) => setCollateral(Number(e.target.value))}
            min={1}
          />
        </div>

        <div className="perp-input-group">
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <label>Leverage</label>
            <span style={{ color: "#fff", fontWeight: 600 }}>{leverage}x</span>
          </div>
          <input
            type="range"
            className="leverage-slider"
            min={1}
            max={10}
            step={1}
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "11px",
              color: "rgba(255,255,255,0.4)",
              marginTop: "4px",
            }}
          >
            <span>1x</span>
            <span>5x</span>
            <span>10x</span>
          </div>
        </div>

        <div className="perp-order-details">
          <div className="perp-order-row">
            <span>Position Size</span>
            <span style={{ color: "#fff" }}>{estSize.toFixed(2)} GOLD</span>
          </div>
          {spotPrice && leverage > 1 && (
            <>
              <div className="perp-order-row">
                <span>Est. Liq (Long)</span>
                <span style={{ color: "#ef4444" }}>
                  ${estLiqLong.toFixed(2)}
                </span>
              </div>
              <div className="perp-order-row">
                <span>Est. Liq (Short)</span>
                <span style={{ color: "#22c55e" }}>
                  ${estLiqShort.toFixed(2)}
                </span>
              </div>
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
          <button
            className="btn-perp-long"
            disabled={!!loadingTx || collateral <= 0}
            onClick={() => handleOpenPosition(agentId, 0, collateral, leverage)}
          >
            LONG {leverage}x
          </button>
          <button
            className="btn-perp-short"
            disabled={!!loadingTx || collateral <= 0}
            onClick={() => handleOpenPosition(agentId, 1, collateral, leverage)}
          >
            SHORT {leverage}x
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <Toaster theme="dark" position="bottom-right" />

      {/* Position Dashboard */}
      {positions.length > 0 && (
        <div className="perp-dashboard">
          <h3
            style={{
              margin: "0 0 12px 0",
              fontSize: "14px",
              textTransform: "uppercase",
              letterSpacing: "1px",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            Open Positions
          </h3>
          <div className="perp-table-wrapper">
            <table className="perp-table">
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Side</th>
                  <th>Size</th>
                  <th>Entry</th>
                  <th>Mark</th>
                  <th>Liq. Price</th>
                  <th>Unrealized PnL</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => {
                  const marketName =
                    p.agentId === agent1Id ? agent1Name : agent2Name;
                  const isLong = p.type === 0;
                  const pnlColor = p.pnl >= 0 ? "pnl-positive" : "pnl-negative";

                  return (
                    <tr key={p.agentId}>
                      <td style={{ fontWeight: 600 }}>{marketName}</td>
                      <td
                        style={{
                          color: isLong ? "#22c55e" : "#ef4444",
                          fontWeight: 700,
                        }}
                      >
                        {isLong ? "LONG" : "SHORT"}
                      </td>
                      <td>{p.size.toFixed(2)}</td>
                      <td>${p.entryPrice.toFixed(2)}</td>
                      <td>${p.markPrice.toFixed(2)}</td>
                      <td style={{ color: "#eab308" }}>
                        ${p.liquidationPrice.toFixed(2)}
                      </td>
                      <td className={pnlColor}>
                        {p.pnl >= 0 ? "+" : ""}
                        {p.pnl.toFixed(2)} GOLD
                      </td>
                      <td>
                        <button
                          className="btn-perp-close"
                          onClick={() => handleClosePosition(p.agentId)}
                          disabled={!!loadingTx}
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trade Cards */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}
      >
        {renderTradeCard(
          agent1Name,
          agent1Id,
          agent1Spot,
          a1Collateral,
          setA1Collateral,
          a1Leverage,
          setA1Leverage,
        )}
        {renderTradeCard(
          agent2Name,
          agent2Id,
          agent2Spot,
          a2Collateral,
          setA2Collateral,
          a2Leverage,
          setA2Leverage,
        )}
      </div>
    </div>
  );
}
