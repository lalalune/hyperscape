/**
 * ChainSelector — Dropdown to pick active chain (Solana / BSC / Base).
 */

import { useChain } from "../lib/ChainContext";
import { CHAIN_DISPLAY, type ChainId } from "../lib/chainConfig";

export function ChainSelector() {
  const { activeChain, setActiveChain, availableChains } = useChain();

  if (availableChains.length <= 1) {
    const display = CHAIN_DISPLAY[activeChain];
    return (
      <div className="chain-badge">
        <span className="chain-badge-icon">{display.icon}</span>
        <span className="chain-badge-name">{display.shortName}</span>
      </div>
    );
  }

  return (
    <div className="chain-select-wrap">
      <select
        id="chain-selector"
        className="chain-select"
        value={activeChain}
        onChange={(e) => setActiveChain(e.target.value as ChainId)}
      >
        {availableChains.map((chain) => {
          const display = CHAIN_DISPLAY[chain];
          return (
            <option key={chain} value={chain} style={{ background: "#111" }}>
              {display.icon} {display.shortName}
            </option>
          );
        })}
      </select>
      <span className="chain-select-arrow">▼</span>
    </div>
  );
}
