/**
 * In-Game Player Reporting Component
 * Allows reporting other players from within Hyperscape
 * 
 * IMPLEMENTATION STATUS: Structure defined, integration TODO
 * WORKAROUND: Players can report via Gateway (https://gateway.jeju.network/moderation)
 */

import { useState } from 'react';

interface ReportPlayerProps {
  targetPlayerId: string;
  targetPlayerName: string;
  onClose: () => void;
}

/**
 * Report player modal (shown via right-click menu or /report command)
 * 
 * TODO: Full implementation requires:
 * 1. Screenshot capture API
 * 2. IPFS upload from client
 * 3. Transaction signing in-game
 * 4. Report status tracking
 * 
 * Estimated: 8 hours for full implementation
 */
export default function ReportPlayer({ targetPlayerId, targetPlayerName, onClose }: ReportPlayerProps) {
  const [reason, setReason] = useState('');
  const [screenshot, setScreenshot] = useState<Blob | null>(null);

  const handleCaptureScreenshot = () => {
    // TODO: Use Hyperscape screenshot API
    // Implementation:
    // 1. Call world.renderer.captureScreenshot()
    // 2. Convert to Blob
    // 3. Store in state
    console.log('Capture screenshot - TODO');
  };

  const handleSubmit = async () => {
    // TODO: Submit report to ReportingSystem
    // Implementation:
    // 1. Upload screenshot to IPFS
    // 2. Get target player's agentId from database
    // 3. Call ReportingSystem.submitReport()
    // 4. Show success/error message
    console.log('Submit report - TODO');
  };

  return (
    <div className="report-modal">
      <h2>Report Player: {targetPlayerName}</h2>
      <p>This feature redirects to Gateway for now.</p>
      <button onClick={() => {
        window.open(`https://gateway.jeju.network/moderation/report?target=${targetPlayerId}`, '_blank');
        onClose();
      }}>
        Report via Gateway
      </button>
    </div>
  );
}

