import React, { useState } from "react";
import { Asset, MaterialPreset } from "../../types";
import { useMaterialPresets, useRetexturing } from "../../hooks/useAssets";
import {
  Sparkles,
  Package,
  Loader,
  CheckCircle,
  ChevronRight,
  Wand2,
  Plus,
  Image as ImageIcon,
  Type,
} from "lucide-react";

// Import components and utilities
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalSection,
  Button,
  Card,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Textarea,
  Select,
  Badge,
  Progress,
} from "../common";
import { patterns, cn } from "../../styles";

interface RetextureModalProps {
  asset: Asset;
  onClose: () => void;
  onComplete: () => void;
}

type WorkflowMode = "presets" | "custom" | "image";

const RetextureModal: React.FC<RetextureModalProps> = ({
  asset,
  onClose,
  onComplete,
}) => {
  const { presets, loading: presetsLoading } = useMaterialPresets();
  const { retextureAsset, isRetexturing } = useRetexturing();

  // States
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode | null>(null);
  const [selectedPresets, setSelectedPresets] = useState<MaterialPreset[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [customStyle, setCustomStyle] = useState<"realistic" | "cartoon">(
    "realistic"
  );
  const [imageUrl, setImageUrl] = useState("");
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "success">(
    "idle"
  );
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<
    Array<{ name: string; status: "pending" | "done" | "error" }>
  >([]);

  // Custom material creation
  const [customMaterials, setCustomMaterials] = useState<MaterialPreset[]>([]);
  const [showCustomMaterialForm, setShowCustomMaterialForm] = useState(false);
  const [customMaterialData, setCustomMaterialData] = useState({
    name: "",
    displayName: "",
    category: "",
    newCategory: "",
    tier: 1,
    color: "#666666",
    stylePrompt: "",
  });

  // Smart detection for suggested presets
  const detectSuggestedCategories = (): string[] => {
    const name = asset.name.toLowerCase();

    if (
      name.includes("sword") ||
      name.includes("axe") ||
      name.includes("mace") ||
      name.includes("helm") ||
      name.includes("plate") ||
      name.includes("shield")
    ) {
      return ["metal"];
    } else if (
      name.includes("bow") ||
      name.includes("staff") ||
      name.includes("wand")
    ) {
      return ["wood"];
    } else if (
      name.includes("leather") ||
      name.includes("hide") ||
      name.includes("chaps")
    ) {
      return ["leather"];
    }

    return []; // No suggestions, show all
  };

  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    // Start with suggested categories, but allow full customization
    const suggested = detectSuggestedCategories();
    return suggested.length > 0 ? suggested : ["metal", "wood", "leather"]; // Default to all if no suggestions
  });

  // Combine presets and custom materials
  const allMaterials = [...presets, ...customMaterials];

  // Debug: Check for duplicate IDs
  const idCounts = allMaterials.reduce(
    (acc, mat) => {
      acc[mat.id] = (acc[mat.id] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const duplicates = Object.entries(idCounts).filter(
    ([_, count]) => (count as number) > 1
  );
  if (duplicates.length > 0) {
    console.warn("Duplicate material IDs found:", duplicates);
  }

  // Get all unique categories (including custom ones)
  const allCategories = Array.from(
    new Set(allMaterials.map((p) => p.category).filter(Boolean))
  ) as string[];

  const filteredPresets =
    selectedCategories.length > 0
      ? allMaterials.filter(
          (p) => p.category && selectedCategories.includes(p.category)
        )
      : allMaterials;

  const suggestedCategories = detectSuggestedCategories();
  const hasGamePresets = allMaterials.length > 0;

  // Workflow mode selection content
  const renderWorkflowSelection = () => (
    <ModalSection title="Choose Your Workflow">
      <div className="space-y-4">
        {/* Workflow Options */}
        <div className="grid grid-cols-1 gap-4">
          {/* Presets Workflow */}
          <Card
            variant="interactive"
            className={cn(
              "group relative overflow-hidden",
              patterns.clickable,
              patterns.focusRing
            )}
            onClick={() => setWorkflowMode("presets")}
          >
            <CardContent className="flex items-center gap-6 p-6">
              <div
                className={cn(
                  "flex items-center justify-center w-16 h-16 rounded-lg",
                  "bg-primary-100 text-primary-600 group-hover:bg-primary-200"
                )}
              >
                <Package size={24} />
              </div>

              <div className="flex-1">
                <CardTitle className="text-lg font-semibold text-gray-900 mb-2">
                  Material Presets
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Quick generation using pre-configured material templates
                  optimized for your asset type
                </CardDescription>

                {suggestedCategories.length > 0 && (
                  <div className="flex items-center gap-2 mt-3">
                    <Sparkles size={16} className="text-primary-500" />
                    <span className="text-sm text-primary-600 font-medium">
                      Smart suggestions available
                    </span>
                  </div>
                )}
              </div>

              <ChevronRight
                className={cn(
                  "w-5 h-5 text-gray-400 transition-all duration-200",
                  "group-hover:text-primary-600 group-hover:translate-x-1"
                )}
              />
            </CardContent>
          </Card>

          {/* Custom Text Workflow */}
          <Card
            variant="interactive"
            className={cn(
              "group relative overflow-hidden",
              patterns.clickable,
              patterns.focusRing
            )}
            onClick={() => setWorkflowMode("custom")}
          >
            <CardContent className="flex items-center gap-6 p-6">
              <div
                className={cn(
                  "flex items-center justify-center w-16 h-16 rounded-lg",
                  "bg-success-100 text-success-600 group-hover:bg-success-200"
                )}
              >
                <Type size={24} />
              </div>

              <div className="flex-1">
                <CardTitle className="text-lg font-semibold text-gray-900 mb-2">
                  Custom Description
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Describe your desired materials and style in natural language
                  for custom generation
                </CardDescription>
              </div>

              <ChevronRight
                className={cn(
                  "w-5 h-5 text-gray-400 transition-all duration-200",
                  "group-hover:text-success-600 group-hover:translate-x-1"
                )}
              />
            </CardContent>
          </Card>

          {/* Image Reference Workflow */}
          <Card
            variant="interactive"
            className={cn(
              "group relative overflow-hidden",
              patterns.clickable,
              patterns.focusRing
            )}
            onClick={() => setWorkflowMode("image")}
          >
            <CardContent className="flex items-center gap-6 p-6">
              <div
                className={cn(
                  "flex items-center justify-center w-16 h-16 rounded-lg",
                  "bg-warning-100 text-warning-600 group-hover:bg-warning-200"
                )}
              >
                <ImageIcon size={24} />
              </div>

              <div className="flex-1">
                <CardTitle className="text-lg font-semibold text-gray-900 mb-2">
                  Image Reference
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Upload or provide a reference image to match specific
                  materials and textures
                </CardDescription>
              </div>

              <ChevronRight
                className={cn(
                  "w-5 h-5 text-gray-400 transition-all duration-200",
                  "group-hover:text-warning-600 group-hover:translate-x-1"
                )}
              />
            </CardContent>
          </Card>
        </div>

        {/* Smart Detection Alert */}
        {suggestedCategories.length > 0 && (
          <Card
            variant="default"
            className="bg-gradient-to-r from-primary-50 to-primary-100 border-primary-200"
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-primary-900 mb-1">
                    Smart Material Detection
                  </h4>
                  <p className="text-sm text-primary-700 mb-2">
                    Based on your asset "{asset.name}", we suggest these
                    material categories:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedCategories.map((category) => (
                      <Badge key={category} variant="primary" size="sm">
                        {category}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ModalSection>
  );

  // Preset selection content
  const renderPresetSelection = () => (
    <ModalSection title="Select Materials">
      <div className="space-y-6">
        {/* Category Selection */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Material Categories
          </h4>
          <div className="flex flex-wrap gap-2">
            {allCategories.map((category) => (
              <Button
                key={category}
                variant={
                  selectedCategories.includes(category)
                    ? "primary"
                    : "secondary"
                }
                size="sm"
                onClick={() => {
                  setSelectedCategories((prev) =>
                    prev.includes(category)
                      ? prev.filter((c) => c !== category)
                      : [...prev, category]
                  );
                }}
                className="capitalize"
              >
                {category}
              </Button>
            ))}

            {/* Add Custom Category */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCustomMaterialForm(true)}
              className="border border-dashed border-gray-300 hover:border-gray-400"
            >
              <Plus size={16} />
              Add Category
            </Button>
          </div>
        </div>

        {/* Material Grid */}
        <div className="grid grid-cols-4 gap-4 max-h-96 overflow-y-auto p-4 bg-gray-50 rounded-lg">
          {filteredPresets.map((preset, index) => {
            // Create a unique key by combining multiple properties
            const uniqueKey = `${preset.category}-${preset.id}-${preset.tier}-${index}`;

            return (
              <Card
                key={uniqueKey}
                variant={
                  selectedPresets.includes(preset) ? "hover" : "interactive"
                }
                className={cn(
                  "cursor-pointer text-center relative",
                  patterns.clickable,
                  selectedPresets.includes(preset) &&
                    "ring-2 ring-primary ring-offset-2"
                )}
                onClick={() => {
                  setSelectedPresets((prev) =>
                    prev.includes(preset)
                      ? prev.filter((p) => p.id !== preset.id)
                      : [...prev, preset]
                  );
                }}
              >
                <CardContent className="p-4">
                  <div
                    className="w-16 h-16 rounded-full mx-auto mb-3 shadow-lg border-2 border-white"
                    style={{ backgroundColor: preset.color }}
                  />
                  <h5 className="font-medium text-sm text-gray-900 mb-1">
                    {preset.displayName}
                  </h5>
                  <Badge variant="secondary" size="sm">
                    T{preset.tier}
                  </Badge>

                  {selectedPresets.includes(preset) && (
                    <div
                      className={cn(
                        "absolute top-3 right-3 opacity-100 transform scale-100",
                        "transition-all duration-200 bg-primary-600 text-white rounded-full p-1"
                      )}
                    >
                      <CheckCircle size={16} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Selected Materials Summary */}
        {selectedPresets.length > 0 && (
          <Card className="bg-gradient-to-r from-primary-50 to-primary-100 border-primary-200">
            <CardContent className="p-4">
              <h4 className="font-medium text-primary-900 mb-2">
                Selected Materials ({selectedPresets.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {selectedPresets.map((preset, index) => (
                  <Badge
                    key={`selected-${preset.category}-${preset.id}-${index}`}
                    variant="primary"
                    size="sm"
                  >
                    {preset.displayName}
                    <div
                      className="w-3 h-3 rounded-full ml-2 border border-white"
                      style={{ backgroundColor: preset.color }}
                    />
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ModalSection>
  );

  // Custom prompt content
  const renderCustomPrompt = () => (
    <ModalSection title="Describe Your Materials">
      <div className="space-y-4">
        <div>
          <label className="label mb-2">Material Description</label>
          <Textarea
            placeholder="Describe the materials you want (e.g., 'weathered bronze with green patina', 'dark oak wood with silver inlays')"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={4}
            className="w-full"
          />
          <p className="text-sm text-text-tertiary mt-1">
            Be as specific as possible for best results
          </p>
        </div>

        <div>
          <label className="label mb-2">Art Style</label>
          <Select
            value={customStyle}
            onChange={(e) =>
              setCustomStyle(e.target.value as "realistic" | "cartoon")
            }
          >
            <option value="realistic">Realistic</option>
            <option value="cartoon">Cartoon/Stylized</option>
          </Select>
        </div>
      </div>
    </ModalSection>
  );

  // Image reference content
  const renderImageReference = () => (
    <ModalSection title="Reference Image">
      <div className="space-y-4">
        <div>
          <label className="label mb-2">Image URL</label>
          <Input
            placeholder="https://example.com/reference-image.jpg"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
          <p className="text-sm text-text-tertiary mt-1">
            Or upload a file below
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Image
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setUploadedImage(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
          />
        </div>
      </div>
    </ModalSection>
  );

  // Processing content
  const renderProcessing = () => (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <Loader className="w-8 h-8 text-primary-600 animate-spin" />
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Generating Textures
      </h3>
      <p className="text-gray-600 mb-6">
        Creating high-quality material variants for your asset...
      </p>

      <Progress
        value={progress}
        size="lg"
        showLabel
        className="max-w-md mx-auto mb-6"
      />

      <p className="text-sm text-text-tertiary mb-2">Generation Progress</p>

      {results.length > 0 && (
        <div className="space-y-2 max-w-md mx-auto">
          {results.map((result, index) => (
            <div
              key={index}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-gray-700">{result.name}</span>
              <Badge
                variant={
                  result.status === "done"
                    ? "success"
                    : result.status === "error"
                      ? "error"
                      : "warning"
                }
                size="sm"
              >
                {result.status === "done"
                  ? "Complete"
                  : result.status === "error"
                    ? "Failed"
                    : "Processing..."}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Success content
  const renderSuccess = () => (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-8 h-8 text-success-600" />
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Textures Generated Successfully!
      </h3>
      <p className="text-gray-600 mb-6">
        Your material variants have been created and are ready to use.
      </p>

      <div className="flex justify-center gap-3">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button variant="primary" onClick={onComplete}>
          View Results
        </Button>
      </div>
    </div>
  );

  // Modal footer buttons
  const renderFooter = () => {
    if (status === "processing" || status === "success") return null;
    if (!workflowMode) return null;

    const canGenerate =
      workflowMode === "presets"
        ? selectedPresets.length > 0
        : workflowMode === "custom"
          ? customPrompt.trim().length > 0
          : imageUrl || uploadedImage;

    return (
      <>
        <Button variant="secondary" onClick={() => setWorkflowMode(null)}>
          Back
        </Button>
        <Button
          variant="primary"
          disabled={!canGenerate || isRetexturing}
          onClick={async () => {
            setStatus("processing");
            setProgress(0);
            setResults([]);

            if (workflowMode === "presets") {
              // Generate variants for each selected preset
              const totalPresets = selectedPresets.length;
              let completed = 0;

              for (const preset of selectedPresets) {
                const variantName = `${asset.name.replace("-base", "")}-${preset.name}`;

                setResults((prev) => [
                  ...prev,
                  {
                    name: preset.displayName,
                    status: "pending",
                  },
                ]);

                const result = await retextureAsset({
                  baseAssetId: asset.id,
                  materialPreset: preset,
                  outputName: variantName,
                });

                completed++;
                setProgress((completed / totalPresets) * 100);

                setResults((prev) =>
                  prev.map((r) =>
                    r.name === preset.displayName
                      ? { ...r, status: result ? "done" : "error" }
                      : r
                  )
                );
              }

              // All done
              setTimeout(() => {
                setStatus("success");
              }, 1000);
            } else if (workflowMode === "custom") {
              console.error("Custom prompt retexturing not yet implemented");
              setStatus("idle");
            } else if (workflowMode === "image") {
              console.error("Image-based retexturing not yet implemented");
              setStatus("idle");
            }
          }}
        >
          {isRetexturing ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Generate Textures
            </>
          )}
        </Button>
      </>
    );
  };

  return (
    <Modal open={true} onClose={onClose} size="xl">
      <ModalHeader title="Create Texture Variants" onClose={onClose} />
      <ModalBody>
        {status === "idle" && !workflowMode && renderWorkflowSelection()}
        {status === "idle" &&
          workflowMode === "presets" &&
          renderPresetSelection()}
        {status === "idle" && workflowMode === "custom" && renderCustomPrompt()}
        {status === "idle" &&
          workflowMode === "image" &&
          renderImageReference()}
        {status === "processing" && renderProcessing()}
        {status === "success" && renderSuccess()}
      </ModalBody>
      {renderFooter() && <ModalFooter>{renderFooter()}</ModalFooter>}
    </Modal>
  );
};

export default RetextureModal;
