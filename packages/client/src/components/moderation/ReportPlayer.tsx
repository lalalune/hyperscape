/**
 * In-Game Player Reporting Component
 * Allows reporting other players from within Hyperscape
 *
 * IMPLEMENTATION STATUS: Structure defined, integration TODO
 * WORKAROUND: Players can report via Gateway (https://gateway.jeju.network/moderation)
 */

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
export default function ReportPlayer({
  targetPlayerId,
  targetPlayerName,
  onClose,
}: ReportPlayerProps) {
  // TODO: Add state management for report form when implementing full feature
  // const [reason, setReason] = useState('');
  // const [screenshot, setScreenshot] = useState<Blob | null>(null);
  // const handleCaptureScreenshot = () => { ... };
  // const handleSubmit = async () => { ... };

  return (
    <div className="report-modal">
      <h2>Report Player: {targetPlayerName}</h2>
      <p>This feature redirects to Gateway for now.</p>
      <button
        onClick={() => {
          window.open(
            `https://gateway.jeju.network/moderation/report?target=${targetPlayerId}`,
            "_blank",
          );
          onClose();
        }}
      >
        Report via Gateway
      </button>
    </div>
  );
}
