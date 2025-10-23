import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseAbi } from 'viem';

const ITEMS_ABI = parseAbi([
  'function mintItem(uint256 itemId, uint256 amount, bytes32 instanceId, bytes signature) external',
  'function checkInstance(bytes32 instanceId) view returns (bool isMinted, address originalMinter)',
]);

interface MintItemButtonProps {
  itemId: number;
  amount: number;
  slot: number;
  onMintSuccess?: () => void;
}

export function MintItemButton({ itemId, amount, slot, onMintSuccess }: MintItemButtonProps) {
  const { address } = useAccount();
  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState<string>();

  const { writeContract, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleMint = async () => {
    if (!address) return;
    
    setIsMinting(true);
    setError(undefined);

    // 1. Get signature from server
    const response = await fetch('/api/mint-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot, itemId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      setError(errorData.error || 'Failed to get mint signature');
      setIsMinting(false);
      return;
    }

    const { signature, instanceId, itemId: responseItemId, amount: responseAmount } = await response.json();

    // 2. Call Items.mintItem()
    const itemsContract = (process.env.NEXT_PUBLIC_ITEMS_CONTRACT || '0x5FbDB2315678afecb367f032d93F642f64180aa3') as `0x${string}`;
    
    writeContract({
      address: itemsContract,
      abi: ITEMS_ABI,
      functionName: 'mintItem',
      args: [BigInt(responseItemId), BigInt(responseAmount), instanceId as `0x${string}`, signature as `0x${string}`],
    });
  };

  // Handle success
  if (isSuccess && onMintSuccess) {
    onMintSuccess();
  }

  if (error) {
    return (
      <div className="text-red-500 text-sm">
        {error}
        <button onClick={handleMint} className="ml-2 underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleMint}
      disabled={isMinting || isConfirming}
      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded text-sm flex items-center gap-1"
      data-testid="mint-item-button"
    >
      {isMinting || isConfirming ? (
        <>
          <span className="animate-spin">⏳</span>
          Minting...
        </>
      ) : (
        <>
          <span>🔒</span>
          Mint to NFT
        </>
      )}
    </button>
  );
}

