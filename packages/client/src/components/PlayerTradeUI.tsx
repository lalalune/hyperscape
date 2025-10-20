/**
 * @fileoverview Player-to-Player Trading UI
 * @module hyperscape/client/components/PlayerTradeUI
 * 
 * Complete P2P trading interface with drag-and-drop functionality.
 * 
 * Features:
 * - Right-click player → "Trade" option
 * - Trade request sent → Waiting screen
 * - Trade accepted → Trade window opens for both
 * - Drag items from inventory to trade slots
 * - Review items → Confirm/Cancel
 * - Escrow integration (deposit → review → execute)
 */

import React, { useState, useEffect } from 'react';
import { useAccount, useContractWrite } from 'wagmi';
import type { Address } from 'viem';

interface TradeItem {
  tokenContract: Address;
  tokenId: bigint;
  amount: bigint;
  isERC20: boolean;
  name: string;
  imageUrl?: string;
}

interface PlayerTradeUIProps {
  escrowAddress: Address;
  targetPlayer: {
    address: Address;
    name: string;
  };
  yourItems: TradeItem[];
  onTradeComplete?: () => void;
  onTradeCancel?: () => void;
}

enum TradeStatus {
  PENDING = 'pending',
  DEPOSITING = 'depositing',
  REVIEWING = 'reviewing',
  CONFIRMING = 'confirming',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export function PlayerTradeUI({
  escrowAddress,
  targetPlayer,
  yourItems,
  onTradeComplete,
  onTradeCancel
}: PlayerTradeUIProps): JSX.Element {
  const { address } = useAccount();
  const [status, setStatus] = useState<TradeStatus>(TradeStatus.PENDING);
  const [tradeId, setTradeId] = useState<bigint | null>(null);
  const [yourOffer, setYourOffer] = useState<TradeItem[]>([]);
  const [theirOffer, setTheirOffer] = useState<TradeItem[]>([]);
  const [reviewTimeRemaining, setReviewTimeRemaining] = useState<number>(30);
  const [error, setError] = useState<string | null>(null);

  // Create trade
  const handleCreateTrade = async (): Promise<void> => {
    setStatus(TradeStatus.PENDING);
    
    const response = await fetch('/api/trade/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerA: address,
        playerB: targetPlayer.address
      })
    });

    if (response.ok) {
      const data = await response.json();
      setTradeId(BigInt(data.tradeId));
      setStatus(TradeStatus.DEPOSITING);
    }
  };

  // Deposit items
  const handleDeposit = async (): Promise<void> => {
    if (!tradeId || yourOffer.length === 0) return;

    setStatus(TradeStatus.DEPOSITING);

    // Approve NFTs/tokens first
    for (const item of yourOffer) {
      const approveResponse = await fetch('/api/trade/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenContract: item.tokenContract,
          tokenId: item.tokenId,
          isERC20: item.isERC20,
          amount: item.amount,
          spender: escrowAddress
        })
      });

      if (!approveResponse.ok) {
        setError('Failed to approve items');
        return;
      }
    }

    // Deposit to escrow
    const depositResponse = await fetch('/api/trade/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tradeId: tradeId.toString(),
        items: yourOffer
      })
    });

    if (depositResponse.ok) {
      setStatus(TradeStatus.REVIEWING);
      startReviewTimer();
    }
  };

  // Start 30-second review timer
  const startReviewTimer = (): void => {
    let remaining = 30;
    setReviewTimeRemaining(remaining);

    const interval = setInterval(() => {
      remaining--;
      setReviewTimeRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        setStatus(TradeStatus.CONFIRMING);
      }
    }, 1000);
  };

  // Confirm trade
  const handleConfirm = async (): Promise<void> => {
    if (!tradeId) return;

    setStatus(TradeStatus.EXECUTING);

    const response = await fetch('/api/trade/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tradeId: tradeId.toString()
      })
    });

    if (response.ok) {
      setStatus(TradeStatus.COMPLETED);
      if (onTradeComplete) {
        setTimeout(onTradeComplete, 2000);
      }
    }
  };

  // Cancel trade
  const handleCancel = async (): Promise<void> => {
    if (!tradeId) {
      if (onTradeCancel) onTradeCancel();
      return;
    }

    const response = await fetch('/api/trade/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tradeId: tradeId.toString()
      })
    });

    if (response.ok) {
      setStatus(TradeStatus.CANCELLED);
      if (onTradeCancel) {
        setTimeout(onTradeCancel, 1000);
      }
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, item: TradeItem): void => {
    e.dataTransfer.setData('application/json', JSON.stringify(item));
  };

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    const itemData = e.dataTransfer.getData('application/json');
    const item: TradeItem = JSON.parse(itemData);
    
    if (!yourOffer.find(i => i.tokenId === item.tokenId)) {
      setYourOffer([...yourOffer, item]);
    }
  };

  const handleRemoveItem = (item: TradeItem): void => {
    setYourOffer(yourOffer.filter(i => i.tokenId !== item.tokenId));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="bg-gray-900 border-2 border-yellow-600 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-yellow-400">
            🤝 Trading with {targetPlayer.name}
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Status Bar */}
        <div className="mb-6 bg-gray-800 p-4 rounded">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Status:</span>
            <span className={`font-semibold ${
              status === TradeStatus.COMPLETED ? 'text-green-400' :
              status === TradeStatus.CANCELLED ? 'text-red-400' :
              'text-yellow-400'
            }`}>
              {status.toUpperCase()}
            </span>
          </div>

          {status === TradeStatus.REVIEWING && (
            <div className="mt-2 text-center">
              <div className="text-orange-400 font-semibold">
                ⏱️ Review Period: {reviewTimeRemaining}s
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Both players must wait 30 seconds before confirming
              </div>
            </div>
          )}
        </div>

        {/* Trade Window */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Your Offer */}
          <div className="bg-gray-800 p-4 rounded">
            <h3 className="text-lg font-semibold text-green-400 mb-3">
              Your Offer
            </h3>
            <div
              className="min-h-64 border-2 border-dashed border-gray-700 rounded p-4"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              {yourOffer.length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  Drag items here to trade
                </div>
              ) : (
                <div className="space-y-2">
                  {yourOffer.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-700 p-3 rounded flex justify-between items-center"
                    >
                      <span className="text-white">{item.name}</span>
                      <button
                        onClick={() => handleRemoveItem(item)}
                        className="text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Their Offer */}
          <div className="bg-gray-800 p-4 rounded">
            <h3 className="text-lg font-semibold text-blue-400 mb-3">
              Their Offer
            </h3>
            <div className="min-h-64 border-2 border-gray-700 rounded p-4">
              {theirOffer.length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  Waiting for {targetPlayer.name}...
                </div>
              ) : (
                <div className="space-y-2">
                  {theirOffer.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-700 p-3 rounded"
                    >
                      <span className="text-white">{item.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Available Items */}
        {status === TradeStatus.DEPOSITING && (
          <div className="mb-6 bg-gray-800 p-4 rounded">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">
              Your Inventory (drag to offer)
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {yourItems.map((item, idx) => (
                <div
                  key={idx}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  className="bg-gray-700 p-3 rounded cursor-move hover:bg-gray-600 transition"
                >
                  <div className="text-white text-sm">{item.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {status === TradeStatus.PENDING && (
            <button
              onClick={handleCreateTrade}
              className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 rounded"
            >
              Send Trade Request
            </button>
          )}

          {status === TradeStatus.DEPOSITING && (
            <button
              onClick={handleDeposit}
              disabled={yourOffer.length === 0}
              className={`flex-1 font-bold py-3 rounded ${
                yourOffer.length > 0
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              Deposit Items to Escrow
            </button>
          )}

          {status === TradeStatus.REVIEWING && (
            <button
              disabled
              className="flex-1 bg-orange-900 text-orange-400 font-bold py-3 rounded cursor-not-allowed"
            >
              ⏱️ Review Period ({reviewTimeRemaining}s)
            </button>
          )}

          {status === TradeStatus.CONFIRMING && (
            <button
              onClick={handleConfirm}
              className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded"
            >
              ✓ Confirm Trade
            </button>
          )}

          {status === TradeStatus.EXECUTING && (
            <button
              disabled
              className="flex-1 bg-blue-900 text-blue-400 font-bold py-3 rounded cursor-wait"
            >
              ⏳ Executing Trade...
            </button>
          )}

          {status === TradeStatus.COMPLETED && (
            <div className="flex-1 bg-green-900 text-green-400 font-bold py-3 rounded text-center">
              ✅ Trade Completed!
            </div>
          )}

          <button
            onClick={handleCancel}
            disabled={status === TradeStatus.EXECUTING || status === TradeStatus.COMPLETED}
            className="bg-red-900 hover:bg-red-800 text-red-200 font-bold py-3 px-6 rounded"
          >
            Cancel
          </button>
        </div>

        {error && (
          <div className="mt-4 bg-red-900 border border-red-600 text-red-200 p-3 rounded">
            ❌ {error}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-4 bg-blue-900 bg-opacity-30 border border-blue-700 p-3 rounded">
          <p className="text-blue-200 text-sm">
            <strong>How trading works:</strong>
          </p>
          <ul className="text-blue-300 text-xs space-y-1 list-disc list-inside mt-2">
            <li>Both players add items to trade</li>
            <li>Items deposited to secure escrow contract</li>
            <li>30-second review period (anti-fraud)</li>
            <li>Both players must confirm</li>
            <li>Items swap atomically (both or neither)</li>
            <li>Either player can cancel anytime</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Trade request notification
 */
export function TradeRequestNotification({
  fromPlayer: {
    address,
    name
  },
  onAccept,
  onDecline
}: {
  fromPlayer: { address: Address; name: string };
  onAccept: () => void;
  onDecline: () => void;
}): JSX.Element {
  return (
    <div className="fixed top-4 right-4 bg-gray-900 border-2 border-yellow-600 rounded-lg p-4 shadow-xl z-50 max-w-sm">
      <div className="flex items-start mb-3">
        <span className="text-3xl mr-3">🤝</span>
        <div>
          <h3 className="text-lg font-semibold text-yellow-400">
            Trade Request
          </h3>
          <p className="text-gray-300 text-sm">
            <strong>{name}</strong> wants to trade with you
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onAccept}
          className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold py-2 rounded"
        >
          Accept
        </button>
        <button
          onClick={onDecline}
          className="flex-1 bg-red-900 hover:bg-red-800 text-red-200 font-semibold py-2 rounded"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

/**
 * Trade status indicator (minimized)
 */
export function TradeStatusIndicator({
  status,
  playerName
}: {
  status: TradeStatus;
  playerName: string;
}): JSX.Element {
  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 border border-yellow-600 rounded-lg p-3 shadow-xl z-40">
      <div className="flex items-center gap-2">
        <span className="text-xl">🤝</span>
        <div>
          <div className="text-sm text-gray-400">Trading with {playerName}</div>
          <div className="text-xs text-yellow-400">{status}</div>
        </div>
      </div>
    </div>
  );
}

