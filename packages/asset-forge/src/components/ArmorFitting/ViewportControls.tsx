import { Grid3X3, Camera } from "lucide-react";
import React from "react";

import { cn } from "../../styles";

interface ViewportControlsProps {
  showWireframe: boolean;
  onToggleWireframe: () => void;
  onResetCamera: () => void;
}

export const ViewportControls: React.FC<ViewportControlsProps> = ({
  showWireframe,
  onToggleWireframe,
  onResetCamera,
}) => {
  return (
    <div className="absolute top-4 right-4 flex flex-col gap-2">
      <button
        onClick={onToggleWireframe}
        className={cn(
          "p-2 rounded-lg transition-all",
          showWireframe
            ? "bg-primary/20 text-primary"
            : "bg-bg-tertiary text-text-secondary hover:text-text-primary",
        )}
        title="Toggle wireframe"
      >
        <Grid3X3 size={18} />
      </button>
      <button
        onClick={onResetCamera}
        className="p-2 rounded-lg bg-bg-tertiary text-text-secondary hover:text-text-primary transition-all ease-out"
        title="Reset camera"
      >
        <Camera size={18} />
      </button>
    </div>
  );
};

export default ViewportControls;
