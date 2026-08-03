/**
 * XPProgressOrb - XP Progress Display (third-party-client XP globe style)
 *
 * Composition root that combines:
 * - useXPOrbState: State management and event subscription
 * - XPProgressOrbs: Circular progress orbs with tooltips
 * - FloatingXPDrops: Animated XP numbers rising to orbs
 *
 * Features:
 * - Separate orb per active skill (side by side)
 * - Progress ring shows XP to next level
 * - Floating XP numbers (grouped by game tick) rise toward orbs
 * - Hover tooltip shows detailed XP info
 * - Orbs fade after ~10 seconds of inactivity
 * - Smooth fade-out animation (1 second)
 *
 * @see XPDropSystem for alternative 3D sprite-based drops (disabled)
 */

import { useXPOrbState } from "./useXPOrbState";
import { XPProgressOrbs } from "./XPProgressOrbs";
import { FloatingXPDrops } from "./FloatingXPDrops";
import type { ClientWorld } from "../../../types";

interface XPProgressOrbProps {
  world: ClientWorld;
}

export function XPProgressOrb({ world }: XPProgressOrbProps) {
  const {
    skillsWithProgress,
    levelUpSkill,
    floatingDrops,
    hoveredSkill,
    setHoveredSkill,
  } = useXPOrbState(world);

  // Don't render if no skill has been trained yet
  if (skillsWithProgress.length === 0 && floatingDrops.length === 0) {
    return null;
  }

  return (
    <>
      <FloatingXPDrops drops={floatingDrops} />
      <XPProgressOrbs
        skills={skillsWithProgress}
        levelUpSkill={levelUpSkill}
        hoveredSkill={hoveredSkill}
        onHoverSkill={setHoveredSkill}
      />
    </>
  );
}
