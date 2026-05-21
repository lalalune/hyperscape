import { Box, Download } from "lucide-react";
import React from "react";

import { GeneratedAsset, hasAnimations } from "../../types";
import { getAssetModelUrl } from "../../utils/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../common";
import { AnimationPlayer } from "../shared/AnimationPlayer";
import ThreeViewer from "../shared/ThreeViewer";

interface AssetPreviewCardProps {
  selectedAsset: GeneratedAsset | null;
  generationType: "item" | "avatar" | undefined;
}

export const AssetPreviewCard: React.FC<AssetPreviewCardProps> = ({
  selectedAsset,
  generationType,
}) => {
  if (!selectedAsset) return null;

  const hasModel =
    selectedAsset.hasModel ||
    selectedAsset.modelUrl ||
    selectedAsset.metadata?.hasModel;
  const modelUrl = selectedAsset.modelUrl || getAssetModelUrl(selectedAsset.id);

  const isRiggedAvatar =
    generationType === "avatar" &&
    selectedAsset &&
    "isRigged" in selectedAsset.metadata &&
    selectedAsset.metadata.isRigged &&
    "animations" in selectedAsset.metadata &&
    selectedAsset.metadata.animations;

  return (
    <Card className="overflow-hidden shadow-xl hover:shadow-2xl transition-shadow ease-out">
      <CardHeader>
        <CardTitle>3D Preview</CardTitle>
        <CardDescription>Interactive model viewer</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="aspect-video bg-gradient-to-br from-bg-secondary to-bg-tertiary relative">
          {hasModel ? (
            <>
              {isRiggedAvatar ? (
                <AnimationPlayer
                  modelUrl={modelUrl}
                  animations={
                    hasAnimations(selectedAsset)
                      ? selectedAsset.metadata.animations
                      : { basic: {} }
                  }
                  assetId={selectedAsset.id}
                  className="w-full h-full"
                />
              ) : (
                <ThreeViewer
                  modelUrl={modelUrl}
                  assetInfo={{
                    name: selectedAsset.name,
                    type: selectedAsset.type || "character",
                  }}
                />
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Box className="w-16 h-16 text-text-muted mx-auto mb-4" />
                <p className="text-text-secondary">No 3D model available</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      {hasModel && (
        <CardFooter className="bg-bg-secondary">
          <a
            href={modelUrl}
            download={`${selectedAsset.id}.glb`}
            className="inline-flex items-center gap-2 text-primary hover:text-primary-hover transition-colors ease-out"
          >
            <Download className="w-4 h-4" />
            Download GLB Model
          </a>
        </CardFooter>
      )}
    </Card>
  );
};

export default AssetPreviewCard;
