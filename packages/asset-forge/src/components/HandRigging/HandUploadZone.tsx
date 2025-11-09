import { Upload, Box, CheckCircle, AlertCircle } from "lucide-react";
import React, { useRef, useCallback } from "react";

import { useHandRiggingStore } from "../../store";
import { cn } from "../../styles";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../common";

export function HandUploadZone() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { selectedFile, error, setSelectedFile, setModelUrl, setError } =
    useHandRiggingStore();

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && (file.name.endsWith(".glb") || file.name.endsWith(".gltf"))) {
        setSelectedFile(file);
        setModelUrl(URL.createObjectURL(file));
        setError(null);
      } else {
        setError("Please select a GLB or GLTF file");
      }
    },
    [setSelectedFile, setModelUrl, setError],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (file && (file.name.endsWith(".glb") || file.name.endsWith(".gltf"))) {
        setSelectedFile(file);
        setModelUrl(URL.createObjectURL(file));
        setError(null);
      } else {
        setError("Please drop a GLB or GLTF file");
      }
    },
    [setSelectedFile, setModelUrl, setError],
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
    },
    [],
  );

  return (
    <Card className={cn("overflow-hidden", "animate-slide-in-left")}>
      <CardHeader className="bg-gradient-to-r from-bg-secondary to-bg-tertiary">
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary" />
          Model Upload
        </CardTitle>
        <CardDescription>
          Select a rigged model from Meshy.ai or similar tools
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div
          className={cn(
            "relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300",
            "hover:border-primary hover:bg-primary/5 hover:shadow-lg hover:scale-[1.02]",
            selectedFile
              ? "border-primary bg-primary/5"
              : "border-border-primary",
            "animate-fade-in",
          )}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".glb,.gltf"
            onChange={handleFileSelect}
            className="hidden"
          />
          {selectedFile ? (
            <div className="space-y-3">
              <div className="relative">
                <Box className="w-16 h-16 mx-auto text-primary animate-pulse" />
                <CheckCircle className="w-6 h-6 text-success absolute -top-1 -right-1" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary truncate max-w-xs mx-auto">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="w-16 h-16 mx-auto text-text-tertiary animate-pulse" />
              <div>
                <p className="text-sm font-medium text-text-secondary">
                  Drop GLB/GLTF file here
                </p>
                <p className="text-xs text-text-tertiary mt-1">
                  or click to browse
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {error && (
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2 text-sm text-error bg-error/10 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}
    </Card>
  );
}
