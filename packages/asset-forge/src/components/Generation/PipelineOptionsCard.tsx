import { Brain, User, Palette, Grid3x3, Settings2 } from "lucide-react";
import React from "react";

import { cn } from "../../styles";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Checkbox,
} from "../common";

interface PipelineOption {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: React.ComponentType<{ className?: string }>;
}

interface PipelineOptionsCardProps {
  generationType: "item" | "avatar" | undefined;
  useGPT4Enhancement: boolean;
  enableRetexturing: boolean;
  enableSprites: boolean;
  enableRigging: boolean;
  quality?: "standard" | "high" | "ultra";
  onUseGPT4EnhancementChange: (checked: boolean) => void;
  onEnableRetexturingChange: (checked: boolean) => void;
  onEnableSpritesChange: (checked: boolean) => void;
  onEnableRiggingChange: (checked: boolean) => void;
  onQualityChange?: (quality: "standard" | "high" | "ultra") => void;
}

export const PipelineOptionsCard: React.FC<PipelineOptionsCardProps> = ({
  generationType,
  useGPT4Enhancement,
  enableRetexturing,
  enableSprites,
  enableRigging,
  quality = "high",
  onUseGPT4EnhancementChange,
  onEnableRetexturingChange,
  onEnableSpritesChange,
  onEnableRiggingChange,
  onQualityChange,
}) => {
  const options: PipelineOption[] = [
    {
      id: "gpt4",
      label: "GPT-4 Enhancement",
      description: "Improve prompts with AI",
      checked: useGPT4Enhancement,
      onChange: onUseGPT4EnhancementChange,
      icon: Brain,
    },
    ...(generationType === "avatar"
      ? [
          {
            id: "rigging",
            label: "Auto-Rigging",
            description: "Add skeleton & animations",
            checked: enableRigging,
            onChange: onEnableRiggingChange,
            icon: User,
          },
        ]
      : []),
    ...(generationType === "item"
      ? [
          {
            id: "retexture",
            label: "Material Variants",
            description: "Generate multiple textures",
            checked: enableRetexturing,
            onChange: onEnableRetexturingChange,
            icon: Palette,
          },
          {
            id: "sprites",
            label: "2D Sprites",
            description: "Generate 8-directional sprites",
            checked: enableSprites,
            onChange: onEnableSpritesChange,
            icon: Grid3x3,
          },
        ]
      : []),
  ];

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-bg-primary via-bg-primary to-primary/5 border-border-primary shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Settings2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">
              Pipeline Options
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Configure generation features
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-3">
        {/* Quality Selector */}
        <div className="p-4 rounded-xl border border-border-primary bg-bg-secondary/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-text-primary">Quality</div>
              <div className="text-xs text-text-secondary">
                Controls mesh detail and texture resolution
              </div>
            </div>
            <div className="flex gap-2">
              {(["standard", "high", "ultra"] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => onQualityChange && onQualityChange(q)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm border transition-colors",
                    quality === q
                      ? "bg-primary text-white border-primary"
                      : "bg-bg-tertiary text-text-secondary border-border-primary hover:border-border-secondary",
                  )}
                >
                  {q[0].toUpperCase() + q.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <div
              key={option.id}
              className={cn(
                "p-4 rounded-xl border transition-all duration-200",
                option.checked
                  ? "border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10"
                  : "border-border-primary hover:border-border-secondary bg-bg-secondary/50",
              )}
            >
              <Checkbox
                checked={option.checked}
                onChange={(e) => option.onChange(e.target.checked)}
                label={
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        option.checked ? "bg-primary/10" : "bg-bg-tertiary",
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-4 h-4 transition-colors",
                          option.checked
                            ? "text-primary"
                            : "text-text-secondary",
                        )}
                      />
                    </div>
                    <div className="flex-1">
                      <span className="font-medium text-text-primary block">
                        {option.label}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {option.description}
                      </span>
                    </div>
                  </div>
                }
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default PipelineOptionsCard;
