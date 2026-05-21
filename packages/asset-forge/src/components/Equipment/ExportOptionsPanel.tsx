import { Download, Save, Copy, Layers } from "lucide-react";
import React from "react";

import { cn } from "../../styles";
import { Asset } from "../../types";

interface ExportOptionsPanelProps {
  selectedAvatar: Asset | null;
  selectedEquipment: Asset | null;
  onSaveConfiguration: () => void;
  onExportAlignedModel: () => void;
  onExportEquippedAvatar: () => void;
  assets?: Asset[];
  onBatchApplyFitting?: () => void;
  onBatchExportAligned?: () => void;
}

export const ExportOptionsPanel: React.FC<ExportOptionsPanelProps> = ({
  selectedAvatar,
  selectedEquipment,
  onSaveConfiguration,
  onExportAlignedModel,
  onExportEquippedAvatar,
  assets = [],
  onBatchApplyFitting,
  onBatchExportAligned,
}) => {
  // Count same-subtype weapons for batch operations
  const selectedSubtype = selectedEquipment?.metadata?.subtype as
    | string
    | undefined;
  const sameSubtypeCount = React.useMemo(() => {
    if (!selectedEquipment || !selectedSubtype) return 0;
    return assets.filter(
      (a) =>
        a.type === "weapon" &&
        (a.metadata?.subtype as string) === selectedSubtype &&
        a.id !== selectedEquipment.id &&
        a.hasModel,
    ).length;
  }, [assets, selectedEquipment, selectedSubtype]);

  const hasFitting = selectedEquipment && selectedAvatar;

  const canBatch = hasFitting && sameSubtypeCount > 0;

  const subtypeLabel = selectedSubtype
    ? selectedSubtype.replace(/_/g, " ")
    : "";
  return (
    <div className="bg-bg-primary/40 rounded-xl border border-border-primary overflow-hidden">
      <div className="p-4 border-b border-border-primary">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-lg">
            <Download className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Export Options
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Save your configuration
            </p>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <button
          onClick={onSaveConfiguration}
          disabled={!selectedAvatar || !selectedEquipment}
          className={cn(
            "w-full px-4 py-3 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2",
            "bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg hover:shadow-xl",
            " ",
            (!selectedAvatar || !selectedEquipment) &&
              "opacity-50 cursor-not-allowed",
          )}
        >
          <Save size={16} />
          <span>Save Configuration</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onExportAlignedModel}
            disabled={!selectedEquipment}
            className={cn(
              "px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2",
              "bg-bg-secondary/50 border border-border-primary text-text-primary",
              "hover:bg-bg-secondary/70 hover:border-border-secondary",
              !selectedEquipment && "opacity-50 cursor-not-allowed",
            )}
          >
            <Download size={14} />
            <span>Export Equipment</span>
          </button>

          <button
            onClick={onExportEquippedAvatar}
            disabled={!selectedAvatar || !selectedEquipment}
            className={cn(
              "px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2",
              "bg-bg-secondary/50 border border-border-primary text-text-primary",
              "hover:bg-bg-secondary/70 hover:border-border-secondary",
              (!selectedAvatar || !selectedEquipment) &&
                "opacity-50 cursor-not-allowed",
            )}
          >
            <Download size={14} />
            <span>Export Avatar</span>
          </button>
        </div>

        {/* Batch operations */}
        {selectedSubtype && sameSubtypeCount > 0 && (
          <div className="pt-3 border-t border-border-primary space-y-2">
            <p className="text-xs text-text-tertiary">
              Batch ({sameSubtypeCount} other {subtypeLabel}
              {sameSubtypeCount !== 1 ? "s" : ""})
            </p>
            <button
              onClick={onBatchApplyFitting}
              disabled={!canBatch}
              className={cn(
                "w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2",
                "bg-amber-500/20 border border-amber-500/30 text-amber-300",
                "hover:bg-amber-500/30 hover:border-amber-500/40",
                !canBatch && "opacity-50 cursor-not-allowed",
              )}
            >
              <Copy size={14} />
              <span>Apply Fitting to All {subtypeLabel}s</span>
            </button>
            <button
              onClick={onBatchExportAligned}
              disabled={!canBatch}
              className={cn(
                "w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2",
                "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300",
                "hover:bg-emerald-500/30 hover:border-emerald-500/40",
                !canBatch && "opacity-50 cursor-not-allowed",
              )}
            >
              <Layers size={14} />
              <span>Review & Export All {subtypeLabel}s</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
