import React from "react";

import { Card, CardContent } from "../common";

interface FittingProgressProps {
  progress: number;
  message: string;
}

export const FittingProgress: React.FC<FittingProgressProps> = ({
  progress,
  message,
}) => {
  return (
    <div className="absolute bottom-4 left-4 right-4">
      <Card className="bg-bg-tertiary/80 backdrop-blur-md border border-white/10">
        <CardContent className="py-3">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">{message}</p>
              <div className="mt-2 h-2 bg-bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-mono text-primary">{progress}%</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FittingProgress;
