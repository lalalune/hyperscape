import { Move } from "lucide-react";
import React from "react";

import { cn } from "../../styles";
import { RangeInput, Button } from "../common";

interface PositionControlsProps {
  manualPosition: { x: number; y: number; z: number };
  onPositionChange: (position: { x: number; y: number; z: number }) => void;
  selectedEquipment: { hasModel: boolean } | null;
}

export const PositionControls: React.FC<PositionControlsProps> = ({
  manualPosition,
  onPositionChange,
  selectedEquipment,
}) => {
  if (!selectedEquipment?.hasModel) return null;

  return (
    <div className="bg-bg-primary/40 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-lg">
            <Move className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Fine-tune Position
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Adjust weapon position relative to hand
            </p>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-4">
        {[
          { axis: "x", label: "Left/Right", color: "text-red-400" },
          { axis: "y", label: "Up/Down", color: "text-green-400" },
          { axis: "z", label: "Forward/Back", color: "text-blue-400" },
        ].map(({ axis, label, color }) => (
          <div key={axis}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-text-primary flex items-center gap-2">
                <span className={cn("text-xs uppercase font-bold", color)}>
                  {axis}
                </span>
                {label}
              </span>
              <span className="text-sm font-mono text-text-primary">
                {manualPosition[axis as keyof typeof manualPosition].toFixed(3)}
                m
              </span>
            </div>
            <RangeInput
              type="range"
              min="-0.2"
              max="0.2"
              step="0.001"
              value={manualPosition[axis as keyof typeof manualPosition]}
              onChange={(e) =>
                onPositionChange({
                  ...manualPosition,
                  [axis]: Number(e.target.value),
                })
              }
            />
          </div>
        ))}

        <Button
          size="sm"
          variant="secondary"
          onClick={() => onPositionChange({ x: 0, y: 0, z: 0 })}
          className="w-full mt-2 gap-2"
        >
          <Move size={16} />
          Reset Position
        </Button>
      </div>
    </div>
  );
};
