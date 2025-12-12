import {
  Brain,
  ChevronRight,
  Plus,
  Trash2,
  Sparkles,
  Save,
  Edit2,
  Palette,
  Wand2,
  Check,
  FileText,
  Layers,
  X,
} from "lucide-react";
import React, { useState } from "react";

import { cn } from "../../styles";
import { CustomAssetType } from "../../types/generation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Textarea,
} from "../common";

interface AdvancedPromptsCardProps {
  showAdvancedPrompts: boolean;
  showAssetTypeEditor: boolean;
  generationType: "item" | "avatar" | undefined;
  defaultAssetTypes?: string[];
  assetType?: string;
  customGamePrompt: string;
  customAssetTypePrompt: string;
  assetTypePrompts?: Record<string, string>;
  customAssetTypes?: CustomAssetType[];
  loadedPrompts?: {
    avatar?: string;
    item?: string;
  };
  gameStyle?: string;
  customStyle?: string | null;
  currentStylePrompt?: string;
  gameStylePrompts?: any; // Add proper type later
  onToggleAdvancedPrompts: () => void;
  onToggleAssetTypeEditor: () => void;
  onCustomGamePromptChange: (value: string) => void;
  onCustomAssetTypePromptChange: (value: string) => void;
  onAssetTypePromptsChange?: (prompts: Record<string, string>) => void;
  onCustomAssetTypesChange?: (types: CustomAssetType[]) => void;
  onAddCustomAssetType?: (type: CustomAssetType) => void;
  onSaveCustomAssetTypes?: () => void;
  onSaveCustomGameStyle?: (
    id: string,
    style: {
      name: string;
      base: string;
      enhanced?: string;
    },
  ) => Promise<boolean>;
  onDeleteCustomGameStyle?: (id: string) => Promise<boolean>;
  onDeleteCustomAssetType?: (
    id: string,
    generationType: "avatar" | "item",
  ) => Promise<boolean>;
}

