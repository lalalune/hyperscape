import { Undo, Redo } from "lucide-react";
import React from "react";

import { cn } from "../../styles";

interface UndoRedoControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export const UndoRedoControls: React.FC<UndoRedoControlsProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
  return (
    <div className="absolute top-4 left-4 flex gap-2">
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={cn(
          "p-2 rounded-lg backdrop-blur-sm transition-all",
          canUndo
            ? "bg-bg-tertiary/50 text-text-secondary hover:text-text-primary"
            : "bg-bg-tertiary/20 text-text-muted cursor-not-allowed",
        )}
        title="Undo (Ctrl+Z)"
      >
        <Undo size={18} />
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={cn(
          "p-2 rounded-lg backdrop-blur-sm transition-all",
          canRedo
            ? "bg-bg-tertiary/50 text-text-secondary hover:text-text-primary"
            : "bg-bg-tertiary/20 text-text-muted cursor-not-allowed",
        )}
        title="Redo (Ctrl+Y)"
      >
        <Redo size={18} />
      </button>
    </div>
  );
};

export default UndoRedoControls;
