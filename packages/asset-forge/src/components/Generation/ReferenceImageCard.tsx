import {
  Image as ImageIcon,
  Link as LinkIcon,
  X as XIcon,
  Info,
} from "lucide-react";
import React, { useCallback } from "react";

import { cn } from "../../styles";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Button,
} from "@/components/common";

interface ReferenceImageCardProps {
  generationType: "item" | "avatar";
  mode: "auto" | "custom";
  source: "upload" | "url" | null;
  url: string | null;
  dataUrl: string | null;
  onModeChange: (mode: "auto" | "custom") => void;
  onSourceChange: (source: "upload" | "url" | null) => void;
  onUrlChange: (url: string | null) => void;
  onDataUrlChange: (dataUrl: string | null) => void;
}

export const ReferenceImageCard: React.FC<ReferenceImageCardProps> = ({
  generationType,
  mode,
  _source,
  url,
  dataUrl,
  onModeChange,
  onSourceChange,
  onUrlChange,
  onDataUrlChange,
}) => {
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        onDataUrlChange(result);
        onSourceChange("upload");
        // Ensure mode switches to custom when a file is selected
        if (mode !== "custom") onModeChange("custom");
      };
      reader.readAsDataURL(file);
    },
    [onDataUrlChange, onSourceChange, onModeChange, mode],
  );

  const showCustom = mode === "custom";
  const effectivePreview = dataUrl || url || "";

  const tPoseTip =
    generationType === "avatar" ? (
      <div className="flex items-start gap-2 text-warning-700 bg-warning-50 border border-warning-200 rounded-md p-2">
        <Info className="w-4 h-4 mt-0.5" />
        <p className="text-xs leading-snug">
          For best avatar results, use a front-facing T-pose image with empty
          hands.
        </p>
      </div>
    ) : null;

  return (
    <Card className="overflow-hidden animate-fade-in">
      <CardHeader className="bg-gradient-to-r from-bg-secondary to-bg-tertiary">
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-primary" />
          Reference Image
        </CardTitle>
        <CardDescription>
          Choose to auto-generate concept art or provide your own image
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={mode === "auto" ? "primary" : "secondary"}
            onClick={() => onModeChange("auto")}
          >
            Auto-generate
          </Button>
          <Button
            variant={mode === "custom" ? "primary" : "secondary"}
            onClick={() => onModeChange("custom")}
          >
            Use my image
          </Button>
        </div>

        {showCustom && (
          <div className="space-y-3">
            {tPoseTip}

            {/* URL input */}
            <div className="space-y-1">
              <label className="label">Image URL</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <LinkIcon className="w-4 h-4 text-text-tertiary absolute left-2 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="https://example.com/reference.jpg"
                    value={url || ""}
                    onChange={(e) => {
                      onUrlChange(e.target.value);
                      if (e.target.value) {
                        onSourceChange("url");
                        // Ensure mode switches to custom when a URL is entered
                        if (mode !== "custom") onModeChange("custom");
                      }
                    }}
                    className="pl-7"
                  />
                </div>
                {url && (
                  <Button
                    variant="ghost"
                    onClick={() => onUrlChange(null)}
                    title="Clear URL"
                  >
                    <XIcon className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-text-tertiary">
                Provide a public image URL or upload below
              </p>
            </div>

            {/* Upload */}
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-3",
                "hover:border-primary hover:bg-primary/5 transition-colors",
              )}
            >
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Image
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                />
                {dataUrl && (
                  <Button
                    variant="ghost"
                    onClick={() => onDataUrlChange(null)}
                    title="Remove upload"
                  >
                    <XIcon className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-text-tertiary mt-1">
                Max ~8–10 MB recommended. Large files may be slow.
              </p>
            </div>

            {/* Preview */}
            {effectivePreview && (
              <div className="relative">
                <img
                  src={effectivePreview}
                  alt="Reference preview"
                  className="w-full rounded-md border border-border-primary"
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReferenceImageCard;