export const AdvancedPromptsCard: React.FC<AdvancedPromptsCardProps> = ({
  showAdvancedPrompts,
  showAssetTypeEditor: _showAssetTypeEditor,
  generationType,
  assetType: _assetType,
  customGamePrompt,
  customAssetTypePrompt,
  assetTypePrompts,
  customAssetTypes,
  currentStylePrompt,
  loadedPrompts,
  gameStyle: _gameStyle,
  customStyle: _customStyle,
  gameStylePrompts,
  onToggleAdvancedPrompts,
  onToggleAssetTypeEditor: _onToggleAssetTypeEditor,
  onCustomGamePromptChange,
  onCustomAssetTypePromptChange,
  onAssetTypePromptsChange,
  onCustomAssetTypesChange,
  onAddCustomAssetType,
  onSaveCustomAssetTypes,
  onSaveCustomGameStyle,
  onDeleteCustomGameStyle,
  onDeleteCustomAssetType,
}) => {
  const defaultAssetTypes =
    generationType === "avatar"
      ? ["character", "humanoid", "npc", "creature"]
      : ["weapon", "armor", "tool", "building", "consumable", "resource"];

  const [activeTab, setActiveTab] = useState<"quick" | "styles" | "types">(
    "quick",
  );
  const [showStyleCreator, setShowStyleCreator] = useState(false);
  const [newStyleName, setNewStyleName] = useState("");
  const [newStyleBase, setNewStyleBase] = useState("");
  const [newStyleEnhanced, setNewStyleEnhanced] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-bg-primary via-bg-primary to-primary/5 border-border-primary shadow-lg">
      <CardHeader
        className="cursor-pointer select-none hover:bg-bg-secondary/30 transition-all duration-200"
        onClick={onToggleAdvancedPrompts}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">
                Prompt Studio
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Customize generation prompts
              </CardDescription>
            </div>
          </div>
          <ChevronRight
            className={cn(
              "w-5 h-5 text-text-secondary transition-transform duration-200",
              showAdvancedPrompts && "rotate-90",
            )}
          />
        </div>
      </CardHeader>

      {showAdvancedPrompts && (
        <CardContent className="p-0">
          {/* Sleek Tab Navigation */}
          <div className="flex bg-bg-secondary/20 backdrop-blur-sm">
            <TabButton
              active={activeTab === "quick"}
              onClick={() => setActiveTab("quick")}
              icon={<FileText className="w-4 h-4" />}
              label="Quick Edit"
            />
            <TabButton
              active={activeTab === "styles"}
              onClick={() => setActiveTab("styles")}
              icon={<Palette className="w-4 h-4" />}
              label="Styles"
            />
            <TabButton
              active={activeTab === "types"}
              onClick={() => setActiveTab("types")}
              icon={<Layers className="w-4 h-4" />}
              label={generationType === "avatar" ? "Characters" : "Assets"}
            />
          </div>

          <div className="animate-fade-in">
            {/* Quick Edit Tab */}
            {activeTab === "quick" && (
              <div className="p-6 space-y-5">
                {/* Current Style Info */}
                {currentStylePrompt && (
                  <InfoCard
                    icon={<Palette className="w-4 h-4" />}
                    title="Active Style"
                    content={currentStylePrompt}
                    variant="primary"
                  />
                )}

                {/* Style Override */}
                <PromptSection
                  icon={<Edit2 className="w-4 h-4" />}
                  title="Style Override"
                  description="Override the selected style"
                  value={customGamePrompt}
                  onChange={onCustomGamePromptChange}
                  placeholder="Custom style prompt..."
                  rows={2}
                />

                {/* Asset Type Details */}
                <PromptSection
                  icon={<Wand2 className="w-4 h-4" />}
                  title={`${generationType === "avatar" ? "Character" : "Asset"} Details`}
                  description="Add type-specific details"
                  value={customAssetTypePrompt}
                  onChange={onCustomAssetTypePromptChange}
                  placeholder={
                    generationType === "avatar"
                      ? loadedPrompts?.avatar || "Character-specific details..."
                      : loadedPrompts?.item || "Asset-specific details..."
                  }
                  rows={2}
                  variant="secondary"
                />
              </div>
            )}

            {/* Styles Tab */}
            {activeTab === "styles" && (
              <div className="p-6 space-y-6">
                {/* Custom Styles List */}
                {gameStylePrompts?.custom &&
                  Object.keys(gameStylePrompts.custom).length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-text-secondary">
                        Your Custom Styles
                      </h3>
                      <div className="grid grid-cols-1 gap-3">
                        {Object.entries(gameStylePrompts.custom).map(
                          ([id, style]) => (
                            <CustomStyleCard
                              key={id}
                              id={id}
                              style={style}
                              onDelete={onDeleteCustomGameStyle}
                            />
                          ),
                        )}
                      </div>
                    </div>
                  )}

                {!showStyleCreator ? (
                  <div className="text-center py-8">
                    <Button
                      variant="primary"
                      onClick={() => setShowStyleCreator(true)}
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Create New Style
                    </Button>
                  </div>
                ) : (
                  <StyleCreator
                    newStyleName={newStyleName}
                    newStyleBase={newStyleBase}
                    newStyleEnhanced={newStyleEnhanced}
                    isSaving={isSaving}
                    onNameChange={setNewStyleName}
                    onBaseChange={setNewStyleBase}
                    onEnhancedChange={setNewStyleEnhanced}
                    onSave={async () => {
                      if (
                        !newStyleName ||
                        !newStyleBase ||
                        !onSaveCustomGameStyle
                      )
                        return;

                      setIsSaving(true);
                      const styleId = newStyleName
                        .toLowerCase()
                        .replace(/\s+/g, "-");
                      const success = await onSaveCustomGameStyle(styleId, {
                        name: newStyleName,
                        base: newStyleBase,
                        enhanced: newStyleEnhanced || newStyleBase,
                      });

                      if (success) {
                        setNewStyleName("");
                        setNewStyleBase("");
                        setNewStyleEnhanced("");
                        setShowStyleCreator(false);
                      }
                      setIsSaving(false);
                    }}
                    onCancel={() => {
                      setShowStyleCreator(false);
                      setNewStyleName("");
                      setNewStyleBase("");
                      setNewStyleEnhanced("");
                    }}
                  />
                )}
              </div>
            )}

            {/* Types Tab */}
            {activeTab === "types" && (
              <div className="p-6">
                <TypesEditor
                  generationType={generationType}
                  defaultAssetTypes={defaultAssetTypes}
                  assetTypePrompts={assetTypePrompts || {}}
                  customAssetTypes={customAssetTypes || []}
                  onAssetTypePromptsChange={onAssetTypePromptsChange}
                  onCustomAssetTypesChange={onCustomAssetTypesChange}
                  onAddCustomAssetType={onAddCustomAssetType}
                  onSaveCustomAssetTypes={onSaveCustomAssetTypes}
                  onDeleteCustomAssetType={onDeleteCustomAssetType}
                />
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

// Tab Button Component
const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex-1 px-4 py-3 text-sm font-medium transition-all duration-200",
      "hover:bg-bg-secondary/50 focus:outline-none relative group",
      active
        ? "text-primary bg-bg-primary/50"
        : "text-text-secondary hover:text-text-primary",
    )}
  >
    <div className="flex items-center justify-center gap-2">
      {icon}
      {label}
    </div>
    {active && (
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
    )}
  </button>
);

// Info Card Component
const InfoCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  content: string;
  variant?: "primary" | "secondary";
}> = ({ icon, title, content, variant = "primary" }) => (
  <div
    className={cn(
      "p-4 rounded-xl border backdrop-blur-sm",
      variant === "primary"
        ? "bg-primary/5 border-primary/20"
        : "bg-secondary/5 border-secondary/20",
    )}
  >
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "p-2 rounded-lg",
          variant === "primary" ? "bg-primary/10" : "bg-secondary/10",
        )}
      >
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          {title}
        </p>
        <p className="text-sm text-text-primary mt-1">{content}</p>
      </div>
    </div>
  </div>
);

