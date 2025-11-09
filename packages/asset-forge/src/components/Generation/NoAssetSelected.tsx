import { Package } from "lucide-react";
import React from "react";

import { Card } from "../common";

export const NoAssetSelected: React.FC = () => {
  return (
    <Card className="h-96 flex items-center justify-center shadow-xl">
      <div className="text-center">
        <Package className="w-20 h-20 text-text-muted mx-auto mb-6" />
        <h3 className="text-xl font-semibold text-text-primary mb-3">
          No Asset Selected
        </h3>
        <p className="text-text-secondary">
          Select an asset from the list to view details
        </p>
      </div>
    </Card>
  );
};
