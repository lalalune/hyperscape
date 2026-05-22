/**
 * CreateTeamDialog — modal for creating a new team.
 *
 * Auto-slugs the name as the user types, but lets them edit the slug
 * if they want a different identifier.
 *
 * Mounted via the "New team" CTA on /teams.
 */

import { Loader2, Plus, Users } from "lucide-react";
import React, { useState } from "react";

import { Modal, ModalHeader, ModalBody, ModalFooter } from "../common/Modal";
import {
  createTeam,
  slugifyTeamName,
  type TeamResponse,
} from "../../utils/teamApi";

interface CreateTeamDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (team: TeamResponse) => void;
}

export function CreateTeamDialog({
  open,
  onClose,
  onCreated,
}: CreateTeamDialogProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugManuallyEdited) {
      setSlug(slugifyTeamName(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true);
    setSlug(slugifyTeamName(value));
  };

  const reset = () => {
    setName("");
    setSlug("");
    setSlugManuallyEdited(false);
    setDescription("");
    setError(null);
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();
    if (!trimmedName || !trimmedSlug) {
      setError("Name and slug are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const team = await createTeam({
        name: trimmedName,
        slug: trimmedSlug,
        description: description.trim() || undefined,
      });
      onCreated(team);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setSubmitting(false);
    }
  };

  const valid = name.trim().length > 0 && slug.trim().length > 0;

  return (
    <Modal open={open} onClose={handleClose} size="md">
      <ModalHeader>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-bg-primary border border-border-primary flex items-center justify-center flex-shrink-0">
            <Users size={14} strokeWidth={1.5} className="text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-medium text-text-primary tracking-tight">
              New team
            </h2>
            <p className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] mt-0.5">
              Create a workspace
            </p>
          </div>
        </div>
      </ModalHeader>

      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="space-y-5">
            <div>
              <label className="label" htmlFor="team-name">
                Team name
              </label>
              <input
                id="team-name"
                className="input"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Forge Studios"
                autoFocus
                disabled={submitting}
              />
              <p className="helper-text">
                Display name. Visible to all members.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="team-slug">
                Slug
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-tertiary font-mono tabular-nums">
                  hyperforge.app/
                </span>
                <input
                  id="team-slug"
                  className="input font-mono"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="forge-studios"
                  disabled={submitting}
                />
              </div>
              <p className="helper-text">
                URL identifier. Auto-generated from name; edit if needed. Must
                be unique.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="team-description">
                Description
              </label>
              <textarea
                id="team-description"
                className="input min-h-[80px] resize-y"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short description of what the team is building (optional)"
                disabled={submitting}
              />
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
              <Plus size={14} strokeWidth={2} />
            )}
            {submitting ? "Creating…" : "Create team"}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
