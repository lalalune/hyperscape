import { Bot, BookOpen, Loader2, ScrollText, Sparkles } from "lucide-react";
import React, { useMemo, useState } from "react";

import { apiFetch } from "@/utils/api";

type ContentMode = "npc" | "quest" | "lore";
type Quality = "balanced" | "quality" | "speed";
type GeneratedContent = Record<string, unknown>;

const MODES: Array<{
  id: ContentMode;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  { id: "npc", label: "NPC", icon: Bot },
  { id: "quest", label: "Quest", icon: ScrollText },
  { id: "lore", label: "Lore", icon: BookOpen },
];

export const ContentGenerationPage: React.FC = () => {
  const [mode, setMode] = useState<ContentMode>("npc");
  const [quality, setQuality] = useState<Quality>("balanced");
  const [primary, setPrimary] = useState("merchant");
  const [prompt, setPrompt] = useState(
    "A memorable RuneScape-style character with a practical role in town.",
  );
  const [context, setContext] = useState("");
  const [result, setResult] = useState<GeneratedContent | null>(null);
  const [rawResponse, setRawResponse] = useState("");
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const fieldLabels = useMemo(() => {
    if (mode === "quest") {
      return {
        primary: "Quest Type",
        prompt: "Theme",
        placeholder: "A compact starter quest with a surprising local mystery.",
      };
    }
    if (mode === "lore") {
      return {
        primary: "Category",
        prompt: "Topic",
        placeholder: "The origin of a mountain pass used by traders.",
      };
    }
    return {
      primary: "Archetype",
      prompt: "Prompt",
      placeholder:
        "A memorable RuneScape-style character with a practical role in town.",
    };
  }, [mode]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError("");
    setResult(null);
    setRawResponse("");

    const endpoint =
      mode === "npc"
        ? "/api/content/generate-npc"
        : mode === "quest"
          ? "/api/content/generate-quest"
          : "/api/content/generate-lore";

    const body =
      mode === "npc"
        ? { archetype: primary, prompt, context, quality }
        : mode === "quest"
          ? {
              questType: primary,
              difficulty: "medium",
              theme: prompt,
              context,
              quality,
            }
          : { category: primary, topic: prompt, context, quality };

    try {
      const response = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        timeoutMs: 60000,
      });

      if (!response.ok) {
        throw new Error(`Generation failed (${response.status})`);
      }

      const data = (await response.json()) as Record<string, unknown>;
      const content = data.npc ?? data.quest ?? data.lore;
      setResult(
        content && typeof content === "object"
          ? (content as GeneratedContent)
          : data,
      );
      setRawResponse(
        typeof data.rawResponse === "string" ? data.rawResponse : "",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const activeMode = MODES.find((item) => item.id === mode) ?? MODES[0];
  const ActiveIcon = activeMode.icon;

  return (
    <div className="page-container p-6">
      <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[22rem_1fr]">
        <section className="card p-4 bg-bg-secondary border border-border-primary space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            <h1 className="text-lg font-semibold text-text-primary">
              Content Generation
            </h1>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {MODES.map((item) => {
              const Icon = item.icon;
              const active = item.id === mode;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "border-primary bg-primary bg-opacity-15 text-primary"
                      : "border-border-primary bg-bg-primary text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              );
            })}
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-text-secondary">
              {fieldLabels.primary}
            </span>
            <input
              value={primary}
              onChange={(event) => setPrimary(event.target.value)}
              className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-text-secondary">
              {fieldLabels.prompt}
            </span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={fieldLabels.placeholder}
              rows={4}
              className="w-full resize-none rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-text-secondary">
              Context
            </span>
            <textarea
              value={context}
              onChange={(event) => setContext(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-text-secondary">
              Provider Mode
            </span>
            <select
              value={quality}
              onChange={(event) => setQuality(event.target.value as Quality)}
              className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
            >
              <option value="balanced">Balanced</option>
              <option value="quality">Quality</option>
              <option value="speed">Speed</option>
            </select>
          </label>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !primary.trim() || !prompt.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ActiveIcon size={16} />
            )}
            Generate {activeMode.label}
          </button>
        </section>

        <section className="card overflow-hidden bg-bg-secondary border border-border-primary">
          <div className="border-b border-border-primary px-4 py-3">
            <h2 className="text-sm font-semibold text-text-primary">Result</h2>
          </div>
          <div className="h-full overflow-auto p-4">
            {error && (
              <div className="rounded-lg border border-error bg-error bg-opacity-10 p-3 text-sm text-error">
                {error}
              </div>
            )}
            {!error && !result && (
              <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
                Generated content will appear here.
              </div>
            )}
            {result && (
              <div className="space-y-4">
                <pre className="whitespace-pre-wrap rounded-lg bg-bg-primary p-4 text-xs text-text-secondary">
                  {JSON.stringify(result, null, 2)}
                </pre>
                {rawResponse && (
                  <details className="rounded-lg border border-border-primary bg-bg-primary p-3 text-xs text-text-secondary">
                    <summary className="cursor-pointer text-text-primary">
                      Raw response
                    </summary>
                    <pre className="mt-3 whitespace-pre-wrap">
                      {rawResponse}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ContentGenerationPage;
