import { ArrowRight, Package, User } from "lucide-react";

import { AtmosphericScene, StatusDot } from "../shared/page";

interface GenerationTypeSelectorProps {
  onSelectType: (type: "item" | "avatar") => void;
}

interface TypeCardProps {
  onClick: () => void;
  number: string;
  eyebrow: string;
  icon: typeof Package;
  title: string;
  description: string;
  tags: string[];
}

function TypeCard({
  onClick,
  number,
  eyebrow,
  icon: Icon,
  title,
  description,
  tags,
}: TypeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col rounded-lg bg-bg-tertiary border border-border-primary hover:border-primary/40 transition-colors duration-500 ease-out overflow-hidden h-full p-7 text-left"
    >
      {/* Forge Gold left-edge on hover — "earned" affordance */}
      <span className="pointer-events-none absolute left-0 top-6 bottom-6 w-px bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out" />

      {/* Subtle radial atmosphere on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(212,175,55,0.05) 0%, transparent 70%)",
        }}
      />

      {/* Numbered eyebrow */}
      <div className="relative flex items-baseline gap-3 mb-5">
        <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
          {number}
        </span>
        <span className="text-[11px] text-text-tertiary uppercase tracking-[0.14em]">
          {eyebrow}
        </span>
      </div>

      {/* Icon */}
      <div className="relative mb-5">
        <Icon
          size={28}
          strokeWidth={1.25}
          className="text-text-secondary group-hover:text-primary transition-colors duration-500 ease-out"
        />
      </div>

      {/* Title + description */}
      <div className="relative flex-1">
        <h2 className="font-display text-xl font-medium text-text-primary tracking-tight mb-3">
          {title}
        </h2>
        <p className="text-sm text-text-tertiary leading-relaxed">
          {description}
        </p>
      </div>

      {/* Tag chips */}
      <div className="relative mt-5 pt-4 border-t border-border-primary flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className="text-[10px] font-mono text-text-tertiary tabular-nums px-2 py-0.5 rounded bg-bg-primary/60 border border-border-primary"
          >
            {t}
          </span>
        ))}
      </div>

      {/* CTA arrow on hover */}
      <ArrowRight
        size={14}
        strokeWidth={1.5}
        className="absolute top-7 right-7 text-text-tertiary opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all duration-500 ease-out"
      />
    </button>
  );
}

export function GenerationTypeSelector({
  onSelectType,
}: GenerationTypeSelectorProps) {
  return (
    <div className="relative w-full h-full bg-bg-primary overflow-y-auto">
      <AtmosphericScene topEllipseHeight={520} horizonY={360} />

      <div className="relative max-w-4xl mx-auto px-10 py-16">
        {/* Editorial hero */}
        <header className="mb-12 text-center">
          <div className="inline-flex items-baseline gap-3 mb-5">
            <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
              00
            </span>
            <span className="font-display text-base font-medium text-text-primary tracking-tight">
              Generation
            </span>
            <span className="flex items-center gap-2 text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
              <StatusDot tone="ready" />
              Ready
            </span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-medium text-text-primary tracking-tight leading-[1.05] mb-4">
            What would you like to <span className="text-primary">create</span>?
          </h1>
          <p className="text-base text-text-tertiary leading-relaxed max-w-xl mx-auto">
            Choose a generation type to start the pipeline. Items run through
            the model → texture flow; avatars add automatic rigging.
          </p>
        </header>

        {/* Two-card chooser */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TypeCard
            onClick={() => onSelectType("item")}
            number="01"
            eyebrow="Items"
            icon={Package}
            title="Weapons, armor, props"
            description="Weapons, armor, tools, consumables, and other game objects ready to drop into your world."
            tags={["Weapons", "Armor", "Tools", "Props"]}
          />
          <TypeCard
            onClick={() => onSelectType("avatar")}
            number="02"
            eyebrow="Avatars"
            icon={User}
            title="Characters and NPCs"
            description="Humanoid characters, NPCs, and creatures with automatic rigging and animation support baked in."
            tags={["Auto-rig", "Animations", "Humanoid"]}
          />
        </div>

        <p className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] text-center mt-10">
          Avatar rigging currently supports humanoid / bipedal characters
        </p>
      </div>
    </div>
  );
}

export default GenerationTypeSelector;
