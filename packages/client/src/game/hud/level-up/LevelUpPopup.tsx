/**
 * LevelUpPopup - RuneScape-style level-up notification popup
 *
 * Uses the reusable AchievementPopup component with:
 * - Centered modal with skill icon and level
 * - Celebration particle animation
 * - Skill unlock display (what's new at this level)
 * - Auto-dismiss after 5 seconds
 * - Click anywhere to dismiss early
 * - Non-blocking (player can continue actions)
 */

import { SKILL_ICONS } from "@hyperforge/shared";
import { AchievementPopup } from "@/ui";
import type { LevelUpEvent } from "./useLevelUpState";
import { capitalizeSkill } from "./utils";
import { UnlocksSection } from "./UnlocksSection";

/** Auto-dismiss duration in milliseconds */
const AUTO_DISMISS_MS = 5000;

interface LevelUpPopupProps {
  event: LevelUpEvent;
  onDismiss: () => void;
}

export function LevelUpPopup({ event, onDismiss }: LevelUpPopupProps) {
  const { skill, newLevel } = event;
  const skillKey = skill.toLowerCase();
  const skillIcon = SKILL_ICONS[skillKey] || "\u2B50";

  return (
    <AchievementPopup
      visible={true}
      onClose={onDismiss}
      variant="levelUp"
      icon={skillIcon}
      title="Congratulations!"
      subtitle={`You've advanced a ${capitalizeSkill(skill)} level!`}
      badge={<span>Level {newLevel}</span>}
      autoDismissMs={AUTO_DISMISS_MS}
      showCelebration={true}
    >
      <UnlocksSection skill={skill} level={newLevel} />
    </AchievementPopup>
  );
}
