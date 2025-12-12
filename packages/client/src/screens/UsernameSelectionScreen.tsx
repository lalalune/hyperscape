/**
 * UsernameSelectionScreen.tsx - Account Username Selection
 *
 * New users must choose a unique username for their account.
 * This username is different from character names and represents the main account.
 *
 * Flow:
 * 1. User authenticates with Privy → Gets Privy ID and main HD wallet (index 0)
 * 2. If no username exists → Show this screen
 * 3. User chooses username → Account created with username + main wallet
 * 4. Proceed to character selection
 */

import React from "react";
import { usePrivy } from "@privy-io/react-auth";

interface UsernameSelectionScreenProps {
  onUsernameSelected: (username: string) => void;
}

export function UsernameSelectionScreen({
  onUsernameSelected,
}: UsernameSelectionScreenProps) {
  const [username, setUsername] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { user, ready, authenticated } = usePrivy();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate username
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (trimmedUsername.length > 16) {
      setError("Username must be 16 characters or less");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      setError("Username can only contain letters, numbers, and underscores");
      return;
    }

    if (!ready || !authenticated || !user) {
      setError("Please wait for authentication to complete");
      return;
    }

    setIsSubmitting(true);

    try {
      // Get user's embedded wallet (HD index 0)
      const embeddedWallet = user.wallet;
      if (!embeddedWallet?.address) {
        setError("No wallet found. Please refresh the page and try again.");
        setIsSubmitting(false);
        return;
      }

      const accountId = localStorage.getItem("privy_user_id");
      if (!accountId) {
        setError("Authentication error. Please refresh the page.");
        setIsSubmitting(false);
        return;
      }

      console.log(
        `[UsernameSelection] 🎮 Creating account with username: ${trimmedUsername}`,
      );

      // Create user account with username and main wallet
      const response = await fetch("http://localhost:5555/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          username: trimmedUsername,
          wallet: embeddedWallet.address,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(
          errorData.error || "Failed to create account. Please try again.",
        );
        setIsSubmitting(false);
        return;
      }

      console.log(
        `[UsernameSelection] ✅ Account created successfully: ${trimmedUsername}`,
      );

      // Success - proceed to character selection
      onUsernameSelected(trimmedUsername);
    } catch (err) {
      console.error("[UsernameSelection] ❌ Error creating account:", err);
      setError("Network error. Please check your connection and try again.");
      setIsSubmitting(false);
    }
  };

  const GoldRule = ({ thick = false }: { thick?: boolean }) => (
    <div
      className={`${thick ? "h-[2px]" : "h-px"} w-full bg-gradient-to-r from-transparent via-[#f2d08a]/90 to-transparent`}
    />
  );

  return (
    <div className="absolute inset-0 overflow-hidden">
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
        <div className="w-full max-w-md mx-auto p-6">
          {/* Logo */}
          <div className="relative">
            <div className="mx-auto mb-8 w-full flex items-center justify-center">
              <img
                src="/images/hyperscape_wordmark.png"
                alt="Hyperscape"
                className="h-20 md:h-32 object-contain"
              />
            </div>
          </div>

          {/* Welcome Message */}
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-[#f2d08a] mb-2">
              Welcome to Hyperscape!
            </h2>
            <p className="text-[#e8ebf4]/80 text-sm">
              Choose a username for your account
            </p>
            <p className="text-[#e8ebf4]/60 text-xs mt-2">
              This username represents your account and main HD wallet.
              <br />
              You'll create characters under this username.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded bg-red-900/30 border border-red-500/50 p-3">
              <div className="flex items-center gap-2">
                <span className="text-red-400 text-lg">⚠️</span>
                <span className="text-red-200 text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Username Input Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded bg-black/40 border border-[#f2d08a]/30 p-6">
              <label className="block text-[#f2d08a] text-sm font-semibold mb-3">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError(null);
                }}
                placeholder="Enter username (3-16 characters)"
                maxLength={16}
                className="w-full bg-black/60 border border-white/20 rounded px-4 py-3 text-white outline-none focus:border-[#f2d08a]/60 transition-colors"
                autoFocus
                disabled={isSubmitting}
              />
              <div className="mt-2 text-[#e8ebf4]/60 text-xs">
                • 3-16 characters
                <br />
                • Letters, numbers, and underscores only
                <br />• Cannot be changed later
              </div>
            </div>

            {/* Submit Button */}
            <div className="relative">
              <GoldRule thick />
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  username.trim().length < 3 ||
                  !ready ||
                  !authenticated
                }
                className={`w-full px-6 py-4 text-center rounded-sm transition-all ${
                  isSubmitting ||
                  username.trim().length < 3 ||
                  !ready ||
                  !authenticated
                    ? "bg-black/40 text-[#e8ebf4]/40 cursor-not-allowed"
                    : "bg-black/60 hover:bg-black/80 text-[#f2d08a] cursor-pointer"
                } border border-[#f2d08a]/30`}
                style={{
                  textShadow:
                    isSubmitting || username.trim().length < 3
                      ? "none"
                      : "0 0 12px rgba(242, 208, 138, 0.5)",
                }}
              >
                <span className="font-semibold text-lg uppercase tracking-[0.2em]">
                  {isSubmitting ? "Creating Account..." : "Create Account"}
                </span>
              </button>
              <GoldRule thick />
            </div>
          </form>

          {/* Info Box */}
          <div className="mt-6 rounded bg-[#f2d08a]/10 border border-[#f2d08a]/30 p-4">
            <div className="flex items-start gap-3">
              <span className="text-[#f2d08a] text-xl">💡</span>
              <div className="flex-1">
                <div className="text-[#f2d08a] font-semibold text-sm mb-1">
                  Account Structure
                </div>
                <div className="text-[#e8ebf4]/70 text-xs leading-relaxed">
                  Your{" "}
                  <span className="text-[#f2d08a] font-medium">username</span>{" "}
                  is your permanent account identity linked to your main HD
                  wallet (index 0).{" "}
                  <span className="text-[#f2d08a] font-medium">Characters</span>{" "}
                  are created under your username, each with their own wallet
                  (indices 1, 2, 3, etc.).
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
