"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui";
import { Globe, RefreshCw } from "lucide-react";
import { getWorldState } from "@/lib/actions/world";
import { WorldCanvas } from "@/components/world/world-canvas";
import { WorldSidebar } from "@/components/world/world-sidebar";
import { WorldInspector } from "@/components/world/world-inspector";

export default function WorldPage() {
  const [worldState, setWorldState] = useState<Awaited<
    ReturnType<typeof getWorldState>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const fetchWorld = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getWorldState();
      setWorldState(data);
    } catch (error) {
      console.error("Failed to fetch world state:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorld();
  }, [fetchWorld]);

  const selectedZone =
    worldState?.zones.find((z) => z.id === selectedNodeId) || null;
  const selectedEntity =
    worldState?.entities.find((e) => e.id === selectedNodeId) || null;

  return (
    <div
      className="h-[calc(100vh-140px)] bg-(--bg-primary) flex flex-col overflow-hidden rounded-lg border border-(--border-primary) shadow-2xl"
      style={{ maxHeight: "calc(100vh - 140px)" }}
    >
      {/* Tactical Header */}
      <div className="shrink-0 h-14 bg-(--bg-secondary) border-b border-(--border-primary) flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-(--accent-primary)" />
          <div>
            <h1 className="text-sm font-bold text-(--text-primary) uppercase tracking-widest leading-none">
              World Cartograph<span className="text-(--accent-primary)">y</span>
            </h1>
            <p className="text-[10px] text-(--text-muted) font-mono uppercase tracking-wider">
              System v1.0.0 // Connected
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 mr-4 text-xs font-mono text-(--text-secondary)">
            <span>
              ZONES:{" "}
              <span className="text-(--text-primary)">
                {worldState?.zones.length || 0}
              </span>
            </span>
            <span className="mx-2 text-(--border-primary)">|</span>
            <span>
              ENTITIES:{" "}
              <span className="text-(--text-primary)">
                {worldState?.entities.length || 0}
              </span>
            </span>
          </div>

          <Button
            onClick={fetchWorld}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-(--text-secondary) hover:text-(--accent-primary)"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left Sidebar - Navigation */}
        <WorldSidebar
          zones={worldState?.zones || []}
          entities={worldState?.entities || []}
          selectedId={selectedNodeId}
          onSelect={setSelectedNodeId}
        />

        {/* Main Canvas */}
        <div className="flex-1 relative bg-[#050505] overflow-hidden min-h-0 min-w-0">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <Globe className="h-8 w-8 animate-pulse text-(--accent-primary)" />
                <p className="text-xs font-mono text-(--text-muted)">
                  SCANNING_TERRAIN...
                </p>
              </div>
            </div>
          ) : (
            <WorldCanvas
              zones={worldState?.zones || []}
              entities={worldState?.entities || []}
              selectedId={selectedNodeId}
              onSelect={setSelectedNodeId}
            />
          )}
        </div>

        {/* Right Inspector */}
        <WorldInspector
          zone={selectedZone}
          entity={selectedEntity}
          onClose={() => setSelectedNodeId(null)}
        />
      </div>
    </div>
  );
}
