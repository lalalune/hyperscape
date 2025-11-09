import { useCallback } from "react";

import { useGenerationStore } from "../store";
import { MaterialPreset } from "../types";
import { notify } from "../utils/notify";

import { apiFetch } from "@/utils/api";

export function useMaterialPresets() {
  const {
    materialPresets,
    customMaterials,
    selectedMaterials,
    setMaterialPresets,
    setCustomMaterials,
    setSelectedMaterials,
    setEditingPreset,
    setShowDeleteConfirm,
  } = useGenerationStore();

  const handleSaveCustomMaterials = useCallback(async () => {
    try {
      // Convert custom materials to the MaterialPreset format
      const newMaterials = customMaterials
        .filter((m) => m.name && m.prompt)
        .map((mat) => ({
          id: mat.name.toLowerCase().replace(/\s+/g, "-"),
          name: mat.name.toLowerCase().replace(/\s+/g, "-"),
          displayName: mat.displayName || mat.name,
          category: "custom",
          tier: materialPresets.length + 1,
          color: mat.color || "#888888",
          stylePrompt: mat.prompt,
          description: "Custom material",
        }));

      // Merge with existing presets
      const updatedPresets = [...materialPresets, ...newMaterials];

      // Save to JSON file
      const response = await apiFetch("/api/material-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedPresets),
      });

      if (response.ok) {
        setMaterialPresets(updatedPresets);
        setCustomMaterials([]);
        notify.success("Custom materials saved successfully!");
      } else {
        throw new Error("Failed to save materials");
      }
    } catch (error) {
      console.error("Failed to save custom materials:", error);
      notify.error(
        "Failed to save custom materials. Note: This requires a backend endpoint to be implemented.",
      );
    }
  }, [
    customMaterials,
    materialPresets,
    setMaterialPresets,
    setCustomMaterials,
  ]);

  const handleUpdatePreset = useCallback(
    async (updatedPreset: MaterialPreset) => {
      try {
        const updatedPresets = materialPresets.map((preset) =>
          preset.id === updatedPreset.id ? updatedPreset : preset,
        );

        const response = await apiFetch("/api/material-presets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedPresets),
        });

        if (response.ok) {
          setMaterialPresets(updatedPresets);
          setEditingPreset(null);
          notify.success("Material preset updated successfully!");
        } else {
          throw new Error("Failed to update preset");
        }
      } catch (error) {
        console.error("Failed to update preset:", error);
        notify.error("Failed to update material preset.");
      }
    },
    [materialPresets, setMaterialPresets, setEditingPreset],
  );

  const handleDeletePreset = useCallback(
    async (presetId: string) => {
      try {
        const updatedPresets = materialPresets.filter(
          (preset) => preset.id !== presetId,
        );

        const response = await apiFetch("/api/material-presets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedPresets),
        });

        if (response.ok) {
          setMaterialPresets(updatedPresets);
          setSelectedMaterials(
            selectedMaterials.filter((id) => id !== presetId),
          );
          setShowDeleteConfirm(null);
          notify.success("Material preset deleted successfully!");
        } else {
          throw new Error("Failed to delete preset");
        }
      } catch (error) {
        console.error("Failed to delete preset:", error);
        notify.error("Failed to delete material preset.");
      }
    },
    [
      materialPresets,
      selectedMaterials,
      setMaterialPresets,
      setSelectedMaterials,
      setShowDeleteConfirm,
    ],
  );

  return {
    handleSaveCustomMaterials,
    handleUpdatePreset,
    handleDeletePreset,
  };
}
