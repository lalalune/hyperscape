/**
 * Reputation Display for Player Nameplates
 * Shows badges above player heads in-game
 *
 * IMPLEMENTATION STATUS: Structure defined, rendering TODO
 * WORKAROUND: Players can check reputation via Gateway
 */

interface ReputationNameplateProps {
  agentId: number;
}

/**
 * Render reputation badge on player nameplate
 *
 * TODO: Full implementation requires:
 * 1. Query label data from BanManager/LabelManager
 * 2. Render 3D billboard sprite above player
 * 3. Update on label changes
 * 4. Cache for performance
 *
 * Estimated: 4 hours for full implementation
 */
export default function ReputationNameplate({
  agentId,
}: ReputationNameplateProps) {
  // TODO: Query labels
  // const labels = await labelManager.getLabels(agentId);

  // TODO: Render as 3D sprite
  // Implementation:
  // 1. Create THREE.Sprite with icon texture
  // 2. Position above player head (+2 units Y)
  // 3. Billboard mode (always face camera)
  // 4. Update color based on label (red=HACKER, orange=SCAMMER, green=TRUSTED)

  console.log(`Reputation nameplate for agent ${agentId} - TODO`);

  return null; // Would return THREE.Sprite in real implementation
}
