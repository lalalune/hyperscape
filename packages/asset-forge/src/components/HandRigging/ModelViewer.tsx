import { Box, Eye, Download, Hand, Package } from "lucide-react";
import React from "react";

import { cn } from "../../styles";
import type { Asset } from "../../types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
} from "../common";
import ThreeViewer, { ThreeViewerRef } from "../shared/ThreeViewer";

interface ModelViewerProps {
  modelUrl: string | null;
  selectedAvatar: Asset | null;
  showSkeleton: boolean;
  canExport: boolean;
  leftHandData: { bonesAdded: number } | null;
  rightHandData: { bonesAdded: number } | null;
  processingStage: string;
  viewerRef: React.RefObject<ThreeViewerRef>;
  onToggleSkeleton: () => void;
  onExport: () => void;
  onModelLoad: (info: {
    vertices: number;
    faces: number;
    materials: number;
  }) => void;
}

export const ModelViewer: React.FC<ModelViewerProps> = ({
  modelUrl,
  selectedAvatar,
  showSkeleton,
  canExport,
  leftHandData,
  rightHandData,
  processingStage,
  viewerRef,
  onToggleSkeleton,
  onExport,
  onModelLoad,
}) => {
  return (
    <Card className={cn("h-[700px] overflow-hidden", "animate-scale-in")}>
      <CardHeader className="bg-gradient-to-r from-bg-secondary to-bg-tertiary">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Box className="w-5 h-5 text-primary" />
              3D Model Preview
            </CardTitle>
            <CardDescription>
              Interactive view with real-time updates
            </CardDescription>
          </div>
          {modelUrl && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={onToggleSkeleton}
                className={cn(
                  "transition-all duration-200",
                  showSkeleton && "bg-primary text-white shadow-lg",
                )}
              >
                <Eye className="w-4 h-4 mr-2" />
                {showSkeleton ? "Hide" : "Show"} Skeleton
              </Button>
              {canExport && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onExport}
                  className="shadow-lg"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Model
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="h-[calc(100%-88px)] p-0 relative">
        {modelUrl ? (
          <div className="w-full h-full bg-gradient-to-br from-bg-primary to-bg-secondary">
            <ThreeViewer
              ref={viewerRef}
              modelUrl={modelUrl}
              showGroundPlane={true}
              onModelLoad={onModelLoad}
              assetInfo={{
                name: selectedAvatar?.name || "Model",
                type: "character",
                format: "GLB",
              }}
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-bg-primary to-bg-secondary">
            <div className="text-center p-8 animate-fade-in">
              <div className="relative">
                <div className="absolute inset-0 bg-primary opacity-20 blur-3xl animate-pulse" />
                <Package
                  size={80}
                  className="text-text-muted mb-6 mx-auto relative z-10 animate-float"
                />
              </div>
              <h3 className="text-2xl font-semibold text-text-primary mb-2">
                No model loaded
              </h3>
              <p className="text-text-tertiary text-lg max-w-md mx-auto">
                Upload a file to begin
              </p>
            </div>
          </div>
        )}

        {/* Overlay Results */}
        {processingStage === "complete" && (leftHandData || rightHandData) && (
          <div className="absolute top-4 left-4 space-y-2">
            {leftHandData && leftHandData.bonesAdded > 0 && (
              <Badge
                variant="success"
                className={cn(
                  "shadow-lg",
                  "animate-slide-in-left",
                  "text-white",
                )}
              >
                <Hand className="w-3.5 h-3.5 mr-2" />
                Left Hand: {leftHandData.bonesAdded} bones added
              </Badge>
            )}
            {rightHandData && rightHandData.bonesAdded > 0 && (
              <Badge
                variant="success"
                className={cn(
                  "shadow-lg",
                  "animate-slide-in-left",
                  "text-white",
                )}
                style={{ animationDelay: "0.1s" }}
              >
                <Hand className="w-3.5 h-3.5 mr-2" />
                Right Hand: {rightHandData.bonesAdded} bones added
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
