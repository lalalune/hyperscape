import { User } from "lucide-react";
import React from "react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
} from "../common";

interface AvatarRiggingOptionsCardProps {
  characterHeight: number;
  onCharacterHeightChange: (height: number) => void;
}

export const AvatarRiggingOptionsCard: React.FC<
  AvatarRiggingOptionsCardProps
> = ({ characterHeight, onCharacterHeightChange }) => {
  return (
    <Card className="animate-fade-in shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Rigging Options
        </CardTitle>
        <CardDescription>Configure character rigging</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary">
            Character Height (meters)
          </label>
          <Input
            type="number"
            value={characterHeight}
            onChange={(e) =>
              onCharacterHeightChange(parseFloat(e.target.value) || 1.7)
            }
            min="0.5"
            max="3.0"
            step="0.1"
            className="w-full"
          />
          <p className="text-xs text-text-tertiary">
            Standard human height is 1.7m
          </p>
        </div>

        <div className="p-3 bg-bg-tertiary rounded-lg space-y-2">
          <p className="text-sm font-medium text-text-primary">
            Included Animations:
          </p>
          <ul className="text-sm text-text-secondary space-y-1">
            <li className="flex items-center gap-2">
              <span className="text-primary">•</span>
              Walking animation
            </li>
            <li className="flex items-center gap-2">
              <span className="text-primary">•</span>
              Running animation
            </li>
          </ul>
        </div>

        <div className="p-3 bg-warning bg-opacity-10 border border-warning border-opacity-20 rounded-lg">
          <p className="text-xs text-warning">
            ⚠️ Auto-rigging works best with humanoid characters that have
            clearly defined limbs
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AvatarRiggingOptionsCard;
