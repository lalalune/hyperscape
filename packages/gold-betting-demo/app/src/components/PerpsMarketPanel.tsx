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
  const [selectedAgent, setSelectedAgent] = useState<number>(agent1Id);

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

  const agentSpot = selectedAgent === agent1Id ? agent1Spot : agent2Spot;
  const agentCollateral =
    selectedAgent === agent1Id ? a1Collateral : a2Collateral;
  const setAgentCollateral =
    selectedAgent === agent1Id ? setA1Collateral : setA2Collateral;
  const agentLeverage = selectedAgent === agent1Id ? a1Leverage : a2Leverage;
  const setAgentLeverage =
    selectedAgent === agent1Id ? setA1Leverage : setA2Leverage;

  const openPosition = positions.find((p) => p.agentId === selectedAgent);

  return (
    <div className="perp-wrap">
      <Toaster theme="dark" position="bottom-right" />

      {/* Agent selector */}
      <div className="perp-agent-selector">
        <button
          className={`perp-agent-btn ${selectedAgent === agent1Id ? "perp-agent-btn--active" : ""}`}
          onClick={() => setSelectedAgent(agent1Id)}
          type="button"
        >
          {agent1Name}
        </button>
        <button
          className={`perp-agent-btn ${selectedAgent === agent2Id ? "perp-agent-btn--active" : ""}`}
          onClick={() => setSelectedAgent(agent2Id)}
          type="button"
        >
          {agent2Name}
        </button>
      </div>

      {/* Price & spot */}
      <div className="perp-spot-row">
        <div className="perp-spot-indicator">
          <span
            className="perp-spot-dot"
            style={{
              background: agentSpot ? "#22c55e" : "#555",
              boxShadow: agentSpot ? "0 0 6px #22c55e" : "none",
            }}
          />
          <span className="perp-spot-label">SPOT</span>
        </div>
        <span className="perp-spot-price">
          {agentSpot !== null ? `$${agentSpot.toFixed(2)}` : "—"}
        </span>
      </div>

      {/* Open position badge */}
      {openPosition && (
        <div
          className={`perp-pos-badge ${openPosition.type === 0 ? "perp-pos-badge--long" : "perp-pos-badge--short"}`}
        >
          <div className="perp-pos-badge-row">
            <span>
              {openPosition.type === 0 ? "▲ LONG" : "▼ SHORT"} ·{" "}
              {openPosition.size.toFixed(2)} GOLD
            </span>
            <span
              className={
                openPosition.pnl >= 0 ? "pnl-positive" : "pnl-negative"
              }
            >
              {openPosition.pnl >= 0 ? "+" : ""}
              {openPosition.pnl.toFixed(2)}
            </span>
          </div>
          <div className="perp-pos-badge-row perp-pos-badge-row--sub">
            <span>Entry ${openPosition.entryPrice.toFixed(2)}</span>
            <span>
              Liq{" "}
              <span style={{ color: "#eab308" }}>
                ${openPosition.liquidationPrice.toFixed(2)}
              </span>
            </span>
            <button
              className="perp-pos-close-btn"
              onClick={() => handleClosePosition(selectedAgent)}
              disabled={!!loadingTx}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Collateral input */}
      <div className="perp-field">
        <label className="perp-field-label">
          Collateral <span className="perp-field-unit">GOLD</span>
        </label>
        <input
          className="perp-field-input"
          type="number"
          value={agentCollateral}
          onChange={(e) => setAgentCollateral(Number(e.target.value))}
          min={1}
        />
      </div>

      {/* Leverage */}
      <div className="perp-field">
        <div className="perp-field-header">
          <label className="perp-field-label">Leverage</label>
          <span className="perp-lev-display">{agentLeverage}x</span>
        </div>
        <div className="perp-lev-presets">
          {[1, 2, 5, 10].map((lv) => (
            <button
              key={lv}
              className={`perp-lev-btn ${agentLeverage === lv ? "perp-lev-btn--active" : ""}`}
              onClick={() => setAgentLeverage(lv)}
              type="button"
            >
              {lv}x
            </button>
          ))}
        </div>
        <input
          type="range"
          className="perp-slider"
          min={1}
          max={10}
          step={1}
          value={agentLeverage}
          onChange={(e) => setAgentLeverage(Number(e.target.value))}
        />
      </div>

      {/* Order summary */}
      <div className="perp-summary">
        <div className="perp-summary-row">
          <span>Position Size</span>
          <span className="perp-summary-val">
            {(agentCollateral * agentLeverage).toFixed(2)} GOLD
          </span>
        </div>
        {agentSpot && agentLeverage > 1 && (
          <>
            <div className="perp-summary-row">
              <span>Est. Liq (Long)</span>
              <span style={{ color: "#ef4444" }}>
                $
                {(
                  agentSpot *
                  (1 -
                    (agentCollateral * 0.9) / (agentCollateral * agentLeverage))
                ).toFixed(2)}
              </span>
            </div>
            <div className="perp-summary-row">
              <span>Est. Liq (Short)</span>
              <span style={{ color: "#22c55e" }}>
                $
                {(
                  agentSpot *
                  (1 +
                    (agentCollateral * 0.9) / (agentCollateral * agentLeverage))
                ).toFixed(2)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* LONG / SHORT */}
      <div className="perp-action-row">
        <button
          className="perp-btn-long"
          disabled={!!loadingTx || agentCollateral <= 0}
          onClick={() =>
            handleOpenPosition(selectedAgent, 0, agentCollateral, agentLeverage)
          }
          type="button"
        >
          ▲ LONG {agentLeverage}x
        </button>
        <button
          className="perp-btn-short"
          disabled={!!loadingTx || agentCollateral <= 0}
          onClick={() =>
            handleOpenPosition(selectedAgent, 1, agentCollateral, agentLeverage)
          }
          type="button"
        >
          ▼ SHORT {agentLeverage}x
        </button>
      </div>

      <div className="perp-footer-note">
        <span>
          By trading, you agree to our <a href="#">Terms</a> &amp;{" "}
          <a href="#">Privacy</a>
        </span>
      </div>
    </div>
  );
}
