import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseAbi, formatEther } from 'viem';

const GOLD_ABI = parseAbi([
  'function claimGold(uint256 amount, uint256 nonce, bytes signature) external',
  'function getNonce(address player) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
]);

interface GoldClaimButtonProps {
  mudCoinsAmount: bigint;
  mudCoinsClaimed: bigint;
  onClaimSuccess?: () => void;
}

export function GoldClaimButton({ mudCoinsAmount, mudCoinsClaimed, onClaimSuccess }: GoldClaimButtonProps) {
  const { address } = useAccount();
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<string>();

  const unclaimedAmount = mudCoinsAmount - mudCoinsClaimed;
  const goldContract = (process.env.NEXT_PUBLIC_GOLD_CONTRACT || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512') as `0x${string}`;

  const { data: goldBalance } = useReadContract({
    address: goldContract,
    abi: GOLD_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const { writeContract, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleClaim = async () => {
    if (!address || unclaimedAmount === 0n) return;

    setIsClaiming(true);
    setError(undefined);

    // 1. Get signature from server
    const response = await fetch('/api/claim-gold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorData = await response.json();
      setError(errorData.error || 'Failed to get claim signature');
      setIsClaiming(false);
      return;
    }

    const { signature, amount, nonce } = await response.json();

    // 2. Call Gold.claimGold()
    writeContract({
      address: goldContract,
      abi: GOLD_ABI,
      functionName: 'claimGold',
      args: [BigInt(amount), BigInt(nonce), signature as `0x${string}`],
    });
  };

  // Handle success
  useEffect(() => {
    if (isSuccess && onClaimSuccess) {
      onClaimSuccess();
      setIsClaiming(false);
    }
  }, [isSuccess, onClaimSuccess]);

  if (unclaimedAmount === 0n) {
    return (
      <div className="text-gray-400 text-sm" data-testid="no-unclaimed-gold">
        No unclaimed Gold
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm">
        <div>MUD Coins: {formatEther(mudCoinsAmount)}</div>
        <div>Claimed Gold: {formatEther(mudCoinsClaimed)}</div>
        <div className="font-bold" data-testid="claimable-amount">
          Claimable: {formatEther(unclaimedAmount)} Gold
        </div>
        {goldBalance !== undefined && (
          <div data-testid="gold-balance">Gold Balance: {formatEther(goldBalance)}</div>
        )}
      </div>

      {error && (
        <div className="text-red-500 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleClaim}
        disabled={isClaiming || isConfirming || unclaimedAmount === 0n}
        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white rounded font-medium"
        data-testid="claim-gold-button"
      >
        {isClaiming || isConfirming ? (
          <>
            <span className="animate-spin inline-block mr-2">⏳</span>
            Claiming...
          </>
        ) : (
          <>Claim {formatEther(unclaimedAmount)} Gold</>
        )}
      </button>
    </div>
  );
}

