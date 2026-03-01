import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  CircleUserRound,
  Sparkles,
  Layout,
  Volume2,
  Cpu,
  type LucideIcon,
} from "lucide-react";
import { isTouch } from "@hyperscape/shared";
import type { ClientWorld } from "../../types";
import { useFullscreen } from "../../hooks/useFullscreen";
import { ToggleSwitch, Slider } from "@/ui";
import { NAME_SANITIZE_REGEX } from "../../utils/validation";
import {
  useComplexityStore,
  useComplexityMode,
  COMPLEXITY_MODE_CONFIGS,
  useThemeStore,
  type ComplexityMode,
} from "@/ui";
import type { StatusBarsConfig } from "../hud/StatusBars";
import { privyAuthManager } from "../../auth/PrivyAuthManager";
import { useSolanaWallet } from "../../hooks/useSolanaWallet";
import {
  type GraphicsQuality,
  QUALITY_PRESETS,
  QUALITY_LEVELS,
  getQualityDisplayName,
  detectRecommendedQuality,
} from "../../types/embeddedConfig";

/** Minimum name length required for submission */
const MIN_NAME_LENGTH = 1;

/**
 * Sanitizes a name by trimming whitespace and removing invalid characters.
 * @param value - The raw input value
 * @returns Sanitized name string
 */
function sanitizeName(value: string): string {
  return value.trim().replace(NAME_SANITIZE_REGEX, "");
}

/**
 * Checks if a name is valid for submission.
 * @param name - The sanitized name to validate
 * @returns true if name meets minimum length requirements
 */
function isValidName(name: string): boolean {
  return name.length >= MIN_NAME_LENGTH;
}

interface SettingsPanelProps {
  world: ClientWorld;
}

const shadowOptions = [
  { label: "None", value: "none" },
  { label: "Low", value: "low" },
  { label: "Med", value: "med" },
  { label: "High", value: "high" },
];

const colorGradingOptions = [
  { label: "None", value: "none" },
  { label: "Cinematic", value: "cinematic" },
  { label: "Bourbon", value: "bourbon" },
  { label: "Chemical", value: "chemical" },
  { label: "Clayton", value: "clayton" },
  { label: "Cubicle", value: "cubicle" },
  { label: "Remy", value: "remy" },
  { label: "B&W", value: "bw" },
  { label: "Night", value: "night" },
];

const complexityModes: { mode: ComplexityMode; icon: string }[] = [
  { mode: "simple", icon: "🎮" },
  { mode: "standard", icon: "⚔️" },
  { mode: "advanced", icon: "🏰" },
];

/** Complexity mode selector component */
function ComplexityModeSelector(): React.ReactElement {
  const theme = useThemeStore((s) => s.theme);
  const currentMode = useComplexityMode();
  const { setMode } = useComplexityStore();
  const config = COMPLEXITY_MODE_CONFIGS[currentMode];

  return (
    <SettingsSection title="Interface Complexity">
      <div className="flex gap-1 mb-1.5">
        {complexityModes.map(({ mode, icon }) => {
          const isSelected = currentMode === mode;
          const modeConfig = COMPLEXITY_MODE_CONFIGS[mode];
          return (
            <button
              key={mode}
              onClick={() => setMode(mode)}
              className="flex-1 flex flex-col items-center py-1 rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
              style={{
                background: isSelected
                  ? `linear-gradient(180deg, ${theme.colors.accent.secondary}33 0%, ${theme.colors.border.decorative}40 100%)`
                  : theme.colors.slot.filled,
                border: isSelected
                  ? `1px solid ${theme.colors.accent.secondary}80`
                  : `1px solid ${theme.colors.border.default}4D`,
                cursor: "pointer",
              }}
              title={modeConfig.description}
            >
              <span style={{ fontSize: "12px" }}>{icon}</span>
              <span
                className="text-[8px] mt-0.5"
                style={{
                  color: isSelected
                    ? theme.colors.text.accent
                    : theme.colors.text.muted,
                }}
              >
                {modeConfig.displayName}
              </span>
            </button>
          );
        })}
      </div>
      <div
        className="text-[7px] px-1.5 py-1 rounded"
        style={{
          background: theme.colors.slot.filled,
          color: theme.colors.text.muted,
          border: `1px solid ${theme.colors.border.default}33`,
        }}
      >
        {config.description}
      </div>
    </SettingsSection>
  );
}

type TabType = "account" | "visuals" | "interface" | "audio" | "backend";

// Tab configuration - hoisted outside component to avoid recreation on each render
const SETTINGS_TABS: { id: TabType; Icon: LucideIcon; label: string }[] = [
  { id: "account", Icon: CircleUserRound, label: "Account" },
  { id: "visuals", Icon: Sparkles, label: "Visual" },
  { id: "interface", Icon: Layout, label: "UI" },
  { id: "audio", Icon: Volume2, label: "Audio" },
  { id: "backend", Icon: Cpu, label: "System" },
];

