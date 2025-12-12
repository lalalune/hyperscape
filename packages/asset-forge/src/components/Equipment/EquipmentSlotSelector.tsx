import { Target } from "lucide-react";
import React from "react";

import { EQUIPMENT_SLOTS } from "../../constants";
import { cn } from "../../styles";

interface EquipmentSlotSelectorProps {
  equipmentSlot: string;
  onSlotChange: (slot: string) => void;
}

export const EquipmentSlotSelector: React.FC<EquipmentSlotSelectorProps> = ({
  equipmentSlot,
  onSlotChange,
}) => {
  // Filter to only show weapon slots (Right Hand and Left Hand)
  const weaponSlots = EQUIPMENT_SLOTS.filter(
    (slot) => slot.id === "Hand_R" || slot.id === "Hand_L",
  );

  return (
    <div className="bg-bg-primary/40 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-lg">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Equipment Slot
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Choose where to attach the equipment
            </p>
          </div>
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-2">
          {weaponSlots.map((slot) => {
            const Icon = slot.icon;
            return (
              <button
                key={slot.id}
                onClick={() => onSlotChange(slot.id)}
                className={cn(
                  "p-3 rounded-lg border transition-all duration-200 flex flex-col items-center gap-1.5",
                  equipmentSlot === slot.id
                    ? "bg-primary/10 border-primary"
                    : "bg-bg-secondary/40 border-white/10 hover:border-white/20",
                )}
              >
                <div
                  className={cn(
                    equipmentSlot === slot.id
                      ? "text-primary"
                      : "text-text-secondary",
                  )}
                >
                  <Icon size={20} />
                </div>
                <span
                  className={cn(
                    "text-xs font-medium",
                    equipmentSlot === slot.id
                      ? "text-primary"
                      : "text-text-primary",
                  )}
                >
                  {slot.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
