/**
 * CharacterSelectScreen.tsx - Character Selection Screen
 *
 * UI for selecting or creating a character before entering the world.
 *
 * ## Wallet Architecture (Privy HD Wallets)
 *
 * This screen uses Privy's Hierarchical Deterministic (HD) wallet system.
 * Each user has ONE seed phrase that derives multiple wallets:
 *
 * - HD Index 0: User's main wallet (created automatically on first login via Privy config)
 * - HD Index 1: First character's wallet
 * - HD Index 2: Second character's wallet
 * - HD Index N: Nth character's wallet
 *
 * All wallets are:
 * - Derived from the same BIP-44 seed: m/44'/60'/0'/0/{index}
 * - Backed up automatically by Privy
 * - Recoverable from the user's main wallet
 * - Managed by Privy (no manual private key handling)
 *
 * This means users authenticate ONCE, then all character wallets are
 * created seamlessly without additional signatures or prompts.
 */

import {
  readPacket,
  writePacket,
  storage,
  AVATAR_OPTIONS,
} from "@hyperscape/shared";
import React from "react";
import { CharacterPreview } from "../components/CharacterPreview";
import { usePrivy, useCreateWallet } from "@privy-io/react-auth";

type Character = { id: string; name: string; wallet?: string };

// Music preference manager - syncs with game prefs
const getMusicEnabled = (): boolean => {
  const stored = localStorage.getItem("music_enabled");
  if (stored === null) return true; // Default to enabled
  return stored === "true";
};

const setMusicEnabled = (enabled: boolean): void => {
  localStorage.setItem("music_enabled", String(enabled));
  // Also update prefs if they exist (storage.get returns parsed object)
  const prefs = storage.get("prefs") as Record<string, unknown> | null;
  if (prefs) {
    const updated = { ...prefs, music: enabled ? 0.5 : 0 };
    storage.set("prefs", updated);
  }
};

// Intro Music Player Hook
const useIntroMusic = (enabled: boolean) => {
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const sourceRef = React.useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = React.useRef<GainNode | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTrack, setCurrentTrack] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!enabled) {
      // Stop music if disabled
      if (sourceRef.current) {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      setIsPlaying(false);
      return;
    }

    // Initialize audio context
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
      gainNodeRef.current.gain.value = 0.3; // 30% volume
    }

    const ctx = audioContextRef.current;
    const gainNode = gainNodeRef.current!;

    // Load and play intro music
    const playIntroMusic = async () => {
      // Randomly select between intro tracks
      const track = Math.random() > 0.5 ? "1.mp3" : "2.mp3";
      setCurrentTrack(track);

      const cdnUrl = "http://localhost:8080"; // CDN URL
      const musicPath = `${cdnUrl}/music/intro/${track}`;

      // Resume audio context if suspended (browser autoplay policy)
      if (ctx.state === "suspended") {
        const resumeAudio = async () => {
          await ctx.resume();
          document.removeEventListener("click", resumeAudio);
          document.removeEventListener("keydown", resumeAudio);
        };
        document.addEventListener("click", resumeAudio);
        document.addEventListener("keydown", resumeAudio);
      }

      // Load audio buffer
      const response = await fetch(musicPath);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      // Create source and connect
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true; // Loop the intro music
      source.connect(gainNode);

      // Fade in
      const now = ctx.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 2); // 2 second fade in

      source.start(0);
      sourceRef.current = source;
      setIsPlaying(true);
    };

    playIntroMusic();

    // Cleanup on unmount
    return () => {
      if (sourceRef.current) {
        const src = sourceRef.current;
        const ctx = audioContextRef.current!;
        const now = ctx.currentTime;

        // Fade out
        gainNodeRef.current!.gain.setValueAtTime(
          gainNodeRef.current!.gain.value,
          now,
        );
        gainNodeRef.current!.gain.linearRampToValueAtTime(0, now + 1);

        setTimeout(() => {
          src.stop();
          src.disconnect();
        }, 1000);
      }
    };
  }, [enabled]);

  return { isPlaying, currentTrack };
};

