/**
 * @fileoverview Item Minting UI Component
 * @module hyperscape/client/components/ItemMintingUI
 *
 * Right-click context menu for inventory items with minting option.
 *
 * Features:
 * - Right-click inventory item → "Mint as NFT"
 * - Shows item stats and rarity
 * - Request signature from game server
 * - Submit transaction to mint NFT
 * - Update inventory state
 * - Display minted NFT status
 */

import React, { useState } from "react";
import { useAccount } from "wagmi";
import { keccak256, solidityPacked, randomBytes } from "ethers";

interface ItemMintingUIProps {
  item: {
    id: string;
    itemId: string;
    name: string;
    stats: {
      attack: number;
      defense: number;
      strength: number;
    };
    rarity: number;
  };
  hyperscapeItemsAddress: string;
  gameServerUrl: string;
  onMintSuccess?: (tokenId: bigint) => void;
  onClose?: () => void;
}

interface MintSignatureResponse {
  playerAddress: string;
  itemId: string;
  instanceId: string;
  attack: number;
  defense: number;
  strength: number;
  rarity: number;
  signature: string;
}

export function ItemMintingUI({
  item,
  hyperscapeItemsAddress: _hyperscapeItemsAddress,
  gameServerUrl,
  onMintSuccess,
  onClose,
}: ItemMintingUIProps): React.ReactElement {
  const { address } = useAccount();
  const [isMinting, setIsMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [instanceId, setInstanceId] = useState<string | null>(null);

  const getRarityColor = (rarity: number): string => {
    const colors = ["gray", "green", "blue", "purple", "yellow"];
    return colors[rarity] || "gray";
  };

  const getRarityName = (rarity: number): string => {
    const names = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
    return names[rarity] || "Common";
  };

  const handleMint = async (): Promise<void> => {
    if (!address) {
      setMintError("Please connect wallet");
      return;
    }

    setIsMinting(true);
    setMintError(null);

    // Generate unique instance ID
    const newInstanceId = keccak256(
      solidityPacked(
        ["address", "uint256", "string", "bytes32"],
        [address, Date.now(), item.itemId, randomBytes(32)],
      ),
    );

    setInstanceId(newInstanceId);

    // Request signature from game server
    const signatureResponse = await fetch(`${gameServerUrl}/api/mint-item`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerAddress: address,
        itemId: item.itemId,
        instanceId: newInstanceId,
        attack: item.stats.attack,
        defense: item.stats.defense,
        strength: item.stats.strength,
        rarity: item.rarity,
      }),
    });

    if (!signatureResponse.ok) {
      const error = await signatureResponse.json();
      setMintError(error.message || "Failed to get mint signature");
      setIsMinting(false);
      return;
    }

    const signatureData: MintSignatureResponse = await signatureResponse.json();

    // Submit mint transaction
    const tokenURI = `ipfs://hyperscape-items/${item.itemId}`;

    const mintTx = await fetch("/api/mint-nft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: signatureData.itemId,
        instanceId: signatureData.instanceId,
        attack: signatureData.attack,
        defense: signatureData.defense,
        strength: signatureData.strength,
        rarity: signatureData.rarity,
        tokenURI,
        signature: signatureData.signature,
      }),
    });

    if (!mintTx.ok) {
      const error = await mintTx.json();
      setMintError(error.message || "Minting failed");
      setIsMinting(false);
      return;
    }

    const mintData = await mintTx.json();
    console.log("[ItemMintingUI] NFT minted! Token ID:", mintData.tokenId);

    setIsMinting(false);

    if (onMintSuccess) {
      onMintSuccess(BigInt(mintData.tokenId));
    }

    if (onClose) {
      setTimeout(onClose, 2000); // Close after 2 seconds
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-900 border-2 border-yellow-600 rounded-lg p-6 max-w-lg w-full">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-yellow-400">⚔️ Mint as NFT</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <div className="mb-6">
          <div className="flex items-center mb-3">
            <h3 className="text-xl font-semibold text-white">{item.name}</h3>
            <span
              className={`ml-3 px-2 py-1 rounded text-xs font-bold bg-${getRarityColor(item.rarity)}-900 text-${getRarityColor(item.rarity)}-300`}
            >
              {getRarityName(item.rarity)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 bg-gray-800 p-4 rounded">
            <div className="text-center">
              <div className="text-gray-400 text-sm">Attack</div>
              <div className="text-red-400 text-xl font-bold">
                {item.stats.attack}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 text-sm">Defense</div>
              <div className="text-blue-400 text-xl font-bold">
                {item.stats.defense}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 text-sm">Strength</div>
              <div className="text-green-400 text-xl font-bold">
                {item.stats.strength}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 bg-blue-900 bg-opacity-30 border border-blue-700 p-4 rounded">
          <p className="text-blue-200 text-sm mb-2">
            <strong>What is minting?</strong>
          </p>
          <ul className="text-blue-300 text-xs space-y-1 list-disc list-inside">
            <li>Converts in-game item to tradeable NFT</li>
            <li>NFT can be sold on marketplace</li>
            <li>NFT can be traded with other players</li>
            <li>NFT can be burned to drop back in-game</li>
            <li>Only minted items are tradeable</li>
          </ul>
        </div>

        <button
          onClick={handleMint}
          disabled={isMinting}
          className={`w-full py-4 px-6 rounded-lg font-bold text-lg transition-all ${
            isMinting
              ? "bg-gray-700 text-gray-400 cursor-wait"
              : "bg-yellow-600 hover:bg-yellow-500 text-black"
          }`}
        >
          {isMinting ? "⏳ Minting NFT..." : "✨ Mint as NFT"}
        </button>

        {mintError && (
          <div className="mt-4 bg-red-900 border border-red-600 text-red-200 p-3 rounded">
            ❌ {mintError}
          </div>
        )}

        {isMinting && instanceId && (
          <div className="mt-4 text-xs text-gray-500">
            Instance ID: {instanceId.substring(0, 20)}...
          </div>
        )}
      </div>
    </div>
  );
}
