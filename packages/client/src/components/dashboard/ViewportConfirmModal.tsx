import React, { useState } from "react";
import { Monitor, X } from "lucide-react";

interface ViewportConfirmModalProps {
  agentName: string;
  onConfirm: (dontAskAgain: boolean) => void;
  onCancel: () => void;
}

export const ViewportConfirmModal: React.FC<ViewportConfirmModalProps> = ({
  agentName,
  onConfirm,
  onCancel,
}) => {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0b0a15] border-2 border-[#f2d08a]/30 rounded-lg shadow-2xl max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#8b4513]/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#f2d08a]/10 flex items-center justify-center">
              <Monitor className="text-[#f2d08a]" size={20} />
            </div>
            <h2 className="text-xl font-bold text-[#f2d08a]">
              Start 3D Viewport?
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="text-[#e8ebf4]/40 hover:text-[#f2d08a] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-[#e8ebf4]/80 leading-relaxed">
            Do you want to start the 3D viewport for{" "}
            <span className="font-semibold text-[#f2d08a]">{agentName}</span>?
          </p>
          <p className="text-sm text-[#e8ebf4]/60">
            The viewport shows a live view of your agent in the game world. You
            can control multiple agents without starting viewports.
          </p>

          {/* Don't ask again checkbox */}
          <label className="flex items-center gap-3 p-3 rounded-lg bg-[#f2d08a]/5 border border-[#f2d08a]/20 cursor-pointer hover:bg-[#f2d08a]/10 transition-colors">
            <input
              type="checkbox"
              checked={dontAskAgain}
              onChange={(e) => setDontAskAgain(e.target.checked)}
              className="w-4 h-4 rounded border-[#f2d08a]/40 text-[#f2d08a] focus:ring-2 focus:ring-[#f2d08a]/50 bg-[#0b0a15] cursor-pointer"
            />
            <span className="text-sm text-[#e8ebf4]/80">
              Don't ask me again (always start viewport)
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-6 border-t border-[#8b4513]/30 bg-[#f2d08a]/5">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg border border-[#8b4513]/30 text-[#e8ebf4]/80 hover:text-[#f2d08a] hover:border-[#f2d08a]/50 hover:bg-[#f2d08a]/5 transition-all font-medium"
          >
            Start Without Viewport
          </button>
          <button
            onClick={() => onConfirm(dontAskAgain)}
            className="flex-1 px-4 py-2.5 rounded-lg bg-[#f2d08a] text-[#0b0a15] hover:bg-[#e5c07b] transition-colors font-bold shadow-lg shadow-[#f2d08a]/20"
          >
            Start Viewport
          </button>
        </div>
      </div>
    </div>
  );
};