// Prompt Section Component
const PromptSection: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
  variant?: "primary" | "secondary";
}> = ({
  icon,
  title,
  description,
  value,
  onChange,
  placeholder,
  rows = 3,
  variant = "primary",
}) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "p-1.5 rounded-lg",
          variant === "primary" ? "bg-primary/10" : "bg-secondary/10",
        )}
      >
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-medium text-text-primary">{title}</h3>
        <p className="text-xs text-text-secondary">{description}</p>
      </div>
    </div>
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={cn(
        "w-full resize-none bg-bg-secondary/50 border-border-primary",
        "focus:ring-2 transition-all",
        variant === "primary"
          ? "focus:border-primary focus:ring-primary/20"
          : "focus:border-secondary focus:ring-secondary/20",
      )}
    />
  </div>
);

// Empty State Component
const _EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}> = ({ icon, title, description, actionLabel, onAction }) => (
  <div className="text-center py-12">
    <div className="inline-flex p-4 bg-bg-secondary rounded-full text-text-tertiary mb-4">
      {icon}
    </div>
    <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
    <p className="text-sm text-text-secondary mb-6 max-w-sm mx-auto">
      {description}
    </p>
    <Button variant="primary" onClick={onAction} className="gap-2">
      <Plus className="w-4 h-4" />
      {actionLabel}
    </Button>
  </div>
);

