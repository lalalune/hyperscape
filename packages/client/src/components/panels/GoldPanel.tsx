import React from 'react'
import { GoldClaimButton } from '../economy/GoldClaimButton'

interface GoldPanelProps {
  coins: number
  claimed?: number
}

export function GoldPanel({ coins, claimed = 0 }: GoldPanelProps) {
  return (
    <div className="bg-black/35 border rounded-md p-3" style={{ borderColor: 'rgba(242, 208, 138, 0.3)' }} data-testid="gold-panel">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-bold" style={{ color: '#f2d08a' }}>Gold</h3>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-xs" style={{ color: '#f2d08a' }}>
          <span>In-Game Coins:</span>
          <span className="font-bold" data-testid="gold-ingame">{coins.toLocaleString()}</span>
        </div>
        
        <div className="flex justify-between text-xs" style={{ color: '#f2d08a' }}>
          <span>Claimed ERC-20:</span>
          <span className="font-bold" data-testid="gold-claimed">{claimed.toLocaleString()}</span>
        </div>
        
        <div className="flex justify-between text-xs" style={{ color: '#f2d08a' }}>
          <span>Claimable:</span>
          <span className="font-bold" data-testid="gold-claimable">{(coins - claimed).toLocaleString()}</span>
        </div>
        
        <div className="mt-3">
          <GoldClaimButton 
            mudCoinsAmount={BigInt(coins)}
            mudCoinsClaimed={BigInt(claimed)}
          />
        </div>
      </div>
    </div>
  )
}

