/**
 * ValidationIssues — live feed of `validateLayout` issues.
 *
 * Uses the same issue categories emitted by
 * `@hyperforge/ui-framework` so the editor stays consistent with
 * server-side validation.
 */

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useLayoutValidation, useUILayoutStore } from "./store";

export function ValidationIssues() {
  const result = useLayoutValidation();
  const selectInstance = useUILayoutStore((s) => s.selectInstance);

  if (result.ok) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
        <CheckCircle2 size={14} />
        Layout is valid.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <h3 className="flex items-center gap-2 text-xs font-semibold text-amber-300">
        <AlertTriangle size={14} />
        {result.issues.length} issue{result.issues.length === 1 ? "" : "s"}
      </h3>
      <ul className="flex flex-col gap-1">
        {result.issues.map((issue, idx) => (
          <li
            key={idx}
            className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200"
          >
            {issue.instanceId ? (
              <button
                onClick={() => selectInstance(issue.instanceId ?? null)}
                className="font-medium text-amber-100 hover:underline"
              >
                {issue.instanceId}
              </button>
            ) : (
              <span className="font-medium text-amber-100">(manifest)</span>
            )}
            <span className="ml-2 rounded bg-amber-700/30 px-1 py-0.5 text-[9px] uppercase tracking-[0.12em]">
              {issue.code}
            </span>
            <p className="mt-0.5 text-amber-200/90">{issue.message}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
