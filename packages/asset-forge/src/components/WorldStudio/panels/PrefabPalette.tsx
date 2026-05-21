/**
 * PrefabPalette — Browse and place saved prefabs.
 *
 * Shows a grid of saved prefabs with entity count, description, and place button.
 * Right-click context menu for rename, delete, export JSON.
 */

import {
  Package,
  Trash2,
  Download,
  Pencil,
  MapPin,
  Search,
} from "lucide-react";
import React, { useState, useMemo, useCallback } from "react";

import { useWorldStudio } from "../WorldStudioContext";
import type { Prefab } from "../types";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PrefabPalette() {
  const { state, actions } = useWorldStudio();
  const prefabs = state.prefabs;

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    prefab: Prefab;
  } | null>(null);

  // Filtered prefabs
  const filtered = useMemo(() => {
    if (!search.trim()) return prefabs;
    const q = search.toLowerCase();
    return prefabs.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q),
    );
  }, [prefabs, search]);

  // Place prefab — enter placement mode with first entity as template
  const handlePlace = useCallback(
    (prefab: Prefab) => {
      if (prefab.entries.length === 0) return;
      const first = prefab.entries[0];
      actions.startPlacement(
        first.entityType,
        first.templateId,
        `${prefab.name} (prefab)`,
      );
    },
    [actions],
  );

  // Rename
  const startRename = useCallback((prefab: Prefab) => {
    setEditingId(prefab.id);
    setEditName(prefab.name);
    setContextMenu(null);
  }, []);

  const commitRename = useCallback(
    (prefabId: string) => {
      if (editName.trim()) {
        actions.updatePrefab(prefabId, { name: editName.trim() });
      }
      setEditingId(null);
    },
    [actions, editName],
  );

  // Delete
  const handleDelete = useCallback(
    (prefab: Prefab) => {
      actions.removePrefab(prefab.id);
      setContextMenu(null);
    },
    [actions],
  );

  // Export JSON
  const handleExport = useCallback((prefab: Prefab) => {
    const json = JSON.stringify(prefab, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${prefab.name.replace(/[^a-zA-Z0-9-_]/g, "_")}.prefab.json`;
    a.click();
    URL.revokeObjectURL(url);
    setContextMenu(null);
  }, []);

  // Context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, prefab: Prefab) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, prefab });
    },
    [],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-700/50">
        <div className="flex items-center gap-2 mb-2">
          <Package size={14} className="text-purple-400" />
          <span className="text-xs font-semibold text-gray-200 uppercase tracking-[0.12em]">
            Prefabs
          </span>
          <span className="text-[10px] text-gray-500 ml-auto">
            {prefabs.length}
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prefabs..."
            className="w-full pl-7 pr-2 py-1 text-xs bg-gray-800 border border-gray-700/50 rounded text-gray-300 placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
          />
        </div>
      </div>

      {/* Prefab grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <div className="text-center text-xs text-gray-500 py-8">
            {prefabs.length === 0
              ? "No prefabs yet. Select entities and use right-click → Create Prefab."
              : "No prefabs match your search."}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {filtered.map((prefab) => (
              <div
                key={prefab.id}
                className="group bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700/30 hover:border-purple-500/30 rounded p-2 cursor-pointer transition-colors ease-out"
                onContextMenu={(e) => handleContextMenu(e, prefab)}
                onClick={() => handlePlace(prefab)}
                title={`Click to place • Right-click for options\n${prefab.description ?? ""}`}
              >
                {/* Name */}
                {editingId === prefab.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => commitRename(prefab.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(prefab.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="w-full text-xs bg-gray-900 border border-purple-500/50 rounded px-1 py-0.5 text-gray-200 focus:outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div className="text-xs font-medium text-gray-200 truncate">
                    {prefab.name}
                  </div>
                )}

                {/* Entity count + place icon */}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-gray-500">
                    {prefab.entries.length} entit
                    {prefab.entries.length === 1 ? "y" : "ies"}
                  </span>
                  <MapPin
                    size={10}
                    className="text-gray-600 group-hover:text-purple-400 transition-colors ease-out"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 bg-gray-800 border border-gray-600 rounded shadow-xl py-1 min-w-[140px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
              onClick={() => handlePlace(contextMenu.prefab)}
            >
              <MapPin size={12} /> Place
            </button>
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
              onClick={() => startRename(contextMenu.prefab)}
            >
              <Pencil size={12} /> Rename
            </button>
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
              onClick={() => handleExport(contextMenu.prefab)}
            >
              <Download size={12} /> Export JSON
            </button>
            <div className="border-t border-gray-700 my-1" />
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-gray-700"
              onClick={() => handleDelete(contextMenu.prefab)}
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
