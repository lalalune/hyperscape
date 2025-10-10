import React from 'react'
import { cn } from '../../styles'
import { Download, Save } from 'lucide-react'
import { Asset } from '../../types'

interface ExportOptionsPanelProps {
  selectedAvatar: Asset | null
  selectedEquipment: Asset | null
  onSaveConfiguration: () => void
  onExportAlignedModel: () => void
  onExportEquippedAvatar: () => void
}

export const ExportOptionsPanel: React.FC<ExportOptionsPanelProps> = ({
  selectedAvatar,
  selectedEquipment,
  onSaveConfiguration,
  onExportAlignedModel,
  onExportEquippedAvatar
}) => {
  return (
    <div className="bg-bg-primary/40 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-lg">
            <Download className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Export Options</h3>
            <p className="text-xs text-text-secondary mt-0.5">Save your configuration</p>
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
            "hover:scale-[1.02] active:scale-[0.98]",
            (!selectedAvatar || !selectedEquipment) && "opacity-50 cursor-not-allowed"
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
              "bg-bg-secondary/50 border border-white/10 text-text-primary",
              "hover:bg-bg-secondary/70 hover:border-white/20",
              (!selectedEquipment) && "opacity-50 cursor-not-allowed"
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
              "bg-bg-secondary/50 border border-white/10 text-text-primary",
              "hover:bg-bg-secondary/70 hover:border-white/20",
              (!selectedAvatar || !selectedEquipment) && "opacity-50 cursor-not-allowed"
            )}
          >
            <Download size={14} />
            <span>Export Avatar</span>
          </button>
        </div>
      </div>
    </div>
  )
} 