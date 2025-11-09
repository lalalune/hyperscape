import { Grid3x3, Download, Sparkles, Loader2 } from "lucide-react";
import React from "react";

import { GeneratedAsset } from "../../types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
} from "../common";

interface Sprite {
  angle: number;
  imageUrl: string;
}

interface SpritesDisplayProps {
  selectedAsset: GeneratedAsset;
  isGeneratingSprites: boolean;
  onGenerateSprites: (assetId: string) => void;
}

export const SpritesDisplay: React.FC<SpritesDisplayProps> = ({
  selectedAsset,
  isGeneratingSprites,
  onGenerateSprites,
}) => {
  const sprites = selectedAsset.sprites as Sprite[] | null;

  return (
    <Card className="overflow-hidden shadow-xl hover:shadow-2xl transition-shadow">
      <CardHeader>
        <CardTitle>2D Sprites</CardTitle>
        <CardDescription>8-directional sprite sheet</CardDescription>
      </CardHeader>
      <CardContent>
        {sprites ? (
          <div className="grid grid-cols-4 gap-3">
            {sprites.map((sprite, i) => (
              <div key={i} className="group relative aspect-square">
                <div className="w-full h-full bg-bg-tertiary rounded-lg p-2 overflow-hidden hover:shadow-lg transition-all hover:scale-105">
                  <img
                    src={sprite.imageUrl}
                    alt={`${sprite.angle}°`}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <a
                      href={sprite.imageUrl}
                      download={`${selectedAsset.id}-${sprite.angle}deg.png`}
                      className="p-2 bg-primary rounded-lg text-white hover:bg-primary-hover transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download className="w-5 h-5" />
                    </a>
                  </div>
                </div>
                <p className="text-xs text-text-tertiary mt-2 text-center">
                  {sprite.angle}°
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Grid3x3 className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-secondary mb-4">
              {selectedAsset.hasSpriteMetadata
                ? "Ready to generate sprites"
                : "Sprite generation not enabled"}
            </p>
            {selectedAsset.hasSpriteMetadata && (
              <Button
                onClick={() => onGenerateSprites(selectedAsset.id)}
                disabled={isGeneratingSprites}
                className="shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
              >
                {isGeneratingSprites ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Sprites
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SpritesDisplay;
