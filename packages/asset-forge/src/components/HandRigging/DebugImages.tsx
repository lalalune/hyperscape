import { Camera } from "lucide-react";
import React from "react";

import { cn } from "../../styles";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../common";

interface DebugImagesProps {
  debugImages: { [key: string]: string | undefined };
  showDebugImages: boolean;
}

export const DebugImages: React.FC<DebugImagesProps> = ({
  debugImages,
  showDebugImages,
}) => {
  if (!showDebugImages || Object.keys(debugImages).length === 0) return null;

  // Filter out undefined values
  const validImages = Object.entries(debugImages).filter(
    ([_, value]) => value !== undefined,
  ) as [string, string][];

  if (validImages.length === 0) return null;

  return (
    <Card className={cn("mt-6 overflow-hidden", "animate-fade-in")}>
      <CardHeader className="bg-gradient-to-r from-bg-secondary to-bg-tertiary">
        <CardTitle className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-primary" />
          AI Debug Captures
        </CardTitle>
        <CardDescription>View angles used for hand detection</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {validImages.map(([key, dataUrl]) => (
            <div key={key} className="group relative">
              <img
                src={dataUrl}
                alt={key}
                className="w-full aspect-square object-cover rounded-lg border-2 border-border-primary group-hover:border-primary transition-all duration-200 group-hover:scale-105"
              />
              <p className="text-xs text-text-secondary text-center mt-2 font-medium">
                {key.charAt(0).toUpperCase() + key.slice(1)} View
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
