import fs from "fs";

let content = fs.readFileSync(
  "packages/gold-betting-demo/app/src/App.tsx",
  "utf8",
);

// 1. imports
content = content.replace(
  `} from "./components/PredictionMarketPanel";\nimport { PointsDisplay } from "./components/PointsDisplay";`,
  `} from "./components/PredictionMarketPanel";\nimport { PerpsMarketPanel } from "./components/PerpsMarketPanel";\nimport { PointsDisplay } from "./components/PointsDisplay";`,
);

// 2. state
content = content.replace(
  `const [amountInput, setAmountInput] = useState<string>("1");\n  const [side, setSide] = useState<BetSide>("YES");`,
  `const [amountInput, setAmountInput] = useState<string>("1");\n  const [appMode, setAppMode] = useState<"DUEL" | "PERPS">("DUEL");\n  const [side, setSide] = useState<BetSide>("YES");`,
);

// 3. toggle button
content = content.replace(
  `                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  <ChainSelector />`,
  `                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  {/* Mode Toggle */}
                  <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '4px', marginRight: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setAppMode("DUEL")}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        background: appMode === "DUEL" ? 'rgba(255,255,255,0.1)' : 'transparent',
                        color: appMode === "DUEL" ? '#fff' : 'rgba(255,255,255,0.5)',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      DUEL
                    </button>
                    <button
                      type="button"
                      onClick={() => setAppMode("PERPS")}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        background: appMode === "PERPS" ? 'rgba(255,255,255,0.1)' : 'transparent',
                        color: appMode === "PERPS" ? '#fff' : 'rgba(255,255,255,0.5)',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      PERPS
                    </button>
                  </div>
                  <ChainSelector />`,
);

// 4. Panel
content = content.replace(
  `                ) : !isStreamUIMode ? (
                  <div style={{ marginTop: 16 }}>
                    <SolanaClobPanel
                      agent1Name={effAgent1Name}
                      agent2Name={effAgent2Name}
                    />
                  </div>
                ) : (`,
  `                ) : !isStreamUIMode ? (
                  <div style={{ marginTop: 16 }}>
                    {appMode === "DUEL" ? (
                      <SolanaClobPanel
                        agent1Name={effAgent1Name}
                        agent2Name={effAgent2Name}
                      />
                    ) : (
                      <PerpsMarketPanel
                        agent1Name={effAgent1Name}
                        agent2Name={effAgent2Name}
                      />
                    )}
                  </div>
                ) : (`,
);

// 5. extract stream player block and move it
const streamPlayerTarget = `{/* Stream Background (live mode) */}`;
const streamPlayerEndTarget = `      {/* Points / Leaderboard / Referral Drawer */}`;

const startIndex = content.indexOf(streamPlayerTarget);
let blockEndIndex = content.indexOf(streamPlayerEndTarget, startIndex);

if (startIndex > -1 && blockEndIndex > -1) {
  // extract the block
  let blockToMove = content.substring(startIndex, blockEndIndex);

  // replace stream background block condition to include appMode
  blockToMove = blockToMove.replace(
    `{!isStreamUIMode && activeStreamUrl && (`,
    `{appMode === "DUEL" && !isStreamUIMode && activeStreamUrl && (`,
  );

  // remove the original block
  content = content.substring(0, startIndex) + content.substring(blockEndIndex);

  // now insert it inside stream-stage-placeholder
  content = content.replace(
    `<div className="stream-stage-placeholder" aria-hidden="true" />`,
    `<div className="stream-stage-placeholder" aria-hidden={appMode !== "DUEL"}>\n          ${blockToMove}\n        </div>`,
  );
}

fs.writeFileSync("packages/gold-betting-demo/app/src/App.tsx", content);
