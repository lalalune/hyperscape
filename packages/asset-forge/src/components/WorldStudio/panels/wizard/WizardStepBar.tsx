/**
 * WizardStepBar — Step indicator bar showing wizard progress across stages
 */

import { Check, Route } from "lucide-react";
import React from "react";

import type { GenerationStep } from "../../utils/generationStateMachine";

import { STEP_ICONS } from "./WizardSharedUI";

export function StepBar({
  steps,
  currentIndex,
  completedSteps,
  onJump,
}: {
  steps: readonly GenerationStep[];
  currentIndex: number;
  completedSteps: Set<number>;
  onJump: (idx: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => {
        const isCompleted = completedSteps.has(step.index);
        const isCurrent = step.index === currentIndex;
        const Icon = STEP_ICONS[step.index] ?? Route;
        const canClick = isCompleted || step.index <= currentIndex;

        return (
          <React.Fragment key={step.index}>
            {i > 0 && (
              <div
                className={`flex-1 h-px mx-1 ${isCompleted ? "bg-green-500" : "bg-border-primary border-t border-dashed border-border-secondary"}`}
              />
            )}
            <button
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] transition-colors ${
                isCurrent
                  ? "bg-primary/15 text-primary font-medium"
                  : isCompleted
                    ? "text-green-400 hover:bg-bg-tertiary cursor-pointer"
                    : "text-text-tertiary cursor-default"
              } ease-out`}
              onClick={() => canClick && onJump(step.index)}
              disabled={!canClick}
            >
              {isCompleted ? (
                <Check size={12} className="text-green-400" />
              ) : (
                <Icon size={12} />
              )}
              {step.name}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
