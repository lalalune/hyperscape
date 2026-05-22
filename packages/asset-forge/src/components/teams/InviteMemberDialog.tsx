/**
 * InviteMemberDialog — modal for inviting someone to a team by email.
 *
 * Server creates an invite token (TeamInviteResponse) that the invitee
 * accepts via POST /api/invites/accept. The invite link / token isn't
 * surfaced in this modal yet — the server emails it. Future: show
 * the invite token in a "Share link" reveal.
 */

import {
  Check,
  Copy,
  Crown,
  Loader2,
  Mail,
  Send,
  Settings,
  Shield,
  User,
} from "lucide-react";
import React, { useState } from "react";

import { useApp } from "../../contexts/AppContext";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../common/Modal";
import { inviteToTeam, type TeamInviteResponse } from "../../utils/teamApi";

const ROLES = [
  {
    value: "admin",
    label: "Admin",
    description: "Manage team settings, invite members, edit roles.",
    icon: Shield,
    isPrimary: true,
  },
  {
    value: "editor",
    label: "Editor",
    description: "Create and edit worlds, assets, and manifests.",
    icon: Settings,
    isPrimary: false,
  },
  {
    value: "viewer",
    label: "Viewer",
    description: "Read-only access to team worlds and library.",
    icon: User,
    isPrimary: false,
  },
] as const;

interface InviteMemberDialogProps {
  open: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  /** Whether the viewer is an owner (controls whether Owner role can be assigned). */
  viewerIsOwner: boolean;
  onInvited: (invite: TeamInviteResponse) => void;
}

export function InviteMemberDialog({
  open,
  onClose,
  teamId,
  teamName,
  viewerIsOwner,
  onInvited,
}: InviteMemberDialogProps) {
  const { showNotification } = useApp();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("editor");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** When set, the invite was created — show the reveal step. */
  const [createdInvite, setCreatedInvite] = useState<TeamInviteResponse | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const availableRoles = viewerIsOwner
    ? ([
        {
          value: "owner",
          label: "Owner",
          description: "Full control. Can delete the team.",
          icon: Crown,
          isPrimary: true,
        },
        ...ROLES,
      ] as const)
    : ROLES;

  const reset = () => {
    setEmail("");
    setRole("editor");
    setError(null);
    setSubmitting(false);
    setCreatedInvite(null);
    setCopied(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const buildInviteLink = (token: string): string => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/invites/accept?token=${encodeURIComponent(token)}`;
  };

  const handleCopy = async () => {
    if (!createdInvite) return;
    try {
      await navigator.clipboard.writeText(buildInviteLink(createdInvite.token));
      setCopied(true);
      showNotification("Invite link copied to clipboard", "success");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showNotification("Failed to copy — copy the link manually", "error");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const invite = await inviteToTeam(teamId, { email: trimmed, role });
      onInvited(invite);
      setCreatedInvite(invite);
      showNotification(`Invited ${trimmed}`, "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send invite";
      setError(msg);
      showNotification(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // === Reveal step — invite has been created, show link for copy === //
  if (createdInvite) {
    const inviteLink = buildInviteLink(createdInvite.token);
    return (
      <Modal open={open} onClose={handleClose} size="md">
        <ModalHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-bg-primary border border-border-primary flex items-center justify-center flex-shrink-0">
              <Check size={14} strokeWidth={2} className="text-success" />
            </div>
            <div>
              <h2 className="font-display text-lg font-medium text-text-primary tracking-tight">
                Invite sent
              </h2>
              <p className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] mt-0.5">
                {createdInvite.email}
              </p>
            </div>
          </div>
        </ModalHeader>

        <ModalBody>
          <div className="space-y-5">
            <p className="text-sm text-text-tertiary leading-relaxed">
              An invite was sent to{" "}
              <span className="text-text-primary">{createdInvite.email}</span>.
              You can also share the link below directly — it grants the same
              access.
            </p>

            <div>
              <span className="label">Invite link</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  className="input font-mono text-[12px]"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 rounded-md bg-bg-tertiary border border-border-primary hover:border-primary/40 text-sm text-text-secondary hover:text-primary transition-colors duration-300 ease-out"
                  title="Copy invite link"
                >
                  {copied ? (
                    <>
                      <Check
                        size={14}
                        strokeWidth={2}
                        className="text-success"
                      />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy size={14} strokeWidth={1.5} />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <p className="helper-text">
                Expires {new Date(createdInvite.expiresAt).toLocaleDateString()}{" "}
                · Role:{" "}
                <span className="uppercase tracking-wider">
                  {createdInvite.role}
                </span>
              </p>
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <button
            type="button"
            onClick={() => {
              // Reset to send another invite
              setCreatedInvite(null);
              setEmail("");
              setRole("editor");
            }}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors duration-300 ease-out"
          >
            Invite another
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-primary text-bg-primary text-sm font-medium hover:bg-primary-dark transition-colors duration-300 ease-out"
          >
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} size="md">
      <ModalHeader>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-bg-primary border border-border-primary flex items-center justify-center flex-shrink-0">
            <Mail size={14} strokeWidth={1.5} className="text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-medium text-text-primary tracking-tight">
              Invite to team
            </h2>
            <p className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] mt-0.5">
              {teamName}
            </p>
          </div>
        </div>
      </ModalHeader>

      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="space-y-5">
            <div>
              <label className="label" htmlFor="invite-email">
                Email address
              </label>
              <input
                id="invite-email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoFocus
                disabled={submitting}
              />
              <p className="helper-text">
                The invitee receives a link to accept. They&apos;ll join with
                the role you select below.
              </p>
            </div>

            <div>
              <span className="label">Role</span>
              <div className="space-y-2">
                {availableRoles.map((r) => {
                  const Icon = r.icon;
                  const selected = role === r.value;
                  return (
                    <label
                      key={r.value}
                      className={`group flex items-start gap-3 p-4 rounded-md cursor-pointer transition-colors duration-300 ease-out border ${
                        selected
                          ? "bg-bg-primary border-primary/60"
                          : "bg-bg-tertiary border-border-primary hover:border-border-secondary"
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={r.value}
                        checked={selected}
                        onChange={(e) => setRole(e.target.value)}
                        disabled={submitting}
                        className="sr-only"
                      />
                      {/* Visual radio indicator */}
                      <span
                        className={`relative mt-0.5 w-3.5 h-3.5 rounded-full border flex-shrink-0 transition-colors duration-300 ease-out ${
                          selected
                            ? "border-primary bg-primary"
                            : "border-border-secondary"
                        }`}
                      >
                        {selected && (
                          <span className="absolute inset-1 rounded-full bg-bg-primary" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon
                            size={12}
                            strokeWidth={1.5}
                            className={
                              r.isPrimary
                                ? "text-primary"
                                : "text-text-tertiary"
                            }
                          />
                          <span
                            className={`text-[11px] uppercase tracking-[0.12em] ${
                              r.isPrimary
                                ? "text-primary"
                                : "text-text-secondary"
                            }`}
                          >
                            {r.label}
                          </span>
                        </div>
                        <p className="text-xs text-text-tertiary leading-relaxed">
                          {r.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
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
            disabled={!email.trim() || submitting}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-primary text-bg-primary text-sm font-medium hover:bg-primary-dark transition-colors duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} strokeWidth={1.75} />
            )}
            {submitting ? "Sending…" : "Send invite"}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
