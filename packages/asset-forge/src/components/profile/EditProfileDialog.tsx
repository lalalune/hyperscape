/**
 * EditProfileDialog — modal for editing the current user's profile.
 *
 * Fields: displayName + avatarUrl (URL pointer; not a file uploader).
 * Privy-managed identity (email, wallet, linked accounts) is read-only
 * and shown in a separate "Identity" strip — those flow through Privy.
 *
 * Wired to PUT /api/auth/me via updateCurrentUser().
 */

import { Loader2, Save, User as UserIcon } from "lucide-react";
import React, { useEffect, useState } from "react";

import { useApp } from "../../contexts/AppContext";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../common/Modal";
import { Avatar } from "../shared/Avatar";
import {
  updateCurrentUser,
  type AuthMeResponse,
  type AuthUserRecord,
} from "../../utils/worldProjectApi";

interface EditProfileDialogProps {
  open: boolean;
  onClose: () => void;
  user: AuthUserRecord;
  onUpdated: (me: AuthMeResponse) => void;
}

export function EditProfileDialog({
  open,
  onClose,
  user,
  onUpdated,
}: EditProfileDialogProps) {
  const { showNotification } = useApp();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state whenever the modal opens
  useEffect(() => {
    if (open) {
      setDisplayName(user.displayName);
      setAvatarUrl(user.avatarUrl ?? "");
      setError(null);
      setSubmitting(false);
    }
  }, [open, user.displayName, user.avatarUrl]);

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setError("Display name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const trimmedAvatar = avatarUrl.trim();
      const updated = await updateCurrentUser({
        displayName: trimmedName,
        avatarUrl: trimmedAvatar || null,
      });
      showNotification("Profile updated", "success");
      onUpdated(updated);
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to update profile";
      setError(msg);
      showNotification(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const isDirty =
    displayName.trim() !== user.displayName ||
    (avatarUrl.trim() || null) !== (user.avatarUrl ?? null);
  const valid = displayName.trim().length > 0 && isDirty;

  return (
    <Modal open={open} onClose={handleClose} size="md">
      <ModalHeader>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-bg-primary border border-border-primary flex items-center justify-center flex-shrink-0">
            <UserIcon size={14} strokeWidth={1.5} className="text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-medium text-text-primary tracking-tight">
              Edit profile
            </h2>
            <p className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] mt-0.5 font-mono normal-case tracking-normal">
              {user.id.slice(0, 12)}…
            </p>
          </div>
        </div>
      </ModalHeader>

      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="space-y-5">
            {/* Avatar live preview */}
            <div className="flex items-center gap-5">
              <Avatar
                size={72}
                rounded="lg"
                src={avatarUrl.trim() || null}
                name={displayName || user.displayName}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-text-tertiary uppercase tracking-[0.14em] mb-1">
                  Preview
                </p>
                <p className="font-display text-base font-medium text-text-primary truncate">
                  {displayName.trim() || (
                    <span className="italic text-text-tertiary/60">
                      Display name
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="profile-name">
                Display name
              </label>
              <input
                id="profile-name"
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={64}
                placeholder="Your name"
                disabled={submitting}
              />
              <p className="helper-text">
                Shown across HyperForge — your team, members, and activity feed.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="profile-avatar">
                Avatar URL
              </label>
              <input
                id="profile-avatar"
                type="url"
                className="input font-mono text-[12px]"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…"
                disabled={submitting}
              />
              <p className="helper-text">
                Public image URL. Leave blank to use a Forge-Gold initial
                placeholder. File uploads coming soon.
              </p>
            </div>

            {/* Privy-managed identity strip */}
            <div className="rounded-md bg-bg-tertiary border border-border-primary px-4 py-3 space-y-2">
              <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-[0.14em]">
                Identity · managed by Privy
              </p>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <p className="text-text-tertiary uppercase tracking-[0.1em] mb-0.5">
                    Email
                  </p>
                  <p className="text-text-primary truncate">
                    {user.email || (
                      <span className="italic text-text-tertiary">—</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-text-tertiary uppercase tracking-[0.1em] mb-0.5">
                    Privy ID
                  </p>
                  <p className="font-mono text-text-primary tabular-nums truncate">
                    {user.privyUserId ? (
                      `${user.privyUserId.slice(0, 14)}…`
                    ) : (
                      <span className="italic text-text-tertiary normal-case">
                        —
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-bg-primary border border-error/40 px-4 py-3 text-sm text-error">
                {error}
              </div>
            )}
          </div>
        </ModalBody>

        <ModalFooter>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors duration-300 ease-out disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid || submitting}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-primary text-bg-primary text-sm font-medium hover:bg-primary-dark transition-colors duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} strokeWidth={1.75} />
            )}
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