/** Cloud feature definitions */
const CLOUD_FEATURES = [
  {
    id: "sync",
    label: "Cross-Device Sync",
    description: "Play on any device with your progress intact",
    icon: "🔄",
  },
  {
    id: "backup",
    label: "Cloud Backup",
    description: "Automatic saves to prevent data loss",
    icon: "☁️",
  },
  {
    id: "recovery",
    label: "Account Recovery",
    description: "Restore your account if you lose access",
    icon: "🔐",
  },
] as const;

/** Account Tab Props */
interface AccountTabContentProps {
  authState: ReturnType<typeof privyAuthManager.getState>;
  playerName: string;
  onChangeName: (name: string) => void;
  world: ClientWorld;
}

/** Account Tab Content - Compact account management */
function AccountTabContent({
  authState,
  playerName,
  onChangeName,
  world,
}: AccountTabContentProps): React.ReactElement {
  const theme = useThemeStore((s) => s.theme);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(playerName);
  const [characterWallet, setCharacterWallet] = useState<string | undefined>();
  const [solBalance, setSolBalance] = useState<number | null>(null);

  // Solana wallet integration for balance display and MWA detection
  const {
    address: solanaAddress,
    connected: solanaConnected,
    isMWA,
    getBalance,
  } = useSolanaWallet();

  const authenticated = authState.isAuthenticated;
  const userId = authState.privyUserId;
  const mainWalletAddress = (
    authState.user as { wallet?: { address?: string } }
  )?.wallet?.address;
  // Prefer Solana wallet adapter address over Privy wallet
  const displayWallet = solanaAddress || characterWallet || mainWalletAddress;
  const farcasterFid = authState.farcasterFid;
  const email = (authState.user as { email?: { address?: string } })?.email
    ?.address;

  useEffect(() => {
    const player = world.entities?.player;
    if (player?.data?.wallet) {
      setCharacterWallet(player.data.wallet as string);
    }
  }, [world]);

  // Fetch SOL balance when Solana wallet is connected
  useEffect(() => {
    if (!solanaConnected) {
      setSolBalance(null);
      return;
    }
    getBalance().then(setSolBalance);
  }, [solanaConnected, getBalance]);

  useEffect(() => {
    setTempName(playerName);
  }, [playerName]);

  const handleLogout = async () => {
    const windowWithLogout = window as typeof window & {
      privyLogout: () => void;
    };
    await windowWithLogout.privyLogout();
    privyAuthManager.clearAuth();
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleSaveName = () => {
    const trimmed = tempName.trim();
    if (trimmed && trimmed !== playerName) {
      onChangeName(trimmed);
    }
    setIsEditingName(false);
  };

  const truncate = (str: string, startLen: number, endLen: number) => {
    if (str.length <= startLen + endLen + 3) return str;
    return `${str.substring(0, startLen)}...${str.slice(-endLen)}`;
  };

  return (
    <div className="space-y-2">
      {/* Compact Profile Card */}
      <div
        className="rounded-lg relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${theme.colors.background.panelSecondary} 0%, ${theme.colors.background.panelPrimary} 100%)`,
          border: authenticated
            ? `1px solid ${theme.colors.state.success}40`
            : `1px solid ${theme.colors.border.default}80`,
        }}
      >
        {/* Status glow effect */}
        {authenticated && (
          <div
            className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl"
            style={{
              background: theme.colors.state.success,
              opacity: 0.08,
              transform: "translate(30%, -30%)",
            }}
          />
        )}

        <div className="relative z-10 p-2.5">
          {/* Compact Header Row */}
          <div className="flex items-center gap-2 mb-2">
            {/* Avatar Circle */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: authenticated
                  ? `linear-gradient(135deg, ${theme.colors.state.success}30 0%, ${theme.colors.state.success}10 100%)`
                  : `linear-gradient(135deg, ${theme.colors.border.decorative}66 0%, ${theme.colors.border.decorative}4D 100%)`,
                border: authenticated
                  ? `2px solid ${theme.colors.state.success}60`
                  : `2px solid ${theme.colors.border.default}80`,
              }}
            >
              <span style={{ fontSize: "14px" }}>
                {authenticated ? "👤" : "👻"}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              {/* Connection Status */}
              <div className="flex items-center gap-1 mb-0.5">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    background: authenticated
                      ? theme.colors.state.success
                      : theme.colors.state.warning,
                    boxShadow: authenticated
                      ? `0 0 4px ${theme.colors.state.success}80`
                      : `0 0 4px ${theme.colors.state.warning}80`,
                  }}
                />
                <span
                  className="text-[9px] font-medium"
                  style={{
                    color: authenticated
                      ? theme.colors.state.success
                      : theme.colors.state.warning,
                  }}
                >
                  {authenticated ? "Connected" : "Guest Mode"}
                </span>
              </div>

              {/* Player Name */}
              {!isEditingName ? (
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[12px] font-bold truncate"
                    style={{ color: theme.colors.text.accent }}
                  >
                    {playerName || "Adventurer"}
                  </span>
                  <button
                    onClick={() => {
                      setIsEditingName(true);
                      setTempName(playerName);
                    }}
                    className="px-1 py-0.5 rounded flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                    style={{
                      background: `${theme.colors.accent.secondary}26`,
                      border: `1px solid ${theme.colors.accent.secondary}4D`,
                      color: theme.colors.text.muted,
                      fontSize: "7px",
                      cursor: "pointer",
                    }}
                  >
                    EDIT
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => {
                      const sanitized = e.target.value.replace(
                        NAME_SANITIZE_REGEX,
                        "",
                      );
                      setTempName(sanitized);
                    }}
                    className="text-[10px] py-0.5 px-1.5 rounded focus:outline-none flex-1 min-w-0"
                    style={{
                      background: theme.colors.background.overlay,
                      border: `1px solid ${theme.colors.text.accent}60`,
                      color: theme.colors.text.accent,
                    }}
                    maxLength={20}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName();
                      if (e.key === "Escape") {
                        setIsEditingName(false);
                        setTempName(playerName);
                      }
                    }}
                  />
                  <button
                    onClick={handleSaveName}
                    className="p-0.5 rounded flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                    style={{
                      background: `${theme.colors.state.success}30`,
                      border: `1px solid ${theme.colors.state.success}50`,
                      color: theme.colors.state.success,
                      fontSize: "9px",
                      cursor: "pointer",
                    }}
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingName(false);
                      setTempName(playerName);
                    }}
                    className="p-0.5 rounded flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                    style={{
                      background: theme.colors.slot.disabled,
                      border: `1px solid ${theme.colors.border.default}66`,
                      color: theme.colors.text.muted,
                      fontSize: "9px",
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Sign Out Button */}
            {authenticated && (
              <button
                onClick={handleLogout}
                className="px-2 py-1 rounded flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                style={{
                  background: `${theme.colors.state.danger}20`,
                  border: `1px solid ${theme.colors.state.danger}40`,
                  color: theme.colors.state.danger,
                  fontSize: "8px",
                  cursor: "pointer",
                }}
              >
                Sign Out
              </button>
            )}
          </div>

          {/* Compact Account IDs */}
          {authenticated && (userId || displayWallet || email) && (
            <div
              className="rounded p-1.5 space-y-1"
              style={{
                background: theme.colors.background.overlay,
                border: `1px solid ${theme.colors.border.default}33`,
              }}
            >
              {userId && (
                <div className="flex items-center justify-between">
                  <span
                    className="text-[8px]"
                    style={{ color: theme.colors.text.muted }}
                  >
                    User ID
                  </span>
                  <span
                    className="text-[8px] font-mono"
                    style={{ color: theme.colors.text.secondary }}
                  >
                    {truncate(userId, 6, 4)}
                  </span>
                </div>
              )}
              {displayWallet && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span
                        className="text-[8px]"
                        style={{ color: `${theme.colors.state.success}80` }}
                      >
                        Wallet
                      </span>
                      {isMWA && (
                        <span
                          className="text-[6px] px-1 py-0.5 rounded-full font-medium"
                          style={{
                            background: "rgba(148, 103, 255, 0.2)",
                            border: "1px solid rgba(148, 103, 255, 0.4)",
                            color: "rgba(148, 103, 255, 0.9)",
                          }}
                        >
                          MWA
                        </span>
                      )}
                    </div>
                    <span
                      className="text-[8px] font-mono"
                      style={{ color: `${theme.colors.state.success}CC` }}
                    >
                      {truncate(displayWallet, 6, 4)}
                    </span>
                  </div>
                  {solBalance !== null && (
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[8px]"
                        style={{ color: theme.colors.text.muted }}
                      >
                        Balance
                      </span>
                      <span
                        className="text-[8px] font-mono font-medium"
                        style={{ color: theme.colors.accent.primary }}
                      >
                        {solBalance.toFixed(4)} SOL
                      </span>
                    </div>
                  )}
                </div>
              )}
              {email && (
                <div className="flex items-center justify-between">
                  <span
                    className="text-[8px]"
                    style={{ color: `${theme.colors.state.info}99` }}
                  >
                    Email
                  </span>
                  <span
                    className="text-[8px]"
                    style={{ color: theme.colors.state.info }}
                  >
                    {truncate(email, 10, 6)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Compact Cloud Features - Horizontal layout */}
      <SettingsSection title="Cloud Features">
        <div className="flex gap-1.5">
          {CLOUD_FEATURES.map((feature) => {
            const isEnabled = authenticated;
            return (
              <div
                key={feature.id}
                className="flex-1 flex flex-col items-center p-1.5 rounded"
                style={{
                  background: isEnabled
                    ? `${theme.colors.state.success}10`
                    : theme.colors.slot.filled,
                  border: isEnabled
                    ? `1px solid ${theme.colors.state.success}25`
                    : `1px solid ${theme.colors.border.default}33`,
                  opacity: isEnabled ? 1 : 0.5,
                }}
              >
                <span style={{ fontSize: "12px" }}>{feature.icon}</span>
                <span
                  className="text-[7px] mt-0.5 text-center"
                  style={{ color: theme.colors.text.accent }}
                >
                  {feature.label.split(" ")[0]}
                </span>
                <span
                  className="text-[8px] mt-0.5"
                  style={{
                    color: isEnabled
                      ? theme.colors.state.success
                      : theme.colors.text.muted,
                  }}
                >
                  {isEnabled ? "✓" : "○"}
                </span>
              </div>
            );
          })}
        </div>
      </SettingsSection>

      {/* Compact Guest Warning */}
      {!authenticated && (
        <div
          className="rounded p-2 flex items-center gap-2"
          style={{
            background: `linear-gradient(135deg, ${theme.colors.state.warning}12 0%, ${theme.colors.state.warning}06 100%)`,
            border: `1px solid ${theme.colors.state.warning}25`,
          }}
        >
          <span style={{ fontSize: "12px" }}>⚠️</span>
          <div className="flex-1 min-w-0">
            <div
              className="text-[9px] font-semibold"
              style={{ color: theme.colors.state.warning }}
            >
              Playing as Guest
            </div>
            <div
              className="text-[8px]"
              style={{ color: `${theme.colors.state.warning}BB` }}
            >
              Progress not saved. Sign in for cloud sync.
            </div>
          </div>
        </div>
      )}

      {/* Compact Farcaster badge */}
      {farcasterFid && (
        <div
          className="flex items-center gap-2 p-2 rounded"
          style={{
            background: "rgba(168, 85, 247, 0.08)",
            border: "1px solid rgba(168, 85, 247, 0.25)",
          }}
        >
          <span style={{ fontSize: "12px" }}>🟣</span>
          <div className="flex-1 min-w-0">
            <div
              className="text-[9px] font-medium"
              style={{ color: "#c084fc" }}
            >
              Farcaster
            </div>
          </div>
          <span
            className="text-[8px] font-mono"
            style={{ color: "rgba(168, 85, 247, 0.8)" }}
          >
            FID #{farcasterFid}
          </span>
        </div>
      )}
    </div>
  );
}

export function SettingsPanel({ world }: SettingsPanelProps) {
  const theme = useThemeStore((s) => s.theme);
  const prefs = world.prefs;
  const player = world.entities?.player;

  // Auth state management
  const [authState, setAuthState] = useState(privyAuthManager.getState());

  useEffect(() => {
    const unsubscribe = privyAuthManager.subscribe(setAuthState);
    return unsubscribe;
  }, []);

  // State management - check for pending tab from AccountPanel navigation
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (typeof window !== "undefined") {
      const pendingTab = sessionStorage.getItem("settings-initial-tab");
      if (pendingTab && SETTINGS_TABS.some((t) => t.id === pendingTab)) {
        sessionStorage.removeItem("settings-initial-tab");
        return pendingTab as TabType;
      }
    }
    return "visuals";
  });
  const [name, setName] = useState(() => player?.name || "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [dpr, setDPR] = useState(prefs?.dpr || 1);
  const [shadows, setShadows] = useState(prefs?.shadows || "med");
  const [postprocessing, setPostprocessing] = useState(
    prefs?.postprocessing ?? true,
  );
  const [bloom, setBloom] = useState(prefs?.bloom ?? true);
  const [colorGrading, setColorGrading] = useState(
    prefs?.colorGrading || "cinematic",
  );
  const [colorGradingIntensity, setColorGradingIntensity] = useState(
    prefs?.colorGradingIntensity ?? 1,
  );
  const [entityHighlighting, setEntityHighlighting] = useState(
    prefs?.entityHighlighting ?? true,
  );
  const [music, setMusic] = useState(prefs?.music || 0.5);
  const [sfx, setSFX] = useState(prefs?.sfx || 0.5);
  const [voice, setVoice] = useState(prefs?.voice || 1);
  const [statsOn, setStatsOn] = useState(prefs?.stats || false);

  // Status bar configuration
  const [statusBarsConfig, setStatusBarsConfig] = useState<StatusBarsConfig>(
    () => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("statusbar-config");
        if (saved) {
          try {
            return JSON.parse(saved) as StatusBarsConfig;
          } catch {
            // Use default
          }
        }
      }
      return {
        displayMode: "bars",
        orientation: "horizontal",
        sizePreset: "normal",
        showLabels: true,
      };
    },
  );

  // Update status bar config and persist
  const updateStatusBarsConfig = useCallback(
    (updates: Partial<StatusBarsConfig>) => {
      setStatusBarsConfig((prev) => {
        const newConfig = { ...prev, ...updates };
        if (typeof window !== "undefined") {
          localStorage.setItem("statusbar-config", JSON.stringify(newConfig));
        }
        return newConfig;
      });
    },
    [],
  );

  // Quality preset state
  const [qualityPreset, setQualityPreset] = useState<
    GraphicsQuality | "custom"
  >(() => {
    // Detect current preset based on current settings
    return "custom";
  });

  // Apply a quality preset
  const applyQualityPreset = useCallback(
    (quality: GraphicsQuality) => {
      const preset = QUALITY_PRESETS[quality];
      if (!preset || !prefs) return;

      // Apply all preset settings
      setDPR(preset.renderScale);
      prefs.setDPR?.(preset.renderScale);

      setShadows(preset.shadows);
      prefs.setShadows?.(preset.shadows);

      setPostprocessing(preset.postProcessing);
      prefs.setPostprocessing?.(preset.postProcessing);

      setBloom(preset.bloom);
      prefs.setBloom?.(preset.bloom);

      // Color grading: enable/disable and set to cinematic if enabled
      if (preset.colorGrading) {
        setColorGrading("cinematic");
        prefs.setColorGrading?.("cinematic");
      } else {
        setColorGrading("none");
        prefs.setColorGrading?.("none");
      }

      setQualityPreset(quality);
    },
    [prefs],
  );

  const nullRef = useRef<HTMLElement | null>(null);
  const [canFullscreen, isFullscreenRaw, toggleFullscreen] = useFullscreen(
    nullRef as React.RefObject<HTMLElement>,
  );
  // Derive a proper boolean to avoid repeated casts throughout the render
  const isFullscreen = Boolean(isFullscreenRaw);

  const changeName = (rawName: string) => {
    // Early null guard for player
    if (!player) {
      setIsEditingName(false);
      setTempName("");
      return;
    }

    // Centralize sanitization here so all callers get consistent behavior
    const sanitized = sanitizeName(rawName);
    if (!isValidName(sanitized)) {
      // Invalid name - reset to current player name
      setName(player.name || "");
      setIsEditingName(false);
      setTempName(player.name || "");
      return;
    }
    // Optimistically update the name locally
    player.name = sanitized;
    setName(sanitized);
    setIsEditingName(false);
    setTempName(sanitized);

    // Send to server for persistence and broadcast
    world.network?.send?.("changePlayerName", { name: sanitized });
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
      if (changes.colorGrading)
        setColorGrading(changes.colorGrading.value as string);
      if (changes.colorGradingIntensity)
        setColorGradingIntensity(changes.colorGradingIntensity.value as number);
      if (changes.entityHighlighting)
        setEntityHighlighting(changes.entityHighlighting.value as boolean);
      if (changes.music) setMusic(changes.music.value as number);
      if (changes.sfx) setSFX(changes.sfx.value as number);
      if (changes.voice) setVoice(changes.voice.value as number);
      if (changes.stats) setStatsOn(changes.stats.value as boolean);
    };
    prefs?.on?.("change", onPrefsChange);
    return () => {
      prefs?.off?.("change", onPrefsChange);
    };
  }, [prefs]);

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ padding: "4px" }}
    >
      {/* Horizontal Tab Navigation (Top) - Icon only */}
      <div
        className="flex gap-1 mb-2 flex-shrink-0"
        style={{
          background: theme.colors.background.panelPrimary,
          border: `1px solid ${theme.colors.border.default}66`,
          borderRadius: "6px",
          padding: "4px",
        }}
      >
        {SETTINGS_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center justify-center transition-all flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
              style={{
                padding: "8px",
                background: isActive
                  ? `linear-gradient(180deg, ${theme.colors.accent.secondary}33 0%, ${theme.colors.border.decorative}40 100%)`
                  : "transparent",
                border: isActive
                  ? `1px solid ${theme.colors.accent.secondary}66`
                  : "1px solid transparent",
                borderRadius: "4px",
                cursor: "pointer",
                color: isActive
                  ? theme.colors.text.accent
                  : theme.colors.text.muted,
              }}
              title={tab.label}
            >
              <tab.Icon
                size={18}
                strokeWidth={isActive ? 2 : 1.5}
                style={{
                  filter: isActive
                    ? `drop-shadow(0 0 4px ${theme.colors.accent.secondary}80)`
                    : "none",
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div
        className="flex-1 overflow-y-auto noscrollbar"
        style={{
          background: theme.colors.background.panelSecondary,
          border: `1px solid ${theme.colors.border.default}66`,
          borderRadius: "6px",
          padding: "8px",
        }}
      >
        {/* Account Tab */}
        {activeTab === "account" && (
          <AccountTabContent
            authState={authState}
            playerName={name}
            onChangeName={changeName}
            world={world}
          />
        )}

        {/* Visuals Tab */}
        {activeTab === "visuals" && (
          <div className="space-y-2.5">
            {/* Quality Preset Section */}
            <SettingsSection title="Quality Preset">
              <div className="flex flex-wrap gap-1">
                {QUALITY_LEVELS.map((level) => (
                  <OptionButton
                    key={level}
                    selected={qualityPreset === level}
                    onClick={() => applyQualityPreset(level)}
                    small
                  >
                    {getQualityDisplayName(level).split(" ")[0]}
                  </OptionButton>
                ))}
              </div>
              <button
                className="mt-1.5 text-xs text-amber-400 hover:text-amber-300 underline"
                onClick={() => {
                  const recommended = detectRecommendedQuality();
                  applyQualityPreset(recommended);
                }}
              >
                Auto-detect recommended
              </button>
            </SettingsSection>

            {/* Resolution Section */}
            <SettingsSection title="Resolution">
              <div className="flex gap-1">
                {dprOptions.map((opt) => (
                  <OptionButton
                    key={opt.value}
                    selected={dpr === opt.value}
                    onClick={() => {
                      setDPR(opt.value);
                      prefs?.setDPR?.(opt.value);
                    }}
                  >
                    {opt.label}
                  </OptionButton>
                ))}
              </div>
            </SettingsSection>

            {/* Shadows Section */}
            <SettingsSection title="Shadows">
              <div className="flex gap-1">
                {shadowOptions.map((opt) => (
                  <OptionButton
                    key={opt.value}
                    selected={shadows === opt.value}
                    onClick={() => {
                      setShadows(opt.value);
                      prefs?.setShadows?.(opt.value);
                    }}
                  >
                    {opt.label}
                  </OptionButton>
                ))}
              </div>
            </SettingsSection>

            {/* Effects Toggles */}
            <SettingsSection title="Effects">
              <div className="space-y-1">
                <ToggleSwitch
                  label="Post-Processing"
                  checked={postprocessing}
                  onChange={(v) => {
                    setPostprocessing(v);
                    prefs?.setPostprocessing?.(v);
                  }}
                />
                <ToggleSwitch
                  label="Bloom"
                  checked={bloom}
                  disabled={!postprocessing}
                  onChange={(v) => {
                    setBloom(v);
                    prefs?.setBloom?.(v);
                  }}
                />
                <ToggleSwitch
                  label="Entity Highlighting"
                  checked={entityHighlighting}
                  onChange={(v) => {
                    setEntityHighlighting(v);
                    prefs?.setEntityHighlighting?.(v);
                  }}
                />
              </div>
            </SettingsSection>

            {/* Color Grading */}
            <SettingsSection title="Color Grading" disabled={!postprocessing}>
              <div className="grid grid-cols-3 gap-1 mb-1.5">
                {colorGradingOptions.map((opt) => (
                  <OptionButton
                    key={opt.value}
                    selected={colorGrading === opt.value}
                    disabled={!postprocessing}
                    onClick={() => {
                      if (!postprocessing) return;
                      setColorGrading(opt.value);
                      prefs?.setColorGrading?.(opt.value);
                    }}
                    small
                  >
                    {opt.label}
                  </OptionButton>
                ))}
              </div>
              <Slider
                label="Intensity"
                value={colorGradingIntensity}
                onChange={(v) => {
                  setColorGradingIntensity(v);
                  prefs?.setColorGradingIntensity?.(v);
                }}
                min={0}
                max={1}
                step={0.05}
                disabled={!postprocessing || colorGrading === "none"}
              />
            </SettingsSection>
          </div>
        )}

        {/* Interface Tab */}
        {activeTab === "interface" && (
          <div className="space-y-2.5">
            {/* Character Name */}
            <SettingsSection title="Character Name">
              {!isEditingName ? (
                <div
                  className="flex items-center justify-between px-2 py-1.5 rounded"
                  style={{
                    background: theme.colors.slot.filled,
                    border: `1px solid ${theme.colors.border.default}4D`,
                  }}
                >
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: theme.colors.text.accent }}
                  >
                    {name || "Unknown"}
                  </span>
                  <button
                    onClick={() => {
                      setIsEditingName(true);
                      setTempName(name);
                    }}
                    className="text-[9px] px-2 py-0.5 rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                    style={{
                      background: `${theme.colors.accent.secondary}26`,
                      border: `1px solid ${theme.colors.accent.secondary}4D`,
                      color: theme.colors.text.accent,
                      cursor: "pointer",
                    }}
                  >
                    Edit
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => {
                      const sanitized = e.target.value.replace(
                        NAME_SANITIZE_REGEX,
                        "",
                      );
                      setTempName(sanitized);
                    }}
                    className="w-full text-[11px] py-1.5 px-2 rounded focus:outline-none"
                    style={{
                      background: theme.colors.background.secondary,
                      border: `1px solid ${theme.colors.accent.secondary}66`,
                      color: theme.colors.text.accent,
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
                      type="button"
                      onClick={() => changeName(tempName)}
                      className="flex-1 text-[9px] py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                      style={{
                        background: `${theme.colors.state.success}33`,
                        border: `1px solid ${theme.colors.state.success}66`,
                        color: theme.colors.state.success,
                        cursor: "pointer",
                      }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingName(false);
                        setTempName(name);
                      }}
                      className="flex-1 text-[9px] py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                      style={{
                        background: theme.colors.slot.disabled,
                        border: `1px solid ${theme.colors.border.default}66`,
                        color: theme.colors.text.muted,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </SettingsSection>

            {/* Interface Complexity */}
            <ComplexityModeSelector />

            {/* Display Options */}
            <SettingsSection title="Display">
              <div className="space-y-1">
                <ToggleSwitch
                  label="Fullscreen"
                  checked={isFullscreen}
                  disabled={!canFullscreen}
                  onChange={(v) => toggleFullscreen(v)}
                />
                <ToggleSwitch
                  label="Performance Stats"
                  checked={statsOn}
                  onChange={(v) => {
                    setStatsOn(v);
                    prefs?.setStats?.(v);
                  }}
                />
              </div>
            </SettingsSection>

            {/* Status Bars Settings */}
            <SettingsSection title="Status Bars">
              {/* Display Mode */}
              <div className="mb-2">
                <div
                  className="text-[8px] mb-1"
                  style={{ color: theme.colors.text.muted }}
                >
                  Display Mode
                </div>
                <div className="flex gap-1">
                  <OptionButton
                    selected={statusBarsConfig.displayMode === "bars"}
                    onClick={() =>
                      updateStatusBarsConfig({ displayMode: "bars" })
                    }
                    small
                  >
                    Bars
                  </OptionButton>
                  <OptionButton
                    selected={statusBarsConfig.displayMode === "orbs"}
                    onClick={() =>
                      updateStatusBarsConfig({ displayMode: "orbs" })
                    }
                    small
                  >
                    Orbs
                  </OptionButton>
                </div>
              </div>

              {/* Size Preset */}
              <div className="mb-2">
                <div
                  className="text-[8px] mb-1"
                  style={{ color: theme.colors.text.muted }}
                >
                  Size
                </div>
                <div className="flex gap-1">
                  <OptionButton
                    selected={statusBarsConfig.sizePreset === "compact"}
                    onClick={() =>
                      updateStatusBarsConfig({ sizePreset: "compact" })
                    }
                    small
                  >
                    Compact
                  </OptionButton>
                  <OptionButton
                    selected={statusBarsConfig.sizePreset === "normal"}
                    onClick={() =>
                      updateStatusBarsConfig({ sizePreset: "normal" })
                    }
                    small
                  >
                    Normal
                  </OptionButton>
                  <OptionButton
                    selected={statusBarsConfig.sizePreset === "large"}
                    onClick={() =>
                      updateStatusBarsConfig({ sizePreset: "large" })
                    }
                    small
                  >
                    Large
                  </OptionButton>
                </div>
              </div>

              {/* Orientation (for orb mode) */}
              {statusBarsConfig.displayMode === "orbs" && (
                <div className="mb-2">
                  <div
                    className="text-[8px] mb-1"
                    style={{ color: theme.colors.text.muted }}
                  >
                    Orientation
                  </div>
                  <div className="flex gap-1">
                    <OptionButton
                      selected={statusBarsConfig.orientation === "horizontal"}
                      onClick={() =>
                        updateStatusBarsConfig({ orientation: "horizontal" })
                      }
                      small
                    >
                      Horizontal
                    </OptionButton>
                    <OptionButton
                      selected={statusBarsConfig.orientation === "vertical"}
                      onClick={() =>
                        updateStatusBarsConfig({ orientation: "vertical" })
                      }
                      small
                    >
                      Vertical
                    </OptionButton>
                  </div>
                </div>
              )}

              {/* Toggle Options */}
              <div className="space-y-1">
                <ToggleSwitch
                  label="Show Labels"
                  checked={statusBarsConfig.showLabels}
                  onChange={(v) => updateStatusBarsConfig({ showLabels: v })}
                />
              </div>

              {/* Help text */}
              <div
                className="text-[7px] mt-2 px-1"
                style={{ color: theme.colors.text.muted }}
              >
                Tip: Right-click the status bar in Edit Mode to toggle display
                mode
              </div>
            </SettingsSection>

            {/* Actions */}
            <SettingsSection title="Actions">
              <div className="space-y-1">
                {!isTouch && (
                  <ActionButton onClick={() => world.ui?.toggleVisible?.()}>
                    <span>Hide UI</span>
                    <span className="text-[8px] opacity-50">(Z)</span>
                  </ActionButton>
                )}
                <ActionButton
                  onClick={async () => {
                    try {
                      await world.network?.disconnect?.();
                    } catch (e) {
                      console.warn("Disconnect error:", e);
                    } finally {
                      window.location.href = "/";
                    }
                  }}
                >
                  Back to Lobby
                </ActionButton>
              </div>
            </SettingsSection>
          </div>
        )}

        {/* Audio Tab */}
        {activeTab === "audio" && (
          <div className="space-y-2.5">
            <SettingsSection title="Volume">
              <div className="space-y-2">
                <Slider
                  label="Music"
                  icon="🎵"
                  value={music}
                  onChange={(v) => {
                    setMusic(v);
                    prefs?.setMusic?.(v);
                  }}
                  min={0}
                  max={2}
                  step={0.05}
                  formatValue={(v) => `${Math.round((v / 2) * 100)}%`}
                />
                <Slider
                  label="Sound Effects"
                  icon="💥"
                  value={sfx}
                  onChange={(v) => {
                    setSFX(v);
                    prefs?.setSFX?.(v);
                  }}
                  min={0}
                  max={2}
                  step={0.05}
                  formatValue={(v) => `${Math.round((v / 2) * 100)}%`}
                />
                <Slider
                  label="Voice Chat"
                  icon="🎤"
                  value={voice}
                  onChange={(v) => {
                    setVoice(v);
                    prefs?.setVoice?.(v);
                  }}
                  min={0}
                  max={2}
                  step={0.05}
                  formatValue={(v) => `${Math.round((v / 2) * 100)}%`}
                />
              </div>
            </SettingsSection>
          </div>
        )}

        {/* Backend Tab */}
        {activeTab === "backend" && (
          <div className="space-y-2.5">
            <SettingsSection title="Graphics Backend">
              <div
                className="p-2.5 rounded relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${theme.colors.background.panelSecondary} 0%, ${theme.colors.background.panelPrimary} 100%)`,
                  border: world.graphics?.isWebGPU
                    ? `1px solid ${theme.colors.state.success}66`
                    : `1px solid ${theme.colors.state.info}66`,
                }}
              >
                {/* Glow effect */}
                <div
                  className="absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl opacity-15"
                  style={{
                    background: world.graphics?.isWebGPU
                      ? theme.colors.state.success
                      : theme.colors.state.info,
                    transform: "translate(30%, -30%)",
                  }}
                />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{
                          background: world.graphics?.isWebGPU
                            ? theme.colors.state.success
                            : theme.colors.state.info,
                          boxShadow: world.graphics?.isWebGPU
                            ? `0 0 6px ${theme.colors.state.success}80`
                            : `0 0 6px ${theme.colors.state.info}80`,
                        }}
                      />
                      <span
                        className="text-[11px] font-bold"
                        style={{ color: theme.colors.text.accent }}
                      >
                        WebGPU
                      </span>
                    </div>
                    <span
                      className="text-[8px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{
                        background: world.graphics?.isWebGPU
                          ? `${theme.colors.state.success}33`
                          : `${theme.colors.state.info}33`,
                        color: world.graphics?.isWebGPU
                          ? theme.colors.state.success
                          : theme.colors.state.info,
                        border: world.graphics?.isWebGPU
                          ? `1px solid ${theme.colors.state.success}66`
                          : `1px solid ${theme.colors.state.info}66`,
                      }}
                    >
                      ⚡ Modern
                    </span>
                  </div>

                  <p
                    className="text-[8px]"
                    style={{ color: theme.colors.text.muted }}
                  >
                    {world.graphics?.isWebGPU
                      ? "Next-gen graphics API for high-performance rendering"
                      : "Legacy graphics API with wide browser support"}
                  </p>
                </div>
              </div>
            </SettingsSection>
          </div>
        )}
      </div>
    </div>
  );
}