// Style Creator Component
const StyleCreator: React.FC<{
  newStyleName: string;
  newStyleBase: string;
  newStyleEnhanced: string;
  isSaving: boolean;
  onNameChange: (value: string) => void;
  onBaseChange: (value: string) => void;
  onEnhancedChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}> = ({
  newStyleName,
  newStyleBase,
  newStyleEnhanced,
  isSaving,
  onNameChange,
  onBaseChange,
  onEnhancedChange,
  onSave,
  onCancel,
}) => (
  <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
    <CardHeader className="pb-4">
      <div className="flex items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Create Style
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-8 w-8 p-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div>
        <label className="text-sm font-medium text-text-primary mb-2 block">
          Name
        </label>
        <Input
          value={newStyleName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g., Pixel Art"
          className="bg-bg-primary"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-text-primary mb-2 block">
          Base Prompt
        </label>
        <Textarea
          value={newStyleBase}
          onChange={(e) => onBaseChange(e.target.value)}
          placeholder="Main style description..."
          rows={2}
          className="bg-bg-primary resize-none"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-text-primary mb-2 block">
          Enhanced{" "}
          <span className="text-xs text-text-secondary">(Optional)</span>
        </label>
        <Textarea
          value={newStyleEnhanced}
          onChange={(e) => onEnhancedChange(e.target.value)}
          placeholder="Additional details..."
          rows={2}
          className="bg-bg-primary resize-none"
        />
      </div>

      <Button
        variant="primary"
        onClick={onSave}
        disabled={!newStyleName || !newStyleBase || isSaving}
        className="w-full gap-2"
      >
        {isSaving ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Check className="w-4 h-4" />
            Save Style
          </>
        )}
      </Button>
    </CardContent>
  </Card>
);

