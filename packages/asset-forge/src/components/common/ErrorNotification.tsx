import { AlertCircle, X } from "lucide-react";
import React from "react";

import { Card, CardContent } from "./Card";

interface ErrorNotificationProps {
  error: string;
  onClose: () => void;
}

export const ErrorNotification: React.FC<ErrorNotificationProps> = ({
  error,
  onClose,
}) => {
  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
      <Card className="bg-red-500/10 border-red-500/20 backdrop-blur-md">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-red-400" />
            <p className="text-sm text-red-200">{error}</p>
            <button
              onClick={onClose}
              className="ml-2 p-1 hover:bg-red-500/20 rounded transition-all"
            >
              <X size={16} className="text-red-300" />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ErrorNotification;