// Music Toggle Button Component
const MusicToggleButton = () => {
  const [enabled, setEnabled] = React.useState(getMusicEnabled());

  useIntroMusic(enabled);

  const toggleMusic = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    setMusicEnabled(newEnabled);
  };

  return (
    <button
      onClick={toggleMusic}
      className="fixed top-4 left-4 z-50 bg-black/60 hover:bg-black/80 text-white rounded-lg px-4 py-2 border border-white/20 transition-all flex items-center gap-2 backdrop-blur-sm"
      title={enabled ? "Disable music" : "Enable music"}
    >
      <span className="text-xl">{enabled ? "🔊" : "🔇"}</span>
      <span className="text-sm font-medium">
        {enabled ? "Music On" : "Music Off"}
      </span>
    </button>
  );
};

// Agent Dashboard Button Component
const AgentDashboardButton = () => {
  return (
    <a
      href="http://localhost:3333/?page=dashboard"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 right-4 z-50 bg-black/60 hover:bg-black/80 text-[#f2d08a] rounded-lg px-4 py-2 border border-[#f2d08a]/30 hover:border-[#f2d08a]/60 transition-all flex items-center gap-2 backdrop-blur-sm shadow-lg"
      title="Open Agent Dashboard"
    >
      <span className="text-xl">⚔️</span>
      <span className="text-sm font-medium">Agent Dashboard</span>
    </a>
  );
};

export function CharacterSelectScreen({
  wsUrl,
  onPlay,
  onLogout,
}: {
  wsUrl: string;
  onPlay: (selectedCharacterId: string | null) => void;
  onLogout: () => void;
}) {
  const [characters, setCharacters] = React.useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = React.useState<
    string | null
  >(null);
  const [newCharacterName, setNewCharacterName] = React.useState("");
  const [wsReady, setWsReady] = React.useState(false);
  const [view, setView] = React.useState<"select" | "confirm" | "create">(
    "select",
  );
  const [showCreate, setShowCreate] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [selectedAvatarIndex, setSelectedAvatarIndex] = React.useState(0);
  const [creatingCharacter, setCreatingCharacter] = React.useState(false);
  // Check if we're creating an agent from dashboard
  const urlParams = new URLSearchParams(window.location.search);
  const createAgentMode = urlParams.get("createAgent") === "true";

  const [characterType, setCharacterType] = React.useState<"human" | "agent">(
    createAgentMode ? "agent" : "human",
  );
  const [elizaOSAvailable, setElizaOSAvailable] = React.useState(false);
  const [checkingElizaOS, setCheckingElizaOS] = React.useState(true);

  // Privy hooks
  const { user } = usePrivy();
  const { createWallet } = useCreateWallet();

  // Check if ElizaOS is available with Hyperscape plugin
  React.useEffect(() => {
    const checkElizaOS = async () => {
      try {
        // Check if ElizaOS API is running
        const response = await fetch("http://localhost:3000/api/agents", {
          method: "GET",
        });

        if (!response.ok) {
          setElizaOSAvailable(false);
          setCheckingElizaOS(false);
          return;
        }

        // ElizaOS is running - assume Hyperscape plugin is available
        // (Plugin availability is verified during agent creation)
        setElizaOSAvailable(true);
        console.log("[CharacterSelect] ✅ ElizaOS detected and available");
      } catch (error) {
        console.log(
          "[CharacterSelect] ℹ️ ElizaOS not detected (AI agents disabled)",
        );
        setElizaOSAvailable(false);
      } finally {
        setCheckingElizaOS(false);
      }
    };

    checkElizaOS();
  }, []);

  // Auto-open create form if in createAgent mode
  React.useEffect(() => {
    if (createAgentMode && !showCreate && !checkingElizaOS) {
      if (elizaOSAvailable) {
        setShowCreate(true);
      } else {
        // ElizaOS not available, show error
        setErrorMessage(
          "ElizaOS is not running. Please start ElizaOS to create AI agents.",
        );
      }
    }
  }, [createAgentMode, showCreate, checkingElizaOS, elizaOSAvailable]);
  const preWsRef = React.useRef<WebSocket | null>(null);
  const pendingActionRef = React.useRef<null | {
    type: "create";
    name: string;
  }>(null);
  const [authDeps, setAuthDeps] = React.useState<{
    token: string;
    privyUserId: string;
  }>({
    token: localStorage.getItem("privy_auth_token") || "",
    privyUserId: localStorage.getItem("privy_user_id") || "",
  });

  // Watch for Privy auth being written to localStorage before opening WS
  React.useEffect(() => {
    const onStorage = (e: Event) => {
      const storageEvent = e as { key?: string | null };
      if (!storageEvent.key) return;
      if (
        storageEvent.key === "privy_auth_token" ||
        storageEvent.key === "privy_user_id"
      ) {
        const token = localStorage.getItem("privy_auth_token") || "";
        const privyUserId = localStorage.getItem("privy_user_id") || "";
        setAuthDeps({ token, privyUserId });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  React.useEffect(() => {
    if (authDeps.token && authDeps.privyUserId) return;
    let attempts = 0;
    const id = window.setInterval(() => {
      const token = localStorage.getItem("privy_auth_token") || "";
      const privyUserId = localStorage.getItem("privy_user_id") || "";
      if (token && privyUserId) {
        // Only update if values actually changed
        if (token !== authDeps.token || privyUserId !== authDeps.privyUserId) {
          setAuthDeps({ token, privyUserId });
        }
        window.clearInterval(id);
      } else if (++attempts > 50) {
        window.clearInterval(id);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [authDeps.token, authDeps.privyUserId]);

  // Debug logging for state changes
  React.useEffect(() => {}, [wsReady, showCreate, characters]);

  React.useEffect(() => {
    // Wait until Privy auth values are present
    const token = authDeps.token;
    const privyUserId = authDeps.privyUserId;
    if (!token || !privyUserId) {
      setWsReady(false);
      return; // Don't create websocket without auth
    }

    let url = `${wsUrl}?authToken=${encodeURIComponent(token)}`;
    if (privyUserId) url += `&privyUserId=${encodeURIComponent(privyUserId)}`;

    console.log("[CharacterSelect] 🔌 Creating WebSocket connection to:", url);
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    preWsRef.current = ws;
    setWsReady(false);
    ws.addEventListener("open", () => {
      setWsReady(true);
      // Request character list from server
      const packet = writePacket("characterListRequest", {});
      ws.send(packet);
      // Flush any pending create
      const pending = pendingActionRef.current;
      if (pending && pending.type === "create") {
        ws.send(writePacket("characterCreate", { name: pending.name }));
        pendingActionRef.current = null;
      }
    });
    ws.addEventListener("error", (err) => {
      console.error("[CharacterSelect] ❌ WebSocket ERROR:", err);
    });
    ws.addEventListener("close", (_e) => {
      setWsReady(false);
    });
    ws.addEventListener("message", (e) => {
      const result = readPacket(e.data);
      if (!result) {
        console.warn("[CharacterSelect] ⚠️ readPacket returned null/undefined");
        return;
      }
      const [method, data] = result as [string, unknown];

      if (method === "onSnapshot") {
        // Extract characters from snapshot
        const snap = data as { characters?: Character[] };
        if (snap.characters && Array.isArray(snap.characters)) {
          setCharacters(snap.characters);
        }
      } else if (method === "onCharacterList") {
        const listData = data as { characters: Character[] };
        setCharacters(listData.characters);
      } else if (method === "onCharacterCreated") {
        const c = data as Character;
        setCharacters((prev) => {
          const newList = [...prev, c];
          return newList;
        });

        // AGENT FLOW: Redirect to character editor to customize agent personality
        // HUMAN FLOW: Show "Enter World" confirmation screen
        if (characterType === "agent") {
          console.log(
            "[CharacterSelect] 🤖 Agent character created, redirecting to character editor...",
          );

          // Redirect to character editor with character details
          const params = new URLSearchParams({
            characterId: c.id,
            name: c.name,
            wallet: c.wallet || "",
            avatar: AVATAR_OPTIONS[selectedAvatarIndex]?.url || "",
          });

          window.location.href = `/?page=character-editor&${params.toString()}`;
          return; // Exit early - agents go to character editor, NOT to "Enter World"
        }

        // HUMAN FLOW: Show "Enter World" confirmation screen
        // This ONLY runs for human players (agents exit early above)
        setSelectedCharacterId(c.id);
        setView("confirm"); // Show the "Enter World" confirmation screen
        setShowCreate(false);
        const ws = preWsRef.current!;
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(writePacket("characterSelected", { characterId: c.id }));
        }
      } else if (method === "onCharacterSelected") {
        const payload = data as { characterId: string | null };
        setSelectedCharacterId(payload.characterId || null);
        if (payload.characterId) setView("confirm");
      } else if (method === "onEntityEvent") {
        const evt = data as {
          id?: string;
          version?: number;
          name?: string;
          data?: unknown;
        };
        if (evt?.name === "character:list") {
          const list =
            (evt.data as { characters?: Character[] })?.characters || [];
          setCharacters(list);
        }
      } else if (method === "onShowToast") {
        const toast = data as { message?: string; type?: string };
        console.error("[CharacterSelect] ❌ Server error:", toast.message);
        setErrorMessage(toast.message || "An error occurred");
      } else if (method === "onEntityModified") {
        // Entity updates are not relevant for character selection screen
        // These are real-time position/rotation/velocity updates that happen in the world
        // Silently ignore them
      }
    });
    return () => {
      ws.close();
      if (preWsRef.current === ws) preWsRef.current = null;
    };
  }, [wsUrl, authDeps.token, authDeps.privyUserId]);

  const selectCharacter = React.useCallback((id: string) => {
    setSelectedCharacterId(id);
    setView("confirm");
    const ws = preWsRef.current!;
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(writePacket("characterSelected", { characterId: id }));
  }, []);

  const createCharacter = React.useCallback(async () => {
    const name = newCharacterName.trim().slice(0, 20);

    if (!name || name.length < 3) {
      console.warn(
        "[CharacterSelect] ❌ Name validation failed - must be 3-20 characters",
      );
      setErrorMessage("Character name must be 3-20 characters");
      return;
    }

    // Prevent agent creation if ElizaOS is not available
    if (characterType === "agent" && !elizaOSAvailable) {
      setErrorMessage(
        "Cannot create AI agent: ElizaOS is not running. Please start ElizaOS first.",
      );
      return;
    }

    setCreatingCharacter(true);
    setErrorMessage(null);

    try {
      // Create HD wallet for character using Privy's native HD wallet system
      let walletAddress: string | undefined;

      if (user) {
        // Privy's HD wallet system creates additional wallets sequentially
        // The first call creates wallet at index 0, subsequent calls create wallets at indices 1, 2, 3, etc.
        // All wallets use Privy's BIP-44 derivation path: m/44'/60'/0'/0/{index}
        console.log(
          `[CharacterSelect] 🔑 Creating additional HD wallet for character "${name}"`,
        );

        try {
          // Create an additional HD wallet in the sequence
          // Privy manages the index internally - we just request a new wallet
          const characterWallet = await createWallet({
            createAdditional: true,
          });

          walletAddress = characterWallet.address;
          console.log(`[CharacterSelect] ✅ HD wallet created:`, walletAddress);
        } catch (walletError) {
          console.error(
            "[CharacterSelect] ❌ Failed to create HD wallet:",
            walletError,
          );
          setErrorMessage(
            "Failed to create wallet for character. Please try again.",
          );
          setCreatingCharacter(false);
          return;
        }
      } else {
        console.warn(
          "[CharacterSelect] ⚠️ No user authenticated, character will have no wallet",
        );
        setErrorMessage("You must be logged in to create a character.");
        setCreatingCharacter(false);
        return;
      }

      const ws = preWsRef.current;

      if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn(
          "[CharacterSelect] ⚠️ WebSocket not ready, queueing create request",
        );
        pendingActionRef.current = { type: "create", name };
        setCreatingCharacter(false);
        return;
      }

      const packet = writePacket("characterCreate", {
        name,
        wallet: walletAddress,
        avatar: AVATAR_OPTIONS[selectedAvatarIndex].url,
        isAgent: characterType === "agent",
      });
      ws.send(packet);

      setNewCharacterName("");
      // Don't hide the create form yet - wait for server response
    } catch (error) {
      console.error("[CharacterSelect] ❌ Failed to create character:", error);
      setErrorMessage("Failed to create character. Please try again.");
    } finally {
      setCreatingCharacter(false);
    }
  }, [
    newCharacterName,
    user,
    characters.length,
    selectedAvatarIndex,
    createWallet,
    characterType,
    elizaOSAvailable,
  ]);

  const enterWorld = React.useCallback(() => {
    onPlay(selectedCharacterId);
  }, [selectedCharacterId, onPlay]);

  const GoldRule = ({
    className = "",
    thick = false,
  }: {
    className?: string;
    thick?: boolean;
  }) => (
    <div
      className={`${thick ? "h-[2px]" : "h-px"} w-full bg-gradient-to-r from-transparent via-[#f2d08a]/90 to-transparent ${className}`}
    />
  );

  return (
    <div className="absolute inset-0 overflow-hidden">
      <MusicToggleButton />
      <AgentDashboardButton />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/images/app_background.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 bg-black/80" />
      <div className="absolute inset-0 flex items-center justify-center text-white">
        <div className="w-full max-w-2xl mx-auto p-6">
          <div className="relative">
            <div className="mx-auto mt-20 md:mt-0 mb-2 w-full max-w-2xl flex items-center justify-center">
              <img
                src="/images/hyperscape_wordmark.png"
                alt="Hyperscape"
                className="h-20 md:h-36 object-contain"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="mt-6 rounded bg-red-900/30 border border-red-500/50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-red-400 text-xl">⚠️</span>
                  <span className="text-red-200">{errorMessage}</span>
                </div>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="text-red-400 hover:text-red-300 px-2 py-1"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {view === "select" && (
            <div className="mt-8">
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-2 scrollbar-thin">
                {characters.map((c) => (
                  <div
                    key={c.id}
                    className="relative w-full overflow-hidden h-24"
                  >
                    <div className="flex items-center justify-between h-full p-4 pr-5">
                      <img
                        src="/images/stock_character.png"
                        alt=""
                        className="w-24 h-24 rounded-sm object-cover"
                      />
                      <div className="text-yellow-400 text-2xl">›</div>
                    </div>
                    {/* Gold lines and centered name that extend across the middle. Clickable area is only between the lines. */}
                    <div
                      className="absolute"
                      style={{
                        left: "112px",
                        right: "16px",
                        top: "50%",
                        transform: "translateY(-50%)",
                      }}
                    >
                      <GoldRule thick className="pointer-events-none" />
                      <button
                        onClick={() => selectCharacter(c.id)}
                        className="w-full px-4 py-2 text-center bg-black/40 hover:bg-black/50 focus:outline-none focus:ring-1 ring-yellow-400/60 rounded-sm"
                        style={{
                          color: "#f2d08a",
                        }}
                      >
                        <span className="font-semibold text-xl">{c.name}</span>
                      </button>
                      <GoldRule thick className="pointer-events-none" />
                    </div>
                  </div>
                ))}
                {characters.length === 0 && (
                  <div className="text-sm opacity-70">No characters yet.</div>
                )}
              </div>

              {/* Create New button - always visible below character list */}
              {!showCreate && (
                <div className="relative w-full overflow-hidden h-24 mt-3">
                  <div className="flex items-center h-full p-4 pr-5">
                    <img
                      src="/images/stock_character.png"
                      alt=""
                      className="w-24 h-24 rounded-sm object-cover ml-auto"
                    />
                  </div>
                  <div
                    className="absolute"
                    style={{
                      left: "16px",
                      right: "112px",
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                  >
                    <GoldRule thick className="pointer-events-none" />
                    <button
                      onClick={() => setShowCreate(true)}
                      className="w-full px-4 py-2 text-left bg-black/40 hover:bg-black/50 focus:outline-none focus:ring-1 ring-yellow-400/60 rounded-sm"
                    >
                      <span className="font-semibold text-xl">Create New</span>
                    </button>
                    <GoldRule thick className="pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Character creation form with 3D preview */}
              {showCreate && (
                <div className="w-full space-y-3 mt-3">
                  {/* 3D Preview Section */}
                  <div className="relative w-full h-96 bg-black/60 rounded-lg overflow-hidden border border-[#f2d08a]/30">
                    <CharacterPreview
                      vrmUrl={AVATAR_OPTIONS[selectedAvatarIndex].previewUrl}
                      className="w-full h-full"
                    />

                    {/* Avatar Selector Overlay */}
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-black/80 rounded-lg px-4 py-2 backdrop-blur">
                      <button
                        onClick={() =>
                          setSelectedAvatarIndex(
                            (prev) =>
                              (prev - 1 + AVATAR_OPTIONS.length) %
                              AVATAR_OPTIONS.length,
                          )
                        }
                        className="px-3 py-1 bg-[#f2d08a]/20 hover:bg-[#f2d08a]/30 text-[#f2d08a] rounded transition-colors"
                      >
                        ‹
                      </button>
                      <span className="text-[#f2d08a] text-sm font-medium min-w-[120px] text-center">
                        {AVATAR_OPTIONS[selectedAvatarIndex].name}
                      </span>
                      <button
                        onClick={() =>
                          setSelectedAvatarIndex(
                            (prev) => (prev + 1) % AVATAR_OPTIONS.length,
                          )
                        }
                        className="px-3 py-1 bg-[#f2d08a]/20 hover:bg-[#f2d08a]/30 text-[#f2d08a] rounded transition-colors"
                      >
                        ›
                      </button>
                    </div>
                  </div>

                  {/* Character Type Selection */}
                  {!checkingElizaOS && (
                    <div className="w-full rounded bg-black/60 border border-[#f2d08a]/30 p-4">
                      <div className="text-[#f2d08a] text-sm font-semibold mb-3">
                        Character Type
                      </div>
                      <div className="flex gap-4">
                        <label className="flex-1 flex items-center gap-3 p-3 rounded-lg border-2 border-[#f2d08a]/30 bg-black/40 cursor-pointer transition-all hover:border-[#f2d08a]/60 hover:bg-black/60">
                          <input
                            type="radio"
                            name="characterType"
                            value="human"
                            checked={characterType === "human"}
                            onChange={(e) =>
                              setCharacterType(
                                e.target.value as "human" | "agent",
                              )
                            }
                            className="w-4 h-4 text-[#f2d08a] accent-[#f2d08a]"
                          />
                          <div className="flex-1">
                            <div className="text-[#f2d08a] font-medium">
                              🎮 Human Player
                            </div>
                            <div className="text-[#e8ebf4]/60 text-xs mt-1">
                              Play yourself
                            </div>
                          </div>
                        </label>
                        {elizaOSAvailable ? (
                          <label className="flex-1 flex items-center gap-3 p-3 rounded-lg border-2 border-[#f2d08a]/30 bg-black/40 cursor-pointer transition-all hover:border-[#f2d08a]/60 hover:bg-black/60">
                            <input
                              type="radio"
                              name="characterType"
                              value="agent"
                              checked={characterType === "agent"}
                              onChange={(e) =>
                                setCharacterType(
                                  e.target.value as "human" | "agent",
                                )
                              }
                              className="w-4 h-4 text-[#f2d08a] accent-[#f2d08a]"
                            />
                            <div className="flex-1">
                              <div className="text-[#f2d08a] font-medium">
                                🤖 AI Agent
                              </div>
                              <div className="text-[#e8ebf4]/60 text-xs mt-1">
                                Autonomous AI
                              </div>
                            </div>
                          </label>
                        ) : (
                          <div className="flex-1 flex items-center gap-3 p-3 rounded-lg border-2 border-[#8b4513]/20 bg-black/20 opacity-50">
                            <input
                              type="radio"
                              name="characterType"
                              value="agent"
                              disabled
                              className="w-4 h-4 text-gray-500 accent-gray-500"
                            />
                            <div className="flex-1">
                              <div className="text-[#e8ebf4]/40 font-medium">
                                🤖 AI Agent
                              </div>
                              <div className="text-[#e8ebf4]/30 text-xs mt-1">
                                Requires ElizaOS
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Name Input Form */}
                  <form
                    className="w-full rounded bg-white/5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      createCharacter();
                    }}
                  >
                    <GoldRule thick />
                    <div className="flex items-center gap-2 p-3 h-16">
                      <div className="flex-1">
                        <input
                          className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-white outline-none text-sm"
                          placeholder="Name (3–20 chars)"
                          value={newCharacterName}
                          onChange={(e) => {
                            setNewCharacterName(e.target.value);
                          }}
                          maxLength={20}
                          autoFocus
                          disabled={creatingCharacter}
                        />
                      </div>

                      <button
                        type="submit"
                        className={`px-3 py-1.5 rounded font-bold text-sm ${wsReady && newCharacterName.trim().length >= 3 && !creatingCharacter ? "bg-emerald-600 hover:bg-emerald-500" : "bg-white/20 cursor-not-allowed"}`}
                        disabled={
                          !wsReady ||
                          newCharacterName.trim().length < 3 ||
                          creatingCharacter
                        }
                      >
                        {creatingCharacter ? "Creating..." : "Create"}
                      </button>
                    </div>
                    <GoldRule thick />
                  </form>

                  {/* Back Button */}
                  <button
                    className="w-full px-4 py-2 bg-black/40 hover:bg-black/50 text-[#f2d08a] rounded border border-[#f2d08a]/30 transition-colors"
                    onClick={() => {
                      setShowCreate(false);
                      setNewCharacterName("");
                      setSelectedAvatarIndex(0);
                      setCharacterType("human"); // Reset to default
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {!wsReady && (
                <div className="text-xs opacity-60 mt-2">Connecting…</div>
              )}
              <div className="mt-6 flex justify-center">
                <div className="w-full max-w-sm relative">
                  <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#f2d08a]/90 to-transparent mb-2" />
                  <button
                    className="w-full px-6 py-3 text-center bg-transparent hover:bg-black/20 focus:outline-none transition-all rounded-sm"
                    onClick={onLogout}
                    style={{
                      color: "#f2d08a",
                      textShadow:
                        "0 0 12px rgba(242, 208, 138, 0.5), 0 0 25px rgba(242, 208, 138, 0.3)",
                      filter:
                        "drop-shadow(0 8px 20px rgba(0, 0, 0, 0.8)) drop-shadow(0 4px 10px rgba(0, 0, 0, 0.6))",
                    }}
                  >
                    <span className="font-semibold text-lg uppercase tracking-[0.2em]">
                      Sign out
                    </span>
                  </button>
                  <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#f2d08a]/90 to-transparent mt-2" />
                </div>
              </div>
            </div>
          )}

          {view === "confirm" && (
            <div className="mt-2">
              <div className="rounded bg-white/5 overflow-hidden">
                <div className="relative">
                  <div
                    className="w-full overflow-hidden"
                    style={{ height: "55vh" }}
                  >
                    <img
                      src="/images/stock_character.png"
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute inset-x-0 bottom-0">
                    <GoldRule />
                    <div className="flex items-center justify-between px-5 py-3 bg-black/50 backdrop-blur">
                      <div
                        className="font-semibold text-xl"
                        style={{ color: "#f2d08a" }}
                      >
                        {characters.find((c) => c.id === selectedCharacterId)
                          ?.name || "Unnamed"}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xl" style={{ color: "#f2d08a" }}>
                          ✓
                        </div>
                      </div>
                    </div>
                    <GoldRule />
                  </div>
                </div>
              </div>
              <div className="mt-3 flex justify-center">
                <div className="w-full max-w-md relative">
                  <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#f2d08a]/90 to-transparent mb-1" />
                  <button
                    className="w-full px-6 py-1.5 text-center bg-transparent hover:bg-black/20 focus:outline-none transition-all rounded-sm"
                    disabled={!selectedCharacterId}
                    onClick={enterWorld}
                    style={{
                      color: "#f2d08a",
                      textShadow:
                        "0 0 12px rgba(242, 208, 138, 0.5), 0 0 25px rgba(242, 208, 138, 0.3)",
                      filter:
                        "drop-shadow(0 8px 20px rgba(0, 0, 0, 0.8)) drop-shadow(0 4px 10px rgba(0, 0, 0, 0.6))",
                      opacity: selectedCharacterId ? 1 : 0.5,
                      cursor: selectedCharacterId ? "pointer" : "not-allowed",
                    }}
                  >
                    <span className="font-semibold text-lg uppercase tracking-[0.2em]">
                      Enter World
                    </span>
                  </button>
                  <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#f2d08a]/90 to-transparent mt-1" />
                </div>
              </div>
              <div className="mt-3 flex justify-center">
                <button
                  className="px-6 py-2 bg-transparent hover:bg-black/20 focus:outline-none transition-all rounded-sm border border-[#f2d08a]/30"
                  onClick={() => setView("select")}
                  style={{
                    color: "#f2d08a",
                    textShadow: "0 0 8px rgba(242, 208, 138, 0.4)",
                  }}
                >
                  <span className="font-medium text-sm uppercase tracking-[0.15em]">
                    Back to Select
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
