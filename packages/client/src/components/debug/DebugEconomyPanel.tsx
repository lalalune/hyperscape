import React from "react";

interface DebugEconomyPanelProps {
  onSpawnItem?: (itemId: number) => void;
  onTriggerDeath?: () => void;
  onAddGold?: (amount: number) => void;
  onInitiateTrade?: () => void;
}

export function DebugEconomyPanel({
  onSpawnItem,
  onTriggerDeath,
  onAddGold,
  onInitiateTrade,
}: DebugEconomyPanelProps) {
  return (
    <div
      className="fixed bottom-4 right-4 bg-black/90 border-2 border-red-500 p-4 rounded-lg text-white pointer-events-auto"
      style={{ zIndex: 10000 }}
      data-testid="debug-economy-panel"
    >
      <h3 className="text-red-500 font-bold mb-3">DEBUG: Economy Testing</h3>

      <div className="space-y-2">
        <button
          onClick={() => {
            console.log("[DEBUG] Spawn item button clicked");
            onSpawnItem?.(1);
          }}
          className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm cursor-pointer pointer-events-auto"
          data-testid="debug-spawn-item"
        >
          Spawn Test Item (ID: 1)
        </button>

        <button
          onClick={() => {
            console.log("[DEBUG] Spawn item 2 button clicked");
            onSpawnItem?.(2);
          }}
          className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm cursor-pointer pointer-events-auto"
          data-testid="debug-spawn-item-2"
        >
          Spawn Item 2 (Weapon)
        </button>

        <button
          onClick={() => {
            console.log("[DEBUG] Add gold button clicked");
            onAddGold?.(500);
          }}
          className="w-full px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-sm cursor-pointer pointer-events-auto"
          data-testid="debug-add-gold"
        >
          Add 500 Gold
        </button>

        <button
          onClick={() => {
            console.log("[DEBUG] Trigger death button clicked");
            onTriggerDeath?.();
          }}
          className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm cursor-pointer pointer-events-auto"
          data-testid="debug-trigger-death"
        >
          Trigger Death (Test Drops)
        </button>

        <button
          onClick={() => {
            console.log("[DEBUG] Initiate trade button clicked");
            onInitiateTrade?.();
          }}
          className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm cursor-pointer pointer-events-auto"
          data-testid="debug-initiate-trade"
        >
          Trade with Nearest Player
        </button>

        <div className="mt-3 pt-3 border-t border-red-500/50">
          <p className="text-xs text-red-300">
            Press 'F9' to toggle this panel
          </p>
        </div>
      </div>
    </div>
  );
}
