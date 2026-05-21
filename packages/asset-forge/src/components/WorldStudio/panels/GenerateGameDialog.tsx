/**
 * GenerateGameDialog — AI-powered GameModule generation wizard.
 *
 * User describes a game in natural language, the LLM generates a complete
 * GameModule JSON. Supports iterative refinement, raw JSON editing, and
 * applying the generated module.
 */

import {
  X,
  Sparkles,
  Loader2,
  RefreshCw,
  Check,
  Code2,
  MessageSquare,
  ChevronDown,
  AlertTriangle,
  Copy,
  Download,
  Layers,
  Mountain,
} from "lucide-react";
import React, { useState, useCallback, useRef } from "react";

import type { GameModule } from "../../../gameModules/GameModule";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GenerateGameDialogProps {
  open: boolean;
  onClose: () => void;
  onApply?: (module: GameModule) => void;
}

interface GenerationState {
  status: "idle" | "generating" | "refining" | "success" | "error";
  module: GameModule | null;
  reasoning: string;
  error: string;
}

// ---------------------------------------------------------------------------
// Prompt chips
// ---------------------------------------------------------------------------

const PROMPT_CHIPS = [
  "Zombie survival with crafting and base building",
  "Fantasy card dungeon crawler",
  "Space colony builder with trade routes",
  "Retro platformer with collectibles",
  "Racing game with power-ups and tracks",
  "Tower defense with upgradeable turrets",
  "Farming simulator with seasons and livestock",
  "Pirate adventure with ship combat",
  "Cyberpunk detective RPG with hacking",
  "Medieval city builder with diplomacy",
];

const GENRE_OPTIONS = [
  { value: "", label: "Auto-detect" },
  { value: "rpg", label: "RPG" },
  { value: "action", label: "Action" },
  { value: "strategy", label: "Strategy" },
  { value: "simulation", label: "Simulation" },
  { value: "adventure", label: "Adventure" },
  { value: "puzzle", label: "Puzzle" },
  { value: "survival", label: "Survival" },
  { value: "sandbox", label: "Sandbox" },
  { value: "platformer", label: "Platformer" },
  { value: "racing", label: "Racing" },
];

