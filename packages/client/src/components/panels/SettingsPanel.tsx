import React, { useEffect, useMemo, useRef, useState } from "react";
import { isTouch } from "@hyperscape/shared";
import type { ClientWorld } from "../../types";
import { useFullscreen } from "../useFullscreen";

interface SettingsPanelProps {
  world: ClientWorld;
}

const shadowOptions = [
  { label: "None", value: "none" },
  { label: "Low", value: "low" },
  { label: "Med", value: "med" },
  { label: "High", value: "high" },
];

type TabType = "visuals" | "interface" | "audio" | "backend";

export function SettingsPanel({ world }: SettingsPanelProps) {
  const prefs = world.prefs;
  const player = world.entities?.player;

  // State management
  const [activeTab, setActiveTab] = useState<TabType>("visuals");
  const [name, setName] = useState(() => player?.name || "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [dpr, setDPR] = useState(prefs?.dpr || 1);
  const [shadows, setShadows] = useState(prefs?.shadows || "med");
  const [postprocessing, setPostprocessing] = useState(
    prefs?.postprocessing ?? true,
  );
  const [bloom, setBloom] = useState(prefs?.bloom ?? true);
  const [music, setMusic] = useState(prefs?.music || 0.5);
  const [sfx, setSFX] = useState(prefs?.sfx || 0.5);
  const [voice, setVoice] = useState(prefs?.voice || 1);
  const [uiScale, setUiScale] = useState(prefs?.ui || 1);
  const [statsOn, setStatsOn] = useState(prefs?.stats || false);

  const nullRef = useRef<HTMLElement | null>(null);
  const [canFullscreen, isFullscreen, toggleFullscreen] = useFullscreen(
    nullRef as React.RefObject<HTMLElement>,
  );

  const changeName = (newName: string) => {
    if (!newName) return setName(player!.name || "");
    player!.name = newName;
    setName(newName);
    setIsEditingName(false);
    setTempName(newName);

    world.network?.send?.("chat", {
      type: "system",
      message: `Changed name to ${newName}`,
    });
  };

  // Sync music preference with localStorage
  useEffect(() => {
    const enabled = music > 0;
    localStorage.setItem("music_enabled", String(enabled));
  }, [music]);

  const dprOptions = useMemo(() => {
    const dpr = window.devicePixelRatio;
    const options: Array<{ label: string; value: number }> = [];
    options.push({ label: "0.5x", value: 0.5 });
    options.push({ label: "1x", value: 1 });
    if (dpr >= 2) options.push({ label: "2x", value: 2 });
    if (dpr >= 3) options.push({ label: "3x", value: dpr });
    return options;
  }, []);

  useEffect(() => {
    const onPrefsChange = (c: unknown) => {
      const changes = c as Record<string, { value: unknown }>;
      if (changes.dpr) setDPR(changes.dpr.value as number);
      if (changes.shadows) setShadows(changes.shadows.value as string);
      if (changes.postprocessing)
        setPostprocessing(changes.postprocessing.value as boolean);
      if (changes.bloom) setBloom(changes.bloom.value as boolean);
      if (changes.music) setMusic(changes.music.value as number);
      if (changes.sfx) setSFX(changes.sfx.value as number);
      if (changes.voice) setVoice(changes.voice.value as number);
      if (changes.ui) setUiScale(changes.ui.value as number);
      if (changes.stats) setStatsOn(changes.stats.value as boolean);
    };
    prefs?.on?.("change", onPrefsChange);
    return () => {
      prefs?.off?.("change", onPrefsChange);
    };
  }, [prefs]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab Navigation */}
      <div
        className="flex gap-0.5 mb-1 p-0.5 bg-black/30 rounded border"
        style={{ borderColor: "rgba(242, 208, 138, 0.2)" }}
      >
        <button
          onClick={() => setActiveTab("visuals")}
          className="flex-1 py-1 px-1.5 rounded text-[9px] font-medium transition-all"
          style={{
            backgroundColor:
              activeTab === "visuals"
                ? "rgba(242, 208, 138, 0.2)"
                : "transparent",
            borderColor:
              activeTab === "visuals"
                ? "rgba(242, 208, 138, 0.4)"
                : "transparent",
            color:
              activeTab === "visuals" ? "#f2d08a" : "rgba(242, 208, 138, 0.6)",
            border: "1px solid",
          }}
        >
          ✨ Visual
        </button>
        <button
          onClick={() => setActiveTab("interface")}
          className="flex-1 py-1 px-1.5 rounded text-[9px] font-medium transition-all"
          style={{
            backgroundColor:
              activeTab === "interface"
                ? "rgba(242, 208, 138, 0.2)"
                : "transparent",
            borderColor:
              activeTab === "interface"
                ? "rgba(242, 208, 138, 0.4)"
                : "transparent",
            color:
              activeTab === "interface"
                ? "#f2d08a"
                : "rgba(242, 208, 138, 0.6)",
            border: "1px solid",
          }}
        >
          🎮 UI
        </button>
        <button
          onClick={() => setActiveTab("audio")}
          className="flex-1 py-1 px-1.5 rounded text-[9px] font-medium transition-all"
          style={{
            backgroundColor:
              activeTab === "audio"
                ? "rgba(242, 208, 138, 0.2)"
                : "transparent",
            borderColor:
              activeTab === "audio"
                ? "rgba(242, 208, 138, 0.4)"
                : "transparent",
            color:
              activeTab === "audio" ? "#f2d08a" : "rgba(242, 208, 138, 0.6)",
            border: "1px solid",
          }}
        >
          🔊 Audio
        </button>
        <button
          onClick={() => setActiveTab("backend")}
          className="flex-1 py-1 px-1.5 rounded text-[9px] font-medium transition-all"
          style={{
            backgroundColor:
              activeTab === "backend"
                ? "rgba(242, 208, 138, 0.2)"
                : "transparent",
            borderColor:
              activeTab === "backend"
                ? "rgba(242, 208, 138, 0.4)"
                : "transparent",
            color:
              activeTab === "backend" ? "#f2d08a" : "rgba(242, 208, 138, 0.6)",
            border: "1px solid",
          }}
        >
          ⚙️ Backend
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto noscrollbar p-0.5">
        <div className="flex flex-col gap-1">
          {/* Visuals Tab */}
          {activeTab === "visuals" && (
            <>
              {/* Visual Quality Settings */}
              <div
                className="bg-gradient-to-br from-black/40 to-black/25 border rounded p-1"
                style={{ borderColor: "rgba(242, 208, 138, 0.25)" }}
              >
                <div className="flex items-center gap-0.5 mb-1">
                  <span className="text-[10px]">✨</span>
                  <span
                    className="text-[9px] font-semibold"
                    style={{ color: "#f2d08a" }}
                  >
                    Visual Quality
                  </span>
                </div>

                <div className="space-y-1">
                  {/* Resolution */}
                  <div>
                    <div
                      className="text-[8px] mb-0.5"
                      style={{ color: "rgba(242, 208, 138, 0.9)" }}
                    >
                      Resolution
                    </div>
                    <div className="flex gap-0.5">
                      {dprOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setDPR(opt.value);
                            prefs?.setDPR?.(opt.value);
                          }}
                          className="flex-1 text-[8px] py-0.5 px-1 rounded transition-all border"
                          style={{
                            backgroundColor:
                              dpr === opt.value
                                ? "rgba(242, 208, 138, 0.15)"
                                : "rgba(0, 0, 0, 0.2)",
                            borderColor:
                              dpr === opt.value
                                ? "rgba(242, 208, 138, 0.4)"
                                : "rgba(242, 208, 138, 0.2)",
                            color:
                              dpr === opt.value
                                ? "#f2d08a"
                                : "rgba(242, 208, 138, 0.6)",
                            cursor: "pointer",
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Shadow Quality */}
                  <div>
                    <div
                      className="text-[8px] mb-0.5"
                      style={{ color: "rgba(242, 208, 138, 0.9)" }}
                    >
                      Shadows
                    </div>
                    <div className="flex gap-0.5">
                      {shadowOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setShadows(opt.value);
                            prefs?.setShadows?.(opt.value);
                          }}
                          className="flex-1 text-[8px] py-0.5 px-1 rounded transition-all border"
                          style={{
                            backgroundColor:
                              shadows === opt.value
                                ? "rgba(242, 208, 138, 0.15)"
                                : "rgba(0, 0, 0, 0.2)",
                            borderColor:
                              shadows === opt.value
                                ? "rgba(242, 208, 138, 0.4)"
                                : "rgba(242, 208, 138, 0.2)",
                            color:
                              shadows === opt.value
                                ? "#f2d08a"
                                : "rgba(242, 208, 138, 0.6)",
                            cursor: "pointer",
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Post-Processing & Bloom */}
                  <div className="grid grid-cols-2 gap-0.5">
                    <button
                      onClick={() => {
                        const next = !postprocessing;
                        setPostprocessing(next);
                        prefs?.setPostprocessing?.(next);
                      }}
                      className="p-0.5 rounded transition-all border"
                      style={{
                        backgroundColor: postprocessing
                          ? "rgba(34, 197, 94, 0.08)"
                          : "rgba(0, 0, 0, 0.2)",
                        borderColor: postprocessing
                          ? "rgba(34, 197, 94, 0.3)"
                          : "rgba(242, 208, 138, 0.2)",
                        cursor: "pointer",
                      }}
                    >
                      <div className="flex items-center gap-0.5">
                        <span className="text-[9px]">🎨</span>
                        <div className="flex-1 text-left">
                          <div
                            className="text-[8px]"
                            style={{ color: "rgba(242, 208, 138, 0.9)" }}
                          >
                            Effects
                          </div>
                        </div>
                        <div
                          className="w-2.5 h-2.5 rounded-full flex items-center justify-center text-[7px]"
                          style={{
                            backgroundColor: postprocessing
                              ? "rgba(34, 197, 94, 0.2)"
                              : "rgba(107, 114, 128, 0.2)",
                            color: postprocessing ? "#22c55e" : "#6b7280",
                          }}
                        >
                          {postprocessing ? "✓" : "○"}
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        const next = !bloom;
                        setBloom(next);
                        prefs?.setBloom?.(next);
                      }}
                      disabled={!postprocessing}
                      className="p-0.5 rounded transition-all border"
                      style={{
                        backgroundColor:
                          bloom && postprocessing
                            ? "rgba(34, 197, 94, 0.08)"
                            : "rgba(0, 0, 0, 0.2)",
                        borderColor:
                          bloom && postprocessing
                            ? "rgba(34, 197, 94, 0.3)"
                            : "rgba(242, 208, 138, 0.2)",
                        cursor: postprocessing ? "pointer" : "not-allowed",
                        opacity: postprocessing ? 1 : 0.5,
                      }}
                    >
                      <div className="flex items-center gap-0.5">
                        <span className="text-[9px]">💫</span>
                        <div className="flex-1 text-left">
                          <div
                            className="text-[8px]"
                            style={{ color: "rgba(242, 208, 138, 0.9)" }}
                          >
                            Bloom
                          </div>
                        </div>
                        <div
                          className="w-2.5 h-2.5 rounded-full flex items-center justify-center text-[7px]"
                          style={{
                            backgroundColor:
                              bloom && postprocessing
                                ? "rgba(34, 197, 94, 0.2)"
                                : "rgba(107, 114, 128, 0.2)",
                            color:
                              bloom && postprocessing ? "#22c55e" : "#6b7280",
                          }}
                        >
                          {bloom && postprocessing ? "✓" : "○"}
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Interface Tab */}
          {activeTab === "interface" && (
            <>
              {/* Character Name Card */}
              <div
                className="bg-gradient-to-br from-black/40 to-black/25 border rounded p-1"
                style={{ borderColor: "rgba(242, 208, 138, 0.25)" }}
              >
                <div className="flex items-center gap-0.5 mb-1">
                  <span className="text-[10px]">⚔️</span>
                  <span
                    className="text-[9px] font-semibold uppercase tracking-wide"
                    style={{ color: "#f2d08a" }}
                  >
                    Name
                  </span>
                </div>

                {!isEditingName ? (
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[10px] font-medium"
                      style={{ color: "rgba(242, 208, 138, 0.95)" }}
                    >
                      {name || "Unknown"}
                    </span>
                    <button
                      onClick={() => {
                        setIsEditingName(true);
                        setTempName(name);
                      }}
                      className="text-[8px] rounded px-1.5 py-0.5 cursor-pointer transition-all hover:scale-105"
                      style={{
                        backgroundColor: "rgba(242, 208, 138, 0.12)",
                        border: "1px solid rgba(242, 208, 138, 0.3)",
                        color: "#f2d08a",
                      }}
                    >
                      ✎ Edit
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      className="w-full text-[10px] py-1 px-1.5 bg-white/5 border rounded focus:outline-none focus:ring-1"
                      style={{
                        borderColor: "rgba(242, 208, 138, 0.3)",
                        color: "#f2d08a",
                      }}
                      placeholder="Enter name..."
                      maxLength={20}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") changeName(tempName);
                        if (e.key === "Escape") {
                          setIsEditingName(false);
                          setTempName(name);
                        }
                      }}
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => changeName(tempName)}
                        className="flex-1 text-[8px] rounded px-1.5 py-0.5 cursor-pointer transition-all hover:scale-105"
                        style={{
                          backgroundColor: "rgba(34, 197, 94, 0.2)",
                          border: "1px solid rgba(34, 197, 94, 0.4)",
                          color: "#22c55e",
                        }}
                      >
                        ✓ Save
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingName(false);
                          setTempName(name);
                        }}
                        className="flex-1 text-[8px] rounded px-1.5 py-0.5 cursor-pointer transition-all hover:scale-105"
                        style={{
                          backgroundColor: "rgba(107, 114, 128, 0.2)",
                          border: "1px solid rgba(107, 114, 128, 0.4)",
                          color: "#9ca3af",
                        }}
                      >
                        ✕ Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Interface Settings Card */}
              <div
                className="bg-gradient-to-br from-black/40 to-black/25 border rounded p-1"
                style={{ borderColor: "rgba(242, 208, 138, 0.25)" }}
              >
                <div className="flex items-center gap-0.5 mb-1">
                  <span className="text-[10px]">🎮</span>
                  <span
                    className="text-[9px] font-semibold"
                    style={{ color: "#f2d08a" }}
                  >
                    Interface
                  </span>
                </div>

                <div className="space-y-1">
                  {/* UI Scale */}
                  <div>
                    <div className="flex justify-between items-center mb-0.5">
                      <span
                        className="text-[8px]"
                        style={{ color: "rgba(242, 208, 138, 0.9)" }}
                      >
                        UI Scale
                      </span>
                      <span
                        className="text-[8px] font-mono px-1 py-0.5 rounded"
                        style={{
                          backgroundColor: "rgba(242, 208, 138, 0.15)",
                          color: "#f2d08a",
                        }}
                      >
                        {uiScale.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.6}
                      max={1.6}
                      step={0.05}
                      value={uiScale}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setUiScale(v);
                        prefs?.setUI?.(v);
                      }}
                      className="w-full h-1 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #f2d08a 0%, #f2d08a ${((uiScale - 0.6) / 1.0) * 100}%, rgba(242, 208, 138, 0.2) ${((uiScale - 0.6) / 1.0) * 100}%, rgba(242, 208, 138, 0.2) 100%)`,
                      }}
                    />
                  </div>

                  {/* Quick Toggles */}
                  <div className="grid grid-cols-2 gap-0.5">
                    {/* Fullscreen */}
                    <button
                      onClick={() => {
                        if (canFullscreen)
                          toggleFullscreen(!(isFullscreen as boolean));
                      }}
                      disabled={!canFullscreen}
                      className="p-0.5 rounded transition-all border"
                      style={{
                        backgroundColor: (isFullscreen as boolean)
                          ? "rgba(34, 197, 94, 0.08)"
                          : "rgba(0, 0, 0, 0.2)",
                        borderColor: (isFullscreen as boolean)
                          ? "rgba(34, 197, 94, 0.3)"
                          : "rgba(242, 208, 138, 0.2)",
                        cursor: canFullscreen ? "pointer" : "not-allowed",
                        opacity: canFullscreen ? 1 : 0.5,
                      }}
                    >
                      <div className="flex items-center gap-0.5">
                        <span className="text-[9px]">🖥️</span>
                        <div className="flex-1 text-left">
                          <div
                            className="text-[8px]"
                            style={{ color: "rgba(242, 208, 138, 0.9)" }}
                          >
                            Fullscreen
                          </div>
                        </div>
                        <div
                          className="w-2.5 h-2.5 rounded-full flex items-center justify-center text-[7px]"
                          style={{
                            backgroundColor: (isFullscreen as boolean)
                              ? "rgba(34, 197, 94, 0.2)"
                              : "rgba(107, 114, 128, 0.2)",
                            color: (isFullscreen as boolean)
                              ? "#22c55e"
                              : "#6b7280",
                          }}
                        >
                          {(isFullscreen as boolean) ? "✓" : "○"}
                        </div>
                      </div>
                    </button>

                    {/* Performance Stats */}
                    <button
                      onClick={() => {
                        const next = !statsOn;
                        setStatsOn(next);
                        prefs?.setStats?.(next);
                      }}
                      className="p-0.5 rounded transition-all border"
                      style={{
                        backgroundColor: statsOn
                          ? "rgba(34, 197, 94, 0.08)"
                          : "rgba(0, 0, 0, 0.2)",
                        borderColor: statsOn
                          ? "rgba(34, 197, 94, 0.3)"
                          : "rgba(242, 208, 138, 0.2)",
                        cursor: "pointer",
                      }}
                    >
                      <div className="flex items-center gap-0.5">
                        <span className="text-[9px]">📊</span>
                        <div className="flex-1 text-left">
                          <div
                            className="text-[8px]"
                            style={{ color: "rgba(242, 208, 138, 0.9)" }}
                          >
                            Stats
                          </div>
                        </div>
                        <div
                          className="w-2.5 h-2.5 rounded-full flex items-center justify-center text-[7px]"
                          style={{
                            backgroundColor: statsOn
                              ? "rgba(34, 197, 94, 0.2)"
                              : "rgba(107, 114, 128, 0.2)",
                            color: statsOn ? "#22c55e" : "#6b7280",
                          }}
                        >
                          {statsOn ? "✓" : "○"}
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Hide Interface Button */}
                  {!isTouch && (
                    <button
                      onClick={() => world.ui?.toggleVisible?.()}
                      className="w-full text-[8px] rounded py-0.5 px-1.5 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] border"
                      style={{
                        backgroundColor: "rgba(139, 69, 19, 0.2)",
                        borderColor: "rgba(139, 69, 19, 0.4)",
                        color: "#f2d08a",
                      }}
                    >
                      <span className="flex items-center justify-center gap-1">
                        <span>🙈</span>
                        <span>Hide UI</span>
                        <span className="text-[7px] opacity-60">(Z)</span>
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Audio Tab */}
          {activeTab === "audio" && (
            <>
              {/* Audio Settings Card */}
              <div
                className="bg-gradient-to-br from-black/40 to-black/25 border rounded p-1"
                style={{ borderColor: "rgba(242, 208, 138, 0.25)" }}
              >
                <div className="flex items-center gap-0.5 mb-1">
                  <span className="text-[10px]">🔊</span>
                  <span
                    className="text-[9px] font-semibold"
                    style={{ color: "#f2d08a" }}
                  >
                    Audio
                  </span>
                </div>

                <div className="space-y-1">
                  {/* Music Volume */}
                  <div>
                    <div className="flex justify-between items-center mb-0.5">
                      <div className="flex items-center gap-0.5">
                        <span className="text-[9px]">🎵</span>
                        <span
                          className="text-[8px]"
                          style={{ color: "rgba(242, 208, 138, 0.9)" }}
                        >
                          Music
                        </span>
                      </div>
                      <span
                        className="text-[8px] font-mono px-1 py-0.5 rounded"
                        style={{
                          backgroundColor: "rgba(242, 208, 138, 0.15)",
                          color: "#f2d08a",
                        }}
                      >
                        {Math.round(music * 50)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      value={music}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setMusic(v);
                        prefs?.setMusic?.(v);
                      }}
                      className="w-full h-1 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #f2d08a 0%, #f2d08a ${(music / 2) * 100}%, rgba(242, 208, 138, 0.2) ${(music / 2) * 100}%, rgba(242, 208, 138, 0.2) 100%)`,
                      }}
                    />
                  </div>

                  {/* Effects Volume */}
                  <div>
                    <div className="flex justify-between items-center mb-0.5">
                      <div className="flex items-center gap-0.5">
                        <span className="text-[9px]">💥</span>
                        <span
                          className="text-[8px]"
                          style={{ color: "rgba(242, 208, 138, 0.9)" }}
                        >
                          Effects
                        </span>
                      </div>
                      <span
                        className="text-[8px] font-mono px-1 py-0.5 rounded"
                        style={{
                          backgroundColor: "rgba(242, 208, 138, 0.15)",
                          color: "#f2d08a",
                        }}
                      >
                        {Math.round(sfx * 50)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      value={sfx}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setSFX(v);
                        prefs?.setSFX?.(v);
                      }}
                      className="w-full h-1 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #f2d08a 0%, #f2d08a ${(sfx / 2) * 100}%, rgba(242, 208, 138, 0.2) ${(sfx / 2) * 100}%, rgba(242, 208, 138, 0.2) 100%)`,
                      }}
                    />
                  </div>

                  {/* Voice Volume */}
                  <div>
                    <div className="flex justify-between items-center mb-0.5">
                      <div className="flex items-center gap-0.5">
                        <span className="text-[9px]">🎤</span>
                        <span
                          className="text-[8px]"
                          style={{ color: "rgba(242, 208, 138, 0.9)" }}
                        >
                          Voice
                        </span>
                      </div>
                      <span
                        className="text-[8px] font-mono px-1 py-0.5 rounded"
                        style={{
                          backgroundColor: "rgba(242, 208, 138, 0.15)",
                          color: "#f2d08a",
                        }}
                      >
                        {Math.round(voice * 50)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      value={voice}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setVoice(v);
                        prefs?.setVoice?.(v);
                      }}
                      className="w-full h-1 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #f2d08a 0%, #f2d08a ${(voice / 2) * 100}%, rgba(242, 208, 138, 0.2) ${(voice / 2) * 100}%, rgba(242, 208, 138, 0.2) 100%)`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Backend Tab */}
          {activeTab === "backend" && (
            <>
              {/* Renderer Status Card */}
              <div
                className="relative bg-gradient-to-br from-black/50 to-black/30 border rounded p-1.5 overflow-hidden"
                style={{
                  borderColor: world.graphics?.isWebGPU
                    ? "rgba(34, 197, 94, 0.4)"
                    : "rgba(96, 165, 250, 0.4)",
                  boxShadow: world.graphics?.isWebGPU
                    ? "0 0 10px rgba(34, 197, 94, 0.1)"
                    : "0 0 10px rgba(96, 165, 250, 0.1)",
                }}
              >
                {/* Decorative glow effect */}
                <div
                  className="absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl opacity-15"
                  style={{
                    background: world.graphics?.isWebGPU
                      ? "#22c55e"
                      : "#60a5fa",
                    transform: "translate(30%, -30%)",
                  }}
                />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      <div
                        className="w-1 h-1 rounded-full animate-pulse"
                        style={{
                          backgroundColor: world.graphics?.isWebGPU
                            ? "#22c55e"
                            : "#60a5fa",
                        }}
                      />
                      <span
                        className="text-[8px] uppercase tracking-wider"
                        style={{ color: "rgba(242, 208, 138, 0.6)" }}
                      >
                        Graphics Backend
                      </span>
                    </div>
                    <span
                      className="text-[7px] font-medium px-1 py-0.5 rounded-full"
                      style={{
                        backgroundColor: world.graphics?.isWebGPU
                          ? "rgba(34, 197, 94, 0.15)"
                          : "rgba(96, 165, 250, 0.15)",
                        color: world.graphics?.isWebGPU ? "#22c55e" : "#60a5fa",
                        border: `1px solid ${world.graphics?.isWebGPU ? "rgba(34, 197, 94, 0.3)" : "rgba(96, 165, 250, 0.3)"}`,
                      }}
                    >
                      {world.graphics?.isWebGPU ? "⚡ Modern" : "🔷 Compatible"}
                    </span>
                  </div>

                  <div
                    className="text-sm font-bold mb-0.5"
                    style={{ color: "#f2d08a" }}
                  >
                    {world.graphics?.isWebGPU ? "WebGPU" : "WebGL 2"}
                  </div>

                  <div
                    className="text-[8px]"
                    style={{ color: "rgba(242, 208, 138, 0.5)" }}
                  >
                    {world.graphics?.isWebGPU
                      ? "High-performance rendering"
                      : "Cross-browser compatible"}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
