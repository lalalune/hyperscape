/**
 * @fileoverview Gold Claiming UI Component
 * @module hyperscape/client/components/GoldClaimingUI
 * 
 * Displays claimed vs unclaimed gold and allows players to claim (mint HG tokens).
 * 
 * Features:
 * - Shows unclaimed gold balance
 * - Shows claimed gold balance (on-chain ERC-20)
 * - Claim button to mint HG tokens
 * - Transaction status feedback
 * - Rate limiting display
 */

import React, { useState, useEffect } from 'react';
import { useAccount, useContractWrite, useContractRead } from 'wagmi';
import { parseEther, formatEther } from 'viem';

interface GoldClaimingUIProps {
  unclaimedGold: number;
  claimedGold: number;
  hyperscapeGoldAddress: string;
  gameServerUrl: string;
  onClaimSuccess?: (amount: bigint) => void;
}

interface ClaimSignatureResponse {
  playerAddress: string;
  amount: string;
  nonce: number;
  signature: string;
}

export function GoldClaimingUI({
  unclaimedGold,
  claimedGold,
  hyperscapeGoldAddress,
  gameServerUrl,
  onClaimSuccess
}: GoldClaimingUIProps): JSX.Element {
  const { address } = useAccount();
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [lastClaimTime, setLastClaimTime] = useState<number>(0);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  const CLAIM_COOLDOWN_MS = 5000; // 5 seconds

  // Read on-chain nonce
  const { data: currentNonce } = useContractRead({
    address: hyperscapeGoldAddress as `0x${string}`,
    abi: ['function nonces(address) view returns (uint256)'],
    functionName: 'nonces',
    args: address ? [address] : undefined,
    enabled: !!address
  });

  // Cooldown timer
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastClaimTime > 0) {
        const elapsed = Date.now() - lastClaimTime;
        const remaining = Math.max(0, CLAIM_COOLDOWN_MS - elapsed);
        setCooldownRemaining(remaining);
      } else {
        setCooldownRemaining(0);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [lastClaimTime]);

  const handleClaim = async (): Promise<void> => {
    if (!address || unclaimedGold === 0) return;

    setIsClaiming(true);
    setClaimError(null);

    const amountWei = parseEther(unclaimedGold.toString());

    // 1. Request signature from game server
    const signatureResponse = await fetch(`${gameServerUrl}/api/claim-gold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerAddress: address,
        amount: amountWei.toString()
      })
    });

    if (!signatureResponse.ok) {
      const error = await signatureResponse.json();
      setClaimError(error.message || 'Failed to get signature');
      setIsClaiming(false);
      return;
    }

    const signatureData: ClaimSignatureResponse = await signatureResponse.json();

    // 2. Submit transaction to HyperscapeGold contract
    const tx = await fetch('/api/submit-claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: signatureData.amount,
        nonce: signatureData.nonce,
        signature: signatureData.signature
      })
    });

    if (!tx.ok) {
      const error = await tx.json();
      setClaimError(error.message || 'Transaction failed');
      setIsClaiming(false);
      return;
    }

    // 3. Success!
    const txData = await tx.json();
    console.log('[GoldClaimingUI] Claim successful:', txData.txHash);

    setLastClaimTime(Date.now());
    setIsClaiming(false);

    if (onClaimSuccess) {
      onClaimSuccess(BigInt(signatureData.amount));
    }
  };

  const canClaim = unclaimedGold > 0 && !isClaiming && cooldownRemaining === 0;

  return (
    <div className="gold-claiming-ui">
      <div className="gold-display">
        <h3>Hyperscape Gold (HG)</h3>
        
        <div className="gold-balance unclaimed">
          <span className="label">Unclaimed:</span>
          <span className="amount">{unclaimedGold.toLocaleString()}</span>
          <span className="hint">Available to claim</span>
        </div>
        
        <div className="gold-balance claimed">
          <span className="label">Claimed (ERC-20):</span>
          <span className="amount">{claimedGold.toLocaleString()}</span>
          <span className="hint">In your wallet</span>
        </div>
        
        <div className="gold-balance total">
          <span className="label">Total:</span>
          <span className="amount">{(unclaimedGold + claimedGold).toLocaleString()}</span>
        </div>
      </div>

      {unclaimedGold > 0 && (
        <div className="claim-section">
          <button
            onClick={handleClaim}
            disabled={!canClaim}
            className={`claim-button ${canClaim ? 'active' : 'disabled'}`}
          >
            {isClaiming ? 'Claiming...' : 'Claim Gold'}
          </button>

          {cooldownRemaining > 0 && (
            <div className="cooldown">
              Cooldown: {(cooldownRemaining / 1000).toFixed(1)}s
            </div>
          )}

          {claimError && (
            <div className="error">
              {claimError}
            </div>
          )}

          <div className="claim-info">
            <p>Claiming converts unclaimed gold into HG ERC-20 tokens in your wallet.</p>
            <p>Claimed gold can be traded, sold on marketplace, or used for purchases.</p>
            <p>Current nonce: {currentNonce?.toString() || '0'}</p>
          </div>
        </div>
      )}

      {unclaimedGold === 0 && (
        <div className="no-unclaimed">
          <p>No unclaimed gold. Kill mobs and gather resources to earn more!</p>
        </div>
      )}
    </div>
  );
}

/**
 * Styled version with Tailwind
 */
export function GoldClaimingUIStyled({
  unclaimedGold,
  claimedGold,
  hyperscapeGoldAddress,
  gameServerUrl,
  onClaimSuccess
}: GoldClaimingUIProps): JSX.Element {
  const { address } = useAccount();
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [lastClaimTime, setLastClaimTime] = useState<number>(0);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  const CLAIM_COOLDOWN_MS = 5000;

  useEffect(() => {
    const interval = setInterval(() => {
      if (lastClaimTime > 0) {
        const elapsed = Date.now() - lastClaimTime;
        const remaining = Math.max(0, CLAIM_COOLDOWN_MS - elapsed);
        setCooldownRemaining(remaining);
      } else {
        setCooldownRemaining(0);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [lastClaimTime]);

  const handleClaim = async (): Promise<void> => {
    if (!address || unclaimedGold === 0) return;

    setIsClaiming(true);
    setClaimError(null);

    const amountWei = parseEther(unclaimedGold.toString());

    const signatureResponse = await fetch(`${gameServerUrl}/api/claim-gold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerAddress: address,
        amount: amountWei.toString()
      })
    });

    if (!signatureResponse.ok) {
      const error = await signatureResponse.json();
      setClaimError(error.message || 'Failed to get signature');
      setIsClaiming(false);
      return;
    }

    const signatureData: ClaimSignatureResponse = await signatureResponse.json();

    const tx = await fetch('/api/submit-claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: signatureData.amount,
        nonce: signatureData.nonce,
        signature: signatureData.signature
      })
    });

    if (!tx.ok) {
      const error = await tx.json();
      setClaimError(error.message || 'Transaction failed');
      setIsClaiming(false);
      return;
    }

    setLastClaimTime(Date.now());
    setIsClaiming(false);

    if (onClaimSuccess) {
      onClaimSuccess(BigInt(signatureData.amount));
    }
  };

  const canClaim = unclaimedGold > 0 && !isClaiming && cooldownRemaining === 0;

  return (
    <div className="bg-gray-900 border border-yellow-600 rounded-lg p-6 max-w-md">
      <div className="flex items-center mb-4">
        <h3 className="text-xl font-bold text-yellow-400">⚜️ Hyperscape Gold</h3>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex justify-between items-center bg-gray-800 p-3 rounded">
          <span className="text-gray-400">Unclaimed</span>
          <span className="text-2xl font-bold text-yellow-400">
            {unclaimedGold.toLocaleString()} HG
          </span>
        </div>

        <div className="flex justify-between items-center bg-gray-800 p-3 rounded">
          <span className="text-gray-400">Claimed (Wallet)</span>
          <span className="text-xl font-semibold text-green-400">
            {claimedGold.toLocaleString()} HG
          </span>
        </div>

        <div className="flex justify-between items-center bg-gray-950 p-3 rounded border border-gray-700">
          <span className="text-gray-300 font-semibold">Total</span>
          <span className="text-2xl font-bold text-white">
            {(unclaimedGold + claimedGold).toLocaleString()} HG
          </span>
        </div>
      </div>

      {unclaimedGold > 0 ? (
        <div className="space-y-3">
          <button
            onClick={handleClaim}
            disabled={!canClaim}
            className={`w-full py-3 px-4 rounded-lg font-bold text-lg transition-all ${
              canClaim
                ? 'bg-yellow-600 hover:bg-yellow-500 text-black'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isClaiming ? '⏳ Claiming...' : '✨ Claim Gold'}
          </button>

          {cooldownRemaining > 0 && (
            <div className="text-center text-orange-400 text-sm">
              ⏱️ Cooldown: {(cooldownRemaining / 1000).toFixed(1)}s
            </div>
          )}

          {claimError && (
            <div className="bg-red-900 border border-red-600 text-red-200 p-3 rounded">
              ❌ {claimError}
            </div>
          )}

          <div className="text-xs text-gray-500 space-y-1">
            <p>💡 Claiming converts unclaimed gold into HG ERC-20 tokens.</p>
            <p>🔄 Claimed gold can be traded, sold, or used on marketplace.</p>
            <p>⚡ Rate limit: 1 claim per 5 seconds.</p>
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-4">
          <p>🎮 No unclaimed gold.</p>
          <p className="text-sm mt-2">Kill mobs and gather resources to earn more!</p>
        </div>
      )}
    </div>
  );
}

