import { Download, Palette, Eye, RefreshCw } from "lucide-react";
import React from "react";

import { Card, CardContent, Button } from "../common";

interface AssetActionsCardProps {
  onDownload?: () => void;
  onAddVariants?: () => void;
  onOpenInBrowser?: () => void;
  onGenerateNew?: () => void;
}

export const AssetActionsCard: React.FC<AssetActionsCardProps> = ({
  onDownload,
  onAddVariants,
  onOpenInBrowser,
  onGenerateNew,
}) => {
  return (
    <Card className="shadow-xl">
      <CardContent className="p-6">
        <div className="flex flex-wrap gap-4">
          <Button
            variant="secondary"
            className="hover:scale-[1.02] transition-all"
            onClick={onDownload}
          >
            <Download className="w-4 h-4 mr-2" />
            Download All Assets
          </Button>
          <Button
            variant="secondary"
            className="hover:scale-[1.02] transition-all"
            onClick={onAddVariants}
          >
            <Palette className="w-4 h-4 mr-2" />
            Add More Variants
          </Button>
          <Button
            variant="secondary"
            className="hover:scale-[1.02] transition-all"
            onClick={onOpenInBrowser}
          >
            <Eye className="w-4 h-4 mr-2" />
            Open in Asset Browser
          </Button>
          <Button
            variant="secondary"
            onClick={onGenerateNew}
            className="hover:scale-[1.02] transition-all"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Generate New Asset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
