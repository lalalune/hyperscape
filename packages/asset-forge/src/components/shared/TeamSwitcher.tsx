/**
 * TeamSwitcher — dropdown for switching the active team.
 *
 * Reads from ActiveTeamContext. Renders a compact pill in the top
 * nav bar showing the active team name + chevron. Click opens a
 * dropdown listing all teams the user belongs to.
 *
 * No-op when the user has zero teams.
 */

import { Check, ChevronDown, Plus, Users } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useActiveTeam } from "../../contexts/ActiveTeamContext";
import { ROUTES, buildTeamDetailPath } from "../../constants";

export function TeamSwitcher() {
  const navigate = useNavigate();
  const { teams, activeTeam, setActiveTeamId } = useActiveTeam();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  if (teams.length === 0) {
    return null;
  }

  const label = activeTeam?.teamName ?? "Select team";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-bg-tertiary border border-border-primary hover:border-primary/40 transition-colors duration-300 ease-out max-w-[200px]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Users
          size={12}
          strokeWidth={1.5}
          className="text-text-tertiary group-hover:text-primary transition-colors duration-300 ease-out flex-shrink-0"
        />
        <span className="text-xs font-medium text-text-primary truncate">
          {label}
        </span>
        <ChevronDown
          size={11}
          strokeWidth={1.5}
          className={`text-text-tertiary transition-transform duration-300 ease-out flex-shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-1.5 z-50 min-w-[240px] rounded-md bg-bg-secondary border border-border-primary shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-border-primary">
            <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-[0.14em]">
              Switch team
            </p>
          </div>
          <ul className="py-1 max-h-[280px] overflow-y-auto scrollbar-thin">
            {teams.map((t) => {
              const isActive = t.teamId === activeTeam?.teamId;
              return (
                <li key={t.teamId}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTeamId(t.teamId);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-bg-tertiary transition-colors duration-300 ease-out ${
                      isActive ? "bg-bg-tertiary" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {t.teamName}
                      </p>
                      <p className="text-[10px] text-text-tertiary uppercase tracking-[0.1em] mt-0.5">
                        {t.role}
                      </p>
                    </div>
                    {isActive && (
                      <Check
                        size={12}
                        strokeWidth={2}
                        className="text-primary flex-shrink-0"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border-primary py-1">
            {activeTeam && (
              <button
                type="button"
                onClick={() => {
                  navigate(buildTeamDetailPath(activeTeam.teamId));
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-[11px] text-text-tertiary hover:text-primary uppercase tracking-[0.12em] hover:bg-bg-tertiary transition-colors duration-300 ease-out"
              >
                Team settings
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                navigate(ROUTES.TEAMS);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] text-text-tertiary hover:text-primary uppercase tracking-[0.12em] hover:bg-bg-tertiary transition-colors duration-300 ease-out"
            >
              <Plus size={10} strokeWidth={1.5} />
              All teams
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
