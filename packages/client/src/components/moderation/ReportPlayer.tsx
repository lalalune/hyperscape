import React, { useState } from "react";
import { X, AlertTriangle, Shield, Flag, Loader2, Check } from "lucide-react";

type ReportType = "GAME_VIOLATION" | "SCAMMER" | "HACKER" | "CSAM";

type ReportTypeInfo = {
  id: ReportType;
  label: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  icon: React.ReactNode;
};

const REPORT_TYPES: ReportTypeInfo[] = [
  {
    id: "GAME_VIOLATION",
    label: "Game Violation",
    description: "Cheating, exploiting, harassment, or spam",
    severity: "low",
    icon: <Flag className="w-5 h-5" />,
  },
  {
    id: "SCAMMER",
    label: "Scammer",
    description: "Attempted to scam or defraud players",
    severity: "medium",
    icon: <AlertTriangle className="w-5 h-5" />,
  },
  {
    id: "HACKER",
    label: "Hacker",
    description: "Using exploits or third-party software",
    severity: "high",
    icon: <Shield className="w-5 h-5" />,
  },
  {
    id: "CSAM",
    label: "Illegal Content",
    description: "Posting illegal or extremely harmful content",
    severity: "critical",
    icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
  },
];

interface ReportPlayerProps {
  targetPlayerId: string;
  targetPlayerName: string;
  targetAgentId?: number;
  onClose: () => void;
  onSubmit?: (report: {
    targetPlayerId: string;
    targetAgentId?: number;
    reportType: ReportType;
    details: string;
    evidenceHash?: string;
  }) => Promise<void>;
}

export default function ReportPlayer({
  targetPlayerId,
  targetPlayerName,
  targetAgentId,
  onClose,
  onSubmit,
}: ReportPlayerProps) {
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedType || !details.trim()) {
      setError("Please select a report type and provide details");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    if (onSubmit) {
      await onSubmit({
        targetPlayerId,
        targetAgentId,
        reportType: selectedType,
        details: details.trim(),
      });
      setSubmitted(true);
      setTimeout(onClose, 2000);
    } else {
      // Fallback to network request
      const response = await fetch("/api/moderation/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetPlayerId,
          targetAgentId,
          reportType: selectedType,
          details: details.trim(),
        }),
      });

      if (response.ok) {
        setSubmitted(true);
        setTimeout(onClose, 2000);
      } else {
        setError("Failed to submit report. Please try again.");
      }
    }

    setIsSubmitting(false);
  };

  const selectedTypeInfo = REPORT_TYPES.find((t) => t.id === selectedType);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-md bg-[#1a1005] border border-[#8b4513]/50 rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#2d1a0a] to-[#1a1005] border-b border-[#8b4513]/30">
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-[#f2d08a]" />
            <h2 className="text-lg font-bold text-[#f2d08a]">Report Player</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#8b4513]/20 transition-colors"
          >
            <X className="w-5 h-5 text-[#f2d08a]/60" />
          </button>
        </div>

        {submitted ? (
          /* Success State */
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-[#f2d08a] mb-2">
              Report Submitted
            </h3>
            <p className="text-[#f2d08a]/60">
              Thank you for helping keep Hyperscape safe.
            </p>
          </div>
        ) : (
          /* Form */
          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Target Player */}
            <div className="px-3 py-2 bg-[#2d1a0a]/50 rounded border border-[#8b4513]/20">
              <span className="text-sm text-[#f2d08a]/60">Reporting:</span>
              <span className="ml-2 font-medium text-[#f2d08a]">
                {targetPlayerName}
              </span>
            </div>

            {/* Report Type Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#f2d08a]/80">
                Report Type
              </label>
              <div className="grid grid-cols-1 gap-2">
                {REPORT_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${
                      selectedType === type.id
                        ? "bg-[#f2d08a]/10 border-[#f2d08a]/50"
                        : "bg-[#2d1a0a]/30 border-[#8b4513]/20 hover:border-[#8b4513]/40"
                    }`}
                  >
                    <div
                      className={`mt-0.5 ${
                        selectedType === type.id
                          ? "text-[#f2d08a]"
                          : "text-[#f2d08a]/40"
                      }`}
                    >
                      {type.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-medium ${
                            selectedType === type.id
                              ? "text-[#f2d08a]"
                              : "text-[#f2d08a]/80"
                          }`}
                        >
                          {type.label}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            type.severity === "critical"
                              ? "bg-red-500/20 text-red-400"
                              : type.severity === "high"
                                ? "bg-orange-500/20 text-orange-400"
                                : type.severity === "medium"
                                  ? "bg-yellow-500/20 text-yellow-400"
                                  : "bg-blue-500/20 text-blue-400"
                          }`}
                        >
                          {type.severity}
                        </span>
                      </div>
                      <p className="text-sm text-[#f2d08a]/50 mt-0.5">
                        {type.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Details */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#f2d08a]/80">
                Details
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe what happened..."
                rows={4}
                className="w-full px-3 py-2 bg-[#2d1a0a]/50 border border-[#8b4513]/30 rounded-lg text-[#f2d08a] placeholder-[#f2d08a]/30 resize-none focus:outline-none focus:border-[#f2d08a]/50"
              />
              <p className="text-xs text-[#f2d08a]/40">
                {selectedTypeInfo?.severity === "critical" ||
                selectedTypeInfo?.severity === "high"
                  ? "This report will be escalated to network-wide moderation."
                  : "This report will be reviewed by Hyperscape moderators."}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-[#8b4513]/30 rounded-lg text-[#f2d08a]/60 hover:bg-[#8b4513]/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedType || !details.trim() || isSubmitting}
                className="flex-1 px-4 py-2 bg-[#f2d08a] text-[#1a1005] font-medium rounded-lg hover:bg-[#f2d08a]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Report"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
