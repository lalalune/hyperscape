import {
  RotateCw,
  Eye,
  EyeOff,
  Grid,
  Sun,
  Moon,
  Palette,
  RefreshCw,
  X,
  Layers,
  Camera,
  Edit3,
  Activity,
  Grid3x3,
} from "lucide-react";
import React from "react";

import { useAssetsStore } from "../../store";

interface ViewerControlsProps {
  onViewerReset: () => void;
  onDownload: () => void;
  assetType?: string;
  canRetexture?: boolean;
  hasRigging?: boolean;
}

const ViewerControls: React.FC<ViewerControlsProps> = ({
  onViewerReset,
  onDownload,
  assetType,
  canRetexture = true,
  hasRigging = false,
}) => {
  // Get state and actions from store
  const {
    isWireframe,
    showGroundPlane,
    isLightBackground,
    showDetailsPanel,
    showAnimationView,
    toggleWireframe,
    toggleGroundPlane,
    toggleBackground,
    toggleDetailsPanel,
    toggleAnimationView,
    setShowRetextureModal,
    setShowRegenerateModal,
    setShowEditModal,
    setShowSpriteModal,
  } = useAssetsStore();

  return (
    <>
      {/* Top-left controls - Model Actions */}
      <div className="absolute top-4 left-4 flex gap-2 animate-fade-in">
        {canRetexture && (
          <button
            onClick={() => setShowRetextureModal(true)}
            className="px-4 py-2 bg-primary bg-opacity-90 hover:bg-opacity-100 text-white rounded-lg shadow-lg transition-all duration-300 flex items-center gap-2 ease-out"
            title="Create texture variants"
          >
            <Palette size={16} />
            <span className="text-sm font-medium">Retexture</span>
          </button>
        )}

        <button
          onClick={() => setShowRegenerateModal(true)}
          className="px-5 py-4 bg-bg-secondary bg-opacity-90 hover:bg-bg-tertiary text-text-primary rounded-lg shadow-lg transition-all duration-300 flex items-center gap-2 border border-border-primary ease-out"
          title="Regenerate model"
        >
          <RefreshCw size={16} />
          <span className="text-sm font-medium">Regenerate</span>
        </button>

        <button
          onClick={() => setShowSpriteModal(true)}
          className="px-5 py-4 bg-bg-secondary bg-opacity-90 hover:bg-bg-tertiary text-text-primary rounded-lg shadow-lg transition-all duration-300 flex items-center gap-2 border border-border-primary ease-out"
          title="Generate sprite sheet"
        >
          <Grid3x3 size={16} />
          <span className="text-sm font-medium">Sprites</span>
        </button>
      </div>

      {/* Top-right controls - View Options */}
      <div className="absolute top-4 right-4 flex gap-2 animate-fade-in">
        {/* Animation Toggle - Only for character assets with rigging */}
        {assetType === "character" && hasRigging && (
          <button
            onClick={toggleAnimationView}
            className={`group p-3 bg-bg-secondary bg-opacity-90 rounded-xl transition-all duration-300 hover:bg-bg-tertiary shadow-lg ${
              showAnimationView ? "ring-1 ring-primary/40" : ""
            } ease-out`}
            title={showAnimationView ? "View 3D Model" : "View Animations"}
          >
            <Activity
              size={20}
              className={`transition-colors ${
                showAnimationView
                  ? "text-primary"
                  : "text-text-secondary group-hover:text-primary"
              } ease-out`}
            />
          </button>
        )}

        {/* Edit Button */}
        <button
          onClick={() => setShowEditModal(true)}
          className="group p-3 bg-bg-secondary bg-opacity-90 rounded-xl transition-all duration-300 hover:bg-bg-tertiary shadow-lg ease-out"
          title="Edit Asset"
        >
          <Edit3
            size={20}
            className="text-text-secondary group-hover:text-primary transition-colors ease-out"
          />
        </button>

        <div className="flex bg-bg-secondary bg-opacity-90 rounded-lg shadow-lg p-1 border border-border-primary">
          <button
            onClick={toggleWireframe}
            className={`p-2 rounded transition-all duration-300 ${
              isWireframe
                ? "bg-primary bg-opacity-20 text-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            } ease-out`}
            title="Toggle Wireframe (W)"
          >
            {isWireframe ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>

          <button
            onClick={toggleGroundPlane}
            className={`p-2 rounded transition-all duration-300 ${
              showGroundPlane
                ? "bg-primary bg-opacity-20 text-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            } ease-out`}
            title="Toggle Ground Plane (G)"
          >
            <Grid size={18} />
          </button>

          <button
            onClick={toggleBackground}
            className={`p-2 rounded transition-all duration-300 ${
              isLightBackground
                ? "bg-warning bg-opacity-20 text-warning"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            } ease-out`}
            title="Toggle Background (B)"
          >
            {isLightBackground ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="flex bg-bg-secondary bg-opacity-90 rounded-lg shadow-lg p-1 border border-border-primary">
          <button
            onClick={onViewerReset}
            className="p-2 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all duration-300 ease-out"
            title="Reset Camera (R)"
          >
            <RotateCw size={18} />
          </button>

          <button
            onClick={onDownload}
            className="p-2 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all duration-300 ease-out"
            title="Screenshot (S)"
          >
            <Camera size={18} />
          </button>

          <button
            onClick={toggleDetailsPanel}
            className={`p-2 rounded transition-all duration-300 ${
              showDetailsPanel
                ? "bg-primary bg-opacity-20 text-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            } ease-out`}
            title="Toggle Details (D)"
          >
            {showDetailsPanel ? <X size={18} /> : <Layers size={18} />}
          </button>
        </div>
      </div>
    </>
  );
};

export default ViewerControls;