// Types Editor Component
const TypesEditor: React.FC<{
  generationType: "item" | "avatar" | undefined;
  defaultAssetTypes: string[];
  assetTypePrompts: Record<string, string>;
  customAssetTypes: CustomAssetType[];
  onAssetTypePromptsChange?: (prompts: Record<string, string>) => void;
  onCustomAssetTypesChange?: (types: CustomAssetType[]) => void;
  onAddCustomAssetType?: (type: CustomAssetType) => void;
  onSaveCustomAssetTypes?: () => void;
  onDeleteCustomAssetType?: (
    id: string,
    generationType: "avatar" | "item",
  ) => Promise<boolean>;
}> = ({
  generationType,
  defaultAssetTypes,
  assetTypePrompts,
  customAssetTypes,
  onAssetTypePromptsChange,
  onCustomAssetTypesChange,
  onAddCustomAssetType,
  onSaveCustomAssetTypes,
  onDeleteCustomAssetType,
}) => {
  const allDefaultTypes = [
    "character",
    "humanoid",
    "npc",
    "creature",
    "weapon",
    "armor",
    "tool",
    "building",
    "consumable",
    "resource",
  ];
  const savedCustomTypes = Object.entries(assetTypePrompts).filter(
    ([key]) => !allDefaultTypes.includes(key),
  );

  return (
    <div className="space-y-6">
      {/* Default Types Grid */}
      <div>
        <h3 className="text-sm font-medium text-text-secondary mb-3">
          Default {generationType === "avatar" ? "Characters" : "Assets"}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {defaultAssetTypes.map((type) => (
            <TypeCard
              key={type}
              type={type}
              value={assetTypePrompts[type] || ""}
              onChange={(value) => {
                onAssetTypePromptsChange?.({
                  ...assetTypePrompts,
                  [type]: value,
                });
              }}
              isDefault
            />
          ))}
        </div>
      </div>

      {/* Saved Custom Types */}
      {savedCustomTypes.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Custom Types
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {savedCustomTypes.map(([key, prompt]) => (
              <TypeCard
                key={key}
                type={key}
                value={prompt}
                onChange={(value) => {
                  onAssetTypePromptsChange?.({
                    ...assetTypePrompts,
                    [key]: value,
                  });
                }}
                isCustom
                onDelete={
                  generationType && onDeleteCustomAssetType
                    ? () =>
                        onDeleteCustomAssetType(
                          key,
                          generationType as "avatar" | "item",
                        )
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Add New Types */}
      {customAssetTypes.length === 0 ? (
        <Button
          variant="secondary"
          onClick={() => onAddCustomAssetType?.({ name: "", prompt: "" })}
          className="w-full gap-2 border-2 border-dashed hover:border-primary"
        >
          <Plus className="w-4 h-4" />
          Add Custom Type
        </Button>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-text-secondary">New Types</h3>
          {customAssetTypes.map((type, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder="Name"
                value={type.name}
                onChange={(e) => {
                  const updated = customAssetTypes.map((t, i) =>
                    i === index ? { ...t, name: e.target.value } : t,
                  );
                  onCustomAssetTypesChange?.(updated);
                }}
                className="w-32"
              />
              <Input
                placeholder="Prompt"
                value={type.prompt}
                onChange={(e) => {
                  const updated = customAssetTypes.map((t, i) =>
                    i === index ? { ...t, prompt: e.target.value } : t,
                  );
                  onCustomAssetTypesChange?.(updated);
                }}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onCustomAssetTypesChange?.(
                    customAssetTypes.filter((_, i) => i !== index),
                  );
                }}
                className="text-error hover:bg-error/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onAddCustomAssetType?.({ name: "", prompt: "" })}
              className="flex-1"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add More
            </Button>

            {customAssetTypes.filter((t) => t.name && t.prompt).length > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={onSaveCustomAssetTypes}
                className="flex-1"
              >
                <Save className="w-3 h-3 mr-1" />
                Save All
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Custom Style Card Component
const CustomStyleCard: React.FC<{
  id: string;
  style: any;
  onDelete?: (id: string) => Promise<boolean>;
}> = ({ id, style, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      const success = await onDelete(id);
      if (success) {
        setShowConfirm(false);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="text-sm font-medium text-text-primary flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-primary" />
              {style.name}
            </h4>
            <p className="text-xs text-text-secondary mt-1">{style.base}</p>
            {style.enhanced && style.enhanced !== style.base && (
              <p className="text-xs text-text-tertiary mt-1 italic">
                Enhanced: {style.enhanced}
              </p>
            )}
          </div>
          {onDelete && (
            <div className="ml-4">
              {!showConfirm ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConfirm(true)}
                  className="text-error hover:bg-error/10 h-8 w-8 p-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              ) : (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="text-error hover:bg-error/10 h-8 px-2"
                  >
                    {isDeleting ? (
                      <div className="w-3 h-3 border-2 border-error/30 border-t-error rounded-full animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowConfirm(false)}
                    className="h-8 px-2"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Type Card Component
const TypeCard: React.FC<{
  type: string;
  value: string;
  onChange: (value: string) => void;
  isDefault?: boolean;
  isCustom?: boolean;
  onDelete?: () => Promise<boolean>;
}> = ({ type, value, onChange, isDefault: _isDefault, isCustom, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      const success = await onDelete();
      if (success) {
        setShowConfirm(false);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className={cn(
        "p-3 rounded-lg border transition-all",
        isCustom
          ? "bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20"
          : "bg-bg-secondary/50 border-border-primary hover:border-border-secondary",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <label className="text-sm font-medium text-text-primary capitalize flex items-center gap-2">
          {isCustom && <Sparkles className="w-3 h-3 text-primary" />}
          {type.replace(/-/g, " ")}
        </label>
        {isCustom && onDelete && (
          <div>
            {!showConfirm ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConfirm(true)}
                className="text-error hover:bg-error/10 h-6 w-6 p-0"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-error hover:bg-error/10 h-6 px-1.5"
                >
                  {isDeleting ? (
                    <div className="w-3 h-3 border-2 border-error/30 border-t-error rounded-full animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConfirm(false)}
                  className="h-6 px-1.5"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`${type} prompt...`}
        className="bg-bg-primary text-sm"
      />
    </div>
  );
};

export default AdvancedPromptsCard;