const CONTENT_API = "/api/content";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GenerateGameDialog({
  open,
  onClose,
  onApply,
}: GenerateGameDialogProps) {
  // Form state
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("");
  const [entityCountMin, setEntityCountMin] = useState(6);
  const [entityCountMax, setEntityCountMax] = useState(15);
  const [includeAudio, setIncludeAudio] = useState(false);
  const [includeTerrain, setIncludeTerrain] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Generation state
  const [genState, setGenState] = useState<GenerationState>({
    status: "idle",
    module: null,
    reasoning: "",
    error: "",
  });

  // Refine state
  const [refineInput, setRefineInput] = useState("");

  // JSON editor state
  const [showJson, setShowJson] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");

  // Applied state
  const [applied, setApplied] = useState(false);

  // Abort controller ref
  const abortRef = useRef<AbortController | null>(null);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleGenerate = useCallback(async () => {
    if (!description.trim()) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setGenState({
      status: "generating",
      module: null,
      reasoning: "",
      error: "",
    });
    setApplied(false);
    setShowJson(false);
    setJsonError("");

    try {
      const res = await fetch(`${CONTENT_API}/generate-game-module`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          description: description.trim(),
          genre: genre || undefined,
          hints: {
            entityCountRange: [entityCountMin, entityCountMax] as [
              number,
              number,
            ],
            includeAudio,
            includeTerrain,
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status}: ${text}`);
      }

      const result = (await res.json()) as {
        module: GameModule;
        reasoning: string;
      };

      setGenState({
        status: "success",
        module: result.module,
        reasoning: result.reasoning,
        error: "",
      });
      setJsonText(JSON.stringify(result.module, null, 2));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Unknown error";
      setGenState((prev) => ({ ...prev, status: "error", error: message }));
    }
  }, [
    description,
    genre,
    entityCountMin,
    entityCountMax,
    includeAudio,
    includeTerrain,
  ]);

  const handleRefine = useCallback(async () => {
    if (!refineInput.trim() || !genState.module) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setGenState((prev) => ({ ...prev, status: "refining" }));
    setApplied(false);
    setJsonError("");

    try {
      const res = await fetch(`${CONTENT_API}/refine-game-module`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          currentModule: genState.module,
          instruction: refineInput.trim(),
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status}: ${text}`);
      }

      const result = (await res.json()) as {
        module: GameModule;
        changes: string;
      };

      setGenState({
        status: "success",
        module: result.module,
        reasoning: result.changes,
        error: "",
      });
      setJsonText(JSON.stringify(result.module, null, 2));
      setRefineInput("");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Unknown error";
      setGenState((prev) => ({ ...prev, status: "error", error: message }));
    }
  }, [refineInput, genState.module]);

  const handleApplyJsonEdits = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonText) as GameModule;
      // Basic type check
      if (!parsed.id || !parsed.name || !parsed.entityTypes) {
        throw new Error("Missing required fields: id, name, entityTypes");
      }
      setGenState((prev) => ({ ...prev, module: parsed }));
      setJsonError("");
      setShowJson(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid JSON";
      setJsonError(message);
    }
  }, [jsonText]);

  const handleApply = useCallback(() => {
    if (!genState.module) return;
    onApply?.(genState.module);
    setApplied(true);
  }, [genState.module, onApply]);

  const handleCopyJson = useCallback(() => {
    if (genState.module) {
      navigator.clipboard.writeText(JSON.stringify(genState.module, null, 2));
    }
  }, [genState.module]);

  const handleDownloadJson = useCallback(() => {
    if (!genState.module) return;
    const blob = new Blob([JSON.stringify(genState.module, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${genState.module.id}-module.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [genState.module]);

  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    setGenState({
      status: "idle",
      module: null,
      reasoning: "",
      error: "",
    });
    setDescription("");
    setGenre("");
    setRefineInput("");
    setShowJson(false);
    setJsonError("");
    setApplied(false);
    onClose();
  }, [onClose]);

  if (!open) return null;

  const isLoading =
    genState.status === "generating" || genState.status === "refining";
  const hasModule = genState.module !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-primary border border-border-primary rounded-lg shadow-2xl w-[960px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-primary flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-bg-tertiary border border-border-primary flex items-center justify-center">
              <Sparkles size={14} className="text-violet-400" />
            </div>
            <div>
              <span className="text-sm font-semibold text-text-primary">
                AI Game Generator
              </span>
              <p className="text-[10px] text-text-tertiary">
                Describe your game and let AI build the module
              </p>
            </div>
          </div>
          <button
            className="p-1 rounded hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary"
            onClick={handleClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left: Input panel */}
          <div className="w-[400px] border-r border-border-primary flex flex-col flex-shrink-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Description textarea */}
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1.5">
                  Describe Your Game
                </label>
                <textarea
                  className="w-full h-28 px-3 py-2 text-sm rounded-md resize-none text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary/50"
                  style={{
                    background: "var(--input-bg)",
                    border: "1px solid var(--input-border)",
                  }}
                  placeholder="A zombie survival game with base building, crafting systems, day/night cycles, and horde events..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              {/* Prompt chips */}
              <div>
                <label className="block text-[11px] font-medium text-text-tertiary mb-1.5">
                  Quick Ideas
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PROMPT_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      className="px-2 py-1 text-[10px] rounded-full border transition-colors text-text-tertiary hover:text-text-primary hover:border-primary/40 ease-out"
                      style={{ borderColor: "var(--border-secondary)" }}
                      onClick={() => setDescription(chip)}
                      disabled={isLoading}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Genre dropdown */}
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1.5">
                  Genre
                </label>
                <select
                  className="w-full px-2.5 py-1.5 text-xs rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
                  style={{
                    background: "var(--input-bg)",
                    border: "1px solid var(--input-border)",
                  }}
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  disabled={isLoading}
                >
                  {GENRE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Advanced options */}
              <div>
                <button
                  className="flex items-center gap-1 text-[11px] text-text-tertiary hover:text-text-secondary"
                  onClick={() => setShowAdvanced((v) => !v)}
                >
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${showAdvanced ? "rotate-180" : ""} ease-out`}
                  />
                  Advanced Options
                </button>

                {showAdvanced && (
                  <div className="mt-2 space-y-3 pl-1">
                    {/* Entity count range */}
                    <div>
                      <label className="block text-[10px] text-text-tertiary mb-1">
                        Entity Type Count: {entityCountMin}-{entityCountMax}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={3}
                          max={20}
                          value={entityCountMin}
                          onChange={(e) =>
                            setEntityCountMin(
                              Math.min(Number(e.target.value), entityCountMax),
                            )
                          }
                          className="flex-1 h-1 accent-primary"
                          disabled={isLoading}
                        />
                        <input
                          type="range"
                          min={3}
                          max={20}
                          value={entityCountMax}
                          onChange={(e) =>
                            setEntityCountMax(
                              Math.max(Number(e.target.value), entityCountMin),
                            )
                          }
                          className="flex-1 h-1 accent-primary"
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    {/* Toggles */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeTerrain}
                        onChange={(e) => setIncludeTerrain(e.target.checked)}
                        className="accent-primary"
                        disabled={isLoading}
                      />
                      <span className="text-[11px] text-text-secondary">
                        Include terrain config
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeAudio}
                        onChange={(e) => setIncludeAudio(e.target.checked)}
                        className="accent-primary"
                        disabled={isLoading}
                      />
                      <span className="text-[11px] text-text-secondary">
                        Include audio zones
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Generate button */}
            <div className="px-4 py-3 border-t border-border-primary flex-shrink-0">
              <button
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-primary text-white hover:bg-primary-dark shadow-lg ease-out"
                onClick={handleGenerate}
                disabled={!description.trim() || isLoading}
              >
                {genState.status === "generating" ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    {hasModule ? "Regenerate" : "Generate Game Module"}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right: Preview / Results */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {isLoading && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Loader2
                    size={28}
                    className="animate-spin text-violet-400 mx-auto mb-3"
                  />
                  <p className="text-sm text-text-secondary mb-1">
                    {genState.status === "generating"
                      ? "Generating your game module..."
                      : "Refining module..."}
                  </p>
                  <p className="text-[10px] text-text-tertiary">
                    This may take 15-30 seconds
                  </p>
                </div>
              </div>
            )}

            {genState.status === "error" && (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center max-w-sm">
                  <AlertTriangle
                    size={28}
                    className="text-red-400 mx-auto mb-3"
                  />
                  <p className="text-sm text-red-400 mb-2">Generation Failed</p>
                  <p className="text-[11px] text-text-tertiary mb-4">
                    {genState.error}
                  </p>
                  <button
                    className="px-4 py-1.5 text-xs rounded-md bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors ease-out"
                    onClick={handleGenerate}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {!isLoading && genState.status === "idle" && (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center max-w-sm">
                  <div className="w-16 h-16 rounded-2xl bg-bg-tertiary border border-border-primary flex items-center justify-center mx-auto mb-4">
                    <Sparkles size={28} className="text-violet-400/60" />
                  </div>
                  <p className="text-sm text-text-secondary mb-1">
                    Describe your game on the left
                  </p>
                  <p className="text-[11px] text-text-tertiary">
                    The AI will generate a complete game module with entity
                    types, categories, and configuration
                  </p>
                </div>
              </div>
            )}

            {hasModule && !isLoading && genState.status === "success" && (
              <>
                {/* Module preview */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Module header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">
                        {genState.module!.name}
                      </h3>
                      <p className="text-[10px] text-text-tertiary">
                        {genState.module!.id} v{genState.module!.version}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors ease-out"
                        onClick={handleCopyJson}
                        title="Copy JSON"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors ease-out"
                        onClick={handleDownloadJson}
                        title="Download JSON"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        className={`p-1.5 rounded-md transition-colors ${
                          showJson
                            ? "text-primary bg-primary/10"
                            : "text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary"
                        } ease-out`}
                        onClick={() => setShowJson((v) => !v)}
                        title="Toggle JSON Editor"
                      >
                        <Code2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Reasoning */}
                  {genState.reasoning && (
                    <div className="px-3 py-2 rounded-md bg-violet-500/5 border border-violet-500/15">
                      <p className="text-[11px] text-violet-300/80">
                        {genState.reasoning}
                      </p>
                    </div>
                  )}

                  {showJson ? (
                    /* JSON editor */
                    <div className="space-y-2">
                      <textarea
                        className="w-full h-[300px] px-3 py-2 text-[11px] font-mono rounded-md resize-none text-text-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
                        style={{
                          background: "var(--input-bg)",
                          border: "1px solid var(--input-border)",
                        }}
                        value={jsonText}
                        onChange={(e) => {
                          setJsonText(e.target.value);
                          setJsonError("");
                        }}
                      />
                      {jsonError && (
                        <p className="text-[10px] text-red-400">{jsonError}</p>
                      )}
                      <button
                        className="px-3 py-1.5 text-xs rounded-md bg-primary text-white hover:bg-primary/90"
                        onClick={handleApplyJsonEdits}
                      >
                        Apply JSON Changes
                      </button>
                    </div>
                  ) : (
                    /* Visual preview */
                    <>
                      {/* Stats summary */}
                      <div className="grid grid-cols-3 gap-2">
                        <StatCard
                          icon={Layers}
                          label="Entity Types"
                          value={genState.module!.entityTypes.length}
                        />
                        <StatCard
                          icon={Layers}
                          label="Categories"
                          value={genState.module!.paletteCategories.length}
                        />
                        <StatCard
                          icon={Mountain}
                          label="Terrain"
                          value={
                            genState.module!.terrain?.enabled
                              ? "Enabled"
                              : "None"
                          }
                        />
                      </div>

                      {/* Entity types grouped by category */}
                      {genState.module!.paletteCategories.map((cat) => {
                        const types = genState.module!.entityTypes.filter(
                          (et) => et.paletteCategory === cat.id,
                        );
                        if (types.length === 0) return null;
                        return (
                          <div key={cat.id}>
                            <h4 className="text-[11px] font-medium text-text-secondary mb-1.5">
                              {cat.label}
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                              {types.map((et) => (
                                <EntityChip
                                  key={et.id}
                                  name={et.name}
                                  color={et.color}
                                  fieldCount={et.fields.length}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      {/* Terrain biomes */}
                      {genState.module!.terrain?.enabled && (
                        <div>
                          <h4 className="text-[11px] font-medium text-text-secondary mb-1.5">
                            Biomes
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {genState.module!.terrain.biomes.map((biome) => (
                              <span
                                key={biome}
                                className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              >
                                {biome}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Refine input */}
                <div className="px-4 py-2 border-t border-border-primary flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <MessageSquare
                      size={14}
                      className="text-text-tertiary flex-shrink-0"
                    />
                    <input
                      type="text"
                      className="flex-1 px-2.5 py-1.5 text-xs rounded-md text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary/50"
                      style={{
                        background: "var(--input-bg)",
                        border: "1px solid var(--input-border)",
                      }}
                      placeholder="Refine: 'Add a vehicle system' or 'Remove audio entities'..."
                      value={refineInput}
                      onChange={(e) => setRefineInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && refineInput.trim()) {
                          handleRefine();
                        }
                      }}
                      disabled={isLoading}
                    />
                    <button
                      className="px-3 py-1.5 text-xs rounded-md bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40 ease-out"
                      onClick={handleRefine}
                      disabled={!refineInput.trim() || isLoading}
                    >
                      Refine
                    </button>
                  </div>
                </div>

                {/* Actions footer */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-border-primary flex-shrink-0">
                  <button
                    className="flex items-center gap-1.5 px-5 py-1.5 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors border border-border-primary ease-out"
                    onClick={handleGenerate}
                    disabled={isLoading}
                  >
                    <RefreshCw size={12} /> Regenerate
                  </button>

                  <div className="flex items-center gap-2">
                    {applied && (
                      <span className="text-[11px] text-emerald-400">
                        Module applied
                      </span>
                    )}
                    <button
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 ease-out"
                      onClick={handleApply}
                      disabled={isLoading || applied}
                    >
                      <Check size={14} />
                      {applied ? "Applied" : "Apply Module"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Layers;
  label: string;
  value: string | number;
}) {
  return (
    <div className="px-5 py-4 rounded-md bg-bg-secondary border border-border-secondary">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon size={12} className="text-text-tertiary" />
        <span className="text-[10px] text-text-tertiary">{label}</span>
      </div>
      <span className="text-sm font-semibold text-text-primary">{value}</span>
    </div>
  );
}

function EntityChip({
  name,
  color,
  fieldCount,
}: {
  name: string;
  color: string;
  fieldCount: number;
}) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px]"
      style={{
        borderColor: `${color}30`,
        background: `${color}08`,
      }}
    >
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: color }}
      />
      <span className="text-text-primary font-medium">{name}</span>
      <span className="text-text-tertiary text-[9px]">{fieldCount}f</span>
    </div>
  );
}
