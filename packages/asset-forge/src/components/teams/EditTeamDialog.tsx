/**
 * EditTeamDialog — modal for editing an existing team's settings.
 *
 * Available fields: name, description. Avatar upload not yet wired
 * (would need media-upload service).
 *
 * Mounted via "Settings" CTA on /teams/:teamId. Owner/admin only.
 */

import { Loader2, Settings, Save } from "lucide-react";
import React, { useState, useEffect } from "react";

import { useApp } from "../../contexts/AppContext";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../common/Modal";
import { updateTeam, type TeamResponse } from "../../utils/teamApi";

interface EditTeamDialogProps {
  open: boolean;
  onClose: () => void;
  team: TeamResponse;
  onUpdated: (team: TeamResponse) => void;
}

export function EditTeamDialog({
  open,
  onClose,
  team,
  onUpdated,
}: EditTeamDialogProps) {
  const { showNotification } = useApp();
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when team changes or modal opens
  useEffect(() => {
    if (open) {
      setName(team.name);
      setDescription(team.description ?? "");
      setError(null);
      setSubmitting(false);
    }
  }, [open, team.name, team.description]);

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Team name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const updated = await updateTeam(team.id, {
        name: trimmedName,
        description: description.trim() || null,
      });
      showNotification(`Updated "${updated.name}"`, "success");
      onUpdated(updated);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update team";
      setError(msg);
      showNotification(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const isDirty =
    name.trim() !== team.name ||
    description.trim() !== (team.description ?? "");
  const valid = name.trim().length > 0 && isDirty;

  return (
    <Modal open={open} onClose={handleClose} size="md">
      <ModalHeader>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-bg-primary border border-border-primary flex items-center justify-center flex-shrink-0">
            <Settings size={14} strokeWidth={1.5} className="text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-medium text-text-primary tracking-tight">
              Team settings
            </h2>
            <p className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] mt-0.5 font-mono normal-case tracking-normal">
              {team.slug}
            </p>
          </div>
        </div>
      </ModalHeader>

      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="space-y-5">
            <div>
              <label className="label" htmlFor="edit-team-name">
                Team name
              </label>
              <input
                id="edit-team-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Forge Studios"
                disabled={submitting}
              />
            </div>

            <div>
              <label className="label" htmlFor="edit-team-description">
                Description
              </label>
              <textarea
                id="edit-team-description"
                className="input min-h-[80px] resize-y"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short description of what the team is building"
                disabled={submitting}
              />
            </div>

            {/* Read-only context fields — show what can't be changed here */}
            <div className="rounded-md bg-bg-tertiary border border-border-primary px-4 py-3 space-y-2">
              <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-[0.14em]">
                Read-only
              </p>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <p className="text-text-tertiary uppercase tracking-[0.1em] mb-0.5">
                    Slug
                  </p>
                  <p className="font-mono text-text-primary tabular-nums truncate">
                    {team.slug}
                  </p>
                </div>
                <div>
                  <p className="text-text-tertiary uppercase tracking-[0.1em] mb-0.5">
                    Plan
                  </p>
                  <p className="font-display text-text-primary">{team.plan}</p>
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
