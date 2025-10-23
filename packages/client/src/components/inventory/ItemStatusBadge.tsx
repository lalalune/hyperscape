import { useEffect, useState } from 'react';
import { type Address, parseAbi } from 'viem';
import { useReadContract } from 'wagmi';

const ITEMS_ABI = parseAbi([
  'function checkInstance(bytes32 instanceId) view returns (bool isMinted, address originalMinter)',
]);

interface ItemStatusBadgeProps {
  instanceId: `0x${string}`;
  itemsContract: Address;
}

export function ItemStatusBadge({ instanceId, itemsContract }: ItemStatusBadgeProps) {
  const { data, isLoading } = useReadContract({
    address: itemsContract,
    abi: ITEMS_ABI,
    functionName: 'checkInstance',
    args: [instanceId],
  });

  if (isLoading) {
    return <span className="text-xs text-gray-400">Checking...</span>;
  }

  if (!data) {
    return null;
  }

  const [isMinted, originalMinter] = data;

  if (isMinted) {
    return (
      <div className="flex flex-col gap-1" data-testid="item-status">
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-900/50 text-green-300 rounded text-xs font-medium">
          <span>🔒</span>
          <span>Permanent NFT</span>
        </span>
        {originalMinter && (
          <span className="text-xs text-gray-400">
            Minted by {originalMinter.slice(0, 6)}...{originalMinter.slice(-4)}
          </span>
        )}
      </div>
    );
  }

  return (
    <span 
      className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-900/50 text-yellow-300 rounded text-xs font-medium"
      data-testid="item-status"
    >
      <span>⚠️</span>
      <span>Droppable</span>
    </span>
  );
}

