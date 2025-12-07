import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

// --- Types ---

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

interface TacticalInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

interface TacticalSwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

// --- Components ---

export function SettingsSection({
  title,
  description,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <div
      className={cn(
        "mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500",
        className,
      )}
    >
      <div className="flex items-center gap-2 mb-4 border-b border-(--border-primary) pb-2">
        <div className="w-1 h-4 bg-(--accent-primary)" />
        <h2 className="text-lg font-bold uppercase tracking-wider text-(--text-primary)">
          {title}
        </h2>
      </div>
      {description && (
        <p className="text-sm text-(--text-muted) mb-6 font-mono max-w-2xl">
          {description}
        </p>
      )}
      <div className="space-y-6">{children}</div>
    </div>
  );
}

export function TacticalInput({
  label,
  error,
  className,
  ...props
}: TacticalInputProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
        {label}
      </label>
      <input
        className={cn(
          "h-10 px-3 bg-(--bg-secondary)/50 border border-(--border-primary) rounded-sm",
          "text-sm font-mono text-(--text-primary) placeholder:text-(--text-muted)/50",
          "focus:outline-none focus:border-(--accent-primary) focus:ring-1 focus:ring-(--accent-primary)",
          "transition-all duration-200",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error &&
            "border-(--color-danger) focus:border-(--color-danger) focus:ring-(--color-danger)",
        )}
        {...props}
      />
      {error && (
        <span className="text-xs text-(--color-danger) font-mono">{error}</span>
      )}
    </div>
  );
}

export function TacticalSwitch({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: TacticalSwitchProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 border border-(--border-primary) bg-(--bg-secondary)/30 rounded-sm",
        "hover:border-(--accent-primary)/50 transition-colors duration-200",
        disabled && "opacity-50 pointer-events-none",
      )}
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm font-bold text-(--text-primary)">{label}</span>
        {description && (
          <span className="text-xs text-(--text-muted) font-mono">
            {description}
          </span>
        )}
      </div>

      {/* Custom Switch Implementation for "Tactical" feel if shadcn is missing or we want custom */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-primary) focus-visible:ring-offset-2",
          checked
            ? "bg-(--accent-primary)"
            : "bg-(--bg-primary) border-(--border-primary)",
        )}
      >
        <span
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}

export function TacticalSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-10 w-full appearance-none px-3 bg-(--bg-secondary)/50 border border-(--border-primary) rounded-sm",
            "text-sm font-mono text-(--text-primary)",
            "focus:outline-none focus:border-(--accent-primary) focus:ring-1 focus:ring-(--accent-primary)",
            "cursor-pointer",
          )}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <ChevronRight className="w-4 h-4 text-(--text-muted) rotate-90" />
        </div>
      </div>
    </div>
  );
}