/** Reusable settings section wrapper */
function SettingsSection({
  title,
  children,
  disabled,
}: {
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <div style={{ opacity: disabled ? 0.5 : 1 }}>
      <div
        className="text-[9px] font-semibold mb-1.5 pb-1"
        style={{
          color: theme.colors.text.accent,
          borderBottom: `1px solid ${theme.colors.border.default}40`,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

/** Reusable option button for selection groups */
function OptionButton({
  children,
  selected,
  disabled,
  onClick,
  small,
}: {
  children: React.ReactNode;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  small?: boolean;
}) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${small ? "text-[8px] py-0.5" : "text-[9px] py-1"}`}
      style={{
        background: selected
          ? `linear-gradient(180deg, ${theme.colors.accent.secondary}33 0%, ${theme.colors.border.decorative}40 100%)`
          : theme.colors.slot.filled,
        border: selected
          ? `1px solid ${theme.colors.accent.secondary}80`
          : `1px solid ${theme.colors.border.default}4D`,
        color: selected ? theme.colors.text.accent : theme.colors.text.muted,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

/** Reusable action button */
function ActionButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <button
      onClick={onClick}
      className="w-full text-[9px] py-1.5 rounded transition-all flex items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
      style={{
        background: `${theme.colors.border.decorative}33`,
        border: `1px solid ${theme.colors.border.default}66`,
        color: theme.colors.text.accent,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
